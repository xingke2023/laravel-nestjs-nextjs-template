'use strict'

require('dotenv').config()

const fastify = require('fastify')
const jwtPlugin = require('./plugins/jwt')
const ichingRoutes = require('./routes/iching')
const imageRoutes = require('./routes/image')
const scenicRoutes = require('./routes/scenic')

function buildApp(opts = {}) {
  const app = fastify({ logger: true, bodyLimit: 30 * 1024 * 1024, ...opts })

  app.register(jwtPlugin)

  app.get('/', async (request, reply) => {
    return { message: 'Fastify backend is running' }
  })

  app.get('/health', async (request, reply) => {
    return { status: 'ok' }
  })

  app.register(ichingRoutes, { prefix: '/iching' })
  app.register(imageRoutes, { prefix: '/image' })
  app.register(scenicRoutes, { prefix: '/scenic' })

  return app
}

module.exports = buildApp
