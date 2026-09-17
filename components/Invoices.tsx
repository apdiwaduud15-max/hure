import React, { useState, useMemo } from 'react';
import { AppData, Currency, Transaction, PaymentMethod, Customer, UserRole } from '../types';
import { formatCurrency, generateId, sendWhatsAppReceipt, formatMonthlyDebtStatement } from '../lib/utils';
import { 
  Search, FileText, Printer, Trash2, X, AlertTriangle, 
  FileSpreadsheet, Download, Package, RotateCcw, ShoppingCart, 
  Calendar, Clock, User, Users, Filter, CheckCircle2, ChevronRight, 
  DollarSign, Wallet, ArrowUpDown, Sparkles, MessageSquare, Phone, 
  Eye, Building2, Tag, Layers, ArrowDownLeft, Scale, BookOpen, 
  Receipt, TrendingUp, CheckCircle, RefreshCw
} from 'lucide-react';
import CustomerReturnModal from './CustomerReturnModal';
import ConfirmModal from './ConfirmModal';

interface Props {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  addLog: (action: string, details: string) => void;
  currency: Currency;
  onLoadItemsToPOS?: (items: any[], customer?: any) => void;
}

type DateFilterType = 'ALL' | 'TODAY' | 'YESTERDAY' | 'THIS_WEEK' | 'THIS_MONTH' | 'CUSTOM';

