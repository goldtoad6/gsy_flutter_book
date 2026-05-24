---
title: "WasmGC 是什么？为什么它对 Dart 和 Kotlin 在 Web 领域很重要？"
---

# WasmGC 是什么？为什么它对 Dart 和 Kotlin 在 Web 领域很重要？

最近刚好和网友讨论了下 Wasm ，然后聊到了 WasmGC ，好像大家对它的存在还不太了解，觉得它是不是就是 JVM 上的 GC ？有什么特别意义？其实事实上还是不大一样。

首先需要说一下，有了 WasmGC 之后，Kotlin 和 Dart 在 WebAssembly 才算是完整的 Native ，**WasmGC 的出现是 WebAssembly 发展史上的一个重大里程碑**。

最开始 WebAssembly 设计目标非常明确：**让 C/C++/Rust 这种手动管理内存的语言能在 Web 上高效运行**，所以涉及理念就是，越接近硬件越好，越简单越好。

所以一开始 Wasm  就没有 GC 这个概念，Wasm 只提供一个 `Linear Memory`（本质上就是一个巨大的 `ArrayBuffer`），这对于 C++ 来说，这就像物理内存（RAM），它自己在里面 `malloc` 和 `free`，浏览器完全不需要知道这堆字节里哪里是对象，哪里是空闲的。

