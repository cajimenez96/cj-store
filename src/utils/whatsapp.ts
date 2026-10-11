import { formatPrice } from '@/utils/formatCurrency';

export interface WhatsAppMessagePayload {
  orderNumber: string;
  guest: {
    name: string;
    lastName: string;
    phone: string;
  };
  items: Array<{
    name: string;
    variantName?: string;
    size?: number;
    qty: number;
    price: number;
    subtotal: number;
  }>;
  total: number;
  storePhone?: string;
  bankAlias?: string;
}

export function buildWhatsAppShareUrl(payload: WhatsAppMessagePayload): string {
  const phone = payload.storePhone || "-";

  const alias = payload.bankAlias || "CJ.STORE";

  const itemsList = payload.items
    .map((item) => {
      const variantText = item.variantName
        ? `\n   - Variante: ${item.variantName}`
        : item.size !== undefined
          ? `\n   - Talle: ${item.size}`
          : "";
      return `• ${item.qty}x ${item.name}${variantText}\n   - Subtotal: ${formatPrice(item.subtotal)}`;
    })
    .join("\n\n");

  const text = `¡Hola! Acabo de hacer mi pedido #${payload.orderNumber} ✨

👤 *CLIENTE*
• ${payload.guest.name} ${payload.guest.lastName}
📱 ${payload.guest.phone}

📦 *SOLICITUD DE PEDIDO #${payload.orderNumber}*
${itemsList}

💰 *TOTAL A PAGAR:* ${formatPrice(payload.total)}

Ahí transfiero al alias: *${alias}*
¡Adjunto el comprobante de pago!`;

  return `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
}
