import { Request, Response } from "express"
import { AppDataSource } from "../data-source"
import dayjs from "dayjs"
import { In, Between, LessThanOrEqual, MoreThanOrEqual } from "typeorm"
import { Order, OrderStatus } from "../entity/Order"
import { School } from "../entity/School"
import { Student } from "../entity/Student"
import { AfterSalesRecord, AfterSalesType, AfterSalesStatus } from "../entity/AfterSalesRecord"

// Product type → 中文名称
const productTypeNames: Record<number, string> = { 0: '夏装', 1: '春秋装', 2: '冬装' }

export class ShippingController {
    /**
     * 获取发货统计（按学校汇总）
     * GET /shipping/stats?schoolName=xxx
     */
    static async getStats(req: Request, res: Response) {
        try {
            const { schoolName } = req.query

            // 1. 获取所有学校列表（支持筛选）
            const schoolRepo = AppDataSource.getRepository(School)
            let schoolQb = schoolRepo.createQueryBuilder('school')
            if (schoolName) {
                schoolQb = schoolQb.where('school.name LIKE :name', { name: `%${schoolName}%` })
            }
            const schools = await schoolQb.getMany()

            // 2. 对每个学校统计已支付（PAID）且未发货的订单
            const result = []
            for (const school of schools) {
                // 查找该学校的所有已支付未发货订单
                const orders = await AppDataSource.getRepository(Order)
                    .createQueryBuilder('order')
                    .innerJoin('order.student', 'student')
                    .innerJoin('student.grade', 'grade')
                    .innerJoin('grade.school', 'school')
                    .innerJoinAndSelect('order.items', 'item')
                    .innerJoinAndSelect('item.product', 'product')
                    .leftJoinAndSelect('order.afterSales', 'asr', 'asr.status = :asrProcessed AND asr.type = :asrRefund', { asrProcessed: AfterSalesStatus.PROCESSED, asrRefund: 'REFUND' })
                    .where('school.id = :schoolId', { schoolId: school.id })
                    .andWhere('order.status IN (:...statuses)', { statuses: [OrderStatus.PAID, OrderStatus.EXCHANGING, OrderStatus.PARTIAL_REFUNDED] })
                    .getMany()

                if (orders.length === 0) continue // 无待发货订单则跳过

                // 汇总套数
                const qtySummary: Record<number, number> = {}
                for (const order of orders) {
                    for (const item of order.items) {
                        const t = item.product?.type ?? -1
                        // Subtract processed refunds for this specific product
                        const refundedQty = (order.afterSales || [])
                            .filter(asr => asr.productId === item.product?.id)
                            .reduce((sum, asr) => sum + Number(asr.newQuantity), 0)

                        const actualQty = Math.max(0, item.quantity - refundedQty)
                        qtySummary[t] = (qtySummary[t] || 0) + actualQty
                    }
                }

                const qtyText = Object.entries(qtySummary)
                    .filter(([type]) => productTypeNames[Number(type)])
                    .map(([type, qty]) => `${productTypeNames[Number(type)]}${qty}套`)
                    .join('；') || '—'

                result.push({
                    schoolId: school.id,
                    schoolName: school.name,
                    pendingOrderCount: orders.length,
                    qtySummary: qtyText,
                })
            }

            return res.json({ code: 200, data: result })
        } catch (error) {
            console.error('ShippingController.getStats error:', error)
            return res.status(500).json({ code: 500, message: 'Internal server error' })
        }
    }

