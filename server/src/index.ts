import "reflect-metadata"
import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import { createServer } from "http"
import { AppDataSource } from "./data-source"
import authRoutes from "./routes/authRoutes"
import importRoutes from "./routes/importRoutes"
import appRoutes from "./routes"
import { rateLimit } from "express-rate-limit"
import { WebSocketService } from "./websocket"

dotenv.config()

const app = express()
app.use(cors())
const server = createServer(app)
const PORT = process.env.PORT || 3000

app.use(express.json({
    verify: (req: any, res, buf) => {
        req.rawBody = buf
    }
}))

// Rate limiter for login
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // Limit each IP to 10 login requests per window
    message: { code: 429, message: "Too many login attempts, please try again after 15 minutes" },
    standardHeaders: true,
    legacyHeaders: false,
})

app.use("/api/auth/login", loginLimiter)

// Mount routes
app.use("/api/auth", authRoutes)
app.use("/api", importRoutes) // Keep existing import routes
app.use("/api", appRoutes)    // Mount new business routes

AppDataSource.initialize().then(async () => {
    console.log("Database connected")
    WebSocketService.init(server)
    server.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`)
    })
}).catch(error => console.log(error))
// Trigger restart after truncation
