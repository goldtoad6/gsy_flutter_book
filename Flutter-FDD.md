# Flutter UI 设计库解耦重构进度，官方解答未来如何适配

在目前的 Flutter 架构中，Material（Android ）和 Cupertino（iOS）的 UI 库是与核心框架捆绑在一起的，也就是常见的 "batteries included" 原则，为的是方便开发者开箱即用，但是也导致了 Widgets、Material 和 Cupertino 这三个 lib 紧密耦合。

而今年提出的 decoupling design 重构，就是**计划将这两个设计库从核心框架中解耦，并调整到独立的 Pub 包**，也就是核心框架将只包含基础的 `Widgets` 库，而特定的设计风格将变为可选的插件 ：

![](https://img.cdn.guoshuyu.cn/ezgif-5f9c13bf8923a5c3.gif)

之所以会有这个调整，最主要还是因为在最新的 Material 3 Expressive 和 Liquid Glass 风格发布之后，UI 在 Framework 层的适配成本变高，并且 **Framework 的更新节奏也无法很好适应这种 UI 风格调整**，所以在社区的呼声下，官方正式开始了  decoupling design  计划。

实际上在之前，很多基础组件对特定设计库有不必要的依赖，你以为框架的代码结构是下图 A ，但是在多年维护后，目前已经是下图 B 的情况：

![](https://img.cdn.guoshuyu.cn/image-20251222110036742.png)

另外，类似 `SelectionArea` 组件，它看起来是一个纯 Widget 的基础组件，但为了实现跨平台适配，底层却必须依赖 Material 和 Cupertino 库 ，如果没有，你就会发现：

![](https://img.cdn.guoshuyu.cn/image-20251222103846729.png)

因为在之前的 "batteries included" 原则，实际上控件内部会根据使用的风格或者运行的平台，主动为用户采用对应的主题风格，这样的话好处肯定是开箱即用，但是实际上用户很多时候并不理解这一点，并且最重要的是：

> **由于设计库与框架发布周期绑定，新设计的跟进趋势会让适应速度变慢很多，同时紧密的耦合也让 PR 变得复杂，每次调整风险更高，容易引发回归错误 **。

![](https://img.cdn.guoshuyu.cn/ezgif-5d8abbadd74e6bac.gif)

另外，现阶段开发者如果想构建非 Material/Cupertino 的自定义设计系统，往往不得不从头开始，因为现有的基础组件的定制功能开发不足 ，所以 decoupling design 作为现阶段必须经历的产物，最终提上了日程。

![](https://img.cdn.guoshuyu.cn/image-20251222104203347.png)

当然，实际上解耦和重构设计库是一个非常大的底层调整，其中核心主要涉及了四个领域：

- **System UI** ：需要重新界定设计库与平台之间的界限（例如文本选择、页面过渡） ，这个是最大的成本之一

- **代码组织** ：在基础 `Widgets` 库中创建更多的“原始组件抽象” (raw widget abstractions)，类似现在的 `RawRadio`![](https://img.cdn.guoshuyu.cn/image-20251222110944051.png)

  

- **主题**：评估并改进主题系统，解决 Material 和 Cupertino 主题缺乏共同 BASE 的问题 ，因为之前 Widgets 完全没有主题体系，所以需要考虑是否引入更通用的 theme abstraction 

- **基础设施适配**：迁移超过 200 个测试，并将相关的 CI 流程从主仓库迁移出去 ，避免交叉导入，建立独立的 CI 流程，让 PR 更便捷过审

![](https://img.cdn.guoshuyu.cn/image-20251222104710386.png)

而对于解耦完成的是假变，整个项目分三个阶段进行：

- **阶段一  (2025年12月)** ：
  - 基础调整，将 Material/Cupertino 中的通用核心逻辑下沉移动到 `widgets` 库
  - 搭建 Flutter packages 仓库的基础支持
- **阶段二 2026年** ：
  - 正式解耦，将代码移至新的包中并发布到 Pub 
  - 在主框架中标记旧库为“已弃用” (deprecated) 
- **阶段三 - 2026年晚些时候** ：
  - 从核心框架中彻底移除已弃用的 Material 和 Cupertino 库 

![](https://img.cdn.guoshuyu.cn/image-20251222104725410.png)

> 也就是，2026 年我们就可以拥有全新的  Material 3 Expressive 和 Liquid Glass 风格支持，并且是可选 package

当然，对开发者的影响的使用肯定有影响，这个影响有好有坏：

- **版本管理更灵活**：解耦后，Material 和 Cupertino 将遵循语义化版本控制，开发者可以锁定特定版本，独立于 Flutter 框架的升级节奏 ，更加方便灵活，**不必跟着 Flutter 升级 UI 设计** 
- **更容易构建自定义设计**：通过使用底层的“原始组件” (raw widgets，如 `RawRadio`)，构建完全自定义的 UI 系统将变得更加容易，不再被迫基于 Material 组件修改 
- **破坏性变更 (Breaking Changes)**：虽然未来会提供快速修复工具 (quick fixes)，但解耦过程不可避免地会带来一些破坏性变更 ，这些是是需要开发者自己适配
- **设计库更新暂停**：为了减少迁移难度，在解耦完成前， Flutter 会将暂停引入新的重大设计更新（如 Material 3 Expressive 或 Liquid Glass） ，所以这个需要开发耐心等待

![](https://img.cdn.guoshuyu.cn/image-20251222104818392.png)

当然，解耦之后，**Framework 的 UI break change 会越来越少，而开发者也可以选择自己的 style package 进行 lock** ，整体灵活性和可用度会更好。

不过，对于 Plugin开发者来说，可能会有更高的适配成本，**因为需要考虑 UI 实现里使用的是哪个 version 的 style package ，也需要考虑会不会给用户带来版本冲突等**，在这方面也许未来会出现类似 RN 的：

![](https://img.cdn.guoshuyu.cn/image-20251222111904861.png)

# 最后

这次重构虽然是一项巨大的工程，但长远来看会让 Flutter 框架更耐用，也让设计库的迭代更迅速，并更好地支持第三方设计生态系统的发展 ，甚至未来 PC 平台的第三方 UI 风格也可以更好适配，这也引出另一个问题：

> Compose Multiplatform 是否也有类似问题，是否也会跟进？毕竟 CMP 也是以 Material 为主，不过目前看来 Compose 先天具备分层风格 function ，更倾向于平台层 UI 自己独立实现，实际上问题会小很多。





































