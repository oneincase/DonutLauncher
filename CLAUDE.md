# Donut Launcher 开发笔记

macOS / Windows 圆形应用启动器，Tauri 2 + Vue 3 + Pinia。前端在 `src/ui`，Rust 后端在 `src-tauri`。

## 常用命令

| 命令 | 用途 |
|---|---|
| `pnpm dev` | 启动开发（`tauri dev`） |
| `pnpm web:dev` | 只跑前端 Vite（mock 模式） |
| `pnpm web:build` | 前端类型检查 + 构建到 `dist/` |
| `pnpm test` | 前端 vitest + Rust cargo test |
| `pnpm verify` | Playwright E2E |
| `pnpm build` | 构建本机安装包（macOS DMG） |

## Windows 交叉编译打包（Apple Silicon 上）

本机是 `aarch64-apple-darwin`，装的是 Homebrew Rust + rustup 并存，交叉编译 Windows 需要特别注意工具链选择。

### 完整命令

```bash
cd src-tauri && PATH="$HOME/.cargo/bin:$PATH" npx tauri build \
  --target x86_64-pc-windows-msvc --runner cargo-xwin
```

产物：`src-tauri/target/x86_64-pc-windows-msvc/release/bundle/nsis/DonutLauncher_<version>_x64-setup.exe`

### 关键坑

1. **PATH 优先级**：`/opt/homebrew/bin`（Homebrew Rust）排在 `~/.cargo/bin`（rustup）前，会命中只有 macOS std 的 Homebrew rustc，报 `can't find crate for std`。必须用 `PATH="$HOME/.cargo/bin:$PATH"` 前置 rustup。
2. **link.exe**：MSVC 链接器在 macOS 不存在，用 `--runner cargo-xwin`（自动下载 Windows SDK + lld-link）。
3. **makensis.exe**：macOS 上 NSIS 打包器用 Homebrew 装 `makensis`（原生跨平台，产出 Windows 安装包）。
4. 交叉编译的产物**未签名**，Windows 上首次运行可能有 SmartScreen 警告。
5. 交叉编译时有若干 `DestroyIcon` 未处理 Result 的 warning，无害。

### 前置依赖

```bash
rustup target add x86_64-pc-windows-msvc
cargo install cargo-xwin
brew install makensis
```

## 平台相关实现要点

- **右键菜单**：macOS WKWebView 原生右键菜单（含 Reload）由系统提供，前端在 `App.vue` 全局 `contextmenu` `preventDefault()` 抑制。
- **窗口失焦隐藏**：主窗口失焦自动隐藏（`window.rs`），文件/文件夹选择器会让窗口失焦。用 `AppState.dialog_open: AtomicBool` 标志，选择器打开期间暂停失焦隐藏（前端 `api.setDialogOpen`，`commands::set_dialog_open`）。
- **Windows 图标箭头**：UWP 应用图标走 Shell fallback 时若直接查 `.lnk` 会带快捷箭头，需优先查解析出的目标 exe（`scanner.rs` 的 `shell_icon_png`）。改动提取逻辑后要 bump 缓存 key（`win2-`）。
- **更新检查**：`checkForUpdate` 走 `api.checkUpdate` 封装，mock 模式返回本地结果，真实运行时请求 GitHub API（CSP 已允许 `api.github.com`）。
