---
title: 'Linux 桌面应用开机启动：XDG Autostart'
publishDate: '2026-09-13'
description: '简单记录 Linux 桌面环境中使用 XDG Autostart 设置应用登录自启的方法。'
tags:
  - Linux
  - XDG
  - Desktop
language: '中文'
draft: false
---

最近整理桌面环境时，顺手看了一下 Linux 桌面应用到底是怎么自启的。

如果只是想让一个普通 GUI 应用在登录桌面后自动运行，最通用的办法还是 XDG Autostart。它是 freedesktop.org 定义的一套桌面规范，与具体使用 GNOME、KDE 还是 niri 没有太大关系。

需要注意的是，这里说的“开机启动”其实不太准确。XDG Autostart 发生在**用户登录并启动桌面会话之后**，不是系统刚开机时。没有登录桌面，应用自然也不会启动。

## 自启文件放在哪里

XDG Autostart 使用 `.desktop` 文件描述要启动的应用，通常会读取下面两个目录：

```text
~/.config/autostart/
/etc/xdg/autostart/
```

第一个目录只影响当前用户，第二个是系统级配置，通常由软件包安装。日常自己添加自启项，放在 `~/.config/autostart/` 就够了。

最省事的做法，是从应用列表复制一份现成的 `.desktop` 文件：

```bash
mkdir -p ~/.config/autostart
cp /usr/share/applications/example.desktop ~/.config/autostart/
```

应用下一次登录时便会自动启动。

## 一个最小配置

如果应用没有现成的 `.desktop` 文件，也可以自己写：

```ini
[Desktop Entry]
Type=Application
Name=Example
Exec=/usr/bin/example
Terminal=false
```

真正决定启动命令的是 `Exec`。如果需要参数，直接写在后面：

```ini
Exec=remmina -i
```

常见字段不多：

- `Name`：显示名称。
- `Exec`：实际执行的程序和参数。
- `TryExec`：指定一个程序；程序不存在时跳过该自启项。
- `Terminal`：是否需要在终端中运行。
- `OnlyShowIn`：只在指定桌面环境中启动。
- `NotShowIn`：不要在指定桌面环境中启动。
- `Hidden=true`：禁用这个自启项。

例如，只希望它在 KDE 中运行：

```ini
OnlyShowIn=KDE;
```

用户目录和系统目录里如果出现同名文件，用户目录下的版本优先。这个特性也可以用来关闭系统提供的自启项：在 `~/.config/autostart/` 创建一个同名文件，并加入：

```ini
Hidden=true
```

这样不需要修改 `/etc/xdg/autostart/`，软件包升级时也不容易被覆盖。

## 到底是谁启动了应用

规范只规定文件放在哪里、字段如何解释，并不限定必须由哪个程序执行。

传统桌面环境一般由自己的会话管理器读取这些文件。现在不少环境会把这件事交给 systemd 用户实例：`systemd-xdg-autostart-generator` 把 `.desktop` 文件临时转换成用户服务，再由 `xdg-desktop-autostart.target` 启动。

可以在这里看到本次登录生成的服务：

```bash
find "$XDG_RUNTIME_DIR/systemd/generator.late" -maxdepth 1 -type f
```

如果刚修改文件却没有生效，最直接的验证方法还是退出桌面后重新登录。另外也可以检查文件内容和生成结果：

```bash
ls -l ~/.config/autostart /etc/xdg/autostart
systemctl --user status 'app-*@autostart.service'
```

总的来说，普通桌面应用使用 XDG Autostart 就足够了。它简单、跨桌面，也不会把应用和某个窗口管理器的配置绑死。需要失败重启、依赖关系或者更细的生命周期控制时，再考虑单独写 systemd 用户服务。

参考：[Desktop Application Autostart Specification](https://specifications.freedesktop.org/autostart/latest/)
