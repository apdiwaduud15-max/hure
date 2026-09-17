
export const formatCurrency = (amount: number, currency: string, rate: number = 1) => {
  const value = currency === 'ETB' ? amount * rate : amount;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
  }).format(value);
};

// Formats product cost using the exact recorded price at entry - NEVER recalculated when exchange rate changes!
export const formatProductCost = (
  prod: { costPrice: number; costPriceETB?: number; costPriceUSD?: number; registeredCostRate?: number },
  currency: string,
  fallbackRate: number = 190
) => {
  if (currency === 'ETB') {
    const etb = (prod.costPriceETB !== undefined && prod.costPriceETB > 0)
      ? prod.costPriceETB
      : (prod.costPrice * (prod.registeredCostRate || fallbackRate || 190));
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'ETB',
    }).format(etb);
  }
  const usd = (prod.costPriceUSD !== undefined && prod.costPriceUSD > 0) ? prod.costPriceUSD : prod.costPrice;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(usd);
};

export const compressImage = (file: File, maxWidth: number = 200, maxHeight: number = 200): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > maxWidth) {
            height *= maxWidth / width;
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width *= maxHeight / height;
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
    };
    reader.onerror = (error) => reject(error);
  });
};

export const generateId = () => Math.random().toString(36).substr(2, 9);

export const formatWhatsAppReceipt = (
  tx: any,
  data: any,
  currency: string,
  rate: number
) => {
  const txRate = tx.exchangeRate || rate || 1;
  const customer = data.customers?.find((c: any) => c.id === tx.customerId);
  const customerName = customer ? customer.name : (tx.customerName || 'Walk-in Customer');
  const bizName = data.settings?.businessName || 'Supermarket';
  
  const pm = (tx.paymentMethod || '').toLowerCase();
  const isDebt = pm === 'debt' || pm.includes('debt') || pm.includes('deyn') || tx.type === 'CASH_LOAN';
  const isPartialDebt = tx.paymentMethod === 'Partial Payment' && (tx.paymentDetails?.debt || 0) > 0;

  const totalTakenUSD = tx.total || 0;
  const totalTakenETB = totalTakenUSD * txRate;

  let debtUSD = 0;
  if (isDebt) {
    debtUSD = totalTakenUSD;
  } else if (isPartialDebt) {
    debtUSD = tx.paymentDetails?.debt || 0;
  }
  const debtETB = debtUSD * txRate;

  const paidUSD = Math.max(0, totalTakenUSD - debtUSD);
  const paidETB = paidUSD * txRate;

  let msg = `🧾 *${bizName} - RISIIDKA IIBKA / SALES RECEIPT*\n`;
  msg += `----------------------------------------\n`;
  msg += `📄 *Invoice:* #INV-${(tx.id || '').slice(-5).toUpperCase()}\n`;
  msg += `📅 *Date:* ${new Date(tx.timestamp || Date.now()).toLocaleString()}\n`;
  msg += `👤 *Customer:* ${customerName}\n`;
  if (tx.pageNumber) msg += `📖 *Page #:* ${tx.pageNumber}\n`;
  msg += `💱 *Sarifkii Maalintii Iibka:* $1 = ${txRate} ETB\n`;
  msg += `💳 *Payment Method:* ${tx.paymentMethod}\n`;
  if (isDebt) {
    msg += `🔴 *STATUS:* ❌ NOT PAID (DEYN / UNPAID)\n`;
  } else if (isPartialDebt) {
    msg += `🟡 *STATUS:* ⚠️ PARTIALLY PAID (Qayb Deyn ah)\n`;
  } else {
    msg += `🟢 *STATUS:* ✅ PAID / CASH (CONFIRMED)\n`;
  }
  msg += `----------------------------------------\n`;
  msg += `*ALAABTA LA IIBSADAY (ITEMS TAKEN):*\n`;
  
  if (tx.items && tx.items.length > 0) {
    tx.items.forEach((item: any, i: number) => {
      const itemTotal = (item.sellPrice || 0) * (item.quantity || 1);
      msg += `${i + 1}. ${item.name} x${item.quantity} = $${itemTotal.toFixed(2)} (${(itemTotal * txRate).toLocaleString()} ETB)\n`;
    });
  }

  msg += `----------------------------------------\n`;
  msg += `📊 *XISAABINTA GUUD (CALCULATION BREAKDOWN):*\n`;
  msg += `🛍️ *1. Inta uu Qaatay (Wadarta Iibka):* $${totalTakenUSD.toFixed(2)} USD (${totalTakenETB.toLocaleString(undefined, { maximumFractionDigits: 1 })} ETB)\n`;
  msg += `➖ 💳 *2. Laga Jaray (Inta uu Bixiyay):* $${paidUSD.toFixed(2)} USD (${paidETB.toLocaleString(undefined, { maximumFractionDigits: 1 })} ETB)\n`;
  msg += `🟰 ⚠️ *3. Inta ku Harsan (Deynta Hadhay):* $${debtUSD.toFixed(2)} USD (${debtETB.toLocaleString(undefined, { maximumFractionDigits: 1 })} ETB)\n`;
  msg += `💱 *4. Sarifkii Maalinkaas:* $1 = ${txRate} ETB\n`;

  // Payment Numbers
  const ebirrNo = data.settings?.onlinePaymentNumbers?.ebirr || '0901234567';
  const cbeNo = data.settings?.onlinePaymentNumbers?.commercialBank || '1000123456789';
  const kaafiNo = data.settings?.onlinePaymentNumbers?.kaafi || data.settings?.onlinePaymentNumbers?.golis || '0631234567';

  msg += `----------------------------------------\n`;
  msg += `💳 *AKOONNADA LACAG BIXINTA (PAYMENT ACCOUNTS):*\n`;
  msg += `📱 *1. E-Birr / Telebirr:* ${ebirrNo}\n`;
  msg += `🏦 *2. CBE Bank:* ${cbeNo}\n`;
  msg += `💳 *3. Kaafi / Zaad:* ${kaafiNo}\n`;
  msg += `----------------------------------------\n`;
  if (isDebt || isPartialDebt) {
    msg += `📢 *Fadlan bixi lacagta deynta lagugu leeyahay adoo raali ah.*\n`;
  }
  msg += `Mahadsanid! Thank you for your business! 🙏`;

  return msg;
};

