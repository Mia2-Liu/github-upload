// 云开发环境 ID
const CLOUD_ENV = 'cloud1-d6gd9w5q1c66d7a55'

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

  // 主动退出：除了清登录态，还标记下次进登录页不做免输入登录，方便换账号
  signOut() {
    this.clearAuth()
    wx.setStorageSync('needManualLogin', true)
  },

  // 未登录时统一跳登录页，返回 false 让调用方中断
  requireLogin() {
    if (this.globalData.staff) return true
    wx.reLaunch({ url: '/pages/login/login' })
    return false
  }
})
