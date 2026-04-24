'use strict'

const crypto = require('crypto')

const TOKEN          = 'sdf98uaisfjasdlfz'
const ENCODING_AES_KEY = 'o3egMwfOnkiPrakvvvHiBhwNo08wE1MhwNllob6ps9M'
const APPID          = 'wx70b0d6fb6fd92863'

// AES key: base64decode(EncodingAESKey + "=") → 32 bytes
const AES_KEY = Buffer.from(ENCODING_AES_KEY + '=', 'base64')
const AES_IV  = AES_KEY.slice(0, 16)

// ── PKCS7 ──────────────────────────────────────────────────
function pkcs7Pad(buf, blockSize = 32) {
  const pad = blockSize - (buf.length % blockSize)
  return Buffer.concat([buf, Buffer.alloc(pad, pad)])
}

function pkcs7Unpad(buf) {
  const pad = buf[buf.length - 1]
  return buf.slice(0, buf.length - pad)
}

// ── 签名验证 ────────────────────────────────────────────────
function sign(...args) {
  return crypto.createHash('sha1').update(args.sort().join('')).digest('hex')
}

function verifySignature(timestamp, nonce, signature) {
  return sign(TOKEN, timestamp, nonce) === signature
}

function verifyMsgSignature(timestamp, nonce, encryptMsg, msgSignature) {
  return sign(TOKEN, timestamp, nonce, encryptMsg) === msgSignature
}

// ── 解密 ────────────────────────────────────────────────────
function decrypt(encryptBase64) {
  const decipher = crypto.createDecipheriv('aes-256-cbc', AES_KEY, AES_IV)
  decipher.setAutoPadding(false)
  const buf = Buffer.concat([decipher.update(Buffer.from(encryptBase64, 'base64')), decipher.final()])
  const unpadded = pkcs7Unpad(buf)
  // 跳过前 16 字节随机数，读 4 字节消息长度
  const msgLen = unpadded.readUInt32BE(16)
  const msgXml = unpadded.slice(20, 20 + msgLen).toString('utf8')
  return msgXml
}

// ── 加密 ────────────────────────────────────────────────────
function encrypt(replyXml) {
  const random   = crypto.randomBytes(16)
  const msgBuf   = Buffer.from(replyXml, 'utf8')
  const lenBuf   = Buffer.alloc(4)
  lenBuf.writeUInt32BE(msgBuf.length, 0)
  const appidBuf = Buffer.from(APPID, 'utf8')
  const plain    = pkcs7Pad(Buffer.concat([random, lenBuf, msgBuf, appidBuf]))
  const cipher   = crypto.createCipheriv('aes-256-cbc', AES_KEY, AES_IV)
  cipher.setAutoPadding(false)
  return Buffer.concat([cipher.update(plain), cipher.final()]).toString('base64')
}

// ── 构造加密回复 XML ─────────────────────────────────────────
function buildEncryptedReply(replyXml, timestamp, nonce) {
  const encryptMsg = encrypt(replyXml)
  const msgSig     = sign(TOKEN, timestamp, nonce, encryptMsg)
  return `<xml>
<Encrypt><![CDATA[${encryptMsg}]]></Encrypt>
<MsgSignature><![CDATA[${msgSig}]]></MsgSignature>
<TimeStamp>${timestamp}</TimeStamp>
<Nonce><![CDATA[${nonce}]]></Nonce>
</xml>`
}

module.exports = { verifySignature, verifyMsgSignature, decrypt, buildEncryptedReply, APPID }
