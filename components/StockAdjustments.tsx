
import React, { useState, useMemo } from 'react';
import { AppData, Currency, StockAdjustment } from '../types';
import { RefreshCcw, Search, AlertCircle, Package, History, Calculator, Trash2, FileText, CheckCircle2, DollarSign } from 'lucide-react';
import { formatCurrency, generateId } from '../lib/utils';

interface Props {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  addLog: (action: string, details: string) => void;
  currency: Currency;
}

const StockAdjustments: React.FC<Props> = ({ data, setData, addLog, currency }) => {
  const [search, setSearch] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quantity, setQuantity] = useState<string>('');
  const [reason, setReason] = useState('');
  const [type, setType] = useState<StockAdjustment['type']>('DAMAGE');
  const [historySearch, setHistorySearch] = useState('');
  const [historyFilterType, setHistoryFilterType] = useState<string>('ALL');

  const rate = data.settings.exchangeRate;

  const filteredProducts = data.products.filter(p => 
    p.name.toLowerCase().includes(search.toLowerCase()) || p.sku.toLowerCase().includes(search.toLowerCase())
  );

  const selectedProduct = data.products.find(p => p.id === selectedProductId);
  const qtyNumber = parseFloat(quantity) || 0;
  const lossValue = selectedProduct ? (selectedProduct.costPrice * qtyNumber) : 0;

  const handleAdjust = () => {
    if (!selectedProduct || qtyNumber <= 0) {
      alert("Fadlan dooro badeecad oo geli tirada luntay (Quantity ka weyn 0, tusaale 0.5 ama 1).");
      return;
    }

    const adjustment: StockAdjustment = {
      id: generateId(),
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      type,
      quantity: qtyNumber,
      timestamp: Date.now(),
      reason: reason.trim()
    };

    // Accounting mapping
    const lossAccountName = type === 'DAMAGE' ? 'Loss - Damaged Items' : 
                            type === 'LOST' ? 'Loss - Lost Items' : 
                            type === 'EXPIRED' ? 'Loss - Expired Items' : 
                            'Inventory Asset'; // Fallback

    setData(prev => {
      // 1. Update Product Stock (supporting decimal floats accurately)
      const newProducts = prev.products.map(p => 
        p.id === selectedProduct.id 
          ? { ...p, stock: Math.max(0, parseFloat((p.stock - qtyNumber).toFixed(4))) } 
          : p
      );

      // 2. Update Accounts
      const newAccounts = prev.accounts.map(acc => {
        // Deduct from Inventory Asset
        if (acc.name === 'Inventory Asset') {
          return { ...acc, balance: Math.max(0, acc.balance - lossValue) };
        }
        // Add to specific Loss Account
        if (acc.name === lossAccountName) {
          return { ...acc, balance: acc.balance + lossValue };
        }
        return acc;
      });

      return {
        ...prev,
        products: newProducts,
        accounts: newAccounts,
        stockAdjustments: [adjustment, ...prev.stockAdjustments],
        lastModified: Date.now()
      };
    });

    const noteText = reason.trim() ? ` [Sababta: ${reason.trim()}]` : '';
    addLog('Stock Adjustment', `Adjusted ${selectedProduct.name} (-${qtyNumber}) due to ${type}.${noteText} Loss value: ${formatCurrency(lossValue, currency, rate)} recorded in ${lossAccountName}`);
    
    // Reset form
    setSelectedProductId('');
    setSearch('');
    setQuantity('');
    setReason('');
    alert(`✅ Stock adjustment (-${qtyNumber} ${selectedProduct.name}) si guul leh ayaa loo diiwaangeliyay!`);
  };

  const handleDeleteAdjustment = (adj: StockAdjustment) => {
    if (!confirm(`Ma hubtaa inaad tirtirto oo dib u celiso adjustment-kan ${adj.productName}? Waxay ku celin doontaa ${adj.quantity} unug stock-ga.`)) return;

    setData(prev => {
      // Revert Product Stock
      const newProducts = prev.products.map(p => 
        p.id === adj.productId 
          ? { ...p, stock: parseFloat((p.stock + adj.quantity).toFixed(4)) } 
          : p
      );

      // Revert Accounts
      const p = prev.products.find(prod => prod.id === adj.productId);
      const val = p ? p.costPrice * adj.quantity : 0;
      const lossAccountName = adj.type === 'DAMAGE' ? 'Loss - Damaged Items' : 
                              adj.type === 'LOST' ? 'Loss - Lost Items' : 
                              adj.type === 'EXPIRED' ? 'Loss - Expired Items' : 
                              'Inventory Asset';

      const newAccounts = prev.accounts.map(acc => {
        if (acc.name === 'Inventory Asset') return { ...acc, balance: acc.balance + val };
        if (acc.name === lossAccountName) return { ...acc, balance: Math.max(0, acc.balance - val) };
        return acc;
      });

      const binItem = {
        id: generateId(),
        type: 'STOCK_ADJUSTMENT' as const,
        deletedAt: Date.now(),
        title: `Stock Adjustment: ${adj.productName} (-${adj.quantity})`,
        description: `Type: ${adj.type} • Reason: ${adj.reason || 'N/A'} • Date: ${new Date(adj.timestamp).toLocaleString()}`,
        originalData: adj
      };

      const updatedDeletedIds = { ...(prev.deletedIds || {}) };
      updatedDeletedIds[adj.id] = Date.now();

      return {
        ...prev,
        products: newProducts,
        accounts: newAccounts,
        stockAdjustments: prev.stockAdjustments.filter(a => a.id !== adj.id),
        recycleBin: [binItem, ...(prev.recycleBin || [])],
        deletedIds: updatedDeletedIds,
        lastModified: Date.now()
      };
    });

    addLog('Adjustment Reverted', `Adjustment for ${adj.productName} was deleted. Stock of ${adj.quantity} restored.`);
  };

  // Filtered adjustment history
  const filteredAdjustments = useMemo(() => {
    return data.stockAdjustments.filter(adj => {
      const matchSearch = !historySearch || 
        adj.productName.toLowerCase().includes(historySearch.toLowerCase()) ||
        (adj.reason && adj.reason.toLowerCase().includes(historySearch.toLowerCase()));
      const matchType = historyFilterType === 'ALL' || adj.type === historyFilterType;
      return matchSearch && matchType;
    });
  }, [data.stockAdjustments, historySearch, historyFilterType]);

  const totalAdjustedLoss = useMemo(() => {
    return data.stockAdjustments.reduce((sum, adj) => {
      const prod = data.products.find(p => p.id === adj.productId);
      const val = prod ? prod.costPrice * adj.quantity : 0;
      return sum + val;
    }, 0);
  }, [data.stockAdjustments, data.products]);

  return (
    <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Left Form: New Adjustment */}
      <div className="lg:col-span-1 space-y-6">
        <div className="bg-white p-8 rounded-[40px] border shadow-sm space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
              <RefreshCcw size={20} className="text-blue-600" /> Diiwaangeli Khasaare / Adjustment
            </h3>
          </div>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Dooro / Baar Badeecada</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-2xl outline-none font-bold text-sm"
                  placeholder="Geli magaca ama SKU..."
                  value={search}
                  onChange={e => {
                    setSearch(e.target.value);
                    if (selectedProductId) setSelectedProductId('');
                  }}
                />
                {search && !selectedProductId && filteredProducts.length > 0 && (
                  <div className="absolute top-full mt-2 left-0 w-full bg-white border rounded-2xl shadow-xl z-20 max-h-56 overflow-y-auto">
                    {filteredProducts.map(p => (
                      <button 
                        key={p.id}
                        onClick={() => { setSelectedProductId(p.id); setSearch(p.name); }}
                        className="w-full p-3.5 text-left hover:bg-blue-50/50 border-b last:border-0 flex justify-between items-center transition-colors"
                      >
                        <div>
                          <p className="font-bold text-sm text-slate-900">{p.name}</p>
                          <p className="text-[10px] font-bold text-slate-400">Qiimaha: {formatCurrency(p.costPrice, currency, rate)}</p>
                        </div>
                        <span className="text-[11px] font-black bg-slate-100 text-slate-700 px-2.5 py-1 rounded-lg">
                          STOCK: {p.stock}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
              {selectedProduct && (
                <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-100 flex items-center justify-between">
                  <span className="text-xs font-black text-emerald-800">✅ {selectedProduct.name}</span>
                  <span className="text-xs font-bold text-emerald-700">Stock Hadda: {selectedProduct.stock}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Tirada Luntay (Quantity)</label>
                <span className="text-[10px] font-bold text-blue-600">Waxaa geli kartaa jajab (0.5, 0.25, 1)</span>
              </div>
              <input 
                type="number"
                step="any"
                min="0.0001"
                className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl outline-none font-bold text-slate-900"
                placeholder="Geli tirada, tusaale: 0.5, 1, 2.5..."
                value={quantity}
                onChange={e => setQuantity(e.target.value)}
              />
              {/* Quick preset buttons */}
              <div className="flex gap-1.5 pt-1 overflow-x-auto">
                {['0.25', '0.5', '0.75', '1', '2', '5', '10'].map(val => (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setQuantity(val)}
                    className="px-2.5 py-1 bg-slate-100 hover:bg-blue-100 hover:text-blue-700 rounded-lg text-xs font-bold text-slate-600 transition-colors"
                  >
                    +{val}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Nooca Khasaaraha / Sababta Guud</label>
              <select 
                className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl outline-none font-bold text-sm"
                value={type}
                onChange={e => setType(e.target.value as any)}
              >
                <option value="DAMAGE">Damaged Item (Wax Jabay / Xumaaday)</option>
                <option value="LOST">Lost Item (Wax Lumay / Maqan)</option>
                <option value="EXPIRED">Expired Item (Wax Dhacay / Waqtigu Ka Dhacay)</option>
                <option value="RETURN_TO_VENDOR">Return to Vendor (Dib Loogu Celiyay Shirkadda)</option>
              </select>
            </div>

            {selectedProduct && qtyNumber > 0 && (
               <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex flex-col items-center animate-in fade-in slide-in-from-top-2">
                  <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest mb-0.5">Qiimaha Khasaaraha Ku Baxaya</p>
                  <h4 className="text-2xl font-black text-rose-700">{formatCurrency(lossValue, currency, rate)}</h4>
                  <p className="text-[9px] font-bold text-rose-400 uppercase mt-0.5">Laga jari doonaa Inventory Asset</p>
               </div>
            )}

            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Sababta / Faahfaahin (Reason / Note)</label>
              <textarea 
                className="w-full px-5 py-3 bg-slate-50 border-none rounded-2xl outline-none font-medium text-sm h-24 resize-none"
                placeholder="Qor sababta dhabta ah ee xumaatay, jabatay, ama u luntay..."
                value={reason}
                onChange={e => setReason(e.target.value)}
              />
            </div>

            <button 
              onClick={handleAdjust}
              disabled={!selectedProductId || qtyNumber <= 0}
              className="w-full py-4 bg-red-600 text-white rounded-2xl font-black shadow-lg shadow-red-900/10 hover:bg-red-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <CheckCircle2 size={18} /> Xaqiiji Khasaaraha (Deduct Stock)
            </button>
          </div>
        </div>
      </div>

      {/* Right Table: Adjustment History with Visible Reason Column */}
      <div className="lg:col-span-2 space-y-6">
        <div className="bg-white rounded-[40px] border shadow-sm overflow-hidden">
          {/* Header with Search & Filter */}
          <div className="p-6 md:p-8 border-b space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
                  <History size={22} />
                </div>
                <div>
                  <h3 className="text-xl font-black text-slate-800">Taariikhda Stock Adjustments & Khasaaraha</h3>
                  <p className="text-xs font-bold text-slate-400">Guud ahaan {data.stockAdjustments.length} diiwaan khasaare ah</p>
                </div>
              </div>
              <div className="bg-rose-50 px-4 py-2 rounded-2xl border border-rose-100 text-right">
                <span className="text-[10px] font-black text-rose-500 uppercase tracking-wider block">Wadarta Khasaaraha</span>
                <span className="text-lg font-black text-rose-700">{formatCurrency(totalAdjustedLoss, currency, rate)}</span>
              </div>
            </div>

            {/* Filter Bar */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2">
              <div className="sm:col-span-2 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text"
                  placeholder="Ka baar alaabta ama sababta (Reason)..."
                  value={historySearch}
                  onChange={e => setHistorySearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none"
                />
              </div>
              <div>
                <select
                  value={historyFilterType}
                  onChange={e => setHistoryFilterType(e.target.value)}
                  className="w-full px-4 py-2.5 bg-slate-50 border-none rounded-xl text-xs font-bold outline-none"
                >
                  <option value="ALL">Dhammaan Noocyada</option>
                  <option value="DAMAGE">Damaged (Jabtay)</option>
                  <option value="LOST">Lost (Lumay)</option>
                  <option value="EXPIRED">Expired (Dhacay)</option>
                  <option value="RETURN_TO_VENDOR">Return to Vendor</option>
                </select>
              </div>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="px-5 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Taariikh</th>
                  <th className="px-5 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Alaabta</th>
                  <th className="px-4 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest text-center">Tirada (Qty)</th>
                  <th className="px-4 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Nooca</th>
                  <th className="px-5 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest">Sababta / Note (Reason)</th>
                  <th className="px-4 py-4 text-[11px] font-black text-slate-400 uppercase tracking-widest text-right">Tirtir</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredAdjustments.map(adj => (
                  <tr key={adj.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-5 py-4 text-xs font-bold text-slate-500 whitespace-nowrap">
                      {new Date(adj.timestamp).toLocaleDateString()} <span className="text-[10px] text-slate-400 block font-medium">{new Date(adj.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                    </td>
                    <td className="px-5 py-4 font-black text-slate-900 text-sm">
                      {adj.productName}
                    </td>
                    <td className="px-4 py-4 text-center font-black text-rose-600 text-sm whitespace-nowrap">
                      -{adj.quantity}
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap">
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase inline-block ${
                        adj.type === 'DAMAGE' ? 'bg-amber-100 text-amber-800' :
                        adj.type === 'LOST' ? 'bg-rose-100 text-rose-800' :
                        adj.type === 'EXPIRED' ? 'bg-purple-100 text-purple-800' :
                        'bg-blue-100 text-blue-800'
                      }`}>
                        {adj.type}
                      </span>
                    </td>
                    {/* VISIBLE REASON COLUMN */}
                    <td className="px-5 py-4 text-xs">
                      {adj.reason ? (
                        <div className="bg-slate-100 text-slate-800 px-3 py-1.5 rounded-xl font-medium max-w-xs break-words inline-flex items-start gap-1.5">
                          <FileText size={13} className="text-slate-400 shrink-0 mt-0.5" />
                          <span>{adj.reason}</span>
                        </div>
                      ) : (
                        <span className="text-slate-300 italic text-[11px]">Faahfaahin lama qorin</span>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                       <button 
                         onClick={() => handleDeleteAdjustment(adj)}
                         className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all opacity-70 group-hover:opacity-100"
                         title="Tirtir oo dib u soo celi stock-ga"
                       >
                         <Trash2 size={16} />
                       </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredAdjustments.length === 0 && (
            <div className="py-20 text-center flex flex-col items-center">
              <Package size={48} className="text-slate-200 mb-2" />
              <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">
                {data.stockAdjustments.length === 0 ? 'Weli wax khasaare ah lama diiwaangelin' : 'Lama helin natiijo ku habboon baaritaankaaga'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default StockAdjustments;

