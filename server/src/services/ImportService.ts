import { AppDataSource } from "../data-source"
import { School } from "../entity/School"
import { Grade } from "../entity/Grade"
import { Product } from "../entity/Product"
import { Class } from "../entity/Class"
import { Student } from "../entity/Student"
import { Order, OrderStatus } from "../entity/Order"
import { OrderItem } from "../entity/OrderItem"
import { ImportData } from "../types"

export class ImportService {
    static async importData(data: ImportData) {
        return await AppDataSource.manager.transaction(async (transactionalEntityManager) => {
            const { schoolName, products, students } = data

            // 1. Handle School
            let school = await transactionalEntityManager.findOne(School, { where: { name: schoolName } })
            if (!school) {
                school = new School()
                school.name = schoolName
                school.status = 1
                await transactionalEntityManager.save(school)
            }

            // 2. Handle Products
            if (products && products.length > 0) {
                await transactionalEntityManager.delete(Product, { schoolId: school.id })
                const productEntities = products.map(p => {
                    const product = new Product()
                    product.schoolId = school.id
                    product.type = p.type
                    product.price = Math.round(Number(p.price) * 100)
                    if (p.type === 0) product.name = "夏装"
                    else if (p.type === 1) product.name = "春秋装"
                    else if (p.type === 2) product.name = "冬装"
                    else product.name = `产品-${p.type}`
                    return product
                })
                await transactionalEntityManager.save(productEntities)
            }

            const currentProducts = await transactionalEntityManager.find(Product, { where: { schoolId: school.id } })
            const productMap = new Map<number, Product>()
            currentProducts.forEach(p => productMap.set(p.type, p))

            // 3. Process Hierarchies and Students
            const gradeCache = new Map<string, Grade>()
            const classCache = new Map<string, Class>()
            const skippedStudents: any[] = []
            let importedCount = 0

            for (const studentData of students) {
                let gradeEntity: Grade | undefined | null = gradeCache.get(studentData.gradeName)
                if (!gradeEntity) {
                    gradeEntity = await transactionalEntityManager.findOne(Grade, {
                        where: { schoolId: school.id, name: studentData.gradeName }
                    })
                    if (!gradeEntity) {
                        gradeEntity = new Grade()
                        gradeEntity.schoolId = school.id
                        gradeEntity.name = studentData.gradeName
                        await transactionalEntityManager.save(gradeEntity)
                    }
                    gradeCache.set(studentData.gradeName, gradeEntity)
                }

                // Handle Class
                const classKey = `${studentData.gradeName}-${studentData.className}`
                let classEntity: Class | undefined | null = classCache.get(classKey)
                if (!classEntity) {
                    classEntity = await transactionalEntityManager.findOne(Class, {
                        where: { gradeId: gradeEntity.id, name: studentData.className }
                    })
                    if (!classEntity) {
                        classEntity = new Class()
                        classEntity.gradeId = gradeEntity.id
                        classEntity.name = studentData.className
                        await transactionalEntityManager.save(classEntity)
                    }
                    classCache.set(classKey, classEntity)
                }

                // Check for existing student based on new unique constraint
                const existingStudent = await transactionalEntityManager.findOne(Student, {
                    where: {
                        name: studentData.studentName,
                        phone: studentData.phone,
                        birthday: studentData.birthday
                    },
                    relations: ["orders"]
                })

                if (existingStudent && existingStudent.orders.length > 0) {
                    skippedStudents.push({
                        studentName: studentData.studentName,
                        idCard: studentData.idCard,
                        reason: "已存在相关订单"
                    })
                    continue
                }

                let student = existingStudent
                if (student) {
                    student.gradeId = gradeEntity.id
                    student.classId = classEntity.id
                    student.idCard = studentData.idCard
                } else {
                    student = new Student()
                    student.name = studentData.studentName
                    student.phone = studentData.phone
                    student.birthday = studentData.birthday
                    student.idCard = studentData.idCard
                    student.gradeId = gradeEntity.id
                    student.classId = classEntity.id
                }
                const savedStudent = await transactionalEntityManager.save(student)

                let totalAmount = 0
                const items: { type: number, qty: number, price: number }[] = []

                const checkQty = (qty: number, type: number) => {
                    if (qty > 0) {
                        const product = productMap.get(type)
                        const price = product ? Number(product.price) : 0
                        totalAmount += price * qty
                        items.push({ type, qty, price })
                    }
                }

                checkQty(studentData.summerQty, 0)
                checkQty(studentData.autumnQty, 1)
                checkQty(studentData.winterQty, 2)

                if (items.length > 0) {
                    const order = new Order()
                    order.studentId = savedStudent.id
                    order.orderNo = `SID${savedStudent.id}-${Date.now()}-${Math.floor(Math.random() * 10000)}`
                    order.totalAmount = totalAmount
                    order.status = OrderStatus.PENDING
                    const savedOrder = await transactionalEntityManager.save(order)

                    const orderItems = items.map(item => {
                        const orderItem = new OrderItem()
                        orderItem.order = savedOrder
                        const product = productMap.get(item.type)
                        if (product) orderItem.product = product
                        orderItem.quantity = item.qty
                        orderItem.priceSnapshot = item.price
                        return orderItem
                    })
                    await transactionalEntityManager.save(orderItems)
                    importedCount++
                }
            }

            return {
                success: true,
                schoolId: school.id,
                importedCount,
                skippedCount: skippedStudents.length,
                skippedStudents
            }
        })
    }
}
