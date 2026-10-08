/* =========================================================================
   智能编排 原型 · 数据层
   所有数据均从现网截图（2026-09-28 ACC 环境）转录，用于静态原型演示。
   ========================================================================= */

/* --------------------------- 老引擎兼容兜底 ---------------------------
   Array.prototype.flat / flatMap 是 ES2019。部分内嵌浏览器（微信、钉钉、
   企业微信、Outlook 的附件预览，以及旧版 WebView）没有这两个方法。
   本文件里视图层用了 7 处，缺了会在渲染主视图时抛 "flat is not a function"，
   现象是侧边菜单正常出现、主内容区一片空白 —— 因为渲染菜单不经过 flat。
   这里补上最小实现，顺序必须在 app.js 之前（源文件里已保证）。 */
if (!Array.prototype.flat) {
  Object.defineProperty(Array.prototype, 'flat', {
    configurable: true,
    writable: true,
    value: function flat(depth) {
      var limit = depth === undefined ? 1 : Number(depth) || 0;
      var out = [];
      (function walk(arr, left) {
        for (var i = 0; i < arr.length; i++) {
          if (!(i in arr)) continue;              // 跳过空洞，与原生一致
          var v = arr[i];
          if (left > 0 && Array.isArray(v)) walk(v, left - 1);
          else out.push(v);
        }
      })(this, limit);
      return out;
    },
  });
}

if (!Array.prototype.flatMap) {
  Object.defineProperty(Array.prototype, 'flatMap', {
    configurable: true,
    writable: true,
    value: function flatMap(cb, thisArg) {
      return this.map(cb, thisArg).flat();
    },
  });
}

/* ------------------------------ 图标 ------------------------------ */
const ICONS = {
  home: 'M3 10.5 12 3l9 7.5M5.5 9.3V20h13V9.3',
  report: 'M6 3h8l4 4v14H6zM14 3v4h4M9 12h6M9 16h6',
  team: 'M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7ZM2.5 20c0-3.3 2.9-5.5 6.5-5.5s6.5 2.2 6.5 5.5M16.5 11.5a3 3 0 1 0 0-6M17 14.6c2.6.4 4.5 2.3 4.5 5.4',
  device: 'M5 3h14v18H5zM9 3v18M15 3v18',
  schedule: 'M4 5h16v16H4zM4 9h16M8 3v4M16 3v4M8 13h3M8 17h3M14 13h2',
  repair: 'M14.7 6.3a4 4 0 1 0 3 6.9l5.6 5.6-2.1 2.1-5.6-5.6a4 4 0 0 1-6.9-3M3 21l6-6',
  inspect: 'M11 4a7 7 0 1 0 0 14 7 7 0 0 0 0-14ZM16 16l5 5',
  order: 'M7 3h10v18H7zM10 8h4M10 12h4M10 16h2',
  task: 'M4 6h16M4 12h16M4 18h10M18.5 16.5l2 2 3-3',
  audit: 'M12 3 3 7v5c0 5 3.8 8.4 9 9 5.2-.6 9-4 9-9V7zM8.5 12l2.5 2.5L16 9.5',
  message: 'M4 5h16v11H9l-5 4z',
  complaint: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM12 8v5M12 16h.01',
  part: 'M12 2 3 7v10l9 5 9-5V7zM3 7l9 5 9-5M12 12v10',
  partOrder: 'M4 4h3l2.5 12h9L21 8H7M9.5 20a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4ZM18 20a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4Z',
  monitor: 'M3 4h18v12H3zM8 20h8M12 16v4',
  accept: 'M4 5h16v16H4zM8 12.5l3 3 5-6',
  // KPI 卡片图标
  kpiOrders: 'M4 6h10M4 12h16M4 18h10M17 5l3 3-3 3',
  kpiLayers: 'M12 3 3 7.5l9 4.5 9-4.5zM3 12.5 12 17l9-4.5M3 17 12 21.5 21 17',
  kpiHours: 'M6 3h9l4 4v14H6zM15 3v4h4M9 12h7M9 16h5',
  kpiBalance: 'M20.5 12a8.5 8.5 0 1 1-2.6-6.1M20.5 4v5h-5',
  elevator: 'M6 2h12v20H6zM12 2v20M9 7l-1.5 2h3zM15 17l1.5-2h-3z',
  // 错误态：圆圈 + 叉
  errorCircle: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18ZM15 9l-6 6M9 9l6 6',
};

