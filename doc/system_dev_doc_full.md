# Byzy 校服系统全量技术开发文档

## 1. 架构总览
系统采用经典的前后端分离架构，分为三个端：管理端 (Admin)、用户端 (WebClient) 和服务端 (Server)。

### 1.1 技术栈
- **服务端 (Server)**: Node.js + Express + TypeScript + TypeORM.
- **管理端 (Admin)**: React + Vite + Ant Design v6.
- **家长端 (WebClient)**: Next.js + Ant Design Mobile.
- **数据库**: MySQL 8.0.

## 2. 数据库设计 (DB Schema)
系统共包含 12 张核心表，支撑起完整的业务链路。

### 2.1 实体关系图 (ER Diagram)
```mermaid
erDiagram
    ADMIN_USER {
        int id PK
        string username
        string password
    }
    SCHOOL {
        int id PK
        string name
        int summer_price
        boolean is_summer_active
        string summer_image
    }
    GRADE {
        int id PK
        int school_id FK
        string name
    }
    CLASS {
        int id PK
        int grade_id FK
        string name
    }
    STUDENT {
        int id PK
        int class_id FK
        string name
        string phone
        string birthday
    }
    PRODUCT {
        int id PK
        int school_id FK
        string type
        int price
    }
    ORDER {
        int id PK
        int student_id FK
        string status
        int total_amount
        datetime shipped_at
    }
    ORDER_ITEM {
        int id PK
        int order_id FK
        int product_id FK
        string size
        int quantity
    }
    ORDER_TEMP {
        int id PK
        string client_sn
        json order_data
    }
    AFTER_SALES_RECORD {
        int id PK
        int order_id FK
        string type
        string status
    }
    SHIPMENT_BATCH {
        int id PK
        int school_id FK
        json items_snapshot
        datetime created_at
    }
    TERMINAL {
        int id PK
        string terminal_sn
        string device_id
    }

    SCHOOL ||--o{ GRADE : "拥有"
    GRADE ||--o{ CLASS : "拥有"
    CLASS ||--o{ STUDENT : "包含"
    SCHOOL ||--o{ PRODUCT : "销售"
    STUDENT ||--o{ ORDER : "下单"
    ORDER ||--o{ ORDER_ITEM : "包含"
    ORDER ||--o{ AFTER_SALES_RECORD : "产生"
    ORDER_TEMP ||--o{ ORDER : "固化为"
    SCHOOL ||--o{ SHIPMENT_BATCH : "存档"
```

### 2.2 表职责说明
- **AdminUser**: 管理员账号信息与认证。
- **School/Grade/Class**: 层级化的组织架构。
- **Student**: 学生档案，支持基于姓名+手机+生日的唯一标识。
- **Product**: 产品目录，单价与上下架状态动态受 School 表字段同步。
- **Order/OrderItem**: 交易主表，记录最终支付结果。
- **OrderTemp**: 支付暂存区，解决支付回调前的“影子订单”问题。
- **AfterSalesRecord**: 处理退款、调换业务，状态直接驱动 Order 表的 lifecycle。针对已退款订单，具备自动对齐收钱吧状态的幂等逻辑。
- **ShipmentBatch**: 发货时的物理实物快照，确保对账单数据不随业务变更而变动。
- **Terminal**: 外部硬件/终端设备的 SN 码与激活授权管理。

## 3. 关键业务流程

### 3.1 订单闭环流程 (V2 优化版)
1. **暂存**: 家长提交订单信息，数据存入 `OrderTemp` 暂存表。
2. **预支付**: 调用第三方支付 API 获取预支付参数。
3. **固化**: 收到 `paymentCallback` 后，开启数据库事务：读取 `OrderTemp` -> 写入 `Order/OrderItem` -> 若学生不存则自动建档 -> 更新 `OrderTemp` 状态。

### 3.2 售后驱动逻辑
- **申请**: 状态变为 `REFUNDING` 或 `EXCHANGING`。
- **控制**: 在管理员审批前，家长端可通过 `cancel` 接口撤回。
- **审批**: 管理员点击通过，执行金额原路退回或属性变更。

### ### 3.4 退款容错与同步逻辑
- **幂等处理**: `PaymentService` 识别 `UPAY_REFUND_ORDER_NOOP` (及特定异常码 `EP41`)。若收钱吧已退款而本地状态未同步，再次发起审批时将自动同步本地数据库状态，确保双端一致。
- **关联保护**: 退款计算过程强制加载 `relations: ["order", "product"]`，杜绝事务中因延迟加载失效导致的 `totalAmount` 引用空指针报错。
