# Flutter 官方正式解决 WebView 在 iOS 26 上有点击问题

上个月和大家聊到了 [《为什么你的 Flutter WebView 在 iOS 26 上有点击问题？》](https://juejin.cn/post/7571306072423448618) ，源头是因为 **WKWebView（WebKit）内部的手势识别器与 Flutter 在 Engine 里用于“阻止/延迟”手势的 recognizer 之间的冲突**，因为 Flutter 和 UIKit 都各自有手势识别系统（GestureRecognizer），为了防止互相抢事件，Flutter engine 在 iOS 上加入了一个“**delaying gesture recognizer**”（延迟识别器），这也最终导致了 iOS 26 上的 bug ：

> 在 Flutter 弹窗和 WKWebView 一起出来的时候，要么点不动，要么触摸会穿透到下面的 WebView 。

而在提供了之前部分场景有效的临时解决方案之后，Flutter 官方也提出了几个对应的可行性重构方案，具体可见 https://docs.google.com/document/d/1ag4drAdJsR7y-rQZkqJWc6tOQ4qCbflQSGyoxsSC6MM/ ，而现在方案三最终确定并 LGTM ：

![](https://img.cdn.guoshuyu.cn/image-20251212140327773.png)

回顾整个问题里程，主要有两点：

- 现有的 “**gesture recognizer approach**” （依赖自定义 `UIGestureRecognizer` + `shouldRequireFailureOfGestureRecognizer`）存在局限：无法阻止 `UIView` / JS 的底层 touch 回调（例如 WebView 的 `touchstart`），并且会和 WebView  的内部识别器冲突（这个导致了 iOS 的平台 bug），从而让一直以来的 hack 实现（如 remove/re-add recognizer）不生效：

> 因为 JS的 `touchstart` 在 `touchesBegan` 当帧同步触发，Flutter 没法在 touchesBegan 前屏蔽掉事件。

- 以前为了解决 Google Maps 的 “dangling touchesBegan” 问题，引入了 `WaitUntilTouchesEnded` 策略，这是个权宜之计但并不理想，本质也是一种延迟机制：

> 因为当时 Flutter 没有能力在 `touchesBegan` 之前阻止触摸的到达，只能用 gesture recognizer 阻断，而这就导致了 Google Maps 在 `touchesBegan` 之后，后续 `touchesEnded`  会变成  recognizer fails 从而不会收到 `touchesEnded`，而这就是 `WaitUntilTouchesEnded` 诞生的背景，`WaitUntilTouchesEnded` 的目的就是避免 Google Maps 在中途被强制 fail，导致内部手势状态机 fails。

**其实这一切的原因都是已经“异步协同”，所以现在修复开始改为“同步”**，也就是 Flutter Engine + iOS embedder 新增了 “同步 hitTest 回调” 能力 ：

- iOS embedder 增加了可拦截 hitTest 的 `UIView`
- Engine 与 Dart Framework 通过 FFI 实现“同步回调”

具体来说就是，首先是 Dart Framework 层，这里新增手势拦截策略 API (`UiKitView`)，在 `UiKitView` 组件中新增了 `gestureRecognizersBlockingPolicy`  参数，让开发者可以为每个 PlatformView 单独配置手势拦截行为：

![](https://img.cdn.guoshuyu.cn/image-20251212141050355.png)

| **策略名称**              | **拦截时机**            | **使用技术**       | **解决核心问题**                           |
| ------------------------- | ----------------------- | ------------------ | ------------------------------------------ |
| **`touchBlockingOnly`**   | **最快 (HitTest 阶段)** | iOS `hitTest` 重写 | **修复 iOS 18+/26 WebView/AdMob 无法点击** |
| `eager`                   | 快 (手势竞争胜出时)     | 阻塞手势识别器     | (旧默认值，现已不推荐)                     |
| `waitUntilTouchesEnded`   | 慢 (手指抬起后)         | 阻塞手势识别器     | 过去修复 Google Maps 状态卡死问题          |
| `fallbackToPluginDefault` | (取决于插件设定)        | (取决于插件设定)   | 保持旧插件兼容性                           |

> 新机制让开发者可以在 Dart 代码中直接指定 PlatformView 的手势拦截策略，而不是依赖全局配置或原生代码，根据不同场景配置不同的拦截处理机制，而 `touchBlockingOnly`  就是全新的支持。

例如针对 AdMob 或 WebView 在 iOS 18+/26 上的点击穿透问题，现在开发者可以强制使用 `touchBlockingOnly` 策略，从而绕过有问题的 `gesture recognizer` 机制。

> 另外也提供了 `fallbackToPluginDefault`，确保不修改代码的情况下维持原有插件的行为。

接着就是在 Dart Framework 层实现了 Hit Test 逻辑，用于响应 Engine 发起的命中测试请求，判断点击位置是否落在 PlatformView 上：

![](https://img.cdn.guoshuyu.cn/image-20251212142927119.png)

> 当用户点击屏幕时，Flutter 通过 Render Tree 判断该位置最上层是否是 PlatformView，如果是被 Flutter 组件（如下拉菜单）遮挡，`firstHit` 就不会是 `NativeHitTestTarget`，从而拦截触摸。

然后就是  Engine / Bridge 层的通信，这部分主要负责将 iOS 原生的同步调用桥接到 Dart 环境，这里提供了一个同步的 Dart 入口点 `_platformViewShouldAcceptTouch`，从而让 iOS 原生的 `hitTest` 方法可以阻塞等待 Dart 的判断结果：

![](https://img.cdn.guoshuyu.cn/image-20251212143106401.png)

之后就是  iOS Engine 层重写了 `hitTest` 方法，这也是本次修复的核心，通过重写 PlatformView 的 `hitTest` 方法，在通过响应链传递触摸事件之前，先询问 Flutter Framework 是否应该拦截该事件：

```Objective-C
- (UIView*)hitTest:(CGPoint)point withEvent:(UIEvent*)event {
  if (_blockingPolicy == FlutterPlatformViewGestureRecognizersBlockingPolicyTouchBlockingOnly) { //
    // ... (获取 flutterViewController)
    
    CGPoint pointInFlutterView = [self convertPoint:point toView:self.flutterViewController.view];
    
    // 询问 Framework 是否应该接收此触摸
    if (![self.flutterViewController
            platformViewShouldAcceptTouchAtTouchBeganLocation:pointInFlutterView]) { //
      // 如果 Framework 说 "不" (例如点击了 Flutter 遮罩)，返回 self (拦截触摸)
      return self;
    }
  }

  // 如果 Framework 说 "是"，调用 super，让事件传递给 WKWebView
  return [super hitTest:point withEvent:event];
}
```

而对应的就是，如果策略是 `TouchBlockingOnly`，则不再添加容易导致冲突的 `delayingRecognizer` :

![](https://img.cdn.guoshuyu.cn/image-20251212143518239.png)

也就是，现在会先通过 `hitTest` 预先判断，避免了使用 `UIGestureRecognizerDelegate` 带来的复杂性和 iOS 18+ 上的 Bug，而当 `platformViewShouldAcceptTouch` 返回 `NO` 时，`FlutterTouchInterceptingView` 自身会吞掉事件，底层的 WebView 就不会收到错误的点击，从而修复了点击穿透或链接无法点击的问题。

# 最后

可以看到，本次调整数据较大的底层变动，所以牵动的模块也比较多，这也是为什么这个 PR 一直拖到现在才合并的原因，因为需要考虑和测试的因素很多：

![](https://img.cdn.guoshuyu.cn/image-20251212143806279.png)

而对于开发者来说，如果要引用修复，最好是通过增加对应的  `gestureBlockingPolicy` 参数来支持配置，只针对有问题的场景使用  `touchBlockingOnly` ，因为这怎么说也是一个底层大变更，会不会有新的问题还不好说。



# 参考链接



- https://github.com/flutter/flutter/pull/179659
- https://github.com/flutter/flutter/issues/175099







