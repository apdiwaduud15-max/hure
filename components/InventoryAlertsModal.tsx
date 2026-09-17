import React, { useState, useMemo } from 'react';
import { AppData, Product, Currency } from '../types';
import { 
  AlertTriangle, 
  CalendarX, 
  TrendingDown, 
  Clock, 
  CheckCircle2, 
  X, 
  Search, 
  ArrowRight, 
  Package, 
  Edit3, 
  Bell,
  Sparkles,
  ShieldAlert,
  Trash2,
  Printer
} from 'lucide-react';
import { formatCurrency } from '../lib/utils';

interface InventoryAlertsModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  currency: Currency;
  onNavigateToProducts?: () => void;
}

export const InventoryAlertsModal: React.FC<InventoryAlertsModalProps> = ({
  isOpen,
  onClose,
  data,
  setData,
  currency,
  onNavigateToProducts
}) => {
  const [activeTab, setActiveTab] = useState<'EXPIRED' | 'LOW_STOCK' | 'DEAD_STOCK'>('EXPIRED');
  const [searchQuery, setSearchQuery] = useState('');

  const rate = data.settings.exchangeRate;
  const now = new Date();
  const todayTime = now.getTime();
  const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = todayTime - thirtyDaysMs;

  // 1. Expired & Nearing Expiry (Within 90 Days / 3 Months)
  const expiryAlerts = useMemo(() => {
    return data.products.filter(p => {
      if (!p.expiryDate) return false;
      const expTime = new Date(p.expiryDate).getTime();
      const diffDays = Math.ceil((expTime - todayTime) / (1000 * 60 * 60 * 24));
      return diffDays <= 90; // Expired or expiring within 90 days (3 months)
    }).map(p => {
      const expTime = new Date(p.expiryDate!).getTime();
      const diffDays = Math.ceil((expTime - todayTime) / (1000 * 60 * 60 * 24));
      return {
        ...p,
        diffDays,
        isExpired: diffDays <= 0
      };
    }).sort((a, b) => a.diffDays - b.diffDays);
  }, [data.products, todayTime]);

  // 2. Low Stock Items
  const lowStockAlerts = useMemo(() => {
    return data.products.filter(p => {
      // Exclude service / infinite stock items (e.g. ice cream)
      if (p.stock >= 9000) return false;
      const minThreshold = p.minStock !== undefined ? p.minStock : 0;
      return p.stock <= minThreshold;
    }).sort((a, b) => a.stock - b.stock);
  }, [data.products]);

  // 3. Unsold in 30 Days (Dead Stock / Slow Moving)
  const deadStockAlerts = useMemo(() => {
    // Calculate total sold in past 30 days for each product
    const salesIn30DaysMap: Record<string, number> = {};
    
    data.transactions.forEach(tx => {
      if (tx.timestamp >= thirtyDaysAgo && tx.type === 'SALE') {
        tx.items.forEach(item => {
          salesIn30DaysMap[item.id] = (salesIn30DaysMap[item.id] || 0) + item.quantity;
        });
      }
    });

    return data.products.filter(p => {
      if (p.stock <= 0 || p.stock >= 9000) return false;
      const soldQty = salesIn30DaysMap[p.id] || 0;
      if (soldQty > 0) return false;

      const lastSale = p.lastSoldAt;
      const baseline = lastSale || p.trackingStartedAt || p.createdAt || todayTime;
      const diffMs = todayTime - baseline;
      const daysUnsold = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
      return daysUnsold >= 30;
    });
  }, [data.products, data.transactions, thirtyDaysAgo, todayTime]);

  const totalAlertCount = expiryAlerts.length + lowStockAlerts.length + deadStockAlerts.length;

  if (!isOpen) return null;

  // Filter list by search query
  const filterList = (list: any[]) => {
    if (!searchQuery.trim()) return list;
    const q = searchQuery.toLowerCase();
    return list.filter(item => 
      item.name.toLowerCase().includes(q) || 
      (item.sku && item.sku.toLowerCase().includes(q)) ||
      (item.category && item.category.toLowerCase().includes(q))
    );
  };

  const handleDiscardExpiredProduct = (productId: string, productName: string) => {
    if (confirm(`Ma ziineysaa inaad kaydka ka saarto alaabta dhacday: "${productName}"?`)) {
      setData(prev => ({
        ...prev,
        products: prev.products.map(p => p.id === productId ? { ...p, stock: 0 } : p)
      }));
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 md:p-6 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="bg-white rounded-[36px] shadow-2xl border border-slate-100 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white p-6 md:p-8 flex items-center justify-between relative overflow-hidden">
          <div className="absolute top-0 right-0 w-80 h-80 bg-rose-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="relative z-10 flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-rose-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-rose-500/20">
              <ShieldAlert size={28} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full bg-rose-500/20 text-rose-300 font-black text-[10px] uppercase tracking-wider border border-rose-500/30">
                  Nidaamka Digniinta Alaabta
                </span>
                <span className="text-slate-400 text-xs font-bold">• Xaaladda Maanta</span>
              </div>
              <h2 className="text-2xl md:text-3xl font-black tracking-tight mt-0.5">
                Digniinta Kaydka Alaabta (Inventory Alerts)
              </h2>
              <p className="text-slate-400 text-xs font-medium mt-1">
                Waxaa jira <strong className="text-rose-400 font-bold">{totalAlertCount} alaab</strong> oo u baahan fiiro gaar ah (Dhacday, Dhamaanaysa ama Aan Socon).
              </p>
            </div>
          </div>

          <button 
            onClick={onClose}
            className="relative z-10 p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-full transition-colors active:scale-95"
            title="Xir"
          >
            <X size={20} />
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="bg-slate-100/80 p-3 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Tab 1: Expiry */}
            <button
              onClick={() => setActiveTab('EXPIRED')}
              className={`px-4 py-2.5 rounded-2xl font-black text-xs transition-all flex items-center gap-2 ${
                activeTab === 'EXPIRED'
                  ? 'bg-rose-600 text-white shadow-md shadow-rose-900/20'
                  : 'bg-white text-slate-700 hover:bg-slate-200/80'
              }`}
            >
              <CalendarX size={16} />
              <span>Dhacday / Dhowaan Dhacayso</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'EXPIRED' ? 'bg-white text-rose-700' : 'bg-rose-100 text-rose-700'
              }`}>
                {expiryAlerts.length}
              </span>
            </button>

            {/* Tab 2: Low Stock */}
            <button
              onClick={() => setActiveTab('LOW_STOCK')}
              className={`px-4 py-2.5 rounded-2xl font-black text-xs transition-all flex items-center gap-2 ${
                activeTab === 'LOW_STOCK'
                  ? 'bg-amber-500 text-white shadow-md shadow-amber-900/20'
                  : 'bg-white text-slate-700 hover:bg-slate-200/80'
              }`}
            >
              <TrendingDown size={16} />
              <span>Iga Sii Dhamaanaysa</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'LOW_STOCK' ? 'bg-white text-amber-800' : 'bg-amber-100 text-amber-800'
              }`}>
                {lowStockAlerts.length}
              </span>
            </button>

            {/* Tab 3: Dead Stock */}
            <button
              onClick={() => setActiveTab('DEAD_STOCK')}
              className={`px-4 py-2.5 rounded-2xl font-black text-xs transition-all flex items-center gap-2 ${
                activeTab === 'DEAD_STOCK'
                  ? 'bg-purple-600 text-white shadow-md shadow-purple-900/20'
                  : 'bg-white text-slate-700 hover:bg-slate-200/80'
              }`}
            >
              <Clock size={16} />
              <span>1 Bil Aan Soconin (Dead Stock)</span>
              <span className={`px-2 py-0.5 rounded-full text-[10px] font-black ${
                activeTab === 'DEAD_STOCK' ? 'bg-white text-purple-800' : 'bg-purple-100 text-purple-800'
              }`}>
                {deadStockAlerts.length}
              </span>
            </button>
          </div>

          {/* Search bar inside modal */}
          <div className="relative min-w-[200px] flex-1 sm:flex-initial">
            <Search size={14} className="absolute left-3 top-3 text-slate-400" />
            <input
              type="text"
              placeholder="Raadi magaca alaabta..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-800 outline-none focus:border-slate-400"
            />
          </div>
        </div>

        {/* Content Body */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          
          {/* TAB 1: EXPIRED & NEARING EXPIRY */}
          {activeTab === 'EXPIRED' && (
            <div className="space-y-3">
              <div className="p-4 bg-rose-50 border border-rose-200 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <CalendarX size={20} className="text-rose-600" />
                  <div>
                    <h4 className="font-black text-rose-900 text-sm">Alaabta Dhacday ama 90 Maalmood (3 Bilood) Ka Dhansan tahay</h4>
                    <p className="text-xs text-rose-700 font-medium">Alaabtan waxay dhacayaan ama 90 maalmood (3 bilood) ka yar ayaa u dhiman taariikhdoodii dhicitaanka (Expiry Date).</p>
                  </div>
                </div>
              </div>

              {filterList(expiryAlerts).length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
                  <p className="font-bold text-slate-600 text-sm">Ma jiro alaab dhacday ama dhowaan dhacayso!</p>
                  <p className="text-xs">Dhammaan alaabtaada taariikhdoodu waa mid ammaan ah.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filterList(expiryAlerts).map(item => (
                    <div 
                      key={item.id}
                      className={`p-4 rounded-2xl border-2 flex items-center justify-between transition-all ${
                        item.isExpired 
                          ? 'border-rose-300 bg-rose-50/60 hover:bg-rose-50' 
                          : 'border-amber-300 bg-amber-50/60 hover:bg-amber-50'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black uppercase ${
                            item.isExpired ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'
                          }`}>
                            {item.isExpired ? 'DHACDAY (EXPIRED)' : `DHOOBAHN (${item.diffDays} Maalmood)`}
                          </span>
                          <span className="text-xs font-bold text-slate-500">{item.category}</span>
                        </div>
                        <h3 className="font-black text-slate-900 text-sm">{item.name}</h3>
                        <p className="text-xs font-bold text-slate-600">
                          Taariikhda Dhicitaanka: <span className="text-slate-900 underline">{item.expiryDate}</span>
                        </p>
                        <p className="text-xs text-slate-500 font-medium">
                          Kaydka Hada: <strong className="text-slate-900">{item.stock} {item.unit || 'PCS'}</strong>
                        </p>
                      </div>

                      <div className="flex flex-col items-end gap-2">
                        <span className="text-sm font-black text-slate-900">
                          {formatCurrency(item.sellPrice, currency, rate)}
                        </span>
                        <button
                          onClick={() => handleDiscardExpiredProduct(item.id, item.name)}
                          className="px-3 py-1.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-xs flex items-center gap-1 active:scale-95 transition-all"
                          title="Tirtir kaydka"
                        >
                          <Trash2 size={12} />
                          <span>0 Ka Dhig Kaydka</span>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: LOW STOCK */}
          {activeTab === 'LOW_STOCK' && (
            <div className="space-y-3">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <TrendingDown size={20} className="text-amber-600" />
                  <div>
                    <h4 className="font-black text-amber-900 text-sm">Alaabta Iga Sii Dhamaanaysa (Low Stock Warning)</h4>
                    <p className="text-xs text-amber-700 font-medium">Alaabtan tiradoodu waxay hoos uga dhacday xadka ugu yar (Minimum Stock Threshold).</p>
                  </div>
                </div>
              </div>

              {filterList(lowStockAlerts).length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
                  <p className="font-bold text-slate-600 text-sm">Dhammaan alaabtu kayd ku filan ayaa u yaalla!</p>
                  <p className="text-xs">Ma jiro alaab tiradeedu hoos uga dhacday 5 PCS.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filterList(lowStockAlerts).map(item => (
                    <div 
                      key={item.id}
                      className="p-4 rounded-2xl border-2 border-amber-200 bg-amber-50/40 hover:bg-amber-50/80 flex items-center justify-between transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase bg-amber-500 text-white">
                            LOW STOCK ({item.stock} left)
                          </span>
                          <span className="text-xs font-bold text-slate-500">{item.category}</span>
                        </div>
                        <h3 className="font-black text-slate-900 text-sm">{item.name}</h3>
                        <p className="text-xs text-slate-600 font-medium">
                          SKU / Barcode: <strong className="text-slate-800">{item.barcode || item.sku || 'N/A'}</strong>
                        </p>
                      </div>

                      <div className="text-right space-y-1">
                        <span className="text-sm font-black text-emerald-700 block">
                          {formatCurrency(item.sellPrice, currency, rate)}
                        </span>
                        <span className="px-2.5 py-1 bg-amber-100 text-amber-900 font-black text-xs rounded-lg inline-block">
                          {item.stock <= 0 ? '❌ DHAMMATAY' : `⚠️ ${item.stock} ${item.unit || 'PCS'}`}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: DEAD STOCK / UNSOLD IN 30 DAYS */}
          {activeTab === 'DEAD_STOCK' && (
            <div className="space-y-3">
              <div className="p-4 bg-purple-50 border border-purple-200 rounded-2xl flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Clock size={20} className="text-purple-600" />
                  <div>
                    <h4 className="font-black text-purple-900 text-sm">Alaabta Mudo 1 Bil Ah Aan Waxba Ka Soconin (Dead Stock)</h4>
                    <p className="text-xs text-purple-700 font-medium">Alaabtan kayd ayaa u yaalla balse ma jiro wax la iibiyay 30-kii maalmood ee u dambeeyay.</p>
                  </div>
                </div>
              </div>

              {filterList(deadStockAlerts).length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <CheckCircle2 size={40} className="mx-auto text-emerald-500" />
                  <p className="font-bold text-slate-600 text-sm">Dhammaan alaabtaadu si fiican ayay u socotaa!</p>
                  <p className="text-xs">Ma jiro alaab aan 30 maalmood waxba ka iibsan.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {filterList(deadStockAlerts).map(item => (
                    <div 
                      key={item.id}
                      className="p-4 rounded-2xl border-2 border-purple-200 bg-purple-50/40 hover:bg-purple-50/80 flex items-center justify-between transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-lg text-[10px] font-black uppercase bg-purple-600 text-white">
                            30+ Maalmood Aan Socon
                          </span>
                          <span className="text-xs font-bold text-slate-500">{item.category}</span>
                        </div>
                        <h3 className="font-black text-slate-900 text-sm">{item.name}</h3>
                        <p className="text-xs text-purple-800 font-medium">
                          Stock Yaalla: <strong className="font-black">{item.stock} {item.unit || 'PCS'}</strong>
                        </p>
                      </div>

                      <div className="text-right space-y-1">
                        <span className="text-xs text-slate-400 font-bold block">Qiimaha Iibka</span>
                        <span className="text-sm font-black text-slate-900 block">
                          {formatCurrency(item.sellPrice, currency, rate)}
                        </span>
                        <span className="text-[10px] font-bold text-purple-700 bg-purple-100 px-2 py-0.5 rounded-md inline-block">
                          Warta Lacagta: {formatCurrency(item.stock * item.sellPrice, currency, rate)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-slate-500 font-bold flex items-center gap-2">
            <Sparkles size={16} className="text-amber-500" />
            <span>Fiiro gaar ah: Nidaamku wuxuu si toos ah u cusbooneysiiyaa digniinahan mar kasta oo aad dukaanka furto.</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black text-xs flex items-center gap-2 shadow-md active:scale-95 transition-all"
              title="Daabac warbixinta digniinaha"
            >
              <Printer size={14} />
              <span>Daabac Digniinaha</span>
            </button>

            {onNavigateToProducts && (
              <button
                onClick={() => {
                  onClose();
                  onNavigateToProducts();
                }}
                className="px-5 py-2.5 bg-slate-900 hover:bg-black text-white rounded-2xl font-black text-xs flex items-center gap-2 shadow-md active:scale-95 transition-all"
              >
                <span>Aad Maamulka Alaabta (Products)</span>
                <ArrowRight size={14} />
              </button>
            )}

            <button
              onClick={onClose}
              className="px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs shadow-md active:scale-95 transition-all"
            >
              Fahamay & Xir
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
