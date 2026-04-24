'use strict'

const { parseStringPromise } = require('xml2js')
const { verifySignature, verifyMsgSignature, decrypt, buildEncryptedReply } = require('../wechat/crypto')
const { askDeepSeek } = require('../wechat/deepseek')

function buildTextReply(toUser, fromUser, content) {
  const now = Math.floor(Date.now() / 1000)
  return `<xml>
<ToUserName><![CDATA[${toUser}]]></ToUserName>
<FromUserName><![CDATA[${fromUser}]]></FromUserName>
<CreateTime>${now}</CreateTime>
<MsgType><![CDATA[text]]></MsgType>
<Content><![CDATA[${content}]]></Content>
</xml>`
}

async function saveMessage(db, { openid, msgType, content, event, msgId, rawXml, reply }) {
  try {
    await db.execute(
      'INSERT INTO wx_messages (openid, msg_type, content, event, msg_id, raw_xml, reply, created_at, updated_at) VALUES (?,?,?,?,?,?,?,NOW(),NOW())',
      [openid, msgType, content || null, event || null, msgId || null, rawXml, reply || null]
    )
  } catch (err) {
    // 存储失败不影响主流程
  }
}

async function wxresponseRoutes(fastify) {

  // GET /wxresponse — 微信服务器验证
  fastify.get('/', async (request, reply) => {
    const { signature, timestamp, nonce, echostr } = request.query
    if (!signature || !timestamp || !nonce) return reply.code(400).send('Bad Request')
    if (verifySignature(timestamp, nonce, signature)) return reply.send(echostr)
    return reply.code(403).send('Forbidden')
  })

  // GET /wxresponse/messages — 查看历史消息
  fastify.get('/messages', async (request, reply) => {
    const limit  = Math.min(parseInt(request.query.limit  || 50), 200)
    const offset = parseInt(request.query.offset || 0)
    const openid = request.query.openid || null

    let sql = `SELECT id, openid, msg_type, content, event, reply, created_at FROM wx_messages`
    const params = []
    if (openid) { sql += ' WHERE openid = ?'; params.push(openid) }
    sql += ` ORDER BY id DESC LIMIT ${limit} OFFSET ${offset}`

    const [rows] = await fastify.db.execute(sql, params)
    const [[{ total }]] = await fastify.db.execute(
      openid ? 'SELECT COUNT(*) as total FROM wx_messages WHERE openid = ?' : 'SELECT COUNT(*) as total FROM wx_messages',
      openid ? [openid] : []
    )
    return { success: true, data: { total, rows } }
  })

  // POST /wxresponse — 接收并回复消息（安全模式）
  fastify.post('/', async (request, reply) => {
    const { timestamp, nonce, msg_signature, openid } = request.query

    const rawXml = request.body
    if (!rawXml) return reply.code(400).send('empty body')

    let parsed
    try {
      parsed = await parseStringPromise(rawXml, { explicitArray: false })
    } catch {
      return reply.code(400).send('invalid xml')
    }

    const encryptMsg = parsed?.xml?.Encrypt
    if (!encryptMsg) return reply.code(400).send('missing Encrypt')

    if (!verifyMsgSignature(timestamp, nonce, encryptMsg, msg_signature)) {
      return reply.code(403).send('signature mismatch')
    }

    let msgXml
    try {
      msgXml = decrypt(encryptMsg)
    } catch (err) {
      fastify.log.error('wechat decrypt error:', err.message)
      return reply.code(500).send('decrypt failed')
    }

    let msg
    try {
      const msgParsed = await parseStringPromise(msgXml, { explicitArray: false })
      msg = msgParsed?.xml || {}
    } catch {
      return reply.code(400).send('invalid decrypted xml')
    }

    const toUser   = msg.ToUserName   || ''
    const fromUser = msg.FromUserName || openid || ''
    const msgType  = (msg.MsgType || '').toLowerCase()
    const content  = msg.Content || ''
    const event    = (msg.Event  || '').toLowerCase()
    const msgId    = msg.MsgId   || ''

    fastify.log.info({ openid: fromUser, msgType, content, event }, 'wx message received')

    // ── 消息处理逻辑 ──────────────────────────────────────────
    let replyContent = null

    if (msgType === 'text') {
      try {
        replyContent = await askDeepSeek(content)
      } catch (err) {
        fastify.log.error('deepseek error:', err.message)
        replyContent = '抱歉，AI 暂时不可用，请稍后再试。'
      }
    } else if (msgType === 'event') {
      if (event === 'subscribe') replyContent = '感谢关注！有什么可以帮助你的吗？'
    }

    // 异步存储消息
    saveMessage(fastify.db, { openid: fromUser, msgType, content, event, msgId, rawXml: msgXml, reply: replyContent })

    if (!replyContent) {
      reply.header('Content-Type', 'text/plain')
      return reply.send('')
    }

    const ts        = String(Math.floor(Date.now() / 1000))
    const nonceOut  = Math.random().toString(36).slice(2, 10)
    const replyXml  = buildTextReply(fromUser, toUser, replyContent)
    const encrypted = buildEncryptedReply(replyXml, ts, nonceOut)

    reply.header('Content-Type', 'application/xml; charset=utf-8')
    return reply.send(encrypted)
  })
}

module.exports = wxresponseRoutes
