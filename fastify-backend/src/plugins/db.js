'use strict'

const mysql = require('mysql2/promise')
const fp = require('fastify-plugin')

async function dbPlugin(fastify) {
  const pool = mysql.createPool({
    host:     process.env.DB_HOST     || '127.0.0.1',
    port:     process.env.DB_PORT     || 3306,
    database: process.env.DB_DATABASE || 'backend',
    user:     process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    waitForConnections: true,
    connectionLimit: 10,
  })

  // 验证连接
  const conn = await pool.getConnection()
  fastify.log.info('MySQL connected')
  conn.release()

  fastify.decorate('db', pool)

  fastify.addHook('onClose', async () => {
    await pool.end()
  })
}

module.exports = fp(dbPlugin)
