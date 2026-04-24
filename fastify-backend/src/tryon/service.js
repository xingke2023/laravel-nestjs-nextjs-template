'use strict'

const { GoogleGenAI } = require('@google/genai')

const TRYON_PROMPT = `你是一个专业的虚拟试穿助手。
图片1是一个人物，图片2是一件衣服。
请将图片2的衣服穿在图片1的人物身上，生成一张真实自然的试穿效果图。
保持人物的脸部、发型、体型不变，只替换衣服部分，确保效果真实自然。`

async function tryonOpenAI({ humanImageBase64, humanMimeType, clothImageBase64, clothMimeType, apiKey, baseUrl }) {
  const base = baseUrl.replace(/\/$/, '')
  const url = `${base}/v1/chat/completions`

  const messages = [{
    role: 'user',
    content: [
      { type: 'image_url', image_url: { url: `data:${humanMimeType};base64,${humanImageBase64}` } },
      { type: 'image_url', image_url: { url: `data:${clothMimeType};base64,${clothImageBase64}` } },
      { type: 'text', text: TRYON_PROMPT },
    ],
  }]

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model: 'gemini-3.1-flash-image-preview', messages }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API 错误 ${res.status}: ${text.slice(0, 300)}`)
  }

  const data = await res.json()
  const msg = data?.choices?.[0]?.message

  if (msg?.audio?.data) {
    return { mimeType: 'image/png', data: msg.audio.data }
  }

  const text = msg?.content || ''
  const match = text.match(/!\[image\]\(data:([^;]+);base64,([^)]+)\)/)
  if (match) {
    return { mimeType: match[1], data: match[2] }
  }

  const errText = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  throw new Error(errText.slice(0, 300) || '未返回图片')
}

async function tryon({ humanImageBase64, humanMimeType, clothImageBase64, clothMimeType, apiKey: reqApiKey, baseUrl: reqBaseUrl }) {
  const apiKey = (reqApiKey && reqApiKey.trim()) || process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY 未配置')

  const baseUrl = (reqBaseUrl && reqBaseUrl.trim()) || process.env.GEMINI_BASE_URL

  // sk- key → OpenAI 兼容路径
  if (apiKey.startsWith('sk-')) {
    if (!baseUrl) throw new Error('sk- 类型 key 需要提供 base_url')
    return tryonOpenAI({ humanImageBase64, humanMimeType, clothImageBase64, clothMimeType, apiKey, baseUrl })
  }

  // Google GenAI SDK 路径
  const ai = new GoogleGenAI({
    apiKey,
    ...(baseUrl ? { httpOptions: { baseUrl } } : {}),
  })

  const contents = [{
    role: 'user',
    parts: [
      { inlineData: { mimeType: humanMimeType, data: humanImageBase64 } },
      { inlineData: { mimeType: clothMimeType,  data: clothImageBase64  } },
      { text: TRYON_PROMPT },
    ],
  }]

  const response = await ai.models.generateContentStream({
    model: 'gemini-3.1-flash-image-preview',
    config: { thinkingConfig: { thinkingBudget: 0 }, responseModalities: ['IMAGE'] },
    contents,
  })

  let imageMimeType = null
  let imageData = null
  let textAccum = ''

  for await (const chunk of response) {
    const parts = chunk.candidates?.[0]?.content?.parts ?? []
    for (const part of parts) {
      if (part.inlineData?.data) {
        imageMimeType = part.inlineData.mimeType || 'image/png'
        imageData = part.inlineData.data
      } else if (part.text) {
        textAccum += part.text
      }
    }
  }

  if (!imageData && textAccum) {
    const match = textAccum.match(/!\[image\]\(data:([^;]+);base64,([^)]+)\)/)
    if (match) { imageMimeType = match[1]; imageData = match[2] }
  }

  if (!imageData) {
    const errMsg = textAccum.replace(/!\[image\]\([^)]+\)/g, '').trim()
    throw new Error(errMsg.slice(0, 300) || '试穿生成失败，未返回图片')
  }

  return { mimeType: imageMimeType || 'image/png', data: imageData }
}

module.exports = { tryon }
