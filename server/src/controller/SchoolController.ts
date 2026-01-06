import { Request, Response } from "express"
import { AppDataSource } from "../data-source"
import { School } from "../entity/School"
import { Order, OrderStatus } from "../entity/Order"
import { OrderItem } from "../entity/OrderItem"

export class SchoolController {
    static async getAll(req: Request, res: Response) {
        try {
            const schoolRepository = AppDataSource.getRepository(School)
            const schools = await schoolRepository.find({
                relations: ["classes"],
                order: {
                    createdAt: "DESC"
                }
            })
            res.json({ code: 200, data: schools })
        } catch (error) {
            console.error("Get schools error:", error)
            res.status(500).json({ code: 500, message: "Internal server error" })
        }
    }

    static async getStats(req: Request, res: Response) {
        try {
            const schoolRepository = AppDataSource.getRepository(School)

            // Use raw query or QueryBuilder with subqueries for these complex aggregations
            const schools = await schoolRepository.createQueryBuilder("school")
                .select([
                    "school.id as id",
                    "school.name as name",
                    "school.status as status",
                    "school.createdAt as createdAt"
                ])
                // 1. Total student count
                .addSelect(qb => {
                    return qb.select("COUNT(st.id)", "studentCount")
                        .from("students", "st")
                        .innerJoin("classes", "c", "st.class_id = c.id")
                        .where("c.school_id = school.id")
                }, "studentCount")
                // 2. Uniform quantities (Summer: type 0)
                .addSelect(qb => {
                    return qb.select("IFNULL(SUM(oi.quantity), 0)", "summerQty")
                        .from("order_items", "oi")
                        .innerJoin("products", "p", "oi.product_id = p.id")
                        .innerJoin("orders", "o", "oi.order_id = o.id")
                        .innerJoin("students", "st", "o.student_id = st.id")
                        .innerJoin("classes", "c", "st.class_id = c.id")
                        .where("c.school_id = school.id")
                        .andWhere("p.type = 0")
                        .andWhere("o.status != :cancelled", { cancelled: OrderStatus.CANCELLED })
                }, "summerQty")
                // 3. Uniform quantities (Spring/Autumn: type 1)
                .addSelect(qb => {
                    return qb.select("IFNULL(SUM(oi.quantity), 0)", "springQty")
                        .from("order_items", "oi")
                        .innerJoin("products", "p", "oi.product_id = p.id")
                        .innerJoin("orders", "o", "oi.order_id = o.id")
                        .innerJoin("students", "st", "o.student_id = st.id")
                        .innerJoin("classes", "c", "st.class_id = c.id")
                        .where("c.school_id = school.id")
                        .andWhere("p.type = 1")
                        .andWhere("o.status != :cancelled", { cancelled: OrderStatus.CANCELLED })
                }, "springQty")
                // 4. Uniform quantities (Winter: type 2)
                .addSelect(qb => {
                    return qb.select("IFNULL(SUM(oi.quantity), 0)", "winterQty")
                        .from("order_items", "oi")
                        .innerJoin("products", "p", "oi.product_id = p.id")
                        .innerJoin("orders", "o", "oi.order_id = o.id")
                        .innerJoin("students", "st", "o.student_id = st.id")
                        .innerJoin("classes", "c", "st.class_id = c.id")
                        .where("c.school_id = school.id")
                        .andWhere("p.type = 2")
                        .andWhere("o.status != :cancelled", { cancelled: OrderStatus.CANCELLED })
                }, "winterQty")
                // 5. Revenue: Total
                .addSelect(qb => {
                    return qb.select("IFNULL(SUM(o.total_amount), 0)", "totalRevenue")
                        .from("orders", "o")
                        .innerJoin("students", "st", "o.student_id = st.id")
                        .innerJoin("classes", "c", "st.class_id = c.id")
                        .where("c.school_id = school.id")
                        .andWhere("o.status != :cancelled", { cancelled: OrderStatus.CANCELLED })
                }, "totalRevenue")
                // 6. Revenue: Paid
                .addSelect(qb => {
                    return qb.select("IFNULL(SUM(o.total_amount), 0)", "paidAmount")
                        .from("orders", "o")
                        .innerJoin("students", "st", "o.student_id = st.id")
                        .innerJoin("classes", "c", "st.class_id = c.id")
                        .where("c.school_id = school.id")
                        .andWhere("o.status = :paid", { paid: OrderStatus.PAID })
                }, "paidAmount")
                // 7. Revenue: Unpaid (Pending)
                .addSelect(qb => {
                    return qb.select("IFNULL(SUM(o.total_amount), 0)", "unpaidAmount")
                        .from("orders", "o")
                        .innerJoin("students", "st", "o.student_id = st.id")
                        .innerJoin("classes", "c", "st.class_id = c.id")
                        .where("c.school_id = school.id")
                        .andWhere("o.status = :pending", { pending: OrderStatus.PENDING })
                }, "unpaidAmount")
                .orderBy("school.createdAt", "DESC")
                .getRawMany()

            // Transformation for numeric fields if necessary
            const result = schools.map(s => ({
                id: s.id,
                name: s.name,
                status: s.status,
                createdAt: s.createdAt,
                studentCount: Number(s.studentCount),
                summerQty: Number(s.summerQty),
                springQty: Number(s.springQty),
                winterQty: Number(s.winterQty),
                totalRevenue: Number(s.totalRevenue),
                paidAmount: Number(s.paidAmount),
                unpaidAmount: Number(s.unpaidAmount)
            }))

            res.json({ code: 200, data: result })
        } catch (error) {
            console.error("Get school stats error:", error)
            res.status(500).json({ code: 500, message: "Internal server error" })
        }
    }

    static async exportData(req: Request, res: Response) {
        try {
            const { id } = req.params
            if (!id) {
                res.status(400).json({ code: 400, message: "schoolId is required" })
                return
            }

            const queryBuilder = AppDataSource.getRepository(Order).createQueryBuilder("order")
                .leftJoinAndSelect("order.student", "student")
                .leftJoinAndSelect("student.class", "class")
                .leftJoinAndSelect("order.items", "items")
                .leftJoinAndSelect("items.product", "product")
                .where("class.school_id = :schoolId", { schoolId: id })
                .orderBy("class.name", "ASC")
                .addOrderBy("student.name", "ASC")

            const orders = await queryBuilder.getMany()

            const result = orders.map(order => {
                const summerQty = order.items.filter((i: OrderItem) => i.product.type === 0).reduce((sum: number, i: OrderItem) => sum + i.quantity, 0)
                const springQty = order.items.filter((i: OrderItem) => i.product.type === 1).reduce((sum: number, i: OrderItem) => sum + i.quantity, 0)
                const winterQty = order.items.filter((i: OrderItem) => i.product.type === 2).reduce((sum: number, i: OrderItem) => sum + i.quantity, 0)

                return {
                    className: order.student.class.name,
                    studentName: order.student.name,
                    idCard: order.student.idCard,
                    summerQty,
                    springQty,
                    winterQty,
                    totalAmount: order.totalAmount,
                    status: order.status
                }
            })

            res.json({ code: 200, data: result })
        } catch (error) {
            console.error("Export data error:", error)
            res.status(500).json({ code: 500, message: "Internal server error" })
        }
    }
}