    /**
     * 导出发货单（当前学校已付款所有学生信息）
     * GET /shipping/:schoolId/export
     * Returns JSON array; frontend will convert to Excel/download
     */
    static async exportManifest(req: Request, res: Response) {
        try {
            const schoolId = parseInt(req.params.schoolId)

            const orders = await AppDataSource.getRepository(Order)
                .createQueryBuilder('order')
                .innerJoinAndSelect('order.student', 'student')
                .leftJoinAndSelect('student.grade', 'grade')
                .leftJoinAndSelect('student.class', 'class')
                .innerJoinAndSelect('order.items', 'item')
                .innerJoinAndSelect('item.product', 'product')
                .leftJoinAndSelect('order.afterSales', 'asr', 'asr.status IN (:...asrStatuses)', { asrStatuses: [AfterSalesStatus.PENDING, AfterSalesStatus.PROCESSED] })
                .innerJoin('student.grade', 'g')
                .innerJoin('g.school', 'school')
                .where('school.id = :schoolId', { schoolId })
                .andWhere('order.status IN (:...statuses)', { statuses: [OrderStatus.PAID, OrderStatus.EXCHANGING, OrderStatus.PARTIAL_REFUNDED] })
                .orderBy('class.name', 'ASC')
                .addOrderBy('student.name', 'ASC')
                .getMany()

            const rows = orders.flatMap(order => {
                return order.items.map(item => {
                    const isExchanging = order.status === OrderStatus.EXCHANGING

                    // 1. Get pending exchange for this specific product (if any)
                    const pendingExchange = (order.afterSales || []).find(asr =>
                        asr.productId === item.product?.id &&
                        asr.type === AfterSalesType.EXCHANGE &&
                        asr.status === AfterSalesStatus.PENDING
                    );

                    // 2. Get processed refunds for this specific product (if any)
                    const refundedQty = (order.afterSales || [])
                        .filter(asr =>
                            asr.productId === item.product?.id &&
                            asr.type === AfterSalesType.REFUND &&
                            asr.status === AfterSalesStatus.PROCESSED
                        )
                        .reduce((sum, r) => sum + Number(r.newQuantity), 0);

                    // 3. Final calculation: 
                    // If exchanging, use exchange value; 
                    // otherwise use (original - processed refunds)
                    const actualQty = pendingExchange
                        ? pendingExchange.newQuantity
                        : Math.max(0, item.quantity - refundedQty);

                    const actualSize = pendingExchange?.newSize || item.size || '—';

                    return {
                        orderNo: order.orderNo,
                        studentName: order.student?.name || '',
                        gradeName: order.student?.grade?.name || '未设年级',
                        className: order.student?.class?.name || '未分班',
                        birthday: order.student?.birthday || '',
                        productType: productTypeNames[item.product?.type] || '校服',
                        size: actualSize,
                        originalSize: pendingExchange ? (item.size || '—') : '',
                        quantity: actualQty,
                        status: isExchanging ? '调换' : (refundedQty > 0 ? '部分退款' : '增订'),
                        isSpecialSize: item.isSpecialSize ? '是' : '否',
                        height: item.height || '',
                        weight: item.weight || ''
                    }
                })
            })

            return res.json({ code: 200, data: rows })
        } catch (error) {
            console.error('ShippingController.exportManifest error:', error)
            return res.status(500).json({ code: 500, message: 'Internal server error' })
        }
    }

    /**
     * 确认发货（将当前学校所有已付款订单改为已发货）
     * POST /shipping/:schoolId/confirm
     */
    static async confirmShip(req: Request, res: Response) {
        try {
            const schoolId = parseInt(req.params.schoolId)

            const updatedCount = await AppDataSource.manager.transaction(async (manager) => {
                const subQuery = manager.getRepository(Order)
                    .createQueryBuilder('o')
                    .select('o.id')
                    .innerJoin('o.student', 's')
                    .innerJoin('s.grade', 'g')
                    .where('g.school_id = :schoolId', { schoolId })
                    .andWhere('o.status IN (:...statuses)', { statuses: [OrderStatus.PAID, OrderStatus.EXCHANGING, OrderStatus.PARTIAL_REFUNDED] })

                const rawOrders = await subQuery.getMany()
                const orderIds = rawOrders.map(o => o.id)

                if (orderIds.length === 0) return 0

                // 1. Update orders to SHIPPED and set shippedAt
                await manager.getRepository(Order).update(orderIds, {
                    status: OrderStatus.SHIPPED,
                    shippedAt: new Date()
                })

                // 2. Mark pending Exchange records as PROCESSED
                await manager.getRepository(AfterSalesRecord).update(
                    { orderId: In(orderIds), type: AfterSalesType.EXCHANGE, status: AfterSalesStatus.PENDING },
                    { status: AfterSalesStatus.PROCESSED }
                )

                return orderIds.length
            })

            return res.json({
                code: 200,
                message: '发货成功',
                data: { updatedCount }
            })
        } catch (error) {
            console.error('ShippingController.confirmShip error:', error)
            return res.status(500).json({ code: 500, message: 'Internal server error' })
        }
    }

