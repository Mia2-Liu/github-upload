// 初始化用的种子数据，与原型（allocation_platform / allocation_order）保持一致。
// 手机号统一存 11 位纯数字，展示时前端再格式化。

const crypto = require('crypto')

// 与云函数 api/common.js 的 hashPassword 保持一致
function hashPassword(salt, password) {
  return crypto.createHash('sha256').update(String(salt) + ':' + String(password)).digest('hex')
}

const DEFAULT_ADMIN_PASSWORD = '123456'
const ADMIN_SALT = 'xianda-kindergarten-2026'

const gardens = [
  {
    _id: 'GD-0001',
    name: '阳光幼儿园',
    contact: '李老师',
    route: 'A 线 · 06:00',
    settle: '月结 · 按订单金额',
    open: true,
    phones: [
      { name: '园长李老师', phone: '13800001234', active: true },
      { name: '采购王老师', phone: '13900002233', active: true },
      { name: '保健陈老师', phone: '13700004455', active: true },
      { name: '新老师小周', phone: '13600007788', active: false }
    ],
    createdAt: new Date('2026-01-01T00:00:00+08:00')
  },
  {
    _id: 'GD-0002',
    name: '蓝天幼儿园',
    contact: '张老师',
    route: 'A 线 · 06:20',
    settle: '月结 · 按订单金额',
    open: true,
    phones: [
      { name: '园长张老师', phone: '13900005566', active: true },
      { name: '采购刘老师', phone: '13800006677', active: true },
      { name: '新老师小吴', phone: '13500009911', active: false }
    ],
    createdAt: new Date('2026-01-01T00:00:00+08:00')
  },
  {
    _id: 'GD-0003',
    name: '小太阳幼儿园',
    contact: '王老师',
    route: 'A 线 · 06:40',
    settle: '月结 · 按实发量',
    open: true,
    phones: [
      { name: '园长王老师', phone: '13700001122', active: true },
      { name: '采购赵老师', phone: '13600003344', active: true },
      { name: '保健孙老师', phone: '13500005566', active: false }
    ],
    createdAt: new Date('2026-01-01T00:00:00+08:00')
  },
  {
    _id: 'GD-0004',
    name: '星光幼儿园',
    contact: '刘老师',
    route: 'B 线 · 06:10',
    settle: '月结 · 按订单金额',
    open: true,
    phones: [
      { name: '园长刘老师', phone: '13600008899', active: true },
      { name: '采购周老师', phone: '13300002211', active: false }
    ],
    createdAt: new Date('2026-01-01T00:00:00+08:00')
  },
  {
    _id: 'GD-0005',
    name: '新苗幼儿园',
    contact: '陈老师',
    route: 'B 线 · 06:30',
    settle: '月结 · 按订单金额',
    open: true,
    phones: [
      { name: '园长陈老师', phone: '13500004433', active: true },
      { name: '采购吴老师', phone: '13400006655', active: true },
      { name: '保健郑老师', phone: '13300008877', active: false }
    ],
    createdAt: new Date('2026-01-01T00:00:00+08:00')
  },
  {
    _id: 'GD-0006',
    name: '育才幼儿园',
    contact: '孙老师',
    route: 'B 线 · 06:50',
    settle: '月结 · 按订单金额',
    open: true,
    phones: [
      { name: '园长孙老师', phone: '13300001122', active: true },
      { name: '采购钱老师', phone: '13200003344', active: true },
      { name: '新老师小冯', phone: '13100009900', active: false }
    ],
    createdAt: new Date('2026-01-01T00:00:00+08:00')
  },
  {
    _id: 'GD-0007',
    name: '童星幼儿园',
    contact: '周老师',
    route: 'C 线 · 07:00',
    settle: '月结 · 按订单金额',
    open: true,
    phones: [
      { name: '园长周老师', phone: '13200005566', active: true },
      { name: '采购蒋老师', phone: '13100007788', active: false }
    ],
    createdAt: new Date('2026-01-01T00:00:00+08:00')
  },
  {
    _id: 'GD-0008',
    name: '金太阳幼儿园',
    contact: '赵老师',
    route: 'C 线 · 07:20',
    settle: '月结 · 按订单金额',
    open: true,
    phones: [
      { name: '园长赵老师', phone: '13100002244', active: false }
    ],
    createdAt: new Date('2026-01-01T00:00:00+08:00')
  }
]

