'use strict'

async function listItems(db, userId, category) {
  let sql = 'SELECT * FROM clothing_items WHERE 1=1'
  const params = []
  if (userId) {
    sql += ' AND user_id = ?'
    params.push(userId)
  }
  if (category) {
    sql += ' AND category = ?'
    params.push(category)
  }
  sql += ' ORDER BY created_at DESC'
  const [rows] = await db.execute(sql, params)
  return rows
}

async function createItem(db, { userId, category, name, imageUrl, filename }) {
  const [result] = await db.execute(
    'INSERT INTO clothing_items (user_id, category, name, image_url, filename, created_at, updated_at) VALUES (?, ?, ?, ?, ?, NOW(), NOW())',
    [userId, category, name || null, imageUrl, filename]
  )
  const [rows] = await db.execute('SELECT * FROM clothing_items WHERE id = ?', [result.insertId])
  return rows[0]
}

async function deleteItem(db, id, userId) {
  let sql = 'SELECT * FROM clothing_items WHERE id = ?'
  const params = [id]
  if (userId) { sql += ' AND user_id = ?'; params.push(userId) }
  const [rows] = await db.execute(sql, params)
  if (!rows.length) return null
  await db.execute('DELETE FROM clothing_items WHERE id = ?', [id])
  return rows[0]
}

module.exports = { listItems, createItem, deleteItem }
