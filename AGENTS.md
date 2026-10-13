# astro_pure 写作与开发约定

本仓库是用 Astro 5 + astro-pure 主题搭建的个人博客，静态输出，部署到 GitHub Pages 子路径
`https://zzihuai.github.io/astro`（见 `astro.config.ts` 的 `site` 与 `base = '/astro'`）。
日常任务以**写博客文章**为主，其次才是调整主题。

## 目录结构

| 路径 | 职责 |
| --- | --- |
| `src/content/blog/` | 博客文章，`**/*.{md,mdx}` 自动成为 collection 条目 |
| `src/content/docs/` | 主题自带文档，路由前缀 `/docs` |
| `src/content.config.ts` | 两个 collection 的 frontmatter schema，**写作规则的权威来源** |
| `src/site.config.ts` | 站点信息：标题、菜单、社交、Waline 评论、mediumZoom、分享按钮 |
| `src/layouts/` | 页面骨架：`BaseLayout`、`BlogPost`、`ContentLayout`、`CommonPage`、`IndividualPage` |
| `src/pages/` | 路由：`blog/[...id].astro`（文章页）、`blog/[...page].astro`（列表分页）、`tags/`、`rss.xml.ts` |
| `src/components/` | 本站自定义组件（首页、友链、项目、Waline、文章内嵌 demo） |
| `src/plugins/` | 本站 markdown / Shiki 插件（补 base 前缀、标题锚点、代码块增强） |
| `public/` | 原样输出的静态资源：`favicon/`、`images/social-card.png`、`icons/`、`links.json` |
| `packages/pure/` | 主题本体（workspace 包，包名 `astro-pure`）；组件从 `astro-pure/user`、`astro-pure/advanced` 引入 |
| `preset/` | 可复制的素材（图标、示例组件、头像缓存脚本），不参与依赖图 |

`packages/pure` 由 workspace 链接到 `node_modules/astro-pure`，所以改它就是改主题本体，升级上游
时会冲突。写文章用不到它；只有当主题组件本身有问题时才动。

## 新建文章

```shell
bun pure new "文章标题"          # 生成 src/content/blog/<slug>.md，自带 frontmatter 骨架
bun pure new -f "文章标题"       # -f 生成 <slug>/index.md 文件夹式，适合带配图的文章
bun pure new -m "文章标题"       # -m 用 .mdx，需要内嵌组件时选它
```

生成的 frontmatter 只包含 `title` / `description` / `publishDate` / `tags`，其余字段按需手写。

> 已知不一致：CLI 的 `-l <lang>` 写入的是 `lang:`，而 schema 定义的是 `language:`。
> 需要 `language` 时不要用 `-l`，生成后手动补 `language: '中文'`。

文章的摆放有两种，按是否带资源选择：

- 无独立资源：单个文件 `src/content/blog/my-post.md`
- 有配图：建同名文件夹，正文命名为 `index.md` 或 `index.mdx`，配图与正文同目录

**文件名（或文件夹名）就是 URL slug**，`src/content/blog/linux-xdg-autostart/index.md` 对应
`/blog/linux-xdg-autostart`。改名即改链接，且没有重定向。

`/src/content/blog/test.*` 与 `demos/`、`image-insertion-test/` 已在 `.gitignore` 中，适合放临时草稿。

## frontmatter

`title`、`description`（都受长度上限约束）与 `publishDate` 是必填项，其余可选。
字段与约束以 `src/content.config.ts` 为准，下表是它的转述：

| 字段 | blog | docs | 约束与行为 |
| --- | --- | --- | --- |
| `title` | 必填 | 必填 | 字符串，≤ 60 字符 |
| `description` | 必填 | 必填 | 字符串，≤ 160 字符 |
| `publishDate` | 必填 | 可选 | `z.coerce.date()`，可写 `2026-05-06 10:00:00` 或 `'May 10, 2025'` |
| `updatedDate` | 可选 | 可选 | 参与排序与归档年份，取 `updatedDate ?? publishDate` |
| `heroImage` | 可选 | 无 | 对象 `{ src, alt?, inferSize?, width?, height?, color? }`，`src` 由 `image()` 校验 |
| `tags` | 可选 | 可选 | 默认 `[]`，**自动转小写并去重** |
| `language` | 可选 | 无 | 纯展示字段，中文文章写 `'中文'` |
| `draft` | 可选 | 可选 | 默认 `false`；`true` 时仅开发环境可见 |
| `comment` | 可选 | 无 | 默认 `true`，设为 `false` 关闭该篇评论 |
| `order` | 无 | 可选 | 默认 `999`，docs 侧边栏按它升序排 |

