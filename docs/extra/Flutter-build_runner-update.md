---
title: "Flutter 的 build_runner 已经今非昔比，看看 build_runner 2.13 有什么特别？"
---

# Flutter 的 build_runner 已经今非昔比，看看 build_runner 2.13 有什么特别？

相信写过 Flutter 的都对 `build_runner` 不太感冒，主要是它在过去表现出来的性能太差，而且失败率又高，所以很多人对于  `build_runner` 的印象也一直停留在这里，能不用就不用。

但是随着这些年过去，其实 `build_runner` 已经变了不少，特别是从 v2.7.0 到 v2.13.0 ，通过加入了 **AOT 编译、大幅减少 I/O 与序列化开销、还有优化代码分析流程**等支持，现在版本的性能已经提升了不少。

特别是 2.13.0 版本，在官方的测试里，**它针对大型增量构建实现了最高 4 倍的加速**，具体测试环境和指标为：

- **测试环境**：在单 CPU Linux 机器上运行，所有代码均经过 **AOT 编译**（使用 `--force-aot`），消除了 JIT 预热时间的影响
- **项目规模**：通过库（libraries）的数量（1000、5000、10000）来衡量项目的复杂程度
- init（初始构建）：从零开始的全量构建
- incr（增量构建）：在已有构建结果的基础上，修改少量代码后进行的再次构建。
- web：同时应用 `built_value` 生成和 DDC（Dart Dev Compiler）编译的场景，更接近真实的 Web 开发流程

