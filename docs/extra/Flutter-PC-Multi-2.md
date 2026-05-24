---
title: "Flutter  PC 多窗口最新进展，底层原生窗口句柄支持已合并"
---

# Flutter  PC 多窗口最新进展，底层原生窗口句柄支持已合并

不久前 Flutter 的多窗口在 `WindowController`  新增了 「底层原生窗口句柄」的支持，目前 PR 已经完成了合并，也就是现在 Flutter 多窗口的灵活度和可用性有了不错的提升：

![](https://img.cdn.guoshuyu.cn/image-20260414102938733.png)

这次 PR 正对多个平台都新增加了 `windowHandle` 获取，原本的 `getWindowHandle()` 方法是 `@internal` 私有方法，这次 PR 通过适配重构成了公开的 getter ，同时在窗口被销毁后访问句柄会抛出 `StateError`，补充有生命周期保护。

| 平台           | 新增接口                                  | 返回类型        | 含义                                     |
| -------------- | ----------------------------------------- | --------------- | ---------------------------------------- |
| **Windows**    | `WindowControllerWin32.windowHandle`      | `HWND`          | Win32 窗口句柄                           |
| **macOS**      | `WindowControllerMacOS.windowHandle`      | `Pointer<Void>` | 指向 `NSWindow` 的指针                   |
| **Linux**      | `WindowControllerLinux.windowHandle`      | `Pointer<Void>` | 指向 `GtkWindow` 的指针                  |
| **Linux 额外** | `WindowControllerLinux.flutterViewHandle` | `Pointer<Void>` | 指向 `FlView`（Flutter 渲染 View）的指针 |

```dart
final RegularWindowController controller = ...;
if (controller is WindowControllerWin32) {
  final controllerWin32 = controller as WindowControllerWin32;
  // 调用 Win32 API，例如排除截图捕获
  SetWindowDisplayAffinity(controllerWin32.windowHandle, WDA_EXCLUDEFROMCAPTURE);
}
```

**为什么说这个 PR 挺有用的？因为现在你用多窗口可以直接依赖平台原生的底层能力**，比如  [knopp/window_toolbox](https://github.com/knopp/window_toolbox)  这个库就直接依赖了这个 PR 场景。

![](https://img.cdn.guoshuyu.cn/image-20260414103746195.png)

`window_toolbox`  主要提供了：

- **自定义窗口标题栏/边框** —— 自定义拖拽区域、“交通灯”按键（macOS）、最大化/最小化/关闭按键，在 Windows 上支持 Snap Layout 弹出菜单
- **额外原生窗口功能** —— 暴露更多 `NSWindow` API 和 delegate 注册（macOS）、Win32 消息处理（Windows）、GTK 事件处理（Linux）

![](https://img.cdn.guoshuyu.cn/image-20260414103843502.png)

而  `window_toolbox` 的自定义能力比如监听 `NSWindowDelegate` 事件、直接处理 Win32 消息就都需要通过 `HWND` / `NSWindow*` 这些原生句柄才能实现 。

> 如果没有这个 PR，`window_toolbox` 只能通过 hack 或反射间接获取句柄。

而现在回顾整个多窗口进度，目前整个 Flutter 多窗口整体进度还处于**"可用但还是实验性"**的阶段，在目前 master 里主要大致情况是：

| 功能                                      | 状态                                                         |
| ----------------------------------------- | ------------------------------------------------------------ |
| `RegularWindowController`（普通窗口）     | 已实现                                                       |
| `DialogWindowController`（对话框窗口）    | 已实现                                                       |
| `TooltipWindowController`（工具提示窗口） | 已实现                                                       |
| 窗口最大化/最小化/全屏/标题               | 已实现                                                       |
| 暴露原生句柄（本 PR）                     | 刚合并                                                       |
| macOS 窗口内容加载完成前白屏/黑屏         | 已知 P2 Bug（[#184701](https://github.com/flutter/flutter/issues/184701)） |
| Windows 多窗口创建/关闭崩溃               | P2 已知问题（[#155685](https://github.com/flutter/flutter/issues/155685)） |
| Satellite 窗口（Windows）                 | 还没实现（代码中明确 `UnimplementedError`）                  |
| 多窗口无障辅助功能（Windows）             | 未完全完工（[#115613](https://github.com/flutter/flutter/issues/115613)） |

从目前的整体 issue 和实现上看：

- 基础多窗口渲染管道已经基本可用（Windows + macOS）
- Windows Embedder 多窗口也基本可以用
- macOS Embedder 多窗口 API 稳定性还存在一些问题
- 多窗口 runner API 还没完成落地（pubternal 阶段）
- 所有内置功能/插件的多窗口兼容性还没完成
- DevTools 多窗口支持缺失

如果你着急想用的话，目前可以在 master 体验，通过：

- `flutter config --enable-windowing` 
- `flutter run -d windows --dart-define=FLUTTER_ENABLED_FEATURE_FLAGS=windowing`

![](https://img.cdn.guoshuyu.cn/image-20260414105813417.png)

在性能上，目前每个窗口都是独立的 `FlutterView` 渲染隔离，所以基本互不影响，但是目前存在某些情况下，多窗口 raster time 会导致帧率下降的问题

![](https://img.cdn.guoshuyu.cn/ezgif-39cdf7320cd7e815.gif)

另外在 macOS 下，启动多个窗口可能会出现窗口和内容在启动时有那么一瞬间不同步问题，也就是 Flutter 内容渲染成果之前，窗口就先展示了：

![](https://img.cdn.guoshuyu.cn/ezgif-865790f56b921ff1.gif)

而且如果窗口频繁创建/销毁，在 Windows 会有崩溃风险 ，**所以目前使用的话呀，推荐窗口数量不要太多（3-5个内），最重要是避免频繁销毁/重建** 。

![](https://img.cdn.guoshuyu.cn/image-20260414110736406.png)

另外也推荐使用   [knopp/window_toolbox](https://github.com/knopp/window_toolbox)  ，他做到了保留平台行为的细节，比如 Windows 上的[分屏布局 ](https://support.microsoft.com/en-us/windows/snap-your-windows-885a9b1e-a983-a3b1-16cd-c531795e6241)和高度的自定义，同时还还提供了各种原生窗口相关的平台特性能力。

> 从目前的规划进度，和 Flutter 的 Roadmap 来看，2026 多窗口完成可用性发布应该问题不大。







