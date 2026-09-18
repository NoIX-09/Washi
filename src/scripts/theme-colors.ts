/**
 * 给 Canvas 粒子读主题色的小工具。
 *
 * 粒子颜色是逐帧拼进 `rgba(...)` 字符串的，读不到 CSS 变量，只能在这里用
 * getComputedStyle 把 `<token>-rgb` 取出来。三个 FX 组件各自在 start*() 里调一次，
 * 于是切昼夜时会自动重读 —— 因为监听 body class 的 MutationObserver 回调最终也走
 * 到 start*()，颜色立刻跟着变，不用另外挂监听。
 *
 * 从 document.body 读而不是 documentElement：`--c-*` 定义在 :root 上、由 body.dark
 * 覆盖，自定义属性只向下继承，读 <html> 拿到的永远是浅色那份。
 *
 * FALLBACK 是 src/ 里唯一允许留颜色字面量的地方 —— Canvas 没有别的办法，
 * 样式表还没解析完时 getPropertyValue 返回空串，此时必须有个能画出来的值。
 */

const TOKENS = {
  rain: '--c-fx-rain-rgb',
  fireflyGlow: '--c-fx-firefly-glow-rgb',
  fireflyCore: '--c-fx-firefly-core-rgb',
  fireflyDot: '--c-fx-firefly-dot-rgb',
  sakura: '--c-fx-sakura-rgb',
} as const;

export type ThemeColors = Record<keyof typeof TOKENS, string>;

const FALLBACK: ThemeColors = {
  rain: '190, 175, 155',
  fireflyGlow: '240, 200, 100',
  fireflyCore: '255, 220, 140',
  fireflyDot: '255, 240, 180',
  sakura: '245, 190, 190',
};

export function readThemeColors(): ThemeColors {
  const cs = getComputedStyle(document.body);
  const out = {} as ThemeColors;
  for (const [key, token] of Object.entries(TOKENS) as [keyof ThemeColors, string][]) {
    out[key] = cs.getPropertyValue(token).trim() || FALLBACK[key];
  }
  return out;
}
