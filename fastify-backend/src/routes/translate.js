'use strict'

// ── Azure Speech Key Pool ────────────────────────────────────────────────────
const AZURE_KEYS = [
  { key: 'ad3e9ef234654fc095cc47729e4ec282', zonename: 'eastasia' },
]

let eastasiaIndex = 0
let fallbackIndex = 0

function getSpeechKey() {
  const eastasiaKeys = AZURE_KEYS.filter((k) => k.zonename === 'eastasia')
  const pool = eastasiaKeys.length > 0 ? eastasiaKeys : AZURE_KEYS

  if (pool.length === 0) return { key: '', region: '' }

  let index
  if (eastasiaKeys.length > 0) {
    index = eastasiaIndex % pool.length
    eastasiaIndex++
  } else {
    index = fallbackIndex % pool.length
    fallbackIndex++
  }

  const selected = pool[index]
  return { key: selected.key, region: selected.zonename }
}

// ── Gemini Config ─────────────────────────────────────────────────────────────
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || 'AIzaSyCPT9tggD7Q8Zt78pVokxvduA9MO1falSs'
const GEMINI_MODEL = 'gemini-3-flash-preview'
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1alpha/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`

async function getGeminiAnswer(text) {
  const prompt = `You are a candidate being interviewed for a Desktop Engineer role. You have deep hands-on experience with IGEL thin clients, VDI, Windows, Microsoft Teams, and AV conference room equipment. You are very familiar with the IGEL knowledge base at https://kb.igel.com/ and apply that knowledge in your answers.

The interviewer's question (note: speech-to-text may have spelling errors, e.g. "igile", "igel", "igle", "eagle" all refer to IGEL; "UMS", "ums", "yum" refer to IGEL UMS; "VDI", "V.D.I" refer to Virtual Desktop Infrastructure — interpret charitably):
"${text}"

Answer as the candidate in first person, confident and professional, drawing from IGEL KB knowledge where relevant. Format:
- English answer first (2-4 sentences, natural spoken style, reference specific IGEL concepts/features/tools like UMS, IGEL OS, profiles, firmware update, etc. where appropriate)
- Then Chinese translation below

No bullet points, no labels, no filler. Speak as if you are in the interview right now.`

  const requestBody = {
    contents: [{ parts: [{ text: prompt }] }],
    tools: [{ googleSearch: {} }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 4096,
      thinkingConfig: { thinkingBudget: 0 },
    },
  }

  const response = await fetch(GEMINI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody),
  })

  if (!response.ok) {
    const errorText = await response.text().catch(() => '')
    throw new Error(`Gemini API returned ${response.status}: ${errorText}`)
  }

  const data = await response.json()
  const parts = data?.candidates?.[0]?.content?.parts ?? []
  const answer = parts.map((p) => p.text || '').join('').trim()

  if (!answer) throw new Error('Unexpected response from Gemini API')
  return answer
}

// ── Routes ───────────────────────────────────────────────────────────────────
async function translateRoutes(fastify) {
  // GET /translate/speech-key — 需要 JWT 认证（默认保护）
  fastify.get('/speech-key', async (request, reply) => {
    return getSpeechKey()
  })

  // POST /translate/gemini — 需要 JWT 认证（默认保护）
  fastify.post('/gemini', async (request, reply) => {
    const { text } = request.body || {}
    if (!text || typeof text !== 'string' || !text.trim()) {
      return reply.code(400).send({ success: false, error: 'text is required' })
    }
    try {
      const answer = await getGeminiAnswer(text.trim())
      return { answer }
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ error: err.message })
    }
  })
}

module.exports = translateRoutes
