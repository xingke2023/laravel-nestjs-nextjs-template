'use strict'

const { collectAllSpots, collectSubSpots } = require('../scenic/service')

async function scenicRoutes(fastify) {
  /**
   * GET /scenic/spots?region=成都
   * 搜集指定地区所有景区清单
   */
  fastify.get('/spots', {
    schema: {
      querystring: {
        type: 'object',
        required: ['region'],
        properties: {
          region: { type: 'string', minLength: 1, description: '地区名称，如"成都"、"包头市"' },
        },
      },
    },
  }, async (request, reply) => {
    const { region } = request.query

    const spots = await collectAllSpots(region)
    return {
      success: true,
      region,
      total: spots.length,
      data: spots.map(s => {
        const info = s.detail_info || {}
        return {
          uid: s.uid,
          name: s.name,
          address: s.address || null,
          telephone: s.telephone || null,
          location: s.location || null,
          overall_rating: info.overall_rating || null,
          tag: info.tag || null,
          description: info.description || null,
        }
      }),
    }
  })

  /**
   * GET /scenic/sub-spots?name=五当召风景区&region=包头市&radius=5000
   * 搜集某景区周边的子景点
   */
  fastify.get('/sub-spots', {
    schema: {
      querystring: {
        type: 'object',
        required: ['name', 'region'],
        properties: {
          name:     { type: 'string', minLength: 1, description: '主景区名称' },
          region:   { type: 'string', minLength: 1, description: '所在地区' },
          radius:   { type: 'integer', minimum: 100, maximum: 50000, default: 5000, description: '搜索半径（米），默认 5000' },
          keywords: { type: 'string', description: '自定义关键词，逗号分隔，默认：景点,寺庙,佛殿,参观,景区' },
        },
      },
    },
  }, async (request, reply) => {
    const { name, region, radius = 5000, keywords } = request.query

    const keywordList = keywords
      ? keywords.split(',').map(k => k.trim()).filter(Boolean)
      : ['景点', '寺庙', '佛殿', '参观', '景区']

    const result = await collectSubSpots(name, region, radius, keywordList)
    return {
      success: true,
      name,
      region,
      radius,
      main: result.main,
      total: result.subSpots.length,
      subSpots: result.subSpots,
    }
  })
}

module.exports = scenicRoutes
