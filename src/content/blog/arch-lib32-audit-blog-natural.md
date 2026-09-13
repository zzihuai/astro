---
title: 'Archlinux pacman 小错误'
publishDate: '2025-08-23'
updatedDate: '2025-08-23'
description: 'pacman的阴间错误排查'
tags:
  - Arch,linux
language: 'English'
---
# Arch 更新被 `lib32-audit` 卡住了，最后发现坑根本不在镜像

今天照常跑了一下：

```bash
sudo pacman -Syu
```

然后更新直接被卡住：

```text
:: 安装 audit (4.2.1-1) 破坏依赖 'audit=4.1.4' （lib32-audit 需要）
```

前面还顺手弹了个：

```text
:: 有 128 个软件包可提供 tessdata：
```

刚看到的时候我还以为是 `tessdata` 搞出来的什么依赖问题，后来发现完全不是一回事。真正卡住更新的是 `audit` 和 `lib32-audit`。

看报错很直观：仓库里的 `audit` 要升到 `4.2.1-1`，但我机器上的 `lib32-audit` 还要求：

```text
audit=4.1.4
```

所以 pacman 不让升。

这种情况第一反应当然是镜像没同步好。Arch 滚动更新里 core 和 multilib 如果刚好不同步，确实很容易出现这种版本对不上的情况。

于是我先把 mirror 换成了：

```ini
Server = https://geo.mirror.pkgbuild.com/$repo/os/$arch
```

然后：

```bash
sudo pacman -Syyu
```

结果还是一样。

这就有点奇怪了。

我又去看 `[multilib]` 有没有开，配置是正常的：

```ini
[multilib]
Include = /etc/pacman.d/mirrorlist
```

`IgnorePkg` 里也没有 `lib32-audit`。

到这里我还在想，会不会是本地数据库坏了，或者 multilib 的同步有什么问题。

后来跑了一句：

```bash
pacman -Si lib32-audit
```

结果：

```text
错误：软件包 'lib32-audit' 未找到
```

这才发现事情不对。

因为我本地明明装着这个包。

```bash
pacman -Q lib32-audit
```

能正常看到旧版本，但 `pacman -Si` 却说仓库里没有。

也就是说现在的状态其实是：

```text
本机：
lib32-audit 4.1.4
└── 依赖 audit=4.1.4

仓库：
audit 4.2.1
lib32-audit：没了
```

所以 pacman 也挺无辜的。

它想升级 `audit`，但本机还躺着一个旧的 `lib32-audit`，这个包又死死要求旧版 `audit`。与此同时，仓库里已经没有新版 `lib32-audit` 可以一起升级。

最阴的是，我去看一些 Arch mirror 的目录时，甚至还能看到：

```text
lib32-audit-4.2.1-1-x86_64.pkg.tar.zst
```

一开始看到这个我更懵了：

> 包不是还在吗？

后来才反应过来，mirror 目录里还有文件，不代表这个包还在仓库数据库里。

pacman 真正认的是仓库数据库，不是 HTTP 目录里有没有那个 `.pkg.tar.zst`。

所以会出现一种非常迷惑的情况：

```text
浏览器看 mirror：包文件还在

pacman -Si：查无此包
```

文件只是还没从镜像服务器上清掉而已。

继续往下查才发现，Arch 最近把一批已经没有官方包依赖的 multilib 包移出了官方仓库，`lib32-audit` 正好就在这条旧依赖链里面。

我机器上大概还残留着：

```text
lib32-libcap
└── lib32-pam
    └── lib32-audit
        └── audit
```

于是跑：

```bash
pactree -r lib32-audit
```

看了一下反向依赖，确认这几个包已经没有什么实际用途了。

最后直接把这条残留依赖链清掉：

```bash
sudo pacman -Rns lib32-libcap
```

pacman 顺手把已经没人需要的：

```text
lib32-libcap
lib32-pam
lib32-audit
```

一起删掉。

然后重新：

```bash
sudo pacman -Syu
```

更新立刻正常了。

---

现在回头看，这个问题其实不复杂，但现象特别容易把人往“镜像没同步”这个方向带。

尤其是这几个条件同时出现：

```text
multilib 正常开启
geo mirror 也换了
本地确实装着 lib32-audit
mirror 目录里甚至还有 lib32-audit 的包文件
但 pacman -Si 就是查不到
```

正常人第一眼很难想到：

> 哦，原来这个包已经被 Arch 从仓库数据库里踢出去了，只是我的系统和部分镜像目录里还留着尸体。

以后再碰到这种“某个已安装包卡住系统更新，但 `pacman -Si` 又查不到它”的情况，我应该会先跑：

```bash
pacman -Qm
```

看看有哪些本机安装、但已经不在同步仓库里的包。

再用：

```bash
pactree -r 包名
```

看看到底还有谁依赖它。

这次真正有用的其实就这两步。

至于开头那个 128 个 `tessdata`，纯属烟雾弹，和这次问题没什么关系。

总之，这次不是镜像炸了，不是 multilib 没开，也不是 pacman 数据库坏了。

只是一个已经被 Arch 移出仓库的旧 `lib32-audit`，还留在我机器上，抱着 `audit=4.1.4` 不撒手，然后把整个系统更新堵住了。

挺阴的。