/* ------------------------------ 左侧菜单 ------------------------------ */
const MENU = [
  { key: 'home', icon: 'home', label: '首页' },
  { key: 'report', icon: 'report', label: '报告中心', children: [] },
  { key: 'team', icon: 'team', label: '团队管理', children: [] },
  {
    key: 'device', icon: 'device', label: '设备管理', open: true,
    children: [
      { key: 'device-claim', label: '设备认领' },
      { key: 'device-mine', label: '我的设备' },
    ],
  },
  {
    key: 'sched', icon: 'schedule', label: '编排管理', open: true,
    children: [
      { key: 'sched-first', label: '首次编排' },
      { key: 'sched-adjust', label: '编排调整' },
      { key: 'sched-apply', label: '编排申请' },
      { key: 'sched-smart', label: '智能编排', active: true },
    ],
  },
  { key: 'repair', icon: 'repair', label: '走修管理', children: [] },
  { key: 'inspect', icon: 'inspect', label: '检验检测', children: [] },
  { key: 'order', icon: 'order', label: '工单管理', children: [] },
  { key: 'task', icon: 'task', label: '专项任务', children: [] },
  { key: 'audit', icon: 'audit', label: '工地审核', children: [] },
  { key: 'message', icon: 'message', label: '消息通知', children: [] },
  { key: 'complaint', icon: 'complaint', label: '投诉与咨询', children: [] },
  { key: 'part', icon: 'part', label: '备件管理' },
  { key: 'partOrder', icon: 'partOrder', label: '备件订单管理' },
  { key: 'monitor', icon: 'monitor', label: '政府对接消息监控' },
  { key: 'accept', icon: 'accept', label: '验收工单' },
];

/* ------------------------------ KPI 指标条 ------------------------------ */
const STATS_CURRENT = [
  { icon: 'kpiOrders', lines: ['总保养工单数'], value: '548个' },
  { icon: 'kpiLayers', lines: ['最大人均保养量（剔除实习生）', '最大人均保养量'], value: '10.2台/10.2台' },
  { icon: 'kpiHours', lines: ['最大人均计划工时（剔除实习生）', '最大人均工时'], value: '12.98小时/12.98小时' },
  { icon: 'kpiBalance', lines: ['工作量分布'], tags: [{ text: '轻松 11 天', tone: 'easy' }, { text: '繁重 8 天', tone: 'busy' }] },
];

/* 注意：「工作量分布」的两个天数是占位值，实际由 app.js 的 statsFor() 依据
   当前档位（4周 / 8周 / 13周）的可视范围实时统计后覆盖，因此始终与日历上的
   绿格、橙格数量严格相等，不需要手工维护。
   其余三项无法从日格推导，保持静态。 */
const STATS_PLAN = [
  { icon: 'kpiOrders', lines: ['总保养工单数'], value: '623个' },
  { icon: 'kpiLayers', lines: ['最大人均保养量（剔除实习生）', '最大人均保养量'], value: '16.6台/16.6台' },
  { icon: 'kpiHours', lines: ['最大人均计划工时（剔除实习生）', '最大人均工时'], value: '17.54小时/17.54小时' },
  { icon: 'kpiBalance', lines: ['工作量分布'], tags: [{ text: '轻松 10 天', tone: 'easy' }, { text: '繁重 4 天', tone: 'busy' }] },
];

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

/* 日历周期筛选：全站统一这三档，并映射到实际周数 */
const WEEK_OPTIONS = ['4周', '8周', '13周'];
const WEEK_OPTION_WEEKS = { '4周': 4, '8周': 8, '13周': 13 };
const MAX_WEEKS = 13;

/* 编排计划起始日：2026-10-01。日历不再包含 9 月 —— 起始日所在周里
   10月1日之前的格子（9/27~9/30）渲染为空格，月份列从 10月 起。
   注意：系统当天是 9月28日，已不在范围内，因此不会出现「今」标记。 */
const CAL_START_DATE = [2026, 10, 1];

/* 截图只提供了前 4 周数据。8周 / 13周 视图所需的后续周次，按 14 天保养间隔的
   双周节律循环复用前 4 周的日值生成 —— 完全确定性，不使用随机数，便于回归测试。
   日期一律由真实日历推算，并在每格写入 _m / _y，左侧月份列据此按整月合并。 */
function buildCalendar(baseWeeks, totalWeeks) {
  const [y0, m0, d0] = CAL_START_DATE;
  const start = new Date(y0, m0 - 1, d0);
  /* 网格按周对齐：从起始日所在周的周日排起，早于起始日的格子留空 */
  const gridStart = new Date(y0, m0 - 1, d0 - start.getDay());

  const rows = [];
  for (let w = 0; w < totalWeeks; w++) {
    const src = baseWeeks[w % baseWeeks.length];
    const row = [];
    for (let i = 0; i < 7; i++) {
      const dt = new Date(gridStart.getFullYear(), gridStart.getMonth(),
        gridStart.getDate() + w * 7 + i);
      if (dt < start) { row.push({ blank: true }); continue; }
      const cell = Object.assign({}, src[i], {
        d: dt.getDate(), _m: dt.getMonth() + 1, _y: dt.getFullYear(),
      });
      // 「今」与预选格只属于真实当周，复制出去的周次要清掉
      if (w >= baseWeeks.length) { delete cell.today; delete cell.selected; }
      row.push(cell);
    }
    rows.push(row);
  }
  return rows;
}

