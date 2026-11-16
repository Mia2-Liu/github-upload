const api = require('../../utils/api')
const fmt = require('../../utils/format')
const app = getApp()

Page({
  data: {
    staff: {},
    garden: {},
    greeting: '你好',
    tomorrowText: '',
    needOrder: false,
    orders: [],
    loading: false
  },

  onShow() {
    if (!app.requireLogin()) return
    this.setData({
      staff: app.globalData.staff || {},
      garden: app.globalData.garden || {}
    })
    this.load()
  },

  onPullDownRefresh() {
    this.load(true)
  },

  async load(fromPull) {
    const hour = new Date().getHours()
    let greeting = '你好'
    if (hour < 11) greeting = '早上好'
    else if (hour < 14) greeting = '中午好'
    else if (hour < 18) greeting = '下午好'
    else greeting = '晚上好'

    const tomorrow = fmt.dateKey(1)
    this.setData({ greeting: greeting, tomorrowText: fmt.dateText(tomorrow) })

    try {
      const data = await api.call('myOrders', { limit: 20 })
      this.setData({
        orders: data.orders.slice(0, 3).map(fmt.orderView),
        needOrder: !data.orders.some(function (o) { return o.date === tomorrow })
      })
    } catch (err) {
      api.toast(err)
    } finally {
      if (fromPull) wx.stopPullDownRefresh()
    }
  },

  goOrder() {
    wx.switchTab({ url: '/pages/order/order' })
  },

  goOrders() {
    wx.switchTab({ url: '/pages/orders/orders' })
  },

  goMine() {
    wx.switchTab({ url: '/pages/mine/mine' })
  }
})
