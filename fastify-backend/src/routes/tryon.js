'use strict'

const fs   = require('fs')
const path = require('path')
const { tryon } = require('../tryon/service')

const UPLOAD_DIR = '/home/ubuntu/static/uploads/tryon'
const ALLOWED_EXTS = new Set(['.jpg', '.jpeg', '.png', '.webp'])
const EXT_MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp' }

function resolveMime(mimetype, ext) {
  if (mimetype && !mimetype.includes('octet-stream')) return mimetype
  return EXT_MIME[ext] || 'image/jpeg'
}

// 解析 data URI 或纯 base64，返回 { data, mimeType }
function parseBase64Field(val) {
  if (!val) return null
  if (val.startsWith('data:')) {
    const m = val.match(/^data:([^;]+);base64,(.+)$/)
    if (m) return { mimeType: m[1], data: m[2] }
  }
  return { mimeType: 'image/jpeg', data: val }
}

async function tryonRoutes(fastify) {

  fastify.post('/', async (request, reply) => {
    const ct = request.headers['content-type'] || ''
    let humanBase64, humanMimeType, clothBase64, clothMimeType, apiKey, baseUrl

    if (ct.includes('multipart/form-data')) {
      // ── multipart 模式 ──
      const parts = request.parts({ limits: { fileSize: 20 * 1024 * 1024 } })
      const files  = {}
      const fields = {}

      for await (const part of parts) {
        if (part.type === 'file') {
          const chunks = []
          for await (const chunk of part.file) chunks.push(chunk)
          const ext = path.extname(part.filename).toLowerCase() || '.jpg'
          files[part.fieldname] = {
            buffer:    Buffer.concat(chunks),
            mimeType:  resolveMime(part.mimetype, ext),
            ext,
            truncated: part.file.truncated,
          }
        } else if (part.type === 'field') {
          fields[part.fieldname] = part.value
        }
      }

      if (!files.human_image) return reply.code(400).send({ success: false, error: '缺少 human_image 字段' })
      if (!files.cloth_image)  return reply.code(400).send({ success: false, error: '缺少 cloth_image 字段' })

      for (const [key, f] of Object.entries(files)) {
        if (f.truncated) return reply.code(413).send({ success: false, error: `${key} 超过 20MB 限制` })
        if (!ALLOWED_EXTS.has(f.ext)) return reply.code(400).send({ success: false, error: `${key} 不支持的格式：${f.ext}` })
      }

      humanBase64  = files.human_image.buffer.toString('base64')
      humanMimeType = files.human_image.mimeType
      clothBase64  = files.cloth_image.buffer.toString('base64')
      clothMimeType = files.cloth_image.mimeType
      apiKey   = fields.api_key  || null
      baseUrl  = fields.base_url || null

    } else {
      // ── JSON 模式：{ human_image, cloth_image, api_key?, base_url? } ──
      // human_image / cloth_image 可以是 base64 字符串或 data:mimeType;base64,... URI
      const body = request.body || {}
      const human = parseBase64Field(body.human_image)
      const cloth = parseBase64Field(body.cloth_image)
      if (!human) return reply.code(400).send({ success: false, error: '缺少 human_image 字段' })
      if (!cloth)  return reply.code(400).send({ success: false, error: '缺少 cloth_image 字段' })

      humanBase64   = human.data
      humanMimeType = human.mimeType
      clothBase64   = cloth.data
      clothMimeType = cloth.mimeType
      apiKey   = body.api_key  || null
      baseUrl  = body.base_url || null
    }

    let result
    try {
      result = await tryon({ humanImageBase64: humanBase64, humanMimeType, clothImageBase64: clothBase64, clothMimeType, apiKey, baseUrl })
    } catch (err) {
      return reply.code(500).send({ success: false, error: err.message })
    }

    fs.mkdirSync(UPLOAD_DIR, { recursive: true })
    const ext      = result.mimeType === 'image/jpeg' ? '.jpg' : '.png'
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`
    const filepath  = path.join(UPLOAD_DIR, filename)

    try {
      fs.writeFileSync(filepath, Buffer.from(result.data, 'base64'))
    } catch (err) {
      return reply.code(500).send({ success: false, error: `保存结果图片失败：${err.message}` })
    }

    const base = (process.env.WEBHOOK_BASE_URL || '').replace(/\/$/, '')
    return { success: true, data: { result_url: `${base}/uploads/tryon/${filename}` } }
  })
}

module.exports = tryonRoutes