export const formatMonthlyDebtStatement = (
  customer: any,
  data: any,
  currency: string,
  rate: number = 1,
  includeItemizedDetails: boolean = true
) => {
  const bizName = data.settings?.businessName || 'Supermarket';
  const todayStr = new Date().toLocaleDateString('so-SO', { year: 'numeric', month: 'long', day: 'numeric' });
  const ebirrNo = data.settings?.onlinePaymentNumbers?.ebirr || '0901234567';
  const cbeNo = data.settings?.onlinePaymentNumbers?.commercialBank || '1000123456789';
  const kaafiNo = data.settings?.onlinePaymentNumbers?.kaafi || data.settings?.onlinePaymentNumbers?.golis || '0631234567';

  let msg = `📊 *${bizName} - QORALKA DEYNTA GUUD & ALAABTA (DEBT STATEMENT)*\n`;
  msg += `----------------------------------------\n`;
  msg += `👤 *Macaamiilka:* ${customer.name}\n`;
  if (customer.phone) msg += `📱 *Telefoonka:* ${customer.phone}\n`;
  msg += `📅 *Taariikhda:* ${todayStr}\n`;
  msg += `🔴 *STATUS:* ❌ NOT PAID (DEYN)\n`;
  msg += `----------------------------------------\n`;

  // Itemized history
  const customerTxs = (data.transactions || [])
    .filter((t: any) => t.customerId === customer.id || (t.customerName && t.customerName === customer.name))
    .sort((a: any, b: any) => (a.timestamp || 0) - (b.timestamp || 0));

  let grandTotalTakenUSD = 0;
  let grandTotalTakenETB = 0;
  let grandTotalPaidUSD = 0;
  let grandTotalPaidETB = 0;

  if (includeItemizedDetails && customerTxs.length > 0) {
    msg += `📦 *ALAABTA IYO DIWAANKA DEYNTA EE LAGU QAATAY:*\n\n`;

    customerTxs.forEach((tx: any, idx: number) => {
      const txDate = new Date(tx.timestamp).toLocaleDateString('so-SO', { month: 'short', day: 'numeric', year: 'numeric' });
      const txRate = tx.exchangeRate || rate || 1;
      const isCredit = tx.paymentMethod === 'Debt' || tx.paymentMethod === 'Partial Payment';
      const isCashLoan = tx.type === 'CASH_LOAN';
      const isPayment = tx.type === 'DEBT_PAYMENT';

      if (isCredit || isCashLoan) {
        const invTotalUSD = tx.total || 0;
        const invTotalETB = invTotalUSD * txRate;
        grandTotalTakenUSD += invTotalUSD;
        grandTotalTakenETB += invTotalETB;

        let invDebtUSD = invTotalUSD;
        if (tx.paymentMethod === 'Partial Payment' && tx.paymentDetails?.debt !== undefined) {
          invDebtUSD = tx.paymentDetails.debt;
          const invPaid = Math.max(0, invTotalUSD - invDebtUSD);
          grandTotalPaidUSD += invPaid;
          grandTotalPaidETB += invPaid * txRate;
        }

        msg += `🗓️ *Taariikh:* ${txDate} (${isCashLoan ? 'Dayn Cash' : `#INV-${(tx.id || '').slice(-5).toUpperCase()}`})\n`;
        msg += `   💱 *Sarifkii Maalinkaas:* $1 = ${txRate} ETB\n`;
        if (tx.items && tx.items.length > 0) {
          tx.items.forEach((item: any) => {
            const itemTotalUSD = (item.sellPrice || 0) * (item.quantity || 1);
            const itemTotalETB = itemTotalUSD * txRate;
            msg += `   • ${item.name} | Qty: ${item.quantity} x $${(item.sellPrice || 0).toFixed(2)} = $${itemTotalUSD.toFixed(2)} (${itemTotalETB.toLocaleString(undefined, { maximumFractionDigits: 1 })} ETB)\n`;
          });
        } else if (isCashLoan) {
          msg += `   • Dayn Lacag Cadaan ah: $${tx.total.toFixed(2)} (${invTotalETB.toLocaleString()} ETB)\n`;
        }
        msg += `   🛍️ *Wadarta Qaatay:* $${invTotalUSD.toFixed(2)} USD (${invTotalETB.toLocaleString(undefined, { maximumFractionDigits: 1 })} ETB)\n\n`;
      } else if (isPayment) {
        const paymentUSD = tx.total || 0;
        const paymentETB = paymentUSD * txRate;
        grandTotalPaidUSD += paymentUSD;
        grandTotalPaidETB += paymentETB;
        msg += `🟢 *Taariikh:* ${txDate} - *Bixinta Deynta:* -$${paymentUSD.toFixed(2)} USD (-${paymentETB.toLocaleString(undefined, { maximumFractionDigits: 1 })} ETB) [Sarif: $1=${txRate}]\n\n`;
      }
    });
    msg += `----------------------------------------\n`;
  }

  const remainingDebtUSD = customer.debtBalance || 0;
  const remainingDebtETB = remainingDebtUSD * (rate || 1);

  msg += `📊 *XISAAB-XIDHKA GUUD (SUMMARY BREAKDOWN):*\n`;
  if (grandTotalTakenUSD > 0) {
    msg += `🛍️ *1. Wadarta Iibka uu Qaatay:* $${grandTotalTakenUSD.toFixed(2)} USD (${grandTotalTakenETB.toLocaleString(undefined, { maximumFractionDigits: 1 })} ETB)\n`;
    msg += `➖ 💳 *2. Laga Jaray (Wadarta Bixiyay):* $${grandTotalPaidUSD.toFixed(2)} USD (${grandTotalPaidETB.toLocaleString(undefined, { maximumFractionDigits: 1 })} ETB)\n`;
  }
  msg += `🟰 ⚠️ *3. Wadarta Deynta Hadda ku Harsan:* $${remainingDebtUSD.toFixed(2)} USD (${remainingDebtETB.toLocaleString(undefined, { maximumFractionDigits: 1 })} ETB)\n`;
  msg += `----------------------------------------\n`;
  msg += `💳 *AKOONNADA LACAGTA LAGU SOO DIRO (PAYMENT ACCOUNTS):*\n`;
  msg += `📱 *1. E-Birr / Telebirr:* ${ebirrNo}\n`;
  msg += `🏦 *2. CBE Bank:* ${cbeNo}\n`;
  msg += `💳 *3. Kaafi / Zaad:* ${kaafiNo}\n`;
  msg += `----------------------------------------\n`;
  msg += `📢 *Fadlan bixi lacagta deynta lagugu leeyahay adoo raali ah.*\n`;
  msg += `Mahadsanid wada shaqayntaada! 🙏`;

  return msg;
};

