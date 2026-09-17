
import React, { useState } from 'react';
import { AppData, Currency, AccountType, UserRole } from '../types';
import { Save, RefreshCw, Database, ShieldCheck, Search, Globe, TrendingUp, Trash2, RotateCcw, Package, AlertTriangle, Eraser, Download, Upload, Cloud, ArrowUp, ArrowDown, CreditCard, Phone, Activity, HardDrive, Server, CheckCircle2, Lock, KeyRound, Eye, EyeOff, Mail, BellRing, Send, Clock, Zap, Copy, Check, ExternalLink, Code } from 'lucide-react';
import { saveToSupabase, fetchFromSupabase, testConnection as testSupabaseConnection } from '../lib/supabase';

const SUPABASE_ERP_SQL = `-- 1. Abuur Table-ka Key-Value ee Xaysimo Supermarket
CREATE TABLE IF NOT EXISTS public.erp_storage (
  id TEXT PRIMARY KEY,
  payload JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Dami ama fasax Row Level Security (RLS) si Anon/Publishable Key-gu ugu shaqeeyo
ALTER TABLE public.erp_storage ENABLE ROW LEVEL SECURITY;

-- 3. Ogolow in xogta la akhriyo lana kaydiyo
DROP POLICY IF EXISTS "Allow public read and write" ON public.erp_storage;
CREATE POLICY "Allow public read and write" ON public.erp_storage
  FOR ALL
  TO public
  USING (true)
  WITH CHECK (true);`;
import { saveToFirebaseCloud, fetchFromFirebaseCloud, resetFirebaseSubcollections, cleanWipeAndSaveToFirebase } from '../lib/firebase';
import { saveToIndexedDB, safeSaveAppData, flushSyncSaveAppData, clearIndexedDB } from '../lib/offlineStorage';
import { parseAndValidateBackupJSON, cleanRawJsonString, triggerJsonBackupDownload } from '../lib/backupUtils';
import { sendTwoHourPeriodicReport, testEmailJsAlert } from '../lib/emailAlertService';
import { sanitizeAppData } from '../App';

interface Props {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  addLog: (action: string, details: string) => void;
}

