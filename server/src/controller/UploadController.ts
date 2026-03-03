import { Request, Response } from "express"

export class UploadController {
    static async uploadImage(req: Request, res: Response) {
        try {
            if (!req.file) {
                return res.status(400).json({ code: 400, message: "No file uploaded" })
            }

            // Return relative path to be stored in DB
            const relativePath = `/uploads/${req.file.filename}`

            res.json({
                code: 200,
                data: {
                    url: relativePath
                }
            })
        } catch (error) {
            console.error("Upload error:", error)
            res.status(500).json({ code: 500, message: "Internal server error" })
        }
    }
}
