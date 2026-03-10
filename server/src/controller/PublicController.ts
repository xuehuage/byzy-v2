import { Request, Response } from "express"
import { AppDataSource } from "../data-source"
import { School } from "../entity/School"
import { Student } from "../entity/Student"
import { Order, OrderStatus } from "../entity/Order"
import { OrderItem } from "../entity/OrderItem"
import { Product } from "../entity/Product"
import { WebSocketService } from "../websocket"

import { PaymentService } from "../services/PaymentService"
import { OrderTemp } from "../entity/OrderTemp"

export class PublicController {
    static async getSchool(req: Request, res: Response) {
        try {
            const id = parseInt(req.params.id)
            const school = await AppDataSource.getRepository(School).findOne({
                where: { id },
                relations: ["grades", "grades.classes"]
            })
            if (!school) return res.status(404).json({ code: 404, message: "School not found" })
            return res.json({ code: 200, data: school })
        } catch (error) {
            return res.status(500).json({ code: 500, message: "Internal server error" })
        }
    }

    private static formatStudentOrders(student: Student) {
        if (!student.orders) return [];
        return student.orders.map(order => {
            const items = (order.items || []).map(item => {
                let uType = 1;
                if (item.product?.type === 0) uType = 1;      // 夏装
                else if (item.product?.type === 1) uType = 2; // 春秋装
                else if (item.product?.type === 2) uType = 3; // 冬装

                // Calculate processed refund quantity and detailed summaries for this specific product
                const processedAfterSales = (order.afterSales || [])
                    .filter((asr: any) => asr.status === 'PROCESSED' && asr.productId === item.product?.id);

                const refundedQty = processedAfterSales
                    .filter((asr: any) => asr.type === 'REFUND')
                    .reduce((sum: number, asr: any) => sum + Number(asr.newQuantity), 0);

                // Refund Amount: For processed refunds, it's (Quantity * Price)
                const refundedAmount = processedAfterSales
                    .filter(asr => asr.type === 'REFUND')
                    .reduce((sum, asr) => sum + (Number(asr.newQuantity) * Number(item.priceSnapshot || 0)), 0);

                const exchanges = processedAfterSales
                    .filter(asr => asr.type === 'EXCHANGE')
                    .map(asr => ({
                        qty: asr.newQuantity,
                        from: asr.originalSize,
                        to: asr.newSize
                    }));

                return {
                    id: item.id,
                    product_id: item.product?.id,
                    size: item.size || "以实际发放为准",
                    quantity: item.quantity,
                    refunded_quantity: refundedQty,
                    refunded_amount: refundedAmount,
                    exchanges: exchanges,
                    price: (item.priceSnapshot || 0).toString(),
                    uniform_type: uType,
                    product_name: item.product?.name || (uType === 1 ? "夏季校服" : (uType === 2 ? "春秋校服" : "冬季校服")),
                    is_special_size: !!item.isSpecialSize,
                    height: item.height,
                    weight: item.weight
                }
            })

            return {
                order_id: order.id,
                order_no: order.orderNo,
                total_amount: (order.totalAmount || 0).toString(),
                // Robust payment_status mapping
                payment_status: [
                    OrderStatus.PAID,
                    OrderStatus.EXCHANGING,
                    OrderStatus.SHIPPED,
                    OrderStatus.REFUNDING,
                    OrderStatus.PARTIAL_REFUNDED,
                    OrderStatus.REFUNDED
                ].includes(order.status) ? 1 : 0,
                order_status: order.status,
                created_at: order.createdAt,
                updated_at: order.updatedAt,
                items: items,
                pending_after_sales: (order.afterSales || [])
                    .filter(asr => asr.status === 'PENDING')
                    .map(asr => ({
                        id: asr.id,
                        type: asr.type,
                        qty: asr.newQuantity,
                        size: asr.newSize
                    })),
                after_sales_config: {
                    exchange_active: !!student.grade?.school?.afterSalesExchangeActive,
                    refund_active: !!student.grade?.school?.afterSalesRefundActive
                }
            }
        })
    }

