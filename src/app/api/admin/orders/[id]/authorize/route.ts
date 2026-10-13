import { NextRequest, NextResponse } from 'next/server';
import { connectToDatabase } from '@/lib/db';
import Order from '@/models/Order';
import Product from '@/models/Product';
import SalesRecord from '@/models/SalesRecord';
import mongoose from 'mongoose';

/**
 * POST /api/admin/orders/:id/authorize
 * Authorizes a pending order:
 * 1. Verifies stock availability for each item+size
 * 2. Atomically decrements stock (supports Replica Set transactions & Standalone local)
 * 3. Transitions order status to 'autorizado'
 * 4. Creates a SalesRecord
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
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

  const decrementedItems: Array<{ productId: any; variantId?: any; size?: number; variantName?: string; qty: number }> = [];

  try {
    const { id } = await params;
    const body = await req.json();
    const { recordedPaymentMethod, discountNote, finalTotal } = body;

    if (!recordedPaymentMethod) {
      if (session && useTransaction) {
        await session.abortTransaction();
        session.endSession();
      }
      return NextResponse.json(
        { ok: false, error: 'BAD_REQUEST', message: 'El medio de pago registrado es obligatorio.' },
        { status: 400 }
      );
    }

    const orderQuery = Order.findById(id);
    const order = session && useTransaction
      ? await orderQuery.session(session)
      : await orderQuery;

    if (!order) {
      if (session && useTransaction) {
        await session.abortTransaction();
        session.endSession();
      }
      return NextResponse.json(
        { ok: false, error: 'NOT_FOUND', message: 'Solicitud no encontrada.' },
        { status: 404 }
      );
    }

    if (order.status !== 'pendiente') {
      if (session && useTransaction) {
        await session.abortTransaction();
        session.endSession();
      }
      return NextResponse.json(
        {
          ok: false,
          error: 'INVALID_STATUS',
          message: `Solo se pueden autorizar órdenes en estado "pendiente". Estado actual: "${order.status}".`,
        },
        { status: 409 }
      );
    }

    // 1. Verify stock availability for all items before any write
    for (const item of order.items) {
      const prodQuery = Product.findById(item.productId);
      const product = session && useTransaction
        ? await prodQuery.session(session)
        : await prodQuery;

      if (!product) {
        if (session && useTransaction) {
          await session.abortTransaction();
          session.endSession();
        }
        return NextResponse.json(
          {
            ok: false,
            error: 'PRODUCT_NOT_FOUND',
            message: `Producto "${item.name}" ya no existe en el catálogo.`,
          },
          { status: 409 }
        );
      }

      let availableStock = 0;
      let label = '';
      if (item.variantId && product.variants && product.variants.length > 0) {
        const variantEntry = product.variants.find((v: any) => v._id?.toString() === item.variantId?.toString());
        availableStock = variantEntry?.stock ?? 0;
        label = item.variantLabel || `Variante ${item.variantId}`;
      } else if (item.variantName && product.variants && product.variants.length > 0) {
        const variantEntry = product.variants.find((v) => v.name === item.variantName);
        availableStock = variantEntry?.stock ?? 0;
        label = `Variante ${item.variantName}`;
      } else if (item.size !== undefined && product.sizesStock && product.sizesStock.length > 0) {
        const sizeEntry = product.sizesStock.find((s) => s.size === item.size);
        availableStock = sizeEntry?.stock ?? 0;
        label = `Talle ${item.size}`;
      } else {
        availableStock = product.stock ?? 0;
        label = 'Stock general';
      }

      if (availableStock < item.qty) {
        if (session && useTransaction) {
          await session.abortTransaction();
          session.endSession();
        }
        return NextResponse.json(
          {
            ok: false,
            error: 'INSUFFICIENT_STOCK',
            message: `Stock insuficiente para "${item.name}" (${label}). Disponible: ${availableStock}, Requerido: ${item.qty}.`,
          },
          { status: 409 }
        );
      }
    }

    // 2. Decrement stock atomically for each item
    for (const item of order.items) {
      const updateFilter = item.variantId
        ? { _id: item.productId, 'variants._id': item.variantId }
        : item.variantName
        ? { _id: item.productId, 'variants.name': item.variantName }
        : item.size !== undefined
        ? { _id: item.productId, 'sizesStock.size': item.size }
        : { _id: item.productId };

      const updateOp = (item.variantId || item.variantName)
        ? { $inc: { 'variants.$.stock': -item.qty } }
        : item.size !== undefined
        ? { $inc: { 'sizesStock.$.stock': -item.qty } }
        : { $inc: { stock: -item.qty } };

      if (session && useTransaction) {
        await Product.updateOne(updateFilter, updateOp, { session });
      } else {
        await Product.updateOne(updateFilter, updateOp);
      }
      decrementedItems.push({
        productId: item.productId,
        variantId: item.variantId,
        size: item.size,
        variantName: item.variantName,
        qty: item.qty,
      });
    }

    // 3. Update order to 'autorizado'
    const resolvedFinalTotal = finalTotal !== undefined ? Number(finalTotal) : order.total;
    order.status = 'autorizado';
    if (discountNote) order.notes = discountNote.trim();

    if (session && useTransaction) {
      await order.save({ session });
    } else {
      await order.save();
    }

    // 4. Create SalesRecord
    const salesRecordPayload = {
      orderId: order._id,
      orderNumber: order.orderNumber,
      confirmationDate: new Date(),
      recordedPaymentMethod,
      appliedDiscountNote: discountNote ?? '',
      finalTotal: resolvedFinalTotal,
    };

    const salesRecord = session && useTransaction
      ? (await SalesRecord.create([salesRecordPayload], { session }))[0]
      : await SalesRecord.create(salesRecordPayload);

    if (session && useTransaction) {
      await session.commitTransaction();
      session.endSession();
    }

    return NextResponse.json({
      ok: true,
      message: 'Venta autorizada exitosamente y stock actualizado.',
      salesRecordId: salesRecord._id.toString(),
      orderNumber: order.orderNumber,
    });
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
        } else if (item.size !== undefined) {
          await Product.updateOne(
            { _id: item.productId, 'sizesStock.size': item.size },
            { $inc: { 'sizesStock.$.stock': item.qty } }
          ).catch(() => {});
        } else {
          await Product.updateOne(
            { _id: item.productId },
            { $inc: { stock: item.qty } }
          ).catch(() => {});
        }
      }
    }

    console.error('Error al autorizar orden:', error);
    return NextResponse.json(
      { ok: false, error: 'INTERNAL_SERVER_ERROR', message: error?.message || 'Error al autorizar la venta.' },
      { status: 500 }
    );
  }
}
