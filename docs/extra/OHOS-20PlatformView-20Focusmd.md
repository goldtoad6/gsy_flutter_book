---
title: "一次 OHOS PlatformView 输入焦点问题的修复复盘"
---

# 一次 OHOS PlatformView 输入焦点问题的修复复盘

这次问题最初看起来并不复杂：在 OHOS 上，Flutter `TextField` 弹起键盘后，点击 native `PlatformView` 里的输入框，再收起键盘，随后重新点击 Flutter 输入框时，键盘可能无法再次弹起。

从现象看，核心矛盾是输入 owner 没有切干净：Flutter 侧仍然认为自己持有输入焦点和键盘状态，但 native 输入框已经接管过 IME；当 native 侧收起键盘后，Flutter 再次 `show` 时可能误判键盘仍处于可复用状态，最终导致键盘起不来。

这本来应该是一个非常窄的修复：处理 `Flutter TextField -> physical PlatformView TextInput -> hide -> Flutter TextField` 这一条链路。但真正做起来以后，我们经历了一轮比较典型的“状态机补丁膨胀”。

## 第一阶段：先修现象，但打坏了原本好的链路

最初的方向是围绕 `TextInputPlugin` 做修复：在 Flutter 切到 physical PlatformView 时，记录 PlatformView owner；在 native blur 或 teardown 时，释放这个 owner；同时抑制 Flutter framework 随后发来的 stale `hide`，避免它在 handoff 过程中把键盘提前收掉。

这确实能修复最初的问题。日志里可以看到：

- Flutter `TextField` 先成为 framework client
- 点击 native 输入框后进入 `setPlatformViewClient`
- framework 紧接着发来 `hide`
- 我们识别这是 handoff 过程中的 stale hide，于是 suppress
- native blur 后再清理 PlatformView owner
- 回到 Flutter 输入框时，键盘可以重新弹起

但问题是，我们很快发现它引入了新的边界问题。比如：

- Flutter 键盘起来后点击 native，键盘被收起
- `Flutter -> native -> hide -> background -> foreground` 后出现无主键盘
- native focused 页面 pop / teardown 后可能留下旧 owner 状态
- 有些 cleanup 在 blur、detach、dispose 多个入口重复出现

这些问题说明：虽然单点 case 被修了，但我们开始把 `TextInputPlugin` 变成一个更复杂的状态机。每修一个新表现，就补一个新 flag、一个新 cleanup、一个新异步兜底。代码逐渐从一个窄修复扩展到多个文件、多个状态变量、多个生命周期入口，修改量越来越大，风险也越来越难解释。

这也是中间 review 反复指出的风险：hide suppress 可能吞掉真实 teardown hide、detach 后晚到 focus 回调可能回灌、前后台恢复没有覆盖 native owner、测试只覆盖 helper predicate 而没有覆盖跨类异步状态机。这些评论不一定每一条都是当前可复现 bug，但它们反映了同一个问题：修复已经开始膨胀成“跨 `TextInputChannel -> TextInputPlugin -> PlatformViewsController` 的状态机治理”。

## 第二阶段：尝试用 ArkUI focus 对齐，但发现时序不可靠

我们也尝试过另一个方向：不要在 `ACTION_DOWN` 阶段提前切 focus，而是等 ArkUI 内部真正的 native editor focus 回调到了，再通知 Flutter `invokeViewFocused`。

这个方向从架构上看更“正确”：只有真实 native 输入框获得焦点，才切换输入 owner。它可以避免点到 PlatformView 非输入区域时误切焦点。

但实际问题是，OHOS ArkUI 的 focus / touch 时序和 Flutter framework 的 `hide` 消息不是严格同步的。native child focus 往往已经晚于 framework 发出的 clear client / hide 链路。也就是说，如果完全等 ArkUI focus，可能已经错过了最初想规避的 race window。

这和 Android 的模型并不能简单对齐。Android 那边的 PlatformView focus / input connection 生命周期有更成熟的通路，很多 owner 切换语义可以借助系统输入连接自然完成；但 OHOS 这里，PlatformView 是 ArkUI 组件，Flutter engine 外层看到的是 PlatformView 容器，内部 child 的 focus 事件并不天然等价于 Flutter text input owner 切换。硬把 Android 的思路搬过来，会导致状态机越来越绕。

这个阶段给我们的结论是：不能只追求“理论上更正确”的 focus 事件；必须尊重当前 OHOS 的事件时序。如果时序不够早，单靠 ArkUI focus 无法稳定修复 first-tap handoff race。

## 第三阶段：退回来，重新收窄问题边界

后面我们把思路重新收窄：这次 PR 不应该重写完整输入法状态机，只修最初明确的问题。

核心边界重新定义为：

- 只处理 Flutter framework text client 切到 physical PlatformView text input 的 handoff
- 只 suppress 一次 handoff 过程中紧跟而来的 stale framework hide
- native blur 时只做 owner bookkeeping reset，不主动扩大成 IME teardown
- teardown cleanup 只是兜底，不参与正常 steady-state 链路
- virtual-display PlatformView 保持原路径
- 非文本 PlatformView 不参与 text input handoff

