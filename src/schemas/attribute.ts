import { z } from 'zod';

export const attributeOptionSchema = z.object({
  value: z
    .string()
    .min(1, 'El valor (slug) es obligatorio')
    .regex(/^[a-z0-9_-]+$/, 'El valor debe ser en minúsculas sin espacios (ej: negro, 100ml, xl)'),
  label: z.string().min(1, 'La etiqueta visible es obligatoria'),
  order: z.number().int().default(0),
  hex: z.string().regex(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Color hexadecimal inválido').optional().or(z.literal('')),
  active: z.boolean().default(true),
});

export const createAttributeSchema = z.object({
  key: z
    .string()
    .min(2, 'El identificador debe tener al menos 2 caracteres')
    .regex(/^[a-z0-9_]+$/, 'El identificador debe contener solo minúsculas y guiones bajos (ej: color, talle_calzado)'),
  label: z.string().min(2, 'El nombre visible debe tener al menos 2 caracteres'),
  type: z.enum(['select', 'text', 'number', 'boolean']).default('select'),
  options: z.array(attributeOptionSchema).default([]),
  unit: z.string().trim().optional(),
  filterable: z.boolean().default(false),
});

export const updateAttributeSchema = z.object({
  label: z.string().min(2, 'El nombre visible debe tener al menos 2 caracteres').optional(),
  options: z.array(attributeOptionSchema).optional(),
  unit: z.string().trim().optional(),
  filterable: z.boolean().optional(),
});
