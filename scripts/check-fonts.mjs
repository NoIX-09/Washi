// scripts/check-fonts.mjs
// 校验产出的字体子集是否覆盖站点当前用字。
//
// 用法：node scripts/check-fonts.mjs [--dist dist] [--fonts dist/fonts]
// 覆盖不到时以非零码退出，可直接挂进 CI；构建流程也会自动跑它（见 subset-fonts.mjs）。
//
// ---------------------------------------------------------------------------
// 为什么这里**故意**不复用 font-charset.mjs 的语料扫描
//
// 如果校验器问的问题是「font-charset.mjs 算出来的那份字符集，字体里都有吗」，
// 那么 font-charset.mjs 里任何一个 bug（漏了一个区段、过滤器写错、遍历漏了目录）
// 都是**不可见的** —— 校验器问的是同一个错误问题，得到的是同一个错误答案，
// 然后打印 ✓。这叫自证清白，等于没校验。
//
// 所以这里自己独立重扫一遍 dist，问一个不同的问题：
//   「构建产物里出现的**每一个非 ASCII 字符**，产出的字体里都有吗？」
// 它不带任何基线区段、不共用 collectSiteChars / findSiteChars，
// 连扩展名白名单都自己写一份。生成器把某个区段删掉时，这里必须报出来。
//
// 这不是理论洁癖：改这个文件时，把 font-charset.mjs 的 CJK_RANGES 删掉一段，
// 构建必须失败。如果还能通过，说明校验已经退化成装饰品。
// ---------------------------------------------------------------------------
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { create } from 'fontkitten';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

// 自己的一份白名单，**刻意不从 font-charset.mjs import**（见文件头）
const VERIFY_EXTS = new Set(['.html', '.js', '.mjs', '.css', '.svg']);

// 子集里必须存在的表。少一个浏览器就可能整个字体拒绝加载或渲染异常
const REQUIRED_TABLES = ['cmap', 'head', 'hhea', 'hmtx', 'loca', 'maxp', 'name', 'glyf'];

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
 * 独立重扫 dist，返回其中出现的所有**非 ASCII** 字符。
 *
 * 非 ASCII 是刻意取宽的：不设任何「基线区段」概念，凡是非 ASCII 的都要求有字形。
 * 取窄（比如只看到 CJK）就会漏掉 `✓ ★ ①` 这类符号 —— 那正是真实存在过的漏字。
 */
export function scanDistChars(distDir) {
  const set = new Set();
  const files = walk(distDir, [], (n) => VERIFY_EXTS.has(path.extname(n).toLowerCase()));
  for (const f of files) {
    let text;
    try { text = readFileSync(f, 'utf8'); } catch { continue; }
    for (const ch of text) if (ch.codePointAt(0) > 0x7f) set.add(ch);
  }
  return { chars: set, files: files.length };
}

/** 读一个字体文件（TTF 或 woff2 都行）的 cmap、表清单与 PostScript 名 */
export function readFont(file) {
  const font = create(readFileSync(file));
  return {
    // fontkitten 的 characterSet 是**数组**不是 Set，且会带上 U+FFFF
    // （cmap format 4 的终止哨兵，Unicode 非字符）。剔掉它即可，
    // 其余照单全收 —— 多留字形只是浪费几十字节，漏字才是要命的
    charset: new Set([...font.characterSet].filter((c) => (c & 0xfffe) !== 0xfffe && !(c >= 0xfdd0 && c <= 0xfdef))),
    // fontkitten 的 directory.tables 是**以 tag 为键的对象**，不是数组
    tables: new Set(Object.keys(font.directory?.tables || {})),
    postscriptName: font.postscriptName,
    numGlyphs: font.numGlyphs,
  };
}

/**
 * 校验产出的子集。
 *
 * 两类「缺失」必须分开，否则会把正常回落的字当成构建失败：
 *   - 源 TTF 里就没有      → **告警**。emoji、生僻符号属预期回落，不该搞挂构建
 *   - 源 TTF 有、子集丢了  → **失败**。这才是真正的回归（子集化把字形弄丢了）
 */
