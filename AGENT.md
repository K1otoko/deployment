# Deployment AI 工作说明

本文供在本仓库工作的 AI 使用。修改前先阅读本文、`README.md` 和相关源码。
若说明与实现不一致，以当前源码、测试和迁移为准，并同步修正文档。

## 1. 项目定位

本项目计划成为部署平台后端，技术栈为 Express 5、PostgreSQL、Drizzle ORM 和
TypeScript。

当前版本只是可运行的工程骨架，已经实现：

- 服务元数据与版本接口。
- 进程存活和 PostgreSQL 就绪检查。
- 请求 ID、Helmet、JSON body limit、统一 404 和错误响应。
- 数据库连接、Drizzle 配置、Dockerfile 与本地 Compose。
- 配置和 HTTP 基础测试。

当前尚未实现：

- 应用、环境、版本、部署任务、步骤、日志等领域模型。
- `/api/hooks/**` Webhook 接口。
- Hook 签名验证、防重放和事件幂等。
- SSO/Gateway 身份接入和业务权限。
- Shell、SSH、Docker、Kubernetes 或其他部署执行器。
- 生产镜像发布工作流和生产 Compose 网络。

不要把 README 中的未来方向或 Gateway 规划路由描述成已存在能力。

## 2. 当前接口

所有应用接口统一位于 `/api`：

- `GET /api`：服务名和版本。
- `GET /api/health`：进程存活，不访问数据库。
- `GET /api/health/ready`：执行数据库探测，失败返回 503。
- `GET /api/version`：应用版本和构建 SHA。
- 其他路径：404 `{ "error": "not_found" }`。

当前接口没有应用层鉴权，只应在本地或受控网络中使用。上线业务接口前必须通过
Gateway 暴露，或明确设计服务间认证，不能直接公开 4100。

## 3. 目录与架构

- `src/index.ts`：HTTP 服务启动、信号处理和优雅退出。
- `src/app.ts`：Express 应用、路由和错误处理。
- `src/config/env.ts`：环境变量校验与默认值。
- `src/db/client.ts`：PostgreSQL Pool 和 Drizzle 客户端。
- `src/db/schema.ts`：领域表入口，当前为空。
- `drizzle/`：未来数据库迁移，当前只有占位文件。
- `test/app.test.ts`：HTTP 行为。
- `test/config.test.ts`：配置解析。
- `compose.yaml`：本地 PostgreSQL + Deployment，当前不是生产方案。
- `Dockerfile`：Node.js 24 多阶段生产镜像。

保持依赖方向简单：路由/服务层依赖明确的数据访问接口，领域逻辑不要写进
`src/index.ts`。引入部署执行器前应先定义任务状态机、并发模型、取消语义、
超时、日志持久化和故障恢复。

## 4. 本地工作

```bash
nvm use
pnpm install
cp .env.example .env
pnpm dev
```

也可以用本地 Compose 启动服务和 PostgreSQL：

```bash
docker compose up --build
```

常用验证：

```bash
pnpm typecheck
pnpm test
pnpm build
pnpm exec eslint <本次修改的文件...>
```

只对本次修改或新增的文件执行 ESLint，不运行全项目 lint 或 format。不要删除
现有 `console.log`。纯 Markdown 变更无需代码 lint。修改 Compose 时额外执行
`docker compose config --quiet`。

HTTP 测试通过 `createApp` 注入假的 `checkDatabase`，不应依赖真实数据库。
数据库仓储或迁移出现后，使用独立测试库，不允许连接生产数据库。

## 5. 环境变量

- `NODE_ENV`
- `HOST`、`PORT`，默认本地 `127.0.0.1:4100`
- `DATABASE_URL`，生产必填
- `TRUST_PROXY`
- `APP_VERSION`
- `BUILD_SHA`

不得提交 `.env`、数据库连接串、账号密码、SSH key、Registry 凭据、Webhook
secret 或云平台 token。生产不能使用 Compose 中的开发默认数据库口令。

服务位于可信反向代理后时才配置 `TRUST_PROXY`，并按实际代理地址或跳数收紧。
如果错误信任公网转发头，请求 IP、审计和后续限流都可能失真。