![](https://img.cdn.guoshuyu.cn/image-20260123133440339.png)

但是后来 WebAssembly  发现，各种第三方语言如 *Java, Kotlin, Dart, Go, Python* 等都在将语言适配到 Wasm 上时，社区里对于 GC 的呼声就越来越大，例如：

> 在 WasmGC 出现之前，如果你想跑 Kotlin 代码，你必须把 Kotlin 的整个垃圾回收器和运行时（Runtime）编译成 Wasm，和你的业务代码打包在一起，可想而知产物的体积就大了不少。

![](https://img.cdn.guoshuyu.cn/image-20260123110250833.png)

在没有 WasmGC 的时候，Flutter 和 CMP 在 Web 端的 Wasm 产物体积都很大，并且自带 GC 的效率也低，还容易导致内存泄漏（尤其是引用环问题），举个例子：

- 因为 Wasm 的原生栈对指令是不可遍历的，自带的 GC 无法扫描栈上的引用，编译器必须在内存里手动维护一个“影子栈”来记录活跃对象，**这非常慢且极大地增加了代码膨胀**。
- 如果 JS 持有一个 Wasm 对象的 ID，Wasm 对象又持有一个 JS 对象，两边的 GC 是隔离的（Wasm 的 GC 不知道 JS，JS 的 GC 不知道 Wasm 的内存布局），这会导致严重的内存泄漏，除非手动打破循环 。

> 引用环问题其实在之前 KMP 适配鸿蒙上也有对应问题。

而在引入 WasmGC 之后， Wasm 代码**可以直接复用宿主环境（浏览器 V8/SpiderMonkey）已有的强大 GC**，对于第三方语言来说，不再需要自己带一个 GC 算法或者 Runtime 。

![](https://img.cdn.guoshuyu.cn/image-20260123133531921.png)

简单来说， WasmGC  其实就是引入了 `struct`（结构体）和 `array`（数组）这两种核心类型，编译器（如 Kotlin 编译器）不再操作字节偏移量，而是生成指令说：“给我 new 一个 `MyClass` 结构体”。

> 至于这个结构体放在内存哪、什么时候回收，完全由浏览器（如 V8）说了算。

也就是，实际上 **WasmGC： 只定义了“类型”（我有引用、我有结构体）和“操作”（读取字段、创建对象）**，至于这个对象是放在新生代还是老年代、用标记清除还是引用计数、什么时候触发 GC，完全是 V8 (Chrome) 或  Safari  自己的事。

> 所以 WasmGC 需要浏览器支持，严格说，是 Chrome 119（2023 年 10 月/11 月左右）正式默认开启了 WasmGC 支持，如今现在主流浏览器（Chrome, Firefox, Safari）的最新版都已经支持。

事实上 WasmGC 就是类型变革，在此之前只有 `i32`, `i64`, `f32`, `f64` ，对象指针只是一个 `i32` 整数，而新的规则其实就是引入了引用类型：

- `structref`: 指向结构体的引用
- `anyref`: 指向任何宿主对象（如 JS 对象）的引用
- `i31ref`: 专门用于优化小整数（Smi）的高效引用类型

所以 WasmGC 的核心不是“发明了一种 GC 算法” ，而是**把“可被 GC 管理的对象引用”变成 Wasm 指令集与类型系统的一等公民**，让语言编译器可以把对象/数组的布局和类型信息交给引擎，从而让引擎的 GC 能正确追踪对象图，在实现了 WasmGC  之后：

- 浏览器本身就能扫描 Wasm 的栈，因此不再需要维护昂贵的“影子栈”。
- 解决了循环引用问题，因为所有对象都在同一个堆图（Heap Graph）中

从结果上，对于 Kotlin/Wasm 或 Flutter/Wasm 来说是产品的可用性得到了提升：

- 包体积骤减
- 启动速度飙升
- 内存效率与碎片化问题得到解决

![](https://img.cdn.guoshuyu.cn/image-20260123133816790.png)

**还有一个可以做到的明显提升就是互操作性提升**：

- 在 WasmGC 之前，把字符串从 Wasm 传给 JS 需要拷贝内存（因为 JS 读不懂 Wasm 的线性内存）
- 现在 Wasm 可以直接持有一个 JS String 的引用，或者 JS 直接持有一个 Wasm 的 Struct，不需要拷贝

而对于大家，肯定关心的是通用性问题：

- **Flutter 已经把 Web 完全押注在 Wasm** ，它觉得自己的定位是 Canvas 定位，在 js 领域竞争不过 Vue 、React 等框架
- 对 CMP 而言，Kotlin/Wasm 的 Web 即将成为重要组成部分

最后，整个 WasmGC 前后标准化和实现周期经历了：

- 2017 - WebAssembly MVP 发布:

  - 仅支持线性内存，主要面向 C++/Rust，此时 Kotlin/Dart  走自带 Runtime 的弯路

- 2019 - WasmGC 提案起步:

  - 社区开始意识到，没有 GC，托管语言在 Web 上永远是“二等公民”

- 2021~2022 - 原型验证与标准推进:

  - Chrome V8 团队和 Firefox 开始实验性实现，**Dart 和 Kotlin 团队深度参与**，提供反馈

- 2023 年 4 月 - Kotlin/Wasm (Experimental):

  - JetBrains 发布 Kotlin 1.8.20，开始实验性支持 Wasm 目标，且明确表示基于 WasmGC 规范

- 2023 年 10 月/11 月 - 关键转折点 (Chrome 119):

  - **Chrome 119 正式默认开启 WasmGC** ，属于是重要的里程碑，意味着用户无需开启 `flag` 就能运行 WasmGC 程序。
  - Firefox 120 紧随其后开启支持

- 2023 年 12 月:

  - Kotlin/Wasm 进入 Alpha 阶段，底层完全依赖 WasmGC

- 2024 年 

  - **Flutter 3.22 正式宣布 Wasm 支持进入 Stable 阶段**，依赖 WasmGC 实现了 2-3 倍的渲染性能提升

  - Safari 正式支持 WasmGC，至此**三大主流浏览器内核（Blink, Gecko, WebKit）全部就位**

  - 随着 iOS 18+ 和 Android 15 的普及，以及旧版本浏览器的自然淘汰，**支持 WasmGC 的环境成为主流**

- 2025 年

  - Kotlin/Wasm 进入 Beta 阶段

  - 非浏览器 WebAssembly runtimes（如 Wasmtime / Node.js 生态）开始逐步跟进 GC 支持，**推动服务端/边缘场景进一步扩展**

![](https://img.cdn.guoshuyu.cn/image-20260123150747320.png)

所以，可以看到 WasmGC 对于 Wasm 的流行和推动有多么重要，而 Wasm 也出了其他语言在  Web 和边缘计算场景下的高性能选择之一，可以说，有了 WasmGC 之后， WebAssembly  才引来了它的春天。

# 参考链接

https://github.com/WebAssembly/gc/blob/main/proposals/gc/Overview.md

https://kotlinlang.org/docs/wasm-overview.html