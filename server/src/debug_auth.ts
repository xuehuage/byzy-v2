import { AppDataSource } from "./data-source"
import { AdminUser } from "./entity/AdminUser"

async function test() {
    console.log("Initializing DataSource...")
    try {
        await AppDataSource.initialize()
        console.log("DataSource initialized.")

        const userRepo = AppDataSource.getRepository(AdminUser)
        console.log("Fetching users...")
        const users = await userRepo.find()
        console.log("Users found:", JSON.stringify(users, null, 2))

    } catch (e) {
        console.error("Error encountered:", e)
    } finally {
        if (AppDataSource.isInitialized) {
            await AppDataSource.destroy()
        }
    }
}

test()
