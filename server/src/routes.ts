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
import express from "express"
import path from "path"

const router = Router()

// Admin Routes (previously business routes)
router.get("/schools", SchoolController.getAll)
router.get("/schools/stats", SchoolController.getStats)
router.get("/schools/:id/export", SchoolController.exportData)
router.post("/schools/batch", SchoolController.batchCreate)
router.put("/schools/:id/batch", SchoolController.batchUpdate)
router.get("/classes", ClassController.getBySchool)
router.get("/orders", OrderController.search)
router.post("/orders/supplementary", OrderController.createSupplementary)
router.put("/orders/:id", OrderController.update)
router.delete("/orders/:id", OrderController.delete)

// V2 Admin School Config
router.get("/schools/:id/config", SchoolController.getConfig)
router.put("/schools/:id/config", SchoolController.updateConfig)

// Image Upload
router.post("/upload", upload.single('image'), UploadController.uploadImage)
// After-sales
router.get("/after-sales", AfterSalesController.getAll)
router.put("/after-sales/:id/approve", AfterSalesController.approve)
router.put("/after-sales/:id/reject", AfterSalesController.reject)

// Shipping Management
router.get("/shipping/stats", ShippingController.getStats)
router.get("/shipping/:schoolId/export", ShippingController.exportManifest)
router.post("/shipping/:schoolId/confirm", ShippingController.confirmShip)

// V2 Roster Matching
router.post("/import/roster-preview", ImportController.rosterPreview)
router.post("/import/roster-apply", ImportController.rosterApply)

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
