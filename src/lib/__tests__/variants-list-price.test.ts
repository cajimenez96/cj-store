import { describe, it, expect } from 'vitest';
import { generateVariantCombinations } from '../variants';
import { formatPriceInput, parsePriceInput } from '@/utils/formatCurrency';
import { validateWhatsAppPhone } from '@/components/checkout/Step1CustomerData';

describe('generateVariantCombinations with listPrice', () => {
  it('propagates defaultRetailPrice and defaultListPrice to generated variants while preserving wholesale support', () => {
    const variants = generateVariantCombinations(
      [{ key: 'volumen', values: ['60', '100'] }],
      'scandal-homme',
      25000,
      undefined,
      30000
    );

    expect(variants).toHaveLength(2);
    expect(variants[0].retailPrice).toBe(25000);
    expect(variants[0].listPrice).toBe(30000);
    expect(variants[0].wholesalePrice).toBeUndefined();
  });
});

describe('formatPriceInput and parsePriceInput', () => {
  it('formats numeric values with dot thousands separators (e.g. 10.000.000)', () => {
    expect(formatPriceInput(10000000)).toBe('10.000.000');
    expect(formatPriceInput(25000)).toBe('25.000');
    expect(formatPriceInput(0)).toBe('0');
    expect(formatPriceInput('')).toBe('');
    expect(formatPriceInput(undefined)).toBe('');
  });

  it('parses formatted price strings back to numbers', () => {
    expect(parsePriceInput('10.000.000')).toBe(10000000);
    expect(parsePriceInput('25.000')).toBe(25000);
    expect(parsePriceInput('')).toBe('');
    expect(parsePriceInput('   ')).toBe('');
  });
});

describe('validateWhatsAppPhone', () => {
  it('accepts exactly 10 numeric digits and rejects symbols, +, e, or wrong length', () => {
    expect(validateWhatsAppPhone('3815218630')).toBeUndefined();
    expect(validateWhatsAppPhone('')).toBeDefined();
    expect(validateWhatsAppPhone('381521863')).toBeDefined();
    expect(validateWhatsAppPhone('38152186309')).toBeDefined();
    expect(validateWhatsAppPhone('+543815218')).toBeDefined();
    expect(validateWhatsAppPhone('38152e8630')).toBeDefined();
    expect(validateWhatsAppPhone('381-521863')).toBeDefined();
  });
});
