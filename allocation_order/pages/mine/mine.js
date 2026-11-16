const fmt = require('../../utils/format')
const app = getApp()

Page({
  data: {
    staff: {},
    garden: {},
    phoneText: '',
    avatarText: '园'
  },

  onShow() {
    if (!app.requireLogin()) return
    const staff = app.globalData.staff || {}
    const garden = app.globalData.garden || {}
    this.setData({
      staff: staff,
      garden: garden,
      phoneText: fmt.fmtPhone(staff.phone),
      avatarText: garden.name ? garden.name.slice(0, 1) : '园'
    })
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
