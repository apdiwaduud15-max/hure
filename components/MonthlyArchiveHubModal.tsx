import React, { useState } from 'react';
import { AppData, Currency, MonthlyArchive, AccountType } from '../types';
import { formatCurrency } from '../lib/utils';
import { 
  Archive, 
  Calendar, 
  Eye, 
  FileText, 
  Printer, 
  Download, 
  CheckCircle2, 
  X, 
  ArrowRight, 
  TrendingUp, 
  ShoppingBag, 
  Users, 
  Wallet, 
  Sparkles,
  RefreshCw,
  Search,
  Lock,
  ChevronRight,
  ShieldAlert,
  Layers,
  ArrowUpRight,
  RotateCcw
} from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  addLog: (action: string, details: string) => void;
  currency: Currency;
  onSelectArchiveForView: (archive: MonthlyArchive | null) => void;
  activeArchiveView: MonthlyArchive | null;
  onOpenMonthlyCloseModal: () => void;
}

export const MonthlyArchiveHubModal: React.FC<Props> = ({
  isOpen,
  onClose,
  data,
  setData,
  addLog,
  currency,
  onSelectArchiveForView,
  activeArchiveView,
  onOpenMonthlyCloseModal
}) => {
  const [selectedArchive, setSelectedArchive] = useState<MonthlyArchive | null>(null);
  const [activeTab, setActiveTab] = useState<'SUMMARY' | 'INVOICES' | 'CUSTOMERS' | 'ACCOUNTS'>('SUMMARY');
  const [searchTerm, setSearchTerm] = useState('');

  if (!isOpen) return null;

  const archives = data.monthlyArchives || [];

  const filteredArchives = archives.filter(a => 
    a.monthName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.periodStartDate.includes(searchTerm) ||
    a.periodEndDate.includes(searchTerm) ||
    (a.notes && a.notes.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const handleDownloadArchiveJson = (archive: MonthlyArchive) => {
    try {
      const jsonStr = JSON.stringify(archive, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `archive_${archive.monthName.replace(/\s+/g, '_')}_${archive.periodStartDate}_to_${archive.periodEndDate}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (e: any) {
      alert('Cillad soo dejinta JSON: ' + e.message);
    }
  };

  const handlePrintMonthlyStatement = (archive: MonthlyArchive) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const rate = data.settings.exchangeRate;
    const storeName = data.settings.businessName;

    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Warbixinta Bisha - ${archive.monthName}</title>
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 24px; color: #1e293b; }
          .header { text-align: center; border-bottom: 2px solid #0f172a; padding-bottom: 16px; margin-bottom: 20px; }
          .title { font-size: 22px; font-weight: 900; text-transform: uppercase; margin: 0; }
          .sub { font-size: 13px; color: #64748b; margin-top: 4px; font-weight: 600; }
          .grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 12px; margin-bottom: 20px; }
          .card { border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; background: #f8fafc; }
          .card-title { font-size: 11px; font-weight: 800; color: #64748b; text-transform: uppercase; }
          .card-val { font-size: 18px; font-weight: 900; margin-top: 4px; }
          table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 12px; }
          th, td { border: 1px solid #e2e8f0; padding: 8px 10px; text-align: left; }
          th { background: #0f172a; color: white; font-weight: 800; text-transform: uppercase; font-size: 10px; }
          .footer { text-align: center; margin-top: 30px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 10px; }
        </style>
      </head>
      <body>
        <div class="header">
          <h1 class="title">${storeName}</h1>
          <div class="sub">BAYAAANKA MAALIYADDA EE BISHA: ${archive.monthName}</div>
          <div class="sub">Muddada: ${archive.periodStartDate} ilaa ${archive.periodEndDate} • Xidhay: ${archive.closedBy}</div>
        </div>

        <div class="grid">
          <div class="card">
            <div class="card-title">Iibka Guud (Total Sales)</div>
            <div class="card-val">$${archive.summary.totalSales.toFixed(2)}</div>
            <div class="sub">${archive.summary.totalTransactionsCount} Invoices / Biilal</div>
          </div>
          <div class="card">
            <div class="card-title">Faa'iidada Saafiga (Net Profit)</div>
            <div class="card-val" style="color: #059669;">$${archive.summary.netProfit.toFixed(2)}</div>
            <div class="sub">Kharashka ka dib</div>
          </div>
          <div class="card">
            <div class="card-title">Kharashka Guud (Expenses)</div>
            <div class="card-val" style="color: #dc2626;">$${archive.summary.totalExpenses.toFixed(2)}</div>
            <div class="sub">Dukaan + Khudaar</div>
          </div>
          <div class="card">
            <div class="card-title">Deymaha Lagu Leeyahay Macaamiisha</div>
            <div class="card-val" style="color: #d97706;">$${archive.summary.totalCustomerDebt.toFixed(2)}</div>
            <div class="sub">Debtors at close</div>
          </div>
        </div>

        <h3 style="font-size: 14px; text-transform: uppercase; font-weight: 800; margin-top: 24px;">Bayaanka Akoonnada (Accounts Summary)</h3>
        <table>
          <thead>
            <tr>
              <th>Akoonka</th>
              <th>Nooca</th>
              <th>Haraaga ($ USD)</th>
              <th>Haraaga (ETB)</th>
            </tr>
          </thead>
          <tbody>
            ${archive.summary.accountsSummary.map(acc => `
              <tr>
                <td style="font-weight: 700;">${acc.name}</td>
                <td>${acc.type}</td>
                <td style="font-weight: 800;">$${acc.balance.toFixed(2)}</td>
                <td>${(acc.balance * rate).toLocaleString()} ETB</td>
              </tr>
            `).join('')}
          </tbody>
        </table>

        <div class="footer">
          Warbixintan waxaa si rasmi ah looga soo saaray nidaamka ERP ee ${storeName} • Taariikhda: ${new Date(archive.closedAt).toLocaleString()}
        </div>
      </body>
      </html>
    `;

    printWindow.document.write(htmlContent);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
    }, 300);
  };

  const handleRestoreArchive = (archive: MonthlyArchive) => {
    if (!confirm(
      `⚠️ DIB U FUR BISHA (RESTORE ARCHIVE TO ACTIVE):\n\n` +
      `Ma hubtaa inaad dib u furto bisha "${archive.monthName}" oo aad ka dhigto bisha hadda firfircoon?\n\n` +
      `Tani waxay dib u soo celinaysaa dhammaan biilashii, deymihii, iyo dhaqdhaqaaqii bishan.`
    )) return;

    setData(prev => ({
      ...prev,
      transactions: [...archive.snapshotData.transactions],
      expenses: [...archive.snapshotData.expenses],
      stockAdjustments: [...archive.snapshotData.stockAdjustments],
      khudaarSales: [...(archive.snapshotData.khudaarSales || [])],
      khudaarExpenses: [...(archive.snapshotData.khudaarExpenses || [])],
      accountTransfers: [...(archive.snapshotData.accountTransfers || [])],
      customers: [...archive.snapshotData.customers],
      suppliers: [...archive.snapshotData.suppliers],
      accounts: [...archive.snapshotData.accounts],
      currentPeriodName: archive.monthName,
      currentPeriodStartedAt: archive.closedAt,
      lastModified: Date.now()
    }));

    addLog('Monthly Archive Restored', `Dib loo furay bishii: ${archive.monthName}`);
    onSelectArchiveForView(null);
    onClose();
    alert(`✅ Bisha "${archive.monthName}" si guul leh ayaa dib loogu furay!`);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[120] flex items-center justify-center p-3 md:p-6 overflow-y-auto animate-in fade-in duration-200">
      <div className="bg-white rounded-[36px] shadow-2xl max-w-5xl w-full overflow-hidden border border-slate-100 my-auto flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white p-6 md:p-7 flex items-center justify-between flex-shrink-0">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-blue-600/30 border border-blue-500/40 flex items-center justify-center text-blue-400">
              <Archive size={24} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl md:text-2xl font-black tracking-tight">
                  Kaydka Bilaha Hore (Monthly Archives)
                </h2>
                <span className="px-2.5 py-0.5 bg-blue-500 text-white rounded-full text-[10px] font-black">
                  {archives.length} Bilood
                </span>
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Eeg dhaqdhaqaaqii, iibkii, faa'iidadii, iyo deymihii bil kasta 1-Click adigoo aan lumin bisha cusub.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenMonthlyCloseModal();
              }}
              className="hidden sm:flex items-center gap-1.5 px-3.5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black shadow-md transition-all active:scale-95 cursor-pointer"
            >
              <Lock size={14} /> Xidh Bisha Hadda ($0)
            </button>
            <button 
              onClick={onClose}
              className="w-10 h-10 rounded-2xl bg-white/10 hover:bg-white/20 flex items-center justify-center text-white transition-all cursor-pointer"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Active Archive View Notice */}
        {activeArchiveView && (
          <div className="p-3.5 bg-amber-500 text-slate-950 flex items-center justify-between px-6 flex-shrink-0 font-bold text-xs border-b border-amber-600/30">
            <div className="flex items-center gap-2">
              <Sparkles size={16} />
              <span>
                Hadda waxaad ku jirtaa Archive View: <strong>{activeArchiveView.monthName}</strong>
              </span>
            </div>
            <button
              onClick={() => {
                onSelectArchiveForView(null);
                onClose();
              }}
              className="px-3 py-1 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-800 transition-all cursor-pointer"
            >
              ⚡ Ku Noqo Bisha Cusub ($0)
            </button>
          </div>
        )}

        {/* Modal Main Workspace */}
        <div className="flex-1 overflow-hidden grid grid-cols-1 md:grid-cols-12 min-h-0">
          {/* Left Column: Archives List */}
          <div className="md:col-span-4 border-r border-slate-200/80 bg-slate-50/50 flex flex-col min-h-0">
            <div className="p-4 border-b border-slate-200/60 bg-white">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Raadi bil hore..."
                  value={searchTerm}
                  onChange={e => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-slate-100 border-none rounded-xl text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-600"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {archives.length === 0 ? (
                <div className="p-8 text-center text-slate-400 space-y-3">
                  <div className="w-12 h-12 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto text-slate-400">
                    <Calendar size={22} />
                  </div>
                  <p className="text-xs font-bold">Weli bil lama xidhin.</p>
                  <p className="text-[11px] text-slate-400">
                    Marka ay bishu dhamaato, guji <strong>"Xidh Bisha & Bilow Bil Cusub"</strong> si xogteeda 100% loogu kaydiyo halkan.
                  </p>
                  <button
                    onClick={() => {
                      onClose();
                      onOpenMonthlyCloseModal();
                    }}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-black shadow-sm"
                  >
                    Xidh Bisha Hadda
                  </button>
                </div>
              ) : filteredArchives.length === 0 ? (
                <div className="p-6 text-center text-slate-400 text-xs font-bold">
                  Ma jirto bil ku habboon baaritaankaaga.
                </div>
              ) : (
                filteredArchives.map(archive => {
                  const isSelected = selectedArchive?.id === archive.id;
                  const isActiveAppView = activeArchiveView?.id === archive.id;

                  return (
                    <div
                      key={archive.id}
                      onClick={() => setSelectedArchive(archive)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer text-left ${
                        isSelected 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-600/20' 
                          : 'bg-white hover:bg-slate-100 text-slate-800 border-slate-200/80'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-0.5 rounded-md ${
                          isSelected ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-600'
                        }`}>
                          {archive.periodStartDate} ilaa {archive.periodEndDate}
                        </span>
                        {isActiveAppView && (
                          <span className="px-1.5 py-0.5 bg-amber-400 text-slate-950 font-black text-[9px] rounded-md animate-pulse">
                            ACTIVE VIEW
                          </span>
                        )}
                      </div>

                      <h4 className="text-sm font-black tracking-tight truncate">
                        {archive.monthName}
                      </h4>

                      <div className="grid grid-cols-2 gap-2 mt-2 pt-2 border-t border-current/10 text-xs">
                        <div>
                          <p className={`text-[9px] font-bold ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>Iibka</p>
                          <p className="font-black">${archive.summary.totalSales.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className={`text-[9px] font-bold ${isSelected ? 'text-blue-100' : 'text-slate-400'}`}>Faa'iidada</p>
                          <p className={`font-black ${isSelected ? 'text-emerald-200' : 'text-emerald-600'}`}>
                            ${archive.summary.netProfit.toFixed(2)}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Selected Archive Deep Inspection */}
          <div className="md:col-span-8 bg-white flex flex-col min-h-0 overflow-y-auto">
            {selectedArchive ? (
              <div className="p-6 md:p-8 space-y-6">
                {/* Archive Top Card */}
                <div className="p-6 bg-gradient-to-br from-slate-900 to-blue-950 text-white rounded-3xl shadow-xl flex flex-wrap items-center justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2.5 py-0.5 bg-blue-500/30 text-blue-300 rounded-md text-[10px] font-black uppercase tracking-wider border border-blue-400/20">
                        {selectedArchive.periodStartDate} ilaa {selectedArchive.periodEndDate}
                      </span>
                      <span className="text-xs text-slate-400 font-bold">• Xidhay: {selectedArchive.closedBy}</span>
                    </div>
                    <h3 className="text-xl md:text-2xl font-black tracking-tight text-white">
                      {selectedArchive.monthName}
                    </h3>
                    {selectedArchive.notes && (
                      <p className="text-xs text-slate-300 mt-1 italic font-medium">"{selectedArchive.notes}"</p>
                    )}
                  </div>

                  {/* 1-Click Actions for this Month */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      onClick={() => {
                        onSelectArchiveForView(selectedArchive);
                        onClose();
                      }}
                      className="px-4 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-black rounded-xl shadow-lg flex items-center gap-1.5 transition-all active:scale-95 cursor-pointer"
                      title="1-Click: U wareeji nidaamka oo dhan bishan si aad u eegto iibka, biilasha, deymaha iyo accounting-ka"
                    >
                      <Eye size={15} /> 1-Click View (Fur Bishan)
                    </button>

                    <button
                      onClick={() => handlePrintMonthlyStatement(selectedArchive)}
                      className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all cursor-pointer"
                      title="Daabac Bayaanka Maaliyadda (Print Statement)"
                    >
                      <Printer size={16} />
                    </button>

                    <button
                      onClick={() => handleDownloadArchiveJson(selectedArchive)}
                      className="p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all cursor-pointer"
                      title="Soo Dejiso Backup JSON (Download Backup)"
                    >
                      <Download size={16} />
                    </button>
                  </div>
                </div>

                {/* Sub-tabs for detailed view */}
                <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                  <button
                    onClick={() => setActiveTab('SUMMARY')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      activeTab === 'SUMMARY' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Bayaanka Guud (Summary)
                  </button>

                  <button
                    onClick={() => setActiveTab('INVOICES')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      activeTab === 'INVOICES' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Biilasha ({selectedArchive.snapshotData.transactions.length})
                  </button>

                  <button
                    onClick={() => setActiveTab('CUSTOMERS')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      activeTab === 'CUSTOMERS' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Deymaha Macaamiisha ({selectedArchive.snapshotData.customers.filter(c => c.debtBalance > 0).length})
                  </button>

                  <button
                    onClick={() => setActiveTab('ACCOUNTS')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer ${
                      activeTab === 'ACCOUNTS' ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    Akoonnada ({selectedArchive.summary.accountsSummary.length})
                  </button>
                </div>

                {/* Tab: Summary */}
                {activeTab === 'SUMMARY' && (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200">
                        <p className="text-[10px] font-black text-slate-500 uppercase">Iibka Guud (Sales)</p>
                        <p className="text-lg font-black text-slate-900 mt-1">
                          ${selectedArchive.summary.totalSales.toFixed(2)}
                        </p>
                        <p className="text-[10px] text-slate-500 font-bold mt-0.5">
                          {selectedArchive.summary.totalTransactionsCount} Invoices
                        </p>
                      </div>

                      <div className="p-4 bg-emerald-50 rounded-2xl border border-emerald-200">
                        <p className="text-[10px] font-black text-emerald-600 uppercase">Faa'iido Saafi ah</p>
                        <p className="text-lg font-black text-emerald-950 mt-1">
                          ${selectedArchive.summary.netProfit.toFixed(2)}
                        </p>
                        <p className="text-[10px] text-emerald-700 font-bold mt-0.5">Net Margin</p>
                      </div>

                      <div className="p-4 bg-rose-50 rounded-2xl border border-rose-200">
                        <p className="text-[10px] font-black text-rose-600 uppercase">Kharashka Guud</p>
                        <p className="text-lg font-black text-rose-950 mt-1">
                          ${selectedArchive.summary.totalExpenses.toFixed(2)}
                        </p>
                        <p className="text-[10px] text-rose-700 font-bold mt-0.5">
                          {selectedArchive.snapshotData.expenses.length} Records
                        </p>
                      </div>

                      <div className="p-4 bg-amber-50 rounded-2xl border border-amber-200">
                        <p className="text-[10px] font-black text-amber-600 uppercase">Deymaha Macaamiisha</p>
                        <p className="text-lg font-black text-amber-950 mt-1">
                          ${selectedArchive.summary.totalCustomerDebt.toFixed(2)}
                        </p>
                        <p className="text-[10px] text-amber-700 font-bold mt-0.5">At Close</p>
                      </div>
                    </div>

                    {/* Accounting Balances at Period Close */}
                    <div>
                      <h4 className="text-xs font-black text-slate-700 uppercase tracking-wider mb-2.5">
                        Haraaga Akoonnada Waqtiga Xidhitaanka (Ending Balances)
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {selectedArchive.summary.accountsSummary.map(acc => (
                          <div key={acc.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                            <div>
                              <p className="text-xs font-black text-slate-800">{acc.name}</p>
                              <p className="text-[10px] text-slate-400 font-bold">{acc.type}</p>
                            </div>
                            <p className="text-sm font-black text-slate-900">${acc.balance.toFixed(2)}</p>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Restore Notice & Trigger */}
                    <div className="p-4 bg-slate-100 rounded-2xl border border-slate-200 flex items-center justify-between gap-4">
                      <div>
                        <p className="text-xs font-black text-slate-800">Ma doonaysaa inaad dib u furto bishan?</p>
                        <p className="text-[11px] text-slate-500">
                          Haddii aad si khaldan u xidhay, waxaad ku celin kartaa xogteeda nidaamka firfircoon.
                        </p>
                      </div>
                      <button
                        onClick={() => handleRestoreArchive(selectedArchive)}
                        className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all cursor-pointer flex-shrink-0"
                      >
                        <RotateCcw size={14} /> Dib u Fur Bisha
                      </button>
                    </div>
                  </div>
                )}

                {/* Tab: Invoices */}
                {activeTab === 'INVOICES' && (
                  <div className="space-y-3">
                    <div className="max-h-[350px] overflow-y-auto space-y-2 pr-1">
                      {selectedArchive.snapshotData.transactions.length === 0 ? (
                        <p className="text-xs text-slate-400 font-bold text-center py-8">Biilal lama diiwaangelin bishan.</p>
                      ) : (
                        selectedArchive.snapshotData.transactions.map(tx => (
                          <div key={tx.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                            <div>
                              <p className="font-black text-slate-800">
                                #{tx.id.slice(-6).toUpperCase()} • {tx.customerName || 'Macaamiil'}
                              </p>
                              <p className="text-[10px] text-slate-500">
                                {new Date(tx.timestamp).toLocaleString()} • {tx.paymentMethod} • {tx.items?.length || 0} items
                              </p>
                            </div>
                            <p className="text-sm font-black text-blue-600">${tx.total.toFixed(2)}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Tab: Customers & Debts */}
                {activeTab === 'CUSTOMERS' && (
                  <div className="space-y-3">
                    <div className="max-h-[350px] overflow-y-auto space-y-2 pr-1">
                      {selectedArchive.snapshotData.customers.filter(c => c.debtBalance > 0).length === 0 ? (
                        <p className="text-xs text-slate-400 font-bold text-center py-8">Deyn laguma lahayn macaamiisha bishan.</p>
                      ) : (
                        selectedArchive.snapshotData.customers.filter(c => c.debtBalance > 0).map(c => (
                          <div key={c.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between text-xs">
                            <div>
                              <p className="font-black text-slate-800">{c.name}</p>
                              <p className="text-[10px] text-slate-500">{c.phone || 'Tel la\'aan'}</p>
                            </div>
                            <p className="text-sm font-black text-amber-600">${c.debtBalance.toFixed(2)}</p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}

                {/* Tab: Accounts */}
                {activeTab === 'ACCOUNTS' && (
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {selectedArchive.summary.accountsSummary.map(acc => (
                        <div key={acc.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-200 flex items-center justify-between">
                          <div>
                            <p className="text-xs font-black text-slate-800">{acc.name}</p>
                            <p className="text-[10px] text-slate-500 font-bold">{acc.type}</p>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-black text-slate-900">${acc.balance.toFixed(2)}</p>
                            <p className="text-[10px] text-slate-400">
                              {(acc.balance * data.settings.exchangeRate).toLocaleString()} ETB
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-12 text-center text-slate-400 space-y-3 my-auto">
                <div className="w-16 h-16 bg-slate-100 rounded-3xl flex items-center justify-center mx-auto text-slate-400">
                  <Archive size={28} />
                </div>
                <h4 className="text-base font-black text-slate-700">Dooro Bil Hore si aad u Baarto</h4>
                <p className="text-xs text-slate-400 max-w-sm mx-auto">
                  Dhanka bidix ka dooro bil aad horay u xidhay si aad u aragto dhammaan biilashii, deymihii, iyo faa'iidadii bishaas.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
export default MonthlyArchiveHubModal;
