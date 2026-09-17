import { AppData, Product, Customer, Supplier, Transaction, Expense, StockAdjustment, Account, AppSettings, Currency, AccountType, UserRole, KhudaarExpense, KhudaarSale, MonthlyArchive } from '../types';
import { generateId } from './utils';

export interface ParsedBackupResult {
  success: boolean;
  type: 'FULL_BACKUP' | 'PRODUCTS_ARRAY' | 'PRODUCTS_OBJECT' | 'CUSTOMERS_ARRAY' | 'TRANSACTIONS_ARRAY' | 'KHUDAAR_BACKUP' | 'UNKNOWN';
  appData?: AppData;
  products?: Product[];
  customers?: Customer[];
  transactions?: Transaction[];
  khudaarExpenses?: KhudaarExpense[];
  khudaarSales?: KhudaarSale[];
  summary: {
    productsCount: number;
    transactionsCount: number;
    customersCount: number;
    suppliersCount: number;
    accountsCount: number;
    expensesCount: number;
    stockAdjustmentsCount: number;
    khudaarExpensesCount?: number;
    khudaarSalesCount?: number;
    storeName?: string;
  };
  errorMessage?: string;
}

/**
 * Strips UTF-8 BOM, Markdown code wrappers, and trailing whitespace/invisible characters
 */
export const cleanRawJsonString = (raw: string): string => {
  if (!raw) return '';
  let str = raw.trim();

  // Strip BOM markers
  if (str.charCodeAt(0) === 0xFEFF || str.charCodeAt(0) === 0xFFFE) {
    str = str.slice(1).trim();
  }

  // Strip markdown code fences like ```json ... ``` or ``` ... ```
  if (str.startsWith('```')) {
    str = str.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
  }

  // If there is surrounding text, extract between first [ or { and last ] or }
  const firstBrace = str.indexOf('{');
  const firstBracket = str.indexOf('[');

  let startIndex = -1;
  let isObject = false;

  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    startIndex = firstBrace;
    isObject = true;
  } else if (firstBracket !== -1) {
    startIndex = firstBracket;
    isObject = false;
  }

  if (startIndex !== -1) {
    const lastIndex = isObject ? str.lastIndexOf('}') : str.lastIndexOf(']');
    if (lastIndex > startIndex) {
      str = str.substring(startIndex, lastIndex + 1).trim();
    }
  }

  return str;
};

/**
 * Safely parses any JSON string, attempting fallback trailing-comma cleaning if standard JSON.parse fails
 */
export const safeParseJson = (rawText: string): any => {
  const cleaned = cleanRawJsonString(rawText);
  if (!cleaned) throw new Error('Qoraalka JSON-ku waa maran yahay (Empty text).');

  try {
    return JSON.parse(cleaned);
  } catch (err: any) {
    // Attempt to fix common trailing commas: e.g. ", ]" -> " ]" and ", }" -> " }"
    try {
      const fixedCommas = cleaned.replace(/,\s*([\]}])/g, '$1');
      return JSON.parse(fixedCommas);
    } catch (e2) {
      throw new Error(`Cillad syntax JSON: ${err.message}`);
    }
  }
};

/**
 * Clean & normalize a product object
 */
export const sanitizeProduct = (p: any, fallbackIdx: number = 0): Product => {
  const id = (p.id && String(p.id).trim()) || `prod-${Date.now()}-${fallbackIdx}-${generateId().slice(0, 5)}`;
  const name = (p.name || p.title || p.productName || p.itemName || `Shey ${fallbackIdx + 1}`).trim();
  
  // Safe number parsing
  const parseNum = (val: any, fallback: number = 0): number => {
    if (val === undefined || val === null || val === '') return fallback;
    if (typeof val === 'number') return isNaN(val) ? fallback : val;
    const cleanStr = String(val).replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleanStr);
    return isNaN(num) ? fallback : num;
  };

  const costPrice = Math.max(0, parseNum(p.costPrice ?? p.cost ?? p.buyPrice ?? p.purchasePrice, 0));
  const registeredCostRate = parseNum(p.registeredCostRate, 190);
  const costPriceUSD = p.costPriceUSD !== undefined ? parseNum(p.costPriceUSD, costPrice) : costPrice;
  const costPriceETB = p.costPriceETB !== undefined 
    ? parseNum(p.costPriceETB, costPrice * registeredCostRate) 
    : (costPrice > 0 ? costPrice * (registeredCostRate || 190) : 0);
  const sellPrice = Math.max(0, parseNum(p.sellPrice ?? p.price ?? p.unitPrice, 0));
  const stock = parseNum(p.stock ?? p.quantity ?? p.qty, 0);
  const minStock = parseNum(p.minStock ?? p.reorderLevel, 5);

  let unit: 'PCS' | 'KG' = 'PCS';
  if (p.unit && String(p.unit).toUpperCase() === 'KG') {
    unit = 'KG';
  }

  return {
    id,
    name,
    sku: String(p.sku || '').trim(),
    barcode: String(p.barcode || '').trim(),
    costPrice,
    costPriceETB,
    costPriceUSD,
    registeredCostRate,
    sellPrice,
    stock,
    minStock,
    category: String(p.category || 'General').trim(),
    image: p.image || '',
    expiryDate: p.expiryDate || '',
    unit,
    createdAt: p.createdAt || Date.now(),
    lastSoldAt: p.lastSoldAt,
    trackingStartedAt: p.trackingStartedAt || Date.now()
  };
};

