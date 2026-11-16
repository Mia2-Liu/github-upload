const api = require('../../utils/api')
const fmt = require('../../utils/format')
const app = getApp()

const FILTERS = ['全部', '待分拣', '配送中', '已签收']

Page({
  data: {
    filters: FILTERS,
    filter: '全部',
    list: [],
    detail: null
  },

  onShow() {
    if (!app.requireLogin()) return
    this.load()
  },

  onPullDownRefresh() {
    this.load(true)
  },

  async load(fromPull) {
    try {
      const data = await api.call('myOrders', { status: this.data.filter, limit: 50 })
      this.setData({ list: data.orders.map(fmt.orderView) })
    } catch (err) {
      api.toast(err)
    } finally {
      if (fromPull) wx.stopPullDownRefresh()
    }
  },

  switchFilter(e) {
    const f = e.currentTarget.dataset.f
    if (f === this.data.filter) return
    this.setData({ filter: f }, this.load)
  },

  openDetail(e) {
    const id = e.currentTarget.dataset.id
    const order = this.data.list.filter(function (o) { return o.orderId === id })[0]
    if (order) this.setData({ detail: order })
  },

  closeDetail() {
    this.setData({ detail: null })
  },

  noop() {}
})
