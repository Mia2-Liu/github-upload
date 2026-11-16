/* 管理后台：匿名登录云开发 + 口令换 token + 审批/汇总 */
(function () {
  // 云开发环境 ID，和云函数所在环境一致；留空时页面会要求手动填写
  var ENV_ID = ''

  var TOKEN_KEY = 'xd_admin_token'
  var ENV_KEY = 'xd_admin_env'
  var token = ''
  var app = null

  function resolveEnv() {
    return ENV_ID || localStorage.getItem(ENV_KEY) || ''
  }

  function esc(v) {
    return String(v === undefined || v === null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
  }

  function money(n) {
    return (Number(n) || 0).toFixed(2)
  }

  function fmtTime(v) {
    if (!v) return '-'
    var d = v instanceof Date ? v : new Date(v)
    if (isNaN(d.getTime())) return '-'
    var bj = new Date(d.getTime() + 8 * 3600 * 1000)
    var p = function (n) { return n < 10 ? '0' + n : String(n) }
    return p(bj.getUTCMonth() + 1) + '-' + p(bj.getUTCDate()) + ' ' + p(bj.getUTCHours()) + ':' + p(bj.getUTCMinutes())
  }

  async function getApp() {
    if (!window.cloudbase) throw new Error('CloudBase SDK 加载失败，请检查网络')
    if (!app) {
      app = window.cloudbase.init({ env: resolveEnv() })
      var auth = app.auth({ persistence: 'local' })
      if (!auth.hasLoginState()) {
        await auth.anonymousAuthProvider().signIn()
      }
    }
    return app
  }

  async function call(action, data) {
    var a = await getApp()
    var payload = Object.assign({ action: action }, data || {})
    var res = await a.callFunction({ name: 'api', data: payload })
    var out = (res && res.result) || {}
    if (out.code !== 0) {
      var err = new Error(out.msg || '请求失败')
      err.code = out.code
      throw err
    }
    return out.data
  }

  window.doLogin = async function () {
    var env = resolveEnv()
    if (!env) {
      document.getElementById('envGroup').style.display = 'block'
      document.getElementById('envInput').focus()
      toast('请先填写云开发环境 ID')
      return
    }
    var typedEnv = document.getElementById('envInput').value.trim()
    if (typedEnv) localStorage.setItem(ENV_KEY, typedEnv)

    var pwd = document.getElementById('pwdInput').value.trim()
    if (!pwd) {
      toast('请输入管理口令')
      return
    }

    var btn = document.getElementById('loginBtn')
    btn.disabled = true
    btn.textContent = '登录中…'
    try {
      var d = await call('adminLogin', { password: pwd })
      token = d.token
      localStorage.setItem(TOKEN_KEY, token)
      document.getElementById('pwdInput').value = ''
      showPanel(d.name)
      await loadAll()
    } catch (e) {
      toast(e.message || '登录失败')
    } finally {
      btn.disabled = false
      btn.textContent = '登录'
    }
  }

  window.logout = function () {
    token = ''
    localStorage.removeItem(TOKEN_KEY)
    document.getElementById('adminPanel').style.display = 'none'
    document.getElementById('loginCard').style.display = ''
    document.getElementById('logoutBtn').style.display = 'none'
    document.getElementById('adminName').style.display = 'none'
    document.getElementById('envGroup').style.display = resolveEnv() ? 'none' : 'block'
  }

  function showPanel(name) {
    document.getElementById('loginCard').style.display = 'none'
    document.getElementById('adminPanel').style.display = ''
    var nameEl = document.getElementById('adminName')
    nameEl.textContent = name || '管理员'
    nameEl.style.display = ''
    document.getElementById('logoutBtn').style.display = ''
  }

  async function loadAll() {
    try {
      var results = await Promise.all([
        call('bindRequests', { adminToken: token }),
        call('dailySummary', { adminToken: token })
      ])
      renderRequests(results[0])
      renderSummary(results[1])
    } catch (e) {
      if (e.code === 403 || /权限|登录/.test(e.message || '')) {
        logout()
        toast('登录已过期，请重新登录')
        return
      }
      toast(e.message || '加载失败')
    }
  }
  window.loadAll = loadAll

  function renderRequests(data) {
    var list = (data && data.requests) || []
    document.getElementById('kpiPending').innerHTML = list.length + ' <small>条</small>'
    var body = document.getElementById('pendingBody')
    if (!list.length) {
      body.innerHTML = '<tr><td colspan="5" class="empty-note">暂无待审批申请</td></tr>'
      return
    }
    body.innerHTML = list.map(function (r) {
      return '<tr>' +
        '<td><div class="t-main">' + esc(r.name || '未填写') + '</div></td>' +
        '<td>' + esc(r.phone) + '</td>' +
        '<td><div class="t-main">' + esc(r.gardenName) + '</div><div class="t-sub">' + esc(r.gardenKey) + '</div></td>' +
        '<td>' + fmtTime(r.createdAt) + '</td>' +
        '<td class="num">' +
          '<button class="btn btn-sm btn-primary" onclick="reviewBind(\'' + esc(r.requestId) + '\', true)">通过</button> ' +
          '<button class="btn btn-sm" onclick="reviewBind(\'' + esc(r.requestId) + '\', false)">拒绝</button>' +
        '</td>' +
        '</tr>'
    }).join('')
  }

  function renderSummary(data) {
    var sum = data || {}
    var totals = sum.totals || {}
    var missing = sum.missingGardens || []

    document.getElementById('kpiOrders').innerHTML = (sum.orderCount || 0) + ' <small>单</small>'
    document.getElementById('kpiDate').textContent = sum.date || '-'
    document.getElementById('kpiAmount').innerHTML = money(totals.amount) + ' <small>元</small>'
    document.getElementById('kpiMissing').innerHTML = missing.length + ' <small>家</small>'
    document.getElementById('summaryHint').textContent =
      (sum.date || '-') + ' · ' + (sum.gardenCount || 0) + ' 家园所 · ' + (totals.itemCount || 0) + ' 个品'

    var products = sum.byProduct || []
    var pBody = document.getElementById('productBody')
    if (!products.length) {
      pBody.innerHTML = '<tr><td colspan="5" class="empty-note">还没有园所下单</td></tr>'
    } else {
      pBody.innerHTML = products.map(function (p) {
        return '<tr>' +
          '<td><div class="t-main">' + esc(p.name) + '</div></td>' +
          '<td>' + esc(p.unit) + '</td>' +
          '<td class="num">' + esc(p.qty) + '</td>' +
          '<td class="num">' + esc(p.gardenCount) + '</td>' +
          '<td class="num">' + money(p.amount) + '</td>' +
          '</tr>'
      }).join('')
    }

    var gardens = sum.byGarden || []
    var gBody = document.getElementById('gardenBody')
    if (!gardens.length) {
      gBody.innerHTML = '<tr><td colspan="5" class="empty-note">还没有园所下单</td></tr>'
    } else {
      gBody.innerHTML = gardens.map(function (g) {
        var statuses = Object.keys(g.statuses || {}).map(function (k) {
          return '<span class="tag-soft">' + esc(k) + ' ' + esc(g.statuses[k]) + '</span>'
        }).join(' ')
        return '<tr>' +
          '<td><div class="t-main">' + esc(g.gardenName) + '</div></td>' +
          '<td>' + esc(g.gardenKey) + '</td>' +
          '<td class="num">' + esc(g.orderCount) + '</td>' +
          '<td class="num">' + money(g.amount) + '</td>' +
          '<td>' + (statuses || '-') + '</td>' +
          '</tr>'
      }).join('')
    }

    document.getElementById('missingNote').textContent = missing.length
      ? '未下单：' + missing.map(function (m) { return m.gardenName + '（' + m.gardenKey + '）' }).join('、')
      : '所有在用园所都已下单。'
  }

  window.reviewBind = async function (requestId, approve) {
    var tip = approve ? '通过后该手机号会加入园所白名单，确认通过？' : '确认拒绝这条绑定申请？'
    if (!window.confirm(tip)) return
    try {
      await call('reviewBind', { adminToken: token, requestId: requestId, approve: approve })
      toast(approve ? '已通过，白名单已更新' : '已拒绝')
      await loadAll()
    } catch (e) {
      if (e.code === 403) {
        logout()
        toast('登录已过期，请重新登录')
        return
      }
      toast(e.message || '操作失败')
    }
  }

  // 初始化
  var savedEnv = resolveEnv()
  document.getElementById('envGroup').style.display = savedEnv ? 'none' : 'block'
  if (savedEnv) document.getElementById('envInput').value = savedEnv
  document.getElementById('pwdInput').addEventListener('keydown', function (e) {
    if (e.key === 'Enter') window.doLogin()
  })

  var savedToken = localStorage.getItem(TOKEN_KEY)
  if (savedToken) {
    token = savedToken
    showPanel('管理员')
    loadAll()
  }
})()
