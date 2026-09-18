// scripts/font-list.mjs
// 字体清单：subset-fonts.mjs（切子集并生成 @font-face）与 check-fonts.mjs（校验漏字）共用。
//
// charset 决定这个字重带哪套字符集：
//   'text' —— 正文文楷，标点 + CJK 区段 + 站点用字
//   'mono' —— 等宽，只要标点；代码块里的中文靠字体栈回落到文楷，不必自己扛
//
// out 是**相对字体输出目录**的路径。输出目录由调用方给（dev → public/fonts，
// build → dist/fonts），所以这里不能再写死 public/ —— 写死的话构建期生成的那份
// 会落到 public/ 去，dist 里留下的反而是构建前就存在的旧字体。
//
// weight 300（Light）已移除：全站只有 home.astro 的 hero 两行用到，
// 却要单独背一份近 300 KB 的子集，已把这两行并入 400。
// 对应的 LXGWWenKaiGB-Light.ttf 与 LXGWWenKaiMonoGB-Light.ttf 也已从 fonts-src/ 删掉
// （Mono 只有 400 一档，LXGWWenKaiMonoGB-Medium.ttf 同样没用上）—— 三个文件约 80 MB，
// fetch-fonts.mjs 也只解这三个真正需要的成员。
export const fonts = [
  { family: 'LXGW WenKai', weight: 400, charset: 'text', name: 'LXGWWenKaiGB-Regular', src: 'fonts-src/LXGWWenKaiGB-Regular.ttf', out: 'wenkai-regular/wenkai-regular.woff2' },
  { family: 'LXGW WenKai', weight: 500, charset: 'text', name: 'LXGWWenKaiGB-Medium', src: 'fonts-src/LXGWWenKaiGB-Medium.ttf', out: 'wenkai-medium/wenkai-medium.woff2' },
  { family: 'LXGW WenKai Mono', weight: 400, charset: 'mono', name: 'LXGWWenKaiMonoGB-Regular', src: 'fonts-src/LXGWWenKaiMonoGB-Regular.ttf', out: 'wenkai-mono-regular/wenkai-mono-regular.woff2' },
];

/** 需要覆盖站点全部用字的字体（等宽那个只服务代码与日期，不管中文） */
export const textFonts = fonts.filter((f) => f.charset === 'text');

/**
 * name 是字体的 PostScript 名（`name` 表 nameID 6），实测与源 TTF 的文件名主干逐字相同。
 *
 * **不要拿它跟 family 比**：产出的 woff2 内部 nameID 1 是 `LXGW WenKai GB`，
 * 而 family 是 `LXGW WenKai` —— 两者本就不该相等。浏览器按 @font-face 的
 * 描述符匹配字体，跟文件内部叫什么无关，所以这个差异是无害的；
 * 但「顺手」把 CSS 里的 family 改成 `LXGW WenKai GB` 会让全站字体静默失效
 * （global.css 里 10 处用的都是 `LXGW WenKai`）。
 * name 真正的用途是校验「下到的是不是 GB 变体」—— GB 与非 GB 的字形不一样，
 * 光看文件名区分不出来。
 */
