// High-Performance Permanent Multi-Layer Offline Storage Manager (Infinite Durability Engine)
export const DB_NAME = 'UltimateERP_PermanentDB';
export const STORE_NAME = 'app_state';
export const STORAGE_KEY = 'ultimate_erp_master_data_v2';
export const BACKUP_STORAGE_KEY = 'ultimate_erp_permanent_backup';
export const EMERGENCY_RESCUE_KEY = 'ultimate_erp_emergency_rescue';
export const SESSION_BACKUP_KEY = 'ultimate_erp_session_backup';
export const USER_RESTORED_VAULT_KEY = 'ultimate_erp_user_restored_vault';
export const ARCHIVE_KEY_PREFIX = 'ultimate_erp_archive_';

// Request persistent storage permission from browser so data is never evicted by browser quota
if (typeof navigator !== 'undefined' && navigator.storage && navigator.storage.persist) {
  navigator.storage.persist().then((persistent) => {
    if (persistent) {
      console.log('IndexedDB persistent storage granted - data will never be cleared automatically.');
    }
  }).catch(() => {});
}

/**
 * Proactively evicts redundant duplicate backups from localStorage & sessionStorage.
 * In earlier versions, 5 identical copies of the multi-megabyte database were stored simultaneously,
 * easily exhausting the browser's 5MB origin quota.
 * IndexedDB provides durable gigabyte-scale storage, while localStorage only needs the single primary key.
 */
export const cleanupRedundantStorageKeys = (): void => {
  if (typeof localStorage === 'undefined') return;
  try {
    const redundantKeys = [
      BACKUP_STORAGE_KEY,
      EMERGENCY_RESCUE_KEY,
      USER_RESTORED_VAULT_KEY,
      'ultimate_erp_mobile_backup_vault',
      'xaysimo_retail_db_v3',
    ];
    for (const key of redundantKeys) {
      try {
        localStorage.removeItem(key);
      } catch {}
    }

    for (let i = localStorage.length - 1; i >= 0; i--) {
      const k = localStorage.key(i);
      if (k && (k.startsWith(ARCHIVE_KEY_PREFIX) || k.startsWith('temp_') || (k.includes('vault') && k !== STORAGE_KEY))) {
        try {
          localStorage.removeItem(k);
        } catch {}
      }
    }
  } catch {}

  if (typeof sessionStorage !== 'undefined') {
    try {
      sessionStorage.removeItem(SESSION_BACKUP_KEY);
    } catch {}
  }
};

// Immediately clean redundant keys on load to free quota
try {
  cleanupRedundantStorageKeys();
} catch {}

/**
 * Quota-safe write to localStorage.
 * Automatically handles DOMException: "The quota has been exceeded."
 * by purging obsolete keys and trimming bulky non-critical logs if necessary.
 */
export const safeSetLocalStorage = (key: string, data: any): boolean => {
  if (typeof localStorage === 'undefined' || data === undefined || data === null) return false;
  try {
    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
    localStorage.setItem(key, jsonStr);
    return true;
  } catch (err: any) {
    // 1. Quota exceeded: Clean redundant keys and retry
    try {
      cleanupRedundantStorageKeys();
      const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
      localStorage.setItem(key, jsonStr);
      return true;
    } catch {
      // 2. Still exceeded quota: Trim bulky logs (auditLogs & recycleBin) for localStorage only
      // Full fidelity data remains completely safe in IndexedDB and Firebase Cloud!
      try {
        const obj = typeof data === 'string' ? JSON.parse(data) : data;
        if (obj && typeof obj === 'object') {
          const trimmedObj = {
            ...obj,
            auditLogs: Array.isArray(obj.auditLogs) ? obj.auditLogs.slice(0, 30) : [],
            recycleBin: Array.isArray(obj.recycleBin) ? obj.recycleBin.slice(0, 20) : [],
          };
          localStorage.setItem(key, JSON.stringify(trimmedObj));
          return true;
        }
      } catch {
        // 3. Fallback: IndexedDB holds the full authoritative state, gracefully handle without crashing
        console.warn('LocalStorage quota limit reached; IndexedDB retains complete state.');
        return false;
      }
    }
  }
  return false;
};

/**
 * Quota-safe write to sessionStorage
 */
export const safeSetSessionStorage = (key: string, data: any): void => {
  if (typeof sessionStorage === 'undefined' || data === undefined || data === null) return;
  try {
    const jsonStr = typeof data === 'string' ? data : JSON.stringify(data);
    sessionStorage.setItem(key, jsonStr);
  } catch {
    // Silently ignore sessionStorage quota limits
  }
};

