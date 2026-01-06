import { Router } from "express"
import { SchoolController } from "./controller/SchoolController"
import { ClassController } from "./controller/ClassController"
import { OrderController } from "./controller/OrderController"
// Re-export existing logic if desired, or keep auth separate.
// Strategy: Create a new router for business entities.
import importRoutes from "./routes/importRoutes"

const router = Router()

// Business Routes
router.get("/schools", SchoolController.getAll)
router.get("/schools/stats", SchoolController.getStats)
router.get("/schools/:id/export", SchoolController.exportData)
router.get("/classes", ClassController.getBySchool)
router.get("/orders", OrderController.search)

// Mount existing split routes if we want to consolidate everything here
// However, index.ts usually mounts them. Let's assume this file will export the main API router.
// The user asked to "Create src/routes.ts and register new routes"
// I will also include the import routes here as a sub-route or mixin if appropriate,
// BUT to avoid breaking existing authRoutes which might be mounted separately in index.ts,
// I will just export this router to be mounted at /api/data or similar, or replace the mounting logic.
// Simpler: Just export a router with the NEW routes, and let index.ts use it.

export default router
