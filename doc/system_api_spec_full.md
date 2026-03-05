# Byzy 校服系统全量 API 接口文档 (V1 + V2)

## 1. 通用规范
- **Content-Type**: `application/json`
- **认证**: 管理端接口 Header 携带 `Authorization: Bearer <token>`
- **返回结构**: 
  ```json
  { "code": 200, "data": {}, "message": "success" }
  ```

## 2. 管理端接口 (Admin API)

### 2.1 认证与基础 (Auth)
- **POST /api/login**
  - **参数**: `{ "username": "admin", "password": "..." }`
  - **响应**: 返回 JWT Token。

### 2.2 组织架构管理
- **GET /api/schools/stats**: 获取各校销售额、套数汇总看板数据（Dashboard 用）。
- **POST /api/schools/batch**: 批量创建学校/年级/班级架构。
- **PUT /api/schools/:id/batch**: 增量更新或重命名物理架构。
- **GET /api/classes**: 根据年级 ID 获取关联班级。

### 2.3 订单与补单
- **GET /api/orders**: 综合搜索（学校、年级、班级、手机号、日期、状态）。
- **POST /api/orders/supplementary**: 管理员后台手动为学生补充创建已支付订单。
- **DELETE /api/orders/:id**: 删除未支付/废弃订单。

### 2.4 发货历史
- **POST /api/shipping/:schoolId/confirm**: 执行批量发货，并存入不可篡改批次快照。
- **GET /api/shipping/:schoolId/history-summary**: 汇总历史总销量、总退款及历次发货情况。
- **GET /api/shipping/batch/:batchId/export**: 拉取指定批次的原始发货 JSON 数据。

### 2.5 售后服务
- **PUT /api/after-sales/:id/approve**: 审批通过调换或退款申请，同步更新订单实体。
- **GET /api/after-sales/pending-refund-count**: 获取侧边栏 Badge 提示的待处理数量。

## 3. 用户端接口 (WebClient Public API)

### 3.1 身份与查询
- **GET /api/public/school/:id**: 获取学校的基础销售配置（图、价、开关）。
- **GET /api/public/students/query**: 姓名+手机+生日 组合查询。
- **GET /api/public/students/query-by-phone**: 仅限手机号聚合查询所有关联订单，用于 H5 端列表展示。

### 3.2 订购闭环
- **POST /api/public/order/v2**: 创建暂存订单，锁定总金额与尺码。
- **POST /api/public/after-sales**: 家长端提交售后申请。

### 3.3 支付对接
- **POST /api/public/prepay**: 获取支付请求参数。
- **POST /api/public/payment/callback**: **核心逻辑点**，支付平台成功推送后执行订单固化、学生自动录入。

## 4. 导入模块 (Import System)
- **POST /api/import/roster-preview**: 上传年级名册 Excel，计算 A/B/C 三种匹配状态。
- **POST /api/import/roster-apply**: 将预览完成的名册正式录入并更新学生所属班级。
