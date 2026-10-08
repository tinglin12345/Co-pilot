#!/usr/bin/env node
/* =========================================================================
   把 css/ 与 js/ 全部内联进单个 HTML，产出可直接分享的离线文件。
   用法： node build.js
   ========================================================================= */

const fs = require('fs');
const path = require('path');

const SRC = '智能编排UI update.html';          // 开发用（引用外部 css/js）
const OUT = '智能编排UI原型.html';              // 分享用（单文件、零依赖）

function read(p) {
  if (!fs.existsSync(p)) {
    console.error(`× 找不到 ${p}`);
    process.exit(1);
  }
  return fs.readFileSync(p, 'utf8');
}

let html = read(SRC);
const inlined = [];

/* 内联样式表 */
html = html.replace(/[ \t]*<link[^>]*rel="stylesheet"[^>]*href="([^"]+)"[^>]*>\s*/g, (m, href) => {
  const css = read(href);
  inlined.push(href);
  return `<style>\n/* ===================== ${href} ===================== */\n${css}\n</style>\n`;
});

/* 内联脚本。data.js 必须在 app.js 之前，源文件里的顺序已保证 */
html = html.replace(/[ \t]*<script src="([^"]+)"><\/script>\s*/g, (m, src) => {
  const js = read(src);
  inlined.push(src);
  // 防御：脚本内容若含 </script> 会提前闭合，这里断言一下
  if (/<\/script/i.test(js)) {
    console.error(`× ${src} 含 </script>，无法安全内联`);
    process.exit(1);
  }
  return `<script>\n/* ===================== ${src} ===================== */\n${js}\n</script>\n`;
});

if (!inlined.length) {
  console.error('× 没有内联到任何资源，检查源文件里的 link / script 标签');
  process.exit(1);
}

/* 顶部加一行生成说明 */
const stamp = new Date().toISOString().slice(0, 19).replace('T', ' ');
html = html.replace(/<head>/, `<head>
<!-- 本文件由 build.js 自动生成（${stamp}），已内联全部样式与脚本，
     可直接双击打开或发送给他人，无需任何外部文件与网络。
     请勿直接编辑此文件 —— 改动请在 css/ 与 js/ 下进行，然后重新执行 node build.js -->`);

fs.writeFileSync(OUT, html, 'utf8');

/* 同步到 GitHub Pages 的发布目录。放在构建里是因为手动拷贝一定会忘，
   忘一次线上就停在旧版本 —— 而这种「代码改了但线上没变」最难自查。
   docs/ 是 Pages 支持的两个发布位置之一（另一个是仓库根目录）。 */
const PAGES = [
  path.join('docs', 'index.html'),
  path.join('docs', OUT),
];
const synced = [];
if (fs.existsSync('docs')) {
  PAGES.forEach((p) => {
    fs.writeFileSync(p, html, 'utf8');
    synced.push(p);
  });
}

const kb = (fs.statSync(OUT).size / 1024).toFixed(1);
console.log(`✓ 已生成 ${OUT}（${kb} KB）`);
console.log(`  内联资源：${inlined.join('、')}`);
console.log('  外部依赖：无（可离线打开）');
if (synced.length) console.log(`  已同步发布目录：${synced.join('、')}`);
