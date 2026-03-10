import { Request, Response } from "express"
import { AppDataSource } from "../data-source"
import { AfterSalesRecord, AfterSalesStatus, AfterSalesType } from "../entity/AfterSalesRecord"
import { Order, OrderStatus } from "../entity/Order"
import { PaymentService } from "../services/PaymentService"

export class AfterSalesController {
    static async getAll(req: Request, res: Response) {
        try {
            const { page = 1, pageSize = 10, status, schoolId, keyword } = req.query
            const skip = (Number(page) - 1) * Number(pageSize)
            const take = Number(pageSize)

            const queryBuilder = AppDataSource.getRepository(AfterSalesRecord).createQueryBuilder("record")
                .leftJoinAndSelect("record.order", "order")
                .leftJoinAndSelect("order.student", "student")
                .leftJoinAndSelect("student.class", "class")
                .leftJoinAndSelect("student.grade", "grade")
                .leftJoinAndSelect("grade.school", "school")
                .leftJoinAndSelect("order.items", "items")
                .leftJoinAndSelect("items.product", "product")
                .leftJoinAndSelect("record.product", "recordProduct")
                .orderBy("record.createdAt", "DESC")
                .skip(skip)
                .take(take)

            if (status && status !== 'ALL' && status !== 'all') {
                queryBuilder.andWhere("record.status = :status", { status })
            }

            if (schoolId && schoolId !== 'all') {
                queryBuilder.andWhere("school.id = :schoolId", { schoolId: Number(schoolId) })
            }

            if (keyword) {
                queryBuilder.andWhere("(student.name LIKE :keyword OR order.orderNo LIKE :keyword)", { keyword: `%${keyword}%` })
            }

            const [list, total] = await queryBuilder.getManyAndCount()

            res.json({
                code: 200,
                data: {
                    list,
                    total,
                    page: Number(page),
                    pageSize: Number(pageSize)
                }
            })
        } catch (error) {
            console.error("Get after-sales error:", error)
            res.status(500).json({ code: 500, message: "Internal server error" })
        }
    }

    static async approve(req: Request, res: Response) {
        try {
            const id = parseInt(req.params.id)
            await AppDataSource.manager.transaction(async (transactionalEntityManager) => {
                const record = await transactionalEntityManager.findOne(AfterSalesRecord, {
                    where: { id },
                    relations: ["order", "product"]
                })

                if (!record) throw new Error("Record not found")
                if (record.status !== AfterSalesStatus.PENDING) throw new Error("Record already processed")

                // Update record status
                record.status = AfterSalesStatus.PROCESSED
                await transactionalEntityManager.save(record)

                // Update order status based on type
                if (record.type === "REFUND") {
                    // Calculate refund amount: If productId is set, use it. Otherwise (legacy) use order total.
                    let refundAmount = record.order.totalAmount
                    if (record.product) {
                        refundAmount = Number(record.product.price) * record.newQuantity
                    }

                    // 调用收錢吧退款接口
                    if (record.order.clientSn) {
                        const refundRequestNo = `REF${record.id}_${Date.now()}`
                        const refundResult = await PaymentService.refund({
                            clientSn: record.order.clientSn,
                            refundAmount: refundAmount,
                            refundRequestNo
                        })
                        console.log('[AfterSales] Refund result:', JSON.stringify(refundResult))

                        const bizResult = refundResult?.biz_response?.result_code
                        if (bizResult !== 'REFUND_SUCCESS') {
                            const errMsg = refundResult?.biz_response?.error_message || '退款失败'
                            throw new Error(`收錢吧退款失败: ${errMsg}`)
                        }
                    } else {
                        console.warn('[AfterSales] Order has no clientSn, skipping third-party refund call')
                    }

                    // If it's a full refund, set status to REFUNDED. 
                    // If partial, we stay in PAID but maybe add a flag? 
                    // Guidance: "最后的显示逻辑应该在商品项中体现... 总数的计算应同步".
                    // For now, we set order status to PAID (or stay PAID) if it's partial, or REFUNDED if full.
                    // Calculate total already refunded + current refund
                    const previousRefunds = await transactionalEntityManager.find(AfterSalesRecord, {
                        where: { orderId: record.orderId, status: AfterSalesStatus.PROCESSED, type: "REFUND" as any },
                        relations: ["order", "product"]
                    })
                    const totalRefundedBalance = previousRefunds.reduce((sum, r) => {
                        let amt = 0
                        if (r.product) {
                            amt = Number(r.product.price) * r.newQuantity
                        } else if (r.order) {
                            // fallback for legacy records without product relation
                            amt = r.order.totalAmount
                        } else {
                            // Safety fallback if order is missing
                            console.warn('[AfterSales] Refund record has no product or order relation loaded:', r.id)
                        }
                        return sum + amt
                    }, 0)

                    if (totalRefundedBalance >= record.order.totalAmount) {
                        record.order.status = OrderStatus.REFUNDED
                    } else {
                        record.order.status = OrderStatus.PARTIAL_REFUNDED
                    }
                    await transactionalEntityManager.save(record.order)
                }
            })

            res.json({ code: 200, message: "Approved successfully" })
        } catch (error: any) {
            console.error("Approve after-sales error:", error)
            res.status(500).json({ code: 500, message: error.message || "Internal server error" })
        }
    }

