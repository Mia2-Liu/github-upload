const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const _ = db.command

class ApiError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

function ok(data) {
  return { code: 0, msg: 'ok', data: data === undefined ? null : data }
}

function fail(code, msg) {
  return { code, msg, data: null }
}

function round2(n) {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100
}

function normalizePhone(v) {
  return String(v || '').replace(/\D/g, '')
}

function isValidPhone(p) {
  return /^1[3-9]\d{9}$/.test(p)
}

function normalizeKey(v) {
  return String(v || '').trim().toUpperCase()
}

function cstDateOf(d) {
  return new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

// 云函数运行在 UTC，统一按北京时间取“今天/明天”
function cstDate(offsetDays) {
  return cstDateOf(new Date(Date.now() + (offsetDays || 0) * 86400000))
}

function normalizeDate(v) {
  if (v instanceof Date && !isNaN(v.getTime())) return cstDateOf(v)
  const s = String(v || '').trim()
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ''
}

function publicGarden(g) {
  if (!g) return null
  return {
    key: g._id,
    name: g.name,
    contact: g.contact,
    route: g.route,
    settle: g.settle,
    open: !!g.open
  }
}

function publicStaff(s) {
  return {
    name: s.name || '',
    phone: s.phone,
    role: s.role,
    gardenKey: s.gardenKey || ''
  }
}

async function getStaff(openid) {
  const r = await db.collection('staff').where({ openid, active: true }).limit(1).get()
  return r.data[0] || null
}

async function requireStaff(openid) {
  const staff = await getStaff(openid)
  if (!staff) throw new ApiError(401, '未登录或账号未绑定，请先登录')
  return staff
}

async function getGarden(key) {
  if (!key) return null
  try {
    const r = await db.collection('gardens').doc(key).get()
    return r.data || null
  } catch (e) {
    return null
  }
}

// 云数据库单次最多返回 100 条，这里做分页拉全量
async function fetchAll(collection, where) {
  const out = []
  const size = 100
  let skip = 0
  for (;;) {
    let q = db.collection(collection)
    if (where) q = q.where(where)
    const r = await q.skip(skip).limit(size).get()
    out.push.apply(out, r.data)
    if (r.data.length < size) break
    skip += size
  }
  return out
}

async function addLog(openid, actor, action, detail) {
  try {
    await db.collection('op_logs').add({
      data: { openid: openid || '', actor: actor || '', action, detail: detail || {}, at: new Date() }
    })
  } catch (e) {
    console.warn('[op_logs] write failed:', e && e.message)
  }
}

module.exports = {
  cloud,
  db,
  _,
  ApiError,
  ok,
  fail,
  round2,
  normalizePhone,
  isValidPhone,
  normalizeKey,
  cstDate,
  normalizeDate,
  publicGarden,
  publicStaff,
  getStaff,
  requireStaff,
  getGarden,
  fetchAll,
  addLog
}
