import { formatCurrency } from './utils';

export interface WhatsAppImageShareOptions {
  blob: Blob;
  dataUrl: string;
  filename: string;
  phone?: string;
  title: string;
  customerName?: string;
}

// Global state / callback for showing the WhatsApp Image Modal
type ShowWhatsAppModalCallback = (options: WhatsAppImageShareOptions) => void;
let globalShowWhatsAppModal: ShowWhatsAppModalCallback | null = null;

export const registerWhatsAppModalHandler = (callback: ShowWhatsAppModalCallback | null) => {
  globalShowWhatsAppModal = callback;
};

// Helper: draw rounded rectangles cleanly
function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
  fillColor?: string,
  strokeColor?: string,
  lineWidth: number = 1
) {
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();

  if (fillColor) {
    ctx.fillStyle = fillColor;
    ctx.fill();
  }
  if (strokeColor) {
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
  ctx.restore();
}

/**
 * Generate a crisp, 3x-Retina Canvas Image of a Transaction Receipt
 * Zero blur, crystal clear typography, modern typography & borders
 */
export const generateTransactionReceiptCanvas = async (
  tx: any,
  data: any,
  currency: string,
  rate: number = 1
): Promise<{ blob: Blob; dataUrl: string }> => {
  const txRate = tx.exchangeRate || rate || 1;
  const bizName = (data?.settings?.businessName || 'Xaysimo Supermarket').toUpperCase();
  const storePhone = data?.settings?.storePhone || '';
  const customer = data?.customers?.find((c: any) => c.id === tx.customerId);
  const customerName = customer ? customer.name : (tx.customerName || 'Walk-in Customer');
  const customerPhone = customer?.phone || '';
  
  const pm = (tx.paymentMethod || '').toLowerCase();
  const isDebt = pm === 'debt' || pm.includes('debt') || pm.includes('deyn') || tx.type === 'CASH_LOAN';
  const isPartialDebt = tx.paymentMethod === 'Partial Payment' && (tx.paymentDetails?.debt || 0) > 0;
  
  const items: Array<{ name: string; quantity: number; sellPrice: number; unit?: string; sku?: string }> = tx.items || [];

  // Canvas Setup (Width: 640px logical, Height dynamic)
  const logicalWidth = 640;
  
  // Calculate dynamic height
  let estimatedHeight = 540;
  estimatedHeight += items.length * 36;
  if (isDebt || isPartialDebt) estimatedHeight += 44;
  if (tx.pageNumber) estimatedHeight += 24;
  if (tx.discount && tx.discount > 0) estimatedHeight += 24;

  const scale = 3; // 3x ultra-high-definition 300 DPI retina resolution
  const canvas = document.createElement('canvas');
  canvas.width = logicalWidth * scale;
  canvas.height = estimatedHeight * scale;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  
  // Enable high-quality image smoothing
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.scale(scale, scale);

  // 1. Crisp White Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, logicalWidth, estimatedHeight);

  // 2. Elegant Modern Outer Border
  drawRoundedRect(ctx, 10, 10, logicalWidth - 20, estimatedHeight - 20, 16, '#ffffff', '#0f172a', 2.5);

  let y = 32;

  // 3. Top Header Bar
  drawRoundedRect(ctx, 10, 10, logicalWidth - 20, 78, 16, '#0f172a');
  // Fill the bottom corners of header
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(10, 50, logicalWidth - 20, 38);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = '900 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText(bizName, logicalWidth / 2, 42);

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText(`WARQADDA RASMIGA AH EE IIBKA • RATE: $1 = ${txRate} ETB`, logicalWidth / 2, 62);

  if (storePhone) {
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`📞 Tel: ${storePhone}`, logicalWidth / 2, 78);
  }

  y = 104;

  // 4. Meta Information Card (Customer & Invoice Ref)
  drawRoundedRect(ctx, 24, y, logicalWidth - 48, 80, 12, '#f8fafc', '#cbd5e1', 1.5);

  // Left: Customer Name & Phone
  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = '900 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('MACAAMIILKA (CUSTOMER):', 40, y + 22);

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  const displayCustomer = customerName.length > 28 ? customerName.slice(0, 26) + '...' : customerName;
  ctx.fillText(displayCustomer, 40, y + 44);

  if (customerPhone) {
    ctx.fillStyle = '#2563eb';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`📱 ${customerPhone}`, 40, y + 64);
  } else {
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText('Iibka Dukaanka (Direct Cash)', 40, y + 64);
  }

  // Right: Invoice #, Date & Payment Status Pill
  const invoiceId = `INV-${(tx.id || '').slice(-6).toUpperCase()}`;
  const dateStr = new Date(tx.timestamp || Date.now()).toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  ctx.textAlign = 'right';
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 13px monospace';
  ctx.fillText(invoiceId, logicalWidth - 40, y + 22);

  ctx.fillStyle = '#64748b';
  ctx.font = '600 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText(dateStr, logicalWidth - 40, y + 38);

  // Status Badge Pill
  let badgeText = 'PAID / CASH';
  let badgeBg = '#dcfce7';
  let badgeBorder = '#86efac';
  let badgeColor = '#15803d';

  if (isDebt) {
    badgeText = 'NOT PAID (DEYN)';
    badgeBg = '#fee2e2';
    badgeBorder = '#fca5a5';
    badgeColor = '#b91c1c';
  } else if (isPartialDebt) {
    badgeText = 'PARTIAL (DEYN)';
    badgeBg = '#fef3c7';
    badgeBorder = '#fcd34d';
    badgeColor = '#b45309';
  }

  ctx.font = '900 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  const badgeTextWidth = ctx.measureText(badgeText).width;
  const badgeWidth = badgeTextWidth + 18;
  const badgeX = logicalWidth - 40 - badgeWidth;
  const badgeY = y + 46;

  drawRoundedRect(ctx, badgeX, badgeY, badgeWidth, 22, 6, badgeBg, badgeBorder, 1);
  ctx.textAlign = 'center';
  ctx.fillStyle = badgeColor;
  ctx.fillText(badgeText, badgeX + (badgeWidth / 2), badgeY + 15);

  y += 94;

  // 5. Items Table Header
  drawRoundedRect(ctx, 24, y, logicalWidth - 48, 28, 8, '#0f172a');
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  
  ctx.textAlign = 'left';
  ctx.fillText('#', 38, y + 18);
  ctx.fillText('ALAABTA (ITEM)', 64, y + 18);
  
  ctx.textAlign = 'center';
  ctx.fillText('TIRADA', 380, y + 18);
  
  ctx.textAlign = 'right';
  ctx.fillText('QIIMAHA', 490, y + 18);
  ctx.fillText('WADARTA', logicalWidth - 40, y + 18);

  y += 28;

  // 6. Items Rows
  items.forEach((item, index) => {
    const isEven = index % 2 === 0;
    if (isEven) {
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(24, y, logicalWidth - 48, 32);
    }

    // Row divider
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(24, y + 32);
    ctx.lineTo(logicalWidth - 24, y + 32);
    ctx.stroke();

    // Index
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 10px monospace';
    ctx.textAlign = 'left';
    ctx.fillText(`${index + 1}`, 38, y + 20);

    // Item Name
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
    const itemName = item.name.length > 36 ? item.name.slice(0, 34) + '...' : item.name;
    ctx.fillText(itemName, 64, y + 20);

    // Qty
    ctx.fillStyle = '#334155';
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(`${item.quantity} ${item.unit || 'PCS'}`, 380, y + 20);

    // Unit Price
    ctx.textAlign = 'right';
    ctx.fillStyle = '#475569';
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText(formatCurrency(item.sellPrice, currency, txRate), 490, y + 20);

    // Item Total
    ctx.fillStyle = '#0f172a';
    ctx.font = '900 12px monospace';
    ctx.fillText(formatCurrency(item.sellPrice * item.quantity, currency, txRate), logicalWidth - 40, y + 20);

    y += 32;
  });

  y += 12;

  // 7. Totals Summary Card
  const totalCardX = logicalWidth - 260;
  const totalCardWidth = 236;

  // Subtotal
  ctx.textAlign = 'left';
  ctx.fillStyle = '#64748b';
  ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('Subtotal:', totalCardX, y + 14);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#1e293b';
  ctx.font = '900 12px monospace';
  ctx.fillText(formatCurrency(tx.subtotal || tx.total, currency, txRate), logicalWidth - 40, y + 14);
  y += 20;

  if (tx.discount && tx.discount > 0) {
    ctx.textAlign = 'left';
    ctx.fillStyle = '#dc2626';
    ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText('Discount:', totalCardX, y + 14);

    ctx.textAlign = 'right';
    ctx.font = '900 12px monospace';
    ctx.fillText(`-${formatCurrency(tx.discount, currency, txRate)}`, logicalWidth - 40, y + 14);
    y += 20;
  }

  // Grand Total Filled Block
  drawRoundedRect(ctx, totalCardX, y, totalCardWidth, 34, 8, '#0f172a');
  ctx.textAlign = 'left';
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('WADARTA GUUD:', totalCardX + 12, y + 22);

  ctx.textAlign = 'right';
  ctx.fillStyle = '#38bdf8';
  ctx.font = '900 15px monospace';
  ctx.fillText(formatCurrency(tx.total, currency, txRate), logicalWidth - 40, y + 23);

  y += 42;

  // 8. If Debt: Prominent Remaining Debt Warning Box
  if (isDebt || isPartialDebt) {
    const debtAmount = isDebt ? tx.total : (tx.paymentDetails?.debt || 0);
    drawRoundedRect(ctx, 24, y, logicalWidth - 48, 34, 8, '#fee2e2', '#f87171', 1.5);

    ctx.textAlign = 'left';
    ctx.fillStyle = '#991b1b';
    ctx.font = '900 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
    ctx.fillText('⚠️ DEYNTA DHIMAN EE LAGUGU LEEYAHAY:', 40, y + 22);

    ctx.textAlign = 'right';
    ctx.fillStyle = '#b91c1c';
    ctx.font = '900 14px monospace';
    ctx.fillText(formatCurrency(debtAmount, currency, rate), logicalWidth - 40, y + 23);

    y += 42;
  }

  // 9. Payment Accounts Card
  const ebirrNo = data?.settings?.onlinePaymentNumbers?.ebirr || '0901234567';
  const cbeNo = data?.settings?.onlinePaymentNumbers?.commercialBank || '1000123456789';
  const kaafiNo = data?.settings?.onlinePaymentNumbers?.kaafi || data?.settings?.onlinePaymentNumbers?.golis || '0631234567';

  drawRoundedRect(ctx, 24, y, logicalWidth - 48, 68, 10, '#f8fafc', '#cbd5e1', 1);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#334155';
  ctx.font = '900 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('💳 AKOONNADA LACAG BIXINTA (PAYMENT ACCOUNTS):', 38, y + 18);

  const colW = (logicalWidth - 76) / 3;
  
  // 1. E-Birr
  ctx.fillStyle = '#059669';
  ctx.font = '900 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('1. E-BIRR / TELEBIRR', 38, y + 36);
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 11px monospace';
  ctx.fillText(ebirrNo, 38, y + 52);

  // 2. CBE Bank
  ctx.fillStyle = '#2563eb';
  ctx.font = '900 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('2. CBE BANK', 38 + colW, y + 36);
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 11px monospace';
  ctx.fillText(cbeNo, 38 + colW, y + 52);

  // 3. Kaafi / Zaad
  ctx.fillStyle = '#7c3aed';
  ctx.font = '900 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('3. KAAFI / ZAAD', 38 + colW * 2, y + 36);
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 11px monospace';
  ctx.fillText(kaafiNo, 38 + colW * 2, y + 52);

  y += 76;

  // 10. Footer Notice & Thank you
  drawRoundedRect(ctx, 24, y, logicalWidth - 48, 26, 6, '#fffbeb', '#fde68a', 1);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#78350f';
  ctx.font = '900 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('📢 Fadlan bixi lacagta deynta lagugu leeyahay adoo raali ah.', logicalWidth / 2, y + 17);

  y += 34;

  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText(`Mahadsanid wada shaqayntaada! • ${bizName}`, logicalWidth / 2, y);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve({
          blob,
          dataUrl: canvas.toDataURL('image/png')
        });
      }
    }, 'image/png');
  });
};

