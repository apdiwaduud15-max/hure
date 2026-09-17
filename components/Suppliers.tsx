
import React, { useState, useMemo } from 'react';
import { AppData, Supplier, Currency, Transaction, PaymentMethod } from '../types';
import { 
  Truck, 
  Search, 
  Phone, 
  Plus, 
  Trash2, 
  Edit2, 
  ArrowUpRight, 
  ArrowDownLeft, 
  Landmark, 
  CreditCard, 
  History, 
  AlertCircle, 
  DollarSign, 
  Check, 
  X, 
  Calendar, 
  FileText, 
  Printer, 
  Wallet, 
  Smartphone, 
  MessageSquare, 
  Clock, 
  CheckCircle2, 
  PlusCircle, 
  Sparkles,
  ShoppingBag,
  Layers
} from 'lucide-react';
import { formatCurrency, generateId } from '../lib/utils';
import DailySupplierPurchasesTable from './DailySupplierPurchasesTable';
import ConfirmModal from './ConfirmModal';

interface Props {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  addLog: (action: string, details: string) => void;
  currency: Currency;
}

const getLocalDateTimeString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const Suppliers: React.FC<Props> = ({ data, setData, addLog, currency }) => {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ 
    name: '', 
    contact: '', 
    phone: '', 
    initialDebt: 0,
    date: getLocalDateTimeString(),
    reason: 'Diiwaangelin & Deyn Hore'
  });

  // Edit Supplier Modal state
  const [editModalSupplier, setEditModalSupplier] = useState<Supplier | null>(null);
  const [editFormData, setEditFormData] = useState({ 
    name: '', 
    contact: '', 
    phone: '', 
    balance: 0,
    reason: 'Wax ka beddel macluumaadka'
  });

  // Debt Payment Modal state
  const [payModalSupplier, setPayModalSupplier] = useState<Supplier | null>(null);
  const [payAmount, setPayAmount] = useState<number>(0);
  const [payAccountId, setPayAccountId] = useState<string>('');
  const [payPaymentMethod, setPayPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [payDate, setPayDate] = useState<string>(getLocalDateTimeString());
  const [payReason, setPayReason] = useState<string>('Bixinta Deynta Supplier-ka');
  const [payNote, setPayNote] = useState<string>('');

  // Add Debt Modal state
  const [addDebtSupplier, setAddDebtSupplier] = useState<Supplier | null>(null);
  const [debtAmount, setDebtAmount] = useState<number>(0);
  const [debtDate, setDebtDate] = useState<string>(getLocalDateTimeString());
  const [debtReason, setDebtReason] = useState<string>('Alaab amaah lagu soo qaatay');
  const [debtInvoiceRef, setDebtInvoiceRef] = useState<string>('');

  // Global Quick Action Modals (Top Action buttons)
  const [showGlobalPayModal, setShowGlobalPayModal] = useState(false);
  const [globalPaySupplierId, setGlobalPaySupplierId] = useState<string>('');

  const [showGlobalAddDebtModal, setShowGlobalAddDebtModal] = useState(false);
  const [globalAddDebtSupplierId, setGlobalAddDebtSupplierId] = useState<string>('');

  // Supplier Statement / Tale-ka Modal
  const [statementSupplier, setStatementSupplier] = useState<Supplier | null>(null);

  const [deleteConfirmSupplier, setDeleteConfirmSupplier] = useState<{ id: string; name: string } | null>(null);

  const rate = data.settings.exchangeRate;

  const filtered = useMemo(() => {
    return data.suppliers.filter(s => 
      s.name.toLowerCase().includes(search.toLowerCase()) || 
      s.phone.includes(search) ||
      (s.contact && s.contact.toLowerCase().includes(search.toLowerCase()))
    );
  }, [data.suppliers, search]);

  const totalDebt = useMemo(() => {
    return data.suppliers.reduce((acc, s) => acc + (s.balance > 0 ? s.balance : 0), 0);
  }, [data.suppliers]);

  // Set default cash account whenever payment modal opens
  const openPayModal = (s: Supplier, defaultAmt?: number) => {
    setPayModalSupplier(s);
    setPayAmount(defaultAmt !== undefined ? defaultAmt : s.balance);
    const defaultAcc = data.accounts.find(a => a.name.toLowerCase().includes('cash'))?.id || data.accounts[0]?.id || '';
    setPayAccountId(defaultAcc);
    setPayPaymentMethod(PaymentMethod.CASH);
    setPayDate(getLocalDateTimeString());
    setPayReason(`Bixinta Deynta: ${s.name}`);
    setPayNote('');
  };

  const openAddDebtModal = (s: Supplier) => {
    setAddDebtSupplier(s);
    setDebtAmount(0);
    setDebtDate(getLocalDateTimeString());
    setDebtReason('Alaab amaah lagu soo qaatay');
    setDebtInvoiceRef('');
  };

  const saveSupplier = () => {
    if (!formData.name.trim() || !formData.phone.trim()) {
      return alert("Fadlan geli Magaca iyo Telefoonka Supplier-ka!");
    }
    
    const suppId = generateId();
    const initDebt = Math.max(0, formData.initialDebt || 0);
    const suppTimestamp = formData.date ? new Date(formData.date).getTime() : Date.now();

    const newSupp: Supplier = {
      id: suppId,
      name: formData.name.trim(),
      contact: formData.contact.trim(),
      phone: formData.phone.trim(),
      balance: initDebt
    };

    // If initial debt is provided, record it as a transaction for transparency
    let newTransactions = [...data.transactions];
    if (initDebt > 0) {
      const txId = generateId();
      const initialDebtTx: Transaction = {
        id: txId,
        items: [{
          id: `supp-init-${txId}`,
          name: `Deyn Hore / Initial Debt Balance (${newSupp.name})`,
          sku: 'SUPPLIER_INITIAL_DEBT',
          barcode: '',
          costPrice: initDebt,
          sellPrice: initDebt,
          stock: 1,
          category: 'Supplier Debt',
          quantity: 1
        }],
        subtotal: initDebt,
        tax: 0,
        total: initDebt,
        currency: currency,
        exchangeRate: rate,
        paymentMethod: PaymentMethod.DEBT,
        supplierId: suppId,
        supplierName: newSupp.name,
        timestamp: suppTimestamp,
        type: 'PURCHASE',
        notes: `Initial Supplier Debt: ${formData.reason || 'Deyn Hore oo lagu soo bilaabay'}`
      };
      newTransactions = [initialDebtTx, ...newTransactions];
    }

    setData(prev => ({ 
      ...prev, 
      suppliers: [...prev.suppliers, newSupp],
      transactions: newTransactions,
      lastModified: Date.now() 
    }));

    addLog(
      'Add Supplier', 
      `New supplier registered: ${newSupp.name}. Phone: ${newSupp.phone}. Initial Debt: ${formatCurrency(initDebt, currency, rate)}. Reason: ${formData.reason}`
    );
    setShowModal(false);
    setFormData({ 
      name: '', 
      contact: '', 
      phone: '', 
      initialDebt: 0,
      date: getLocalDateTimeString(),
      reason: 'Diiwaangelin & Deyn Hore'
    });
  };

  const handleOpenEdit = (s: Supplier) => {
    setEditModalSupplier(s);
    setEditFormData({
      name: s.name,
      contact: s.contact || '',
      phone: s.phone || '',
      balance: s.balance || 0,
      reason: 'Wax ka beddel macluumaadka'
    });
  };

  const handleUpdateSupplier = () => {
    if (!editModalSupplier) return;
    if (!editFormData.name.trim()) return alert("Fadlan geli magaca supplier-ka!");
    if (!editFormData.phone.trim()) return alert("Fadlan geli telifoonka supplier-ka!");

    const oldName = editModalSupplier.name;
    const oldBalance = editModalSupplier.balance;
    const newName = editFormData.name.trim();
    const newContact = editFormData.contact.trim();
    const newPhone = editFormData.phone.trim();
    const newBalance = Math.max(0, editFormData.balance || 0);

    setData(prev => ({
      ...prev,
      suppliers: prev.suppliers.map(s => 
        s.id === editModalSupplier.id 
          ? { ...s, name: newName, contact: newContact, phone: newPhone, balance: newBalance }
          : s
      ),
      lastModified: Date.now()
    }));

    addLog(
      'Edit Supplier',
      `Updated supplier ${oldName} -> ${newName}. Phone: ${newPhone}. Balance: ${formatCurrency(oldBalance, currency, rate)} -> ${formatCurrency(newBalance, currency, rate)}. Sababta: ${editFormData.reason}`
    );

    setEditModalSupplier(null);
  };

  // Pay Supplier Debt Execution
  const handlePaySupplierDebt = () => {
    if (!payModalSupplier || payAmount <= 0) return alert("Fadlan geli xaddi lacag bixin sax ah!");
    if (!payAccountId) return alert("Fadlan dooro sandaaqada ama akoonka lacagta ka baxayso!");

    const account = data.accounts.find(a => a.id === payAccountId);
    if (!account) return alert("Akoonka la doortay lama helin.");
    if (account.balance < payAmount) {
      if (!confirm(`Digniin: Akoonka ${account.name} waxa ku jira ${formatCurrency(account.balance, currency, rate)}, oo ka yar lacagta ${formatCurrency(payAmount, currency, rate)}. Ma rabtaa inaad sii waddo?`)) {
        return;
      }
    }

    const txId = generateId();
    const payTimestamp = payDate ? new Date(payDate).getTime() : Date.now();
    const fullNotes = `Bixinta Deynta Supplier-ka: Paid ${formatCurrency(payAmount, currency, rate)} to ${payModalSupplier.name} from ${account.name}. Sababta: ${payReason || 'Supplier Debt Settlement'}. ${payNote ? `[Note: ${payNote}]` : ''}`;

    const supplierPaymentTx: Transaction = {
      id: txId,
      items: [{
        id: `supp-pay-${txId}`,
        name: `Bixinta Deynta Supplier-ka (${payModalSupplier.name})`,
        sku: 'SUPPLIER_PAYMENT',
        barcode: '',
        costPrice: payAmount,
        sellPrice: payAmount,
        stock: 1,
        category: 'Supplier Payment',
        quantity: 1
      }],
      subtotal: payAmount,
      tax: 0,
      total: payAmount,
      currency: currency,
      exchangeRate: rate,
      paymentMethod: payPaymentMethod,
      accountId: payAccountId,
      supplierId: payModalSupplier.id,
      supplierName: payModalSupplier.name,
      timestamp: payTimestamp,
      type: 'EXPENSE',
      notes: fullNotes
    };

    setData(prev => ({
      ...prev,
      transactions: [supplierPaymentTx, ...prev.transactions],
      suppliers: prev.suppliers.map(s => 
        s.id === payModalSupplier.id ? { ...s, balance: Math.max(0, s.balance - payAmount) } : s
      ),
      accounts: prev.accounts.map(a => 
        a.id === payAccountId ? { ...a, balance: a.balance - payAmount } : a
      )
    }));

    addLog(
      'Supplier Debt Payment', 
      `Paid ${formatCurrency(payAmount, currency, rate)} to supplier ${payModalSupplier.name} from account ${account.name}. Reason: ${payReason}. Date: ${new Date(payTimestamp).toLocaleString()}`
    );

    alert(`🎉 WAA LA KAYDIYAY!\nWaxaad ${formatCurrency(payAmount, currency, rate)} ka bixisay deynta ${payModalSupplier.name}, waxaana laga jaray akoonka ${account.name}.`);
    setPayModalSupplier(null);
    setPayAmount(0);
    setPayAccountId('');
    setPayNote('');
  };

  // Add Supplier Debt Execution
  const handleAddSupplierDebt = () => {
    if (!addDebtSupplier || debtAmount <= 0) return alert("Fadlan geli xaddi deyn ah oo sax ah!");

    const txId = generateId();
    const debtTimestamp = debtDate ? new Date(debtDate).getTime() : Date.now();
    const fullReason = `${debtReason || 'Alaab amaah lagu soo qaatay'}${debtInvoiceRef ? ` (Ref/Invoice: ${debtInvoiceRef})` : ''}`;

    const debtTransaction: Transaction = {
      id: txId,
      items: [{
        id: `supp-debt-${txId}`,
        name: `Ku darid Deyn Supplier (${addDebtSupplier.name})`,
        sku: 'SUPPLIER_DEBT_ADDED',
        barcode: '',
        costPrice: debtAmount,
        sellPrice: debtAmount,
        stock: 1,
        category: 'Supplier Debt',
        quantity: 1
      }],
      subtotal: debtAmount,
      tax: 0,
      total: debtAmount,
      currency: currency,
      exchangeRate: rate,
      paymentMethod: PaymentMethod.DEBT,
      supplierId: addDebtSupplier.id,
      supplierName: addDebtSupplier.name,
      timestamp: debtTimestamp,
      type: 'PURCHASE',
      notes: `Supplier Debt Added: ${formatCurrency(debtAmount, currency, rate)} - Sababta: ${fullReason}`
    };

    setData(prev => ({
      ...prev,
      transactions: [debtTransaction, ...prev.transactions],
      suppliers: prev.suppliers.map(s => 
        s.id === addDebtSupplier.id ? { ...s, balance: s.balance + debtAmount } : s
      )
    }));

    addLog(
      'Supplier Debt Added', 
      `Recorded additional debt of ${formatCurrency(debtAmount, currency, rate)} owed to supplier ${addDebtSupplier.name}. Reason: ${fullReason}. Date: ${new Date(debtTimestamp).toLocaleString()}`
    );

    alert(`🎉 WAA LA DIIWAANGELIYAY!\nDeynta cusub ee ${formatCurrency(debtAmount, currency, rate)} waxaa lagu daray xisaabta supplier-ka ${addDebtSupplier.name}.`);
    setAddDebtSupplier(null);
    setDebtAmount(0);
    setDebtReason('Alaab amaah lagu soo qaatay');
    setDebtInvoiceRef('');
  };

  const deleteSupplier = (id: string, name: string) => {
    setDeleteConfirmSupplier({ id, name });
  };

  // Supplier Statement Transactions Helper
  const supplierLedger = useMemo(() => {
    if (!statementSupplier) return { transactions: [], adjustments: [] };
    
    // Find all transactions, adjustments, and purchases related to this supplier
    const txs = data.transactions.filter(t => 
      t.supplierId === statementSupplier.id || 
      (t.items && t.items.some(it => it.name.includes(statementSupplier.name))) ||
      (t.notes && t.notes.includes(statementSupplier.name))
    );

    // Also get stock adjustments (STOCK_IN) for this supplier
    const adjustments = data.stockAdjustments
      .filter(adj => adj.type === 'STOCK_IN' && (adj.supplierId === statementSupplier.id || adj.reason?.includes(statementSupplier.name)))
      .map(adj => ({
        id: adj.id,
        timestamp: adj.timestamp,
        type: 'STOCK_PURCHASE',
        description: `Iibka Alaabta: ${adj.productName} (Qty: ${adj.quantity})`,
        cost: adj.totalCost || (adj.quantity * (adj.unitCost || 0)),
        cashPaid: adj.cashPaid || 0,
        debtCreated: adj.debtCreated || 0,
        reason: adj.reason || 'Stock Purchase on Credit'
      }));

    return {
      transactions: txs.sort((a, b) => b.timestamp - a.timestamp),
      adjustments: adjustments.sort((a, b) => b.timestamp - a.timestamp)
    };
  }, [statementSupplier, data.transactions, data.stockAdjustments]);

  return (
    <div className="p-6 space-y-6">
      {/* Top Banner & Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-gradient-to-r from-red-600 to-amber-600 text-white p-6 rounded-[32px] shadow-lg flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-red-100">Total Vendor Debt Owed / Deynta Suppliers-ka</p>
            <h2 className="text-3xl font-black mt-1">{formatCurrency(totalDebt, currency, rate)}</h2>
            <p className="text-[11px] font-semibold text-red-100 mt-1">Lacagta guud ee dukaanka lagu leeyahay</p>
          </div>
          <div className="w-14 h-14 bg-white/10 backdrop-blur-md rounded-2xl flex items-center justify-center">
            <DollarSign size={28} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Total Registered Suppliers</p>
            <h2 className="text-3xl font-black text-slate-800 mt-1">{data.suppliers.length}</h2>
            <p className="text-[11px] font-semibold text-slate-400 mt-1">Ganacsatada & Shirkadaha alaabta keena</p>
          </div>
          <div className="w-14 h-14 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
            <Truck size={28} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Suppliers with Owed Balance</p>
            <h2 className="text-3xl font-black text-red-600 mt-1">
              {data.suppliers.filter(s => s.balance > 0).length}
            </h2>
            <p className="text-[11px] font-semibold text-slate-400 mt-1">Suppliers-ka lacagta lagu leeyahay</p>
          </div>
          <div className="w-14 h-14 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center">
            <AlertCircle size={28} />
          </div>
        </div>
      </div>

      {/* Header controls & Primary Action Buttons */}
      <div className="flex flex-col lg:flex-row justify-between items-stretch lg:items-center gap-4 no-print bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input 
            type="text" 
            placeholder="Raadi suppliers-ka (Magaca, Nambarka Telka, Contact)..."
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          {search && (
            <button 
              onClick={() => setSearch('')}
              className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Quick Pay Supplier Debt Button */}
          <button 
            onClick={() => {
              const firstWithDebt = data.suppliers.find(s => s.balance > 0);
              if (firstWithDebt) {
                openPayModal(firstWithDebt);
              } else if (data.suppliers.length > 0) {
                openPayModal(data.suppliers[0], 0);
              } else {
                alert("Fadlan marka hore diiwaangeli ugu yaraan hal Supplier!");
              }
            }}
            className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-emerald-900/10 active:scale-95 transition-all cursor-pointer"
          >
            <ArrowDownLeft size={16} /> Bixi Deynta Supplier
          </button>

          {/* Quick Add Debt to Supplier Button */}
          <button 
            onClick={() => {
              if (data.suppliers.length > 0) {
                openAddDebtModal(data.suppliers[0]);
              } else {
                alert("Fadlan marka hore diiwaangeli ugu yaraan hal Supplier!");
              }
            }}
            className="px-5 py-3 bg-red-600 hover:bg-red-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg shadow-red-900/10 active:scale-95 transition-all cursor-pointer"
          >
            <ArrowUpRight size={16} /> Ku dar Deyn Supplier
          </button>

          {/* Register New Supplier */}
          <button 
            onClick={() => {
              setFormData({ 
                name: '', 
                contact: '', 
                phone: '', 
                initialDebt: 0,
                date: getLocalDateTimeString(),
                reason: 'Diiwaangelin & Deyn Hore'
              });
              setShowModal(true);
            }}
            className="px-5 py-3 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-lg active:scale-95 transition-all cursor-pointer"
          >
            <Plus size={16} /> Register New Supplier
          </button>
        </div>
      </div>

      {/* Suppliers Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filtered.map(s => (
          <div 
            key={s.id} 
            onDoubleClick={() => setStatementSupplier(s)}
            className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4 hover:shadow-xl hover:border-slate-300 transition-all relative group flex flex-col justify-between"
          >
            <div>
              <div className="absolute top-4 right-4 flex items-center gap-1">
                <button 
                  onClick={(e) => { e.stopPropagation(); setStatementSupplier(s); }} 
                  className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all"
                  title="Xisaab-xidhka & Tale-ka (Statement)"
                >
                  <FileText size={16} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); handleOpenEdit(s); }} 
                  className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                  title="Wax ka beddel Supplier-ka (Edit Supplier)"
                >
                  <Edit2 size={16} />
                </button>
                <button 
                  onClick={(e) => { e.stopPropagation(); deleteSupplier(s.id, s.name); }} 
                  className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                  title="Delete Supplier"
                >
                  <Trash2 size={16} />
                </button>
              </div>
              
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
                  <Truck size={28} />
                </div>
                <div className="flex-1 min-w-0 pr-16">
                  <h3 className="font-black text-slate-800 truncate text-lg">{s.name}</h3>
                  <p className="text-xs text-slate-500 font-bold">{s.contact || 'Primary Contact'}</p>
                </div>
              </div>

              <div className="pt-4 space-y-3">
                <div className="flex items-center gap-2 text-sm text-slate-600 font-medium">
                  <Phone size={14} className="text-slate-400" /> {s.phone}
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 flex justify-between items-center">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Deynta Lagu Leeyahay (Balance Owed)</span>
                  <span className={`font-black text-lg ${s.balance > 0 ? 'text-red-600' : 'text-emerald-600'}`}>
                    {formatCurrency(s.balance, currency, rate)}
                  </span>
                </div>
              </div>
            </div>

            {/* Action Buttons for Debt Management */}
            <div className="space-y-2 pt-3 border-t border-slate-100 mt-2">
              <div className="grid grid-cols-2 gap-2">
                <button 
                  onClick={() => openPayModal(s)}
                  className="py-3 px-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 shadow-md shadow-emerald-900/10 transition-all cursor-pointer"
                >
                  <ArrowDownLeft size={15} /> Bixi Deyn
                </button>
                <button 
                  onClick={() => openAddDebtModal(s)}
                  className="py-3 px-3 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-2xl text-xs font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                >
                  <ArrowUpRight size={15} /> Ku dar Deyn
                </button>
              </div>

              <button
                onClick={() => setStatementSupplier(s)}
                className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[11px] font-black flex items-center justify-center gap-1.5 transition-all cursor-pointer"
              >
                <FileText size={13} /> Tale-ka & Xisaab-xidhka (Full Statement)
              </button>
            </div>
          </div>
        ))}

        {filtered.length === 0 && (
          <div className="col-span-full py-20 text-center flex flex-col items-center justify-center bg-white rounded-[32px] border-2 border-dashed border-slate-200">
             <Truck size={48} className="text-slate-300 mb-2" />
             <p className="font-bold text-slate-800 text-base">Lama helin Supplier</p>
             <p className="text-xs text-slate-400 mt-1">Waxba kuma jiraan baadhitaankaaga. Fadlan hubi magaca ama telefoonka.</p>
          </div>
        )}
      </div>

      {/* Daily Supplier Purchases Table */}
      <div className="pt-6">
        <DailySupplierPurchasesTable data={data} setData={setData} addLog={addLog} currency={currency} />
      </div>

      {/* Modal: Register New Supplier with Date & Reason */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print animate-in fade-in duration-200">
          <div className="bg-white rounded-[36px] shadow-2xl w-full max-w-lg p-8 space-y-5 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-3 py-1 rounded-full">Diiwaangeli Supplier</span>
                <h3 className="text-2xl font-black text-slate-800 mt-1.5">Register New Supplier</h3>
              </div>
              <button 
                onClick={() => setShowModal(false)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Magaca Shirkadda / Vendor Name *</label>
                <input 
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  placeholder="tusaale: Somaliland Food Ltd ama Global Supplies" 
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Qofka Xidhiidhka (Contact Person)</label>
                  <input 
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500" 
                    value={formData.contact} 
                    onChange={e => setFormData({...formData, contact: e.target.value})} 
                    placeholder="Magaca wakiilka" 
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Telefoonka (Phone Number) *</label>
                  <input 
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500" 
                    value={formData.phone} 
                    onChange={e => setFormData({...formData, phone: e.target.value})} 
                    placeholder="063XXXXXXX / 065XXXXXXX" 
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Deynta Hore Ee Lagu Leeyahay (Initial Debt Owed)</label>
                <input 
                  type="number" 
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black text-lg text-red-600 focus:bg-white focus:ring-2 focus:ring-red-500" 
                  value={formData.initialDebt || ''} 
                  onChange={e => setFormData({...formData, initialDebt: parseFloat(e.target.value) || 0})} 
                  placeholder="0.00" 
                />
              </div>

              {/* Date & Reason Fields */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1 flex items-center gap-1.5">
                  <Calendar size={13} className="text-blue-600" />
                  Taariikhda & Waqtiga (Date & Time)
                </label>
                <input 
                  type="datetime-local" 
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500" 
                  value={formData.date} 
                  onChange={e => setFormData({...formData, date: e.target.value})} 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Sababta / Faahfaahin (Reason / Note)</label>
                <input 
                  type="text" 
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500" 
                  value={formData.reason} 
                  onChange={e => setFormData({...formData, reason: e.target.value})} 
                  placeholder="Sababta diiwaangelinta ama deynta hore..." 
                />
              </div>
            </div>

            <div className="flex gap-3 pt-3">
              <button 
                onClick={() => setShowModal(false)} 
                className="flex-1 py-3.5 font-bold text-slate-400 hover:text-slate-600 rounded-2xl cursor-pointer"
              >
                Kansal
              </button>
              <button 
                onClick={saveSupplier} 
                className="flex-1 py-3.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black shadow-lg cursor-pointer"
              >
                Diiwaangeli Supplier
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Edit Supplier with Reason */}
      {editModalSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print animate-in fade-in duration-200">
          <div className="bg-white rounded-[36px] shadow-2xl w-full max-w-md p-8 space-y-5">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-3 py-1 rounded-full">Wax ka beddel / Edit Supplier</span>
                <h3 className="text-2xl font-black text-slate-800 mt-1.5">{editModalSupplier.name}</h3>
              </div>
              <button 
                onClick={() => setEditModalSupplier(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Company / Vendor Name</label>
                <input 
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs text-slate-800" 
                  value={editFormData.name} 
                  onChange={e => setEditFormData({...editFormData, name: e.target.value})} 
                  placeholder="Magaca Supplier-ka" 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Contact Person</label>
                <input 
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs text-slate-800" 
                  value={editFormData.contact} 
                  onChange={e => setEditFormData({...editFormData, contact: e.target.value})} 
                  placeholder="Qofka xidhiidhka" 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Phone Number</label>
                <input 
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs text-slate-800" 
                  value={editFormData.phone} 
                  onChange={e => setEditFormData({...editFormData, phone: e.target.value})} 
                  placeholder="Telefoonka" 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Current Balance Owed (Deynta Lagu Leeyahay)</label>
                <input 
                  type="number" 
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black text-lg text-red-600" 
                  value={editFormData.balance} 
                  onChange={e => setEditFormData({...editFormData, balance: parseFloat(e.target.value) || 0})} 
                  placeholder="0.00" 
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Sababta Wax-ka-bedelka (Reason for Modification)</label>
                <input 
                  type="text" 
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs text-slate-800" 
                  value={editFormData.reason} 
                  onChange={e => setEditFormData({...editFormData, reason: e.target.value})} 
                  placeholder="Sababta xisaabta loogu saxay..." 
                />
              </div>
            </div>

            <div className="flex gap-3 pt-3">
              <button 
                onClick={() => setEditModalSupplier(null)} 
                className="flex-1 py-3.5 font-bold text-slate-400 hover:text-slate-600 rounded-2xl"
              >
                Kansal
              </button>
              <button 
                onClick={handleUpdateSupplier} 
                className="flex-1 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Check size={18} /> Kaydi Wax-ka-bedelka
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Pay Supplier Debt with Date & Reason */}
      {payModalSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print animate-in fade-in duration-200">
          <div className="bg-white rounded-[36px] shadow-2xl w-full max-w-lg p-8 space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full flex items-center gap-1 w-fit">
                  <ArrowDownLeft size={12} /> Bixi Deynta Supplier-ka (Pay Debt)
                </span>
                <h3 className="text-2xl font-black text-slate-800 mt-1.5">{payModalSupplier.name}</h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  Deynta lagu leeyahay hadda: <span className="text-red-600 font-black">{formatCurrency(payModalSupplier.balance, currency, rate)}</span>
                </p>
              </div>
              <button 
                onClick={() => setPayModalSupplier(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Supplier selector if user wants to switch in modal */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Dooro Supplier-ka (Select Supplier)</label>
              <select
                value={payModalSupplier.id}
                onChange={e => {
                  const s = data.suppliers.find(item => item.id === e.target.value);
                  if (s) {
                    setPayModalSupplier(s);
                    setPayAmount(s.balance);
                  }
                }}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs text-slate-800"
              >
                {data.suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.phone}) — Deynta: {formatCurrency(s.balance, currency, rate)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-4">
              {/* Payment Amount & Quick Fill */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between px-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Lacagta La Bixinayo (Amount) *</label>
                  {payModalSupplier.balance > 0 && (
                    <div className="flex gap-1.5">
                      <button 
                        type="button"
                        onClick={() => setPayAmount(payModalSupplier.balance)}
                        className="px-2.5 py-0.5 bg-emerald-100 hover:bg-emerald-200 text-emerald-800 text-[10px] font-black rounded-lg transition-colors"
                      >
                        Bixi Dhammaan ({formatCurrency(payModalSupplier.balance, currency, rate)})
                      </button>
                      <button 
                        type="button"
                        onClick={() => setPayAmount(Math.round(payModalSupplier.balance / 2))}
                        className="px-2.5 py-0.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-black rounded-lg transition-colors"
                      >
                        50%
                      </button>
                    </div>
                  )}
                </div>
                <input 
                  type="number" 
                  className="w-full px-5 py-3.5 bg-emerald-50/50 border border-emerald-200 rounded-2xl outline-none font-black text-2xl text-emerald-700 focus:bg-white focus:ring-2 focus:ring-emerald-500" 
                  value={payAmount || ''} 
                  onChange={e => setPayAmount(Math.max(0, parseFloat(e.target.value) || 0))} 
                  placeholder="0.00" 
                />
              </div>

              {/* Source Account */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Akoonka Lacagta Laga Bixinayo (Treasury Account) *</label>
                <select 
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500"
                  value={payAccountId}
                  onChange={e => setPayAccountId(e.target.value)}
                >
                  <option value="">Dooro Sandaaqadda ama Bangiga...</option>
                  {data.accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} — Haragga Hadda: {formatCurrency(a.balance, currency, rate)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Method */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Habka Lacag Bixinta (Payment Method)</label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPayPaymentMethod(PaymentMethod.CASH)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 border transition-all ${
                      payPaymentMethod === PaymentMethod.CASH ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Wallet size={14} /> CASH
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayPaymentMethod(PaymentMethod.BANK)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 border transition-all ${
                      payPaymentMethod === PaymentMethod.BANK ? 'bg-blue-600 text-white border-blue-600' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Landmark size={14} /> BANK
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayPaymentMethod(PaymentMethod.MOBILE_MONEY)}
                    className={`py-2.5 px-3 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 border transition-all ${
                      payPaymentMethod === PaymentMethod.MOBILE_MONEY ? 'bg-purple-600 text-white border-purple-600' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <Smartphone size={14} /> MOBILE
                  </button>
                </div>
              </div>

              {/* Date & Time Field */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1 flex items-center gap-1.5">
                  <Calendar size={13} className="text-emerald-600" />
                  Taariikhda & Waqtiga Lacag Bixinta (Date & Time) *
                </label>
                <input 
                  type="datetime-local" 
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500" 
                  value={payDate} 
                  onChange={e => setPayDate(e.target.value)} 
                />
              </div>

              {/* Reason / Sababta */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Sababta / Ujeeddada Lacag Bixinta (Reason) *</label>
                <input 
                  type="text"
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500" 
                  value={payReason} 
                  onChange={e => setPayReason(e.target.value)} 
                  placeholder="tusaale: Bixinta biilka alaabtii shalay, Biilka bisha, iwm" 
                />
              </div>

              {/* Reference / Note */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Reference / Note (Ikhtiyaari)</label>
                <input 
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs text-slate-800" 
                  value={payNote} 
                  onChange={e => setPayNote(e.target.value)} 
                  placeholder="tusaale: Receipt #, Jeeg #, ama faahfaahin kale..." 
                />
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-slate-100">
              <button 
                onClick={() => setPayModalSupplier(null)} 
                className="flex-1 py-3.5 font-bold text-slate-400 hover:text-slate-600 rounded-2xl cursor-pointer"
              >
                Kansal
              </button>
              <button 
                onClick={handlePaySupplierDebt} 
                disabled={payAmount <= 0 || !payAccountId}
                className="flex-1 py-3.5 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white rounded-2xl font-black shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <CheckCircle2 size={18} /> Xaqiiji Lacag Bixinta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Add Supplier Debt with Date & Reason */}
      {addDebtSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print animate-in fade-in duration-200">
          <div className="bg-white rounded-[36px] shadow-2xl w-full max-w-lg p-8 space-y-5 max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100">
              <div>
                <span className="text-[10px] font-black uppercase text-red-600 bg-red-50 px-3 py-1 rounded-full flex items-center gap-1 w-fit">
                  <ArrowUpRight size={12} /> Ku dar Deyn / Add Supplier Debt
                </span>
                <h3 className="text-2xl font-black text-slate-800 mt-1.5">{addDebtSupplier.name}</h3>
                <p className="text-xs text-slate-500 font-semibold mt-0.5">
                  Deynta hadda lagu leeyahay: <span className="text-red-600 font-black">{formatCurrency(addDebtSupplier.balance, currency, rate)}</span>
                </p>
              </div>
              <button 
                onClick={() => setAddDebtSupplier(null)}
                className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-all"
              >
                <X size={20} />
              </button>
            </div>

            {/* Switch supplier if needed */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Dooro Supplier-ka (Select Supplier)</label>
              <select
                value={addDebtSupplier.id}
                onChange={e => {
                  const s = data.suppliers.find(item => item.id === e.target.value);
                  if (s) setAddDebtSupplier(s);
                }}
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs text-slate-800"
              >
                {data.suppliers.map(s => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.phone}) — Hadda: {formatCurrency(s.balance, currency, rate)}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Xaddiga Deynta Cusub (Additional Debt Amount) *</label>
                <input 
                  type="number" 
                  className="w-full px-5 py-3.5 bg-red-50/50 border border-red-200 rounded-2xl outline-none font-black text-2xl text-red-600 focus:bg-white focus:ring-2 focus:ring-red-500" 
                  value={debtAmount || ''} 
                  onChange={e => setDebtAmount(Math.max(0, parseFloat(e.target.value) || 0))} 
                  placeholder="0.00" 
                />
              </div>

              {/* Date & Time */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1 flex items-center gap-1.5">
                  <Calendar size={13} className="text-red-600" />
                  Taariikhda & Waqtiga Deynta (Date & Time) *
                </label>
                <input 
                  type="datetime-local" 
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-red-500" 
                  value={debtDate} 
                  onChange={e => setDebtDate(e.target.value)} 
                />
              </div>

              {/* Reason / Sababta */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Sababta Deynta (Reason / Details) *</label>
                <input 
                  type="text"
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-red-500" 
                  value={debtReason} 
                  onChange={e => setDebtReason(e.target.value)} 
                  placeholder="tusaale: Alaab amaah ah, Amaah lacag ah, iwm" 
                />
              </div>

              {/* Reference / Invoice Number */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Invoice / Reference Number (Ikhtiyaari)</label>
                <input 
                  className="w-full px-5 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs text-slate-800" 
                  value={debtInvoiceRef} 
                  onChange={e => setDebtInvoiceRef(e.target.value)} 
                  placeholder="tusaale: INV-99081 ama Kootada alaabta" 
                />
              </div>
            </div>

            <div className="flex gap-3 pt-3 border-t border-slate-100">
              <button 
                onClick={() => setAddDebtSupplier(null)} 
                className="flex-1 py-3.5 font-bold text-slate-400 hover:text-slate-600 rounded-2xl cursor-pointer"
              >
                Kansal
              </button>
              <button 
                onClick={handleAddSupplierDebt} 
                disabled={debtAmount <= 0}
                className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white rounded-2xl font-black shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <PlusCircle size={18} /> Diiwaangeli Deynta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Supplier Statement & Ledger (Tale-ka Xisaabta Supplier-ka) */}
      {statementSupplier && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-white rounded-[36px] shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col overflow-hidden">
            {/* Modal Header */}
            <div className="p-6 md:p-8 bg-slate-900 text-white flex items-center justify-between no-print">
              <div>
                <span className="text-[10px] font-black uppercase text-amber-400 bg-amber-400/20 px-3 py-1 rounded-full">
                  Xisaab-xidhka Supplier-ka / Statement
                </span>
                <h3 className="text-2xl font-black mt-2">{statementSupplier.name}</h3>
                <p className="text-xs text-slate-400 font-bold mt-0.5">
                  Tel: {statementSupplier.phone} {statementSupplier.contact ? `• Contact: ${statementSupplier.contact}` : ''}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer"
                >
                  <Printer size={15} /> Daabac (Print)
                </button>
                <button
                  onClick={() => setStatementSupplier(null)}
                  className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Summary Cards */}
            <div className="p-6 bg-slate-50 border-b border-slate-200 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Deynta Lagu Leeyahay Hadda</p>
                <h4 className="text-2xl font-black text-red-600 mt-1">
                  {formatCurrency(statementSupplier.balance, currency, rate)}
                </h4>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Wadarta Dhaqdhaqaaqa</p>
                <h4 className="text-2xl font-black text-slate-800 mt-1">
                  {supplierLedger.transactions.length + supplierLedger.adjustments.length} Record
                </h4>
              </div>

              <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Ficilada Degdegga ah</p>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      onClick={() => openPayModal(statementSupplier)}
                      className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[11px] font-black flex items-center gap-1 shadow transition-all cursor-pointer"
                    >
                      <ArrowDownLeft size={13} /> Bixi Deyn
                    </button>
                    <button
                      onClick={() => openAddDebtModal(statementSupplier)}
                      className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[11px] font-black flex items-center gap-1 shadow transition-all cursor-pointer"
                    >
                      <ArrowUpRight size={13} /> Ku dar Deyn
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Statement Table Content */}
            <div className="p-6 flex-1 overflow-y-auto space-y-6">
              <div className="space-y-3">
                <h4 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <History size={14} className="text-slate-600" />
                  Diiwaanka Dhaqdhaqaaqa (Transactions & Payment Ledger)
                </h4>

                <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                  <table className="w-full text-left border-collapse">
                    <thead className="bg-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-600 border-b border-slate-200">
                      <tr>
                        <th className="p-3.5">Taariikhda & Waqtiga</th>
                        <th className="p-3.5">Nooca Dhaqdhaqaaqa</th>
                        <th className="p-3.5">Sababta / Faahfaahinta</th>
                        <th className="p-3.5">Akoonka / Habka</th>
                        <th className="p-3.5 text-right">Lacagta</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                      {supplierLedger.transactions.map(tx => {
                        const isPayment = tx.type === 'EXPENSE' || tx.items?.some(it => it.sku === 'SUPPLIER_PAYMENT');
                        const acc = data.accounts.find(a => a.id === tx.accountId);

                        return (
                          <tr key={tx.id} className="hover:bg-slate-50 transition-colors">
                            <td className="p-3.5 whitespace-nowrap text-slate-500 font-medium">
                              {new Date(tx.timestamp).toLocaleString()}
                            </td>
                            <td className="p-3.5 whitespace-nowrap">
                              {isPayment ? (
                                <span className="px-2.5 py-1 bg-emerald-50 text-emerald-700 rounded-lg text-[10px] font-black border border-emerald-200">
                                  🟢 Bixinta Deynta (Payment)
                                </span>
                              ) : (
                                <span className="px-2.5 py-1 bg-rose-50 text-rose-700 rounded-lg text-[10px] font-black border border-rose-200">
                                  🔴 Deyn Cusub (Debt Added)
                                </span>
                              )}
                            </td>
                            <td className="p-3.5 text-slate-600 max-w-xs">
                              {tx.notes || tx.items?.[0]?.name || 'Supplier transaction'}
                            </td>
                            <td className="p-3.5 whitespace-nowrap text-slate-500">
                              {acc ? acc.name : (tx.paymentMethod || 'Cash')}
                            </td>
                            <td className="p-3.5 text-right whitespace-nowrap font-black">
                              <span className={isPayment ? 'text-emerald-600' : 'text-rose-600'}>
                                {isPayment ? '-' : '+'}{formatCurrency(tx.total, currency, rate)}
                              </span>
                            </td>
                          </tr>
                        );
                      })}

                      {supplierLedger.transactions.length === 0 && (
                        <tr>
                          <td colSpan={5} className="p-8 text-center text-slate-400 font-bold">
                            Lama helin wax dhaqdhaqaaq ah oo diiwaangashan supplier-kan.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end no-print">
              <button
                onClick={() => setStatementSupplier(null)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black transition-all cursor-pointer"
              >
                Xidh (Close)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Supplier Confirm Modal */}
      <ConfirmModal
        isOpen={!!deleteConfirmSupplier}
        title="Ma hubtaa? (Are you sure?)"
        message={`Ma hubtaa inaad tirtirto supplier-ka: "${deleteConfirmSupplier?.name}"? Tallaabadan dib looma noqon karo.`}
        confirmText="Haa (Tirtir)"
        cancelText="Maya (Kansal)"
        onConfirm={() => {
          if (deleteConfirmSupplier) {
            const suppToDelete = data.suppliers.find(item => item.id === deleteConfirmSupplier.id);
            setData(prev => {
              let updatedBin = prev.recycleBin || [];
              const updatedDeletedIds = { ...(prev.deletedIds || {}) };
              if (suppToDelete) {
                updatedDeletedIds[deleteConfirmSupplier.id] = Date.now();
                const binItem = {
                  id: generateId(),
                  type: 'SUPPLIER' as const,
                  deletedAt: Date.now(),
                  title: suppToDelete.name,
                  description: `Contact: ${suppToDelete.contact} • Phone: ${suppToDelete.phone} • Debt Balance: $${suppToDelete.balance}`,
                  originalData: suppToDelete
                };
                updatedBin = [binItem, ...updatedBin];
              }
              return {
                ...prev,
                suppliers: prev.suppliers.filter(item => item.id !== deleteConfirmSupplier.id),
                recycleBin: updatedBin,
                deletedIds: updatedDeletedIds
              };
            });
            addLog('Delete Supplier', `Moved supplier to Recycle Bin: ${deleteConfirmSupplier.name}`);
            setDeleteConfirmSupplier(null);
          }
        }}
        onClose={() => setDeleteConfirmSupplier(null)}
      />
    </div>
  );
};

export default Suppliers;
