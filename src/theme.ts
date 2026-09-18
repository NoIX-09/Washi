/**
 * 配色管线：读 theme.json → 校验 → 生成 CSS 变量。
 *
 * 每个 token 生成两个变量：
 *   --c-<名>       完整颜色，直接给 color / background / border 用
 *   --c-<名>-rgb   "139, 94, 60" 形式的三元组，用来在样式里拼任意透明度
 *
 * 三元组是这套东西的支点。原来同一个强调色散成十几种透明度手写死
 * （rgba(139,94,60,.08) / .15 / .25 / .42 …），改基色得把它们全找出来改一遍；
 * 现在只写 rgba(var(--c-accent-rgb), .25)，改 theme.json 的 accent 一处，
 * 全站的描边、悬停、圆点会一起跟着走。
 *
 * 暗色不另起一套名字：body.dark 用**同名**重定义一遍，自定义属性会继承，
 * 所以组件里只管写 var(--c-text)，自动跟着 body 的 class 走 —— 顺带绕开了
 * Astro 的样式作用域问题（自定义属性靠继承传递，不参与选择器匹配）。
 */
import raw from './theme.json';

export type Mode = 'light' | 'dark';

/** 解析后的 token：每个模式各一份完整值 */
type Resolved = Record<string, Record<Mode, string>>;

/** 允许出现在 token 对象里的键，其余一律当拼写错误报出来 */
const ALLOWED_KEYS = new Set(['light', 'dark', 'note']);

