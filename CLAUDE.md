# CLAUDE.md

Washi — 基于 Astro 7 的个人站点，支持多语言（`zh-CN` / `zh-TW` / `en` / `ja`），Docker 部署。

## 开发命令

```bash
# 启动开发服务器（后台运行）
astro dev --background

# 管理后台服务器
astro dev stop      # 停止
astro dev status    # 查看状态
astro dev logs      # 查看日志
```

dev 与 preview 的端口在 `astro.config.mjs` 里写死为 **4400**，别改回 Astro 默认的 4321：Windows 会把一段端口划给 Hyper-V/WSL 预留，落在其中的端口绑定时直接 `EACCES`（端口没人占，但系统不让绑），本机预留段是 `4246–4345`，4321 正在里面。预留段每次开机重新划，所以别贴着边界取端口。查当前预留段：

```bash
netsh interface ipv4 show excludedportrange protocol=tcp
```

## 项目结构

```
Washi/
├── src/
│   ├── pages/[locale]/      # 页面：home、blog、works、friends、search
│   ├── pages/favicon.svg.ts # 按主题色渲染站点图标，见「配色」
│   ├── layouts/Layout.astro   # 根布局：<body> 顶部内联脚本恢复偏好，见「偏好模型」
│   ├── components/          # Astro 组件
│   │   ├── Navbar.astro       # 顶栏：品牌标识、导航链接、语言切换、搜索、汉堡菜单
│   │   ├── Profile.astro      # 个人信息卡片（头像、简介、社交链接）
│   │   ├── NoIXCard.astro     # 机器人/友链卡片（含 Live2D 舞台）
│   │   ├── Live2DViewer.astro # Live2D 舞台：pixi + cubism4，空闲时才延迟加载（可多实例）
│   │   ├── PageLinks.astro    # 详情页相关链接按钮排（作品 / 文章共用）
│   │   ├── SearchCard.astro   # 搜索结果卡片
│   │   ├── Status.astro       # 音乐/游戏状态挂件
│   │   ├── TechStack.astro    # 首页技术栈卡片
│   │   ├── Activity.astro     # 首页最近动态卡片
│   │   ├── Loading.astro      # 全屏加载动画，每次跳转放映
│   │   ├── Footer.astro       # 页脚（可选看板娘插图）
│   │   ├── BackToTop.astro    # 回到顶部按钮
│   │   ├── RainFX.astro       # Canvas 粒子效果：雨滴（fx-rain）
│   │   ├── FireflyFX.astro    # Canvas 粒子效果：萤火虫（fx-firefly）
│   │   └── SakuraFX.astro     # Canvas 粒子效果：樱花（fx-sakura）
│   ├── assets/             # 构建期优化图片（头像 head.jpg、favicon.svg 源等）
│   ├── scripts/theme-colors.ts  # Canvas 粒子取主题色，见「配色」
│   ├── styles/global.css
│   ├── theme.json             # 全站配色，唯一真值源，见「配色」
│   ├── theme.ts               # 读 theme.json → 校验 → 生成 CSS 变量
│   ├── i18n/translations.ts   # 多语言文案
│   ├── site.config.ts         # 站点配置（env 驱动）
│   ├── content.config.ts      # 内容集合 schema（works / friends / blog / skills / activity）
│   └── content/               # 内容集合（个人内容 gitignore，只留 _example.* 入库）
│       ├── works/*.md           # 作品：name / desc / icon / github / release / links / live2d + 正文（自述）
│       ├── friends/*.json       # 友链：name / desc / url / avatar
│       ├── blog/*.md            # 文章：title / desc / date / links + 正文
│       ├── skills/*.json        # 技术栈：name / icon（ph 图标名）
│       └── activity/*.json      # 最近动态：date / text
├── content-backup/         # 个人内容备份（gitignore，绝不入库，见「开源隔离」）
├── scripts/                # 字体管线（fonts-integration / fetch-fonts / subset-fonts / check-fonts / font-charset / font-list / font-pins）
├── fonts-src/              # 原始 TTF（gitignore，构建前自动下载，共约 74 MB）
├── live2d-src/             # Live2D 贴图母版 PNG（gitignore，转 WebP 用）
├── assets-src/             # 插画高分辨率母版（gitignore，按展示宽度压过再入库）
├── nginx.conf
└── docker-compose.yml
```

