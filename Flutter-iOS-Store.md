# Flutter 3.38.1 之后，因为某些框架低级错误导致提交 Store  被拒

如果你近期已经升级到 3.38.1 之后的版本，包括 3.38.5 ，你就有概率发现，打包提交 iOS 的包会出现 `The binary is invalid` 的相关错误，简单来说，就是**App Store 拒绝了某个二进制文件，因为它包含了无效的内容**。

![](https://img.cdn.guoshuyu.cn/image-20260105085152252.png)

那么这个内容是怎么来的？大概率是模拟器架构的 Framework 被错误地打包进了正式发布的 App ，具体原因还要提到最新版本增加的  Native Assets 功能。

Native Assets 的目标是**让在 Flutter/Dart 包中集成 C、C++、Rust 或 Go 代码，可以像集成普通 Dart 包一样简单**，也就是它允许 Dart 包定义如何构建和打包原生代码，开发者不需要深入了解每个平台的底层构建系统，也是  Dart FFI 未来的重要基建。

> 详细可见：[《Flutter 里的 Asset Transformer 和 Hooks ，这个实验性功能有什么用》](https://juejin.cn/post/7521356618174545962)

那它怎么导致了这次这个低级问题的出现？实际上这是一个构建脚本逻辑缺陷导致的“脏构建”问题，当 Flutter 构建依赖于 Native Assets（比如 `sqlite3` 等库）的 Plugin 时，这些原生资源会被编译并输出到 `build/native_assets/$platform` 目录（例如 `build/native_assets/ios`）。

因为在现有的构建脚本（`xcode_backend.dart`）在打包时，会简单粗暴地将 `build/native_assets/ios` 目录下的**所有**框架复制到最终的 App Bundle (`Runner.app/Frameworks`) ，例如：

- 先运行了模拟器跑应用，这时模拟器专用的框架（如 `sqlite3arm64ios_sim.framework`）就会被生成并留在了 `build/native_assets/ios` 目录

- 接着，开发者在**没有运行 `flutter clean`** 的情况下，直接运行了 Release 构建
- 构建脚本会把之前遗留的“模拟器框架”也一并复制进了 Release 包
- App Store 检测到 Release 包中含有模拟器架构的代码，因此拒绝接收

> 所以说，大厂也有大厂的草台。

当然，这个问题解决起来也很简单，就是发布前 `flutter clean` 清理一下，当然，如果你之前打过包了，**那么 Xcode 的构建缓存也需要清理下**，因为可能存在即使你通过 `flutter clean`  删除了 Flutter 的构建产物，但是 Xcode 可能仍然认为某些中间文件（Intermediate Build Files）存在可用。

> 比如 DerivedData 缓存

那么这么低级的问题，修复下也很简单，所以 sqlite3 的作者也提交了一个 [#179251](https://github.com/flutter/flutter/pull/179251) ，简单来说就是，针对 Native Assets ：

- 读取构建过程中生成的 `native_assets.json` 文件
- 解析文件，获取当前构建**真正引用**的依赖列表
- **仅复制** `native_assets.json` 中列出的框架，忽略目录中残留的其他无关文件（如模拟器文件）

这个修复其实很简单，但是在流程上，因为目前 PR 还缺少  integration test ，所以一直卡在了等待 Review 阶段，除非有人申请豁免，不然这个 PR  的合并还会继续卡着。

只能说，一代人有一代人的草台。

# 参考链接



- https://github.com/flutter/flutter/issues/178602

- https://github.com/flutter/flutter/pull/179251