import React, { useState, useMemo } from 'react';
import { AppData, Currency } from '../types';
import { 
  TrendingUp, 
  TrendingDown, 
  DollarSign, 
  Package, 
  AlertTriangle, 
  CalendarX, 
  Award, 
  Printer, 
  Search, 
  Filter, 
  PieChart, 
  Layers,
  Sparkles,
  ArrowUpRight,
  ArrowDownRight,
  Coins,
  X,
  Maximize2,
  Gift,
  CheckCircle2,
  Clock,
  ChevronRight,
  HelpCircle,
  ArrowUpDown,
  Flame,
  Star
} from 'lucide-react';
import { formatCurrency } from '../lib/utils';

interface ItemReportsProps {
  data: AppData;
  currency: Currency;
}

export type ItemReportRankType = 
  | 'TOP_SOLD' 
  | 'LEAST_SOLD' 
  | 'ZERO_SALES'
  | 'FREE_20_PROMO'
  | 'HIGHEST_REVENUE' 
  | 'LOWEST_REVENUE' 
  | 'LOW_STOCK' 
  | 'HIGHEST_STOCK' 
  | 'EXPIRING_SOON' 
  | 'MOST_PROFITABLE';

export type SalesSortOrder = 
  | 'RANK_BEST' 
  | 'RANK_WORST' 
  | 'REVENUE_DESC' 
  | 'PROFIT_DESC' 
  | 'STOCK_DESC' 
  | 'PROMO_DESC';

