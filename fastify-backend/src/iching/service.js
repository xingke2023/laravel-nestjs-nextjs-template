'use strict'

const { TRIGRAMS, HEXAGRAM_TABLE, HEXAGRAMS } = require('./data')

// 时辰对照（时辰序号 1-12）
const SHICHEN = [
  { name: '子时', range: '23:00-01:00', num: 1 },
  { name: '丑时', range: '01:00-03:00', num: 2 },
  { name: '寅时', range: '03:00-05:00', num: 3 },
  { name: '卯时', range: '05:00-07:00', num: 4 },
  { name: '辰时', range: '07:00-09:00', num: 5 },
  { name: '巳时', range: '09:00-11:00', num: 6 },
  { name: '午时', range: '11:00-13:00', num: 7 },
  { name: '未时', range: '13:00-15:00', num: 8 },
  { name: '申时', range: '15:00-17:00', num: 9 },
  { name: '酉时', range: '17:00-19:00', num: 10 },
  { name: '戌时', range: '19:00-21:00', num: 11 },
  { name: '亥时', range: '21:00-23:00', num: 12 },
]

// 天干地支
const TIANGAN = ['甲', '乙', '丙', '丁', '戊', '己', '庚', '辛', '壬', '癸']
const DIZHI   = ['子', '丑', '寅', '卯', '辰', '巳', '午', '未', '申', '酉', '戌', '亥']
const SHENGXIAO = ['鼠', '牛', '虎', '兔', '龙', '蛇', '马', '羊', '猴', '鸡', '狗', '猪']

/**
 * 将公历小时转换为时辰序号（1-12）
 * 子时跨日：23点属子时(1)，0点也属子时(1)
 */
function hourToShichen(hour) {
  if (hour === 23) return 1
  return Math.floor(hour / 2) + 1
}

/**
 * 梅花易数起卦法（生辰起卦）
 * 上卦 = (年数字之和 + 月 + 日) mod 8
 * 下卦 = (年数字之和 + 月 + 日 + 时辰) mod 8
 * 动爻 = (年数字之和 + 月 + 日 + 时辰) mod 6
 */
function calcHexagram(year, month, day, hour) {
  const yearSum = String(year).split('').reduce((s, d) => s + parseInt(d), 0)
  const shichenNum = hourToShichen(hour)
  const base = yearSum + month + day

  let upper = base % 8
  if (upper === 0) upper = 8

  let lower = (base + shichenNum) % 8
  if (lower === 0) lower = 8

  let movingLine = (base + shichenNum) % 6
  if (movingLine === 0) movingLine = 6

  const hexagramNum = HEXAGRAM_TABLE[lower - 1][upper - 1]

  return { upper, lower, movingLine, hexagramNum, yearSum, shichenNum }
}

/**
 * 获取天干地支年份
 */
function getGanzhi(year) {
  const tg = TIANGAN[(year - 4) % 10]
  const dz = DIZHI[(year - 4) % 12]
  const sx = SHENGXIAO[(year - 4) % 12]
  return { ganzhi: tg + dz, shengxiao: sx }
}

/**
 * 主入口：根据生辰推算命卦
 */
function predict(year, month, day, hour) {
  const { upper, lower, movingLine, hexagramNum, yearSum, shichenNum } = calcHexagram(year, month, day, hour)
  const hexagram = HEXAGRAMS[hexagramNum]
  const upperTrigram = TRIGRAMS[upper]
  const lowerTrigram = TRIGRAMS[lower]
  const shichenInfo = SHICHEN[shichenNum - 1]
  const { ganzhi, shengxiao } = getGanzhi(year)

  // 动爻变卦
  const changedUpper = hexagramNum <= 32
    ? transformTrigram(upper, movingLine, 'upper')
    : upper
  const changedLower = hexagramNum > 32
    ? transformTrigram(lower, movingLine, 'lower')
    : lower
  const changedHexNum = HEXAGRAM_TABLE[changedLower - 1][changedUpper - 1]
  const changedHex = HEXAGRAMS[changedHexNum]

  return {
    input: {
      year, month, day, hour,
      shichen: shichenInfo.name,
      shichenRange: shichenInfo.range,
      ganzhi,
      shengxiao,
    },
    calculation: {
      yearDigitSum: yearSum,
      shichenNum,
      upperTrigramNum: upper,
      lowerTrigramNum: lower,
      movingLine,
    },
    hexagram: {
      number: hexagramNum,
      symbol: String.fromCodePoint(0x4DC0 + hexagramNum - 1),
      name: hexagram.name,
      fullName: hexagram.fullName,
      upperTrigram: {
        name: upperTrigram.name,
        symbol: upperTrigram.symbol,
        nature: upperTrigram.nature,
      },
      lowerTrigram: {
        name: lowerTrigram.name,
        symbol: lowerTrigram.symbol,
        nature: lowerTrigram.nature,
      },
      grade: hexagram.grade,
      judgment: hexagram.judgment,
      interpretation: hexagram.interpretation,
      movingLine,
    },
    fortune: {
      overall: hexagram.grade,
      career: hexagram.career,
      wealth: hexagram.wealth,
      love: hexagram.love,
      health: hexagram.health,
    },
    changedHexagram: {
      number: changedHexNum,
      symbol: String.fromCodePoint(0x4DC0 + changedHexNum - 1),
      name: changedHex.name,
      fullName: changedHex.fullName,
      grade: changedHex.grade,
      interpretation: changedHex.interpretation,
    },
  }
}

// 简单变爻逻辑（阴阳互换对应三爻之一触发卦变）
function transformTrigram(trigramNum, line, position) {
  const transforms = {
    1: { 1: 5, 2: 7, 3: 4 }, // 乾变
    2: { 1: 6, 2: 7, 3: 3 }, // 兑变
    3: { 1: 4, 2: 8, 3: 6 }, // 离变
    4: { 1: 8, 2: 3, 3: 1 }, // 震变
    5: { 1: 1, 2: 6, 3: 2 }, // 巽变
    6: { 1: 2, 2: 5, 3: 8 }, // 坎变
    7: { 1: 3, 2: 2, 3: 5 }, // 艮变
    8: { 1: 7, 2: 4, 3: 6 }, // 坤变
  }
  const lineInTrigram = ((line - 1) % 3) + 1
  return transforms[trigramNum]?.[lineInTrigram] ?? trigramNum
}

module.exports = { predict }
