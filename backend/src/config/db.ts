import mongoose from "mongoose";
import os from "os";
import path from "path";
import fs from "fs";
import { env } from "./env";
import { LeadAgentBinding } from "../models/LeadAgentBinding";

/**
 * Connects to MONGODB_URI. In development, if Atlas refuses the connection (typically the IP
 * allowlist), fall back to an in-memory MongoDB so the app stays usable – data is NOT persisted.
 */
export async function connectDatabase(): Promise<{ mode: "atlas" | "memory" }> {
  mongoose.set("strictQuery", true);
  try {
    await mongoose.connect(env.MONGODB_URI, { dbName: env.DB_NAME, maxPoolSize: 20, serverSelectionTimeoutMS: 10000 });
    console.log(`[db] connected to MongoDB (db: ${env.DB_NAME})`);
    await LeadAgentBinding.syncIndexes().catch((e) => console.warn("[db] syncIndexes(LeadAgentBinding):", (e as Error).message));
    return { mode: "atlas" };
  } catch (err) {
    const msg = (err as Error).message || String(err);
    if (env.NODE_ENV === "production" || process.env.DB_MEMORY_FALLBACK === "false") throw err;
    console.error(`\n[db] ✗ Could not connect to MongoDB: ${msg.split("\n")[0]}`);
    console.error("[db]   If this is Atlas, add this machine's public IP under Network Access → IP Access List.");
    const dbPath = process.env.LOCAL_MONGO_PATH || path.join(os.homedir(), ".matrix", "mongo-data");
    fs.mkdirSync(dbPath, { recursive: true });
    console.error(`[db]   Falling back to a LOCAL MongoDB for development (data kept in ${dbPath}).\n`);
    const { MongoMemoryServer } = await import("mongodb-memory-server");
    const mem = await MongoMemoryServer.create({ instance: { dbName: env.DB_NAME, dbPath, storageEngine: "wiredTiger" } });
    await mongoose.connect(mem.getUri(), { dbName: env.DB_NAME });
    console.log(`[db] connected to local MongoDB (db: ${env.DB_NAME}, data: ${dbPath})`);
    return { mode: "memory" };
  }
}
