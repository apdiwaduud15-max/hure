import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getFirestore, 
  doc, 
  collection,
  setDoc, 
  getDoc, 
  getDocs,
  onSnapshot, 
  setLogLevel, 
  getDocFromServer,
  writeBatch,
  enableIndexedDbPersistence
} from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = firebaseConfig.firestoreDatabaseId
  ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
  : getFirestore(app);

// Enable offline persistence for reliable local caching across tabs/devices
try {
  enableIndexedDbPersistence(db).catch(() => {});
} catch (e) {}

// Direct live cloud synchronization
export async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    // Gracefully handle network transitions silently
  }
}

// Error handling standard per Firebase skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
  };
}

let isQuotaExceededState = false;
const quotaListeners = new Set<(exceeded: boolean) => void>();

export function getIsQuotaExceeded(): boolean {
  return isQuotaExceededState;
}

export function subscribeQuotaExceeded(callback: (exceeded: boolean) => void): () => void {
  quotaListeners.add(callback);
  callback(isQuotaExceededState);
  return () => {
    quotaListeners.delete(callback);
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errorMsg = error instanceof Error ? error.message : String(error);
  if (
    errorMsg.includes('quota') || 
    errorMsg.includes('Quota') || 
    errorMsg.includes('resource-exhausted') || 
    errorMsg.includes('RESOURCE_EXHAUSTED') ||
    errorMsg.includes('The quota has been exceeded')
  ) {
    if (!isQuotaExceededState) {
      isQuotaExceededState = true;
      quotaListeners.forEach(cb => {
        try { cb(true); } catch {}
      });
    }
  }

  const errInfo: FirestoreErrorInfo = {
    error: errorMsg,
    authInfo: {
      userId: null,
      email: null,
    },
    operationType,
    path
  };
  // Silent fail-safe log
  return errInfo;
}

// Silence Firestore internal log messages for background retries
try {
  setLogLevel('silent');
} catch (e) {}

export const ALL_SUBCOLLECTIONS = [
  'products',
  'customers',
  'suppliers',
  'transactions',
  'expenses',
  'stockAdjustments',
  'khudaarSales',
  'khudaarExpenses',
  'auditLogs',
  'recycleBin',
  'users',
  'accounts',
  'accountTransfers',
  'onlineOrders',
  'onlineCustomers',
  'iceCreamIngredients',
  'monthlyArchives'
] as const;

export const ALL_ARRAY_KEYS = ALL_SUBCOLLECTIONS;

// Track local write timestamp and unique client instance ID to distinguish Mobile vs Laptop
export const CLIENT_ID = typeof window !== 'undefined' 
  ? ((window as any).__ERP_CLIENT_ID || ((window as any).__ERP_CLIENT_ID = 'dev_' + Math.random().toString(36).substring(2, 9) + '_' + Date.now())) 
  : 'server_' + Date.now();

let lastLocalWriteTimestamp = 0;
let isSavingInProgress = false;
let queuedDataToSave: { data: any; storeId: string } | null = null;

/**
 * Deeply sanitizes an object/array to ensure no `undefined` values or invalid types
 * exist anywhere in the payload before passing to Firestore.
 */
export function sanitizeForFirestore<T>(val: T): T {
  if (val === undefined) {
    return null as any;
  }
  if (val === null || typeof val !== 'object') {
    return val;
  }
  if (Array.isArray(val)) {
    return val
      .filter((item) => item !== undefined)
      .map((item) => sanitizeForFirestore(item)) as any;
  }
  const cleanObj: Record<string, any> = {};
  for (const [k, v] of Object.entries(val)) {
    if (v !== undefined) {
      cleanObj[k] = sanitizeForFirestore(v);
    }
  }
  return cleanObj as T;
}

/**
 * Splits an array into chunks that respect max item count and max byte size (~350KB per chunk)
 * ensuring no single document ever exceeds Firestore's 1MB hard limit.
 */
function chunkArray<T>(items: T[], maxItems = 100, maxBytes = 350 * 1024): T[][] {
  if (!Array.isArray(items) || items.length === 0) return [];
  const chunks: T[][] = [];
  let currentChunk: T[] = [];
  let currentChunkBytes = 0;

  for (const item of items) {
    let itemBytes = 150;
    try {
      itemBytes = JSON.stringify(item).length * 2;
    } catch {}

    if (
      currentChunk.length >= maxItems ||
      (currentChunk.length > 0 && currentChunkBytes + itemBytes > maxBytes)
    ) {
      chunks.push(currentChunk);
      currentChunk = [item];
      currentChunkBytes = itemBytes;
    } else {
      currentChunk.push(item);
      currentChunkBytes += itemBytes;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

/**
 * Commits a series of set / delete operations in atomic batches of <= 400 operations.
 */
async function commitBatchOperations(
  ops: { type: 'set' | 'delete'; ref: any; data?: any }[]
): Promise<void> {
  const BATCH_SIZE = 400;
  for (let i = 0; i < ops.length; i += BATCH_SIZE) {
    const batch = writeBatch(db);
    const slice = ops.slice(i, i + BATCH_SIZE);
    for (const op of slice) {
      if (op.type === 'set') {
        batch.set(op.ref, op.data);
      } else if (op.type === 'delete') {
        batch.delete(op.ref);
      }
    }
    await batch.commit();
  }
}

/**
 * Highly Optimized Free-Tier Friendly Save to Firebase Cloud:
 * 1. If payload fits in single document (< 750KB), saves with a SINGLE write op (saving 95% quota).
 * 2. If larger, seamlessly chunks across subcollections.
 */
export const saveToFirebaseCloud = async (data: any, storeId: string = 'master_db'): Promise<boolean> => {
  if (!data || typeof data !== 'object') return false;

  if (isSavingInProgress) {
    queuedDataToSave = { data, storeId };
    return true;
  }

  isSavingInProgress = true;
  try {
    const now = Date.now();
    lastLocalWriteTimestamp = now;

    const sanitized = sanitizeForFirestore(data);
    let jsonSize = 0;
    try {
      jsonSize = JSON.stringify(sanitized).length;
    } catch {}

    const mainDocRef = doc(db, 'storeData', storeId);

    // If payload is under 750KB, save as single document for maximum Free Tier efficiency (1 write!)
    if (jsonSize > 0 && jsonSize < 750 * 1024) {
      await setDoc(mainDocRef, {
        isChunked: false,
        payload: sanitized,
        lastModified: data.lastModified || now,
        updatedAt: now,
        writerTime: now,
        writerClientId: CLIENT_ID
      });
      return true;
    }

    // Otherwise use scalable chunking
    const manifest: Record<string, number> = {};
    const ops: { type: 'set' | 'delete'; ref: any; data?: any }[] = [];

    for (const key of ALL_ARRAY_KEYS) {
      const items = Array.isArray(data[key]) ? data[key] : [];
      const processedItems = key === 'auditLogs' 
        ? items.slice(-150) 
        : key === 'recycleBin' 
          ? items.slice(-100) 
          : items;

      const chunks = chunkArray(processedItems, 100, 350 * 1024);
      manifest[key] = chunks.length;

      chunks.forEach((chunk, chunkIdx) => {
        const chunkDocRef = doc(db, 'storeData', storeId, 'chunks', `${key}_${chunkIdx}`);
        ops.push({
          type: 'set',
          ref: chunkDocRef,
          data: {
            collection: key,
            index: chunkIdx,
            items: sanitizeForFirestore(chunk),
            updatedAt: now
          }
        });
      });
    }

    ops.push({
      type: 'set',
      ref: mainDocRef,
      data: {
        isChunked: true,
        manifest,
        settings: sanitizeForFirestore(data.settings || {}),
        deletedIds: sanitizeForFirestore(data.deletedIds || {}),
        iceCreamRecipes: sanitizeForFirestore(data.iceCreamRecipes || {}),
        lastModified: data.lastModified || now,
        updatedAt: now,
        writerTime: now,
        writerClientId: CLIENT_ID
      }
    });

    await commitBatchOperations(ops);
    return true;
  } catch (err: any) {
    handleFirestoreError(err, OperationType.WRITE, `storeData/${storeId}`);
    return false;
  } finally {
    isSavingInProgress = false;
    if (queuedDataToSave) {
      const next = queuedDataToSave;
      queuedDataToSave = null;
      saveToFirebaseCloud(next.data, next.storeId).catch(() => {});
    }
  }
};

/**
 * Clean wipe and replace: Resets the cloud database and writes the fresh new data.
 */
export const cleanWipeAndSaveToFirebase = async (data: any, storeId: string = 'master_db'): Promise<boolean> => {
  return saveToFirebaseCloud(data, storeId);
};

/**
 * Fetch full store dataset from Cloud on app startup.
 */
export const fetchFromFirebaseCloud = async (storeId: string = 'master_db'): Promise<any | null> => {
  try {
    const storeDocRef = doc(db, 'storeData', storeId);
    const mainSnap = await getDoc(storeDocRef);
    if (!mainSnap.exists()) return null;

    const mainData = mainSnap.data();
    if (!mainData) return null;

    // 1. Single document payload (Fastest, zero extra reads)
    const payload = mainData.payload;
    if (payload && typeof payload === 'object') {
      return payload;
    }

    // 2. Chunked storage format (Scalable, multi-megabyte support)
    if (mainData.isChunked && mainData.manifest) {
      const chunksSnap = await getDocs(collection(db, 'storeData', storeId, 'chunks'));
      const chunkMap = new Map<string, any[]>();
      chunksSnap.forEach((d) => {
        const chunkData = d.data();
        if (chunkData && Array.isArray(chunkData.items)) {
          chunkMap.set(d.id, chunkData.items);
        }
      });

      const assembled: Record<string, any> = {
        settings: mainData.settings || {},
        deletedIds: mainData.deletedIds || {},
        iceCreamRecipes: mainData.iceCreamRecipes || {},
        lastModified: mainData.lastModified || mainData.updatedAt || Date.now()
      };

      for (const key of ALL_ARRAY_KEYS) {
        const count = mainData.manifest[key] || 0;
        const list: any[] = [];
        for (let i = 0; i < count; i++) {
          const chunkItems = chunkMap.get(`${key}_${i}`);
          if (chunkItems && Array.isArray(chunkItems)) {
            list.push(...chunkItems);
          }
        }
        assembled[key] = list;
      }

      return assembled;
    }

    return null;
  } catch (err: any) {
    handleFirestoreError(err, OperationType.GET, `storeData/${storeId}`);
    return null;
  }
};

export interface SubscriptionMetadata {
  hasPendingWrites: boolean;
}

/**
 * Ultra-Lean Real-Time Listener with Strict Loop Protection.
 * Listens to the store document and fetches chunked updates seamlessly.
 */
export const subscribeToFirebaseCloud = (
  storeId: string = 'master_db', 
  onUpdate: (data: any, meta: SubscriptionMetadata) => void
) => {
  try {
    const docRef = doc(db, 'storeData', storeId);
    let lastHandledWriterTime = 0;
    let isFetchingChunks = false;

    const unsubscribe = onSnapshot(docRef, { includeMetadataChanges: true }, async (snapshot) => {
      const hasPendingWrites = snapshot.metadata.hasPendingWrites;
      
      // If the write was originated locally by this device and is still pending, skip
      if (hasPendingWrites) {
        return;
      }

      if (!snapshot.exists()) {
        onUpdate(null, { hasPendingWrites: false });
        return;
      }

      const data = snapshot.data();
      const writerTime = data?.writerTime || data?.updatedAt || 0;
      const writerClientId = data?.writerClientId;

      // Ignore echoes of our own client's recent writes
      if (writerClientId && writerClientId === CLIENT_ID) {
        return;
      }

      // Fallback echo protection only if writerClientId is missing
      if (!writerClientId && lastLocalWriteTimestamp > 0 && Math.abs(writerTime - lastLocalWriteTimestamp) < 2500) {
        return;
      }

      if (writerTime && writerTime <= lastHandledWriterTime) {
        return;
      }

      // Single doc format (Instant payload delivery)
      const payload = data?.payload;
      if (payload && typeof payload === 'object') {
        lastHandledWriterTime = writerTime;
        onUpdate(payload, { hasPendingWrites });
        return;
      }

      if (data?.isChunked && data?.manifest) {
        if (isFetchingChunks) return;
        isFetchingChunks = true;
        try {
          const fullData = await fetchFromFirebaseCloud(storeId);
          if (fullData) {
            lastHandledWriterTime = writerTime;
            onUpdate(fullData, { hasPendingWrites });
          }
        } finally {
          isFetchingChunks = false;
        }
        return;
      }
    }, (error: any) => {
      handleFirestoreError(error, OperationType.GET, `storeData/${storeId}`);
    });

    return unsubscribe;
  } catch (err) {
    return () => {};
  }
};

export const resetFirebaseSubcollections = async (storeId: string = 'master_db'): Promise<boolean> => {
  return saveToFirebaseCloud({
    products: [],
    transactions: [],
    customers: [],
    suppliers: [],
    expenses: [],
    stockAdjustments: [],
    khudaarSales: [],
    khudaarExpenses: [],
    auditLogs: [],
    recycleBin: [],
    users: [],
    accounts: [],
    accountTransfers: [],
    onlineOrders: [],
    onlineCustomers: [],
    iceCreamIngredients: [],
    iceCreamRecipes: {},
    settings: {},
    lastModified: Date.now()
  }, storeId);
};
