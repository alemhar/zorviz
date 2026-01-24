
import { db } from "../lib/db";
import { users, appConfig } from "@zorviz/db";
import { eq } from "drizzle-orm";

export const seedDevData = async () => {
    // 1. Check if AppConfig exists
    const config = await db.select().from(appConfig).limit(1);

    if (config.length === 0) {
        console.log("Seeding App Config...");
        await db.insert(appConfig).values({
            id: "default",
            tenantId: "dev-tenant-id",
            branchId: "main-branch",
            deviceName: "Dev PC",
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }

    // 2. Check if Admin User exists
    const admin = await db.select().from(users).where(eq(users.email, "admin@zorviz.com")).limit(1);

    if (admin.length === 0) {
        console.log("Seeding Admin User...");
        await db.insert(users).values({
            id: globalThis.crypto.randomUUID(),
            email: "admin@zorviz.com",
            role: "admin",
            passwordHash: "mock-hash", // No real auth for dev yet
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }

    // 3. Seed Mechanic User
    const mechanic = await db.select().from(users).where(eq(users.email, "mechanic@zorviz.com")).limit(1);

    if (mechanic.length === 0) {
        console.log("Seeding Mechanic User...");
        await db.insert(users).values({
            id: globalThis.crypto.randomUUID(),
            email: "mechanic@zorviz.com",
            role: "mechanic",
            passwordHash: "mock-hash",
            createdAt: new Date(),
            updatedAt: new Date()
        });
    }
};