const products = [
  { _id: 'P001', name: '土豆', category: 'veg', categoryName: '蔬菜瓜果', spec: '本地中号 · 1 箱 = 40 斤', unit: '斤', price: 3.20, prevPrice: 3.00, boxSize: 40, on: true },
  { _id: 'P002', name: '西红柿', category: 'veg', categoryName: '蔬菜瓜果', spec: '大棚中果 · 1 箱 = 30 斤', unit: '斤', price: 5.60, prevPrice: 5.80, boxSize: 30, on: true },
  { _id: 'P003', name: '上海青', category: 'veg', categoryName: '蔬菜瓜果', spec: '本地新鲜 · 1 筐 = 20 斤', unit: '斤', price: 4.20, prevPrice: 3.60, boxSize: 20, on: true },
  { _id: 'P004', name: '胡萝卜', category: 'veg', categoryName: '蔬菜瓜果', spec: '本地中号 · 1 箱 = 35 斤', unit: '斤', price: 3.80, prevPrice: 3.80, boxSize: 35, on: true },
  { _id: 'P005', name: '苹果', category: 'veg', categoryName: '蔬菜瓜果', spec: '红富士 80# · 1 箱 = 40 斤', unit: '斤', price: 6.50, prevPrice: 6.20, boxSize: 40, on: true },
  { _id: 'P006', name: '香蕉', category: 'veg', categoryName: '蔬菜瓜果', spec: '进口中把 · 1 箱 = 25 斤', unit: '斤', price: 4.80, prevPrice: 5.00, boxSize: 25, on: true },
  { _id: 'P007', name: '婴儿米粉', category: 'baby', categoryName: '辅食', spec: '原味 400g · 1 箱 = 12 袋', unit: '袋', price: 28.00, prevPrice: 28.00, boxSize: 12, on: true },
  { _id: 'P008', name: '宝宝面条', category: 'baby', categoryName: '辅食', spec: '无盐 200g · 1 箱 = 20 袋', unit: '袋', price: 16.50, prevPrice: 16.50, boxSize: 20, on: true },
  { _id: 'P009', name: '鸡蛋', category: 'meat', categoryName: '肉禽蛋', spec: '土鸡蛋 · 1 箱 = 30 斤', unit: '斤', price: 12.00, prevPrice: 11.40, boxSize: 30, on: true },
  { _id: 'P010', name: '鸡胸肉', category: 'meat', categoryName: '肉禽蛋', spec: '冷鲜真空 · 1 箱 = 20 斤', unit: '斤', price: 15.00, prevPrice: 15.00, boxSize: 20, on: true },
  { _id: 'P011', name: '猪肝', category: 'meat', categoryName: '肉禽蛋', spec: '当日冷鲜 · 1 箱 = 10 斤', unit: '斤', price: 18.00, prevPrice: 19.50, boxSize: 10, on: true },
  { _id: 'P012', name: '木耳', category: 'other', categoryName: '干货其他', spec: '东北秋耳 · 1 袋 = 5 斤', unit: '袋', price: 42.00, prevPrice: 42.00, boxSize: 5, on: false }
]

// 管理员手机号可在调用 initDb 时通过 { adminPhone } 覆盖
const admins = [
  { _id: 'admin-1', phone: '15910662043', name: '王经理', role: 'admin', active: true }
]

const settings = [
  {
    _id: 'admin',
    name: '管理员',
    salt: ADMIN_SALT,
    passwordHash: hashPassword(ADMIN_SALT, DEFAULT_ADMIN_PASSWORD),
    isDefaultPassword: true
  }
]

const collections = ['gardens', 'products', 'staff', 'admins', 'bind_requests', 'orders', 'adjustments', 'bills', 'op_logs', 'settings', 'admin_sessions']

module.exports = {
  gardens,
  products,
  admins,
  settings,
  collections,
  hashPassword,
  DEFAULT_ADMIN_PASSWORD
}
