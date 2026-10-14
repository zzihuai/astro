---
title: '面板读不了图表和公式，得从扩展外面补'
description: '代码编辑器的对话面板不渲染 mermaid 图表和 LaTeX 公式，扩展包体里也没有相关依赖。记录从扩展外面补上渲染能力的做法：注入点选在哪、流式输出怎么处理、怎么保证改坏了能退回去。'
publishDate: '2026-10-14'
tags:
  - vscode
  - mermaid
  - katex
  - claude-code
language: '中文'
---

在代码编辑器的对话面板里贴一段流程图源码，它会一直原样显示。数学公式也一样，`$...$` 直接当普通文本打出来。

## 背景

编辑器是 VS Code，面板是 Claude Code 扩展的聊天窗。它不是普通的编辑器标签，而是一个 webview——编辑器里嵌的网页，界面和内容渲染都由扩展自己打包的那份 JS 管。

图表用 mermaid 写，一种用文本描述流程图、时序图的标记语言。公式走 LaTeX 语法。

翻扩展的包体（`webview/index.js`，4.8 MB），搜 `mermaid`、`katex`、`mathjax`、`remark-math`、`rehype-katex`，全是 0 次。Markdown 引擎是 `marked`，只把文本转成 HTML。设置项里也没有渲染相关的键。官方那条要求渲染 mermaid 的 issue 已被 stale bot 以 not planned 关闭。

这不是配置没开，是扩展里根本没有这个渲染器。

## 代价

不解决的话，每张调用链图都要把源码复制到别的窗口才能看，每个公式都要在脑子里还原成分式。这种情况不频繁，但每次出现都要中断一次阅读。

## 备选

| 做法 | 覆盖 | 代价 |
| --- | --- | --- |
| 落到文件、用预览面板看 | 公式 + 图表 | 每张图多一次另存切窗口，还要占一个面板位 |
| 用现成的补丁扩展 | 只有公式 | 改写官方扩展包体，升级即失效 |
| 往 webview 包尾追加脚本 | 只有图表 | 同上 |

编辑器预览面板本身就内置了 mermaid（VS Code 1.141 的 `mermaid-markdown-features`）和公式（`markdown-math`），配置不用改就能渲染，是成本最低的一条。它被排在前面的原因是使用方式——图在面板里读不了、换个窗口再读一遍，问题只是换了个地方发生。

公式那一半有现成的：`nuriyev.claude-code-katex` 把 `remark-math`、`rehype-katex` 接进官方的 Markdown 解析管线。图表没有现成方案，只能自己注入。

## 实现

### 挂在渲染器的两个组件上，不改 Markdown 管线

面板正文由一个 React 的 Markdown 渲染器产出，它把每种 Markdown 元素映射成一个组件，代码块对应 `pre` 和 `code` 两个。注入从这两个组件的调用点下手：包一层，命中 mermaid 围栏时返回一个占位 `div`，其余原样透传。占位 `div` 上带一个源码 hash，等 React 提交之后由 MutationObserver 找到，调 mermaid 渲染成 SVG 塞回去。

没有被改动的是 Markdown 的插件管线——公式补丁改的正是那里，往 `remarkPlugins`、`rehypePlugins` 里塞解析插件。两条路各改各的，互不干扰。

定位这两个调用点用 acorn 把包体解析成语法树再找，不用字符串匹配。包体是压缩过的，变量名每次构建都不一样，字符串匹配换个版本就失效。

需要注意的是 mermaid 的产物格式：`mermaid.min.js` 是 esbuild 打的 ESM→全局包，模块命名空间挂在顶层的 `var __esbuild_esm_mermaid_nm` 上，最后一行再从 `globalThis` 把它取回来挂成 `globalThis.mermaid`。整段追加进文件时如果包进立即执行函数（IIFE），这个 `var` 就成了函数局部变量，`globalThis` 上没有，最后一行读到 undefined 直接抛错，后面的运行时一行都跑不到。让局部变量和全局对象指向同一个引用即可。

### 流式输出要先等内容静默

面板正文是流式追加的，围栏里的内容每个 token 都在变，直接渲染会碰到围栏还没闭合的中间态。所以加了 400ms 的 debounce，等内容静默下来再渲染；已渲染的 SVG 按源码 hash 缓存，同一份源码只渲染一次。

渲染失败时回退成把原始源码显示出来。包装器是用 `div` 替换掉原代码块的，失败时如果留空，内容会整块消失。

还有一处要关掉：mermaid 渲染失败时默认会自己画一张写着 "Syntax error in text" 的图。因为调用时没传容器，它会挂到 `document.body` 上，跟失败位置脱节，擦不掉。配置里加 `suppressErrorRendering: true` 关掉。

### 写坏了就是白屏，所以每一步都要能退回去

注入直接改官方扩展的包体，改坏了整块面板白屏。安装脚本按这个前提写：

- 用 acorn 找到调用点才动手，找不到就拒绝写盘
- 先备份原文件
- 写盘走临时文件加 rename
- 落盘之后再解析一遍语法，不过就立刻从备份还原

### 尺寸压到六成，点开看原尺寸

mermaid 产出的根节点是 `width="100%"` 加 `style="max-width: Npx"`，只限宽、不限高。一个竖着排八个节点的流程图，宽 500 高 900，按 1:1 铺开就占满整屏。

缩略图给容器设 `max-width: 60%` 就够——`viewBox` 在，缩小是矢量的，不会糊。看原尺寸另做了一个覆盖层：滚轮缩放加拖拽平移，缩放时按光标位置反解世界坐标再回代，保证光标下那个点不动。

## 装和还原各一条命令

两个补丁装完重载窗口，公式渲染成排版、围栏变成图。注入脚本在 `tools/cc-mermaid-render/`：

```sh
node install.js            # 注入；扩展升级后重打
node install.js --check    # 只看当前状态
node install.js --restore  # 从备份还原
```

改写的是官方扩展的文件，扩展一升级就会被覆盖，重跑一次 `install.js` 即可。备份和还原命令留着，出问题能退回去。
