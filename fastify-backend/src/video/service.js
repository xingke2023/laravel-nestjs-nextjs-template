'use strict'

const fs = require('fs')
const os = require('os')
const path = require('path')

const ARK_BASE_URL = 'https://ark.cn-beijing.volces.com/api/v3'
const DEFAULT_MODEL = 'doubao-seedance-2-0-260128'

function buildMediaUrl(item) {
  if (item.url) return item.url
  if (item.data && item.mimeType) return `data:${item.mimeType};base64,${item.data}`
  return null
}

async function arkFetch(urlPath, options = {}, overrides = {}) {
  const apiKey  = overrides.apiKey || process.env.ARK_API_KEY
  if (!apiKey) throw new Error('请填写接口配置中的 API Key')
  // HTTP headers only allow ASCII characters (0–255); reject keys with non-ASCII chars early
  if (/[^\x00-\xFF]/.test(apiKey)) {
    throw new Error('API Key 包含非法字符（如中文），请检查并重新输入正确的 API Key')
  }

  // If a full URL is provided (overrides.fullUrl), use it directly; otherwise compose from baseUrl + path
  const url = overrides.fullUrl
    ? overrides.fullUrl
    : `${(overrides.baseUrl || ARK_BASE_URL).replace(/\/$/, '')}${urlPath}`

  // Save complete request to temp file for debugging
  const tmpFile = path.join(os.tmpdir(), `video_request_${Date.now()}.json`)
  fs.writeFileSync(tmpFile, JSON.stringify({
    url,
    method: options.method || 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
    body: options.body ? JSON.parse(options.body) : undefined,
  }, null, 2))
  console.log(`[video] request saved to ${tmpFile}`)

  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
      ...(options.headers || {}),
    },
  })

  const json = await res.json().catch(() => ({ message: res.statusText }))
  if (!res.ok) {
    throw new Error(json.error?.message || json.message || `Ark API error ${res.status}`)
  }
  return json
}

/**
 * Submit a video generation task to Volcengine Ark (Seedance 2.0).
 *
 * @param {object} opts
 * @param {string}   opts.prompt        - Required text description
 * @param {Array}    opts.images        - Reference images [{url} or {data, mimeType}]
 * @param {Array}    opts.videos        - Reference videos [{url} or {data, mimeType}]
 * @param {Array}    opts.audios        - Reference audios [{url} or {data, mimeType}]
 * @param {string}  [opts.model]        - Model ID (default: doubao-seedance-2-0-260128)
 * @param {string}  [opts.ratio]        - Output ratio, e.g. '16:9'
 * @param {number}  [opts.duration]     - Duration in seconds
 * @param {boolean} [opts.generateAudio]- Whether to generate audio
 * @param {boolean} [opts.watermark]    - Whether to add watermark
 * @param {string}  [opts.resolution]   - Output resolution: '480p' | '720p'
 * @param {boolean} [opts.webSearch]    - Whether to enable web search tool
 * @param {string}  [opts.callbackUrl]  - Webhook URL for task status notifications
 */
async function createVideoTask({
  prompt,
  images = [],
  videos = [],
  audios = [],
  model,
  resolution = '720p',
  ratio = '16:9',
  duration = 8,
  generateAudio = true,
  watermark = false,
  webSearch = false,
  callbackUrl,
  apiKey,
  apiUrl,
}) {
  const content = []

  if (prompt) {
    content.push({ type: 'text', text: prompt })
  }

  for (const img of images) {
    const url = buildMediaUrl(img)
    if (url) content.push({ type: 'image_url', image_url: { url }, role: 'reference_image' })
  }

  for (const vid of videos) {
    const url = buildMediaUrl(vid)
    if (url) content.push({ type: 'video_url', video_url: { url }, role: 'reference_video' })
  }

  for (const aud of audios) {
    const url = buildMediaUrl(aud)
    if (url) content.push({ type: 'audio_url', audio_url: { url }, role: 'reference_audio' })
  }

  const body = {
    model: model || DEFAULT_MODEL,
    content,
    generate_audio: generateAudio,
    resolution,
    ratio,
    duration,
    watermark,
  }
  if (webSearch) body.tools = [{ type: 'web_search' }]
  if (callbackUrl) body.callback_url = callbackUrl

  return arkFetch('/contents/generations/tasks', {
    method: 'POST',
    body: JSON.stringify(body),
  }, apiUrl ? { apiKey, fullUrl: apiUrl } : { apiKey })
}

/**
 * Poll the status of an existing video generation task.
 * @param {string} taskId
 * @param {object} [overrides]  - { apiKey, apiUrl } for third-party providers
 */
async function getVideoTask(taskId, overrides = {}) {
  const { apiKey, apiUrl } = overrides
  // Third-party: poll URL = apiUrl + '/' + taskId (full URL, passed directly)
  if (apiUrl) {
    return arkFetch('', {}, { apiKey, fullUrl: `${apiUrl.replace(/\/$/, '')}/${taskId}` })
  }
  return arkFetch(`/contents/generations/tasks/${taskId}`, {}, apiKey ? { apiKey } : {})
}

module.exports = { createVideoTask, getVideoTask }
