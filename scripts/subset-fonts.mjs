// scripts/subset-fonts.mjs
// 把原始 TTF 裁剪为单文件 woff2，只保留站点实际用到的字符。
//
// 用法：
//   node scripts/subset-fonts.mjs                 # dev 模式，扫 src/，输出到 public/fonts
//   node scripts/subset-fonts.mjs --mode build    # 扫 dist/，输出到 dist/fonts
//   node scripts/subset-fonts.mjs --out <目录>    # 换输出目录
//
// 平时**不需要手动跑**：astro.config.mjs 挂的 integration 会在 dev 启动时
// 与 build 结束时自动调用本文件（见 fonts-integration.mjs）。
// 手动跑的场合是「dev 已经开着、又写了新内容」——Vite 不会重跑 config:setup。
//
// 源 TTF 在 fonts-src/（已 gitignore，约 74 MB），由 fetch-fonts.mjs 自动下载。
//
// 字符集不在这里定义，见 font-charset.mjs；字体清单见 font-list.mjs。
// 切完会自动跑一遍覆盖校验（见 check-fonts.mjs）——**校验失败会直接抛错**，
// 不留半份产物。
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { buildTextCharset, buildMonoCharset, findSiteChars, toCharsetString } from './font-charset.mjs';
import { fonts } from './font-list.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const defaultRoot = path.resolve(__dirname, '..');

/**
 * 生成子集。
 *
 * **顺序执行，不并行**：每个字体要占约 26 MB 的 TTF 缓冲加 harfbuzz 的 wasm 堆，
 * 顺序跑让容器里的峰值内存可预测（容器通常没设内存上限，并行三个就是三倍峰值）。
 *
 * @param {object} o
 * @param {string} o.root      仓库根（解析 fonts-src/ 与 .env）
 * @param {'dev'|'build'} o.mode
 * @param {string} [o.distDir] build 模式下要扫的构建产物目录
 * @param {string} o.fontsDir  字体输出目录（会被**整个清空重建**）
 */
