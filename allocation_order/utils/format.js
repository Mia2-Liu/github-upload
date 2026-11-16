function pad(n) {
  return n < 10 ? '0' + n : '' + n
}

// offset：0 今天，1 明天
function dateKey(offset) {
  const d = new Date(Date.now() + (offset || 0) * 86400000)
  return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())
}

function dateText(s) {
  const p = String(s || '').split('-')
  if (p.length !== 3) return s || ''
  return Number(p[1]) + '月' + Number(p[2]) + '日'
}

function timeText(v) {
  const d = new Date(v)
  if (isNaN(d.getTime())) return ''
  return dateText(d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate())) +
    ' ' + pad(d.getHours()) + ':' + pad(d.getMinutes())
}

function statusClass(status) {
  if (status === '已签收') return 'green'
  if (status === '配送中') return 'brand'
  if (status === '待分拣') return 'amber'
  return ''
}

function fmtPhone(p) {
  const s = String(p || '')
  if (s.length !== 11) return s
  return s.slice(0, 3) + ' ' + s.slice(3, 7) + ' ' + s.slice(7)
}

// 补齐 WXML 不能直接算的展示字段
function orderView(o) {
  const items = (o.items || []).map(function (it) {
    return Object.assign({}, it, {
      amountText: Number(it.amount || 0).toFixed(2),
      priceText: Number(it.price || 0).toFixed(2)
    })
  })
  return Object.assign({}, o, {
    items: items,
    amountText: Number(o.amount || 0).toFixed(2),
    dateText: dateText(o.date),
    timeText: timeText(o.createdAt),
    shortNo: String(o.orderNo || '').slice(-6),
    names: items.map(function (it) { return it.name }).join('、'),
    tagClass: statusClass(o.status)
  })
}

module.exports = {
  pad: pad,
  dateKey: dateKey,
  dateText: dateText,
  timeText: timeText,
  statusClass: statusClass,
  fmtPhone: fmtPhone,
  orderView: orderView
}
