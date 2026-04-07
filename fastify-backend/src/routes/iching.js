'use strict'

const { predict } = require('../iching/service')

async function ichingRoutes(fastify) {
  // POST /iching/predict  - 传入生辰八字推算命卦
  fastify.post('/predict', {
    schema: {
      body: {
        type: 'object',
        required: ['year', 'month', 'day'],
        properties: {
          year:  { type: 'integer', minimum: 1900, maximum: 2100, description: '出生年份，如 1990' },
          month: { type: 'integer', minimum: 1,    maximum: 12,   description: '出生月份，1-12' },
          day:   { type: 'integer', minimum: 1,    maximum: 31,   description: '出生日期，1-31' },
          hour:  { type: 'integer', minimum: 0,    maximum: 23,   description: '出生小时（24小时制），默认 0', default: 0 },
        },
      },
    },
  }, async (request) => {
    const { year, month, day, hour = 0 } = request.body
    const result = predict(year, month, day, hour)
    return { success: true, data: result }
  })

  // GET /iching/predict?year=&month=&day=&hour=  - 查询字符串方式
  fastify.get('/predict', {
    schema: {
      querystring: {
        type: 'object',
        required: ['year', 'month', 'day'],
        properties: {
          year:  { type: 'integer', minimum: 1900, maximum: 2100 },
          month: { type: 'integer', minimum: 1,    maximum: 12 },
          day:   { type: 'integer', minimum: 1,    maximum: 31 },
          hour:  { type: 'integer', minimum: 0,    maximum: 23, default: 0 },
        },
      },
    },
  }, async (request) => {
    const { year, month, day, hour = 0 } = request.query
    const result = predict(year, month, day, hour)
    return { success: true, data: result }
  })

  // GET /iching/trigrams  - 返回八卦说明
  fastify.get('/trigrams', async () => {
    const { TRIGRAMS } = require('../iching/data')
    return { success: true, data: TRIGRAMS }
  })

  // GET /iching/hexagrams/:id  - 查询指定卦象
  fastify.get('/hexagrams/:id', {
    schema: {
      params: {
        type: 'object',
        properties: {
          id: { type: 'integer', minimum: 1, maximum: 64 },
        },
      },
    },
  }, async (request, reply) => {
    const { HEXAGRAMS, TRIGRAMS } = require('../iching/data')
    const id = parseInt(request.params.id)
    const hex = HEXAGRAMS[id]
    if (!hex) {
      return reply.code(404).send({ success: false, message: '卦象不存在，id 范围 1-64' })
    }
    return {
      success: true,
      data: {
        ...hex,
        symbol: String.fromCodePoint(0x4DC0 + id - 1),
        upperTrigram: TRIGRAMS[hex.upper],
        lowerTrigram: TRIGRAMS[hex.lower],
      },
    }
  })
}

module.exports = ichingRoutes
