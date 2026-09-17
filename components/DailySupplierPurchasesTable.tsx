import React, { useState, useMemo } from 'react';
import { AppData, Currency, StockAdjustment, Supplier } from '../types';
import { formatCurrency, generateId } from '../lib/utils';
import { 
  Calendar, 
  Search, 
  Filter, 
  Printer, 
  ShoppingBag, 
  Truck, 
  DollarSign, 
  CreditCard, 
  ArrowDownRight, 
  PackageCheck, 
  FileSpreadsheet, 
  Trash2,
  Eye,
  Download,
  Layers,
  Tag,
  Clock,
  Sparkles,
  CheckCircle2,
  X,
  FileText,
  SlidersHorizontal,
  Phone,
  ArrowUpRight,
  TrendingUp,
  Info
} from 'lucide-react';
import { ConfirmModal } from './ConfirmModal';

interface Props {
  data: AppData;
  setData?: React.Dispatch<React.SetStateAction<AppData>>;
  addLog?: (action: string, details: string) => void;
  currency: Currency;
  title?: string;
  className?: string;
}

export const DailySupplierPurchasesTable: React.FC<Props> = ({ 
  data, 
  setData, 
  addLog, 
  currency, 
  title = "Warbixinta Maalinlaha ah ee Iibka Supplier-yada (Daily Supplier Purchases)", 
  className = "" 
}) => {
  // Date filter modes
  const [dateFilter, setDateFilter] = useState<'TODAY' | 'YESTERDAY' | 'LAST_7_DAYS' | 'THIS_WEEK' | 'THIS_MONTH' | 'LAST_MONTH' | 'ALL' | 'CUSTOM' | 'CUSTOM_RANGE'>('TODAY');
  const [customDate, setCustomDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(new Date().toISOString().split('T')[0]);

  // Additional Filters
  const [supplierFilter, setSupplierFilter] = useState<string>('ALL');
  const [paymentTypeFilter, setPaymentTypeFilter] = useState<'ALL' | 'CASH' | 'CREDIT' | 'PARTIAL'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Modals
  const [deleteConfirmAdj, setDeleteConfirmAdj] = useState<StockAdjustment | null>(null);
  const [viewVoucherAdj, setViewVoucherAdj] = useState<StockAdjustment | null>(null);

  const rate = data.settings.exchangeRate || 120;

  // Categories list from products
  const categories = useMemo(() => {
    const cats = new Set<string>();
    data.products.forEach(p => {
      if (p.category && p.category.trim()) cats.add(p.category.trim());
    });
    return ['ALL', ...Array.from(cats)];
  }, [data.products]);

  // Filter stock adjustments for STOCK_IN (supplier purchases)
  const filteredAdjustments = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const todayEnd = todayStart + 24 * 60 * 60 * 1000 - 1;

    const yesterdayStart = todayStart - 24 * 60 * 60 * 1000;
    const yesterdayEnd = todayStart - 1;

    const last7DaysStart = todayStart - 6 * 24 * 60 * 60 * 1000;

    const startOfWeek = new Date(now);
    startOfWeek.setDate(now.getDate() - now.getDay());
    startOfWeek.setHours(0, 0, 0, 0);

    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const startOfLastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1).getTime();
    const endOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime();

    return data.stockAdjustments.filter(adj => {
      if (adj.type !== 'STOCK_IN') return false;

      // Date filtering
      const ts = adj.timestamp;
      let matchesDate = true;

      if (dateFilter === 'TODAY') {
        matchesDate = ts >= todayStart && ts <= todayEnd;
      } else if (dateFilter === 'YESTERDAY') {
        matchesDate = ts >= yesterdayStart && ts <= yesterdayEnd;
      } else if (dateFilter === 'LAST_7_DAYS') {
        matchesDate = ts >= last7DaysStart && ts <= todayEnd;
      } else if (dateFilter === 'THIS_WEEK') {
        matchesDate = ts >= startOfWeek.getTime();
      } else if (dateFilter === 'THIS_MONTH') {
        matchesDate = ts >= startOfMonth;
      } else if (dateFilter === 'LAST_MONTH') {
        matchesDate = ts >= startOfLastMonth && ts <= endOfLastMonth;
      } else if (dateFilter === 'CUSTOM' && customDate) {
        const customStart = new Date(`${customDate}T00:00:00`).getTime();
        const customEnd = new Date(`${customDate}T23:59:59.999`).getTime();
        matchesDate = ts >= customStart && ts <= customEnd;
      } else if (dateFilter === 'CUSTOM_RANGE' && customStartDate && customEndDate) {
        const rangeStart = new Date(`${customStartDate}T00:00:00`).getTime();
        const rangeEnd = new Date(`${customEndDate}T23:59:59.999`).getTime();
        matchesDate = ts >= rangeStart && ts <= rangeEnd;
      }

      if (!matchesDate) return false;

      // Supplier filter
      if (supplierFilter !== 'ALL') {
        if (adj.supplierId !== supplierFilter) {
          const supp = data.suppliers.find(s => s.id === supplierFilter);
          if (!supp || !adj.reason.toLowerCase().includes(supp.name.toLowerCase())) {
            return false;
          }
        }
      }

      // Payment type filter
      const pType = adj.paymentType || (adj.reason.includes('CREDIT') ? 'CREDIT' : adj.reason.includes('PARTIAL') ? 'PARTIAL' : 'CASH');
      if (paymentTypeFilter !== 'ALL' && pType !== paymentTypeFilter) {
        return false;
      }

      // Category filter
      if (categoryFilter !== 'ALL') {
        const prod = data.products.find(p => p.id === adj.productId);
        if (!prod || prod.category !== categoryFilter) {
          return false;
        }
      }

      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const prodMatch = adj.productName.toLowerCase().includes(q);
        const reasonMatch = adj.reason.toLowerCase().includes(q);
        const pageMatch = adj.pageNumber ? adj.pageNumber.toLowerCase().includes(q) : false;
        const noteMatch = adj.note ? adj.note.toLowerCase().includes(q) : false;
        const supp = data.suppliers.find(s => s.id === adj.supplierId);
        const suppMatch = supp ? supp.name.toLowerCase().includes(q) || supp.phone.includes(q) : false;
        const prod = data.products.find(p => p.id === adj.productId);
        const skuMatch = prod ? prod.sku.toLowerCase().includes(q) || prod.barcode.toLowerCase().includes(q) : false;
        
        if (!prodMatch && !reasonMatch && !suppMatch && !pageMatch && !noteMatch && !skuMatch) return false;
      }

      return true;
    });
  }, [
    data.stockAdjustments, 
    data.suppliers, 
    data.products, 
    dateFilter, 
    customDate, 
    customStartDate, 
    customEndDate, 
    supplierFilter, 
    paymentTypeFilter, 
    categoryFilter, 
    searchQuery
  ]);

  // Compute stats
  const stats = useMemo(() => {
    let totalCostSum = 0;
    let cashPaidSum = 0;
    let debtCreatedSum = 0;
    let totalQty = 0;
    const uniqueProducts = new Set<string>();
    const uniqueSuppliers = new Set<string>();

    filteredAdjustments.forEach(adj => {
      const prod = data.products.find(p => p.id === adj.productId);
      const unitCost = adj.unitCost ?? (prod ? prod.costPrice : 0);
      const totalCost = adj.totalCost ?? (adj.quantity * unitCost);
      const cash = adj.cashPaid ?? (adj.paymentType === 'CREDIT' ? 0 : totalCost);
      const debt = adj.debtCreated ?? (adj.paymentType === 'CREDIT' ? totalCost : 0);

      totalCostSum += totalCost;
      cashPaidSum += cash;
      debtCreatedSum += debt;
      totalQty += adj.quantity;
      uniqueProducts.add(adj.productId);
      if (adj.supplierId) uniqueSuppliers.add(adj.supplierId);
    });

    return {
      count: filteredAdjustments.length,
      totalQty,
      totalCostSum,
      cashPaidSum,
      debtCreatedSum,
      uniqueProductsCount: uniqueProducts.size,
      uniqueSuppliersCount: uniqueSuppliers.size
    };
  }, [filteredAdjustments, data.products]);

  const handleDeletePurchase = (adj: StockAdjustment) => {
    if (!setData) return;

    setData(prev => {
      // 1. Revert product stock
      const updatedProducts = prev.products.map(p => {
        if (p.id === adj.productId) {
          return {
            ...p,
            stock: Math.max(0, p.stock - adj.quantity)
          };
        }
        return p;
      });

      // 2. Revert treasury account if cash was paid
      const cashToReturn = adj.cashPaid || 0;
      let updatedAccounts = [...prev.accounts];
      if (cashToReturn > 0) {
        const cashAcc = updatedAccounts.find(a => a.id === adj.accountId) || 
                         updatedAccounts.find(a => a.id === 'acc-cash' || a.name.toLowerCase().includes('cash')) || 
                         updatedAccounts[0];
        if (cashAcc) {
          updatedAccounts = updatedAccounts.map(a => 
            a.id === cashAcc.id ? { ...a, balance: a.balance + cashToReturn } : a
          );
        }
      }

      // 3. Revert supplier balance if debt was created
      const debtToDeduct = adj.debtCreated || 0;
      let updatedSuppliers = [...prev.suppliers];
      if (debtToDeduct > 0 && adj.supplierId) {
        updatedSuppliers = updatedSuppliers.map(s => 
          s.id === adj.supplierId ? { ...s, balance: Math.max(0, s.balance - debtToDeduct) } : s
        );
      }

      // 4. Remove stock adjustment
      const updatedAdjustments = prev.stockAdjustments.filter(a => a.id !== adj.id);

      const binItem = {
        id: generateId(),
        type: 'STOCK_ADJUSTMENT' as const,
        deletedAt: Date.now(),
        title: `Purchase: ${adj.productName} (${adj.quantity} qty)`,
        description: `Cost: $${adj.totalCost || 0} • Supplier: ${adj.supplierName || 'N/A'} • Reason: ${adj.reason || 'Stock Purchase'}`,
        originalData: adj
      };
      const updatedDeletedIds = { ...(prev.deletedIds || {}) };
      updatedDeletedIds[adj.id] = Date.now();

      return {
        ...prev,
        products: updatedProducts,
        accounts: updatedAccounts,
        suppliers: updatedSuppliers,
        stockAdjustments: updatedAdjustments,
        recycleBin: [binItem, ...(prev.recycleBin || [])],
        deletedIds: updatedDeletedIds,
        lastModified: Date.now()
      };
    });

    if (addLog) {
      addLog('Delete Purchase Record', `Deleted purchase record for ${adj.productName} (-${adj.quantity} units). Stock & finances reverted.`);
    }

    setDeleteConfirmAdj(null);
  };

  const getSupplier = (adj: StockAdjustment): { name: string; phone?: string } => {
    if (adj.supplierId) {
      const supp = data.suppliers.find(s => s.id === adj.supplierId);
      if (supp) return { name: supp.name, phone: supp.phone };
    }
    const match = adj.reason.match(/Purchased from ([^.]+)/i) || adj.reason.match(/from ([^.]+)/i);
    if (match && match[1]) return { name: match[1].trim() };
    return { name: adj.supplierName || 'General Vendor' };
  };

  const getAccountName = (accId?: string) => {
    if (!accId) return 'Cash Drawer / Cadaan';
    const acc = data.accounts.find(a => a.id === accId);
    return acc ? acc.name : 'Cash Drawer';
  };

  // CSV Export
  const handleExportCSV = () => {
    if (filteredAdjustments.length === 0) return alert("Ma jiraan xog la dhoofin karo!");

    const headers = ['ID', 'Date', 'Time', 'Supplier', 'Product Name', 'Quantity', 'Unit Cost', 'Total Cost', 'Payment Type', 'Cash Paid', 'Debt Created', 'Page #', 'Note'];
    const rows = filteredAdjustments.map((adj, i) => {
      const prod = data.products.find(p => p.id === adj.productId);
      const unitCost = adj.unitCost ?? (prod ? prod.costPrice : 0);
      const totalCost = adj.totalCost ?? (adj.quantity * unitCost);
      const paymentType = adj.paymentType || (adj.reason.includes('CREDIT') ? 'CREDIT' : adj.reason.includes('PARTIAL') ? 'PARTIAL' : 'CASH');
      const cashPaid = adj.cashPaid ?? (paymentType === 'CREDIT' ? 0 : totalCost);
      const debtCreated = adj.debtCreated ?? (paymentType === 'CREDIT' ? totalCost : 0);
      const supp = getSupplier(adj);
      const dt = new Date(adj.timestamp);

      return [
        `#${i + 1}`,
        dt.toLocaleDateString(),
        dt.toLocaleTimeString(),
        `"${supp.name.replace(/"/g, '""')}"`,
        `"${adj.productName.replace(/"/g, '""')}"`,
        adj.quantity,
        unitCost,
        totalCost,
        paymentType,
        cashPaid,
        debtCreated,
        adj.pageNumber || '',
        `"${(adj.note || '').replace(/"/g, '""')}"`
      ].join(',');
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `purchases_report_${dateFilter.toLowerCase()}_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className={`bg-white rounded-[32px] border shadow-sm p-6 md:p-8 space-y-6 ${className}`}>
      {/* Header & Title */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-6">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
              <ShoppingBag size={24} />
            </div>
            <div>
              <h2 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight">{title}</h2>
              <p className="text-xs font-semibold text-slate-500 mt-0.5">
                Xogta iyo jadwalka maalinlaha ah ee alaabta lagasoo iibiyay supplier-yada oo leh taariikho gaar ah (Custom Dates)
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 no-print">
          <button
            onClick={handleExportCSV}
            className="px-4 py-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-2xl text-xs font-black flex items-center gap-2 transition-all active:scale-95"
            title="Dhoofi Excel / CSV"
          >
            <Download size={15} /> 📊 Export CSV
          </button>
          <button
            onClick={handlePrint}
            className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-sm transition-all active:scale-95"
          >
            <Printer size={15} /> 🖨️ Daabac Warbixinta (Print)
          </button>
        </div>
      </div>

      {/* Summary Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 rounded-3xl bg-blue-50/60 border border-blue-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-700">Wadarta Iibka (Total Purchased)</span>
            <ShoppingBag size={18} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900">{formatCurrency(stats.totalCostSum, currency, rate)}</h3>
            <p className="text-[10px] font-bold text-slate-500 mt-1">{stats.count} Diiwaan ({stats.totalQty} Xabbo)</p>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-emerald-50/60 border border-emerald-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-700">Cadaan Bixinta (Cash Paid)</span>
            <DollarSign size={18} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-emerald-700">{formatCurrency(stats.cashPaidSum, currency, rate)}</h3>
            <p className="text-[10px] font-bold text-slate-500 mt-1">Lacagta cadaanka ahaan loo bixiyay</p>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-rose-50/60 border border-rose-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-rose-600 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-700">Deynta Cusub (Credit Debt)</span>
            <CreditCard size={18} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-rose-600">{formatCurrency(stats.debtCreatedSum, currency, rate)}</h3>
            <p className="text-[10px] font-bold text-slate-500 mt-1">Deynta cusub ee supplier-ka ku kordhtay</p>
          </div>
        </div>

        <div className="p-5 rounded-3xl bg-purple-50/60 border border-purple-100 flex flex-col justify-between">
          <div className="flex items-center justify-between text-purple-600 mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-purple-700">Tirada Alaabta (Units Received)</span>
            <PackageCheck size={18} />
          </div>
          <div>
            <h3 className="text-2xl font-black text-slate-900">{stats.totalQty} <span className="text-xs font-bold text-slate-500">units</span></h3>
            <p className="text-[10px] font-bold text-slate-500 mt-1">{stats.uniqueProductsCount} nooc oo alaab ah</p>
          </div>
        </div>
      </div>

      {/* COMPREHENSIVE FILTER & CUSTOM DATE TOOLBAR */}
      <div className="p-5 bg-slate-50 rounded-3xl border border-slate-200 space-y-4 no-print">
        
        {/* Date Filter Buttons */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 mr-2 flex items-center gap-1">
            <Calendar size={13} className="text-blue-600" /> Waqtiga Iibka:
          </span>
          {[
            { id: 'TODAY', label: 'Maanta' },
            { id: 'YESTERDAY', label: 'Shalay' },
            { id: 'LAST_7_DAYS', label: '7-dii Maalmood' },
            { id: 'THIS_WEEK', label: 'Todobaadkan' },
            { id: 'THIS_MONTH', label: 'Bishan' },
            { id: 'LAST_MONTH', label: 'Bishii Hore' },
            { id: 'ALL', label: 'Dhammaan (All Time)' },
            { id: 'CUSTOM', label: '📅 Maalin Gaar Ah' },
            { id: 'CUSTOM_RANGE', label: '📆 Taariikh u Dhaxaysa (Range)' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setDateFilter(tab.id as any)}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                dateFilter === tab.id 
                  ? 'bg-blue-600 text-white shadow-sm' 
                  : 'bg-white text-slate-600 hover:bg-slate-200/70 border border-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Custom Date Pickers */}
        {dateFilter === 'CUSTOM' && (
          <div className="flex items-center gap-3 bg-white p-3 rounded-2xl border border-blue-200 animate-in fade-in slide-in-from-top-2">
            <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
              <Calendar size={14} className="text-blue-600" /> Dooro Maalinta:
            </span>
            <input
              type="date"
              value={customDate}
              onChange={e => setCustomDate(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-[11px] font-bold text-slate-400">
              Muujinaya iibka maalinkii: <strong className="text-slate-700">{new Date(customDate).toLocaleDateString()}</strong>
            </span>
          </div>
        )}

        {dateFilter === 'CUSTOM_RANGE' && (
          <div className="flex flex-wrap items-center gap-3 bg-white p-3 rounded-2xl border border-blue-200 animate-in fade-in slide-in-from-top-2">
            <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
              <Calendar size={14} className="text-blue-600" /> Laga Bilaabo:
            </span>
            <input
              type="date"
              value={customStartDate}
              onChange={e => setCustomStartDate(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-xs font-black text-slate-700">Ilaa:</span>
            <input
              type="date"
              value={customEndDate}
              onChange={e => setCustomEndDate(e.target.value)}
              className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-[11px] font-bold text-blue-700">
              ({new Date(customStartDate).toLocaleDateString()} — {new Date(customEndDate).toLocaleDateString()})
            </span>
          </div>
        )}

        {/* Secondary Filter Row: Search, Supplier, Payment Type, Category */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-1">
          {/* Search Box */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input
              type="text"
              placeholder="Raadi alaab, SKU, supplier, note..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Supplier Dropdown */}
          <div>
            <select
              value={supplierFilter}
              onChange={e => setSupplierFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">📦 Dhammaan Supplier-yada</option>
              {data.suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.name} ({s.phone || 'No phone'})</option>
              ))}
            </select>
          </div>

          {/* Payment Type Dropdown */}
          <div>
            <select
              value={paymentTypeFilter}
              onChange={e => setPaymentTypeFilter(e.target.value as any)}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">💳 Dhammaan Hababka Bixinta</option>
              <option value="CASH">💵 Cadaan Kaliya (CASH)</option>
              <option value="CREDIT">📜 Deyn Kaliya (CREDIT)</option>
              <option value="PARTIAL">⚖️ Qayb Cadaan & Deyn (PARTIAL)</option>
            </select>
          </div>

          {/* Category Dropdown */}
          <div>
            <select
              value={categoryFilter}
              onChange={e => setCategoryFilter(e.target.value)}
              className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="ALL">🏷️ Dhammaan Qeybaha (Categories)</option>
              {categories.filter(c => c !== 'ALL').map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Active Filter Info Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs font-bold text-slate-500 px-1">
        <div>
          Waxaa la helay <span className="text-slate-900 font-black">{filteredAdjustments.length}</span> iibsi ({stats.totalQty} xabbo)
          {dateFilter === 'CUSTOM' && ` ee taariikhda ${customDate}`}
          {dateFilter === 'CUSTOM_RANGE' && ` u dhaxaysa ${customStartDate} ilaa ${customEndDate}`}
        </div>
        {(searchQuery || supplierFilter !== 'ALL' || paymentTypeFilter !== 'ALL' || categoryFilter !== 'ALL' || dateFilter !== 'TODAY') && (
          <button
            onClick={() => {
              setDateFilter('TODAY');
              setSupplierFilter('ALL');
              setPaymentTypeFilter('ALL');
              setCategoryFilter('ALL');
              setSearchQuery('');
            }}
            className="text-blue-600 hover:text-blue-800 underline font-black text-xs flex items-center gap-1"
          >
            <X size={12} /> Dib u celi shaandhada (Reset Filters)
          </button>
        )}
      </div>

      {/* Main Table */}
      <div className="overflow-x-auto rounded-3xl border border-slate-200 shadow-sm">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-900 text-white text-[10px] uppercase font-black tracking-wider">
              <th className="p-4 rounded-tl-2xl"># / Taariikhda & Waqtiga</th>
              <th className="p-4">Supplier-ka</th>
              <th className="p-4">Alaabta & Faahfaahinta</th>
              <th className="p-4 text-center">Tirada (Qty)</th>
              <th className="p-4 text-right">Qiimaha Xabbadda</th>
              <th className="p-4 text-right">Wadarta Qiimaha</th>
              <th className="p-4 text-center">Habka Bixinta</th>
              <th className="p-4 text-right">Cadaan Bixiyay</th>
              <th className="p-4 text-right">Deynta Ku Kordhay</th>
              <th className="p-4 text-center rounded-tr-2xl">Voucher / Tallaabo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-800 bg-white">
            {filteredAdjustments.length > 0 ? (
              filteredAdjustments.map((adj, index) => {
                const prod = data.products.find(p => p.id === adj.productId);
                const unitCost = adj.unitCost ?? (prod ? prod.costPrice : 0);
                const totalCost = adj.totalCost ?? (adj.quantity * unitCost);
                const paymentType = adj.paymentType || (adj.reason.includes('CREDIT') ? 'CREDIT' : adj.reason.includes('PARTIAL') ? 'PARTIAL' : 'CASH');
                const cashPaid = adj.cashPaid ?? (paymentType === 'CREDIT' ? 0 : totalCost);
                const debtCreated = adj.debtCreated ?? (paymentType === 'CREDIT' ? totalCost : 0);
                const supp = getSupplier(adj);
                const dt = new Date(adj.timestamp);

                // Margin check
                const sellPrice = prod?.sellPrice || 0;
                const profitMargin = sellPrice > 0 && unitCost > 0 ? ((sellPrice - unitCost) / unitCost) * 100 : null;

                return (
                  <tr key={adj.id} className="hover:bg-blue-50/40 transition-colors">
                    <td className="p-4">
                      <span className="text-[10px] font-black text-slate-400 block">#{index + 1}</span>
                      <span className="text-xs font-black text-slate-900">{dt.toLocaleDateString()}</span>
                      <span className="text-[10px] text-slate-400 font-semibold block">{dt.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                      {adj.pageNumber && (
                        <span className="mt-1 inline-block px-2 py-0.5 bg-purple-100 text-purple-800 rounded-md font-black text-[9px]">
                          📄 Bogga: {adj.pageNumber}
                        </span>
                      )}
                    </td>

                    <td className="p-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5">
                          <Truck size={13} className="text-blue-600 shrink-0" />
                          <span className="font-black text-slate-900">{supp.name}</span>
                        </div>
                        {supp.phone && (
                          <span className="text-[10px] text-slate-400 font-medium flex items-center gap-1">
                            <Phone size={10} /> {supp.phone}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-4">
                      <div className="space-y-1 max-w-xs">
                        <span className="font-black text-blue-800 block text-xs">{adj.productName}</span>
                        <div className="flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                          {prod?.category && (
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded text-slate-600 font-bold">
                              {prod.category}
                            </span>
                          )}
                          {prod?.sku && <span className="font-mono">SKU: {prod.sku}</span>}
                        </div>
                        {adj.note && (
                          <span className="text-[10px] text-amber-800 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 italic block">
                            📝 {adj.note}
                          </span>
                        )}
                      </div>
                    </td>

                    <td className="p-4 text-center">
                      <span className="px-3 py-1 bg-blue-50 text-blue-700 rounded-xl font-black text-xs inline-block">
                        +{adj.quantity} {prod?.unit || 'PCS'}
                      </span>
                    </td>

                    <td className="p-4 text-right font-semibold text-slate-600">
                      <div>{formatCurrency(unitCost, currency, rate)}</div>
                      {sellPrice > 0 && (
                        <div className="text-[10px] text-emerald-600 font-bold" title="Qiimaha iibka POS">
                          Iib: {formatCurrency(sellPrice, currency, rate)}
                          {profitMargin !== null && ` (+${profitMargin.toFixed(0)}%)`}
                        </div>
                      )}
                    </td>

                    <td className="p-4 text-right font-black text-slate-900 text-sm">
                      {formatCurrency(totalCost, currency, rate)}
                    </td>

                    <td className="p-4 text-center">
                      <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider ${
                        paymentType === 'CASH' 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : paymentType === 'CREDIT' 
                          ? 'bg-rose-100 text-rose-800' 
                          : 'bg-amber-100 text-amber-800'
                      }`}>
                        {paymentType === 'CASH' ? '💵 CASH' : paymentType === 'CREDIT' ? '📜 DEYN' : '⚖️ PARTIAL'}
                      </span>
                      {adj.accountId && (
                        <span className="text-[9px] text-slate-400 block mt-0.5">
                          {getAccountName(adj.accountId)}
                        </span>
                      )}
                    </td>

                    <td className="p-4 text-right font-black text-emerald-600">
                      {formatCurrency(cashPaid, currency, rate)}
                    </td>

                    <td className="p-4 text-right font-black text-rose-600">
                      {formatCurrency(debtCreated, currency, rate)}
                    </td>

                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setViewVoucherAdj(adj)}
                          className="p-2 text-blue-600 hover:text-white hover:bg-blue-600 rounded-xl transition-all border border-blue-200 shadow-sm"
                          title="Eeg oo Daabac Warqadda Iibka (View Purchase Voucher Slip)"
                        >
                          <Eye size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteConfirmAdj(adj)}
                          className="p-2 text-rose-500 hover:text-white hover:bg-rose-600 rounded-xl transition-all border border-rose-200 shadow-sm"
                          title="Tirtir Diwaangelinta Iibkan (Delete Purchase Entry)"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={10} className="p-12 text-center text-slate-400 font-bold">
                  <div className="flex flex-col items-center justify-center space-y-2 opacity-60">
                    <ShoppingBag size={36} className="text-slate-300" />
                    <p>Ma jiraan iibsi supplier oo la diwaan geliyay waqtigan ama shuruudahan.</p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
          {filteredAdjustments.length > 0 && (
            <tfoot>
              <tr className="bg-slate-100 font-black text-slate-900 text-xs border-t-2 border-slate-300">
                <td colSpan={3} className="p-4 uppercase tracking-wider text-slate-700">Wadarta Guud (Totals)</td>
                <td className="p-4 text-center text-blue-700">+{stats.totalQty}</td>
                <td className="p-4"></td>
                <td className="p-4 text-right text-slate-900 text-sm">{formatCurrency(stats.totalCostSum, currency, rate)}</td>
                <td className="p-4"></td>
                <td className="p-4 text-right text-emerald-700 text-sm">{formatCurrency(stats.cashPaidSum, currency, rate)}</td>
                <td className="p-4 text-right text-rose-600 text-sm">{formatCurrency(stats.debtCreatedSum, currency, rate)}</td>
                <td className="p-4"></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* PURCHASE VOUCHER / SLIP MODAL */}
      {viewVoucherAdj && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-xl rounded-3xl p-6 sm:p-8 border shadow-2xl space-y-6 relative animate-in zoom-in-95 duration-200 font-mono text-slate-900 print:w-[80mm] print:p-2 print:border-none print:shadow-none print:m-0">
            
            {/* Header */}
            <div className="flex items-start justify-between border-b pb-4">
              <div>
                <span className="px-2.5 py-0.5 bg-blue-100 text-blue-800 text-[10px] font-black rounded-md uppercase">
                  DOKUMENTIGA IIBKA ALAABTA (PURCHASE SLIP)
                </span>
                <h3 className="text-xl font-black uppercase text-slate-900 mt-1">
                  {data.settings.businessName || 'Xaysimo Supermarket'}
                </h3>
                <p className="text-xs text-slate-500 font-bold">
                  {data.settings.storeAddress || 'Hargeisa / Somaliland'} | Tel: {data.settings.storePhone || '063-4444444'}
                </p>
              </div>
              <button
                onClick={() => setViewVoucherAdj(null)}
                className="p-2 text-slate-400 hover:text-slate-800 rounded-xl transition-colors no-print"
              >
                <X size={20} />
              </button>
            </div>

            {/* Voucher Metadata */}
            <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-1.5 font-bold">
              <div className="flex justify-between">
                <span className="text-slate-500">Ref ID:</span>
                <span className="font-mono text-slate-900">PUR-{viewVoucherAdj.id.slice(-8).toUpperCase()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Taariikhda Iibka (Date):</span>
                <span>{new Date(viewVoucherAdj.timestamp).toLocaleDateString()} {new Date(viewVoucherAdj.timestamp).toLocaleTimeString()}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Supplier-ka:</span>
                <span className="text-slate-900 font-black">{getSupplier(viewVoucherAdj).name}</span>
              </div>
              {getSupplier(viewVoucherAdj).phone && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Tel Supplier:</span>
                  <span>{getSupplier(viewVoucherAdj).phone}</span>
                </div>
              )}
              {viewVoucherAdj.pageNumber && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Bogga (Page #):</span>
                  <span className="text-purple-700 font-black">{viewVoucherAdj.pageNumber}</span>
                </div>
              )}
            </div>

            {/* Item Details */}
            <div className="border border-slate-200 rounded-2xl p-4 space-y-3">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-wider border-b pb-1">
                Alaabta La Iibsaday (Item Details)
              </div>
              <div className="flex justify-between items-center text-sm font-black">
                <span className="text-slate-900">{viewVoucherAdj.productName}</span>
                <span className="text-blue-700">+{viewVoucherAdj.quantity} xabbo</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs pt-1 border-t border-slate-100 font-bold">
                <div>
                  <span className="text-slate-400 block text-[10px]">Qiimaha Xabbadda:</span>
                  <span className="text-slate-800">{formatCurrency(viewVoucherAdj.unitCost || 0, currency, rate)}</span>
                </div>
                <div className="text-right">
                  <span className="text-slate-400 block text-[10px]">Wadarta Iibka:</span>
                  <span className="text-slate-900 font-black text-sm">{formatCurrency(viewVoucherAdj.totalCost || (viewVoucherAdj.quantity * (viewVoucherAdj.unitCost || 0)), currency, rate)}</span>
                </div>
              </div>
            </div>

            {/* Payment & Financial Breakdown */}
            <div className="bg-slate-900 text-white p-4 rounded-2xl space-y-2 text-xs font-bold">
              <div className="flex justify-between">
                <span className="text-slate-300">Habka Bixinta:</span>
                <span className="font-black text-amber-300 uppercase">{viewVoucherAdj.paymentType || 'CASH'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Cadaan La Bixiyay:</span>
                <span className="font-black text-emerald-400">{formatCurrency(viewVoucherAdj.cashPaid || 0, currency, rate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-300">Deynta Supplier-ka:</span>
                <span className="font-black text-rose-400">{formatCurrency(viewVoucherAdj.debtCreated || 0, currency, rate)}</span>
              </div>
              {viewVoucherAdj.accountId && (
                <div className="flex justify-between pt-1 border-t border-white/10 text-[11px]">
                  <span className="text-slate-400">Akoonka Laga Bixiyay:</span>
                  <span className="text-blue-300">{getAccountName(viewVoucherAdj.accountId)}</span>
                </div>
              )}
            </div>

            {viewVoucherAdj.note && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900">
                <strong>📝 Faahfaahin / Note:</strong> {viewVoucherAdj.note}
              </div>
            )}

            {/* Signatures */}
            <div className="pt-6 grid grid-cols-2 gap-4 text-center text-[10px] font-bold text-slate-500">
              <div className="space-y-6">
                <p className="uppercase">Saxeexa Qofka Keenay (Supplier)</p>
                <div className="border-b border-dashed border-slate-400 w-4/5 mx-auto" />
              </div>
              <div className="space-y-6">
                <p className="uppercase">Saxeexa & Shaabadda Dukaanka</p>
                <div className="border-b border-dashed border-slate-400 w-4/5 mx-auto" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t no-print">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl text-xs font-black flex items-center gap-2 shadow-sm transition-all"
              >
                <Printer size={15} /> Daabac Voucher-ka
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Confirmation Modal for Deleting Purchase Entry */}
      <ConfirmModal
        isOpen={!!deleteConfirmAdj}
        title="Ma hubtaa inaad tirtirto iibkan?"
        message={`Waa la tirtirayaa diwaangelintan (${deleteConfirmAdj?.productName} - ${deleteConfirmAdj?.quantity} xabbo). Tani waxay dub u dhimi doontaa stock-ga alaabta waxayna dib u habayn doontaa lacagaha noo dhaxeeya.`}
        confirmText="Haa, Tirtir (Delete)"
        cancelText="Kansal"
        onConfirm={() => deleteConfirmAdj && handleDeletePurchase(deleteConfirmAdj)}
        onClose={() => setDeleteConfirmAdj(null)}
        type="danger"
      />
    </div>
  );
};

export default DailySupplierPurchasesTable;

