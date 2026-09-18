// scripts/font-charset.mjs
// 字符集收集：subset-fonts.mjs（切子集）与 check-fonts.mjs（校验漏字）共用**基线区段**，
// 但**校验器不共用这里的语料扫描** —— 原因见 check-fonts.mjs 顶部。
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

function range(lo, hi) {
  let s = '';
  for (let cp = lo; cp <= hi; cp++) s += String.fromCodePoint(cp);
  return s;
}

// 标点与符号。两个字体族都要：正文里的破折号、代码块里的箭头都靠它们。
const PUNCT_RANGES = [
  [0x20, 0x7e],     // ASCII 可打印
  [0xa0, 0xff],     // Latin-1（NBSP + 变音拉丁字母）
  [0x2010, 0x206f], // 通用标点（破折号/引号/省略号）
  [0x2190, 0x21ff], // 箭头（→←↑↓，注释与终端输出常用）
  [0x2200, 0x22ff], // 数学运算符（×÷≤≥≠≈）
  [0x2500, 0x259f], // 制表框线 / 方块（终端输出、ASCII 图）
];

// 汉字与和文相关的区段。只有正文用到的文楷字体族需要，
// 等宽那个只服务于日期与代码，扛 CJK 纯属浪费（实测 888 KB → 21 KB）。
//
// 这里有一份约 51 KB/字重的死基线（实测：这两个区段提供的字形里，
// 假名 189 个、全角 225 个，而含全部 4 种语言的 dist 实际只用到 59 + 6 个）。
// 语料改成「扫构建产物」之后这份基线其实基本冗余了，但**收窄它必须等
// check-fonts.mjs 的独立校验立住之后**才安全 —— 否则生成器和校验器会一起错。
const CJK_RANGES = [
  [0x3000, 0x303f], // CJK 标点（、。「」《》）
  [0x3040, 0x30ff], // 平假名 + 片假名
  [0xff00, 0xffef], // 全角形式
];

function fromRanges(ranges) {
  let s = '';
  for (const [lo, hi] of ranges) s += range(lo, hi);
  return s;
}

// 扫哪些目录找站点用字（**仅 dev 模式**）—— 内容集合在 src/content 下，新增文章自然被带上
const SCAN_DIRS = ['src/i18n', 'src/content', 'src/pages', 'src/components', 'src/layouts'];

// **仅 build 模式**：扫 dist 时允许读的扩展名。
//
// 这个白名单是必需的，不是优化：把 dist 下所有文件都按 UTF-8 读一遍会从
// favicon.ico / *.png / *.webp 里解出上万「汉字」（实测 16319 个），
// 字体体积直接涨 20 倍。加上白名单后实测 829 个，与逐个解析 HTML 的结果一致。
//
// 不收录 .json：Live2D 的 *.model3.json 会带出 14 个参数显示名（`旋右珠眉変朵呆毛吊睛衣五官`），
// 那些字符串只给建模工具看，永远不会出现在页面上。
const DIST_EXTS = new Set(['.html', '.js', '.mjs', '.css', '.svg']);

function walk(dir, out, filter) {
  let entries;
  try { entries = readdirSync(dir); } catch { return out; }
  for (const name of entries) {
    const p = path.join(dir, name);
    let s;
    try { s = statSync(p); } catch { continue; }
    if (s.isDirectory()) walk(p, out, filter);
    else if (filter(name)) out.push(p);
  }
  return out;
}

/**
 * 从语料里收「站点实际会用到」的字符。
 *
 * mode='dev'   扫 src/（SCAN_DIRS）。没有 dist 可扫时的退路，**是个超集** ——
 *              含代码注释里的字，比构建产物多约 40%。
 * mode='build' 扫 dist/（DIST_EXTS 白名单），**整个文件按原始字节收**。
 *
 * build 模式刻意**不解析 HTML**：实测「原始字节扫描」与「剥标签 + 属性值 + 内联脚本」
 * 的解析版结果**完全一致**（都是 829）。多写一层解析器就多一类「选择器漏了某种写法」
 * 的 bug，而那种 bug 的后果正是漏字。注释、`<style>`、JSON-LD 里的汉字算过度包含，
 * 是免费的安全余量。
 *
 * 两种模式都并上 .env 的值 —— 站点配置里的字也要有字形，
 * 且「今日宜忌」那种词池正来自 .env。
 */
export function findSiteChars({ root, mode = 'dev', distDir = null }) {
  const set = new Set();
  const addText = (t) => {
    if (!t) return;
    for (const ch of t) {
      // 过滤条件从 0x2e80 放宽到 0x7f：0x2e80 以下、又不在 PUNCT_RANGES 里的
      // 字符（① ★ ✓ ■ ™ № …）此前被静默丢掉，哪怕字体明明有这些字形。
      // 写一个 ✓ 进文章就会掉成系统字体，且不报错。
      //
      // 放宽的是**语料过滤器**而不是去扩 PUNCT_RANGES —— 扩区段等于往每次构建里
      // 永久塞约 450 个字形（约 68 KB/字重），用不用都得付；放宽过滤器则只为
      // 真正用到的字付钱，且当前成本为零（dist 里所有 <=0x2e80 的字符本就都在固定区段内）。
      if (ch.codePointAt(0) > 0x7f) set.add(ch);
    }
  };

  if (mode === 'build') {
    if (!distDir) throw new Error('build 模式必须给 distDir');
    for (const f of walk(distDir, [], (n) => DIST_EXTS.has(path.extname(n).toLowerCase()))) {
      try { addText(readFileSync(f, 'utf8')); } catch { /* 读不了就跳过 */ }
    }
  } else {
    const files = [];
    for (const r of SCAN_DIRS) walk(path.join(root, r), files, (n) => /\.(astro|ts|md|json|mdx)$/.test(n));
    for (const f of files) {
      try { addText(readFileSync(f, 'utf8')); } catch { /* 读不了就跳过 */ }
    }
  }

  try {
    for (const line of readFileSync(path.join(root, '.env'), 'utf8').split(/\r?\n/)) {
      const i = line.indexOf('=');
      if (i > 0) addText(line.slice(i + 1).trim());
    }
  } catch { /* 没有 .env 也能跑 */ }

  return set;
}

/**
 * 正文文楷字体的字符集：固定标点 + CJK 区段 + 站点实际用字。
 *
 * **不要并入「常用汉字表」之类的保底字符集**：实测站点只用得到 3500 常用字里的
 * 797 个，另外 2703 字（77%）从没出现过，却让每个字重多背约 660 KB。
 * 站点用字本来就是自动收出来的，保底换来的只是「新写的字不掉到系统字体」，
 * 代价太大 —— 漏字改由 check-fonts.mjs 报警（见该文件）。
 */
export function buildTextCharset(opts) {
  const set = new Set(fromRanges([...PUNCT_RANGES, ...CJK_RANGES]));
  for (const ch of findSiteChars(opts)) set.add(ch);
  return set;
}

/** 等宽字体的字符集：只要标点区段。中文走字体栈回落到文楷（见各处的 font-family） */
export function buildMonoCharset() {
  return new Set(fromRanges(PUNCT_RANGES));
}

/** 按码位排序后再 join：保证字符集字节稳定，进而让产出的 woff2 字节稳定 */
export const toCharsetString = (set) =>
  [...set].sort((a, b) => a.codePointAt(0) - b.codePointAt(0)).join('');
