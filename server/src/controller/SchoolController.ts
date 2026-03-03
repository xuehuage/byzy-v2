import { Request, Response } from "express"
import { AppDataSource } from "../data-source"
import { School } from "../entity/School"
import { Order, OrderStatus } from "../entity/Order"
import { OrderItem } from "../entity/OrderItem"
import { Class } from "../entity/Class"
import { Student } from "../entity/Student"

export class SchoolController {
    static async getAll(req: Request, res: Response) {
        try {
            const schoolRepository = AppDataSource.getRepository(School)

            const schools = await schoolRepository.createQueryBuilder("school")
                .leftJoinAndSelect("school.classes", "class")
                .addSelect(qb => {
                    return qb.select("COUNT(DISTINCT st.id)", "sc")
                        .from("students", "st")
                        .innerJoin("orders", "o", "st.id = o.student_id")
                        .innerJoin("order_items", "oi", "o.id = oi.order_id")
                        .innerJoin("products", "p", "oi.product_id = p.id")
                        .where("p.school_id = school.id")
                        .andWhere("o.status NOT IN (:...status)", { status: [OrderStatus.CANCELLED] })
                }, "studentCount")
                .orderBy("school.createdAt", "DESC")
                .getRawAndEntities()

            const result = schools.entities.map((s, index) => {
                const raw = schools.raw[index];
                // Try both possible keys (camelCase from alias or snake_case/prefixed from driver)
                const studentCount = raw.studentCount ?? raw.studentcount ?? raw.sc ?? Object.values(raw).find((v, i) => Object.keys(raw)[i].toLowerCase().includes('studentcount')) ?? 0;
                return {
                    ...s,
                    studentCount: Number(studentCount)
                };
            });

            res.json({ code: 200, data: result })
        } catch (error) {
            console.error("Get schools error:", error)
            res.status(500).json({ code: 500, message: "Internal server error" })
        }
    }

    static async getStats(req: Request, res: Response) {
        try {
            const { startDate, endDate } = req.query
            const schoolRepository = AppDataSource.getRepository(School)

            const query = schoolRepository.createQueryBuilder("school")
                .select([
                    "school.id as id",
                    "school.name as name",
                    "school.status as status",
                    "school.createdAt as createdAt"
                ])

            // Helper to apply date filter to subqueries
            const applyDateFilter = (qb: any, tableAlias: string) => {
                if (startDate) {
                    qb.andWhere(`${tableAlias}.createdAt >= :start`, { start: `${startDate} 00:00:00` })
                }
                if (endDate) {
                    qb.andWhere(`${tableAlias}.createdAt <= :end`, { end: `${endDate} 23:59:59` })
                }
                return qb
            }

            // 1. Total student count
            query.addSelect(qb => {
                const subQuery = qb.select("COUNT(st.id)", "studentCount")
                    .from("students", "st")
                    .innerJoin("classes", "c", "st.class_id = c.id")
                    .where("c.school_id = school.id")
                return applyDateFilter(subQuery, "st")
            }, "studentCount")

            // 2. Uniform quantities (Summer: type 0)
            query.addSelect(qb => {
                const subQuery = qb.select("IFNULL(SUM(oi.quantity), 0)", "summerQty")
                    .from("order_items", "oi")
                    .innerJoin("products", "p", "oi.product_id = p.id")
                    .innerJoin("orders", "o", "oi.order_id = o.id")
                    .innerJoin("students", "st", "o.student_id = st.id")
                    .innerJoin("classes", "c", "st.class_id = c.id")
                    .where("c.school_id = school.id")
                    .andWhere("p.type = 0")
                    .andWhere("o.status NOT IN (:...exclude)", { exclude: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] })
                return applyDateFilter(subQuery, "o")
            }, "summerQty")

            // 3. Uniform quantities (Spring/Autumn: type 1)
            query.addSelect(qb => {
                const subQuery = qb.select("IFNULL(SUM(oi.quantity), 0)", "springQty")
                    .from("order_items", "oi")
                    .innerJoin("products", "p", "oi.product_id = p.id")
                    .innerJoin("orders", "o", "oi.order_id = o.id")
                    .innerJoin("students", "st", "o.student_id = st.id")
                    .innerJoin("classes", "c", "st.class_id = c.id")
                    .where("c.school_id = school.id")
                    .andWhere("p.type = 1")
                    .andWhere("o.status NOT IN (:...exclude)", { exclude: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] })
                return applyDateFilter(subQuery, "o")
            }, "springQty")

