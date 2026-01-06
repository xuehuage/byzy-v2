import { Request, Response } from "express"
import { AppDataSource } from "../data-source"
import { Order } from "../entity/Order"
import { Brackets } from "typeorm"

export class OrderController {
    static async search(req: Request, res: Response) {
        try {
            const { page = 1, pageSize = 10, schoolId, classId, status, uniformType, keyword } = req.query
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
}
