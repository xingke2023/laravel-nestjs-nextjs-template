'use strict'

const fs   = require('fs')
const path = require('path')
const { pipeline } = require('stream/promises')
const { listItems, createItem, deleteItem } = require('../clothing/service')

const UPLOAD_DIR = '/home/ubuntu/static/uploads/clothing'
const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp'])
const VALID_CATEGORIES = new Set(['top', 'pants', 'skirt', 'accessory'])

async function clothingRoutes(fastify) {

  // GET /clothing/items?category=top
  fastify.get('/items', async (request, reply) => {
    const userId = request.jwtPayload?.userId || request.jwtPayload?.sub || null
    const { category } = request.query
    if (category && !VALID_CATEGORIES.has(category)) {
      return reply.code(400).send({ success: false, error: '无效的分类' })
    }
    const items = await listItems(fastify.db, userId, category || null)
    return { success: true, data: items }
  })

  // POST /clothing/upload  — multipart: file + category + name?
  fastify.post('/upload', async (request, reply) => {
    const userId = request.jwtPayload?.userId || request.jwtPayload?.sub || null

    const parts = request.parts({ limits: { fileSize: 20 * 1024 * 1024 } })

    let filePart = null
    let category = null
    let name = null

    for await (const part of parts) {
      if (part.type === 'file' && part.fieldname === 'file') {
        filePart = part
        // Must buffer here since we're inside async iteration
        const chunks = []
        for await (const chunk of part.file) {
          chunks.push(chunk)
        }
        filePart._buffer = Buffer.concat(chunks)
        filePart._truncated = part.file.truncated
      } else if (part.type === 'field') {
        if (part.fieldname === 'category') category = part.value
        if (part.fieldname === 'name') name = part.value
      }
    }

    if (!filePart) {
      return reply.code(400).send({ success: false, error: '未收到文件' })
    }
    if (!category || !VALID_CATEGORIES.has(category)) {
      return reply.code(400).send({ success: false, error: '请选择有效的分类（top/pants/skirt/accessory）' })
    }
    if (filePart._truncated) {
      return reply.code(413).send({ success: false, error: '文件超过 20MB 限制' })
    }

    const ext = path.extname(filePart.filename).toLowerCase()
    if (!ALLOWED_EXTS.has(ext)) {
      return reply.code(400).send({ success: false, error: `不支持的文件类型：${ext || '(无扩展名)'}` })
    }

    fs.mkdirSync(UPLOAD_DIR, { recursive: true })
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`
    const filepath  = path.join(UPLOAD_DIR, filename)

    try {
      fs.writeFileSync(filepath, filePart._buffer)
    } catch (err) {
      return reply.code(500).send({ success: false, error: `写入失败：${err.message}` })
    }

    const base = (process.env.WEBHOOK_BASE_URL || '').replace(/\/$/, '')
    const imageUrl = `${base}/uploads/clothing/${filename}`

    const item = await createItem(fastify.db, { userId, category, name, imageUrl, filename })
    return { success: true, data: item }
  })

  // DELETE /clothing/items/:id
  fastify.delete('/items/:id', async (request, reply) => {
    const userId = request.jwtPayload?.userId || request.jwtPayload?.sub || null
    const item = await deleteItem(fastify.db, request.params.id, userId)
    if (!item) {
      return reply.code(404).send({ success: false, error: '未找到该商品或无权限删除' })
    }
    // Remove file from disk
    const filepath = path.join(UPLOAD_DIR, item.filename)
    fs.unlink(filepath, () => {})
    return { success: true }
  })
}

module.exports = clothingRoutes
