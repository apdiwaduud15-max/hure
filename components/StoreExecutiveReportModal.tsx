import React, { useState, useMemo } from 'react';
import { AppData, Currency, UserRole, PaymentMethod } from '../types';
import { formatCurrency } from '../lib/utils';
import { sendTwoHourPeriodicReport, sendStoreExecutiveReportEmail } from '../lib/emailAlertService';
import {
  generateExecutiveReportImage,
  ExecutiveReportData
} from '../lib/executiveReportImageGenerator';
import { dispatchWhatsAppImageShare } from '../lib/receiptImageGenerator';
import {
  X,
  Share2,
  Mail,
  Printer,
  TrendingUp,
  DollarSign,
  AlertTriangle,
  Package,
  Calendar,
  Users,
  Building2,
  CheckCircle2,
  Clock,
  Wallet,
  ArrowRight,
  ShieldCheck,
  Send,
  Sparkles,
  Download,
  Image as ImageIcon,
  Copy,
  ChevronRight,
  BarChart3
} from 'lucide-react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, CartesianGrid, Cell } from 'recharts';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: AppData;
  currency: Currency;
}

// Helper to determine if an item or product belongs to Khudaar (Vegetables/Fruits)
const isKhudaarItem = (item: any): boolean => {
  if (!item) return false;
  const cat = (item.category || '').toLowerCase();
  const name = (item.name || '').toLowerCase();
  const sku = (item.sku || '').toLowerCase();
  return (
    cat.includes('khudaar') ||
    cat.includes('vegetable') ||
    cat.includes('fruit') ||
    cat.includes('miro') ||
    name.includes('khudaar') ||
    sku.includes('khudaar') ||
    item.unit === 'KG'
  );
};

