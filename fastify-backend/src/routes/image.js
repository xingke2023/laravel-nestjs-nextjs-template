'use strict'

const { generateImage } = require('../image/service')

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
        },
      },
    },
  }, async (request, reply) => {
    const {
      prompt, contents, model,
      objectImages = [], characterImages = [],
      aspectRatio, imageSize, thinkingLevel, temperature, topP, enableSearch,
    } = request.body

    // Require at least prompt or contents
    if (!prompt && (!contents || contents.length === 0)) {
      return reply.code(400).send({ success: false, error: 'prompt or contents is required' })
    }

    try {
      const result = await generateImage({
        prompt, contents, model,
        objectImages, characterImages,
        aspectRatio, imageSize, thinkingLevel, temperature, topP, enableSearch,
      })
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
}

module.exports = imageRoutes