/* ------------------------------ 当前日历（截图 9） ------------------------------ */
/* u = 台数, h = 工时, heavy = 繁重标橙, today = 今日。所属月份由日历左侧月份列展示。
   下面是截图转录的前 4 周（= 默认「4周」视图），后续周次由 buildCalendar 生成 */
const CAL_CURRENT_BASE = [
  [
    { d: 27, u: 0, h: 0 },
    { d: 28, u: 31, h: 31.6, heavy: true, today: true },
    { d: 29, u: 36, h: 34, heavy: true },
    { d: 30, u: 22, h: 12.5 },
    { d: 1, u: 22, h: 23.4 },
    { d: 2, u: 11, h: 11.7 },
    { d: 3, u: 0, h: 0 },
  ],
  [
    { d: 4, u: 0, h: 0 },
    { d: 5, u: 38, h: 26.6 },
    { d: 6, u: 37, h: 48.9 },
    { d: 7, u: 25, h: 41.5 },
    { d: 8, u: 51, h: 64.9, heavy: true },
    { d: 9, u: 2, h: 1.7 },
    { d: 10, u: 0, h: 0 },
  ],
  [
    { d: 11, u: 0, h: 0 },
    { d: 12, u: 31, h: 29.4, heavy: true },
    { d: 13, u: 35, h: 37.9, heavy: true },
    { d: 14, u: 22, h: 13 },
    { d: 15, u: 22, h: 17 },
    { d: 16, u: 11, h: 8.6 },
    { d: 17, u: 0, h: 0 },
  ],
  [
    { d: 18, u: 0, h: 0 },
    { d: 19, u: 38, h: 31.1, heavy: true },
    { d: 20, u: 37, h: 30.1, heavy: true },
    { d: 21, u: 25, h: 17.9 },
    { d: 22, u: 51, h: 41.4, heavy: true },
    { d: 23, u: 2, h: 1.7 },
    { d: 24, u: 0, h: 0 },
  ],
];

const CAL_CURRENT = buildCalendar(CAL_CURRENT_BASE, MAX_WEEKS);

/* ------------------------------ 方案日历（截图 3） ------------------------------ */
/* heavy:true → 繁重（橙）。其余有保养量的日期由视图自动判为轻松（绿），
   0 台的日期保持灰字。繁重日期需与 CAL_COMPARE 的 nL='busy' 一致。 */
const CAL_PLAN_BASE = [
  [
    { d: 27, u: 0, h: 0 },
    { d: 28, u: 31, h: 31.6, today: true },
    { d: 29, u: 82, h: 65.1, heavy: true },
    { d: 30, u: 83, h: 71.1, heavy: true },
    { d: 1 },
    { d: 2 },
    { d: 3 },
  ],
  [
    { d: 4, u: 0, h: 0 },
    { d: 5, u: 0, h: 0 },
    { d: 6, u: 0, h: 0 },
    { d: 7, u: 0, h: 0, selected: true },
    { d: 8, u: 26, h: 43.6 },
    { d: 9, u: 50, h: 62.7, heavy: true },
    { d: 10, u: 2, h: 1.7 },
  ],
  [
    { d: 11, u: 0, h: 0 },
    { d: 12, u: 40, h: 32.7 },
    { d: 13, u: 83, h: 87.7, heavy: true, badge: '休' },
    { d: 14, u: 0, h: 0 },
    { d: 15, u: 73, h: 52.7, badge: '休' },
    { d: 16, u: 0, h: 0 },
    { d: 17, u: 0, h: 0 },
  ],
  [
    { d: 18, u: 0, h: 0 },
    { d: 19, u: 38, h: 31.1 },
    { d: 20, u: 37, h: 30.1 },
    { d: 21, u: 25, h: 17.9 },
    { d: 22, u: 51, h: 41.4 },
    { d: 23, u: 2, h: 1.7 },
    { d: 24, u: 0, h: 0 },
  ],
];

const CAL_PLAN = buildCalendar(CAL_PLAN_BASE, MAX_WEEKS);

/* ------------------------------ 方案对比日历（截图 2） ------------------------------ */
/* o  = 原方案 [台数, 工时]，n = 现方案 [台数, 工时]
   缺省表示该方案当天「无保养安排」，视图会显式渲染出来，不留空白。

   nL = 现方案负载等级，'busy'（繁重，橙）/ 'easy'（轻松，绿）。
   原方案不带等级 —— 作为对比基线统一用黑字，避免双侧都着色导致花屏。

   nL='busy' 的日期必须与 CAL_PLAN 中 heavy:true 的日期一致（29 30 / 9 13），
   两处同时也要和 STATS_PLAN 的「繁重 4 天」对得上，改一处要连带改另两处。 */
/* 繁重的判定看工时而不是台量 —— 数据里 73 台是轻松、50 台是繁重，
   区分点在工时：轻松最高 52.65h，繁重最低 62.65h。
   阈值取中间的 58h，可零误差复现上面全部手写的 nL 与 CAL_PLAN 的 heavy。
   手动调整后新台量的颜色就按这条规则现算，不然挪完保养颜色会说谎。 */
