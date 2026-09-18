import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

// 示例条目（_example.*）默认随仓库分发，别人 clone 下来直接就是一个能跑的演示站；
// 本站自己在 .env 里设 EXCLUDE_EXAMPLES=1，构建期就不把示例编进去。
//
// 优先读 import.meta.env：content.config.ts 由 Vite 的 runner 加载，非 PUBLIC_ 前缀的私密变量
// 一样能拿到（实测 import.meta.env.SITE_NAME 可读），而且认 Vite 的整套 env 文件命名
// （.env.local / .env.[mode] 等）；astro.config.mjs 顶层的 process.loadEnvFile 只读 .env。
// 兜底那份是给非 Vite 场合（astro sync、编辑器里的类型检查）留一条路。
//
// **改开关之后必须整体重启 dev server**：实测把开关从 .env 里删掉后等 20 秒，dev 仍在 404 ——
// Vite 不会因为 .env 变动重启，content.config.ts 只在启动时求值一次。别指望热更新。
const rawFlag = import.meta.env?.EXCLUDE_EXAMPLES ?? process.env.EXCLUDE_EXAMPLES;

// 认 1/true/yes/on 四种写法：写成 true 却静默当成假是最难查的一类配置事故
const excludeExamples = /^(1|true|yes|on)$/i.test(String(rawFlag ?? '').trim());

// 构建日志里报一次当前模式 —— 不给开关加断言（默认含示例本就是正确行为），但「静默」不行
if (import.meta.env?.PROD) {
  console.log(`[content] 示例条目：${excludeExamples ? '已排除（EXCLUDE_EXAMPLES 已开启）' : '已包含'}`);
}

// 注意：Astro 的「下划线开头的文件忽略」只对 legacy 内容集合层生效，对 glob() 无效
// —— 实测 _example.md 会正常生成页面，所以排除必须显式写成负向模式
const contentPattern = (ext: string) =>
  excludeExamples ? [`**/*.${ext}`, `!**/_example.${ext}`] : `**/*.${ext}`;

// 相关链接的地址：常常链回站内文章，所以站内路径（以 / 开头）也要放行，
// 不能一律用 z.string().url() —— 那样 `/zh-CN/blog/xxx` 会直接校验不通过
const linkUrl = z
  .string()
  .refine(
    (v) => /^https?:\/\//i.test(v) || v.startsWith('/'),
    '需要是 http(s) 绝对地址，或以 / 开头的站内路径'
  );

// 相关链接条目：作品详情页与文章详情页共用同一套（渲染见 components/PageLinks.astro）。
// icon 是 ph 图标名，astro.config 里 include 了整套 ph，写哪个都能用
const linkItem = z.object({
  label: z.string(),
  url: linkUrl,
  icon: z.string().default('ph:link-duotone'),
});

// 作品集合：src/content/works/*.md（frontmatter + 项目自述正文）
const works = defineCollection({
  loader: glob({ pattern: contentPattern('md'), base: './src/content/works' }),
  schema: z.object({
    name: z.string(),
    desc: z.string().default(''),
    // 作品列表卡片上的图标（ph 图标名），每件作品挑一个贴题的
    icon: z.string().default('ph:palette-duotone'),
    // 列表排序，小的在前；不写则排在最后
    order: z.number().default(Number.MAX_SAFE_INTEGER),
    github: z.string().url().optional(),
    release: z.string().url().optional(),
    // 自定义相关链接，与 github / release 渲染在同一排按钮里
    links: z.array(linkItem).default([]),
    // 详情页顶部是否摆一座 Live2D 展示台（模型文件固定在 public/live2d 那套）
    live2d: z.boolean().default(false),
  }),
});

// 友链集合：src/content/friends/*.json
const friends = defineCollection({
  loader: glob({ pattern: contentPattern('json'), base: './src/content/friends' }),
  schema: z.object({
    name: z.string(),
    desc: z.string().default(''),
    url: z.string().url(),
    avatar: z.string().default(''),
  }),
});

// 文章集合：src/content/blog/*.md
const blog = defineCollection({
  loader: glob({ pattern: contentPattern('{md,mdx}'), base: './src/content/blog' }),
  schema: z.object({
    title: z.string(),
    desc: z.string().default(''),
    date: z.string(),
    // 可选：本篇文章的自定义 CSS（注入为全局样式，作用于 .post-body）。留空则用默认样式。
    style: z.string().default(''),
    // 相关链接，与作品详情页同一套
    links: z.array(linkItem).default([]),
  }),
});

// 技术栈集合：src/content/skills/*.json
const skills = defineCollection({
  loader: glob({ pattern: contentPattern('json'), base: './src/content/skills' }),
  schema: z.object({
    name: z.string(),
    icon: z.string().default(''),
  }),
});

// 最近动态集合：src/content/activity/*.json
const activity = defineCollection({
  loader: glob({ pattern: contentPattern('json'), base: './src/content/activity' }),
  schema: z.object({
    date: z.string(),
    text: z.string(),
  }),
});

export const collections = { works, friends, blog, skills, activity };