**没有** `category`，也**没有** `pinned`，不要臆造这两个字段；分类需求用 `tags` 表达。

blog 文章可用的完整骨架：

```yaml
---
title: '文章标题'                                        # 必填，≤ 60 字符
description: '一句话摘要，用于列表页与 SEO'                # 必填，≤ 160 字符
publishDate: 2026-05-06 10:00:00                        # 必填，任意可被 Date 解析的写法
updatedDate: 2026-05-20                                 # 可选，改了它文章会重新排到列表前面
tags:                                                   # 可选，会被转成小写并去重
  - Linux
language: '中文'                                         # 可选，仅用于展示
heroImage: { src: './thumbnail.jpg', color: '#A8C7D9' }  # 可选，src 必须是文章同目录的相对路径
draft: false                                            # 可选，true 时只有 dev 能看见
comment: true                                           # 可选，false 关闭本篇评论
---
```

`draft: true` 的过滤发生在 `packages/pure/utils/server.ts` 的 `getBlogCollection()`：生产构建时
`getCollection` 的过滤函数直接把它剔除，所以草稿在 `bun run build` 的产物里不存在，只在
`bun dev` 可见。列表排序按 `updatedDate ?? publishDate` 倒序。

## 图片与静态资源

- **封面图与正文配图都放文章自己的目录**，用相对路径引用。`heroImage.src` 走 Astro `image()`
  校验，写 `./thumbnail.jpg` 这种相对路径即可，构建时自动优化。
- 正文图片直接写 `![说明文字](./gallery-1.jpg)`。所有正文图片会被 `remarkAddZoomable` 加上
  `zoomable` 类，配合已开启的 mediumZoom 自动获得点击放大灯箱。
- **远程图片**需要额外给出尺寸信息：`heroImage: { src: 'https://…', inferSize: true }`，或显式写
  `width` / `height`。同时 `astro.config.ts` 的 `image.remotePatterns` 目前只放行 `**.rshah.org`，
  其它域名的远程图需要先把它加进白名单，否则构建失败。
- **不要**把文章配图放进 `public/` 或 `src/assets/`。`src/assets/` 是主题资源（头像、项目截图、
  工具图标、样式），供 `.astro` 组件 `import` 使用。
- `public/` 下的路径会被 `src/plugins/rehype-add-base-to-public-assets.ts` 自动补上 `/astro` 前缀，
  所以正文里写 `/icons/xxx.svg` 就好，**不要手写 `/astro/...`**。
- 图片下方自动生成 `<figcaption>` 图注的功能默认关闭（`site.config.ts` 里 `imageCaption: true`
  被注释掉，`packages/pure/index.ts` 只在开启时注册该插件）。当前 `alt` 只用于无障碍与灯箱。

## Markdown 能力清单