/**
 * Clean & normalize a customer object
 */
export const sanitizeCustomer = (c: any, fallbackIdx: number = 0): Customer => {
  const phone = String(c.phone || c.tel || c.telephone || '').trim();
  const id = (c.id && String(c.id).trim()) || phone || `cust-${Date.now()}-${fallbackIdx}`;
  const name = String(c.name || c.customerName || `Macaamiil ${fallbackIdx + 1}`).trim();
  
  const parseNum = (val: any, fallback: number = 0): number => {
    if (val === undefined || val === null || val === '') return fallback;
    if (typeof val === 'number') return isNaN(val) ? fallback : val;
    const cleanStr = String(val).replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleanStr);
    return isNaN(num) ? fallback : num;
  };

  return {
    id,
    name,
    phone,
    photo: c.photo || '',
    debtBalance: parseNum(c.debtBalance ?? c.debt ?? c.balance, 0),
    advanceBalance: parseNum(c.advanceBalance ?? c.advance, 0),
    loyaltyPoints: Math.max(0, parseNum(c.loyaltyPoints ?? c.points, 0)),
    history: Array.isArray(c.history) ? c.history.map((h: any) => String(h)) : []
  };
};

/**
 * Clean & normalize a supplier object
 */
export const sanitizeSupplier = (s: any, fallbackIdx: number = 0): Supplier => {
  const phone = String(s.phone || s.tel || '').trim();
  const id = (s.id && String(s.id).trim()) || phone || `sup-${Date.now()}-${fallbackIdx}`;
  const name = String(s.name || s.supplierName || `Supplier ${fallbackIdx + 1}`).trim();
  
  const parseNum = (val: any, fallback: number = 0): number => {
    if (val === undefined || val === null || val === '') return fallback;
    if (typeof val === 'number') return isNaN(val) ? fallback : val;
    const cleanStr = String(val).replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleanStr);
    return isNaN(num) ? fallback : num;
  };

  return {
    id,
    name,
    contact: String(s.contact || s.contactPerson || '').trim(),
    phone,
    balance: parseNum(s.balance ?? s.debtBalance, 0)
  };
};

/**
 * Clean & normalize a transaction object
 */
export const sanitizeTransaction = (t: any, fallbackIdx: number = 0): Transaction => {
  const id = (t.id && String(t.id).trim()) || `tx-${Date.now()}-${fallbackIdx}`;
  
  const parseNum = (val: any, fallback: number = 0): number => {
    if (val === undefined || val === null || val === '') return fallback;
    if (typeof val === 'number') return isNaN(val) ? fallback : val;
    const cleanStr = String(val).replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleanStr);
    return isNaN(num) ? fallback : num;
  };

  const rawItems = Array.isArray(t.items) ? t.items : [];
  const items = rawItems.map((it: any, itemIdx: number) => ({
    ...sanitizeProduct(it, itemIdx),
    quantity: Math.max(0.01, parseNum(it.quantity ?? it.qty, 1))
  }));

  const total = parseNum(t.total, 0);
  const subtotal = parseNum(t.subtotal, total);
  const discount = parseNum(t.discount, 0);
  const tax = parseNum(t.tax, 0);

  return {
    id,
    items,
    total,
    subtotal,
    discount,
    tax,
    currency: t.currency === 'USD' ? Currency.USD : Currency.ETB,
    exchangeRate: parseNum(t.exchangeRate, 190),
    paymentMethod: t.paymentMethod || 'Cash',
    customerName: t.customerName || 'Walking Customer',
    customerId: t.customerId || undefined,
    supplierId: t.supplierId || undefined,
    supplierName: t.supplierName || undefined,
    timestamp: t.timestamp ? Number(t.timestamp) : Date.now(),
    notes: t.notes || '',
    type: t.type || 'SALE',
    accountId: t.accountId || 'acc-cash',
    returnReason: t.returnReason || undefined,
    originalInvoiceId: t.originalInvoiceId || undefined,
    pageNumber: t.pageNumber || undefined
  };
};