    static async reject(req: Request, res: Response) {
        try {
            const id = parseInt(req.params.id)
            const { reason } = req.body

            const recordRepository = AppDataSource.getRepository(AfterSalesRecord)
            const record = await recordRepository.findOne({
                where: { id },
                relations: ["order"]
            })

            if (!record) return res.status(404).json({ code: 404, message: "Record not found" })
            if (record.status !== AfterSalesStatus.PENDING) return res.status(400).json({ code: 400, message: "Record already processed" })

            record.status = AfterSalesStatus.REJECTED
            await recordRepository.save(record)

            // Revert order status back to PAID if it was REFUNDING or EXCHANGING
            if (record.order.status === OrderStatus.REFUNDING || record.order.status === OrderStatus.EXCHANGING) {
                record.order.status = OrderStatus.PAID
                await AppDataSource.getRepository(Order).save(record.order)
            }

            res.json({ code: 200, message: "Rejected successfully" })
        } catch (error) {
            console.error("Reject after-sales error:", error)
            res.status(500).json({ code: 500, message: "Internal server error" })
        }
    }

    static async create(req: Request, res: Response) {
        try {
            console.log('[AfterSales] Create record request:', JSON.stringify(req.body))
            const { order_id, type, product_id, original_size, new_size, original_quantity, new_quantity, is_special_size, height, weight } = req.body

            // Loose check for order_id to support string numbers and explicit 0 checks
            if ((order_id === undefined || order_id === null || order_id === '') || !type) {
                console.warn('[AfterSales] Incomplete params:', { order_id, type })
                return res.status(400).json({ code: 400, message: "参数不完整" })
            }

            const order = await AppDataSource.getRepository(Order).findOne({
                where: { id: Number(order_id) },
                relations: ["items", "items.product"]
            })
            if (!order) return res.status(404).json({ code: 404, message: "订单不存在" })

            // Only allow after-sales for orders that have been PAID or SHIPPED
            const allowedStatuses = [OrderStatus.PAID, OrderStatus.SHIPPED]
            if (!allowedStatuses.includes(order.status)) {
                return res.status(400).json({ code: 400, message: "只有已支付或已发货的订单可以申请售后" })
            }

            if (type === "REFUND") {
                order.status = OrderStatus.REFUNDING
                await AppDataSource.getRepository(Order).save(order)
            } else if (type === "EXCHANGE") {
                order.status = OrderStatus.EXCHANGING
                await AppDataSource.getRepository(Order).save(order)
            }

            // Determine specific item if product_id is provided
            const targetItem = product_id
                ? order.items?.find(i => i.product.id === Number(product_id))
                : order.items?.[0]

            const finalOriginalSize = original_size || targetItem?.size || "未填"
            const finalOriginalQty = Number(original_quantity || targetItem?.quantity || 1)

            const record = AppDataSource.getRepository(AfterSalesRecord).create({
                orderId: Number(order_id),
                productId: product_id ? Number(product_id) : (targetItem?.product?.id || null),
                type,
                originalSize: finalOriginalSize,
                newSize: new_size || null,
                originalQuantity: finalOriginalQty,
                newQuantity: Number(new_quantity || finalOriginalQty),
                isSpecialSize: !!is_special_size,
                height: height ? Number(height) : null,
                weight: weight ? Number(weight) : null,
            })

            await AppDataSource.getRepository(AfterSalesRecord).save(record)

            return res.json({ code: 200, message: "申请已提交", data: record })
        } catch (error: any) {
            console.error("Create after-sales error detail:", error)
            const msg = error.message || ""

            // Comprehensive schema check
            if (msg.includes("Unknown column") || msg.includes("has no column") || msg.includes("Data truncated")) {
                return res.status(500).json({
                    code: 500,
                    message: `数据库结构陈旧：${msg.includes("status") ? "订单状态值不匹配" : "缺少尺码/身高/体重字段"}。请执行 v2_db_migration.sql 中的更新脚本。`
                })
            }

            res.status(500).json({ code: 500, message: msg || "Internal server error" })
        }
    }

