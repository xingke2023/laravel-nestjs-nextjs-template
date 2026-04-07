'use strict'

const { GoogleGenAI } = require('@google/genai')

const DEFAULT_MODEL = 'gemini-3.1-flash-image-preview'

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
}) {
  const MODEL = model || DEFAULT_MODEL
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error('GEMINI_API_KEY is not configured')

  const baseUrl = process.env.GEMINI_BASE_URL
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
  // They are always injected into the last user turn (the current request),
  // not the first, so that multi-turn requests stay small and ref images
  // are always visible to the model for the current generation step.
  const refInlineParts = [
    ...objectImages.slice(0, 10).map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
    ...characterImages.slice(0, 4).map(img => ({ inlineData: { mimeType: img.mimeType, data: img.data } })),
  ]

  // Build contents: use caller-supplied history or single-turn from prompt.
  // Inject reference images into the LAST user turn's parts.
  let contents
  if (contentsOverride && contentsOverride.length > 0) {
    if (refInlineParts.length > 0) {
      // Find the last user turn and prepend ref images to its parts
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
    // Skip chunks that have no candidates/content/parts
    if (!chunk.candidates || !chunk.candidates[0].content || !chunk.candidates[0].content.parts) {
      continue
    }

    const parts = chunk.candidates[0].content.parts

    for (const part of parts) {
      if (part.inlineData?.data) {
        // Direct inlineData (standard Gemini response)
        imageMimeType = part.inlineData.mimeType || 'image/png'
        imageData = part.inlineData.data
      } else if (part.text) {
        textAccum += part.text
      }
    }
  }

  // The proxy embeds images in text as markdown: ![image](data:mimeType;base64,...)
  // when thinkingBudget=0 and inlineData is not returned directly.
  if (!imageData && textAccum) {
    const match = textAccum.match(/!\[image\]\(data:([^;]+);base64,([^)]+)\)/)
    if (match) {
      imageMimeType = match[1]
      imageData = match[2]
    }
  }

  if (!imageData) {
    // No image found — clean up any text/thinking for error message
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
