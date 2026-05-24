---
title: "Flutter 3.41.8 又双叒修复调试问题，草台班子日常 hotfix"
---

#  Flutter 3.41.8 又双叒修复调试问题，草台班子日常 hotfix

笑死，在不久之前 [3.41.7 iOS 大修复](https://juejin.cn/post/7630020855679057935)我们才聊过，Flutter 官方终于修复了 iOS 26.4 的 JIT  Debug Crash 问题，这个问题是因为它有一个上游 bug（[llvm/llvm-project#190956](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fllvm%2Fllvm-project%2Fissues%2F190956)），在异步模式（async mode）下，**LLDB 会随机失败去重新装填（rearm）脚本化断点**。

也就是，第一次断点能正常触发，Python 脚本能标记内存 Page 为可执行，但后续的断点如果遇到 bug，就会导致没办法再次触发：

> **这时候就会导致 Dart VM 新编译的代码 Page 没有被标记为可执行，当 DartWorker 线程尝试执行这些未标记的代码时就会报错`EXC_BAD_ACCESS (code=50)`**。

然后 Flutter 官方通过一个曲折的 review 和“严谨”的审核流程修复了这个问题：

![](https://img.cdn.guoshuyu.cn/image-20260428091604839.png)

然后，两周不到，3.41.8 发布，修复了 3.41.7 带来的 Bug，3.41.8 主要修复的问题是：

> JIT 断点（LLDB breakpoint）这个机制本来只在 **debug 模式**下通过 Dart 侧设置断点（`NOTIFY_DEBUGGER_ABOUT_RX_PAGES`）来触发，但 Flutter 3.41.7 的修复，导致**在 profile 模式下也会执行这个 LLDB 断点等待逻辑**，而 profile 模式根本不会触发这个断点，导致进程永久挂起。

![](https://img.cdn.guoshuyu.cn/image-20260428092453814.png)

```
 [2026-04-16 02:32:28.125425] [STDOUT] stdout: [   +4 ms] executing: lldb
 [2026-04-16 02:32:29.063991] [STDOUT] stdout: [ +938 ms] [lldb]: (lldb) device select 00008140-00160D5034F0801C
 [2026-04-16 02:32:29.693547] [STDOUT] stdout: [ +629 ms] [lldb]: (lldb) breakpoint set --func-regex '^NOTIFY_DEBUGGER_ABOUT_RX_PAGES$'
 [2026-04-16 02:32:29.694147] [STDOUT] stdout: [        ] [lldb]: Breakpoint 1: no locations (pending).
 [2026-04-16 02:32:29.694241] [STDOUT] stdout: [        ] [lldb]: Breakpoint set in dummy target, will get copied into future targets.
 [2026-04-16 02:32:29.694726] [STDOUT] stdout: [        ] [lldb]: (lldb) breakpoint command add --script-type python 1
 [2026-04-16 02:32:29.732521] [STDOUT] stdout: [  +37 ms] [lldb]: (lldb) script lldb.debugger.SetAsync(False)
 [2026-04-16 02:32:29.733830] [STDOUT] stdout: [   +1 ms] [lldb]: (lldb) device process attach --pid 734
 [2026-04-16 02:32:30.279842] [STDOUT] stdout: [ +545 ms] [lldb]: Process 734 stopped
 [2026-04-16 02:32:30.279859] [STDOUT] stdout: [        ] [lldb]: * thread #1, stop reason = signal SIGSTOP
 [2026-04-16 02:32:30.279885] [STDOUT] stdout: [        ] [lldb]:     frame #0: 0x0000000100dd2330 dyld`_dyld_start
 [2026-04-16 02:32:30.279888] [STDOUT] stdout: [        ] [lldb]: dyld`_dyld_start:
 [2026-04-16 02:32:30.279890] [STDOUT] stdout: [        ] [lldb]: ->  0x100dd2330 <+0>:  mov    x0, sp
 [2026-04-16 02:32:30.279891] [STDOUT] stdout: [        ] [lldb]:     0x100dd2334 <+4>:  and    sp, x0, #0xfffffffffffffff0
 [2026-04-16 02:32:30.279893] [STDOUT] stdout: [        ] [lldb]:     0x100dd2338 <+8>:  mov    x29, #0x0                 ; =0 
 [2026-04-16 02:32:30.279950] [STDOUT] stdout: [        ] [lldb]:     0x100dd233c <+12>: mov    x30, #0x0                 ; =0 
 [2026-04-16 02:32:30.279956] [STDOUT] stdout: [        ] [lldb]: Target 0: (Runner) stopped.
 [2026-04-16 02:32:30.280354] [STDOUT] stdout: [        ] [lldb]: (lldb) process continue
 [2026-04-16 02:32:33.246480] [STDOUT] stdout: [+2965 ms] 2026-04-16 02:46:20.742446-0700 Runner[734:169244] [UIFocus] FlutterView implements focusItemsInRect: - caching for linear focus movement is limited as long as this view is on screen.
 [2026-04-16 02:32:33.386577] [STDOUT] stdout: [ +139 ms] 2026-04-16 02:46:20.884205-0700 Runner[734:169244] fopen failed for data file: errno = 2 (No such file or directory)
 [2026-04-16 02:32:33.386883] [STDOUT] stdout: [        ] 2026-04-16 02:46:20.884367-0700 Runner[734:169244] Errors found! Invalidating cache...
 [2026-04-16 02:32:33.428215] [STDOUT] stdout: [  +41 ms] 2026-04-16 02:46:20.925344-0700 Runner[734:169244] fopen failed for data file: errno = 2 (No such file or directory)
 [2026-04-16 02:32:33.428323] [STDOUT] stdout: [        ] 2026-04-16 02:46:20.925451-0700 Runner[734:169244] Errors found! Invalidating cache...
 [2026-04-16 02:32:33.440401] [STDOUT] stdout: [  +12 ms] 2026-04-16 02:46:20.938115-0700 Runner[734:169244] Warning: Unable to create restoration in progress marker file
 [2026-04-16 02:32:33.498277] [STDOUT] stdout: [  +57 ms] 2026-04-16 02:46:20.995636-0700 Runner[734:169312] [General] Failed to send CA Event for app launch measurements for ca_event_type: 1 event_name: com.apple.app_launch_measurement.ExtendedLaunchMetrics
 [2026-04-16 02:33:28.131754] [STDOUT] stderr: [+54631 ms] LLDB is taking longer than expected to start debugging the app. LLDB debugging can be disabled for the project by adding the following in the project's pubspec.yaml:
 [2026-04-16 02:33:28.131839] [STDOUT] stderr:             flutter:
 [2026-04-16 02:33:28.131857] [STDOUT] stderr:               config:
 [2026-04-16 02:33:28.131909] [STDOUT] stderr:                 enable-lldb-debugging: false
 [2026-04-16 02:33:28.131959] [STDOUT] stderr:             Or disable LLDB debugging globally with the following command:
 [2026-04-16 02:33:28.131970] [STDOUT] stderr:               "flutter config --no-enable-lldb-debugging"
```

没错，3.41.8 的修复的这个问题，就是 3.41.7 带来的副作用，修复也是同一个作者，**因为 3.41.7 在修复 Xcode 26.4 竞态 bug 的时，不小心让 profile 模式也走进了只有 debug 模式才有出路的等待逻辑**。

所以修复很简单，就是加一个 mode ，只在 `BuildMode.debug` 触发，但是问题不在这，**而是这么简单一个场景，在之前那么多轮的 merge 和 review 居然没有半点发现**，只能说，实际上大家都只是草台班子：

![](https://img.cdn.guoshuyu.cn/image-20260428092805696.png)

![](https://img.cdn.guoshuyu.cn/ChatGPT%20Image%202026%E5%B9%B44%E6%9C%8828%E6%97%A5%2009_40_23.png)

另外，之前我们聊过的已经修复的过的 [#175099 Webview 点击问题](https://github.com/flutter/flutter/issues/175099) ，起因来自苹果 WebKit 的 Bug ，**之后 Flutter 官方在修复之后也和苹果跟进了这个问题，目前这个问题在 iOS 系统也已经修复**，iOS 26.4 上就默认修复了这个场景，所以从 26.4 版本就不再需要启用之前的修复了：

![](https://img.cdn.guoshuyu.cn/image-20260428093656728.png)