export const hasMeaningfulData = (data: any): boolean => {
  if (!data || typeof data !== 'object') return false;
  const pCount = Array.isArray(data.products) ? data.products.length : 0;
  const tCount = Array.isArray(data.transactions) ? data.transactions.length : 0;
  const cCount = Array.isArray(data.customers) ? data.customers.length : 0;
  const sCount = Array.isArray(data.suppliers) ? data.suppliers.length : 0;
  const eCount = Array.isArray(data.expenses) ? data.expenses.length : 0;
  const khExp = Array.isArray(data.khudaarExpenses) ? data.khudaarExpenses.length : 0;
  const khSale = Array.isArray(data.khudaarSales) ? data.khudaarSales.length : 0;
  const iceCount = Array.isArray(data.iceCreamIngredients) ? data.iceCreamIngredients.length : 0;
  const saCount = Array.isArray(data.stockAdjustments) ? data.stockAdjustments.length : 0;
  const atCount = Array.isArray(data.accountTransfers) ? data.accountTransfers.length : 0;
  const maCount = Array.isArray(data.monthlyArchives) ? data.monthlyArchives.length : 0;
  return (pCount + tCount + cCount + sCount + eCount + khExp + khSale + iceCount + saCount + atCount + maCount) > 0;
};

export const countDataItems = (data: any): number => {
  if (!data || typeof data !== 'object') return 0;
  return (
    (Array.isArray(data.products) ? data.products.length : 0) +
    (Array.isArray(data.transactions) ? data.transactions.length : 0) +
    (Array.isArray(data.customers) ? data.customers.length : 0) +
    (Array.isArray(data.suppliers) ? data.suppliers.length : 0) +
    (Array.isArray(data.expenses) ? data.expenses.length : 0) +
    (Array.isArray(data.khudaarExpenses) ? data.khudaarExpenses.length : 0) +
    (Array.isArray(data.khudaarSales) ? data.khudaarSales.length : 0) +
    (Array.isArray(data.stockAdjustments) ? data.stockAdjustments.length : 0) +
    (Array.isArray(data.accountTransfers) ? data.accountTransfers.length : 0) +
    (Array.isArray(data.onlineOrders) ? data.onlineOrders.length : 0) +
    (Array.isArray(data.onlineCustomers) ? data.onlineCustomers.length : 0) +
    (Array.isArray(data.iceCreamIngredients) ? data.iceCreamIngredients.length : 0) +
    (Array.isArray(data.monthlyArchives) ? data.monthlyArchives.length : 0)
  );
};

let dbInstance: IDBDatabase | null = null;

const getDB = (): Promise<IDBDatabase | null> => {
  return new Promise((resolve) => {
    if (dbInstance) return resolve(dbInstance);
    if (typeof indexedDB === 'undefined') return resolve(null);
    try {
      const request = indexedDB.open(DB_NAME, 3);
      request.onupgradeneeded = (e: any) => {
        const db = e.target.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME);
        }
      };
      request.onsuccess = (e: any) => {
        dbInstance = e.target.result;
        resolve(dbInstance);
      };
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
};

export const saveToIndexedDB = async (data: any): Promise<boolean> => {
  if (!data || typeof data !== 'object') return false;
  try {
    const db = await getDB();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        const dataToSave = {
          ...data,
          lastModified: data.lastModified || Date.now()
        };
        store.put(dataToSave, 'master_data');
        if (hasMeaningfulData(dataToSave)) {
          store.put(dataToSave, 'last_known_good_data');
          store.put({ data: dataToSave, savedAt: Date.now() }, 'permanent_snapshot');
          store.put({ data: dataToSave, savedAt: Date.now() }, 'unbreakable_backup_vault');
        }
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } catch {
    return false;
  }
};

export const clearIndexedDB = async (): Promise<boolean> => {
  try {
    const db = await getDB();
    if (!db) return true;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readwrite');
        const store = tx.objectStore(STORE_NAME);
        store.clear();
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  } catch {
    return false;
  }
};

export const getFromIndexedDB = async (): Promise<any | null> => {
  try {
    const db = await getDB();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_NAME, 'readonly');
        const store = tx.objectStore(STORE_NAME);
        const req = store.get('master_data');
        req.onsuccess = () => {
          if (req.result && typeof req.result === 'object' && !req.result.isManifest) {
            resolve(req.result);
          } else {
            // Fallback to last known good
            const reqBackup = store.get('last_known_good_data');
            reqBackup.onsuccess = () => {
              if (reqBackup.result && typeof reqBackup.result === 'object') {
                resolve(reqBackup.result);
              } else {
                const reqSnap = store.get('permanent_snapshot');
                reqSnap.onsuccess = () => {
                  resolve(reqSnap.result?.data || null);
                };
                reqSnap.onerror = () => resolve(null);
              }
            };
            reqBackup.onerror = () => resolve(null);
          }
        };
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  } catch {
    return null;
  }
};

