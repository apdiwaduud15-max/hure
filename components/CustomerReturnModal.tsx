import React, { useState, useMemo } from 'react';
import { AppData, Currency, Transaction, CartItem, PaymentMethod } from '../types';
import { formatCurrency, generateId } from '../lib/utils';
import { 
  RotateCcw, 
  Search, 
  X, 
  CheckCircle2, 
  AlertCircle, 
  Printer, 
  ShoppingBag, 
  ShoppingCart,
  User, 
  Minus, 
  Plus, 
  DollarSign, 
  CreditCard, 
  Wallet, 
  Banknote, 
  Smartphone, 
  PackageCheck, 
  PackageX,
  FileText,
  Calendar,
  ArrowLeft
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  addLog: (action: string, details: string) => void;
  currency: Currency;
  preselectedTxId?: string;
  onLoadItemsToPOS?: (items: CartItem[], customer?: any) => void;
}

export const CustomerReturnModal: React.FC<Props> = ({
  isOpen,
  onClose,
  data,
  setData,
  addLog,
  currency,
  preselectedTxId,
  onLoadItemsToPOS
}) => {
  const rate = data.settings.exchangeRate;

  // Search invoice
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(() => {
    if (preselectedTxId) {
      return data.transactions.find(t => t.id === preselectedTxId && t.type === 'SALE') || null;
    }
    return null;
  });

  // Return quantities map: productId -> returnQty
  const [returnQuantities, setReturnQuantities] = useState<Record<string, number>>({});
  
  // Return configuration
  const [returnReason, setReturnReason] = useState<string>('Macmiilku waa ka noqday (Customer Changed Mind)');
  const [customReason, setCustomReason] = useState<string>('');
  const [restockOption, setRestockOption] = useState<'RESTOCK' | 'DAMAGE'>('RESTOCK');
  const [refundMethod, setRefundMethod] = useState<'CASH' | 'MOBILE' | 'BANK' | 'DEBT'>('CASH');
  
  // Processed state for printable return receipt
  const [processedReturnTx, setProcessedReturnTx] = useState<{
    returnId: string;
    originalTxId: string;
    customerName: string;
    returnedItems: Array<{ item: CartItem; returnQty: number; totalRefund: number }>;
    totalRefundAmount: number;
    refundMethod: string;
    reason: string;
    restocked: boolean;
    timestamp: number;
  } | null>(null);

  if (!isOpen) return null;

  // Filter eligible sales transactions
  const salesTransactions = useMemo(() => {
    return data.transactions.filter(t => {
      if (t.type !== 'SALE') return false;
      if (!searchQuery.trim()) return true;

      const q = searchQuery.toLowerCase();
      const invIdMatch = t.id.toLowerCase().includes(q) || `inv-${t.id.slice(-5)}`.toLowerCase().includes(q);
      const custName = data.customers.find(c => c.id === t.customerId)?.name || 'Walk-in Customer';
      const custMatch = custName.toLowerCase().includes(q);
      const itemMatch = t.items.some(i => i.name.toLowerCase().includes(q));

      return invIdMatch || custMatch || itemMatch;
    }).reverse();
  }, [data.transactions, data.customers, searchQuery]);

  // Handle transaction select
  const handleSelectTransaction = (tx: Transaction) => {
    setSelectedTx(tx);
    // Initialize return quantities to 0
    const initialQtys: Record<string, number> = {};
    tx.items.forEach(item => {
      initialQtys[item.id] = 0;
    });
    setReturnQuantities(initialQtys);

    // Auto set refund method if customer bought via debt
    if (tx.paymentMethod === PaymentMethod.DEBT) {
      setRefundMethod('DEBT');
    } else {
      setRefundMethod('CASH');
    }
  };

  const handleQtyChange = (productId: string, newQty: number, maxQty: number) => {
    const validQty = Math.max(0, Math.min(newQty, maxQty));
    setReturnQuantities(prev => ({
      ...prev,
      [productId]: validQty
    }));
  };

  // Calculate refund totals
  const returnSummary = useMemo(() => {
    if (!selectedTx) return { itemsToReturn: [], totalRefund: 0, totalItemsCount: 0 };

    let totalRefund = 0;
    let totalItemsCount = 0;
    const itemsToReturn: Array<{ item: CartItem; returnQty: number; itemRefund: number }> = [];

    selectedTx.items.forEach(item => {
      const returnQty = returnQuantities[item.id] || 0;
      if (returnQty > 0) {
        // Apportioned price calculation taking account of discount if any
        const itemDiscount = (selectedTx.discount || 0) > 0 && selectedTx.subtotal > 0
          ? (item.sellPrice * (selectedTx.discount! / selectedTx.subtotal))
          : 0;
        const effectivePrice = Math.max(0, item.sellPrice - itemDiscount);
        const itemRefund = effectivePrice * returnQty;

        totalRefund += itemRefund;
        totalItemsCount += returnQty;
        itemsToReturn.push({ item, returnQty, itemRefund });
      }
    });

    return { itemsToReturn, totalRefund, totalItemsCount };
  }, [selectedTx, returnQuantities]);

  const customerObj = selectedTx?.customerId 
    ? data.customers.find(c => c.id === selectedTx.customerId)
    : null;

  const getCustomerName = (tx: Transaction) => {
    if (!tx.customerId) return 'Walk-in Customer';
    return data.customers.find(c => c.id === tx.customerId)?.name || 'Walk-in Customer';
  };

  // Process the return
  const handleConfirmReturn = () => {
    if (!selectedTx) return;
    if (returnSummary.totalItemsCount === 0) {
      alert("❌ Fadlan dooro ugu yaraan hal alaab ah oo aad soo celinayso (Select at least 1 item to return).");
      return;
    }

    const finalReason = returnReason === 'Other / Sabab Kale' && customReason 
      ? customReason 
      : returnReason;

    const returnId = generateId();
    const timestamp = Date.now();

    setData(prev => {
      // 1. Update Product Stocks or Stock Adjustments
      const updatedProducts = prev.products.map(p => {
        const returnItem = returnSummary.itemsToReturn.find(r => r.item.id === p.id);
        if (returnItem && restockOption === 'RESTOCK') {
          return { ...p, stock: p.stock + returnItem.returnQty };
        }
        return p;
      });

      // If damaged, add stock adjustments for damaged returned items
      let updatedStockAdjustments = [...prev.stockAdjustments];
      if (restockOption === 'DAMAGE') {
        returnSummary.itemsToReturn.forEach(r => {
          updatedStockAdjustments.push({
            id: generateId(),
            productId: r.item.id,
            productName: r.item.name,
            type: 'DAMAGE',
            quantity: r.returnQty,
            timestamp: timestamp,
            reason: `Returned Damaged Item: ${finalReason} (Inv: INV-${selectedTx.id.slice(-5).toUpperCase()})`
          });
        });
      }

      // 2. Financial Accounts adjustment
      let updatedAccounts = [...prev.accounts];
      if (refundMethod === 'CASH') {
        const cashAcc = updatedAccounts.find(a => a.name.toLowerCase().includes('cash'));
        if (cashAcc) {
          updatedAccounts = updatedAccounts.map(a => a.id === cashAcc.id ? { ...a, balance: Math.max(0, a.balance - returnSummary.totalRefund) } : a);
        }
      } else if (refundMethod === 'MOBILE') {
        const mobileAcc = updatedAccounts.find(a => a.name.toLowerCase().includes('mobile'));
        if (mobileAcc) {
          updatedAccounts = updatedAccounts.map(a => a.id === mobileAcc.id ? { ...a, balance: Math.max(0, a.balance - returnSummary.totalRefund) } : a);
        }
      } else if (refundMethod === 'BANK') {
        const bankAcc = updatedAccounts.find(a => a.name.toLowerCase().includes('bank'));
        if (bankAcc) {
          updatedAccounts = updatedAccounts.map(a => a.id === bankAcc.id ? { ...a, balance: Math.max(0, a.balance - returnSummary.totalRefund) } : a);
        }
      }

      // 3. Customer Debt adjustment (if deduct debt chosen)
      let updatedCustomers = [...prev.customers];
      if (refundMethod === 'DEBT' && selectedTx.customerId) {
        updatedCustomers = updatedCustomers.map(c => {
          if (c.id === selectedTx.customerId) {
            return {
              ...c,
              debtBalance: Math.max(0, c.debtBalance - returnSummary.totalRefund)
            };
          }
          return c;
        });
      }

      // 4. Update or Record Transactions
      // Create a RETURN transaction entry for reporting
      const returnTransaction: Transaction = {
        id: returnId,
        items: returnSummary.itemsToReturn.map(r => ({
          ...r.item,
          quantity: r.returnQty
        })),
        subtotal: returnSummary.totalRefund,
        tax: 0,
        total: returnSummary.totalRefund,
        currency: currency,
        exchangeRate: rate,
        paymentMethod: refundMethod === 'DEBT' ? PaymentMethod.DEBT : PaymentMethod.CASH,
        customerId: selectedTx.customerId,
        timestamp: timestamp,
        type: 'RETURN',
        returnReason: finalReason,
        originalInvoiceId: selectedTx.id
      };

      // Also adjust remaining items/quantities in original transaction or keep it for audit
      const updatedTransactions = [returnTransaction, ...prev.transactions.map(t => {
        if (t.id === selectedTx.id) {
          const updatedItems = t.items.map(item => {
            const returned = returnQuantities[item.id] || 0;
            if (returned > 0) {
              return { ...item, quantity: Math.max(0, item.quantity - returned) };
            }
            return item;
          }).filter(item => item.quantity > 0);

          return {
            ...t,
            items: updatedItems,
            total: Math.max(0, t.total - returnSummary.totalRefund)
          };
        }
        return t;
      })];

      return {
        ...prev,
        products: updatedProducts,
        stockAdjustments: updatedStockAdjustments,
        accounts: updatedAccounts,
        customers: updatedCustomers,
        transactions: updatedTransactions
      };
    });

    addLog('Customer Return Processed', `Returned ${returnSummary.totalItemsCount} items (${formatCurrency(returnSummary.totalRefund, currency, rate)}) from INV-${selectedTx.id.slice(-5).toUpperCase()}`);

    // Set processed return receipt state
    setProcessedReturnTx({
      returnId,
      originalTxId: selectedTx.id,
      customerName: getCustomerName(selectedTx),
      returnedItems: returnSummary.itemsToReturn.map(r => ({
        item: r.item,
        returnQty: r.returnQty,
        totalRefund: r.itemRefund
      })),
      totalRefundAmount: returnSummary.totalRefund,
      refundMethod: refundMethod === 'DEBT' ? 'Deducted from Debt Balance' : `${refundMethod} Refund`,
      reason: finalReason,
      restocked: restockOption === 'RESTOCK',
      timestamp
    });
  };

  const handlePrintReturnReceipt = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm overflow-y-auto">
      <div className="bg-white rounded-[32px] max-w-3xl w-full p-6 md:p-8 space-y-6 shadow-2xl relative my-8 max-h-[90vh] overflow-y-auto border border-slate-200">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4 no-print">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
              <RotateCcw size={24} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">
                Soo Celinta Alaabta Iibsan (Customer Product Return)
              </h2>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Kudhar stock-ga alaabta macmiilku soo celiyay ama ka jar deynta / cadaanka
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-500 flex items-center justify-center font-bold transition-all"
          >
            <X size={20} />
          </button>
        </div>

        {/* View Mode: Return Receipt Printable */}
        {processedReturnTx ? (
          <div className="space-y-6">
            <div className="p-6 bg-emerald-50 border border-emerald-200 rounded-3xl text-center space-y-2 no-print">
              <div className="w-12 h-12 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto font-black shadow-lg shadow-emerald-500/30">
                <CheckCircle2 size={26} />
              </div>
              <h3 className="text-lg font-black text-emerald-950">Soo Celinta Alaabta Waa La Diwaan Geliyay!</h3>
              <p className="text-xs font-semibold text-emerald-700">
                Stock-ga waa lagu kordhiyay, lacagtiina waxaa lagu bixiyay habka {processedReturnTx.refundMethod}.
              </p>
            </div>

            {/* Printable Receipt Card */}
            <div className="p-6 md:p-8 bg-slate-50 border border-slate-200 rounded-3xl space-y-6 print-container">
              <div className="text-center border-b pb-4 space-y-1">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Xaysimo Supermarket</h3>
                <p className="text-xs font-bold text-slate-500">RISIDHKA SOO CELINTA ALAABTA (RETURN RECEIPT)</p>
                <p className="text-[10px] font-mono text-slate-400">
                  Return ID: RET-{processedReturnTx.returnId.slice(-6).toUpperCase()} | Inv Ref: INV-{processedReturnTx.originalTxId.slice(-5).toUpperCase()}
                </p>
                <p className="text-[10px] font-mono text-slate-400">
                  Taariikhda: {new Date(processedReturnTx.timestamp).toLocaleString()}
                </p>
              </div>

              <div className="flex justify-between items-center text-xs font-bold text-slate-700 bg-white p-3 rounded-xl border">
                <span>Macmiilka: <strong className="text-slate-900">{processedReturnTx.customerName}</strong></span>
                <span>Habka Bixinta: <strong className="text-blue-700">{processedReturnTx.refundMethod}</strong></span>
              </div>

              <div className="space-y-2">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-400">Alaabta La Soo Celiyay:</h4>
                <div className="divide-y divide-slate-200 bg-white rounded-2xl border">
                  {processedReturnTx.returnedItems.map((r, i) => (
                    <div key={i} className="p-3 flex items-center justify-between text-xs font-bold">
                      <div>
                        <p className="text-slate-900 font-black">{r.item.name}</p>
                        <p className="text-[10px] text-slate-400">Tirada: {r.returnQty} x {formatCurrency(r.item.sellPrice, currency, rate)}</p>
                      </div>
                      <p className="font-mono font-black text-slate-900">
                        {formatCurrency(r.totalRefund, currency, rate)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-4 bg-slate-900 text-white rounded-2xl flex items-center justify-between font-black">
                <span className="text-xs uppercase tracking-wider">Wadarta Lacagta Soo Celinta:</span>
                <span className="text-xl font-mono text-emerald-400">
                  {formatCurrency(processedReturnTx.totalRefundAmount, currency, rate)}
                </span>
              </div>

              <div className="text-[11px] font-semibold text-slate-500 space-y-1">
                <p>• Sababta: <strong className="text-slate-800">{processedReturnTx.reason}</strong></p>
                <p>• Status-ka Stock-ga: <strong className="text-slate-800">{processedReturnTx.restocked ? 'Kudhar Stock-ga Dukaanka (Restocked)' : 'Burbur / Damage Logged'}</strong></p>
              </div>
            </div>

            {/* Print & Close & Load to POS Buttons */}
            <div className="flex flex-wrap items-center justify-end gap-3 no-print">
              {onLoadItemsToPOS && (
                <button
                  onClick={() => {
                    const itemsToLoad: CartItem[] = processedReturnTx.returnedItems.map(r => ({
                      ...r.item,
                      quantity: r.returnQty
                    }));
                    onLoadItemsToPOS(itemsToLoad, customerObj);
                    onClose();
                  }}
                  className="px-5 py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black rounded-2xl text-xs flex items-center gap-2 shadow-md transition-all"
                >
                  <ShoppingCart size={16} /> Gee Salada POS-ka (Load to POS)
                </button>
              )}
              <button
                onClick={handlePrintReturnReceipt}
                className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow"
              >
                <Printer size={16} /> Daabac Risidhka (Print)
              </button>
              <button
                onClick={onClose}
                className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl text-xs font-black shadow"
              >
                Dhameey (Done)
              </button>
            </div>
          </div>
        ) : !selectedTx ? (
          /* Step 1: Search & Select Sale Transaction */
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="Raadi lambarka invoice-ka (e.g. INV-12345), magaca macmiilka ama alaabta..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 border rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500/20"
              />
            </div>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block px-1">
                Dooro Risidhka Iibka (Select Transaction to Return From):
              </span>

              {salesTransactions.length > 0 ? (
                salesTransactions.map(tx => {
                  const custName = getCustomerName(tx);
                  const dt = new Date(tx.timestamp);

                  return (
                    <div
                      key={tx.id}
                      onClick={() => handleSelectTransaction(tx)}
                      className="p-4 bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 rounded-2xl transition-all cursor-pointer flex flex-col sm:flex-row sm:items-center justify-between gap-3 group"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2.5 py-0.5 bg-slate-900 text-white rounded-lg text-[10px] font-mono font-black">
                            INV-{tx.id.slice(-5).toUpperCase()}
                          </span>
                          <span className="text-xs font-black text-slate-900">{custName}</span>
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-black uppercase ${
                            tx.paymentMethod === PaymentMethod.DEBT ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'
                          }`}>
                            {tx.paymentMethod}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 font-semibold">
                          {tx.items.length} Nooc o Alaab ah • {dt.toLocaleDateString()} {dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-3 border-t sm:border-t-0 pt-2 sm:pt-0">
                        <span className="text-sm font-mono font-black text-slate-900">
                          {formatCurrency(tx.total, currency, rate)}
                        </span>
                        <button className="px-3 py-1.5 bg-blue-600 group-hover:bg-blue-500 text-white rounded-xl text-xs font-black shadow transition-all">
                          Dooro (Select)
                        </button>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="p-12 text-center text-slate-400 font-bold opacity-60">
                  <ShoppingBag size={36} className="mx-auto mb-2 text-slate-300" />
                  <p>Ma jiraan nooc iibsi ah oo u dhigma raadintaada.</p>
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Step 2: Configure Returned Items & Refund Method */
          <div className="space-y-6">
            {/* Back Button & Selected Invoice Summary */}
            <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setSelectedTx(null)}
                  className="p-2 bg-white hover:bg-slate-100 border rounded-xl text-slate-700 font-bold transition-all text-xs flex items-center gap-1"
                >
                  <ArrowLeft size={16} /> Baddal Risidhka
                </button>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-black text-xs text-blue-700">INV-{selectedTx.id.slice(-5).toUpperCase()}</span>
                    <span className="text-xs font-black text-slate-900">• {getCustomerName(selectedTx)}</span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-semibold">
                    Taariikhda: {new Date(selectedTx.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>

              <span className="text-sm font-mono font-black text-slate-900">
                Total: {formatCurrency(selectedTx.total, currency, rate)}
              </span>
            </div>

            {/* List items to return */}
            <div className="space-y-3">
              <h3 className="text-xs font-black uppercase tracking-wider text-slate-400">
                Doorashada Tirada Alaabta La Soo Celinayo (Select Items & Quantities):
              </h3>

              <div className="divide-y divide-slate-100 border rounded-2xl bg-white overflow-hidden shadow-sm">
                {selectedTx.items.map(item => {
                  const currentReturnQty = returnQuantities[item.id] || 0;

                  return (
                    <div key={item.id} className="p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:bg-slate-50/60 transition-colors">
                      <div className="space-y-1 min-w-0 flex-1">
                        <h4 className="font-black text-sm text-slate-900">{item.name}</h4>
                        <div className="flex items-center gap-2 text-xs text-slate-500 font-semibold">
                          <span>Qiimaha: <strong className="text-slate-800">{formatCurrency(item.sellPrice, currency, rate)}</strong></span>
                          <span>•</span>
                          <span>Wadar Iibsaday: <strong className="text-blue-700">{item.quantity} {item.unit || 'PCS'}</strong></span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between sm:justify-end gap-4">
                        {/* Quantity Counter */}
                        <div className="flex items-center border rounded-2xl p-1 bg-slate-50 shadow-inner">
                          <button
                            onClick={() => handleQtyChange(item.id, currentReturnQty - 1, item.quantity)}
                            disabled={currentReturnQty <= 0}
                            className="w-8 h-8 rounded-xl bg-white disabled:opacity-40 hover:bg-slate-200 text-slate-800 flex items-center justify-center font-bold shadow-sm transition-all"
                          >
                            <Minus size={14} />
                          </button>
                          <span className="w-12 text-center font-black text-sm text-slate-900 font-mono">
                            {currentReturnQty}
                          </span>
                          <button
                            onClick={() => handleQtyChange(item.id, currentReturnQty + 1, item.quantity)}
                            disabled={currentReturnQty >= item.quantity}
                            className="w-8 h-8 rounded-xl bg-blue-600 disabled:opacity-40 hover:bg-blue-500 text-white flex items-center justify-center font-bold shadow-sm transition-all"
                          >
                            <Plus size={14} />
                          </button>
                        </div>

                        <div className="text-right min-w-[90px]">
                          <span className="text-[10px] text-slate-400 uppercase font-black block">Refunding</span>
                          <span className="font-mono font-black text-sm text-amber-600">
                            {formatCurrency(item.sellPrice * currentReturnQty, currency, rate)}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Options: Reason, Restock, Refund Method */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Reason & Restock */}
              <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Sababta Soo Celinta (Return Reason)
                </span>
                
                <select
                  value={returnReason}
                  onChange={e => setReturnReason(e.target.value)}
                  className="w-full p-2.5 bg-white border rounded-xl text-xs font-bold text-slate-800 outline-none"
                >
                  <option value="Macmiilku waa ka noqday (Customer Changed Mind)">Macmiilku waa ka noqday (Customer Changed Mind)</option>
                  <option value="Alaab cillad leh (Defective / Damaged Item)">Alaab cillad leh (Defective / Damaged Item)</option>
                  <option value="Waqtigu ka dhacay (Expired Product)">Waqtigu ka dhacay (Expired Product)</option>
                  <option value="Alaab khaldan ama nooc kale (Wrong Item Delivered)">Alaab khaldan ama nooc kale (Wrong Item)</option>
                  <option value="Other / Sabab Kale">Sabab Kale (Other Custom Reason)</option>
                </select>

                {returnReason === 'Other / Sabab Kale' && (
                  <input
                    type="text"
                    placeholder="Qoor sababta gaaar ah..."
                    value={customReason}
                    onChange={e => setCustomReason(e.target.value)}
                    className="w-full p-2.5 bg-white border rounded-xl text-xs font-bold outline-none"
                  />
                )}

                <div className="pt-2 border-t space-y-1.5">
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                    Restock Status (Condition):
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRestockOption('RESTOCK')}
                      className={`p-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 border transition-all ${
                        restockOption === 'RESTOCK' ? 'bg-emerald-600 text-white border-emerald-600 shadow' : 'bg-white text-slate-700'
                      }`}
                    >
                      <PackageCheck size={14} /> Re-add to Stock
                    </button>
                    <button
                      type="button"
                      onClick={() => setRestockOption('DAMAGE')}
                      className={`p-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 border transition-all ${
                        restockOption === 'DAMAGE' ? 'bg-red-600 text-white border-red-600 shadow' : 'bg-white text-slate-700'
                      }`}
                    >
                      <PackageX size={14} /> Mark Damaged
                    </button>
                  </div>
                </div>
              </div>

              {/* Refund Method */}
              <div className="space-y-3 p-4 bg-slate-50 rounded-2xl border flex flex-col justify-between">
                <div>
                  <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block mb-2">
                    Habka Bixinta Lacagta Soo Celinta (Refund Method):
                  </span>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setRefundMethod('CASH')}
                      className={`p-3 rounded-xl text-xs font-black flex items-center gap-2 border transition-all ${
                        refundMethod === 'CASH' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-white text-slate-700'
                      }`}
                    >
                      <Banknote size={16} /> Cash Refund
                    </button>

                    <button
                      type="button"
                      onClick={() => setRefundMethod('MOBILE')}
                      className={`p-3 rounded-xl text-xs font-black flex items-center gap-2 border transition-all ${
                        refundMethod === 'MOBILE' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-white text-slate-700'
                      }`}
                    >
                      <Smartphone size={16} /> Mobile Money
                    </button>

                    <button
                      type="button"
                      onClick={() => setRefundMethod('BANK')}
                      className={`p-3 rounded-xl text-xs font-black flex items-center gap-2 border transition-all ${
                        refundMethod === 'BANK' ? 'bg-blue-600 text-white border-blue-600 shadow' : 'bg-white text-slate-700'
                      }`}
                    >
                      <Wallet size={16} /> Bank Refund
                    </button>

                    <button
                      type="button"
                      onClick={() => setRefundMethod('DEBT')}
                      disabled={!selectedTx.customerId}
                      className={`p-3 rounded-xl text-xs font-black flex items-center gap-2 border transition-all ${
                        !selectedTx.customerId 
                          ? 'opacity-40 bg-slate-100 text-slate-400 cursor-not-allowed'
                          : refundMethod === 'DEBT' ? 'bg-purple-600 text-white border-purple-600 shadow' : 'bg-white text-slate-700'
                      }`}
                      title={!selectedTx.customerId ? 'Waxaa loogu talogalay macmiil diwaan gashan oo oo deyn leh' : ''}
                    >
                      <CreditCard size={16} /> Ka Jar Deynta
                    </button>
                  </div>
                </div>

                {refundMethod === 'DEBT' && customerObj && (
                  <p className="text-[11px] font-bold text-purple-700 bg-purple-50 p-2.5 rounded-xl border border-purple-100 mt-2">
                    💡 Lacagtan waxaa laga jari doonaa Deynta uu ku leeyahay macmiilka {customerObj.name} (Deynta Hada: {formatCurrency(customerObj.debtBalance, currency, rate)}).
                  </p>
                )}
              </div>
            </div>

            {/* Total Refund Banner & Process Button */}
            <div className="p-5 bg-slate-900 text-white rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xl">
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                  Wadarta Lacagta Soo Celinta (Total Refund Amount)
                </span>
                <p className="text-2xl md:text-3xl font-mono font-black text-amber-400">
                  {formatCurrency(returnSummary.totalRefund, currency, rate)}
                </p>
                <p className="text-[10px] text-slate-400 font-bold mt-0.5">
                  {returnSummary.totalItemsCount} Xabbo oo alaab ah ayaa la soo celinayaa
                </p>
              </div>

              <button
                onClick={handleConfirmReturn}
                disabled={returnSummary.totalItemsCount === 0}
                className="px-6 py-4 bg-emerald-500 hover:bg-emerald-400 disabled:opacity-50 text-slate-950 font-black text-sm rounded-xl shadow-lg transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                <RotateCcw size={18} /> Xaqiiji Soo Celinta Alaabta (Process Return)
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default CustomerReturnModal;