入库的图片素材按**真实展示宽度**存放，不直接放母版 —— 原因见「图片的 sizes 由固有宽度决定」。

## 架构约定

### 开源隔离：只开源框架，不公开内容

仓库对外是**框架**，个人内容（文章、作品自述、技术栈、友链、动态）不入库。同一份代码要同时服务两个用途，所以两件事分开做，别混淆：

| 目的 | 靠什么 |
| --- | --- |
| 别把个人内容**提交**上去 | `.gitignore` 忽略 5 个内容集合 |
| 别让示例**出现在自己站上** | `.env` 里 `EXCLUDE_EXAMPLES=1` |

- 每个集合留一个中性示例 `src/content/<集合>/_example.*`，随仓库分发，clone 下来直接是个能跑的演示站
- `.env` 里 `EXCLUDE_EXAMPLES=1` → `src/content.config.ts` 把 5 个 `glob()` 的 pattern 变成 `['**/*.<ext>', '!**/_example.<ext>']`。排除做在 **loader 层**，所有 `getCollection` / `getEntry` 调用点自动继承
- **`glob()` 不忽略下划线开头的文件**：Astro 那条「`_` 前缀忽略」属于 legacy 内容集合层（`node_modules/astro/dist/content/utils.js` 的 `hasUnderscoreBelowContentDirectoryPath`），本项目走 `astro/loaders`，走不到那里。实测 `_example.md` 会正常生成页面，所以排除必须显式写负向模式 —— 别以为改个文件名前缀就行了
- 开关读 `import.meta.env.EXCLUDE_EXAMPLES`（认 `1`/`true`/`yes`/`on`），回落 `process.env`。构建时会打印当前模式
- **改开关要整体重启 dev server**：`content.config.ts` 只在启动时求值一次，实测把开关从 `.env` 删掉后等 20 秒 dev 仍在渲染示例，热更新不会跟上
- `.gitignore` 的忽略规则用 `**`（将来按年份分目录 `blog/2026/xxx.md` 不会漏），但反向放行 `!src/content/*/_example.*` **刻意只写单层** —— 把豁免面精确限制在这 5 个文件上，改成 `**` 是放宽，别当 bug 改
- 个人内容的本地备份在 `content-backup/`（已 gitignore，**绝不入库**）
- **git 历史已整体清零，以当前状态作为首次提交重新开始**。此前误入库过三类东西，现在远端与本地都不再有任何对象：19 个个人内容文件、6 个 `LXGWWenKai*GB-*.ttf`（约 155 MB，曾是 `.git` 114 MB 的主因）、以及 `public/fonts/**`（入库的 woff2 编码着「站点用过哪些字」，而这份用字集合直接来自私密内容 —— 这是三件里最隐蔽的一件）。
  **所以别把这几类重新提交上去**：历史清空只用一次，再放回去就得重来一遍。`.gitignore` 里对应的规则都还在，删规则前先想清楚

### 配色：唯一真值源是 src/theme.json

全站颜色收在 `src/theme.json`，`src/theme.ts` 读它、校验、生成一段 CSS，由 `Layout.astro` 用 `<style is:global set:html={themeCss}>` 内联进 `<head>`。**改配色只动 theme.json**，组件里不再出现颜色字面量。

- 每个 token 生成两个变量：`--c-<名>` 和 `--c-<名>-rgb`（`139, 94, 60` 三元组）。**三元组是这套东西的支点** —— 同一个强调色原本散成十几种透明度手写死，现在统一写 `rgba(var(--c-accent-rgb), .25)`，改基色一处全站跟着走
- 解析不出颜色的值（`transparent`、渐变）只吐主 token、不吐破的 `-rgb`。**不能吐半个坏值**：三元组一旦为空，`rgba(var(--c-x-rgb), .2)` 整条声明会静默失效，比报错难查
- 昼夜不另起名字：`body.dark` 用**同名**重定义。自定义属性靠继承传递，所以组件里写一次 `var(--c-text)` 就自动翻转 —— 顺带绕开 Astro 的作用域问题（自定义属性不参与选择器匹配）。**由此全站原有的 46 处 `body.dark <选择器>` 颜色覆盖已全部删除**，以后加组件不用再写两遍
- 两模式同值的 token 不进 `body.dark` 块（粒子色、favicon 这类省一半体积）
- 值可以是 `"@别的token"`，生成的 CSS 里写 `var(--c-...)`。`accent-solid` 浅色跟随 `accent`、暗色另给一个值，就是靠这个
- 校验在构建期跑：token 对象里出现 `light`/`dark`/`note` 之外的键、或者值不是能识别的颜色/渐变，**直接报错并指名 token**（带环的 `@` 引用也报错，不栈溢出）。fork 的人打错字不该得到一个静默失效的页面
- 渐变这类整条 CSS 值可以放进来（`btn-face`、`stage-face`），validator 里有 `GRADIENT` 白名单放行

