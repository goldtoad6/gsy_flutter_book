# 让 AI 用 Flutter 实现了猗窝座的破坏杀·罗针动画，这个过程如何驯服 AI

在经历了之前的[《用 AI 做了几个超炫酷的 Flutter 动画》](https://juejin.cn/post/7578215424677003327)的抽象实现后，突发奇想先让 AI 做点更炫酷又更具象化的东西，刚好前段时间无限城篇里“三哥”的破坏杀·罗针展开印象深刻，所以就决定用它试试水。

![](https://img.cdn.guoshuyu.cn/ezgif-189aa3c684ac5efa.webp)

整个过程体验下来，只能说，**AI 是很强，但是用过的也都知道，某种程度上其实也没有那么强**，因为你需要和他同频，只有驯服它之后，才能真正做到你想要的效果，比如这个效果我就和 AI 前后摩擦了 50 多个版本才勉强可以接受：

![](https://img.cdn.guoshuyu.cn/ezgif-7ba00a935ebeb303.webp)

首先，我找了一张阵法的原图，然后交给 AI ，尝试让他理解图片里的线条来实现相应的效果，可想而知，结果惨不忍睹：

![](https://img.cdn.guoshuyu.cn/image-20251205095318984.png)

所以一开始我得到的是这样的东西，相信这时候已经开始劝退大多数人了，并觉得 AI 也就这样，根本做不出来我们想要的：

![](https://img.cdn.guoshuyu.cn/image-20251204170955404.png)

但是这对我来说是符合预期的，因为我们给出的提示词其实太空泛了，**并且 AI 也并不能真的完全靠自己理解我们给出的图片画面**，所以我尝试通过丰富提示词来完成，然后在这个过程我就得到了类似下方这样的结果：

![](https://img.cdn.guoshuyu.cn/image-20251204170938809.png)![](https://img.cdn.guoshuyu.cn/image-20251204170855790.png)

这时候时候我开始意识到 AI 真的没能直接理解图片里的画面，所以我换了个思路，尝试通过一些辅助手段让 AI 理解整个构图的形成：

![image-20251204171819155](https://img.cdn.guoshuyu.cn/image-20251204171819155.png)![](https://img.cdn.guoshuyu.cn/image-20251204171830621.png)

在通过提示词和构图坐标理解后，AI 是真的开始理解图片了，至少它是真的能通过红圈明白自己需要做的事情，这也体现在代码的极坐标实现上，然后我就得到了下方的效果：

![image-20251204171913151](https://img.cdn.guoshuyu.cn/image-20251204171913151.png)

看起来是不是还差很多？但是不怕，只要方向是对的就行，接着就是各种微调和纠错工作，这个过程需要不停给出明确指令，并及时纠正 AI 在代码上的错误：

![](https://img.cdn.guoshuyu.cn/image-20251204172014679.png)![](https://img.cdn.guoshuyu.cn/image-20251204170905828.png)![](https://img.cdn.guoshuyu.cn/image-20251204172031318.png)![](https://img.cdn.guoshuyu.cn/image-20251204171637515.png)![](https://img.cdn.guoshuyu.cn/image-20251204171703638.png)![](https://img.cdn.guoshuyu.cn/image-20251204171524245.png)![](https://img.cdn.guoshuyu.cn/image-20251204171723085.png)

当然，这个过程难免还是存在心态爆炸的时候，毕竟当你发现 AI 总是喜欢特立独行，明明你已经纠正他了，但是他还是说：“是的，你的对的，但是我还是要保持我的做法”的时候，不骂两句是真的意难平：

![](https://img.cdn.guoshuyu.cn/image-20251204170756102.png)

> 但是，由于会话长了之后，概率出现上下文丢失，就会出现一些奇奇怪怪的问题，比如本来就生气了，**这里还直接变成使用 Nano Banana pro 给我出图而不是调整代码，心态炸裂**。

当然，在经历多次细节调整后，终于还是画出了我们大概希望的效果，然后就是各种实现细节的打磨，这个时候 AI 对于具体调整的理解就很到位了，并且当你用箭头指出新花样哦修改的位置是，它也能及时调整。

比如我光速告诉它，雪花分叉的末端细节应该有角度的，并且对齐枝干，这时候它就能做出正确的修改：

![](https://img.cdn.guoshuyu.cn/image-20251204171605737.png)![](https://img.cdn.guoshuyu.cn/image-20251204171446964.png)

有时候 AI 改起来太慢了，或者路线已经偏了的时候，就需要人工介入，通过人工进行微调了，然后让 AI 通过你的代码再继续：

![](https://img.cdn.guoshuyu.cn/image-20251204172101685.png)![](https://img.cdn.guoshuyu.cn/image-20251204172231672.png)

最终终于得到了我们需要的阵图效果，虽然还原的不是 100% ，但是再稍微人工调整下，就是可用的状态了：

![](https://img.cdn.guoshuyu.cn/image-20251204172602790.png)

之后就是让阵法绕 X 轴渲染，当然 AI 在最后还是给我来了一锤，看起来提示词是细节是真的一点都不能省：

![](https://img.cdn.guoshuyu.cn/image-20251204172538501.png)

但是有时候 AI 又很贴心，因为它会发现旋转 90 度并不合理，需要让角度调整为 80 % 来实现我们的效果：

![](https://img.cdn.guoshuyu.cn/image-20251204172427106.png)

同时一些实现过程中的  bug 问题，它也能够及时理解改正，并说明原因，这个也是非常不错的场景学习：

![](https://img.cdn.guoshuyu.cn/image-20251204171212783.png)

可以看到，AI 实际上是能理解我们给出的图片的，只是它无法完整且具体的理解，所以需要我们给去具体详细的步骤，甚至帮助它去结构目标效果的构成，从而帮助我们实现最终的效果，这其实也是驯服 AI 的过程。

> **所有妄图在现阶段让 AI 一步到位完成复杂逻辑的想法，大多数时候都会以放弃收尾**。

# 解读实现

最后，我们来解读代码实现，其实整个现实上就是使用了 `CustomPaint` 、`AnimationController` 和 `Matrix4` ，在代码实现结构上，主要有**“多阶段动画调度”、“数学绘图原理”、“3D 空间变换”** 和 **“角色合成特效”** 四个核心部分。

## 多阶段动画调度 

在动画实现上， AI 并没有使用单一的动画控制器，而是定义了四个顺序执行的控制器，模拟出从无到有的“展开”过程，具体实现逻辑是：

- 绘制阶段 (`_drawController`, 4秒): 阵法线条从中心向外生长

- 旋转阶段 (`_rotateController`, 3秒): 阵法绘制完成后开始快速旋转

- 倾斜倒地阶段 (`_tiltController`, 1.5秒): 阵法从 2D 平面倒下变成 3D 地面视角，同时伴随亮度爆发

- 角色显现阶段 (`_characterController`, 1秒): 角色配合光效浮现

同时，利用 `CurvedAnimation` 和 `Interval` 将绘制阶段细分为更自然的子步骤：

- 0% - 20%: 画中心圆
- 20% - 50%: 画内部放射线
- 50% - 75%: 画雪花状组件（六边形数字）
- 75% - 100%: 画外部延伸线

------

## 绘图核心：极坐标系与发光笔触 

因为我提供了阵法的圆周对称的示例，所以整个绘制逻辑都是围绕圆形为基础做布局，其中主要就是以极坐标系为主：

### 1. 极坐标定位 (Polar Coordinates)

阵法是圆周对称的，为了确定 12 个方位的坐标，代码大量使用了极坐标转换公式：

![](https://img.cdn.guoshuyu.cn/image-20251205092736769.png)

在这个实现里，极坐标是绘制整个圆形阵法（罗针）的数学核心，简单来说，就是屏幕绘图使用的是直角坐标系 (x, y)**（向右为 x，向下为 y），而圆形阵法的设计逻辑是基于圆心、角度和距离的，极坐标的作用就是将“角度+距离”翻译成屏幕能理解的“x+y” 。

因为在平面几何中，确定一个点的位置有两种方式：

- 直角坐标: 告诉我你离圆心水平走多远 (x)**，**垂直走多远 (y)
- 极坐标: 告诉我你往 哪个方向 (角度)看，然后 走多远 (r)

对于像“破坏杀·罗针”这种由 12 个重复元素组成的圆周对称图形，使用极坐标是最自然、最高效的方法，所以 `_polarToOffset` 实现了上述的算法，它的作用就类似“翻译官”：

```Dart
// center: 圆心位置 (比如屏幕正中间)
// radius: 半径 (距离圆心多远)
// angle:  角度 (弧度制)
Offset _polarToOffset(Offset center, double radius, double angle) {
  return Offset(
    center.dx + radius * math.cos(angle), // x = r * cos(θ)
    center.dy + radius * math.sin(angle), // y = r * sin(θ)
  );
}
```

- `math.cos(angle)` 计算出水平方向的分量
- `math.sin(angle)` 计算出垂直方向的分量
- 加上 `center.dx` 和 `center.dy` ：把坐标原点从屏幕左上角移动到画布中心

而阵法有 12 个角，圆周是 360，所以每个角间隔 360 / 12 = 30 ：

```Dart
// i 从 0 到 11
// i * 30: 每隔30度一个
// - 90:   数学上的0度通常在"3点钟"方向，减90度是为了让它从"12点钟"方向开始
// * (math.pi / 180): 计算机只认弧度，不认角度，所以要转换
final double angle = (i * 30 - 90) * (math.pi / 180);
```

同时阵法不是一个正圆，而是像雪花一样长短交替的：

- **偶数 (0, 2, 4...)**: 长轴（对应主要的六边形）。
- **奇数 (1, 3, 5...)**: 短轴（内缩的六边形）

```Dart
final bool isLongBranch = (i % 2 == 0); // 判断是否为长轴

// 如果是长轴，半径用 rLongHex (大半径)
// 如果是短轴，半径用 rShortHex (小半径)
final double currentHexRadius = isLongBranch ? rLongHex : rShortHex;
```

有了 **角度 (angle)** 和 **半径 (currentHexRadius)**，代码就开始调用 `_polarToOffset` 算出具体的屏幕坐标点，用来画线、画六边形，代码定义了几个关键点（从圆心向外）：

- **start**: 线条起始点（圆心附近）

- **hexInnerTarget**: 六边形的内侧顶点

- **hexOuter**: 六边形的外侧顶点

- **endInnerTarget**: 最外圈尖刺的顶点

```Dart
// 举例：计算六边形中心的位置
Offset hexCenter = _polarToOffset(center, currentHexRadius, angle);
```

另外，文字也需要角度，当你画位于“3点钟”方向的文字“参”时，文字应该是正的，但当你画“6点钟”方向的文字时，如果直接画，文字可能会歪，所以代码在绘制六边形和文字时，用到了 `canvas.rotate`，这也是基于极坐标思想的延伸：

```Dart
canvas.save();
canvas.translate(hexCenter.dx, hexCenter.dy); // 1. 先把画笔移动到六边形的位置
canvas.rotate(angle + math.pi / 2);           // 2. 旋转画笔，让它对准圆心方向
// ... 开始画六边形 ...
canvas.restore();
```

### 2. 12方位循环与长短区分

循环 12 次绘制雪花瓣，代码通过 `i % 2 == 0` 判断当前是**长轴**还是**短轴**，从而实现错落有致的视觉效果（类似于雪花结构）

```Dart
for (int i = 0; i < 12; i++) {
  final bool isLongBranch = (i % 2 == 0); // 偶数为长轴，奇数为短轴
  // 根据长短轴决定绘制半径 rLongHex 或 rShortHex
}
```

### 3. 霓虹光效实现原理 (Neon Glow)

Flutter 的 `Canvas` 默认没有“发光”属性，所以 AI 代码通过 **“双重绘制”** 模拟发光：

- **底层（光晕层）：** 使用高透明度颜色 + `MaskFilter.blur` (高斯模糊) + 较粗的线条

- **顶层（核心层）：** 使用高亮度实心颜色 + 较细的线条

```Dart
// 1. 画光晕
canvas.drawLine(p1, p2, Paint()
  ..color = glowColor.withValues(alpha: glowOpacity)
  ..strokeWidth = width * 5 * bloomWidth // 笔触加宽
  ..maskFilter = MaskFilter.blur(BlurStyle.normal, 12 * bloomWidth)); // 高斯模糊

// 2. 画高亮实线
canvas.drawLine(p1, p2, Paint()
  ..color = brightColor // 纯亮色
  ..strokeWidth = width);
```

------

##  矩阵变换 (3D Transformation)

阵法一开始是正对着屏幕的（2D），后来倒在地上变成（3D），这是通过 `Transform` 组件配合 `Matrix4` 实现的，具体逻辑是：

- **透视效果 (Perspective):** 设置矩阵的 `(3, 2)` 元素（即 `wz` 因子），产生近大远小的透视感。

- **X轴旋转 (RotateX):** 将平面向后倒下

```dart
Matrix4 transformMatrix = Matrix4.identity();
transformMatrix.setEntry(3, 2, 0.002); // 关键：开启透视，数值越小透视越弱

if (_tiltController.value > 0) {
  transformMatrix.rotateX(_tiltAnim.value); // 这里的 value 是 0 到 -80度
  // 随着倒下，稍微缩小一点比例以适应屏幕
  double scale = 1.0 - (_tiltController.value * 0.2); 
  transformMatrix.scale(scale);
}
```

------

## 角色与光影合成 (Character & Compositing)

最后一步是将人物 `akaza.png` 放置在阵法中心，由于人物图片可能是全身像，中心点在腰部，但阵法中心应该对齐“脚底”，所以代码使用了 `Matrix4.translationValues` 进行了微调：

```Dart
// 向上偏移高度的 42%，让脚底对准阵法中心
transform: Matrix4.translationValues(0, -targetHeight * 0.42, 0),
```

同时为了让 2D 图片看起来融入发光的阵法，代码对人物图片做了特殊的堆叠处理：

- **层1（背光）：** 复制一份图片 -> 使用 `ColorFiltered` 变成纯青色剪影 -> 使用 `ImageFiltered` 进行强高斯模糊，这创造了一个与人物轮廓完全一致的“背光”
- **层2（本体）：** 原始图片覆盖在上方

```Dart
Stack(
  children: [
    // 1. 发光层 (Blur + ColorFilter)
    ImageFiltered(
      imageFilter: ui.ImageFilter.blur(sigmaX: 20.0, sigmaY: 20.0),
      child: ColorFiltered(
        colorFilter: const ColorFilter.mode(charGlowColor, BlendMode.srcIn),
        child: Image.asset(...), // 变成发光的剪影
      ),
    ),
    // 2. 原始图层
    Image.asset(...),
  ],
)
```

同时阵法在倒地之后，也加强了光晕效果，配合任务光晕，这就形成了人物和阵法光晕的融合，也增加了立体感：

![](https://img.cdn.guoshuyu.cn/image-20251205093244520.png)

# 代码链接

https://github.com/CarGuo/gsy_flutter_demo



