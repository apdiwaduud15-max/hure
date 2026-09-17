import React, { useState } from 'react';
import { AppData, RecycleBinItem, Currency } from '../types';
import { Trash2, Lock, Unlock, RotateCcw, Search, KeyRound, AlertTriangle, ShieldCheck, CheckCircle2, X } from 'lucide-react';
import { generateId, formatCurrency } from '../lib/utils';
import ConfirmModal from './ConfirmModal';

interface Props {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  addLog: (action: string, details: string) => void;
  currency: Currency;
}

export const RecycleBin: React.FC<Props> = ({ data, setData, addLog, currency }) => {
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState('');

  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');

  // Change PIN modal state
  const [showChangePinModal, setShowChangePinModal] = useState(false);
  const [oldPinInput, setOldPinInput] = useState('');
  const [newPinInput, setNewPinInput] = useState('');
  const [confirmNewPinInput, setConfirmNewPinInput] = useState('');
  const [changePinError, setChangePinError] = useState('');
  const [changePinSuccess, setChangePinSuccess] = useState('');

  // Delete confirm state
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<RecycleBinItem | null>(null);
  const [showEmptyConfirm, setShowEmptyConfirm] = useState(false);

  const currentPin = data.settings.recycleBinPin || 'xaysimo1122';
  const rate = data.settings.exchangeRate || 125;

  const items = data.recycleBin || [];

  const handleUnlock = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (pinInput.trim() === currentPin) {
      setIsUnlocked(true);
      setPinError('');
      setPinInput('');
    } else {
      setPinError('PIN-ku waa khaldan yahay! (Incorrect PIN code)');
    }
  };

  const handleChangePin = (e: React.FormEvent) => {
    e.preventDefault();
    setChangePinError('');
    setChangePinSuccess('');

    if (oldPinInput.trim() !== currentPin) {
      setChangePinError('PIN-ka hore waa khaldan yahay!');
      return;
    }

    if (!newPinInput.trim() || newPinInput.length < 4) {
      setChangePinError('PIN-ka cusub waa inuu ka koobnaadaa ugu yaraan 4 xaraf/tiro!');
      return;
    }

    if (newPinInput !== confirmNewPinInput) {
      setChangePinError('PIN-ka cusub iyo ku celinta iskuma mid aha!');
      return;
    }

    setData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        recycleBinPin: newPinInput.trim()
      }
    }));

    addLog('Recycle Bin PIN Changed', 'Recycle Bin PIN security password was successfully updated.');
    setChangePinSuccess('✅ PIN-ka Recycle Bin-ka waa lagu guuleystay beddeliddiisa!');
    setTimeout(() => {
      setShowChangePinModal(false);
      setOldPinInput('');
      setNewPinInput('');
      setConfirmNewPinInput('');
      setChangePinSuccess('');
    }, 1500);
  };

  const handleRestoreItem = (item: RecycleBinItem) => {
    setData(prev => {
      let updatedData = { ...prev };
      const currentBin = (prev.recycleBin || []).filter(i => i.id !== item.id);
      const updatedDeletedIds = { ...(prev.deletedIds || {}) };

      // Remove from tombstone registry so this item is welcomed back into active state
      if (item.originalData?.id) {
        delete updatedDeletedIds[String(item.originalData.id)];
      }
      if (item.id) {
        delete updatedDeletedIds[String(item.id)];
      }

      switch (item.type) {
        case 'PRODUCT': {
          const product = item.originalData;
          if (product && !prev.products.some(p => p.id === product.id)) {
            updatedData.products = [{ ...product, updatedAt: Date.now() }, ...prev.products];
          }
          break;
        }
        case 'TRANSACTION': {
          const tx = item.originalData;
          if (tx && !prev.transactions.some(t => t.id === tx.id)) {
            updatedData.transactions = [{ ...tx, updatedAt: Date.now() }, ...prev.transactions];
          }
          break;
        }
        case 'CUSTOMER': {
          const cust = item.originalData;
          if (cust && !prev.customers.some(c => c.id === cust.id)) {
            updatedData.customers = [{ ...cust, updatedAt: Date.now() }, ...prev.customers];
          }
          break;
        }
        case 'SUPPLIER': {
          const supp = item.originalData;
          if (supp && !prev.suppliers.some(s => s.id === supp.id)) {
            updatedData.suppliers = [{ ...supp, updatedAt: Date.now() }, ...prev.suppliers];
          }
          break;
        }
        case 'EXPENSE': {
          const exp = item.originalData;
          if (exp && !prev.expenses.some(e => e.id === exp.id)) {
            updatedData.expenses = [{ ...exp, updatedAt: Date.now() }, ...prev.expenses];
          }
          break;
        }
        case 'STOCK_ADJUSTMENT': {
          const adj = item.originalData;
          if (adj && !prev.stockAdjustments.some(a => a.id === adj.id)) {
            updatedData.stockAdjustments = [{ ...adj, updatedAt: Date.now() }, ...prev.stockAdjustments];
            if (adj.productId && (adj.type === 'STOCK_IN' || adj.type === 'ADD')) {
              updatedData.products = (updatedData.products || []).map(p => 
                p.id === adj.productId ? { ...p, stock: p.stock + (adj.quantity || 0) } : p
              );
            }
          }
          break;
        }
        case 'KHUDAAR_EXPENSE': {
          const kexp = item.originalData;
          if (kexp && !(prev.khudaarExpenses || []).some(e => e.id === kexp.id)) {
            updatedData.khudaarExpenses = [{ ...kexp, updatedAt: Date.now() }, ...(prev.khudaarExpenses || [])];
          }
          break;
        }
        case 'KHUDAAR_SALE': {
          const ksale = item.originalData;
          if (ksale && !(prev.khudaarSales || []).some(s => s.id === ksale.id)) {
            updatedData.khudaarSales = [{ ...ksale, updatedAt: Date.now() }, ...(prev.khudaarSales || [])];
          }
          break;
        }
      }

      return {
        ...updatedData,
        recycleBin: currentBin,
        deletedIds: updatedDeletedIds,
        lastModified: Date.now()
      };
    });

    addLog('Restored Item from Recycle Bin', `Restored ${item.type}: ${item.title}`);
  };

  const handlePermanentDelete = (itemId: string) => {
    setData(prev => {
      const updatedDeletedIds = { ...(prev.deletedIds || {}) };
      const targetItem = (prev.recycleBin || []).find(i => i.id === itemId);
      const now = Date.now();

      // Permanent tombstone: guarantee this deleted item can NEVER be resurrected by sync from other devices
      if (targetItem?.originalData?.id) {
        updatedDeletedIds[String(targetItem.originalData.id)] = now;
      }
      if (targetItem?.id) {
        updatedDeletedIds[String(targetItem.id)] = now;
      }

      return {
        ...prev,
        recycleBin: (prev.recycleBin || []).filter(i => i.id !== itemId),
        deletedIds: updatedDeletedIds,
        lastModified: now
      };
    });
    setDeleteConfirmItem(null);
    addLog('Permanently Deleted Item', 'Removed item permanently from Recycle Bin.');
  };

  const handleEmptyBin = () => {
    setData(prev => {
      const updatedDeletedIds = { ...(prev.deletedIds || {}) };
      const now = Date.now();

      (prev.recycleBin || []).forEach(item => {
        if (item.originalData?.id) {
          updatedDeletedIds[String(item.originalData.id)] = now;
        }
        if (item.id) {
          updatedDeletedIds[String(item.id)] = now;
        }
      });

      return {
        ...prev,
        recycleBin: [],
        deletedIds: updatedDeletedIds,
        lastModified: now
      };
    });
    setShowEmptyConfirm(false);
    addLog('Empty Recycle Bin', 'Cleared all deleted items from Recycle Bin.');
  };

  const filteredItems = items.filter(item => {
    const matchesSearch = !search || 
      item.title.toLowerCase().includes(search.toLowerCase()) || 
      item.description.toLowerCase().includes(search.toLowerCase());
    
    const matchesType = filterType === 'ALL' || item.type === filterType;

    return matchesSearch && matchesType;
  });

  // LOCKED SCREEN VIEW
  if (!isUnlocked) {
    return (
      <div className="p-4 md:p-8 max-w-md mx-auto">
        <div className="bg-white rounded-[32px] p-8 shadow-xl border border-slate-100 text-center animate-in zoom-in duration-300">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-3xl flex items-center justify-center mx-auto mb-5 shadow-inner">
            <Lock size={32} />
          </div>
          <h2 className="text-xl font-black text-slate-800 uppercase tracking-tight">Recycle Bin-ka Waa Lock</h2>
          <p className="text-xs text-slate-500 font-bold mt-1 uppercase tracking-wider">
            Geli PIN-ka sirta ah si aad u eegto xogta la tirtiray
          </p>

          <form onSubmit={handleUnlock} className="mt-6 space-y-4">
            {pinError && (
              <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl text-xs font-black uppercase border border-rose-100 animate-bounce">
                {pinError}
              </div>
            )}

            <div className="space-y-1 text-left">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">PIN-ka Recycle Bin-ka</label>
              <input 
                type="password"
                required
                autoFocus
                placeholder="Geli PIN (Default: xaysimo1122)"
                value={pinInput}
                onChange={e => setPinInput(e.target.value)}
                className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black text-sm text-center tracking-widest text-slate-800 focus:ring-2 focus:ring-rose-500"
              />
            </div>

            <button 
              type="submit"
              className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-600/30 transition-all flex items-center justify-center gap-2 active:scale-95"
            >
              <Unlock size={18} /> Fur Recycle Bin (Unlock)
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-[10px] font-bold text-slate-400 uppercase">
            Default PIN: <span className="text-slate-700 font-black">xaysimo1122</span>
          </div>
        </div>
      </div>
    );
  }

  // UNLOCKED MAIN VIEW
  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto">
      {/* Top Header */}
      <div className="bg-white p-6 md:p-8 rounded-[32px] border border-slate-100 shadow-sm flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="p-3 bg-rose-100 text-rose-600 rounded-2xl">
              <Trash2 size={24} />
            </div>
            <div>
              <h1 className="text-2xl font-black text-slate-900 tracking-tight uppercase">Recycle Bin (Xogta La Tirtiray)</h1>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                Dhammaan xogtii la tirtiray halkan ayay ku kaydsan tahay • Waad soo celin kartaa
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button 
            onClick={() => setShowChangePinModal(true)}
            className="flex-1 md:flex-none px-4 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2"
          >
            <KeyRound size={16} /> Beddel PIN-ka
          </button>

          <button 
            onClick={() => setShowEmptyConfirm(true)}
            disabled={items.length === 0}
            className="flex-1 md:flex-none px-5 py-3 bg-rose-600 hover:bg-rose-700 disabled:opacity-40 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-rose-600/20 flex items-center justify-center gap-2"
          >
            <Trash2 size={16} /> Eberi Bin-ka ({items.length})
          </button>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-100 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Raadi xogta la tirtiray (Search deleted items)..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-11 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs outline-none focus:ring-2 focus:ring-rose-500"
            />
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            {[
              { id: 'ALL', label: 'Dhammaan' },
              { id: 'TRANSACTION', label: 'Sales / Transactions' },
              { id: 'PRODUCT', label: 'Products' },
              { id: 'CUSTOMER', label: 'Customers' },
              { id: 'SUPPLIER', label: 'Suppliers' },
              { id: 'EXPENSE', label: 'Expenses' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setFilterType(tab.id)}
                className={`px-3.5 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-wider whitespace-nowrap transition-all ${
                  filterType === tab.id
                    ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* List of Deleted Items */}
      {filteredItems.length === 0 ? (
        <div className="bg-white p-12 rounded-[32px] border border-slate-100 text-center space-y-3">
          <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-3xl flex items-center justify-center mx-auto">
            <Trash2 size={32} />
          </div>
          <h3 className="text-base font-black text-slate-700 uppercase tracking-tight">Culumo ma jiraan Recycle Bin-ka</h3>
          <p className="text-xs text-slate-400 font-bold max-w-sm mx-auto uppercase">
            Wax kasta oo aad tirtirto waxay si toos ah usoo gali doonaan halkan si aad goor kasta usoo celin karto.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredItems.map(item => (
            <div key={item.id} className="bg-white p-5 rounded-3xl border border-slate-100 shadow-sm hover:shadow-md transition-all flex flex-col justify-between space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <span className={`px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest ${
                    item.type === 'TRANSACTION' ? 'bg-blue-50 text-blue-700 border border-blue-200' :
                    item.type === 'PRODUCT' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                    item.type === 'CUSTOMER' ? 'bg-purple-50 text-purple-700 border border-purple-200' :
                    item.type === 'SUPPLIER' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                    'bg-slate-100 text-slate-700'
                  }`}>
                    {item.type}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400">
                    {new Date(item.deletedAt).toLocaleDateString()} {new Date(item.deletedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>

                <h3 className="text-sm font-black text-slate-900 tracking-tight leading-snug">{item.title}</h3>
                <p className="text-xs text-slate-500 font-medium line-clamp-2 leading-relaxed">{item.description}</p>
              </div>

              <div className="pt-3 border-t border-slate-100 flex items-center gap-2">
                <button
                  onClick={() => handleRestoreItem(item)}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-sm active:scale-95"
                >
                  <RotateCcw size={14} /> Soo Celi (Restore)
                </button>

                <button
                  onClick={() => setDeleteConfirmItem(item)}
                  className="p-2.5 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl transition-all"
                  title="Tirtir Dhab ah (Permanent Delete)"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Change PIN Modal */}
      {showChangePinModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm">
          <div className="bg-white rounded-[32px] p-6 md:p-8 max-w-md w-full shadow-2xl space-y-5 animate-in zoom-in duration-300">
            <div className="flex items-center justify-between border-b pb-4 border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-50 text-blue-600 rounded-xl">
                  <KeyRound size={20} />
                </div>
                <h3 className="text-base font-black text-slate-800 uppercase">Beddel PIN-ka Recycle Bin</h3>
              </div>
              <button onClick={() => setShowChangePinModal(false)} className="p-1 hover:bg-slate-100 rounded-xl text-slate-400">
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleChangePin} className="space-y-4">
              {changePinError && (
                <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl text-xs font-black uppercase text-center border border-rose-100">
                  {changePinError}
                </div>
              )}

              {changePinSuccess && (
                <div className="p-3 bg-emerald-50 text-emerald-700 rounded-2xl text-xs font-black uppercase text-center border border-emerald-100 flex items-center justify-center gap-2">
                  <CheckCircle2 size={16} /> {changePinSuccess}
                </div>
              )}

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">PIN-ka Hore (Current PIN)</label>
                <input 
                  type="password"
                  required
                  value={oldPinInput}
                  onChange={e => setOldPinInput(e.target.value)}
                  placeholder="Geli PIN-ka hadda"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">PIN-ka Cusub (New PIN)</label>
                <input 
                  type="password"
                  required
                  value={newPinInput}
                  onChange={e => setNewPinInput(e.target.value)}
                  placeholder="Geli PIN-ka cusub"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Ku Celi PIN-ka Cusub (Confirm New PIN)</label>
                <input 
                  type="password"
                  required
                  value={confirmNewPinInput}
                  onChange={e => setConfirmNewPinInput(e.target.value)}
                  placeholder="Abti u celi PIN-ka cusub"
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <button 
                type="submit"
                className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-600/30 transition-all"
              >
                Kaydi PIN-ka Cusub
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Permanent Delete Single Item Confirm */}
      <ConfirmModal 
        isOpen={!!deleteConfirmItem}
        title="Tirtir Dhab ah (Permanent Delete)?"
        message={`Ma hubtaa inaad tirtirto dhabta ah: "${deleteConfirmItem?.title}"? Action-kan dib looma noqon karo oo si joogto ah ayaa loo tiri doonaa.`}
        confirmText="Haa, Tirtir Dhab ah"
        cancelText="Kansal"
        onConfirm={() => deleteConfirmItem && handlePermanentDelete(deleteConfirmItem.id)}
        onClose={() => setDeleteConfirmItem(null)}
      />

      {/* Empty Bin Confirm */}
      <ConfirmModal 
        isOpen={showEmptyConfirm}
        title="Eberi Dhammaan Recycle Bin-ka?"
        message={`Ma hubtaa inaad ka zaydo dhammaan ${items.length} walax ee ku jira Recycle Bin-ka? Dhammaantood si joogto ah ayaa loo tiri doonaa.`}
        confirmText="Haa, Eberi Bin-ka"
        cancelText="Kansal"
        onConfirm={handleEmptyBin}
        onClose={() => setShowEmptyConfirm(false)}
      />
    </div>
  );
};
