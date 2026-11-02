import Product from '@/models/Product';
import { isObjectIdString } from '@/lib/input-validation';

/* eslint-disable @typescript-eslint/no-explicit-any */

/**
 * Read-path helper for order responses: normalizes `items[].productId` to a
 * string (or '' when it is not a valid, existing product) and fills `image`
 * from the product when the item has none. Replaces `.populate()`, which
 * throws a CastError on legacy items whose `productId` is not an ObjectId.
 * One product query per call, restricted to the valid ids.
 */
export async function withProductImages<T extends { items?: any[] }>(orders: T[]): Promise<T[]> {
  const ids = new Set<string>();
  for (const order of orders) {
    for (const item of order.items || []) {
      const id = item?.productId == null ? '' : String(item.productId);
      if (isObjectIdString(id)) ids.add(id);
    }
  }

  const products = ids.size
    ? await Product.find({ _id: { $in: [...ids] } })
        .select('images name')
        .lean()
    : [];
  const byId = new Map<string, any>(products.map((p: any) => [String(p._id), p]));

  return orders.map((order) => ({
    ...order,
    items: (order.items || []).map((item: any) => {
      const raw = item?.productId == null ? '' : String(item.productId);
      const prod = isObjectIdString(raw) ? byId.get(raw) : undefined;
      const mainImage =
        item.image || prod?.images?.find((img: any) => img.isPrincipal)?.url || prod?.images?.[0]?.url || '';
      return {
        ...item,
        productId: prod?._id ? prod._id.toString() : '',
        image: mainImage,
      };
    }),
  }));
}
