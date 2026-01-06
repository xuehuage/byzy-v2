import { Request, Response } from "express"
import { AppDataSource } from "../data-source"
import { School } from "../entity/School"
import { Student } from "../entity/Student"
import { Order, OrderStatus } from "../entity/Order"
import { WebSocketService } from "../websocket"

import { PaymentService } from "../services/PaymentService"

export class PublicController {
    static async getSchool(req: Request, res: Response) {
        try {
            const id = parseInt(req.params.id)
            const school = await AppDataSource.getRepository(School).findOneBy({ id })
            if (!school) return res.status(404).json({ code: 404, message: "School not found" })
            return res.json({ code: 200, data: school })
        } catch (error) {
            return res.status(500).json({ code: 500, message: "Internal server error" })
        }
    }

    static async getStudentByCard(req: Request, res: Response) {
        try {
            const { idCard } = req.params
            const student = await AppDataSource.getRepository(Student).findOne({
                where: { idCard },
                relations: ["class", "orders", "orders.items", "orders.items.product"]
            })

            if (!student) return res.status(404).json({ code: 404, message: "未找到该学生信息" })

            const items: any[] = []
            student.orders.forEach(order => {
                order.items.forEach(item => {
                    let uType = 1;
                    if (item.product.type === 0) uType = 1;      // 夏装
                    else if (item.product.type === 1) uType = 2; // 春秋装
                    else if (item.product.type === 2) uType = 3; // 冬装

                    items.push({
                        id: item.id,
                        student_id: student.id,
                        size: "以实际发放为准",
                        quantity: item.quantity,
                        total_amount: (Number(item.priceSnapshot) * item.quantity).toString(),
                        order_type: 1,
                        payment_status: order.status === OrderStatus.PAID ? 1 : 0,
                        uniform_type: uType,
                        price: item.priceSnapshot.toString(),
                        created_at: order.createdAt,
                        updated_at: order.updatedAt
                    })
                })
            })

            // Omit raw orders from student object to avoid cent/Yuan confusion in client
            const { orders: rawOrders, ...studentInfo } = student as any

            return res.json({
                code: 200,
                data: {
                    student: {
                        ...studentInfo,
                        class_name: student.class.name,
                    },
                    orders: items
                }
            })
        } catch (error) {
            console.error(error)
            return res.status(500).json({ code: 500, message: "Internal server error" })
        }
    }

