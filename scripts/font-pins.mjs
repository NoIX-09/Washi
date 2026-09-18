// scripts/font-pins.mjs
// 源字体的「版本 + 校验和」钉子。fetch-fonts.mjs 用，**无 import**，
// 这样 Dockerfile 里 fonts stage 只需要 COPY 这个文件加 font-list.mjs。
//
// ---------------------------------------------------------------------------
// 为什么下三个独立资产，而不是解压那个 76.9 MB 的归档
//
// 项目是 lxgw/**LxgwWenkaiGB**（GB 版是独立仓库），不是 lxgw/LxgwWenKai ——
// 主仓库 fonts/TTF/ 里那 6 个是**非 GB** 字体，GB 变体不在那儿。
// GB 仓库把 6 个变体都作为**独立资产**发布，要用的三个直接下即可。
//
// 于是解压那一整类复杂度都不必存在：不用 tar（Node 没内置、alpine 的 busybox
// 又不解 zip）、不用在归档里按 basename 找成员、不用 --strip-components、
// 也不用操心 NTFS 大小写不敏感而 alpine 敏感。代价只是 3 个请求而不是 1 个。
// ---------------------------------------------------------------------------
export const release = {
  version: 'v1.522',
  repo: 'lxgw/LxgwWenkaiGB',

  // 每个资产的 sha256 + 字节数。
  //
  // 来源：GitHub releases API 的 asset.digest 字段（形如 sha256:…），
  // 已与本机 fonts-src/ 里三个 TTF 实测比对一致，改版本时照此更新即可。
  //
  // size 单列一份不是冗余：网络截断的下载经常是「HTTP 200 但字节数不足」，
  // 先比字节数能立刻报出「下少了」，不必先白算一遍 25 MB 的 sha256。
  assets: {
    'LXGWWenKaiGB-Regular.ttf': {
      size: 25819540,
      sha256: '295568c131648062107543aa159c97dd49564be791136c2abf74cad83eba3f7f',
    },
    'LXGWWenKaiGB-Medium.ttf': {
      size: 25745488,
      sha256: 'b885c51ec0d3f325974013801dfcefda1a9ba0bf385c607cf5f2582dafa2e5ab',
    },
    'LXGWWenKaiMonoGB-Regular.ttf': {
      size: 25847688,
      sha256: 'fb82a0d6b9c0a1a3c83ad303eab1cc998e6a52c1028027fc3527455bdadb4ecb',
    },
  },
};

/**
 * 拼出某个资产的下载地址。
 *
 * 用的是 github.com 的 releases/download 短链（会 302 到 CDN），
 * 而不是 API 的 asset url —— 后者要带 Accept: application/octet-stream 且计 API 配额。
 */
export const assetUrl = (name) =>
  `https://github.com/${release.repo}/releases/download/${release.version}/${encodeURIComponent(name)}`;
