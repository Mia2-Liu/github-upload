var PRODUCTS = [
  { n: '土豆',      c: 'veg',   emoji: '🥔', price: 3.20,  unit: '斤', spec: '本地中号 · 今日到货', last: 30 },
  { n: '西红柿',    c: 'veg',   emoji: '🍅', price: 5.60,  unit: '斤', spec: '大棚中果 · 新鲜', last: 20 },
  { n: '上海青',    c: 'veg',   emoji: '🥬', price: 4.20,  unit: '斤', spec: '本地 · 清晨采摘', last: 15 },
  { n: '胡萝卜',    c: 'veg',   emoji: '🥕', price: 3.80,  unit: '斤', spec: '本地中号', last: 12 },
  { n: '苹果',      c: 'fruit', emoji: '🍎', price: 6.50,  unit: '斤', spec: '红富士 80#', last: 25 },
  { n: '香蕉',      c: 'fruit', emoji: '🍌', price: 4.80,  unit: '斤', spec: '进口中把', last: 18 },
  { n: '鸡蛋',      c: 'meat',  emoji: '🥚', price: 12.00, unit: '斤', spec: '土鸡蛋 · 当日', last: 10 },
  { n: '鸡胸肉',    c: 'meat',  emoji: '🍗', price: 15.00, unit: '斤', spec: '冷鲜真空', last: 8 },
  { n: '婴儿米粉',  c: 'baby',  emoji: '🥣', price: 28.00, unit: '袋', spec: '原味 400g', last: 6 },
  { n: '宝宝面条',  c: 'baby',  emoji: '🍜', price: 16.50, unit: '袋', spec: '无盐 200g', last: 4 }
];

var ORDERS = [
  {
    no: '20261116002', date: '11月16日 16:20', status: '配送中',
    items: [{ n: '土豆', q: 30, u: '斤', p: 3.20 }, { n: '上海青', q: 15, u: '斤', p: 4.20 }, { n: '苹果', q: 25, u: '斤', p: 6.50 }]
  },
  {
    no: '20261115001', date: '11月15日 16:05', status: '已送达',
    items: [{ n: '西红柿', q: 18, u: '斤', p: 5.60 }, { n: '鸡蛋', q: 10, u: '斤', p: 12.00 }, { n: '香蕉', q: 20, u: '斤', p: 4.80 }]
  },
  {
    no: '20261114003', date: '11月14日 15:50', status: '已送达',
    items: [{ n: '婴儿米粉', q: 6, u: '袋', p: 28.00 }, { n: '鸡胸肉', q: 8, u: '斤', p: 15.00 }, { n: '胡萝卜', q: 12, u: '斤', p: 3.80 }]
  }
];

var state = { tab: 'home', cat: 'all', cart: {}, ofilter: '全部' };

function amountOf(order) {
  return order.items.reduce(function (s, it) { return s + it.q * it.p; }, 0);
}
function cartCount() {
  return Object.keys(state.cart).reduce(function (s, k) { return s + state.cart[k]; }, 0);
}
function cartTotal() {
  return Object.keys(state.cart).reduce(function (s, k) { return s + state.cart[k] * PRODUCTS[k].price; }, 0);
}

function statusTag(s) {
  if (s === '已送达') return '<span class="tag green">已送达</span>';
  if (s === '配送中') return '<span class="tag brand">配送中</span>';
  return '<span class="tag amber">待配送</span>';
}

