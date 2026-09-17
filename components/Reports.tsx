
import React, { useMemo, useState } from 'react';
import { AppData, Currency, Transaction, Expense } from '../types';
import { formatCurrency, generateId } from '../lib/utils';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell,
  Legend,
  AreaChart,
  Area
} from 'recharts';
import { 
  PieChart as PieChartIcon, 
  BarChart3, 
  TrendingUp, 
  Package, 
  Wallet, 
  Briefcase, 
  Clock, 
  Calendar, 
  ArrowRight,
  Calculator,
  TrendingDown,
  Printer,
  Trash2
} from 'lucide-react';

interface Props {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  addLog: (action: string, details: string) => void;
  currency: Currency;
}

type Period = '6h' | 'daily' | 'weekly' | 'month_to_date' | 'monthly' | 'yearly' | 'custom';

const Reports: React.FC<Props> = ({ data, setData, addLog, currency }) => {
  const rate = data.settings.exchangeRate;
  const [period, setPeriod] = useState<Period>('month_to_date');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const handleDeleteTransaction = (tx: Transaction) => {
    if (!confirm(`⚠️ Delete Transaction #INV-${tx.id.slice(-5).toUpperCase()}? Financials and stock will be reverted.`)) return;

    setData(prev => {
      // 1. Revert Product Stock
      const newProducts = prev.products.map(p => {
        const soldItem = tx.items.find(item => item.id === p.id);
        return soldItem ? { ...p, stock: p.stock + soldItem.quantity } : p;
      });

      // 2. Revert Financials
      let updatedAccounts = [...prev.accounts];
      
      // Revert Inventory Asset
      const totalCost = tx.items.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
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
          updatedAccounts = updatedAccounts.map(a => a.id === cashAcc.id ? { ...a, balance: Math.max(0, a.balance - tx.paymentDetails!.cash) } : a);
        }
        if (tx.paymentDetails.bank > 0 && bankAcc) {
          updatedAccounts = updatedAccounts.map(a => a.id === bankAcc.id ? { ...a, balance: Math.max(0, a.balance - tx.paymentDetails!.bank) } : a);
        }
        if (tx.paymentDetails.mobile > 0 && mobileAcc) {
          updatedAccounts = updatedAccounts.map(a => a.id === mobileAcc.id ? { ...a, balance: Math.max(0, a.balance - tx.paymentDetails!.mobile) } : a);
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
            history: c.history.filter(id => id !== tx.id)
          };
        }
        return c;
      });

      const binItem = {
        id: generateId(),
        type: 'TRANSACTION' as const,
        deletedAt: Date.now(),
        title: `Invoice #INV-${tx.id.slice(-5).toUpperCase()} ($${tx.total.toFixed(2)})`,
        description: `Items: ${tx.items?.length || 0} • Payment: ${tx.paymentMethod} • Date: ${new Date(tx.timestamp).toLocaleString()}`,
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
        deletedIds: updatedDeletedIds,
        lastModified: Date.now()
      };
    });

    addLog('Transaction Deleted', `Transaction #INV-${tx.id.slice(-5).toUpperCase()} deleted from reports.`);
  };

  // Filtering Logic
  const filteredData = useMemo(() => {
    const now = Date.now();
    let startTimestamp = 0;

    switch (period) {
      case '6h':
        startTimestamp = now - (6 * 60 * 60 * 1000);
        break;
      case 'daily':
        const d = new Date();
        d.setHours(0, 0, 0, 0);
        startTimestamp = d.getTime();
        break;
      case 'weekly':
        startTimestamp = now - (7 * 24 * 60 * 60 * 1000);
        break;
      case 'month_to_date': {
        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);
        startTimestamp = startOfMonth.getTime();
        break;
      }
      case 'monthly':
        startTimestamp = now - (30 * 24 * 60 * 60 * 1000);
        break;
      case 'yearly':
        startTimestamp = now - (365 * 24 * 60 * 60 * 1000);
        break;
      case 'custom':
        startTimestamp = customStart ? new Date(customStart).getTime() : 0;
        const endTimestamp = customEnd ? new Date(customEnd).getTime() + (24 * 60 * 60 * 1000) : now;
        
        return {
          transactions: data.transactions.filter(t => t.timestamp >= startTimestamp && t.timestamp <= endTimestamp),
          expenses: data.expenses.filter(e => e.timestamp >= startTimestamp && e.timestamp <= endTimestamp)
        };
    }

    return {
      transactions: data.transactions.filter(t => t.timestamp >= startTimestamp),
      expenses: data.expenses.filter(e => e.timestamp >= startTimestamp)
    };
  }, [data, period, customStart, customEnd]);

  // Metric Calculations
  const metrics = useMemo(() => {
    const saleTransactions = filteredData.transactions.filter(t => 
      t.type === 'SALE' || 
      (!t.type && !t.supplierId && !t.notes?.toLowerCase().includes('supplier') && t.items?.[0]?.sku !== 'SUPPLIER_PAYMENT')
    );

    const sales = saleTransactions.reduce((acc, t) => acc + t.total, 0);
    const revenue = saleTransactions.reduce((acc, t) => acc + t.subtotal, 0);
    const cogs = saleTransactions.reduce((acc, t) => {
      return acc + t.items.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
    }, 0);
    const expenses = filteredData.expenses.reduce((acc, e) => acc + e.amount, 0);
    const grossProfit = revenue - cogs;
    const netProfit = grossProfit - expenses;

    return { sales, revenue, cogs, expenses, grossProfit, netProfit };
  }, [filteredData]);

  // Chart Data Preparation
  const categoryStats = useMemo(() => {
    const stats: Record<string, number> = {};
    filteredData.transactions.forEach(t => {
      t.items.forEach(item => {
        const cat = item.category || 'General';
        stats[cat] = (stats[cat] || 0) + (item.sellPrice * item.quantity);
      });
    });
    return Object.entries(stats)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredData]);

  const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4', '#ec4899'];

  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-4 rounded-2xl shadow-2xl border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{label || payload[0].name}</p>
          <p className="text-sm font-black text-slate-900">{formatCurrency(payload[0].value, currency, rate)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500 max-w-7xl mx-auto">
      {/* Header & Filter Bar */}
      <div className="bg-white p-6 rounded-[32px] border shadow-sm flex flex-col lg:flex-row justify-between items-center gap-6 no-print">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight">Analytics Dashboard</h1>
          <p className="text-sm text-slate-400 font-medium">Monitoring business health across timeframes</p>
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <div className="flex flex-wrap items-center gap-2 bg-slate-100 p-1.5 rounded-2xl border">
            {([
              { key: 'month_to_date', label: '1 Bisha ilaa Maanta' },
              { key: 'daily', label: 'Daily' },
              { key: 'weekly', label: 'Weekly' },
              { key: 'monthly', label: 'Last 30D' },
              { key: 'yearly', label: 'Yearly' },
              { key: 'custom', label: 'Custom' }
            ] as { key: Period; label: string }[]).map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriod(p.key)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${period === p.key ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button 
            onClick={() => window.print()}
            className="p-3 bg-slate-900 text-white rounded-2xl hover:bg-black transition-all shadow-lg"
            title="Print Full Analytics Report"
          >
            <Printer size={20} />
          </button>
        </div>
      </div>

      <div className="hidden print:block text-center border-b-2 border-black pb-8 mb-8">
        <h1 className="text-4xl font-black uppercase tracking-tighter">{data.settings.businessName}</h1>
        <p className="text-sm font-bold text-slate-500">BUSINESS ANALYTICS REPORT • {period.toUpperCase()} VIEW • {new Date().toLocaleDateString()}</p>
      </div>

      {/* Custom Date Range Picker */}
      {period === 'custom' && (
        <div className="bg-white p-6 rounded-[32px] border shadow-sm flex flex-wrap items-center gap-4 animate-in slide-in-from-top-2 duration-300 no-print">
          <div className="flex items-center gap-3">
            <Calendar size={18} className="text-slate-400" />
            <input 
              type="date" 
              className="px-4 py-2 bg-slate-50 border rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
              value={customStart}
              onChange={e => setCustomStart(e.target.value)}
            />
          </div>
          <ArrowRight size={16} className="text-slate-300" />
          <div className="flex items-center gap-3">
            <input 
              type="date" 
              className="px-4 py-2 bg-slate-50 border rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-blue-500"
              value={customEnd}
              onChange={e => setCustomEnd(e.target.value)}
            />
          </div>
        </div>
      )}

      {/* Financial KPIs */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm print:border-none print:shadow-none print:bg-slate-50">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mb-4 no-print">
            <Briefcase size={20} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Sales</p>
          <h3 className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(metrics.sales, currency, rate)}</h3>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm print:border-none print:shadow-none print:bg-slate-50">
          <div className="w-10 h-10 bg-orange-50 text-orange-600 rounded-2xl flex items-center justify-center mb-4 no-print">
            <Calculator size={20} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cost (COGS)</p>
          <h3 className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(metrics.cogs, currency, rate)}</h3>
        </div>

        <div className="bg-white p-6 rounded-[32px] border border-slate-100 shadow-sm print:border-none print:shadow-none print:bg-slate-50">
          <div className="w-10 h-10 bg-red-50 text-red-600 rounded-2xl flex items-center justify-center mb-4 no-print">
            <TrendingDown size={20} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Expenses</p>
          <h3 className="text-2xl font-black text-slate-900 mt-1">{formatCurrency(metrics.expenses, currency, rate)}</h3>
        </div>

        <div className="bg-slate-900 p-6 rounded-[32px] shadow-xl shadow-slate-900/20 print:bg-black print:text-white">
          <div className="w-10 h-10 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mb-4 no-print">
            <TrendingUp size={20} />
          </div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-slate-400">Net Profit</p>
          <h3 className="text-2xl font-black text-white mt-1">{formatCurrency(metrics.netProfit, currency, rate)}</h3>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Category Share (Pie) */}
        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm flex flex-col lg:col-span-1 print:border-none">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center no-print">
              <PieChartIcon size={20} />
            </div>
            <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Sales by Category</h2>
          </div>
          
          <div className="h-64 w-full relative">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie 
                  data={categoryStats} 
                  cx="50%" cy="50%" 
                  innerRadius={60} 
                  outerRadius={90} 
                  paddingAngle={5} 
                  dataKey="value"
                  stroke="none"
                >
                  {categoryStats.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
               <p className="text-[10px] font-black text-slate-400 uppercase">Share</p>
               <p className="text-xs font-black text-slate-900">Total Mix</p>
            </div>
          </div>
          
          <div className="mt-6 space-y-3">
             {categoryStats.slice(0, 5).map((stat, i) => (
               <div key={i} className="flex justify-between items-center text-xs">
                 <div className="flex items-center gap-2">
                   <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                   <span className="font-bold text-slate-600">{stat.name}</span>
                 </div>
                 <span className="font-black text-slate-900">{formatCurrency(stat.value, currency, rate)}</span>
               </div>
             ))}
          </div>
        </div>

        {/* Profit vs Sales Trend (Area Chart) */}
        <div className="bg-white p-8 rounded-[40px] border border-slate-100 shadow-sm lg:col-span-2 print:border-none">
          <div className="flex items-center justify-between mb-8">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center no-print">
                <BarChart3 size={20} />
              </div>
              <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Performance Trend</h2>
            </div>
            <div className="flex gap-4 no-print">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span className="text-[10px] font-bold text-slate-400">SALES</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span className="text-[10px] font-bold text-slate-400">NET PROFIT</span>
              </div>
            </div>
          </div>

          <div className="h-80 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={categoryStats.length > 0 ? categoryStats : [{name: 'Empty', value: 0}]}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" hide />
                <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                <Tooltip content={<CustomTooltip />} />
                <Area 
                  type="monotone" 
                  dataKey="value" 
                  stroke="#3b82f6" 
                  strokeWidth={3} 
                  fillOpacity={1} 
                  fill="url(#colorSales)" 
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>
      
      {/* Detailed Sales List for Period */}
      <div className="bg-white rounded-[40px] border border-slate-100 shadow-sm overflow-hidden print:border-none">
        <div className="p-8 border-b bg-slate-50 flex items-center justify-between print:bg-white print:border-b-2 print:border-black">
          <h2 className="text-lg font-black text-slate-800 uppercase tracking-tight">Period Sales Ledger</h2>
          <span className="px-4 py-1.5 bg-blue-600 text-white rounded-full text-[10px] font-black no-print">
            {filteredData.transactions.length} INVOICES
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b bg-slate-50 print:bg-white">
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-black">Time</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-black">ID</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-black">Subtotal</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-black">Method</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest print:text-black">Rate</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right print:text-black">Total</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredData.transactions.slice(0, 50).map(t => {
                const txRate = t.exchangeRate || rate;
                return (
                <tr key={t.id} className="hover:bg-slate-50 transition-colors group print:hover:bg-transparent">
                  <td className="px-6 py-4 text-xs font-bold text-slate-500">
                    {new Date(t.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </td>
                  <td className="px-6 py-4 text-xs font-black text-slate-900">INV-{t.id.slice(-5).toUpperCase()}</td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-500">{formatCurrency(t.subtotal, currency, txRate)}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[10px] font-black uppercase print:bg-transparent print:p-0">
                      {t.paymentMethod}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[10px] font-bold">
                      ${txRate} ETB
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs font-black text-slate-900 text-right">{formatCurrency(t.total, currency, txRate)}</td>
                  <td className="px-6 py-4 text-center no-print">
                    <button
                      onClick={() => handleDeleteTransaction(t)}
                      className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl transition-all font-black text-[10px] uppercase flex items-center justify-center gap-1 mx-auto"
                      title="Futa Transaction"
                    >
                      <Trash2 size={13} />
                      <span>Futa</span>
                    </button>
                  </td>
                </tr>
              )})}
            </tbody>
          </table>
          {filteredData.transactions.length === 0 && (
            <div className="py-20 text-center text-slate-300">
              <Package size={48} className="mx-auto mb-2 opacity-20" />
              <p className="text-xs font-black uppercase">No Sales for this Period</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Reports;