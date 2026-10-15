# Deployment 部署平台

基于 Express 5、PostgreSQL、Drizzle ORM 和 TypeScript 的部署平台后端服务。
本仓库只包含部署平台服务；网关、前端和认证服务位于各自独立仓库。

当前版本只提供可运行的工程骨架和运维探针，尚未定义部署领域模型与业务 API。

## 环境要求

- Node.js 24 或更高版本
- pnpm 10 或更高版本
- PostgreSQL

## 本地启动

```bash
nvm use
pnpm install
cp .env.example .env
pnpm dev
```

默认监听 `http://127.0.0.1:4100`，接口统一使用 `/api` 前缀。
服务启动不依赖立即建立数据库连接；
就绪检查会真实验证 PostgreSQL 连通性。

## Docker Compose

以下命令会同时启动 PostgreSQL 和 Deployment 服务：

```bash
docker compose up --build
```

## 当前端点

| 路径 | 说明 |
| --- | --- |
| `GET /api` | 服务名称与版本 |
| `GET /api/health` | 进程存活检查 |
| `GET /api/health/ready` | PostgreSQL 就绪检查 |
| `GET /api/version` | 版本与构建标识 |
| 其他路径 | 统一返回 404 |

## 常用命令

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 启动开发服务 |
| `pnpm build` | 构建生产代码 |
| `pnpm start` | 运行构建产物 |
| `pnpm typecheck` | TypeScript 类型检查 |
| `pnpm lint` | ESLint 检查 |
| `pnpm test` | 运行测试 |
| `pnpm db:generate` | 生成 Drizzle 迁移 |
| `pnpm db:migrate` | 执行数据库迁移 |
| `pnpm db:studio` | 启动 Drizzle Studio |

## 目录结构

```text
src/
├── app.ts             # Express 应用装配
├── index.ts           # 服务启动与优雅退出
├── config/env.ts      # 环境变量校验
└── db/
    ├── client.ts      # PostgreSQL / Drizzle 客户端
    └── schema.ts      # 业务表定义入口，当前为空
test/                  # 基础配置与 HTTP 测试
drizzle/               # 后续生成的数据库迁移
```

## 设计边界

- 本阶段不包含应用、环境、部署任务或部署日志等业务表。
- 本阶段不执行 Shell、SSH、Docker 或 Kubernetes 操作。
- 数据库迁移不会在服务启动时自动执行。
- 后续业务 API、鉴权方式和部署执行协议确认后再扩展。
