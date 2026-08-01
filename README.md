# 甜甜圈控制台

macOS 圆形应用启动器，基于 Electron + pnpm，以甜甜圈环形布局展示 `/Applications` 里的应用。

## 使用

```bash
pnpm install
pnpm start
```

启动后应用常驻后台，按 `Option+Space` 唤出/隐藏。点击应用图标启动，点中心甜甜圈打开设置。
菜单栏右侧有托盘图标，可显示/隐藏窗口、打开设置或退出程序。

## 常用命令

- `pnpm dev`：开发模式，打开 DevTools
- `pnpm reset`：恢复全部默认设置（快捷键、颜色、隐藏应用、圆心图片等）
- `pnpm test`：运行单元测试
- `pnpm verify -- --out work/ring.png`：截图验证环形布局渲染

## 操作

- 输入文字实时过滤应用
- 方向键或 `WASD` 移动选择，`Enter` 启动，`Esc` 隐藏
- 悬停应用点击星标收藏，可在设置里选择收藏优先/最近使用排序
- 设置里的圆环颜色、透明度、粗细、旋转速度、扫描路径和排除应用都会持久化

## 配置存储

设置保存在 Electron 的 `userData` 目录（`electron-store`），应用图标有磁盘缓存（`icon-cache`），损坏时会自动重建。主进程日志位于 `userData/logs/main.log`。

如果忘记快捷键导致无法唤出窗口，运行 `pnpm reset` 后快捷键会恢复为 `Option+Space`。也可以手动编辑配置文件：`~/Library/Application Support/donut-console/config.json`。