这样以后，`TextInputPlugin` 里的修改重新变得能解释：

- `setPlatformViewClient` 记录 physical PlatformView owner
- 一次性 suppress stale framework hide
- `clearPlatformViewClient` 处理 native blur 后的 owner release
- `clearPlatformViewClientForTeardown` 只作为 view 消失时的 terminal fallback
- `isFrameworkTextInputActive` 用来约束 eager handoff 只发生在 Flutter -> native 这条路径

这个阶段的目标不是让所有边界都完美，而是确保这次 PR 的行为范围可控，不把已经验证好的链路再次打坏。

## 第四阶段：发现 composite PlatformView 的新问题

后来我们又发现一个很关键的现象：Flutter `TextField` 弹起键盘后，点击 `Top Native Input` 这个 PlatformView 的非输入区域，Flutter 光标会消失，但键盘还在。

这个现象一开始看起来像 `TextInputPlugin` 又出问题了，但继续看 demo 实现后发现，根因其实在 PlatformView 粒度。

demo 里的 `Top Native Input` 并不是“一个 PlatformView 等于一个 native TextInput”。它是一个复合 ArkUI view：

- 标题
- 内部 `TextInput`
- footer 文案
- padding / background / border

这一整张 card 都是同一个 PlatformView。engine 在 `ACTION_DOWN` 只能看到“viewId 被点到了”，不知道点的是内部输入框，还是标题、空白、padding。

原来的 eager handoff 逻辑是：只要这个 PlatformView 声明自己是 text input handoff participant，就在 `ACTION_DOWN` 直接 `invokeViewFocused(viewId)`。这会导致点到 card 非输入区时，Flutter 先把焦点让出去，但 native editor 并没有接手，于是进入半切换状态。

这个问题的正确修复位置不是 `TextInputPlugin`，而是 `PlatformViewsController / PlatformView` 的 handoff 触发条件。

最终我们新增了一个更细粒度的扩展点：

- `shouldParticipateInTextInputHandoff()` 表示这个 PlatformView 是否整体参与 text input handoff
- `shouldTriggerTextInputHandoffOnTouch()` 表示这一次 touch 是否真的应该触发 eager handoff

`PlatformViewsController` 改成：

- 先把 `ACTION_DOWN` 分发给 ArkUI child
- 再询问具体 PlatformView：这次 touch 是否命中了真实 editor child
- 只有返回 true 时，才调用 `invokeViewFocused(viewId)`

demo 侧配套实现为：

- 内部真实 `TextInput` 收到 touch 时，按 `viewId` 记录 editor touch signal
- `shouldTriggerTextInputHandoffOnTouch()` 消费这个 signal
- 点非输入区时返回 false
- 点真实输入框时返回 true

这个方案验证后行为符合预期：

- 点 native card 非输入区，Flutter 光标不会消失
- 点真实 native 输入框，仍然能触发 first-tap handoff
- Flutter -> native -> hide -> Flutter 正常
- native -> native、route pop、前后台恢复链路正常

更重要的是，这个方案没有继续扩大 `TextInputPlugin` 状态机，而是把问题放回了正确的语义层：PlatformView 是否应该在本次 touch 上触发 handoff。

## 这次最大的教训

这次修复最大的教训不是某一行代码怎么写，而是边界意识。

一开始的问题很具体，但我们很容易被后续现象带着走，把每一个新表现都塞进同一个状态机里修。这样会让修复越来越像“补洞”，代码量不断膨胀，review 也会越来越难回答：每个 flag 在什么生命周期生效？是否会吞掉真实 hide？detach 后晚到 focus 怎么办？前后台 native owner 怎么恢复？测试到底覆盖了什么？

真正让问题收回来的是重新问：

- 这次 PR 到底修哪条链路？
- 哪些行为是原本就存在的，不属于本次修复？
- 哪些风险需要日志证明后再动？
- 哪些问题应该在 `TextInputPlugin`，哪些应该在 `PlatformViewsController`？
- 这个 PlatformView 是单输入框，还是复合 ArkUI 容器？

最终比较稳的方向是：

- `TextInputPlugin` 只处理输入 owner 和 IME bookkeeping
- `PlatformViewsController` 处理什么时候需要 eager focus handoff
- 具体 PlatformView 实现负责说明“这次 touch 是否真的命中了 native editor”
- demo 只作为验证配套，不把 demo 特化逻辑反推成 engine 通用状态机

## 总结

这次 PR 从一个“Flutter -> native 后键盘回不来”的具体 bug 开始，中间走过一次状态机膨胀，也尝试过等待 ArkUI focus 的更理想路径，但最终还是回到一个更朴素的原则：

不要在错误的层修问题。

IME owner 的问题放在 `TextInputPlugin`，touch 命中语义放在 `PlatformView / PlatformViewsController`，复合 view 的 child 判断交给具体 PlatformView 自己实现。这样修复才有边界，review 才能讲清楚，后续风险也才有办法用日志继续验证。