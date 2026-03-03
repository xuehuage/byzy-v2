import "reflect-metadata"
import { DataSource } from "typeorm"
import { AdminUser } from "./entity/AdminUser"
import { School } from "./entity/School"
import { Product } from "./entity/Product"
import { Class } from "./entity/Class"
import { Student } from "./entity/Student"
import { Order } from "./entity/Order"
import { OrderItem } from "./entity/OrderItem"
import { Terminal } from "./entity/Terminal"
import dotenv from "dotenv"
import bcrypt from "bcrypt"

dotenv.config()

const SetupDataSource = new DataSource({
    type: "mysql",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306"),
    username: process.env.DB_USERNAME || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "byzy_v2",
    synchronize: false, // DISABLE SYNC to avoid conflicts
    logging: true,
    entities: [AdminUser, School, Product, Class, Student, Order, OrderItem, Terminal],
    migrations: [],
    subscribers: [],
})

async function setup() {
    try {
        await SetupDataSource.initialize()
        console.log("Database connected.")

        // Manually create admin_users table if not exists
        console.log("Ensuring admin_users table exists...")
        await SetupDataSource.query(`
            CREATE TABLE IF NOT EXISTS \`admin_users\` (
                \`id\` int NOT NULL AUTO_INCREMENT, 
                \`username\` varchar(255) NOT NULL, 
                \`password_hash\` varchar(255) NOT NULL, 
                \`realname\` varchar(255) NOT NULL, 
                \`login_retries\` int NOT NULL DEFAULT '0', 
                \`locked_until\` timestamp NULL, 
                \`two_factor_secret\` varchar(255) NULL, 
                \`created_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6), 
                \`updated_at\` datetime(6) NOT NULL DEFAULT CURRENT_TIMESTAMP(6) ON UPDATE CURRENT_TIMESTAMP(6), 
                PRIMARY KEY (\`id\`)
            ) ENGINE=InnoDB
        `)

        const userRepo = SetupDataSource.getRepository(AdminUser)
        const admin = await userRepo.findOne({ where: { username: "admin" } })

        if (!admin) {
            console.log("Creating default admin user...")
            // We use query insert to be safe if entity mismatch, but entity should be fine now table matches.
            // Using Repository save
            const newAdmin = new AdminUser()
            newAdmin.username = "admin"
            newAdmin.realname = "Administrator"
            newAdmin.passwordHash = await bcrypt.hash("admin123", 10)
            newAdmin.loginRetries = 0
            await userRepo.save(newAdmin)
            console.log("Admin user created: admin / admin123")
        } else {
            console.log("Admin user already exists.")
        }

    } catch (error) {
        console.error("Setup failed:", error)
    } finally {
        if (SetupDataSource.isInitialized) {
            await SetupDataSource.destroy()
        }
    }
}

setup()
