'use strict'

/**
 * 保存图片生成记录
 */
async function saveImageGeneration(db, { userId, type, prompt, model, imageData, mimeType, caption }) {
  const [result] = await db.execute(
    `INSERT INTO image_generations (user_id, type, prompt, model, image_data, mime_type, caption, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, NOW(), NOW())`,
    [userId || null, type || 'image', prompt || '', model || null, imageData, mimeType || 'image/png', caption || null]
  )
  return result.insertId
}

/**
 * 获取用户图片生成历史（最近 30 条，不含 image_data 减小响应体积）
 */
async function getImageHistory(db, userId, type = null) {
  let sql = `SELECT id, user_id, type, prompt, model, mime_type, caption, created_at
             FROM image_generations
             WHERE user_id = ?`
  const params = [userId]
  if (type) { sql += ' AND type = ?'; params.push(type) }
  sql += ' ORDER BY id DESC LIMIT 30'
  const [rows] = await db.execute(sql, params)
  return rows
}

/**
 * 获取单条图片记录（含 image_data）
 */
async function getImageGenerationById(db, id, userId) {
  const [rows] = await db.execute(
    'SELECT * FROM image_generations WHERE id = ? AND user_id = ?',
    [id, userId]
  )
  return rows[0] || null
}

/**
 * 保存视频生成记录
 */
async function saveVideoGeneration(db, { userId, taskId, prompt, model, status, resolution, duration, ratio }) {
  const [result] = await db.execute(
    `INSERT INTO video_generations (user_id, task_id, prompt, model, status, resolution, duration, ratio, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
     ON DUPLICATE KEY UPDATE updated_at = NOW()`,
    [userId || null, taskId, prompt || '', model || null, status || 'queued',
     resolution || null, duration || null, ratio || null]
  )
  return result.insertId
}

/**
 * 更新视频任务状态和 URL
 */
async function updateVideoGeneration(db, taskId, { status, videoUrl }) {
  await db.execute(
    'UPDATE video_generations SET status = ?, video_url = ?, updated_at = NOW() WHERE task_id = ?',
    [status, videoUrl || null, taskId]
  )
}

/**
 * 获取用户视频生成历史（最近 30 条）
 */
async function getVideoHistory(db, userId) {
  const [rows] = await db.execute(
    `SELECT id, user_id, task_id, prompt, model, status, video_url, resolution, duration, ratio, created_at
     FROM video_generations
     WHERE user_id = ?
     ORDER BY id DESC LIMIT 30`,
    [userId]
  )
  return rows
}

module.exports = {
  saveImageGeneration,
  getImageHistory,
  getImageGenerationById,
  saveVideoGeneration,
  updateVideoGeneration,
  getVideoHistory,
}
