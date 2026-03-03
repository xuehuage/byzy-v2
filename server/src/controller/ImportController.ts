import { Request, Response } from "express"
import { ImportService } from "../services/ImportService"
import { AppDataSource } from "../data-source"
import { Student } from "../entity/Student"
import { Class } from "../entity/Class"
import { Order } from "../entity/Order"
import { In } from "typeorm"

export class ImportController {
    static async importData(req: Request, res: Response) {
        try {
            const { schoolName, students } = req.body

            if (!schoolName || !students || !Array.isArray(students)) {
                res.status(400).json({ message: "Invalid payload: schoolName and students array are required." })
                return;
            }

            const result = await ImportService.importData(req.body)
            res.json({
                code: 200,
                message: "Import successful",
                data: result
            })
        } catch (error) {
            console.error("Import failed:", error)
            res.status(500).json({
                code: 500,
                message: "Import failed",
                data: (error as Error).message
            })
        }
    }

    static async rosterPreview(req: Request, res: Response) {
        try {
            const { schoolId, roster } = req.body
            if (!schoolId || !roster || !Array.isArray(roster)) {
                return res.status(400).json({ code: 400, message: "schoolId and roster array are required" })
            }

            const classRepo = AppDataSource.getRepository(Class)
            const studentRepo = AppDataSource.getRepository(Student)

            // Get all classes for this school to map className -> classId
            const schoolClasses = await classRepo.findBy({ schoolId })
            const classNameToId = new Map(schoolClasses.map(c => [c.name, c.id]))

            const results = []
            for (const item of roster) {
                const { studentName, className } = item
                const targetClassId = classNameToId.get(className)

                // Search for students with this name in this school (via existing classes or those who haven't been assigned yet)
                // Actually, V2 students might NOT have a classId yet. 
                // We should find students who have orders but no classId, OR students already in this school.
                // But specifically for this school! 
                // V2 students are created without classId. How do we know which school they belong to?
                // They belong to a school if they bought products associated with that school.

                const potentialStudents = await studentRepo.createQueryBuilder("s")
                    .leftJoinAndSelect("s.orders", "o")
                    .leftJoinAndSelect("o.items", "oi")
                    .leftJoinAndSelect("oi.product", "p")
                    .where("s.name = :name", { name: studentName })
                    // We filter by products that belong to this schoolId
                    .andWhere("p.school_id = :schoolId", { schoolId })
                    .getMany()

                let status = "C" // Default: No match
                let matchInfo: any = null
                let conflicts: any[] = []

                if (potentialStudents.length === 1) {
                    const s = potentialStudents[0]
                    if (!s.classId) {
                        status = "A" // Unique match, unassigned
                        matchInfo = {
                            studentId: s.id,
                            studentName: s.name,
                            phone: s.phone,
                            birthday: s.birthday,
                            idCardLast6: s.idCard ? s.idCard.slice(-6) : "------"
                        }
                    } else {
                        // Already has a class. Maybe overlap or update?
                        // For now treat as Success if it's the same class, or skip if different?
                        // User requirement says A is "Success (Can bind)".
                        status = "A"
                        matchInfo = {
                            studentId: s.id,
                            studentName: s.name,
                            phone: s.phone,
                            birthday: s.birthday,
                            idCardLast6: s.idCard ? s.idCard.slice(-6) : "------"
                        }
                    }
                } else if (potentialStudents.length > 1) {
                    status = "B" // Conflict
                    conflicts = potentialStudents.map(s => ({
                        studentId: s.id,
                        studentName: s.name,
                        phone: s.phone,
                        birthday: s.birthday,
                        idCardLast6: s.idCard ? s.idCard.slice(-6) : "------",
                        orders: s.orders.map(o => ({
                            orderNo: o.orderNo,
                            items: o.items.map(oi => `${oi.product.name}(${oi.size || '?'})`).join(', ')
                        }))
                    }))
                }

                results.push({
                    originalName: studentName,
                    originalClass: className,
                    targetClassId,
                    status,
                    matchInfo,
                    conflicts
                })
            }

            res.json({
                code: 200,
                data: {
                    results,
                    stats: {
                        success: results.filter(r => r.status === "A").length,
                        conflict: results.filter(r => r.status === "B").length,
                        fail: results.filter(r => r.status === "C").length
                    }
                }
            })
        } catch (error) {
            console.error("Roster preview error:", error)
            res.status(500).json({ code: 500, message: "Internal server error" })
        }
    }

    static async rosterApply(req: Request, res: Response) {
        try {
            const { matches } = req.body // Array of { studentId, classId }
            if (!matches || !Array.isArray(matches)) {
                return res.status(400).json({ code: 400, message: "matches array is required" })
            }

            const studentRepo = AppDataSource.getRepository(Student)

            // Perform updates in a loop or batch
            // Logic: Update student SET classId = match.classId WHERE id = match.studentId
            for (const match of matches) {
                if (match.studentId && match.classId) {
                    await studentRepo.update(match.studentId, { classId: match.classId })
                }
            }

            res.json({ code: 200, message: `Successfully matched ${matches.length} students` })
        } catch (error) {
            console.error("Roster apply error:", error)
            res.status(500).json({ code: 500, message: "Internal server error" })
        }
    }
}
