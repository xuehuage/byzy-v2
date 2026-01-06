import { Request, Response } from "express"
import { ImportService } from "../services/ImportService"

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
}
