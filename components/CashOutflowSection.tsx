import React, { useState, useMemo } from 'react';
import { AppData, Currency, PaymentMethod } from '../types';
import { formatCurrency } from '../lib/utils';
import { CashDisbursementItem, CashDisbursementModal } from './CashDisbursementModal';
import {
  HandCoins,
  Search,
  Filter,
  User,
  Calendar,
  Clock,
  ArrowUpRight,
  Eye,
  Building,
  DollarSign,
  Receipt,
  FileText,
  MousePointerClick,
  Sparkles,
  ArrowDownRight
} from 'lucide-react';

const SOMALI_DAYS = [
  'Axad',    // 0: Sunday
  'Isniin',  // 1: Monday
  'Talaado', // 2: Tuesday
  'Arbaco',  // 3: Wednesday
  'Khamiis', // 4: Thursday
  'Jimce',   // 5: Friday
  'Sabti'    // 6: Saturday
];

interface Props {
  data: AppData;
  currency: Currency;
}

export const CashOutflowSection: React.FC<Props> = ({ data, currency }) => {
  const rate = data.settings?.exchangeRate || 1;
  const bizName = data.settings?.businessName || 'Supermarket';

  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState<'ALL' | 'LOAN' | 'SUPPLIER' | 'EXPENSE' | 'KHUDAAR' | 'RETURN'>('ALL');
  const [selectedItem, setSelectedItem] = useState<CashDisbursementItem | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  // Compile all cash disbursements
  const cashOutflowItems = useMemo<CashDisbursementItem[]>(() => {
    const items: CashDisbursementItem[] = [];

    // Helper to extract Somali day name and readable date/time
    const getFormattedDateTime = (timestamp: number) => {
      const d = new Date(timestamp);
      const dayIdx = d.getDay();
      const dayNameSomali = SOMALI_DAYS[dayIdx] || '';
      const dateStr = d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
      const timeStr = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      return { dayNameSomali, dateStr, timeStr };
    };

    // 1. Transactions: CASH_LOAN or Customer cash out
    (data.transactions || []).forEach(tx => {
      const { dayNameSomali, dateStr, timeStr } = getFormattedDateTime(tx.timestamp || Date.now());

      // Case A: Cash Loan / Advance to Customer or Person
      if (tx.type === 'CASH_LOAN' || (tx.notes && tx.notes.toLowerCase().includes('cash loan'))) {
        const cust = (data.customers || []).find(c => c.id === tx.customerId);
        items.push({
          id: tx.id,
          recipientName: tx.customerName || cust?.name || 'Qof Qaatay Cash (Deyn)',
          recipientPhone: cust?.phone,
          recipientType: 'CUSTOMER',
          categoryLabel: 'Deyn Caddaan ah (Cash Loan)',
          amount: tx.total || 0,
          timestamp: tx.timestamp,
          dateStr,
          timeStr,
          dayNameSomali,
          reason: tx.notes || 'Qof lacag caddaan ah deyn ahaan u qaatay',
          accountName: 'Sanduuqa Dukaanka (Cash in Hand)',
          authorizedBy: tx.cashierName || 'Admin / Cashier',
          rawType: 'CASH_LOAN',
          notes: tx.notes,
          invoiceOrPage: tx.pageNumber ? `Page: ${tx.pageNumber}` : `#INV-${tx.id.slice(-5).toUpperCase()}`,
          exchangeRate: tx.exchangeRate || rate
        });
      }

      // Case B: Cash Paid to Supplier (Purchase or Supplier Debt Repayment in Cash)
      else if (
        (tx.supplierId || tx.type === 'PURCHASE' || tx.type === 'SUPPLIER_DEBT' || (tx.notes && tx.notes.toLowerCase().includes('supplier'))) &&
        (tx.paymentMethod === PaymentMethod.CASH || (tx.paymentDetails && (tx.paymentDetails.cash || 0) > 0) || (!tx.paymentMethod && tx.total > 0))
      ) {
        const supp = (data.suppliers || []).find(s => s.id === tx.supplierId);
        const cashAmount = tx.paymentDetails?.cash || tx.total || 0;
        if (cashAmount > 0) {
          items.push({
            id: tx.id,
            recipientName: tx.supplierName || supp?.name || 'Ganacsade / Shirkad',
            recipientPhone: supp?.phone,
            recipientType: 'SUPPLIER',
            categoryLabel: 'Bixin Ganacsade (Supplier Cash)',
            amount: cashAmount,
            timestamp: tx.timestamp,
            dateStr,
            timeStr,
            dayNameSomali,
            reason: tx.notes || `Lacag bixin alaab ama deyn ganacsade: ${tx.supplierName || supp?.name || ''}`,
            accountName: 'Cash in Hand (Lacag Caddaan)',
            authorizedBy: tx.cashierName || 'Admin / Cashier',
            rawType: 'SUPPLIER_PAYMENT',
            notes: tx.notes,
            invoiceOrPage: tx.pageNumber ? `Page: ${tx.pageNumber}` : `#SUP-${tx.id.slice(-5).toUpperCase()}`,
            exchangeRate: tx.exchangeRate || rate
          });
        }
      }

      // Case C: Customer Return / Cash Refund
      else if (tx.type === 'RETURN') {
        const cust = (data.customers || []).find(c => c.id === tx.customerId);
        items.push({
          id: tx.id,
          recipientName: tx.customerName || cust?.name || 'Macmiil Alaab Celiyay',
          recipientPhone: cust?.phone,
          recipientType: 'CUSTOMER',
          categoryLabel: 'Lacag Celis (Cash Refund)',
          amount: tx.total || 0,
          timestamp: tx.timestamp,
          dateStr,
          timeStr,
          dayNameSomali,
          reason: tx.returnReason || tx.notes || 'Lacag celis alaab dukaanka dib loogu soo celiyay',
          accountName: 'Sanduuqa Dukaanka',
          authorizedBy: tx.cashierName || 'Admin / Cashier',
          rawType: 'RETURN',
          notes: tx.notes,
          invoiceOrPage: tx.originalInvoiceId ? `Asalka: #${tx.originalInvoiceId.slice(-5)}` : `#RET-${tx.id.slice(-5).toUpperCase()}`,
          exchangeRate: tx.exchangeRate || rate
        });
      }
    });

    // 2. Store Expenses (Kharashaadka Dukaanka)
    (data.expenses || []).forEach(exp => {
      const { dayNameSomali, dateStr, timeStr } = getFormattedDateTime(exp.timestamp || Date.now());
      const account = (data.accounts || []).find(a => a.id === exp.accountId);
      items.push({
        id: exp.id,
        recipientName: exp.description || exp.category || 'Kharash Dukaanka',
        recipientType: 'EXPENSE',
        categoryLabel: `Kharash: ${exp.category || 'Guud'}`,
        amount: exp.amount || 0,
        timestamp: exp.timestamp,
        dateStr,
        timeStr,
        dayNameSomali,
        reason: exp.description || `Kharashka ${exp.category}`,
        accountName: account ? account.name : 'Cash in Hand (Sanduuqa)',
        authorizedBy: 'Admin / Manager',
        rawType: 'EXPENSE',
        receiptImage: exp.receipt,
        invoiceOrPage: `#EXP-${exp.id.slice(-5).toUpperCase()}`,
        exchangeRate: rate
      });
    });

    // 3. Stock Adjustments with Cash Paid
    (data.stockAdjustments || []).forEach(sa => {
      if (sa.paymentType === 'CASH' && sa.cashPaid && sa.cashPaid > 0) {
        const { dayNameSomali, dateStr, timeStr } = getFormattedDateTime(sa.timestamp || Date.now());
        const supp = (data.suppliers || []).find(s => s.id === sa.supplierId);
        items.push({
          id: sa.id,
          recipientName: sa.supplierName || supp?.name || 'Ganacsade (Stock In)',
          recipientPhone: supp?.phone,
          recipientType: 'SUPPLIER',
          categoryLabel: 'Iibsasho Stock (Cash Paid)',
          amount: sa.cashPaid,
          timestamp: sa.timestamp,
          dateStr,
          timeStr,
          dayNameSomali,
          reason: sa.reason || sa.note || `Iibsasho alaab cusub: ${sa.productName}`,
          accountName: 'Cash in Hand',
          authorizedBy: 'Admin / Inventory',
          rawType: 'STOCK_PURCHASE',
          notes: sa.note,
          itemsSummary: `${sa.productName} (${sa.quantity} x $${sa.unitCost || 0})`,
          invoiceOrPage: sa.pageNumber ? `Page: ${sa.pageNumber}` : `#STK-${sa.id.slice(-5).toUpperCase()}`,
          exchangeRate: rate
        });
      }
    });

    // Sort by latest disbursement first
    return items.sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));
  }, [data.transactions, data.expenses, data.stockAdjustments, data.customers, data.suppliers, data.accounts, rate]);

  // Filter items by search & category
  const filteredItems = useMemo(() => {
    return cashOutflowItems.filter(item => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch = !q ||
        item.recipientName.toLowerCase().includes(q) ||
        (item.recipientPhone && item.recipientPhone.includes(q)) ||
        item.reason.toLowerCase().includes(q) ||
        item.categoryLabel.toLowerCase().includes(q) ||
        item.dateStr.toLowerCase().includes(q) ||
        item.dayNameSomali.toLowerCase().includes(q) ||
        item.amount.toString().includes(q);

      if (!matchSearch) return false;

      if (filterCategory === 'LOAN') return item.rawType === 'CASH_LOAN';
      if (filterCategory === 'SUPPLIER') return item.recipientType === 'SUPPLIER';
      if (filterCategory === 'EXPENSE') return item.rawType === 'EXPENSE';
      if (filterCategory === 'RETURN') return item.rawType === 'RETURN';

      return true;
    });
  }, [cashOutflowItems, searchQuery, filterCategory]);

  // Calculate totals
  const totals = useMemo(() => {
    let totalAll = 0;
    let totalLoans = 0;
    let totalSuppliers = 0;
    let totalExpenses = 0;

    cashOutflowItems.forEach(item => {
      totalAll += item.amount;
      if (item.rawType === 'CASH_LOAN') totalLoans += item.amount;
      else if (item.recipientType === 'SUPPLIER') totalSuppliers += item.amount;
      else totalExpenses += item.amount;
    });

    return { totalAll, totalLoans, totalSuppliers, totalExpenses };
  }, [cashOutflowItems]);

  const handleRowAction = (item: CashDisbursementItem) => {
    setSelectedItem(item);
    setIsModalOpen(true);
  };

  return (
    <div className="bg-white p-4 sm:p-7 rounded-[36px] sm:rounded-[40px] border border-slate-100 shadow-sm space-y-6">
      
      {/* Header & Badges */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-rose-500/10 text-rose-700 font-black text-[10px] rounded-md uppercase tracking-wider flex items-center gap-1">
              <HandCoins size={12} className="text-rose-600" />
              Diwaanka Cash-ka Baxay (Disbursements)
            </span>
            <span className="text-xs text-slate-400 font-bold hidden sm:inline">• Double-Click for Full Receipt</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <DollarSign size={24} className="text-rose-600" />
            <span>Dadka Iga Qaatay Lacagta Cash-ka ah (Cadaanka)</span>
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5 flex items-center gap-1">
            <MousePointerClick size={14} className="text-rose-600 shrink-0 inline" />
            <span>Guji <strong>2 jeer (Double-Click)</strong> ama riix <strong>"Faahfaahin"</strong> si aad u aragto cadadka, sababta, iyo goorta la qaatay.</span>
          </p>
        </div>

        {/* Quick summary card */}
        <div className="bg-rose-50/70 p-3 sm:p-4 rounded-3xl border border-rose-100 flex items-center gap-4 shrink-0">
          <div>
            <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">
              Wadarta Cash-ka Baxay
            </p>
            <p className="text-lg sm:text-2xl font-black text-rose-950 mt-0.5">
              {formatCurrency(totals.totalAll, currency, rate)}
            </p>
          </div>
          <div className="text-right border-l border-rose-200/80 pl-4 text-xs font-bold text-slate-600">
            <p>{cashOutflowItems.length} Qof / Bixin</p>
            <p className="text-[10px] text-rose-600 font-black">Diiwaanka Guud</p>
          </div>
        </div>
      </div>

      {/* Metric Breakdown Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* Total to Customers / Cash Loans */}
        <div 
          onClick={() => setFilterCategory('LOAN')}
          className={`p-3.5 sm:p-4 rounded-3xl border transition-all cursor-pointer ${
            filterCategory === 'LOAN' ? 'bg-rose-600 text-white border-rose-700 shadow-md' : 'bg-slate-50 hover:bg-rose-50/60 border-slate-100'
          }`}
        >
          <p className={`text-[10px] font-black uppercase tracking-widest ${filterCategory === 'LOAN' ? 'text-rose-100' : 'text-slate-400'}`}>
            Deymaha Caddaanka ah (Loans)
          </p>
          <p className={`text-base sm:text-xl font-black mt-1 ${filterCategory === 'LOAN' ? 'text-white' : 'text-slate-900'}`}>
            {formatCurrency(totals.totalLoans, currency, rate)}
          </p>
        </div>

        {/* Total to Suppliers */}
        <div 
          onClick={() => setFilterCategory('SUPPLIER')}
          className={`p-3.5 sm:p-4 rounded-3xl border transition-all cursor-pointer ${
            filterCategory === 'SUPPLIER' ? 'bg-amber-600 text-white border-amber-700 shadow-md' : 'bg-slate-50 hover:bg-amber-50/60 border-slate-100'
          }`}
        >
          <p className={`text-[10px] font-black uppercase tracking-widest ${filterCategory === 'SUPPLIER' ? 'text-amber-100' : 'text-slate-400'}`}>
            Bixin Ganacsato (Suppliers)
          </p>
          <p className={`text-base sm:text-xl font-black mt-1 ${filterCategory === 'SUPPLIER' ? 'text-white' : 'text-slate-900'}`}>
            {formatCurrency(totals.totalSuppliers, currency, rate)}
          </p>
        </div>

        {/* Total Expenses */}
        <div 
          onClick={() => setFilterCategory('EXPENSE')}
          className={`p-3.5 sm:p-4 rounded-3xl border transition-all cursor-pointer ${
            filterCategory === 'EXPENSE' ? 'bg-indigo-600 text-white border-indigo-700 shadow-md' : 'bg-slate-50 hover:bg-indigo-50/60 border-slate-100'
          }`}
        >
          <p className={`text-[10px] font-black uppercase tracking-widest ${filterCategory === 'EXPENSE' ? 'text-indigo-100' : 'text-slate-400'}`}>
            Kharashaad Dukaanka
          </p>
          <p className={`text-base sm:text-xl font-black mt-1 ${filterCategory === 'EXPENSE' ? 'text-white' : 'text-slate-900'}`}>
            {formatCurrency(totals.totalExpenses, currency, rate)}
          </p>
        </div>

        {/* Show All */}
        <div 
          onClick={() => setFilterCategory('ALL')}
          className={`p-3.5 sm:p-4 rounded-3xl border transition-all cursor-pointer ${
            filterCategory === 'ALL' ? 'bg-slate-900 text-white border-slate-900 shadow-md' : 'bg-slate-50 hover:bg-slate-100 border-slate-100'
          }`}
        >
          <p className={`text-[10px] font-black uppercase tracking-widest ${filterCategory === 'ALL' ? 'text-slate-300' : 'text-slate-400'}`}>
            Dhammaan Cash-ka Baxay
          </p>
          <p className={`text-base sm:text-xl font-black mt-1 ${filterCategory === 'ALL' ? 'text-white' : 'text-slate-900'}`}>
            {cashOutflowItems.length} Bixin Guud
          </p>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Raadi qofka, sababta, taariikhda, ama cadadka..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition-all"
          />
        </div>

        {/* Filter categories pills */}
        <div className="flex flex-wrap items-center gap-1.5 w-full sm:w-auto">
          <button
            onClick={() => setFilterCategory('ALL')}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer ${
              filterCategory === 'ALL' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Dhammaan ({cashOutflowItems.length})
          </button>
          <button
            onClick={() => setFilterCategory('LOAN')}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer ${
              filterCategory === 'LOAN' ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Deymo Caddaan
          </button>
          <button
            onClick={() => setFilterCategory('SUPPLIER')}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer ${
              filterCategory === 'SUPPLIER' ? 'bg-amber-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Ganacsato
          </button>
          <button
            onClick={() => setFilterCategory('EXPENSE')}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer ${
              filterCategory === 'EXPENSE' ? 'bg-indigo-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Kharashaad
          </button>
          <button
            onClick={() => setFilterCategory('KHUDAAR')}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer ${
              filterCategory === 'KHUDAAR' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Khudaar
          </button>
          <button
            onClick={() => setFilterCategory('RETURN')}
            className={`px-3 py-1.5 rounded-xl text-[10px] font-black uppercase transition-all cursor-pointer ${
              filterCategory === 'RETURN' ? 'bg-purple-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Celis
          </button>
        </div>
      </div>

      {/* Table of Cash Disbursements */}
      <div className="overflow-x-auto rounded-3xl border border-slate-100 bg-slate-50/50">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="bg-slate-100/90 text-[10px] font-black uppercase text-slate-500 tracking-wider border-b border-slate-200">
              <th className="p-3.5">Qofka / Goobta Qaadatay</th>
              <th className="p-3.5">Nooca (Category)</th>
              <th className="p-3.5 text-right">Cadadka (Amount)</th>
              <th className="p-3.5">Goorta & Taariikhda</th>
              <th className="p-3.5">Sababta (Reason)</th>
              <th className="p-3.5 text-center">Faahfaahin</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {filteredItems.map((item) => (
              <tr
                key={item.id}
                onDoubleClick={() => handleRowAction(item)}
                className="hover:bg-rose-50/30 transition-colors cursor-pointer group"
                title="Guji 2 jeer (Double Click) si aad u aragto risiidka buuxa"
              >
                {/* Recipient */}
                <td className="p-3.5">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-black text-xs shrink-0 ${
                      item.rawType === 'CASH_LOAN' ? 'bg-rose-100 text-rose-700' :
                      item.recipientType === 'SUPPLIER' ? 'bg-amber-100 text-amber-700' :
                      item.recipientType === 'KHUDAAR' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-indigo-100 text-indigo-700'
                    }`}>
                      {item.recipientType === 'SUPPLIER' ? <Building size={14} /> : <User size={14} />}
                    </div>
                    <div>
                      <p className="font-black text-slate-900 group-hover:text-rose-600 transition-colors">
                        {item.recipientName}
                      </p>
                      {item.recipientPhone && (
                        <p className="text-[10px] font-bold text-slate-400">📱 {item.recipientPhone}</p>
                      )}
                    </div>
                  </div>
                </td>

                {/* Category */}
                <td className="p-3.5">
                  <span className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider inline-block ${
                    item.rawType === 'CASH_LOAN' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                    item.recipientType === 'SUPPLIER' ? 'bg-amber-50 text-amber-800 border border-amber-200' :
                    item.recipientType === 'KHUDAAR' ? 'bg-emerald-50 text-emerald-800 border border-emerald-200' :
                    item.rawType === 'RETURN' ? 'bg-purple-50 text-purple-800 border border-purple-200' :
                    'bg-slate-100 text-slate-700 border border-slate-200'
                  }`}>
                    {item.categoryLabel}
                  </span>
                </td>

                {/* Amount */}
                <td className="p-3.5 text-right">
                  <p className="font-black text-sm text-rose-600">
                    ${item.amount.toFixed(2)} USD
                  </p>
                  <p className="text-[10px] font-bold text-slate-500">
                    ≈ {(item.amount * (item.exchangeRate || rate)).toLocaleString(undefined, { maximumFractionDigits: 1 })} ETB
                  </p>
                </td>

                {/* Date & Time */}
                <td className="p-3.5">
                  <div className="flex items-center gap-1.5 text-slate-800 font-black">
                    <Calendar size={13} className="text-rose-500 shrink-0" />
                    <span>{item.dayNameSomali}, {item.dateStr}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-slate-400 font-bold text-[10px] mt-0.5">
                    <Clock size={12} className="text-slate-400 shrink-0" />
                    <span>{item.timeStr}</span>
                  </div>
                </td>

                {/* Reason */}
                <td className="p-3.5 max-w-[200px]">
                  <p className="text-xs font-medium text-slate-700 truncate" title={item.reason}>
                    {item.reason}
                  </p>
                  {item.invoiceOrPage && (
                    <p className="text-[9px] font-black text-slate-400 mt-0.5 uppercase">
                      {item.invoiceOrPage}
                    </p>
                  )}
                </td>

                {/* Action Button */}
                <td className="p-3.5 text-center">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRowAction(item);
                    }}
                    className="px-3 py-1.5 bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all shadow-xs cursor-pointer inline-flex items-center gap-1"
                  >
                    <Eye size={12} />
                    <span>Faahfaahin</span>
                  </button>
                </td>
              </tr>
            ))}

            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={6} className="py-12 text-center text-slate-400">
                  <HandCoins size={36} className="mx-auto text-slate-300 mb-2 opacity-50" />
                  <p className="text-xs font-black uppercase tracking-wider text-slate-500">
                    Wax lacag cash ah oo la qaatay lama helin
                  </p>
                  <p className="text-[10px] text-slate-400 mt-1">
                    {searchQuery ? 'Isku day inaad beddesho erayga baadhitaanka' : 'Wali wax cash ah lama bixin'}
                  </p>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Modal View for double click */}
      <CashDisbursementModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        item={selectedItem}
        currency={currency}
        exchangeRate={rate}
        businessName={bizName}
      />
    </div>
  );
};

export default CashOutflowSection;