![](https://img.cdn.guoshuyu.cn/image-20260318153229326.png)

测试的结果可以看到，**越大的项目提升越明显**，从速度提升倍数可以看出：

- 在 **1000** 个库的小型项目中，初始构建提升约为 **1.4x**
- 在 **10000** 个库的大型项目中，初始构建提升达到了 **3.0x**，而增量构建更是达到了 **3.9x**

另外，在所有规模下，**增量构建（incr）的提升倍数普遍高过初始构建**（init）：

- **10000 incr** 的平均耗时从 v2.12 的 **45.72 秒** 降到 v2.13.0 的 **11.80 秒**

![](https://img.cdn.guoshuyu.cn/image-20260318153521325.png)

另外  "and analyzer"  也可以看出来，当 `build_runner` 配合下一代 Dart Analyzer 优化后的表现：

- 在 10000 个库的增量构建中，速度提升将达到 **4.8x**
- 原本 45.72 秒的任务（v2.12），在双重优化下仅需 **9.46 秒** 即可完成

如果以 10000 库为基准，这个对比就很明显了：

| 版本阶段           | 初始构建 (init)   | 增量构建 (incr)   | Web 增量构建      |
| ------------------ | ----------------- | ----------------- | ----------------- |
| v2.12 (旧版)       | 48.75s            | 45.72s            | 55.24s            |
| v2.13.0 (新版)     | 16.12s (**3.0x**) | 11.80s (**3.9x**) | 18.11s (**3.1x**) |
| v2.13 + 新版分析器 | 12.48s (**3.9x**) | 9.46s (**4.8x**)  | 15.63s (**3.5x**) |

> **而且这还是 2.13 对比 2.12 ，实际上从 2.10 开始本身就对比过去有不少提升**。

实际上，在 v2.10.0 - v2.12.0 也有不少性能提升的场景，例如：

- AOT 编译构建器 (v2.10.0)：
  - 开始加入 `--force-aot` 标志，以往 Builder 运行在 JIT 模式下，冷启动慢，而 AOT 模式下 Builder 启动更快且吞吐量更高
- findAssets 扩展性优化 (v2.10.1)：
  - 大幅提高了在拥有数千个文件的包中进行前缀匹配的速度。
  - 使用 `source_gen` 共享部分（如 `built_value` 和 `json_serializable`）的项目可以得到优化
- 库循环处理优化 (v2.10.3)：
  - 优化了分析驱动程序处理库循环的逻辑，显著加快了大型代码库的构建速度

所以一直到 2.13 版本，这些修改带来的提升，主要涉及：

- **不需要序列化的资源图克隆**

  - 在 `watch` 或 `serve` 模式下，每次构建之间需要重置资源图（Asset Graph），老版本需要将图序列化到磁盘再读回的“往返”操作

  - 而 2.13 在 `graph.dart` 中引入了 `copyForNextBuild` 方法，直接在内存中克隆节点树，**在频繁保存代码触发的增量构建场景就很实用**：

    ```dart
    AssetGraph copyForNextBuild(BuildPhases buildPhases) {
      return AssetGraph._with(
        nodes: _nodes.clone(), // 直接克隆内存中的节点，避免序列化
        // ... 复制其他元数据
        previousInBuildPhasesOptionsDigests: inBuildPhasesOptionsDigests,
        inBuildPhasesOptionsDigests: buildPhases.inBuildPhasesOptionsDigests,
        // ...
      );
    }
    ```

    

- **复用语法错误计算结果**

  - Resolver 在处理库时需要检查语法错误，通过复用 Analyzer 已有的解析结果，可以避免重复计算

    ```dart
    Future<List<AnalysisResultWithDiagnostics>> _syntacticErrorsFor(
      LibraryElement element,
    ) async {
      final parsedLibrary = _driver.currentSession.getParsedLibraryByElement(element);
      if (parsedLibrary is! ParsedLibraryResult) return const [];
    
      final relevantResults = <AnalysisResultWithDiagnostics>[];
      for (final unit in parsedLibrary.units) {
        if (unit.diagnostics.any((error) => error.diagnosticCode.type == DiagnosticType.SYNTACTIC_ERROR)) {
          relevantResults.add(unit);
        }
      }
      return relevantResults; // 利用 Analyzer 会话中的缓存结果
    }
    ```

- **复用 Trigger 配置摘要**

  - Builder 可以配置 `triggers`（触发器），只有满足特定条件（如存在特定注解或导入）时才运行，v2.13.0 开始缓存这些配置的摘要，避免重复解析

    ```dart
    /// 只有当配置发生变化时，摘要才会改变
    late final Digest digest = md5.convert(utf8.encode(triggers.toString()));
    ```

>  triggers 不是 2.13 才有，只是到 2.13 它的普及度已经比较高了。

这里的 Trigger  可以展开聊聊，例如在之前的 Builder 里，通常会扫描项目中的所有 `.dart` 文件，而通过触发器，Builder 可以声明：“**只有当文件包含特定的 `import` 语句或特定的 `annotation`（注解）时，才运行**”，也就是：

- **不满足触发条件时**：`build_runner` 只进行基础的字符串匹配（不进行完整的符号解析），这比完整的类型解析（Resolving）快得多
- **满足触发条件时**：才会启动 Builder 并进入后续的解析流程

例如你正在开发或适配一个 `my_generator` 包，并且提供了一个 `my_builder` 生成器，你需要修改 `build.yaml`，在 `builders` 定义中开启 `run_only_if_triggered`，并增加顶层的 `triggers` 配置块：

```yaml
# 1. 在生成器定义中开启触发模式
builders:
  my_builder:
    import: "package:my_generator/builder.dart"
    builder_factories: ["myBuilderFactory"]
    build_extensions: {".dart": [".g.dart"]}
    auto_apply: dependents
    # 核心配置：声明Builder 仅在被触发时运行
    defaults:
      options:
        run_only_if_triggered: true

# 2. 定义具体的触发规则（顶层配置）
triggers:
  # 格式为 "包名:生成器名"
  my_generator:my_builder:
    # 触发条件1：文件导入了特定的库（只需写库路径，系统会自动加上 package: 前缀）
    - "import my_generator/annotations.dart"
    # 触发条件2：文件使用了特定的注解名称
    - "annotation MyCustomAnnotation"
```

目前支持以下两种触发器：

- **`import` 触发器**：
  - `"import 路径/文件名.dart"`，检查源代码的指令中是否包含该库的导入语句，当用户必须导入注解库才能使用功能时非常高效
- **`annotation` 触发器**：
  - `"annotation 注解类名"`，检查源代码的所有声明上是否附带了这个名称的注解，即使没有显式导入（例如通过 export 间接导入）注解，只要检测到匹配的名称就可以触发

例如 `built_value` 就做了这个类适配， `built_value`  只有在检测到 `import 'package:built_value/built_value.dart'` 或 `@SerializersFor` 注解时才会运行 ，对于不相关的源文件，`build_runner` 日志会显示为 "not triggered" 或 "skipped" ：

![](https://img.cdn.guoshuyu.cn/image-20260318161047294.png)

所以，总结下来，到 2.13 版本，主要是做了以下三点来实现跳跃式的性能提升：

- **内存化操作**：资产图不再进行繁重的磁盘 I/O 序列化

- **计算复用**：解析器（Resolver）学会了复用分析结果，不再重复计算语法错误

- **流程精简**：通过 AOT 编译和更智能的触发器摘要管理，减少了 Builder 的预热和无效启动

所以， `build_runner`  已经今非昔比，性能有了很大的提升，**不过也不是说你完全什么都不做就可以体验**，比如：

- 第三方包需要在其 `build.yaml` 中将 `run_only_if_triggered` 设置为 `true` ，第三方包需要定义具体的 `triggers` ，系统可以根据触发器快速跳过不相关的源文件，从而不进入耗时的解析阶段
- 开启 AOT 后，第三方 Builder 的代码中不能包含 `dart:mirrors` ，如果 Builder 使用了反射，它就不能进行 AOT 编译
-  `analyzer` 依赖要升级到最新版本，2.13.0 通过 `BuildResolver` 深度复用了 Analyzer 的语法错误计算结果

**那么，你觉得  `build_runner`  对你有用吗**？



# 链接



https://github.com/dart-lang/build/blob/master/build_runner/CHANGELOG.md