**唯一允留颜色字面量的地方是 `src/scripts/theme-colors.ts`**：Canvas 粒子逐帧拼 `rgba()` 字符串，读不到 CSS 变量，只能用 `getComputedStyle` 取 `-rgb`，取不到时回落到硬编码三元组。三个 FX 组件都在 `start*()` 的**守卫之前**重读一次 —— 切昼夜时 `MutationObserver` 也走那条路径，颜色才会立刻跟着变。

**站点图标**：`src/pages/favicon.svg.ts` 按 `favicon` token 渲染 `/favicon.svg`，源在 `src/assets/favicon.svg`（`fill` 是占位符）。`public/favicon.svg` 必须不存在 —— 不删会和生成的 `dist/favicon.svg` 撞路径。`public/favicon.ico` 是栅格图，不主题化。

### 偏好模型

三个偏好存在 localStorage，由 `Layout.astro` 在 `<body>` **最前面**的内联脚本恢复（首帧前完成，跟随系统暗色时才不会闪一下浅色）：

| 偏好 | 首次进入的默认值 | 存储键 |
| --- | --- | --- |
| 昼夜 | 跟随系统，只在加载时判定一次、之后不跟系统变 | `theme`（全站共用） |
| 粒子 | 普通页按昼夜默认（浅色樱花 / 暗色萤火虫）；详情页默认关 | `fx:normal` / `fx:detail`（**两套互不影响**） |
| 看板娘 | 显示 | `mascot`（全站共用） |

- 详情页 = 文章正文 / 作品详情，判定依据是 `<body data-page-kind="detail">`
- 详情页的「默认关」不写进 localStorage，避免把「用户没选过」坐实成「用户选了关」

### 详情页的相关链接

作品的 github / release、以及任意自定义链接，与文章的相关链接共用一套：

- 数据在 frontmatter 的 `links`（作品、文章都有），条目是 `{ label, url, icon }`，`icon` 写 ph 图标名
- 渲染统一走 `components/PageLinks.astro`，按钮样式 `.page-actions` / `.action-btn` 放 `global.css` —— 组件自己的 `<style>` 会带 Astro 作用域属性，两处调用方各写一遍不划算
- `url` 允许站内路径（以 `/` 开头）或 http(s) 绝对地址；**只有外链**才加 `target=_blank` + `rel=noopener`，站内跳转不加（schema 里的 `linkUrl` 就是这个校验）
- 作品列表卡片的图标由作品 frontmatter 的 `icon` 决定，每件挑一个贴题的，默认 `ph:palette-duotone`

### Live2D 展示台

- 作品 frontmatter 写 `live2d: true` 就在详情页正文顶部摆一座
- 做法是 **`float: right`**：正文自然绕排到左侧，写到浮动下沿之后自动续成整宽，不用手工切正文
- 正文里满宽的元素（`table` / `pre` / `img`）必须 `clear: both`。它们的 `width: 100%` 是按**整个栏宽**算的，不 clear 就会直接铺到 Live2D 底下被压住
- 浮动不计入容器高度，`.post-body::after` 要 clearfix，否则正文短时整块会溢出到返回链接上
- ≤800px 取消浮动改成上下堆叠（此时正文栏 752px，减去 348px 浮动只剩 404px，再窄就不好读了）
- 展示台带 `data-mascot`：看板娘总开关能一并收起它，而且组件因 `display:none` 连模型都不会去下载。要让它常驻删掉该属性即可

### 粒子效果组件

- 每个粒子效果画布默认隐藏（`display:none`），停止时完全不占 GPU
- 偏好 class 挂在 `<body>` 上（`fx-rain` / `fx-firefly` / `fx-sakura` / `fx-none`）
- 粒子效果组件通过 `MutationObserver`（监听 class 变化）和 `fx-init` 事件双重机制控制启停，由 `running` 标志位防止重复执行