    /**
     * 导出已发货订单（按学生维度汇总，Dashboard使用）
     * GET /shipping/:schoolId/export-shipped?startDate=...&endDate=...
     */
    static async exportShippedList(req: Request, res: Response) {
        try {
            const schoolId = parseInt(req.params.schoolId)
            const { startDate, endDate } = req.query as { startDate?: string, endDate?: string }

            const query = AppDataSource.getRepository(Order)
                .createQueryBuilder('order')
                .innerJoinAndSelect('order.student', 'student')
                .leftJoinAndSelect('student.grade', 'grade')
                .leftJoinAndSelect('student.class', 'class')
                .innerJoinAndSelect('order.items', 'item')
                .innerJoinAndSelect('item.product', 'product')
                .leftJoinAndSelect('order.afterSales', 'asr', 'asr.status = :asrStatus', { asrStatus: AfterSalesStatus.PROCESSED })
                .innerJoin('student.grade', 'g')
                .innerJoin('g.school', 'school')
                .where('school.id = :schoolId', { schoolId })
                .andWhere('order.status = :status', { status: OrderStatus.SHIPPED })

            if (startDate) {
                query.andWhere('order.shippedAt >= :start', { start: `${startDate} 00:00:00` })
            }
            if (endDate) {
                query.andWhere('order.shippedAt <= :end', { end: `${endDate} 23:59:59` })
            }

            const orders = await query
                .orderBy('grade.name', 'ASC')
                .addOrderBy('class.name', 'ASC')
                .addOrderBy('student.name', 'ASC')
                .getMany()

            // Group by student for "一人一行"
            const studentMap = new Map<number, any>()

            orders.forEach(order => {
                const sid = order.studentId
                if (!studentMap.has(sid)) {
                    studentMap.set(sid, {
                        studentName: order.student?.name || '',
                        gradeName: order.student?.grade?.name || '',
                        className: order.student?.class?.name || '',
                        birthday: order.student?.birthday || '',
                        summerQty: 0,
                        summerSize: '—',
                        autumnQty: 0,
                        autumnSize: '—',
                        winterQty: 0,
                        winterSize: '—',
                        shippedAt: order.shippedAt ? dayjs(order.shippedAt).format('YYYY/MM/DD') : '—'
                    })
                }

                const sData = studentMap.get(sid)

                order.items.forEach(item => {
                    const type = item.product?.type // 0: 夏, 1: 春秋, 2: 冬

                    // Find processed exchange/refund for this item to get final size/qty
                    const processedASR = (order.afterSales || []).filter(asr => asr.productId === item.product?.id)
                    const refunds = processedASR.filter(asr => asr.type === AfterSalesType.REFUND)
                    const exchanges = processedASR.filter(asr => asr.type === AfterSalesType.EXCHANGE)

                    const refundedQty = refunds.reduce((sum, r) => sum + Number(r.newQuantity), 0)
                    const finalQty = Math.max(0, item.quantity - refundedQty)
                    const finalSize = exchanges.length > 0 ? exchanges[exchanges.length - 1].newSize : (item.size || '—')

                    if (type === 0) {
                        sData.summerQty += finalQty
                        if (finalQty > 0) sData.summerSize = finalSize
                    } else if (type === 1) {
                        sData.autumnQty += finalQty
                        if (finalQty > 0) sData.autumnSize = finalSize
                    } else if (type === 2) {
                        sData.winterQty += finalQty
                        if (finalQty > 0) sData.winterSize = finalSize
                    }
                })
            })

            const rows = Array.from(studentMap.values())
            return res.json({ code: 200, data: rows })
        } catch (error) {
            console.error('ShippingController.exportShippedList error:', error)
            return res.status(500).json({ code: 500, message: 'Internal server error' })
        }
    }
}