export function verifySubsets({ distDir = null, fontsDir, fonts, sourcesRoot = root, allowMissing = false }) {
  const problems = [];
  const checked = [];
  const skipped = [];

  // 独立重扫一次 dist；没有 dist（dev 模式）时只做结构自检
  const independent = distDir && existsSync(distDir) ? scanDistChars(distDir) : null;
  const required = independent ? independent.chars : null;

  const missing = new Map();      // 字符 → 缺它的字体名（硬失败）
  const sourceMissing = new Map(); // 字符 → 源 TTF 就没有的字体名（告警）

  for (const f of fonts) {
    const outPath = path.join(fontsDir, f.out);

    if (!existsSync(outPath)) {
      skipped.push(f.out);
      continue;
    }

    const out = readFont(outPath);
    checked.push(f.out);

    // 结构自检：表齐不齐、名字对不对
    const absent = REQUIRED_TABLES.filter((t) => !out.tables.has(t));
    if (absent.length) problems.push(`${f.out} 缺少必需的表：${absent.join(' / ')}`);
    if (out.postscriptName !== f.name) {
      problems.push(`${f.out} 的 PostScript 名是 ${out.postscriptName}，清单里写的是 ${f.name} —— 下到的可能是非 GB 变体`);
    }

    if (!required) continue;

    for (const ch of required) {
      const cp = ch.codePointAt(0);
      if (!out.charset.has(cp)) {
        if (!missing.has(ch)) missing.set(ch, []);
        missing.get(ch).push(f.weight);
      }
    }
  }

  // 源 TTF 那一半：只为把「本来就回落」的字从失败里摘出来，不参与通过与否
  if (required && fonts.length) {
    const seen = new Set();
    for (const f of fonts) {
      const srcPath = path.join(sourcesRoot, f.src);
      if (!existsSync(srcPath)) continue;
      const src = readFont(srcPath);
      for (const ch of required) {
        const cp = ch.codePointAt(0);
        if (!src.charset.has(cp) && !seen.has(ch)) {
          seen.add(ch);
          if (!sourceMissing.has(ch)) sourceMissing.set(ch, []);
          sourceMissing.get(ch).push(f.weight);
        }
      }
    }
  }

  // 子集丢了源字体有的字形 —— 从失败名单里剔除「源本来就没有」的部分
  const trueRegression = new Map();
  for (const [ch, weights] of missing) {
    if (!sourceMissing.has(ch)) trueRegression.set(ch, weights);
  }

  const failBecauseSkipped = skipped.length > 0 && !allowMissing;
  const failBecauseNothingChecked = checked.length === 0;

  // 没有 dist 时只做了结构自检，覆盖率这件事**没验过** —— 这种情况不该报 ✓。
  // 返回 independent 让调用方知道这次到底验到了什么
  return {
    required: required ? required.size : 0,
    scannedFiles: independent ? independent.files : 0,
    coverageChecked: Boolean(required),
    checked,
    skipped,
    missing: trueRegression,
    sourceMissing,
    problems,
    ok: !(failBecauseSkipped || failBecauseNothingChecked || trueRegression.size > 0 || problems.length > 0),
  };
}

// —— CLI ——
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const argOf = (name, dflt) => {
    const i = process.argv.indexOf(name);
    return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
  };
  const distDir = path.resolve(root, argOf('--dist', 'dist'));
  const fontsDir = path.resolve(root, argOf('--fonts', 'dist/fonts'));
  const { textFonts } = await import('./font-list.mjs');

  const hasDist = existsSync(distDir);
  const r = verifySubsets({ distDir: hasDist ? distDir : null, fontsDir, fonts: textFonts });

  console.log(`字体目录：${path.relative(root, fontsDir)}`);

  if (!hasDist) {
    // 没有 dist 就没有比对基准，覆盖率这件事**没验过**。
    // 这里不能打印 ✓ —— 「没验」和「验过通过」必须能区分开，
    // 否则就又回到了「文件不存在就跳过、最后照样报通过」那条老路
    console.error(`✗ 找不到 ${path.relative(root, distDir)}/，没有可比对的构建产物。`);
    console.error('  覆盖率只在构建产物上才有意义，先跑 npm run build，或直接 npm run fonts:check --dist <目录>。');
    process.exitCode = 1;
  } else {
    console.log(`校验基准：独立重扫 ${path.relative(root, distDir)}/（${r.scannedFiles} 个文件，${r.required} 个非 ASCII 字符）`);
  }

  for (const p of r.problems) console.error(`  ✗ ${p}`);
  for (const s of r.skipped) console.error(`  ✗ 缺少产出文件 ${path.relative(root, path.join(fontsDir, s))}`);

  if (r.sourceMissing.size) {
    // 源字体里就没有 —— 预期回落，不是错误
    console.warn(`  ⚠ ${r.sourceMissing.size} 个字符源字体本身就没有字形，会回落到系统字体：`);
    for (const [ch, weights] of [...r.sourceMissing].slice(0, 20)) {
      console.warn(`      ${ch}  (U+${ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0')}，缺：${weights.join(' / ')})`);
    }
    if (r.sourceMissing.size > 20) console.warn(`      …另有 ${r.sourceMissing.size - 20} 个`);
  }

  if (r.ok && r.coverageChecked) {
    // 通过时必须说明**校验了什么**。「✓ 覆盖全部用字」这种不提校验对象的说法，
    // 正是「文件不存在就跳过、最后照样报通过」那个假通过能活下来的原因
    console.log(`✓ 覆盖 ${r.required} 个用字（实际校验了 ${r.checked.length} 个子集：${r.checked.join(', ')}）`);
  } else if (r.ok) {
    console.log(`✓ 结构自检通过（${r.checked.length} 个子集）——但覆盖率未校验`);
  } else {
    if (r.missing.size) {
      console.error(`✗ ${r.missing.size} 个字符源字体有字形、但子集里没有（子集化把它们弄丢了）：`);
      for (const [ch, weights] of [...r.missing].slice(0, 40)) {
        console.error(`      ${ch}  (缺：${weights.join(' / ')})`);
      }
    }
    if (r.checked.length === 0) console.error('✗ 一个子集都没校验到 —— 什么都没验不等于通过');
    process.exitCode = 1;
  }
}
