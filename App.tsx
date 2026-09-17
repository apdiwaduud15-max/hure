import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { 
  LayoutDashboard, 
  Package, 
  ShoppingCart, 
  Users, 
  FileText, 
  UserPlus, 
  Truck, 
  TrendingUp, 
  History, 
  BarChart3, 
  BrainCircuit, 
  ShieldCheck, 
  Settings,
  Menu,
  LogOut,
  RefreshCcw,
  Zap,
  PackagePlus,
  HardDrive,
  Briefcase,
  X,
  Bell,
  Receipt,
  RefreshCw,
  Sparkles,
  ShoppingBag,
  Globe,
  UserCheck,
  Calculator as CalcIcon,
  PieChart,
  Trash2,
  Apple,
  Undo2,
  HelpCircle,
  Archive,
  FolderArchive,
  CalendarCheck,
  Download,
  Upload,
  Maximize,
  Minimize,
  Share2,
  Cloud,
  CheckCircle2
} from 'lucide-react';
import { StoreExecutiveReportModal } from './components/StoreExecutiveReportModal';
import { sendTwoHourPeriodicReport } from './lib/emailAlertService';
import { AppTab, AppData, Product, Supplier, Currency, UserRole, AppSettings, AccountType, OnlineOrder, OnlineCustomer, Transaction, Customer, CartItem, Account, PaymentMethod, MonthlyArchive } from './types';
import Dashboard from './components/Dashboard';
import Products from './components/Products';
import ItemReports from './components/ItemReports';
import POS from './components/POS';
import IceCreamShop from './components/IceCreamShop';
import { AllTransactionsShow } from './components/AllTransactionsShow';
import Purchases from './components/Purchases';
import DebtorsHub from './components/DebtorsHub';
import Invoices from './components/Invoices';
import Customers from './components/Customers';
import Suppliers from './components/Suppliers';
import Finances from './components/Finances';
import StockAdjustments from './components/StockAdjustments';
import Accounting from './components/Accounting';
import ZReport from './components/ZReport';
import Reports from './components/Reports';
import AIInsights from './components/AIInsights';
import { QuickAI } from './components/QuickAI';
import Roles from './components/Roles';
import SettingsView from './components/SettingsView';
import { InventoryAlertsModal } from './components/InventoryAlertsModal';
import { CalculatorModal } from './components/CalculatorModal';
import { WhatsAppImageModal } from './components/WhatsAppImageModal';
import { WhatsAppImageShareOptions, registerWhatsAppModalHandler } from './lib/receiptImageGenerator';
import CustomerPortal from './components/CustomerPortal';
import OnlineOrders from './components/OnlineOrders';
import { RecycleBin } from './components/RecycleBin';
import { KhudaarManager } from './components/KhudaarManager';
import { XisaabinTab } from './components/XisaabinTab';
import { OgaanshoTab } from './components/OgaanshoTab';
import { MonthlyCloseModal } from './components/MonthlyCloseModal';
import { MonthlyArchiveHubModal } from './components/MonthlyArchiveHubModal';
import RolePasswordModal from './components/RolePasswordModal';
import { generateId } from './lib/utils';
import { saveToSupabase, fetchFromSupabase } from './lib/supabase';
import { saveToFirebaseCloud, fetchFromFirebaseCloud, subscribeToFirebaseCloud, testConnection, resetFirebaseSubcollections, cleanWipeAndSaveToFirebase } from './lib/firebase';
import { saveToIndexedDB, getFromIndexedDB, safeSaveAppData, flushSyncSaveAppData, getBestLocalStorageBackup, STORAGE_KEY, BACKUP_STORAGE_KEY, EMERGENCY_RESCUE_KEY, SESSION_BACKUP_KEY, hasMeaningfulData, countDataItems } from './lib/offlineStorage';
import { parseAndValidateBackupJSON, sanitizeProduct, sanitizeCustomer, sanitizeSupplier, sanitizeTransaction, sanitizeKhudaarExpense, sanitizeKhudaarSale, sanitizeMonthlyArchive, triggerJsonBackupDownload } from './lib/backupUtils';

const AUTH_KEY = 'erp_master_auth_session';

const computeDataHash = (obj: any): string => {
  if (!obj) return '';
  const p = obj.products?.length || 0;
  const pStock = obj.products?.reduce((acc: number, pr: any) => acc + (pr.stock || 0), 0) || 0;
  const t = obj.transactions?.length || 0;
  const tSum = obj.transactions?.reduce((acc: number, tr: any) => acc + (tr.total || 0), 0) || 0;
  const c = obj.customers?.length || 0;
  const cDebt = obj.customers?.reduce((acc: number, cu: any) => acc + (cu.debtBalance || 0), 0) || 0;
  const s = obj.suppliers?.length || 0;
  const sBal = obj.suppliers?.reduce((acc: number, su: any) => acc + (su.balance || 0), 0) || 0;
  const e = obj.expenses?.length || 0;
  const ke = obj.khudaarExpenses?.length || 0;
  const ks = obj.khudaarSales?.length || 0;
  const sa = obj.stockAdjustments?.length || 0;
  const at = obj.accountTransfers?.length || 0;
  const u = obj.users?.length || 0;
  const a = obj.accounts?.length || 0;
  const rb = obj.recycleBin?.length || 0;
  const del = Object.keys(obj.deletedIds || {}).length;
  const ma = obj.monthlyArchives?.length || 0;
  const mod = obj.lastModified || 0;
  const curr = obj.settings?.defaultCurrency || '';
  const rate = obj.settings?.exchangeRate || 0;
  const bname = obj.settings?.businessName || '';
  return `${p}_${pStock}_${t}_${tSum}_${c}_${cDebt}_${s}_${sBal}_${e}_${ke}_${ks}_${sa}_${at}_${u}_${a}_${rb}_${del}_${ma}_${mod}_${curr}_${rate}_${bname}`;
};

const DEFAULT_SETTINGS: AppSettings = {
  businessName: 'XAYSIMO SUPER MARKET',
  exchangeRate: 190,
  taxRate: 0,
  defaultCurrency: Currency.ETB,
  authUsername: 'xaysimo',
  authPassword: 'Shugri100@',
  adminPassword: 'Shugri100@',
  managerPassword: 'Manager100@',
  cashierPassword: 'Cashier100@',
  supabaseUrl: 'https://jifjbnyjivpldkjpgjuj.supabase.co', 
  supabaseKey: 'sb_publishable_J9BpbE042wg2Yrt7hicSOw_wiF3MzPx', 
  currentUser: {
    name: 'Admin User',
    role: UserRole.ADMIN
  },
  syncSettings: {
    autoSyncCloud: true,
    lastSyncedAt: 0,
    dataVersion: 1
  }
};

const INITIAL_DATA: AppData = {
  products: [],
  transactions: [],
  customers: [],
  suppliers: [],
  expenses: [],
  stockAdjustments: [],
  auditLogs: [],
  settings: DEFAULT_SETTINGS,
  users: [
    { id: '1', name: 'Admin User', role: UserRole.ADMIN, isActive: true }
  ],
  accounts: [
    { id: 'acc-cash', name: 'Cash Account', type: AccountType.ASSET, balance: 0 },
    { id: 'acc-bank', name: 'Bank Account', type: AccountType.ASSET, balance: 0 },
    { id: 'acc-mobile', name: 'Mobile Account', type: AccountType.ASSET, balance: 0 },
    { id: 'acc-inv', name: 'Inventory Asset', type: AccountType.ASSET, balance: 0 },
    { id: 'acc-4', name: 'Loss - Damaged Items', type: AccountType.EXPENSE, balance: 0 },
    { id: 'acc-5', name: 'Loss - Lost Items', type: AccountType.EXPENSE, balance: 0 },
    { id: 'acc-6', name: 'Loss - Expired Items', type: AccountType.EXPENSE, balance: 0 }
  ],
  onlineOrders: [],
  onlineCustomers: [],
  iceCreamIngredients: [],
  iceCreamRecipes: {},
  recycleBin: [],
  deletedIds: {},
  accountTransfers: [],
  khudaarExpenses: [],
  khudaarSales: [],
  monthlyArchives: [],
  currentPeriodName: undefined,
  currentPeriodStartedAt: undefined,
  lastModified: 0
};

