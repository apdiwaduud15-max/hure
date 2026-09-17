import React from 'react';
import { Currency } from '../types';
import { formatCurrency } from '../lib/utils';
import { 
  X, 
  Printer, 
  HandCoins, 
  User, 
  Calendar, 
  Clock, 
  FileText, 
  Building, 
  CreditCard, 
  DollarSign, 
  Tag, 
  CheckCircle2, 
  MessageSquare,
  ShieldCheck,
  Receipt
} from 'lucide-react';

export interface CashDisbursementItem {
  id: string;
  recipientName: string;
  recipientPhone?: string;
  recipientType: 'CUSTOMER' | 'SUPPLIER' | 'EXPENSE' | 'STAFF' | 'KHUDAAR' | 'TRANSFER' | 'OTHER';
  categoryLabel: string;
  amount: number;
  timestamp: number;
  dateStr: string;
  timeStr: string;
  dayNameSomali: string;
  reason: string;
  accountName?: string;
  authorizedBy?: string;
  rawType: string;
  notes?: string;
  invoiceOrPage?: string;
  receiptImage?: string;
  exchangeRate?: number;
  itemsSummary?: string;
}

interface Props {
  isOpen: boolean;
  onClose: () => void;
  item: CashDisbursementItem | null;
  currency: Currency;
  exchangeRate: number;
  businessName: string;
}

