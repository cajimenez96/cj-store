import dotenv from 'dotenv';
import path from 'path';

// Load environment variables (supports ENV_FILE=.env.prod or defaults to .env.local)
const envFile = process.env.ENV_FILE || '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import {
  Brand,
  FootwearType,
  Product,
  Promotion,
  Order,
  SalesRecord,
  Expense,
  GenderSize,
  Settings,
  User,
} from '../src/models';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cj-store';

async function runSeed() {
  try {
    console.log('====================================================');
    console.log(`🚀 INICIANDO RESET & SEED (${envFile})`);
    console.log('====================================================');
    console.log('🔄 Conectando a MongoDB en:', MONGODB_URI.replace(/\/\/([^:]+):([^@]+)@/, '//$1:****@'));
    await mongoose.connect(MONGODB_URI);
    console.log('✅ Conexión establecida con éxito.\n');

    // 1. Limpieza total de todas las colecciones
    console.log('🧹 [1/4] Vaciando colecciones...');
    await Promise.all([
      User.deleteMany({}),
      Order.deleteMany({}),
      SalesRecord.deleteMany({}),
      Expense.deleteMany({}),
      Product.deleteMany({}),
      Promotion.deleteMany({}),
      Brand.deleteMany({}),
      FootwearType.deleteMany({}),
      GenderSize.deleteMany({}),
      Settings.deleteMany({}),
    ]);
    console.log('   ✓ Usuarios y Transaccionales (Users, Orders, Sales, Expenses) -> 0');
    console.log('   ✓ Catálogo y Marketing (Products, Promotions)      -> 0 registros');
    console.log('   ✓ Maestras y Ajustes (Brands, Types, Sizes, Settings) -> Limpias\n');

    // 2. Crear Marcas Maestras
    console.log('🏷️  [2/5] Creando Marcas Base...');
    const brandsData = [
      { name: 'Dior' },
      { name: 'Chanel' },
      { name: 'Tom Ford' },
      { name: 'Versace' },
      { name: 'Carolina Herrera' },
      { name: 'Paco Rabanne' },
      { name: 'Armani' },
      { name: 'Ray-Ban' },
      { name: 'Oakley' },
      { name: 'Prada' },
    ];
    const createdBrands = await Brand.insertMany(brandsData);
    console.log(`   ✓ ${createdBrands.length} marcas creadas: ${brandsData.map((b) => b.name).join(', ')}\n`);

    // 3. Crear Categorías / Rubros
    console.log('🏷️  [3/5] Creando Categorías Base...');
    const typesData = [
      { name: 'Perfume Hombre', description: 'Fragancias masculinas Eau de Parfum y Eau de Toilette' },
      { name: 'Perfume Mujer', description: 'Fragancias femeninas florales, orientales y frutales' },
      { name: 'Perfume Unisex', description: 'Fragancias neutrales de autor y nicho' },
      { name: 'Anteojos de Sol', description: 'Gafas de sol con protección UV' },
      { name: 'Accesorios', description: 'Accesorios varios de moda' },
    ];
    const createdTypes = await FootwearType.insertMany(typesData);
    console.log(`   ✓ ${createdTypes.length} categorías creadas: ${typesData.map((t) => t.name).join(', ')}\n`);

    // 4. Crear Escalas de Talles por Género (opcional para indumentaria/calzado)
    console.log('📏 [4/5] Inicializando Escalas de Talles y Ajustes...');
    const genderSizesData = [
      { gender: 'Hombre', sizes: [36, 37, 38, 39, 40, 41, 42, 43, 44, 45] },
      { gender: 'Mujer', sizes: [33, 34, 35, 36, 37, 38, 39, 40, 41, 42] },
      { gender: 'Niño', sizes: [25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35] },
      { gender: 'Unisex', sizes: [36, 37, 38, 39, 40, 41, 42, 43, 44, 45] },
    ];
    await GenderSize.insertMany(genderSizesData);
    console.log('   ✓ Escalas de talles creadas');

    // 5. Crear Configuración General Inicial
    await Settings.create({
      storeName: 'The Point',
      storePhone: '+5491100000000',
      storeEmail: 'contacto@thepoint.com',
      businessHours: 'Lun a Sáb: 9:00 a 20:00 hs',
      whatsappInquiryMessage: 'Hola! Tengo una consulta sobre una fragancia',
      instagramUrl: '',
      facebookUrl: '',
      metaTitle: 'The Point | Perfumes Importados & Fragancias Exclusivas',
      metaDescription: 'Catálogo exclusivo de perfumes importados y fragancias de autor en The Point. Comprá online con atención personalizada por WhatsApp y envíos a todo el país.',
      metaKeywords: 'perfumes, fragancias, perfumes importados, the point, decants, hombre, mujer, unisex',
      footerDescription: 'Perfumería de lujo y fragancias de autor. Seleccioná tus aromas favoritos y completá tu pedido de forma fácil y directa vía WhatsApp.',
      bankAlias: 'THE.POINT',
      bankCbu: '0000003100010000000000',
      bankHolder: 'The Point',
      bankCuit: '20-00000000-9',
      bankName: 'Banco Galicia',
      minStockAlert: 3,
      wholesaleMinPairs: 5,
      shippingInfo: 'Envíos a todo el país en 24/48hs',
    });
    console.log('   ✓ Ajustes de la tienda inicializados (The Point)');

    // 6. Crear Usuario Superadmin Inicial
    console.log('\n👤 [5/5] Creando usuario Superadmin inicial...');
    const superadminPassword = 'AdminPassword123!';
    const passwordHash = await bcrypt.hash(superadminPassword, 10);
    await User.create({
      username: 'superadmin',
      name: 'Super Administrador',
      email: 'admin@cjstore.com',
      passwordHash,
      role: 'superadmin',
      active: true,
    });
    console.log('   ✓ Superadmin creado con éxito');
    console.log('     ➜ Usuario:    superadmin');
    console.log('     ➜ Contraseña: AdminPassword123!');

    console.log('\n====================================================');
    console.log('🎉 BASE DE DATOS RESETEADA Y LISTA');
    console.log('====================================================');
    console.log('📊 Resumen del estado actual:');
    console.log('   - Superadmin:       1 (superadmin / AdminPassword123!)');
    console.log('   - Marcas:          ', createdBrands.length);
    console.log('   - Categorías:       ', createdTypes.length);
    console.log('   - Productos:        0 (listo para carga admin)');
    console.log('   - Pedidos:          0');
    console.log('====================================================\n');
  } catch (error) {
    console.error('❌ Error durante la ejecución del seed:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('🔌 Conexión cerrada.');
  }
}

runSeed();
