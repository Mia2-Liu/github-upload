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

  // 同一个 openid 但手机号不匹配（测试场景常见），清掉旧记录重新走匹配
  if (staff && staff.phone !== phone) {
    try {
      await db.collection('staff').doc(staff._id).update({ data: { active: false } })
    } catch (e) {}
    staff = null
  }

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
  await c.requireAdmin(openid, event)

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

/**
 * 接口：adminLogin
 * 入参 { password }
 * 后台 Web 没有微信身份，用管理口令换 adminToken，后续管理接口带 token。
 */
async function adminLogin(openid, event) {
  const password = String(event.password || '')
  if (!password) throw new c.ApiError(400, '请输入管理员口令')

  let settings = null
  try {
    const r = await db.collection('settings').doc('admin').get()
    settings = r.data || null
  } catch (e) {
    settings = null
  }
  if (!settings || !settings.salt || !settings.passwordHash) {
    throw new c.ApiError(500, '后台口令未初始化，请先运行 initDb 并设置 adminPassword')
  }
  if (c.hashPassword(settings.salt, password) !== settings.passwordHash) {
    await c.addLog('', 'admin', 'admin.login.fail', {})
    throw new c.ApiError(403, '口令不正确')
  }

  const token = c.newToken()
  const now = Date.now()
  const expiresAt = now + c.ADMIN_SESSION_TTL
  await db.collection('admin_sessions').add({
    data: {
      _id: token,
      name: settings.name || '管理员',
      createdAt: new Date(now),
      expiresAt
    }
  })
  await c.addLog('', settings.name || 'admin', 'admin.login', { token: token.slice(0, 8) })

  return c.ok({ token, expiresAt, name: settings.name || '管理员' })
}

function publicRequest(r) {
  return {
    requestId: r._id,
    name: r.name || '',
    phone: r.phone,
    gardenKey: r.gardenKey,
    gardenName: r.gardenName,
    status: r.status,
    createdAt: r.createdAt
  }
}

/**
 * 接口：bindRequests
 * 入参 { adminToken }
 * 待审批的绑定申请列表。
 */
async function bindRequests(openid, event) {
  await c.requireAdmin(openid, event)
  const rows = await c.fetchAll('bind_requests', { status: 'pending' })
  rows.sort(function (a, b) {
    return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
  })
  return c.ok({ total: rows.length, requests: rows.map(publicRequest) })
}

/**
 * 接口：reviewBind
 * 入参 { adminToken, requestId, approve: boolean }
 * 通过：申请手机号写进园所白名单（active:true），老师下次登录自动绑定。
 */
async function reviewBind(openid, event) {
  const admin = await c.requireAdmin(openid, event)
  const requestId = String(event.requestId || '').trim()
  if (!requestId) throw new c.ApiError(400, '缺少申请单号')

  let req = null
  try {
    const r = await db.collection('bind_requests').doc(requestId).get()
    req = r.data || null
  } catch (e) {
    req = null
  }
  if (!req) throw new c.ApiError(404, '申请不存在或已删除')
  if (req.status !== 'pending') throw new c.ApiError(400, '该申请已处理，无需重复操作')

  const approve = event.approve === true || event.approve === 'true' || event.action === 'approve'

  if (approve) {
    const garden = await c.getGarden(req.gardenKey)
    if (!garden) throw new c.ApiError(404, '申请关联的园所不存在')

    const phones = (garden.phones || []).map(function (p) {
      return Object.assign({}, p)
    })
    const hit = phones.filter(function (p) {
      return c.normalizePhone(p.phone) === req.phone
    })[0]
    if (hit) {
      hit.active = true
      if (!hit.name && req.name) hit.name = req.name
    } else {
      phones.push({ name: req.name || '新老师', phone: req.phone, active: true })
    }
    await db.collection('gardens').doc(req.gardenKey).update({ data: { phones } })
  }

  const status = approve ? 'approved' : 'rejected'
  await db.collection('bind_requests').doc(requestId).update({
    data: {
      status,
      reviewedAt: new Date(),
      reviewer: admin.name || '管理员'
    }
  })
  await c.addLog(openid, admin.name || '管理员', approve ? 'bind.approve' : 'bind.reject', {
    requestId,
    gardenKey: req.gardenKey,
    phone: req.phone
  })

  return c.ok({ requestId, status, phone: req.phone, gardenKey: req.gardenKey })
}

