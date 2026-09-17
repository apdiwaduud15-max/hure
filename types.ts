
export enum AppTab {
  DASHBOARD = 'Dashboard',
  XISAABIN = 'Xisaabin',
  OGAANSHO = 'Ogaansho',
  ONLINE_ORDERS = 'Online Orders',
  ICE_CREAM = 'Ice Cream Shop',
  POS = 'POS',
  PRODUCTS = 'Products',
  ITEM_REPORTS = 'Report Item',
  ALL_TRANSACTIONS_SHOW = 'All Transactions Show',
  PURCHASES = 'Purchases',
  INVOICES = 'Invoices',
  CUSTOMERS = 'Customers',
  DEBTORS = 'Debtors Hub',
  SUPPLIERS = 'Suppliers',
  STOCK = 'Stock Adjustments',
  FINANCES = 'Income & Expenses',
  ACCOUNTING = 'Accounting',
  AUDIT = 'Audit Trail',
  DAILY_CLOSING = 'Daily Closing',
  REPORTS = 'Reports',
  AI = 'AI Insights',
  ROLES = 'User Roles',
  RECYCLE_BIN = 'Recycle Bin',
  KHUDAAR = 'Khudaar',
  SETTINGS = 'Settings'
}

export enum Currency {
  USD = 'USD',
  ETB = 'ETB'
}

export enum PaymentMethod {
  CASH = 'Cash',
  BANK = 'Bank Transfer',
  MOBILE_MONEY = 'Mobile Money',
  DEBT = 'Debt',
  PARTIAL = 'Partial Payment'
}

export enum AccountType {
  ASSET = 'Asset',
  FIXED_ASSET = 'Fixed Asset',
  EQUITY = 'Equity',
  OTHER_CURRENT_ASSET = 'Other Current Asset',
  LIABILITY = 'Liability',
  REVENUE = 'Revenue',
  EXPENSE = 'Expense'
}

export interface Account {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
  barcode: string;
  costPrice: number;
  costPriceETB?: number; // Fixed entered cost in ETB (never changes on currency rate change)
  costPriceUSD?: number; // Fixed entered cost in USD (never changes on currency rate change)
  registeredCostRate?: number; // Historical rate at the moment product was registered
  sellPrice: number;
  stock: number;
  minStock?: number;
  category: string;
  image?: string; // Base64
  expiryDate?: string; // ISO Date String
  unit?: 'PCS' | 'KG';
  createdAt?: number;
  lastSoldAt?: number;
  trackingStartedAt?: number;
  unitCost?: number;
  price?: number;
}

export interface CartItem extends Product {
  quantity: number;
  paymentMethod?: PaymentMethod;
}

export interface Customer {
  id: string; // Phone number as ID
  name: string;
  phone: string;
  address?: string;
  photo?: string; // Base64
  debtBalance: number;
  advanceBalance?: number; // Pre-payment / deposit balance
  loyaltyPoints: number;
  history: string[]; // Transaction IDs
}

export interface Supplier {
  id: string; // Phone number as ID
  name: string;
  contact: string;
  phone: string;
  balance: number;
}

export interface Transaction {
  id: string;
  items: CartItem[];
  subtotal: number;
  tax: number;
  total: number;
  currency: Currency;
  exchangeRate: number;
  paymentMethod: PaymentMethod;
  accountId?: string; // Track which ledger account received the funds
  paymentDetails?: {
    cash: number;
    debt: number;
    bank: number;
    mobile: number;
  };
  customerId?: string;
  customerName?: string;
  supplierId?: string;
  supplierName?: string;
  notes?: string;
  timestamp: number;
  type: 'SALE' | 'RETURN' | 'DEBT_PAYMENT' | 'CASH_LOAN' | 'EXPENSE' | 'PURCHASE' | 'SUPPLIER_DEBT';
  discount?: number;
  returnReason?: string;
  originalInvoiceId?: string;
  pageNumber?: string;
  cashierName?: string;
}

export interface Expense {
  id: string;
  category: string;
  description: string;
  amount: number;
  currency: Currency;
  timestamp: number;
  accountId: string; // REQUIRED: Source of funds
  receipt?: string; // Base64
}

export interface StockAdjustment {
  id: string;
  productId: string;
  productName: string;
  type: 'DAMAGE' | 'LOST' | 'EXPIRED' | 'RETURN_TO_VENDOR' | 'STOCK_IN';
  quantity: number;
  timestamp: number;
  reason: string;
  supplierId?: string;
  supplierName?: string;
  accountId?: string; // Account used to pay for stock
  unitCost?: number;
  totalCost?: number;
  paymentType?: 'CASH' | 'CREDIT' | 'PARTIAL';
  cashPaid?: number;
  debtCreated?: number;
  pageNumber?: string;
  note?: string;
}

export interface AuditLog {
  id: string;
  action: string;
  details: string;
  timestamp: number;
  user: string;
}

export enum UserRole {
  ADMIN = 'Admin',
  MANAGER = 'Manager',
  CASHIER = 'Cashier'
}

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  password?: string;
  isActive: boolean;
  avatar?: string;
}