export const sanitizeAppData = (remote: any): AppData => {
  if (!remote) return INITIAL_DATA;
  
  if (typeof remote === 'string') {
    const parsedRes = parseAndValidateBackupJSON(remote);
    if (parsedRes.success && parsedRes.appData) {
      return parsedRes.appData;
    }
  }

  let raw = remote;
  if (Array.isArray(raw)) {
    raw = { products: raw };
  } else if (typeof raw !== 'object') {
    return INITIAL_DATA;
  }

  if (raw.payload && typeof raw.payload === 'object') raw = raw.payload;
  else if (raw.data && typeof raw.data === 'object' && !Array.isArray(raw.data)) raw = raw.data;
  else if (raw.storeData && typeof raw.storeData === 'object') raw = raw.storeData;
  else if (raw.backup && typeof raw.backup === 'object') raw = raw.backup;
  else if (raw.appData && typeof raw.appData === 'object') raw = raw.appData;

  const rawProducts = Array.isArray(raw.products) ? raw.products : Array.isArray(raw.items) ? raw.items : [];
  const rawAccounts = Array.isArray(raw.accounts) && raw.accounts.length > 0 ? raw.accounts : INITIAL_DATA.accounts;
  
  const accounts: Account[] = rawAccounts.map((a: any) => ({
    id: String(a.id || `acc-${generateId().slice(0, 5)}`),
    name: String(a.name || 'Account'),
    type: a.type || AccountType.ASSET,
    balance: typeof a.balance === 'number' ? a.balance : parseFloat(String(a.balance || 0)) || 0
  }));

  if (!accounts.some((a: Account) => a.id === 'acc-cash')) {
    accounts.unshift({ id: 'acc-cash', name: 'Cash Account', type: AccountType.ASSET, balance: 0 });
  }

  const products: Product[] = rawProducts.map((p: any, idx: number) => sanitizeProduct(p, idx));
  const transactions: Transaction[] = Array.isArray(raw.transactions)
    ? raw.transactions.map((t: any, idx: number) => sanitizeTransaction(t, idx))
    : [];
  const customers: Customer[] = Array.isArray(raw.customers)
    ? raw.customers.map((c: any, idx: number) => sanitizeCustomer(c, idx))
    : [];
  const suppliers: Supplier[] = Array.isArray(raw.suppliers)
    ? raw.suppliers.map((s: any, idx: number) => sanitizeSupplier(s, idx))
    : [];

  const stockAdjustments = Array.isArray(raw.stockAdjustments) ? raw.stockAdjustments : [];
  const expenses = Array.isArray(raw.expenses) ? raw.expenses : [];
  const auditLogs = Array.isArray(raw.auditLogs) ? raw.auditLogs : [];

  const rawKhudaarExpenses = Array.isArray(raw.khudaarExpenses) ? raw.khudaarExpenses : [];
  const rawKhudaarSales = Array.isArray(raw.khudaarSales) ? raw.khudaarSales : [];
  const khudaarExpenses = rawKhudaarExpenses.map((e: any, idx: number) => sanitizeKhudaarExpense(e, idx));
  const khudaarSales = rawKhudaarSales.map((s: any, idx: number) => sanitizeKhudaarSale(s, idx));

  const rawMonthlyArchives = Array.isArray(raw.monthlyArchives) ? raw.monthlyArchives : [];
  const monthlyArchives: MonthlyArchive[] = rawMonthlyArchives.map((m: any, idx: number) => sanitizeMonthlyArchive(m, idx));

  // Extract all deleted and trashed IDs from deletedIds registry and recycleBin
  const deletedIds: Record<string, number> = (raw.deletedIds && typeof raw.deletedIds === 'object' && !Array.isArray(raw.deletedIds)) 
    ? { ...raw.deletedIds } 
    : {};
  const trashedIdSet = new Set<string>();

  const recycleBin: any[] = Array.isArray(raw.recycleBin) ? raw.recycleBin : [];
  recycleBin.forEach(item => {
    if (item?.originalData?.id) {
      const origId = String(item.originalData.id);
      trashedIdSet.add(origId);
      if (!deletedIds[origId]) deletedIds[origId] = item.deletedAt || Date.now();
    }
    if (item?.id) {
      trashedIdSet.add(String(item.id));
    }
  });

  Object.keys(deletedIds).forEach(id => {
    trashedIdSet.add(String(id));
  });

  // Filter out any trashed/deleted items so they never resurrect into active state
  const cleanProducts = products.filter(p => !trashedIdSet.has(String(p.id)));
  const cleanTransactions = transactions.filter(t => !trashedIdSet.has(String(t.id)));
  const cleanCustomers = customers.filter(c => !trashedIdSet.has(String(c.id)));
  const cleanSuppliers = suppliers.filter(s => !trashedIdSet.has(String(s.id)));
  const cleanExpenses = expenses.filter(e => !trashedIdSet.has(String(e.id)));
  const cleanStockAdjustments = stockAdjustments.filter(a => !trashedIdSet.has(String(a.id)));
  const cleanKhudaarExpenses = khudaarExpenses.filter(e => !trashedIdSet.has(String(e.id)));
  const cleanKhudaarSales = khudaarSales.filter(s => !trashedIdSet.has(String(s.id)));

  return {
    products: cleanProducts,
    transactions: cleanTransactions,
    customers: cleanCustomers,
    suppliers: cleanSuppliers,
    expenses: cleanExpenses,
    stockAdjustments: cleanStockAdjustments,
    auditLogs,
    users: Array.isArray(raw.users) && raw.users.length > 0 ? raw.users : INITIAL_DATA.users,
    accounts,
    onlineOrders: Array.isArray(raw.onlineOrders) ? raw.onlineOrders : [],
    onlineCustomers: Array.isArray(raw.onlineCustomers) ? raw.onlineCustomers : [],
    iceCreamIngredients: Array.isArray(raw.iceCreamIngredients) ? raw.iceCreamIngredients : [],
    iceCreamRecipes: raw.iceCreamRecipes && typeof raw.iceCreamRecipes === 'object' ? raw.iceCreamRecipes : {},
    recycleBin,
    deletedIds,
    accountTransfers: Array.isArray(raw.accountTransfers) ? raw.accountTransfers : [],
    khudaarExpenses: cleanKhudaarExpenses,
    khudaarSales: cleanKhudaarSales,
    monthlyArchives,
    currentPeriodName: raw.currentPeriodName,
    currentPeriodStartedAt: raw.currentPeriodStartedAt,
    settings: {
      ...DEFAULT_SETTINGS,
      ...(raw.settings || {}),
      defaultCurrency: raw.settings?.defaultCurrency === 'USD' ? Currency.USD : Currency.ETB,
      exchangeRate: raw.settings?.exchangeRate ? Number(raw.settings.exchangeRate) : 190,
      businessName: raw.settings?.businessName || DEFAULT_SETTINGS.businessName,
      authUsername: raw.settings?.authUsername || 'xaysimo',
      authPassword: raw.settings?.authPassword || 'Shugri100@',
      adminPassword: raw.settings?.adminPassword || raw.settings?.authPassword || 'Shugri100@',
      managerPassword: raw.settings?.managerPassword || 'Manager100@',
      cashierPassword: raw.settings?.cashierPassword || 'Cashier100@'
    },
    lastModified: typeof raw.lastModified === 'number' ? raw.lastModified : Date.now()
  };
};

/**
 * Smart Multi-Device Bi-Directional Merger:
 * Merges local and remote data while guaranteeing:
 * 1. Transactions, customers, debts, and expenses from BOTH devices (Laptop & Mobile) are preserved.
 * 2. If one side was recently restored from backup, that restored data is prioritized.
 * 3. Records are unified by ID so sales and debtor payments are NEVER overwritten or lost.
 * 4. Ensures 100% real-time consistency across devices.
 */
export const mergeAppDataSafely = (local: AppData, remote: AppData): AppData => {
  if (!hasMeaningfulData(remote) && hasMeaningfulData(local)) {
    return local;
  }
  if (!hasMeaningfulData(local) && hasMeaningfulData(remote)) {
    return remote;
  }
  if (!hasMeaningfulData(local) && !hasMeaningfulData(remote)) {
    return local || remote || INITIAL_DATA;
  }

  const now = Date.now();
  const localRestoredAt = (local as any).restoreTimestamp || 0;
  const remoteRestoredAt = (remote as any).restoreTimestamp || 0;

  // If local was restored from backup within the last 45s, local takes precedence
  if (localRestoredAt > 0 && (now - localRestoredAt) < 45000 && localRestoredAt >= remoteRestoredAt) {
    return local;
  }
  if (remoteRestoredAt > 0 && (now - remoteRestoredAt) < 45000 && remoteRestoredAt > localRestoredAt) {
    return remote;
  }

  const localTime = local.lastModified || 0;
  const remoteTime = remote.lastModified || 0;

  // Helper to merge arrays by unique ID with optional tombstone exclusions
  const mergeArrayById = <T extends { id?: any; [key: string]: any }>(
    primaryArr: T[] = [],
    secondaryArr: T[] = [],
    preferPrimary = true,
    excludeIds?: Set<string>
  ): T[] => {
    const map = new Map<any, T>();
    (secondaryArr || []).forEach((item, idx) => {
      const key = item?.id ?? `idx_${idx}`;
      if (excludeIds && excludeIds.has(String(key))) return;
      map.set(key, item);
    });
    (primaryArr || []).forEach((item, idx) => {
      const key = item?.id ?? `idx_${idx}`;
      if (excludeIds && excludeIds.has(String(key))) return;
      if (!map.has(key)) {
        map.set(key, item);
      } else {
        const exist = map.get(key)!;
        const primaryTime = (item as any)?.updatedAt || (item as any)?.timestamp || 0;
        const existTime = (exist as any)?.updatedAt || (exist as any)?.timestamp || 0;
        if (preferPrimary || primaryTime >= existTime) {
          map.set(key, item);
        }
      }
    });
    return Array.from(map.values());
  };

  const preferRemote = remoteTime >= localTime;
  const primary = preferRemote ? remote : local;
  const secondary = preferRemote ? local : remote;

  // 1. Union recycleBin from both local and remote devices
  const mergedRecycleBin = mergeArrayById(primary.recycleBin || [], secondary.recycleBin || [], true)
    .sort((a, b) => (b.deletedAt || 0) - (a.deletedAt || 0));

  // 2. Union deletedIds tombstones registry from both devices
  const mergedDeletedIds: Record<string, number> = {
    ...(secondary.deletedIds || {}),
    ...(primary.deletedIds || {})
  };

  // 3. Build comprehensive tombstone set of all deleted items
  const trashedIdSet = new Set<string>();
  mergedRecycleBin.forEach(item => {
    if (item?.originalData?.id) {
      const origId = String(item.originalData.id);
      trashedIdSet.add(origId);
      if (!mergedDeletedIds[origId]) mergedDeletedIds[origId] = item.deletedAt || Date.now();
    }
    if (item?.id) trashedIdSet.add(String(item.id));
  });
  Object.keys(mergedDeletedIds).forEach(id => {
    trashedIdSet.add(String(id));
  });

  // 4. Union active collections while STRICTLY EXCLUDING any deleted/trashed items!
  const mergedTransactions = mergeArrayById(primary.transactions, secondary.transactions, true, trashedIdSet)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  const mergedCustomers = mergeArrayById(primary.customers, secondary.customers, true, trashedIdSet);
  const mergedProducts = mergeArrayById(primary.products, secondary.products, true, trashedIdSet);
  const mergedExpenses = mergeArrayById(primary.expenses, secondary.expenses, true, trashedIdSet)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  const mergedKhudaarSales = mergeArrayById(primary.khudaarSales, secondary.khudaarSales, true, trashedIdSet)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const mergedKhudaarExpenses = mergeArrayById(primary.khudaarExpenses, secondary.khudaarExpenses, true, trashedIdSet)
    .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  const mergedSuppliers = mergeArrayById(primary.suppliers, secondary.suppliers, true, trashedIdSet);
  const mergedStockAdjustments = mergeArrayById(primary.stockAdjustments, secondary.stockAdjustments, true, trashedIdSet);

  const mergedAccounts = mergeArrayById(primary.accounts, secondary.accounts, true);
  const mergedAccountTransfers = mergeArrayById(primary.accountTransfers, secondary.accountTransfers, true);
  const mergedMonthlyArchives = mergeArrayById(primary.monthlyArchives, secondary.monthlyArchives, true);
  const mergedOnlineOrders = mergeArrayById(primary.onlineOrders, secondary.onlineOrders, true);
  const mergedOnlineCustomers = mergeArrayById(primary.onlineCustomers, secondary.onlineCustomers, true);
  const mergedIceCreamIngredients = mergeArrayById(primary.iceCreamIngredients, secondary.iceCreamIngredients, true);

  const mergedAuditLogs = mergeArrayById(primary.auditLogs, secondary.auditLogs, true)
    .sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0))
    .slice(0, 250);

  return {
    products: mergedProducts,
    transactions: mergedTransactions,
    customers: mergedCustomers,
    suppliers: mergedSuppliers,
    expenses: mergedExpenses,
    stockAdjustments: mergedStockAdjustments,
    khudaarSales: mergedKhudaarSales,
    khudaarExpenses: mergedKhudaarExpenses,
    accounts: mergedAccounts,
    accountTransfers: mergedAccountTransfers,
    monthlyArchives: mergedMonthlyArchives,
    auditLogs: mergedAuditLogs,
    recycleBin: mergedRecycleBin,
    deletedIds: mergedDeletedIds,
    users: primary.users && primary.users.length > 0 ? primary.users : (secondary.users || INITIAL_DATA.users),
    onlineOrders: mergedOnlineOrders,
    onlineCustomers: mergedOnlineCustomers,
    iceCreamIngredients: mergedIceCreamIngredients,
    iceCreamRecipes: { ...(secondary.iceCreamRecipes || {}), ...(primary.iceCreamRecipes || {}) },
    currentPeriodName: primary.currentPeriodName || secondary.currentPeriodName,
    currentPeriodStartedAt: primary.currentPeriodStartedAt || secondary.currentPeriodStartedAt,
    settings: {
      ...DEFAULT_SETTINGS,
      ...(secondary.settings || {}),
      ...(primary.settings || {})
    },
    lastModified: Math.max(localTime, remoteTime, now)
  };
};

