import { Currency, PaymentMethod, AppData } from '../types';
import { formatCurrency } from './utils';
import { WhatsAppImageShareOptions, dispatchWhatsAppImageShare } from './receiptImageGenerator';

export interface ExecutiveReportData {
  storeName: string;
  targetTitle: 'Admin' | 'Manager';
  targetPhone: string;
  periodLabel: string;
  currency: Currency;
  exchangeRate: number;
  generatedDateStr: string;
  generatedTimeStr: string;
  
  // High-level financials (EXCLUDING KHUDAAR)
  totalSalesRevenue: number;
  totalTransactionsCount: number;
  totalCost: number;
  grossProfit: number;
  totalExpenses: number;
  netProfit: number;
  
  // Payment methods
  cashSalesTotal: number;
  debtSalesTotal: number;
  bankSalesTotal: number;
  mobileSalesTotal: number;
  
  // Accounts
  accounts: { id: string; name: string; type: string; balance: number }[];
  totalAccountsBalance: number;
  
  // Daily breakdown (e.g., 1-dii bisha, 2-dii bisha, Maanta)
  dailyRows: {
    dateLabel: string;
    sales: number;
    cost: number;
    expenses: number;
    profit: number;
    txCount: number;
  }[];

  // Products breakdowns
  topSellingProducts: { name: string; qty: number; sales: number; profit: number }[];
  leastSellingProducts: { name: string; qty: number; stock: number }[];
  highProfitProducts: { name: string; cost: number; sell: number; profit: number; marginPct: number }[];
  lowProfitProducts: { name: string; cost: number; sell: number; profit: number; marginPct: number }[];
  
  // Inventory alerts
  lowStockItems: { name: string; stock: number; unit: string; minStock: number }[];
  expiringItems: { name: string; expiryDate: string; daysLeft: number }[];
  
  // Debtors & what they took
  debtorsWithItems: {
    id: string;
    name: string;
    phone: string;
    debtBalance: number;
    itemsTaken: string;
  }[];
  totalDebtOutstanding: number;
}

/**
 * Helper to draw crisp rounded rectangle
 */
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
 * Draw text with truncation if needed
 */
function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth?: number
) {
  if (!maxWidth) {
    ctx.fillText(text, x, y);
    return;
  }
  
  let currentText = text;
  if (ctx.measureText(currentText).width > maxWidth) {
    while (currentText.length > 3 && ctx.measureText(currentText + '...').width > maxWidth) {
      currentText = currentText.slice(0, -1);
    }
    currentText += '...';
  }
  ctx.fillText(currentText, x, y);
}

/**
 * Generates a full high-resolution Executive Store Report Canvas Image
 * Returns a PNG Blob and DataUrl
 */
