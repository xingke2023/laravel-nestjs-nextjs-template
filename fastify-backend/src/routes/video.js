'use strict'

const { createVideoTask, getVideoTask } = require('../video/service')
const store = require('../video/store')
const { saveVideoGeneration, updateVideoGeneration, getVideoHistory } = require('../history/service')
const { setProvider, getProvider } = store

const mediaItemSchema = {
  type: 'object',
  properties: {
    url:      { type: 'string' },
    data:     { type: 'string' },
    mimeType: { type: 'string' },
  },
}

const FIDELITYAI_PATH = '/v1/video/generations'

/** Normalise user-supplied apiUrl: append default path if only a base URL is given. */
function normaliseApiUrl(url) {
  if (!url) return url
  const u = url.replace(/\/$/, '')
  return u.endsWith(FIDELITYAI_PATH) ? u : `${u}${FIDELITYAI_PATH}`
}

/** Build the auto webhook URL from env, or return null if not configured. */
function autoCallbackUrl() {
  const base = (process.env.WEBHOOK_BASE_URL || '').replace(/\/$/, '')
  return base ? `${base}/video/webhook` : null
}

/** Extract video URL from the task result content field. */
function extractVideoUrl(content) {
  if (!content) return null
  if (typeof content.video_url === 'string') return content.video_url
  if (Array.isArray(content)) {
    const item = content.find(c => c.type === 'video_url')
    return item?.video_url?.url || null
  }
  return null
}

/** Normalise a raw Ark task object into the response shape we expose. */
function normaliseTask(result) {
  return {
    taskId:          result.id,
    status:          result.status,
    videoUrl:        extractVideoUrl(result.content),
    error:           result.error?.message || null,
    resolution:      result.resolution   || null,
    duration:        result.duration     || null,
    ratio:           result.ratio        || null,
    seed:            result.seed         ?? null,
    fps:             result.framespersecond || null,
    webSearchCount:  result.usage?.tool_usage?.web_search ?? null,
    usage:           result.usage        || null,
    webhookReceived: false,
  }
}

const THIRD_PARTY_STATUS = {
  SUCCESS:     'succeeded',
  FAILURE:     'failed',
  IN_PROGRESS: 'running',
  QUEUED:      'queued',
}

/** Normalise a third-party (fidelityai) poll response. */
function normaliseThirdPartyTask(taskId, raw) {
  const data = raw.data || {}
  return {
    taskId,
    status:   THIRD_PARTY_STATUS[data.status] || 'unknown',
    videoUrl: data.result_url || null,
    error:    data.fail_reason || null,
    progress: data.progress   || null,
    webhookReceived: false,
  }
}

