'use strict'

/**
 * In-memory store for video task states received via Webhook.
 * Keyed by taskId.  Entries are replaced on each callback (idempotent).
 * TTL: 48 h (matching execution_expires_after default of 172800 s).
 */

const TTL_MS = 48 * 60 * 60 * 1000   // 48 hours

const store = new Map()   // taskId → { data, expiresAt }

function set(taskId, data) {
  store.set(taskId, { data, expiresAt: Date.now() + TTL_MS })
}

function get(taskId) {
  const entry = store.get(taskId)
  if (!entry) return null
  if (Date.now() > entry.expiresAt) { store.delete(taskId); return null }
  return entry.data
}

function size() { return store.size }

// Periodic cleanup of expired entries (every 10 min)
setInterval(() => {
  const now = Date.now()
  for (const [id, entry] of store) {
    if (now > entry.expiresAt) store.delete(id)
  }
}, 10 * 60 * 1000)

// Provider info store: taskId → { apiKey, apiUrl }
const providerStore = new Map()

function setProvider(taskId, info) {
  providerStore.set(taskId, info)
}

function getProvider(taskId) {
  return providerStore.get(taskId) || {}
}

module.exports = { set, get, size, setProvider, getProvider }