    static async getPendingRefundCount(req: Request, res: Response) {
        try {
            const count = await AppDataSource.getRepository(AfterSalesRecord).count({
                where: {
                    status: AfterSalesStatus.PENDING,
                    type: "REFUND" as any
                }
            })
            res.json({ code: 200, data: count })
        } catch (error) {
            console.error("Get pending refund count error:", error)
            res.status(500).json({ code: 500, message: "Internal server error" })
        }
    }

    static async cancel(req: Request, res: Response) {
        try {
            const id = parseInt(req.params.id)
            if (isNaN(id)) return res.status(400).json({ code: 400, message: "参数错误" })

            const recordRepository = AppDataSource.getRepository(AfterSalesRecord)
            const record = await recordRepository.findOne({
                where: { id },
                relations: ["order"]
            })

            if (!record) return res.status(404).json({ code: 404, message: "记录不存在" })
            if (record.status !== AfterSalesStatus.PENDING) return res.status(400).json({ code: 400, message: "只有待审核的状态可以取消" })

            if (!record.order) {
                return res.status(400).json({ code: 400, message: "关联订单数据异常" })
            }

            // Use transaction for consistency
            await AppDataSource.manager.transaction(async (manager) => {
                // 1. Mark record as cancelled
                record.status = AfterSalesStatus.CANCELLED
                await manager.save(record)

                // 2. Check for other pending after-sales for this order
                const otherPending = await manager.count(AfterSalesRecord, {
                    where: {
                        orderId: record.orderId,
                        status: AfterSalesStatus.PENDING
                    }
                })

                if (otherPending === 0) {
                    // Robust rollback status machine
                    const currentOrder = record.order

                    // Priority 1: Check if there are any processed refunds
                    const processedRefundsCount = await manager.count(AfterSalesRecord, {
                        where: {
                            orderId: record.orderId,
                            status: AfterSalesStatus.PROCESSED,
                            type: AfterSalesType.REFUND
                        }
                    })

                    if (processedRefundsCount > 0) {
                        currentOrder.status = OrderStatus.PARTIAL_REFUNDED
                    }
                    // Priority 2: Check if order has been shipped
                    else if (currentOrder.shippedAt) {
                        currentOrder.status = OrderStatus.SHIPPED
                    }
                    // Priority 3: Default back to PAID
                    else {
                        currentOrder.status = OrderStatus.PAID
                    }

                    await manager.save(currentOrder)
                }
            })

            res.json({ code: 200, message: "取消成功" })
        } catch (error: any) {
            console.error("Cancel after-sales error:", error)
            const msg = error.message || ""
            if (msg.includes("Unknown column") || msg.includes("Data truncated") || msg.includes("mismatch")) {
                return res.status(500).json({
                    code: 500,
                    message: `数据库操作失败：可能是字段缺失或状态枚举不匹配。请执行 v2_db_status_enum_fix.sql 中的更新脚本。详细错误: ${msg}`
                })
            }
            res.status(500).json({ code: 500, message: msg || "Internal server error" })
        }
    }
}