// High-efficiency Debounced Storage Writer
let idbSaveTimeout: any = null;
let lastSavedSignature = '';

/**
 * Generates a lightweight signature to avoid expensive JSON serialization if data didn't change
 */
const getLightweightSignature = (data: any): string => {
  if (!data) return '';
  const p = data.products?.length || 0;
  const t = data.transactions?.length || 0;
  const c = data.customers?.length || 0;
  const s = data.suppliers?.length || 0;
  const e = data.expenses?.length || 0;
  const ke = data.khudaarExpenses?.length || 0;
  const ks = data.khudaarSales?.length || 0;
  const sa = data.stockAdjustments?.length || 0;
  const at = data.accountTransfers?.length || 0;
  const ma = data.monthlyArchives?.length || 0;
  const rb = data.recycleBin?.length || 0;
  const del = Object.keys(data.deletedIds || {}).length;
  const mod = data.lastModified || 0;
  return `${p}-${t}-${c}-${s}-${e}-${ke}-${ks}-${sa}-${at}-${ma}-${rb}-${del}-${mod}`;
};

/**
 * Synchronously commits to storage immediately (used during beforeunload, pagehide, blur, or explicit saves)
 */
export const flushSyncSaveAppData = (data: any): void => {
  if (!data || typeof data !== 'object') return;
  const dataWithTime = {
    ...data,
    lastModified: data.lastModified || Date.now()
  };
  lastSavedSignature = getLightweightSignature(dataWithTime);
  safeSetLocalStorage(STORAGE_KEY, dataWithTime);
  saveToIndexedDB(dataWithTime).catch(() => {});
};

/**
 * High-performance, non-blocking safe saver.
 * Debounces writes to 150ms to prevent CPU spikes, UI lags, and memory thrashing.
 */
export const safeSaveAppData = (data: any): void => {
  if (!data || typeof data !== 'object') return;

  const currentSig = getLightweightSignature(data);
  if (currentSig && currentSig === lastSavedSignature) {
    return;
  }

  if (idbSaveTimeout) {
    clearTimeout(idbSaveTimeout);
  }

  idbSaveTimeout = setTimeout(() => {
    const dataWithTime = {
      ...data,
      lastModified: data.lastModified || Date.now()
    };
    lastSavedSignature = getLightweightSignature(dataWithTime);
    safeSetLocalStorage(STORAGE_KEY, dataWithTime);
    saveToIndexedDB(dataWithTime).catch(() => {});
  }, 150);
};

/**
 * Searches across all offline storage layers (LocalStorage, SessionStorage, Emergency Rescue)
 * and returns the latest valid dataset based on latest lastModified timestamp.
 * This guarantees that deliberate user deletions are NEVER undone by older backups with higher counts.
 */
export const getBestLocalStorageBackup = (): any | null => {
  const candidates: string[] = [
    STORAGE_KEY,
    USER_RESTORED_VAULT_KEY,
    BACKUP_STORAGE_KEY,
    EMERGENCY_RESCUE_KEY,
    SESSION_BACKUP_KEY
  ];

  let bestData: any = null;
  let bestTime = -1;
  let maxCount = -1;

  for (const key of candidates) {
    try {
      let raw: string | null = null;
      if (key === SESSION_BACKUP_KEY && typeof sessionStorage !== 'undefined') {
        raw = sessionStorage.getItem(key);
      } else if (typeof localStorage !== 'undefined') {
        raw = localStorage.getItem(key);
      }

      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object' && !parsed.isManifest) {
          const modTime = typeof parsed.lastModified === 'number' ? parsed.lastModified : 0;
          const count = countDataItems(parsed);
          
          if (modTime > bestTime) {
            bestTime = modTime;
            bestData = parsed;
            maxCount = count;
          } else if (modTime === bestTime && count > maxCount) {
            maxCount = count;
            bestData = parsed;
          }
        }
      }
    } catch {}
  }

  if (bestData) {
    safeSetLocalStorage(STORAGE_KEY, bestData);
    cleanupRedundantStorageKeys();
  }

  return bestData;
};



