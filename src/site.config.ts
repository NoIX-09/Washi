/**
 * 站点配置：**每个字段都有默认值，不建 .env 也能正常构建**。
 *
 * 默认值对齐 .env.example —— 所以「裸 clone 直接 build」与「cp .env.example .env」
 * 看到的是同一套占位内容，改 .env.example 时记得回来同步这里。
 * 唯一的例外是 MY_FRIEND_AVATAR（见下）。
 *
 * 读法统一写成静态的 `import.meta.env.XXX`：Vite 只对静态成员访问做构建期替换，
 * 写成 `import.meta.env['XXX']` 或整个对象的解构在生产构建里会拿不到值。
 */

/**
 * 拼绝对地址的基：去掉结尾的 `/`，下面拼路径时不必再判断有没有它。
 *
 * SITE_URL **本身是否合法由 astro.config.mjs 把守**，那份报错更早也更明确
 * （这里是 `new URL` 抛的原生 TypeError，看不出是哪个变量）。这里只管规范化，
 * 默认值与 astro.config.mjs / .env.example 对齐。
 */
const siteUrl = (() => {
  const url = new URL(import.meta.env.SITE_URL ?? 'https://example.com');
  return (url.origin + url.pathname).replace(/\/+$/, '');
})();

/**
 * 站内路径 → 绝对地址。已经带协议的原样返回（`MY_FRIEND_AVATAR` 允许直接指向图床）。
 *
 * 需要它的原因在 friends.astro：交换友链那张卡片会把头像地址**当文本印出来**给人抄
 * （那是那张卡片存在的意义），印一个 `/head.svg` 对方拿去没法用。
 */
const absolute = (path: string) =>
  /^[a-z][a-z0-9+.-]*:/i.test(path) ? path : `${siteUrl}/${path.replace(/^\/+/, '')}`;

export const site = {
  // 兜底：没建 .env 就 build 时，标题会渲染成「Blog · undefined」、首页标题干脆是空的。
  // 给个一眼看得出是占位的名字，比 undefined 体面，也比空字符串好排查
  name: import.meta.env.SITE_NAME ?? 'Washi',
  /** 拼绝对地址用的基（见上面的 siteUrl）。域名要从它取就 new URL(site.url) */
  url: siteUrl,
  email: import.meta.env.SITE_EMAIL ?? 'hi@example.com',
  copyright: import.meta.env.SITE_COPYRIGHT ?? '© 2026 NoIX · Powered by Astro',
};

export const hero = {
  name: import.meta.env.HERO_NAME ?? '和紙',
  subtitle: import.meta.env.HERO_SUBTITLE ?? 'Washi',
  quote: import.meta.env.HERO_QUOTE ?? '展卷生温，落笔成章',
};

export const profile = {
  name: import.meta.env.PROFILE_NAME ?? 'Washi',
  bio: import.meta.env.PROFILE_BIO ?? '展卷生温，落笔成章',
  social: {
    bilibili: import.meta.env.PROFILE_BILIBILI ?? 'https://space.bilibili.com/xxxxx',
    github: import.meta.env.PROFILE_GITHUB ?? 'https://github.com/xxxxx',
    email: import.meta.env.SITE_EMAIL ?? 'hi@example.com',
  },
};

/**
 * STATUS_ALMANAC 宜忌卡池：宜忌共用一个池子，逗号分隔（中英文逗号都认）。
 * 默认空 —— 不配置就整块不显示。想要「今日宜忌」就在这里填自己的池子，
 * 或者不动机器、改在 .env 里设 STATUS_ALMANAC。
 */
const ALMANAC_DEFAULT: string[] = [];

const words = (raw: string | undefined, fallback: string[]) =>
  (raw === undefined ? fallback : raw.split(/[,，]/)).map((s) => s.trim()).filter(Boolean);

export const status = {
  playing: import.meta.env.STATUS_PLAYING ?? '玩游戏...',
  music: {
    title: import.meta.env.STATUS_MUSIC_TITLE ?? '歌曲名 — 歌手',
    url: import.meta.env.STATUS_MUSIC_URL ?? 'https://music.163.com/song?id=xxxxx',
  },
  /** 今日宜忌卡池：按日期做种子，每天从池里抽两个不重复的，先抽到的算宜、后抽到的算忌 */
  almanac: words(import.meta.env.STATUS_ALMANAC, ALMANAC_DEFAULT),
};

export const bot = {
  name: import.meta.env.BOT_NAME ?? 'BotName',
  desc: import.meta.env.BOT_DESC ?? '低性能Bot，调试中...',
};

export const myFriendInfo = {
  name: import.meta.env.MY_FRIEND_NAME ?? '昵称',
  desc: import.meta.env.MY_FRIEND_DESC ?? '站点描述',
  url: import.meta.env.MY_FRIEND_URL ?? 'https://example.com',
  // 默认指向 src/pages/head.svg.ts 生成的占位图 —— 它一定存在，所以裸 clone 也能
  // 正常渲染、卡片上印出来的地址也是活的。自己的头像在 .env 里覆盖（填绝对地址，
  // 不能是站内 astro:assets 的哈希路径，那个每次构建都变）。
  // 站内路径会被拼成绝对地址，见上面的 absolute()
  avatar: absolute(import.meta.env.MY_FRIEND_AVATAR ?? '/head.svg'),
};

/**
 * env 里取数字的统一写法：非整数 / 负数 / 空串一律当作「没设」，回落默认值。
 * 别写成 `Number(x) || dflt` —— 那样 0 会被当成假值吞掉，而 0 在这里是有意义的取值。
 */
const int = (raw: string | undefined, dflt: number) => {
  const n = Number(raw);
  return raw !== undefined && raw.trim() !== '' && Number.isInteger(n) && n >= 0 ? n : dflt;
};

/** 首页各卡片的可调项 —— 都是给 fork 的人按自己内容量调的，不影响功能正确性 */
export const home = {
  /** 「最近动态」默认只显示最新的 N 条，其余折成「展开更多」。0 = 不折叠，全部显示 */
  activityLimit: int(import.meta.env.ACTIVITY_LIMIT, 3),
};
