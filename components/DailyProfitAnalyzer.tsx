import React, { useState, useMemo } from 'react';
import { AppData, Currency } from '../types';
import { formatCurrency } from '../lib/utils';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Cell,
  CartesianGrid,
  AreaChart,
  Area
} from 'recharts';
import {
  TrendingUp,
  Calendar,
  Award,
  CalendarRange,
  ArrowUpRight,
  Sparkles,
  BarChart3,
  Layers,
  Percent,
  DollarSign
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

// Helper to format consistent local YYYY-MM-DD
const getLocalDateKey = (ts: Date | number): string => {
  const d = typeof ts === 'number' ? new Date(ts) : ts;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

export const DailyProfitAnalyzer: React.FC<Props> = ({ data, currency }) => {
  const rate = data.settings?.exchangeRate || 1;
  const [rangeType, setRangeType] = useState<'7' | '14' | '30' | 'month' | 'custom'>('7');
  const [chartType, setChartType] = useState<'bar' | 'area'>('bar');
  
  // Custom date range state (defaults to last 7 days in local time)
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 6);
    return getLocalDateKey(d);
  });
  const [endDate, setEndDate] = useState(() => {
    return getLocalDateKey(new Date());
  });

  const [selectedDayDetail, setSelectedDayDetail] = useState<any | null>(null);

  // Filter and aggregate profit per day
  const dailyData = useMemo(() => {
    let startTimestamp = 0;
    let endTimestamp = Date.now();

    const now = new Date();
    if (rangeType === '7') {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6, 0, 0, 0, 0);
      startTimestamp = d.getTime();
      endTimestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    } else if (rangeType === '14') {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 13, 0, 0, 0, 0);
      startTimestamp = d.getTime();
      endTimestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    } else if (rangeType === '30') {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 29, 0, 0, 0, 0);
      startTimestamp = d.getTime();
      endTimestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    } else if (rangeType === 'month') {
      const d = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
      startTimestamp = d.getTime();
      endTimestamp = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999).getTime();
    } else if (rangeType === 'custom') {
      if (startDate) {
        const parts = startDate.split('-').map(Number);
        const s = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
        startTimestamp = s.getTime();
      }
      if (endDate) {
        const parts = endDate.split('-').map(Number);
        const e = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
        endTimestamp = e.getTime();
      }
    }

    // Prepare map of all days in range
    const daysMap: Record<string, {
      dateStr: string;
      fullDateStr: string;
      dayIndex: number;
      dayNameSomali: string;
      revenue: number;
      cost: number;
      expenses: number;
      profit: number;
      txCount: number;
      timestamp: number;
    }> = {};

    // Initialize consecutive days in timeline using local time
    const cur = new Date(startTimestamp);
    const endBoundary = new Date(endTimestamp);
    let safetyCounter = 0;
    while (cur.getTime() <= endBoundary.getTime() && safetyCounter < 120) {
      const localKey = getLocalDateKey(cur);
      const dayIdx = cur.getDay();
      const somaliName = SOMALI_DAYS[dayIdx];
      const displayLabel = `${somaliName} (${cur.toLocaleDateString('so-SO', { month: 'short', day: 'numeric' })})`;

      daysMap[localKey] = {
        dateStr: localKey,
        fullDateStr: displayLabel,
        dayIndex: dayIdx,
        dayNameSomali: somaliName,
        revenue: 0,
        cost: 0,
        expenses: 0,
        profit: 0,
        txCount: 0,
        timestamp: cur.getTime()
      };

      cur.setDate(cur.getDate() + 1);
      safetyCounter++;
    }

    // 1. Sales Transactions (Exact matching with local date)
    const salesTx = (data.transactions || []).filter(t => 
      t.timestamp >= startTimestamp && 
      t.timestamp <= endTimestamp &&
      (t.type === 'SALE' || (!t.type && !t.supplierId))
    );

    salesTx.forEach(tx => {
      const localKey = getLocalDateKey(tx.timestamp);
      if (!daysMap[localKey]) {
        const d = new Date(tx.timestamp);
        const dayIdx = d.getDay();
        const somaliName = SOMALI_DAYS[dayIdx];
        daysMap[localKey] = {
          dateStr: localKey,
          fullDateStr: `${somaliName} (${d.toLocaleDateString('so-SO', { month: 'short', day: 'numeric' })})`,
          dayIndex: dayIdx,
          dayNameSomali: somaliName,
          revenue: 0,
          cost: 0,
          expenses: 0,
          profit: 0,
          txCount: 0,
          timestamp: tx.timestamp
        };
      }
      const dayRecord = daysMap[localKey];
      dayRecord.revenue += (tx.total || 0);
      dayRecord.txCount += 1;
      const txCost = (tx.items || []).reduce((acc, item) => acc + ((item.costPrice || 0) * (item.quantity || 1)), 0);
      dayRecord.cost += txCost;
      dayRecord.profit += ((tx.total || 0) - txCost);
    });

    // 2. Deduct Store Expenses per day for Net Profit
    (data.expenses || []).forEach(exp => {
      const expTime = exp.timestamp || 0;
      if (expTime >= startTimestamp && expTime <= endTimestamp) {
        const localKey = getLocalDateKey(expTime);
        if (daysMap[localKey]) {
          daysMap[localKey].expenses += (exp.amount || 0);
          daysMap[localKey].profit -= (exp.amount || 0);
        }
      }
    });

    const list = Object.values(daysMap).sort((a, b) => a.timestamp - b.timestamp);

    // Find the single highest profit day
    let peakDay: any = null;
    let maxProfit = -Infinity;
    list.forEach(item => {
      if (item.profit > maxProfit) {
        maxProfit = item.profit;
        peakDay = item;
      }
    });

    const totalPeriodProfit = list.reduce((sum, item) => sum + item.profit, 0);
    const totalPeriodRevenue = list.reduce((sum, item) => sum + item.revenue, 0);
    const totalPeriodExpenses = list.reduce((sum, item) => sum + item.expenses, 0);
    const avgDailyProfit = list.length > 0 ? totalPeriodProfit / list.length : 0;

    return {
      list,
      peakDay: maxProfit > 0 ? peakDay : null,
      maxProfit: Math.max(0, maxProfit),
      totalPeriodProfit,
      totalPeriodRevenue,
      totalPeriodExpenses,
      avgDailyProfit
    };
  }, [data.transactions, data.expenses, data.khudaarSales, data.khudaarExpenses, rangeType, startDate, endDate]);

  return (
    <div className="bg-white p-4 sm:p-7 rounded-[36px] sm:rounded-[40px] border border-slate-100 shadow-sm space-y-6">
      
      {/* Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 bg-emerald-500/10 text-emerald-700 font-black text-[10px] rounded-md uppercase tracking-wider flex items-center gap-1">
              <Sparkles size={12} className="text-emerald-600" />
              Faa'iidada Maalmaha & Kala-sarraynta
            </span>
            <span className="text-xs text-slate-400 font-bold hidden sm:inline">• Sabti ilaa Jimce</span>
          </div>
          <h3 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight mt-1 flex items-center gap-2">
            <TrendingUp size={24} className="text-emerald-600" />
            <span>Jaantuska Faa'iidada Maalinlaha ah (Daily Profit)</span>
          </h3>
          <p className="text-xs text-slate-500 font-medium mt-0.5">
            Kala ogow maalmaha faa'iidada ugu badan laga helay iyo taariikh kasta inta la macaashay.
          </p>
        </div>

        {/* Filter Toolbar */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl">
            <button
              onClick={() => setRangeType('7')}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all cursor-pointer ${
                rangeType === '7' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              7 Maalmood
            </button>
            <button
              onClick={() => setRangeType('14')}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all cursor-pointer ${
                rangeType === '14' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              14 Maalmood
            </button>
            <button
              onClick={() => setRangeType('30')}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all cursor-pointer ${
                rangeType === '30' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              30 Maalmood
            </button>
            <button
              onClick={() => setRangeType('month')}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all cursor-pointer ${
                rangeType === 'month' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Bishan
            </button>
            <button
              onClick={() => setRangeType('custom')}
              className={`px-3 py-1.5 rounded-xl text-[11px] font-black uppercase transition-all cursor-pointer ${
                rangeType === 'custom' ? 'bg-emerald-600 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              Custom Date
            </button>
          </div>

          {/* Chart Type Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-2xl">
            <button
              onClick={() => setChartType('bar')}
              className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                chartType === 'bar' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-900'
              }`}
              title="Bar Chart"
            >
              <BarChart3 size={16} />
            </button>
            <button
              onClick={() => setChartType('area')}
              className={`p-1.5 rounded-xl transition-all cursor-pointer ${
                chartType === 'area' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400 hover:text-slate-900'
              }`}
              title="Area Trend"
            >
              <Layers size={16} />
            </button>
          </div>
        </div>
      </div>

      {/* Custom Date Inputs (if active) */}
      {rangeType === 'custom' && (
        <div className="p-4 bg-emerald-50/60 rounded-3xl border border-emerald-100 flex flex-wrap items-center gap-3 animate-in fade-in duration-200">
          <CalendarRange size={18} className="text-emerald-700" />
          <span className="text-xs font-black text-emerald-900 uppercase">Dooro Xilliga Gaarka ah:</span>
          
          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Laga Bilaabo:</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>

          <div className="flex items-center gap-2">
            <label className="text-[10px] font-bold text-slate-500 uppercase">Ilaa:</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 bg-white border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            />
          </div>
        </div>
      )}

      {/* Top Highlight Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        
        {/* Total Profit in Period */}
        <div className="p-4 bg-gradient-to-br from-emerald-50 to-teal-50/50 rounded-3xl border border-emerald-100">
          <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest flex items-center gap-1">
            <TrendingUp size={13} />
            Wadarta Faa'iidada
          </p>
          <p className="text-lg sm:text-2xl font-black text-emerald-950 mt-1 truncate">
            {formatCurrency(dailyData.totalPeriodProfit, currency, rate)}
          </p>
          <p className="text-[10px] font-bold text-emerald-600 mt-0.5">
            {dailyData.list.length} Maalmood Xisaabtooda
          </p>
        </div>

        {/* Peak Profit Day Highlight (Maalinta Ugu Faa'iidada Badan) */}
        <div className="p-4 bg-gradient-to-br from-amber-50 via-amber-100/50 to-orange-50 rounded-3xl border border-amber-200 shadow-sm relative overflow-hidden group">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-amber-800 uppercase tracking-widest flex items-center gap-1">
              <Award size={14} className="text-amber-600" />
              Maalinta Ugu Faa'iidada Badan
            </p>
            <span className="px-1.5 py-0.5 bg-amber-500 text-white font-black text-[9px] rounded uppercase shadow-xs">
              🏆 Peak
            </span>
          </div>
          {dailyData.peakDay ? (
            <div>
              <p className="text-base sm:text-xl font-black text-amber-950 mt-1 truncate">
                {dailyData.peakDay.dayNameSomali} ({dailyData.peakDay.dateStr.slice(5)})
              </p>
              <p className="text-xs font-black text-amber-700 mt-0.5">
                +{formatCurrency(dailyData.peakDay.profit, currency, rate)}
              </p>
            </div>
          ) : (
            <p className="text-xs font-bold text-slate-400 mt-2">Xog lama hayo</p>
          )}
        </div>

        {/* Average Daily Profit */}
        <div className="p-4 bg-slate-50 rounded-3xl border border-slate-100">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <Percent size={13} />
            Celceliska Maalintii
          </p>
          <p className="text-lg sm:text-2xl font-black text-slate-800 mt-1 truncate">
            {formatCurrency(dailyData.avgDailyProfit, currency, rate)}
          </p>
          <p className="text-[10px] font-bold text-slate-500 mt-0.5">
            Maalintiiba celcelis ahaan
          </p>
        </div>

        {/* Total Sales in Period */}
        <div className="p-4 bg-blue-50/70 rounded-3xl border border-blue-100">
          <p className="text-[10px] font-black text-blue-700 uppercase tracking-widest flex items-center gap-1">
            <DollarSign size={13} />
            Iibka Guud (Sales)
          </p>
          <p className="text-lg sm:text-2xl font-black text-blue-950 mt-1 truncate">
            {formatCurrency(dailyData.totalPeriodRevenue, currency, rate)}
          </p>
          <p className="text-[10px] font-bold text-blue-600 mt-0.5">
            Kharashka: {formatCurrency(dailyData.totalPeriodExpenses, currency, rate)}
          </p>
        </div>
      </div>

      {/* Chart Canvas */}
      <div className="p-4 bg-slate-50/70 rounded-3xl border border-slate-100">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-black text-slate-700 uppercase tracking-wider">
              {chartType === 'bar' ? 'Kala-sarraynta Faa\'iidada Maalmaha (Bar Chart)' : 'Dhaqdhaqaaqa Faa\'iidada (Trend)'}
            </span>
          </div>
          <div className="flex items-center gap-3 text-[10px] font-bold text-slate-500">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block"></span>
              Faa'iido Caadi ah
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block"></span>
              🏆 Maalinta Ugu Badan
            </span>
          </div>
        </div>

        <div className="h-[240px] sm:h-[300px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            {chartType === 'bar' ? (
              <BarChart data={dailyData.list} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="fullDateStr" 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={{ stroke: '#cbd5e1' }}
                />
                <YAxis 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(16, 185, 129, 0.08)' }}
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      const isPeak = dailyData.peakDay && dailyData.peakDay.dateStr === d.dateStr && d.profit > 0;
                      return (
                        <div className="bg-slate-900 text-white p-3.5 rounded-2xl shadow-xl border border-slate-800 text-xs space-y-1.5 font-sans min-w-[200px]">
                          <div className="flex items-center justify-between border-b border-slate-800 pb-1.5">
                            <span className="font-black text-amber-400">
                              {d.dayNameSomali} ({d.dateStr})
                            </span>
                            {isPeak && (
                              <span className="px-1.5 py-0.2 bg-amber-500 text-slate-950 font-black text-[9px] rounded uppercase">
                                🏆 Ugu Badan
                              </span>
                            )}
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Faa'iidada (Profit):</span>
                            <span className="font-black text-emerald-400">
                              {formatCurrency(d.profit, currency, rate)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Iibka (Revenue):</span>
                            <span className="font-bold text-blue-400">
                              {formatCurrency(d.revenue, currency, rate)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className="text-slate-400">Kharashka (Expenses):</span>
                            <span className="font-bold text-rose-400">
                              {formatCurrency(d.expenses, currency, rate)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between pt-1 border-t border-slate-800 text-[10px]">
                            <span className="text-slate-400">Tirada Iibka:</span>
                            <span className="font-bold text-slate-300">{d.txCount} Macmiil</span>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Bar 
                  dataKey="profit" 
                  radius={[8, 8, 0, 0]}
                  onClick={(entry) => setSelectedDayDetail(entry)}
                >
                  {dailyData.list.map((entry, index) => {
                    const isPeak = dailyData.peakDay && dailyData.peakDay.dateStr === entry.dateStr && entry.profit > 0;
                    return (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={isPeak ? '#f59e0b' : entry.profit < 0 ? '#f43f5e' : '#10b981'} 
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            ) : (
              <AreaChart data={dailyData.list} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="profitGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0.0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                <XAxis 
                  dataKey="fullDateStr" 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                  tickLine={false}
                />
                <YAxis 
                  tick={{ fontSize: 10, fontWeight: 700, fill: '#64748b' }}
                  tickLine={false}
                  axisLine={false}
                  tickFormatter={(val) => `$${val}`}
                />
                <Tooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      const d = payload[0].payload;
                      return (
                        <div className="bg-slate-900 text-white p-3 rounded-2xl shadow-xl text-xs space-y-1">
                          <p className="font-black text-emerald-400">{d.dayNameSomali} ({d.dateStr})</p>
                          <p className="font-bold">Faa'iido: {formatCurrency(d.profit, currency, rate)}</p>
                          <p className="text-[10px] text-slate-400">Iib: {formatCurrency(d.revenue, currency, rate)}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area 
                  type="monotone" 
                  dataKey="profit" 
                  stroke="#10b981" 
                  strokeWidth={3} 
                  fill="url(#profitGrad)" 
                />
              </AreaChart>
            )}
          </ResponsiveContainer>
        </div>
      </div>

      {/* Day-by-Day Detailed Breakdown Table */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-black text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
            <Calendar size={14} className="text-emerald-600" />
            Faahfaahinta Maalinba Maalinta ka Dambaysa (Sabti ilaa Jimce)
          </p>
          <span className="text-[10px] font-bold text-slate-400">
            Kala sarreysiinta faa'iidada
          </span>
        </div>

        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-slate-50/50">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="bg-slate-100/80 text-[10px] font-black uppercase text-slate-500 tracking-wider border-b border-slate-200">
                <th className="p-3">Maalinta & Taariikhda</th>
                <th className="p-3 text-right">Iibka Guud</th>
                <th className="p-3 text-right">Kharashka</th>
                <th className="p-3 text-right">Faa'iidada Saafiga ah</th>
                <th className="p-3 text-center">Xaaladda / Qiimeynta</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {dailyData.list.map((row) => {
                const isPeak = dailyData.peakDay && dailyData.peakDay.dateStr === row.dateStr && row.profit > 0;
                const profitPct = dailyData.maxProfit > 0 ? (Math.max(0, row.profit) / dailyData.maxProfit) * 100 : 0;
                return (
                  <tr 
                    key={row.dateStr}
                    className={`hover:bg-slate-50 transition-colors ${isPeak ? 'bg-amber-50/40 font-bold' : ''}`}
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className={`w-7 h-7 rounded-xl flex items-center justify-center text-[10px] font-black shrink-0 ${
                          isPeak ? 'bg-amber-500 text-white shadow-xs' : 'bg-slate-100 text-slate-700'
                        }`}>
                          {row.dayNameSomali.slice(0, 3)}
                        </span>
                        <div>
                          <p className="font-black text-slate-900 flex items-center gap-1">
                            {row.dayNameSomali}
                            {isPeak && <span className="text-amber-600 text-[10px]">🏆</span>}
                          </p>
                          <p className="text-[10px] text-slate-400 font-bold">{row.dateStr}</p>
                        </div>
                      </div>
                    </td>

                    <td className="p-3 text-right font-black text-slate-800">
                      {formatCurrency(row.revenue, currency, rate)}
                    </td>

                    <td className="p-3 text-right font-bold text-rose-600">
                      {row.expenses > 0 ? formatCurrency(row.expenses, currency, rate) : '$0.00'}
                    </td>

                    <td className="p-3 text-right">
                      <p className={`font-black text-sm ${row.profit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {formatCurrency(row.profit, currency, rate)}
                      </p>
                      <p className="text-[9px] font-bold text-slate-400">
                        {row.txCount} Iib
                      </p>
                    </td>

                    <td className="p-3 text-center">
                      <div className="flex flex-col items-center gap-1">
                        {isPeak ? (
                          <span className="px-2 py-0.5 bg-amber-500 text-white rounded-md text-[9px] font-black uppercase">
                            🏆 Ugu Faa'iido Badan
                          </span>
                        ) : row.profit > dailyData.avgDailyProfit && row.profit > 0 ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-md text-[9px] font-black uppercase">
                            Sare / Wanaagsan
                          </span>
                        ) : row.profit > 0 ? (
                          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-md text-[9px] font-bold uppercase">
                            Dhexdhexaad
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md text-[9px] font-bold uppercase">
                            Iib La'aan / Hoose
                          </span>
                        )}

                        {/* Relative profit bar */}
                        <div className="w-20 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                          <div 
                            className={`h-full rounded-full ${isPeak ? 'bg-amber-500' : 'bg-emerald-500'}`}
                            style={{ width: `${Math.min(100, Math.max(5, profitPct))}%` }}
                          />
                        </div>
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
  );
};

export default DailyProfitAnalyzer;