/**
 * 订单状态流转顺序（简单线性）
 * 已取消可恢复到待分拣，其它按顺序前进。
 */
const STATUS_FLOW = ['待分拣', '已分拣', '配送中', '已送达']
const TERMINAL_STATUSES = ['已送达', '已取消']
// 前端 WXSS 不支持中文类名，返回稳定英文 key 供样式使用
const STATUS_KEY = { '待分拣': 'pending', '已分拣': 'sorted', '配送中': 'delivering', '已送达': 'delivered', '已取消': 'cancelled' }

function nextStatusOf(from) {
  const i = STATUS_FLOW.indexOf(from)
  if (i === -1) return ''
  if (i + 1 >= STATUS_FLOW.length) return ''
  return STATUS_FLOW[i + 1]
}

/**
 * 接口：listOrders
 * 入参 { date?: 'YYYY-MM-DD', status? }
 * 管理员按日期看全部订单，按园所分组。
 */
async function listOrders(openid, event) {
  const admin = await c.requireAdmin(openid, event)
  const date = c.normalizeDate(event.date) || c.cstDate(1)
  if (!date) throw new c.ApiError(400, '日期格式应为 YYYY-MM-DD')

  const where = { date }
  const status = String(event.status || '').trim()
  if (status && status !== '全部') where.status = status

  const rows = await c.fetchAll('orders', where)
  rows.sort(function (a, b) {
    const byGarden = String(a.gardenKey).localeCompare(String(b.gardenKey))
    if (byGarden !== 0) return byGarden
    return new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime()
  })

  // 按园所分组
  const gardenMap = new Map()
  rows.forEach(function (o) {
    let g = gardenMap.get(o.gardenKey)
    if (!g) {
      g = { gardenKey: o.gardenKey, gardenName: o.gardenName, orders: [] }
      gardenMap.set(o.gardenKey, g)
    }
    g.orders.push({
      orderId: o._id,
      orderNo: o.orderNo,
      date: o.date,
      gardenKey: o.gardenKey,
      gardenName: o.gardenName,
      status: o.status,
      statusKey: STATUS_KEY[o.status] || 'pending',
      amount: o.amount,
      itemCount: o.itemCount,
      remark: o.remark || '',
      createdAt: o.createdAt,
      nextStatus: nextStatusOf(o.status),
      canCancel: !TERMINAL_STATUSES.includes(o.status) && o.status !== '已取消',
      canRestore: o.status === '已取消',
      createdBy: (o.createdBy && (o.createdBy.name || o.createdBy.phone)) || '',
      items: (o.items || []).map(function (it) {
        return { productId: it.productId, name: it.name, unit: it.unit, qty: it.qty, price: it.price, amount: it.amount }
      })
    })
  })

  const groups = Array.from(gardenMap.values())
  const totalAmount = c.round2(rows.reduce(function (s, o) { return s + (o.amount || 0) }, 0))

  return c.ok({
    date,
    orderCount: rows.length,
    gardenCount: groups.length,
    totalAmount,
    groups
  })
}

/**
 * 接口：updateOrderStatus
 * 入参 { orderId, to?: string, direction?: 'next'|'cancel'|'restore', note? }
 * direction 不传时用 to 的值；两者都有以 to 为准。
 */
