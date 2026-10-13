import Attribute, { IAttribute } from '@/models/Attribute';

export const GENDER_ATTRIBUTE_KEY = 'genero';

async function findGenderAttribute() {
  return Attribute.findOne({ key: GENDER_ATTRIBUTE_KEY }).lean<IAttribute | null>();
}

/** Labels of the active "genero" attribute options, in their configured order. */
export async function getConfiguredGenderLabels(): Promise<string[]> {
  const attr = await findGenderAttribute();
  return (attr?.options ?? [])
    .filter((opt) => opt.active)
    .sort((a, b) => a.order - b.order)
    .map((opt) => opt.label);
}

/**
 * Mongo condition matching a gender param against the `genero` spec. The product form stores
 * the option slug in specs, but the label is also accepted so URLs such as `?gender=Hombre`
 * keep working.
 */
export async function buildGenderCondition(gender: string) {
  const attr = await findGenderAttribute();
  const needle = gender.trim().toLowerCase();
  const option = attr?.options.find(
    (opt) => opt.value.toLowerCase() === needle || opt.label.toLowerCase() === needle
  );
  const candidates = Array.from(
    new Set([gender.trim(), option?.value, option?.label].filter((v): v is string => Boolean(v)))
  );

  return {
    specs: { $elemMatch: { key: GENDER_ATTRIBUTE_KEY, value: { $in: candidates } } },
  };
}
