// 云开发环境 ID：只有一个环境时可留空，用默认环境；多环境时填上，例如 'prod-1x2y3z'
const CLOUD_ENV = ''

App({
  globalData: {
    staff: null,
    garden: null
  },

  onLaunch() {
    if (!wx.cloud) {
      wx.showModal({ title: '提示', content: '当前微信版本过低，请升级后再使用', showCancel: false })
      return
    }
    wx.cloud.init(CLOUD_ENV ? { env: CLOUD_ENV, traceUser: true } : { traceUser: true })

    const cached = wx.getStorageSync('auth')
    if (cached && cached.staff && cached.staff.role) {
      this.globalData.staff = cached.staff
      this.globalData.garden = cached.garden || null
    }
  },

  setAuth(payload) {
    this.globalData.staff = payload.staff
    this.globalData.garden = payload.garden || null
    wx.setStorageSync('auth', { staff: payload.staff, garden: payload.garden || null })
  },

  clearAuth() {
    this.globalData.staff = null
    this.globalData.garden = null
    wx.removeStorageSync('auth')
  },

  // 未登录时统一跳登录页，返回 false 让调用方中断
  requireLogin() {
    if (this.globalData.staff) return true
    wx.reLaunch({ url: '/pages/login/login' })
    return false
  }
})