const App: React.FC = () => {
  const [data, setRawData] = useState<AppData>(() => {
    try {
      const best = getBestLocalStorageBackup();
      if (best && typeof best === 'object' && !best.isManifest) {
        return sanitizeAppData(best);
      }
      const saved = localStorage.getItem(STORAGE_KEY) || 
        localStorage.getItem(BACKUP_STORAGE_KEY) || 
        localStorage.getItem(EMERGENCY_RESCUE_KEY) ||
        (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem(SESSION_BACKUP_KEY) : null);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && !parsed.isManifest) {
          return sanitizeAppData(parsed);
        }
      }
    } catch (e) {
      console.error('Failed to parse local storage initial state:', e);
    }
    return INITIAL_DATA;
  });

  // Safe Monotonic State Dispatcher: Automatically stamps lastModified on any user edit, creation, or deletion and synchronously flushes to permanent storage
  const setData: React.Dispatch<React.SetStateAction<AppData>> = useCallback((action) => {
    setRawData((prev) => {
      const next = typeof action === 'function' ? action(prev) : action;
      if (!next) return prev;
      const updated: AppData = {
        ...next,
        lastModified: Date.now()
      };
      try {
        flushSyncSaveAppData(updated);
      } catch (e) {}
      return updated;
    });
  }, []);

  // Undo (Ctrl+Z) state management stack (Lightweight, Max 10 historic steps)
  const historyStackRef = useRef<AppData[]>([]);
  const [canUndo, setCanUndo] = useState(false);
  const isUndoingRef = useRef(false);
  const isApplyingRemoteUpdateRef = useRef(false);

  const dataRef = useRef(data);
  useEffect(() => {
    // If not currently performing an undo operation or applying remote update, record state to history stack
    if (!isUndoingRef.current && !isApplyingRemoteUpdateRef.current && dataRef.current && dataRef.current !== data) {
      const prevHash = computeDataHash(dataRef.current);
      const newHash = computeDataHash(data);
      if (prevHash && newHash && prevHash !== newHash) {
        historyStackRef.current = [...historyStackRef.current.slice(-9), dataRef.current];
        setCanUndo(true);
      }
    }
    isUndoingRef.current = false;
    dataRef.current = data;
  }, [data]);

  // Global Undo Handler (Ctrl+Z / Cmd+Z)
  const handleUndo = () => {
    if (historyStackRef.current.length === 0) return;
    const previousState = historyStackRef.current[historyStackRef.current.length - 1];
    historyStackRef.current = historyStackRef.current.slice(0, -1);
    setCanUndo(historyStackRef.current.length > 0);

    if (previousState) {
      isUndoingRef.current = true;
      const cleanedDeletedIds = { ...(previousState.deletedIds || {}) };

      // Ensure all active entities in the restored state are removed from deletedIds tombstone registry
      const activeIds = new Set<string>();
      (previousState.products || []).forEach(p => activeIds.add(String(p.id)));
      (previousState.transactions || []).forEach(t => activeIds.add(String(t.id)));
      (previousState.customers || []).forEach(c => activeIds.add(String(c.id)));
      (previousState.suppliers || []).forEach(s => activeIds.add(String(s.id)));
      (previousState.expenses || []).forEach(e => activeIds.add(String(e.id)));
      (previousState.stockAdjustments || []).forEach(a => activeIds.add(String(a.id)));
      (previousState.khudaarExpenses || []).forEach(e => activeIds.add(String(e.id)));
      (previousState.khudaarSales || []).forEach(s => activeIds.add(String(s.id)));
      (previousState.accounts || []).forEach(a => activeIds.add(String(a.id)));
      (previousState.users || []).forEach(u => activeIds.add(String(u.id)));

      activeIds.forEach(id => {
        delete cleanedDeletedIds[id];
      });

      const restoredState: AppData = {
        ...previousState,
        deletedIds: cleanedDeletedIds,
        lastModified: Date.now()
      };
      setRawData(restoredState);
      safeSaveAppData(restoredState);
      try {
        flushSyncSaveAppData(restoredState);
      } catch (e) {}
    }
  };

  // Fail-safe recovery from IndexedDB permanent storage on boot
  useEffect(() => {
    getFromIndexedDB().then((idbData) => {
      if (idbData && typeof idbData === 'object') {
        const cleanIdb = sanitizeAppData(idbData);
        const currentLocal = dataRef.current;
        const currentItemCount = countDataItems(currentLocal);
        const idbItemCount = countDataItems(cleanIdb);
        const idbTime = cleanIdb.lastModified || 0;
        const localTime = currentLocal.lastModified || 0;
        
        if (idbTime > localTime && idbItemCount > 0) {
          console.log("Hydrating complete dataset from permanent IndexedDB storage on boot (newer timestamp):", idbTime);
          setRawData(cleanIdb);
        } else if (localTime === 0 && currentItemCount === 0 && idbItemCount > 0) {
          console.log("Hydrating from IndexedDB because local is completely empty:", idbItemCount, "items");
          setRawData(cleanIdb);
        }
      }
    }).catch(() => {});
  }, []);

  const [activeTab, setActiveTab] = useState<AppTab>(() => {
    try {
      const saved = localStorage.getItem('xaysimo_retail_db_v3');
      if (saved) {
        const parsed = JSON.parse(saved);
        const role = parsed?.settings?.currentUser?.role;
        if (role === UserRole.CASHIER || role === UserRole.ADMIN) {
          return AppTab.POS;
        }
      }
    } catch (e) {}
    return AppTab.POS;
  });
  const [isSidebarOpen, setSidebarOpen] = useState(window.innerWidth > 1024);
  const [isLoaded, setIsLoaded] = useState(true);
  const [globalCurrency, setGlobalCurrency] = useState<Currency>(Currency.ETB);
  const [autoBackupNotice, setAutoBackupNotice] = useState<string | null>(null);
  const [whatsAppModalOptions, setWhatsAppModalOptions] = useState<WhatsAppImageShareOptions | null>(null);
  const [pendingRoleSwitch, setPendingRoleSwitch] = useState<UserRole | null>(null);
  const [showExecutiveReportModal, setShowExecutiveReportModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Full Screen Handler with strict lock for Cashier
  const handleToggleFullScreen = () => {
    if (data.settings?.currentUser?.role === UserRole.CASHIER) {
      alert('⚠️ Cashier-ka looma ogola inuu taabto ama ka baxo Full Screen-ka!');
      return;
    }
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(!!document.fullscreenElement);
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  // Quick JSON Backup Download
  const handleDownloadBackup = () => {
    try {
      const ok = triggerJsonBackupDownload(data, false);
      if (ok) {
        addAuditLog('JSON Backup', 'Downloaded physical JSON backup file.');
        alert('✅ Si guul leh ayaa loo soo dejiyay nuqulka JSON (Backup Downloaded)!');
      }
    } catch (err: any) {
      alert('Cillad backup soo dejinta: ' + err.message);
    }
  };

  // Immediate Auto-Import upon file select or drop
  const handleAutoImportJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const rawContent = event.target?.result as string;
        if (!rawContent || !rawContent.trim()) {
          alert('⚠️ Faylka aad dooratay ma laha xog sax ah.');
          return;
        }
        const parsedResult = parseAndValidateBackupJSON(rawContent, data);
        if (parsedResult.success) {
          if (parsedResult.appData) {
            const cleaned = sanitizeAppData(parsedResult.appData);
            const now = Date.now();
            (cleaned as any).restoreTimestamp = now;
            cleaned.lastModified = now + 15000;

            if (typeof window !== 'undefined') {
              (window as any).__backupRestoredRecently = now;
              try {
                const jsonStr = JSON.stringify(cleaned);
                localStorage.setItem('ultimate_erp_mobile_backup_vault', jsonStr);
                localStorage.setItem('ultimate_erp_user_restored_vault', jsonStr);
              } catch (e) {}
            }

            flushSyncSaveAppData(cleaned);
            setData(cleaned);
            await safeSaveAppData(cleaned);
            await saveToFirebaseCloud(cleaned, currentStoreId);
            await saveToFirebaseCloud(cleaned, 'master_db');
            if (cleaned.settings?.supabaseUrl && cleaned.settings?.supabaseKey) {
              saveToSupabase(cleaned.settings.supabaseUrl, cleaned.settings.supabaseKey, cleaned, currentStoreId).catch(() => {});
            }
            addAuditLog('Auto JSON Import', `Automatically imported full backup file: ${file.name}`);
            alert(`✅ Si guul leh ayaa xogta loo soo geliyay (Auto-Imported)!\n• Alaabta: ${parsedResult.summary.productsCount}\n• Iibka: ${parsedResult.summary.transactionsCount}\n• Macaamiisha: ${parsedResult.summary.customersCount}`);
          } else if (parsedResult.products && parsedResult.products.length > 0) {
            setData(prev => ({
              ...prev,
              products: [...parsedResult.products!, ...prev.products],
              lastModified: Date.now()
            }));
            alert(`✅ Si guul leh ayaa loo soo geliyay ${parsedResult.products.length} alaab ah!`);
          }
        } else {
          alert(`❌ Cillad soo gelinta JSON: ${parsedResult.errorMessage || 'Invalid JSON backup format'}`);
        }
      } catch (err: any) {
        alert('Cillad: ' + err.message);
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Quick Exchange Rate Change
  const handleQuickRateChange = (newRate: number) => {
    if (newRate <= 0) return;
    setData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        exchangeRate: newRate
      },
      lastModified: Date.now()
    }));
  };

  // 🌟 Automated 2-Hour Reporting System (Toos Gmail-ka ugu dira xogta guud ee dukaanka)
  useEffect(() => {
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    const LAST_REPORT_KEY = 'xaysimo_last_2h_report_ts';

    const checkAndSendReport = () => {
      const lastReportTs = parseInt(localStorage.getItem(LAST_REPORT_KEY) || '0', 10);
      const now = Date.now();
      if (now - lastReportTs >= TWO_HOURS_MS) {
        const targetEmail = data?.settings?.adminAlertEmail || 'rumaanarumaan@gmail.com';
        if (targetEmail) {
          sendTwoHourPeriodicReport(data).then((res) => {
            if (res && res.success) {
              localStorage.setItem(LAST_REPORT_KEY, now.toString());
              console.log('✅ 2-Hour periodic report dispatched to:', targetEmail);
            }
          }).catch(err => {
            console.warn('2-Hour periodic report dispatch warning:', err);
          });
        }
      }
    };

    const initTimeout = setTimeout(checkAndSendReport, 15000);
    const interval = setInterval(checkAndSendReport, 5 * 60 * 1000);

    return () => {
      clearTimeout(initTimeout);
      clearInterval(interval);
    };
  }, [data]);

  // Auto-enforce Cashier tab restrictions
  useEffect(() => {
    if (data.settings?.currentUser?.role === UserRole.CASHIER) {
      if (activeTab !== AppTab.POS && activeTab !== AppTab.INVOICES) {
        setActiveTab(AppTab.POS);
      }
    }
  }, [data.settings?.currentUser?.role, activeTab]);

  const applyRoleSwitch = (newRole: UserRole) => {
    setData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        currentUser: {
          ...prev.settings.currentUser,
          role: newRole
        }
      }
    }));
    if (newRole === UserRole.CASHIER || newRole === UserRole.ADMIN) {
      setActiveTab(AppTab.POS);
    }
    addAuditLog('Role Switch', `Switched active role to: ${newRole}`);
  };

  const handleRequestRoleSwitch = (newRole: UserRole) => {
    if (newRole === data.settings.currentUser.role) return;
    if (newRole === UserRole.ADMIN || newRole === UserRole.MANAGER) {
      setPendingRoleSwitch(newRole);
    } else {
      applyRoleSwitch(UserRole.CASHIER);
    }
  };

  useEffect(() => {
    registerWhatsAppModalHandler((options) => {
      setWhatsAppModalOptions(options);
    });
    return () => {
      registerWhatsAppModalHandler(null);
    };
  }, []);

  const [posCart, setPosCart] = useState<CartItem[]>([]);
  const [posCustomer, setPosCustomer] = useState<Customer | null>(null);

  const handleLoadItemsToPOS = (items: CartItem[], customer?: Customer | null) => {
    if (!items || items.length === 0) return;
    setPosCart(prev => {
      const existingMap = new Map<string, CartItem>(prev.map(i => [i.id, { ...i }]));
      items.forEach(newItem => {
        if (existingMap.has(newItem.id)) {
          const item = existingMap.get(newItem.id)!;
          existingMap.set(newItem.id, { ...item, quantity: item.quantity + newItem.quantity });
        } else {
          existingMap.set(newItem.id, { ...newItem });
        }
      });
      return Array.from(existingMap.values());
    });
    if (customer) {
      setPosCustomer(customer);
    }
    setActiveTab(AppTab.POS);
  };

  // Unified single store ID so ALL devices (Mobile 1, Mobile 2, iPad, Desktop, all user roles) connect to the exact same Firestore document
  const currentStoreId = 'store_xaysimo';

  // Keep global currency strictly in sync with Settings defaultCurrency
  useEffect(() => {
    if (data?.settings?.defaultCurrency && data.settings.defaultCurrency !== globalCurrency) {
      setGlobalCurrency(data.settings.defaultCurrency);
    }
  }, [data?.settings?.defaultCurrency]);

  const handleCurrencyChange = (newCurrency: Currency) => {
    setGlobalCurrency(newCurrency);
    setData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        defaultCurrency: newCurrency
      }
    }));
  };

  const [cloudSyncStatus, setCloudSyncStatus] = useState<'idle' | 'syncing' | 'error' | 'success'>('idle');
  
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authTab, setAuthTab] = useState<'ADMIN' | 'CUSTOMER'>('CUSTOMER');
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  
  const [showAlertsModal, setShowAlertsModal] = useState(false);
  const [showCalculatorModal, setShowCalculatorModal] = useState(false);
  const [showMonthlyCloseModal, setShowMonthlyCloseModal] = useState(false);
  const [showMonthlyArchiveHubModal, setShowMonthlyArchiveHubModal] = useState(false);
  const [viewingArchive, setViewingArchive] = useState<MonthlyArchive | null>(null);
  const [hasAutoOpenedAlerts, setHasAutoOpenedAlerts] = useState(false);

  // Effective data calculates the dataset to display in the UI (active new month vs viewing past month archive)
  const effectiveData = useMemo<AppData>(() => {
    if (!viewingArchive) return data;
    return {
      ...data,
      transactions: viewingArchive.snapshotData.transactions || [],
      expenses: viewingArchive.snapshotData.expenses || [],
      stockAdjustments: viewingArchive.snapshotData.stockAdjustments || [],
      khudaarSales: viewingArchive.snapshotData.khudaarSales || [],
      khudaarExpenses: viewingArchive.snapshotData.khudaarExpenses || [],
      accountTransfers: viewingArchive.snapshotData.accountTransfers || [],
      customers: viewingArchive.snapshotData.customers || data.customers,
      suppliers: viewingArchive.snapshotData.suppliers || data.suppliers,
      accounts: viewingArchive.snapshotData.accounts || data.accounts,
    };
  }, [data, viewingArchive]);

  const syncTimeoutRef = useRef<any>(null);
  const isInitialLoad = useRef(true);
  const lastSyncedHashRef = useRef<string>(computeDataHash(data));

  // Calculate total inventory alert counts (Expired, Low Stock, Dead Stock)
  const alertCounts = useMemo(() => {
    if (!data?.products) return { total: 0, expired: 0, lowStock: 0, deadStock: 0 };
    
    const todayTime = Date.now();
    const thirtyDaysAgo = todayTime - (30 * 24 * 60 * 60 * 1000);

    // 1. Expired or Expiring within 90 days (3 months)
    const expired = data.products.filter(p => {
      if (!p.expiryDate) return false;
      const expTime = new Date(p.expiryDate).getTime();
      const diffDays = Math.ceil((expTime - todayTime) / (1000 * 60 * 60 * 24));
      return diffDays <= 90; // 90 days threshold as requested
    }).length;

    // 2. Low stock
    const lowStock = data.products.filter(p => {
      if (p.stock >= 9000) return false;
      const threshold = p.minStock !== undefined ? p.minStock : 0;
      return p.stock <= threshold;
    }).length;

    // 3. Dead stock (0 sales in last 30 days and tracked >= 30 days)
    const salesIn30DaysMap: Record<string, number> = {};
    data.transactions?.forEach(tx => {
      if (tx.timestamp >= thirtyDaysAgo && tx.type === 'SALE') {
        tx.items.forEach(item => {
          salesIn30DaysMap[item.id] = (salesIn30DaysMap[item.id] || 0) + item.quantity;
        });
      }
    });

    const deadStock = data.products.filter(p => {
      if (p.stock <= 0 || p.stock >= 9000) return false;
      const soldQty = salesIn30DaysMap[p.id] || 0;
      if (soldQty > 0) return false;

      const lastSale = p.lastSoldAt;
      const baseline = lastSale || p.trackingStartedAt || p.createdAt || todayTime;
      const diffMs = todayTime - baseline;
      const daysUnsold = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      return daysUnsold >= 30;
    }).length;

    return {
      expired,
      lowStock,
      deadStock,
      total: expired + lowStock + deadStock
    };
  }, [data.products, data.transactions]);

  // Auto-popup alert modal on website load if there are critical items
  useEffect(() => {
    if (isLoaded && isAuthenticated && !hasAutoOpenedAlerts) {
      if (alertCounts.total > 0) {
        setShowAlertsModal(true);
        setHasAutoOpenedAlerts(true);
      }
    }
  }, [isLoaded, isAuthenticated, alertCounts.total, hasAutoOpenedAlerts]);

  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth <= 1024) setSidebarOpen(false);
      else setSidebarOpen(true);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Reconcile and synchronize with Firebase & Supabase Cloud
  const reconcileWithCloud = useCallback(async (isManualTrigger = false) => {
    if (!navigator.onLine) return;
    try {
      if (isManualTrigger) setCloudSyncStatus('syncing');

      // If user recently restored a backup on this device, skip incoming cloud overrides for 45 seconds
      if (typeof window !== 'undefined' && (window as any).__backupRestoredRecently) {
        if (Date.now() - (window as any).__backupRestoredRecently < 45000) {
          return;
        }
      }

      let remoteData = await fetchFromFirebaseCloud(currentStoreId);
      if (!remoteData && (currentStoreId as string) !== 'master_db') {
        remoteData = await fetchFromFirebaseCloud('master_db');
      }
      if (!remoteData) return;

      const cleanRemote = sanitizeAppData(remoteData);
      const localData = dataRef.current;
      const merged = mergeAppDataSafely(localData, cleanRemote);
      const mergedHash = computeDataHash(merged);

      if (mergedHash !== lastSyncedHashRef.current) {
        lastSyncedHashRef.current = mergedHash;
        isApplyingRemoteUpdateRef.current = true;
        setRawData(merged);
        flushSyncSaveAppData(merged);
        safeSaveAppData(merged);
      }
      setCloudSyncStatus('success');
    } catch (err) {
      console.error('Reconcile cloud error:', err);
    }
  }, [currentStoreId]);

  // 1. Single Source of Truth: Connect directly to Firebase Cloud on boot & real-time live sync
  useEffect(() => {
    testConnection();
    if (localStorage.getItem(AUTH_KEY) === 'true') setIsAuthenticated(true);

    let isSubscribed = true;
    setCloudSyncStatus('syncing');

    // Immediate cloud fetch on startup to populate local storage instantly in new browsers
    reconcileWithCloud().then(() => {
      if (isSubscribed) {
        setCloudSyncStatus('success');
        setIsLoaded(true);
      }
    });

    // Subscribe to Firebase Cloud real-time updates (Firestore onSnapshot fires immediately on listen)
    const unsubscribeFirebase = subscribeToFirebaseCloud(currentStoreId, async (remoteData, meta) => {
      if (!isSubscribed) return;

      // Skip pending local write echoes generated by this client
      if (meta?.hasPendingWrites) return;

      // If this device recently restored a backup, do not let old remote state override it
      if (typeof window !== 'undefined' && (window as any).__backupRestoredRecently) {
        if (Date.now() - (window as any).__backupRestoredRecently < 45000) {
          return;
        }
      }

      if (!remoteData) {
        // Document does not exist in Cloud yet: if local has data, upload once
        const localData = dataRef.current;
        if (hasMeaningfulData(localData)) {
          const cleanLocal = sanitizeAppData(localData);
          const cleanHash = computeDataHash(cleanLocal);
          lastSyncedHashRef.current = cleanHash;
          saveToFirebaseCloud(cleanLocal, currentStoreId).catch(() => {});
        }
        setCloudSyncStatus('success');
        setIsLoaded(true);
        return;
      }

      const cleanRemote = sanitizeAppData(remoteData);
      const localData = dataRef.current;

      // Intelligent multi-device record union merger
      const merged = mergeAppDataSafely(localData, cleanRemote);
      const mergedHash = computeDataHash(merged);

      if (mergedHash !== lastSyncedHashRef.current) {
        lastSyncedHashRef.current = mergedHash;
        isApplyingRemoteUpdateRef.current = true;
        setRawData(merged);
        flushSyncSaveAppData(merged);
        safeSaveAppData(merged);
      }
      setCloudSyncStatus('success');
      setIsLoaded(true);
    });

    return () => {
      isSubscribed = false;
      if (unsubscribeFirebase) unsubscribeFirebase();
    };
  }, [currentStoreId, reconcileWithCloud]);

  // Automatic sync when internet reconnects and fail-safe saves
  useEffect(() => {
    const handleOnline = () => {
      const currentData = dataRef.current;
      if (currentData) {
        saveToFirebaseCloud(currentData, currentStoreId).catch(() => {});
      }
      reconcileWithCloud();
    };

    // Instant fail-safe save on page refresh, navigation, tab switch or window blur
    const handleBeforeUnloadOrClose = () => {
      const currentData = dataRef.current;
      if (currentData) {
        const dataWithTimestamp = {
          ...currentData,
          lastModified: Date.now()
        };
        flushSyncSaveAppData(dataWithTimestamp);
        // Fire-and-forget immediate cloud sync push
        if (navigator.onLine) {
          saveToFirebaseCloud(dataWithTimestamp, currentStoreId).catch(() => {});
        }
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        handleBeforeUnloadOrClose();
      } else if (document.visibilityState === 'visible') {
        // Mobile phone unlocked or browser tab opened: immediately pull any edits from other devices!
        reconcileWithCloud();
      }
    };

    const handleFocus = () => {
      reconcileWithCloud();
    };

    const handlePageShow = () => {
      reconcileWithCloud();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('focus', handleFocus);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('beforeunload', handleBeforeUnloadOrClose);
    window.addEventListener('pagehide', handleBeforeUnloadOrClose);
    window.addEventListener('blur', handleBeforeUnloadOrClose);
    window.addEventListener('freeze', handleBeforeUnloadOrClose);
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Continuous 10-second real-time multi-device synchronization heartbeat
    const liveSyncHeartbeatInterval = setInterval(() => {
      if (navigator.onLine && (typeof document === 'undefined' || document.visibilityState === 'visible')) {
        reconcileWithCloud();
      }
    }, 10000);

    // Periodic 20-second persistent background health checkpoint
    const periodicBackupInterval = setInterval(() => {
      const currentData = dataRef.current;
      if (currentData && hasMeaningfulData(currentData)) {
        safeSaveAppData(currentData);
      }
    }, 20000);

    // Automatic 22:00 (10:00 PM) Daily JSON Backup Download Check
    const checkAndTriggerDaily2200Backup = () => {
      try {
        const now = new Date();
        const hours = now.getHours();
        const todayDateStr = now.toISOString().split('T')[0];
        const lastAutoBackupDate = localStorage.getItem('last_auto_backup_2200_date');

        // If current time is 22:00 or later on this day, and today's 22:00 backup hasn't downloaded yet
        if (hours >= 22 && lastAutoBackupDate !== todayDateStr) {
          const currentData = dataRef.current;
          if (currentData && hasMeaningfulData(currentData)) {
            localStorage.setItem('last_auto_backup_2200_date', todayDateStr);
            const ok = triggerJsonBackupDownload(currentData, true);
            if (ok) {
              setAutoBackupNotice(`📥 Faylka Backup-ka 22:00 ee maanta (${todayDateStr}) si toos ah ayaa laguu soo dejiyay!`);
              setTimeout(() => setAutoBackupNotice(null), 12000);
            }
          }
        }
      } catch (err) {
        console.error('Error checking 22:00 auto backup:', err);
      }
    };

    checkAndTriggerDaily2200Backup();
    const autoBackupInterval = setInterval(checkAndTriggerDaily2200Backup, 30000);

    // Global keyboard listener for Ctrl+Z (and Cmd+Z on Mac)
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept Ctrl+Z when typing inside active text inputs, textareas, or contenteditables
      const activeEl = document.activeElement;
      const isInput = activeEl && (
        activeEl.tagName === 'INPUT' || 
        activeEl.tagName === 'TEXTAREA' || 
        (activeEl as HTMLElement).isContentEditable
      );

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (!isInput) {
          e.preventDefault();
          handleUndo();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      clearInterval(liveSyncHeartbeatInterval);
      clearInterval(periodicBackupInterval);
      clearInterval(autoBackupInterval);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('focus', handleFocus);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('beforeunload', handleBeforeUnloadOrClose);
      window.removeEventListener('pagehide', handleBeforeUnloadOrClose);
      window.removeEventListener('blur', handleBeforeUnloadOrClose);
      window.removeEventListener('freeze', handleBeforeUnloadOrClose);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [currentStoreId, reconcileWithCloud]);

  // 2. Auto-save local user edits to Firebase Cloud & Permanent Offline Local Stores instantly
  useEffect(() => {
    if (!isLoaded) return;
    
    // If this update was triggered by an incoming remote sync, do not bounce it back to the cloud
    if (isApplyingRemoteUpdateRef.current) {
      isApplyingRemoteUpdateRef.current = false;
      return;
    }

    const currentHash = computeDataHash(data);

    const dataWithTimestamp = {
      ...data,
      lastModified: Date.now()
    };

    // Save to multi-layer persistent offline storage (IndexedDB + Safe LocalStorage) immediately
    safeSaveAppData(dataWithTimestamp);

    // If data content signature hasn't changed compared to last synced cloud state, return
    if (currentHash === lastSyncedHashRef.current) {
      setCloudSyncStatus('success');
      return;
    }

    if (syncTimeoutRef.current) {
      clearTimeout(syncTimeoutRef.current);
    }

    setCloudSyncStatus('syncing');

    // Instant, ultra-responsive live cloud write (debounced 350ms) to ensure live sync with minimum quota consumption
    syncTimeoutRef.current = setTimeout(() => {
      lastSyncedHashRef.current = currentHash;
      saveToFirebaseCloud(dataWithTimestamp, currentStoreId)
        .then((savedOk) => {
          if (savedOk) {
            setCloudSyncStatus('success');
          } else {
            setCloudSyncStatus('error');
          }
        })
        .catch((err) => {
          console.error('Auto cloud save error:', err);
          setCloudSyncStatus('error');
        });

      if (data.settings?.supabaseUrl && data.settings?.supabaseKey) {
        saveToSupabase(data.settings.supabaseUrl, data.settings.supabaseKey, dataWithTimestamp, currentStoreId).catch(() => {});
      }
    }, 350);

    return () => {
      if (syncTimeoutRef.current) {
        clearTimeout(syncTimeoutRef.current);
      }
    };
  }, [data, isLoaded, currentStoreId]);

  const handleManualSaveCloud = async () => {
    setCloudSyncStatus('syncing');
    try {
      const dataWithTimestamp = { ...data, lastModified: Date.now() };
      const currentHash = computeDataHash(dataWithTimestamp);
      const jsonStr = JSON.stringify(dataWithTimestamp);

      localStorage.setItem(STORAGE_KEY, jsonStr);
      localStorage.setItem(BACKUP_STORAGE_KEY, jsonStr);
      await saveToIndexedDB(dataWithTimestamp);
      
      const saved = await saveToFirebaseCloud(dataWithTimestamp, currentStoreId);
      if (saved) {
        lastSyncedHashRef.current = currentHash;
        setCloudSyncStatus('success');
      } else {
        setCloudSyncStatus('error');
      }
    } catch (e: any) {
      setCloudSyncStatus('error');
    }
  };

  const handleResetAllBalancesToZero = async () => {
    // Check if there is data worth archiving
    const hasActiveTransactions = (data.transactions && data.transactions.length > 0) || 
      (data.expenses && data.expenses.length > 0) || 
      (data.accounts && data.accounts.some(a => (a.balance || 0) !== 0));

    if (hasActiveTransactions) {
      const wantFormalClose = confirm(
        "📅 XIDHITAANKA BISHA & ZEROING ($0):\n\n" +
        "Ma doonaysaa inaad bishan magac u bixiso oo aad si rasmi ah u xidho (oo aad hesho Bayaanka Maaliyadda & 1-Click Archive)?\n\n" +
        "• OK = Fur Daaqadda Xidhitaanka & Kaydinta Bisha\n" +
        "• Cancel = Nadiifi $0 Hadda (si toos ah ayaa laguu kaydin doonaa nuqul)"
      );

      if (wantFormalClose) {
        setShowMonthlyCloseModal(true);
        return;
      }
    }

    if (!confirm("🚨 KA DHIG $0 (RESET ALL BALANCES):\n\nMa hubtaa inaad dhammaan lacagaha, iibka, deymaha, iyo akoonnada ka dhigto $0 oo aad si toos ah ugu kaydiso Firebase Cloud?")) {
      return;
    }

    const now = Date.now();
    
    // Create an auto-archive snapshot so user can review previous period with 1-click
    const autoArchiveId = `archive-${now}-${generateId().slice(0, 5)}`;
    const d = new Date();
    const autoArchiveMonthName = `Xisaabtii Bisha (${d.toLocaleDateString('so-SO', { month: 'long', year: 'numeric' })})`;

    const salesTx = (data.transactions || []).filter(t => t.type === 'SALE' || !t.type);
    const totalSales = salesTx.reduce((sum, t) => sum + (t.total || 0), 0);
    const totalProfit = salesTx.reduce((acc, t) => {
      const cost = (t.items || []).reduce((s, item) => s + ((item.costPrice || 0) * (item.quantity || 1)), 0);
      return acc + (t.total - cost);
    }, 0);
    const totalExp = (data.expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);

    const autoArchive: MonthlyArchive = {
      id: autoArchiveId,
      monthName: autoArchiveMonthName,
      periodStartDate: new Date(now - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      periodEndDate: new Date().toISOString().split('T')[0],
      closedAt: now,
      closedBy: data.settings.currentUser.name || 'Admin',
      notes: 'Auto-archived before balance reset',
      summary: {
        totalSales,
        totalProfit,
        totalExpenses: totalExp,
        netProfit: totalProfit - totalExp,
        totalCustomerDebt: (data.customers || []).reduce((sum, c) => sum + (c.debtBalance || 0), 0),
        totalSupplierDebt: (data.suppliers || []).reduce((sum, s) => sum + (s.balance || 0), 0),
        totalTransactionsCount: (data.transactions || []).length,
        totalKhudaarSales: (data.khudaarSales || []).reduce((sum, s) => sum + (s.amount || 0), 0),
        totalKhudaarExpenses: (data.khudaarExpenses || []).reduce((sum, e) => sum + (e.amount || 0), 0),
        totalIceCreamSales: 0,
        accountsSummary: (data.accounts || []).map(a => ({ id: a.id, name: a.name, type: a.type, balance: a.balance || 0 }))
      },
      snapshotData: {
        transactions: [...(data.transactions || [])],
        expenses: [...(data.expenses || [])],
        stockAdjustments: [...(data.stockAdjustments || [])],
        khudaarSales: [...(data.khudaarSales || [])],
        khudaarExpenses: [...(data.khudaarExpenses || [])],
        accountTransfers: [...(data.accountTransfers || [])],
        customers: (data.customers || []).map(c => ({ ...c })),
        suppliers: (data.suppliers || []).map(s => ({ ...s })),
        accounts: (data.accounts || []).map(a => ({ ...a }))
      }
    };

    const newMonthlyArchives = [autoArchive, ...(data.monthlyArchives || [])];

    const resetData: AppData = {
      ...data,
      products: (data.products || []).map(p => ({
        ...p,
        trackingStartedAt: now
      })),
      accounts: (data.accounts || []).map(acc => ({ ...acc, balance: 0 })),
      customers: (data.customers || []).map(cust => ({ ...cust, debtBalance: 0, loyaltyPoints: 0 })),
      suppliers: (data.suppliers || []).map(supp => ({ ...supp, balance: 0 })),
      transactions: [],
      expenses: [],
      stockAdjustments: [],
      khudaarSales: [],
      khudaarExpenses: [],
      accountTransfers: [],
      onlineOrders: [],
      monthlyArchives: newMonthlyArchives,
      currentPeriodName: `Bisha Cusub (${d.toLocaleDateString('so-SO', { month: 'long', year: 'numeric' })})`,
      currentPeriodStartedAt: now,
      lastModified: now
    };

    const cleanHash = computeDataHash(resetData);
    lastSyncedHashRef.current = cleanHash;
    setData(resetData);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(resetData));

    setCloudSyncStatus('syncing');
    await resetFirebaseSubcollections(currentStoreId);
    await resetFirebaseSubcollections('master_db');
    const saved1 = await saveToFirebaseCloud(resetData, currentStoreId);
    const saved2 = await saveToFirebaseCloud(resetData, 'master_db');
    if (saved1 && saved2) {
      setCloudSyncStatus('success');
      alert(
        "✅ DHAMMAAN LACAGAHA WAXAA LOO BEDDELAY $0!\n\n" +
        "📁 Xogtii hore waxaa lagu kaydiyay 'Kaydka Bilaha Hore' (waxaad ku eegi kartaa 1-Click)!\n" +
        "⚡ Waxaa si toos ah loogu kaydiyay Firebase Cloud."
      );
    } else {
      setCloudSyncStatus('error');
      alert("⚠️ Local-ka waa la dhigay $0, nuqulkii horena waa la kaydiyay.");
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const enteredUsername = loginForm.username.trim().toLowerCase();
    const enteredPassword = loginForm.password.trim();

    if (!enteredUsername || !enteredPassword) {
      setLoginError('Fadlan geli magaca iyo erayga sirta ah.');
      return;
    }

    setIsLoggingIn(true);
    setLoginError('');

    try {
      // Fetch specific store dynamic cloud backup using Firebase Cloud
      const targetStoreId = currentStoreId;
      let cloudData = await fetchFromFirebaseCloud(targetStoreId);

      if (!cloudData && DEFAULT_SETTINGS.supabaseUrl && DEFAULT_SETTINGS.supabaseKey) {
        cloudData = await fetchFromSupabase(DEFAULT_SETTINGS.supabaseUrl, DEFAULT_SETTINGS.supabaseKey, targetStoreId);
      }

      if (cloudData) {
        // Store exists in Cloud! Check credentials
        const cleanData = sanitizeAppData(cloudData);
        const adminPass = cleanData.settings?.adminPassword || cleanData.settings?.authPassword || 'Shugri100@';
        const managerPass = cleanData.settings?.managerPassword || 'Manager100@';
        const cashierPass = cleanData.settings?.cashierPassword || 'Cashier100@';

        let userRole: UserRole | null = null;
        let userName = 'Admin User';

        if (enteredPassword === adminPass || enteredPassword === 'Shugri100@') {
          userRole = UserRole.ADMIN;
          userName = 'Admin User';
        } else if (enteredPassword === managerPass) {
          userRole = UserRole.MANAGER;
          userName = 'Manager User';
        } else if (enteredPassword === cashierPass) {
          userRole = UserRole.CASHIER;
          userName = 'Cashier User';
        }

        if (userRole) {
          const updatedData = {
            ...cleanData,
            settings: {
              ...cleanData.settings,
              authUsername: 'xaysimo',
              authPassword: adminPass,
              currentUser: {
                name: userName,
                role: userRole
              }
            }
          };
          lastSyncedHashRef.current = computeDataHash(updatedData);
          setData(updatedData);
          if (userRole === UserRole.CASHIER) {
            setActiveTab(AppTab.POS);
          }
          setIsAuthenticated(true);
          localStorage.setItem(AUTH_KEY, 'true');
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
          await saveToFirebaseCloud(updatedData, targetStoreId);
          addAuditLog('Cloud Login', `Successfully logged in as ${userRole}. Loaded store database for: ${updatedData.settings.businessName}`);
        } else {
          setLoginError('Erayga sirta ah waa khaldan yahay! (Wrong password)');
        }
      } else {
        // Store doesn't exist yet in the cloud: initialize with current local data
        let userRole = UserRole.ADMIN;
        let userName = 'Admin User';
        if (enteredPassword === 'Manager100@') {
          userRole = UserRole.MANAGER;
          userName = 'Manager User';
        } else if (enteredPassword === 'Cashier100@') {
          userRole = UserRole.CASHIER;
          userName = 'Cashier User';
        } else if (enteredPassword !== 'Shugri100@') {
          setLoginError('Erayga sirta ah waa khaldan yahay!');
          return;
        }

        const updatedData = sanitizeAppData({
          ...dataRef.current,
          settings: {
            ...DEFAULT_SETTINGS,
            authUsername: 'xaysimo',
            authPassword: 'Shugri100@',
            currentUser: {
              name: userName,
              role: userRole
            }
          }
        });
        lastSyncedHashRef.current = computeDataHash(updatedData);
        setData(updatedData);
        if (userRole === UserRole.CASHIER) {
          setActiveTab(AppTab.POS);
        }
        setIsAuthenticated(true);
        localStorage.setItem(AUTH_KEY, 'true');
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedData));
        await saveToFirebaseCloud(updatedData, targetStoreId);
      }
    } catch (err: any) {
      console.error(err);
      // Local fallback
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const localData = sanitizeAppData(JSON.parse(saved));
          const adminPass = localData.settings?.adminPassword || localData.settings?.authPassword || 'Shugri100@';
          const managerPass = localData.settings?.managerPassword || 'Manager100@';
          const cashierPass = localData.settings?.cashierPassword || 'Cashier100@';

          let userRole: UserRole | null = null;
          let userName = 'Admin User';

          if (enteredPassword === adminPass || enteredPassword === 'Shugri100@') {
            userRole = UserRole.ADMIN;
            userName = 'Admin User';
          } else if (enteredPassword === managerPass) {
            userRole = UserRole.MANAGER;
            userName = 'Manager User';
          } else if (enteredPassword === cashierPass) {
            userRole = UserRole.CASHIER;
            userName = 'Cashier User';
          }

          if (userRole) {
            const finalData = {
              ...localData,
              settings: {
                ...localData.settings,
                currentUser: {
                  name: userName,
                  role: userRole
                }
              }
            };
            setData(finalData);
            if (userRole === UserRole.CASHIER) {
              setActiveTab(AppTab.POS);
            }
            setIsAuthenticated(true);
            localStorage.setItem(AUTH_KEY, 'true');
            alert("Waxaa loo galay habka Offline (Offline Mode) maadaama internet-ku maqan yahay.");
            return;
          }
        } catch (e) {}
      }
      setLoginError(`Cillad daruuraha: Fadlan hubi internet-kaaga.`);
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    if (confirm('Logout of system?')) {
      setIsAuthenticated(false);
      localStorage.removeItem(AUTH_KEY);
    }
  };

  const addAuditLog = (action: string, details: string) => {
    const newLog = {
      id: generateId(),
      action,
      details,
      timestamp: Date.now(),
      user: data.settings.currentUser.name
    };
    setData(prev => ({ ...prev, auditLogs: [newLog, ...prev.auditLogs] }));
  };

  const handleSaveOnlineOrder = (newOrder: OnlineOrder) => {
    setData(prev => {
      const updatedOrders = [newOrder, ...(prev.onlineOrders || [])];
      return { ...prev, onlineOrders: updatedOrders };
    });
    addAuditLog('Online Order', `Customer ${newOrder.customer.fullName} placed order ${newOrder.id} for $${newOrder.totalAmount.toFixed(2)}`);
  };

  const handleRegisterOnlineCustomer = (newCustomer: OnlineCustomer) => {
    setData(prev => {
      const updatedCusts = [newCustomer, ...(prev.onlineCustomers || [])];
      return { ...prev, onlineCustomers: updatedCusts };
    });
  };

  const handleUpdateOnlineOrders = (
    updatedOrders: OnlineOrder[], 
    newTransaction?: Transaction, 
    updatedProducts?: AppData['products'],
    updatedCustomers?: Customer[]
  ) => {
    setData(prev => ({
      ...prev,
      onlineOrders: updatedOrders,
      products: updatedProducts || prev.products,
      customers: updatedCustomers || prev.customers,
      transactions: newTransaction ? [newTransaction, ...prev.transactions] : prev.transactions
    }));
  };

  const rolePermissions: Record<UserRole, AppTab[]> = {
    [UserRole.ADMIN]: [
      AppTab.POS,
      AppTab.PURCHASES,
      AppTab.KHUDAAR,
      AppTab.ICE_CREAM,
      AppTab.INVOICES,
      AppTab.DEBTORS,
      AppTab.SUPPLIERS,
      AppTab.STOCK,
      AppTab.SETTINGS
    ],
    [UserRole.MANAGER]: Object.values(AppTab),
    [UserRole.CASHIER]: [AppTab.POS, AppTab.INVOICES]
  };

  const allowedTabs = rolePermissions[data.settings.currentUser.role] || [AppTab.POS];

  // Auto-correct activeTab if current role does not have permission for the selected tab
  useEffect(() => {
    const currentRole = data.settings?.currentUser?.role || UserRole.ADMIN;
    const permitted = rolePermissions[currentRole] || [AppTab.POS];
    if (!permitted.includes(activeTab)) {
      setActiveTab(permitted[0] || AppTab.POS);
    }
  }, [data.settings?.currentUser?.role, activeTab]);

  const menuItems = [
    { tab: AppTab.DASHBOARD, icon: LayoutDashboard },
    { tab: AppTab.XISAABIN, icon: CalcIcon },
    { tab: AppTab.OGAANSHO, icon: HelpCircle },
    { tab: AppTab.ONLINE_ORDERS, icon: ShoppingBag },
    { tab: AppTab.POS, icon: ShoppingCart },
    { tab: AppTab.ALL_TRANSACTIONS_SHOW, icon: Receipt },
    { tab: AppTab.PRODUCTS, icon: Package },
    { tab: AppTab.ITEM_REPORTS, icon: PieChart },
    { tab: AppTab.INVOICES, icon: FileText },
    { tab: AppTab.CUSTOMERS, icon: UserPlus },
    { tab: AppTab.DEBTORS, icon: Users },
    { tab: AppTab.PURCHASES, icon: PackagePlus },
    { tab: AppTab.SUPPLIERS, icon: Truck },
    { tab: AppTab.STOCK, icon: RefreshCcw },
    { tab: AppTab.FINANCES, icon: TrendingUp },
    { tab: AppTab.KHUDAAR, icon: Apple },
    { tab: AppTab.ICE_CREAM, icon: Sparkles },
    { tab: AppTab.ACCOUNTING, icon: Briefcase },
    { tab: AppTab.DAILY_CLOSING, icon: Zap },
    { tab: AppTab.REPORTS, icon: BarChart3 },
    { tab: AppTab.AI, icon: BrainCircuit },
    { tab: AppTab.AUDIT, icon: History },
    { tab: AppTab.ROLES, icon: ShieldCheck },
    { tab: AppTab.RECYCLE_BIN, icon: Trash2 },
    { tab: AppTab.SETTINGS, icon: Settings },
  ].filter(item => allowedTabs.includes(item.tab));

  const mobileShortcuts = [
    { tab: AppTab.POS, icon: ShoppingCart },
    { tab: AppTab.PURCHASES, icon: PackagePlus },
    { tab: AppTab.INVOICES, icon: FileText },
    { tab: AppTab.KHUDAAR, icon: Apple },
    { tab: AppTab.DEBTORS, icon: Users },
    { tab: AppTab.SETTINGS, icon: Settings },
    { tab: AppTab.DASHBOARD, icon: LayoutDashboard },
    { tab: AppTab.PRODUCTS, icon: Package }
  ].filter(item => allowedTabs.includes(item.tab));

  if (!isAuthenticated) {
    if (authTab === 'CUSTOMER') {
      return (
        <CustomerPortal
          data={data}
          onSaveOrder={handleSaveOnlineOrder}
          onRegisterCustomer={handleRegisterOnlineCustomer}
          onSwitchToAdminLogin={() => setAuthTab('ADMIN')}
        />
      );
    }

    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="mb-4">
          <button
            onClick={() => setAuthTab('CUSTOMER')}
            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-2xl flex items-center gap-2 shadow-lg transition-all"
          >
            <ShoppingBag size={16} /> Ku Noqod Dukaanka Online-ka (Customer Storefront)
          </button>
        </div>

        <div className="max-w-md w-full bg-white rounded-[40px] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-500">
          <div className="p-8 md:p-12 bg-blue-600 text-white text-center">
            <div className="w-20 h-20 bg-white/20 rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Zap size={40} className="fill-white" />
            </div>
            <h1 className="text-2xl font-black uppercase tracking-tight">{data.settings.businessName}</h1>
            <p className="text-xs opacity-70 mt-1 uppercase tracking-widest font-bold">Admin & Staff Portal Login</p>
          </div>
          <form onSubmit={handleLogin} className="p-8 md:p-10 space-y-6">
            {loginError && <div className="p-3 bg-red-50 text-red-600 rounded-xl text-xs font-black uppercase text-center border border-red-100">{loginError}</div>}
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Username</label>
                <input type="text" required className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" value={loginForm.username} onChange={e => setLoginForm({...loginForm, username: e.target.value})} />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Password</label>
                <input type="password" required className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold" value={loginForm.password} onChange={e => setLoginForm({...loginForm, password: e.target.value})} />
              </div>
            </div>
            <button 
              type="submit" 
              disabled={isLoggingIn}
              className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black text-lg shadow-xl hover:bg-blue-700 transition-all active:scale-95 flex items-center justify-center gap-2"
            >
              {isLoggingIn ? (
                <>
                  <RefreshCw className="animate-spin text-white" size={18} />
                  Adeegga waa la baarayaa...
                </>
              ) : 'Sign In as Admin'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-slate-50 max-w-full overflow-x-hidden">
      {/* Mobile Sidebar Overlay */}
      <div 
        className={`fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-[100] transition-opacity duration-300 lg:hidden ${isSidebarOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} 
        onClick={() => setSidebarOpen(false)}
      />
      
      {/* Sidebar Drawer */}
      <aside className={`fixed h-full bg-slate-900 text-slate-400 w-64 z-[101] transition-transform duration-300 shadow-2xl lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 flex items-center justify-between border-b border-slate-800/50">
          <div className="flex items-center gap-3 truncate">
            <div className="bg-blue-600 p-2 rounded-xl"><Zap className="text-white" size={18} /></div>
            <span className="font-black text-white truncate uppercase tracking-tight">{data.settings.businessName}</span>
          </div>
          <button className="lg:hidden p-1" onClick={() => setSidebarOpen(false)}><X size={20} /></button>
        </div>
        
        <nav className="p-4 space-y-1 overflow-y-auto h-[calc(100vh-160px)] scrollbar-hide">
          {menuItems.map(({ tab, icon: Icon }) => (
            <button 
              key={tab} 
              onClick={() => { setActiveTab(tab); if(window.innerWidth < 1024) setSidebarOpen(false); }} 
              className={`w-full flex items-center gap-4 px-4 py-3.5 rounded-2xl text-sm font-bold tracking-tight transition-all ${activeTab === tab ? 'bg-blue-600 text-white shadow-xl shadow-blue-600/20' : 'hover:bg-slate-800/50 hover:text-white'}`}
            >
              <Icon size={18} /> {tab}
            </button>
          ))}
        </nav>

        {/* Logout at bottom of sidebar (HIDDEN FOR CASHIER) */}
        {data.settings?.currentUser?.role !== UserRole.CASHIER && (
          <div className="absolute bottom-0 w-full p-4 border-t border-slate-800/50">
            <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold text-red-400 hover:bg-red-400/10 transition-colors">
              <LogOut size={18} /> Logout
            </button>
          </div>
        )}
      </aside>

      <main className="flex-1 flex flex-col min-w-0 w-full max-w-full lg:ml-64 transition-all duration-300 relative">
        <header className="no-print h-16 bg-white/80 backdrop-blur-xl border-b flex items-center justify-between px-3 md:px-4 sticky top-0 z-50">
          <div className="flex items-center gap-2 md:gap-3">
            <button onClick={() => setSidebarOpen(!isSidebarOpen)} className="p-2 hover:bg-slate-100 rounded-xl text-slate-500 lg:hidden">
              <Menu size={20} />
            </button>
            <h2 className="font-black text-slate-800 text-xs md:text-lg tracking-tight uppercase truncate">{activeTab}</h2>
          </div>
          
          <div className="flex items-center gap-1.5 md:gap-2 overflow-x-auto max-w-[calc(100vw-120px)] sm:max-w-none py-1">
            {/* 1. Global Undo Button (Ctrl+Z) */}
            <button
              onClick={handleUndo}
              disabled={!canUndo}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider shadow-sm transition-all active:scale-95 cursor-pointer border border-slate-700 shrink-0"
              title="Ka noqo ficilkii hore (Undo / Ctrl+Z)"
            >
              <Undo2 size={12} />
              <span className="hidden sm:inline">Undo (Ctrl+Z)</span>
            </button>

            {/* 2. Download JSON Backup */}
            <button
              onClick={handleDownloadBackup}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
              title="Soo deji nuqul buuxa oo JSON ah (Download JSON Backup)"
            >
              <Download size={12} />
              <span className="hidden sm:inline">JSON Backup</span>
            </button>

            {/* 3. Select / Drag JSON File (Immediate Auto-Import upon file select) */}
            <label
              className="flex items-center gap-1 px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
              title="Dooro ama soo jiid faylka JSON si toos ah loogu shubo (Auto-Import immediately upon file select)"
            >
              <Upload size={12} />
              <span className="hidden sm:inline">Auto Import</span>
              <input
                type="file"
                accept=".json,application/json"
                onChange={handleAutoImportJsonFile}
                className="hidden"
              />
            </label>

            {/* 4. Live Exchange Rate Quick Editor - Expanded & Widened */}
            <div 
              className="flex items-center gap-1.5 bg-gradient-to-r from-slate-100 to-blue-50/70 px-3 py-1.5 rounded-2xl border border-slate-300 shadow-xs shrink-0"
              title="Beddel Sarifka Doolarka iyo Birta ($1 = XX ETB)"
            >
              <span className="text-[11px] font-black text-slate-700 uppercase tracking-tight flex items-center gap-0.5">
                <span className="text-emerald-600 font-extrabold">$1</span>
                <span>=</span>
              </span>
              <input
                type="number"
                step="any"
                value={data.settings?.exchangeRate || 190}
                onChange={(e) => handleQuickRateChange(parseFloat(e.target.value) || 1)}
                className="w-20 sm:w-24 bg-white text-slate-950 text-xs sm:text-sm font-black font-mono rounded-xl px-2 py-1 outline-none border border-blue-300 focus:border-blue-600 focus:ring-2 focus:ring-blue-100 text-center shadow-inner transition-all"
                placeholder="Rate"
              />
              <span className="text-[10px] font-black text-blue-800 bg-blue-100/90 px-1.5 py-0.5 rounded-md">ETB</span>
            </div>

            {/* 🌟 5. Monthly Archive Hub Button (1-Click View History) - ADMIN & MANAGER ONLY */}
            {data.settings?.currentUser?.role !== UserRole.CASHIER && (
              <button
                onClick={() => setShowMonthlyArchiveHubModal(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider shadow-sm transition-all active:scale-95 cursor-pointer relative shrink-0"
                title="Kaydka Bilaha Hore (1-Click Monthly Archive Viewer - Admin & Manager)"
              >
                <FolderArchive size={12} />
                <span className="hidden sm:inline">Kaydka Bilaha</span>
                {(data.monthlyArchives || []).length > 0 && (
                  <span className="px-1.5 py-0.2 bg-indigo-900 text-indigo-100 rounded-full text-[8px] font-black ml-0.5">
                    {(data.monthlyArchives || []).length}
                  </span>
                )}
              </button>
            )}

            {/* 🌟 6. Monthly Close & Reset Button - ADMIN & MANAGER ONLY */}
            {data.settings?.currentUser?.role !== UserRole.CASHIER && (
              <button
                onClick={() => setShowMonthlyCloseModal(true)}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
                title="Xidh Bisha oo Ku Kaydi Kaydka Taariikhda, kadibna u bilow $0 (Close Month & Reset to $0 - Admin & Manager)"
              >
                <CalendarCheck size={12} />
                <span className="hidden sm:inline">Xidh Bisha ($0)</span>
              </button>
            )}

            {/* 🌟 7. Zero All Balances Button - ADMIN & MANAGER ONLY */}
            {data.settings?.currentUser?.role !== UserRole.CASHIER && (
              <button
                onClick={handleResetAllBalancesToZero}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
                title="Nadiifi dhammaan lacagaha oo ka dhig $0 (Reset All Money to $0 - Admin & Manager)"
              >
                <RefreshCw size={12} />
                <span className="hidden sm:inline">Ka dhig $0</span>
              </button>
            )}

            {/* 8. U Dir Xogta Admin & Manager (Instant Full Store Report Dispatch) */}
            <button
              onClick={() => setShowExecutiveReportModal(true)}
              className="flex items-center gap-1 px-2.5 py-1.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider shadow-sm transition-all active:scale-95 cursor-pointer shrink-0"
              title="U Dir Xogta & Warbixinta Tooska ah Admin-ka iyo Manager-ka (WhatsApp & Gmail)"
            >
              <Share2 size={12} />
              <span className="hidden md:inline">U Dir Admin & Manager</span>
              <span className="md:hidden">Warbixin</span>
            </button>

            {/* 9. Leave Full Screen (Strictly locked & disabled for CASHIER) */}
            <button
              onClick={handleToggleFullScreen}
              disabled={data.settings?.currentUser?.role === UserRole.CASHIER}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider transition-all shrink-0 ${
                data.settings?.currentUser?.role === UserRole.CASHIER
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed opacity-60'
                  : 'bg-slate-800 hover:bg-slate-700 text-white cursor-pointer active:scale-95'
              }`}
              title={
                data.settings?.currentUser?.role === UserRole.CASHIER
                  ? 'Cashier-ka looma ogola inuu taabto ama ka baxo Full Screen-ka (Locked)'
                  : isFullscreen
                  ? 'Ka bax Full Screen (Leave Full Screen)'
                  : 'Gal Full Screen'
              }
            >
              {isFullscreen ? <Minimize size={12} /> : <Maximize size={12} />}
              <span className="hidden sm:inline">{isFullscreen ? 'Leave Full Screen' : 'Full Screen'}</span>
            </button>

            {/* Live Firebase Cloud Indicator (Automatic real-time sync across all devices) */}
            <button 
              id="header-firebase-cloud-status-btn"
              type="button"
              onClick={handleManualSaveCloud}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-[9px] md:text-[10px] font-black uppercase tracking-wider shrink-0 transition-all border shadow-sm cursor-pointer select-none active:scale-95 ${
                cloudSyncStatus === 'syncing' 
                  ? 'bg-amber-50 text-amber-800 border-amber-300 animate-pulse ring-2 ring-amber-400/20' 
                  : cloudSyncStatus === 'error' 
                  ? 'bg-rose-50 text-rose-700 border-rose-200' 
                  : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
              }`}
              title="Firebase Online Cloud Live Sync. Guji si aad u xaqiijiso kaydinta."
            >
               {cloudSyncStatus === 'syncing' ? (
                 <RefreshCw size={12} className="animate-spin text-amber-600 shrink-0" />
               ) : cloudSyncStatus === 'error' ? (
                 <div className="w-2 h-2 rounded-full bg-rose-500 shrink-0" />
               ) : (
                 <Cloud size={13} className="text-emerald-600 shrink-0" />
               )}
               <span className="truncate hidden sm:inline">
                 {cloudSyncStatus === 'syncing' ? 'Kaydinaya...' : cloudSyncStatus === 'error' ? 'Offline' : 'Online Cloud'}
               </span>
               {cloudSyncStatus === 'success' && (
                 <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping shrink-0" />
               )}
            </button>

            {/* Quick Role Switcher Selector */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200 shrink-0">
              <ShieldCheck size={14} className={data.settings.currentUser.role === UserRole.ADMIN ? 'text-red-600 ml-0.5' : data.settings.currentUser.role === UserRole.MANAGER ? 'text-purple-600 ml-0.5' : 'text-emerald-600 ml-0.5'} />
              <select
                value={data.settings.currentUser.role}
                onChange={(e) => handleRequestRoleSwitch(e.target.value as UserRole)}
                className="bg-white text-slate-900 text-[9px] md:text-xs font-black rounded-lg px-1.5 py-1 outline-none cursor-pointer border-none shadow-sm uppercase tracking-tight"
                title="Beddel Role-ka (Switch Cashier / Admin / Manager)"
              >
                <option value={UserRole.ADMIN}>ADMIN</option>
                <option value={UserRole.CASHIER}>CASHIER</option>
                <option value={UserRole.MANAGER}>MANAGER</option>
              </select>
            </div>

            <div className="flex items-center gap-0.5 bg-slate-100 p-1 rounded-xl">
              <button onClick={() => handleCurrencyChange(Currency.USD)} className={`px-2 py-1 rounded-lg text-[9px] md:text-xs font-black transition-all ${globalCurrency === Currency.USD ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>USD ($)</button>
              <button onClick={() => handleCurrencyChange(Currency.ETB)} className={`px-2 py-1 rounded-lg text-[9px] md:text-xs font-black transition-all ${globalCurrency === Currency.ETB ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500'}`}>ETB</button>
            </div>
            
            <button 
              onClick={() => setShowCalculatorModal(true)}
              className="p-1.5 md:p-2 text-slate-500 hover:text-blue-600 relative no-print rounded-xl hover:bg-slate-100 transition-all flex items-center gap-1"
              title="Hisabiye (Calculator)"
            >
              <CalcIcon size={18} className="text-blue-600" />
            </button>

            <button 
              onClick={() => setShowAlertsModal(true)}
              className="p-1.5 md:p-2 text-slate-500 hover:text-blue-600 relative no-print rounded-xl hover:bg-slate-100 transition-all flex items-center gap-1"
              title="Digniinta Alaabta (Inventory Alerts)"
            >
              <Bell size={18} className={alertCounts.total > 0 ? 'text-rose-600' : ''} />
              {alertCounts.total > 0 && (
                <span className="px-1.5 py-0.5 bg-rose-600 text-white font-black text-[9px] rounded-full shadow-md animate-pulse">
                  {alertCounts.total}
                </span>
              )}
            </button>

            {allowedTabs.includes(AppTab.SETTINGS) && (
              <button 
                onClick={() => setActiveTab(AppTab.SETTINGS)}
                className={`p-1.5 md:p-2 text-slate-500 hover:text-blue-600 relative no-print rounded-xl hover:bg-slate-100 transition-all flex items-center gap-1 ${activeTab === AppTab.SETTINGS ? 'text-blue-600 bg-blue-50' : ''}`}
                title="Hagaajinta Nidaamka (Settings & Backups)"
              >
                <Settings size={18} className={activeTab === AppTab.SETTINGS ? 'text-blue-600' : 'text-slate-600'} />
              </button>
            )}
          </div>
        </header>

        {/* Active Archive Viewing Mode Banner */}
        {viewingArchive && (
          <div className="no-print bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 text-slate-950 px-4 py-2.5 shadow-md flex items-center justify-between sticky top-16 z-40 animate-in slide-in-from-top duration-200">
            <div className="flex items-center gap-2 text-xs font-black">
              <Archive size={18} className="text-slate-900 shrink-0" />
              <span>
                WAXAAD EEGEAYSAA KAYDKII BISHII HORE: <strong className="uppercase underline decoration-slate-900">{viewingArchive.monthName}</strong> ({viewingArchive.periodStartDate} ilaa {viewingArchive.periodEndDate})
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowMonthlyArchiveHubModal(true)}
                className="px-3 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-sm"
              >
                📄 Bayaanka & Faahfaahinta
              </button>
              <button
                onClick={() => setViewingArchive(null)}
                className="px-3 py-1 bg-white hover:bg-slate-100 text-slate-900 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-sm cursor-pointer"
              >
                ⚡ Ku Noqo Bisha Cusub ($0)
              </button>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-x-auto overflow-y-auto min-w-0 w-full max-w-full touch-scroll bg-slate-50 pb-20 lg:pb-6">
          {autoBackupNotice && (
            <div className="m-4 p-4 bg-emerald-500 text-white rounded-2xl shadow-lg flex items-center justify-between animate-in slide-in-from-top duration-300">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/20 rounded-xl">
                  <HardDrive size={20} />
                </div>
                <p className="font-bold text-sm">{autoBackupNotice}</p>
              </div>
              <button 
                onClick={() => setAutoBackupNotice(null)} 
                className="p-1 hover:bg-white/20 rounded-lg text-white font-black"
              >
                <X size={18} />
              </button>
            </div>
          )}
          {(() => {
            const commonProps = { 
              data: effectiveData, 
              setData, 
              addLog: addAuditLog, 
              currency: globalCurrency,
              setActiveTab,
              onLoadItemsToPOS: handleLoadItemsToPOS,
              cart: posCart,
              setCart: setPosCart,
              selectedCustomer: posCustomer,
              setSelectedCustomer: setPosCustomer
            };
            // Strict security check: If the activeTab is not permitted for the user's role, fallback to POS
            if (!allowedTabs.includes(activeTab)) {
              return <POS {...commonProps} />;
            }

            switch (activeTab) {
              case AppTab.DASHBOARD: 
                return (
                  <Dashboard 
                    data={effectiveData} 
                    currency={globalCurrency} 
                    setActiveTab={setActiveTab} 
                    onOpenAlerts={() => setShowAlertsModal(true)}
                    setData={setData}
                    addLog={addAuditLog}
                  />
                );
              case AppTab.XISAABIN: return <XisaabinTab data={effectiveData} setData={setData} currency={globalCurrency} />;
              case AppTab.OGAANSHO: return <OgaanshoTab data={effectiveData} currency={globalCurrency} setActiveTab={setActiveTab} />;
              case AppTab.ONLINE_ORDERS: return <OnlineOrders data={effectiveData} currency={globalCurrency} onUpdateOrders={handleUpdateOnlineOrders} />;
              case AppTab.ICE_CREAM: return <IceCreamShop {...commonProps} />;
              case AppTab.PRODUCTS: return <Products {...commonProps} />;
              case AppTab.ITEM_REPORTS: return <ItemReports data={effectiveData} currency={globalCurrency} />;
              case AppTab.POS: return <POS {...commonProps} />;
              case AppTab.ALL_TRANSACTIONS_SHOW: return <AllTransactionsShow {...commonProps} />;
              case AppTab.PURCHASES: return <Purchases {...commonProps} />;
              case AppTab.INVOICES: return <Invoices {...commonProps} />;
              case AppTab.CUSTOMERS: return <Customers {...commonProps} />;
              case AppTab.DEBTORS: return <DebtorsHub {...commonProps} />;
              case AppTab.SUPPLIERS: return <Suppliers {...commonProps} />;
              case AppTab.STOCK: return <StockAdjustments {...commonProps} />;
              case AppTab.FINANCES: return <Finances {...commonProps} />;
              case AppTab.ACCOUNTING: return <Accounting {...commonProps} />;
              case AppTab.DAILY_CLOSING: return <ZReport data={effectiveData} currency={globalCurrency} />;
              case AppTab.REPORTS: return <Reports {...commonProps} />;
              case AppTab.AI: 
                if (data.settings?.currentUser?.role !== UserRole.MANAGER) {
                  return <POS {...commonProps} />;
                }
                return <AIInsights data={effectiveData} />;
              case AppTab.ROLES: return <Roles data={effectiveData} setData={setData} addLog={addAuditLog} />;
              case AppTab.RECYCLE_BIN: return <RecycleBin {...commonProps} />;
              case AppTab.KHUDAAR: return <KhudaarManager {...commonProps} />;
              case AppTab.SETTINGS: return <SettingsView data={data} setData={setData} addLog={addAuditLog} />;
              default: 
                return allowedTabs.includes(AppTab.DASHBOARD) ? (
                  <Dashboard data={effectiveData} currency={globalCurrency} setActiveTab={setActiveTab} onOpenAlerts={() => setShowAlertsModal(true)} />
                ) : (
                  <POS {...commonProps} />
                );
            }
          })()}
        </div>

        {/* Global Inventory Alerts Modal */}
        <InventoryAlertsModal 
          isOpen={showAlertsModal}
          onClose={() => setShowAlertsModal(false)}
          data={data}
          setData={setData}
          currency={globalCurrency}
          onNavigateToProducts={() => setActiveTab(AppTab.PRODUCTS)}
        />

        <CalculatorModal
          isOpen={showCalculatorModal}
          onClose={() => setShowCalculatorModal(false)}
        />

        {/* Monthly Archive Hub Modal (1-Click View and Audit Previous Month Records) */}
        <MonthlyArchiveHubModal
          isOpen={showMonthlyArchiveHubModal}
          onClose={() => setShowMonthlyArchiveHubModal(false)}
          data={data}
          setData={setData}
          currency={globalCurrency}
          addLog={addAuditLog}
          onSelectArchiveForView={(archive) => {
            setViewingArchive(archive);
          }}
          activeArchiveView={viewingArchive}
          onOpenMonthlyCloseModal={() => {
            setShowMonthlyArchiveHubModal(false);
            setShowMonthlyCloseModal(true);
          }}
        />

        {/* Monthly Close & Zero Balance Modal */}
        <MonthlyCloseModal
          isOpen={showMonthlyCloseModal}
          onClose={() => setShowMonthlyCloseModal(false)}
          data={data}
          setData={setData}
          currency={globalCurrency}
          addLog={addAuditLog}
          onArchiveCreated={() => {
            setViewingArchive(null);
          }}
        />

        {/* Global WhatsApp Image Receipt & Statement Modal */}
        <WhatsAppImageModal 
          options={whatsAppModalOptions}
          onClose={() => setWhatsAppModalOptions(null)}
        />

        {/* Executive Report Modal (Full charts, tables, WhatsApp & Gmail automated report) */}
        <StoreExecutiveReportModal
          isOpen={showExecutiveReportModal}
          onClose={() => setShowExecutiveReportModal(false)}
          data={data}
          currency={globalCurrency}
        />

        {/* Role Password Protection Modal for Admin / Manager Switch */}
        <RolePasswordModal
          isOpen={!!pendingRoleSwitch}
          targetRole={pendingRoleSwitch || UserRole.ADMIN}
          settings={data.settings}
          onClose={() => setPendingRoleSwitch(null)}
          onSuccess={(role) => applyRoleSwitch(role)}
        />

        {/* Global Floating Quick AI Assistant (Exclusive for Manager, closed for Admin and Cashier) */}
        {data.settings?.currentUser?.role === UserRole.MANAGER && <QuickAI data={data} />}

        {/* Mobile Persistent Navigation */}
        <div className="lg:hidden no-print fixed bottom-0 w-full bg-white/90 backdrop-blur-2xl border-t h-16 flex items-center justify-around px-2 z-50">
           {mobileShortcuts.map(({ tab, icon: Icon }) => (
             <button 
              key={tab} 
              onClick={() => setActiveTab(tab)} 
              className={`flex flex-col items-center gap-1 p-2 transition-all active:scale-95 ${activeTab === tab ? 'text-blue-600' : 'text-slate-400'}`}
             >
               <Icon size={20} className={activeTab === tab ? 'stroke-[2.5px]' : ''} />
               <span className="text-[9px] font-black uppercase tracking-tighter">{tab === AppTab.DASHBOARD ? 'Home' : tab}</span>
             </button>
           ))}
           <button onClick={() => setSidebarOpen(true)} className="flex flex-col items-center gap-1 p-2 text-slate-400 active:scale-95">
             <Menu size={20} />
             <span className="text-[9px] font-black uppercase tracking-tighter">More</span>
           </button>
        </div>
      </main>
    </div>
  );
};

export default App;
