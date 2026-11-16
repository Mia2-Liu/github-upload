const c = require('./common')

const db = c.db
const _ = c._

/**
 * 解析手机号：
 * 1) 前端直接传 phone（调试 / 手动输入）
 * 2) 传 phoneCode（<button open-type="getPhoneNumber"> 的 code），由云调用换取手机号
 */
async function resolvePhone(event) {
  const direct = c.normalizePhone(event.phone)
  if (direct) return direct

  const code = String(event.phoneCode || '').trim()
  if (!code) return ''

  try {
    const res = await c.cloud.openapi.phonenumber.getPhoneNumber({ code })
    const info = res.phoneInfo || res.phone_info || {}
    return c.normalizePhone(info.phoneNumber || info.purePhoneNumber)
  } catch (e) {
    console.error('[login] getPhoneNumber failed:', e)
    throw new c.ApiError(400, '手机号授权失败，请重试或手动输入手机号')
  }
}

/**
 * 接口：login
 * 入参 { phone } 或 { phoneCode }
 * 返回 { authenticated, staff, garden } 或 { authenticated:false, reason }
 */
async function login(openid, event) {
  if (!openid) throw new c.ApiError(401, '缺少微信身份，请在小程序内登录')

  const phone = await resolvePhone(event)
  if (!phone) return c.ok({ authenticated: false, reason: 'NEED_PHONE', hint: '请授权手机号后登录' })
  if (!c.isValidPhone(phone)) throw new c.ApiError(400, '手机号格式不正确')

  let staff = await c.getStaff(openid)

  // 1. 管理员（后台账号）白名单
  if (!staff) {
    const ar = await db.collection('admins').where({ phone, active: true }).limit(1).get()
    const admin = ar.data[0]
    if (admin) {
      const doc = {
        openid,
        phone,
        name: admin.name || '管理员',
        role: 'admin',
        gardenKey: '',
        active: true,
        createdAt: new Date()
      }
      const add = await db.collection('staff').add({ data: doc })
      staff = Object.assign({ _id: add._id }, doc)
    }
  }

  // 2. 园所白名单：手机号命中即自动绑定
  if (!staff) {
    const gr = await db.collection('gardens')
      .where({ phones: _.elemMatch({ phone, active: true }) })
      .limit(1)
      .get()
    const garden = gr.data[0]
    if (garden) {
      if (!garden.open) throw new c.ApiError(403, '该园所已暂停使用，请联系业务员')
      const hit = (garden.phones || []).filter(function (p) {
        return p.phone === phone && p.active
      })[0]
      const doc = {
        openid,
        phone,
        name: (hit && hit.name) || '',
        role: 'teacher',
        gardenKey: garden._id,
        active: true,
        createdAt: new Date()
      }
      const add = await db.collection('staff').add({ data: doc })
      staff = Object.assign({ _id: add._id }, doc)
      await c.addLog(openid, doc.name, 'staff.bind', { gardenKey: garden._id, phone })
    }
  }

  // 3. 都不命中：检查是否有待审批申请
  if (!staff) {
    const pr = await db.collection('bind_requests')
      .where({ openid, status: 'pending' })
      .limit(1)
      .get()
    const pending = pr.data[0]
    return c.ok({
      authenticated: false,
      reason: pending ? 'PENDING_APPROVAL' : 'NEED_GARDEN_CODE',
      phone,
      request: pending
        ? { requestId: pending._id, gardenKey: pending.gardenKey, gardenName: pending.gardenName, status: 'pending' }
        : null
    })
  }

  const garden = staff.gardenKey ? await c.getGarden(staff.gardenKey) : null
  if (staff.role === 'teacher' && (!garden || !garden.open)) {
    throw new c.ApiError(403, '所属园所已暂停使用，请联系业务员')
  }

  return c.ok({
    authenticated: true,
    staff: c.publicStaff(staff),
    garden: c.publicGarden(garden),
    serverDate: c.cstDate(0),
    cutoffTime: '16:00'
  })
}