async function videoRoutes(fastify) {

  // ─── POST /video/generate ──────────────────────────────────────────────────
  fastify.post('/generate', {
    schema: {
      body: {
        type: 'object',
        required: ['prompt'],
        properties: {
          prompt:        { type: 'string', minLength: 1, maxLength: 5000 },
          images:        { type: 'array', items: mediaItemSchema, maxItems: 8 },
          videos:        { type: 'array', items: mediaItemSchema, maxItems: 4 },
          audios:        { type: 'array', items: mediaItemSchema, maxItems: 4 },
          model:         { type: 'string' },
          resolution:    { type: 'string', enum: ['480p', '720p'] },
          ratio:         { type: 'string' },
          duration:      { type: 'number', minimum: 4, maximum: 15 },
          generateAudio: { type: 'boolean' },
          watermark:     { type: 'boolean' },
          webSearch:     { type: 'boolean' },
          apiKey:        { type: 'string' },
          apiUrl:        { type: 'string' },
        },
      },
    },
  }, async (request, reply) => {
    const {
      prompt, images = [], videos = [], audios = [],
      model, resolution, ratio, duration,
      generateAudio, watermark, webSearch,
      apiKey, apiUrl,
    } = request.body

    const normalisedApiUrl = normaliseApiUrl(apiUrl)
    // Third-party providers don't support Ark-style callback_url; only inject for official Ark
    const callbackUrl = normalisedApiUrl ? null : autoCallbackUrl()

    try {
      const result = await createVideoTask({
        prompt, images, videos, audios,
        model, resolution, ratio, duration,
        generateAudio, watermark, webSearch,
        callbackUrl,
        apiKey: apiKey || undefined,
        apiUrl: normalisedApiUrl || undefined,
      })
      fastify.log.info({ result }, '[video/generate] raw provider response')
      const taskId = result.id ?? result.task_id ?? result.data?.id ?? result.data?.task_id
      if (apiKey || normalisedApiUrl) setProvider(taskId, { apiKey, apiUrl: normalisedApiUrl })
      // fidelityai wraps status in data.status; official Ark returns status at top level
      const rawStatus = result.status ?? result.data?.status
      const status = normalisedApiUrl
        ? (THIRD_PARTY_STATUS[rawStatus] || 'queued')
        : rawStatus

      // 异步保存历史
      const userId = request.jwtPayload?.userId ?? request.jwtPayload?.sub
      if (userId && taskId) {
        saveVideoGeneration(fastify.db, {
          userId,
          taskId,
          prompt,
          model: model || null,
          status,
          resolution: resolution || null,
          duration: duration || null,
          ratio: ratio || null,
        }).catch(err => fastify.log.warn({ err }, 'save video history failed'))
      }

      return {
        success: true,
        data: {
          taskId,
          status,
          callbackUrl: callbackUrl || null,
        },
      }
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  // ─── GET /video/task/:taskId ───────────────────────────────────────────────
  // Terminal states (succeeded / failed / expired / cancelled) are served from
  // the webhook store.  Non-terminal states always hit the Ark API so that a
  // missed webhook push never gets the frontend permanently stuck.
  const TERMINAL = new Set(['succeeded', 'failed', 'expired', 'cancelled'])

  fastify.get('/task/:taskId', async (request, reply) => {
    const { taskId } = request.params

    // 1. Return from store only when the cached state is terminal
    const cached = store.get(taskId)
    const provider = getProvider(taskId)
    if (cached && TERMINAL.has(cached.status)) {
      const data = provider.apiUrl
        ? normaliseThirdPartyTask(taskId, cached)
        : normaliseTask(cached)
      // Sync terminal state to DB (idempotent)
      updateVideoGeneration(fastify.db, taskId, { status: data.status, videoUrl: data.videoUrl })
        .catch(err => fastify.log.warn({ err }, 'sync terminal status to db failed'))
      return { success: true, data: { ...data, webhookReceived: true } }
    }

    // 2. Always call API for non-terminal (or missing) state
    try {
      const result = await getVideoTask(taskId, provider)
      store.set(taskId, result)
      const data = provider.apiUrl
        ? normaliseThirdPartyTask(taskId, result)
        : normaliseTask(result)
      // Sync to DB whenever status changes to a terminal state
      if (TERMINAL.has(data.status)) {
        updateVideoGeneration(fastify.db, taskId, { status: data.status, videoUrl: data.videoUrl })
          .catch(err => fastify.log.warn({ err }, 'sync terminal status to db failed'))
      }
      return {
        success: true,
        data: { ...data, webhookReceived: cached != null },
      }
    } catch (err) {
      fastify.log.error(err)
      return reply.code(500).send({ success: false, error: err.message })
    }
  })

  // ─── POST /video/webhook ──────────────────────────────────────────────────
  // Receives Webhook callbacks from Volcengine Ark.
  // Must be publicly accessible and listed in JWT whitelist.
  fastify.post('/webhook', async (request, reply) => {
    const body = request.body

    if (!body || !body.id) {
      return reply.code(400).send({ code: 400, msg: 'Missing task id' })
    }

    const taskId = body.id
    fastify.log.info(`[webhook] task=${taskId} status=${body.status}`)

    // Store / overwrite with latest state
    store.set(taskId, body)

    // 更新 DB 中的任务状态
    const videoUrl = extractVideoUrl(body.content)
    updateVideoGeneration(fastify.db, taskId, {
      status: body.status,
      videoUrl,
    }).catch(err => fastify.log.warn({ err }, 'update video history failed'))

    // Always return 200 so Ark does not retry
    return { code: 200, msg: 'ok', task_id: taskId }
  })

  // ─── GET /video/webhook/status ────────────────────────────────────────────
  // Debug endpoint: shows how many tasks are in the webhook store.
  fastify.get('/webhook/status', async () => ({
    success: true,
    data: {
      storedTasks: store.size(),
      callbackUrl: autoCallbackUrl() || '(WEBHOOK_BASE_URL not set)',
    },
  }))

  // ─── GET /video/history ────────────────────────────────────────────────────
  fastify.get('/history', async (request, reply) => {
    const userId = request.jwtPayload?.userId ?? request.jwtPayload?.sub
    if (!userId) return { success: true, data: [] }
    const rows = await getVideoHistory(fastify.db, userId)
    return { success: true, data: rows }
  })
}

module.exports = videoRoutes