    static async prepay(req: Request, res: Response) {
        try {
            const { id_card, pay_way } = req.body
            const student = await AppDataSource.getRepository(Student).findOne({
                where: { idCard: id_card },
                relations: ["orders", "orders.items", "orders.items.product"]
            })

            if (!student) return res.status(404).json({ code: 404, message: "学生不存在" })

            const pendingOrders = student.orders.filter(o => o.status === OrderStatus.PENDING)
            if (pendingOrders.length === 0) return res.status(400).json({ code: 400, message: "没有待付款订单" })

            const totalAmountCents = pendingOrders.reduce((sum, o) => sum + Number(o.totalAmount), 0)
            const clientSn = `SID${student.id}-${Date.now()}-${Math.floor(Math.random() * 1000)}`

            // Build subject
            const subjects: string[] = []
            pendingOrders.forEach(o => {
                o.items.forEach(item => {
                    subjects.push(`${item.product.name}${item.quantity}套`)
                })
            })
            const subject = `${subjects.join(',')}`.substring(0, 100)

            // Call Payment Service
            const payResult = await PaymentService.createPrepayment({
                clientSn,
                totalAmount: totalAmountCents,
                subject,
                payway: pay_way?.toString() || "3" // Default to WeChat if not provided
            })

            console.log("Shouqianba Pay Result:", JSON.stringify(payResult, null, 2))

            if (payResult.result_code !== '200' || payResult.biz_response?.result_code !== 'PRECREATE_SUCCESS') {
                throw new Error(`第三方预下单失败: ${payResult.biz_response?.error_message || payResult.error_message || '未知错误'}`)
            }

            const bizData = payResult.biz_response.data

            // Save clientSn and qrCode to orders
            pendingOrders.forEach(o => {
                o.clientSn = clientSn
                o.qrCode = bizData.qr_code
            })
            await AppDataSource.getRepository(Order).save(pendingOrders)

            return res.json({
                code: 200,
                data: {
                    total_amount: totalAmountCents / 100, // Matching original system: numeric Yuan
                    subject: subject,
                    sn: bizData.sn,
                    client_sn: bizData.client_sn || clientSn,
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
            const orders = await orderRepo.find({ where: { clientSn } })

            if (orders.length === 0) return res.status(404).json({ code: 404, message: "订单不存在" })

            // If locally not paid, check with payment provider
            if (orders[0].status !== OrderStatus.PAID) {
                const payStatus = await PaymentService.searchPaymentStatus(clientSn)
                const remoteStatus = payStatus.biz_response?.data?.order_status

                if (remoteStatus === 'PAID') {
                    for (const o of orders) {
                        o.status = OrderStatus.PAID
                        o.paidAt = new Date()
                    }
                    await orderRepo.save(orders)
                    WebSocketService.notifyPaymentSuccess(clientSn)
                    return res.json({ code: 200, data: { biz_response: { data: { order_status: "PAID" } } } })
                }
            }

            return res.json({
                code: 200,
                data: {
                    biz_response: {
                        data: {
                            order_status: orders[0].status === OrderStatus.PAID ? "PAID" : "CREATED"
                        }
                    }
                }
            })
        } catch (error) {
            console.error("Get status error:", error)
            return res.status(500).json({ code: 500, message: "Internal server error" })
        }
    }

    static async paymentCallback(req: Request, res: Response) {
        console.log("📥 Received Payment Callback");
        try {
            // 1. 获取回调请求头中的签名
            const sign = req.headers.authorization?.trim();
            if (!sign) {
                console.error("❌ Missing Authorization header in callback");
                return res.status(400).send('Missing Authorization');
            }

            // 2. 获取原始请求体用于验签
            const rawBody = (req as any).rawBody;
            if (!rawBody) {
                console.error("❌ Missing raw body in callback");
                return res.status(400).send('Missing raw body');
            }
            const rawBodyString = rawBody.toString('utf8');

            // 3. RSA SHA256 验签
            const isValid = PaymentService.verifyCallbackSignature(rawBodyString, sign);
            if (!isValid) {
                console.error("❌ Invalid signature on payment callback!");
                console.log("Raw Body:", rawBodyString);
                console.log("Sign:", sign);
                // 根据文档，验签失败也建议记录日志，但此处我们先严格处理
                return res.status(401).send('Invalid signature');
            }

            // 4. 解析业务数据
            const callbackData = req.body;
            console.log("📦 Callback Data:", JSON.stringify(callbackData));

            const {
                client_sn,
                order_status,
                finish_time,
                trade_no,
                total_amount
            } = callbackData;

            if (!client_sn) {
                console.error("❌ Missing client_sn in callback data");
                return res.status(400).send('Missing client_sn');
            }

            // 5. 处理支付成功逻辑
            if (order_status === 'PAID') {
                const orderRepo = AppDataSource.getRepository(Order);
                const orders = await orderRepo.find({ where: { clientSn: client_sn } });

                if (orders.length > 0) {
                    if (orders[0].status !== OrderStatus.PAID) {
                        console.log(`✅ Updating orders for client_sn: ${client_sn} to PAID`);
                        for (const o of orders) {
                            o.status = OrderStatus.PAID;
                            o.paidAt = finish_time ? new Date(parseInt(finish_time)) : new Date();
                            o.transactionId = trade_no;
                        }
                        await orderRepo.save(orders);

                        // 通过WebSocket通知前端
                        const notified = WebSocketService.notifyPaymentSuccess(client_sn, callbackData);
                        if (!notified) {
                            console.warn(`⚠️ Client ${client_sn} not connected to WebSocket`);
                        }
                    } else {
                        console.log(`ℹ️ Order ${client_sn} already marked as PAID`);
                    }
                } else {
                    console.error(`❌ No orders found for client_sn: ${client_sn}`);
                }
            } else {
                console.log(`ℹ️ Order status is ${order_status} for client_sn: ${client_sn}`);
            }

            // 6. 返回成功响应给收钱吧 (文档要求返回字符串 "success")
            return res.send("success");
        } catch (error) {
            console.error("💥 Callback processing error:", error);
            return res.status(500).send("Internal Error");
        }
    }

    static async mockCallback(req: Request, res: Response) {
        try {
            const { client_sn } = req.body
            const orders = await AppDataSource.getRepository(Order).find({ where: { clientSn: client_sn } })

            if (orders.length === 0) return res.status(404).json({ message: "No orders found" })

            for (const order of orders) {
                if (order.status !== OrderStatus.PAID) {
                    order.status = OrderStatus.PAID
                    order.paidAt = new Date()
                }
            }
            await AppDataSource.getRepository(Order).save(orders)

            WebSocketService.notifyPaymentSuccess(client_sn)

            return res.json({ code: 200, message: "Success" })
        } catch (error) {
            console.error("Mock callback error:", error)
            return res.status(500).json({ code: 500, message: "Error" })
        }
    }
}
