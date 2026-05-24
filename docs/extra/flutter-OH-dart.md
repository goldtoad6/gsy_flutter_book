---
title: "聊聊 Flutter OH 社区和近期 PR 的一些感受"
---

大家好，我是谷歌 GDE 和华为 HDE 郭树煜，在 Flutter 这个项目下算事耕耘的比较久吧，在各个社区也算事比较活跃，前段时间也是有幸成为开源鸿蒙社区 Flutter  SIG 的 Leader 和 Committer ，在这一个多月里也给 Flutter OH 提了一些 PR ，今天主要就是分享一下这方面的感受或者思考。

![](https://img.cdn.guoshuyu.cn/fff.jpg)

而 Flutter OH 之所以特别，主要还是因为鸿蒙用户量已经相当可观了，而去年华为公布过，目前鸿蒙 TOP 应用中 40%采用跨平台三方框架，其中主流就主要以 Flutter、RN 等框架为主，对比目前其他企业分支如三星、LG、丰田、索尼来说，Flutter OH 分支的活跃度和用户量无疑是在众多分支里位居榜首，所以这也是我加入 SIG 的目标之一，可以帮助 Flutter 在鸿蒙社区更好发展下去。

![](https://img.cdn.guoshuyu.cn/image-20260426105951315.png)

从生态上看，Flutter 确实适合做这种跨平台分支支持，因为大部分时候只需要适配平台的 Embedded 就够了，对比 RN 和 CMP 的场景，成本确实相对更低，可以聚焦在 Embedded 层，这也是为什么「丰田」可以在自家车机系统使用 Flutter 、LG 的 WebOS 电视系统可以使用 Flutter、 Raspberry Pi （树莓派）和三星 Tizen 等 IoT 也使用 Flutter 的根本原因。

![img](https://img.cdn.guoshuyu.cn/image-20260226142644077.png)

当然不是说  Embedded 层的实现就简单了，因为能真正把 Flutter 跑起来的，就是平台侧那层很薄的 Embedder ，它负责把引擎接到真正的设备层，包括图形上下文/交换链、输入事件、VSync、线程模型、文件与资源、平台消息通道（platform channel）、可选的外部纹理/原生视图合成等。

> 所以之前看华为的一些分享就知道，在适配 Impeller 和 Vulkan 上就投入了很多经历才优化和适配，毕竟虽然可以大部分时候专注在 Embedded ，但是这个场景需要的底层知道和系统架构熟悉层度要很高，所以难度也不低。

也可以看出来，华为在 Flutter 鸿蒙社区版的支持力度其实并不低，而实际上在最近经历的 PR 或者意见反馈等场景，gitcode 和 Flutter OH 给我的感觉还是挺不错的，整体效率和流程都挺不错，至少在效率上比起 Flutter 主分支是快了不少，当然，更让我震惊的一点是，我提的 PR 甚至都会被 CP 到各个老版本里，甚至能合并到 3.7  版本，我没记错的话，3.7 已经是 2023 年年初那会的版本了，这确实很不可思议，因为想想都能感觉到里面的持续维护成本有多高。

![](https://img.cdn.guoshuyu.cn/02c94d0f9967c1568c52f1ca5f5957ef.jpg)

当然，从我个人角度考虑，我还是觉得这种维护成本太高，随着版本发布，其实感觉应该有停止维护分支的一个计划，今年我看社区的 roadmap 里没有提到这事，或许可以整体评估下，版本的维护终止时间。

这里其实可以聊一下最近一个 PR 的经历，这个 PR 主要问题就是 PlatformView 的混和场景问题，也算是一个比较边界的问题，就是当界面没存在 Flutter 输入框和 ArkUI 输入框的时候，会出现焦点问题，在从 Flutter 键盘切换到 Native 输入框键盘之后，会看到两个光标在闪烁，同时收起键盘会发现，这时候再点击 Flutter 输入框的时候，键盘无法弹起来了。

![](https://img.cdn.guoshuyu.cn/image-20260426133042463.png)

所以一起开其实是一个是输入 owner 在切换时没有切干净的问题，Flutter 侧仍然认为自己持有输入焦点和键盘状态，但 native 输入框已经接管了键盘，而当 native 侧收起键盘后，Flutter 再次 `show` 时可能误判键盘仍处于可复用状态，最终导致键盘起不来。

所以一开始的方向是围绕 `TextInputPlugin` 做修复：在 Flutter 切到 PlatformView 时，记录 PlatformView owner；在 native 失去焦点或销毁时，释放这个 owner；同时要抑制 Flutter framework 随后发来的过期键盘信号，避免它在切换的过程中把键盘提前收掉。



但问题是，很快句发现它引入了新的边界问题。比如：

- Flutter 键盘起来后点击 native，键盘会被收起，需要再点一次
- `Flutter -> native -> hide -> background -> foreground` 后出现无主键盘
- native focused 页面 pop / teardown 后可能留下旧 owner 状态
- 有些 cleanup 在 blur、detach、dispose 多个入口重复出现

然后后面就开始对各种 case 缝缝补补，开始把 `TextInputPlugin` 变成一个更复杂的状态机，flag 和状态越来越多，比如补一个新 flag、一个新 cleanup、一个新异步兜底，代码逐渐从一个窄修复扩展到多个文件、多个状态变量、多个生命周期入口，修改量越来越大，风险也越来越难解释。

后来发现改动膨胀的太厉害之后，直接推翻之后，然后参考 Android 的方式，不在现在  `ACTION_DOWN` 阶段提前切 focus，而是等 ArkUI 内部真正的 native editor focus 回调到了，再通知 Flutter `invokeViewFocused` ，虽然思路看起来是正确的，但是但实际问题是，OHOS ArkUI 的 focus / touch 时序和 Flutter framework 的键盘  `hide`  消息不是严格同步的， native child focus 往往已经晚于 framework 发出的 clear client / hide 链路，也就是说如果完全等 ArkUI focus，可能已经错过了最初想想要改比的焦点竞争问题。

也就是实际上不可能和 Andorid 的实现对齐，这大概也是 PlatformView 最初这样实现的原因，所以最终这个方式也放弃了，然后回归原本的边界问题上，核心边界重新定义为：

- 只处理 Flutter framework text client 切到 physical PlatformView text input 的切换情况
- native blur 时只做状态记录清除，不主动扩大成 IME
- teardown cleanup 只是兜底，不参与正常 steady-state 链路
- virtual-display PlatformView 保持原路径
- 非文本 PlatformView 不参与 text input handoff

然后再基于这个边界去收敛其他问题，做到不破坏已有场景的情况下收敛掉 bug ，只是看起来代码逻辑就不是那么漂亮，但是其实这才是开源里经常遇到的，**修复问题不应该只追求代码正确，而且考虑真实场景下的适配，还有回归成本**，或者后续可以考虑重构一份 plan 来让代码更漂亮更正确，但是不应该再这种边界 bug 上去扩大修改。

实际上最近这段时间提了有 7 - 8 个 PR ，大部分其实来第三方收集到的问题，很多问题可能看起来很边界，但是确实在产品里也会很影响用户体验，我这里也收集有一些社区提的建议，例如：



- 版本跟进问题，我觉得 2026 年版本的迭代还行，跳着版本跟进，但是其实可以更考虑一些版本，比如最近的 3.41.7 ，它修复了 iOS 的一些开发过程问题，还有一些关于 iOS 26 的 JIt 运行的 bug 也是在 3.41 ，所以这种版本会很影响用户的开发进度的 ，我觉得可以加快适配，因为 Flutter 在多平台场景下，这种开发问题其实是最影响体验
- 另外一个就是是否可以有一套类似近期 Android CLI 一样的工具，可以在脱离 IDE 的场景下，完成项目创建的配置，适配版本选择，路径依赖和构建指引（配置签名 key 之类），我相信 AI 时代 CLI 场景其实很有用，不管是节省 Token 或者提供更准确的一致性输出，如果有个鸿蒙 CLI 那确实是最好不过