export async function generateExecutiveReportImage(
  data: ExecutiveReportData
): Promise<{ blob: Blob; dataUrl: string; filename: string }> {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  const width = 1200;
  
  // Calculate dynamic height based on data rows
  let estimatedHeight = 160; // Header
  estimatedHeight += 180;    // 4 KPI Summary Cards
  estimatedHeight += 190;    // Visual Bar Chart Comparison
  
  // Daily Breakdown Table (e.g. up to 10 rows)
  const dailyRowsCount = Math.min(data.dailyRows.length, 12);
  estimatedHeight += 60 + Math.max(1, dailyRowsCount) * 34 + 30;

  // Top & Least Selling Products Dual Section
  const topCount = Math.max(Math.min(data.topSellingProducts.length, 10), Math.min(data.leastSellingProducts.length, 10));
  estimatedHeight += 60 + Math.max(1, topCount) * 34 + 30;

  // High & Low Profit Products Dual Section
  const profitCount = Math.max(Math.min(data.highProfitProducts.length, 10), Math.min(data.lowProfitProducts.length, 10));
  estimatedHeight += 60 + Math.max(1, profitCount) * 34 + 30;

  // Low Stock & Expiring Inventory Dual Section
  const stockCount = Math.max(Math.min(data.lowStockItems.length, 10), Math.min(data.expiringItems.length, 10));
  estimatedHeight += 60 + Math.max(1, stockCount) * 34 + 30;

  // Debtors & What they took Table (10 items)
  const debtorCount = Math.min(data.debtorsWithItems.length, 10);
  estimatedHeight += 60 + Math.max(1, debtorCount) * 40 + 30;

  // Accounts Breakdown & Footer
  estimatedHeight += 170;

  // Set 2x Retina Resolution
  const scale = 2;
  canvas.width = width * scale;
  canvas.height = estimatedHeight * scale;
  ctx.scale(scale, scale);

  // Background
  ctx.fillStyle = '#f8fafc';
  ctx.fillRect(0, 0, width, estimatedHeight);

  let curY = 24;
  const padding = 32;
  const contentWidth = width - padding * 2;

  // ================= 1. HEADER =================
  const headerHeight = 120;
  drawRoundedRect(ctx, padding, curY, contentWidth, headerHeight, 20, '#0f172a');

  // Decorative top accent bar
  drawRoundedRect(ctx, padding, curY, contentWidth, 8, 4, '#2563eb');

  // Business Name
  ctx.fillStyle = '#ffffff';
  ctx.font = '900 24px system-ui, -apple-system, sans-serif';
  drawText(ctx, data.storeName.toUpperCase(), padding + 24, curY + 45);

  // Subtitle / Report title
  ctx.fillStyle = '#94a3b8';
  ctx.font = '700 13px system-ui, -apple-system, sans-serif';
  drawText(ctx, `WARBIXINTA GUUD & MAALIYADDA DUKAANKA (${data.periodLabel.toUpperCase()})`, padding + 24, curY + 70);

  // Note: No Khudaar
  ctx.fillStyle = '#38bdf8';
  ctx.font = '600 11px system-ui, -apple-system, sans-serif';
  drawText(ctx, `✓ Xisaabta Dukaanka Guud (Kharashka & Iibka Khudaartu kuma jiraan)`, padding + 24, curY + 92);

  // Target Role & Date Badge (Right Side)
  const badgeWidth = 240;
  const badgeX = padding + contentWidth - badgeWidth - 24;
  drawRoundedRect(ctx, badgeX, curY + 22, badgeWidth, 75, 14, '#1e293b', '#334155', 1);

  ctx.fillStyle = '#f59e0b';
  ctx.font = '800 12px system-ui, -apple-system, sans-serif';
  drawText(ctx, `KU SOCOTA: ${data.targetTitle.toUpperCase()}`, badgeX + 16, curY + 45);

  ctx.fillStyle = '#cbd5e1';
  ctx.font = '600 11px system-ui, -apple-system, sans-serif';
  drawText(ctx, `📅 ${data.generatedDateStr}`, badgeX + 16, curY + 65);
  drawText(ctx, `⏰ ${data.generatedTimeStr} | Sarif: $1=${data.exchangeRate} ETB`, badgeX + 16, curY + 83);

  curY += headerHeight + 20;

  // ================= 2. 4 KEY KPI SUMMARY CARDS =================
  const cardGap = 16;
  const cardWidth = (contentWidth - cardGap * 3) / 4;
  const cardHeight = 120;

  // Card 1: Total Sales
  drawRoundedRect(ctx, padding, curY, cardWidth, cardHeight, 16, '#eff6ff', '#bfdbfe', 1.5);
  ctx.fillStyle = '#1d4ed8';
  ctx.font = '800 11px system-ui, -apple-system, sans-serif';
  drawText(ctx, 'IIBKA GUUD (SALES)', padding + 16, curY + 28);
  ctx.fillStyle = '#0f172a';
  ctx.font = '900 22px system-ui, -apple-system, sans-serif';
  drawText(ctx, formatCurrency(data.totalSalesRevenue, data.currency, data.exchangeRate), padding + 16, curY + 62, cardWidth - 32);
  ctx.fillStyle = '#64748b';
  ctx.font = '600 11px system-ui, -apple-system, sans-serif';
  drawText(ctx, `${data.totalTransactionsCount} iib oo la sameeyay`, padding + 16, curY + 92);

  // Card 2: Net Profit
  const c2X = padding + cardWidth + cardGap;
  drawRoundedRect(ctx, c2X, curY, cardWidth, cardHeight, 16, '#ecfdf5', '#a7f3d0', 1.5);
  ctx.fillStyle = '#047857';
  ctx.font = '800 11px system-ui, -apple-system, sans-serif';
  drawText(ctx, "FAA'IIDADA SAAFIGA (NET)", c2X + 16, curY + 28);
  ctx.fillStyle = '#064e3b';
  ctx.font = '900 22px system-ui, -apple-system, sans-serif';
  drawText(ctx, formatCurrency(data.netProfit, data.currency, data.exchangeRate), c2X + 16, curY + 62, cardWidth - 32);
  ctx.fillStyle = '#059669';
  ctx.font = '600 11px system-ui, -apple-system, sans-serif';
  drawText(ctx, `Raasamaal: ${formatCurrency(data.totalCost, data.currency, data.exchangeRate)}`, c2X + 16, curY + 92, cardWidth - 32);

  // Card 3: Total Expenses
  const c3X = c2X + cardWidth + cardGap;
  drawRoundedRect(ctx, c3X, curY, cardWidth, cardHeight, 16, '#fffbeb', '#fde68a', 1.5);
  ctx.fillStyle = '#b45309';
  ctx.font = '800 11px system-ui, -apple-system, sans-serif';
  drawText(ctx, 'KHARASHKA GUUD', c3X + 16, curY + 28);
  ctx.fillStyle = '#78350f';
  ctx.font = '900 22px system-ui, -apple-system, sans-serif';
  drawText(ctx, formatCurrency(data.totalExpenses, data.currency, data.exchangeRate), c3X + 16, curY + 62, cardWidth - 32);
  ctx.fillStyle = '#92400e';
  ctx.font = '600 11px system-ui, -apple-system, sans-serif';
  drawText(ctx, 'Kharashyada dukaanka baxay', c3X + 16, curY + 92);

  // Card 4: Total Debt Outstanding
  const c4X = c3X + cardWidth + cardGap;
  drawRoundedRect(ctx, c4X, curY, cardWidth, cardHeight, 16, '#fff1f2', '#fecdd3', 1.5);
  ctx.fillStyle = '#be123c';
  ctx.font = '800 11px system-ui, -apple-system, sans-serif';
  drawText(ctx, 'DEYMAHA KU MAQAN', c4X + 16, curY + 28);
  ctx.fillStyle = '#881337';
  ctx.font = '900 22px system-ui, -apple-system, sans-serif';
  drawText(ctx, formatCurrency(data.totalDebtOutstanding, data.currency, data.exchangeRate), c4X + 16, curY + 62, cardWidth - 32);
  ctx.fillStyle = '#e11d48';
  ctx.font = '600 11px system-ui, -apple-system, sans-serif';
  drawText(ctx, `${data.debtorsWithItems.length} qof oo lagu leeyahay`, c4X + 16, curY + 92);

  curY += cardHeight + 20;

  // ================= 3. VISUAL BAR CHART COMPARISON =================
  const chartHeight = 150;
  drawRoundedRect(ctx, padding, curY, contentWidth, chartHeight, 16, '#ffffff', '#e2e8f0', 1);

  ctx.fillStyle = '#0f172a';
  ctx.font = '800 13px system-ui, -apple-system, sans-serif';
  drawText(ctx, '📊 JAANTUSKA MAALIYADDA GUUD EE DUKAANKA (FINANCIAL OVERVIEW)', padding + 20, curY + 30);

  const chartItems = [
    { label: 'Iibka Guud', val: data.totalSalesRevenue, color: '#2563eb' },
    { label: 'Raasamaal (Cost)', val: data.totalCost, color: '#64748b' },
    { label: "Faa'iido Saafi", val: Math.max(0, data.netProfit), color: '#059669' },
    { label: 'Kharash', val: data.totalExpenses, color: '#d97706' },
    { label: 'Caddaan (Cash)', val: data.cashSalesTotal, color: '#10b981' },
    { label: 'Deyn Ku Maqan', val: data.totalDebtOutstanding, color: '#e11d48' },
  ];

  const maxVal = Math.max(...chartItems.map(i => i.val), 1);
  const chartBarWidth = (contentWidth - 60) / chartItems.length;
  const barMaxHeight = 70;

  chartItems.forEach((item, idx) => {
    const bX = padding + 30 + idx * chartBarWidth;
    const bH = Math.max(6, Math.min(barMaxHeight, (item.val / maxVal) * barMaxHeight));
    const bY = curY + 115 - bH;
    const actualWidth = chartBarWidth - 24;

    // Bar
    drawRoundedRect(ctx, bX, bY, actualWidth, bH, 6, item.color);

    // Value label above bar
    ctx.fillStyle = '#0f172a';
    ctx.font = '700 10px system-ui, -apple-system, sans-serif';
    const valStr = formatCurrency(item.val, data.currency, data.exchangeRate);
    drawText(ctx, valStr, bX, bY - 6, actualWidth);

    // Bottom label
    ctx.fillStyle = '#64748b';
    ctx.font = '600 10px system-ui, -apple-system, sans-serif';
    drawText(ctx, item.label, bX, curY + 132, actualWidth);
  });

  curY += chartHeight + 20;

  // ================= 4. TABLE: IIBKA MAALINLAHA EE BISHA (DAILY BREAKDOWN) =================
  const dailySectionHeight = 46 + Math.max(1, dailyRowsCount) * 32;
  drawRoundedRect(ctx, padding, curY, contentWidth, dailySectionHeight, 16, '#ffffff', '#e2e8f0', 1);

  // Table Title
  ctx.fillStyle = '#0f172a';
  ctx.font = '800 13px system-ui, -apple-system, sans-serif';
  drawText(ctx, '📅 XISAABTA & IIBKA MAALINLAHA EE BISHA (DAILY SALES, COST & NET PROFIT)', padding + 20, curY + 26);

  // Table Header Row
  const tHeadY = curY + 36;
  drawRoundedRect(ctx, padding + 12, tHeadY, contentWidth - 24, 28, 8, '#f1f5f9');
  ctx.fillStyle = '#475569';
  ctx.font = '800 10px system-ui, -apple-system, sans-serif';
  drawText(ctx, 'TAARIIKHDA / MAALINTA', padding + 24, tHeadY + 18);
  drawText(ctx, 'IIBKA GUUD', padding + 280, tHeadY + 18);
  drawText(ctx, 'RAASAMAAL (COST)', padding + 480, tHeadY + 18);
  drawText(ctx, 'KHARASHKA', padding + 680, tHeadY + 18);
  drawText(ctx, "FAA'IIDADA SAAFIGA", padding + 860, tHeadY + 18);
  drawText(ctx, 'TIRADA IIBKA', padding + 1040, tHeadY + 18);

  let rowY = tHeadY + 30;
  if (data.dailyRows.length === 0) {
    ctx.fillStyle = '#94a3b8';
    ctx.font = '600 11px system-ui, -apple-system, sans-serif';
    drawText(ctx, 'Wax dhaqdhaqaaq ah laguma diiwaangelin muddadan.', padding + 24, rowY + 18);
  } else {
    data.dailyRows.slice(0, dailyRowsCount).forEach((dRow, idx) => {
      if (idx % 2 === 1) {
        drawRoundedRect(ctx, padding + 12, rowY, contentWidth - 24, 28, 6, '#f8fafc');
      }

      ctx.fillStyle = '#0f172a';
      ctx.font = '700 11px system-ui, -apple-system, sans-serif';
      drawText(ctx, dRow.dateLabel, padding + 24, rowY + 19);

      ctx.fillStyle = '#1d4ed8';
      ctx.font = '800 11px system-ui, -apple-system, sans-serif';
      drawText(ctx, formatCurrency(dRow.sales, data.currency, data.exchangeRate), padding + 280, rowY + 19);

      ctx.fillStyle = '#64748b';
      ctx.font = '600 11px system-ui, -apple-system, sans-serif';
      drawText(ctx, formatCurrency(dRow.cost, data.currency, data.exchangeRate), padding + 480, rowY + 19);

      ctx.fillStyle = '#b45309';
      ctx.font = '600 11px system-ui, -apple-system, sans-serif';
      drawText(ctx, formatCurrency(dRow.expenses, data.currency, data.exchangeRate), padding + 680, rowY + 19);

      ctx.fillStyle = dRow.profit >= 0 ? '#059669' : '#e11d48';
      ctx.font = '800 11px system-ui, -apple-system, sans-serif';
      drawText(ctx, formatCurrency(dRow.profit, data.currency, data.exchangeRate), padding + 860, rowY + 19);

      ctx.fillStyle = '#334155';
      ctx.font = '600 11px system-ui, -apple-system, sans-serif';
      drawText(ctx, `${dRow.txCount} iib`, padding + 1040, rowY + 19);

      rowY += 30;
    });
  }

  curY += dailySectionHeight + 20;

  // ================= 5. DUAL TABLES: TOP & LEAST SELLING PRODUCTS =================
  const halfWidth = (contentWidth - 16) / 2;
  const dualTableHeight = 46 + Math.max(1, topCount) * 30;

  // Left: Top Selling Products
  drawRoundedRect(ctx, padding, curY, halfWidth, dualTableHeight, 16, '#ffffff', '#e2e8f0', 1);
  ctx.fillStyle = '#0f172a';
  ctx.font = '800 12px system-ui, -apple-system, sans-serif';
  drawText(ctx, '🔥 TOP 10: ALAABTA UGU IIBSIGA BADAN (TOP SELLING)', padding + 16, curY + 26);

  const topHHeadY = curY + 36;
  drawRoundedRect(ctx, padding + 10, topHHeadY, halfWidth - 20, 24, 6, '#eff6ff');
  ctx.fillStyle = '#1e40af';
  ctx.font = '800 10px system-ui, -apple-system, sans-serif';
  drawText(ctx, 'ALAABTA', padding + 18, topHHeadY + 16);
  drawText(ctx, 'TIRADA', padding + 280, topHHeadY + 16);
  drawText(ctx, 'IIBKA', padding + 370, topHHeadY + 16);
  drawText(ctx, "FAA'IIDO", padding + 470, topHHeadY + 16);

  let topRowY = topHHeadY + 26;
  data.topSellingProducts.slice(0, 10).forEach((p, idx) => {
    ctx.fillStyle = '#0f172a';
    ctx.font = '700 11px system-ui, -apple-system, sans-serif';
    drawText(ctx, `${idx + 1}. ${p.name}`, padding + 18, topRowY + 17, 250);

    ctx.fillStyle = '#047857';
    ctx.font = '800 11px system-ui, -apple-system, sans-serif';
    drawText(ctx, `${p.qty} pcs`, padding + 280, topRowY + 17);

    ctx.fillStyle = '#1d4ed8';
    ctx.font = '700 11px system-ui, -apple-system, sans-serif';
    drawText(ctx, formatCurrency(p.sales, data.currency, data.exchangeRate), padding + 370, topRowY + 17);

    ctx.fillStyle = '#059669';
    ctx.font = '800 11px system-ui, -apple-system, sans-serif';
    drawText(ctx, formatCurrency(p.profit, data.currency, data.exchangeRate), padding + 470, topRowY + 17);

    topRowY += 28;
  });

  // Right: Least Selling Products
  const rightX = padding + halfWidth + 16;
  drawRoundedRect(ctx, rightX, curY, halfWidth, dualTableHeight, 16, '#ffffff', '#e2e8f0', 1);
  ctx.fillStyle = '#0f172a';
  ctx.font = '800 12px system-ui, -apple-system, sans-serif';
  drawText(ctx, '📉 TOP 10: ALAABTA UGU IIBSIGA YAR (LEAST SELLING / SLOW)', rightX + 16, curY + 26);

  const leastHHeadY = curY + 36;
  drawRoundedRect(ctx, rightX + 10, leastHHeadY, halfWidth - 20, 24, 6, '#f8fafc');
  ctx.fillStyle = '#475569';
  ctx.font = '800 10px system-ui, -apple-system, sans-serif';
  drawText(ctx, 'ALAABTA', rightX + 18, leastHHeadY + 16);
  drawText(ctx, 'LA IIBIYAY', rightX + 320, leastHHeadY + 16);
  drawText(ctx, 'HARAAGA STOCK', rightX + 440, leastHHeadY + 16);

  let leastRowY = leastHHeadY + 26;
  data.leastSellingProducts.slice(0, 10).forEach((p, idx) => {
    ctx.fillStyle = '#0f172a';
    ctx.font = '700 11px system-ui, -apple-system, sans-serif';
    drawText(ctx, `${idx + 1}. ${p.name}`, rightX + 18, leastRowY + 17, 280);

    ctx.fillStyle = '#b45309';
    ctx.font = '800 11px system-ui, -apple-system, sans-serif';
    drawText(ctx, `${p.qty} pcs`, rightX + 320, leastRowY + 17);

    ctx.fillStyle = '#64748b';
    ctx.font = '700 11px system-ui, -apple-system, sans-serif';
    drawText(ctx, `${p.stock} pcs`, rightX + 440, leastRowY + 17);

    leastRowY += 28;
  });

  curY += dualTableHeight + 20;

  // ================= 6. DUAL TABLES: HIGH PROFIT & LOW PROFIT MARGIN =================
  const marginTableHeight = 46 + Math.max(1, profitCount) * 30;

  // Left: High Profit Margin
  drawRoundedRect(ctx, padding, curY, halfWidth, marginTableHeight, 16, '#ffffff', '#e2e8f0', 1);
  ctx.fillStyle = '#0f172a';
  ctx.font = '800 12px system-ui, -apple-system, sans-serif';
  drawText(ctx, "💎 TOP 10: ALAABTA FAA'IIDADA BADAN (HIGH MARGIN)", padding + 16, curY + 26);

  const hpHeadY = curY + 36;
  drawRoundedRect(ctx, padding + 10, hpHeadY, halfWidth - 20, 24, 6, '#ecfdf5');
  ctx.fillStyle = '#065f46';
  ctx.font = '800 10px system-ui, -apple-system, sans-serif';
  drawText(ctx, 'ALAABTA', padding + 18, hpHeadY + 16);
  drawText(ctx, 'COST', padding + 280, hpHeadY + 16);
  drawText(ctx, 'IIBKA', padding + 370, hpHeadY + 16);
  drawText(ctx, 'MARGIN %', padding + 470, hpHeadY + 16);

  let hpRowY = hpHeadY + 26;
  data.highProfitProducts.slice(0, 10).forEach((p, idx) => {
    ctx.fillStyle = '#0f172a';
    ctx.font = '700 11px system-ui, -apple-system, sans-serif';
    drawText(ctx, `${idx + 1}. ${p.name}`, padding + 18, hpRowY + 17, 250);

    ctx.fillStyle = '#64748b';
    ctx.font = '600 11px system-ui, -apple-system, sans-serif';
    drawText(ctx, formatCurrency(p.cost, data.currency, data.exchangeRate), padding + 280, hpRowY + 17);

    ctx.fillStyle = '#1d4ed8';
    ctx.font = '700 11px system-ui, -apple-system, sans-serif';
    drawText(ctx, formatCurrency(p.sell, data.currency, data.exchangeRate), padding + 370, hpRowY + 17);

    ctx.fillStyle = '#059669';
    ctx.font = '900 11px system-ui, -apple-system, sans-serif';
    drawText(ctx, `+${Math.round(p.marginPct)}%`, padding + 470, hpRowY + 17);

    hpRowY += 28;
  });

  // Right: Low Profit Margin
  drawRoundedRect(ctx, rightX, curY, halfWidth, marginTableHeight, 16, '#ffffff', '#e2e8f0', 1);
  ctx.fillStyle = '#0f172a';
  ctx.font = '800 12px system-ui, -apple-system, sans-serif';
  drawText(ctx, "⚠️ TOP 10: ALAABTA FAA'IIDADA YAR (LOW MARGIN)", rightX + 16, curY + 26);

  const lpHeadY = curY + 36;
  drawRoundedRect(ctx, rightX + 10, lpHeadY, halfWidth - 20, 24, 6, '#fff7ed');
  ctx.fillStyle = '#9a3412';
  ctx.font = '800 10px system-ui, -apple-system, sans-serif';
  drawText(ctx, 'ALAABTA', rightX + 18, lpHeadY + 16);
  drawText(ctx, 'COST', rightX + 280, lpHeadY + 16);
  drawText(ctx, 'IIBKA', rightX + 370, lpHeadY + 16);
  drawText(ctx, 'MARGIN %', rightX + 470, lpHeadY + 16);

  let lpRowY = lpHeadY + 26;
  data.lowProfitProducts.slice(0, 10).forEach((p, idx) => {
    ctx.fillStyle = '#0f172a';
    ctx.font = '700 11px system-ui, -apple-system, sans-serif';
    drawText(ctx, `${idx + 1}. ${p.name}`, rightX + 18, lpRowY + 17, 250);

    ctx.fillStyle = '#64748b';
    ctx.font = '600 11px system-ui, -apple-system, sans-serif';
    drawText(ctx, formatCurrency(p.cost, data.currency, data.exchangeRate), rightX + 280, lpRowY + 17);

    ctx.fillStyle = '#1d4ed8';
    ctx.font = '700 11px system-ui, -apple-system, sans-serif';
    drawText(ctx, formatCurrency(p.sell, data.currency, data.exchangeRate), rightX + 370, lpRowY + 17);

    ctx.fillStyle = '#d97706';
    ctx.font = '900 11px system-ui, -apple-system, sans-serif';
    drawText(ctx, `${Math.round(p.marginPct)}%`, rightX + 470, lpRowY + 17);

    lpRowY += 28;
  });

  curY += marginTableHeight + 20;

  // ================= 7. DUAL TABLES: LOW STOCK & EXPIRING PRODUCTS =================
  const stockTableHeight = 46 + Math.max(1, stockCount) * 30;

  // Left: Low Stock
  drawRoundedRect(ctx, padding, curY, halfWidth, stockTableHeight, 16, '#ffffff', '#e2e8f0', 1);
  ctx.fillStyle = '#0f172a';
  ctx.font = '800 12px system-ui, -apple-system, sans-serif';
  drawText(ctx, `🚨 TOP 10: ALAABTA DHAMAAN RABTA (${data.lowStockItems.length})`, padding + 16, curY + 26);

  const lsHeadY = curY + 36;
  drawRoundedRect(ctx, padding + 10, lsHeadY, halfWidth - 20, 24, 6, '#fef2f2');
  ctx.fillStyle = '#991b1b';
  ctx.font = '800 10px system-ui, -apple-system, sans-serif';
  drawText(ctx, 'ALAABTA', padding + 18, lsHeadY + 16);
  drawText(ctx, 'HARAAGA HADDA', padding + 360, lsHeadY + 16);
  drawText(ctx, 'STATUS', padding + 480, lsHeadY + 16);

  let lsRowY = lsHeadY + 26;
  if (data.lowStockItems.length === 0) {
    ctx.fillStyle = '#10b981';
    ctx.font = '600 11px system-ui, -apple-system, sans-serif';
    drawText(ctx, '✓ Dhammaan alaabtu stock fiican ayay leedahay.', padding + 18, lsRowY + 17);
  } else {
    data.lowStockItems.slice(0, 10).forEach((item, idx) => {
      ctx.fillStyle = '#0f172a';
      ctx.font = '700 11px system-ui, -apple-system, sans-serif';
      drawText(ctx, `${idx + 1}. ${item.name}`, padding + 18, lsRowY + 17, 320);

      ctx.fillStyle = '#e11d48';
      ctx.font = '900 11px system-ui, -apple-system, sans-serif';
      drawText(ctx, `${item.stock} ${item.unit || 'pcs'}`, padding + 360, lsRowY + 17);

      ctx.fillStyle = '#be123c';
      ctx.font = '700 10px system-ui, -apple-system, sans-serif';
      drawText(ctx, 'Dhamaanaysa', padding + 480, lsRowY + 17);

      lsRowY += 28;
    });
  }

  // Right: Expiring Soon
  drawRoundedRect(ctx, rightX, curY, halfWidth, stockTableHeight, 16, '#ffffff', '#e2e8f0', 1);
  ctx.fillStyle = '#0f172a';
  ctx.font = '800 12px system-ui, -apple-system, sans-serif';
  drawText(ctx, `⏳ TOP 10: ALAABTA DHICI RABTA (${data.expiringItems.length})`, rightX + 16, curY + 26);

  const expHeadY = curY + 36;
  drawRoundedRect(ctx, rightX + 10, expHeadY, halfWidth - 20, 24, 6, '#fff1f2');
  ctx.fillStyle = '#881337';
  ctx.font = '800 10px system-ui, -apple-system, sans-serif';
  drawText(ctx, 'ALAABTA', rightX + 18, expHeadY + 16);
  drawText(ctx, 'TAARIIKHDA DHICITAANKA', rightX + 330, expHeadY + 16);
  drawText(ctx, 'WAQTIGA', rightX + 480, expHeadY + 16);

  let expRowY = expHeadY + 26;
  if (data.expiringItems.length === 0) {
    ctx.fillStyle = '#10b981';
    ctx.font = '600 11px system-ui, -apple-system, sans-serif';
    drawText(ctx, '✓ Wax alaab ah oo waqtigoodu dhow yahay ma jiraan.', rightX + 18, expRowY + 17);
  } else {
    data.expiringItems.slice(0, 10).forEach((item, idx) => {
      ctx.fillStyle = '#0f172a';
      ctx.font = '700 11px system-ui, -apple-system, sans-serif';
      drawText(ctx, `${idx + 1}. ${item.name}`, rightX + 18, expRowY + 17, 300);

      ctx.fillStyle = '#be123c';
      ctx.font = '800 11px system-ui, -apple-system, sans-serif';
      drawText(ctx, item.expiryDate, rightX + 330, expRowY + 17);

      ctx.fillStyle = '#e11d48';
      ctx.font = '700 10px system-ui, -apple-system, sans-serif';
      drawText(ctx, `${item.daysLeft} maalmood`, rightX + 480, expRowY + 17);

      expRowY += 28;
    });
  }

  curY += stockTableHeight + 20;

  // ================= 8. TABLE: DADKA DEYMAHA LAGU LEEYAHAY & WAXAY QAATEEN =================
  const debtorTableHeight = 46 + Math.max(1, debtorCount) * 36;
  drawRoundedRect(ctx, padding, curY, contentWidth, debtorTableHeight, 16, '#ffffff', '#e2e8f0', 1);

  ctx.fillStyle = '#0f172a';
  ctx.font = '800 13px system-ui, -apple-system, sans-serif';
  drawText(ctx, `👥 TOP 10: DADKA DEYMAHA LAGU LEEYAHAY & WAXAY QAATEEN (${data.debtorsWithItems.length} Macamiil)`, padding + 20, curY + 26);

  const debHeadY = curY + 36;
  drawRoundedRect(ctx, padding + 12, debHeadY, contentWidth - 24, 28, 8, '#fef2f2');
  ctx.fillStyle = '#991b1b';
  ctx.font = '800 10px system-ui, -apple-system, sans-serif';
  drawText(ctx, 'MAGACA MACMIILKA', padding + 24, debHeadY + 18);
  drawText(ctx, 'TELEFOONKA', padding + 250, debHeadY + 18);
  drawText(ctx, 'WADARTA DEYNTA', padding + 400, debHeadY + 18);
  drawText(ctx, 'WAXYAABAHA UU QAATAY (ITEMS TAKEN ON CREDIT)', padding + 600, debHeadY + 18);

  let debRowY = debHeadY + 30;
  if (data.debtorsWithItems.length === 0) {
    ctx.fillStyle = '#10b981';
    ctx.font = '600 11px system-ui, -apple-system, sans-serif';
    drawText(ctx, '✓ Dukaanka wax deyn ah oo hadda ka maqan ma jirto.', padding + 24, debRowY + 18);
  } else {
    data.debtorsWithItems.slice(0, 10).forEach((d, idx) => {
      if (idx % 2 === 1) {
        drawRoundedRect(ctx, padding + 12, debRowY, contentWidth - 24, 32, 6, '#fff1f2');
      }

      ctx.fillStyle = '#0f172a';
      ctx.font = '800 11px system-ui, -apple-system, sans-serif';
      drawText(ctx, `${idx + 1}. ${d.name}`, padding + 24, debRowY + 20, 210);

      ctx.fillStyle = '#475569';
      ctx.font = '600 11px system-ui, -apple-system, sans-serif';
      drawText(ctx, d.phone || 'Tel la’aan', padding + 250, debRowY + 20);

      ctx.fillStyle = '#e11d48';
      ctx.font = '900 12px system-ui, -apple-system, sans-serif';
      drawText(ctx, formatCurrency(d.debtBalance, data.currency, data.exchangeRate), padding + 400, debRowY + 20);

      ctx.fillStyle = '#334155';
      ctx.font = '600 10px system-ui, -apple-system, sans-serif';
      drawText(ctx, d.itemsTaken || 'Alaab aan la qeexin', padding + 600, debRowY + 20, contentWidth - 620);

      debRowY += 34;
    });
  }

  curY += debtorTableHeight + 20;

  // ================= 9. ACCOUNTS & FOOTER =================
  const footerHeight = 110;
  drawRoundedRect(ctx, padding, curY, contentWidth, footerHeight, 16, '#0f172a');

  ctx.fillStyle = '#38bdf8';
  ctx.font = '800 12px system-ui, -apple-system, sans-serif';
  drawText(ctx, '🏦 LACAGAHA KU JIRA ACCOUNT-YADA DUKAANKA:', padding + 24, curY + 32);

  let accX = padding + 24;
  data.accounts.slice(0, 5).forEach(acc => {
    ctx.fillStyle = '#cbd5e1';
    ctx.font = '700 11px system-ui, -apple-system, sans-serif';
    const accStr = `${acc.name}: ${formatCurrency(acc.balance, data.currency, data.exchangeRate)}`;
    drawText(ctx, accStr, accX, curY + 56);
    accX += ctx.measureText(accStr).width + 30;
  });

  // Certified Footer & Verification
  ctx.fillStyle = '#64748b';
  ctx.font = '600 11px system-ui, -apple-system, sans-serif';
  drawText(ctx, `Shahaadada Xaqiijinta: Warbixintan waxaa si toos ah u soo saaray nidaamka ${data.storeName} ERP & POS.`, padding + 24, curY + 86);
  
  ctx.fillStyle = '#f59e0b';
  ctx.font = '800 11px system-ui, -apple-system, sans-serif';
  drawText(ctx, `Wadarta Akoonnada: ${formatCurrency(data.totalAccountsBalance, data.currency, data.exchangeRate)}`, padding + contentWidth - 260, curY + 32);

  // Convert canvas to Blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (!blob) {
          reject(new Error('Failed to create Blob from Canvas'));
          return;
        }
        const dataUrl = canvas.toDataURL('image/png');
        const filename = `Executive_Report_${data.targetTitle}_${Date.now()}.png`;
        resolve({ blob, dataUrl, filename });
      },
      'image/png',
      1.0
    );
  });
}
