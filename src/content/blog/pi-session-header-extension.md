---
title: '让每个模型请求都带上身份与会话'
description: '为 pi 客户端补一个扩展，让每次模型请求都带上固定的 User-Agent 和会话内稳定的会话标识，以满足上游按会话路由与缓存的需要。'
publishDate: '2026-10-13'
tags:
  - pi
  - agent
  - extension
language: '中文'
---

发往模型的请求，除了内容本身，还携带一组 HTTP 头。其中两个决定服务端能不能有效处理：一个用来表明客户端身份的 User-Agent，一个在每个对话里保持稳定的会话标识。

## 背景

pi 是一个跑在终端里的 coding agent，pi-web 是它的网页界面。它发出的模型请求不直接到模型，而是先经过一个中转网关，再由网关转发给上游。

这类上游通常在接入文档里对客户端提三个要求：发典型的 coding agent 流量；用客户端自己的 User-Agent，而不是某个通用 SDK 或 HTTP 库的默认名字；为每个对话发送一个稳定的会话标识（一个约定的请求头）。

前两条决定请求会不会被当成脚本或机器人挡掉，第三条决定请求能不能被有效路由、能不能命中提示缓存。对长对话来说，缓存命中与否直接体现在延迟和费用上。

pi 自身的做法只覆盖了一部分情况。它默认发的 User-Agent 是 `pi (linux ...; arm64)`，够用；但那个会话头，SDK 只在 provider 属于特定类型、或地址指向特定主机时才发。这里的 provider 配置不在这个范围里，所以它一直不发。

这就是这个扩展的出发点：与其为了迁就 SDK 的判断去改 provider 配置，或者每次手工补，不如让客户端对**每一次**模型请求都稳定地发出这两样东西。

## 为什么用扩展，而不是改源码

头的拼接发生在 SDK 内部。最直接的做法是改那几个 dist 文件，但有几个代价：SDK 在实际运行里同时存在两份副本（顶层一份、依赖里一份），改一份未必生效；任何一次升级或重装都会把这些改动抹掉；而且改动是全局的，会影响这台机器上所有用到该 SDK 的东西。

pi 提供了一个官方扩展点：`before_provider_headers`。它在所有头都拼好、HTTP 请求即将发出之前触发，事件对象就是那张头表。在这里写进去的值优先级最高。用它不动 SDK 文件，升级安全，作用范围也只在这一个 agent 会话里。

## 扩展做了什么

放进 `~/.pi/agent/extensions/`：

```ts
import { createHash } from 'node:crypto'
import type { ExtensionAPI } from '@earendil-works/pi-coding-agent'

export default function (pi: ExtensionAPI) {
  pi.on('before_provider_headers', (event, ctx) => {
    const id = ctx.sessionManager.getSessionId()
    const hash = createHash('sha256').update(id).digest('hex')
    for (const key of Object.keys(event.headers)) {
      if (['user-agent', 'x-opencode-session'].includes(key.toLowerCase())) delete event.headers[key]
    }
    event.headers['User-Agent'] = 'pi'
    event.headers['X-Opencode-Session'] = hash
  })
}
```

翻译：取当前会话 id 做一次 sha256；按大小写不敏感的方式先删掉同名旧头；再写入固定的 User-Agent 和会话哈希。

## 几个刻意为之的地方

**用哈希，不用原始会话 id。** 原始 id 带时间序，能顺着找到会话文件，没必要发出去。哈希在同一个会话内稳定，正好满足"每个对话一个稳定标识"。

**先删再写。** HTTP 头名大小写不敏感，但普通对象敏感。如果配置里已经有一个 `X-Opencode-Session`，直接再写一个 `x-opencode-session`，请求里会出现两份。所以先按小写匹配删掉。

**UA 固定成 `pi`。** 不写版本、不写系统信息，就是一个能表明身份的客户端名。

## 两点使用上的注意

扩展是在**创建会话时**加载的，已经在跑的会话不会重载，得新开一个才会带上。另外，pi-web 的子代理默认不加载这类扩展，子代理发的请求不会带这两个头；需要的话要单独处理。

## 结果

现在这个客户端发出的每一次模型请求——主对话、压缩、自动命名——都带着 `User-Agent: pi` 和一个会话内稳定的 `X-Opencode-Session`。要复现，把上面那个文件放进扩展目录，新开一个会话即可。
