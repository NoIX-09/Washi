// scripts/fonts-integration.mjs
// 把字体管线挂进 Astro 的生命周期：dev 启动时切一份到 public/fonts，
// build 结束时按**构建产物**切一份到 dist/fonts。
//
// ---------------------------------------------------------------------------
// 为什么用 integration，而不是 predev / postbuild 这类 npm 生命周期钩子
//
// npm 钩子只在**经 `npm run` 调用**时触发。`npx astro build`、IDE 里点构建、
// 直接敲 `astro build` 都会绕过它们。一旦绕过，后果不是「报错」而是更糟的两种：
//   - build：构建成功，但没有任何字体产出，全站静默回落到系统字体
//   - 更坏的一种：`copyPublicDir` 把 public/fonts 里**上一次 dev 留下的旧子集**
//     复制进 dist，页面引用的是一份与本次内容不匹配的字体，而且看起来一切正常
// integration 挂在 Astro 自己的链路上，绕不过去。
//
// 另外 `astro:build:done` 直接把产物目录 `dir` 递过来，不用去猜 dist/ 在哪 ——
// 猜错了就会把字体写到 dist 外面，然后同样是「构建成功但没有字体」。
// ---------------------------------------------------------------------------
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function fontsIntegration() {
  /** config:setup 时记下来，build:done 里还要用（那个钩子不给 root） */
  let root = process.cwd();

  return {
    name: 'washi-fonts',
    hooks: {
      // dev | build | sync | check —— 只有前两个该动字体。
      // sync/check 拉 74 MB 源字体纯属意外（`astro check` 只是想做个类型检查）
      'astro:config:setup': async ({ command, config }) => {
        if (command !== 'dev' && command !== 'build') return;
        root = fileURLToPath(config.root);

        const { fetchFonts } = await import('./fetch-fonts.mjs');
        await fetchFonts({ outDir: path.join(root, 'fonts-src') });

        if (command === 'dev') {
          // dev 没有 dist 可扫，退回扫 src/（是个超集）。每次启动都重算，不做缓存 ——
          // 整条流水线约 2 秒，省这 2 秒换来一类「dev 里字形为什么不对」的困惑不值。
          //
          // 已知边界：dev 启动**之后**新写的内容不会反映到字体里（Vite 不会重跑
          // config:setup）。要立刻生效就跑 `npm run fonts`。
          const { subsetFonts } = await import('./subset-fonts.mjs');
          await subsetFonts({ root, mode: 'dev', fontsDir: path.join(root, 'public', 'fonts') });
        }
      },

      // 跑在 copyPublicDir **之后**，所以往 dist/fonts 写不会被覆盖；
      // 而且这时 dist 已经完整，扫出来的才是这次构建真正渲染的字
      'astro:build:done': async ({ dir }) => {
        const distDir = fileURLToPath(dir);
        const { subsetFonts } = await import('./subset-fonts.mjs');
        await subsetFonts({
          root,
          mode: 'build',
          distDir,
          fontsDir: path.join(distDir, 'fonts'),
        });
      },
    },
  };
}