export const StoreExecutiveReportModal: React.FC<Props> = ({
  isOpen,
  onClose,
  data,
  currency
}) => {
  if (!isOpen) return null;

  const rate = data.settings?.exchangeRate || 190;
  const currentRole = data.settings?.currentUser?.role || UserRole.ADMIN;
  const isCashier = currentRole === UserRole.CASHIER;

  const [period, setPeriod] = useState<'today' | 'yesterday' | 'month' | '7days'>('today');
  const [activeTab, setActiveTab] = useState<'overview' | 'daily' | 'products' | 'debtors' | 'stock'>('overview');
  const [isGeneratingImage, setIsGeneratingImage] = useState(false);
  const [emailSending, setEmailSending] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Time bounds for report periods
  const bounds = useMemo(() => {
    const now = new Date();
    let start = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0).getTime();
    let end = Date.now();
    let label = 'Maanta (Today)';

    if (period === 'yesterday') {
      const yStart = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 0, 0, 0, 0);
      const yEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1, 23, 59, 59, 999);
      start = yStart.getTime();
      end = yEnd.getTime();
      label = '2-dii Bisha / Shalay (Yesterday)';
    } else if (period === 'month') {
      const d = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      start = d.getTime();
      end = Date.now();
      label = `Bishan (${now.toLocaleString('so-SO', { month: 'long', year: 'numeric' })})`;
    } else if (period === '7days') {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
      start = d.getTime();
      end = Date.now();
      label = '7-dii Maalmood ee U Dambeysay';
    }

    return { start, end, label };
  }, [period]);

  // Aggregate Data (EXCLUDING KHUDAAR FROM ALL GENERAL STORE CALCULATIONS)
  const report = useMemo(() => {
    const { start, end } = bounds;

    // Filter Sales Transactions (Excluding Khudaar completely)
    const rawSalesTx = (data.transactions || []).filter(t => 
      t.timestamp >= start && t.timestamp <= end && (t.type === 'SALE' || (!t.type && !t.supplierId))
    );

    // Exclude any transaction items that are Khudaar
    const cleanSalesTx = rawSalesTx.filter(t => {
      // If transaction items are solely khudaar, ignore
      if (t.items && t.items.length > 0 && t.items.every(i => isKhudaarItem(i))) {
        return false;
      }
      return true;
    });

    const totalSalesRevenue = cleanSalesTx.reduce((sum, t) => sum + (t.total || 0), 0);
    const totalTransactionsCount = cleanSalesTx.length;

    // Breakdown: Cash sales vs Debt sales vs Bank vs Mobile
    let cashSalesTotal = 0;
    let debtSalesTotal = 0;
    let bankSalesTotal = 0;
    let mobileSalesTotal = 0;

    cleanSalesTx.forEach(t => {
      if (t.paymentDetails) {
        cashSalesTotal += (t.paymentDetails.cash || 0);
        debtSalesTotal += (t.paymentDetails.debt || 0);
        bankSalesTotal += (t.paymentDetails.bank || 0);
        mobileSalesTotal += (t.paymentDetails.mobile || 0);
      } else if (t.paymentMethod === PaymentMethod.CASH) {
        cashSalesTotal += (t.total || 0);
      } else if (t.paymentMethod === PaymentMethod.DEBT) {
        debtSalesTotal += (t.total || 0);
      } else if (t.paymentMethod === PaymentMethod.BANK) {
        bankSalesTotal += (t.total || 0);
      } else {
        mobileSalesTotal += (t.total || 0);
      }
    });

    // Cost & Profit calculation (Cost of Goods Sold excluding khudaar)
    const totalCost = cleanSalesTx.reduce((sum, t) => {
      const cost = (t.items || []).filter(i => !isKhudaarItem(i)).reduce((s, i) => s + ((i.costPrice || 0) * (i.quantity || 1)), 0);
      return sum + cost;
    }, 0);
    const grossProfit = totalSalesRevenue - totalCost;

    // Store expenses in period (STRICTLY NO KHUDAAR EXPENSES)
    const totalExpenses = (data.expenses || [])
      .filter(e => (e.timestamp || 0) >= start && (e.timestamp || 0) <= end)
      .reduce((sum, e) => sum + (e.amount || 0), 0);

    const netProfit = grossProfit - totalExpenses;

    // Daily Rows breakdown (e.g., 1-dii bisha, 2-dii bisha, Maanta...)
    const daysMap: { [key: string]: { dateLabel: string; timestamp: number; sales: number; cost: number; expenses: number; profit: number; txCount: number } } = {};

    cleanSalesTx.forEach(t => {
      const d = new Date(t.timestamp);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const dayNum = d.getDate();
      const isToday = new Date().toDateString() === d.toDateString();
      const isYesterday = new Date(Date.now() - 86400000).toDateString() === d.toDateString();
      const dateLabel = isToday
        ? `Maanta (${dayNum}-${d.toLocaleString('so-SO', { month: 'short' })})`
        : isYesterday
        ? `2-dii Bisha / Shalay (${dayNum}-${d.toLocaleString('so-SO', { month: 'short' })})`
        : `${dayNum}-dii Bisha (${d.toLocaleString('so-SO', { month: 'short' })})`;

      if (!daysMap[key]) {
        const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
        daysMap[key] = { dateLabel, timestamp: dStart, sales: 0, cost: 0, expenses: 0, profit: 0, txCount: 0 };
      }
      const tCost = (t.items || []).filter(i => !isKhudaarItem(i)).reduce((acc, i) => acc + ((i.costPrice || 0) * (i.quantity || 1)), 0);
      daysMap[key].sales += (t.total || 0);
      daysMap[key].cost += tCost;
      daysMap[key].profit += ((t.total || 0) - tCost);
      daysMap[key].txCount += 1;
    });

    // Add Expenses to daily breakdown (strictly store expenses)
    (data.expenses || []).forEach(e => {
      const eTime = e.timestamp || 0;
      if (eTime >= start && eTime <= end) {
        const d = new Date(eTime);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        const dayNum = d.getDate();
        const isToday = new Date().toDateString() === d.toDateString();
        const isYesterday = new Date(Date.now() - 86400000).toDateString() === d.toDateString();
        const dateLabel = isToday
          ? `Maanta (${dayNum}-${d.toLocaleString('so-SO', { month: 'short' })})`
          : isYesterday
          ? `2-dii Bisha / Shalay (${dayNum}-${d.toLocaleString('so-SO', { month: 'short' })})`
          : `${dayNum}-dii Bisha (${d.toLocaleString('so-SO', { month: 'short' })})`;

        if (!daysMap[key]) {
          const dStart = new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
          daysMap[key] = { dateLabel, timestamp: dStart, sales: 0, cost: 0, expenses: 0, profit: 0, txCount: 0 };
        }
        daysMap[key].expenses += (e.amount || 0);
        daysMap[key].profit -= (e.amount || 0);
      }
    });

    const dailyRows = Object.values(daysMap).sort((a, b) => b.timestamp - a.timestamp);

    // Products breakdown (Excluding Khudaar)
    const productSalesMap: { [id: string]: { name: string; qty: number; sales: number; profit: number } } = {};
    cleanSalesTx.forEach(t => {
      (t.items || []).forEach(i => {
        if (isKhudaarItem(i)) return;
        if (!productSalesMap[i.id]) {
          productSalesMap[i.id] = { name: i.name, qty: 0, sales: 0, profit: 0 };
        }
        const itemSales = (i.sellPrice || 0) * (i.quantity || 1);
        const itemCost = (i.costPrice || 0) * (i.quantity || 1);
        productSalesMap[i.id].qty += (i.quantity || 1);
        productSalesMap[i.id].sales += itemSales;
        productSalesMap[i.id].profit += (itemSales - itemCost);
      });
    });

    const nonKhudaarProducts = (data.products || []).filter(p => !isKhudaarItem(p));

    // Top selling products (by revenue & qty)
    const topSellingProducts = Object.values(productSalesMap)
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 10);

    // Least selling products (low or 0 sales)
    const leastSellingProducts = nonKhudaarProducts.map(p => {
      const sold = productSalesMap[p.id]?.qty || 0;
      return { name: p.name, qty: sold, stock: p.stock || 0 };
    }).sort((a, b) => a.qty - b.qty).slice(0, 10);

    // High profit products (by margin percentage)
    const highProfitProducts = nonKhudaarProducts.map(p => {
      const cost = p.costPrice || 0;
      const sell = p.sellPrice || 0;
      const profit = sell - cost;
      const marginPct = sell > 0 ? (profit / sell) * 100 : 0;
      return { name: p.name, cost, sell, profit, marginPct };
    }).sort((a, b) => b.marginPct - a.marginPct).slice(0, 10);

    // Low profit products (low margin)
    const lowProfitProducts = nonKhudaarProducts.map(p => {
      const cost = p.costPrice || 0;
      const sell = p.sellPrice || 0;
      const profit = sell - cost;
      const marginPct = sell > 0 ? (profit / sell) * 100 : 0;
      return { name: p.name, cost, sell, profit, marginPct };
    }).filter(p => p.marginPct < 20).sort((a, b) => a.marginPct - b.marginPct).slice(0, 10);

    // Current Debtors & What they took
    const debtors = (data.customers || []).filter(c => (c.debtBalance || 0) > 0)
      .sort((a, b) => b.debtBalance - a.debtBalance);
    const totalDebtOutstanding = debtors.reduce((sum, c) => sum + c.debtBalance, 0);

    const debtorsWithItems = debtors.map(c => {
      // Find what they bought recently on debt
      const customerTx = (data.transactions || []).filter(t => 
        (t.customerId === c.id || t.customerName?.toLowerCase() === c.name.toLowerCase()) &&
        (t.paymentMethod === PaymentMethod.DEBT || (t.paymentDetails?.debt ?? 0) > 0 || t.type === 'SALE')
      );
      const itemsList: string[] = [];
      customerTx.slice(-5).forEach(t => {
        (t.items || []).forEach(i => {
          if (!isKhudaarItem(i) && !itemsList.includes(i.name)) {
            itemsList.push(`${i.name} (x${i.quantity || 1})`);
          }
        });
      });
      return {
        id: c.id,
        name: c.name,
        phone: c.phone || 'No phone',
        debtBalance: c.debtBalance,
        itemsTaken: itemsList.slice(0, 4).join(', ') || 'Alaabooyin kala duwan'
      };
    });

    // Current Ledger Accounts Balance
    const accounts = data.accounts || [];
    const totalAccountsBalance = accounts.reduce((sum, a) => sum + (a.balance || 0), 0);

    // Low Stock Alert (stock <= minStock or <= 5)
    const lowStockItems = nonKhudaarProducts.filter(p => p.stock <= (p.minStock ?? 5))
      .sort((a, b) => a.stock - b.stock);

    // Expiring Products (within 60 days)
    const nowTs = Date.now();
    const sixtyDaysTs = nowTs + (60 * 24 * 60 * 60 * 1000);
    const expiringItems = nonKhudaarProducts.filter(p => {
      if (!p.expiryDate) return false;
      const expTime = new Date(p.expiryDate).getTime();
      return expTime > 0 && expTime <= sixtyDaysTs;
    }).map(p => {
      const expTime = new Date(p.expiryDate!).getTime();
      const daysLeft = Math.max(0, Math.ceil((expTime - nowTs) / (1000 * 60 * 60 * 24)));
      return { name: p.name, expiryDate: p.expiryDate!, daysLeft };
    }).sort((a, b) => a.daysLeft - b.daysLeft);

    return {
      totalSalesRevenue,
      totalTransactionsCount,
      totalCost,
      cashSalesTotal,
      debtSalesTotal,
      bankSalesTotal,
      mobileSalesTotal,
      grossProfit,
      totalExpenses,
      netProfit,
      dailyRows,
      topSellingProducts,
      leastSellingProducts,
      highProfitProducts,
      lowProfitProducts,
      debtorsWithItems,
      debtors,
      totalDebtOutstanding,
      accounts,
      totalAccountsBalance,
      lowStockItems,
      expiringItems
    };
  }, [data, bounds]);

  // Chart Data
  const chartData = useMemo(() => {
    return [
      { name: 'Iibka Guud', value: report.totalSalesRevenue, fill: '#2563eb' },
      { name: 'Raasamaal (Cost)', value: report.totalCost, fill: '#64748b' },
      { name: "Faa'iido Saafi", value: Math.max(0, report.netProfit), fill: '#059669' },
      { name: 'Kharash', value: report.totalExpenses, fill: '#d97706' },
      { name: 'Caddaan (Cash)', value: report.cashSalesTotal, fill: '#10b981' },
      { name: 'Deyn Ku Maqan', value: report.totalDebtOutstanding, fill: '#e11d48' },
    ];
  }, [report]);

  // Generate and Send WhatsApp Report strictly as an IMAGE
  const handleSendWhatsAppImage = async (targetTitle: 'Admin' | 'Manager') => {
    setIsGeneratingImage(true);
    setStatusMsg(null);
    try {
      const rawPhone = targetTitle === 'Admin'
        ? (data.settings?.adminWhatsAppPhone || data.settings?.storePhone || '')
        : (data.settings?.managerWhatsAppPhone || '');

      const storeName = data.settings?.businessName || 'Xaysimo Supermarket';
      const now = new Date();
      const generatedDateStr = now.toLocaleDateString('so-SO', { dateStyle: 'full' });
      const generatedTimeStr = now.toLocaleTimeString('so-SO', { hour: '2-digit', minute: '2-digit' });

      const reportPayload: ExecutiveReportData = {
        storeName,
        targetTitle,
        targetPhone: rawPhone,
        periodLabel: bounds.label,
        currency,
        exchangeRate: rate,
        generatedDateStr,
        generatedTimeStr,

        totalSalesRevenue: report.totalSalesRevenue,
        totalTransactionsCount: report.totalTransactionsCount,
        totalCost: report.totalCost,
        grossProfit: report.grossProfit,
        totalExpenses: report.totalExpenses,
        netProfit: report.netProfit,

        cashSalesTotal: report.cashSalesTotal,
        debtSalesTotal: report.debtSalesTotal,
        bankSalesTotal: report.bankSalesTotal,
        mobileSalesTotal: report.mobileSalesTotal,

        accounts: report.accounts.map(a => ({ id: a.id, name: a.name, type: a.type, balance: a.balance || 0 })),
        totalAccountsBalance: report.totalAccountsBalance,

        dailyRows: report.dailyRows,
        topSellingProducts: report.topSellingProducts,
        leastSellingProducts: report.leastSellingProducts,
        highProfitProducts: report.highProfitProducts,
        lowProfitProducts: report.lowProfitProducts,

        lowStockItems: report.lowStockItems.map(i => ({ name: i.name, stock: i.stock, unit: i.unit || 'pcs', minStock: i.minStock ?? 5 })),
        expiringItems: report.expiringItems,

        debtorsWithItems: report.debtorsWithItems,
        totalDebtOutstanding: report.totalDebtOutstanding
      };

      // Generate the full HD Canvas image
      const { blob, dataUrl, filename } = await generateExecutiveReportImage(reportPayload);

      // Open WhatsApp image share popup with copy & direct share options
      dispatchWhatsAppImageShare({
        blob,
        dataUrl,
        filename,
        phone: rawPhone,
        title: `Warbixinta Guud ee Dukaanka (${targetTitle}) - ${bounds.label}`,
        customerName: `${targetTitle} (${storeName})`
      });

      setStatusMsg({
        type: 'success',
        text: `✅ Sawirka warbixinta waa la diyaariyay! Waxaa loo furay WhatsApp ${targetTitle}.`
      });
    } catch (err: any) {
      console.error('Error generating executive report image:', err);
      setStatusMsg({
        type: 'error',
        text: `Cillad ayaa dhacday marka sawirka la diyaarinayay: ${err?.message || 'Failed'}`
      });
    } finally {
      setIsGeneratingImage(false);
    }
  };

  // Direct PNG Download
  const handleDownloadImage = async () => {
    setIsGeneratingImage(true);
    try {
      const storeName = data.settings?.businessName || 'Xaysimo Supermarket';
      const now = new Date();
      const reportPayload: ExecutiveReportData = {
        storeName,
        targetTitle: 'Admin',
        targetPhone: '',
        periodLabel: bounds.label,
        currency,
        exchangeRate: rate,
        generatedDateStr: now.toLocaleDateString('so-SO', { dateStyle: 'full' }),
        generatedTimeStr: now.toLocaleTimeString('so-SO', { hour: '2-digit', minute: '2-digit' }),
        totalSalesRevenue: report.totalSalesRevenue,
        totalTransactionsCount: report.totalTransactionsCount,
        totalCost: report.totalCost,
        grossProfit: report.grossProfit,
        totalExpenses: report.totalExpenses,
        netProfit: report.netProfit,
        cashSalesTotal: report.cashSalesTotal,
        debtSalesTotal: report.debtSalesTotal,
        bankSalesTotal: report.bankSalesTotal,
        mobileSalesTotal: report.mobileSalesTotal,
        accounts: report.accounts.map(a => ({ id: a.id, name: a.name, type: a.type, balance: a.balance || 0 })),
        totalAccountsBalance: report.totalAccountsBalance,
        dailyRows: report.dailyRows,
        topSellingProducts: report.topSellingProducts,
        leastSellingProducts: report.leastSellingProducts,
        highProfitProducts: report.highProfitProducts,
        lowProfitProducts: report.lowProfitProducts,
        lowStockItems: report.lowStockItems.map(i => ({ name: i.name, stock: i.stock, unit: i.unit || 'pcs', minStock: i.minStock ?? 5 })),
        expiringItems: report.expiringItems,
        debtorsWithItems: report.debtorsWithItems,
        totalDebtOutstanding: report.totalDebtOutstanding
      };

      const { dataUrl, filename } = await generateExecutiveReportImage(reportPayload);
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = filename;
      a.click();
    } catch (err: any) {
      alert(`Error: ${err?.message}`);
    } finally {
      setIsGeneratingImage(false);
    }
  };

  const handleSendEmailReport = async () => {
    setEmailSending(true);
    setStatusMsg(null);
    const targetEmail = data.settings?.adminAlertEmail || 'rumaanarumaan@gmail.com';
    try {
      const res = await sendStoreExecutiveReportEmail(data, {
        periodTitle: period === 'today' ? 'Maanta' : period === 'yesterday' ? '2-dii Bisha / Shalay' : period === 'month' ? 'Bishan' : '7 Maalmood',
        totalRevenue: report.totalSalesRevenue,
        totalProfit: report.grossProfit,
        totalExpenses: report.totalExpenses,
        totalDebt: report.totalDebtOutstanding,
        debtorsCount: report.debtorsWithItems.length,
        lowStockCount: report.lowStockItems.length,
        expiringCount: report.expiringItems.length
      }, targetEmail);

      if (res && res.success) {
        setStatusMsg({
          type: 'success',
          text: `Warbixinta (${res.message.includes('EmailJS') ? 'EmailJS' : 'Email'}) si toos ah ayaa loogu diray Admin-ka: ${targetEmail}`
        });
      } else {
        setStatusMsg({
          type: 'success',
          text: `Warbixinta waxaa loo diray queue: ${targetEmail} (${res?.message || 'Done'})`
        });
      }
    } catch (err: any) {
      setStatusMsg({
        type: 'error',
        text: `Cillad ayaa dhacday: ${err?.message || 'Failed to dispatch email'}`
      });
    } finally {
      setEmailSending(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-2 sm:p-4 overflow-y-auto animate-in fade-in">
      <div className="bg-white w-full max-w-6xl rounded-[32px] sm:rounded-[40px] shadow-2xl border border-slate-100 flex flex-col max-h-[94vh] overflow-hidden">
        
        {/* Header Bar */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2.5 sm:p-3 bg-blue-600 rounded-2xl shrink-0 shadow-lg">
              <BarChart3 size={24} className="text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-xl font-black text-white tracking-tight truncate">
                  Xogta Guud ee Dukaanka & Warbixinta Maamulka
                </h2>
                <span className="px-2.5 py-0.5 bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 rounded-full text-[10px] font-black uppercase tracking-wider">
                  Sawir Ahaan (Image Only)
                </span>
                <span className="px-2 py-0.5 bg-sky-500/20 text-sky-300 border border-sky-500/30 rounded-full text-[10px] font-bold">
                  Khudaarta Ka Saaran
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium truncate mt-0.5">
                Warbixin dhameystiran: Iibka maalinlaha ee bisha, faa'iidada, kharashka, alaabta ugu/iibsiga yar, deymaha & waxay qaateen.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 sm:p-2.5 rounded-2xl bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white transition-all cursor-pointer shrink-0"
            title="Xir"
          >
            <X size={20} />
          </button>
        </div>

        {/* Action Controls & Filter Toolbar */}
        <div className="p-3.5 sm:p-4 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          
          {/* Period Selector with Maanta & 2-dii Bisha / Shalay */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-2xl border border-slate-200 shadow-xs">
            <button
              onClick={() => setPeriod('today')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                period === 'today' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Maanta (Today)
            </button>
            <button
              onClick={() => setPeriod('yesterday')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                period === 'yesterday' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              2-dii Bisha / Shalay
            </button>
            <button
              onClick={() => setPeriod('month')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                period === 'month' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bishan (Monthly Breakdown)
            </button>
            <button
              onClick={() => setPeriod('7days')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                period === '7days' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 Maalmood
            </button>
          </div>

          {/* Action Buttons: WhatsApp Image to Admin & Manager */}
          <div className="flex flex-wrap items-center gap-2">
            
            {/* WhatsApp to Admin (Image Only) */}
            <button
              onClick={() => handleSendWhatsAppImage('Admin')}
              disabled={isGeneratingImage}
              className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="U dir Admin-ka warbixinta sawir ahaan iyadoo table & chart leh"
            >
              <ImageIcon size={14} />
              <span>{isGeneratingImage ? 'Diyaarinayaa...' : 'WhatsApp Admin (Sawir)'}</span>
            </button>

            {/* WhatsApp to Manager (Image Only) */}
            <button
              onClick={() => handleSendWhatsAppImage('Manager')}
              disabled={isGeneratingImage}
              className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white font-black text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
              title="U dir Manager-ka warbixinta sawir ahaan iyadoo table & chart leh"
            >
              <ImageIcon size={14} />
              <span>{isGeneratingImage ? 'Diyaarinayaa...' : 'WhatsApp Manager (Sawir)'}</span>
            </button>

            {/* Direct Download PNG */}
            <button
              onClick={handleDownloadImage}
              disabled={isGeneratingImage}
              className="p-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer"
              title="Soo Deji Sawirka Warbixinta (Download PNG)"
            >
              <Download size={16} />
            </button>

            {/* Email to Admin */}
            <button
              onClick={handleSendEmailReport}
              disabled={emailSending}
              className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white font-black text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <Mail size={14} />
              <span className="hidden sm:inline">{emailSending ? 'Dirayaa...' : 'Gmail Admin'}</span>
            </button>

            {/* Print */}
            <button
              onClick={() => window.print()}
              className="p-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer"
              title="Daabac (Print)"
            >
              <Printer size={16} />
            </button>
          </div>
        </div>

        {/* View Tabs */}
        <div className="px-4 pt-2 bg-white border-b border-slate-200 flex items-center gap-2 overflow-x-auto shrink-0">
          <button
            onClick={() => setActiveTab('overview')}
            className={`pb-2.5 px-3 text-xs font-black border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            Guudmar (Overview & Chart)
          </button>
          <button
            onClick={() => setActiveTab('daily')}
            className={`pb-2.5 px-3 text-xs font-black border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
              activeTab === 'daily' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Iibka Maalinlaha ee Bisha</span>
            <span className="px-1.5 py-0.2 bg-blue-100 text-blue-800 rounded-full text-[10px]">
              {report.dailyRows.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('products')}
            className={`pb-2.5 px-3 text-xs font-black border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
              activeTab === 'products' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Alaabta (Ugu/Yar Iibka & Faa'iidada)</span>
          </button>
          <button
            onClick={() => setActiveTab('debtors')}
            className={`pb-2.5 px-3 text-xs font-black border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
              activeTab === 'debtors' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Deymaha & Waxay Qaateen</span>
            <span className="px-1.5 py-0.2 bg-rose-100 text-rose-800 rounded-full text-[10px]">
              {report.debtorsWithItems.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('stock')}
            className={`pb-2.5 px-3 text-xs font-black border-b-2 transition-all cursor-pointer whitespace-nowrap flex items-center gap-1 ${
              activeTab === 'stock' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <span>Dhamaan & Dhici Rabta</span>
            {(report.lowStockItems.length > 0 || report.expiringItems.length > 0) && (
              <span className="px-1.5 py-0.2 bg-amber-100 text-amber-800 rounded-full text-[10px]">
                {report.lowStockItems.length + report.expiringItems.length}
              </span>
            )}
          </button>
        </div>

        {/* Status Notification */}
        {statusMsg && (
          <div className={`px-4 py-2.5 text-xs font-bold flex items-center gap-2 shrink-0 ${
            statusMsg.type === 'success' ? 'bg-emerald-50 text-emerald-800 border-b border-emerald-200' : 'bg-rose-50 text-rose-800 border-b border-rose-200'
          }`}>
            <CheckCircle2 size={16} className="shrink-0" />
            <span>{statusMsg.text}</span>
          </div>
        )}

        {/* Scrollable Report Content */}
        <div className="p-4 sm:p-6 space-y-6 overflow-y-auto flex-1">
          
          {/* Top Key Metrics Cards */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            
            {/* Total Sales */}
            <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50/50 rounded-2xl border border-blue-100">
              <span className="text-[10px] font-black uppercase text-blue-700 tracking-wider flex items-center gap-1">
                <DollarSign size={12} />
                Iibka Guud (Sales)
              </span>
              <p className="text-xl sm:text-2xl font-black text-blue-950 mt-1 truncate">
                {formatCurrency(report.totalSalesRevenue, currency, rate)}
              </p>
              <p className="text-[10px] font-bold text-blue-600 mt-0.5">
                {report.totalTransactionsCount} macaamiil iibsaday
              </p>
            </div>

            {/* Net Profit */}
            {!isCashier ? (
              <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50/50 rounded-2xl border border-emerald-100">
                <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider flex items-center gap-1">
                  <TrendingUp size={12} />
                  Faa'iidada Saafiga (Net)
                </span>
                <p className="text-xl sm:text-2xl font-black text-emerald-950 mt-1 truncate">
                  {formatCurrency(report.netProfit, currency, rate)}
                </p>
                <p className="text-[10px] font-bold text-emerald-600 mt-0.5">
                  Cost: {formatCurrency(report.totalCost, currency, rate)}
                </p>
              </div>
            ) : (
              <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50/50 rounded-2xl border border-emerald-100">
                <span className="text-[10px] font-black uppercase text-emerald-700 tracking-wider flex items-center gap-1">
                  <Wallet size={12} />
                  Lacag Caddaan Ah (Cash)
                </span>
                <p className="text-xl sm:text-2xl font-black text-emerald-950 mt-1 truncate">
                  {formatCurrency(report.cashSalesTotal, currency, rate)}
                </p>
                <p className="text-[10px] font-bold text-emerald-600 mt-0.5">
                  Caddaan toos loo qabtay
                </p>
              </div>
            )}

            {/* Total Expenses */}
            <div className="p-4 bg-gradient-to-br from-amber-50 to-orange-50/50 rounded-2xl border border-amber-100">
              <span className="text-[10px] font-black uppercase text-amber-700 tracking-wider flex items-center gap-1">
                <AlertTriangle size={12} />
                Kharashka Dukaanka
              </span>
              <p className="text-xl sm:text-2xl font-black text-amber-950 mt-1 truncate">
                {formatCurrency(report.totalExpenses, currency, rate)}
              </p>
              <p className="text-[10px] font-bold text-amber-600 mt-0.5">
                Kharashyada guud ee dukaanka
              </p>
            </div>

            {/* Total Debt Outstanding */}
            <div className="p-4 bg-gradient-to-br from-rose-50 to-orange-50/50 rounded-2xl border border-rose-100">
              <span className="text-[10px] font-black uppercase text-rose-700 tracking-wider flex items-center gap-1">
                <Users size={12} />
                Inta Deyn Ku Maqan
              </span>
              <p className="text-xl sm:text-2xl font-black text-rose-950 mt-1 truncate">
                {formatCurrency(report.totalDebtOutstanding, currency, rate)}
              </p>
              <p className="text-[10px] font-bold text-rose-600 mt-0.5">
                {report.debtorsWithItems.length} qof ayaa deyn ku maqan
              </p>
            </div>

          </div>

          {/* TAB 1: OVERVIEW & CHART */}
          {activeTab === 'overview' && (
            <div className="space-y-6">
              
              {/* Payment Methods Breakdown */}
              <div className="p-4 sm:p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                  <Wallet size={16} className="text-blue-600" />
                  <span>Kala Saarid: Lacagaha Caddaan ah vs Deyn ku qaatay (Payment Breakdown)</span>
                </h3>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  <div className="p-3 bg-emerald-50/70 rounded-2xl border border-emerald-100">
                    <span className="text-xs font-black text-emerald-900 uppercase block">💵 Caddaan (Cash):</span>
                    <p className="text-base font-black text-emerald-700 font-mono mt-0.5">
                      {formatCurrency(report.cashSalesTotal, currency, rate)}
                    </p>
                  </div>
                  <div className="p-3 bg-rose-50/70 rounded-2xl border border-rose-100">
                    <span className="text-xs font-black text-rose-900 uppercase block">📝 Deyn (Debt):</span>
                    <p className="text-base font-black text-rose-700 font-mono mt-0.5">
                      {formatCurrency(report.debtSalesTotal, currency, rate)}
                    </p>
                  </div>
                  <div className="p-3 bg-blue-50/70 rounded-2xl border border-blue-100">
                    <span className="text-xs font-black text-blue-900 uppercase block">🏦 Bangiyada (Bank):</span>
                    <p className="text-base font-black text-blue-700 font-mono mt-0.5">
                      {formatCurrency(report.bankSalesTotal, currency, rate)}
                    </p>
                  </div>
                  <div className="p-3 bg-purple-50/70 rounded-2xl border border-purple-100">
                    <span className="text-xs font-black text-purple-900 uppercase block">📱 Mobile Money:</span>
                    <p className="text-base font-black text-purple-700 font-mono mt-0.5">
                      {formatCurrency(report.mobileSalesTotal, currency, rate)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Visual Chart Comparison */}
              <div className="p-4 sm:p-5 bg-slate-50 rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <h3 className="text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
                  <TrendingUp size={16} className="text-emerald-600" />
                  <span>Jaantuska Isbarbardhigga (Visual Chart Overview)</span>
                </h3>

                <div className="h-[220px] sm:h-[260px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={chartData} margin={{ top: 10, right: 10, left: -15, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }} axisLine={false} tickLine={false} />
                      <YAxis tick={{ fontSize: 11, fontWeight: 700, fill: '#475569' }} axisLine={false} tickLine={false} tickFormatter={(v) => `$${v}`} />
                      <Tooltip
                        formatter={(val: any) => [formatCurrency(Number(val) || 0, currency, rate), 'Qadarka']}
                        contentStyle={{ borderRadius: 12, backgroundColor: '#0f172a', color: '#fff', border: 'none', fontSize: 12 }}
                      />
                      <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                        {chartData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Quick Summary Grid of Accounts & Debtors */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                
                {/* Account Balances */}
                <div className="p-4 sm:p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <Building2 size={14} className="text-blue-600" />
                      <span>Lacagta Account-yada Ku Jirta</span>
                    </h3>
                    <span className="text-xs font-black text-blue-600 font-mono">
                      {formatCurrency(report.totalAccountsBalance, currency, rate)}
                    </span>
                  </div>

                  <div className="overflow-x-auto max-h-[220px]">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">
                          <th className="pb-2">Account-ka</th>
                          <th className="pb-2">Nooca</th>
                          <th className="pb-2 text-right">Haraaga</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {report.accounts.map(acc => (
                          <tr key={acc.id} className="hover:bg-slate-50">
                            <td className="py-2 font-bold text-slate-900">{acc.name}</td>
                            <td className="py-2 text-slate-500 text-[11px]">{acc.type}</td>
                            <td className="py-2 text-right font-black text-emerald-600 font-mono">
                              {formatCurrency(acc.balance, currency, rate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Top Debtors Quick Preview */}
                <div className="p-4 sm:p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                      <Users size={14} className="text-rose-600" />
                      <span>Deymaha Ku Maqan ({report.debtorsWithItems.length} Macamiil)</span>
                    </h3>
                    <span className="text-xs font-black text-rose-600 font-mono">
                      {formatCurrency(report.totalDebtOutstanding, currency, rate)}
                    </span>
                  </div>

                  <div className="overflow-x-auto max-h-[220px]">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">
                          <th className="pb-2">Macamiilka</th>
                          <th className="pb-2">Telefoonka</th>
                          <th className="pb-2 text-right">Deynta</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {report.debtorsWithItems.slice(0, 10).map(c => (
                          <tr key={c.id} className="hover:bg-slate-50">
                            <td className="py-2 font-bold text-slate-900">{c.name}</td>
                            <td className="py-2 text-slate-500 font-mono text-[11px]">{c.phone}</td>
                            <td className="py-2 text-right font-black text-rose-600 font-mono">
                              {formatCurrency(c.debtBalance, currency, rate)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* TAB 2: DAILY SALES & PROFIT BREAKDOWN OF THE MONTH */}
          {activeTab === 'daily' && (
            <div className="space-y-4">
              <div className="p-4 sm:p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                      <Calendar size={16} className="text-blue-600" />
                      <span>Xisaabta & Iibka Maalinlaha ee Bisha (Daily Sales, Cost & Net Profit)</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Kala saarid maalin kasta ah oo muujinaysa iibka maanta, 2-dii bisha, iyo maalmaha kale oo dhan.
                    </p>
                  </div>
                  <span className="text-xs font-black bg-blue-50 text-blue-700 px-3 py-1 rounded-xl border border-blue-200">
                    {report.dailyRows.length} Maalmood
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-[10px] font-black uppercase text-slate-700">
                        <th className="p-3 rounded-l-xl">Taariikhda / Maalinta</th>
                        <th className="p-3">Iibka Guud</th>
                        <th className="p-3">Raasamaal (Cost)</th>
                        <th className="p-3">Kharashka</th>
                        <th className="p-3">Faa'iidada Saafiga</th>
                        <th className="p-3 text-right rounded-r-xl">Tirada Iibka</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.dailyRows.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-slate-400 font-medium">
                            Wax dhaqdhaqaaq ah laguma diiwaangelin xilligan.
                          </td>
                        </tr>
                      ) : (
                        report.dailyRows.map((row, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="p-3 font-bold text-slate-900 flex items-center gap-2">
                              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                              <span>{row.dateLabel}</span>
                            </td>
                            <td className="p-3 font-black text-blue-600 font-mono">
                              {formatCurrency(row.sales, currency, rate)}
                            </td>
                            <td className="p-3 font-medium text-slate-600 font-mono">
                              {formatCurrency(row.cost, currency, rate)}
                            </td>
                            <td className="p-3 font-medium text-amber-600 font-mono">
                              {formatCurrency(row.expenses, currency, rate)}
                            </td>
                            <td className={`p-3 font-black font-mono ${row.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {formatCurrency(row.profit, currency, rate)}
                            </td>
                            <td className="p-3 text-right font-bold text-slate-600">
                              {row.txCount} iib
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: PRODUCTS (TOP / LEAST SELLING & HIGH / LOW PROFIT) */}
          {activeTab === 'products' && (
            <div className="space-y-6">
              
              {/* Dual Grid: Top Selling vs Least Selling */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                
                {/* Top Selling Products */}
                <div className="p-4 sm:p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Sparkles size={14} className="text-blue-600" />
                    <span>Alaabta Ugu Iibsiga Badan (Top Selling)</span>
                  </h3>
                  <div className="overflow-x-auto max-h-[260px]">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">
                          <th className="pb-2">Alaabta</th>
                          <th className="pb-2 text-center">Tirada</th>
                          <th className="pb-2 text-right">Iibka</th>
                          <th className="pb-2 text-right">Faa'iidada</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {report.topSellingProducts.map((p, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 font-bold text-slate-900">{idx + 1}. {p.name}</td>
                            <td className="py-2 text-center font-black text-emerald-600 font-mono">{p.qty} pcs</td>
                            <td className="py-2 text-right font-bold text-blue-600 font-mono">{formatCurrency(p.sales, currency, rate)}</td>
                            <td className="py-2 text-right font-black text-emerald-600 font-mono">{formatCurrency(p.profit, currency, rate)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Least Selling Products */}
                <div className="p-4 sm:p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <Clock size={14} className="text-amber-600" />
                    <span>Alaabta Ugu Iibsiga Yar (Least Selling / Slow)</span>
                  </h3>
                  <div className="overflow-x-auto max-h-[260px]">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">
                          <th className="pb-2">Alaabta</th>
                          <th className="pb-2 text-center">La Iibiyay</th>
                          <th className="pb-2 text-right">Stock Yaalla</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {report.leastSellingProducts.map((p, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 font-bold text-slate-900">{idx + 1}. {p.name}</td>
                            <td className="py-2 text-center font-black text-amber-600 font-mono">{p.qty} pcs</td>
                            <td className="py-2 text-right font-bold text-slate-600 font-mono">{p.stock} pcs</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

              {/* Dual Grid: High Profit Margin vs Low Profit Margin */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                
                {/* High Profit Products */}
                <div className="p-4 sm:p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <TrendingUp size={14} className="text-emerald-600" />
                    <span>Alaabta Faa'iidada Badan (High Margin)</span>
                  </h3>
                  <div className="overflow-x-auto max-h-[260px]">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">
                          <th className="pb-2">Alaabta</th>
                          <th className="pb-2 text-center">Cost</th>
                          <th className="pb-2 text-right">Iibka</th>
                          <th className="pb-2 text-right">Margin %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {report.highProfitProducts.map((p, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 font-bold text-slate-900">{idx + 1}. {p.name}</td>
                            <td className="py-2 text-center text-slate-500 font-mono">{formatCurrency(p.cost, currency, rate)}</td>
                            <td className="py-2 text-right font-bold text-blue-600 font-mono">{formatCurrency(p.sell, currency, rate)}</td>
                            <td className="py-2 text-right font-black text-emerald-600 font-mono">+{Math.round(p.marginPct)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Low Profit Products */}
                <div className="p-4 sm:p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
                  <h3 className="text-xs font-black text-slate-800 uppercase tracking-wide flex items-center gap-1.5">
                    <AlertTriangle size={14} className="text-rose-600" />
                    <span>Alaabta Faa'iidada Yar (Low Margin)</span>
                  </h3>
                  <div className="overflow-x-auto max-h-[260px]">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-black uppercase text-slate-400">
                          <th className="pb-2">Alaabta</th>
                          <th className="pb-2 text-center">Cost</th>
                          <th className="pb-2 text-right">Iibka</th>
                          <th className="pb-2 text-right">Margin %</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {report.lowProfitProducts.map((p, idx) => (
                          <tr key={idx} className="hover:bg-slate-50">
                            <td className="py-2 font-bold text-slate-900">{idx + 1}. {p.name}</td>
                            <td className="py-2 text-center text-slate-500 font-mono">{formatCurrency(p.cost, currency, rate)}</td>
                            <td className="py-2 text-right font-bold text-blue-600 font-mono">{formatCurrency(p.sell, currency, rate)}</td>
                            <td className="py-2 text-right font-black text-amber-600 font-mono">{Math.round(p.marginPct)}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

              </div>

            </div>
          )}

          {/* TAB 4: DEBTORS & ITEMS THEY TOOK */}
          {activeTab === 'debtors' && (
            <div className="space-y-4">
              <div className="p-4 sm:p-5 bg-white rounded-3xl border border-slate-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-wide flex items-center gap-2">
                      <Users size={16} className="text-rose-600" />
                      <span>Dadka Deymaha Lagu Leeyahay & Waxay Qaateen (Debtors Breakdown)</span>
                    </h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Macaamiisha deynta ku leh dukaanka, lacagta lagu leeyahay, iyo alaabta ay qaatay.
                    </p>
                  </div>
                  <span className="text-sm font-black text-rose-600 font-mono bg-rose-50 px-3 py-1 rounded-xl border border-rose-200">
                    Wadarta: {formatCurrency(report.totalDebtOutstanding, currency, rate)}
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-[10px] font-black uppercase text-slate-700">
                        <th className="p-3 rounded-l-xl">Magaca Macmiilka</th>
                        <th className="p-3">Telefoonka</th>
                        <th className="p-3">Wadarta Deynta</th>
                        <th className="p-3 rounded-r-xl">Waxay Qaateen (Items Taken on Credit)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {report.debtorsWithItems.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-6 text-center text-slate-400 font-medium">
                            Dukaanka hadda wax deyn ah oo ka maqan ma jirto.
                          </td>
                        </tr>
                      ) : (
                        report.debtorsWithItems.map((d, idx) => (
                          <tr key={d.id} className="hover:bg-slate-50">
                            <td className="p-3 font-bold text-slate-900">{idx + 1}. {d.name}</td>
                            <td className="p-3 text-slate-500 font-mono">{d.phone}</td>
                            <td className="p-3 font-black text-rose-600 font-mono">
                              {formatCurrency(d.debtBalance, currency, rate)}
                            </td>
                            <td className="p-3 text-slate-700 font-medium">
                              {d.itemsTaken}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 5: LOW STOCK & EXPIRING WARNINGS */}
          {activeTab === 'stock' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              
              {/* Low Stock Warning */}
              <div className="p-4 sm:p-5 bg-amber-50/60 rounded-3xl border border-amber-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-amber-900 uppercase flex items-center gap-1.5">
                    <Package size={14} className="text-amber-600" />
                    Alaabta Dhamaan Rabta ({report.lowStockItems.length})
                  </span>
                  <span className="text-[10px] font-bold text-amber-700">Stock ≤ minStock</span>
                </div>
                {report.lowStockItems.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">Dhammaan alaabtu stock fiican ayay leedahay.</p>
                ) : (
                  <div className="overflow-x-auto max-h-[300px]">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-amber-200/60 text-[10px] font-black uppercase text-amber-800">
                          <th className="pb-2">Alaabta</th>
                          <th className="pb-2 text-right">Haraaga Hadda</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-amber-100">
                        {report.lowStockItems.map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-2 font-bold text-amber-950">{item.name}</td>
                            <td className="py-2 text-right font-black text-rose-600 font-mono">{item.stock} {item.unit || 'pcs'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Expiring Products Warning */}
              <div className="p-4 sm:p-5 bg-rose-50/60 rounded-3xl border border-rose-200 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-rose-900 uppercase flex items-center gap-1.5">
                    <Clock size={14} className="text-rose-600" />
                    Alaabta Dhici Rabta ({report.expiringItems.length})
                  </span>
                  <span className="text-[10px] font-bold text-rose-700">≤ 60 Maalmood</span>
                </div>
                {report.expiringItems.length === 0 ? (
                  <p className="text-xs text-slate-500 py-3 text-center">Wax alaab ah oo waqtigoodu dhow yahay ma jiraan.</p>
                ) : (
                  <div className="overflow-x-auto max-h-[300px]">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="border-b border-rose-200/60 text-[10px] font-black uppercase text-rose-800">
                          <th className="pb-2">Alaabta</th>
                          <th className="pb-2 text-center">Taariikhda</th>
                          <th className="pb-2 text-right">Waqtiga</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-rose-100">
                        {report.expiringItems.map((item, idx) => (
                          <tr key={idx}>
                            <td className="py-2 font-bold text-rose-950">{item.name}</td>
                            <td className="py-2 text-center font-bold text-slate-600 font-mono text-[11px]">{item.expiryDate}</td>
                            <td className="py-2 text-right font-black text-rose-600 font-mono">{item.daysLeft} maalmood</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

            </div>
          )}

        </div>

        {/* Modal Footer Bar */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 text-xs text-slate-600 font-medium">
            <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded font-black text-[10px]">
              SAWIR AHAAN BES (IMAGE ONLY)
            </span>
            <span className="hidden md:inline">
              Markaad riixdo 'WhatsApp Admin' ama 'WhatsApp Manager', sawirka HD-ga ah oo leh tables iyo charts ayaa toos loogu dirayaa!
            </span>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-white hover:bg-slate-100 text-slate-700 font-bold text-xs rounded-xl border border-slate-200 transition-all cursor-pointer"
            >
              Xir (Close)
            </button>
            <button
              onClick={() => handleSendWhatsAppImage('Admin')}
              disabled={isGeneratingImage}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-xs flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
            >
              <ImageIcon size={14} />
              <span>{isGeneratingImage ? 'Diyaarinayaa...' : 'U Dir WhatsApp Admin (Sawir)'}</span>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
