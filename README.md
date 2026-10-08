# 智能编排 UI 原型

KONE 通力维保运营管理系统「智能编排」模块的高保真静态原型，共 17 屏。

## 在线预览

GitHub Pages 发布自 `docs/` 目录：开启 Pages 后地址为
`https://<用户名>.github.io/<仓库名>/`

## 目录

| 路径 | 说明 |
| --- | --- |
| `智能编排UI update.html` | 源页面骨架，引用 `css/`、`js/` |
| `css/base.css`、`css/modules.css` | 样式 |
| `js/data.js` | 全部文案与数据（日历、工单、KPI、弹窗文案） |
| `js/app.js` | 渲染与交互 |
| `build.js` | 把上面几份内联成单文件 |
| `智能编排UI原型.html` | 构建产物，自包含、可离线打开 |
| `docs/index.html` | 同一份产物，GitHub Pages 的发布入口 |

## 改动方式

改源码，然后重新构建：

```bash
node build.js
cp 智能编排UI原型.html docs/index.html
```

不要直接编辑 `智能编排UI原型.html` 和 `docs/index.html` —— 它们由 `build.js`
生成，下次构建会被覆盖。

## 三种交互方案

左下角浮动按钮在 A / B / C 之间切换：

- **方案 A** 对比与应用为平级按钮
- **方案 B** 手动调整是独立的调整模式
- **方案 C** 日历常态可点，点日期直接进手动调整；工单可逐张勾选

A 与 B 已冻结，新改动只做在 C。

## 数据说明

工单编号、设备编号、客户自编号均由日期和序号确定性推导生成，非真实数据。
