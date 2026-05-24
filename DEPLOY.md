# 部署与发布说明

本仓库已从 GitBook 迁移到 **VitePress + Pagefind**，构建产物为标准静态站点（HTML + JS + 分片搜索索引），可部署到任意支持静态托管的服务器。

> ⚠️ **开源安全约定**：本仓库是开源的，任何"真实服务器信息"——包括域名、公网 IP、SSH 用户名、SSH 端口、部署目录绝对路径、私钥——**禁止**写入本仓库的任何文件（README / DEPLOY.md / workflow / nginx 示例 / 注释）。所有这类信息**只能**放在 GitHub Actions 的 **Secrets**（仓库 → Settings → Secrets and variables → Actions）。本文里出现的 `your-domain.com`、`123.45.67.89`、`/var/www/...`、`deploy` 都仅是中性占位符。

## 一、本地开发

### 1. 环境

- Node.js ≥ 18（推荐 20）
- pnpm ≥ 9.15.4（**项目强制 pnpm**）

如果本机无 pnpm：

```bash
curl -fsSL https://get.pnpm.io/install.sh | env PNPM_VERSION=9.15.4 sh -
export PNPM_HOME="$HOME/Library/pnpm"   # macOS 默认安装路径
export PATH="$PNPM_HOME:$PATH"
```

### 2. 安装依赖

```bash
pnpm install
```

### 3. 把根目录的 `*.md` 与 `SUMMARY.md` 迁移到 `docs/`

```bash
pnpm run migrate
```

迁移脚本会：

1. 解析 `SUMMARY.md`，识别 5 个分类（前言 / 完整开发实战详解 / Flutter 更新集锦 / Dart 更新集锦 / 番外篇 / 工程化选择）。
2. 把所有 `.md` 拷贝并改名（slugify）到 `docs/<category>/`。
3. 自动注入 frontmatter `title`。
4. 把所有 `(xxx.md)` 形式的相对链接改写为对应站点路径。
5. 把根目录的 `logo.png` 等图片复制到 `docs/public/`。
6. 生成 `docs/.vitepress/sidebar.generated.mts` 与 `docs/guide/index.md`。

### 4. 启动 dev server

```bash
pnpm run dev
```

> Pagefind 索引仅在 build 时生成，dev 模式下搜索框会提示"先 `pnpm run build`"，这是预期行为。

### 5. 构建并预览

```bash
pnpm run build      # 等价于 vitepress build docs && pagefind --site docs/.vitepress/dist
pnpm run preview    # 本地起静态服务器查看构建产物
```

## 二、新增/修改文章的工作流

1. 在仓库根目录新增 / 编辑你的 `*.md` 文件（保持 GitBook 时代的写作习惯）。
2. 在 `SUMMARY.md` 的合适位置插入 `* [标题](文件名.md)`。
3. 本地跑 `pnpm run migrate && pnpm run dev` 验证。
4. `git commit && git push` 到 main —— 此时**不会**触发线上发布。
5. 当一批改动准备发布时，打 tag：

   ```bash
   git tag v2024.10.01
   git push origin v2024.10.01
   ```

   GitHub Actions 会自动构建并推送到自有服务器。

> 触发条件：tag 名匹配 `v*` 或 `release-*`。也可以在 Actions 面板 **workflow_dispatch** 手动触发。

## 三、CI/CD：GitHub Actions

工作流文件：`.github/workflows/deploy.yml`

需要在 GitHub 仓库 → **Settings → Secrets and variables → Actions** 配置以下 Secrets：

| Secret 名 | 说明 | 示例 |
|---|---|---|
| `DEPLOY_SSH_KEY` | 部署私钥（OpenSSH 格式，建议单独生成一对，将公钥写入服务器 `~/.ssh/authorized_keys`） | `-----BEGIN OPENSSH PRIVATE KEY-----...` |
| `DEPLOY_HOST` | 服务器地址 | `123.45.67.89` 或 `book.example.com` |
| `DEPLOY_USER` | SSH 用户名 | `deploy` |
| `DEPLOY_PATH` | 网站根目录绝对路径 | `/var/www/gsy-flutter-book` |
| `DEPLOY_SSH_PORT` | SSH 端口（可选，默认 22） | `22` |

**生成专用部署密钥（推荐）：**

```bash
ssh-keygen -t ed25519 -f deploy_key -C "github-actions-deploy" -N ""
# deploy_key      → 复制内容粘贴到 DEPLOY_SSH_KEY
# deploy_key.pub  → 追加到服务器的 ~/.ssh/authorized_keys
cat deploy_key.pub >> ~/.ssh/authorized_keys
```

## 四、服务器：Nginx 配置

参考 `deploy/nginx.conf.example`，要点：

- `try_files $uri $uri.html $uri/ /index.html;` —— 适配 VitePress 的 `cleanUrls: true`。
- `/assets/`、`/pagefind/` 加 `Cache-Control: max-age=31536000, immutable`。
- `*.html` 设 `Cache-Control: no-cache`，保证发布后用户立刻拿到新内容。
- `/pagefind/` 下的 `.pagefind`、`.pf_meta`、`.pf_index`、`.pf_fragment` 必须正确返回 `application/octet-stream` 或 `application/wasm`。
- 强烈建议开 gzip（或 brotli）。

部署目录权限：保证 `DEPLOY_USER` 对 `DEPLOY_PATH` 有写权限：

```bash
sudo mkdir -p /var/www/gsy-flutter-book
sudo chown -R deploy:deploy /var/www/gsy-flutter-book
```

## 五、性能特性

| 指标 | 旧 GitBook | 新 VitePress + Pagefind |
|---|---|---|
| 单页打开 | 同步加载完整 search-index | 首屏只下载所需 chunk |
| 搜索 | 一个巨大 JSON，移动端常常加载失败 | 分片下载（每次几十 KB） |
| 构建产物 | book/ ≈ 几百 MB | dist/ ≈ 75 MB（含 4 MB Pagefind 索引） |
| 发布触发 | 手动 build + 手动上传 | 打 tag → 全自动 |
| 增量发布 | 全量重新构建上传 | rsync 仅同步变化的文件 |

## 六、常见问题

**Q: build 报 `Could not resolve "xxx.png"`？**
A: 文章里有 GitBook 时代遗留的本地路径图片（如 `C:\Users\...`）。迁移脚本已会把这种引用改写成 `<!-- broken local image -->` 注释。如果还有遗漏，可以扩展 `scripts/migrate.mjs` 中的 `sanitizeBrokenImages`。

**Q: 搜索框出不来？**
A: 确认 `pnpm run search:index`（即 `pagefind --site docs/.vitepress/dist`）已执行。dev 模式不会生成索引。

**Q: 想换包管理器？**
A: 不要换。项目规则规定**只用 pnpm**。

**Q: 想升级依赖？**
A: 项目规则规定**只用发布 ≥ 15 天的版本**。请先 `npm view <pkg> time --json` 确认时间，再修改 `package.json` 和 `pnpm-lock.yaml`。
