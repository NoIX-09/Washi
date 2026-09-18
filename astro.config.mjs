// @ts-check
import { defineConfig } from 'astro/config';
import icon from 'astro-icon';
import { fontsIntegration } from './scripts/fonts-integration.mjs';

// 加载项目根目录的 .env（若存在），使 SITE_URL 可用
try {
  process.loadEnvFile('.env');
} catch {}

// 站点完整网址，从 .env 的 SITE_URL 读取（用于生成规范的绝对链接）。
// 默认值与 .env.example、src/site.config.ts 三处对齐 —— 同一个值不该有三套兜底。
//
// 校验放在这里是因为它**最早执行**：漏了协议（写成 example.org）时 Astro 自己只会
// 报一句 "Invalid URL"，不说是哪个变量，而 src/site.config.ts 还没轮到运行就挂了
const siteUrl = process.env.SITE_URL || 'https://example.com';
try {
  new URL(siteUrl);
} catch {
  throw new Error(`[config] SITE_URL "${siteUrl}" 不是完整的网址（要带协议，例如 https://example.com）`);
}

// https://astro.build/config
export default defineConfig({
  site: siteUrl,
  // dev 与 preview 都得显式指定端口：Astro 默认的 4321 落在 Windows 给
  // Hyper-V/WSL 预留的排除段里（本机是 4246–4345，`netsh interface ipv4 show
  // excludedportrange protocol=tcp` 可查），绑定时直接 EACCES —— 端口没人占，
  // 但系统不让绑。4400 离预留段有五十来个端口的余量，预留段是每次开机重新划的，
  // 贴着 4345 取（比如 4346）下次开机可能就被卷进去
  server: { port: 4400 },
  preview: { port: 4400 },
  integrations: [
    icon({
      include: { ph: ['*'] },
    }),
    // 字体子集不在仓库里，由这个 integration 在 dev 启动 / build 结束时现算：
    // 字符集扫的是**构建产物**，所以「渲染出来的字」与「字体里有的字」出自同一次构建，
    // 不存在内容更新了字体没跟上的时间窗。详见 scripts/fonts-integration.mjs
    fontsIntegration(),
  ],
  // 让 <Image> 与 markdown 正文里的图片按显示宽度生成 srcset。
  // 注意 sizes 由 Astro 按「图片固有宽度 vs 视口」推出（getSizesAttribute），没有配置项
  // 能覆盖：constrained 会编成 `(min-width: <固有宽>px) <固有宽>px, 100vw`。固有宽度比
  // 真实展示宽度大多少，浏览器就可能多拉多少倍的图 —— 所以素材按展示宽度存放、母版另放
  // assets-src/（gitignore），正文大图就是这么从 2480px 降到 880px 的。
  image: {
    layout: 'constrained',
    responsiveStyles: true,
  },
  i18n: {
    defaultLocale: 'zh-CN',
    locales: ['zh-CN', 'zh-TW', 'en', 'ja'],
    routing: { prefixDefaultLocale: true },
  },
  markdown: {
    shikiConfig: {
      theme: 'css-variables',
    },
  },
});
