'use strict'

const https = require('https')

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let data = ''
      res.on('data', chunk => data += chunk)
      res.on('end', () => {
        try {
          resolve(JSON.parse(data))
        } catch (e) {
          reject(new Error('JSON parse error: ' + e.message))
        }
      })
    }).on('error', reject)
  })
}

/**
 * 搜索指定地区的景区列表（分页）
 */
async function searchScenicSpots(region, pageNum = 0) {
  const ak = process.env.BAIDU_MAP_AK
  if (!ak) throw new Error('BAIDU_MAP_AK not configured')

  const params = new URLSearchParams({
    query: '景区',
    region,
    tag: '旅游景点',
    scope: '2',
    page_size: '20',
    page_num: String(pageNum),
    output: 'json',
    ak,
  })

  const url = `https://api.map.baidu.com/place/v2/search?${params}`
  return httpGet(url)
}

/**
 * 收集指定地区所有景区（自动翻页，最多20页）
 */
async function collectAllSpots(region) {
  const allSpots = []
  let page = 0

  while (true) {
    const data = await searchScenicSpots(region, page)

    if (data.status !== 0) {
      throw new Error(`百度API错误: ${data.message}`)
    }

    const results = data.results || []
    if (results.length === 0) break

    allSpots.push(...results)

    if (results.length < 20 || page >= 19) break
    page++

    await new Promise(r => setTimeout(r, 300))
  }

  return allSpots
}

/**
 * 按名称搜索主景区，获取坐标
 */
async function findMainSpot(name, region) {
  const ak = process.env.BAIDU_MAP_AK
  if (!ak) throw new Error('BAIDU_MAP_AK not configured')

  const params = new URLSearchParams({
    query: name,
    region,
    scope: '2',
    page_size: '5',
    output: 'json',
    ak,
  })

  const url = `https://api.map.baidu.com/place/v2/search?${params}`
  return httpGet(url)
}

/**
 * 在指定坐标周边圆形范围内搜索景点
 */
async function searchNearby(lat, lng, radius, keyword, pageNum = 0) {
  const ak = process.env.BAIDU_MAP_AK
  if (!ak) throw new Error('BAIDU_MAP_AK not configured')

  const params = new URLSearchParams({
    query: keyword,
    location: `${lat},${lng}`,
    radius: String(radius),
    scope: '2',
    page_size: '20',
    page_num: String(pageNum),
    output: 'json',
    ak,
  })

  const url = `https://api.map.baidu.com/place/v2/search?${params}`
  return httpGet(url)
}

/**
 * 收集景区周边所有子景点（多关键词去重）
 */
async function collectSubSpots(name, region, radius = 5000, keywords = ['景点', '寺庙', '佛殿', '参观', '景区']) {
  // 先找主景区坐标
  const mainResult = await findMainSpot(name, region)

  if (mainResult.status !== 0 || !mainResult.results?.length) {
    throw new Error(`未找到景区"${name}"：${mainResult.message || '无结果'}`)
  }

  const main = mainResult.results[0]
  const { lat, lng } = main.location

  // 多关键词搜索周边，合并去重
  const allSpots = new Map()

  for (const kw of keywords) {
    let page = 0
    while (true) {
      const data = await searchNearby(lat, lng, radius, kw, page)
      if (data.status !== 0 || !data.results?.length) break

      for (const s of data.results) {
        if (s.uid !== main.uid) {
          allSpots.set(s.uid, s)
        }
      }

      if (data.results.length < 20 || page >= 4) break
      page++
      await new Promise(r => setTimeout(r, 300))
    }
  }

  return {
    main: formatSpot(main),
    subSpots: [...allSpots.values()].map(formatSpot),
  }
}

function formatSpot(s) {
  const info = s.detail_info || {}
  return {
    uid: s.uid,
    name: s.name,
    address: s.address || null,
    telephone: s.telephone || null,
    location: s.location || null,
    overall_rating: info.overall_rating || null,
    tag: info.tag || null,
    description: info.description || null,
  }
}

module.exports = { collectAllSpots, collectSubSpots, formatSpot }