const HEAVY_HOURS = 58;
const CAL_COMPARE_BASE = [
  [
    { d: 27 },
    { d: 28, o: [31, 31.55], n: [31, 31.55], nL: 'easy' },
    { d: 29, o: [35, 33.98], n: [82, 65.1], nL: 'busy' },
    { d: 30, o: [22, 12.48], n: [83, 71.07], nL: 'busy' },
    { d: 1, o: [22, 23.37] },
    { d: 2, o: [11, 11.7] },
    { d: 3 },
  ],
  [
    { d: 4 },
    { d: 5, o: [38, 26.62] },
    { d: 6, o: [37, 48.88] },
    { d: 7, o: [25, 41.52] },
    { d: 8, o: [51, 64.88], n: [26, 43.55], nL: 'easy' },
    { d: 9, o: [2, 1.68], n: [50, 62.65], nL: 'busy' },
    { d: 10, n: [2, 1.68], nL: 'easy' },
  ],
  [
    { d: 11 },
    { d: 12, o: [31, 29.37], n: [40, 32.7], nL: 'easy' },
    { d: 13, o: [35, 37.9], n: [83, 87.68], nL: 'busy' },
    { d: 14, o: [22, 12.97] },
    { d: 15, o: [22, 17.02], n: [73, 52.65], nL: 'easy' },
    { d: 16, o: [11, 8.62] },
    { d: 17 },
  ],
  [
    { d: 18 },
    { d: 19, o: [38, 31.13], n: [38, 31.13], nL: 'easy' },
    { d: 20, o: [37, 30.12], n: [37, 30.12], nL: 'easy' },
    { d: 21, o: [25, 17.9], n: [25, 17.9], nL: 'easy' },
    { d: 22, o: [51, 41.4], n: [51, 41.4], nL: 'easy' },
    { d: 23, o: [2, 1.68], n: [2, 1.68], nL: 'easy' },
    { d: 24 },
  ],
];

const CAL_COMPARE = buildCalendar(CAL_COMPARE_BASE, MAX_WEEKS);

/* 把「被算法挪走」的日期回标到方案日历上。
   对比数据是唯一权威：原方案有安排、现方案没有 → 该日是被清空并分摊出去的。
   这样方案抽屉就不会再把这些天显示成「0台 0小时」，与对比视图口径一致。
   注意要区分两种 0：被挪走的（标 cleared）与本来就没活的周末（仍显示 0台 0小时）。 */
CAL_COMPARE.forEach((row, r) => row.forEach((c, i) => {
  if (!c.blank && c.o && !c.n) CAL_PLAN[r][i].cleared = true;
}));

/* ------------------------------ 编排调整弹窗（截图 1） ------------------------------ */
const ADJUST = {
  group: 'KCCW0012(赵波 张文字)',
  project: '合肥产业新城一期2标段电梯工程',
  summary: { orders: 12, minutes: 583 },
  planDate: '2026-09-28',
  /* alias = 客户自编号，与「智能编排条件设置」里设备表的同名列一致 */
  orders: [
    { no: 'NMT4558528020260928N', device: '45585280', alias: '1号楼1号梯', type: '保养(半年保养)', minutes: 49, interval: 14 },
    { no: 'NMT4558528320260928N', device: '45585283', alias: '1号楼2号梯', type: '保养(半年保养)', minutes: 49, interval: 14 },
    { no: 'NMT4558527020260928N', device: '45585270', alias: '2号楼1号梯', type: '保养(半年保养)', minutes: 52, interval: 14 },
    { no: 'NMT4558529220260928N', device: '45585292', alias: '2号楼2号梯', type: '保养(半年保养)', minutes: 43, interval: 14 },
    { no: 'NMT4558527820260928N', device: '45585278', alias: '3号楼1号梯', type: '保养(半年保养)', minutes: 52, interval: 14 },
    { no: 'NMT4558529120260928N', device: '45585291', alias: '3号楼2号梯', type: '保养(半年保养)', minutes: 49, interval: 14 },
    { no: 'NMT4558529320260928N', device: '45585293', alias: '4号楼1号梯', type: '保养(半年保养)', minutes: 52, interval: 14 },
  ],
  /* 迷你日历：周一起始。dim = 非本月，dot = 负载色，n = 台数 */
  miniWeekdays: ['一', '二', '三', '四', '五', '六', '日'],
  mini: [
    [
      { d: 31, dim: true, n: 0 }, { d: 1, n: 35 }, { d: 2, n: 22 }, { d: 3, n: 22 },
      { d: 4, n: 11, dot: 'green' }, { d: 5, n: 0, dot: 'green' }, { d: 6, n: 0, dot: 'green' },
    ],
    [
      { d: 7, n: 38, dot: 'red' }, { d: 8, n: 37, dot: 'red' }, { d: 9, n: 25 },
      { d: 10, n: 51, dot: 'red' }, { d: 11, n: 2, dot: 'green' }, { d: 12, n: 0, dot: 'green' }, { d: 13, n: 0, dot: 'green' },
    ],
    [
      { d: 14, n: 31, dot: 'red' }, { d: 15, n: 35, dot: 'red' }, { d: 16, n: 22 }, { d: 17, n: 22 },
      { d: 18, n: 11, dot: 'green' }, { d: 19, n: 0, dot: 'green' }, { d: 20, n: 0, dot: 'green' },
    ],
    [
      { d: 21, n: 38, dot: 'red' }, { d: 22, n: 37, dot: 'red' }, { d: 23, n: 25 },
      { d: 24, n: 51, dot: 'red' }, { d: 25, n: 2, dot: 'green' }, { d: 26, n: 0, dot: 'green' }, { d: 27, n: 0, dot: 'green' },
    ],
    [
      { d: 28, n: 31, dot: 'red', selected: true }, { d: 29, n: 82, dot: 'red' }, { d: 30, n: 83, dot: 'red' },
      { d: 1, dim: true, n: 0 }, { d: 2, dim: true, n: 0 }, { d: 3, dim: true, n: 0 }, { d: 4, dim: true, n: 0 },
    ],
    [
      { d: 5, dim: true, n: 0 }, { d: 6, dim: true, n: 0 }, { d: 7, dim: true, n: 0 }, { d: 8, dim: true, n: 0 },
      { d: 9, dim: true, n: 0 }, { d: 10, dim: true, n: 0 }, { d: 11, dim: true, n: 0 },
    ],
  ],
};