    static async getStudentByCard(req: Request, res: Response) {
        try {
            const { idCard } = req.params
            const student = await AppDataSource.getRepository(Student).findOne({
                where: { idCard },
                relations: [
                    "grade",
                    "class",
                    "orders",
                    "orders.items",
                    "orders.items.product",
                    "orders.afterSales"
                ]
            })

            if (!student) return res.status(404).json({ code: 404, message: "未找到该学生信息" })

            const { orders: rawOrders, ...studentInfo } = student as any

            return res.json({
                code: 200,
                data: {
                    student: {
                        ...studentInfo,
                        grade_name: student.grade?.name || "未知年级",
                        class_name: student.class?.name || "未分班",
                    },
                    orders: PublicController.formatStudentOrders(student)
                }
            })
        } catch (error) {
            console.error(error)
            return res.status(500).json({ code: 500, message: "Internal server error" })
        }
    }

    static async getStudentById(req: Request, res: Response) {
        try {
            const { id } = req.params
            const { schoolId } = req.query

            const whereClause: any = { id: Number(id) }
            if (schoolId) whereClause.schoolId = Number(schoolId)

            const student = await AppDataSource.getRepository(Student).findOne({
                where: whereClause,
                relations: [
                    "grade",
                    "grade.school",
                    "class",
                    "orders",
                    "orders.items",
                    "orders.items.product",
                    "orders.afterSales"
                ]
            })

            if (!student) return res.status(404).json({ code: 404, message: "未找到该学生信息" })

            const { orders: rawOrders, ...studentInfo } = student as any

            return res.json({
                code: 200,
                data: {
                    student: {
                        ...studentInfo,
                        grade_name: student.grade?.name || "未知年级",
                        class_name: student.class?.name || "未分班",
                    },
                    orders: PublicController.formatStudentOrders(student)
                }
            })
        } catch (error) {
            console.error(error)
            return res.status(500).json({ code: 500, message: "Internal server error" })
        }
    }

    static async getStudentV2(req: Request, res: Response) {
        try {
            const { name, phone, birthday, schoolId } = req.query
            if (!name || !phone || !birthday || !schoolId) {
                return res.status(400).json({ code: 400, message: "参数不完整" })
            }

            const studentRepository = AppDataSource.getRepository(Student)
            const student = await studentRepository.createQueryBuilder("student")
                .leftJoinAndSelect("student.grade", "grade")
                .leftJoinAndSelect("grade.school", "school")
                .leftJoinAndSelect("student.class", "class")
                .leftJoinAndSelect("student.orders", "order")
                .leftJoinAndSelect("order.items", "item")
                .leftJoinAndSelect("item.product", "product")
                .leftJoinAndSelect("order.afterSales", "afterSales")
                .where("student.name = :name", { name })
                .andWhere("student.phone = :phone", { phone })
                .andWhere("student.birthday = :birthday", { birthday })
                .andWhere("grade.school_id = :schoolId", { schoolId: Number(schoolId) })
                .getOne()

            if (!student) return res.status(404).json({ code: 404, message: "未找到该学生信息" })

            const { orders: rawOrders, ...studentInfo } = student as any

            return res.json({
                code: 200,
                data: {
                    student: {
                        ...studentInfo,
                        grade_name: student.grade?.name || "未知年级",
                        class_name: student.class?.name || "未分班",
                    },
                    orders: PublicController.formatStudentOrders(student)
                }
            })
        } catch (error) {
            console.error(error)
            return res.status(500).json({ code: 500, message: "Internal server error" })
        }
    }

