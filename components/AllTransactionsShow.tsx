import React, { useState, useMemo } from 'react';
import { AppData, Currency, Transaction, CartItem } from '../types';
import { formatCurrency, generateId, sendWhatsAppReceipt } from '../lib/utils';
import CustomerReturnModal from './CustomerReturnModal';
import ConfirmModal from './ConfirmModal';
import { 
  Search, 
  Download, 
  Printer, 
  Calendar, 
  Tag, 
  Coins, 
  TrendingUp, 
  ArrowUpRight, 
  Layers, 
  ChevronDown, 
  CheckCircle,
  Clock,
  User,
  ShoppingBag,
  ShoppingCart,
  Trash2,
  RotateCcw,
  Edit3,
  Save,
  X,
  Plus,
  AlertTriangle,
  Sparkles,
  CreditCard,
  Building,
  Smartphone,
  Wallet
} from 'lucide-react';

interface Props {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  addLog: (action: string, details: string) => void;
  currency: Currency;
  onLoadItemsToPOS?: (items: CartItem[], customer?: any) => void;
  setActiveTab?: (tab: any) => void;
}

export const AllTransactionsShow: React.FC<Props> = ({ 
  data, 
  setData, 
  addLog, 
  currency,
  onLoadItemsToPOS,
  setActiveTab
}) => {
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [dateRange, setDateRange] = useState<'THIS_MONTH' | 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH' | 'ALL'>('THIS_MONTH');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedCustomerFilter, setSelectedCustomerFilter] = useState('ALL');
  const [salesFilterMode, setSalesFilterMode] = useState<'ALL' | 'NON_DEBT' | 'REGULAR' | 'ICECREAM' | 'DEBT' | 'SUPPLIER_PAYMENT'>('ALL');
  const [accountFilter, setAccountFilter] = useState<string>('ALL');
  const [mainTab, setMainTab] = useState<'LOG' | 'ACCOUNT_CALCULATOR'>('LOG');
  const [selectedCalcAccount, setSelectedCalcAccount] = useState<string>('ALL');
  const onlyDebts = salesFilterMode === 'DEBT';
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [preselectedReturnTxId, setPreselectedReturnTxId] = useState<string | undefined>(undefined);
  const [deleteTxConfirmId, setDeleteTxConfirmId] = useState<string | null>(null);
  const [deleteAllConfirm, setDeleteAllConfirm] = useState(false);

  // Edit Transaction State
  const [editingTx, setEditingTx] = useState<Transaction | null>(null);
  const [editDate, setEditDate] = useState<string>('');
  const [editItems, setEditItems] = useState<CartItem[]>([]);
  const [editDiscount, setEditDiscount] = useState<number>(0);
  const [addProductSearch, setAddProductSearch] = useState<string>('');
  const [selectedAddProductId, setSelectedAddProductId] = useState<string>('');
  const [addCustomName, setAddCustomName] = useState<string>('');
  const [addCustomPrice, setAddCustomPrice] = useState<string>('');
  const [addCustomQty, setAddCustomQty] = useState<number>(1);
  const [isAddingNewItem, setIsAddingNewItem] = useState<boolean>(false);

  const openEditModal = (txId: string) => {
    const tx = data.transactions.find(t => t.id === txId);
    if (!tx) return;
    setEditingTx(tx);

    const d = new Date(tx.timestamp);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    setEditDate(`${year}-${month}-${day}T${hours}:${minutes}`);

    setEditItems(tx.items.map(i => ({ ...i })));
    setEditDiscount(tx.discount || 0);
  };

  const handleSaveTransactionEdit = () => {
    if (!editingTx) return;
    if (editItems.length === 0) {
      alert("⚠️ Transaction-ku waa inuu yeeshaa ugu yaraan 1 item.");
      return;
    }

    const newTimestamp = editDate ? new Date(editDate).getTime() : editingTx.timestamp;

    const newSubtotal = editItems.reduce((sum, item) => sum + (item.sellPrice * item.quantity), 0);
    const newTotal = Math.max(0, newSubtotal - editDiscount);

    const oldTotal = editingTx.total;
    const totalDelta = newTotal - oldTotal;

    setData(prev => {
      // 1. Adjust inventory stock
      const oldItemsMap = new Map<string, number>();
      editingTx.items.forEach(i => oldItemsMap.set(i.id, i.quantity));

      const newItemsMap = new Map<string, number>();
      editItems.forEach(i => newItemsMap.set(i.id, i.quantity));

      const allProductIds = new Set([...oldItemsMap.keys(), ...newItemsMap.keys()]);

      const newProducts = prev.products.map(p => {
        if (allProductIds.has(p.id)) {
          const oldQty = oldItemsMap.get(p.id) || 0;
          const newQty = newItemsMap.get(p.id) || 0;
          const qtyDiff = oldQty - newQty;
          return { ...p, stock: p.stock + qtyDiff };
        }
        return p;
      });

      // 2. Adjust account balance
      let updatedAccounts = [...prev.accounts];
      if (editingTx.accountId) {
        updatedAccounts = updatedAccounts.map(a => 
          a.id === editingTx.accountId ? { ...a, balance: Math.max(0, a.balance + totalDelta) } : a
        );
      } else {
        const cashAcc = updatedAccounts.find(a => a.name.toLowerCase().includes('cash'));
        if (cashAcc) {
          updatedAccounts = updatedAccounts.map(a => 
            a.id === cashAcc.id ? { ...a, balance: Math.max(0, a.balance + totalDelta) } : a
          );
        }
      }

      // 3. Adjust customer debt
      const newCustomers = prev.customers.map(c => {
        if (editingTx.customerId && c.id === editingTx.customerId) {
          if (editingTx.paymentMethod === 'Debt') {
            return { ...c, debtBalance: Math.max(0, c.debtBalance + totalDelta) };
          }
        }
        return c;
      });

      // 4. Update transaction list
      const updatedTransactions = prev.transactions.map(t => {
        if (t.id === editingTx.id) {
          return {
            ...t,
            timestamp: newTimestamp,
            items: editItems,
            subtotal: newSubtotal,
            discount: editDiscount,
            total: newTotal
          };
        }
        return t;
      });

      return {
        ...prev,
        products: newProducts,
        accounts: updatedAccounts,
        customers: newCustomers,
        transactions: updatedTransactions
      };
    });

    addLog('Transaction Edited', `Edited INV-${(editingTx?.id || '').slice(-5).toUpperCase()} - Date, Item Price, or Qty updated.`);
    setEditingTx(null);
  };

  const rate = data.settings.exchangeRate;

  // Extract all categories from products
  const categories = useMemo(() => {
    const list = new Set<string>();
    data.products.forEach(p => {
      if (p.category) list.add(p.category);
    });
    return Array.from(list);
  }, [data.products]);

  // Extract all unique customers who have made purchases
  const customersList = useMemo(() => {
    return data.customers || [];
  }, [data.customers]);

  // Expand transactions into flat list of sold items
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
      exchangeRate: number;
      currency?: string;
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

    data.transactions.forEach(tx => {
      const isDebtPayment = tx.type === 'DEBT_PAYMENT';
      const isSupplierPayment = tx.type === 'EXPENSE' || !!tx.supplierId || tx.items?.some(i => i.sku === 'SUPPLIER_PAYMENT') || tx.notes?.toLowerCase().includes('supplier');
      const isExpense = tx.type === 'EXPENSE' && !isSupplierPayment;
      const txDiscount = tx.discount || 0;
      const txExchangeRate = Number(tx.exchangeRate) > 0 ? Number(tx.exchangeRate) : (Number(rate) || 190);

      // Find customer name & debt balance
      let customerName = tx.customerName || 'Walk-in Customer';
      let remainingDebt: number | undefined = undefined;
      if (tx.customerId) {
        const found = data.customers.find(c => c.id === tx.customerId);
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
          exchangeRate: txExchangeRate,
          currency: tx.currency || 'USD',
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
  }, [data.transactions, data.customers, rate]);

  // Apply filters
  const filteredItems = useMemo(() => {
    return soldItems.filter(entry => {
      // 1. Search term (Product Name, SKU, Barcode, Tx ID, Customer Name, Page Number)
      const term = search.toLowerCase();
      const matchesSearch = !term || 
        entry.item.name.toLowerCase().includes(term) ||
        (entry.item.sku && entry.item.sku.toLowerCase().includes(term)) ||
        (entry.item.barcode && entry.item.barcode.toLowerCase().includes(term)) ||
        entry.txId.toLowerCase().includes(term) ||
        (entry.pageNumber && entry.pageNumber.toLowerCase().includes(term)) ||
        entry.customerName.toLowerCase().includes(term);

      if (!matchesSearch) return false;

      // 2. Category Filter
      if (categoryFilter !== 'ALL' && entry.item.category !== categoryFilter) {
        return false;
      }

      // 3. Customer Filter
      if (selectedCustomerFilter !== 'ALL') {
        const tx = data.transactions.find(t => t.id === entry.txId);
        if (tx?.customerId !== selectedCustomerFilter) {
          return false;
        }
      }

      // 4. Sales Type Filter (ALL, NON_DEBT, REGULAR, ICECREAM, DEBT, SUPPLIER_PAYMENT)
      const pm = (entry.paymentMethod || '').toLowerCase();
      const isDebt = pm.includes('debt') || pm.includes('deyn') || pm.includes('credit') || pm.includes('partial') || entry.item.category === 'Cash Loan';
      const cat = (entry.item.category || '').toLowerCase();
      const isIceCream = cat.includes('ice cream') || cat.includes('icecream');
      const isSupplierPayment = entry.item.sku === 'SUPPLIER_PAYMENT' || entry.item.category === 'Supplier Payment' || entry.txType === 'EXPENSE';
      const isDebtRepayment = entry.item.sku === 'DEBT_PAYMENT' || entry.item.category === 'Bixinta Deynta' || entry.txType === 'DEBT_PAYMENT';

      if (salesFilterMode === 'SUPPLIER_PAYMENT') {
        if (!isSupplierPayment) return false;
      } else if (salesFilterMode === 'DEBT') {
        if (!isDebt || isSupplierPayment) return false;
      } else if (salesFilterMode === 'NON_DEBT') {
        // Exclude debt and supplier payments
        if (isDebt || isSupplierPayment) return false;
      } else if (salesFilterMode === 'REGULAR') {
        // Regular Sales (Iibka Caadiga ah): No debt, no ice cream, no supplier payments, no debt repayments
        if (isDebt || isIceCream || isSupplierPayment || isDebtRepayment) return false;
      } else if (salesFilterMode === 'ICECREAM') {
        // Ice Cream Sales: Only Ice Cream items
        if (!isIceCream || isSupplierPayment) return false;
      } else {
        // ALL mode: Show sales transactions, exclude cash loan and supplier payments from sales table list unless specifically looking at supplier payments
        if (entry.item.category === 'Cash Loan') return false;
        if (isSupplierPayment) return false; // Prevent supplier payment from inflating regular sales in ALL mode
      }

      // 5. Account / Payment Method Filter
      if (accountFilter !== 'ALL') {
        const accId = (entry.accountId || '').toLowerCase();

        if (accountFilter === 'CASH') {
          if (!pm.includes('cash') && !pm.includes('cadaan') && !accId.includes('cash')) return false;
        } else if (accountFilter === 'BANK') {
          if (!pm.includes('bank') && !accId.includes('bank')) return false;
        } else if (accountFilter === 'MOBILE') {
          if (!pm.includes('mobile') && !pm.includes('evc') && !pm.includes('zaad') && !pm.includes('sahal') && !accId.includes('mobile') && !accId.includes('zaad') && !accId.includes('evc')) return false;
        } else {
          const matchedAccount = data.accounts?.find(a => a.id === accountFilter || a.name === accountFilter);
          if (matchedAccount) {
            if (entry.accountId !== matchedAccount.id && entry.paymentMethod !== matchedAccount.name) return false;
          } else {
            if (entry.accountId !== accountFilter && entry.paymentMethod !== accountFilter) return false;
          }
        }
      }

      // 5. Date Filter
      const entryDate = new Date(entry.timestamp);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (dateRange === 'TODAY') {
        if (entryDate < today) return false;
      } else if (dateRange === 'YESTERDAY') {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const endOfYesterday = new Date(today);
        if (entryDate < yesterday || entryDate >= endOfYesterday) return false;
      } else if (dateRange === 'WEEK') {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        if (entryDate < weekAgo) return false;
      } else if (dateRange === 'THIS_MONTH') {
        const startOfThisMonth = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
        if (entryDate < startOfThisMonth) return false;
      } else if (dateRange === 'MONTH') {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        if (entryDate < monthAgo) return false;
      } else if (dateRange === 'ALL') {
        // If Custom date picker inputs are set
        if (startDate) {
          const sDate = new Date(startDate);
          sDate.setHours(0, 0, 0, 0);
          if (entryDate < sDate) return false;
        }
        if (endDate) {
          const eDate = new Date(endDate);
          eDate.setHours(23, 59, 59, 999);
          if (entryDate > eDate) return false;
        }
      }

      return true;
    }).reverse(); // Most recent first
  }, [soldItems, search, categoryFilter, selectedCustomerFilter, salesFilterMode, accountFilter, onlyDebts, dateRange, startDate, endDate, data.transactions, data.accounts]);

  // Compute stats based on current filtered items
  const stats = useMemo(() => {
    let totalQty = 0;
    let totalCostUSD = 0;
    let totalCostETB = 0;
    let totalGrossSalesUSD = 0;
    let totalGrossSalesETB = 0;
    let totalDiscountUSD = 0;
    let totalDiscountETB = 0;
    let totalNetProfitUSD = 0;
    let totalNetProfitETB = 0;

    let cashSalesTotalUSD = 0;
    let cashSalesTotalETB = 0;
    let bankSalesTotalUSD = 0;
    let bankSalesTotalETB = 0;
    let mobileSalesTotalUSD = 0;
    let mobileSalesTotalETB = 0;
    let debtSalesTotalUSD = 0;
    let debtSalesTotalETB = 0;

    let cashQty = 0;
    let bankQty = 0;
    let mobileQty = 0;
    let debtQty = 0;

    let cashTxSet = new Set<string>();
    let bankTxSet = new Set<string>();
    let mobileTxSet = new Set<string>();
    let debtTxSet = new Set<string>();
    let totalTxSet = new Set<string>();

    // Dynamic Account Map for custom accounts in data.accounts
    const accountMap: Record<string, { id: string; name: string; type: string; totalAmountUSD: number; totalAmountETB: number; totalAmount: number; itemQty: number; txSet: Set<string> }> = {};
    (data.accounts || []).forEach(acc => {
      accountMap[acc.id] = {
        id: acc.id,
        name: acc.name,
        type: acc.type,
        totalAmountUSD: 0,
        totalAmountETB: 0,
        totalAmount: 0,
        itemQty: 0,
        txSet: new Set<string>()
      };
    });

    filteredItems.forEach(entry => {
      const isDebtPayment = entry.txType === 'DEBT_PAYMENT' || entry.item.category === 'Bixinta Deynta';
      const isSupplierPayment = entry.txType === 'EXPENSE' || entry.item.category === 'Supplier Payment' || entry.item.sku === 'SUPPLIER_PAYMENT';
      const isExpense = entry.txType === 'EXPENSE' && !isSupplierPayment;
      const txRate = entry.exchangeRate || rate || 190;

      const sellUSD = entry.totalSell;
      const sellETB = entry.totalSell * txRate;
      const costUSD = entry.totalCost;
      const costETB = entry.totalCost * txRate;
      const discountUSD = entry.unitDiscount * entry.item.quantity;
      const discountETB = discountUSD * txRate;
      const profitUSD = entry.totalProfit;
      const profitETB = entry.totalProfit * txRate;

      if (isDebtPayment) {
        // Debt collections go into cash/account collection, NOT into total product sales
        const pm = (entry.paymentMethod || '').toLowerCase();
        const isBank = pm.includes('bank');
        const isMobile = pm.includes('mobile') || pm.includes('evc') || pm.includes('zaad') || pm.includes('sahal');

        if (isBank) {
          bankSalesTotalUSD += sellUSD;
          bankSalesTotalETB += sellETB;
          if (entry.txId) bankTxSet.add(entry.txId);
        } else if (isMobile) {
          mobileSalesTotalUSD += sellUSD;
          mobileSalesTotalETB += sellETB;
          if (entry.txId) mobileTxSet.add(entry.txId);
        } else {
          cashSalesTotalUSD += sellUSD;
          cashSalesTotalETB += sellETB;
          if (entry.txId) cashTxSet.add(entry.txId);
        }

        if (entry.accountId && accountMap[entry.accountId]) {
          accountMap[entry.accountId].totalAmountUSD += sellUSD;
          accountMap[entry.accountId].totalAmountETB += sellETB;
          accountMap[entry.accountId].totalAmount += sellUSD;
          if (entry.txId) accountMap[entry.accountId].txSet.add(entry.txId);
        }
      } else if (isSupplierPayment || isExpense) {
        // Supplier payments / Expenses are outflows, DO NOT add to product sales revenue or profit
        if (entry.txId) totalTxSet.add(entry.txId);
      } else {
        totalQty += entry.item.quantity;
        totalCostUSD += costUSD;
        totalCostETB += costETB;
        totalGrossSalesUSD += sellUSD;
        totalGrossSalesETB += sellETB;
        totalDiscountUSD += discountUSD;
        totalDiscountETB += discountETB;
        totalNetProfitUSD += profitUSD;
        totalNetProfitETB += profitETB;
        if (entry.txId) totalTxSet.add(entry.txId);

        const pm = (entry.paymentMethod || '').toLowerCase();
        const isDebt = pm.includes('debt') || pm.includes('deyn') || pm.includes('credit') || pm.includes('partial') || entry.item.category === 'Cash Loan';
        const isBank = pm.includes('bank');
        const isMobile = pm.includes('mobile') || pm.includes('evc') || pm.includes('zaad') || pm.includes('sahal');

        if (isDebt) {
          debtSalesTotalUSD += sellUSD;
          debtSalesTotalETB += sellETB;
          debtQty += entry.item.quantity;
          if (entry.txId) debtTxSet.add(entry.txId);
        } else if (isBank) {
          bankSalesTotalUSD += sellUSD;
          bankSalesTotalETB += sellETB;
          bankQty += entry.item.quantity;
          if (entry.txId) bankTxSet.add(entry.txId);
        } else if (isMobile) {
          mobileSalesTotalUSD += sellUSD;
          mobileSalesTotalETB += sellETB;
          mobileQty += entry.item.quantity;
          if (entry.txId) mobileTxSet.add(entry.txId);
        } else {
          cashSalesTotalUSD += sellUSD;
          cashSalesTotalETB += sellETB;
          cashQty += entry.item.quantity;
          if (entry.txId) cashTxSet.add(entry.txId);
        }

        // Track into custom store account if matched
        if (entry.accountId && accountMap[entry.accountId]) {
          accountMap[entry.accountId].totalAmountUSD += sellUSD;
          accountMap[entry.accountId].totalAmountETB += sellETB;
          accountMap[entry.accountId].totalAmount += sellUSD;
          accountMap[entry.accountId].itemQty += entry.item.quantity;
          if (entry.txId) accountMap[entry.accountId].txSet.add(entry.txId);
        }
      }
    });

    const nonDebtSalesTotalUSD = cashSalesTotalUSD + bankSalesTotalUSD + mobileSalesTotalUSD;
    const nonDebtSalesTotalETB = cashSalesTotalETB + bankSalesTotalETB + mobileSalesTotalETB;
    const nonDebtQty = cashQty + bankQty + mobileQty;
    const nonDebtTxCount = new Set([...cashTxSet, ...bankTxSet, ...mobileTxSet]).size;

    return {
      totalQty,
      totalCostUSD,
      totalCostETB,
      totalCost: totalCostUSD,
      totalGrossSalesUSD,
      totalGrossSalesETB,
      totalGrossSales: totalGrossSalesUSD,
      totalDiscountUSD,
      totalDiscountETB,
      totalDiscount: totalDiscountUSD,
      totalNetProfitUSD,
      totalNetProfitETB,
      totalNetProfit: totalNetProfitUSD,
      totalTxCount: totalTxSet.size,

      cashSalesTotalUSD,
      cashSalesTotalETB,
      cashSalesTotal: cashSalesTotalUSD,
      cashQty,
      cashTxCount: cashTxSet.size,

      bankSalesTotalUSD,
      bankSalesTotalETB,
      bankSalesTotal: bankSalesTotalUSD,
      bankQty,
      bankTxCount: bankTxSet.size,

      mobileSalesTotalUSD,
      mobileSalesTotalETB,
      mobileSalesTotal: mobileSalesTotalUSD,
      mobileQty,
      mobileTxCount: mobileTxSet.size,

      debtSalesTotalUSD,
      debtSalesTotalETB,
      debtSalesTotal: debtSalesTotalUSD,
      debtQty,
      debtTxCount: debtTxSet.size,

      nonDebtSalesTotalUSD,
      nonDebtSalesTotalETB,
      nonDebtSalesTotal: nonDebtSalesTotalUSD,
      nonDebtQty,
      nonDebtTxCount,

      accountMap
    };
  }, [filteredItems, data.accounts, rate]);

  // Helper to format stat values accurately based on active currency
  const formatStatValue = (valUSD: number, valETB: number) => {
    if (currency === Currency.ETB) {
      return `${Math.round(valETB).toLocaleString()} ETB`;
    }
    return `$${valUSD.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  // Export to CSV Function
  const exportToCSV = () => {
    const headers = [
      'Transaction ID', 
      'Date & Time', 
      'Product Name', 
      'Category', 
      'Unit Type', 
      'Quantity Sold', 
      'Unit Cost Price (USD)', 
      'Unit Reg Sell Price (USD)', 
      'Unit Discount (USD)', 
      'Unit Final Price (USD)', 
      'Unit Profit (USD)', 
      'Total Cost (USD)', 
      'Total Sales (USD)', 
      'Total Net Profit (USD)', 
      'Payment Method', 
      'Customer'
    ];

    const rows = filteredItems.map(item => [
      `"TX-${item.txId.slice(-6).toUpperCase()}"`,
      `"${new Date(item.timestamp).toLocaleString()}"`,
      `"${item.item.name.replace(/"/g, '""')}"`,
      `"${item.item.category.replace(/"/g, '""')}"`,
      `"${item.item.unit || 'PCS'}"`,
      item.item.quantity,
      item.unitCost,
      item.unitSell,
      item.unitDiscount,
      item.finalUnitSell,
      item.unitProfit,
      item.totalCost,
      item.totalSell,
      item.totalProfit,
      `"${item.paymentMethod}"`,
      `"${item.customerName.replace(/"/g, '""')}"`
    ]);

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `detailed_sales_report_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const printReport = () => {
    window.print();
  };

  const handleDeleteTransaction = (txId: string) => {
    setDeleteTxConfirmId(txId);
  };

  const executeDeleteTransaction = (txId: string) => {
    const tx = data.transactions.find(t => t.id === txId);
    if (!tx) return;

    setData(prev => {
      // 1. Revert Product Stock
      const newProducts = prev.products.map(p => {
        const soldItem = tx.items.find(item => item.id === p.id);
        return soldItem ? { ...p, stock: p.stock + soldItem.quantity } : p;
      });

      // 2. Revert Financial Accounts
      let updatedAccounts = [...prev.accounts];
      const totalCost = tx.items.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
      const invAcc = updatedAccounts.find(a => a.id === 'acc-inv' || a.name.toLowerCase().includes('inventory'));
      if (invAcc) {
        updatedAccounts = updatedAccounts.map(a => a.id === invAcc.id ? { ...a, balance: a.balance + totalCost } : a);
      }

      if (tx.paymentMethod === 'Partial Payment' && tx.paymentDetails) {
        const cashAcc = updatedAccounts.find(a => a.name.toLowerCase().includes('cash'));
        const bankAcc = updatedAccounts.find(a => a.name.toLowerCase().includes('bank'));
        const mobileAcc = updatedAccounts.find(a => a.name.toLowerCase().includes('mobile'));

        if (tx.paymentDetails.cash > 0 && cashAcc) {
          updatedAccounts = updatedAccounts.map(a => a.id === cashAcc.id ? { ...a, balance: Math.max(0, a.balance - tx.paymentDetails!.cash) } : a);
        }
        if (tx.paymentDetails.bank > 0 && bankAcc) {
          updatedAccounts = updatedAccounts.map(a => a.id === bankAcc.id ? { ...a, balance: Math.max(0, a.balance - tx.paymentDetails!.bank) } : a);
        }
        if (tx.paymentDetails.mobile > 0 && mobileAcc) {
          updatedAccounts = updatedAccounts.map(a => a.id === mobileAcc.id ? { ...a, balance: Math.max(0, a.balance - tx.paymentDetails!.mobile) } : a);
        }
      } else if (tx.paymentMethod !== 'Debt' && tx.accountId) {
        updatedAccounts = updatedAccounts.map(a => a.id === tx.accountId ? { ...a, balance: Math.max(0, a.balance - tx.total) } : a);
      }

      // 3. Revert Customer Debt / Loyalty Points
      const newCustomers = prev.customers.map(c => {
        if (tx.customerId && c.id === tx.customerId) {
          const debtToRevert = tx.paymentMethod === 'Debt'
            ? tx.total
            : (tx.paymentMethod === 'Partial Payment' && tx.paymentDetails ? tx.paymentDetails.debt : 0);
          return {
            ...c,
            debtBalance: Math.max(0, c.debtBalance - debtToRevert),
            loyaltyPoints: Math.max(0, c.loyaltyPoints - Math.floor(tx.total)),
            history: c.history.filter(id => id !== tx.id)
          };
        }
        return c;
      });

      const binItem = {
        id: generateId(),
        type: 'TRANSACTION' as const,
        deletedAt: Date.now(),
        title: `Invoice #INV-${tx.id.slice(-5).toUpperCase()} ($${tx.total.toFixed(2)})`,
        description: `Items: ${tx.items?.length || 0} • Payment: ${tx.paymentMethod} • Date: ${new Date(tx.timestamp).toLocaleString()}`,
        originalData: tx
      };

      const updatedDeletedIds = { ...(prev.deletedIds || {}) };
      updatedDeletedIds[tx.id] = Date.now();

      return {
        ...prev,
        transactions: prev.transactions.filter(t => t.id !== tx.id),
        products: newProducts,
        accounts: updatedAccounts,
        customers: newCustomers,
        recycleBin: [binItem, ...(prev.recycleBin || [])],
        deletedIds: updatedDeletedIds,
        lastModified: Date.now()
      };
    });

    addLog('Transaction Deleted', `Transaction #INV-${tx.id.slice(-5).toUpperCase()} was deleted.`);
  };

  const executeDeleteAllTransactions = () => {
    if (data.transactions.length === 0) return;

    setData(prev => {
      // 1. Calculate stock to restore for all products
      const stockToRestore = new Map<string, number>();

      prev.transactions.forEach(tx => {
        if (tx.items) {
          tx.items.forEach(item => {
            const qty = item.quantity || 0;
            const current = stockToRestore.get(item.id) || 0;
            if (tx.type === 'RETURN') {
              stockToRestore.set(item.id, current - qty);
            } else {
              stockToRestore.set(item.id, current + qty);
            }
          });
        }
      });

      // 2. Restore Product Stock in inventory
      const updatedProducts = prev.products.map(p => {
        const restoreQty = stockToRestore.get(p.id);
        if (restoreQty && restoreQty !== 0) {
          return {
            ...p,
            stock: Math.max(0, p.stock + restoreQty)
          };
        }
        return p;
      });

      // 3. Revert Customer Debts & Loyalty Points created by transactions
      const debtToRevertMap = new Map<string, number>();
      const loyaltyToRevertMap = new Map<string, number>();

      prev.transactions.forEach(tx => {
        if (tx.customerId) {
          const debtToRevert = tx.paymentMethod === 'Debt'
            ? tx.total
            : (tx.paymentMethod === 'Partial Payment' && tx.paymentDetails ? tx.paymentDetails.debt : 0);

          const curDebt = debtToRevertMap.get(tx.customerId) || 0;
          debtToRevertMap.set(tx.customerId, curDebt + debtToRevert);

          const curLoyalty = loyaltyToRevertMap.get(tx.customerId) || 0;
          loyaltyToRevertMap.set(tx.customerId, curLoyalty + Math.floor(tx.total));
        }
      });

      const updatedCustomers = prev.customers.map(c => {
        const debtRevert = debtToRevertMap.get(c.id) || 0;
        const loyaltyRevert = loyaltyToRevertMap.get(c.id) || 0;

        if (debtRevert > 0 || loyaltyRevert > 0) {
          return {
            ...c,
            debtBalance: Math.max(0, c.debtBalance - debtRevert),
            loyaltyPoints: Math.max(0, c.loyaltyPoints - loyaltyRevert),
            history: []
          };
        }
        return c;
      });

      const newBinItems = prev.transactions.map(tx => ({
        id: generateId(),
        type: 'TRANSACTION' as const,
        deletedAt: Date.now(),
        title: `Invoice #INV-${tx.id.slice(-5).toUpperCase()} ($${tx.total.toFixed(2)})`,
        description: `Batch Delete • Items: ${tx.items?.length || 0} • Payment: ${tx.paymentMethod}`,
        originalData: tx
      }));

      const updatedDeletedIds = { ...(prev.deletedIds || {}) };
      prev.transactions.forEach(t => {
        updatedDeletedIds[t.id] = Date.now();
      });

      return {
        ...prev,
        transactions: [],
        products: updatedProducts,
        customers: updatedCustomers,
        recycleBin: [...newBinItems, ...(prev.recycleBin || [])],
        deletedIds: updatedDeletedIds,
        lastModified: Date.now()
      };
    });

    addLog('All Transactions Deleted', `All ${data.transactions.length} transactions deleted and product stocks returned to inventory.`);
    setDeleteAllConfirm(false);
  };

  const handleRefundItem = (txId: string, itemToRefund: CartItem) => {
    const tx = data.transactions.find(t => t.id === txId);
    if (!tx) return;
    if (!confirm(`⚠️ Ma hubtaa inaad soo celiso (Refund) alaabta "${itemToRefund.name}" (Qty: ${itemToRefund.quantity})? Stock-gu wuxuu ku noqon doonaa bakhaarka, lacagteedana waa la soo celin doonaa.`)) return;

    const refundValue = itemToRefund.sellPrice * itemToRefund.quantity;

    setData(prev => {
      // 1. Restore Stock
      const newProducts = prev.products.map(p => {
        if (p.id === itemToRefund.id) {
          return { ...p, stock: p.stock + itemToRefund.quantity };
        }
        return p;
      });

      // 2. Adjust Financial Accounts
      let updatedAccounts = [...prev.accounts];
      if (tx.accountId) {
        updatedAccounts = updatedAccounts.map(a => a.id === tx.accountId ? { ...a, balance: Math.max(0, a.balance - refundValue) } : a);
      } else {
        const cashAcc = updatedAccounts.find(a => a.name.toLowerCase().includes('cash'));
        if (cashAcc) {
          updatedAccounts = updatedAccounts.map(a => a.id === cashAcc.id ? { ...a, balance: Math.max(0, a.balance - refundValue) } : a);
        }
      }

      // 3. Update Transaction items
      const updatedTxList = prev.transactions.map(t => {
        if (t.id === txId) {
          const remainingItems = t.items.filter(i => i.id !== itemToRefund.id);
          const newSubtotal = Math.max(0, t.subtotal - refundValue);
          const newTotal = Math.max(0, t.total - refundValue);
          return {
            ...t,
            items: remainingItems,
            subtotal: newSubtotal,
            total: newTotal
          };
        }
        return t;
      }).filter(t => t.items.length > 0);

      return {
        ...prev,
        products: newProducts,
        accounts: updatedAccounts,
        transactions: updatedTxList
      };
    });

    addLog('Item Refunded', `Refunded ${itemToRefund.quantity} x ${itemToRefund.name} from INV-${tx.id.slice(-5).toUpperCase()}`);
  };

  return (
    <div className="space-y-6 p-4 md:p-8 max-w-[1600px] mx-auto">
      
      {/* Header section with Main Navigation Tabs & Action Buttons */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 bg-white p-6 rounded-[32px] border shadow-sm no-print">
        <div>
          <h1 className="text-xl font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
            <ShoppingBag className="text-blue-600" size={24} /> All Transactions Show (Sold Items Log)
          </h1>
          <p className="text-xs text-slate-400 font-bold uppercase mt-1">Detailed Itemized Product Profit & Account Breakdown Calculator</p>
        </div>

        {/* Main Navigation Tabs */}
        <div className="flex bg-slate-100 p-1.5 rounded-2xl border border-slate-200/80 w-full lg:w-auto shadow-inner">
          <button
            type="button"
            onClick={() => setMainTab('LOG')}
            className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-black transition-all ${
              mainTab === 'LOG'
                ? 'bg-white text-slate-900 shadow-sm ring-1 ring-slate-200'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <ShoppingBag size={16} className={mainTab === 'LOG' ? 'text-blue-600' : ''} />
            📋 Shaxda Iibka (Sales Log Table)
          </button>

          <button
            type="button"
            onClick={() => setMainTab('ACCOUNT_CALCULATOR')}
            className={`flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-3 rounded-xl text-xs font-black transition-all ${
              mainTab === 'ACCOUNT_CALCULATOR'
                ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <Wallet size={16} />
            📊 Tap-ka Accounts-ka & Deymaha (Accounts Calculator)
          </button>
        </div>

        <div className="flex flex-wrap gap-2 w-full lg:w-auto">
          <button 
            onClick={exportToCSV}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-3.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
          >
            <Download size={14} /> Export CSV
          </button>
          <button 
            onClick={printReport}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-3.5 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
          >
            <Printer size={14} /> Print Report
          </button>
          <button 
            onClick={() => setDeleteAllConfirm(true)}
            disabled={data.transactions.length === 0}
            className="flex-1 lg:flex-none flex items-center justify-center gap-2 px-5 py-3.5 bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all shadow-md shadow-rose-600/20"
          >
            <Trash2 size={16} /> Tirtir Dhammaan (Delete All)
          </button>
        </div>
      </div>

      {mainTab === 'ACCOUNT_CALCULATOR' ? (
        /* ==================== ACCOUNTS & DEBTS CALCULATOR TAB ==================== */
        <div className="space-y-6">
          {/* Overview Hero Banner */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-blue-950 text-white rounded-[32px] p-6 sm:p-8 shadow-xl border border-slate-700/50">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
              <div>
                <span className="px-3.5 py-1.5 bg-blue-500/20 text-blue-300 border border-blue-400/30 rounded-full text-xs font-black uppercase tracking-wider mb-3 inline-block shadow-sm">
                  📊 Total Sold Goods & Accounts Calculator
                </span>
                <h2 className="text-2xl sm:text-3xl font-black tracking-tight text-white">
                  Xisaabinta Alaabta La Iibiyay: Deymaha vs Koontooyinka
                </h2>
                <p className="text-xs sm:text-sm text-slate-300 font-medium mt-1 max-w-2xl">
                  Bartaani waxay si toos ah kugu xisaabinaysaa dhammaan alaabtii la iibiyay ee dukaanka, iyadoo u kala saaraysa inta deymo ah, inta koontooyinka ku dhacday, iyo xisaabta koonto kasta oo aad doorato.
                </p>
              </div>

              {/* Global Summary Cards inside banner */}
              <div className="flex flex-wrap gap-3 w-full lg:w-auto">
                <div className="bg-white/10 backdrop-blur-md px-5 py-4 rounded-2xl border border-white/15">
                  <span className="text-[10px] uppercase tracking-widest text-slate-400 font-black block">Tirada Alaabta Guud</span>
                  <span className="text-2xl font-black font-mono text-white">{stats.totalQty.toLocaleString(undefined, { maximumFractionDigits: 2 })} PCS</span>
                </div>
                <div className="bg-white/10 backdrop-blur-md px-5 py-4 rounded-2xl border border-white/15">
                  <span className="text-[10px] uppercase tracking-widest text-slate-400 font-black block">Qiimaha Guud ee Iibka</span>
                  <span className="text-2xl font-black font-mono text-emerald-400">{formatStatValue(stats.totalGrossSalesUSD, stats.totalGrossSalesETB)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Section 1: Main Split - Deymaha vs Accounts */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* 💳 Deymaha (Credit / Debt Sales) Card */}
            <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-rose-200/80 shadow-sm relative overflow-hidden space-y-5">
              <div className="absolute top-0 right-0 w-32 h-32 bg-rose-50 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-rose-600 text-white rounded-2xl shadow-md shadow-rose-600/20">
                    <AlertTriangle size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">1. Deymaha Oo Dhan (All Debts)</h3>
                    <p className="text-xs text-slate-500 font-bold">Alaabta lagu iibiyay deynta (Laguma shubin account)</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-rose-100 text-rose-800 rounded-full font-black text-xs">
                  {stats.totalGrossSalesUSD > 0 ? ((stats.debtSalesTotalUSD / stats.totalGrossSalesUSD) * 100).toFixed(1) : 0}% ee Iibka
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-100">
                  <span className="text-[10px] font-black uppercase text-rose-600 tracking-wider block mb-1">Lacagta Deynta Ah</span>
                  <p className="text-2xl font-black font-mono text-rose-700">{formatStatValue(stats.debtSalesTotalUSD, stats.debtSalesTotalETB)}</p>
                </div>
                <div className="p-4 bg-rose-50/50 rounded-2xl border border-rose-100">
                  <span className="text-[10px] font-black uppercase text-rose-600 tracking-wider block mb-1">Tirada Alaabta Deynta</span>
                  <p className="text-2xl font-black font-mono text-slate-900">{stats.debtQty.toLocaleString()} PCS</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-bold text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span>Invoices-ka Deynta ah: <strong className="text-slate-900 font-mono font-black">{stats.debtTxCount} Invoices</strong></span>
                <button 
                  type="button"
                  onClick={() => { setMainTab('LOG'); setSalesFilterMode('DEBT'); }}
                  className="text-rose-600 hover:text-rose-800 font-black underline flex items-center gap-1"
                >
                  Eeg alaabta deynta ah &rarr;
                </button>
              </div>
            </div>

            {/* 💵 Koontooyinka (Paid Account Sales) Card */}
            <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-emerald-200/80 shadow-sm relative overflow-hidden space-y-5">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-md shadow-emerald-600/20">
                    <CreditCard size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">2. Koontooyinka Ku Dhacday (Paid Accounts)</h3>
                    <p className="text-xs text-slate-500 font-bold">Alaabta lacagta cadaanka ama accounts-ka ku dhacday</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-black text-xs">
                  {stats.totalGrossSalesUSD > 0 ? ((stats.nonDebtSalesTotalUSD / stats.totalGrossSalesUSD) * 100).toFixed(1) : 0}% ee Iibka
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                  <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider block mb-1">Lacagta Shubaalka Ah</span>
                  <p className="text-2xl font-black font-mono text-emerald-700">{formatStatValue(stats.nonDebtSalesTotalUSD, stats.nonDebtSalesTotalETB)}</p>
                </div>
                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                  <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider block mb-1">Tirada Alaabta Shubaalka</span>
                  <p className="text-2xl font-black font-mono text-slate-900">{stats.nonDebtQty.toLocaleString()} PCS</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-bold text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span>Invoices-ka Deynta ah: <strong className="text-slate-900 font-mono font-black">{stats.debtTxCount} Invoices</strong></span>
                <button 
                  type="button"
                  onClick={() => { setMainTab('LOG'); setSalesFilterMode('DEBT'); }}
                  className="text-rose-600 hover:text-rose-800 font-black underline flex items-center gap-1"
                >
                  Eeg alaabta deynta ah &rarr;
                </button>
              </div>
            </div>

            {/* 💵 Koontooyinka (Paid Account Sales) Card */}
            <div className="bg-white rounded-[32px] p-6 sm:p-8 border border-emerald-200/80 shadow-sm relative overflow-hidden space-y-5">
              <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-50 rounded-full blur-2xl -mr-10 -mt-10 pointer-events-none"></div>
              <div className="flex items-center justify-between border-b pb-4">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-emerald-600 text-white rounded-2xl shadow-md shadow-emerald-600/20">
                    <CreditCard size={24} />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight">2. Koontooyinka Ku Dhacday (Paid Accounts)</h3>
                    <p className="text-xs text-slate-500 font-bold">Alaabta lacagta cadaanka ama accounts-ka ku dhacday</p>
                  </div>
                </div>
                <span className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full font-black text-xs">
                  {stats.totalGrossSales > 0 ? ((stats.nonDebtSalesTotal / stats.totalGrossSales) * 100).toFixed(1) : 0}% ee Iibka
                </span>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                  <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider block mb-1">Lacagta Shubaalka Ah</span>
                  <p className="text-2xl font-black font-mono text-emerald-700">{formatCurrency(stats.nonDebtSalesTotal, currency, rate)}</p>
                </div>
                <div className="p-4 bg-emerald-50/50 rounded-2xl border border-emerald-100">
                  <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider block mb-1">Tirada Alaabta Shubaalka</span>
                  <p className="text-2xl font-black font-mono text-slate-900">{stats.nonDebtQty.toLocaleString()} PCS</p>
                </div>
              </div>

              <div className="flex items-center justify-between text-xs font-bold text-slate-600 bg-slate-50 p-3 rounded-xl border border-slate-100">
                <span>Invoices-ka Paid-ka ah: <strong className="text-slate-900 font-mono font-black">{stats.nonDebtTxCount} Invoices</strong></span>
                <button 
                  type="button"
                  onClick={() => { setMainTab('LOG'); setSalesFilterMode('NON_DEBT'); }}
                  className="text-emerald-600 hover:text-emerald-800 font-black underline flex items-center gap-1"
                >
                  Eeg alaabta accounts-ka &rarr;
                </button>
              </div>
            </div>

          </div>

          {/* Section 2: Interactive Accounts Selector & Detailed Breakdown */}
          <div className="bg-white rounded-[32px] border shadow-sm p-6 sm:p-8 space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 border-b pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <Wallet className="text-blue-600" size={22} /> Dooro Koontada Aad Rabto In Aad Xisaabteeda Eegto (Filter by Specific Account)
                </h3>
                <p className="text-xs text-slate-500 font-bold">Xulo Cash, Bank, Mobile, ama Koonto kasta oo dukaanku leeyahay</p>
              </div>

              {/* Quick Buttons for Accounts */}
              <div className="flex flex-wrap gap-2 w-full lg:w-auto">
                <button
                  type="button"
                  onClick={() => setSelectedCalcAccount('ALL')}
                  className={`px-4 py-2 rounded-2xl text-xs font-black transition-all ${
                    selectedCalcAccount === 'ALL'
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  🌐 Dhammaan (All Accounts)
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedCalcAccount('CASH')}
                  className={`px-4 py-2 rounded-2xl text-xs font-black transition-all ${
                    selectedCalcAccount === 'CASH'
                      ? 'bg-emerald-600 text-white shadow-md'
                      : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                  }`}
                >
                  💵 Cash ({formatCurrency(stats.cashSalesTotal, currency, rate)})
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedCalcAccount('BANK')}
                  className={`px-4 py-2 rounded-2xl text-xs font-black transition-all ${
                    selectedCalcAccount === 'BANK'
                      ? 'bg-blue-600 text-white shadow-md'
                      : 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
                  }`}
                >
                  🏦 Bank ({formatCurrency(stats.bankSalesTotal, currency, rate)})
                </button>

                <button
                  type="button"
                  onClick={() => setSelectedCalcAccount('MOBILE')}
                  className={`px-4 py-2 rounded-2xl text-xs font-black transition-all ${
                    selectedCalcAccount === 'MOBILE'
                      ? 'bg-purple-600 text-white shadow-md'
                      : 'bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100'
                  }`}
                >
                  📱 Mobile Money ({formatCurrency(stats.mobileSalesTotal, currency, rate)})
                </button>

                {(data.accounts || []).map(acc => (
                  <button
                    key={acc.id}
                    type="button"
                    onClick={() => setSelectedCalcAccount(acc.id)}
                    className={`px-4 py-2 rounded-2xl text-xs font-black transition-all ${
                      selectedCalcAccount === acc.id
                        ? 'bg-indigo-600 text-white shadow-md'
                        : 'bg-indigo-50 text-indigo-800 border border-indigo-200 hover:bg-indigo-100'
                    }`}
                  >
                    📂 {acc.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Account Deep Dive Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Total Revenue for chosen Account */}
              <div className="p-5 bg-blue-50/60 rounded-2xl border border-blue-200/80">
                <span className="text-[10px] font-black uppercase text-blue-600 tracking-wider block mb-1">
                  {selectedCalcAccount === 'ALL' ? 'Dhammaan Lacagta Accounts-ka' : selectedCalcAccount === 'CASH' ? 'Lacagta Cash / Cadaan' : selectedCalcAccount === 'BANK' ? 'Lacagta Bangiga' : selectedCalcAccount === 'MOBILE' ? 'Lacagta Mobile Money' : `Lacagta ${data.accounts.find(a=>a.id===selectedCalcAccount)?.name || 'Koontada'}`}
                </span>
                <p className="text-2xl font-black font-mono text-blue-900">
                  {formatCurrency(
                    selectedCalcAccount === 'ALL' ? stats.nonDebtSalesTotal
                    : selectedCalcAccount === 'CASH' ? stats.cashSalesTotal
                    : selectedCalcAccount === 'BANK' ? stats.bankSalesTotal
                    : selectedCalcAccount === 'MOBILE' ? stats.mobileSalesTotal
                    : (stats.accountMap[selectedCalcAccount]?.totalAmount || 0),
                    currency, rate
                  )}
                </p>
              </div>

              {/* Card 2: Total Items Sold under chosen Account */}
              <div className="p-5 bg-purple-50/60 rounded-2xl border border-purple-200/80">
                <span className="text-[10px] font-black uppercase text-purple-600 tracking-wider block mb-1">
                  Tirada Alaabta La Iibiyay (Selected Account)
                </span>
                <p className="text-2xl font-black font-mono text-purple-900">
                  {(
                    selectedCalcAccount === 'ALL' ? stats.nonDebtQty
                    : selectedCalcAccount === 'CASH' ? stats.cashQty
                    : selectedCalcAccount === 'BANK' ? stats.bankQty
                    : selectedCalcAccount === 'MOBILE' ? stats.mobileQty
                    : (stats.accountMap[selectedCalcAccount]?.itemQty || 0)
                  ).toLocaleString()} PCS
                </p>
              </div>

              {/* Card 3: Transaction / Invoice Count */}
              <div className="p-5 bg-amber-50/60 rounded-2xl border border-amber-200/80">
                <span className="text-[10px] font-black uppercase text-amber-600 tracking-wider block mb-1">
                  Tirada Invoices-ka
                </span>
                <p className="text-2xl font-black font-mono text-amber-900">
                  {
                    selectedCalcAccount === 'ALL' ? stats.nonDebtTxCount
                    : selectedCalcAccount === 'CASH' ? stats.cashTxCount
                    : selectedCalcAccount === 'BANK' ? stats.bankTxCount
                    : selectedCalcAccount === 'MOBILE' ? stats.mobileTxCount
                    : (stats.accountMap[selectedCalcAccount]?.txSet.size || 0)
                  } Invoices
                </p>
              </div>

              {/* Card 4: Current Account Balance in Store */}
              <div className="p-5 bg-emerald-50/60 rounded-2xl border border-emerald-200/80">
                <span className="text-[10px] font-black uppercase text-emerald-600 tracking-wider block mb-1">
                  Balance-ka Hadda ee Koontada
                </span>
                <p className="text-2xl font-black font-mono text-emerald-900">
                  {formatCurrency(
                    selectedCalcAccount === 'ALL' ? (data.accounts || []).reduce((a, b) => a + (b.balance || 0), 0)
                    : (data.accounts.find(a => a.id === selectedCalcAccount || a.name.toLowerCase().includes(selectedCalcAccount.toLowerCase()))?.balance || 0),
                    currency, rate
                  )}
                </p>
              </div>
            </div>

            {/* Selected Account Itemized Sales Table */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-slate-800 uppercase tracking-tight flex items-center gap-2">
                  <ShoppingBag size={16} className="text-blue-600" />
                  Alaabtii Ku Dhacday Koontada Doortay ({selectedCalcAccount})
                </h4>
                <span className="text-xs text-slate-500 font-bold">
                  Alaabta lagu iibiyay koontadan si kooban
                </span>
              </div>

              <div className="overflow-x-auto rounded-2xl border border-slate-200">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-100 border-b border-slate-200 font-black text-slate-700 uppercase">
                      <th className="p-3 text-center w-14">No.</th>
                      <th className="p-3"># Invoice</th>
                      <th className="p-3">Taariikhda</th>
                      <th className="p-3">Alaabta (Product)</th>
                      <th className="p-3 text-center">Tirada (Qty)</th>
                      <th className="p-3 text-right">Qiimaha Iibka</th>
                      <th className="p-3 text-right">Wadarta Iibka</th>
                      <th className="p-3 text-center">Payment Method</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium text-slate-800">
                    {filteredItems
                      .filter(item => {
                        const pm = (item.paymentMethod || '').toLowerCase();
                        const isDebt = pm.includes('debt') || pm.includes('deyn') || pm.includes('credit') || pm.includes('partial') || item.item.category === 'Cash Loan';
                        if (isDebt) return false;

                        if (selectedCalcAccount === 'ALL') return true;
                        if (selectedCalcAccount === 'CASH') return pm.includes('cash') || pm.includes('cadaan') || (item.accountId && item.accountId.includes('cash'));
                        if (selectedCalcAccount === 'BANK') return pm.includes('bank') || (item.accountId && item.accountId.includes('bank'));
                        if (selectedCalcAccount === 'MOBILE') return pm.includes('mobile') || pm.includes('evc') || pm.includes('zaad') || pm.includes('sahal');
                        return item.accountId === selectedCalcAccount || item.paymentMethod === selectedCalcAccount;
                      })
                      .slice(0, 50)
                      .map((entry, idx) => (
                        <tr key={`${entry.txId || entry.id}-${idx}`} className="hover:bg-slate-50">
                          <td className="p-3 text-center">
                            <span className="inline-block px-2 py-0.5 bg-slate-100 text-slate-700 font-mono font-bold text-[10px] rounded">
                              No. {idx + 1}
                            </span>
                          </td>
                          <td className="p-3 font-mono font-bold text-blue-600">
                            #INV-{(entry.txId || entry.id || '').slice(-6).toUpperCase()}
                          </td>
                          <td className="p-3 text-slate-500 whitespace-nowrap">
                            {new Date(entry.timestamp).toLocaleString()}
                          </td>
                          <td className="p-3 font-bold text-slate-900">
                            {entry.item.name}
                          </td>
                          <td className="p-3 text-center font-bold font-mono">
                            {entry.item.quantity} {entry.item.unit || 'PCS'}
                          </td>
                          <td className="p-3 text-right font-mono text-slate-600">
                            {formatCurrency(entry.finalUnitSell, currency, rate)}
                          </td>
                          <td className="p-3 text-right font-mono font-black text-emerald-700">
                            {formatCurrency(entry.totalSell, currency, rate)}
                          </td>
                          <td className="p-3 text-center">
                            <span className="px-2 py-0.5 rounded-md font-black text-[10px] uppercase bg-emerald-100 text-emerald-800">
                              {entry.paymentMethod}
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        </div>
      ) : (
        /* ==================== STANDARD LOG & TABLE VIEW ==================== */
        <>
      {/* Stats Cards Section */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
        {/* Total Quantity */}
        <div className="bg-white p-6 rounded-[32px] border shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Items Sold</span>
            <p className="text-3xl font-black text-slate-950 font-sans tracking-tight">
              {stats.totalQty.toLocaleString(undefined, { maximumFractionDigits: 2 })}
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-black uppercase">Piece / KG</span>
          </div>
        </div>

        {/* Total Cost */}
        <div className="bg-white p-6 rounded-[32px] border shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Cost Value</span>
            <p className="text-3xl font-black text-slate-950 font-mono tracking-tight text-amber-700">
              {formatStatValue(stats.totalCostUSD, stats.totalCostETB)}
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-[10px] px-2 py-0.5 bg-amber-50 text-amber-600 rounded-full font-black uppercase">Purchase Cost</span>
          </div>
        </div>

        {/* Total Gross Sales */}
        <div className="bg-white p-6 rounded-[32px] border shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Net Sales</span>
            <p className="text-3xl font-black text-blue-600 font-mono tracking-tight">
              {formatStatValue(stats.totalGrossSalesUSD, stats.totalGrossSalesETB)}
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-[10px] px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full font-black uppercase">After Discount</span>
          </div>
        </div>

        {/* Total Discount Given */}
        <div className="bg-white p-6 rounded-[32px] border shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Discounts Made</span>
            <p className="text-3xl font-black text-rose-600 font-mono tracking-tight">
              {formatStatValue(stats.totalDiscountUSD, stats.totalDiscountETB)}
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-[10px] px-2 py-0.5 bg-rose-50 text-rose-600 rounded-full font-black uppercase">Price Deductions</span>
          </div>
        </div>

        {/* Total Profit */}
        <div className="bg-white p-6 rounded-[32px] border shadow-sm flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest block mb-1">Total Net Profit</span>
            <p className="text-3xl font-black text-emerald-600 font-mono tracking-tight">
              {formatStatValue(stats.totalNetProfitUSD, stats.totalNetProfitETB)}
            </p>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-[10px] px-2 py-0.5 bg-emerald-50 text-emerald-600 rounded-full font-black uppercase">Net Earnings</span>
          </div>
        </div>
      </div>

      {/* Filter and Table Section */}
      <div className="bg-white rounded-[32px] border shadow-sm overflow-hidden">
        
        {/* Filters Panel */}
        <div className="p-6 border-b bg-slate-50/50 space-y-4 no-print">
          
          {/* Quick Filter: All Sales vs Non-Debt Sales vs Regular Sales vs Ice Cream vs All Debts */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-200/60">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setSalesFilterMode('ALL')}
                className={`px-3.5 py-2 rounded-2xl text-xs font-black transition-all ${
                  salesFilterMode === 'ALL'
                    ? 'bg-slate-900 text-white shadow-md'
                    : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-100'
                }`}
              >
                🌐 Dhammaan Iibka (All Sales)
              </button>

              <button
                type="button"
                onClick={() => setSalesFilterMode('NON_DEBT')}
                className={`px-3.5 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 ${
                  salesFilterMode === 'NON_DEBT'
                    ? 'bg-blue-600 text-white shadow-md ring-2 ring-blue-400'
                    : 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
                }`}
              >
                💵 Iibka Aan Deynta Lahayn (Cadaan & Accounts)
              </button>

              <button
                type="button"
                onClick={() => setSalesFilterMode('REGULAR')}
                className={`px-3.5 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 ${
                  salesFilterMode === 'REGULAR'
                    ? 'bg-emerald-600 text-white shadow-md ring-2 ring-emerald-400'
                    : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                🛒 Iibka Caadiga Ah (Store Sales)
              </button>

              <button
                type="button"
                onClick={() => setSalesFilterMode('ICECREAM')}
                className={`px-3.5 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 ${
                  salesFilterMode === 'ICECREAM'
                    ? 'bg-purple-600 text-white shadow-md ring-2 ring-purple-400'
                    : 'bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100'
                }`}
              >
                🍦 Ice Cream-ka (Ice Cream Only)
              </button>

              <button
                type="button"
                onClick={() => setSalesFilterMode('DEBT')}
                className={`px-3.5 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 ${
                  salesFilterMode === 'DEBT'
                    ? 'bg-rose-600 text-white shadow-md ring-2 ring-rose-400'
                    : 'bg-rose-50 text-rose-800 border border-rose-200 hover:bg-rose-100'
                }`}
              >
                ⚠️ Deymaha Oo Dhan (All Debts)
              </button>

              <button
                type="button"
                onClick={() => setSalesFilterMode('SUPPLIER_PAYMENT')}
                className={`px-3.5 py-2 rounded-2xl text-xs font-black transition-all flex items-center gap-1.5 ${
                  salesFilterMode === 'SUPPLIER_PAYMENT'
                    ? 'bg-amber-600 text-white shadow-md ring-2 ring-amber-400'
                    : 'bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100'
                }`}
              >
                🏢 Bixinta Deynta Supplier-ka (Supplier Paid)
              </button>
            </div>

            {/* Debtors Hub Sync Indicator */}
            <div className="flex items-center gap-2 text-xs font-black bg-amber-50 text-amber-900 px-3 py-1.5 border border-amber-200 rounded-xl">
              <span>💳 Deynta Taagan (Debtors Hub Total):</span>
              <span className="text-rose-700 font-extrabold text-sm">
                {formatCurrency(data.customers.reduce((a, b) => a + (b.debtBalance || 0), 0), currency, rate)}
              </span>
            </div>
          </div>

          {/* Account Breakdown Live Bar */}
          <div className="p-3 bg-slate-100/80 border border-slate-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-2 font-black text-slate-700">
              <Wallet size={16} className="text-blue-600" />
              <span>Guri-Iibka ku dhacay Koontooyinka (Payment Accounts Breakdown):</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button 
                onClick={() => setAccountFilter('CASH')}
                className={`px-3 py-1 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                  accountFilter === 'CASH' ? 'bg-emerald-600 text-white shadow' : 'bg-emerald-50 text-emerald-800 border border-emerald-200 hover:bg-emerald-100'
                }`}
              >
                💵 Cash / Cadaan: <span className="font-mono font-black">{formatCurrency(stats.cashSalesTotal, currency, rate)}</span>
              </button>

              <button 
                onClick={() => setAccountFilter('BANK')}
                className={`px-3 py-1 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                  accountFilter === 'BANK' ? 'bg-blue-600 text-white shadow' : 'bg-blue-50 text-blue-800 border border-blue-200 hover:bg-blue-100'
                }`}
              >
                🏦 Bangiga (Bank): <span className="font-mono font-black">{formatCurrency(stats.bankSalesTotal, currency, rate)}</span>
              </button>

              <button 
                onClick={() => setAccountFilter('MOBILE')}
                className={`px-3 py-1 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                  accountFilter === 'MOBILE' ? 'bg-purple-600 text-white shadow' : 'bg-purple-50 text-purple-800 border border-purple-200 hover:bg-purple-100'
                }`}
              >
                📱 Mobile (Zaad/Sahal/EVC): <span className="font-mono font-black">{formatCurrency(stats.mobileSalesTotal, currency, rate)}</span>
              </button>

              <button 
                onClick={() => setAccountFilter('ALL')}
                className={`px-3 py-1 rounded-xl font-bold flex items-center gap-1.5 transition-all ${
                  accountFilter === 'ALL' ? 'bg-slate-800 text-white shadow' : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                🌐 Dhammaan Account-yada
              </button>
            </div>
          </div>

          {/* Non-Debt Sales Banner when Non-Debt Filter is Active */}
          {salesFilterMode === 'NON_DEBT' && (
            <div className="p-4 bg-blue-50/80 border-2 border-blue-300 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-sm">
                  <CreditCard size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">
                    Iibka Aan Deynta Lahayn (Cadaan & Accounts Only)
                  </h4>
                  <p className="text-xs text-slate-600 font-medium">
                    Waxaad eegaysaa dhammaan iibka ku dhacay Cash, Bangiga, ama Mobile Money (Laga reabay dhammaan deyn kasta).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Regular Sales Banner when Regular Filter is Active */}
          {salesFilterMode === 'REGULAR' && (
            <div className="p-4 bg-emerald-50/80 border-2 border-emerald-300 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-emerald-600 text-white rounded-xl shadow-sm">
                  <ShoppingCart size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">
                    Iibka Caadiga Ah (Regular Store Sales Only)
                  </h4>
                  <p className="text-xs text-slate-600 font-medium">
                    Ka muuqda kaliya iibka caadiga ah ee Cadaan/Cash (Laga reabay Deymaha iyo Ice Cream-ka).
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Ice Cream Banner when Ice Cream Filter is Active */}
          {salesFilterMode === 'ICECREAM' && (
            <div className="p-4 bg-purple-50/80 border-2 border-purple-300 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-purple-600 text-white rounded-xl shadow-sm">
                  <Sparkles size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">
                    Iibka Ice Cream-ka (Ice Cream Sales Only)
                  </h4>
                  <p className="text-xs text-slate-600 font-medium">
                    Ka muuqda kaliya iibka alaabta ku jirta qaybta Ice Cream-ka.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Debtors Hub Banner when Debt Filter is Active */}
          {salesFilterMode === 'DEBT' && (
            <div className="p-4 bg-gradient-to-r from-amber-500/10 via-rose-500/10 to-amber-500/10 border-2 border-amber-300 rounded-2xl flex flex-wrap items-center justify-between gap-3 shadow-sm">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-rose-600 text-white rounded-xl shadow-sm">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h4 className="text-sm font-black text-slate-900">
                    Xisaabta Deymaha Laga Leeyahay (Debtors Hub Debt Sync)
                  </h4>
                  <p className="text-xs text-slate-600 font-medium">
                    Wadar ahaan deynta hadda ku taagan macaamiilka oo dhan:{' '}
                    <span className="font-black text-rose-700 text-sm">
                      {formatCurrency(data.customers.reduce((a, b) => a + (b.debtBalance || 0), 0), currency, rate)}
                    </span>
                    {' • '}
                    <span className="font-bold text-slate-700">
                      ({data.customers.filter(c => c.debtBalance > 0).length} Macamiil ayaa deyn lagu leeyahay)
                    </span>
                  </p>
                </div>
              </div>
              {setActiveTab && (
                <button
                  onClick={() => setActiveTab('debtors')}
                  className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-black shadow transition-all active:scale-95 flex items-center gap-1.5"
                >
                  💬 Fur Debtors Hub (Maamulka Deymaha)
                </button>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            
            {/* Search Input */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Search Product / Invoice / Customer</label>
              <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text"
                  placeholder="Water, SKU, Barcode, Inv ID..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                />
              </div>
            </div>

            {/* Account / Payment Method Selector */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Filter by Account / Payment</label>
              <select 
                value={accountFilter}
                onChange={e => setAccountFilter(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer font-black text-slate-800"
              >
                <option value="ALL">🌐 Dhammaan Account-yada (All)</option>
                <option value="CASH">💵 Cash / Cadaan</option>
                <option value="BANK">🏦 Bank Transfer / Bangi</option>
                <option value="MOBILE">📱 Mobile Money (Zaad / Sahal / EVC)</option>
                {data.accounts && data.accounts.length > 0 && (
                  <optgroup label="Koontooyinka Dukaanka">
                    {data.accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        📂 {acc.name} ({acc.type})
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>

            {/* Category Select */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Product Category</label>
              <select 
                value={categoryFilter}
                onChange={e => setCategoryFilter(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer"
              >
                <option value="ALL">All Categories</option>
                {categories.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Customer Select */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Filter by Customer</label>
              <select 
                value={selectedCustomerFilter}
                onChange={e => setSelectedCustomerFilter(e.target.value)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer"
              >
                <option value="ALL">All Customers</option>
                {customersList.map(cust => (
                  <option key={cust.id} value={cust.id}>{cust.name} ({cust.phone})</option>
                ))}
              </select>
            </div>

            {/* Date Preset */}
            <div className="space-y-1">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Date Interval</label>
              <select 
                value={dateRange}
                onChange={e => setDateRange(e.target.value as any)}
                className="w-full px-4 py-3 bg-white border border-slate-200 rounded-2xl outline-none text-sm font-bold focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all cursor-pointer font-black text-slate-800"
              >
                <option value="THIS_MONTH">📅 1 Bisha ilaa Maanta (Month to Date)</option>
                <option value="TODAY">📅 Maanta (Today)</option>
                <option value="YESTERDAY">📅 Shalay (Yesterday)</option>
                <option value="WEEK">📅 7-dii Maalmood ee Ugu Dambeeyay (Last 7 Days)</option>
                <option value="MONTH">📅 30-kii Maalmood ee Ugu Dambeeyay (Last 30 Days)</option>
                <option value="ALL">🌐 Custom Date / Dhammaan Taariikhda</option>
              </select>
            </div>

          </div>

          {/* Quick Date Chips Bar */}
          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/60">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mr-1">Xilliga (Quick Date):</span>
            <button
              type="button"
              onClick={() => setDateRange('THIS_MONTH')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                dateRange === 'THIS_MONTH'
                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              📅 1 Bisha ilaa Maanta
            </button>
            <button
              type="button"
              onClick={() => setDateRange('TODAY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                dateRange === 'TODAY'
                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Maanta
            </button>
            <button
              type="button"
              onClick={() => setDateRange('YESTERDAY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                dateRange === 'YESTERDAY'
                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Shalay
            </button>
            <button
              type="button"
              onClick={() => setDateRange('WEEK')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                dateRange === 'WEEK'
                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              7 Maalmood
            </button>
            <button
              type="button"
              onClick={() => setDateRange('MONTH')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                dateRange === 'MONTH'
                  ? 'bg-blue-600 text-white shadow-sm ring-2 ring-blue-400'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              30 Maalmood
            </button>
            <button
              type="button"
              onClick={() => setDateRange('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                dateRange === 'ALL'
                  ? 'bg-slate-800 text-white shadow-sm'
                  : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-100'
              }`}
            >
              Dhammaan
            </button>
          </div>

          {/* Custom Date Pickers (visible if Custom Date is selected) */}
          {dateRange === 'ALL' && (
            <div className="pt-2 flex flex-wrap items-center gap-4 border-t border-slate-100">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">From:</span>
                <input 
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">To:</span>
                <input 
                  type="date"
                  value={endDate}
                  onChange={e => setEndDate(e.target.value)}
                  className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              {(startDate || endDate) && (
                <button 
                  onClick={() => { setStartDate(''); setEndDate(''); }}
                  className="text-[10px] font-black text-red-500 hover:text-red-700 uppercase tracking-widest"
                >
                  Clear Dates
                </button>
              )}
            </div>
          )}
        </div>

        {/* Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="bg-slate-100 border-b border-slate-200">
                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center w-16">No.</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Product / Category</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest">Date / Invoice / Rate</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center">Qty Sold</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Unit Cost</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Unit Reg Sell</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Unit Discount</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Final Sold</th>
                <th className="px-4 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Unit Profit</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-right">Total Net profit</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-500 uppercase tracking-widest text-center no-print">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-semibold text-slate-700">
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="px-6 py-12 text-center text-slate-400 font-bold uppercase tracking-wider">
                    No transactions found matching the selected filters.
                  </td>
                </tr>
              ) : (
                filteredItems.map((entry, index) => (
                  <tr 
                    key={entry.id} 
                    onDoubleClick={() => openEditModal(entry.txId)}
                    className="hover:bg-blue-50/40 transition-colors cursor-pointer group"
                    title="Double-click (Labo Taabo) si aad u editeyso ama u aragto faahfaahinta"
                  >
                    {/* Row Index No. */}
                    <td className="px-4 py-4 text-center">
                      <span className="inline-block px-2 py-1 bg-slate-100 text-slate-700 font-mono font-black text-[11px] rounded-lg border border-slate-200">
                        No. {index + 1}
                      </span>
                    </td>
                    
                    {/* Product Name & Category */}
                    <td className="px-6 py-4">
                      <div>
                        <div className="flex items-center gap-2">
                          {(entry.txType === 'DEBT_PAYMENT' || entry.item.category === 'Bixinta Deynta') && (
                            <span className="px-2 py-0.5 rounded-md text-[10px] font-black uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                              💳 Bixinta Deynta
                            </span>
                          )}
                          <p className="font-bold text-slate-900 text-sm">{entry.item.name}</p>
                        </div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded font-black uppercase">
                            {entry.item.category || 'General'}
                          </span>
                          
                          {/* Financial Breakdown Badges: Qaatay - Bixiyay = Hadhay & Rate */}
                          {(() => {
                            const entryTotalUSD = entry.totalSell || 0;
                            const isPureDebt = entry.paymentMethod?.toLowerCase().includes('debt') || entry.paymentMethod?.toLowerCase().includes('deyn') || entry.paymentMethod?.toLowerCase().includes('credit') || entry.txType === 'CASH_LOAN';
                            const isPartial = entry.paymentMethod?.toLowerCase().includes('partial');
                            const entryDebtUSD = isPureDebt ? entryTotalUSD : (isPartial && entry.remainingDebt !== undefined ? entry.remainingDebt : (entry.txType === 'DEBT_PAYMENT' ? 0 : 0));
                            const entryPaidUSD = entry.txType === 'DEBT_PAYMENT' ? entryTotalUSD : Math.max(0, entryTotalUSD - entryDebtUSD);

                            return (
                              <>
                                <span className="text-[9px] px-2 py-0.5 bg-blue-50 text-blue-800 border border-blue-200 rounded font-black uppercase" title="Inta uu qaatay alaabtan ama biilkan">
                                  🛍️ Qaatay: {formatCurrency(entryTotalUSD, currency, entry.exchangeRate)}
                                </span>
                                <span className="text-[9px] px-2 py-0.5 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded font-black uppercase" title="Inta laga jaray / uu bixiyay">
                                  ➖ 💳 Bixiyay: {formatCurrency(entryPaidUSD, currency, entry.exchangeRate)}
                                </span>
                                {entryDebtUSD > 0 && (
                                  <span className="text-[9px] px-2 py-0.5 bg-rose-100 text-rose-900 border border-rose-300 rounded font-black uppercase" title="Deynta ku harsan">
                                    🟰 ⚠️ Hadhay: {formatCurrency(entryDebtUSD, currency, entry.exchangeRate)}
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                      </div>
                    </td>

                    {/* Date / Invoice / Customer / Rate */}
                    <td className="px-6 py-4">
                      <div className="space-y-0.5">
                        <p className="text-slate-900 font-bold">{new Date(entry.timestamp).toLocaleDateString()} {new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-slate-400">
                          <span>INV-{entry.txId.slice(-6).toUpperCase()} •</span>
                          <span className="text-blue-600 font-black">{entry.customerName}</span>
                          {entry.pageNumber && (
                            <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-black">
                              Boga: {entry.pageNumber}
                            </span>
                          )}
                          <span className="px-1.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded font-black font-mono text-[9px]">
                            💱 $1 = {entry.exchangeRate} ETB
                          </span>
                          {(entry.txType === 'DEBT_PAYMENT' || entry.item.category === 'Bixinta Deynta') ? (
                            <span className="px-1.5 py-0.5 rounded font-black text-[9px] uppercase bg-emerald-100 text-emerald-800 border border-emerald-300">
                              CASH INFLOW (+{formatCurrency(entry.totalSell, currency, entry.exchangeRate)})
                            </span>
                          ) : (
                            entry.paymentMethod && (
                              <span className={`px-1.5 py-0.5 rounded font-black text-[9px] uppercase ${
                                (entry.paymentMethod.toLowerCase().includes('debt') || entry.paymentMethod.toLowerCase().includes('deyn') || entry.paymentMethod.toLowerCase().includes('credit'))
                                  ? 'bg-rose-100 text-rose-800 border border-rose-200'
                                  : entry.paymentMethod.toLowerCase().includes('partial')
                                  ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                  : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                              }`}>
                                {entry.paymentMethod}
                              </span>
                            )
                          )}
                        </div>
                      </div>
                    </td>

                    {/* Qty Sold */}
                    <td className="px-4 py-4 text-center font-bold text-slate-900">
                      <span className="bg-slate-100 px-2.5 py-1 rounded-full text-xs font-black">
                        {entry.item.quantity} {entry.item.unit || 'PCS'}
                      </span>
                    </td>

                    {/* Unit Cost */}
                    <td className="px-4 py-4 text-right font-mono font-bold text-slate-600">
                      {formatCurrency(entry.unitCost, currency, entry.exchangeRate)}
                    </td>

                    {/* Unit Reg Sell */}
                    <td className="px-4 py-4 text-right font-mono font-bold text-slate-600">
                      {formatCurrency(entry.unitSell, currency, entry.exchangeRate)}
                    </td>

                    {/* Unit Discount */}
                    <td className="px-4 py-4 text-right font-mono font-black text-rose-600">
                      {entry.unitDiscount > 0 ? `-${formatCurrency(entry.unitDiscount, currency, entry.exchangeRate)}` : '—'}
                    </td>

                    {/* Final Sold */}
                    <td className="px-4 py-4 text-right font-mono font-black text-slate-900 bg-blue-50/30">
                      {formatCurrency(entry.finalUnitSell, currency, entry.exchangeRate)}
                    </td>

                    {/* Unit Profit */}
                    <td className={`px-4 py-4 text-right font-mono font-black ${entry.unitProfit >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                      {formatCurrency(entry.unitProfit, currency, entry.exchangeRate)}
                    </td>

                    {/* Total Profit */}
                    <td className="px-6 py-4 text-right bg-emerald-50/20">
                      <div className="space-y-0.5">
                        <p className={`font-mono font-black text-sm ${entry.totalProfit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                          {formatCurrency(entry.totalProfit, currency, entry.exchangeRate)}
                        </p>
                        <p className="text-[10px] font-bold text-slate-400">
                          Sales: {formatCurrency(entry.totalSell, currency, entry.exchangeRate)}
                        </p>
                      </div>
                    </td>

                    {/* Actions: Load to POS, Refund & Delete */}
                    <td className="px-6 py-4 text-center no-print">
                      <div className="flex items-center justify-center gap-1.5">
                        {onLoadItemsToPOS && (
                          <button
                            onClick={() => {
                              const cust = data.customers.find(c => c.id === entry.customerId);
                              onLoadItemsToPOS([{ ...entry.item, quantity: entry.item.quantity }], cust);
                            }}
                            className="p-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl transition-all flex items-center gap-1 text-[10px] font-black uppercase shadow-sm"
                            title="Gee Salada POS (Load to Cart & Open POS)"
                          >
                            <ShoppingCart size={13} />
                            <span className="hidden xl:inline">Gee POS</span>
                          </button>
                        )}

                        <button
                          onClick={() => {
                            const tx = data.transactions.find(t => t.id === entry.txId);
                            if (tx) sendWhatsAppReceipt(tx, data, currency, rate);
                          }}
                          className="p-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 rounded-xl transition-all flex items-center gap-1 text-[10px] font-black uppercase"
                          title="U Dir WhatsApp Macamiilka"
                        >
                          <span>💬</span>
                          <span className="hidden xl:inline">WhatsApp</span>
                        </button>

                        <button
                          onClick={() => openEditModal(entry.txId)}
                          className="p-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-xl transition-all flex items-center gap-1 text-[10px] font-black uppercase"
                          title="Six Transaction-ka (Edit Date, Item, Price, Qty)"
                        >
                          <Edit3 size={13} />
                          <span className="hidden xl:inline">Sixi (Edit)</span>
                        </button>

                        <button
                          onClick={() => handleRefundItem(entry.txId, entry.item)}
                          className="p-2 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-xl transition-all flex items-center gap-1 text-[10px] font-black uppercase"
                          title="Soo Celi Alaabta (Refund Item)"
                        >
                          <RotateCcw size={13} />
                          <span className="hidden xl:inline">Soo Celi</span>
                        </button>

                        <button
                          onClick={() => handleDeleteTransaction(entry.txId)}
                          className="p-2 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl transition-all flex items-center gap-1 text-[10px] font-black uppercase"
                          title="Futa Transaction-ka (Delete Tx)"
                        >
                          <Trash2 size={13} />
                          <span className="hidden xl:inline">Futa</span>
                        </button>
                      </div>
                    </td>

                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>
      </>
      )}

      {/* Edit Transaction Modal */}
      {editingTx && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[32px] max-w-2xl w-full p-6 sm:p-8 space-y-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 max-h-[90vh] overflow-y-auto">
            
            {/* Header */}
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tight flex items-center gap-2">
                  <Edit3 className="text-blue-600" size={20} /> Sixi Transaction INV-{(editingTx?.id || '').slice(-6).toUpperCase()}
                </h3>
                <p className="text-xs text-slate-500 font-bold mt-0.5">Waad badali kartaa Taariikhda, Qiimaha, iyo Tirada (Qty)</p>
              </div>
              <button 
                onClick={() => setEditingTx(null)}
                className="p-2 text-slate-400 hover:text-slate-600 rounded-full hover:bg-slate-100"
              >
                <X size={20} />
              </button>
            </div>

            {/* Date & Time Picker */}
            <div className="space-y-2">
              <label className="text-xs font-black text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                <Calendar size={14} className="text-blue-600" /> Taariikhda & Waqtiga Iibka (Sale Date & Time)
              </label>
              <input 
                type="datetime-local" 
                value={editDate} 
                onChange={(e) => setEditDate(e.target.value)} 
                className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Items List Header & Add Product Button */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider block">
                  Alaabta Transaction-ka ({editItems.length} items)
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingNewItem(!isAddingNewItem);
                    setSelectedAddProductId('');
                    setAddCustomName('');
                    setAddCustomPrice('');
                    setAddCustomQty(1);
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl font-black text-xs transition-all border border-blue-200 shadow-sm"
                >
                  <Plus size={14} />
                  <span>{isAddingNewItem ? 'Xir Qaybta Alaabta' : '+ Ku dar Alaab (Add Product)'}</span>
                </button>
              </div>

              {/* Add Product Sub-Panel */}
              {isAddingNewItem && (
                <div className="p-4 bg-blue-50/70 border-2 border-blue-200 rounded-2xl space-y-3 animate-in fade-in zoom-in-95 duration-150">
                  <div className="flex items-center justify-between border-b border-blue-200/80 pb-2">
                    <span className="text-xs font-black text-blue-900 uppercase tracking-wide flex items-center gap-1.5">
                      <Plus size={14} /> Ku dar Alaab Transaction-kan
                    </span>
                    <span className="text-[10px] font-bold text-blue-700">Dooro inventory-ga ama qor alaab cusub</span>
                  </div>

                  {/* 1. Pick from Inventory Search / Select */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-600 uppercase">
                      Dooro Alaab Ka Jirta Bakhaarka (Select from Products):
                    </label>
                    <div className="relative">
                      <select
                        value={selectedAddProductId}
                        onChange={(e) => {
                          const pId = e.target.value;
                          setSelectedAddProductId(pId);
                          if (pId) {
                            const p = data.products.find(prod => prod.id === pId);
                            if (p) {
                              const isETB = currency === Currency.ETB;
                              const currentRate = isETB ? (rate || 1) : 1;
                              setAddCustomName(p.name);
                              setAddCustomPrice(String(Math.round((p.sellPrice * currentRate) * 100) / 100));
                            }
                          } else {
                            setAddCustomName('');
                            setAddCustomPrice('');
                          }
                        }}
                        className="w-full px-3 py-2 bg-white border border-blue-300 rounded-xl font-bold text-xs text-slate-900 focus:ring-2 focus:ring-blue-500 outline-none"
                      >
                        <option value="">-- Dooro Alaab Bakhaarka ah ama Qor Hoosta --</option>
                        {data.products.map(p => {
                          const isETB = currency === Currency.ETB;
                          const currentRate = isETB ? (rate || 1) : 1;
                          const pPrice = Math.round((p.sellPrice * currentRate) * 100) / 100;
                          return (
                            <option key={p.id} value={p.id}>
                              {p.name} (Stock: {p.stock} {p.unit || 'PCS'}) — {formatCurrency(p.sellPrice, currency, rate)}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>

                  {/* 2. Custom Name, Price & Qty Fields */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <div className="sm:col-span-1">
                      <label className="text-[9px] font-black text-slate-600 uppercase block mb-1">Magaca Alaabta:</label>
                      <input
                        type="text"
                        placeholder="Tusaale: Caanaha Caano"
                        value={addCustomName}
                        onChange={(e) => setAddCustomName(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-black text-slate-600 uppercase block mb-1">
                        Qiimaha ({currency === Currency.ETB ? 'ETB' : 'USD'}):
                      </label>
                      <input
                        type="number"
                        step="any"
                        placeholder="0.00"
                        value={addCustomPrice}
                        onChange={(e) => setAddCustomPrice(e.target.value)}
                        className="w-full px-3 py-1.5 bg-white border border-slate-300 rounded-xl font-bold text-xs text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

                    <div>
                      <label className="text-[9px] font-black text-slate-600 uppercase block mb-1">Tirada (Qty):</label>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setAddCustomQty(q => Math.max(1, q - 1))}
                          className="w-7 h-7 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg font-black text-xs flex items-center justify-center text-slate-700"
                        >
                          -
                        </button>
                        <input
                          type="number"
                          step="any"
                          min="1"
                          value={addCustomQty}
                          onChange={(e) => setAddCustomQty(Math.max(1, parseFloat(e.target.value) || 1))}
                          className="w-full px-2 py-1.5 bg-white border border-slate-300 rounded-xl font-black text-xs text-center text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => setAddCustomQty(q => q + 1)}
                          className="w-7 h-7 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg font-black text-xs flex items-center justify-center text-slate-700"
                        >
                          +
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Add Button */}
                  <div className="flex justify-end pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        const trimmedName = addCustomName.trim();
                        if (!trimmedName) {
                          alert('Fadlan geli magaca alaabta ama dooro bakhaarka.');
                          return;
                        }
                        const isETB = currency === Currency.ETB;
                        const currentRate = isETB ? (rate || 1) : 1;
                        const parsedPrice = parseFloat(addCustomPrice) || 0;
                        const unitPriceUSD = parsedPrice / currentRate;

                        let foundProduct = selectedAddProductId ? data.products.find(p => p.id === selectedAddProductId) : undefined;
                        if (!foundProduct) {
                          foundProduct = data.products.find(p => p.name.toLowerCase() === trimmedName.toLowerCase());
                        }

                        const newItem: CartItem = {
                          id: foundProduct ? foundProduct.id : `custom-${Date.now()}`,
                          name: foundProduct ? foundProduct.name : trimmedName,
                          sku: foundProduct?.sku || `SKU-${Date.now().toString().slice(-4)}`,
                          barcode: foundProduct?.barcode || '',
                          costPrice: foundProduct?.costPrice || (unitPriceUSD * 0.8),
                          sellPrice: unitPriceUSD,
                          stock: foundProduct?.stock ?? 999,
                          category: foundProduct?.category || 'General',
                          quantity: addCustomQty,
                          unit: foundProduct?.unit || 'PCS'
                        };

                        setEditItems(prev => {
                          const existingIndex = prev.findIndex(item => item.id === newItem.id || item.name.toLowerCase() === newItem.name.toLowerCase());
                          if (existingIndex >= 0) {
                            return prev.map((item, idx) => 
                              idx === existingIndex ? { ...item, quantity: item.quantity + newItem.quantity } : item
                            );
                          }
                          return [...prev, newItem];
                        });

                        // Reset addition panel
                        setSelectedAddProductId('');
                        setAddCustomName('');
                        setAddCustomPrice('');
                        setAddCustomQty(1);
                        setIsAddingNewItem(false);
                      }}
                      className="flex items-center gap-2 px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-black text-xs shadow-md uppercase tracking-wider transition-all"
                    >
                      <Plus size={14} /> Ku dar Transaction-ka (Add to Sale)
                    </button>
                  </div>
                </div>
              )}
              
              {/* Existing Items in this transaction */}
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {editItems.map((item, idx) => {
                  const isETB = currency === Currency.ETB;
                  const currentRate = isETB ? (rate || 1) : 1;
                  const itemTotalUSD = item.sellPrice * item.quantity;

                  return (
                    <div key={idx} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex flex-wrap sm:flex-nowrap items-center justify-between gap-3">
                      <div className="flex-1 min-w-[150px]">
                        <p className="text-xs font-black text-slate-900">{item.name}</p>
                        <p className="text-[10px] text-slate-400 font-bold">Cost: {formatCurrency(item.costPrice, currency, rate)}</p>
                      </div>

                      {/* Unit Price Input */}
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-black text-slate-400 uppercase">Unit Price ({isETB ? 'ETB' : 'USD'})</span>
                        <input 
                          type="number" 
                          step="any"
                          value={Math.round((item.sellPrice * currentRate) * 100) / 100}
                          onChange={(e) => {
                            const val = parseFloat(e.target.value);
                            if (!isNaN(val)) {
                              setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, sellPrice: val / currentRate } : it));
                            }
                          }}
                          className="w-24 px-2 py-1 bg-white border border-slate-200 rounded-xl font-black text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none block"
                        />
                      </div>

                      {/* Quantity Input with +/- controls */}
                      <div className="space-y-0.5">
                        <span className="text-[9px] font-black text-slate-400 uppercase">Tirada (Qty)</span>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => {
                              setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: Math.max(1, it.quantity - 1) } : it));
                            }}
                            className="w-6 h-6 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 font-bold text-xs flex items-center justify-center"
                          >
                            -
                          </button>
                          <input 
                            type="number" 
                            step="any"
                            min="0.01"
                            value={item.quantity}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value);
                              if (!isNaN(val) && val > 0) {
                                setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: val } : it));
                              }
                            }}
                            className="w-16 px-1.5 py-1 bg-white border border-slate-200 rounded-xl font-black text-xs text-center text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none block"
                          />
                          <button
                            type="button"
                            onClick={() => {
                              setEditItems(prev => prev.map((it, i) => i === idx ? { ...it, quantity: it.quantity + 1 } : it));
                            }}
                            className="w-6 h-6 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg text-slate-700 font-bold text-xs flex items-center justify-center"
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Total */}
                      <div className="text-right min-w-[80px]">
                        <span className="text-[9px] font-black text-slate-400 uppercase block">Total</span>
                        <span className="text-xs font-black text-blue-600 font-mono">
                          {formatCurrency(itemTotalUSD, currency, rate)}
                        </span>
                      </div>

                      {/* Delete Item */}
                      {editItems.length > 1 && (
                        <button 
                          onClick={() => setEditItems(prev => prev.filter((_, i) => i !== idx))}
                          className="p-1.5 text-rose-500 hover:bg-rose-100 rounded-xl transition-all"
                          title="Futa Item-ka"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Discount & Totals */}
            <div className="pt-4 border-t space-y-3">
              <div className="flex justify-between items-center text-xs font-black text-slate-600">
                <span>Subtotal:</span>
                <span className="font-mono">{formatCurrency(editItems.reduce((s, i) => s + (i.sellPrice * i.quantity), 0), currency, rate)}</span>
              </div>

              <div className="flex justify-between items-center text-xs font-black text-slate-600">
                <span>Discount ({currency === Currency.ETB ? 'ETB' : 'USD'}):</span>
                <input 
                  type="number" 
                  step="any"
                  value={editDiscount * (currency === Currency.ETB ? (rate || 1) : 1)}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value) || 0;
                    const isETB = currency === Currency.ETB;
                    setEditDiscount(val / (isETB ? (rate || 1) : 1));
                  }}
                  className="w-24 px-2 py-1 bg-slate-50 border border-slate-200 rounded-xl font-black text-xs text-rose-600 text-right outline-none"
                />
              </div>

              <div className="flex justify-between items-center text-base font-black text-slate-900 pt-2 border-t">
                <span>Final Total:</span>
                <span className="font-mono text-blue-600 text-lg">
                  {formatCurrency(Math.max(0, editItems.reduce((s, i) => s + (i.sellPrice * i.quantity), 0) - editDiscount), currency, rate)}
                </span>
              </div>
            </div>

            {/* Footer Buttons */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button 
                onClick={() => sendWhatsAppReceipt(editingTx, data, currency, rate)}
                className="px-5 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-emerald-600/20"
              >
                💬 U Dir WhatsApp
              </button>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => setEditingTx(null)}
                  className="px-5 py-3 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-2xl font-black text-xs uppercase tracking-wider transition-all"
                >
                  Kansal (Cancel)
                </button>
                <button 
                  onClick={handleSaveTransactionEdit}
                  className="px-6 py-3 bg-blue-600 text-white hover:bg-blue-700 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 shadow-lg shadow-blue-500/20"
                >
                  <Save size={16} /> Kaydi Sixitaanka (Save Changes)
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* Customer Product Return Modal */}
      <CustomerReturnModal
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        data={data}
        setData={setData}
        addLog={addLog}
        currency={currency}
        preselectedTxId={preselectedReturnTxId}
        onLoadItemsToPOS={onLoadItemsToPOS}
      />

      <ConfirmModal
        isOpen={!!deleteTxConfirmId}
        title="Ma hubtaa? (Are you sure?)"
        message={`Ma hubtaa inaad tirtirto Transaction #INV-${deleteTxConfirmId ? deleteTxConfirmId.slice(-5).toUpperCase() : ''}? Stock-ga iyo Lacagta waa lagu soo celin doonaa.`}
        confirmText="Haa (Tirtir)"
        cancelText="Maya (Kansal)"
        onConfirm={() => {
          if (deleteTxConfirmId) {
            executeDeleteTransaction(deleteTxConfirmId);
            setDeleteTxConfirmId(null);
          }
        }}
        onClose={() => setDeleteTxConfirmId(null)}
      />

      <ConfirmModal
        isOpen={deleteAllConfirm}
        title="🚨 Tirtir Dhammaan Transactions-ka (Delete All Transactions)?"
        message={`Ma hubtaa inaad tirtirto dhammaan ${data.transactions.length} iib ee la diiwaan geliyay? Dhammaan alaabtii la iibiyay waxaa loo celin doonaa Stock-ga (Inventory), deymaha iibka ahna waa la tiri doonaa.`}
        confirmText="Haa, Tirtir Dhammaan (Restores Stock)"
        cancelText="Maya (Kansal)"
        onConfirm={executeDeleteAllTransactions}
        onClose={() => setDeleteAllConfirm(false)}
      />
    </div>
  );
};