/* ---------- 首页 ---------- */
function homeView() {
  var recent = ORDERS.slice(0, 2).map(function (o, i) {
    return '<div class="row-item" data-act="order-detail" data-i="' + i + '" style="cursor:pointer">' +
      '<div class="p-thumb">🧺</div>' +
      '<div class="row-main"><div class="n">' + o.items.length + ' 个品 · ' + amountOf(o).toFixed(2) + ' 元</div>' +
      '<div class="s">' + o.date + ' · 单号 ' + o.no.slice(-4) + '</div></div>' +
      '<div class="row-val">' + statusTag(o.status) + '</div>' +
    '</div>';
  }).join('');

  return '' +
    '<div class="hero">' +
      '<div class="hello">早上好，李老师</div>' +
      '<div class="school">阳光幼儿园</div>' +
      '<div class="deliver">' +
        '<div><b>明天 07:30 前送达</b><span>11月17日 · 共 8 家园所同路线</span></div>' +
        '<button class="go" data-act="go-order">去下单</button>' +
      '</div>' +
    '</div>' +
    '<div class="notice"><span class="tag amber">提醒</span><span>明天还没下单，今天 16:00 截单，别忘啦</span></div>' +
    '<div class="sec">' +
      '<div class="quick">' +
        '<button data-act="go-order"><div class="qi">🧾</div>下单</button>' +
        '<button data-act="go-orders"><div class="qi">📦</div>我的订单</button>' +
        '<button data-act="go-mine"><div class="qi">💳</div>本月账单</button>' +
        '<button data-act="call"><div class="qi">📞</div>联系业务员</button>' +
      '</div>' +
    '</div>' +
    '<div class="sec">' +
      '<div class="sec-title">最近订单<small data-act="go-orders" style="cursor:pointer">全部 ›</small></div>' +
      recent +
      '<div style="height:8px"></div>' +
    '</div>' +
    '<div class="sec">' +
      '<div class="sec-title">今日推荐<small>按今日报价</small></div>' +
      '<div class="row-item"><div class="p-thumb">🥬</div><div class="row-main"><div class="n">本地上海青</div><div class="s">清晨采摘 · 4.20 元/斤</div></div><div class="row-val"><span class="tag green">新鲜</span></div></div>' +
      '<div class="row-item"><div class="p-thumb">🍎</div><div class="row-main"><div class="n">红富士苹果</div><div class="s">脆甜多汁 · 6.50 元/斤</div></div><div class="row-val"><span class="tag green">新鲜</span></div></div>' +
      '<div style="height:8px"></div>' +
    '</div>';
}

/* ---------- 下单 ---------- */
function orderView() {
  var cats = [
    { k: 'all', t: '全部' }, { k: 'veg', t: '蔬菜' }, { k: 'fruit', t: '水果' },
    { k: 'baby', t: '辅食' }, { k: 'meat', t: '肉禽蛋' }
  ];
  var catBar = cats.map(function (c) {
    return '<button data-act="cat" data-cat="' + c.k + '" class="' + (state.cat === c.k ? 'on' : '') + '">' + c.t + '</button>';
  }).join('');

  var items = PRODUCTS.map(function (p, i) { return { p: p, i: i }; })
    .filter(function (x) { return state.cat === 'all' || x.p.c === state.cat; })
    .map(function (x) {
      var q = state.cart[x.i] || 0;
      return '<div class="p-item">' +
        '<div class="p-thumb">' + x.p.emoji + '</div>' +
        '<div class="p-info"><div class="n">' + x.p.n + '</div><div class="s">' + x.p.spec + '</div>' +
          '<div class="pr">' + x.p.price.toFixed(2) + '<small>元/' + x.p.unit + '</small></div></div>' +
        '<div class="step">' +
          (q > 0 ? '<button data-act="minus" data-i="' + x.i + '">−</button><span class="q">' + q + '</span>' : '') +
          '<button class="plus" data-act="plus" data-i="' + x.i + '">＋</button>' +
        '</div>' +
      '</div>';
    }).join('');

  return '' +
    '<div class="cats">' + catBar + '</div>' +
    '<div class="repeat-bar"><span class="note">明天 11月17日 · 16:00 截单</span>' +
      '<button class="btn-mini" data-act="repeat">复制上次订单</button></div>' +
    items +
    '<div style="height:12px"></div>';
}

