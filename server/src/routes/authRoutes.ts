import { Router } from "express"
import { AuthController } from "../controller/AuthController"

const router = Router()

router.post("/login", AuthController.login)
router.get("/generate-2fa", AuthController.generate2FASecret)

export default router
