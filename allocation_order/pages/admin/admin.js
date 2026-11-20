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
    orderStatus: '全部',
    orderStatuses: ['全部', '待分拣', '已分拣', '配送中', '已送达', '已取消'],
    orders: { orderCount: 0, gardenCount: 0, totalAmountText: '0.00', groups: [] },

    // 汇总
    sumDate: '',
    sumDateText: '',
    sumView: 'total',
    totals: { orderCount: 0, gardenCount: 0, amountText: '0.00', itemCount: 0 },
    byProduct: [],
    byGarden: [],
    missingGardens: [],

    // 商品维护
    products: [],

    // 弹窗
    modal: {
      show: false,
      isEdit: false,
      productId: '',
      catIdx: 0,
      catLabel: '',
      catLabels: ['蔬菜瓜果', '辅食', '肉禽蛋', '干货其他'],
      catCodes: ['veg', 'baby', 'meat', 'other'],
      form: { name: '', category: 'veg', categoryName: '蔬菜瓜果', spec: '', unit: '', boxSize: '', price: '' }
    }
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
        success: function () { wx.switchTab({ url: '/pages/home/home' }) }
      })
      self.setData({ isAdmin: false })
      return
    }

    const tomorrow = cstDate(1)
    this.setData({
      isAdmin: true,
      staffName: staff.name || '管理员',
      ordersDate: tomorrow,
      ordersDateText: fmt.dateText(tomorrow),
      sumDate: tomorrow,
      sumDateText: fmt.dateText(tomorrow)
    })
    this.load()
  },

  onPullDownRefresh() { this.load(true) },

  switchTab(e) {
    const tab = e.currentTarget.dataset.tab
    if (tab === this.data.tab) return
    this.setData({ tab: tab })
    this.load()
  },

  switchSumView(e) {
    const view = e.currentTarget.dataset.view
    if (view === this.data.sumView) return
    this.setData({ sumView: view })
  },

  onDateChange(e) {
    const date = String(e.detail.value)
    this.setData({ ordersDate: date, ordersDateText: fmt.dateText(date) })
    this.loadOrders()
  },

  onSumDateChange(e) {
    const date = String(e.detail.value)
    this.setData({ sumDate: date, sumDateText: fmt.dateText(date) })
    this.loadSummary()
  },

  pickOrderStatus(e) {
    const self = this
    wx.showActionSheet({
      itemList: this.data.orderStatuses,
      success: function (res) {
        self.setData({ orderStatus: self.data.orderStatuses[res.tapIndex] })
        self.loadOrders()
      }
    })
  },

  async load(fromPull) {
    if (this.data.loading) return
    this.setData({ loading: true })
    try {
      if (this.data.tab === 'pending') await this.loadPending()
      else if (this.data.tab === 'orders') await this.loadOrders()
      else if (this.data.tab === 'summary') await this.loadSummary()
      else if (this.data.tab === 'products') await this.loadProducts()
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
    const data = await api.call('listOrders', {
      date: this.data.ordersDate,
      status: this.data.orderStatus === '全部' ? '' : this.data.orderStatus
    })
    const groups = (data.groups || []).map(function (g) {
      return {
        gardenKey: g.gardenKey,
        gardenName: g.gardenName,
        orders: (g.orders || []).map(function (o) {
          return {
            orderId: o.orderId,
            orderNo: o.orderNo,
            status: o.status,
            statusKey: o.statusKey || 'pending',
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
    const data = await api.call('dailySummary', { date: this.data.sumDate })
    this.setData({
      sumDate: data.date,
      sumDateText: fmt.dateText(data.date),
      totals: {
        orderCount: data.orderCount || 0,
        gardenCount: data.gardenCount || 0,
        itemCount: (data.totals && data.totals.itemCount) || 0,
        amountText: Number((data.totals && data.totals.amount) || 0).toFixed(2)
      },
      byProduct: (data.byProduct || []).map(function (p) {
        return {
          productId: p.productId,
          name: p.name,
          unit: p.unit,
          qtyText: p.qty + (p.unit || ''),
          gardenCount: p.gardenCount,
          amountText: Number(p.amount || 0).toFixed(2)
        }
      }),
      byGarden: (data.byGarden || []).map(function (g) {
        return {
          gardenKey: g.gardenKey,
          gardenName: g.gardenName,
          orderCount: g.orderCount,
          amountText: Number(g.amount || 0).toFixed(2),
          items: (g.items || []).map(function (it) {
            return { productId: it.productId, name: it.name, unit: it.unit, qtyText: it.qty + (it.unit || '') }
          })
        }
      }),
      missingGardens: (data.missingGardens || []).map(function (g) {
        return { gardenKey: g.gardenKey, gardenName: g.gardenName, route: g.route || '' }
      })
    })
  },

  async loadProducts() {
    const data = await api.call('adminProducts', {})
    const byCat = {}
    ;(data || []).forEach(function (p) {
      const key = p.categoryName || p.category || '其他'
      if (!byCat[key]) byCat[key] = { catName: key, items: [] }
      byCat[key].items.push(p)
    })
    const cats = Object.keys(byCat).sort()
    this.setData({
      products: cats.map(function (k) { return byCat[k] })
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

  async toggleProduct(e) {
    const productId = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name
    const curOn = e.currentTarget.dataset.on === true || e.currentTarget.dataset.on === '1'
    const self = this
    wx.showModal({
      title: curOn ? '下架商品' : '上架商品',
      content: (curOn ? '确认停止销售「' : '确认恢复销售「') + name + '」？',
      success: function (res) {
        if (!res.confirm) return
        self.doToggleProduct(productId)
      }
    })
  },

  async doToggleProduct(productId) {
    wx.showLoading({ title: '处理中', mask: true })
    try {
      await api.call('toggleProduct', { productId: productId })
      wx.hideLoading()
      wx.showToast({ title: '操作成功', icon: 'success' })
      this.loadProducts()
    } catch (err) {
      wx.hideLoading()
      api.toast(err)
    }
  },

  editPrice(e) {
    const productId = e.currentTarget.dataset.id
    const name = e.currentTarget.dataset.name
    const oldPrice = e.currentTarget.dataset.price
    const self = this
    wx.showModal({
      title: '修改报价',
      editable: true,
      placeholderText: '请输入新价格',
      content: String(oldPrice),
      confirmText: '保存',
      success: function (res) {
        if (!res.confirm) return
        const val = Number(res.content)
        if (!isFinite(val) || val <= 0) {
          wx.showToast({ title: '价格无效', icon: 'none' })
          return
        }
        self.doUpdatePrice(productId, name, val)
      }
    })
  },

  async doUpdatePrice(productId, name, price) {
    wx.showLoading({ title: '保存中', mask: true })
    try {
      const res = await api.call('updateProduct', { productId: productId, price: price })
      wx.hideLoading()
      wx.showToast({ title: '¥' + Number(res.to).toFixed(2) + ' 已更新', icon: 'success' })
      this.loadProducts()
    } catch (err) {
      wx.hideLoading()
      api.toast(err)
    }
  },

  openNewProduct() {
    this.setData({
      'modal.show': true,
      'modal.isEdit': false,
      'modal.productId': '',
      'modal.catIdx': 0,
      'modal.catLabel': '蔬菜瓜果',
      'modal.form': { name: '', category: 'veg', categoryName: '蔬菜瓜果', spec: '', unit: '斤', boxSize: '40', price: '' }
    })
  },

  openEditProduct(e) {
    const id = e.currentTarget.dataset.id
    // 从当前 products 列表里找到这条
    let found = null
    const cats = this.data.products
    for (let i = 0; i < cats.length; i++) {
      for (let j = 0; j < cats[i].items.length; j++) {
        if (cats[i].items[j].productId === id) { found = cats[i].items[j]; break }
      }
      if (found) break
    }
    if (!found) return
    const idx = ['veg', 'baby', 'meat', 'other'].indexOf(found.category || 'veg')
    this.setData({
      'modal.show': true,
      'modal.isEdit': true,
      'modal.productId': found.productId,
      'modal.catIdx': idx < 0 ? 0 : idx,
      'modal.catLabel': found.categoryName || '蔬菜瓜果',
      'modal.form': {
        name: found.name || '',
        category: found.category || 'veg',
        categoryName: found.categoryName || '蔬菜瓜果',
        spec: found.spec || '',
        unit: found.unit || '',
        boxSize: String(found.boxSize || ''),
        price: String(found.price || '')
      }
    })
  },

  closeModal() {
    this.setData({ 'modal.show': false })
  },

  onModalInput(e) {
    const key = e.currentTarget.dataset.k
    this.setData({ ['modal.form.' + key]: e.detail.value })
  },

  onCatChange(e) {
    const idx = Number(e.detail.value)
    const label = this.data.modal.catLabels[idx]
    const code = this.data.modal.catCodes[idx]
    this.setData({
      'modal.catIdx': idx,
      'modal.catLabel': label,
      'modal.form.category': code,
      'modal.form.categoryName': label
    })
  },

  async saveModal() {
    const f = this.data.modal.form
    if (!f.name) { wx.showToast({ title: '请填名称', icon: 'none' }); return }
    if (!f.unit) { wx.showToast({ title: '请填单位', icon: 'none' }); return }

    if (this.data.modal.isEdit) {
      // 编辑
      wx.showLoading({ title: '保存中', mask: true })
      try {
        await api.call('editProduct', {
          productId: this.data.modal.productId,
          name: f.name,
          category: f.category,
          categoryName: f.categoryName,
          spec: f.spec,
          unit: f.unit,
          boxSize: Number(f.boxSize) || 1
        })
        wx.hideLoading()
        this.setData({ 'modal.show': false })
        wx.showToast({ title: '已更新', icon: 'success' })
        this.loadProducts()
      } catch (err) { wx.hideLoading(); api.toast(err) }
    } else {
      // 新增
      const price = Number(f.price)
      if (!isFinite(price) || price <= 0) { wx.showToast({ title: '请填价格', icon: 'none' }); return }
      wx.showLoading({ title: '保存中', mask: true })
      try {
        const res = await api.call('createProduct', {
          name: f.name,
          category: f.category,
          categoryName: f.categoryName,
          spec: f.spec,
          unit: f.unit,
          boxSize: Number(f.boxSize) || 1,
          price: price
        })
        wx.hideLoading()
        this.setData({ 'modal.show': false })
        wx.showToast({ title: '已添加 ' + res.productId, icon: 'success' })
        this.loadProducts()
      } catch (err) { wx.hideLoading(); api.toast(err) }
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
