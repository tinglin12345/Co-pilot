/* =========================================================================
   智能编排 原型 · 渲染与交互
   ========================================================================= */

(function () {
  'use strict';

  /* ------------------------------ 工具 ------------------------------ */
  const $ = (sel, root) => (root || document).querySelector(sel);
  const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));
  const pad2 = (n) => String(n).padStart(2, '0');

  function icon(name, size, sw) {
    const d = ICONS[name];
    if (!d) return '';
    const s = size || 16;
    return `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor"
      stroke-width="${sw || 1.6}" stroke-linecap="round" stroke-linejoin="round"><path d="${d}"/></svg>`;
  }

  /* 实心信息图标（引导弹窗用，非描边风格，单独写死） */
  const INFO_ICON = `<svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
    <circle cx="12" cy="12" r="10" fill="#1677ff"/>
    <path d="M12 6.6a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z" fill="#fff"/>
    <rect x="11" y="10.8" width="2" height="6.6" rx="1" fill="#fff"/>
  </svg>`;

  const caret = `<span class="caret"><svg viewBox="0 0 24 24"><path d="M5 9l7 7 7-7"/></svg></span>`;
  const closeX = `<svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
  const expandIco = `<svg viewBox="0 0 24 24"><path d="M9 3H3v6M15 3h6v6M9 21H3v-6M15 21h6v-6"/></svg>`;
  /* 右向箭头。展开时靠 CSS 旋转 90° 变成下向 */
  const chevron = `<svg viewBox="0 0 24 24"><path d="M9 5l7 7-7 7"/></svg>`;


  /* =======================================================================
     方案模式：'A' = 现状（对比/应用两个平级按钮）
               'B' = 串行流程（查看方案 → 对比预览 → 确认应用）
     仅影响「查看智能编排方案」之后的交互，其余界面完全一致。
     ===================================================================== */
  let planMode = 'A';
  /* 方案 B：记录每一次人工搬移，而不只是「哪天被改过」。
     对比视图要说清「从哪天挪到哪天」，所以必须存成对的 from / to。 */
  let manualMoves = [];   // [{ from, to, units, hours }]
  /* 直接作用在首页「当前保养计划」日历上的人工调整，与上面那组互不相干：
       manualMoves —— 改的是智能编排给出的待确认方案（抽屉内）
       planMoves   —— 改的是已在执行的计划（首页），不经过智能编排
     两者分开存，否则应用方案时清空 manualMoves 会把首页的调整一起抹掉。 */
  let planMoves = [];     // [{ from, to, units, hours }]
  const dayKey = (c) => `${c._y}-${c._m}-${c.d}`;
  const keyLabel = (k) => { const [, m, d] = k.split('-'); return `${+m}月${+d}日`; };
  const movedFrom = (k) => manualMoves.find((m) => m.from === k);   // 这天的活被挪走
  const movedTo = (k) => manualMoves.find((m) => m.to === k);       // 别处的活挪进这天
  const isManualDay = (k) => !!movedFrom(k) || !!movedTo(k);
  /* 首页日历的同名三件套 */
  const planMovedFrom = (k) => planMoves.find((m) => m.from === k);
  const planMovedTo = (k) => planMoves.find((m) => m.to === k);
  const isTuned = () => manualMoves.length > 0;
  /* 参与人工调整的日期数（源与目标都算，同一天只计一次） */
  const manualDayCount = () => new Set(
    manualMoves.flatMap((m) => [m.from, m.to])).size;
  const isB = () => planMode === 'B';
  const isC = () => planMode === 'C';
  /* B 与 C 共用同一套串行流程骨架（抽屉、对比日历、人工调整数据），
     只在「怎么进入手动调整」和图例/配色上分叉。
     凡是「只要不是方案 A 就该这样」的判断都用 isFlow()，避免加了 C 之后漏改。 */
  const isFlow = () => isB() || isC();

  const app = $('#app');
  const viewMount = $('#viewMount');
  const overlayMount = $('#overlayMount');
  const toastMount = $('#toastMount');

  /* =======================================================================
     侧栏菜单
     ===================================================================== */
  function renderMenu() {
    const html = MENU.map((m) => {
      const hasKids = Array.isArray(m.children);
      const open = !!m.open;
      const arrow = hasKids
        ? `<span class="mi-arrow"><svg viewBox="0 0 24 24"><path d="M5 9l7 7 7-7"/></svg></span>`
        : '';
      const kids = (m.children || []).length
        ? `<div class="submenu" ${open ? '' : 'style="display:none"'}>` +
          m.children.map((c) =>
            `<div class="sub-item ${c.active ? 'active' : ''}" data-sub="${c.key}">
               <span>${c.label}</span>
             </div>`).join('') +
          `</div>`
        : '';
      return `<div class="menu-group" data-group="${m.key}">
                <div class="menu-item ${open ? 'open' : ''}" data-menu="${m.key}">
                  <span class="mi-icon">${icon(m.icon, 16)}</span>
                  <span class="mi-label">${m.label}</span>
                  ${arrow}
                </div>
                ${kids}
              </div>`;
    }).join('');

    $('#menuMount').innerHTML = html;

    $$('#menuMount .menu-item').forEach((it) => {
      it.addEventListener('click', () => {
        const sub = it.parentElement.querySelector('.submenu');
        if (!sub) return;
        const showing = sub.style.display !== 'none';
        sub.style.display = showing ? 'none' : '';
        it.classList.toggle('open', !showing);
      });
    });

    $$('#menuMount .sub-item').forEach((it) => {
      it.addEventListener('click', () => {
        const key = it.dataset.sub;
        if (key === 'sched-smart') go('smart');
      });
    });
  }

  $('#collapseBtn').addEventListener('click', () => app.classList.toggle('collapsed'));

  /* =======================================================================
     公共片段
     ===================================================================== */
  /* 工作量分布随可视周数重算 —— 否则切到 8周/13周 时天数就对不上日历了。
     另外三项（工单数、人均保养量、人均工时）无法从日格推导，保持静态。 */
  function statsFor(base, rows) {
    const flat = rows.flat();
    const busy = flat.filter((c) => c.heavy).length;
    const easy = flat.filter((c) => !c.heavy && c.u > 0).length;
    return base.map((s) => (s.tags
      ? Object.assign({}, s, {
        tags: [
          { text: `轻松 ${easy} 天`, tone: 'easy' },
          { text: `繁重 ${busy} 天`, tone: 'busy' },
        ],
      })
      : s));
  }

  /* 统计某段日历的繁重 / 轻松天数，用于工作量分布的涨跌 */
  function loadDays(rows) {
    const flat = rows.flat().filter((c) => !c.blank);
    return {
      busy: flat.filter((c) => c.heavy).length,
      easy: flat.filter((c) => !c.heavy && c.u > 0).length,
    };
  }

  /* 一条涨跌：当前值 → 新值 + 变化量徽标。
     tone: good 绿 / bad 橙 / flat 灰 */
  function deltaLine(from, to, unit, better) {
    const diff = +(to - from).toFixed(2);
    let tone = 'flat';
    if (diff !== 0 && better) {
      const improved = better === 'down' ? diff < 0 : diff > 0;
      tone = improved ? 'good' : 'bad';
    }
    const sign = diff > 0 ? '+' : (diff < 0 ? '−' : '');
    // 徽标只放数字：单位在前后数值里已经出现，重复会把这行撑到折行
    const chip = diff === 0
      ? `<span class="sd-chip flat">无变化</span>`
      : `<span class="sd-chip ${tone}">${sign}${Math.abs(diff)}</span>`;
    return `<div class="stat-delta">
      <span class="sd-from">${from}${unit}</span>
      <span class="sd-arrow">→</span>
      <span class="sd-to">${to}${unit}</span>
      ${chip}
    </div>`;
  }

  /* 方案 B 的 KPI 条：把「当前 → 新方案」的对比直接摆出来，
     用户无需切到对比页做减法就能判断这次编排是改善还是恶化 */
  function deltaStatsHtml(rowsCurrent, rowsPlan) {
    const a = loadDays(rowsCurrent);
    const b = loadDays(rowsPlan);

    const items = PLAN_DELTA_STATS.map((s) => `
      <div class="stat">
        <span class="stat-icon">${icon(s.icon, 22, 1.5)}</span>
        <div class="stat-body">
          <div class="stat-line">${s.label}</div>
          ${deltaLine(s.from, s.to, s.unit, s.better)}
        </div>
      </div>`).join('');

    /* 工作量分布随可视范围实时统计，繁重越少越好、轻松越多越好 */
    const dist = `
      <div class="stat">
        <span class="stat-icon">${icon('kpiBalance', 22, 1.5)}</span>
        <div class="stat-body">
          <div class="stat-line">工作量分布</div>
          <div class="stat-delta-group">
            <span class="sd-key busy">繁重</span>${deltaLine(a.busy, b.busy, '天', 'down')}
            <span class="sd-key easy">轻松</span>${deltaLine(a.easy, b.easy, '天', 'up')}
          </div>
        </div>
      </div>`;

    return `<div class="stats stats-delta">${items}${dist}</div>`;
  }

  function statsHtml(list) {
    return `<div class="stats">` + list.map((s) => `
      <div class="stat">
        <span class="stat-icon">${icon(s.icon, 22, 1.5)}</span>
        <div class="stat-body">
          ${s.lines.map((l) => `<div class="stat-line">${l}</div>`).join('')}
          ${s.value ? `<div class="stat-value">${s.value}</div>` : ''}
          ${s.tags ? `<div class="stat-tags">${s.tags.map((t) =>
            `<span class="stat-tag ${t.tone}">${t.text}</span>`).join('')}</div>` : ''}
        </div>
      </div>`).join('') + `</div>`;
  }

  /* id 可选：传了之后可监听该控件的 'dd:change' 事件拿到选中值 */
  function dd(value, opts, width, placeholder, id) {
    const w = width || 'control-w-md';
    const isPh = !value;
    return `<div class="dropdown-wrap">
      <div class="control ${w}" data-dd ${id ? `id="${id}"` : ''} data-options="${(opts || []).join('|')}">
        <span class="${isPh ? 'ph' : 'val'}">${isPh ? (placeholder || '请选择') : value}</span>${caret}
      </div>
    </div>`;
  }

  /* 读取下拉当前值（占位态返回空串） */
  function ddValue(ctl) {
    const v = $('.val', ctl);
    return v ? v.textContent.trim() : '';
  }

  /* 数量输入框（带单位后缀），用于「单日最大保养台量」这类阈值条件。
     sm=true 用于表格内，宽度更紧凑 */
  function numInput(value, unit, id, sm) {
    return `<span class="num-input ${sm ? 'sm' : ''}">
      <input type="number" min="1" step="1" value="${value}" ${id ? `id="${id}"` : ''} />
      ${unit ? `<span class="unit">${unit}</span>` : ''}
    </span>`;
  }

  function help(tip) {
    return `<span class="help-dot" data-tip="${tip.replace(/"/g, '&quot;')}">
      ${icon('complaint', 14)}</span>`;
  }

  /* --------------------------- 日历 --------------------------- */
  /* 日历始终渲染全部 13 周（最大可滚动到 13 周）。
     档位只决定「当前看到第几周」，用于范围文案与工作量分布的统计区间。 */
  function weekSlice(rows, label) {
    const n = WEEK_OPTION_WEEKS[label] || WEEK_OPTION_WEEKS[WEEK_OPTIONS[0]];
    return rows.slice(0, n);
  }

  /* 行号 → 档位：1~4 周为 4周，5~8 周为 8周，9 周以后为 13周 */
  function tierOfRow(row) {
    for (let i = 0; i < WEEK_OPTIONS.length; i++) {
      if (row <= WEEK_OPTION_WEEKS[WEEK_OPTIONS[i]]) return WEEK_OPTIONS[i];
    }
    return WEEK_OPTIONS[WEEK_OPTIONS.length - 1];
  }

  /* 把周期下拉与日历滚动双向绑定：
       向下滚动超过第 4 周 → 下拉自动定位到 8周，超过第 8 周 → 13周
       主动选择档位   → 日历滚动到该档位末尾
     两侧都会同步刷新范围文案与工作量分布（以及对比视图的图例）。 */
  function setupTierSync(cfg) {
    const { scroller, ctl, rows } = cfg;
    if (!scroller || !ctl) return;
    const total = rows.length;
    let current = ddValue(ctl) || WEEK_OPTIONS[0];

    /* 逐行实测偏移，行高不等（对比视图行更高）时也准确 */
    function rowTops() {
      const tops = new Array(total).fill(0);
      $$('.cal-cell', scroller).forEach((c) => {
        const r = parseInt(c.style.gridRow, 10);
        if (r >= 1 && r <= total) tops[r - 1] = c.offsetTop;
      });
      return tops;
    }

    function setLabel(label) {
      const span = $('.val', ctl) || $('.ph', ctl);
      span.textContent = label;
      span.className = 'val';
    }

    function apply(label) {
      current = label;
      setLabel(label);
      const sub = weekSlice(rows, label);
      if (cfg.rangeEl) cfg.rangeEl.textContent = rangeLabel(sub);
      if (cfg.statsEl && cfg.renderStats) {
        cfg.statsEl.innerHTML = cfg.renderStats(label);
      } else if (cfg.statsEl && cfg.statsBase) {
        cfg.statsEl.innerHTML = statsHtml(statsFor(cfg.statsBase, sub));
      }
      if (cfg.legendEl) cfg.legendEl.innerHTML = compareLegendHtml(sub);
    }

    scroller.addEventListener('scroll', () => {
      const tops = rowTops();
      const bottom = scroller.scrollTop + scroller.clientHeight - 4;
      let bottomRow = 1;
      for (let i = 0; i < total; i++) if (tops[i] < bottom) bottomRow = i + 1;
      const label = tierOfRow(bottomRow);
      if (label !== current) apply(label);
    }, { passive: true });

    ctl.addEventListener('dd:change', (e) => {
      const label = e.detail;
      const n = WEEK_OPTION_WEEKS[label];
      const tops = rowTops();
      // 滚到该档位最后一行的底部；4周 档直接回到顶部
      const target = n <= WEEK_OPTION_WEEKS[WEEK_OPTIONS[0]]
        ? 0
        : Math.max(0, (tops[n - 1] || 0) + (scroller.scrollHeight / total) - scroller.clientHeight);
      scroller.scrollTop = target;   // 用瞬时滚动，避免动画期间档位来回跳
      apply(label);
    });

    apply(current);
  }

  /* 表头首列留空，对应左侧月份列 */
  function calHead() {
    return `<div class="cal-head"><div class="cal-month"></div>${
      WEEKDAYS.map((w) => `<div>${w}</div>`).join('')}</div>`;
  }

  /* 把行按「该行首日所属月份」分组并合并，月份列据此跨整月占一格。
     返回 [{ m, y, start, span }]，start 为 0 基行号。 */
  /* 首格可能是空格（起始日之前），取该行第一个有日期的格子定月份 */
  function firstReal(row) { return row.find((c) => !c.blank) || row[0]; }
  function lastReal(row) {
    for (let i = row.length - 1; i >= 0; i--) if (!row[i].blank) return row[i];
    return row[row.length - 1];
  }

  function monthGroups(rows) {
    const groups = [];
    rows.forEach((row, i) => {
      const { _m: m, _y: y } = firstReal(row);
      const last = groups[groups.length - 1];
      if (last && last.m === m && last.y === y) last.span += 1;
      else groups.push({ m, y, start: i, span: 1 });
    });
    return groups;
  }

  /* 月份格跨多行；内部标签 sticky，滚动时始终贴在可视区顶部 */
  function monthCell(g) {
    return `<div class="cal-month has-label" style="grid-row:${g.start + 1}/span ${g.span}">
      <div class="cm-inner">
        <span class="cm-m">${g.m}月</span>
        <span class="cm-y">${g.y}</span>
      </div>
    </div>`;
  }

  /* 依据起止日生成「10月1日-10月24日」这样的范围文案，跳过空格 */
  function rangeLabel(rows) {
    const a = firstReal(rows[0]);
    const z = lastReal(rows[rows.length - 1]);
    return `${a._m}月${a.d}日-${z._m}月${z.d}日`;
  }

  /* 周日(0) / 周六(6) 的日期数字置灰 */
  function dateCell(c, colIndex) {
    const dim = colIndex === 0 || colIndex === 6 ? 'dim' : '';
    return `<div class="cal-date">
      <span class="cal-day ${dim}">${c.d}</span>
      ${c.badge ? `<span class="badge-holiday">${c.badge}</span>` : ''}
      ${c.today ? `<span class="badge-today">今</span>` : ''}
    </div>`;
  }

  /* greenEasy=true 时，有保养量且非繁重的日期标绿。主页与方案抽屉的日历都启用，
     绿格数量与 KPI「工作量分布」的轻松天数严格相等。
     方案对比视图不用这套：那里的原方案行统一黑字，只有现方案着色。 */
  const VAL_DOT = `<i class="cv-dot"></i>`;

  /* 首页日历格子的取值。叠加 planMoves 后重算，并沿用抽屉里那套人工调整的显示：
     紫色左边条 + 「调整」角标（带撤销 ✕）+ 下面一行紫字去向说明。

     配色上有个取舍：没被改过的日子保持数据里原有的 heavy 标记不动 ——
     CAL_CURRENT 的 heavy 是逐格转录来的，用任何单一阈值都至少错判 6 格
     （31台/29.4小时算繁重，而 38台/31.1小时不算），反推不出规则。
     只有被改过量的日子才按全局的 HEAVY_HOURS 现算，否则颜色会停在改动前。 */
  function cellValueAdjustable(c) {
    const k = dayKey(c);
    const mvOut = planMovedFrom(k);
    const mvIn = planMovedTo(k);

    let val;
    let note = '';
    if (mvOut || mvIn) {
      /* 搬出可以只搬走一部分，所以数值统一走 planDayLoad，不再写死 0 台。
         去向说明两端都可能有：既搬出几张又从别处移入几张的日子，
         两行都要写清，否则格子上的数变了却看不出为什么。 */
      const [u, h] = planDayLoad(k);
      const cls = u === 0 ? 'zero' : (loadLevel(h) === 'busy' ? 'heavy' : 'easy');
      val = `<span class="cal-val ${cls}">${VAL_DOT}${u}台 ${h}小时</span>`;
      const lines = [];
      if (mvOut) {
        /* 整天搬走就沿用原措辞；只搬走一部分要点明张数，
           否则格子上还剩着量、说明却写「已调整至 X」，看着像自相矛盾 */
        const whole = u === 0 && !mvIn;
        lines.push(whole
          ? `${MOVED_NOTE.out} ${keyLabel(mvOut.to)}`
          : MOVED_NOTE.outPart(mvOut.units, keyLabel(mvOut.to)));
      }
      if (mvIn) lines.push(MOVED_NOTE.inFrom(keyLabel(mvIn.from), mvIn.units));
      note = lines.map((t) => `<span class="cal-moved">${t}</span>`).join('');
    } else {
      val = cellValue(c, true);
    }
    return { val, note, manual: !!mvOut || !!mvIn, undoKey: mvOut ? k : (mvIn && mvIn.from) };
  }

  function cellValue(c, greenEasy) {
    /* 被智能编排挪走的日期：保留「0台 0小时」这一事实，下面再补一行去向说明，
       与对比视图口径一致（该日确实没有保养量，但任务并未取消） */
    if (c.cleared) {
      return `<span class="cal-val zero">${VAL_DOT}0台 0小时</span>`
        + `<span class="cal-val none">${REALLOCATED_NOTE}</span>`;
    }
    if (c.u === undefined || c.u === null) return '';
    const txt = `${VAL_DOT}${c.u}台 ${c.h}小时`;
    if (c.heavy) return `<span class="cal-val heavy">${txt}</span>`;
    if (c.u === 0) return `<span class="cal-val zero">${txt}</span>`;
    if (greenEasy) return `<span class="cal-val easy">${txt}</span>`;
    return `<span class="cal-val">${txt}</span>`;
  }

  /* 统一的日历外壳：表头固定，主体可纵向滚动（13 周时必需） */
  function calShell(rows, inner, o) {
    return `<div class="cal ${o.cls || ''}" ${o.id ? `id="${o.id}"` : ''}>
      ${calHead()}
      <div class="cal-scroll">
        <div class="cal-body" style="grid-template-rows:repeat(${rows.length},minmax(84px,auto))">
          ${monthGroups(rows).map(monthCell).join('')}
          ${inner}
        </div>
      </div>
    </div>`;
  }

  function calHtml(rows, opts) {
    const o = opts || {};
    const cells = rows.map((row, ri) => row.map((c, ci) => {
      const pos = `style="grid-column:${ci + 2};grid-row:${ri + 1}"`;
      const edge = ci === 6 ? 'last-col' : '';
      // 起始日之前的空格：不显示日期与数值，也不可点
      if (c.blank) return `<div class="cal-cell blank ${edge}" ${pos}></div>`;
      /* 四个开关互相独立，不能合并 —— 每种组合都真实用到：
           o.merged     —— 数值叠加 planMoves（搬出端归零、搬入端累加）
           o.marked     —— 额外显示调整痕迹（紫边条 / 调整角标 / 去向说明）
           o.adjustable —— 点格子就地改这一天，角标里带撤销 ✕（手动调整页）
           o.enterable  —— 点格子进入手动调整页，不在本页改（首页）

         首页是 merged + enterable：只看最终方案，不显示调整痕迹。
         手动调整页是 merged + marked + adjustable：正在改，痕迹必须可见。
         曾把 merged 和 marked 合成一个开关，结果首页一应用就带着紫色标记。 */
      if (o.merged) {
        const s = cellValueAdjustable(c);
        const mark = !!o.marked && s.manual;
        const badge = mark
          ? `<span class="src-badge manual">调整${o.adjustable
            ? `<button class="badge-undo" data-undo-plan="${s.undoKey}"
                       title="撤销该日调整" aria-label="撤销该日调整">✕</button>`
            : ''}</span>`
          : '';
        const hook = o.adjustable ? `data-adjust-day="${dayKey(c)}"`
          : (o.enterable ? `data-enter-day="${dayKey(c)}"` : '');
        return `
      <div class="cal-cell ${mark ? 'manual' : ''} ${edge}" ${pos}
           data-day="${c.d}" ${hook}>
        ${dateCell(c, ci)}
        ${badge}
        ${s.val}
        ${mark ? s.note : ''}
      </div>`;
      }
      return `
      <div class="cal-cell ${c.selected ? 'selected' : ''} ${edge}" ${pos} data-day="${c.d}">
        ${dateCell(c, ci)}
        ${cellValue(c, o.greenEasy)}
      </div>`;
    }).join('')).join('');
    return calShell(rows, cells, o);
  }

  /* 判定某天是否被方案调整过：
     两套方案都无保养 → 未调整；只有一方有 → 已调整；都有 → 比对台数与工时 */
  function isAdjusted(c) {
    if (!c.o && !c.n) return false;
    if (!c.o || !c.n) return true;
    return c.o[0] !== c.n[0] || c.o[1] !== c.n[1];
  }

  /* 负载等级：按工时判，与数据里手写的 nL / heavy 同一把尺子（见 HEAVY_HOURS 注释）。
     手动调整合并出来的新工时靠它现算，否则颜色会停在算法那一版上。 */
  function loadLevel(hours) {
    return hours >= HEAVY_HOURS ? 'busy' : 'easy';
  }

  /* 某一天的保养量 [台数, 工时]。取现方案的量，没有则退回当前计划的量。 */
  function dayLoad(key) {
    const cell = CAL_COMPARE.flat().find((c) => !c.blank && dayKey(c) === key);
    return (cell && (cell.n || cell.o)) || [0, 0];
  }

  /* 某日「新方案」最终会生效的保养量，已叠加人工搬移的影响。
     返回 null 表示两套方案在这天都没有安排。
     日历单元格与应用确认表共用这一个函数 —— 之前这段逻辑只写在
     compareCalHtml 里，确认表若自己再算一遍，迟早会出现同一天两个数字。 */
  function finalLoad(c) {
    const k = dayKey(c);
    const mvOut = movedFrom(k);
    const mvIn = movedTo(k);
    if (mvOut || mvIn) {
      /* 搬出改成「减去搬移量」而不是一律归零 —— 方案 C 可以只挑走当天的一部分工单。
         整天搬移时 mv.units 正好等于 dayLoad 的台量，减完仍是 0，
         所以方案 A/B 的每一格与改动前完全一致。 */
      let u = c.n ? c.n[0] : 0;
      let h = c.n ? c.n[1] : 0;
      if (mvOut) { u -= mvOut.units; h -= mvOut.hours; }
      if (mvIn) { u += mvIn.units; h += mvIn.hours; }
      return [Math.max(0, u), Math.max(0, Math.round(h * 100) / 100)];
    }
    if (c.n) return c.n;                      // 算法排的量
    if (c.o) return [0, 0];                   // 算法清空了原有安排
    return null;
  }

  /* 某天在「本次搬出」之前的量：dayLoad 读的是原始 CAL_COMPARE，本就不含搬移影响，
     只需再补上搬入的部分。重新编辑那天时，弹窗要据此列出完整工单清单，
     把上次挑走的那几张显示成已勾选，而不是只列剩下的。 */
  function dayLoadBeforeOut(key) {
    const base = dayLoad(key);
    const mvIn = movedTo(key);
    if (!mvIn) return base;
    return [base[0] + mvIn.units, Math.round((base[1] + mvIn.hours) * 100) / 100];
  }

  /* 一次调整的规模，统一换算成「工单 / 分钟」—— 被调整的对象是保养工单，
     日历上的「台」只是因为一台设备对应一张保养工单，数值相同、口径不同。
     编排调整弹窗的项目行和应用确认的明细表都走这个函数，
     避免出现弹窗说「12工单 583分钟」、确认表说「22 台」这种同一件事两个数字的情况。 */
  function moveScale(units, hours) {
    return { orders: units, minutes: Math.round(hours * 60) };
  }

  /* 按该日的工单数生成工单卡片，并把总分钟精确摊到每张卡上。
     编号与客户自编号由日期和序号推导，确定性生成 —— 不用随机，截图可复现。
     totalMinutes 用「先均分、余数分给前几张」的方式分配，保证各卡工时之和
     严格等于表头的分钟数，不留舍入误差。 */
  function ordersForDay(key, count, totalMinutes) {
    const tpl = ADJUST.orders;
    const stamp = key.split('-').map((s) => s.padStart(2, '0')).join('');
    const base = count ? Math.floor(totalMinutes / count) : 0;
    const extra = count ? totalMinutes - base * count : 0;
    const out = [];
    for (let i = 0; i < count; i++) {
      const t = tpl[i % tpl.length];
      /* 按轮次偏移而不是直接 +i：模板里的设备号最多只差 23（45585270~45585293），
         +i 会让第 1 个模板的 +3 撞上第 2 个模板的 +0。
         轮次步进取 1000，远大于模板内部差值，编号必然唯一。 */
      const device = String(+t.device + Math.floor(i / tpl.length) * 1000);
      out.push({
        no: `NMT${device}${stamp}N`,
        device,
        /* 每 ceil(count/楼栋) 台算一栋，读起来像真实的楼号/梯号编排 */
        alias: `${Math.floor(i / tpl.length) + 1}号楼${(i % tpl.length) + 1}号梯`,
        type: t.type,
        minutes: base + (i < extra ? 1 : 0),
        interval: t.interval,
      });
    }
    return out;
  }

  /* 图例随当前档位的范围重算，所以单独成块，便于只更新它而不重渲日历 */
  function compareLegendHtml(rows) {
    const flat = rows.flat().filter((c) => !c.blank);
    /* 人工调整的天数按当前可视范围统计。
       只有方案 B 有手动调整这回事，方案 A 不显示该项，避免无谓的「0 天」噪音。 */
    const manual = flat.filter((c) => isManualDay(dayKey(c))).length;

    /* 方案 C 的图例去掉「算法调整（共 N 天：N 天清空、N 天新增、N 天改量）」——
       那串明细太长，把整排图例挤成一句话；同样的涨跌顶部 KPI 已经说过一遍，
       而日历上每格「当前计划 / 新方案」两行并排，改了什么本来就一眼能看出来。 */
    if (isC()) {
      /* 图例只留三种负载状态。「人工调整（N 天）」也去掉了 ——
         日历上被改过的日子本来就有三重标记：紫色左边条、右上角「调整」角标、
         下面一行紫字「已手动调整至 X月X日」，角标和文案都是直白的中文，
         不需要图例再解释一遍；抽屉标题的「含手动调整 N 天」和页脚也各说了一次。 */
      return `
      <div class="cmp-legend">
        <span class="lg"><i class="sq busy"></i>繁重</span>
        <span class="lg"><i class="sq easy"></i>轻松</span>
        <span class="lg"><i class="sq none"></i>无保养安排</span>
      </div>`;
    }

    const adjusted = flat.filter(isAdjusted).length;
    const cleared = flat.filter((c) => c.o && !c.n).length;   // 原有安排被清空
    const added = flat.filter((c) => !c.o && c.n).length;     // 原本空闲被新增
    const detail = `${cleared} 天清空、${added} 天新增、${adjusted - cleared - added} 天改量`;

    return `
      <div class="cmp-legend">
        <span class="lg"><i class="sq busy"></i>繁重</span>
        <span class="lg"><i class="sq easy"></i>轻松</span>
        <span class="lg"><i class="sq none"></i>无保养安排</span>
        ${isB()
          ? `<span class="lg"><i class="rd"></i>算法调整（共 ${adjusted - manual} 天：${detail}）</span>
             <span class="lg"><i class="sq manual"></i>人工调整（${manual} 天）</span>`
          : `<span class="lg"><i class="rd"></i>已调整（共 ${adjusted} 天：${detail}）</span>`}
      </div>`;
  }

  /* clickable=true 时每格可点进「编排调整」，并在悬浮时给出明确的可点提示 */
  /* mode: 'tune' 可点可撤销（方案B 的调整模式）
          'compare' 方案C 的对比页，常态可点；方案B 的对比页只读
          'preview' 只读 | undefined 只读（方案A）
     单元格最多三行：
       当前计划 —— 今天正在执行的
       算法方案 —— 仅在该日被人工覆盖时出现，用来显示「算法原本想怎么排」
       新方案   —— 点应用后将生效的
     未被人工改过的日子只有两行，因为那时算法方案就等于新方案。 */
  function compareCalHtml(rows, mode) {
    /* 可点的情形：
         方案 B —— 只有进入 tune 模式才可点
         方案 C —— 对比页（它只有这一页）常态可点
       mode 为 undefined 时（方案 A 的对比抽屉）必须只读，所以显式比对而非取反。 */
    const tunable = mode === 'tune' || (isC() && mode === 'compare');

    const cells = rows.map((row, ri) => row.map((c, ci) => {
      if (c.blank) {
        return `<div class="cal-cell blank ${ci === 6 ? 'last-col' : ''}"
                     style="grid-column:${ci + 2};grid-row:${ri + 1}"></div>`;
      }

      const adj = isAdjusted(c);
      const cleared = c.o && !c.n;   // 算法把原有安排清空了
      const added = !c.o && c.n;     // 算法在原本空闲的日子新增了

      const k = dayKey(c);
      const mvOut = movedFrom(k);    // 这天的活被人工挪走
      const mvIn = movedTo(k);       // 别处的活被人工挪进这天
      const manual = !!mvOut || !!mvIn;

      let title = '';
      if (mvOut) title = `人工调整：该日保养已手动调整至 ${keyLabel(mvOut.to)}`;
      else if (mvIn) title = `人工调整：自 ${keyLabel(mvIn.from)} 手动移入 ${mvIn.units} 台保养`;
      /* 悬浮提示里不受宽度限制，两端都可以把「手动」说全 */
      else if (cleared) title = '算法已清空该日安排，任务被分配到其他日期';
      else if (added) title = '算法在该日新增了保养安排';
      else if (adj) title = '该日保养量由算法调整';

      /* ① 当前计划。作为对比基线，无论有没有保养量都统一用黑字、不带底色 ——
         语义配色（橙/绿/灰）只留给下面的新方案那一行，两侧都上色会花。
         「无保养安排」原先误用了 .cmp-row.none（灰底虚线灰字），
         和同列其他当前计划行对不齐，这里改回 .orig。 */
      const baseRow = c.o
        ? `<span class="cmp-row orig">${CMP_LABEL.base} ${c.o[0]}台 ${c.o[1]}小时</span>`
        : (added ? `<span class="cmp-row orig">${CMP_LABEL.base} 无保养安排</span>` : '');

      /* ② 算法方案 —— 只在被人工覆盖的日子出现，弱化显示 */
      let algoRow = '';
      if (manual) {
        algoRow = c.n
          ? `<span class="cmp-row algo">${CMP_LABEL.algo} ${c.n[0]}台 ${c.n[1]}小时</span>`
          : `<span class="cmp-row algo">${CMP_LABEL.algo} ${REALLOCATED_NOTE}</span>`;
      }

      /* ③ 新方案。两个维度分开表达，避免挤在同一个色块上互相盖：
           色块颜色 = 新的负载水平（繁重橙 / 轻松绿 / 无安排灰虚线），全局一条规则，
                      人工调整的日子也照这条规则走，颜色才不会说谎；
           「人工改过」= 格子级标记（紫色左边条 + 调整角标 + 下面那行紫字说明）。
         数字一律写出来（含 0台 0小时），去向另起一行小字，两行都短不会换行。 */
      let finalRow = '';
      let movedNote = '';
      if (mvOut || mvIn) {
        /* 数值统一走 finalLoad，不再把搬出端写死成 0台 —— 方案 C 可以只搬走一部分。
           搬空的那天和算法清空的那天用同一套「无安排」外观，
           区别由下面那行说明承担：紫字=人工挪走，灰字=算法分摊。
           还剩着量的日子按合并后的工时现算色阶，不能沿用 c.nL（那是算法的量）。 */
        const [u, h] = finalLoad(c);
        finalRow = u === 0
          ? `<span class="cmp-row none">${CMP_LABEL.final} 0台 0小时</span>`
          : `<span class="cmp-row now ${loadLevel(h)}">${CMP_LABEL.final} ${u}台 ${h}小时</span>`;
        /* 搬出端写明「手动」——同一位置上，算法清空的日子是灰字「已分配至其他日期」，
           两者只靠颜色区分不够，文字里点出来谁动的手更保险。
           只搬走一部分时改用带张数的措辞，否则格子上还剩着量、
           说明却写「已手动调整至 X」，看着像自相矛盾。 */
        const lines = [];
        if (mvOut) {
          const whole = u === 0 && !mvIn;
          lines.push(whole
            ? `${MOVED_NOTE.out} ${keyLabel(mvOut.to)}`
            : MOVED_NOTE.outPart(mvOut.units, keyLabel(mvOut.to)));
        }
        if (mvIn) lines.push(MOVED_NOTE.inFrom(keyLabel(mvIn.from), mvIn.units));
        movedNote = lines.map((t) => `<span class="cmp-moved">${t}</span>`).join('');
      } else if (c.n) {
        finalRow = `<span class="cmp-row now ${c.nL || 'easy'}">${CMP_LABEL.final} ${c.n[0]}台 ${c.n[1]}小时</span>`;
      } else if (cleared) {
        finalRow = `<span class="cmp-row none">${CMP_LABEL.final} 0台 0小时</span>`;
        /* 算法清空不是人工调整，说明文字走中性灰，别用紫色 */
        movedNote = `<span class="cmp-moved plain">${REALLOCATED_NOTE}</span>`;
      }

      /* 调整模式下，被改过的那天可单独撤销。撤销做成挂在「调整」角标上的 ✕ ——
         沿用条件设置页「周一 ✕」那套写法，不额外占一行，格子高度不会参差。 */
      const badge = manual
        ? `<span class="src-badge manual">调整${tunable
          ? `<button class="badge-undo" data-undo-day="${mvOut ? k : mvIn.from}"
                     title="撤销该日调整" aria-label="撤销该日调整">✕</button>`
          : ''}</span>`
        : '';

      return `
      <div class="cal-cell ${adj ? 'adjusted' : ''} ${manual ? 'manual' : ''} ${ci === 6 ? 'last-col' : ''}"
           style="grid-column:${ci + 2};grid-row:${ri + 1}" ${title ? `title="${title}"` : ''}
           ${tunable ? `data-tune-day="${k}"` : ''}>
        ${dateCell(c, ci)}
        ${badge}
        ${baseRow}
        ${algoRow}
        ${finalRow}
        ${movedNote}
      </div>`;
    }).join('')).join('');

    return calShell(rows, cells, { cls: 'compare' + (tunable ? ' tunable' : '') });
  }

  /* 按源日期所在月份，从方案日历真实数据生成迷你日历（周一起始）。
     每格显示该日台数，并用红/绿点标出负载轻重，便于挑一个空闲日搬过去。
     srcKey 为当前工单原计划日期，默认选中它自己。 */
  /* selKey 为默认选中的日期，缺省就是 srcKey 自己。
     已调整过的日子会把它指向当前的目标日期，让用户一眼看到「现在排到哪天」 */
  function miniCalForMonth(srcKey, selKey) {
    const [sy, sm] = srcKey.split('-').map(Number);
    const sd = +(selKey || srcKey).split('-')[2];
    /* 汇总该月每一天的方案台数 */
    const load = {};
    CAL_PLAN.flat().forEach((c) => {
      if (c.blank || c._y !== sy || c._m !== sm) return;
      load[c.d] = { u: c.u || 0, heavy: !!c.heavy };
    });

    const first = new Date(sy, sm - 1, 1);
    const last = new Date(sy, sm, 0).getDate();
    /* 周一起始：周日(0) 要排到第 7 列 */
    const lead = (first.getDay() + 6) % 7;

    const cells = [];
    for (let i = 0; i < lead; i++) cells.push({ dim: true });
    for (let d = 1; d <= last; d++) {
      const l = load[d];
      cells.push({
        d,
        n: l ? l.u : 0,
        dot: l && l.u > 0 ? (l.heavy ? 'red' : 'green') : null,
        selected: d === sd,
        isSrc: d === +srcKey.split('-')[2],
      });
    }
    while (cells.length % 7) cells.push({ dim: true });

    const rows = [];
    for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));
    return { rows, year: sy, month: sm };
  }

  function miniCalHtml(srcKey, selKey) {
    if (srcKey) {
      const { rows } = miniCalForMonth(srcKey, selKey);
      const head = `<div class="mini-head">${ADJUST.miniWeekdays.map((w) => `<div>${w}</div>`).join('')}</div>`;
      /* 前后标记。每个格子都渲染这个 span（用不上时留空占位）——
         只给两个格子加的话，那两格会多出一行，整排日期的横向对齐就散了。
         同一格既是原日期又被选中时（刚打开、还没挪）只显示「调整前」：
         那一刻还没有「调整后」可言。 */
      const tag = (c) => {
        if (c.isSrc) return `<span class="mc-tag before">${MINI_TAG.before}</span>`;
        if (c.selected) return `<span class="mc-tag after">${MINI_TAG.after}</span>`;
        return `<span class="mc-tag empty"></span>`;
      };
      const body = rows.map((row) => `<div class="mini-row">` + row.map((c) => (c.dim
        ? `<div class="mini-cell dim"></div>`
        : `<div class="mini-cell ${c.selected ? 'selected' : ''}" data-mini-day="${c.d}">
             ${tag(c)}
             <span class="mc-day">${pad2(c.d)}</span>
             <span class="mc-load">${c.dot ? `<i class="dot ${c.dot}"></i>` : ''}${c.n}</span>
           </div>`)).join('') + `</div>`).join('');
      const legend = `<div class="mini-legend">
        <span><i style="background:var(--danger)"></i>负载偏重</span>
        <span><i style="background:var(--success-text)"></i>负载较轻</span>
        <span>数字为当日保养台数</span>
      </div>`;
      return `<div class="mini-cal">${head}${body}${legend}</div>`;
    }
    const head = `<div class="mini-head">${ADJUST.miniWeekdays.map((w) => `<div>${w}</div>`).join('')}</div>`;
    const body = ADJUST.mini.map((row) => `<div class="mini-row">` + row.map((c) => `
      <div class="mini-cell ${c.dim ? 'dim' : ''} ${c.selected ? 'selected' : ''}" data-mini="${c.d}">
        <span class="mc-day">${pad2(c.d)}</span>
        <span class="mc-load">${c.dot ? `<i class="dot ${c.dot}"></i>` : ''}${c.n}</span>
      </div>`).join('') + `</div>`).join('');
    const legend = `<div class="mini-legend">
      <span><i style="background:var(--danger)"></i>负载偏重</span>
      <span><i style="background:var(--success-text)"></i>负载较轻</span>
      <span>数字为当日保养台数</span>
    </div>`;
    return `<div class="mini-cal">${head}${body}${legend}</div>`;
  }

  /* =======================================================================
     视图：智能编排主页（截图 9）
     ===================================================================== */
  function viewSmart() {
    return `
    <div class="page">
      <h2 class="page-title">智能编排</h2>

      <div class="page-actions-row">
        <button class="btn btn-outline" id="btnSmartRecords">智能编排记录</button>
        <button class="btn btn-outline" data-go="leave">${PLAN_ADJUST_NAME}</button>
        <button class="btn btn-outline" id="btnGotoConditions">编排条件设置</button>
      </div>

      <div class="filterbar">
        <div class="field">
          <span class="field-label">工作组</span>
          ${dd('KCCW0012(赵波 张…', ['KCCW0012(赵波 张文字)'], 'control-w-md')}
        </div>
        <div class="field">
          <span class="field-label">项目信息</span>
          ${dd('', [], 'control-w-lg', '请输入项目名称或项目编号')}
        </div>
        <div class="field">
          <span class="field-label">设备信息</span>
          ${dd('', [], 'control-w-lg', '请输入设备编号或客户自编号')}
        </div>
        <div class="grow"></div>
        <button class="btn">重 置</button>
        <button class="btn btn-primary">查 询</button>
      </div>

      <div id="smartStats">${statsHtml(statsFor(STATS_CURRENT, weekSlice(CAL_CURRENT)))}</div>
      <div class="toolbar">
        <button class="btn btn-outline">导出保养计划</button>
        <button class="btn btn-primary" id="btnSmartSched">智能编排</button>
        <div class="grow"></div>
        <span class="range-pill" id="smartRange">${rangeLabel(weekSlice(CAL_CURRENT))}</span>
        ${dd(WEEK_OPTIONS[0], WEEK_OPTIONS, 'control-w-sm', '', 'smartWeeks')}
      </div>
      <!-- 方案 C：点日期进入手动调整页（并直接弹出该日的调整弹窗）。
           merged 不 marked —— 首页只呈现最终方案，调整痕迹（紫边条/角标/去向说明）
           只属于正在调整的那个页面，应用完就不该再挂在这儿。 -->
      <div id="smartCalWrap">${calHtml(CAL_CURRENT, {
        id: 'calCurrent', greenEasy: true,
        merged: isC(), enterable: isC(),
        cls: isC() ? 'enterable' : '',
      })}</div>
    </div>`;
  }

  /* 在给定容器内接线「点格子调整该日 + 角标 ✕ 撤销」。
     手动调整页面用它；首页日历只读，不调用。 */
  function bindPlanTuneCells(root) {
    $$('[data-adjust-day]', root).forEach((cell) => {
      cell.addEventListener('click', () => openPlanDayAdjust(cell.dataset.adjustDay));
    });
    /* 单日撤销：阻止冒泡，否则会同时触发该格的调整弹窗 */
    $$('[data-undo-plan]', root).forEach((btn) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const mv = planMovedFrom(btn.dataset.undoPlan);
        planMoves = planMoves.filter((m) => m.from !== btn.dataset.undoPlan);
        openPlanTune();
        if (mv) toast(`已撤销 ${keyLabel(mv.from)} → ${keyLabel(mv.to)} 的调整`);
      });
    });
  }

  function bindCalCells(sel) {
    // 空格（起始日之前）不参与点击
    $$(`${sel} .cal-cell:not(.blank)`).forEach((cell) => {
      cell.addEventListener('click', () => openAdjust());
    });
  }

  const planDayCell = (key) => CAL_CURRENT.flat().find((x) => !x.blank && dayKey(x) === key);

  /* 首页日历某天的保养量 [台数, 工时]，叠加 planMoves 之后的结果。
     搬出不再一律归零 —— 勾选式调整可以只搬走当天的一部分工单，
     所以搬出和搬入都按量加减，同一天两者并存也算得对。 */
  function planDayLoad(key) {
    const c = planDayCell(key);
    if (!c) return [0, 0];
    const mvOut = planMovedFrom(key);
    const mvIn = planMovedTo(key);
    let u = c.u || 0;
    let h = c.h || 0;
    if (mvOut) { u -= mvOut.units; h -= mvOut.hours; }
    if (mvIn) { u += mvIn.units; h += mvIn.hours; }
    return [Math.max(0, u), Math.max(0, Math.round(h * 100) / 100)];
  }

  /* 某天在「本次搬出」之前的全天量：基础量 + 搬入，不减搬出。
     重新编辑已调整过的日子时，弹窗要据此列出完整工单清单。 */
  function planDayLoadBeforeOut(key) {
    const c = planDayCell(key);
    if (!c) return [0, 0];
    const mvIn = planMovedTo(key);
    const u = (c.u || 0) + (mvIn ? mvIn.units : 0);
    const h = (c.h || 0) + (mvIn ? mvIn.hours : 0);
    return [u, Math.round(h * 100) / 100];
  }

  /* 首页：点某天 → 把该日工单调整到别的日期。
     与抽屉内 openManualTune 同一套交互：已调整过的日子重开时默认选中当前目标日，
     选回原日期即撤销，同一天重复调整覆盖旧记录。 */
  function openPlanDayAdjust(key) {
    const mv = planMovedFrom(key) || planMovedTo(key);
    const srcKey = mv ? mv.from : key;
    const selKey = mv ? mv.to : key;
    openAdjust({
      srcKey,
      selKey,
      /* 量取「本次搬出之前」的全天量，不是搬出后剩下的 ——
         重新编辑那天时要列出完整工单、把上次挑走的勾回来，
         只列剩下的会让已调整的工单凭空消失，也没法取消部分调整。
         数据源是 CAL_CURRENT + planMoves，不能让弹窗去读智能编排方案。 */
      load: planDayLoadBeforeOut(srcKey),
      /* 勾选决定搬哪几张工单。只在这条线开启：智能编排那条线按整天搬 */
      pickable: true,
      picked: mv && mv.orders ? mv.orders.map((o) => o.no) : null,
      onCancel: backFromPlanAdjust,
      onConfirm: (toDay, list) => {
        const [y, m] = srcKey.split('-').map(Number);
        const toKey = toDay ? `${y}-${m}-${toDay}` : srcKey;

        if (toKey === srcKey) {
          const had = !!planMovedFrom(srcKey);
          planMoves = planMoves.filter((x) => x.from !== srcKey);
          backFromPlanAdjust();
          toast(had ? `已撤销 ${keyLabel(srcKey)} 的调整`
            : '目标日期与原计划日期相同，未产生调整');
          return;
        }

        /* 搬移量由勾选的工单算出，而不是整天的量 —— 勾了 3 张就只动 3 张。
           工单清单一并记下来，应用确认里的明细直接列这几张，
           不再按数量现生成一串连号工单（那样会和弹窗里挑的对不上）。 */
        const orders = list || [];
        const units = orders.length;
        const hours = Math.round(orders.reduce((s, o) => s + o.minutes, 0) / 60 * 100) / 100;
        planMoves = planMoves.filter((x) => x.from !== srcKey);
        planMoves.push({ from: srcKey, to: toKey, units, hours, orders });
        openPlanTune();
        const base = planDayLoadBeforeOut(srcKey)[0];
        toast(units < base
          ? `已将 ${keyLabel(srcKey)} 的 ${units} 张工单调整至 ${keyLabel(toKey)}`
          : `已将 ${keyLabel(srcKey)} 的保养调整至 ${keyLabel(toKey)}`);
      },
    });
  }

  /* 取消调整后的去向。本次进来还没改出任何东西就一路退回首页 ——
     退到一个只剩「返回」按钮的空调整页，等于逼用户再点一次返回。
     已经改过几天则留在调整页，否则会把前面的调整一起丢掉。 */
  function backFromPlanAdjust() {
    const same = planMoves.length === planMovesSnapshot.length
      && planMoves.every((m, i) => {
        const s = planMovesSnapshot[i];
        return s && s.from === m.from && s.to === m.to && s.units === m.units;
      });
    if (!same) { openPlanTune(); return; }
    planMoves = planMovesSnapshot.slice();
    closeOverlays();
    renderView('smart');
  }

  /* =======================================================================
     手动调整保养计划（方案 C，不经过智能编排）
     只有一个页面：点首页日期进来，改完「确认应用方案」直接落地并退回首页。
     不另设最终预览页 —— 首页本身就是最终方案的呈现，再插一页只是重复一遍。
     「返回 / 确认应用方案」这对边界要留着：改的是正在执行的计划，
     不能点一下日期就直接把它改掉。
     ===================================================================== */
  /* 进入手动调整时的快照，用于「返回」时整组丢弃 */
  let planMovesSnapshot = [];

  function openPlanTune() {
    const n = new Set(planMoves.flatMap((m) => [m.from, m.to])).size;

    const body = `
          <div id="planTuneStats">${
            statsHtml(statsFor(STATS_CURRENT, weekSlice(CAL_CURRENT)))}</div>
          <div class="toolbar">
            <div class="grow"></div>
            <span class="range-pill" id="planTuneRange">${rangeLabel(weekSlice(CAL_CURRENT))}</span>
            ${dd(WEEK_OPTIONS[0], WEEK_OPTIONS, 'control-w-sm', '', 'planTuneWeeks')}
          </div>
          <div id="planTuneCalWrap">${calHtml(CAL_CURRENT, {
      id: 'calPlanTune', greenEasy: true,
      /* 正在改，所以数值合并 + 痕迹可见 + 可就地编辑 */
      merged: true, marked: true, adjustable: true,
      cls: 'marked adjustable',
    })}</div>`;

    /* 改过东西才出现「确认应用方案」—— 没调整过没什么可应用的，那时只留「返回」 */
    const foot = `
          <span class="foot-hint">${n
      ? `已调整 ${n} 天，可继续点击日历调整`
      : PLAN_TUNE_TEXT.hint}</span>
          <div class="grow"></div>
          <button class="btn" id="btnPlanTuneCancel">${PLAN_TUNE_TEXT.cancel}</button>
          ${n
      ? `<button class="btn btn-primary" id="btnPlanTuneApply">${PLAN_TUNE_TEXT.apply}</button>`
      : ''}`;

    mountOverlay(`
      <div class="mask" data-close-drawer></div>
      <aside class="drawer" id="planTuneDrawer">
        <!-- 标题栏不放「已调整 N 天」角标：页脚提示已经说了同一件事，
             日历上每个被改过的格子还有紫边条和「调整」角标，标题再挂一个是第三遍 -->
        <div class="drawer-head">
          <span class="grow">${PLAN_TUNE_TEXT.title}</span>
          <button class="icon-btn" title="全屏">${expandIco}</button>
          <button class="icon-btn" data-close-drawer title="关闭">${closeX}</button>
        </div>
        <div class="drawer-body">${body}</div>
        <div class="drawer-foot">${foot}</div>
      </aside>`);

    const on = (sel, fn) => { const el = $(sel); if (el) el.addEventListener('click', fn); };
    /* 返回 = 丢弃本次进入后的全部调整，回到进入前的状态 */
    on('#btnPlanTuneCancel', () => {
      planMoves = planMovesSnapshot.slice();
      closeOverlays();
      renderView('smart');
      toast('已返回，本次调整未保存');
    });
    /* 确认应用方案：先弹确认框列出改了哪些工单，与智能编排那条线口径一致 ——
       改的是正在执行的计划，不该点一下就落地 */
    on('#btnPlanTuneApply', confirmApplyPlanTune);

    bindPlanTuneCells($('#planTuneCalWrap'));

    initWidgets(overlayMount);
    bindCalScroll(overlayMount);
    setupTierSync({
      scroller: $('#calPlanTune .cal-scroll'),
      ctl: $('#planTuneWeeks'),
      rows: CAL_CURRENT,
      rangeEl: $('#planTuneRange'),
      statsEl: $('#planTuneStats'),
      statsBase: STATS_CURRENT,
    });
  }

  /* 应用手动调整前的确认框。结构与智能编排方案的确认框一致（按项目分组、
     明细可展开），区别是这条线里每一行都是手动的，所以不渲染「调整方式」列 ——
     整列重复同一个值没有信息量。 */
  function confirmApplyPlanTune() {
    const groups = groupOrdersByProject(planTuneOrderRows());
    const days = new Set(planMoves.flatMap((m) => [m.from, m.to])).size;

    overlayMount.insertAdjacentHTML('beforeend', `
      <div id="planTuneConfirmLayer">
        <div class="mask" data-close-ptconfirm></div>
        <div class="modal-wrap">
          <div class="modal modal-confirm modal-confirm-wide" id="planTuneConfirmModal"
               role="alertdialog" aria-labelledby="ptConfirmTitle">
            <button class="icon-btn confirm-close" data-close-ptconfirm
                    aria-label="关闭">${closeX}</button>
            <div class="modal-body">
              <div class="confirm-body">
                <span class="confirm-icon warn">${icon('complaint', 22, 1.7)}</span>
                <div class="confirm-main">
                  <div class="confirm-title" id="ptConfirmTitle">${PLAN_TUNE_CONFIRM.title}</div>
                  ${planTuneSummaryHtml(groups)}
                  <div class="confirm-warnline">${PLAN_TUNE_CONFIRM.warn}</div>
                </div>
              </div>
            </div>
            <div class="modal-foot">
              <button class="btn" data-close-ptconfirm>取 消</button>
              <button class="btn btn-primary" id="btnPlanTuneConfirmApply">确认应用</button>
            </div>
          </div>
        </div>
      </div>`);

    const layer = $('#planTuneConfirmLayer');
    /* 取消只关确认框，留在手动调整页继续改 */
    $$('[data-close-ptconfirm]', layer).forEach((el) =>
      el.addEventListener('click', () => layer.remove()));
    bindOrderGroupExpand(layer, groups, false);

    $('#btnPlanTuneConfirmApply', layer).addEventListener('click', () => {
      layer.remove();
      /* 落地为当前计划：快照跟进，之后「返回」不再回滚它 */
      planMovesSnapshot = planMoves.slice();
      closeOverlays();
      renderView('smart');
      toast(`保养计划已更新（${days} 天手动调整）`);
    });
  }

  /* 从首页点某一天进入手动调整：记快照（「返回」时整组回滚），
     开页面，并立刻弹出被点那天的调整弹窗 —— 用户点的就是「要调这天」，
     不该让他进来之后再点一次。 */
  function enterPlanTune(key) {
    planMovesSnapshot = planMoves.slice();
    openPlanTune();
    if (key) openPlanDayAdjust(key);
  }

  function bindSmart() {
    /* 「智能编排」直接触发生成（条件设置已有独立入口）；首次点击先弹引导 */
    const b = $('#btnSmartSched');
    if (b) b.addEventListener('click', triggerSmartSchedule);

    /* 方案 C：点首页日历的某一天 → 进手动调整页并直接弹出该日的调整弹窗 */
    $$('#smartCalWrap [data-enter-day]').forEach((cell) => {
      cell.addEventListener('click', () => enterPlanTune(cell.dataset.enterDay));
    });

    setupTierSync({
      scroller: $('#calCurrent .cal-scroll'),
      ctl: $('#smartWeeks'),
      rows: CAL_CURRENT,
      rangeEl: $('#smartRange'),
      statsEl: $('#smartStats'),
      statsBase: STATS_CURRENT,
    });

    // 走 gotoConditions 而非通用 data-go，才能带上首次进入的引导
    const c = $('#btnGotoConditions');
    if (c) c.addEventListener('click', gotoConditions);

    /* 智能编排记录：现网有此入口，但没有对应截图，暂不臆造页面。
       给出明确反馈，避免在原型里表现为「按了没反应」。 */
    const rec = $('#btnSmartRecords');
    if (rec) rec.addEventListener('click', () => toast('智能编排记录：暂无设计稿，未实现此页'));

    /* 点击日历单元格 → 编排调整。
       方案 C 下已由上面的 data-enter-day 接管（进手动调整页并带上被点日期），
       这里不能再绑：两个处理器都会 mountOverlay，后跑的那个会把前者顶掉，
       结果打开的是无参数的静态示例弹窗（原计划日期固定 2026-09-28）。 */
    if (!isC()) bindCalCells('#calCurrent');
    bindCalScroll($('#smartCalWrap'));
  }

  /* 月份标签吸顶后，该月即将滚出可视区时渐隐，提示这个月已成为「过去」 */
  function bindCalScroll(root) {
    $$('.cal-scroll', root || document).forEach((sc) => {
      if (sc.dataset.boundScroll) return;
      sc.dataset.boundScroll = '1';
      const update = () => {
        const top = sc.getBoundingClientRect().top;
        $$('.cal-month.has-label', sc).forEach((el) => {
          const inner = $('.cm-inner', el);
          if (!inner) return;
          const remain = el.getBoundingClientRect().bottom - top;
          const zone = inner.offsetHeight + 24;
          const op = remain >= zone ? 1 : Math.max(0.15, remain / zone);
          inner.style.opacity = op.toFixed(2);
        });
      };
      sc.addEventListener('scroll', update, { passive: true });
      update();
    });
  }

  /* =======================================================================
     视图：智能编排条件设置（截图 7 / 8）
     ===================================================================== */
  function viewConditions() {
    const rows = CONDITION_PROJECTS.map((p, i) => {
      const nested = p.devices.length ? `
        <tr class="nested-row" data-nested="${i}" ${p.open ? '' : 'style="display:none"'}>
          <td class="nested-wrap" colspan="8">
            <table class="table-nested">
              <thead>
                <tr>
                  <th class="col-narrow"></th>
                  <th>设备编号</th>
                  <th>客户自编号</th>
                  <th><span class="th-help">可保养日期${help('设备允许安排保养的星期，留空表示不限制。')}</span></th>
                  <th>保养时段要求</th>
                  <th><span class="th-help">动态保养间隔设置${help('开启后系统按实际保养完成时间动态推算下次保养日期。')}</span></th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                ${p.devices.map((d) => `
                  <tr>
                    <td><span class="checkbox"><span class="check-box"></span></span></td>
                    <td>${d.no}</td>
                    <td>${d.alias}</td>
                    <td>
                      <div class="tag-box">
                        ${d.days.map((w) => `<span class="tag-day">${w}<span class="x">✕</span></span>`).join('')}
                      </div>
                    </td>
                    <td>${d.period}</td>
                    <td>${dd(d.dynamic, ['是', '否'], 'control-w-lg')}</td>
                    <td><button class="btn-link">恢复默认</button></td>
                  </tr>`).join('')}
              </tbody>
            </table>
          </td>
        </tr>` : '';

      return `
        <tr>
          <td class="col-narrow">
            ${p.devices.length
              ? `<span class="expander" data-expand="${i}">${p.open ? '−' : '+'}</span>`
              : `<span class="expander" data-expand="${i}">+</span>`}
          </td>
          <td><span class="checkbox"><span class="check-box"></span></span></td>
          <td class="ellip" title="${p.name}">${p.name}</td>
          <td>${p.code}</td>
          <td class="ellip" title="${p.addr}">${p.addr}</td>
          <td>${p.count}</td>
          <td>${numInput(p.maxDaily, MAX_DAILY_UNITS.unit, 'maxDaily-' + p.code, true)}</td>
          <td class="col-actions"><button class="btn-link">编辑</button></td>
        </tr>
        ${nested}`;
    }).join('');

    return `
    <div class="breadcrumb">
      <span>编排管理</span><span class="sep">/</span>
      <span>智能编排</span><span class="sep">/</span>
      <span class="cur">智能编排条件设置</span>
    </div>
    <div class="page">
      ${firstFlow.active ? stepsHtml(0) : ''}
      <div class="alert" id="condAlert">
        <span class="ai">${icon('complaint', 14)}</span>
        <span class="ac">已为您选择的工作组所有项目填充了默认的条件，请您确认或调整。</span>
        <span class="ax" data-close-alert>✕</span>
      </div>

      <div class="filterbar">
        <div class="field">
          <span class="field-label">项目信息</span>
          ${dd('', [], 'control-w-xl', '请输入项目名称或项目编号')}
        </div>
        <div class="field">
          <span class="field-label">动态保养间隔</span>
          ${dd('', ['是', '否'], 'control-w-md', '请选择')}
        </div>
        <div class="grow"></div>
        <button class="btn">重 置</button>
        <button class="btn btn-primary">查 询</button>
      </div>

      <div class="toolbar">
        <div class="field">
          <span class="field-label">是否托管</span>
          <span class="switch" data-switch></span>
          ${help(CONDITION_TIP)}
        </div>
        <div class="grow"></div>
        <button class="btn btn-primary">批量编辑</button>
      </div>

      <table class="table" id="condTable">
        <thead>
          <tr>
            <th class="col-narrow"></th>
            <th class="col-narrow"><span class="checkbox"><span class="check-box"></span></span></th>
            <th>项目信息</th>
            <th>项目编号</th>
            <th>项目地址</th>
            <th>设备台数</th>
            <th class="col-nowrap">
              <span class="th-help">${MAX_DAILY_UNITS.label}${help(MAX_DAILY_UNITS.tip)}</span>
            </th>
            <th class="col-actions">操作</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div class="modal-foot center" style="padding-top:18px">
        <button class="btn" data-go="smart">返 回</button>
        <button class="btn btn-primary" id="btnCondConfirm">确 定</button>
      </div>
    </div>`;
  }

  function bindConditions() {
    $$('#condTable [data-expand]').forEach((ex) => {
      ex.addEventListener('click', () => {
        const i = ex.dataset.expand;
        const row = $(`#condTable [data-nested="${i}"]`);
        if (!row) return;
        const showing = row.style.display !== 'none';
        row.style.display = showing ? 'none' : '';
        ex.textContent = showing ? '+' : '−';
      });
    });

    const cb = $('#btnCondConfirm');
    if (cb) cb.addEventListener('click', confirmConditions);
  }

  /* =======================================================================
     视图：人员安排（截图 6）
     ===================================================================== */
  /* 列表的工作副本 —— 删除操作只动副本，不污染原始数据 */
  let leaveRows = LEAVE_RECORDS.slice();

  const EMPTY_SVG = `
    <svg width="64" height="41" viewBox="0 0 64 41" fill="none" aria-hidden="true">
      <ellipse cx="32" cy="33" rx="32" ry="7" fill="#f5f5f5"/>
      <path d="M55 12.8 44.9 1.2C44.4.5 43.6 0 42.8 0H21.2c-.8 0-1.6.5-2.1 1.2L9 12.8v9.1h46v-9.1Z"
            stroke="#d9d9d9" stroke-width="1.2" fill="#fafafa"/>
      <path d="M41.6 17.1c0-1.4.8-2.5 1.9-2.5H55v13.4c0 1.9-1.3 3.4-2.9 3.4H11.9C10.3 31.4 9 29.9 9 28V14.6h11.5c1.1 0 1.9 1.1 1.9 2.5 0 1.4.9 2.5 1.9 2.5h15.4c1 0 1.9-1.2 1.9-2.5Z"
            fill="#fff" stroke="#d9d9d9" stroke-width="1.2"/>
    </svg>`;

  function viewLeave() {
    return `
    <div class="breadcrumb">
      <span>编排管理</span><span class="sep">/</span>
      <span>智能编排</span><span class="sep">/</span>
      <span class="cur">${PLAN_ADJUST_NAME}</span>
    </div>
    <div class="page">
      ${firstFlow.active ? stepsHtml(1) : ''}
      <div class="filterbar">
        <div class="field">
          <span class="field-label">工作组</span>
          ${dd('赵波 张文字（KCCW0012）', ['赵波 张文字（KCCW0012）'], 'control-w-xl')}
        </div>
        <div class="field">
          <span class="field-label">类型</span>
          ${dd(LEAVE_FILTER_ALL, LEAVE_FILTER_OPTIONS, 'control-w-md', '', 'leaveTypeFilter')}
        </div>
        <button class="btn btn-primary" id="btnLeaveSearch">搜 索</button>
        <div class="grow"></div>
        ${firstFlow.active
          ? `<button class="btn btn-primary" id="btnLeaveNew">新 增</button>`
          : `<button class="btn" data-go="smart">返 回</button>
             <button class="btn btn-primary" id="btnLeaveNew">新 增</button>`}
      </div>

      <div id="leaveTableWrap">${leaveTableHtml(LEAVE_FILTER_ALL)}</div>
      <div class="table-scrollbar"></div>

      ${firstFlow.active ? `
      <!-- 首次流程的步骤动作放在页面底部居中，与「智能编排条件设置」的
           返回 / 确定 保持同一种位置与样式 -->
      <div class="modal-foot center" style="padding-top:18px">
        <button class="btn" id="btnFlowBack">返 回</button>
        <button class="btn btn-primary" id="btnFlowFinish">完成设置并生成方案</button>
      </div>` : ''}
    </div>`;
  }

  /* 按类型筛选并渲染全量字段：人员 / 类型 / 开始时间 / 结束时间 / 时长 / 操作 */
  function leaveTableHtml(filterLabel) {
    const rows = filterLabel && filterLabel !== LEAVE_FILTER_ALL
      ? leaveRows.filter((r) => LEAVE_TYPE_LABEL[r.type] === filterLabel)
      : leaveRows;

    const head = `
      <thead>
        <tr>
          <th>人员</th>
          <th>类型</th>
          <th>开始时间</th>
          <th>结束时间</th>
          <th class="col-actions">操作</th>
        </tr>
      </thead>`;

    if (!rows.length) {
      return `<table class="table">${head}</table>
        <div class="empty">${EMPTY_SVG}<div class="empty-text">这里空空如也</div></div>`;
    }

    const body = rows.map((r) => {
      const i = leaveRows.indexOf(r);
      const tone = r.type === 'restdayOn' ? 'restday' : 'workday';
      return `
        <tr>
          <td>${r.staff}</td>
          <td><span class="tag-leave ${tone}">${LEAVE_TYPE_LABEL[r.type]}</span></td>
          <td>${r.start}</td>
          <td>${r.end}</td>
          <td class="col-actions">
            <button class="btn-link danger" data-leave-revoke="${i}">撤销</button>
          </td>
        </tr>`;
    }).join('');

    const summary = `
      <div class="list-summary">
        共 ${rows.length} 条${filterLabel && filterLabel !== LEAVE_FILTER_ALL ? `（已按「${filterLabel}」筛选，全部 ${leaveRows.length} 条）` : ''}
      </div>`;

    return summary + `<table class="table">${head}<tbody>${body}</tbody></table>`;
  }

  function refreshLeaveTable() {
    const ctl = $('#leaveTypeFilter');
    const wrap = $('#leaveTableWrap');
    if (!wrap) return;
    wrap.innerHTML = leaveTableHtml(ctl ? ddValue(ctl) : LEAVE_FILTER_ALL);
    initWidgets(wrap);
    bindLeaveRows();
  }

  function bindLeaveRows() {
    /* 撤销申请（非删除记录）：撤销后该条不再参与编排计算 */
    $$('[data-leave-revoke]').forEach((b) => {
      if (b.dataset.bound) return;
      b.dataset.bound = '1';
      b.addEventListener('click', () => {
        const r = leaveRows[+b.dataset.leaveRevoke];
        leaveRows = leaveRows.filter((x) => x !== r);
        refreshLeaveTable();
        toast(`已撤销申请：${r.staff} ${r.start}「${LEAVE_TYPE_LABEL[r.type]}」`);
      });
    });
  }

  function bindLeave() {
    const n = $('#btnLeaveNew');
    if (n) n.addEventListener('click', () => openLeaveModal());

    // 类型筛选：选中即刷新列表
    const ctl = $('#leaveTypeFilter');
    if (ctl) ctl.addEventListener('dd:change', refreshLeaveTable);

    const s = $('#btnLeaveSearch');
    if (s) s.addEventListener('click', refreshLeaveTable);

    /* 首次流程里「返回」退到上一步（编排条件设置），而不是跳回首页 */
    const bk = $('#btnFlowBack');
    if (bk) bk.addEventListener('click', () => {
      firstFlow.step = 0;
      goScreen('conditions');
    });

    /* 首次流程的收尾：走到第 3 步，生成方案 */
    const f = $('#btnFlowFinish');
    if (f) f.addEventListener('click', () => {
      firstFlow.step = 2;
      firstFlow.active = false;
      renderView('smart');
      startGenerating();
    });

    bindLeaveRows();
  }

  /* =======================================================================
     浮层：查看智能编排方案（截图 3）
     ===================================================================== */
  function openPlanDrawer() {
    if (isFlow()) return openPlanFlowB();
    const html = `
      <div class="mask" data-close-drawer></div>
      <aside class="drawer" id="planDrawer">
        <div class="drawer-head">
          <span class="grow">查看智能编排方案</span>
          <button class="icon-btn" title="全屏">${expandIco}</button>
          <button class="icon-btn" data-close-drawer title="关闭">${closeX}</button>
        </div>
        <div class="drawer-body">
          <div class="filterbar">
            <div class="field">
              <span class="field-label">工作组</span>
              ${dd('KCCW0012(赵波 张…', ['KCCW0012(赵波 张文字)'], 'control-w-md')}
            </div>
            <div class="field">
              <span class="field-label">项目信息</span>
              ${dd('', [], 'control-w-lg', '请输入项目名称或项目编号')}
            </div>
            <div class="field">
              <span class="field-label">设备信息</span>
              ${dd('', [], 'control-w-lg', '请输入设备编号或客户自编号')}
            </div>
            <div class="grow"></div>
            <button class="btn">重 置</button>
            <button class="btn btn-primary">查 询</button>
          </div>

          <div id="planStats">${statsHtml(statsFor(STATS_PLAN, weekSlice(CAL_PLAN)))}</div>

          <div class="toolbar">
            ${isFlow() ? '' : `
            <button class="btn btn-outline" id="btnCompare">对比当前日历</button>
            <button class="btn btn-primary" id="btnApplyPlan">应用方案</button>`}
            <div class="grow"></div>
            <span class="range-pill" id="planRange">${rangeLabel(weekSlice(CAL_PLAN))}</span>
            ${dd(WEEK_OPTIONS[0], WEEK_OPTIONS, 'control-w-sm', '', 'planWeeks')}
          </div>

          <div id="planCalWrap">${calHtml(CAL_PLAN, { id: 'calPlan', greenEasy: true })}</div>
        </div>
      </aside>`;

    mountOverlay(html);

    $('#btnCompare').addEventListener('click', openCompareDrawer);

    const ap = $('#btnApplyPlan');
    if (ap) ap.addEventListener('click', () => { closeOverlays(); applyPlan(); });

    bindPlanCells();
    initWidgets(overlayMount);
    bindCalScroll(overlayMount);

    setupTierSync({
      scroller: $('#calPlan .cal-scroll'),
      ctl: $('#planWeeks'),
      rows: CAL_PLAN,
      rangeEl: $('#planRange'),
      statsEl: $('#planStats'),
      statsBase: STATS_PLAN,
    });
  }

  /* =======================================================================
     方案 B：单层抽屉，两步原地切换
       第 1 步 对比差异 —— 评估主场，点任意日期手动调整该日编排
       第 2 步 确认应用 —— 只看将生效的最终方案 + 影响摘要
     刻意不用叠层抽屉：先后关系不该用父子层级表达。
     ===================================================================== */
  /* 方案 B 的三种视图，同一层抽屉内切换：
       compare —— 默认。只读对比，不能点日历
       tune    —— 手动调整模式。日历可点，被改过的日子可单独撤销
       preview —— 完成调整后的预览，只读，用于核对人工改了什么
     方案 B 刻意把手动调整做成独立模式：避免误触，也让「现在在改方案」有明确状态。

     方案 C 砍掉 tune 这一档，只剩 compare / preview：
       日历在对比页就常态可点，点哪天调哪天，不必先按按钮进入某个模式。
       取舍：少一道门槛、少一个状态，代价是失去「我正在改方案」的显式边界。 */
  let planView = 'compare';

  /* 「可以改方案」的那个视图：方案 B 是 tune，方案 C 就是 compare。
     调整/撤销完成后要回到哪儿，全部走这个函数，免得两套流程各写一遍。 */
  const editView = () => (isC() ? 'compare' : 'tune');

  function openPlanFlowB(view) {
    planView = view || 'compare';
    /* 方案 C 只有 compare 一个视图（既没有 tune 模式，也取消了 preview 这一步），
       万一被旧链接或历史调用带进来，统一归一到 compare */
    if (isC() && planView !== 'compare') planView = 'compare';
    const isTune = planView === 'tune';
    const isPreview = planView === 'preview';

    const filterbar = `
          <div class="filterbar">
            <div class="field">
              <span class="field-label">工作组</span>
              ${dd('KCCW0012(赵波 张…', ['KCCW0012(赵波 张文字)'], 'control-w-md')}
            </div>
            <div class="field">
              <span class="field-label">项目信息</span>
              ${dd('', [], 'control-w-lg', '请输入项目名称或项目编号')}
            </div>
            <div class="field">
              <span class="field-label">设备信息</span>
              ${dd('', [], 'control-w-lg', '请输入设备编号或客户自编号')}
            </div>
            <div class="grow"></div>
            <button class="btn">重 置</button>
            <button class="btn btn-primary">查 询</button>
          </div>`;

    /* 三个视图的顶部完全一致（查询条件 + KPI）——预览只是把底部动作换成「应用」，
       没必要换一套头部；影响摘要留在点「应用方案」后的确认弹窗里说。 */
    const body = `
          ${filterbar}
          <div id="planStats">${
            deltaStatsHtml(weekSlice(CAL_CURRENT), weekSlice(CAL_PLAN))}</div>

          <div class="toolbar">
            <div id="compareLegend">${compareLegendHtml(weekSlice(CAL_COMPARE))}</div>
            <!-- 图例旁的这个槽位只有方案 B 用：
                   对比 / 预览 → 「手动调整」入口；调整模式 → 「撤销调整」。
                 方案 C 这里一律留空 —— 入口是点日历，撤销改叫「取消调整」挪到页脚
                 与「确认调整」成对，同一个动作不在两处各放一个按钮。 -->
            ${isC()
              ? ''
              : (isTune
                ? (isTuned()
                  ? `<button class="btn btn-undo" id="btnUndoAll">${PLAN_B_TEXT.undoAll}</button>`
                  : '')
                : `<button class="btn btn-manual" id="btnEnterTune">
                     <span class="bm-ico">${icon('repair', 13, 1.8)}</span>${PLAN_B_TEXT.tune}
                   </button>`)}
            <div class="grow"></div>
            <span class="range-pill" id="planRange">${rangeLabel(weekSlice(CAL_PLAN))}</span>
            ${dd(WEEK_OPTIONS[0], WEEK_OPTIONS, 'control-w-sm', '', 'planWeeks')}
          </div>

          <div id="compareWrap">${compareCalHtml(CAL_COMPARE, planView)}</div>`;

    let foot;
    if (isPreview) {
      /* 方案 B 的预览：只读，日历点不动，所以必须留一条明确的回头路 */
      foot = `
          <div class="grow"></div>
          <span class="foot-hint warn">${PLAN_B_TEXT.applyWarn}</span>
          <button class="btn" id="btnBackToTune">${PLAN_B_TEXT.backToTune}</button>
          <button class="btn btn-primary" id="btnApplyB">${PLAN_B_TEXT.apply}</button>`;
    } else if (isC()) {
      /* 方案 C 只有这一个页面。取消了「调整后方案预览」那一步 ——
         人工调整的结果本来就直接画在这张日历上（紫边条、调整角标、已手动调整至 X 日），
         再单独给一页只是把同样的内容重复一遍。
         确认即应用：主操作点下去直接弹应用确认框，调整明细在框里逐条列出。

         左侧常驻「点日历就能调」的提示 —— 没有入口按钮，
         可点这件事只剩 hover 高亮在暗示，这句话必须留着。 */
      foot = `
          <span class="foot-hint">${isTuned()
            ? `已手动调整 ${manualDayCount()} 天，可继续点击日历调整`
            : PLAN_C_TEXT.clickHint}</span>
          <div class="grow"></div>
          <span class="foot-hint warn">${isTuned() ? PLAN_B_TEXT.applyWarn : ''}</span>
          <button class="btn" id="btnRegen">${PLAN_B_TEXT.regen}</button>
          ${isTuned()
            ? `<button class="btn btn-undo" id="btnUndoAll">${PLAN_C_TEXT.cancelTune}</button>
               <button class="btn btn-primary" id="btnApplyB">${PLAN_C_TEXT.confirmApply}</button>`
            : `<button class="btn btn-primary" id="btnApplyB">${PLAN_B_TEXT.apply}</button>`}`;
    } else if (isTune) {
      /* 方案 B 的调整模式：撤销在工具栏（与手动调整同槽位），页脚只留「完成调整」 */
      foot = `
          <span class="foot-hint">${PLAN_B_TEXT.tuneHint}</span>
          <div class="grow"></div>
          <button class="btn btn-primary" id="btnTuneDone">${PLAN_B_TEXT.tuneDone}</button>`;
    } else {
      /* 方案 B 的对比页：手动调整在图例那排，这里只留「重新生成 / 应用」两条出路 */
      foot = `
          <div class="grow"></div>
          <span class="foot-hint">核对差异后应用方案</span>
          <button class="btn" id="btnRegen">${PLAN_B_TEXT.regen}</button>
          <button class="btn btn-primary" id="btnApplyB">${PLAN_B_TEXT.apply}</button>`;
    }

    const title = isPreview ? PLAN_B_TEXT.previewTitle
      : (isTune ? `${PLAN_B_TEXT.title} · ${PLAN_B_TEXT.tune}` : PLAN_B_TEXT.title);

    mountOverlay(`
      <div class="mask" data-close-drawer></div>
      <aside class="drawer" id="planDrawer" data-view="${planView}">
        <div class="drawer-head">
          <span class="grow">${title}</span>
          ${isTuned() ? `<span class="tag-tuned">${PLAN_B_TEXT.tunedTag} ${manualDayCount()} 天</span>` : ''}
          <button class="icon-btn" title="全屏">${expandIco}</button>
          <button class="icon-btn" data-close-drawer title="关闭">${closeX}</button>
        </div>
        <div class="drawer-body">${body}</div>
        <div class="drawer-foot">${foot}</div>
      </aside>`);

    /* 各视图的动作接线 */
    const on = (sel, fn) => { const el = $(sel); if (el) el.addEventListener('click', fn); };

    on('#btnRegen', regenerateFromConditions);
    on('#btnApplyB', confirmApplyPlan);
    on('#btnEnterTune', () => openPlanFlowB('tune'));
    on('#btnTuneDone', () => openPlanFlowB('preview'));
    /* 预览返回：B 回调整模式，C 没有那一档，回对比页（那里本来就能点） */
    on('#btnBackToTune', () => openPlanFlowB(editView()));
    on('#btnUndoAll', undoManualTunes);

    /* 日历可点就要接线。B 只在调整模式可点；C 只有对比页，常态可点 */
    if (isTune || isC()) {
      /* 点任意日期 → 把该日保养搬到别的日期 */
      $$('#compareWrap [data-tune-day]').forEach((cell) => {
        cell.addEventListener('click', () => openManualTune(cell.dataset.tuneDay));
      });
      /* 单日撤销：阻止冒泡，否则会同时触发该格的调整弹窗 */
      $$('#compareWrap [data-undo-day]').forEach((btn) => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          undoOneTune(btn.dataset.undoDay);
        });
      });
    }

    initWidgets(overlayMount);
    bindCalScroll(overlayMount);

    setupTierSync({
      scroller: $('.cal.compare .cal-scroll'),
      ctl: $('#planWeeks'),
      rows: CAL_COMPARE,
      rangeEl: $('#planRange'),
      legendEl: $('#compareLegend'),
      statsEl: $('#planStats'),
      // KPI 是「当前计划 vs 新方案」的涨跌，需按档位同时切两份数据
      renderStats: (label) =>
        deltaStatsHtml(weekSlice(CAL_CURRENT, label), weekSlice(CAL_PLAN, label)),
    });
  }

  /* 影响摘要：应用会改动多少天、分别属于哪一类 */
  function applySummaryHtml() {
    const flat = CAL_COMPARE.flat().filter((c) => !c.blank);
    const adjusted = flat.filter(isAdjusted).length;
    const cleared = flat.filter((c) => c.o && !c.n).length;
    const added = flat.filter((c) => !c.o && c.n).length;
    const manual = flat.filter((c) => isManualDay(dayKey(c))).length;
    const a = loadDays(CAL_CURRENT);
    const b = loadDays(CAL_PLAN);
    return `
      <div class="apply-sum">
        <div class="as-head">应用范围 <b>${rangeLabel(CAL_PLAN)}</b>，共调整 <b>${adjusted}</b> 天</div>
        <ul class="as-list">
          <li><i class="as-dot none"></i>${cleared} 天原计划清空，已分配至其他日期</li>
          <li><i class="as-dot add"></i>${added} 天新增保养安排</li>
          <li><i class="as-dot chg"></i>${adjusted - cleared - added} 天保养量变更</li>
          ${manual ? `<li><i class="as-dot manual"></i>其中 <b>${manual}</b> 天为人工调整，非算法生成</li>` : ''}
        </ul>
        <div class="as-foot">繁重日 ${a.busy} 天 → <b>${b.busy}</b> 天 ·
          轻松日 ${a.easy} 天 → <b>${b.easy}</b> 天</div>
      </div>`;
  }

  /* 方案 C 的应用确认摘要。与 applySummaryHtml（A/B 用）的区别在三点：

     1. 人工调整逐条列出，算法改动压成一行。
        确认这一刻真正需要核对的是「我自己改了哪几天」——算法那些天在日历上
        已经逐日看过了，再把 40 多个日期罗列一遍只会把弹窗撑成一堵墙。
     2. 不再出现两个「其中」。旧版上面按天算（搬出+搬入=2 天）、
        下面按次算（1 处），单位不同却都叫「其中」，自相矛盾。
        这里人工只用「处」，算法只用「天」。
     3. 算法的天数排除掉人工涉及的日期，两组数字不重叠。
        旧版的「其中 N 天为人工调整」是个不可靠的子集断言 ——
        人工搬移不写回 CAL_COMPARE，搬动两个算法没碰过的日子时，
        那两天根本不在总数里，却照样声称「其中」。 */
  /* 应用确认表的数据源：拉平到工单级别，一张工单一行。
     不做「按天分组 + 展开」那种层级 —— 要确认的是「哪些工单的日期变了」，
     天只是工单的一个属性，没有从属关系。

     口径是「当前计划 → 新方案」两端直接比：
     某天的量减少了，就是那几张工单从这天挪出去；增加了，就是挪进来。
     算法的中间方案（c.n）不参与，人工搬移的影响已由 finalLoad() 叠加。

     对侧日期能确定就写具体日期（人工搬移记录了 from/to），
     算法重新分配时无法定位到某一天，写「其他日期」—— 与日历上的措辞一致。 */
  function applyOrderRowsC() {
    const out = [];

    /* ① 人工搬移：逐条列出实际挑中的那几张工单。

       这里按 manualMoves 走而不是扫日历，解决两个问题：
       一是只搬走一部分时，按台量差现生成会列出一串连号工单，和弹窗里挑的对不上；
       二是扫日历会把同一次搬移算两遍（搬出端一遍、搬入端又一遍），
       而且两遍的工单编号还不一样（编号含日期戳）—— 同一张工单成了两张。 */
    manualMoves.forEach((m) => {
      const p = projectForDay(m.from);
      /* 兼容整天搬移的记录（A/B 不记 orders）：按量退回生成 */
      const list = (m.orders && m.orders.length)
        ? m.orders
        : ordersForDay(m.from, m.units, Math.round(m.hours * 60));
      list.forEach((o) => out.push({
        project: p.name, code: p.code,
        no: o.no, device: o.device, alias: o.alias,
        from: keyLabel(m.from), to: keyLabel(m.to), manual: true,
      }));
    });

    /* ② 算法改动：口径是「当前计划 → 新方案」两端直接比。
       人工动过的日子跳过 —— 它们已经由 ① 逐条列清，
       留在这里只会把人工搬移的量混进算法行里再数一遍。 */
    CAL_COMPARE.flat().forEach((c) => {
      if (c.blank) return;
      const k = dayKey(c);
      if (movedFrom(k) || movedTo(k)) return;
      const fin = finalLoad(c);
      if (!c.o && !fin) return;                  // 两套方案都没安排
      const bu = c.o ? c.o[0] : 0;
      const bh = c.o ? c.o[1] : 0;
      const fu = fin ? fin[0] : 0;
      const fh = fin ? fin[1] : 0;
      const delta = fu - bu;
      if (!delta) return;                        // 工单数没变，不算日期调整

      const p = projectForDay(k);
      const n = Math.abs(delta);
      const mins = Math.abs(Math.round((fh - bh) * 60));
      /* 工单由 ordersForDay 生成，与编排调整弹窗里的卡片同源同序 */
      const orders = ordersForDay(k, n, mins);

      /* 算法重新分配时无法定位到对侧的某一天，写「其他日期」——
         与日历上「已分配至其他日期」的措辞一致 */
      const from = delta < 0 ? keyLabel(k) : OTHER_DAY;
      const to = delta < 0 ? OTHER_DAY : keyLabel(k);

      orders.forEach((o) => out.push({
        project: p.name, code: p.code,
        no: o.no, device: o.device, alias: o.alias, from, to, manual: false,
      }));
    });
    return out;
  }

  /* 按调整项目归组。上千张工单平铺着看没法定位，按项目收成几组、
     默认全收起，需要哪个项目再展开 —— 项目是这批工单最自然的归类维度。
     组内保持原顺序（按日期生成），不另外排序。 */
  function groupOrdersByProject(rows) {
    const groups = [];
    const byName = new Map();
    rows.forEach((r) => {
      let g = byName.get(r.project);
      if (!g) {
        g = { project: r.project, code: r.code, orders: [] };
        byName.set(r.project, g);
        groups.push(g);
      }
      g.orders.push(r);
    });
    return groups;
  }

  function applyProjectGroupsC() { return groupOrdersByProject(applyOrderRowsC()); }

  /* 分组表的外层 HTML。两个应用确认弹窗（智能编排方案 / 手动调整的计划）
     共用这一份，避免各写一套后慢慢长歪。 */
  function orderGroupTableHtml(groups) {
    const rows = groups.map((g, i) => `
            <tr class="pg-row">
              <td class="pg-name">
                <button type="button" class="pg-toggle" data-pg="${i}"
                        aria-expanded="false" aria-controls="pgDetail${i}"
                        title="展开该项目的工单明细">
                  <span class="pg-ico">${chevron}</span>
                  <span class="pg-text" title="${g.project}">${g.project}</span>
                </button>
              </td>
              <!-- 分组头只报工单数。手动与否属于单张工单的属性，
                   展开后的「调整方式」列已经逐行标明，收起这一层不再重复 -->
              <td class="pg-count">${g.orders.length} 张工单</td>
            </tr>
            <tr class="pg-detail hidden" id="pgDetail${i}" data-pgdetail="${i}">
              <td colspan="2"><div class="pg-wrap"></div></td>
            </tr>`).join('');
    if (!rows) return '';
    return `
        <div class="as-table-wrap">
          <table class="table-nested as-table">
            <thead>
              <tr>
                <th class="pg-name">调整项目</th>
                <th class="pg-count">调整工单</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;
  }

  /* 分组展开 / 收起的接线。明细首次展开时才生成 ——
     上千张工单一次性建好是几千个 DOM 节点，而用户通常只看一两个项目。
     showWay=false 时不渲染「调整方式」列：手动调整那条线里每一行都是手动的，
     整列重复同一个值没有信息量。 */
  function bindOrderGroupExpand(layer, groups, showWay) {
    $$('.pg-toggle', layer).forEach((btn) => {
      btn.addEventListener('click', () => {
        const row = $(`[data-pgdetail="${btn.dataset.pg}"]`, layer);
        if (!row) return;
        const wrap = $('.pg-wrap', row);
        const g = groups[+btn.dataset.pg];
        if (wrap && g && !wrap.dataset.filled) {
          wrap.innerHTML = `
            <table class="oc-table">
              <thead>
                <tr>
                  <th class="oc-no">工单编号</th>
                  <th class="oc-dev">设备编号</th>
                  <th class="oc-alias">客户自编号</th>
                  <th class="oc-date">调整日期</th>
                  ${showWay ? '<th class="oc-way">调整方式</th>' : ''}
                </tr>
              </thead>
              <tbody>${g.orders.map((o) => `
                <tr class="${showWay && o.manual ? 'oc-is-manual' : ''}">
                  <td class="oc-no">${o.no}</td>
                  <td class="oc-dev">${o.device}</td>
                  <td class="oc-alias">${o.alias}</td>
                  <td class="oc-date">${o.from}<span class="oc-arrow">→</span>${o.to}</td>
                  ${showWay ? `<td class="oc-way">${o.manual
                    ? '<span class="tag-manual">手动</span>'
                    : '<span class="oc-auto">智能编排</span>'}</td>` : ''}
                </tr>`).join('')}</tbody>
            </table>`;
          wrap.dataset.filled = '1';
        }
        const open = row.classList.toggle('hidden') === false;
        btn.setAttribute('aria-expanded', String(open));
        btn.classList.toggle('on', open);
        btn.title = open ? '收起该项目的工单明细' : '展开该项目的工单明细';
      });
    });
  }

  /* 手动调整那条线的工单级明细。直接遍历 planMoves 并列出 mv.orders ——
     也就是用户在调整弹窗里亲手勾的那几张工单。

     原先是拿当天的台量差去 ordersForDay 现生成一串连号工单，
     只搬走一部分时就会对不上：勾了第 1、5、9 张，确认表却列出前 3 张连号的。
     搬移记录里既然存了工单清单，预览就该照着念，不要再推算一遍。 */
  function planTuneOrderRows() {
    const out = [];
    planMoves.forEach((m) => {
      const p = projectForDay(m.from);
      /* 兼容没有 orders 的旧记录（整天搬移）：按量退回生成 */
      const list = (m.orders && m.orders.length)
        ? m.orders
        : ordersForDay(m.from, m.units, Math.round(m.hours * 60));
      list.forEach((o) => out.push({
        project: p.name, code: p.code,
        no: o.no, device: o.device, alias: o.alias,
        from: keyLabel(m.from), to: keyLabel(m.to), manual: true,
      }));
    });
    return out;
  }

  function planTuneSummaryHtml(groups) {
    const total = groups.reduce((s, g) => s + g.orders.length, 0);
    const days = new Set(planMoves.flatMap((m) => [m.from, m.to])).size;
    return `
      <div class="apply-sum">
        <div class="as-head">共手动调整 <b>${days}</b> 天，
          <b>${groups.length}</b> 个项目共 <b>${total}</b> 张工单调整日期</div>
        ${orderGroupTableHtml(groups)}
      </div>`;
  }

  function applySummaryHtmlC() {
    const a = loadDays(CAL_CURRENT);
    const b = loadDays(CAL_PLAN);

    /* 按调整项目分组折叠，明细按需展开。表格本身由 orderGroupTableHtml 统一出，
       与手动调整那条线的确认弹窗共用一份实现。 */
    const groups = applyProjectGroupsC();
    const total = groups.reduce((s, g) => s + g.orders.length, 0);

    return `
      <div class="apply-sum">
        <div class="as-head">应用范围 <b>${rangeLabel(CAL_PLAN)}</b>（${CAL_PLAN.length} 周），
          <b>${groups.length}</b> 个项目共 <b>${total}</b> 张工单调整日期</div>
        ${orderGroupTableHtml(groups)}
        <div class="as-foot">
          繁重日 ${a.busy} 天 → <b>${b.busy}</b> 天 · 轻松日 ${a.easy} 天 → <b>${b.easy}</b> 天
        </div>
      </div>`;
  }

  /* ---------------- 方案 B 的两条「不应用」出路 ---------------- */

  function applyPlan() {
    const suffix = isFlow() && isTuned() ? `（含 ${manualDayCount()} 天人工调整）` : '';
    manualMoves = [];
    toast(`智能编排方案已应用${suffix}`);
  }

  /* 取消了「方案预览」这一步后，影响摘要改在点「应用方案」时弹出确认。
     确认放在扣扳机的瞬间，而不是多加一屏。 */
  function confirmApplyPlan() {
    const moves = manualMoves.map((m) =>
      `<li><i class="as-dot manual"></i>${keyLabel(m.from)} → ${keyLabel(m.to)}，${m.units} 台</li>`).join('');

    overlayMount.insertAdjacentHTML('beforeend', `
      <div id="applyConfirmLayer">
        <div class="mask" data-close-apply></div>
        <div class="modal-wrap">
          <!-- 方案 C 的确认框里有四列明细表，必须用加宽版。
               加宽条件不能绑在「有没有人工调整」上 —— 算法调整同样要进这张表，
               476px 下表格区只有 336px，展开的工单明细（380px）会被横向截断。 -->
          <div class="modal modal-confirm ${isC() ? 'modal-confirm-wide' : ''}"
               id="applyModal" role="alertdialog" aria-labelledby="applyTitle">
            <button class="icon-btn confirm-close" data-close-apply aria-label="关闭">${closeX}</button>
            <div class="modal-body">
              <div class="confirm-body">
                <span class="confirm-icon warn">${icon('complaint', 22, 1.7)}</span>
                <div class="confirm-main">
                  <div class="confirm-title" id="applyTitle">${PLAN_APPLY_CONFIRM.title}</div>
                  ${isC() ? applySummaryHtmlC() : `
                  ${applySummaryHtml()}
                  ${moves ? `
                  <div class="apply-sum" style="margin-top:10px">
                    <div class="as-head">其中人工调整 <b>${manualMoves.length}</b> 处</div>
                    <ul class="as-list">${moves}</ul>
                  </div>` : ''}`}
                  <div class="confirm-warnline">${PLAN_APPLY_CONFIRM.warn}</div>
                </div>
              </div>
            </div>
            <div class="modal-foot">
              <button class="btn" data-close-apply>取 消</button>
              <button class="btn btn-primary" id="btnApplyConfirm">确认应用</button>
            </div>
          </div>
        </div>
      </div>`);

    const layer = $('#applyConfirmLayer');
    $$('[data-close-apply]', layer).forEach((el) =>
      el.addEventListener('click', () => layer.remove()));

    /* 智能编排方案的确认表里混着算法与手动两类，所以要「调整方式」列 */
    if (isC()) bindOrderGroupExpand(layer, applyProjectGroupsC(), true);

    $('#btnApplyConfirm', layer).addEventListener('click', () => {
      layer.remove();
      closeOverlays();
      applyPlan();
    });
  }

  /* 出路一：条件不合适 → 回到编排条件设置，改完重新生成 */
  function regenerateFromConditions() {
    manualMoves = [];   // 重新生成即丢弃此前的人工调整
    go('conditions');
    toast('请调整编排条件后重新生成方案');
  }

  /* 出路二：点日历上的某一天，把该日保养搬到另一天。
     记录成对的 from / to，对比视图两端都能看到搬移关系。 */
  function openManualTune(key) {
    /* 点到已调整过的紫色格子时（搬出端、搬入端都算），视为「编辑那一次调整」：
       原计划日期回到 mv.from，迷你日历默认选中 mv.to。
       这样一进来就能看到当前去向，再确认一次是改这条记录，而不是又叠一条新的。 */
    const mv = movedFrom(key) || movedTo(key);
    const srcKey = mv ? mv.from : key;
    const selKey = mv ? mv.to : key;
    openAdjust({
      srcKey,
      selKey,
      /* 列完整工单清单（含上次已挑走的），否则重新编辑时已调整的工单会凭空消失 */
      load: dayLoadBeforeOut(srcKey),
      /* 勾选决定搬哪几张，只在方案 C 开启 —— A/B 已冻结，那两套按整天搬移。
         点「已手动调整至 X」进来时，把上次挑中的工单默认勾回来：
         这一刻用户要核对或改的就是那几张，让他自己重新找一遍没有道理。 */
      pickable: isC(),
      picked: mv && mv.orders ? mv.orders.map((o) => o.no) : null,
      // 取消也要退回调整模式，不能把用户丢回智能编排首页
      onCancel: () => openPlanFlowB(editView()),
      onConfirm: (toDay, list) => {
        const [y, m] = srcKey.split('-').map(Number);
        const toKey = toDay ? `${y}-${m}-${toDay}` : srcKey;

        if (toKey === srcKey) {
          /* 选回原计划日期：原本有调整的等于撤销，原本没有的才叫「未产生调整」 */
          const had = !!movedFrom(srcKey);
          manualMoves = manualMoves.filter((m2) => m2.from !== srcKey);
          openPlanFlowB(editView());
          toast(had ? `已撤销 ${keyLabel(srcKey)} 的调整，恢复算法方案`
            : '目标日期与原计划日期相同，未产生调整');
          return;
        }

        /* 搬移量：方案 C 由勾选的工单算出（勾了 3 张就只动 3 张），
           A/B 仍取该日现方案的整天量，没有则退回原方案的量。
           工单清单一并记下来，应用确认的明细直接列这几张。 */
        const base = dayLoadBeforeOut(srcKey);
        const orders = (list && list.length) ? list : null;
        const units = orders ? orders.length : base[0];
        const hours = orders
          ? Math.round(orders.reduce((s, o) => s + o.minutes, 0) / 60 * 100) / 100
          : base[1];
        /* 记下项目归属 —— 应用确认里的明细表要说清「调的是哪个项目的工单」。
           与弹窗项目下拉同一个函数，两处显示的项目必然一致。 */
        const proj = projectForDay(srcKey);

        // 同一天重复调整时覆盖旧记录，避免出现多条互相矛盾的搬移
        manualMoves = manualMoves.filter((m2) => m2.from !== srcKey);
        manualMoves.push({
          from: srcKey,
          to: toKey,
          units,
          hours,
          orders,
          project: proj.name,
          code: proj.code,
        });

        openPlanFlowB(editView());
        toast(units < base[0]
          ? `已将 ${keyLabel(srcKey)} 的 ${units} 张工单调整至 ${keyLabel(toKey)}`
          : `已将 ${keyLabel(srcKey)} 的保养调整至 ${keyLabel(toKey)}`);
      },
    });
  }

  /* 撤销全部人工调整，回到智能算法生成的第一版方案 */
  function undoManualTunes() {
    const n = manualDayCount();
    manualMoves = [];
    openPlanFlowB(editView());
    toast(`已撤销 ${n} 天人工调整，恢复为算法生成的方案`);
  }

  /* 撤销单日调整 —— 不必为改错一天就清空全部 */
  function undoOneTune(fromKey) {
    const mv = manualMoves.find((m) => m.from === fromKey);
    manualMoves = manualMoves.filter((m) => m.from !== fromKey);
    openPlanFlowB(editView());
    if (mv) toast(`已撤销 ${keyLabel(mv.from)} → ${keyLabel(mv.to)} 的调整`);
  }

  function bindPlanCells() {
    $$('#calPlan .cal-cell:not(.blank)').forEach((c) => {
      c.addEventListener('click', () => {
        $$('#calPlan .cal-cell').forEach((x) => x.classList.remove('selected'));
        c.classList.add('selected');
      });
    });
  }

  /* =======================================================================
     浮层：智能编排方案对比（截图 2）
     ===================================================================== */
  function openCompareDrawer() {
    const html = `
      <div class="mask" data-close-compare></div>
      <aside class="drawer level-2" id="compareDrawer">
        <div class="drawer-head">
          <span class="grow">智能编排方案对比</span>
          ${isFlow() && isTuned() ? `<span class="tag-tuned">${PLAN_B_TEXT.tunedTag}</span>` : ''}
          ${dd(WEEK_OPTIONS[0], WEEK_OPTIONS, 'control-w-sm', '', 'compareWeeks')}
          <button class="icon-btn" data-close-compare title="关闭">${closeX}</button>
        </div>
        <div class="drawer-body">
          <div id="compareLegend">${compareLegendHtml(weekSlice(CAL_COMPARE))}</div>
          <div id="compareWrap">${compareCalHtml(CAL_COMPARE)}</div>
        </div>
        ${isFlow() ? `
        <div class="drawer-foot">
          <div class="grow"></div>
          <span class="foot-hint">逐日差异供排查，决策回到方案页进行</span>
          <button class="btn btn-primary" data-close-compare>${PLAN_B_TEXT.backToPlan}</button>
        </div>` : ''}
      </aside>`;

    const frag = document.createElement('div');
    frag.innerHTML = html;
    frag.id = 'compareLayer';
    overlayMount.appendChild(frag);

    $$('[data-close-compare]', frag).forEach((el) =>
      el.addEventListener('click', () => frag.remove()));

    /* 方案 B 里对比抽屉只负责排查，关掉即回到方案页做决策，
       因此这里不再重复摆放应用 / 重生成 / 手动调整三个动作 */

    initWidgets(frag);
    bindCalScroll(frag);

    setupTierSync({
      scroller: $('.cal.compare .cal-scroll', frag),
      ctl: $('#compareWeeks', frag),
      rows: CAL_COMPARE,
      legendEl: $('#compareLegend', frag),
    });
  }

  /* =======================================================================
     浮层：编排调整（截图 1）
     ===================================================================== */
  /* opts.onConfirm / opts.onCancel：方案 B 从流程内打开时的回调。
     关键在 onCancel —— 本弹窗会顶掉整个 overlayMount，若沿用默认的
     data-close-drawer，取消后会直接落到智能编排首页，而不是退回原来的流程。
     不传 opts 则按默认行为：关闭弹窗并提示已保存。 */
  function openAdjust(opts) {
    const cb = opts && opts.onConfirm;
    const onCancel = opts && opts.onCancel;
    // 有 onCancel 时改用自有属性，绕开 mountOverlay 的默认关闭逻辑
    const closeAttr = onCancel ? 'data-cancel-adjust' : 'data-close-drawer';
    /* srcKey = 原计划日期，用于生成迷你日历并记录搬移。
       selKey = 迷你日历默认选中的日期；已调整过的日子传入当前目标日期。 */
    const srcKey = opts && opts.srcKey;
    const selKey = (opts && opts.selKey) || srcKey;
    /* 迷你日历渲染的年月。无 srcKey（导航直接看这个弹窗）时退回静态示例数据的 2026-9 */
    const miniY = srcKey ? +srcKey.split('-')[0] : 2026;
    const miniM = srcKey ? +srcKey.split('-')[1] : 9;
    /* 项目归属按被点的日期确定，与应用确认里的调整明细表保持一致 */
    const adjustProject = srcKey ? projectForDay(srcKey).name : ADJUST.project;
    /* 项目行的「N工单 N分钟」按被点那天的真实保养量算。
       原先这里取的是写死的 ADJUST.summary，不管点哪天都是 12工单 583分钟，
       和应用确认里列出的数量对不上。

       取哪一份数据由调用方决定（opts.load）：
         抽屉内打开 → 智能编排方案（CAL_COMPARE，dayLoad）
         首页打开   → 正在执行的计划（CAL_CURRENT + planMoves，planDayLoad）
       两者对同一天的工时可能有细微差别（26.62 / 26.6），用错会让弹窗
       和点进来的那张日历对不上，所以不在这里硬编码数据源。 */
    const load = (opts && opts.load) || (srcKey ? dayLoad(srcKey) : null);
    const adjustScale = load
      ? moveScale(load[0], load[1])
      : { orders: ADJUST.summary.orders, minutes: ADJUST.summary.minutes };
    const planDateText = srcKey ? srcKey : ADJUST.planDate;
    /* 工单卡片按该日真实工单数生成，并把总分钟摊到每张卡上 ——
       否则会出现「表头 50工单 3759分钟、下面只列 7 张卡、卡片工时加起来也凑不出 3759」
       这种自己打自己的情况。日历台量 = 表头工单数 = 卡片张数，
       日历工时×60 = 表头分钟数 = 各卡片计划工时之和，整条链一个口径。 */
    const orderList = srcKey
      ? ordersForDay(srcKey, adjustScale.orders, adjustScale.minutes)
      : ADJUST.orders;
    /* pickable：工单勾选真正决定搬哪几张（手动调整那条线）。
       不开这个开关时复选框沿用 initWidgets 的通用行为，只是个装饰 ——
       智能编排那条线按整天搬移，不读勾选，保持原样。
       opts.picked 传上次挑中的工单编号，重新编辑那天时照原样勾回来。 */
    const pickable = !!(opts && opts.pickable);
    const picked = opts && opts.picked;
    /* 默认一张都不勾 —— 调整的对象是用户自己要挑的那几张工单，
       预先全勾上等于替他做了「整天都搬走」的决定，而且想只调一张时
       得先取消二十几个勾。重新编辑已调整过的那天才按上次挑的勾回来。 */
    const isOn = (o) => (picked ? picked.indexOf(o.no) >= 0 : false);

    const orders = orderList.map((o) => `
      <div class="order-card${pickable && isOn(o) ? ' picked' : ''}"
           data-order-no="${o.no}" data-order-min="${o.minutes}">
        <span class="checkbox${pickable && isOn(o) ? ' on' : ''}"
              ${pickable ? 'data-pick-order' : ''}><span class="check-box"></span></span>
        <span class="order-thumb">${icon('elevator', 16)}</span>
        <div class="order-info">
          <div>工单编号：${o.no}</div>
          <div>设备编号：${o.device}</div>
          <div>客户自编号：${o.alias}</div>
          <div>工单类型：${o.type}</div>
          <div class="muted">计划工时：${o.minutes}分钟&nbsp;&nbsp;保养间隔：${o.interval}天</div>
        </div>
      </div>`).join('');

    const html = `
      <div class="mask" ${closeAttr}></div>
      <div class="modal-wrap">
        <div class="modal modal-lg" id="adjustModal">
          <div class="modal-head">
            <span class="grow">编排调整 ${ADJUST.group}</span>
            <button class="icon-btn" title="全屏">${expandIco}</button>
            <button class="icon-btn" ${closeAttr} title="关闭">${closeX}</button>
          </div>

          <div class="adjust-grid">
            <div class="adjust-left">
              <!-- 项目跟着被点的那一天走，与应用确认里的明细表同一个口径；
                   没有 srcKey（从导航直接看这个弹窗）时退回静态示例项目 -->
              <div class="adjust-proj-row">
                <!-- 全选框的选中态由 syncPickUi 按实际勾选算，不在这里写死 -->
                <span class="checkbox" ${pickable ? 'data-pick-all' : ''}><span class="check-box"></span></span>
                ${dd(adjustProject, [adjustProject], 'control-w-lg')}
                <!-- pickable 时这里报的是「已选」的量，随勾选实时变 ——
                     搬走几张工单由勾选决定，表头若还报全天的量就对不上了 -->
                <span class="sum" id="adjustSum">${adjustScale.orders}工单 ${adjustScale.minutes}分钟</span>
              </div>
              <div class="order-list">${orders}</div>
            </div>

            <div class="adjust-right">
              <div class="adjust-proj-row">
                ${dd(ADJUST.group, [ADJUST.group], 'control-w-lg')}
                <span class="sum">原计划日期：${planDateText}</span>
              </div>

              <!-- 默认档位只在方案 C 改成「仅调整此保养」：调一天的保养日期
                   本来就是一次性的，默认把未来所有保养都跟着挪，影响面远超用户意图。
                   A/B 已冻结，所以按 isC() 分流，不动那两套的默认值。 -->
              <div class="adjust-radio-block">
                <label class="radio${isC() ? ' on' : ''}" data-radio="scope" data-val="one">
                  <span class="radio-dot"></span><span>仅调整此保养</span>
                </label>
                <div class="sub">
                  <span>调整近</span>
                  <div class="control fixed" style="width:56px"><span class="val">1</span></div>
                  <span>次保养</span>
                </div>
              </div>

              <div class="adjust-radio-block">
                <label class="radio${isC() ? '' : ' on'}" data-radio="scope" data-val="all">
                  <span class="radio-dot"></span><span>调整所有保养</span>
                </label>
                <div class="sub"><span>调整后未来全部保养</span></div>
              </div>

              <!-- 年月要跟着迷你日历实际渲染的月份走，否则会出现下拉写 9 月、
                   日历和原计划日期却是 10 月的矛盾 -->
              <div class="mini-toolbar">
                ${dd(String(miniY), ['2025', '2026', '2027'], 'control-w-sm')}
                ${dd(String(miniM), ['7', '8', '9', '10', '11', '12'], 'control-w-sm')}
              </div>

              <div class="adjust-cal-panel">${miniCalHtml(srcKey, selKey)}</div>
            </div>
          </div>

          <div class="modal-foot">
            <button class="btn" ${closeAttr}>取 消</button>
            ${cb
              ? `<button class="btn btn-primary" id="btnAdjustConfirm">确 定</button>`
              : `<button class="btn btn-primary" data-close-drawer data-toast="编排调整已保存">确 定</button>`}
          </div>
        </div>
      </div>`;

    mountOverlay(html);

    /* 「调整后」标记要跟着选中的日期走。改 class 与文字而不是插删节点：
       占位 span 一直在，格子高度和日期对齐就不会随点击跳动。
       选回原计划日期时不显示「调整后」—— 那等于撤销，没有「后」。 */
    const srcDay = srcKey ? +srcKey.split('-')[2] : null;
    function syncMiniTags() {
      const sel = $('#adjustModal .mini-cell.selected');
      const selDay = sel && sel.dataset.miniDay ? +sel.dataset.miniDay : null;
      $$('#adjustModal .mini-cell[data-mini-day]').forEach((c) => {
        const t = $('.mc-tag', c);
        if (!t) return;
        const d = +c.dataset.miniDay;
        if (d === srcDay) {
          t.className = 'mc-tag before';
          t.textContent = MINI_TAG.before;
        } else if (d === selDay) {
          t.className = 'mc-tag after';
          t.textContent = MINI_TAG.after;
        } else {
          t.className = 'mc-tag empty';
          t.textContent = '';
        }
      });
    }

    $$('#adjustModal .mini-cell:not(.dim)').forEach((c) => {
      c.addEventListener('click', () => {
        $$('#adjustModal .mini-cell').forEach((x) => x.classList.remove('selected'));
        c.classList.add('selected');
        syncMiniTags();
      });
    });

    /* ---- 工单勾选（pickable）---- */
    const byNo = new Map(orderList.map((o) => [o.no, o]));
    const cards = () => $$('#adjustModal .order-card[data-order-no]');
    const pickedOrders = () => cards()
      .filter((el) => $('.checkbox', el).classList.contains('on'))
      .map((el) => byNo.get(el.dataset.orderNo))
      .filter(Boolean);

    function syncPickUi() {
      const all = cards();
      const sel = pickedOrders();
      const mins = sel.reduce((s, o) => s + o.minutes, 0);
      const sumEl = $('#adjustSum');
      if (sumEl) sumEl.textContent = `${sel.length}工单 ${mins}分钟`;
      all.forEach((el) =>
        el.classList.toggle('picked', $('.checkbox', el).classList.contains('on')));
      /* 全选框三态：全选 / 全不选 / 部分（part 只改外观，点一下仍是全选） */
      const allBox = $('#adjustModal [data-pick-all]');
      if (allBox) {
        allBox.classList.toggle('on', sel.length === all.length && all.length > 0);
        allBox.classList.toggle('part', sel.length > 0 && sel.length < all.length);
      }
      /* 一张都没选就没有可搬的东西，确定置灰（点下去会提示先勾选） */
      const btn = $('#btnAdjustConfirm');
      if (btn) btn.classList.toggle('is-disabled', sel.length === 0);
    }

    if (pickable) {
      /* 抢在 initWidgets 之前标记 bound，避免通用复选逻辑与这里的联动互顶 */
      $$('#adjustModal [data-pick-order], #adjustModal [data-pick-all]').forEach((el) => {
        el.dataset.bound = '1';
      });
      $$('#adjustModal [data-pick-order]').forEach((box) => {
        box.addEventListener('click', (e) => {
          e.stopPropagation();
          box.classList.toggle('on');
          syncPickUi();
        });
      });
      const allBox = $('#adjustModal [data-pick-all]');
      if (allBox) {
        allBox.addEventListener('click', (e) => {
          e.stopPropagation();
          /* 部分选中时点一下补成全选，再点才是全不选 */
          const toAll = !allBox.classList.contains('on');
          $$('#adjustModal [data-pick-order]').forEach((b) => b.classList.toggle('on', toAll));
          syncPickUi();
        });
      }
      syncPickUi();
    }

    const ac = $('#btnAdjustConfirm');
    if (ac) ac.addEventListener('click', () => {
      /* 读出迷你日历里选中的目标日期，回传给调用方记录搬移 */
      const sel = $('#adjustModal .mini-cell.selected');
      const toDay = sel && sel.dataset.miniDay ? +sel.dataset.miniDay : null;
      const list = pickable ? pickedOrders() : null;
      if (pickable && !list.length) { toast('请先勾选要调整的工单'); return; }
      closeOverlays();
      cb(toDay, list);
    });

    /* 取消 / 关闭 / 点遮罩：退回原流程，而不是落到智能编排首页 */
    if (onCancel) {
      $$('[data-cancel-adjust]', overlayMount).forEach((el) =>
        el.addEventListener('click', () => { closeOverlays(); onCancel(); }));
    }

    initWidgets(overlayMount);
  }

  /* =======================================================================
     浮层：人员安排设置（截图 5）
     ===================================================================== */
  /* 只有新增态 —— 列表已取消「编辑」操作。
     时间按整天记录，不再有上午/下午与时长。 */
  function openLeaveModal() {
    const html = `
      <div class="mask" data-close-drawer></div>
      <div class="modal-wrap">
        <div class="modal" id="leaveModal">
          <div class="modal-head">
            <span class="grow">${PLAN_ADJUST_NAME}设置</span>
            <button class="icon-btn" title="全屏">${expandIco}</button>
            <button class="icon-btn" data-close-drawer title="关闭">${closeX}</button>
          </div>
          <div class="modal-body">
            <div class="form-row">
              <span class="field-label req">类型</span>
              <div class="form-ctl">
                <div class="radio-group">
                  <label class="radio on" data-radio="ltype" data-val="workdayOff">
                    <span class="radio-dot"></span><span>${LEAVE_TYPE_LABEL.workdayOff}</span>
                  </label>
                  <label class="radio" data-radio="ltype" data-val="restdayOn">
                    <span class="radio-dot"></span><span>${LEAVE_TYPE_LABEL.restdayOn}</span>
                  </label>
                </div>
              </div>
            </div>

            <div class="form-row">
              <span class="field-label req">人员</span>
              <div class="form-ctl">${dd('', ['赵波', '张文字'], '', '请选择员工')}</div>
            </div>

            <div class="form-row">
              <span class="field-label req">开始时间</span>
              <div class="form-ctl">${dd('', [], '', '请选择日期')}</div>
            </div>

            <div class="form-row">
              <span class="field-label req">结束时间</span>
              <div class="form-ctl">${dd('', [], '', '请选择日期')}</div>
            </div>

            <div style="padding:8px 0 4px">
              <button class="btn-dashed-block">+ 添加员工</button>
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn" data-close-drawer>取 消</button>
            <button class="btn btn-primary" data-close-drawer data-toast="记录已新增">确 定</button>
          </div>
        </div>
      </div>`;

    mountOverlay(html);
    initWidgets(overlayMount);
  }

  /* =======================================================================
     浮层：方案生成中（截图 4）
     ===================================================================== */
  /* =======================================================================
     首次使用引导
     ===================================================================== */
  /* 会话内只提示一次。刷新页面即重置，便于反复查看引导效果 */
  const guideSeen = { conditions: false, leave: false };

  /* 首次编排流程状态。step: 0 条件设置 / 1 人员安排 / 2 生成方案
     流程进行中时，条件设置页与人员安排页顶部显示步骤条。 */
  const firstFlow = { active: false, step: 0 };

  /* 进入条件设置页。人员安排引导不在此弹出 —— 它要等用户点「确定」之后才出现 */
  function gotoConditions() {
    goScreen('conditions');
  }

  /* 条件设置页点「确定」：首次流程里先引导去人员安排，否则直接生成 */
  function confirmConditions() {
    if (firstFlow.active && !guideSeen.leave) {
      guideSeen.leave = true;
      showGuide('leave');
      return;
    }
    goScreen('smart');
    startGenerating();
  }

  /* -------------------- 步骤流程指引 -------------------- */
  function stepsHtml(current, list) {
    return `<div class="steps">` + (list || FIRST_USE_STEPS).map((s, i) => {
      const state = i < current ? 'done' : (i === current ? 'current' : 'wait');
      const mark = i < current
        ? `<svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor"
              stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><path d="M4 12.5l5 5L20 6.5"/></svg>`
        : i + 1;
      return `${i ? '<span class="step-line"></span>' : ''}
        <div class="step ${state}">
          <span class="step-num">${mark}</span>
          <span class="step-text">
            <span class="step-title">${s.title}</span>
            <span class="step-desc">${s.desc}</span>
          </span>
        </div>`;
    }).join('') + `</div>`;
  }

  /* 点「智能编排」：首次先提示做条件设置，之后直接生成 */
  function triggerSmartSchedule() {
    if (!guideSeen.conditions) {
      guideSeen.conditions = true;
      showGuide('conditions');
      return;
    }
    startGenerating();
  }

  function showGuide(key) {
    const g = FIRST_USE_GUIDES[key];
    if (!g) return;

    /* 无关闭按钮、遮罩不可点关 —— 与现网一致，必须在两个按钮中选一个 */
    overlayMount.innerHTML = `
      <div class="mask"></div>
      <div class="modal-wrap">
        <div class="modal modal-guide" id="guideModal" role="dialog" aria-modal="true"
             aria-labelledby="guideTitle" aria-describedby="guideText">
          <div class="modal-body">
            <div class="confirm-body">
              <span class="confirm-icon info">${INFO_ICON}</span>
              <div class="confirm-main">
                <div class="confirm-title sm" id="guideTitle">${g.title}</div>
                <div class="confirm-text" id="guideText">${g.text}</div>
              </div>
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn" id="guideSkip">${g.skipText}</button>
            <button class="btn btn-primary" id="guideStart">${g.startText}</button>
          </div>
        </div>
      </div>`;

    // 忽略 = 跳过设置，直接生成方案
    $('#guideSkip').addEventListener('click', () => {
      closeOverlays();
      firstFlow.active = false;
      if (key === 'leave') renderView('smart');
      startGenerating();
    });

    // 开始设置 = 进入下一步，步骤条随之推进
    $('#guideStart').addEventListener('click', () => {
      closeOverlays();
      if (key === 'conditions') {
        firstFlow.active = true;
        firstFlow.step = 0;
        gotoConditions();
      } else {
        firstFlow.step = 1;
        goScreen('leave');
      }
    });
  }

  let genTimer = null;

  /* 生成失败弹窗。会先收掉进度浮窗，避免「还在跑」和「已失败」同时出现。
     typeKey 取 SMART_FAIL_TYPES 的键，默认 conflict。 */
  function showFailModal(typeKey) {
    hideNotify();

    const t = SMART_FAIL_TYPES[typeKey] || SMART_FAIL_TYPES.conflict;
    const C = SMART_FAIL_COMMON;

    /* 确定性失败（retryable=false）时不渲染「重新生成」—— 条件不变重算结果必然相同，
       与其置灰留一个按不动的按钮，不如直接去掉。主按钮指向能真正改变结果的入口。 */
    const primaryBtn = t.primary.retry
      ? `<button class="btn btn-primary" id="btnRetryGen">${t.primary.text}</button>`
      : `<button class="btn btn-primary" id="btnFailPrimary"
                 data-fail-go="${t.primary.go}">${t.primary.text}</button>`;

    const html = `
      <div class="mask" data-close-drawer></div>
      <div class="modal-wrap">
        <div class="modal modal-confirm" id="failModal" role="alertdialog"
             aria-labelledby="failTitle" aria-describedby="failReason">
          <button class="icon-btn confirm-close" data-close-drawer title="关闭" aria-label="关闭">${closeX}</button>
          <div class="modal-body">
            <div class="confirm-body">
              <span class="confirm-icon error">${icon('errorCircle', 22, 1.7)}</span>
              <div class="confirm-main">
                <div class="confirm-title" id="failTitle">${C.title}</div>
                <div class="confirm-reason" id="failReason">${t.reason}</div>
                <div class="confirm-detail">${t.detail}</div>
                <div class="confirm-guide"><span class="gk">建议</span>${t.guide}</div>
                <div class="confirm-meta">
                  ${C.group} · ${C.range} · <span class="code">${t.code}</span>
                </div>
              </div>
            </div>
          </div>
          <div class="modal-foot">
            <button class="btn" id="btnManualAdjust">手动调整编排</button>
            ${primaryBtn}
          </div>
        </div>
      </div>`;

    mountOverlay(html);

    // 重新生成：仅临时性故障提供，关闭弹窗后重跑（本次走成功分支）
    const retry = $('#btnRetryGen');
    if (retry) retry.addEventListener('click', () => { closeOverlays(); startGenerating(); });

    // 跳转到能改变结果的页面（编排条件设置 / 人员安排）
    const prim = $('#btnFailPrimary');
    if (prim) prim.addEventListener('click', () => {
      const target = prim.dataset.failGo;
      // 走 gotoConditions 以保留首次进入的引导
      if (target === 'conditions') gotoConditions();
      else goScreen(target);
    });

    // 手动调整编排：跳过智能编排，直接进编排调整
    $('#btnManualAdjust').addEventListener('click', () => { closeOverlays(); openAdjust(); });

    initWidgets(overlayMount);
  }

  function showNotify(pct) {
    hideNotify();
    const el = document.createElement('div');
    el.className = 'notify';
    el.id = 'genNotify';
    el.innerHTML = `
      <div class="notify-head">
        <span class="ni">${icon('kpiBalance', 16, 1.8)}</span>
        <span class="grow">智能编排方案生成中</span>
        <span class="ax" data-close-notify>✕</span>
      </div>
      <div class="notify-text">
        Co-pilot 正在为您生成工作组 KCCW0012(赵波 张文字) 工作量均衡方案，请稍后查看。
      </div>
      <div class="progress">
        <div class="progress-track"><div class="progress-fill" style="width:${pct}%"></div></div>
        <span class="progress-pct">${pct}%</span>
      </div>`;
    document.body.appendChild(el);
    $('[data-close-notify]', el).addEventListener('click', hideNotify);
    return el;
  }

  function hideNotify() {
    if (genTimer) { clearInterval(genTimer); genTimer = null; }
    const old = $('#genNotify');
    if (old) old.remove();
  }

  /* 传入 SMART_FAIL_TYPES 的键（如 'conflict'）时，进度跑到 FAIL_AT 中断并弹出对应失败提示。
     不传则走成功分支。要让主流程演示失败，把 bindConditions 里的调用改成
     startGenerating('conflict') 即可。 */
  const FAIL_AT = 68;

  function startGenerating(failType) {
    let pct = 12;
    const el = showNotify(pct);
    genTimer = setInterval(() => {
      pct += Math.round(8 + Math.random() * 12);

      if (failType && pct >= FAIL_AT) {
        clearInterval(genTimer); genTimer = null;
        paint(el, Math.min(pct, FAIL_AT));
        setTimeout(() => showFailModal(failType), 420);
        return;
      }

      if (pct >= 100) {
        pct = 100;
        clearInterval(genTimer); genTimer = null;
        paint(el, 100);
        finishGenerating(el);
        return;
      }
      paint(el, pct);
    }, 620);

    function paint(node, v) {
      $('.progress-fill', node).style.width = v + '%';
      $('.progress-pct', node).textContent = v + '%';
    }
  }

  function finishGenerating(el) {
    $('.notify-head .grow', el).textContent = '智能编排方案已生成';
    $('.notify-text', el).innerHTML =
      `工作组 KCCW0012(赵波 张文字) 的工作量均衡方案已生成，可查看并与当前日历对比。`;
    $('.progress', el).outerHTML =
      `<div class="notify-acts">
         <button class="btn btn-sm" data-close-notify>稍后</button>
         <button class="btn btn-sm btn-primary" id="btnViewPlan">查看方案</button>
       </div>`;
    $('#btnViewPlan').addEventListener('click', () => { hideNotify(); openPlanDrawer(); });
    $$('[data-close-notify]', el).forEach((b) => b.addEventListener('click', hideNotify));
  }

  /* =======================================================================
     浮层挂载 / 通用控件
     ===================================================================== */
  function mountOverlay(html) {
    overlayMount.innerHTML = html;
    $$('[data-close-drawer]', overlayMount).forEach((el) => {
      el.addEventListener('click', () => {
        const t = el.dataset.toast;
        closeOverlays();
        if (t) toast(t);
      });
    });
  }

  function closeOverlays() { overlayMount.innerHTML = ''; }

  function toast(text) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.innerHTML = `<span class="tc"><svg viewBox="0 0 24 24"><path d="M4 12.5l5 5L20 6.5"/></svg></span><span>${text}</span>`;
    toastMount.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  /* 下拉 / 单选 / 复选 / 开关 / 提示 —— 统一绑定 */
  function initWidgets(root) {
    const r = root || document;

    // 下拉
    $$('[data-dd]', r).forEach((ctl) => {
      if (ctl.dataset.bound) return;
      ctl.dataset.bound = '1';
      const opts = (ctl.dataset.options || '').split('|').filter(Boolean);
      ctl.addEventListener('click', (e) => {
        e.stopPropagation();
        closeAllDropdowns();
        if (!opts.length) { ctl.classList.add('open'); return; }
        ctl.classList.add('open');
        const panel = document.createElement('div');
        panel.className = 'dropdown-panel';
        const cur = $('.val', ctl) ? $('.val', ctl).textContent.trim() : '';
        panel.innerHTML = opts.map((o) =>
          `<div class="dropdown-item ${o === cur ? 'sel' : ''}">${o}</div>`).join('');
        ctl.parentElement.appendChild(panel);
        $$('.dropdown-item', panel).forEach((it) => {
          it.addEventListener('click', (ev) => {
            ev.stopPropagation();
            const span = $('.ph', ctl) || $('.val', ctl);
            span.textContent = it.textContent;
            span.className = 'val';
            closeAllDropdowns();
            // 抛出变更，供需要联动的页面（如人员安排的类型筛选）监听
            ctl.dispatchEvent(new CustomEvent('dd:change', {
              detail: it.textContent, bubbles: true,
            }));
          });
        });
      });
    });

    // 复选
    $$('.checkbox', r).forEach((cb) => {
      if (cb.dataset.bound) return;
      cb.dataset.bound = '1';
      cb.addEventListener('click', (e) => { e.stopPropagation(); cb.classList.toggle('on'); });
    });

    // 单选
    $$('[data-radio]', r).forEach((rd) => {
      if (rd.dataset.bound) return;
      rd.dataset.bound = '1';
      rd.addEventListener('click', () => {
        const name = rd.dataset.radio;
        const scope = rd.closest('.modal, .drawer, .page') || document;
        $$(`[data-radio="${name}"]`, scope).forEach((x) => x.classList.remove('on'));
        rd.classList.add('on');
      });
    });

    // 开关
    $$('[data-switch]', r).forEach((sw) => {
      if (sw.dataset.bound) return;
      sw.dataset.bound = '1';
      sw.addEventListener('click', () => sw.classList.toggle('on'));
    });

    // 标签删除
    $$('.tag-day .x', r).forEach((x) => {
      if (x.dataset.bound) return;
      x.dataset.bound = '1';
      x.addEventListener('click', (e) => { e.stopPropagation(); x.parentElement.remove(); });
    });

    // 信息条关闭
    $$('[data-close-alert]', r).forEach((a) => {
      if (a.dataset.bound) return;
      a.dataset.bound = '1';
      a.addEventListener('click', () => a.closest('.alert').remove());
    });

    // 视图跳转
    $$('[data-go]', r).forEach((g) => {
      if (g.dataset.bound) return;
      g.dataset.bound = '1';
      g.addEventListener('click', () => go(g.dataset.go));
    });

    // 提示气泡：任何带 data-tip 的元素（含表头问号、置灰按钮）
    $$('[data-tip]', r).forEach((h) => {
      if (h.dataset.bound) return;
      h.dataset.bound = '1';
      h.addEventListener('mouseenter', () => showTip(h));
      h.addEventListener('mouseleave', hideTip);
    });

    // aria-disabled 的按钮拦掉点击
    $$('.btn.is-disabled', r).forEach((b) => {
      if (b.dataset.boundDis) return;
      b.dataset.boundDis = '1';
      b.addEventListener('click', (e) => { e.preventDefault(); e.stopPropagation(); });
    });
  }

  function closeAllDropdowns() {
    $$('.dropdown-panel').forEach((p) => p.remove());
    $$('[data-dd].open').forEach((c) => c.classList.remove('open'));
  }

  document.addEventListener('click', closeAllDropdowns);

  let tipEl = null;
  function showTip(anchor) {
    hideTip();
    tipEl = document.createElement('div');
    tipEl.className = 'tooltip';
    tipEl.textContent = anchor.dataset.tip || '';
    document.body.appendChild(tipEl);
    const r = anchor.getBoundingClientRect();
    const tr = tipEl.getBoundingClientRect();
    let left = r.left + r.width / 2 - tr.width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - tr.width - 8));
    let top = r.top - tr.height - 8;
    if (top < 8) top = r.bottom + 8;
    tipEl.style.left = left + 'px';
    tipEl.style.top = top + 'px';
  }
  function hideTip() { if (tipEl) { tipEl.remove(); tipEl = null; } }

  /* =======================================================================
     路由
     ===================================================================== */
  const VIEWS = {
    smart: { render: viewSmart, bind: bindSmart },
    conditions: { render: viewConditions, bind: bindConditions },
    leave: { render: viewLeave, bind: bindLeave },
  };

  let current = '';

  function renderView(name) {
    const v = VIEWS[name];
    if (!v) return;
    viewMount.innerHTML = v.render();
    viewMount.scrollTop = 0;
    initWidgets(viewMount);
    if (v.bind) v.bind();
    current = name;
  }

  /* go() 供页面内按钮使用；smart / conditions / leave 同时也是原型屏 id */
  function go(name) { goScreen(name); }

  /* 失败屏 id → SMART_FAIL_TYPES 的键 */
  const FAIL_SCREEN_TYPE = {
    'smart-failed': 'conflict',
    'fail-conflict': 'conflict',
    'fail-no-staff': 'noStaff',
    'fail-window': 'window',
    'fail-timeout': 'timeout',
    'fail-unknown': 'unknown',
  };

  /* 原型界面导航：screen id → 视图 + 浮层状态
     同时同步到 location.hash，便于直接用链接打开某一屏 */
  let currentScreen = 'smart';

  function goScreen(id, skipHash) {
    currentScreen = id;
    hideNotify();
    closeOverlays();

    if (!skipHash && location.hash.slice(1) !== id) {
      history.replaceState(null, '', '#' + id);
    }

    /* 离开首次编排流程涉及的页面即结束流程，步骤条随之收起 */
    const FLOW_SCREENS = ['conditions', 'leave', 'first-conditions', 'first-steps', 'first-leave'];
    if (FLOW_SCREENS.indexOf(id) < 0) firstFlow.active = false;

    switch (id) {
      case 'smart':
        renderView('smart');
        break;
      case 'first-smart':        // 首次点「智能编排」的引导
        renderView('smart');
        showGuide('conditions');
        break;
      case 'first-conditions':   // 条件设置页（步骤 1），点确定后弹出人员安排引导
        firstFlow.active = true; firstFlow.step = 0;
        renderView('conditions');
        showGuide('leave');
        break;
      case 'first-steps':        // 条件设置页（步骤 1），仅看步骤条
        firstFlow.active = true; firstFlow.step = 0;
        renderView('conditions');
        break;
      case 'first-leave':        // 人员安排页（步骤 2）
        firstFlow.active = true; firstFlow.step = 1;
        renderView('leave');
        break;
      case 'smart-generating':
        renderView('smart');
        showNotify(33);
        break;
      case 'smart-failed':      // 兼容早先给出的链接
      case 'fail-conflict':
      case 'fail-no-staff':
      case 'fail-window':
      case 'fail-timeout':
      case 'fail-unknown':
        renderView('smart');
        showFailModal(FAIL_SCREEN_TYPE[id]);
        break;
      case 'plan':
        renderView('smart');
        openPlanDrawer();
        break;
      case 'compare':
        renderView('smart');
        openPlanDrawer();
        // 方案 B / C 里对比就是第一步，openPlanDrawer 已经打开它，无需再叠一层
        if (!isFlow()) openCompareDrawer();
        break;
      case 'adjust':
        renderView('smart');
        openAdjust();
        break;
      case 'conditions':
        renderView('conditions');
        break;
      case 'leave':
        renderView('leave');
        break;
      case 'leave-modal':
        renderView('leave');
        openLeaveModal();
        break;
      default:
        renderView('smart');
    }
    markProto(id);
  }

  function markProto(id) {
    $$('#protoList .proto-item').forEach((it) =>
      it.classList.toggle('on', it.dataset.screen === id));
  }

  /* =======================================================================
     原型导航面板
     ===================================================================== */
  function renderProto() {
    $('#protoList').innerHTML = PROTO_SCREENS.map((s) => `
      <div class="proto-item" data-screen="${s.id}">
        <span>${s.label}</span><span class="shot">${s.shot}</span>
      </div>`).join('');

    $$('#protoList .proto-item').forEach((it) => {
      it.addEventListener('click', () => goScreen(it.dataset.screen));
    });

    $('#protoToggle').addEventListener('click', (e) => {
      e.stopPropagation();
      $('#protoPanel').classList.toggle('hidden');
    });

    /* 方案 A / B / C 切换。两个按钮各自开关自己，再点一下回到方案 A。
       切换后清掉人工调整并重渲当前屏，使抽屉按新流程重新打开。 */
    const MODE_TOAST = {
      A: '已切回方案A：对比与应用为平级按钮',
      B: '已切换到方案B：手动调整为独立模式（按按钮进入）',
      C: '已切换到方案C：日历常态可点，点哪天调哪天',
    };

    function setMode(next) {
      planMode = next;
      manualMoves = [];
      syncModeButtons();
      toast(MODE_TOAST[planMode]);
      goScreen(currentScreen);
    }

    const mt = $('#modeToggle');
    if (mt) mt.addEventListener('click', (e) => {
      e.stopPropagation();
      setMode(isB() ? 'A' : 'B');
    });

    const mtc = $('#modeToggleC');
    if (mtc) mtc.addEventListener('click', (e) => {
      e.stopPropagation();
      setMode(isC() ? 'A' : 'C');
    });
  }

  /* 两个模式按钮的高亮，以及方案 C 专属样式的开关。
     C 的配色差异挂在 body.plan-c 下，这里统一切，保证 A / B 外观不受影响。 */
  function syncModeButtons() {
    const mt = $('#modeToggle');
    const mtc = $('#modeToggleC');
    if (mt) mt.classList.toggle('on', isB());
    if (mtc) mtc.classList.toggle('on', isC());
    document.body.classList.toggle('plan-c', isC());
  }

  /* =======================================================================
     启动
     ===================================================================== */
  renderMenu();
  renderProto();
  syncModeButtons();

  /* smart-failed 不在导航列表里，但要保持链接可用 */
  const VALID = PROTO_SCREENS.map((s) => s.id).concat(['smart-failed']);
  const initial = location.hash.slice(1);
  goScreen(VALID.includes(initial) ? initial : 'smart');

  window.addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (VALID.includes(id)) goScreen(id, true);
  });

})();
