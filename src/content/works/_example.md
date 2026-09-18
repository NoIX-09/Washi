---
name: 示例作品
desc: 一句话说明这件作品是做什么的。
icon: ph:cube-duotone
order: 1
github: https://github.com/example/example
release: https://github.com/example/example/releases
links:
  - label: 在线演示
    url: https://example.com
    icon: ph:monitor-duotone
---

# 示例作品

> 这里是作品自述的引言，引用块样式。

正文用 Markdown 写，会在作品详情页渲染。这一段换成你自己的项目介绍即可。

## frontmatter 字段说明

| 字段 | 作用 |
| --- | --- |
| `name` | 作品名，列表卡片与详情页标题都用它 |
| `desc` | 一句话简介，显示在列表卡片上 |
| `icon` | 列表卡片的图标，写 [ph 图标](https://phosphoricons.com/)名 |
| `order` | 列表排序，小的在前；不写则排在最后 |
| `github` / `release` | 会自动生成对应的按钮，不写则不显示 |
| `links` | 自定义相关链接，`icon` 同样写 ph 图标名 |
| `live2d` | 写 `true` 会在正文顶部摆一座 Live2D 展示台 |

## 站内链接

`links` 里的 `url` 允许以 `/` 开头写站内路径，也可以写 http(s) 绝对地址。只有外链才会新开标签页。

## Live2D 展示台

frontmatter 里写 `live2d: true`，详情页正文右上角会浮起一座展示台，正文自动绕排到左侧。
