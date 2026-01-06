import { Request, Response } from "express"
import { AppDataSource } from "../data-source"
import { Class } from "../entity/Class"

export class ClassController {
    static async getBySchool(req: Request, res: Response) {
        try {
            const { schoolId } = req.query
            if (!schoolId) {
                res.status(400).json({ code: 400, message: "schoolId is required" })
                return
            }

            const classRepository = AppDataSource.getRepository(Class)
            const classes = await classRepository.find({
                where: {
                    schoolId: Number(schoolId)
                },
                order: {
                    name: "ASC"
                }
            })
            res.json({ code: 200, data: classes })
        } catch (error) {
            console.error("Get classes error:", error)
            res.status(500).json({ code: 500, message: "Internal server error" })
        }
    }
}