### 样式规范

- **暗色模式靠 token 翻转**，组件里**不再写 `body.dark` 颜色覆盖**（原来那 46 处已删）。见「配色」
- **Astro 作用域陷阱**：`<html>`/`<body>` 上的 class（`mascot-off`、`body.dark`）做后代选择器时，前缀必须写成 `html.` / `body.`。Astro 只对 `html`、`body` 这两个**元素选择器**免于加作用域属性，写成 `.mascot-off .x` 会被编成 `.mascot-off[data-astro-cid-x] .x[data-astro-cid-x]`，而 `<html>` 上并没有这个属性 —— 规则静默失效、不报错。同理，组件 `<style>` 里给 markdown 正文（`<Content />` 渲染出的元素）写的选择器也匹配不到，正文排版一律放 `global.css`
- **移动端汉堡菜单**：使用 `translateZ(0)` GPU 加速修复渲染问题；顶栏用 `order` + `margin-left: auto` 排布，`.navbar` 加 `align-self: stretch` 铺满整宽（父容器 `.content` 为 `align-items: center`）

### 图片与字体

- **图片**走 `astro:assets`：头像在 `src/assets/`，构建期由 sharp 压缩为 WebP/AVIF
- **站内展示的头像与对外公开的头像不是同一份**，别把后者当重复文件删掉：`src/assets/head.jpg` 只服务于页面渲染，构建后是带哈希的 `/_astro/head.<hash>.webp`；而 `MY_FRIEND_AVATAR` 要的是一个**长期稳定、能被别人抓取**的地址，哈希路径每构建一次就变，不能用。所以 `public/head.webp` 另存了一份 256px 的（`/head.webp`）。改头像时两份都要换
- **`sizes` 由图片固有宽度决定**：Astro 用 `getSizesAttribute()` 按「固有宽度 vs 视口」推 `sizes`，**没有配置项能覆盖**。所以 `<Image>` 的 `width` 必须写 CSS 里真实的展示宽度，源图也不要超过真实展示宽度，否则浏览器会按过大的 `sizes` 去挑档（写 `width={1760}` 而实际只显示 440px，就会白拉 4 倍大的图）；CSS 固定尺寸的图（`width:240px` 之类）用 `layout="fixed"`，`sizes` 直接等于该固定值。正文大图的母版因此放 `assets-src/`
- **背景纹理**用 AVIF，`image-set()` 选档，`@supports` 里给不支持的浏览器留 WebP 兜底。注意兜底**不能**和 AVIF 写成同一规则里的两条 `background-image` —— 构建时的 CSS 压缩会把被覆盖的那条直接删掉，兜底就没了
- **字体子集是构建产物，不入库**。`scripts/fonts-integration.mjs` 挂在 Astro 生命周期上：dev 启动时切一份到 `public/fonts/`，build 结束时切一份到 `dist/fonts/`；`public/fonts/` 整个目录已 gitignore，所以 **clone 下来是没有字体的**，重跑不用手动做任何事（源 TTF 会自动下载）
  - **核心不变式：字符集与字体出自同一次构建。** build 模式扫的是**构建产物**（`DIST_EXTS` 白名单 `.html|.js|.mjs|.css|.svg`，整文件按原始字节收、**不解析 HTML** —— 实测解析版与原始字节版结果完全一致，多写一层解析器就多一类「选择器漏了某种写法」的漏字 bug），所以「这次渲染出来的字」必然在「这次生成的字体」里，不存在内容更新了字体没跟上的时间窗
  - **两种模式分辨率不同，是有意的**：build 精确（只收这次真正渲染出的字），dev 没有 dist 可扫、退回扫 `src/`，**是个超集**，含代码注释里的字。两者的字数与体积都随内容增长，别把它们当固定值引用（2026-09 实测：build 正文 1677 字、三个 woff2 合计约 0.35 MB；dev 扫 `src/`）。已知边界：**dev 启动之后**新写的内容不反映到字体里（Vite 不会重跑 `config:setup`），要立刻生效就跑 `npm run fonts`
  - **扫描必须带扩展名白名单**：不加会从 `favicon.ico`/`png`/`webp` 里解出 16319 个「汉字」，体积涨 20 倍。也**不收录 `.json`**（Live2D 的 `*.model3.json` 会带出 14 个只给建模工具看的参数名）
  - **过滤器是 `> 0x7f`，不是 `> 0x2e80`**：后者会静默丢掉 `① ★ ✓ ■ ω ⌒ ☆` 这类字体明明有字形的符号。实测站点在用的 `ω ⌒ ☆ ♥`（来自 `Status.astro` 的 `data-words` 词池）此前**根本没进过字体**，一直在回落系统字体且不报错。放宽的是**语料过滤器**而不是去扩 `PUNCT_RANGES` —— 扩区段等于每次构建永久塞约 450 个字形（约 68 KB/字重），放宽过滤器则只为真正用到的字付钱
  - **`check-fonts.mjs` 刻意不复用 `font-charset.mjs` 的扫描**：如果校验器问的是「生成器算出的那份字符集字体里都有吗」，那生成器任何 bug 都是不可见的 —— 同一个错误问题、同一个错误答案、然后打印 ✓。所以它自己独立重扫一遍 dist，问「产物里每个非 ASCII 字符，字体里都有吗」。**改这套东西后请验一次它还有效**：把 `toCharsetString` 改成丢掉每 5 个字符，构建必须失败并指名缺了哪些字
  - **漏字不会报错，只会静默掉到系统字体**，所以别只靠肉眼；`npm run fonts:check` 漏字以非零码退出。现在构建流程已自动跑它，**不需要再手动记得跑**
  - **不要并入「常用汉字表」之类的保底字符集**：早期并进 3500 常用字，实测站点只用得到其中 797 字，另外 2703 字（77%）从没出现过，却让每个字重多背约 660 KB（该文件已删，历史见 commit 63617a8）
  - 等宽字体不带汉字，代码块里的中文靠**字体栈回落**：`'LXGW WenKai Mono', 'LXGW WenKai', ...`，所以改字体栈时别把文楷那一项删掉
  - 字重只有 400 / 500 两档（Light 300 已砍，原来全站只有 hero 两行用到）
  - **源字体来自 `lxgw/LxgwWenkaiGB`**（GB 版是独立仓库，不是 `lxgw/LxgwWenKai` —— 后者 release 页上的 6 个 ttf 与压缩包**都是非 GB** 的）。GB 仓库把 6 个变体都作独立资产发布，所以直接下三个 ttf 即可，**不需要解压那个 76.9 MB 的归档**。sha256 钉在 `scripts/font-pins.mjs`，与本机母版实测一致
  - **本机没有 Python 依赖**：子集化走 `subset-font`（harfbuzz wasm），读字体走 `fontkitten`，都在 devDependencies 里且锁了精确版本
  - **`/fonts/` 的缓存策略在 nginx.conf 里被单独拎出来**：`location ^~ /fonts/ { max-age=600, must-revalidate }`，**不能 immutable**。文件名不变而内容每次构建都变，回访者若拿着 30 天 immutable 的旧子集，新写的字会掉成系统字体且刷新不掉。`^~` 必须写，否则会被下面的扩展名正则抢走；那条规则**刻意不写 `expires`**（`expires` 自己会再发一条 `Cache-Control`）。也**不做内容哈希文件名** —— `<link rel="preload">` 住在构建前就渲染好的 HTML 里，要哈希就得两遍构建，不值；文件名稳定意味着 `Layout.astro` 里那条写死的 preload 永远正确
- **禁缩放**：`viewport` 设 `maximum-scale=1.0, user-scalable=no` + `html { touch-action: manipulation }`

### i18n

- 支持 `zh-CN`、`zh-TW`、`en`、`ja`
- 页面按 `src/pages/[locale]/` 组织

## 外部文档

完整文档：https://docs.astro.build

涉及以下任务时先查阅对应指南：

- [添加页面、动态路由或中间件](https://docs.astro.build/en/guides/routing/)
- [编写 Astro 组件](https://docs.astro.build/en/basics/astro-components/)
- [使用 React/Vue/Svelte 等框架组件](https://docs.astro.build/en/guides/framework-components/)
- [添加或管理内容集合](https://docs.astro.build/en/guides/content-collections/)
- [添加样式或使用 Tailwind](https://docs.astro.build/en/guides/styling/)
- [多语言支持](https://docs.astro.build/en/guides/internationalization/)
