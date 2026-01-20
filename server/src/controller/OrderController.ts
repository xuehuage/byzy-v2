import { Request, Response } from "express"
import { AppDataSource } from "../data-source"
import { Order, OrderStatus } from "../entity/Order"
import { Student } from "../entity/Student"
import { Product } from "../entity/Product"
import { OrderItem } from "../entity/OrderItem"
import { Brackets } from "typeorm"

export class OrderController {
    static async search(req: Request, res: Response) {
        try {
            const { page = 1, pageSize = 10, schoolId, classId, status, uniformType, keyword, studentName, idCard } = req.query
            const skip = (Number(page) - 1) * Number(pageSize)
            const take = Number(pageSize)

            const queryBuilder = AppDataSource.getRepository(Order).createQueryBuilder("order")
                .leftJoinAndSelect("order.student", "student")
                .leftJoinAndSelect("student.class", "class")
                .leftJoinAndSelect("class.school", "school")
                .leftJoinAndSelect("order.items", "items")
                .leftJoinAndSelect("items.product", "product")
                .orderBy("order.createdAt", "DESC")
                .skip(skip)
                .take(take)

            if (schoolId && schoolId !== 'all') {
                queryBuilder.andWhere("school.id = :schoolId", { schoolId })
            }

            if (classId && classId !== 'all') {
                queryBuilder.andWhere("class.id = :classId", { classId })
            }

            if (status && status !== 'all') {
                queryBuilder.andWhere("order.status = :status", { status })
            }

            if (studentName) {
                queryBuilder.andWhere("student.name LIKE :studentName", { studentName: `%${studentName}%` })
            }

            if (idCard) {
                queryBuilder.andWhere("student.idCard LIKE :idCard", { idCard: `%${idCard}%` })
            }

            if (uniformType && uniformType !== 'all') {
                // Map frontend type strings to backend product type integers
                const typeMap: Record<string, number> = {
                    'summer': 0,
                    'spring_autumn': 1,
                    'winter': 2
                }
                const pType = typeMap[uniformType as string]
                if (pType !== undefined) {
                    queryBuilder.andWhere(qb => {
                        const subQuery = qb.subQuery()
                            .select("oi.order_id")
                            .from("order_items", "oi")
                            .innerJoin("products", "p", "oi.product_id = p.id")
                            .where("p.type = :pType", { pType })
                        return "order.id IN (" + subQuery.getQuery() + ")"
                    })
                }
            }

            if (keyword) {
                queryBuilder.andWhere(new Brackets(qb => {
                    qb.where("student.name LIKE :keyword", { keyword: `%${keyword}%` })
                        .orWhere("student.idCard LIKE :keyword", { keyword: `%${keyword}%` })
                        .orWhere("order.orderNo LIKE :keyword", { keyword: `%${keyword}%` })
                }))
            }

            const [list, total] = await queryBuilder.getManyAndCount()

            // Pre-calculate quantities for simpler frontend rendering
            const formattedList = list.map(order => {
                const summerQty = order.items.filter(i => i.product.type === 0).reduce((sum, i) => sum + i.quantity, 0)
                const springQty = order.items.filter(i => i.product.type === 1).reduce((sum, i) => sum + i.quantity, 0)
                const winterQty = order.items.filter(i => i.product.type === 2).reduce((sum, i) => sum + i.quantity, 0)

                return {
                    ...order,
                    totalAmount: order.totalAmount,
                    summerQty,
                    springQty,
                    winterQty
                }
            })

            res.json({
                code: 200,
                data: {
                    list: formattedList,
                    total,
                    page: Number(page),
                    pageSize: Number(pageSize)
                }
            })
        } catch (error: any) {
            console.error("Search orders error:", error)
            res.status(500).json({ code: 500, message: "Internal server error" })
        }
    }

