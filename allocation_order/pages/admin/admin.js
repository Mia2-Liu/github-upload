const api = require('../../utils/api')
const fmt = require('../../utils/format')
const app = getApp()

Page({
  data: {
    isAdmin: false,
    tab: 'pending',
    loading: false,
    requests: [],
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

    this.setData({ isAdmin: true })
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

  async load(fromPull) {
    if (this.data.loading) return
    this.setData({ loading: true })

    try {
      if (this.data.tab === 'pending') {
        await this.loadPending()
      } else {
        await this.loadSummary()
      }
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
  }
})
