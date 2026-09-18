// scripts/fetch-fonts.mjs
// 下载源字体（3 个 TTF，共约 74 MB）到 fonts-src/。
//
// 用法：
//   node scripts/fetch-fonts.mjs                # 缺什么下什么，已就位且校验通过就跳过
//   node scripts/fetch-fonts.mjs --force        # 全部重下
//   node scripts/fetch-fonts.mjs --out <目录>   # 换落地目录（Docker 的 fonts stage 用）
//
// 平时**不需要手动跑**：astro.config.mjs 挂的 integration 会在 dev 启动与 build
// 开始时自动调用（见 fonts-integration.mjs）。手动跑的场合是下载失败后想单独重试。
//
// **没有 postinstall。** npm install 时静默拉 74 MB 是敌意行为，会搞坏离线安装，
// 而且会被算在 npm 头上。自动下载发生在 astro 的 integration 里。
import { createHash } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync, renameSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { release, assetUrl } from './font-pins.mjs';
import { fonts } from './font-list.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const sha256 = (buf) => createHash('sha256').update(buf).digest('hex');

const mb = (n) => (n / 1048576).toFixed(1) + ' MB';

/** 睡眠，用于退避重试 */
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/**
 * 下载单个资产，返回 Buffer。
 *
 * 三段校验缺一不可：
 *   1. HTTP 状态 —— 403/429（限流）与 404（版本/文件名写错）必须和「网络抖动」分开报
 *   2. **字节数** —— 实测过「HTTP 200 但只落了 3.4 MB」的截断，状态码看不出来
 *   3. sha256 —— 这是「GitHub 返回 200 但内容其实是 HTML 错误页」的唯一防线
 */
