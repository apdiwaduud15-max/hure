
import React, { useMemo, useState } from 'react';
import { AppData, Currency, AccountType, Account, PaymentMethod, Transaction } from '../types';
import { formatCurrency, generateId } from '../lib/utils';
import { 
  TrendingUp, Building2, Wallet, Package, Users, History, FileText, Plus, Landmark, PieChart, X, Edit2, Trash2, 
  Smartphone, Landmark as BankIcon, CircleDollarSign, ChevronRight, Printer, Scale, CheckCircle2, AlertTriangle, 
  Briefcase, ArrowRightLeft, Eye, ShoppingBag, CreditCard, ArrowUpRight, ArrowDownLeft, RefreshCw, Search, DollarSign, Layers,
  Calendar, Check, Sparkles, Filter, Percent, ArrowDownRight, UserCheck, ShieldAlert
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';
import AccountTransferModal from './AccountTransferModal';
import AccountStatementModal from './AccountStatementModal';

interface Props {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  addLog: (action: string, details: string) => void;
  currency: Currency;
}

type AccountingCategoryTab = 'ALL_ACCOUNTS' | 'REGULAR_SALES' | 'CUSTOMER_DEBTS' | 'TRANSFERS_PURCHASES' | 'STATEMENTS';

export type AccTimeframeOption = 'ALL' | 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH' | 'LAST_MONTH' | 'YEAR' | 'CUSTOM_DATE' | 'CUSTOM_RANGE';

const isTimestampInTimeframe = (
  timestamp: number,
  timeframe: AccTimeframeOption,
  singleDate?: string,
  startDate?: string,
  endDate?: string
): boolean => {
  if (timeframe === 'ALL') return true;
  if (timeframe === 'TODAY') {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    return timestamp >= start.getTime() && timestamp <= end.getTime();
  }
  if (timeframe === 'YESTERDAY') {
    const start = new Date();
    start.setDate(start.getDate() - 1);
    start.setHours(0, 0, 0, 0);
    const end = new Date();
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);
    return timestamp >= start.getTime() && timestamp <= end.getTime();
  }
  if (timeframe === 'WEEK') {
    const start = new Date();
    start.setDate(start.getDate() - 7);
    start.setHours(0, 0, 0, 0);
    return timestamp >= start.getTime();
  }
  if (timeframe === 'MONTH') {
    const start = new Date(new Date().getFullYear(), new Date().getMonth(), 1, 0, 0, 0, 0).getTime();
    return timestamp >= start;
  }
  if (timeframe === 'LAST_MONTH') {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0).getTime();
    const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime();
    return timestamp >= start && timestamp <= end;
  }
  if (timeframe === 'YEAR') {
    const start = new Date(new Date().getFullYear(), 0, 1, 0, 0, 0, 0).getTime();
    return timestamp >= start;
  }
  if (timeframe === 'CUSTOM_DATE') {
    if (!singleDate) return true;
    const start = new Date(`${singleDate}T00:00:00`).getTime();
    const end = new Date(`${singleDate}T23:59:59.999`).getTime();
    if (isNaN(start) || isNaN(end)) return true;
    return timestamp >= start && timestamp <= end;
  }
  if (timeframe === 'CUSTOM_RANGE') {
    let valid = true;
    if (startDate) {
      const start = new Date(`${startDate}T00:00:00`).getTime();
      if (!isNaN(start)) valid = valid && timestamp >= start;
    }
    if (endDate) {
      const end = new Date(`${endDate}T23:59:59.999`).getTime();
      if (!isNaN(end)) valid = valid && timestamp <= end;
    }
    return valid;
  }
  return true;
};