/* ------------------------------ 智能编排条件设置（截图 7 / 8） ------------------------------ */
/* 单日最大保养台量：按项目逐个设置的产能上限，取值见 CONDITION_PROJECTS.maxDaily */
const MAX_DAILY_UNITS = {
  label: '单日最大保养台量',
  unit: '台',
  tip: '限制该项目单日可安排的最大保养台数，超出部分顺延至其他日期。',
};

const CONDITION_TIP =
  '智能编排会在节假日首日的前21天、前7天，根据用户配置的编排约束，计算最优方案，' +
  '并由系统自动调整员工的保养编排。';

/* 按日期定位该日保养归属的项目。
   原型里没有「工单 → 项目」的真实关联表，用日期做确定性取模从项目列表里取 ——
   刻意不用随机数：截图和回归断言都要能复现同一结果。
   编排调整弹窗的项目下拉、以及应用确认里的调整明细表都走这个函数，两处口径一致。 */
function projectForDay(key) {
  const [y, m, d] = String(key).split('-').map(Number);
  const i = (y * 372 + m * 31 + d) % CONDITION_PROJECTS.length;
  return CONDITION_PROJECTS[i];
}

/* count = 设备台数，maxDaily = 单日最大保养台量（不应超过设备台数） */
const CONDITION_PROJECTS = [
  {
    name: '肥西县丰乐镇中心卫生院迁址新建移', code: '33691624',
    addr: '合肥市蜀山区望江西路129号五彩商业广场1幢办1708', count: 2, maxDaily: 2, open: true,
    devices: [
      { no: '43140953', alias: '客梯', days: ['周一', '周二', '周三', '周四', '周五'], period: '工作时间', dynamic: '是' },
      { no: '43140959', alias: '医梯', days: ['周一', '周二', '周三', '周四', '周五'], period: '工作时间', dynamic: '是' },
    ],
  },
  {
    name: '庐江县引江济淮工程同大镇二龙安…', code: '33692773',
    addr: '安徽省合肥市庐江县同大镇镇政府100米侧', count: 14, maxDaily: 8,
    devices: [
      { no: '44712631', alias: '二处26栋西锦', days: ['周一', '周二', '周三', '周四', '周五'], period: '工作时间', dynamic: '是' },
      { no: '44712632', alias: '二龙安置房26栋东标', days: ['周一', '周二', '周三', '周四', '周五'], period: '工作时间', dynamic: '是' },
      { no: '44712633', alias: '二龙27栋西锦', days: ['周一', '周二', '周三', '周四', '周五'], period: '工作时间', dynamic: '是' },
    ],
  },
  {
    name: '益尚嘉业（合肥）能源化有限公…', code: '33693165',
    addr: '安徽省合肥市庐江县同大镇二龙安置房小区北200米', count: 5, maxDaily: 5, devices: [],
  },
  {
    name: '引江济淮工程同大镇二龙安置点（…', code: '33693425',
    addr: '安徽省合肥市庐江县丰桥大道邻近同大道出所', count: 12, maxDaily: 8, devices: [],
  },
  {
    name: '庐江县合产产业新城"建设+管理"…', code: '33693434',
    addr: '安徽省合肥市庐江县同大镇丰桥大道168号', count: 93, maxDaily: 20, devices: [],
  },
  {
    name: '合肥昌府东区', code: '33693452',
    addr: '安徽省合肥市庐江县汤池大道与合铜路交口', count: 29, maxDaily: 12, devices: [],
  },
];

