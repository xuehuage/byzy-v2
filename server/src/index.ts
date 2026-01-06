import "reflect-metadata"
import express from "express"
import cors from "cors"
import dotenv from "dotenv"
import { AppDataSource } from "./data-source"
import authRoutes from "./routes/authRoutes"
import importRoutes from "./routes/importRoutes"
import appRoutes from "./routes"
import { rateLimit } from "express-rate-limit"

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3000

app.use(cors())
app.use(express.json())

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
    app.listen(PORT, () => {
        console.log(`Server running on port ${PORT}`)
    })
}).catch(error => console.log(error))
