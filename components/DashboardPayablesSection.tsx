import React, { useState, useMemo } from 'react';
import { AppData, Currency, AppTab } from '../types';
import { formatCurrency } from '../lib/utils';
import { 
  Building2, 
  Search, 
  Calendar, 
  DollarSign, 
  ArrowUpRight, 
  Receipt, 
  FileText, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  AlertCircle,
  Phone,
  Package,
  Layers,
  Printer,
  X,
  CreditCard,
  User,
  Filter,
  CalendarDays,
  Sparkles
} from 'lucide-react';

interface Props {
  data: AppData;
  currency: Currency;
  setActiveTab: (tab: AppTab) => void;
  setData?: React.Dispatch<React.SetStateAction<AppData>>;
  addLog?: (action: string, details: string) => void;
}

export interface PayableRecord {
  id: string;
  supplierId: string;
  supplierName: string;
  supplierPhone?: string;
  totalOwedToSupplier: number;
  // Specific item/debt transaction details
  itemsSummary: string; // Waxa laga qaatay (items, cartons, cash, etc.)
  amountOwed: number;   // Cadadka deynta gaarka ah
  dateStr: string;      // Taariikhda la qaatay
  monthStr: string;     // Bisha la qaatay (e.g. "Bisha 8-aad - Aug 2026")
  dayNameSomali: string;// Maalinta (Sabti, Axad...)
  timeStr: string;      // Saacadda
  timestamp: number;
  reason: string;       // Reason-ka & sababta
  pageNumber?: string;  // Bogga diwaanka / Invoice
  notes?: string;
  status: 'PENDING' | 'PARTIAL' | 'CLEARED';
}

const SOMALI_DAYS = ['Axad', 'Isniin', 'Talaado', 'Arbaco', 'Khamiis', 'Jimce', 'Sabti'];
const SOMALI_MONTHS = [
  'Bisha 1-aad (Janaayo)',
  'Bisha 2-aad (Febraayo)',
  'Bisha 3-aad (Maarso)',
  'Bisha 4-aad (Abriil)',
  'Bisha 5-aad (May)',
  'Bisha 6-aad (Juun)',
  'Bisha 7-aad (Luulyo)',
  'Bisha 8-aad (Ogosto)',
  'Bisha 9-aad (Sebteembar)',
  'Bisha 10-aad (Oktoobar)',
  'Bisha 11-aad (Nofeembar)',
  'Bisha 12-aad (Diseembar)'
];

