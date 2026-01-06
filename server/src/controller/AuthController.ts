import { Request, Response } from "express"
import { AppDataSource } from "../data-source"
import { AdminUser } from "../entity/AdminUser"
import bcrypt from "bcrypt"
import jwt from "jsonwebtoken"
import { authenticator } from "otplib"

export class AuthController {
    static login = async (req: Request, res: Response): Promise<any> => {
        const { username, password, twoFactorCode } = req.body
        if (!username || !password) {
            return res.status(400).json({ code: 400, message: "请输入用户名和密码" })
        }

        const userRepository = AppDataSource.getRepository(AdminUser)

        try {
            const user = await userRepository.findOne({ where: { username } })

            if (!user) {
                return res.status(401).json({ code: 401, message: "用户名或密码错误" })
            }

            if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
                return res.status(403).json({ code: 403, message: "账号已锁定，请稍后再试" })
            }

            const match = await bcrypt.compare(password, user.passwordHash)

            if (!match) {
                user.loginRetries += 1
                if (user.loginRetries >= 5) {
                    user.lockedUntil = new Date(Date.now() + 30 * 60 * 1000) // 30 minutes
                }
                await userRepository.save(user)
                return res.status(401).json({ code: 401, message: "用户名或密码错误" })
            }

            // Password matches, now check 2FA if enabled
            if (user.twoFactorSecret) {
                if (!twoFactorCode) {
                    return res.status(401).json({
                        code: 401,
                        message: "请输入动态验证码"
                    })
                }

                const isValid = authenticator.verify({
                    token: twoFactorCode,
                    secret: user.twoFactorSecret
                })

                if (!isValid) {
                    return res.status(401).json({ code: 401, message: "动态验证码错误" })
                }
            }

            // Reset retries and lock on successful login
            user.loginRetries = 0
            user.lockedUntil = null
            await userRepository.save(user)

            const token = jwt.sign(
                { id: user.id, username: user.username },
                process.env.JWT_SECRET || "secret",
                { expiresIn: "7d" }
            )

            return res.json({
                code: 200,
                message: "登录成功",
                data: {
                    token,
                    user: {
                        id: user.id,
                        username: user.username,
                        realname: user.realname
                    }
                }
            })
        } catch (error) {
            console.error("Login error:", error)
            return res.status(500).json({ code: 500, message: "服务器内部错误" })
        }
    }

    // Helper to generate a secret for initial user
    static generate2FASecret = async (req: Request, res: Response): Promise<any> => {
        const secret = authenticator.generateSecret()
        return res.json({ code: 200, data: { secret } })
    }
}
