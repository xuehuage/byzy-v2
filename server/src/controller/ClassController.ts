import { Request, Response } from "express"
import { AppDataSource } from "../data-source"
import { Class } from "../entity/Class"

export class ClassController {
    static async getBySchool(req: Request, res: Response) {
        try {
            const { schoolId, gradeId } = req.query
            if (!schoolId && !gradeId) {
                res.status(400).json({ code: 400, message: "schoolId or gradeId is required" })
                return
            }

            const classRepository = AppDataSource.getRepository(Class)
            const queryBuilder = classRepository.createQueryBuilder("class")
                .innerJoin("class.grade", "grade")

            if (gradeId) {
                queryBuilder.where("class.grade_id = :gradeId", { gradeId: Number(gradeId) })
            } else if (schoolId) {
                queryBuilder.where("grade.school_id = :schoolId", { schoolId: Number(schoolId) })
            }

            const classes = await queryBuilder
                .leftJoin("class.students", "st")
                .leftJoin("st.orders", "o", "o.status NOT IN (:...exclude)", { exclude: ['CANCELLED'] })
                .select("class")
                .addSelect("COUNT(DISTINCT CASE WHEN o.id IS NOT NULL THEN st.id ELSE NULL END)", "studentCount")
                .groupBy("class.id")
                .orderBy("class.name", "ASC")
                .getRawAndEntities()

            const result = classes.entities.map((cls, idx) => ({
                ...cls,
                studentCount: Number(classes.raw[idx].studentCount)
            }))

            res.json({ code: 200, data: result })
        } catch (error) {
            console.error("Get classes error:", error)
            res.status(500).json({ code: 500, message: "Internal server error" })
        }
    }
}
