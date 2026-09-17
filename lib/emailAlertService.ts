import emailjs from '@emailjs/browser';
import { AppData, Transaction, Currency } from '../types';

export interface AlertNotificationPayload {
  toEmail: string;
  subject: string;
  type: 'INSTANT_SALE' | 'INSTANT_CONFIRM' | 'TWO_HOUR_REPORT' | 'TEST_ALERT' | 'EXECUTIVE_REPORT';
  html: string;
  text: string;
  timestamp: number;
  metadata?: Record<string, any>;
  storeName?: string;
  emailJsConfig?: EmailJsConfig;
}

export interface EmailJsConfig {
  serviceId: string;
  templateId: string;
  publicKey: string;
  privateKey?: string;
}

/**
 * Direct EmailJS sender using @emailjs/browser with REST API fallback
 */
export async function sendViaEmailJS(
  config: EmailJsConfig,
  params: {
    toEmail: string;
    subject: string;
    message: string;
    htmlContent?: string;
    storeName?: string;
    reportType?: string;
    metadata?: Record<string, any>;
  }
): Promise<{ success: boolean; message: string; source?: 'emailjs-sdk' | 'emailjs-rest' }> {
  const serviceId = config.serviceId?.trim();
  const templateId = config.templateId?.trim();
  const publicKey = config.publicKey?.trim();
  const privateKey = config.privateKey?.trim();

  if (!serviceId || !templateId || !publicKey) {
    return {
      success: false,
      message: 'Fadlan geli Service ID, Template ID, iyo Public Key ee EmailJS.'
    };
  }

  const templateParams: Record<string, any> = {
    to_email: params.toEmail,
    email: params.toEmail,
    recipient_email: params.toEmail,
    to_name: 'Admin / Manager',
    from_name: params.storeName || 'Xaysimo Supermarket ERP',
    reply_to: params.toEmail,
    subject: params.subject,
    title: params.subject,
    message: params.message,
    body: params.message,
    html_content: params.htmlContent || params.message,
    content: params.htmlContent || params.message,
    store_name: params.storeName || 'Xaysimo Supermarket',
    report_type: params.reportType || 'ALERT',
    date_time: new Date().toLocaleString('so-SO', { timeZone: 'Africa/Mogadishu' }),
    ...(params.metadata || {})
  };

  // Attempt 1: Using @emailjs/browser SDK
  try {
    const res = await emailjs.send(
      serviceId,
      templateId,
      templateParams,
      { publicKey }
    );
    if (res.status === 200) {
      return {
        success: true,
        message: `Email si toos ah ayaa loogu diray EmailJS (${res.text || 'OK'})`,
        source: 'emailjs-sdk'
      };
    }
  } catch (sdkErr: any) {
    console.warn('EmailJS browser SDK attempt failed, attempting direct REST endpoint:', sdkErr?.text || sdkErr?.message);
  }

  // Attempt 2: Direct REST POST to EmailJS API
  try {
    const postBody: Record<string, any> = {
      service_id: serviceId,
      template_id: templateId,
      user_id: publicKey,
      template_params: templateParams
    };
    if (privateKey) {
      postBody.accessToken = privateKey;
    }

    const restRes = await fetch('https://api.emailjs.com/api/v1.0/email/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(postBody)
    });

    if (restRes.ok) {
      return {
        success: true,
        message: 'Email si toos ah ayaa loogu diray EmailJS REST API',
        source: 'emailjs-rest'
      };
    }

    const errBody = await restRes.text().catch(() => '');
    return {
      success: false,
      message: `EmailJS error (${restRes.status}): ${errBody || 'Failed to send email'}`,
      source: 'emailjs-rest'
    };
  } catch (restErr: any) {
    return {
      success: false,
      message: `Cillad EmailJS: ${restErr?.message || 'Network error'}`
    };
  }
}

/**
 * Format currency with fallback
 */
