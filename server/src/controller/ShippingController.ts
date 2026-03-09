import { Request, Response } from "express"
import { AppDataSource } from "../data-source"
import dayjs from "dayjs"
import { In, Between, LessThanOrEqual, MoreThanOrEqual } from "typeorm"
import { Order, OrderStatus } from "../entity/Order"
import { School } from "../entity/School"
import { Student } from "../entity/Student"
import { AfterSalesRecord, AfterSalesType, AfterSalesStatus } from "../entity/AfterSalesRecord"
import { ShipmentBatch } from "../entity/ShipmentBatch"

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

                    const actualSize = pendingExchange
                        ? pendingExchange.newSize
                        : (item.isSpecialSize ? '特殊尺码' : (item.size || '—'));

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

            const result = await AppDataSource.manager.transaction(async (manager) => {
                const orders = await manager.getRepository(Order)
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
                    .getMany()

                if (orders.length === 0) return { updatedCount: 0 }

                const orderIds = orders.map(o => o.id)

                // 1. Create Manifest Snapshot for this batch
                const manifestRows = orders.flatMap(order => {
                    return order.items.map(item => {
                        const pendingExchange = (order.afterSales || []).find(asr =>
                            asr.productId === item.product?.id &&
                            asr.type === AfterSalesType.EXCHANGE &&
                            asr.status === AfterSalesStatus.PENDING
                        );
                        const refundedQty = (order.afterSales || [])
                            .filter(asr => asr.productId === item.product?.id && asr.type === AfterSalesType.REFUND && asr.status === AfterSalesStatus.PROCESSED)
                            .reduce((sum, r) => sum + Number(r.newQuantity), 0);

                        const actualQty = pendingExchange ? pendingExchange.newQuantity : Math.max(0, item.quantity - refundedQty);
                        if (actualQty <= 0) return null;

                        return {
                            orderNo: order.orderNo,
                            studentName: order.student?.name || '',
                            gradeName: order.student?.grade?.name || '',
                            className: order.student?.class?.name || '',
                            productType: item.product?.type, // store raw type for grouping later
                            productTypeName: productTypeNames[item.product?.type] || '校服',
                            size: pendingExchange?.newSize || (item.isSpecialSize ? '特殊尺码' : (item.size || '—')),
                            quantity: actualQty,
                            isSpecialSize: item.isSpecialSize ? '是' : '否',
                            height: item.height || '',
                            weight: item.weight || ''
                        }
                    }).filter(Boolean)
                })

                const totalQty = manifestRows.reduce((sum, row: any) => sum + row.quantity, 0)
                const now = new Date()

                // Create Batch Record
                const batch = manager.getRepository(ShipmentBatch).create({
                    schoolId,
                    totalQuantity: totalQty,
                    itemsSnapshot: manifestRows,
                    shippedAt: now
                })
                await manager.save(batch)

                // 2. Update orders to SHIPPED and set shippedAt
                await manager.getRepository(Order).update(orderIds, {
                    status: OrderStatus.SHIPPED,
                    shippedAt: now
                })

                // 3. Mark pending Exchange records as PROCESSED
                await manager.getRepository(AfterSalesRecord).update(
                    { orderId: In(orderIds), type: AfterSalesType.EXCHANGE, status: AfterSalesStatus.PENDING },
                    { status: AfterSalesStatus.PROCESSED }
                )

                return { updatedCount: orderIds.length, batchId: batch.id }
            })

            return res.json({
                code: 200,
                message: '发货成功',
                data: result
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
                .andWhere('order.shippedAt IS NOT NULL')

            if (startDate) {
                query.andWhere('order.shippedAt >= :start', { start: `${startDate} 00:00:00` })
            }
            if (endDate) {
                query.andWhere('order.shippedAt <= :end', { end: `${endDate} 23:59:59` })
            }

            const orders = await query
                .orderBy('order.shippedAt', 'DESC')
                .addOrderBy('grade.name', 'ASC')
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
                        recoveryNotes: [] as string[],
                        shippedAt: order.shippedAt ? dayjs(order.shippedAt).format('YYYY/MM/DD') : '—'
                    })
                }

                const sData = studentMap.get(sid)

                order.items.forEach(item => {
                    const type = item.product?.type // 0: 夏, 1: 春秋, 2: 冬
                    const typeName = productTypeNames[type] || '未知'

                    // Find processed exchange/refund for this specific product item
                    const processedASR = (order.afterSales || []).filter(asr => asr.productId === item.product?.id)
                    const refunds = processedASR.filter(asr => asr.type === AfterSalesType.REFUND)
                    const exchanges = processedASR.filter(asr => asr.type === AfterSalesType.EXCHANGE)

                    const refundedQty = refunds.reduce((sum, r) => sum + Number(r.newQuantity), 0)
                    const finalQty = Math.max(0, item.quantity - refundedQty)
                    const finalSize = exchanges.length > 0 ? exchanges[exchanges.length - 1].newSize : (item.size || '—')

                    // Record recovery notes
                    if (refundedQty > 0) {
                        sData.recoveryNotes.push(`${typeName}回收: ${refundedQty}套(退款)`)
                    }
                    exchanges.forEach(ex => {
                        sData.recoveryNotes.push(`${typeName}回收: ${ex.newQuantity}套(原${ex.originalSize})`)
                    })

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

            const rows = Array.from(studentMap.values()).map(r => ({
                ...r,
                recoveryNotes: r.recoveryNotes.length > 0 ? r.recoveryNotes.join('; ') : '—'
            }))
            return res.json({ code: 200, data: rows })
        } catch (error) {
            console.error('ShippingController.exportShippedList error:', error)
            return res.status(500).json({ code: 500, message: 'Internal server error' })
        }
    }

    /**
     * 获取历史详情（汇总统计 + 发货批次列表）
     * GET /shipping/:schoolId/history-summary
     */
    static async getHistorySummary(req: Request, res: Response) {
        try {
            const schoolId = parseInt(req.params.schoolId)

            // 1. 发货汇总 (从 ShipmentBatch itemsSnapshot 汇总)
            const batches = await AppDataSource.getRepository(ShipmentBatch).find({
                where: { schoolId },
                order: { shippedAt: 'DESC' }
            })

            const shippedTotals = { summer: 0, autumn: 0, winter: 0 }
            const batchRows = batches.map(b => {
                const snapshot = b.itemsSnapshot || []
                const typeSummary: Record<number, number> = {}
                snapshot.forEach((item: any) => {
                    const t = item.productType
                    typeSummary[t] = (typeSummary[t] || 0) + (item.quantity || 0)
                    if (t === 0) shippedTotals.summer += item.quantity
                    else if (t === 1) shippedTotals.autumn += item.quantity
                    else if (t === 2) shippedTotals.winter += item.quantity
                })

                const summaryText = Object.entries(typeSummary)
                    .map(([t, q]) => `${productTypeNames[Number(t)]}${q}套`)
                    .join('; ')

                return {
                    id: b.id,
                    shippedAt: b.shippedAt ? dayjs(b.shippedAt).format('YYYY/MM/DD HH:mm') : '—',
                    summaryText,
                    totalQuantity: b.totalQuantity
                }
            })

            // 2. 退款汇总
            const refunds = await AppDataSource.getRepository(AfterSalesRecord)
                .createQueryBuilder('asr')
                .innerJoin('asr.order', 'order')
                .innerJoin('order.student', 'student')
                .innerJoin('student.grade', 'grade')
                .innerJoin('asr.product', 'product')
                .where('grade.schoolId = :schoolId', { schoolId })
                .andWhere('asr.status = :status', { status: AfterSalesStatus.PROCESSED })
                .andWhere('asr.type = :type', { type: AfterSalesType.REFUND })
                .select('product.type', 'type')
                .addSelect('SUM(asr.newQuantity)', 'total')
                .groupBy('product.type')
                .getRawMany()

            const refundTotals = { summer: 0, autumn: 0, winter: 0 }
            refunds.forEach(r => {
                if (r.type === 0) refundTotals.summer = Number(r.total)
                else if (r.type === 1) refundTotals.autumn = Number(r.total)
                else if (r.type === 2) refundTotals.winter = Number(r.total)
            })

            // 3. 调换汇总
            const exchanges = await AppDataSource.getRepository(AfterSalesRecord)
                .createQueryBuilder('asr')
                .innerJoin('asr.order', 'order')
                .innerJoin('order.student', 'student')
                .innerJoin('student.grade', 'grade')
                .innerJoin('asr.product', 'product')
                .where('grade.schoolId = :schoolId', { schoolId })
                .andWhere('asr.status = :status', { status: AfterSalesStatus.PROCESSED })
                .andWhere('asr.type = :type', { type: AfterSalesType.EXCHANGE })
                .select('product.type', 'type')
                .addSelect('SUM(asr.newQuantity)', 'total')
                .groupBy('product.type')
                .getRawMany()

            const exchangeTotals = { summer: 0, autumn: 0, winter: 0 }
            exchanges.forEach(e => {
                if (e.type === 0) exchangeTotals.summer = Number(e.total)
                else if (e.type === 1) exchangeTotals.autumn = Number(e.total)
                else if (e.type === 2) exchangeTotals.winter = Number(e.total)
            })

            // 4. 实际销售 (初始订购 - 已退款)
            const sales = await AppDataSource.getRepository(Order)
                .createQueryBuilder('order')
                .innerJoin('order.student', 'student')
                .innerJoin('student.grade', 'grade')
                .innerJoin('order.items', 'item')
                .innerJoin('item.product', 'product')
                .where('grade.schoolId = :schoolId', { schoolId })
                .andWhere('order.status != :cancelled', { cancelled: 'UNPAID' }) // Simplified: anything but UNPAID
                .select('product.type', 'type')
                .addSelect('SUM(item.quantity)', 'total')
                .groupBy('product.type')
                .getRawMany()

            const salesTotals = { summer: 0, autumn: 0, winter: 0 }
            sales.forEach(s => {
                const initialQty = Number(s.total)
                if (s.type === 0) salesTotals.summer = initialQty - refundTotals.summer
                else if (s.type === 1) salesTotals.autumn = initialQty - refundTotals.autumn
                else if (s.type === 2) salesTotals.winter = initialQty - refundTotals.winter
            })

            return res.json({
                code: 200,
                data: {
                    shipped: shippedTotals,
                    refunded: refundTotals,
                    exchanged: exchangeTotals,
                    sales: salesTotals,
                    batches: batchRows
                }
            })
        } catch (error) {
            console.error('ShippingController.getHistorySummary error:', error)
            return res.status(500).json({ code: 500, message: 'Internal server error' })
        }
    }

    /**
     * 导出特定批次的历史发货单
     * GET /shipping/batch/:batchId/export
     */
    static async exportHistoricalManifest(req: Request, res: Response) {
        try {
            const batchId = parseInt(req.params.batchId)
            const batch = await AppDataSource.getRepository(ShipmentBatch).findOneBy({ id: batchId })
            if (!batch) return res.status(404).json({ code: 404, message: '批次不存在' })

            // manifest data is stored directly in itemsSnapshot
            return res.json({ code: 200, data: batch.itemsSnapshot })
        } catch (error) {
            console.error('ShippingController.exportHistoricalManifest error:', error)
            return res.status(500).json({ code: 500, message: 'Internal server error' })
        }
    }
}
