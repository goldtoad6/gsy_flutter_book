---
title: "Android 上为什么主题字体对  Flutter 不生效，对 Compose 生效？Flutter 中文字体问题修复"
---

# Android 上为什么主题字体对  Flutter 不生效，对 Compose 生效？Flutter 中文字体问题修复

实际上 Flutter 无法适应 Android 主题字体是一个大家普遍都知道的问题，但是为什么会这样却很少人讲，**如果说是 Skia 自绘导致的，那 Compose 为什么又支持**？今天就让我们用 「古法写文章」来解释这个问题。

![image-20260309161336079](https://img.cdn.guoshuyu.cn/image-20260309161336079.png)

> 更重要的是，**四年了， Flutter 中文字体字重问题终于修复了**。

# 主题字体

首先我们要知道，系统字体一般是位于 `/system/etc/` 下的静态配置，并且在不同 Android 版本下是具有很强的碎片化场景：

| 版本               | 路径                                                         | 特点                                                         |
| ------------------ | ------------------------------------------------------------ | ------------------------------------------------------------ |
| Android 4.0 - 4.4  | `/system/etc/system_fonts.xml`                               | 简单的定义                                                   |
| Android 5.0 - 11.0 | `/system/etc/fonts.xml`                                      | 加了版本号机制，支持通过语言标签（lang）进行复杂的字体回退逻辑 |
| Android 10.0+      | `/product/etc/fonts_customization.xml`                       | 厂商可以在 product 分区进行非侵入式扩展                      |
| Android 12.0+      | `/data/fonts/files/` (动态)                                  | 引入 `FontManagerService`，支持通过数据分区动态更新系统字体  |
| Android 15.0+      | 变量字体的新配置要放进 `font_fallback.xml`，`fonts.xml` 正在被弃用 |                                                              |

所以在不同版本上它的行为是不一致的，但是有一点可以确定的是， **`/system` 分区在运行时通常是只读的**，这就导致 OEM 厂商（比如如小米、华为、Oppo）在实现主题商店中的字体一键切换，是不会直接修改 `fonts.xml` ，在过去普遍采用了“运行时内存替换”或者“反射注入”等方式。

简单来说，过去这就是一个 Hook 操作，而 Hook 的核心一般是 `android.graphics.Typeface` ，因为在原生 Android 里，所有的字体请求最终都会转化为对 `Typeface` 对象的引用，例如 ：

- **sSystemFontMap 反射替换** ：厂商在系统启动或主题切换时，通过 Java 反射机制修改 `Typeface` 类中的静态成员变量 `sSystemFontMap`  ，这个 Map 存储了从 family 名称到具体 `Typeface` 实例的映射，当原生 `TextView` 调用 `setTypeface` 时，系统会从这个被 Hook 的 Map 中返回指向主题字体文件的实例 

- **LayoutInflater 拦截** ：在 XML 布局渲染过程中，`LayoutInflater` 会处理 `android:fontFamily` 属性，厂商也可以在 `LayoutInflater.Factory2` 中注入逻辑，在 View 创建阶段就强制应用特定的 `Typeface` 实例 

- **Typeface** ：例如某些系统中就有用过 `Typeface` 的扩展，这些扩展重写了字体粗细（Weight）和风格（Style）的匹配逻辑，从而支持的“无级字体粗细调节”等场景

而 Flutter 大家都知道，之前走的是独立的 Skia ，现在是独立的 Impeller （字体部分还是 Skia libtxt/SkParagraph 逻辑），但对于 Flutter 来说，Android 上的文本渲染主要走 engine/native 字体栈，不直接依赖 Java 层 `android.graphics.Typeface` 的解析结果，所以并不会被 Hook ，简单对比就是：

- 原生 `TextView` 的渲染使用 的`TextPaint`  ，最终会调用 `Canvas.drawText`，而这个过程需要传入一个 `Typeface` 对象，这个 `Typeface` 对象正是 Hook 生效的地方 

- Flutter 的渲染流程是： `Dart (TextStyle) -> C++ Engine (Libfont) -> Skia (SkFontMgr) -> 直接读取.ttf 文件 -> GPU 绘制` 

**所以 Flutter 大部分时候都会忽略掉系统的主题字体，只会使用默认字体**，而这个问题在 Flutter Web 更复杂，因为现在 Flutter Web 默认都是 CanvasKit  模式，是通过编译成 WebAssembly 在 Web 上运行，为了保证渲染一致性，CanvasKit 往往会直接加载开发者提供的字体文件，或者使用一套预定义的默认字体：

> **也就是 Flutter Web 和系统（Android 或 iOS）的字体系统几乎完全隔离**，所以就更不用说了。

那问题来了，**为什么使用 Skia 的 Compose 可以呢**？

这是因为虽然 Compose 在 Android 渲染（Drawing）阶段，确实通过 Skia（通过 `RenderNode` 或 `HardwareCanvas` 提供支持）绘制，**但它在字体解析阶段并没有像 Flutter 那样完全隔离**，例如：

- Compose 的 `Text` 组件使用  `FontFamily.Resolver` 来处理字体请求 

- 在 Android 平台上，Compose 的  `FontFamily.Resolver` 实现类会调用 `androidx.compose.ui.text.platform` 中的逻辑，**Compose Android 文本栈会解析到 Android 的 `Typeface` / `TextPaint` / `Layout` 实现上，而不是像 Flutter 那样完全走一套独立的引擎字体发现链路**

- 所以 Compose 实际上是在 Java 层向系统请求 `Typeface` 对象的，它自然会触发 OEM 厂商在 `Typeface` 类中注入的 Hook 

- Compose 拿到系统返回的 `Typeface` 后，会将它包含的信息转化为底层渲染引擎可识别的参数，因为它使用的是 Android 系统自带的 Skia 环境，而 Android 系统的 `Paint` 类原生就支持将 `Typeface` 对象传递给底层的绘制命令 

当然，要是主题字体实现是通过 Hook TextView 的方案，那对 Compose 也是不支持的，Compose  只对 `Typeface` 的 Hook 方案生效。

> 额外提一句：  **Flutter 3.41 新增 `FontWeight` 直接控制变量字体 `wght` 轴的能力**， `FontWeight` 现在支持 `1-1000` 任意值，同时 `FontWeight.index` 被废弃，修改为 `FontWeight.lerp`  连续插值，但是这和 Android 系统的可变字体也不是一回事。

同时 ，Flutter 引擎的字体管理仍然主要依赖 Skia，或者说在 Impeller 中嵌入的 HarfBuzz/FreeType 等，并没有通过 Android NDK 的 `AFontMatcher` 来匹配系统字体，所以 **Flutter 并不会使用 Android 系统当前主题的字体映射** 。

最后，我们通过文字渲染的三个核心阶段来理解 Flutter 里的字体渲染，把文字从一个 `String` 变成屏幕上的像素，需要经过三个阶段：

- 字体加载与匹配 ：例如 "sans-serif 粗体对应哪个 .ttf 文件？" ，通过 SkFontMgr 实现（Skia 的字体管理器）
- 文本整形（Shaping）：例如 "这段阿拉伯文/印地语应该怎么连字、换序？每个字符用字体里的哪个 Glyph？"，通过 HarfBuzz 实现
- 光栅化（Rasterization）：例如 "把这个 Glyph 轮廓变成像素位图" ，通过 FreeType 实现

它们的关系就像流水线大概类似：

![](https://img.cdn.guoshuyu.cn/%E6%9C%AA%E5%91%BD%E5%90%8D%E6%96%87%E4%BB%B6%20(1).jpg)

所以，Skia 的 SkFontMgr 负责的就是我们所说的匹配字体部分：

- 扫描系统字体目录
- 解析字体配置文件
- 按字体名 + 粗细 + 风格匹配到具体的 .ttf 文件
- 提供 Fallback 链（找不到字符时自动换字体）

而 HarfBuzz  文本整形引擎（Text Shaper）解决的是一个字符串不能简单地逐字符渲染问题：

- 阿拉伯文：字母在词首、词中、词尾形态不同，还要从右到左排列
- 印地语/泰语：元音符号要叠在辅音上面或下面
- 英文：`fi` 组合可能变成一个连字（ligature）
- Emoji：`👨‍👩‍👧‍👦`（一家人）其实是多个 code point + ZWJ（零宽连接符）组合

HarfBuzz 读取字体文件中的 OpenType 排版表（GSUB/GPOS 等），决定：

- 每个字符对应字体中的哪个Glyph ID
- 每个 Glyph 的精确位置偏移
- 哪些字符需要合并、替换、重新排序

而最后 FreeType  字体解析与光栅化引擎，它主要负责：

- 解析字体文件：读取 .ttf/.otf 文件，提取 Glyph 轮廓（贝塞尔曲线）
- 光栅化：把矢量轮廓转化为像素位图（bitmap），考虑亚像素抗锯齿（subpixel anti-aliasing）、hinting 等

而回到匹配字体问题上，在 Android 上，Flutter 使用 Skia 的 Android 字体管理器 `flutter / engine / third_party / txt / src / txt / platform_android.cc` :

![](https://img.cdn.guoshuyu.cn/image-20260310091025600.png)

这里的 `SkFontMgr_New_Android(nullptr)`   就是 Skia 提供的 Android 字体管理器，传入 `nullptr` 意味着使用**默认配置**，也就是去解析 `/system/etc/fonts.xml` 来发现系统字体，这个 `SkFontMgr_New_Android` 内部就使用了 FreeType 来解析字体文件。

同时，通过 `flutter / engine / impeller / typographer / backends / skia / text_frame_skia.cc` 可以看到，即使是 Impeller 的 Typographer 后端，也叫 `TypographerContextSkia`，它从 `SkTextBlob`（Skia 的文本对象）中提取 Glyph 信息，然后用 Impeller 自己的渲染管线去绘制 ：

![](https://img.cdn.guoshuyu.cn/image-20260310091152734.png)

> 所以 Impeller 替换的是"最终的 GPU 渲染管线"，而不是文本整形和字体管理，字体发现（`SkFontMgr`）、文本整形（HarfBuzz）、字体解析（FreeType）这些工作目前仍然是 Skia 生态在做。

而 OEM 主题字体（如小米主题商店下载的字体）通常不是写在 `fonts.xml` 里的，就算高版本 Android 而是通过 `FontManagerService` 动态替换的，但是 `SkFontMgr_New_Android` 不会调用 `FontManagerService`，它只是静态地读文件，所以 Flutter 的 `SkFontMgr` 根本看不到 OEM 动态替换的主题字体

这就是为什么 Flutter 至今无法自动渲染手机厂商的自定义主题字体的原因，问题不在 Impeller 还是 Skia，问题在「字体发现」这一层用的是文件解析而非系统 API。

而 Compose 在 Android 上的系统字体解析，仍然会接入 Android 平台的 `Typeface` / 字体解析能力，因此如果 OEM 的主题字体替换落在这条链路上，所以一般情况下 Compose 还是可以生效。

> 不过在其他平台，比如 iOS 上 Compose 就和 Flutter 半斤八两了，比如在 Compose Multiplatform 的 1.6.0 就提供了 `SystemFont`  来支持开发者**直接调用操作系统已安装字体**，所以 Compose 也就在 Android 平台对比 Flutter 有历史字体优势。

# 字重修复

最后，不得不提一下，我 2022 年提的一个中文字重渲染不对的问题，最近终于被解决了，太感动了：

![](https://img.cdn.guoshuyu.cn/image-20260409103807184.png)

主要原因是因为 **`CTFontCreateForString()`  的 API 不会保留输入字体的 `fontWeight`**，一般来说，Flutter 的文本渲染链路是：

![](https://img.cdn.guoshuyu.cn/image-20260409105712596.png)

而当渲染的字符（中文）不在当前主字体（SF Pro）中时，Skia 需要通过 CoreText 的 `CTFontCreateForString()` 进行 fallback 字体查找，问题是 **`CTFontCreateForString()` 在查找 fallback 字体时，会忽略传入的 fontWeight**，这就导致永远返回 `weight=400 (Regular)`  的字体。

而英文在 SF Pro 内，所以不会受到影响，**只有  CJK 字符才会触发 fallback 导致出现问题** ，这也是为什么显式指定 `PingFang SC` 作为主字体或 fallback 可以解决问题的原因，CoreText  在查找 `PingFang SC` 的字重时走的是 **`matchFamilyStyle`**（按族名匹配字重）而不是 `CTFontCreateForString()` ，所以字重会被保留。

最终修复是在 skia 上进行了处理，其实就是直接修改 `SkFontMgr_mac_ct.cpp` 中的 fallback 逻辑，让 CoreText 在字符 fallback 时正确保留字重就好了：

![](https://img.cdn.guoshuyu.cn/image-20260409110455652.png)

那这个问题为什么拖这么久？因为要等 skia 有时间去修复和支持啊，虽然上层可以做一个 Wrapper 来临时处理，但是 Flutter 团队还是觉得问题补丁不应该在上层去堆砌。

**其实这也是 Flutter 为什么搞 Impeller 的原因，Skia 的问题推进速度太慢了**，如果真的等 Skia 的 Graphite  来做着色器预热，还真不知道等到何年，毕竟 Skia 团队要考虑的很多，而现在 Impeller 反而在反哺 Skia  的 Graphite ，甚至 Impeller 都开始对外被 Avalonia 投资移植到  .NET 平台，只能说当时做 Impeller 真的就是 Flutter 最正确的决定。

所以这个坑这么多年了，终于还是等到 Skia 团队的补丁，也算是解决了一个陈年小刺了。

















