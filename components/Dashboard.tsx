import React, { useState, useMemo } from 'react';
import { AppData, Currency, AppTab, UserRole } from '../types';
import { formatCurrency } from '../lib/utils';
import { 
  ShoppingBag, 
  Users, 
  TrendingUp, 
  ArrowUpRight, 
  AlertTriangle, 
  User, 
  ShoppingCart, 
  CalendarX, 
  Clock, 
  ShieldAlert, 
  ArrowRight,
  Calculator,
  HandCoins,
  DollarSign,
  Building2,
  Receipt,
  Scale,
  CreditCard,
  ChevronDown,
  ChevronUp,
  Package,
  Layers,
  Sparkles,
  ArrowDownRight
} from 'lucide-react';

import QuickAI from './QuickAI';
import DailyProfitAnalyzer from './DailyProfitAnalyzer';
import CashOutflowSection from './CashOutflowSection';
import DashboardPayablesSection from './DashboardPayablesSection';
import DashboardExpenseManager from './DashboardExpenseManager';

interface Props {
  data: AppData;
  currency: Currency;
  setActiveTab: (tab: AppTab) => void;
  onOpenAlerts?: () => void;
  setData?: React.Dispatch<React.SetStateAction<AppData>>;
  addLog?: (action: string, details: string) => void;
}

