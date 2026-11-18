const api = require('../../utils/api')
const app = getApp()

function fmtPhone(p) {
  const s = String(p || '')
  if (s.length !== 11) return s
  return s.slice(0, 3) + ' ' + s.slice(3, 7) + ' ' + s.slice(7)
}

Page({
  data: {
    stage: 'phone',       // phone | apply | pending
    manual: false,
    phone: '',
    phoneText: '',
    gardenKey: '',
    name: '',
    pendingGarden: '',
    loading: false
  },

  onShow() {
    if (app.globalData.staff) {
      wx.switchTab({ url: '/pages/home/home' })
    }
  },

  // 微信手机号授权（需要非个人主体小程序 + 云调用权限）
  onGetPhone(e) {
    const code = e.detail && e.detail.code
    if (!code) {
      this.setData({ manual: true })
      wx.showToast({ title: '授权未完成，请手动输入手机号', icon: 'none' })
      return
    }
    this.doLogin({ phoneCode: code })
  },

  toggleManual() {
    this.setData({ manual: !this.data.manual })
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

    // 强制清掉旧身份缓存，避免切换手机号时沿用旧 staff
    app.clearAuth()

    try {
      const data = await api.call('login', payload)
      wx.hideLoading()

      if (data.authenticated) {
        app.setAuth(data)
        wx.showToast({ title: '登录成功', icon: 'success' })
        this.setData({ loading: false })
        wx.switchTab({ url: '/pages/home/home' })
        return
      }

      const phone = data.phone || this.data.phone
      if (data.reason === 'PENDING_APPROVAL') {
        this.setData({
          stage: 'pending',
          phone: phone,
          phoneText: fmtPhone(phone),
          pendingGarden: (data.request && data.request.gardenName) || '',
          loading: false
        })
      } else {
        this.setData({
          stage: 'apply',
          phone: phone,
          phoneText: fmtPhone(phone),
          loading: false
        })
      }
    } catch (err) {
      wx.hideLoading()
      this.setData({ loading: false })
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
        wx.switchTab({ url: '/pages/home/home' })
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
