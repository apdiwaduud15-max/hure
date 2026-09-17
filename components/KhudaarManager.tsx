import React, { useState, useMemo } from 'react';
import { AppData, Currency, KhudaarExpense, KhudaarSale, PaymentMethod, Transaction } from '../types';
import { formatCurrency, generateId } from '../lib/utils';
import { 
  Apple, 
  Plus, 
  TrendingUp, 
  TrendingDown, 
  Calendar, 
  DollarSign, 
  Search, 
  Trash2, 
  Edit3, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  Printer, 
  PieChart, 
  ArrowUpRight, 
  ArrowDownRight, 
  Percent, 
  Clock, 
  Receipt, 
  X,
  Sparkles,
  Download,
  ShieldCheck
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';

interface Props {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  addLog: (action: string, details: string) => void;
  currency: Currency;
}

type DateFilterMode = 'TODAY' | 'WEEK' | 'MONTH' | 'CUSTOM' | 'ALL';

export const KhudaarManager: React.FC<Props> = ({ data, setData, addLog, currency }) => {
  const rate = data.settings.exchangeRate || 125;
  const expenses = data.khudaarExpenses || [];
  const sales = data.khudaarSales || [];

  // Active view tab inside Khudaar
  const [activeTab, setActiveTab] = useState<'SALES' | 'EXPENSES' | 'REPORT'>('SALES');

  // Date Filter states
  const [dateMode, setDateMode] = useState<DateFilterMode>('ALL');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Modals state
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [showAddSaleModal, setShowAddSaleModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState<KhudaarExpense | null>(null);
  const [editingSale, setEditingSale] = useState<KhudaarSale | null>(null);

  // Delete Confirm
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{ id: string; type: 'EXPENSE' | 'SALE'; name: string } | null>(null);

  // Expense Form state
  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState('');
  const [expDate, setExpDate] = useState(new Date().toISOString().split('T')[0]);
  const [expNotes, setExpNotes] = useState('');

  // Sale Form state
  const [saleAmount, setSaleAmount] = useState('');
  const [saleDate, setSaleDate] = useState(new Date().toISOString().split('T')[0]);
  const [salePaymentMethod, setSalePaymentMethod] = useState('Cash');
  const [saleNotes, setSaleNotes] = useState('');
  const [saleCustomerId, setSaleCustomerId] = useState('');
  const [saleCustomerName, setSaleCustomerName] = useState('');
  const [saleIsDebt, setSaleIsDebt] = useState(false);

  // Helper date filter function
  const isDateInFilter = (dateStr: string) => {
    if (!dateStr) return true;
    const itemDate = new Date(dateStr);
    const today = new Date();
    
    // Normalize time for exact date comparison
    itemDate.setHours(0,0,0,0);
    const normalizedToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());

    if (dateMode === 'TODAY') {
      return itemDate.getTime() === normalizedToday.getTime();
    }

    if (dateMode === 'WEEK') {
      const firstDayOfWeek = new Date(normalizedToday);
      const day = normalizedToday.getDay();
      const diff = normalizedToday.getDate() - day + (day === 0 ? -6 : 1); // Monday as first day
      firstDayOfWeek.setDate(diff);
      return itemDate >= firstDayOfWeek && itemDate <= normalizedToday;
    }

    if (dateMode === 'MONTH') {
      return itemDate.getFullYear() === today.getFullYear() && itemDate.getMonth() === today.getMonth();
    }

    if (dateMode === 'CUSTOM') {
      if (!customStartDate && !customEndDate) return true;
      const start = customStartDate ? new Date(customStartDate) : new Date(0);
      const end = customEndDate ? new Date(customEndDate) : new Date(8640000000000000);
      start.setHours(0,0,0,0);
      end.setHours(23,59,59,999);
      return itemDate >= start && itemDate <= end;
    }

    return true; // ALL
  };

  // Filtered lists
  const filteredExpenses = useMemo(() => {
    return expenses.filter(exp => {
      const matchDate = isDateInFilter(exp.date);
      const matchSearch = !searchTerm || 
        exp.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (exp.notes && exp.notes.toLowerCase().includes(searchTerm.toLowerCase()));
      return matchDate && matchSearch;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [expenses, dateMode, customStartDate, customEndDate, searchTerm]);

  const filteredSales = useMemo(() => {
    return sales.filter(s => {
      const matchDate = isDateInFilter(s.date);
      const matchSearch = !searchTerm || 
        (s.notes && s.notes.toLowerCase().includes(searchTerm.toLowerCase())) || 
        (s.paymentMethod && s.paymentMethod.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (s.customerName && s.customerName.toLowerCase().includes(searchTerm.toLowerCase()));
      
      return matchDate && matchSearch;
    }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [sales, dateMode, customStartDate, customEndDate, searchTerm]);

  // Financial Calculations
  const totalExpenses = useMemo(() => {
    return filteredExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  }, [filteredExpenses]);

  const totalSales = useMemo(() => {
    return filteredSales.reduce((sum, s) => sum + s.amount, 0);
  }, [filteredSales]);

  // Overall (All Time) Expenses & Sales for total standing balance
  const overallExpenses = useMemo(() => expenses.reduce((sum, e) => sum + e.amount, 0), [expenses]);
  const overallSales = useMemo(() => sales.reduce((sum, s) => sum + s.amount, 0), [sales]);

  // Balance status
  const netBalance = totalSales - totalExpenses;
  const isProfit = netBalance >= 0;

  const overallNetBalance = overallSales - overallExpenses;
  const isOverallProfit = overallNetBalance >= 0;

  // Percentage of cost covered
  const recoveryPercentage = totalExpenses > 0 ? Math.min(100, Math.round((totalSales / totalExpenses) * 100)) : 100;

  // Form Handlers
  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(expAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    if (editingExpense) {
      setData(prev => ({
        ...prev,
        khudaarExpenses: (prev.khudaarExpenses || []).map(item => 
          item.id === editingExpense.id 
            ? { ...item, title: expTitle.trim(), amount: amountNum, date: expDate, notes: expNotes.trim() }
            : item
        )
      }));
      addLog('Edit Khudaar Expense', `Updated expense: ${expTitle} ($${amountNum})`);
    } else {
      const newExp: KhudaarExpense = {
        id: generateId(),
        title: expTitle.trim() || 'Kharashka Khudaarta',
        amount: amountNum,
        date: expDate || new Date().toISOString().split('T')[0],
        notes: expNotes.trim(),
        createdAt: Date.now()
      };
      setData(prev => ({
        ...prev,
        khudaarExpenses: [newExp, ...(prev.khudaarExpenses || [])]
      }));
      addLog('Add Khudaar Expense', `Added new vegetable expense: ${newExp.title} ($${amountNum})`);
    }

    // Reset
    setShowAddExpenseModal(false);
    setEditingExpense(null);
    setExpTitle('');
    setExpAmount('');
    setExpNotes('');
  };

  const handleSaveSale = (e: React.FormEvent) => {
    e.preventDefault();
    const amountNum = parseFloat(saleAmount);
    if (isNaN(amountNum) || amountNum <= 0) return;

    let targetCustId = saleCustomerId;
    let targetCustName = saleCustomerName.trim();
    const isDebtMethod = salePaymentMethod === 'Deyn / Credit' || saleIsDebt;

    if (editingSale) {
      const wasDebt = editingSale.isDebt || editingSale.paymentMethod === 'Deyn / Credit';
      const diffAmt = amountNum - editingSale.amount;

      setData(prev => {
        let updatedCustomers = [...prev.customers];

        // Adjust debt if this sale was or is debt
        if (isDebtMethod || wasDebt) {
          const custId = targetCustId || editingSale.customerId;
          const custName = targetCustName || editingSale.customerName;

          if (custId || custName) {
            let existingCust = updatedCustomers.find(c => (custId && c.id === custId) || (custName && c.name.toLowerCase() === custName.toLowerCase()));

            if (existingCust) {
              if (wasDebt && isDebtMethod) {
                // Same debt, adjust by difference
                updatedCustomers = updatedCustomers.map(c => c.id === existingCust!.id ? { ...c, debtBalance: Math.max(0, c.debtBalance + diffAmt) } : c);
              } else if (!wasDebt && isDebtMethod) {
                // Now became debt
                updatedCustomers = updatedCustomers.map(c => c.id === existingCust!.id ? { ...c, debtBalance: c.debtBalance + amountNum } : c);
              } else if (wasDebt && !isDebtMethod) {
                // Was debt, now paid
                updatedCustomers = updatedCustomers.map(c => c.id === existingCust!.id ? { ...c, debtBalance: Math.max(0, c.debtBalance - editingSale.amount) } : c);
              }
            }
          }
        }

        return {
          ...prev,
          customers: updatedCustomers,
          khudaarSales: (prev.khudaarSales || []).map(item => 
            item.id === editingSale.id 
              ? { 
                  ...item, 
                  amount: amountNum, 
                  date: saleDate, 
                  paymentMethod: salePaymentMethod, 
                  notes: saleNotes.trim(),
                  customerId: targetCustId,
                  customerName: targetCustName,
                  isDebt: isDebtMethod
                }
              : item
          )
        };
      });
      addLog('Edit Khudaar Sale', `Updated daily sale: $${amountNum}`);
    } else {
      const newSale: KhudaarSale = {
        id: generateId(),
        amount: amountNum,
        date: saleDate || new Date().toISOString().split('T')[0],
        paymentMethod: salePaymentMethod,
        notes: saleNotes.trim(),
        createdAt: Date.now(),
        customerId: targetCustId,
        customerName: targetCustName,
        isDebt: isDebtMethod
      };

      setData(prev => {
        let updatedCustomers = [...prev.customers];
        let updatedTransactions = [...prev.transactions];

        // If customer is selected/entered OR if payment method is Debt, update customer debt balance automatically!
        if (targetCustId || targetCustName || isDebtMethod) {
          let custName = targetCustName || (isDebtMethod ? 'Macamiil Deyn' : '');
          if (custName || targetCustId) {
            let existingCust = updatedCustomers.find(c => (targetCustId && c.id === targetCustId) || (custName && c.name.toLowerCase() === custName.toLowerCase()));
            
            if (!existingCust && custName) {
              existingCust = {
                id: generateId(),
                name: custName,
                phone: '',
                debtBalance: 0,
                loyaltyPoints: 0,
                history: []
              };
              updatedCustomers.push(existingCust);
            }

            if (existingCust) {
              targetCustId = existingCust.id;
              targetCustName = existingCust.name;
              const txId = generateId();

              // If it's debt or has customer, update customer balance if debt method or debt flag is on
              const shouldUpdateDebt = isDebtMethod || salePaymentMethod === 'Deyn / Credit';

              const debtTx: Transaction = {
                id: txId,
                timestamp: Date.now(),
                customerId: existingCust.id,
                customerName: existingCust.name,
                currency: data.settings.defaultCurrency || Currency.ETB,
                exchangeRate: data.settings.exchangeRate || 190,
                type: 'SALE',
                items: [{
                  id: generateId(),
                  name: `Khudaar Daily Sale (${custName})`,
                  sku: 'KHUDAAR',
                  barcode: '',
                  category: 'Khudaar',
                  stock: 9999,
                  sellPrice: amountNum,
                  costPrice: 0,
                  quantity: 1
                }],
                subtotal: amountNum,
                discount: 0,
                tax: 0,
                total: amountNum,
                paymentMethod: shouldUpdateDebt ? PaymentMethod.DEBT : (salePaymentMethod === 'Cash' ? PaymentMethod.CASH : PaymentMethod.MOBILE_MONEY),
                notes: `Khudaar: ${saleNotes.trim() || 'Soo bixitaan maalinle ah'}`
              };

              updatedTransactions = [debtTx, ...updatedTransactions];

              if (shouldUpdateDebt) {
                updatedCustomers = updatedCustomers.map(c => 
                  c.id === existingCust!.id 
                    ? { ...c, debtBalance: c.debtBalance + amountNum, history: [...c.history, txId] }
                    : c
                );
              } else {
                updatedCustomers = updatedCustomers.map(c => 
                  c.id === existingCust!.id 
                    ? { ...c, history: [...c.history, txId] }
                    : c
                );
              }
            }
          }
        }

        return {
          ...prev,
          khudaarSales: [newSale, ...(prev.khudaarSales || [])],
          customers: updatedCustomers,
          transactions: updatedTransactions
        };
      });

      addLog('Add Khudaar Daily Sale', `Recorded daily revenue: $${amountNum} (${targetCustName ? 'Customer: ' + targetCustName : salePaymentMethod})`);
    }

    // Reset
    setShowAddSaleModal(false);
    setEditingSale(null);
    setSaleAmount('');
    setSaleNotes('');
    setSaleCustomerId('');
    setSaleCustomerName('');
    setSaleIsDebt(false);
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirmItem) return;
    const { id, type, name } = deleteConfirmItem;

    if (type === 'EXPENSE') {
      const expToDelete = expenses.find(e => e.id === id);
      setData(prev => {
        let updatedBin = prev.recycleBin || [];
        const updatedDeletedIds = { ...(prev.deletedIds || {}) };
        if (expToDelete) {
          updatedDeletedIds[id] = Date.now();
          updatedBin = [{
            id: generateId(),
            type: 'KHUDAAR_EXPENSE' as const,
            deletedAt: Date.now(),
            title: `Khudaar Expense: ${expToDelete.title}`,
            description: `Amount: $${expToDelete.amount} • Date: ${expToDelete.date}`,
            originalData: expToDelete
          }, ...updatedBin];
        }
        return {
          ...prev,
          khudaarExpenses: (prev.khudaarExpenses || []).filter(e => e.id !== id),
          recycleBin: updatedBin,
          deletedIds: updatedDeletedIds,
          lastModified: Date.now()
        };
      });
      addLog('Delete Khudaar Expense', `Removed expense: ${name}`);
    } else {
      const saleToDelete = sales.find(s => s.id === id);
      setData(prev => {
        let updatedBin = prev.recycleBin || [];
        let updatedCusts = [...prev.customers];
        const updatedDeletedIds = { ...(prev.deletedIds || {}) };

        if (saleToDelete) {
          updatedDeletedIds[id] = Date.now();
          updatedBin = [{
            id: generateId(),
            type: 'KHUDAAR_SALE' as const,
            deletedAt: Date.now(),
            title: `Khudaar Daily Revenue: $${saleToDelete.amount}`,
            description: `Method: ${saleToDelete.paymentMethod || 'Cash'} • Date: ${saleToDelete.date}`,
            originalData: saleToDelete
          }, ...updatedBin];

          if (saleToDelete.customerId && (saleToDelete.isDebt || saleToDelete.paymentMethod === 'Deyn / Credit')) {
            updatedCusts = updatedCusts.map(c => 
              c.id === saleToDelete.customerId 
                ? { ...c, debtBalance: Math.max(0, c.debtBalance - saleToDelete.amount) } 
                : c
            );
          }
        }
        return {
          ...prev,
          khudaarSales: (prev.khudaarSales || []).filter(s => s.id !== id),
          customers: updatedCusts,
          recycleBin: updatedBin,
          deletedIds: updatedDeletedIds,
          lastModified: Date.now()
        };
      });
      addLog('Delete Khudaar Sale', `Removed daily sale entry: ${name}`);
    }

    setDeleteConfirmItem(null);
  };

  const handlePrintReport = () => {
    window.print();
  };

  const handleDownloadKhudaarBackup = () => {
    try {
      const khudaarPayload = {
        type: 'KHUDAAR_BACKUP',
        storeName: data.settings?.businessName || 'Xaysimo',
        exportDate: new Date().toISOString(),
        totalExpenses: expenses.reduce((sum, e) => sum + e.amount, 0),
        totalSales: sales.reduce((sum, s) => sum + s.amount, 0),
        khudaarExpenses: expenses,
        khudaarSales: sales
      };
      const dataStr = JSON.stringify(khudaarPayload, null, 2);
      const blob = new Blob([dataStr], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `khudaar_xisaab_${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      addLog('Export Khudaar Data', `Exported ${expenses.length} expenses and ${sales.length} sales records.`);
    } catch (err: any) {
      alert('Error exporting Khudaar data: ' + err.message);
    }
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto print:p-0">
      
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-900 via-emerald-800 to-teal-900 text-white p-6 md:p-8 rounded-[36px] shadow-xl relative overflow-hidden print:hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-emerald-500/20 via-transparent to-transparent pointer-events-none" />
        
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6 relative z-10">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-emerald-300 text-xs font-black uppercase tracking-widest backdrop-blur-md">
                <Apple size={16} className="text-emerald-400" />
                Xisaabta Gaarka ah ee Khudaarta (Vegetable Ledger)
              </div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/20 border border-teal-400/30 text-teal-200 text-[11px] font-bold">
                <ShieldCheck size={14} className="text-teal-400" />
                100% La Xafiday (Cloud & Local Safe)
              </div>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white uppercase">
              Xisaabinta & Maamulka Khudaarta
            </h1>
            <p className="text-emerald-200/80 text-xs font-medium max-w-2xl leading-relaxed">
              Xisaabtan waxay si buuxda uga gaar tahay xisaabaha kale ee dukaanka. Waxaad ku darsan kartaa kharashka khudaarta la soo iibiyay, waxaana maalin kasta laga jarayaa dakhliga soo baxa ilaa ay kharashka ka bixiso oo ay faa'iido u beddelato.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            <button
              onClick={handleDownloadKhudaarBackup}
              title="Soo deji diwaanka khudaarta JSON ahaan"
              className="px-4 py-3.5 bg-white/10 hover:bg-white/20 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all border border-white/20 flex items-center justify-center gap-2 active:scale-95 backdrop-blur-md"
            >
              <Download size={16} /> Gurmadka Khudaarta
            </button>

            <button
              onClick={() => {
                setEditingExpense(null);
                setExpTitle('');
                setExpAmount('');
                setExpNotes('');
                setShowAddExpenseModal(true);
              }}
              className="flex-1 lg:flex-none px-5 py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-rose-900/40 flex items-center justify-center gap-2 active:scale-95"
            >
              <Plus size={18} /> Ku Dar Kharash
            </button>

            <button
              onClick={() => {
                setEditingSale(null);
                setSaleAmount('');
                setSaleNotes('');
                setShowAddSaleModal(true);
              }}
              className="flex-1 lg:flex-none px-5 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-2 active:scale-95"
            >
              <Plus size={18} /> Ku Dar Soo Bixitaan (Daily Sale)
            </button>
          </div>
        </div>
      </div>

      {/* Date & Detailed Customer / Comments Filter Bar */}
      <div className="bg-white p-4 md:p-6 rounded-3xl border border-slate-100 shadow-sm space-y-4 print:hidden">
        {/* Row 1: Date and Quick Search */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
          {/* Quick Date Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
            <span className="text-xs font-black text-slate-400 uppercase tracking-wider mr-2 flex items-center gap-1">
              <Calendar size={14} /> Taariikhda:
            </span>

            {[
              { id: 'ALL', label: 'Dhammaan (All Time)' },
              { id: 'TODAY', label: 'Maanta (Today)' },
              { id: 'WEEK', label: 'Asbuucan (This Week)' },
              { id: 'MONTH', label: 'Bishan (This Month)' },
              { id: 'CUSTOM', label: 'Custom Date' }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setDateMode(tab.id as DateFilterMode)}
                className={`px-4 py-2.5 rounded-xl font-black text-[11px] uppercase tracking-wider transition-all whitespace-nowrap ${
                  dateMode === tab.id
                    ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Search Box */}
          <div className="relative min-w-[240px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Raadi kharash ama dakhli..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>

        {/* Custom Date Selector Input */}
        {dateMode === 'CUSTOM' && (
          <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase">Ka (From):</span>
              <input 
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-500 uppercase">Ilaa (To):</span>
              <input 
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>

            {(customStartDate || customEndDate) && (
              <button
                onClick={() => { setCustomStartDate(''); setCustomEndDate(''); }}
                className="text-xs font-bold text-rose-600 hover:underline uppercase"
              >
                Tirtir Date Filters-ka
              </button>
            )}
          </div>
        )}
      </div>

      {/* Main Financial KPI Cards (Profit vs Expense Standing Balance) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        
        {/* Total Expenses Investment Card */}
        <div className="bg-white p-6 rounded-[32px] border border-rose-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-black text-rose-600 uppercase tracking-widest bg-rose-50 px-3 py-1.5 rounded-full border border-rose-100">
              Kharashka Khudaarta
            </span>
            <div className="w-10 h-10 bg-rose-100 text-rose-600 rounded-2xl flex items-center justify-center">
              <TrendingDown size={20} />
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {formatCurrency(totalExpenses, currency, rate)}
            </h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              {filteredExpenses.length} Kharash oo la diwaan gashay
            </p>
          </div>
        </div>

        {/* Total Revenue / Daily Sales Card */}
        <div className="bg-white p-6 rounded-[32px] border border-emerald-100 shadow-sm relative overflow-hidden group hover:shadow-md transition-all">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-black text-emerald-600 uppercase tracking-widest bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100">
              Soo Bixitaanka Maalinlaha
            </span>
            <div className="w-10 h-10 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center">
              <TrendingUp size={20} />
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-3xl font-black text-slate-900 tracking-tight">
              {formatCurrency(totalSales, currency, rate)}
            </h2>
            <p className="text-xs text-slate-400 font-bold uppercase tracking-wider">
              {filteredSales.length} Soo bixitaan oo lagu soo shubay
            </p>
          </div>
        </div>

        {/* Net Profit OR Minus Standing Balance Card */}
        <div className={`p-6 rounded-[32px] border shadow-md relative overflow-hidden transition-all ${
          isProfit 
            ? 'bg-gradient-to-br from-emerald-900 to-teal-950 text-white border-emerald-500/30' 
            : 'bg-gradient-to-br from-rose-950 to-slate-900 text-white border-rose-500/30'
        }`}>
          <div className="flex items-center justify-between mb-3">
            <span className={`text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-full border ${
              isProfit 
                ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30' 
                : 'bg-rose-500/20 text-rose-300 border-rose-500/30'
            }`}>
              {isProfit ? "FAA'IIDO (NET PROFIT)" : "MINUS KU TAAGAN (KHARASH HARAY)"}
            </span>

            <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${
              isProfit ? 'bg-emerald-500/20 text-emerald-400' : 'bg-rose-500/20 text-rose-400'
            }`}>
              {isProfit ? <ArrowUpRight size={22} /> : <ArrowDownRight size={22} />}
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-3xl font-black tracking-tight">
              {isProfit ? '+' : ''}{formatCurrency(netBalance, currency, rate)}
            </h2>
            <p className="text-[11px] text-slate-300 font-medium">
              {isProfit 
                ? '✅ Kharashkiinii khudaarta waa la soo bixiyay dhammaantiis, intani waa faa’iido saafi ah!' 
                : '⚠️ Dakhliga wali ma gaadhin kharashka. Kharashka dhiman waa intan kore.'}
            </p>
          </div>

          {/* Progress bar of recovery */}
          <div className="mt-4 pt-3 border-t border-white/10 space-y-1.5">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-wider">
              <span className="text-slate-300">Boqolleyda Bixinta Kharashka</span>
              <span className={isProfit ? 'text-emerald-300' : 'text-amber-300'}>
                {recoveryPercentage}% {isProfit ? 'Dhaaftay' : 'Laga soo Bixiyay'}
              </span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2 overflow-hidden">
              <div 
                className={`h-full rounded-full transition-all duration-500 ${isProfit ? 'bg-emerald-400' : 'bg-amber-400'}`}
                style={{ width: `${Math.min(100, recoveryPercentage)}%` }}
              />
            </div>
          </div>
        </div>

      </div>

      {/* Main Tabs Navigation */}
      <div className="bg-white p-2 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-2 print:hidden">
        <button
          onClick={() => setActiveTab('SALES')}
          className={`flex-1 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
            activeTab === 'SALES'
              ? 'bg-emerald-600 text-white shadow-md shadow-emerald-600/20'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <Receipt size={16} /> Dakhliga Maalinlaha ({filteredSales.length})
        </button>

        <button
          onClick={() => setActiveTab('EXPENSES')}
          className={`flex-1 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
            activeTab === 'EXPENSES'
              ? 'bg-rose-600 text-white shadow-md shadow-rose-600/20'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <TrendingDown size={16} /> Kharashka Khudaarta ({filteredExpenses.length})
        </button>

        <button
          onClick={() => setActiveTab('REPORT')}
          className={`flex-1 py-3 px-4 rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
            activeTab === 'REPORT'
              ? 'bg-slate-900 text-white shadow-md shadow-slate-900/20'
              : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          <PieChart size={16} /> Warbixinta & Garsoorka (Summary)
        </button>

        <button
          onClick={handlePrintReport}
          className="p-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold text-xs transition-all"
          title="Print Statement"
        >
          <Printer size={16} />
        </button>
      </div>

      {/* TAB 1: DAILY SALES / REVENUE TABLE */}
      {activeTab === 'SALES' && (
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                Diwaanka Soo Bixitaanka Maalinlaha ah (Daily Revenue)
              </h3>
              <p className="text-xs text-slate-400 font-bold uppercase mt-0.5">
                Lacagaha maalin kasta ka soo baxa khudaarta ee lagu jarayo kharashka
              </p>
            </div>

            <button
              onClick={() => {
                setEditingSale(null);
                setSaleAmount('');
                setSaleNotes('');
                setShowAddSaleModal(true);
              }}
              className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2"
            >
              <Plus size={16} /> Geli Soo Bixitaan
            </button>
          </div>

          {filteredSales.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-3xl flex items-center justify-center mx-auto">
                <Receipt size={32} />
              </div>
              <h4 className="text-sm font-black text-slate-700 uppercase">Wali ma jiro dakhli la diwaan gashay</h4>
              <p className="text-xs text-slate-400 font-bold max-w-sm mx-auto uppercase">
                Riix 'Geli Soo Bixitaan' si aad u qorto lacagta maanta ka soo baxday khudaarta.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="py-4 px-6">Taariikhda</th>
                    <th className="py-4 px-6">Macaamiilka / Qofka</th>
                    <th className="py-4 px-6">Lacagta (Amount)</th>
                    <th className="py-4 px-6">Qaabka Bixinta</th>
                    <th className="py-4 px-6">Faahfaahin & Xusuusin</th>
                    <th className="py-4 px-6 text-right">Tallaabo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                  {filteredSales.map(s => (
                    <tr 
                      key={s.id} 
                      onDoubleClick={() => {
                        setEditingSale(s);
                        setSaleAmount(s.amount.toString());
                        setSaleDate(s.date);
                        setSalePaymentMethod(s.paymentMethod || 'Cash');
                        setSaleNotes(s.notes || '');
                        setSaleCustomerName(s.customerName || '');
                        setSaleCustomerId(s.customerId || '');
                        setShowAddSaleModal(true);
                      }}
                      className="hover:bg-amber-50/50 transition-all cursor-pointer"
                      title="Double-click (Labo Taabo) si aad u beddesho ama u editeyso"
                    >
                      <td className="py-4 px-6 font-black text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-slate-400" />
                          {s.date}
                        </div>
                      </td>

                      <td className="py-4 px-6">
                        {s.customerName ? (
                          <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-lg bg-emerald-100 text-emerald-800 font-black text-xs flex items-center justify-center">
                              {s.customerName.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <div className="font-black text-slate-900 text-xs">{s.customerName}</div>
                              <div className="text-[10px] text-slate-400 font-bold">
                                {s.isDebt ? '🔴 Deyn lagu leeyahay' : '🟢 Kaash'}
                              </div>
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-xs font-medium italic">Qof Guud (General)</span>
                        )}
                      </td>

                      <td className="py-4 px-6 font-black text-emerald-600 text-sm whitespace-nowrap">
                        +{formatCurrency(s.amount, currency, rate)}
                      </td>

                      <td className="py-4 px-6 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-lg font-black text-[10px] uppercase border ${
                          s.isDebt || s.paymentMethod === 'Deyn / Credit'
                            ? 'bg-amber-50 text-amber-800 border-amber-200'
                            : 'bg-emerald-50 text-emerald-700 border-emerald-100'
                        }`}>
                          {s.paymentMethod || 'Cash'}
                        </span>
                      </td>

                      <td className="py-4 px-6">
                        {s.notes ? (
                          <div className="text-xs font-bold text-slate-700 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-100 max-w-sm">
                            {s.notes}
                          </div>
                        ) : (
                          <span className="text-slate-300 font-normal">-</span>
                        )}
                      </td>

                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingSale(s);
                              setSaleAmount(s.amount.toString());
                              setSaleDate(s.date);
                              setSalePaymentMethod(s.paymentMethod || 'Cash');
                              setSaleNotes(s.notes || '');
                              setShowAddSaleModal(true);
                            }}
                            className="p-2 hover:bg-slate-100 text-slate-600 rounded-lg transition-all"
                            title="Beddel"
                          >
                            <Edit3 size={15} />
                          </button>

                          <button
                            onClick={() => setDeleteConfirmItem({ id: s.id, type: 'SALE', name: `$${s.amount}` })}
                            className="p-2 hover:bg-rose-50 text-rose-600 rounded-lg transition-all"
                            title="Tirtir"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: EXPENSES TABLE */}
      {activeTab === 'EXPENSES' && (
        <div className="bg-white rounded-[32px] border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight">
                Diwaanka Kharashka Khudaarta (Vegetable Purchases / Expenses)
              </h3>
              <p className="text-xs text-slate-400 font-bold uppercase mt-0.5">
                Raasamaalka ama kharashka lagu soo iibiyay batch-yada khudaarta
              </p>
            </div>

            <button
              onClick={() => {
                setEditingExpense(null);
                setExpTitle('');
                setExpAmount('');
                setExpNotes('');
                setShowAddExpenseModal(true);
              }}
              className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2"
            >
              <Plus size={16} /> Ku Dar Kharash
            </button>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="p-12 text-center space-y-3">
              <div className="w-16 h-16 bg-slate-50 text-slate-300 rounded-3xl flex items-center justify-center mx-auto">
                <TrendingDown size={32} />
              </div>
              <h4 className="text-sm font-black text-slate-700 uppercase">Wali ma jiro kharash la diwaan gashay</h4>
              <p className="text-xs text-slate-400 font-bold max-w-sm mx-auto uppercase">
                Riix 'Ku Dar Kharash' si aad u qorto lacagta aad ku soo iibisay khudaarta.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50/80 border-b border-slate-100 text-[10px] font-black uppercase text-slate-400 tracking-wider">
                    <th className="py-4 px-6">Taariikhda</th>
                    <th className="py-4 px-6">Magaca / Sharraxaad</th>
                    <th className="py-4 px-6">Kharashka (Amount)</th>
                    <th className="py-4 px-6">Xusuusin</th>
                    <th className="py-4 px-6 text-right">Tallaabo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                  {filteredExpenses.map(exp => (
                    <tr 
                      key={exp.id} 
                      onDoubleClick={() => {
                        setEditingExpense(exp);
                        setExpTitle(exp.title);
                        setExpAmount(exp.amount.toString());
                        setExpDate(exp.date);
                        setExpNotes(exp.notes || '');
                        setShowAddExpenseModal(true);
                      }}
                      className="hover:bg-rose-50/50 transition-all cursor-pointer"
                      title="Double-click (Labo Taabo) si aad u editeyso"
                    >
                      <td className="py-4 px-6 font-black text-slate-900 whitespace-nowrap">
                        <div className="flex items-center gap-2">
                          <Calendar size={14} className="text-slate-400" />
                          {exp.date}
                        </div>
                      </td>

                      <td className="py-4 px-6 font-black text-slate-900">
                        {exp.title}
                      </td>

                      <td className="py-4 px-6 font-black text-rose-600 text-sm whitespace-nowrap">
                        -{formatCurrency(exp.amount, currency, rate)}
                      </td>

                      <td className="py-4 px-6 text-slate-500 font-medium">
                        {exp.notes || '-'}
                      </td>

                      <td className="py-4 px-6 text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            onClick={() => {
                              setEditingExpense(exp);
                              setExpTitle(exp.title);
                              setExpAmount(exp.amount.toString());
                              setExpDate(exp.date);
                              setExpNotes(exp.notes || '');
                              setShowAddExpenseModal(true);
                            }}
                            className="p-2 hover:bg-slate-100 text-slate-600 rounded-lg transition-all"
                            title="Beddel"
                          >
                            <Edit3 size={15} />
                          </button>

                          <button
                            onClick={() => setDeleteConfirmItem({ id: exp.id, type: 'EXPENSE', name: exp.title })}
                            className="p-2 hover:bg-rose-50 text-rose-600 rounded-lg transition-all"
                            title="Tirtir"
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SUMMARY REPORT */}
      {activeTab === 'REPORT' && (
        <div className="space-y-6">
          <div className="bg-white p-8 rounded-[32px] border border-slate-100 shadow-sm space-y-6">
            <div className="flex items-center justify-between border-b pb-4 border-slate-100">
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase">
                  Warbixinta Garsoorka & Dhaqdhaqaaqa Khudaarta
                </h3>
                <p className="text-xs text-slate-400 font-bold uppercase mt-0.5">
                  Isbarbardhigga Kharashka vs Dakhliga muddadii la doortay
                </p>
              </div>

              <div className="text-right">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">Muddada</span>
                <span className="text-xs font-black text-slate-800 uppercase bg-slate-100 px-3 py-1 rounded-full">
                  {dateMode}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Financial Breakdown Table */}
              <div className="space-y-4">
                <h4 className="text-xs font-black text-slate-400 uppercase tracking-widest">
                  Koobidda Dhaqdhaqaaqa Financial
                </h4>

                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200/60 space-y-3">
                  <div className="flex items-center justify-between text-xs font-bold border-b border-slate-200 pb-2">
                    <span className="text-slate-600">Warta Kharashka Khudaarta (Total Expense):</span>
                    <span className="text-rose-600 font-black">{formatCurrency(totalExpenses, currency, rate)}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs font-bold border-b border-slate-200 pb-2">
                    <span className="text-slate-600">Warta Dakhliga Soo Baxay (Total Sales):</span>
                    <span className="text-emerald-600 font-black">{formatCurrency(totalSales, currency, rate)}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm font-black pt-1">
                    <span className="text-slate-800">Xaaladda Natiijada (Final Status):</span>
                    <span className={isProfit ? 'text-emerald-600' : 'text-rose-600'}>
                      {isProfit ? '+' : ''}{formatCurrency(netBalance, currency, rate)}
                    </span>
                  </div>
                </div>

                <div className="p-4 bg-amber-50 border border-amber-200 text-amber-900 rounded-2xl text-xs space-y-1">
                  <span className="font-black uppercase flex items-center gap-1.5 text-amber-800">
                    <AlertCircle size={16} /> Tilmaam Gaar ah:
                  </span>
                  <p className="font-medium text-[11px] leading-relaxed">
                    Ujeedada xisaabtan gudaheeda ah waa inay dakhliga maalin kasta ka soo baxa khudaarta uu si joogto ah u dhimayo kharashka ilaa ay iska sifeyso. Natiijada ka soo baxda ma saamayso xisaabta guud ee dukaanka kale.
                  </p>
                </div>
              </div>

              {/* Status Graphic & Stats */}
              <div className="bg-slate-900 text-white p-6 rounded-2xl flex flex-col justify-between space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-emerald-400 text-xs font-black uppercase tracking-widest">
                    <Sparkles size={16} /> Natiijada Xisaabinta
                  </div>
                  <h3 className="text-xl font-black uppercase">
                    {isProfit ? "Xisaabtu Waa Faa'iido!" : "Xisaabtu Waa Minus Kharash ah"}
                  </h3>
                  <p className="text-xs text-slate-300 leading-relaxed font-medium">
                    {isProfit
                      ? `Marka kharashka ${formatCurrency(totalExpenses, currency, rate)} laga jaray dakhliga, waxaa soo baxday faa'iido oo dhan ${formatCurrency(netBalance, currency, rate)}.`
                      : `Marka dakhliga ${formatCurrency(totalSales, currency, rate)} laga jaray kharashka, waxaa wali dhiman kharash oo dhan ${formatCurrency(Math.abs(netBalance), currency, rate)}.`
                    }
                  </p>
                </div>

                <div className="pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-bold text-slate-400">
                  <span>Khudaar Sales: {filteredSales.length} entries</span>
                  <span>Khudaar Expenses: {filteredExpenses.length} entries</span>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT EXPENSE */}
      {showAddExpenseModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-[32px] p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6 animate-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b pb-4 border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-50 text-rose-600 rounded-2xl">
                  <TrendingDown size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 uppercase">
                    {editingExpense ? 'Beddel Kharashka' : 'Ku Dar Kharash Khudaarta'}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Lacagta lagu soo iibiyay khudaarta
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddExpenseModal(false)}
                className="p-1 hover:bg-slate-100 rounded-xl text-slate-400"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                  Magaca Kharashka / Batch Name
                </label>
                <input 
                  type="text"
                  required
                  placeholder="E.g. Yaanyo, Basal & Baradho Cusub"
                  value={expTitle}
                  onChange={e => setExpTitle(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs text-slate-800 outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                  Kharashka ($ USD)
                </label>
                <input 
                  type="number"
                  step="0.01"
                  required
                  placeholder="0.00"
                  value={expAmount}
                  onChange={e => setExpAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-black text-sm text-slate-900 outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                  Taariikhda (Date)
                </label>
                <input 
                  type="date"
                  required
                  value={expDate}
                  onChange={e => setExpDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs text-slate-800 outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                  Xusuusin / Notes (Sida Tuulada ama Qaadka)
                </label>
                <textarea 
                  rows={2}
                  placeholder="Faahfaahin dheeraad ah..."
                  value={expNotes}
                  onChange={e => setExpNotes(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs text-slate-800 outline-none focus:ring-2 focus:ring-rose-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-rose-600/30 transition-all active:scale-95"
              >
                {editingExpense ? 'Kaydi Beddelka' : 'Kaydi Kharashka'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: ADD / EDIT DAILY SALE */}
      {showAddSaleModal && (
        <div className="fixed inset-0 z-[250] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm print:hidden">
          <div className="bg-white rounded-[32px] p-6 md:p-8 max-w-md w-full shadow-2xl space-y-6 animate-in zoom-in duration-200">
            <div className="flex items-center justify-between border-b pb-4 border-slate-100">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-50 text-emerald-600 rounded-2xl">
                  <Receipt size={22} />
                </div>
                <div>
                  <h3 className="text-base font-black text-slate-800 uppercase">
                    {editingSale ? 'Beddel Soo Bixitaanka' : 'Ku Dar Soo Bixitaan Maalinle Ah'}
                  </h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase">
                    Dakhliga ka soo baxay khudaarta ee jaraya kharashka
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowAddSaleModal(false)}
                className="p-1 hover:bg-slate-100 rounded-xl text-slate-400"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleSaveSale} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                  Lacagta Soo Baxday ($ USD)
                </label>
                <input 
                  type="number"
                  step="0.01"
                  required
                  autoFocus
                  placeholder="0.00"
                  value={saleAmount}
                  onChange={e => setSaleAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-black text-sm text-slate-900 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                  Taariikhda (Date)
                </label>
                <input 
                  type="date"
                  required
                  value={saleDate}
                  onChange={e => setSaleDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                  Qaabka Lacagta (Payment Method)
                </label>
                <select
                  value={salePaymentMethod}
                  onChange={e => {
                    const val = e.target.value;
                    setSalePaymentMethod(val);
                    if (val === 'Deyn / Credit') {
                      setSaleIsDebt(true);
                    } else {
                      setSaleIsDebt(false);
                    }
                  }}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                >
                  <option value="Cash">Cash / Kaash</option>
                  <option value="Zaad / EVC / Sahal">Zaad / EVC Plus / Sahal</option>
                  <option value="Bank Transfer">Bank Transfer</option>
                  <option value="Deyn / Credit">Deyn / Credit (Ku Qor Deyn Macamiil)</option>
                  <option value="Other">Kalle (Other)</option>
                </select>
              </div>

              {/* Customer selection for Sale (Optional) */}
              <div className="p-4 bg-amber-50/70 border border-amber-200 rounded-2xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-900 uppercase">👤 Dooro ama Geli Macamiil (Optional / Doorasho)</span>
                  <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                    {salePaymentMethod === 'Deyn / Credit' || saleIsDebt ? 'Deyn Automatic Qoris' : 'Macamiil Qoris'}
                  </span>
                </div>

                {/* Existing Customers dropdown */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase">Macamiilka Diwaan-gashan (Existing Customer - Optional)</label>
                  <select
                    value={saleCustomerId}
                    onChange={e => {
                      const custId = e.target.value;
                      setSaleCustomerId(custId);
                      const found = data.customers.find(c => c.id === custId);
                      if (found) {
                        setSaleCustomerName(found.name);
                      } else {
                        setSaleCustomerName('');
                      }
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800"
                  >
                    <option value="">-- Dooro Macamiil (Hadii uu jiro) --</option>
                    {data.customers.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.phone || 'No Phone'}) - Debt: ${c.debtBalance}</option>
                    ))}
                  </select>
                </div>

                {/* Manual Customer Name input */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase">Ama Geli Magac Macamiil Cusub (Optional)</label>
                  <input
                    type="text"
                    placeholder="E.g. Maxamed Cali (Waa la ka tagi karaa)"
                    value={saleCustomerName}
                    onChange={e => {
                      setSaleCustomerName(e.target.value);
                      if (!e.target.value) setSaleCustomerId('');
                    }}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none"
                  />
                </div>

                {/* Live Total Remaining Debt calculation banner */}
                {(() => {
                  const matchedCust = data.customers.find(c => 
                    (saleCustomerId && c.id === saleCustomerId) || 
                    (saleCustomerName.trim() && c.name.toLowerCase() === saleCustomerName.trim().toLowerCase())
                  );
                  const enterAmt = parseFloat(saleAmount) || 0;
                  const isDebt = salePaymentMethod === 'Deyn / Credit' || saleIsDebt;

                  if (matchedCust) {
                    return (
                      <div className="p-3 bg-amber-100/90 border border-amber-300 rounded-xl space-y-1 text-amber-950 font-bold text-xs mt-2">
                        <div className="flex justify-between items-center text-[11px] text-amber-900">
                          <span>Deynta Hore ee Macamiilka (Previous Debt):</span>
                          <span className="font-black text-rose-700">{formatCurrency(matchedCust.debtBalance, currency, rate)}</span>
                        </div>
                        {isDebt && (
                          <>
                            <div className="flex justify-between items-center text-[11px] text-amber-900">
                              <span>Khudaarta Cusub (New Khudaar Debt):</span>
                              <span className="font-black text-amber-800">+{formatCurrency(enterAmt, currency, rate)}</span>
                            </div>
                            <div className="flex justify-between items-center text-xs font-black pt-1 border-t border-amber-300/80 text-slate-900">
                              <span>Total Remaining Debt (Deynta Guud ee Cusub):</span>
                              <span className="text-sm font-extrabold text-rose-800">{formatCurrency(matchedCust.debtBalance + enterAmt, currency, rate)}</span>
                            </div>
                          </>
                        )}
                      </div>
                    );
                  } else if (saleCustomerName.trim() && isDebt) {
                    return (
                      <div className="p-3 bg-emerald-100/90 border border-emerald-300 rounded-xl space-y-1 text-emerald-950 font-bold text-xs mt-2">
                        <p className="text-[11px] font-black text-emerald-900">✨ Macamiil Cusub oo Diwaan-geli doona:</p>
                        <div className="flex justify-between items-center text-xs font-black text-slate-900">
                          <span>Total Initial Debt (Deynta Ugu Horeysa):</span>
                          <span className="text-sm font-extrabold text-rose-800">{formatCurrency(enterAmt, currency, rate)}</span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">
                  Xusuusin / Notes
                </label>
                <textarea 
                  rows={2}
                  placeholder="Faahfaahinta maanta..."
                  value={saleNotes}
                  onChange={e => setSaleNotes(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-xs text-slate-800 outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <button
                type="submit"
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-emerald-600/30 transition-all active:scale-95"
              >
                {editingSale ? 'Kaydi Beddelka' : 'Kaydi Soo Bixitaanka'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      <ConfirmModal 
        isOpen={!!deleteConfirmItem}
        title="Ma hubtaa inaad tirtirto?"
        message={`Ma hubtaa inaad tirtirto entry-kan (${deleteConfirmItem?.name})? Waxaa loo rarayaa Recycle Bin-ka si aad usoo celin karto.`}
        confirmText="Haa, Tirtir"
        cancelText="Kansal"
        onConfirm={handleConfirmDelete}
        onClose={() => setDeleteConfirmItem(null)}
      />

    </div>
  );
};
