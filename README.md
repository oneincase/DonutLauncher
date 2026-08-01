<div align="center">

# 甜甜圈启动台 (Donut Launcher)

macOS 圆形应用启动器 · Electron + SVG 渲染

![macOS](https://img.shields.io/badge/macOS-10.13%2B-black?logo=apple&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-31-blue?logo=electron&logoColor=white)
![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)
![JavaScript](https://img.shields.io/badge/Language-JavaScript-F7DF1E?logo=javascript&logoColor=black)

</div>

<p align="center">
  <img src="docs/screenshot.png" width="480" alt="甜甜圈启动台界面截图">
</p>

## 简介

甜甜圈启动台（Donut Launcher）是一个面向 macOS 的圆形应用启动器：应用图标沿同心圆环排列，按下全局快捷键即可唤出，输入文字实时搜索，回车启动应用。项目基于 Electron 构建，启动台界面完全由 SVG 绘制，支持无边框透明窗口、托盘菜单、收藏与隐藏应用，以及一套完整的可视化设置面板。

启动台默认扫描 `/Applications` 和 `~/Applications`，递归查找 `.app` 应用包，解析 `Info.plist` 与中文本地化名称，并提取应用图标做磁盘缓存。所有设置通过 `electron-store` 持久化，退出后再次打开会恢复上次的圆环颜色、排序方式和自定义快捷键。

> 当前项目处于早期开发阶段，界面、设置项与内部接口可能随版本调整。

## 功能特性

- **环形布局**：根据应用数量自动生成同心圆环，应用越多圆环越多；窗口尺寸随应用数量、当前显示器空间动态调整
- **全局快捷键**：默认 `Option+Space` 唤出/隐藏，可在设置面板中录制新的快捷键
- **实时搜索**：输入即过滤，80ms 防抖；同时匹配应用英文原名与中文显示名
- **键盘/鼠标操作**：方向键移动选中项，`Enter` 启动，`Esc` 隐藏；鼠标悬停显示应用名，点击直接启动
- **收藏与隐藏**：图标右上角星标收藏、左上角 `×` 隐藏应用；设置页可取消隐藏
- **缓慢旋转**：圆环默认缓慢旋转，鼠标悬停时自动暂停，图标本体保持水平
- **中文友好**：优先读取 `InfoPlist.strings` 中的本地化名称，内置系统应用中文名表，并按 `zh-CN` 排序
- **图标处理**：优先提取 `.icns` 内嵌 PNG，无法解析时用 `sips` 转换兜底；64px 图标缓存到磁盘，避免重复解码
- **托盘常驻**：菜单栏托盘提供显示/隐藏、打开设置、退出；窗口失焦自动隐藏，后台保持运行
- **多显示器**：窗口始终出现在光标所在显示器的工作区中央
- **设置持久化**：圆环颜色、透明度、粗细、旋转速度、图标大小、排序方式、扫描路径等全部可配置
- **安全默认值**：开启 `contextIsolation`、关闭 `nodeIntegration`、设置 CSP，并拦截渲染进程新开窗口
- **工程化工具**：内置单元测试、界面截图验证和资源占用测量脚本

## 快速开始

### 环境要求

- macOS 10.13+（建议使用较新系统）
- [Node.js](https://nodejs.org/) 20+（开发环境使用 Node 24）
- [pnpm](https://pnpm.io/) 11+（仓库通过 `pnpm-workspace.yaml` 管理 Electron 构建脚本授权）

### 安装与启动

```bash
pnpm install
pnpm start
```

首次启动会扫描 `/Applications` 和 `~/Applications`，随后应用常驻后台。按 `Option+Space` 唤出/隐藏启动台，点击圆心的甜甜圈打开设置，通过托盘菜单可以显示/隐藏窗口、打开设置或退出。

### 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm start` | 以普通模式启动 |
| `pnpm dev` | 开发模式启动，并打开 DevTools |
| `pnpm reset` | 启动时清除全部设置并恢复默认值 |
| `pnpm test` | 运行全部单元测试 |
| `pnpm verify` | 渲染界面并保存截图，同时校验图标数量与搜索框状态 |
| `pnpm measure` | 测量扫描、加载、显示/隐藏时的内存与 CPU 占用 |
| `pnpm build:mac` | 使用 electron-builder 打包 macOS DMG |

## 使用指南

### 唤起与隐藏

- 按全局快捷键（默认 `Option+Space`）在显示与隐藏之间切换
- 点击菜单栏托盘图标也可切换；从托盘菜单可打开设置或退出
- 窗口失焦后自动隐藏，隐藏超过 60 秒会自动销毁窗口以释放渲染进程资源

### 选择与启动

- 鼠标悬停图标会显示应用名，点击直接启动
- 方向键移动选中项，`Enter` 启动当前项，`Esc` 隐藏窗口
- 启动应用后窗口自动隐藏，并在“最近使用”中记录时间

### 搜索

- 按 `Command+F` 显示或隐藏搜索框
- 显示搜索框后输入文字即可实时过滤应用
- 支持应用原名（如 `Books`）和中文显示名（如 `图书`）搜索
- 隐藏窗口后搜索词会自动清空

### 收藏与隐藏应用

- 悬停图标后点击右上角星标收藏；再次点击取消收藏
- 悬停图标后点击左上角 `×` 隐藏该应用
- 在设置面板“应用”页可以逐个取消隐藏，或一键取消全部隐藏

### 设置面板

设置面板包含三个页签：

**启动**

- 录制全局快捷键
- 选择圆心图片（支持任意本地图片）或恢复默认甜甜圈图
- 调整圆心图片大小

**外观**

- 调整圆环透明度、粗细、旋转速度与选中放大比例
- 使用预设色、自定义 HSL/Hex 颜色添加圆环颜色，拖动色块调整顺序
- 开关缓慢旋转
- 选择排序方式：名称、最近使用、收藏优先

**应用**

- 查看默认扫描路径
- 添加/移除自定义扫描目录
- 管理已隐藏应用
- 手动刷新应用列表

## 数据存储

设置、日志与应用图标缓存均保存在 Electron 的 `userData` 目录中。开发模式下的默认位置：

```text
~/Library/Application Support/DonutLauncher/
├── config.json        # electron-store 设置
├── icon-cache/        # 应用图标磁盘缓存
└── logs/main.log      # 主进程日志
```

打包安装版使用 `productName`（“甜甜圈启动台”）作为目录名。运行 `pnpm reset` 会清空设置并恢复默认值；也可以直接删除 `config.json`。

主要设置项：

| 设置项 | 默认值 | 说明 |
| --- | --- | --- |
| `scanPaths` | `['/Applications', '~/Applications']` | 应用扫描目录 |
| `ringColors` | `['#FF6B9D', '#4ECDC4', '#FFE66D']` | 圆环颜色列表 |
| `ringOpacity` | `0.45` | 圆环透明度 |
| `ringStrokeWidth` | `2` | 圆环粗细 |
| `shortcut` | `Option+Space` | 全局快捷键 |
| `centerIconPath` | `''` | 自定义圆心图片，空表示使用默认图片 |
| `centerIconSize` | `56` | 圆心图片大小 |
| `enableRotation` | `true` | 是否缓慢旋转 |
| `rotationSpeed` | `1` | 旋转速度（0-3） |
| `iconScale` | `1.25` | 选中/悬停图标放大比例 |
| `favorites` | `[]` | 收藏应用 id 列表 |
| `sortMode` | `name` | 排序方式：`name` / `recent` / `favorites` |
| `recentUsage` | `{}` | 应用最近使用时间记录 |
| `excludedApps` | `[]` | 隐藏的应用名列表 |

## 项目结构

```text
.
├── build/                       # electron-builder 打包资源（icon.icns 等）
├── src/
│   ├── main/                    # Electron 主进程
│   │   ├── index.js             # 窗口、托盘、全局快捷键与生命周期
│   │   ├── app-scanner.js       # 应用扫描、plist 解析、图标提取与缓存
│   │   ├── app-launcher.js      # 启动应用
│   │   ├── ipc-handlers.js      # IPC 处理器与应用列表缓存
│   │   ├── settings.js          # electron-store 设置封装
│   │   ├── settings-schema.js   # 设置项定义与默认值
│   │   ├── window-size.js       # 动态窗口尺寸计算
│   │   ├── icns-utils.js        # .icns 图标提取
│   │   ├── async-utils.js       # 并发工具 mapLimit
│   │   ├── logger.js            # 主进程日志
│   │   └── tests/               # 主进程单元测试
│   ├── preload/
│   │   └── index.js             # contextBridge 安全桥
│   ├── renderer/
│   │   ├── index.html           # 启动台与设置面板 UI
│   │   ├── styles.css           # 透明窗口与 SVG 样式
│   │   ├── renderer.js          # 渲染与交互逻辑
│   │   ├── donut-layout.js      # 环形布局算法
│   │   ├── app-list-utils.js    # 过滤、排序、选择工具
│   │   └── *.test.js            # 渲染层单元测试
│   └── public/                  # 内置资源（默认圆心图片等）
├── tools/
│   ├── verify-screenshot.js     # 界面渲染验证与截图
│   └── measure-resources.js     # 性能与资源占用测量
├── docs/
│   └── screenshot.png           # README 示例截图
├── pnpm-workspace.yaml          # pnpm 配置
├── pnpm-lock.yaml
├── LICENSE                      # Apache-2.0
└── package.json
```

## 架构说明

### 进程划分

- **主进程（`src/main`）**：负责窗口管理、全局快捷键、托盘、应用扫描、应用启动、设置持久化和日志
- **预加载脚本（`src/preload`）**：通过 `contextBridge` 暴露最小化的 `window.donut` API
- **渲染进程（`src/renderer`）**：读取应用列表与设置，计算环形布局并绘制 SVG，处理键盘/鼠标交互与设置面板

### 主要流程

1. 主进程扫描应用目录，读取 `Info.plist` 与本地化名称，提取并缓存图标
2. 渲染进程通过 IPC 获取应用列表，使用 `donut-layout.js` 计算图标坐标并渲染
3. 用户选择应用后，主进程通过 `open` 命令启动应用、记录最近使用并隐藏窗口
4. 设置变更写入 `electron-store`；快捷键变化会立即重新注册全局快捷键

### IPC 接口

| 通道 | 方向 | 说明 |
| --- | --- | --- |
| `donut:getApps` | renderer -> main | 获取应用列表（首次调用触发扫描） |
| `donut:refreshApps` | renderer -> main | 重新扫描应用 |
| `donut:launchApp` | renderer -> main | 启动应用并记录最近使用 |
| `donut:getSettings` / `donut:setSettings` | renderer -> main | 读取/写入设置 |
| `donut:hideWindow` | renderer -> main | 隐藏启动台窗口 |
| `donut:setWindowSize` | renderer -> main | 按应用数量调整窗口尺寸 |
| `donut:pickFolder` | renderer -> main | 选择自定义扫描目录 |
| `donut:show` / `donut:hide` | main -> renderer | 窗口显示/隐藏事件 |
| `donut:openSettings` | main -> renderer | 打开设置面板事件 |
| `donut:shortcutError` | main -> renderer | 全局快捷键注册失败提示 |

### 环形布局

布局算法集中在 `donut-layout.js` 中，纯函数实现、便于单元测试：

- 基础视口为 720x720；第一圈容纳 10 个图标，之后每圈递增 8 个
- 内圈半径 52，圈间距 88；窗口尺寸为布局视口的 1.25 倍，最小 900x900，并留出屏幕边距
- 应用数量增长时优先放大视口，空间受限时通过 `fitScale` 等比缩小，保证所有图标完整可见
- 奇数圈自动错开半个步进角，避免图标在相邻圈之间排成直线

## 开发与测试

### 单元测试

```bash
pnpm test
```

测试使用 Node 内置的 `node:test`，覆盖环形布局边界、应用过滤与排序、图标提取、并发工具和设置默认值等逻辑。

### 截图验证

```bash
pnpm verify
```

脚本会以 900x900 透明窗口渲染启动台，检查图标数量与搜索框状态，并保存截图到 `work/verify-ring.png`。可用 `--out` 指定输出路径，加 `--rotate` 保持旋转状态：

```bash
pnpm verify -- --out docs/screenshot.png
```

### 资源占用测量

```bash
pnpm measure
```

脚本测量应用扫描耗时、冷启动加载耗时、显示/隐藏状态下的 RSS 与 CPU，并输出到 `outputs/measure.json`。可选参数包括 `--shown-seconds`、`--hidden-seconds`、`--idle-seconds` 和 `--out`。

### 打包发布

```bash
pnpm build:mac
```

生成物位于 `dist/`，默认输出未签名的 DMG。macOS 打开未签名应用时若被 Gatekeeper 拦截，可右键选择“打开”，或执行：

推送标签到 GitHub 后，仓库里的 `Release macOS DMG` 工作流会自动在 macOS 上构建 DMG 并发布到 GitHub Releases。

```bash
xattr -dr com.apple.quarantine "/path/to/甜甜圈启动台-*.dmg"
```

## 常见问题

**快捷键无法使用？**

全局快捷键可能被系统、输入法或其他应用占用。设置面板会提示注册失败，可尝试 `Option+Shift+Space` 或 `Command+Option+Space`，也可以在设置中录制其他组合。

**找不到某些应用？**

在设置面板“应用”页添加自定义扫描目录，或点击“刷新应用”。扫描目录会与默认目录合并去重。

**忘记快捷键且无法唤出窗口？**

通过托盘菜单打开设置，或运行 `pnpm reset` 恢复默认快捷键。也可以直接删除 `config.json`。

**为什么后台仍有进程？**

启动台需要常驻以响应全局快捷键和托盘操作；隐藏超过 60 秒后窗口会销毁，仅保留主进程。可运行 `pnpm measure` 查看内存占用。

## 贡献

欢迎提交 Issue、Pull Request 或改进建议。开发时请保持现有风格：

- 使用 CommonJS 与原生 JavaScript，不引入前端框架
- 布局与列表逻辑尽量写成纯函数，便于单元测试
- 修改行为时同步补充或更新 `*.test.js`
- 提交前运行 `pnpm test`，涉及界面渲染时运行 `pnpm verify`

## 开源协议

本项目基于 [Apache License 2.0](LICENSE) 开源。提交贡献即视为同意按该协议授权。

启动台展示的应用图标版权归各应用所有者所有，本项目仅在本机运行时读取并展示，不随源码分发任何第三方应用图标。

### 致谢

感谢以下开源项目提供的支持：[Electron](https://www.electronjs.org/)、[electron-store](https://github.com/sindresorhus/electron-store)、[icns-lib](https://github.com/jhermsmeier/node-icns-lib) 与 [electron-builder](https://www.electron.build/)。