| 能力 | 支持 | 写法 |
| --- | --- | --- |
| 数学公式 | ✅ | 行内 `$E=mc^2$`，块级 `$$…$$`（`remarkMath` + `rehypeKatex`） |
| 代码块标题 | ✅ | ` ```ts title="src/site.config.ts" ` |
| 代码 diff | ✅ | 行尾 `// [!code ++]` 与 `// [!code --]` |
| 代码高亮 | ✅ | 行尾 `// [!code highlight]` 高亮本行，`// [!code hl:3]` 从本行起高亮 3 行 |
| 长代码折叠 | ✅ | 超过 15 行自动出现折叠按钮 |
| 复制按钮 | ✅ | 自动生成 |
| 标题锚点 | ✅ | 自动追加 `#` 锚点链接 |
| 外链提示 | ✅ | 自动加 ` ↗`、`target="_blank"`、`rel="nofollow noopener noreferrer"` |
| 表格横向滚动 | ✅ | 自动包一层 `overflow-x-auto` 容器 |
| 提示块 `Aside` | 仅 `.mdx` | `import { Aside } from 'astro-pure/user'` → `<Aside type='tip'>…</Aside>` |
| `Tabs` / `Steps` / `Timeline` / `Spoiler` / `Collapse` | 仅 `.mdx` | 从 `astro-pure/user` 引入 |
| `GithubCard` / `LinkPreview` / `Quote` / `QRCode` | 仅 `.mdx` | 从 `astro-pure/advanced` 引入 |
| `:::note` / `:::tip` 指令 | ❌ | 没有接入 directive 插件，`packages/pure/index.ts` 里那行 restoration 是注释掉的 |
| `::github{repo="…"}` | ❌ | 同上，GithubCard 只能当组件在 `.mdx` 里用 |
| Mermaid | ❌ | 没有 mermaid 插件，` ```mermaid ` 只会被当作普通代码高亮，不会画图 |
| `ins=` / `del=` 代码块元信息 | ❌ | 用 `[!code ++]` / `[!code --]` 代替 |

`.md` 支持 GFM 的常规语法（表格、脚注、任务列表、删除线、`<details>`、`<kbd>` 等）以及上表的
代码块增强与公式；**唯一不能在 `.md` 里用的是组件**，需要组件就改名为 `.mdx`。

## 写作红线

1. 组件只能在 `.mdx`（或 `.astro`）里使用，且必须从 `astro-pure/user`、`astro-pure/advanced`
   import；没有 auto-import，`.md` 里写了不会被解析。
2. 不要使用 `:::` 提示块指令、`::github{…}`、`inferSize` 之外的远程图、`ins=`/`del=` 元信息、
   Mermaid 图——这些在本仓库都不生效。
3. 不要在正文和 frontmatter 里手写 `/astro` 前缀；本地图走相对路径，public 资源由 rehype 插件补前缀。
4. `tags` 会被转成小写并去重，`React` 与 `react` 是同一个标签，不要指望用大小写区分。
5. 文章文件名即 URL，改名前先想清楚链接会不会失效。
6. 不要给收藏/置顶臆造 `pinned`、`category` 字段。
7. 写中文文章时 `language: '中文'`；`title` / `description` 的长度上限按字符数算，中文同样受 60 / 160 限制。

## 本地验证与发布

```shell
bun install          # 安装依赖（项目用 bun，存在 bun.lock；不要用 npm/yarn 生成别的锁文件）
bun dev              # 开发服务器，本地地址也带 /astro 前缀
bun run build        # 依次跑 astro-pure check、astro check、astro build，frontmatter 错误在这一步暴露
bun format           # prettier 格式化（printWidth 100、单引号、无分号）
bun lint             # eslint --fix
```

改完文章至少跑一次 `bun run build`：`astro check` 会校验 frontmatter 与类型，比在页面上肉眼找错快。

发布即 `git push` 到 `main`，`.github/workflows/deploy.yml` 用 `withastro/action` + bun 构建并部署到
GitHub Pages。仓库已配置 `base = '/astro'`，本地预览时 URL 要带该前缀，否则会 404。

## 修改主题代码时

写文章不涉及本节，仅在需要改主题时参考。

- 站点信息、菜单、社交、评论开关：改 `src/site.config.ts`
- 文章页版式（TOC、版权、评论位置）：改 `src/layouts/BlogPost.astro`
- markdown 渲染管线（新增 rehype/remark 插件、代码块行为）：改 `astro.config.ts` 与 `src/plugins/`
- 新增/修改 frontmatter 字段：改 `src/content.config.ts`，并同步更新 `src/content/docs/` 里的写作文档
- 颜色与圆角统一取 `src/assets/styles/app.css` 里的 CSS 变量，UnoCSS 通过 `hsl(var(--…))` 映射；
  不要写死颜色值
- 单篇文章的排版需求优先在文章里用既有组件解决，不要为它改 `packages/pure` 的公共组件
