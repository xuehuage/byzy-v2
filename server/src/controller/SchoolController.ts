import { Request, Response } from "express"
import { AppDataSource } from "../data-source"
import { School } from "../entity/School"
import { Order, OrderStatus } from "../entity/Order"
import { OrderItem } from "../entity/OrderItem"
import { Class } from "../entity/Class"
import { Grade } from "../entity/Grade"
import { Student } from "../entity/Student"
import { Product } from "../entity/Product"
import { AfterSalesRecord, AfterSalesStatus } from "../entity/AfterSalesRecord"

export class SchoolController {
    static async getAll(req: Request, res: Response) {
        try {
            const schoolRepository = AppDataSource.getRepository(School)

            // 1. Fetch the full entity tree
            const schoolEntities = await schoolRepository.find({
                relations: ["grades", "grades.classes"],
                order: { createdAt: "DESC" }
            })

            // 2. Fetch unique purchaser counts grouped by class
            // Only count students who have at least one non-cancelled order
            const classCounts = await AppDataSource.getRepository(Student)
                .createQueryBuilder("st")
                .select("st.class_id", "classId")
                .addSelect("st.grade_id", "gradeId")
                .addSelect("COUNT(DISTINCT st.id)", "count")
                .innerJoin("orders", "o", "o.student_id = st.id")
                .where("o.status NOT IN (:...exclude)", { exclude: [OrderStatus.CANCELLED] })
                .groupBy("st.grade_id")
                .addGroupBy("st.class_id")
                .getRawMany()

            // 3. Map counts back to entities and aggregate upwards
            const result = schoolEntities.map(school => {
                let schoolTotal = 0
                const grades = (school.grades || []).map(grade => {
                    let gradeTotal = 0
                    const classes = (grade.classes || []).map(cls => {
                        // Find count for this class
                        const match = classCounts.find(c => Number(c.classId) === cls.id)
                        const count = match ? Number(match.count) : 0
                        gradeTotal += count
                        return { ...cls, studentCount: count }
                    })

                    // Handle students who are in the grade but NOT in any class
                    // If the user wants Grade = Sum(Classes), we only add the class counts.
                    // However, for accuracy, we check if there are any "NULL class" students for this grade
                    const unassignedMatch = classCounts.find(c => Number(c.gradeId) === grade.id && c.classId === null)
                    const unassignedCount = unassignedMatch ? Number(unassignedMatch.count) : 0

                    // User requirement: "年级购买人数=年级下所有班级购买人数"
                    // If they want strict summation, we might ignore unassignedCount in the total, 
                    // but it's safer to consider them if they exist. 
                    // Let's stick to their literal formula: Grade = Sum(Classes) OR handle unassigned gracefully.
                    // For now, let's include unassigned in the grade total but not in any class total.
                    gradeTotal += unassignedCount
                    schoolTotal += gradeTotal

                    return { ...grade, classes, studentCount: gradeTotal }
                })
                return { ...school, grades, studentCount: schoolTotal }
            })

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
                    "school.summerPrice as summerPrice",
                    "school.autumnPrice as autumnPrice",
                    "school.winterPrice as winterPrice",
                    "school.createdAt as createdAt"
                ])

            // Helper to apply date filter to subqueries
            const applyDateFilter = (qb: any, tableAlias: string, suffix: string = "") => {
                const startKey = `start${suffix}`
                const endKey = `end${suffix}`
                if (startDate) {
                    qb.andWhere(`${tableAlias}.createdAt >= :${startKey}`, { [startKey]: `${startDate} 00:00:00` })
                }
                if (endDate) {
                    qb.andWhere(`${tableAlias}.createdAt <= :${endKey}`, { [endKey]: `${endDate} 23:59:59` })
                }
                return qb
            }