const Dashboard: React.FC<Props> = ({ 
  data, 
  currency, 
  setActiveTab, 
  onOpenAlerts,
  setData,
  addLog 
}) => {
  const rate = data.settings?.exchangeRate || 1;

  // Active sub-views for grouped modules
  const [debtActiveTab, setDebtActiveTab] = useState<'PAYABLES' | 'RECEIVABLES'>('PAYABLES');
  const [cashFlowActiveTab, setCashFlowActiveTab] = useState<'EXPENSES' | 'OUTFLOW'>('EXPENSES');
  const [isAlertsExpanded, setIsAlertsExpanded] = useState(false);
  const [selectedAlertCategory, setSelectedAlertCategory] = useState<'ALL' | 'EXPIRING' | 'LOW' | 'DEAD'>('ALL');

  const salesTransactions = useMemo(() => {
    return (data.transactions || []).filter(t => 
      t.type === 'SALE' || 
      (!t.type && !t.supplierId && !t.notes?.toLowerCase().includes('supplier') && t.items?.[0]?.sku !== 'SUPPLIER_PAYMENT')
    );
  }, [data.transactions]);

  const totalSales = salesTransactions.reduce((acc, t) => acc + (t.total || 0), 0);
  const totalProfit = salesTransactions.reduce((acc, t) => {
    const cost = (t.items || []).reduce((sum, item) => sum + ((item.costPrice || 0) * (item.quantity || 0)), 0);
    return acc + ((t.total || 0) - cost);
  }, 0);

  const activeDebtors = (data.customers || []).filter(c => (c.debtBalance || 0) > 0);
  const totalOutstandingDebt = useMemo(() => {
    return (data.customers || []).reduce((acc, c) => acc + (c.debtBalance || 0), 0);
  }, [data.customers]);

  const totalPayableDebt = useMemo(() => {
    return (data.suppliers || []).reduce((acc, s) => acc + (s.balance > 0 ? s.balance : 0), 0);
  }, [data.suppliers]);
  const activeCreditorsCount = (data.suppliers || []).filter(s => (s.balance || 0) > 0).length;

  // Detailed Inventory Alerts
  const inventoryAlertsData = useMemo(() => {
    const todayTime = Date.now();
    const thirtyDaysAgo = todayTime - (30 * 24 * 60 * 60 * 1000);

    // 1. Expired / Nearing Expiry (Within 90 Days)
    const expiringItems = (data.products || []).filter(p => {
      if (!p.expiryDate) return false;
      const expTime = new Date(p.expiryDate).getTime();
      const diffDays = Math.ceil((expTime - todayTime) / (1000 * 60 * 60 * 24));
      return diffDays <= 90;
    }).map(p => {
      const expTime = new Date(p.expiryDate!).getTime();
      const diffDays = Math.ceil((expTime - todayTime) / (1000 * 60 * 60 * 24));
      return {
        ...p,
        alertType: 'EXPIRING' as const,
        alertLabel: diffDays <= 0 ? 'Waa Dhacday (Expired)' : `${diffDays} Maalmood Dhiman`,
        severity: diffDays <= 0 ? 'CRITICAL' : diffDays <= 30 ? 'HIGH' : 'MEDIUM'
      };
    });

    // 2. Low Stock
    const lowStockItems = (data.products || []).filter(p => {
      if ((p.stock || 0) >= 9000) return false;
      const threshold = p.minStock !== undefined ? p.minStock : 0;
      return (p.stock || 0) <= threshold;
    }).map(p => ({
      ...p,
      alertType: 'LOW' as const,
      alertLabel: p.stock <= 0 ? 'Eber (Out of Stock)' : `Hadhay: ${p.stock} ${p.unit || 'pcs'}`,
      severity: p.stock <= 0 ? 'CRITICAL' : 'HIGH'
    }));

    // 3. Dead Stock (0 sales in last 30 days and tracked >= 30 days)
    const salesIn30DaysMap: Record<string, number> = {};
    (data.transactions || []).forEach(tx => {
      if (tx.timestamp >= thirtyDaysAgo && tx.type === 'SALE') {
        (tx.items || []).forEach(item => {
          salesIn30DaysMap[item.id] = (salesIn30DaysMap[item.id] || 0) + item.quantity;
        });
      }
    });

    const deadStockItems = (data.products || []).filter(p => {
      if ((p.stock || 0) <= 0 || (p.stock || 0) >= 9000) return false;
      const soldQty = salesIn30DaysMap[p.id] || 0;
      if (soldQty > 0) return false;

      const lastSale = p.lastSoldAt;
      const baseline = lastSale || p.trackingStartedAt || p.createdAt || todayTime;
      const diffMs = todayTime - baseline;
      const daysUnsold = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      return daysUnsold >= 30;
    }).map(p => ({
      ...p,
      alertType: 'DEAD' as const,
      alertLabel: '1 Bil Aan Soconin',
      severity: 'MEDIUM'
    }));

    const allAlerts = [...expiringItems, ...lowStockItems, ...deadStockItems];

    return {
      expiringItems,
      lowStockItems,
      deadStockItems,
      allAlerts,
      totalCount: allAlerts.length
    };
  }, [data.products, data.transactions]);

  const topDebtors = useMemo(() => {
    return [...activeDebtors].sort((a, b) => (b.debtBalance || 0) - (a.debtBalance || 0)).slice(0, 6);
  }, [activeDebtors]);

  // Filtered Alert Items for compact preview
  const displayedAlertProducts = useMemo(() => {
    if (selectedAlertCategory === 'EXPIRING') return inventoryAlertsData.expiringItems;
    if (selectedAlertCategory === 'LOW') return inventoryAlertsData.lowStockItems;
    if (selectedAlertCategory === 'DEAD') return inventoryAlertsData.deadStockItems;
    return inventoryAlertsData.allAlerts;
  }, [inventoryAlertsData, selectedAlertCategory]);

  const stats = [
    { label: 'Iibka Guud (Total Sales)', value: totalSales, subtitle: 'Guji si aad u ogaato xisaabta', icon: ShoppingBag, color: 'text-blue-600', bg: 'bg-blue-50', tab: AppTab.OGAANSHO },
    { label: 'Faa\'iidada Saafiga (Profit)', value: totalProfit, subtitle: 'Net Profit dukaanka', icon: TrendingUp, color: 'text-emerald-600', bg: 'bg-emerald-50', tab: null },
    { label: 'Deymaha Leygu Leeyahay', value: totalPayableDebt, subtitle: `${activeCreditorsCount} Ganacsato ayaa wax igu leh`, icon: Building2, color: 'text-rose-600', bg: 'bg-rose-50', tab: AppTab.SUPPLIERS },
    { label: 'Deymaha I Maqan (Receivables)', value: totalOutstandingDebt, subtitle: `${activeDebtors.length} Macamiil ayaa deyn lagu leeyahay`, icon: Users, color: 'text-amber-600', bg: 'bg-amber-50', tab: AppTab.DEBTORS },
    { label: 'Alaabta U Baahan Fiiro', value: inventoryAlertsData.totalCount, subtitle: `${inventoryAlertsData.expiringItems.length} dhacday • ${inventoryAlertsData.lowStockItems.length} gabaabsi`, icon: AlertTriangle, color: 'text-indigo-600', bg: 'bg-indigo-50', noCurrency: true, isAlert: true },
  ];

  return (
    <div className="p-2 sm:p-4 md:p-6 space-y-4 md:space-y-6 animate-in fade-in duration-300 pb-16">
      
      {/* 1. TOP HEADER & QUICK AI STRIP (Only visible to Manager; closed for Admin and Cashier) */}
      {data.settings?.currentUser?.role === UserRole.MANAGER && <QuickAI data={data} />}

      {/* 2. COMPACT ACTION & ALERTS STRIP */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 bg-white p-3 sm:p-4 rounded-2xl sm:rounded-3xl border border-slate-100 shadow-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            onClick={() => setActiveTab(AppTab.XISAABIN)}
            className="px-3.5 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-xs active:scale-95 cursor-pointer"
          >
            <Calculator size={15} />
            <span>Xisaabinta Iibka Maanta</span>
          </button>

          <button
            onClick={() => setActiveTab(AppTab.POS)}
            className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-2 shadow-xs active:scale-95 cursor-pointer"
          >
            <ShoppingCart size={15} />
            <span>POS Iib Cusub</span>
          </button>
        </div>

        {/* Quick Compact Alerts Pill */}
        {inventoryAlertsData.totalCount > 0 && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsAlertsExpanded(!isAlertsExpanded)}
              className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl text-xs font-black flex items-center gap-2 transition-all cursor-pointer"
            >
              <ShieldAlert size={15} className="text-rose-600 animate-pulse" />
              <span>Digniinta Alaabta ({inventoryAlertsData.totalCount})</span>
              {isAlertsExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
            </button>

            {onOpenAlerts && (
              <button
                onClick={onOpenAlerts}
                className="px-2.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-[11px] font-black transition-all hidden sm:flex items-center gap-1 cursor-pointer"
              >
                <span>Full Hub</span>
                <ArrowRight size={12} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* 3. EXPANDABLE COMPACT INVENTORY ALERTS (ALAAB KOOBAN OO LA FAHMI KARO) */}
      {inventoryAlertsData.totalCount > 0 && isAlertsExpanded && (
        <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-rose-950 p-4 sm:p-5 rounded-3xl text-white shadow-xl border border-rose-500/30 animate-in slide-in-from-top-2 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-rose-500 text-white text-[10px] font-black rounded uppercase tracking-wider">
                  Kaydka Dukaanka
                </span>
                <h4 className="text-sm sm:text-base font-black tracking-tight">
                  Alaabta U Baahan Ficil Degdeg Ah ({inventoryAlertsData.totalCount})
                </h4>
              </div>
              <p className="text-[11px] text-slate-300 mt-0.5">
                Xog kooban oo ku saabsan alaabta dhacday, mida dhammadka ah, iyo mida bishan aan gadanin.
              </p>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                onClick={() => setSelectedAlertCategory('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                  selectedAlertCategory === 'ALL' ? 'bg-white text-slate-900' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                Dhammaan ({inventoryAlertsData.totalCount})
              </button>
              <button
                onClick={() => setSelectedAlertCategory('EXPIRING')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                  selectedAlertCategory === 'EXPIRING' ? 'bg-rose-500 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                Dhacday/90 Maalmood ({inventoryAlertsData.expiringItems.length})
              </button>
              <button
                onClick={() => setSelectedAlertCategory('LOW')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                  selectedAlertCategory === 'LOW' ? 'bg-amber-500 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                Gabaabsi ({inventoryAlertsData.lowStockItems.length})
              </button>
              <button
                onClick={() => setSelectedAlertCategory('DEAD')}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-black uppercase transition-all cursor-pointer ${
                  selectedAlertCategory === 'DEAD' ? 'bg-purple-500 text-white' : 'bg-white/10 text-slate-300 hover:bg-white/20'
                }`}
              >
                1 Bil Aan Socon ({inventoryAlertsData.deadStockItems.length})
              </button>
            </div>
          </div>

          {/* Compact Product Table */}
          <div className="mt-3 overflow-x-auto max-h-[260px] touch-scroll rounded-xl border border-white/10">
            <table className="w-full text-left text-xs text-slate-200">
              <thead className="bg-white/10 text-[10px] font-black uppercase tracking-wider text-slate-300 sticky top-0 backdrop-blur-xs">
                <tr>
                  <th className="py-2.5 px-3">Magaca Alaabta</th>
                  <th className="py-2.5 px-3">Nooca Digniinta</th>
                  <th className="py-2.5 px-3">Stock-ga Hada Yaalla</th>
                  <th className="py-2.5 px-3">Qiimaha</th>
                  <th className="py-2.5 px-3 text-right">Falka</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {displayedAlertProducts.slice(0, 10).map((prod) => (
                  <tr key={prod.id} className="hover:bg-white/5 transition-colors">
                    <td className="py-2 px-3">
                      <div className="font-bold text-white truncate max-w-[200px]">{prod.name}</div>
                      <div className="text-[10px] text-slate-400">{prod.barcode || prod.sku || prod.category}</div>
                    </td>
                    <td className="py-2 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${
                        prod.alertType === 'EXPIRING' 
                          ? 'bg-rose-500/20 text-rose-300 border border-rose-500/40' 
                          : prod.alertType === 'LOW' 
                            ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40' 
                            : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                      }`}>
                        {prod.alertLabel}
                      </span>
                    </td>
                    <td className="py-2 px-3 font-bold text-white">
                      {prod.stock} {prod.unit || 'pcs'}
                    </td>
                    <td className="py-2 px-3 font-bold text-emerald-300">
                      {formatCurrency(prod.price || 0, currency, rate)}
                    </td>
                    <td className="py-2 px-3 text-right">
                      <button
                        onClick={() => setActiveTab(AppTab.PRODUCTS)}
                        className="px-2.5 py-1 bg-white/20 hover:bg-white/30 text-white rounded-lg text-[10px] font-bold transition-all cursor-pointer"
                      >
                        Wax Ka Beddel
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex items-center justify-between text-xs text-slate-400">
            <span>Waxaa muuqda {Math.min(10, displayedAlertProducts.length)} alaabood oo kooban.</span>
            <button
              onClick={() => {
                if (onOpenAlerts) onOpenAlerts();
                else setActiveTab(AppTab.PRODUCTS);
              }}
              className="text-rose-300 hover:text-white font-bold flex items-center gap-1 cursor-pointer text-[11px]"
            >
              <span>Eeg Dhammaan Alaabta Kaydka</span>
              <ArrowRight size={13} />
            </button>
          </div>
        </div>
      )}

      {/* 4. KEY METRICS / 5 STATS CARDS (KOR LOO SOO DHAWEEYAY) */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-2.5 sm:gap-3.5">
        {stats.map((stat, i) => (
          <div 
            key={i} 
            onClick={() => {
              if (stat.isAlert && onOpenAlerts) onOpenAlerts();
              if (stat.tab) setActiveTab(stat.tab);
            }}
            className="bg-white p-3.5 sm:p-4 rounded-2xl sm:rounded-3xl shadow-xs border border-slate-100 flex flex-col justify-between hover:shadow-md transition-all active:scale-95 cursor-pointer group"
          >
            <div className="flex items-center justify-between mb-2">
              <div className={`${stat.bg} p-2 rounded-xl group-hover:scale-105 transition-transform`}>
                <stat.icon className={stat.color} size={17} />
              </div>
              {stat.tab && (
                <ArrowUpRight size={13} className="text-slate-300 group-hover:text-slate-600 transition-colors" />
              )}
            </div>
            <div>
              <p className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest leading-tight truncate">
                {stat.label}
              </p>
              <p className="text-sm sm:text-lg font-black text-slate-900 mt-0.5 truncate">
                {stat.noCurrency ? stat.value : formatCurrency(stat.value, currency, rate)}
              </p>
              {stat.subtitle && (
                <p className="text-[9px] font-bold text-amber-600 mt-0.5 truncate">
                  {stat.subtitle}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* 5. MODULE 1: DAILY PROFIT ANALYZER & 7-DAY TREND (FAA'IIDADA & DIIWAANKA MAALMAHA) */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs overflow-hidden">
        <DailyProfitAnalyzer data={data} currency={currency} />
      </div>

      {/* 6. MODULE 2: DEBT HUB (DEYMAHA LEYGU LEEYAHAY & DEYMAHA I MAQAN OO ISKU AG DHOW) */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-700 font-black text-[10px] rounded-md uppercase tracking-wider flex items-center gap-1">
                <Scale size={12} className="text-amber-600" />
                Xarunta Deymaha (Debt Management)
              </span>
              <span className="text-xs text-slate-400 font-bold hidden sm:inline">• Deymaha Ganacsatada & Macaamiisha</span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-0.5">
              Xisaabaadka Deymaha: Waxa Laguugu Leeyahay vs Waxa Kaaga Maqan
            </h3>
          </div>

          {/* Toggle Tabs: Payables vs Receivables */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl self-start sm:self-auto">
            <button
              onClick={() => setDebtActiveTab('PAYABLES')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                debtActiveTab === 'PAYABLES' 
                  ? 'bg-white text-rose-700 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Building2 size={14} />
              <span>Deymaha Leygu Leeyahay ({formatCurrency(totalPayableDebt, currency, rate)})</span>
            </button>

            <button
              onClick={() => setDebtActiveTab('RECEIVABLES')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                debtActiveTab === 'RECEIVABLES' 
                  ? 'bg-white text-amber-700 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Users size={14} />
              <span>Deymaha I Maqan ({formatCurrency(totalOutstandingDebt, currency, rate)})</span>
            </button>
          </div>
        </div>

        {/* Content depending on Debt Tab */}
        {debtActiveTab === 'PAYABLES' ? (
          <DashboardPayablesSection 
            data={data} 
            currency={currency} 
            setActiveTab={setActiveTab}
            setData={setData}
            addLog={addLog}
          />
        ) : (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100">
                <p className="text-[10px] font-black text-amber-700 uppercase tracking-wider">Wadarta Deymaha I Maqan</p>
                <p className="text-xl font-black text-amber-950 mt-1">{formatCurrency(totalOutstandingDebt, currency, rate)}</p>
                <p className="text-[11px] text-amber-700 font-semibold mt-0.5">{activeDebtors.length} Macaamiil ayaa lacag ku maqan tahay</p>
              </div>

              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100">
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Net Debt Balance</p>
                <p className="text-xl font-black text-slate-900 mt-1">
                  {formatCurrency(totalOutstandingDebt - totalPayableDebt, currency, rate)}
                </p>
                <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                  {totalOutstandingDebt >= totalPayableDebt ? 'Faa\'iido Deyn (Asset Positive)' : 'Dayn dheeraad ah (Liability)'}
                </p>
              </div>

              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 flex flex-col justify-between">
                <div>
                  <p className="text-[10px] font-black text-blue-700 uppercase tracking-wider">Xarunta Macaamiisha</p>
                  <p className="text-xs text-blue-950 font-bold mt-1">Diiwaangeli deyn cusub ama lacag-bixin</p>
                </div>
                <button
                  onClick={() => setActiveTab(AppTab.DEBTORS)}
                  className="mt-2 w-full py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer"
                >
                  Fur Debtors Hub
                </button>
              </div>
            </div>

            {/* Top Debtors Grid */}
            <div>
              <h4 className="text-xs font-black text-slate-800 uppercase tracking-wider mb-2.5">
                Macaamiisha Ugu Deynta Badan (Top Debtors)
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
                {topDebtors.map((debtor) => (
                  <div 
                    key={debtor.id} 
                    onClick={() => setActiveTab(AppTab.DEBTORS)}
                    className="p-3 bg-slate-50 hover:bg-amber-50/50 border border-slate-100 hover:border-amber-200 rounded-2xl flex items-center justify-between transition-all cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5 truncate">
                      <div className="w-8 h-8 bg-white rounded-xl flex items-center justify-center text-slate-400 border border-slate-200 shrink-0">
                        {debtor.photo ? (
                          <img src={debtor.photo} className="w-full h-full object-cover rounded-xl" alt={debtor.name} />
                        ) : (
                          <User size={15} />
                        )}
                      </div>
                      <div className="truncate">
                        <p className="text-xs font-black text-slate-900 truncate">{debtor.name}</p>
                        <p className="text-[10px] font-semibold text-slate-400">{debtor.phone || 'No phone'}</p>
                      </div>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className="text-xs font-black text-amber-600">
                        {formatCurrency(debtor.debtBalance || 0, currency, rate)}
                      </p>
                    </div>
                  </div>
                ))}
                {topDebtors.length === 0 && (
                  <div className="col-span-full py-6 text-center text-slate-400 text-xs font-bold">
                    Wax deyn ah oo macaamiil ka maqan ma jiraan!
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 7. MODULE 3: EXPENSES & CASH OUTFLOW HUB (KHARASHAADKA & LACAGAHA BAXAY OO ISKU AG DHOW) */}
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xs p-4 sm:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 bg-rose-500/10 text-rose-700 font-black text-[10px] rounded-md uppercase tracking-wider flex items-center gap-1">
                <Receipt size={12} className="text-rose-600" />
                Kharashaadka & Lacagaha Baxay
              </span>
              <span className="text-xs text-slate-400 font-bold hidden sm:inline">• Xaraynta kharashka & la socodka caddaanka baxay</span>
            </div>
            <h3 className="text-lg sm:text-xl font-black text-slate-900 tracking-tight mt-0.5">
              Xarunta Kharashaadka Dukaanka & Dadka Lacagta Qaatay
            </h3>
          </div>

          {/* Toggle Tabs: Expenses Hub vs Cash Outflows */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl self-start sm:self-auto">
            <button
              onClick={() => setCashFlowActiveTab('EXPENSES')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                cashFlowActiveTab === 'EXPENSES' 
                  ? 'bg-white text-rose-700 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Receipt size={14} />
              <span>Xaraynta Kharashaadka</span>
            </button>

            <button
              onClick={() => setCashFlowActiveTab('OUTFLOW')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black uppercase transition-all flex items-center gap-1.5 cursor-pointer ${
                cashFlowActiveTab === 'OUTFLOW' 
                  ? 'bg-white text-blue-700 shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <HandCoins size={14} />
              <span>Lacagaha Caddaanka ah ee Baxay</span>
            </button>
          </div>
        </div>

        {/* Content depending on Cash Flow Tab */}
        {cashFlowActiveTab === 'EXPENSES' ? (
          <DashboardExpenseManager 
            data={data} 
            currency={currency} 
            setData={setData} 
            addLog={addLog} 
          />
        ) : (
          <CashOutflowSection 
            data={data} 
            currency={currency} 
          />
        )}
      </div>

    </div>
  );
};

export default Dashboard;



