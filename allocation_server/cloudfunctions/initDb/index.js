const cloud = require('wx-server-sdk')
const crypto = require('crypto')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })

const db = cloud.database()
const seeds = require('./seeds')

function normalizePhone(v) {
  return String(v || '').replace(/\D/g, '')
}

async function ensureCollection(name) {
  try {
    await db.createCollection(name)
    return 'created'
  } catch (e) {
    const msg = String((e && (e.errMsg || e.message)) || '')
    if (/exist/i.test(msg)) return 'exists'
    return 'error: ' + msg.slice(0, 80)
  }
}

async function countOf(name) {
  try {
    const r = await db.collection(name).count()
    return r.total
  } catch (e) {
    return -1
  }
}

async function seedCollection(name, docs) {
  const total = await countOf(name)
  if (total < 0) return { ok: false, msg: '集合不可用' }
  if (total > 0) return { ok: true, skipped: total }
  let inserted = 0
  for (let i = 0; i < docs.length; i++) {
    try {
      await db.collection(name).add({ data: docs[i] })
      inserted += 1
    } catch (e) {
      console.warn('[initDb] insert ' + name + ' failed:', docs[i]._id || i, e && e.message)
    }
  }
  return { ok: inserted === docs.length, inserted }
}

async function setAdminPassword(password) {
  const salt = crypto.randomBytes(8).toString('hex')
  const passwordHash = seeds.hashPassword(salt, password)
  const total = await countOf('settings')
  try {
    if (total > 0) {
      const r = await db.collection('settings').doc('admin').update({
        data: { salt, passwordHash, isDefaultPassword: false, updatedAt: new Date() }
      })
      if (!r.stats || r.stats.updated < 1) {
        await db.collection('settings').add({
          data: { _id: 'admin', name: '管理员', salt, passwordHash, isDefaultPassword: false, createdAt: new Date() }
        })
        return 'created'
      }
      return 'updated'
    }
    await db.collection('settings').add({
      data: { _id: 'admin', name: '管理员', salt, passwordHash, isDefaultPassword: false, createdAt: new Date() }
    })
    return 'created'
  } catch (e) {
    return 'error: ' + String((e && e.message) || e).slice(0, 80)
  }
}

exports.main = async function (event) {
  const adminPhone = normalizePhone(event && event.adminPhone)
  const adminPassword = String((event && event.adminPassword) || '').trim()

  if (adminPassword && adminPassword.length < 6) {
    return { code: 400, msg: 'adminPassword 至少 6 位', data: null }
  }

  const result = { collections: {}, seeds: {} }

  for (let i = 0; i < seeds.collections.length; i++) {
    const name = seeds.collections[i]
    result.collections[name] = await ensureCollection(name)
  }

  const admins = seeds.admins.map(function (a) {
    return Object.assign({}, a)
  })
  if (/^1[3-9]\d{9}$/.test(adminPhone)) {
    admins[0].phone = adminPhone
  }

  result.seeds.gardens = await seedCollection('gardens', seeds.gardens)
  result.seeds.products = await seedCollection('products', seeds.products)
  result.seeds.admins = await seedCollection('admins', admins)
  result.seeds.settings = await seedCollection('settings', seeds.settings)

  if (adminPassword) {
    result.seeds.settings.password = await setAdminPassword(adminPassword)
    result.seeds.settings.hint = '后台口令已按 adminPassword 设置'
  } else {
    result.seeds.settings.hint = '后台口令为默认 123456；再次调用 initDb 时传入 adminPassword 可修改'
  }

  // 已有管理员数据时，允许单独改管理员手机号
  if (/^1[3-9]\d{9}$/.test(adminPhone) && result.seeds.admins.skipped) {
    try {
      await db.collection('admins').doc('admin-1').update({ data: { phone: adminPhone } })
      result.seeds.admins.updatedAdminPhone = adminPhone
    } catch (e) {
      result.seeds.admins.updateError = String((e && e.message) || e)
    }
  }

  result.today = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10)
  return { code: 0, msg: 'ok', data: result }
}
