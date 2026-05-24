# 项目工程规则 (Project Rules)

> 本文件为项目级 AI Agent / 工程师的通用工作准则。任何 AI（Trae、Cursor、Claude、Copilot 等）和人类协作者，都必须严格遵守。

---

## 一、项目背景

本项目是 **GSY Flutter Book** 的现代化重构版，从已停止维护的 GitBook 迁移到：

- **VitePress** ：Vue 驱动的静态站点生成器，构建快、生态活跃
- **Pagefind** ：分片索引、按需加载的二进制级搜索引擎，专为大型静态站设计
- **pnpm** ：包管理器（不要使用 npm install / yarn install）
- **GitHub Actions + tag 触发**：打 `v*` tag 才构建并部署到自有服务器

## 二、依赖管理铁律（最高优先级）

### 2.1 包必须发布满 15 天

> **任何新增或升级的 npm 依赖，其版本的发布日期必须距今 ≥ 15 天。**

- 这是为了避免使用刚发布的版本踩到突发性 bug
- 校验方式：`npm view <pkg> time --json` 查看版本发布时间
- 严禁使用任何 `latest` / `next` / `beta` / `alpha` / `rc` / `dev` 标签的版本
- 严禁使用日历日期还未满 15 天的稳定版

### 2.2 锁定确切版本号

- `package.json` 中所有依赖必须写**精确版本号**（不要带 `^`、`~`、`>=`、`*`）
- 必须提交 `pnpm-lock.yaml` 到 Git
- 升级依赖前必须先重新校验"发布满 15 天"规则

### 2.3 包管理器

- 仅使用 **pnpm**（项目里已用 `packageManager` 字段锁定 pnpm 版本）
- 严禁使用 `npm install` / `yarn install` / `bun install`
- 严禁混用：不要同时存在 `package-lock.json` 和 `pnpm-lock.yaml`

## 三、目录结构

```
.
├── docs/                       # VitePress 工程目录
│   ├── .vitepress/
│   │   ├── config.mts          # VitePress 主配置
│   │   ├── theme/              # 自定义主题（含 Pagefind 搜索组件）
│   │   └── sidebar.generated.mts  # 由迁移脚本自动生成的侧边栏
│   ├── public/                 # 静态资源（logo 等）
│   ├── index.md                # 首页
│   └── <category>/*.md         # 各章节文章
├── scripts/
│   └── migrate.mjs             # 一次性迁移脚本：SUMMARY.md → docs/
├── .github/workflows/
│   └── deploy.yml              # tag 触发的部署 workflow
├── package.json
├── pnpm-lock.yaml
├── .npmrc
├── .gitignore
├── PROJECT_RULES.md            # 本文件
└── README.md
```

## 四、内容写作规则

- 文章一律用 Markdown 编写，扩展名 `.md`
- 每篇文章必须有 frontmatter，至少包含 `title`：
  ```markdown
  ---
  title: Flutter 3.38 发布
  ---
  ```
- 图片放在 `docs/public/`，引用时使用 `/图片名.png` 绝对路径
- 文内链接使用 VitePress 风格的相对路径：`./xxx.md` 或 `/category/xxx.md`

## 五、发布流程

### 日常写作（不发布）

```bash
git add .
git commit -m "draft: xxx"
git push origin main
```
推送到 main **不会**触发部署，可放心累计草稿。

### 正式发布

```bash
git tag v2026.05.24       # 或 release-2026-05-24
git push origin v2026.05.24
```
GitHub Actions 监听 `v*` 与 `release-*` tag，自动构建并通过 SSH 部署到自有服务器。

## 六、AI Agent 工作守则

1. **变更前先读最新文件**：使用 Read 工具确保获取最新内容，再用 Edit。
2. **不要凭空创造依赖**：任何新增的 npm 包都必须先 `npm view <pkg> time` 验证发布日期。
3. **不要主动写文档**：除非用户显式要求，不要新增 `*.md` 文档文件。
4. **保持代码无注释**：除非用户要求，不要在生成代码里加注释。
5. **遵循已有风格**：Vue 组件、配置文件遵循已有写法，不要引入新风格。
6. **执行任务前先列 Todo**：复杂任务必须用 TodoWrite 列计划。
7. **运行 GetDiagnostics**：编辑文件后必须运行诊断，确保无 lint / type 错误。

## 七、Pagefind 搜索约束

- 必须在 `pnpm run build` 后执行 `pagefind --site docs/.vitepress/dist`
- VitePress 自带的 search 已被禁用，统一使用 Pagefind UI
- Pagefind 索引输出到 `docs/.vitepress/dist/pagefind/`，部署时必须包含此目录

## 八、安全与隐私（开源仓库铁律）

> 本仓库是**公开开源**的。任何 AI / 协作者在写代码、写文档、写注释时，**绝对不允许**把以下"真实运维信息"写入仓库的任何文件（包括 `.md`、workflow yml、nginx 配置示例、代码注释、commit message）：

- 真实域名（例如生产站点的 `xxx.cn`、`xxx.com`）
- 公网 IP
- SSH 用户名（root / deploy / 你的真实用户名）
- SSH 端口（如果不是默认 22）
- 部署目录绝对路径（如 `/home/xxx`、`/data/xxx`）
- 任何形式的私钥、密码、Token、cookie

**正确做法**：

1. 所有这类配置**只**放在 GitHub 仓库的 **Secrets**（Settings → Secrets and variables → Actions）。
2. workflow 文件里只通过 `${{ secrets.XXX }}` 间接引用，不打印到日志。
3. 文档里出现部署示例时，一律使用中性占位符：`your-domain.com`、`123.45.67.89`、`/var/www/<site>`、`deploy`。
4. AI 助手在帮用户调试部署问题时，可以在**对话回复中**输出针对真实环境的命令，但**禁止把真实信息写进文件**。
5. `.env*`、`*.pem`、`id_rsa*`、`*.key` 必须在 `.gitignore` 中。

