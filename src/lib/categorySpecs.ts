export interface SpecEntry {
  key: string;
  required: boolean;
}

export function hasSpec(specs: SpecEntry[], key: string): boolean {
  return specs.some((spec) => spec.key === key);
}

/** Adds an optional spec; returns the same array when it is already there. */
export function withSpec(specs: SpecEntry[], key: string): SpecEntry[] {
  return hasSpec(specs, key) ? specs : [...specs, { key, required: false }];
}

/** Removes a spec; returns the same array when it is not there. */
export function withoutSpec(specs: SpecEntry[], key: string): SpecEntry[] {
  return hasSpec(specs, key) ? specs.filter((spec) => spec.key !== key) : specs;
}

/** Ids of a tree node and all of its descendants, parent first. */
export function collectSubtreeIds<T extends { _id: string; children: T[] }>(node: T): string[] {
  return [node._id, ...node.children.flatMap((child) => collectSubtreeIds(child))];
}
