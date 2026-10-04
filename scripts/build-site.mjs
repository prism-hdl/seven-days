// 把 episodes/ 里的成稿 HTML 加工成带侧边栏目录的文档站，输出到 web/
// 侧边栏结构从 episodes/index.html 的七日导览派生，新增集数后只需重跑本脚本。
import { readFileSync, writeFileSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';

const SRC = 'episodes';
const OUT = 'web';

const DAY_COLOR = {
  d1: '#ffd479', d2: '#4ad6b4', d3: '#8ab4f8', d4: '#a678ff',
  d5: '#ff8a4c', d6: '#e0507a', d7: '#c8cfdd',
};

const esc = (s) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const strip = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

function parseIndex(html) {
  const starts = [...html.matchAll(/<div class="day (d\d)" id="day\d">/g)];
  return starts.map((m, i) => {
    const next = i + 1 < starts.length ? starts[i + 1].index : html.indexOf('</section>', m.index);
    const block = html.slice(m.index, next < 0 ? undefined : next);
    const label = /<div class="label">([^<]+)<\/div>/.exec(block)?.[1] ?? '';
    const status = (/·\s*(.+)$/.exec(label)?.[1] ?? '').trim();
    const name = /<div class="name">([^<]+)<\/div>/.exec(block)?.[1] ?? '';
    const items = [...block.matchAll(
      /<(a|span) class="ep(?: todo)?"([^>]*)>[\s\S]*?<span class="n">([\s\S]*?)<\/span>([\s\S]*?)<\/\1>/g,
    )].map((x) => ({
      href: /href="([^"]+)"/.exec(x[2])?.[1] ?? null,
      num: strip(x[3]),
      title: strip(x[4]),
    }));
    return { key: m[1], name, status, items };
  });
}

