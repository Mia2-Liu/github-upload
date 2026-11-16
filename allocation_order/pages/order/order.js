const api = require('../../utils/api')
const fmt = require('../../utils/format')
const app = getApp()

const CAT_EMOJI = { veg: '🥬', fruit: '🍎', baby: '🥣', meat: '🍗', other: '🥜' }

Page({
  data: {
    categories: [{ key: 'all', name: '全部' }],
    cat: 'all',
    products: [],
    shown: [],
    cart: {},
    count: 0,
    totalText: '0.00',
    dateText: '',
    submitting: false
  },

  onShow() {
    if (!app.requireLogin()) return
    this.setData({ dateText: fmt.dateText(fmt.dateKey(1)) })
    if (!this.data.products.length) this.load()
  },

  async load() {
    wx.showLoading({ title: '加载报价' })
    try {
      const list = await api.call('products')
      const categories = [{ key: 'all', name: '全部' }]
      list.forEach(function (p) {
        if (!categories.some(function (c) { return c.key === p.category })) {
          categories.push({ key: p.category, name: p.categoryName })
        }
      })
      const products = list.map(function (p) {
        return Object.assign({}, p, {
          priceText: Number(p.price || 0).toFixed(2),
          emoji: CAT_EMOJI[p.category] || '🥬'
        })
      })
      this.products = products
      this.setData({ categories: categories, products: products })
      this.applyFilter()
    } catch (err) {
      api.toast(err)
    } finally {
      wx.hideLoading()
    }
  },

  applyFilter() {
    const cat = this.data.cat
    const shown = cat === 'all'
      ? this.data.products
      : this.data.products.filter(function (p) { return p.category === cat })
    this.setData({ shown: shown })
  },

  switchCat(e) {
    this.setData({ cat: e.currentTarget.dataset.key }, this.applyFilter)
  },

  changeQty(e) {
    const id = e.currentTarget.dataset.id
    const delta = Number(e.currentTarget.dataset.delta)
    const cart = Object.assign({}, this.data.cart)
    const next = Math.max(0, (cart[id] || 0) + delta)
    if (next) cart[id] = next
    else delete cart[id]
    this.applyCart(cart)
  },

  applyCart(cart) {
    const self = this
    let count = 0
    let total = 0
    Object.keys(cart).forEach(function (id) {
      const p = self.products.filter(function (x) { return x.productId === id })[0]
      if (!p) return
      count += cart[id]
      total += cart[id] * p.price
    })
    this.setData({ cart: cart, count: count, totalText: total.toFixed(2) })
  },

  async copyLast() {
    if (!this.products || !this.products.length) return
    const self = this
    try {
      const data = await api.call('myOrders', { limit: 1 })
      const last = data.orders[0]
      if (!last) {
        wx.showToast({ title: '还没有历史订单', icon: 'none' })
        return
      }
      const cart = {}
      last.items.forEach(function (it) {
        const exists = self.products.some(function (p) { return p.productId === it.productId })
        if (exists) cart[it.productId] = it.qty
      })
      if (!Object.keys(cart).length) {
        wx.showToast({ title: '上次的商品已全部下架', icon: 'none' })
        return
      }
      this.applyCart(cart)
      wx.showToast({ title: '已复制上次订单', icon: 'none' })
    } catch (err) {
      api.toast(err)
    }
  },

  async submit() {
    const cart = this.data.cart
    const ids = Object.keys(cart)
    if (!ids.length) {
      wx.showToast({ title: '请先选择商品', icon: 'none' })
      return
    }
    if (this.data.submitting) return

    this.setData({ submitting: true })
    wx.showLoading({ title: '提交中', mask: true })
    try {
      const res = await api.call('submitOrder', {
        items: ids.map(function (id) { return { productId: id, qty: cart[id] } })
      })
      wx.hideLoading()
      this.setData({ cart: {}, count: 0, totalText: '0.00' })
      wx.showModal({
        title: '下单成功',
        content: '单号 ' + res.orderNo + '，金额 ¥' + Number(res.amount || 0).toFixed(2),
        showCancel: false,
        success: function () {
          wx.switchTab({ url: '/pages/orders/orders' })
        }
      })
    } catch (err) {
      wx.hideLoading()
      api.toast(err)
    } finally {
      this.setData({ submitting: false })
    }
  }
})