export async function subsetFonts({ root = defaultRoot, mode = 'dev', distDir = null, fontsDir, log = console.log }) {
  // 惰性 import：subset-font 会初始化 harfbuzz 的 wasm 模块，
  // 让 astro check / astro sync 这类不生成字体的路径不必付这个成本
  const { default: subsetFont } = await import('subset-font');

  const missingSources = fonts.filter((f) => !existsSync(path.join(root, f.src)));
  if (missingSources.length) {
    throw new Error(
      '源字体缺失：' + missingSources.map((f) => f.src).join('、') + '\n' +
      '这些文件在 fonts-src/（已 gitignore，约 74 MB）。跑 npm run fonts:fetch 自动下载。'
    );
  }

  // —— 准备两套字符集 ——
  const textCharset = buildTextCharset({ root, mode, distDir });
  const monoCharset = buildMonoCharset();
  const charsets = { text: toCharsetString(textCharset), mono: toCharsetString(monoCharset) };
  log(`[fonts] 字符集：正文 ${textCharset.size} 字 / 等宽 ${monoCharset.size} 字（${mode} 模式）`);

  // 漂移告警线：build 模式顺带算一遍 src 扫描，把两者差值报出来。
  // 差值**不可能为零**（注释、被 EXCLUDE_EXAMPLES 排掉的示例、本轮没渲染的分支都在里面），
  // 所以判据不是「差值为空」，而是**别突然变大** ——
  // 某次构建差值暴涨，说明 dist 扫描漏了一整类东西
  if (mode === 'build' && distDir) {
    const srcChars = findSiteChars({ root, mode: 'dev' });
    const onlySrc = [...srcChars].filter((c) => !textCharset.has(c));
    log(`[fonts] 对照：src 扫描 ${srcChars.size} 字，build 字符集之外还有 ${onlySrc.length} 个` +
        `（来自代码注释 / 已排除的示例 / 本轮未渲染的分支，属预期）`);
  }

  // —— 清空输出目录 ——
  // 必须先清：构建时 copyPublicDir 已经把可能过期的 public/fonts 复制进 dist 了，
  // 不清就会留下一份「dev 那份 + 新写的这份」的混合体
  rmSync(fontsDir, { recursive: true, force: true });
  mkdirSync(fontsDir, { recursive: true });

  // —— 逐个字体子集化 ——
  let total = 0;
  for (const f of fonts) {
    const src = path.join(root, f.src);
    const out = path.join(fontsDir, f.out);
    mkdirSync(path.dirname(out), { recursive: true });

    const buf = readFileSync(src);
    const subset = await subsetFont(buf, charsets[f.charset], { targetFormat: 'woff2' });
    writeFileSync(out, subset);

    const kb = subset.length / 1024;
    total += kb;
    log(`[fonts] ${path.basename(f.src)} → ${f.out}  ${kb.toFixed(1)} KB`);
  }

  // —— 生成 @font-face CSS ——
  // **必须最后写**：这份 css 引用上面那些 woff2，先写它就有个窗口期能引用到半份产物
  const css = fonts.map((f) =>
    `@font-face{font-family:"${f.family}";src:url("./${path.posix.dirname(f.out)}/${path.basename(f.out)}") format("woff2");font-style:normal;font-weight:${f.weight};font-display:swap;}`
  ).join('\n') + '\n';
  const cssPath = path.join(fontsDir, 'fonts.css');
  writeFileSync(cssPath, css);

  // 每条 src 都要真的指到文件
  const unresolved = fonts.filter((f) => !existsSync(path.join(fontsDir, f.out)));
  if (unresolved.length) throw new Error('fonts.css 引用了不存在的文件：' + unresolved.map((f) => f.out).join('、'));

  // —— 切完自检 ——
  const { verifySubsets } = await import('./check-fonts.mjs');
  const { textFonts } = await import('./font-list.mjs');
  const r = verifySubsets({ distDir, fontsDir, fonts: textFonts });
  if (r.problems.length) throw new Error('字体结构自检失败：\n' + r.problems.join('\n'));
  if (r.skipped.length) throw new Error('有字体没生成出来：' + r.skipped.join('、'));
  if (r.missing.size) {
    const list = [...r.missing].slice(0, 30).map(([ch, w]) => `${ch}(缺 ${w.join('/')})`).join(' ');
    throw new Error(`子集化弄丢了源字体里有的字形，共 ${r.missing.size} 个：${list}`);
  }
  if (r.sourceMissing.size) {
    log(`[fonts] ⚠ ${r.sourceMissing.size} 个字符源字体本身就没有字形，会回落到系统字体：` +
        [...r.sourceMissing.keys()].join(''));
  }
  // dev 模式没有 dist 可比对，覆盖率**根本没验过**。这里必须说清楚，
  // 不能沿用「覆盖 N 个用字」的说法 —— 那句在 dev 下会打印成「覆盖 0 个用字」，
  // 看着像漏字漏光了，实际是「没验」。含混的 ✓ 正是假通过能活下来的土壤
  const coverage = r.coverageChecked
    ? `覆盖 ${r.required} 个用字`
    : '覆盖率未校验（dev 模式无构建产物可比对，npm run build 时才验）';
  log(`[fonts] ✓ 合计 ${(total / 1024).toFixed(2)} MB，${coverage}`);

  return { bytes: total, chars: textCharset.size, verified: r.checked.length };
}

// —— CLI ——
// 用 pathToFileURL 而不是手拼 file:// —— Windows 的盘符与反斜杠拼不出合法 URL
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const argOf = (name, dflt) => {
    const i = process.argv.indexOf(name);
    return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
  };
  const root = defaultRoot;
  const mode = argOf('--mode', existsSync(path.join(root, 'dist')) ? 'build' : 'dev');
  const distDir = path.resolve(root, argOf('--dist', 'dist'));
  const fontsDir = path.resolve(root, argOf('--out', mode === 'build' ? 'dist/fonts' : 'public/fonts'));

  await subsetFonts({ root, mode, distDir: mode === 'build' ? distDir : null, fontsDir });
}