/* ------------------------------ 首次使用引导 ------------------------------ */
/* 两条提示构成一条链路：
     ① 首次点「智能编排」        → 提示先做项目偏好设置（条件设置）
     ② 首次进入「智能编排条件设置」 → 提示先录入人员安排
   两处的「忽略」都表示跳过设置、直接生成方案 —— ② 的按钮文案已写明这一点。 */
const FIRST_USE_GUIDES = {
  conditions: {
    title: '智能编排条件设置',
    text: '首次使用智能编排请进行项目偏好设置，帮助提高智能编排方案的合理度',
    skipText: '忽 略',
    startText: '开始设置',
  },
  leave: {
    /* 原截图里这里叫「请假排班」，功能改名后同步为「人员安排」 */
    title: '人员安排',
    text: '录入员工的计划调整信息对生成智能编排方案的合理度非常关键，快去录入吧',
    skipText: '忽略并生成方案',
    startText: '开始设置',
  },
};

/* 首次编排的步骤指引。条件设置与人员安排两步操作都较重，
   用步骤条让用户随时知道走到哪、还剩几步。 */
const FIRST_USE_STEPS = [
  { key: 'conditions', title: '编排条件设置', desc: '确认项目与设备偏好' },
  { key: 'leave', title: '人员安排', desc: '录入不保养与加班安排' },
  { key: 'generate', title: '生成编排方案', desc: '由算法计算并均衡工作量' },
];

/* ------------------------------ 方案 B 的应用流程 ------------------------------ */
/* 方案 A 的问题不是「两个按钮平级」，而是在用户缺少判断依据时就把「应用方案」
   做成主按钮 —— 新方案的 KPI 在抽屉里，当前状态的 KPI 在上一页，要切页做减法。

   方案 B 的解法是「不拦住动作，而是充实动作」：
     1. 把当前 → 新方案的涨跌直接写进 KPI 条，决策依据一屏看全，不必切页；
     2. 逐日差异降级为「对比明细」下钻 —— 它是排查用的，不是决策用的；
     3. 确认放在扣扳机的瞬间：点应用时弹一次影响摘要，而不是提前设关卡；
     4. 「不应用」给两条真实出路：改条件重新生成，或手动调整后再应用。
   没有采用强制三步向导：周期性任务里强制步骤会被肌肉记忆绕过，
   得到的是尽职的形式而非实质，而且每次都多付点击成本。 */

/* KPI 对比。better 指明哪个方向算改善：'down' 越小越好，'up' 越大越好，null 中性。
   数值与 STATS_CURRENT / STATS_PLAN 同源，仅此处拆成可比的数字。 */
const PLAN_DELTA_STATS = [
  { icon: 'kpiOrders', label: '总保养工单数', from: 548, to: 623, unit: '个', better: null },
  { icon: 'kpiLayers', label: '最大人均保养量', from: 10.2, to: 16.6, unit: '台', better: 'down' },
  { icon: 'kpiHours', label: '最大人均计划工时', from: 12.98, to: 17.54, unit: '小时', better: 'down' },
];

/* 方案 B 的两步：
     ① 智能编排方案对比 —— 评估主场。差异逐日铺开，点任意日期即可手动调整该日编排。
     ② 方案预览         —— 最终确认。只看将要生效的结果 + 影响摘要，然后应用。
   不再设「手动调整方案」按钮：调整的对象是某一天，入口就该是那一天本身。 */
/* 应用前的确认。取消了「方案预览」步骤后，影响摘要改在此刻摊开 */
const PLAN_APPLY_CONFIRM = {
  title: '确认应用智能编排方案？',
  warn: '应用后将替换该时间范围内的原有保养安排。',
};

/* 手动调整那条线的应用确认。改的是正在执行的计划，措辞要点明这一点 */
const PLAN_TUNE_CONFIRM = {
  title: '确认应用手动调整的保养计划？',
  warn: '应用后将替换这些工单原有的保养日期。',
};

/* 对比单元格里三种方案的叫法。
   原先只有「原方案 / 现方案」两个相对时序的说法，人工调整介入后
   「现方案」会同时指代算法结果与人工结果，含义会漂移。
   改成绝对角色，并只在被人工改过的日子额外显示「算法方案」那一行，
   让「算法的建议被人覆盖了」这件事看得见。 */
const CMP_LABEL = {
  base: '当前计划',   // 今天正在执行的
  algo: '算法方案',   // 算法算出来的（仅在被人工覆盖时显示）
  final: '新方案',    // 点应用后将生效的
};

const PLAN_B_TEXT = {
  title: '智能编排方案',
  /* 底部是发起动作，弹窗里才是最终确认，两处文案要区分开 */
  apply: '应用方案',
  regen: '修改条件重新生成',
  tunedTag: '含手动调整',
  applyWarn: '应用后将替换该时间范围内的原有保养安排',

  /* 方案 B 的手动调整是一个独立模式：按按钮进入，之后日历才可点 */
  tune: '手动调整',
  tuneHint: '点击任意日期调整该日保养安排，可随时撤销',
  tuneDone: '完成调整',
  undoAll: '撤销调整',
  backToTune: '返回调整',
  undoOne: '撤销',


  /* 完成调整后的预览，专门核对人工改了什么 */
  previewTitle: '调整后方案预览',
};