const CSS = `
/* ---------- 侧边栏目录（构建脚本注入） ---------- */
:root { --nav-w: 288px; --nav-bg: #080b13; --nav-line: rgba(255,255,255,.09); }
body { padding-left: var(--nav-w); }
.site-nav { position: fixed; inset: 0 auto 0 0; width: var(--nav-w); z-index: 60;
  background: var(--nav-bg); border-right: 1px solid var(--nav-line);
  display: flex; flex-direction: column; }
.site-nav-inner { overflow-y: auto; overscroll-behavior: contain; padding: 22px 16px 28px; flex: 1;
  scrollbar-width: thin; scrollbar-color: #2a3242 transparent; }
.site-nav-inner::-webkit-scrollbar { width: 8px; }
.site-nav-inner::-webkit-scrollbar-thumb { background: #242c3b; border-radius: 8px; }
.nav-brand { display: block; text-decoration: none; padding: 0 8px 18px; margin-bottom: 8px;
  border-bottom: 1px solid var(--nav-line); }
.nav-kicker { display: block; font-family: 'JetBrains Mono', monospace; font-size: 10px;
  letter-spacing: .14em; color: #8892a6; margin-bottom: 6px; }
.nav-title { display: block; font-family: 'Noto Serif SC', serif; font-size: 21px; font-weight: 700; color: #fff; }
.nav-title em { font-style: normal; background: linear-gradient(112deg, #ffe0a8, #a678ff);
  -webkit-background-clip: text; background-clip: text; color: transparent; }
.nav-top { display: flex; flex-direction: column; gap: 2px; margin-bottom: 16px; }
.nav-top a { display: flex; align-items: baseline; gap: 8px; padding: 7px 10px; border-radius: 7px;
  font-size: 13.5px; color: #c6cdda; text-decoration: none; }
.nav-top a:hover { background: rgba(255,255,255,.06); color: #fff; }
.nav-top a.on { background: rgba(91,75,255,.2); color: #fff; box-shadow: inset 2px 0 0 #a678ff; }
.nav-top a .tag { font-family: 'JetBrains Mono', monospace; font-size: 10px; letter-spacing: .08em; color: #7a8497; }
.nav-day { margin-bottom: 14px; }
.nav-day h3 { display: flex; align-items: center; gap: 7px; font-size: 12px; font-weight: 600;
  color: #8892a6; letter-spacing: .02em; padding: 0 10px; margin-bottom: 5px; }
.nav-day h3 .dot { width: 7px; height: 7px; border-radius: 2px; flex: none; }
.nav-day h3 .nm { color: #e8ecf4; }
.nav-day h3 .st { margin-left: auto; font-family: 'JetBrains Mono', monospace; font-size: 9.5px; color: #5d6779; }
.nav-day ul { list-style: none; margin: 0; padding: 0; }
.nav-day li a, .nav-day li span.row { display: flex; gap: 8px; align-items: baseline;
  padding: 6px 10px 6px 14px; border-radius: 7px; font-size: 13px; line-height: 1.45;
  color: #9aa4b8; text-decoration: none; }
.nav-day li a:hover { background: rgba(255,255,255,.06); color: #fff; }
.nav-day li a .n, .nav-day li span.row .n { font-family: 'JetBrains Mono', monospace;
  font-size: 10.5px; color: #6b7488; flex: none; }
.nav-day li a .n { color: #a678ff; }
.nav-day li.todo span.row { color: #4c5666; cursor: default; padding-left: 13px;
  border-left: 1px dashed rgba(255,255,255,.1); border-radius: 0; }
.nav-day li a.on { background: rgba(91,75,255,.22); color: #fff; }
.nav-day li a.on .n { color: #ffe0a8; }
.nav-foot { margin-top: 20px; padding: 14px 10px 0; border-top: 1px solid var(--nav-line);
  font-size: 11.5px; color: #5d6779; line-height: 1.7; }
.nav-foot a { color: #8a94a8; text-decoration: none; }
.nav-foot a:hover { color: #a678ff; }
.nav-toggle { display: none; position: fixed; z-index: 70; left: 14px; top: 14px; padding: 9px 14px;
  border-radius: 8px; border: 1px solid rgba(255,255,255,.22); background: rgba(8,11,19,.86);
  backdrop-filter: blur(8px); color: #fff; font: 600 13px/1 'Inter', 'Noto Serif SC', sans-serif; cursor: pointer; }
.nav-scrim { display: none; position: fixed; inset: 0; z-index: 55; background: rgba(4,6,12,.6); }
html.nav-open .nav-scrim { display: block; }
@media (max-width: 1080px) {
  body { padding-left: 0; }
  .site-nav { transform: translateX(-100%); transition: transform .22s ease; width: min(var(--nav-w), 86vw); }
  html.nav-open .site-nav { transform: none; }
  .nav-toggle { display: inline-flex; align-items: center; gap: 6px; }
  .hero .hero-inner, main { padding-top: 52px; }
}
@media print { .site-nav, .nav-toggle, .nav-scrim { display: none !important; } body { padding-left: 0; } }
`;

const JS = `
<script>
(function () {
  var root = document.documentElement;
  var nav = document.getElementById('site-nav');
  var toggle = document.getElementById('nav-toggle');
  toggle.addEventListener('click', function () {
    var open = root.classList.toggle('nav-open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    if (open) { var on = nav.querySelector('a.on'); if (on) on.scrollIntoView({ block: 'nearest' }); }
  });
  document.getElementById('nav-scrim').addEventListener('click', function () {
    root.classList.remove('nav-open');
    toggle.setAttribute('aria-expanded', 'false');
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && root.classList.contains('nav-open')) toggle.click();
  });
})();
</script>
`;

