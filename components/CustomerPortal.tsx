import React, { useState } from 'react';
import { AppData, Product, CartItem, OnlineCustomer, OnlineOrder, Customer } from '../types';
import { 
  ShoppingBag, 
  ShoppingCart, 
  UserPlus, 
  LogIn, 
  Search, 
  Plus, 
  Minus, 
  Upload, 
  CheckCircle2, 
  CreditCard, 
  MapPin, 
  Phone, 
  User, 
  Lock, 
  ArrowLeft, 
  Store, 
  Send,
  Clock,
  Sparkles,
  Receipt as ReceiptIcon,
  Calendar,
  Printer,
  Compass,
  AlertCircle,
  FileText,
  DollarSign
} from 'lucide-react';
import { generateId } from '../lib/utils';

interface Props {
  data: AppData;
  onSaveOrder: (newOrder: OnlineOrder) => void;
  onRegisterCustomer: (newCustomer: OnlineCustomer) => void;
  onSwitchToAdminLogin: () => void;
}

export const CustomerPortal: React.FC<Props> = ({
  data,
  onSaveOrder,
  onRegisterCustomer,
  onSwitchToAdminLogin
}) => {
  // Auth state
  const [mode, setMode] = useState<'LOGIN' | 'REGISTER' | 'SHOP'>('REGISTER');
  const [currentTab, setCurrentTab] = useState<'SHOP' | 'DEBT_HISTORY'>('SHOP');
  const [currentUser, setCurrentUser] = useState<OnlineCustomer | null>(null);

  // Form states for register
  const [regForm, setRegForm] = useState({
    username: '',
    password: '',
    fullName: '',
    phone: '',
    qabaleAddress: '',
    nearbyLandmark: '',
    locationUrl: '',
    latitude: undefined as number | undefined,
    longitude: undefined as number | undefined
  });
  const [regError, setRegError] = useState('');
  const [isGettingGps, setIsGettingGps] = useState(false);

  // Form states for login
  const [loginForm, setLoginForm] = useState({ username: '', password: '' });
  const [loginError, setLoginError] = useState('');

  // Shop states
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

  // Guest details state for fast guest checkout without mandatory password account
  const [guestDetails, setGuestDetails] = useState({
    fullName: '',
    phone: '',
    qabaleAddress: '',
    nearbyLandmark: '',
    locationUrl: ''
  });

  // Date filters for debt/history
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  // Checkout payment state
  const [selectedPayment, setSelectedPayment] = useState<'Golis' | 'eBirr' | 'Kaafi' | 'Ku Iibso' | 'eDahab' | 'Commercial Bank' | 'Deyn (Credit)'>('Golis');
  const [receiptImage, setReceiptImage] = useState<string>('');
  const [orderNotes, setOrderNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [completedOrder, setCompletedOrder] = useState<OnlineOrder | null>(null);

  // Debt Payment Modal State
  const [isDebtModalOpen, setIsDebtModalOpen] = useState(false);
  const [debtPayAmount, setDebtPayAmount] = useState<string>('');
  const [debtPayMethod, setDebtPayMethod] = useState<'Golis' | 'eBirr' | 'Kaafi' | 'Ku Iibso' | 'eDahab' | 'Commercial Bank'>('Golis');
  const [debtReceiptImage, setDebtReceiptImage] = useState<string>('');

  // Printable Receipt Modal State
  const [printableOrder, setPrintableOrder] = useState<OnlineOrder | null>(null);

  // Merchant Account Info configured from Settings
  const onlineNums = data.settings.onlinePaymentNumbers || {};
  const paymentAccounts = {
    'Golis': {
      number: onlineNums.golis || '0907112233',
      name: 'Sahal / Golis',
      instructions: `Ku shub ama ku bixi Sahal/Golis number-ka: ${onlineNums.golis || '0907112233'}`
    },
    'eBirr': {
      number: onlineNums.ebirr || '0911223344',
      name: 'eBirr Account',
      instructions: `Ku bixi eBirr account/number-ka: ${onlineNums.ebirr || '0911223344'}`
    },
    'Kaafi': {
      number: onlineNums.kaafi || '987654',
      name: 'Kaafi Merchant',
      instructions: `Ku bixi Kaafi Merchant ID/Number: ${onlineNums.kaafi || '987654'}`
    },
    'Ku Iibso': {
      number: onlineNums.kuIibso || '0615112233',
      name: 'Ku Iibso / Sahal',
      instructions: `Ku bixi Ku Iibso code/number-ka: ${onlineNums.kuIibso || '0615112233'}`
    },
    'eDahab': {
      number: onlineNums.edahab || '0659112233',
      name: 'eDahab Mobile',
      instructions: `Ku bixi eDahab number-ka: ${onlineNums.edahab || '0659112233'}`
    },
    'Commercial Bank': {
      number: onlineNums.commercialBank || '10002938484',
      name: 'Commercial Bank (CBE)',
      instructions: `U wareeji Commercial Bank (CBE) Account-ka: ${onlineNums.commercialBank || '10002938484'}`
    },
    'Deyn (Credit)': {
      number: 'ERP Account',
      name: 'Deyn/Amaah',
      instructions: 'Dalbadkan waxaa laguugu qori doonaa deyn account-kaaga (Subject to Admin approval)'
    }
  };

  const categories = ['ALL', ...Array.from(new Set(data.products.map(p => p.category || 'General')))];

  // Get matching ERP Customer debt info
  const erpCustomer = currentUser ? data.customers.find(
    c => c.phone === currentUser.phone || c.name.toLowerCase() === currentUser.fullName.toLowerCase()
  ) : null;

  const currentDebtBalance = erpCustomer ? erpCustomer.debtBalance : 0;

  // Filter products
  const filteredProducts = data.products.filter(p => {
    const matchesCategory = selectedCategory === 'ALL' || p.category === selectedCategory;
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.barcode?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch && p.stock > 0;
  });

  // User's order history
  const userOrders = (data.onlineOrders || []).filter(o => {
    if (!currentUser) return false;
    const isUser = o.customer.username === currentUser.username || o.customer.phone === currentUser.phone;
    if (!isUser) return false;

    // Date filtering
    if (startDate) {
      const startMs = new Date(startDate).getTime();
      if (o.timestamp < startMs) return false;
    }
    if (endDate) {
      const endMs = new Date(endDate).getTime() + (24 * 60 * 60 * 1000);
      if (o.timestamp > endMs) return false;
    }

    return true;
  });

  // Fetch current GPS Location
  const handleGetGpsLocation = () => {
    if (!navigator.geolocation) {
      alert('Aaladdan ma taageerto GPS Location.');
      return;
    }

    setIsGettingGps(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
        setRegForm(prev => ({
          ...prev,
          latitude: lat,
          longitude: lng,
          locationUrl: mapUrl
        }));
        setIsGettingGps(false);
        alert('Si guul leh ayaa loo qabtay Location-kaaga GPS-ka!');
      },
      (error) => {
        setIsGettingGps(false);
        alert('Lama heli karo location-ka. Fadlan manual u qor Google Maps link ama qabala address-ka.');
      },
      { timeout: 10000 }
    );
  };

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setRegError('');

    if (!regForm.username || !regForm.password || !regForm.fullName || !regForm.phone || !regForm.qabaleAddress) {
      setRegError('Fadlan buuxi dhammaan qeybaha loo baahan yahay!');
      return;
    }

    const existingCust = (data.onlineCustomers || []).find(c => c.username.toLowerCase() === regForm.username.toLowerCase());
    if (existingCust) {
      setRegError('Username-kan waa la adeegsaday! Fadlan mid kale dooro.');
      return;
    }

    const newCust: OnlineCustomer = {
      id: generateId(),
      username: regForm.username,
      password: regForm.password,
      fullName: regForm.fullName,
      phone: regForm.phone,
      qabaleAddress: regForm.qabaleAddress,
      nearbyLandmark: regForm.nearbyLandmark || 'N/A',
      locationUrl: regForm.locationUrl,
      latitude: regForm.latitude,
      longitude: regForm.longitude,
      createdAt: Date.now()
    };

    onRegisterCustomer(newCust);
    setCurrentUser(newCust);
    setMode('SHOP');
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');

    const found = (data.onlineCustomers || []).find(
      c => c.username.toLowerCase() === loginForm.username.toLowerCase() && c.password === loginForm.password
    );

    if (found) {
      setCurrentUser(found);
      setMode('SHOP');
    } else {
      setLoginError('Username ama Password-ka waa khaldan yahay!');
    }
  };

  const addToCart = (product: Product) => {
    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity >= product.stock) return prev;
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1 }];
    });
  };

  const updateCartQty = (id: string, delta: number) => {
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const newQty = item.quantity + delta;
        if (newQty <= 0) return null;
        if (newQty > item.stock) return item;
        return { ...item, quantity: newQty };
      }
      return item;
    }).filter(Boolean) as CartItem[]);
  };

  const cartSubtotal = cart.reduce((sum, item) => sum + (item.sellPrice * item.quantity), 0);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, isForDebt: boolean = false) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('File size exceeds 5MB limit.');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      if (isForDebt) {
        setDebtReceiptImage(reader.result as string);
      } else {
        setReceiptImage(reader.result as string);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleGetGpsLocationForGuest = () => {
    if (!navigator.geolocation) {
      alert('Aaladdan ma taageerto GPS Location.');
      return;
    }

    setIsGettingGps(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;
        const mapUrl = `https://www.google.com/maps?q=${lat},${lng}`;
        setGuestDetails(prev => ({
          ...prev,
          locationUrl: mapUrl
        }));
        setIsGettingGps(false);
        alert('Si guul leh ayaa loo qabtay Location-kaaga GPS-ka!');
      },
      (error) => {
        setIsGettingGps(false);
        alert('Lama heli karo location-ka. Fadlan manual u qor Google Maps link ama qabala address-ka.');
      },
      { timeout: 10000 }
    );
  };

  const handleCompleteOrder = () => {
    let customerData = currentUser;

    if (!customerData) {
      if (!guestDetails.fullName.trim() || !guestDetails.phone.trim() || !guestDetails.qabaleAddress.trim()) {
        alert('Fadlan soo buuxi magacaaga, telefoonkaaga, iyo address-kaaga halka laguugu soo soofariyo alaabta!');
        return;
      }
      customerData = {
        id: generateId(),
        username: 'guest-' + guestDetails.phone.replace(/\D/g, ''),
        password: '',
        fullName: guestDetails.fullName.trim(),
        phone: guestDetails.phone.trim(),
        qabaleAddress: guestDetails.qabaleAddress.trim(),
        nearbyLandmark: guestDetails.nearbyLandmark.trim() || 'N/A',
        locationUrl: guestDetails.locationUrl || '',
        createdAt: Date.now()
      };
    }

    if (cart.length === 0) return;
    
    if (selectedPayment === 'Deyn (Credit)') {
      if (!currentUser) {
        alert('Dalbadka Deynka (Credit) wuxuu u baahan yahay in aad Sign In ku tahay akaun-kaaga!');
        return;
      }
    } else if (!receiptImage) {
      alert('Fadlan soo geli sawirka risiidhka/sawirka lacag bixinta!');
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      const newOrder: OnlineOrder = {
        id: 'ORD-' + Math.floor(100000 + Math.random() * 900000),
        customer: {
          username: customerData.username,
          fullName: customerData.fullName,
          phone: customerData.phone,
          qabaleAddress: customerData.qabaleAddress,
          nearbyLandmark: customerData.nearbyLandmark,
          locationUrl: customerData.locationUrl,
          latitude: customerData.latitude,
          longitude: customerData.longitude
        },
        orderType: 'PURCHASE',
        items: [...cart],
        subtotal: cartSubtotal,
        totalAmount: cartSubtotal,
        paymentMethod: selectedPayment,
        receiptImage: receiptImage,
        status: 'PENDING',
        timestamp: Date.now(),
        notes: orderNotes
      };

      onSaveOrder(newOrder);
      setCompletedOrder(newOrder);
      setCart([]);
      setIsCheckoutOpen(false);
      setIsSubmitting(false);
    }, 800);
  };

  // Submit Online Debt Payment
  const handleSubmitDebtPayment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) return;

    const amountNum = parseFloat(debtPayAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      alert('Fadlan geli xadiga lacagta ah ee saxda ah!');
      return;
    }

    if (!debtReceiptImage) {
      alert('Fadlan soo geli sawirka risiidhka/sawirka lacag bixinta deynta!');
      return;
    }

    setIsSubmitting(true);

    setTimeout(() => {
      const newOrder: OnlineOrder = {
        id: 'DEBT-' + Math.floor(100000 + Math.random() * 900000),
        customer: {
          username: currentUser.username,
          fullName: currentUser.fullName,
          phone: currentUser.phone,
          qabaleAddress: currentUser.qabaleAddress,
          nearbyLandmark: currentUser.nearbyLandmark,
          locationUrl: currentUser.locationUrl
        },
        orderType: 'DEBT_PAYMENT',
        items: [],
        subtotal: amountNum,
        totalAmount: amountNum,
        debtAmountPaid: amountNum,
        paymentMethod: debtPayMethod,
        receiptImage: debtReceiptImage,
        status: 'PENDING',
        timestamp: Date.now(),
        notes: `Lacag bixin deyn ah oo online ah ($${amountNum.toFixed(2)})`
      };

      onSaveOrder(newOrder);
      setCompletedOrder(newOrder);
      setIsDebtModalOpen(false);
      setDebtPayAmount('');
      setDebtReceiptImage('');
      setIsSubmitting(false);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col font-sans">
      {/* Top Header Bar */}
      <header className="bg-slate-800/90 backdrop-blur-md border-b border-slate-700/80 sticky top-0 z-40 px-4 md:px-8 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-600/30">
            <Store size={26} />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white">{data.settings.businessName}</h1>
            <p className="text-xs text-blue-400 font-bold flex items-center gap-1">
              <Sparkles size={12} /> Online Storefront & Debt Payment Portal
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {currentUser ? (
            <div className="flex items-center gap-3 bg-slate-700/60 px-4 py-2 rounded-2xl border border-slate-600">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-black text-xs">
                {currentUser.fullName.charAt(0).toUpperCase()}
              </div>
              <div className="text-left">
                <div className="text-xs font-black text-white">{currentUser.fullName}</div>
                <div className="text-[10px] text-amber-300 font-bold flex items-center gap-1">
                  Deyn: ${currentDebtBalance.toFixed(2)}
                </div>
              </div>
              <button
                onClick={() => {
                  setCurrentUser(null);
                  setMode('REGISTER');
                }}
                className="text-xs text-red-400 font-bold hover:underline ml-2"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMode('LOGIN')}
                className={`px-4 py-2.5 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition-all ${
                  mode === 'LOGIN' ? 'bg-emerald-600 ring-2 ring-emerald-400' : 'bg-slate-700 hover:bg-slate-600'
                }`}
              >
                <LogIn size={15} /> Sign In
              </button>
              <button
                onClick={() => setMode('REGISTER')}
                className={`px-4 py-2.5 text-white text-xs font-bold rounded-xl flex items-center gap-2 shadow-md transition-all ${
                  mode === 'REGISTER' ? 'bg-blue-600 ring-2 ring-blue-400' : 'bg-blue-600 hover:bg-blue-500'
                }`}
              >
                <UserPlus size={15} /> Register (Akaun Cusub)
              </button>
            </div>
          )}

          <button
            onClick={onSwitchToAdminLogin}
            className="px-3 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold rounded-xl border border-slate-700 flex items-center gap-1.5"
            title="Switch to Admin ERP Login"
          >
            <Lock size={14} /> Admin Portal
          </button>
        </div>
      </header>

      {/* Mode Sub-Navigation Tabs for Logged In User */}
      {mode === 'SHOP' && currentUser && (
        <div className="bg-slate-800/60 border-b border-slate-700/60 px-4 md:px-8 py-2.5 flex items-center gap-4">
          <button
            onClick={() => setCurrentTab('SHOP')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${
              currentTab === 'SHOP'
                ? 'bg-blue-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white bg-slate-800'
            }`}
          >
            <ShoppingBag size={15} /> Dukaanka (Store)
          </button>
          <button
            onClick={() => setCurrentTab('DEBT_HISTORY')}
            className={`px-4 py-2 rounded-xl text-xs font-black flex items-center gap-2 transition-all ${
              currentTab === 'DEBT_HISTORY'
                ? 'bg-amber-600 text-white shadow-md'
                : 'text-slate-400 hover:text-white bg-slate-800'
            }`}
          >
            <FileText size={15} /> Deynkayga & Taariikhda (${currentDebtBalance.toFixed(2)})
          </button>
        </div>
      )}

      {/* Main Content Area */}
      {/* Main Content Area */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 md:p-8 space-y-6">
        {!currentUser ? (
          <div className="space-y-6 pt-2">
            {/* Header Banner for Unauthenticated Visitor */}
            <div className="max-w-xl mx-auto bg-slate-800/90 rounded-3xl p-6 border border-blue-500/30 text-center space-y-3 shadow-2xl">
              <div className="w-12 h-12 bg-blue-600/20 text-blue-400 rounded-2xl flex items-center justify-center mx-auto border border-blue-500/30">
                <Lock size={26} />
              </div>
              <h2 className="text-xl font-black text-white">Shuruuda Soo Galida Dukaanka</h2>
              <p className="text-xs text-slate-300 leading-relaxed">
                Fadlan marka hore geli ama sameyso account-kaaga (Username, Password & Xogtaada Buuxda) si aad ugu gudubto dukaanka shabakada oo aad u aragto alaabta taala meesha.
              </p>

              <div className="flex items-center justify-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setMode('REGISTER')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                    mode === 'REGISTER'
                      ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-700'
                  }`}
                >
                  1. Sameyso Akaun (Register)
                </button>
                <button
                  type="button"
                  onClick={() => setMode('LOGIN')}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${
                    mode === 'LOGIN'
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-600/30'
                      : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-700'
                  }`}
                >
                  2. Geli Akaun-kaaga (Sign In)
                </button>
              </div>
            </div>

            {/* REGISTER CUSTOMER ACCOUNT */}
            {mode === 'REGISTER' && (
              <div className="max-w-xl mx-auto bg-slate-800 rounded-3xl p-6 md:p-8 border border-slate-700 shadow-2xl space-y-6 animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between border-b border-slate-700/80 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-blue-600/20 text-blue-400 rounded-2xl">
                      <UserPlus size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-white">Sameyso Username & Password Cusub</h2>
                      <p className="text-xs text-slate-400">Geli xogtaada & Location-ka si aad alaabta dukaanka u gasho!</p>
                    </div>
                  </div>
                </div>

                {regError && (
                  <div className="p-3 bg-red-500/20 text-red-300 rounded-2xl text-xs font-bold border border-red-500/30">
                    {regError}
                  </div>
                )}

                <form onSubmit={handleRegister} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Username (Magaca Galinta)</label>
                      <div className="relative">
                        <User className="absolute left-3.5 top-3.5 text-slate-500" size={18} />
                        <input
                          type="text"
                          required
                          placeholder="e.g. cabdi123"
                          className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl outline-none focus:border-blue-500 text-sm font-bold text-white"
                          value={regForm.username}
                          onChange={e => setRegForm({ ...regForm, username: e.target.value })}
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Password (Erayga Sirta)</label>
                      <div className="relative">
                        <Lock className="absolute left-3.5 top-3.5 text-slate-500" size={18} />
                        <input
                          type="password"
                          required
                          placeholder="••••••••"
                          className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl outline-none focus:border-blue-500 text-sm font-bold text-white"
                          value={regForm.password}
                          onChange={e => setRegForm({ ...regForm, password: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Magacaaga oo Buuxa (Full Name)</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Cabdi Xasan Maxamed"
                        className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl outline-none focus:border-blue-500 text-sm font-bold text-white"
                        value={regForm.fullName}
                        onChange={e => setRegForm({ ...regForm, fullName: e.target.value })}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Nambarkaaga Telefoonka (Phone)</label>
                      <div className="relative">
                        <Phone className="absolute left-3.5 top-3.5 text-slate-500" size={18} />
                        <input
                          type="tel"
                          required
                          placeholder="e.g. 0615000000 / 0634000000"
                          className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl outline-none focus:border-blue-500 text-sm font-bold text-white"
                          value={regForm.phone}
                          onChange={e => setRegForm({ ...regForm, phone: e.target.value })}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Address / Dagmada / Qbalada (Address)</label>
                    <div className="relative">
                      <MapPin className="absolute left-3.5 top-3.5 text-slate-500" size={18} />
                      <input
                        type="text"
                        required
                        placeholder="e.g. Dagmada Hodan, Qbalada 3aad"
                        className="w-full pl-11 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-xl outline-none focus:border-blue-500 text-sm font-bold text-white"
                        value={regForm.qabaleAddress}
                        onChange={e => setRegForm({ ...regForm, qabaleAddress: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Meel caan ah oo kuu dhow (Nearby Landmark)</label>
                    <input
                      type="text"
                      placeholder="e.g. Ka soo horjeeda Masaajidka Jaamaca"
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl outline-none focus:border-blue-500 text-sm font-bold text-white"
                      value={regForm.nearbyLandmark}
                      onChange={e => setRegForm({ ...regForm, nearbyLandmark: e.target.value })}
                    />
                  </div>

                  {/* GPS Location Share Option */}
                  <div className="p-4 bg-slate-900/80 rounded-2xl border border-slate-700/80 space-y-2">
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-black text-slate-200 flex items-center gap-1.5">
                        <Compass size={16} className="text-blue-400" /> Share Live GPS Location for Delivery
                      </div>
                      <button
                        type="button"
                        onClick={handleGetGpsLocation}
                        disabled={isGettingGps}
                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white rounded-xl text-xs font-bold flex items-center gap-1 shadow-md"
                      >
                        {isGettingGps ? 'Getting Location...' : '📌 Share GPS'}
                      </button>
                    </div>

                    <input
                      type="url"
                      placeholder="Google Maps Location URL (e.g. https://maps.google.com/?q=...)"
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-xl text-xs font-mono text-blue-300"
                      value={regForm.locationUrl}
                      onChange={e => setRegForm({ ...regForm, locationUrl: e.target.value })}
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 bg-blue-600 hover:bg-blue-500 text-white rounded-2xl font-black text-base shadow-lg transition-all active:scale-95"
                  >
                    Sameyso Account-ka & Bilow Dalbadka
                  </button>

                  <div className="text-center text-xs text-slate-400 pt-2">
                    Horey ma u lahayd account?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('LOGIN')}
                      className="text-blue-400 font-bold underline"
                    >
                      Geli Halkan (Sign In)
                    </button>
                  </div>
                </form>
              </div>
            )}

            {/* CUSTOMER LOGIN */}
            {mode === 'LOGIN' && (
              <div className="max-w-md mx-auto bg-slate-800 rounded-3xl p-6 md:p-8 border border-slate-700 shadow-2xl space-y-6 animate-in zoom-in-95 duration-300">
                <div className="flex items-center justify-between border-b border-slate-700/80 pb-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-emerald-600/20 text-emerald-400 rounded-2xl">
                      <LogIn size={24} />
                    </div>
                    <div>
                      <h2 className="text-xl font-black text-white">Geli Account-kaaga Customer</h2>
                      <p className="text-xs text-slate-400">Geli Username & Password aad horey u sameysatay.</p>
                    </div>
                  </div>
                </div>

                {loginError && (
                  <div className="p-3 bg-red-500/20 text-red-300 rounded-2xl text-xs font-bold border border-red-500/30">
                    {loginError}
                  </div>
                )}

                <form onSubmit={handleLogin} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Username</label>
                    <input
                      type="text"
                      required
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl outline-none focus:border-blue-500 text-sm font-bold text-white"
                      value={loginForm.username}
                      onChange={e => setLoginForm({ ...loginForm, username: e.target.value })}
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-black uppercase tracking-wider text-slate-400">Password</label>
                    <input
                      type="password"
                      required
                      className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl outline-none focus:border-blue-500 text-sm font-bold text-white"
                      value={loginForm.password}
                      onChange={e => setLoginForm({ ...loginForm, password: e.target.value })}
                    />
                  </div>

                  <button
                    type="submit"
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-base shadow-lg transition-all active:scale-95"
                  >
                    Sign In
                  </button>

                  <div className="text-center text-xs text-slate-400 pt-2">
                    Ma ma lahayd account?{' '}
                    <button
                      type="button"
                      onClick={() => setMode('REGISTER')}
                      className="text-blue-400 font-bold underline"
                    >
                      Sameyso Cusub (Register)
                    </button>
                  </div>
                </form>
              </div>
            )}
          </div>
        ) : (
          <>

        {/* SHOPPING CATALOG INTERFACE */}
        {mode === 'SHOP' && currentTab === 'SHOP' && (
          <div className="space-y-6">
            {/* Search and Cart Bar */}
            <div className="bg-slate-800/80 p-4 rounded-3xl border border-slate-700/80 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="relative flex-1 w-full">
                <Search className="absolute left-4 top-3.5 text-slate-400" size={20} />
                <input
                  type="text"
                  placeholder="Raadi alaabta dukaanka taala (e.g. Caano, Sonkor, Ice Cream)..."
                  className="w-full pl-12 pr-4 py-3 bg-slate-900 border border-slate-700 rounded-2xl outline-none focus:border-blue-500 text-sm font-bold text-white placeholder:text-slate-500"
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                />
              </div>

              <div className="flex items-center gap-3 w-full md:w-auto justify-between">
                {/* Category selector */}
                <select
                  value={selectedCategory}
                  onChange={e => setSelectedCategory(e.target.value)}
                  className="px-4 py-3 bg-slate-900 border border-slate-700 text-white rounded-2xl font-bold text-xs outline-none"
                >
                  {categories.map((c, i) => (
                    <option key={i} value={c}>{c === 'ALL' ? 'Dhammaan Qeybaha' : c}</option>
                  ))}
                </select>

                {/* View Basket Button */}
                <button
                  onClick={() => setIsCartOpen(true)}
                  className="px-5 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-2xl flex items-center gap-2 shadow-lg shadow-blue-600/20 transition-all active:scale-95 shrink-0"
                >
                  <ShoppingCart size={18} />
                  <span>Basket-ka</span>
                  {cart.length > 0 && (
                    <span className="ml-1 bg-white text-blue-700 px-2 py-0.5 rounded-full text-[11px] font-black">
                      {cart.reduce((a, b) => a + b.quantity, 0)}
                    </span>
                  )}
                  <span className="ml-1 font-extrabold text-blue-200">
                    (${cartSubtotal.toFixed(2)})
                  </span>
                </button>
              </div>
            </div>

            {/* Products Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
              {filteredProducts.map(p => {
                const inCart = cart.find(item => item.id === p.id);
                return (
                  <div
                    key={p.id}
                    className="bg-slate-800 rounded-3xl p-4 border border-slate-700/80 hover:border-blue-500/50 transition-all duration-300 flex flex-col justify-between group shadow-lg"
                  >
                    <div>
                      <div className="w-full h-32 bg-slate-900 rounded-2xl flex items-center justify-center overflow-hidden mb-3 relative">
                        {p.image ? (
                          <img src={p.image} alt={p.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                        ) : (
                          <ShoppingBag size={36} className="text-slate-600" />
                        )}
                        <span className="absolute top-2 right-2 bg-slate-900/80 backdrop-blur-md px-2 py-1 rounded-lg text-[10px] font-bold text-emerald-400">
                          Stock: {p.stock} {p.unit || 'PCS'}
                        </span>
                      </div>

                      <h3 className="font-bold text-sm text-white line-clamp-1">{p.name}</h3>
                      <p className="text-[11px] text-slate-400 mt-0.5">{p.category || 'General'}</p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-700/60 flex items-center justify-between">
                      <div className="font-black text-base text-emerald-400">${p.sellPrice.toFixed(2)}</div>
                      {inCart ? (
                        <div className="flex items-center gap-1 bg-blue-600/30 text-blue-300 p-1 rounded-xl border border-blue-500/30">
                          <button onClick={() => updateCartQty(p.id, -1)} className="p-1 hover:bg-blue-600 rounded-lg text-white">
                            <Minus size={12} />
                          </button>
                          <span className="px-2 text-xs font-black">{inCart.quantity}</span>
                          <button onClick={() => updateCartQty(p.id, 1)} className="p-1 hover:bg-blue-600 rounded-lg text-white">
                            <Plus size={12} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(p)}
                          className="px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold rounded-xl flex items-center gap-1 transition-colors active:scale-95"
                        >
                          <Plus size={14} /> Ku Dar
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {filteredProducts.length === 0 && (
              <div className="text-center py-16 bg-slate-800/50 rounded-3xl border border-slate-700">
                <ShoppingBag size={48} className="mx-auto text-slate-600 mb-3" />
                <h3 className="text-lg font-bold text-white">Wax alaab ah ma laga helin!</h3>
                <p className="text-xs text-slate-400 mt-1">Fadlan badal qeybta aad raadinayso ama qoraalka.</p>
              </div>
            )}
          </div>
        )}

        {/* CUSTOMER DEBT BALANCE & ORDER HISTORY TAB */}
        {mode === 'SHOP' && currentTab === 'DEBT_HISTORY' && currentUser && (
          <div className="space-y-6 animate-in fade-in duration-300">
            {/* Customer Balance Banner */}
            <div className="bg-gradient-to-r from-amber-700 via-amber-800 to-slate-900 p-6 md:p-8 rounded-3xl border border-amber-500/30 shadow-xl flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-amber-500/20 rounded-2xl flex items-center justify-center text-amber-300 shrink-0">
                  <DollarSign size={36} />
                </div>
                <div>
                  <div className="text-xs font-black uppercase tracking-wider text-amber-200">
                    Cadadka Deynka Lagu leeyahay (Total Unpaid Debt)
                  </div>
                  <div className="text-3xl md:text-4xl font-black text-white mt-1">
                    ${currentDebtBalance.toFixed(2)}
                  </div>
                  <p className="text-xs text-amber-200/80 mt-1">
                    Customer: <strong className="text-white">{currentUser.fullName}</strong> ({currentUser.phone})
                  </p>
                </div>
              </div>

              <button
                onClick={() => setIsDebtModalOpen(true)}
                className="px-6 py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-2xl shadow-lg flex items-center gap-2 transition-all active:scale-95 shrink-0"
              >
                <CreditCard size={18} /> Bixi Deyn Online (Pay Debt)
              </button>
            </div>

            {/* Date Filters Bar (date ka oo choose leh) */}
            <div className="bg-slate-800 p-4 rounded-3xl border border-slate-700 flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="flex items-center gap-2 text-xs font-black text-white">
                <Calendar size={18} className="text-blue-400" />
                <span>Dooro Taariikhda (Choose Date Range):</span>
              </div>

              <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 font-bold">Laga bilaabo:</span>
                  <input
                    type="date"
                    className="bg-slate-900 border border-slate-700 px-3 py-2 rounded-xl text-white font-bold outline-none text-xs"
                    value={startDate}
                    onChange={e => setStartDate(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2 text-xs">
                  <span className="text-slate-400 font-bold">Ilaa:</span>
                  <input
                    type="date"
                    className="bg-slate-900 border border-slate-700 px-3 py-2 rounded-xl text-white font-bold outline-none text-xs"
                    value={endDate}
                    onChange={e => setEndDate(e.target.value)}
                  />
                </div>

                {(startDate || endDate) && (
                  <button
                    onClick={() => { setStartDate(''); setEndDate(''); }}
                    className="text-xs text-rose-400 hover:underline font-bold"
                  >
                    Nadiifi Filter-ka
                  </button>
                )}
              </div>
            </div>

            {/* User Orders & Debt Payments List */}
            <div className="space-y-4">
              <h3 className="text-lg font-black text-white flex items-center gap-2">
                <Clock size={20} className="text-blue-400" />
                Taariikhda Dalbada & Bixinta Deynta ({userOrders.length})
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {userOrders.map(order => (
                  <div key={order.id} className="bg-slate-800 p-5 rounded-3xl border border-slate-700/80 space-y-3">
                    <div className="flex items-center justify-between border-b border-slate-700/80 pb-3">
                      <div>
                        <span className="font-black text-xs text-blue-400 bg-blue-950 px-2.5 py-1 rounded-lg">
                          {order.id}
                        </span>
                        <span className="ml-2 text-[11px] text-slate-400 font-bold">
                          {new Date(order.timestamp).toLocaleString()}
                        </span>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-[10px] font-black ${
                        order.status === 'PENDING' ? 'bg-amber-500/20 text-amber-300' :
                        order.status === 'APPROVED' ? 'bg-emerald-500/20 text-emerald-300' :
                        order.status === 'DELIVERED' ? 'bg-blue-500/20 text-blue-300' :
                        'bg-rose-500/20 text-rose-300'
                      }`}>
                        {order.status}
                      </span>
                    </div>

                    <div className="text-xs space-y-1">
                      <div className="text-slate-300 font-bold">
                        Aynaas: <strong className="text-white">{order.orderType === 'DEBT_PAYMENT' ? 'Bixin Deyn (Debt Payment)' : 'Iibka Alaabta'}</strong>
                      </div>
                      <div className="text-slate-300 font-bold">
                        Habka Lacagta: <strong className="text-blue-300">{order.paymentMethod}</strong>
                      </div>
                      <div className="text-slate-300 font-bold">
                        Wadarta: <strong className="text-emerald-400 text-sm font-black">${order.totalAmount.toFixed(2)}</strong>
                      </div>
                    </div>

                    {/* Items taken */}
                    {order.items.length > 0 && (
                      <div className="bg-slate-900/80 p-3 rounded-2xl border border-slate-800 space-y-1.5 text-xs">
                        <div className="text-[10px] font-black uppercase text-slate-400">Alaabta la qaatay:</div>
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between font-bold text-slate-300">
                            <span>{item.name} x {item.quantity}</span>
                            <span className="text-white">${(item.sellPrice * item.quantity).toFixed(2)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="pt-2 flex items-center justify-between">
                      <button
                        onClick={() => setPrintableOrder(order)}
                        className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black flex items-center gap-1.5 shadow-md"
                      >
                        <Printer size={14} /> Soo Dajiso Reshitka
                      </button>
                      
                      {order.receiptImage && (
                        <span className="text-[10px] text-emerald-400 font-bold flex items-center gap-1">
                          <CheckCircle2 size={12} /> Sawirka Reshitka Waa La Haysaa
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {userOrders.length === 0 && (
                <div className="text-center py-12 bg-slate-800/40 rounded-3xl border border-slate-700/60 text-slate-400 font-bold text-xs">
                  Ma jiro dalbad ama bixin deyn ah oo laga helay taariikhdan!
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cart Drawer Modal */}
        {isCartOpen && (
          <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm z-[100] flex justify-end">
            <div className="w-full max-w-md bg-slate-900 h-full p-6 flex flex-col justify-between border-l border-slate-800 shadow-2xl animate-in slide-in-from-right duration-300">
              <div>
                <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-4">
                  <div className="flex items-center gap-2">
                    <ShoppingCart className="text-blue-500" size={22} />
                    <h2 className="text-lg font-black text-white">Kaadhka Iibka (Basket)</h2>
                  </div>
                  <button onClick={() => setIsCartOpen(false)} className="text-slate-400 hover:text-white">
                    <ArrowLeft size={22} />
                  </button>
                </div>

                {cart.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 font-bold text-sm">
                    Basket-ku waa maran yahay! Dooro alaab.
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                    {cart.map(item => (
                      <div key={item.id} className="bg-slate-800 p-3 rounded-2xl flex items-center justify-between border border-slate-700/80">
                        <div>
                          <h4 className="font-bold text-xs text-white">{item.name}</h4>
                          <p className="text-[10px] text-emerald-400 font-bold">${item.sellPrice.toFixed(2)} x {item.quantity}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center gap-1 bg-slate-900 p-1 rounded-xl">
                            <button onClick={() => updateCartQty(item.id, -1)} className="p-1 text-slate-400 hover:text-white">
                              <Minus size={12} />
                            </button>
                            <span className="px-2 text-xs font-bold text-white">{item.quantity}</span>
                            <button onClick={() => updateCartQty(item.id, 1)} className="p-1 text-slate-400 hover:text-white">
                              <Plus size={12} />
                            </button>
                          </div>
                          <span className="font-black text-sm text-white">${(item.sellPrice * item.quantity).toFixed(2)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {cart.length > 0 && (
                <div className="border-t border-slate-800 pt-4 space-y-4">
                  <div className="flex items-center justify-between text-base font-black text-white">
                    <span>Wadarta Lacagta (Total):</span>
                    <span className="text-xl text-emerald-400">${cartSubtotal.toFixed(2)}</span>
                  </div>

                  <button
                    onClick={() => {
                      setIsCartOpen(false);
                      setIsCheckoutOpen(true);
                    }}
                    className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white rounded-2xl font-black text-base shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95"
                  >
                    <CreditCard size={18} /> Proceed to Payment & Receipt
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* CHECKOUT MODAL */}
        {isCheckoutOpen && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[110] flex items-center justify-center p-4 overflow-y-auto">
            <div className="max-w-2xl w-full bg-slate-800 rounded-3xl p-6 md:p-8 border border-slate-700 shadow-2xl space-y-6 my-8 animate-in zoom-in-95 duration-300">
              <div className="flex items-center justify-between border-b border-slate-700/80 pb-4">
                <div>
                  <h2 className="text-xl font-black text-white">Bixi Lacagta & Dir Reshitka</h2>
                  <p className="text-xs text-slate-400">Total Amount: <span className="text-emerald-400 font-black text-sm">${cartSubtotal.toFixed(2)}</span></p>
                </div>
                <button onClick={() => setIsCheckoutOpen(false)} className="text-slate-400 hover:text-white">
                  <ArrowLeft size={22} />
                </button>
              </div>

              {/* Customer Delivery Info Summary */}
              {currentUser ? (
                <div className="bg-slate-900/80 p-4 rounded-2xl border border-slate-700 text-xs space-y-1">
                  <div className="font-black text-blue-400 uppercase tracking-wider mb-1">Customer Delivery Details:</div>
                  <div className="text-white font-bold"><span className="text-slate-400">Magaca:</span> {currentUser.fullName} ({currentUser.phone})</div>
                  <div className="text-white font-bold"><span className="text-slate-400">Address/Qabale:</span> {currentUser.qabaleAddress}</div>
                  <div className="text-white font-bold"><span className="text-slate-400">Meel Caan Ah:</span> {currentUser.nearbyLandmark}</div>
                  {currentUser.locationUrl && (
                    <div className="text-blue-300 font-bold truncate">
                      <span className="text-slate-400">GPS Link:</span> {currentUser.locationUrl}
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-slate-900/90 p-5 rounded-3xl border border-blue-500/30 space-y-3">
                  <div className="flex flex-wrap items-center justify-between border-b border-slate-800 pb-2 gap-2">
                    <span className="font-black text-xs uppercase text-blue-400 tracking-wider flex items-center gap-1.5">
                      <User size={15} /> Xogtaada & Halka Laguugu Loo Soo Dirayo Alaabta
                    </span>
                    <button
                      type="button"
                      onClick={handleGetGpsLocationForGuest}
                      className="px-3 py-1 bg-blue-600/30 hover:bg-blue-600 text-blue-300 hover:text-white rounded-xl text-[10px] font-black border border-blue-500/40 flex items-center gap-1"
                    >
                      <MapPin size={12} /> {isGettingGps ? 'GPS-ka Waa La Raadinayaa...' : '📌 Share GPS Location'}
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400">Magacaaga oo Buuxa *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Axmed Cali"
                        className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white outline-none focus:border-blue-500"
                        value={guestDetails.fullName}
                        onChange={e => setGuestDetails({ ...guestDetails, fullName: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400">Nambarka Telefoonka *</label>
                      <input
                        type="tel"
                        required
                        placeholder="e.g. 0615000000"
                        className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white outline-none focus:border-blue-500"
                        value={guestDetails.phone}
                        onChange={e => setGuestDetails({ ...guestDetails, phone: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400">Degmada / Qabalada / Address *</label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. Hodan, Qabalaha 04"
                        className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white outline-none focus:border-blue-500"
                        value={guestDetails.qabaleAddress}
                        onChange={e => setGuestDetails({ ...guestDetails, qabaleAddress: e.target.value })}
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black uppercase text-slate-400">Meel Caan ah (Landmark)</label>
                      <input
                        type="text"
                        placeholder="e.g. Kasoo horjeedka Masjidka"
                        className="w-full px-3 py-2.5 bg-slate-950 border border-slate-700 rounded-xl text-xs font-bold text-white outline-none focus:border-blue-500"
                        value={guestDetails.nearbyLandmark}
                        onChange={e => setGuestDetails({ ...guestDetails, nearbyLandmark: e.target.value })}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Select Payment Method */}
              <div className="space-y-2">
                <label className="text-xs font-black uppercase text-slate-300 tracking-wider">
                  Dooro Habka Lacag Bixinta (Select Merchant Payment Option):
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                  {(Object.keys(paymentAccounts) as Array<keyof typeof paymentAccounts>).map(pm => (
                    <button
                      key={pm}
                      type="button"
                      onClick={() => setSelectedPayment(pm)}
                      className={`p-3 rounded-2xl border text-xs font-black text-center transition-all ${
                        selectedPayment === pm
                          ? 'bg-blue-600 text-white border-blue-400 shadow-lg scale-102'
                          : 'bg-slate-900 text-slate-300 border-slate-700 hover:border-slate-500'
                      }`}
                    >
                      {pm}
                    </button>
                  ))}
                </div>
              </div>

              {/* Account details box */}
              <div className="p-4 bg-gradient-to-r from-blue-900/40 to-slate-900 rounded-2xl border border-blue-500/30 text-xs space-y-2">
                <div className="font-black text-blue-300 text-sm flex items-center gap-2">
                  <CreditCard size={16} /> Account Details for {selectedPayment}:
                </div>
                <div className="text-white font-extrabold text-base tracking-wider bg-slate-950 p-3 rounded-xl border border-slate-800 flex items-center justify-between">
                  <span>Number: {paymentAccounts[selectedPayment].number}</span>
                  <span className="text-blue-400 font-bold text-xs">{paymentAccounts[selectedPayment].name}</span>
                </div>
                <p className="text-slate-400 text-[11px] font-medium">{paymentAccounts[selectedPayment].instructions}</p>
              </div>

              {/* Attach Receipt Image (Only if not Deyn Credit) */}
              {selectedPayment !== 'Deyn (Credit)' && (
                <div className="space-y-2">
                  <label className="text-xs font-black uppercase text-slate-300 tracking-wider">
                    Soo Geli Sawirka Reshitka Lacagta (Upload Payment Receipt Screenshot):
                  </label>
                  
                  {receiptImage ? (
                    <div className="relative w-full h-48 bg-slate-900 rounded-2xl overflow-hidden border border-slate-700 group">
                      <img src={receiptImage} alt="Payment Receipt" className="w-full h-full object-contain" />
                      <button
                        onClick={() => setReceiptImage('')}
                        className="absolute top-3 right-3 p-2 bg-red-600 text-white rounded-xl font-bold text-xs shadow-lg"
                      >
                        Kaa saar (Remove)
                      </button>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-slate-600 hover:border-blue-500 rounded-2xl p-6 flex flex-col items-center justify-center cursor-pointer bg-slate-900/50 hover:bg-slate-900 transition-all text-center">
                      <Upload size={32} className="text-blue-400 mb-2" />
                      <span className="text-xs font-black text-white">Guji si aad u soo geliso Sawirka Reshitka</span>
                      <span className="text-[10px] text-slate-400 mt-1">Supports PNG, JPG, JPEG (Max 5MB)</span>
                      <input type="file" accept="image/*" onChange={e => handleImageUpload(e, false)} className="hidden" />
                    </label>
                  )}
                </div>
              )}

              {/* Extra Notes */}
              <div className="space-y-1">
                <label className="text-[11px] font-black uppercase text-slate-400">Faahfaahin Dheeraad ah (Notes / Optional):</label>
                <input
                  type="text"
                  placeholder="e.g. Sidoo kale ii raaci xirmo bac ah..."
                  className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl outline-none focus:border-blue-500 text-xs font-bold text-white"
                  value={orderNotes}
                  onChange={e => setOrderNotes(e.target.value)}
                />
              </div>

              <button
                onClick={handleCompleteOrder}
                disabled={isSubmitting || (selectedPayment !== 'Deyn (Credit)' && !receiptImage)}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl font-black text-base shadow-xl flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                {isSubmitting ? (
                  <span>Dalbadka waa la dirayaa...</span>
                ) : (
                  <>
                    <Send size={18} /> Dir Dalbadka (Submit Online Order)
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* DEBT ONLINE PAYMENT MODAL */}
        {isDebtModalOpen && currentUser && (
          <div className="fixed inset-0 bg-slate-950/85 backdrop-blur-md z-[110] flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-slate-800 rounded-3xl p-6 md:p-8 border border-slate-700 space-y-5 animate-in zoom-in-95 duration-300">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <h3 className="text-lg font-black text-white flex items-center gap-2">
                  <DollarSign size={20} className="text-emerald-400" /> Bixi Deyn Online Ah
                </h3>
                <button onClick={() => setIsDebtModalOpen(false)} className="p-2 text-slate-400 hover:text-white">
                  <ArrowLeft size={20} />
                </button>
              </div>

              <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-xs space-y-1">
                <div className="text-amber-300 font-black">Deynka Hadda Lagu leeyahay:</div>
                <div className="text-2xl font-black text-white">${currentDebtBalance.toFixed(2)}</div>
              </div>

              <form onSubmit={handleSubmitDebtPayment} className="space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase text-slate-300">
                    Lacagta Aad Bixinayso ($ USD):
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    placeholder="e.g. 50.00"
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl outline-none focus:border-blue-500 text-sm font-black text-white"
                    value={debtPayAmount}
                    onChange={e => setDebtPayAmount(e.target.value)}
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase text-slate-300">Habka Bixinta:</label>
                  <select
                    className="w-full px-4 py-3 bg-slate-900 border border-slate-700 rounded-xl text-white font-bold text-xs"
                    value={debtPayMethod}
                    onChange={e => setDebtPayMethod(e.target.value as any)}
                  >
                    {['Golis', 'eBirr', 'Kaafi', 'Ku Iibso', 'eDahab', 'Commercial Bank'].map(m => (
                      <option key={m} value={m}>{m}</option>
                    ))}
                  </select>
                </div>

                {/* Receipt Upload for Debt */}
                <div className="space-y-1">
                  <label className="text-[11px] font-black uppercase text-slate-300">
                    Soo Geli Sawirka Reshitka Bixinta Lacagta:
                  </label>
                  {debtReceiptImage ? (
                    <div className="relative w-full h-36 bg-slate-900 rounded-2xl overflow-hidden border border-slate-700">
                      <img src={debtReceiptImage} alt="Debt Receipt" className="w-full h-full object-contain" />
                      <button
                        type="button"
                        onClick={() => setDebtReceiptImage('')}
                        className="absolute top-2 right-2 p-1.5 bg-red-600 text-white rounded-lg text-xs font-bold"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <label className="border-2 border-dashed border-slate-600 hover:border-blue-500 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer bg-slate-900/50 hover:bg-slate-900 transition-all text-center">
                      <Upload size={24} className="text-emerald-400 mb-1" />
                      <span className="text-xs font-black text-white">Guji si aad u soo geliso Reshitka</span>
                      <input type="file" accept="image/*" onChange={e => handleImageUpload(e, true)} className="hidden" />
                    </label>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !debtReceiptImage}
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white rounded-2xl font-black text-sm shadow-lg flex items-center justify-center gap-2"
                >
                  <Send size={16} /> Dir Bixinta Deynta (Submit Debt Payment)
                </button>
              </form>
            </div>
          </div>
        )}

        {/* PRINTABLE / DOWNLOADABLE RECEIPT MODAL */}
        {printableOrder && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[130] flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white text-slate-900 rounded-3xl p-6 md:p-8 space-y-5 shadow-2xl animate-in zoom-in-95 duration-300">
              <div className="text-center border-b pb-4">
                <h2 className="text-xl font-black uppercase tracking-wider">{data.settings.businessName}</h2>
                <p className="text-xs text-slate-500">Official Payment & Order Receipt</p>
                <div className="text-[11px] font-bold text-slate-400 mt-1">Receipt ID: #{printableOrder.id}</div>
              </div>

              <div className="text-xs space-y-1">
                <div><strong>Customer:</strong> {printableOrder.customer.fullName}</div>
                <div><strong>Phone:</strong> {printableOrder.customer.phone}</div>
                <div><strong>Date:</strong> {new Date(printableOrder.timestamp).toLocaleString()}</div>
                <div><strong>Payment Method:</strong> {printableOrder.paymentMethod}</div>
                <div className="flex items-center justify-between pt-1">
                  <span><strong>Status:</strong></span>
                  {printableOrder.paymentMethod === 'Deyn (Credit)' || String(printableOrder.paymentMethod).toLowerCase().includes('debt') ? (
                    <span className="px-2 py-0.5 bg-rose-100 text-rose-700 font-black rounded uppercase text-[10px]">
                      ❌ NOT PAID (DEYN)
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 font-black rounded uppercase text-[10px]">
                      ✅ PAID / CONFIRMED
                    </span>
                  )}
                </div>
                <div><strong>Type:</strong> {printableOrder.orderType === 'DEBT_PAYMENT' ? 'Bixin Deyn (Debt Payment)' : 'Iibka Alaabta'}</div>
              </div>

              {printableOrder.items.length > 0 && (
                <div className="border-t border-b py-2 space-y-1 text-xs">
                  <div className="font-black uppercase text-[10px] text-slate-400">Items List:</div>
                  {printableOrder.items.map((item, i) => (
                    <div key={i} className="flex justify-between font-bold">
                      <span>{item.name} x {item.quantity}</span>
                      <span>${(item.sellPrice * item.quantity).toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between font-black text-base border-t pt-2">
                <span>Total Amount:</span>
                <span className="text-emerald-600">${printableOrder.totalAmount.toFixed(2)}</span>
              </div>

              {/* Payment details & reminder */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-1.5 text-left text-[11px]">
                <p className="font-black uppercase text-slate-700">💳 Akoonnada Lacag Bixinta:</p>
                <div className="grid grid-cols-3 gap-1 font-mono text-[10px]">
                  <div><span className="text-slate-500 block">E-Birr:</span><strong>{data.settings.onlinePaymentNumbers?.ebirr || '0901234567'}</strong></div>
                  <div><span className="text-slate-500 block">CBE:</span><strong>{data.settings.onlinePaymentNumbers?.commercialBank || '1000123456789'}</strong></div>
                  <div><span className="text-slate-500 block">Kaafi:</span><strong>{data.settings.onlinePaymentNumbers?.kaafi || '0631234567'}</strong></div>
                </div>
                <p className="text-center font-black text-rose-700 uppercase pt-1 text-[10px]">
                  📢 Fadlan bixi lacagta deynta lagugu leeyahay adoo raali ah
                </p>
              </div>

              <div className="text-center text-[10px] text-slate-400">
                Waad ku mahadsan tahay nala shaqayntaada! (Thank you for your business!)
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

        {/* ORDER CONFIRMATION MODAL */}
        {completedOrder && (
          <div className="fixed inset-0 bg-slate-950/90 backdrop-blur-md z-[120] flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-slate-800 rounded-3xl p-6 md:p-8 border border-slate-700 text-center space-y-5 animate-in zoom-in-95 duration-300">
              <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-3xl flex items-center justify-center mx-auto">
                <CheckCircle2 size={40} />
              </div>
              <div>
                <h2 className="text-xl font-black text-white">Dalbadkaaga Waa La Diray!</h2>
                <p className="text-xs text-slate-300 mt-1">
                  Waad ku mahadsan tahay **{completedOrder.customer.fullName}**!
                </p>
              </div>

              <div className="bg-slate-900 p-4 rounded-2xl text-left text-xs space-y-2 border border-slate-700">
                <div className="flex justify-between font-bold text-slate-400">
                  <span>Order ID:</span>
                  <span className="text-white">{completedOrder.id}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-400">
                  <span>Wadarta Lacagta:</span>
                  <span className="text-emerald-400 font-black">${completedOrder.totalAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-400">
                  <span>Payment Method:</span>
                  <span className="text-blue-400">{completedOrder.paymentMethod}</span>
                </div>
                <div className="flex justify-between font-bold text-slate-400">
                  <span>Status:</span>
                  <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md font-black">
                    {completedOrder.status}
                  </span>
                </div>
              </div>

              <p className="text-[11px] text-slate-400">
                Maamulka Xaysimo Supermarket ayaa hubin doona reshitkaaga ka dibna ku soo gaarsiin doona alaabta.
              </p>

              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setPrintableOrder(completedOrder);
                    setCompletedOrder(null);
                  }}
                  className="flex-1 py-3 bg-blue-600 hover:bg-blue-500 text-white font-black text-xs rounded-xl shadow-lg flex items-center justify-center gap-1.5"
                >
                  <Printer size={15} /> Soo Dajiso Reshitka
                </button>
                <button
                  onClick={() => setCompletedOrder(null)}
                  className="py-3 px-4 bg-slate-700 hover:bg-slate-600 text-white font-bold text-xs rounded-xl"
                >
                  Kushaqee Dukaanka
                </button>
              </div>
            </div>
          </div>
        )}
          </>
        )}
      </main>
    </div>
  );
};

export default CustomerPortal;