/* ---------- 订单 ---------- */
function ordersView() {
  var filters = ['全部', '待配送', '配送中', '已送达'];
  var bar = filters.map(function (f) {
    return '<button data-act="ofilter" data-f="' + f + '" class="' + (state.ofilter === f ? 'on' : '') + '">' + f + '</button>';
  }).join('');

  var list = ORDERS.map(function (o, i) { return { o: o, i: i }; })
    .filter(function (x) { return state.ofilter === '全部' || x.o.status === state.ofilter; })
    .map(function (x) {
      var names = x.o.items.map(function (it) { return it.n; }).join('、');
      return '<div class="order-card">' +
        '<div class="order-top"><span class="no">' + x.o.no + '</span>' + statusTag(x.o.status) + '</div>' +
        '<div class="order-mid">' + names + (x.o.items.length > 3 ? ' 等' : '') + '</div>' +
        '<div class="order-mid sm muted">' + x.o.date + ' 下单 · ' + x.o.items.length + ' 个品</div>' +
        '<div class="order-bot"><span class="money">' + amountOf(x.o).toFixed(2) + '</span>' +
          '<button class="link-btn" data-act="order-detail" data-i="' + x.i + '">查看明细 ›</button></div>' +
      '</div>';
    }).join('');

  return '<div class="cats">' + bar + '</div>' +
    (list || '<div style="padding:60px 0;text-align:center;color:var(--muted);font-size:13px">这个状态下还没有订单</div>');
}

/* ---------- 我的 ---------- */
function mineView() {
  return '' +
    '<div style="height:16px"></div>' +
    '<div class="me-card">' +
      '<div class="me-avatar">阳</div>' +
      '<div><div class="me-name">阳光幼儿园</div><div class="me-sub">月结客户 · 联系人 李老师</div></div>' +
    '</div>' +
    '<div class="sec">' +
      '<div class="sec-title">11月账单<small>账期 11-01 至 11-15</small></div>' +
      '<div class="bill-box">' +
        '<div class="bill-line"><span class="muted sm">本期应收</span><span class="bill-big">8,553.60</span></div>' +
        '<div class="bill-meta">' +
          '<div>订单金额<b>8,640.00</b></div>' +
          '<div>差异调整<b style="color:var(--red)">-86.40</b></div>' +
          '<div>已收<b>0.00</b></div>' +
        '</div>' +
        '<div style="margin-top:14px"><button class="btn-mini solid" data-act="bill">查看账单明细</button></div>' +
      '</div>' +
    '</div>' +
    '<div class="sec">' +
      '<div class="sec-title">本月用量 Top 3<small>斤</small></div>' +
      '<div class="bar-row">' +
        '<div class="bar-line"><span class="nm">土豆</span><span class="tr"><i style="width:100%"></i></span><span class="vv">260</span></div>' +
        '<div class="bar-line"><span class="nm">苹果</span><span class="tr"><i style="width:81%"></i></span><span class="vv">210</span></div>' +
        '<div class="bar-line"><span class="nm">鸡蛋</span><span class="tr"><i style="width:69%"></i></span><span class="vv">180</span></div>' +
      '</div>' +
    '</div>' +
    '<div class="sec">' +
      '<div class="row-item"><div class="p-thumb">📞</div><div class="row-main"><div class="n">业务员 王经理</div><div class="s">138 0000 1234 · 有问题随时找</div></div><div class="row-val"><button class="link-btn" data-act="call">拨打</button></div></div>' +
      '<div class="row-item"><div class="p-thumb">🕘</div><div class="row-main"><div class="n">配送时间</div><div class="s">每天 07:30 前送达</div></div><div class="row-val muted sm">固定</div></div>' +
      '<div class="row-item"><div class="p-thumb">🔐</div><div class="row-main"><div class="n">账号</div><div class="s">李老师 · ' + gardenName() + '（手机号已认证）</div></div><div class="row-val"><button class="link-btn" data-act="logout">退出</button></div></div>' +
      '<div style="height:8px"></div>' +
    '</div>';
}

