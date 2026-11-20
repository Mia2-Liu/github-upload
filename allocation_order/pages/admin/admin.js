const api = require('../../utils/api')
const fmt = require('../../utils/format')
const app = getApp()

function cstDate(offset) {
  const d = new Date(Date.now() + (offset || 0) * 86400000)
  return new Date(d.getTime() + 8 * 3600 * 1000).toISOString().slice(0, 10)
}

Page({
  data: {
    isAdmin: false,
    staffName: '',
    tab: 'pending',
    loading: false,

    // 待审批
    requests: [],

    // 今日订单
    ordersDate: '',
    ordersDateText: '',
    orders: { orderCount: 0, gardenCount: 0, totalAmountText: '0.00', groups: [] },

    // 汇总
    summaryDate: '',
    summaryDateText: '',
    totals: { orderCount: 0, gardenCount: 0, amountText: '0.00', itemCount: 0 },
    products: [],
    missing: []
  },

  onShow() {
    if (!app.requireLogin()) return

    const staff = app.globalData.staff || {}
    if (staff.role !== 'admin') {
      const self = this
      wx.showModal({
        title: '无权限',
        content: '当前账号不是管理员，请用管理员手机号登录',
        showCancel: false,
        success: function () {
          wx.switchTab({ url: '/pages/home/home' })
        }
      })
      self.setData({ isAdmin: false })
      return
    }

    const tomorrow = cstDate(1)
    this.setData({
      isAdmin: true,
      staffName: staff.name || '管理员',
      ordersDate: tomorrow,
      ordersDateText: fmt.dateText(tomorrow)
    })
    this.load()
  },

  onPullDownRefresh() {
    this.load(true)
  },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.tab) return
    this.setData({ tab: tab })
    this.load()
  },

  onDateChange(e) {
    const date = String(e.detail.value)
    this.setData({ ordersDate: date, ordersDateText: fmt.dateText(date) })
    this.loadOrders()
  },

  async load(fromPull) {
    if (this.data.loading) return
    this.setData({ loading: true })
    try {
      if (this.data.tab === 'pending') await this.loadPending()
      else if (this.data.tab === 'orders') await this.loadOrders()
      else await this.loadSummary()
    } catch (err) {
      api.toast(err)
    } finally {
      this.setData({ loading: false })
      if (fromPull) wx.stopPullDownRefresh()
    }
  },

  async loadPending() {
    const data = await api.call('bindRequests', {})
    const requests = (data.requests || []).map(function (r) {
      return {
        requestId: r.requestId,
        name: r.name || '未填写姓名',
        phoneText: fmt.fmtPhone(r.phone),
        gardenName: r.gardenName || r.gardenKey,
        gardenKey: r.gardenKey,
        timeText: fmt.timeText(r.createdAt)
      }
    })
    this.setData({ requests: requests })
  },

  async loadOrders() {
    const data = await api.call('listOrders', { date: this.data.ordersDate })
    const groups = (data.groups || []).map(function (g) {
      return {
        gardenKey: g.gardenKey,
        gardenName: g.gardenName,
        orders: (g.orders || []).map(function (o) {
          return {
            orderId: o.orderId,
            orderNo: o.orderNo,
            status: o.status,
            nextStatus: o.nextStatus,
            canCancel: o.canCancel,
            canRestore: o.canRestore,
            amountText: Number(o.amount || 0).toFixed(2),
            itemCount: o.itemCount,
            createdBy: o.createdBy,
            timeText: fmt.timeText(o.createdAt),
            items: (o.items || []).map(function (it) {
              return { productId: it.productId, name: it.name, unit: it.unit, qty: it.qty }
            })
          }
        })
      }
    })
    this.setData({
      orders: {
        orderCount: data.orderCount || 0,
        gardenCount: data.gardenCount || 0,
        totalAmountText: Number(data.totalAmount || 0).toFixed(2),
        groups: groups
      }
    })
  },

  async loadSummary() {
    const data = await api.call('dailySummary', {})
    this.setData({
      summaryDate: data.date,
      summaryDateText: fmt.dateText(data.date),
      totals: {
        orderCount: data.orderCount || 0,
        gardenCount: data.gardenCount || 0,
        itemCount: (data.totals && data.totals.itemCount) || 0,
        amountText: Number((data.totals && data.totals.amount) || 0).toFixed(2)
      },
      products: (data.byProduct || []).slice(0, 20).map(function (p) {
        return {
          productId: p.productId,
          name: p.name,
          qtyText: p.qty + (p.unit || ''),
          gardenCount: p.gardenCount,
          amountText: Number(p.amount || 0).toFixed(2)
        }
      }),
      missing: (data.missingGardens || []).map(function (g) {
        return { gardenKey: g.gardenKey, gardenName: g.gardenName, route: g.route || '' }
      })
    })
  },

  review(e) {
    const requestId = e.currentTarget.dataset.id
    const approve = e.currentTarget.dataset.approve === '1'
    const self = this

    wx.showModal({
      title: approve ? '通过申请' : '拒绝申请',
      content: approve ? '通过后该手机号立即加入园所白名单' : '拒绝后该老师将无法登录，可重新申请',
      confirmText: approve ? '通过' : '拒绝',
      success: function (res) {
        if (!res.confirm) return
        self.doReview(requestId, approve)
      }
    })
  },

  async doReview(requestId, approve) {
    wx.showLoading({ title: '处理中', mask: true })
    try {
      await api.call('reviewBind', { requestId: requestId, approve: approve })
      wx.hideLoading()
      wx.showToast({ title: approve ? '已通过' : '已拒绝', icon: 'success' })
      this.load()
    } catch (err) {
      wx.hideLoading()
      api.toast(err)
    }
  },

  updateStatus(e) {
    const orderId = e.currentTarget.dataset.id
    const direction = e.currentTarget.dataset.dir
    const label = direction === 'next' ? ('推进到「' + e.currentTarget.dataset.label + '」')
               : direction === 'cancel' ? '取消该订单'
               : '恢复为待分拣'
    const self = this

    wx.showModal({
      title: '确认操作',
      content: label + '？',
      confirmText: direction === 'cancel' ? '取消订单' : (direction === 'restore' ? '恢复' : '推进'),
      success: function (res) {
        if (!res.confirm) return
        self.doUpdateStatus(orderId, direction)
      }
    })
  },

  async doUpdateStatus(orderId, direction) {
    wx.showLoading({ title: '处理中', mask: true })
    try {
      await api.call('updateOrderStatus', { orderId: orderId, direction: direction })
      wx.hideLoading()
      wx.showToast({ title: '操作成功', icon: 'success' })
      this.loadOrders()
    } catch (err) {
      wx.hideLoading()
      api.toast(err)
    }
  },

  logout() {
    wx.showModal({
      title: '退出登录',
      content: '退出后需要重新授权手机号',
      success: function (res) {
        if (!res.confirm) return
        app.clearAuth()
        wx.reLaunch({ url: '/pages/login/login' })
      }
    })
  }
})