            // 1. Total unique purchaser count — exclude students who have fully refunded all items
            // Logic: for each student, sum their purchased qty, subtract processed refund qty.
            // Only count them if net_qty > 0.
            query.addSelect(qb => {
                const subQuery = qb.select("COUNT(DISTINCT net_buyers.student_id)", "studentCount")
                    .from(qb2 => {
                        return qb2
                            .select("o.student_id", "student_id")
                            .addSelect("SUM(oi.quantity)", "total_bought")
                            .addSelect("IFNULL(SUM(asr.new_quantity), 0)", "total_refunded")
                            .from("orders", "o")
                            .innerJoin("order_items", "oi", "oi.order_id = o.id")
                            .innerJoin("products", "p", "oi.product_id = p.id")
                            .leftJoin("after_sales_records", "asr",
                                "asr.order_id = o.id AND asr.type = 'REFUND' AND asr.status = 'PROCESSED'"
                            )
                            .where("p.school_id = school.id")
                            .andWhere("o.status NOT IN (:...scExclude)", { scExclude: [OrderStatus.CANCELLED] })
                            .groupBy("o.student_id")
                            .having("SUM(oi.quantity) - IFNULL(SUM(asr.new_quantity), 0) > 0")
                    }, "net_buyers")
                return applyDateFilter(subQuery, "net_buyers")
            }, "studentCount")

            // 2-4. Uniform quantities
            const addProductQtySelect = (alias: string, type: number) => {
                query.addSelect(qb => {
                    const typeKey = `type_${alias}`
                    const excludeKey = `exclude_${alias}`
                    return qb.select("IFNULL(SUM(oi.quantity), 0)", alias)
                        .from("order_items", "oi")
                        .innerJoin("products", "p", "oi.product_id = p.id")
                        .innerJoin("orders", "o", "oi.order_id = o.id")
                        .where("p.school_id = school.id")
                        .andWhere(`p.type = :${typeKey}`, { [typeKey]: type })
                        .andWhere(`o.status NOT IN (:...${excludeKey})`, { [excludeKey]: [OrderStatus.CANCELLED] })
                }, alias)

                // Add a separate column for refund quantity to be subtracted later in JS
                const refundAlias = `${alias}Refund`
                query.addSelect(qb => {
                    const typeKey = `type_${refundAlias}`
                    return qb.select("IFNULL(SUM(asr.new_quantity), 0)", refundAlias)
                        .from("after_sales_records", "asr")
                        .innerJoin("products", "p", "asr.product_id = p.id")
                        .innerJoin("orders", "o", "asr.order_id = o.id")
                        .where("p.school_id = school.id")
                        .andWhere(`p.type = :${typeKey}`, { [typeKey]: type })
                        .andWhere("asr.status = 'PROCESSED'")
                        .andWhere("asr.type = 'REFUND'")
                    return applyDateFilter(qb, "o", `_ref_${alias}`)
                }, refundAlias)
            }

            addProductQtySelect("summerQty", 0)
            addProductQtySelect("autumnQty", 1) // Standardize on Autumn
            addProductQtySelect("winterQty", 2)

            // 5-7. Revenue
            const addRevenueSelect = (alias: string, statuses: OrderStatus[] | null) => {
                query.addSelect(qb => {
                    const ssKey = `ss_${alias}`
                    const excludeKey = `exclude_${alias}`
                    const subQuery = qb.select("IFNULL(SUM(o.total_amount), 0)", alias)
                        .from("orders", "o")
                        .innerJoin("students", "st", "o.student_id = st.id")
                        .innerJoin("grades", "g", "st.grade_id = g.id")
                        .where("g.school_id = school.id")
                    if (statuses) {
                        subQuery.andWhere(`o.status IN (:...${ssKey})`, { [ssKey]: statuses })
                    } else {
                        subQuery.andWhere(`o.status NOT IN (:...${excludeKey})`, { [excludeKey]: [OrderStatus.CANCELLED, OrderStatus.REFUNDED] })
                    }
                    return applyDateFilter(subQuery, "o", `_${alias}`)
                }, alias)
            }

            addRevenueSelect("totalRevenue", null)
            addRevenueSelect("paidAmount", [OrderStatus.PAID, OrderStatus.EXCHANGING, OrderStatus.SHIPPED, OrderStatus.REFUNDING])
            addRevenueSelect("unpaidAmount", [OrderStatus.PENDING])

            const schools = await query.orderBy("school.createdAt", "DESC").getRawMany()