/**
 * Clean & normalize Khudaar expense
 */
export const sanitizeKhudaarExpense = (e: any, fallbackIdx: number = 0): KhudaarExpense => {
  const parseNum = (val: any, fallback: number = 0): number => {
    if (val === undefined || val === null || val === '') return fallback;
    if (typeof val === 'number') return isNaN(val) ? fallback : val;
    const cleanStr = String(val).replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleanStr);
    return isNaN(num) ? fallback : num;
  };

  return {
    id: String(e.id || `kh-exp-${Date.now()}-${fallbackIdx}`),
    title: String(e.title || e.name || 'Kharashka Khudaarta').trim(),
    amount: Math.max(0, parseNum(e.amount, 0)),
    date: String(e.date || new Date().toISOString().split('T')[0]),
    notes: e.notes ? String(e.notes).trim() : '',
    createdAt: typeof e.createdAt === 'number' ? e.createdAt : Date.now()
  };
};

/**
 * Clean & normalize Khudaar daily sale
 */
export const sanitizeKhudaarSale = (s: any, fallbackIdx: number = 0): KhudaarSale => {
  const parseNum = (val: any, fallback: number = 0): number => {
    if (val === undefined || val === null || val === '') return fallback;
    if (typeof val === 'number') return isNaN(val) ? fallback : val;
    const cleanStr = String(val).replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleanStr);
    return isNaN(num) ? fallback : num;
  };

  return {
    id: String(s.id || `kh-sale-${Date.now()}-${fallbackIdx}`),
    amount: Math.max(0, parseNum(s.amount, 0)),
    date: String(s.date || new Date().toISOString().split('T')[0]),
    paymentMethod: s.paymentMethod ? String(s.paymentMethod) : 'Cash',
    notes: s.notes ? String(s.notes).trim() : '',
    createdAt: typeof s.createdAt === 'number' ? s.createdAt : Date.now(),
    customerId: s.customerId ? String(s.customerId) : undefined,
    customerName: s.customerName ? String(s.customerName) : undefined,
    isDebt: Boolean(s.isDebt || s.paymentMethod === 'Deyn / Credit')
  };
};

/**
 * Clean & normalize Monthly Archive
 */
