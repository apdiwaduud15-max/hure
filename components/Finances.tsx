import React, { useState, useMemo } from 'react';
import { AppData, Currency, Expense, AccountType, Account } from '../types';
import { 
  Plus, 
  Search, 
  TrendingDown, 
  TrendingUp, 
  DollarSign, 
  Camera, 
  FileText, 
  Trash2, 
  X, 
  Wallet, 
  Landmark, 
  Smartphone, 
  ArrowRightLeft, 
  Eye, 
  Calendar,
  Layers,
  PieChart as PieChartIcon,
  Download,
  Filter,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { formatCurrency, compressImage, generateId } from '../lib/utils';
import ConfirmModal from './ConfirmModal';
import AccountTransferModal from './AccountTransferModal';
import AccountStatementModal from './AccountStatementModal';

interface Props {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  addLog: (action: string, details: string) => void;
  currency: Currency;
}

type TimeFilter = 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH' | 'ALL' | 'CUSTOM';

const Finances: React.FC<Props> = ({ data, setData, addLog, currency }) => {
  const [showModal, setShowModal] = useState(false);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [accountFilter, setAccountFilter] = useState('ALL');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('TODAY');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [deleteConfirmExpense, setDeleteConfirmExpense] = useState<Expense | null>(null);

  // Transfer & Statement state
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferDefaultFromId, setTransferDefaultFromId] = useState<string>('');
  const [selectedStatementAcc, setSelectedStatementAcc] = useState<Account | null>(null);

  const [formData, setFormData] = useState<{
    category: string;
    description: string;
    amount: number;
    currency: Currency;
    accountId: string;
    receipt: string;
    date: string;
  }>({
    category: 'General',
    description: '',
    amount: 0,
    currency: currency,
    accountId: '',
    receipt: '',
    date: new Date().toISOString().slice(0, 16)
  });

  const rate = data.settings.exchangeRate || 190;

  // Time boundaries
  const { startTime, endTime, filterLabel } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    const todayEnd = new Date(today).setHours(23, 59, 59, 999);

    switch (timeFilter) {
      case 'TODAY':
        return { 
          startTime: todayStart, 
          endTime: Date.now() + 86400000, 
          filterLabel: 'Maanta (Today)' 
        };
      case 'YESTERDAY': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yStart = yesterday.getTime();
        const yEnd = todayStart - 1;
        return { 
          startTime: yStart, 
          endTime: yEnd, 
          filterLabel: 'Shalay (Yesterday)' 
        };
      }
      case 'WEEK': {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return { 
          startTime: weekAgo.getTime(), 
          endTime: Date.now() + 86400000, 
          filterLabel: '7-dii Maalmood ee Ugu Dambeeyay (This Week)' 
        };
      }
      case 'MONTH': {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return { 
          startTime: monthAgo.getTime(), 
          endTime: Date.now() + 86400000, 
          filterLabel: '30-kii Maalmood ee Ugu Dambeeyay (This Month)' 
        };
      }
      case 'CUSTOM': {
        const s = customStartDate ? new Date(customStartDate).setHours(0, 0, 0, 0) : 0;
        const e = customEndDate ? new Date(customEndDate).setHours(23, 59, 59, 999) : Date.now() + 86400000;
        return { 
          startTime: s, 
          endTime: e, 
          filterLabel: 'Taariikh Khaas ah (Custom Range)' 
        };
      }
      case 'ALL':
      default:
        return { 
          startTime: 0, 
          endTime: Date.now() + 86400000, 
          filterLabel: 'Dhammaan (All Time)' 
        };
    }
  }, [timeFilter, customStartDate, customEndDate]);

  const handleReceipt = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await compressImage(file);
      setFormData({ ...formData, receipt: base64 });
    }
  };

  const saveExpense = () => {
    if (!formData.description || !formData.amount || !formData.accountId) {
      return alert("Description, Amount, and Funding Account are all required.");
    }

    const selectedAccount = data.accounts.find(a => a.id === formData.accountId);
    if (selectedAccount && selectedAccount.balance < (formData.amount || 0)) {
      if (!confirm(`Warning: The selected account (${selectedAccount.name}) has insufficient funds. Record anyway?`)) return;
    }

    const expenseTimestamp = formData.date ? new Date(formData.date).getTime() : Date.now();

    const newExpense: Expense = {
      id: generateId(),
      category: formData.category || 'General',
      description: formData.description,
      amount: formData.amount,
      currency: formData.currency || currency,
      accountId: formData.accountId,
      timestamp: expenseTimestamp,
      receipt: formData.receipt
    };

    setData(prev => ({
      ...prev,
      expenses: [newExpense, ...prev.expenses],
      accounts: prev.accounts.map(a => 
        a.id === formData.accountId ? { ...a, balance: a.balance - (formData.amount || 0) } : a
      )
    }));

    addLog('Add Expense', `Recorded expense: ${formData.description}. Deducted ${formatCurrency(formData.amount || 0, currency, rate)} from ${selectedAccount?.name}`);
    setShowModal(false);
    setFormData({ 
      category: 'General', 
      description: '', 
      amount: 0, 
      currency: currency, 
      accountId: '', 
      receipt: '',
      date: new Date().toISOString().slice(0, 16)
    });
  };

  const deleteExpense = (expense: Expense) => {
    setDeleteConfirmExpense(expense);
  };

  // Filtered Expenses by Date, Category, Account, and Search Term
  const filteredExpenses = useMemo(() => {
    return (data.expenses || []).filter(e => {
      // 1. Date Filter
      if (e.timestamp < startTime || e.timestamp > endTime) return false;

      // 2. Category Filter
      if (categoryFilter !== 'ALL' && e.category !== categoryFilter) return false;

      // 3. Account Filter
      if (accountFilter !== 'ALL' && e.accountId !== accountFilter) return false;

      // 4. Search Filter
      if (search) {
        const term = search.toLowerCase();
        const accName = data.accounts.find(a => a.id === e.accountId)?.name?.toLowerCase() || '';
        const matchDesc = e.description.toLowerCase().includes(term);
        const matchCat = e.category.toLowerCase().includes(term);
        const matchAcc = accName.includes(term);
        if (!matchDesc && !matchCat && !matchAcc) return false;
      }

      return true;
    });
  }, [data.expenses, startTime, endTime, categoryFilter, accountFilter, search, data.accounts]);

  // Period Metrics (Income vs Expenses)
  const periodMetrics = useMemo(() => {
    const totalExp = filteredExpenses.reduce((acc, e) => acc + (e.amount || 0), 0);

    // Period Sales Income (exclude expenses/supplier payments)
    const periodSales = (data.transactions || []).filter(tx => {
      if (tx.timestamp < startTime || tx.timestamp > endTime) return false;
      if (tx.type === 'EXPENSE' || !!tx.supplierId || tx.items?.some(i => i.sku === 'SUPPLIER_PAYMENT')) return false;
      return true;
    });

    const totalIncome = periodSales.reduce((acc, tx) => acc + (tx.total || 0), 0);
    const netCashFlow = totalIncome - totalExp;

    // Categories breakdown
    const categoryMap: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      const c = e.category || 'General';
      categoryMap[c] = (categoryMap[c] || 0) + e.amount;
    });

    // Account Outflow breakdown
    const accountMap: Record<string, number> = {};
    filteredExpenses.forEach(e => {
      const acc = data.accounts.find(a => a.id === e.accountId)?.name || 'Unknown Account';
      accountMap[acc] = (accountMap[acc] || 0) + e.amount;
    });

    return {
      totalExp,
      totalIncome,
      netCashFlow,
      count: filteredExpenses.length,
      categoryMap,
      accountMap
    };
  }, [filteredExpenses, data.transactions, data.accounts, startTime, endTime]);

  const allCategories = useMemo(() => {
    const set = new Set<string>();
    (data.expenses || []).forEach(e => {
      if (e.category) set.add(e.category);
    });
    return ['ALL', ...Array.from(set)];
  }, [data.expenses]);

  const getAccountIcon = (accountId: string) => {
    const acc = data.accounts.find(a => a.id === accountId);
    if (!acc) return <Wallet size={12} />;
    const name = acc.name.toLowerCase();
    if (name.includes('bank')) return <Landmark size={12} className="text-blue-500"/>;
    if (name.includes('mobile')) return <Smartphone size={12} className="text-purple-500"/>;
    return <DollarSign size={12} className="text-emerald-500" />;
  };

  const handleExportCSV = () => {
    const headers = ['Taariikh', 'Faahfaahin', 'Qaybta (Category)', 'Akoonka Laga Bixiyay', 'Cadadka'];
    const rows = filteredExpenses.map(e => [
      new Date(e.timestamp).toLocaleString(),
      `"${e.description.replace(/"/g, '""')}"`,
      `"${e.category.replace(/"/g, '""')}"`,
      `"${(data.accounts.find(a => a.id === e.accountId)?.name || 'Unknown').replace(/"/g, '""')}"`,
      e.amount.toFixed(2)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Expenses_Report_${timeFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto font-sans no-print">
      {/* 1. Header & Time Filter Bar */}
      <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-200/80 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-rose-600 via-rose-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/20 flex-shrink-0">
            <TrendingDown size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight uppercase">
                Dakhliga & Kharashyada (Income & Expenses)
              </h1>
              <span className="px-2.5 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-black uppercase rounded-full tracking-wider">
                Live Filtered
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Xisaabi kharashyada maanta, shalay, toddobaadkan, bishan, ama taariikh kasta oo gaar ah.
            </p>
          </div>
        </div>

        {/* Time Filters */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-full lg:w-auto">
          {[
            { key: 'TODAY', label: 'Maanta' },
            { key: 'YESTERDAY', label: 'Shalay' },
            { key: 'WEEK', label: 'Asbuuca' },
            { key: 'MONTH', label: 'Bishan' },
            { key: 'ALL', label: 'Dhammaan' },
            { key: 'CUSTOM', label: 'Custom Date' }
          ].map(btn => (
            <button
              key={btn.key}
              onClick={() => setTimeFilter(btn.key as TimeFilter)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                timeFilter === btn.key 
                  ? 'bg-rose-600 text-white shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Range Picker */}
      {timeFilter === 'CUSTOM' && (
        <div className="bg-rose-50/80 border border-rose-200 rounded-2xl p-4 flex flex-wrap items-center gap-4 animate-in fade-in">
          <div className="flex items-center gap-2 text-xs font-bold text-rose-900">
            <Calendar size={16} /> Taariikhda Bilowga:
            <input 
              type="date" 
              value={customStartDate} 
              onChange={e => setCustomStartDate(e.target.value)} 
              className="bg-white border border-rose-300 rounded-lg px-2.5 py-1 text-xs font-semibold"
            />
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-rose-900">
            <Calendar size={16} /> Taariikhda Dhamaadka:
            <input 
              type="date" 
              value={customEndDate} 
              onChange={e => setCustomEndDate(e.target.value)} 
              className="bg-white border border-rose-300 rounded-lg px-2.5 py-1 text-xs font-semibold"
            />
          </div>
        </div>
      )}

      {/* 2. Top Summary KPI Cards (Income vs Expenses vs Net Cash Flow) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Expenses for Period */}
        <div className="bg-white rounded-[28px] p-5 border border-rose-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-rose-600 uppercase tracking-widest">
              Wadarta Kharashyada ({filterLabel})
            </span>
            <div className="w-8 h-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
              <TrendingDown size={18} />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-black text-rose-700">
            -{formatCurrency(periodMetrics.totalExp, currency, rate)}
          </div>
          <p className="text-[11px] text-slate-400 font-bold">
            {periodMetrics.count} Kharash oo la diiwaangaliyay
          </p>
        </div>

        {/* Total Sales Income for Period */}
        <div className="bg-white rounded-[28px] p-5 border border-emerald-100 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
              Dakhliga Iibka ({filterLabel})
            </span>
            <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <TrendingUp size={18} />
            </div>
          </div>
          <div className="text-2xl md:text-3xl font-black text-emerald-700">
            +{formatCurrency(periodMetrics.totalIncome, currency, rate)}
          </div>
          <p className="text-[11px] text-slate-400 font-bold">
            Wadarta iibka guud ee mudadaas
          </p>
        </div>

        {/* Net Cash Flow / Income */}
        <div className="bg-white rounded-[28px] p-5 border border-slate-200 shadow-sm space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Dakhliga Saafiga Ah (Net Cash Flow)
            </span>
            <div className={`w-8 h-8 rounded-xl flex items-center justify-center ${
              periodMetrics.netCashFlow >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
            }`}>
              <DollarSign size={18} />
            </div>
          </div>
          <div className={`text-2xl md:text-3xl font-black ${
            periodMetrics.netCashFlow >= 0 ? 'text-emerald-700' : 'text-rose-700'
          }`}>
            {formatCurrency(periodMetrics.netCashFlow, currency, rate)}
          </div>
          <p className="text-[11px] text-slate-400 font-bold">
            Iibka Guud - Kharashyada
          </p>
        </div>

        {/* Quick Action Buttons */}
        <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[28px] p-5 text-white shadow-md flex flex-col justify-between space-y-3">
          <div>
            <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest block">
              Diiwaangeli Kharash Cusub
            </span>
            <p className="text-xs text-slate-400 mt-0.5">Ku dar kharash sanduuqa ama bankiga.</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setTransferDefaultFromId(''); setShowTransferModal(true); }}
              className="flex-1 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold flex items-center justify-center gap-1 transition-all"
            >
              <ArrowRightLeft size={14} /> Isu-shub
            </button>
            <button
              onClick={() => setShowModal(true)}
              className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-500 text-white rounded-xl text-xs font-black flex items-center justify-center gap-1 transition-all shadow-md"
            >
              <Plus size={14} /> Add Expense
            </button>
          </div>
        </div>
      </div>

      {/* 3. Account Balances Strip */}
      <div className="bg-white rounded-[32px] border border-slate-200 p-5 space-y-3 shadow-xs">
        <div className="flex justify-between items-center px-1">
          <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Wallet size={16} className="text-blue-600" /> Account Balances (Guji si aad u aragto Dhaqdhaqaaqa)
          </h3>
          <span className="text-[10px] text-slate-400 font-bold">💡 Guji akoon kasta si aad u aragto xisaab-xidhkiisa</span>
        </div>
        
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
          {data.accounts.map(acc => (
            <div
              key={acc.id}
              onClick={() => setSelectedStatementAcc(acc)}
              className="p-3.5 bg-slate-50 hover:bg-blue-50/60 border border-slate-200 hover:border-blue-300 rounded-2xl transition-all cursor-pointer group"
              title="Click si aad u aragto dhaqdhaqaaqa akoonka"
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-[10px] font-black text-slate-400 uppercase truncate max-w-[80px]">{acc.type}</span>
                <Eye size={12} className="text-slate-400 group-hover:text-blue-600 transition-colors" />
              </div>
              <p className="font-black text-xs text-slate-900 truncate">{acc.name}</p>
              <p className={`font-black font-mono text-xs mt-1 ${acc.balance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {formatCurrency(acc.balance, currency, rate)}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Filter & Search Controls */}
      <div className="bg-white rounded-[32px] p-6 border border-slate-200/90 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex-1 max-w-md relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Raadi kharash, qayb, ama akoon..." 
              className="w-full pl-12 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none focus:ring-2 focus:ring-rose-500 font-bold text-xs"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Category Filter */}
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
            >
              <option value="ALL">Qaybaha oo dhan</option>
              {allCategories.filter(c => c !== 'ALL').map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Account Filter */}
            <select
              value={accountFilter}
              onChange={e => setAccountFilter(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-700 outline-none"
            >
              <option value="ALL">Akoonnada oo dhan</option>
              {data.accounts.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>

            <button
              onClick={handleExportCSV}
              className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black rounded-xl text-xs flex items-center gap-1.5 transition-all"
            >
              <Download size={14} /> Export CSV
            </button>
          </div>
        </div>

        {/* Expenses Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-400 font-black uppercase tracking-wider text-[10px]">
                <th className="p-3.5">Taariikhda</th>
                <th className="p-3.5">Faahfaahinta Kharashka</th>
                <th className="p-3.5">Akoonka Laga Bixiyay</th>
                <th className="p-3.5">Qaybta (Category)</th>
                <th className="p-3.5 text-right">Cadadka</th>
                <th className="p-3.5 text-right">Ficil (Action)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredExpenses.map(e => (
                <tr key={e.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="p-3.5 text-slate-500 font-mono text-[11px] whitespace-nowrap">
                    {new Date(e.timestamp).toLocaleDateString()}{' '}
                    <span className="text-slate-400">
                      {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </td>
                  <td className="p-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center text-rose-600 shadow-xs flex-shrink-0">
                        <TrendingDown size={16} />
                      </div>
                      <div>
                        <p className="font-bold text-slate-900">{e.description}</p>
                        {e.receipt && (
                          <a 
                            href={e.receipt} 
                            target="_blank" 
                            rel="noreferrer" 
                            className="text-[10px] text-blue-600 font-bold flex items-center gap-1 mt-0.5 hover:underline"
                          >
                            <FileText size={10} /> Fiiri Rasiidka
                          </a>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-3.5 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <div className="p-1.5 bg-slate-100 rounded-lg">
                        {getAccountIcon(e.accountId)}
                      </div>
                      <span className="text-xs font-bold text-slate-700">
                        {data.accounts.find(a => a.id === e.accountId)?.name || 'Unknown Account'}
                      </span>
                    </div>
                  </td>
                  <td className="p-3.5 whitespace-nowrap">
                    <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-lg text-[10px] font-black uppercase tracking-tight">
                      {e.category}
                    </span>
                  </td>
                  <td className="p-3.5 font-black text-rose-600 text-right font-mono text-sm whitespace-nowrap">
                    -{formatCurrency(e.amount, currency, rate)}
                  </td>
                  <td className="p-3.5 text-right whitespace-nowrap">
                    <button 
                      onClick={(ev) => { ev.stopPropagation(); deleteExpense(e); }} 
                      className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                      title="Tirtir Kharashka & Dib ugu celi akoonka"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {filteredExpenses.length === 0 && (
            <div className="py-16 text-center flex flex-col items-center justify-center opacity-60">
              <TrendingDown size={40} className="text-slate-300 mb-2" />
              <p className="text-slate-400 font-black uppercase text-xs tracking-widest">
                Wax kharash ah lagama helin mudada {filterLabel}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black tracking-tight">Diiwaangeli Kharash Cusub</h3>
                <p className="text-xs text-slate-400 font-semibold">Record Store Expense Outflow</p>
              </div>
              <button onClick={() => setShowModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Faahfaahinta Kharashka</label>
                <input 
                  type="text" 
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs" 
                  value={formData.description} 
                  onChange={e => setFormData({...formData, description: e.target.value})} 
                  placeholder="tusaale: Kirada dukaanka, Koronto, Mushahar..." 
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Cadadka ({currency})</label>
                  <input 
                    type="number" 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs" 
                    value={formData.amount || ''} 
                    onChange={e => setFormData({...formData, amount: parseFloat(e.target.value) || 0})} 
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Qaybta (Category)</label>
                  <select 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs" 
                    value={formData.category} 
                    onChange={e => setFormData({...formData, category: e.target.value})}
                  >
                    <option value="General">General</option>
                    <option value="Rent">Rent (Kiro)</option>
                    <option value="Utilities">Utilities (Koronto/Biyo)</option>
                    <option value="Salary">Salary (Mushahar)</option>
                    <option value="Inventory">Inventory (Alaab Keenid)</option>
                    <option value="Marketing">Marketing (Xayeysiin)</option>
                    <option value="Maintenance">Maintenance (Dayactir)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1 flex items-center gap-1.5">
                   <Wallet size={12} className="text-rose-600" /> Akoonka Lacagta Laga Jarayo (Funding Account)
                </label>
                <select 
                  className="w-full px-4 py-3 bg-rose-50 border border-rose-200 rounded-2xl outline-none font-bold text-xs text-rose-900"
                  value={formData.accountId}
                  onChange={e => setFormData({...formData, accountId: e.target.value})}
                >
                  <option value="">Dooro Akoonka...</option>
                  {data.accounts.filter(a => a.type === AccountType.ASSET || a.type === AccountType.OTHER_CURRENT_ASSET).map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name} ({formatCurrency(acc.balance, currency, rate)})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Taariikhda Kharashka</label>
                <input 
                  type="datetime-local" 
                  value={formData.date} 
                  onChange={e => setFormData({...formData, date: e.target.value})} 
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Sawirka Rasiidka (Receipt)</label>
                <div className="relative h-24 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center overflow-hidden hover:border-rose-500 transition-all">
                  {formData.receipt ? (
                    <img src={formData.receipt} className="w-full h-full object-cover" alt="Receipt preview" />
                  ) : (
                    <>
                      <Camera size={20} className="text-slate-300 mb-1" />
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">Click to upload receipt</p>
                    </>
                  )}
                  <input type="file" accept="image/*" onChange={handleReceipt} className="absolute inset-0 opacity-0 cursor-pointer" />
                </div>
              </div>
            </div>
            
            <div className="p-6 pt-0 flex gap-3">
              <button onClick={() => setShowModal(false)} className="flex-1 py-3 text-xs font-black text-slate-400 hover:text-slate-600">
                Kansal
              </button>
              <button onClick={saveExpense} className="flex-1 py-3 bg-rose-600 hover:bg-rose-500 text-white rounded-2xl text-xs font-black shadow-lg">
                Kaydi Kharashka
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Delete Expense Modal */}
      <ConfirmModal
        isOpen={!!deleteConfirmExpense}
        title="Ma hubtaa inaad tirtirto kharashkan?"
        message={`Ma hubtaa inaad tirtirto kharashka: "${deleteConfirmExpense?.description}"? Lacagta ${deleteConfirmExpense ? formatCurrency(deleteConfirmExpense.amount, currency, rate) : ''} waxaa dib loogu celin doonaa account-ka.`}
        confirmText="Haa (Tirtir)"
        cancelText="Maya (Kansal)"
        onConfirm={() => {
          if (deleteConfirmExpense) {
            const expense = deleteConfirmExpense;
            setData(prev => {
              const newExpenses = prev.expenses.filter(item => item.id !== expense.id);
              const newAccounts = prev.accounts.map(a => 
                a.id === expense.accountId ? { ...a, balance: a.balance + expense.amount } : a
              );
              
              const newLog = {
                id: generateId(),
                action: 'Delete Expense',
                details: `Removed expense: ${expense.description}. Refunded ${expense.amount} to account.`,
                timestamp: Date.now(),
                user: prev.settings.currentUser.name
              };

              const binItem = {
                id: generateId(),
                type: 'EXPENSE' as const,
                deletedAt: Date.now(),
                title: `${expense.category}: ${expense.description} ($${expense.amount})`,
                description: `Category: ${expense.category} • Amount: $${expense.amount} • Date: ${new Date(expense.timestamp).toLocaleDateString()}`,
                originalData: expense
              };
              
              const updatedDeletedIds = { ...(prev.deletedIds || {}) };
              updatedDeletedIds[expense.id] = Date.now();

              return {
                ...prev,
                expenses: newExpenses,
                accounts: newAccounts,
                auditLogs: [newLog, ...prev.auditLogs],
                recycleBin: [binItem, ...(prev.recycleBin || [])],
                deletedIds: updatedDeletedIds
              };
            });
            setDeleteConfirmExpense(null);
          }
        }}
        onClose={() => setDeleteConfirmExpense(null)}
      />

      {/* Account to Account Money Transfer Modal */}
      <AccountTransferModal
        isOpen={showTransferModal}
        onClose={() => setShowTransferModal(false)}
        data={data}
        setData={setData}
        addLog={addLog}
        currency={currency}
        defaultFromAccountId={transferDefaultFromId}
      />

      {/* Account Full Movement Statement Modal */}
      <AccountStatementModal
        account={selectedStatementAcc}
        onClose={() => setSelectedStatementAcc(null)}
        data={data}
        setData={setData}
        addLog={addLog}
        currency={currency}
        rate={rate}
        onOpenTransfer={(accId) => {
          setTransferDefaultFromId(accId);
          setShowTransferModal(true);
        }}
      />
    </div>
  );
};

export default Finances;