async function updateOrderStatus(openid, event) {
  const admin = await c.requireAdmin(openid, event)
  const orderId = String(event.orderId || '').trim()
  if (!orderId) throw new c.ApiError(400, '缺少订单号')

  let order = null
  try {
    const r = await db.collection('orders').doc(orderId).get()
    order = r.data || null
  } catch (e) {
    order = null
  }
  if (!order) throw new c.ApiError(404, '订单不存在')

  let target = String(event.to || '').trim()
  const direction = String(event.direction || '').trim()

  if (!target) {
    if (direction === 'next') target = nextStatusOf(order.status)
    else if (direction === 'cancel') target = '已取消'
    else if (direction === 'restore') target = '待分拣'
  }
  if (!target) throw new c.ApiError(400, '目标状态不明确')

  // 合法性校验
  if (target === '已取消') {
    if (TERMINAL_STATUSES.includes(order.status)) throw new c.ApiError(400, '订单已终结，无法取消')
  } else if (target === '待分拣') {
    if (order.status !== '已取消') throw new c.ApiError(400, '仅已取消订单可恢复')
  } else {
    // 正常流转：必须按顺序
    const expected = nextStatusOf(order.status)
    if (!expected || target !== expected) {
      throw new c.ApiError(400, '状态流转不合法：' + order.status + ' → ' + target)
    }
  }

  const now = new Date()
  const note = String(event.note || '').trim().slice(0, 200)
  const newLog = {
    at: now,
    by: admin.name || '管理员',
    from: order.status,
    to: target,
    note: note || ('管理员操作 ' + order.status + ' → ' + target)
  }
  const logs = (order.logs || []).concat([newLog])

  await db.collection('orders').doc(orderId).update({
    data: { status: target, updatedAt: now, logs }
  })

  await c.addLog(openid, admin.name || '管理员', 'order.status', {
    orderId, orderNo: order.orderNo, from: order.status, to: target, note
  })

  return c.ok({ orderId, orderNo: order.orderNo, from: order.status, to: target })
}

/**
 * 接口：adminProducts
 * 管理员看全部商品（含已停售），用于维护报价和上下架。
 */
async function adminProducts(openid) {
  await c.requireAdmin(openid)
  const rows = await c.fetchAll('products')
  rows.sort(function (a, b) {
    const byCat = String(a.category || '').localeCompare(String(b.category || ''))
    if (byCat !== 0) return byCat
    return a._id > b._id ? 1 : -1
  })
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
      boxSize: p.boxSize,
      on: !!p.on
    }
  }))
}

/**
 * 接口：toggleProduct
 * 上架 / 下架切换。
 */
async function toggleProduct(openid, event) {
  const admin = await c.requireAdmin(openid, event)
  const productId = String(event.productId || '').trim()
  if (!productId) throw new c.ApiError(400, '缺少商品 ID')

  let p = null
  try {
    const r = await db.collection('products').doc(productId).get()
    p = r.data || null
  } catch (e) {
    p = null
  }
  if (!p) throw new c.ApiError(404, '商品不存在')

  const newOn = !p.on
  await db.collection('products').doc(productId).update({ data: { on: newOn } })
  await c.addLog(openid, admin.name || '管理员', 'product.toggle', { productId, name: p.name, on: newOn })

  return c.ok({ productId, name: p.name, on: newOn })
}

/**
 * 接口：updateProduct
 * 改价：price 存进 prevPrice，新价写入 price，防丢失。
 */
async function updateProduct(openid, event) {
  const admin = await c.requireAdmin(openid, event)
  const productId = String(event.productId || '').trim()
  if (!productId) throw new c.ApiError(400, '缺少商品 ID')

  const price = c.round2(Number(event.price))
  if (!isFinite(price) || price <= 0) throw new c.ApiError(400, '价格必须大于 0')
  if (price > 9999) throw new c.ApiError(400, '价格过大')

  let p = null
  try {
    const r = await db.collection('products').doc(productId).get()
    p = r.data || null
  } catch (e) {
    p = null
  }
  if (!p) throw new c.ApiError(404, '商品不存在')
  if (p.price === price) return c.ok({ productId, name: p.name, price })

  const oldPrice = p.price
  await db.collection('products').doc(productId).update({
    data: { price, prevPrice: oldPrice }
  })
  await c.addLog(openid, admin.name || '管理员', 'product.price', {
    productId, name: p.name, from: oldPrice, to: price
  })

  return c.ok({ productId, name: p.name, from: oldPrice, to: price })
}

/**
 * 接口：createProduct
 * 新增食材。productId 自动按 P013、P014… 往后排。
 */