async function download(name, asset, { log, retries = 3 }) {
  const url = assetUrl(name);

  // **必须显式设超时**：Node 的 fetch 没有默认超时。连接被黑洞（企业代理、
  // 防火墙丢包）时它不报错，而是永远挂着 —— 容器里就是 `astro build` 无限期卡住、
  // 日志停在「↓ 下载中」。
  //
  // 用的是**空闲**超时而不是总时长超时：每收到一块数据就重置。总时长超时（如
  // AbortSignal.timeout）会连 **response body 一起中止**，25 MB 在慢网上传够 30s
  // 就被拦腰砍断 —— 那会把「网慢」误报成「网络故障」。空闲超时则两种情形都对：
  // 真的没数据了才放弃，一直有数据就一直等。
  const idleMs = Number(process.env.FONT_TIMEOUT_MS) || 30_000;

  for (let attempt = 1; attempt <= retries; attempt++) {
    // controller 必须**每次尝试各建一个**：abort 之后 signal 永久处于 aborted，
    // 复用同一个的话第 2 次尝试会立刻以同一个原因失败，重试等于没做
    const controller = new AbortController();
    let idleTimer = null;
    // 每块数据到达时重置；abort 的 reason 会作为 fetch 抛出的错误冒出来
    const bumpIdle = () => {
      clearTimeout(idleTimer);
      idleTimer = setTimeout(
        () => controller.abort(new Error(`连接空闲超过 ${idleMs / 1000}s（网络被阻断或代理未放行？）`)),
        idleMs
      );
    };

    try {
      bumpIdle();
      const res = await fetch(url, { signal: controller.signal });

      // 限流与「文件不存在」要分开说，否则用户会去重试一个根本不会成功的请求
      if (res.status === 403 || res.status === 429) {
        throw Object.assign(new Error(`被限流（HTTP ${res.status}）`), { retryable: true });
      }
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText} —— 检查 font-pins.mjs 里的版本号与文件名`);
      }

      const total = Number(res.headers.get('content-length')) || asset.size;
      const chunks = [];
      let got = 0;
      let nextMark = 0.25;

      for await (const chunk of res.body) {
        bumpIdle();
        chunks.push(chunk);
        got += chunk.length;
        // 进度按 25% 一档打，避免容器日志被刷屏
        if (total > 0 && got / total >= nextMark) {
          log(`[fonts]   ${Math.round((got / total) * 100)}%`);
          nextMark += 0.25;
        }
      }

      const buf = Buffer.concat(chunks);

      if (buf.length !== asset.size) {
        throw Object.assign(
          new Error(`字节数不对：下到 ${buf.length}，应为 ${asset.size}（传输被截断）`),
          { retryable: true }
        );
      }
      const gotHash = sha256(buf);
      if (gotHash !== asset.sha256) {
        throw new Error(`sha256 不匹配：\n      下到 ${gotHash}\n      应为 ${asset.sha256}`);
      }

      return buf;
    } catch (err) {
      const last = attempt === retries;
      if (last || err.retryable === false) throw err;
      const wait = attempt * 3000;
      log(`[fonts]   ⚠ ${err.message}，${wait / 1000}s 后重试（${attempt}/${retries}）`);
      await sleep(wait);
    } finally {
      // 不清的话，成功路径上也会留一个 30s 后触发的定时器，把进程多吊住半分钟
      clearTimeout(idleTimer);
    }
  }
}

/**
 * 确保三个源字体就位。
 *
 * 已存在且**校验通过**就跳过 —— 注意不是「存在就跳过」：一个被截断的旧下载同样是
 * 「存在」，而它的后果是子集化阶段才炸、看起来像代码 bug。反正只有 3 个 25 MB 的文件，
 * 算一遍 sha256 约 0.3s，比省这点时间值。
 *
 * @returns {{ downloaded: string[], present: string[], bytes: number }}
 */
export async function fetchFonts({ outDir, force = false, log = console.log, offline = null }) {
  const isOffline = offline ?? /^(1|true|yes|on)$/i.test(process.env.FONTS_OFFLINE || '');
  mkdirSync(outDir, { recursive: true });

  const downloaded = [];
  const present = [];
  let bytes = 0;

  // 要哪个文件**从 font-list.mjs 的 src 推导**，不在这里重写一遍文件名 ——
  // 两处各写一份必然漂移，而漂移的后果是「下到的文件名对不上、报缺失」
  for (const f of fonts) {
    const name = path.basename(f.src); // LXGWWenKaiGB-Regular.ttf …
    const dest = path.join(outDir, name);
    const asset = release.assets[name];

    if (!asset) {
      throw new Error(
        `font-pins.mjs 里没有 ${name} 的校验和。\n` +
        `  font-list.mjs 期望的源文件名：${fonts.map((x) => path.basename(x.src)).join('、')}\n` +
        `  font-pins.mjs 里登记的：${Object.keys(release.assets).join('、')}\n` +
        `  两者必须一致 —— 改版本时一并更新。`
      );
    }

    // 已就位且校验通过 → 跳过，绝不扰动本机已有的母版
    if (!force && existsSync(dest)) {
      const buf = readFileSync(dest);
      if (buf.length === asset.size && sha256(buf) === asset.sha256) {
        present.push(name);
        log(`[fonts] ✓ ${name} 已就位（${mb(asset.size)}）`);
        continue;
      }
      log(`[fonts] ⚠ ${name} 已存在但校验不通过，重新下载`);
    }

    if (isOffline) {
      throw new Error(
        `${name} 缺失或损坏，但 FONTS_OFFLINE 已开启，不会联网。\n` +
        `  请手动放到 ${path.relative(root, dest)}，或去掉 FONTS_OFFLINE 重试。`
      );
    }

    log(`[fonts] ↓ ${name}（${mb(asset.size)}）  ${release.repo}@${release.version}`);
    const buf = await download(name, asset, { log });

    // 先写临时文件再改名：中途失败不会留下一个「看起来存在」的半份文件
    const tmp = dest + '.part';
    writeFileSync(tmp, buf);
    renameSync(tmp, dest);

    downloaded.push(name);
    bytes += buf.length;
  }

  return { downloaded, present, bytes };
}

// —— CLI ——
const invokedDirectly = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (invokedDirectly) {
  const argOf = (name, dflt) => {
    const i = process.argv.indexOf(name);
    return i > -1 && process.argv[i + 1] ? process.argv[i + 1] : dflt;
  };
  const outDir = path.resolve(root, argOf('--out', 'fonts-src'));
  const force = process.argv.includes('--force');

  try {
    const r = await fetchFonts({ outDir, force });
    const parts = [];
    if (r.downloaded.length) parts.push(`新下载 ${r.downloaded.length} 个（${mb(r.bytes)}）`);
    if (r.present.length) parts.push(`${r.present.length} 个已就位`);
    console.log(`[fonts] 完成：${parts.join('，')} → ${path.relative(root, outDir)}/`);
  } catch (err) {
    console.error(`\n[fonts] ✗ 源字体获取失败：${err.message}`);
    console.error('\n  这三个文件在 fonts-src/（已 gitignore，共约 74 MB），首次构建必须联网获取一次。');
    console.error('  内网/离线环境：手动下载后放进 fonts-src/，或设 FONTS_OFFLINE=1 跳过联网检查。');
    process.exitCode = 1;
  }
}
