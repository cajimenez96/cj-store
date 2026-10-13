import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Order from '@/models/Order';
import Product from '@/models/Product';
import SalesRecord from '@/models/SalesRecord';
import mongoose from 'mongoose';

const WHOLESALE_THRESHOLD = 5;

/**
 * POST /api/admin/sales/create-direct
 * Creates a direct sale from the admin POS panel.
 * - Saved directly as 'autorizado' with origin 'admin_direct'
 * - Immediately decrements stock (real unified inventory)
 * - Supports both Replica Set (production with transactions) and Standalone (local dev)
 */
export async function POST(req: NextRequest) {
  await connectToDatabase();

  let session: mongoose.ClientSession | null = null;
  let useTransaction = false;

  const client = mongoose.connection?.getClient() as any;
  const topologyType = client?.topology?.description?.type;
  const isReplicaSet = typeof topologyType === 'string' && topologyType.includes('ReplicaSet');

  if (isReplicaSet) {
    try {
      session = await mongoose.startSession();
      session.startTransaction();
      useTransaction = true;
    } catch {
      if (session) {
        await session.endSession().catch(() => {});
      }
      session = null;
      useTransaction = false;
    }
  }

  const decrementedItems: Array<{ productId: any; variantId?: any; variantName?: string; qty: number }> = [];

  try {
    const body = await req.json();
    const { guest, items, paymentMethod, discountNote, discount } = body;

    // 1. Validate guest data
    if (!guest || !guest.name || !guest.lastName || !guest.phone) {
      if (session && useTransaction) {
        await session.abortTransaction();
        session.endSession();
      }
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'Los datos del cliente son obligatorios.' },
        { status: 400 }
      );
    }

    if (!items || !Array.isArray(items) || items.length === 0) {
      if (session && useTransaction) {
        await session.abortTransaction();
        session.endSession();
      }
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'La venta debe incluir al menos un producto.' },
        { status: 400 }
      );
    }

    // 2. Server-side wholesale threshold evaluation
    const totalPairs = items.reduce((sum: number, item: { qty: number }) => {
      return sum + Math.max(1, Number(item.qty));
    }, 0);
    const isWholesale = totalPairs >= WHOLESALE_THRESHOLD;

    // 3. Build validated items resolving prices from DB
    const validatedItems = [];
    let calculatedSubtotal = 0;

    for (const item of items) {
      const productQuery = Product.findById(item.productId);
      const product = session && useTransaction
        ? await productQuery.session(session)
        : await productQuery;

      if (!product || !product.active) {
        if (session && useTransaction) {
          await session.abortTransaction();
          session.endSession();
        }
        return NextResponse.json(
          {
            ok: false,
            error: 'PRODUCT_NOT_FOUND',
            message: `Producto con ID "${item.productId}" no disponible.`,
          },
          { status: 400 }
        );
      }

      // Verify stock availability
      let matchedVariant: any = null;
      let availableStock = 0;
      let label = '';

      if (item.variantId && product.variants && product.variants.length > 0) {
        matchedVariant = product.variants.find((v: any) => v._id?.toString() === item.variantId?.toString());
        availableStock = matchedVariant?.stock ?? 0;
        label = item.variantLabel || `Variante ${item.variantId}`;
      } else if (item.variantName && product.variants && product.variants.length > 0) {
        matchedVariant = product.variants.find((v: any) => v.name === item.variantName);
        availableStock = matchedVariant?.stock ?? 0;
        label = `Variante ${item.variantName}`;
      } else {
        availableStock = product.stock ?? 0;
        label = 'Stock general';
      }
      const itemQty = Math.max(1, Number(item.qty));

      if (availableStock < itemQty) {
        if (session && useTransaction) {
          await session.abortTransaction();
          session.endSession();
        }
        return NextResponse.json(
          {
            ok: false,
            error: 'INSUFFICIENT_STOCK',
            message: `Stock insuficiente para "${product.name}" (${label}). Disponible: ${availableStock}, Requerido: ${itemQty}.`,
          },
          { status: 409 }
        );
      }

      // Use custom price if admin explicitly set it, otherwise resolve from catalog / variant
      let unitPrice: number;
      let appliedPriceType: 'retail' | 'wholesale' | 'custom';

      const vRetail = Number(matchedVariant?.retailPrice ?? product.retailPrice ?? product.price ?? 0);
      const vWholesale = Number(matchedVariant?.wholesalePrice ?? product.wholesalePrice ?? vRetail);

      if (item.unitPrice !== undefined && item.unitPrice !== null) {
        unitPrice = Number(item.unitPrice);
        appliedPriceType = 'custom';
      } else if (isWholesale) {
        unitPrice = vWholesale > 0 ? vWholesale : vRetail;
        appliedPriceType = 'wholesale';
      } else {
        unitPrice = vRetail;
        appliedPriceType = 'retail';
      }

      const itemSubtotal = unitPrice * itemQty;
      calculatedSubtotal += itemSubtotal;

      const principalImage =
        product.images?.find((img: any) => img.isPrincipal)?.url || product.images?.[0]?.url || '';

      validatedItems.push({
        productId: product._id,
        variantId: matchedVariant?._id,
        sku: matchedVariant?.sku || item.sku,
        name: product.name,
        image: principalImage,
        variantLabel: item.variantLabel || item.variantName,
        variantName: item.variantName,
        qty: itemQty,
        appliedPriceType,
        unitPrice,
        subtotal: itemSubtotal,
      });
    }

    // 4. Atomically decrement stock for all items
    for (const item of validatedItems) {
      const updateFilter = item.variantId
        ? { _id: item.productId, 'variants._id': item.variantId }
        : item.variantName
        ? { _id: item.productId, 'variants.name': item.variantName }
        : { _id: item.productId };

      const updateOp = (item.variantId || item.variantName)
        ? { $inc: { 'variants.$.stock': -item.qty } }
        : { $inc: { stock: -item.qty } };

      if (session && useTransaction) {
        await Product.updateOne(updateFilter, updateOp, { session });
      } else {
        await Product.updateOne(updateFilter, updateOp);
      }
      decrementedItems.push({
        productId: item.productId,
        variantId: item.variantId,
        variantName: item.variantName,
        qty: item.qty,
      });
    }

    // 5. Generate order number
    const currentYear = new Date().getFullYear();
    const countQuery = Order.countDocuments();
    const count = session && useTransaction
      ? await countQuery.session(session)
      : await countQuery;
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = `PED-${currentYear}-${(count + 1).toString().padStart(4, '0')}${randomSuffix.toString().slice(-2)}`;

    const appliedDiscount = Math.max(0, Number(discount ?? 0));
    const total = Math.max(0, calculatedSubtotal - appliedDiscount);

    // 6. Create order directly as 'autorizado'
    const orderPayload = {
      orderNumber,
      origin: 'admin_direct' as const,
      guest: {
        name: guest.name.trim(),
        lastName: guest.lastName.trim(),
        phone: guest.phone.trim(),
      },
      items: validatedItems,
      subtotal: calculatedSubtotal,
      discount: appliedDiscount,
      total,
      paymentMethod: ['transferencia', 'efectivo', 'tarjeta', 'otro'].includes(paymentMethod)
        ? paymentMethod
        : 'efectivo',
      status: 'autorizado' as const,
      notes: discountNote ? discountNote.trim() : '',
    };

    const newOrder = session && useTransaction
      ? (await Order.create([orderPayload], { session }))[0]
      : await Order.create(orderPayload);

    // 7. Create SalesRecord immediately
    const salesRecordPayload = {
      orderId: newOrder._id,
      orderNumber: newOrder.orderNumber,
      confirmationDate: new Date(),
      recordedPaymentMethod: newOrder.paymentMethod,
      appliedDiscountNote: discountNote ?? '',
      finalTotal: total,
    };

    const salesRecord = session && useTransaction
      ? (await SalesRecord.create([salesRecordPayload], { session }))[0]
      : await SalesRecord.create(salesRecordPayload);

    if (session && useTransaction) {
      await session.commitTransaction();
      session.endSession();
    }

    return NextResponse.json(
      {
        ok: true,
        message: 'Venta directa registrada y stock actualizado.',
        orderId: newOrder._id.toString(),
        orderNumber: newOrder.orderNumber,
        salesRecordId: salesRecord._id.toString(),
        total,
      },
      { status: 201 }
    );
  } catch (error: any) {
    if (session && useTransaction) {
      await session.abortTransaction();
      session.endSession();
    } else if (decrementedItems.length > 0) {
      // Manual rollback in non-replica set environment
      for (const item of decrementedItems) {
        if (item.variantId) {
          await Product.updateOne(
            { _id: item.productId, 'variants._id': item.variantId },
            { $inc: { 'variants.$.stock': item.qty } }
          ).catch(() => {});
        } else if (item.variantName) {
          await Product.updateOne(
            { _id: item.productId, 'variants.name': item.variantName },
            { $inc: { 'variants.$.stock': item.qty } }
          ).catch(() => {});
        } else {
          await Product.updateOne(
            { _id: item.productId },
            { $inc: { stock: item.qty } }
          ).catch(() => {});
        }
      }
    }

    console.error('Error al registrar venta directa:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: error?.message || 'Error al registrar la venta directa.' },
      { status: 500 }
    );
  }
}