/**
 * 接口：bindApply
 * 入参 { phone, gardenKey, name }
 * 手机号不在白名单时，用园所码提交绑定申请，后台审批通过后自动进白名单。
 */
async function bindApply(openid, event) {
  if (!openid) throw new c.ApiError(401, '缺少微信身份，请在小程序内登录')

  const phone = c.normalizePhone(event.phone)
  const gardenKey = c.normalizeKey(event.gardenKey)
  if (!c.isValidPhone(phone)) throw new c.ApiError(400, '请填写正确的手机号')
  if (!/^GD-\d{4}$/.test(gardenKey)) throw new c.ApiError(400, '园所码格式不正确，例如 GD-0001')

  const garden = await c.getGarden(gardenKey)
  if (!garden) throw new c.ApiError(404, '园所码不存在，请向业务员确认')
  if (!garden.open) throw new c.ApiError(403, '该园所已暂停使用，请联系业务员')

  const name = String(event.name || '').trim().slice(0, 20)

  // 已在白名单里：直接绑定，不用审批
  const hit = (garden.phones || []).filter(function (p) {
    return p.phone === phone && p.active
  })[0]
  if (hit) {
    let staff = await c.getStaff(openid)
    if (!staff) {
      const doc = {
        openid,
        phone,
        name: hit.name || name,
        role: 'teacher',
        gardenKey,
        active: true,
        createdAt: new Date()
      }
      const add = await db.collection('staff').add({ data: doc })
      staff = Object.assign({ _id: add._id }, doc)
    }
    await c.addLog(openid, hit.name || name, 'staff.bind', { gardenKey, phone, auto: true })
    return c.ok({ status: 'approved', auto: true, staff: c.publicStaff(staff), garden: c.publicGarden(garden) })
  }

  const dup = await db.collection('bind_requests')
    .where({ openid, gardenKey, phone, status: 'pending' })
    .limit(1)
    .get()
  if (dup.data.length) {
    return c.ok({ status: 'pending', requestId: dup.data[0]._id })
  }

  const res = await db.collection('bind_requests').add({
    data: {
      openid,
      phone,
      gardenKey,
      gardenName: garden.name,
      name,
      status: 'pending',
      createdAt: new Date()
    }
  })
  await c.addLog(openid, name, 'bind.apply', { gardenKey, phone, requestId: res._id })
  return c.ok({ status: 'pending', requestId: res._id })
}

/**
 * 接口：submitOrder
 * 入参 { date?: 'YYYY-MM-DD', items: [{ productId, qty }], remark? }
 * 下单即按商品当前报价锁价，写入订单明细。
 */