/* 手动调整保养计划（不经过智能编排）。
   独立于智能编排方案那条线：改的是已在执行的计划，所以必须有
   「返回 / 确认应用方案」这对边界，不能点一下日期就直接改掉。
   确认后直接退回首页 —— 首页呈现的就是最终方案，不另插预览页。 */
const PLAN_TUNE_TEXT = {
  title: '手动调整保养计划',
  hint: '点击任意日期即可调整该日保养安排，可随时撤销',
  cancel: '返 回',
  /* 改过东西才出现，点下去即落地为当前计划并退回首页 */
  apply: '确认应用方案',
};

/* 方案 C 与 B 的差别只在「怎么进入手动调整」，所以单列这一组，
   C 专属的文案都放这里，便于对照两套流程的差异。 */
const PLAN_C_TEXT = {
  /* C 没有「手动调整」入口按钮，日历在对比页就常态可点。
     这句话是唯一的可点暗示（除了 hover 高亮），常驻对比页页脚左侧，不能省。 */
  clickHint: '点击任意日期即可调整该日保养安排，可随时撤销',

  /* 改过东西之后，页脚凑成一对「取消 / 确认」。
     取消 = 丢掉全部人工调整回到算法方案；单天改错用格子角标上的 ✕ 就行。
     所以 C 里不再在图例那排放「撤销调整」—— 同一个动作只留一个按钮。 */
  cancelTune: '取消调整',
  confirmTune: '确认调整',

  /* C 没有「调整后方案预览」那一步 —— 人工调整的结果本来就画在对比日历上，
     再给一页等于把同样的内容重复一遍。所以主操作直接是「确认调整并应用」，
     点下去弹应用确认框，调整了哪几天在框里逐条列出。 */
  confirmApply: '确认调整并应用',
};

/* 人工搬移的去向 / 来源说明，显示在新方案色块下面那行紫字里。

   搬出端点明「手动」：同一个位置上，算法清空的日子写的是灰字「已分配至其他日期」，
   两条消息长得像，只靠紫灰配色区分不够稳，文字里直接说清是谁动的手。

   搬入端不加「手动」：那一侧没有需要区分的灰字，紫色加「调整」角标已经说明是人工改的；
   而且加上之后「自 10月9日 手动移入 50 台」会撑到两行（实测 35px，行高 17px），
   为了一个冗余的限定词把格子拉高不值得。 */
const MOVED_NOTE = {
  out: '已手动调整至',
  /* 只搬走当天的一部分工单时用这句：不写张数，格子上还剩着量
     却说「已调整至 X」，看着像自相矛盾 */
  outPart: (n, day) => `已手动调整 ${n} 张工单至 ${day}`,
  inFrom: (day, units) => `自 ${day} 移入 ${units} 台`,
};

/* 现方案清空当天的说明。与「无保养安排」合并为一句，直接写在色块里，
   省掉原先单独一行灰字（任务并未取消，只是挪到了其他日期） */
const REALLOCATED_NOTE = '已分配至其他日期';

/* 应用确认表里对侧日期的占位：算法重新分配时无法定位到具体某一天，
   只有人工搬移才记录了明确的 from/to。措辞与 REALLOCATED_NOTE 保持一致。 */
const OTHER_DAY = '其他日期';

/* --------------------- 人员安排：工作日不保养 / 非工作日保养 --------------------- */
/* 功能原名「请假排班」，因类型值已全部改为保养口径，功能名同步改为「人员安排」。
   类型语义：
     workdayOff  工作日不保养 —— 成员在本应工作的日子不参与保养（原「请假」）
     restdayOn   非工作日保养 —— 成员在休息日参与保养（原「调班」） */
const LEAVE_TYPE_LABEL = {
  workdayOff: '工作日不保养',
  restdayOn: '非工作日保养',
};

/* 功能名集中一处，便于统一调整 */
const PLAN_ADJUST_NAME = '人员安排';

/* 列表上方的类型筛选项，「全部」用于查看全量记录 */
const LEAVE_FILTER_ALL = '全部';
const LEAVE_FILTER_OPTIONS = [LEAVE_FILTER_ALL, '工作日不保养', '非工作日保养'];

/* 全量记录。字段与「人员安排设置」弹窗采集的项一一对应：人员 / 类型 / 开始时间 / 结束时间。
   已去掉上午下午（半天粒度）与时长 —— 计划调整按整天记，时长可由起止日期推出。
   日期均落在 10月1日 起的编排范围内，与日历一致。 */