            // Transformation and Formula-based Revenue Calculation
            const result = schools.map(s => {
                const summerQtyRefund = Number(s.summerQtyRefund || 0)
                const autumnQtyRefund = Number(s.autumnQtyRefund || 0)
                const winterQtyRefund = Number(s.winterQtyRefund || 0)
                const totalRefundedQty = summerQtyRefund + autumnQtyRefund + winterQtyRefund

                const summerQty = Math.max(0, Number(s.summerQty || 0) - summerQtyRefund)
                const autumnQty = Math.max(0, Number(s.autumnQty || 0) - autumnQtyRefund)
                const winterQty = Math.max(0, Number(s.winterQty || 0) - winterQtyRefund)

                const summerPrice = Number(s.summerPrice || 0)
                const autumnPrice = Number(s.autumnPrice || 0)
                const winterPrice = Number(s.winterPrice || 0)

                // User Formula: SummerQty * SummerPrice + AutumnQty * AutumnPrice + WinterQty * WinterPrice
                const calculatedRevenue = (summerQty * summerPrice) + (autumnQty * autumnPrice) + (winterQty * winterPrice)

                return {
                    id: s.id,
                    name: s.name,
                    status: s.status,
                    createdAt: s.createdAt,
                    studentCount: Number(s.studentCount),
                    summerQty,
                    autumnQty,
                    winterQty,
                    totalRefundedQty,
                    // Use calculated revenue for both total and paid if appropriate, 
                    // or keep actual paidAmount but calculate totalRevenue via formula.
                    // User said: "单个学校的销售金额等于该学校夏装套数*夏装单价+秋装套数*秋装单价+冬装套数*冬装单价"
                    totalRevenue: calculatedRevenue / 100, // Convert to 元
                    paidAmount: calculatedRevenue / 100,  // For simplicity aligning with "销售金额" request
                    unpaidAmount: Number(s.unpaidAmount) / 100
                }
            })

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
                .leftJoinAndSelect("student.grade", "grade")
                .leftJoinAndSelect("student.class", "class")
                .leftJoinAndSelect("order.items", "items")
                .leftJoinAndSelect("items.product", "product")
                .where("grade.school_id = :schoolId", { schoolId: id })
                .orderBy("grade.name", "ASC")
                .addOrderBy("class.name", "ASC")
                .addOrderBy("student.name", "ASC")

            const orders = await queryBuilder.getMany()

            const result = await Promise.all(orders.map(async order => {
                // Fetch processed refunds for this order
                const refunds = await AppDataSource.getRepository(AfterSalesRecord).find({
                    where: { orderId: order.id, status: AfterSalesStatus.PROCESSED, type: "REFUND" as any },
                    relations: ["product"]
                })

                const getActualQty = (type: number) => {
                    const originalQty = order.items
                        .filter((i: OrderItem) => i.product.type === type)
                        .reduce((sum: number, i: OrderItem) => sum + i.quantity, 0)
                    const refundedQty = refunds
                        .filter(r => r.product?.type === type)
                        .reduce((sum, r) => sum + Number(r.newQuantity), 0)
                    return Math.max(0, originalQty - refundedQty)
                }

                return {
                    gradeName: order.student.grade?.name || "未知年级",
                    className: order.student.class?.name || "未分班",
                    studentName: order.student.name,
                    idCard: order.student.idCard,
                    phone: order.student.phone,
                    summerQty: getActualQty(0),
                    springQty: getActualQty(1),
                    winterQty: getActualQty(2),
                    totalAmount: order.totalAmount,
                    status: order.status
                }
            }))

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
                    winterPrice: school.winterPrice,
                    afterSalesExchangeActive: !!school.afterSalesExchangeActive,
                    afterSalesRefundActive: !!school.afterSalesRefundActive
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
                summerPrice, autumnPrice, winterPrice,
                afterSalesExchangeActive, afterSalesRefundActive
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

            if (afterSalesExchangeActive !== undefined) school.afterSalesExchangeActive = afterSalesExchangeActive
            if (afterSalesRefundActive !== undefined) school.afterSalesRefundActive = afterSalesRefundActive

            await schoolRepository.save(school)

            // 同步更新产品表的价格
            const productRepository = AppDataSource.getRepository(Product)
            const products = await productRepository.findBy({ schoolId: id })
            for (const product of products) {
                if (product.type === 0 && summerPrice !== undefined) product.price = summerPrice
                else if (product.type === 1 && autumnPrice !== undefined) product.price = autumnPrice
                else if (product.type === 2 && winterPrice !== undefined) product.price = winterPrice
                await productRepository.save(product)
            }

