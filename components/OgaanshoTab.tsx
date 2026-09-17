import React, { useState, useMemo } from 'react';
import { AppData, Currency, CartItem } from '../types';
import { formatCurrency } from '../lib/utils';
import { 
  Sparkles, 
  HelpCircle, 
  ShoppingCart, 
  TrendingUp, 
  Layers, 
  Users, 
  Calendar, 
  ArrowUpRight, 
  ArrowDownRight,
  PieChart as PieChartIcon, 
  BarChart3,
  FileText, 
  Coins, 
  Percent, 
  ShieldCheck, 
  Search, 
  Download, 
  CheckCircle2, 
  Wallet, 
  CreditCard, 
  Smartphone, 
  AlertCircle,
  Landmark,
  Building2,
  DollarSign,
  PackageCheck,
  Package,
  Receipt,
  MinusCircle,
  PlusCircle,
  Printer,
  ChevronRight,
  Calculator,
  ArrowRight,
  TrendingDown,
  Info,
  Tag,
  Store,
  ShoppingBag,
  UserCheck,
  History,
  ListOrdered
} from 'lucide-react';
import { 
  ResponsiveContainer, 
  PieChart, 
  Pie, 
  Cell, 
  Tooltip, 
  Legend, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid 
} from 'recharts';

interface Props {
  data: AppData;
  currency: Currency;
  setActiveTab?: (tab: any) => void;
}

export type TimeFilter = 'TODAY' | 'YESTERDAY' | 'WEEK' | 'MONTH' | 'YEAR' | 'ALL' | 'CUSTOM';
export type SourceFilter = 'ALL' | 'REGULAR' | 'ICECREAM' | 'DEBT' | 'DEBT_REPAY';
export type SubTab = 'SUMMARY' | 'VALUATION' | 'ORIGIN' | 'CATEGORIES' | 'CUSTOMERS' | 'ITEMIZED';

