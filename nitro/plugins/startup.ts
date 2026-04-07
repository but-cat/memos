import { defineNitroPlugin } from "nitropack/runtime";
import { initializeDB } from "../store/db/db";

export default defineNitroPlugin(async (_nitroApp) => {
  try {
    await initializeDB();
    console.log("✅ Database initialized");
  } catch (error) {
    console.error("❌ Failed to initialize database:", error);
  }
});
