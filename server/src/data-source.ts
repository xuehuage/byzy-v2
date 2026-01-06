import "reflect-metadata"
import { DataSource } from "typeorm"
import { AdminUser } from "./entity/AdminUser"
import { School } from "./entity/School"
import { Product } from "./entity/Product"
import { Class } from "./entity/Class"
import { Student } from "./entity/Student"
import { Order } from "./entity/Order"
import { OrderItem } from "./entity/OrderItem"
import dotenv from "dotenv"

dotenv.config()

export const AppDataSource = new DataSource({
    type: "mysql",
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306"),
    username: process.env.DB_USERNAME || "root",
    password: process.env.DB_PASSWORD || "",
    database: process.env.DB_NAME || "byzy_v2",
    synchronize: false,
    logging: true,
    entities: [AdminUser, School, Product, Class, Student, Order, OrderItem],
    migrations: [],
    subscribers: [],
})