    static async getStudentsByPhone(req: Request, res: Response) {
        try {
            const { phone, schoolId } = req.query
            if (!phone) {
                return res.status(400).json({ code: 400, message: "请提供手机号" })
            }

            const studentRepository = AppDataSource.getRepository(Student)
            const query = studentRepository.createQueryBuilder("student")
                .leftJoinAndSelect("student.grade", "grade")
                .leftJoinAndSelect("grade.school", "school")
                .leftJoinAndSelect("student.class", "class")
                .leftJoinAndSelect("student.orders", "order")
                .leftJoinAndSelect("order.items", "item")
                .leftJoinAndSelect("item.product", "product")
                .leftJoinAndSelect("order.afterSales", "afterSales")
                .where("student.phone = :phone", { phone: phone as string })

            if (schoolId) {
                query.andWhere("grade.school_id = :schoolId", { schoolId: Number(schoolId) })
            }

            const students = await query.getMany()

            if (!students || students.length === 0) {
                return res.status(404).json({ code: 404, message: "未找到该手机号对应的购买信息" })
            }

            const result = students.map(student => {
                const { orders: rawOrders, ...studentInfo } = student as any
                return {
                    student: {
                        ...studentInfo,
                        grade_name: student.grade?.name || "未知年级",
                        class_name: student.class?.name || "未分班",
                    },
                    orders: PublicController.formatStudentOrders(student)
                }
            })

            return res.json({ code: 200, data: result })
        } catch (error) {
            return res.status(500).json({ code: 500, message: "Internal server error" })
        }
    }

    static async getTempOrder(req: Request, res: Response) {
        try {
            const { id } = req.params
            const orderTemp = await AppDataSource.getRepository(OrderTemp).findOneBy({ id: Number(id) })
            if (!orderTemp) return res.status(404).json({ code: 404, message: "订单不存在或已失效" })

            const items = JSON.parse(orderTemp.items)

            return res.json({
                code: 200,
                data: {
                    student: {
                        name: orderTemp.studentName,
                        phone: orderTemp.studentPhone,
                        birthday: orderTemp.studentBirthday,
                        gradeId: orderTemp.gradeId
                    },
                    orders: items.map((item: any) => ({
                        ...item,
                        // Match old frontend expectations for display
                        payment_status: 0,
                        total_amount: (item.priceSnapshot * item.quantity).toString(),
                        price: item.priceSnapshot.toString()
                    })),
                    total_amount: orderTemp.totalAmount / 100
                }
            })
        } catch (error) {
            console.error(error)
            return res.status(500).json({ code: 500, message: "Internal server error" })
        }
    }

    static async createOrderV2(req: Request, res: Response) {
        try {
            const { schoolId, gradeId, classId, name, phone, birthday, items } = req.body
            if (!schoolId || !name || !phone || !birthday || !items || !items.length) {
                return res.status(400).json({ code: 400, message: "参数不完整" })
            }

            const schoolRepo = AppDataSource.getRepository(School)
            const productRepo = AppDataSource.getRepository(Product)
            const orderTempRepo = AppDataSource.getRepository(OrderTemp)

            const school = await schoolRepo.findOneBy({ id: Number(schoolId) })
            if (!school) return res.status(404).json({ code: 404, message: "School not found" })

            let totalAmount = 0
            const preparedItems: any[] = []

            for (const itemData of items) {
                let pType = 0
                if (itemData.uniformType === 1) pType = 0
                else if (itemData.uniformType === 2) pType = 1
                else if (itemData.uniformType === 3) pType = 2

                let product = await productRepo.findOneBy({ schoolId: Number(schoolId), type: pType })
                const currentPrice = pType === 0 ? school.summerPrice : (pType === 1 ? school.autumnPrice : school.winterPrice)

                if (!product) {
                    product = new Product()
                    product.schoolId = Number(schoolId)
                    product.type = pType
                    product.name = pType === 0 ? "夏季校服" : (pType === 1 ? "春秋校服" : "冬季校服")
                    product.price = currentPrice
                    await productRepo.save(product)
                } else if (product.price !== currentPrice) {
                    // 同步更新产品表中的价格
                    product.price = currentPrice
                    await productRepo.save(product)
                }

                const pi = {
                    productId: product.id,
                    quantity: itemData.quantity,
                    priceSnapshot: product.price,
                    size: itemData.size,
                    isSpecialSize: !!itemData.isSpecialSize,
                    height: itemData.height,
                    weight: itemData.weight,
                    uniform_type: itemData.uniformType
                }
                totalAmount += pi.priceSnapshot * pi.quantity
                preparedItems.push(pi)
            }

            const clientSn = `TEMP${Date.now()}${Math.floor(Math.random() * 1000)}`
            const orderTemp = orderTempRepo.create({
                clientSn,
                schoolId: Number(schoolId),
                gradeId: Number(gradeId),
                classId: classId ? Number(classId) : null,
                studentName: name,
                studentPhone: phone,
                studentBirthday: birthday,
                items: JSON.stringify(preparedItems),
                totalAmount
            })
            await orderTempRepo.save(orderTemp)

            return res.json({
                code: 200,
                data: {
                    orderId: orderTemp.id, // Frontend uses this to navigate to payment page
                    totalAmount: totalAmount / 100
                }
            })
        } catch (error: any) {
            console.error("Create order temp error:", error)
            return res.status(500).json({ code: 500, message: error.message || "Internal server error" })
        }
    }