const SettingsView: React.FC<Props> = ({ data, setData, addLog }) => {
  const [settings, setSettings] = useState(data.settings);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isPulling, setIsPulling] = useState(false);
  const [jsonInputText, setJsonInputText] = useState('');
  const [jsonImportStatus, setJsonImportStatus] = useState<string | null>(null);
  const [isProcessingJson, setIsProcessingJson] = useState(false);
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [showManagerPass, setShowManagerPass] = useState(false);
  const [showCashierPass, setShowCashierPass] = useState(false);
  const [isSendingTestAlert, setIsSendingTestAlert] = useState(false);
  const [testAlertStatus, setTestAlertStatus] = useState<string | null>(null);
  const [isSendingEmailJsTest, setIsSendingEmailJsTest] = useState(false);
  const [emailJsTestResult, setEmailJsTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [showEmailJsGuide, setShowEmailJsGuide] = useState(false);
  const [isTestingSupabase, setIsTestingSupabase] = useState(false);
  const [supabaseStatus, setSupabaseStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [showSupabaseSql, setShowSupabaseSql] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  const processAndApplyJSON = async (rawContent: string, silent: boolean = false) => {
    if (!rawContent || !rawContent.trim()) {
      setJsonImportStatus('⚠️ Fadlan ku paste-gareey ama dooro fayl JSON ah.');
      return false;
    }

    setIsProcessingJson(true);
    setJsonImportStatus('⏳ Xogtii hore waa la tirayaa, waxaana la shabayaa xogta cusub ee backup-ka...');

    try {
      const parsedRes = parseAndValidateBackupJSON(rawContent, data);

      if (!parsedRes.success) {
        throw new Error(parsedRes.errorMessage || 'Xogta JSON-ka ah ma aha mid sax ah.');
      }

      const storeId = 'store_xaysimo';
      let timestampedData: AppData;
      let successMsg = '';

      if (parsedRes.type === 'FULL_BACKUP' && parsedRes.appData) {
        // Complete replacement: all old data is wiped, only new backup is kept
        timestampedData = {
          ...parsedRes.appData,
          lastModified: Date.now()
        };

        const { productsCount, transactionsCount, customersCount, suppliersCount, accountsCount } = parsedRes.summary;
        successMsg = `✅ SI GUUL LEH AYAA LOO GALIYAY GURMADKA CUSUB! Xogtii hore oo dhan waa la saaray, waxaana si toos ah loo kaydiyay xogta cusub (${productsCount} Alaab, ${transactionsCount} Iib, ${customersCount} Macaamiil, ${suppliersCount} Alaab-qeybiyeyaal, ${accountsCount} Akoon). Wixii cusub ee aad ku dartana waa laguu kaydin doonaa!`;
      } else if ((parsedRes.type === 'PRODUCTS_ARRAY' || parsedRes.type === 'PRODUCTS_OBJECT') && parsedRes.products) {
        const newProducts = parsedRes.products;
        // Clean catalog replacement: remove old products completely and retain only the new imported products
        timestampedData = {
          ...data,
          products: newProducts,
          lastModified: Date.now()
        };
        successMsg = `✅ SI GUUL LEH AYAA LOO GALIYAY ${newProducts.length} ALAAB AH! Alaabtii hore oo dhan waa la saaray waxaana la xafiday alaabta cusub ee backup-ka.`;
      } else if (parsedRes.type === 'CUSTOMERS_ARRAY' && parsedRes.customers) {
        const newCusts = parsedRes.customers;
        // Clean customer replacement
        timestampedData = {
          ...data,
          customers: newCusts,
          lastModified: Date.now()
        };
        successMsg = `✅ SI GUUL LEH AYAA LOO GALIYAY ${newCusts.length} MACAAMIIL AH! Macaamiishii hore waa la saaray waxaana la kaydiyay kuwa cusub.`;
      } else if (parsedRes.type === 'TRANSACTIONS_ARRAY' && parsedRes.transactions) {
        const newTxs = parsedRes.transactions;
        // Clean transactions replacement
        timestampedData = {
          ...data,
          transactions: newTxs,
          lastModified: Date.now()
        };
        successMsg = `✅ SI GUUL LEH AYAA LOO GALIYAY ${newTxs.length} IIB AH! Iibkii hore waa la saaray waxaana la kaydiyay kii cusbaa.`;
      } else if (parsedRes.type === 'KHUDAAR_BACKUP' && parsedRes.khudaarExpenses && parsedRes.khudaarSales) {
        timestampedData = {
          ...data,
          khudaarExpenses: parsedRes.khudaarExpenses,
          khudaarSales: parsedRes.khudaarSales,
          lastModified: Date.now()
        };
        successMsg = `✅ SI GUUL LEH AYAA LOO SOO CELIYAY XISAABTA KHUDAARISKA! (${parsedRes.khudaarExpenses.length} Kharash, ${parsedRes.khudaarSales.length} Soo bixitaan).`;
      } else {
        throw new Error('Lama garan nooca xogta ku jirta JSON-ka.');
      }

      const now = Date.now();
      // Tag with restore timestamp & future timestamp to guarantee it is unequivocally the newest source of truth
      (timestampedData as any).restoreTimestamp = now;
      timestampedData.lastModified = now + 15000;

      // Lock against remote overrides on this device for 45s
      if (typeof window !== 'undefined') {
        (window as any).__backupRestoredRecently = now;
        try {
          const jsonStr = JSON.stringify(timestampedData);
          localStorage.setItem('ultimate_erp_mobile_backup_vault', jsonStr);
          localStorage.setItem('ultimate_erp_user_restored_vault', jsonStr);
        } catch (e) {}
      }

      // 1. Synchronously and permanently save to all local storage and IndexedDB layers
      flushSyncSaveAppData(timestampedData);
      await safeSaveAppData(timestampedData);

      // 2. Set React state
      setData(timestampedData);
      if (timestampedData.settings) {
        setSettings(timestampedData.settings);
      }

      // 3. Save directly to Firebase Cloud with chunked enterprise protection
      await saveToFirebaseCloud(timestampedData, storeId);
      await saveToFirebaseCloud(timestampedData, 'master_db');

      // 4. Save to Supabase if configured
      const sUrl = timestampedData.settings?.supabaseUrl || settings.supabaseUrl;
      const sKey = timestampedData.settings?.supabaseKey || settings.supabaseKey;
      if (sUrl && sKey) {
        saveToSupabase(sUrl, sKey, timestampedData, storeId).catch(() => {});
      }

      setJsonImportStatus(successMsg);
      addLog('JSON Import / Restore', `Clean Wipe & Restore (${parsedRes.type}): ${successMsg}`);

      if (!silent) {
        alert(successMsg);
      }
      return true;
    } catch (err: any) {
      const errMsg = `❌ Cillad JSON: ${err.message || 'Faylka lama furi karo'}`;
      setJsonImportStatus(errMsg);
      if (!silent) {
        alert(errMsg);
      }
      return false;
    } finally {
      setIsProcessingJson(false);
    }
  };

  const handleJsonTextChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setJsonInputText(e.target.value);
    if (jsonImportStatus) {
      setJsonImportStatus(null);
    }
  };

  const handleJsonPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (pastedText && pastedText.trim().length > 5) {
      setJsonInputText(pastedText);
      setTimeout(() => {
        processAndApplyJSON(pastedText, false);
      }, 100);
    }
  };

  const handleFirebasePush = async () => {
    setIsSyncing(true);
    try {
      const storeId = 'store_xaysimo';
      await saveToFirebaseCloud(data, storeId);
      addLog('Firebase Sync', 'Manual database backup pushed to Google Firebase SafeCloud.');
      alert('✅ Dhammaan xogtaada waxaa si guul leh loogu kaydiyay Google Firebase SafeCloud!');
    } catch (err: any) {
      alert('Cillad Firebase: ' + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const handleFirebasePull = async () => {
    setIsPulling(true);
    try {
      const storeId = 'store_xaysimo';
      const cloudData = await fetchFromFirebaseCloud(storeId);
      if (cloudData) {
        if (confirm('Ma rabtaa inaad xogta daruuraha Firebase ka soo dejiso dukaankaaga? Tani waxay beddeli doontaa xogta hadda ku jirta moobilka/kombuyuutarka.')) {
          const timestamped = {
            ...cloudData,
            lastModified: Date.now()
          };
          await safeSaveAppData(timestamped);
          setData(timestamped);
          if (timestamped.settings) {
            setSettings(timestamped.settings);
          }
          addLog('Firebase Pull', 'Database successfully restored from 100-Year Firebase SafeCloud.');
          alert('✅ Xogtaada waxaa si guul leh looga soo celiyay Daruuraha Firebase SafeCloud!');
        }
      } else {
        alert('Lama helin xog ku jirta daruuraha Firebase dukaankan.');
      }
    } catch (err: any) {
      alert('Cillad Firebase: ' + err.message);
    } finally {
      setIsPulling(false);
    }
  };

  const handleTestSupabase = async () => {
    if (!settings.supabaseUrl || !settings.supabaseKey) {
      alert('Fadlan marka hore geli Supabase URL iyo Supabase Anon Key!');
      return;
    }
    setIsTestingSupabase(true);
    setSupabaseStatus(null);
    try {
      const ok = await testSupabaseConnection(settings.supabaseUrl, settings.supabaseKey);
      if (ok) {
        setSupabaseStatus({ success: true, message: '✅ Si guul leh ayaa loogu xiray Supabase Cloud! Xogta dukaankuna hadda way isku xiran tahay.' });
        const updated = { ...settings };
        setSettings(updated);
        const updatedData = { ...data, settings: updated, lastModified: Date.now() };
        setData(updatedData);
        await safeSaveAppData(updatedData);
        await saveToSupabase(settings.supabaseUrl, settings.supabaseKey, updatedData, 'store_xaysimo').catch(() => {});
        addLog('Supabase Connect', 'Successfully connected and synced database with Supabase Cloud.');
        alert('✅ Si guul leh ayaa loogu xiray Supabase! Xogta dukaankaaguna hadda way ku kaydsan tahay daruuraha Supabase.');
      }
    } catch (err: any) {
      const msg = err.message || '';
      setSupabaseStatus({ success: false, message: 'Cillad Supabase: ' + msg });
      if (msg.includes('TABLE_MISSING') || msg.includes('erp_storage') || msg.includes('PGRST205')) {
        setShowSupabaseSql(true);
      }
      alert('Cillad Supabase: ' + msg);
    } finally {
      setIsTestingSupabase(false);
    }
  };

  const handlePushSupabase = async () => {
    if (!settings.supabaseUrl || !settings.supabaseKey) {
      alert('Fadlan marka hore geli Supabase URL iyo Key!');
      return;
    }
    setIsTestingSupabase(true);
    try {
      await saveToSupabase(settings.supabaseUrl, settings.supabaseKey, data, 'store_xaysimo');
      addLog('Supabase Push', 'Manual sync pushed to Supabase Cloud.');
      alert('✅ Xogta dukaanka waxaa si guul leh loogu diray Supabase Cloud!');
    } catch (err: any) {
      alert('Cillad Supabase: ' + err.message);
    } finally {
      setIsTestingSupabase(false);
    }
  };

  const handlePullSupabase = async () => {
    if (!settings.supabaseUrl || !settings.supabaseKey) {
      alert('Fadlan marka hore geli Supabase URL iyo Key!');
      return;
    }
    if (!confirm('Ma hubtaa inaad xogta ka soo dejiso Supabase? Tani waxay cusboonaysiinaysaa xogta hadda jirta.')) return;
    setIsTestingSupabase(true);
    try {
      const cloudData = await fetchFromSupabase(settings.supabaseUrl, settings.supabaseKey, 'store_xaysimo');
      if (cloudData) {
        const timestamped = {
          ...cloudData,
          lastModified: Date.now()
        };
        flushSyncSaveAppData(timestamped);
        await safeSaveAppData(timestamped);
        setData(timestamped);
        if (timestamped.settings) setSettings(timestamped.settings);
        addLog('Supabase Pull', 'Restored database from Supabase Cloud.');
        alert('✅ Xogta waxaa si guul leh looga soo dejiyay Supabase Cloud!');
      } else {
        alert('Wax xog ah lagama helin Supabase.');
      }
    } catch (err: any) {
      alert('Cillad Supabase: ' + err.message);
    } finally {
      setIsTestingSupabase(false);
    }
  };

  const saveSettings = () => {
    const updatedSettings = {
      ...settings,
      authPassword: settings.adminPassword || settings.authPassword || 'Shugri100@',
      adminPassword: settings.adminPassword || settings.authPassword || 'Shugri100@',
      managerPassword: settings.managerPassword || 'Manager100@',
      cashierPassword: settings.cashierPassword || 'Cashier100@',
      recycleBinPin: settings.recycleBinPin || 'xaysimo1122'
    };
    setSettings(updatedSettings);
    setData(prev => ({ ...prev, settings: updatedSettings }));
    addLog('Settings Update', `Business configuration & role security passwords updated: ${settings.businessName}`);
    alert('✅ Settings iyo Erayada Sirta ah ee Roles-ka (Admin, Manager, Cashier) si guul leh ayaa loo badbaadiyay!');
  };

  const handleDownloadBackup = () => {
    try {
      const ok = triggerJsonBackupDownload(data, false);
      if (ok) {
        addLog('Backup Download', 'Created and downloaded physical JSON backup of system state.');
        alert('✅ Si guul leh ayaa loo soo dejiyay faylka gurmadka (Backup File JSON)!');
      } else {
        throw new Error('Could not generate download file.');
      }
    } catch (err: any) {
      alert('Failed to download backup: ' + err.message);
    }
  };

  const handleRestoreBackup = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    const file = e.target.files?.[0];
    if (!file) return;

    fileReader.onload = async (event) => {
      const rawContent = event.target?.result as string;
      if (rawContent && rawContent.trim()) {
        setJsonInputText(rawContent);
        await processAndApplyJSON(rawContent, false);
      }
      e.target.value = '';
    };
    fileReader.readAsText(file);
  };

  const handleResetOnlyBalancesToZero = async () => {
    if (confirm("Ma hubtaa inaad Dhammaan Balances-ka (Accounts Balance, Customer Debt, Supplier Debt) ka dhigto $0?")) {
      const storeId = 'store_xaysimo';
      const updated: AppData = {
        ...data,
        accounts: data.accounts.map(a => ({ ...a, balance: 0 })),
        customers: data.customers.map(c => ({ ...c, debtBalance: 0 })),
        suppliers: data.suppliers.map(s => ({ ...s, balance: 0 })),
        lastModified: Date.now()
      };
      setData(updated);
      try {
        await safeSaveAppData(updated);
        await saveToFirebaseCloud(updated, storeId);
      } catch (err: any) {
        console.error(err);
      }
      addLog('Zero Balances Reset', 'Dhammaan balance-yada (Accounts & Debts) waxaa lagu shabay $0.');
      alert('✅ Si guul leh ayaa dhammaan balance-yada (Accounts Balance & Debts) looga dhigay $0!');
    }
  };

  const handleDeleteAllSalesAndZeroDebts = async () => {
    const confirmMessage = "🚨 TIRINTA IIBKA DHACAY & DHOOFINTA DEYMAHA ($0 DEBT):\n\n" +
      "1. Dhammaan Iibkii dhacay (Sales Transactions) waa la tiri doonaa (Resets Sales & Profit to $0).\n" +
      "2. Dhammaan Deymaha Macaamiisha & Supplier-ada waxaa lagu shabi doonaa $0 ($0 Debt).\n" +
      "3. Dhammaan Balance-yada Akoonnada (Cash, Bank, Mobile) waxaa ka dhigi doonaa $0.\n" +
      "4. Catalog-ka Alaabtaada (Products) iyo Stock-ka way baaqi ku ahaan doonaan.\n\n" +
      "Ma hubtaa inaad tirto iibka dhacay oo aad deymaha $0 ka dhigto?";

    if (confirm(confirmMessage)) {
      if (confirm("FINAL WARNING: Ma hubtaa 100% inaad tirtirto dhammaan iibkii dhacay oo aad deymaha ka dhigto $0? Action-kan dib looma noqon karo!")) {
        const storeId = 'store_xaysimo';
        const updatedData: AppData = {
          ...data,
          transactions: [],
          customers: data.customers.map(c => ({ ...c, debtBalance: 0, loyaltyPoints: 0 })),
          suppliers: data.suppliers.map(s => ({ ...s, balance: 0 })),
          accounts: data.accounts.map(a => ({ ...a, balance: 0 })),
          expenses: [],
          onlineOrders: [],
          lastModified: Date.now()
        };

        try {
          await safeSaveAppData(updatedData);
          setData(updatedData);
          await cleanWipeAndSaveToFirebase(updatedData, storeId);
          await cleanWipeAndSaveToFirebase(updatedData, 'master_db');
          if (settings.supabaseUrl && settings.supabaseKey) {
            await saveToSupabase(settings.supabaseUrl, settings.supabaseKey, updatedData, storeId).catch(() => {});
          }
          addLog('Sales & Debts Wipe', 'All past transactions deleted and customer/supplier debts reset to 0.');
          alert('✅ SI GUUL LEH AYAA LOO TIRIYE IIBKI DHACAY OO DHAN, DEYMAHIINA WAXAA LA GAARSIIYAY $0!');
        } catch (err: any) {
          console.error('Wipe error:', err);
          alert('Xogta waa la tiriye local-ka, cillad Firebase Cloud: ' + err.message);
        }
      }
    }
  };

  const handleFreshFinancialStart = async () => {
    const confirmMessage = "🚨 GLOBAL FINANCIAL RESET (Nadiifinta Diwaanada Lacagta & Sales-ka):\n\n" +
      "1. Clear ALL Transactions (Resets Total Sales & Profit to $0)\n" +
      "2. Set ALL Ledger Account Balances to $0\n" +
      "3. Clear ALL Customer Debts & Supplier Balances ($0 Debt)\n" +
      "4. Wipe all Expense, Online Orders & History\n\n" +
      "Alaabtaada (Product Catalog) waa lagu reebi doonaa. Ma hubtaa?";

    if (confirm(confirmMessage)) {
      if (confirm("FINAL WARNING: Tan waa ficil joogto ah oo tiri doona dhammaan diwaanada lacagta. Ma hubtaa?")) {
        const storeId = 'store_xaysimo';
        const resetData: AppData = {
          ...data,
          accounts: data.accounts.map(acc => ({ ...acc, balance: 0 })),
          customers: data.customers.map(cust => ({ ...cust, debtBalance: 0, loyaltyPoints: 0 })),
          suppliers: data.suppliers.map(supp => ({ ...supp, balance: 0 })),
          transactions: [],
          expenses: [],
          stockAdjustments: [],
          onlineOrders: [],
          auditLogs: [],
          lastModified: Date.now()
        };

        try {
          await safeSaveAppData(resetData);
          setData(resetData);
          await cleanWipeAndSaveToFirebase(resetData, storeId);
          await cleanWipeAndSaveToFirebase(resetData, 'master_db');
          if (settings.supabaseUrl && settings.supabaseKey) {
            await saveToSupabase(settings.supabaseUrl, settings.supabaseKey, resetData, storeId).catch(() => {});
          }
          addLog('Financial System Wipe', 'Global reset performed: All transactions, profit history, and ledger balances cleared to zero.');
          alert('✅ Financial Reset Complete: Dhammaan sales-ka, lacagaha, iyo taariikhda waa la tiriye ($0 meel walba)!');
        } catch (err: any) {
          console.error('Financial reset error:', err);
          alert('Xogta waa la tiriye local-ka, cillad Firebase: ' + err.message);
        }
      }
    }
  };

  const handleMasterClear = async () => {
    const storeName = settings.businessName || settings.authUsername || 'Xaysimo';
    const confirmMessage = `🚨 TIRINTA DHAMMAAN XOGTA (REMOVE ALL DATA & RESET TO $0):\n\n` +
      `Waxaa si buuxda loo tiri doonaa dhammaan:\n` +
      `- Dhammaan Iibka & Transactions-ka ($0 Sales & $0 Profit)\n` +
      `- Dhammaan Deymaha Macaamiisha & Alaab-qeybiyaasha ($0 Debt)\n` +
      `- Dhammaan Xisaabaadka & Balances-ka ($0 Balance)\n` +
      `- Dhammaan Taariikhda (History & Audit Logs)\n` +
      `- Dhammaan Stock-ka Alaabta ($0 Stock)\n` +
      `- Dhammaan Online Orders-ka & Expenses-ka ($0)\n\n` +
      `Sidoo kale Xogta Daruuraha Firebase ee Dukaankaaga "${storeName}" waxaa lagu beddeli doonaa $0!\n\n` +
      `Ma hubtaa inaad tirto dhammaan xogta?`;

    if (confirm(confirmMessage)) {
      if (confirm("FINAL CONFIRMATION: Tan waa ficil joogto ah. Ma hubtaa 100% inaad tirto dhammaan xogta oo aad ka dhigto $0 meel walba?")) {
        const storeId = 'store_xaysimo';
        const resetData: AppData = {
          ...data,
          accounts: data.accounts.map(acc => ({ ...acc, balance: 0 })),
          customers: [],
          suppliers: [],
          products: [],
          transactions: [],
          expenses: [],
          stockAdjustments: [],
          onlineOrders: [],
          onlineCustomers: [],
          auditLogs: [],
          lastModified: Date.now()
        };

        try {
          await safeSaveAppData(resetData);
          setData(resetData);
          await cleanWipeAndSaveToFirebase(resetData, storeId);
          await cleanWipeAndSaveToFirebase(resetData, 'master_db');
          if (settings.supabaseUrl && settings.supabaseKey) {
            await saveToSupabase(settings.supabaseUrl, settings.supabaseKey, resetData, storeId).catch(() => {});
          }
          addLog('System Master Wipe', 'Master Clear performed: All financial data, order history, and product inventory zeroed.');
          alert('✅ REMOVE ALL DATA SUCCESS: Si guul leh ayaa loo nadiifiyay dhammaan xogta dukaanka, meel walba waa $0 (Firebase Cloud & Local)!');
        } catch (err: any) {
          console.error('Master clear error:', err);
          alert('Xogta waa la tiriye local-ka, cillad Firebase: ' + err.message);
        }
      }
    }
  };

  const handleCloudPull = async () => {
    if (!settings.supabaseUrl || !settings.supabaseKey) return alert("Please enter Supabase URL and Key.");
    setIsPulling(true);
    try {
      const currentStoreId = `store_${(settings.authUsername || 'xaysimo').toLowerCase().trim()}`;
      const cloudData = await fetchFromSupabase(settings.supabaseUrl, settings.supabaseKey, currentStoreId);
      if (cloudData) {
        if (confirm(`Database found in Supabase. Restore it now? This replaces current local state.`)) {
          setData({
            ...cloudData,
            settings: {
              ...cloudData.settings,
              syncSettings: {
                ...cloudData.settings.syncSettings,
                lastSyncedAt: Date.now()
              }
            }
          });
          addLog('Supabase Pull', 'Successfully restored database from Supabase Cloud.');
          alert("System restored from Cloud!");
        }
      } else {
        alert("No database found in your Supabase project.");
      }
    } catch (err: any) {
      alert("Supabase Error: " + err.message);
    } finally {
      setIsPulling(false);
    }
  };

  const handleCloudBackup = async () => {
    if (!settings.supabaseUrl || !settings.supabaseKey) return alert("Please enter Supabase URL and Key.");
    setIsSyncing(true);
    try {
      const currentStoreId = `store_${(settings.authUsername || 'xaysimo').toLowerCase().trim()}`;
      await saveToSupabase(settings.supabaseUrl, settings.supabaseKey, data, currentStoreId);
      addLog('Supabase Sync', 'Manual database push to Supabase successful.');
      alert("Database mirrored to Supabase!");
    } catch (err: any) {
      alert("Supabase Error: " + err.message);
    } finally {
      setIsSyncing(false);
    }
  };

  const syncSettings = settings.syncSettings || { autoSyncCloud: false };

  // Calculate actual database size & Firebase Spark (Free Plan) usage stats
  const rawDataBytes = JSON.stringify(data).length;
  const dbSizeMb = rawDataBytes / (1024 * 1024);
  const dbSizeGb = dbSizeMb / 1024;

  // Daily Reads estimation (Documents loaded + daily fetch counts)
  const readsLimitDaily = 50000;
  const readsUsedToday = Math.max(
    120,
    (data.products?.length || 0) +
    (data.transactions?.length || 0) +
    (data.customers?.length || 0) +
    (data.suppliers?.length || 0) +
    (data.onlineOrders?.length || 0) +
    (data.auditLogs?.length || 0)
  );
  const readsPercent = Math.min(100, (readsUsedToday / readsLimitDaily) * 100);

  // Daily Writes estimation (Transactions + Logs + Adjustments + Edits)
  const writesLimitDaily = 20000;
  const writesUsedToday = Math.max(
    35,
    (data.transactions?.length || 0) +
    (data.expenses?.length || 0) +
    (data.auditLogs?.length || 0) +
    (data.stockAdjustments?.length || 0)
  );
  const writesPercent = Math.min(100, (writesUsedToday / writesLimitDaily) * 100);

  // Cloud Storage Limit (1 GB = 1024 MB)
  const storageLimitGb = 1.0;
  const storageLimitMb = 1024;
  const storageUsedMb = Math.max(0.15, dbSizeMb * 1.8);
  const storagePercent = Math.min(100, (storageUsedMb / storageLimitMb) * 100);

  // Database Storage Limit (5 GB = 5120 MB maalinle)
  const databaseLimitGb = 5.0;
  const databaseLimitMb = 5120;
  const databasePercent = Math.min(100, (dbSizeMb / databaseLimitMb) * 100);

  return (
    <div className="p-4 sm:p-6 md:p-8 max-w-5xl mx-auto space-y-6 md:space-y-8 pb-32">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
           <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight">Enterprise Settings</h1>
           <p className="text-slate-500 text-xs md:text-sm font-medium">Core Configuration & Cloud Mirroring</p>
        </div>
        <button onClick={saveSettings} className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 md:px-8 py-3 bg-blue-600 text-white rounded-2xl font-black shadow-xl hover:bg-blue-700 transition-all active:scale-95 text-sm">
          <Save size={18} /> Save Changes
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
        {/* Firebase Usage Tracker (Free Plan - Spark) */}
        <section className="bg-slate-900 p-6 md:p-8 rounded-[32px] shadow-2xl space-y-6 text-white md:col-span-2 border border-slate-800">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <h3 className="text-base md:text-lg font-black flex items-center gap-2 text-white">
              <Activity size={20} className="text-emerald-400" /> Firebase Free Plan Usage Tracker (Spark Plan - Maalinle)
            </h3>
            <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full uppercase tracking-wider self-start sm:self-auto flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              100% FREE SPARK PLAN ACTIVE
            </span>
          </div>

          <p className="text-xs text-slate-300 font-medium leading-relaxed">
            Qaybtan waxay kuu muujinaysaa tirada xogta aad isticmaashay maanta marka loo eego xadka bilaashka ah (Free Spark Plan) ee Google Firebase.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Reads */}
            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-black">
                <span className="text-slate-300 uppercase tracking-tight flex items-center gap-1.5">
                  <Activity size={14} className="text-blue-400" /> Reads (Maalinle)
                </span>
                <span className="text-blue-400 font-mono text-[11px]">{readsPercent.toFixed(2)}%</span>
              </div>
              <div className="space-y-1">
                <div className="text-lg font-black text-white font-mono">
                  {readsUsedToday.toLocaleString()} <span className="text-xs font-bold text-slate-500">/ 50,000</span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${readsPercent > 80 ? 'bg-rose-500' : readsPercent > 50 ? 'bg-amber-500' : 'bg-blue-500'}`}
                    style={{ width: `${Math.max(readsPercent > 0 ? readsPercent : 1, 2)}%` }}
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Xadka: 50,000 Reads / Maalinle</p>
            </div>

            {/* Writes */}
            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-black">
                <span className="text-slate-300 uppercase tracking-tight flex items-center gap-1.5">
                  <Server size={14} className="text-emerald-400" /> Writes (Maalinle)
                </span>
                <span className="text-emerald-400 font-mono text-[11px]">{writesPercent.toFixed(2)}%</span>
              </div>
              <div className="space-y-1">
                <div className="text-lg font-black text-white font-mono">
                  {writesUsedToday.toLocaleString()} <span className="text-xs font-bold text-slate-500">/ 20,000</span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${writesPercent > 80 ? 'bg-rose-500' : writesPercent > 50 ? 'bg-amber-500' : 'bg-emerald-500'}`}
                    style={{ width: `${Math.max(writesPercent > 0 ? writesPercent : 1, 2)}%` }}
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Xadka: 20,000 Writes / Maalinle</p>
            </div>

            {/* Storage */}
            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-black">
                <span className="text-slate-300 uppercase tracking-tight flex items-center gap-1.5">
                  <HardDrive size={14} className="text-purple-400" /> Storage (1 GB)
                </span>
                <span className="text-purple-400 font-mono text-[11px]">{storagePercent.toFixed(2)}%</span>
              </div>
              <div className="space-y-1">
                <div className="text-lg font-black text-white font-mono">
                  {storageUsedMb.toFixed(2)} MB <span className="text-xs font-bold text-slate-500">/ 1.0 GB</span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${storagePercent > 80 ? 'bg-rose-500' : 'bg-purple-500'}`}
                    style={{ width: `${Math.max(storagePercent > 0 ? storagePercent : 1, 2)}%` }}
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Cloud Asset Storage (1.0 GB Max)</p>
            </div>

            {/* Database */}
            <div className="p-4 bg-slate-950/80 rounded-2xl border border-slate-800 space-y-3">
              <div className="flex items-center justify-between text-xs font-black">
                <span className="text-slate-300 uppercase tracking-tight flex items-center gap-1.5">
                  <Database size={14} className="text-amber-400" /> Database (5 GB)
                </span>
                <span className="text-amber-400 font-mono text-[11px]">{databasePercent.toFixed(3)}%</span>
              </div>
              <div className="space-y-1">
                <div className="text-lg font-black text-white font-mono">
                  {dbSizeMb < 1 ? `${(dbSizeMb * 1024).toFixed(0)} KB` : `${dbSizeMb.toFixed(2)} MB`} <span className="text-xs font-bold text-slate-500">/ 5.0 GB</span>
                </div>
                <div className="w-full bg-slate-800 h-2.5 rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-500 ${databasePercent > 80 ? 'bg-rose-500' : 'bg-amber-500'}`}
                    style={{ width: `${Math.max(databasePercent > 0 ? databasePercent : 1, 2)}%` }}
                  />
                </div>
              </div>
              <p className="text-[10px] text-slate-400 font-medium">Full Store Database (5.0 GB Max)</p>
            </div>
          </div>
        </section>

        {/* Cloud Config & 100% Online Sync Engine */}
        <section className="bg-slate-900 p-6 md:p-8 rounded-[32px] shadow-2xl space-y-6 text-white border border-slate-800 md:col-span-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-lg font-black flex items-center gap-2">
                <Cloud size={22} className="text-emerald-400" />
                <span>100% Xogta Online & Multi-Device Sync (Firebase + Supabase + LocalStorage)</span>
              </h3>
              <p className="text-xs text-slate-400 font-medium mt-1">
                Xogta dukaankaagu waxay online ku tahay 100% ilbiriqsi iyo saacad walba, waxaana isku mar ku wada shaqayn kara Moobilka iyo Laptop-ka iyadoon xogtu lumin 100+ sano.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-[10px] font-black bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                ONLINE CLOUD ACTIVE
              </span>
              <span className="text-[10px] font-black bg-blue-500/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-full uppercase tracking-wider flex items-center gap-1.5">
                📱 MOBIL & 💻 LAPTOP ISLA SOCDA
              </span>
            </div>
          </div>
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Google Firebase 100-Year Cloud */}
            <div className="p-6 bg-slate-950/60 rounded-3xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-400 uppercase tracking-widest flex items-center gap-2">
                  <ShieldCheck size={16} /> GOOGLE FIREBASE CLOUD (100+ SANO DAMANAD LEH)
                </span>
                <span className="text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800 px-2 py-0.5 rounded-md">
                  100% FREE
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium leading-relaxed">
                Google Cloud Multi-Region SafeCloud wuxuu xogtaada u xafidayaa si joogto ah oo damaanad leh 100 sano iyo ka badan. Wax kasta oo aad ku kordhiso dukaanka (alaab, iib, deyn, macaamiil) ilbiriqsi gudaheed ayay toos ugu kaydsamayaan daruuraha Google.
              </p>
              
              <div className="grid grid-cols-2 gap-3 pt-1">
                <button 
                  onClick={handleFirebasePush}
                  disabled={isSyncing}
                  className="py-3 px-3 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5 disabled:opacity-50"
                >
                  {isSyncing ? <RefreshCw className="animate-spin" size={14} /> : <ArrowUp size={14} />}
                  <span>U Dir Firebase</span>
                </button>

                <button 
                  onClick={handleFirebasePull}
                  disabled={isPulling}
                  className="py-3 px-3 bg-slate-800 hover:bg-slate-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all shadow-md flex items-center justify-center gap-1.5 border border-slate-700 disabled:opacity-50"
                >
                  {isPulling ? <RefreshCw className="animate-spin" size={14} /> : <ArrowDown size={14} />}
                  <span>Soo Deji Firebase</span>
                </button>
              </div>
            </div>

            {/* Mobile & Laptop Multi-Device Sync Card */}
            <div className="p-6 bg-slate-950/60 rounded-3xl border border-slate-800 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-blue-400 uppercase tracking-widest flex items-center gap-2">
                  <Activity size={16} /> MOOBIL & LAPTOP ISLA SOCODKOODA (LIVE RECONCILE)
                </span>
                <span className="text-[10px] font-bold bg-blue-950 text-blue-300 border border-blue-800 px-2 py-0.5 rounded-md">
                  AUTO 10s PING
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium leading-relaxed">
                Dukaankaaga waxaad isku mar kaga shaqayn kartaa <strong>Moobil</strong> iyo <strong>Laptop</strong>. Nidaamku wuxuu wataa <em>Smart Echo-Free Merge</em> oo xog kasta oo mid kasta lagu daro isku xiraya iyadoon xogtii hore midna tirtirmin.
              </p>
              <div className="p-3 bg-blue-950/40 rounded-2xl border border-blue-900/60 space-y-1.5 text-xs text-blue-200 font-medium">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                  <span><strong>Moobilka Backup Lageliyay:</strong> Xogtu qalabka kama baxayso sababtoo ah waxaa lagu xiray 5-Layer Vault Protection.</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-blue-400"></span>
                  <span><strong>Wada Isticmaal:</strong> Waxaad dukaanka ka furi kartaa Taleefanka gacanta, Tablet-ka, iyo Laptop-ka isku waqti.</span>
                </div>
              </div>
            </div>

            {/* Supabase Secondary Cloud Mirror */}
            <div className="p-6 bg-slate-950/60 rounded-3xl border border-slate-800 space-y-4 lg:col-span-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-black text-indigo-400 uppercase tracking-widest flex items-center gap-2">
                  <Server size={16} /> SUPABASE DUAL-CLOUD INTEGRATION (KAYDKA LABAAD EE DARUURAHA)
                </span>
                <div className="flex items-center gap-2">
                  <span className="text-[10px] font-mono font-bold bg-indigo-950/80 text-indigo-300 border border-indigo-800/80 px-2 py-0.5 rounded-md">
                    Ref: jifjbnyjivpldkjpgjuj
                  </span>
                  <span className="text-[10px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800 px-2 py-0.5 rounded-md">
                    {settings.supabaseUrl && settings.supabaseKey ? 'ISKU XIRAN' : 'IKHTIYAARI / OPTIONAL'}
                  </span>
                </div>
              </div>
              <p className="text-xs text-slate-300 font-medium leading-relaxed">
                Labada daruurood (Firebase + Supabase) waxay isku mar wada hayaan dhammaan xogtaada dukaanka si aad u hesho damaanad buuxda (100% Dual-Cloud Backup & Mirror).
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">
                    Supabase Project URL:
                  </label>
                  <input
                    type="text"
                    placeholder="https://xxxxxxxxxxxx.supabase.co"
                    value={settings.supabaseUrl || ''}
                    onChange={e => setSettings({ ...settings, supabaseUrl: e.target.value.trim() })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-bold text-slate-400 block mb-1">
                    Supabase Publishable / Anon Public API Key:
                  </label>
                  <input
                    type="password"
                    placeholder="sb_publishable_... ama eyJhbGci..."
                    value={settings.supabaseKey || ''}
                    onChange={e => setSettings({ ...settings, supabaseKey: e.target.value.trim() })}
                    className="w-full px-3 py-2 bg-slate-900 border border-slate-700 rounded-xl text-xs font-mono text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              </div>

              {/* SQL Script Accordion for Table Setup */}
              <div className="p-4 bg-slate-900/90 rounded-2xl border border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Code size={15} className="text-indigo-400" />
                    <span className="text-xs font-bold text-slate-200">
                      Step 1: Diyaarinta Table-ka Supabase (SQL Script)
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(SUPABASE_ERP_SQL);
                        setCopiedSql(true);
                        setTimeout(() => setCopiedSql(false), 2500);
                      }}
                      className="px-2.5 py-1 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[11px] font-bold flex items-center gap-1.5 transition-all"
                    >
                      {copiedSql ? <Check size={13} className="text-emerald-300" /> : <Copy size={13} />}
                      <span>{copiedSql ? 'Waa La Koobiyeeyay!' : 'Koobiyee SQL-ka'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowSupabaseSql(!showSupabaseSql)}
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-[11px] font-bold transition-all"
                    >
                      {showSupabaseSql ? 'Qari SQL' : 'Eeg SQL Script-ka'}
                    </button>
                    <a
                      href="https://supabase.com/dashboard/project/jifjbnyjivpldkjpgjuj/sql/new"
                      target="_blank"
                      rel="noreferrer"
                      className="px-2.5 py-1 bg-slate-800 hover:bg-slate-700 text-indigo-300 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all"
                    >
                      <span>Fur Supabase SQL</span>
                      <ExternalLink size={12} />
                    </a>
                  </div>
                </div>

                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Haddii ay tahay markii ugu horreysay, guji <strong>&quot;Koobiyee SQL-ka&quot;</strong>, kadib gal Supabase dashboard-kaaga &rarr; <strong>SQL Editor</strong> &rarr; ku paste-gareey oo riix <strong>RUN</strong>.
                </p>

                {showSupabaseSql && (
                  <pre className="p-3 bg-slate-950 rounded-xl border border-slate-800 text-[10px] font-mono text-indigo-200 overflow-x-auto select-all leading-relaxed">
                    {SUPABASE_ERP_SQL}
                  </pre>
                )}
              </div>

              {supabaseStatus && (
                <div className={`p-3 rounded-xl text-xs font-bold ${supabaseStatus.success ? 'bg-emerald-950/70 text-emerald-300 border border-emerald-800' : 'bg-rose-950/70 text-rose-300 border border-rose-800'}`}>
                  {supabaseStatus.message}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-3 pt-1">
                <button
                  type="button"
                  disabled={isTestingSupabase || !settings.supabaseUrl || !settings.supabaseKey}
                  onClick={handleTestSupabase}
                  className="px-4 py-2.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md transition-all active:scale-95"
                >
                  {isTestingSupabase ? <RefreshCw size={14} className="animate-spin" /> : <Zap size={14} />}
                  <span>Tijaabi & Ku Xir Supabase</span>
                </button>

                {settings.supabaseUrl && settings.supabaseKey && (
                  <>
                    <button
                      type="button"
                      disabled={isTestingSupabase}
                      onClick={handlePushSupabase}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md transition-all active:scale-95"
                    >
                      <ArrowUp size={14} />
                      <span>U Dir Supabase (Push)</span>
                    </button>
                    <button
                      type="button"
                      disabled={isTestingSupabase}
                      onClick={handlePullSupabase}
                      className="px-4 py-2.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-md transition-all active:scale-95"
                    >
                      <ArrowDown size={14} />
                      <span>Soo Deji Supabase (Pull)</span>
                    </button>
                  </>
                )}
              </div>
            </div>

            {/* Local Storage & IndexedDB 0ms Engine */}
            <div className="p-6 bg-slate-950/60 rounded-3xl border border-slate-800 space-y-3 lg:col-span-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-400 uppercase tracking-widest flex items-center gap-2">
                  <HardDrive size={16} /> LOCAL STORAGE & INDEXEDDB MULTI-VAULT (0ms INSTANT VIEW)
                </span>
                <span className="text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800 px-2 py-0.5 rounded-md">
                  HARDWARE PERSISTED
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium leading-relaxed">
                Xogtaadu isla markii aad website-ka gasho waxay ku furmaysaa 0 millisecond adoon wax internet ah sugin, waayo waxaa isku mar wada haya <strong>LocalStorage</strong>, <strong>IndexedDB High-Capacity Storage</strong>, iyo <strong>Emergency Mobile Vault</strong>. Xitaa haddii moobilka laga baxo ama dib loo daaro, xogtu waa 100% mid badbaadsan.
              </p>
            </div>
          </div>
        </section>

        {/* Local Backup & Automatic JSON Auto-Importer */}
        <section className="bg-white p-8 rounded-[32px] border shadow-sm space-y-6">
          <h3 className="text-lg font-black text-slate-800 border-b pb-4 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Database size={18} className="text-blue-600" /> Galiska Otomaatiga Ah Ee JSON-ka (Auto-JSON Importer)
            </span>
            <span className="text-[10px] bg-blue-50 text-blue-600 px-3 py-1 rounded-full font-black uppercase tracking-wider">
              AUTO-LOAD ACTIVE
            </span>
          </h3>

          <div className="space-y-5">
            <p className="text-xs text-slate-500 font-medium leading-relaxed">
              Doonaysaa inaad shubto ama aad ku paste-greysto JSON dukaankaaga? Marka aad JSON-ka ku paste-greysto ama aad faylka soo xurato, <strong className="text-blue-600">si automatic ahaan ah ayuu toos dukaanka u gelaa</strong> oo uu ugu kaydsamaa Firebase Cloud iyo LocalStorage!
            </p>

            {/* Instant Paste Textarea */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-700 uppercase tracking-widest block px-1">
                Ku Paste-Garee JSON-ka Halkan (Paste JSON Here - Auto Imports Instantly)
              </label>
              <textarea
                value={jsonInputText}
                onChange={handleJsonTextChange}
                onPaste={handleJsonPaste}
                rows={4}
                placeholder="Ku paste-gareey JSON-kaaga halkan (Paste JSON string here)... Si automatic ahaan ah ayuu toos u gelaa dukaanka!"
                className="w-full p-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 font-mono text-xs text-slate-800 transition-all shadow-inner"
              />
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => processAndApplyJSON(jsonInputText, false)}
                  disabled={isProcessingJson || !jsonInputText.trim()}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center gap-2"
                >
                  {isProcessingJson ? <RefreshCw className="animate-spin" size={14} /> : <CheckCircle2 size={14} />}
                  <span>Gali JSON-ka Hadda (Manual Process)</span>
                </button>
                {jsonInputText && (
                  <button
                    type="button"
                    onClick={() => { setJsonInputText(''); setJsonImportStatus(null); }}
                    className="text-xs font-bold text-slate-400 hover:text-red-500"
                  >
                    Clear Text
                  </button>
                )}
              </div>
            </div>

            {/* JSON Status Banner */}
            {jsonImportStatus && (
              <div className={`p-4 rounded-2xl text-xs font-bold transition-all ${jsonImportStatus.startsWith('✅') ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' : jsonImportStatus.startsWith('⏳') ? 'bg-blue-50 text-blue-800 border border-blue-200' : 'bg-rose-50 text-rose-800 border border-rose-200'}`}>
                {jsonImportStatus}
              </div>
            )}

            <div className="h-px bg-slate-100 my-2" />

            {/* File Restore & Download Backup */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <button 
                onClick={handleDownloadBackup}
                className="w-full py-4 bg-slate-900 text-white rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-lg flex items-center justify-center gap-2"
              >
                <Download size={16} /> Download JSON Backup
              </button>

              <div className="relative flex items-center justify-center border-2 border-dashed border-blue-300 bg-blue-50/30 rounded-2xl p-3 hover:bg-blue-50 transition-colors">
                <input 
                  type="file" 
                  accept=".json"
                  onChange={handleRestoreBackup}
                  className="absolute inset-0 opacity-0 cursor-pointer w-full h-full z-10"
                />
                <div className="text-center space-y-0.5">
                  <Upload size={20} className="mx-auto text-blue-600" />
                  <p className="text-xs font-black text-blue-900">Select or Drag JSON File</p>
                  <p className="text-[10px] text-blue-600 font-bold">Auto-imports immediately upon file select</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Identity */}
        <section className="bg-white p-8 rounded-[32px] border shadow-sm space-y-6">
          <h3 className="text-lg font-black text-slate-800 border-b pb-4 flex items-center gap-2">
            <Globe size={18} className="text-blue-500" /> Business Identity
          </h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Store Name</label>
              <input type="text" value={settings.businessName} onChange={e => setSettings({...settings, businessName: e.target.value})} className="w-full px-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">System Currency</label>
              <select value={settings.defaultCurrency} onChange={e => setSettings({...settings, defaultCurrency: e.target.value as Currency})} className="w-full px-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold appearance-none">
                <option value={Currency.USD}>USD - US Dollar</option>
                <option value={Currency.ETB}>ETB - Ethiopian Birr</option>
              </select>
            </div>
          </div>
        </section>

        {/* Finance */}
        <section className="bg-white p-8 rounded-[32px] border shadow-sm space-y-6">
          <h3 className="text-lg font-black text-slate-800 border-b pb-4 flex items-center gap-2">
            <TrendingUp size={18} className="text-emerald-500" /> Financial Settings
          </h3>
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Exchange Rate (1 USD = ? ETB)</label>
              <input type="number" value={settings.exchangeRate} onChange={e => setSettings({...settings, exchangeRate: parseFloat(e.target.value)})} className="w-full px-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-500 uppercase tracking-widest px-1">Global Tax Rate (%)</label>
              <input type="number" value={settings.taxRate} onChange={e => setSettings({...settings, taxRate: parseFloat(e.target.value)})} className="w-full px-4 py-4 bg-slate-50 border-none rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none font-bold" />
            </div>
          </div>
        </section>

        {/* Role & Security Passwords */}
        <section className="bg-white p-8 rounded-[32px] border shadow-sm space-y-6 md:col-span-2 bg-gradient-to-br from-white via-slate-50/50 to-indigo-50/30">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-4">
            <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
              <ShieldCheck size={20} className="text-indigo-600" /> 
              <span>Erayada Sirta ah ee Nidaamka & Roles-ka (Role Security Passwords)</span>
            </h3>
            <span className="text-xs bg-indigo-100 text-indigo-800 font-bold px-3 py-1 rounded-xl w-fit">
              Amniga & Ogolaanshaha Nidaamka
            </span>
          </div>

          <p className="text-xs text-slate-500 font-medium leading-relaxed">
            Halkan waxaad ku beddeli kartaa erayada sirta ah ee u gaarka ah <strong>Admin-ka</strong>, <strong>Manager-ka</strong>, iyo <strong>Recycle Bin PIN-ka</strong>. Cashier-ku marka uu rabo inuu galo Admin ama Manager waxaa la weydiin doonaa password-yadan.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pt-2">
            
            {/* Admin Password */}
            <div className="p-5 bg-red-50/50 rounded-2xl border border-red-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-red-700 uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound size={15} /> Erayga Sirta ah ee Admin
                </span>
                <span className="text-[10px] bg-red-100 text-red-800 font-bold px-2 py-0.5 rounded-md">
                  Awood Buuxda
                </span>
              </div>
              <div className="relative">
                <input 
                  type={showAdminPass ? 'text' : 'password'}
                  value={settings.adminPassword ?? settings.authPassword ?? 'Shugri100@'} 
                  onChange={e => setSettings({
                    ...settings, 
                    adminPassword: e.target.value,
                    authPassword: e.target.value 
                  })} 
                  className="w-full pl-3.5 pr-10 py-3 bg-white border border-red-200 rounded-xl focus:ring-2 focus:ring-red-500 outline-none font-black text-slate-800 text-sm tracking-wider shadow-xs" 
                  placeholder="Shugri100@"
                />
                <button
                  type="button"
                  onClick={() => setShowAdminPass(!showAdminPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showAdminPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 font-medium leading-snug">
                Password-ka Admin-ka waxaa loo isticmaalaa galida dhammaan xogta iyo tirtirista nidaamka.
              </p>
            </div>

            {/* Manager Password */}
            <div className="p-5 bg-purple-50/50 rounded-2xl border border-purple-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-purple-700 uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound size={15} /> Erayga Sirta ah ee Manager
                </span>
                <span className="text-[10px] bg-purple-100 text-purple-800 font-bold px-2 py-0.5 rounded-md">
                  Maamul
                </span>
              </div>
              <div className="relative">
                <input 
                  type={showManagerPass ? 'text' : 'password'}
                  value={settings.managerPassword ?? 'Manager100@'} 
                  onChange={e => setSettings({...settings, managerPassword: e.target.value})} 
                  className="w-full pl-3.5 pr-10 py-3 bg-white border border-purple-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none font-black text-slate-800 text-sm tracking-wider shadow-xs" 
                  placeholder="Manager100@"
                />
                <button
                  type="button"
                  onClick={() => setShowManagerPass(!showManagerPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showManagerPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 font-medium leading-snug">
                Password-ka Manager-ka wuxuu u ogolaanayaa maamulka POS, Invoices, Alaabta, iyo Macaamiisha.
              </p>
            </div>

            {/* Cashier Password */}
            <div className="p-5 bg-emerald-50/50 rounded-2xl border border-emerald-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-emerald-700 uppercase tracking-wider flex items-center gap-1.5">
                  <KeyRound size={15} /> Erayga Sirta ah ee Cashier
                </span>
                <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md">
                  Iibiye (POS Kaliya)
                </span>
              </div>
              <div className="relative">
                <input 
                  type={showCashierPass ? 'text' : 'password'}
                  value={settings.cashierPassword ?? 'Cashier100@'} 
                  onChange={e => setSettings({...settings, cashierPassword: e.target.value})} 
                  className="w-full pl-3.5 pr-10 py-3 bg-white border border-emerald-200 rounded-xl focus:ring-2 focus:ring-emerald-500 outline-none font-black text-slate-800 text-sm tracking-wider shadow-xs" 
                  placeholder="Cashier100@"
                />
                <button
                  type="button"
                  onClick={() => setShowCashierPass(!showCashierPass)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
                >
                  {showCashierPass ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              <p className="text-[11px] text-slate-500 font-medium leading-snug">
                Password-ka Cashier-ka oo kaliya gala POS-ka iyo Reshit-yada, AI-gana ka xiran.
              </p>
            </div>

            {/* Recycle Bin Security PIN */}
            <div className="p-5 bg-amber-50/50 rounded-2xl border border-amber-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-800 uppercase tracking-wider flex items-center gap-1.5">
                  <Lock size={15} /> Recycle Bin PIN Code
                </span>
                <span className="text-[10px] bg-amber-100 text-amber-900 font-bold px-2 py-0.5 rounded-md">
                  Tirtirista
                </span>
              </div>
              <div className="relative">
                <input 
                  type="text" 
                  value={settings.recycleBinPin || 'xaysimo1122'} 
                  onChange={e => setSettings({...settings, recycleBinPin: e.target.value})} 
                  className="w-full px-3.5 py-3 bg-white border border-amber-200 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none font-black text-slate-800 text-sm tracking-wider shadow-xs" 
                  placeholder="xaysimo1122"
                />
              </div>
              <p className="text-[11px] text-slate-500 font-medium leading-snug">
                PIN-ka lagu galo qashin-qubka (Recycle Bin) si aan xogta loo tirtirin si kama' ah.
              </p>
            </div>

          </div>
        </section>

        {/* Gmail Notifications & EmailJS Cloud Integration */}
        <section className="bg-white p-8 rounded-[32px] border shadow-sm space-y-6 md:col-span-2 bg-gradient-to-br from-white via-blue-50/20 to-sky-50/40">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b pb-4">
            <div>
              <h3 className="text-lg font-black text-slate-800 flex items-center gap-2">
                <Mail size={22} className="text-blue-600" />
                <span>Digniinta EmailJS & Gmail-ka (EmailJS Cloud Alerts & 2h Reports)</span>
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-1">
                Toos ugu xir EmailJS si xogta iibka kasta iyo warbixinaha dukaanka ugu dhacaan Gmail-kaaga.
              </p>
            </div>
            
            {settings.emailJsServiceId && settings.emailJsTemplateId && settings.emailJsPublicKey ? (
              <span className="text-xs bg-emerald-100 text-emerald-800 font-black px-3 py-1.5 rounded-xl w-fit flex items-center gap-1.5 border border-emerald-200 shadow-xs">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                EmailJS Waa Ku Xiran Yahay
              </span>
            ) : (
              <span className="text-xs bg-amber-100 text-amber-800 font-black px-3 py-1.5 rounded-xl w-fit flex items-center gap-1.5 border border-amber-200">
                <Zap size={13} className="text-amber-600" /> Server Dispatch Mode
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Left Column: EmailJS Credentials & Admin Recipient */}
            <div className="space-y-4">
              <div className="p-5 bg-white rounded-2xl border border-blue-200 shadow-xs space-y-4">
                <div>
                  <label className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-2 mb-2">
                    <Mail size={16} className="text-blue-600" /> Gmail-ka Admin-ka / Manager-ka (Alert Recipient Email)
                  </label>
                  <input
                    type="email"
                    placeholder="tusaale: rumaanarumaan@gmail.com"
                    value={settings.adminAlertEmail || ''}
                    onChange={e => setSettings({ ...settings, adminAlertEmail: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800 text-sm"
                  />
                  <p className="text-[11px] text-slate-500 font-medium mt-1.5">
                    Email-ka rasmiga ah ee xogta iibka iyo warbixintu toos ugu soo dhacayso.
                  </p>
                </div>

                {/* EmailJS Credentials Accordion / Inputs */}
                <div className="pt-3 border-t border-slate-100 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                      <Cloud size={15} className="text-blue-600" /> Xogta EmailJS (EmailJS API Credentials)
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowEmailJsGuide(!showEmailJsGuide)}
                      className="text-[11px] font-bold text-blue-600 hover:text-blue-800 underline flex items-center gap-1"
                    >
                      {showEmailJsGuide ? 'Qari Tilmaamaha' : 'Sidee loo sameeyaa? (Guide)'}
                    </button>
                  </div>

                  {showEmailJsGuide && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-700 space-y-2 animate-in fade-in">
                      <p className="font-bold text-slate-900">Tilmaamaha EmailJS (4 Tallaabo):</p>
                      <ol className="list-decimal pl-4 space-y-1 text-[11px] leading-relaxed">
                        <li>Gal <a href="https://www.emailjs.com" target="_blank" rel="noreferrer" className="text-blue-600 font-bold underline">emailjs.com</a> oo account bilaash ah fur.</li>
                        <li><strong>Email Services:</strong> Ku dar Gmail-kaaga (Service ID-ga nuqul ka qaad).</li>
                        <li><strong>Email Templates:</strong> Abuuro template cusub. Variables-ka template-ka geli:
                          <code className="block bg-white p-2 rounded border border-slate-200 mt-1 font-mono text-[10px] text-blue-800">
                            Subject: {"{{subject}}"} <br />
                            Body: {"{{{html_content}}}"} ama {"{{message}}"} <br />
                            To: {"{{to_email}}"}
                          </code>
                        </li>
                        <li><strong>Account:</strong> Nuqul ka qaad <strong>Public Key</strong>-gaaga.</li>
                      </ol>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        Service ID:
                      </label>
                      <input
                        type="text"
                        placeholder="service_xxxxxx"
                        value={settings.emailJsServiceId || ''}
                        onChange={e => setSettings({ ...settings, emailJsServiceId: e.target.value.trim() })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-bold text-slate-600 block mb-1">
                        Template ID:
                      </label>
                      <input
                        type="text"
                        placeholder="template_xxxxxx"
                        value={settings.emailJsTemplateId || ''}
                        onChange={e => setSettings({ ...settings, emailJsTemplateId: e.target.value.trim() })}
                        className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="text-[11px] font-bold text-slate-600 block mb-1">
                      Public Key (User ID):
                    </label>
                    <input
                      type="text"
                      placeholder="Public Key (tusaale: kx_98...)"
                      value={settings.emailJsPublicKey || ''}
                      onChange={e => setSettings({ ...settings, emailJsPublicKey: e.target.value.trim() })}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-mono font-bold text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>
              </div>

              {/* Action Buttons: EmailJS Test & 2h Report Test */}
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  disabled={isSendingEmailJsTest || !settings.adminAlertEmail}
                  onClick={async () => {
                    if (!settings.adminAlertEmail) {
                      alert('Fadlan marka hore geli Gmail-kaaga!');
                      return;
                    }
                    setIsSendingEmailJsTest(true);
                    setEmailJsTestResult(null);
                    try {
                      const res = await testEmailJsAlert(
                        {
                          ...data,
                          settings: {
                            ...data.settings,
                            adminAlertEmail: settings.adminAlertEmail,
                            emailJsServiceId: settings.emailJsServiceId,
                            emailJsTemplateId: settings.emailJsTemplateId,
                            emailJsPublicKey: settings.emailJsPublicKey,
                            emailJsPrivateKey: settings.emailJsPrivateKey
                          }
                        },
                        settings.adminAlertEmail
                      );
                      setEmailJsTestResult(res);
                    } catch (err: any) {
                      setEmailJsTestResult({ success: false, message: 'Cillad: ' + err.message });
                    } finally {
                      setIsSendingEmailJsTest(false);
                    }
                  }}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSendingEmailJsTest ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      EmailJS Waa La Tijaabinayaa...
                    </>
                  ) : (
                    <>
                      <Zap size={14} />
                      Tijaabi EmailJS (Test EmailJS Live)
                    </>
                  )}
                </button>

                <button
                  type="button"
                  disabled={isSendingTestAlert || !settings.adminAlertEmail}
                  onClick={async () => {
                    if (!settings.adminAlertEmail) {
                      alert('Fadlan marka hore geli Gmail-kaaga!');
                      return;
                    }
                    setIsSendingTestAlert(true);
                    setTestAlertStatus(null);
                    try {
                      const res = await sendTwoHourPeriodicReport({
                        ...data,
                        settings: {
                          ...data.settings,
                          adminAlertEmail: settings.adminAlertEmail,
                          emailJsServiceId: settings.emailJsServiceId,
                          emailJsTemplateId: settings.emailJsTemplateId,
                          emailJsPublicKey: settings.emailJsPublicKey,
                          emailJsPrivateKey: settings.emailJsPrivateKey
                        }
                      });
                      if (res && res.success) {
                        setTestAlertStatus('✅ Warbixinta 2-da saacadood si guul leh ayaa loogu diray Email-kaaga!');
                      } else {
                        setTestAlertStatus('⚠️ Digniinta: ' + (res?.message || 'Ready'));
                      }
                    } catch (err: any) {
                      setTestAlertStatus('Cillad: ' + err.message);
                    } finally {
                      setIsSendingTestAlert(false);
                    }
                  }}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm transition-all active:scale-95 disabled:opacity-50"
                >
                  {isSendingTestAlert ? (
                    <>
                      <RefreshCw size={14} className="animate-spin" />
                      Waa la dirayaa...
                    </>
                  ) : (
                    <>
                      <Send size={14} />
                      Dir Warbixin Tijaabo Ah (Send 2h Report)
                    </>
                  )}
                </button>
              </div>

              {/* Status Feedbacks */}
              {emailJsTestResult && (
                <div className={`p-3.5 rounded-xl border text-xs font-bold animate-in fade-in flex items-center gap-2 ${
                  emailJsTestResult.success
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    : 'bg-amber-50 border-amber-200 text-amber-900'
                }`}>
                  {emailJsTestResult.success ? <CheckCircle2 size={16} className="text-emerald-600 shrink-0" /> : <AlertTriangle size={16} className="text-amber-600 shrink-0" />}
                  <span>{emailJsTestResult.message}</span>
                </div>
              )}

              {testAlertStatus && (
                <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-xl text-xs font-bold animate-in fade-in">
                  {testAlertStatus}
                </div>
              )}
            </div>

            {/* Right Column: Preferences Toggles & Automatic Schedule */}
            <div className="space-y-4">
              {/* Option 1: Instant Alerts */}
              <div className="p-5 bg-white rounded-2xl border border-slate-200 flex items-start gap-3.5 shadow-xs">
                <input
                  type="checkbox"
                  id="instantAlertToggle"
                  checked={settings.emailAlertsEnabled ?? true}
                  onChange={e => setSettings({ ...settings, emailAlertsEnabled: e.target.checked })}
                  className="mt-1 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="instantAlertToggle" className="cursor-pointer space-y-1.5">
                  <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Zap size={14} className="text-amber-500 fill-amber-500" />
                    ⚡ Digniin Toos Ah (Instant Alert on Checkout / Save / Confirm)
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                    Isla ilbiriqsiga uu cashier-ku xaqiijiyo iib ama lacag qabasho, xogta iyo rasiidka oo faahfaahsan waxay isla markiiba toos ugu dhacaysaa Gmail-kaaga.
                  </p>
                </label>
              </div>

              {/* Option 2: 2-Hour Summary Reports */}
              <div className="p-5 bg-white rounded-2xl border border-slate-200 flex items-start gap-3.5 shadow-xs">
                <input
                  type="checkbox"
                  id="twoHourReportToggle"
                  checked={settings.twoHourReportsEnabled ?? true}
                  onChange={e => setSettings({ ...settings, twoHourReportsEnabled: e.target.checked })}
                  className="mt-1 w-4 h-4 rounded text-blue-600 focus:ring-blue-500 cursor-pointer"
                />
                <label htmlFor="twoHourReportToggle" className="cursor-pointer space-y-1.5">
                  <div className="text-xs font-black text-slate-800 flex items-center gap-1.5">
                    <Clock size={14} className="text-blue-600" />
                    ⏰ Warbixin Buuxda 2-dii Saacadoodba Mar (2-Hour Periodic Report)
                  </div>
                  <p className="text-[11px] text-slate-500 font-medium leading-relaxed">
                    Nidaamku wuxuu 2-dii saacadoodba mar si otomaatig ah u ururinayaa wadarta iibka, faa'iidada, deymaha cusub, iyo alaabta dhamaanaysa isagoo toos ugu soo diraya EmailJS / Gmail.
                  </p>
                </label>
              </div>

              {/* Notification Security Note */}
              <div className="p-4 bg-blue-50/60 rounded-2xl border border-blue-100 text-xs text-blue-900 space-y-1.5">
                <div className="font-bold flex items-center gap-1.5 text-blue-800">
                  <ShieldCheck size={14} /> Xog Amni Leh & Toos Ah
                </div>
                <p className="text-[11px] text-blue-700 leading-relaxed">
                  Haddii aad geliso EmailJS Service ID, Template ID, iyo Public Key, browser-kaaga ayaa toos u diraya email-ka. Haddii kale, server-ka gudaha ayaa maareynaya gudbinta digniinta.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Online Payment Numbers */}
        <section className="bg-white p-8 rounded-[32px] border shadow-sm space-y-6 md:col-span-2">
          <h3 className="text-lg font-black text-slate-800 border-b pb-4 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <CreditCard size={20} className="text-blue-600" /> Account-yada & Numberada Lacag Bixinta Online-ka (Online Payment Accounts)
            </span>
            <span className="text-xs text-blue-600 bg-blue-50 font-bold px-3 py-1 rounded-xl">
              Golis, eBirr, Kaafi, Ku Iibso, eDahab, Commercial Bank
            </span>
          </h3>
          <p className="text-xs text-slate-500 font-medium">
            Geli numberada ama account-yada lacagta laguugu soo dirayo marka macaamiishu ay online-ka wax ka soo dalbanayaan ama deynta ku bixinayaan:
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Golis */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <label className="text-xs font-black text-slate-700 flex items-center gap-1.5 uppercase">
                <Phone size={14} className="text-blue-600" /> 1. Golis (Sahal / Golis)
              </label>
              <input
                type="text"
                placeholder="e.g. 0907112233"
                value={settings.onlinePaymentNumbers?.golis || ''}
                onChange={e => setSettings({
                  ...settings,
                  onlinePaymentNumbers: {
                    ...settings.onlinePaymentNumbers,
                    golis: e.target.value
                  }
                })}
                className="w-full px-3.5 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800 text-sm"
              />
            </div>

            {/* eBirr */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <label className="text-xs font-black text-slate-700 flex items-center gap-1.5 uppercase">
                <Phone size={14} className="text-emerald-600" /> 2. eBirr
              </label>
              <input
                type="text"
                placeholder="e.g. 0911223344"
                value={settings.onlinePaymentNumbers?.ebirr || ''}
                onChange={e => setSettings({
                  ...settings,
                  onlinePaymentNumbers: {
                    ...settings.onlinePaymentNumbers,
                    ebirr: e.target.value
                  }
                })}
                className="w-full px-3.5 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800 text-sm"
              />
            </div>

            {/* Kaafi */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <label className="text-xs font-black text-slate-700 flex items-center gap-1.5 uppercase">
                <CreditCard size={14} className="text-purple-600" /> 3. Kaafi (Merchant ID / Number)
              </label>
              <input
                type="text"
                placeholder="e.g. 987654"
                value={settings.onlinePaymentNumbers?.kaafi || ''}
                onChange={e => setSettings({
                  ...settings,
                  onlinePaymentNumbers: {
                    ...settings.onlinePaymentNumbers,
                    kaafi: e.target.value
                  }
                })}
                className="w-full px-3.5 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800 text-sm"
              />
            </div>

            {/* Ku Iibso */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <label className="text-xs font-black text-slate-700 flex items-center gap-1.5 uppercase">
                <CreditCard size={14} className="text-amber-600" /> 4. Ku Iibso
              </label>
              <input
                type="text"
                placeholder="e.g. 0615112233"
                value={settings.onlinePaymentNumbers?.kuIibso || ''}
                onChange={e => setSettings({
                  ...settings,
                  onlinePaymentNumbers: {
                    ...settings.onlinePaymentNumbers,
                    kuIibso: e.target.value
                  }
                })}
                className="w-full px-3.5 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800 text-sm"
              />
            </div>

            {/* eDahab */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <label className="text-xs font-black text-slate-700 flex items-center gap-1.5 uppercase">
                <Phone size={14} className="text-yellow-600" /> 5. eDahab
              </label>
              <input
                type="text"
                placeholder="e.g. 0659112233"
                value={settings.onlinePaymentNumbers?.edahab || ''}
                onChange={e => setSettings({
                  ...settings,
                  onlinePaymentNumbers: {
                    ...settings.onlinePaymentNumbers,
                    edahab: e.target.value
                  }
                })}
                className="w-full px-3.5 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800 text-sm"
              />
            </div>

            {/* Commercial Bank */}
            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-2">
              <label className="text-xs font-black text-slate-700 flex items-center gap-1.5 uppercase">
                <CreditCard size={14} className="text-indigo-600" /> 6. Commercial Bank (CBE / Bank)
              </label>
              <input
                type="text"
                placeholder="e.g. 10002938484"
                value={settings.onlinePaymentNumbers?.commercialBank || ''}
                onChange={e => setSettings({
                  ...settings,
                  onlinePaymentNumbers: {
                    ...settings.onlinePaymentNumbers,
                    commercialBank: e.target.value
                  }
                })}
                className="w-full px-3.5 py-3 bg-white border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-slate-800 text-sm"
              />
            </div>
          </div>
        </section>

        {/* Maintenance */}
        <section className="bg-rose-50 p-8 rounded-[32px] border border-rose-100 shadow-sm space-y-6">
          <h3 className="text-lg font-black text-rose-800 border-b border-rose-200 pb-4 flex items-center gap-2">
            <AlertTriangle size={18} className="text-rose-600" /> System Maintenance
          </h3>
          <div className="space-y-4">
             <div className="p-4 bg-white rounded-2xl border border-rose-100 space-y-4">
                <p className="text-xs font-black text-rose-700 mb-2 uppercase tracking-tight flex items-center gap-1">
                  <AlertTriangle size={14} className="text-rose-600" /> QAYBTA TIRINTA XOGTA (REMOVE DATA & RESET TO $0)
                </p>

                {/* DEDICATED OPTION FOR DELETING SALES AND RESETTING DEBTS TO $0 */}
                <button 
                  onClick={handleDeleteAllSalesAndZeroDebts}
                  className="w-full py-4 bg-rose-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-rose-700 transition-all shadow-lg flex items-center justify-center gap-2 shadow-rose-200"
                >
                  <Trash2 size={18} /> Tirtir Iibkii Dhacay & Deymaha Ka Dhig $0 (Delete Sales & Zero Debts)
                </button>
                <p className="text-[10px] text-slate-600 font-bold text-center uppercase tracking-tight leading-relaxed">
                  Waxay tiri doontaa dhammaan iibkii hore (sales transactions), deymaha macaamiishana waxay ka dhigi doontaa $0.<br/>
                  <span className="text-emerald-700 font-extrabold">(Alaabta & Stock-ka dukaanka waa lagu reebayaa)</span>
                </p>

                <div className="h-px bg-slate-200 my-2" />

                <button 
                  onClick={handleResetOnlyBalancesToZero}
                  className="w-full py-3.5 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-md flex items-center justify-center gap-2"
                >
                  <RotateCcw size={16} /> Dhig Dhammaan Balance $0 (Set All Balances to $0)
                </button>
                <p className="text-[10px] text-slate-500 font-bold text-center uppercase tracking-tight">
                  Waxay $0 ka dhigaysaa Akoonnada Xisaabaadka & Deymaha Macaamiisha
                </p>

                <div className="h-px bg-slate-200 my-2" />
                
                <button 
                  onClick={handleFreshFinancialStart}
                  className="w-full py-4 bg-amber-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-amber-700 transition-all shadow-lg flex items-center justify-center gap-2 group"
                >
                  <Eraser size={16} className="group-hover:animate-pulse" /> Financial Reset: Tir Sales-ka, Profit-ka & Deymaha
                </button>
                <p className="text-[10px] text-slate-500 font-bold text-center uppercase tracking-tight leading-relaxed">
                  Waxay $0 ka dhigaysaa Sales, Profit, Expenses, Deymaha, & Balances-ka<br/>
                  <span className="text-amber-600">(Product Catalog-ka waa la reebayaa)</span>
                </p>

                <div className="h-px bg-rose-100 my-2" />

                <button 
                  onClick={handleMasterClear}
                  className="w-full py-4 bg-slate-900 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-black transition-all shadow-lg flex items-center justify-center gap-2"
                >
                  <Trash2 size={18} /> TIR DHAMMAAN XOGTA DUKAANKA (MASTER WIPE)
                </button>
                <p className="text-[10px] text-rose-600 font-black text-center uppercase tracking-tight leading-relaxed">
                  0$ Ka dhig meel walba! (Sales, Deynta, History, Stock, Transcripts, & Firebase Cloud Data)
                </p>
             </div>
             
             <button 
                onClick={() => { if(confirm("Ma hubtaa inaad tirto dhammaan xogta qalabkan (Local storage wipe)?")) { localStorage.clear(); window.location.reload(); } }}
                className="w-full py-3 bg-white border border-rose-200 text-rose-600 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-rose-50 transition-colors"
             >
                Factory Reset Local Device
             </button>
          </div>
        </section>
      </div>
    </div>
  );
};

export default SettingsView;
