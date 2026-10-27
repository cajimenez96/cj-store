import dotenv from "dotenv";
import path from "path";

// Load environment variables (supports ENV_FILE=.env.prod or defaults to .env.local)
const envFile = process.env.ENV_FILE || ".env.local";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { User } from "../src/models";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/cj-store";

const ADMIN_USERNAME = process.env.SEED_ADMIN_USERNAME || "superadmin";
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL || "admin@cjstore.com";
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || "AdminPassword123!";

async function runSeed() {
  try {
    console.log(`🚀 Seed (${envFile})`);
    console.log(
      "🔄 Conectando a MongoDB en:",
      MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@"),
    );
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Conexión establecida.");

    const existing = await User.findOne({ username: ADMIN_USERNAME });
    if (existing) {
      console.log(`ℹ️  El usuario "${ADMIN_USERNAME}" ya existe. No se modificó nada.`);
      return;
    }

    const passwordHash = await bcrypt.hash(ADMIN_PASSWORD, 10);
    await User.create({
      username: ADMIN_USERNAME,
      name: "Super Administrador",
      email: ADMIN_EMAIL,
      passwordHash,
      role: "superadmin",
      active: true,
    });
    console.log(`👤 Superadmin creado: ${ADMIN_USERNAME}`);

    if (!process.env.SEED_ADMIN_PASSWORD) {
      console.warn(
        "⚠️  Se usó la contraseña por defecto. Definí SEED_ADMIN_PASSWORD o cambiala tras el primer login.",
      );
    }
  } catch (error) {
    console.error("❌ Error durante la ejecución del seed:", error);
    process.exitCode = 1;
  } finally {
    await mongoose.connection.close();
    console.log("🔌 Conexión cerrada.");
  }
}

runSeed();
