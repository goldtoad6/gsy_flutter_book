---
title: "Flutter 3.41.6 版本很重要，你大概率需要更新一下"
---



# Flutter 3.41.6 版本很重要，你大概率需要更新一下

最近 Flutter 更新了一个 hotfix 小版本 3.41.6 ，虽然这是一个小版本，但是它解决了一个长久以来的玄学 bug：**Android App 在锁屏或者处于后台时，会出现 ANR 的情况**。

![](https://img.cdn.guoshuyu.cn/image-20260327103333707.png)

这个 bug 之所以能在这次被 fix，还得感谢 Android 16 的 2026 年 3 月安全更新，这个更新将这个历史 bug 问题放大，从而让  bug 很容易复现，而最容易出现问题的场景是：

> Android 设备按下电源键（SCREEN_OFF）或 App 切换到后台，**同时 Flutter 层正在播放视频**。

不是说播放视频才会，只是播放视频可以让这个情况更容易出现，而一旦出现，可以在 log 层面看到  `ErrorSurfaceLostKHR`，并且 App 会出现 ANR 死锁，屏幕点亮后无法渲染新帧，甚至直接崩溃。

这个问题的根本原因在于 **Vulkan Swapchain 和 Fence 机制** ，我们都知道，现在 Flutter 使用 Impeller 作为渲染引擎，而在 Android 上使用 Vulkan 后端，而 Vulkan 渲染一帧的标准流程是：

```
vkAcquireNextImageKHR()   ← 从 Swapchain 获取下一张可用图像，同时传入一个 fence
       ↓ (渲染)
vkQueueSubmit()            ← 提交渲染命令
       ↓
vkQueuePresentKHR()        ← 将图像呈现到屏幕 (Present)
```

这里的 Fence（栅栏） 属于是 GPU 同步原语，其中 `vkAcquireNextImageKHR` 会在 GPU 真正完成图像并且可用时 **signal（触发）这个 fence** 。

然后下次进入这个帧槽（frame slot）时，就必须先 `vkWaitForFences()` 等待这个 fence 被 signal，确保上一帧的 acquire 已完成，才能安全地重用这个槽。

说起来可能有点陌生，但其实在这个问题就是上面这个流程出现了死锁：

#### 1、SCREEN_OFF 触发 Surface 销毁

Android 系统在屏幕关闭时，会销毁当前 App 的 `ANativeWindow`/`VkSurfaceKHR`（Vulkan Surface）

#### 2、 `vkAcquireNextImageKHR` 返回 `VK_ERROR_SURFACE_LOST_KHR`

当 Impeller 的 Swapchain 尝试获取下一帧图像时，由于 Surface 已经被系统销毁，Vulkan 驱动返回 `VK_ERROR_SURFACE_LOST_KHR`（对应 Flutter 日志中的 `ErrorSurfaceLostKHR`），但是这时候 `AcquireNextDrawable()` 返回 `nullptr`，Flutter 无法渲染这一帧，**也不会走到 `Present` 流程** 。

#### 3、Fence 永远不会被 signal

而在这次问题修复前的代码逻辑（`KHRFrameSynchronizerVK` ）里没有追踪 fence 是否处于 pending 状态，所以就导致绘制一直停滞在那里：

```c++
// 修复前：fence 初始化时带 eSignaled 标志（已触发状态）
auto acquire_res = device.createFenceUnique(
    vk::FenceCreateInfo{vk::FenceCreateFlagBits::eSignaled}); // ← 问题起点

```

正常流程：

- `vkAcquireNextImageKHR` 成功之后， fence 会在 GPU acquire 完成后被 signal
- 下帧 `WaitForFence()` 之后， 成功等到 signal / 重置 fence / 继续

但是在异常流程（SCREEN_OFF 时）的时候：

- `vkAcquireNextImageKHR` 失败 (`VK_ERROR_SURFACE_LOST_KHR`) ，然后 fence **从来没有被传给 GPU** 导致了**永远不会被 signal**
- 但代码不知道这回事，下次进入同一帧槽时仍然调用 `WaitForFence()`
- `vkWaitForFences(..., timeout=UINT64_MAX)`就会**无限等待一个永远不会 signal 的 fence**
- **主线程（UI Thread）被永久阻塞 ，然后 ANR**

> 这也是为什么视频播放时更容易触发，因为视频播放时帧率更高、Vulkan Swapchain 调用更频繁，Surface 销毁与 `vkAcquireNextImageKHR` 的调用窗口更小，产生死锁的条件更容易命中。

而为什么 Android 16 March Security Update 特别容易触发？这个大概率是安全更新很可能修改了系统销毁 Surface 的时序（比如更激进/更快），我推测可能是 GPU 驱动的更新 ，导致本来在更宽松时序下能"蒙混过关"的竞态条件变得必现。

所以在 [PR #183288](https://github.com/flutter/flutter/pull/183288) 针对 `khr_swapchain_impl_vk.cc` 进行了修复：

```c++
struct KHRFrameSynchronizerVK {
  vk::UniqueFence acquire;
+ bool acquire_fence_pending = false;  // ← 新增：追踪 fence 是否处于 pending 状态
  vk::UniqueSemaphore render_ready;
  ...

  explicit KHRFrameSynchronizerVK(const vk::Device& device) {
    // 修复前：初始化时带 eSignaled（已触发），导致第一次 WaitForFence 可以通过
    // 修复后：不带 eSignaled，初始为未触发状态
-   auto acquire_res = device.createFenceUnique(
-       vk::FenceCreateInfo{vk::FenceCreateFlagBits::eSignaled});
+   auto acquire_res = device.createFenceUnique({});
    ...
  }

  bool WaitForFence(const vk::Device& device) {
+   // 关键修复：如果 fence 从未被 pending（即 acquire 从未成功），直接跳过等待
+   if (!acquire_fence_pending) {
+     return true;
+   }
    if (auto result = device.waitForFences(...); result != vk::Result::eSuccess) {
      return false;
    }
+   acquire_fence_pending = false;  // 等待成功后重置标志
    ...
  }
};

bool KHRSwapchainImplVK::Present(...) {
  ...
  // vkQueuePresentKHR 成功后，标记 fence 为 pending
+ sync->acquire_fence_pending = true;
}
```

修复逻辑主要在于：

| 步骤                           | 修复前                                                   | 修复后                                                   |
| ------------------------------ | -------------------------------------------------------- | -------------------------------------------------------- |
| Fence 初始状态                 | `eSignaled`（已触发，可直接通过 Wait）                   | 未触发                                                   |
| `vkAcquireNextImageKHR` 失败时 | fence 没有被 signal，但下次仍会 `WaitForFences` 导致死锁 | `acquire_fence_pending = false`，`WaitForFence` 直接跳过 |
| `Present` 成功时               | 无标记                                                   | 设置 `acquire_fence_pending = true`                      |
| 下帧 `WaitForFence`            | 无条件等待                                               | 检查 `acquire_fence_pending`，若为 false 直接返回        |

修复的核心思想很简单：**只有在 `Present` 真正成功（帧被提交给 GPU 呈现）后，才把 fence 标记为 pending，下次才需要等待它，而如果 acquire 失败了，这一帧根本没有 present，fence 没有 pending，直接跳过等待**。

那为什么说必须升级呢？因为它只 hotfix 到了 3.41.6 ，除非你自己编译本地 Engine ，不然只能升级。

> 不过，话说回来，改动还真不大，自己编也不是完全不行。

当然，天无绝人之路，介绍这么多它的原理，不就是为了让你知道它怎么发现，又可以怎么避免，如果你的老项目，可以通过一下的方式了规避：

| 方案                                                  |                                                              |
| ----------------------------------------------------- | ------------------------------------------------------------ |
| 关闭 Impeller，退回 Skia                              | 在 `AndroidManifest.xml` 中设置 `io.flutter.embedding.android.EnableImpeller=false`，这个可以临时解决，因为它是 Impeller 的问题 |
| 监听 `AppLifecycleState.inactive/paused` 主动停止视频 | 在屏幕关闭前停止播放，避免竞态窗口，同时动画或者会触发 UI 更新的情况，但是在 android 16 上不是一定不会发生，只是降低了概率 |

核心思路就是，不然让他在锁屏和后台等场景还有 UI 活跃，**任何导致 Android BufferQueue 消费侧暂停的情况都会触发**：

| 触发场景                          | 原因                                   |
| --------------------------------- | -------------------------------------- |
| 按电源键关屏（SCREEN_OFF）        | SurfaceFlinger 停止消费 buffer，队列满 |
| App 切换到后台                    | Surface 被系统回收/暂停                |
| 视频/媒体播放时系统 buffer 压力大 | BufferQueue 被媒体占用，Flutter 抢不到 |
| 屏幕旋转瞬间                      | 旧 Surface 销毁、新 Surface 还未就绪   |
| 多窗口/分屏模式切换               | Surface resize/recreate 过渡期         |
| 部分 OEM 的省电策略               | 后台渲染限制                           |
| Android 系统内存压力              | SurfaceFlinger 主动回收                |

> 触发条件是"任何一次 `vkAcquireNextImageKHR` 失败"

所以，如果不想升级，就需要尽量规避这些场景，当然最好还是升级到 3.41.6 。

**那为什么 Android 16 这个安全更新之前，问题会是一个玄学状态呢**？因为有一个「侥幸机制」维持的脆弱平衡，在修复之前，这就类似于一个屎山在没有遇到稻草时，它是不会塌的：

```c++
struct KHRFrameSynchronizerVK {
  vk::UniqueFence acquire;
  // ← 注意：没有 acquire_fence_pending 标志！

  explicit KHRFrameSynchronizerVK(const vk::Device& device) {
    // ↓↓↓ 关键：fence 创建时带 eSignaled 标志 ↓↓↓
    auto acquire_res = device.createFenceUnique(
        vk::FenceCreateInfo{vk::FenceCreateFlagBits::eSignaled});
    ...
  }

  bool WaitForFence(const vk::Device& device) {
    // ← 无论如何都直接等，没有任何保护
    if (auto result = device.waitForFences(
            *acquire,
            true,
            std::numeric_limits<uint64_t>::max()  // ← 无限超时！
        ); result != vk::Result::eSuccess) {
      ...
    }
    ...
  }
};
```

### 修复之前本来就有的第一层保护：`eSignaled` 初始化

`vk::FenceCreateFlagBits::eSignaled` 意味着 **fence 在创建时就处于"已触发"状态**，第一次使用 frame slot 时，不需要等待任何 GPU 操作完成，所以预先把 fence 设为 signaled，让第一次 `WaitForFences` 立刻通过，然后 reset。

```
Frame Slot 生命周期（正常情况）：

初始状态：fence = SIGNALED（eSignaled 初始化）
           ↓
第1帧：WaitForFence → 立刻通过（因为 SIGNALED）→ ResetFence → UNSIGNALED
       vkAcquireNextImageKHR（传入 fence）→ GPU acquire 完成时 fence 变 SIGNALED
       Present 成功
           ↓
第2帧：WaitForFence → 等 GPU → SIGNALED → 通过 → ResetFence ...
```

### 修复之前的第二层保护（侥幸点）：`kMaxFramesInFlight` 轮转

修复前代码中 `kMaxFramesInFlight = 3`（现在也是），也就是有 **3 个 frame slot** 轮流使用：slot 0、1、2、0、1、2…关键在于：**每个 slot 创建时都带 `eSignaled`，并且只在第一次使用时"消耗"这个初始 signal**，而 SCREEN_OFF 的场景（修复前）：

```
假设 slot 0 正在使用中，SCREEN_OFF 发生：

  第N帧：WaitForFence(slot 0) → 通过（上帧 GPU 已完成）
         vkAcquireNextImageKHR(slot 0) → 失败！SURFACE_LOST
         ← fence 没有被传给 GPU，永远不会 signal！
         Present 未调用
              ↓
  第N+1帧：换到 slot 1
           WaitForFence(slot 1) → ???
```

这里就是关键：**slot 1 之前是否被成功使用过？** 而为什么"之前很少触发"的真实原因，有两种场景决定了结果：

**场景 A：App 刚启动不久，slot 1 / slot 2 还从未被 Present 过**

```
slot 1 的 fence 状态：eSignaled（初始值，从未被 reset 过！）
WaitForFence(slot 1) → 立刻通过（因为还是初始 SIGNALED 状态）
→ 渲染继续，没有死锁
```

**场景 B：App 运行了足够长时间，所有 3 个 slot 都已经被正常 Present 过多次**

```
slot 1 的 fence 状态：UNSIGNALED（上一次正常 Present 后被 reset 了，等待下次 GPU signal）

但等等——slot 1 上次被正常 Present 了，
GPU 那时候 signal 了这个 fence，
WaitForFence(slot 1) → 等到 GPU signal → 通过
→ 渲染继续，没有死锁
```

**场景 C（真正触发死锁的场景）：**

```
第N帧：slot X acquire 失败（SURFACE_LOST）→ fence UNSIGNALED，永不 signal
第N+1帧：换 slot Y → WaitForFence(Y) 通过（Y 上次正常完成了）
第N+2帧：换 slot Z → WaitForFence(Z) 通过（Z 上次正常完成了）
第N+3帧：回到 slot X → WaitForFence(X) → 等待永远不会 signal 的 fence → 💀 死锁！
```

死锁要等到**绕一圈 3 个 slot 之后，再次回到出问题的那个 slot 时**才爆发，这就是为什么"之前很难发现"的核心原因，**问题不是立刻爆发，而是延迟了 2~3 帧之后才触发**：

```
时间轴：

T0: SCREEN_OFF → slot 0 acquire 失败 → 埋下炸弹
T1: 切换 slot 1 → WaitForFence 正常通过 → 没问题（表面看起来正常）
T2: 切换 slot 2 → WaitForFence 正常通过 → 没问题
T3: 回到 slot 0 → WaitForFence 无限等待 → ANR 💀

ANR 系统默认要等 5 秒才弹出"无响应"对话框，
这段时间 App 在 T0-T2 看起来还活着，
用户/开发者很难把 T0 的 SCREEN_OFF 和 T3 的 ANR 联系在一起。
```

正如修复里的那句话：

> *"Android's implementation of `vkAcquireNextImageKHR` was returning `VK_ERROR_SURFACE_LOST_KHR` because it was **unable to dequeue a buffer**. Android logged it as `dequeueBuffer failed: Try again (-11)`"*

我大概猜的，在 **Android 16 March Update 之前**，SCREEN_OFF 时 Android 的 BufferQueue 有一个"宽限期"：

```
旧行为（Android 16 之前）：
  SCREEN_OFF
    ↓
  SurfaceFlinger 停止消费，但 BufferQueue 还保留 1~2 个空槽
  ↓
  vkAcquireNextImageKHR 短时间内仍能 acquire 成功（buffer 还可用）
  ↓
  Flutter 完成了 Present，GPU signal 了 fence
  ↓
  Surface 销毁时，Flutter 已经"完整走完"一帧，fence 处于 SIGNALED 状态
  ↓
  下一帧 WaitForFence → 正常通过 → 没有死锁
```

而可能对应了 Android 16 March Update 之后。流程就变成了：

```
新行为（Android 16 March Update 之后）：
  SCREEN_OFF
    ↓
  Surface/BufferQueue 被更激进地立即回收（GPU 驱动或 SurfaceFlinger 变化）
    ↓
  vkAcquireNextImageKHR 几乎立刻返回 SURFACE_LOST（没有宽限期）
    ↓
  fence 从未被 GPU touch → 永久 UNSIGNALED
    ↓
  3 帧后 WaitForFence → 无限等待 → ANR 💀
```

所以总结一下：

| 因素                                | 细节                                                         | 效果                 |
| ----------------------------------- | ------------------------------------------------------------ | -------------------- |
| **`eSignaled` 初始化**              | 每个 frame slot 初始 fence 已触发，第一次 WaitForFence 无条件通过 | App 启动阶段完全免疫 |
| **3 个 slot 的缓冲**                | 出问题的 slot 要等绕完一圈才被再次访问，期间其他 slot 正常工作 | 延迟了爆发时机       |
| **Android 旧 BufferQueue 的宽限期** | SCREEN_OFF 后 acquire 仍能短暂成功，fence 被正常 signal      | 根本上消除了触发条件 |

所以根据我的理解，**Android 16 March Update 导致了第三个也是最根本的保护：宽限期消失了，`vkAcquireNextImageKHR` 开始立刻失败，bug 必现**。

所以，升级 3.41.6 吧~

