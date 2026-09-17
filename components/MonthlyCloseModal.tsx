import React, { useState, useMemo } from 'react';
import { AppData, Currency, MonthlyArchive, AccountType } from '../types';
import { formatCurrency, generateId } from '../lib/utils';
import { 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  X, 
  Sparkles, 
  RefreshCw, 
  TrendingUp, 
  ShoppingBag, 
  Users, 
  ArrowRight, 
  Wallet, 
  Archive,
  Layers,
  FileText,
  Lock
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  addLog: (action: string, details: string) => void;
  currency: Currency;
  onArchiveCreated?: (archive: MonthlyArchive) => void;
}

export const MonthlyCloseModal: React.FC<Props> = ({
  isOpen,
  onClose,
  data,
  setData,
  addLog,
  currency,
  onArchiveCreated
}) => {
  const [monthName, setMonthName] = useState(() => {
    const d = new Date();
    const monthNames = [
      'Janaayo', 'Febraayo', 'Maarso', 'Abriil', 'May', 'Juun',
      'Luuliyo', 'Ogosto', 'Sebtembar', 'Oktoobar', 'Nofembar', 'Diseembar'
    ];
    return `Xisaabtii Bisha ${d.getMonth() + 1}aad (${monthNames[d.getMonth()]} ${d.getFullYear()})`;
  });

  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(1);
    return d.toISOString().split('T')[0];
  });

  const [endDate, setEndDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [resetDebts, setResetDebts] = useState<boolean>(false);
  const [resetAccounts, setResetAccounts] = useState<boolean>(true);
  const [notes, setNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Calculate live financial summary for the period to be closed
  const summary = useMemo(() => {
    const salesTx = (data.transactions || []).filter(t => 
      t.type === 'SALE' || 
      (!t.type && !t.supplierId && !t.notes?.toLowerCase().includes('supplier') && t.items?.[0]?.sku !== 'SUPPLIER_PAYMENT')
    );

    const totalSales = salesTx.reduce((sum, t) => sum + (t.total || 0), 0);
    const totalProfit = salesTx.reduce((acc, t) => {
      const cost = (t.items || []).reduce((s, item) => s + ((item.costPrice || 0) * (item.quantity || 1)), 0);
      return acc + (t.total - cost);
    }, 0);

    const regularExpenses = (data.expenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);
    const khudaarExp = (data.khudaarExpenses || []).reduce((sum, e) => sum + (e.amount || 0), 0);
    // Khudaar is separated from general store accounts & net profit
    const totalExpenses = regularExpenses;
    const netProfit = totalProfit - totalExpenses;

    const totalCustomerDebt = (data.customers || []).reduce((sum, c) => sum + (c.debtBalance || 0), 0);
    const totalSupplierDebt = (data.suppliers || []).reduce((sum, s) => sum + (s.balance || 0), 0);

    const totalKhudaarSales = (data.khudaarSales || []).reduce((sum, s) => sum + (s.amount || 0), 0);

    const accountsSummary = (data.accounts || []).map(acc => ({
      id: acc.id,
      name: acc.name,
      type: acc.type,
      balance: acc.balance || 0
    }));

    return {
      totalSales,
      totalProfit,
      totalExpenses,
      netProfit,
      totalCustomerDebt,
      totalSupplierDebt,
      totalTransactionsCount: (data.transactions || []).length,
      totalKhudaarSales,
      totalKhudaarExpenses: khudaarExp,
      totalIceCreamSales: 0,
      accountsSummary
    };
  }, [data]);

  if (!isOpen) return null;

  const handleExecuteMonthlyClose = () => {
    if (!monthName.trim()) {
      alert('Fadlan geli magaca bisha (tusaale: Bishii 8aad 2026)!');
      return;
    }

    setIsProcessing(true);

    try {
      const now = Date.now();
      const archiveId = `archive-${now}-${generateId().slice(0, 5)}`;

      // 1. Create a 100% full snapshot of the closing month
      const newArchive: MonthlyArchive = {
        id: archiveId,
        monthName: monthName.trim(),
        periodStartDate: startDate,
        periodEndDate: endDate,
        closedAt: now,
        closedBy: data.settings.currentUser.name || 'Admin',
        notes: notes.trim(),
        summary,
        snapshotData: {
          transactions: [...(data.transactions || [])],
          expenses: [...(data.expenses || [])],
          stockAdjustments: [...(data.stockAdjustments || [])],
          khudaarSales: [...(data.khudaarSales || [])],
          khudaarExpenses: [...(data.khudaarExpenses || [])],
          accountTransfers: [...(data.accountTransfers || [])],
          customers: (data.customers || []).map(c => ({ ...c })),
          suppliers: (data.suppliers || []).map(s => ({ ...s })),
          accounts: (data.accounts || []).map(a => ({ ...a }))
        }
      };

      // 2. Prepare new month active dataset ($0 fresh period)
      const updatedAccounts = resetAccounts 
        ? (data.accounts || []).map(acc => ({ ...acc, balance: 0 }))
        : (data.accounts || []).map(acc => ({ ...acc }));

      const updatedCustomers = resetDebts
        ? (data.customers || []).map(cust => ({ ...cust, debtBalance: 0, loyaltyPoints: 0 }))
        : (data.customers || []).map(cust => ({ ...cust }));

      const updatedSuppliers = resetDebts
        ? (data.suppliers || []).map(supp => ({ ...supp, balance: 0 }))
        : (data.suppliers || []).map(supp => ({ ...supp }));

      const updatedProducts = (data.products || []).map(p => ({
        ...p,
        trackingStartedAt: now // Reset tracking baseline for new month
      }));

      const newMonthlyArchives = [newArchive, ...(data.monthlyArchives || [])];

      const nextPeriodName = `Bisha Cusub (${new Date().toLocaleDateString('so-SO', { month: 'long', year: 'numeric' })})`;

      setData(prev => ({
        ...prev,
        products: updatedProducts,
        accounts: updatedAccounts,
        customers: updatedCustomers,
        suppliers: updatedSuppliers,
        transactions: [], // Reset active movements to $0
        expenses: [], // Reset active expenses to $0
        stockAdjustments: [], // Reset adjustments
        khudaarSales: [], // Reset active khudaar
        khudaarExpenses: [],
        accountTransfers: [],
        onlineOrders: [],
        monthlyArchives: newMonthlyArchives,
        currentPeriodName: nextPeriodName,
        currentPeriodStartedAt: now,
        lastModified: now
      }));

      addLog(
        'Monthly Close & Archive',
        `Xidhay bisha: "${monthName}". Waxaa loo kaydiyay si joogto ah waxaana la bilaabay bisha cusub ee $0.`
      );

      if (onArchiveCreated) {
        onArchiveCreated(newArchive);
      }

      setIsProcessing(false);
      onClose();

      alert(
        `✅ HAMBALYO! BISHA WAA LA XIDHAY OO WAA LA KAYDIYAY!\n\n` +
        `📁 Xogtii bishii hore waxay ku kaydsan tahay "Kaydka Bilaha Hore".\n` +
        `⚡ Bisha cusub waxay ku bilaabatay $0 (Dashboard, Accounting & Dhaqdhaqaaq cusub).`
      );
    } catch (e: any) {
      setIsProcessing(false);
      alert('Cillad: ' + e.message);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[120] flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-[36px] shadow-2xl max-w-2xl w-full overflow-hidden border border-slate-100 my-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-700 via-indigo-700 to-slate-900 text-white p-6 md:p-8 flex items-center justify-between relative overflow-hidden">
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <span className="px-2.5 py-0.5 bg-blue-500/30 text-blue-200 rounded-lg text-[10px] font-black uppercase tracking-wider border border-blue-400/30 flex items-center gap-1">
                <Lock size={11} /> Xidhitaanka & Kaydinta Bisha
              </span>
            </div>
            <h2 className="text-xl md:text-2xl font-black tracking-tight">
              Xidh Bisha & Bilow Xisaab Cusub ($0)
            </h2>
            <p className="text-xs text-blue-200 mt-1">
              Xogta bishan waxaa loo wareejinayaa Kaydka Joogtada ah, dashboardka & lacagahana $0 ayaa laga dhigayaa.
            </p>
          </div>
          <button 
            onClick={onClose}
            className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all relative z-10"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 md:p-8 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Summary of What is Being Closed */}
          <div>
            <div className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-2 flex items-center gap-1.5">
              <Archive size={14} className="text-blue-600" />
              Bayaanka & Xisaabta Bishan Lagu Xidhayo
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="p-3 bg-blue-50/80 rounded-2xl border border-blue-100">
                <p className="text-[10px] font-black text-blue-600 uppercase">Iibka Guud</p>
                <p className="text-sm md:text-base font-black text-blue-950 mt-0.5">
                  {formatCurrency(summary.totalSales, currency)}
                </p>
                <p className="text-[9px] text-blue-700 font-bold">{summary.totalTransactionsCount} Biil/Invoices</p>
              </div>

              <div className="p-3 bg-emerald-50/80 rounded-2xl border border-emerald-100">
                <p className="text-[10px] font-black text-emerald-600 uppercase">Faa'iidada Saafiga</p>
                <p className="text-sm md:text-base font-black text-emerald-950 mt-0.5">
                  {formatCurrency(summary.netProfit, currency)}
                </p>
                <p className="text-[9px] text-emerald-700 font-bold">Kharashka ka dib</p>
              </div>

              <div className="p-3 bg-rose-50/80 rounded-2xl border border-rose-100">
                <p className="text-[10px] font-black text-rose-600 uppercase">Kharashka Guud</p>
                <p className="text-sm md:text-base font-black text-rose-950 mt-0.5">
                  {formatCurrency(summary.totalExpenses, currency)}
                </p>
                <p className="text-[9px] text-rose-700 font-bold">Dukaan + Khudaar</p>
              </div>

              <div className="p-3 bg-amber-50/80 rounded-2xl border border-amber-100">
                <p className="text-[10px] font-black text-amber-600 uppercase">Deymaha Macaamiisha</p>
                <p className="text-sm md:text-base font-black text-amber-950 mt-0.5">
                  {formatCurrency(summary.totalCustomerDebt, currency)}
                </p>
                <p className="text-[9px] text-amber-700 font-bold">Lagu Leeyahay</p>
              </div>
            </div>
          </div>

          {/* Form Inputs */}
          <div className="space-y-4 bg-slate-50 p-4 md:p-5 rounded-3xl border border-slate-200/80">
            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                Magaca Bisha la Kaydinayo (Archive Label)
              </label>
              <input
                type="text"
                value={monthName}
                onChange={e => setMonthName(e.target.value)}
                placeholder="Tusaale: Xisaabtii Bisha 8aad (August 2026)"
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                  Taariikhda Bilowga
                </label>
                <input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                  Taariikhda Xidhitaanka
                </label>
                <input
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-black text-slate-500 uppercase tracking-wider mb-1">
                Faahfaahin / Xusuusin (Notes)
              </label>
              <input
                type="text"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="Xusuusin ku saabsan xidhitaanka bishan..."
                className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
              />
            </div>
          </div>

          {/* Reset Options */}
          <div className="space-y-3">
            <p className="text-[11px] font-black text-slate-500 uppercase tracking-widest">
              Xulashada Bilowga Bisha Cusub ($0 Options)
            </p>

            <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-white border border-slate-200 cursor-pointer hover:border-blue-400 transition-all">
              <input
                type="checkbox"
                checked={resetAccounts}
                onChange={e => setResetAccounts(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <div>
                <p className="text-xs font-black text-slate-800">
                  Nadiifi Akoonnada & Sanduuqa Cash-ka ($0 ka dhig)
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Akoonnada (Cash, Bank, Mobile) waxay ku bilaabanayaan $0 bisha cusub si xisaabtoodu u noqoto mid cusub.
                </p>
              </div>
            </label>

            <label className="flex items-start gap-3 p-3.5 rounded-2xl bg-white border border-slate-200 cursor-pointer hover:border-blue-400 transition-all">
              <input
                type="checkbox"
                checked={resetDebts}
                onChange={e => setResetDebts(e.target.checked)}
                className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
              />
              <div>
                <p className="text-xs font-black text-slate-800">
                  Eber $0 ka dhig Deymaha Macaamiisha & Suppliers-ka
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  Haddii aad rabto in deymaha la nadiifiyo bisha cusub. (Haddii aadan saxin, deymaha hadda jira waa loo wareejin doonaa bisha cusub si loo qaado).
                </p>
              </div>
            </label>
          </div>

          {/* Security Notice */}
          <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200 flex items-start gap-3">
            <div className="p-2 bg-emerald-600 text-white rounded-xl flex-shrink-0">
              <CheckCircle2 size={18} />
            </div>
            <div className="text-xs text-emerald-900 leading-relaxed font-medium">
              <span className="font-black text-emerald-950">Amni 100% ah & 1-Click View:</span> Xogta bishii hore marnaba ma lumayso. Waxaa lagu kaydiyaa qalabkaaga iyo Firebase Cloud, waxaana lagu eegi karaa 1 Click wakhti kasta.
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="p-6 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-3.5 rounded-2xl text-xs font-black text-slate-600 hover:bg-slate-200 transition-all"
          >
            Ka Noqo (Cancel)
          </button>

          <button
            type="button"
            disabled={isProcessing}
            onClick={handleExecuteMonthlyClose}
            className="w-full sm:w-auto px-8 py-3.5 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-xl shadow-blue-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            {isProcessing ? (
              <>
                <RefreshCw size={16} className="animate-spin" />
                Waa la xidhayaa...
              </>
            ) : (
              <>
                <Lock size={16} />
                Xidh Bisha & Bilow Xisaab Cusub ($0)
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
export default MonthlyCloseModal;