async function submitOrder(openid, event) {
  const staff = await c.requireStaff(openid)
  if (staff.role === 'admin') throw new c.ApiError(403, '管理员账号不支持在小程序下单')

  const garden = await c.getGarden(staff.gardenKey)
  if (!garden) throw new c.ApiError(403, '账号未关联园所，请重新登录或联系业务员')
  if (!garden.open) throw new c.ApiError(403, '园所已暂停下单，请联系业务员')

  const date = c.normalizeDate(event.date) || c.cstDate(1)
  if (!date) throw new c.ApiError(400, '日期格式应为 YYYY-MM-DD')
  if (date <= c.cstDate(0)) throw new c.ApiError(400, '只能预订明天及以后的货')

  const raw = Array.isArray(event.items) ? event.items : []
  if (!raw.length) throw new c.ApiError(400, '请先选择要订的商品')
  if (raw.length > 50) throw new c.ApiError(400, '单笔最多 50 个品')

  const merged = new Map()
  for (let i = 0; i < raw.length; i++) {
    const productId = String(raw[i].productId || '').trim()
    const qty = c.round2(Number(raw[i].qty))
    if (!productId) throw new c.ApiError(400, '商品参数缺失')
    if (!isFinite(qty) || qty <= 0) throw new c.ApiError(400, '数量必须大于 0')
    if (qty > 9999) throw new c.ApiError(400, '单个商品数量过大')
    merged.set(productId, c.round2((merged.get(productId) || 0) + qty))
  }

  const ids = Array.from(merged.keys())
  const pr = await db.collection('products').where({ _id: _.in(ids) }).get()
  const pmap = new Map()
  pr.data.forEach(function (p) { pmap.set(p._id, p) })

  const items = []
  let amount = 0
  merged.forEach(function (qty, productId) {
    const p = pmap.get(productId)
    if (!p) throw new c.ApiError(400, '商品不存在或已下架：' + productId)
    if (!p.on) throw new c.ApiError(400, '商品已停售：' + p.name)
    const line = c.round2(qty * p.price)
    items.push({
      productId,
      name: p.name,
      unit: p.unit,
      price: p.price,
      qty,
      amount: line
    })
    amount = c.round2(amount + line)
  })

  const now = new Date()
  const orderNo = 'SO' + date.replace(/-/g, '') + '-' + staff.gardenKey.slice(3) + '-' + String(Date.now()).slice(-6)
  const doc = {
    orderNo,
    date,
    gardenKey: staff.gardenKey,
    gardenName: garden.name,
    items,
    itemCount: items.length,
    amount,
    status: '待分拣',
    remark: String(event.remark || '').trim().slice(0, 200),
    createdBy: { openid, name: staff.name || '', phone: staff.phone },
    createdAt: now,
    updatedAt: now,
    logs: [
      { at: now, by: staff.name || staff.phone, from: '', to: '待分拣', note: '园所提交订单' }
    ]
  }

  const add = await db.collection('orders').add({ data: doc })
  await c.addLog(openid, staff.name || staff.phone, 'order.create', {
    orderId: add._id,
    orderNo,
    date,
    amount
  })

  return c.ok({
    orderId: add._id,
    orderNo,
    date,
    amount,
    itemCount: items.length,
    items
  })
}

/**
 * 接口：dailySummary
 * 入参 { date?: 'YYYY-MM-DD' }，默认明天
 * 仅管理员可看（老师只看自己园所，避免跨园数据泄露）。
 */
async function dailySummary(openid, event) {
  const staff = await c.requireStaff(openid)
  if (staff.role !== 'admin') throw new c.ApiError(403, '仅管理员可查看每日汇总')

  const date = c.normalizeDate(event.date) || c.cstDate(1)
  if (!date) throw new c.ApiError(400, '日期格式应为 YYYY-MM-DD')

  const orders = await c.fetchAll('orders', { date, status: _.neq('已取消') })

  const byProductMap = new Map()
  const byGardenMap = new Map()
  const byStatus = {}
  let amount = 0
  let qty = 0

  orders.forEach(function (o) {
    amount = c.round2(amount + (o.amount || 0))
    byStatus[o.status] = (byStatus[o.status] || 0) + 1

    let g = byGardenMap.get(o.gardenKey)
    if (!g) {
      g = {
        gardenKey: o.gardenKey,
        gardenName: o.gardenName,
        orderCount: 0,
        amount: 0,
        statuses: {},
        items: new Map()
      }
      byGardenMap.set(o.gardenKey, g)
    }
    g.orderCount += 1
    g.amount = c.round2(g.amount + (o.amount || 0))
    g.statuses[o.status] = (g.statuses[o.status] || 0) + 1

    ;(o.items || []).forEach(function (it) {
      qty = c.round2(qty + (it.qty || 0))

      let p = byProductMap.get(it.productId)
      if (!p) {
        p = { productId: it.productId, name: it.name, unit: it.unit, qty: 0, amount: 0, gardens: new Set() }
        byProductMap.set(it.productId, p)
      }
      p.qty = c.round2(p.qty + (it.qty || 0))
      p.amount = c.round2(p.amount + (it.amount || 0))
      p.gardens.add(o.gardenKey)

      let gi = g.items.get(it.productId)
      if (!gi) {
        gi = { productId: it.productId, name: it.name, unit: it.unit, qty: 0 }
        g.items.set(it.productId, gi)
      }
      gi.qty = c.round2(gi.qty + (it.qty || 0))
    })
  })

  const byProduct = Array.from(byProductMap.values())
    .map(function (p) {
      return {
        productId: p.productId,
        name: p.name,
        unit: p.unit,
        qty: p.qty,
        amount: p.amount,
        gardenCount: p.gardens.size
      }
    })
    .sort(function (a, b) { return b.qty - a.qty })

  const byGarden = Array.from(byGardenMap.values())
    .map(function (g) {
      return {
        gardenKey: g.gardenKey,
        gardenName: g.gardenName,
        orderCount: g.orderCount,
        amount: g.amount,
        statuses: g.statuses,
        items: Array.from(g.items.values()).sort(function (a, b) { return b.qty - a.qty })
      }
    })
    .sort(function (a, b) { return a.gardenKey > b.gardenKey ? 1 : -1 })

  const openGardens = await c.fetchAll('gardens', { open: true })
  const ordered = new Set(byGarden.map(function (g) { return g.gardenKey }))
  const missingGardens = openGardens
    .filter(function (g) { return !ordered.has(g._id) })
    .map(function (g) { return { gardenKey: g._id, gardenName: g.name, route: g.route } })

  return c.ok({
    date,
    gardenCount: byGarden.length,
    orderCount: orders.length,
    totals: { amount, qty, itemCount: byProduct.length },
    byStatus,
    byProduct,
    byGarden,
    missingGardens
  })
}

