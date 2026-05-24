---
title: "完整解析使用 Github Action 构建和发布 Flutter 应用"
---

# 完整解析使用 Github Action 构建和发布 Flutter 应用

Github Actions 是 Github 提供的免费自动化构建实现，特别适用于持续集成和持续交付的场景，它具备自动化完成许多不同任务的能力，例如构建、测试和部署等等。

## 一、简单介绍

用户只需要在自己 Github 的开源项目下创建 `.github/workflows` 脚本就可以完成接入，另外针对 Github Actions  官方还提供了 [marketplace](https://github.com/marketplace/actions)  用于开发者提交或者引用别人写好的 aciton ，**所以很多时候开发者在使用 Github Actions  时，其实会变成了在  [marketplace](https://github.com/marketplace/actions)  里挑选和组合 action 的场景。当然，这样各有利弊，后面我们会讲到** 。

![image-20220330110809824](http://img.cdn.guoshuyu.cn/20220627_Flutter-GB/image1)

要在 Github 存储库中使用 Github Actions，首先需要创建目录`.github/workflows/`，然后在  `workflows` 文件夹里创建不同的 `.yml` 文件用于响应或者执行不同的事件，比如 ` git push`  、`pull request ` 等，例如：

```yaml
name: GitHub Actions Demo
on: [push]
jobs:
  Explore-GitHub-Actions:
    runs-on: ubuntu-latest
    steps:
      - run: echo "🎉 The job was automatically triggered by a ${{ github.event_name }} event."
      - run: echo "🐧 This job is now running on a ${{ runner.os }} server hosted by GitHub!"
      - run: echo "🔎 The name of your branch is ${{ github.ref }} and your repository is ${{ github.repository }}."
      - name: Check out repository code
        uses: actions/checkout@v2
      - run: echo "💡 The ${{ github.repository }} repository has been cloned to the runner."
      - run: echo "🖥️ The workflow is now ready to test your code on the runner."
      - name: List files in the repository
        run: |
          ls ${{ github.workspace }}
      - run: echo "🍏 This job's status is ${{ job.status }}."
```

上面是 [Github doc](https://docs.github.com/en/actions/quickstart)  里关于 Action 的一个基本的工作流 yml 文件，具体参数含义 ：

- **name**：这表示该工作流文件的名称，将在 Github 的 actions 选项卡作为名称显示 ；
- **on**: 这将触发该工作流的事件名称，它可以包含事件列表，例如这里监听的事 `push`；
- **jobs**: 每个工作流会包含一个或多个 jobs ，在这里只有一个，主要是用于表示不同工作任务；
- **Explore-GitHub-Actions** ：这是工作 ID，你也可以根据自己的需要命名，会在 action 的执行过程中显示；
- **runs-o**: jobs 需要运行在虚拟机上，在这里中使用了 `ubuntu-latest`，当然你也可以使用`windows-latest ` 或者 `macos-latest`；
- **steps**：每个 jobs  可以将需要执行的内容划分为不同步骤；
- **run**： 用于提供执行命令，例如这里使用了`echo` 打印日志；
- **name** ：steps 里的 name 是可选项，主要是在日志中用来做标记的；
- **uses** ： 使用一些官方或者第三方的 actions 来执行，例如这里使用官方的 `actions/checkout@v2`，它会check-out 我们的 repo ，之后工作流可以直接访问 repo 里的文件；

在 GitHub 仓库添加完对应的  `.github/workflows/ci.yml` 文件之后，以后每次 `push` 都可以触发 action 的自动执行，以此来完成可持续的自动集成和构建能力。

![image-20220330112846187](http://img.cdn.guoshuyu.cn/20220627_Flutter-GB/image2)



## 二、构建 Flutter 和发布到 Github Release

简单介绍完 Github Action ，接着我们介绍如何利用 Github Action 构建 Flutter 和发布 apk 到   Github Release，如下代码所示是 [gsy_github_app_flutter](https://github.com/CarGuo/gsy_github_app_flutter) 项目里使用到的 github action 脚本：

```yaml
name: CI

on:
  push:
    branches:
      - master
    tags:
      - '*'
  pull_request:
    paths-ignore:
      - '**/*.md'
      - '**/*.txt'
      - '**/*.png'
      - '**/*.jpg'

jobs:
  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: actions/setup-java@v2
        with:
          distribution: 'zulu'
          java-version: 11
      - uses: subosito/flutter-action@v1
        with:
          flutter-version: '2.8.1'
      - uses: finnp/create-file-action@master
        env:
          FILE_NAME: lib/common/config/ignoreConfig.dart
          FILE_DATA: class NetConfig { static const CLIENT_ID = "${{ secrets.CLIENT_ID }}"; static const CLIENT_SECRET = "${{ secrets.CLIENT_SECRET }}";}
      - run: flutter pub get
      - run: flutter build apk --release --target-platform=android-arm64 --no-shrink

  apk:
    name: Generate APK
    if: startsWith(github.ref, 'refs/tags/')
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v2
      - name: Setup JDK
        uses: actions/setup-java@v2
        with:
          distribution: 'zulu'
          java-version: 8
      - uses: subosito/flutter-action@v1
        with:
          flutter-version: '2.5.3'
      - uses: finnp/create-file-action@master
        env:
          FILE_NAME: lib/common/config/ignoreConfig.dart
          FILE_DATA: class NetConfig { static const CLIENT_ID = "${{ secrets.CLIENT_ID }}"; static const CLIENT_SECRET = "${{ secrets.CLIENT_SECRET }}";}
      - run: flutter pub get
      - run: flutter build apk --release --target-platform=android-arm64 --no-shrink
      - name: Upload APK
        uses: actions/upload-artifact@v2
        with:
          name: apk
          path: build/app/outputs/apk/release/app-release.apk
  release:
    name: Release APK
    needs: apk
    if: startsWith(github.ref, 'refs/tags/')
    runs-on: ubuntu-latest
    steps:
      - name: Download APK from build
        uses: actions/download-artifact@v2
        with:
          name: apk
      - name: Display structure of downloaded files
        run: ls -R

      - name: Create Release
        id: create_release
        uses: actions/create-release@v1.1.4
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          tag_name: ${{ github.ref }}
          release_name: ${{ github.ref }}
      - name: Upload Release APK
        id: upload_release_asset
        uses: actions/upload-release-asset@v1.0.1
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
        with:
          upload_url: ${{ steps.create_release.outputs.upload_url }}
          asset_path: ./app-release.apk
          asset_name: app-release.apk
          asset_content_type: application/zip
```

根据上述脚本，首先可以看到：

- 在 `push` 事件里我们指定了只监听 master 分支和 tags 相关的提交；

- 然后在 `pull_request`  事件里忽略了关于 .md、 .text 和图片相关的内容，也就是这部分内容提交不触发 action ，具体可以看你自己的需求；

- 接着进入到 jobs 里，首先不管是 `push`  还是  `pull_request`  都会执行到  `Build` 事件，运行在 `ubuntu-latest` 虚拟机上，之后利用 `actions/checkout@v2`  checkout 代码；

- 接着使用 `actions/setup-java@v2` 配置 java 环境，这里使用的是 `Zulu OpenJDK` 版本 11 ，下面表格是 setup-java 支持的可选 java 类型；

  | Keyword                    | Distribution               | Official site                                                | License                                                      |
  | -------------------------- | -------------------------- | ------------------------------------------------------------ | ------------------------------------------------------------ |
  | `temurin`                  | Eclipse Temurin            | [Link](https://adoptium.net/)                                | [Link](https://adoptium.net/about.html)                      |
  | `zulu`                     | Zulu OpenJDK               | [Link](https://www.azul.com/downloads/zulu-community/?package=jdk) | [Link](https://www.azul.com/products/zulu-and-zulu-enterprise/zulu-terms-of-use/) |
  | `adopt` or `adopt-hotspot` | Adopt OpenJDK Hotspot      | [Link](https://adoptopenjdk.net/)                            | [Link](https://adoptopenjdk.net/about.html)                  |
  | `adopt-openj9`             | Adopt OpenJDK OpenJ9       | [Link](https://adoptopenjdk.net/)                            | [Link](https://adoptopenjdk.net/about.html)                  |
  | `liberica`                 | Liberica JDK               | [Link](https://bell-sw.com/)                                 | [Link](https://bell-sw.com/liberica_eula/)                   |
  | `microsoft`                | Microsoft Build of OpenJDK | [Link](https://www.microsoft.com/openjdk)                    | [Link](https://docs.microsoft.com/java/openjdk/faq)          |

- 接着就是使用第三方的 `subosito/flutter-action@v1` 配置 flutter 环境，直接通过 `flutter-version: '2.8.1'` 指定了 Flutter 版本；

- 接着是使用第三方的  ` finnp/create-file-action@master` 创建文件，因为 [gsy_github_app_flutter](https://github.com/CarGuo/gsy_github_app_flutter) 项目有一个配置文件是需要用户根据自己的 ID 和 SECRET 手动创建，所以这里通过  create-file-action 创建文件并输入内容；

- 在上述输入内容部分，有一个 `secrets.xxx` 的参数，因为构建时需要将自己的一些密钥信息配置到 action 里，所以如下图所示，可以在 `Settings` 的 `Secrets` 里添加对应的内容，就可以在 action 里通过 `secrets.xxx` 读取；

  ![image-20220330114509039](http://img.cdn.guoshuyu.cn/20220627_Flutter-GB/image3)

- 接着配置好环境之后，就可以执行  `flutter pub get` 和 ` flutter build apk` 执行构建；

完成 Build 任务的逻辑介绍之后，可以看到在 Build 任务下面还有一个 apk 任务，该任务基本和 Build 任务一直，不同之处在于：

- 多了一个 `if: startsWith(github.ref, 'refs/tags/')` ，也就是存在 tag 的时候才会触发该任务执行；
- 多了一个 `actions/upload-artifact@v2` 用于将构建出来的 `build/app/outputs/apk/release/app-release.apk`上传，并等到 release 任务内使用；

完成  apk 任务之后，会进入到  release 任务，该任务同样通过 if 指定了只在 tag 提交时运行：

- 任务首先会通过 `actions/download-artifact@v2` 下载刚刚上传的 apk； 
- 然后就通过  `actions/create-release@v1.1.4`  创建一个 release 版本，这里使用的  `secrets.GITHUB_TOKEN ` 是官方内置的 secrets ，我们直接使用就可以了；
- 最后通过 `actions/upload-release-asset@v1.0.1` 将 apk 上传到刚刚创建的 release 版本里，自此就完成了 action 的发布流程；

**可以看到整个过程其实都是在组合不同的 action ，可以很灵活方便地配置构建逻辑**，例如如果你的项目是单纯的 android sdk 项目，那同样可以通过如下脚本进行发布管理：

```yaml
name: CI

on:
  push:
    branches:
      - master
    paths-ignore:
      - '.idea/**'
      - '.gitattributes'
      - '.github/**.json'
      - '.gitignore'
      - '.gitmodules'
      - '**.md'
      - '**/*.txt'
      - '**/*.png'
      - '**/*.jpg'
      - 'LICENSE'
      - 'NOTICE'
  pull_request:
    paths-ignore:
      - '.idea/**'
      - '.gitattributes'
      - '.github/**.json'
      - '.gitignore'
      - '.gitmodules'
      - '**.md'
      - '**/*.txt'
      - '**/*.png'
      - '**/*.jpg'
      - 'LICENSE'
      - 'NOTICE'

jobs:
  publish:
    name: Publish to MavenLocal
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-java@v3
        with:
          distribution: 'zulu'
          java-version: 17
      - uses: gradle/gradle-build-action@v2
        with:
          arguments: publishToMavenLocal

  build:
    name: Build
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-java@v3
        with:
          distribution: 'zulu'
          java-version: 17
      - uses: gradle/gradle-build-action@v2
        with:
          arguments: app:assembleDebug
```

当然，如果你需要打包的是 iOS ，那么你就需要使用 `macos-latest` 的环境，另外还需要配置相关的开发者证书，这个过程可能会比较难受，相关可以参考 [《Flutter 搭建 iOS 命令行服务打包发布全保姆式流程》](https://juejin.cn/post/6953144821611495431) 。



## 三、隐私安全问题



最后，**关于 Github Actions 之前存在过出现泄露敏感数据的问题，比如 Github 的 Token 等** ，举个例子，如上面的脚本，它在执行任务时都会需要秘钥 ，如果你使用的第三方 action 在执行过程中获取了你的密钥并干了一些“非法” 的事情，就可能出现异常泄漏问题。

![image-20220330132722744](http://img.cdn.guoshuyu.cn/20220627_Flutter-GB/image4)

**所以一般情况下建议大家都要去看下非官方的脚本实现里是否安全**，但是由于 tag 和 branch 是可以修改，所以建议不要@分支或tag，而是应该 checkout 对应的提交哈希，这样有利于你审查使用时的脚本是否安全。

另外，例如还有人提到可以通过 pull_request 来恶意攻击获取对应隐私：

* 1、fork 一个正在使用 GitHub Actions 的公开代码库；

* 2、创建一个基于该项目的 pull 请求；

* 3、使用 pull_request_target 事件创建一个恶意 Actions 工作流，然后单独向该 fork 库 commit；

* 4、将第二步基分支的 pull 请求更新为第三步的 commit 哈希；

之后恶意 Actions 工作流就会运行，并从目标 repos 里获取到执行过程的敏感数据，此时攻击者将拥有对目标存储库的写访问权限，除此之外他们还可以通过 GitHub 访问与仓库之成的任何服务。

**所以虽然 GitHub Action 很便捷，但是如果出于商业考虑的话，还需要谨慎抉择安全问题**。