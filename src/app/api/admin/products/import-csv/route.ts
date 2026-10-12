import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Product, { GenderType } from '@/models/Product';
import Brand from '@/models/Brand';
import FootwearType from '@/models/FootwearType';

interface CSVRow {
  nombre: string;
  marca: string;
  tipo: string;
  genero: string;
  precio: number;
  talle: number;
  stock: number;
  imagenUrl?: string;
  descripcion?: string;
}

export async function POST(req: NextRequest) {
  try {
    await connectToDatabase();
    const { rows } = await req.json();

    if (!rows || !Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'Se requiere una lista válida de filas CSV' },
        { status: 400 }
      );
    }

    let createdCount = 0;
    let updatedCount = 0;
    const errors: string[] = [];

    for (let index = 0; index < rows.length; index++) {
      const row: CSVRow = rows[index];
      const lineNum = index + 1;

      if (!row.nombre || !row.marca || !row.tipo || !row.genero || !row.talle || row.stock === undefined) {
        errors.push(`Fila ${lineNum}: Faltan campos obligatorios (nombre, marca, tipo, genero, talle, stock).`);
        continue;
      }

      const nombre = row.nombre.trim();
      const marcaName = row.marca.trim();
      const tipoName = row.tipo.trim();
      const rawGender = row.genero.trim();
      const precio = Math.max(0, Number(row.precio) || 0);
      const talle = Number(row.talle);
      const stock = Math.max(0, Number(row.stock) || 0);

      // Validate Gender
      const validGenders: GenderType[] = ['Hombre', 'Mujer', 'Niño', 'Unisex'];
      const genderMatch = validGenders.find(
        (g) => g.toLowerCase() === rawGender.toLowerCase()
      );

      if (!genderMatch) {
        errors.push(`Fila ${lineNum}: Género "${rawGender}" no es válido. Usar Hombre, Mujer, Niño o Unisex.`);
        continue;
      }

      // 1. Find or Create Brand
      let brandDoc = await Brand.findOne({
        name: { $regex: new RegExp(`^${marcaName}$`, 'i') },
      });
      if (!brandDoc) {
        brandDoc = await Brand.create({ name: marcaName });
      }

      // 2. Find or Create FootwearType
      let typeDoc = await FootwearType.findOne({
        name: { $regex: new RegExp(`^${tipoName}$`, 'i') },
      });
      if (!typeDoc) {
        typeDoc = await FootwearType.create({
          name: tipoName,
          description: `Tipo importado masivamente: ${tipoName}`,
        });
      }

      // 3. Find or Create Product
      let productDoc = await Product.findOne({
        name: { $regex: new RegExp(`^${nombre}$`, 'i') },
        brandId: brandDoc._id,
      });

      if (!productDoc) {
        // Create Product
        const initialImages = row.imagenUrl
          ? [{ url: row.imagenUrl.trim(), isPrincipal: true, position: 1 }]
          : [{ url: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff', isPrincipal: true, position: 1 }];

        const initialSizes = [{ size: talle, stock }];

        await Product.create({
          name: nombre,
          description: row.descripcion ? row.descripcion.trim() : `Modelo ${nombre} de ${marcaName}`,
          price: precio,
          brandId: brandDoc._id,
          typeId: typeDoc._id,
          gender: genderMatch,
          active: true,
          images: initialImages,
          sizesStock: initialSizes,
        });

        createdCount++;
      } else {
        // Update existing Product stock and price
        const currentSizes = productDoc.sizesStock || [];
        const sizeMap = new Map(currentSizes.map((s) => [s.size, s.stock]));
        sizeMap.set(talle, stock); // Set stock for specific size

        const updatedSizesStock = Array.from(sizeMap.entries()).map(([sz, st]) => ({
          size: sz,
          stock: st,
        }));

        productDoc.sizesStock = updatedSizesStock;
        if (precio > 0) productDoc.price = precio;

        await productDoc.save();
        updatedCount++;
      }
    }

    return NextResponse.json({
      ok: true,
      summary: {
        totalRows: rows.length,
        createdCount,
        updatedCount,
        errorCount: errors.length,
        errors,
      },
    });
  } catch (error) {
    console.error('Error al procesar importación CSV:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: 'Error procesando archivo CSV' },
      { status: 500 }
    );
  }
}