import { 
  generateTransactionReceiptCanvas, 
  generateDebtStatementCanvas, 
  dispatchWhatsAppImageShare 
} from './receiptImageGenerator';

export const sendMonthlyDebtStatement = async (
  customer: any,
  data: any,
  currency: string,
  rate: number = 1,
  includeItemizedDetails: boolean = true
) => {
  let phone = customer?.phone || '';
  if (!phone) {
    const inputPhone = prompt(`Geli lambarka WhatsApp-ka ee macaamiilka (${customer.name}):`);
    if (!inputPhone) return;
    phone = inputPhone;
  }
  const cleanPhone = phone.replace(/[^\d]/g, '');

  try {
    const { blob, dataUrl } = await generateDebtStatementCanvas(customer, data, currency, rate, includeItemizedDetails);
    const safeCustName = (customer.name || 'Customer').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `Debt_Statement_${safeCustName}.png`;

    dispatchWhatsAppImageShare({
      blob,
      dataUrl,
      filename,
      phone: cleanPhone,
      customerName: customer.name,
      title: `Warqadda Deynta - ${customer.name}`
    });
  } catch (err) {
    console.error('Failed to generate image statement:', err);
    // Fallback to text if canvas fails
    const text = formatMonthlyDebtStatement(customer, data, currency, rate, includeItemizedDetails);
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  }
};

