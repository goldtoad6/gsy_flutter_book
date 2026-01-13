

# Flutter 小技巧之帮网友理解 SliverConstraints  overlap

本期主要是应网友要求，写一个简单解答，其实 `SliverConstraints.overlap` 并不复杂，因为用起来也很简单，但是如果没正确理解它作用的时候，就会出现类似这位网友的困惑，确实官方的注释写的可能太过抽象，以至于如果你想通过注释理解它的作用，会感觉比较晦涩难懂：

| ![](https://img.cdn.guoshuyu.cn/image-20251229084659133.png) | ![](https://img.cdn.guoshuyu.cn/image-20251229084556427.png) |
| ------------------------------------------------------------ | ------------------------------------------------------------ |

首先 `overlap` 的**本质就是视觉与布局的“差值”**，它就是一个差值的概念，基于这个核心去理解就会很好明白，简单说， 在 Sliver 协议中需要区分两个概念：

- **Layout Extent（布局范围）**：Sliver 在滚动视图中实际占据的“物理位置”大小，它决定了下一个 Sliver 从哪里开始排版，比如 `CustomScrollView` 里两个 Sliver 顺序排列
- **Paint Extent（绘制范围）**：当前 Sliver 在屏幕上实际画出来的像素大小

而 `overlap` 的官方注释简单说就是：

> 当前 Sliver 之前的所有 Sliver（主要是 Pinned 或 Floating 状态的 Sliver），它的**绘制范围**超出了**布局范围**的总和。

是不是还是有点抽象？说人话其实就是：

> Sliver3 问 Viewport：“轮到我出场了吗？” 
>
> Viewport 说：“轮到你了，但是 Sliver1 和 Sliver2 赖在头顶不走（Pinned），它们虽然在布局上已经滚上去了（LayoutExtent 变小或为 0），但它们还画在屏幕上（PaintExtent 依然存在），所以你的头顶有 X 个像素被它们挡住了。”
>
> **这个 X 就是你的 `overlap`**。

那回答那位网友的疑问，为什么会是“负数”？ 最常见就是 **`BouncingScrollPhysics` (iOS 风格的回弹效果)** 的场景，比如下方就是一个 `BouncingScrollPhysics` 的使用场景：

![](https://img.cdn.guoshuyu.cn/ezgif-23fd1b7ec68fd901.gif)

对于顶部回弹 (Overscroll)场景，当你在列表顶部下拉（OverScroll）时，scrollOffset 会变成负数（例如 -50.0），虽然标准的 overlap 计算通常是累加前面的 Pinned 头部，但在处理过度滚动(OverScroll)时，Viewport 为了维持数学上的连续性，或者某些自定义 Sliver 在计算约束时，会将这个“负的滚动偏移”透传进约束计算中：

> 列表在最顶部被拉下来，实际 UI 上产生了一个“空隙”，这个负的 overlap 可以理解为：**“不仅没有重叠，离被重叠还差 50 像素的距离”**。

另外还有一种可能，就是**SliverGeometry 的 paintOrigin 修正** ，在一些复杂的 `NestedScrollView` 实现里面，如果 Header 处于展开过程中，可能会通过负的 overlap 来通知后续 Sliver 进行位置补偿。

最后，我们假设一个场景：

- **Sliver1**: Pinned Header (高度 60)
- **Sliver2**: Pinned Header (高度 60)
- **Sliver3**: 普通 List
- **当前状态**: 列表向上滚动了 200

然后首先就是  Sliver1 ：

- 它被 pin 在顶部
- `scrollOffset`: 200 (它本该滚出去 200，但它没动)
- `layoutExtent`: 0 (它在滚动流中不再占据空间，空间留给后面的人)
- `paintExtent`: 60 (它依然画在屏幕上)
- 差值: 60 - 0 = 60。它产生了一个 60 的视觉遮挡

然后就是 Sliver2 ：

- 它紧贴着 Sliver1 pin 
- `constraints.overlap`: 60 (来自 Sliver1 的遮挡)
- `layoutExtent`: 0 (同样不占位)
- `paintExtent`: 60
- 差值: 自身产生 60 - 0 = 60。
- 累计遮挡: 之前的 60 + 现在的 60 = 120

Sliver3 ：

- Viewport 告诉 Sliver3：`constraints.overlap = 120` ，Sliver3 的布局起始点虽然是从 `scrollOffset` 计算出来的，但在视觉上，Sliver3 的前 120 会被 Sliver1 和 Sliver2 盖住。

具体代码可以参看如下例子，**运行后如图所示，注意看悬浮框的内容输出，就可以很清晰感受到 `overlap` 在正数之间累积和负数时的效果**：

```dart
import 'package:flutter/material.dart';
import 'package:flutter/rendering.dart';

void main() {
  runApp(const MaterialApp(home: OverlapDeductionDemo()));
}

class OverlapDeductionDemo extends StatefulWidget {
  const OverlapDeductionDemo({super.key});

  @override
  State<OverlapDeductionDemo> createState() => _OverlapDeductionDemoState();
}

class _OverlapDeductionDemoState extends State<OverlapDeductionDemo> {
  final _handle = SliverOverlapAbsorberHandle();
  final ValueNotifier<String> _logNotifier = ValueNotifier("等待滚动...");

  final Map<String, String> _logState = {};

  @override
  void dispose() {
    _logNotifier.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
        ///需要注意，这个的AppBar 会影响 overlap 数值，如果没有，会多这部分像素点返回
      appBar: AppBar(title: const Text("Overlap Debug")),
      backgroundColor: Colors.grey[50],
      body: Stack(
        children: [
          CustomScrollView(
            physics: const BouncingScrollPhysics(
                parent: AlwaysScrollableScrollPhysics()),
            slivers: [
              SliverLayoutBuilder(
                builder: (context, constraints) {
                  updateLogDisplay("Sliver 1", constraints.scrollOffset, constraints.overlap);

                  return SliverAppBar(
                    title: const Text('Sliver 1 (Pinned)'),
                    backgroundColor: Colors.red.withOpacity(0.7),
                    pinned: true,
                    stretch: true,
                    toolbarHeight: 60,
                    collapsedHeight: 60,
                    expandedHeight: 60,
                    elevation: 0,
                    flexibleSpace: FlexibleSpaceBar(
                      background: Container(color: Colors.red.withOpacity(0.7)),
                      stretchModes: const [
                        StretchMode.zoomBackground,
                        StretchMode.blurBackground
                      ],
                    ),
                  );
                },
              ),
              SliverList(
                delegate: SliverChildBuilderDelegate(
                      (context, index) => Container(
                    height: 50,
                    color: Colors.grey[300],
                    alignment: Alignment.center,
                    child: Text('中间填充 Item $index',
                        style: const TextStyle(color: Colors.grey)),
                  ),
                  childCount: 5,
                ),
              ),
              SliverOverlapAbsorber(
                handle: _handle,
                sliver: SliverLayoutBuilder(
                  builder: (context, constraints) {
                    updateLogDisplay("Sliver 2", constraints.scrollOffset, constraints.overlap);
                    return SliverAppBar(
                      title: const Text('Sliver 2 (Pinned)'),
                      backgroundColor: Colors.blue.withOpacity(0.7),
                      pinned: true,
                      toolbarHeight: 60,
                      collapsedHeight: 60,
                      expandedHeight: 60,
                      primary: false,
                      elevation: 0,
                    );
                  },
                ),
              ),
              SliverLayoutBuilder(
                builder: (context, constraints) {
                  final currentOverlap = constraints.overlap;
                  final offset = constraints.scrollOffset;
                  updateLogDisplay("Sliver 3", offset, currentOverlap);

                  return SliverMainAxisGroup(
                    slivers: [
                      SliverOverlapInjector(handle: _handle),
                      SliverList(
                        delegate: SliverChildBuilderDelegate(
                              (ctx, index) {
                            return Container(
                              height: 50,
                              color: index == 0
                                  ? Colors.green[900]
                                  : (index.isEven
                                  ? Colors.green[200]
                                  : Colors.green[100]),
                              alignment: Alignment.center,
                              child: Text(
                                index == 0
                                    ? '我是头部 (Item 0)'
                                    : 'Sliver 3 - Item $index',
                                style: TextStyle(
                                    color: index == 0
                                        ? Colors.white
                                        : Colors.black),
                              ),
                            );
                          },
                          childCount: 20,
                        ),
                      ),
                    ],
                  );
                },
              ),
            ],
          ),
          Positioned(
            top: 100,
            right: 16,
            child: ValueListenableBuilder<String>(
              valueListenable: _logNotifier,
              builder: (context, value, child) {
                return Container(
                  padding: const EdgeInsets.all(12),
                  decoration: BoxDecoration(
                    color: Colors.black.withOpacity(0.8),
                    borderRadius: BorderRadius.circular(8),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.2),
                        blurRadius: 8,
                        offset: const Offset(0, 4),
                      )
                    ],
                  ),
                  child: Text(
                    value,
                    style: const TextStyle(
                      color: Colors.greenAccent,
                      fontFamily: 'Courier',
                      fontSize: 12,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                );
              },
            ),
          ),
        ],
      ),
    );
  }

  void updateLogDisplay(String name, double offset, double overlap) {
    String status = "";
    if (overlap > 0) {
      status = "-> 被遮挡: ${overlap.toStringAsFixed(1)}";
    } else if (overlap < 0) {
      status = "-> 顶部回弹/未接触";
    } else {
      status = "-> 无遮挡";
    }

    final singleLog = '[$name]\n'
        'Offset : ${offset.toStringAsFixed(1)}\n'
        'Overlap: ${overlap.toStringAsFixed(1)}\n'
        '$status';

    _logState[name] = singleLog;

    final sortedKeys = _logState.keys.toList()..sort();
    final combinedLog = sortedKeys.map((k) => _logState[k]).join('\n------------------\n');


    if (_logNotifier.value != combinedLog) {
      WidgetsBinding.instance.addPostFrameCallback((_) {
        if (mounted) {
          _logNotifier.value = combinedLog;
        }
      });
    }

    print('$name -> Offset:$offset, Overlap:$overlap');
  }
}
```

![](https://img.cdn.guoshuyu.cn/ezgif-883e9858bca2d7ea.gif)

那么这时候的 Sliver3 该如何使用 `overlap` ？简单来说可以有：

1、无视，Sliver3 依然照常从 0 开始画，结果 是 Sliver3 的前 120px 内容被 Sliver1 和 Sliver2 盖住，用户看不见，这就是我们常说的“内容穿过 Header 滚上去”

2、平移绘制，在返回 `SliverGeometry` 时，设置 `paintOrigin = constraints.overlap`，结果就是 Sliver3 的内容整体向下平移 120px，刚好处在 Header 下方，这也是 `SliverOverlapInjector` 的工作原理，它作为一个透明的占位符，把这 120px 的 overlap “吃掉”（注入成 layoutExtent），让后面的能正常显示

3、部分绘制，可以让 Sliver3 只绘制露出来的部分，在计算 `paintExtent` 时，考虑 `overlap` ，例如 `paintExtent = max(0.0, calculatedSize - constraints.overlap)`

所以现在可以理解了吧：

- **正数 Overlap**：代表**“被上方 Pinned 元素遮挡的像素量”**，计算公式是累加前面所有 Pinned Sliver 的 `(paintExtent - layoutExtent)`
- **负数 Overlap**：通常出现在 **OverScroll（回弹）** 阶段，代表**“距离由于回弹产生的顶部空隙的距离”**，或者理解为“负的遮挡”

> 实际上，如果在自定义 Sliver 的  `performLayout` 中打印 `print('Overlap: ${constraints.overlap}, ScrollOffset: ${constraints.scrollOffset}');` ，就会看到负数 `overlap` 和负数 `scrollOffset` (回弹) 往往成对出现。