    static async prepay(req: Request, res: Response) {
        try {
            const { id_card, pay_way, student_id, temp_order_id } = req.body
            const orderTempRepo = AppDataSource.getRepository(OrderTemp)

            let orderTemp;
            if (temp_order_id || student_id) {
                const searchId = temp_order_id || student_id; // Frontend might pass old student_id for orderId
                orderTemp = await orderTempRepo.findOneBy({ id: Number(searchId) })
            }

            // Fallback for V1 legacy compatibility (ID card)
            if (!orderTemp && id_card) {
                return res.status(400).json({ code: 400, message: "V2暂不支持通过身份证号直接预支付，请从首页重新订购" })
            }

            if (!orderTemp) return res.status(404).json({ code: 404, message: "订单不存在或已失效" })

            const items = JSON.parse(orderTemp.items)
            const subject = items.map((i: any) => `${i.uniform_type === 1 ? '夏' : (i.uniform_type === 2 ? '春秋' : '冬')}校服${i.quantity}套`).join(',').substring(0, 100)

            const payResult = await PaymentService.createPrepayment({
                clientSn: orderTemp.clientSn,
                totalAmount: orderTemp.totalAmount,
                subject,
                payway: pay_way?.toString() || "3"
            })

            if (payResult.result_code !== '200' || payResult.biz_response?.result_code !== 'PRECREATE_SUCCESS') {
                throw new Error(`支付平台预下单失败: ${payResult.biz_response?.error_message || '未知错误'}`)
            }

            const bizData = payResult.biz_response.data
            orderTemp.qrCode = bizData.qr_code
            await orderTempRepo.save(orderTemp)

            return res.json({
                code: 200,
                data: {
                    total_amount: orderTemp.totalAmount / 100,
                    subject,
                    sn: bizData.sn,
                    client_sn: orderTemp.clientSn,
                    qr_code: bizData.qr_code,
                    qr_code_image_url: bizData.qr_code_image_url || ""
                }
            })
        } catch (error: any) {
            console.error("Prepay error:", error)
            return res.status(500).json({ code: 500, message: error.message || "Internal server error" })
        }
    }

