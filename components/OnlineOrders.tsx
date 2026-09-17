import React, { useState } from 'react';
import { AppData, OnlineOrder, Transaction, Currency, PaymentMethod, Customer } from '../types';
import { 
  ShoppingBag, 
  CheckCircle2, 
  Truck, 
  Eye, 
  Phone, 
  MapPin, 
  User, 
  Clock, 
  CreditCard, 
  Receipt as ReceiptIcon, 
  Search, 
  ExternalLink,
  X,
  Printer,
  Compass,
  DollarSign,
  AlertCircle,
  FileCheck
} from 'lucide-react';
import { generateId, formatCurrency } from '../lib/utils';

interface Props {
  data: AppData;
  currency?: Currency;
  onUpdateOrders: (
    updatedOrders: OnlineOrder[], 
    newTransaction?: Transaction, 
    updatedProducts?: AppData['products'],
    updatedCustomers?: Customer[]
  ) => void;
}

export const OnlineOrders: React.FC<Props> = ({ data, currency, onUpdateOrders }) => {
  const activeCurrency = currency || data.settings.defaultCurrency || Currency.ETB;
  const rate = data.settings.exchangeRate || 190;
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PENDING' | 'APPROVED' | 'DELIVERED' | 'CANCELLED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<OnlineOrder | null>(null);
  const [printableOrder, setPrintableOrder] = useState<OnlineOrder | null>(null);

  const orders = data.onlineOrders || [];

  const filteredOrders = orders.filter(ord => {
    const matchesStatus = statusFilter === 'ALL' || ord.status === statusFilter;
    const matchesSearch = ord.customer.fullName.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          ord.customer.phone.includes(searchQuery) ||
                          ord.customer.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          ord.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const pendingCount = orders.filter(o => o.status === 'PENDING').length;

  // APPROVE ONLINE ORDER / DEBT PAYMENT
  const handleApproveOrder = (order: OnlineOrder) => {
    if (order.status === 'APPROVED' || order.status === 'DELIVERED') {
      alert('Order-kan horey ayaa loo ansixiyay!');
      return;
    }

    const isDebtPayment = order.orderType === 'DEBT_PAYMENT';
    const isCreditPurchase = order.paymentMethod === 'Deyn (Credit)';

    const actionText = isDebtPayment 
      ? `Ma rabtaa inaad ansixiso bixinta deynta ee $${order.totalAmount.toFixed(2)} oo aad ka gooyso deynka customer-ka?`
      : isCreditPurchase 
        ? `Ma rabtaa inaad ansixiso iibkan deynta ah oo aad ugu qorto deyn customer-ka?`
        : `Ma rabtaa inaad ansixiso dalbadka ${order.id} oo aad u bedesho iib ERP ah?`;

    if (!confirm(actionText)) {
      return;
    }

    let updatedProducts = data.products;
    let updatedCustomers = data.customers;

    // Find customer in ERP database
    let matchingCust = data.customers.find(
      c => c.phone === order.customer.phone || c.name.toLowerCase() === order.customer.fullName.toLowerCase()
    );

    // If customer doesn't exist yet in ERP database, create record
    if (!matchingCust) {
      matchingCust = {
        id: order.customer.phone || generateId(),
        name: order.customer.fullName,
        phone: order.customer.phone,
        debtBalance: 0,
        loyaltyPoints: 0,
        history: []
      };
      updatedCustomers = [...data.customers, matchingCust];
    }

    let newTx: Transaction | undefined = undefined;

    if (isDebtPayment) {
      // 1. Reduce Customer Debt Balance
      const amountPaid = order.debtAmountPaid || order.totalAmount;
      updatedCustomers = updatedCustomers.map(c => {
        if (c.phone === order.customer.phone || c.id === matchingCust?.id) {
          return {
            ...c,
            debtBalance: Math.max(0, c.debtBalance - amountPaid),
            history: [order.id, ...c.history]
          };
        }
        return c;
      });

      // 2. Create Debt Payment Transaction in ERP
      newTx = {
        id: generateId(),
        items: [],
        subtotal: amountPaid,
        tax: 0,
        total: amountPaid,
        currency: Currency.USD,
        exchangeRate: data.settings.exchangeRate || 125,
        paymentMethod: PaymentMethod.MOBILE_MONEY,
        customerId: matchingCust.id,
        timestamp: Date.now(),
        type: 'DEBT_PAYMENT'
      };
    } else {
      // PURCHASE ORDER:
      // 1. Deduct Product Stock
      updatedProducts = data.products.map(p => {
        const orderedItem = order.items.find(i => i.id === p.id);
        if (orderedItem) {
          return {
            ...p,
            stock: Math.max(0, p.stock - orderedItem.quantity)
          };
        }
        return p;
      });

      // 2. If Credit Purchase, Increase Customer Debt
      if (isCreditPurchase) {
        updatedCustomers = updatedCustomers.map(c => {
          if (c.phone === order.customer.phone || c.id === matchingCust?.id) {
            return {
              ...c,
              debtBalance: c.debtBalance + order.totalAmount,
              history: [order.id, ...c.history]
            };
          }
          return c;
        });
      }

      // 3. Create Sale Transaction
      newTx = {
        id: generateId(),
        items: order.items,
        subtotal: order.subtotal,
        tax: 0,
        total: order.totalAmount,
        currency: Currency.USD,
        exchangeRate: data.settings.exchangeRate || 125,
        paymentMethod: isCreditPurchase ? PaymentMethod.DEBT : PaymentMethod.MOBILE_MONEY,
        customerId: matchingCust.id,
        timestamp: Date.now(),
        type: 'SALE'
      };
    }

    // Update order status to APPROVED
    const updatedOrders = orders.map(o => o.id === order.id ? { ...o, status: 'APPROVED' as const } : o);

    onUpdateOrders(updatedOrders, newTx, updatedProducts, updatedCustomers);
    setSelectedOrder(null);
    alert(`Si guul leh ayaa loo ansixiyay ${order.id}! Xisaabta dukaankana waa la habeyay.`);
  };

  const handleStatusChange = (orderId: string, newStatus: 'DELIVERED' | 'CANCELLED') => {
    const updatedOrders = orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o);
    onUpdateOrders(updatedOrders);
    setSelectedOrder(null);
  };

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-blue-700 via-indigo-800 to-purple-900 text-white p-6 md:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-md rounded-2xl flex items-center justify-center shrink-0">
            <ShoppingBag size={36} className="text-white" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl md:text-3xl font-black tracking-tight">Dalbada & Bixinta Deynta (Online Orders)</h1>
              {pendingCount > 0 && (
                <span className="px-3 py-1 bg-amber-500 text-slate-900 text-xs font-black rounded-full animate-bounce">
                  {pendingCount} Cusub!
                </span>
              )}
            </div>
            <p className="text-blue-100 text-xs md:text-sm font-medium mt-1">
              Ansixi reshitada lacag bixinta, eeg location-ka macmiilka, xaqiiji deynta ama iibka.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/20 text-xs font-bold">
          <div>Wadarta Dalbada: <span className="text-emerald-300 font-black text-sm">{orders.length}</span></div>
          <div className="w-px h-6 bg-white/20" />
          <div>Sugaya Ansixin: <span className="text-amber-300 font-black text-sm">{pendingCount}</span></div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-3xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
        {/* Status Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto pb-2 md:pb-0 scrollbar-hide">
          {(['ALL', 'PENDING', 'APPROVED', 'DELIVERED', 'CANCELLED'] as const).map((st) => (
            <button
              key={st}
              onClick={() => setStatusFilter(st)}
              className={`px-4 py-2.5 rounded-2xl text-xs font-black transition-all shrink-0 ${
                statusFilter === st
                  ? 'bg-blue-600 text-white shadow-md shadow-blue-600/20'
                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
              }`}
            >
              {st === 'ALL' && 'Dhammaan'}
              {st === 'PENDING' && `Sugaya (${orders.filter(o => o.status === 'PENDING').length})`}
              {st === 'APPROVED' && 'La Ansixiyay'}
              {st === 'DELIVERED' && 'La Bixiyay'}
              {st === 'CANCELLED' && 'La Diiday'}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full md:w-72">
          <Search className="absolute left-3.5 top-3 text-slate-400" size={18} />
          <input
            type="text"
            placeholder="Raadi magac, phone, ama Order ID..."
            className="w-full pl-10 pr-4 py-2.5 bg-slate-100 focus:bg-white border border-transparent focus:border-blue-500 rounded-2xl outline-none text-xs font-bold text-slate-800"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      {/* Orders Table & Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredOrders.map(order => (
          <div
            key={order.id}
            className={`bg-white rounded-3xl p-5 border shadow-md flex flex-col justify-between space-y-4 transition-all hover:shadow-xl ${
              order.status === 'PENDING' ? 'border-amber-400/80 ring-2 ring-amber-100' : 'border-slate-200/80'
            }`}
          >
            {/* Header info */}
            <div>
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="font-black text-xs text-blue-700 bg-blue-50 px-3 py-1 rounded-xl">
                    {order.id}
                  </span>
                  {order.orderType === 'DEBT_PAYMENT' && (
                    <span className="bg-purple-100 text-purple-800 font-black text-[10px] px-2 py-0.5 rounded-lg flex items-center gap-1">
                      <DollarSign size={10} /> Bixin Deyn
                    </span>
                  )}
                  {order.paymentMethod === 'Deyn (Credit)' && (
                    <span className="bg-amber-100 text-amber-800 font-black text-[10px] px-2 py-0.5 rounded-lg">
                      Deyn/Credit
                    </span>
                  )}
                </div>

                <span
                  className={`px-3 py-1 rounded-xl text-[11px] font-black ${
                    order.status === 'PENDING' ? 'bg-amber-100 text-amber-800' :
                    order.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-800' :
                    order.status === 'DELIVERED' ? 'bg-blue-100 text-blue-800' :
                    'bg-rose-100 text-rose-800'
                  }`}
                >
                  {order.status === 'PENDING' && '⏳ Sugaya Ansixin'}
                  {order.status === 'APPROVED' && '✅ La Ansixiyay'}
                  {order.status === 'DELIVERED' && '🚚 La Gaarsiiyay'}
                  {order.status === 'CANCELLED' && '❌ La Diiday'}
                </span>
              </div>

              {/* Customer Details & Delivery GPS Location */}
              <div className="mt-3 space-y-2 text-xs">
                <div className="flex items-center gap-2 font-black text-slate-800 text-sm">
                  <User size={16} className="text-blue-600 shrink-0" />
                  <span>{order.customer.fullName}</span>
                </div>
                <div className="flex items-center gap-2 font-bold text-slate-600">
                  <Phone size={14} className="text-slate-400 shrink-0" />
                  <span>{order.customer.phone} (@{order.customer.username})</span>
                </div>
                <div className="flex items-start gap-2 text-slate-600">
                  <MapPin size={14} className="text-slate-400 shrink-0 mt-0.5" />
                  <span>
                    <strong className="text-slate-800">Qabale:</strong> {order.customer.qabaleAddress}{' '}
                    {order.customer.nearbyLandmark !== 'N/A' && `(${order.customer.nearbyLandmark})`}
                  </span>
                </div>

                {/* Live GPS Map Link Button */}
                {(order.customer.locationUrl || (order.customer.latitude && order.customer.longitude)) && (
                  <a
                    href={
                      order.customer.locationUrl || 
                      `https://www.google.com/maps?q=${order.customer.latitude},${order.customer.longitude}`
                    }
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-700 font-black rounded-xl border border-blue-200 text-[11px] transition-colors"
                  >
                    <Compass size={14} className="text-blue-600 animate-pulse" />
                    <span>Eeg Location-ka Google Maps (Delivery)</span>
                    <ExternalLink size={12} />
                  </a>
                )}

                <div className="flex items-center gap-2 text-slate-500 text-[11px] font-bold pt-1">
                  <Clock size={12} />
                  <span>{new Date(order.timestamp).toLocaleString()}</span>
                </div>
              </div>

              {/* Items / Debt Payment Summary */}
              <div className="mt-4 bg-slate-50 p-3 rounded-2xl space-y-2 border border-slate-100">
                <div className="text-[10px] font-black uppercase text-slate-400 tracking-wider">
                  {order.orderType === 'DEBT_PAYMENT' ? 'Bixinta Deynta (Debt Payment)' : `Alaabta La Dalbaday (${order.items.length} pices)`}
                </div>
                
                {order.items.length > 0 && (
                  <div className="space-y-1 max-h-28 overflow-y-auto pr-1">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="flex justify-between text-xs font-bold text-slate-700">
                        <span className="truncate">{item.name} x {item.quantity}</span>
                        <span className="font-black text-slate-900">{formatCurrency(item.sellPrice * item.quantity, activeCurrency, rate)}</span>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t border-slate-200 flex justify-between font-black text-sm text-slate-900">
                  <span>Wadarta (Total):</span>
                  <span className="text-emerald-600 text-base">{formatCurrency(order.totalAmount, activeCurrency, rate)}</span>
                </div>
              </div>

              {/* Payment Receipt Attachment Preview */}
              <div className="mt-3 flex items-center justify-between bg-blue-50/60 p-2.5 rounded-2xl border border-blue-100">
                <div className="flex items-center gap-2">
                  <CreditCard size={16} className="text-blue-600" />
                  <div className="text-xs font-bold text-slate-800">
                    Habka: <span className="font-black text-blue-700">{order.paymentMethod}</span>
                  </div>
                </div>

                {order.receiptImage ? (
                  <button
                    onClick={() => setPreviewImage(order.receiptImage || null)}
                    className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-[11px] font-black flex items-center gap-1 shadow-sm"
                  >
                    <Eye size={12} /> Eeg Reshitka
                  </button>
                ) : (
                  <span className="text-[10px] text-slate-400 font-bold">Reshit ma jiro</span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="pt-3 border-t border-slate-100 flex flex-wrap gap-2">
              {order.status === 'PENDING' && (
                <>
                  <button
                    onClick={() => handleApproveOrder(order)}
                    className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-all active:scale-95"
                  >
                    <CheckCircle2 size={15} /> Ansixi Reshitka
                  </button>
                  <button
                    onClick={() => handleStatusChange(order.id, 'CANCELLED')}
                    className="py-2.5 px-3 bg-rose-100 hover:bg-rose-200 text-rose-700 text-xs font-black rounded-xl transition-all"
                  >
                    Diid
                  </button>
                </>
              )}

              {order.status === 'APPROVED' && (
                <button
                  onClick={() => handleStatusChange(order.id, 'DELIVERED')}
                  className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-black rounded-xl flex items-center justify-center gap-1.5 shadow-md"
                >
                  <Truck size={15} /> Calaamadi in La Gaarsiiyay (Delivered)
                </button>
              )}

              <div className="flex gap-2 w-full">
                <button
                  onClick={() => setSelectedOrder(order)}
                  className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold rounded-xl"
                >
                  Faahfaahin Buuxda
                </button>
                <button
                  onClick={() => setPrintableOrder(order)}
                  className="py-2 px-3 bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-bold rounded-xl flex items-center gap-1 border border-blue-200"
                  title="Print Customer Receipt"
                >
                  <Printer size={14} /> Reshitka
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredOrders.length === 0 && (
        <div className="text-center py-20 bg-white rounded-3xl border border-slate-200">
          <ShoppingBag size={54} className="mx-auto text-slate-300 mb-3" />
          <h3 className="text-lg font-bold text-slate-700">Wax dalbada ma lagu helin qeybtan!</h3>
          <p className="text-xs text-slate-400 mt-1">Geli search ama dooro tab kale si aad u aragto dalbada.</p>
        </div>
      )}

      {/* FULL SCREEN RECEIPT IMAGE PREVIEW MODAL */}
      {previewImage && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[150] flex items-center justify-center p-4">
          <div className="max-w-3xl w-full bg-slate-900 rounded-3xl p-6 border border-slate-800 space-y-4">
            <div className="flex items-center justify-between text-white border-b border-slate-800 pb-3">
              <h3 className="font-black text-sm flex items-center gap-2">
                <ReceiptIcon size={18} className="text-blue-400" /> Sawirka Reshitka Lacag Bixinta (Payment Receipt Screenshot)
              </h3>
              <button onClick={() => setPreviewImage(null)} className="p-2 text-slate-400 hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="max-h-[75vh] overflow-auto rounded-2xl bg-black flex items-center justify-center p-2">
              <img src={previewImage} alt="Payment Receipt" className="max-w-full max-h-[70vh] object-contain rounded-xl" />
            </div>

            <button
              onClick={() => setPreviewImage(null)}
              className="w-full py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-lg"
            >
              Xir Sawirka (Close Preview)
            </button>
          </div>
        </div>
      )}

      {/* PRINTABLE RECEIPT MODAL FOR ADMIN */}
      {printableOrder && (
        <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[160] flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white text-slate-900 rounded-3xl p-6 md:p-8 space-y-5 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="text-center border-b pb-4">
              <h2 className="text-xl font-black uppercase tracking-wider">{data.settings.businessName}</h2>
              <p className="text-xs text-slate-500">Official Customer Order Receipt</p>
              <div className="text-[11px] font-bold text-slate-400 mt-1">Receipt ID: #{printableOrder.id}</div>
            </div>

            <div className="text-xs space-y-1">
              <div><strong>Customer:</strong> {printableOrder.customer.fullName}</div>
              <div><strong>Phone:</strong> {printableOrder.customer.phone}</div>
              <div><strong>Address:</strong> {printableOrder.customer.qabaleAddress}</div>
              <div><strong>Date:</strong> {new Date(printableOrder.timestamp).toLocaleString()}</div>
              <div><strong>Payment Method:</strong> {printableOrder.paymentMethod}</div>
              <div><strong>Type:</strong> {printableOrder.orderType === 'DEBT_PAYMENT' ? 'Bixin Deyn (Debt Payment)' : 'Iibka Alaabta'}</div>
            </div>

            {printableOrder.items.length > 0 && (
              <div className="border-t border-b py-2 space-y-1 text-xs">
                <div className="font-black uppercase text-[10px] text-slate-400">Items List:</div>
                {printableOrder.items.map((item, i) => (
                  <div key={i} className="flex justify-between font-bold">
                    <span>{item.name} x {item.quantity}</span>
                    <span>{formatCurrency(item.sellPrice * item.quantity, activeCurrency, rate)}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex justify-between font-black text-base border-t pt-2">
              <span>Total Amount:</span>
              <span className="text-emerald-600">{formatCurrency(printableOrder.totalAmount, activeCurrency, rate)}</span>
            </div>

            <div className="flex gap-2 pt-2">
              <button
                onClick={() => window.print()}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-2"
              >
                <Printer size={16} /> Print / Save PDF
              </button>
              <button
                onClick={() => setPrintableOrder(null)}
                className="py-3 px-5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                Xir (Close)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FULL ORDER DETAILS MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[140] flex items-center justify-center p-4 overflow-y-auto">
          <div className="max-w-2xl w-full bg-white rounded-3xl p-6 md:p-8 border border-slate-200 shadow-2xl space-y-6 my-8">
            <div className="flex items-center justify-between border-b pb-4">
              <div>
                <h3 className="text-xl font-black text-slate-900">Order #{selectedOrder.id}</h3>
                <p className="text-xs text-slate-500">{new Date(selectedOrder.timestamp).toLocaleString()}</p>
              </div>
              <button onClick={() => setSelectedOrder(null)} className="p-2 text-slate-400 hover:text-slate-800">
                <X size={22} />
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                <div className="font-black text-blue-700 uppercase tracking-wider mb-2">Customer Info:</div>
                <div><strong>Magaca:</strong> {selectedOrder.customer.fullName}</div>
                <div><strong>Username:</strong> @{selectedOrder.customer.username}</div>
                <div><strong>Phone:</strong> {selectedOrder.customer.phone}</div>
                <div><strong>Dagmada / Qabale:</strong> {selectedOrder.customer.qabaleAddress}</div>
                <div><strong>Meel Caan Ah:</strong> {selectedOrder.customer.nearbyLandmark}</div>
                {(selectedOrder.customer.locationUrl || selectedOrder.customer.latitude) && (
                  <div className="pt-1">
                    <a
                      href={selectedOrder.customer.locationUrl || `https://www.google.com/maps?q=${selectedOrder.customer.latitude},${selectedOrder.customer.longitude}`}
                      target="_blank"
                      rel="noreferrer"
                      className="text-blue-600 font-black underline flex items-center gap-1"
                    >
                      <Compass size={14} /> Open GPS Delivery Location
                    </a>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100 space-y-1">
                <div className="font-black text-blue-700 uppercase tracking-wider mb-2">Payment Info:</div>
                <div><strong>Type:</strong> {selectedOrder.orderType === 'DEBT_PAYMENT' ? 'Bixin Deyn (Debt Payment)' : 'Iibka Alaabta'}</div>
                <div><strong>Habka Lacag Bixinta:</strong> {selectedOrder.paymentMethod}</div>
                <div><strong>Wadarta Lacagta:</strong> <span className="text-emerald-600 font-black text-sm">{formatCurrency(selectedOrder.totalAmount, activeCurrency, rate)}</span></div>
                <div><strong>Status:</strong> {selectedOrder.status}</div>
                {selectedOrder.notes && <div><strong>Notes:</strong> {selectedOrder.notes}</div>}
              </div>
            </div>

            {/* Order Items Table */}
            {selectedOrder.items.length > 0 && (
              <div className="border rounded-2xl overflow-hidden">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-100 font-black text-slate-600 border-b">
                    <tr>
                      <th className="p-3">Alaabta</th>
                      <th className="p-3 text-center">Tirada</th>
                      <th className="p-3 text-right">Qiimaha</th>
                      <th className="p-3 text-right">Wadarta</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {selectedOrder.items.map((item, i) => (
                      <tr key={i} className="font-bold text-slate-700">
                        <td className="p-3">{item.name}</td>
                        <td className="p-3 text-center">{item.quantity}</td>
                        <td className="p-3 text-right">{formatCurrency(item.sellPrice, activeCurrency, rate)}</td>
                        <td className="p-3 text-right font-black">{formatCurrency(item.sellPrice * item.quantity, activeCurrency, rate)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {selectedOrder.receiptImage && (
              <div className="space-y-2">
                <div className="font-black text-xs text-slate-700 uppercase">Reshitka Bixinta Lacagta:</div>
                <img
                  src={selectedOrder.receiptImage}
                  alt="Receipt"
                  className="w-full h-48 object-contain rounded-2xl bg-slate-900 border border-slate-800 cursor-pointer"
                  onClick={() => setPreviewImage(selectedOrder.receiptImage || null)}
                />
              </div>
            )}

            <div className="flex gap-3">
              {selectedOrder.status === 'PENDING' && (
                <button
                  onClick={() => handleApproveOrder(selectedOrder)}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs rounded-xl shadow-md"
                >
                  Ansixi Reshitka (Approve Order)
                </button>
              )}
              <button
                onClick={() => setSelectedOrder(null)}
                className="py-3 px-6 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs rounded-xl"
              >
                Xir (Close)
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default OnlineOrders;
