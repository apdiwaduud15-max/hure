import React, { useState, useMemo } from 'react';
import { AppData, Currency, PaymentMethod, CartItem } from '../types';
import { formatCurrency } from '../lib/utils';
import { 
  Calculator, 
  TrendingUp, 
  TrendingDown, 
  Wallet, 
  CreditCard, 
  ArrowUpRight, 
  ArrowDownRight, 
  DollarSign, 
  Landmark, 
  Smartphone, 
  FileText, 
  CheckCircle2, 
  AlertCircle,
  BarChart3, 
  PieChart as PieChartIcon, 
  Calendar,
  Layers,
  Sparkles,
  ShoppingBag,
  Clock,
  Printer,
  ChevronDown,
  ChevronUp,
  Receipt,
  Package,
  ArrowRight
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  CartesianGrid
} from 'recharts';

interface Props {
  data: AppData;
  setData?: React.Dispatch<React.SetStateAction<AppData>>;
  currency: Currency;
}

type TimeFilter = 'THIS_MONTH' | 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH' | 'ALL' | 'CUSTOM';

export const XisaabinTab: React.FC<Props> = ({ data, currency }) => {
  const rate = data.settings.exchangeRate || 190;
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('THIS_MONTH');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<'OVERVIEW' | 'CHANNELS' | 'ACCOUNTS' | 'TRANSACTIONS'>('OVERVIEW');
  const [expandedTxId, setExpandedTxId] = useState<string | null>(null);

  // Time boundaries and date filter matching AllTransactionsShow.tsx
  const { startTime, endTime, filterLabel } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();
    const todayEnd = new Date(today).setHours(23, 59, 59, 999);

    switch (timeFilter) {
      case 'THIS_MONTH': {
        const startOfMonth = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
        return {
          startTime: startOfMonth.getTime(),
          endTime: Date.now() + 86400000,
          filterLabel: '1 Bisha ilaa Maanta (Month to Date)'
        };
      }
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
          filterLabel: '30-kii Maalmood ee Ugu Dambeeyay (Last 30 Days)' 
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
          filterLabel: 'Waqti Kasta (All Time)' 
        };
    }
  }, [timeFilter, customStartDate, customEndDate]);

  // 1. Flatten all transactions into soldItems matching AllTransactionsShow.tsx EXACTLY
  const soldItems = useMemo(() => {
    const list: Array<{
      id: string;
      txId: string;
      pageNumber?: string;
      timestamp: number;
      customerName: string;
      paymentMethod: string;
      accountId?: string;
      customerId?: string;
      item: CartItem;
      unitCost: number;
      unitSell: number;
      unitDiscount: number;
      finalUnitSell: number;
      unitProfit: number;
      totalCost: number;
      totalSell: number;
      totalProfit: number;
      txType?: string;
      notes?: string;
      remainingDebt?: number;
    }> = [];

    (data.transactions || []).forEach(tx => {
      const isDebtPayment = tx.type === 'DEBT_PAYMENT';
      const isSupplierPayment = tx.type === 'EXPENSE' || !!tx.supplierId || tx.items?.some(i => i.sku === 'SUPPLIER_PAYMENT') || tx.notes?.toLowerCase().includes('supplier');
      const isExpense = tx.type === 'EXPENSE' && !isSupplierPayment;
      const txDiscount = tx.discount || 0;

      // Customer name & debt balance
      let customerName = tx.customerName || 'Walk-in Customer';
      let remainingDebt: number | undefined = undefined;
      if (tx.customerId) {
        const found = (data.customers || []).find(c => c.id === tx.customerId);
        if (found) {
          customerName = found.name;
          remainingDebt = found.debtBalance;
        }
      } else if (tx.supplierId || isSupplierPayment) {
        customerName = tx.supplierName || 'Supplier';
      }

      let itemsToProcess = (tx.items && tx.items.length > 0) ? tx.items : [];
      if (itemsToProcess.length === 0 || isDebtPayment || isSupplierPayment || isExpense) {
        itemsToProcess = [
          {
            id: isSupplierPayment ? `supp-pay-${tx.id}` : (isDebtPayment ? `debt-pay-${tx.id}` : `exp-${tx.id}`),
            name: isSupplierPayment 
              ? `Bixinta Deynta Supplier-ka (${tx.supplierName || customerName})` 
              : (isDebtPayment ? `Bixinta Deynta Macaamiil (${customerName})` : (tx.notes || 'Kharash Guud')),
            sku: isSupplierPayment ? 'SUPPLIER_PAYMENT' : (isDebtPayment ? 'DEBT_PAYMENT' : 'EXPENSE'),
            barcode: '',
            costPrice: isSupplierPayment || isExpense ? tx.total : 0,
            sellPrice: tx.total,
            stock: 1,
            category: isSupplierPayment ? 'Supplier Payment' : (isDebtPayment ? 'Bixinta Deynta' : 'Kharash'),
            quantity: 1
          }
        ];
      }

      const txGrossSubtotal = tx.subtotal || itemsToProcess.reduce((sum, i) => sum + ((i.sellPrice || 0) * (i.quantity || 0)), 0) || 1;
      const txFinalTotal = tx.total !== undefined ? tx.total : (txGrossSubtotal - txDiscount);
      const itemCount = itemsToProcess.length || 1;

      itemsToProcess.forEach((item, index) => {
        const qty = item.quantity || 1;
        const unitCost = item.costPrice || 0;
        const unitSell = item.sellPrice || 0;
        
        const itemGross = unitSell * qty;
        const itemRatio = txGrossSubtotal > 0 ? (itemGross / txGrossSubtotal) : (1 / itemCount);

        const totalSell = txFinalTotal * itemRatio;
        const itemDiscountTotal = txDiscount * itemRatio;
        const totalCost = (isDebtPayment || isSupplierPayment || isExpense) ? 0 : unitCost * qty;
        const totalProfit = (isDebtPayment || isSupplierPayment || isExpense) ? 0 : (totalSell - totalCost);

        const finalUnitSell = qty > 0 ? (totalSell / qty) : unitSell;
        const unitDiscount = qty > 0 ? (itemDiscountTotal / qty) : 0;
        const unitProfit = qty > 0 ? (totalProfit / qty) : (unitSell - unitCost);

        list.push({
          id: `${tx.id}-${index}`,
          txId: tx.id,
          pageNumber: tx.pageNumber,
          timestamp: tx.timestamp,
          customerName,
          paymentMethod: tx.paymentMethod || 'CASH',
          accountId: tx.accountId,
          customerId: tx.customerId,
          item,
          unitCost,
          unitSell,
          unitDiscount,
          finalUnitSell,
          unitProfit,
          totalCost,
          totalSell,
          totalProfit,
          txType: tx.type || (isSupplierPayment ? 'EXPENSE' : (isDebtPayment ? 'DEBT_PAYMENT' : 'SALE')),
          notes: tx.notes,
          remainingDebt
        });
      });
    });

    return list;
  }, [data.transactions, data.customers]);

  // 2. Filter sold items by selected Date Range
  const filteredSoldItems = useMemo(() => {
    return soldItems.filter(entry => {
      const entryTime = entry.timestamp;
      if (entryTime < startTime || entryTime > endTime) return false;

      // Filter out Cash Loan and Supplier Payments from standard sales metrics (matches AllTransactionsShow ALL mode)
      if (entry.item.category === 'Cash Loan') return false;
      if (entry.item.sku === 'SUPPLIER_PAYMENT' || entry.item.category === 'Supplier Payment' || entry.txType === 'EXPENSE') return false;

      return true;
    });
  }, [soldItems, startTime, endTime]);

  // 3. Compute Comprehensive Metrics matching AllTransactionsShow.tsx 100%
  const metrics = useMemo(() => {
    let totalQty = 0;
    let totalCost = 0;
    let totalGrossSales = 0;
    let totalDiscount = 0;
    let totalNetProfit = 0;

    let cashSalesTotal = 0;
    let bankSalesTotal = 0;
    let mobileSalesTotal = 0;
    let debtSalesTotal = 0;

    let cashQty = 0;
    let bankQty = 0;
    let mobileQty = 0;
    let debtQty = 0;

    const cashTxSet = new Set<string>();
    const bankTxSet = new Set<string>();
    const mobileTxSet = new Set<string>();
    const debtTxSet = new Set<string>();
    const totalTxSet = new Set<string>();

    let totalDebtRepaymentCollected = 0;
    let debtRepayCash = 0;
    let debtRepayBank = 0;
    let debtRepayMobile = 0;

    // Custom Account Tracker
    const accountMap: Record<string, { id: string; name: string; type: string; totalAmount: number; itemQty: number; txSet: Set<string> }> = {};
    (data.accounts || []).forEach(acc => {
      accountMap[acc.id] = {
        id: acc.id,
        name: acc.name,
        type: acc.type,
        totalAmount: 0,
        itemQty: 0,
        txSet: new Set<string>()
      };
    });

    filteredSoldItems.forEach(entry => {
      const isDebtPayment = entry.txType === 'DEBT_PAYMENT' || entry.item.category === 'Bixinta Deynta';

      if (isDebtPayment) {
        // Debt collections go into cash/account collection, NOT into product sales revenue
        totalDebtRepaymentCollected += entry.totalSell;
        const pm = (entry.paymentMethod || '').toLowerCase();
        const isBank = pm.includes('bank');
        const isMobile = pm.includes('mobile') || pm.includes('evc') || pm.includes('zaad') || pm.includes('sahal') || pm.includes('edahab') || pm.includes('telebirr');

        if (isBank) {
          debtRepayBank += entry.totalSell;
          if (entry.txId) bankTxSet.add(entry.txId);
        } else if (isMobile) {
          debtRepayMobile += entry.totalSell;
          if (entry.txId) mobileTxSet.add(entry.txId);
        } else {
          debtRepayCash += entry.totalSell;
          if (entry.txId) cashTxSet.add(entry.txId);
        }

        if (entry.accountId && accountMap[entry.accountId]) {
          accountMap[entry.accountId].totalAmount += entry.totalSell;
          if (entry.txId) accountMap[entry.accountId].txSet.add(entry.txId);
        }
      } else {
        // Regular Product Sales
        totalQty += entry.item.quantity;
        totalCost += entry.totalCost;
        totalGrossSales += entry.totalSell;
        totalDiscount += entry.unitDiscount * entry.item.quantity;
        totalNetProfit += entry.totalProfit; // EXACT Net Profit match with AllTransactionsShow!
        if (entry.txId) totalTxSet.add(entry.txId);

        const pm = (entry.paymentMethod || '').toLowerCase();
        const isDebt = pm.includes('debt') || pm.includes('deyn') || pm.includes('credit') || pm.includes('partial') || entry.item.category === 'Cash Loan';
        const isBank = pm.includes('bank');
        const isMobile = pm.includes('mobile') || pm.includes('evc') || pm.includes('zaad') || pm.includes('sahal') || pm.includes('edahab') || pm.includes('telebirr');

        if (isDebt) {
          debtSalesTotal += entry.totalSell;
          debtQty += entry.item.quantity;
          if (entry.txId) debtTxSet.add(entry.txId);
        } else if (isBank) {
          bankSalesTotal += entry.totalSell;
          bankQty += entry.item.quantity;
          if (entry.txId) bankTxSet.add(entry.txId);
        } else if (isMobile) {
          mobileSalesTotal += entry.totalSell;
          mobileQty += entry.item.quantity;
          if (entry.txId) mobileTxSet.add(entry.txId);
        } else {
          cashSalesTotal += entry.totalSell;
          cashQty += entry.item.quantity;
          if (entry.txId) cashTxSet.add(entry.txId);
        }

        if (entry.accountId && accountMap[entry.accountId]) {
          accountMap[entry.accountId].totalAmount += entry.totalSell;
          accountMap[entry.accountId].itemQty += entry.item.quantity;
          if (entry.txId) accountMap[entry.accountId].txSet.add(entry.txId);
        }
      }
    });

    const nonDebtSalesTotal = cashSalesTotal + bankSalesTotal + mobileSalesTotal;
    const nonDebtQty = cashQty + bankQty + mobileQty;
    const nonDebtTxCount = new Set([...cashTxSet, ...bankTxSet, ...mobileTxSet]).size;

    // Direct Expenses recorded during this period
    const periodExpenses = (data.expenses || []).filter(e => e.timestamp >= startTime && e.timestamp <= endTime);
    const totalExpenses = periodExpenses.reduce((sum, e) => sum + (e.amount || 0), 0);

    // Business Net Income = Sales Net Profit - Other General Expenses
    const netBusinessIncome = totalNetProfit - totalExpenses;
    const profitMargin = totalGrossSales > 0 ? (totalNetProfit / totalGrossSales) * 100 : 0;

    // Real-Time Total Standing Debt on Customers
    const totalCustomerDebtBalance = (data.customers || []).reduce((sum, c) => sum + (c.debtBalance || 0), 0);
    const totalSupplierDebtBalance = (data.suppliers || []).reduce((sum, s) => sum + (s.balance || 0), 0);

    // Ledger Accounts Breakdown
    const accounts = data.accounts || [];
    let totalAccountBalances = 0;
    let cashOnHandAccountBalance = 0;
    let bankAccountsBalance = 0;
    let mobileAccountsBalance = 0;

    accounts.forEach(acc => {
      totalAccountBalances += acc.balance || 0;
      const lowerName = acc.name.toLowerCase();
      if (lowerName.includes('cash') || lowerName.includes('cadaan') || lowerName.includes('sanduuq') || lowerName.includes('kash')) {
        cashOnHandAccountBalance += acc.balance;
      } else if (lowerName.includes('bank') || lowerName.includes('cbe') || lowerName.includes('dahabshiil') || lowerName.includes('salaam')) {
        bankAccountsBalance += acc.balance;
      } else if (lowerName.includes('zaad') || lowerName.includes('sahal') || lowerName.includes('edahab') || lowerName.includes('telebirr') || lowerName.includes('mobile')) {
        mobileAccountsBalance += acc.balance;
      } else {
        bankAccountsBalance += acc.balance;
      }
    });

    // Comparison for Trend (Hoos u dhac / Kor u kac): Compare with Previous Equivalent Window
    const windowDuration = (endTime - startTime) || 86400000;
    const prevStartTime = startTime - windowDuration;
    const prevEndTime = startTime - 1;

    let prevSalesTotal = 0;
    soldItems.forEach(entry => {
      if (entry.timestamp >= prevStartTime && entry.timestamp <= prevEndTime) {
        if (entry.item.category !== 'Cash Loan' && entry.item.sku !== 'SUPPLIER_PAYMENT' && entry.txType !== 'EXPENSE' && entry.txType !== 'DEBT_PAYMENT') {
          prevSalesTotal += entry.totalSell;
        }
      }
    });

    const salesDiff = totalGrossSales - prevSalesTotal;
    const salesGrowthPct = prevSalesTotal > 0 ? (salesDiff / prevSalesTotal) * 100 : (totalGrossSales > 0 ? 100 : 0);
    const isUptrend = salesDiff >= 0;

    // Trend Chart Data
    const hourlyDataMap: { [label: string]: { time: string; sales: number; profit: number; debt: number } } = {};
    if (timeFilter === 'TODAY' || timeFilter === 'YESTERDAY') {
      for (let h = 6; h <= 23; h += 2) {
        const hourLabel = `${h}:00`;
        hourlyDataMap[hourLabel] = { time: hourLabel, sales: 0, profit: 0, debt: 0 };
      }
      filteredSoldItems.forEach(entry => {
        if (entry.txType === 'DEBT_PAYMENT') return;
        const d = new Date(entry.timestamp);
        const h = d.getHours();
        const bucketHour = Math.floor(h / 2) * 2;
        const bucketLabel = `${bucketHour}:00`;
        if (!hourlyDataMap[bucketLabel]) {
          hourlyDataMap[bucketLabel] = { time: bucketLabel, sales: 0, profit: 0, debt: 0 };
        }
        hourlyDataMap[bucketLabel].sales += entry.totalSell;
        hourlyDataMap[bucketLabel].profit += entry.totalProfit;
        const pm = (entry.paymentMethod || '').toLowerCase();
        if (pm.includes('debt') || pm.includes('deyn') || pm.includes('credit') || pm.includes('partial')) {
          hourlyDataMap[bucketLabel].debt += entry.totalSell;
        }
      });
    } else {
      filteredSoldItems.forEach(entry => {
        if (entry.txType === 'DEBT_PAYMENT') return;
        const d = new Date(entry.timestamp);
        const dayLabel = d.toLocaleDateString('so-SO', { month: 'short', day: 'numeric' });
        if (!hourlyDataMap[dayLabel]) {
          hourlyDataMap[dayLabel] = { time: dayLabel, sales: 0, profit: 0, debt: 0 };
        }
        hourlyDataMap[dayLabel].sales += entry.totalSell;
        hourlyDataMap[dayLabel].profit += entry.totalProfit;
        const pm = (entry.paymentMethod || '').toLowerCase();
        if (pm.includes('debt') || pm.includes('deyn') || pm.includes('credit') || pm.includes('partial')) {
          hourlyDataMap[dayLabel].debt += entry.totalSell;
        }
      });
    }

    const trendChartData = Object.values(hourlyDataMap);

    // Payment Distribution Pie Chart
    const paymentPieData = [
      { name: 'Caddaan (Cash)', value: cashSalesTotal, color: '#10B981' },
      { name: 'Bank Transfer', value: bankSalesTotal, color: '#3B82F6' },
      { name: 'Mobile Money', value: mobileSalesTotal, color: '#8B5CF6' },
      { name: 'Deyn Cusub (Debt)', value: debtSalesTotal, color: '#F59E0B' }
    ].filter(item => item.value > 0);

    return {
      totalQty,
      totalCost,
      totalGrossSales,
      totalDiscount,
      totalNetProfit, // Exact match with All Transactions Show!
      totalExpenses,
      netBusinessIncome,
      profitMargin,
      totalTxCount: totalTxSet.size,
      cashSalesTotal,
      cashQty,
      cashTxCount: cashTxSet.size,
      bankSalesTotal,
      bankQty,
      bankTxCount: bankTxSet.size,
      mobileSalesTotal,
      mobileQty,
      mobileTxCount: mobileTxSet.size,
      debtSalesTotal,
      debtQty,
      debtTxCount: debtTxSet.size,
      nonDebtSalesTotal,
      nonDebtQty,
      nonDebtTxCount,
      totalDebtRepaymentCollected,
      debtRepayCash,
      debtRepayBank,
      debtRepayMobile,
      totalCustomerDebtBalance,
      totalSupplierDebtBalance,
      totalAccountBalances,
      cashOnHandAccountBalance,
      bankAccountsBalance,
      mobileAccountsBalance,
      prevSalesTotal,
      salesDiff,
      salesGrowthPct,
      isUptrend,
      trendChartData,
      paymentPieData,
      accountMap
    };
  }, [filteredSoldItems, data.accounts, data.customers, data.suppliers, data.expenses, startTime, endTime, soldItems, timeFilter]);

  // Currency Formatter
  const fmt = (amount: number) => formatCurrency(amount, currency, rate);

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      {/* 1. Header & Time Filter Bar */}
      <div className="bg-white rounded-[32px] p-6 shadow-sm border border-slate-200/80 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
            <Calculator size={28} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight uppercase">
                Xisaabinta Iibka & Dakhliga (Live Net Income)
              </h1>
              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase rounded-full tracking-wider">
                100% Synced With All Transactions
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Xisaabinta saxda ah ee Net Income, Total Sales, COGS, Deymaha, & Koontooyinka Bankiga.
            </p>
          </div>
        </div>

        {/* Time Filters */}
        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl border border-slate-200 w-full md:w-auto">
          {[
            { key: 'THIS_MONTH', label: '📅 1 Bisha ilaa Maanta' },
            { key: 'TODAY', label: 'Maanta' },
            { key: 'YESTERDAY', label: 'Shalay' },
            { key: 'WEEK', label: 'Toddobaadkan' },
            { key: 'MONTH', label: '30 Maalmood' },
            { key: 'ALL', label: 'Waqti Kasta' },
            { key: 'CUSTOM', label: 'Custom' }
          ].map(btn => (
            <button
              key={btn.key}
              onClick={() => setTimeFilter(btn.key as TimeFilter)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                timeFilter === btn.key 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Picker (if active) */}
      {timeFilter === 'CUSTOM' && (
        <div className="bg-blue-50/80 border border-blue-200 rounded-2xl p-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
            <Calendar size={16} /> Taariikhda Bilowga:
            <input 
              type="date" 
              value={customStartDate} 
              onChange={e => setCustomStartDate(e.target.value)} 
              className="bg-white border border-blue-300 rounded-lg px-2.5 py-1 text-xs font-semibold"
            />
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
            <Calendar size={16} /> Taariikhda Dhamaadka:
            <input 
              type="date" 
              value={customEndDate} 
              onChange={e => setCustomEndDate(e.target.value)} 
              className="bg-white border border-blue-300 rounded-lg px-2.5 py-1 text-xs font-semibold"
            />
          </div>
        </div>
      )}

      {/* 2. Top Executive Insight Banner (Kor u kac / Hoos u dhac Trend + Summary) */}
      <div className={`p-6 rounded-[32px] text-white shadow-xl transition-all ${
        metrics.isUptrend 
          ? 'bg-gradient-to-br from-slate-900 via-emerald-950 to-slate-900 border border-emerald-500/30' 
          : 'bg-gradient-to-br from-slate-900 via-rose-950 to-slate-900 border border-rose-500/30'
      }`}>
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className={`px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5 ${
                metrics.isUptrend ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border border-rose-500/40'
              }`}>
                {metrics.isUptrend ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                Suuqa: {metrics.isUptrend ? 'Kor u Kac (Growth Trend)' : 'Hoos u Dhac (Decrease)'} ({Math.abs(metrics.salesGrowthPct).toFixed(1)}%)
              </div>
              <span className="text-xs font-bold text-slate-400">
                Muddada: {filterLabel}
              </span>
            </div>

            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white">
              Wadarta Iibka Guud: <span className="text-emerald-400">{fmt(metrics.totalGrossSales)}</span>
            </h2>
            <p className="text-xs md:text-sm text-slate-300 max-w-2xl leading-relaxed">
              Iibka {filterLabel.toLowerCase()} wuxuu ka kooban yahay <strong className="text-white">{metrics.totalTxCount} rasiid</strong> ({metrics.totalQty.toLocaleString()} alaab ah). 
              Lacagta tooska ah ee koontooyinka/gacanta ku dhacday waa <strong className="text-emerald-300">{fmt(metrics.nonDebtSalesTotal)}</strong>, 
              halka <strong className="text-amber-300">{fmt(metrics.debtSalesTotal)}</strong> ay baxday deyn ahaan.
            </p>
          </div>

          {/* Quick Snapshot Metrics */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full lg:w-auto">
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10">
              <span className="text-[10px] font-black uppercase tracking-wider text-emerald-300 block">Total Net Profit</span>
              <span className="text-base md:text-lg font-black text-emerald-400">{fmt(metrics.totalNetProfit)}</span>
              <span className="text-[10px] text-slate-400 block">Margin: {metrics.profitMargin.toFixed(1)}%</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10">
              <span className="text-[10px] font-black uppercase tracking-wider text-blue-300 block">Qiimaha Asalka (COGS)</span>
              <span className="text-base md:text-lg font-black text-white">{fmt(metrics.totalCost)}</span>
              <span className="text-[10px] text-slate-400 block">Purchase Cost</span>
            </div>
            <div className="bg-white/10 backdrop-blur-md p-3.5 rounded-2xl border border-white/10 col-span-2 sm:col-span-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 block">Deynta Maanta Baxday</span>
              <span className="text-base md:text-lg font-black text-white">{fmt(metrics.debtSalesTotal)}</span>
              <span className="text-[10px] text-slate-400 block">{metrics.totalGrossSales > 0 ? ((metrics.debtSalesTotal / metrics.totalGrossSales) * 100).toFixed(0) : 0}% iibka guud</span>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Primary 5-Card Stats Section Matching All Transactions Show */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Card 1: Total Net Profit (EXACT MATCH with All Transactions Show) */}
        <div className="bg-white p-5 rounded-[28px] border border-emerald-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                <Sparkles size={18} />
              </div>
              <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase rounded-md">
                Net Profit
              </span>
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
              Total Net Profit
            </span>
            <div className="text-2xl font-black text-emerald-600 font-mono tracking-tight mt-0.5">
              {fmt(metrics.totalNetProfit)}
            </div>
          </div>
          <div className="pt-3 mt-2 border-t border-slate-100 text-[11px] font-semibold text-slate-500">
            <span>Sida All Transactions: </span>
            <strong className="text-emerald-700 font-bold">{metrics.profitMargin.toFixed(1)}% margin</strong>
          </div>
        </div>

        {/* Card 2: Total Net Sales (Iibka Guud) */}
        <div className="bg-white p-5 rounded-[28px] border border-blue-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
                <ShoppingBag size={18} />
              </div>
              <span className="px-2 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-black uppercase rounded-md">
                Net Sales
              </span>
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
              Total Net Sales
            </span>
            <div className="text-2xl font-black text-blue-600 font-mono tracking-tight mt-0.5">
              {fmt(metrics.totalGrossSales)}
            </div>
          </div>
          <div className="pt-3 mt-2 border-t border-slate-100 text-[11px] font-semibold text-slate-500 flex justify-between">
            <span>Tirada Iibka:</span>
            <strong className="text-slate-800">{metrics.totalTxCount} Invoices</strong>
          </div>
        </div>

        {/* Card 3: Total Cost Value (Purchase Cost) */}
        <div className="bg-white p-5 rounded-[28px] border border-amber-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="w-9 h-9 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
                <Package size={18} />
              </div>
              <span className="px-2 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black uppercase rounded-md">
                Cost Price
              </span>
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
              Total Cost Value (COGS)
            </span>
            <div className="text-2xl font-black text-amber-700 font-mono tracking-tight mt-0.5">
              {fmt(metrics.totalCost)}
            </div>
          </div>
          <div className="pt-3 mt-2 border-t border-slate-100 text-[11px] font-semibold text-slate-500 flex justify-between">
            <span>Alaabta La Iibiyay:</span>
            <strong className="text-slate-800">{metrics.totalQty.toLocaleString()} PCS</strong>
          </div>
        </div>

        {/* Card 4: Lacagta Shubaalka ah (Non-Debt Paid Sales) */}
        <div className="bg-white p-5 rounded-[28px] border border-slate-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="w-9 h-9 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center">
                <Wallet size={18} />
              </div>
              <span className="px-2 py-0.5 bg-teal-100 text-teal-800 text-[10px] font-black uppercase rounded-md">
                Accounts / Cash
              </span>
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
              Lacagta Lagu Diray / Gacanta
            </span>
            <div className="text-2xl font-black text-slate-900 font-mono tracking-tight mt-0.5">
              {fmt(metrics.nonDebtSalesTotal)}
            </div>
          </div>
          <div className="pt-3 mt-2 border-t border-slate-100 text-[11px] font-semibold text-slate-500 flex justify-between">
            <span>Invoices Paid:</span>
            <strong className="text-teal-700 font-bold">{metrics.nonDebtTxCount} Invoices</strong>
          </div>
        </div>

        {/* Card 5: Deynta Cusub ee Maanta Baxday (Debt Sales) */}
        <div className="bg-white p-5 rounded-[28px] border border-rose-200/90 shadow-sm flex flex-col justify-between hover:shadow-md transition-shadow">
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="w-9 h-9 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <CreditCard size={18} />
              </div>
              <span className="px-2 py-0.5 bg-rose-100 text-rose-800 text-[10px] font-black uppercase rounded-md">
                Deyn Cusub
              </span>
            </div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block">
              Iibka Deynta Lagu Qaatay
            </span>
            <div className="text-2xl font-black text-rose-600 font-mono tracking-tight mt-0.5">
              {fmt(metrics.debtSalesTotal)}
            </div>
          </div>
          <div className="pt-3 mt-2 border-t border-slate-100 text-[11px] font-semibold text-slate-500 flex justify-between">
            <span>Invoices Deynta:</span>
            <strong className="text-rose-700 font-bold">{metrics.debtTxCount} Invoices</strong>
          </div>
        </div>
      </div>

      {/* 4. Sub-Tab Switcher Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2 overflow-x-auto scrollbar-hide">
        {[
          { id: 'OVERVIEW', label: '1. Graph-ka & Suuqa (Charts & Trends)', icon: BarChart3 },
          { id: 'CHANNELS', label: '2. Meelaha Lacagta Lagu Diray (Channels)', icon: Smartphone },
          { id: 'ACCOUNTS', label: '3. Xisaabta Account-yada (Accounts Ledger)', icon: Landmark },
          { id: 'TRANSACTIONS', label: '4. Dhammaan Iibkii Dhacay (Detailed Sales Log)', icon: Receipt },
        ].map(tab => {
          const Icon = tab.icon;
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id as any)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl font-black text-xs md:text-sm transition-all whitespace-nowrap cursor-pointer ${
                isActive 
                  ? 'bg-slate-900 text-white shadow-md' 
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
              }`}
            >
              <Icon size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* SUB-VIEW 1: GRAPHS, CHARTS & MARKET TRENDS */}
      {/* ========================================================================= */}
      {activeSubTab === 'OVERVIEW' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Sales & Profit Trend Chart */}
          <div className="lg:col-span-2 bg-white rounded-[32px] p-6 border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <BarChart3 size={18} className="text-blue-600" />
                  Graph-ka Dhaqdhaqaaqa Iibka & Faa'iidada ({filterLabel})
                </h3>
                <p className="text-xs text-slate-500 font-semibold">
                  Muuqaalka sida iibku u socday, faa'iidada saafiga ah (Net Profit), iyo deynta la qaatay.
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs font-bold">
                <span className="flex items-center gap-1 text-blue-600">
                  <span className="w-2.5 h-2.5 bg-blue-600 rounded-full" /> Net Sales
                </span>
                <span className="flex items-center gap-1 text-emerald-600">
                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full" /> Net Profit
                </span>
                <span className="flex items-center gap-1 text-amber-600">
                  <span className="w-2.5 h-2.5 bg-amber-500 rounded-full" /> Deyn
                </span>
              </div>
            </div>

            <div className="h-72 w-full pt-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={metrics.trendChartData}>
                  <defs>
                    <linearGradient id="salesGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0}/>
                    </linearGradient>
                    <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10B981" stopOpacity={0.4}/>
                      <stop offset="95%" stopColor="#10B981" stopOpacity={0.0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                  <XAxis dataKey="time" tick={{ fontSize: 11, fill: '#64748B' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#64748B' }} />
                  <Tooltip 
                    formatter={(value: any) => [fmt(Number(value)), '']}
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)' }}
                  />
                  <Area type="monotone" dataKey="sales" name="Iibka Guud" stroke="#3B82F6" strokeWidth={3} fillOpacity={1} fill="url(#salesGrad)" />
                  <Area type="monotone" dataKey="profit" name="Faa'iidada (Net Profit)" stroke="#10B981" strokeWidth={2.5} fillOpacity={1} fill="url(#profitGrad)" />
                  <Bar dataKey="debt" name="Deynta" fill="#F59E0B" radius={[4, 4, 0, 0]} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Payment Method Distribution Pie Chart */}
          <div className="bg-white rounded-[32px] p-6 border border-slate-200/90 shadow-sm space-y-4 flex flex-col justify-between">
            <div>
              <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                <PieChartIcon size={18} className="text-purple-600" />
                Qaabka Lacagtu Ku Soo Gashay
              </h3>
              <p className="text-xs text-slate-500 font-semibold">
                Kala saarista Caddaan, Bank, Mobile & Deyn
              </p>
            </div>

            <div className="h-56 w-full relative flex items-center justify-center">
              {metrics.paymentPieData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.paymentPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={85}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {metrics.paymentPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: any) => [fmt(Number(value)), '']} />
                  </PieChart>
                </ResponsiveContainer>
              ) : (
                <div className="text-center text-xs text-slate-400 font-bold">
                  Ma jiro wax iib ah oo mudadaas dhacay
                </div>
              )}
            </div>

            <div className="space-y-2 pt-2 border-t border-slate-100 text-xs">
              {metrics.paymentPieData.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between font-semibold">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-slate-700">{item.name}</span>
                  </div>
                  <div className="text-right">
                    <span className="font-black text-slate-900">{fmt(item.value)}</span>
                    <span className="text-[10px] text-slate-400 ml-1.5">
                      ({metrics.totalGrossSales > 0 ? ((item.value / metrics.totalGrossSales) * 100).toFixed(0) : 0}%)
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 2: CHANNELS BREAKDOWN (Meelaha Lacagta Lagu Diray) */}
      {/* ========================================================================= */}
      {activeSubTab === 'CHANNELS' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Cash In Hand */}
            <div className="bg-gradient-to-br from-emerald-500 to-teal-700 text-white rounded-[32px] p-6 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-white/20 rounded-2xl">
                  <DollarSign size={24} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2.5 py-1 rounded-full">
                  Caddaan / Cash
                </span>
              </div>
              <div>
                <span className="text-xs text-emerald-100 font-bold uppercase block">Lacagta Caddanka ah ee Iibka</span>
                <div className="text-2xl md:text-3xl font-black mt-1">{fmt(metrics.cashSalesTotal)}</div>
              </div>
              <div className="pt-4 border-t border-white/20 text-xs space-y-1 text-emerald-100">
                <div className="flex justify-between">
                  <span>Deyn lagu bixiyay Caddaan:</span>
                  <span className="font-bold text-white">+{fmt(metrics.debtRepayCash)}</span>
                </div>
                <div className="flex justify-between font-black text-white pt-1">
                  <span>Wadarta Caddanka Soo Galay:</span>
                  <span>{fmt(metrics.cashSalesTotal + metrics.debtRepayCash)}</span>
                </div>
              </div>
            </div>

            {/* Bank Transfers */}
            <div className="bg-gradient-to-br from-blue-600 to-indigo-800 text-white rounded-[32px] p-6 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-white/20 rounded-2xl">
                  <Landmark size={24} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2.5 py-1 rounded-full">
                  Bank Transfer
                </span>
              </div>
              <div>
                <span className="text-xs text-blue-100 font-bold uppercase block">Lacagta Bankiga Lagu Diray</span>
                <div className="text-2xl md:text-3xl font-black mt-1">{fmt(metrics.bankSalesTotal)}</div>
              </div>
              <div className="pt-4 border-t border-white/20 text-xs space-y-1 text-blue-100">
                <div className="flex justify-between">
                  <span>Deyn lagu bixiyay Bank:</span>
                  <span className="font-bold text-white">+{fmt(metrics.debtRepayBank)}</span>
                </div>
                <div className="flex justify-between font-black text-white pt-1">
                  <span>Wadarta Bankiga Ku Dhacday:</span>
                  <span>{fmt(metrics.bankSalesTotal + metrics.debtRepayBank)}</span>
                </div>
              </div>
            </div>

            {/* Mobile Money */}
            <div className="bg-gradient-to-br from-purple-600 to-pink-700 text-white rounded-[32px] p-6 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <div className="p-3 bg-white/20 rounded-2xl">
                  <Smartphone size={24} />
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider bg-white/20 px-2.5 py-1 rounded-full">
                  Mobile Money
                </span>
              </div>
              <div>
                <span className="text-xs text-purple-100 font-bold uppercase block">Zaad / Sahal / eDahab / Telebirr</span>
                <div className="text-2xl md:text-3xl font-black mt-1">{fmt(metrics.mobileSalesTotal)}</div>
              </div>
              <div className="pt-4 border-t border-white/20 text-xs space-y-1 text-purple-100">
                <div className="flex justify-between">
                  <span>Deyn lagu bixiyay Mobile:</span>
                  <span className="font-bold text-white">+{fmt(metrics.debtRepayMobile)}</span>
                </div>
                <div className="flex justify-between font-black text-white pt-1">
                  <span>Wadarta Mobile-ka Lagu Diray:</span>
                  <span>{fmt(metrics.mobileSalesTotal + metrics.debtRepayMobile)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 3: ACCOUNTS LEDGER BREAKDOWN */}
      {/* ========================================================================= */}
      {activeSubTab === 'ACCOUNTS' && (
        <div className="space-y-6">
          <div className="bg-white rounded-[32px] p-6 border border-slate-200/90 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  Liiska Account-yada & Lacagta Laga Rabo Inay Ku Jirto
                </h3>
                <p className="text-xs text-slate-500 font-semibold">
                  Dhammaan xisaabaadka sanduuqa, bangiyada, iyo mobile accounts-ka ee system-ka ku diiwaangashan.
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-slate-400 font-bold block uppercase">Wadarta Guud ee Account-yada</span>
                <span className="text-xl font-black text-purple-900">{fmt(metrics.totalAccountBalances)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pt-2">
              {(data.accounts || []).map(acc => {
                const tracked = metrics.accountMap[acc.id];
                return (
                  <div key={acc.id} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/70 hover:bg-white hover:shadow-md transition-all space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-black text-sm text-slate-800 uppercase tracking-tight truncate">{acc.name}</span>
                      <span className="text-[10px] font-black uppercase px-2 py-0.5 bg-slate-200 text-slate-700 rounded-md">
                        {acc.type}
                      </span>
                    </div>
                    <div className="flex items-baseline justify-between pt-2 border-t border-slate-200/60">
                      <span className="text-xs font-semibold text-slate-500">Haraaga (Current Balance):</span>
                      <span className="text-base font-black text-slate-900">{fmt(acc.balance)}</span>
                    </div>
                    {tracked && tracked.totalAmount > 0 && (
                      <div className="flex items-baseline justify-between pt-1 text-[11px] text-blue-700 font-bold">
                        <span>Iibka Mudaddan ku dhacay:</span>
                        <span>{fmt(tracked.totalAmount)}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SUB-VIEW 4: DETAILED SALES TRANSACTIONS LIST */}
      {/* ========================================================================= */}
      {activeSubTab === 'TRANSACTIONS' && (
        <div className="bg-white rounded-[32px] p-6 border border-slate-200/90 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Liiska Alaabta La Iibiyay (Itemized Sold Log - {filterLabel})
              </h3>
              <p className="text-xs text-slate-500 font-semibold">
                Xisaabinta tooska ah ee qiimaha asalka (Cost), Iibka (Sell), iyo Faa'iidada (Net Profit) ee xilli kasta.
              </p>
            </div>
            <span className="px-3 py-1 bg-blue-50 text-blue-800 text-xs font-black rounded-full border border-blue-200">
              {filteredSoldItems.length} Alaab ah
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase tracking-wider text-[10px]">
                  <th className="p-3">Waqtiga</th>
                  <th className="p-3">Macmiilka / Rasiidka</th>
                  <th className="p-3">Alaabta</th>
                  <th className="p-3 text-center">Tirada</th>
                  <th className="p-3 text-right">Cost Price</th>
                  <th className="p-3 text-right">Sell Price</th>
                  <th className="p-3 text-right">Net Profit</th>
                  <th className="p-3 text-center">Habka Bixinta</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredSoldItems.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-slate-400 font-bold text-sm">
                      Ma jiro wax iib ah oo mudadaas la duubay.
                    </td>
                  </tr>
                ) : (
                  filteredSoldItems.slice(0, 100).map(entry => (
                    <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3 text-slate-400 font-mono text-[11px] whitespace-nowrap">
                        {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3 whitespace-nowrap">
                        <div className="font-bold text-slate-900">{entry.customerName}</div>
                        <div className="text-[10px] text-slate-400">#TX-{entry.txId.slice(-5).toUpperCase()}</div>
                      </td>
                      <td className="p-3">
                        <span className="font-bold text-slate-800">{entry.item.name}</span>
                        {entry.item.category && (
                          <span className="text-[10px] text-slate-400 ml-1.5 font-medium">({entry.item.category})</span>
                        )}
                      </td>
                      <td className="p-3 text-center font-bold font-mono">
                        {entry.item.quantity} {entry.item.unit || 'PCS'}
                      </td>
                      <td className="p-3 text-right font-mono text-amber-700 font-bold">
                        {fmt(entry.totalCost)}
                      </td>
                      <td className="p-3 text-right font-mono text-blue-700 font-bold">
                        {fmt(entry.totalSell)}
                      </td>
                      <td className="p-3 text-right font-mono text-emerald-700 font-black">
                        {fmt(entry.totalProfit)}
                      </td>
                      <td className="p-3 text-center">
                        <span className={`px-2 py-0.5 rounded-md font-black text-[10px] uppercase ${
                          (entry.paymentMethod || '').toLowerCase().includes('debt')
                            ? 'bg-amber-100 text-amber-800'
                            : (entry.paymentMethod || '').toLowerCase().includes('bank')
                            ? 'bg-blue-100 text-blue-800'
                            : (entry.paymentMethod || '').toLowerCase().includes('mobile')
                            ? 'bg-purple-100 text-purple-800'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {entry.paymentMethod}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};
