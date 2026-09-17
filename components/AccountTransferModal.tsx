import React, { useState } from 'react';
import { AppData, Account, Currency, AccountTransfer } from '../types';
import { formatCurrency, generateId } from '../lib/utils';
import { X, ArrowRightLeft, Wallet, CheckCircle2, AlertCircle } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  addLog: (action: string, details: string) => void;
  currency: Currency;
  defaultFromAccountId?: string;
}

const AccountTransferModal: React.FC<Props> = ({
  isOpen,
  onClose,
  data,
  setData,
  addLog,
  currency,
  defaultFromAccountId
}) => {
  const rate = data.settings.exchangeRate;

  const [fromAccountId, setFromAccountId] = useState<string>(defaultFromAccountId || (data.accounts[0]?.id || ''));
  const [toAccountId, setToAccountId] = useState<string>('');
  const [transferCurrency, setTransferCurrency] = useState<'ETB' | 'USD'>('ETB');
  const [amountInput, setAmountInput] = useState<string>('');
  const [note, setNote] = useState<string>('');
  const [transferDate, setTransferDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [transferTime, setTransferTime] = useState<string>(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [errorMsg, setErrorMsg] = useState<string>('');

  if (!isOpen) return null;

  // Convert input amount to base currency amount
  const getBaseAmount = () => {
    const raw = parseFloat(amountInput) || 0;
    if (transferCurrency === 'ETB') {
      return (currency === Currency.USD) ? raw / rate : raw;
    } else {
      return (currency === Currency.ETB) ? raw * rate : raw;
    }
  };

  const handleTransfer = () => {
    setErrorMsg('');
    const amt = getBaseAmount();

    if (!fromAccountId) {
      setErrorMsg('Fadlan dooro Akoonka laga jaro lacagta (From Account)!');
      return;
    }
    if (!toAccountId) {
      setErrorMsg('Fadlan dooro Akoonka lagu shubo lacagta (To Account)!');
      return;
    }
    if (fromAccountId === toAccountId) {
      setErrorMsg('Labada akoon ma wada noqon karaan isku akoon!');
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Fadlan geli lacagta saxda ah ee loo xawilayo!');
      return;
    }

    const fromAcc = data.accounts.find(a => a.id === fromAccountId);
    const toAcc = data.accounts.find(a => a.id === toAccountId);

    if (!fromAcc || !toAcc) {
      setErrorMsg('Akoonada la doortay mid ka mid ah ma jiro!');
      return;
    }

    if (fromAcc.balance < amt) {
      if (!confirm(`Digniin: Balance-ka akoonka "${fromAcc.name}" waa $${fromAcc.balance}, oo ka yar lacagta $${amt} aad xawilayso. Ma rabtaa inaad sii waddo oo uu minus galo?`)) {
        return;
      }
    }

    let transferTimestamp = Date.now();
    if (transferDate) {
      const tTime = transferTime || '12:00';
      const parsed = new Date(`${transferDate}T${tTime}:00`);
      if (!isNaN(parsed.getTime())) {
        transferTimestamp = parsed.getTime();
      }
    }

    const newTransfer: AccountTransfer = {
      id: generateId(),
      fromAccountId: fromAcc.id,
      fromAccountName: fromAcc.name,
      toAccountId: toAcc.id,
      toAccountName: toAcc.name,
      amount: amt,
      note: note.trim() || `Xawilaad: ${fromAcc.name} -> ${toAcc.name}`,
      timestamp: transferTimestamp,
      user: data.settings.currentUser.name
    };

    const updatedAccounts = data.accounts.map(acc => {
      if (acc.id === fromAcc.id) {
        return { ...acc, balance: acc.balance - amt };
      }
      if (acc.id === toAcc.id) {
        return { ...acc, balance: acc.balance + amt };
      }
      return acc;
    });

    setData(prev => ({
      ...prev,
      accounts: updatedAccounts,
      accountTransfers: [newTransfer, ...(prev.accountTransfers || [])]
    }));

    addLog('Account Money Transfer', `Xawilaad Lacageed: ${formatCurrency(amt, currency, rate)} waxaa ka go'ay "${fromAcc.name}" kuna shubmay "${toAcc.name}" (${note || 'No note'})`);

    alert(`✅ Si guul leh ayaa $${amt} looga xawilay "${fromAcc.name}" loona shabay "${toAcc.name}"!`);
    
    // Reset and close
    setAmountInput('');
    setNote('');
    onClose();
  };

  const selectedFromAcc = data.accounts.find(a => a.id === fromAccountId);
  const selectedToAcc = data.accounts.find(a => a.id === toAccountId);

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-[36px] shadow-2xl w-full max-w-lg overflow-hidden border border-slate-100 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="p-6 md:p-8 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/30 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <ArrowRightLeft size={24} />
            </div>
            <div>
              <h3 className="text-xl font-black tracking-tight">Account to Account Transfer</h3>
              <p className="text-xs text-slate-400 font-medium">Isu-shub/Xawilaad akoonada dhexdooda ah</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 md:p-8 space-y-6">
          {errorMsg && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-2xl text-xs font-bold flex items-center gap-2">
              <AlertCircle size={16} className="shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* From Account */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                <Wallet size={12} className="text-rose-500" /> Akoonka Laga Jaro (From)
              </label>
              <select
                value={fromAccountId}
                onChange={e => setFromAccountId(e.target.value)}
                className="w-full px-4 py-3.5 bg-rose-50/50 border border-rose-100 rounded-2xl font-bold text-slate-800 text-sm outline-none focus:ring-2 focus:ring-rose-500"
              >
                <option value="">Dooro Akoon...</option>
                {data.accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({formatCurrency(acc.balance, currency, rate)})
                  </option>
                ))}
              </select>
              {selectedFromAcc && (
                <p className="text-[10px] font-bold text-slate-400 px-1">
                  Haragga Hada: <span className="font-mono text-slate-700">{formatCurrency(selectedFromAcc.balance, currency, rate)}</span>
                </p>
              )}
            </div>

            {/* To Account */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1">
                <Wallet size={12} className="text-emerald-500" /> Akoonka Ku Shubmayo (To)
              </label>
              <select
                value={toAccountId}
                onChange={e => setToAccountId(e.target.value)}
                className="w-full px-4 py-3.5 bg-emerald-50/50 border border-emerald-100 rounded-2xl font-bold text-slate-800 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="">Dooro Akoon...</option>
                {data.accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>
                    {acc.name} ({formatCurrency(acc.balance, currency, rate)})
                  </option>
                ))}
              </select>
              {selectedToAcc && (
                <p className="text-[10px] font-bold text-slate-400 px-1">
                  Haragga Hada: <span className="font-mono text-slate-700">{formatCurrency(selectedToAcc.balance, currency, rate)}</span>
                </p>
              )}
            </div>
          </div>

          {/* Currency Toggle & Amount Input */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                Lacagta Loo Xawilayo ({transferCurrency})
              </label>
              <div className="flex gap-1 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTransferCurrency('ETB')}
                  className={`px-3 py-1 rounded-lg font-black text-[10px] transition-all ${transferCurrency === 'ETB' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}
                >
                  🇪🇹 ETB (Birr)
                </button>
                <button
                  type="button"
                  onClick={() => setTransferCurrency('USD')}
                  className={`px-3 py-1 rounded-lg font-black text-[10px] transition-all ${transferCurrency === 'USD' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}
                >
                  🇺🇸 USD ($)
                </button>
              </div>
            </div>

            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-slate-400 text-sm">
                {transferCurrency === 'ETB' ? 'ETB' : '$'}
              </span>
              <input
                type="number"
                step="any"
                placeholder="0.00"
                value={amountInput}
                onChange={e => setAmountInput(e.target.value)}
                className="w-full pl-14 pr-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-mono text-2xl font-black text-slate-900 outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {parseFloat(amountInput) > 0 && (
              <p className="text-[11px] font-bold text-slate-500 px-1">
                Equivalent: {transferCurrency === 'ETB' ? `$${(parseFloat(amountInput) / rate).toFixed(2)} USD` : `${(parseFloat(amountInput) * rate).toFixed(2)} ETB (Birr)`}
              </p>
            )}
          </div>

          {/* Custom Date & Time */}
          <div className="space-y-2 bg-slate-50 p-4 rounded-2xl border border-slate-200/80">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                📅 Taariikhda & Waqtiga Xawilaadda (Date & Time)
              </label>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => {
                    const now = new Date();
                    setTransferDate(now.toISOString().split('T')[0]);
                    setTransferTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
                  }}
                  className="px-2.5 py-0.5 bg-blue-100 hover:bg-blue-200 text-blue-800 rounded-lg text-[10px] font-black transition-all"
                >
                  ⚡ Maanta
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const yesterday = new Date();
                    yesterday.setDate(yesterday.getDate() - 1);
                    setTransferDate(yesterday.toISOString().split('T')[0]);
                  }}
                  className="px-2.5 py-0.5 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-lg text-[10px] font-black transition-all"
                >
                  ⏪ Shalay
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Taariikhda</span>
                <input
                  type="date"
                  value={transferDate}
                  onChange={e => setTransferDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
              <div>
                <span className="text-[9px] font-black text-slate-400 uppercase block mb-1">Waqtiga</span>
                <input
                  type="time"
                  value={transferTime}
                  onChange={e => setTransferTime(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl font-bold text-xs text-slate-800 outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>

          {/* Note / Description */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Sababta / Fahfaahin (Note/Description - Optional)
            </label>
            <input
              type="text"
              placeholder="e.g. Dhigaal Cash to Zaad, ama Bixinta Bank"
              value={note}
              onChange={e => setNote(e.target.value)}
              className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Visual Transfer Flow Indicator */}
          {selectedFromAcc && selectedToAcc && (
            <div className="p-4 bg-blue-50/70 border border-blue-100 rounded-2xl flex items-center justify-between gap-3 text-xs">
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-slate-400 uppercase">Ka Go'aya</p>
                <p className="font-black text-rose-700 truncate">{selectedFromAcc.name}</p>
              </div>
              <ArrowRightLeft size={18} className="text-blue-600 shrink-0" />
              <div className="flex-1 min-w-0 text-right">
                <p className="text-[10px] font-black text-slate-400 uppercase">Ku Shubmaya</p>
                <p className="font-black text-emerald-700 truncate">{selectedToAcc.name}</p>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-6 md:p-8 pt-0 flex items-center gap-3">
          <button
            onClick={onClose}
            className="flex-1 py-4 font-black text-slate-400 hover:text-slate-600 transition-colors"
          >
            Kansal
          </button>
          <button
            onClick={handleTransfer}
            className="flex-[2] py-4 bg-blue-600 hover:bg-blue-700 text-white font-black rounded-2xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 text-sm uppercase tracking-wider"
          >
            <CheckCircle2 size={18} /> Orod Xawil Lacagta
          </button>
        </div>

      </div>
    </div>
  );
};

export default AccountTransferModal;
