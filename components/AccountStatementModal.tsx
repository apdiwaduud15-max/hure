import React, { useMemo, useState } from 'react';
import { AppData, Account, AccountType, Currency, Transaction, Expense, AccountTransfer, PaymentMethod, StockAdjustment } from '../types';
import { formatCurrency, generateId } from '../lib/utils';
import { 
  X, Printer, ArrowRightLeft, TrendingUp, TrendingDown, Search, Wallet, 
  FileText, Calendar, Filter, Eye, Package, User, CreditCard, AlertCircle, ShoppingBag, Hash, Clock, Trash2, Edit2, Check, Save,
  Download, Sparkles
} from 'lucide-react';
import ConfirmModal from './ConfirmModal';

interface Props {
  account: Account | null;
  onClose: () => void;
  data: AppData;
  setData?: React.Dispatch<React.SetStateAction<AppData>>;
  addLog?: (action: string, details: string) => void;
  currency: Currency;
  rate: number;
  onOpenTransfer?: (accId: string) => void;
}

export type StatementTimeframe = 'ALL' | 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH' | 'LAST_MONTH' | 'YEAR' | 'CUSTOM_DATE' | 'CUSTOM_RANGE';

export interface StatementEntry {
  id: string;
  timestamp: number;
  type: 'SALE' | 'EXPENSE' | 'TRANSFER_IN' | 'TRANSFER_OUT' | 'DEBT_PAYMENT' | 'CASH_LOAN' | 'PURCHASE' | 'OTHER';
  title: string;
  description: string;
  direction: 'IN' | 'OUT';
  amount: number;
  runningBalance?: number;
  referenceId?: string;
  user?: string;
  rawTx?: Transaction;
  rawExpense?: Expense;
  rawTransfer?: AccountTransfer;
  rawStockAdj?: StockAdjustment;
}

interface EditFormData {
  amount: number;
  description: string;
  notes: string;
  date: string;
  accountId: string;
  toAccountId?: string;
  category?: string;
  paymentMethod?: string;
  customerId?: string;
  customerName?: string;
  quantity?: number;
  unitCost?: number;
  reason?: string;
}

