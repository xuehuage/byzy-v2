import { AppDataSource } from "../data-source"
import { School } from "../entity/School"
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

            // 1. 处理学校信息 (Handle School)
            let school = await transactionalEntityManager.findOne(School, { where: { name: schoolName } })
            if (!school) {
                school = new School()
                school.name = schoolName
                school.status = 1
                await transactionalEntityManager.save(school)
            }

            // 2. 处理产品信息 (Handle Products) - 删除旧的，插入新的
            if (products && products.length > 0) {
                await transactionalEntityManager.delete(Product, { schoolId: school.id })
                const productEntities = products.map(p => {
                    const product = new Product()
                    product.schoolId = school.id
                    product.type = p.type
                    product.price = p.price
                    // Set product name based on type
                    if (p.type === 0) product.name = "夏装"
                    else if (p.type === 1) product.name = "春秋装"
                    else if (p.type === 2) product.name = "冬装"
                    else product.name = `产品-${p.type}`
                    return product
                })
                await transactionalEntityManager.save(productEntities)
            }

            // 缓存产品信息 (Cache product info)
            const currentProducts = await transactionalEntityManager.find(Product, { where: { schoolId: school.id } })
            const productMap = new Map<number, Product>()
            currentProducts.forEach(p => productMap.set(p.type, p))

            // 3. 处理学生和订单 (Process Students & Orders)
            const classCache = new Map<string, Class>()

            for (const studentData of students) {
                // 处理班级 (Handle Class)
                let classEntity: Class | undefined | null = classCache.get(studentData.className)
                if (!classEntity) {
                    classEntity = await transactionalEntityManager.findOne(Class, {
                        where: { schoolId: school.id, name: studentData.className }
                    })
                    if (!classEntity) {
                        classEntity = new Class()
                        classEntity.schoolId = school.id
                        classEntity.name = studentData.className
                        await transactionalEntityManager.save(classEntity)
                    }
                    classCache.set(studentData.className, classEntity)
                }

                // 处理学生 (Handle Student)
                let student = await transactionalEntityManager.findOne(Student, { where: { idCard: studentData.idCard } })
                if (student) {
                    // 更新现有学生 (Update existing)
                    student.name = studentData.studentName
                    student.classId = classEntity.id
                } else {
                    // 创建新学生 (Create new)
                    student = new Student()
                    student.name = studentData.studentName
                    student.idCard = studentData.idCard
                    student.classId = classEntity.id
                }
                const savedStudent = await transactionalEntityManager.save(student)

                // 计算订单金额 (Calculate Order Amount)
                let totalAmount = 0
                const items: { type: number, qty: number, price: number }[] = []

                if (studentData.summerQty > 0) {
                    const product = productMap.get(0)
                    const price = product ? Number(product.price) : 0
                    totalAmount += price * studentData.summerQty
                    items.push({ type: 0, qty: studentData.summerQty, price })
                }
                if (studentData.springQty > 0) {
                    const product = productMap.get(1)
                    const price = product ? Number(product.price) : 0
                    totalAmount += price * studentData.springQty
                    items.push({ type: 1, qty: studentData.springQty, price })
                }
                if (studentData.winterQty > 0) {
                    const product = productMap.get(2)
                    const price = product ? Number(product.price) : 0
                    totalAmount += price * studentData.winterQty
                    items.push({ type: 2, qty: studentData.winterQty, price })
                }

                if (items.length > 0) {
                    // 创建订单 (Create Order)
                    const order = new Order()
                    order.studentId = savedStudent.id
                    order.orderNo = `ORD-${Date.now()}-${Math.floor(Math.random() * 10000)}`
                    order.totalAmount = totalAmount
                    order.status = OrderStatus.PENDING
                    const savedOrder = await transactionalEntityManager.save(order)

                    // 创建订单项 (Create Order Items)
                    const orderItems = items.map(item => {
                        const orderItem = new OrderItem()
                        orderItem.orderId = savedOrder.id
                        const product = productMap.get(item.type)
                        if (product) {
                            orderItem.productId = product.id
                        }
                        orderItem.quantity = item.qty
                        orderItem.priceSnapshot = item.price
                        return orderItem
                    })
                    await transactionalEntityManager.save(orderItems)
                }
            }

            return { success: true, schoolId: school.id, studentCount: students.length }
        })
    }
}
