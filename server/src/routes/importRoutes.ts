import { Router } from "express"
import { ImportController } from "../controller/ImportController"

const router = Router()

router.post("/import", ImportController.importData)

export default router