    static async getPaymentStatus(req: Request, res: Response) {
        try {
            const { clientSn } = req.params
            const orderRepo = AppDataSource.getRepository(Order)
            const orderTempRepo = AppDataSource.getRepository(OrderTemp)

            // 1. Check if already persisted
            const order = await orderRepo.findOneBy({ clientSn })
            if (order) {
                return res.json({ code: 200, data: { biz_response: { data: { order_status: "PAID" } } } })
            }

            // 2. Check temp order
            const orderTemp = await orderTempRepo.findOneBy({ clientSn })
            if (!orderTemp) return res.status(404).json({ code: 404, message: "订单不存在" })

            // 3. Remote check
            const payStatus = await PaymentService.searchPaymentStatus(clientSn)
            const remoteStatus = payStatus.biz_response?.data?.order_status

            if (remoteStatus === 'PAID') {
                await PublicController.finalizeOrder(orderTemp, payStatus.biz_response.data.trade_no)
                return res.json({ code: 200, data: { biz_response: { data: { order_status: "PAID" } } } })
            }

            return res.json({ code: 200, data: { biz_response: { data: { order_status: "CREATED" } } } })
        } catch (error) {
            console.error("Get status error:", error)
            return res.status(500).json({ code: 500, message: "Internal server error" })
        }
    }

    private static async finalizeOrder(orderTemp: OrderTemp, transactionId?: string) {
        await AppDataSource.manager.transaction(async (manager) => {
            // Find or create student
            let student = await manager.findOneBy(Student, {
                name: orderTemp.studentName,
                phone: orderTemp.studentPhone,
                birthday: orderTemp.studentBirthday,
                gradeId: orderTemp.gradeId ?? undefined,
                classId: orderTemp.classId ?? undefined
            })

            if (!student) {
                student = manager.create(Student, {
                    name: orderTemp.studentName,
                    phone: orderTemp.studentPhone,
                    birthday: orderTemp.studentBirthday,
                    gradeId: orderTemp.gradeId,
                    classId: orderTemp.classId
                })
                await manager.save(student)
            }

            // Create Order
            const order = manager.create(Order, {
                studentId: student.id,
                orderNo: orderTemp.clientSn.replace('TEMP', 'ORD'),
                totalAmount: orderTemp.totalAmount,
                status: OrderStatus.PAID,
                clientSn: orderTemp.clientSn,
                transactionId,
                paidAt: new Date()
            })

            const tempItems = JSON.parse(orderTemp.items)
            order.items = tempItems.map((ti: any) => manager.create(OrderItem, {
                productId: ti.productId,
                quantity: ti.quantity,
                priceSnapshot: ti.priceSnapshot,
                size: ti.size,
                isSpecialSize: ti.isSpecialSize,
                height: ti.height,
                weight: ti.weight
            }))

            await manager.save(order)
            await manager.remove(orderTemp)

            WebSocketService.notifyPaymentSuccess(orderTemp.clientSn)
        })
    }

    static async paymentCallback(req: Request, res: Response) {
        try {
            const sign = req.headers.authorization?.trim()
            const rawBody = (req as any).rawBody?.toString('utf8')
            if (!sign || !rawBody) return res.status(400).send('Missing sign or body')

            if (!PaymentService.verifyCallbackSignature(rawBody, sign)) {
                return res.status(401).send('Invalid signature')
            }

            const data = req.body
            if (data.order_status === 'PAID') {
                const orderTemp = await AppDataSource.getRepository(OrderTemp).findOneBy({ clientSn: data.client_sn })
                if (orderTemp) {
                    await PublicController.finalizeOrder(orderTemp, data.trade_no)
                }
            }
            return res.send("success")
        } catch (error) {
            console.error("Callback error:", error)
            return res.status(500).send("Error")
        }
    }

    static async mockCallback(req: Request, res: Response) {
        try {
            const { client_sn } = req.body
            const orderTemp = await AppDataSource.getRepository(OrderTemp).findOneBy({ clientSn: client_sn })
            if (orderTemp) {
                await PublicController.finalizeOrder(orderTemp, "MOCK_FIXED_ID")
                return res.json({ code: 200, message: "Success" })
            }
            return res.status(404).json({ message: "Temp order not found" })
        } catch (error) {
            console.error("Mock callback error:", error)
            return res.status(500).json({ code: 500, message: "Error" })
        }
    }
}
