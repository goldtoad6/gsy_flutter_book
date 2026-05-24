---
title: "十九、 Android 和 iOS 打包提交审核指南"
---

作为系列文章的第十九篇，本篇将科普 Android 和 iOS 平台的打包和提交审核流程。

因为很多 Flutter 开发人员可能只有单端的开发经验，对于另外一端的打包和提审流程不熟悉，或者是前端人员没有提交审核的经验，所以本篇将科普这一流程，让大家少走弯路。

## 文章汇总地址：

> [Flutter 完整实战实战系列文章专栏](https://juejin.im/collection/5db25bcff265da06a19a304e)
>
> [Flutter 番外的世界系列文章专栏](https://juejin.im/collection/5db25d706fb9a069f422c374)


## 一、Android 打包和审核流程


### 1、打包

事实上 Androd 的打包和审核流程都相对简单，打包 apk 只需要通过如下命令行就可以完成：

```
flutter build apk --target-platform android-arm64

flutter build apk --target-platform android-arm64 -t lib/main_prod.dart
```

- 其中 `--target-platform` 是针对打包后的 so 文件， 对需要支持的框架进行选择，因为现在无论是 Goole Play 或者国内平台，都多都有要求应用需要支持 `arm64-v8a` 的 ABI 架构，所以一般打包也会选择指定 `target-platform` 来减小 apk 的体积。

- `-t` 表示指定其他 `main.dart` 打包，也可以不指定。

- 另外需要注意，Android 上需要在 `android/app/src/build.gradle` 下配置 `signingConfigs` 来指定打包密钥等信息，具体生成密钥这里就不详说，之后把 `signingConfigs ` 配置到 `buildTypes` 就完成配置。

```
android {
    ····
    signingConfigs {
        config {
            keyAlias "xxxx"
            keyPassword "xxxx"
            storeFile file("../keystores/xxxxx.jks")
            storePassword "xxxx"
        }
    }
```

最后需要注意，如果你的 Apk 存在其他类型架构的 so 目录，比如 `armeabi-v7a` 等，那就需要在 `android/app/src/build.gradle` 的 `android { buildTypes {`  下加上 `ndk abiFilters` 进行过滤配置，因为 Android 下需要保证每个 ABI 目录内的 so 文件是完整齐全的，不然可能出现崩溃。

```
  buildTypes {
        release {
            signingConfig signingConfigs.config
            ndk {
                //设置支持的SO库架构
                abiFilters 'arm64-v8a'
            }
        }
        debug {
            signingConfig signingConfigs.config
            ndk {
                //设置支持的SO库架构
                abiFilters 'arm64-v8a', 'x86', 'x86_64'
            }
        }
    }
```

最后打包完的 Apk 默认会在如下图所示路径

![](http://img.cdn.guoshuyu.cn/20200110_Flutter-19/image1)

### 2、提交审核

其实在 Android 上提交审核是比较简单的，因为 Android 只需要提供 Apk 下载链接就可以直接安装，所以很多厂家都在有自己服务器上直接放上 Apk 文件，但是为了更好的体验和分发，大多数情况下也会选上传到各大应用平台，比如华为上没有上架的话，会出现如下图所示问题。

![](http://img.cdn.guoshuyu.cn/20200110_Flutter-19/image2)

> 甚至有些 Apk 因为没有上架，会因为 `app_name` 等原因被当作病毒提醒。

事实上国内的应用市场审核并不麻烦，只是因为平台多且各家条件可能不一样变得比较繁琐，目前主流要求的有：

- `targetSdkVersion` 28 (9.0)；
- ABI 需要支持 `arm64-v8a`；
- 应用需要针对 AndroidQ（10.0）进行适配，比如文件读取权限变更；
- [教育类应用需要备案](https://zhuanlan.zhihu.com/p/94698911)；
- 需要提供用户隐私协议和权限说明；


![](http://img.cdn.guoshuyu.cn/20200110_Flutter-19/image3)


之后就是一些平台的独立审核问题，比如 **360 平台审核要求你的 Apk 需要经过它们的应用加固**（加固后的作用就见仁见智），并且不少平台如**应用宝要求提供应用的版权说明等文件**，这些都是比较磨人的东西。

![](http://img.cdn.guoshuyu.cn/20200110_Flutter-19/image4)

> 当然有些平台你可以不上，但是比如不上应用宝，你就很难获得*微信扫一扫后跳转打开应用和下载的能力*。


另外比如华为平台会有：[根据工信部关于开展 APP 侵害用户权益专项整治工作的通知要求](http://www.miit.gov.cn/n1146295/n1652858/n1652930/n3757020/c7506353/content.html)，应用内还需要提供帐号注销服务或销户功能能力。

可以看出 Android 的审核和条件其实并不繁琐，只是有些平台需要的东西比较磨人，具体需要上架可以根据需求自行斟酌了。


## 二、iOS 打包和审核流程


### 1、打包

iOS 的打包和审核流程相对复杂点，打包 iOS 首先你需要有*开发者账号、给应用申请和设置有 `Bundle Identifier` 、配置文件、证书等信息*，相信已经到打包阶段了，这系列文件你不会欠缺吧？

#### 1.1 创建 App Store Connect

通过登录 https://developer.apple.com 网站，在 `Account` 的 `Certificates,IDs & Profiles` 可以找到你应用的信息，同时在 `App Store Connect` 栏目可以前往 https://appstoreconnect.apple.com  。

![](http://img.cdn.guoshuyu.cn/20200110_Flutter-19/image5)

接着在 `我的 App` 按照提示创建应用，填写信息根据业务要求填写即可，这里主要说几个需要关注的点。

- 1、如下图所示在 App Store 的 App 信息里有一个隐私政策网站输入栏，这个是必填的，一般就是放一个 Html，具体可以参考类似的： https://guoshuyu.cn/home/index/privacy.html

![](http://img.cdn.guoshuyu.cn/20200110_Flutter-19/image6)

- 2、需要上传应用的截图，一般需要准备 3-5 张预览图，但是这里需要 6.5 寸和 5.5 寸两种，如果还需要支持 iPad 版本那就还需要上传 12.9 的 iPad 图。这里推荐下，**如果没有设计师出稿件，推荐使用模拟器进行截图（注意不要截入 DEBUG 的 Label）， 6.5 寸可以用 iPhone 11promax 模拟器，5.5 寸的用 8plus 模拟器，打开具体页面后，按下 command + s 可以保存到桌面**。

![](http://img.cdn.guoshuyu.cn/20200110_Flutter-19/image7)

> 这里需要注意，截图的画面不要太简单，最好能替体现应用的具体内容，不然很容易被拒绝，这里同时提供需要尺寸对应的设备型号。

![](http://img.cdn.guoshuyu.cn/20200110_Flutter-19/image8)

- 3、在版本的信息里还有技术支持网站的必填，这个具体可以参考 ：https://guoshuyu.cn/home/index/tech.html ，如果此处不符合条件也会出现审核不通过的问题。

![](http://img.cdn.guoshuyu.cn/20200110_Flutter-19/image9)

- 4、另外如果 App 需要登录，还需要提供用户的测试账号和密码等。

![](http://img.cdn.guoshuyu.cn/20200110_Flutter-19/image10)

#### 1.2 打包上传

打包 flutter iOS 首先需要执行 `flutter build ios` 命令，命令会生成 release 模式的下的 `framework` 文件，之后就可以进入 Xcode 流程。

如下图所示，首先确保🔨位置不要选中模拟器，之后在 Product > Archive 就会开始导出打包。

![](http://img.cdn.guoshuyu.cn/20200110_Flutter-19/image11)


打包成功后可以看到如下界面，找到你最新打包的那一项，选择 `Distribute App` 就可以进入下一步；另外打包过的项目在 Window > Organizer 也可以重新找到。


![](http://img.cdn.guoshuyu.cn/20200110_Flutter-19/image12)

之后如下所示，就选择上传 `App Store Connect` 进行提交准备。

![](http://img.cdn.guoshuyu.cn/20200110_Flutter-19/image13)

> 如果是选择导出测试 ipa 可以选择 `Development`，前提是对应机器的 `UDID` 等信息已经在打包配置文件内。

之后可以选择 Upload 或者 Export，Export 就是导出后再在本地上传，可以使用 `TransPorter` 工具再单独上传；Upload 就是前面之后直接上传。


![](http://img.cdn.guoshuyu.cn/20200110_Flutter-19/image14)

接着出现的这个页面建议是不要勾选（不要问，问就是百度），然后直接 next，然后选择自动签名，等签名成功后最后点击上传就可以了。

![](http://img.cdn.guoshuyu.cn/20200110_Flutter-19/image15)

![](http://img.cdn.guoshuyu.cn/20200110_Flutter-19/image16)

### 2、审核

上传成功后就，过一段时间可以在`活动`和 `TestFlight` 看到你提交的构建版本，然后你可能会收到如下所示的一封邮件：

![](http://img.cdn.guoshuyu.cn/20200110_Flutter-19/image17)

其中比如 **`ITMS-90683`** 说的是没有在 `plist` 内配置 `NSContactsUsageDescription` 的 key-value，也就是向用户解释你为什么需要用到读取用户联系人的权限。

诸如此类的还有后几个都是，如果你应用内用到了对应的权限。就需要在 `plist` 配置上对应的 `key-value` 。

另外就是 `Push Notification Entitlement` 的警告，是说你的应用没有配置推送相关的证书和设置，如果你的应用没有用到对应的功能，比如在 `Developer` 后台看如下图所示的推送是否勾选了，如果勾选了就需要在应用内配置对应的推送服务，iOS 上 APNS 还需要设置对应的推送证书，一般推送证书还会分开发和生产两种，如果没有使用推送可以忽略警告。

![](http://img.cdn.guoshuyu.cn/20200110_Flutter-19/image18)

**还有就是 App 的启动页和 logo 尺寸记得配全，配置不全也会收到对应的警告，这个可能会影响审核。**

之后在版本信息里选择需要提交的构建版本，之后提交审核即可，一般审核会从等到*审核 > 正在审核 > 审核结果*，这个过程一般在 24 或者 48 小时之内，但是如果赶上了像圣诞节这样的节日，苹果会因为放假放慢审核，另外被拒绝的太多次的话，也会影响审核速度。

如下图所示，最后提一些审核建议，比如：

- 前面说过的应用截图要尽量体现应用的主要内容；
- 不允许在应用内滥用应用更新提示，比如不允许应用自己跳转下载更新，只能是简单提示后跳转 app store ，如果把握不好尺度干脆在 iOS 上就不加；
- 不要在应用内带有 fir.im ，蒲公英等资源、链接、文本和SDK，不然很容易被扫描然后拒绝。

以上这些都是属于常犯的问题，更多的还请看 ：https://developer.apple.com/cn/app-store/review/guidelines/

![](http://img.cdn.guoshuyu.cn/20200110_Flutter-19/image19)


> iOS 还有可以不用上架，只需要用户在手机上信任证书的可以使用 ipa 的开发者账号，但是这类开发者账号现在很难申请得到，并且这类账号的应用需要一年后重新打包一次更新。


### 资源推荐

* Github ： https://github.com/CarGuo
* **开源 Flutter 完整项目：https://github.com/CarGuo/GSYGithubAppFlutter**
* **开源 Flutter 多案例学习型项目: https://github.com/CarGuo/GSYFlutterDemo**
* **开源 Fluttre 实战电子书项目：https://github.com/CarGuo/GSYFlutterBook**
* 开源 React Native 项目：https://github.com/CarGuo/GSYGithubApp



![](http://img.cdn.guoshuyu.cn/20200110_Flutter-19/image20)