const HEX = /^#([0-9a-f]{3,8})$/i;
const FUNC = /^rgba?\(([^)]+)\)$/i;
/** 渐变这类完整 CSS 值原样放行，见 validate() */
const GRADIENT = /^(repeating-)?(linear|radial|conic)-gradient\(/i;

/**
 * 颜色 → "r, g, b"。
 *
 * 解析不出（transparent、渐变、拼错的色值）返回 null —— 调用方据此决定
 * 是「不吐 -rgb」还是「直接报错」。**不能吐半个坏值**：`rgba(var(--c-x-rgb), .2)`
 * 里三元组一旦是空的，整条声明会静默失效，比报错难查得多。
 */
export function toRgbTriplet(value: string): string | null {
  const v = value.trim();

  const hex = HEX.exec(v);
  if (hex) {
    const h = hex[1];
    // #rgb / #rgba 是每位重复一次；8 位 hex 的后两位是 alpha，取前 6 位即可
    const full = h.length <= 4 ? h.slice(0, 3).replace(/./g, (c) => c + c) : h.slice(0, 6);
    if (full.length !== 6) return null;
    const n = Number.parseInt(full, 16);
    return `${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}`;
  }

  const fn = FUNC.exec(v);
  if (fn) {
    // 同时认逗号写法 rgba(a,b,c,d) 和空格写法 rgb(a b c / d)
    const parts = fn[1].split(/[,\s/]+/).filter(Boolean);
    if (parts.length < 3) return null;
    const chans = parts.slice(0, 3).map((p) => (p.endsWith('%') ? Math.round((Number.parseFloat(p) / 100) * 255) : Number.parseFloat(p)));
    if (chans.some((c) => !Number.isFinite(c))) return null;
    return chans.map((c) => Math.max(0, Math.min(255, Math.round(c)))).join(', ');
  }

  return null;
}

const isObj = (v: unknown): v is Record<string, unknown> =>
  typeof v === 'object' && v !== null && !Array.isArray(v);

const fail = (msg: string): never => {
  throw new Error(`[theme] src/theme.json 有问题：${msg}`);
};

/** "@accent" → "accent"；不是引用则返回 null */
const refName = (value: string) => (value.startsWith('@') ? value.slice(1).trim() : null);

/** 把原始 JSON 摊平成 token → { light, dark } 的字面值表（引用还没解） */
function readRaw(): Record<string, Record<Mode, string>> {
  const out: Record<string, Record<Mode, string>> = {};

  for (const [name, value] of Object.entries(raw as Record<string, unknown>)) {
    // 下划线开头的是给人看的说明，不生成变量
    if (name.startsWith('_')) continue;

    if (typeof value === 'string') {
      if (!value.trim()) fail(`"${name}" 的值是空的`);
      out[name] = { light: value.trim(), dark: value.trim() };
      continue;
    }

    if (!isObj(value)) fail(`"${name}" 只能是字符串或 { light, dark } 对象`);

    for (const key of Object.keys(value)) {
      if (!ALLOWED_KEYS.has(key)) {
        fail(`"${name}" 里有未知的键 "${key}"（只允许 light / dark / note，是不是拼错了？）`);
      }
    }

    const light = value.light;
    if (typeof light !== 'string' || !light.trim()) {
      fail(`"${name}" 缺少 light 值`);
    }
    // dark 不给就沿用 light —— 只有一个值的 token（粒子色、favicon）不必写两遍
    const dark = typeof value.dark === 'string' && value.dark.trim() ? value.dark.trim() : light.trim();

    out[name] = { light: light.trim(), dark };
  }

  if (Object.keys(out).length === 0) fail('一个 token 都没有');
  return out;
}

/**
 * 解引用：把 "@accent" 换成 accent 的字面值。
 * 带环检测 —— a 跟 b、b 跟 a 会转不出来，得报错而不是栈溢出。
 */
function resolveRaw(rawMap: Record<string, Record<Mode, string>>): Resolved {
  const out: Resolved = {};

  for (const [name, modes] of Object.entries(rawMap)) {
    out[name] = {} as Record<Mode, string>;

    for (const mode of ['light', 'dark'] as const) {
      let value = modes[mode];
      const seen = new Set<string>([name]);

      for (let hop = 0; hop < 8; hop++) {
        const target = refName(value);
        if (target === null) break;
        if (seen.has(target)) fail(`"${name}" 的引用绕成了环：${[...seen, target].join(' → ')}`);
        if (!(target in rawMap)) fail(`"${name}" 引用了不存在的 token "@${target}"`);
        seen.add(target);
        value = rawMap[target][mode];
      }

      out[name][mode] = value;
    }
  }

  return out;
}

/**
 * 校验每个值是不是能当颜色用。
 *
 * 只放行「三元组解析得出来」和 transparent —— 拼错的色值（少个 #、写成 "red"、
 * 多打个空格）不会报警只会静默失效，页面上一块颜色没了却毫无线索。宁可构建期直接失败。
 */
function validate(resolved: Resolved): void {
  for (const [name, modes] of Object.entries(resolved)) {
    for (const [mode, value] of Object.entries(modes)) {
      // favicon 的值会写进 SVG 属性而不是 CSS，透明对图标没意义但也不该拦
      if (value === 'transparent') continue;
      // 渐变不是颜色，派生不出三元组，原样透传即可（它在 CSS 里本来就是一个完整值）
      if (GRADIENT.test(value)) continue;
      if (toRgbTriplet(value) === null) {
        fail(`"${name}" 的 ${mode} 值 "${value}" 不是一个能识别的颜色（支持 #rgb / #rrggbb / rgb() / rgba() / transparent / 渐变）`);
      }
    }
  }
}

function emit(resolved: Resolved): string {
  const root: string[] = [];
  const dark: string[] = [];

  for (const [name, modes] of Object.entries(resolved)) {
    const triplet = toRgbTriplet(modes.light);
    root.push(`  --c-${name}: ${modes.light};`);
    // transparent 没有三元组可派生，硬吐会写出一个坏变量，不如不吐
    if (triplet) root.push(`  --c-${name}-rgb: ${triplet};`);

    // 两模式同值的 token 不必在 body.dark 里重复一遍，省一半体积
    if (modes.dark !== modes.light) {
      const darkTriplet = toRgbTriplet(modes.dark);
      dark.push(`  --c-${name}: ${modes.dark};`);
      if (darkTriplet) dark.push(`  --c-${name}-rgb: ${darkTriplet};`);
    }
  }

  return `:root {\n${root.join('\n')}\n}\nbody.dark {\n${dark.join('\n')}\n}\n`;
}

const rawMap = readRaw();
const tokens = resolveRaw(rawMap);
validate(tokens);

/** 解析并校验过的 token 表，按模式索引 —— 供 favicon 端点之类的地方直接读值 */
export const theme = tokens;

/** 全部 token 名，顺序与 theme.json 一致 */
export const tokenNames = Object.keys(tokens);

/** 注入到 <head> 的那段 CSS */
export const themeCss = emit(tokens);

/** 取某个 token 在指定模式下的值，取不到时回落浅色 */
export const color = (name: string, mode: Mode = 'light'): string =>
  tokens[name]?.[mode] ?? tokens[name]?.light ?? 'transparent';