export const DashboardPayablesSection: React.FC<Props> = ({ 
  data, 
  currency, 
  setActiveTab,
  setData,
  addLog 
}) => {
  const rate = data.settings.exchangeRate || 1;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<string>('ALL');
  const [selectedPayable, setSelectedPayable] = useState<PayableRecord | null>(null);
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  
  // Payment Form state
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentAccountId, setPaymentAccountId] = useState<string>(data.accounts?.[0]?.id || '');
  const [paymentNotes, setPaymentNotes] = useState<string>('');

  // 1. Compile all Accounts Payable records (Deymaha Leygu Leeyahay)
  const payableRecords = useMemo(() => {
    const records: PayableRecord[] = [];
    const suppliers = data.suppliers || [];

    // Helper for formatting date
    const parseDateInfo = (ts: number) => {
      const d = new Date(ts);
      const dayIdx = d.getDay();
      const monthIdx = d.getMonth();
      const dayNameSomali = SOMALI_DAYS[dayIdx];
      const monthStr = `${SOMALI_MONTHS[monthIdx]} ${d.getFullYear()}`;
      const dateStr = d.toLocaleDateString('so-SO', { year: 'numeric', month: 'short', day: 'numeric' });
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return { dayNameSomali, monthStr, dateStr, timeStr };
    };

    // Trace from Stock Adjustments (Stock purchases on credit / partial credit)
    (data.stockAdjustments || []).forEach(sa => {
      const isCredit = sa.paymentType === 'CREDIT' || sa.paymentType === 'PARTIAL' || (sa.debtCreated && sa.debtCreated > 0);
      if (isCredit && sa.supplierId) {
        const supp = suppliers.find(s => s.id === sa.supplierId);
        const { dayNameSomali, monthStr, dateStr, timeStr } = parseDateInfo(sa.timestamp || Date.now());
        const debtAmt = sa.debtCreated || (sa.totalCost ? sa.totalCost - (sa.cashPaid || 0) : 0);
        
        records.push({
          id: `SA-${sa.id}`,
          supplierId: sa.supplierId,
          supplierName: sa.supplierName || supp?.name || 'Ganacsade',
          supplierPhone: supp?.phone,
          totalOwedToSupplier: supp?.balance || debtAmt,
          itemsSummary: `${sa.productName} (${sa.quantity} x $${sa.unitCost || 0})`,
          amountOwed: debtAmt,
          dateStr,
          monthStr,
          dayNameSomali,
          timeStr,
          timestamp: sa.timestamp || Date.now(),
          reason: sa.reason || sa.note || `Iibsasho alaab deyn ah: ${sa.productName}`,
          pageNumber: sa.pageNumber,
          notes: sa.note,
          status: 'PENDING'
        });
      }
    });

    // Trace from Transactions (Purchases / Supplier Debt records)
    (data.transactions || []).forEach(tx => {
      if (tx.type === 'PURCHASE' || tx.type === 'SUPPLIER_DEBT' || (tx.supplierId && (tx.paymentDetails?.debt || 0) > 0)) {
        const supp = suppliers.find(s => s.id === tx.supplierId);
        const { dayNameSomali, monthStr, dateStr, timeStr } = parseDateInfo(tx.timestamp || Date.now());
        const debtAmt = tx.paymentDetails?.debt || tx.total || 0;
        
        const itemsNames = (tx.items || []).map(i => `${i.name} (x${i.quantity})`).join(', ') || 'Alaab Ganacsi / Stock';

        records.push({
          id: `TX-${tx.id}`,
          supplierId: tx.supplierId || '',
          supplierName: tx.supplierName || supp?.name || 'Ganacsade',
          supplierPhone: supp?.phone,
          totalOwedToSupplier: supp?.balance || debtAmt,
          itemsSummary: itemsNames,
          amountOwed: debtAmt,
          dateStr,
          monthStr,
          dayNameSomali,
          timeStr,
          timestamp: tx.timestamp || Date.now(),
          reason: tx.notes || `Iibsi alaab dukaanka oo deyn ah`,
          pageNumber: tx.pageNumber,
          notes: tx.notes,
          status: 'PENDING'
        });
      }
    });

    // Trace directly from Suppliers who have a positive balance (balance > 0 means we owe them)
    // If a supplier has a balance but no specific granular log above, ensure they appear clearly!
    suppliers.forEach(supp => {
      if (supp.balance > 0) {
        const hasGranular = records.some(r => r.supplierId === supp.id);
        if (!hasGranular) {
          const { dayNameSomali, monthStr, dateStr, timeStr } = parseDateInfo(Date.now());
          records.push({
            id: `SUPP-${supp.id}`,
            supplierId: supp.id,
            supplierName: supp.name,
            supplierPhone: supp.phone,
            totalOwedToSupplier: supp.balance,
            itemsSummary: 'Alaab Ganacsi / Xisaab Hore oo Deyn ah',
            amountOwed: supp.balance,
            dateStr,
            monthStr,
            dayNameSomali,
            timeStr,
            timestamp: Date.now(),
            reason: supp.contact ? `Deyn lagula heshiiyay (${supp.contact})` : 'Deynta Ganacsadaha ku xusan akoonkiisa',
            notes: `Haraaga guud ee ganacsadaha: $${supp.balance}`,
            status: 'PENDING'
          });
        }
      }
    });

    // Sort by newest first
    return records.sort((a, b) => b.timestamp - a.timestamp);
  }, [data.suppliers, data.stockAdjustments, data.transactions]);

  // Available unique months for filtering
  const availableMonths = useMemo(() => {
    const months = new Set<string>();
    payableRecords.forEach(r => {
      if (r.monthStr) months.add(r.monthStr);
    });
    return Array.from(months);
  }, [payableRecords]);

  // Overall Total Payable Amount
  const totalPayableOverall = useMemo(() => {
    return (data.suppliers || []).reduce((acc, s) => acc + (s.balance > 0 ? s.balance : 0), 0);
  }, [data.suppliers]);

  // Total Suppliers Owed
  const totalCreditorsCount = useMemo(() => {
    return (data.suppliers || []).filter(s => s.balance > 0).length;
  }, [data.suppliers]);

  // Filtered records based on search & month
  const filteredRecords = useMemo(() => {
    return payableRecords.filter(rec => {
      const q = searchQuery.toLowerCase().trim();
      const matchesSearch = !q || 
        rec.supplierName.toLowerCase().includes(q) ||
        (rec.supplierPhone && rec.supplierPhone.includes(q)) ||
        rec.itemsSummary.toLowerCase().includes(q) ||
        rec.reason.toLowerCase().includes(q) ||
        rec.dateStr.toLowerCase().includes(q) ||
        rec.dayNameSomali.toLowerCase().includes(q) ||
        (rec.pageNumber && rec.pageNumber.toLowerCase().includes(q));

      if (!matchesSearch) return false;

      if (selectedMonth !== 'ALL' && rec.monthStr !== selectedMonth) {
        return false;
      }

      return true;
    });
  }, [payableRecords, searchQuery, selectedMonth]);

  // Handle Quick Debt Payment
  const handleProcessPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPayable || !paymentAmount || paymentAmount <= 0) return;
    if (!setData) return;

    const suppId = selectedPayable.supplierId;
    const amountToPay = Number(paymentAmount);
    const selectedAccount = (data.accounts || []).find(a => a.id === paymentAccountId) || data.accounts?.[0];

    setData(prev => {
      // 1. Update Supplier Balance
      const updatedSuppliers = (prev.suppliers || []).map(s => {
        if (s.id === suppId) {
          return {
            ...s,
            balance: Math.max(0, (s.balance || 0) - amountToPay)
          };
        }
        return s;
      });

      // 2. Create Payment Transaction
      const newTx: any = {
        id: `PAY-${Date.now()}`,
        items: [{
          id: `ITEM-SUPP-PAY`,
          productId: 'SUPPLIER_PAY',
          name: `Bixin Deyn: ${selectedPayable.supplierName}`,
          sku: 'SUPPLIER_PAYMENT',
          category: 'Finance',
          price: amountToPay,
          costPrice: amountToPay,
          quantity: 1,
          taxRate: 0,
          unit: 'pcs'
        }],
        subtotal: amountToPay,
        tax: 0,
        total: amountToPay,
        currency: Currency.USD,
        exchangeRate: rate,
        paymentMethod: 'CASH',
        accountId: selectedAccount?.id,
        supplierId: suppId,
        supplierName: selectedPayable.supplierName,
        notes: paymentNotes || `Lacag bixin deyntii lagu lahaa ganacsade ${selectedPayable.supplierName}`,
        timestamp: Date.now(),
        type: 'PURCHASE',
        paymentDetails: {
          cash: amountToPay,
          debt: 0,
          bank: 0,
          mobile: 0
        },
        cashierName: prev.settings?.currentUser?.name || 'Admin'
      };

      // 3. Deduct from Account Balance if tracked
      const updatedAccounts = (prev.accounts || []).map(a => {
        if (a.id === selectedAccount?.id) {
          return {
            ...a,
            balance: (a.balance || 0) - amountToPay
          };
        }
        return a;
      });

      return {
        ...prev,
        suppliers: updatedSuppliers,
        transactions: [newTx, ...(prev.transactions || [])],
        accounts: updatedAccounts,
        lastModified: Date.now()
      };
    });

    if (addLog) {
      addLog('Payable Payment', `Paid $${amountToPay} to supplier ${selectedPayable.supplierName}`);
    }

    setIsPaymentModalOpen(false);
    setIsDetailModalOpen(false);
    setPaymentAmount('');
    setPaymentNotes('');
  };

  const openDetail = (record: PayableRecord) => {
    setSelectedPayable(record);
    setIsDetailModalOpen(true);
  };

  const openPayment = (record: PayableRecord, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedPayable(record);
    setPaymentAmount(record.totalOwedToSupplier || record.amountOwed);
    setIsPaymentModalOpen(true);
  };

  return (
    <div className="bg-white p-4 sm:p-7 rounded-[36px] sm:rounded-[40px] border border-slate-100 shadow-sm space-y-6">
      
      {/* Header & Badges */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-amber-500/10 text-amber-700 font-black text-[10px] rounded-md uppercase tracking-wider flex items-center gap-1">
              <Building2 size={12} className="text-amber-600" />
              Accounts Payable (Deymaha Leygu Leeyahay)
            </span>
            <span className="text-xs text-slate-400 font-bold hidden sm:inline">• Dadka & Shirkadaha lacagta igu leh</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <DollarSign size={24} className="text-amber-600" />
            <span>Deymaha Leygu Leeyahay & Faahfaahinta Waxa La Qaatay</span>
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Xogta buuxda ee qofka wax kugu leh, waxaad kaga qaadatay, taariikhda & bisha aad qaadatay, iyo sababta (Reason-ka).
          </p>
        </div>

        {/* Quick Summary KPIs */}
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          <div className="bg-amber-50/80 p-3 sm:p-4 rounded-3xl border border-amber-100 min-w-[170px]">
            <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">
              Wadarta Deynta Laguugu Leeyahay
            </p>
            <p className="text-lg sm:text-2xl font-black text-amber-950 mt-0.5">
              {formatCurrency(totalPayableOverall, currency, rate)}
            </p>
            <p className="text-[9px] text-amber-700 font-bold mt-0.5">
              {currency === Currency.USD 
                ? `ETB ${(totalPayableOverall * rate).toLocaleString()}` 
                : `$${totalPayableOverall.toLocaleString()}`}
            </p>
          </div>

          <div className="bg-slate-50 p-3 sm:p-4 rounded-3xl border border-slate-100 min-w-[130px]">
            <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Dadka Wax Kugu Leh
            </p>
            <p className="text-lg sm:text-2xl font-black text-slate-900 mt-0.5">
              {totalCreditorsCount} <span className="text-xs font-semibold text-slate-500">Ganacsato</span>
            </p>
            <button 
              onClick={() => setActiveTab(AppTab.SUPPLIERS)}
              className="text-[10px] font-bold text-amber-600 hover:text-amber-700 flex items-center gap-0.5 mt-0.5 cursor-pointer"
            >
              <span>Eeg Ganacsatada</span>
              <ArrowUpRight size={12} />
            </button>
          </div>
        </div>
      </div>

      {/* Controls & Search */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 pt-2">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
          <input
            type="text"
            placeholder="Raadi magaca ganacsadaha, waxaad qaadatay, taariikhda, ama sababta..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 hover:bg-slate-100/80 focus:bg-white border border-slate-200 rounded-2xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition-all"
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xs font-bold"
            >
              ✕
            </button>
          )}
        </div>

        {/* Month Selector Filter */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 px-3 py-2 bg-slate-50 border border-slate-200 rounded-2xl">
            <CalendarDays size={14} className="text-amber-600" />
            <span className="text-[11px] font-black text-slate-600 uppercase">Bisha:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-black text-slate-900 focus:outline-none cursor-pointer pr-2"
            >
              <option value="ALL">Dhammaan Bilaha (All Months)</option>
              {availableMonths.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>

          <button
            onClick={() => setActiveTab(AppTab.PURCHASES)}
            className="px-3.5 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
          >
            <Package size={14} />
            <span className="hidden sm:inline">Iibsashada Stock-ga</span>
          </button>
        </div>
      </div>

      {/* Payables List Table */}
      <div className="border border-slate-100 rounded-3xl overflow-hidden shadow-xs">
        <div className="overflow-x-auto max-h-[420px] touch-scroll">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50/90 text-slate-600 uppercase text-[10px] font-black tracking-wider border-b border-slate-100 sticky top-0 z-10 backdrop-blur-xs">
                <th className="py-3 px-4">Ganacsadaha / Qofka Wax Igu Leh</th>
                <th className="py-3 px-4">Waxa Laga Qaatay (Items / Stock)</th>
                <th className="py-3 px-4">Taariikhda & Bisha La Qaatay</th>
                <th className="py-3 px-4">Sababta (Reason)</th>
                <th className="py-3 px-4 text-right">Cadadka Deynta (Amount)</th>
                <th className="py-3 px-4 text-right">Falka (Action)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {filteredRecords.length > 0 ? (
                filteredRecords.map((rec) => (
                  <tr 
                    key={rec.id}
                    onDoubleClick={() => openDetail(rec)}
                    className="hover:bg-amber-50/40 transition-colors group cursor-pointer"
                  >
                    {/* Creditor info */}
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-black shrink-0 text-xs shadow-xs">
                          {rec.supplierName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-black text-slate-900 text-xs group-hover:text-amber-700 transition-colors flex items-center gap-1.5">
                            <span>{rec.supplierName}</span>
                          </p>
                          {rec.supplierPhone && (
                            <p className="text-[10px] text-slate-400 font-bold flex items-center gap-1 mt-0.5">
                              <Phone size={10} />
                              <span>{rec.supplierPhone}</span>
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* What was taken */}
                    <td className="py-3.5 px-4 max-w-[220px]">
                      <div className="flex items-center gap-1.5">
                        <Package size={13} className="text-amber-500 shrink-0" />
                        <span className="font-bold text-slate-800 truncate" title={rec.itemsSummary}>
                          {rec.itemsSummary}
                        </span>
                      </div>
                      {rec.pageNumber && (
                        <span className="text-[9px] font-black text-amber-700 bg-amber-100/80 px-1.5 py-0.5 rounded mt-0.5 inline-block">
                          Bogga: {rec.pageNumber}
                        </span>
                      )}
                    </td>

                    {/* Date & Month */}
                    <td className="py-3.5 px-4 whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="font-black text-slate-900 flex items-center gap-1 text-[11px]">
                          <Calendar size={12} className="text-slate-400" />
                          <span>{rec.dayNameSomali}, {rec.dateStr}</span>
                        </span>
                        <span className="text-[10px] font-semibold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded w-fit mt-0.5">
                          {rec.monthStr} • {rec.timeStr}
                        </span>
                      </div>
                    </td>

                    {/* Reason */}
                    <td className="py-3.5 px-4 max-w-[200px]">
                      <p className="text-slate-600 text-[11px] font-medium truncate" title={rec.reason}>
                        {rec.reason || 'Deyn alaab lagu soo qaatay'}
                      </p>
                    </td>

                    {/* Amount Owed */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <span className="font-black text-amber-700 text-sm">
                        {formatCurrency(rec.amountOwed, currency, rate)}
                      </span>
                      {currency === Currency.USD && (
                        <p className="text-[9px] text-slate-400 font-bold">
                          ETB {(rec.amountOwed * rate).toLocaleString()}
                        </p>
                      )}
                    </td>

                    {/* Actions */}
                    <td className="py-3.5 px-4 text-right whitespace-nowrap">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={(e) => openPayment(rec, e)}
                          className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-[10px] rounded-xl shadow-xs transition-all flex items-center gap-1 active:scale-95 cursor-pointer"
                          title="Bixi deyntan ganacsadaha"
                        >
                          <CreditCard size={11} />
                          <span>Bixi Deyn</span>
                        </button>
                        <button
                          onClick={() => openDetail(rec)}
                          className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-xl transition-all"
                          title="Eeg faahfaahinta buuxda"
                        >
                          <ChevronRight size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Building2 className="mx-auto mb-2 opacity-30 text-amber-500" size={36} />
                    <p className="font-bold text-sm text-slate-600">Wax deyn ah oo laguugu leeyahay lama helin</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {searchQuery ? 'Isku day erayo kale oo raadin ah' : 'Masha Allah! Ma jiraan deymo ganacsato oo furan.'}
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Voucher / Detail Modal */}
      {isDetailModalOpen && selectedPayable && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 space-y-5 animate-in zoom-in-95 duration-150">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-amber-100 text-amber-700 rounded-2xl">
                  <Building2 size={20} />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-base">Bayaanka Deynta Ganacsadaha</h4>
                  <p className="text-[11px] text-slate-500 font-bold">Accounts Payable Voucher & Audit Details</p>
                </div>
              </div>
              <button
                onClick={() => setIsDetailModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            {/* Voucher Body */}
            <div className="bg-amber-50/50 p-4 rounded-2xl border border-amber-100 space-y-3">
              <div className="flex justify-between items-center pb-2 border-b border-amber-100/80">
                <span className="text-xs font-black text-slate-500 uppercase">Qofka / Shirkadda:</span>
                <span className="text-sm font-black text-slate-900">{selectedPayable.supplierName}</span>
              </div>

              {selectedPayable.supplierPhone && (
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold">Telefoonka:</span>
                  <span className="font-black text-slate-800">{selectedPayable.supplierPhone}</span>
                </div>
              )}

              <div className="flex justify-between items-start text-xs pt-1">
                <span className="text-slate-500 font-bold shrink-0">Waxa Laga Qaatay:</span>
                <span className="font-black text-slate-900 text-right max-w-[260px]">
                  {selectedPayable.itemsSummary}
                </span>
              </div>

              <div className="flex justify-between items-center text-xs pt-1">
                <span className="text-slate-500 font-bold">Taariikhda & Maalinta:</span>
                <span className="font-black text-slate-800">
                  {selectedPayable.dayNameSomali}, {selectedPayable.dateStr} ({selectedPayable.timeStr})
                </span>
              </div>

              <div className="flex justify-between items-center text-xs">
                <span className="text-slate-500 font-bold">Bisha:</span>
                <span className="font-black text-amber-800 bg-amber-100/80 px-2 py-0.5 rounded-md">
                  {selectedPayable.monthStr}
                </span>
              </div>

              <div className="flex justify-between items-start text-xs pt-1">
                <span className="text-slate-500 font-bold shrink-0">Sababta / Qoraalka:</span>
                <span className="font-semibold text-slate-800 text-right max-w-[260px]">
                  {selectedPayable.reason || 'Deyn ganacsi'}
                </span>
              </div>

              {selectedPayable.pageNumber && (
                <div className="flex justify-between items-center text-xs pt-1">
                  <span className="text-slate-500 font-bold">Bogga Diwaanka:</span>
                  <span className="font-black text-amber-700 bg-amber-100 px-2 py-0.5 rounded">
                    Bogga {selectedPayable.pageNumber}
                  </span>
                </div>
              )}

              {/* Amount Highlight */}
              <div className="bg-white p-3.5 rounded-xl border border-amber-200/80 flex items-center justify-between mt-2 shadow-xs">
                <div>
                  <p className="text-[10px] font-black text-amber-600 uppercase">Cadadka Deyntan</p>
                  <p className="text-xs text-slate-400 font-semibold">Wadarta lacagta lagu leeyahay</p>
                </div>
                <div className="text-right">
                  <p className="text-xl font-black text-amber-800">
                    {formatCurrency(selectedPayable.amountOwed, currency, rate)}
                  </p>
                  <p className="text-[10px] text-slate-500 font-bold">
                    ETB {(selectedPayable.amountOwed * rate).toLocaleString()}
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-1">
              <button
                onClick={() => {
                  window.print();
                }}
                className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 cursor-pointer"
              >
                <Printer size={14} />
                <span>Daabac (Print)</span>
              </button>

              <button
                onClick={() => {
                  setIsDetailModalOpen(false);
                  openPayment(selectedPayable);
                }}
                className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black transition-all flex items-center gap-1.5 shadow-sm active:scale-95 cursor-pointer"
              >
                <CreditCard size={14} />
                <span>Bixi Deyntan Hadda</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Pay Debt Modal */}
      {isPaymentModalOpen && selectedPayable && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-150">
          <form 
            onSubmit={handleProcessPayment}
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4 animate-in zoom-in-95 duration-150"
          >
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2.5">
                <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-2xl">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h4 className="font-black text-slate-900 text-base">Bixi Deynta Ganacsadaha</h4>
                  <p className="text-[11px] text-slate-500 font-bold">{selectedPayable.supplierName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="p-1.5 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
              >
                <X size={18} />
              </button>
            </div>

            <div className="bg-emerald-50/50 p-3 rounded-2xl border border-emerald-100 flex items-center justify-between text-xs">
              <span className="font-bold text-slate-600">Deynta Hadda Lagu Leeyahay:</span>
              <span className="font-black text-emerald-800 text-sm">
                ${selectedPayable.totalOwedToSupplier || selectedPayable.amountOwed} USD
              </span>
            </div>

            {/* Amount input */}
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                Cadadka Aad Bixinayso ($ USD)
              </label>
              <div className="relative">
                <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-black">$</span>
                <input
                  type="number"
                  step="0.01"
                  required
                  min="0.01"
                  max={selectedPayable.totalOwedToSupplier || selectedPayable.amountOwed}
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0.00"
                  className="w-full pl-8 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-black text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                />
              </div>
              {paymentAmount !== '' && (
                <p className="text-[10px] text-slate-400 font-bold mt-1">
                  U dhiganta ETB: {(Number(paymentAmount) * rate).toLocaleString()}
                </p>
              )}
            </div>

            {/* Account Selector */}
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                Sanduuqa / Akoonka Laga Bixinayo
              </label>
              <select
                value={paymentAccountId}
                onChange={(e) => setPaymentAccountId(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              >
                {(data.accounts || []).map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} (${acc.balance?.toLocaleString() || 0})
                  </option>
                ))}
              </select>
            </div>

            {/* Notes */}
            <div>
              <label className="block text-xs font-black text-slate-700 uppercase mb-1">
                Qoraal / Faahfaahin (Notes)
              </label>
              <input
                type="text"
                placeholder="Tusaale: Bixinta deyntii caanaha ee bishii hore"
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
              />
            </div>

            {/* Submit */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIsPaymentModalOpen(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs rounded-xl"
              >
                Jooji (Cancel)
              </button>
              <button
                type="submit"
                className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md transition-all active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 size={14} />
                <span>Xaqiiji Bixinta</span>
              </button>
            </div>
          </form>
        </div>
      )}

    </div>
  );
};

export default DashboardPayablesSection;