function formatMoney(amount: number, currency: Currency = Currency.USD, rate: number = 150): string {
  if (currency === Currency.ETB) {
    return `${(amount * (rate || 1)).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ETB`;
  }
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD`;
}

/**
 * Dispatches notification to EmailJS (if configured) and backend server
 */
export async function dispatchEmailAlert(
  payload: AlertNotificationPayload,
  emailJsConfig?: EmailJsConfig
): Promise<{ success: boolean; message: string }> {
  try {
    if (!payload.toEmail || !payload.toEmail.includes('@')) {
      return { success: false, message: 'Email address is not configured.' };
    }

    // 1. If EmailJS configuration is provided, send through EmailJS first
    if (emailJsConfig?.serviceId && emailJsConfig?.templateId && emailJsConfig?.publicKey) {
      const emailJsResult = await sendViaEmailJS(emailJsConfig, {
        toEmail: payload.toEmail,
        subject: payload.subject,
        message: payload.text,
        htmlContent: payload.html,
        storeName: payload.storeName,
        reportType: payload.type,
        metadata: payload.metadata
      });

      if (emailJsResult.success) {
        return emailJsResult;
      }
      console.warn('EmailJS dispatch warning, falling back to server dispatch:', emailJsResult.message);
    }

    // 2. Server dispatch fallback
    const res = await fetch('/api/notifications/dispatch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...payload,
        emailJsConfig
      })
    });

    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      return { success: false, message: errData.error || 'Failed to dispatch email' };
    }

    const data = await res.json();
    return { success: true, message: data.message || 'Alert dispatched successfully' };
  } catch (err: any) {
    console.warn('Email dispatch offline/failed:', err?.message);
    return { success: false, message: err?.message || 'Network error' };
  }
}

/**
 * Instant Alert on Save, Checkout, or Confirm (Isla Ilbiriqsigaas)
 */
export async function sendInstantTransactionAlert(
  appData: AppData,
  transaction: Transaction,
  actionType: 'CHECKOUT' | 'CONFIRM' | 'SAVE' = 'CHECKOUT'
) {
  const targetEmail = appData.settings?.adminAlertEmail;
  if (!targetEmail || !targetEmail.trim()) {
    return; // User has not specified an email in settings yet
  }

  const currency = appData.settings.defaultCurrency || Currency.ETB;
  const rate = appData.settings.exchangeRate || 150;
  const storeName = appData.settings.businessName || 'Xaysimo Supermarket';
  const timeStr = new Date(transaction.timestamp).toLocaleString('so-SO', {
    timeZone: 'Africa/Mogadishu',
    dateStyle: 'full',
    timeStyle: 'medium'
  });

  const actionLabel = actionType === 'CHECKOUT' 
    ? 'Iib Cusub (Checkout Completed)' 
    : actionType === 'CONFIRM' 
    ? 'Xaqiijin Iib (Confirmed Sale)' 
    : 'Diiwaangelin (Saved)';

  const itemsListHtml = (transaction.items || []).map((item, idx) => `
    <tr style="border-bottom: 1px solid #e2e8f0; font-size: 13px;">
      <td style="padding: 8px 4px; font-weight: bold; color: #1e293b;">${idx + 1}. ${item.name}</td>
      <td style="padding: 8px 4px; text-align: center; color: #475569;">${item.quantity} ${item.unit || 'pcs'}</td>
      <td style="padding: 8px 4px; text-align: right; color: #475569;">${formatMoney(item.sellPrice, currency, rate)}</td>
      <td style="padding: 8px 4px; text-align: right; font-weight: bold; color: #0f172a;">${formatMoney(item.sellPrice * item.quantity, currency, rate)}</td>
    </tr>
  `).join('');

  const subject = `⚡ [${storeName}] ${actionLabel} - ${formatMoney(transaction.total, currency, rate)} (#${transaction.id})`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; background-color: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05);">
      <div style="background: linear-gradient(135deg, #2563eb, #1e40af); padding: 24px; color: #ffffff; text-align: center;">
        <h1 style="margin: 0; font-size: 20px; font-weight: 800; letter-spacing: -0.5px;">${storeName}</h1>
        <p style="margin: 4px 0 0; font-size: 12px; opacity: 0.85; text-transform: uppercase; font-weight: 700; letter-spacing: 1px;">Digniin Toos Ah (Instant Sale & Checkout Alert)</p>
      </div>

      <div style="padding: 24px;">
        <div style="background-color: #f8fafc; border-left: 4px solid #2563eb; padding: 12px 16px; border-radius: 8px; margin-bottom: 20px;">
          <div style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">Wadarta Iibka / Total Amount</div>
          <div style="font-size: 28px; font-weight: 900; color: #16a34a; font-family: monospace;">${formatMoney(transaction.total, currency, rate)}</div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Receipt / Invoice ID:</td>
            <td style="padding: 6px 0; font-weight: 800; color: #0f172a; text-align: right; font-family: monospace;">#${transaction.id}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Waqtiga (Timestamp):</td>
            <td style="padding: 6px 0; font-weight: 600; color: #334155; text-align: right;">${timeStr}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Habka Lacag-bixinta (Payment):</td>
            <td style="padding: 6px 0; font-weight: 800; color: #2563eb; text-align: right;">${transaction.paymentMethod}</td>
          </tr>
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Cashier / Qofka Iibiyay:</td>
            <td style="padding: 6px 0; font-weight: 700; color: #334155; text-align: right;">${transaction.cashierName || appData.settings.currentUser.name || 'Cashier'}</td>
          </tr>
          ${transaction.customerName ? `
          <tr>
            <td style="padding: 6px 0; color: #64748b; font-weight: 600;">Macamiilka (Customer):</td>
            <td style="padding: 6px 0; font-weight: 700; color: #0f172a; text-align: right;">${transaction.customerName}</td>
          </tr>
          ` : ''}
        </table>

        <div style="margin-top: 20px;">
          <h3 style="margin: 0 0 10px; font-size: 14px; font-weight: 800; color: #0f172a; border-bottom: 2px solid #f1f5f9; padding-bottom: 6px;">Alaabta La Iibiyay (Items List)</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background-color: #f1f5f9; text-align: left; font-size: 11px; text-transform: uppercase; color: #475569;">
                <th style="padding: 8px 4px;">Alaabta</th>
                <th style="padding: 8px 4px; text-align: center;">Tirada</th>
                <th style="padding: 8px 4px; text-align: right;">Qiimaha</th>
                <th style="padding: 8px 4px; text-align: right;">Wadarta</th>
              </tr>
            </thead>
            <tbody>
              ${itemsListHtml}
            </tbody>
          </table>
        </div>

        <div style="margin-top: 24px; padding: 16px; background-color: #f8fafc; border-radius: 12px; font-size: 11px; color: #64748b; text-align: center; border: 1px dashed #cbd5e1;">
          Xogtan waxaa si toos ah (isla ilbiriqsigaas) u soo dirtay nidaamka <strong>${storeName} Cloud ERP</strong>.
        </div>
      </div>
    </div>
  `;

  const text = `
[${storeName}] INSTANT SALE ALERT
Wadarta: ${formatMoney(transaction.total, currency, rate)}
Invoice ID: #${transaction.id}
Waqtiga: ${timeStr}
Habka Bixinta: ${transaction.paymentMethod}
Cashier: ${transaction.cashierName || appData.settings.currentUser.name}
${transaction.customerName ? `Macamiil: ${transaction.customerName}\n` : ''}
Alaabta:
${(transaction.items || []).map(i => `- ${i.name} x${i.quantity} = ${formatMoney(i.sellPrice * i.quantity, currency, rate)}`).join('\n')}
  `.trim();

  const emailJsConfig: EmailJsConfig | undefined = (
    appData.settings?.emailJsServiceId &&
    appData.settings?.emailJsTemplateId &&
    appData.settings?.emailJsPublicKey
  ) ? {
    serviceId: appData.settings.emailJsServiceId,
    templateId: appData.settings.emailJsTemplateId,
    publicKey: appData.settings.emailJsPublicKey,
    privateKey: appData.settings.emailJsPrivateKey
  } : undefined;

  return dispatchEmailAlert({
    toEmail: targetEmail,
    subject,
    type: 'INSTANT_SALE',
    html,
    text,
    timestamp: Date.now(),
    storeName,
    emailJsConfig,
    metadata: {
      transactionId: transaction.id,
      total: transaction.total,
      currency
    }
  }, emailJsConfig);
}

/**
 * 2-Hour Full Store Data Report (2h Walba Warbixin Buuxda)
 */
export async function sendTwoHourPeriodicReport(appData: AppData) {
  const targetEmail = appData.settings?.adminAlertEmail;
  if (!targetEmail || !targetEmail.trim()) {
    return;
  }

  const currency = appData.settings.defaultCurrency || Currency.ETB;
  const rate = appData.settings.exchangeRate || 150;
  const storeName = appData.settings.businessName || 'Xaysimo Supermarket';
  const now = Date.now();
  const twoHoursAgo = now - (2 * 60 * 60 * 1000);
  const todayStart = new Date().setHours(0, 0, 0, 0);

  // Filter transactions
  const recent2hSales = (appData.transactions || []).filter(t => t.timestamp >= twoHoursAgo && (t.type === 'SALE' || !t.type));
  const todaySales = (appData.transactions || []).filter(t => t.timestamp >= todayStart && (t.type === 'SALE' || !t.type));

  const total2hRevenue = recent2hSales.reduce((sum, t) => sum + (t.total || 0), 0);
  const totalTodayRevenue = todaySales.reduce((sum, t) => sum + (t.total || 0), 0);

  // Profit calculation
  const totalTodayProfit = todaySales.reduce((acc, t) => {
    const cost = (t.items || []).reduce((s, i) => s + ((i.costPrice || 0) * (i.quantity || 1)), 0);
    return acc + (t.total - cost);
  }, 0);

  // Expenses
  const todayExpenses = (appData.expenses || []).filter(e => (e.timestamp || 0) >= todayStart).reduce((s, e) => s + (e.amount || 0), 0);

  // Debtors summary
  const debtorsList = (appData.customers || []).filter(c => (c.debtBalance || 0) > 0);
  const totalDebt = debtorsList.reduce((sum, c) => sum + (c.debtBalance || 0), 0);

  // Accounts summary
  const accountsHtml = (appData.accounts || []).map(acc => `
    <li style="margin-bottom: 4px; color: #334155;">
      <strong>${acc.name} (${acc.type}):</strong> ${formatMoney(acc.balance || 0, currency, rate)}
    </li>
  `).join('');

  // Low stock items
  const lowStock = (appData.products || []).filter(p => p.stock <= (p.minStock ?? 5));

  const timeStr = new Date(now).toLocaleString('so-SO', {
    timeZone: 'Africa/Mogadishu',
    dateStyle: 'full',
    timeStyle: 'medium'
  });

  const subject = `📊 [${storeName}] Warbixinta 2-da Saacadood (2h Report) - Iibka Maanta: ${formatMoney(totalTodayRevenue, currency, rate)}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 650px; margin: 0 auto; background-color: #ffffff; border: 1px solid #cbd5e1; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 16px rgba(0,0,0,0.06);">
      <div style="background: linear-gradient(135deg, #0f172a, #1e293b); padding: 24px; color: #ffffff; text-align: center;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 800;">${storeName}</h1>
        <p style="margin: 6px 0 0; font-size: 13px; color: #38bdf8; font-weight: 700; text-transform: uppercase; letter-spacing: 1px;">
          WARBIXINTA 2-DA SAACADOOD EE DUKAANKA (2-HOUR SUMMARY)
        </p>
        <p style="margin: 4px 0 0; font-size: 11px; opacity: 0.75;">${timeStr}</p>
      </div>

      <div style="padding: 24px;">
        <!-- Highlights Box Grid -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 14px; border-radius: 12px;">
            <div style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase;">Iibka 2-dii Saacadoo U Dambeysay</div>
            <div style="font-size: 20px; font-weight: 900; color: #15803d; font-family: monospace;">${formatMoney(total2hRevenue, currency, rate)}</div>
            <div style="font-size: 11px; color: #4ade80; margin-top: 2px;">${recent2hSales.length} Iib/Transactions</div>
          </div>

          <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 14px; border-radius: 12px;">
            <div style="font-size: 11px; font-weight: 700; color: #1e40af; text-transform: uppercase;">Wadarta Iibka Maanta (Today's Sales)</div>
            <div style="font-size: 20px; font-weight: 900; color: #1d4ed8; font-family: monospace;">${formatMoney(totalTodayRevenue, currency, rate)}</div>
            <div style="font-size: 11px; color: #60a5fa; margin-top: 2px;">Faa'iido: ${formatMoney(totalTodayProfit, currency, rate)}</div>
          </div>
        </div>

        <!-- Finances & Balances -->
        <div style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 10px; font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase; border-bottom: 1px solid #cbd5e1; padding-bottom: 4px;">
            Xisaabaadka & Balances-ka (Accounts)
          </h3>
          <ul style="margin: 0; padding-left: 20px; font-size: 13px;">
            ${accountsHtml || '<li>Account-yo diwaan gashan ma jiraan</li>'}
          </ul>
        </div>

        <!-- Debtors & Stock Alerts -->
        <div style="background-color: #fef2f2; border: 1px solid #fecaca; border-radius: 12px; padding: 16px; margin-bottom: 20px;">
          <h3 style="margin: 0 0 8px; font-size: 13px; font-weight: 800; color: #991b1b; text-transform: uppercase;">
            Deymaha & Alaabta Dhamaanaysa (Alerts)
          </h3>
          <p style="margin: 0 0 6px; font-size: 13px; color: #7f1d1d;">
            <strong>Wadarta Deynta Dibadda:</strong> ${formatMoney(totalDebt, currency, rate)} (${debtorsList.length} Macaamiil)
          </p>
          <p style="margin: 0; font-size: 13px; color: #7f1d1d;">
            <strong>Alaabta Go'an / Dhamaanaysa:</strong> ${lowStock.length} Alaabood
          </p>
        </div>

        <div style="text-align: center; padding-top: 12px; border-top: 1px solid #e2e8f0; font-size: 11px; color: #94a3b8;">
          Warbixintan waxaa loo diray <strong>${targetEmail}</strong> via EmailJS / Cloud Alert Service.
        </div>
      </div>
    </div>
  `;

  const text = `
[${storeName}] WARBIXINTA 2-DA SAACADOOD
Waqtiga: ${timeStr}
Iibka 2-dii Saacadood: ${formatMoney(total2hRevenue, currency, rate)} (${recent2hSales.length} Iib)
Wadarta Iibka Maanta: ${formatMoney(totalTodayRevenue, currency, rate)}
Faa'iidada Maanta: ${formatMoney(totalTodayProfit, currency, rate)}
Kharashka Maanta: ${formatMoney(todayExpenses, currency, rate)}
Wadarta Deynta: ${formatMoney(totalDebt, currency, rate)} (${debtorsList.length} Macaamiil)
Alaabta Dhamaanaysa: ${lowStock.length}
  `.trim();

  const emailJsConfig: EmailJsConfig | undefined = (
    appData.settings?.emailJsServiceId &&
    appData.settings?.emailJsTemplateId &&
    appData.settings?.emailJsPublicKey
  ) ? {
    serviceId: appData.settings.emailJsServiceId,
    templateId: appData.settings.emailJsTemplateId,
    publicKey: appData.settings.emailJsPublicKey,
    privateKey: appData.settings.emailJsPrivateKey
  } : undefined;

  return dispatchEmailAlert({
    toEmail: targetEmail,
    subject,
    type: 'TWO_HOUR_REPORT',
    html,
    text,
    timestamp: now,
    storeName,
    emailJsConfig
  }, emailJsConfig);
}

/**
 * Send Live Test Email via EmailJS
 */
export async function testEmailJsAlert(
  appData: AppData,
  customEmail?: string
): Promise<{ success: boolean; message: string }> {
  const targetEmail = customEmail || appData.settings?.adminAlertEmail;
  if (!targetEmail || !targetEmail.trim()) {
    return { success: false, message: 'Fadlan geli email sax ah ka hor inta aadan dirin.' };
  }

  const storeName = appData.settings?.businessName || 'Xaysimo Supermarket';
  const emailJsConfig: EmailJsConfig | undefined = (
    appData.settings?.emailJsServiceId &&
    appData.settings?.emailJsTemplateId &&
    appData.settings?.emailJsPublicKey
  ) ? {
    serviceId: appData.settings.emailJsServiceId,
    templateId: appData.settings.emailJsTemplateId,
    publicKey: appData.settings.emailJsPublicKey,
    privateKey: appData.settings.emailJsPrivateKey
  } : undefined;

  const subject = `🧪 [${storeName}] Tijaabada EmailJS - Ku Xirnaanshaha Waa Sax!`;
  const text = `Hambalyo! Nidaamka Xaysimo Supermarket ERP wuxuu si toos ah ugu xirmay EmailJS. Dhammaan digniinaha iibka iyo warbixinaha dukaanka waxay toos ugu soo dhici doonaan email-kaaga: ${targetEmail}`;
  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 550px; margin: 0 auto; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 16px; overflow: hidden;">
      <div style="background: linear-gradient(135deg, #16a34a, #15803d); padding: 24px; text-align: center; color: #ffffff;">
        <h2 style="margin: 0; font-size: 20px; font-weight: 800;">✅ EmailJS Waa Ku Xirmay!</h2>
        <p style="margin: 6px 0 0; font-size: 12px; opacity: 0.9;">Xaysimo Supermarket ERP Cloud Integration</p>
      </div>
      <div style="padding: 24px; color: #334155; line-height: 1.6; font-size: 14px;">
        <p>Hambalyo! Nidaamka wuxuu xaqiijiyay in EmailJS u shaqeynayo si heer sare ah.</p>
        <div style="background: #f8fafc; border-left: 4px solid #16a34a; padding: 12px; border-radius: 6px; margin: 16px 0;">
          <strong>Email-ka Qabtay:</strong> ${targetEmail}<br/>
          <strong>Waqtiga:</strong> ${new Date().toLocaleString('so-SO', { timeZone: 'Africa/Mogadishu' })}<br/>
          <strong>Dukaanka:</strong> ${storeName}
        </div>
        <p style="font-size: 12px; color: #64748b;">Hadda ka dib, iib kasta oo cusub iyo warbixin kasta oo maamulka ah waxay toos ugu soo dhici doontaa halkan!</p>
      </div>
    </div>
  `;

  return dispatchEmailAlert({
    toEmail: targetEmail,
    subject,
    type: 'TEST_ALERT',
    html,
    text,
    timestamp: Date.now(),
    storeName,
    emailJsConfig
  }, emailJsConfig);
}

/**
 * Send Full Executive Report Email via EmailJS or Dispatch
 */
export async function sendStoreExecutiveReportEmail(
  appData: AppData,
  reportSummary: {
    periodTitle: string;
    totalRevenue: number;
    totalProfit: number;
    totalExpenses: number;
    totalDebt: number;
    debtorsCount: number;
    lowStockCount: number;
    expiringCount: number;
  },
  customRecipient?: string
): Promise<{ success: boolean; message: string }> {
  const targetEmail = customRecipient || appData.settings?.adminAlertEmail;
  if (!targetEmail || !targetEmail.trim()) {
    return { success: false, message: 'Email address is not configured.' };
  }

  const currency = appData.settings?.defaultCurrency || Currency.ETB;
  const rate = appData.settings?.exchangeRate || 150;
  const storeName = appData.settings?.businessName || 'Xaysimo Supermarket';
  const timeStr = new Date().toLocaleString('so-SO', {
    timeZone: 'Africa/Mogadishu',
    dateStyle: 'full',
    timeStyle: 'medium'
  });

  const subject = `📑 [${storeName}] WARBIXINTA GUUD EE MAAMULKA (${reportSummary.periodTitle}) - Dakhli: ${formatMoney(reportSummary.totalRevenue, currency, rate)}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 650px; margin: 0 auto; background: #ffffff; border: 1px solid #cbd5e1; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.08);">
      <div style="background: linear-gradient(135deg, #0f172a, #1e3a8a); padding: 24px; color: #ffffff; text-align: center;">
        <h1 style="margin: 0; font-size: 22px; font-weight: 900; letter-spacing: -0.5px;">${storeName}</h1>
        <p style="margin: 6px 0 0; font-size: 13px; color: #38bdf8; font-weight: 700; text-transform: uppercase;">
          WARBIXINTA GUUD EE MAAMULKA (${reportSummary.periodTitle})
        </p>
        <p style="margin: 4px 0 0; font-size: 11px; opacity: 0.8;">${timeStr}</p>
      </div>

      <div style="padding: 24px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px;">
          <div style="background-color: #f0fdf4; border: 1px solid #bbf7d0; padding: 14px; border-radius: 12px;">
            <div style="font-size: 11px; font-weight: 700; color: #166534; text-transform: uppercase;">Wadarta Iibka / Sales</div>
            <div style="font-size: 22px; font-weight: 900; color: #15803d; font-family: monospace;">${formatMoney(reportSummary.totalRevenue, currency, rate)}</div>
          </div>
          <div style="background-color: #eff6ff; border: 1px solid #bfdbfe; padding: 14px; border-radius: 12px;">
            <div style="font-size: 11px; font-weight: 700; color: #1e40af; text-transform: uppercase;">Wadarta Faa'iidada / Profit</div>
            <div style="font-size: 22px; font-weight: 900; color: #1d4ed8; font-family: monospace;">${formatMoney(reportSummary.totalProfit, currency, rate)}</div>
          </div>
        </div>

        <table style="width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px;">
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Wadarta Kharashka (Expenses):</td>
            <td style="padding: 10px 0; font-weight: 800; color: #ef4444; text-align: right; font-family: monospace;">${formatMoney(reportSummary.totalExpenses, currency, rate)}</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Deymaha Maqan (Outstanding Debt):</td>
            <td style="padding: 10px 0; font-weight: 800; color: #b91c1c; text-align: right; font-family: monospace;">${formatMoney(reportSummary.totalDebt, currency, rate)} (${reportSummary.debtorsCount} Macamiil)</td>
          </tr>
          <tr style="border-bottom: 1px solid #f1f5f9;">
            <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Alaabta Gabaabsi Ah (Low Stock):</td>
            <td style="padding: 10px 0; font-weight: 800; color: #d97706; text-align: right;">${reportSummary.lowStockCount} Alaabood</td>
          </tr>
          <tr>
            <td style="padding: 10px 0; color: #64748b; font-weight: 600;">Alaabta Dhici Rabta (Expiring):</td>
            <td style="padding: 10px 0; font-weight: 800; color: #e11d48; text-align: right;">${reportSummary.expiringCount} Alaabood</td>
          </tr>
        </table>

        <div style="margin-top: 24px; padding: 14px; background-color: #f8fafc; border-radius: 12px; font-size: 11px; color: #64748b; text-align: center; border: 1px dashed #cbd5e1;">
          Warbixintan maamulka waxaa toos loogu soo diray <strong>${targetEmail}</strong> via <strong>EmailJS Cloud Service</strong>.
        </div>
      </div>
    </div>
  `;

  const text = `
[${storeName}] WARBIXINTA GUUD EE MAAMULKA (${reportSummary.periodTitle})
Waqtiga: ${timeStr}
Wadarta Iibka: ${formatMoney(reportSummary.totalRevenue, currency, rate)}
Wadarta Faa'iidada: ${formatMoney(reportSummary.totalProfit, currency, rate)}
Wadarta Kharashka: ${formatMoney(reportSummary.totalExpenses, currency, rate)}
Wadarta Deynta: ${formatMoney(reportSummary.totalDebt, currency, rate)} (${reportSummary.debtorsCount} Macamiil)
Alaabta Dhamaanaysa: ${reportSummary.lowStockCount}
Alaabta Dhici Rabta: ${reportSummary.expiringCount}
  `.trim();

  const emailJsConfig: EmailJsConfig | undefined = (
    appData.settings?.emailJsServiceId &&
    appData.settings?.emailJsTemplateId &&
    appData.settings?.emailJsPublicKey
  ) ? {
    serviceId: appData.settings.emailJsServiceId,
    templateId: appData.settings.emailJsTemplateId,
    publicKey: appData.settings.emailJsPublicKey,
    privateKey: appData.settings.emailJsPrivateKey
  } : undefined;

  return dispatchEmailAlert({
    toEmail: targetEmail,
    subject,
    type: 'EXECUTIVE_REPORT',
    html,
    text,
    timestamp: Date.now(),
    storeName,
    emailJsConfig
  }, emailJsConfig);
}
