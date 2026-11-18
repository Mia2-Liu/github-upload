function call(action, data) {
  return new Promise(function (resolve, reject) {
    wx.cloud.callFunction({
      name: 'api',
      data: Object.assign({ action: action }, data || {}),
      success: function (res) {
        const r = res.result || {}
        if (r.code === 0) {
          resolve(r.data)
          return
        }
        const err = new Error(r.msg || '请求失败')
        err.code = r.code
        if (r.code === 401) {
          wx.removeStorageSync('auth')
          const app = getApp()
          if (app && app.globalData) {
            app.globalData.staff = null
            app.globalData.garden = null
          }
          wx.reLaunch({ url: '/pages/login/login' })
        }
        reject(err)
      },
      fail: function (e) {
        console.error('[api] callFunction fail:', action, e)
        const err = new Error('网络异常，请稍后重试')
        err.code = -1
        err.raw = e
        reject(err)
      }
    })
  })
}

function toast(err) {
  wx.showToast({ title: (err && err.message) || '操作失败', icon: 'none' })
}

module.exports = { call: call, toast: toast }
