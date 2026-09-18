---
title: 示例文章
desc: 一句话摘要，会显示在文章列表和搜索结果里。
date: "2026-01-01"
links:
  - label: 示例链接
    url: https://example.com
    icon: ph:link-duotone
---

# 示例文章

正文用 Markdown 写。这一段换成你自己的内容即可。

## frontmatter 字段说明

| 字段 | 作用 |
| --- | --- |
| `title` | 文章标题 |
| `desc` | 一句话摘要，列表与搜索都用它 |
| `date` | 日期，**必须加引号**写成 `"2026-01-01"` |
| `links` | 相关链接，与作品详情页共用同一套按钮样式 |
| `style` | 可选，本篇专属 CSS，注入后作用于正文 `.post-body` |

`date` 不加引号会被 YAML 解析成日期对象，与 schema 要求的字符串对不上，构建直接报 `InvalidContentEntryDataError`。

## 正文支持的语法

| 语法 | 写法 |
| --- | --- |
| 粗体 | `**粗体**` |
| 行内代码 | `` `code` `` |
| 链接 | `[文字](https://example.com)` |

```js
console.log('代码块');
```

> 引用块。
