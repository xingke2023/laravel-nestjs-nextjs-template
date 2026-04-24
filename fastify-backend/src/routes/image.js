'use strict'

const { generateImage } = require('../image/service')
const { saveImageGeneration, getImageHistory, getImageGenerationById } = require('../history/service')

const imgArraySchema = (maxItems) => ({
  type: 'array',
  maxItems,
  items: {
    type: 'object',
    required: ['mimeType', 'data'],
    properties: {
      mimeType: { type: 'string' },
      data:     { type: 'string' },
    },
  },
})

async function imageRoutes(fastify) {
  // ─── POST /image/generate ─────────────────────────────────────────────────
  fastify.post('/generate', {
    schema: {
      body: {
        type: 'object',
        // prompt is optional when contents is supplied (chat mode)
        properties: {
          prompt:          { type: 'string', minLength: 1, maxLength: 2000 },
          // Multi-turn chat history in Gemini contents format
          contents:        { type: 'array' },
          model:           { type: 'string' },
          aspectRatio:     { type: 'string' },
          imageSize:       { type: 'string' },
          thinkingLevel:   { type: 'string' },
          temperature:     { type: 'number', minimum: 0, maximum: 2 },
          topP:            { type: 'number', minimum: 0, maximum: 1 },
          enableSearch:    { type: 'boolean' },
          objectImages:    imgArraySchema(10),  // 对象保真参考图
          characterImages: imgArraySchema(4),   // 角色一致性参考图
          apiKey:          { type: 'string' },  // 用户自定义 API Key
          baseUrl:         { type: 'string' },  // 用户自定义 Base URL
          historyType:     { type: 'string' },  // 'image' | 'image_chat'
        },
      },
    },
  }, async (request, reply) => {
    const {
      prompt, contents, model,
      objectImages = [], characterImages = [],
      aspectRatio, imageSize, thinkingLevel, temperature, topP, enableSearch,
      apiKey, baseUrl, historyType,
    } = request.body

    fastify.log.info({ prompt, model, aspectRatio, imageSize, thinkingLevel, temperature, topP, enableSearch, apiKey: apiKey ? '***' : undefined, baseUrl }, 'image generate params')

    // Require at least prompt or contents
    if (!prompt && (!contents || contents.length === 0)) {
      return reply.code(400).send({ success: false, error: 'prompt or contents is required' })
    }

    try {
      const result = await generateImage({
        prompt, contents, model,
        objectImages, characterImages,
        aspectRatio, imageSize, thinkingLevel, temperature, topP, enableSearch,
        apiKey, baseUrl,
      })

      // 异步保存历史（不阻塞响应）
      const userId = request.jwtPayload?.userId ?? request.jwtPayload?.sub
      if (userId && result.data) {
        const type = historyType === 'image_chat' ? 'image_chat' : 'image'
        saveImageGeneration(fastify.db, {
          userId,
          type,
          prompt: prompt || '',
          model: result.model,
          imageData: result.data,
          mimeType: result.mimeType,
          caption: result.caption,
        }).catch(err => fastify.log.warn({ err }, 'save image history failed'))
      }

      return {
        success: true,
        data: {
          mimeType: result.mimeType,
          image:    result.data,
          caption:  result.caption,
          prompt:   prompt || '',
          model:    result.model,
        },
      }
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  // ─── GET /image/history ───────────────────────────────────────────────────
  fastify.get('/history', async (request, reply) => {
    const userId = request.jwtPayload?.userId ?? request.jwtPayload?.sub
    if (!userId) return { success: true, data: [] }
    const { type } = request.query
    const rows = await getImageHistory(fastify.db, userId, type || null)
    return { success: true, data: rows }
  })

  // ─── GET /image/history/:id ────────────────────────────────────────────────
  fastify.get('/history/:id', async (request, reply) => {
    const userId = request.jwtPayload?.userId ?? request.jwtPayload?.sub
    if (!userId) return reply.code(403).send({ success: false, error: 'Unauthorized' })
    const row = await getImageGenerationById(fastify.db, request.params.id, userId)
    if (!row) return reply.code(404).send({ success: false, error: 'Not found' })
    return { success: true, data: row }
  })
}

module.exports = imageRoutes
