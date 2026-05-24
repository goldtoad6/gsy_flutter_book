---
title: "Flutter 凉了没？Flutter 2026 的未来行程和规划，一些有趣的变化"
---

# Flutter 凉了没？Flutter 2026 的未来行程和规划，一些有趣的变化

最近刚好有人问我，说现在 Flutter 官方好像没什么消息了？都没什么 Flutter 活动？我只想说，现在办活动的，不是 AI 主题的谁给经费？

刚好这两天看到了 Flutter 官方宣布的 2026 的一些全球行程，其中 Google Cloud Next  刚刚结束，也展示了一些有趣的东西，我们后面讲讲，这里可以看到，2026  Flutter 官方的行程已经排的满满当当，**其中最值得关注的除了五月的 Google I/O 之外，就是每年 8 月的 Google I/O Connect** ： 

![](https://img.cdn.guoshuyu.cn/ChatGPT%20Image%202026%E5%B9%B44%E6%9C%8828%E6%97%A5%2010_09_52.png)

去年刚好就受邀参加了  I/O Connect 的闭门圆桌会议，当时现在大家也反馈了不少问题，现在看来这些问题，特别是 AI 问题，在过去这段时间里都得到了完善和改进，**特别是 GenUI，Genkit，Dart Server Function， Flutter Skill，Flutter MCP 等都得到了落地**。

![](https://img.cdn.guoshuyu.cn/image-20260428103501405.png)

而在刚刚过去的 Google Cloud Next 大会，Flutter 也带来了不少有趣的东西：

- **全栈 Dart：** Flutter 团队宣布推出 Firebase Functions 的 Dart 支持预览版，也就是说，现在除了用 Serverpod 写 Dart 后端之外，还支持 Dart Serverless  的后端开发，另外 Firebase Functions 通过和 **Firebase 的深度集成，利用 Dart Admin SDK** 可以支持 AI 场景减少上下文切换，提高开发效率等支持
- **Flutter GenUI** 展示，整个 UI 实时通过 AI 直接生成，不做任何界面开发，开发者在现场通过 GenUI 提需求并直接点咖啡下单， AI 根据场景生成对应 UI 

![](https://img.cdn.guoshuyu.cn/ezgif-50a4a8e9254a70b4.gif)

另外，**Google Cloud Next 线程丰田也介绍了它们为什么选用 Flutter 做他们的车机 UI** ，同时 Talabat 也展示了他们怎么利用 Flutter 完成中东地区规模化发展 ：

![](https://img.cdn.guoshuyu.cn/ChatGPT%20Image%202026%E5%B9%B44%E6%9C%8828%E6%97%A5%2010_09_59.png)

**另外一个有意思的就是  [Jaspr](https://jaspr.site/)** ，Jaspr  是一个第三方 Dart Web 框架，但是  `dart.dev`、 `flutter.dev` 和 `docs.flutter.dev` 等官方网站，现在都已经全部迁移到 Jaspr。

Jaspr 的特别在于，这是一个传统的 Dart Web 框架，支持客户端渲染、服务器端渲染和静态网站生成，它有点古法回归的味道，其实就是可以用 Flutter 写传统 DOM Web ，因为 Flutter 官方现在都是 WASM 了，所以基于  HTML 和 CSS 的场景就变成  Jaspr 承担了，当然只是写法一样，代码不会完全一模一样 ：

```dart
class FeatureCard extends StatelessComponent {
  const FeatureCard({
    required this.title,
    required this.description,
    super.key,
  });

  final String title;
  final String description;

  @override
  Component build(BuildContext context) {
    return div(classes: 'feature-card', [
      h3([.text(title)]),
      p([.text(description)]),
    ]);
  }
}
```

官方之所以迁移到 Jaspr ，**主要是因为 Jaspr 内置的部分渲染支持将每个页面预渲染为静态 HTML，然后只为需要的组件附加客户端逻辑**，而因为 Flutter  官网的大部分内容都是静态的，只需要少量的交互功能，这样可以实现提速和针对 SEO 的场景优化。

![](https://img.cdn.guoshuyu.cn/image-20260428102436029.png)

另外 **Jaspr Content 支持 Markdown 驱动型网站**， 它提供了 [Jaspr Content](https://docs.jaspr.site/content) 软件包，支持构建内容驱动型网站，只需要几分钟即就可以创建一个可运行的 Markdown 网站，同时支持扩展和深度定制：

```dart
jaspr create --template=docs my_documentation_site
dart pub add jaspr_content

////////////////////////////////////////////////////

import 'package:jaspr/jaspr.dart';
import 'package:jaspr_content/jaspr_content.dart';

import 'main.server.options.dart';

void main() {
  Jaspr.initializeApp(options: defaultServerOptions);

  runApp(ContentApp(
    parsers: [
      MarkdownParser(),
    ],
  ));
}
```

> 大概就是，官方已经不维护 HTML 模式，然后如果你真想用，可以选择 Jaspr 。

当然，如果说近期最值得关注的，肯定就是下个月的 Google I/O 了，**新版本的 Flutter 发布应该会连带着大家最关心的样式包解耦能力，目前 Material 和 Cupertino 样式包已经完成剥离**，关于样式包的 PR 目前状态也冻结了，所以这次 I/O 带来的版本肯定也是一个大变动的版本。

![](https://img.cdn.guoshuyu.cn/image-20260428110451423.png)

最后，关于 Flutter 凉不凉这个问题，我觉得之前在社区看到的这个回复就很好：

> **与其关心 Flutter 团队的 layoff ，不如关心下它最终交付的内容，而就目前而言，它交付的内容是不错的**。

![](https://img.cdn.guoshuyu.cn/image-20260428111117265.png)

目前 Flutter 紧跟 AI ，也在修复问题和优化特性，可能存在一些瑕疵和某些进度问题，**但是它一直在迭代和优化，并没有停下来**，能持续交付，这就足够了。

当然，那个 Jaspr  是我没预料到的，也算是一个奇葩的状态，官方反而依赖第三方来构建 Dart 的官网。











