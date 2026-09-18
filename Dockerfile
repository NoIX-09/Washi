# Stage 1: 取源字体
#
# 单独一个 stage，只为了把 74 MB 的下载与 src/ 内容变更**解耦**：
# 改一篇文章不该触发重新下载 74 MB。这几行只依赖 scripts/ 下那三个文件，
# 内容怎么改都命中缓存。
FROM node:22-alpine AS fonts
WORKDIR /fonts
# 只 COPY 这个脚本的 import 图。也正因为 fetch-fonts 是从 font-list.mjs
# 推导文件名的，这里必须带上 font-list.mjs —— 两边各写一份文件名必然漂移
COPY scripts/font-list.mjs scripts/font-pins.mjs scripts/fetch-fonts.mjs ./
RUN node fetch-fonts.mjs --out /fonts-src

# Stage 2: Build
FROM node:22-alpine AS build
WORKDIR /app
COPY package*.json ./
# --include=dev 不是可选项：subset-font / fontkitten 是 devDependency。
# 若 NODE_ENV=production 渗进来，npm ci 会跳过 devDeps，然后构建在最后一步
# 炸成 ERR_MODULE_NOT_FOUND —— 看起来像代码 bug，其实是依赖装少了
RUN npm ci --include=dev
COPY . .
# .dockerignore 排除了 fonts-src，所以只能从 fonts stage 取
COPY --from=fonts /fonts-src ./fonts-src
# 字体子集由 astro build 的 integration 在构建**结束时**生成到 dist/fonts/
RUN npm run build

# Stage 3: Serve
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