/**
 * Generate a crisp Canvas Image for Customer Debt Statement
 * Zero blur, ultra HD 3x resolution, modern card design
 */
export const generateDebtStatementCanvas = async (
  customer: any,
  data: any,
  currency: string,
  rate: number = 1,
  includeItemizedDetails: boolean = true
): Promise<{ blob: Blob; dataUrl: string }> => {
  const bizName = (data?.settings?.businessName || 'Xaysimo Supermarket').toUpperCase();
  const storePhone = data?.settings?.storePhone || '';
  const customerName = customer?.name || 'Macaamiil';
  const customerPhone = customer?.phone || '';
  const debtBalance = customer?.debtBalance || 0;

  const customerTxs = (data.transactions || [])
    .filter((t: any) => t.customerId === customer.id || (t.customerName && t.customerName === customer.name))
    .sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0));

  const logicalWidth = 660;
  let estimatedHeight = 460;
  if (includeItemizedDetails && customerTxs.length > 0) {
    estimatedHeight += Math.min(customerTxs.length, 12) * 36 + 50;
  }

  const scale = 3;
  const canvas = document.createElement('canvas');
  canvas.width = logicalWidth * scale;
  canvas.height = estimatedHeight * scale;
  const ctx = canvas.getContext('2d', { alpha: false })!;
  
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, logicalWidth, estimatedHeight);

  // Outer Border
  drawRoundedRect(ctx, 10, 10, logicalWidth - 20, estimatedHeight - 20, 16, '#ffffff', '#0f172a', 2.5);

  let y = 32;

  // Header Banner
  drawRoundedRect(ctx, 10, 10, logicalWidth - 20, 78, 16, '#0f172a');
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(10, 50, logicalWidth - 20, 38);

  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'center';
  ctx.font = '900 22px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText(bizName, logicalWidth / 2, 42);

  ctx.fillStyle = '#f87171';
  ctx.font = '900 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('📊 DIWAANKA DEYNTA IYO XISAABTA • CUSTOMER DEBT STATEMENT', logicalWidth / 2, 62);

  if (storePhone) {
    ctx.fillStyle = '#38bdf8';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`📞 Tel: ${storePhone}`, logicalWidth / 2, 78);
  }

  y = 104;

  // Customer Card & Outstanding Debt Highlight
  drawRoundedRect(ctx, 24, y, logicalWidth - 48, 84, 12, '#fef2f2', '#fca5a5', 1.5);

  // Left
  ctx.textAlign = 'left';
  ctx.fillStyle = '#991b1b';
  ctx.font = '900 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('MACAAMIILKA (CUSTOMER):', 40, y + 22);

  ctx.fillStyle = '#0f172a';
  ctx.font = '900 16px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText(customerName, 40, y + 44);

  if (customerPhone) {
    ctx.fillStyle = '#64748b';
    ctx.font = 'bold 11px monospace';
    ctx.fillText(`📱 Tel: ${customerPhone}`, 40, y + 66);
  }

  // Right
  ctx.textAlign = 'right';
  ctx.fillStyle = '#7f1d1d';
  ctx.font = '900 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('WADARTA DEYNTA DHIMAN (TOTAL DEBT):', logicalWidth - 40, y + 24);

  ctx.fillStyle = '#dc2626';
  ctx.font = '900 22px monospace';
  ctx.fillText(formatCurrency(debtBalance, currency, rate), logicalWidth - 40, y + 56);

  y += 98;

  // Itemized transactions (if included)
  if (includeItemizedDetails && customerTxs.length > 0) {
    drawRoundedRect(ctx, 24, y, logicalWidth - 48, 26, 8, '#0f172a');
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';

    ctx.textAlign = 'left';
    ctx.fillText('TAARIIKH', 40, y + 17);
    ctx.fillText('NOOCA & ALAABTA', 150, y + 17);

    ctx.textAlign = 'right';
    ctx.fillText('LACAGTA', logicalWidth - 40, y + 17);

    y += 26;

    const displayedTxs = customerTxs.slice(-10);
    displayedTxs.forEach((tx: any, idx: number) => {
      const isEven = idx % 2 === 0;
      if (isEven) {
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(24, y, logicalWidth - 48, 32);
      }

      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(24, y + 32);
      ctx.lineTo(logicalWidth - 24, y + 32);
      ctx.stroke();

      const dateStr = new Date(tx.timestamp).toLocaleDateString('so-SO', { month: 'short', day: 'numeric' });
      ctx.textAlign = 'left';
      ctx.fillStyle = '#475569';
      ctx.font = 'bold 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
      ctx.fillText(dateStr, 40, y + 20);

      const isPayment = tx.type === 'DEBT_PAYMENT';
      const isCashLoan = tx.type === 'CASH_LOAN';
      let title = isPayment ? '🟢 Bixin Deyn (Payment)' : (isCashLoan ? 'Dayn Cash' : `#INV-${(tx.id || '').slice(-5).toUpperCase()}`);
      if (tx.items && tx.items.length > 0) {
        title += ` (${tx.items.map((i: any) => `${i.name} x${i.quantity}`).join(', ')})`;
      }
      if (title.length > 44) title = title.slice(0, 42) + '...';

      ctx.fillStyle = isPayment ? '#15803d' : '#0f172a';
      ctx.font = '900 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
      ctx.fillText(title, 150, y + 20);

      ctx.textAlign = 'right';
      ctx.font = '900 12px monospace';
      if (isPayment) {
        ctx.fillStyle = '#15803d';
        ctx.fillText(`-${formatCurrency(tx.total, currency, rate)}`, logicalWidth - 40, y + 20);
      } else {
        ctx.fillStyle = '#dc2626';
        ctx.fillText(formatCurrency(tx.total, currency, rate), logicalWidth - 40, y + 20);
      }

      y += 32;
    });

    y += 14;
  }

  // Payment Accounts Box
  const ebirrNo = data?.settings?.onlinePaymentNumbers?.ebirr || '0901234567';
  const cbeNo = data?.settings?.onlinePaymentNumbers?.commercialBank || '1000123456789';
  const kaafiNo = data?.settings?.onlinePaymentNumbers?.kaafi || data?.settings?.onlinePaymentNumbers?.golis || '0631234567';

  drawRoundedRect(ctx, 24, y, logicalWidth - 48, 68, 10, '#f8fafc', '#cbd5e1', 1);

  ctx.textAlign = 'left';
  ctx.fillStyle = '#334155';
  ctx.font = '900 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('💳 AKOONNADA LACAG BIXINTA (PAYMENT ACCOUNTS):', 40, y + 18);

  const colW = (logicalWidth - 76) / 3;
  ctx.fillStyle = '#059669';
  ctx.font = '900 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('1. E-BIRR / TELEBIRR', 40, y + 36);
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 11px monospace';
  ctx.fillText(ebirrNo, 40, y + 52);

  ctx.fillStyle = '#2563eb';
  ctx.font = '900 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('2. CBE BANK', 40 + colW, y + 36);
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 11px monospace';
  ctx.fillText(cbeNo, 40 + colW, y + 52);

  ctx.fillStyle = '#7c3aed';
  ctx.font = '900 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('3. KAAFI / ZAAD', 40 + colW * 2, y + 36);
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 11px monospace';
  ctx.fillText(kaafiNo, 40 + colW * 2, y + 52);

  y += 76;

  // Notice
  drawRoundedRect(ctx, 24, y, logicalWidth - 48, 26, 6, '#fffbeb', '#fde68a', 1);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#78350f';
  ctx.font = '900 10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText('📢 Fadlan bixi lacagta deynta lagugu leeyahay adoo raali ah.', logicalWidth / 2, y + 17);

  y += 34;
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 9px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif';
  ctx.fillText(`Mahadsanid! • ${bizName}`, logicalWidth / 2, y);

  return new Promise((resolve) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve({
          blob,
          dataUrl: canvas.toDataURL('image/png')
        });
      }
    }, 'image/png');
  });
};

/**
 * Dispatch or show the WhatsApp image share workflow
 */
export const dispatchWhatsAppImageShare = (options: WhatsAppImageShareOptions) => {
  if (globalShowWhatsAppModal) {
    globalShowWhatsAppModal(options);
  } else {
    // Fallback: Copy to clipboard and open WhatsApp
    try {
      navigator.clipboard.write([
        new ClipboardItem({
          'image/png': options.blob
        })
      ]).catch(() => {});
    } catch (e) {}

    // Download fallback
    const a = document.createElement('a');
    a.href = options.dataUrl;
    a.download = options.filename;
    a.click();

    if (options.phone) {
      const cleanPhone = options.phone.replace(/[^\d]/g, '');
      window.open(`https://wa.me/${cleanPhone}`, '_blank');
    }
  }
};