export interface AppSettings {
  businessName: string;
  businessLogo?: string;
  storeAddress?: string;
  storePhone?: string;
  exchangeRate: number;
  taxRate: number;
  defaultCurrency: Currency;
  authUsername?: string;
  authPassword?: string;
  adminPassword?: string;
  managerPassword?: string;
  cashierPassword?: string;
  recycleBinPin?: string;
  adminAlertEmail?: string;
  adminWhatsAppPhone?: string;
  managerWhatsAppPhone?: string;
  emailAlertsEnabled?: boolean;
  twoHourReportsEnabled?: boolean;
  emailJsServiceId?: string;
  emailJsTemplateId?: string;
  emailJsPublicKey?: string;
  emailJsPrivateKey?: string;
  supabaseUrl?: string;
  supabaseKey?: string;
  currentUser: {
    name: string;
    role: UserRole;
    avatar?: string;
  };
  syncSettings?: {
    autoSyncCloud?: boolean;
    lastSyncedAt?: number;
    dataVersion?: number;
  };
  onlinePaymentNumbers?: {
    golis?: string;
    ebirr?: string;
    kaafi?: string;
    kuIibso?: string;
    edahab?: string;
    commercialBank?: string;
  };
}

export interface OnlineCustomer {
  id: string;
  username: string;
  password?: string;
  fullName: string;
  phone: string;
  qabaleAddress: string;
  nearbyLandmark: string;
  locationUrl?: string; // Google maps link or GPS string
  latitude?: number;
  longitude?: number;
  createdAt: number;
}

export interface OnlineOrder {
  id: string;
  customer: {
    username: string;
    fullName: string;
    phone: string;
    qabaleAddress: string;
    nearbyLandmark: string;
    locationUrl?: string;
    latitude?: number;
    longitude?: number;
  };
  orderType?: 'PURCHASE' | 'DEBT_PAYMENT';
  items: CartItem[];
  subtotal: number;
  totalAmount: number;
  debtAmountPaid?: number; // Amount paid towards existing debt
  paymentMethod: 'Golis' | 'eBirr' | 'Kaafi' | 'Ku Iibso' | 'eDahab' | 'Commercial Bank' | 'Deyn (Credit)';
  receiptImage?: string; // Base64 receipt screenshot
  status: 'PENDING' | 'APPROVED' | 'DELIVERED' | 'CANCELLED';
  timestamp: number;
  notes?: string;
}

export interface IceCreamIngredient {
  id: string;
  name: string;
  unit: 'grm' | 'ml' | 'kg' | 'liter' | 'pcs';
  unitCost: number; // Cost in USD per unit
  stock: number;
  minStock?: number;
}

export interface IceCreamRecipeItem {
  ingredientId: string;
  quantity: number; // e.g. 50 grm, 100 ml
}

export interface AccountTransfer {
  id: string;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  amount: number;
  note?: string;
  timestamp: number;
  user?: string;
}

export interface RecycleBinItem {
  id: string;
  type: 'TRANSACTION' | 'PRODUCT' | 'CUSTOMER' | 'SUPPLIER' | 'EXPENSE' | 'STOCK_ADJUSTMENT' | 'KHUDAAR_EXPENSE' | 'KHUDAAR_SALE';
  deletedAt: number;
  deletedBy?: string;
  title: string;
  description: string;
  originalData: any;
}

export interface KhudaarExpense {
  id: string;
  title: string;
  amount: number;
  date: string; // YYYY-MM-DD
  notes?: string;
  createdAt: number;
}

export interface KhudaarSale {
  id: string;
  amount: number;
  date: string; // YYYY-MM-DD
  paymentMethod?: string;
  notes?: string;
  createdAt: number;
  customerId?: string;
  customerName?: string;
  isDebt?: boolean;
}

export interface MonthlyArchiveAccountBalance {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
}

export interface MonthlyArchive {
  id: string;
  monthName: string; // e.g. "Bishii 8aad (August 2026)"
  periodStartDate: string; // YYYY-MM-DD
  periodEndDate: string; // YYYY-MM-DD
  closedAt: number;
  closedBy: string;
  notes?: string;
  summary: {
    totalSales: number;
    totalProfit: number;
    totalExpenses: number;
    netProfit: number;
    totalCustomerDebt: number;
    totalSupplierDebt: number;
    totalTransactionsCount: number;
    totalKhudaarSales: number;
    totalKhudaarExpenses: number;
    totalIceCreamSales: number;
    accountsSummary: MonthlyArchiveAccountBalance[];
  };
  snapshotData: {
    transactions: Transaction[];
    expenses: Expense[];
    stockAdjustments: StockAdjustment[];
    khudaarSales?: KhudaarSale[];
    khudaarExpenses?: KhudaarExpense[];
    accountTransfers?: AccountTransfer[];
    customers: Customer[];
    suppliers: Supplier[];
    accounts: Account[];
  };
}

export interface AppData {
  products: Product[];
  transactions: Transaction[];
  customers: Customer[];
  suppliers: Supplier[];
  expenses: Expense[];
  stockAdjustments: StockAdjustment[];
  auditLogs: AuditLog[];
  settings: AppSettings;
  users: UserProfile[];
  accounts: Account[];
  accountTransfers?: AccountTransfer[];
  onlineOrders?: OnlineOrder[];
  onlineCustomers?: OnlineCustomer[];
  iceCreamIngredients?: IceCreamIngredient[];
  iceCreamRecipes?: Record<string, IceCreamRecipeItem[]>; // productId -> array of ingredients & quantities
  recycleBin?: RecycleBinItem[];
  deletedIds?: Record<string, number>; // id -> deletedAt timestamp (tombstone to prevent resurrection)
  khudaarExpenses?: KhudaarExpense[];
  khudaarSales?: KhudaarSale[];
  monthlyArchives?: MonthlyArchive[];
  currentPeriodName?: string;
  currentPeriodStartedAt?: number;
  lastModified?: number;
}