async function createProduct(openid, event) {
  const admin = await c.requireAdmin(openid, event)
  const name = String(event.name || '').trim().slice(0, 30)
  const category = String(event.category || '').trim()
  const categoryName = String(event.categoryName || '').trim() || category
  const unit = String(event.unit || '').trim().slice(0, 10)
  const spec = String(event.spec || '').trim().slice(0, 60)
  const boxSize = Math.max(1, Math.min(9999, Math.floor(Number(event.boxSize) || 1)))
  const price = c.round2(Number(event.price))
  if (!name) throw new c.ApiError(400, '请填写商品名称')
  if (!['veg', 'baby', 'meat', 'other'].includes(category)) throw new c.ApiError(400, '分类无效')
  if (!unit) throw new c.ApiError(400, '请填写单位，如 斤 / 袋')
  if (!isFinite(price) || price <= 0) throw new c.ApiError(400, '价格必须大于 0')

  // 生成下一个 productId
  const all = await c.fetchAll('products')
  let maxNum = 0
  all.forEach(function (p) {
    const m = /^P(\d{3})$/.exec(p._id)
    if (m) { const n = Number(m[1]); if (n > maxNum) maxNum = n }
  })
  const productId = 'P' + String(maxNum + 1).padStart(3, '0')

  const doc = {
    _id: productId,
    name, category, categoryName, spec, unit,
    price, prevPrice: price, boxSize, on: true
  }
  await db.collection('products').add({ data: doc })
  await c.addLog(openid, admin.name || '管理员', 'product.create', doc)
  return c.ok({ productId, name, price })
}

/**
 * 接口：editProduct
 * 编辑商品信息（名称 / 分类 / 规格 / 单位 / 箱规）。
 * 价格走 updateProduct 单独接口，防误操作。
 */
async function editProduct(openid, event) {
  const admin = await c.requireAdmin(openid, event)
  const productId = String(event.productId || '').trim()
  if (!productId) throw new c.ApiError(400, '缺少商品 ID')

  let p = null
  try { const r = await db.collection('products').doc(productId).get(); p = r.data || null } catch (e) { p = null }
  if (!p) throw new c.ApiError(404, '商品不存在')

  const patch = {}
  if ('name' in event) {
    const v = String(event.name || '').trim().slice(0, 30)
    if (!v) throw new c.ApiError(400, '名称不能为空')
    if (v !== p.name) patch.name = v
  }
  if ('category' in event) {
    const v = String(event.category || '').trim()
    if (!['veg', 'baby', 'meat', 'other'].includes(v)) throw new c.ApiError(400, '分类无效')
    if (v !== p.category) { patch.category = v; patch.categoryName = String(event.categoryName || '').trim() || v }
  }
  if ('spec' in event) {
    const v = String(event.spec || '').trim().slice(0, 60)
    if (v !== (p.spec || '')) patch.spec = v
  }
  if ('unit' in event) {
    const v = String(event.unit || '').trim().slice(0, 10)
    if (!v) throw new c.ApiError(400, '单位不能为空')
    if (v !== p.unit) patch.unit = v
  }
  if ('boxSize' in event) {
    const v = Math.max(1, Math.min(9999, Math.floor(Number(event.boxSize) || 1)))
    if (v !== (p.boxSize || 1)) patch.boxSize = v
  }

  if (!Object.keys(patch).length) return c.ok({ productId })
  await db.collection('products').doc(productId).update({ data: patch })
  await c.addLog(openid, admin.name || '管理员', 'product.edit', { productId, patch })
  return c.ok({ productId, patch })
}

const handlers = {
  adminLogin: adminLogin,
  bindRequests: bindRequests,
  reviewBind: reviewBind,
  login: login,
  bindApply: bindApply,
  products: products,
  submitOrder: submitOrder,
  myOrders: myOrders,
  dailySummary: dailySummary,
  listOrders: listOrders,
  updateOrderStatus: updateOrderStatus,
  adminProducts: adminProducts,
  toggleProduct: toggleProduct,
  updateProduct: updateProduct,
  createProduct: createProduct,
  editProduct: editProduct
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