const Invoices: React.FC<Props> = ({ data, setData, addLog, currency, onLoadItemsToPOS }) => {
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [search, setSearch] = useState('');
  
  // Date Filtering State
  const [dateFilter, setDateFilter] = useState<DateFilterType>('ALL');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // Customer Filtering State ("Qof walba meel u gooni ah")
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('ALL');
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<'ALL' | 'PAID' | 'DEBT' | 'PARTIAL'>('ALL');

  // View mode when a customer is selected: 'STATEMENT' (Warqadda Guud) or 'INVOICE' (Biil Gooni ah)
  const [customerViewMode, setCustomerViewMode] = useState<'INVOICE' | 'STATEMENT'>('INVOICE');

  // Modals
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [preselectedTxIdForReturn, setPreselectedTxIdForReturn] = useState<string | undefined>(undefined);
  const [showDeleteConfirmModal, setShowDeleteConfirmModal] = useState(false);
  
  const currentGlobalRate = data.settings.exchangeRate || 1;

  // Helper to get customer name
  const getCustomerName = (tx: Transaction) => {
    if (!tx.customerId) return tx.customerName || 'Walk-in Customer';
    return data.customers.find(c => c.id === tx.customerId)?.name || tx.customerName || 'Walk-in Customer';
  };

  const getCustomerObj = (tx: Transaction): Customer | undefined => {
    if (!tx.customerId) return undefined;
    return data.customers.find(c => c.id === tx.customerId);
  };

  // Customers with invoices for quick folder filtering
  const customersWithInvoices = useMemo(() => {
    const customerMap = new Map<string, { customer: Customer; count: number; totalSpentUSD: number; totalSpentETB: number; debtUSD: number; debtETB: number }>();
    
    data.transactions.forEach(tx => {
      if (tx.customerId) {
        const cust = data.customers.find(c => c.id === tx.customerId);
        if (cust) {
          const txRate = tx.exchangeRate || currentGlobalRate || 1;
          const existing = customerMap.get(cust.id) || { 
            customer: cust, 
            count: 0, 
            totalSpentUSD: 0, 
            totalSpentETB: 0,
            debtUSD: 0,
            debtETB: 0
          };
          
          existing.count += 1;
          existing.totalSpentUSD += tx.total;
          existing.totalSpentETB += tx.total * txRate;

          const pm = (tx.paymentMethod || '').toLowerCase();
          const isPureDebt = pm === 'debt' || pm.includes('debt') || pm.includes('deyn') || tx.type === 'CASH_LOAN';
          const isPartial = tx.paymentMethod === PaymentMethod.PARTIAL && (tx.paymentDetails?.debt || 0) > 0;
          
          let invDebtUSD = 0;
          if (isPureDebt) {
            invDebtUSD = tx.total;
          } else if (isPartial) {
            invDebtUSD = tx.paymentDetails?.debt || 0;
          }

          existing.debtUSD += invDebtUSD;
          existing.debtETB += invDebtUSD * txRate;

          customerMap.set(cust.id, existing);
        }
      }
    });

    return Array.from(customerMap.values()).sort((a, b) => b.totalSpentUSD - a.totalSpentUSD);
  }, [data.transactions, data.customers, currentGlobalRate]);

  // Filtered Transactions based on Date, Customer, Status, and Search
  const filteredTx = useMemo(() => {
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const endOfToday = startOfToday + 24 * 60 * 60 * 1000 - 1;

    const startOfYesterday = startOfToday - 24 * 60 * 60 * 1000;
    const endOfYesterday = startOfToday - 1;

    const startOfWeek = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay()).getTime();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    return data.transactions.filter(t => {
      // 1. Date Filter
      const txTime = t.timestamp;
      if (dateFilter === 'TODAY') {
        if (txTime < startOfToday || txTime > endOfToday) return false;
      } else if (dateFilter === 'YESTERDAY') {
        if (txTime < startOfYesterday || txTime > endOfYesterday) return false;
      } else if (dateFilter === 'THIS_WEEK') {
        if (txTime < startOfWeek) return false;
      } else if (dateFilter === 'THIS_MONTH') {
        if (txTime < startOfMonth) return false;
      } else if (dateFilter === 'CUSTOM') {
        if (customStartDate) {
          const start = new Date(customStartDate + 'T00:00:00').getTime();
          if (txTime < start) return false;
        }
        if (customEndDate) {
          const end = new Date(customEndDate + 'T23:59:59').getTime();
          if (txTime > end) return false;
        }
      }

      // 2. Customer Filter
      if (selectedCustomerId !== 'ALL') {
        if (selectedCustomerId === 'WALK_IN') {
          if (t.customerId) return false;
        } else {
          if (t.customerId !== selectedCustomerId) return false;
        }
      }

      // 3. Payment Status Filter
      const pm = (t.paymentMethod || '').toLowerCase();
      const isPureDebt = pm === 'debt' || pm.includes('debt') || pm.includes('deyn') || t.type === 'CASH_LOAN';
      const isPartial = t.paymentMethod === PaymentMethod.PARTIAL && (t.paymentDetails?.debt || 0) > 0;
      const isPaid = !isPureDebt && !isPartial;

      if (paymentStatusFilter === 'PAID' && !isPaid) return false;
      if (paymentStatusFilter === 'DEBT' && !isPureDebt) return false;
      if (paymentStatusFilter === 'PARTIAL' && !isPartial) return false;

      // 4. Text Search
      if (search.trim()) {
        const query = search.toLowerCase();
        const custName = getCustomerName(t).toLowerCase();
        const idMatch = t.id.toLowerCase().includes(query);
        const pageMatch = t.pageNumber ? t.pageNumber.toLowerCase().includes(query) : false;
        const itemMatch = t.items.some(i => i.name.toLowerCase().includes(query));
        const phoneMatch = getCustomerObj(t)?.phone.includes(query) || false;

        if (!idMatch && !custName.includes(query) && !pageMatch && !itemMatch && !phoneMatch) {
          return false;
        }
      }

      return true;
    }).slice().reverse();
  }, [data.transactions, dateFilter, customStartDate, customEndDate, selectedCustomerId, paymentStatusFilter, search, data.customers]);

  // Selected customer summary if one is picked
  const activeSelectedCustomer = useMemo(() => {
    if (selectedCustomerId === 'ALL' || selectedCustomerId === 'WALK_IN') return null;
    return data.customers.find(c => c.id === selectedCustomerId) || null;
  }, [selectedCustomerId, data.customers]);

  // ACCURATE TOTAL SUMMARY: Combining each invoice using its own day's exchange rate!
  const filteredSummary = useMemo(() => {
    let totalUSD = 0;
    let totalETB = 0; // Sum of t.total * (t.exchangeRate || currentGlobalRate)
    let totalItems = 0;
    let uniqueItemsSet = new Set<string>();
    let debtUSD = 0;
    let debtETB = 0;
    let paidUSD = 0;
    let paidETB = 0;

    filteredTx.forEach(t => {
      const rate = t.exchangeRate || currentGlobalRate || 1;
      const invTotalUSD = t.total;
      const invTotalETB = invTotalUSD * rate;

      totalUSD += invTotalUSD;
      totalETB += invTotalETB;
      
      t.items.forEach(item => {
        totalItems += (item.quantity || 1);
        uniqueItemsSet.add(item.name.toLowerCase().trim());
      });

      const pm = (t.paymentMethod || '').toLowerCase();
      const isPureDebt = pm === 'debt' || pm.includes('debt') || pm.includes('deyn') || t.type === 'CASH_LOAN';
      const isPartial = t.paymentMethod === PaymentMethod.PARTIAL && (t.paymentDetails?.debt || 0) > 0;

      let invDebtUSD = 0;
      if (isPureDebt) {
        invDebtUSD = t.total;
      } else if (isPartial) {
        invDebtUSD = t.paymentDetails?.debt || 0;
      }

      const invPaidUSD = Math.max(0, invTotalUSD - invDebtUSD);

      debtUSD += invDebtUSD;
      debtETB += invDebtUSD * rate;

      paidUSD += invPaidUSD;
      paidETB += invPaidUSD * rate;
    });

    const averageRate = totalUSD > 0 ? (totalETB / totalUSD) : (currentGlobalRate || 1);

    return { 
      totalUSD, 
      totalETB,
      totalItems, 
      uniqueItemsCount: uniqueItemsSet.size,
      debtUSD, 
      debtETB,
      paidUSD,
      paidETB,
      averageRate,
      count: filteredTx.length 
    };
  }, [filteredTx, currentGlobalRate]);

  const isCashier = data.settings.currentUser?.role === UserRole.CASHIER;

  const handleRefundItem = (tx: Transaction, itemToRefund: any) => {
    if (isCashier) {
      alert("⚠️ Cashier-ku ma tirtiri karo ama celin karo alaabta! Kaliya Admin ama Manager ayaa awood u leh.");
      return;
    }
    if (!confirm(`⚠️ Ma hubtaa inaad soo celiso (Refund) alaabta "${itemToRefund.name}" (Qty: ${itemToRefund.quantity})? Stock-gu wuxuu ku noqon doonaa bakhaarka.`)) return;

    const refundValue = itemToRefund.sellPrice * itemToRefund.quantity;

    setData(prev => {
      // 1. Restore Stock
      const newProducts = prev.products.map(p => {
        if (p.id === itemToRefund.id) {
          return { ...p, stock: p.stock + itemToRefund.quantity };
        }
        return p;
      });

      // 2. Adjust Accounts
      let updatedAccounts = [...prev.accounts];
      if (tx.accountId) {
        updatedAccounts = updatedAccounts.map(a => a.id === tx.accountId ? { ...a, balance: Math.max(0, a.balance - refundValue) } : a);
      } else {
        const cashAcc = updatedAccounts.find(a => a.name.toLowerCase().includes('cash'));
        if (cashAcc) {
          updatedAccounts = updatedAccounts.map(a => a.id === cashAcc.id ? { ...a, balance: Math.max(0, a.balance - refundValue) } : a);
        }
      }

      // 3. Update Transaction
      const updatedTxList = prev.transactions.map(t => {
        if (t.id === tx.id) {
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

    // Update selectedTx local view state if it changed
    const updatedSelected = data.transactions.find(t => t.id === tx.id);
    if (updatedSelected) {
      const remainingItems = updatedSelected.items.filter(i => i.id !== itemToRefund.id);
      if (remainingItems.length === 0) {
        setSelectedTx(null);
      } else {
        setSelectedTx({
          ...updatedSelected,
          items: remainingItems,
          total: Math.max(0, updatedSelected.total - refundValue)
        });
      }
    }

    addLog('Item Refunded', `Refunded ${itemToRefund.quantity} x ${itemToRefund.name} from INV-${tx.id.slice(-5).toUpperCase()}`);
  };

  const exportInvoicesToExcel = () => {
    const headers = [
      'Invoice ID', 
      'Date', 
      'Customer', 
      'Payment Method', 
      'Exchange Rate ($1 = ETB)', 
      'Items Taken', 
      'Subtotal ($)', 
      'Total ($ USD)', 
      'Total (ETB at Daily Rate)',
      'Debt ($ USD)',
      'Debt (ETB at Daily Rate)'
    ];

    const rows = filteredTx.map(t => {
      const rate = t.exchangeRate || currentGlobalRate || 1;
      const pm = (t.paymentMethod || '').toLowerCase();
      const isPureDebt = pm === 'debt' || pm.includes('debt') || pm.includes('deyn') || t.type === 'CASH_LOAN';
      const isPartial = t.paymentMethod === PaymentMethod.PARTIAL && (t.paymentDetails?.debt || 0) > 0;
      const debtVal = isPureDebt ? t.total : (isPartial ? (t.paymentDetails?.debt || 0) : 0);

      return [
        `"INV-${t.id.slice(-5).toUpperCase()}"`,
        `"${new Date(t.timestamp).toLocaleDateString()}"`,
        `"${getCustomerName(t).replace(/"/g, '""')}"`,
        `"${t.paymentMethod}"`,
        rate,
        `"${t.items.map(i => `${i.name} (${i.quantity})`).join('; ')}"`,
        t.subtotal,
        t.total,
        (t.total * rate).toFixed(2),
        debtVal,
        (debtVal * rate).toFixed(2)
      ];
    });

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `invoices_report_${selectedCustomerId !== 'ALL' ? 'customer_' + selectedCustomerId : 'all'}_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addLog('Export Invoices', 'Exported accurate sales ledger with daily exchange rates to Excel');
  };

  const handleDeleteInvoice = () => {
    if (isCashier) {
      alert("⚠️ Cashier-ku ma tirtiri karo biilasha! Kaliya Admin ama Manager ayaa awood u leh inay biil tirtiraan.");
      return;
    }
    if (!selectedTx) return;
    setShowDeleteConfirmModal(true);
  };

  const executeDeleteInvoice = () => {
    if (!selectedTx) return;

    setData(prev => {
      // 1. Revert Product Stock
      const newProducts = prev.products.map(p => {
        const soldItem = selectedTx.items.find(item => item.id === p.id);
        return soldItem ? { ...p, stock: p.stock + soldItem.quantity } : p;
      });

      // 2. Revert Financials
      let updatedAccounts = [...prev.accounts];
      const totalCost = selectedTx.items.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
      const invAcc = updatedAccounts.find(a => a.id === 'acc-inv' || a.name.toLowerCase().includes('inventory'));
      if (invAcc) {
        updatedAccounts = updatedAccounts.map(a => a.id === invAcc.id ? { ...a, balance: a.balance + totalCost } : a);
      }

      // Revert Income Accounts
      if (selectedTx.paymentMethod === PaymentMethod.PARTIAL && selectedTx.paymentDetails) {
        const cashAcc = updatedAccounts.find(a => a.name.toLowerCase().includes('cash'));
        const bankAcc = updatedAccounts.find(a => a.name.toLowerCase().includes('bank'));
        const mobileAcc = updatedAccounts.find(a => a.name.toLowerCase().includes('mobile'));

        if (selectedTx.paymentDetails.cash > 0 && cashAcc) {
          updatedAccounts = updatedAccounts.map(a => a.id === cashAcc.id ? { ...a, balance: Math.max(0, a.balance - selectedTx.paymentDetails!.cash) } : a);
        }
        if (selectedTx.paymentDetails.bank > 0 && bankAcc) {
          updatedAccounts = updatedAccounts.map(a => a.id === bankAcc.id ? { ...a, balance: Math.max(0, a.balance - selectedTx.paymentDetails!.bank) } : a);
        }
        if (selectedTx.paymentDetails.mobile > 0 && mobileAcc) {
          updatedAccounts = updatedAccounts.map(a => a.id === mobileAcc.id ? { ...a, balance: Math.max(0, a.balance - selectedTx.paymentDetails!.mobile) } : a);
        }
      } else if (selectedTx.paymentMethod !== PaymentMethod.DEBT && selectedTx.accountId) {
        updatedAccounts = updatedAccounts.map(a => a.id === selectedTx.accountId ? { ...a, balance: Math.max(0, a.balance - selectedTx.total) } : a);
      }

      // 3. Revert Customer
      const newCustomers = prev.customers.map(c => {
        if (selectedTx.customerId && c.id === selectedTx.customerId) {
          const debtToRevert = selectedTx.paymentMethod === PaymentMethod.DEBT 
            ? selectedTx.total 
            : (selectedTx.paymentMethod === PaymentMethod.PARTIAL && selectedTx.paymentDetails ? selectedTx.paymentDetails.debt : 0);
          
          return {
            ...c,
            debtBalance: Math.max(0, c.debtBalance - debtToRevert),
            loyaltyPoints: Math.max(0, c.loyaltyPoints - Math.floor(selectedTx.total)),
            history: c.history.filter(id => id !== selectedTx.id)
          };
        }
        return c;
      });

      const binItem = {
        id: generateId(),
        type: 'TRANSACTION' as const,
        deletedAt: Date.now(),
        title: `Invoice #INV-${selectedTx.id.slice(-5).toUpperCase()} ($${selectedTx.total.toFixed(2)})`,
        description: `Items: ${selectedTx.items?.length || 0} • Payment: ${selectedTx.paymentMethod} • Date: ${new Date(selectedTx.timestamp).toLocaleString()}`,
        originalData: selectedTx
      };

      const updatedDeletedIds = { ...(prev.deletedIds || {}) };
      updatedDeletedIds[selectedTx.id] = Date.now();

      return {
        ...prev,
        transactions: prev.transactions.filter(t => t.id !== selectedTx.id),
        products: newProducts,
        accounts: updatedAccounts,
        customers: newCustomers,
        recycleBin: [binItem, ...(prev.recycleBin || [])],
        deletedIds: updatedDeletedIds,
        lastModified: Date.now()
      };
    });

    addLog('Invoice Deleted', `Invoice #INV-${selectedTx.id.slice(-5).toUpperCase()} deleted and financials reverted.`);
    setSelectedTx(null);
  };

  // Send WhatsApp Customer Statement with Daily Exchange Rates combined accurately
  const handleSendCustomerWhatsAppStatement = () => {
    if (!activeSelectedCustomer) return;
    const phone = activeSelectedCustomer.phone.replace(/[^0-9]/g, '');
    if (!phone) {
      alert('Macmiilkan malaha lambar taleefan.');
      return;
    }

    const bizName = data.settings?.businessName || 'Supermarket';
    let msg = `📊 *${bizName.toUpperCase()} - XISAAB-XIDHKA GUUD EE BIILASHA*\n`;
    msg += `----------------------------------------\n`;
    msg += `👤 *Macaamiilka:* ${activeSelectedCustomer.name}\n`;
    msg += `📱 *Telefoon:* ${activeSelectedCustomer.phone}\n`;
    msg += `📅 *Taariikhda:* ${new Date().toLocaleDateString('so-SO', { year: 'numeric', month: 'long', day: 'numeric' })}\n`;
    msg += `----------------------------------------\n`;
    msg += `🧾 *KALA FURSADA BIILASHA & SARIFKII MAALMAHA:*\n\n`;

    filteredTx.forEach((tx, idx) => {
      const txDate = new Date(tx.timestamp).toLocaleDateString();
      const txRate = tx.exchangeRate || currentGlobalRate || 1;
      const totalETB = tx.total * txRate;
      
      const pm = (tx.paymentMethod || '').toLowerCase();
      const isPureDebt = pm === 'debt' || pm.includes('debt') || pm.includes('deyn') || tx.type === 'CASH_LOAN';
      const isPartial = tx.paymentMethod === PaymentMethod.PARTIAL && (tx.paymentDetails?.debt || 0) > 0;
      
      const statusIcon = isPureDebt ? '❌ (Deyn)' : (isPartial ? '⚠️ (Qayb Deyn)' : '✅ (Bixiyay)');

      msg += `${idx + 1}. *#INV-${tx.id.slice(-5).toUpperCase()}* [${txDate}] ${statusIcon}\n`;
      msg += `   💱 *Sarifkii Maalinkaas:* $1 = ${txRate} ETB\n`;
      msg += `   💵 *Qiimaha:* $${tx.total.toFixed(2)} USD  /  *${totalETB.toLocaleString()} ETB*\n`;
      msg += `   🛍️ *Alaabta:* ${tx.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}\n`;
      if (isPureDebt || isPartial) {
        const debtUSD = isPureDebt ? tx.total : (tx.paymentDetails?.debt || 0);
        msg += `   🔴 *Deynta Biilkan:* $${debtUSD.toFixed(2)} USD (${(debtUSD * txRate).toLocaleString()} ETB)\n`;
      }
      msg += `\n`;
    });

    msg += `----------------------------------------\n`;
    msg += `💰 *WADARTA GUUD EE IIBKA:* $${filteredSummary.totalUSD.toFixed(2)} USD\n`;
    msg += `🇪🇹 *WADARTA GUUD (ETB - ISKU DARKA SARIFYADA):* ${filteredSummary.totalETB.toLocaleString()} ETB\n`;
    if (filteredSummary.debtUSD > 0) {
      msg += `⚠️ *WADARTA DEYNTA HADHAY:* $${filteredSummary.debtUSD.toFixed(2)} USD (${filteredSummary.debtETB.toLocaleString()} ETB)\n`;
    }
    msg += `⚖️ *CELCELISKA SARIFKA:* $1 = ${filteredSummary.averageRate.toFixed(2)} ETB\n`;
    msg += `----------------------------------------\n`;

    // Payment Numbers
    const ebirrNo = data.settings?.onlinePaymentNumbers?.ebirr || '0901234567';
    const cbeNo = data.settings?.onlinePaymentNumbers?.commercialBank || '1000123456789';
    const kaafiNo = data.settings?.onlinePaymentNumbers?.kaafi || data.settings?.onlinePaymentNumbers?.golis || '0631234567';

    msg += `💳 *AKOONNADA LACAG BIXINTA:*\n`;
    msg += `📱 *1. E-Birr:* ${ebirrNo}\n`;
    msg += `🏦 *2. CBE Bank:* ${cbeNo}\n`;
    msg += `💳 *3. Kaafi / Zaad:* ${kaafiNo}\n`;
    msg += `----------------------------------------\n`;
    if (filteredSummary.debtUSD > 0) {
      msg += `📢 *Fadlan bixi lacagta deynta lagugu leeyahay adoo raali ah.*\n`;
    }
    msg += `Mahadsanid! Thank you for your business! 🙏`;

    const cleanPhone = phone.startsWith('251') || phone.startsWith('252') ? phone : `251${phone.replace(/^0+/, '')}`;
    const url = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`;
    window.open(url, '_blank');
    addLog('WhatsApp Statement Sent', `Sent accurate multi-rate statement to ${activeSelectedCustomer.name}`);
  };

  return (
    <div className="flex flex-col h-full bg-slate-50 no-print overflow-hidden">
      {/* Top Filter & Navigation Control Panel */}
      <div className="bg-white border-b border-slate-200 p-4 shrink-0 space-y-3 shadow-xs">
        {/* Row 1: Search & Date Filters */}
        <div className="flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 min-w-[260px]">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="Raadi Invoice ID, Magaca Macmiilka, Alaabta, Tel..."
              className="w-full pl-10 pr-4 py-2.5 bg-slate-100/80 border border-slate-200 rounded-2xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none text-xs font-bold text-slate-800 transition-all"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button 
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Quick Date Filters (Maanta, Shalay, Custom Date) */}
          <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200">
            <button
              onClick={() => setDateFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${
                dateFilter === 'ALL' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              Dhammaan
            </button>
            <button
              onClick={() => setDateFilter('TODAY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 ${
                dateFilter === 'TODAY' ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Calendar size={13} /> Maanta
            </button>
            <button
              onClick={() => setDateFilter('YESTERDAY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 ${
                dateFilter === 'YESTERDAY' ? 'bg-amber-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Clock size={13} /> Shalay
            </button>
            <button
              onClick={() => setDateFilter('THIS_WEEK')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all hidden sm:block ${
                dateFilter === 'THIS_WEEK' ? 'bg-indigo-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Toddobaadkan
            </button>
            <button
              onClick={() => setDateFilter('THIS_MONTH')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all hidden md:block ${
                dateFilter === 'THIS_MONTH' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Bishan
            </button>
            <button
              onClick={() => setDateFilter('CUSTOM')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1 ${
                dateFilter === 'CUSTOM' ? 'bg-purple-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Filter size={13} /> Custom Date
            </button>
          </div>

          {/* Export & Actions */}
          <button 
            onClick={exportInvoicesToExcel}
            className="flex items-center justify-center gap-1.5 px-4 py-2.5 bg-emerald-50 text-emerald-700 rounded-2xl font-black text-xs border border-emerald-200 hover:bg-emerald-100 active:scale-95 transition-all shadow-2xs"
            title="Dhoofi liiska shaandheysan ee Excel/CSV"
          >
            <Download size={14} /> Export CSV
          </button>
        </div>

        {/* Custom Date Pickers (Shown when dateFilter === 'CUSTOM') */}
        {dateFilter === 'CUSTOM' && (
          <div className="flex flex-wrap items-center gap-3 p-3 bg-purple-50/60 border border-purple-200 rounded-2xl">
            <span className="text-xs font-black text-purple-900 flex items-center gap-1.5">
              <Calendar size={14} className="text-purple-600" />
              Dooro Taariikhda:
            </span>
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-bold text-slate-500">Laga bilaabo:</label>
              <input 
                type="date"
                value={customStartDate}
                onChange={e => setCustomStartDate(e.target.value)}
                className="px-3 py-1.5 bg-white border border-purple-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-[11px] font-bold text-slate-500">Ilaa:</label>
              <input 
                type="date"
                value={customEndDate}
                onChange={e => setCustomEndDate(e.target.value)}
                className="px-3 py-1.5 bg-white border border-purple-200 rounded-xl text-xs font-black text-slate-800 outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
            {(customStartDate || customEndDate) && (
              <button
                onClick={() => { setCustomStartDate(''); setCustomEndDate(''); }}
                className="text-[11px] font-black text-purple-700 hover:text-purple-900 underline ml-auto"
              >
                Nadiifi Taariikhda
              </button>
            )}
          </div>
        )}

        {/* Row 2: Customer Selector & Payment Status Pills ("Qof walba meel u gooni ah") */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-slate-100 text-xs">
          {/* Customer Dropdown & Quick Selector */}
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-black text-slate-500 flex items-center gap-1">
              <Users size={14} className="text-blue-600" />
              Macmiilka:
            </span>
            <select
              value={selectedCustomerId}
              onChange={e => {
                setSelectedCustomerId(e.target.value);
                setSelectedTx(null); // reset selected invoice so statement or first invoice shows
              }}
              className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl font-black text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500 max-w-[240px]"
            >
              <option value="ALL">👥 Dhammaan Macaamiisha ({data.transactions.length} biil)</option>
              <option value="WALIN">🚶 Walk-in Customers ({data.transactions.filter(t => !t.customerId).length})</option>
              <optgroup label="Macaamiisha Diiwaangashan">
                {customersWithInvoices.map(({ customer, count, totalSpentUSD }) => (
                  <option key={customer.id} value={customer.id}>
                    {customer.name} ({count} biil | ${totalSpentUSD.toFixed(0)}) {customer.debtBalance > 0 ? `• Deyn: $${customer.debtBalance}` : ''}
                  </option>
                ))}
              </optgroup>
            </select>

            {/* Quick Filter Status */}
            <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-xl border border-slate-200">
              <button
                onClick={() => setPaymentStatusFilter('ALL')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all ${
                  paymentStatusFilter === 'ALL' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                }`}
              >
                Dhammaan
              </button>
              <button
                onClick={() => setPaymentStatusFilter('PAID')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all ${
                  paymentStatusFilter === 'PAID' ? 'bg-emerald-600 text-white shadow-2xs' : 'text-emerald-700'
                }`}
              >
                ✅ Bixiyay
              </button>
              <button
                onClick={() => setPaymentStatusFilter('DEBT')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all ${
                  paymentStatusFilter === 'DEBT' ? 'bg-rose-600 text-white shadow-2xs' : 'text-rose-700'
                }`}
              >
                ❌ Deyn
              </button>
              <button
                onClick={() => setPaymentStatusFilter('PARTIAL')}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-black transition-all ${
                  paymentStatusFilter === 'PARTIAL' ? 'bg-amber-600 text-white shadow-2xs' : 'text-amber-700'
                }`}
              >
                ⚠️ Qayb
              </button>
            </div>
          </div>

          {/* Quick Metrics of Current Selection with Daily Exchange Rates combined accurately */}
          <div className="flex items-center gap-2 flex-wrap text-[11px] font-black text-slate-600 ml-auto">
            <span className="bg-blue-50 text-blue-800 px-3 py-1 rounded-xl border border-blue-200 flex items-center gap-1">
              Biilasha: <strong>{filteredSummary.count}</strong>
            </span>
            <span className="bg-emerald-50 text-emerald-800 px-3 py-1 rounded-xl border border-emerald-200 flex items-center gap-1">
              USD: <strong>${filteredSummary.totalUSD.toFixed(2)}</strong>
            </span>
            <span className="bg-indigo-50 text-indigo-800 px-3 py-1 rounded-xl border border-indigo-200 flex items-center gap-1" title="Isku-darka sarifyadii maalmaha ee biil kasta">
              ETB (Sarifyada Maalmaha): <strong>{filteredSummary.totalETB.toLocaleString(undefined, { maximumFractionDigits: 1 })} ETB</strong>
            </span>
            {filteredSummary.debtUSD > 0 && (
              <span className="bg-rose-50 text-rose-800 px-3 py-1 rounded-xl border border-rose-200 flex items-center gap-1">
                Deyn: <strong>${filteredSummary.debtUSD.toFixed(2)} ({filteredSummary.debtETB.toLocaleString(undefined, { maximumFractionDigits: 1 })} ETB)</strong>
              </span>
            )}
          </div>
        </div>

        {/* Dedicated Customer Profile & Daily Rates Combined Financial Dashboard ("Qof walba meel u gooni ah oo Totalka saxan") */}
        {activeSelectedCustomer && (
          <div className="p-4 bg-gradient-to-r from-blue-50 via-indigo-50/50 to-slate-50 border-2 border-blue-300 rounded-3xl space-y-3 shadow-xs">
            {/* Header row: Customer Info, Badges & Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center font-black text-lg shadow-md">
                  {activeSelectedCustomer.photo ? (
                    <img src={activeSelectedCustomer.photo} className="w-full h-full object-cover rounded-2xl" />
                  ) : (
                    activeSelectedCustomer.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-black text-slate-900">{activeSelectedCustomer.name}</h3>
                    <span className="px-2.5 py-0.5 bg-blue-600 text-white rounded-lg text-[10px] font-black uppercase tracking-wide">
                      📁 Meel Gooni ah (Customer File)
                    </span>
                  </div>
                  <div className="flex items-center gap-3 text-xs text-slate-500 font-bold mt-0.5">
                    <span className="flex items-center gap-1">
                      <Phone size={12} className="text-slate-400" />
                      {activeSelectedCustomer.phone}
                    </span>
                    <span>•</span>
                    <span className="text-blue-700 font-black">
                      {filteredSummary.count} Biilood oo ku jira faylkan
                    </span>
                  </div>
                </div>
              </div>

              {/* Action Buttons for this Customer */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handleSendCustomerWhatsAppStatement}
                  className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white hover:bg-emerald-700 rounded-xl font-black text-xs transition-all shadow-xs active:scale-95"
                >
                  <MessageSquare size={14} /> WhatsApp Statement
                </button>
                
                <button
                  onClick={() => {
                    setSelectedTx(null);
                    setCustomerViewMode('STATEMENT');
                  }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl font-black text-xs transition-all border ${
                    !selectedTx && customerViewMode === 'STATEMENT' 
                      ? 'bg-slate-900 text-white border-slate-900 shadow-xs' 
                      : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <BookOpen size={14} /> Warqadda Xisaab-xidhka Guud
                </button>

                <button
                  onClick={() => setSelectedCustomerId('ALL')}
                  className="px-3 py-2 bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-xl text-xs font-black transition-all"
                >
                  Dhammaan Macaamiisha
                </button>
              </div>
            </div>

            {/* Financial Totals Cards with Exact Multi-Day Exchange Rate Aggregation */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1">
              {/* Card 1: Grand Total Sales (USD & ETB Combined) */}
              <div className="p-3 bg-white rounded-2xl border border-blue-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                  💰 Wadarta Guud ee Iibka
                </span>
                <p className="text-base font-black text-slate-900 font-mono">
                  ${filteredSummary.totalUSD.toFixed(2)} <span className="text-xs text-slate-400">USD</span>
                </p>
                <p className="text-xs font-black text-blue-600 font-mono">
                  {filteredSummary.totalETB.toLocaleString(undefined, { maximumFractionDigits: 1 })} ETB
                </p>
                <div className="text-[9px] font-bold text-slate-400 pt-0.5">
                  Isku-darka sarifyadii maalmaha
                </div>
              </div>

              {/* Card 2: Debt (Deynta Hadhay) */}
              <div className="p-3 bg-white rounded-2xl border border-rose-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-black text-rose-500 uppercase tracking-wider block">
                  ⚠️ Wadarta Deynta Hadhay
                </span>
                <p className="text-base font-black text-rose-600 font-mono">
                  ${filteredSummary.debtUSD.toFixed(2)} <span className="text-xs text-rose-300">USD</span>
                </p>
                <p className="text-xs font-black text-rose-700 font-mono">
                  {filteredSummary.debtETB.toLocaleString(undefined, { maximumFractionDigits: 1 })} ETB
                </p>
                <div className="text-[9px] font-bold text-rose-400 pt-0.5">
                  Deynta ku jirta biilashan
                </div>
              </div>

              {/* Card 3: Paid (Lacagta la bixiyay) */}
              <div className="p-3 bg-white rounded-2xl border border-emerald-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-black text-emerald-600 uppercase tracking-wider block">
                  ✅ Lacagta La Bixiyay
                </span>
                <p className="text-base font-black text-emerald-700 font-mono">
                  ${filteredSummary.paidUSD.toFixed(2)} <span className="text-xs text-emerald-300">USD</span>
                </p>
                <p className="text-xs font-black text-emerald-600 font-mono">
                  {filteredSummary.paidETB.toLocaleString(undefined, { maximumFractionDigits: 1 })} ETB
                </p>
                <div className="text-[9px] font-bold text-emerald-500 pt-0.5">
                  Cash & Bank la qabtay
                </div>
              </div>

              {/* Card 4: Items & Effective Rate */}
              <div className="p-3 bg-white rounded-2xl border border-indigo-200 shadow-2xs space-y-1">
                <span className="text-[10px] font-black text-indigo-600 uppercase tracking-wider block">
                  ⚖️ Celceliska Sarifka & Alaabta
                </span>
                <p className="text-sm font-black text-indigo-900 font-mono">
                  $1 = {filteredSummary.averageRate.toFixed(2)} ETB
                </p>
                <p className="text-xs font-black text-slate-700">
                  📦 {filteredSummary.totalItems} xabbo ({filteredSummary.uniqueItemsCount} nooc)
                </p>
                <div className="text-[9px] font-bold text-indigo-500 pt-0.5">
                  Rate-ka isku celceliska ah
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Main Split View: Left List (Invoices with Items Preview) & Right Invoice Paper Document / Customer Statement */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Side: Invoices List */}
        <div className="w-full md:w-[380px] lg:w-[430px] border-r border-slate-200 bg-white overflow-y-auto shrink-0 divide-y divide-slate-100">
          {/* Quick Header inside left list if customer is selected */}
          {activeSelectedCustomer && (
            <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-black text-slate-700">
                Biilasha {activeSelectedCustomer.name} ({filteredTx.length})
              </span>
              <button
                onClick={() => {
                  setSelectedTx(null);
                  setCustomerViewMode('STATEMENT');
                }}
                className="text-[11px] font-black text-blue-600 hover:text-blue-800 underline"
              >
                Arag Xisaab-xidhka Guud
              </button>
            </div>
          )}

          {filteredTx.length === 0 ? (
            <div className="p-12 text-center flex flex-col items-center justify-center text-slate-400 space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-300">
                <FileText size={28} />
              </div>
              <p className="text-sm font-black text-slate-700">Lama helin wax Invoice ah</p>
              <p className="text-xs text-slate-400 max-w-xs">
                Isku day inaad bedesho shaandhada taariikhda ama magaca macmiilka aad raadinayso.
              </p>
              {(search || dateFilter !== 'ALL' || selectedCustomerId !== 'ALL' || paymentStatusFilter !== 'ALL') && (
                <button
                  onClick={() => {
                    setSearch('');
                    setDateFilter('ALL');
                    setSelectedCustomerId('ALL');
                    setPaymentStatusFilter('ALL');
                  }}
                  className="px-3.5 py-1.5 bg-blue-600 text-white rounded-xl text-xs font-black"
                >
                  Dib u Nadiifi Shaandheynta
                </button>
              )}
            </div>
          ) : (
            filteredTx.map(t => {
              const isSelected = selectedTx?.id === t.id;
              const txRate = t.exchangeRate || currentGlobalRate || 1;
              const totalTakenUSD = t.total || 0;
              const totalTakenETB = totalTakenUSD * txRate;
              const customerName = getCustomerName(t);
              const totalItemsCount = t.items.reduce((sum, i) => sum + (i.quantity || 1), 0);
              
              const pm = (t.paymentMethod || '').toLowerCase();
              const isPureDebt = pm === 'debt' || pm.includes('debt') || pm.includes('deyn') || t.type === 'CASH_LOAN';
              const isPartial = t.paymentMethod === PaymentMethod.PARTIAL && (t.paymentDetails?.debt || 0) > 0;

              let debtUSD = 0;
              if (isPureDebt) {
                debtUSD = totalTakenUSD;
              } else if (isPartial) {
                debtUSD = t.paymentDetails?.debt || 0;
              }
              const debtETB = debtUSD * txRate;

              const paidUSD = Math.max(0, totalTakenUSD - debtUSD);
              const paidETB = paidUSD * txRate;

              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setSelectedTx(t);
                    setCustomerViewMode('INVOICE');
                  }}
                  className={`w-full p-4 text-left transition-all hover:bg-slate-50 flex flex-col gap-2 relative border-b border-slate-100 ${
                    isSelected ? 'bg-blue-50/80 border-r-4 border-r-blue-600' : ''
                  }`}
                >
                  {/* Top Bar: Invoice ID & Status */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-black text-xs text-slate-900 flex items-center gap-1 font-mono">
                        <FileText size={13} className={isSelected ? 'text-blue-600' : 'text-slate-400'} />
                        INV-{t.id.slice(-5).toUpperCase()}
                      </span>
                      {t.pageNumber && (
                        <span className="px-1.5 py-0.5 bg-amber-50 text-amber-700 border border-amber-200 rounded font-black text-[9px]">
                          Bog: {t.pageNumber}
                        </span>
                      )}
                    </div>

                    {isPureDebt ? (
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-rose-100 text-rose-700 border border-rose-200 uppercase">
                        ❌ Deyn
                      </span>
                    ) : isPartial ? (
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-amber-100 text-amber-800 border border-amber-200 uppercase">
                        ⚠️ Qayb Deyn
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-md text-[9px] font-black bg-emerald-100 text-emerald-700 border border-emerald-200 uppercase">
                        ✅ Bixiyay
                      </span>
                    )}
                  </div>

                  {/* Customer & Date Strip */}
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-black text-slate-800 truncate max-w-[180px]" title={customerName}>
                      👤 {customerName}
                    </span>
                    <span className="text-[11px] font-bold text-slate-400 font-mono">
                      📅 {new Date(t.timestamp).toLocaleDateString()}
                    </span>
                  </div>

                  {/* Items Taken Breakdown Snippet (Warqada inta ku qoran oo uu qofku qaatay) */}
                  <div className="bg-slate-50/90 rounded-xl p-2.5 border border-slate-200/70 text-[11px] space-y-1">
                    <div className="flex items-center justify-between font-black text-slate-700 text-[10px]">
                      <span className="flex items-center gap-1">
                        <Package size={11} className="text-blue-500" />
                        Alaabta ({t.items.length} nooc / {totalItemsCount} xabbo):
                      </span>
                      <span className="text-indigo-700 font-mono font-black bg-indigo-50 px-1.5 py-0.5 rounded border border-indigo-200 text-[9px]">
                        Sarifkii: $1 = {txRate} ETB
                      </span>
                    </div>
                    <p className="text-slate-600 font-bold truncate text-[10px]" title={t.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}>
                      {t.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                    </p>
                  </div>

                  {/* 3-Step Financial Calculation Breakdown Chips (Qaatay - Bixiyay = Hadhay) */}
                  <div className="grid grid-cols-3 gap-1.5 pt-1 text-[10px]">
                    <div className="bg-blue-50/80 p-1.5 rounded-lg border border-blue-100">
                      <span className="text-[9px] font-black text-blue-600 block leading-tight">🛍️ Qaatay</span>
                      <span className="font-black font-mono text-blue-900 block leading-tight">${totalTakenUSD.toFixed(2)}</span>
                      <span className="text-[8px] font-bold text-blue-700 font-mono truncate block leading-tight">{totalTakenETB.toLocaleString(undefined, { maximumFractionDigits: 0 })} ETB</span>
                    </div>
                    <div className="bg-emerald-50/80 p-1.5 rounded-lg border border-emerald-100">
                      <span className="text-[9px] font-black text-emerald-600 block leading-tight">➖ 💳 Bixiyay</span>
                      <span className="font-black font-mono text-emerald-900 block leading-tight">${paidUSD.toFixed(2)}</span>
                      <span className="text-[8px] font-bold text-emerald-700 font-mono truncate block leading-tight">{paidETB.toLocaleString(undefined, { maximumFractionDigits: 0 })} ETB</span>
                    </div>
                    <div className={`p-1.5 rounded-lg border ${debtUSD > 0 ? 'bg-rose-50/90 border-rose-200 text-rose-900' : 'bg-slate-50 border-slate-200 text-slate-700'}`}>
                      <span className="text-[9px] font-black block leading-tight">🟰 ⚠️ Hadhay</span>
                      <span className="font-black font-mono block leading-tight">${debtUSD.toFixed(2)}</span>
                      <span className="text-[8px] font-bold font-mono truncate block leading-tight">{debtETB.toLocaleString(undefined, { maximumFractionDigits: 0 })} ETB</span>
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </div>

        {/* Right Side: Detailed Invoice Paper Document OR Customer Account Statement */}
        <div className="flex-1 overflow-y-auto p-4 md:p-8 bg-slate-100/70">
          {selectedTx ? (() => {
            // SINGLE INVOICE PAPER VIEW
            const txRate = selectedTx.exchangeRate || currentGlobalRate || 1;
            const totalETB = selectedTx.total * txRate;
            const customerObj = getCustomerObj(selectedTx);
            const customerName = getCustomerName(selectedTx);
            const totalItemsCount = selectedTx.items.reduce((s, i) => s + (i.quantity || 1), 0);

            const pm = (selectedTx.paymentMethod || '').toLowerCase();
            const isPureDebt = pm === 'debt' || pm.includes('debt') || pm.includes('deyn') || selectedTx.type === 'CASH_LOAN';
            const isPartialDebt = selectedTx.paymentMethod === PaymentMethod.PARTIAL && (selectedTx.paymentDetails?.debt || 0) > 0;

            return (
              <div className="max-w-[780px] mx-auto space-y-4">
                {/* Action Bar (Print, WhatsApp, POS, Delete) */}
                <div className="flex flex-wrap justify-between items-center gap-2 no-print bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    {!isCashier && (
                      <button 
                        onClick={handleDeleteInvoice}
                        className="flex items-center gap-1.5 px-3 py-2 bg-rose-50 text-rose-600 rounded-xl font-black text-xs hover:bg-rose-100 transition-all border border-rose-200 uppercase active:scale-95"
                        title="Tirtir Biilka (Admin / Manager Only)"
                      >
                        <Trash2 size={14} /> Tirtir
                      </button>
                    )}
                    <button 
                      onClick={() => sendWhatsAppReceipt(selectedTx, data, currency, txRate)}
                      className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-xl font-black text-xs hover:bg-emerald-700 transition-all shadow-sm uppercase active:scale-95"
                    >
                      <MessageSquare size={14} /> WhatsApp
                    </button>
                    {onLoadItemsToPOS && (
                      <button 
                        onClick={() => {
                          const cust = data.customers.find(c => c.id === selectedTx.customerId);
                          onLoadItemsToPOS(selectedTx.items, cust);
                        }}
                        className="flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 text-white rounded-xl font-black text-xs hover:bg-blue-500 transition-all shadow-sm uppercase active:scale-95"
                      >
                        <ShoppingCart size={14} /> POS
                      </button>
                    )}
                    {activeSelectedCustomer && (
                      <button
                        onClick={() => {
                          setSelectedTx(null);
                          setCustomerViewMode('STATEMENT');
                        }}
                        className="flex items-center gap-1 px-3 py-2 bg-indigo-50 text-indigo-700 rounded-xl font-black text-xs hover:bg-indigo-100 transition-all border border-indigo-200"
                      >
                        <BookOpen size={13} /> Xisaab-xidhka Guud
                      </button>
                    )}
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => window.print()} 
                      className="flex items-center gap-2 px-5 py-2 bg-slate-900 hover:bg-black text-white rounded-xl font-black text-xs shadow-md active:scale-95 transition-all"
                    >
                      <Printer size={15} /> Daabac Warqadda A4 (Print)
                    </button>
                  </div>
                </div>

                {/* The Official A4 Invoice Paper Document */}
                <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xl print:shadow-none print:border-none print:p-0 print:m-0 text-slate-900 space-y-6">
                  {/* Header Bar */}
                  <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                    <div>
                      <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight uppercase leading-tight">
                        {data.settings.businessName}
                      </h1>
                      <p className="text-[11px] font-black text-slate-600 uppercase tracking-widest mt-1">
                        WARQADDA IIBKA & RASIIDKA / SALES INVOICE
                      </p>
                      {data.settings.storePhone && (
                        <p className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-1">
                          <Phone size={12} className="text-slate-400" /> Tel: {data.settings.storePhone}
                        </p>
                      )}
                    </div>
                    <div className="text-right space-y-1.5">
                      <div className="inline-block bg-slate-900 text-white px-3 py-1.5 rounded-xl font-mono font-black text-xs uppercase tracking-wide shadow-xs">
                        INV-{selectedTx.id.slice(-6).toUpperCase()}
                      </div>
                      <p className="text-xs font-bold text-slate-600 font-mono">
                        📅 {new Date(selectedTx.timestamp).toLocaleString()}
                      </p>
                      {selectedTx.pageNumber && (
                        <span className="inline-block px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg font-black text-[10px]">
                          📑 Boga Buugga: {selectedTx.pageNumber}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Customer, Rate & Payment Details Strip */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs">
                    {/* Customer Info */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                        👤 Macaamiilka (Customer)
                      </span>
                      <p className="font-black text-slate-900 text-sm truncate">{customerName}</p>
                      {customerObj?.phone && (
                        <p className="text-[11px] font-bold text-slate-500">{customerObj.phone}</p>
                      )}
                    </div>

                    {/* Payment Method */}
                    <div className="space-y-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                        💳 Habka Bixinta (Payment)
                      </span>
                      <p className="font-black text-slate-800 uppercase">{selectedTx.paymentMethod}</p>
                      {selectedTx.accountId && (
                        <p className="text-[11px] font-bold text-slate-500">
                          {data.accounts.find(a => a.id === selectedTx.accountId)?.name || selectedTx.accountId}
                        </p>
                      )}
                    </div>

                    {/* Historical Exchange Rate on the Day of Sale */}
                    <div className="space-y-1 bg-indigo-50/70 p-2.5 rounded-xl border border-indigo-100">
                      <span className="text-[10px] font-black text-indigo-900 uppercase tracking-wider block flex items-center gap-1">
                        💱 Sarifka Maalintii Iibka
                      </span>
                      <p className="font-black text-indigo-700 font-mono text-sm">
                        $1 = {txRate} ETB
                      </p>
                      <p className="text-[9px] font-bold text-indigo-600">Rate-kii maalinkaas go'naa</p>
                    </div>

                    {/* Status Badge */}
                    <div className="space-y-1 sm:text-right">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">
                        Xaaladda (Status)
                      </span>
                      {isPureDebt ? (
                        <span className="inline-block text-[11px] font-black text-rose-700 bg-rose-100 border border-rose-300 px-3 py-1 rounded-xl uppercase">
                          ❌ NOT PAID (DEYN)
                        </span>
                      ) : isPartialDebt ? (
                        <span className="inline-block text-[11px] font-black text-amber-800 bg-amber-100 border border-amber-300 px-3 py-1 rounded-xl uppercase">
                          ⚠️ PARTIAL (Deyn: ${(selectedTx.paymentDetails?.debt || 0).toFixed(2)})
                        </span>
                      ) : (
                        <span className="inline-block text-[11px] font-black text-emerald-700 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-xl uppercase">
                          ✅ PAID (BIXIYAY)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Summary Box: What the customer took (Alaabta uu Macmiilku Qaatay) */}
                  <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-2xl flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black">
                        <Package size={16} />
                      </div>
                      <div>
                        <span className="font-black text-slate-900 block">
                          Warqadda Alaabta uu Qofku Qaatay (Items Taken Breakdown)
                        </span>
                        <span className="text-[11px] font-bold text-slate-500">
                          Dhammaan waxyaabaha ku qoran warqaddan oo la wareejiyay
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="px-3 py-1 bg-white border border-blue-200 rounded-xl font-black text-blue-900 text-xs shadow-2xs">
                        🛍️ {selectedTx.items.length} Nooc oo Alaab ah
                      </span>
                      <span className="px-3 py-1 bg-white border border-blue-200 rounded-xl font-black text-blue-900 text-xs shadow-2xs">
                        📦 {totalItemsCount} Wadar Xabbo/Tiro
                      </span>
                    </div>
                  </div>

                  {/* Items Table: Prominently showing all items taken, quantities, rates, line totals */}
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs border-collapse">
                      <thead>
                        <tr className="border-b-2 border-slate-900 text-[11px] font-black uppercase text-slate-800 tracking-wider bg-slate-50">
                          <th className="py-3 px-3 text-left w-10">#</th>
                          <th className="py-3 px-3 text-left">Alaabta la Qaatay (Product Description)</th>
                          <th className="py-3 px-3 text-center w-24">Tirada (Qty)</th>
                          <th className="py-3 px-3 text-right w-28">Qiimaha ($ USD)</th>
                          <th className="py-3 px-3 text-right w-36">Wadarta (USD & ETB)</th>
                          <th className="py-3 px-3 text-center w-12 no-print"></th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-slate-800">
                        {selectedTx.items.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-3 px-3 text-slate-400 font-mono text-[11px] font-bold">{idx + 1}</td>
                            <td className="py-3 px-3">
                              <p className="font-black text-slate-900 text-sm leading-snug">{item.name}</p>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 font-mono">
                                {item.sku && <span>SKU: {item.sku}</span>}
                                {item.category && <span className="text-slate-500">• {item.category}</span>}
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center">
                              <span className="font-black text-slate-900 text-xs bg-slate-100 px-2.5 py-1 rounded-lg">
                                {item.quantity} {item.unit || 'PCS'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-bold text-slate-600 font-mono text-xs">
                              ${item.sellPrice.toFixed(2)}
                            </td>
                            <td className="py-3 px-3 text-right font-black text-slate-900 font-mono text-sm">
                              <div>${(item.sellPrice * item.quantity).toFixed(2)} USD</div>
                              <div className="text-[11px] text-indigo-700 font-bold">
                                {((item.sellPrice * item.quantity) * txRate).toLocaleString(undefined, { maximumFractionDigits: 1 })} ETB
                              </div>
                            </td>
                            <td className="py-3 px-3 text-center no-print">
                              {!isCashier ? (
                                <button 
                                  onClick={() => handleRefundItem(selectedTx, item)}
                                  title="Soo Celi (Refund Item)"
                                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                                >
                                  <RotateCcw size={13} />
                                </button>
                              ) : (
                                <span className="text-[10px] text-slate-300 font-mono">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Financial Breakdown & 3-Step Calculation Card */}
                  <div className="space-y-4 pt-4 border-t-2 border-slate-900">
                    {/* The 3-Step Formula Card: Qaatay - Laga Jaray = Hadhay */}
                    {(() => {
                      const totalTakenUSD = selectedTx.total || 0;
                      const totalTakenETB = totalTakenUSD * txRate;
                      let debtUSD = 0;
                      if (isPureDebt) {
                        debtUSD = totalTakenUSD;
                      } else if (isPartialDebt) {
                        debtUSD = selectedTx.paymentDetails?.debt || 0;
                      }
                      const debtETB = debtUSD * txRate;
                      const paidUSD = Math.max(0, totalTakenUSD - debtUSD);
                      const paidETB = paidUSD * txRate;

                      return (
                        <div className="p-4 bg-gradient-to-r from-blue-50/70 via-slate-50 to-indigo-50/70 border-2 border-slate-900 rounded-2xl space-y-3">
                          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 pb-2">
                            <span className="text-xs font-black text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                              🧮 Xisaabinta Rasiidkan (Calculation Breakdown)
                            </span>
                            <span className="text-xs font-black text-indigo-700 bg-white px-2.5 py-1 rounded-xl border border-indigo-200 font-mono shadow-2xs">
                              💱 Sarifkii Maalintii Iibka: $1 = {txRate} ETB
                            </span>
                          </div>

                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                            {/* Step 1: Inta uu Qaatay */}
                            <div className="bg-white p-3 rounded-xl border border-blue-200 shadow-2xs">
                              <span className="text-[10px] font-black text-blue-700 uppercase block">
                                🛍️ 1. Inta uu Qaatay (Total Taken)
                              </span>
                              <p className="text-lg font-black text-blue-900 font-mono mt-0.5">
                                ${totalTakenUSD.toFixed(2)} USD
                              </p>
                              <p className="text-xs font-black text-blue-700 font-mono">
                                {totalTakenETB.toLocaleString(undefined, { maximumFractionDigits: 1 })} ETB
                              </p>
                            </div>

                            {/* Step 2: Laga Jaray (Bixiyay) */}
                            <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs">
                              <span className="text-[10px] font-black text-emerald-700 uppercase block">
                                ➖ 💳 2. Laga Jaray (Inta Bixiyay)
                              </span>
                              <p className="text-lg font-black text-emerald-800 font-mono mt-0.5">
                                ${paidUSD.toFixed(2)} USD
                              </p>
                              <p className="text-xs font-black text-emerald-600 font-mono">
                                {paidETB.toLocaleString(undefined, { maximumFractionDigits: 1 })} ETB
                              </p>
                            </div>

                            {/* Step 3: Inta ku Harsan (Deyn) */}
                            <div className={`p-3 rounded-xl border shadow-2xs ${debtUSD > 0 ? 'bg-rose-50 border-rose-300' : 'bg-white border-slate-200'}`}>
                              <span className={`text-[10px] font-black uppercase block ${debtUSD > 0 ? 'text-rose-700' : 'text-slate-600'}`}>
                                🟰 ⚠️ 3. Inta ku Harsan (Deyn)
                              </span>
                              <p className={`text-lg font-black font-mono mt-0.5 ${debtUSD > 0 ? 'text-rose-700' : 'text-slate-800'}`}>
                                ${debtUSD.toFixed(2)} USD
                              </p>
                              <p className={`text-xs font-black font-mono ${debtUSD > 0 ? 'text-rose-600' : 'text-slate-500'}`}>
                                {debtETB.toLocaleString(undefined, { maximumFractionDigits: 1 })} ETB
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="flex flex-col sm:flex-row justify-between items-start gap-4 pt-2">
                      <div className="text-xs text-slate-500 space-y-1">
                        <p>• Waxaa diyaariyay: <strong className="text-slate-800 font-mono">{selectedTx.cashierName || 'Admin'}</strong></p>
                        <p>• Wadar Tirada Alaabta: <strong className="text-slate-800 font-mono">{totalItemsCount} items</strong></p>
                        <p>• Sarifka Rasiidka: <strong className="text-indigo-700 font-mono">$1 = {txRate} ETB</strong></p>
                        {customerObj?.debtBalance !== undefined && (
                          <p>• Wadarta Deynta Macmiilka Ku Taalla Hadda: <strong className="text-rose-700 font-mono">${customerObj.debtBalance.toFixed(2)} USD ({(customerObj.debtBalance * txRate).toLocaleString()} ETB)</strong></p>
                        )}
                      </div>

                      <div className="w-full sm:w-80 space-y-2 text-xs bg-slate-50 p-4 rounded-2xl border border-slate-200">
                        <div className="flex justify-between text-slate-600 font-bold">
                          <span>Subtotal:</span>
                          <span className="font-mono">${selectedTx.subtotal.toFixed(2)}</span>
                        </div>
                        {selectedTx.discount && selectedTx.discount > 0 ? (
                          <div className="flex justify-between text-rose-600 font-bold">
                            <span>Discount:</span>
                            <span className="font-mono">-${selectedTx.discount.toFixed(2)}</span>
                          </div>
                        ) : null}
                        {selectedTx.tax && selectedTx.tax > 0 ? (
                          <div className="flex justify-between text-slate-600 font-bold">
                            <span>Tax (VAT):</span>
                            <span className="font-mono">${selectedTx.tax.toFixed(2)}</span>
                          </div>
                        ) : null}

                        <div className="pt-2 border-t-2 border-slate-900 space-y-1">
                          <div className="flex justify-between text-base font-black text-slate-900">
                            <span className="uppercase">WADARTA (USD):</span>
                            <span className="font-mono text-lg text-blue-700">${selectedTx.total.toFixed(2)}</span>
                          </div>
                          <div className="flex justify-between text-sm font-black text-indigo-800">
                            <span className="uppercase">WADARTA (ETB):</span>
                            <span className="font-mono text-base">{totalETB.toLocaleString(undefined, { maximumFractionDigits: 1 })} ETB</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Payment Accounts (E-Birr, CBE, Kaafi) */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-left">
                    <div className="flex items-center justify-between border-b border-slate-200 pb-2">
                      <span className="text-[11px] font-black text-slate-800 uppercase tracking-wider">
                        💳 Akoonnada Lacag Bixinta (Payment Accounts):
                      </span>
                      <span className="text-[10px] font-bold text-slate-400">E-Birr • CBE • Kaafi</span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                        <span className="text-[10px] font-black text-emerald-700 block uppercase">1. E-Birr</span>
                        <p className="text-xs font-black text-slate-900 font-mono select-all mt-0.5">
                          {data.settings.onlinePaymentNumbers?.ebirr || '0901234567'}
                        </p>
                      </div>
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                        <span className="text-[10px] font-black text-indigo-700 block uppercase">2. CBE Bank</span>
                        <p className="text-xs font-black text-slate-900 font-mono select-all mt-0.5">
                          {data.settings.onlinePaymentNumbers?.commercialBank || '1000123456789'}
                        </p>
                      </div>
                      <div className="p-2.5 bg-white rounded-xl border border-slate-200">
                        <span className="text-[10px] font-black text-purple-700 block uppercase">3. Kaafi / Zaad</span>
                        <p className="text-xs font-black text-slate-900 font-mono select-all mt-0.5">
                          {data.settings.onlinePaymentNumbers?.kaafi || data.settings.onlinePaymentNumbers?.golis || '0631234567'}
                        </p>
                      </div>
                    </div>

                    {/* Polite Debt Notice */}
                    <div className="py-1.5 px-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-center mt-2">
                      <p className="text-xs font-black text-amber-950 uppercase tracking-tight">
                        📢 Fadlan bixi lacagta deynta lagugu leeyahay adoo raali ah
                      </p>
                    </div>
                  </div>

                  {/* Footer */}
                  <div className="pt-3 border-t border-slate-100 text-center">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      Waad ku mahadsan tahay ganacsigaaga! • {data.settings.businessName}
                    </p>
                  </div>
                </div>
              </div>
            );
          })() : activeSelectedCustomer ? (
            /* FULL CUSTOMER ACCOUNT STATEMENT VIEW (When a customer is selected & no single invoice is clicked) */
            <div className="max-w-[820px] mx-auto space-y-4">
              {/* Action Bar for Customer Statement */}
              <div className="flex flex-wrap justify-between items-center gap-2 no-print bg-white p-3 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                    <BookOpen size={15} className="text-blue-600" />
                    Warqadda Xisaab-xidhka Guud ee Macmiilka ({filteredTx.length} biil)
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={handleSendCustomerWhatsAppStatement}
                    className="flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 text-white rounded-xl font-black text-xs hover:bg-emerald-700 transition-all shadow-sm active:scale-95"
                  >
                    <MessageSquare size={14} /> WhatsApp Statement
                  </button>
                  <button 
                    onClick={() => window.print()} 
                    className="flex items-center gap-2 px-5 py-2 bg-slate-900 hover:bg-black text-white rounded-xl font-black text-xs shadow-md active:scale-95 transition-all"
                  >
                    <Printer size={15} /> Daabac Xisaab-xidhka A4
                  </button>
                </div>
              </div>

              {/* Printable Customer Account Statement Document */}
              <div className="bg-white p-6 sm:p-8 rounded-3xl border border-slate-200 shadow-xl print:shadow-none print:border-none print:p-0 print:m-0 text-slate-900 space-y-6">
                {/* Header */}
                <div className="flex justify-between items-start border-b-2 border-slate-900 pb-4">
                  <div>
                    <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight uppercase leading-tight">
                      {data.settings.businessName}
                    </h1>
                    <p className="text-[11px] font-black text-blue-700 uppercase tracking-widest mt-1">
                      WARQADDA XISAAB-XIDHKA GUUD & SARIFYADA MAALMAHA
                    </p>
                    {data.settings.storePhone && (
                      <p className="text-xs font-bold text-slate-500 mt-1 flex items-center gap-1">
                        <Phone size={12} className="text-slate-400" /> Tel: {data.settings.storePhone}
                      </p>
                    )}
                  </div>
                  <div className="text-right space-y-1">
                    <div className="inline-block bg-blue-700 text-white px-3 py-1 rounded-xl font-mono font-black text-xs uppercase tracking-wide">
                      CUSTOMER STATEMENT
                    </div>
                    <p className="text-xs font-bold text-slate-600 font-mono">
                      📅 {new Date().toLocaleDateString('so-SO', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                </div>

                {/* Customer Details Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-xs">
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Macaamiilka</span>
                    <p className="font-black text-slate-900 text-base">{activeSelectedCustomer.name}</p>
                    <p className="text-xs font-bold text-slate-500">{activeSelectedCustomer.phone}</p>
                  </div>
                  <div>
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Wadarta Biilasha</span>
                    <p className="font-black text-slate-900 text-base">{filteredTx.length} Biilood</p>
                    <p className="text-xs font-bold text-slate-500">{filteredSummary.totalItems} xabbo oo alaab ah</p>
                  </div>
                  <div className="sm:text-right">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">Deynta Hadda Ku Taalla</span>
                    <p className="font-black text-rose-600 text-base font-mono">
                      ${filteredSummary.debtUSD.toFixed(2)} USD
                    </p>
                    <p className="text-xs font-black text-rose-700 font-mono">
                      {filteredSummary.debtETB.toLocaleString(undefined, { maximumFractionDigits: 1 })} ETB
                    </p>
                  </div>
                </div>

                {/* Comprehensive Invoices Table with each day's exchange rate accurately listed */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead>
                      <tr className="border-b-2 border-slate-900 text-[11px] font-black uppercase text-slate-800 tracking-wider bg-slate-50">
                        <th className="py-2.5 px-2 text-left w-8">#</th>
                        <th className="py-2.5 px-2 text-left w-24">Taariikhda</th>
                        <th className="py-2.5 px-2 text-left w-24">Invoice ID</th>
                        <th className="py-2.5 px-2 text-left">Alaabta la Qaatay</th>
                        <th className="py-2.5 px-2 text-center w-28">Sarifkii Maalinkaas</th>
                        <th className="py-2.5 px-2 text-right w-28">🛍️ 1. Qaatay (Total)</th>
                        <th className="py-2.5 px-2 text-right w-28">➖ 💳 2. Laga Jaray (Bixiyay)</th>
                        <th className="py-2.5 px-2 text-right w-28">🟰 ⚠️ 3. Hadhay (Deyn)</th>
                        <th className="py-2.5 px-2 text-center w-20">Xaaladda</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 text-slate-800">
                      {filteredTx.map((tx, idx) => {
                        const txRate = tx.exchangeRate || currentGlobalRate || 1;
                        const totalTakenUSD = tx.total || 0;
                        const totalTakenETB = totalTakenUSD * txRate;
                        const pm = (tx.paymentMethod || '').toLowerCase();
                        const isPureDebt = pm === 'debt' || pm.includes('debt') || pm.includes('deyn') || tx.type === 'CASH_LOAN';
                        const isPartial = tx.paymentMethod === PaymentMethod.PARTIAL && (tx.paymentDetails?.debt || 0) > 0;

                        let debtUSD = 0;
                        if (isPureDebt) {
                          debtUSD = totalTakenUSD;
                        } else if (isPartial) {
                          debtUSD = tx.paymentDetails?.debt || 0;
                        }
                        const debtETB = debtUSD * txRate;
                        const paidUSD = Math.max(0, totalTakenUSD - debtUSD);
                        const paidETB = paidUSD * txRate;

                        return (
                          <tr 
                            key={tx.id} 
                            onClick={() => {
                              setSelectedTx(tx);
                              setCustomerViewMode('INVOICE');
                            }}
                            className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                            title="Guji si aad u furto warqaddan gaarka ah"
                          >
                            <td className="py-2.5 px-2 text-slate-400 font-mono text-[11px]">{idx + 1}</td>
                            <td className="py-2.5 px-2 font-mono text-slate-600 whitespace-nowrap">
                              {new Date(tx.timestamp).toLocaleDateString()}
                            </td>
                            <td className="py-2.5 px-2 font-black font-mono text-blue-700">
                              INV-{tx.id.slice(-5).toUpperCase()}
                            </td>
                            <td className="py-2.5 px-2">
                              <p className="font-bold text-slate-800 line-clamp-1">
                                {tx.items.map(i => `${i.quantity}x ${i.name}`).join(', ')}
                              </p>
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              <span className="font-black text-indigo-700 font-mono text-[11px] bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                                $1 = {txRate} ETB
                              </span>
                            </td>
                            <td className="py-2.5 px-2 text-right font-black font-mono text-blue-900">
                              <div>${totalTakenUSD.toFixed(2)}</div>
                              <div className="text-[10px] text-blue-600">{totalTakenETB.toLocaleString(undefined, { maximumFractionDigits: 0 })} ETB</div>
                            </td>
                            <td className="py-2.5 px-2 text-right font-black font-mono text-emerald-700">
                              <div>${paidUSD.toFixed(2)}</div>
                              <div className="text-[10px] text-emerald-600">{paidETB.toLocaleString(undefined, { maximumFractionDigits: 0 })} ETB</div>
                            </td>
                            <td className="py-2.5 px-2 text-right font-black font-mono text-rose-700">
                              <div>${debtUSD.toFixed(2)}</div>
                              <div className="text-[10px] text-rose-600">{debtETB.toLocaleString(undefined, { maximumFractionDigits: 0 })} ETB</div>
                            </td>
                            <td className="py-2.5 px-2 text-center">
                              {isPureDebt ? (
                                <span className="px-1.5 py-0.5 text-[9px] font-black bg-rose-100 text-rose-700 rounded">
                                  Deyn
                                </span>
                              ) : isPartial ? (
                                <span className="px-1.5 py-0.5 text-[9px] font-black bg-amber-100 text-amber-800 rounded">
                                  Qayb
                                </span>
                              ) : (
                                <span className="px-1.5 py-0.5 text-[9px] font-black bg-emerald-100 text-emerald-700 rounded">
                                  Bixiyay
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Grand Statement Totals Aggregation */}
                <div className="p-4 bg-slate-50 border-2 border-slate-900 rounded-2xl space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-3">
                    <div>
                      <span className="text-xs font-black text-slate-900 uppercase">
                        Xisaab-xidhka Isku-darka Sarifyadii Maalmaha:
                      </span>
                      <p className="text-[11px] text-slate-500 font-bold">
                        Biil kasta waxaa lagu dhuftay sarifkii maalinkaas go'naa
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] font-black text-indigo-700 uppercase block">Celceliska Sarifka</span>
                      <span className="text-sm font-black font-mono text-indigo-900 bg-indigo-100/70 px-2.5 py-1 rounded-lg border border-indigo-200">
                        $1 = {filteredSummary.averageRate.toFixed(2)} ETB
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-1">
                    <div className="bg-white p-3 rounded-xl border border-blue-200 shadow-2xs">
                      <span className="text-[10px] font-black text-blue-700 uppercase block">🛍️ 1. Wadarta uu Qaatay (Total Taken)</span>
                      <p className="text-base font-black text-blue-900 font-mono mt-0.5">
                        ${filteredSummary.totalUSD.toFixed(2)} USD
                      </p>
                      <p className="text-sm font-black text-blue-700 font-mono">
                        {filteredSummary.totalETB.toLocaleString(undefined, { maximumFractionDigits: 1 })} ETB
                      </p>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-emerald-200 shadow-2xs">
                      <span className="text-[10px] font-black text-emerald-700 uppercase block">➖ 💳 2. Laga Jaray (Wadarta Bixiyay)</span>
                      <p className="text-base font-black text-emerald-800 font-mono mt-0.5">
                        ${filteredSummary.paidUSD.toFixed(2)} USD
                      </p>
                      <p className="text-sm font-black text-emerald-600 font-mono">
                        {filteredSummary.paidETB.toLocaleString(undefined, { maximumFractionDigits: 1 })} ETB
                      </p>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-rose-200 bg-rose-50/40 shadow-2xs">
                      <span className="text-[10px] font-black text-rose-700 uppercase block">🟰 ⚠️ 3. Inta ku Harsan (Wadarta Deynta)</span>
                      <p className="text-base font-black text-rose-700 font-mono mt-0.5">
                        ${filteredSummary.debtUSD.toFixed(2)} USD
                      </p>
                      <p className="text-sm font-black text-rose-600 font-mono">
                        {filteredSummary.debtETB.toLocaleString(undefined, { maximumFractionDigits: 1 })} ETB
                      </p>
                    </div>
                  </div>
                </div>

                {/* Footer Accounts */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs space-y-1">
                  <p className="font-black text-slate-800">
                    💳 Akoonnada: E-Birr ({data.settings.onlinePaymentNumbers?.ebirr || '0901234567'}) • CBE ({data.settings.onlinePaymentNumbers?.commercialBank || '1000123456789'}) • Kaafi ({data.settings.onlinePaymentNumbers?.kaafi || '0631234567'})
                  </p>
                  <p className="text-slate-500 text-[11px]">
                    📢 Fadlan hubi xisaabtaada. Mahadsanid!
                  </p>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-slate-400 py-20 space-y-3">
              <div className="w-20 h-20 bg-slate-200/60 rounded-3xl flex items-center justify-center text-slate-300">
                <FileText size={40} />
              </div>
              <p className="font-black text-base text-slate-600 uppercase tracking-wide">
                Dooro Invoice ama Macmiil dhanka bidix si aad u aragto warqadda
              </p>
              <p className="text-xs text-slate-400 max-w-sm text-center">
                Waxaad ka arki doontaa alaabta uu qaatay, qiimaha maalintaas, sarifka la xisaabiyay, iyo xisaab-xidhka guud.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Hidden Print-Only View for browser printing (A4 Single-Page Paper Layout) */}
      <div className="print-only fixed inset-0 bg-white p-6 text-black">
        {selectedTx ? (() => {
          // SINGLE INVOICE PRINT
          const txRate = selectedTx.exchangeRate || currentGlobalRate || 1;
          const totalETB = selectedTx.total * txRate;
          const customerObj = getCustomerObj(selectedTx);
          const customerName = getCustomerName(selectedTx);
          const totalItemsCount = selectedTx.items.reduce((s, i) => s + (i.quantity || 1), 0);

          const pm = (selectedTx.paymentMethod || '').toLowerCase();
          const isPureDebt = pm === 'debt' || pm.includes('debt') || pm.includes('deyn') || selectedTx.type === 'CASH_LOAN';
          const isPartialDebt = selectedTx.paymentMethod === PaymentMethod.PARTIAL && (selectedTx.paymentDetails?.debt || 0) > 0;

          return (
            <div className="w-full max-w-[760px] mx-auto text-xs leading-tight font-sans">
              {/* Header */}
              <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-3">
                <div>
                  <h1 className="text-2xl font-black uppercase tracking-tight leading-none">{data.settings.businessName}</h1>
                  <p className="text-[10px] font-black uppercase tracking-wider text-gray-700 mt-1">
                    WARQADDA IIBKA / SALES & TAX INVOICE
                  </p>
                  {data.settings.storePhone && (
                    <p className="text-[9px] font-bold text-gray-600 mt-0.5">Tel: {data.settings.storePhone}</p>
                  )}
                </div>
                <div className="text-right space-y-0.5">
                  <span className="inline-block border-2 border-black px-2.5 py-0.5 font-mono font-black text-xs uppercase">
                    INV-{selectedTx.id.slice(-6).toUpperCase()}
                  </span>
                  <p className="text-[10px] font-mono text-gray-600">{new Date(selectedTx.timestamp).toLocaleString()}</p>
                  {selectedTx.pageNumber && (
                    <p className="text-[9px] font-black uppercase">Bog: {selectedTx.pageNumber}</p>
                  )}
                </div>
              </div>

              {/* Customer, Rate & Status Strip */}
              <div className="grid grid-cols-4 gap-2 border border-black p-2 mb-3 text-[11px]">
                <div>
                  <span className="text-[8px] font-black text-gray-500 uppercase block">Macaamiilka</span>
                  <p className="font-black text-black text-xs truncate">{customerName}</p>
                  {customerObj?.phone && <p className="text-[9px] text-gray-700">{customerObj.phone}</p>}
                </div>
                <div>
                  <span className="text-[8px] font-black text-gray-500 uppercase block">Bixinta (Payment)</span>
                  <p className="font-black uppercase">{selectedTx.paymentMethod}</p>
                </div>
                <div>
                  <span className="text-[8px] font-black text-gray-500 uppercase block">Sarifka Maalintii Iibka</span>
                  <p className="font-black text-black font-mono">$1 = {txRate} ETB</p>
                </div>
                <div className="text-right">
                  <span className="text-[8px] font-black text-gray-500 uppercase block">Xaaladda (Status)</span>
                  {isPureDebt ? (
                    <span className="text-[10px] font-black uppercase border border-black px-1.5 py-0.5 inline-block">
                      ❌ NOT PAID (DEYN)
                    </span>
                  ) : isPartialDebt ? (
                    <span className="text-[10px] font-black uppercase border border-black px-1.5 py-0.5 inline-block">
                      ⚠️ PARTIAL (Deyn: ${(selectedTx.paymentDetails?.debt || 0).toFixed(2)})
                    </span>
                  ) : (
                    <span className="text-[10px] font-black uppercase border border-black px-1.5 py-0.5 inline-block">
                      ✅ PAID (BIXIYAY)
                    </span>
                  )}
                </div>
              </div>

              {/* Items Taken Table */}
              <div className="mb-3">
                <div className="text-[10px] font-black uppercase tracking-wider mb-1">
                  Alaabta uu Macmiilku Qaatay ({selectedTx.items.length} nooc / {totalItemsCount} xabbo):
                </div>
                <table className="w-full border-collapse text-[11px]">
                  <thead>
                    <tr className="border-b-2 border-black font-black uppercase text-[9px] bg-gray-100">
                      <th className="text-left py-1.5 px-1 w-6">#</th>
                      <th className="text-left py-1.5 px-1">Alaabta (Description)</th>
                      <th className="text-center py-1.5 px-1 w-20">Tirada (Qty)</th>
                      <th className="text-right py-1.5 px-1 w-24">Qiimaha ($)</th>
                      <th className="text-right py-1.5 px-1 w-32">Wadarta ($ & ETB)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedTx.items.map((item, i) => (
                      <tr key={i} className="border-b border-gray-200">
                        <td className="py-1.5 px-1 text-gray-500">{i + 1}</td>
                        <td className="py-1.5 px-1 font-bold">
                          {item.name}
                          {item.sku && <span className="text-[8px] text-gray-500 ml-1">({item.sku})</span>}
                        </td>
                        <td className="text-center py-1.5 px-1 font-bold">{item.quantity} {item.unit || 'PCS'}</td>
                        <td className="text-right py-1.5 px-1 font-mono">${item.sellPrice.toFixed(2)}</td>
                        <td className="text-right py-1.5 px-1 font-black font-mono">
                          ${(item.sellPrice * item.quantity).toFixed(2)} / {((item.sellPrice * item.quantity) * txRate).toLocaleString(undefined, { maximumFractionDigits: 1 })} ETB
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              
              {/* Financial Summary */}
              <div className="flex justify-between items-start gap-4 mb-3">
                <div className="text-[9px] text-gray-600 space-y-0.5">
                  <p>• Daabacay: {selectedTx.cashierName || 'Admin'}</p>
                  <p>• Wadar Tirada Alaabta: {totalItemsCount} items</p>
                  <p>• Sarifka: $1 = {txRate} ETB</p>
                </div>

                <div className="w-72 text-right space-y-1 text-[11px]">
                  <div className="flex justify-between font-bold">
                    <span>Subtotal:</span>
                    <span className="font-mono">${selectedTx.subtotal.toFixed(2)}</span>
                  </div>
                  {selectedTx.discount && selectedTx.discount > 0 ? (
                    <div className="flex justify-between font-bold">
                      <span>Discount:</span>
                      <span className="font-mono">-${selectedTx.discount.toFixed(2)}</span>
                    </div>
                  ) : null}
                  {selectedTx.tax && selectedTx.tax > 0 ? (
                    <div className="flex justify-between font-bold">
                      <span>Tax (VAT):</span>
                      <span className="font-mono">${selectedTx.tax.toFixed(2)}</span>
                    </div>
                  ) : null}
                  <div className="border-t-2 border-black pt-1 space-y-0.5">
                    <div className="flex justify-between text-sm font-black">
                      <span>WADARTA (USD):</span>
                      <span className="font-mono">${selectedTx.total.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs font-black">
                      <span>WADARTA (ETB):</span>
                      <span className="font-mono">{totalETB.toLocaleString(undefined, { maximumFractionDigits: 1 })} ETB</span>
                    </div>
                  </div>
                  {isPureDebt && (
                    <div className="flex justify-between font-black text-xs border border-black p-1 mt-1 bg-gray-50">
                      <span>DEYNTA DHIMAN:</span>
                      <span className="font-mono">${selectedTx.total.toFixed(2)} ({totalETB.toLocaleString()} ETB)</span>
                    </div>
                  )}
                  {isPartialDebt && (
                    <div className="flex justify-between font-black text-xs border border-black p-1 mt-1 bg-gray-50">
                      <span>DEYNTA DHIMAN:</span>
                      <span className="font-mono">${(selectedTx.paymentDetails?.debt || 0).toFixed(2)} USD</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Payment Accounts & Debt Notice */}
              <div className="border border-black p-2 space-y-1 text-left text-[10px]">
                <p className="font-black uppercase tracking-wider">
                  Akoonnada Lacag Bixinta (Payment Accounts):
                </p>
                <div className="grid grid-cols-3 gap-1.5 border-t border-gray-300 pt-1 text-[10px]">
                  <div>
                    <span className="block text-[8px] text-gray-600 uppercase">1. E-Birr</span>
                    <strong className="font-mono font-black">{data.settings.onlinePaymentNumbers?.ebirr || '0901234567'}</strong>
                  </div>
                  <div>
                    <span className="block text-[8px] text-gray-600 uppercase">2. CBE Bank</span>
                    <strong className="font-mono font-black">{data.settings.onlinePaymentNumbers?.commercialBank || '1000123456789'}</strong>
                  </div>
                  <div>
                    <span className="block text-[8px] text-gray-600 uppercase">3. Kaafi / Zaad</span>
                    <strong className="font-mono font-black">{data.settings.onlinePaymentNumbers?.kaafi || data.settings.onlinePaymentNumbers?.golis || '0631234567'}</strong>
                  </div>
                </div>
                <div className="text-center font-black text-[10px] uppercase border-t border-gray-200 pt-1">
                  📢 Fadlan bixi lacagta deynta lagugu leeyahay adoo raali ah
                </div>
              </div>

              {/* Footer */}
              <div className="mt-3 text-center text-[8px] text-gray-500 uppercase tracking-widest">
                Waad ku mahadsan tahay ganacsigaaga! • {data.settings.businessName}
              </div>
            </div>
          );
        })() : activeSelectedCustomer ? (
          /* CUSTOMER STATEMENT PRINT-ONLY VIEW */
          <div className="w-full max-w-[760px] mx-auto text-xs leading-tight font-sans">
            {/* Header */}
            <div className="flex justify-between items-start border-b-2 border-black pb-3 mb-3">
              <div>
                <h1 className="text-2xl font-black uppercase tracking-tight leading-none">{data.settings.businessName}</h1>
                <p className="text-[10px] font-black uppercase tracking-wider text-gray-700 mt-1">
                  XISAAB-XIDHKA GUUD EE MACMIILKA & SARIFYADA MAALMAHA
                </p>
                {data.settings.storePhone && (
                  <p className="text-[9px] font-bold text-gray-600 mt-0.5">Tel: {data.settings.storePhone}</p>
                )}
              </div>
              <div className="text-right space-y-0.5">
                <span className="inline-block border-2 border-black px-2.5 py-0.5 font-mono font-black text-xs uppercase">
                  STATEMENT
                </span>
                <p className="text-[10px] font-mono text-gray-600">{new Date().toLocaleDateString()}</p>
              </div>
            </div>

            {/* Customer Strip */}
            <div className="grid grid-cols-3 gap-2 border border-black p-2 mb-3 text-[11px]">
              <div>
                <span className="text-[8px] font-black text-gray-500 uppercase block">Macaamiilka</span>
                <p className="font-black text-black text-xs truncate">{activeSelectedCustomer.name}</p>
                <p className="text-[9px] text-gray-700">{activeSelectedCustomer.phone}</p>
              </div>
              <div>
                <span className="text-[8px] font-black text-gray-500 uppercase block">Wadarta Biilasha</span>
                <p className="font-black">{filteredTx.length} Biilood</p>
              </div>
              <div className="text-right">
                <span className="text-[8px] font-black text-gray-500 uppercase block">Wadarta Deynta Hadhay</span>
                <p className="font-black text-black font-mono">${filteredSummary.debtUSD.toFixed(2)} USD</p>
                <p className="text-[9px] font-black font-mono">{filteredSummary.debtETB.toLocaleString()} ETB</p>
              </div>
            </div>

            {/* Invoices List with Day's Rates */}
            <div className="mb-3">
              <table className="w-full border-collapse text-[10px]">
                <thead>
                  <tr className="border-b-2 border-black font-black uppercase bg-gray-100">
                    <th className="text-left py-1 px-1 w-6">#</th>
                    <th className="text-left py-1 px-1 w-20">Taariikh</th>
                    <th className="text-left py-1 px-1 w-20">Invoice</th>
                    <th className="text-left py-1 px-1">Alaabta</th>
                    <th className="text-center py-1 px-1 w-20">Sarifkii</th>
                    <th className="text-right py-1 px-1 w-20">Qiimaha ($)</th>
                    <th className="text-right py-1 px-1 w-24">Qiimaha (ETB)</th>
                    <th className="text-center py-1 px-1 w-14">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTx.map((tx, i) => {
                    const txRate = tx.exchangeRate || currentGlobalRate || 1;
                    const totalETB = tx.total * txRate;
                    const pm = (tx.paymentMethod || '').toLowerCase();
                    const isPureDebt = pm === 'debt' || pm.includes('debt') || pm.includes('deyn') || tx.type === 'CASH_LOAN';

                    return (
                      <tr key={i} className="border-b border-gray-200">
                        <td className="py-1 px-1 text-gray-500">{i + 1}</td>
                        <td className="py-1 px-1 font-mono">{new Date(tx.timestamp).toLocaleDateString()}</td>
                        <td className="py-1 px-1 font-mono font-bold">INV-{tx.id.slice(-5).toUpperCase()}</td>
                        <td className="py-1 px-1 truncate max-w-[180px]">{tx.items.map(it => `${it.quantity}x ${it.name}`).join(', ')}</td>
                        <td className="text-center py-1 px-1 font-mono">${txRate}</td>
                        <td className="text-right py-1 px-1 font-mono font-bold">${tx.total.toFixed(2)}</td>
                        <td className="text-right py-1 px-1 font-mono font-bold">{totalETB.toLocaleString(undefined, { maximumFractionDigits: 1 })}</td>
                        <td className="text-center py-1 px-1 font-bold">{isPureDebt ? 'Deyn' : 'Bixiyay'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Totals Summary */}
            <div className="border border-black p-2 space-y-1 mb-3 text-[11px]">
              <div className="flex justify-between font-black">
                <span>WADARTA GUUD EE IIBKA:</span>
                <span className="font-mono">${filteredSummary.totalUSD.toFixed(2)} USD  /  {filteredSummary.totalETB.toLocaleString()} ETB</span>
              </div>
              <div className="flex justify-between font-bold text-gray-700">
                <span>WADARTA LA BIXIYAY:</span>
                <span className="font-mono">${filteredSummary.paidUSD.toFixed(2)} USD  /  {filteredSummary.paidETB.toLocaleString()} ETB</span>
              </div>
              <div className="flex justify-between font-black border-t border-black pt-1">
                <span>WADARTA DEYNTA HADHAY:</span>
                <span className="font-mono">${filteredSummary.debtUSD.toFixed(2)} USD  /  {filteredSummary.debtETB.toLocaleString()} ETB</span>
              </div>
              <div className="flex justify-between text-[10px] text-gray-600 pt-0.5">
                <span>CELCELISKA SARIFKA (EFFECTIVE RATE):</span>
                <span className="font-mono">$1 = {filteredSummary.averageRate.toFixed(2)} ETB</span>
              </div>
            </div>

            {/* Accounts */}
            <div className="border border-black p-1.5 text-[9px] text-center">
              E-Birr: {data.settings.onlinePaymentNumbers?.ebirr || '0901234567'} • CBE: {data.settings.onlinePaymentNumbers?.commercialBank || '1000123456789'} • Kaafi: {data.settings.onlinePaymentNumbers?.kaafi || '0631234567'}
            </div>
          </div>
        ) : null}
      </div>

      {/* Customer Product Return Modal */}
      <CustomerReturnModal
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        data={data}
        setData={setData}
        addLog={addLog}
        currency={currency}
        preselectedTxId={preselectedTxIdForReturn}
        onLoadItemsToPOS={onLoadItemsToPOS}
      />

      <ConfirmModal
        isOpen={showDeleteConfirmModal}
        title="Ma hubtaa? (Are you sure?)"
        message={`Ma hubtaa inaad tirtirto invoice #INV-${(selectedTx?.id || '').slice(-5).toUpperCase()}? Financials iyo stock-gu waa dib loo celin doonaa.`}
        confirmText="Haa (Tirtir)"
        cancelText="Maya (Kansal)"
        onConfirm={() => {
          executeDeleteInvoice();
          setShowDeleteConfirmModal(false);
        }}
        onClose={() => setShowDeleteConfirmModal(false)}
      />
    </div>
  );
};

export default Invoices;