export const sanitizeMonthlyArchive = (ma: any, fallbackIdx: number = 0): MonthlyArchive => {
  const id = String(ma.id || `archive-${Date.now()}-${fallbackIdx}`);
  const monthName = String(ma.monthName || `Bishii ${fallbackIdx + 1}`);
  const periodStartDate = String(ma.periodStartDate || new Date().toISOString().split('T')[0]);
  const periodEndDate = String(ma.periodEndDate || new Date().toISOString().split('T')[0]);
  const closedAt = typeof ma.closedAt === 'number' ? ma.closedAt : Date.now();
  const closedBy = String(ma.closedBy || 'Admin');
  const notes = ma.notes ? String(ma.notes) : '';

  const parseNum = (val: any, fallback: number = 0): number => {
    if (val === undefined || val === null || val === '') return fallback;
    if (typeof val === 'number') return isNaN(val) ? fallback : val;
    const cleanStr = String(val).replace(/[^0-9.-]/g, '');
    const num = parseFloat(cleanStr);
    return isNaN(num) ? fallback : num;
  };

  const rawSum = ma.summary || {};
  const rawSnap = ma.snapshotData || ma.snapshot || {};

  const rawTransactions = Array.isArray(rawSnap.transactions) ? rawSnap.transactions : [];
  const rawCustomers = Array.isArray(rawSnap.customers) ? rawSnap.customers : [];
  const rawSuppliers = Array.isArray(rawSnap.suppliers) ? rawSnap.suppliers : [];
  const rawExpenses = Array.isArray(rawSnap.expenses) ? rawSnap.expenses : [];
  const rawStockAdjustments = Array.isArray(rawSnap.stockAdjustments) ? rawSnap.stockAdjustments : [];
  const rawKhudaarSales = Array.isArray(rawSnap.khudaarSales) ? rawSnap.khudaarSales : [];
  const rawKhudaarExpenses = Array.isArray(rawSnap.khudaarExpenses) ? rawSnap.khudaarExpenses : [];
  const rawAccounts = Array.isArray(rawSnap.accounts) ? rawSnap.accounts : [];

  const rawAccountsSummary = Array.isArray(rawSum.accountsSummary) ? rawSum.accountsSummary : [];

  return {
    id,
    monthName,
    periodStartDate,
    periodEndDate,
    closedAt,
    closedBy,
    notes,
    summary: {
      totalSales: parseNum(rawSum.totalSales, 0),
      totalProfit: parseNum(rawSum.totalProfit, 0),
      totalExpenses: parseNum(rawSum.totalExpenses, 0),
      netProfit: parseNum(rawSum.netProfit, 0),
      totalCustomerDebt: parseNum(rawSum.totalCustomerDebt, 0),
      totalSupplierDebt: parseNum(rawSum.totalSupplierDebt, 0),
      totalTransactionsCount: parseNum(rawSum.totalTransactionsCount, rawTransactions.length),
      totalKhudaarSales: parseNum(rawSum.totalKhudaarSales, 0),
      totalKhudaarExpenses: parseNum(rawSum.totalKhudaarExpenses, 0),
      totalIceCreamSales: parseNum(rawSum.totalIceCreamSales, 0),
      accountsSummary: rawAccountsSummary.map((acc: any) => ({
        id: String(acc.id || 'acc'),
        name: String(acc.name || 'Account'),
        type: acc.type || AccountType.ASSET,
        balance: parseNum(acc.balance, 0)
      }))
    },
    snapshotData: {
      transactions: rawTransactions.map((t: any, idx: number) => sanitizeTransaction(t, idx)),
      expenses: rawExpenses,
      stockAdjustments: rawStockAdjustments,
      khudaarSales: rawKhudaarSales.map((s: any, idx: number) => sanitizeKhudaarSale(s, idx)),
      khudaarExpenses: rawKhudaarExpenses.map((e: any, idx: number) => sanitizeKhudaarExpense(e, idx)),
      accountTransfers: Array.isArray(rawSnap.accountTransfers) ? rawSnap.accountTransfers : [],
      customers: rawCustomers.map((c: any, idx: number) => sanitizeCustomer(c, idx)),
      suppliers: rawSuppliers.map((s: any, idx: number) => sanitizeSupplier(s, idx)),
      accounts: rawAccounts.map((a: any) => ({
        id: String(a.id || 'acc'),
        name: String(a.name || 'Account'),
        type: a.type || AccountType.ASSET,
        balance: parseNum(a.balance, 0)
      }))
    }
  };
};

/**
 * Main parser that accurately parses, validates, and categorizes backup JSON data
 */