export const sendWhatsAppReceipt = async (
  tx: any,
  data: any,
  currency: string,
  rate: number
) => {
  const txRate = tx.exchangeRate || rate || 1;
  const customer = data.customers?.find((c: any) => c.id === tx.customerId);
  const customerName = customer ? customer.name : (tx.customerName || 'Customer');
  let phone = customer?.phone || '';
  if (!phone) {
    const inputPhone = prompt("Geli lambarka WhatsApp-ka ee macamiilka (Format e.g. 25261xxxxxxx):");
    if (!inputPhone) return;
    phone = inputPhone;
  }
  const cleanPhone = phone.replace(/[^\d]/g, '');

  try {
    const { blob, dataUrl } = await generateTransactionReceiptCanvas(tx, data, currency, txRate);
    const invNo = (tx.id || 'INV').slice(-6).toUpperCase();
    const filename = `Invoice_INV-${invNo}.png`;

    dispatchWhatsAppImageShare({
      blob,
      dataUrl,
      filename,
      phone: cleanPhone,
      customerName,
      title: `Rasiidka Iibka #INV-${invNo}`
    });
  } catch (err) {
    console.error('Failed to generate image receipt:', err);
    // Fallback to text if canvas fails
    const text = formatWhatsAppReceipt(tx, data, currency, txRate);
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank');
  }
};
