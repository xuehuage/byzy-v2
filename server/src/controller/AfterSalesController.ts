import { Request, Response } from "express"
import { AppDataSource } from "../data-source"
import { AfterSalesRecord, AfterSalesStatus } from "../entity/AfterSalesRecord"
import { Order, OrderStatus } from "../entity/Order"
import { PaymentService } from "../services/PaymentService"

export class AfterSalesController {
    static async getAll(req: Request, res: Response) {
        try {
            const { page = 1, pageSize = 10, status } = req.query
            const skip = (Number(page) - 1) * Number(pageSize)
            const take = Number(pageSize)

            const queryBuilder = AppDataSource.getRepository(AfterSalesRecord).createQueryBuilder("record")
                .leftJoinAndSelect("record.order", "order")
                .leftJoinAndSelect("order.student", "student")
                .leftJoinAndSelect("order.items", "items")
                .leftJoinAndSelect("items.product", "product")
                .orderBy("record.createdAt", "DESC")
                .skip(skip)
                .take(take)

            if (status && status !== 'all') {
                queryBuilder.andWhere("record.status = :status", { status })
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
                    relations: ["order"]
                })

                if (!record) throw new Error("Record not found")
                if (record.status !== AfterSalesStatus.PENDING) throw new Error("Record already processed")

                // Update record status
                record.status = AfterSalesStatus.PROCESSED
                await transactionalEntityManager.save(record)

                // Update order status based on type
                if (record.type === "REFUND") {
                    // 调用收錢吧退款接口
                    if (record.order.clientSn) {
                        const refundRequestNo = `REF${record.id}_${Date.now()}`
                        const refundResult = await PaymentService.refund({
                            clientSn: record.order.clientSn,
                            refundAmount: record.order.totalAmount,
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

                    record.order.status = OrderStatus.REFUNDED
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
            const { order_id, type, original_size, new_size, original_quantity, new_quantity } = req.body
            if (!order_id || !type || !original_quantity) {
                return res.status(400).json({ code: 400, message: "参数不完整" })
            }

            const order = await AppDataSource.getRepository(Order).findOne({ where: { id: Number(order_id) } })
            if (!order) return res.status(404).json({ code: 404, message: "订单不存在" })

            if (type === "REFUND") {
                order.status = OrderStatus.REFUNDING
                await AppDataSource.getRepository(Order).save(order)
            } else if (type === "EXCHANGE") {
                order.status = OrderStatus.EXCHANGING
                await AppDataSource.getRepository(Order).save(order)
            }

            const record = AppDataSource.getRepository(AfterSalesRecord).create({
                orderId: Number(order_id),
                type,
                originalSize: original_size || "",
                newSize: new_size || null,
                originalQuantity: Number(original_quantity),
                newQuantity: Number(new_quantity || original_quantity),
            })
            await AppDataSource.getRepository(AfterSalesRecord).save(record)

            return res.json({ code: 200, message: "申请已提交", data: record })
        } catch (error) {
            console.error("Create after-sales error:", error)
            res.status(500).json({ code: 500, message: "Internal server error" })
        }
    }
}