export const parseAndValidateBackupJSON = (rawText: string, currentData?: AppData): ParsedBackupResult => {
  try {
    const parsed = safeParseJson(rawText);

    if (!parsed || (typeof parsed !== 'object' && !Array.isArray(parsed))) {
      return {
        success: false,
        type: 'UNKNOWN',
        summary: { productsCount: 0, transactionsCount: 0, customersCount: 0, suppliersCount: 0, accountsCount: 0, expensesCount: 0, stockAdjustmentsCount: 0 },
        errorMessage: 'Xogta JSON-ku ma lahan qaab sax ah (Invalid JSON object/array).'
      };
    }

    // 1. Check if Root is an Array of Products
    if (Array.isArray(parsed)) {
      // Check if it's products, transactions, or customers
      if (parsed.length > 0 && (parsed[0].sellPrice !== undefined || parsed[0].costPrice !== undefined || parsed[0].stock !== undefined || parsed[0].sku !== undefined || parsed[0].barcode !== undefined)) {
        const products = parsed.map((p, idx) => sanitizeProduct(p, idx));
        return {
          success: true,
          type: 'PRODUCTS_ARRAY',
          products,
          summary: {
            productsCount: products.length,
            transactionsCount: 0,
            customersCount: 0,
            suppliersCount: 0,
            accountsCount: 0,
            expensesCount: 0,
            stockAdjustmentsCount: 0
          }
        };
      }

      if (parsed.length > 0 && (parsed[0].debtBalance !== undefined || (parsed[0].phone !== undefined && parsed[0].name !== undefined && parsed[0].items === undefined))) {
        const customers = parsed.map((c, idx) => sanitizeCustomer(c, idx));
        return {
          success: true,
          type: 'CUSTOMERS_ARRAY',
          customers,
          summary: {
            productsCount: 0,
            transactionsCount: 0,
            customersCount: customers.length,
            suppliersCount: 0,
            accountsCount: 0,
            expensesCount: 0,
            stockAdjustmentsCount: 0
          }
        };
      }

      if (parsed.length > 0 && (parsed[0].total !== undefined && (parsed[0].items !== undefined || parsed[0].paymentMethod !== undefined))) {
        const transactions = parsed.map((t, idx) => sanitizeTransaction(t, idx));
        return {
          success: true,
          type: 'TRANSACTIONS_ARRAY',
          transactions,
          summary: {
            productsCount: 0,
            transactionsCount: transactions.length,
            customersCount: 0,
            suppliersCount: 0,
            accountsCount: 0,
            expensesCount: 0,
            stockAdjustmentsCount: 0
          }
        };
      }

      // Default array: treat as products
      const products = parsed.map((p, idx) => sanitizeProduct(p, idx));
      return {
        success: true,
        type: 'PRODUCTS_ARRAY',
        products,
        summary: {
          productsCount: products.length,
          transactionsCount: 0,
          customersCount: 0,
          suppliersCount: 0,
          accountsCount: 0,
          expensesCount: 0,
          stockAdjustmentsCount: 0
        }
      };
    }

    // 2. Object with nested wrappers (payload, data, storeData, backup, appData, etc.)
    let root = parsed;
    if (root.payload && typeof root.payload === 'object') root = root.payload;
    else if (root.data && typeof root.data === 'object' && !Array.isArray(root.data)) root = root.data;
    else if (root.storeData && typeof root.storeData === 'object') root = root.storeData;
    else if (root.backup && typeof root.backup === 'object') root = root.backup;
    else if (root.appData && typeof root.appData === 'object') root = root.appData;

    // Check if object is solely a Khudaar container: e.g. { "type": "KHUDAAR_BACKUP" } or { "khudaarExpenses": [...], "khudaarSales": [...] }
    const isKhudaarOnly = (root.type === 'KHUDAAR_BACKUP' || (root.khudaarExpenses || root.khudaarSales)) && !root.products && !root.transactions && !root.customers && !root.suppliers;
    if (isKhudaarOnly) {
      const rawExp = Array.isArray(root.khudaarExpenses) ? root.khudaarExpenses : [];
      const rawSale = Array.isArray(root.khudaarSales) ? root.khudaarSales : [];
      const khudaarExpenses = rawExp.map((e: any, idx: number) => sanitizeKhudaarExpense(e, idx));
      const khudaarSales = rawSale.map((s: any, idx: number) => sanitizeKhudaarSale(s, idx));
      return {
        success: true,
        type: 'KHUDAAR_BACKUP',
        khudaarExpenses,
        khudaarSales,
        summary: {
          productsCount: 0,
          transactionsCount: 0,
          customersCount: 0,
          suppliersCount: 0,
          accountsCount: 0,
          expensesCount: 0,
          stockAdjustmentsCount: 0,
          khudaarExpensesCount: khudaarExpenses.length,
          khudaarSalesCount: khudaarSales.length,
          storeName: root.storeName
        }
      };
    }

    // Check if object is solely a products container: e.g. { "products": [ ... ] } or { "items": [ ... ] }
    const hasOnlyProducts = (root.products || root.items || root.inventory) && !root.transactions && !root.customers && !root.suppliers && !root.accounts && !root.settings;
    if (hasOnlyProducts) {
      const rawList = Array.isArray(root.products) ? root.products : Array.isArray(root.items) ? root.items : Array.isArray(root.inventory) ? root.inventory : [];
      const products = rawList.map((p: any, idx: number) => sanitizeProduct(p, idx));
      return {
        success: true,
        type: 'PRODUCTS_OBJECT',
        products,
        summary: {
          productsCount: products.length,
          transactionsCount: 0,
          customersCount: 0,
          suppliersCount: 0,
          accountsCount: 0,
          expensesCount: 0,
          stockAdjustmentsCount: 0
        }
      };
    }

    // 3. Full ERP AppData Backup
    const rawProducts = Array.isArray(root.products) ? root.products : Array.isArray(root.items) ? root.items : [];
    const rawTransactions = Array.isArray(root.transactions) ? root.transactions : [];
    const rawCustomers = Array.isArray(root.customers) ? root.customers : [];
    const rawSuppliers = Array.isArray(root.suppliers) ? root.suppliers : [];
    const rawExpenses = Array.isArray(root.expenses) ? root.expenses : [];
    const rawStockAdjustments = Array.isArray(root.stockAdjustments) ? root.stockAdjustments : [];
    const rawAuditLogs = Array.isArray(root.auditLogs) ? root.auditLogs : [];
    const rawUsers = Array.isArray(root.users) && root.users.length > 0 ? root.users : (currentData?.users || [{ id: '1', name: 'Admin User', role: UserRole.ADMIN, isActive: true }]);

    const products: Product[] = rawProducts.map((p: any, idx: number) => sanitizeProduct(p, idx));
    const transactions: Transaction[] = rawTransactions.map((t: any, idx: number) => sanitizeTransaction(t, idx));
    const customers: Customer[] = rawCustomers.map((c: any, idx: number) => sanitizeCustomer(c, idx));
    const suppliers: Supplier[] = rawSuppliers.map((s: any, idx: number) => sanitizeSupplier(s, idx));

    // Accounts sanitization
    let accounts: Account[] = Array.isArray(root.accounts) && root.accounts.length > 0
      ? root.accounts.map((a: any) => ({
          id: String(a.id || `acc-${generateId().slice(0, 5)}`),
          name: String(a.name || 'Account'),
          type: a.type || AccountType.ASSET,
          balance: typeof a.balance === 'number' ? a.balance : parseFloat(String(a.balance || 0)) || 0
        }))
      : [
          { id: 'acc-cash', name: 'Cash Account', type: AccountType.ASSET, balance: 0 },
          { id: 'acc-bank', name: 'Bank Account', type: AccountType.ASSET, balance: 0 },
          { id: 'acc-mobile', name: 'Mobile Account', type: AccountType.ASSET, balance: 0 },
          { id: 'acc-inv', name: 'Inventory Asset', type: AccountType.ASSET, balance: 0 },
          { id: 'acc-4', name: 'Loss - Damaged Items', type: AccountType.EXPENSE, balance: 0 },
          { id: 'acc-5', name: 'Loss - Lost Items', type: AccountType.EXPENSE, balance: 0 },
          { id: 'acc-6', name: 'Loss - Expired Items', type: AccountType.EXPENSE, balance: 0 }
        ];

    // Ensure standard cash account exists
    if (!accounts.some(a => a.id === 'acc-cash')) {
      accounts.unshift({ id: 'acc-cash', name: 'Cash Account', type: AccountType.ASSET, balance: 0 });
    }

    // Settings sanitization
    const settings: AppSettings = {
      ...(currentData?.settings || {
        businessName: 'XAYSIMO SUPER MARKET',
        exchangeRate: 190,
        taxRate: 0,
        defaultCurrency: Currency.ETB,
        authUsername: 'xaysimo',
        authPassword: 'Shugri100@',
        supabaseUrl: 'https://jifjbnyjivpldkjpgjuj.supabase.co',
        supabaseKey: 'sb_publishable_J9BpbE042wg2Yrt7hicSOw_wiF3MzPx',
        currentUser: { name: 'Admin User', role: UserRole.ADMIN },
        syncSettings: { autoSyncCloud: true, lastSyncedAt: 0, dataVersion: 1 }
      }),
      ...(root.settings || {}),
      supabaseUrl: root.settings?.supabaseUrl || 'https://jifjbnyjivpldkjpgjuj.supabase.co',
      supabaseKey: root.settings?.supabaseKey || 'sb_publishable_J9BpbE042wg2Yrt7hicSOw_wiF3MzPx',
      defaultCurrency: root.settings?.defaultCurrency === 'USD' ? Currency.USD : Currency.ETB,
      exchangeRate: root.settings?.exchangeRate ? Number(root.settings.exchangeRate) : 190,
      businessName: root.settings?.businessName || currentData?.settings?.businessName || 'XAYSIMO SUPER MARKET'
    };

    const rawKhudaarExpenses = Array.isArray(root.khudaarExpenses) ? root.khudaarExpenses : (Array.isArray(currentData?.khudaarExpenses) ? currentData.khudaarExpenses : []);
    const rawKhudaarSales = Array.isArray(root.khudaarSales) ? root.khudaarSales : (Array.isArray(currentData?.khudaarSales) ? currentData.khudaarSales : []);
    const khudaarExpenses: KhudaarExpense[] = rawKhudaarExpenses.map((e: any, idx: number) => sanitizeKhudaarExpense(e, idx));
    const khudaarSales: KhudaarSale[] = rawKhudaarSales.map((s: any, idx: number) => sanitizeKhudaarSale(s, idx));

    const rawMonthlyArchives = Array.isArray(root.monthlyArchives) ? root.monthlyArchives : (Array.isArray(currentData?.monthlyArchives) ? currentData.monthlyArchives : []);
    const monthlyArchives: MonthlyArchive[] = rawMonthlyArchives.map((m: any, idx: number) => sanitizeMonthlyArchive(m, idx));

    const fullAppData: AppData = {
      products,
      transactions,
      customers,
      suppliers,
      expenses: rawExpenses,
      stockAdjustments: rawStockAdjustments,
      auditLogs: rawAuditLogs,
      users: rawUsers,
      accounts,
      onlineOrders: Array.isArray(root.onlineOrders) ? root.onlineOrders : [],
      onlineCustomers: Array.isArray(root.onlineCustomers) ? root.onlineCustomers : [],
      iceCreamIngredients: Array.isArray(root.iceCreamIngredients) ? root.iceCreamIngredients : (currentData?.iceCreamIngredients || []),
      iceCreamRecipes: root.iceCreamRecipes && typeof root.iceCreamRecipes === 'object' ? root.iceCreamRecipes : (currentData?.iceCreamRecipes || {}),
      recycleBin: Array.isArray(root.recycleBin) ? root.recycleBin : [],
      deletedIds: root.deletedIds && typeof root.deletedIds === 'object' ? root.deletedIds : {},
      accountTransfers: Array.isArray(root.accountTransfers) ? root.accountTransfers : [],
      khudaarExpenses,
      khudaarSales,
      monthlyArchives,
      currentPeriodName: root.currentPeriodName || currentData?.currentPeriodName,
      currentPeriodStartedAt: root.currentPeriodStartedAt || currentData?.currentPeriodStartedAt,
      settings,
      lastModified: Date.now()
    };

    return {
      success: true,
      type: 'FULL_BACKUP',
      appData: fullAppData,
      summary: {
        productsCount: products.length,
        transactionsCount: transactions.length,
        customersCount: customers.length,
        suppliersCount: suppliers.length,
        accountsCount: accounts.length,
        expensesCount: rawExpenses.length,
        stockAdjustmentsCount: rawStockAdjustments.length,
        khudaarExpensesCount: khudaarExpenses.length,
        khudaarSalesCount: khudaarSales.length,
        storeName: settings.businessName
      }
    };
  } catch (err: any) {
    return {
      success: false,
      type: 'UNKNOWN',
      summary: { productsCount: 0, transactionsCount: 0, customersCount: 0, suppliersCount: 0, accountsCount: 0, expensesCount: 0, stockAdjustmentsCount: 0 },
      errorMessage: err.message || 'Cillad aan la garanayn ayaa ku dhacday furitaanka JSON-ka.'
    };
  }
};

/**
 * Downloads a complete JSON backup file of the current system state.
 */
export const triggerJsonBackupDownload = (data: AppData, isAuto = false): boolean => {
  try {
    const backupPayload = {
      ...data,
      exportDate: new Date().toISOString(),
      version: 'v2',
      system: 'XAYSIMO ERP',
      isAutoBackup: isAuto
    };
    const dataStr = JSON.stringify(backupPayload, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const storeNameClean = (data.settings?.businessName || 'xaysimo').toLowerCase().replace(/[^a-z0-9]/g, '_');
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    link.download = `backup_${storeNameClean}_${dateStr}_${hours}-${minutes}${isAuto ? '_auto_2200' : ''}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('Failed to trigger JSON backup download:', err);
    return false;
  }
};
