import { Types } from 'mongoose';

/**
 * Mongo condition matching products that belong to any of the given categories or to one of
 * their descendants. `categoryAncestors` holds the ancestor chain of the product's own category,
 * so a parent category also matches products filed under its children.
 * Malformed ids are dropped instead of raising a cast error.
 */
export function buildCategoryCondition(categoryIds: string[]) {
  const validIds = categoryIds.filter((id) => Types.ObjectId.isValid(id));

  return {
    $or: [
      { categoryId: { $in: validIds } },
      { categoryAncestors: { $in: validIds } },
    ],
  };
}