            // 4. Uniform quantities (Winter: type 2)
            query.addSelect(qb => {
                const subQuery = qb.select("IFNULL(SUM(oi.quantity), 0)", "winterQty")
                    .from("order_items", "oi")
                    .innerJoin("products", "p", "oi.product_id = p.id")
                    .innerJoin("orders", "o", "oi.order_id = o.id")
                    .innerJoin("students", "st", "o.student_id = st.id")
                    .innerJoin("classes", "c", "st.class_id = c.id")
                    .where("c.school_id = school.id")
                    .andWhere("p.type = 2")
                    .andWhere("o.status NOT IN (:...exclude)", { exclude: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] })
                return applyDateFilter(subQuery, "o")
            }, "winterQty")

            // 5. Revenue: Total
            query.addSelect(qb => {
                const subQuery = qb.select("IFNULL(SUM(o.total_amount), 0)", "totalRevenue")
                    .from("orders", "o")
                    .innerJoin("students", "st", "o.student_id = st.id")
                    .innerJoin("classes", "c", "st.class_id = c.id")
                    .where("c.school_id = school.id")
                    .andWhere("o.status NOT IN (:...exclude)", { exclude: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] })
                return applyDateFilter(subQuery, "o")
            }, "totalRevenue")

            // 6. Revenue: Paid
            query.addSelect(qb => {
                const subQuery = qb.select("IFNULL(SUM(o.total_amount), 0)", "paidAmount")
                    .from("orders", "o")
                    .innerJoin("students", "st", "o.student_id = st.id")
                    .innerJoin("classes", "c", "st.class_id = c.id")
                    .where("c.school_id = school.id")
                    .andWhere("o.status IN (:...paidStatuses)", { paidStatuses: [OrderStatus.PAID, OrderStatus.EXCHANGING, OrderStatus.SHIPPED, OrderStatus.REFUNDING] })
                return applyDateFilter(subQuery, "o")
            }, "paidAmount")

            // 7. Revenue: Unpaid (Pending)
            query.addSelect(qb => {
                const subQuery = qb.select("IFNULL(SUM(o.total_amount), 0)", "unpaidAmount")
                    .from("orders", "o")
                    .innerJoin("students", "st", "o.student_id = st.id")
                    .innerJoin("classes", "c", "st.class_id = c.id")
                    .where("c.school_id = school.id")
                    .andWhere("o.status = :pending", { pending: OrderStatus.PENDING })
                return applyDateFilter(subQuery, "o")
            }, "unpaidAmount")

            const schools = await query.orderBy("school.createdAt", "DESC").getRawMany()

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
    static async getConfig(req: Request, res: Response) {
        try {
            const id = parseInt(req.params.id)
            const school = await AppDataSource.getRepository(School).findOneBy({ id })
            if (!school) return res.status(404).json({ code: 404, message: "School not found" })

            res.json({
                code: 200,
                data: {
                    summerImage: school.summerImage,
                    autumnImage: school.autumnImage,
                    winterImage: school.winterImage,
                    sizeGuideImage: school.sizeGuideImage,
                    isSummerActive: !!school.isSummerActive,
                    isAutumnActive: !!school.isAutumnActive,
                    isWinterActive: !!school.isWinterActive,
                    summerPrice: school.summerPrice,
                    autumnPrice: school.autumnPrice,
                    winterPrice: school.winterPrice
                }
            })
        } catch (error) {
            console.error("Get school config error:", error)
            res.status(500).json({ code: 500, message: "Internal server error" })
        }
    }

    static async updateConfig(req: Request, res: Response) {
        try {
            const id = parseInt(req.params.id)
            const schoolRepository = AppDataSource.getRepository(School)
            const school = await schoolRepository.findOneBy({ id })

            if (!school) return res.status(404).json({ code: 404, message: "School not found" })

            const {
                summerImage, autumnImage, winterImage, sizeGuideImage,
                isSummerActive, isAutumnActive, isWinterActive,
                summerPrice, autumnPrice, winterPrice
            } = req.body

            if (summerImage !== undefined) school.summerImage = summerImage
            if (autumnImage !== undefined) school.autumnImage = autumnImage
            if (winterImage !== undefined) school.winterImage = winterImage
            if (sizeGuideImage !== undefined) school.sizeGuideImage = sizeGuideImage

            if (isSummerActive !== undefined) school.isSummerActive = isSummerActive
            if (isAutumnActive !== undefined) school.isAutumnActive = isAutumnActive
            if (isWinterActive !== undefined) school.isWinterActive = isWinterActive

            if (summerPrice !== undefined) school.summerPrice = summerPrice
            if (autumnPrice !== undefined) school.autumnPrice = autumnPrice
            if (winterPrice !== undefined) school.winterPrice = winterPrice

            await schoolRepository.save(school)

            res.json({ code: 200, message: "Update success" })
        } catch (error) {
            console.error("Update school config error:", error)
            res.status(500).json({ code: 500, message: "Internal server error" })
        }
    }

    static async batchCreate(req: Request, res: Response) {
        return await AppDataSource.manager.transaction(async (transactionalEntityManager) => {
            try {
                const { name, classes } = req.body
                if (!name) return res.status(400).json({ code: 400, message: "School name is required" })

                // Create School
                const school = new School()
                school.name = name
                school.status = 1
                const savedSchool = await transactionalEntityManager.save(school)

                // Create Classes
                if (classes && Array.isArray(classes)) {
                    const classEntities = classes.map(clsName => {
                        const cls = new Class()
                        cls.name = clsName
                        cls.schoolId = savedSchool.id
                        return cls
                    })
                    await transactionalEntityManager.save(classEntities)
                }

                res.json({ code: 200, message: "School and classes created successfully", data: savedSchool })
            } catch (error) {
                console.error("Batch create school error:", error)
                res.status(500).json({ code: 500, message: "Internal server error" })
            }
        })
    }

    static async batchUpdate(req: Request, res: Response) {
        const id = parseInt(req.params.id)
        if (isNaN(id)) return res.status(400).json({ code: 400, message: "Invalid school id" })

        return await AppDataSource.manager.transaction(async (transactionalEntityManager) => {
            try {
                const { name, classes } = req.body
                if (!name) return res.status(400).json({ code: 400, message: "School name is required" })

                const schoolRepository = transactionalEntityManager.getRepository(School)
                const classRepository = transactionalEntityManager.getRepository(Class)
                const studentRepository = transactionalEntityManager.getRepository(Student)

                const school = await schoolRepository.findOneBy({ id })
                if (!school) return res.status(404).json({ code: 404, message: "School not found" })

                // 1. Update School Name
                school.name = name
                await schoolRepository.save(school)

                // 2. Manage Classes
                const existingClasses = await classRepository.findBy({ schoolId: id })
                const inputClasses = classes || []

                // Identify classes to delete
                const inputClassNames = inputClasses.map((c: any) => typeof c === 'string' ? c : c.name)
                const classesToDelete = existingClasses.filter(ext => !inputClassNames.includes(ext.name))

                for (const cls of classesToDelete) {
                    // Check student association
                    const studentCount = await studentRepository.countBy({ classId: cls.id })
                    if (studentCount > 0) {
                        throw new Error(`${cls.name}班级有学生关联，不允许删除`)
                    }
                    await classRepository.remove(cls)
                }

                // Create new classes
                const existingNames = existingClasses.map(c => c.name)
                const classesToCreate = inputClassNames.filter((name: string) => !existingNames.includes(name))

                if (classesToCreate.length > 0) {
                    const newEntities = classesToCreate.map((name: string) => {
                        const c = new Class()
                        c.name = name
                        c.schoolId = id
                        return c
                    })
                    await classRepository.save(newEntities)
                }

                res.json({ code: 200, message: "Update success" })
            } catch (error: any) {
                console.error("Batch update school error:", error)
                const msg = error.message.includes('班级有学生关联') ? error.message : "Internal server error"
                res.status(500).json({ code: 500, message: msg })
            }
        })
    }
}
