const api = require('../../utils/api')
const app = getApp()

function fmtPhone(p) {
  const s = String(p || '')
  if (s.length !== 11) return s
  return s.slice(0, 3) + ' ' + s.slice(3, 7) + ' ' + s.slice(7)
}

function goByRole() {
  const staff = app.globalData.staff || {}
  if (staff.role === 'admin') {
    wx.reLaunch({ url: '/pages/admin/admin' })
  } else {
    wx.switchTab({ url: '/pages/home/home' })
  }
}

Page({
  data: {
    booting: true,
    stage: 'phone',
    manual: true,
    phone: '',
    phoneText: '',
    gardenKey: '',
    name: '',
    pendingGarden: '',
    loading: false
  },

  onLoad() {
    const last = wx.getStorageSync('lastPhone') || ''
    this.setData({ phone: last })

    // 主动退出后跳过免输入登录，否则会立刻被自动登回去，无法换号
    if (wx.getStorageSync('needManualLogin')) {
      wx.removeStorageSync('needManualLogin')
      this.setData({ booting: false })
      return
    }
    this.silentLogin()
  },

  // 免输入登录：openid 已绑定时直接进对应角色页面
  async silentLogin() {
    try {
      const data = await api.call('login', {})
      if (data && data.authenticated) {
        app.setAuth(data)
        goByRole()
        return
      }
    } catch (e) {
      // 静默登录失败不打扰用户，落到手动输入
    }
    this.setData({ booting: false })
  },

  onShow() {
    if (app.globalData.staff) {
      goByRole()
    }
  },

  onPhoneInput(e) {
    this.setData({ phone: String(e.detail.value || '').replace(/\D/g, '').slice(0, 11) })
  },

  onManualLogin() {
    if (!/^1[3-9]\d{9}$/.test(this.data.phone)) {
      wx.showToast({ title: '请输入 11 位手机号', icon: 'none' })
      return
    }
    this.doLogin({ phone: this.data.phone })
  },

  async doLogin(payload) {
    if (this.data.loading) return
    this.setData({ loading: true })
    wx.showLoading({ title: '登录中', mask: true })

    app.clearAuth()

    try {
      const data = await api.call('login', payload)
      wx.hideLoading()

      if (data.authenticated) {
        app.setAuth(data)
        const used = (data.staff && data.staff.phone) || payload.phone || this.data.phone
        if (used) wx.setStorageSync('lastPhone', used)
        wx.showToast({ title: '登录成功', icon: 'success' })
        this.setData({ loading: false, booting: false })
        goByRole()
        return
      }

      const phone = data.phone || this.data.phone
      if (data.reason === 'PENDING_APPROVAL') {
        this.setData({
          stage: 'pending',
          phone: phone,
          phoneText: fmtPhone(phone),
          pendingGarden: (data.request && data.request.gardenName) || '',
          loading: false,
          booting: false
        })
      } else {
        this.setData({
          stage: 'apply',
          phone: phone,
          phoneText: fmtPhone(phone),
          loading: false,
          booting: false
        })
      }
    } catch (err) {
      wx.hideLoading()
      this.setData({ loading: false, booting: false })
      api.toast(err)
    }
  },

  onKeyInput(e) {
    this.setData({ gardenKey: String(e.detail.value || '').toUpperCase() })
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value })
  },

  async submitApply() {
    const gardenKey = (this.data.gardenKey || '').trim()
    if (!/^GD-\d{4}$/.test(gardenKey)) {
      wx.showToast({ title: '请填写正确的园所码，如 GD-0001', icon: 'none' })
      return
    }
    if (this.data.loading) return
    this.setData({ loading: true })
    wx.showLoading({ title: '提交中', mask: true })

    try {
      const data = await api.call('bindApply', {
        phone: this.data.phone,
        gardenKey: gardenKey,
        name: this.data.name
      })
      wx.hideLoading()
      if (data.status === 'approved' && data.staff) {
        app.setAuth(data)
        this.setData({ loading: false })
        wx.showToast({ title: '绑定成功', icon: 'success' })
        goByRole()
        return
      }
      this.setData({ stage: 'pending', pendingGarden: '', loading: false })
      wx.showToast({ title: '已提交，等待业务员审批', icon: 'none' })
    } catch (err) {
      wx.hideLoading()
      this.setData({ loading: false })
      api.toast(err)
    }
  },

  refresh() {
    if (this.data.phone) this.doLogin({ phone: this.data.phone })
  },

  backToPhone() {
    this.setData({ stage: 'phone', manual: true, gardenKey: '', name: '', pendingGarden: '' })
  }
})
