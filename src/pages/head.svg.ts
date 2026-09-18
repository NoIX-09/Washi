/**
 * /head.svg —— 友链互抄用的占位头像。
 *
 * 为什么需要它：`MY_FRIEND_AVATAR` 要的是一个**长期稳定、能被别人抓取**的地址，
 * 而站内展示走的 `astro:assets` 路径每次构建都带新哈希，不能对外。所以自建站的人
 * 得另找一份公开的图 —— 但模板默认值总得指向一个**真的存在**的东西，否则
 * 「交换友链」那张卡会把一个死路径印出来给人抄（friends.astro 里 `{myFriendInfo.avatar}`
 * 是当文本渲染的，那是那张卡存在的意义）。所以这里生成一张占位图顶上。
 *
 * 换成自己的头像：在 `.env` 里设 `MY_FRIEND_AVATAR=https://你的域名/xxx.webp`
 * 即可，不需要动这个文件。图片要求是公开可访问的绝对地址。
 *
 * 颜色为什么写死两套而不是读 CSS 变量：这个 SVG 是被 `<img>` 加载的，
 * 独立文档、拿不到页面的 CSS 变量，也读不到 `<body>` 上的暗色 class。
 * 能做到的最接近的事是 `prefers-color-scheme` —— 它问的是**系统**偏好，
 * 所以用户手动把站点切到暗色而系统还是浅色时，这张图会跟页面不一致。
 * 占位图不值得为这点差异引入更多机制，颜色由 theme.json 的 page / accent 生成，
 * 改配色时这里跟着变。
 */
import { color } from '../theme';

const avatar = (bg: string, fg: string) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 96 96" width="96" height="96" role="img" aria-label="avatar">
<style>
  .bg { fill: ${bg} }
  .fg { fill: ${fg} }
  @media (prefers-color-scheme: dark) {
    .bg { fill: ${color('page', 'dark')} }
    .fg { fill: ${color('accent', 'dark')} }
  }
</style>
<rect class="bg" width="96" height="96"/>
<circle class="fg" cx="48" cy="37" r="15"/>
<path class="fg" d="M48 58c-16 0-29 11-29 25v13h58V83c0-14-13-25-29-25z"/>
</svg>
`;

export function GET() {
  return new Response(avatar(color('page'), color('accent')), {
    headers: { 'Content-Type': 'image/svg+xml' },
  });
}