    static async createSupplementary(req: Request, res: Response) {
        try {
            const { idCard, summerQty, springQty, winterQty } = req.body

            if (!idCard) throw new Error("ID Card is required")

            const result = await AppDataSource.manager.transaction(async (transactionalEntityManager) => {
                // 1. Find Student and their orders
                const student = await transactionalEntityManager.findOne(Student, {
                    where: { idCard },
                    relations: ["class", "class.school", "orders"]
                })

                if (!student) throw new Error("学生不存在，请检查身份证号")

                // 🔥 Check for PAID orders
                const hasPaidOrder = student.orders.some(o => o.status === OrderStatus.PAID)
                if (!hasPaidOrder) {
                    throw new Error("该学生暂无已支付订单，请直接使用“修改”功能调整其现有待支付订单的数量。")
                }

                // 2. Fetch School Products
                const schoolId = student.class.schoolId
                const products = await transactionalEntityManager.find(Product, { where: { schoolId } })
                const productMap = new Map<number, Product>()
                products.forEach(p => productMap.set(p.type, p))

                // 3. Prepare Items
                const itemsToCreate = [
                    { type: 0, qty: Number(summerQty || 0) },
                    { type: 1, qty: Number(springQty || 0) },
                    { type: 2, qty: Number(winterQty || 0) }
                ].filter(i => i.qty > 0)

                if (itemsToCreate.length === 0) throw new Error("No quantities provided")

                // 4. Create Order
                const order = new Order()
                order.studentId = student.id
                order.orderNo = `SID${student.id}-${Date.now()}-MANUAL`
                order.status = OrderStatus.PENDING
                order.totalAmount = 0

                let totalAmount = 0
                const orderItems: OrderItem[] = []
                for (const item of itemsToCreate) {
                    const product = productMap.get(item.type)
                    if (product) {
                        const orderItem = new OrderItem()
                        orderItem.order = order
                        orderItem.product = product
                        orderItem.quantity = item.qty
                        orderItem.priceSnapshot = product.price
                        totalAmount += orderItem.quantity * orderItem.priceSnapshot
                        orderItems.push(orderItem)
                    }
                }

                order.items = orderItems
                order.totalAmount = totalAmount
                const savedOrder = await transactionalEntityManager.save(order)
                return { id: savedOrder.id, orderNo: savedOrder.orderNo }
            })

            return res.json({ code: 200, message: "Order created successfully", data: result })
        } catch (error: any) {
            console.error("Create supplementary order error:", error)
            return res.status(500).json({ code: 500, message: error.message || "Internal server error" })
        }
    }

