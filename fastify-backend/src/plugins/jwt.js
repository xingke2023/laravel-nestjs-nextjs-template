'use strict'

const fp = require('fastify-plugin')
const fastifyJwt = require('@fastify/jwt')

// 白名单路由（无需 token）
// 格式：'METHOD:路径'，路径支持前缀匹配（以 * 结尾）
const PUBLIC_ROUTES = new Set([
  'GET:/',
  'GET:/health',
  'GET:/iching/predict',
  'POST:/iching/predict',
  'GET:/iching/trigrams',
  'GET:/iching/hexagrams/*',
  'POST:/image/generate',
  'GET:/scenic/spots',
  'GET:/scenic/sub-spots',
  'POST:/video/generate',
  'GET:/video/task/*',
  'POST:/video/webhook',
  'GET:/video/webhook/status',
  'POST:/upload',
  'GET:/image/history',
  'GET:/image/history/*',
  'GET:/video/history',
  'GET:/clothing/items',
  'POST:/clothing/upload',
  'DELETE:/clothing/items/*',
  'POST:/tryon',
  'GET:/wxresponse',
  'POST:/wxresponse',
  'GET:/wxresponse/messages',
])

function isPublic(method, url) {
  // 去掉 query string
  const path = url.split('?')[0]
  const exact = `${method}:${path}`
  if (PUBLIC_ROUTES.has(exact)) return true
  // 前缀通配符匹配
  for (const rule of PUBLIC_ROUTES) {
    if (rule.endsWith('*')) {
      const prefix = rule.slice(0, -1)
      if (exact.startsWith(prefix.slice(0, prefix.lastIndexOf('/') + 1))) return true
    }
  }
  return false
}

async function jwtPlugin(fastify) {
  fastify.register(fastifyJwt, {
    secret: process.env.JWT_SECRET,
  })

  // 全局 preHandler hook：非白名单路由一律验证 JWT
  fastify.addHook('preHandler', async (request, reply) => {
    if (isPublic(request.method, request.url)) {
      // 公开路由：有 token 则软解析（不强制），用于记录用户信息
      const auth = request.headers['authorization']
      if (auth?.startsWith('Bearer ')) {
        try {
          request.jwtPayload = await request.jwtVerify()
        } catch {}
      }
      return
    }

    const auth = request.headers['authorization']
    if (!auth?.startsWith('Bearer ')) {
      return reply.code(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Missing Authorization header' })
    }

    try {
      const payload = await request.jwtVerify()
      request.jwtPayload = payload   // sub = SSO user ID
    } catch {
      return reply.code(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid or expired token' })
    }
  })
}

module.exports = fp(jwtPlugin)