const DateFilterBar: React.FC<{
  timeframe: AccTimeframeOption;
  setTimeframe: (tf: AccTimeframeOption) => void;
  singleDate: string;
  setSingleDate: (d: string) => void;
  startDate: string;
  setStartDate: (d: string) => void;
  endDate: string;
  setEndDate: (d: string) => void;
  themeColor?: 'blue' | 'rose' | 'purple' | 'emerald';
}> = ({
  timeframe,
  setTimeframe,
  singleDate,
  setSingleDate,
  startDate,
  setStartDate,
  endDate,
  setEndDate,
  themeColor = 'blue'
}) => {
  const activeBg = 
    themeColor === 'rose' ? 'bg-rose-600 text-white shadow-sm' :
    themeColor === 'purple' ? 'bg-purple-600 text-white shadow-sm' :
    themeColor === 'emerald' ? 'bg-emerald-600 text-white shadow-sm' :
    'bg-blue-600 text-white shadow-sm';

  return (
    <div className="space-y-2 w-full">
      {/* Preset Buttons */}
      <div className="flex flex-wrap items-center gap-1.5 bg-slate-100/90 p-1.5 rounded-2xl border border-slate-200/60">
        <button
          type="button"
          onClick={() => setTimeframe('ALL')}
          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${timeframe === 'ALL' ? activeBg : 'text-slate-600 hover:bg-slate-200'}`}
        >
          Dhammaan (All)
        </button>
        <button
          type="button"
          onClick={() => setTimeframe('TODAY')}
          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${timeframe === 'TODAY' ? activeBg : 'text-slate-600 hover:bg-slate-200'}`}
        >
          Maanta
        </button>
        <button
          type="button"
          onClick={() => setTimeframe('YESTERDAY')}
          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${timeframe === 'YESTERDAY' ? activeBg : 'text-slate-600 hover:bg-slate-200'}`}
        >
          Shalay
        </button>
        <button
          type="button"
          onClick={() => setTimeframe('WEEK')}
          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${timeframe === 'WEEK' ? activeBg : 'text-slate-600 hover:bg-slate-200'}`}
        >
          7 Maalmood
        </button>
        <button
          type="button"
          onClick={() => setTimeframe('MONTH')}
          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${timeframe === 'MONTH' ? activeBg : 'text-slate-600 hover:bg-slate-200'}`}
        >
          Bishan
        </button>
        <button
          type="button"
          onClick={() => setTimeframe('LAST_MONTH')}
          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${timeframe === 'LAST_MONTH' ? activeBg : 'text-slate-600 hover:bg-slate-200'}`}
        >
          Bishii Hore
        </button>
        <button
          type="button"
          onClick={() => setTimeframe('YEAR')}
          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${timeframe === 'YEAR' ? activeBg : 'text-slate-600 hover:bg-slate-200'}`}
        >
          Sanadkan
        </button>
        <button
          type="button"
          onClick={() => setTimeframe('CUSTOM_DATE')}
          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${timeframe === 'CUSTOM_DATE' ? activeBg : 'text-slate-700 bg-white border border-slate-300 hover:bg-slate-50'}`}
        >
          <Calendar size={13} />
          Taariikh Gaar ah (Custom Date)
        </button>
        <button
          type="button"
          onClick={() => setTimeframe('CUSTOM_RANGE')}
          className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${timeframe === 'CUSTOM_RANGE' ? activeBg : 'text-slate-700 bg-white border border-slate-300 hover:bg-slate-50'}`}
        >
          <Calendar size={13} />
          Kala Doorasho (Range)
        </button>
      </div>

      {/* Custom Inputs */}
      {timeframe === 'CUSTOM_DATE' && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-amber-50/70 border border-amber-200 rounded-2xl animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-amber-900 flex items-center gap-1">
              <Calendar size={14} className="text-amber-600" /> Dooro Maalinta:
            </span>
            <input
              type="date"
              value={singleDate}
              onChange={e => setSingleDate(e.target.value)}
              className="bg-white border border-amber-300 text-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500 shadow-sm"
            />
          </div>
          <span className="text-[11px] text-amber-800 font-medium">
            Waxaa lagu tusayaa kaliya xogta maalinta la doortay ({singleDate}).
          </span>
        </div>
      )}

      {timeframe === 'CUSTOM_RANGE' && (
        <div className="flex flex-wrap items-center gap-3 p-3 bg-indigo-50/70 border border-indigo-200 rounded-2xl animate-in fade-in duration-150">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-indigo-900">Laga bilaabo (From):</span>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="bg-white border border-indigo-300 text-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-indigo-900">Ilaa (To):</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="bg-white border border-indigo-300 text-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:ring-2 focus:ring-indigo-500 shadow-sm"
            />
          </div>
          <span className="text-[11px] text-indigo-800 font-medium">
            Muddada: {startDate} ilaa {endDate}
          </span>
        </div>
      )}
    </div>
  );
};

const Accounting: React.FC<Props> = ({ data, setData, addLog, currency }) => {
  const rate = data.settings.exchangeRate;
  const [activeCategoryTab, setActiveCategoryTab] = useState<AccountingCategoryTab>('ALL_ACCOUNTS');
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [editingAccount, setEditingAccount] = useState<Account | null>(null);
  const [deleteConfirmAcc, setDeleteConfirmAcc] = useState<Account | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Master Account Flow Date Filter States (Tab 1)
  const [accFlowTimeframe, setAccFlowTimeframe] = useState<AccTimeframeOption>('ALL');
  const [accFlowSingleDate, setAccFlowSingleDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [accFlowStartDate, setAccFlowStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [accFlowEndDate, setAccFlowEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);

  // Regular Sales (Stock & Ice Cream) Filter States (Tab 2)
  const [regularFilterType, setRegularFilterType] = useState<'ALL' | 'ICE_CREAM' | 'STOCK'>('ALL');
  const [regularTimeframe, setRegularTimeframe] = useState<AccTimeframeOption>('ALL');
  const [regularSingleDate, setRegularSingleDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [regularStartDate, setRegularStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [regularEndDate, setRegularEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [regularSearch, setRegularSearch] = useState('');

  // Customer Debts Filter States (Tab 3)
  const [debtSubTab, setDebtSubTab] = useState<'ALL' | 'DEBT_SALES' | 'CASH_LOANS' | 'COLLECTIONS' | 'DEBTORS_LIST'>('ALL');
  const [debtTimeframe, setDebtTimeframe] = useState<AccTimeframeOption>('ALL');
  const [debtSingleDate, setDebtSingleDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [debtStartDate, setDebtStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [debtEndDate, setDebtEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [debtSearch, setDebtSearch] = useState('');

  // Transfers & Purchases Filter States (Tab 4)
  const [tpSubTab, setTpSubTab] = useState<'ALL' | 'TRANSFERS' | 'STOCK_PURCHASES'>('ALL');
  const [tpTimeframe, setTpTimeframe] = useState<AccTimeframeOption>('ALL');
  const [tpSingleDate, setTpSingleDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [tpStartDate, setTpStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [tpEndDate, setTpEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [tpSearch, setTpSearch] = useState('');

  // Account Transfer & Statement States
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferDefaultFromId, setTransferDefaultFromId] = useState<string>('');
  const [selectedStatementAcc, setSelectedStatementAcc] = useState<Account | null>(null);

  // Supplier Debt Payment Modal State (Payables Settlement)
  const [showSupplierPayModal, setShowSupplierPayModal] = useState(false);
  const [paySupplierId, setPaySupplierId] = useState<string>('');
  const [payAmountVal, setPayAmountVal] = useState<number>(0);
  const [payAccId, setPayAccId] = useState<string>('');
  const [payNoteText, setPayNoteText] = useState<string>('');

  const handleAccountingSupplierPay = () => {
    const supp = data.suppliers.find(s => s.id === paySupplierId);
    if (!supp || payAmountVal <= 0) return alert("Fadlan dooro supplier oo geli xaddi lacag bixin sax ah!");
    if (!payAccId) return alert("Fadlan dooro akoonka ama sandaaqada lacagta ka baxayso!");

    const acc = data.accounts.find(a => a.id === payAccId);
    if (!acc) return alert("Akoonka la doortay lama helin.");
    if (acc.balance < payAmountVal) return alert(`Lacag kugu filan kama jirto akoonka ${acc.name}! Hada waxaa ku jira: ${formatCurrency(acc.balance, currency, rate)}`);

    const txId = generateId();
    const suppPayTx: Transaction = {
      id: txId,
      items: [{
        id: `supp-pay-${txId}`,
        name: `Bixinta Deynta Supplier-ka (${supp.name})`,
        sku: 'SUPPLIER_PAYMENT',
        barcode: '',
        costPrice: payAmountVal,
        sellPrice: payAmountVal,
        stock: 1,
        category: 'Supplier Payment',
        quantity: 1
      }],
      subtotal: payAmountVal,
      tax: 0,
      total: payAmountVal,
      currency: currency,
      exchangeRate: rate,
      paymentMethod: PaymentMethod.CASH,
      accountId: payAccId,
      supplierId: supp.id,
      supplierName: supp.name,
      timestamp: Date.now(),
      type: 'EXPENSE',
      notes: `Supplier Debt Settlement from Accounting: Paid ${formatCurrency(payAmountVal, currency, rate)} to ${supp.name} from account ${acc.name}. ${payNoteText || ''}`
    };

    setData(prev => ({
      ...prev,
      transactions: [suppPayTx, ...prev.transactions],
      suppliers: prev.suppliers.map(s => s.id === supp.id ? { ...s, balance: Math.max(0, s.balance - payAmountVal) } : s),
      accounts: prev.accounts.map(a => a.id === acc.id ? { ...a, balance: a.balance - payAmountVal } : a)
    }));

    addLog('Supplier Debt Payment', `Paid ${formatCurrency(payAmountVal, currency, rate)} to ${supp.name} from ${acc.name}`);
    alert(`🎉 WAA LA KAYDIYAY! Waxaad ${formatCurrency(payAmountVal, currency, rate)} ka bixisay deynta ${supp.name}. Lacagta waxay ka go'day akoonka ${acc.name}!`);

    setShowSupplierPayModal(false);
    setPaySupplierId('');
    setPayAmountVal(0);
    setPayAccId('');
    setPayNoteText('');
  };

  const [formData, setFormData] = useState({
    name: '',
    type: AccountType.ASSET,
    balance: 0
  });

  // Calculate Comprehensive Account Movements (Inflow, Outflow, Net Balance)
  const accountFlowMap = useMemo(() => {
    const map: Record<string, { 
      account: Account; 
      inflow: number; 
      outflow: number; 
      netBalance: number; 
      txCount: number;
    }> = {};

    data.accounts.forEach(acc => {
      map[acc.id] = {
        account: acc,
        inflow: 0,
        outflow: 0,
        netBalance: acc.balance,
        txCount: 0
      };
    });

    // 1. Transactions (Sales, Debt Payments, Returns, Cash Loans, Expenses)
    data.transactions.forEach(tx => {
      if (!isTimestampInTimeframe(tx.timestamp, accFlowTimeframe, accFlowSingleDate, accFlowStartDate, accFlowEndDate)) return;

      const pm = (tx.paymentMethod || '').toLowerCase();
      const isPureDebt = pm === 'debt' || pm.includes('pure_debt');
      const isDebt = isPureDebt || pm.includes('deyn') || pm.includes('credit') || tx.type === 'CASH_LOAN';

      // Find matching accounts for partial / split payments & liquidity
      const cashAcc = data.accounts.find(a => a.id === 'acc-cash' || a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('cadaan'));
      const bankAcc = data.accounts.find(a => a.id === 'acc-bank' || a.name.toLowerCase().includes('bank'));
      const mobileAcc = data.accounts.find(a => a.id === 'acc-mobile' || a.name.toLowerCase().includes('mobile') || a.name.toLowerCase().includes('zaad') || a.name.toLowerCase().includes('evc') || a.name.toLowerCase().includes('sahal') || a.name.toLowerCase().includes('golis'));
      const debtAcc = data.accounts.find(a => a.id === 'acc-ar' || a.name.toLowerCase().includes('receivable') || a.name.toLowerCase().includes('dayn') || a.name.toLowerCase().includes('deyn') || a.name.toLowerCase().includes('debt'));
      const salesAcc = data.accounts.find(a => a.type === AccountType.REVENUE || a.id === 'acc-sales' || a.name.toLowerCase().includes('sale') || a.name.toLowerCase().includes('revenue'));

      // A) CASH LOAN: Cash leaves liquidity account, increases Accounts Receivable
      if (tx.type === 'CASH_LOAN') {
        const srcAcc = (tx.accountId && map[tx.accountId]) ? map[tx.accountId] : (cashAcc && map[cashAcc.id] ? map[cashAcc.id] : null);
        if (srcAcc) {
          srcAcc.outflow += tx.total;
          srcAcc.txCount += 1;
        }
        if (debtAcc && map[debtAcc.id]) {
          map[debtAcc.id].inflow += tx.total;
          map[debtAcc.id].txCount += 1;
        }
        return;
      }

      // B) DEBT PAYMENT: Real cash enters liquidity account, decreases Accounts Receivable
      if (tx.type === 'DEBT_PAYMENT') {
        const destAcc = (tx.accountId && map[tx.accountId]) ? map[tx.accountId] : (cashAcc && map[cashAcc.id] ? map[cashAcc.id] : null);
        if (destAcc) {
          destAcc.inflow += tx.total;
          destAcc.txCount += 1;
        }
        if (debtAcc && map[debtAcc.id]) {
          map[debtAcc.id].outflow += tx.total;
          map[debtAcc.id].txCount += 1;
        }
        return;
      }

      // C) EXPENSE / SUPPLIER DEBT PAYMENT: Cash leaves liquidity account
      if (tx.type === 'EXPENSE') {
        const expAcc = (tx.accountId && map[tx.accountId]) ? map[tx.accountId] : (cashAcc && map[cashAcc.id] ? map[cashAcc.id] : null);
        if (expAcc) {
          expAcc.outflow += tx.total;
          expAcc.txCount += 1;
        }
        return;
      }

      // D) RETURN: Cash leaves liquidity account, decreases Sales Revenue
      if (tx.type === 'RETURN') {
        let retAcc = (tx.accountId && map[tx.accountId]) ? map[tx.accountId] : null;
        if (!retAcc) {
          if (pm.includes('cash') || pm.includes('cadaan')) retAcc = cashAcc && map[cashAcc.id] ? map[cashAcc.id] : null;
          else if (pm.includes('bank')) retAcc = bankAcc && map[bankAcc.id] ? map[bankAcc.id] : null;
          else if (pm.includes('mobile') || pm.includes('zaad') || pm.includes('evc')) retAcc = mobileAcc && map[mobileAcc.id] ? map[mobileAcc.id] : null;
        }
        if (retAcc) {
          retAcc.outflow += tx.total;
          retAcc.txCount += 1;
        }
        if (salesAcc && map[salesAcc.id]) {
          map[salesAcc.id].outflow += tx.total;
          map[salesAcc.id].txCount += 1;
        }
        return;
      }

      // E) SALES REVENUE (All sales increase Sales Revenue)
      if (salesAcc && map[salesAcc.id]) {
        map[salesAcc.id].inflow += tx.total;
        map[salesAcc.id].txCount += 1;
      }

      // F) PURE DEBT SALES: Increases Accounts Receivable only (NO cash inflow!)
      if (isPureDebt || tx.paymentMethod === PaymentMethod.DEBT) {
        if (debtAcc && map[debtAcc.id]) {
          map[debtAcc.id].inflow += tx.total;
          map[debtAcc.id].txCount += 1;
        }
        return;
      }

      // G) PARTIAL / SPLIT SALES: Cash/Bank/Mobile gets only its received portion, Accounts Receivable gets debt portion
      if (tx.paymentMethod === PaymentMethod.PARTIAL && tx.paymentDetails) {
        if (tx.paymentDetails.cash && tx.paymentDetails.cash > 0 && cashAcc && map[cashAcc.id]) {
          map[cashAcc.id].inflow += tx.paymentDetails.cash;
          map[cashAcc.id].txCount += 1;
        }
        if (tx.paymentDetails.bank && tx.paymentDetails.bank > 0 && bankAcc && map[bankAcc.id]) {
          map[bankAcc.id].inflow += tx.paymentDetails.bank;
          map[bankAcc.id].txCount += 1;
        }
        if (tx.paymentDetails.mobile && tx.paymentDetails.mobile > 0 && mobileAcc && map[mobileAcc.id]) {
          map[mobileAcc.id].inflow += tx.paymentDetails.mobile;
          map[mobileAcc.id].txCount += 1;
        }
        if (tx.paymentDetails.debt && tx.paymentDetails.debt > 0 && debtAcc && map[debtAcc.id]) {
          map[debtAcc.id].inflow += tx.paymentDetails.debt;
          map[debtAcc.id].txCount += 1;
        }
        return;
      }

      // H) FULL CASH / BANK / MOBILE SALES: Cash/Bank/Mobile gets the total
      let targetAcc = (tx.accountId && map[tx.accountId]) ? map[tx.accountId] : null;
      if (!targetAcc) {
        if (pm.includes('cash') || pm.includes('cadaan') || tx.paymentMethod === PaymentMethod.CASH) {
          targetAcc = cashAcc && map[cashAcc.id] ? map[cashAcc.id] : null;
        } else if (pm.includes('bank') || tx.paymentMethod === PaymentMethod.BANK) {
          targetAcc = bankAcc && map[bankAcc.id] ? map[bankAcc.id] : null;
        } else if (pm.includes('mobile') || pm.includes('zaad') || pm.includes('evc') || tx.paymentMethod === PaymentMethod.MOBILE_MONEY) {
          targetAcc = mobileAcc && map[mobileAcc.id] ? map[mobileAcc.id] : null;
        }
      }

      if (targetAcc) {
        targetAcc.inflow += tx.total;
        targetAcc.txCount += 1;
      }
    });

    // 2. Expenses
    data.expenses.forEach(exp => {
      if (!isTimestampInTimeframe(exp.timestamp, accFlowTimeframe, accFlowSingleDate, accFlowStartDate, accFlowEndDate)) return;
      if (exp.accountId && map[exp.accountId]) {
        map[exp.accountId].outflow += exp.amount;
        map[exp.accountId].txCount += 1;
      }
    });

    // 3. Inter-Account Transfers
    if (data.accountTransfers) {
      data.accountTransfers.forEach(at => {
        if (!isTimestampInTimeframe(at.timestamp, accFlowTimeframe, accFlowSingleDate, accFlowStartDate, accFlowEndDate)) return;
        if (map[at.fromAccountId]) {
          map[at.fromAccountId].outflow += at.amount;
          map[at.fromAccountId].txCount += 1;
        }
        if (map[at.toAccountId]) {
          map[at.toAccountId].inflow += at.amount;
          map[at.toAccountId].txCount += 1;
        }
      });
    }

    // 4. Stock Adjustments / Cash Purchases
    data.stockAdjustments.forEach(sa => {
      if (!isTimestampInTimeframe(sa.timestamp, accFlowTimeframe, accFlowSingleDate, accFlowStartDate, accFlowEndDate)) return;
      if (sa.cashPaid && sa.cashPaid > 0) {
        let targetFlow = sa.accountId && map[sa.accountId] ? map[sa.accountId] : null;
        if (!targetFlow) {
          const cashAcc = data.accounts.find(a => a.id === 'acc-cash' || a.name.toLowerCase().includes('cash'));
          if (cashAcc && map[cashAcc.id]) targetFlow = map[cashAcc.id];
        }
        if (targetFlow) {
          targetFlow.outflow += sa.cashPaid;
          targetFlow.txCount += 1;
        }
      }
    });

    return map;
  }, [data, accFlowTimeframe, accFlowSingleDate, accFlowStartDate, accFlowEndDate]);

  // Overall Financial Performance Stats
  const financialStats = useMemo(() => {
    // 1. INCOME STATEMENT CALCULATIONS
    const salesTxs = data.transactions.filter(t => t.type !== 'CASH_LOAN' && t.type !== 'DEBT_PAYMENT');
    const manualRevenue = data.accounts.filter(a => a.type === AccountType.REVENUE).reduce((acc, a) => acc + a.balance, 0);
    const revenue = salesTxs.reduce((acc, t) => acc + (t.type === 'RETURN' ? -t.total : t.subtotal), 0) + manualRevenue;
    
    const cogs = salesTxs.reduce((acc, t) => {
      if (t.type === 'RETURN') return acc;
      return acc + (t.items || []).reduce((sum, item) => sum + ((item.costPrice || 0) * item.quantity), 0);
    }, 0);

    const manualExpenses = data.accounts.filter(a => a.type === AccountType.EXPENSE).reduce((acc, a) => acc + a.balance, 0);
    const expenses = data.expenses.reduce((acc, e) => acc + e.amount, 0) + manualExpenses;
    const netProfit = (revenue - cogs) - expenses;

    // 2. BALANCE SHEET: ASSETS
    const cashAndBankAccounts = data.accounts.filter(a => a.type === AccountType.ASSET && a.id !== 'acc-inv');
    const cashAndBankTotal = cashAndBankAccounts.reduce((acc, a) => acc + a.balance, 0);
    
    const otherCurrentAssetsAccounts = data.accounts.filter(a => a.type === AccountType.OTHER_CURRENT_ASSET);
    const otherCurrentAssetsTotal = otherCurrentAssetsAccounts.reduce((acc, a) => acc + a.balance, 0);
    
    const inventoryValue = data.products.reduce((acc, p) => acc + ((p.costPrice || 0) * p.stock), 0);
    const accountsReceivable = data.customers.reduce((acc, c) => acc + (c.debtBalance || 0), 0);
    
    const totalCurrentAssets = cashAndBankTotal + otherCurrentAssetsTotal + inventoryValue + accountsReceivable;

    // Fixed Assets
    const fixedAssetsAccounts = data.accounts.filter(a => a.type === AccountType.FIXED_ASSET);
    const totalFixedAssets = fixedAssetsAccounts.reduce((acc, a) => acc + a.balance, 0);

    const totalAssets = totalCurrentAssets + totalFixedAssets;

    // 3. BALANCE SHEET: LIABILITIES
    const accountsPayable = data.suppliers.reduce((acc, s) => acc + (s.balance || 0), 0);
    const customerAdvancesTotal = data.customers.reduce((acc, c) => acc + (c.advanceBalance || 0), 0);
    const otherLiabilitiesAccounts = data.accounts.filter(a => a.type === AccountType.LIABILITY);
    const otherLiabilitiesTotal = otherLiabilitiesAccounts.reduce((acc, a) => acc + a.balance, 0);
    
    const totalLiabilities = accountsPayable + otherLiabilitiesTotal + customerAdvancesTotal;

    // 4. BALANCE SHEET: EQUITY
    const equityAccounts = data.accounts.filter(a => a.type === AccountType.EQUITY);
    const paidInCapital = equityAccounts.reduce((acc, a) => acc + a.balance, 0);
    const retainedEarnings = netProfit;
    
    const totalEquity = paidInCapital + retainedEarnings;

    const balanceDiscrepancy = Math.abs(totalAssets - (totalLiabilities + totalEquity));
    const isBalanced = balanceDiscrepancy < 0.01;

    // 5. REGULAR SALES (ICE CREAM & GENERAL STOCK COMBINED & SEPARATE)
    const regularItemizedEntries: Array<{
      id: string;
      txId: string;
      timestamp: number;
      customerName: string;
      paymentMethod: string;
      accountId?: string;
      itemName: string;
      sku: string;
      category: string;
      isIceCream: boolean;
      quantity: number;
      unitCost: number;
      unitSell: number;
      totalCost: number;
      totalSell: number;
      profit: number;
    }> = [];

    let iceCreamRevenue = 0, iceCreamCost = 0, iceCreamProfit = 0, iceCreamQty = 0, iceCreamItemCount = 0;
    let stockRevenue = 0, stockCost = 0, stockProfit = 0, stockQty = 0, stockItemCount = 0;
    let regularCashSales = 0, regularBankSales = 0, regularMobileSales = 0;
    const regularTransactionsList: Transaction[] = [];

    // 6. DEBTS ONLY BREAKDOWN
    const debtSalesList: Array<Transaction & { debtAmount: number }> = [];
    let totalDebtSalesAmount = 0;

    data.transactions.forEach(t => {
      // Exclude pure debt payments, loans and expenses from standard POS sales processing
      if (t.type === 'DEBT_PAYMENT' || t.type === 'CASH_LOAN' || t.type === 'EXPENSE') return;

      const pm = (t.paymentMethod || '').toLowerCase();
      const isPureDebt = pm === 'debt' || pm.includes('pure_debt') || t.paymentMethod === PaymentMethod.DEBT || pm.includes('deyn') || pm.includes('credit');
      const isPartial = t.paymentMethod === PaymentMethod.PARTIAL && t.paymentDetails;
      const partialDebtAmt = isPartial ? (t.paymentDetails?.debt || 0) : 0;
      const partialCashAmt = isPartial ? (t.paymentDetails?.cash || 0) : 0;
      const partialBankAmt = isPartial ? (t.paymentDetails?.bank || 0) : 0;
      const partialMobileAmt = isPartial ? (t.paymentDetails?.mobile || 0) : 0;

      // Check if it's a debt sale
      if (isPureDebt) {
        debtSalesList.push({ ...t, debtAmount: t.total });
        totalDebtSalesAmount += t.total;
      } else if (partialDebtAmt > 0) {
        debtSalesList.push({ ...t, debtAmount: partialDebtAmt });
        totalDebtSalesAmount += partialDebtAmt;
      }

      // Check if it has regular sales portion (Cash, Bank, Mobile)
      if (!isPureDebt) {
        regularTransactionsList.push(t);

        if (isPartial) {
          regularCashSales += partialCashAmt;
          regularBankSales += partialBankAmt;
          regularMobileSales += partialMobileAmt;
        } else if (pm.includes('bank') || t.paymentMethod === PaymentMethod.BANK) {
          regularBankSales += t.total;
        } else if (pm.includes('mobile') || pm.includes('zaad') || pm.includes('evc') || pm.includes('sahal') || t.paymentMethod === PaymentMethod.MOBILE_MONEY) {
          regularMobileSales += t.total;
        } else {
          regularCashSales += t.total;
        }

        // Break down individual items into Ice Cream vs Stock
        const custName = data.customers.find(c => c.id === t.customerId)?.name || (t.notes?.includes('Customer:') ? t.notes.split('Customer:')[1].split(',')[0].trim() : 'Macmiil Caadi ah');

        (t.items || []).forEach((item, idx) => {
          const cat = (item.category || '').toLowerCase();
          const nameLow = (item.name || '').toLowerCase();
          const isIceCream = cat.includes('ice cream') || cat.includes('icecream') || nameLow.includes('ice cream') || nameLow.includes('icecream');
          const qty = item.quantity || 1;
          const uCost = item.costPrice || 0;
          const uSell = item.sellPrice || 0;
          const tCost = uCost * qty;
          const tSell = uSell * qty;
          const profit = tSell - tCost;

          if (isIceCream) {
            iceCreamRevenue += tSell;
            iceCreamCost += tCost;
            iceCreamProfit += profit;
            iceCreamQty += qty;
            iceCreamItemCount += 1;
          } else {
            stockRevenue += tSell;
            stockCost += tCost;
            stockProfit += profit;
            stockQty += qty;
            stockItemCount += 1;
          }

          regularItemizedEntries.push({
            id: `${t.id}-item-${idx}`,
            txId: t.id,
            timestamp: t.timestamp,
            customerName: custName,
            paymentMethod: t.paymentMethod || 'CASH',
            accountId: t.accountId,
            itemName: item.name,
            sku: item.sku || '',
            category: item.category || (isIceCream ? 'Ice Cream' : 'General Stock'),
            isIceCream,
            quantity: qty,
            unitCost: uCost,
            unitSell: uSell,
            totalCost: tCost,
            totalSell: tSell,
            profit
          });
        });
      }
    });

    const regularCombinedRevenue = iceCreamRevenue + stockRevenue;
    const regularCombinedCost = iceCreamCost + stockCost;
    const regularCombinedProfit = iceCreamProfit + stockProfit;
    const regularCombinedQty = iceCreamQty + stockQty;
    const iceCreamMargin = iceCreamRevenue > 0 ? (iceCreamProfit / iceCreamRevenue) * 100 : 0;
    const stockMargin = stockRevenue > 0 ? (stockProfit / stockRevenue) * 100 : 0;
    const regularCombinedMargin = regularCombinedRevenue > 0 ? (regularCombinedProfit / regularCombinedRevenue) * 100 : 0;

    // Customer Debt Payments & Loans
    const debtPaymentsList = data.transactions.filter(t => t.type === 'DEBT_PAYMENT');
    const totalDebtPaidIn = debtPaymentsList.reduce((acc, t) => acc + t.total, 0);

    const cashLoansList = data.transactions.filter(t => t.type === 'CASH_LOAN');
    const totalCashLoansOut = cashLoansList.reduce((acc, t) => acc + t.total, 0);

    const debtorCustomersList = data.customers
      .filter(c => (c.debtBalance || 0) > 0)
      .sort((a, b) => (b.debtBalance || 0) - (a.debtBalance || 0));

    // Transfers & Purchases
    const transfersList = data.accountTransfers || [];
    const totalTransfersVal = transfersList.reduce((acc, t) => acc + t.amount, 0);

    const stockPurchasesList = data.stockAdjustments.filter(sa => sa.type === 'STOCK_IN' || !!sa.cashPaid);
    const totalStockPurchasesVal = stockPurchasesList.reduce((acc, sa) => acc + (sa.cashPaid || sa.totalCost || 0), 0);

    return {
      revenue,
      cogs,
      grossProfit: revenue - cogs,
      expenses,
      netProfit,
      cashAndBankAccounts,
      cashAndBankTotal,
      otherCurrentAssetsAccounts,
      otherCurrentAssetsTotal,
      inventoryValue,
      accountsReceivable,
      customerAdvancesTotal,
      totalCurrentAssets,
      fixedAssetsAccounts,
      totalFixedAssets,
      totalAssets,
      accountsPayable,
      otherLiabilitiesTotal,
      totalLiabilities,
      paidInCapital,
      retainedEarnings,
      totalEquity,
      isBalanced,
      balanceDiscrepancy,
      // Regular Sales (Ice Cream + Stock)
      regularItemizedEntries,
      regularTransactionsList,
      iceCreamRevenue,
      iceCreamCost,
      iceCreamProfit,
      iceCreamQty,
      iceCreamItemCount,
      iceCreamMargin,
      stockRevenue,
      stockCost,
      stockProfit,
      stockQty,
      stockItemCount,
      stockMargin,
      regularCombinedRevenue,
      regularCombinedCost,
      regularCombinedProfit,
      regularCombinedQty,
      regularCombinedMargin,
      regularCashSales,
      regularBankSales,
      regularMobileSales,
      // Debts Only
      debtSalesList,
      totalDebtSalesAmount,
      debtPaymentsList,
      totalDebtPaidIn,
      cashLoansList,
      totalCashLoansOut,
      debtorCustomersList,
      // Transfers & Purchases
      transfersList,
      totalTransfersVal,
      stockPurchasesList,
      totalStockPurchasesVal
    };
  }, [data]);

  const handleSaveAccount = () => {
    if (!formData.name) return alert("Account name is required");
    
    if (editingAccount) {
      setData(prev => ({
        ...prev,
        accounts: prev.accounts.map(a => a.id === editingAccount.id ? { ...a, ...formData } : a)
      }));
      addLog('Account Updated', `Updated ledger account: ${formData.name}`);
    } else {
      const account: Account = {
        id: generateId(),
        ...formData
      };
      setData(prev => ({
        ...prev,
        accounts: [...prev.accounts, account]
      }));
      addLog('Account Created', `New ledger account added: ${account.name}`);
    }

    closeModal();
  };

  const deleteAccount = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    const accountToDelete = data.accounts.find(a => a.id === id);
    if (!accountToDelete) return;
    setDeleteConfirmAcc(accountToDelete);
  };

  const closeModal = () => {
    setShowAddAccount(false);
    setEditingAccount(null);
    setFormData({ name: '', type: AccountType.ASSET, balance: 0 });
  };

  const openEdit = (account: Account) => {
    setEditingAccount(account);
    setFormData({
      name: account.name,
      type: account.type,
      balance: account.balance
    });
    setShowAddAccount(true);
  };

  const getAccountIcon = (name: string) => {
    const low = name.toLowerCase();
    if (low.includes('bank')) return <BankIcon size={16} className="text-blue-500"/>;
    if (low.includes('mobile') || low.includes('evc') || low.includes('zaad')) return <Smartphone size={16} className="text-purple-500"/>;
    if (low.includes('cash') || low.includes('cadaan')) return <Wallet size={16} className="text-emerald-500"/>;
    if (low.includes('deyn') || low.includes('receivable')) return <Users size={16} className="text-rose-500"/>;
    if (low.includes('payable') || low.includes('supplier')) return <Briefcase size={16} className="text-amber-500"/>;
    return <CircleDollarSign size={16} className="text-slate-500" />;
  };

  const filteredAccounts = data.accounts.filter(a => 
    a.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    a.type.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-4 sm:p-8 max-w-7xl mx-auto space-y-8 pb-24">
      {/* Top Header & Actions */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 border-b pb-6 no-print">
        <div>
          <span className="px-3.5 py-1 bg-blue-100 text-blue-800 rounded-full font-black text-[11px] uppercase tracking-wider mb-2 inline-block">
            📊 Accounting & Financial Master Hub
          </span>
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
            Xisaabaadka & Sandaaqadaha Dukaanka
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
            Sida tooska ah u kala saar Dakhliga POS, Deymaha Lagula Leeyahay, Isu-shubka Accounts-ka, iyo Shaxda Dhaqdhaqaaqa (Double Click).
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
          <button 
            type="button"
            onClick={() => {
              const firstOwed = data.suppliers.find(s => s.balance > 0) || data.suppliers[0];
              if (firstOwed) {
                setPaySupplierId(firstOwed.id);
                setPayAmountVal(firstOwed.balance);
              }
              const defaultAcc = data.accounts.find(a => a.name.toLowerCase().includes('cash'))?.id || data.accounts[0]?.id || '';
              setPayAccId(defaultAcc);
              setShowSupplierPayModal(true);
            }}
            className="bg-rose-600 text-white px-5 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-rose-700 transition-all shadow-md shadow-rose-900/20 text-xs"
          >
            <CreditCard size={16} /> Bixi Deynta Supplier-ka (Pay Debt)
          </button>
          <button 
            type="button"
            onClick={() => { setTransferDefaultFromId(''); setShowTransferModal(true); }}
            className="bg-emerald-600 text-white px-5 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-emerald-700 transition-all shadow-md shadow-emerald-900/20 text-xs"
          >
            <ArrowRightLeft size={16} /> Isu-shub Lacag (Transfer)
          </button>
          <button 
            type="button"
            onClick={() => window.print()}
            className="bg-slate-100 text-slate-700 px-5 py-3 rounded-2xl font-black flex items-center gap-2 hover:bg-slate-200 transition-all text-xs"
          >
            <Printer size={16} /> Print Reports
          </button>
          <button 
            type="button"
            onClick={() => setShowAddAccount(true)}
            className="bg-blue-600 text-white px-5 py-3 rounded-2xl font-black shadow-md shadow-blue-900/20 hover:bg-blue-700 transition-all flex items-center gap-2 text-xs"
          >
            <Plus size={16} /> New Account
          </button>
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 bg-slate-100/80 p-2 rounded-2xl no-print border border-slate-200">
        <button
          type="button"
          onClick={() => setActiveCategoryTab('ALL_ACCOUNTS')}
          className={`flex-1 sm:flex-none px-5 py-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 ${
            activeCategoryTab === 'ALL_ACCOUNTS'
              ? 'bg-slate-900 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          <Wallet size={16} />
          <span>1. Sandaaqada Accounts-ka (Cash Flow)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategoryTab('REGULAR_SALES')}
          className={`flex-1 sm:flex-none px-5 py-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 ${
            activeCategoryTab === 'REGULAR_SALES'
              ? 'bg-blue-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          <ShoppingBag size={16} />
          <span>2. Iibka Caadiga ah (Stock & Ice Cream)</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategoryTab('CUSTOMER_DEBTS')}
          className={`flex-1 sm:flex-none px-5 py-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 ${
            activeCategoryTab === 'CUSTOMER_DEBTS'
              ? 'bg-rose-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          <CreditCard size={16} />
          <span>3. Qaybta Deymaha Kaliya</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategoryTab('TRANSFERS_PURCHASES')}
          className={`flex-1 sm:flex-none px-5 py-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 ${
            activeCategoryTab === 'TRANSFERS_PURCHASES'
              ? 'bg-purple-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          <Package size={16} />
          <span>4. Isu-Shubka & Stock Purchases</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveCategoryTab('STATEMENTS')}
          className={`flex-1 sm:flex-none px-5 py-3 rounded-xl font-black text-xs transition-all flex items-center justify-center gap-2 ${
            activeCategoryTab === 'STATEMENTS'
              ? 'bg-indigo-600 text-white shadow-md'
              : 'text-slate-600 hover:bg-slate-200 hover:text-slate-900'
          }`}
        >
          <Scale size={16} />
          <span>5. Income Statement & Balance Sheet</span>
        </button>
      </div>

      {/* ==================== TAB 1: ALL ACCOUNTS MASTER LEDGER ==================== */}
      {activeCategoryTab === 'ALL_ACCOUNTS' && (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Master Overview Hero */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-950 text-white rounded-[32px] p-6 sm:p-8 shadow-xl border border-slate-700/50">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div>
                <span className="px-3.5 py-1.5 bg-emerald-500/20 text-emerald-300 border border-emerald-400/30 rounded-full text-xs font-black uppercase tracking-wider mb-3 inline-block shadow-sm">
                  💰 Master Ledger & Dhaqdhaqaaq
                </span>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Sandaaqada Accounts-ka: Soo Gal, Ka Bix iyo Balance
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1 max-w-2xl">
                  Bartaani waxay si toos ah kuugu muujinaysaa account kasta lacagta soo gashay (Inflow), lacagta ka baxday (Outflow), iyo Net Balance-ka ku jira. <strong className="text-emerald-400">Double click</strong> ugu dhufo account kasta si aad u aragto Statement-kiisa oo dhamaystiran.
                </p>
              </div>

              {/* Master Totals */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 w-full lg:w-auto">
                <div className="bg-white/10 backdrop-blur-md px-4 py-3.5 rounded-2xl border border-white/15">
                  <span className="text-[10px] uppercase tracking-widest text-emerald-400 font-black block flex items-center gap-1">
                    <ArrowDownLeft size={12} /> Lacagta Soo Gashay
                  </span>
                  <span className="text-xl font-black font-mono text-emerald-400">
                    {formatCurrency(
                      (Object.values(accountFlowMap) as Array<{inflow: number; outflow: number}>).reduce((a, b) => a + (b.inflow || 0), 0),
                      currency, rate
                    )}
                  </span>
                </div>

                <div className="bg-white/10 backdrop-blur-md px-4 py-3.5 rounded-2xl border border-white/15">
                  <span className="text-[10px] uppercase tracking-widest text-rose-400 font-black block flex items-center gap-1">
                    <ArrowUpRight size={12} /> Lacagta Ka Baxday
                  </span>
                  <span className="text-xl font-black font-mono text-rose-400">
                    {formatCurrency(
                      (Object.values(accountFlowMap) as Array<{inflow: number; outflow: number}>).reduce((a, b) => a + (b.outflow || 0), 0),
                      currency, rate
                    )}
                  </span>
                </div>

                <div className="col-span-2 sm:col-span-1 bg-white/10 backdrop-blur-md px-4 py-3.5 rounded-2xl border border-white/15">
                  <span className="text-[10px] uppercase tracking-widest text-blue-300 font-black block">
                    Cash & Banks Balance
                  </span>
                  <span className="text-xl font-black font-mono text-white">
                    {formatCurrency(financialStats.cashAndBankTotal, currency, rate)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Search & Filter Bar */}
          <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-100 text-emerald-800 rounded-xl">
                  <Calendar size={18} />
                </span>
                <div>
                  <h4 className="text-xs font-black uppercase text-slate-800 tracking-wider">
                    Sifee Dhaqdhaqaaqa Koontooyinka (Account Cash Flow Timeframe)
                  </h4>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Dooro taariikhda aad rabto inaad ku aragto Soo galka (Inflow) iyo Ka baxa (Outflow).
                  </p>
                </div>
              </div>

              <div className="relative w-full md:w-80">
                <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input
                  type="text"
                  placeholder="Raadi account kasta..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-blue-500"
                />
              </div>
            </div>

            <DateFilterBar
              timeframe={accFlowTimeframe}
              setTimeframe={setAccFlowTimeframe}
              singleDate={accFlowSingleDate}
              setSingleDate={setAccFlowSingleDate}
              startDate={accFlowStartDate}
              setStartDate={setAccFlowStartDate}
              endDate={accFlowEndDate}
              setEndDate={setAccFlowEndDate}
              themeColor="emerald"
            />
          </div>

          {/* Accounts Grid Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredAccounts.map(account => {
              const flow = accountFlowMap[account.id] || { inflow: 0, outflow: 0, netBalance: account.balance, txCount: 0 };
              const displayBalance = account.id === 'acc-inv' ? financialStats.inventoryValue : account.balance;

              return (
                <div
                  key={account.id}
                  onDoubleClick={() => setSelectedStatementAcc(account)}
                  onClick={() => setSelectedStatementAcc(account)}
                  className="bg-white p-5 rounded-3xl border border-slate-200/80 shadow-sm hover:shadow-md transition-all cursor-pointer group hover:border-blue-300 relative overflow-hidden"
                  title="Double click ama guji si aad u aragto dhaqdhaqaaqa"
                >
                  <div className="flex items-center justify-between mb-3 border-b pb-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-slate-100 rounded-2xl text-slate-700 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                        {getAccountIcon(account.name)}
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                          {account.name}
                        </h3>
                        <span className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                          {account.type}
                        </span>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedStatementAcc(account);
                      }}
                      className="p-2 bg-slate-100 hover:bg-blue-600 hover:text-white rounded-xl transition-all text-slate-600"
                      title="Arag Statement-ka"
                    >
                      <Eye size={16} />
                    </button>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                    <div className="p-2.5 bg-emerald-50/60 rounded-xl border border-emerald-100">
                      <span className="text-[9px] font-black uppercase text-emerald-700 tracking-wider block mb-0.5">
                        Soo Gashay (Inflow)
                      </span>
                      <span className="font-mono font-black text-emerald-800">
                        +{formatCurrency(flow.inflow, currency, rate)}
                      </span>
                    </div>

                    <div className="p-2.5 bg-rose-50/60 rounded-xl border border-rose-100">
                      <span className="text-[9px] font-black uppercase text-rose-700 tracking-wider block mb-0.5">
                        Ka Baxday (Outflow)
                      </span>
                      <span className="font-mono font-black text-rose-800">
                        -{formatCurrency(flow.outflow, currency, rate)}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100">
                    <div>
                      <span className="text-[10px] font-black uppercase text-slate-500 block">Balance-ka Hadda Ku Jira</span>
                      <span className="text-lg font-black font-mono text-slate-900">
                        {formatCurrency(displayBalance, currency, rate)}
                      </span>
                    </div>

                    <span className="px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200/80 rounded-lg text-[10px] font-black uppercase tracking-wider flex items-center gap-1 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      Double Click <ChevronRight size={12} />
                    </span>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Comprehensive Table */}
          <div className="bg-white rounded-[32px] border shadow-sm overflow-hidden">
            <div className="p-6 border-b bg-slate-50 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <PieChart className="text-blue-600" size={22} />
                <h3 className="text-base font-black uppercase tracking-tight text-slate-900">
                  Chart of Accounts Table (Dhaqdhaqaaqa Koontooyinka)
                </h3>
              </div>
              <span className="text-xs text-slate-500 font-bold">
                Tirada Koontooyinka: {filteredAccounts.length}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 border-b font-black text-slate-700 uppercase">
                    <th className="p-4">Account Details</th>
                    <th className="p-4">Nooca (Type)</th>
                    <th className="p-4 text-right">Lacagta Soo Gashay</th>
                    <th className="p-4 text-right">Lacagta Ka Baxday</th>
                    <th className="p-4 text-right">Balance-ka Hadda</th>
                    <th className="p-4 text-center">Dhaqdhaqaaq</th>
                    <th className="p-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                  {filteredAccounts.map((a) => {
                    const flow = accountFlowMap[a.id] || { inflow: 0, outflow: 0, netBalance: a.balance, txCount: 0 };
                    const displayBalance = a.id === 'acc-inv' ? financialStats.inventoryValue : a.balance;

                    return (
                      <tr 
                        key={a.id} 
                        onDoubleClick={() => setSelectedStatementAcc(a)}
                        className="hover:bg-blue-50/50 transition-colors cursor-pointer group"
                        title="Double click si aad u aragto dhaqdhaqaaqa akoonka"
                      >
                        <td className="p-4">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-slate-100 rounded-xl text-slate-700">
                              {getAccountIcon(a.name)}
                            </div>
                            <div>
                              <p className="font-black text-slate-900 group-hover:text-blue-600 transition-colors">
                                {a.name}
                              </p>
                              <p className="text-[10px] font-mono text-slate-400">ID: {a.id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="p-4">
                          <span className={`text-[10px] font-black px-3 py-1 rounded-lg uppercase ${
                            a.type === AccountType.ASSET ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 
                            a.type === AccountType.LIABILITY ? 'bg-rose-50 text-rose-700 border border-rose-200' : 
                            a.type === AccountType.FIXED_ASSET ? 'bg-amber-50 text-amber-700 border border-amber-200' : 
                            a.type === AccountType.REVENUE ? 'bg-indigo-50 text-indigo-700 border border-indigo-200' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {a.type}
                          </span>
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-emerald-600">
                          +{formatCurrency(flow.inflow, currency, rate)}
                        </td>
                        <td className="p-4 text-right font-mono font-bold text-rose-600">
                          -{formatCurrency(flow.outflow, currency, rate)}
                        </td>
                        <td className="p-4 text-right font-mono font-black text-slate-900">
                          {formatCurrency(displayBalance, currency, rate)}
                        </td>
                        <td className="p-4 text-center">
                          <button
                            type="button"
                            onClick={() => setSelectedStatementAcc(a)}
                            className="px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-xl font-black text-[10px] uppercase transition-all inline-flex items-center gap-1 shadow-sm"
                          >
                            <Eye size={12} /> Statement
                          </button>
                        </td>
                        <td className="p-4 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button 
                              onClick={() => { setTransferDefaultFromId(a.id); setShowTransferModal(true); }} 
                              className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all" 
                              title="Isu-shub Lacag (Transfer)"
                            >
                              <ArrowRightLeft size={15} />
                            </button>
                            <button onClick={() => openEdit(a)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all" title="Edit">
                              <Edit2 size={15} />
                            </button>
                            <button onClick={(e) => deleteAccount(e, a.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all" title="Delete">
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ==================== TAB 2: REGULAR SALES (ICE CREAM + STOCK ISKU JIRA) ==================== */}
      {activeCategoryTab === 'REGULAR_SALES' && (() => {
        // Filter regular itemized sales
        const filteredRegularItems = financialStats.regularItemizedEntries.filter(entry => {
          if (regularFilterType === 'ICE_CREAM' && !entry.isIceCream) return false;
          if (regularFilterType === 'STOCK' && entry.isIceCream) return false;

          if (!isTimestampInTimeframe(entry.timestamp, regularTimeframe, regularSingleDate, regularStartDate, regularEndDate)) {
            return false;
          }

          if (regularSearch.trim()) {
            const s = regularSearch.toLowerCase();
            const matchName = entry.itemName.toLowerCase().includes(s);
            const matchSku = entry.sku.toLowerCase().includes(s);
            const matchCust = entry.customerName.toLowerCase().includes(s);
            const matchTx = entry.txId.toLowerCase().includes(s);
            const matchCat = entry.category.toLowerCase().includes(s);
            if (!matchName && !matchSku && !matchCust && !matchTx && !matchCat) return false;
          }

          return true;
        });

        const filteredRevenue = filteredRegularItems.reduce((sum, i) => sum + i.totalSell, 0);
        const filteredCost = filteredRegularItems.reduce((sum, i) => sum + i.totalCost, 0);
        const filteredProfit = filteredRevenue - filteredCost;
        const filteredQty = filteredRegularItems.reduce((sum, i) => sum + i.quantity, 0);
        const filteredMargin = filteredRevenue > 0 ? (filteredProfit / filteredRevenue) * 100 : 0;

        return (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header Hero Banner */}
            <div className="bg-gradient-to-br from-slate-900 via-blue-950 to-indigo-950 text-white rounded-[32px] p-6 sm:p-8 shadow-xl border border-blue-900/40">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="px-3.5 py-1.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-full text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles size={13} className="text-blue-400" /> Iibka Caadiga ah (Stock & Ice Cream)
                    </span>
                    <span className="px-3 py-1 bg-pink-500/20 text-pink-300 border border-pink-400/30 rounded-full text-[11px] font-black">
                      🍦 Ice Cream
                    </span>
                    <span className="px-3 py-1 bg-cyan-500/20 text-cyan-300 border border-cyan-400/30 rounded-full text-[11px] font-black">
                      📦 General Stock
                    </span>
                  </div>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    Kala Saarida Iibka Caadiga ah ee Dukaanka
                  </h2>
                  <p className="text-xs sm:text-sm text-blue-100/80 font-medium mt-1.5 max-w-2xl leading-relaxed">
                    Bartaani waxay si faahfaahsan kuugu kala saaraysaa iibka caadiga ah oo isugu jira <strong>Ice Cream-ka</strong> iyo <strong>Stock-ga Guud ee Dukaanka</strong>, xabbadaha la iibiyay, kharashkooda, iyo faa&apos;iidada dhabta ah.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <div className="bg-white/10 backdrop-blur-md px-5 py-3.5 rounded-2xl border border-white/15">
                    <span className="text-[10px] uppercase text-blue-200 font-black block tracking-wider">Iibka Guud ee Caadiga</span>
                    <span className="text-2xl font-black font-mono text-emerald-300">
                      {formatCurrency(financialStats.regularCombinedRevenue, currency, rate)}
                    </span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md px-5 py-3.5 rounded-2xl border border-white/15">
                    <span className="text-[10px] uppercase text-blue-200 font-black block tracking-wider">Faa&apos;iidada Net</span>
                    <span className="text-2xl font-black font-mono text-cyan-300">
                      +{formatCurrency(financialStats.regularCombinedProfit, currency, rate)}
                    </span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md px-4 py-3.5 rounded-2xl border border-white/15 text-center">
                    <span className="text-[10px] uppercase text-blue-200 font-black block tracking-wider">Xabbadaha La Iibiyay</span>
                    <span className="text-2xl font-black font-mono text-white">
                      {financialStats.regularCombinedQty.toLocaleString()} pcs
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 3 Core Analytical Cards: Ice Cream vs General Stock vs Channels */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              {/* Card 1: Ice Cream Sales */}
              <div className="bg-gradient-to-b from-pink-50/70 to-white p-6 rounded-3xl border border-pink-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 p-6 opacity-10 text-pink-700 font-black text-6xl pointer-events-none">
                  🍦
                </div>
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-2xl bg-pink-100 text-pink-700 flex items-center justify-center font-bold text-xl shadow-sm">
                        🍦
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 text-sm">Iibka Ice Cream-ka</h4>
                        <span className="text-[10px] font-bold text-pink-600 uppercase tracking-wider">Ice Cream Category</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-pink-100 text-pink-800 rounded-lg text-[10px] font-black">
                      {financialStats.iceCreamItemCount} Nooc
                    </span>
                  </div>

                  <div className="space-y-3 bg-white/80 p-4 rounded-2xl border border-pink-100">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-slate-500 font-bold">Wadarta Iibka (Revenue):</span>
                      <span className="text-lg font-black font-mono text-pink-700">
                        {formatCurrency(financialStats.iceCreamRevenue, currency, rate)}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-slate-500 font-bold">Xabbadaha La Iibiyay:</span>
                      <span className="text-sm font-black font-mono text-slate-800">
                        {financialStats.iceCreamQty.toLocaleString()} Qty
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-slate-500 font-bold">Kharashka (Cost):</span>
                      <span className="text-xs font-bold font-mono text-slate-600">
                        {formatCurrency(financialStats.iceCreamCost, currency, rate)}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-pink-100 flex justify-between items-baseline">
                      <span className="text-xs text-emerald-700 font-black">Faa&apos;iidada (Net Profit):</span>
                      <span className="text-base font-black font-mono text-emerald-600">
                        +{formatCurrency(financialStats.iceCreamProfit, currency, rate)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black text-pink-700 bg-pink-50 px-2.5 py-1 rounded-lg">
                      <span>Profit Margin:</span>
                      <span>{financialStats.iceCreamMargin.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setRegularFilterType('ICE_CREAM')}
                  className="mt-4 w-full py-2.5 bg-pink-600 hover:bg-pink-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Filter size={14} /> Eeg Ice Cream Kaliya &rarr;
                </button>
              </div>

              {/* Card 2: General Store Stock Sales */}
              <div className="bg-gradient-to-b from-blue-50/70 to-white p-6 rounded-3xl border border-blue-200 shadow-sm relative overflow-hidden flex flex-col justify-between">
                <div className="absolute top-0 right-0 p-6 opacity-10 text-blue-700 font-black text-6xl pointer-events-none">
                  📦
                </div>
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-bold text-xl shadow-sm">
                        📦
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 text-sm">Stock-ga Guud ee Dukaanka</h4>
                        <span className="text-[10px] font-bold text-blue-600 uppercase tracking-wider">General Store Inventory</span>
                      </div>
                    </div>
                    <span className="px-2.5 py-1 bg-blue-100 text-blue-800 rounded-lg text-[10px] font-black">
                      {financialStats.stockItemCount} Nooc
                    </span>
                  </div>

                  <div className="space-y-3 bg-white/80 p-4 rounded-2xl border border-blue-100">
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-slate-500 font-bold">Wadarta Iibka (Revenue):</span>
                      <span className="text-lg font-black font-mono text-blue-700">
                        {formatCurrency(financialStats.stockRevenue, currency, rate)}
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-slate-500 font-bold">Xabbadaha La Iibiyay:</span>
                      <span className="text-sm font-black font-mono text-slate-800">
                        {financialStats.stockQty.toLocaleString()} Qty
                      </span>
                    </div>
                    <div className="flex justify-between items-baseline">
                      <span className="text-xs text-slate-500 font-bold">Kharashka (Cost):</span>
                      <span className="text-xs font-bold font-mono text-slate-600">
                        {formatCurrency(financialStats.stockCost, currency, rate)}
                      </span>
                    </div>
                    <div className="pt-2 border-t border-blue-100 flex justify-between items-baseline">
                      <span className="text-xs text-emerald-700 font-black">Faa&apos;iidada (Net Profit):</span>
                      <span className="text-base font-black font-mono text-emerald-600">
                        +{formatCurrency(financialStats.stockProfit, currency, rate)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-[10px] font-black text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg">
                      <span>Profit Margin:</span>
                      <span>{financialStats.stockMargin.toFixed(1)}%</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setRegularFilterType('STOCK')}
                  className="mt-4 w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all flex items-center justify-center gap-1.5 shadow-sm"
                >
                  <Filter size={14} /> Eeg Stock-ga Kaliya &rarr;
                </button>
              </div>

              {/* Card 3: Payment Channels Breakdown */}
              <div className="bg-gradient-to-b from-slate-50 to-white p-6 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-10 h-10 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-sm">
                      <Wallet size={20} />
                    </div>
                    <div>
                      <h4 className="font-black text-slate-900 text-sm">Sandaaqadaha Iibku Galay</h4>
                      <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Payment Channels</span>
                    </div>
                  </div>

                  <div className="space-y-3 bg-white p-4 rounded-2xl border border-slate-200">
                    <div className="flex justify-between items-center p-2 rounded-xl bg-emerald-50/60 border border-emerald-100">
                      <div className="flex items-center gap-2">
                        <Wallet size={16} className="text-emerald-700" />
                        <span className="text-xs font-black text-emerald-900">Cadaan (Cash)</span>
                      </div>
                      <span className="text-sm font-black font-mono text-emerald-700">
                        {formatCurrency(financialStats.regularCashSales, currency, rate)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center p-2 rounded-xl bg-blue-50/60 border border-blue-100">
                      <div className="flex items-center gap-2">
                        <BankIcon size={16} className="text-blue-700" />
                        <span className="text-xs font-black text-blue-900">Bangiga (Bank)</span>
                      </div>
                      <span className="text-sm font-black font-mono text-blue-700">
                        {formatCurrency(financialStats.regularBankSales, currency, rate)}
                      </span>
                    </div>

                    <div className="flex justify-between items-center p-2 rounded-xl bg-purple-50/60 border border-purple-100">
                      <div className="flex items-center gap-2">
                        <Smartphone size={16} className="text-purple-700" />
                        <span className="text-xs font-black text-purple-900">Mobile Money</span>
                      </div>
                      <span className="text-sm font-black font-mono text-purple-700">
                        {formatCurrency(financialStats.regularMobileSales, currency, rate)}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-slate-100 rounded-xl flex items-center justify-between text-[11px] font-bold text-slate-600">
                  <span>Wadarta Lacagta Gashay:</span>
                  <span className="font-black font-mono text-slate-900">
                    {formatCurrency(financialStats.regularCashSales + financialStats.regularBankSales + financialStats.regularMobileSales, currency, rate)}
                  </span>
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                {/* Category Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setRegularFilterType('ALL')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                      regularFilterType === 'ALL'
                        ? 'bg-slate-900 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Dhammaan (Ice Cream + Stock)
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegularFilterType('ICE_CREAM')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                      regularFilterType === 'ICE_CREAM'
                        ? 'bg-pink-600 text-white shadow-sm'
                        : 'text-pink-700 hover:bg-pink-100'
                    }`}
                  >
                    🍦 Ice Cream Kaliya
                  </button>
                  <button
                    type="button"
                    onClick={() => setRegularFilterType('STOCK')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                      regularFilterType === 'STOCK'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-blue-700 hover:bg-blue-100'
                    }`}
                  >
                    📦 Stock-ga Kaliya
                  </button>
                </div>

                {/* Search Box */}
                <div className="relative min-w-[260px]">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Raadi Product, SKU, Macmiil..."
                    value={regularSearch}
                    onChange={e => setRegularSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all"
                  />
                  {regularSearch && (
                    <button
                      onClick={() => setRegularSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Date Filter Bar */}
              <DateFilterBar
                timeframe={regularTimeframe}
                setTimeframe={setRegularTimeframe}
                singleDate={regularSingleDate}
                setSingleDate={setRegularSingleDate}
                startDate={regularStartDate}
                setStartDate={setRegularStartDate}
                endDate={regularEndDate}
                setEndDate={setRegularEndDate}
                themeColor="blue"
              />
            </div>

            {/* Filtered Results Overview Strip */}
            <div className="bg-blue-50/70 border border-blue-200/80 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-4 text-xs font-bold text-slate-700">
              <div className="flex items-center gap-2">
                <span className="p-1.5 bg-blue-600 text-white rounded-lg">
                  <Filter size={14} />
                </span>
                <span>
                  Liiska la doortay: <strong className="text-slate-900">{filteredRegularItems.length} items</strong> (
                  {regularFilterType === 'ALL' ? 'Ice Cream + Stock' : regularFilterType === 'ICE_CREAM' ? 'Ice Cream Kaliya' : 'Stock Kaliya'} - {regularTimeframe === 'ALL' ? 'Waqti kasta' : regularTimeframe === 'TODAY' ? 'Maanta' : regularTimeframe === 'MONTH' ? 'Bishan' : 'Sanadkan'})
                </span>
              </div>
              <div className="flex flex-wrap items-center gap-4 font-mono text-xs">
                <span>Wadarta Xabbadaha: <strong className="text-slate-900">{filteredQty.toLocaleString()} pcs</strong></span>
                <span>Wadarta Iibka: <strong className="text-blue-700">{formatCurrency(filteredRevenue, currency, rate)}</strong></span>
                <span>Kharashka: <strong className="text-slate-700">{formatCurrency(filteredCost, currency, rate)}</strong></span>
                <span>Faa&apos;iidada: <strong className="text-emerald-700">+{formatCurrency(filteredProfit, currency, rate)} ({filteredMargin.toFixed(1)}%)</strong></span>
              </div>
            </div>

            {/* Detailed Itemized Sales Table */}
            <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-6 space-y-4">
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <ShoppingBag size={18} className="text-blue-600" />
                  Alaabta La Iibiyay (Itemized Regular Sales Ledger)
                </h3>
                <span className="text-xs font-bold text-slate-500">
                  Riix laba jeer saf kasta si aad u furto sandaaqada lacagta
                </span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100/90 border-b border-slate-200 font-black text-slate-700 uppercase tracking-wider text-[10px]">
                      <th className="p-3.5"># Invoice</th>
                      <th className="p-3.5">Taariikhda</th>
                      <th className="p-3.5">Product & SKU</th>
                      <th className="p-3.5 text-center">Nooca</th>
                      <th className="p-3.5">Macmiilka</th>
                      <th className="p-3.5 text-right">Qiimaha Iibka</th>
                      <th className="p-3.5 text-center">Qty</th>
                      <th className="p-3.5 text-right">Wadarta Iibka</th>
                      <th className="p-3.5 text-right">Kharashka</th>
                      <th className="p-3.5 text-right">Faa&apos;iidada</th>
                      <th className="p-3.5 text-center">Habka Bixinta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {filteredRegularItems.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="p-8 text-center text-slate-400 font-bold">
                          Wax xog ah lagama helin xulashadaada.
                        </td>
                      </tr>
                    ) : (
                      filteredRegularItems.slice(0, 100).map(entry => (
                        <tr
                          key={entry.id}
                          className="hover:bg-blue-50/40 cursor-pointer transition-colors"
                          onDoubleClick={() => {
                            const targetAcc = data.accounts.find(a => a.id === entry.accountId) || data.accounts.find(a => a.id === 'acc-cash');
                            if (targetAcc) setSelectedStatementAcc(targetAcc);
                          }}
                        >
                          <td className="p-3.5 font-mono font-black text-blue-600">
                            #INV-{(entry.txId || '').slice(-6).toUpperCase()}
                          </td>
                          <td className="p-3.5 text-slate-500 whitespace-nowrap">
                            {new Date(entry.timestamp).toLocaleDateString()} {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </td>
                          <td className="p-3.5">
                            <span className="font-black text-slate-900 block">{entry.itemName}</span>
                            {entry.sku && <span className="text-[10px] font-mono text-slate-400">SKU: {entry.sku}</span>}
                          </td>
                          <td className="p-3.5 text-center whitespace-nowrap">
                            {entry.isIceCream ? (
                              <span className="px-2.5 py-1 bg-pink-100 text-pink-800 border border-pink-200 rounded-lg text-[10px] font-black inline-flex items-center gap-1">
                                🍦 Ice Cream
                              </span>
                            ) : (
                              <span className="px-2.5 py-1 bg-blue-100 text-blue-800 border border-blue-200 rounded-lg text-[10px] font-black inline-flex items-center gap-1">
                                📦 Stock Item
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-slate-700 font-bold">
                            {entry.customerName}
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold text-slate-700">
                            {formatCurrency(entry.unitSell, currency, rate)}
                          </td>
                          <td className="p-3.5 text-center font-mono font-black text-slate-900">
                            {entry.quantity}
                          </td>
                          <td className="p-3.5 text-right font-mono font-black text-blue-700">
                            {formatCurrency(entry.totalSell, currency, rate)}
                          </td>
                          <td className="p-3.5 text-right font-mono font-bold text-slate-500">
                            {formatCurrency(entry.totalCost, currency, rate)}
                          </td>
                          <td className="p-3.5 text-right font-mono font-black text-emerald-700">
                            +{formatCurrency(entry.profit, currency, rate)}
                          </td>
                          <td className="p-3.5 text-center whitespace-nowrap">
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 rounded-md font-black text-[10px] uppercase">
                              {entry.paymentMethod}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  {filteredRegularItems.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-900 text-white font-black">
                        <td colSpan={6} className="p-3.5 text-right text-xs uppercase tracking-wider">
                          Wadarta Guud (Total Filtered):
                        </td>
                        <td className="p-3.5 text-center font-mono text-sm text-cyan-300">
                          {filteredQty.toLocaleString()}
                        </td>
                        <td className="p-3.5 text-right font-mono text-sm text-cyan-300">
                          {formatCurrency(filteredRevenue, currency, rate)}
                        </td>
                        <td className="p-3.5 text-right font-mono text-sm text-slate-300">
                          {formatCurrency(filteredCost, currency, rate)}
                        </td>
                        <td className="p-3.5 text-right font-mono text-sm text-emerald-300">
                          +{formatCurrency(filteredProfit, currency, rate)}
                        </td>
                        <td className="p-3.5 text-center text-[10px] text-slate-400">
                          Margin: {filteredMargin.toFixed(1)}%
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>
          </div>
        );
      })()}

      {/* ==================== TAB 3: CUSTOMER DEBTS & LOANS HUB (DEYMAHA KALIYA AH) ==================== */}
      {activeCategoryTab === 'CUSTOMER_DEBTS' && (() => {
        // Timeframe filter check
        const isDebtTimeframeMatch = (timestamp: number) => {
          return isTimestampInTimeframe(timestamp, debtTimeframe, debtSingleDate, debtStartDate, debtEndDate);
        };

        const filteredDebtSales = financialStats.debtSalesList.filter(t => {
          if (!isDebtTimeframeMatch(t.timestamp)) return false;
          if (debtSearch.trim()) {
            const s = debtSearch.toLowerCase();
            const custName = (data.customers.find(c => c.id === t.customerId)?.name || '').toLowerCase();
            const idMatch = (t.id || '').toLowerCase().includes(s);
            const notesMatch = (t.notes || '').toLowerCase().includes(s);
            if (!custName.includes(s) && !idMatch && !notesMatch) return false;
          }
          return true;
        });

        const filteredCashLoans = financialStats.cashLoansList.filter(t => {
          if (!isDebtTimeframeMatch(t.timestamp)) return false;
          if (debtSearch.trim()) {
            const s = debtSearch.toLowerCase();
            const custName = (data.customers.find(c => c.id === t.customerId)?.name || '').toLowerCase();
            const idMatch = (t.id || '').toLowerCase().includes(s);
            const notesMatch = (t.notes || '').toLowerCase().includes(s);
            if (!custName.includes(s) && !idMatch && !notesMatch) return false;
          }
          return true;
        });

        const filteredDebtCollections = financialStats.debtPaymentsList.filter(t => {
          if (!isDebtTimeframeMatch(t.timestamp)) return false;
          if (debtSearch.trim()) {
            const s = debtSearch.toLowerCase();
            const custName = (data.customers.find(c => c.id === t.customerId)?.name || '').toLowerCase();
            const idMatch = (t.id || '').toLowerCase().includes(s);
            const notesMatch = (t.notes || '').toLowerCase().includes(s);
            if (!custName.includes(s) && !idMatch && !notesMatch) return false;
          }
          return true;
        });

        const filteredDebtorsList = financialStats.debtorCustomersList.filter(c => {
          if (debtSearch.trim()) {
            const s = debtSearch.toLowerCase();
            return c.name.toLowerCase().includes(s) || (c.phone || '').includes(s) || (c.address || '').toLowerCase().includes(s);
          }
          return true;
        });

        return (
          <div className="space-y-6 animate-in fade-in duration-200">
            {/* Header Hero Banner */}
            <div className="bg-gradient-to-br from-rose-950 via-rose-900 to-slate-900 text-white rounded-[32px] p-6 sm:p-8 shadow-xl border border-rose-900/40">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                  <span className="px-3.5 py-1.5 bg-rose-400/20 text-rose-200 border border-rose-400/30 rounded-full text-xs font-black uppercase tracking-wider mb-3 inline-flex items-center gap-1.5">
                    <ShieldAlert size={14} className="text-rose-400" /> Qaybta Deymaha & Amaahda Kaliya (Debts Hub)
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-white tracking-tight">
                    Kala Saarida & Xisaabinta Deymaha Kaliya ah
                  </h2>
                  <p className="text-xs sm:text-sm text-rose-100 font-medium mt-1.5 max-w-2xl leading-relaxed">
                    Bartaani waxay xisaabinaysaa dhammaan deynta dukaanka ka maqan (Accounts Receivable), iibka deynta lagu qaatay, amaahda caddaanka ah ee la siiyay dadka, iyo lacagaha deynta ah ee laga soo xareeyay.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <div className="bg-white/10 backdrop-blur-md px-5 py-3.5 rounded-2xl border border-white/15">
                    <span className="text-[10px] uppercase text-rose-200 font-black block tracking-wider">Deynta Maqan (Receivable)</span>
                    <span className="text-2xl font-black font-mono text-rose-300">
                      {formatCurrency(financialStats.accountsReceivable, currency, rate)}
                    </span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md px-5 py-3.5 rounded-2xl border border-white/15">
                    <span className="text-[10px] uppercase text-rose-200 font-black block tracking-wider">Deynta La Soo Celiyay</span>
                    <span className="text-2xl font-black font-mono text-emerald-300">
                      {formatCurrency(financialStats.totalDebtPaidIn, currency, rate)}
                    </span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md px-4 py-3.5 rounded-2xl border border-white/15 text-center">
                    <span className="text-[10px] uppercase text-rose-200 font-black block tracking-wider">Macaamiisha Deynta</span>
                    <span className="text-2xl font-black font-mono text-white">
                      {financialStats.debtorCustomersList.length} Qof
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* 4 Key Debt Metric Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Outstanding Debt */}
              <div className="bg-white p-5 rounded-3xl border border-rose-200 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-rose-600 tracking-wider">Deynta Dukaanka Lagu Leeyahay</span>
                  <div className="w-8 h-8 rounded-xl bg-rose-100 text-rose-700 flex items-center justify-center">
                    <CreditCard size={16} />
                  </div>
                </div>
                <p className="text-2xl font-black font-mono text-rose-700">
                  {formatCurrency(financialStats.accountsReceivable, currency, rate)}
                </p>
                <p className="text-xs text-slate-500 font-bold">Accounts Receivable ({financialStats.debtorCustomersList.length} Debtors)</p>
              </div>

              {/* Card 2: Debt Sales */}
              <div className="bg-white p-5 rounded-3xl border border-amber-200 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-amber-600 tracking-wider">Iibka Deynta ah (Debt Sales)</span>
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center">
                    <FileText size={16} />
                  </div>
                </div>
                <p className="text-2xl font-black font-mono text-amber-700">
                  {formatCurrency(financialStats.totalDebtSalesAmount, currency, rate)}
                </p>
                <p className="text-xs text-slate-500 font-bold">{financialStats.debtSalesList.length} Debt Sales Issued</p>
              </div>

              {/* Card 3: Cash Loans Out */}
              <div className="bg-white p-5 rounded-3xl border border-orange-200 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-orange-600 tracking-wider">Amaahda Caddaanka ah (Loans)</span>
                  <div className="w-8 h-8 rounded-xl bg-orange-100 text-orange-700 flex items-center justify-center">
                    <DollarSign size={16} />
                  </div>
                </div>
                <p className="text-2xl font-black font-mono text-orange-700">
                  {formatCurrency(financialStats.totalCashLoansOut, currency, rate)}
                </p>
                <p className="text-xs text-slate-500 font-bold">{financialStats.cashLoansList.length} Cash Loans Out</p>
              </div>

              {/* Card 4: Debt Repayments In */}
              <div className="bg-white p-5 rounded-3xl border border-emerald-200 shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider">Deymaha La Soo Bixiyay</span>
                  <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                    <CheckCircle2 size={16} />
                  </div>
                </div>
                <p className="text-2xl font-black font-mono text-emerald-700">
                  {formatCurrency(financialStats.totalDebtPaidIn, currency, rate)}
                </p>
                <p className="text-xs text-slate-500 font-bold">{financialStats.debtPaymentsList.length} Collections Received</p>
              </div>
            </div>

            {/* Filter & Sub-tabs Bar */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                {/* Debt Sub tabs */}
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setDebtSubTab('ALL')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                      debtSubTab === 'ALL'
                        ? 'bg-rose-900 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Dhammaan Dhaqdhaqaaqa Deymaha
                  </button>
                  <button
                    type="button"
                    onClick={() => setDebtSubTab('DEBT_SALES')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                      debtSubTab === 'DEBT_SALES'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    📝 Iibka Deynta ({financialStats.debtSalesList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDebtSubTab('CASH_LOANS')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                      debtSubTab === 'CASH_LOANS'
                        ? 'bg-orange-600 text-white shadow-sm'
                        : 'text-orange-800 hover:bg-orange-100'
                    }`}
                  >
                    💸 Amaahda Caddaanka ({financialStats.cashLoansList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDebtSubTab('COLLECTIONS')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                      debtSubTab === 'COLLECTIONS'
                        ? 'bg-emerald-600 text-white shadow-sm'
                        : 'text-emerald-800 hover:bg-emerald-100'
                    }`}
                  >
                    💰 Deymaha La Bixiyay ({financialStats.debtPaymentsList.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setDebtSubTab('DEBTORS_LIST')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                      debtSubTab === 'DEBTORS_LIST'
                        ? 'bg-rose-600 text-white shadow-sm'
                        : 'text-rose-800 hover:bg-rose-100'
                    }`}
                  >
                    <Users size={14} /> Liiska Macaamiisha ({financialStats.debtorCustomersList.length})
                  </button>
                </div>

                {/* Search */}
                <div className="relative min-w-[240px]">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Raadi Macmiil, Ref ID..."
                    value={debtSearch}
                    onChange={e => setDebtSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-rose-500 focus:bg-white outline-none transition-all"
                  />
                  {debtSearch && (
                    <button
                      onClick={() => setDebtSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Date Filter Bar */}
              <DateFilterBar
                timeframe={debtTimeframe}
                setTimeframe={setDebtTimeframe}
                singleDate={debtSingleDate}
                setSingleDate={setDebtSingleDate}
                startDate={debtStartDate}
                setStartDate={setDebtStartDate}
                endDate={debtEndDate}
                setEndDate={setDebtEndDate}
                themeColor="rose"
              />
            </div>

            {/* View 1: Debtors Summary List */}
            {debtSubTab === 'DEBTORS_LIST' ? (
              <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-6 space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                    <Users size={18} className="text-rose-600" /> Macaamiisha Deynta Lagu Leeyahay (Outstanding Debtors List)
                  </h3>
                  <span className="text-xs font-bold text-slate-500">
                    Wadarta: {filteredDebtorsList.length} Macmiil
                  </span>
                </div>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/90 border-b border-slate-200 font-black text-slate-700 uppercase tracking-wider text-[10px]">
                        <th className="p-3.5">#</th>
                        <th className="p-3.5">Magaca Macmiilka</th>
                        <th className="p-3.5">Telefoonka</th>
                        <th className="p-3.5">Address</th>
                        <th className="p-3.5 text-right">Deynta Ku Taala</th>
                        <th className="p-3.5 text-right">Amaano (Credit)</th>
                        <th className="p-3.5 text-center">Xaalada</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredDebtorsList.length === 0 ? (
                        <tr>
                          <td colSpan={7} className="p-8 text-center text-slate-400 font-bold">
                            Macaamiil deyn lagu leeyahay lama helin.
                          </td>
                        </tr>
                      ) : (
                        filteredDebtorsList.map((cust, idx) => (
                          <tr key={cust.id} className="hover:bg-rose-50/40 transition-colors">
                            <td className="p-3.5 font-bold text-slate-400">{idx + 1}</td>
                            <td className="p-3.5">
                              <span className="font-black text-slate-900 text-sm block">{cust.name}</span>
                              <span className="text-[10px] text-slate-400">ID: {cust.id}</span>
                            </td>
                            <td className="p-3.5 font-mono text-slate-600 font-bold">
                              {cust.phone || '-'}
                            </td>
                            <td className="p-3.5 text-slate-600">
                              {cust.address || '-'}
                            </td>
                            <td className="p-3.5 text-right font-mono font-black text-rose-700 text-sm">
                              {formatCurrency(cust.debtBalance || 0, currency, rate)}
                            </td>
                            <td className="p-3.5 text-right font-mono font-bold text-teal-700">
                              {cust.advanceBalance ? formatCurrency(cust.advanceBalance, currency, rate) : '-'}
                            </td>
                            <td className="p-3.5 text-center">
                              <span className="px-2.5 py-1 bg-rose-100 text-rose-800 rounded-full font-black text-[10px]">
                                Deyn Maqan
                              </span>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : (
              /* View 2: Combined or Filtered Debt Ledger */
              <div className="bg-white rounded-[32px] border border-slate-200 shadow-sm p-6 space-y-4">
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <CreditCard size={18} className="text-rose-600" />
                  Dhaqdhaqaaqa Deymaha (Debt Ledger Transactions)
                </h3>

                <div className="overflow-x-auto rounded-2xl border border-slate-200">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100/90 border-b border-slate-200 font-black text-slate-700 uppercase tracking-wider text-[10px]">
                        <th className="p-3.5"># Ref / Invoice</th>
                        <th className="p-3.5">Taariikhda</th>
                        <th className="p-3.5">Nooca Dhaqdhaqaaqa</th>
                        <th className="p-3.5">Macmiilka</th>
                        <th className="p-3.5">Faahfaahin / Sandaaqada</th>
                        <th className="p-3.5 text-right">Lacagta (Amount)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {/* Debt Repayments */}
                      {(debtSubTab === 'ALL' || debtSubTab === 'COLLECTIONS') &&
                        filteredDebtCollections.map(tx => (
                          <tr
                            key={tx.id}
                            className="hover:bg-emerald-50/40 cursor-pointer"
                            onDoubleClick={() => {
                              const targetAcc = data.accounts.find(a => a.id === tx.accountId) || data.accounts.find(a => a.id === 'acc-ar');
                              if (targetAcc) setSelectedStatementAcc(targetAcc);
                            }}
                          >
                            <td className="p-3.5 font-mono font-black text-emerald-600">
                              #PAY-{(tx.id || '').slice(-6).toUpperCase()}
                            </td>
                            <td className="p-3.5 text-slate-500 whitespace-nowrap">
                              {new Date(tx.timestamp).toLocaleString()}
                            </td>
                            <td className="p-3.5">
                              <span className="px-2.5 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-black inline-flex items-center gap-1">
                                <CheckCircle2 size={12} /> Deynta La Bixiyay (Repayment)
                              </span>
                            </td>
                            <td className="p-3.5 font-black text-slate-900">
                              {data.customers.find(c => c.id === tx.customerId)?.name || tx.customerId || 'Macmiil'}
                            </td>
                            <td className="p-3.5 text-slate-600 font-bold">
                              Lagu shubay: {tx.accountId ? (data.accounts.find(a => a.id === tx.accountId)?.name || tx.accountId) : (tx.paymentMethod || 'Cash')}
                            </td>
                            <td className="p-3.5 text-right font-mono font-black text-emerald-700 text-sm">
                              +{formatCurrency(tx.total, currency, rate)}
                            </td>
                          </tr>
                        ))}

                      {/* Cash Loans */}
                      {(debtSubTab === 'ALL' || debtSubTab === 'CASH_LOANS') &&
                        filteredCashLoans.map(tx => (
                          <tr
                            key={tx.id}
                            className="hover:bg-orange-50/40 cursor-pointer"
                            onDoubleClick={() => {
                              const targetAcc = data.accounts.find(a => a.id === tx.accountId) || data.accounts.find(a => a.id === 'acc-cash');
                              if (targetAcc) setSelectedStatementAcc(targetAcc);
                            }}
                          >
                            <td className="p-3.5 font-mono font-black text-orange-600">
                              #LOAN-{(tx.id || '').slice(-6).toUpperCase()}
                            </td>
                            <td className="p-3.5 text-slate-500 whitespace-nowrap">
                              {new Date(tx.timestamp).toLocaleString()}
                            </td>
                            <td className="p-3.5">
                              <span className="px-2.5 py-1 bg-orange-100 text-orange-800 rounded-lg text-[10px] font-black inline-flex items-center gap-1">
                                <DollarSign size={12} /> Amaah Cadaan Ah (Cash Loan)
                              </span>
                            </td>
                            <td className="p-3.5 font-black text-slate-900">
                              {data.customers.find(c => c.id === tx.customerId)?.name || tx.customerId || 'Macmiil'}
                            </td>
                            <td className="p-3.5 text-slate-600 font-bold">
                              Ka baxday: {tx.accountId ? (data.accounts.find(a => a.id === tx.accountId)?.name || tx.accountId) : 'Sandaaqada Caddaanka'}
                            </td>
                            <td className="p-3.5 text-right font-mono font-black text-orange-700 text-sm">
                              -{formatCurrency(tx.total, currency, rate)}
                            </td>
                          </tr>
                        ))}

                      {/* Debt Sales */}
                      {(debtSubTab === 'ALL' || debtSubTab === 'DEBT_SALES') &&
                        filteredDebtSales.map(tx => (
                          <tr
                            key={tx.id}
                            className="hover:bg-amber-50/40 cursor-pointer"
                            onDoubleClick={() => {
                              const targetAcc = data.accounts.find(a => a.id === 'acc-ar');
                              if (targetAcc) setSelectedStatementAcc(targetAcc);
                            }}
                          >
                            <td className="p-3.5 font-mono font-black text-amber-600">
                              #INV-{(tx.id || '').slice(-6).toUpperCase()}
                            </td>
                            <td className="p-3.5 text-slate-500 whitespace-nowrap">
                              {new Date(tx.timestamp).toLocaleString()}
                            </td>
                            <td className="p-3.5">
                              <span className="px-2.5 py-1 bg-amber-100 text-amber-800 rounded-lg text-[10px] font-black inline-flex items-center gap-1">
                                <FileText size={12} /> Iib Deyn Ah (Credit Sale)
                              </span>
                            </td>
                            <td className="p-3.5 font-black text-slate-900">
                              {data.customers.find(c => c.id === tx.customerId)?.name || (tx.notes?.includes('Customer:') ? tx.notes.split('Customer:')[1].split(',')[0].trim() : 'Macmiil')}
                            </td>
                            <td className="p-3.5 text-slate-600 font-bold">
                              {(tx.items || []).length} alaab &bull; {tx.paymentMethod}
                            </td>
                            <td className="p-3.5 text-right font-mono font-black text-amber-700 text-sm">
                              {formatCurrency(tx.debtAmount || tx.total, currency, rate)}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        );
      })()}

      {/* ==================== TAB 4: TRANSFERS & STOCK PURCHASES ==================== */}
      {activeCategoryTab === 'TRANSFERS_PURCHASES' && (() => {
        const filteredTransfers = financialStats.transfersList.filter(at => {
          if (!isTimestampInTimeframe(at.timestamp, tpTimeframe, tpSingleDate, tpStartDate, tpEndDate)) {
            return false;
          }
          if (tpSearch.trim()) {
            const s = tpSearch.toLowerCase();
            const fName = (at.fromAccountName || '').toLowerCase();
            const tName = (at.toAccountName || '').toLowerCase();
            const note = (at.note || '').toLowerCase();
            if (!fName.includes(s) && !tName.includes(s) && !note.includes(s)) return false;
          }
          return true;
        });

        const filteredStockPurchases = financialStats.stockPurchasesList.filter(sa => {
          if (!isTimestampInTimeframe(sa.timestamp, tpTimeframe, tpSingleDate, tpStartDate, tpEndDate)) {
            return false;
          }
          if (tpSearch.trim()) {
            const s = tpSearch.toLowerCase();
            const pName = (sa.productName || '').toLowerCase();
            const reason = (sa.reason || '').toLowerCase();
            const supp = (sa.supplierName || '').toLowerCase();
            if (!pName.includes(s) && !reason.includes(s) && !supp.includes(s)) return false;
          }
          return true;
        });

        const transfersVal = filteredTransfers.reduce((acc, t) => acc + t.amount, 0);
        const purchasesVal = filteredStockPurchases.reduce((acc, sa) => acc + (sa.cashPaid || sa.totalCost || 0), 0);

        return (
          <div className="space-y-6 animate-in fade-in duration-200">
            <div className="bg-gradient-to-br from-purple-900 via-purple-800 to-slate-900 text-white rounded-[32px] p-6 sm:p-8 shadow-xl">
              <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                <div>
                  <span className="px-3.5 py-1.5 bg-purple-400/20 text-purple-200 border border-purple-400/30 rounded-full text-xs font-black uppercase tracking-wider mb-3 inline-block">
                    📦 Inter-Account Transfers & Stock Purchases
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-black text-white">
                    Wareejinta Lacagaha & Iibsiga Stock-ga
                  </h2>
                  <p className="text-xs sm:text-sm text-purple-100 font-medium mt-1 max-w-2xl">
                    Bartaani waxay xisaabinaysaa dhammaan lacagaha isu-shubka ah ee accounts-ka dukaanka dhexmaray iyo lacagaha laga bixiyay iibsiga stock-ga cusub.
                  </p>
                </div>

                <div className="flex flex-wrap gap-3">
                  <div className="bg-white/10 backdrop-blur-md px-5 py-3.5 rounded-2xl border border-white/15">
                    <span className="text-[10px] uppercase text-purple-200 font-black block">Transfers Total</span>
                    <span className="text-2xl font-black font-mono text-purple-300">{formatCurrency(transfersVal, currency, rate)}</span>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md px-5 py-3.5 rounded-2xl border border-white/15">
                    <span className="text-[10px] uppercase text-purple-200 font-black block">Stock Purchases</span>
                    <span className="text-2xl font-black font-mono text-amber-300">{formatCurrency(purchasesVal, currency, rate)}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-5 space-y-4">
              <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4">
                {/* Sub-tabs */}
                <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1.5 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setTpSubTab('ALL')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                      tpSubTab === 'ALL'
                        ? 'bg-purple-900 text-white shadow-sm'
                        : 'text-slate-600 hover:bg-slate-200'
                    }`}
                  >
                    Dhammaan ({filteredTransfers.length + filteredStockPurchases.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTpSubTab('TRANSFERS')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                      tpSubTab === 'TRANSFERS'
                        ? 'bg-purple-600 text-white shadow-sm'
                        : 'text-purple-800 hover:bg-purple-100'
                    }`}
                  >
                    <ArrowRightLeft size={13} /> Isu-Shubka Lacagaha ({filteredTransfers.length})
                  </button>
                  <button
                    type="button"
                    onClick={() => setTpSubTab('STOCK_PURCHASES')}
                    className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                      tpSubTab === 'STOCK_PURCHASES'
                        ? 'bg-amber-600 text-white shadow-sm'
                        : 'text-amber-800 hover:bg-amber-100'
                    }`}
                  >
                    📦 Iibsiga Stock-ga ({filteredStockPurchases.length})
                  </button>
                </div>

                {/* Search */}
                <div className="relative min-w-[240px]">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Raadi Account, Alaab, Notes..."
                    value={tpSearch}
                    onChange={e => setTpSearch(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium focus:ring-2 focus:ring-purple-500 focus:bg-white outline-none transition-all"
                  />
                  {tpSearch && (
                    <button
                      onClick={() => setTpSearch('')}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Date Filter Bar */}
              <DateFilterBar
                timeframe={tpTimeframe}
                setTimeframe={setTpTimeframe}
                singleDate={tpSingleDate}
                setSingleDate={setTpSingleDate}
                startDate={tpStartDate}
                setStartDate={setTpStartDate}
                endDate={tpEndDate}
                setEndDate={setTpEndDate}
                themeColor="purple"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-3xl border border-purple-200 shadow-sm space-y-2">
                <span className="text-[10px] font-black uppercase text-purple-600 tracking-wider">Isu-Shubka Lacagaha (Transfers)</span>
                <p className="text-2xl font-black font-mono text-purple-700">{formatCurrency(transfersVal, currency, rate)}</p>
                <p className="text-xs text-slate-500 font-bold">{filteredTransfers.length} Account Transfers</p>
              </div>

              <div className="bg-white p-5 rounded-3xl border border-amber-200 shadow-sm space-y-2">
                <span className="text-[10px] font-black uppercase text-amber-600 tracking-wider">Iibsiga Stock-ga (Purchases)</span>
                <p className="text-2xl font-black font-mono text-amber-700">{formatCurrency(purchasesVal, currency, rate)}</p>
                <p className="text-xs text-slate-500 font-bold">{filteredStockPurchases.length} Stock Purchases</p>
              </div>
            </div>

            {/* Transfers History Table */}
            {(tpSubTab === 'ALL' || tpSubTab === 'TRANSFERS') && (
              <div className="bg-white rounded-[32px] border shadow-sm p-6 space-y-4">
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <ArrowRightLeft size={18} className="text-purple-600" /> Account Transfer History ({filteredTransfers.length})
                </h3>

                <div className="overflow-x-auto rounded-2xl border">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b font-black text-slate-700 uppercase">
                        <th className="p-3">Taariikhda</th>
                        <th className="p-3">From Account</th>
                        <th className="p-3">To Account</th>
                        <th className="p-3">Notes</th>
                        <th className="p-3 text-right">Lacagta (Amount)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredTransfers.length === 0 ? (
                        <tr>
                          <td colSpan={5} className="p-6 text-center text-slate-400 font-bold">
                            Wax wareejin lacageed ah lama helin muddadan.
                          </td>
                        </tr>
                      ) : (
                        filteredTransfers.map(at => (
                          <tr 
                            key={at.id} 
                            className="hover:bg-slate-50 cursor-pointer"
                            onDoubleClick={() => {
                              const targetAcc = data.accounts.find(a => a.id === at.fromAccountId);
                              if (targetAcc) setSelectedStatementAcc(targetAcc);
                            }}
                          >
                            <td className="p-3 text-slate-500">
                              {new Date(at.timestamp).toLocaleString()}
                            </td>
                            <td className="p-3 font-bold text-rose-600">
                              {at.fromAccountName}
                            </td>
                            <td className="p-3 font-bold text-emerald-600">
                              {at.toAccountName}
                            </td>
                            <td className="p-3 text-slate-600">
                              {at.note || 'Transfer'}
                            </td>
                            <td className="p-3 text-right font-mono font-black text-purple-700">
                              {formatCurrency(at.amount, currency, rate)}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Stock Purchases Table */}
            {(tpSubTab === 'ALL' || tpSubTab === 'STOCK_PURCHASES') && (
              <div className="bg-white rounded-[32px] border shadow-sm p-6 space-y-4">
                <h3 className="text-base font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <Package size={18} className="text-amber-600" /> Stock Purchases / Iibsiga Alaabta ({filteredStockPurchases.length})
                </h3>

                <div className="overflow-x-auto rounded-2xl border">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 border-b font-black text-slate-700 uppercase">
                        <th className="p-3">Taariikhda</th>
                        <th className="p-3">Alaabta (Product)</th>
                        <th className="p-3">Tirada (Qty)</th>
                        <th className="p-3">Supplier / Reason</th>
                        <th className="p-3">Account-ka Laga Bixiyay</th>
                        <th className="p-3 text-right">Lacagta (Total Cost)</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 font-medium">
                      {filteredStockPurchases.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="p-6 text-center text-slate-400 font-bold">
                            Wax iib stock ah lama helin muddadan.
                          </td>
                        </tr>
                      ) : (
                        filteredStockPurchases.map(sa => (
                          <tr key={sa.id} className="hover:bg-slate-50">
                            <td className="p-3 text-slate-500 whitespace-nowrap">
                              {new Date(sa.timestamp).toLocaleString()}
                            </td>
                            <td className="p-3 font-bold text-slate-900">
                              {sa.productName}
                            </td>
                            <td className="p-3 font-mono font-bold text-emerald-700">
                              +{sa.quantity}
                            </td>
                            <td className="p-3 text-slate-600">
                              {sa.supplierName || sa.reason || 'Stock Purchase'}
                            </td>
                            <td className="p-3 font-bold text-blue-600">
                              {sa.accountId ? (data.accounts.find(a => a.id === sa.accountId)?.name || sa.accountId) : 'Sandaaqada Caddaanka'}
                            </td>
                            <td className="p-3 text-right font-mono font-black text-amber-700">
                              {formatCurrency(sa.cashPaid || sa.totalCost || 0, currency, rate)}
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
      })()}

      {/* ==================== TAB 5: TRADITIONAL FINANCIAL STATEMENTS ==================== */}
      {activeCategoryTab === 'STATEMENTS' && (
        <div className="space-y-8 animate-in fade-in duration-200">
          <div className="hidden print:block text-center border-b-2 border-black pb-8 mb-8">
            <h1 className="text-4xl font-black uppercase tracking-tighter">{data.settings.businessName}</h1>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-2">Financial Performance Report • {new Date().toLocaleDateString()}</p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            {/* SECTION 1: INCOME STATEMENT */}
            <div className="bg-white p-10 rounded-[40px] border shadow-sm space-y-8 print:border-none print:shadow-none print:p-0">
              <div className="flex items-center gap-3 text-blue-600 print:text-black">
                <TrendingUp size={24} />
                <h2 className="text-xl font-black uppercase tracking-tight">Income Statement</h2>
              </div>

              <div className="space-y-6">
                 <div className="flex justify-between items-end border-b pb-4">
                    <span className="text-sm font-bold text-slate-500 uppercase">Gross Revenue (Sales)</span>
                    <span className="text-2xl font-black text-slate-900">{formatCurrency(financialStats.revenue, currency, rate)}</span>
                 </div>
                 <div className="flex justify-between items-end border-b pb-4">
                    <span className="text-sm font-bold text-slate-500 uppercase">Cost of Goods Sold (COGS)</span>
                    <span className="text-lg font-bold text-red-600">({formatCurrency(financialStats.cogs, currency, rate)})</span>
                 </div>
                 <div className="flex justify-between items-end bg-slate-50 p-4 rounded-2xl print:bg-transparent print:border-y print:rounded-none">
                    <span className="text-sm font-black text-slate-800 uppercase">Gross Profit</span>
                    <span className="text-2xl font-black text-blue-600 print:text-black">{formatCurrency(financialStats.grossProfit, currency, rate)}</span>
                 </div>
                 <div className="flex justify-between items-end border-b pb-4">
                    <span className="text-sm font-bold text-slate-500 uppercase">Operating Expenses</span>
                    <span className="text-lg font-bold text-red-600">({formatCurrency(financialStats.expenses, currency, rate)})</span>
                 </div>
                 <div className="flex justify-between items-end bg-slate-900 p-6 rounded-3xl text-white print:bg-black print:rounded-none">
                    <span className="text-sm font-black uppercase tracking-widest">Net Profit / Loss</span>
                    <span className="text-3xl font-black">{formatCurrency(financialStats.netProfit, currency, rate)}</span>
                 </div>
              </div>
            </div>

            {/* SECTION 2: BALANCE SHEET */}
            <div className="bg-white p-10 rounded-[40px] border shadow-sm space-y-8 print:border-none print:shadow-none print:p-0">
               <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3 text-slate-800">
                    <Scale size={24} />
                    <h2 className="text-xl font-black uppercase tracking-tight">Balance Sheet</h2>
                  </div>
                  <div className={`px-4 py-1.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-2 ${financialStats.isBalanced ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' : 'bg-rose-50 text-rose-600 border border-rose-100'}`}>
                     {financialStats.isBalanced ? <CheckCircle2 size={12}/> : <AlertTriangle size={12}/>}
                     {financialStats.isBalanced ? 'Balanced' : 'Imbalance Detected'}
                  </div>
               </div>

              <div className="space-y-8">
                 {/* ASSETS SECTION */}
                 <div className="space-y-4">
                    <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest border-b-2 border-slate-900 pb-2">Assets</p>
                    
                    {/* Current Assets */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase ml-2">Current Assets</p>
                      <div className="space-y-1.5 pl-4">
                        <div className="flex justify-between text-sm font-bold text-slate-600">
                           <span>Cash & Equivalents</span>
                           <span>{formatCurrency(financialStats.cashAndBankTotal, currency, rate)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold text-slate-600">
                           <span>Accounts Receivable</span>
                           <span>{formatCurrency(financialStats.accountsReceivable, currency, rate)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold text-slate-600">
                           <span>Inventory Asset</span>
                           <span>{formatCurrency(financialStats.inventoryValue, currency, rate)}</span>
                        </div>
                        {financialStats.otherCurrentAssetsTotal > 0 && (
                          <div className="flex justify-between text-sm font-bold text-slate-600">
                            <span>Other Current Assets</span>
                            <span>{formatCurrency(financialStats.otherCurrentAssetsTotal, currency, rate)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm font-black text-slate-800 pt-1 border-t border-slate-100">
                           <span className="italic">Total Current Assets</span>
                           <span>{formatCurrency(financialStats.totalCurrentAssets, currency, rate)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Fixed Assets */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase ml-2">Fixed Assets</p>
                      <div className="space-y-1.5 pl-4">
                        {financialStats.fixedAssetsAccounts.length > 0 ? (
                          financialStats.fixedAssetsAccounts.map(a => (
                            <div key={a.id} className="flex justify-between text-sm font-bold text-slate-600">
                               <span>{a.name}</span>
                               <span>{formatCurrency(a.balance, currency, rate)}</span>
                            </div>
                          ))
                        ) : (
                          <div className="flex justify-between text-sm font-bold text-slate-400 italic">
                            <span>No fixed assets recorded</span>
                            <span>{formatCurrency(0, currency, rate)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm font-black text-slate-800 pt-1 border-t border-slate-100">
                           <span className="italic">Total Fixed Assets</span>
                           <span>{formatCurrency(financialStats.totalFixedAssets, currency, rate)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center bg-slate-50 p-4 rounded-2xl print:bg-transparent print:border-y-2 print:border-black print:rounded-none mt-2">
                       <span className="text-sm font-black uppercase">Total Assets</span>
                       <span className="text-2xl font-black border-b-4 border-double border-slate-900">{formatCurrency(financialStats.totalAssets, currency, rate)}</span>
                    </div>
                 </div>

                 {/* LIABILITIES & EQUITY SECTION */}
                 <div className="space-y-4">
                    <p className="text-[11px] font-black text-slate-900 uppercase tracking-widest border-b-2 border-slate-900 pb-2">Liabilities & Equity</p>
                    
                    {/* Liabilities */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase ml-2">Liabilities</p>
                      <div className="space-y-1.5 pl-4">
                        <div className="flex justify-between text-sm font-bold text-slate-600">
                           <span>Accounts Payable (Suppliers)</span>
                           <span>{formatCurrency(financialStats.accountsPayable, currency, rate)}</span>
                        </div>
                        {financialStats.customerAdvancesTotal > 0 && (
                          <div className="flex justify-between text-sm font-bold text-emerald-700 bg-emerald-50/70 px-2 py-1 rounded-lg">
                             <span>Customer Advance Deposits (Amaanooyinka)</span>
                             <span className="font-black">{formatCurrency(financialStats.customerAdvancesTotal, currency, rate)}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm font-bold text-slate-600">
                           <span>Other Liabilities</span>
                           <span>{formatCurrency(financialStats.otherLiabilitiesTotal, currency, rate)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-black text-slate-800 pt-1 border-t border-slate-100">
                           <span className="italic">Total Liabilities</span>
                           <span>{formatCurrency(financialStats.totalLiabilities, currency, rate)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Equity */}
                    <div className="space-y-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase ml-2">Equity</p>
                      <div className="space-y-1.5 pl-4">
                        <div className="flex justify-between text-sm font-bold text-slate-600">
                           <span>Paid-in Capital</span>
                           <span>{formatCurrency(financialStats.paidInCapital, currency, rate)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-bold text-slate-600">
                           <span>Retained Earnings (Net Profit)</span>
                           <span>{formatCurrency(financialStats.retainedEarnings, currency, rate)}</span>
                        </div>
                        <div className="flex justify-between text-sm font-black text-slate-800 pt-1 border-t border-slate-100">
                           <span className="italic">Total Equity</span>
                           <span>{formatCurrency(financialStats.totalEquity, currency, rate)}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex justify-between items-center bg-blue-50 p-4 rounded-2xl border border-blue-100 print:bg-transparent print:border-y-2 print:border-black print:rounded-none">
                       <span className="text-sm font-black uppercase">Total Liabilities & Equity</span>
                       <span className="text-2xl font-black border-b-4 border-double border-blue-600 print:border-black">{formatCurrency(financialStats.totalLiabilities + financialStats.totalEquity, currency, rate)}</span>
                    </div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal for adding/editing ledger account */}
      {showAddAccount && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300 no-print">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300">
            <div className="p-8 bg-blue-600 text-white flex items-center justify-between">
              <div>
                <h3 className="text-2xl font-black tracking-tight">{editingAccount ? 'Edit Account' : 'New Account'}</h3>
                <p className="opacity-75 font-medium text-xs">Configure your chart of accounts</p>
              </div>
              <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Account Name</label>
                  <input type="text" className="w-full px-5 py-4 bg-slate-100 border-none rounded-2xl outline-none font-bold text-xs" placeholder="e.g. Bank Account 1" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Classification</label>
                  <select className="w-full px-5 py-4 bg-slate-100 border-none rounded-2xl outline-none font-bold text-xs" value={formData.type} onChange={e => setFormData({...formData, type: e.target.value as AccountType})}>
                    <option value={AccountType.ASSET}>Current Asset (Cash/Bank)</option>
                    <option value={AccountType.OTHER_CURRENT_ASSET}>Other Current Asset</option>
                    <option value={AccountType.FIXED_ASSET}>Fixed Asset (Equipment/Machinery)</option>
                    <option value={AccountType.EQUITY}>Equity (Capital)</option>
                    <option value={AccountType.LIABILITY}>Liability</option>
                    <option value={AccountType.REVENUE}>Revenue Account</option>
                    <option value={AccountType.EXPENSE}>Expense Account</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Opening Balance ({currency})</label>
                  <input type="number" className="w-full px-5 py-4 bg-slate-100 border-none rounded-2xl outline-none font-black text-xl" value={formData.balance || 0} onChange={e => setFormData({...formData, balance: parseFloat(e.target.value) || 0})} />
                </div>
              </div>

              <div className="flex gap-4 pt-4">
                <button onClick={closeModal} className="flex-1 py-4 font-black text-slate-400 text-xs">Cancel</button>
                <button onClick={handleSaveAccount} className="flex-[2] py-4 bg-blue-600 text-white rounded-3xl font-black text-sm shadow-xl shadow-blue-900/10">
                   {editingAccount ? 'Update Account' : 'Create Account'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <ConfirmModal
        isOpen={!!deleteConfirmAcc}
        title="Ma hubtaa? (Are you sure?)"
        message={`Ma hubtaa inaad tirtirto account-ka: "${deleteConfirmAcc?.name}"? Tallaabadan dib looma noqon karo.`}
        confirmText="Haa (Tirtir)"
        cancelText="Maya (Kansal)"
        onConfirm={() => {
          if (deleteConfirmAcc) {
            setData(prev => ({
              ...prev,
              accounts: prev.accounts.filter(a => a.id !== deleteConfirmAcc.id),
              deletedIds: { ...(prev.deletedIds || {}), [deleteConfirmAcc.id]: Date.now() },
              lastModified: Date.now()
            }));
            addLog('Account Deleted', `Removed ledger account: ${deleteConfirmAcc.name}`);
            setDeleteConfirmAcc(null);
          }
        }}
        onClose={() => setDeleteConfirmAcc(null)}
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

      {/* Supplier Debt Settlement Modal */}
      {showSupplierPayModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300 no-print">
          <div className="bg-white rounded-[36px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 bg-gradient-to-r from-rose-700 to-slate-900 text-white flex items-center justify-between">
              <div>
                <span className="px-3 py-1 bg-white/20 rounded-full text-[10px] font-black uppercase tracking-wider inline-block mb-1">
                  💳 Accounts Payable Settlement
                </span>
                <h3 className="text-xl font-black tracking-tight">Bixi Deynta Suppliers-ka</h3>
                <p className="text-xs text-rose-100 font-medium">Ka bixi deynta lagu leeyahay oo ka jar sandaaqada/cash-ka aad hayso</p>
              </div>
              <button 
                onClick={() => setShowSupplierPayModal(false)} 
                className="p-2 hover:bg-white/10 rounded-full transition-colors text-white"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {/* Select Supplier */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider">
                  1. Dooro Supplier-ka Deynta Lagu Leeyahay
                </label>
                <select 
                  className="w-full px-4 py-3.5 bg-slate-100 border border-slate-200 rounded-2xl outline-none font-bold text-xs"
                  value={paySupplierId}
                  onChange={e => {
                    const sid = e.target.value;
                    setPaySupplierId(sid);
                    const sel = data.suppliers.find(s => s.id === sid);
                    if (sel) setPayAmountVal(sel.balance);
                  }}
                >
                  <option value="">-- Dooro Supplier --</option>
                  {data.suppliers.map(s => (
                    <option key={s.id} value={s.id}>
                      {s.name} - (Deynta Lagu Leeyahay: {formatCurrency(s.balance, currency, rate)})
                    </option>
                  ))}
                </select>
              </div>

              {/* Select Source Treasury Account */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider">
                  2. Dooro Akoonka / Sandaaqada Lacagta Ka Baxayso
                </label>
                <select 
                  className="w-full px-4 py-3.5 bg-slate-100 border border-slate-200 rounded-2xl outline-none font-bold text-xs"
                  value={payAccId}
                  onChange={e => setPayAccId(e.target.value)}
                >
                  <option value="">-- Dooro Sandaaqada Cash-ka/Bank-ga --</option>
                  {data.accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type}) - [Balance: {formatCurrency(a.balance, currency, rate)}]
                    </option>
                  ))}
                </select>
              </div>

              {/* Amount */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider">
                  3. Xaddiga Lacagta Bixinayso ({currency})
                </label>
                <input 
                  type="number" 
                  min="0"
                  step="any"
                  className="w-full px-4 py-3.5 bg-rose-50 border border-rose-200 rounded-2xl outline-none font-black text-2xl text-rose-700"
                  value={payAmountVal || ''} 
                  onChange={e => setPayAmountVal(parseFloat(e.target.value) || 0)} 
                />
              </div>

              {/* Note */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-black text-slate-600 uppercase tracking-wider">
                  4. Faahfaahin Dheeraad Ah (Notes / Voucher Ref)
                </label>
                <input 
                  type="text" 
                  placeholder="E.g., Payment via Evc Plus / Cash voucher #104"
                  className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-2xl outline-none font-medium text-xs"
                  value={payNoteText} 
                  onChange={e => setPayNoteText(e.target.value)} 
                />
              </div>

              <div className="flex gap-3 pt-3 border-t">
                <button 
                  onClick={() => setShowSupplierPayModal(false)} 
                  className="flex-1 py-3.5 font-black text-slate-500 hover:bg-slate-100 rounded-2xl text-xs transition-colors"
                >
                  Kansal
                </button>
                <button 
                  onClick={handleAccountingSupplierPay} 
                  className="flex-[2] py-3.5 bg-rose-600 text-white rounded-2xl font-black text-xs shadow-lg shadow-rose-900/20 hover:bg-rose-700 transition-all flex items-center justify-center gap-2"
                >
                  <CreditCard size={16} /> Bixi Deynta & Ka Jar Cash-ka
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Accounting;

