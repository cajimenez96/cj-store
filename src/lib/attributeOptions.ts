export interface AttributeOption {
  value: string;
  label: string;
  order: number;
  hex?: string;
  active: boolean;
}

/** Slug accepted by the attribute schema: lowercase letters, digits, "_" and "-". */
export function slugifyOptionValue(label: string): string {
  return label
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

export type AddOptionResult =
  | { ok: true; options: AttributeOption[] }
  | { ok: false; reason: 'empty' | 'invalid' | 'duplicate' };

/** Appends an active option after the existing ones, rejecting empty, invalid and repeated labels. */
export function addOption(options: AttributeOption[], label: string): AddOptionResult {
  const cleanLabel = label.trim();
  if (!cleanLabel) return { ok: false, reason: 'empty' };

  const value = slugifyOptionValue(cleanLabel);
  if (!value) return { ok: false, reason: 'invalid' };
  if (options.some((option) => option.value === value)) return { ok: false, reason: 'duplicate' };

  const nextOrder = options.reduce((max, option) => Math.max(max, option.order), -1) + 1;
  return {
    ok: true,
    options: [...options, { value, label: cleanLabel, order: nextOrder, active: true }],
  };
}

/** Flips the `active` flag of one option; other options are left untouched. */
export function toggleOption(options: AttributeOption[], value: string): AttributeOption[] {
  return options.map((option) =>
    option.value === value ? { ...option, active: !option.active } : option
  );
}

export function removeOption(options: AttributeOption[], value: string): AttributeOption[] {
  return options.filter((option) => option.value !== value);
}
