'use strict'

const { GoogleGenAI } = require('@google/genai')

const DEFAULT_MODEL = 'gemini-3.1-flash-image-preview'

/**
 * OpenAI-compatible endpoint (sk- keys).
 * Returns image in choices[0].message.audio.data (base64 PNG).
 */
async function generateImageOpenAI({ prompt, contents, model, apiKey, baseUrl, objectImages = [], characterImages = [] }) {
  const base = baseUrl.replace(/\/$/, '')
  const url = `${base}/v1/chat/completions`

  // Build reference image parts in OpenAI image_url format
  const refImageParts = [
    ...objectImages.slice(0, 10),
    ...characterImages.slice(0, 4),
  ].map(img => ({
    type: 'image_url',
    image_url: { url: `data:${img.mimeType};base64,${img.data}` },
  }))

  // Convert Gemini contents format → OpenAI messages format
  let messages
  if (contents && contents.length > 0) {
    messages = contents.map((turn, i) => {
      const isLastUser = turn.role === 'user' && i === contents.map(t => t.role).lastIndexOf('user')
      const textContent = turn.parts.map(p => p.text || '').join('')
      if (isLastUser && refImageParts.length > 0) {
        return {
          role: 'user',
          content: [...refImageParts, { type: 'text', text: textContent }],
        }
      }
      return { role: turn.role === 'model' ? 'assistant' : 'user', content: textContent }
    })
  } else if (refImageParts.length > 0) {
    messages = [{ role: 'user', content: [...refImageParts, { type: 'text', text: prompt }] }]
  } else {
    messages = [{ role: 'user', content: prompt }]
  }

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ model, messages }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`OpenAI API error ${res.status}: ${text.slice(0, 200)}`)
  }

  const data = await res.json()
  const msg = data?.choices?.[0]?.message

  // Image returned in audio.data field
  if (msg?.audio?.data) {
    return { mimeType: 'image/png', data: msg.audio.data, caption: null, model }
  }

  // Fallback: markdown image in content
  const text = msg?.content || ''
  const match = text.match(/!\[image\]\(data:([^;]+);base64,([^)]+)\)/)
  if (match) {
    return { mimeType: match[1], data: match[2], caption: null, model }
  }

  const errText = text.replace(/<think>[\s\S]*?<\/think>/g, '').trim()
  throw new Error(errText.slice(0, 300) || 'No image returned from OpenAI-compatible API')
}

/**
 * Generate an image via Gemini.
 *
 * Pass either:
 *   - `prompt` (string) – single-turn mode, contents will be built automatically.
 *   - `contents` (array) – multi-turn chat mode; the caller provides the full
 *     conversation history in Gemini `contents` format.  `prompt` is still
 *     used only for the response metadata when `contents` is supplied.
 */
async function generateImage({
  prompt,
  contents: contentsOverride,   // multi-turn chat history (optional)
  model,
  objectImages = [],      // 对象保真参考图，最多 10 张
  characterImages = [],   // 角色一致性参考图，最多 4 张
  aspectRatio = '',
  imageSize = '',
  thinkingLevel = 'MINIMAL',
  temperature,
  topP,
  enableSearch = false,
  apiKey: reqApiKey,    // 用户自定义 API Key（优先于环境变量）
  baseUrl: reqBaseUrl,  // 用户自定义 Base URL（优先于环境变量）
}) {
  const MODEL = model || DEFAULT_MODEL
  const apiKey = (reqApiKey && reqApiKey.trim()) || process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  const baseUrl = (reqBaseUrl && reqBaseUrl.trim()) || process.env.GEMINI_BASE_URL

  // 用户手动提供 sk- key → OpenAI-compatible proxy
  const userProvidedKey = !!(reqApiKey && reqApiKey.trim())
  if (userProvidedKey && apiKey.startsWith('sk-')) {
    if (!baseUrl) throw new Error('Base URL is required for sk- API keys')
    return generateImageOpenAI({ prompt, contents: contentsOverride, model: MODEL, apiKey, baseUrl, objectImages, characterImages })
  }

  // Google GenAI SDK path
  const ai = new GoogleGenAI({
    apiKey,
    ...(baseUrl ? { httpOptions: { baseUrl } } : {}),
  })

  const imageConfig = {
    ...(aspectRatio ? { aspectRatio } : {}),
    ...(imageSize   ? { imageSize }   : {}),
  }

  const config = {
    // thinkingBudget: 0 disables thinking — the proxy returns images only when
    // thinking is suppressed (otherwise it strips inlineData and only forwards text).
    thinkingConfig: { thinkingBudget: 0 },
    imageConfig,
    responseModalities: ['IMAGE'],
    ...(temperature !== undefined ? { temperature } : {}),
    ...(topP       !== undefined ? { topP }       : {}),
  }

  if (enableSearch) {
    config.tools = [{ googleSearch: { searchTypes: { imageSearch: {} } } }]
  }

  // Build reference image inline parts to inject into the LAST user turn.
  const refInlineParts = [
    ...objectImages.slice(0, 10).map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
    ...characterImages.slice(0, 4).map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
  ]

  let contents
  if (contentsOverride && contentsOverride.length > 0) {
    if (refInlineParts.length > 0) {
      const lastUserIdx = [...contentsOverride].map(t => t.role).lastIndexOf('user')
      contents = contentsOverride.map((turn, i) => {
        if (i === lastUserIdx && turn.role === 'user') {
          return { ...turn, parts: [...refInlineParts, ...turn.parts] }
        }
        return turn
      })
    } else {
      contents = contentsOverride
    }
  } else {
    contents = [{ role: 'user', parts: [...refInlineParts, { text: prompt }] }]
  }

  const response = await ai.models.generateContentStream({ model: MODEL, config, contents })

  let imageMimeType = null
  let imageData = null
  let textAccum = ''

  for await (const chunk of response) {
    if (!chunk.candidates || !chunk.candidates[0].content || !chunk.candidates[0].content.parts) {
      continue
    }

    const parts = chunk.candidates[0].content.parts

    for (const part of parts) {
      if (part.inlineData?.data) {
        imageMimeType = part.inlineData.mimeType || 'image/png'
        imageData = part.inlineData.data
      } else if (part.text) {
        textAccum += part.text
      }
    }
  }

  // The proxy embeds images in text as markdown: ![image](data:mimeType;base64,...)
  if (!imageData && textAccum) {
    const match = textAccum.match(/!\[image\]\(data:([^;]+);base64,([^)]+)\)/)
    if (match) {
      imageMimeType = match[1]
      imageData = match[2]
    }
  }

  if (!imageData) {
    const cleanText = textAccum
      ? textAccum.replace(/!\[image\]\([^)]+\)/g, '').replace(/\*\*(.*?)\*\*/g, '$1').replace(/\n{3,}/g, '\n\n').trim()
      : 'No image returned from Gemini'
    const errMsg = cleanText.length > 300 ? cleanText.slice(0, 300) + '…' : cleanText
    throw new Error(errMsg || 'No image returned from Gemini')
  }

  return {
    mimeType: imageMimeType || 'image/png',
    data: imageData,
    caption: null,
    model: MODEL,
  }
}

module.exports = { generateImage }
