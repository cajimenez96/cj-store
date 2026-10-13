import dotenv from "dotenv";
import path from "path";

// Load environment variables (supports ENV_FILE=.env.prod or defaults to .env.local)
const envFile = process.env.ENV_FILE || ".env.local";
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import {
  Brand,
  Product,
  Promotion,
  Order,
  SalesRecord,
  Expense,
  Settings,
  User,
} from "../src/models";

const MONGODB_URI =
  process.env.MONGODB_URI || "mongodb://localhost:27017/cj-store";

async function runSeed() {
  try {
    console.log("====================================================");
    console.log(`🚀 INICIANDO RESET & SEED (${envFile})`);
    console.log("====================================================");
    console.log(
      "🔄 Conectando a MongoDB en:",
      MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, "//$1:****@"),
    );
    await mongoose.connect(MONGODB_URI);
    console.log("✅ Conexión establecida con éxito.\n");

    // 1. Limpieza total de todas las colecciones
    console.log("🧹 [1/4] Vaciando colecciones...");
    await Promise.all([
      User.deleteMany({}),
      Order.deleteMany({}),
      SalesRecord.deleteMany({}),
      Expense.deleteMany({}),
      Product.deleteMany({}),
      Promotion.deleteMany({}),
      Brand.deleteMany({}),
      Settings.deleteMany({}),
    ]);
    console.log(
      "   ✓ Usuarios y Transaccionales (Users, Orders, Sales, Expenses) -> 0",
    );
    console.log(
      "   ✓ Catálogo y Marketing (Products, Promotions)      -> 0 registros",
    );
    console.log(
      "   ✓ Maestras y Ajustes (Brands, Types, Sizes, Settings) -> Limpias\n",
    );

    // 6. Crear Usuario Superadmin Inicial
    console.log("\n👤 Creando usuario Superadmin inicial...");
    const superadminPassword = "AdminPassword123!";
    const passwordHash = await bcrypt.hash(superadminPassword, 10);
    await User.create({
      username: "superadmin",
      name: "Super Administrador",
      email: "admin@cjstore.com",
      passwordHash,
      role: "superadmin",
      active: true,
    });
    console.log("   ✓ Superadmin creado con éxito");
    console.log("     ➜ Usuario:    superadmin");
    console.log("     ➜ Contraseña: AdminPassword123!");

    console.log("\n====================================================");
    console.log("🎉 BASE DE DATOS RESETEADA Y LISTA");
    console.log("====================================================");
    console.log("📊 Resumen del estado actual:");
    console.log("   - Superadmin:       1 (superadmin / AdminPassword123!)");
    console.log("   - Productos:        0 (listo para carga admin)");
    console.log("   - Pedidos:          0");
    console.log("====================================================\n");
  } catch (error) {
    console.error("❌ Error durante la ejecución del seed:", error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log("🔌 Conexión cerrada.");
  }
}

runSeed();