/* ---------- 渲染 ---------- */
function render() {
  var titles = { home: '鲜达配送', order: '下单', orders: '我的订单', mine: '我的' };
  document.getElementById('navTitle').textContent = titles[state.tab];

  var view = document.getElementById('view');
  if (state.tab === 'home') view.innerHTML = homeView();
  else if (state.tab === 'order') view.innerHTML = orderView();
  else if (state.tab === 'orders') view.innerHTML = ordersView();
  else view.innerHTML = mineView();

  document.querySelectorAll('.mp-tabbar button').forEach(function (b) {
    b.classList.toggle('active', b.dataset.tab === state.tab);
  });

  var bar = document.getElementById('cartbar');
  if (state.tab === 'order') {
    bar.style.display = 'flex';
    var c = cartCount(), t = cartTotal();
    document.getElementById('cartSum').textContent = c ? '已选 ' + c + ' 件' : '还没选菜';
    document.getElementById('cartAmt').textContent = '¥' + t.toFixed(2);
    document.getElementById('cartGo').disabled = c === 0;
  } else {
    bar.style.display = 'none';
  }
  view.scrollTop = 0;
}

/* ---------- 交互 ---------- */
document.querySelector('.mp-tabbar').addEventListener('click', function (e) {
  var b = e.target.closest('button[data-tab]');
  if (!b) return;
  state.tab = b.dataset.tab;
  render();
});

document.getElementById('view').addEventListener('click', function (e) {
  var el = e.target.closest('[data-act]');
  if (!el) return;
  var act = el.dataset.act;

  if (act === 'go-order') { state.tab = 'order'; render(); }
  else if (act === 'go-orders') { state.tab = 'orders'; render(); }
  else if (act === 'go-mine') { state.tab = 'mine'; render(); }
  else if (act === 'cat') { state.cat = el.dataset.cat; render(); }
  else if (act === 'ofilter') { state.ofilter = el.dataset.f; render(); }
  else if (act === 'plus') {
    var i = parseInt(el.dataset.i, 10);
    state.cart[i] = (state.cart[i] || 0) + 1;
    render();
  } else if (act === 'minus') {
    var k = parseInt(el.dataset.i, 10);
    state.cart[k] = Math.max(0, (state.cart[k] || 0) - 1);
    if (!state.cart[k]) delete state.cart[k];
    render();
  } else if (act === 'repeat') {
    state.cart = {};
    PRODUCTS.forEach(function (p, idx) { state.cart[idx] = p.last; });
    render();
    toast('已复制上次订单，共 ' + cartCount() + ' 件');
  } else if (act === 'order-detail') {
    showOrderSheet(parseInt(el.dataset.i, 10));
  } else if (act === 'bill') {
    showBillSheet();
  } else if (act === 'call') {
    toast('正在拨打 138 0000 1234');
  } else if (act === 'logout') {
    try { localStorage.removeItem('xd_bound'); } catch (err) {}
    state.tab = 'home';
    switchLogin('main');
    render();
    showLogin(true);
  }
});

document.getElementById('cartGo').addEventListener('click', function () {
  if (cartCount() === 0) return;
  var items = Object.keys(state.cart).map(function (k) {
    var p = PRODUCTS[k];
    return { n: p.n, q: state.cart[k], u: p.unit, p: p.price };
  });
  var now = new Date();
  ORDERS.unshift({
    no: '2026' + String(now.getMonth() + 1).padStart(2, '0') + String(now.getDate()).padStart(2, '0') + '001',
    date: (now.getMonth() + 1) + '月' + now.getDate() + '日 ' +
      String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'),
    status: '待配送',
    items: items
  });
  state.cart = {};
  state.ofilter = '全部';
  state.tab = 'orders';
  render();
  toast('下单成功，已按今日报价锁价');
});