const LEAVE_RECORDS = [
  { staff: '赵波', type: 'workdayOff', start: '2026-10-05', end: '2026-10-05' },
  { staff: '张文字', type: 'workdayOff', start: '2026-10-01', end: '2026-10-03' },
  { staff: '赵波', type: 'restdayOn', start: '2026-10-10', end: '2026-10-10' },
  { staff: '张文字', type: 'workdayOff', start: '2026-10-14', end: '2026-10-14' },
  { staff: '张文字', type: 'workdayOff', start: '2026-10-16', end: '2026-10-16' },
  { staff: '赵波', type: 'restdayOn', start: '2026-10-17', end: '2026-10-17' },
  { staff: '赵波', type: 'workdayOff', start: '2026-10-22', end: '2026-10-23' },
  { staff: '张文字', type: 'restdayOn', start: '2026-10-24', end: '2026-10-24' },
];

/* ------------------------------ 智能编排失败提示 ------------------------------ */
const SMART_FAIL_COMMON = {
  title: '智能编排方案生成失败',
  group: 'KCCW0012(赵波 张文字)',
  range: '9月27日-10月31日',
};

/* 失败类型。关键字段是 retryable：
     retryable=false → 确定性失败，编排条件不变则重算结果必然相同，
                        此时不渲染「重新生成」按钮，主按钮指向能真正改变结果的入口。
     retryable=true  → 临时性故障（超时、服务异常），重试有意义。
   primary.go 取值须是 app.js 里已注册的视图名（conditions / leave）。
   文案保持「一句原因 + 一句依据 + 一句建议」，不再展开成列表。 */
const SMART_FAIL_TYPES = {
  conflict: {
    code: 'SCHED_CONSTRAINT_CONFLICT',
    reason: '编排约束条件互相冲突，当前条件下无可行解',
    detail: '93 台设备的可保养日期集中在周一至周三，超出工作组承载能力 2.3 倍',
    guide: '到「智能编排条件设置」放宽可保养日期，或调整动态保养间隔',
    retryable: false,
    primary: { text: '去修改编排条件', go: 'conditions' },
  },
  noStaff: {
    code: 'SCHED_NO_AVAILABLE_STAFF',
    reason: '工作组在所选时间范围内没有可排班人员',
    detail: '2 名成员全部被设为「工作日不保养」，可用人力为 0',
    guide: '到「人员安排」减少「工作日不保养」记录，或补充人员',
    retryable: false,
    primary: { text: '去人员安排', go: 'leave' },
  },
  window: {
    code: 'SCHED_DATE_WINDOW_TOO_NARROW',
    reason: '部分设备的可保养日期范围过窄，无法排入计划',
    detail: '12 台设备仅勾选 1 个可保养工作日，按 14 天间隔无可用日期',
    guide: '到「智能编排条件设置」为这些设备增加可保养日期',
    retryable: false,
    primary: { text: '去修改编排条件', go: 'conditions' },
  },
  timeout: {
    code: 'SCHED_CALC_TIMEOUT',
    reason: '算法计算超时，未能在限定时间内返回方案',
    detail: '待编排 623 台，本次计算耗时超过 60 秒上限',
    guide: '属临时性故障，可直接重新生成；多次超时建议缩短周期分批生成',
    retryable: true,
    primary: { text: '重新生成', retry: true },
  },
  unknown: {
    /* 保留最初的通用文案，作为后端未返回具体错误码时的兜底 */
    code: 'SCHED_UNKNOWN_ERROR',
    reason: '当前智能编排算法计算失败，请手动调整编排',
    detail: '未返回具体失败原因，可能是算法服务异常',
    guide: '可重新生成一次；若仍失败请联系系统管理员排查',
    retryable: true,
    primary: { text: '重新生成', retry: true },
  },
};

/* ------------------------------ 原型导航 ------------------------------ */
const PROTO_SCREENS = [
  { id: 'smart', label: '智能编排主页', shot: '截图 9' },
  { id: 'first-smart', label: '首次引导①·点智能编排', shot: '新增' },
  { id: 'first-steps', label: '首次步骤①·条件设置', shot: '新增' },
  { id: 'first-conditions', label: '首次引导②·点确定后', shot: '新增' },
  { id: 'first-leave', label: '首次步骤②·人员安排', shot: '新增' },
  { id: 'smart-generating', label: '方案生成中', shot: '截图 4' },
  { id: 'fail-conflict', label: '失败·约束冲突', shot: '新增' },
  { id: 'fail-no-staff', label: '失败·无可用人员', shot: '新增' },
  { id: 'fail-window', label: '失败·可保养日期过窄', shot: '新增' },
  { id: 'fail-timeout', label: '失败·计算超时', shot: '新增' },
  { id: 'fail-unknown', label: '失败·未知原因', shot: '新增' },
  { id: 'plan', label: '查看智能编排方案', shot: '截图 3' },
  { id: 'compare', label: '智能编排方案对比', shot: '截图 2' },
  { id: 'adjust', label: '编排调整弹窗', shot: '截图 1' },
  { id: 'conditions', label: '智能编排条件设置', shot: '截图 7 / 8' },
  { id: 'leave', label: '人员安排列表', shot: '截图 6' },
  { id: 'leave-modal', label: '人员安排设置', shot: '截图 5' },
];
