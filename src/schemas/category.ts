import { z } from 'zod';

export const specAttributeDefinitionSchema = z.object({
  key: z.string().min(1, 'El atributo es obligatorio'),
  required: z.boolean().default(false),
});

export const createCategorySchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  slug: z
    .string()
    .min(2, 'El slug debe tener al menos 2 caracteres')
    .regex(/^[a-z0-9_-]+$/, 'El slug debe contener solo minúsculas y guiones'),
  parentId: z.string().nullable().optional(),
  variantAxes: z.array(z.string()).default([]),
  imageAxis: z.string().optional().or(z.literal('')),
  specAttributes: z.array(specAttributeDefinitionSchema).default([]),
  order: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const updateCategorySchema = z.object({
  name: z.string().min(2, 'El nombre debe tener al menos 2 caracteres').optional(),
  slug: z
    .string()
    .min(2, 'El slug debe tener al menos 2 caracteres')
    .regex(/^[a-z0-9_-]+$/, 'El slug debe contener solo minúsculas y guiones')
    .optional(),
  parentId: z.string().nullable().optional(),
  variantAxes: z.array(z.string()).optional(),
  imageAxis: z.string().optional().or(z.literal('')),
  specAttributes: z.array(specAttributeDefinitionSchema).optional(),
  order: z.number().int().optional(),
  active: z.boolean().optional(),
});
