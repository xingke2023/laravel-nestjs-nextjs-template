'use strict'

require('dotenv').config()

const fastify   = require('fastify')
const multipart = require('@fastify/multipart')
const jwtPlugin = require('./plugins/jwt')
const dbPlugin  = require('./plugins/db')
const ichingRoutes     = require('./routes/iching')
const imageRoutes      = require('./routes/image')
const scenicRoutes     = require('./routes/scenic')
const videoRoutes      = require('./routes/video')
const uploadRoutes     = require('./routes/upload')
const translateRoutes  = require('./routes/translate')
const clothingRoutes   = require('./routes/clothing')
const tryonRoutes        = require('./routes/tryon')
const wxresponseRoutes   = require('./routes/wxresponse')

function buildApp(opts = {}) {
  const app = fastify({ logger: true, bodyLimit: 30 * 1024 * 1024, ...opts })

  app.register(multipart)
  app.register(dbPlugin)
  app.register(jwtPlugin)

  // 让微信推送的 application/xml 和 text/xml body 以原始字符串读入
  app.addContentTypeParser(['application/xml', 'text/xml'], { parseAs: 'string' }, (_req, body, done) => done(null, body))

  app.get('/', async (request, reply) => {
    return { message: 'Fastify backend is running' }
  })

  app.get('/health', async (request, reply) => {
    return { status: 'ok' }
  })

  app.register(ichingRoutes,  { prefix: '/iching' })
  app.register(imageRoutes,   { prefix: '/image' })
  app.register(scenicRoutes,  { prefix: '/scenic' })
  app.register(videoRoutes,   { prefix: '/video' })
  app.register(uploadRoutes,     { prefix: '/upload' })
  app.register(translateRoutes,  { prefix: '/translate' })
  app.register(clothingRoutes,   { prefix: '/clothing' })
  app.register(tryonRoutes,        { prefix: '/tryon' })
  app.register(wxresponseRoutes,   { prefix: '/wxresponse' })

  return app
}

module.exports = buildApp