export const ItemReports: React.FC<ItemReportsProps> = ({ data, currency }) => {
  const [timeFilter, setTimeFilter] = useState<'ALL' | 'TODAY' | 'WEEK' | 'MONTH'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [itemLimit, setItemLimit] = useState<number>(70); // Default to 70 items
  const [activeRankType, setActiveRankType] = useState<ItemReportRankType | null>(null);
  const [rankFilter, setRankFilter] = useState<'ALL' | 'TOP_10' | 'TOP_70' | 'BOTTOM_70' | 'REACHED_20' | 'UNDER_20' | 'ZERO_SALES'>('ALL');
  const [sortBy, setSortBy] = useState<SalesSortOrder>('RANK_BEST');

  const rate = data.settings.exchangeRate;

  // Extract unique categories (excluding Khudaar)
  const categories = useMemo(() => {
    const set = new Set<string>();
    data.products.forEach(p => {
      const catLower = (p.category || '').toLowerCase();
      const isKhudaar = (p as any).isKhudaar || 
        catLower.includes('khudaar') || 
        catLower.includes('produce') || 
        catLower.includes('miro') || 
        catLower.includes('midho') || 
        p.id?.startsWith('khudaar-');

      if (!isKhudaar && p.category) {
        set.add(p.category.trim());
      }
    });
    return Array.from(set);
  }, [data.products]);

  // Track all-time last sold date for each product
  const allTimeLastSoldMap = useMemo(() => {
    const map: Record<string, number> = {};
    data.transactions.forEach(tx => {
      if (tx.type === 'SALE' && Array.isArray(tx.items)) {
        tx.items.forEach(item => {
          if (!map[item.id] || tx.timestamp > map[item.id]) {
            map[item.id] = tx.timestamp;
          }
        });
      }
    });
    return map;
  }, [data.transactions]);

  // Calculate sales stats per product based on timeFilter
  const productStats = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    // Current month start (e.g. 1st day of this calendar month at 00:00:00)
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();

    const statsMap: Record<string, { qtySold: number; totalRevenue: number }> = {};

    data.transactions.forEach(tx => {
      if (tx.type !== 'SALE' || !tx.items) return;

      // Filter transaction by timestamp
      if (timeFilter === 'TODAY' && tx.timestamp < todayStart) return;
      if (timeFilter === 'WEEK' && tx.timestamp < weekAgo) return;
      if (timeFilter === 'MONTH' && tx.timestamp < currentMonthStart) return;

      tx.items.forEach(item => {
        if (!statsMap[item.id]) {
          statsMap[item.id] = { qtySold: 0, totalRevenue: 0 };
        }
        const itemPrice = item.sellPrice || item.price || 0;
        statsMap[item.id].qtySold += item.quantity;
        statsMap[item.id].totalRevenue += (itemPrice * item.quantity);
      });
    });

    return statsMap;
  }, [data.transactions, timeFilter]);

  // Computed product metrics and GLOBAL SALES RANKING
  const productMetricsList = useMemo(() => {
    const today = new Date();

    // 1. First pass: compute basic metrics (excluding Khudaar)
    const rawList = data.products
      .filter(p => {
        const catLower = (p.category || '').toLowerCase();
        const isKhudaar = (p as any).isKhudaar || 
          catLower.includes('khudaar') || 
          catLower.includes('produce') || 
          catLower.includes('miro') || 
          catLower.includes('midho') || 
          p.id?.startsWith('khudaar-');
        return !isKhudaar;
      })
      .map(p => {
      const stats = productStats[p.id] || { qtySold: 0, totalRevenue: 0 };
      const unitCost = p.costPrice || p.unitCost || 0;
      const unitPrice = p.price || p.sellPrice || 0;
      const totalProfit = (unitPrice - unitCost) * stats.qtySold;
      const allTimeLastSold = allTimeLastSoldMap[p.id] || p.lastSoldAt || null;
      
      let expiryDiffDays = 999;
      let isExpiringSoon = false;
      if (p.expiryDate) {
        const expTime = new Date(p.expiryDate).getTime();
        expiryDiffDays = Math.ceil((expTime - today.getTime()) / (1000 * 60 * 60 * 24));
        if (expiryDiffDays <= 90) isExpiringSoon = true; // 90 days threshold
      }

      const isLowStock = p.stock <= (p.minStock ?? 5) && p.stock < 9000;

      // "Halkii midna inuu ka iibsamo 20 free" (Buy 20 get 1 Free / 20 Units target calculations)
      const free20Earned = Math.floor(stats.qtySold / 20);
      const remainderToNext20 = stats.qtySold % 20;
      const progressPercent = Math.min(100, Math.round((remainderToNext20 / 20) * 100));
      const hasReached20 = stats.qtySold >= 20;

      return {
        ...p,
        qtySold: stats.qtySold,
        totalRevenue: stats.totalRevenue,
        unitCost,
        unitPrice,
        totalProfit,
        allTimeLastSold,
        expiryDiffDays,
        isExpiringSoon,
        isLowStock,
        free20Earned,
        remainderToNext20,
        progressPercent,
        hasReached20
      };
    });

    // 2. Sort all products to establish global sales rank (#1 best seller down to lowest)
    const sortedForRank = [...rawList].sort((a, b) => {
      if (b.qtySold !== a.qtySold) return b.qtySold - a.qtySold;
      if (b.totalRevenue !== a.totalRevenue) return b.totalRevenue - a.totalRevenue;
      return a.name.localeCompare(b.name);
    });

    const maxSalesQty = sortedForRank[0]?.qtySold || 1;
    const totalCount = sortedForRank.length;

    // 3. Attach exact rank number (1..N) and rank status metadata to each product
    const rankedMap = new Map<string, {
      salesRank: number;
      salesRankOutOf: number;
      salesPercentOfTop: number;
      rankBadgeType: 'GOLD' | 'SILVER' | 'BRONZE' | 'TOP10' | 'TOP70' | 'ACTIVE' | 'ZERO';
      rankLabel: string;
    }>();

    sortedForRank.forEach((item, index) => {
      const rank = index + 1;
      const percentOfTop = maxSalesQty > 0 ? Math.round((item.qtySold / maxSalesQty) * 100) : 0;
      
      let rankBadgeType: 'GOLD' | 'SILVER' | 'BRONZE' | 'TOP10' | 'TOP70' | 'ACTIVE' | 'ZERO' = 'ACTIVE';
      let rankLabel = `Rank #${rank}`;

      if (item.qtySold === 0) {
        rankBadgeType = 'ZERO';
        rankLabel = `Rank #${rank} (0 Iib)`;
      } else if (rank === 1) {
        rankBadgeType = 'GOLD';
        rankLabel = `🥇 #1 Champion`;
      } else if (rank === 2) {
        rankBadgeType = 'SILVER';
        rankLabel = `🥈 #2 Runner-Up`;
      } else if (rank === 3) {
        rankBadgeType = 'BRONZE';
        rankLabel = `🥉 #3 Kaalinta 3-aad`;
      } else if (rank <= 10) {
        rankBadgeType = 'TOP10';
        rankLabel = `🏆 Rank #${rank} (Top 10)`;
      } else if (rank <= 70) {
        rankBadgeType = 'TOP70';
        rankLabel = `⭐ Rank #${rank} (Top 70)`;
      }

      rankedMap.set(item.id, {
        salesRank: rank,
        salesRankOutOf: totalCount,
        salesPercentOfTop: percentOfTop,
        rankBadgeType,
        rankLabel
      });
    });

    // Merge ranked metadata back
    return rawList.map(item => {
      const rankInfo = rankedMap.get(item.id)!;
      return {
        ...item,
        ...rankInfo
      };
    });
  }, [data.products, productStats]);

  // Top 70 Most Sold (Sheyga Ugu Iibsiga Badan)
  const topSoldList = useMemo(() => {
    return [...productMetricsList]
      .sort((a, b) => a.salesRank - b.salesRank)
      .slice(0, itemLimit);
  }, [productMetricsList, itemLimit]);

  // Top 70 Least Sold (Sheyga Ugu Iibsiga Yar)
  const leastSoldList = useMemo(() => {
    return [...productMetricsList]
      .sort((a, b) => b.salesRank - a.salesRank)
      .slice(0, itemLimit);
  }, [productMetricsList, itemLimit]);

  // 20-Free Promo Qualified list (Gaaray 20+ Iib)
  const free20QualifiedList = useMemo(() => {
    return [...productMetricsList]
      .filter(p => p.qtySold >= 20)
      .sort((a, b) => a.salesRank - b.salesRank);
  }, [productMetricsList]);

  // Total free bonus units earned across the entire store
  const totalFreeUnitsEarned = useMemo(() => {
    return productMetricsList.reduce((sum, p) => sum + p.free20Earned, 0);
  }, [productMetricsList]);

  // 1. Single Top Sold Product
  const topSoldProduct = topSoldList[0] || null;

  // 2. Single Least Sold Product
  const leastSoldProduct = leastSoldList[0] || null;

  // 3. Highest Revenue Product
  const highestRevenueProduct = useMemo(() => {
    if (productMetricsList.length === 0) return null;
    return [...productMetricsList].sort((a, b) => b.totalRevenue - a.totalRevenue)[0];
  }, [productMetricsList]);

  // 4. Lowest Revenue Product
  const lowestRevenueProduct = useMemo(() => {
    if (productMetricsList.length === 0) return null;
    return [...productMetricsList].sort((a, b) => a.totalRevenue - b.totalRevenue)[0];
  }, [productMetricsList]);

  // 5. Low Stock Products
  const lowStockProducts = useMemo(() => {
    return productMetricsList.filter(p => p.isLowStock).sort((a, b) => a.stock - b.stock);
  }, [productMetricsList]);

  // 6. Highest Stock Quantity
  const highestStockProduct = useMemo(() => {
    if (productMetricsList.length === 0) return null;
    const physicalItems = productMetricsList.filter(p => p.stock < 9000);
    if (physicalItems.length === 0) return null;
    return [...physicalItems].sort((a, b) => b.stock - a.stock)[0];
  }, [productMetricsList]);

  // 7. Expiring Soon
  const expiringSoonProducts = useMemo(() => {
    return productMetricsList.filter(p => p.isExpiringSoon).sort((a, b) => a.expiryDiffDays - b.expiryDiffDays);
  }, [productMetricsList]);

  // 8. Most Profitable
  const mostProfitableProduct = useMemo(() => {
    if (productMetricsList.length === 0) return null;
    return [...productMetricsList].sort((a, b) => b.totalProfit - a.totalProfit)[0];
  }, [productMetricsList]);

  // 0 Sales / Unsold items analysis
  const unsoldProductsList = useMemo(() => {
    return productMetricsList.filter(p => p.qtySold === 0);
  }, [productMetricsList]);

  const soldProductsList = useMemo(() => {
    return productMetricsList.filter(p => p.qtySold > 0);
  }, [productMetricsList]);

  const unsoldMetrics = useMemo(() => {
    const count = unsoldProductsList.length;
    const totalProducts = productMetricsList.length;
    const unsoldPercent = totalProducts > 0 ? Math.round((count / totalProducts) * 100) : 0;
    const soldCount = totalProducts - count;
    const soldPercent = totalProducts > 0 ? 100 - unsoldPercent : 0;

    const totalStock = unsoldProductsList.reduce((sum, p) => sum + (p.stock < 9000 ? p.stock : 0), 0);
    const totalCostUSD = unsoldProductsList.reduce((sum, p) => sum + ((p.stock < 9000 ? p.stock : 0) * (p.unitCost || 0)), 0);
    const totalCostETB = totalCostUSD * rate;
    const totalRetailUSD = unsoldProductsList.reduce((sum, p) => sum + ((p.stock < 9000 ? p.stock : 0) * (p.unitPrice || 0)), 0);
    const totalRetailETB = totalRetailUSD * rate;

    return {
      count,
      totalProducts,
      unsoldPercent,
      soldCount,
      soldPercent,
      totalStock,
      totalCostUSD,
      totalCostETB,
      totalRetailUSD,
      totalRetailETB
    };
  }, [unsoldProductsList, productMetricsList, rate]);

  // Modal dataset calculation for active report type (Using itemLimit e.g. 70 items)
  const modalRankData = useMemo(() => {
    if (!activeRankType) return [];

    switch (activeRankType) {
      case 'ZERO_SALES':
        return [...unsoldProductsList].sort((a, b) => {
          const aVal = (a.stock < 9000 ? a.stock : 0) * (a.unitCost || 0);
          const bVal = (b.stock < 9000 ? b.stock : 0) * (b.unitCost || 0);
          if (bVal !== aVal) return bVal - aVal;
          return (b.stock || 0) - (a.stock || 0);
        });
      case 'TOP_SOLD':
        return [...productMetricsList].sort((a, b) => a.salesRank - b.salesRank).slice(0, itemLimit);
      case 'LEAST_SOLD':
        return [...productMetricsList].sort((a, b) => b.salesRank - a.salesRank).slice(0, itemLimit);
      case 'FREE_20_PROMO':
        return [...productMetricsList].sort((a, b) => a.salesRank - b.salesRank).slice(0, itemLimit);
      case 'HIGHEST_REVENUE':
        return [...productMetricsList].sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, itemLimit);
      case 'LOWEST_REVENUE':
        return [...productMetricsList].sort((a, b) => a.totalRevenue - b.totalRevenue).slice(0, itemLimit);
      case 'LOW_STOCK':
        return productMetricsList.filter(p => p.stock < 9000).sort((a, b) => a.stock - b.stock).slice(0, itemLimit);
      case 'HIGHEST_STOCK':
        return productMetricsList.filter(p => p.stock < 9000).sort((a, b) => b.stock - a.stock).slice(0, itemLimit);
      case 'EXPIRING_SOON':
        return productMetricsList.filter(p => p.isExpiringSoon || (p.expiryDiffDays && p.expiryDiffDays <= 90)).sort((a, b) => a.expiryDiffDays - b.expiryDiffDays).slice(0, itemLimit);
      case 'MOST_PROFITABLE':
        return [...productMetricsList].sort((a, b) => b.totalProfit - a.totalProfit).slice(0, itemLimit);
      default:
        return [];
    }
  }, [activeRankType, productMetricsList, unsoldProductsList, itemLimit]);

  const modalReportTitle = useMemo(() => {
    switch (activeRankType) {
      case 'ZERO_SALES': 
        return `⛔ Warbixinta Alaabta Aan 1 Xabbana Laga Iibsan (${timeFilter === 'MONTH' ? 'Bishan' : timeFilter === 'TODAY' ? 'Maanta' : timeFilter === 'WEEK' ? 'Toddobaadkan' : 'Kuli'}) - ${unsoldProductsList.length} Alaab`;
      case 'TOP_SOLD': return `${itemLimit}-ka Shey ee Ugu Iibsiga Badan (Top ${itemLimit} Ranked Items)`;
      case 'LEAST_SOLD': return `${itemLimit}-ka Shey ee Ugu Iibsiga Yar (Lowest ${itemLimit} Ranked Items)`;
      case 'FREE_20_PROMO': return `Warbixinta 20-Free & Target Promo (${itemLimit} Items - Halkii 20 Xabo 1 Free)`;
      case 'HIGHEST_REVENUE': return `${itemLimit}-ka Shey ee Ugu Dakhliga Badan (Top ${itemLimit} Highest Revenue)`;
      case 'LOWEST_REVENUE': return `${itemLimit}-ka Shey ee Ugu Dakhliga Yar (Top ${itemLimit} Lowest Revenue)`;
      case 'LOW_STOCK': return `${itemLimit}-ka Shey ee Sii Dhamaanaya (Top ${itemLimit} Running Out Items)`;
      case 'HIGHEST_STOCK': return `${itemLimit}-ka Shey ee Kaydka Ugu Badan (Top ${itemLimit} Highest Stock Items)`;
      case 'EXPIRING_SOON': return `${itemLimit}-ka Shey ee Expire-ka Dhow (Top ${itemLimit} Expiring Soon - 90 Days)`;
      case 'MOST_PROFITABLE': return `${itemLimit}-ka Shey ee Ugu Faa'iidada Badan (Top ${itemLimit} Most Profitable Items)`;
      default: return '';
    }
  }, [activeRankType, itemLimit, timeFilter, unsoldProductsList.length]);

  // Filter and sort main table items
  const filteredMetricsList = useMemo(() => {
    const totalCount = productMetricsList.length;

    const filtered = productMetricsList.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.sku && p.sku.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (p.barcode && p.barcode.toLowerCase().includes(searchQuery.toLowerCase()));

      const matchesCat = selectedCategory === 'ALL' || p.category === selectedCategory;

      let matchesRank = true;
      if (rankFilter === 'TOP_10') {
        matchesRank = p.salesRank <= 10;
      } else if (rankFilter === 'TOP_70') {
        matchesRank = p.salesRank <= 70;
      } else if (rankFilter === 'BOTTOM_70') {
        matchesRank = p.salesRank > (totalCount - 70) || p.qtySold === 0;
      } else if (rankFilter === 'REACHED_20') {
        matchesRank = p.qtySold >= 20;
      } else if (rankFilter === 'UNDER_20') {
        matchesRank = p.qtySold > 0 && p.qtySold < 20;
      } else if (rankFilter === 'ZERO_SALES') {
        matchesRank = p.qtySold === 0;
      }

      return matchesSearch && matchesCat && matchesRank;
    });

    // Apply sorting
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'RANK_BEST':
          return a.salesRank - b.salesRank;
        case 'RANK_WORST':
          return b.salesRank - a.salesRank;
        case 'REVENUE_DESC':
          return b.totalRevenue - a.totalRevenue;
        case 'PROFIT_DESC':
          return b.totalProfit - a.totalProfit;
        case 'STOCK_DESC':
          return b.stock - a.stock;
        case 'PROMO_DESC':
          if (b.free20Earned !== a.free20Earned) return b.free20Earned - a.free20Earned;
          return b.qtySold - a.qtySold;
        default:
          return a.salesRank - b.salesRank;
      }
    });
  }, [productMetricsList, searchQuery, selectedCategory, rankFilter, sortBy]);

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="p-4 md:p-8 space-y-8 max-w-7xl mx-auto">
      
      {/* Printable Header */}
      <div className="hidden print:block text-center border-b pb-4 mb-6">
        <h1 className="text-2xl font-black text-slate-900 uppercase">{data.settings.businessName}</h1>
        <p className="text-sm font-bold text-slate-600">DIIWAANKA & KALA HORREYNTA ALAABTA (ITEM SALES RANKING & 20-FREE PROMO)</p>
        <p className="text-xs text-slate-500 mt-1">Taariikhda: {new Date().toLocaleDateString('so-SO')} | Waqtiga: {new Date().toLocaleTimeString('so-SO')}</p>
      </div>

      {/* Screen Header */}
      <div className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4 bg-slate-900 text-white p-6 md:p-8 rounded-[32px] shadow-2xl relative overflow-hidden">
        <div className="absolute -right-10 -bottom-10 w-60 h-60 bg-blue-600/20 rounded-full blur-3xl pointer-events-none" />
        
        <div className="relative z-10 flex items-center gap-4">
          <div className="w-14 h-14 bg-gradient-to-br from-amber-500 via-orange-500 to-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-amber-500/30">
            <Award size={30} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="px-3 py-0.5 rounded-full bg-amber-400/20 text-amber-300 font-black text-[10px] uppercase tracking-wider border border-amber-400/30 flex items-center gap-1">
                <Sparkles size={11} /> Item Sales Rank Engine (#1 → #{productMetricsList.length})
              </span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black tracking-tight mt-0.5">
              Kala Horreynta Alaabta (Item Sales Ranking)
            </h1>
            <p className="text-slate-400 text-xs font-medium mt-1">
              Halkii shey waxaa loo sameeyay Rank rasmi ah (#1 Best Seller ilaa kan ugu hooseeya) iyo xisaabta 20-Free Promo.
            </p>
          </div>
        </div>

        <div className="relative z-10 flex flex-wrap items-center gap-3">
          
          {/* Limit Selector */}
          <div className="bg-slate-800 px-3 py-1.5 rounded-2xl border border-slate-700 flex items-center gap-2 text-xs">
            <span className="text-slate-400 font-black uppercase text-[10px]">Tirada Sheyga:</span>
            <select
              value={itemLimit}
              onChange={(e) => setItemLimit(Number(e.target.value))}
              className="bg-slate-900 text-white font-black px-2.5 py-1 rounded-xl border border-slate-600 outline-none cursor-pointer focus:ring-1 focus:ring-amber-400"
            >
              <option value={10}>Top 10</option>
              <option value={25}>Top 25</option>
              <option value={50}>Top 50</option>
              <option value={70}>Top 70 (Default)</option>
              <option value={100}>Top 100</option>
              <option value={200}>Top 200</option>
            </select>
          </div>

          {/* Time Filter Pills */}
          <div className="bg-slate-800 p-1 rounded-2xl border border-slate-700 flex items-center gap-1">
            <button
              onClick={() => setTimeFilter('ALL')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${timeFilter === 'ALL' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Kuli (All Time)
            </button>
            <button
              onClick={() => setTimeFilter('TODAY')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${timeFilter === 'TODAY' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Maanta
            </button>
            <button
              onClick={() => setTimeFilter('WEEK')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${timeFilter === 'WEEK' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Toddobaadkan
            </button>
            <button
              onClick={() => setTimeFilter('MONTH')}
              className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all ${timeFilter === 'MONTH' ? 'bg-amber-500 text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'}`}
            >
              Bishan
            </button>
          </div>

          <button
            onClick={handlePrint}
            className="px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-xs rounded-2xl shadow-lg flex items-center gap-2 active:scale-95 transition-all"
          >
            <Printer size={16} />
            <span>Daabac Liiska Ranks</span>
          </button>
        </div>
      </div>

      {/* 20-FREE PROMO & ZERO SALES BANNERS */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        
        {/* Banner 1: ZERO SALES THIS MONTH (ALAABTA AAN 1 XABBANA LAGA IIBSAN) */}
        <div className="bg-gradient-to-r from-rose-950 via-rose-900 to-slate-900 text-white p-6 rounded-[28px] shadow-xl border border-rose-500/30 flex flex-col justify-between gap-4 relative overflow-hidden">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-13 h-13 bg-rose-500 text-white rounded-2xl flex items-center justify-center shadow-lg font-black shrink-0">
                <CalendarX size={28} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-rose-400/20 text-rose-300 border border-rose-400/40 rounded-full font-black text-[10px] uppercase tracking-wider">
                    ⛔ WARBIXINTA {timeFilter === 'MONTH' ? 'BISHAN' : timeFilter === 'TODAY' ? 'MAANTA' : timeFilter === 'WEEK' ? 'TODDOBAADKAN' : 'GUUD'}
                  </span>
                  <span className="text-xs text-rose-200 font-bold">0 Sales / Dead Stock</span>
                </div>
                <h2 className="text-lg sm:text-xl font-black mt-1 text-white">
                  Alaabta Aan 1 Xabbana Laga Iibsan ({timeFilter === 'MONTH' ? 'Bishan' : timeFilter === 'TODAY' ? 'Maanta' : timeFilter === 'WEEK' ? 'Toddobaadkan' : 'Kuli'})
                </h2>
                <p className="text-xs text-rose-200/80 mt-0.5">
                  Tirada alaabta dukaanka taalla ee aan xabbadna laga iibsan mudada la doortay.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-rose-800/40">
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-white/10">
              <span className="text-[9px] font-black text-rose-300 uppercase block">Alaabta Aan Iibsamin</span>
              <span className="text-base sm:text-lg font-black text-white font-mono">{unsoldMetrics.count} / {unsoldMetrics.totalProducts}</span>
              <span className="text-[10px] text-rose-200 font-bold block">({unsoldMetrics.unsoldPercent}% Dukaanka)</span>
            </div>

            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-white/10">
              <span className="text-[9px] font-black text-rose-300 uppercase block">Kaydka Yaalla Khaanadaha</span>
              <span className="text-base sm:text-lg font-black text-rose-100 font-mono">{unsoldMetrics.totalStock.toLocaleString()} PCS</span>
              <span className="text-[10px] text-rose-200 font-bold block">Khaanadaha</span>
            </div>

            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-white/10">
              <span className="text-[9px] font-black text-amber-300 uppercase block">Raasumaalka ku Xaniban</span>
              <span className="text-sm sm:text-base font-black text-amber-300 font-mono">{formatCurrency(unsoldMetrics.totalCostUSD, currency, rate)}</span>
              <span className="text-[9px] text-amber-200 font-bold block font-mono">Cost Value</span>
            </div>

            <button
              onClick={() => setActiveRankType('ZERO_SALES')}
              className="bg-rose-500 hover:bg-rose-400 text-white font-black px-3 py-2.5 rounded-2xl text-xs flex flex-col items-center justify-center gap-0.5 shadow-lg active:scale-95 transition-all uppercase tracking-wider"
            >
              <div className="flex items-center gap-1">
                <span>Arag Warbixinta</span>
                <ChevronRight size={14} />
              </div>
              <span className="text-[9px] font-normal opacity-90">({unsoldMetrics.count} Alaab)</span>
            </button>
          </div>
        </div>

        {/* Banner 2: 20-FREE PROMO & SUMMARY BANNER */}
        <div className="bg-gradient-to-r from-indigo-950 via-blue-900 to-slate-900 text-white p-6 rounded-[28px] shadow-xl border border-indigo-500/30 flex flex-col justify-between gap-4 relative overflow-hidden">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-13 h-13 bg-amber-500 text-slate-950 rounded-2xl flex items-center justify-center shadow-lg font-black shrink-0">
                <Gift size={28} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 bg-amber-400/20 text-amber-300 border border-amber-400/40 rounded-full font-black text-[10px] uppercase tracking-wider">
                    🎁 20-FREE PROMOTION TRACKER
                  </span>
                  <span className="text-xs text-slate-300 font-medium">Halkii 20 xabo = 1 Free Bonus</span>
                </div>
                <h2 className="text-lg sm:text-xl font-black mt-1">
                  Xisaabta Dhiirigelinta & 20-Free
                </h2>
                <p className="text-xs text-slate-300 mt-0.5">
                  Alaabta gaartay ama u dhow bartilmaameedka 20 xabo si loogu xisaabiyo xabbadaha Free-ga ah.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-2 border-t border-indigo-800/40">
            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-white/10">
              <span className="text-[9px] font-black text-amber-300 uppercase block">Alaabta Gaartay 20+</span>
              <span className="text-base sm:text-lg font-black text-white font-mono">{free20QualifiedList.length} Alaab</span>
            </div>

            <div className="bg-white/10 backdrop-blur-md px-3.5 py-2.5 rounded-2xl border border-white/10">
              <span className="text-[9px] font-black text-emerald-300 uppercase block">Wadarta 20-Free Earned</span>
              <span className="text-base sm:text-lg font-black text-emerald-400 font-mono">+{totalFreeUnitsEarned} Xabo</span>
            </div>

            <button
              onClick={() => setActiveRankType('FREE_20_PROMO')}
              className="col-span-2 sm:col-span-1 bg-amber-400 hover:bg-amber-300 text-slate-950 font-black px-3.5 py-2.5 rounded-2xl text-xs flex items-center justify-center gap-1.5 shadow-lg active:scale-95 transition-all uppercase tracking-wider"
            >
              <span>Arag 20-Free</span>
              <ChevronRight size={14} />
            </button>
          </div>
        </div>

      </div>

      {/* 8 MAIN METRIC CARDS GRID (CONFIGURED FOR TOP 70 & LEAST 70) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        
        {/* Card 1: Sheyga Ugu Iibsiga Badan (Top Sold - Rank #1) */}
        <div 
          onClick={() => setActiveRankType('TOP_SOLD')}
          onDoubleClick={() => setActiveRankType('TOP_SOLD')}
          className="bg-gradient-to-br from-amber-50 via-emerald-50 to-teal-50 border-2 border-emerald-300 p-5 rounded-3xl shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-emerald-900 bg-emerald-200/90 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-xs">
              <span className="bg-emerald-800 text-white px-1.5 py-0.5 rounded text-[9px] font-mono font-black">No. 1</span>
              <span>🥇 Top {itemLimit} Ugu Iibsiga Badan</span>
            </span>
            <div className="w-10 h-10 bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
              <TrendingUp size={20} />
            </div>
          </div>
          <h3 className="font-black text-slate-900 text-base mt-3 line-clamp-1">
            {topSoldProduct ? topSoldProduct.name : 'Ma Jiro'}
          </h3>
          <p className="text-xs text-slate-500 font-bold mt-0.5">
            Category: {topSoldProduct?.category || 'N/A'}
          </p>
          <div className="mt-4 pt-3 border-t border-emerald-200/60 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Iibka Xabbadaha:</span>
            <span className="text-lg font-black text-emerald-700 font-mono">
              {topSoldProduct ? `${topSoldProduct.qtySold} ${topSoldProduct.unit || 'PCS'}` : '0 PCS'}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-emerald-800 bg-emerald-100/70 px-2 py-1 rounded-lg">
            <span>20-Free Promo:</span>
            <span className="font-mono font-black">{topSoldProduct ? `${topSoldProduct.free20Earned} Free (+${topSoldProduct.remainderToNext20}/20)` : '0 Free'}</span>
          </div>
          <p className="text-[9px] font-black text-emerald-800 uppercase tracking-wider mt-2 flex items-center gap-1 justify-end">
            <Maximize2 size={10} /> Riix: Arag Dhammaan Ranks-ka Ugu Sarreeya
          </p>
        </div>

        {/* Card 2: Sheyga Ugu Iibsiga Yar & 0 Iib (Least Sold / Dead Stock) */}
        <div 
          onClick={() => setActiveRankType('ZERO_SALES')}
          onDoubleClick={() => setActiveRankType('ZERO_SALES')}
          className="bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50 border-2 border-rose-300 p-5 rounded-3xl shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-900 bg-rose-200/90 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-xs">
              <span className="bg-rose-800 text-white px-1.5 py-0.5 rounded text-[9px] font-mono font-black">No. 2</span>
              <TrendingDown size={12} />
              <span>⛔ 0 Iib ({unsoldMetrics.count} Alaab)</span>
            </span>
            <div className="w-10 h-10 bg-rose-700 text-white rounded-2xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
              <TrendingDown size={20} />
            </div>
          </div>
          <h3 className="font-black text-slate-900 text-base mt-3 line-clamp-1">
            {unsoldMetrics.count} Alaab lama iibsan {timeFilter === 'MONTH' ? 'bishan' : timeFilter === 'TODAY' ? 'maanta' : timeFilter === 'WEEK' ? 'toddobaadkan' : 'wali'}
          </h3>
          <p className="text-xs text-rose-700 font-bold mt-0.5">
            {unsoldMetrics.unsoldPercent}% ee alaabta guud lama taaban
          </p>
          <div className="mt-4 pt-3 border-t border-rose-200/60 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Kaydka Yaalla:</span>
            <span className="text-base font-black text-rose-800 font-mono">
              {unsoldMetrics.totalStock.toLocaleString()} PCS
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between text-[10px] font-bold text-rose-900 bg-rose-100 px-2 py-1 rounded-lg">
            <span>Qiimaha ku Xaniban:</span>
            <span className="font-mono font-black">{formatCurrency(unsoldMetrics.totalCostUSD, currency, rate)}</span>
          </div>
          <p className="text-[9px] font-black text-rose-800 uppercase tracking-wider mt-2 flex items-center gap-1 justify-end">
            <Maximize2 size={10} /> Riix: Arag Liiska Dhameystiran ee {unsoldMetrics.count}-ka Alaab
          </p>
        </div>

        {/* Card 3: Sheyga Ugu Lacagta Badan */}
        <div 
          onClick={() => setActiveRankType('HIGHEST_REVENUE')}
          onDoubleClick={() => setActiveRankType('HIGHEST_REVENUE')}
          className="bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200 p-5 rounded-3xl shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-blue-800 bg-blue-200/80 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-xs">
              <span className="bg-blue-700 text-white px-1.5 py-0.5 rounded text-[9px] font-mono font-black">No. 3</span>
              <Coins size={12} />
              <span>Ugu Dakhliga Badan ({itemLimit})</span>
            </span>
            <div className="w-10 h-10 bg-blue-600 text-white rounded-2xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
              <Coins size={20} />
            </div>
          </div>
          <h3 className="font-black text-slate-900 text-base mt-3 line-clamp-1">
            {highestRevenueProduct ? highestRevenueProduct.name : 'Ma Jiro'}
          </h3>
          <p className="text-xs text-slate-500 font-bold mt-0.5">
            Category: {highestRevenueProduct?.category || 'N/A'} (Rank #{highestRevenueProduct?.salesRank || 'N/A'})
          </p>
          <div className="mt-4 pt-3 border-t border-blue-200/60 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Total Revenue:</span>
            <span className="text-base font-black text-blue-700 font-mono">
              {highestRevenueProduct ? formatCurrency(highestRevenueProduct.totalRevenue, currency, rate) : '$0.00'}
            </span>
          </div>
          <p className="text-[9px] font-black text-blue-800 uppercase tracking-wider mt-2 flex items-center gap-1 justify-end">
            <Maximize2 size={10} /> Riix: Arag Dhammaan {itemLimit}-ka Ugu Dakhliga Badan
          </p>
        </div>

        {/* Card 4: Sheyga Ugu Lacagta Yar */}
        <div 
          onClick={() => setActiveRankType('LOWEST_REVENUE')}
          onDoubleClick={() => setActiveRankType('LOWEST_REVENUE')}
          className="bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-200 p-5 rounded-3xl shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-indigo-800 bg-indigo-200/80 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-xs">
              <span className="bg-indigo-700 text-white px-1.5 py-0.5 rounded text-[9px] font-mono font-black">No. 4</span>
              <DollarSign size={12} />
              <span>Ugu Dakhliga Yar ({itemLimit})</span>
            </span>
            <div className="w-10 h-10 bg-indigo-600 text-white rounded-2xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
              <DollarSign size={20} />
            </div>
          </div>
          <h3 className="font-black text-slate-900 text-base mt-3 line-clamp-1">
            {lowestRevenueProduct ? lowestRevenueProduct.name : 'Ma Jiro'}
          </h3>
          <p className="text-xs text-slate-500 font-bold mt-0.5">
            Category: {lowestRevenueProduct?.category || 'N/A'}
          </p>
          <div className="mt-4 pt-3 border-t border-indigo-200/60 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Total Revenue:</span>
            <span className="text-base font-black text-indigo-700 font-mono">
              {lowestRevenueProduct ? formatCurrency(lowestRevenueProduct.totalRevenue, currency, rate) : '$0.00'}
            </span>
          </div>
          <p className="text-[9px] font-black text-indigo-800 uppercase tracking-wider mt-2 flex items-center gap-1 justify-end">
            <Maximize2 size={10} /> Riix: Arag Dhammaan {itemLimit}-ka Ugu Dakhliga Yar
          </p>
        </div>

        {/* Card 5: Sheyga Sii Dhaman Raba */}
        <div 
          onClick={() => setActiveRankType('LOW_STOCK')}
          onDoubleClick={() => setActiveRankType('LOW_STOCK')}
          className="bg-gradient-to-br from-orange-50 to-amber-50 border-2 border-orange-200 p-5 rounded-3xl shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-orange-900 bg-orange-200/80 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-xs">
              <span className="bg-orange-700 text-white px-1.5 py-0.5 rounded text-[9px] font-mono font-black">No. 5</span>
              <AlertTriangle size={12} />
              <span>Sii Dhamaanaya ({itemLimit})</span>
            </span>
            <div className="w-10 h-10 bg-orange-600 text-white rounded-2xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
              <AlertTriangle size={20} />
            </div>
          </div>
          <h3 className="font-black text-slate-900 text-base mt-3">
            {lowStockProducts.length} Alaab ayaa sii dhamaanaysa
          </h3>
          <p className="text-xs text-slate-500 font-bold mt-0.5 line-clamp-1">
            Top: {lowStockProducts[0] ? `${lowStockProducts[0].name} (${lowStockProducts[0].stock} left)` : 'None'}
          </p>
          <div className="mt-4 pt-3 border-t border-orange-200/60 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Count Low Stock:</span>
            <span className="text-lg font-black text-orange-700 font-mono">
              {lowStockProducts.length} Items
            </span>
          </div>
          <p className="text-[9px] font-black text-orange-800 uppercase tracking-wider mt-2 flex items-center gap-1 justify-end">
            <Maximize2 size={10} /> Riix: Arag Dhammaan {itemLimit}-ka Sii Dhamaanaya
          </p>
        </div>

        {/* Card 6: Sheyga Ugu Badan Stock */}
        <div 
          onClick={() => setActiveRankType('HIGHEST_STOCK')}
          onDoubleClick={() => setActiveRankType('HIGHEST_STOCK')}
          className="bg-gradient-to-br from-teal-50 to-emerald-50 border-2 border-teal-200 p-5 rounded-3xl shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-teal-900 bg-teal-200/80 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-xs">
              <span className="bg-teal-700 text-white px-1.5 py-0.5 rounded text-[9px] font-mono font-black">No. 6</span>
              <Package size={12} />
              <span>Kaydka Ugu Badan ({itemLimit})</span>
            </span>
            <div className="w-10 h-10 bg-teal-600 text-white rounded-2xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
              <Package size={20} />
            </div>
          </div>
          <h3 className="font-black text-slate-900 text-base mt-3 line-clamp-1">
            {highestStockProduct ? highestStockProduct.name : 'Ma Jiro'}
          </h3>
          <p className="text-xs text-slate-500 font-bold mt-0.5">
            Category: {highestStockProduct?.category || 'N/A'}
          </p>
          <div className="mt-4 pt-3 border-t border-teal-200/60 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Tirada Yaalla:</span>
            <span className="text-lg font-black text-teal-700 font-mono">
              {highestStockProduct ? `${highestStockProduct.stock} ${highestStockProduct.unit || 'PCS'}` : '0 PCS'}
            </span>
          </div>
          <p className="text-[9px] font-black text-teal-800 uppercase tracking-wider mt-2 flex items-center gap-1 justify-end">
            <Maximize2 size={10} /> Riix: Arag Dhammaan {itemLimit}-ka Kaydka Ugu Badan
          </p>
        </div>

        {/* Card 7: Sheyga Expire Dhow */}
        <div 
          onClick={() => setActiveRankType('EXPIRING_SOON')}
          onDoubleClick={() => setActiveRankType('EXPIRING_SOON')}
          className="bg-gradient-to-br from-rose-50 to-pink-50 border-2 border-rose-200 p-5 rounded-3xl shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-rose-900 bg-rose-200/80 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-xs">
              <span className="bg-rose-700 text-white px-1.5 py-0.5 rounded text-[9px] font-mono font-black">No. 7</span>
              <CalendarX size={12} />
              <span>Expire Dhow (90 Maalmood)</span>
            </span>
            <div className="w-10 h-10 bg-rose-600 text-white rounded-2xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
              <CalendarX size={20} />
            </div>
          </div>
          <h3 className="font-black text-slate-900 text-base mt-3 line-clamp-1">
            {expiringSoonProducts.length} Alaab ayaa taariikhdu dhowdahay
          </h3>
          <p className="text-xs text-slate-600 font-bold mt-0.5 line-clamp-1">
            Ugu dhow: {expiringSoonProducts[0] ? `${expiringSoonProducts[0].name}` : 'Ma jiro'}
          </p>
          <div className="mt-4 pt-3 border-t border-rose-200/60 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Expiring Items:</span>
            <span className="text-lg font-black text-rose-700 font-mono">
              {expiringSoonProducts.length} Items
            </span>
          </div>
          <p className="text-[9px] font-black text-rose-800 uppercase tracking-wider mt-2 flex items-center gap-1 justify-end">
            <Maximize2 size={10} /> Riix: Arag Dhammaan {itemLimit}-ka Expire-ka Dhow
          </p>
        </div>

        {/* Card 8: Ugu Faa'iidada Badan */}
        <div 
          onClick={() => setActiveRankType('MOST_PROFITABLE')}
          onDoubleClick={() => setActiveRankType('MOST_PROFITABLE')}
          className="bg-gradient-to-br from-amber-50 to-yellow-50 border-2 border-amber-200 p-5 rounded-3xl shadow-sm hover:shadow-md transition-all cursor-pointer relative overflow-hidden group"
        >
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black uppercase tracking-wider text-amber-900 bg-amber-200/80 px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-xs">
              <span className="bg-amber-700 text-white px-1.5 py-0.5 rounded text-[9px] font-mono font-black">No. 8</span>
              <Award size={12} />
              <span>Ugu Faa'iidada Badan ({itemLimit})</span>
            </span>
            <div className="w-10 h-10 bg-amber-600 text-white rounded-2xl flex items-center justify-center shadow-md group-hover:scale-110 transition-transform">
              <Award size={20} />
            </div>
          </div>
          <h3 className="font-black text-slate-900 text-base mt-3 line-clamp-1">
            {mostProfitableProduct ? mostProfitableProduct.name : 'Ma Jiro'}
          </h3>
          <p className="text-xs text-slate-500 font-bold mt-0.5">
            Category: {mostProfitableProduct?.category || 'N/A'} (Rank #{mostProfitableProduct?.salesRank || 'N/A'})
          </p>
          <div className="mt-4 pt-3 border-t border-amber-200/60 flex items-center justify-between">
            <span className="text-xs font-bold text-slate-600">Total Profit:</span>
            <span className="text-lg font-black text-amber-800 font-mono">
              {mostProfitableProduct ? formatCurrency(mostProfitableProduct.totalProfit, currency, rate) : '$0.00'}
            </span>
          </div>
          <p className="text-[9px] font-black text-amber-900 uppercase tracking-wider mt-2 flex items-center gap-1 justify-end">
            <Maximize2 size={10} /> Riix: Arag Dhammaan {itemLimit}-ka Ugu Faa'iidada Badan
          </p>
        </div>

      </div>

      {/* DETAILED RANKING & PRODUCT ANALYTICS TABLE */}
      <div className="bg-white rounded-[32px] border border-slate-200/80 shadow-xl overflow-hidden space-y-4 p-6">
        
        {/* Table Filter Controls */}
        <div className="no-print flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-amber-100 text-amber-800 rounded-2xl flex items-center justify-center font-black shadow-sm">
              <Award size={22} />
            </div>
            <div>
              <h2 className="font-black text-slate-900 text-base uppercase tracking-tight flex items-center gap-2">
                <span>Diiwaanka Ranks-ka Alaabta & 20-Free</span>
                <span className="text-xs px-2.5 py-0.5 bg-amber-100 text-amber-900 rounded-full font-mono font-bold">
                  {filteredMetricsList.length} of {productMetricsList.length} Alaab
                </span>
              </h2>
              <p className="text-xs text-slate-500 font-medium">
                Alaab kasta waxay leedahay Rank gaar ah (#1 Best Seller ilaa #{productMetricsList.length}) oo ku salaysan iibka.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            
            {/* Sorting Order Selector */}
            <div className="flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-2xl border border-slate-200 text-xs">
              <ArrowUpDown size={14} className="text-slate-500" />
              <span className="text-slate-500 font-bold text-[11px]">Kala Horree:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SalesSortOrder)}
                className="bg-white border border-slate-300 font-black px-2 py-1 rounded-xl text-slate-800 outline-none text-xs"
              >
                <option value="RANK_BEST">🏆 Rank: Ugu Iibsiga Badan (#1 → Dambe)</option>
                <option value="RANK_WORST">📉 Rank: Ugu Iibsiga Yar (Hoos → #1)</option>
                <option value="REVENUE_DESC">💰 Dakhliga Ugu Badan (Revenue Desc)</option>
                <option value="PROFIT_DESC">📈 Faa'iidada Ugu Badan (Profit Desc)</option>
                <option value="STOCK_DESC">📦 Kaydka Ugu Badan (Stock Desc)</option>
                <option value="PROMO_DESC">🎁 20-Free Ugu Badan (Promo Desc)</option>
              </select>
            </div>

            {/* Search Input */}
            <div className="relative flex-1 sm:w-56">
              <Search size={16} className="absolute left-3.5 top-3 text-slate-400" />
              <input
                type="text"
                placeholder="Search magac, barcode, SKU..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-amber-500"
              />
            </div>

            {/* Category Select */}
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="px-3.5 py-2 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold text-slate-700 outline-none"
            >
              <option value="ALL">All Categories ({categories.length})</option>
              {categories.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Quick Rank Filter Tabs */}
        <div className="no-print flex flex-wrap items-center gap-1.5 bg-slate-50 p-2 rounded-2xl border border-slate-200 text-xs">
          <button
            onClick={() => setRankFilter('ALL')}
            className={`px-3 py-1.5 rounded-xl font-black transition-all ${rankFilter === 'ALL' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
          >
            🌟 Dhammaan Ranks ({productMetricsList.length})
          </button>
          <button
            onClick={() => setRankFilter('ZERO_SALES')}
            className={`px-3 py-1.5 rounded-xl font-black transition-all ${rankFilter === 'ZERO_SALES' ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-400' : 'bg-rose-100 text-rose-800 hover:bg-rose-200'}`}
          >
            ⛔ {timeFilter === 'MONTH' ? 'Bishan' : timeFilter === 'TODAY' ? 'Maanta' : timeFilter === 'WEEK' ? 'Toddobaadkan' : 'Guud'}: 0 Iib / Aan La Iibsan ({unsoldMetrics.count})
          </button>
          <button
            onClick={() => setRankFilter('TOP_10')}
            className={`px-3 py-1.5 rounded-xl font-black transition-all ${rankFilter === 'TOP_10' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-amber-800 hover:bg-amber-100/60'}`}
          >
            🥇 Top 10 Ranks
          </button>
          <button
            onClick={() => setRankFilter('TOP_70')}
            className={`px-3 py-1.5 rounded-xl font-black transition-all ${rankFilter === 'TOP_70' ? 'bg-emerald-600 text-white shadow-sm' : 'text-emerald-800 hover:bg-emerald-100/60'}`}
          >
            ⭐ Top 70 Ranks
          </button>
          <button
            onClick={() => setRankFilter('BOTTOM_70')}
            className={`px-3 py-1.5 rounded-xl font-black transition-all ${rankFilter === 'BOTTOM_70' ? 'bg-slate-700 text-white shadow-sm' : 'text-slate-600 hover:bg-slate-200'}`}
          >
            📉 70-ka Ugu Hooseeya
          </button>
          <button
            onClick={() => setRankFilter('REACHED_20')}
            className={`px-3 py-1.5 rounded-xl font-black transition-all ${rankFilter === 'REACHED_20' ? 'bg-indigo-600 text-white shadow-sm' : 'text-indigo-800 hover:bg-indigo-100/60'}`}
          >
            🎁 Gaaray 20+ Free ({free20QualifiedList.length})
          </button>
          <button
            onClick={() => setRankFilter('UNDER_20')}
            className={`px-3 py-1.5 rounded-xl font-black transition-all ${rankFilter === 'UNDER_20' ? 'bg-blue-600 text-white shadow-sm' : 'text-blue-800 hover:bg-blue-100/60'}`}
          >
            ⏳ Ka Yar 20 (Target)
          </button>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center w-16">No.</th>
                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">Rank (#)</th>
                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-wider">Product Name & Category</th>
                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">Tirada La Iibiyay</th>
                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">🎁 20-Free Promo Status</th>
                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">Wadarta Dakhliga</th>
                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">Faa'iidada (Profit)</th>
                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-wider text-center">Kaydka Yaalla</th>
                <th className="p-4 text-[10px] font-black text-slate-500 uppercase tracking-wider text-right">Darajada Iibka (Rank Tier)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-bold text-xs">
              {filteredMetricsList.length === 0 ? (
                <tr>
                  <td colSpan={9} className="p-8 text-center text-slate-400">
                    Ma jiro alaab noocan ah oo la helay.
                  </td>
                </tr>
              ) : (
                filteredMetricsList.map((item, index) => {
                  const rank = item.salesRank;
                  
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                      
                      {/* Column 0: Row Index Number (No.) */}
                      <td className="p-4 text-center">
                        <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 font-mono font-black text-xs rounded-lg border border-slate-200 shadow-2xs">
                          No. {index + 1}
                        </span>
                      </td>

                      {/* Column 1: Sales Rank Badge */}
                      <td className="p-4 text-center">
                        <div className="flex items-center justify-center">
                          {rank === 1 ? (
                            <span className="px-3 py-1 bg-gradient-to-r from-amber-400 to-yellow-500 text-slate-950 font-black text-xs rounded-xl shadow-md flex items-center gap-1">
                              🥇 #1
                            </span>
                          ) : rank === 2 ? (
                            <span className="px-3 py-1 bg-slate-300 text-slate-900 font-black text-xs rounded-xl shadow-xs flex items-center gap-1">
                              🥈 #2
                            </span>
                          ) : rank === 3 ? (
                            <span className="px-3 py-1 bg-amber-700 text-white font-black text-xs rounded-xl shadow-xs flex items-center gap-1">
                              🥉 #3
                            </span>
                          ) : rank <= 10 ? (
                            <span className="px-2.5 py-1 bg-emerald-100 text-emerald-900 border border-emerald-300 font-black text-xs rounded-xl font-mono">
                              #{rank}
                            </span>
                          ) : rank <= 70 ? (
                            <span className="px-2.5 py-1 bg-blue-50 text-blue-900 border border-blue-200 font-black text-xs rounded-xl font-mono">
                              #{rank}
                            </span>
                          ) : item.qtySold === 0 ? (
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-400 font-black text-xs rounded-xl font-mono">
                              #{rank}
                            </span>
                          ) : (
                            <span className="px-2.5 py-1 bg-slate-100 text-slate-700 font-black text-xs rounded-xl font-mono">
                              #{rank}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Column 2: Product Name & Category */}
                      <td className="p-4">
                        <div className="space-y-0.5">
                          <p className="font-black text-slate-900 text-sm flex items-center gap-1.5">
                            {item.name}
                            {rank === 1 && <span className="text-amber-500 text-[10px]">👑</span>}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded">
                              {item.category}
                            </span>
                            {item.barcode && <span className="text-[10px] text-slate-400 font-mono">BC: {item.barcode}</span>}
                          </div>
                        </div>
                      </td>
                      
                      {/* Column 3: Qty Sold & Sales Meter */}
                      <td className="p-4 text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`px-3 py-1 rounded-full text-xs font-black font-mono ${item.qtySold > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'}`}>
                            {item.qtySold} {item.unit || 'PCS'}
                          </span>
                          {item.qtySold > 0 && (
                            <span className="text-[9px] text-slate-400 font-mono">
                              {item.salesPercentOfTop}% of #1 Seller
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Column 4: 20-Free Promo Status */}
                      <td className="p-4 text-center">
                        <div className="flex flex-col items-center gap-1 max-w-[140px] mx-auto">
                          {item.hasReached20 ? (
                            <span className="px-2.5 py-0.5 bg-amber-100 text-amber-900 border border-amber-300 rounded-lg text-[10px] font-black flex items-center gap-1">
                              <Gift size={11} className="text-amber-700" />
                              <span>{item.free20Earned} Xabo Free (+{item.remainderToNext20}/20)</span>
                            </span>
                          ) : item.qtySold > 0 ? (
                            <span className="px-2.5 py-0.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg text-[10px] font-bold">
                              {item.qtySold}/20 ({20 - item.qtySold} dhiman)
                            </span>
                          ) : (
                            <span className="text-slate-400 text-[10px] font-medium">0/20 Free</span>
                          )}

                          {/* Progress bar towards 20 free */}
                          {item.qtySold > 0 && (
                            <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                              <div 
                                className={`h-full rounded-full ${item.hasReached20 ? 'bg-amber-500' : 'bg-blue-500'}`}
                                style={{ width: `${item.progressPercent}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Column 5: Total Revenue */}
                      <td className="p-4 text-center font-mono font-black text-slate-900">
                        {formatCurrency(item.totalRevenue, currency, rate)}
                      </td>

                      {/* Column 6: Total Profit */}
                      <td className="p-4 text-center font-mono font-black text-emerald-600">
                        {formatCurrency(item.totalProfit, currency, rate)}
                      </td>

                      {/* Column 7: Stock */}
                      <td className="p-4 text-center">
                        <span className={`px-3 py-1 rounded-full text-xs font-black font-mono ${item.isLowStock ? 'bg-orange-100 text-orange-800 animate-pulse' : 'bg-slate-100 text-slate-800'}`}>
                          {item.stock} {item.unit || 'PCS'}
                        </span>
                      </td>

                      {/* Column 8: Rank Tier Tag */}
                      <td className="p-4 text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          {rank === 1 && (
                            <span className="px-2.5 py-0.5 bg-amber-500 text-slate-950 text-[9px] font-black rounded uppercase shadow-xs flex items-center gap-1">
                              🏆 Ugu Iibsiga Badan
                            </span>
                          )}
                          {rank > 1 && rank <= 10 && (
                            <span className="px-2 py-0.5 bg-emerald-600 text-white text-[9px] font-black rounded uppercase shadow-xs flex items-center gap-1">
                              🔥 Top 10 Seller
                            </span>
                          )}
                          {rank > 10 && rank <= 70 && (
                            <span className="px-2 py-0.5 bg-blue-600 text-white text-[9px] font-black rounded uppercase shadow-xs flex items-center gap-1">
                              ⭐ Top 70 Seller
                            </span>
                          )}
                          {item.qtySold === 0 && (
                            <span className="px-2 py-0.5 bg-slate-700 text-white text-[9px] font-black rounded uppercase shadow-xs">
                              ⛔ 0 Iib (Yar)
                            </span>
                          )}
                          {item.hasReached20 && (
                            <span className="px-2 py-0.5 bg-amber-400 text-slate-950 text-[9px] font-black rounded uppercase shadow-xs flex items-center gap-0.5">
                              🎁 20-Free
                            </span>
                          )}
                          {item.isLowStock && (
                            <span className="px-2 py-0.5 bg-orange-500 text-white text-[9px] font-black rounded uppercase shadow-xs">
                              ⚠️ Sii Dhamaanaya
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Printable Footer Stamp */}
        <div className="hidden print:block pt-8 border-t border-slate-300 mt-8">
          <div className="flex justify-between items-end text-xs font-bold text-slate-700">
            <div>
              <p>Maamulaha Dukaanka: ________________________</p>
              <p className="mt-1">Saxiixa & Shaabad: ________________________</p>
            </div>
            <div className="text-right">
              <p>Nidaamka Maamulka: {data.settings.businessName}</p>
              <p className="mt-1">Printed via Ultimate ERP POS Master</p>
            </div>
          </div>
        </div>

      </div>

      {/* EXPANDED RANKING MODAL (TOP 70 / LEAST 70 / 20-FREE FULL LIST) */}
      {activeRankType && (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-[32px] w-full max-w-5xl max-h-[92vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200">
            
            {/* Modal Header */}
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-amber-500 text-slate-950 rounded-2xl flex items-center justify-center shadow-lg font-black">
                  <Award size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-black">{modalReportTitle}</h2>
                  <p className="text-xs text-slate-400 font-medium">
                    Shaxda Rasmiga ah ee {modalRankData.length} shey oo kala saaran iibka, dakhliga iyo xisaabta 20-Free
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={() => window.print()}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl transition-colors no-print"
                  title="Print Report"
                >
                  <Printer size={18} />
                </button>
                <button
                  onClick={() => setActiveRankType(null)}
                  className="p-2.5 bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white rounded-xl transition-colors no-print"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Modal Quick Filter / Switcher Bar */}
            <div className="p-4 bg-slate-100/80 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  onClick={() => setActiveRankType('ZERO_SALES')}
                  className={`px-3 py-1.5 rounded-xl font-black transition-all ${activeRankType === 'ZERO_SALES' ? 'bg-rose-600 text-white shadow-sm ring-2 ring-rose-400' : 'bg-rose-100 text-rose-800 hover:bg-rose-200'}`}
                >
                  ⛔ 0 Iib / Aan La Iibsan ({unsoldMetrics.count})
                </button>
                <button
                  onClick={() => setActiveRankType('TOP_SOLD')}
                  className={`px-3 py-1.5 rounded-xl font-black transition-all ${activeRankType === 'TOP_SOLD' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-200'}`}
                >
                  🏆 Top {itemLimit} Ugu Iibsiga Badan
                </button>
                <button
                  onClick={() => setActiveRankType('LEAST_SOLD')}
                  className={`px-3 py-1.5 rounded-xl font-black transition-all ${activeRankType === 'LEAST_SOLD' ? 'bg-slate-800 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-200'}`}
                >
                  📉 Top {itemLimit} Ugu Iibsiga Yar
                </button>
                <button
                  onClick={() => setActiveRankType('FREE_20_PROMO')}
                  className={`px-3 py-1.5 rounded-xl font-black transition-all ${activeRankType === 'FREE_20_PROMO' ? 'bg-indigo-600 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-200'}`}
                >
                  🎁 20-Free Promo Tracker
                </button>
                <button
                  onClick={() => setActiveRankType('HIGHEST_REVENUE')}
                  className={`px-3 py-1.5 rounded-xl font-black transition-all ${activeRankType === 'HIGHEST_REVENUE' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-700 hover:bg-slate-200'}`}
                >
                  💰 Ugu Dakhliga Badan
                </button>
              </div>

              {activeRankType !== 'ZERO_SALES' && (
                <div className="flex items-center gap-2">
                  <span className="text-slate-500 font-bold text-[11px]">Tirada (Limit):</span>
                  <select
                    value={itemLimit}
                    onChange={(e) => setItemLimit(Number(e.target.value))}
                    className="bg-white border border-slate-300 font-black px-2.5 py-1 rounded-xl text-slate-800 outline-none"
                  >
                    <option value={10}>10 Items</option>
                    <option value={25}>25 Items</option>
                    <option value={50}>50 Items</option>
                    <option value={70}>70 Items</option>
                    <option value={100}>100 Items</option>
                  </select>
                </div>
              )}
            </div>

            {/* If ZERO_SALES, show summary banner inside modal */}
            {activeRankType === 'ZERO_SALES' && (
              <div className="bg-rose-50 border-b border-rose-200 p-4 flex flex-wrap items-center justify-between gap-4 text-xs">
                <div className="flex items-center gap-3">
                  <span className="px-3 py-1 bg-rose-600 text-white rounded-xl font-black text-xs">
                    {unsoldMetrics.count} Alaab oo 0 Iib ah
                  </span>
                  <span className="text-slate-700 font-bold">
                    Kaydka Yaalla: <strong className="text-rose-800 font-mono">{unsoldMetrics.totalStock.toLocaleString()} PCS</strong>
                  </span>
                  <span className="text-slate-700 font-bold">
                    Raasumaalka ku Xaniban: <strong className="text-amber-800 font-mono">{formatCurrency(unsoldMetrics.totalCostUSD, currency, rate)}</strong>
                  </span>
                </div>
                <div className="text-slate-500 text-[11px] font-medium">
                  Mudada: <strong className="text-slate-800">{timeFilter === 'MONTH' ? 'Bishan (This Month)' : timeFilter === 'TODAY' ? 'Maanta' : timeFilter === 'WEEK' ? 'Toddobaadkan' : 'Dhammaan'}</strong>
                </div>
              </div>
            )}

            {/* Modal Table Content */}
            <div className="flex-1 overflow-y-auto p-6">
              <table className="w-full text-left border-collapse">
                <thead>
                  {activeRankType === 'ZERO_SALES' ? (
                    <tr className="bg-rose-100/70 border-b border-rose-200 text-[10px] font-black text-rose-950 uppercase tracking-wider">
                      <th className="p-4 text-center w-16">No.</th>
                      <th className="p-4">Product Name & Category</th>
                      <th className="p-4 text-center">Barcode / SKU</th>
                      <th className="p-4 text-center">Kaydka Yaalla</th>
                      <th className="p-4 text-center">Qiimaha Jooga (Cost)</th>
                      <th className="p-4 text-center">Qiimaha Iibka (Sell)</th>
                      <th className="p-4 text-center">Raasumaalka ku Xaniban</th>
                      <th className="p-4 text-center">Iibkii u Dambeeyay</th>
                      <th className="p-4 text-center">Status</th>
                    </tr>
                  ) : (
                    <tr className="bg-slate-50 border-b border-slate-200 text-[10px] font-black text-slate-500 uppercase tracking-wider">
                      <th className="p-4 text-center w-16">No.</th>
                      <th className="p-4 text-center">Rank (#)</th>
                      <th className="p-4">Product Name & Category</th>
                      <th className="p-4 text-center">Tirada La Iibiyay</th>
                      <th className="p-4 text-center">🎁 20-Free Calculation</th>
                      <th className="p-4 text-center">Wadarta Dakhliga</th>
                      <th className="p-4 text-center">Faa'iidada (Profit)</th>
                      <th className="p-4 text-center">Kaydka Hadda</th>
                      <th className="p-4 text-center">Expiry</th>
                    </tr>
                  )}
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold text-xs">
                  {modalRankData.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-slate-400">
                        Ma jiro alaab lagu hayo diiwaankan.
                      </td>
                    </tr>
                  ) : (
                    modalRankData.map((item, index) => {
                      if (activeRankType === 'ZERO_SALES') {
                        const stockQty = item.stock < 9000 ? item.stock : 0;
                        const tiedCapitalUSD = stockQty * (item.unitCost || 0);
                        const lastSoldTimeStr = item.allTimeLastSold 
                          ? new Date(item.allTimeLastSold).toLocaleDateString('so-SO', { day: '2-digit', month: 'short', year: 'numeric' })
                          : 'Waligeed lama iibin';

                        return (
                          <tr key={item.id} className="hover:bg-rose-50/50 transition-colors">
                            <td className="p-4 text-center">
                              <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 font-mono font-black text-xs rounded-lg border border-slate-200">
                                No. {index + 1}
                              </span>
                            </td>
                            <td className="p-4">
                              <p className="font-black text-slate-900 text-sm">{item.name}</p>
                              <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded font-bold">{item.category}</span>
                            </td>
                            <td className="p-4 text-center font-mono text-slate-500 text-xs">
                              {item.barcode || item.sku || 'N/A'}
                            </td>
                            <td className="p-4 text-center">
                              <span className="px-3 py-1 bg-slate-100 text-slate-800 rounded-full font-mono font-black text-xs">
                                {stockQty} {item.unit || 'PCS'}
                              </span>
                            </td>
                            <td className="p-4 text-center font-mono text-slate-700">
                              {formatCurrency(item.unitCost || 0, currency, rate)}
                            </td>
                            <td className="p-4 text-center font-mono text-emerald-600">
                              {formatCurrency(item.unitPrice || 0, currency, rate)}
                            </td>
                            <td className="p-4 text-center font-mono font-black text-rose-700 bg-rose-50/70">
                              {formatCurrency(tiedCapitalUSD, currency, rate)}
                            </td>
                            <td className="p-4 text-center font-mono text-xs text-slate-500">
                              <span className={`px-2 py-1 rounded-lg text-[10px] font-bold ${item.allTimeLastSold ? 'bg-slate-100 text-slate-700' : 'bg-amber-100 text-amber-900'}`}>
                                {lastSoldTimeStr}
                              </span>
                            </td>
                            <td className="p-4 text-center">
                              <span className="px-2.5 py-1 bg-rose-600 text-white text-[9px] font-black rounded-lg uppercase shadow-xs">
                                ⛔ 0 Iib
                              </span>
                            </td>
                          </tr>
                        );
                      }

                      return (
                        <tr key={item.id} className="hover:bg-slate-50 transition-colors">
                          <td className="p-4 text-center">
                            <span className="inline-block px-2.5 py-1 bg-slate-100 text-slate-700 font-mono font-black text-xs rounded-lg border border-slate-200">
                              No. {index + 1}
                            </span>
                          </td>
                          <td className="p-4 text-center">
                            <span className={`w-8 h-8 rounded-full flex items-center justify-center font-black text-xs font-mono mx-auto ${
                              item.salesRank === 1 ? 'bg-amber-400 text-amber-950 shadow-md' :
                              item.salesRank === 2 ? 'bg-slate-300 text-slate-800' :
                              item.salesRank === 3 ? 'bg-amber-700 text-white' :
                              item.salesRank <= 10 ? 'bg-emerald-100 text-emerald-900 border border-emerald-300' :
                              'bg-slate-100 text-slate-600'
                            }`}>
                              #{item.salesRank}
                            </span>
                          </td>
                          <td className="p-4">
                            <p className="font-black text-slate-900 text-sm">{item.name}</p>
                            <span className="text-[10px] text-slate-400">{item.category}</span>
                          </td>
                          <td className="p-4 text-center font-mono font-black text-slate-800">
                            {item.qtySold} {item.unit || 'PCS'}
                          </td>
                          <td className="p-4 text-center">
                            {item.hasReached20 ? (
                              <span className="px-2.5 py-1 bg-amber-100 text-amber-950 font-black text-[11px] rounded-lg border border-amber-300 inline-flex items-center gap-1">
                                <Gift size={12} className="text-amber-700" />
                                <span>{item.free20Earned} Free (+{item.remainderToNext20}/20)</span>
                              </span>
                            ) : (
                              <span className="text-slate-500 font-mono text-xs">
                                {item.qtySold}/20 ({20 - item.qtySold} to free)
                              </span>
                            )}
                          </td>
                          <td className="p-4 text-center font-mono font-black text-blue-600">
                            {formatCurrency(item.totalRevenue, currency, rate)}
                          </td>
                          <td className="p-4 text-center font-mono font-black text-emerald-600">
                            {formatCurrency(item.totalProfit, currency, rate)}
                          </td>
                          <td className="p-4 text-center font-mono font-black text-slate-700">
                            {item.stock} {item.unit || 'PCS'}
                          </td>
                          <td className="p-4 text-center text-slate-500 font-mono text-[11px]">
                            {item.expiryDate || 'N/A'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Modal Footer */}
            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              <p className="text-xs text-slate-500 font-medium">
                💡 Waxaad dooran kartaa tirada (10, 25, 50, 70, 100) ama daabacan kartaa warbixintan adoo riixaya calaamadda Printer-ka.
              </p>
              <button
                onClick={() => setActiveRankType(null)}
                className="px-6 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-black text-xs uppercase shadow-md"
              >
                Ka xir (Close)
              </button>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};

export default ItemReports;