export const CashDisbursementModal: React.FC<Props> = ({
  isOpen,
  onClose,
  item,
  currency,
  exchangeRate,
  businessName
}) => {
  if (!isOpen || !item) return null;

  const rate = item.exchangeRate || exchangeRate || 1;
  const amountUSD = item.amount;
  const amountETB = item.amount * rate;

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="bg-white w-full max-w-xl rounded-[32px] sm:rounded-[36px] shadow-2xl border border-slate-100 overflow-hidden flex flex-col max-h-[92vh] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="no-print p-5 sm:p-6 bg-gradient-to-r from-rose-900 via-rose-950 to-slate-950 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-rose-500/20 border border-rose-400/30 flex items-center justify-center text-rose-300">
              <HandCoins size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 bg-rose-500/80 text-white font-black text-[10px] rounded-md uppercase tracking-wider">
                  {item.categoryLabel}
                </span>
                <span className="text-xs text-rose-200/80 font-bold">Faahfaahinta Cash-ka</span>
              </div>
              <h2 className="text-lg sm:text-xl font-black tracking-tight text-white mt-0.5">
                Lacag Caddaan ah oo La Qaatay / Bixiyay
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Body / Printable Voucher */}
        <div className="p-5 sm:p-6 overflow-y-auto space-y-5 text-slate-800">
          
          {/* Printable Voucher Header (Visible when printing or viewing) */}
          <div className="p-5 bg-rose-50/60 rounded-3xl border border-rose-100/80 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">
                Qofka / Goobta Lacagta Qaadatay
              </p>
              <h3 className="text-xl sm:text-2xl font-black text-slate-900 mt-0.5 flex items-center gap-2">
                <User size={20} className="text-rose-600 shrink-0" />
                <span>{item.recipientName}</span>
              </h3>
              {item.recipientPhone && (
                <p className="text-xs font-bold text-slate-500 mt-0.5">
                  📱 Tel: {item.recipientPhone}
                </p>
              )}
            </div>

            <div className="text-left sm:text-right bg-white p-3.5 sm:p-4 rounded-2xl border border-rose-200 shadow-sm shrink-0">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Cadadka Lacagta (Amount)
              </p>
              <p className="text-xl sm:text-2xl font-black text-rose-600">
                ${amountUSD.toFixed(2)} USD
              </p>
              <p className="text-xs font-black text-slate-600">
                ≈ {amountETB.toLocaleString(undefined, { maximumFractionDigits: 1 })} ETB
              </p>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            {/* Date & Day */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-bold mb-1">
                <Calendar size={14} className="text-rose-600" />
                <span className="text-[10px] uppercase font-black tracking-wider">Taariikhda & Maalinta</span>
              </div>
              <p className="text-sm font-black text-slate-900">
                {item.dayNameSomali}, {item.dateStr}
              </p>
            </div>

            {/* Time */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-bold mb-1">
                <Clock size={14} className="text-rose-600" />
                <span className="text-[10px] uppercase font-black tracking-wider">Goorta uu Qaatay (Waqtiga)</span>
              </div>
              <p className="text-sm font-black text-slate-900">
                {item.timeStr || new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
              </p>
            </div>

            {/* Category / Type */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-bold mb-1">
                <Tag size={14} className="text-rose-600" />
                <span className="text-[10px] uppercase font-black tracking-wider">Nooca Lacag Bixinta</span>
              </div>
              <p className="text-sm font-black text-slate-900">
                {item.categoryLabel}
              </p>
            </div>

            {/* Source Account / Box */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-bold mb-1">
                <CreditCard size={14} className="text-rose-600" />
                <span className="text-[10px] uppercase font-black tracking-wider">Akoonka / Sanduuqa</span>
              </div>
              <p className="text-sm font-black text-slate-900">
                {item.accountName || 'Cash in Hand (Sanduuqa Dukaanka)'}
              </p>
            </div>

            {/* Authorized / Recorded By */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-bold mb-1">
                <ShieldCheck size={14} className="text-rose-600" />
                <span className="text-[10px] uppercase font-black tracking-wider">Qofka Bixiyay / Diiwaangeliyay</span>
              </div>
              <p className="text-sm font-black text-slate-900">
                {item.authorizedBy || 'Admin / Cashier'}
              </p>
            </div>

            {/* Invoice / Ref / Page */}
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-100">
              <div className="flex items-center gap-2 text-slate-400 text-xs font-bold mb-1">
                <Receipt size={14} className="text-rose-600" />
                <span className="text-[10px] uppercase font-black tracking-wider">Tixraaca / Risiidh #</span>
              </div>
              <p className="text-sm font-black text-slate-900">
                {item.invoiceOrPage || `#VCH-${item.id.slice(-6).toUpperCase()}`}
              </p>
            </div>
          </div>

          {/* Reason & Notes Section */}
          <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80">
            <div className="flex items-center gap-2 text-amber-800 text-xs font-bold mb-1.5">
              <MessageSquare size={15} className="text-amber-600" />
              <span className="text-[10px] uppercase font-black tracking-wider">Sababta Loo Qaatay (Reason / Sabab)</span>
            </div>
            <p className="text-sm font-bold text-slate-900 whitespace-pre-wrap leading-relaxed">
              {item.reason || item.notes || 'Lacag bixin toos ah oo caddaan ah'}
            </p>
          </div>

          {/* Items Summary (if any) */}
          {item.itemsSummary && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1.5">
                Faahfaahinta Alaabta / Agabka
              </p>
              <p className="text-xs font-semibold text-slate-700 whitespace-pre-wrap">
                {item.itemsSummary}
              </p>
            </div>
          )}

          {/* Receipt image (if attached) */}
          {item.receiptImage && (
            <div className="p-3 rounded-2xl bg-slate-50 border border-slate-100">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Sawirka Risiidhka / Caddeynta
              </p>
              <img 
                src={item.receiptImage} 
                alt="Receipt" 
                className="max-h-56 w-auto rounded-xl border border-slate-200 object-contain mx-auto"
              />
            </div>
          )}

          {/* Business confirmation note */}
          <div className="p-3 bg-slate-50 rounded-xl text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider">
            {businessName} • Xisaabta Caddaanka ah & Foojarrada
          </div>
        </div>

        {/* Footer */}
        <div className="no-print p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handlePrint}
            className="flex items-center gap-2 px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-2xl font-black text-xs shadow-md transition-all active:scale-95 cursor-pointer"
          >
            <Printer size={15} />
            <span>Daabac Foojarka (Print)</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-2xl font-black text-xs transition-all active:scale-95 cursor-pointer"
          >
            Xidh Daaqadda
          </button>
        </div>
      </div>
    </div>
  );
};

export default CashDisbursementModal;