## 6. 数据库规则

- 先定义领域模型和不变量，再添加表，不为猜测中的功能提前铺表。
- Schema 修改写入 `src/db/schema.ts`，使用 `pnpm db:generate` 生成迁移。
- 检查生成 SQL 并提交迁移；不要修改已经在生产执行过的历史迁移。
- 服务启动不自动迁移。发布前独立备份、迁移并验证。
- 破坏性变更需要兼容发布、数据回填与回滚方案。
- 部署任务和事件必须使用数据库约束保证幂等，不能只依赖内存标记。

## 7. Gateway 与 Hook 契约

计划中的公网入口：

- `/api/gateway/deployment/hooks/**`：Gateway 公开路由，改写到本服务
  `/api/hooks/**`。
- `/api/gateway/deployment/**`：Gateway 受保护路由，改写到本服务 `/api/**`，
  当前规划最低角色为 `super`。

Gateway 会验证 SSO access token、移除客户端提供的 `X-User-*`，再注入可信身份
头。本服务仍需执行资源级授权和审计，不能只判断请求中是否存在身份头。

Webhook 是公开入口，必须在本服务实现：

- 针对具体提供方的原始请求体签名校验。
- 时间戳/nonce 防重放和合理时间窗口。
- 基于提供方 delivery/event ID 的持久化幂等。
- 安全的事件类型白名单、负载 schema 与 body 大小限制。
- 快速确认与异步处理边界、重试语义和审计日志。

在这些能力和测试完成前，不要启用 Gateway 生产 Hook 路由。

## 8. 生产目标拓扑

2026-10-15 已核验的生产环境中，Deployment 尚未部署，后端服务器没有容器，
4100 也未监听。目标链路是：

```text
浏览器
  -> https://sso.xpeach.top/api/**
  -> 前端 Nginx 101.200.164.181
  -> https://api.xpeach.top
  -> 后端 Nginx 82.157.201.240
  -> Gateway 127.0.0.1:3000
  -> Docker 网络 gateway
  -> deployment:4100
  -> 独立 PostgreSQL
```

目标部署要求：

- Deployment 容器加入名为 `gateway` 的外部 Docker 网络。
- 网络中的服务名或 alias 固定为 `deployment`。
- Gateway 通过 `http://deployment:4100` 访问，不依赖宿主机发布 4100。
- 容器还需连接其数据库所在网络。
- `/api/health/ready` 返回 200 后才可接流量。
- 使用独立生产数据库；历史数据库主机为 `82.157.56.196:5432`，上线前必须重新
  确认库名、专用账号、TLS、防火墙和备份，本文不记录凭据。

当前 `compose.yaml` 会启动本地 PostgreSQL，且未连接外部 `gateway` 网络，不能
直接作为最终生产配置。仓库也没有 GitHub Actions 发布流程。生产实现前应参照
`../gateway`、`../sso` 的镜像和回滚模式，并阅读
`../生产部署前检查清单.md`。

## 9. 修改规则

1. 开始前运行 `git status --short`，保留所有非本任务改动。
2. 新能力先明确 API、状态机、失败语义、权限和持久化，再实现端点。
3. 不允许把用户输入直接拼接进 Shell、SSH、文件路径、镜像名或集群命令。
4. 执行外部操作时必须设计允许列表、超时、取消、最小权限、审计和敏感信息脱敏。
5. 日志不得包含凭据、Authorization、Cookie、Webhook secret 或完整敏感负载。
6. 不擅自连接或修改生产数据库和服务器配置。
7. 不运行破坏性 Git 命令，不覆盖用户未提交的修改。

## 10. 完成标准

- 修改过的代码文件逐一通过 ESLint。
- `pnpm typecheck`、相关测试和 `pnpm build` 通过。
- 新 API 覆盖成功、无效输入、无权限、重复事件和依赖故障。
- Schema 变更包含迁移、约束、索引及回滚说明。
- Hook 变更通过签名、防重放、幂等和重试测试。
- Compose 变更通过配置校验，并符合 `gateway` 外部网络约束。
- 上线前通过本机就绪检查和 Gateway 的 401/403/成功链路验证。