const AccountStatementModal: React.FC<Props> = ({
  account,
  onClose,
  data,
  setData,
  addLog,
  currency,
  rate,
  onOpenTransfer
}) => {
  const [search, setSearch] = useState('');
  const [timeframe, setTimeframe] = useState<StatementTimeframe>('ALL');
  const [customSingleDate, setCustomSingleDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [customStartDate, setCustomStartDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 7);
    return d.toISOString().split('T')[0];
  });
  const [customEndDate, setCustomEndDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'CASH_SALES' | 'DEBT_SALES' | 'DEBT_PAYMENT' | 'TRANSFER' | 'EXPENSE_PURCHASE'>('ALL');
  const [selectedDetailEntry, setSelectedDetailEntry] = useState<StatementEntry | null>(null);
  const [deleteEntryConfirm, setDeleteEntryConfirm] = useState<StatementEntry | null>(null);
  const [editingEntry, setEditingEntry] = useState<StatementEntry | null>(null);
  const [editFormData, setEditFormData] = useState<EditFormData>({
    amount: 0,
    description: '',
    notes: '',
    date: '',
    accountId: ''
  });

  // Compute all statement entries chronologically
  const allEntries = useMemo(() => {
    if (!account) return [];

    const entries: StatementEntry[] = [];
    const isInventoryAcc = account.id === 'acc-inv' || account.name.toLowerCase().includes('inventory');
    const isIncomeAcc = account.type === AccountType.REVENUE || account.id === 'acc-sales' || account.name.toLowerCase().includes('sale') || account.name.toLowerCase().includes('income') || account.name.toLowerCase().includes('revenue');
    const isExpenseAcc = account.type === AccountType.EXPENSE || account.name.toLowerCase().includes('expense') || account.name.toLowerCase().includes('loss');
    const isDebtAcc = account.id === 'acc-ar' || account.name.toLowerCase().includes('receivable') || account.name.toLowerCase().includes('dayn') || account.name.toLowerCase().includes('deyn') || account.name.toLowerCase().includes('debt');
    const isCashAcc = account.id === 'acc-cash' || account.name.toLowerCase().includes('cash') || account.name.toLowerCase().includes('cadaan');
    const isBankAcc = account.id === 'acc-bank' || account.name.toLowerCase().includes('bank');
    const isMobileAcc = account.id === 'acc-mobile' || account.name.toLowerCase().includes('mobile') || account.name.toLowerCase().includes('zaad') || account.name.toLowerCase().includes('evc') || account.name.toLowerCase().includes('sahal') || account.name.toLowerCase().includes('golis');

    // 1. Transactions (Sales, Debt Payments, Cash Loans, Returns, Expenses)
    (data.transactions || []).forEach(tx => {
      const pm = (tx.paymentMethod || '').toLowerCase();
      const isPureDebt = pm === 'debt' || pm.includes('pure_debt');
      const custName = tx.customerName || data.customers.find(c => c.id === tx.customerId)?.name || tx.customerId || 'Customer';
      const suppName = tx.supplierName || data.suppliers.find(s => s.id === tx.supplierId)?.name || tx.supplierId || '';

      // A) Inventory Asset Account logic
      if (isInventoryAcc) {
        const totalCogs = tx.items ? tx.items.reduce((sum, item) => sum + ((item.costPrice || 0) * item.quantity), 0) : 0;
        if (totalCogs > 0) {
          if (tx.type === 'RETURN') {
            entries.push({
              id: tx.id + '-inv-ret',
              timestamp: tx.timestamp,
              type: 'SALE',
              title: 'Inventory Restocked (Customer Return)',
              description: `Alaab dib loogu soo celiyay Kaydka (Cost COGS: $${totalCogs.toFixed(2)})`,
              direction: 'IN',
              amount: totalCogs,
              referenceId: tx.id,
              rawTx: tx
            });
          } else if (tx.type === 'SALE' || !tx.type) {
            entries.push({
              id: tx.id + '-inv-cogs',
              timestamp: tx.timestamp,
              type: 'SALE',
              title: 'Stock Out (Cost of Goods Sold)',
              description: `Alaab la iibiyay ka go'day Kaydka (${tx.items ? tx.items.length : 0} alaab, Cost: $${totalCogs.toFixed(2)})`,
              direction: 'OUT',
              amount: totalCogs,
              referenceId: tx.id,
              rawTx: tx
            });
          }
        }
        return;
      }

      // B) Income / Sales Revenue Account logic
      if (isIncomeAcc) {
        if (tx.type === 'RETURN') {
          entries.push({
            id: tx.id + '-inc-ret',
            timestamp: tx.timestamp,
            type: 'SALE',
            title: 'Sales Refund (Dakhli Celin)',
            description: `Iib dib loo celiyay (Reason: ${tx.returnReason || 'Refund'})`,
            direction: 'OUT',
            amount: tx.total,
            referenceId: tx.id,
            rawTx: tx
          });
        } else if (tx.type === 'SALE' || !tx.type) {
          entries.push({
            id: tx.id + '-inc-sale',
            timestamp: tx.timestamp,
            type: 'SALE',
            title: 'Sales Revenue (Dakhli Iib)',
            description: `Iibka POS / Invoice (${tx.paymentMethod || 'Paid'})`,
            direction: 'IN',
            amount: tx.total,
            referenceId: tx.id,
            rawTx: tx
          });
        }
        return;
      }

      // C) Accounts Receivable / Debtors Account logic
      if (isDebtAcc) {
        if (tx.type === 'CASH_LOAN') {
          entries.push({
            id: tx.id + '-ar-loan',
            timestamp: tx.timestamp,
            type: 'CASH_LOAN',
            title: 'Cash Loan to Customer (Dayn Cadaan ah)',
            description: `Dayn Cadaan ah oo la siiyay: ${custName}`,
            direction: 'IN',
            amount: tx.total,
            referenceId: tx.id,
            user: custName,
            rawTx: tx
          });
        } else if (tx.type === 'DEBT_PAYMENT') {
          entries.push({
            id: tx.id + '-ar-repay',
            timestamp: tx.timestamp,
            type: 'DEBT_PAYMENT',
            title: 'Customer Debt Repayment (Dayn Bixin)',
            description: `Macaamiilka ${custName} oo bixiyay deyn`,
            direction: 'OUT',
            amount: tx.total,
            referenceId: tx.id,
            user: custName,
            rawTx: tx
          });
        } else if (isPureDebt || tx.paymentMethod === PaymentMethod.DEBT) {
          entries.push({
            id: tx.id + '-ar-sale',
            timestamp: tx.timestamp,
            type: 'SALE',
            title: 'Product Sale on Debt (Iib Dayn ah)',
            description: `Iibka deynta ah: ${custName} (${tx.items ? tx.items.length : 0} alaab)`,
            direction: 'IN',
            amount: tx.total,
            referenceId: tx.id,
            user: custName,
            rawTx: tx
          });
        } else if (tx.paymentMethod === PaymentMethod.PARTIAL && (tx.paymentDetails?.debt || 0) > 0) {
          entries.push({
            id: tx.id + '-ar-partial',
            timestamp: tx.timestamp,
            type: 'SALE',
            title: 'Partial Sale Debt Portion (Daynta Iibka)',
            description: `Qaybta deynta ah ee iibka: ${custName}`,
            direction: 'IN',
            amount: tx.paymentDetails!.debt!,
            referenceId: tx.id,
            user: custName,
            rawTx: tx
          });
        }
        return;
      }

      // D) Cash / Bank / Mobile / Liquidity Asset Accounts
      if (tx.type === 'CASH_LOAN') {
        const isTarget = tx.accountId === account.id || (!tx.accountId && isCashAcc);
        if (isTarget) {
          entries.push({
            id: tx.id,
            timestamp: tx.timestamp,
            type: 'CASH_LOAN',
            title: tx.notes?.toLowerCase().includes('amaano') || tx.notes?.toLowerCase().includes('refund') 
              ? 'Advance Refund (Amaano Celin)' 
              : 'Cash Loan Issued (Dayn Cadaan ah)',
            description: `${tx.notes || 'Lacag Cadaan Dayn ah oo ka baxday akoonka'} - Macaamiilka: ${custName}`,
            direction: 'OUT',
            amount: tx.total,
            referenceId: tx.id,
            user: custName,
            rawTx: tx
          });
        }
        return;
      }

      if (tx.type === 'DEBT_PAYMENT') {
        const isTarget = tx.accountId === account.id || (!tx.accountId && isCashAcc);
        if (isTarget) {
          const isAdvance = tx.notes?.toLowerCase().includes('advance') || tx.notes?.toLowerCase().includes('amaano') || tx.notes?.toLowerCase().includes('hore');
          entries.push({
            id: tx.id,
            timestamp: tx.timestamp,
            type: 'DEBT_PAYMENT',
            title: isAdvance ? 'Customer Advance Deposit (Amaano)' : 'Customer Debt Received (Shubid Dayn)',
            description: `${tx.notes || 'Lacag lagu shubay akoonka'} - Macaamiilka: ${custName}`,
            direction: 'IN',
            amount: tx.total,
            referenceId: tx.id,
            user: custName,
            rawTx: tx
          });
        }
        return;
      }

      if (tx.type === 'EXPENSE') {
        const isTarget = tx.accountId === account.id || (!tx.accountId && isCashAcc);
        if (isTarget) {
          const isSupplier = suppName || tx.items?.some(it => it.sku === 'SUPPLIER_PAYMENT' || it.category === 'Supplier Payment') || tx.notes?.toLowerCase().includes('supplier');
          entries.push({
            id: tx.id,
            timestamp: tx.timestamp,
            type: 'EXPENSE',
            title: isSupplier ? `Bixinta Deynta Supplier-ka (${suppName || 'Supplier'})` : 'Kharash / Expense Payment',
            description: tx.notes || `Lacag ka baxday akoonka: ${suppName || 'Deynta Supplier'}`,
            direction: 'OUT',
            amount: tx.total,
            referenceId: tx.id,
            user: suppName || custName,
            rawTx: tx
          });
        }
        return;
      }

      if (tx.type === 'RETURN') {
        const isTarget = tx.accountId === account.id || 
          (tx.paymentMethod === PaymentMethod.CASH && isCashAcc) ||
          (tx.paymentMethod === PaymentMethod.BANK && isBankAcc) ||
          (tx.paymentMethod === PaymentMethod.MOBILE_MONEY && isMobileAcc);
        if (isTarget) {
          entries.push({
            id: tx.id,
            timestamp: tx.timestamp,
            type: 'SALE',
            title: 'Customer Return / Refund',
            description: `Dib u soo celinta iibka (Reason: ${tx.returnReason || 'Return'})`,
            direction: 'OUT',
            amount: tx.total,
            referenceId: tx.id,
            rawTx: tx
          });
        }
        return;
      }

      // POS Sales (SALE or undefined type)
      if (isPureDebt || tx.paymentMethod === PaymentMethod.DEBT) {
        return;
      }

      // Check Partial / Split payments
      if (tx.paymentMethod === PaymentMethod.PARTIAL && tx.paymentDetails) {
        let partialPaidForThisAcc = 0;
        if (isCashAcc && tx.paymentDetails.cash && tx.paymentDetails.cash > 0) {
          partialPaidForThisAcc = tx.paymentDetails.cash;
        } else if (isBankAcc && tx.paymentDetails.bank && tx.paymentDetails.bank > 0) {
          partialPaidForThisAcc = tx.paymentDetails.bank;
        } else if (isMobileAcc && tx.paymentDetails.mobile && tx.paymentDetails.mobile > 0) {
          partialPaidForThisAcc = tx.paymentDetails.mobile;
        } else if (tx.accountId === account.id) {
          partialPaidForThisAcc = tx.total - (tx.paymentDetails.debt || 0);
        }

        if (partialPaidForThisAcc > 0) {
          entries.push({
            id: tx.id,
            timestamp: tx.timestamp,
            type: 'SALE',
            title: 'POS Partial Sale (Cash Received)',
            description: `Iibka POS (Qayb Cadaan/Bank ah oo la bixiyay: $${partialPaidForThisAcc.toFixed(2)} / Total: $${tx.total.toFixed(2)})`,
            direction: 'IN',
            amount: partialPaidForThisAcc,
            referenceId: tx.id,
            user: custName,
            rawTx: tx
          });
        }
        return;
      }

      // Full payment methods
      const isMatchingCash = tx.paymentMethod === PaymentMethod.CASH && (isCashAcc || tx.accountId === account.id);
      const isMatchingBank = tx.paymentMethod === PaymentMethod.BANK && (isBankAcc || tx.accountId === account.id);
      const isMatchingMobile = tx.paymentMethod === PaymentMethod.MOBILE_MONEY && (isMobileAcc || tx.accountId === account.id);
      const isMatchingDirect = tx.accountId === account.id && !tx.paymentMethod?.toLowerCase().includes('debt');

      if (isMatchingCash || isMatchingBank || isMatchingMobile || isMatchingDirect) {
        entries.push({
          id: tx.id,
          timestamp: tx.timestamp,
          type: 'SALE',
          title: `POS Sales Income (${tx.paymentMethod || 'Paid'})`,
          description: `Iibka ${tx.items ? tx.items.length : 0} alaab ah (${tx.paymentMethod || 'Paid'}) - Macaamiil: ${custName}`,
          direction: 'IN',
          amount: tx.total,
          referenceId: tx.id,
          user: custName,
          rawTx: tx
        });
      }
    });

    // 2. Expenses
    (data.expenses || []).forEach(exp => {
      if (exp.accountId === account.id || (isExpenseAcc && exp.category.toLowerCase().includes(account.name.toLowerCase()))) {
        entries.push({
          id: exp.id,
          timestamp: exp.timestamp,
          type: 'EXPENSE',
          title: `Kharash: ${exp.category}`,
          description: exp.description || 'General Expense',
          direction: isExpenseAcc ? 'IN' : 'OUT',
          amount: exp.amount,
          referenceId: exp.id,
          rawExpense: exp
        });
      }
    });

    // 3. Account Transfers
    if (data.accountTransfers) {
      data.accountTransfers.forEach(at => {
        if (at.fromAccountId === account.id) {
          entries.push({
            id: at.id + '-out',
            timestamp: at.timestamp,
            type: 'TRANSFER_OUT',
            title: `Xawilaad Bixid (Transfer Out)`,
            description: `Xawilaad loo bixiyay: ${at.toAccountName} (${at.note || ''})`,
            direction: 'OUT',
            amount: at.amount,
            referenceId: at.id,
            user: at.user,
            rawTransfer: at
          });
        }
        if (at.toAccountId === account.id) {
          entries.push({
            id: at.id + '-in',
            timestamp: at.timestamp,
            type: 'TRANSFER_IN',
            title: `Xawilaad Soo-sooc (Transfer In)`,
            description: `Xawilaad ka timid: ${at.fromAccountName} (${at.note || ''})`,
            direction: 'IN',
            amount: at.amount,
            referenceId: at.id,
            user: at.user,
            rawTransfer: at
          });
        }
      });
    }

    // 4. Stock Adjustments / Vendor Purchases
    (data.stockAdjustments || []).forEach(sa => {
      const stockCostVal = (sa.unitCost || 0) * sa.quantity;

      if (isInventoryAcc) {
        if (sa.type === 'STOCK_IN') {
          entries.push({
            id: sa.id + '-inv-add',
            timestamp: sa.timestamp,
            type: 'PURCHASE',
            title: 'Stock Added to Inventory',
            description: `Stock In: ${sa.quantity}x ${sa.productName} (Cost: $${stockCostVal.toFixed(2)})`,
            direction: 'IN',
            amount: stockCostVal || (sa.totalCost || 0),
            referenceId: sa.id,
            rawStockAdj: sa
          });
        } else if (sa.type === 'DAMAGE' || sa.type === 'EXPIRED' || sa.type === 'LOST' || sa.type === 'RETURN_TO_VENDOR') {
          entries.push({
            id: sa.id + '-inv-rem',
            timestamp: sa.timestamp,
            type: 'EXPENSE',
            title: `Stock Loss (${sa.type})`,
            description: `Stock Removed: ${sa.quantity}x ${sa.productName} (Reason: ${sa.reason || sa.type})`,
            direction: 'OUT',
            amount: stockCostVal || (sa.totalCost || 0),
            referenceId: sa.id,
            rawStockAdj: sa
          });
        }
      }

      const isMatchingAccount = (sa.accountId && sa.accountId === account.id) || 
        (!sa.accountId && (account.id === 'acc-cash' || account.name.toLowerCase().includes('cash')));

      if (sa.cashPaid && sa.cashPaid > 0 && isMatchingAccount) {
        const suppName = sa.supplierName || (sa.supplierId ? data.suppliers.find(s => s.id === sa.supplierId)?.name : '') || '';
        entries.push({
          id: sa.id + '-cash-purchase',
          timestamp: sa.timestamp,
          type: 'PURCHASE',
          title: suppName ? `Stock Purchase (${suppName})` : 'Stock Purchase Cash Payment',
          description: `Bixinta Iibsiga Stock: ${sa.quantity}x ${sa.productName}${suppName ? ` - Supplier: ${suppName}` : ''}`,
          direction: 'OUT',
          amount: sa.cashPaid,
          referenceId: sa.id,
          user: suppName,
          rawStockAdj: sa
        });
      }
    });

    // Sort chronologically (ascending) to compute running balance
    entries.sort((a, b) => a.timestamp - b.timestamp);

    let currentBal = 0;
    entries.forEach(e => {
      if (e.direction === 'IN') {
        currentBal += e.amount;
      } else {
        currentBal -= e.amount;
      }
      e.runningBalance = currentBal;
    });

    return entries.reverse();
  }, [account, data]);

  // Filter entries based on search, timeframe, and typeFilter
  const filteredEntries = useMemo(() => {
    return allEntries.filter(e => {
      const matchesSearch = 
        e.title.toLowerCase().includes(search.toLowerCase()) ||
        e.description.toLowerCase().includes(search.toLowerCase()) ||
        (e.referenceId && e.referenceId.toLowerCase().includes(search.toLowerCase())) ||
        (e.rawTx?.items && e.rawTx.items.some(it => it.name.toLowerCase().includes(search.toLowerCase())));

      if (!matchesSearch) return false;

      if (typeFilter === 'CASH_SALES') {
        const isDebt = e.rawTx?.paymentMethod === PaymentMethod.DEBT || ((e.rawTx?.paymentDetails?.debt || 0) > 0);
        if (e.type !== 'SALE' || isDebt) return false;
      }
      if (typeFilter === 'DEBT_SALES') {
        const isDebt = e.rawTx?.paymentMethod === PaymentMethod.DEBT || ((e.rawTx?.paymentDetails?.debt || 0) > 0) || e.type === 'CASH_LOAN';
        if (!isDebt && e.type !== 'CASH_LOAN') return false;
      }
      if (typeFilter === 'DEBT_PAYMENT' && e.type !== 'DEBT_PAYMENT') return false;
      if (typeFilter === 'TRANSFER' && (e.type !== 'TRANSFER_IN' && e.type !== 'TRANSFER_OUT')) return false;
      if (typeFilter === 'EXPENSE_PURCHASE' && (e.type !== 'EXPENSE' && e.type !== 'PURCHASE')) return false;

      if (timeframe === 'TODAY') {
        const start = new Date();
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setHours(23, 59, 59, 999);
        return e.timestamp >= start.getTime() && e.timestamp <= end.getTime();
      }
      if (timeframe === 'YESTERDAY') {
        const start = new Date();
        start.setDate(start.getDate() - 1);
        start.setHours(0, 0, 0, 0);
        const end = new Date();
        end.setDate(end.getDate() - 1);
        end.setHours(23, 59, 59, 999);
        return e.timestamp >= start.getTime() && e.timestamp <= end.getTime();
      }
      if (timeframe === 'WEEK') {
        const start = new Date();
        start.setDate(start.getDate() - 7);
        start.setHours(0, 0, 0, 0);
        return e.timestamp >= start.getTime();
      }
      if (timeframe === 'MONTH') {
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1, 0, 0, 0, 0).getTime();
        return e.timestamp >= startOfMonth;
      }
      if (timeframe === 'LAST_MONTH') {
        const now = new Date();
        const start = new Date(now.getFullYear(), now.getMonth() - 1, 1, 0, 0, 0, 0).getTime();
        const end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999).getTime();
        return e.timestamp >= start && e.timestamp <= end;
      }
      if (timeframe === 'YEAR') {
        const startOfYear = new Date(new Date().getFullYear(), 0, 1, 0, 0, 0, 0).getTime();
        return e.timestamp >= startOfYear;
      }
      if (timeframe === 'CUSTOM_DATE') {
        if (!customSingleDate) return true;
        const start = new Date(`${customSingleDate}T00:00:00`).getTime();
        const end = new Date(`${customSingleDate}T23:59:59.999`).getTime();
        if (isNaN(start) || isNaN(end)) return true;
        return e.timestamp >= start && e.timestamp <= end;
      }
      if (timeframe === 'CUSTOM_RANGE') {
        let valid = true;
        if (customStartDate) {
          const start = new Date(`${customStartDate}T00:00:00`).getTime();
          if (!isNaN(start)) valid = valid && e.timestamp >= start;
        }
        if (customEndDate) {
          const end = new Date(`${customEndDate}T23:59:59.999`).getTime();
          if (!isNaN(end)) valid = valid && e.timestamp <= end;
        }
        return valid;
      }

      return true;
    });
  }, [allEntries, search, timeframe, customSingleDate, customStartDate, customEndDate, typeFilter]);

  // Open Edit Modal
  const openEditEntry = (entry: StatementEntry) => {
    const entryDate = new Date(entry.timestamp).toISOString().slice(0, 16);

    if (entry.rawTx) {
      const tx = entry.rawTx;
      setEditFormData({
        amount: tx.total,
        description: entry.title,
        notes: tx.notes || '',
        date: entryDate,
        accountId: tx.accountId || account?.id || '',
        paymentMethod: tx.paymentMethod || 'CASH',
        customerId: tx.customerId || '',
        customerName: tx.customerName || ''
      });
    } else if (entry.rawExpense) {
      const exp = entry.rawExpense;
      setEditFormData({
        amount: exp.amount,
        description: exp.description || '',
        notes: '',
        date: entryDate,
        accountId: exp.accountId || account?.id || '',
        category: exp.category || 'General'
      });
    } else if (entry.rawTransfer) {
      const tr = entry.rawTransfer;
      setEditFormData({
        amount: tr.amount,
        description: 'Account Transfer',
        notes: tr.note || '',
        date: entryDate,
        accountId: tr.fromAccountId,
        toAccountId: tr.toAccountId
      });
    } else if (entry.rawStockAdj) {
      const sa = entry.rawStockAdj;
      setEditFormData({
        amount: sa.cashPaid || entry.amount,
        description: sa.productName,
        notes: sa.reason || '',
        date: entryDate,
        accountId: sa.accountId || account?.id || '',
        quantity: sa.quantity,
        unitCost: sa.unitCost || 0,
        reason: sa.reason
      });
    } else {
      setEditFormData({
        amount: entry.amount,
        description: entry.title,
        notes: entry.description,
        date: entryDate,
        accountId: account?.id || ''
      });
    }

    setEditingEntry(entry);
  };

  // Save Edit Handler
  const handleSaveEdit = () => {
    if (!editingEntry || !setData) return;
    if (editFormData.amount < 0) return alert("Fadlan geli cadad lacageed oo sax ah!");

    const newTimestamp = editFormData.date ? new Date(editFormData.date).getTime() : editingEntry.timestamp;
    const newAmount = Number(editFormData.amount) || 0;

    setData(prev => {
      let updatedProducts = [...prev.products];
      let updatedAccounts = [...prev.accounts];
      let updatedCustomers = [...prev.customers];
      let updatedTransactions = [...prev.transactions];
      let updatedExpenses = [...prev.expenses];
      let updatedTransfers = [...(prev.accountTransfers || [])];
      let updatedStockAdj = [...prev.stockAdjustments];

      // A) Transaction Edit
      if (editingEntry.rawTx) {
        const oldTx = editingEntry.rawTx;
        const oldAmount = oldTx.total;
        const oldAccId = oldTx.accountId || account?.id || 'acc-cash';
        const newAccId = editFormData.accountId || oldAccId;

        // Revert old account balance effect
        const isTxInflow = oldTx.type !== 'EXPENSE' && oldTx.type !== 'CASH_LOAN' && oldTx.type !== 'RETURN';
        const oldAccIdx = updatedAccounts.findIndex(a => a.id === oldAccId);
        if (oldAccIdx !== -1) {
          if (isTxInflow) {
            updatedAccounts[oldAccIdx] = { ...updatedAccounts[oldAccIdx], balance: updatedAccounts[oldAccIdx].balance - oldAmount };
          } else {
            updatedAccounts[oldAccIdx] = { ...updatedAccounts[oldAccIdx], balance: updatedAccounts[oldAccIdx].balance + oldAmount };
          }
        }

        // Apply new account balance effect
        const newAccIdx = updatedAccounts.findIndex(a => a.id === newAccId);
        if (newAccIdx !== -1) {
          if (isTxInflow) {
            updatedAccounts[newAccIdx] = { ...updatedAccounts[newAccIdx], balance: updatedAccounts[newAccIdx].balance + newAmount };
          } else {
            updatedAccounts[newAccIdx] = { ...updatedAccounts[newAccIdx], balance: updatedAccounts[newAccIdx].balance - newAmount };
          }
        }

        // Customer Debt Re-calculation if Debt or Payment
        if (oldTx.customerId) {
          const cIdx = updatedCustomers.findIndex(c => c.id === oldTx.customerId);
          if (cIdx !== -1) {
            if ((oldTx.paymentMethod as string) === 'Debt' || (oldTx.paymentMethod as string) === PaymentMethod.DEBT || (oldTx.paymentMethod as string) === 'debt') {
              const debtDiff = newAmount - oldAmount;
              updatedCustomers[cIdx] = { ...updatedCustomers[cIdx], debtBalance: Math.max(0, updatedCustomers[cIdx].debtBalance + debtDiff) };
            } else if (oldTx.type === 'DEBT_PAYMENT') {
              const repayDiff = newAmount - oldAmount;
              updatedCustomers[cIdx] = { ...updatedCustomers[cIdx], debtBalance: Math.max(0, updatedCustomers[cIdx].debtBalance - repayDiff) };
            } else if (oldTx.type === 'CASH_LOAN') {
              const loanDiff = newAmount - oldAmount;
              updatedCustomers[cIdx] = { ...updatedCustomers[cIdx], debtBalance: Math.max(0, updatedCustomers[cIdx].debtBalance + loanDiff) };
            }
          }
        }

        // Update Transaction
        updatedTransactions = updatedTransactions.map(t => {
          if (t.id !== oldTx.id) return t;
          return {
            ...t,
            total: newAmount,
            subtotal: newAmount,
            notes: editFormData.notes,
            timestamp: newTimestamp,
            accountId: newAccId,
            paymentMethod: (editFormData.paymentMethod as any) || t.paymentMethod,
            customerName: editFormData.customerName || t.customerName
          };
        });

        if (addLog) {
          addLog('Edit Transaction Entry', `Updated transaction ${oldTx.id} from $${oldAmount} to $${newAmount}`);
        }
      }

      // B) Expense Edit
      if (editingEntry.rawExpense) {
        const oldExp = editingEntry.rawExpense;
        const oldAmount = oldExp.amount;
        const oldAccId = oldExp.accountId || account?.id || 'acc-cash';
        const newAccId = editFormData.accountId || oldAccId;

        // Revert old account (refund old amount)
        const oldAccIdx = updatedAccounts.findIndex(a => a.id === oldAccId);
        if (oldAccIdx !== -1) {
          updatedAccounts[oldAccIdx] = { ...updatedAccounts[oldAccIdx], balance: updatedAccounts[oldAccIdx].balance + oldAmount };
        }

        // Deduct new amount from new account
        const newAccIdx = updatedAccounts.findIndex(a => a.id === newAccId);
        if (newAccIdx !== -1) {
          updatedAccounts[newAccIdx] = { ...updatedAccounts[newAccIdx], balance: updatedAccounts[newAccIdx].balance - newAmount };
        }

        // Update Expense
        updatedExpenses = updatedExpenses.map(e => {
          if (e.id !== oldExp.id) return e;
          return {
            ...e,
            amount: newAmount,
            description: editFormData.description || e.description,
            category: editFormData.category || e.category,
            accountId: newAccId,
            timestamp: newTimestamp
          };
        });

        if (addLog) {
          addLog('Edit Expense Entry', `Updated expense ${oldExp.id} from $${oldAmount} to $${newAmount}`);
        }
      }

      // C) Transfer Edit
      if (editingEntry.rawTransfer) {
        const oldTr = editingEntry.rawTransfer;
        const oldAmount = oldTr.amount;
        const oldFromId = oldTr.fromAccountId;
        const oldToId = oldTr.toAccountId;
        const newFromId = editFormData.accountId || oldFromId;
        const newToId = editFormData.toAccountId || oldToId;

        // Revert old transfer
        const oldFromIdx = updatedAccounts.findIndex(a => a.id === oldFromId);
        if (oldFromIdx !== -1) updatedAccounts[oldFromIdx] = { ...updatedAccounts[oldFromIdx], balance: updatedAccounts[oldFromIdx].balance + oldAmount };
        const oldToIdx = updatedAccounts.findIndex(a => a.id === oldToId);
        if (oldToIdx !== -1) updatedAccounts[oldToIdx] = { ...updatedAccounts[oldToIdx], balance: Math.max(0, updatedAccounts[oldToIdx].balance - oldAmount) };

        // Apply new transfer
        const newFromIdx = updatedAccounts.findIndex(a => a.id === newFromId);
        if (newFromIdx !== -1) updatedAccounts[newFromIdx] = { ...updatedAccounts[newFromIdx], balance: Math.max(0, updatedAccounts[newFromIdx].balance - newAmount) };
        const newToIdx = updatedAccounts.findIndex(a => a.id === newToId);
        if (newToIdx !== -1) updatedAccounts[newToIdx] = { ...updatedAccounts[newToIdx], balance: updatedAccounts[newToIdx].balance + newAmount };

        const toAccName = updatedAccounts.find(a => a.id === newToId)?.name || 'Target Account';
        const fromAccName = updatedAccounts.find(a => a.id === newFromId)?.name || 'Source Account';

        // Update Transfer
        updatedTransfers = updatedTransfers.map(tr => {
          if (tr.id !== oldTr.id) return tr;
          return {
            ...tr,
            amount: newAmount,
            fromAccountId: newFromId,
            fromAccountName: fromAccName,
            toAccountId: newToId,
            toAccountName: toAccName,
            note: editFormData.notes,
            timestamp: newTimestamp
          };
        });

        if (addLog) {
          addLog('Edit Transfer Entry', `Updated transfer ${oldTr.id} from $${oldAmount} to $${newAmount}`);
        }
      }

      // D) Stock Adjustment Edit
      if (editingEntry.rawStockAdj) {
        const oldSa = editingEntry.rawStockAdj;
        const oldCashPaid = oldSa.cashPaid || 0;
        const oldAccId = oldSa.accountId || account?.id || 'acc-cash';
        const newAccId = editFormData.accountId || oldAccId;

        // Revert old cash paid
        const oldAccIdx = updatedAccounts.findIndex(a => a.id === oldAccId);
        if (oldAccIdx !== -1) updatedAccounts[oldAccIdx] = { ...updatedAccounts[oldAccIdx], balance: updatedAccounts[oldAccIdx].balance + oldCashPaid };

        // Deduct new cash paid
        const newAccIdx = updatedAccounts.findIndex(a => a.id === newAccId);
        if (newAccIdx !== -1) updatedAccounts[newAccIdx] = { ...updatedAccounts[newAccIdx], balance: updatedAccounts[newAccIdx].balance - newAmount };

        updatedStockAdj = updatedStockAdj.map(sa => {
          if (sa.id !== oldSa.id) return sa;
          return {
            ...sa,
            cashPaid: newAmount,
            reason: editFormData.notes || sa.reason,
            timestamp: newTimestamp,
            accountId: newAccId
          };
        });

        if (addLog) {
          addLog('Edit Stock Adjustment', `Updated adjustment for ${oldSa.productName}`);
        }
      }

      return {
        ...prev,
        products: updatedProducts,
        accounts: updatedAccounts,
        customers: updatedCustomers,
        transactions: updatedTransactions,
        expenses: updatedExpenses,
        accountTransfers: updatedTransfers,
        stockAdjustments: updatedStockAdj
      };
    });

    setEditingEntry(null);
    setSelectedDetailEntry(null);
  };

  // Delete handler execution
  const executeDeleteEntry = (entry: StatementEntry) => {
    if (!setData) return;

    setData(prev => {
      let updatedProducts = [...prev.products];
      let updatedAccounts = [...prev.accounts];
      let updatedCustomers = [...prev.customers];
      let updatedTransactions = [...prev.transactions];
      let updatedExpenses = [...prev.expenses];
      let updatedTransfers = [...(prev.accountTransfers || [])];
      let updatedStockAdj = [...prev.stockAdjustments];

      // A) Transaction
      if (entry.rawTx) {
        const tx = entry.rawTx;
        updatedTransactions = updatedTransactions.filter(t => t.id !== tx.id);

        // Revert Product Stock
        if (tx.items) {
          tx.items.forEach(item => {
            const pIdx = updatedProducts.findIndex(p => p.id === item.id || p.name.toLowerCase() === item.name.toLowerCase());
            if (pIdx !== -1) {
              if (tx.type === 'RETURN') {
                updatedProducts[pIdx] = {
                  ...updatedProducts[pIdx],
                  stock: Math.max(0, updatedProducts[pIdx].stock - item.quantity)
                };
              } else {
                updatedProducts[pIdx] = {
                  ...updatedProducts[pIdx],
                  stock: updatedProducts[pIdx].stock + item.quantity
                };
              }
            }
          });
        }

        // Revert Financial Accounts
        const targetAccId = tx.accountId || account?.id || 'acc-cash';
        const accIdx = updatedAccounts.findIndex(a => a.id === targetAccId);
        if (accIdx !== -1) {
          if (tx.type === 'RETURN' || tx.type === 'CASH_LOAN' || tx.type === 'EXPENSE') {
            // Money was paid OUT, so deleting it adds back the balance
            updatedAccounts[accIdx] = { ...updatedAccounts[accIdx], balance: updatedAccounts[accIdx].balance + tx.total };
          } else {
            // Money was received IN, so deleting it removes the balance
            updatedAccounts[accIdx] = { ...updatedAccounts[accIdx], balance: Math.max(0, updatedAccounts[accIdx].balance - tx.total) };
          }
        }

        // Revert Customer Debt / Payments
        if (tx.customerId) {
          const cIdx = updatedCustomers.findIndex(c => c.id === tx.customerId);
          if (cIdx !== -1) {
            if ((tx.paymentMethod as string) === 'Debt' || (tx.paymentMethod as string) === PaymentMethod.DEBT || (tx.paymentMethod as string) === 'debt') {
              updatedCustomers[cIdx] = { ...updatedCustomers[cIdx], debtBalance: Math.max(0, updatedCustomers[cIdx].debtBalance - tx.total) };
            } else if (tx.type === 'DEBT_PAYMENT') {
              updatedCustomers[cIdx] = { ...updatedCustomers[cIdx], debtBalance: updatedCustomers[cIdx].debtBalance + tx.total };
            } else if (tx.type === 'CASH_LOAN') {
              updatedCustomers[cIdx] = { ...updatedCustomers[cIdx], debtBalance: Math.max(0, updatedCustomers[cIdx].debtBalance - tx.total) };
            }
          }
        }

        if (addLog && account) {
          addLog('Transaction Deleted', `Deleted transaction ${tx.id} from statement of ${account.name}`);
        }
      }

      // B) Expense
      if (entry.rawExpense) {
        const exp = entry.rawExpense;
        updatedExpenses = updatedExpenses.filter(e => e.id !== exp.id);

        const expAccId = exp.accountId || account?.id || 'acc-cash';
        const accIdx = updatedAccounts.findIndex(a => a.id === expAccId);
        if (accIdx !== -1) {
          updatedAccounts[accIdx] = { ...updatedAccounts[accIdx], balance: updatedAccounts[accIdx].balance + exp.amount };
        }

        if (addLog && account) {
          addLog('Expense Deleted', `Deleted expense ${exp.category} ($${exp.amount}) from statement of ${account.name}`);
        }
      }

      // C) Account Transfer
      if (entry.rawTransfer) {
        const at = entry.rawTransfer;
        updatedTransfers = updatedTransfers.filter(t => t.id !== at.id);

        const fromIdx = updatedAccounts.findIndex(a => a.id === at.fromAccountId);
        if (fromIdx !== -1) {
          updatedAccounts[fromIdx] = { ...updatedAccounts[fromIdx], balance: updatedAccounts[fromIdx].balance + at.amount };
        }

        const toIdx = updatedAccounts.findIndex(a => a.id === at.toAccountId);
        if (toIdx !== -1) {
          updatedAccounts[toIdx] = { ...updatedAccounts[toIdx], balance: Math.max(0, updatedAccounts[toIdx].balance - at.amount) };
        }

        if (addLog && account) {
          addLog('Transfer Deleted', `Deleted transfer ${at.id} ($${at.amount}) from statement of ${account.name}`);
        }
      }

      // D) Stock Adjustment
      if (entry.rawStockAdj) {
        const sa = entry.rawStockAdj;
        updatedStockAdj = updatedStockAdj.filter(s => s.id !== sa.id);

        const pIdx = updatedProducts.findIndex(p => p.id === sa.productId || p.name.toLowerCase() === sa.productName.toLowerCase());
        if (pIdx !== -1) {
          if ((sa.type as string) === 'ADD' || (sa.type as string) === 'PURCHASE' || sa.type === 'STOCK_IN') {
            updatedProducts[pIdx] = { ...updatedProducts[pIdx], stock: Math.max(0, updatedProducts[pIdx].stock - sa.quantity) };
          } else {
            updatedProducts[pIdx] = { ...updatedProducts[pIdx], stock: updatedProducts[pIdx].stock + sa.quantity };
          }
        }

        if (sa.cashPaid && sa.cashPaid > 0) {
          const cashAccIdx = updatedAccounts.findIndex(a => a.id === (sa.accountId || 'acc-cash') || a.name.toLowerCase().includes('cash'));
          if (cashAccIdx !== -1) {
            updatedAccounts[cashAccIdx] = { ...updatedAccounts[cashAccIdx], balance: updatedAccounts[cashAccIdx].balance + sa.cashPaid };
          }
        }

        if (addLog && account) {
          addLog('Stock Adjustment Deleted', `Deleted adjustment for ${sa.productName} from statement of ${account.name}`);
        }
      }

      let newBinItem: any = null;
      const updatedDeletedIds = { ...(prev.deletedIds || {}) };

      if (entry.rawTx) {
        updatedDeletedIds[entry.rawTx.id] = Date.now();
        newBinItem = {
          id: generateId(),
          type: 'TRANSACTION' as const,
          deletedAt: Date.now(),
          title: `Tx #${entry.rawTx.id.slice(-5).toUpperCase()} ($${(entry.rawTx.total || 0).toFixed(2)})`,
          description: `Deleted from Statement of ${account?.name || 'Account'}`,
          originalData: entry.rawTx
        };
      } else if (entry.rawExpense) {
        updatedDeletedIds[entry.rawExpense.id] = Date.now();
        newBinItem = {
          id: generateId(),
          type: 'EXPENSE' as const,
          deletedAt: Date.now(),
          title: `Expense: ${entry.rawExpense.category} ($${entry.rawExpense.amount})`,
          description: `Deleted from Statement of ${account?.name || 'Account'}`,
          originalData: entry.rawExpense
        };
      } else if (entry.rawStockAdj) {
        updatedDeletedIds[entry.rawStockAdj.id] = Date.now();
        newBinItem = {
          id: generateId(),
          type: 'STOCK_ADJUSTMENT' as const,
          deletedAt: Date.now(),
          title: `Stock Adj: ${entry.rawStockAdj.productName} (${entry.rawStockAdj.quantity})`,
          description: `Deleted from Statement of ${account?.name || 'Account'}`,
          originalData: entry.rawStockAdj
        };
      } else if (entry.rawTransfer) {
        updatedDeletedIds[entry.rawTransfer.id] = Date.now();
      }

      return {
        ...prev,
        products: updatedProducts,
        accounts: updatedAccounts,
        customers: updatedCustomers,
        transactions: updatedTransactions,
        expenses: updatedExpenses,
        accountTransfers: updatedTransfers,
        stockAdjustments: updatedStockAdj,
        recycleBin: newBinItem ? [newBinItem, ...(prev.recycleBin || [])] : (prev.recycleBin || []),
        deletedIds: updatedDeletedIds,
        lastModified: Date.now()
      };
    });

    setDeleteEntryConfirm(null);
    setSelectedDetailEntry(null);
  };

  if (!account) return null;

  const totalIn = filteredEntries.filter(e => e.direction === 'IN').reduce((sum, e) => sum + e.amount, 0);
  const totalOut = filteredEntries.filter(e => e.direction === 'OUT').reduce((sum, e) => sum + e.amount, 0);

  const getCustomerName = (custPhoneOrId?: string) => {
    if (!custPhoneOrId) return null;
    const cust = data.customers.find(c => c.id === custPhoneOrId || c.phone === custPhoneOrId);
    return cust ? `${cust.name} (${cust.phone})` : custPhoneOrId;
  };

  const exportCSV = () => {
    if (!account || filteredEntries.length === 0) {
      alert("Ma jiraan xog statement ah oo la dhoofin karo!");
      return;
    }
    const headers = ["ID", "Date", "Time", "Type", "Title", "Description", "Direction", "Amount_USD", "Reference_ID", "User"];
    const rows = filteredEntries.map(e => {
      const d = new Date(e.timestamp);
      const dateStr = d.toLocaleDateString();
      const timeStr = d.toLocaleTimeString();
      return [
        e.id,
        `"${dateStr}"`,
        `"${timeStr}"`,
        `"${e.type}"`,
        `"${(e.title || '').replace(/"/g, '""')}"`,
        `"${(e.description || '').replace(/"/g, '""')}"`,
        e.direction,
        e.amount,
        `"${e.referenceId || ''}"`,
        `"${e.user || ''}"`
      ];
    });
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Statement_${account.name.replace(/\s+/g, '_')}_${timeframe}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-3 md:p-6 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-[36px] shadow-2xl w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 md:p-8 bg-slate-900 text-white flex flex-wrap items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-blue-600/30 border border-blue-500/30 flex items-center justify-center text-blue-400 font-black text-xl shadow-inner">
              <Wallet size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black uppercase tracking-widest px-2.5 py-0.5 rounded-md bg-blue-500/20 text-blue-300 border border-blue-400/20">
                  {account.type}
                </span>
                <span className="text-xs text-slate-400 font-mono">ID: {account.id}</span>
              </div>
              <h2 className="text-2xl font-black tracking-tight text-white mt-0.5">{account.name}</h2>
              <p className="text-xs text-slate-400 font-medium">Dhaqdhaqaaqa Koontada / Full Account Ledger Statement & Edit/Delete</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="px-5 py-3 bg-slate-800 border border-slate-700/80 rounded-2xl text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Haragga Hada (Current Balance)</p>
              <p className={`text-2xl font-black font-mono ${account.balance >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                {formatCurrency(account.balance, currency, rate)}
              </p>
            </div>

            {onOpenTransfer && (
              <button
                onClick={() => onOpenTransfer(account.id)}
                className="px-5 py-3.5 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-blue-600/20 transition-all flex items-center gap-2"
              >
                <ArrowRightLeft size={16} /> Isu-shub (Transfer)
              </button>
            )}

            <button
              onClick={exportCSV}
              className="p-3 bg-slate-800 hover:bg-emerald-700 text-emerald-300 hover:text-white rounded-2xl transition-colors no-print flex items-center gap-1.5 font-bold text-xs"
              title="Soo Dejso CSV File"
            >
              <Download size={18} />
              <span className="hidden sm:inline">CSV</span>
            </button>

            <button
              onClick={() => window.print()}
              className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-2xl transition-colors no-print"
              title="Print Statement"
            >
              <Printer size={20} />
            </button>

            <button
              onClick={onClose}
              className="p-3 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-2xl transition-colors no-print"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Filter and Summary Bar */}
        <div className="p-4 md:p-6 bg-slate-50 border-b border-slate-200/80 shrink-0 space-y-3.5 no-print">
          
          {/* Row 1: Search & Type Filter & Net Stats */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input
                type="text"
                placeholder="Raadi dhaqdhaqaaq, alaab, iib, kharash, xawilaad..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-11 pr-4 py-2.5 bg-white border border-slate-200 rounded-2xl font-bold text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <div className="flex flex-wrap items-center gap-1.5 bg-white p-1 border border-slate-200 rounded-2xl overflow-x-auto">
              {([
                { id: 'ALL', label: 'Dhammaan Noocyada' },
                { id: 'CASH_SALES', label: 'Iibka Cash-ka' },
                { id: 'DEBT_SALES', label: 'Iibka Deynta' },
                { id: 'DEBT_PAYMENT', label: 'Deymaha La Bixiyay' },
                { id: 'TRANSFER', label: 'Xawilaad' },
                { id: 'EXPENSE_PURCHASE', label: 'Kharash & Stock' }
              ] as const).map(tf => (
                <button
                  key={tf.id}
                  onClick={() => setTypeFilter(tf.id as any)}
                  className={`px-3 py-1.5 rounded-xl font-black text-[10px] uppercase tracking-wider transition-all cursor-pointer ${
                    typeFilter === tf.id ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl flex items-center gap-1.5">
                <TrendingUp size={13} className="text-emerald-600" />
                <div>
                  <span className="text-[8px] font-black text-emerald-800 uppercase block leading-none">Soo Gal (+IN)</span>
                  <span className="text-xs font-black text-emerald-700 font-mono">+{formatCurrency(totalIn, currency, rate)}</span>
                </div>
              </div>

              <div className="px-3 py-1.5 bg-rose-50 border border-rose-100 rounded-xl flex items-center gap-1.5">
                <TrendingDown size={13} className="text-rose-600" />
                <div>
                  <span className="text-[8px] font-black text-rose-800 uppercase block leading-none">Ka Bax (-OUT)</span>
                  <span className="text-xs font-black text-rose-700 font-mono">-{formatCurrency(totalOut, currency, rate)}</span>
                </div>
              </div>

              <div className="px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-xl flex items-center gap-1.5">
                <Wallet size={13} className="text-blue-600" />
                <div>
                  <span className="text-[8px] font-black text-blue-800 uppercase block leading-none">Haragga (Net)</span>
                  <span className={`text-xs font-black font-mono ${totalIn - totalOut >= 0 ? 'text-blue-700' : 'text-rose-700'}`}>
                    {formatCurrency(totalIn - totalOut, currency, rate)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Row 2: Comprehensive Custom Date Filter Bar */}
          <div className="bg-white p-3 rounded-2xl border border-slate-200/80 flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-xs">
            {/* Quick Date Presets */}
            <div className="flex flex-wrap items-center gap-1.5 overflow-x-auto">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider flex items-center gap-1 mr-1">
                <Calendar size={13} className="text-blue-600" /> Taariikh:
              </span>
              
              {([
                { id: 'ALL', label: 'Dhammaan' },
                { id: 'TODAY', label: '⚡ Maanta' },
                { id: 'YESTERDAY', label: '⏪ Shalay' },
                { id: 'WEEK', label: '🗓️ 7 Maalmood' },
                { id: 'MONTH', label: '📅 Bishan' },
                { id: 'LAST_MONTH', label: '📆 Bishii Hore' },
                { id: 'YEAR', label: '🏛️ Sanadkan' },
                { id: 'CUSTOM_DATE', label: '🎯 Maalin Gaar Ah' },
                { id: 'CUSTOM_RANGE', label: '⏳ Inta u Dhaxaysa' }
              ] as const).map(tf => (
                <button
                  key={tf.id}
                  onClick={() => setTimeframe(tf.id as any)}
                  className={`px-3 py-1.5 rounded-xl font-black text-[10px] tracking-wider transition-all cursor-pointer flex items-center gap-1 ${
                    timeframe === tf.id 
                      ? 'bg-slate-900 text-white shadow-xs' 
                      : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900 border border-slate-200/60'
                  }`}
                >
                  {tf.label}
                </button>
              ))}
            </div>

            {/* Custom Single Date Input */}
            {timeframe === 'CUSTOM_DATE' && (
              <div className="flex items-center gap-2 bg-blue-50/80 px-3 py-1.5 rounded-xl border border-blue-200 animate-in fade-in duration-200">
                <span className="text-[10px] font-black text-blue-900 uppercase">📅 Dooro Maalinta:</span>
                <input
                  type="date"
                  value={customSingleDate}
                  onChange={e => setCustomSingleDate(e.target.value)}
                  className="px-3 py-1 bg-white border border-blue-300 rounded-lg text-xs font-black text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setCustomSingleDate(new Date().toISOString().split('T')[0])}
                  className="px-2 py-1 bg-blue-600 text-white rounded-lg text-[9px] font-black hover:bg-blue-700 transition-colors"
                >
                  Maanta
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const y = new Date();
                    y.setDate(y.getDate() - 1);
                    setCustomSingleDate(y.toISOString().split('T')[0]);
                  }}
                  className="px-2 py-1 bg-slate-200 text-slate-700 rounded-lg text-[9px] font-black hover:bg-slate-300 transition-colors"
                >
                  Shalay
                </button>
              </div>
            )}

            {/* Custom Date Range Inputs */}
            {timeframe === 'CUSTOM_RANGE' && (
              <div className="flex flex-wrap items-center gap-2 bg-blue-50/80 px-3 py-1.5 rounded-xl border border-blue-200 animate-in fade-in duration-200">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black text-blue-900 uppercase">Ka:</span>
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={e => setCustomStartDate(e.target.value)}
                    className="px-2.5 py-1 bg-white border border-blue-300 rounded-lg text-xs font-black text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-black text-blue-900 uppercase">Ilaa:</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={e => setCustomEndDate(e.target.value)}
                    className="px-2.5 py-1 bg-white border border-blue-300 rounded-lg text-xs font-black text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const end = new Date();
                    const start = new Date();
                    start.setDate(start.getDate() - 30);
                    setCustomStartDate(start.toISOString().split('T')[0]);
                    setCustomEndDate(end.toISOString().split('T')[0]);
                  }}
                  className="px-2 py-1 bg-blue-600 text-white rounded-lg text-[9px] font-black hover:bg-blue-700 transition-colors"
                >
                  30 Maalmood
                </button>
              </div>
            )}

            {/* Active Date Label indicator */}
            <div className="text-[10px] font-black text-slate-500 shrink-0">
              📊 Dhaqdhaqaaqyo: <strong className="text-blue-700">{filteredEntries.length}</strong>
            </div>
          </div>
        </div>

        {/* Printable Header */}
        <div className="hidden print:block p-8 border-b text-center">
          <h1 className="text-3xl font-black uppercase">{data.settings.businessName}</h1>
          <p className="text-sm font-bold text-slate-500 uppercase mt-1">Official Account Ledger Statement • {account.name}</p>
          <p className="text-xs font-mono text-slate-400 mt-1">Date: {new Date().toLocaleDateString()} | Current Balance: {formatCurrency(account.balance, currency, rate)}</p>
        </div>

        {/* Table Content */}
        <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4">
          <div className="bg-white border border-slate-200/80 rounded-2xl overflow-hidden shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                  <th className="p-3.5">Waqtiga (Date & Time)</th>
                  <th className="p-3.5">Nooca (Type)</th>
                  <th className="p-3.5">Fahfaahinta Dhaqdhaqaaqa</th>
                  <th className="p-3.5 text-center">Details</th>
                  <th className="p-3.5 text-right">Gala / Baha (Amount)</th>
                  <th className="p-3.5 text-right">Running Balance</th>
                  {setData && <th className="p-3.5 text-center no-print">Ficil (Edit / Delete)</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                {filteredEntries.map((e, idx) => {
                  const isPositive = e.direction === 'IN';
                  const itemCount = e.rawTx?.items ? e.rawTx.items.length : e.rawStockAdj ? e.rawStockAdj.quantity : null;
                  const canEditOrDelete = !!(e.rawTx || e.rawExpense || e.rawTransfer || e.rawStockAdj);

                  return (
                    <tr 
                      key={e.id + '-' + idx} 
                      onDoubleClick={() => setSelectedDetailEntry(e)}
                      className="hover:bg-blue-50/70 transition-colors cursor-pointer group"
                      title="Double click si aad u aragto alaabta iyo xogta dhameystiran"
                    >
                      {/* Date & Time */}
                      <td className="p-3.5 whitespace-nowrap">
                        <p className="text-slate-900 font-black">{new Date(e.timestamp).toLocaleDateString()}</p>
                        <p className="text-[10px] text-slate-400 font-medium">
                          {new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </p>
                      </td>

                      {/* Movement Type Badge */}
                      <td className="p-3.5 whitespace-nowrap">
                        <span className={`px-2.5 py-1 rounded-xl text-[10px] font-black uppercase tracking-tight flex items-center gap-1 w-max ${
                          e.type === 'SALE' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' :
                          e.type === 'EXPENSE' ? 'bg-rose-50 text-rose-700 border border-rose-100' :
                          e.type === 'TRANSFER_IN' ? 'bg-blue-50 text-blue-700 border border-blue-100' :
                          e.type === 'TRANSFER_OUT' ? 'bg-amber-50 text-amber-700 border border-amber-100' :
                          e.type === 'DEBT_PAYMENT' ? 'bg-purple-50 text-purple-700 border border-purple-100' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {isPositive ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {e.title}
                        </span>
                      </td>

                      {/* Description */}
                      <td className="p-3.5">
                        <p className="text-slate-800 font-bold">{e.description}</p>
                        {e.user && <p className="text-[10px] text-slate-400">User: {e.user}</p>}
                      </td>

                      {/* Quick Inspect Button / Item badge */}
                      <td className="p-3.5 text-center whitespace-nowrap">
                        <button
                          onClick={(evt) => {
                            evt.stopPropagation();
                            setSelectedDetailEntry(e);
                          }}
                          className="px-3 py-1.5 bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 rounded-xl font-black text-[10px] uppercase flex items-center gap-1.5 mx-auto transition-all shadow-2xs cursor-pointer"
                        >
                          <Eye size={13} />
                          {itemCount !== null ? `${itemCount} Alaab` : 'Arag'}
                        </button>
                      </td>

                      {/* Amount */}
                      <td className={`p-3.5 text-right font-black font-mono text-sm whitespace-nowrap ${
                        isPositive ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {isPositive ? '+' : '-'}{formatCurrency(e.amount, currency, rate)}
                      </td>

                      {/* Running Balance */}
                      <td className="p-3.5 text-right font-black font-mono text-slate-900 text-sm whitespace-nowrap">
                        {formatCurrency(e.runningBalance || 0, currency, rate)}
                      </td>

                      {/* Action Column: EDIT & DELETE */}
                      {setData && (
                        <td className="p-3.5 text-center whitespace-nowrap no-print">
                          {canEditOrDelete ? (
                            <div className="flex items-center justify-center gap-1.5">
                              {/* Edit Button */}
                              <button
                                onClick={(evt) => {
                                  evt.stopPropagation();
                                  openEditEntry(e);
                                }}
                                className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-600 text-amber-700 hover:text-white border border-amber-200 hover:border-amber-600 rounded-xl transition-all shadow-2xs font-black text-[10px] flex items-center gap-1 cursor-pointer"
                                title="Wax-ka-bedel dhaqdhaqaaqan (Edit)"
                              >
                                <Edit2 size={13} />
                                <span>Edit</span>
                              </button>

                              {/* Delete Button */}
                              <button
                                onClick={(evt) => {
                                  evt.stopPropagation();
                                  setDeleteEntryConfirm(e);
                                }}
                                className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white border border-rose-200 hover:border-rose-600 rounded-xl transition-all shadow-2xs font-black text-[10px] flex items-center gap-1 cursor-pointer"
                                title="Tirtir dhaqdhaqaaqan (Delete)"
                              >
                                <Trash2 size={13} />
                                <span>Tirtir</span>
                              </button>
                            </div>
                          ) : (
                            <span className="text-slate-300 text-[10px] italic">-</span>
                          )}
                        </td>
                      )}
                    </tr>
                  );
                })}

                {filteredEntries.length === 0 && (
                  <tr>
                    <td colSpan={setData ? 7 : 6} className="p-12 text-center text-slate-400 font-bold">
                      <Wallet size={36} className="mx-auto mb-2 opacity-30" />
                      <p className="uppercase text-xs tracking-widest">Wali ma jiro wax dhaqdhaqaaq ah oo laga diiwaan geliyay akoonkan.</p>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 md:p-6 bg-slate-50 border-t border-slate-200 shrink-0 flex justify-between items-center no-print">
          <p className="text-xs text-slate-500 font-medium">
            💡 <strong className="text-slate-800">Tip:</strong> Waxaad toos u tafatiri kartaa (Edit) ama tirtiri kartaa (Delete) dhaqdhaqaaq kasta oo akoonka ku jira.
          </p>
          <button
            onClick={onClose}
            className="px-6 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl font-black text-xs uppercase tracking-wider cursor-pointer"
          >
            Xir Statement-ka
          </button>
        </div>

      </div>

      {/* DETAILED MOVEMENT BREAKDOWN MODAL (ON DOUBLE CLICK OR CLICK) */}
      {selectedDetailEntry && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-[36px] shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-600/30 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <ShoppingBag size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-black tracking-tight">{selectedDetailEntry.title}</h3>
                  <p className="text-xs text-slate-400 font-mono">
                    Ref ID: {selectedDetailEntry.referenceId || selectedDetailEntry.id}
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setSelectedDetailEntry(null)}
                className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            {/* Modal Content Body */}
            <div className="p-6 overflow-y-auto space-y-6">
              
              {/* Meta Stats Bar */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <Clock size={12} /> Waqtiga
                  </p>
                  <p className="text-xs font-black text-slate-800 mt-1">
                    {new Date(selectedDetailEntry.timestamp).toLocaleString()}
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <CreditCard size={12} /> Lacagta Dhaqaaqday
                  </p>
                  <p className={`text-base font-black font-mono mt-1 ${
                    selectedDetailEntry.direction === 'IN' ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {selectedDetailEntry.direction === 'IN' ? '+' : '-'}{formatCurrency(selectedDetailEntry.amount, currency, rate)}
                  </p>
                </div>

                <div className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-2xl col-span-2 sm:col-span-1">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
                    <User size={12} /> User / Operator
                  </p>
                  <p className="text-xs font-black text-slate-800 mt-1 truncate">
                    {selectedDetailEntry.user || selectedDetailEntry.rawTransfer?.user || data.settings.currentUser.name}
                  </p>
                </div>
              </div>

              {/* Description / Notes */}
              <div className="p-4 bg-blue-50/60 border border-blue-100 rounded-2xl">
                <p className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Fahfaahinta Dhaqdhaqaaqa</p>
                <p className="text-sm font-bold text-slate-800 mt-0.5">{selectedDetailEntry.description}</p>
              </div>

              {/* A) ITEMS LIST IF TRANSACTION (SALE / RETURN / DEBT SALE) */}
              {selectedDetailEntry.rawTx && selectedDetailEntry.rawTx.items && selectedDetailEntry.rawTx.items.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <Package size={16} className="text-blue-600" />
                      Alaabta Iibka ah / Items Breakdown ({selectedDetailEntry.rawTx.items.length})
                    </h4>
                    <span className="text-[10px] font-bold text-slate-500">
                      Payment Method: <strong className="text-slate-800">{selectedDetailEntry.rawTx.paymentMethod}</strong>
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-2xl overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead>
                        <tr className="bg-slate-100 font-black text-slate-500 border-b border-slate-200 text-[10px] uppercase">
                          <th className="p-3">Magaca Alaabta</th>
                          <th className="p-3 text-center">Tirada (Qty)</th>
                          <th className="p-3 text-right">Qiimaha (Price)</th>
                          <th className="p-3 text-right">Cost (COGS)</th>
                          <th className="p-3 text-right">Wadarta (Subtotal)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-bold text-slate-800">
                        {selectedDetailEntry.rawTx.items.map((it, idx) => {
                          const itemTotal = (it.sellPrice || 0) * (it.quantity || 1);
                          return (
                            <tr key={it.id + '-' + idx} className="hover:bg-slate-50">
                              <td className="p-3">
                                <p className="font-black text-slate-900">{it.name}</p>
                                {it.barcode && <p className="text-[9px] text-slate-400 font-mono">BC: {it.barcode}</p>}
                              </td>
                              <td className="p-3 text-center font-black">{it.quantity}</td>
                              <td className="p-3 text-right font-mono">{formatCurrency(it.sellPrice, currency, rate)}</td>
                              <td className="p-3 text-right font-mono text-slate-500">{formatCurrency(it.costPrice || 0, currency, rate)}</td>
                              <td className="p-3 text-right font-mono font-black text-blue-600">{formatCurrency(itemTotal, currency, rate)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  {/* Customer Info if exists */}
                  {selectedDetailEntry.rawTx.customerId && (
                    <div className="p-3 bg-purple-50 border border-purple-100 rounded-xl text-xs font-bold text-purple-900 flex justify-between items-center">
                      <span>👤 Customer:</span>
                      <span className="font-black">{getCustomerName(selectedDetailEntry.rawTx.customerId)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* B) ITEM DETAIL IF STOCK ADJUSTMENT / STOCK IN */}
              {selectedDetailEntry.rawStockAdj && (
                <div className="space-y-3">
                  <h4 className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                    <Package size={16} className="text-amber-600" />
                    Alaabta Stock Adjustment Breakdown
                  </h4>
                  <div className="p-4 bg-amber-50/60 border border-amber-100 rounded-2xl space-y-2 text-xs font-bold text-amber-900">
                    <div className="flex justify-between">
                      <span>Magaca Alaabta:</span>
                      <span className="font-black text-slate-900">{selectedDetailEntry.rawStockAdj.productName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Tirada (Quantity):</span>
                      <span className="font-black text-slate-900">{selectedDetailEntry.rawStockAdj.quantity} xabadood</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Qiimaha Joogta (Cost Price):</span>
                      <span className="font-black text-slate-900">{formatCurrency(selectedDetailEntry.rawStockAdj.unitCost || 0, currency, rate)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Nooca Wax-ka-bedelka:</span>
                      <span className="font-black text-rose-700">{selectedDetailEntry.rawStockAdj.type}</span>
                    </div>
                    {selectedDetailEntry.rawStockAdj.reason && (
                      <div className="flex justify-between border-t border-amber-200/60 pt-2 mt-2">
                        <span>Sababta (Reason):</span>
                        <span className="font-black text-slate-800">{selectedDetailEntry.rawStockAdj.reason}</span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* C) EXPENSE RECEIPT IF ATTACHED */}
              {selectedDetailEntry.rawExpense?.receipt && (
                <div className="space-y-2">
                  <p className="text-xs font-black text-slate-700 uppercase">Sawirka Reshitka Kharashka (Receipt):</p>
                  <img 
                    src={selectedDetailEntry.rawExpense.receipt} 
                    alt="Receipt" 
                    className="w-full max-h-64 object-contain bg-slate-900 rounded-2xl border border-slate-800"
                  />
                </div>
              )}

              {/* D) ACCOUNT TRANSFER DETAILS */}
              {selectedDetailEntry.rawTransfer && (
                <div className="p-4 bg-blue-50 border border-blue-100 rounded-2xl space-y-2 text-xs font-bold text-slate-800">
                  <div className="flex justify-between">
                    <span>Akoonka Laga Jaray (From):</span>
                    <span className="font-black text-rose-600">{selectedDetailEntry.rawTransfer.fromAccountName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Akoonka Lagu Shubay (To):</span>
                    <span className="font-black text-emerald-600">{selectedDetailEntry.rawTransfer.toAccountName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Maddada / Note:</span>
                    <span className="font-black text-slate-900">{selectedDetailEntry.rawTransfer.note || 'None'}</span>
                  </div>
                </div>
              )}

            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-slate-50 border-t border-slate-200 shrink-0 flex flex-wrap justify-between items-center gap-3">
              <span className="text-[10px] text-slate-400 font-bold uppercase">
                Ref: {selectedDetailEntry.id}
              </span>

              <div className="flex items-center gap-2">
                {setData && (selectedDetailEntry.rawTx || selectedDetailEntry.rawExpense || selectedDetailEntry.rawTransfer || selectedDetailEntry.rawStockAdj) && (
                  <>
                    <button
                      onClick={() => {
                        const target = selectedDetailEntry;
                        setSelectedDetailEntry(null);
                        openEditEntry(target);
                      }}
                      className="px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md transition-all cursor-pointer"
                    >
                      <Edit2 size={14} /> Wax-ka-bedel (Edit)
                    </button>
                    <button
                      onClick={() => setDeleteEntryConfirm(selectedDetailEntry)}
                      className="px-4 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center gap-1.5 shadow-md shadow-rose-600/20 cursor-pointer"
                    >
                      <Trash2 size={14} /> Tirtir (Delete)
                    </button>
                  </>
                )}

                <button
                  onClick={() => setSelectedDetailEntry(null)}
                  className="px-6 py-2.5 bg-slate-900 hover:bg-black text-white rounded-xl font-black text-xs uppercase tracking-wider cursor-pointer"
                >
                  Xir Details-ka
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* EDIT MODAL FOR STATEMENT ENTRY */}
      {editingEntry && (
        <div className="fixed inset-0 z-[140] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-white rounded-[36px] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-400/30 flex items-center justify-center text-amber-400">
                  <Edit2 size={20} />
                </div>
                <div>
                  <h3 className="text-base font-black tracking-tight">Wax-ka-bedel Dhaqdhaqaaqa (Edit History)</h3>
                  <p className="text-xs text-slate-400 font-mono">{editingEntry.title}</p>
                </div>
              </div>
              <button onClick={() => setEditingEntry(null)} className="p-2 hover:bg-white/10 rounded-full transition-colors cursor-pointer">
                <X size={18} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Amount Field */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                  Cadadka Lacagta ({currency})
                </label>
                <input
                  type="number"
                  step="any"
                  value={editFormData.amount}
                  onChange={e => setEditFormData({ ...editFormData, amount: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-black text-sm text-slate-900 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* Account Selector */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1 flex items-center gap-1">
                  <Wallet size={12} className="text-blue-600" /> Akoonka Lacagtu Ku Jirto / Ka Baxday
                </label>
                <select
                  value={editFormData.accountId}
                  onChange={e => setEditFormData({ ...editFormData, accountId: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                >
                  {data.accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} ({acc.type}) - Balance: {formatCurrency(acc.balance, currency, rate)}
                    </option>
                  ))}
                </select>
              </div>

              {/* If Transfer: Target Account */}
              {editingEntry.rawTransfer && (
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1 flex items-center gap-1">
                    <ArrowRightLeft size={12} className="text-emerald-600" /> Akoonka Lagu Shubayo (To Account)
                  </label>
                  <select
                    value={editFormData.toAccountId}
                    onChange={e => setEditFormData({ ...editFormData, toAccountId: e.target.value })}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs text-slate-900 focus:ring-2 focus:ring-emerald-500"
                  >
                    {data.accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({acc.type})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* If Expense: Category & Description */}
              {editingEntry.rawExpense && (
                <>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                      Qaybta Kharashka (Category)
                    </label>
                    <select
                      value={editFormData.category}
                      onChange={e => setEditFormData({ ...editFormData, category: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs text-slate-900"
                    >
                      <option value="General">General</option>
                      <option value="Rent">Rent (Kiro)</option>
                      <option value="Utilities">Utilities (Koronto/Biyo)</option>
                      <option value="Salary">Salary (Mushahar)</option>
                      <option value="Inventory">Inventory (Alaab Keenid)</option>
                      <option value="Marketing">Marketing (Xayeysiin)</option>
                      <option value="Maintenance">Maintenance (Dayactir)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                      Faahfaahinta Kharashka
                    </label>
                    <input
                      type="text"
                      value={editFormData.description}
                      onChange={e => setEditFormData({ ...editFormData, description: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs text-slate-900"
                    />
                  </div>
                </>
              )}

              {/* If Transaction: Payment Method & Customer */}
              {editingEntry.rawTx && (
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                      Habka Bixinta (Payment Method)
                    </label>
                    <select
                      value={editFormData.paymentMethod}
                      onChange={e => setEditFormData({ ...editFormData, paymentMethod: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs text-slate-900"
                    >
                      <option value="CASH">CASH (Cadaan)</option>
                      <option value="BANK">BANK (Bangiyada)</option>
                      <option value="MOBILE_MONEY">MOBILE MONEY (Zaad / Sahal / EVC)</option>
                      <option value="Debt">DEBT (Deyn)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                      Magaca Macmiilka (Customer Name)
                    </label>
                    <input
                      type="text"
                      value={editFormData.customerName}
                      onChange={e => setEditFormData({ ...editFormData, customerName: e.target.value })}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs text-slate-900"
                    />
                  </div>
                </div>
              )}

              {/* Date & Time Picker */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                  Taariikhda & Waqtiga (Date & Time)
                </label>
                <input
                  type="datetime-local"
                  value={editFormData.date}
                  onChange={e => setEditFormData({ ...editFormData, date: e.target.value })}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs text-slate-900"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">
                  Faahfaahin Dheeraad ah (Notes)
                </label>
                <textarea
                  rows={2}
                  value={editFormData.notes}
                  onChange={e => setEditFormData({ ...editFormData, notes: e.target.value })}
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-xs text-slate-900"
                  placeholder="Geli xusid ama faahfaahin dheeraad ah..."
                />
              </div>
            </div>

            <div className="p-6 pt-0 flex gap-3">
              <button
                onClick={() => setEditingEntry(null)}
                className="flex-1 py-3 text-xs font-black text-slate-400 hover:text-slate-600 cursor-pointer"
              >
                Kansal
              </button>
              <button
                onClick={handleSaveEdit}
                className="flex-1 py-3 bg-amber-500 hover:bg-amber-600 text-slate-950 rounded-2xl text-xs font-black shadow-lg flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <Save size={16} /> Kaydi Wax-ka-bedelka
              </button>
            </div>
          </div>
        </div>
      )}

      {/* DELETE CONFIRMATION MODAL ("Ma hubtaa?") */}
      <ConfirmModal
        isOpen={!!deleteEntryConfirm}
        title="Ma hubtaa inaad tirtirto dhaqdhaqaaqan?"
        message={`Ma hubtaa inaad tirtirto dhaqdhaqaaqan: "${deleteEntryConfirm?.title}" oo Qiimihiisu yahay ${formatCurrency(deleteEntryConfirm?.amount || 0, currency, rate)}? Tallaabadan waxay dib u sixi doontaa xisaabta akoonka iyo deynta macaamiisha haddii ay khusayso.`}
        confirmText="Haa (Tirtir Dhaqdhaqaaqa)"
        cancelText="Maya (Kansal)"
        onConfirm={() => {
          if (deleteEntryConfirm) {
            executeDeleteEntry(deleteEntryConfirm);
          }
        }}
        onClose={() => setDeleteEntryConfirm(null)}
      />

    </div>
  );
};

export default AccountStatementModal;
