
import React, { useState, useMemo } from 'react';
import { AppData, Customer, Currency, UserRole } from '../types';
import { UserPlus, Search, Phone, Star, TrendingUp, History, X, Trash2, RotateCcw, Edit3, Crown, Medal, Award } from 'lucide-react';
import { formatCurrency, compressImage, generateId, sendWhatsAppReceipt, sendMonthlyDebtStatement } from '../lib/utils';
import CustomerReturnModal from './CustomerReturnModal';
import ConfirmModal from './ConfirmModal';

interface Props {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  addLog: (action: string, details: string) => void;
  currency: Currency;
  onLoadItemsToPOS?: (items: any[], customer?: any) => void;
}

const Customers: React.FC<Props> = ({ data, setData, addLog, currency, onLoadItemsToPOS }) => {
  const isCashier = data.settings?.currentUser?.role === UserRole.CASHIER;
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingCustomerId, setEditingCustomerId] = useState<string | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [formData, setFormData] = useState({ name: '', phone: '', photo: '' });
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [returnTxId, setReturnTxId] = useState<string | undefined>(undefined);
  const [deleteConfirm, setDeleteConfirm] = useState<{ title: string; message: string; action: () => void } | null>(null);

  const rate = data.settings.exchangeRate;

  // Rank map for customers based on debt amount
  const customerRankMap = useMemo(() => {
    const map = new Map<string, number>();
    const debtors = [...data.customers]
      .filter(c => (c.debtBalance || 0) > 0)
      .sort((a, b) => (b.debtBalance || 0) - (a.debtBalance || 0));
    debtors.forEach((c, idx) => {
      map.set(c.id, idx + 1);
    });
    return map;
  }, [data.customers]);

  const filtered = data.customers.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone.includes(search)
  );

  const openAddModal = () => {
    setEditingCustomerId(null);
    setFormData({ name: '', phone: '', photo: '' });
    setShowModal(true);
  };

  const openEditModal = (c: Customer, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingCustomerId(c.id);
    setFormData({ name: c.name, phone: c.phone, photo: c.photo || '' });
    setShowModal(true);
  };

  const saveCustomer = () => {
    if (!formData.name || !formData.phone) return alert("Fadlan geli Magaca iyo Telefoonka!");

    if (editingCustomerId) {
      // Edit existing customer
      setData(prev => ({
        ...prev,
        customers: prev.customers.map(c => 
          c.id === editingCustomerId 
            ? { ...c, name: formData.name, phone: formData.phone, photo: formData.photo }
            : c
        )
      }));

      addLog('Update Customer', `Updated details for customer: ${formData.name}`);

      if (selectedCustomer && selectedCustomer.id === editingCustomerId) {
        setSelectedCustomer(prev => prev ? { ...prev, name: formData.name, phone: formData.phone, photo: formData.photo } : null);
      }

      setShowModal(false);
      setEditingCustomerId(null);
      setFormData({ name: '', phone: '', photo: '' });
    } else {
      // Add new customer
      const existing = data.customers.find(c => c.phone === formData.phone);
      if (existing) return alert("Phone number already registered!");

      const newCust: Customer = {
        id: generateId(),
        name: formData.name,
        phone: formData.phone,
        photo: formData.photo,
        debtBalance: 0,
        loyaltyPoints: 0,
        history: []
      };

      setData(prev => ({ ...prev, customers: [...prev.customers, newCust] }));
      addLog('Add Customer', `New client registered: ${formData.name}`);
      setShowModal(false);
      setFormData({ name: '', phone: '', photo: '' });
    }
  };

  const handleDeleteCustomer = (id: string, name: string) => {
    if (isCashier) {
      alert("Ogolaansho ma haysatid inaad tirto macaamiilka (Cashier cannot delete customers). Fadlan la xiriir Admin ama Manager.");
      return;
    }
    setDeleteConfirm({
      title: "Ma hubtaa? (Delete Customer)",
      message: `Ma hubtaa inaad tirtirto macaamiilka: "${name}"?`,
      action: () => {
        const custToDelete = data.customers.find(c => c.id === id);
        setData(prev => {
          let updatedBin = prev.recycleBin || [];
          const updatedDeletedIds = { ...(prev.deletedIds || {}) };
          if (custToDelete) {
            updatedDeletedIds[id] = Date.now();
            const binItem = {
              id: generateId(),
              type: 'CUSTOMER' as const,
              deletedAt: Date.now(),
              title: custToDelete.name,
              description: `Phone: ${custToDelete.phone} • Debt Balance: $${custToDelete.debtBalance} • Loyalty Points: ${custToDelete.loyaltyPoints}`,
              originalData: custToDelete
            };
            updatedBin = [binItem, ...updatedBin];
          }
          return {
            ...prev,
            customers: prev.customers.filter(c => c.id !== id),
            recycleBin: updatedBin,
            deletedIds: updatedDeletedIds
          };
        });
        addLog('Customer Deleted', `Customer profile for ${name} was moved to Recycle Bin.`);
        setSelectedCustomer(null);
      }
    });
  };

  const handleDeleteTransaction = (tx: any) => {
    if (isCashier) {
      alert("Ogolaansho ma haysatid inaad tirto iibka (Cashier cannot delete transactions). Fadlan la xiriir Admin ama Manager.");
      return;
    }
    setDeleteConfirm({
      title: "Ma hubtaa? (Delete Invoice)",
      message: `Ma hubtaa inaad tirtirto Transaction #INV-${tx.id.slice(-5).toUpperCase()}? Financials iyo stock-gu wa dib loo celin doonaa.`,
      action: () => {
        executeDeleteTransaction(tx);
      }
    });
  };

  const executeDeleteTransaction = (tx: any) => {
    setData(prev => {
      // 1. Revert Product Stock
      const newProducts = prev.products.map(p => {
        const soldItem = tx.items.find((item: any) => item.id === p.id);
        return soldItem ? { ...p, stock: p.stock + soldItem.quantity } : p;
      });

      // 2. Revert Financials
      let updatedAccounts = [...prev.accounts];
      
      // Revert Inventory Asset
      const totalCost = tx.items.reduce((sum: number, item: any) => sum + (item.costPrice * item.quantity), 0);
      const invAcc = updatedAccounts.find(a => a.id === 'acc-inv' || a.name.toLowerCase().includes('inventory'));
      if (invAcc) {
        updatedAccounts = updatedAccounts.map(a => a.id === invAcc.id ? { ...a, balance: a.balance + totalCost } : a);
      }

      // Revert Income Accounts
      if (tx.paymentMethod === 'Partial Payment' && tx.paymentDetails) {
        const cashAcc = updatedAccounts.find(a => a.name.toLowerCase().includes('cash'));
        const bankAcc = updatedAccounts.find(a => a.name.toLowerCase().includes('bank'));
        const mobileAcc = updatedAccounts.find(a => a.name.toLowerCase().includes('mobile'));

        if (tx.paymentDetails.cash > 0 && cashAcc) {
          updatedAccounts = updatedAccounts.map(a => a.id === cashAcc.id ? { ...a, balance: Math.max(0, a.balance - tx.paymentDetails.cash) } : a);
        }
        if (tx.paymentDetails.bank > 0 && bankAcc) {
          updatedAccounts = updatedAccounts.map(a => a.id === bankAcc.id ? { ...a, balance: Math.max(0, a.balance - tx.paymentDetails.bank) } : a);
        }
        if (tx.paymentDetails.mobile > 0 && mobileAcc) {
          updatedAccounts = updatedAccounts.map(a => a.id === mobileAcc.id ? { ...a, balance: Math.max(0, a.balance - tx.paymentDetails.mobile) } : a);
        }
      } else if (tx.paymentMethod !== 'Debt' && tx.accountId) {
        updatedAccounts = updatedAccounts.map(a => a.id === tx.accountId ? { ...a, balance: Math.max(0, a.balance - tx.total) } : a);
      }

      // 3. Revert Customer
      const newCustomers = prev.customers.map(c => {
        if (tx.customerId && c.id === tx.customerId) {
          const debtToRevert = tx.paymentMethod === 'Debt' 
            ? tx.total 
            : (tx.paymentMethod === 'Partial Payment' && tx.paymentDetails ? tx.paymentDetails.debt : 0);
          
          return {
            ...c,
            debtBalance: Math.max(0, c.debtBalance - debtToRevert),
            loyaltyPoints: Math.max(0, c.loyaltyPoints - Math.floor(tx.total)),
            history: c.history.filter((id: string) => id !== tx.id)
          };
        }
        return c;
      });

      const binItem = {
        id: generateId(),
        type: 'TRANSACTION' as const,
        deletedAt: Date.now(),
        title: `Tx #${tx.id.slice(-5).toUpperCase()} ($${(tx.total || 0).toFixed(2)})`,
        description: `Items: ${tx.items?.length || 0} • Payment: ${tx.paymentMethod || 'N/A'} • Customer: ${tx.customerName || 'Walk-in'}`,
        originalData: tx
      };
      const updatedDeletedIds = { ...(prev.deletedIds || {}) };
      updatedDeletedIds[tx.id] = Date.now();

      return {
        ...prev,
        transactions: prev.transactions.filter(t => t.id !== tx.id),
        products: newProducts,
        accounts: updatedAccounts,
        customers: newCustomers,
        recycleBin: [binItem, ...(prev.recycleBin || [])],
        deletedIds: updatedDeletedIds
      };
    });

    addLog('Transaction Deleted', `Transaction #INV-${tx.id.slice(-5).toUpperCase()} deleted from customer history.`);
    
    // Update local selected customer state if needed
    if (selectedCustomer) {
      setSelectedCustomer(prev => {
        if (!prev) return null;
        return {
          ...prev,
          history: prev.history.filter(id => id !== tx.id)
        };
      });
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Search by name or phone..."
            className="w-full pl-12 pr-4 py-3 bg-white border rounded-2xl outline-none"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <button 
          onClick={openAddModal}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-bold flex items-center gap-2 shadow-md transition-all active:scale-95"
        >
          <UserPlus size={20} /> Register Customer
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {filtered.map(c => {
          const rankNum = customerRankMap.get(c.id);
          const hasDebt = (c.debtBalance || 0) > 0;
          const isGold = rankNum === 1;
          const isSilver = rankNum === 2;
          const isBronze = rankNum === 3;

          return (
          <div key={c.id} className={`bg-white rounded-3xl border shadow-sm p-6 space-y-6 hover:shadow-xl transition-all cursor-pointer relative group ${
            isGold ? 'border-amber-300 ring-2 ring-amber-400/20' : isSilver ? 'border-slate-300' : isBronze ? 'border-orange-200' : 'border-slate-200/80'
          }`} onClick={() => setSelectedCustomer(c)}>
            {/* Top ranking badge if debtor */}
            {rankNum !== undefined && hasDebt && (
              <div className="absolute -top-3 right-5 z-10">
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-black flex items-center gap-1 shadow-sm ${
                    isGold
                      ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 ring-2 ring-yellow-300'
                      : isSilver
                      ? 'bg-gradient-to-r from-slate-300 to-slate-400 text-slate-900 ring-2 ring-slate-200'
                      : isBronze
                      ? 'bg-gradient-to-r from-amber-700 to-amber-600 text-white ring-2 ring-amber-500'
                      : 'bg-slate-900 text-white'
                  }`}
                  title={`Deylaha #${rankNum} ee ugu sarreeya`}
                >
                  {isGold && <Crown size={11} />}
                  {isSilver && <Medal size={11} />}
                  {isBronze && <Award size={11} />}
                  #{rankNum} Deynta
                </span>
              </div>
            )}

            <div className="flex items-start justify-between gap-2">
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <div className="w-14 h-14 rounded-2xl bg-slate-100 overflow-hidden flex-shrink-0 border">
                  {c.photo ? <img src={c.photo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold text-xl">{c.name.charAt(0)}</div>}
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-slate-800 text-sm truncate">{c.name}</h3>
                  <p className="text-xs text-slate-500 font-bold flex items-center gap-1 mt-0.5">
                    <Phone size={10} /> {c.phone}
                  </p>
                </div>
              </div>

              {/* Action buttons on card: Edit & Delete */}
              <div className="flex items-center gap-1">
                <button
                  onClick={(e) => openEditModal(c, e)}
                  title="Wax ka baddal (Edit)"
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                >
                  <Edit3 size={16} />
                </button>
                {!isCashier && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteCustomer(c.id, c.name);
                    }}
                    title="Tirtir (Delete)"
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="bg-blue-50 p-3 rounded-2xl text-center">
                <p className="text-[10px] font-black text-blue-600 uppercase mb-1">Loyalty</p>
                <div className="flex items-center justify-center gap-1 text-blue-700 font-black">
                  <Star size={12} /> {c.loyaltyPoints}
                </div>
              </div>
              <div className={`p-3 rounded-2xl text-center ${c.debtBalance > 0 ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'}`}>
                <p className="text-[10px] font-black uppercase mb-1">Debt</p>
                <p className="text-xs font-black">{formatCurrency(c.debtBalance, currency, rate)}</p>
                {c.debtBalance > 0 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); sendMonthlyDebtStatement(c, data, currency, rate); }}
                    className="mt-1.5 px-2 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-[9px] font-black uppercase transition-all w-full flex items-center justify-center gap-1 shadow-sm"
                    title="U dir Total Lacagta lagu leeyahay WhatsApp"
                  >
                    💬 U Dir Total
                  </button>
                )}
              </div>
            </div>
          </div>
        );})}
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md p-8 space-y-6">
            <h3 className="text-2xl font-black text-slate-800">
              {editingCustomerId ? 'Wax ka baddal Macaamiilka (Edit Customer)' : 'Macaamiil Cusub (New Customer)'}
            </h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Magaca (Name)</label>
                <input 
                  className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold text-slate-800"
                  placeholder="e.g. Maxamed Cali"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Telefoonka (Phone)</label>
                <input 
                  className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl outline-none font-bold text-slate-800"
                  placeholder="e.g. +25261xxxxxxx"
                  value={formData.phone}
                  onChange={e => setFormData({...formData, phone: e.target.value})}
                />
              </div>
            </div>
            <div className="flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 font-bold text-slate-400">Cancel</button>
              <button onClick={saveCustomer} className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-black">
                {editingCustomerId ? 'Cusboaysii (Save)' : 'Diiwaangeli (Register)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedCustomer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-white/10 overflow-hidden border border-white/20">
                  {selectedCustomer.photo ? <img src={selectedCustomer.photo} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center text-white font-black text-2xl">{selectedCustomer.name.charAt(0)}</div>}
                </div>
                <div>
                  <h3 className="text-2xl font-black tracking-tight">{selectedCustomer.name}</h3>
                  <p className="opacity-75 font-bold text-sm">{selectedCustomer.phone}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                 <button 
                   onClick={(e) => openEditModal(selectedCustomer, e)}
                   className="p-3 bg-white/10 hover:bg-blue-600 text-white rounded-xl transition-all"
                   title="Wax ka baddal (Edit Customer)"
                 >
                   <Edit3 size={18} />
                 </button>
                 <button 
                   onClick={() => handleDeleteCustomer(selectedCustomer.id, selectedCustomer.name)}
                   className="p-3 bg-rose-500/20 text-rose-300 hover:bg-rose-500 hover:text-white rounded-xl transition-all"
                   title="Delete Customer Profile"
                 >
                   <Trash2 size={18} />
                 </button>
                 <button onClick={() => setSelectedCustomer(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors"><X size={24} /></button>
              </div>
            </div>

            <div className="p-8 grid grid-cols-3 gap-4">
              <div className="bg-slate-50 p-6 rounded-3xl text-center border">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Orders</p>
                <p className="text-2xl font-black text-slate-900">{selectedCustomer.history.length}</p>
              </div>
              <div className="bg-blue-50 p-6 rounded-3xl text-center border border-blue-100">
                <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Loyalty Points</p>
                <p className="text-2xl font-black text-blue-900">{selectedCustomer.loyaltyPoints}</p>
              </div>
              <div className="bg-amber-50 p-6 rounded-3xl text-center border border-amber-100">
                <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Balance Due</p>
                <p className="text-xl font-black text-amber-900 truncate">{formatCurrency(selectedCustomer.debtBalance, currency, rate)}</p>
              </div>
            </div>

            {/* Quick Actions: Cash Loan & Monthly Debt Statement */}
            <div className="px-8 pb-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                onClick={() => {
                  const amtStr = prompt(`Sii Dayn Lacag Cadaan ah Macaamiilka (${selectedCustomer.name}):\nGeli Xaddiga Lacagta ($):`);
                  if (!amtStr) return;
                  const amt = parseFloat(amtStr);
                  if (isNaN(amt) || amt <= 0) return alert("Fadlan geli xaddi sax ah!");
                  
                  const defaultCashAcc = data.accounts.find(a => a.name.toLowerCase().includes('cash')) || data.accounts[0];
                  if (!defaultCashAcc) return alert("Lama helin akoon lacagtu ka baxdo!");

                  const txId = generateId();
                  const loanTx = {
                    id: txId,
                    items: [{
                      id: 'cash-loan-item',
                      name: 'Dayn Lacag Cadaan ah (Cash Loan)',
                      sku: 'LOAN',
                      barcode: '',
                      costPrice: amt,
                      sellPrice: amt,
                      stock: 1,
                      category: 'Cash Loan',
                      quantity: 1
                    }],
                    subtotal: amt,
                    tax: 0,
                    total: amt,
                    currency: currency,
                    exchangeRate: rate,
                    paymentMethod: 'Debt' as any,
                    customerId: selectedCustomer.id,
                    timestamp: Date.now(),
                    type: 'CASH_LOAN' as const
                  };

                  setData(prev => ({
                    ...prev,
                    transactions: [...prev.transactions, loanTx],
                    customers: prev.customers.map(c => 
                      c.id === selectedCustomer.id 
                        ? { ...c, debtBalance: c.debtBalance + amt, history: [...c.history, txId] }
                        : c
                    ),
                    accounts: prev.accounts.map(a => 
                      a.id === defaultCashAcc.id ? { ...a, balance: a.balance - amt } : a
                    )
                  }));

                  addLog('Cash Loan Issued', `Dayn cash ah ($${amt}) loo bixiyay ${selectedCustomer.name}`);
                  alert(`🎉 ${selectedCustomer.name} waxaa la siiyay Dayn Lacag Cadaan ah oo dhan $${amt}`);
                  setSelectedCustomer(prev => prev ? { ...prev, debtBalance: prev.debtBalance + amt, history: [...prev.history, txId] } : null);
                }}
                className="py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-emerald-900/10 flex items-center justify-center gap-2 transition-all"
              >
                💵 Sii Dayn Lacag Cadaan
              </button>

              <button
                onClick={() => sendMonthlyDebtStatement(selectedCustomer, data, currency, rate)}
                className="py-3 bg-amber-600 hover:bg-amber-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-lg shadow-amber-900/10 flex items-center justify-center gap-2 transition-all"
                title="U Dir Total Lacagta lagu leeyahay (Dhamaadka bisha)"
              >
                💬 U Dir Total Lacagta (WhatsApp)
              </button>
            </div>

            <div className="p-8 space-y-4">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-black uppercase tracking-widest">
                <History size={14} /> Recent Transactions
              </div>
              <div className="space-y-2 max-h-60 overflow-y-auto pr-2">
                {selectedCustomer.history.length > 0 ? [...selectedCustomer.history].reverse().map(id => {
                  const tx = data.transactions.find(t => t.id === id);
                  if (!tx) return null;
                  return (
                    <div key={id} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border hover:bg-white hover:shadow-sm transition-all group">
                      <div className="flex items-center gap-4">
                        {!isCashier && (
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleDeleteTransaction(tx); }}
                            className="p-2 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all opacity-0 group-hover:opacity-100"
                            title="Delete Transaction"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                        <div>
                          <p className="text-sm font-black text-slate-800">#INV-{id.slice(-5).toUpperCase()}</p>
                          <p className="text-[10px] text-slate-500 font-bold">{new Date(tx.timestamp).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <button 
                          onClick={(e) => { e.stopPropagation(); sendWhatsAppReceipt(tx, data, currency, rate); }}
                          className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl text-[10px] font-black uppercase flex items-center gap-1 transition-all"
                          title="U Dir WhatsApp Risiidka"
                        >
                          💬 WhatsApp
                        </button>
                        <div className="text-right">
                          <p className="text-sm font-black text-blue-600">{formatCurrency(tx.total, currency, rate)}</p>
                          <p className="text-[10px] text-slate-400 font-bold uppercase">{tx.paymentMethod}</p>
                        </div>
                      </div>
                    </div>
                  );
                }) : (
                  <p className="text-center py-10 text-slate-300 font-bold italic">No transaction history found.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Customer Product Return Modal */}
      <CustomerReturnModal
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        data={data}
        setData={setData}
        addLog={addLog}
        currency={currency}
        preselectedTxId={returnTxId}
        onLoadItemsToPOS={onLoadItemsToPOS}
      />

      <ConfirmModal
        isOpen={!!deleteConfirm}
        title={deleteConfirm?.title || "Ma hubtaa? (Are you sure?)"}
        message={deleteConfirm?.message || "Ma hubtaa inaad tirtirto kankan?"}
        confirmText="Haa (Tirtir)"
        cancelText="Maya (Kansal)"
        onConfirm={() => {
          if (deleteConfirm) {
            deleteConfirm.action();
            setDeleteConfirm(null);
          }
        }}
        onClose={() => setDeleteConfirm(null)}
      />
    </div>
  );
};

export default Customers;