            res.json({ code: 200, message: "Update success" })
        } catch (error) {
            console.error("Update school config error:", error)
            res.status(500).json({ code: 500, message: "Internal server error" })
        }
    }

    static async batchCreate(req: Request, res: Response) {
        return await AppDataSource.manager.transaction(async (transactionalEntityManager) => {
            try {
                const { name, grades } = req.body
                if (!name) return res.status(400).json({ code: 400, message: "School name is required" })

                // Create School
                const school = new School()
                school.name = name
                school.status = 1
                const savedSchool = await transactionalEntityManager.save(school)

                // Create Grades and Classes
                if (grades && Array.isArray(grades)) {
                    for (const gData of grades) {
                        const grade = new Grade()
                        grade.name = gData.name
                        grade.schoolId = savedSchool.id
                        const savedGrade = await transactionalEntityManager.save(grade)

                        if (gData.classes && Array.isArray(gData.classes)) {
                            const classEntities = gData.classes.map((clsName: string) => {
                                const cls = new Class()
                                cls.name = clsName
                                cls.gradeId = savedGrade.id
                                return cls
                            })
                            await transactionalEntityManager.save(classEntities)
                        }
                    }
                }

                res.json({ code: 200, message: "School, grades and classes created successfully", data: savedSchool })
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
                const { name, grades } = req.body
                if (!name) return res.status(400).json({ code: 400, message: "School name is required" })

                const schoolRepository = transactionalEntityManager.getRepository(School)
                const gradeRepository = transactionalEntityManager.getRepository(Grade)
                const classRepository = transactionalEntityManager.getRepository(Class)
                const studentRepository = transactionalEntityManager.getRepository(Student)

                const school = await schoolRepository.findOneBy({ id })
                if (!school) return res.status(404).json({ code: 404, message: "School not found" })

                // 1. Update School Name
                school.name = name
                await schoolRepository.save(school)

                // 2. Manage Grades
                const existingGrades = await gradeRepository.find({
                    where: { schoolId: id },
                    relations: ["classes"]
                })
                const inputGrades = grades || []

                // Identify grades to delete
                const inputGradeNames = inputGrades.map((g: any) => g.name)
                const gradesToDelete = existingGrades.filter(eg => !inputGradeNames.includes(eg.name))

                for (const grade of gradesToDelete) {
                    const studentCount = await studentRepository.countBy({ gradeId: grade.id })
                    if (studentCount > 0) {
                        throw new Error(`年级 ${grade.name} 下有学生关联，不允许删除`)
                    }
                    // Delete sub-classes first (or relying on cascade if set, but we handle manually for safety)
                    await classRepository.delete({ gradeId: grade.id })
                    await gradeRepository.remove(grade)
                }

                // Create or Update Grades
                for (const gData of inputGrades) {
                    let grade = existingGrades.find(eg => eg.name === gData.name)
                    if (!grade) {
                        grade = new Grade()
                        grade.name = gData.name
                        grade.schoolId = id
                        grade = await gradeRepository.save(grade)
                        grade.classes = []
                    }

                    // Manage Classes for this grade
                    const existingClasses = grade.classes || []
                    const inputClassNames = gData.classes || []

                    // Delete classes
                    const classesToDelete = existingClasses.filter(ec => !inputClassNames.includes(ec.name))
                    for (const cls of classesToDelete) {
                        const studentCount = await studentRepository.countBy({ classId: cls.id })
                        if (studentCount > 0) {
                            throw new Error(`班级 ${cls.name} 下有学生关联，不允许删除`)
                        }
                        await classRepository.remove(cls)
                    }

                    // Create classes
                    const existingClassNames = existingClasses.map(c => c.name)
                    const classesToCreate = inputClassNames.filter((name: string) => !existingClassNames.includes(name))
                    if (classesToCreate.length > 0) {
                        const newClasses = classesToCreate.map((name: string) => {
                            const c = new Class()
                            c.name = name
                            c.gradeId = (grade as Grade).id
                            return c
                        })
                        await classRepository.save(newClasses)
                    }
                }

                res.json({ code: 200, message: "Update success" })
            } catch (error: any) {
                console.error("Batch update school error:", error)
                const msg = error.message.includes('有学生关联') ? error.message : "Internal server error"
                res.status(500).json({ code: 500, message: msg })
            }
        })
    }
}
