import React, { useState, useMemo } from 'react';
import { AppData, Currency, Expense } from '../types';
import { formatCurrency, generateId } from '../lib/utils';
import { 
  Receipt, 
  PlusCircle, 
  Trash2, 
  Calendar, 
  DollarSign, 
  Briefcase, 
  Zap, 
  Trash, 
  Coffee, 
  Droplet, 
  Building, 
  Wrench, 
  Truck, 
  Layers, 
  CheckCircle2, 
  AlertCircle, 
  Search, 
  Printer, 
  X,
  CreditCard,
  PieChart,
  ArrowRight
} from 'lucide-react';

interface Props {
  data: AppData;
  currency: Currency;
  setData?: React.Dispatch<React.SetStateAction<AppData>>;
  addLog?: (action: string, details: string) => void;
}

const SOMALI_DAYS = ['Axad', 'Isniin', 'Talaado', 'Arbaco', 'Khamiis', 'Jimce', 'Sabti'];

// Preset expense categories with icons and colors
export const EXPENSE_CATEGORIES = [
  { id: 'Mushaharka', label: 'Mushaharka (Salaries)', icon: Briefcase, color: 'bg-blue-50 text-blue-700 border-blue-200 hover:bg-blue-100' },
  { id: 'Korontada', label: 'Biilka Korontada (Electricity)', icon: Zap, color: 'bg-amber-50 text-amber-700 border-amber-200 hover:bg-amber-100' },
  { id: 'Qashinka', label: 'Qashinka (Garbage & Cleaning)', icon: Trash, color: 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100' },
  { id: 'Shaaha', label: 'Shaaha & Cuntada (Tea & Meals)', icon: Coffee, color: 'bg-orange-50 text-orange-700 border-orange-200 hover:bg-orange-100' },
  { id: 'Biyaha', label: 'Biilka Biyaha (Water Bill)', icon: Droplet, color: 'bg-cyan-50 text-cyan-700 border-cyan-200 hover:bg-cyan-100' },
  { id: 'Kirada', label: 'Kirada Dukaanka (Rent)', icon: Building, color: 'bg-purple-50 text-purple-700 border-purple-200 hover:bg-purple-100' },
  { id: 'Dayactirka', label: 'Dayactirka (Maintenance/Repairs)', icon: Wrench, color: 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100' },
  { id: 'Gaadiidka', label: 'Gaadiidka & Shidaalka (Transport)', icon: Truck, color: 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100' },
  { id: 'Other', label: 'Kharash Kale (Other Expenses)', icon: Layers, color: 'bg-rose-50 text-rose-700 border-rose-200 hover:bg-rose-100' }
];

export const DashboardExpenseManager: React.FC<Props> = ({
  data,
  currency,
  setData,
  addLog
}) => {
  const rate = data.settings.exchangeRate || 1;

  // Form State
  const [selectedCategory, setSelectedCategory] = useState<string>('Mushaharka');
  const [amount, setAmount] = useState<number | ''>('');
  const [currencyMode, setCurrencyMode] = useState<'USD' | 'ETB'>('USD');
  const [description, setDescription] = useState<string>('');
  const [accountId, setAccountId] = useState<string>(data.accounts?.[0]?.id || '');
  const [expenseDate, setExpenseDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected expense for modal viewing
  const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
  const [isVoucherOpen, setIsVoucherOpen] = useState(false);

  // Quick category selection handler
  const handleSelectCategory = (catId: string, defaultDesc?: string) => {
    setSelectedCategory(catId);
    if (!description || description.trim() === '') {
      const match = EXPENSE_CATEGORIES.find(c => c.id === catId);
      if (match) {
        setDescription(`Bixinta kharashka ${match.label.split(' ')[0]}`);
      }
    }
  };

  // Handle adding new expense
  const handleSaveExpense = (e: React.FormEvent) => {
    e.preventDefault();
    if (!amount || Number(amount) <= 0) return;
    if (!setData) return;

    // Convert to USD standard if entered in ETB
    const finalAmountUSD = currencyMode === 'ETB' ? (Number(amount) / rate) : Number(amount);
    const dateObj = expenseDate ? new Date(expenseDate) : new Date();
    const ts = dateObj.getTime();

    const selectedAcc = (data.accounts || []).find(a => a.id === accountId) || data.accounts?.[0];

    const newExpense: Expense = {
      id: `EXP-${Date.now()}`,
      category: selectedCategory,
      description: description.trim() || `Kharashka ${selectedCategory}`,
      amount: finalAmountUSD,
      currency: Currency.USD,
      timestamp: ts,
      accountId: selectedAcc ? selectedAcc.id : (data.accounts?.[0]?.id || 'cash-in-hand')
    };

    setData(prev => {
      // Deduct from account balance if account is specified
      const updatedAccounts = (prev.accounts || []).map(a => {
        if (a.id === newExpense.accountId) {
          return {
            ...a,
            balance: (a.balance || 0) - finalAmountUSD
          };
        }
        return a;
      });

      return {
        ...prev,
        expenses: [newExpense, ...(prev.expenses || [])],
        accounts: updatedAccounts,
        lastModified: Date.now()
      };
    });

    if (addLog) {
      addLog('Expense Recorded', `Added expense ${selectedCategory}: $${finalAmountUSD.toFixed(2)} (${description})`);
    }

    // Reset Form
    setAmount('');
    setDescription('');
  };

  // Handle Delete Expense
  const handleDeleteExpense = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!window.confirm('Ma hubtaa inaad tirayso kharashkan?')) return;
    if (!setData) return;

    const expToDelete = (data.expenses || []).find(e => e.id === id);

    setData(prev => {
      // Revert account balance
      const updatedAccounts = (prev.accounts || []).map(a => {
        if (expToDelete && a.id === expToDelete.accountId) {
          return {
            ...a,
            balance: (a.balance || 0) + expToDelete.amount
          };
        }
        return a;
      });

      const updatedDeletedIds = { ...(prev.deletedIds || {}) };
      updatedDeletedIds[id] = Date.now();

      let updatedBin = prev.recycleBin || [];
      if (expToDelete) {
        const binItem = {
          id: generateId(),
          type: 'EXPENSE' as const,
          deletedAt: Date.now(),
          title: `Expense: ${expToDelete.category} ($${expToDelete.amount})`,
          description: `Desc: ${expToDelete.description || 'No description'} • Date: ${new Date(expToDelete.timestamp).toLocaleDateString()}`,
          originalData: expToDelete
        };
        updatedBin = [binItem, ...updatedBin];
      }

      return {
        ...prev,
        expenses: (prev.expenses || []).filter(e => e.id !== id),
        accounts: updatedAccounts,
        recycleBin: updatedBin,
        deletedIds: updatedDeletedIds,
        lastModified: Date.now()
      };
    });

    if (addLog && expToDelete) {
      addLog('Expense Deleted', `Deleted expense: ${expToDelete.category} ($${expToDelete.amount})`);
    }

    if (selectedExpense?.id === id) {
      setIsVoucherOpen(false);
      setSelectedExpense(null);
    }
  };

  // Metrics: Today's and This Month's Expenses
  const { totalExpensesMonth, totalExpensesToday, categoryBreakdown } = useMemo(() => {
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();
    const todayStr = now.toISOString().split('T')[0];

    let monthTotal = 0;
    let todayTotal = 0;
    const catMap: Record<string, number> = {};

    (data.expenses || []).forEach(exp => {
      const d = new Date(exp.timestamp);
      const isThisMonth = d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      const isToday = d.toISOString().split('T')[0] === todayStr;

      if (isThisMonth) {
        monthTotal += exp.amount;
        catMap[exp.category] = (catMap[exp.category] || 0) + exp.amount;
      }
      if (isToday) {
        todayTotal += exp.amount;
      }
    });

    return {
      totalExpensesMonth: monthTotal,
      totalExpensesToday: todayTotal,
      categoryBreakdown: catMap
    };
  }, [data.expenses]);

  // Filtered recent expenses
  const filteredExpenses = useMemo(() => {
    return (data.expenses || []).filter(exp => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      const d = new Date(exp.timestamp);
      const somaliDay = SOMALI_DAYS[d.getDay()];
      return (
        exp.category.toLowerCase().includes(q) ||
        exp.description.toLowerCase().includes(q) ||
        somaliDay.toLowerCase().includes(q) ||
        exp.amount.toString().includes(q)
      );
    }).sort((a, b) => b.timestamp - a.timestamp);
  }, [data.expenses, searchQuery]);

  return (
    <div className="bg-white p-4 sm:p-7 rounded-[36px] sm:rounded-[40px] border border-slate-100 shadow-sm space-y-6">
      
      {/* Header & Badges */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-rose-500/10 text-rose-700 font-black text-[10px] rounded-md uppercase tracking-wider flex items-center gap-1">
              <Receipt size={12} className="text-rose-600" />
              Xarunta Xaraynta Kharashaadka (Expense Hub)
            </span>
            <span className="text-xs text-slate-400 font-bold hidden sm:inline">• Dukaanka & Shaqada</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <Receipt size={24} className="text-rose-600" />
            <span>Xaree Kharashaadka Dukaanka (Mushahar, Koronto, Qashin, Shaah...)</span>
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Diiwaangeli oo xaree kharash kasta oo dukaanka ka baxay adigoo dooranaya nooca kharashka iyo sanduuqa laga bixiyay.
          </p>
        </div>

        {/* Quick KPI stats */}
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <div className="bg-rose-50/80 p-3 sm:p-4 rounded-3xl border border-rose-100 min-w-[150px]">
            <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">
              Kharashka Bishan
            </p>
            <p className="text-lg sm:text-2xl font-black text-rose-950 mt-0.5">
              {formatCurrency(totalExpensesMonth, currency, rate)}
            </p>
            <p className="text-[9px] text-rose-700 font-bold mt-0.5">
              {currency === Currency.USD 
                ? `ETB ${(totalExpensesMonth * rate).toLocaleString()}` 
                : `$${totalExpensesMonth.toLocaleString()}`}
            </p>
          </div>

          <div className="bg-slate-50 p-3 sm:p-4 rounded-3xl border border-slate-100 min-w-[130px]">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Kharashka Maanta
            </p>
            <p className="text-lg sm:text-2xl font-black text-slate-900 mt-0.5">
              {formatCurrency(totalExpensesToday, currency, rate)}
            </p>
            <p className="text-[9px] text-slate-400 font-bold mt-0.5">
              {(data.expenses || []).filter(e => new Date(e.timestamp).toISOString().split('T')[0] === new Date().toISOString().split('T')[0]).length} Kharash maanta
            </p>
          </div>
        </div>
      </div>

      {/* Main Container: 2-Column (Left: Expense Entry Form with Quick Presets, Right: Recent Expenses) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        
        {/* Left Form: Register Expense (5/12 or 6/12 on large screens) */}
        <div className="lg:col-span-6 bg-slate-50/80 p-5 sm:p-6 rounded-3xl border border-slate-200/80 space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h4 className="font-black text-slate-900 text-sm flex items-center gap-2">
              <PlusCircle size={16} className="text-rose-600" />
              <span>Xaree Kharash Cusub</span>
            </h4>
            <span className="text-[10px] font-bold text-slate-400 uppercase">Foomka Degdegga ah</span>
          </div>

          {/* Preset Category Tiles */}
          <div>
            <label className="block text-[11px] font-black text-slate-600 uppercase mb-2">
              1. Dooro Qeybta Kharashka:
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-3 gap-2">
              {EXPENSE_CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => handleSelectCategory(cat.id)}
                    className={`p-2.5 rounded-2xl border text-left flex flex-col items-start gap-1.5 transition-all cursor-pointer ${
                      isSelected 
                        ? 'bg-rose-600 text-white border-rose-600 shadow-md scale-[1.02]' 
                        : 'bg-white text-slate-700 border-slate-200 hover:border-rose-300 hover:bg-rose-50/30'
                    }`}
                  >
                    <Icon size={16} className={isSelected ? 'text-white' : 'text-rose-600'} />
                    <span className="text-[10px] font-black leading-tight line-clamp-1">
                      {cat.id === 'Mushaharka' ? 'Mushahar' :
                       cat.id === 'Korontada' ? 'Koronto' :
                       cat.id === 'Qashinka' ? 'Qashin' :
                       cat.id === 'Shaaha' ? 'Shaah/Cunto' :
                       cat.id === 'Biyaha' ? 'Biyo' :
                       cat.id === 'Kirada' ? 'Kiro' :
                       cat.id === 'Dayactirka' ? 'Dayactir' :
                       cat.id === 'Gaadiidka' ? 'Gaadiid' : 'Kharash Kale'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Form Fields */}
          <form onSubmit={handleSaveExpense} className="space-y-3.5 pt-1">
            
            {/* Amount with USD/ETB toggle */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[11px] font-black text-slate-700 uppercase">
                  2. Cadadka Kharashka:
                </label>
                <div className="flex items-center gap-1 bg-white p-0.5 rounded-lg border border-slate-200 text-[10px] font-black">
                  <button
                    type="button"
                    onClick={() => setCurrencyMode('USD')}
                    className={`px-2 py-0.5 rounded ${currencyMode === 'USD' ? 'bg-rose-600 text-white' : 'text-slate-500'}`}
                  >
                    USD ($)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCurrencyMode('ETB')}
                    className={`px-2 py-0.5 rounded ${currencyMode === 'ETB' ? 'bg-rose-600 text-white' : 'text-slate-500'}`}
                  >
                    ETB
                  </button>
                </div>
              </div>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-black">
                  {currencyMode === 'USD' ? '$' : 'ETB'}
                </span>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full pl-12 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-base font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 shadow-xs"
                />
              </div>
              {amount !== '' && (
                <p className="text-[10px] text-slate-500 font-bold mt-1">
                  {currencyMode === 'USD' 
                    ? `U dhiganta ETB: ${(Number(amount) * rate).toLocaleString()}` 
                    : `U dhiganta USD: $${(Number(amount) / rate).toFixed(2)}`}
                </p>
              )}
            </div>

            {/* Description / Reason */}
            <div>
              <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                3. Sababta & Faahfaahinta (Reason / Notes):
              </label>
              <input
                type="text"
                required
                placeholder="Tusaale: Mushaharka shaqaalaha Axmed, Biilka korontada ENEO..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 shadow-xs"
              />
            </div>

            {/* Account Selector & Date in 2 cols */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                  Sanduuqa / Akoonka:
                </label>
                <select
                  value={accountId}
                  onChange={(e) => setAccountId(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 shadow-xs cursor-pointer"
                >
                  {(data.accounts || []).map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (${acc.balance?.toLocaleString() || 0})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-black text-slate-700 uppercase mb-1">
                  Taariikhda:
                </label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 shadow-xs cursor-pointer"
                />
              </div>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              className="w-full py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-2xl shadow-md transition-all active:scale-[0.98] cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              <CheckCircle2 size={16} />
              <span>Xaree Kharashka Hadda (Save Expense)</span>
            </button>
          </form>
        </div>

        {/* Right Table: Recent Expenses History (7/12 or 6/12) */}
        <div className="lg:col-span-6 space-y-3">
          
          <div className="flex items-center justify-between gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Raadi kharashaadka hore..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500/20"
              />
            </div>
            <span className="text-[10px] font-bold text-slate-500 shrink-0">
              {filteredExpenses.length} Diwaangashan
            </span>
          </div>

          <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-xs">
            <div className="overflow-x-auto max-h-[460px] touch-scroll">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-slate-600 uppercase text-[10px] font-black tracking-wider border-b border-slate-100 sticky top-0 z-10">
                    <th className="py-2.5 px-3">Qeybta & Sababta</th>
                    <th className="py-2.5 px-3">Taariikhda</th>
                    <th className="py-2.5 px-3 text-right">Cadadka</th>
                    <th className="py-2.5 px-3 text-center">Falka</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {filteredExpenses.length > 0 ? (
                    filteredExpenses.map((exp) => {
                      const d = new Date(exp.timestamp);
                      const dayName = SOMALI_DAYS[d.getDay()];
                      const dateStr = d.toLocaleDateString('so-SO', { month: 'short', day: 'numeric' });
                      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

                      return (
                        <tr
                          key={exp.id}
                          onClick={() => {
                            setSelectedExpense(exp);
                            setIsVoucherOpen(true);
                          }}
                          className="hover:bg-rose-50/40 transition-colors group cursor-pointer"
                        >
                          {/* Category & Description */}
                          <td className="py-3 px-3">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-black rounded-lg shrink-0">
                                {exp.category}
                              </span>
                              <span className="font-bold text-slate-900 truncate max-w-[150px]" title={exp.description}>
                                {exp.description}
                              </span>
                            </div>
                          </td>

                          {/* Date */}
                          <td className="py-3 px-3 whitespace-nowrap">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800 text-[11px]">
                                {dayName}, {dateStr}
                              </span>
                              <span className="text-[9px] text-slate-400">
                                {timeStr}
                              </span>
                            </div>
                          </td>

                          {/* Amount */}
                          <td className="py-3 px-3 text-right whitespace-nowrap">
                            <span className="font-black text-rose-700 text-xs">
                              {formatCurrency(exp.amount, currency, rate)}
                            </span>
                            {currency === Currency.USD && (
                              <p className="text-[9px] text-slate-400">
                                ETB {(exp.amount * rate).toLocaleString()}
                              </p>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="py-3 px-3 text-center whitespace-nowrap" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={(e) => handleDeleteExpense(exp.id, e)}
                              className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                              title="Tirtir kharashkan"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-10 text-center text-slate-400">
                        <Receipt className="mx-auto mb-2 opacity-30 text-rose-500" size={32} />
                        <p className="font-bold text-xs text-slate-600">Wax kharash ah lama helin</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">Xaree kharashkaaga adigoo isticmaalaya foomka bidixda.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>

      {/* Expense Voucher Modal */}
      {isVoucherOpen && selectedExpense && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150">
            
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-rose-100 text-rose-700 rounded-2xl">
                  <Receipt size={20} />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-base">Foojarka Kharashka</h4>
                  <p className="text-[11px] text-slate-500 font-bold">Store Expense Voucher</p>
                </div>
              </div>
              <button
                onClick={() => setIsVoucherOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-rose-50/50 p-4 rounded-2xl border border-rose-100 space-y-2.5 text-xs">
              <div className="flex justify-between items-center pb-2 border-b border-rose-100">
                <span className="font-bold text-slate-500 uppercase">Qeybta Kharashka:</span>
                <span className="font-black text-rose-800 bg-rose-100 px-2 py-0.5 rounded-md">
                  {selectedExpense.category}
                </span>
              </div>

              <div className="flex justify-between items-start pt-1">
                <span className="font-bold text-slate-500 shrink-0">Sababta & Faahfaahinta:</span>
                <span className="font-black text-slate-900 text-right max-w-[220px]">
                  {selectedExpense.description}
                </span>
              </div>

              <div className="flex justify-between items-center pt-1">
                <span className="font-bold text-slate-500">Taariikhda & Maalinta:</span>
                <span className="font-black text-slate-800">
                  {SOMALI_DAYS[new Date(selectedExpense.timestamp).getDay()]}, {new Date(selectedExpense.timestamp).toLocaleDateString('so-SO', { year: 'numeric', month: 'short', day: 'numeric' })}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="font-bold text-slate-500">Saacadda:</span>
                <span className="font-black text-slate-800">
                  {new Date(selectedExpense.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>

              {/* Amount */}
              <div className="bg-white p-3.5 rounded-xl border border-rose-200 flex items-center justify-between mt-2 shadow-xs">
                <div>
                  <p className="text-[10px] font-black text-rose-600 uppercase">Cadadka Kharashka</p>
                  <p className="text-xs text-slate-400">Total amount</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-rose-700">
                    {formatCurrency(selectedExpense.amount, currency, rate)}
                  </p>
                  <p className="text-[10px] text-slate-500 font-bold">
                    ETB {(selectedExpense.amount * rate).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-all flex items-center gap-1.5"
              >
                <Printer size={14} />
                <span>Daabac (Print)</span>
              </button>
              <button
                onClick={() => setIsVoucherOpen(false)}
                className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-black"
              >
                Xidh (Close)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default DashboardExpenseManager;
