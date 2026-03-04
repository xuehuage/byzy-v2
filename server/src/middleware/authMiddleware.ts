import { Request, Response, NextFunction } from "express"
import jwt from "jsonwebtoken"

export const auth = (req: Request, res: Response, next: NextFunction): any => {
    const authHeader = req.headers.authorization

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ code: 401, message: "未提供身份验证令牌" })
    }

    const token = authHeader.split(" ")[1]

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET || "secret")
            ; (req as any).user = decoded
        next()
    } catch (error) {
        return res.status(401).json({ code: 401, message: "身份验证令牌无效或已过期" })
    }
}
