import dotenv from 'dotenv';
import path from 'path';

const envFile = process.env.ENV_FILE || '.env.local';
dotenv.config({ path: path.resolve(process.cwd(), envFile) });

import mongoose from 'mongoose';
import {
  Attribute,
  Category,
  Product,
  Order,
  FootwearType,
  GenderSize,
  Counter,
} from '../src/models';
import { calculateDerivedProductFields } from '../src/lib/derived';
import { generateSku } from '../src/lib/variants';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/cj-store';

function slugify(text: string): string {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-');
}

async function runMigration() {
  console.log('========================================================');
  console.log(`🚀 INICIANDO MIGRACIÓN MULTIPRODUCTO (${envFile})`);
  console.log('========================================================');

  await mongoose.connect(MONGODB_URI);
  console.log('⚡ Conectado a MongoDB');

  try {
    // -------------------------------------------------------------------------
    // 1. ATRIBUTOS (Attributes)
    // -------------------------------------------------------------------------
    console.log('\n📦 PASO 1: Creando o asegurando Atributos...');

    // 1.1 Talle Calzado
    const existingSizesDocs = await GenderSize.find({}).lean();
    const allSizesSet = new Set<number>();
    existingSizesDocs.forEach((d) => d.sizes.forEach((s) => allSizesSet.add(s)));

    // Fallback standard sizes if empty
    if (allSizesSet.size === 0) {
      for (let s = 34; s <= 45; s++) allSizesSet.add(s);
    }

    const sortedSizes = Array.from(allSizesSet).sort((a, b) => a - b);
    const sizeOptions = sortedSizes.map((s, idx) => ({
      value: String(s).replace('.', '_'),
      label: String(s),
      order: idx,
      active: true,
    }));

    await Attribute.findOneAndUpdate(
      { key: 'talle_calzado' },
      {
        $setOnInsert: {
          key: 'talle_calzado',
          label: 'Talle de Calzado',
          type: 'select',
          options: sizeOptions,
          filterable: true,
        },
      },
      { upsert: true, new: true }
    );
    console.log(`✓ Atributo 'talle_calzado' listo con ${sizeOptions.length} talles.`);

    // 1.2 Género
    const genderDocs = await GenderSize.find({}).lean();
    const genderNames = genderDocs.length > 0
      ? genderDocs.map((g) => g.gender)
      : ['Hombre', 'Mujer', 'Unisex', 'Niño'];

    const genderOptions = genderNames.map((g, idx) => ({
      value: slugify(g),
      label: g,
      order: idx,
      active: true,
    }));

    await Attribute.findOneAndUpdate(
      { key: 'genero' },
      {
        $setOnInsert: {
          key: 'genero',
          label: 'Género',
          type: 'select',
          options: genderOptions,
          filterable: true,
        },
      },
      { upsert: true, new: true }
    );
    console.log(`✓ Atributo 'genero' listo con ${genderOptions.length} opciones.`);

    // 1.3 Color
    await Attribute.findOneAndUpdate(
      { key: 'color' },
      {
        $setOnInsert: {
          key: 'color',
          label: 'Color',
          type: 'select',
          options: [
            { value: 'negro', label: 'Negro', order: 0, hex: '#000000', active: true },
            { value: 'blanco', label: 'Blanco', order: 1, hex: '#ffffff', active: true },
            { value: 'azul', label: 'Azul', order: 2, hex: '#0033aa', active: true },
            { value: 'rojo', label: 'Rojo', order: 3, hex: '#cc0000', active: true },
            { value: 'gris', label: 'Gris', order: 4, hex: '#888888', active: true },
          ],
          filterable: true,
        },
      },
      { upsert: true, new: true }
    );
    console.log(`✓ Atributo 'color' listo.`);

    // 1.4 Volumen (Perfumería)
    await Attribute.findOneAndUpdate(
      { key: 'volumen' },
      {
        $setOnInsert: {
          key: 'volumen',
          label: 'Volumen / Capacidad',
          type: 'select',
          unit: 'ml',
          options: [
            { value: '30ml', label: '30 ml', order: 0, active: true },
            { value: '50ml', label: '50 ml', order: 1, active: true },
            { value: '100ml', label: '100 ml', order: 2, active: true },
            { value: '200ml', label: '200 ml', order: 3, active: true },
          ],
          filterable: true,
        },
      },
      { upsert: true, new: true }
    );
    console.log(`✓ Atributo 'volumen' listo.`);

    // -------------------------------------------------------------------------
    // 2. CATEGORÍAS (Categories)
    // -------------------------------------------------------------------------
    console.log('\n📂 PASO 2: Creando árbol de Categorías...');

    // 2.1 Raíz Calzado
    const calzadoCat = await Category.findOneAndUpdate(
      { slug: 'calzado' },
      {
        $setOnInsert: {
          name: 'Calzado',
          slug: 'calzado',
          parentId: null,
          ancestors: [],
          variantAxes: ['talle_calzado'],
          specAttributes: [{ key: 'genero', required: false }],
          order: 1,
          active: true,
        },
      },
      { upsert: true, new: true }
    );

    // 2.2 Raíz Perfumería
    const perfumeriaCat = await Category.findOneAndUpdate(
      { slug: 'perfumeria' },
      {
        $setOnInsert: {
          name: 'Perfumería & Fragancias',
          slug: 'perfumeria',
          parentId: null,
          ancestors: [],
          variantAxes: ['volumen'],
          specAttributes: [{ key: 'genero', required: false }],
          order: 2,
          active: true,
        },
      },
      { upsert: true, new: true }
    );

    // 2.3 Raíz Indumentaria & Ropa
    const indumentariaCat = await Category.findOneAndUpdate(
      { slug: 'indumentaria' },
      {
        $setOnInsert: {
          name: 'Indumentaria',
          slug: 'indumentaria',
          parentId: null,
          ancestors: [],
          variantAxes: ['color'],
          imageAxis: 'color',
          specAttributes: [{ key: 'genero', required: false }],
          order: 3,
          active: true,
        },
      },
      { upsert: true, new: true }
    );

    // 2.4 Migrar FootwearTypes a subcategorías de Calzado
    const typeIdToCategoryId = new Map<string, mongoose.Types.ObjectId>();
    const footwearTypes = await FootwearType.find({}).lean();

    for (const ft of footwearTypes) {
      const catSlug = slugify(`calzado-${ft.name}`);
      const cat = await Category.findOneAndUpdate(
        { slug: catSlug },
        {
          $setOnInsert: {
            name: ft.name,
            slug: catSlug,
            parentId: calzadoCat._id,
            ancestors: [calzadoCat._id],
            variantAxes: ['talle_calzado'],
            specAttributes: [{ key: 'genero', required: false }],
            order: 0,
            active: true,
          },
        },
        { upsert: true, new: true }
      );
      typeIdToCategoryId.set(ft._id.toString(), cat._id as mongoose.Types.ObjectId);
    }
    console.log(`✓ Migradas ${footwearTypes.length} subcategorías bajo 'Calzado'.`);

    // -------------------------------------------------------------------------
    // 3. PRODUCTOS (Products)
    // -------------------------------------------------------------------------
    console.log('\n👟 PASO 3: Migrando productos a modelo multiproducto...');

    const products = await Product.find({});
    let migratedCount = 0;

    for (const prod of products) {
      let isUpdated = false;

      // 3.1 Slug
      if (!prod.slug) {
        prod.slug = slugify(`${prod.name}-${prod._id.toString().slice(-5)}`);
        isUpdated = true;
      }

      // 3.2 Category ID & Ancestors
      if (!prod.categoryId) {
        if (prod.typeId && typeIdToCategoryId.has(prod.typeId.toString())) {
          prod.categoryId = typeIdToCategoryId.get(prod.typeId.toString())!;
          prod.categoryAncestors = [calzadoCat._id as mongoose.Types.ObjectId];
        } else {
          // Default category: Perfumería if title contains fragrance keywords, else Calzado
          const lowerName = prod.name.toLowerCase();
          if (
            lowerName.includes('eau') ||
            lowerName.includes('perfume') ||
            lowerName.includes('parfum') ||
            lowerName.includes('fragancia') ||
            lowerName.includes('sauvage')
          ) {
            prod.categoryId = perfumeriaCat._id as mongoose.Types.ObjectId;
            prod.categoryAncestors = [];
          } else {
            prod.categoryId = calzadoCat._id as mongoose.Types.ObjectId;
            prod.categoryAncestors = [];
          }
        }
        isUpdated = true;
      }

      // 3.3 Specs (Gender)
      if (prod.gender && (!prod.specs || prod.specs.length === 0)) {
        prod.specs = [{ key: 'genero', value: prod.gender }];
        isUpdated = true;
      }

      // 3.4 Wholesale configuration
      if (!prod.wholesale || prod.wholesale.enabled === undefined) {
        prod.wholesale = {
          enabled: true,
          minQty: 5,
        };
        isUpdated = true;
      }

      // 3.5 Variants conversion
      if (!prod.variants || prod.variants.length === 0) {
        const variantsList: any[] = [];
        const baseRetail = Number(prod.retailPrice) || Number(prod.price) || 0;
        const baseWholesale = Number(prod.wholesalePrice) || undefined;

        if (prod.sizesStock && prod.sizesStock.length > 0) {
          // Convert from shoe sizes
          for (const s of prod.sizesStock) {
            const sizeVal = String(s.size).replace('.', '_');
            variantsList.push({
              sku: generateSku(prod.slug, [{ key: 'talle_calzado', value: sizeVal }]),
              options: [{ key: 'talle_calzado', value: sizeVal }],
              retailPrice: baseRetail,
              wholesalePrice: baseWholesale,
              stock: Math.max(0, s.stock || 0),
              active: true,
            });
          }
        } else if (prod.stock !== undefined) {
          // Product with single stock (simple variant)
          variantsList.push({
            sku: generateSku(prod.slug, []),
            options: [],
            retailPrice: baseRetail,
            wholesalePrice: baseWholesale,
            stock: Math.max(0, prod.stock || 0),
            active: true,
          });
        }

        if (variantsList.length > 0) {
          prod.variants = variantsList as any;
          isUpdated = true;
        }
      }

      // 3.6 Recalculate derived fields
      if (prod.variants && prod.variants.length > 0) {
        const derived = calculateDerivedProductFields(
          prod.variants,
          prod.wholesale?.enabled ?? true
        );
        prod.priceRange = derived.priceRange;
        prod.totalStock = derived.totalStock;
        prod.hasWholesale = derived.hasWholesale;
        isUpdated = true;
      }

      if (isUpdated) {
        await prod.save();
        migratedCount++;
      }
    }
    console.log(`✓ Verificados/migrados ${migratedCount} productos de un total de ${products.length}.`);

    // -------------------------------------------------------------------------
    // 4. PEDIDOS (Orders)
    // -------------------------------------------------------------------------
    console.log('\n📋 PASO 4: Adaptando historial de pedidos...');

    const orders = await Order.find({});
    let ordersUpdated = 0;

    for (const order of orders) {
      let orderChanged = false;
      for (const item of order.items) {
        if (!item.variantLabel && item.size) {
          item.variantLabel = `Talle ${item.size}`;
          orderChanged = true;
        }
      }
      if (orderChanged) {
        await order.save();
        ordersUpdated++;
      }
    }
    console.log(`✓ Actualizados ${ordersUpdated} pedidos con etiquetas legibles de variantes.`);

    // -------------------------------------------------------------------------
    // 5. CONTADOR DE PEDIDOS (Counter)
    // -------------------------------------------------------------------------
    console.log('\n🔢 PASO 5: Inicializando contador atómico de pedidos...');

    const existingCounter = await Counter.findOne({ name: 'orderNumber' });
    if (!existingCounter) {
      // Find highest orderNumber in DB
      let maxNum = 1000;
      for (const o of orders) {
        const n = parseInt(o.orderNumber, 10);
        if (!isNaN(n) && n > maxNum) {
          maxNum = n;
        }
      }

      await Counter.create({
        name: 'orderNumber',
        seq: maxNum,
      });
      console.log(`✓ Contador 'orderNumber' inicializado en: ${maxNum}.`);
    } else {
      console.log(`✓ Contador 'orderNumber' ya existe en secuencia: ${existingCounter.seq}.`);
    }

    console.log('\n========================================================');
    console.log('🎉 MIGRACIÓN MULTIPRODUCTO COMPLETADA CON ÉXITO');
    console.log('========================================================');
  } catch (error) {
    console.error('❌ Error durante la migración:', error);
    process.exit(1);
  } finally {
    await mongoose.disconnect();
    console.log('⚡ Conexión cerrada.');
  }
}

runMigration();
