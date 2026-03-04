import { Router } from "express"
import { SchoolController } from "./controller/SchoolController"
import { ClassController } from "./controller/ClassController"
import { OrderController } from "./controller/OrderController"
import { PublicController } from "./controller/PublicController"
import { AfterSalesController } from "./controller/AfterSalesController"
import { ShippingController } from "./controller/ShippingController"
import { UploadController } from "./controller/UploadController"
import { ImportController } from "./controller/ImportController"
import { upload } from "./middleware/upload"
import { auth } from "./middleware/authMiddleware"

const router = Router()

// Admin Routes (protected)
router.get("/schools", auth, SchoolController.getAll)
router.get("/schools/stats", auth, SchoolController.getStats)
router.get("/schools/:id/export", auth, SchoolController.exportData)
router.post("/schools/batch", auth, SchoolController.batchCreate)
router.put("/schools/:id/batch", auth, SchoolController.batchUpdate)
router.get("/classes", auth, ClassController.getBySchool)
router.get("/orders", auth, OrderController.search)
router.post("/orders/supplementary", auth, OrderController.createSupplementary)
router.put("/orders/:id", auth, OrderController.update)
router.delete("/orders/:id", auth, OrderController.delete)

// V2 Admin School Config (protected)
router.get("/schools/:id/config", auth, SchoolController.getConfig)
router.put("/schools/:id/config", auth, SchoolController.updateConfig)

// Image Upload (protected)
router.post("/upload", auth, upload.single('image'), UploadController.uploadImage)
// After-sales (protected)
router.get("/after-sales", auth, AfterSalesController.getAll)
router.put("/after-sales/:id/approve", auth, AfterSalesController.approve)
router.put("/after-sales/:id/reject", auth, AfterSalesController.reject)

// Shipping Management (protected)
router.get("/shipping/stats", auth, ShippingController.getStats)
router.get("/shipping/:schoolId/export", auth, ShippingController.exportManifest)
router.post("/shipping/:schoolId/confirm", auth, ShippingController.confirmShip)

// V2 Roster Matching (protected)
router.post("/import/roster-preview", auth, ImportController.rosterPreview)
router.post("/import/roster-apply", auth, ImportController.rosterApply)

// Public Routes (for webClient)
router.get("/public/school/:id", PublicController.getSchool)
router.get("/public/students/query-by-idcard/:idCard", PublicController.getStudentByCard)
router.get("/public/student/:id", PublicController.getStudentById)
router.get("/public/students/query", PublicController.getStudentV2)
router.get("/public/students/query-by-phone", PublicController.getStudentsByPhone)
router.get("/public/temp-order/:id", PublicController.getTempOrder)
router.post("/public/order/v2", PublicController.createOrderV2)
router.post("/public/prepay", PublicController.prepay)
router.get("/public/payment/status/:clientSn", PublicController.getPaymentStatus)
router.post("/public/payment/callback", PublicController.paymentCallback)
router.post("/public/payment/mock-callback", PublicController.mockCallback)
router.post("/public/after-sales", AfterSalesController.create)

export default router