function navHtml(days, pageRel) {
  const here = dirname(join(OUT, pageRel));
  const link = (target) => relative(here, join(OUT, target)).replace(/\\/g, '/');
  const self = link(pageRel);

  const top = [
    { href: 'index.html', tag: 'HOME', label: '首页 · 七日导览' },
    { href: 'outline.html', tag: 'OUTLINE', label: '全部集数大纲' },
  ].map((it) => {
    const target = link(it.href);
    const on = target === self ? ' class="on" aria-current="page"' : '';
    return `<a href="${esc(target)}"${on}><span class="tag">${it.tag}</span>${esc(it.label)}</a>`;
  }).join('');

  const groups = days.map((d) => {
    const items = d.items.map((it) => {
      if (!it.href) {
        return `<li class="todo"><span class="row"><span class="n">${esc(it.num)}</span><span class="t">${esc(it.title)}</span></span></li>`;
      }
      const target = link(it.href);
      const on = target === self ? ' class="on" aria-current="page"' : '';
      return `<li><a href="${esc(target)}"${on}><span class="n">${esc(it.num)}</span><span class="t">${esc(it.title)}</span></a></li>`;
    }).join('');
    return `<section class="nav-day"><h3><span class="dot" style="background:${DAY_COLOR[d.key]}"></span>`
      + `<span class="nm">${esc(d.name)}</span><span class="st">${esc(d.status || '待写')}</span></h3>`
      + `<ul>${items}</ul></section>`;
  }).join('');

  return `<nav class="site-nav" id="site-nav" aria-label="文档目录"><div class="site-nav-inner">`
    + `<a class="nav-brand" href="${esc(link('index.html'))}">`
    + `<span class="nav-kicker">PRISM DSL × RISC-V</span><span class="nav-title">七日<em>创造</em></span></a>`
    + `<div class="nav-top">${top}</div>${groups}`
    + `<div class="nav-foot">连载写作中 · 一个人造的编译器与语言<br>`
    + `<a href="https://github.com/ifnfn">作者</a> · <a href="https://github.com/prism-hdl">Prism HDL</a></div>`
    + `</div></nav>`
    + `<button class="nav-toggle" id="nav-toggle" aria-controls="site-nav" aria-expanded="false">目录</button>`
    + `<div class="nav-scrim" id="nav-scrim"></div>`;
}

const files = [];

// Google Fonts 的 <link rel=stylesheet> 会阻塞首屏渲染；该域名在中国大陆不可达，
// 手机端会白屏等到请求超时。改成先以 media=print 非阻塞加载，到手后再切回 all。
function deferFonts(html) {
  return html.replace(
    /<link (href="(https:\/\/fonts\.googleapis\.com\/css2[^"]*)") rel="stylesheet">/g,
    '<link $1 media="print" onload="this.media=\'all\'"><noscript><link $1 rel="stylesheet"></noscript>',
  );
}
(function walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) walk(p);
    else if (entry.name.endsWith('.html')) files.push(p);
  }
})(SRC);

const days = parseIndex(readFileSync(join(SRC, 'index.html'), 'utf8'));
if (!days.length || !days.some((d) => d.items.length)) {
  console.error('未能从 episodes/index.html 解析出七日导览结构');
  process.exit(1);
}

rmSync(OUT, { recursive: true, force: true });
for (const src of files) {
  const pageRel = relative(SRC, src);
  const original = readFileSync(src, 'utf8');
  let out = deferFonts(original).replace('</head>', `<style>${CSS}</style></head>`);
  if (/<main(?![\w-])/.test(out)) out = out.replace(/<main(?![\w-])/, (m) => `${m} id="doc-main"`);
  out = out.replace(/<body(?![\w-])/, (m) => `${m}\n${navHtml(days, pageRel)}`);
  out = out.replace('</body>', `${JS}</body>`);
  if (out === original) {
    console.warn(`跳过（缺少 body/head）：${pageRel}`);
    continue;
  }
  const dst = join(OUT, pageRel);
  mkdirSync(dirname(dst), { recursive: true });
  writeFileSync(dst, out);
  console.log(`✓ ${pageRel}`);
}

const written = days.reduce((n, d) => n + d.items.filter((i) => i.href).length, 0);
console.log(`\n已发布 ${written} 集 · 侧边栏共 ${days.reduce((n, d) => n + d.items.length, 0)} 个条目 · ${files.length} 页`);
