/* 共享工具：导航高亮、提示、弹窗 */
(function () {
  var page = document.body.dataset.page;
  document.querySelectorAll('.nav a').forEach(function (a) {
    if (a.dataset.page === page) a.classList.add('active');
  });

  // 今日日期
  var dateEl = document.getElementById('today');
  if (dateEl) {
    var d = new Date();
    var w = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
    dateEl.textContent = (d.getMonth() + 1) + '月' + d.getDate() + '日 星期' + w;
  }
})();

function toast(msg) {
  var el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(el._t);
  el._t = setTimeout(function () { el.classList.remove('show'); }, 2200);
}

function openModal(id) {
  var m = document.getElementById(id);
  if (m) m.classList.add('show');
}
function closeModal(id) {
  var m = document.getElementById(id);
  if (m) m.classList.remove('show');
}
document.addEventListener('click', function (e) {
  if (e.target.classList && e.target.classList.contains('modal-mask')) {
    e.target.classList.remove('show');
  }
});
document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') {
    document.querySelectorAll('.modal-mask.show').forEach(function (m) { m.classList.remove('show'); });
  }
});

function money(n) {
  return '¥' + Number(n).toFixed(2);
}
