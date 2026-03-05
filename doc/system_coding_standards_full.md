# Byzy 校服系统全量代码与维护规范 (V1 + V2)

## 1. 全局架构规范
系统由三个相互协作的端组成，必须遵循统一的工程化标准：
- **Server**: 后端 API 枢纽，负责业务逻辑与数据存储。
- **Admin**: B 端管理后台，负责资源调度、对账与发货控制。
- **WebClient**: C 端 H5 页面，负责家长填报、支付与售后自助。

## 2. 目录职责定义
```text
byzy-project/
├── server/             # 后端源码
│   ├── src/entity/     # 核心：必须使用 TypeORM 装饰器，表名统一小写下划线
│   ├── src/controller/ # 逻辑：所有逻辑入库前必须经过 Controller 校验
│   └── src/middleware/ # 拦截：Auth 校验与文件上传中间件
├── admin/              # 管理端源码
│   ├── src/pages/      # 业务页面：按功能模块划分 (如 SchoolMgmt.tsx)
│   ├── src/services/   # API 封装：建议按后端 Controller 对应划分
│   └── src/utils/      # 请求封装 (request.ts)
└── webClient/          # 家长端源码 (Next.js)
    └── src/app/        # App Router 结构，按 [schoolId] 动态路由
```

## 3. 命名约定
- **前端组件**: 采用 PascalCase (如 `OrderCard.tsx`)。
- **后端实体**: 类名 PascalCase (`OrderItem`)，字段名 camelCase (`shippedAt`)，对应数据库列名 snake_case (`shipped_at`)。
- **API 路由**: 统一使用 `kebab-case` (如 `/api/after-sales/pending-count`)。

## 4. 关键开发准则 (Strict Rules)
- **数据库事务**: 凡涉及 `Order`、`Student` 同时变更的操作（如支付回调），**必须**封装在 TypeORM `transaction` 块内。
- **权限边界**: 后端 Admin 路由必须挂载 `auth` 中间件；Public 路由严禁暴露敏感的用户隐私数据（如身份证号）。
- **组件属性**: Admin 端已全面升级至 Ant Design v6。严禁使用 `visible` 属性，必须使用 `open`。严禁使用 `bodyStyle`，必须使用 `styles={{ body: ... }}`。
- **金额存储**: 数据库中所有金额字段严禁使用浮点数，**必须且仅限**以“分”为单位的整数 (Integer) 存储。

## 5. 故障排查规范
- **日志**: 所有 500 错误必须在控制台打印 `error` 堆栈，并在响应中返回明确的 `code: 500`。
- **调试**: 支付测试阶段可使用 `mock-callback` 模拟真实支付回调。
