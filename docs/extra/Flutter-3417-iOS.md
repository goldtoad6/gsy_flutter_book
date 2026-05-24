---
title: "Flutter 3.41.7 ，小版本但 iOS 大修复，看完只想说：这是人能写出来的 bug ？"
---

# Flutter 3.41.7 ，小版本但 iOS 大修复，看完只想说：这是人能写出来的 bug ？

我已经忘了，这是我第几篇聊 [iOS 26 的 JIT 调试问题](https://juejin.cn/post/7542461507402924075)，自从 iOS 26 正式禁止 Debug 时 `mprotect` 的 RX 权限之后，Flutter 的在 iOS 真机的 JIT 运行和 Hotload 就经历了各种骚操作，而后续各种各样的问题也接踵而来，而 3.41.7 恰好就解决了两个大问题：

![](https://img.cdn.guoshuyu.cn/image-20260418154438867.png)

#  iOS 真机 Crash

[#184254](https://github.com/flutter/flutter/issues/184254) 这个问题就很恶心，**在 macOS 26.4 / Xcode 26.4 环境下， `flutter run`  调试 iOS 真机时，App 会在启动后出现 DartWorker 线程崩溃**：

```
EXC_BAD_ACCESS (code=50, address=0x11fc000c4)
```

但是它也不是每一次都会，**但是问题是崩溃率高达约 80%**，这就导致真机调试会经常失败，但是它又不是一定失败，然后你就会一直运行，运行，运行····

这个问题主要的起因其实我们以前聊过，为了在 iOS 26 实现 JIT 运行和 Hotload ，Flutter 会通过 LLDB 设置断点来辅助 Dart VM 的 JIT 编译：

- Flutter 通过 LLDB 在 `NOTIFY_DEBUGGER_ABOUT_RX_PAGES` 函数上设置一个脚本断点

- 当 Dart VM 需要将 JIT 编译的代码内存 Page 标记为可执行时，就会触发这个断点
- 断点命中后，LLDB 会运行一段 Python 脚本，调用 `mprotect` 将内存页标记为可执行
- 断点设置了 `--auto-continue true`，断点触发并执行完脚本后，LLDB 会自动继续执行

**而问题就出在 Xcode 26.4 的 LLDB (`lldb-1704`)  上**：

> 它有一个上游 bug（[llvm/llvm-project#190956](https://github.com/llvm/llvm-project/issues/190956)），在异步模式（async mode）下，**LLDB 会随机失败地重新装填（rearm）脚本化断点**。

这就意味着，第一次断点能正常触发，Python 脚本能标记内存 Page 为可执行，但后续的断点如果遇到 bug，就会导致没办法再次触发：

> **这时候就会导致 Dart VM 新编译的代码 Page 没有被标记为可执行，当 DartWorker 线程尝试执行这些未标记的代码时就会报错`EXC_BAD_ACCESS (code=50)`**。

所以这个问题时因为 LLDB 的 Bug ，但是它又不能完全无视，因为这会导致 Flutter 在 iOS 真机上无法正常调试。而这个修复过程也是很崎岖：

- 在第一轮 PR ([#184690](https://github.com/flutter/flutter/pull/184690) )，一开始想着是，检测 Xcode >= 26.4 时就不使用 `--auto-continue true `，改为手动监听断点停止事件，收到 `stop reason = breakpoint` 后手动发送 `process continue`  ，但是测试并不能稳定解决问题
- 之后 PR( [#184768](https://github.com/flutter/flutter/pull/184768)) **直接选择禁用 LLDB 的异步模式来解决问题**，这个 PR 也是兜兜转转改了几次才完成

![](https://img.cdn.guoshuyu.cn/image-20260418161319531.png)

所以你会看到 cherry-pick 到 stable（[#184983](https://github.com/flutter/flutter/pull/184983)）和  beta（[#185102](https://github.com/flutter/flutter/pull/185102)）的两个分支改动差异很大，因为 beta 经历了：

> **第一轮修复 PR #184690（手动 stop/continue）和它被 revert 后又合入的 PR #184768 到 revert #184868 整个整个过程，这足以看出来修复过程的蛋疼**。

所以如果只看 3.41.7 的 cp，其实修复还挺简单的（*3 个文件，+13/-6*）：

- `lldb.dart` — 添加 `SetAsync(False)`  和更新 `_lldbProcessResuming` 正则 ，核心就是让 LLDB 在命令发出后等待返回，断点事件按顺序处理，禁止了异步模式：![](https://img.cdn.guoshuyu.cn/image-20260418161625223.png)
- `ios_debug_workflow.dart` ：更新集成测试的日志匹配模式，同步模式下 LLDB 的输出格式不同，不再输出 `Process X resuming`，而是输出 `1 location added to breakpoint 1` ：![](https://img.cdn.guoshuyu.cn/image-20260418161933942.png)

是不是觉得修复很简单？但是找到问题，解决问题，到问题被任何发布的整个过程里，你看 beta 的合并记录就知道有多曲折了，不得不说像在 iOS 上继续做 JIT  Hotload ，真的就是考验道心。

#  Git 版本不匹配导致失败

另一个问题也是相当恶心，升级到 macOS 26.4 后，会发现运行 `flutter run`  是 iOS 会可能出现：

```shell
fatal: multi-pack-index version 2 not recognized
Failed to download https://storage.googleapis.com/flutter_infra_release/flutter/e69de29bb2d1d6434b8b29ae775ad8c2e48c5391/engine_stamp.json
```

在这个 log 里，需要注意的是特殊的 hash `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391` ，这是 **Git 空文件的 hash**（空字符串的 SHA-1）。

而问题的原因也是很坑，**Xcode 修改了 PATH**，当 `flutter run` 构建 iOS 应用时，Xcode 会修改 `PATH`，把 `/Applications/Xcode.app/Contents/Developer/usr/bin` 放在最前面：

> 这个目录包含了 MacOS 捆绑的 Git（`git version 2.50.1 (Apple Git-155)`），而用户系统上安装的是 Git 2.53，Git 2.53 创建的仓库使用了 multi-pack-index v2 格式，但 Git 2.50.1 不认识这个格式

所以 `content_aware_hash.sh` 脚本 `git ls-tree "$BASEREF" -- "${TRACKEDFILES[@]}" | git hash-object --stdin` 时：

- `git ls-tree` 因为 multi-pack-index 错误而失败，输出 null
- 但在 bash 管道中，**`set -e` 只检查最后一个命令的退出码**
- `git hash-object --stdin`  接收到空输入，**计算出空字符串的 hash：`e69de29bb2d1d6434b8b29ae775ad8c2e48c5391`**
- 然后错误的 engine.stamp 这个空 hash 被写入 `bin/cache/engine.stamp`
- Flutter 用这个错误的 hash 下载 engine artifacts，URL 不存在，构建失败

**看出来了么？这是人能写出来的 bug** ？？不过知道问题修复就简单了，[#184998](https://github.com/flutter/flutter/pull/184998) 修改只需要检测当前 `git` 是不是 Apple Git（通过版本字符串包含 `"Apple Git"`） ：

> 如果是就添加 `-c core.multiPackIndex=false` 参数， 告诉 Git不使用 multi-pack-index 。

这样即使 Apple 的旧版 Git 遇到了 v2 格式的 multi-pack-index，它也会跳过不读取，转而使用传统的 pack 索引方式，而 `git ls-tree` 就能正常工作，输出正确的文件树信息，从而计算出正确的 content hash ：

![](https://img.cdn.guoshuyu.cn/image-20260418162821436.png)

另外后续还有一个加固 PR：[#185170](https://github.com/flutter/flutter/pull/185170)，让 `content_aware_hash.sh` 在  `git ls-tree` 失败时报错退出，而不是像之前一样静默地产生错误的 hash：

![](https://img.cdn.guoshuyu.cn/image-20260418163102840.png)

# 最后

看到没有，这两个 bug 虽然修复起来很简单，甚至可以被 cp 到 3.41 上，但是实际引发问题的原因就很奇葩，甚至属于天上掉锅，因为基本时平台的问题，但是这就是做跨平台经常需要面对的，需要在这些脏乱差的情况下提供可用支持。

**对于框架来说，平台的错最终也只能框架自己适配，这也是理所当然的事情了**。