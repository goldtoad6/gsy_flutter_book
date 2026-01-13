# 再次紧急修复，Flutter  针对 WebView 无法点击问题增加新的快速修复

前几天我们刚聊了 [《Flutter 官方正式解决 WebView 在 iOS 26 上有点击问题》](https://juejin.cn/post/7583577045578907674) ，这是一个完整的底层重构修复，整个修复周期审核堪比“博士论文”，但是也带来了一个问题，**它只修复了 Engine 和 Framework 层面问题，那插件端还需要等升级适配修复，这链路就又再一次拉长了**。

![](https://img.cdn.guoshuyu.cn/image-20251217143605964.png)

所以针对这个场景，作者又提交了一个“**骚操作**”的快速修复，[#179908 ](https://github.com/flutter/flutter/pull/179908) 这个 PR 的修复方案非常“暴力”但也有效：**找到那些特定的手势识别器，先禁用它们，然后立即重新启用**， 这相当于重置了识别器的状态。

> 是不是又有熟悉的味道？不理解的可以看[上上篇](https://juejin.cn/post/7571306072423448618)讲这个点击问题的内容。

为什么需要这个新的 PR ？**因为这是一个无需任何插件更新的快速修复方案**，并且也已经合并到了 master ：

![](https://img.cdn.guoshuyu.cn/image-20251217142624482.png)

这个 PR 具体的代码修改就是：在 `FlutterTouchInterceptingView` 中添加了两个核心的辅助方法，并在 `blockGesture` 中调用：

- `searchAndFixWebView` : 一个递归函数，它会遍历视图层级，如果遇到的视图是 `WKWebView` 类型，它就会调用修复手势的方法，执行 `searchAndFixWebViewGestureRecognzier` ，确保即使 `WKWebView` 被嵌套在其他 `UIView` 中也能被找到

  ![](https://img.cdn.guoshuyu.cn/image-20251217142818635.png)

  

- `searchAndFixWebViewGestureRecognzier` : 也是一个递归函数，遍历当前视图的所有 `gestureRecognizers` ，检查识别器是否启用，并且类名是否用 `"TouchEventsGestureRecognizer"` 结尾 (通常对应 `WKTouchEventsGestureRecognizer`) ，然后执行 `recognizer.enabled` 的关闭和打开操作：

  ![](https://img.cdn.guoshuyu.cn/image-20251217142948597.png)

- 修改了 `blockGesture ` , 当手势拦截策略为 `FlutterPlatformViewGestureRecognizersBlockingPolicyEager`时，在 iOS 26 改为直接调用 `[self searchAndFixWebView:self.embeddedView];` 来执行上述修复逻辑：![](https://img.cdn.guoshuyu.cn/image-20251217143144119.png)

最后，方案还增加了一个 **`FLTDisableWebViewGestureReset`** ，给开发者添加了一个安全阀，通过读取 `Info.plist` 中的 `FLTDisableWebViewGestureReset`  ，如果这个修复方案上线后出现严重问题，开发者可以通过配置这个 flag 来禁用这个“重置手势”的逻辑。

可以看到，**这是一个快速且粗暴的改动，就是在 `FlutterPlatformViews.mm` 中实现了针对 `WKWebView` 手势识别器的递归搜索和“重启”机制，并在 `blockGesture` 中针对 iOS 26+ 启用了这个机制**。

但是好处也很明显，可以什么插件都不改就生效，当然主要是一个临时修复，为的是方便开发者快速解决问题，真正 fix 的途径还是推荐走之前的 hitTest ：

![](https://img.cdn.guoshuyu.cn/image-20251217143508751.png)

# 参考链接

https://github.com/flutter/flutter/pull/179908