/* ---------- 明细弹层 ---------- */
function showOrderSheet(i) {
  var o = ORDERS[i];
  var rows = o.items.map(function (it) {
    return '<div class="dline"><span>' + it.n + ' × ' + it.q + ' ' + it.u + '</span><span>' + (it.q * it.p).toFixed(2) + '</span></div>';
  }).join('');
  var html = '<div class="sheet-head"><span>订单 ' + o.no + '</span><button data-act="close">×</button></div>' +
    '<div class="sheet-body">' +
      '<div class="dline"><span>下单时间</span><span>' + o.date + '</span></div>' +
      '<div class="dline"><span>配送时间</span><span>次日 07:30 前</span></div>' +
      '<div class="dline"><span>状态</span><span>' + o.status + '</span></div>' +
      '<div style="height:6px"></div>' + rows +
      '<div class="dline"><span style="font-weight:600">合计</span><span style="font-weight:600">' + amountOf(o).toFixed(2) + '</span></div>' +
    '</div>' +
    '<div class="sheet-foot"><button data-act="close">关闭</button><button class="primary" data-act="call">联系业务员</button></div>';
  openSheet(html);
}

function showBillSheet() {
  var html = '<div class="sheet-head"><span>11月账单</span><button data-act="close">×</button></div>' +
    '<div class="sheet-body">' +
      '<div class="dline"><span>账期</span><span>11-01 至 11-15</span></div>' +
      '<div class="dline"><span>订单金额（锁价）</span><span>8,640.00</span></div>' +
      '<div class="dline"><span>差异调整</span><span style="color:var(--red)">-86.40</span></div>' +
      '<div class="dline"><span>应收合计</span><span style="font-weight:600">8,553.60</span></div>' +
      '<div class="dline"><span>已收款</span><span>0.00</span></div>' +
      '<div style="margin-top:12px" class="sm muted">差异来自 3 笔：上海青少送 2 斤、西红柿少送 1 斤、苹果加送 2 斤。</div>' +
    '</div>' +
    '<div class="sheet-foot"><button data-act="close">关闭</button><button class="primary" data-act="call">有疑问，联系业务员</button></div>';
  openSheet(html);
}

function openSheet(html) {
  document.getElementById('sheet').innerHTML = html;
  document.getElementById('sheetMask').classList.add('show');
}
document.getElementById('sheetMask').addEventListener('click', function (e) {
  if (e.target.id === 'sheetMask' || e.target.closest('[data-act="close"]')) {
    document.getElementById('sheetMask').classList.remove('show');
  }
});

function toast(msg) {
  var el = document.getElementById('mpToast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(function () { el.classList.remove('show'); }, 2000);
}

function isBound() {
  try { return localStorage.getItem('xd_bound') === '1'; } catch (e) { return false; }
}
function gardenName() {
  try { return localStorage.getItem('xd_garden') || '阳光幼儿园'; } catch (e) { return '阳光幼儿园'; }
}
function showLogin(v) {
  document.getElementById('login').classList.toggle('show', v);
}
function switchLogin(which) {
  document.getElementById('loginMain').style.display = which === 'main' ? '' : 'none';
  document.getElementById('loginBind').style.display = which === 'bind' ? '' : 'none';
  document.getElementById('loginPending').style.display = which === 'pending' ? '' : 'none';
}
function bindGarden(name) {
  try {
    localStorage.setItem('xd_bound', '1');
    localStorage.setItem('xd_garden', name);
  } catch (e) {}
  switchLogin('main');
  showLogin(false);
  render();
  toast('已登录 · ' + name);
}

document.getElementById('login').addEventListener('click', function (e) {
  var b = e.target.closest('[data-act]');
  if (!b) return;
  var act = b.dataset.act;
  if (act === 'wx-phone') {
    bindGarden('阳光幼儿园');
  } else if (act === 'to-bind') {
    switchLogin('bind');
  } else if (act === 'back-main') {
    switchLogin('main');
  } else if (act === 'apply-bind') {
    var code = document.getElementById('bindCode').value.trim().toUpperCase();
    var phone = document.getElementById('bindPhone').value.replace(/\s/g, '');
    if (!/^GD-\d{4}$/.test(code)) { toast('园所码格式如 GD-0008'); return; }
    if (!/^1\d{10}$/.test(phone)) { toast('请输入 11 位手机号'); return; }
    switchLogin('pending');
  }
});

render();
showLogin(!isBound());
