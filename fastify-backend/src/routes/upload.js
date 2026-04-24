'use strict'

const fs   = require('fs')
const path = require('path')
const { pipeline } = require('stream/promises')

const UPLOAD_DIR = '/home/ubuntu/static/uploads'

const ALLOWED_EXTS = new Set([
  '.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp',
  '.mp4', '.mov', '.avi', '.mkv', '.webm', '.m4v',
  '.mp3', '.wav', '.aac', '.m4a', '.ogg', '.flac',
])

async function uploadRoutes(fastify) {

  // POST /upload  — accepts a single file field named "file"
  fastify.post('/', async (request, reply) => {
    let part
    try {
      part = await request.file({ limits: { fileSize: 50 * 1024 * 1024 } })
    } catch (err) {
      return reply.code(400).send({ success: false, error: `上传失败：${err.message}` })
    }

    if (!part) {
      return reply.code(400).send({ success: false, error: '未收到文件' })
    }

    const ext = path.extname(part.filename).toLowerCase()
    if (!ALLOWED_EXTS.has(ext)) {
      // consume stream to avoid memory leak
      part.file.resume()
      return reply.code(400).send({ success: false, error: `不支持的文件类型：${ext || '(无扩展名)'}` })
    }

    fs.mkdirSync(UPLOAD_DIR, { recursive: true })

    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}${ext}`
    const filepath  = path.join(UPLOAD_DIR, filename)

    try {
      await pipeline(part.file, fs.createWriteStream(filepath))
    } catch (err) {
      return reply.code(500).send({ success: false, error: `写入失败：${err.message}` })
    }

    if (part.file.truncated) {
      fs.unlink(filepath, () => {})
      return reply.code(413).send({ success: false, error: '文件超过 50MB 限制' })
    }

    const base = (process.env.WEBHOOK_BASE_URL || '').replace(/\/$/, '')
    const url  = `${base}/uploads/${filename}`

    return { success: true, data: { url, filename } }
  })
}

module.exports = uploadRoutes
