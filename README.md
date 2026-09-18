# Washi 和紙

> 展卷生温，落笔成章。

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Astro](https://img.shields.io/badge/Astro-v7-ff5d01.svg)](https://astro.build)
[![Node](https://img.shields.io/badge/node-%3E%3D22.12-339933.svg)](https://nodejs.org)

一个基于 [Astro 7](https://astro.build) 的纯静态个人站点框架：多语言、双主题、全站配色可配置，带看板娘、Live2D 展示台与 Canvas 粒子特效，Docker 一键部署。

仓库自带一组**示例内容**，clone 下来直接构建就是一个能跑的完整站点；把示例换成你自己的内容即可。**个人内容不入库** —— 详见[分发边界](#分发边界这个仓库提交什么不提交什么)。

---

## 目录

- [特性](#特性)
- [技术栈](#技术栈)
- [快速开始](#快速开始)
- [配置](#配置)
- [配色与主题](#配色与主题)
- [内容管理](#内容管理)
- [部署](#部署)
- [目录结构](#目录结构)
- [实现说明](#实现说明)
- [常见问题](#常见问题)
- [致谢](#致谢)
- [许可](#许可)

## 特性

| | |
|---|---|
| **国际化** | 简体中文 / 繁体中文 / English / 日本語，路由按 `[locale]` 分组 |
| **主题配色** | 全站颜色收在 `src/theme.json` 一个文件里，改它就能换掉整个站点 |
| **暗色模式** | 浅色 / 暗色切换，偏好持久化到 localStorage，首次进入跟随系统 |
| **全站搜索** | 覆盖页面、文章、作品、友链 |
| **粒子特效** | 雨滴 / 萤火虫 / 樱花，跟随主题取色，隐藏时零 GPU 占用 |
| **看板娘** | 首页 / 页脚插画、404、加载动画与机器人头像，可一键收起 |
| **Live2D 展示台** | 作品详情页可摆一座会跟随指针的模型 |
| **加载动画** | 每次跳转自动放映，覆盖浏览器抓取新页的空白期 |
| **字体子集** | 构建后按产物的**实际用字**子集化为 woff2，漏字会构建失败 |
| **响应式** | 桌面 / 平板 / 手机三端适配 |

## 技术栈

| 类别 | 技术 | 许可 |
|---|---|---|
| 框架 | [Astro](https://astro.build) v7（SSG，静态输出） | MIT |
| 语言 | TypeScript | Apache-2.0 |
| 字体 | [LXGW WenKai / WenKai Mono（霞鹜文楷 GB）](https://github.com/lxgw/LxgwWenkaiGB) | SIL OFL 1.1 |
| 图标 | [Phosphor Icons](https://phosphoricons.com)（经 `astro-icon`） | MIT |
| 粒子 / 交互 | 原生 Canvas 2D + TypeScript | — |
| Live2D | [pixi.js](https://pixijs.com) + pixi-live2d-display + Live2D Cubism Core | MIT / **Live2D 专有** |
| 部署 | Docker + Nginx | — |

## 快速开始

需要 **Node.js ≥ 22.12**。

```bash
npm install
npm run dev        # 开发服务器，端口 4400
npm run build      # 构建到 dist/
npm run preview    # 构建后本地预览
```

首次 `dev` / `build` 会自动下载约 74 MB 的源字体到 `fonts-src/`（已 gitignore），随后子集化 —— 只需要联网一次。

> **端口为什么是 4400**：Windows 会把一段端口预留给 Hyper-V / WSL，落在其中的端口绑定时直接 `EACCES`（端口没人占用，系统就是不让绑），而 Astro 默认的 4321 可能正好在预留段里。预留段每次开机重划，所以配置里写死一个不贴边界的端口。查当前预留段：
>
> ```bash
> netsh interface ipv4 show excludedportrange protocol=tcp
> ```

### npm scripts

| 命令 | 作用 |
|---|---|
| `npm run dev` | 开发服务器（4400）。字体走 `src/` 粗扫，是个超集 |
| `npm run build` | 构建到 `dist/`，结束时自动跑字体子集与漏字校验 |
| `npm run preview` | 先 build 再本地预览 `dist/` |
| `npm run fonts` | 单独重跑字体子集（改了内容想让 dev 立刻用上新字时用） |
| `npm run fonts:fetch` | 只下载源字体，不做子集化 |
| `npm run fonts:check` | 只做漏字校验（build 时已自动跑） |

## 配置

站点配置**每个字段都有默认值，不建 `.env` 也能正常构建**。要自定义就复制模板：

```bash
cp .env.example .env
```

| 变量 | 说明 |
|---|---|
| `SITE_NAME` | 站点名 |
| `SITE_URL` | 站点完整网址，**要带协议**（`https://example.com`）。用来把站内路径拼成绝对地址，见 `MY_FRIEND_AVATAR`。写错会在构建期报错 |
| `SITE_EMAIL` | 联系邮箱 |
| `SITE_COPYRIGHT` | 页脚版权信息 |
| `HERO_NAME` | 首页 Hero 昵称 |
| `HERO_SUBTITLE` | Hero 副标题 |
| `HERO_QUOTE` | Hero 个性引言 |
| `PROFILE_NAME` / `PROFILE_BIO` | 个人信息卡片的昵称与简介 |
| `PROFILE_BILIBILI` / `PROFILE_GITHUB` | 社交链接 |
| `STATUS_PLAYING` | 正在玩的游戏 |
| `STATUS_MUSIC_TITLE` / `STATUS_MUSIC_URL` | 音乐挂件的曲目与链接 |
| `STATUS_ALMANAC` | 今日宜忌卡池，逗号分隔（中英文逗号都认）。不设 → 用内置卡池；设为空 → 整块不显示 |
| `ACTIVITY_LIMIT` | 首页「最近动态」显示条数，`0` = 不折叠。默认 `3` |
| `BOT_NAME` / `BOT_DESC` | 机器人卡片 |
| `MY_FRIEND_NAME` / `_DESC` / `_URL` / `_AVATAR` | 友链互抄用的本站信息 |
| `EXCLUDE_EXAMPLES` | 构建期是否排除示例内容，见[内容管理](#内容管理) |
| `FONTS_OFFLINE` | 内网 / 离线环境设为 `1`，跳过字体下载的联网检查 |

> `MY_FRIEND_AVATAR` **是给别人抄的地址** —— 交换友链那张卡片会把它**当文本印出来**，对方拿去要能直接用，所以必须是公开可访问的。填绝对地址（图床也行）；填站内路径（如 `/head.svg`）会自动拼上 `SITE_URL`。别填站内 `astro:assets` 那条路径（`/_astro/head.<hash>.webp`）：每次构建都换哈希，今天抄走明天就坏。
>
> 不设也没关系：默认是 `src/pages/head.svg.ts` 生成的占位头像，一定存在，拼出来就是 `https://你的域名/head.svg`。

所有变量读的都是静态的 `import.meta.env.XXX` —— Vite 只对静态成员访问做构建期替换，写成 `import.meta.env['XXX']` 或整个对象解构在生产构建里会拿不到值。

## 配色与主题

全站颜色收在 **`src/theme.json`** 一个文件里，改它就能换掉整个站点的配色，不需要动任何组件：

```json
{
  "accent":  { "light": "#8b5e3c", "dark": "#c4a574" },
  "text":    { "light": "#8b7355", "dark": "#d4bfa8" },
  "fx-rain": "#beaf9b"
}
```

每个 token 自动生成两个 CSS 变量：

- `--c-accent` —— 完整色值，直接给 `color` / `background` / `border` 用
- `--c-accent-rgb` —— `139, 94, 60` 形式的三元组，用来在样式里拼任意透明度：`rgba(var(--c-accent-rgb), .08)`

**三元组是这套机制的支点**：全站十几处不同透明度的强调色（描边、悬停、引用线、时间轴圆点）只认 `accent` 一个源，改一次全部跟着变。

- `light` / `dark` 是昼夜两套值；**只写一个字符串**表示两模式共用（粒子颜色、favicon 这类不必写两遍）
- 写 `"@别的 token"` 表示跟随那个 token，改被跟随者这里也一起变
- 值支持 `#rgb` / `#rrggbb` / `rgb()` / `rgba()` / `transparent` / 整条渐变（`linear-gradient(...)` 这类）
- 每个 token 带一行 `note` 说明用途；加自己的 token 是允许的，`--c-<名字>` 立刻可用
- 改完保存即可，dev 下热更新（`theme.json` 经 Vite 直接 import）

**值写错了会在构建期直接报错并指名是哪个 token**，不会静默失效 —— 排错的代价比打错字高得多。

站点图标 `/favicon.svg` 由 `src/pages/favicon.svg.ts` 按 `favicon` token 渲染：**改颜色改 `theme.json`，改形状改 `src/assets/favicon.svg`**。`public/favicon.ico` 是给老浏览器的栅格兜底，不跟着主题化。

Canvas 粒子读不到 CSS 变量，走 `src/scripts/theme-colors.ts` 的 `readThemeColors()` 用 `getComputedStyle` 取三元组 —— 那是 `src/` 里唯一允许留颜色字面量（兜底值）的地方。

## 内容管理

内容通过 [Astro 内容集合](https://docs.astro.build/en/guides/content-collections/)管理，schema 定义在 `src/content.config.ts`：

| 集合 | 目录 | 字段 |
|---|---|---|
| 作品 `works` | `src/content/works/*.md` | `name` / `desc` / `icon` / `order` / `github` / `release` / `links` / `live2d` + 正文 |
| 文章 `blog` | `src/content/blog/*.md` | `title` / `desc` / `date` / `links` / `style`（可选，本页自定义 CSS）+ 正文 |
| 友链 `friends` | `src/content/friends/*.json` | `name` / `desc` / `url` / `avatar` |
| 技术栈 `skills` | `src/content/skills/*.json` | `name` / `icon`（Phosphor 图标名） |
| 最近动态 `activity` | `src/content/activity/*.json` | `date` / `text` |

新增或修改内容只需在对应目录增删文件，无需改动代码。每个集合的 `_example.*` 是自带示例，字段填得比较全，可以照着改。

### 换成你自己的内容

`src/content/<集合>/_example.*` 是随仓库分发的示例条目，让 clone 下来直接就是一个能跑的演示站。开始写自己的内容后，有两种方式让它消失：

1. **构建期排除**（推荐）：在 `.env` 里设 `EXCLUDE_EXAMPLES=1`
2. **直接删掉** `_example.*` 文件

两者等效。用方式 1 的好处是示例文件仍在本地，随时能翻出来对照字段写法。

> ⚠️ 改完开关**要整体重启 dev server**。`content.config.ts` 只在启动时求值一次，删掉 `.env` 里的开关后热更新不会跟上。

### 分发边界：这个仓库提交什么、不提交什么

本仓库的定位是**只开源框架、不公开个人内容**，所以 `.gitignore` 写死了忽略 5 个内容集合：

```gitignore
src/content/blog/**/*.md
src/content/works/**/*.md
src/content/activity/**/*.json
# ...（friends / skills 同理）
```

因此**这个仓库里只会提交每个集合的 `_example.*`，你写的个人内容不会被提交**，由 `.gitignore` 保证。反向放行规则刻意只写单层：

```gitignore
!src/content/*/_example.*
```

把「豁免入库」的面精确限制在这 5 个示例文件上 —— 改成 `**` 是放宽，别当 bug 改。

**如果你是 fork 下来当自己的博客用，并且想把文章纳入版本控制**，必须先把那几行删掉（或注释掉）。留着它们的后果是：你写的 `src/content/blog/my-post.md` 会被 git **静默忽略** —— 文件在本地好好的，`git status` 里却看不见，提交不上、也部署不出去。

同样被忽略的还有：`.env`（私密配置）、`public/fonts/`（构建产物）、`fonts-src/` / `live2d-src/` / `assets-src/`（素材母版）、`content-backup/`（个人内容备份）。完整清单见 [`.gitignore`](.gitignore)。

## 部署

### Docker

确保已安装 Docker 与 Docker Compose：

```bash
cp .env.example .env
vim .env
docker compose up -d --build
```

镜像分三个阶段构建（取源字体 → 构建站点 → Nginx 托管），最终只有一个容器：

| 容器 | 说明 |
|---|---|
| `washi-site` | Nginx 静态站点，对外 80 |

`docker-compose.yml` 默认把容器接进名为 `nginx-proxy` 的**外部网络**。这个网络得先存在，或者按自己的反代方案改掉：

```bash
docker network create nginx-proxy
```

`.env` 会被带进构建阶段（`.dockerignore` 未排除它），所以构建期变量在容器里同样生效 —— 包括 `EXCLUDE_EXAMPLES`；而最终镜像只 `COPY --from=build /app/dist`，`.env` 不会进镜像。

### Nginx

`nginx.conf` 里有一条**不能改**的规则：

```nginx
location ^~ /fonts/ { add_header Cache-Control "max-age=600, must-revalidate"; }
```

字体子集的文件名固定、内容每次构建都变，**不能 immutable**：回访者若拿着 30 天 immutable 的旧子集，新写的字会掉成系统字体且刷新不掉。同理也不做内容哈希文件名 —— `<link rel="preload">` 住在构建前就渲染好的 HTML 里，要哈希就得两遍构建。

## 目录结构

```
Washi/
├── src/
│   ├── assets/            # 构建期优化图片（头像、favicon 源、插图，经 astro:assets）
│   ├── components/        # Astro 组件
│   │   ├── Navbar.astro        # 顶栏：品牌、导航、语言切换、搜索、汉堡菜单
│   │   ├── NoIXCard.astro      # 机器人 / 友链卡片（含 Live2D 舞台）
│   │   ├── Live2DViewer.astro  # Live2D 舞台：pixi + cubism4，空闲时才延迟加载
│   │   ├── RainFX / FireflyFX / SakuraFX.astro   # Canvas 粒子特效
│   │   ├── Status.astro        # 音乐 / 游戏 / 宜忌挂件
│   │   └── …                   # Profile、Activity、TechStack、SearchCard…
│   ├── content/           # 内容集合（个人内容 gitignore，只留 _example.*）
│   ├── content.config.ts  # 内容集合 schema
│   ├── i18n/              # 多语言文案
│   ├── layouts/Layout.astro    # 根布局：偏好恢复脚本、主题注入
│   ├── pages/
│   │   ├── [locale]/      # 按语言分组的页面路由
│   │   ├── favicon.svg.ts # 按主题色渲染站点图标
│   │   ├── head.svg.ts    # 友链互抄用的占位头像
│   │   └── 404.astro      # 全局 404
│   ├── scripts/theme-colors.ts # Canvas 粒子取主题色
│   ├── styles/global.css  # 全局样式与正文排版
│   ├── theme.json         # 全站配色（唯一真值源）
│   ├── theme.ts           # 读 theme.json → 校验 → 生成 CSS 变量
│   └── site.config.ts     # 站点配置（env 驱动）
├── scripts/               # 字体管线（下载 / 子集化 / 漏字校验）
├── public/                # 静态资源（背景纹理、favicon.ico；fonts/ 是构建产物）
├── fonts-src/             # 源字体 TTF（gitignore，首次构建自动下载）
├── assets-src/            # 插画母版（gitignore，入库的那份按展示宽度压过）
├── live2d-src/            # Live2D 贴图母版（gitignore）
├── content-backup/        # 个人内容备份（gitignore，绝不入库）
├── Dockerfile / docker-compose.yml / nginx.conf
└── .env.example
```

入库的图片素材按**真实展示宽度**存放，不直接放母版 —— 原因见[图片尺寸](#图片尺寸为什么不能放母版)。

## 实现说明

### 配色

**唯一真值源是 `src/theme.json`。** `src/theme.ts` 读它、校验、生成一段 CSS，由 `Layout.astro` 用 `<style is:global set:html={themeCss}>` 内联进 `<head>` 最前面（首帧前生效，不会闪色）。组件里不再出现颜色字面量。

暗色不另起一套名字：`:root` 定义浅色，`body.dark` 用**同名**重定义。自定义属性靠继承传递、不参与选择器匹配，所以组件里写一次 `var(--c-text)` 就自动跟着 `<body>` 的 class 翻转。

这带来两个好处：

1. **不需要 `body.dark <选择器>` 覆盖** —— 全站原有约 46 处逐条覆盖的颜色规则已经全部删掉，以后加组件不用再写两遍
2. **绕开 Astro 的作用域陷阱** —— 自定义属性靠继承传递，不受 `data-astro-cid-*` 作用域属性影响

### 字体子集

字体子集（三个 woff2）是**构建产物，不入库**。`scripts/fonts-integration.mjs` 挂在 Astro 生命周期上：dev 启动时切一份到 `public/fonts/`，build 结束时切一份到 `dist/fonts/`。**clone 下来直接跑就行**，不用手动准备字体。

- **核心不变式：字符集与字体出自同一次构建。** build 模式扫的是**构建产物**（按原始字节收，不解析 HTML），所以「这次渲染出来的字」必然在「这次生成的字体」里 —— 不存在「内容更新了字体没跟上」的时间窗
- **两种模式分辨率不同，是有意的**：build 精确（扫构建产物，只收这次真正渲染出的字），dev 没有 dist 可扫、退回扫 `src/`，是个含注释用字的超集。已知边界：dev 启动**之后**新写的内容不反映到字体里（Vite 不会重跑 `config:setup`），要立刻生效就跑 `npm run fonts`。三个 woff2 合计约 0.35 MB
- **漏字不会报错，只会静默掉到系统字体**，所以构建流程自动跑 `npm run fonts:check`：它**独立重扫一遍产物**来比对（刻意不共用生成器的扫描逻辑，否则生成器的 bug 在它眼里是不可见的），漏字以非零码退出、构建失败
- 不用「常用汉字表」之类的保底字符集：实测站点只用得到 3500 常用字里的 797 个，另外 2703 字从没出现过，却让每个字重多背约 660 KB
- 源字体来自 [lxgw/LxgwWenkaiGB](https://github.com/lxgw/LxgwWenkaiGB)（**GB 版是独立仓库**，`lxgw/LxgwWenKai` 上的 ttf 与压缩包都是非 GB 的）。sha256 钉在 `scripts/font-pins.mjs`；子集化走 `subset-font`（harfbuzz wasm），读字体走 `fontkitten`，**全流程不需要 Python**

### 内容集合与构建期开关

`src/content.config.ts` 里每个集合的 `glob()` 模式根据 `EXCLUDE_EXAMPLES` 决定要不要带上 `!**/_example.*` 这条负向模式。排除做在 **loader 层**，所以 `getCollection` / `getEntry` 的所有调用点都自动看不到示例，新增集合也会自动继承。

开关优先读 `import.meta.env`（认 `1` / `true` / `yes` / `on`），拿不到时回落 `process.env`。构建时会打印一行当前模式，不会静默。

> 注意：Astro 的「下划线开头的文件会被忽略」只对旧的内容集合层生效，`astro/loaders` 的 `glob()` **不忽略**下划线文件，所以排除必须显式写成负向模式 —— 改文件名前缀是没用的。

### 偏好模型

三个偏好存 localStorage，由 `Layout.astro` 在 `<body>` **最前面**的内联脚本恢复（首帧前完成，跟随系统暗色时才不会闪一下浅色）：

| 偏好 | 首次进入的默认值 | 存储键 |
|---|---|---|
| 昼夜 | 跟随系统，只在加载时判定一次 | `theme` |
| 粒子 | 普通页按昼夜默认（浅色樱花 / 暗色萤火虫）；详情页默认关 | `fx:normal` / `fx:detail` |
| 看板娘 | 显示 | `mascot` |

详情页 = 文章正文 / 作品详情，判定依据是 `<body data-page-kind="detail">`。详情页的「默认关」不写进 localStorage，避免把「用户没选过」坐实成「用户选了关」。

### 粒子特效

RainFX、FireflyFX、SakuraFX 三个 Canvas 特效共享同一模式：

- 画布初始 `display: none`，停止时完全不占 GPU
- 偏好 class 挂在 `<body>` 上（`fx-rain` / `fx-firefly` / `fx-sakura` / `fx-none`）
- 组件通过 `MutationObserver`（监听 class 变化）+ `fx-init` 事件双重监听，确保无论加载顺序如何都能正确启停；`running` 标志位防重复执行
- 颜色在每次 `start*()` 的守卫**之前**重读一次 —— 切昼夜时 `MutationObserver` 走的就是这条路径，颜色才会立刻跟着变

### 图片尺寸：为什么不能放母版

Astro 用 `getSizesAttribute()` 按「图片固有宽度 vs 视口」推导 `sizes`，**没有配置项能覆盖**。所以：

- `<Image>` 的 `width` 必须写 CSS 里**真实的展示宽度**，源图也不要超过真实展示宽度 —— 否则浏览器会按过大的 `sizes` 去挑档（写 `width={1760}` 而实际只显示 440px，就会白拉 4 倍大的图）
- CSS 固定尺寸的图（`width: 240px` 之类）用 `layout="fixed"`
- 高分辨率母版因此另放 `assets-src/`（已 gitignore）

### 样式约定

- **颜色一律走 `var(--c-*)`**，值来自 `src/theme.json`。组件 `<style>` 里不写颜色字面量
- 昼夜两套值由 `:root` / `body.dark` 用**同名**变量定义，组件里只写一次就自动翻转，**不需要再写 `body.dark` 覆盖**
- **Astro 作用域陷阱**：`<html>` / `<body>` 上的 class（`body.dark`、`html.mascot-off`）做后代选择器时，前缀必须写成 `html.` / `body.`。Astro 只对这两个**元素选择器**免于加作用域属性，写成 `.mascot-off .x` 会被编成 `.mascot-off[data-astro-cid-x] .x[data-astro-cid-x]`，而 `<html>` 上并没有这个属性 —— 规则静默失效、不报错
- 同理，组件 `<style>` 里给 markdown 正文（`<Content />` 渲染出的元素）写的选择器也匹配不到，正文排版一律放 `global.css`
- Canvas 特效读不到 CSS 变量，走 `src/scripts/theme-colors.ts`

## 常见问题

**构建时提示某个字符源字体里没有字形？**
先看那个字符是不是你自己写的。若是第三方 bundle（例如 Live2D 的 `display.*.js`）里带的装饰符号，可以忽略 —— 它会回落到系统字体。若是自己内容里的字，说明子集化没覆盖到，跑一次 `npm run build` 即可（build 模式扫的是产物，不会漏）。

**dev 启动了，但新写的字还是系统字体？**
dev 模式的字符集在启动时求值一次，之后新增的内容不反映。跑 `npm run fonts` 立刻生效。

**改了 `.env` 的 `EXCLUDE_EXAMPLES` 没反应？**
`content.config.ts` 只在启动时求值一次，得整体重启 dev server。

**图片糊了 / 拉了好几张不同尺寸？**
见[图片尺寸](#图片尺寸为什么不能放母版) —— 源图别超过真实展示宽度。

**端口起不来（`EACCES`）？**
落在 Windows 的 Hyper-V / WSL 预留段里了，见[快速开始](#快速开始)里的排查命令。

## 致谢

- [Astro](https://astro.build) —— 站点框架
- [霞鹜文楷 GB](https://github.com/lxgw/LxgwWenkaiGB)（LXGW WenKai）—— 正文字体，SIL OFL 1.1
- [Phosphor Icons](https://phosphoricons.com) —— 图标
- [pixi.js](https://pixijs.com) / [pixi-live2d-display](https://github.com/guansss/pixi-live2d-display) —— Live2D 渲染
- [Live2D Cubism Core](https://www.live2d.com/en/sdk/download/web/) —— Live2D 运行时

## 许可

本项目**源代码**以 [MIT 许可](LICENSE)发布，© 2026 NoIX。

但仓库里有几类文件**不在 MIT 覆盖范围内**，使用时请自行替换或移除：

| 文件 | 说明 |
|---|---|
| `public/live2d/live2dcubismcore.min.js` | **Live2D 专有软件**，适用 [Live2D Proprietary Software License Agreement](https://www.live2d.com/eula/live2d-proprietary-software-license-agreement_en.html)，不是 MIT。商用或用它发布站点前请自行确认已满足 Live2D 的授权条件 |
| `src/assets/noix-*.png`、`public/noix-*.png`、`public/noix-half-body-avatar/**` | 作者本人的角色插画与 Live2D 模型，**保留所有权利**，不随 MIT 授权。请换成自己的素材 |
| `src/assets/head.jpg` | 作者头像，同上 |

字体（`fonts-src/`、构建产出的 `public/fonts/`）是构建期下载的 [霞鹜文楷 GB](https://github.com/lxgw/LxgwWenkaiGB)，遵循 **SIL OFL 1.1**，不随本仓库分发。