    static async update(req: Request, res: Response) {
        try {
            const id = parseInt(req.params.id)
            const { name, idCard, summerQty, springQty, winterQty } = req.body

            await AppDataSource.manager.transaction(async (transactionalEntityManager) => {
                // 1. Fetch Order with Relations
                const order = await transactionalEntityManager.findOne(Order, {
                    where: { id },
                    relations: ["student", "student.class", "items", "items.product"]
                })

                if (!order) throw new Error("Order not found")

                // Update Student Info (Common for both PAID and PENDING)
                let studentUpdated = false
                if (name && order.student.name !== name) {
                    order.student.name = name
                    studentUpdated = true
                }
                if (idCard && order.student.idCard !== idCard) {
                    order.student.idCard = idCard
                    studentUpdated = true
                }
                if (studentUpdated) {
                    await transactionalEntityManager.save(order.student)
                }

                if (order.status === OrderStatus.PAID) {
                    // --- CASE: Supplementary Order for PAID Order ---

                    const schoolId = order.student.class.schoolId
                    const schoolProducts = await transactionalEntityManager.find(Product, { where: { schoolId } })
                    const productMap = new Map<number, Product>()
                    schoolProducts.forEach(p => productMap.set(p.type, p))

                    // 1. Fetch all existing orders for this student to calculate "Current Total"
                    const allOrders = await transactionalEntityManager.find(Order, {
                        where: { studentId: order.studentId },
                        relations: ["items", "items.product"]
                    })

                    const currentTotals = { 0: 0, 1: 0, 2: 0 }
                    allOrders.forEach(o => {
                        o.items.forEach(item => {
                            if (item.product.type >= 0 && item.product.type <= 2) {
                                currentTotals[item.product.type as 0 | 1 | 2] += item.quantity
                            }
                        })
                    })

                    // 2. Calculate Diffs
                    const diffs = [
                        { type: 0, qty: Math.max(0, Number(summerQty) - currentTotals[0]) },
                        { type: 1, qty: Math.max(0, Number(springQty) - currentTotals[1]) },
                        { type: 2, qty: Math.max(0, Number(winterQty) - currentTotals[2]) }
                    ]

                    const itemsToCreate = diffs.filter(d => d.qty > 0)
                    if (itemsToCreate.length === 0) return

                    // 3. Fetch products for price snapshot
                    // const schoolId = order.student.class.schoolId // Moved up
                    // const schoolProducts = await transactionalEntityManager.find(Product, { where: { schoolId } }) // Moved up
                    // const productMap = new Map<number, Product>() // Moved up
                    // schoolProducts.forEach(p => productMap.set(p.type, p)) // Moved up

                    // 4. Create New Supplementary Order
                    const newOrder = new Order()
                    newOrder.studentId = order.studentId
                    newOrder.orderNo = `SID${order.studentId}-${Date.now()}-ADD`
                    newOrder.status = OrderStatus.PENDING
                    newOrder.totalAmount = 0 // Will calculate

                    // const savedOrder = await transactionalEntityManager.save(newOrder) // Removed

                    let totalAmount = 0
                    const orderItems: OrderItem[] = []
                    for (const diff of itemsToCreate) {
                        const product = productMap.get(diff.type)
                        if (product) {
                            const newItem = new OrderItem()
                            newItem.order = newOrder // Link for cascade
                            newItem.product = product
                            newItem.quantity = diff.qty
                            newItem.priceSnapshot = product.price
                            totalAmount += newItem.quantity * newItem.priceSnapshot
                            orderItems.push(newItem)
                        }
                    }

                    newOrder.items = orderItems
                    newOrder.totalAmount = totalAmount
                    await transactionalEntityManager.save(newOrder)

                } else if (order.status === OrderStatus.PENDING) {
                    // --- CASE: Standard Editing for PENDING Order ---

                    const schoolId = order.student.class.schoolId
                    const schoolProducts = await transactionalEntityManager.find(Product, { where: { schoolId } })
                    const productMap = new Map<number, Product>()
                    schoolProducts.forEach(p => productMap.set(p.type, p))

                    const updates = [
                        { type: 0, qty: Number(summerQty) },
                        { type: 1, qty: Number(springQty) },
                        { type: 2, qty: Number(winterQty) }
                    ]

                    let itemsChanged = false
                    const activeItems: OrderItem[] = [...order.items]

                    for (const update of updates) {
                        const existingItemIndex = activeItems.findIndex(item => item.product.type === update.type)
                        const existingItem = existingItemIndex > -1 ? activeItems[existingItemIndex] : undefined

                        if (existingItem) {
                            if (update.qty === 0) {
                                await transactionalEntityManager.remove(existingItem)
                                activeItems.splice(existingItemIndex, 1)
                                itemsChanged = true
                            } else if (existingItem.quantity !== update.qty) {
                                existingItem.quantity = update.qty
                                itemsChanged = true
                            }
                        } else if (update.qty > 0) {
                            const product = productMap.get(update.type)
                            if (product) {
                                const newItem = new OrderItem()
                                newItem.order = order
                                newItem.product = product
                                newItem.quantity = update.qty
                                newItem.priceSnapshot = product.price
                                activeItems.push(newItem)
                                itemsChanged = true
                            }
                        }
                    }

                    if (itemsChanged) {
                        let newTotal = 0
                        for (const item of activeItems) {
                            newTotal += item.quantity * item.priceSnapshot
                        }
                        order.items = activeItems // Sync collection to avoid re-insert of removed items
                        order.totalAmount = newTotal

                        // 🔥 Important: If items changed, existing payment session is definitely stale
                        order.clientSn = ""
                        order.qrCode = ""

                        await transactionalEntityManager.save(order)
                    }
                }
            })

            return res.json({ code: 200, message: "Update success" })
        } catch (error: any) {
            console.error("Update order error:", error)
            return res.status(500).json({ code: 500, message: error.message || "Internal server error" })
        }
    }

    static async delete(req: Request, res: Response) {
        try {
            const id = parseInt(req.params.id)
            await AppDataSource.manager.transaction(async (transactionalEntityManager) => {
                const order = await transactionalEntityManager.findOne(Order, {
                    where: { id },
                    relations: ["items"]
                })

                if (!order) throw new Error("订单不存在")
                if (order.status === OrderStatus.PAID) throw new Error("已支付订单不可删除")

                // Remove items first (due to constraint, aunque cascade should handle it depends on config)
                // In our current setup, we manually manage or use cascade. 
                // Since we added cascade: true to items, it should work, but being safe:
                await transactionalEntityManager.remove(order.items)
                await transactionalEntityManager.remove(order)
            })

            return res.json({ code: 200, message: "删除成功" })
        } catch (error: any) {
            console.error("Delete order error:", error)
            return res.status(500).json({ code: 500, message: error.message || "Internal server error" })
        }
    }
}
