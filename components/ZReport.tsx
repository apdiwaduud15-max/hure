
import React, { useMemo } from 'react';
import { AppData, Currency } from '../types';
import { formatCurrency } from '../lib/utils';
import { Printer, Zap, Calendar } from 'lucide-react';

interface Props {
  data: AppData;
  currency: Currency;
}

const ZReport: React.FC<Props> = ({ data, currency }) => {
  const rate = data.settings.exchangeRate;
  
  const todayStart = new Date();
  todayStart.setHours(0,0,0,0);
  const startTime = todayStart.getTime();

  const dayStats = useMemo(() => {
    const todayTransactions = data.transactions.filter(t => 
      t.timestamp >= startTime && 
      (t.type === 'SALE' || (!t.type && !t.supplierId && !t.notes?.toLowerCase().includes('supplier') && t.items?.[0]?.sku !== 'SUPPLIER_PAYMENT'))
    );
    const todaySupplierPayments = data.transactions.filter(t => 
      t.timestamp >= startTime && 
      (t.type === 'EXPENSE' || t.supplierId || t.items?.[0]?.sku === 'SUPPLIER_PAYMENT')
    );
    const supplierPaidAmount = todaySupplierPayments.reduce((acc, t) => acc + t.total, 0);
    const todayExpenses = data.expenses.filter(e => e.timestamp >= startTime);
    const directExpensesAmount = todayExpenses.reduce((acc, e) => acc + e.amount, 0);
    const totalExpensesAndSupplier = directExpensesAmount + supplierPaidAmount;

    const cash = todayTransactions.reduce((acc, t) => {
      if (t.paymentMethod === 'Cash') return acc + t.total;
      if (t.paymentMethod === 'Partial Payment' && t.paymentDetails) return acc + t.paymentDetails.cash;
      return acc;
    }, 0);

    const bank = todayTransactions.reduce((acc, t) => {
      if (t.paymentMethod === 'Bank Transfer') return acc + t.total;
      if (t.paymentMethod === 'Partial Payment' && t.paymentDetails) return acc + t.paymentDetails.bank;
      return acc;
    }, 0);

    const mobile = todayTransactions.reduce((acc, t) => {
      if (t.paymentMethod === 'Mobile Money') return acc + t.total;
      if (t.paymentMethod === 'Partial Payment' && t.paymentDetails) return acc + t.paymentDetails.mobile;
      return acc;
    }, 0);

    const debt = todayTransactions.reduce((acc, t) => {
      if (t.paymentMethod === 'Debt') return acc + t.total;
      if (t.paymentMethod === 'Partial Payment' && t.paymentDetails) return acc + t.paymentDetails.debt;
      return acc;
    }, 0);

    const expenses = totalExpensesAndSupplier;

    return {
      count: todayTransactions.length,
      totalSales: todayTransactions.reduce((acc, t) => acc + t.total, 0),
      supplierPaidAmount,
      cash,
      bank,
      mobile,
      debt,
      expenses,
      netCash: cash + bank + mobile - expenses
    };
  }, [data, startTime]);

  return (
    <div className="p-12 max-w-2xl mx-auto space-y-8">
      <div className="flex justify-between items-center no-print">
        <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
          <Zap className="text-blue-600" /> Daily Closing
        </h1>
        <button onClick={() => window.print()} className="bg-slate-900 text-white px-6 py-3 rounded-2xl font-bold flex items-center gap-2">
          <Printer size={20} /> Print Z-Report
        </button>
      </div>

      <div className="bg-white p-12 rounded-[40px] border shadow-2xl space-y-10 print:shadow-none print:border-none print:p-0">
        <div className="text-center space-y-2 border-b-2 border-slate-900 pb-8">
           <h2 className="text-2xl font-black uppercase tracking-widest">{data.settings.businessName}</h2>
           <p className="text-sm font-bold text-slate-500 uppercase tracking-tighter">Official Z-Report Summary</p>
           <div className="flex items-center justify-center gap-2 text-xs font-black text-slate-400 mt-4">
              <Calendar size={12}/>
              {new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
           </div>
        </div>

        <div className="space-y-6">
           <div className="flex justify-between items-center text-sm font-bold text-slate-500 uppercase">
              <span>Transaction Count</span>
              <span className="text-slate-900">{dayStats.count}</span>
           </div>
           <div className="flex justify-between items-center text-xl font-black text-slate-900 border-b pb-4">
              <span>Gross Sales</span>
              <span>{formatCurrency(dayStats.totalSales, currency, rate)}</span>
           </div>

           <div className="space-y-4 pt-4">
              <div className="flex justify-between items-center text-sm font-bold">
                 <span className="text-slate-500 uppercase">Cash Collected</span>
                 <span className="text-emerald-600">{formatCurrency(dayStats.cash, currency, rate)}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-bold">
                 <span className="text-slate-500 uppercase">Bank Transfer</span>
                 <span className="text-blue-600">{formatCurrency(dayStats.bank, currency, rate)}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-bold">
                 <span className="text-slate-500 uppercase">Mobile Money</span>
                 <span className="text-purple-600">{formatCurrency(dayStats.mobile, currency, rate)}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-bold">
                 <span className="text-slate-500 uppercase">New Debt Issued</span>
                 <span className="text-amber-600">{formatCurrency(dayStats.debt, currency, rate)}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-bold text-red-600 pt-2 border-t">
                 <span className="uppercase">Daily Expenses</span>
                 <span>-{formatCurrency(dayStats.expenses, currency, rate)}</span>
              </div>
           </div>

           <div className="bg-slate-900 p-8 rounded-3xl text-white mt-10">
              <p className="text-[10px] font-black uppercase tracking-[0.3em] mb-2 opacity-60">Net Daily Liquidity</p>
              <h3 className="text-4xl font-black">{formatCurrency(dayStats.netCash, currency, rate)}</h3>
              <p className="text-[10px] mt-4 opacity-40 font-medium">This represents actual cash/bank/mobile inflow minus expenses. Debt is excluded from liquidity.</p>
           </div>
        </div>

        <div className="text-center pt-8 border-t text-[10px] text-slate-300 font-bold uppercase tracking-widest">
           System Generated • No Signature Required • End of Shift
        </div>
      </div>
    </div>
  );
};

export default ZReport;
