
import React, { useState, useMemo } from 'react';
import { AppData, Currency, Customer, PaymentMethod, Transaction } from '../types';
import { formatCurrency, generateId, sendMonthlyDebtStatement } from '../lib/utils';
import { Users, Phone, Wallet, X, CheckCircle2, Banknote, CreditCard, Landmark, Smartphone, ArrowUpRight, ArrowDownLeft, PlusCircle, UserPlus, History, DollarSign, Search, FileText, Printer, Trash2, PiggyBank, Eye, ShoppingBag, ShoppingCart, Package, Plus, Minus, Calculator, MessageSquare, Calendar, Sparkles, Trophy, Crown, Medal, Award, ArrowUpDown, LayoutGrid, List, BarChart3, Percent, Flame, TrendingDown } from 'lucide-react';
import { Product } from '../types';
import ConfirmModal from './ConfirmModal';

interface Props {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  addLog: (action: string, details: string) => void;
  currency: Currency;
}

const getLocalDateTimeString = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
};

const DebtorsHub: React.FC<Props> = ({ data, setData, addLog, currency }) => {
  const rate = data.settings.exchangeRate;
  const [activeSubTab, setActiveSubTab] = useState<'DEBTORS' | 'CHECK_STATEMENT' | 'LOANS_HISTORY'>('DEBTORS');

  // Search state for Debtors Hub
  const [debtorSearchQuery, setDebtorSearchQuery] = useState<string>('');
  const [loansHistorySearch, setLoansHistorySearch] = useState<string>('');

  // Check Statement Tab State (Raadi & Fiiri Warqad Deynta)
  const [checkSearchInput, setCheckSearchInput] = useState<string>('');
  const [selectedStatementCustomer, setSelectedStatementCustomer] = useState<Customer | null>(null);
  const [statementItemFilter, setStatementItemFilter] = useState<string>('');
  const [statementCategoryFilter, setStatementCategoryFilter] = useState<'ALL' | 'SALES' | 'PAYMENTS' | 'LOANS'>('ALL');
  const [statementViewFormat, setStatementViewFormat] = useState<'RECEIPT' | 'TABLE'>('RECEIPT');

  // Statement / Tale-ka Modal
  const [statementCustomer, setStatementCustomer] = useState<Customer | null>(null);

  // Receive Payment Modal state
  const [selectedForPayment, setSelectedForPayment] = useState<Customer | null>(null);
  const [paymentAmount, setPaymentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [targetAccountId, setTargetAccountId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Currency toggle mode for payment modals ('ETB' or 'USD')
  const [payCurrency, setPayCurrency] = useState<'ETB' | 'USD'>('ETB');

  // Split Payment state for debt repayment
  const [isSplitPayment, setIsSplitPayment] = useState<boolean>(false);
  const [splitCash, setSplitCash] = useState<string>('');
  const [splitBank, setSplitBank] = useState<string>('');
  const [splitMobile, setSplitMobile] = useState<string>('');

  // Advance Deposit Modal state
  const [showAdvanceModal, setShowAdvanceModal] = useState(false);
  const [advanceCustomer, setAdvanceCustomer] = useState<Customer | null>(null);
  const [advanceCustomerId, setAdvanceCustomerId] = useState<string>('');
  const [advanceAmount, setAdvanceAmount] = useState<string>('');
  const [advanceAccountId, setAdvanceAccountId] = useState<string>('');
  const [advanceNote, setAdvanceNote] = useState<string>('');

  // Refund Customer Advance (Amaano Celin)
  const [showRefundModal, setShowRefundModal] = useState(false);
  const [refundCustomer, setRefundCustomer] = useState<Customer | null>(null);
  const [refundAmount, setRefundAmount] = useState<string>('');
  const [refundAccountId, setRefundAccountId] = useState<string>('');
  const [refundNote, setRefundNote] = useState<string>('');

  // Filter for debtors tab
  const [debtorFilterType, setDebtorFilterType] = useState<'ALL' | 'DEBT_ONLY' | 'ADVANCE_ONLY'>('ALL');

  // Issue Cash Loan Modal state with custom Date & Time
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [loanCustomerId, setLoanCustomerId] = useState<string>('');
  const [loanAmount, setLoanAmount] = useState<string>('');
  const [sourceAccountId, setSourceAccountId] = useState<string>('');
  const [loanNote, setLoanNote] = useState<string>('');
  const [loanDate, setLoanDate] = useState<string>(getLocalDateTimeString());
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [isNewCustomerMode, setIsNewCustomerMode] = useState<boolean>(false);
  const [newCustName, setNewCustName] = useState<string>('');
  const [newCustPhone, setNewCustPhone] = useState<string>('');

  // Issue Product Debt Modal state
  const [showProductLoanModal, setShowProductLoanModal] = useState(false);
  const [prodLoanCustomerId, setProdLoanCustomerId] = useState<string>('');
  const [prodLoanCart, setProdLoanCart] = useState<{ product: Product; quantity: number; price: number }[]>([]);
  const [prodSearch, setProdSearch] = useState<string>('');
  const [prodCustSearch, setProdCustSearch] = useState<string>('');
  const [isNewProdCustMode, setIsNewProdCustMode] = useState<boolean>(false);
  const [newProdCustName, setNewProdCustName] = useState<string>('');
  const [newProdCustPhone, setNewProdCustPhone] = useState<string>('');

  // Bulk WhatsApp Debt Reminders Modal
  const [showBulkWhatsAppModal, setShowBulkWhatsAppModal] = useState<boolean>(false);
  const [bulkFilter, setBulkFilter] = useState<string>('');

  // Delete Confirmation Modal
  const [deleteConfirm, setDeleteConfirm] = useState<{ title: string; message: string; onConfirm: () => void } | null>(null);

  // Sorting & View Mode for Debtors Dashboard
  const [debtorSortBy, setDebtorSortBy] = useState<'DEBT_DESC' | 'DEBT_ASC' | 'NAME' | 'RECENT'>('DEBT_DESC');
  const [debtorViewMode, setDebtorViewMode] = useState<'GRID' | 'TABLE'>('GRID');

  // Master ranking of all customers with active debt sorted descending (#1, #2, #3...)
  const allRankedDebtors = useMemo(() => {
    return [...data.customers]
      .filter(c => c.debtBalance > 0)
      .sort((a, b) => b.debtBalance - a.debtBalance);
  }, [data.customers]);

  // Fast map to get each customer's official rank # (e.g. 1 for top debtor, 2 for 2nd, etc.)
  const customerRankMap = useMemo(() => {
    const map = new Map<string, number>();
    allRankedDebtors.forEach((c, idx) => {
      map.set(c.id, idx + 1);
    });
    return map;
  }, [allRankedDebtors]);

  const debtors = useMemo(() => {
    return data.customers.filter(c => {
      if (debtorFilterType === 'DEBT_ONLY') return c.debtBalance > 0;
      if (debtorFilterType === 'ADVANCE_ONLY') return (c.advanceBalance && c.advanceBalance > 0);
      return c.debtBalance > 0 || (c.advanceBalance && c.advanceBalance > 0);
    });
  }, [data.customers, debtorFilterType]);

  const filteredDebtors = useMemo(() => {
    if (!debtorSearchQuery.trim()) return debtors;
    const q = debtorSearchQuery.toLowerCase().trim();
    return debtors.filter(c => {
      const matchName = (c.name || '').toLowerCase().includes(q);
      const matchPhone = (c.phone || '').toLowerCase().includes(q);
      const matchAddress = (c.address || '').toLowerCase().includes(q);
      const matchId = (c.id || '').toLowerCase().includes(q);
      return matchName || matchPhone || matchAddress || matchId;
    });
  }, [debtors, debtorSearchQuery]);

  // Final sorted list according to chosen sort method (default: highest debt first #1)
  const sortedAndFilteredDebtors = useMemo(() => {
    let list = [...filteredDebtors];
    if (debtorSortBy === 'DEBT_DESC') {
      list.sort((a, b) => {
        if (b.debtBalance !== a.debtBalance) return b.debtBalance - a.debtBalance;
        return (b.advanceBalance || 0) - (a.advanceBalance || 0);
      });
    } else if (debtorSortBy === 'DEBT_ASC') {
      list.sort((a, b) => {
        if (a.debtBalance !== b.debtBalance) return a.debtBalance - b.debtBalance;
        return (a.advanceBalance || 0) - (b.advanceBalance || 0);
      });
    } else if (debtorSortBy === 'NAME') {
      list.sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } else if (debtorSortBy === 'RECENT') {
      const getLatestTxTime = (cust: Customer) => {
        const txs = data.transactions.filter(t => t.customerId === cust.id);
        return txs.length > 0 ? Math.max(...txs.map(t => t.timestamp)) : 0;
      };
      list.sort((a, b) => getLatestTxTime(b) - getLatestTxTime(a));
    }
    return list;
  }, [filteredDebtors, debtorSortBy, data.transactions]);

  const totalCustomerAdvances = useMemo(() => {
    return data.customers.reduce((sum, c) => sum + (c.advanceBalance || 0), 0);
  }, [data.customers]);

  const totalCustomerDebts = useMemo(() => {
    return data.customers.reduce((sum, c) => sum + (c.debtBalance || 0), 0);
  }, [data.customers]);

  const activeDebtorsCount = useMemo(() => {
    return data.customers.filter(c => c.debtBalance > 0).length;
  }, [data.customers]);

  const topDebtor = useMemo(() => {
    return allRankedDebtors.length > 0 ? allRankedDebtors[0] : null;
  }, [allRankedDebtors]);

  const averageDebt = useMemo(() => {
    return activeDebtorsCount > 0 ? totalCustomerDebts / activeDebtorsCount : 0;
  }, [totalCustomerDebts, activeDebtorsCount]);

  const top3SharePct = useMemo(() => {
    if (totalCustomerDebts <= 0 || allRankedDebtors.length === 0) return 0;
    const top3Sum = allRankedDebtors.slice(0, 3).reduce((sum, c) => sum + c.debtBalance, 0);
    return Math.min(100, Math.round((top3Sum / totalCustomerDebts) * 100));
  }, [allRankedDebtors, totalCustomerDebts]);

  const cashLoans = useMemo(() => {
    return data.transactions
      .filter(t => t.type === 'CASH_LOAN')
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [data.transactions]);

  const filteredCashLoans = useMemo(() => {
    if (!loansHistorySearch.trim()) return cashLoans;
    const q = loansHistorySearch.toLowerCase().trim();
    return cashLoans.filter(loan => {
      const cust = data.customers.find(c => c.id === loan.customerId);
      const acc = data.accounts.find(a => a.id === loan.accountId);
      const custName = (cust?.name || loan.customerName || '').toLowerCase();
      const custPhone = (cust?.phone || loan.customerId || '').toLowerCase();
      const accName = (acc?.name || '').toLowerCase();
      const notes = (loan.notes || '').toLowerCase();
      const id = (loan.id || '').toLowerCase();
      const dateStr = new Date(loan.timestamp).toLocaleDateString().toLowerCase();
      const timeStr = new Date(loan.timestamp).toLocaleString().toLowerCase();
      return custName.includes(q) || custPhone.includes(q) || accName.includes(q) || notes.includes(q) || id.includes(q) || dateStr.includes(q) || timeStr.includes(q);
    });
  }, [cashLoans, loansHistorySearch, data.customers, data.accounts]);

  const totalCashLoansGiven = useMemo(() => {
    return cashLoans.reduce((sum, t) => sum + t.total, 0);
  }, [cashLoans]);

  const handleReceivePayment = () => {
    if (!selectedForPayment) return;

    // Helper to convert input value in chosen currency to base store currency
    const toBaseCurrency = (valStr: string) => {
      const parsed = parseFloat(valStr) || 0;
      if (payCurrency === 'ETB') {
        // Input is in ETB
        return (currency === Currency.USD) ? parsed / rate : parsed;
      } else {
        // Input is in USD
        return (currency === Currency.ETB) ? parsed * rate : parsed;
      }
    };

    let totalAmount = 0;
    let paymentDetailsObj: { cash: number; debt: number; bank: number; mobile: number } | undefined = undefined;

    if (isSplitPayment) {
      const cashVal = toBaseCurrency(splitCash);
      const bankVal = toBaseCurrency(splitBank);
      const mobileVal = toBaseCurrency(splitMobile);

      totalAmount = cashVal + bankVal + mobileVal;
      if (totalAmount <= 0) return alert("Fadlan geli xaddi sax ah ugu yaraan mid ka mid ah khaanadaha!");

      paymentDetailsObj = { cash: cashVal, debt: 0, bank: bankVal, mobile: mobileVal };
    } else {
      totalAmount = toBaseCurrency(paymentAmount);
      if (isNaN(totalAmount) || totalAmount <= 0) return alert("Fadlan geli xaddi sax ah!");
      if (!targetAccountId) return alert("Fadlan dooro akoonka lacagta la gelinayo.");
    }

    setIsProcessing(true);

    const txId = generateId();
    const currentDebt = selectedForPayment.debtBalance;
    let debtReduction = 0;
    let advanceAddition = 0;

    if (totalAmount <= currentDebt) {
      debtReduction = totalAmount;
    } else {
      debtReduction = currentDebt;
      advanceAddition = totalAmount - currentDebt;
    }

    const newDebtBalance = Math.max(0, currentDebt - debtReduction);

    const cashAcc = data.accounts.find(a => a.id === 'acc-cash' || a.name.toLowerCase().includes('cash')) || data.accounts[0];
    const bankAcc = data.accounts.find(a => a.id === 'acc-bank' || a.name.toLowerCase().includes('bank')) || data.accounts[1] || data.accounts[0];
    const mobileAcc = data.accounts.find(a => a.id === 'acc-mobile' || a.name.toLowerCase().includes('mobile')) || data.accounts[2] || data.accounts[0];

    const selectedAccId = targetAccountId || (paymentMethod === PaymentMethod.BANK ? bankAcc?.id : paymentMethod === PaymentMethod.MOBILE_MONEY ? mobileAcc?.id : cashAcc?.id) || 'acc-cash';

    const newTransaction: Transaction = {
      id: txId,
      items: [
        {
          id: `debt-pay-${txId}`,
          name: `Bixinta Deynta (${selectedForPayment.name})`,
          sku: 'DEBT_PAYMENT',
          barcode: '',
          costPrice: 0,
          sellPrice: totalAmount,
          stock: 1,
          category: 'Bixinta Deynta',
          quantity: 1
        }
      ],
      subtotal: totalAmount,
      tax: 0,
      total: totalAmount,
      currency: currency,
      exchangeRate: rate,
      paymentMethod: isSplitPayment ? PaymentMethod.PARTIAL : (paymentMethod || PaymentMethod.CASH),
      paymentDetails: paymentDetailsObj,
      accountId: isSplitPayment ? undefined : selectedAccId,
      customerId: selectedForPayment.id,
      customerName: selectedForPayment.name,
      timestamp: Date.now(),
      type: 'DEBT_PAYMENT',
      notes: `Bixiyay: ${formatCurrency(totalAmount, currency, rate)} | Deynta ku hartay: ${formatCurrency(newDebtBalance, currency, rate)}`
    };

    setData(prev => {
      let updatedAccounts = [...prev.accounts];

      if (isSplitPayment && paymentDetailsObj) {
        if (paymentDetailsObj.cash > 0 && cashAcc) {
          updatedAccounts = updatedAccounts.map(a => a.id === cashAcc.id ? { ...a, balance: a.balance + paymentDetailsObj.cash } : a);
        }
        if (paymentDetailsObj.bank > 0 && bankAcc) {
          updatedAccounts = updatedAccounts.map(a => a.id === bankAcc.id ? { ...a, balance: a.balance + paymentDetailsObj.bank } : a);
        }
        if (paymentDetailsObj.mobile > 0 && mobileAcc) {
          updatedAccounts = updatedAccounts.map(a => a.id === mobileAcc.id ? { ...a, balance: a.balance + paymentDetailsObj.mobile } : a);
        }
      } else {
        updatedAccounts = updatedAccounts.map(a => a.id === selectedAccId ? { ...a, balance: a.balance + totalAmount } : a);
      }

      return {
        ...prev,
        transactions: [newTransaction, ...prev.transactions],
        customers: prev.customers.map(c => 
          c.id === selectedForPayment.id 
            ? { 
                ...c, 
                debtBalance: newDebtBalance,
                advanceBalance: (c.advanceBalance || 0) + advanceAddition,
                history: [...c.history, txId]
              } 
            : c
        ),
        accounts: updatedAccounts
      };
    });

    addLog('Debt Payment', `Received ${formatCurrency(totalAmount, currency, rate)} from ${selectedForPayment.name}${isSplitPayment ? ' (Split Payment)' : ''}`);
    
    setIsProcessing(false);
    setSelectedForPayment(null);
    setPaymentAmount('');
    setSplitCash('');
    setSplitBank('');
    setSplitMobile('');
    setIsSplitPayment(false);
    setTargetAccountId('');
    alert("🎉 Dhaqaaqa lacag bixinta daynta waa la kaydiyay, akoonnada ku habboonna waa la cusboaysiiyay!");
  };

  const handleDepositAdvance = () => {
    let targetCust = advanceCustomer;
    if (!targetCust && advanceCustomerId) {
      targetCust = data.customers.find(c => c.id === advanceCustomerId) || null;
    }
    if (!targetCust) return alert("Fadlan dooro macaamiilka!");
    if (!advanceAccountId) return alert("Fadlan dooro akoonka lacagta la gelinayo.");
    
    const amount = parseFloat(advanceAmount);
    if (isNaN(amount) || amount <= 0) return alert("Fadlan geli xaddi sax ah");

    setIsProcessing(true);

    const txId = generateId();
    const newTransaction: Transaction = {
      id: txId,
      items: [{
        id: 'advance-deposit-item',
        name: `Lacag Hore / Deposit (${advanceNote || 'Advance Deposit'})`,
        sku: 'ADVANCE',
        barcode: '',
        costPrice: amount,
        sellPrice: amount,
        stock: 1,
        category: 'Deposit',
        quantity: 1
      }],
      subtotal: amount,
      tax: 0,
      total: amount,
      currency: currency,
      exchangeRate: rate,
      paymentMethod: PaymentMethod.CASH,
      accountId: advanceAccountId,
      customerId: targetCust.id,
      customerName: targetCust.name,
      timestamp: Date.now(),
      type: 'DEBT_PAYMENT',
      notes: `Lacag Hore / Amaano: ${advanceNote || 'Customer Advance Deposit'}`
    };

    const targetAccount = data.accounts.find(a => a.id === advanceAccountId);

    setData(prev => ({
      ...prev,
      transactions: [newTransaction, ...prev.transactions],
      customers: prev.customers.map(c => 
        c.id === targetCust!.id 
          ? { 
              ...c, 
              advanceBalance: (c.advanceBalance || 0) + amount,
              history: [...c.history, txId]
            } 
          : c
      ),
      accounts: prev.accounts.map(a => 
        a.id === advanceAccountId ? { ...a, balance: a.balance + amount } : a
      )
    }));

    addLog('Advance Deposit', `Customer ${targetCust.name} deposited ${formatCurrency(amount, currency, rate)} in advance. Deposited to ${targetAccount?.name}`);

    setIsProcessing(false);
    setShowAdvanceModal(false);
    setAdvanceCustomer(null);
    setAdvanceCustomerId('');
    setAdvanceAmount('');
    setAdvanceAccountId('');
    setAdvanceNote('');
    alert(`🎉 Lacagta hore (${formatCurrency(amount, currency, rate)}) ee ${targetCust.name} waa la kaydiyay, akoonkana waa lagu daray!`);
  };

  const handleRefundAdvance = () => {
    if (!refundCustomer) return;
    if (!refundAccountId) return alert("Fadlan dooro akoonka ay lacagtu ka baxayso!");
    
    const amount = parseFloat(refundAmount);
    if (isNaN(amount) || amount <= 0) return alert("Fadlan geli xaddi sax ah!");
    
    const currentAdv = refundCustomer.advanceBalance || 0;
    if (amount > currentAdv) {
      return alert(`Xaddiga aad celinayso (${formatCurrency(amount, currency, rate)}) wuxuu ka badan yahay lacagta u taalla macaamiilka (${formatCurrency(currentAdv, currency, rate)})!`);
    }

    setIsProcessing(true);

    const txId = generateId();
    const sourceAcc = data.accounts.find(a => a.id === refundAccountId);

    const refundTx: Transaction = {
      id: txId,
      items: [{
        id: 'advance-refund-item',
        name: `Celinta Lacag Hore / Amaano (${refundNote || 'Advance Refund'})`,
        sku: 'REFUND_ADV',
        barcode: '',
        costPrice: amount,
        sellPrice: amount,
        stock: 1,
        category: 'Refund',
        quantity: 1
      }],
      subtotal: amount,
      tax: 0,
      total: amount,
      currency: currency,
      exchangeRate: rate,
      paymentMethod: PaymentMethod.CASH,
      accountId: refundAccountId,
      customerId: refundCustomer.id,
      customerName: refundCustomer.name,
      timestamp: Date.now(),
      type: 'CASH_LOAN',
      notes: `Celinta Amaano: ${refundNote || 'Advance deposit refunded to customer'}`
    };

    setData(prev => ({
      ...prev,
      transactions: [refundTx, ...prev.transactions],
      customers: prev.customers.map(c => 
        c.id === refundCustomer.id 
          ? { 
              ...c, 
              advanceBalance: Math.max(0, (c.advanceBalance || 0) - amount),
              history: [...c.history, txId]
            } 
          : c
      ),
      accounts: prev.accounts.map(a => 
        a.id === refundAccountId ? { ...a, balance: a.balance - amount } : a
      )
    }));

    addLog('Advance Refunded', `Refunded ${formatCurrency(amount, currency, rate)} of advance deposit to ${refundCustomer.name} from ${sourceAcc?.name}`);

    setIsProcessing(false);
    setShowRefundModal(false);
    setRefundCustomer(null);
    setRefundAmount('');
    setRefundAccountId('');
    setRefundNote('');
    alert(`🎉 Lacagta amaanada ah (${formatCurrency(amount, currency, rate)}) ee ${refundCustomer.name} waa loo celiyay akoonka ${sourceAcc?.name} ayaana laga jaray!`);
  };

  const handleGiveCashLoan = () => {
    let targetCustId = loanCustomerId;

    if (isNewCustomerMode) {
      if (!newCustName || !newCustPhone) {
        return alert("Fadlan geli magaca iyo telka macaamiilka cusub!");
      }
      const existing = data.customers.find(c => c.phone === newCustPhone);
      if (existing) {
        targetCustId = existing.id;
      } else {
        const newC: Customer = {
          id: newCustPhone,
          name: newCustName,
          phone: newCustPhone,
          debtBalance: 0,
          advanceBalance: 0,
          loyaltyPoints: 0,
          history: []
        };
        targetCustId = newC.id;
        setData(prev => ({ ...prev, customers: [...prev.customers, newC] }));
      }
    }

    if (!targetCustId) return alert("Fadlan dooro ama ku dar macaamiilka daynta qaadanaya!");
    
    const amount = parseFloat(loanAmount);
    if (isNaN(amount) || amount <= 0) return alert("Fadlan geli xaddiga lacagta cadaanka ah ee daynta ahaan loo bixinayo!");

    if (!sourceAccountId) return alert("Fadlan dooro akoonka ay lacagtu ka baxayso (e.g. Cash Account)!");

    setIsProcessing(true);

    const txId = generateId();
    const cust = data.customers.find(c => c.id === targetCustId) || { name: newCustName, phone: newCustPhone };

    const loanTimestamp = loanDate ? new Date(loanDate).getTime() : Date.now();

    const loanTransaction: Transaction = {
      id: txId,
      items: [{
        id: 'cash-loan-item',
        name: `Dayn Lacag Cadaan ah (${loanNote || 'Cash Loan'})`,
        sku: 'LOAN',
        barcode: '',
        costPrice: amount,
        sellPrice: amount,
        stock: 1,
        category: 'Cash Loan',
        quantity: 1
      }],
      subtotal: amount,
      tax: 0,
      total: amount,
      currency: currency,
      exchangeRate: rate,
      paymentMethod: PaymentMethod.CASH,
      accountId: sourceAccountId,
      customerId: targetCustId,
      customerName: cust.name,
      timestamp: loanTimestamp,
      type: 'CASH_LOAN',
      notes: loanNote || `Lacag Cadaan Dayn ah oo loo bixiyay ${cust.name}`
    };

    const sourceAcc = data.accounts.find(a => a.id === sourceAccountId);

    setData(prev => ({
      ...prev,
      transactions: [loanTransaction, ...prev.transactions],
      customers: prev.customers.map(c => 
        c.id === targetCustId 
          ? { 
              ...c, 
              debtBalance: c.debtBalance + amount,
              history: [...c.history, txId]
            } 
          : c
      ),
      accounts: prev.accounts.map(a => 
        a.id === sourceAccountId ? { ...a, balance: a.balance - amount } : a
      )
    }));

    addLog('Cash Loan Issued', `Lacag Cadaan Dayn ah (${formatCurrency(amount, currency, rate)}) loo bixiyay ${cust.name}. Waxaa ka go'day akoonka ${sourceAcc?.name}`);

    setIsProcessing(false);
    setShowLoanModal(false);
    setLoanCustomerId('');
    setLoanAmount('');
    setSourceAccountId('');
    setLoanNote('');
    setLoanDate(getLocalDateTimeString());
    setIsNewCustomerMode(false);
    setNewCustName('');
    setNewCustPhone('');

    alert(`🎉 Waa la diiwaan geliyay! Macaamiilka ${cust.name} waxaa la siiyay dayn lacag cadaan ah oo dhan ${formatCurrency(amount, currency, rate)}, waxaana laga jaray akoonka ${sourceAcc?.name}.`);
  };

  const handleIssueProductLoan = () => {
    let targetCustId = prodLoanCustomerId;

    if (isNewProdCustMode) {
      if (!newProdCustName || !newProdCustPhone) {
        return alert("Fadlan geli magaca iyo telka macaamiilka!");
      }
      const existing = data.customers.find(c => c.phone === newProdCustPhone);
      if (existing) {
        targetCustId = existing.id;
      } else {
        const newC: Customer = {
          id: newProdCustPhone,
          name: newProdCustName,
          phone: newProdCustPhone,
          debtBalance: 0,
          advanceBalance: 0,
          loyaltyPoints: 0,
          history: []
        };
        targetCustId = newC.id;
        setData(prev => ({ ...prev, customers: [...prev.customers, newC] }));
      }
    }

    if (!targetCustId) return alert("Fadlan dooro ama ku dar macaamiilka alaabta deynta ku qaadanaya!");
    if (prodLoanCart.length === 0) return alert("Fadlan ugu yaraan 1 alaab ah ku dar khaanada!");

    // Validate that each product has sufficient stock
    for (const item of prodLoanCart) {
      const liveProd = data.products.find(p => p.id === item.product.id);
      const availableStock = liveProd ? liveProd.stock : 0;
      if (!liveProd || item.quantity > availableStock) {
        alert(`⚠️ Lama siin karo deyn sheygan "${item.product.name}" sababtoo ah kuuma yaalo stock ku filan!\nStock-ga yaala: ${availableStock}\nWaxaad rabtaa inaad bixiso: ${item.quantity}`);
        return;
      }
    }

    const totalAmount = prodLoanCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const cust = data.customers.find(c => c.id === targetCustId) || { name: newProdCustName, phone: newProdCustPhone };

    setIsProcessing(true);
    const txId = generateId();

    const itemsForTx = prodLoanCart.map(i => ({
      id: i.product.id,
      name: i.product.name,
      sku: i.product.sku || 'DEBT-ITEM',
      barcode: i.product.barcode || '',
      costPrice: i.product.costPrice || 0,
      sellPrice: i.price,
      stock: i.product.stock,
      category: i.product.category || 'General',
      quantity: i.quantity
    }));

    const saleTransaction: Transaction = {
      id: txId,
      items: itemsForTx,
      subtotal: totalAmount,
      tax: 0,
      total: totalAmount,
      currency: currency,
      exchangeRate: rate,
      paymentMethod: PaymentMethod.DEBT,
      customerId: targetCustId,
      customerName: cust.name,
      timestamp: Date.now(),
      type: 'SALE',
      notes: `Iibka alaabta deynta ah (${prodLoanCart.length} walxood)`
    };

    // Update product stock and customer debt
    setData(prev => {
      const updatedProducts = prev.products.map(p => {
        const cartItem = prodLoanCart.find(ci => ci.product.id === p.id);
        if (cartItem) {
          return { ...p, stock: Math.max(0, p.stock - cartItem.quantity) };
        }
        return p;
      });

      const updatedCustomers = prev.customers.map(c => {
        if (c.id === targetCustId) {
          return {
            ...c,
            debtBalance: c.debtBalance + totalAmount,
            history: [...c.history, txId]
          };
        }
        return c;
      });

      return {
        ...prev,
        products: updatedProducts,
        customers: updatedCustomers,
        transactions: [saleTransaction, ...prev.transactions]
      };
    });

    addLog('Product Debt Issued', `Alaab deyn ah oo dhan ${formatCurrency(totalAmount, currency, rate)} loo siiyay ${cust.name}`);

    setIsProcessing(false);
    setShowProductLoanModal(false);
    setProdLoanCustomerId('');
    setProdLoanCart([]);
    setProdSearch('');
    setIsNewProdCustMode(false);
    setNewProdCustName('');
    setNewProdCustPhone('');

    alert(`🎉 Waa la diiwaan geliyay! Macaamiilka ${cust.name} waxaa deyn alaab ah looga qray ${formatCurrency(totalAmount, currency, rate)}.`);
  };

  const handleDeleteTransaction = (tx: Transaction) => {
    setDeleteConfirm({
      title: "Ma hubtaa inaad tirtirto? (Confirm Delete)",
      message: `Ma hubtaa inaad tirtirto diiwaankan ($${tx.total})? Tallaabadan dib looma noqon karo.`,
      onConfirm: () => {
        setData(prev => {
          let updatedAccounts = [...prev.accounts];
          let updatedCustomers = [...prev.customers];

          // Revert financial changes based on transaction type
          if (tx.type === 'CASH_LOAN') {
            // Refund the loan back to the source account
            if (tx.accountId) {
              updatedAccounts = updatedAccounts.map(a => a.id === tx.accountId ? { ...a, balance: a.balance + tx.total } : a);
            }
            // Reduce customer debt
            updatedCustomers = updatedCustomers.map(c => c.id === tx.customerId ? { ...c, debtBalance: Math.max(0, c.debtBalance - tx.total) } : c);
          } else if (tx.type === 'DEBT_PAYMENT') {
            // Deduct the received payment back from target account
            if (tx.accountId) {
              updatedAccounts = updatedAccounts.map(a => a.id === tx.accountId ? { ...a, balance: Math.max(0, a.balance - tx.total) } : a);
            }
            // Increase customer debt back
            updatedCustomers = updatedCustomers.map(c => c.id === tx.customerId ? { ...c, debtBalance: c.debtBalance + tx.total } : c);
          } else {
            // Standard sale
            updatedCustomers = updatedCustomers.map(c => {
              if (c.id === tx.customerId) {
                const debtToRevert = tx.paymentMethod === PaymentMethod.DEBT ? tx.total : 0;
                return { ...c, debtBalance: Math.max(0, c.debtBalance - debtToRevert) };
              }
              return c;
            });
          }

          const binItem = {
            id: generateId(),
            type: 'TRANSACTION' as const,
            deletedAt: Date.now(),
            title: `Tx #${tx.id.slice(-5).toUpperCase()} ($${(tx.total || 0).toFixed(2)})`,
            description: `Type: ${tx.type || 'SALE'} • Payment: ${tx.paymentMethod || 'N/A'} • Customer: ${tx.customerName || 'N/A'}`,
            originalData: tx
          };
          const updatedDeletedIds = { ...(prev.deletedIds || {}) };
          updatedDeletedIds[tx.id] = Date.now();

          return {
            ...prev,
            transactions: prev.transactions.filter(t => t.id !== tx.id),
            accounts: updatedAccounts,
            customers: updatedCustomers,
            recycleBin: [binItem, ...(prev.recycleBin || [])],
            deletedIds: updatedDeletedIds,
            lastModified: Date.now()
          };
        });

        addLog('Deleted Transaction', `Removed debt transaction record: #${tx.id.slice(-5)}`);
        setDeleteConfirm(null);
      }
    });
  };

  const filteredCustomersForLoan = useMemo(() => {
    if (!customerSearch) return data.customers;
    const term = customerSearch.toLowerCase();
    return data.customers.filter(c => c.name.toLowerCase().includes(term) || c.phone.includes(term));
  }, [data.customers, customerSearch]);

  // Customer Statement Helper Data
  const customerTransactions = useMemo(() => {
    if (!statementCustomer) return [];
    return data.transactions
      .filter(t => t.customerId === statementCustomer.id)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [data.transactions, statementCustomer]);

  return (
    <div className="p-4 md:p-8 relative min-h-full space-y-8 no-print">
      {/* Top Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <Wallet className="text-blue-600" size={32} />
            Maamulka Daymaha, Tale-ka & Cash Loans
          </h1>
          <p className="text-slate-500 font-medium text-sm mt-1">
            Guji (Double-click) macaamiilka si aad u aragto alaabta uu deynta ku qaatay iyo Tale-kiisa kala nidaamsan.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <button
            onClick={() => {
              setShowProductLoanModal(true);
              setProdLoanCart([]);
              setProdSearch('');
            }}
            className="px-5 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-900/20 flex items-center gap-2 active:scale-95 transition-all"
          >
            <ShoppingBag size={18} />
            🛒 Sii Alaab Deynta
          </button>

          <button
            onClick={() => {
              setShowLoanModal(true);
              const defaultCashAcc = data.accounts.find(a => a.name.toLowerCase().includes('cash'))?.id || data.accounts[0]?.id || '';
              setSourceAccountId(defaultCashAcc);
            }}
            className="px-5 py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-emerald-900/20 flex items-center gap-2 active:scale-95 transition-all"
          >
            <PlusCircle size={18} />
            💵 Sii Dayn Cash ah
          </button>

          <button
            onClick={() => setShowBulkWhatsAppModal(true)}
            className="px-5 py-3.5 bg-amber-600 hover:bg-amber-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-amber-900/20 flex items-center gap-2 active:scale-95 transition-all"
            title="U dir dhammaan deylayaasha farriin faahfaahsan oo WhatsApp ah"
          >
            <MessageSquare size={18} />
            📢 U Dir Dhammaan Deylayaasha
          </button>

          <button
            onClick={() => {
              setAdvanceCustomer(null);
              setAdvanceCustomerId('');
              setShowAdvanceModal(true);
              const defaultCashAcc = data.accounts.find(a => a.name.toLowerCase().includes('cash'))?.id || data.accounts[0]?.id || '';
              setAdvanceAccountId(defaultCashAcc);
            }}
            className="px-5 py-3.5 bg-teal-600 hover:bg-teal-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-teal-900/20 flex items-center gap-2 active:scale-95 transition-all"
          >
            <PiggyBank size={18} />
            📥 Qabo Amaano / Deposit
          </button>

          <div className="bg-amber-500 text-white px-5 py-2.5 rounded-2xl shadow-md flex flex-col justify-center">
            <span className="text-[9px] font-black uppercase tracking-widest opacity-90">Kullama Daymaha</span>
            <span className="text-base font-black">{formatCurrency(totalCustomerDebts, currency, rate)}</span>
          </div>

          <div className="bg-emerald-600 text-white px-5 py-2.5 rounded-2xl shadow-md flex flex-col justify-center">
            <span className="text-[9px] font-black uppercase tracking-widest opacity-90">Amaanooyinka (Credits)</span>
            <span className="text-base font-black">{formatCurrency(totalCustomerAdvances, currency, rate)}</span>
          </div>
        </div>
      </div>

      {/* Sub Tabs */}
      <div className="flex border-b border-slate-200 gap-3 md:gap-6 overflow-x-auto pb-1 scrollbar-hide">
        <button
          onClick={() => setActiveSubTab('DEBTORS')}
          className={`pb-4 text-sm font-black transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${activeSubTab === 'DEBTORS' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          <Users size={18} />
          Macaamiisha Daynta Ku Leedahay ({debtors.length})
        </button>

        <button
          onClick={() => {
            setActiveSubTab('CHECK_STATEMENT');
            if (!selectedStatementCustomer && debtors.length > 0) {
              setSelectedStatementCustomer(debtors[0]);
            }
          }}
          className={`pb-4 text-sm font-black transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${activeSubTab === 'CHECK_STATEMENT' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          <FileText size={18} />
          🔍 Baadh & Daabac Warqad Deynta (Statement Hub)
        </button>

        <button
          onClick={() => setActiveSubTab('LOANS_HISTORY')}
          className={`pb-4 text-sm font-black transition-all flex items-center gap-2 border-b-2 whitespace-nowrap ${activeSubTab === 'LOANS_HISTORY' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}
        >
          <History size={18} />
          Diiwaanka Daynta Cadaan-ka ah ({cashLoans.length})
        </button>
      </div>

      {/* Tab 1: Debtors List & Ranking Dashboard */}
      {activeSubTab === 'DEBTORS' && (
        <div className="space-y-6">
          {/* Top Ranking & Metrics Dashboard */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Metric 1: Total Debt */}
            <div className="bg-gradient-to-br from-amber-500 to-amber-600 text-white p-5 rounded-3xl shadow-lg shadow-amber-500/20 relative overflow-hidden flex flex-col justify-between">
              <div className="flex items-center justify-between opacity-90 mb-2">
                <span className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5">
                  <Wallet size={15} />
                  Kullama Daymaha Guud
                </span>
                <span className="bg-white/20 backdrop-blur-sm px-2.5 py-0.5 rounded-full text-[10px] font-black">
                  {activeDebtorsCount} Deylayaal
                </span>
              </div>
              <div>
                <h3 className="text-2xl lg:text-3xl font-black tracking-tight">
                  {formatCurrency(totalCustomerDebts, currency, rate)}
                </h3>
                <p className="text-[11px] opacity-85 mt-1 font-bold">
                  Wadarta deynta taalla suuqa
                </p>
              </div>
            </div>

            {/* Metric 2: Top #1 Debtor Spotlight */}
            <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-indigo-950 text-white p-5 rounded-3xl shadow-lg shadow-slate-900/20 relative overflow-hidden flex flex-col justify-between border border-slate-700/50">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-black uppercase tracking-wider text-yellow-400 flex items-center gap-1.5">
                  <Crown size={15} className="text-yellow-400" />
                  #1 Ugu Deynta Badan
                </span>
                {topDebtor && (
                  <span className="bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 px-2 py-0.5 rounded-full text-[10px] font-black">
                    {totalCustomerDebts > 0 ? `${Math.round((topDebtor.debtBalance / totalCustomerDebts) * 100)}% deynta` : '0%'}
                  </span>
                )}
              </div>
              {topDebtor ? (
                <div>
                  <h4 className="text-lg font-black tracking-tight truncate text-white flex items-center gap-1.5">
                    🥇 {topDebtor.name}
                  </h4>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-sm font-black text-amber-300">
                      {formatCurrency(topDebtor.debtBalance, currency, rate)}
                    </span>
                    <span className="text-[11px] text-slate-400 font-bold">
                      {topDebtor.phone}
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-sm font-bold text-slate-400">Ma jiraan deylayaal</p>
              )}
            </div>

            {/* Metric 3: Average Debt & Top Concentration */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 text-slate-600">
                  <BarChart3 size={15} className="text-blue-600" />
                  Celceliska Deynta
                </span>
                <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full">
                  Top 3 = {top3SharePct}%
                </span>
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-800 tracking-tight">
                  {formatCurrency(averageDebt, currency, rate)}
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 font-bold flex items-center gap-1">
                  <Percent size={12} className="text-indigo-600" />
                  Celcelis ahaan qofkiiba
                </p>
              </div>
            </div>

            {/* Metric 4: Advance Credits (Amaanooyinka) */}
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm flex flex-col justify-between">
              <div className="flex items-center justify-between text-slate-500 mb-2">
                <span className="text-[11px] font-black uppercase tracking-wider flex items-center gap-1.5 text-emerald-700">
                  <PiggyBank size={15} className="text-emerald-600" />
                  Amaanooyinka (Credits)
                </span>
                <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                  {data.customers.filter(c => (c.advanceBalance || 0) > 0).length} Macmiil
                </span>
              </div>
              <div>
                <h3 className="text-2xl font-black text-emerald-600 tracking-tight">
                  {formatCurrency(totalCustomerAdvances, currency, rate)}
                </h3>
                <p className="text-[11px] text-slate-500 mt-1 font-bold">
                  Lacagaha hore ee macmiishu dhigteen
                </p>
              </div>
            </div>
          </div>

          {/* Top 5 Debtors Podium / Leaderboard Strip (When active debtors exist) */}
          {allRankedDebtors.length > 0 && !debtorSearchQuery.trim() && debtorFilterType !== 'ADVANCE_ONLY' && (
            <div className="bg-white p-5 rounded-3xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-black">
                    <Trophy size={16} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-slate-800">
                      Kala Horreynta Deylayaasha Ugu Waaweyn (Top Debtors Leaderboard)
                    </h3>
                    <p className="text-[11px] font-bold text-slate-400">
                      Macaamiisha ugu deynta badan oo lambaraysan siday u kala sarreeyaan
                    </p>
                  </div>
                </div>
                <span className="text-xs font-black text-amber-600 bg-amber-50 border border-amber-200 px-3 py-1 rounded-xl flex items-center gap-1">
                  <Flame size={14} /> Top {Math.min(5, allRankedDebtors.length)} Priority
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3 pt-2">
                {allRankedDebtors.slice(0, 5).map((debtor, idx) => {
                  const rankNum = idx + 1;
                  const sharePct = totalCustomerDebts > 0 ? ((debtor.debtBalance / totalCustomerDebts) * 100).toFixed(1) : '0';
                  const isGold = rankNum === 1;
                  const isSilver = rankNum === 2;
                  const isBronze = rankNum === 3;

                  return (
                    <div
                      key={debtor.id}
                      onClick={() => setStatementCustomer(debtor)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer hover:shadow-md relative flex flex-col justify-between ${
                        isGold
                          ? 'bg-gradient-to-b from-amber-50/80 to-yellow-50/40 border-amber-300'
                          : isSilver
                          ? 'bg-gradient-to-b from-slate-50 to-slate-100/60 border-slate-300'
                          : isBronze
                          ? 'bg-gradient-to-b from-orange-50/60 to-amber-50/30 border-orange-200'
                          : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-1 mb-2">
                        <span
                          className={`px-2 py-0.5 rounded-lg text-[10px] font-black flex items-center gap-1 shadow-2xs ${
                            isGold
                              ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950'
                              : isSilver
                              ? 'bg-gradient-to-r from-slate-400 to-slate-300 text-slate-900'
                              : isBronze
                              ? 'bg-gradient-to-r from-amber-700 to-amber-600 text-white'
                              : 'bg-slate-800 text-white'
                          }`}
                        >
                          {isGold && <Crown size={11} />}
                          {isSilver && <Medal size={11} />}
                          {isBronze && <Award size={11} />}
                          #{rankNum}
                        </span>
                        <span className="text-[10px] font-black text-slate-500">
                          {sharePct}% wadarta
                        </span>
                      </div>

                      <div>
                        <h4 className="font-black text-xs text-slate-800 truncate" title={debtor.name}>
                          {debtor.name}
                        </h4>
                        <p className="text-[10px] font-bold text-slate-400 truncate mt-0.5">
                          {debtor.phone}
                        </p>
                      </div>

                      <div className="mt-2 pt-2 border-t border-slate-200/60 flex items-center justify-between">
                        <span className="text-xs font-black text-amber-700">
                          {formatCurrency(debtor.debtBalance, currency, rate)}
                        </span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedForPayment(debtor);
                            setPaymentAmount(debtor.debtBalance.toString());
                            const defaultAcc = data.accounts.find(a => a.name.toLowerCase().includes('cash'))?.id || '';
                            setTargetAccountId(defaultAcc);
                          }}
                          className="px-2 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black active:scale-95 transition-all shadow-2xs"
                        >
                          Bixi
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Main Search, Sort & Filter Control Bar */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex flex-col md:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Raadi Macaamiilka Daynta (Magaca, Nambarka Telka, ID ama Address)..."
                  value={debtorSearchQuery}
                  onChange={e => setDebtorSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-10 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all placeholder:text-slate-400"
                />
                {debtorSearchQuery && (
                  <button
                    onClick={() => setDebtorSearchQuery('')}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition-colors"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>

              {/* View Mode Toggle: Grid Cards vs Table View */}
              <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
                <div className="inline-flex bg-slate-100 p-1 rounded-2xl border border-slate-200">
                  <button
                    onClick={() => setDebtorViewMode('GRID')}
                    className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                      debtorViewMode === 'GRID'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="Muuqaalka Kaadhadhka (Grid View)"
                  >
                    <LayoutGrid size={15} />
                    Kaadhadh
                  </button>
                  <button
                    onClick={() => setDebtorViewMode('TABLE')}
                    className={`px-3 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                      debtorViewMode === 'TABLE'
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                    title="Muuqaalka Shaxda Lambaraysan (Ranked Table View)"
                  >
                    <List size={15} />
                    Shax Lambaraysan
                  </button>
                </div>

                {debtorSearchQuery.trim() && (
                  <div className="px-3.5 py-2 bg-blue-50 text-blue-700 rounded-xl text-xs font-black whitespace-nowrap border border-blue-100 flex items-center gap-1.5">
                    <Sparkles size={14} />
                    La helay: {sortedAndFilteredDebtors.length}
                  </div>
                )}
              </div>
            </div>

            {/* Filter pills & Sort Selector */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setDebtorFilterType('ALL')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${debtorFilterType === 'ALL' ? 'bg-slate-900 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                >
                  Dhammaan ({data.customers.filter(c => c.debtBalance > 0 || (c.advanceBalance && c.advanceBalance > 0)).length})
                </button>
                <button
                  onClick={() => setDebtorFilterType('DEBT_ONLY')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${debtorFilterType === 'DEBT_ONLY' ? 'bg-amber-500 text-white shadow-sm' : 'bg-amber-50 text-amber-700 hover:bg-amber-100 border border-amber-200/60'}`}
                >
                  Dayn Lagu Leeyahay ({data.customers.filter(c => c.debtBalance > 0).length})
                </button>
                <button
                  onClick={() => setDebtorFilterType('ADVANCE_ONLY')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${debtorFilterType === 'ADVANCE_ONLY' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100 border border-emerald-200/60'}`}
                >
                  Amaano / Deposit Ku Leh ({data.customers.filter(c => (c.advanceBalance || 0) > 0).length})
                </button>
              </div>

              {/* Sort Selector */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-black text-slate-400 flex items-center gap-1">
                  <ArrowUpDown size={13} />
                  Kala Horreysii:
                </span>
                <select
                  value={debtorSortBy}
                  onChange={(e) => setDebtorSortBy(e.target.value as any)}
                  className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="DEBT_DESC">👑 Ugu Deynta Badan (#1 Hore)</option>
                  <option value="DEBT_ASC">📉 Ugu Deynta Yar</option>
                  <option value="NAME">🔤 Magaca (A - Z)</option>
                  <option value="RECENT">⏱️ Dhaqdhaqaaqii Ugu Dambeeyay</option>
                </select>
              </div>
            </div>
          </div>

          {/* VIEW MODE 1: GRID CARDS VIEW WITH RANKING BADGES */}
          {debtorViewMode === 'GRID' && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {sortedAndFilteredDebtors.map((debtor) => {
                const rankNum = customerRankMap.get(debtor.id);
                const hasDebt = debtor.debtBalance > 0;
                const isGold = rankNum === 1;
                const isSilver = rankNum === 2;
                const isBronze = rankNum === 3;
                const debtSharePct = totalCustomerDebts > 0 && hasDebt
                  ? Math.round((debtor.debtBalance / totalCustomerDebts) * 100)
                  : 0;

                return (
                  <div 
                    key={debtor.id} 
                    onDoubleClick={() => setStatementCustomer(debtor)}
                    className={`bg-white rounded-3xl border shadow-sm overflow-hidden flex flex-col group hover:shadow-xl transition-all duration-300 cursor-pointer relative ${
                      isGold
                        ? 'border-amber-300 ring-2 ring-amber-400/20'
                        : isSilver
                        ? 'border-slate-300'
                        : isBronze
                        ? 'border-orange-200'
                        : 'border-slate-200/80'
                    }`}
                  >
                    {/* Top Ranking Badge Header */}
                    <div className="p-6 flex items-center gap-4 bg-slate-50 border-b relative">
                      {rankNum !== undefined && hasDebt && (
                        <div className="absolute top-3 right-3 flex items-center gap-1.5">
                          <span
                            className={`px-3 py-1 rounded-full text-xs font-black flex items-center gap-1 shadow-sm ${
                              isGold
                                ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 ring-2 ring-yellow-300'
                                : isSilver
                                ? 'bg-gradient-to-r from-slate-300 to-slate-400 text-slate-900 ring-2 ring-slate-200'
                                : isBronze
                                ? 'bg-gradient-to-r from-amber-700 to-amber-600 text-white ring-2 ring-amber-500'
                                : 'bg-slate-900 text-white'
                            }`}
                            title={`Kaalinta #${rankNum} ee deynta ugu badan`}
                          >
                            {isGold && <Crown size={13} className="text-slate-950" />}
                            {isSilver && <Medal size={13} />}
                            {isBronze && <Award size={13} />}
                            #{rankNum} {isGold ? 'Kaalinta 1aad 🥇' : isSilver ? 'Kaalinta 2aad 🥈' : isBronze ? 'Kaalinta 3aad 🥉' : ''}
                          </span>
                        </div>
                      )}

                      <div className="w-14 h-14 rounded-2xl bg-white border overflow-hidden flex-shrink-0 flex items-center justify-center shadow-sm">
                        {debtor.photo ? (
                          <img src={debtor.photo} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full bg-slate-100 flex items-center justify-center text-slate-400 font-black text-lg">
                            {debtor.name ? debtor.name.charAt(0).toUpperCase() : <Users size={24} />}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 pr-14">
                        <h3 className="font-black text-slate-800 tracking-tight leading-tight">{debtor.name}</h3>
                        <p className="flex items-center gap-1 text-xs text-slate-500 font-bold mt-1">
                          <Phone size={10} />
                          {debtor.phone}
                        </p>
                        <p className="text-[9px] text-blue-600 font-bold mt-1 uppercase tracking-wider flex items-center gap-1">
                          <Eye size={10} /> Double-click for Tale Statement
                        </p>
                      </div>
                    </div>
                    
                    <div className="p-6 flex-1 space-y-4">
                      {/* Debt Share Progress Bar (if customer owes debt) */}
                      {hasDebt && totalCustomerDebts > 0 && (
                        <div className="space-y-1">
                          <div className="flex items-center justify-between text-[10px] font-black">
                            <span className="text-slate-500">Saamiga Deynta Guud:</span>
                            <span className="text-amber-700 font-bold">{debtSharePct}% ee deynta suuqa</span>
                          </div>
                          <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${
                                isGold
                                  ? 'bg-amber-500'
                                  : isSilver
                                  ? 'bg-slate-600'
                                  : isBronze
                                  ? 'bg-orange-500'
                                  : 'bg-indigo-600'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(4, debtSharePct))}%` }}
                            />
                          </div>
                        </div>
                      )}

                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-amber-50 p-4 rounded-2xl border border-amber-100 group-hover:bg-amber-100/80 transition-colors">
                          <p className="text-[9px] font-black text-amber-600 uppercase tracking-widest mb-1">Daynta Ku Taala</p>
                          <h4 className="text-2xl font-black text-amber-700">{formatCurrency(debtor.debtBalance, currency, rate)}</h4>
                        </div>

                        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 transition-colors">
                          <p className="text-[9px] font-black text-emerald-600 uppercase tracking-widest mb-1">Lacag Hore / Deposit</p>
                          <h4 className="text-2xl font-black text-emerald-700">{formatCurrency(debtor.advanceBalance || 0, currency, rate)}</h4>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedForPayment(debtor);
                            setPaymentAmount(debtor.debtBalance.toString());
                            const defaultAcc = data.accounts.find(a => a.name.toLowerCase().includes('cash'))?.id || '';
                            setTargetAccountId(defaultAcc);
                          }}
                          className="py-2.5 bg-blue-600 text-white rounded-xl font-black text-[11px] flex items-center justify-center gap-1 shadow-sm hover:bg-blue-700 active:scale-95 transition-all"
                        >
                          <ArrowDownLeft size={14} />
                          Bixi / Qaabo
                        </button>

                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setProdLoanCustomerId(debtor.id);
                            setShowProductLoanModal(true);
                            setProdLoanCart([]);
                          }}
                          className="py-2.5 bg-indigo-600 text-white rounded-xl font-black text-[11px] flex items-center justify-center gap-1 shadow-sm hover:bg-indigo-700 active:scale-95 transition-all"
                        >
                          <ShoppingBag size={14} />
                          Sii Alaab
                        </button>

                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setLoanCustomerId(debtor.id);
                            setLoanDate(getLocalDateTimeString());
                            setShowLoanModal(true);
                            const defaultCashAcc = data.accounts.find(a => a.name.toLowerCase().includes('cash'))?.id || '';
                            setSourceAccountId(defaultCashAcc);
                          }}
                          className="py-2.5 bg-emerald-600 text-white rounded-xl font-black text-[11px] flex items-center justify-center gap-1 shadow-sm hover:bg-emerald-700 active:scale-95 transition-all"
                        >
                          <PlusCircle size={14} />
                          Sii Cash
                        </button>

                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setAdvanceCustomer(debtor);
                            setAdvanceCustomerId(debtor.id);
                            setShowAdvanceModal(true);
                            const defaultCashAcc = data.accounts.find(a => a.name.toLowerCase().includes('cash'))?.id || '';
                            setAdvanceAccountId(defaultCashAcc);
                          }}
                          className="py-2.5 bg-teal-600 text-white rounded-xl font-black text-[11px] flex items-center justify-center gap-1 shadow-sm hover:bg-teal-700 active:scale-95 transition-all"
                        >
                          <PiggyBank size={14} />
                          📥 Amaano
                        </button>

                        {(debtor.advanceBalance || 0) > 0 && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setRefundCustomer(debtor);
                              setRefundAmount((debtor.advanceBalance || 0).toString());
                              setShowRefundModal(true);
                              const defaultCashAcc = data.accounts.find(a => a.name.toLowerCase().includes('cash'))?.id || '';
                              setRefundAccountId(defaultCashAcc);
                            }}
                            className="py-2.5 bg-rose-600 text-white rounded-xl font-black text-[11px] flex items-center justify-center gap-1 shadow-sm hover:bg-rose-700 active:scale-95 transition-all col-span-2"
                          >
                            <ArrowUpRight size={14} />
                            📤 Celi Amaanada ({formatCurrency(debtor.advanceBalance || 0, currency, rate)})
                          </button>
                        )}

                        {debtor.debtBalance > 0 && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              sendMonthlyDebtStatement(debtor, data, currency, rate, true);
                            }}
                            className="py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl font-black text-[11px] flex items-center justify-center gap-1 border border-emerald-200 transition-all col-span-2 shadow-xs"
                            title="U dir Macaamiilka faahfaahinta alaabta iyo deynta ee WhatsApp"
                          >
                            <MessageSquare size={14} className="text-emerald-600" />
                            💬 U Dir WhatsApp (Faahfaahsan)
                          </button>
                        )}

                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setStatementCustomer(debtor);
                          }}
                          className="py-2.5 bg-slate-800 text-white hover:bg-slate-900 rounded-xl font-black text-[11px] flex items-center justify-center gap-1 transition-all col-span-2"
                        >
                          <FileText size={14} />
                          Tale Statement
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {sortedAndFilteredDebtors.length === 0 && (
                <div className="col-span-full py-20 text-center flex flex-col items-center justify-center bg-white rounded-[32px] border-2 border-dashed border-slate-200">
                  <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mb-4 text-slate-400">
                    <Search size={32} />
                  </div>
                  <p className="text-slate-800 font-black text-lg">
                    {debtorSearchQuery.trim() ? `Lama helin macaamiil u dhigma raadinta "${debtorSearchQuery}"` : 'Ma jiraan Macaamiil Dayn ama Amaano leh'}
                  </p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm">
                    {debtorSearchQuery.trim() ? 'Hubi higgaadda magaca ama nambarka taleefanka oo dib u tijaabi.' : 'Damaanad kasta waa la bixiyay! Waxaad macaamiilka siin kartaa Dayn Lacag Cadaan ah ama aad ka qaban kartaa Lacag Hore (Deposit).'}
                  </p>
                  {debtorSearchQuery.trim() && (
                    <button
                      onClick={() => setDebtorSearchQuery('')}
                      className="mt-4 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black transition-all"
                    >
                      Nadiifi Raadinta (Clear Search)
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* VIEW MODE 2: RANKED LEADERBOARD TABLE VIEW */}
          {debtorViewMode === 'TABLE' && (
            <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-[11px] font-black uppercase tracking-wider text-slate-500">
                      <th className="py-4 px-4 text-center w-16"># Kaalinta</th>
                      <th className="py-4 px-4">Macaamiilka & Telefoonka</th>
                      <th className="py-4 px-4 text-right">Deynta Taalla</th>
                      <th className="py-4 px-4 text-center w-36">% Saamiga</th>
                      <th className="py-4 px-4 text-right">Amaano / Deposit</th>
                      <th className="py-4 px-4 text-center">Dalabyada</th>
                      <th className="py-4 px-4 text-center">Tallaabooyinka Degdegga ah</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                    {sortedAndFilteredDebtors.map((debtor) => {
                      const rankNum = customerRankMap.get(debtor.id);
                      const hasDebt = debtor.debtBalance > 0;
                      const isGold = rankNum === 1;
                      const isSilver = rankNum === 2;
                      const isBronze = rankNum === 3;
                      const debtSharePct = totalCustomerDebts > 0 && hasDebt
                        ? ((debtor.debtBalance / totalCustomerDebts) * 100).toFixed(1)
                        : '0';

                      return (
                        <tr
                          key={debtor.id}
                          onClick={() => setStatementCustomer(debtor)}
                          className="hover:bg-slate-50/80 transition-colors cursor-pointer group"
                        >
                          {/* Rank # */}
                          <td className="py-3.5 px-4 text-center">
                            {rankNum !== undefined && hasDebt ? (
                              <span
                                className={`inline-flex items-center justify-center font-black rounded-xl px-2.5 py-1 text-xs shadow-2xs ${
                                  isGold
                                    ? 'bg-gradient-to-r from-amber-500 to-yellow-400 text-slate-950 ring-2 ring-yellow-300 font-black'
                                    : isSilver
                                    ? 'bg-gradient-to-r from-slate-300 to-slate-400 text-slate-900 font-black'
                                    : isBronze
                                    ? 'bg-gradient-to-r from-amber-700 to-amber-600 text-white font-black'
                                    : 'bg-slate-100 text-slate-800'
                                }`}
                              >
                                {isGold && <Crown size={12} className="mr-0.5 text-slate-950" />}
                                #{rankNum}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-bold">-</span>
                            )}
                          </td>

                          {/* Customer Name & Phone */}
                          <td className="py-3.5 px-4">
                            <div className="flex items-center gap-3">
                              <div className="w-10 h-10 rounded-xl bg-slate-100 border overflow-hidden flex-shrink-0 flex items-center justify-center font-black text-slate-600">
                                {debtor.photo ? (
                                  <img src={debtor.photo} className="w-full h-full object-cover" />
                                ) : (
                                  debtor.name ? debtor.name.charAt(0).toUpperCase() : 'M'
                                )}
                              </div>
                              <div>
                                <p className="font-black text-slate-900 text-sm group-hover:text-blue-600 transition-colors">
                                  {debtor.name}
                                </p>
                                <p className="text-[11px] text-slate-400 font-bold flex items-center gap-1">
                                  <Phone size={10} />
                                  {debtor.phone}
                                </p>
                              </div>
                            </div>
                          </td>

                          {/* Debt Balance */}
                          <td className="py-3.5 px-4 text-right">
                            <span className="font-black text-amber-700 text-sm bg-amber-50 px-2.5 py-1 rounded-xl border border-amber-100">
                              {formatCurrency(debtor.debtBalance, currency, rate)}
                            </span>
                          </td>

                          {/* Debt Share Progress */}
                          <td className="py-3.5 px-4 text-center">
                            {hasDebt && totalCustomerDebts > 0 ? (
                              <div className="space-y-1">
                                <span className="text-[11px] font-black text-slate-600">{debtSharePct}%</span>
                                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full ${
                                      isGold ? 'bg-amber-500' : isSilver ? 'bg-slate-600' : isBronze ? 'bg-orange-500' : 'bg-indigo-600'
                                    }`}
                                    style={{ width: `${Math.min(100, Math.max(5, parseFloat(debtSharePct)))}%` }}
                                  />
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 text-[11px]">0%</span>
                            )}
                          </td>

                          {/* Advance Balance */}
                          <td className="py-3.5 px-4 text-right">
                            {(debtor.advanceBalance || 0) > 0 ? (
                              <span className="font-black text-emerald-700 text-xs bg-emerald-50 px-2.5 py-1 rounded-xl border border-emerald-100">
                                {formatCurrency(debtor.advanceBalance || 0, currency, rate)}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-xs">$0.00</span>
                            )}
                          </td>

                          {/* Orders Count */}
                          <td className="py-3.5 px-4 text-center">
                            <span className="text-xs font-black text-slate-700 bg-slate-100 px-2.5 py-1 rounded-lg">
                              {(debtor.history || []).length} biil
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="py-3.5 px-4" onClick={(e) => e.stopPropagation()}>
                            <div className="flex items-center justify-center gap-1.5 flex-wrap">
                              <button
                                onClick={() => {
                                  setSelectedForPayment(debtor);
                                  setPaymentAmount(debtor.debtBalance.toString());
                                  const defaultAcc = data.accounts.find(a => a.name.toLowerCase().includes('cash'))?.id || '';
                                  setTargetAccountId(defaultAcc);
                                }}
                                className="px-2.5 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-black active:scale-95 transition-all shadow-2xs flex items-center gap-1"
                                title="Bixi Deynta"
                              >
                                <ArrowDownLeft size={12} /> Bixi
                              </button>

                              <button
                                onClick={() => {
                                  setProdLoanCustomerId(debtor.id);
                                  setShowProductLoanModal(true);
                                  setProdLoanCart([]);
                                }}
                                className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-[10px] font-black active:scale-95 transition-all shadow-2xs flex items-center gap-1"
                                title="Sii Alaab Deynta"
                              >
                                <ShoppingBag size={12} /> Alaab
                              </button>

                              <button
                                onClick={() => {
                                  setLoanCustomerId(debtor.id);
                                  setLoanDate(getLocalDateTimeString());
                                  setShowLoanModal(true);
                                  const defaultCashAcc = data.accounts.find(a => a.name.toLowerCase().includes('cash'))?.id || '';
                                  setSourceAccountId(defaultCashAcc);
                                }}
                                className="px-2.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-black active:scale-95 transition-all shadow-2xs flex items-center gap-1"
                                title="Sii Dayn Cash ah"
                              >
                                <PlusCircle size={12} /> Cash
                              </button>

                              {debtor.debtBalance > 0 && (
                                <button
                                  onClick={() => sendMonthlyDebtStatement(debtor, data, currency, rate, true)}
                                  className="px-2.5 py-1.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-lg text-[10px] font-black border border-emerald-200 transition-all flex items-center gap-1"
                                  title="U dir WhatsApp"
                                >
                                  <MessageSquare size={12} /> WhatsApp
                                </button>
                              )}

                              <button
                                onClick={() => setStatementCustomer(debtor)}
                                className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded-lg text-[10px] font-black transition-all flex items-center gap-1"
                                title="Fiiri Tale Statement"
                              >
                                <FileText size={12} /> Tale
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}

                    {sortedAndFilteredDebtors.length === 0 && (
                      <tr>
                        <td colSpan={7} className="py-12 text-center text-slate-400 font-bold">
                          Ma jiraan xog u dhiganta raadintaada.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: CHECK_STATEMENT (Raadi & Fiiri Warqad Deynta oo Nidaamsan) */}
      {activeSubTab === 'CHECK_STATEMENT' && (
        <div className="space-y-6">
          {/* Top Search & Customer Selection Box */}
          <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4 print:hidden">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-800 tracking-tight flex items-center gap-2">
                  <Search className="text-blue-600" size={20} />
                  Baadh & Soo Saari Warqad Deynta / Adeegyada (Customer Statement Sheet)
                </h3>
                <p className="text-xs text-slate-500 font-bold mt-0.5">
                  Geli magaca macaamiilka si aad u hesho warqad xisaab-xidh oo aad u qurux badan oo ay ku qoran yihiin dhammaan adeegyada, taariikhaha, comments-ka, iyo deynta.
                </p>
              </div>

              {selectedStatementCustomer && (
                <div className="flex flex-wrap items-center gap-2">
                  {/* View Mode Toggle: Warqad Yar (Receipt) vs Warqad Balaadhan (Table) */}
                  <div className="inline-flex bg-slate-100 p-1 rounded-xl border border-slate-200">
                    <button
                      onClick={() => setStatementViewFormat('RECEIPT')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                        statementViewFormat === 'RECEIPT'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      🧾 Warqad Yar (Receipt)
                    </button>
                    <button
                      onClick={() => setStatementViewFormat('TABLE')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5 ${
                        statementViewFormat === 'TABLE'
                          ? 'bg-white text-slate-900 shadow-sm'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      📄 Warqad Balaadhan
                    </button>
                  </div>

                  <button
                    onClick={() => sendMonthlyDebtStatement(selectedStatementCustomer, data, currency, rate, true)}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                    title="U Dir WhatsApp faahfaahinta adeegyada iyo alaabta oo dhan"
                  >
                    <MessageSquare size={14} /> 💬 WhatsApp (Faahfaahsan)
                  </button>

                  <button
                    onClick={() => sendMonthlyDebtStatement(selectedStatementCustomer, data, currency, rate, false)}
                    className="px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                    title="U Dir Total Lacagta WhatsApp (Kooban)"
                  >
                    💬 WhatsApp (Kooban)
                  </button>

                  <button
                    onClick={() => window.print()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm active:scale-95"
                  >
                    <Printer size={14} /> 🖨️ Daabac Warqadda
                  </button>
                </div>
              )}
            </div>

            {/* Live Search Input */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type="text"
                placeholder="🔎 Qor magaca macaamiilka, taleefankiisa, ama ID..."
                value={checkSearchInput}
                onChange={e => setCheckSearchInput(e.target.value)}
                className="w-full pl-12 pr-10 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-sm text-slate-800 focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all placeholder:text-slate-400"
              />
              {checkSearchInput && (
                <button
                  onClick={() => setCheckSearchInput('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1.5 rounded-full hover:bg-slate-200 transition-colors"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* Quick Customer Selection Horizontal Scroller / Pills */}
            <div className="space-y-1.5">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider">
                Xulo Macaamiil ({data.customers.filter(c => c.debtBalance > 0).length} deylayaal ah):
              </span>
              <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide">
                {data.customers
                  .filter(c => {
                    if (!checkSearchInput.trim()) return true;
                    const q = checkSearchInput.toLowerCase().trim();
                    return (c.name || '').toLowerCase().includes(q) || (c.phone || '').toLowerCase().includes(q);
                  })
                  .slice(0, 15)
                  .map(cust => {
                    const isSelected = selectedStatementCustomer?.id === cust.id;
                    return (
                      <button
                        key={cust.id}
                        onClick={() => setSelectedStatementCustomer(cust)}
                        className={`px-3.5 py-2 rounded-xl text-xs font-black transition-all flex items-center gap-2 whitespace-nowrap border ${
                          isSelected
                            ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/30'
                            : cust.debtBalance > 0
                            ? 'bg-amber-50 text-amber-900 border-amber-200 hover:bg-amber-100'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        <span>{cust.name}</span>
                        {cust.debtBalance > 0 ? (
                          <span className={`px-1.5 py-0.5 rounded-md text-[10px] font-black ${
                            isSelected ? 'bg-white/20 text-white' : 'bg-amber-200 text-amber-900'
                          }`}>
                            ${cust.debtBalance.toFixed(2)}
                          </span>
                        ) : (
                          <span className="text-[10px] opacity-75">Nadiif</span>
                        )}
                      </button>
                    );
                  })}
              </div>
            </div>
          </div>

          {/* Statement Document View (Warqadda Rasmiga ah) */}
          {selectedStatementCustomer ? (
            (() => {
              const cust = selectedStatementCustomer;
              const allTxs = data.transactions
                .filter(t => t.customerId === cust.id)
                .sort((a, b) => a.timestamp - b.timestamp);

              // Calculate overall totals
              let totalDebtAdded = 0;
              let totalPaid = 0;
              let runningBal = 0;

              const ledgerRows = allTxs.map(tx => {
                const isCreditSale = tx.paymentMethod === PaymentMethod.DEBT || tx.paymentMethod === PaymentMethod.PARTIAL;
                const isPayment = tx.type === 'DEBT_PAYMENT';
                const isCashLoan = tx.type === 'CASH_LOAN';

                let debt = 0;
                let paid = 0;

                if (isCashLoan) {
                  debt = tx.total;
                  runningBal += debt;
                  totalDebtAdded += debt;
                } else if (isPayment) {
                  paid = tx.total;
                  runningBal = Math.max(0, runningBal - paid);
                  totalPaid += paid;
                } else if (isCreditSale) {
                  debt = tx.paymentMethod === PaymentMethod.DEBT ? tx.total : (tx.paymentDetails?.debt || tx.total);
                  runningBal += debt;
                  totalDebtAdded += debt;
                }

                return {
                  ...tx,
                  isCreditSale,
                  isPayment,
                  isCashLoan,
                  debt,
                  paid,
                  balanceAfter: runningBal
                };
              });

              // Apply inner filters
              const filteredLedger = ledgerRows.filter(row => {
                // Category Filter
                if (statementCategoryFilter === 'SALES' && !row.isCreditSale) return false;
                if (statementCategoryFilter === 'PAYMENTS' && !row.isPayment) return false;
                if (statementCategoryFilter === 'LOANS' && !row.isCashLoan) return false;

                // Item & Comment Search Query
                if (statementItemFilter.trim()) {
                  const q = statementItemFilter.toLowerCase().trim();
                  const noteMatch = (row.notes || '').toLowerCase().includes(q);
                  const itemsMatch = row.items?.some(it => it.name.toLowerCase().includes(q));
                  const dateMatch = new Date(row.timestamp).toLocaleDateString().includes(q);
                  return noteMatch || itemsMatch || dateMatch;
                }
                return true;
              });

              const getAccountName = (accId?: string, fallbackMethod?: string) => {
                if (accId) {
                  const acc = data.accounts.find(a => a.id === accId);
                  if (acc) return acc.name;
                }
                return fallbackMethod || 'Cash / Deyn';
              };

              return (
                <div className="space-y-6">
                  {/* COMPACT RECEIPT VIEW (Warqad Yar oo Nidaamsan - Default) */}
                  {statementViewFormat === 'RECEIPT' ? (
                    <div className="max-w-xl mx-auto bg-white rounded-3xl border-2 border-dashed border-slate-300 shadow-xl p-5 sm:p-7 font-mono text-slate-900 print:w-[80mm] print:max-w-full print:p-2 print:border-none print:shadow-none print:m-0 print:rounded-none">
                      
                      {/* RECEIPT HEADER */}
                      <div className="text-center space-y-1 pb-3 border-b border-dashed border-slate-400">
                        <h2 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 uppercase">
                          {data.settings.businessName || 'Xaysimo Supermarket'}
                        </h2>
                        <p className="text-xs text-slate-600 font-semibold">
                          {data.settings.storeAddress || 'Hargeisa / Somaliland'}
                        </p>
                        <p className="text-xs text-slate-600 font-semibold">
                          Tel: {data.settings.storePhone || '063-4444444'}
                        </p>
                        <div className="py-1">
                          <span className="inline-block px-3 py-0.5 bg-slate-900 text-white text-[11px] font-black uppercase rounded-md tracking-wider">
                            *** WARQADDA DEYNTA (STATEMENT SLIP) ***
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-[11px] font-bold text-slate-500 pt-1">
                          <span>Ref: STMT-{cust.id.slice(-6).toUpperCase()}</span>
                          <span>📅 {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </div>

                      {/* CUSTOMER & ACCOUNT DETAILS */}
                      <div className="py-3 border-b border-dashed border-slate-400 text-xs space-y-1">
                        <div className="flex justify-between">
                          <span className="font-bold text-slate-600">👤 Macaamiilka:</span>
                          <span className="font-black text-slate-900">{cust.name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-bold text-slate-600">📱 Number-ka:</span>
                          <span className="font-bold text-slate-800">{cust.phone || cust.id}</span>
                        </div>
                        {cust.address && (
                          <div className="flex justify-between">
                            <span className="font-bold text-slate-600">📍 Ciwaanka:</span>
                            <span className="font-bold text-slate-800">{cust.address}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="font-bold text-slate-600">📅 Seyga ugu dambeeyay:</span>
                          <span className="font-bold text-slate-800">
                            {allTxs.length > 0 ? new Date(allTxs[allTxs.length - 1].timestamp).toLocaleDateString() : new Date().toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex justify-between pt-0.5">
                          <span className="font-bold text-slate-600">🏷️ Xaaladda:</span>
                          <span className={`font-black uppercase text-[11px] ${cust.debtBalance > 0 ? 'text-rose-700 font-black' : 'text-emerald-700'}`}>
                            {cust.debtBalance > 0 ? '🔴 Deyn Baa Ku Taalla' : '🟢 Xisaabtu Waa Nadiif'}
                          </span>
                        </div>
                      </div>

                      {/* INNER FILTER & SEARCH (HIDDEN ON PRINT) */}
                      <div className="py-2.5 border-b border-dashed border-slate-300 space-y-2 print:hidden">
                        <div className="flex items-center gap-1 overflow-x-auto pb-1 scrollbar-hide text-[11px]">
                          {[
                            { id: 'ALL', label: `Dhammaan (${ledgerRows.length})` },
                            { id: 'SALES', label: `🛒 Alaabta (${ledgerRows.filter(r => r.isCreditSale).length})` },
                            { id: 'PAYMENTS', label: `💵 Bixinta (${ledgerRows.filter(r => r.isPayment).length})` },
                            { id: 'LOANS', label: `💰 Dayn Cash (${ledgerRows.filter(r => r.isCashLoan).length})` }
                          ].map(tab => (
                            <button
                              key={tab.id}
                              onClick={() => setStatementCategoryFilter(tab.id as any)}
                              className={`px-2.5 py-1 rounded-lg font-black transition-all whitespace-nowrap ${
                                statementCategoryFilter === tab.id
                                  ? 'bg-slate-900 text-white'
                                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                              }`}
                            >
                              {tab.label}
                            </button>
                          ))}
                        </div>
                        <div className="relative">
                          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" size={13} />
                          <input
                            type="text"
                            placeholder="Raadi alaab, faahfaahin ama comments..."
                            value={statementItemFilter}
                            onChange={e => setStatementItemFilter(e.target.value)}
                            className="w-full pl-7 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold text-slate-800 outline-none focus:ring-1 focus:ring-slate-900"
                          />
                        </div>
                      </div>

                      {/* ITEM & SERVICE TABLE (NAME, QTY, UNIT PRICE, SUBTOTAL, DATE, ACCOUNT) */}
                      <div className="py-3 border-b border-dashed border-slate-400">
                        <div className="text-[10px] font-black text-slate-500 uppercase pb-2 border-b border-slate-200 grid grid-cols-12 gap-1 text-left">
                          <span className="col-span-6">Item / Alaabta</span>
                          <span className="col-span-2 text-center">Qty</span>
                          <span className="col-span-2 text-right">Price</span>
                          <span className="col-span-2 text-right">Subtotal</span>
                        </div>

                        <div className="divide-y divide-dashed divide-slate-200 text-xs">
                          {filteredLedger.map((row) => {
                            const accName = getAccountName(row.accountId, row.paymentMethod);
                            const rowDateStr = new Date(row.timestamp).toLocaleDateString();

                            if (row.items && row.items.length > 0) {
                              return (
                                <div key={row.id} className="py-2 space-y-1">
                                  {row.items.map((it, i) => (
                                    <div key={i} className="grid grid-cols-12 gap-1 items-start">
                                      <div className="col-span-6 font-bold text-slate-900 break-words">
                                        • {it.name}
                                      </div>
                                      <div className="col-span-2 text-center font-bold text-slate-700">
                                        {it.quantity}
                                      </div>
                                      <div className="col-span-2 text-right text-slate-600 text-[11px]">
                                        {formatCurrency(it.sellPrice, currency, rate)}
                                      </div>
                                      <div className="col-span-2 text-right font-black text-slate-900">
                                        {formatCurrency(it.quantity * it.sellPrice, currency, rate)}
                                      </div>
                                    </div>
                                  ))}

                                  {/* Row metadata: Date & Payment Account & Notes */}
                                  <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-500 pt-0.5 font-bold">
                                    <span>📅 Seyga: {rowDateStr}</span>
                                    <span>💳 Acc: {accName}</span>
                                  </div>
                                  {row.notes && (
                                    <p className="text-[10px] text-slate-600 bg-slate-50 p-1 rounded border border-slate-200">
                                      📝 Faahfaahin: {row.notes}
                                    </p>
                                  )}
                                </div>
                              );
                            } else if (row.isCashLoan) {
                              return (
                                <div key={row.id} className="py-2 space-y-1">
                                  <div className="grid grid-cols-12 gap-1 items-center">
                                    <div className="col-span-6 font-black text-amber-900">
                                      💰 Dayn Cash ah
                                    </div>
                                    <div className="col-span-2 text-center font-bold text-slate-700">1</div>
                                    <div className="col-span-2 text-right text-slate-600 text-[11px]">
                                      {formatCurrency(row.total, currency, rate)}
                                    </div>
                                    <div className="col-span-2 text-right font-black text-rose-700">
                                      +{formatCurrency(row.total, currency, rate)}
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-500 pt-0.5 font-bold">
                                    <span>📅 Seyga: {rowDateStr}</span>
                                    <span>💳 Acc: {accName}</span>
                                  </div>
                                  {row.notes && (
                                    <p className="text-[10px] text-slate-600 bg-slate-50 p-1 rounded border border-slate-200">
                                      📝 Faahfaahin: {row.notes}
                                    </p>
                                  )}
                                </div>
                              );
                            } else if (row.isPayment) {
                              return (
                                <div key={row.id} className="py-2 space-y-1">
                                  <div className="grid grid-cols-12 gap-1 items-center">
                                    <div className="col-span-6 font-black text-emerald-800">
                                      💵 Bixinta Deynta (Paid)
                                    </div>
                                    <div className="col-span-2 text-center font-bold text-slate-700">1</div>
                                    <div className="col-span-2 text-right text-slate-600 text-[11px]">
                                      {formatCurrency(row.total, currency, rate)}
                                    </div>
                                    <div className="col-span-2 text-right font-black text-emerald-700">
                                      -{formatCurrency(row.total, currency, rate)}
                                    </div>
                                  </div>
                                  <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-500 pt-0.5 font-bold">
                                    <span>📅 Seyga: {rowDateStr}</span>
                                    <span>💳 Acc: {accName}</span>
                                  </div>
                                  {row.notes && (
                                    <p className="text-[10px] text-slate-600 bg-slate-50 p-1 rounded border border-slate-200">
                                      📝 Faahfaahin: {row.notes}
                                    </p>
                                  )}
                                </div>
                              );
                            }

                            return (
                              <div key={row.id} className="py-2 space-y-1">
                                <div className="grid grid-cols-12 gap-1 items-center">
                                  <div className="col-span-6 font-bold text-slate-900">
                                    • Adeeg Guud / Iib
                                  </div>
                                  <div className="col-span-2 text-center font-bold text-slate-700">1</div>
                                  <div className="col-span-2 text-right text-slate-600 text-[11px]">
                                    {formatCurrency(row.total, currency, rate)}
                                  </div>
                                  <div className="col-span-2 text-right font-black text-slate-900">
                                    {formatCurrency(row.total, currency, rate)}
                                  </div>
                                </div>
                                <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-500 pt-0.5 font-bold">
                                  <span>📅 Seyga: {rowDateStr}</span>
                                  <span>💳 Acc: {accName}</span>
                                </div>
                                {row.notes && (
                                  <p className="text-[10px] text-slate-600 bg-slate-50 p-1 rounded border border-slate-200">
                                    📝 Faahfaahin: {row.notes}
                                  </p>
                                )}
                              </div>
                            );
                          })}

                          {filteredLedger.length === 0 && (
                            <div className="py-6 text-center text-slate-400 font-bold text-xs">
                              Lama helin wax diiwaan ah.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* TOTALS & REMAINING DEBT */}
                      <div className="py-3 border-b border-dashed border-slate-400 space-y-1.5 text-xs">
                        <div className="flex justify-between">
                          <span className="font-bold text-slate-600">📈 Wadarta Guud ee Deynta:</span>
                          <span className="font-bold text-slate-900">{formatCurrency(totalDebtAdded, currency, rate)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="font-bold text-slate-600">📉 Wadarta uu Bixiyay:</span>
                          <span className="font-bold text-emerald-700">-{formatCurrency(totalPaid, currency, rate)}</span>
                        </div>
                        {cust.advanceBalance && cust.advanceBalance > 0 ? (
                          <div className="flex justify-between">
                            <span className="font-bold text-emerald-700">🟢 Amaano / Deposit:</span>
                            <span className="font-black text-emerald-700">{formatCurrency(cust.advanceBalance, currency, rate)}</span>
                          </div>
                        ) : null}

                        <div className="pt-2 border-t-2 border-slate-900 flex justify-between items-center">
                          <span className="font-black text-sm uppercase text-slate-900">
                            🔴 DEYNTA HADA LAGU LEEYAHAY:
                          </span>
                          <span className="font-black text-base sm:text-lg text-rose-700 font-mono">
                            {formatCurrency(cust.debtBalance, currency, rate)}
                          </span>
                        </div>
                      </div>

                      {/* STORE PAYMENT ACCOUNTS */}
                      <div className="py-3 border-b border-dashed border-slate-400 space-y-2">
                        <p className="text-[11px] font-black uppercase text-slate-800 tracking-wider">
                          💳 AKOONNADA LACAGTA LAGU SOO DIRO:
                        </p>
                        <div className="space-y-1 text-xs font-bold text-slate-700">
                          <div className="flex justify-between">
                            <span>📱 1. Telebirr / E-Birr:</span>
                            <span className="font-black font-mono select-all text-slate-900">
                              {data.settings?.onlinePaymentNumbers?.ebirr || '0901234567'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>🏦 2. CBE Bank:</span>
                            <span className="font-black font-mono select-all text-slate-900">
                              {data.settings?.onlinePaymentNumbers?.commercialBank || '1000123456789'}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span>💳 3. Kaafi / Zaad:</span>
                            <span className="font-black font-mono select-all text-slate-900">
                              {data.settings?.onlinePaymentNumbers?.kaafi || data.settings?.onlinePaymentNumbers?.golis || '0631234567'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* OFFICIAL REQUEST NOTICE BANNER */}
                      <div className="py-3 border-b border-dashed border-slate-400 text-center space-y-1 bg-amber-50/80 -mx-2 px-3 rounded-xl border border-amber-200">
                        <p className="text-xs sm:text-sm font-black text-amber-900 uppercase">
                          📢 Fadlan bixi lacagta deynta lagugu leeyahay adoo raali ah.
                        </p>
                        <p className="text-[11px] font-bold text-amber-800">
                          Mahadsanid wada shaqayntaada! 🙏
                        </p>
                      </div>

                      {/* SIGNATURES */}
                      <div className="pt-6 grid grid-cols-2 gap-4 text-center text-[10px] font-bold text-slate-500">
                        <div className="space-y-7">
                          <p className="uppercase">Saxeexa Macaamiilka</p>
                          <div className="border-b border-dashed border-slate-400 w-4/5 mx-auto" />
                        </div>
                        <div className="space-y-7">
                          <p className="uppercase">Saxeexa & Shaabadda Dukaanka</p>
                          <div className="border-b border-dashed border-slate-400 w-4/5 mx-auto" />
                        </div>
                      </div>

                    </div>
                  ) : (
                    /* FULL WIDE TABLE VIEW */
                    <div className="bg-white rounded-[36px] border border-slate-200 shadow-xl overflow-hidden print:border-none print:shadow-none print:rounded-none">
                      {/* DOCUMENT HEADER */}
                      <div className="p-6 md:p-8 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white">
                        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                          <div className="space-y-2">
                            <div className="inline-flex items-center gap-2 px-3 py-1 bg-white/10 rounded-xl text-emerald-400 text-xs font-black uppercase tracking-wider border border-white/10">
                              <Sparkles size={14} /> DOKUMENTIGA RASMIGA AH EE XISAAB-XIDHKA
                            </div>
                            <h2 className="text-2xl md:text-3xl font-black tracking-tight text-white uppercase">
                              {data.settings.businessName || 'Xaysimo Supermarket'}
                            </h2>
                            <p className="text-xs text-slate-300 font-medium">
                              {data.settings.storeAddress || 'Hargeisa / Somaliland'} | Tel: {data.settings.storePhone || '063-4444444'}
                            </p>
                          </div>

                          <div className="text-left md:text-right space-y-1.5 bg-white/5 p-4 rounded-2xl border border-white/10">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Statement Ref ID</p>
                            <p className="text-sm font-black font-mono text-amber-300">STMT-{cust.id.slice(-6).toUpperCase()}</p>
                            <p className="text-[10px] font-bold text-slate-300">
                              📅 Taariikhda: {new Date().toLocaleDateString()} {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </p>
                            <div className="pt-1">
                              <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase ${
                                cust.debtBalance > 0 ? 'bg-rose-500 text-white' : 'bg-emerald-500 text-slate-950'
                              }`}>
                                {cust.debtBalance > 0 ? '🔴 Deyn Baa Ku Taalla' : '🟢 Xisaabtu Waa Nadiif'}
                              </span>
                            </div>
                          </div>
                        </div>

                        {/* Customer Profile Grid */}
                        <div className="mt-6 pt-6 border-t border-white/10 grid grid-cols-1 sm:grid-cols-3 gap-4 bg-white/5 p-4 rounded-2xl">
                          <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase block">👤 Magaca Macaamiilka:</span>
                            <span className="text-base font-black text-white">{cust.name}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase block">📱 Taleefanka:</span>
                            <span className="text-base font-black text-slate-200">{cust.phone || 'Lama hayo'}</span>
                          </div>
                          <div>
                            <span className="text-[10px] font-black text-slate-400 uppercase block">📍 Ciwaanka / ID:</span>
                            <span className="text-base font-black text-slate-200">{cust.address || cust.id}</span>
                          </div>
                        </div>
                      </div>

                      {/* FINANCIAL METRICS SUMMARY CARDS */}
                      <div className="p-6 md:p-8 bg-slate-50 border-b border-slate-200 space-y-6">
                        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                          <div className="bg-rose-50 p-4 rounded-2xl border border-rose-200 flex flex-col justify-between">
                            <span className="text-[10px] font-black text-rose-700 uppercase tracking-wider">Daynta Hada Dhiman</span>
                            <h4 className="text-2xl font-black text-rose-800 mt-1">{formatCurrency(cust.debtBalance, currency, rate)}</h4>
                            <span className="text-[9px] font-bold text-rose-600 mt-1">🔴 Hada Lagu Leeyahay</span>
                          </div>
                          <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-200 flex flex-col justify-between">
                            <span className="text-[10px] font-black text-emerald-700 uppercase tracking-wider">Lacag Hore / Deposit</span>
                            <h4 className="text-2xl font-black text-emerald-800 mt-1">{formatCurrency(cust.advanceBalance || 0, currency, rate)}</h4>
                            <span className="text-[9px] font-bold text-emerald-600 mt-1">🟢 Amaano Ku Leh</span>
                          </div>
                          <div className="bg-amber-50 p-4 rounded-2xl border border-amber-200 flex flex-col justify-between">
                            <span className="text-[10px] font-black text-amber-700 uppercase tracking-wider">Wadarta Guud Deynta</span>
                            <h4 className="text-2xl font-black text-amber-800 mt-1">{formatCurrency(totalDebtAdded, currency, rate)}</h4>
                            <span className="text-[9px] font-bold text-amber-600 mt-1">📈 All-time Borrowed</span>
                          </div>
                          <div className="bg-blue-50 p-4 rounded-2xl border border-blue-200 flex flex-col justify-between">
                            <span className="text-[10px] font-black text-blue-700 uppercase tracking-wider">Wadarta uu Bixiyay</span>
                            <h4 className="text-2xl font-black text-blue-800 mt-1">{formatCurrency(totalPaid, currency, rate)}</h4>
                            <span className="text-[9px] font-bold text-blue-600 mt-1">📉 All-time Repaid</span>
                          </div>
                          <div className="bg-purple-50 p-4 rounded-2xl border border-purple-200 flex flex-col justify-between col-span-2 sm:col-span-1">
                            <span className="text-[10px] font-black text-purple-700 uppercase tracking-wider">Dhaqdhaqaaqyada</span>
                            <h4 className="text-2xl font-black text-purple-800 mt-1">{ledgerRows.length}</h4>
                            <span className="text-[9px] font-bold text-purple-600 mt-1">📊 Total Transactions</span>
                          </div>
                        </div>

                        {/* Category & Item Filter */}
                        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 print:hidden">
                          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
                            <span className="text-xs font-black text-slate-400 uppercase mr-1">Nooca:</span>
                            {[
                              { id: 'ALL', label: `Dhammaan (${ledgerRows.length})` },
                              { id: 'SALES', label: `🛒 Alaabta Deynta (${ledgerRows.filter(r => r.isCreditSale).length})` },
                              { id: 'PAYMENTS', label: `💵 Bixinta Deynta (${ledgerRows.filter(r => r.isPayment).length})` },
                              { id: 'LOANS', label: `💰 Dayn Cash ah (${ledgerRows.filter(r => r.isCashLoan).length})` }
                            ].map(tab => (
                              <button
                                key={tab.id}
                                onClick={() => setStatementCategoryFilter(tab.id as any)}
                                className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all whitespace-nowrap ${
                                  statementCategoryFilter === tab.id
                                    ? 'bg-slate-900 text-white shadow-sm'
                                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                              >
                                {tab.label}
                              </button>
                            ))}
                          </div>

                          <div className="relative min-w-[240px]">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
                            <input
                              type="text"
                              placeholder="Raadi adeeg, alaab, khudaar, ama comments..."
                              value={statementItemFilter}
                              onChange={e => setStatementItemFilter(e.target.value)}
                              className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                      </div>

                      {/* FULL TABLE */}
                      <div className="p-6 md:p-8 space-y-6">
                        <div className="border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                          <div className="p-4 bg-slate-100 border-b border-slate-200 flex items-center justify-between">
                            <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                              <FileText size={16} className="text-blue-600" />
                              Faahfaahinta Adeegyada, Alaabta uu Qaatay & Bixinta (Itemized Ledger)
                            </h4>
                            <span className="text-[10px] font-bold text-slate-500">
                              {filteredLedger.length} diiwaan ayaa ku jira warqaddan
                            </span>
                          </div>

                          <div className="overflow-x-auto">
                            <table className="w-full text-left border-collapse">
                              <thead>
                                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                                  <th className="p-3.5 text-center w-10">#</th>
                                  <th className="p-3.5 whitespace-nowrap">📅 Taariikhda & Waqtiga</th>
                                  <th className="p-3.5">🏷️ Adeega / Alaabta & Nooca</th>
                                  <th className="p-3.5">📝 Comments / Faahfaahin</th>
                                  <th className="p-3.5">💳 Account / Qaabka</th>
                                  <th className="p-3.5 text-right whitespace-nowrap">📈 Deyn Ku Kordhay</th>
                                  <th className="p-3.5 text-right whitespace-nowrap">📉 Lacag Bixiyay</th>
                                  <th className="p-3.5 text-right whitespace-nowrap">📊 Balance-ka</th>
                                  <th className="p-3.5 text-center print:hidden">Tallaabo</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 text-xs">
                                {filteredLedger.map((row, idx) => {
                                  const accName = getAccountName(row.accountId, row.paymentMethod);
                                  return (
                                    <tr key={row.id} className="hover:bg-slate-50/80 transition-colors">
                                      <td className="p-3.5 text-center font-bold text-slate-400">
                                        {idx + 1}
                                      </td>

                                      <td className="p-3.5 font-bold text-slate-600 whitespace-nowrap">
                                        <div>{new Date(row.timestamp).toLocaleDateString()}</div>
                                        <div className="text-[10px] text-slate-400 font-normal">
                                          {new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                      </td>

                                      <td className="p-3.5">
                                        <div className="space-y-1">
                                          <span className={`inline-block px-2.5 py-0.5 rounded-md text-[9px] font-black uppercase mb-1 ${
                                            row.isCashLoan
                                              ? 'bg-amber-100 text-amber-900 border border-amber-200'
                                              : row.isPayment
                                              ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                                              : 'bg-blue-100 text-blue-900 border border-blue-200'
                                          }`}>
                                            {row.isCashLoan ? '💰 Dayn Cash Ah' : row.isPayment ? '💵 Bixinta Deynta' : '🛒 Alaab Deynta'}
                                          </span>

                                          {row.items && row.items.length > 0 ? (
                                            <div className="space-y-1">
                                              {row.items.map((it, i) => (
                                                <div key={i} className="flex items-center gap-1.5 font-bold text-slate-800">
                                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-500 flex-shrink-0" />
                                                  <span>{it.name}</span>
                                                  <span className="text-slate-400 font-normal text-[11px]">
                                                    ({it.quantity} x {formatCurrency(it.sellPrice, currency, rate)} = {formatCurrency(it.quantity * it.sellPrice, currency, rate)})
                                                  </span>
                                                </div>
                                              ))}
                                            </div>
                                          ) : (
                                            <p className="font-bold text-slate-700">
                                              {row.isPayment ? 'Bixinta lacagta deynta ah' : row.isCashLoan ? 'Dayn lacag cadaan ah oo la siiyay' : 'Adeeg / Alaab guud'}
                                            </p>
                                          )}
                                        </div>
                                      </td>

                                      <td className="p-3.5">
                                        {row.notes ? (
                                          <div className="bg-slate-50 px-2.5 py-1.5 rounded-xl border border-slate-100 text-slate-700 font-medium text-[11px] max-w-xs">
                                            💬 {row.notes}
                                          </div>
                                        ) : (
                                          <span className="text-slate-300 font-normal text-[11px]">-</span>
                                        )}
                                      </td>

                                      <td className="p-3.5 font-bold text-slate-700">
                                        <span className="px-2 py-0.5 bg-slate-100 border border-slate-200 rounded-md text-[10px]">
                                          💳 {accName}
                                        </span>
                                      </td>

                                      <td className="p-3.5 text-right font-black text-rose-600 text-sm whitespace-nowrap">
                                        {row.debt > 0 ? `+${formatCurrency(row.debt, currency, rate)}` : '-'}
                                      </td>

                                      <td className="p-3.5 text-right font-black text-emerald-600 text-sm whitespace-nowrap">
                                        {row.paid > 0 ? `-${formatCurrency(row.paid, currency, rate)}` : '-'}
                                      </td>

                                      <td className="p-3.5 text-right font-black text-slate-900 text-sm whitespace-nowrap">
                                        {formatCurrency(row.balanceAfter, currency, rate)}
                                      </td>

                                      <td className="p-3.5 text-center print:hidden">
                                        <button
                                          onClick={() => handleDeleteTransaction(row)}
                                          className="p-1.5 text-slate-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all"
                                          title="Tirtir diiwaankan"
                                        >
                                          <Trash2 size={15} />
                                        </button>
                                      </td>
                                    </tr>
                                  );
                                })}

                                {filteredLedger.length === 0 && (
                                  <tr>
                                    <td colSpan={9} className="p-12 text-center text-slate-400 font-bold">
                                      Lama helin wax diiwaan ah oo u dhigma raadinta.
                                    </td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        {/* STORE PAYMENT ACCOUNTS & SIGNATURES */}
                        <div className="p-6 bg-slate-900 text-white rounded-3xl space-y-4 shadow-md">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                            <h5 className="text-xs font-black uppercase tracking-wider text-slate-200 flex items-center gap-2">
                              <CreditCard className="text-emerald-400" size={16} />
                              Akoonnada Rasmiga ah ee Lacagta Lagu Soo Diro:
                            </h5>
                            <span className="text-[10px] font-black text-emerald-400 uppercase">
                              Official Store Payment Gateways
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                            <div className="p-3.5 bg-slate-800/90 rounded-2xl border border-slate-700 space-y-1">
                              <span className="text-[10px] font-black text-emerald-400 block uppercase">1. E-Birr / Telebirr</span>
                              <p className="text-sm font-black font-mono select-all text-white">
                                {data.settings?.onlinePaymentNumbers?.ebirr || '0901234567'}
                              </p>
                            </div>
                            <div className="p-3.5 bg-slate-800/90 rounded-2xl border border-slate-700 space-y-1">
                              <span className="text-[10px] font-black text-indigo-400 block uppercase">2. Commercial Bank of Ethiopia (CBE)</span>
                              <p className="text-sm font-black font-mono select-all text-white">
                                {data.settings?.onlinePaymentNumbers?.commercialBank || '1000123456789'}
                              </p>
                            </div>
                            <div className="p-3.5 bg-slate-800/90 rounded-2xl border border-slate-700 space-y-1">
                              <span className="text-[10px] font-black text-purple-400 block uppercase">3. Kaafi / Zaad / Sahal</span>
                              <p className="text-sm font-black font-mono select-all text-white">
                                {data.settings?.onlinePaymentNumbers?.kaafi || data.settings?.onlinePaymentNumbers?.golis || '0631234567'}
                              </p>
                            </div>
                          </div>

                          <div className="p-3.5 bg-amber-500/20 border border-amber-500/40 rounded-2xl text-center">
                            <p className="text-xs md:text-sm font-black text-amber-300 uppercase tracking-wide">
                              📢 Fadlan bixi lacagta deynta lagugu leeyahay adoo raali ah. Mahadsanid!
                            </p>
                          </div>

                          <div className="pt-6 border-t border-slate-800 grid grid-cols-2 gap-8 text-center text-xs font-bold text-slate-400">
                            <div className="space-y-8">
                              <p className="uppercase">Saxeexa Macaamiilka (Customer Signature)</p>
                              <div className="border-b border-dashed border-slate-700 w-3/4 mx-auto" />
                            </div>
                            <div className="space-y-8">
                              <p className="uppercase">Saxeexa & Shaabadda Dukaanka (Store Stamp)</p>
                              <div className="border-b border-dashed border-slate-700 w-3/4 mx-auto" />
                            </div>
                          </div>
                        </div>

                      </div>
                    </div>
                  )}

                  {/* BOTTOM ACTION TOOLBAR */}
                  <div className="flex flex-wrap items-center justify-center gap-3 p-4 bg-white rounded-2xl border border-slate-200 shadow-sm print:hidden">
                    <button
                      onClick={() => {
                        setSelectedForPayment(cust);
                        setPaymentAmount(cust.debtBalance.toString());
                        const defaultAcc = data.accounts.find(a => a.name.toLowerCase().includes('cash'))?.id || '';
                        setTargetAccountId(defaultAcc);
                      }}
                      className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm active:scale-95 transition-all"
                    >
                      <ArrowDownLeft size={16} /> Qaabo Bixinta Daynta
                    </button>

                    <button
                      onClick={() => {
                        setProdLoanCustomerId(cust.id);
                        setShowProductLoanModal(true);
                        setProdLoanCart([]);
                      }}
                      className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm active:scale-95 transition-all"
                    >
                      <ShoppingBag size={16} /> Sii Alaab Deynta
                    </button>

                    <button
                      onClick={() => {
                        setLoanCustomerId(cust.id);
                        setShowLoanModal(true);
                        const defaultCashAcc = data.accounts.find(a => a.name.toLowerCase().includes('cash'))?.id || '';
                        setSourceAccountId(defaultCashAcc);
                      }}
                      className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm active:scale-95 transition-all"
                    >
                      <PlusCircle size={16} /> Sii Dayn Cash
                    </button>

                    <button
                      onClick={() => {
                        setAdvanceCustomer(cust);
                        setShowAdvanceModal(true);
                        const defaultAcc = data.accounts.find(a => a.name.toLowerCase().includes('cash'))?.id || '';
                        setAdvanceAccountId(defaultAcc);
                      }}
                      className="px-5 py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm active:scale-95 transition-all"
                    >
                      <PiggyBank size={16} /> Qabo Amaano / Deposit
                    </button>
                  </div>
                </div>
              );
            })()
          ) : (
            <div className="py-20 text-center flex flex-col items-center justify-center bg-white rounded-[32px] border-2 border-dashed border-slate-200">
              <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center mb-4 text-blue-500">
                <Search size={32} />
              </div>
              <p className="text-slate-800 font-black text-lg">Dooro Macaamiil si aad u aragto Warqadda Deynta</p>
              <p className="text-xs text-slate-400 mt-1 max-w-sm">
                Qor magaca qofka meesha sare ama guji magacyada degdegga ah si laguu soo saaro warqadda xisaab-xidhka oo faahfaahsan.
              </p>
            </div>
          )}
        </div>
      )}

      {/* Tab 2: Cash Loans History */}
      {activeSubTab === 'LOANS_HISTORY' && (
        <div className="space-y-6">
          <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <p className="text-xs text-slate-400 font-bold uppercase tracking-widest">Kullama Daymaha Lacagta Cadaan-ka ah ee Bixiyay</p>
              <h3 className="text-3xl font-black text-emerald-400 mt-1">{formatCurrency(totalCashLoansGiven, currency, rate)}</h3>
            </div>
            <button
              onClick={() => {
                setLoanDate(getLocalDateTimeString());
                setShowLoanModal(true);
                const defaultCashAcc = data.accounts.find(a => a.name.toLowerCase().includes('cash'))?.id || '';
                setSourceAccountId(defaultCashAcc);
              }}
              className="px-6 py-3.5 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-2xl transition-all flex items-center gap-2 shadow-lg"
            >
              <PlusCircle size={16} />
              + Sii Dayn Cash Ah
            </button>
          </div>

          {/* Loans History Search Bar */}
          <div className="bg-white p-4 rounded-3xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
            <div className="relative flex-1 w-full">
              <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Raadi Diiwaanka Daynta (Macaamiil, Nambarka Telka, Akoonka, Note, Taariikh)..."
                value={loansHistorySearch}
                onChange={e => setLoansHistorySearch(e.target.value)}
                className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs text-slate-800 focus:bg-white focus:ring-2 focus:ring-emerald-500 transition-all placeholder:text-slate-400"
              />
              {loansHistorySearch && (
                <button
                  onClick={() => setLoansHistorySearch('')}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1 rounded-full hover:bg-slate-200 transition-colors"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            <div className="text-xs font-black text-slate-500 whitespace-nowrap px-2">
              Wadarta: <span className="text-slate-900">{filteredCashLoans.length}</span> Dhaqdhaqaaq
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="p-4">Taariikhda</th>
                    <th className="p-4">Macaamiilka</th>
                    <th className="p-4">Akoonka Lacagta Ka Baxday</th>
                    <th className="p-4">Faahfaahin / Note</th>
                    <th className="p-4 text-right">Xaddiga Daynta</th>
                    <th className="p-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs font-bold text-slate-700">
                  {filteredCashLoans.map(loan => {
                    const cust = data.customers.find(c => c.id === loan.customerId);
                    const acc = data.accounts.find(a => a.id === loan.accountId);
                    return (
                      <tr key={loan.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-4 text-slate-500 font-medium whitespace-nowrap">
                          {new Date(loan.timestamp).toLocaleString()}
                        </td>
                        <td className="p-4">
                          <div className="font-black text-slate-900">{cust?.name || loan.customerName || 'Macaamiil Hore'}</div>
                          <div className="text-[10px] text-slate-400">{cust?.phone || loan.customerId}</div>
                        </td>
                        <td className="p-4">
                          <span className="px-3 py-1 bg-slate-100 text-slate-800 rounded-xl font-bold text-[10px]">
                            {acc?.name || 'Cash Account'}
                          </span>
                        </td>
                        <td className="p-4 text-slate-500 font-medium text-xs max-w-xs truncate">
                          {loan.notes || 'Dayn Lacag Cadaan ah'}
                        </td>
                        <td className="p-4 text-right whitespace-nowrap">
                          <span className="text-rose-600 font-black text-sm">
                            +{formatCurrency(loan.total, currency, rate)}
                          </span>
                        </td>
                        <td className="p-4 text-right">
                          <button
                            onClick={() => handleDeleteTransaction(loan)}
                            className="p-2 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-xl transition-all"
                            title="Tirtir (Delete)"
                          >
                            <Trash2 size={16} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                  {filteredCashLoans.length === 0 && (
                    <tr>
                      <td colSpan={6} className="p-12 text-center text-slate-400 font-bold">
                        {loansHistorySearch.trim() ? `Lama helin wax dayn ah oo u dhiganta "${loansHistorySearch}".` : 'Lama helin wax dayn lacag cadaan ah oo la bixiyay wali.'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Itemized Debt Statement / Tale-ka Kala Nidaamsan */}
      {statementCustomer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in duration-300">
            {/* Header */}
            <div className="p-6 md:p-8 bg-slate-900 text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center font-black text-lg">
                  {statementCustomer.name.charAt(0)}
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tight">{statementCustomer.name}</h3>
                  <p className="text-xs text-slate-300 font-medium">Phone: {statementCustomer.phone} | Tale-ka Deynta & Alaabta</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => sendMonthlyDebtStatement(statementCustomer, data, currency, rate, true)}
                  className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                  title="U Dir WhatsApp faahfaahinta alaabta oo dhan, taariikhda, tirada, iyo lacagta"
                >
                  <MessageSquare size={15} /> 💬 U Dir WhatsApp (Faahfaahsan)
                </button>
                <button
                  onClick={() => sendMonthlyDebtStatement(statementCustomer, data, currency, rate, false)}
                  className="px-3.5 py-2.5 bg-amber-600 hover:bg-amber-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                  title="U Dir Total Lacagta lagu leeyahay WhatsApp (Kooban)"
                >
                  💬 Kooban
                </button>
                <button
                  onClick={() => window.print()}
                  className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-md active:scale-95"
                >
                  <Printer size={15} /> Daabac Statement
                </button>
                <button onClick={() => setStatementCustomer(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors ml-1">
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Content area */}
            <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1">
              {/* Summary Metrics */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-amber-50 p-5 rounded-3xl border border-amber-100">
                  <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Total Remaining Debt / Daynta Hada</p>
                  <h4 className="text-3xl font-black text-amber-700">{formatCurrency(statementCustomer.debtBalance, currency, rate)}</h4>
                </div>

                <div className="bg-emerald-50 p-5 rounded-3xl border border-emerald-100">
                  <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest mb-1">Advance Deposit / Lacagta Hore</p>
                  <h4 className="text-3xl font-black text-emerald-700">{formatCurrency(statementCustomer.advanceBalance || 0, currency, rate)}</h4>
                </div>

                <div className="bg-blue-50 p-5 rounded-3xl border border-blue-100">
                  <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1">Total Activity Count</p>
                  <h4 className="text-3xl font-black text-blue-700">{customerTransactions.length} Records</h4>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="flex flex-wrap items-center gap-3 bg-slate-50 p-4 rounded-2xl border">
                <button
                  onClick={() => {
                    setSelectedForPayment(statementCustomer);
                    setPaymentAmount(statementCustomer.debtBalance.toString());
                    const defaultAcc = data.accounts.find(a => a.name.toLowerCase().includes('cash'))?.id || '';
                    setTargetAccountId(defaultAcc);
                  }}
                  className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm"
                >
                  <ArrowDownLeft size={16} /> Qaabo Bixinta Daynta
                </button>

                <button
                  onClick={() => {
                    setAdvanceCustomer(statementCustomer);
                    setShowAdvanceModal(true);
                    const defaultAcc = data.accounts.find(a => a.name.toLowerCase().includes('cash'))?.id || '';
                    setAdvanceAccountId(defaultAcc);
                  }}
                  className="px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm"
                >
                  <PiggyBank size={16} /> Shub Lacag Hore (Deposit)
                </button>

                <button
                  onClick={() => {
                    setLoanCustomerId(statementCustomer.id);
                    setShowLoanModal(true);
                    const defaultCashAcc = data.accounts.find(a => a.name.toLowerCase().includes('cash'))?.id || '';
                    setSourceAccountId(defaultCashAcc);
                  }}
                  className="px-5 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black flex items-center gap-2 shadow-sm"
                >
                  <ArrowUpRight size={16} /> Sii Dayn Cash
                </button>
              </div>

              {/* Detailed Itemized Ledger Table */}
              <div className="border rounded-3xl overflow-hidden bg-white shadow-sm">
                <div className="p-4 bg-slate-100 border-b flex items-center justify-between">
                  <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                    <FileText size={16} className="text-blue-600" />
                    Tale-ka Kala Nidaamsan ee Taariikhda iyo Alaabta Deynta
                  </h4>
                  <span className="text-[10px] font-bold text-slate-500">Sorted Chronologically</span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <th className="p-4">Taariikhda & Waqtiga</th>
                        <th className="p-4">Nooca (Type)</th>
                        <th className="p-4">Alaabta / Itemized Details</th>
                        <th className="p-4">Comments / Faahfaahin</th>
                        <th className="p-4 text-right">Deyn Ku Kordhay</th>
                        <th className="p-4 text-right">Lacag Bixiyay</th>
                        <th className="p-4 text-center">Tirtir</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-xs">
                      {customerTransactions.map(tx => {
                        const isCreditSale = tx.paymentMethod === PaymentMethod.DEBT || tx.paymentMethod === PaymentMethod.PARTIAL;
                        const isPayment = tx.type === 'DEBT_PAYMENT';
                        const isCashLoan = tx.type === 'CASH_LOAN';

                        let debtAdded = 0;
                        let paymentMade = 0;

                        if (isCashLoan) debtAdded = tx.total;
                        else if (isPayment) paymentMade = tx.total;
                        else if (isCreditSale) {
                          debtAdded = tx.paymentMethod === PaymentMethod.DEBT 
                            ? tx.total 
                            : (tx.paymentDetails ? tx.paymentDetails.debt : tx.total);
                        }

                        return (
                          <tr key={tx.id} className="hover:bg-slate-50/80 transition-colors">
                            <td className="p-4 font-bold text-slate-600 whitespace-nowrap">
                              {new Date(tx.timestamp).toLocaleString()}
                            </td>
                            <td className="p-4 whitespace-nowrap">
                              {isCashLoan ? (
                                <span className="px-3 py-1 bg-amber-100 text-amber-800 rounded-lg text-[10px] font-black uppercase">Dayn Cash Ah</span>
                              ) : isPayment ? (
                                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-lg text-[10px] font-black uppercase">Bixinta Deynta</span>
                              ) : (
                                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-lg text-[10px] font-black uppercase">Alaab Deynta</span>
                              )}
                            </td>
                            <td className="p-4">
                              {tx.items && tx.items.length > 0 ? (
                                <div className="space-y-1">
                                  {tx.items.map((item, idx) => (
                                    <div key={idx} className="flex items-center gap-2 font-bold text-slate-800">
                                      <span className="w-2 h-2 rounded-full bg-blue-500" />
                                      <span>{item.name}</span>
                                      <span className="text-slate-400 font-normal">
                                        ({item.quantity} x {formatCurrency(item.sellPrice, currency, rate)} = {formatCurrency(item.quantity * item.sellPrice, currency, rate)})
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="font-bold text-slate-600">{isPayment ? 'Bixinta lacagta deynta ah' : 'Waxyaabo lagu qaatay deyn'}</p>
                              )}
                            </td>
                            <td className="p-4">
                              {tx.notes ? (
                                <div className="bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 text-slate-700 font-medium text-[11px]">
                                  💬 {tx.notes}
                                </div>
                              ) : (
                                <span className="text-slate-300">-</span>
                              )}
                            </td>
                            <td className="p-4 text-right font-black text-rose-600 text-sm whitespace-nowrap">
                              {debtAdded > 0 ? `+${formatCurrency(debtAdded, currency, rate)}` : '-'}
                            </td>
                            <td className="p-4 text-right font-black text-emerald-600 text-sm whitespace-nowrap">
                              {paymentMade > 0 ? `-${formatCurrency(paymentMade, currency, rate)}` : '-'}
                            </td>
                            <td className="p-4 text-center">
                              <button
                                onClick={() => handleDeleteTransaction(tx)}
                                className="p-1.5 text-slate-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                                title="Tirtir diiwaankan"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })}

                      {customerTransactions.length === 0 && (
                        <tr>
                          <td colSpan={7} className="p-12 text-center text-slate-400 font-bold">
                            Macaamiilkan wali ma laha diiwaan dhaqaaq deyn ama bixin ah.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* Payment Accounts & Debt Settling Reminder */}
                <div className="p-6 bg-slate-900 text-white rounded-3xl space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <h5 className="text-xs font-black uppercase tracking-wider text-slate-200">
                      💳 Akoonnada Lacagta Lagu Soo Diro (Payment Accounts):
                    </h5>
                    <span className="text-[10px] font-black text-emerald-400 uppercase">
                      Official Payment Channels
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-1">
                      <span className="text-[10px] font-black text-emerald-400 block uppercase">1. E-Birr / Telebirr</span>
                      <p className="text-sm font-black font-mono select-all text-white">
                        {data.settings?.onlinePaymentNumbers?.ebirr || '0901234567'}
                      </p>
                    </div>
                    <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-1">
                      <span className="text-[10px] font-black text-indigo-400 block uppercase">2. Commercial Bank (CBE)</span>
                      <p className="text-sm font-black font-mono select-all text-white">
                        {data.settings?.onlinePaymentNumbers?.commercialBank || '1000123456789'}
                      </p>
                    </div>
                    <div className="p-3.5 bg-slate-800/80 rounded-2xl border border-slate-700 space-y-1">
                      <span className="text-[10px] font-black text-purple-400 block uppercase">3. Kaafi / Zaad</span>
                      <p className="text-sm font-black font-mono select-all text-white">
                        {data.settings?.onlinePaymentNumbers?.kaafi || data.settings?.onlinePaymentNumbers?.golis || '0631234567'}
                      </p>
                    </div>
                  </div>
                  <div className="p-3 bg-amber-500/20 border border-amber-500/40 rounded-2xl text-center">
                    <p className="text-xs md:text-sm font-black text-amber-300 uppercase tracking-wide">
                      📢 Fadlan bixi lacagta deynta lagugu leeyahay adoo raali ah
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 1: Issue Cash Loan */}
      {showLoanModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[36px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 md:p-8 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
                  <DollarSign className="text-emerald-400" size={24} />
                  Sii Dayn Lacag Cadaan Ah
                </h3>
                <p className="opacity-75 font-medium text-xs mt-1">Geli xaddiga lacagta cadaanka ah oo macaamiilka dayn ahaan loo siinayo</p>
              </div>
              <button onClick={() => setShowLoanModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 md:p-8 space-y-5 max-h-[80vh] overflow-y-auto">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Macaamiilka Daynta Qaadanaya</label>
                  <button
                    onClick={() => setIsNewCustomerMode(!isNewCustomerMode)}
                    className="text-[10px] font-bold text-blue-600 hover:underline flex items-center gap-1"
                  >
                    {isNewCustomerMode ? '← Dooro Macaamiil Hore' : '+ Ku dar Macaamiil Cusub'}
                  </button>
                </div>

                {isNewCustomerMode ? (
                  <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-2xl space-y-3">
                    <input
                      type="text"
                      placeholder="Magaca Macaamiilka..."
                      value={newCustName}
                      onChange={e => setNewCustName(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none font-bold text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Nambarka Telefonka (e.g. 061XXXXXXX)..."
                      value={newCustPhone}
                      onChange={e => setNewCustPhone(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl outline-none font-bold text-xs"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Raadi magaca ama telefonka..."
                        value={customerSearch}
                        onChange={e => setCustomerSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-slate-100 border-none rounded-xl outline-none font-bold text-xs"
                      />
                    </div>
                    <select
                      className="w-full px-4 py-3 bg-slate-100 border-none rounded-2xl outline-none font-bold text-xs text-slate-800"
                      value={loanCustomerId}
                      onChange={e => setLoanCustomerId(e.target.value)}
                    >
                      <option value="">Dooro Macaamiil...</option>
                      {filteredCustomersForLoan.map(c => (
                        <option key={c.id} value={c.id}>
                          {c.name} ({c.phone}) — Daynta Hore: ${c.debtBalance}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Xaddiga Lacagta Daynta ah ({currency})</label>
                <input
                  type="number"
                  placeholder="0.00"
                  value={loanAmount}
                  onChange={e => setLoanAmount(e.target.value)}
                  className="w-full px-5 py-4 bg-slate-100 border-none rounded-2xl outline-none font-black text-2xl text-emerald-600 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Akoonka Lacagtu Ka Baxayso</label>
                <select
                  className="w-full px-4 py-3.5 bg-slate-100 border-none rounded-2xl outline-none font-bold text-xs text-slate-800"
                  value={sourceAccountId}
                  onChange={e => setSourceAccountId(e.target.value)}
                >
                  {data.accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} (Haragga: {formatCurrency(a.balance, currency, rate)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Calendar size={13} className="text-emerald-600" />
                    Taariikhda & Waqtiga Daynta (Date & Time)
                  </label>
                  <span className="text-[9px] text-blue-600 font-bold">Waa la dooran karaa taariikh hore</span>
                </div>
                <input
                  type="datetime-local"
                  value={loanDate}
                  onChange={e => setLoanDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-2xl outline-none font-bold text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500 focus:bg-white transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Faahfaahin / Note (Sababta)</label>
                <input
                  type="text"
                  placeholder="e.g. Lacag cadaan ah oo dayn loo siiyay..."
                  value={loanNote}
                  onChange={e => setLoanNote(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl outline-none font-medium text-xs"
                />
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  onClick={() => setShowLoanModal(false)}
                  className="flex-1 py-4 font-black text-slate-400 hover:text-slate-600 text-xs uppercase"
                >
                  Kaniisad / Cancel
                </button>
                <button
                  onClick={handleGiveCashLoan}
                  disabled={isProcessing}
                  className="flex-[2] py-4 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-sm shadow-xl shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  {isProcessing ? 'Waa la diiwaan gelinayaa...' : 'Sii Daynta Lacagta'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 2: Receive Payment */}
      {selectedForPayment && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[36px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-300 max-h-[90vh] flex flex-col">
            <div className="p-6 bg-blue-600 text-white flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-xl font-black tracking-tight">Qaabo Lacag Bixinta Daynta</h3>
                <p className="opacity-80 font-medium text-xs mt-0.5">{selectedForPayment.name} — Bixinta Deynta</p>
              </div>
              <button onClick={() => setSelectedForPayment(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 md:p-8 space-y-5 overflow-y-auto flex-1">
              {/* Debt overview badge */}
              <div className="bg-slate-50 p-4 rounded-3xl border text-center flex items-center justify-between">
                <div className="text-left">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Deynta Hore</p>
                  <h4 className="text-2xl font-black text-amber-600">{formatCurrency(selectedForPayment.debtBalance, currency, rate)}</h4>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Sarifka (Rate)</p>
                  <p className="text-xs font-black text-slate-700">$1 USD = {rate} ETB</p>
                </div>
              </div>

              {/* Currency Toggle Switcher */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Currency-ga aad ku qorayso (Input Currency)</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-2xl">
                  <button
                    type="button"
                    onClick={() => setPayCurrency('ETB')}
                    className={`py-2.5 rounded-xl font-black text-xs transition-all ${payCurrency === 'ETB' ? 'bg-white text-blue-700 shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    🇪🇹 ETB (Birr)
                  </button>
                  <button
                    type="button"
                    onClick={() => setPayCurrency('USD')}
                    className={`py-2.5 rounded-xl font-black text-xs transition-all ${payCurrency === 'USD' ? 'bg-white text-blue-700 shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
                  >
                    🇺🇸 USD ($ Dollar)
                  </button>
                </div>
              </div>

              {/* Payment Type Switcher: Single vs Split */}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Dooro Nidaamka Bixinta</label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {[
                    { id: PaymentMethod.CASH, icon: Banknote, label: 'Cash' },
                    { id: PaymentMethod.BANK, icon: Landmark, label: 'Bank' },
                    { id: PaymentMethod.MOBILE_MONEY, icon: Smartphone, label: 'Mobile' }
                  ].map(method => (
                    <button
                      key={method.id}
                      type="button"
                      onClick={() => {
                        setIsSplitPayment(false);
                        setPaymentMethod(method.id as PaymentMethod);
                        // Auto-select account matching method
                        const acc = data.accounts.find(a => a.name.toLowerCase().includes(method.label.toLowerCase()));
                        if (acc) setTargetAccountId(acc.id);
                      }}
                      className={`flex flex-col items-center justify-center gap-1 p-3 rounded-2xl border-2 transition-all ${!isSplitPayment && paymentMethod === method.id ? 'border-blue-600 bg-blue-50 text-blue-700 shadow-md' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                    >
                      <method.icon size={18} />
                      <span className="text-[9px] font-black uppercase">{method.label}</span>
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={() => {
                      setIsSplitPayment(true);
                    }}
                    className={`flex flex-col items-center justify-center gap-1 p-3 rounded-2xl border-2 transition-all ${isSplitPayment ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md' : 'border-slate-100 text-slate-400 hover:border-slate-200'}`}
                  >
                    <Calculator size={18} />
                    <span className="text-[9px] font-black uppercase">🔀 Kala Bixi</span>
                  </button>
                </div>
              </div>

              {!isSplitPayment ? (
                /* SINGLE PAYMENT MODE */
                <div className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        Xaddiga Bixinta ({payCurrency})
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          if (payCurrency === 'ETB') {
                            const etbVal = (currency === Currency.USD) ? selectedForPayment.debtBalance * rate : selectedForPayment.debtBalance;
                            setPaymentAmount(etbVal.toFixed(2));
                          } else {
                            const usdVal = (currency === Currency.ETB) ? selectedForPayment.debtBalance / rate : selectedForPayment.debtBalance;
                            setPaymentAmount(usdVal.toFixed(2));
                          }
                        }}
                        className="text-[10px] font-black uppercase text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg hover:bg-blue-100"
                      >
                        BXI DHAMMAAN
                      </button>
                    </div>

                    <div className="relative">
                      <input 
                        type="number" 
                        step="any"
                        placeholder="0.00"
                        className="w-full px-5 py-3.5 bg-slate-100 border-none rounded-2xl outline-none font-black text-xl text-blue-600 focus:ring-2 focus:ring-blue-500"
                        value={paymentAmount}
                        onChange={e => setPaymentAmount(e.target.value)}
                      />
                      <span className="absolute right-4 top-1/2 -translate-y-1/2 font-black text-xs text-slate-400">
                        {payCurrency}
                      </span>
                    </div>

                    {/* Live conversion indicator */}
                    {parseFloat(paymentAmount) > 0 && (
                      <p className="text-[11px] font-bold text-slate-500 px-1">
                        Equivalent: {payCurrency === 'ETB' ? `$${(parseFloat(paymentAmount) / rate).toFixed(2)} USD` : `${(parseFloat(paymentAmount) * rate).toFixed(2)} ETB (Birr)`}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Akoonka Lacagtu Ku Dhaceyso</label>
                    <select 
                      className="w-full px-4 py-3.5 bg-slate-100 border-none rounded-2xl outline-none font-bold text-xs text-slate-700"
                      value={targetAccountId || (data.accounts[0]?.id || 'acc-cash')}
                      onChange={e => setTargetAccountId(e.target.value)}
                    >
                      {data.accounts.map(a => (
                        <option key={a.id} value={a.id}>
                          {a.name} (Haragga: {formatCurrency(a.balance, currency, rate)})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                /* SPLIT / MIXED PAYMENT MODE */
                <div className="space-y-3 bg-indigo-50/50 p-4 rounded-3xl border border-indigo-100">
                  <p className="text-[10px] font-black text-indigo-700 uppercase tracking-wider mb-1">
                    Bixi Lacagta Oo Kala Qaybsan (Cash + Bank + Mobile) — In {payCurrency}
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {/* Cash portion */}
                    <div className="space-y-1 bg-white p-3 rounded-2xl border border-slate-200">
                      <label className="text-[10px] font-black text-slate-600 flex items-center gap-1">
                        <Banknote size={12} className="text-emerald-600" /> Cash ({payCurrency})
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={splitCash}
                        onChange={e => setSplitCash(e.target.value)}
                        className="w-full p-2 bg-slate-50 border-none rounded-xl font-black text-xs text-slate-800"
                      />
                      {parseFloat(splitCash) > 0 && (
                        <p className="text-[9px] font-bold text-slate-400">
                          {payCurrency === 'ETB' ? `$${(parseFloat(splitCash) / rate).toFixed(2)}` : `${(parseFloat(splitCash) * rate).toFixed(2)} ETB`}
                        </p>
                      )}
                    </div>

                    {/* Bank portion */}
                    <div className="space-y-1 bg-white p-3 rounded-2xl border border-slate-200">
                      <label className="text-[10px] font-black text-slate-600 flex items-center gap-1">
                        <Landmark size={12} className="text-blue-600" /> Bank ({payCurrency})
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={splitBank}
                        onChange={e => setSplitBank(e.target.value)}
                        className="w-full p-2 bg-slate-50 border-none rounded-xl font-black text-xs text-slate-800"
                      />
                      {parseFloat(splitBank) > 0 && (
                        <p className="text-[9px] font-bold text-slate-400">
                          {payCurrency === 'ETB' ? `$${(parseFloat(splitBank) / rate).toFixed(2)}` : `${(parseFloat(splitBank) * rate).toFixed(2)} ETB`}
                        </p>
                      )}
                    </div>

                    {/* Mobile portion */}
                    <div className="space-y-1 bg-white p-3 rounded-2xl border border-slate-200">
                      <label className="text-[10px] font-black text-slate-600 flex items-center gap-1">
                        <Smartphone size={12} className="text-purple-600" /> Mobile ({payCurrency})
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={splitMobile}
                        onChange={e => setSplitMobile(e.target.value)}
                        className="w-full p-2 bg-slate-50 border-none rounded-xl font-black text-xs text-slate-800"
                      />
                      {parseFloat(splitMobile) > 0 && (
                        <p className="text-[9px] font-bold text-slate-400">
                          {payCurrency === 'ETB' ? `$${(parseFloat(splitMobile) / rate).toFixed(2)}` : `${(parseFloat(splitMobile) * rate).toFixed(2)} ETB`}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Calculation Summary Preview */}
              {(() => {
                const toBaseCurrency = (valStr: string) => {
                  const parsed = parseFloat(valStr) || 0;
                  if (payCurrency === 'ETB') {
                    return (currency === Currency.USD) ? parsed / rate : parsed;
                  } else {
                    return (currency === Currency.ETB) ? parsed * rate : parsed;
                  }
                };

                const paidBase = isSplitPayment 
                  ? (toBaseCurrency(splitCash) + toBaseCurrency(splitBank) + toBaseCurrency(splitMobile))
                  : toBaseCurrency(paymentAmount);

                const remainingBase = Math.max(0, selectedForPayment.debtBalance - paidBase);

                return (
                  <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200 text-xs space-y-2">
                    <div className="flex justify-between items-center text-slate-500 font-medium">
                      <span>Deynta Lagu Leeyahay Hore:</span>
                      <span className="font-bold text-slate-700">{formatCurrency(selectedForPayment.debtBalance, currency, rate)}</span>
                    </div>
                    <div className="flex justify-between items-center text-blue-700 font-black">
                      <span>Wadarta Bixinta Cusub (Total Paid):</span>
                      <span>-{formatCurrency(paidBase, currency, rate)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                      <span className="text-amber-800 font-bold">Deynta Ku Hartay (Remaining Debt):</span>
                      <span className="font-black text-amber-700">{formatCurrency(remainingBase, currency, rate)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Actions */}
            <div className="p-6 bg-slate-50 border-t flex gap-4 flex-shrink-0">
              <button 
                onClick={() => setSelectedForPayment(null)}
                className="flex-1 py-4 font-black text-slate-400 hover:text-slate-600 transition-colors text-xs uppercase"
              >
                Jooji / Cancel
              </button>
              <button 
                onClick={handleReceivePayment}
                disabled={isProcessing}
                className="flex-[2] py-4 bg-blue-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-blue-900/20 hover:bg-blue-700 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
              >
                {isProcessing ? 'Waa la shubayaa...' : 'Kaydi Bixinta'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal 3: Advance Deposit */}
      {showAdvanceModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[36px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 bg-teal-600 text-white flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
                  <PiggyBank size={24} />
                  Shub Lacag Hore (Advance Deposit)
                </h3>
                <p className="opacity-85 font-medium text-xs mt-0.5">
                  {advanceCustomer ? `Macaamiilka: ${advanceCustomer.name}` : 'Qabo lacag amaano ah oo macaamiilku dhiibtay'}
                </p>
              </div>
              <button onClick={() => setShowAdvanceModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 md:p-8 space-y-5">
              {!advanceCustomer && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Dooro Macaamiilka</label>
                  <select
                    className="w-full px-4 py-3.5 bg-slate-100 border-none rounded-2xl outline-none font-bold text-xs text-slate-700"
                    value={advanceCustomerId}
                    onChange={e => setAdvanceCustomerId(e.target.value)}
                  >
                    <option value="">Dooro Macaamiil...</option>
                    {data.customers.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.phone}) - {formatCurrency(c.advanceBalance || 0, currency, rate)} deposit
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Xaddiga Lacagta Hore ({currency})</label>
                <input 
                  type="number" 
                  placeholder="0.00"
                  className="w-full px-5 py-4 bg-slate-100 border-none rounded-2xl outline-none font-black text-2xl text-teal-600 focus:ring-2 focus:ring-teal-500"
                  value={advanceAmount}
                  onChange={e => setAdvanceAmount(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Akoonka Lacagtu Galayso (Deposit Destination)</label>
                <select 
                  className="w-full px-4 py-3.5 bg-slate-100 border-none rounded-2xl outline-none font-bold text-xs text-slate-700"
                  value={advanceAccountId}
                  onChange={e => setAdvanceAccountId(e.target.value)}
                >
                  <option value="">Dooro Akoon...</option>
                  {data.accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance, currency, rate)})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Faahfaahin / Note</label>
                <input 
                  type="text"
                  placeholder="e.g. Amaano / Deposit for future purchases..."
                  className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl outline-none font-medium text-xs"
                  value={advanceNote}
                  onChange={e => setAdvanceNote(e.target.value)}
                />
              </div>

              <div className="flex gap-4 pt-2">
                <button 
                  onClick={() => setShowAdvanceModal(false)}
                  className="flex-1 py-4 font-black text-slate-400 hover:text-slate-600 transition-colors text-xs uppercase"
                >
                  Jooji
                </button>
                <button 
                  onClick={handleDepositAdvance}
                  disabled={isProcessing}
                  className="flex-[2] py-4 bg-teal-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-teal-900/20 hover:bg-teal-700 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  {isProcessing ? 'Waa la shubayaa...' : 'Kaydi Lacagta Hore'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal 4: Advance Refund (Amaano Celin) */}
      {showRefundModal && refundCustomer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[36px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 bg-rose-600 text-white flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
                  <ArrowUpRight size={24} />
                  Celi Lacagta Hore / Amaanada
                </h3>
                <p className="opacity-85 font-medium text-xs mt-0.5">Macaamiilka: {refundCustomer.name}</p>
              </div>
              <button onClick={() => setShowRefundModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 md:p-8 space-y-5">
              <div className="bg-rose-50 border border-rose-100 p-4 rounded-2xl flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">Amaanada U Taalla</p>
                  <p className="text-xl font-black text-rose-700">{formatCurrency(refundCustomer.advanceBalance || 0, currency, rate)}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setRefundAmount((refundCustomer.advanceBalance || 0).toString())}
                  className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
                >
                  Dhammaan Celi
                </button>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Xaddiga La Celinayo ({currency})</label>
                <input 
                  type="number" 
                  placeholder="0.00"
                  max={refundCustomer.advanceBalance || 0}
                  className="w-full px-5 py-4 bg-slate-100 border-none rounded-2xl outline-none font-black text-2xl text-rose-600 focus:ring-2 focus:ring-rose-500"
                  value={refundAmount}
                  onChange={e => setRefundAmount(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Akoonka Lacagtu Ka Baxayso</label>
                <select 
                  className="w-full px-4 py-3.5 bg-slate-100 border-none rounded-2xl outline-none font-bold text-xs text-slate-700"
                  value={refundAccountId}
                  onChange={e => setRefundAccountId(e.target.value)}
                >
                  <option value="">Dooro Akoon...</option>
                  {data.accounts.map(a => (
                    <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance, currency, rate)})</option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Sababta / Note</label>
                <input 
                  type="text"
                  placeholder="e.g. Macaamiilka ayaa qaatay amaanadiisii..."
                  className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl outline-none font-medium text-xs"
                  value={refundNote}
                  onChange={e => setRefundNote(e.target.value)}
                />
              </div>

              <div className="flex gap-4 pt-2">
                <button 
                  onClick={() => setShowRefundModal(false)}
                  className="flex-1 py-4 font-black text-slate-400 hover:text-slate-600 transition-colors text-xs uppercase"
                >
                  Jooji
                </button>
                <button 
                  onClick={handleRefundAdvance}
                  disabled={isProcessing}
                  className="flex-[2] py-4 bg-rose-600 text-white rounded-2xl font-black text-sm shadow-xl shadow-rose-900/20 hover:bg-rose-700 transition-all flex items-center justify-center gap-2 active:scale-95 disabled:opacity-50"
                >
                  {isProcessing ? 'Waa la celinayaa...' : 'Bixi / Celi Amaanada'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Issue Product Debt */}
      {showProductLoanModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[36px] shadow-2xl w-full max-w-3xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in duration-300">
            {/* Header */}
            <div className="p-6 bg-indigo-600 text-white flex items-center justify-between flex-shrink-0">
              <div>
                <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
                  <ShoppingBag size={24} />
                  Sii Alaab Deynta (Issue Products on Debt)
                </h3>
                <p className="opacity-80 font-medium text-xs mt-0.5">Dooro macaamiilka iyo alaabta uu deynta ku qaadanayo</p>
              </div>
              <button onClick={() => setShowProductLoanModal(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 md:p-8 space-y-6 overflow-y-auto flex-1">
              {/* Section 1: Customer Selection */}
              <div className="space-y-3 bg-slate-50 p-5 rounded-3xl border border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-1.5">
                    <Users size={14} className="text-indigo-600" />
                    Macaamiilka Deynta Ku Qaadanaya
                  </label>
                  <button
                    onClick={() => setIsNewProdCustMode(!isNewProdCustMode)}
                    className="text-[10px] font-bold text-indigo-600 hover:underline flex items-center gap-1"
                  >
                    {isNewProdCustMode ? '← Dooro Macaamiil Hore' : '+ Ku dar Macaamiil Cusub'}
                  </button>
                </div>

                {isNewProdCustMode ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                    <input
                      type="text"
                      placeholder="Magaca Macaamiilka..."
                      value={newProdCustName}
                      onChange={e => setNewProdCustName(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none font-bold text-xs"
                    />
                    <input
                      type="text"
                      placeholder="Nambarka Telefonka (e.g. 061XXXXXXX)..."
                      value={newProdCustPhone}
                      onChange={e => setNewProdCustPhone(e.target.value)}
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none font-bold text-xs"
                    />
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="relative">
                      <Search size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Raadi magaca ama telefonka macaamiilka..."
                        value={prodCustSearch}
                        onChange={e => setProdCustSearch(e.target.value)}
                        className="w-full pl-9 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl outline-none font-bold text-xs"
                      />
                    </div>
                    <select
                      className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none font-bold text-xs text-slate-800"
                      value={prodLoanCustomerId}
                      onChange={e => setProdLoanCustomerId(e.target.value)}
                    >
                      <option value="">Dooro Macaamiil...</option>
                      {data.customers
                        .filter(c => !prodCustSearch || c.name.toLowerCase().includes(prodCustSearch.toLowerCase()) || c.phone.includes(prodCustSearch))
                        .map(c => (
                          <option key={c.id} value={c.id}>
                            {c.name} ({c.phone}) — Deynta Hore: {formatCurrency(c.debtBalance, currency, rate)}
                          </option>
                        ))}
                    </select>
                  </div>
                )}
              </div>

              {/* Section 2: Product Search & Add */}
              <div className="space-y-3">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5 px-1">
                  <Package size={14} className="text-indigo-600" />
                  Ku Dar Alaab (Search & Select Products)
                </label>
                <div className="relative">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Qor magaca ama koodka alaabta..."
                    value={prodSearch}
                    onChange={e => setProdSearch(e.target.value)}
                    className="w-full pl-11 pr-4 py-3.5 bg-slate-100 border-none rounded-2xl outline-none font-bold text-xs text-slate-800 focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Product Search Results Dropdown */}
                {prodSearch.trim().length > 0 && (
                  <div className="max-h-48 overflow-y-auto border rounded-2xl bg-white shadow-lg divide-y divide-slate-100">
                    {data.products
                      .filter(p => p.name.toLowerCase().includes(prodSearch.toLowerCase()) || p.barcode?.includes(prodSearch) || p.sku?.toLowerCase().includes(prodSearch.toLowerCase()))
                      .slice(0, 8)
                      .map(product => (
                        <div
                          key={product.id}
                          onClick={() => {
                            const liveProd = data.products.find(p => p.id === product.id) || product;
                            if (liveProd.stock <= 0) {
                              alert(`⚠️ Lama siin karo deyn sheygan "${liveProd.name}" sababtoo ah kuuma yaalo stock (Stock waa 0)!`);
                              return;
                            }

                            setProdLoanCart(prev => {
                              const existing = prev.find(item => item.product.id === product.id);
                              if (existing) {
                                if (existing.quantity + 1 > liveProd.stock) {
                                  alert(`⚠️ Lama siin karo deyn sheygan "${liveProd.name}" in ka badan inta kuu taala! (Stock-ga yaala: ${liveProd.stock})`);
                                  return prev;
                                }
                                return prev.map(item => item.product.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
                              }
                              return [...prev, { product: liveProd, quantity: 1, price: liveProd.sellPrice }];
                            });
                            setProdSearch('');
                          }}
                          className="p-3.5 flex items-center justify-between hover:bg-indigo-50 cursor-pointer transition-colors"
                        >
                          <div>
                            <p className="font-black text-slate-800 text-xs">{product.name}</p>
                            <p className="text-[10px] text-slate-400 font-medium">Stock: {product.stock} {product.unit || 'PCS'} | Price: {formatCurrency(product.sellPrice, currency, rate)}</p>
                          </div>
                          <button className="px-3 py-1 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase">
                            + Ku dar
                          </button>
                        </div>
                      ))}
                  </div>
                )}
              </div>

              {/* Section 3: Selected Products Cart Table */}
              <div className="space-y-2 border rounded-3xl overflow-hidden bg-white">
                <div className="p-4 bg-slate-100 border-b flex items-center justify-between">
                  <h4 className="font-black text-slate-800 text-xs uppercase tracking-wider flex items-center gap-2">
                    <ShoppingCart size={16} className="text-indigo-600" />
                    Alaabta Khaanada Galayso ({prodLoanCart.length})
                  </h4>
                  {prodLoanCart.length > 0 && (
                    <button onClick={() => setProdLoanCart([])} className="text-[10px] text-rose-600 font-bold hover:underline">
                      Sifee Dhamaan (Clear)
                    </button>
                  )}
                </div>

                {prodLoanCart.length > 0 ? (
                  <div className="divide-y divide-slate-100">
                    {prodLoanCart.map((item, idx) => (
                      <div key={idx} className="p-4 flex items-center justify-between gap-4">
                        <div className="flex-1">
                          <p className="font-black text-slate-900 text-xs">{item.product.name}</p>
                          <p className="text-[10px] text-slate-400 font-bold">
                            {formatCurrency(item.price, currency, rate)} x {item.quantity} = {formatCurrency(item.price * item.quantity, currency, rate)}
                          </p>
                        </div>

                        {/* Quantity controls */}
                        <div className="flex items-center gap-2 bg-slate-100 p-1 rounded-xl">
                          <button
                            onClick={() => {
                              setProdLoanCart(prev => prev.map((ci, i) => {
                                if (i === idx) {
                                  const newQty = ci.quantity - 1;
                                  return newQty > 0 ? { ...ci, quantity: newQty } : ci;
                                }
                                return ci;
                              }));
                            }}
                            className="w-7 h-7 bg-white rounded-lg flex items-center justify-center font-bold text-slate-700 hover:bg-slate-200"
                          >
                            <Minus size={12} />
                          </button>

                          <span className="w-8 text-center font-black text-xs text-slate-900">{item.quantity}</span>

                          <button
                            onClick={() => {
                              setProdLoanCart(prev => prev.map((ci, i) => {
                                if (i === idx) {
                                  const liveProd = data.products.find(p => p.id === ci.product.id) || ci.product;
                                  if (ci.quantity + 1 > liveProd.stock) {
                                    alert(`⚠️ Lama siin karo deyn sheygan "${liveProd.name}" in ka badan inta kuu taala! (Stock: ${liveProd.stock})`);
                                    return ci;
                                  }
                                  return { ...ci, quantity: ci.quantity + 1 };
                                }
                                return ci;
                              }));
                            }}
                            className="w-7 h-7 bg-white rounded-lg flex items-center justify-center font-bold text-slate-700 hover:bg-slate-200"
                          >
                            <Plus size={12} />
                          </button>
                        </div>

                        <button
                          onClick={() => setProdLoanCart(prev => prev.filter((_, i) => i !== idx))}
                          className="p-2 text-slate-300 hover:text-red-600 rounded-lg"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-8 text-center text-slate-400 font-bold text-xs">
                    Wali ma jiro alaab khaanada ku jirta. Isticmaal raadinta sare si aad alaab u soo doorato.
                  </div>
                )}
              </div>

              {/* Section 4: Calculation Breakdown */}
              {(() => {
                const totalDebtAmount = prodLoanCart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
                const selectedCust = data.customers.find(c => c.id === prodLoanCustomerId);
                const currentCustDebt = selectedCust ? selectedCust.debtBalance : 0;
                const newTotalDebt = currentCustDebt + totalDebtAmount;

                return (
                  <div className="bg-indigo-50/70 p-5 rounded-3xl border border-indigo-100 space-y-2 text-xs">
                    <div className="flex justify-between items-center text-slate-600 font-bold">
                      <span>Deynta Hore ee Macaamiilka:</span>
                      <span>{formatCurrency(currentCustDebt, currency, rate)}</span>
                    </div>
                    <div className="flex justify-between items-center text-indigo-700 font-black text-sm">
                      <span>Wadarta Alaabta Cusub ee Deynta ah:</span>
                      <span>+{formatCurrency(totalDebtAmount, currency, rate)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-indigo-200 text-slate-900 font-black text-base">
                      <span>Wadarta Deynta Cusub (New Balance):</span>
                      <span className="text-amber-600">{formatCurrency(newTotalDebt, currency, rate)}</span>
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-slate-50 border-t flex items-center justify-end gap-3 flex-shrink-0">
              <button
                onClick={() => setShowProductLoanModal(false)}
                className="px-6 py-3.5 font-black text-slate-400 hover:text-slate-600 text-xs uppercase"
              >
                Kansal / Cancel
              </button>
              <button
                onClick={handleIssueProductLoan}
                disabled={isProcessing || prodLoanCart.length === 0}
                className="px-8 py-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-indigo-900/20 transition-all disabled:opacity-50"
              >
                {isProcessing ? 'Waa la kaydinayaa...' : 'Kaydi Alaabta Deynta ah'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk WhatsApp Reminders Modal */}
      {showBulkWhatsAppModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col animate-in zoom-in duration-300">
            {/* Modal Header */}
            <div className="p-6 md:p-8 bg-amber-600 text-white flex items-center justify-between flex-shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-white/20 flex items-center justify-center">
                  <MessageSquare size={24} />
                </div>
                <div>
                  <h3 className="text-xl font-black tracking-tight">Fariimaha WhatsApp-ka ee Deylayaasha Dhammaan</h3>
                  <p className="text-xs text-amber-100 font-medium">U dir fariin faahfaahsan oo wadata taariikhaha, alaabta, tirada, qiimaha iyo akoonnada bangiyada</p>
                </div>
              </div>
              <button onClick={() => setShowBulkWhatsAppModal(false)} className="p-2 hover:bg-white/20 rounded-full transition-colors">
                <X size={20} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4 bg-amber-50 p-5 rounded-3xl border border-amber-100">
                <div>
                  <p className="text-xs font-black text-amber-800 uppercase tracking-wider">Wadarta Deylayaasha Hada</p>
                  <p className="text-2xl font-black text-amber-900 mt-0.5">
                    {data.customers.filter(c => c.debtBalance > 0).length} Macaamiil | {formatCurrency(totalCustomerDebts, currency, rate)}
                  </p>
                </div>
                <div className="w-full md:w-72 relative">
                  <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                  <input
                    type="text"
                    value={bulkFilter}
                    onChange={(e) => setBulkFilter(e.target.value)}
                    placeholder="Raadi magac ama phone..."
                    className="w-full pl-10 pr-4 py-2.5 bg-white border border-amber-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-amber-500"
                  />
                </div>
              </div>

              <div className="border rounded-3xl overflow-hidden bg-white shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b text-[10px] font-black uppercase text-slate-400 tracking-wider">
                      <th className="p-4">Macaamiilka</th>
                      <th className="p-4">Telefoonka</th>
                      <th className="p-4">Lacagta Lagu Leeyahay</th>
                      <th className="p-4 text-right">U Dir WhatsApp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
                    {data.customers
                      .filter(c => c.debtBalance > 0)
                      .filter(c => c.name.toLowerCase().includes(bulkFilter.toLowerCase()) || (c.phone && c.phone.includes(bulkFilter)))
                      .map((cust) => (
                        <tr key={cust.id} className="hover:bg-amber-50/40 transition-colors">
                          <td className="p-4 font-black text-slate-900 flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-black text-xs">
                              {cust.name.charAt(0)}
                            </div>
                            {cust.name}
                          </td>
                          <td className="p-4 font-mono text-slate-500">{cust.phone || 'Lama gelin'}</td>
                          <td className="p-4 font-black text-amber-600 font-mono text-sm">
                            {formatCurrency(cust.debtBalance, currency, rate)}
                          </td>
                          <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                              <button
                                onClick={() => sendMonthlyDebtStatement(cust, data, currency, rate, true)}
                                className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[11px] flex items-center gap-1 shadow-xs transition-all active:scale-95"
                                title="U dir faahfaahinta alaabta iyo lacagta"
                              >
                                <MessageSquare size={13} /> Faahfaahsan
                              </button>
                              <button
                                onClick={() => sendMonthlyDebtStatement(cust, data, currency, rate, false)}
                                className="px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-xl font-black text-[11px] transition-all"
                                title="U dir koobanka deynta guud"
                              >
                                Kooban
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    {data.customers.filter(c => c.debtBalance > 0).length === 0 && (
                      <tr>
                        <td colSpan={4} className="p-12 text-center text-slate-400 font-bold">
                          🎉 Wax deyn ah laguma laha macaamiisha hada!
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-slate-50 border-t flex items-center justify-between flex-shrink-0">
              <span className="text-xs text-slate-500 font-bold">
                💡 Farriintu waxay toos ugu fureysaa WhatsApp web ama App-ka.
              </span>
              <button
                onClick={() => setShowBulkWhatsAppModal(false)}
                className="px-6 py-2.5 bg-slate-800 hover:bg-slate-900 text-white rounded-xl font-black text-xs uppercase"
              >
                Xidh / Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Printable Official Statement Section (Only visible during print) */}
      {statementCustomer && (
        <div className="hidden print:block p-8 bg-white text-slate-900 text-xs font-sans max-w-4xl mx-auto">
          {/* Header */}
          <div className="border-b-2 border-slate-900 pb-4 mb-6 flex justify-between items-start">
            <div>
              <h1 className="text-2xl font-black tracking-tight uppercase text-slate-900">
                {data.settings?.businessName || 'SUPERMARKET & POS'}
              </h1>
              <p className="text-xs font-medium text-slate-600">{data.settings?.storeAddress || 'Main Branch'}</p>
              <p className="text-xs font-medium text-slate-600">Tel: {data.settings?.storePhone || '0901234567'}</p>
            </div>
            <div className="text-right">
              <span className="inline-block px-3 py-1 bg-red-600 text-white font-black rounded text-xs uppercase mb-2">
                🔴 NOT PAID (DEYN GUUD)
              </span>
              <p className="text-[10px] font-bold text-slate-500">
                Taariikhda: {new Date().toLocaleDateString('so-SO', { year: 'numeric', month: 'long', day: 'numeric' })}
              </p>
            </div>
          </div>

          {/* Customer Info */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 flex justify-between">
            <div>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Macaamiilka (Customer):</p>
              <p className="text-base font-black text-slate-900">{statementCustomer.name}</p>
              <p className="text-xs text-slate-600">Telefoonka: {statementCustomer.phone || 'N/A'}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Wadarta Deynta Hada (Total Debt):</p>
              <p className="text-xl font-black text-red-600">{formatCurrency(statementCustomer.debtBalance, currency, rate)}</p>
            </div>
          </div>

          {/* Itemized Transactions Table */}
          <div className="mb-6">
            <h3 className="font-black text-sm uppercase tracking-wider mb-2 border-b pb-1">
              📦 Diwaanka Alaabta & Dhaqdhaqaaqa Deynta
            </h3>
            <table className="w-full text-left border-collapse border border-slate-200">
              <thead>
                <tr className="bg-slate-100 text-[10px] font-black uppercase text-slate-700">
                  <th className="p-2 border border-slate-200">Taariikh</th>
                  <th className="p-2 border border-slate-200">Nooca / Invoice</th>
                  <th className="p-2 border border-slate-200">Alaabta & Faahfaahinta</th>
                  <th className="p-2 border border-slate-200 text-right">Wadarta</th>
                </tr>
              </thead>
              <tbody className="text-xs divide-y divide-slate-200">
                {data.transactions
                  .filter(t => t.customerId === statementCustomer.id || (t.customerName && t.customerName === statementCustomer.name))
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .map(tx => (
                    <tr key={tx.id}>
                      <td className="p-2 border border-slate-200 whitespace-nowrap text-slate-600">
                        {new Date(tx.timestamp).toLocaleDateString()}
                      </td>
                      <td className="p-2 border border-slate-200 font-bold">
                        {tx.type === 'CASH_LOAN' ? 'Dayn Cash' : tx.type === 'DEBT_PAYMENT' ? '🟢 Bixin Deyn' : `#INV-${(tx.id || '').slice(-5).toUpperCase()}`}
                      </td>
                      <td className="p-2 border border-slate-200">
                        {tx.items && tx.items.length > 0 ? (
                          <div className="space-y-0.5">
                            {tx.items.map((it, idx) => (
                              <div key={idx} className="text-[11px] text-slate-700">
                                • {it.name} - Qty: {it.quantity} x {formatCurrency(it.sellPrice, currency, rate)} = {formatCurrency(it.sellPrice * it.quantity, currency, rate)}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-600">{tx.notes || (tx.type === 'CASH_LOAN' ? 'Dayn lacag cadaan ah' : 'Bixin deyn')}</span>
                        )}
                      </td>
                      <td className="p-2 border border-slate-200 text-right font-black font-mono">
                        {tx.type === 'DEBT_PAYMENT' ? `-${formatCurrency(tx.total, currency, rate)}` : formatCurrency(tx.total, currency, rate)}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>

          {/* Payment Details & Accounts */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 space-y-2 mb-6">
            <h4 className="font-black text-xs uppercase tracking-wider text-slate-800">
              💳 Akoonnada Lacagta Lagu Soo Diro (Payment Accounts):
            </h4>
            <div className="grid grid-cols-3 gap-2 text-xs font-bold">
              <div>📱 1. E-Birr / Telebirr: <span className="font-black">{data.settings?.onlinePaymentNumbers?.ebirr || '0901234567'}</span></div>
              <div>🏦 2. CBE Bank: <span className="font-black">{data.settings?.onlinePaymentNumbers?.commercialBank || '1000123456789'}</span></div>
              <div>💳 3. Kaafi / Zaad: <span className="font-black">{data.settings?.onlinePaymentNumbers?.kaafi || data.settings?.onlinePaymentNumbers?.golis || '0631234567'}</span></div>
            </div>
          </div>

          {/* Polite Footer Note */}
          <div className="text-center border-t border-slate-300 pt-4 text-xs font-bold text-slate-700">
            📢 Fadlan bixi lacagta deynta lagugu leeyahay adoo raali ah. Mahadsanid wada shaqayntaada! 🙏
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteConfirm}
        title={deleteConfirm?.title || "Ma hubtaa? (Delete)"}
        message={deleteConfirm?.message || "Ma hubtaa inaad tirtirto diiwaankan?"}
        confirmText="Haa (Tirtir)"
        cancelText="Maya (Kansal)"
        onConfirm={() => deleteConfirm?.onConfirm()}
        onClose={() => setDeleteConfirm(null)}
      />
    </div>
  );
};

export default DebtorsHub;
