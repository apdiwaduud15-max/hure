import React, { useState, useMemo } from 'react';
import { AppData, Currency, Product, StockAdjustment, Supplier, Account } from '../types';
import { PackagePlus, Search, ArrowUpRight, Truck, Calculator, History, CheckCircle2, Wallet, AlertCircle } from 'lucide-react';
import { formatCurrency, generateId } from '../lib/utils';

interface Props {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  addLog: (action: string, details: string) => void;
  currency: Currency;
}

const StockIn: React.FC<Props> = ({ data, setData, addLog, currency }) => {
  const [searchProduct, setSearchProduct] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number>(0);
  const [unitCost, setUnitCost] = useState<number>(0);
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  const rate = data.settings.exchangeRate;

  const filteredProducts = useMemo(() => {
    if (!searchProduct) return [];
    const term = searchProduct.toLowerCase();
    return data.products.filter(p => 
      p.name.toLowerCase().includes(term) || 
      p.sku.toLowerCase().includes(term) || 
      p.barcode.toLowerCase().includes(term)
    );
  }, [data.products, searchProduct]);

  const totalPurchaseCost = quantity * unitCost;
  const selectedAccount = data.accounts.find(a => a.id === selectedAccountId);
  const hasInsufficientFunds = selectedAccount ? selectedAccount.balance < totalPurchaseCost : false;

  const handleStockIn = () => {
    if (!selectedProduct || quantity <= 0) return alert("Please select a product and enter a valid quantity.");
    if (!selectedAccountId) return alert("Please select a payment account to deduct the cost from.");
    if (hasInsufficientFunds) return alert("Insufficient funds in the selected account to complete this purchase.");
    
    setIsProcessing(true);

    const oldStock = selectedProduct.stock;
    const newStock = oldStock + quantity;
    
    const adjustment: StockAdjustment = {
      id: generateId(),
      productId: selectedProduct.id,
      productName: selectedProduct.name,
      type: 'STOCK_IN',
      quantity: quantity,
      timestamp: Date.now(),
      reason: `Inbound delivery. Account: ${selectedAccount?.name}. Old Stock: ${oldStock}, New: ${newStock}`,
      supplierId: selectedSupplierId,
      unitCost: unitCost,
      totalCost: totalPurchaseCost,
      cashPaid: totalPurchaseCost,
      paymentType: 'CASH',
      accountId: selectedAccountId
    };

    setData(prev => ({
      ...prev,
      products: prev.products.map(p => 
        p.id === selectedProduct.id 
          ? { ...p, stock: newStock, costPrice: unitCost > 0 ? unitCost : p.costPrice } 
          : p
      ),
      accounts: prev.accounts.map(a => 
        a.id === selectedAccountId 
          ? { ...a, balance: a.balance - totalPurchaseCost } 
          : a
      ),
      stockAdjustments: [adjustment, ...prev.stockAdjustments]
    }));

    addLog('Stock In & Payment', `Replenished ${selectedProduct.name}: +${quantity}. Deducted ${formatCurrency(totalPurchaseCost, currency, rate)} from ${selectedAccount?.name}`);
    
    // Reset form
    setIsProcessing(false);
    setSelectedProduct(null);
    setSearchProduct('');
    setQuantity(0);
    setUnitCost(0);
    setSelectedSupplierId('');
    setSelectedAccountId('');
    alert("Stock updated and payment processed!");
  };

  const recentStockIn = useMemo(() => {
    return data.stockAdjustments.filter(a => a.type === 'STOCK_IN').slice(0, 10);
  }, [data.stockAdjustments]);

  return (
    <div className="p-8 max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-8 pb-20">
      <div className="lg:col-span-2 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-black text-slate-800 tracking-tight">Stock Replenishment</h1>
            <p className="text-slate-500 font-medium">Add inbound inventory and process payments</p>
          </div>
          <div className="w-14 h-14 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-blue-900/20">
            <PackagePlus size={28} />
          </div>
        </div>

        <div className="bg-white p-10 rounded-[40px] border shadow-sm space-y-10">
          {/* Product Selector */}
          <div className="space-y-4">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">1. Select Product</label>
            {selectedProduct ? (
              <div className="flex items-center justify-between bg-blue-50 border border-blue-100 p-6 rounded-3xl animate-in fade-in slide-in-from-left-4">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 bg-white rounded-2xl border flex items-center justify-center overflow-hidden">
                    {selectedProduct.image ? <img src={selectedProduct.image} className="w-full h-full object-cover" /> : <PackagePlus className="text-blue-600" size={24} />}
                  </div>
                  <div>
                    <h3 className="font-black text-slate-800 text-lg">{selectedProduct.name}</h3>
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-tighter">Current Stock: <span className="text-blue-600">{selectedProduct.stock} units</span></p>
                  </div>
                </div>
                <button 
                  onClick={() => { setSelectedProduct(null); setSearchProduct(''); }}
                  className="px-4 py-2 text-xs font-black text-blue-600 hover:bg-blue-100 rounded-xl transition-colors"
                >
                  CHANGE PRODUCT
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                <input 
                  type="text" 
                  placeholder="Search products..."
                  className="w-full pl-12 pr-4 py-5 bg-slate-50 border-none rounded-3xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-lg"
                  value={searchProduct}
                  onChange={e => setSearchProduct(e.target.value)}
                />
                {filteredProducts.length > 0 && (
                  <div className="absolute top-full mt-4 left-0 w-full bg-white border rounded-[32px] shadow-2xl z-20 max-h-72 overflow-y-auto p-2">
                    {filteredProducts.map(p => (
                      <button 
                        key={p.id}
                        onClick={() => { setSelectedProduct(p); setUnitCost(p.costPrice); }}
                        className="w-full p-4 text-left flex items-center justify-between hover:bg-slate-50 rounded-2xl transition-colors"
                      >
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 bg-slate-100 rounded-xl border flex items-center justify-center overflow-hidden">
                              {p.image ? <img src={p.image} className="w-full h-full object-cover" /> : <PackagePlus className="text-slate-300" size={18} />}
                           </div>
                           <div>
                              <p className="font-black text-slate-800">{p.name}</p>
                              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{p.sku}</p>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="text-sm font-black text-blue-600">{p.stock} units</p>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">2. Quantity Received</label>
              <input 
                type="number" 
                className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl focus:ring-4 focus:ring-blue-100 outline-none font-black text-2xl text-blue-600"
                placeholder="0"
                value={quantity || ''}
                onChange={e => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
              />
            </div>

            <div className="space-y-4">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">3. Unit Cost ({currency})</label>
              <input 
                type="number" 
                className="w-full px-8 py-5 bg-slate-50 border-none rounded-3xl focus:ring-4 focus:ring-blue-100 outline-none font-black text-2xl text-slate-700"
                placeholder="0.00"
                value={unitCost || ''}
                onChange={e => setUnitCost(Math.max(0, parseFloat(e.target.value) || 0))}
              />
            </div>

            <div className="md:col-span-2 space-y-4 pt-4 border-t border-slate-50">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1 flex items-center gap-2">
                <Wallet size={12} /> 4. Payment Account (Money Source)
              </label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <select 
                  className={`w-full px-6 py-5 rounded-3xl focus:ring-4 outline-none font-bold text-lg appearance-none transition-all ${hasInsufficientFunds ? 'bg-red-50 border-red-200 focus:ring-red-100 text-red-700' : 'bg-slate-50 border-none focus:ring-blue-100 text-slate-700'}`}
                  value={selectedAccountId}
                  onChange={e => setSelectedAccountId(e.target.value)}
                >
                  <option value="">Choose Account...</option>
                  {data.accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance, currency, rate)})</option>
                  ))}
                </select>
                
                {selectedAccount && (
                   <div className={`p-5 rounded-3xl flex flex-col justify-center border-2 ${hasInsufficientFunds ? 'bg-red-50 border-red-200' : 'bg-emerald-50 border-emerald-100'}`}>
                      <p className="text-[8px] font-black uppercase tracking-widest opacity-60">Impact on Account</p>
                      <div className="flex items-center justify-between">
                         <span className="text-sm font-bold">New Balance:</span>
                         <span className={`text-lg font-black ${hasInsufficientFunds ? 'text-red-600' : 'text-emerald-700'}`}>
                            {formatCurrency(selectedAccount.balance - totalPurchaseCost, currency, rate)}
                         </span>
                      </div>
                      {hasInsufficientFunds && (
                        <div className="flex items-center gap-1 text-[8px] font-black text-red-600 mt-1 uppercase">
                          <AlertCircle size={10} /> Insufficient Balance
                        </div>
                      )}
                   </div>
                )}
              </div>
            </div>
          </div>

          <div className="pt-6">
            <button 
              onClick={handleStockIn}
              disabled={isProcessing || !selectedProduct || quantity <= 0 || !selectedAccountId || hasInsufficientFunds}
              className="w-full py-6 bg-blue-600 text-white rounded-[32px] font-black text-xl shadow-xl shadow-blue-900/20 hover:bg-blue-700 hover:shadow-2xl transition-all active:scale-95 disabled:opacity-50 flex flex-col items-center justify-center"
            >
              <div className="flex items-center gap-3">
                <CheckCircle2 size={24} />
                Complete Restock
              </div>
              <span className="text-[10px] opacity-70 font-bold uppercase mt-1">Total Cost: {formatCurrency(totalPurchaseCost, currency, rate)}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-8">
        <div className="bg-white p-8 rounded-[40px] border shadow-sm">
           <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 mb-6">
              <History size={20} className="text-slate-400" />
              Recent Restocks
           </h3>
           <div className="space-y-4">
              {recentStockIn.map(log => (
                <div key={log.id} className="p-4 rounded-2xl bg-slate-50 border border-transparent hover:border-blue-100 transition-all group">
                   <div className="flex justify-between items-start mb-2">
                      <p className="text-xs font-black text-slate-900 truncate max-w-[140px]">{log.productName}</p>
                      <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">+{log.quantity}</span>
                   </div>
                   <p className="text-[9px] text-slate-400 font-medium italic line-clamp-1">{log.reason}</p>
                </div>
              ))}
           </div>
        </div>

        <div className="bg-slate-900 p-8 rounded-[40px] text-white space-y-4 shadow-xl">
           <h4 className="font-black uppercase tracking-widest text-[10px] text-slate-500">Accounting Rules</h4>
           <p className="text-sm font-medium leading-relaxed opacity-80">
              When you "Complete Restock", the system will automatically:
           </p>
           <ul className="space-y-3 pt-2">
              <li className="flex items-center gap-2 text-xs font-bold"><div className="w-1 h-1 bg-emerald-500 rounded-full"/> Increment Product Stock</li>
              <li className="flex items-center gap-2 text-xs font-bold"><div className="w-1 h-1 bg-blue-500 rounded-full"/> Update Unit Cost Price</li>
              <li className="flex items-center gap-2 text-xs font-bold"><div className="w-1 h-1 bg-rose-500 rounded-full"/> Deduct Money from Ledger Account</li>
           </ul>
        </div>
      </div>
    </div>
  );
};

export default StockIn;