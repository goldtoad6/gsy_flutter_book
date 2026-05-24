---
title: "Flutter 1.17 | 2020年度第一个稳定版本"
---

  2020年5月6日，Flutter终于迎来的本年的第一个稳定版本：`1.17.0`，距离上一个稳定版本的发布已经过去了将近5个月（146天）。受到世界范围的~~你我都知道的情况~~影响，今年的Google I/O也被取消，一定程度影响了本次版本的发布。同时在临近发布前出现了具有严重影响的BUG，也导致发布时间再次被推迟。

  那么`1.17.0`到底更新了什么？是不是能再一次颠覆使用体验？能否让开发者再次真香？以下通过**对Medium原文进行部分总结翻译以及补充**，为各位进行解答~（如有错漏欢迎指出）（有英文原文没有的内容噢😉）

## 写在前面

  本次Flutter版本的发布，开发团队将更多的时间用于[构建新的发布流程架构](https://link.juejin.cn/?target=https%3A%2F%2Fmedium.com%2Fp%2Ff723d898d7af)。自上一次发布稳定版本以来，已解决了**6339个问题（issue）**，分别从**231位开源贡献者**合并了[**3164个提交请求**](https://link.juejin.cn/?target=https%3A%2F%2Fflutter.dev%2Fdocs%2Fdevelopment%2Ftools%2Fsdk%2Frelease-notes%2Fchangelogs%2Fchangelog-1.17.0)。得益[*NeverCode*与团队的合作](https://link.juejin.cn/?target=https%3A%2F%2Fblog.codemagic.io%2Fflutter-and-codemagic-join-forces-on-github%2F)，今年团队在Flutter的仓库上关闭的issue比新增的issue更多，总数减少了**约800个**。与Flutter一同发布的还有Dart 2.8、iOS新增Metal渲染支持、新的Meterial组件和新的网络追踪调试工具等。

## 移动端性能及应用大小优化

  性能及内存优化的工作是这次新版本的重点。升级到新版本后，用户将立刻感受到更流畅快速的动画、更小的应用大小以及更低的内存占用。现在一般的路由变换场景（非透明的路由过渡）将[提速20%-37%](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fflutter%2Fflutter%2Fpull%2F48900)。根据不同设备硬件性能的不同，在简单的iOS动画上能减少最多40%的CPU/GPU使用率（[engine#14104](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fflutter%2Fengine%2Fpull%2F14104) / [engine#13976](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fflutter%2Fengine%2Fpull%2F13976)）。

  该版本还包含了大量的应用大小优化。例如官方的展示应用*Flutter Gallery*的Android应用包大小从9.6MB减小到了8.1MB（18.5%）。

  另外在内存使用率方面，带有图片的列表在快速滚动时造成的内存占用及波动一直是Flutter的痛点之一。该版本将快速滚动带图片（大图）列表场景的[内存使用率降低了70%](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fflutter%2Fengine%2Fpull%2F14265)。



![img](http://img.cdn.guoshuyu.cn/20211223_Flutter-117/image1)



  但，最值得说明的性能强力提升是对iOS Metal的支持。

## Metal的支持为iOS应用带来了50%的性能提升

  [Metal](https://link.juejin.cn/?target=https%3A%2F%2Fdeveloper.apple.com%2Fmetal%2F)是与iOS 8一同发布的API，具有兼顾图形与计算功能、面向底层、低开销的硬件加速[4]等优势。Flutter现已默认使用Metal，让用户应用的平均渲染速度加快了50%*（由实际业务决定）*。



![img](http://img.cdn.guoshuyu.cn/20211223_Flutter-117/image2)



  而在不支持Metal的设备上（A7处理器及iOS 10以下），Flutter将继续使用OpenGL进行渲染。   

## Material部件：`NavigationRail`、`DatePicker`、`VisualDensity`及更多

  Flutter团队正在持续地根据客户的反馈推进Flutter中Material Design的实现。本次由Material Design团队设计并实现了一个用于响应式App布局的路由组件`NavigationRail`，该组件能与`BottomNavigator`快速转换，在设备尺寸变大时随之改变，能很好地适应移动端与桌面版的布局。

  *快速体验 `NavigationRail` 可以访问 [demo](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fflutter%2Fsamples%2Ftree%2Fmaster%2Fexperimental%2Fweb_dashboard) 或在 [dartpad](https://link.juejin.cn/?target=https%3A%2F%2Fdartpad.dev%2Fb9c6cd345fd1cff643353c1f4902f888) 上进行尝试。*



![img](http://img.cdn.guoshuyu.cn/20211223_Flutter-117/image3)



  此外，基于Material Design的日期选择器`DatePicker`也已一同发布。新的`DatePicker`使用了符合Material指导的视觉效果，通过[详情文章](https://link.juejin.cn/?target=https%3A%2F%2Fflutter.dev%2Fgo%2Fmaterial-date-picker-redesign)可以了解到更多。



![img](http://img.cdn.guoshuyu.cn/20211223_Flutter-117/image4)



  `VisualDensity`也是新引入的内容，其指代的是Material Design中各类组件的视觉密度。通过调整它可以使得标准Material组件之间更加紧凑或疏远。新版本在`ThemeData`中引入了设置（`ThemeData.visualDensity`）。详细介绍请移步[文档](https://link.juejin.cn/?target=https%3A%2F%2Fapi.flutter.dev%2Fflutter%2Fmaterial%2FVisualDensity-class.html)。



![img](http://img.cdn.guoshuyu.cn/20211223_Flutter-117/image5)



  文字选择菜单也已针对平台做了相应的改进。现在菜单内的选项超出屏幕宽度时将会自动收起并可以通过与原生一致的操作切换，解决了某些语言中操作项的文字过长时布局溢出的问题。



![img](http://img.cdn.guoshuyu.cn/20211223_Flutter-117/image6)





*Android平台的文本选择*





![img](http://img.cdn.guoshuyu.cn/20211223_Flutter-117/image7)





*iOS平台的文本选择*



  与1.17一起，Flutter团队一同发布了基于[Material 运动系统](https://link.juejin.cn/?target=https%3A%2F%2Fmaterial.io%2Fdesign%2Fmotion%2Fthe-motion-system.html)的预设[动画组件包](https://link.juejin.cn/?target=https%3A%2F%2Fpub.dev%2Fpackages%2Fanimations)。



![img](http://img.cdn.guoshuyu.cn/20211223_Flutter-117/image8)



  在Material的[运动系统介绍文章](https://link.juejin.cn/?target=https%3A%2F%2Fmedium.com%2Fgoogle-design%2Fimplementing-motion-9f2839002016)中，Material Design团队定义了从组件到全屏视图的四种动画变化类型：容器转换、共轴转换、交叉渐变、渐变。尽管Flutter原本就可以实现对应效果，但该动画组件包能让开发者更轻松地实现它们。

## Material文本：更现代化的Flutter文字主题

  在该版本的发布中，Flutter团队在兼容以前版本的App的前提下完整整合了2018标准的Material Design文本大小定义。原有的`TextTheme` API使用未受影响，但现在被标记为**废弃**，提醒开发者尽快迁移到新的标准。



![img](http://img.cdn.guoshuyu.cn/20211223_Flutter-117/image9)



  在Flutter的`TextTheme`中，`bodyText1`和`bodyText2`对应着Material Design的`body1`和`body2`。类似的还有`H1-H6`，对应`headline1-headline6`。   

## 用于Flutter的谷歌字体

  如果你对新的Material Design文字缩放感兴趣，那么相信你对在Flutter中使用[`GoogleFonts`](https://link.juejin.cn/?target=https%3A%2F%2Fmedium.com%2Fflutter%2Fintroducing-google-fonts-for-flutter-v-1-0-0-c0e993617118)也抱有非常大的期待。



![img](http://img.cdn.guoshuyu.cn/20211223_Flutter-117/image10)



  `GoogleFonts`让开发者能轻易地在开发的App中体验和使用`fonts.google.com`上的所有字体，开发者可以选择让用户直接通过API下载字体，或在应用中内置提供这些字体。

## 辅助功能和国际化  

  Flutter团队持续关注的另一个方向便是辅助功能，它将让Flutter应用的应用范围更加广泛并且为特定场景增加了可用性。在该版本中针对[滑动](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fflutter%2Fflutter%2Fissues%2F43883)、[文字](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fflutter%2Fflutter%2Fissues%2F52487)、[输入框](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fflutter%2Fflutter%2Fissues%2F53065)及[其他输入组件](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fflutter%2Fflutter%2Fissues%2F49259)修复了[大量问题](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fflutter%2Fflutter%2Fissues%3Fq%3Dis%3Aclosed%2Bis%3Aissue%2Blabel%3A%22a%3A%2Baccessibility%22%2Bclosed%3A2019-11-25..2020-04-02)。官方推荐开发者根据文档中更新的[**最佳实践**](https://link.juejin.cn/?target=https%3A%2F%2Fflutter.dev%2Fdocs%2Fdevelopment%2Faccessibility-and-localization%2Faccessibility)去测试自己的应用。

  在国际化方面，团队针对三星输入法对许多东亚语言的影响完成了修复。思密达开发者们应该会庆祝这些改动🤣

## 工具：整合Flutter的Dart DevTools、Android快速启动应用调试及更多

  该版本的发布伴随着即将发布的与Flutter进行整合的Dart DevTools，如果你想立刻尝试它，请启动DevTools并点击右上角的"beaker"图标。



![img](http://img.cdn.guoshuyu.cn/20211223_Flutter-117/image11)



  在预发布的DevTools中，你会看到多项优化点，但最重要的一项便是`Network` （**网络**）选项卡。



![img](http://img.cdn.guoshuyu.cn/20211223_Flutter-117/image12)



  网络选项卡现在可以查看来自应用的网路请求，方便快速地排查请求问题。如果开发者在DevTools中没有找到该选项卡，可以通过以下命令来进行升级或启用：

```
$ pub global actiat devtools
复制代码
```

  默认情况下，网络选项卡会在你点击"Record"（开始记录）后显示你的网络活动，但如果开发者希望从App启动开始时就记录，可以在`main()`入口中使用以下方法：

```
void main() {
    // 启用网络请求输出
    HttpClient.enableTimelineLogging = true;
    runApp(MyApp());
}
复制代码
```

  新的DevTools带来了另一项实验性功能：[安卓“快速启动”](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fflutter%2Fflutter%2Fpull%2F46140)，让开发者开启调试的速度加快70%。这项功能可以通过`flutter run --fast-start -d <your Android Device>`开启。使用功能时，一个仅基于平台代码、不含dart代码和资源变动的“壳”APK包将被安装到设备上。由于修改dart代码或资源并不需要APK重新构建，这会让`flutter run`更快地启动。与传统的启动模式不同，这个功能会将你的代码包装在一个壳中运行。在某些情况下这项功能将无法生效，例如在应用使用了原生插件调用了方法。

  从该版本起，创建新的Flutter应用时，将仅允许创建使用AndroidX的应用。团队已将所有的support API标记为废弃，在创建新项目时`--android`参数是唯一有用的参数。虽然support版本的应用仍然能正常打包，但此时不[迁移](https://link.juejin.cn/?target=https%3A%2F%2Fflutter.dev%2Fdocs%2Fdevelopment%2Fandroidx-migration)更待何时？

  如果开发者是Android Studio或者IntelliJ用户，会发现热重载变得更为灵活了。在以前当分析器认为代码中存在错误（error）时，将阻止开发者热重载。当这些错误并不对你当前正在开发或调试的功能造成影响时，会让你花费更多的时间去处理这些错误，让人恼火。自此分析器不再有权利阻止热重载的进程，而交给VM编译过程来进行判断。

  这些改动都发布在了对应的dev分支，如果开发者想尽快参与到其中，可以通过[此处](https://link.juejin.cn/?target=https%3A%2F%2Fgroups.google.com%2Fforum%2Fm%2F%23!topic%2Fflutter-announce%2FtTgQcTgqrKg)报名。通过参与新版本的测试更频繁的更新，与Flutter团队反馈使用感想，将让编译器插件更加健壮。

  对于VS Code开发者，团队推荐一项新的功能：**Dart: List Outdated Packages（`pub outdated`）**。它可以帮助开发者排查依赖版本不匹配导致的问题。



![img](http://img.cdn.guoshuyu.cn/20211223_Flutter-117/image13)



  最后，如果开发者碰到了Flutter crash，工具将引导开发者以正确的方式上报异常，Flutter团队会密切关注这类错误的严重程度和频率。



![img](http://img.cdn.guoshuyu.cn/20211223_Flutter-117/image14)



## 不兼容的改动

  该版本中包含以下重大不兼容API改动：

- [#42100](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fflutter%2Fflutter%2Fpull%2F42100) [使用pushReplacement时调用secondaryAnimation](https://link.juejin.cn/?target=https%3A%2F%2Fgroups.google.com%2Fg%2Fflutter-announce%2Fc%2Fy0SvesRHlcE%2Fm%2F39TuR5FVDQAJ)
- [#44930](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fflutter%2Fflutter%2Fpull%2F44930) Navigator 2.0 命令式API改动
- [#45940](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fflutter%2Fflutter%2Fpull%2F45940) 废弃UpdateLiveRegionEvent
- [#49389](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fflutter%2Fflutter%2Fpull%2F49389) 延迟快速滚动时的图像解码
- [#49391](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fflutter%2Fflutter%2Fpull%2F49391) Android文本选择溢出
- [#49771](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fflutter%2Fflutter%2Fpull%2F49771) [不对空Painter设置cache断言](https://link.juejin.cn/?target=https%3A%2F%2Fgroups.google.com%2Fg%2Fflutter-announce%2Fc%2FgDfazJIBdDo%2Fm%2Fd5AC8gR3FQAJ)
- [#50318](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fflutter%2Fflutter%2Fpull%2F50318) [实时的图片缓存](https://link.juejin.cn/?target=https%3A%2F%2Fgroups.google.com%2Fg%2Fflutter-announce%2Fc%2FIdfjYvRBR4c%2Fm%2F1_JxffXTGAAJ)
- [#50354](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fflutter%2Fflutter%2Fpull%2F50354) [使用strut box高度计算矩形，以确保它们在可见范围内](https://link.juejin.cn/?target=https%3A%2F%2Fgroups.google.com%2Fg%2Fflutter-announce%2Fc%2FhVP699NQ7PQ%2Fm%2FBgVgmsAdFwAJ)
- [#50733](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fflutter%2Fflutter%2Fpull%2F50733) 为gen_I10n生成信息查询
- [#51435](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fflutter%2Fflutter%2Fpull%2F51435) 从`RouteSettings`中移除`isInitialRoute`
- [#52781](https://link.juejin.cn/?target=https%3A%2F%2Fgithub.com%2Fflutter%2Fflutter%2Fpull%2F52781) 将`mouse_tracking.dart`移动至rendering

## 


作者：AlexV525
链接：https://juejin.cn/post/6844904150182920199
来源：稀土掘金
著作权归作者所有。商业转载请联系作者获得授权，非商业转载请注明出处。