export const OgaanshoTab: React.FC<Props> = ({ data, currency, setActiveTab }) => {
  const rate = data.settings.exchangeRate || 190;
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('ALL');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('SUMMARY');
  const [sourceFilter, setSourceFilter] = useState<SourceFilter>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [valuationSearch, setValuationSearch] = useState<string>('');
  const [customerSubFilter, setCustomerSubFilter] = useState<'ALL' | 'DEBTORS' | 'CASH'>('ALL');
  const [selectedDebtor, setSelectedDebtor] = useState<string | null>(null);

  // 1. Time boundaries
  const { startTime, endTime, filterLabel } = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayStart = today.getTime();

    switch (timeFilter) {
      case 'TODAY':
        return { 
          startTime: todayStart, 
          endTime: Date.now() + 86400000, 
          filterLabel: 'Maanta (Today)' 
        };
      case 'YESTERDAY': {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yStart = yesterday.getTime();
        const yEnd = todayStart - 1;
        return { 
          startTime: yStart, 
          endTime: yEnd, 
          filterLabel: 'Shalay (Yesterday)' 
        };
      }
      case 'WEEK': {
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return { 
          startTime: weekAgo.getTime(), 
          endTime: Date.now() + 86400000, 
          filterLabel: 'Toddobaadkan (Past 7 Days)' 
        };
      }
      case 'MONTH': {
        const monthAgo = new Date(today);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return { 
          startTime: monthAgo.getTime(), 
          endTime: Date.now() + 86400000, 
          filterLabel: 'Bishan (Past 30 Days)' 
        };
      }
      case 'YEAR': {
        const yearStart = new Date(today.getFullYear(), 0, 1).getTime();
        return { 
          startTime: yearStart, 
          endTime: Date.now() + 86400000, 
          filterLabel: 'Sanadkan (This Year)' 
        };
      }
      case 'CUSTOM': {
        const s = customStartDate ? new Date(customStartDate).setHours(0, 0, 0, 0) : 0;
        const e = customEndDate ? new Date(customEndDate).setHours(23, 59, 59, 999) : Date.now() + 86400000;
        return { 
          startTime: s, 
          endTime: e, 
          filterLabel: 'Taariikh Gaar ah (Custom Range)' 
        };
      }
      case 'ALL':
      default:
        return { 
          startTime: 0, 
          endTime: Date.now() + 86400000, 
          filterLabel: 'Wadarta Guud (All Time)' 
        };
    }
  }, [timeFilter, customStartDate, customEndDate]);

  // Currency helper
  const fmt = (amount: number) => formatCurrency(amount, currency, rate);

  // 2. Flatten all transactions into sold items
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
      sourceType: 'REGULAR' | 'ICECREAM' | 'DEBT' | 'DEBT_REPAY';
      sourceLabel: string;
      isDebt?: boolean;
    }> = [];

    (data.transactions || []).forEach(tx => {
      const isDebtPayment = tx.type === 'DEBT_PAYMENT';
      const isSupplierPayment = tx.type === 'EXPENSE' || !!tx.supplierId || tx.items?.some(i => i.sku === 'SUPPLIER_PAYMENT') || tx.notes?.toLowerCase().includes('supplier');
      const isExpense = tx.type === 'EXPENSE' && !isSupplierPayment;
      const txDiscount = tx.discount || 0;

      let customerName = tx.customerName || 'Walk-in Customer';
      if (tx.customerId) {
        const found = (data.customers || []).find(c => c.id === tx.customerId);
        if (found) {
          customerName = found.name;
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
            category: isSupplierPayment ? 'Supplier Payment' : (isDebtPayment ? 'Debt Settlement' : 'Expense'),
            costPrice: isDebtPayment ? 0 : tx.total,
            sellPrice: isDebtPayment ? tx.total : 0,
            stock: 0,
            quantity: 1,
            unit: 'PCS'
          }
        ];
      }

      const totalItemsGross = itemsToProcess.reduce((sum, item) => sum + (item.sellPrice * item.quantity), 0);
      const totalUnits = itemsToProcess.reduce((sum, item) => sum + item.quantity, 0);

      itemsToProcess.forEach((item, itemIdx) => {
        let liveProduct = (data.products || []).find(p => p.id === item.id || (p.barcode && p.barcode === item.barcode));
        const unitCost = liveProduct ? liveProduct.costPrice : (item.costPrice || 0);
        const unitSell = item.sellPrice;

        let unitDiscount = 0;
        if (txDiscount > 0) {
          if (totalItemsGross > 0) {
            const itemGross = unitSell * item.quantity;
            const itemDiscountTotal = (itemGross / totalItemsGross) * txDiscount;
            unitDiscount = item.quantity > 0 ? itemDiscountTotal / item.quantity : 0;
          } else if (totalUnits > 0) {
            unitDiscount = txDiscount / totalUnits;
          }
        }

        const finalUnitSell = Math.max(0, unitSell - unitDiscount);
        const unitProfit = finalUnitSell - unitCost;
        const totalCost = unitCost * item.quantity;
        const totalSell = finalUnitSell * item.quantity;
        const totalProfit = unitProfit * item.quantity;

        const itemNameLower = (item.name || '').toLowerCase();
        const catLower = (item.category || '').toLowerCase();

        // STRICT ISOLATION: Exclude Khudaar from General/Ogaansho calculations entirely
        if (
          catLower.includes('khudaar') || 
          catLower.includes('vegetable') || 
          catLower.includes('fruit') || 
          catLower.includes('miro') ||
          itemNameLower.includes('khudaar') ||
          item.unit === 'KG'
        ) {
          return; // Strictly restricted to Khudaar tab only
        }

        // Categorize source
        let sourceType: 'REGULAR' | 'ICECREAM' | 'DEBT' | 'DEBT_REPAY' = 'REGULAR';
        let sourceLabel = 'Iibka Caadiga ah (Store)';

        const isTxDebt = tx.paymentMethod === 'Debt' || (tx.paymentDetails && (tx.paymentDetails.debt || 0) > 0);

        if (isDebtPayment || item.sku === 'DEBT_PAYMENT' || tx.type === 'DEBT_PAYMENT') {
          sourceType = 'DEBT_REPAY';
          sourceLabel = 'Deymihii Hore La Soo Bixiyay';
        } else if (isTxDebt) {
          sourceType = 'DEBT';
          sourceLabel = `Iibka Deynta (${customerName})`;
        } else if (
          catLower.includes('ice cream') || 
          catLower.includes('icecream') || 
          itemNameLower.includes('ice cream') || 
          itemNameLower.includes('scoop') || 
          itemNameLower.includes('cone')
        ) {
          sourceType = 'ICECREAM';
          sourceLabel = 'Iibka Ice Cream-ka';
        }

        list.push({
          id: `${tx.id}-${itemIdx}-${item.id}`,
          txId: tx.id,
          pageNumber: tx.pageNumber,
          timestamp: tx.timestamp,
          customerName,
          paymentMethod: tx.paymentMethod || 'Cash',
          accountId: tx.accountId,
          customerId: tx.customerId,
          item,
          unitCost,
          unitSell,
          unitDiscount,
          finalUnitSell,
          unitProfit,
          totalCost,
          totalSell,
          totalProfit,
          txType: tx.type,
          notes: tx.notes,
          sourceType,
          sourceLabel,
          isDebt: isTxDebt
        });
      });
    });

    return list;
  }, [data.transactions, data.products, data.customers]);

  // Filter sold items by time
  const filteredSoldItems = useMemo(() => {
    return soldItems.filter(item => item.timestamp >= startTime && item.timestamp <= endTime);
  }, [soldItems, startTime, endTime]);

  // 3. Complete Comprehensive Operational & Financial Metrics
  const metrics = useMemo(() => {
    let grandTotalSales = 0;
    let grandTotalCost = 0;
    let grandTotalProfit = 0;
    let grandTotalQty = 0;
    let grandTotalDiscounts = 0;

    let regularSalesTotal = 0;
    let regularCostTotal = 0;
    let regularProfit = 0;
    let regularQty = 0;
    let regularCount = 0;

    let iceCreamSalesTotal = 0;
    let iceCreamCostTotal = 0;
    let iceCreamProfit = 0;
    let iceCreamQty = 0;
    let iceCreamCount = 0;

    let debtSalesTotal = 0;
    let debtCostTotal = 0;
    let debtProfit = 0;
    let debtQty = 0;
    let debtCount = 0;

    let debtRepaymentTotal = 0;
    let debtRepaymentCount = 0;

    let cashInflow = 0;
    let bankInflow = 0;
    let mobileInflow = 0;
    let uncollectedDebt = 0;

    const uniqueSalesTxIds = new Set<string>();
    const categoryMap = new Map<string, { category: string; count: number; qty: number; cost: number; revenue: number; profit: number }>();
    const customerMap = new Map<string, { name: string; count: number; revenue: number; profit: number; isDebt: boolean }>();
    const debtorMap = new Map<string, { 
      name: string; 
      customerId?: string; 
      count: number; 
      totalDebt: number; 
      cost: number; 
      profit: number; 
      qty: number; 
      items: Set<string>; 
      remainingDebtBalance: number;
      lastTimestamp: number;
    }>();

    filteredSoldItems.forEach(entry => {
      // Skip supplier payments & expenses from sales totals
      if (entry.item.sku === 'SUPPLIER_PAYMENT' || entry.item.sku === 'EXPENSE') {
        return;
      }

      if (entry.sourceType === 'DEBT_REPAY') {
        debtRepaymentTotal += entry.totalSell;
        debtRepaymentCount += 1;
        cashInflow += entry.totalSell;
        return;
      }

      uniqueSalesTxIds.add(entry.txId);
      grandTotalSales += entry.totalSell;
      grandTotalCost += entry.totalCost;
      grandTotalProfit += entry.totalProfit;
      grandTotalQty += entry.item.quantity;
      grandTotalDiscounts += (entry.unitDiscount * entry.item.quantity);

      // Origin breakdowns
      if (entry.sourceType === 'REGULAR') {
        regularCount += 1;
        regularSalesTotal += entry.totalSell;
        regularCostTotal += entry.totalCost;
        regularProfit += entry.totalProfit;
        regularQty += entry.item.quantity;
      } else if (entry.sourceType === 'ICECREAM') {
        iceCreamCount += 1;
        iceCreamSalesTotal += entry.totalSell;
        iceCreamCostTotal += entry.totalCost;
        iceCreamProfit += entry.totalProfit;
        iceCreamQty += entry.item.quantity;
      } else if (entry.sourceType === 'DEBT' || (entry as any).isDebt) {
        debtCount += 1;
        debtSalesTotal += entry.totalSell;
        debtCostTotal += entry.totalCost;
        debtProfit += entry.totalProfit;
        debtQty += entry.item.quantity;
        uncollectedDebt += entry.totalSell;

        // Group debtor details specifically (e.g. Deynta Cajaaib, Deynta Macmiil X)
        const debtorName = entry.customerName || 'Macmiil aan la magacaabin';
        const liveCust = (data.customers || []).find(c => c.id === entry.customerId || c.name?.toLowerCase() === debtorName.toLowerCase());
        const existingDebtor = debtorMap.get(debtorName) || {
          name: debtorName,
          customerId: entry.customerId || liveCust?.id,
          count: 0,
          totalDebt: 0,
          cost: 0,
          profit: 0,
          qty: 0,
          items: new Set<string>(),
          remainingDebtBalance: liveCust?.debtBalance || 0,
          lastTimestamp: entry.timestamp
        };

        existingDebtor.count += 1;
        existingDebtor.totalDebt += entry.totalSell;
        existingDebtor.cost += entry.totalCost;
        existingDebtor.profit += entry.totalProfit;
        existingDebtor.qty += entry.item.quantity;
        if (entry.item.name) existingDebtor.items.add(entry.item.name);
        if (entry.timestamp > existingDebtor.lastTimestamp) existingDebtor.lastTimestamp = entry.timestamp;
        debtorMap.set(debtorName, existingDebtor);
      }

      // Payment inflow tracking
      const pm = (entry.paymentMethod || '').toLowerCase();
      if (pm.includes('debt') || entry.sourceType === 'DEBT' || (entry as any).isDebt) {
        // already in uncollected debt
      } else if (pm.includes('bank') || pm.includes('cbe') || pm.includes('salaam') || pm.includes('dahab')) {
        bankInflow += entry.totalSell;
      } else if (pm.includes('mobile') || pm.includes('zaad') || pm.includes('sahal') || pm.includes('evc') || pm.includes('edahab') || pm.includes('telebirr')) {
        mobileInflow += entry.totalSell;
      } else {
        cashInflow += entry.totalSell;
      }

      // Categories map
      const cat = entry.item.category || 'Aan La Qeexin (General)';
      const existingCat = categoryMap.get(cat) || { category: cat, count: 0, qty: 0, cost: 0, revenue: 0, profit: 0 };
      existingCat.count += 1;
      existingCat.qty += entry.item.quantity;
      existingCat.cost += entry.totalCost;
      existingCat.revenue += entry.totalSell;
      existingCat.profit += entry.totalProfit;
      categoryMap.set(cat, existingCat);

      // Customer map
      const cust = entry.customerName;
      const existingCust = customerMap.get(cust) || { name: cust, count: 0, revenue: 0, profit: 0, isDebt: entry.sourceType === 'DEBT' || (entry as any).isDebt };
      existingCust.count += 1;
      existingCust.revenue += entry.totalSell;
      existingCust.profit += entry.totalProfit;
      if (entry.sourceType === 'DEBT' || (entry as any).isDebt) existingCust.isDebt = true;
      customerMap.set(cust, existingCust);
    });

    // Purchases in period
    const purchasesInPeriod = (data.transactions || []).filter(tx => {
      if (tx.timestamp < startTime || tx.timestamp > endTime) return false;
      return tx.type === 'PURCHASE' || tx.supplierId || tx.items?.some(i => i.sku === 'SUPPLIER_PURCHASE' || i.sku === 'PURCHASE') || tx.notes?.toLowerCase().includes('purchase');
    });
    const purchasesTotal = purchasesInPeriod.reduce((sum, tx) => sum + (tx.total || 0), 0);
    const purchasesCount = purchasesInPeriod.length;

    // Operating expenses in period (General + Transactions) - Khudaar expenses stay in Khudaar Tab
    const generalExpenses = (data.expenses || []).filter(e => {
      const t = e.timestamp;
      return t >= startTime && t <= endTime;
    }).reduce((sum, e) => sum + (e.amount || 0), 0);

    const txExpenses = (data.transactions || []).filter(tx => {
      if (tx.timestamp < startTime || tx.timestamp > endTime) return false;
      return tx.type === 'EXPENSE' && !tx.supplierId && !tx.items?.some(i => i.sku === 'SUPPLIER_PAYMENT');
    }).reduce((sum, tx) => sum + (tx.total || 0), 0);

    const totalExpenses = generalExpenses + txExpenses;
    const netProfit = grandTotalProfit - totalExpenses;
    const grossMarginPct = grandTotalSales > 0 ? (grandTotalProfit / grandTotalSales) * 100 : 0;
    const markupPct = grandTotalCost > 0 ? (grandTotalProfit / grandTotalCost) * 100 : 0;
    const netMarginPct = grandTotalSales > 0 ? (netProfit / grandTotalSales) * 100 : 0;

    const totalCollectedInflow = cashInflow + bankInflow + mobileInflow;

    // Percentages
    const regularPct = grandTotalSales > 0 ? (regularSalesTotal / grandTotalSales) * 100 : 0;
    const iceCreamPct = grandTotalSales > 0 ? (iceCreamSalesTotal / grandTotalSales) * 100 : 0;
    const debtPct = grandTotalSales > 0 ? (debtSalesTotal / grandTotalSales) * 100 : 0;

    // Origin Pie Data
    const originPieData = [
      { name: 'Supermarket', value: Math.max(0, regularSalesTotal), color: '#3b82f6' },
      { name: 'Ice Cream', value: Math.max(0, iceCreamSalesTotal), color: '#ec4899' },
      { name: 'Iibka Deynta', value: Math.max(0, debtSalesTotal), color: '#f59e0b' }
    ].filter(item => item.value > 0);

    // Channel Bar Data
    const channelPieData = [
      { name: 'Caddaan (Cash)', value: cashInflow, color: '#10b981' },
      { name: 'Bangiyada (Bank)', value: bankInflow, color: '#3b82f6' },
      { name: 'Mobile Money', value: mobileInflow, color: '#8b5cf6' },
      { name: 'Deynta (Credit)', value: uncollectedDebt, color: '#f59e0b' }
    ];

    const categoryList = Array.from(categoryMap.values()).sort((a, b) => b.revenue - a.revenue);
    const customerList = Array.from(customerMap.values()).sort((a, b) => b.revenue - a.revenue);

    return {
      salesTxCount: uniqueSalesTxIds.size,
      grandTotalSales,
      grandTotalCost,
      grandTotalProfit,
      grandTotalQty: Math.round(grandTotalQty * 100) / 100,
      grandTotalDiscounts,
      purchasesTotal,
      purchasesCount,
      totalExpenses,
      generalExpenses,
      txExpenses,
      netProfit,
      grossMarginPct,
      markupPct,
      netMarginPct,
      regularSalesTotal,
      regularCostTotal,
      regularProfit,
      regularQty: Math.round(regularQty * 100) / 100,
      regularPct,
      regularCount,
      iceCreamSalesTotal,
      iceCreamCostTotal,
      iceCreamProfit,
      iceCreamQty: Math.round(iceCreamQty * 100) / 100,
      iceCreamPct,
      iceCreamCount,
      debtSalesTotal,
      debtCostTotal,
      debtProfit,
      debtQty: Math.round(debtQty * 100) / 100,
      debtPct,
      debtCount,
      debtRepaymentTotal,
      debtRepaymentCount,
      cashInflow,
      bankInflow,
      mobileInflow,
      totalCollectedInflow,
      uncollectedDebt,
      originPieData,
      channelPieData,
      categoryList,
      customerList,
      debtorList: Array.from(debtorMap.values()).map(d => ({ ...d, items: Array.from(d.items) })).sort((a, b) => b.totalDebt - a.totalDebt)
    };
  }, [filteredSoldItems, data.transactions, data.expenses, startTime, endTime]);

  // 4. Live Store Inventory Valuation & Future Profit (Hantida Hadda Dukaanka Taala)
  const storeValuation = useMemo(() => {
    let totalStockCost = 0;
    let totalStockRetail = 0;
    let totalStockProfit = 0;
    let totalStockUnits = 0;
    let lowStockCount = 0;
    let outOfStockCount = 0;

    const productValuationList = (data.products || [])
      .filter(p => {
        const cat = (p.category || '').toLowerCase();
        const name = (p.name || '').toLowerCase();
        return !(
          cat.includes('khudaar') || 
          cat.includes('vegetable') || 
          cat.includes('fruit') || 
          cat.includes('miro') ||
          name.includes('khudaar') ||
          p.unit === 'KG'
        );
      })
      .map(p => {
      const stock = Math.max(0, p.stock || 0);
      const cost = p.costPrice || 0;
      const sell = p.sellPrice || 0;
      const stockCostVal = stock * cost;
      const stockRetailVal = stock * sell;
      const stockProfitVal = stock * (sell - cost);
      const unitMargin = sell > 0 ? ((sell - cost) / sell) * 100 : 0;
      const unitMarkup = cost > 0 ? ((sell - cost) / cost) * 100 : 0;

      totalStockCost += stockCostVal;
      totalStockRetail += stockRetailVal;
      totalStockProfit += stockProfitVal;
      totalStockUnits += stock;

      if (stock === 0) outOfStockCount++;
      else if (stock <= (p.minStock || 5)) lowStockCount++;

      return {
        id: p.id,
        name: p.name,
        category: p.category || 'General',
        sku: p.sku || '',
        barcode: p.barcode || '',
        unit: p.unit || 'pcs',
        stock,
        cost,
        sell,
        stockCostVal,
        stockRetailVal,
        stockProfitVal,
        unitMargin,
        unitMarkup
      };
    });

    const totalCustomerDebt = (data.customers || []).reduce((sum, c) => sum + Math.max(0, c.debtBalance || 0), 0);
    const totalSupplierDebt = (data.suppliers || []).reduce((sum, s) => sum + Math.max(0, s.balance || 0), 0);
    const totalAccountBalances = (data.accounts || []).reduce((sum, a) => sum + (a.balance || 0), 0);
    const netBusinessEquity = totalStockCost + totalAccountBalances + totalCustomerDebt - totalSupplierDebt;
    const overallStockMarkupPct = totalStockCost > 0 ? (totalStockProfit / totalStockCost) * 100 : 0;

    return {
      totalStockCost,
      totalStockRetail,
      totalStockProfit,
      totalStockUnits: Math.round(totalStockUnits * 100) / 100,
      productCount: data.products.length,
      lowStockCount,
      outOfStockCount,
      totalCustomerDebt,
      totalSupplierDebt,
      totalAccountBalances,
      netBusinessEquity,
      overallStockMarkupPct,
      productValuationList: productValuationList.sort((a, b) => b.stockProfitVal - a.stockProfitVal)
    };
  }, [data.products, data.customers, data.suppliers, data.accounts]);

  // Filtered Itemized List for Audit Ledger
  const itemizedList = useMemo(() => {
    return filteredSoldItems.filter(entry => {
      if (sourceFilter !== 'ALL' && entry.sourceType !== sourceFilter) return false;
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        const matchName = entry.item.name.toLowerCase().includes(term);
        const matchCustomer = entry.customerName.toLowerCase().includes(term);
        const matchTx = entry.txId.toLowerCase().includes(term);
        const matchCat = (entry.item.category || '').toLowerCase().includes(term);
        const matchBarcode = (entry.item.barcode || '').toLowerCase().includes(term);
        if (!matchName && !matchCustomer && !matchTx && !matchCat && !matchBarcode) return false;
      }
      return true;
    });
  }, [filteredSoldItems, sourceFilter, searchTerm]);

  // Filtered Valuation List
  const filteredValuationList = useMemo(() => {
    if (!valuationSearch) return storeValuation.productValuationList;
    const term = valuationSearch.toLowerCase();
    return storeValuation.productValuationList.filter(p => 
      p.name.toLowerCase().includes(term) ||
      p.category.toLowerCase().includes(term) ||
      p.sku.toLowerCase().includes(term) ||
      p.barcode.toLowerCase().includes(term)
    );
  }, [storeValuation.productValuationList, valuationSearch]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    const headers = ['TxID', 'Taariikh', 'Macmiil', 'Alaabta', 'Qaybta', 'Isha', 'Tirada', 'Qiimaha Iibka', 'Wadarta Iibka', 'Cost', 'Faa\'iido', 'Habka Bixinta'];
    const rows = itemizedList.map(e => [
      e.txId,
      new Date(e.timestamp).toLocaleString(),
      `"${e.customerName.replace(/"/g, '""')}"`,
      `"${e.item.name.replace(/"/g, '""')}"`,
      `"${(e.item.category || '').replace(/"/g, '""')}"`,
      `"${e.sourceLabel.replace(/"/g, '""')}"`,
      e.item.quantity,
      e.finalUnitSell.toFixed(2),
      e.totalSell.toFixed(2),
      e.totalCost.toFixed(2),
      e.totalProfit.toFixed(2),
      e.paymentMethod
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Xogta_Kooban_Executive_Summary_${timeFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="p-3 md:p-6 lg:p-8 space-y-6 max-w-7xl mx-auto font-sans">
      
      {/* 1. Header & Quick Actions Bar */}
      <div className="bg-white rounded-[32px] p-5 md:p-6 shadow-xs border border-slate-200/80 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 via-blue-600 to-cyan-500 flex items-center justify-center text-white shadow-lg shadow-indigo-500/20 shrink-0">
            <Coins size={28} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl md:text-2xl font-black text-slate-900 tracking-tight uppercase">
                Xogta Kooban & Qiimaynta Ganacsiga
              </h1>
              <span className="px-3 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black uppercase rounded-full tracking-wider border border-emerald-200">
                100% Live & Reconciled
              </span>
            </div>
            <p className="text-xs font-semibold text-slate-500 mt-0.5">
              Xisaabinta iibka, soo iibsiga, faa'iidada, kharashyada, deynta, qiimaha stock-ga & hantida dukaanka taala.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 w-full lg:w-auto justify-end">
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer"
            title="Daabac Warbixinta (Print)"
          >
            <Printer size={15} /> Daabac
          </button>
          <button
            onClick={handleExportCSV}
            className="px-3.5 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-bold rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer border border-indigo-200/60"
            title="Soo Dejiso Excel / CSV"
          >
            <Download size={15} /> CSV
          </button>
        </div>
      </div>

      {/* 2. DATE FILTER SWITCHER (Maanta, Shalay, Week, Month, Year, Custom, All Time) */}
      <div className="bg-white rounded-[24px] p-3 border border-slate-200 shadow-xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-xs font-black text-slate-700 px-2 shrink-0">
          <Calendar size={16} className="text-indigo-600" />
          <span>Mudada Xogta (Time Period):</span>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 bg-slate-100 p-1 rounded-2xl border border-slate-200/80">
          {[
            { key: 'TODAY', label: 'Maanta (Today)' },
            { key: 'YESTERDAY', label: 'Shalay' },
            { key: 'WEEK', label: '7 Maalmood' },
            { key: 'MONTH', label: 'Bishan' },
            { key: 'YEAR', label: 'Sanadkan (Year)' },
            { key: 'CUSTOM', label: 'Taariikh Gaar ah' },
            { key: 'ALL', label: 'Dhammaan (All Time)' }
          ].map(btn => (
            <button
              key={btn.key}
              onClick={() => setTimeFilter(btn.key as TimeFilter)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                timeFilter === btn.key 
                  ? 'bg-indigo-600 text-white shadow-xs' 
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/70'
              }`}
            >
              {btn.label}
            </button>
          ))}
        </div>
      </div>

      {/* Custom Date Range Picker */}
      {timeFilter === 'CUSTOM' && (
        <div className="bg-indigo-50/80 border border-indigo-200 rounded-2xl p-4 flex flex-wrap items-center gap-4 animate-in fade-in">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
            <Calendar size={16} /> Bilowga (Start Date):
            <input 
              type="date" 
              value={customStartDate} 
              onChange={e => setCustomStartDate(e.target.value)} 
              className="bg-white border border-indigo-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
            <Calendar size={16} /> Dhamaadka (End Date):
            <input 
              type="date" 
              value={customEndDate} 
              onChange={e => setCustomEndDate(e.target.value)} 
              className="bg-white border border-indigo-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:ring-2 focus:ring-indigo-500 outline-none"
            />
          </div>
          <div className="text-xs font-bold text-indigo-700 bg-white px-3 py-1.5 rounded-lg border border-indigo-200">
            Muddada: {customStartDate || '...'} ilaa {customEndDate || 'Hadda'}
          </div>
        </div>
      )}

      {/* 3. HERO BANNER: LIVE STORE VALUATION & CURRENT INVENTORY PROFIT POTENTIAL */}
      <div className="bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 text-white rounded-[32px] p-6 md:p-8 shadow-xl border border-indigo-500/30 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 space-y-6">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 pb-6 border-b border-white/10">
            <div>
              <div className="flex items-center gap-2 text-indigo-300 font-black text-xs uppercase tracking-widest">
                <PackageCheck size={18} /> Hantida Hadda Dukaanka Taala & Faa'iidada Ku Jirta
              </div>
              <div className="text-2xl md:text-4xl font-black tracking-tight text-white mt-1.5">
                Qiimaha Stock-ga: <span className="text-amber-300">{fmt(storeValuation.totalStockCost)}</span>
              </div>
              <p className="text-xs text-slate-300 font-semibold mt-1">
                Dukaanka waxaa hadda yaal <span className="text-white font-bold">{storeValuation.productCount} nooc</span> oo alaab ah (<span className="text-white font-bold">{storeValuation.totalStockUnits} xabo/KG</span>).
              </p>
            </div>

            {/* Live Stock Future Revenue & Profit */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/10">
                <span className="text-[10px] uppercase font-bold text-slate-400 block">Marka La Iibiyo Dhammaan (Retail Value)</span>
                <div className="text-lg md:text-xl font-black text-blue-300 mt-0.5">{fmt(storeValuation.totalStockRetail)}</div>
                <span className="text-[10px] text-slate-400">Lacagta guud ee ka soo geli doonta</span>
              </div>

              <div className="bg-emerald-500/20 backdrop-blur-md rounded-2xl p-4 border border-emerald-500/30">
                <span className="text-[10px] uppercase font-bold text-emerald-300 block">Faa'iidada Kuugu Xiran Stock-ga</span>
                <div className="text-lg md:text-xl font-black text-emerald-400 mt-0.5">+{fmt(storeValuation.totalStockProfit)}</div>
                <span className="text-[10px] text-emerald-300/80 font-bold">Markup: +{storeValuation.overallStockMarkupPct.toFixed(1)}% Faa'iido</span>
              </div>
            </div>
          </div>

          {/* Quick Balance & Net Business Equity Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
              <span className="text-[10px] font-bold text-slate-400 block uppercase">Lacagta Qasnadda & Bangiyada</span>
              <span className="text-sm md:text-base font-black text-white">{fmt(storeValuation.totalAccountBalances)}</span>
            </div>
            <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
              <span className="text-[10px] font-bold text-amber-300 block uppercase">Deynta Dibadda Kaa Maqan</span>
              <span className="text-sm md:text-base font-black text-amber-300">{fmt(storeValuation.totalCustomerDebt)}</span>
            </div>
            <div className="bg-white/5 rounded-2xl p-3 border border-white/10">
              <span className="text-[10px] font-bold text-rose-300 block uppercase">Deynta Lagugu Leeyahay (Suppliers)</span>
              <span className="text-sm md:text-base font-black text-rose-300">{fmt(storeValuation.totalSupplierDebt)}</span>
            </div>
            <div className="bg-emerald-500/10 rounded-2xl p-3 border border-emerald-500/20">
              <span className="text-[10px] font-bold text-emerald-300 block uppercase">Hantida Saafiga (Net Worth)</span>
              <span className="text-sm md:text-base font-black text-emerald-400">{fmt(storeValuation.netBusinessEquity)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* 4. SUB-NAVIGATION TABS */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-3">
        {[
          { key: 'SUMMARY', label: '1. Xogta Kooban (Executive Summary)', icon: FileText },
          { key: 'VALUATION', label: '2. Qiimaynta Stock-ga (Store Valuation)', icon: PackageCheck },
          { key: 'ORIGIN', label: '3. Dhaqdhaqaaqa Qaybaha (Origin Breakdown)', icon: PieChartIcon },
          { key: 'CATEGORIES', label: '4. Qaybaha Alaabta (Categories)', icon: Layers },
          { key: 'CUSTOMERS', label: '5. Macaamiisha & Deynta (Customers)', icon: Users },
          { key: 'ITEMIZED', label: '6. Liiska Dhaqdhaqaaqa (Itemized Log)', icon: Receipt }
        ].map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setActiveSubTab(t.key as SubTab)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-black transition-all cursor-pointer ${
                activeSubTab === t.key
                  ? 'bg-slate-900 text-white shadow-md'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'
              }`}
            >
              <Icon size={16} />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* VIEW 1: EXECUTIVE SUMMARY FOR SELECTED PERIOD */}
      {/* ========================================================================= */}
      {activeSubTab === 'SUMMARY' && (
        <div className="space-y-6">

          {/* ========================================================================= */}
          {/* 🌟 1. PRIMARY REVENUE ORIGINS & WHERE SALES CAME FROM (HALKA UU IIBKU KA YIMID) */}
          {/* ========================================================================= */}
          <div className="bg-gradient-to-br from-slate-900 via-slate-950 to-indigo-950 text-white rounded-[32px] p-6 sm:p-7 border border-slate-800 shadow-xl space-y-6 relative overflow-hidden">
            {/* Ambient background glow */}
            <div className="absolute top-0 right-0 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
            <div className="absolute bottom-0 left-0 w-80 h-80 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none -ml-20 -mb-20" />

            <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10 pb-5">
              <div>
                <div className="flex items-center gap-2.5">
                  <span className="px-3 py-1 bg-indigo-500/30 border border-indigo-400/40 text-indigo-300 text-[10px] font-black uppercase tracking-wider rounded-full flex items-center gap-1.5">
                    <Sparkles size={12} className="text-indigo-400" /> Isha Iibka & Kala Saarista Dakhliga
                  </span>
                  <span className="text-xs text-slate-400 font-bold">{filterLabel}</span>
                </div>
                <h3 className="text-xl sm:text-2xl font-black text-white tracking-tight mt-1.5 flex items-center gap-2">
                  Halka uu Iibka Guud Ka Yimid (Where Sales Originated)
                </h3>
                <p className="text-xs text-slate-300 font-medium mt-0.5">
                  Xisaabta saxda ah ee Store Sales + Ice Cream Sales + Deynta Macaamiisha (Cajaaib & Dadka Kale)
                </p>
              </div>

              <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 border border-white/15 text-right min-w-[200px]">
                <span className="text-[10px] uppercase font-bold text-slate-300 block tracking-wider">Wadarta Iibka Guud</span>
                <div className="text-2xl sm:text-3xl font-black text-emerald-400 mt-0.5">{fmt(metrics.grandTotalSales)}</div>
                <div className="text-[11px] text-slate-300 font-bold mt-0.5 flex items-center justify-end gap-2">
                  <span>{metrics.salesTxCount} Biilal</span>
                  <span>•</span>
                  <span>{metrics.grandTotalQty} pcs</span>
                </div>
              </div>
            </div>

            {/* Visual Stream Cards Grid */}
            <div className="relative z-10 grid grid-cols-1 md:grid-cols-3 gap-4">
              
              {/* Stream 1: Store / Supermarket Sales */}
              <div className="bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/10 transition-all flex flex-col justify-between group">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-black border border-blue-500/30">
                      <Store size={20} />
                    </div>
                    <span className="px-2.5 py-0.5 bg-blue-500/20 text-blue-300 text-[10px] font-black rounded-full border border-blue-500/30">
                      {metrics.regularPct.toFixed(1)}% Saamiga
                    </span>
                  </div>
                  <div className="mt-3">
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
                      1. Iibka Dukaanka (Store Sales)
                    </span>
                    <div className="text-xl sm:text-2xl font-black text-white mt-0.5">
                      {fmt(metrics.regularSalesTotal)}
                    </div>
                  </div>
                </div>
                <div className="pt-3 mt-3 border-t border-white/10 text-xs space-y-1">
                  <div className="flex justify-between text-slate-300 font-semibold">
                    <span>Tirada alaabta:</span>
                    <span className="font-bold text-white">{metrics.regularQty} pcs</span>
                  </div>
                  <div className="flex justify-between text-emerald-400 font-semibold">
                    <span>Faa'iidada:</span>
                    <span className="font-bold">+{fmt(metrics.regularProfit)}</span>
                  </div>
                </div>
              </div>

              {/* Stream 2: Ice Cream Sales */}
              <div className="bg-white/5 hover:bg-white/10 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-white/10 transition-all flex flex-col justify-between group">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center font-black border border-pink-500/30">
                      <ShoppingBag size={20} />
                    </div>
                    <span className="px-2.5 py-0.5 bg-pink-500/20 text-pink-300 text-[10px] font-black rounded-full border border-pink-500/30">
                      {metrics.iceCreamPct.toFixed(1)}% Saamiga
                    </span>
                  </div>
                  <div className="mt-3">
                    <span className="text-[10px] font-black uppercase tracking-wider text-pink-300 block">
                      2. Iibka Ice Cream-ka
                    </span>
                    <div className="text-xl sm:text-2xl font-black text-white mt-0.5">
                      {fmt(metrics.iceCreamSalesTotal)}
                    </div>
                  </div>
                </div>
                <div className="pt-3 mt-3 border-t border-white/10 text-xs space-y-1">
                  <div className="flex justify-between text-slate-300 font-semibold">
                    <span>Tirada scoops/pcs:</span>
                    <span className="font-bold text-white">{metrics.iceCreamQty} pcs</span>
                  </div>
                  <div className="flex justify-between text-pink-400 font-semibold">
                    <span>Faa'iidada:</span>
                    <span className="font-bold">+{fmt(metrics.iceCreamProfit)}</span>
                  </div>
                </div>
              </div>

              {/* Stream 3: Customer Debt (Deynta Macaamiisha - Cajaaib & Dadka Kale) */}
              <div className="bg-amber-500/10 hover:bg-amber-500/20 backdrop-blur-md rounded-2xl p-4 sm:p-5 border border-amber-500/30 transition-all flex flex-col justify-between group">
                <div>
                  <div className="flex items-center justify-between">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/30 text-amber-400 flex items-center justify-center font-black border border-amber-500/40">
                      <Users size={20} />
                    </div>
                    <span className="px-2.5 py-0.5 bg-amber-500/20 text-amber-300 text-[10px] font-black rounded-full border border-amber-500/30">
                      {metrics.debtPct.toFixed(1)}% Saamiga
                    </span>
                  </div>
                  <div className="mt-3">
                    <span className="text-[10px] font-black uppercase tracking-wider text-amber-300 block">
                      3. Deynta Macaamiisha (Credit)
                    </span>
                    <div className="text-xl sm:text-2xl font-black text-amber-300 mt-0.5">
                      {fmt(metrics.debtSalesTotal)}
                    </div>
                  </div>
                </div>
                <div className="pt-3 mt-3 border-t border-amber-500/20 text-xs space-y-1">
                  <div className="flex justify-between text-slate-300 font-semibold">
                    <span>Macaamiisha deynta:</span>
                    <span className="font-bold text-amber-300">{metrics.debtorList.length} Macamiil</span>
                  </div>
                  <div className="flex justify-between text-slate-400 font-semibold text-[11px]">
                    <span>Deynta mudadaas:</span>
                    <span className="font-bold text-white">{metrics.debtQty} pcs</span>
                  </div>
                </div>
              </div>

            </div>

            {/* Mathematical Reconciler Formula Interactive Strip */}
            <div className="relative z-10 bg-black/40 rounded-2xl p-4 border border-white/10 space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <span className="text-xs font-black uppercase text-indigo-400 tracking-wider flex items-center gap-2">
                  <Calculator size={15} /> Xisaabta Is-Lahaanshaha Iibka (Sales Origin Equation):
                </span>
                <span className="text-[10px] text-slate-400 font-bold">Xisaab Wadareed Dhab ah ({filterLabel})</span>
              </div>
              <div className="flex flex-wrap items-center gap-2 text-xs font-black">
                <span className="px-3 py-1.5 bg-blue-500/20 text-blue-300 rounded-xl border border-blue-500/30">
                  Store Sales: {fmt(metrics.regularSalesTotal)}
                </span>
                <span className="text-slate-400 font-black">+</span>
                <span className="px-3 py-1.5 bg-pink-500/20 text-pink-300 rounded-xl border border-pink-500/30">
                  Ice Cream Sales: {fmt(metrics.iceCreamSalesTotal)}
                </span>
                <span className="text-slate-400 font-black">+</span>
                <span className="px-3 py-1.5 bg-amber-500/20 text-amber-300 rounded-xl border border-amber-500/30">
                  Deynta Macaamiisha: {fmt(metrics.debtSalesTotal)}
                </span>
                <span className="text-slate-400 font-black">=</span>
                <span className="px-3.5 py-1.5 bg-emerald-500 text-slate-950 rounded-xl font-black shadow-lg">
                  WADARTA GUUD EE IIBKA: {fmt(metrics.grandTotalSales)}
                </span>
              </div>
            </div>

            {/* Debtor Highlights Banner: e.g. Deynta Cajaaib, Deynta Cali, Deymaha Dadka Kale */}
            {metrics.debtorList.length > 0 && (
              <div className="relative z-10 bg-amber-500/10 rounded-2xl p-4 border border-amber-500/20 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users size={16} className="text-amber-400" />
                    <span className="text-xs font-black text-amber-300 uppercase tracking-wider">
                      Kala Saarista Deymaha Macaamiisha ee Mudadaas (Debtor Breakdown)
                    </span>
                  </div>
                  <span className="text-[11px] font-bold text-amber-300/80">
                    Wadarta: {fmt(metrics.debtSalesTotal)} ({metrics.debtorList.length} Macamiil)
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {metrics.debtorList.slice(0, 6).map((debtor, idx) => (
                    <div 
                      key={debtor.name}
                      className="bg-black/30 rounded-xl p-3 border border-amber-500/20 hover:border-amber-500/40 transition-all space-y-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="w-5 h-5 rounded-md bg-amber-500/30 text-amber-300 font-black text-[10px] flex items-center justify-center">
                            {idx + 1}
                          </span>
                          <span className="font-bold text-white text-xs">
                            {debtor.name.toLowerCase().includes('caja') ? `🌟 Deynta ${debtor.name}` : `Deynta ${debtor.name}`}
                          </span>
                        </div>
                        <span className="font-mono font-black text-amber-300 text-xs">
                          {fmt(debtor.totalDebt)}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-300 flex justify-between">
                        <span>{debtor.count} Biil • {debtor.qty} pcs</span>
                        {debtor.remainingDebtBalance > 0 && (
                          <span className="text-amber-400 font-bold">Harada: {fmt(debtor.remainingDebtBalance)}</span>
                        )}
                      </div>
                      {debtor.items.length > 0 && (
                        <div className="text-[10px] text-slate-400 truncate">
                          Alaabta: {debtor.items.slice(0, 3).join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

          </div>

          {/* ========================================================================= */}
          {/* 📊 2. FINANCIAL & OPERATIONAL KPIS GRID */}
          {/* ========================================================================= */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            
            {/* 1. Total Sales */}
            <div className="bg-white rounded-[26px] p-5 border border-slate-200 shadow-xs hover:shadow-md transition-all space-y-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center font-black">
                    <ShoppingCart size={20} />
                  </div>
                  <span className="text-[10px] font-black text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full uppercase">
                    {metrics.salesTxCount} Biil
                  </span>
                </div>
                <div className="mt-3">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                    1. Wadarta Iibka Guud
                  </span>
                  <div className="text-2xl font-black text-slate-900 mt-0.5">
                    {fmt(metrics.grandTotalSales)}
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 font-semibold flex justify-between">
                <span>Tirada xabo/KG:</span>
                <span className="font-bold text-slate-800">{metrics.grandTotalQty} pcs/kg</span>
              </div>
            </div>

            {/* 2. Total Purchases / Stock In */}
            <div className="bg-white rounded-[26px] p-5 border border-slate-200 shadow-xs hover:shadow-md transition-all space-y-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center font-black">
                    <Package size={20} />
                  </div>
                  <span className="text-[10px] font-black text-indigo-700 bg-indigo-50 px-2.5 py-0.5 rounded-full uppercase">
                    {metrics.purchasesCount} Dalab
                  </span>
                </div>
                <div className="mt-3">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                    2. Alaabta La Soo Iibsaday
                  </span>
                  <div className="text-2xl font-black text-slate-900 mt-0.5">
                    {fmt(metrics.purchasesTotal)}
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 font-semibold flex justify-between">
                <span>Iibka Supplier-ada:</span>
                <span className="font-bold text-indigo-600">Stock Cusub</span>
              </div>
            </div>

            {/* 3. Cost of Goods Sold (COGS) */}
            <div className="bg-white rounded-[26px] p-5 border border-slate-200 shadow-xs hover:shadow-md transition-all space-y-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
                    <Tag size={20} />
                  </div>
                  <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full uppercase">
                    Cost
                  </span>
                </div>
                <div className="mt-3">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                    3. Qiimihii Lagu Soo Iibiyay (COGS)
                  </span>
                  <div className="text-2xl font-black text-slate-900 mt-0.5">
                    {fmt(metrics.grandTotalCost)}
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 font-semibold flex justify-between">
                <span>Qiimaha Asalka:</span>
                <span className="font-bold text-amber-700">Alaabta la iibiyay</span>
              </div>
            </div>

            {/* 4. Gross Profit (Faa'iidada Iibka) */}
            <div className="bg-white rounded-[26px] p-5 border border-slate-200 shadow-xs hover:shadow-md transition-all space-y-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center font-black">
                    <TrendingUp size={20} />
                  </div>
                  <span className="text-[10px] font-black text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full uppercase">
                    +{metrics.markupPct.toFixed(1)}% Markup
                  </span>
                </div>
                <div className="mt-3">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                    4. Faa'iidada Iibka (Gross Profit)
                  </span>
                  <div className="text-2xl font-black text-emerald-600 mt-0.5">
                    +{fmt(metrics.grandTotalProfit)}
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 font-semibold flex justify-between">
                <span>Margin Guud:</span>
                <span className="font-bold text-emerald-700">{metrics.grossMarginPct.toFixed(1)}%</span>
              </div>
            </div>

            {/* 5. Total Expenses (Kharashaadka Guud) */}
            <div className="bg-white rounded-[26px] p-5 border border-slate-200 shadow-xs hover:shadow-md transition-all space-y-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-black">
                    <MinusCircle size={20} />
                  </div>
                  <span className="text-[10px] font-black text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full uppercase">
                    Kharash
                  </span>
                </div>
                <div className="mt-3">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                    5. Kharashaadka Guud
                  </span>
                  <div className="text-2xl font-black text-rose-600 mt-0.5">
                    -{fmt(metrics.totalExpenses)}
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 font-semibold flex justify-between">
                <span>Wadarta Kharashyada:</span>
                <span className="font-bold text-rose-700">-{fmt(metrics.totalExpenses)}</span>
              </div>
            </div>

            {/* 6. Net Profit (Faa'iidada Saafiga ah) */}
            <div className="bg-white rounded-[26px] p-5 border-2 border-emerald-300 shadow-xs hover:shadow-md transition-all space-y-2 flex flex-col justify-between bg-emerald-50/20">
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black">
                    <Coins size={20} />
                  </div>
                  <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2.5 py-0.5 rounded-full uppercase">
                    Net Profit
                  </span>
                </div>
                <div className="mt-3">
                  <span className="text-[11px] font-black uppercase tracking-wider text-emerald-800 block">
                    6. Faa'iidada Saafiga ah (Net Profit)
                  </span>
                  <div className="text-2xl font-black text-emerald-700 mt-0.5">
                    {metrics.netProfit >= 0 ? `+${fmt(metrics.netProfit)}` : `-${fmt(Math.abs(metrics.netProfit))}`}
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t border-emerald-100 text-xs text-emerald-800 font-semibold flex justify-between">
                <span>Net Margin %:</span>
                <span className="font-bold">{metrics.netMarginPct.toFixed(1)}%</span>
              </div>
            </div>

            {/* 7. Discounts Given (Qiimo Dhimis) */}
            <div className="bg-white rounded-[26px] p-5 border border-slate-200 shadow-xs hover:shadow-md transition-all space-y-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-600 flex items-center justify-center font-black">
                    <Percent size={20} />
                  </div>
                  <span className="text-[10px] font-black text-purple-700 bg-purple-50 px-2.5 py-0.5 rounded-full uppercase">
                    Discount
                  </span>
                </div>
                <div className="mt-3">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                    7. Dhimista La Sameeyay
                  </span>
                  <div className="text-2xl font-black text-slate-900 mt-0.5">
                    {fmt(metrics.grandTotalDiscounts)}
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 font-semibold flex justify-between">
                <span>Loo dhimay:</span>
                <span className="font-bold text-purple-700">Macaamiisha</span>
              </div>
            </div>

            {/* 8. New Debt Sales (Iibka Deynta ah) */}
            <div className="bg-white rounded-[26px] p-5 border border-slate-200 shadow-xs hover:shadow-md transition-all space-y-2 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center font-black">
                    <Users size={20} />
                  </div>
                  <span className="text-[10px] font-black text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full uppercase">
                    Credit
                  </span>
                </div>
                <div className="mt-3">
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 block">
                    8. Deynta Cusub ee La Qaatay
                  </span>
                  <div className="text-2xl font-black text-slate-900 mt-0.5">
                    {fmt(metrics.debtSalesTotal)}
                  </div>
                </div>
              </div>
              <div className="pt-3 border-t border-slate-100 text-xs text-slate-500 font-semibold flex justify-between">
                <span>Deynta mudadaas:</span>
                <span className="font-bold text-amber-700">{metrics.debtQty} pcs</span>
              </div>
            </div>

          </div>

          {/* ========================================================================= */}
          {/* 💵 3. CASH INFLOW & SETTLEMENT DESTINATION BANNER */}
          {/* ========================================================================= */}
          <div className="bg-white rounded-[32px] p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Wallet size={18} className="text-emerald-600" />
                  Lacagta Account-yada & Sanduuqa Soo Gashay ({filterLabel})
                </h3>
                <p className="text-xs text-slate-500 font-semibold">
                  Wadarta lacagta dhabta ah ee caddaanka, bangiga, iyo mobile money ku soo dhacday mudadaas.
                </p>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-bold text-slate-400 block uppercase">Wadarta Lacagta Soo Gashay</span>
                <span className="text-xl font-black text-emerald-600">{fmt(metrics.totalCollectedInflow)}</span>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-2">
              <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-200">
                <div className="flex items-center gap-2 text-emerald-800 font-black text-xs uppercase mb-1">
                  <Wallet size={16} /> Lacagta Caddaanka ah (Cash)
                </div>
                <div className="text-xl font-black text-emerald-950">{fmt(metrics.cashInflow)}</div>
                <p className="text-[11px] text-emerald-700 mt-1 font-semibold">Gacanta & Qasnadda</p>
              </div>

              <div className="p-4 rounded-2xl bg-blue-50 border border-blue-200">
                <div className="flex items-center gap-2 text-blue-800 font-black text-xs uppercase mb-1">
                  <Landmark size={16} /> Lacagta Bangiyada (Bank)
                </div>
                <div className="text-xl font-black text-blue-950">{fmt(metrics.bankInflow)}</div>
                <p className="text-[11px] text-blue-700 mt-1 font-semibold">CBE, Salaam, Dahabshiil, iwm</p>
              </div>

              <div className="p-4 rounded-2xl bg-purple-50 border border-purple-200">
                <div className="flex items-center gap-2 text-purple-800 font-black text-xs uppercase mb-1">
                  <Smartphone size={16} /> Mobile Money (Zaad / Sahal)
                </div>
                <div className="text-xl font-black text-purple-950">{fmt(metrics.mobileInflow)}</div>
                <p className="text-[11px] text-purple-700 mt-1 font-semibold">Zaad, Sahal, eDahab, Telebirr</p>
              </div>

              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200">
                <div className="flex items-center gap-2 text-amber-800 font-black text-xs uppercase mb-1">
                  <CheckCircle2 size={16} /> Deymihii Hore ee La Bixiyay
                </div>
                <div className="text-xl font-black text-amber-950">{fmt(metrics.debtRepaymentTotal)}</div>
                <p className="text-[11px] text-amber-700 mt-1 font-semibold">{metrics.debtRepaymentCount} Rasiidhada deynta</p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 2: PRODUCT-BY-PRODUCT STOCK VALUATION & FUTURE PROFIT POTENTIAL */}
      {/* ========================================================================= */}
      {activeSubTab === 'VALUATION' && (
        <div className="bg-white rounded-[32px] p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                <PackageCheck size={20} className="text-indigo-600" />
                Qiimaynta Stock-ga & Faa'iidada Alaab Kasta Ku Jirta (Itemized Valuation)
              </h3>
              <p className="text-xs text-slate-500 font-semibold">
                Lacagta kuugu xiran alaab kasta, inta ka soo geli doonta marka la iibiyo, iyo faa'iidada ku jirta.
              </p>
            </div>

            {/* Valuation Search */}
            <div className="relative w-full md:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Raadi alaab ama barcode..."
                value={valuationSearch}
                onChange={e => setValuationSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Valuation Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase tracking-wider text-[10px]">
                  <th className="p-3.5">Alaabta</th>
                  <th className="p-3.5">Qaybta</th>
                  <th className="p-3.5 text-center">Stock-ga Yaal</th>
                  <th className="p-3.5 text-right">Cost Price</th>
                  <th className="p-3.5 text-right">Sell Price</th>
                  <th className="p-3.5 text-right">Stock Cost Value</th>
                  <th className="p-3.5 text-right">Expected Revenue</th>
                  <th className="p-3.5 text-right">Expected Profit</th>
                  <th className="p-3.5 text-right">Markup %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {filteredValuationList.map((item, idx) => (
                  <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 font-black text-[10px] flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="truncate">
                        <p className="truncate font-bold">{item.name}</p>
                        {item.barcode && <span className="text-[10px] text-slate-400 font-mono">{item.barcode}</span>}
                      </div>
                    </td>
                    <td className="p-3.5 text-slate-500 font-bold">{item.category}</td>
                    <td className="p-3.5 text-center font-bold font-mono">
                      <span className={`px-2 py-0.5 rounded-full text-xs ${
                        item.stock === 0 ? 'bg-rose-100 text-rose-700' :
                        item.stock <= 5 ? 'bg-amber-100 text-amber-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {item.stock} {item.unit}
                      </span>
                    </td>
                    <td className="p-3.5 text-right font-mono text-amber-700 font-bold">{fmt(item.cost)}</td>
                    <td className="p-3.5 text-right font-mono text-blue-700 font-bold">{fmt(item.sell)}</td>
                    <td className="p-3.5 text-right font-mono text-slate-900 font-bold">{fmt(item.stockCostVal)}</td>
                    <td className="p-3.5 text-right font-mono text-blue-700 font-black">{fmt(item.stockRetailVal)}</td>
                    <td className="p-3.5 text-right font-mono text-emerald-700 font-black">+{fmt(item.stockProfitVal)}</td>
                    <td className="p-3.5 text-right font-mono font-black text-indigo-700">+{item.unitMarkup.toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 3: ORIGIN BREAKDOWN & CHARTS */}
      {/* ========================================================================= */}
      {activeSubTab === 'ORIGIN' && (
        <div className="space-y-6">

          {/* Comparative Origin Breakdown Table */}
          <div className="bg-white rounded-[32px] p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Sparkles size={18} className="text-indigo-600" />
                  Kala Saarista Ilaha Iibka (Sales Origin Comparison Table)
                </h3>
                <p className="text-xs text-slate-500 font-semibold">
                  Is-barbardhigga Store Sales, Ice Cream, iyo Deynta Macaamiisha ({filterLabel})
                </p>
              </div>
              <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-black rounded-full">
                Wadarta: {fmt(metrics.grandTotalSales)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase tracking-wider text-[10px]">
                    <th className="p-3.5">Isha Iibka (Origin Stream)</th>
                    <th className="p-3.5 text-center">Tirada Rasiidhada</th>
                    <th className="p-3.5 text-center">Tirada PCS</th>
                    <th className="p-3.5 text-right">Cost (Qiimaha Asalka)</th>
                    <th className="p-3.5 text-right">Revenue (Iibka Guud)</th>
                    <th className="p-3.5 text-right">Faa'iidada (Profit)</th>
                    <th className="p-3.5 text-right">% Saamiga Guud</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {/* Row 1: Store Sales */}
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 font-black text-[10px] flex items-center justify-center">
                        <Store size={14} />
                      </span>
                      <div>
                        <p className="font-black text-slate-900">1. Iibka Dukaanka (Store Sales)</p>
                        <span className="text-[10px] text-slate-400">Supermarket / Grocery</span>
                      </div>
                    </td>
                    <td className="p-3.5 text-center font-bold font-mono text-slate-700">{metrics.regularCount}</td>
                    <td className="p-3.5 text-center font-bold font-mono text-slate-700">{metrics.regularQty} pcs</td>
                    <td className="p-3.5 text-right font-mono text-amber-700 font-bold">{fmt(metrics.regularCostTotal)}</td>
                    <td className="p-3.5 text-right font-mono text-blue-700 font-black">{fmt(metrics.regularSalesTotal)}</td>
                    <td className="p-3.5 text-right font-mono text-emerald-700 font-black">+{fmt(metrics.regularProfit)}</td>
                    <td className="p-3.5 text-right font-mono font-black text-blue-700">
                      {metrics.regularPct.toFixed(1)}%
                    </td>
                  </tr>

                  {/* Row 2: Ice Cream Sales */}
                  <tr className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-pink-100 text-pink-700 font-black text-[10px] flex items-center justify-center">
                        <ShoppingBag size={14} />
                      </span>
                      <div>
                        <p className="font-black text-slate-900">2. Iibka Ice Cream-ka</p>
                        <span className="text-[10px] text-slate-400">Ice Cream & Shakes</span>
                      </div>
                    </td>
                    <td className="p-3.5 text-center font-bold font-mono text-slate-700">{metrics.iceCreamCount}</td>
                    <td className="p-3.5 text-center font-bold font-mono text-slate-700">{metrics.iceCreamQty} pcs</td>
                    <td className="p-3.5 text-right font-mono text-amber-700 font-bold">{fmt(metrics.iceCreamCostTotal)}</td>
                    <td className="p-3.5 text-right font-mono text-pink-700 font-black">{fmt(metrics.iceCreamSalesTotal)}</td>
                    <td className="p-3.5 text-right font-mono text-emerald-700 font-black">+{fmt(metrics.iceCreamProfit)}</td>
                    <td className="p-3.5 text-right font-mono font-black text-pink-700">
                      {metrics.iceCreamPct.toFixed(1)}%
                    </td>
                  </tr>

                  {/* Row 3: Debt Sales */}
                  <tr className="hover:bg-amber-50/60 transition-colors bg-amber-50/20">
                    <td className="p-3.5 font-bold text-slate-900 flex items-center gap-2">
                      <span className="w-6 h-6 rounded-lg bg-amber-100 text-amber-700 font-black text-[10px] flex items-center justify-center">
                        <Users size={14} />
                      </span>
                      <div>
                        <p className="font-black text-amber-900">3. Deynta Macaamiisha (Credit)</p>
                        <span className="text-[10px] text-amber-700 font-semibold">{metrics.debtorList.length} Macamiil (Cajaaib & kuwo kale)</span>
                      </div>
                    </td>
                    <td className="p-3.5 text-center font-bold font-mono text-amber-900">{metrics.debtCount}</td>
                    <td className="p-3.5 text-center font-bold font-mono text-amber-900">{metrics.debtQty} pcs</td>
                    <td className="p-3.5 text-right font-mono text-amber-700 font-bold">{fmt(metrics.debtCostTotal)}</td>
                    <td className="p-3.5 text-right font-mono text-amber-800 font-black">{fmt(metrics.debtSalesTotal)}</td>
                    <td className="p-3.5 text-right font-mono text-emerald-700 font-black">+{fmt(metrics.debtProfit)}</td>
                    <td className="p-3.5 text-right font-mono font-black text-amber-800">
                      {metrics.debtPct.toFixed(1)}%
                    </td>
                  </tr>

                  {/* Summary Total Row */}
                  <tr className="bg-slate-900 text-white font-black">
                    <td className="p-3.5 font-black text-emerald-400">WADARTA GUUD EE IIBKA</td>
                    <td className="p-3.5 text-center font-mono">{metrics.salesTxCount} Biil</td>
                    <td className="p-3.5 text-center font-mono">{metrics.grandTotalQty} pcs</td>
                    <td className="p-3.5 text-right font-mono text-amber-300">{fmt(metrics.grandTotalCost)}</td>
                    <td className="p-3.5 text-right font-mono text-emerald-400 text-sm">{fmt(metrics.grandTotalSales)}</td>
                    <td className="p-3.5 text-right font-mono text-emerald-300 text-sm">+{fmt(metrics.grandTotalProfit)}</td>
                    <td className="p-3.5 text-right font-mono text-white">100.0%</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Chart 1: Origin Source Share */}
            <div className="bg-white rounded-[32px] p-6 border border-slate-200 shadow-xs space-y-4">
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  Shaxda Isha Iibka (Sales Origin Share)
                </h3>
                <p className="text-xs text-slate-500 font-semibold">
                  Qaybaha uu ka kooban yahay wadarta iibka guud ({filterLabel})
                </p>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={metrics.originPieData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={95}
                      paddingAngle={4}
                      dataKey="value"
                    >
                      {metrics.originPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(val: any) => [fmt(Number(val)), 'Wadarta']}
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '16px', color: '#fff', border: 'none' }}
                    />
                    <Legend 
                      verticalAlign="bottom" 
                      height={36} 
                      formatter={(value) => <span className="text-xs font-bold text-slate-700">{value}</span>}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Payment Destination */}
            <div className="bg-white rounded-[32px] p-6 border border-slate-200 shadow-xs space-y-4">
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  Halka Lacagtu Ku Dhacday (Payment Inflow Destination)
                </h3>
                <p className="text-xs text-slate-500 font-semibold">
                  Kala saarista Caddaan, Bangiyada, Mobile Money, iyo Deynta
                </p>
              </div>

              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.channelPieData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{ fontSize: 10, fontWeight: 700 }} />
                    <YAxis tick={{ fontSize: 10, fontWeight: 700 }} tickFormatter={v => `${(v/1000).toFixed(0)}k`} />
                    <Tooltip 
                      formatter={(val: any) => [fmt(Number(val)), 'Lacagta']}
                      contentStyle={{ backgroundColor: '#0f172a', borderRadius: '16px', color: '#fff', border: 'none' }}
                    />
                    <Bar dataKey="value" radius={[12, 12, 0, 0]}>
                      {metrics.channelPieData.map((entry, index) => (
                        <Cell key={`bar-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 4: CATEGORIES BREAKDOWN */}
      {/* ========================================================================= */}
      {activeSubTab === 'CATEGORIES' && (
        <div className="bg-white rounded-[32px] p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Kala Saarista Qaybaha Alaabta (Categories Breakdown)
              </h3>
              <p className="text-xs text-slate-500 font-semibold">
                Qayb kasta inta ay ka dhalisay wadarta guud ee iibka ({filterLabel})
              </p>
            </div>
            <span className="px-3 py-1 bg-slate-100 text-slate-800 text-xs font-black rounded-full">
              {metrics.categoryList.length} Qaybood
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase tracking-wider text-[10px]">
                  <th className="p-3.5">Qaybta (Category)</th>
                  <th className="p-3.5 text-center">Tirada Iibka</th>
                  <th className="p-3.5 text-center">Tirada PCS</th>
                  <th className="p-3.5 text-right">Cost</th>
                  <th className="p-3.5 text-right">Revenue</th>
                  <th className="p-3.5 text-right">Faa'iidada (Profit)</th>
                  <th className="p-3.5 text-right">% Saamiga Guud</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {metrics.categoryList.map((cat, idx) => {
                  const sharePct = metrics.grandTotalSales > 0 ? (cat.revenue / metrics.grandTotalSales) * 100 : 0;
                  return (
                    <tr key={cat.category} className="hover:bg-slate-50 transition-colors">
                      <td className="p-3.5 font-bold text-slate-900 flex items-center gap-2">
                        <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 font-black text-[10px] flex items-center justify-center">
                          {idx + 1}
                        </span>
                        {cat.category}
                      </td>
                      <td className="p-3.5 text-center font-bold font-mono">{cat.count}</td>
                      <td className="p-3.5 text-center font-bold font-mono">{cat.qty} PCS</td>
                      <td className="p-3.5 text-right font-mono text-amber-700 font-bold">{fmt(cat.cost)}</td>
                      <td className="p-3.5 text-right font-mono text-blue-700 font-black">{fmt(cat.revenue)}</td>
                      <td className="p-3.5 text-right font-mono text-emerald-700 font-black">{fmt(cat.profit)}</td>
                      <td className="p-3.5 text-right font-mono font-black text-indigo-700">
                        {sharePct.toFixed(1)}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 5: CUSTOMERS & DEBTORS */}
      {/* ========================================================================= */}
      {activeSubTab === 'CUSTOMERS' && (
        <div className="space-y-6">
          
          {/* Header & Filter Controls */}
          <div className="bg-white rounded-[32px] p-6 border border-slate-200 shadow-xs space-y-4">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight flex items-center gap-2">
                  <Users size={20} className="text-indigo-600" />
                  Kala Saarista Macaamiisha & Deymaha (Customer Ledger & Debt Analysis)
                </h3>
                <p className="text-xs text-slate-500 font-semibold">
                  Macaamiisha dukaanka ka adeegtay, lacagta ay galiyeen, iyo deynta gaarka ah ee qof kasta qaatay ({filterLabel})
                </p>
              </div>

              {/* Segmented Filter Pills */}
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setCustomerSubFilter('ALL')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                    customerSubFilter === 'ALL'
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  Dhammaan ({metrics.customerList.length})
                </button>
                <button
                  onClick={() => setCustomerSubFilter('DEBTORS')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all flex items-center gap-1.5 ${
                    customerSubFilter === 'DEBTORS'
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-amber-50 text-amber-800 hover:bg-amber-100 border border-amber-200'
                  }`}
                >
                  <Users size={13} /> Kuwa Deynta Qaatay ({metrics.debtorList.length})
                </button>
                <button
                  onClick={() => setCustomerSubFilter('CASH')}
                  className={`px-3.5 py-1.5 rounded-xl text-xs font-black transition-all ${
                    customerSubFilter === 'CASH'
                      ? 'bg-emerald-600 text-white shadow-xs'
                      : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100 border border-emerald-200'
                  }`}
                >
                  Kuwa Caddaanka ah ({metrics.customerList.filter(c => !c.isDebt).length})
                </button>
              </div>
            </div>

            {/* Debtor Overview Cards (If Debtors Exist) */}
            {metrics.debtorList.length > 0 && (
              <div className="pt-2">
                <div className="text-xs font-black text-amber-800 uppercase tracking-wider mb-2 flex items-center gap-1.5">
                  <AlertCircle size={14} className="text-amber-600" />
                  Macaamiisha Deynta Mudadaas Qaatay (Debtors in Selected Period - e.g. Cajaaib & Dadka Kale):
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {metrics.debtorList.map((debtor, idx) => (
                    <div 
                      key={debtor.name}
                      onClick={() => setSelectedDebtor(selectedDebtor === debtor.name ? null : debtor.name)}
                      className={`p-4 rounded-2xl border transition-all cursor-pointer ${
                        selectedDebtor === debtor.name
                          ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-md font-bold'
                          : 'bg-amber-50/50 hover:bg-amber-100/60 border-amber-200'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-lg text-xs font-black flex items-center justify-center ${
                            selectedDebtor === debtor.name ? 'bg-slate-950 text-white' : 'bg-amber-200 text-amber-900'
                          }`}>
                            {idx + 1}
                          </span>
                          <span className="font-black text-sm">
                            {debtor.name.toLowerCase().includes('caja') ? `🌟 ${debtor.name}` : debtor.name}
                          </span>
                        </div>
                        <span className="font-mono font-black text-sm text-amber-900">
                          {fmt(debtor.totalDebt)}
                        </span>
                      </div>
                      <div className="mt-2 text-xs flex justify-between font-semibold">
                        <span className="text-slate-600">{debtor.count} Biil • {debtor.qty} pcs</span>
                        {debtor.remainingDebtBalance > 0 && (
                          <span className="text-rose-700 font-bold">Harada Guud: {fmt(debtor.remainingDebtBalance)}</span>
                        )}
                      </div>
                      {debtor.items.length > 0 && (
                        <div className="mt-1 text-[11px] text-slate-500 truncate">
                          Alaabta: {debtor.items.join(', ')}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Customers Master Table */}
            <div className="overflow-x-auto pt-2">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase tracking-wider text-[10px]">
                    <th className="p-3.5">Macmiilka (Customer Name)</th>
                    <th className="p-3.5 text-center">Nooca Iibka</th>
                    <th className="p-3.5 text-center">Tirada Rasiidhada</th>
                    <th className="p-3.5 text-right">Wadarta Iibka</th>
                    <th className="p-3.5 text-right">Faa'iidada laga helay</th>
                    <th className="p-3.5 text-right">% Saamiga Guud</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                  {metrics.customerList
                    .filter(c => {
                      if (customerSubFilter === 'DEBTORS') return c.isDebt;
                      if (customerSubFilter === 'CASH') return !c.isDebt;
                      return true;
                    })
                    .map((cust, idx) => {
                      const sharePct = metrics.grandTotalSales > 0 ? (cust.revenue / metrics.grandTotalSales) * 100 : 0;
                      return (
                        <tr key={cust.name} className={`hover:bg-slate-50 transition-colors ${cust.isDebt ? 'bg-amber-50/30' : ''}`}>
                          <td className="p-3.5 font-bold text-slate-900 flex items-center gap-2">
                            <span className="w-6 h-6 rounded-lg bg-indigo-50 text-indigo-700 font-black text-[10px] flex items-center justify-center">
                              {idx + 1}
                            </span>
                            <div>
                              <p className="font-bold text-slate-900">{cust.name}</p>
                              {cust.isDebt && (
                                <span className="text-[10px] text-amber-700 font-bold">Deynta Mudadaas Qaatay</span>
                              )}
                            </div>
                          </td>
                          <td className="p-3.5 text-center">
                            {cust.isDebt ? (
                              <span className="px-2.5 py-0.5 bg-amber-100 text-amber-800 text-[10px] font-black rounded-full border border-amber-200">
                                📝 Deyn (Credit)
                              </span>
                            ) : (
                              <span className="px-2.5 py-0.5 bg-emerald-100 text-emerald-800 text-[10px] font-black rounded-full border border-emerald-200">
                                💵 Cadaan / Direct
                              </span>
                            )}
                          </td>
                          <td className="p-3.5 text-center font-bold font-mono">{cust.count}</td>
                          <td className="p-3.5 text-right font-mono text-blue-700 font-black">{fmt(cust.revenue)}</td>
                          <td className="p-3.5 text-right font-mono text-emerald-700 font-black">{fmt(cust.profit)}</td>
                          <td className="p-3.5 text-right font-mono font-black text-indigo-700">
                            {sharePct.toFixed(1)}%
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

      {/* ========================================================================= */}
      {/* VIEW 6: ITEMIZED AUDIT LEDGER */}
      {/* ========================================================================= */}
      {activeSubTab === 'ITEMIZED' && (
        <div className="bg-white rounded-[32px] p-6 border border-slate-200 shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h3 className="text-lg font-black text-slate-900 tracking-tight">
                Liiska Tooska ah ee Dhaqdhaqaaqa (Itemized Audit Ledger)
              </h3>
              <p className="text-xs text-slate-500 font-semibold">
                Alaab kasta oo la iibiyay, qiimaheeda, faa'iidada, iyo habka lagu bixiyay ({filterLabel})
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={handleExportCSV}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-black rounded-xl text-xs flex items-center gap-1.5 transition-all"
              >
                <Download size={14} /> CSV Export
              </button>
            </div>
          </div>

          {/* Filter Bar */}
          <div className="flex flex-col md:flex-row items-center justify-between gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            {/* Search */}
            <div className="relative w-full md:w-72">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Raadi alaab, rasiid, macmiil..."
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
                className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            {/* Source Category Pills */}
            <div className="flex flex-wrap items-center gap-1.5 w-full md:w-auto">
              {[
                { key: 'ALL', label: 'Dhammaan (All)' },
                { key: 'REGULAR', label: 'Supermarket' },
                { key: 'ICECREAM', label: 'Ice Cream' },
                { key: 'DEBT', label: 'Iibka Deynta' },
                { key: 'DEBT_REPAY', label: 'Deymihii La Bixiyay' }
              ].map(pill => (
                <button
                  key={pill.key}
                  onClick={() => setSourceFilter(pill.key as SourceFilter)}
                  className={`px-3 py-1 rounded-xl text-[11px] font-black transition-all cursor-pointer ${
                    sourceFilter === pill.key
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'bg-white text-slate-600 hover:bg-slate-200 border border-slate-200'
                  }`}
                >
                  {pill.label}
                </button>
              ))}
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-black uppercase tracking-wider text-[10px]">
                  <th className="p-3.5">Tx ID & Taariikh</th>
                  <th className="p-3.5">Macmiilka</th>
                  <th className="p-3.5">Alaabta</th>
                  <th className="p-3.5">Isha (Source)</th>
                  <th className="p-3.5 text-center">Tirada</th>
                  <th className="p-3.5 text-right">Unit Price</th>
                  <th className="p-3.5 text-right">Wadarta Iibka</th>
                  <th className="p-3.5 text-right">Cost</th>
                  <th className="p-3.5 text-right">Faa'iido</th>
                  <th className="p-3.5">Habka</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
                {itemizedList.slice(0, 100).map((entry) => (
                  <tr key={entry.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-3.5 font-mono text-[11px]">
                      <span className="font-bold text-slate-900 block">#{entry.txId.slice(-6)}</span>
                      <span className="text-[10px] text-slate-400">{new Date(entry.timestamp).toLocaleDateString()}</span>
                    </td>
                    <td className="p-3.5 font-bold text-slate-900">{entry.customerName}</td>
                    <td className="p-3.5 font-bold text-slate-800">{entry.item.name}</td>
                    <td className="p-3.5">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                        entry.sourceType === 'REGULAR' ? 'bg-blue-100 text-blue-800' :
                        entry.sourceType === 'ICECREAM' ? 'bg-pink-100 text-pink-800' :
                        entry.sourceType === 'DEBT' ? 'bg-amber-100 text-amber-800' :
                        'bg-purple-100 text-purple-800'
                      }`}>
                        {entry.sourceLabel}
                      </span>
                    </td>
                    <td className="p-3.5 text-center font-mono font-bold">{entry.item.quantity}</td>
                    <td className="p-3.5 text-right font-mono text-slate-600">{fmt(entry.finalUnitSell)}</td>
                    <td className="p-3.5 text-right font-mono font-black text-slate-900">{fmt(entry.totalSell)}</td>
                    <td className="p-3.5 text-right font-mono text-amber-700 font-bold">{fmt(entry.totalCost)}</td>
                    <td className="p-3.5 text-right font-mono text-emerald-700 font-black">+{fmt(entry.totalProfit)}</td>
                    <td className="p-3.5 font-bold text-[10px] uppercase text-slate-500">{entry.paymentMethod}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
};

export default OgaanshoTab;
