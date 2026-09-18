/**
 * /favicon.svg —— 按 theme.json 里的 `favicon` token 渲染站点图标。
 *
 * 图标是静态资源、不走 Astro 的渲染管线，所以用 `?raw` 把 SVG 当字符串读进来，
 * 再把 `__THEME_FAVICON__` 占位符换成 token 值。想换图标形状改
 * src/assets/favicon.svg，想换颜色改 theme.json 的 favicon。
 *
 * 图标不随昼夜切换（浏览器只在特定时机取一次），所以固定取浅色那份。
 * public/favicon.ico 是给老浏览器的兜底，不跟着主题化，见 README。
 */
import favicon from '../assets/favicon.svg?raw';
import { color } from '../theme';

export function GET() {
  return new Response(favicon.replace('__THEME_FAVICON__', color('favicon')), {
    headers: { 'Content-Type': 'image/svg+xml' },
  });
}
