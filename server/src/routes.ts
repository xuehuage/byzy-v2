import { Router } from "express"
import { SchoolController } from "./controller/SchoolController"
import { ClassController } from "./controller/ClassController"
import { OrderController } from "./controller/OrderController"
import { PublicController } from "./controller/PublicController"

const router = Router()

// Admin Routes (previously business routes)
router.get("/schools", SchoolController.getAll)
router.get("/schools/stats", SchoolController.getStats)
router.get("/schools/:id/export", SchoolController.exportData)
router.get("/classes", ClassController.getBySchool)
router.get("/orders", OrderController.search)
router.post("/orders/supplementary", OrderController.createSupplementary)
router.put("/orders/:id", OrderController.update)

// Public Routes (for webClient)
router.get("/public/school/:id", PublicController.getSchool)
router.get("/public/students/query-by-idcard/:idCard", PublicController.getStudentByCard)
router.post("/public/prepay", PublicController.prepay)
router.get("/public/payment/status/:clientSn", PublicController.getPaymentStatus)
router.post("/public/payment/callback", PublicController.paymentCallback)
router.post("/public/payment/mock-callback", PublicController.mockCallback)

export default router