/**
 * 接口：products
 * 当前在售商品与报价，供小程序下单页使用。
 */
async function products(openid) {
  await c.requireStaff(openid)
  const rows = await c.fetchAll('products', { on: true })
  rows.sort(function (a, b) { return a._id > b._id ? 1 : -1 })
  return c.ok(rows.map(function (p) {
    return {
      productId: p._id,
      name: p.name,
      category: p.category,
      categoryName: p.categoryName,
      spec: p.spec,
      unit: p.unit,
      price: p.price,
      prevPrice: p.prevPrice,
      boxSize: p.boxSize
    }
  }))
}

/**
 * 接口：myOrders
 * 入参 { status?, limit? }
 * 只返回当前账号所属园所的订单。
 */
async function myOrders(openid, event) {
  const staff = await c.requireStaff(openid)
  if (!staff.gardenKey) throw new c.ApiError(403, '当前账号未关联园所')

  const where = { gardenKey: staff.gardenKey }
  const status = String(event.status || '').trim()
  if (status && status !== '全部') where.status = status

  const rows = await c.fetchAll('orders', where)
  rows.sort(function (a, b) {
    return new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime()
  })

  const limit = Math.min(Math.max(Number(event.limit) || 20, 1), 50)
  return c.ok({
    orders: rows.slice(0, limit).map(function (o) {
      return {
        orderId: o._id,
        orderNo: o.orderNo,
        date: o.date,
        status: o.status,
        amount: o.amount,
        itemCount: o.itemCount,
        remark: o.remark || '',
        createdAt: o.createdAt,
        items: (o.items || []).map(function (it) {
          return {
            productId: it.productId,
            name: it.name,
            unit: it.unit,
            qty: it.qty,
            price: it.price,
            amount: it.amount
          }
        })
      }
    })
  })
}

const handlers = {
  login: login,
  bindApply: bindApply,
  products: products,
  submitOrder: submitOrder,
  myOrders: myOrders,
  dailySummary: dailySummary
}

exports.main = async function (event, context) {
  const action = String((event && event.action) || '')
  const handler = handlers[action]
  if (!handler) return c.fail(400, '未知接口：' + (action || '(空)'))

  const wxContext = c.cloud.getWXContext()
  const openid = wxContext.OPENID || ''

  try {
    return await handler(openid, event || {})
  } catch (e) {
    if (e instanceof c.ApiError) return c.fail(e.code, e.message)
    console.error('[api] ' + action + ' failed:', e)
    return c.fail(500, '服务异常，请稍后重试')
  }
}
