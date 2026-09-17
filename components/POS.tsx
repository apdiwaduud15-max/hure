
import React, { useState, useMemo, useEffect, useRef } from 'react';
import { AppData, Product, Currency, PaymentMethod, Transaction, CartItem, Customer, Account, UserRole, AccountType } from '../types';
import { Search, ShoppingCart, Plus, Minus, User, Users, CheckCircle2, UserPlus, CreditCard, Wallet, Banknote, Calculator, Printer, X, Smartphone, Trash2, Package, Camera, RotateCcw, Calendar, FileText, AlertCircle, Edit3, ArrowRightLeft, DollarSign, Send, Check } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { formatCurrency, generateId, sendWhatsAppReceipt } from '../lib/utils';
import { sendInstantTransactionAlert } from '../lib/emailAlertService';
import CustomerReturnModal from './CustomerReturnModal';

interface CartPriceInputProps {
  item: CartItem;
  currency: Currency;
  rate: number;
  isCashier?: boolean;
  onUpdatePrice: (id: string, newPriceInLocal: number) => void;
  onValidatePrice: (id: string, currentPriceInLocal: number) => void;
}

const CartPriceInput: React.FC<CartPriceInputProps> = ({ item, currency, rate, isCashier, onUpdatePrice, onValidatePrice }) => {
  const isETB = currency === Currency.ETB;
  const currentRate = isETB ? (rate || 1) : 1;
  const initialLocalVal = Math.round((item.sellPrice * currentRate) * 100) / 100;

  const [valStr, setValStr] = useState<string>(initialLocalVal.toString());

  useEffect(() => {
    setValStr(initialLocalVal.toString());
  }, [item.sellPrice, currency, rate]);

  return (
    <input 
      type="number" 
      step="any" 
      value={valStr} 
      onChange={(e) => {
        const s = e.target.value;
        setValStr(s);
        const parsed = parseFloat(s);
        if (!isNaN(parsed)) {
          onUpdatePrice(item.id, parsed);
        }
      }} 
      onBlur={() => {
        const parsed = parseFloat(valStr);
        onValidatePrice(item.id, parsed);
      }}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.currentTarget.blur();
        }
      }}
      className="w-24 px-2 py-1 bg-blue-50 border border-blue-200 rounded-md font-black text-xs text-blue-700 outline-none focus:ring-1 focus:ring-blue-500" 
      title={isCashier ? 'Edit Selling Price' : `Edit Selling Price (${currency}: ${formatCurrency(item.costPrice, currency, rate)})`}
    />
  );
};

interface Props {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  addLog: (action: string, details: string) => void;
  currency: Currency;
  cart?: CartItem[];
  setCart?: React.Dispatch<React.SetStateAction<CartItem[]>>;
  selectedCustomer?: Customer | null;
  setSelectedCustomer?: React.Dispatch<React.SetStateAction<Customer | null>>;
  onLoadItemsToPOS?: (items: CartItem[], customer?: Customer | null) => void;
  setActiveTab?: (tab: any) => void;
}

const POS: React.FC<Props> = ({ 
  data, 
  setData, 
  addLog, 
  currency,
  cart: externalCart,
  setCart: setExternalCart,
  selectedCustomer: externalCustomer,
  setSelectedCustomer: setExternalCustomer,
  onLoadItemsToPOS,
  setActiveTab
}) => {
  const [internalCart, setInternalCart] = useState<CartItem[]>([]);
  const cart = externalCart !== undefined ? externalCart : internalCart;
  const setCart = setExternalCart !== undefined ? setExternalCart : setInternalCart;

  const [internalCustomer, setInternalCustomer] = useState<Customer | null>(null);
  const selectedCustomer = externalCustomer !== undefined ? externalCustomer : internalCustomer;
  const setSelectedCustomer = setExternalCustomer !== undefined ? setExternalCustomer : setInternalCustomer;

  const [search, setSearch] = useState('');
  const [showCheckout, setShowCheckout] = useState(false);
  const [showReceipt, setShowReceipt] = useState(false);
  const [lastTransaction, setLastTransaction] = useState<Transaction | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [taxPercent] = useState(data.settings.taxRate);
  const [searchCustomer, setSearchCustomer] = useState('');
  const [isAddingCustomer, setIsAddingCustomer] = useState(false);
  const [isCartMobileOpen, setIsCartMobileOpen] = useState(false);
  const [checkoutError, setCheckoutError] = useState('');
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [showReturnModal, setShowReturnModal] = useState(false);
  const [lastRemovedItem, setLastRemovedItem] = useState<CartItem | null>(null);
  const [lastClearedCart, setLastClearedCart] = useState<CartItem[] | null>(null);

  const getInitialDateTime = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  };

  const [saleDate, setSaleDate] = useState<string>(getInitialDateTime);
  const [pageNumber, setPageNumber] = useState<string>('');
  
  const [incomeAccountId, setIncomeAccountId] = useState<string>('');
  const [defaultItemPaymentMethod, setDefaultItemPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const rate = data.settings.exchangeRate;

  useEffect(() => {
    if (showCheckout) {
      let defaultAccount: Account | undefined;
      if (paymentMethod === PaymentMethod.CASH) {
        defaultAccount = data.accounts.find(a => a.name.toLowerCase().includes('cash'));
      } else if (paymentMethod === PaymentMethod.BANK) {
        defaultAccount = data.accounts.find(a => a.name.toLowerCase().includes('bank'));
      } else if (paymentMethod === PaymentMethod.MOBILE_MONEY) {
        defaultAccount = data.accounts.find(a => a.name.toLowerCase().includes('mobile'));
      }
      if (defaultAccount) setIncomeAccountId(defaultAccount.id);
    }
  }, [showCheckout, paymentMethod, data.accounts]);

  const [partialCash, setPartialCash] = useState(0);
  const [partialBank, setPartialBank] = useState(0);
  const [partialMobile, setPartialMobile] = useState(0);
  const [cashReceived, setCashReceived] = useState(0);
  const [discount, setDiscount] = useState(0);
  const [discountType, setDiscountType] = useState<'FLAT' | 'PERCENT'>('FLAT');

  // Dual Currency Input Mode for Checkout ('ETB' or 'USD')
  const [posCurrencyMode, setPosCurrencyMode] = useState<'ETB' | 'USD'>('ETB');

  // Strict Role Checking (Cashier vs Manager / Admin)
  const isCashier = data.settings?.currentUser?.role === UserRole.CASHIER;

  // Debt Management in POS
  const [showDebtorsListModal, setShowDebtorsListModal] = useState(false);
  const [debtorsSearch, setDebtorsSearch] = useState('');
  const [showPayDebtModal, setShowPayDebtModal] = useState(false);
  const [payingCustomer, setPayingCustomer] = useState<Customer | null>(null);
  const [debtPayAmount, setDebtPayAmount] = useState<string>('');
  const [debtPayAccount, setDebtPayAccount] = useState<string>('');
  const [debtPayNotes, setDebtPayNotes] = useState<string>('');
  const [isProcessingDebtPayment, setIsProcessingDebtPayment] = useState(false);

  const handleOpenPayDebt = (cust: Customer) => {
    setPayingCustomer(cust);
    const isETB = currency === Currency.ETB;
    const currentRate = isETB ? (rate || 1) : 1;
    const amountLocal = Math.round((cust.debtBalance * currentRate) * 100) / 100;
    setDebtPayAmount(amountLocal.toString());
    const cashAcc = data.accounts?.find(a => a.name.toLowerCase().includes('cash') || a.name.toLowerCase().includes('khasnad')) || data.accounts?.[0];
    setDebtPayAccount(cashAcc ? cashAcc.id : '');
    setDebtPayNotes('');
    setShowPayDebtModal(true);
  };

  const handleConfirmDebtPayment = async () => {
    if (!payingCustomer) return;
    const parsedAmount = parseFloat(debtPayAmount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Fadlan geli qadar lacageed oo sax ah.');
      return;
    }

    const isETB = currency === Currency.ETB;
    const currentRate = isETB ? (rate || 1) : 1;
    const amountUSD = isETB ? (parsedAmount / currentRate) : parsedAmount;

    if (amountUSD > payingCustomer.debtBalance + 0.05) {
      alert(`⚠️ Qadarka aad gelisay (${formatCurrency(amountUSD, currency, rate)}) wuxuu ka badan yahay deynta lagu leeyahay (${formatCurrency(payingCustomer.debtBalance, currency, rate)})!`);
      return;
    }

    setIsProcessingDebtPayment(true);
    const paymentTxId = generateId();
    const paymentTimestamp = Date.now();
    const targetAccount = data.accounts?.find(a => a.id === debtPayAccount) || data.accounts?.[0];

    const paymentTx: Transaction = {
      id: paymentTxId,
      items: [],
      subtotal: amountUSD,
      total: amountUSD,
      tax: 0,
      discount: 0,
      currency: currency,
      exchangeRate: rate || 1,
      paymentMethod: PaymentMethod.CASH,
      customerId: payingCustomer.id,
      customerName: payingCustomer.name,
      cashierName: data.settings?.currentUser?.name || 'Cashier',
      timestamp: paymentTimestamp,
      type: 'DEBT_PAYMENT',
      accountId: targetAccount?.id,
      notes: debtPayNotes.trim() || `Deyn bixin: ${payingCustomer.name}`
    };

    setData(prev => {
      const updatedAccounts = (prev.accounts || []).map(a => {
        if (targetAccount && a.id === targetAccount.id) {
          return { ...a, balance: a.balance + amountUSD };
        }
        return a;
      });

      const updatedCustomers = (prev.customers || []).map(c => {
        if (c.id === payingCustomer.id) {
          const newDebt = Math.max(0, c.debtBalance - amountUSD);
          return {
            ...c,
            debtBalance: newDebt,
            history: [...(c.history || []), paymentTxId]
          };
        }
        return c;
      });

      return {
        ...prev,
        transactions: [paymentTx, ...(prev.transactions || [])],
        accounts: updatedAccounts,
        customers: updatedCustomers,
        lastModified: Date.now()
      };
    });

    addLog('Debt Payment', `Macamiilka ${payingCustomer.name} wuxuu bixiyay deyn dhan ${formatCurrency(amountUSD, currency, rate)} (#${paymentTxId.slice(-5)}).`);

    // Instant Alert on Confirm (Isla Ilbiriqsigaas)
    sendInstantTransactionAlert(data, paymentTx, 'CONFIRM').catch(err => {
      console.warn('Debt payment alert failed:', err);
    });

    alert(`✅ Si guul leh ayaa loo qabtay deynta!\n• Macamiilka: ${payingCustomer.name}\n• Lacagta la bixiyay: ${formatCurrency(amountUSD, currency, rate)}\n• Haraaga: ${formatCurrency(Math.max(0, payingCustomer.debtBalance - amountUSD), currency, rate)}`);

    setIsProcessingDebtPayment(false);
    setShowPayDebtModal(false);
    if (selectedCustomer?.id === payingCustomer.id) {
      setSelectedCustomer(prev => prev ? { ...prev, debtBalance: Math.max(0, prev.debtBalance - amountUSD) } : null);
    }
    setPayingCustomer(null);
  };

  const scannerRef = useRef<Html5QrcodeScanner | null>(null);
  const cartListRef = useRef<HTMLDivElement>(null);
  const cartEndRef = useRef<HTMLDivElement>(null);
  const prevCartLengthRef = useRef<number>(cart.length);

  // Auto scroll down smoothly when a new item is added to the cart
  useEffect(() => {
    if (cart.length > prevCartLengthRef.current) {
      setTimeout(() => {
        if (cartEndRef.current) {
          cartEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        } else if (cartListRef.current) {
          cartListRef.current.scrollTo({ top: cartListRef.current.scrollHeight, behavior: 'smooth' });
        }
      }, 60);
    }
    prevCartLengthRef.current = cart.length;
  }, [cart.length]);

  useEffect(() => {
    if (isScannerOpen) {
      const scanner = new Html5QrcodeScanner(
        "reader",
        { fps: 10, qrbox: { width: 250, height: 150 } },
        /* verbose= */ false
      );
      
      scanner.render((decodedText) => {
        const product = data.products.find(p => p.barcode === decodedText || p.sku === decodedText);
        if (product) {
          addToCart(product);
          if (navigator.vibrate) navigator.vibrate(100);
          setIsScannerOpen(false);
          scanner.clear();
        }
      }, (error) => {
        // console.warn(error);
      });

      scannerRef.current = scanner;
    } else {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Failed to clear scanner", err));
        scannerRef.current = null;
      }
    }

    return () => {
      if (scannerRef.current) {
        scannerRef.current.clear().catch(err => console.error("Failed to clear scanner", err));
      }
    };
  }, [isScannerOpen, data.products]);

  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const categories = useMemo(() => {
    const cats = new Set<string>();
    data.products.forEach(p => {
      if (p.category) cats.add(p.category);
    });
    return Array.from(cats);
  }, [data.products]);

  const filteredProducts = useMemo(() => {
    const term = search.toLowerCase();
    return data.products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(term) ||
        p.barcode.toLowerCase().includes(term) ||
        p.sku.toLowerCase().includes(term);
      
      if (selectedCategory === 'ALL') return matchesSearch;
      return matchesSearch && p.category.toLowerCase() === selectedCategory.toLowerCase();
    });
  }, [data.products, search, selectedCategory]);

  const filteredCustomers = useMemo(() => {
    if (!searchCustomer) return [];
    return data.customers.filter(c => 
      c.phone.includes(searchCustomer) || 
      c.name.toLowerCase().includes(searchCustomer.toLowerCase())
    );
  }, [data.customers, searchCustomer]);

  const paymentBreakdown = useMemo(() => {
    let cash = 0;
    let bank = 0;
    let mobile = 0;
    let debt = 0;
    
    cart.forEach(item => {
      const itemTotal = (item.sellPrice || 0) * (item.quantity || 0);
      const pm = item.paymentMethod || PaymentMethod.CASH;
      if (pm === PaymentMethod.CASH) cash += itemTotal;
      else if (pm === PaymentMethod.BANK) bank += itemTotal;
      else if (pm === PaymentMethod.MOBILE_MONEY) mobile += itemTotal;
      else if (pm === PaymentMethod.DEBT) debt += itemTotal;
    });

    const usedCount = (cash > 0 ? 1 : 0) + (bank > 0 ? 1 : 0) + (mobile > 0 ? 1 : 0) + (debt > 0 ? 1 : 0);
    const hasMixedMethods = usedCount > 1;

    return { cash, bank, mobile, debt, hasMixedMethods, usedCount };
  }, [cart]);

  const updateItemPaymentMethod = (id: string, method: PaymentMethod) => {
    setCart(prev => prev.map(item => item.id === id ? { ...item, paymentMethod: method } : item));
  };

  const setAllItemsPaymentMethod = (method: PaymentMethod) => {
    setDefaultItemPaymentMethod(method);
    setPaymentMethod(method);
    setCart(prev => prev.map(item => ({ ...item, paymentMethod: method })));
  };

  const addToCart = (product: Product) => {
    const liveProd = data.products.find(p => p.id === product.id) || product;
    
    if (liveProd.stock <= 0) {
      alert(`⚠️ Lama iibin karo sheygan "${liveProd.name}" sababtoo ah kuuma yaalo stock (Stock-gu waa 0)!`);
      return;
    }

    const currentMethod = defaultItemPaymentMethod || PaymentMethod.CASH;

    setCart(prev => {
      const existing = prev.find(item => item.id === product.id);
      if (existing) {
        if (existing.quantity + 1 > liveProd.stock) {
          alert(`⚠️ Lama iibin karo sheygan "${liveProd.name}" in ka badan inta kuu taala!\nStock-ga kuu yaala waa ${liveProd.stock} ${liveProd.unit || 'xabo'}, khaanada waxaa kuugu jira ${existing.quantity}.`);
          return prev;
        }
        return prev.map(item => item.id === product.id ? { ...item, quantity: item.quantity + 1 } : item);
      }
      return [...prev, { ...product, quantity: 1, paymentMethod: currentMethod }];
    });
  };

  const clearCart = () => {
    if (cart.length > 0) {
      setLastClearedCart([...cart]);
      setLastRemovedItem(null);
      setCart([]);
    }
  };

  const updateCartPrice = (id: string, newPriceInLocal: number) => {
    const isETB = currency === Currency.ETB;
    const currentRate = isETB ? (rate || 1) : 1;
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        return { ...item, sellPrice: newPriceInLocal / currentRate };
      }
      return item;
    }));
  };

  const validateCartPriceOnBlur = (id: string, currentPriceInLocal: number) => {
    const isETB = currency === Currency.ETB;
    const currentRate = isETB ? (rate || 1) : 1;
    setCart(prev => prev.map(item => {
      if (item.id === id) {
        const minCostInLocal = item.costPrice * currentRate;
        if (isNaN(currentPriceInLocal) || currentPriceInLocal < minCostInLocal) {
          if (isCashier) {
            alert(`⚠️ Badbaadinta Qiimaha:\nQiimaha iibku kama hoos mari karo qiimaha ugu yar ee dukaanka u gooyay.`);
          } else {
            alert(`⚠️ Badbaadinta Faa'iidada (Cost Protection):\nQiimaha iibku kama hoos mari karo qiimaha lagu soo iibiyay (${formatCurrency(item.costPrice, currency, rate)}).\nQiimaha waxaa lagu xirayaa Cost Price-ka.`);
          }
          return { ...item, sellPrice: item.costPrice };
        }
      }
      return item;
    }));
  };

  const updateQuantity = (id: string, delta: number) => {
    setCart(prev => {
      const target = prev.find(item => item.id === id);
      const liveProd = data.products.find(p => p.id === id);
      
      if (delta > 0 && target && liveProd) {
        if (target.quantity + delta > liveProd.stock) {
          alert(`⚠️ Lama iibin karo sheygan "${liveProd.name}" in ka badan inta kuu taala!\nStock-ga kuu yaala waa: ${liveProd.stock} ${liveProd.unit || 'xabo'}.`);
          return prev;
        }
      }

      if (target && target.quantity <= 0.11 && delta < 0) {
        setLastRemovedItem(target);
        setLastClearedCart(null);
      }
      return prev.map(item => {
        if (item.id === id) {
          const newQty = Math.max(0, parseFloat((item.quantity + delta).toFixed(2)));
          return { ...item, quantity: newQty };
        }
        return item;
      }).filter(item => item.quantity > 0);
    });
  };

  const setCustomItemQuantity = (id: string, requestedVal: number) => {
    const liveProd = data.products.find(p => p.id === id);
    const maxStock = liveProd ? liveProd.stock : 0;
    if (requestedVal > maxStock) {
      alert(`⚠️ Lama iibin karo sheygan "${liveProd?.name || 'sheygan'}" in ka badan inta kuu taala!\nStock-ga kuu yaala waa: ${maxStock}, ma iibin kartid ${requestedVal}.`);
      setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: maxStock } : i).filter(i => i.quantity > 0));
      return;
    }
    setCart(prev => prev.map(i => i.id === id ? { ...i, quantity: requestedVal } : i).filter(i => i.quantity > 0));
  };

  const subtotal = cart.reduce((acc, item) => acc + (item.sellPrice * item.quantity), 0);
  const discountAmount = discountType === 'FLAT' ? discount : (subtotal * (discount / 100));
  const tax = Math.max(0, subtotal - discountAmount) * (taxPercent / 100);
  const total = Math.max(0, subtotal - discountAmount + tax);

  const openCheckout = () => {
    if (cart.length === 0) return;

    if (paymentBreakdown.hasMixedMethods) {
      setPaymentMethod(PaymentMethod.PARTIAL);
      const factor = subtotal > 0 ? (total / subtotal) : 1;
      setPartialCash(Math.round(paymentBreakdown.cash * factor * 100) / 100);
      setPartialBank(Math.round(paymentBreakdown.bank * factor * 100) / 100);
      setPartialMobile(Math.round(paymentBreakdown.mobile * factor * 100) / 100);
    } else {
      const firstMethod = cart[0]?.paymentMethod || defaultItemPaymentMethod || PaymentMethod.CASH;
      setPaymentMethod(firstMethod);
      if (firstMethod === PaymentMethod.CASH) {
        setCashReceived(total);
        setPartialCash(total);
        setPartialBank(0);
        setPartialMobile(0);
      } else if (firstMethod === PaymentMethod.BANK) {
        setPartialBank(total);
        setPartialCash(0);
        setPartialMobile(0);
      } else if (firstMethod === PaymentMethod.MOBILE_MONEY) {
        setPartialMobile(total);
        setPartialCash(0);
        setPartialBank(0);
      } else if (firstMethod === PaymentMethod.DEBT) {
        setPartialCash(0);
        setPartialBank(0);
        setPartialMobile(0);
      }
    }
    setShowCheckout(true);
  };

  const closeReceipt = () => {
    setShowReceipt(false);
    setLastTransaction(null);
  };

  const processSale = () => {
    if (cart.length === 0) return;

    // Check that every cart item is in stock
    for (const item of cart) {
      const liveProd = data.products.find(p => p.id === item.id);
      const currentStock = liveProd ? liveProd.stock : 0;
      if (!liveProd || item.quantity > currentStock) {
        const errMsg = `⚠️ Lama iibin karo sheygan "${item.name}" sababtoo ah kuuma yaalo stock ku filan!\nStock-ga yaala: ${currentStock} ${item.unit || 'xabo'}\nWaxaad rabtaa inaad iibiso: ${item.quantity}`;
        setCheckoutError(`Lama iibin karo "${item.name}": Stock-ga yaala waa ${currentStock}`);
        alert(errMsg);
        return;
      }
    }

    const cashAcc = data.accounts.find(a => a.name.toLowerCase().includes('cash'));
    const bankAcc = data.accounts.find(a => a.name.toLowerCase().includes('bank'));
    const mobileAcc = data.accounts.find(a => a.name.toLowerCase().includes('mobile'));

    let targetAccountId = incomeAccountId;
    if (!targetAccountId && paymentMethod !== PaymentMethod.DEBT && paymentMethod !== PaymentMethod.PARTIAL) {
      if (paymentMethod === PaymentMethod.CASH && cashAcc) targetAccountId = cashAcc.id;
      else if (paymentMethod === PaymentMethod.BANK && bankAcc) targetAccountId = bankAcc.id;
      else if (paymentMethod === PaymentMethod.MOBILE_MONEY && mobileAcc) targetAccountId = mobileAcc.id;
    }

    if (!targetAccountId && paymentMethod !== PaymentMethod.DEBT && paymentMethod !== PaymentMethod.PARTIAL) {
      setCheckoutError("Select deposit account.");
      return;
    }
    if ((paymentMethod === PaymentMethod.DEBT || paymentMethod === PaymentMethod.PARTIAL) && !selectedCustomer) {
      // If partial has remaining debt
      const received = (partialCash + partialBank + partialMobile);
      if (total - received > 0.01) {
        setCheckoutError("Dooro macamiilka maadaama ay jirto lacag deyn ah (Select customer).");
        return;
      }
    }
    
    setCheckoutError('');

    const transactionId = generateId();
    let finalDebt = 0;
    let depositAmount = total;
    let details = undefined;

    if (paymentMethod === PaymentMethod.DEBT) { 
      finalDebt = total; 
      depositAmount = 0; 
    }
    else if (paymentMethod === PaymentMethod.PARTIAL) {
      const received = (partialCash + partialBank + partialMobile);
      if (received > total + 0.01) {
        setCheckoutError("Total received exceeds total amount.");
        return;
      }
      finalDebt = Math.max(0, total - received); 
      depositAmount = received;
      details = { cash: partialCash, bank: partialBank, mobile: partialMobile, debt: finalDebt };
    } else if (paymentMethod === PaymentMethod.CASH && cashReceived > total) {
      depositAmount = total;
      details = { cash: total, bank: 0, mobile: 0, debt: 0 };
    } else if (paymentMethod === PaymentMethod.CASH) {
      details = { cash: total, bank: 0, mobile: 0, debt: 0 };
    } else if (paymentMethod === PaymentMethod.BANK) {
      details = { cash: 0, bank: total, mobile: 0, debt: 0 };
    } else if (paymentMethod === PaymentMethod.MOBILE_MONEY) {
      details = { cash: 0, bank: 0, mobile: total, debt: 0 };
    }

    const saleTimestamp = saleDate ? new Date(saleDate).getTime() : Date.now();

    const transaction: Transaction = {
      id: transactionId,
      items: [...cart],
      subtotal,
      tax,
      total,
      currency,
      exchangeRate: Number(rate) || 190,
      paymentMethod,
      accountId: targetAccountId || (cashAcc ? cashAcc.id : undefined),
      paymentDetails: details,
      customerId: selectedCustomer?.id,
      customerName: selectedCustomer?.name || 'Walking Customer',
      timestamp: saleTimestamp,
      type: 'SALE',
      discount: discountAmount,
      pageNumber: pageNumber.trim() || undefined
    };

    setData(prev => {
      let updatedAccounts = [...prev.accounts];
      const totalCost = cart.reduce((sum, item) => sum + (item.costPrice * item.quantity), 0);
      
      // 1. Update Inventory Asset Account (Decrease by cost)
      const invAcc = updatedAccounts.find(a => a.id === 'acc-inv' || a.name.toLowerCase().includes('inventory'));
      if (invAcc) {
        updatedAccounts = updatedAccounts.map(a => a.id === invAcc.id ? { ...a, balance: a.balance - totalCost } : a);
      }

      // 2. Update Income Accounts (Increase by received amount)
      if (paymentMethod === PaymentMethod.PARTIAL) {
        if (partialCash > 0 && cashAcc) {
          updatedAccounts = updatedAccounts.map(a => a.id === cashAcc.id ? { ...a, balance: a.balance + partialCash } : a);
        }
        if (partialBank > 0 && bankAcc) {
          updatedAccounts = updatedAccounts.map(a => a.id === bankAcc.id ? { ...a, balance: a.balance + partialBank } : a);
        }
        if (partialMobile > 0 && mobileAcc) {
          updatedAccounts = updatedAccounts.map(a => a.id === mobileAcc.id ? { ...a, balance: a.balance + partialMobile } : a);
        }
      } else if (depositAmount > 0 && targetAccountId) {
        updatedAccounts = updatedAccounts.map(a => a.id === targetAccountId ? { ...a, balance: a.balance + depositAmount } : a);
      }

      return {
        ...prev,
        transactions: [...prev.transactions, transaction],
        products: prev.products.map(p => {
          const ci = cart.find(item => item.id === p.id);
          return ci ? { ...p, stock: p.stock - ci.quantity } : p;
        }),
        accounts: updatedAccounts,
        customers: prev.customers.map(c => {
          if (c.id === selectedCustomer?.id) {
            return {
              ...c, debtBalance: c.debtBalance + finalDebt,
              loyaltyPoints: c.loyaltyPoints + Math.floor(total),
              history: [...c.history, transactionId]
            };
          }
          return c;
        })
      };
    });

    addLog('POS Sale', `INV-${transactionId.slice(-5).toUpperCase()} processed.`);
    
    // Instant Email Alert on Checkout / Save (Isla Ilbiriqsigaas)
    sendInstantTransactionAlert(data, transaction, 'CHECKOUT').catch(err => {
      console.warn('Instant checkout alert error:', err);
    });

    setLastTransaction(transaction);
    setCart([]);
    setLastRemovedItem(null);
    setLastClearedCart(null);
    setShowCheckout(false);
    setShowReceipt(true);
    setSelectedCustomer(null);
    setSearchCustomer('');
    setSaleDate(getInitialDateTime());
    setPageNumber('');
    setIsCartMobileOpen(false);
    setDiscount(0);
    setDiscountType('FLAT');
  };

  const renderCartContent = () => (
    <div className="flex flex-col h-full bg-white">
      {/* 1. Cart Header */}
      <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/60 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-600/10 text-blue-600 flex items-center justify-center font-black">
            <ShoppingCart size={18} />
          </div>
          <div>
            <h3 className="text-base font-black text-slate-900 leading-tight">
              Gaariga Iibka (Cart)
            </h3>
            <p className="text-[10px] text-slate-400 font-bold">
              {cart.length} {cart.length === 1 ? 'shey' : 'alaabood'} ayaa ku jira
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {cart.length > 0 && (
            <button 
              onClick={clearCart} 
              className="px-3 py-1.5 bg-rose-50 text-rose-600 hover:bg-rose-100 rounded-xl transition-all flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider border border-rose-200/60 shadow-xs" 
              title="Faaruqi Gaariga (Clear Cart)"
            >
              <Trash2 size={13} />
              <span>Faaruqi</span>
            </button>
          )}
          <button className="lg:hidden p-2 text-slate-400 hover:text-slate-700" onClick={() => setIsCartMobileOpen(false)}>
            <X size={22} />
          </button>
        </div>
      </div>

      {/* 2. Customer Selection Strip */}
      <div className="p-3.5 sm:p-4 border-b border-slate-100 bg-white shrink-0 space-y-3">
        {selectedCustomer ? (
          <div className="flex items-center justify-between bg-slate-900 text-white p-2.5 px-3 rounded-2xl shadow-sm animate-in slide-in-from-bottom-2">
            <div className="flex items-center gap-2.5 truncate">
              <div className="w-8 h-8 rounded-full bg-slate-800 flex items-center justify-center text-slate-300 border border-slate-700 shrink-0">
                {selectedCustomer.photo ? <img src={selectedCustomer.photo} className="w-full h-full object-cover rounded-full" /> : <User size={14} />}
              </div>
              <div className="truncate">
                <p className="text-xs font-black truncate">{selectedCustomer.name}</p>
                <p className="text-[9px] text-slate-400 font-bold">{selectedCustomer.phone || 'No phone'}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5">
              {selectedCustomer.debtBalance > 0 && (
                <button
                  type="button"
                  onClick={() => handleOpenPayDebt(selectedCustomer)}
                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black shadow-xs flex items-center gap-1 transition-all cursor-pointer"
                  title="Ka saar ama bixi deynta macamiilka"
                >
                  <Wallet size={12} />
                  <span>Bixi Deyn ({formatCurrency(selectedCustomer.debtBalance, currency, rate)})</span>
                </button>
              )}
              <button 
                onClick={() => setSelectedCustomer(null)} 
                className="p-1.5 hover:bg-slate-800 rounded-lg text-slate-400 hover:text-white transition-colors"
                title="Ka saar macamiilka"
              >
                <X size={15} />
              </button>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={15} />
              <input 
                type="text" 
                placeholder="Ku dar macamiil (Customer)..." 
                className="w-full pl-9 pr-11 py-2.5 bg-slate-50 border border-slate-200 rounded-2xl outline-none text-xs font-bold focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all" 
                value={searchCustomer} 
                onChange={e => setSearchCustomer(e.target.value)} 
              />
              <button 
                onClick={() => setIsAddingCustomer(true)} 
                className="absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-xs transition-colors"
                title="Diiwaangeli Macaamiil Cusub"
              >
                <UserPlus size={13} />
              </button>
              {filteredCustomers.length > 0 && (
                <div className="absolute top-full mt-2 left-0 w-full bg-white border border-slate-200 rounded-2xl shadow-2xl z-30 max-h-48 overflow-y-auto p-1.5 divide-y divide-slate-50">
                  {filteredCustomers.map(c => (
                    <button 
                      key={c.id} 
                      onClick={() => { setSelectedCustomer(c); setSearchCustomer(''); }} 
                      className="w-full p-2.5 text-left flex items-center justify-between hover:bg-slate-50 rounded-xl transition-colors"
                    >
                      <div className="flex items-center gap-2.5 truncate">
                        <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center border text-slate-400 shrink-0">
                          {c.photo ? <img src={c.photo} className="w-full h-full object-cover rounded-full" /> : <User size={13} />}
                        </div>
                        <div className="truncate">
                          <p className="text-xs font-black text-slate-900 truncate">{c.name}</p>
                          <p className="text-[9px] text-slate-400 font-bold">{c.phone}</p>
                        </div>
                      </div>
                      {c.debtBalance > 0 && (
                        <span className="text-[10px] font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded-lg border border-rose-200 shrink-0">
                          Deyn: {formatCurrency(c.debtBalance, currency, rate)}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Quick Debtors List Modal Button */}
            <button 
              type="button"
              onClick={() => setShowDebtorsListModal(true)}
              className="px-3 py-2.5 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200/80 rounded-2xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shrink-0 transition-all cursor-pointer shadow-xs"
              title="Eeg Macaamiisha Deynta Lagu Leeyahay (View Debtors)"
            >
              <Users size={14} />
              <span className="hidden sm:inline">Deymaha</span>
              <span className="bg-rose-200 text-rose-800 px-1.5 py-0.2 rounded-full text-[9px]">
                {data.customers.filter(c => c.debtBalance > 0).length}
              </span>
            </button>
          </div>
        )}

        {/* Quick Bulk Payment Method Switcher */}
        <div className="p-2 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10px] font-black text-slate-600 uppercase tracking-wider">
              Habka Lacagta (Kala Dooro):
            </span>
            <span className="text-[9px] font-bold text-blue-600">
              {defaultItemPaymentMethod}
            </span>
          </div>
          <div className="grid grid-cols-4 gap-1">
            <button
              type="button"
              onClick={() => setAllItemsPaymentMethod(PaymentMethod.CASH)}
              className={`py-1.5 px-1 rounded-xl font-black text-[10px] uppercase transition-all flex items-center justify-center gap-1 cursor-pointer ${
                defaultItemPaymentMethod === PaymentMethod.CASH
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-emerald-50 hover:text-emerald-700 border border-slate-200'
              }`}
              title="U bedel dhammaan Cash"
            >
              <span>💵 Cash</span>
            </button>
            <button
              type="button"
              onClick={() => setAllItemsPaymentMethod(PaymentMethod.BANK)}
              className={`py-1.5 px-1 rounded-xl font-black text-[10px] uppercase transition-all flex items-center justify-center gap-1 cursor-pointer ${
                defaultItemPaymentMethod === PaymentMethod.BANK
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-blue-50 hover:text-blue-700 border border-slate-200'
              }`}
              title="U bedel dhammaan Bank"
            >
              <span>🏦 Bank</span>
            </button>
            <button
              type="button"
              onClick={() => setAllItemsPaymentMethod(PaymentMethod.MOBILE_MONEY)}
              className={`py-1.5 px-1 rounded-xl font-black text-[10px] uppercase transition-all flex items-center justify-center gap-1 cursor-pointer ${
                defaultItemPaymentMethod === PaymentMethod.MOBILE_MONEY
                  ? 'bg-purple-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-purple-50 hover:text-purple-700 border border-slate-200'
              }`}
              title="U bedel dhammaan Mobile Money"
            >
              <span>📱 Mobile</span>
            </button>
            <button
              type="button"
              onClick={() => setAllItemsPaymentMethod(PaymentMethod.DEBT)}
              className={`py-1.5 px-1 rounded-xl font-black text-[10px] uppercase transition-all flex items-center justify-center gap-1 cursor-pointer ${
                defaultItemPaymentMethod === PaymentMethod.DEBT
                  ? 'bg-rose-600 text-white shadow-xs'
                  : 'bg-white text-slate-600 hover:bg-rose-50 hover:text-rose-700 border border-slate-200'
              }`}
              title="U bedel dhammaan Deyn"
            >
              <span>📝 Deyn</span>
            </button>
          </div>
        </div>

        {/* 🌟 TOP SUB-TOTAL & CHECKOUT ACTION BANNER (KOR KEENIDDA WADARTA HORE & CHECKOUT) */}
        <div className="p-3 bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 text-white rounded-2xl border border-blue-500/30 shadow-md space-y-2.5 animate-in fade-in">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] uppercase font-black tracking-wider text-blue-300">
                  Wadarta Hore (Subtotal):
                </span>
                <span className="px-1.5 py-0.2 bg-blue-500/30 text-blue-200 text-[9px] font-black rounded-md">
                  {cart.reduce((s, i) => s + i.quantity, 0)} {cart.length === 1 ? 'shey' : 'alaab'}
                </span>
              </div>
              <div className="text-base sm:text-lg font-black text-amber-300 font-mono tracking-tight leading-tight mt-0.5">
                {formatCurrency(subtotal, currency, rate)}
              </div>
            </div>

            <div className="text-right shrink-0">
              <span className="text-[9px] uppercase font-black tracking-wider text-slate-400 block">
                Wadarta Guud (Total)
              </span>
              <div className="text-lg sm:text-2xl font-black text-emerald-400 font-mono tracking-tight leading-tight">
                {formatCurrency(total, currency, rate)}
              </div>
            </div>
          </div>

          {/* Payment Breakdown Preview Pills */}
          {cart.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 pt-1.5 border-t border-white/10">
              {paymentBreakdown.cash > 0 && (
                <span className="px-2 py-0.5 bg-emerald-500/20 border border-emerald-500/40 text-emerald-300 text-[10px] font-mono font-bold rounded-lg flex items-center gap-1">
                  <span>💵 Cash:</span>
                  <span>{formatCurrency(paymentBreakdown.cash, currency, rate)}</span>
                </span>
              )}
              {paymentBreakdown.bank > 0 && (
                <span className="px-2 py-0.5 bg-blue-500/20 border border-blue-500/40 text-blue-300 text-[10px] font-mono font-bold rounded-lg flex items-center gap-1">
                  <span>🏦 Bank:</span>
                  <span>{formatCurrency(paymentBreakdown.bank, currency, rate)}</span>
                </span>
              )}
              {paymentBreakdown.mobile > 0 && (
                <span className="px-2 py-0.5 bg-purple-500/20 border border-purple-500/40 text-purple-300 text-[10px] font-mono font-bold rounded-lg flex items-center gap-1">
                  <span>📱 Mobile:</span>
                  <span>{formatCurrency(paymentBreakdown.mobile, currency, rate)}</span>
                </span>
              )}
              {paymentBreakdown.debt > 0 && (
                <span className="px-2 py-0.5 bg-rose-500/20 border border-rose-500/40 text-rose-300 text-[10px] font-mono font-bold rounded-lg flex items-center gap-1">
                  <span>📝 Deyn:</span>
                  <span>{formatCurrency(paymentBreakdown.debt, currency, rate)}</span>
                </span>
              )}
            </div>
          )}

          {/* TOP DIRECT CHECKOUT BUTTON */}
          <button 
            disabled={cart.length === 0} 
            onClick={openCheckout} 
            className="w-full py-2.5 sm:py-3 bg-gradient-to-r from-emerald-500 via-teal-600 to-emerald-600 hover:from-emerald-400 hover:to-teal-500 text-white rounded-xl font-black text-xs sm:text-sm shadow-md shadow-emerald-600/30 active:scale-[0.98] disabled:opacity-40 disabled:grayscale transition-all flex items-center justify-center gap-2 cursor-pointer border border-emerald-400/40"
          >
            <CreditCard size={16} />
            <span>Dhammeystir Iibka (Checkout)</span>
            {cart.length > 0 && (
              <span className="ml-1 px-2 py-0.5 bg-black/25 rounded-md text-xs font-mono font-bold text-amber-200">
                {formatCurrency(total, currency, rate)}
              </span>
            )}
          </button>
        </div>
      </div>

      {/* 3. Middle Scrollable Cart Items List */}
      <div ref={cartListRef} className="flex-1 overflow-y-auto p-3.5 sm:p-4 space-y-3 touch-scroll scrollbar-hide">
        {lastRemovedItem && (
          <div className="p-2.5 px-3 bg-slate-900 text-white rounded-2xl flex items-center justify-between text-xs font-bold animate-in slide-in-from-top-2 shadow-md">
            <span className="truncate text-[11px]">Waxaa la saaray {lastRemovedItem.name}</span>
            <button 
              onClick={() => {
                setCart(prev => {
                  const existing = prev.find(i => i.id === lastRemovedItem.id);
                  if (existing) {
                    return prev.map(i => i.id === lastRemovedItem.id ? { ...i, quantity: i.quantity + lastRemovedItem.quantity } : i);
                  }
                  return [...prev, lastRemovedItem];
                });
                setLastRemovedItem(null);
              }} 
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors ml-2 flex-shrink-0"
            >
              Soo Celi
            </button>
          </div>
        )}

        {lastClearedCart && (
          <div className="p-2.5 px-3 bg-slate-900 text-white rounded-2xl flex items-center justify-between text-xs font-bold animate-in slide-in-from-top-2 shadow-md">
            <span className="text-[11px]">Gaariga waa la faaruqiyay</span>
            <button 
              onClick={() => {
                setCart(lastClearedCart);
                setLastClearedCart(null);
              }} 
              className="px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors ml-2 flex-shrink-0"
            >
              Soo Celi Dhammaan
            </button>
          </div>
        )}

        {cart.map((item, idx) => {
          const itemMethod = item.paymentMethod || PaymentMethod.CASH;
          return (
            <div 
              key={item.id} 
              className="p-3 bg-slate-50 hover:bg-slate-100/80 rounded-2xl border border-slate-200/70 shadow-xs transition-all space-y-2.5"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-blue-600 text-white font-black text-[10px] flex items-center justify-center shrink-0 shadow-xs">
                  #{idx + 1}
                </span>
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex-shrink-0 flex items-center justify-center overflow-hidden">
                  {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <ShoppingCart size={16} className="text-slate-300" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-black text-slate-800 truncate" title={item.name}>{item.name}</p>
                  <div className="flex items-center gap-1 mt-0.5">
                    <span className="text-[10px] text-slate-500 font-black">{currency === Currency.ETB ? 'ETB' : '$'}</span>
                    <CartPriceInput 
                      item={item} 
                      currency={currency} 
                      rate={rate || 1} 
                      isCashier={isCashier}
                      onUpdatePrice={updateCartPrice} 
                      onValidatePrice={validateCartPriceOnBlur} 
                    />
                    <span className="text-[9px] text-slate-400 font-bold">/ {item.unit || 'unit'}</span>
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="text-[9px] font-bold text-slate-400 block uppercase">Wadarta</span>
                  <p className="text-xs sm:text-sm font-black text-blue-700 font-mono">
                    {formatCurrency(item.sellPrice * item.quantity, currency, rate)}
                  </p>
                </div>
              </div>

              {/* 🌟 Per-Item Payment Method Selector (Kala dooro Cash / Bank / Mobile / Deyn) */}
              <div className="flex items-center justify-between gap-1 pt-2 border-t border-slate-200/60">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-tight">
                  Lacagta:
                </span>
                <div className="flex items-center gap-1 bg-white p-0.5 rounded-xl border border-slate-200 shadow-2xs">
                  <button
                    type="button"
                    onClick={() => updateItemPaymentMethod(item.id, PaymentMethod.CASH)}
                    className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-0.5 cursor-pointer ${
                      itemMethod === PaymentMethod.CASH
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-emerald-700 hover:bg-emerald-50'
                    }`}
                    title="Cash (Lacag Caddaan ah)"
                  >
                    <span>💵 Cash</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateItemPaymentMethod(item.id, PaymentMethod.BANK)}
                    className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-0.5 cursor-pointer ${
                      itemMethod === PaymentMethod.BANK
                        ? 'bg-blue-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-blue-700 hover:bg-blue-50'
                    }`}
                    title="Bank (CBE / Bank Transfer)"
                  >
                    <span>🏦 Bank</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateItemPaymentMethod(item.id, PaymentMethod.MOBILE_MONEY)}
                    className={`px-2 py-1 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-0.5 cursor-pointer ${
                      itemMethod === PaymentMethod.MOBILE_MONEY
                        ? 'bg-purple-600 text-white shadow-xs'
                        : 'text-slate-600 hover:text-purple-700 hover:bg-purple-50'
                    }`}
                    title="Mobile (E-Birr / Telebirr / Zaad)"
                  >
                    <span>📱 Mobile</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateItemPaymentMethod(item.id, PaymentMethod.DEBT)}
                    className={`px-1.5 py-1 rounded-lg text-[9px] font-black uppercase transition-all flex items-center gap-0.5 cursor-pointer ${
                      itemMethod === PaymentMethod.DEBT
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-rose-700 hover:bg-rose-50'
                    }`}
                    title="Deyn (Debt)"
                  >
                    <span>📝 Deyn</span>
                  </button>
                </div>
              </div>

              {/* Controls Bar */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200/60">
                <div className="flex items-center bg-white rounded-xl p-0.5 border border-slate-200 shadow-xs">
                  <button 
                    onClick={() => updateQuantity(item.id, item.unit === 'KG' ? -0.1 : -1)} 
                    className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Minus size={13}/>
                  </button>
                  {item.unit === 'KG' ? (
                    <div className="flex items-center px-1">
                      <input 
                        type="number" 
                        step="0.01" 
                        min="0"
                        value={item.quantity} 
                        onChange={(e) => {
                          const val = Math.max(0, parseFloat(e.target.value) || 0);
                          setCustomItemQuantity(item.id, val);
                        }} 
                        className="w-12 text-center text-xs font-black bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded p-0 border-none" 
                      />
                      <span className="text-[9px] font-black text-slate-400 ml-0.5">KG</span>
                    </div>
                  ) : (
                    <input 
                      type="number" 
                      step="1" 
                      min="1"
                      value={item.quantity} 
                      onChange={(e) => {
                        const val = Math.max(0, parseInt(e.target.value) || 0);
                        setCustomItemQuantity(item.id, val);
                      }} 
                      className="w-9 text-center text-xs font-black bg-transparent outline-none focus:ring-1 focus:ring-blue-500 rounded p-0 border-none" 
                    />
                  )}
                  <button 
                    onClick={() => updateQuantity(item.id, item.unit === 'KG' ? 0.1 : 1)} 
                    className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Plus size={13}/>
                  </button>
                </div>

                <button 
                  onClick={() => {
                    setLastRemovedItem(item);
                    setLastClearedCart(null);
                    setCart(prev => prev.filter(i => i.id !== item.id));
                  }} 
                  className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all text-xs flex items-center gap-1 font-bold"
                  title="Tirtir sheygan"
                >
                  <Trash2 size={14}/>
                  <span className="text-[10px]">Tirtir</span>
                </button>
              </div>
            </div>
          );
        })}

        {/* Bottom anchor for auto-scrolling when new item is added */}
        <div ref={cartEndRef} className="h-1 w-full" />

        {cart.length === 0 && (
          <div className="h-44 flex flex-col items-center justify-center text-slate-300 opacity-60">
            <ShoppingCart size={40} strokeWidth={1.5} className="mb-2 text-slate-300" />
            <p className="text-xs font-black uppercase tracking-wider text-slate-400">Gaarigu waa maran yahay</p>
            <p className="text-[10px] text-slate-400 mt-0.5">Taabo alaabta si aad gaariga ugu darto</p>
          </div>
        )}
      </div>

      {/* 4. Bottom Totals & Checkout Card - Closely Integrated & High Impact */}
      <div className="p-3.5 sm:p-4 bg-slate-900 text-white rounded-t-[28px] border-t border-slate-800 shadow-2xl space-y-3 shrink-0">
        <div className="space-y-2 text-xs">
          {/* Subtotal & Quick Discount */}
          <div className="flex items-center justify-between text-slate-400 font-bold">
            <span className="text-[11px]">Wadarta Hore (Subtotal):</span>
            <span className="font-mono text-white text-xs">{formatCurrency(subtotal, currency, rate)}</span>
          </div>
          
          <div className="flex items-center gap-2 pt-1 border-t border-white/10">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider shrink-0">Dhimis (Discount):</label>
            <div className="flex flex-1 gap-1.5">
              <select 
                value={discountType} 
                onChange={e => {
                  setDiscountType(e.target.value as 'FLAT' | 'PERCENT');
                  setDiscount(0);
                }}
                className="px-2 py-1 bg-slate-800 border border-slate-700 text-white rounded-xl text-[10px] font-bold focus:ring-1 focus:ring-blue-400 outline-none"
              >
                <option value="FLAT">{currency}</option>
                <option value="PERCENT">%</option>
              </select>
              <input 
                type="number" 
                value={discount || ''} 
                onChange={e => setDiscount(Math.max(0, parseFloat(e.target.value) || 0))} 
                placeholder="0" 
                className="w-full px-2.5 py-1 bg-slate-800 border border-slate-700 text-white rounded-xl text-xs font-bold focus:ring-1 focus:ring-blue-400 outline-none" 
              />
            </div>
          </div>

          {discountAmount > 0 && (
            <div className="flex justify-between text-xs text-rose-400 font-bold">
              <span>Dhimis (Discount):</span>
              <span className="font-mono">-{formatCurrency(discountAmount, currency, rate)}</span>
            </div>
          )}

          {tax > 0 && (
            <div className="flex justify-between text-xs text-slate-400 font-bold">
              <span>Canshuur ({taxPercent}%):</span>
              <span className="font-mono">{formatCurrency(tax, currency, rate)}</span>
            </div>
          )}

          {/* Prominent Totals Display */}
          <div className="flex justify-between items-center pt-2 border-t border-white/15">
            <div>
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-wider block">WADARTA GUUD</span>
              <span className="text-[10px] font-black text-amber-300 font-mono">
                {currency === Currency.ETB ? `$${(total / (rate || 1)).toFixed(2)} USD` : `${(total * (rate || 1)).toFixed(2)} ETB`}
              </span>
            </div>
            <div className="text-right">
              <span className="text-2xl sm:text-3xl font-black text-emerald-400 font-mono tracking-tight">
                {formatCurrency(total, currency, rate)}
              </span>
            </div>
          </div>
        </div>

        {/* Large Prominent Checkout Button */}
        <button 
          disabled={cart.length === 0} 
          onClick={openCheckout} 
          className="w-full py-3.5 sm:py-4 bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-500 text-white rounded-2xl font-black text-sm sm:text-base shadow-lg shadow-blue-500/30 active:scale-[0.98] disabled:opacity-40 disabled:grayscale transition-all flex items-center justify-center gap-2 cursor-pointer"
        >
          <CreditCard size={18} />
          <span>Dhammeystir Iibka (Checkout)</span>
          {cart.length > 0 && (
            <span className="ml-1 px-2 py-0.5 bg-white/20 rounded-lg text-xs font-mono">
              {formatCurrency(total, currency, rate)}
            </span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex flex-col lg:flex-row h-full overflow-hidden bg-slate-100/90 p-2 sm:p-3 md:p-4 lg:p-5 gap-3 sm:gap-4 lg:gap-6 relative">
      {/* Left / Products Section */}
      <div className="flex-1 bg-white rounded-[28px] border border-slate-200/80 shadow-sm p-3 sm:p-4 md:p-5 flex flex-col gap-3 md:gap-4 overflow-hidden">
        {/* Top Header & Search Bar */}
        <div className="flex flex-col md:flex-row gap-2.5 items-stretch md:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Raadi magac, Barcode ama SKU (Geli ama Scan garaac)..." 
              className="w-full pl-11 pr-24 py-3 bg-slate-50/70 shadow-xs border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-bold text-xs sm:text-sm transition-all" 
              value={search} 
              onChange={e => {
                setSearch(e.target.value);
              }} 
              onKeyDown={e => {
                if (e.key === 'Enter' && search.trim()) {
                  e.preventDefault();
                  const match = data.products.find(p => 
                    (p.barcode && p.barcode.trim() === search.trim()) || 
                    (p.sku && p.sku.trim().toLowerCase() === search.trim().toLowerCase()) ||
                    p.name.trim().toLowerCase() === search.trim().toLowerCase()
                  );

                  if (match) {
                    addToCart(match);
                    setSearch('');
                    if (navigator.vibrate) navigator.vibrate(100);
                  }
                }
              }}
            />
            <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button 
                onClick={() => setShowReturnModal(true)}
                className="px-2.5 py-1.5 bg-amber-50 text-amber-700 hover:bg-amber-100 rounded-xl transition-all text-xs font-black flex items-center gap-1 border border-amber-200 shadow-xs"
                title="Soo Celinta Alaabta (Customer Product Return)"
              >
                <RotateCcw size={13} />
                <span className="hidden sm:inline text-[11px]">Soo Celi</span>
              </button>
              <button 
                onClick={() => setIsScannerOpen(true)}
                className="p-1.5 bg-slate-100 text-slate-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all"
                title="Scan Barcode"
              >
                <Camera size={16} />
              </button>
            </div>
          </div>

          {/* Prominent Live Exchange Rate Widget */}
          <div className="flex items-center justify-between sm:justify-start gap-2 bg-indigo-50 border border-indigo-200/80 px-3.5 py-2 rounded-2xl shadow-xs shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-base">💱</span>
              <div className="flex flex-col">
                <span className="text-[9px] font-black text-indigo-500 uppercase tracking-wider leading-none">Sarifka (Rate):</span>
                <span className="font-mono text-indigo-950 font-black text-xs sm:text-sm leading-tight">$1 USD = {rate} ETB</span>
              </div>
            </div>
            <button
              onClick={() => {
                const newRate = prompt("Geli Qiimaha Cusub ee Sarifka Dollar to ETB ($1 USD = ? ETB):", String(rate));
                if (newRate && !isNaN(Number(newRate)) && Number(newRate) > 0) {
                  setData(prev => ({
                    ...prev,
                    settings: {
                      ...prev.settings,
                      exchangeRate: Number(newRate)
                    }
                  }));
                  addLog('Exchange Rate Updated', `Sarifka waxaa laga dhigay $1 = ${newRate} ETB`);
                }
              }}
              className="p-1 px-2 bg-indigo-200/70 hover:bg-indigo-300 text-indigo-900 rounded-lg transition-colors text-[10px] font-black flex items-center gap-1 shadow-2xs"
              title="Beddel Qiimaha Sarifka ee Maanta"
            >
              <Edit3 size={11} />
              <span>Beddel</span>
            </button>
          </div>
        </div>

        {/* Ice Cream Fast-Tap Bar */}
        <div className="bg-gradient-to-r from-pink-500 via-rose-500 to-amber-500 text-white p-3 sm:p-3.5 rounded-3xl shadow-xs flex flex-col md:flex-row items-center justify-between gap-2.5">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-white/20 backdrop-blur-md flex items-center justify-center text-lg font-black shadow-inner">
              🍦
            </div>
            <div>
              <h3 className="font-black text-xs sm:text-sm tracking-tight leading-none">Iibinta Ice Cream-ka (Fast-Tap)</h3>
              <p className="text-[9px] sm:text-[10px] text-pink-100 font-bold mt-0.5">Taabo mid ka mid ah si aad gaariga iibka ugu darto!</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
            {data.products.filter(p => p.category.toLowerCase().includes('ice cream')).map(ic => (
              <button
                key={ic.id}
                onClick={() => addToCart(ic)}
                className="flex-1 md:flex-none px-3 py-1.5 bg-white/95 hover:bg-white text-slate-900 rounded-xl font-black text-xs shadow-xs flex items-center justify-between md:justify-start gap-2 hover:scale-105 active:scale-95 transition-all"
              >
                <span>{ic.name.includes('Cone') ? '🍦' : ic.name.includes('Cup') ? '🍧' : '🍨'} {ic.name}</span>
                <span className="text-emerald-700 font-extrabold bg-emerald-100 px-1.5 py-0.5 rounded-md text-[10px]">
                  {formatCurrency(ic.sellPrice, currency, rate)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Category Pills Filter */}
        <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-hide shrink-0">
          <button
            onClick={() => setSelectedCategory('ALL')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all ${selectedCategory === 'ALL' ? 'bg-slate-900 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'}`}
          >
            Dhammaan ({data.products.length})
          </button>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-black whitespace-nowrap transition-all flex items-center gap-1.5 ${selectedCategory.toLowerCase() === cat.toLowerCase() ? 'bg-blue-600 text-white shadow-xs' : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200/80'}`}
            >
              {cat.toLowerCase().includes('ice cream') && <span>🍦</span>}
              {cat}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="flex-1 overflow-y-auto grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-5 gap-2.5 sm:gap-3.5 pr-1 touch-scroll scrollbar-hide pb-24 lg:pb-2">
          {filteredProducts.map(p => (
            <button key={p.id} onClick={() => addToCart(p)} className={`bg-white p-2.5 sm:p-3 rounded-2xl border border-slate-200/80 hover:border-blue-500 shadow-xs hover:shadow-md transition-all text-left flex flex-col gap-2 group active:scale-95 ${p.stock <= 0 ? 'opacity-65' : ''}`}>
              <div className="aspect-square rounded-xl bg-slate-50 overflow-hidden flex items-center justify-center border border-slate-100 relative">
                {p.image ? <img src={p.image} className="w-full h-full object-cover" /> : <ShoppingCart size={20} className="text-slate-200" />}
                {p.stock <= 0 ? (
                  <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-slate-900 text-white text-[8px] font-black rounded-lg">OUT</div>
                ) : p.stock < 10 && (
                  <div className="absolute top-1 right-1 px-1.5 py-0.5 bg-rose-600 text-white text-[8px] font-black rounded-lg">LOW</div>
                )}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-slate-900 line-clamp-1 text-xs md:text-sm">{p.name}</p>
                <div className="flex justify-between items-center mt-1">
                  <span className="text-blue-600 font-black text-xs md:text-sm">{formatCurrency(p.sellPrice, currency, rate)}</span>
                  <span className={`text-[9px] font-bold ${p.stock <= 0 ? 'text-rose-500' : 'text-slate-400'}`}>{p.stock} {p.unit || 'pcs'}</span>
                </div>
              </div>
            </button>
          ))}
          {filteredProducts.length === 0 && (
            <div className="col-span-full h-64 flex flex-col items-center justify-center text-slate-300">
              <Package size={44} strokeWidth={1.5} className="mb-2" />
              <p className="text-xs font-black uppercase tracking-widest text-slate-400">Alaab Lama Helin</p>
            </div>
          )}
        </div>
      </div>

      {/* Right / Separated Desktop Cart Box ("Boska Cart ii kala durki") */}
      <div className="hidden lg:flex w-[420px] xl:w-[460px] bg-white rounded-[28px] border-2 border-slate-200/90 shadow-xl ring-1 ring-slate-900/5 flex-col overflow-hidden shrink-0">
        {renderCartContent()}
      </div>

      {/* Mobile Cart Drawer */}
      <div className={`lg:hidden fixed inset-0 z-[110] bg-slate-900/60 backdrop-blur-sm transition-opacity duration-500 ${isCartMobileOpen ? 'opacity-100 visible' : 'opacity-0 invisible'}`} onClick={() => setIsCartMobileOpen(false)} />
      <div className={`lg:hidden fixed bottom-0 left-0 w-full bg-white rounded-t-[36px] z-[111] transition-transform duration-500 transform shadow-[0_-20px_40px_rgba(0,0,0,0.15)] h-[88vh] flex flex-col overflow-hidden ${isCartMobileOpen ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="w-12 h-1.5 bg-slate-300 rounded-full mx-auto mt-3 mb-1 shrink-0" />
        {renderCartContent()}
      </div>

      {/* Mobile Floating Cart Trigger */}
      {cart.length > 0 && !isCartMobileOpen && (
        <button onClick={() => setIsCartMobileOpen(true)} className="lg:hidden fixed bottom-20 right-4 h-15 px-5 bg-slate-900 text-white rounded-full shadow-2xl flex items-center gap-3.5 z-[105] animate-in slide-in-from-right-10 duration-500 border-2 border-slate-800">
           <div className="relative">
             <ShoppingCart size={22} />
             <span className="absolute -top-2 -right-2 bg-blue-600 text-[10px] font-black w-5 h-5 flex items-center justify-center rounded-full border-2 border-slate-900">{cart.length}</span>
           </div>
           <div className="h-5 w-px bg-slate-700" />
           <span className="font-black text-sm">{formatCurrency(total, currency, rate)}</span>
        </button>
      )}

      {showCheckout && (
        <div className="fixed inset-0 z-[120] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/70 backdrop-blur-md">
          <div className="bg-white rounded-t-[40px] sm:rounded-[40px] shadow-2xl w-full max-w-xl overflow-hidden animate-in slide-in-from-bottom-20 duration-500 sm:duration-300">
            <div className="p-6 md:p-8 bg-blue-600 text-white flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black uppercase tracking-tight">Select Payment</h3>
                <p className="opacity-70 font-bold text-xs">Total: {formatCurrency(total, currency, rate)}</p>
              </div>
              <button onClick={() => setShowCheckout(false)} className="p-2 bg-white/10 hover:bg-white/20 rounded-xl transition-all"><X size={20} /></button>
            </div>
            <div className="p-6 md:p-8 space-y-6 max-h-[75vh] overflow-y-auto touch-scroll">
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                {[
                  { id: PaymentMethod.CASH, icon: Banknote, label: 'Cash' },
                  { id: PaymentMethod.BANK, icon: CreditCard, label: 'Bank' },
                  { id: PaymentMethod.MOBILE_MONEY, icon: Smartphone, label: 'Mobile' },
                  { id: PaymentMethod.DEBT, icon: Wallet, label: 'Debt' },
                  { id: PaymentMethod.PARTIAL, icon: Calculator, label: 'Mixed' }
                ].map(method => (
                  <button key={method.id} onClick={() => setPaymentMethod(method.id as PaymentMethod)} className={`flex flex-col items-center gap-2 p-3 rounded-2xl border-2 transition-all ${paymentMethod === method.id ? 'border-blue-600 bg-blue-50 text-blue-600 shadow-md' : 'border-slate-50 text-slate-400'}`}>
                    <method.icon size={20} />
                    <span className="text-[9px] font-black uppercase tracking-tighter">{method.label}</span>
                  </button>
                ))}
              </div>

              {/* Currency Mode Selector for Payment Inputs */}
              {(paymentMethod === PaymentMethod.CASH || paymentMethod === PaymentMethod.PARTIAL) && (
                <div className="bg-slate-50 p-2.5 rounded-2xl border flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Input Currency:</span>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPosCurrencyMode('ETB')}
                      className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all ${posCurrencyMode === 'ETB' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 border'}`}
                    >
                      🇪🇹 ETB (Birr)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPosCurrencyMode('USD')}
                      className={`px-3 py-1.5 rounded-xl font-black text-xs transition-all ${posCurrencyMode === 'USD' ? 'bg-blue-600 text-white shadow-sm' : 'bg-white text-slate-600 border'}`}
                    >
                      🇺🇸 USD ($)
                    </button>
                  </div>
                </div>
              )}

              {paymentMethod === PaymentMethod.CASH && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Cash Received ({posCurrencyMode})</label>
                    <span className="text-[10px] font-bold text-slate-400">Rate: $1 = {rate} ETB</span>
                  </div>
                  <input 
                    type="number" 
                    step="any"
                    className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-black text-slate-700 focus:ring-2 focus:ring-blue-500 text-xl" 
                    value={(() => {
                      if (!cashReceived) return '';
                      if (posCurrencyMode === 'ETB') {
                        return (currency === Currency.USD) ? (cashReceived * rate).toFixed(2) : cashReceived.toString();
                      } else {
                        return (currency === Currency.ETB) ? (cashReceived / rate).toFixed(2) : cashReceived.toString();
                      }
                    })()} 
                    onChange={e => {
                      const val = parseFloat(e.target.value) || 0;
                      if (posCurrencyMode === 'ETB') {
                        const inBase = (currency === Currency.USD) ? val / rate : val;
                        setCashReceived(inBase);
                      } else {
                        const inBase = (currency === Currency.ETB) ? val * rate : val;
                        setCashReceived(inBase);
                      }
                    }} 
                    placeholder="0.00" 
                  />
                  {cashReceived > 0 && (
                    <p className="text-[11px] font-bold text-slate-500 px-1">
                      Equivalent: {posCurrencyMode === 'ETB' ? `$${((currency === Currency.USD ? cashReceived : cashReceived / rate)).toFixed(2)} USD` : `${((currency === Currency.ETB ? cashReceived : cashReceived * rate)).toFixed(2)} ETB`}
                    </p>
                  )}
                  {cashReceived > total && (
                    <div className="flex justify-between items-center px-1 pt-1">
                      <span className="text-[10px] font-black text-emerald-500 uppercase">Change to Give:</span>
                      <span className="text-sm font-black text-emerald-600">{formatCurrency(cashReceived - total, currency, rate)}</span>
                    </div>
                  )}
                </div>
              )}

              {paymentMethod === PaymentMethod.PARTIAL && (
                <div className="space-y-4">
                  <div className="flex justify-between items-center px-1">
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider">Kala Qaybi Lacagta ({posCurrencyMode})</span>
                    <span className="text-[10px] font-bold text-slate-400">$1 = {rate} ETB</span>
                  </div>

                  <div className="grid grid-cols-3 gap-2">
                    {/* Cash portion */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 uppercase">Cash ({posCurrencyMode})</label>
                      <input 
                        type="number" 
                        step="any"
                        placeholder="0.00"
                        className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-black text-slate-800" 
                        value={(() => {
                          if (!partialCash) return '';
                          if (posCurrencyMode === 'ETB') {
                            return (currency === Currency.USD) ? (partialCash * rate).toFixed(2) : partialCash.toString();
                          } else {
                            return (currency === Currency.ETB) ? (partialCash / rate).toFixed(2) : partialCash.toString();
                          }
                        })()} 
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          if (posCurrencyMode === 'ETB') {
                            setPartialCash((currency === Currency.USD) ? val / rate : val);
                          } else {
                            setPartialCash((currency === Currency.ETB) ? val * rate : val);
                          }
                        }} 
                      />
                      {partialCash > 0 && (
                        <p className="text-[8px] font-bold text-slate-400">
                          {posCurrencyMode === 'ETB' ? `$${(currency === Currency.USD ? partialCash : partialCash / rate).toFixed(2)}` : `${(currency === Currency.ETB ? partialCash : partialCash * rate).toFixed(2)} ETB`}
                        </p>
                      )}
                    </div>

                    {/* Bank portion */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 uppercase">Bank ({posCurrencyMode})</label>
                      <input 
                        type="number" 
                        step="any"
                        placeholder="0.00"
                        className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-black text-slate-800" 
                        value={(() => {
                          if (!partialBank) return '';
                          if (posCurrencyMode === 'ETB') {
                            return (currency === Currency.USD) ? (partialBank * rate).toFixed(2) : partialBank.toString();
                          } else {
                            return (currency === Currency.ETB) ? (partialBank / rate).toFixed(2) : partialBank.toString();
                          }
                        })()} 
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          if (posCurrencyMode === 'ETB') {
                            setPartialBank((currency === Currency.USD) ? val / rate : val);
                          } else {
                            setPartialBank((currency === Currency.ETB) ? val * rate : val);
                          }
                        }} 
                      />
                      {partialBank > 0 && (
                        <p className="text-[8px] font-bold text-slate-400">
                          {posCurrencyMode === 'ETB' ? `$${(currency === Currency.USD ? partialBank : partialBank / rate).toFixed(2)}` : `${(currency === Currency.ETB ? partialBank : partialBank * rate).toFixed(2)} ETB`}
                        </p>
                      )}
                    </div>

                    {/* Mobile portion */}
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 uppercase">Mobile ({posCurrencyMode})</label>
                      <input 
                        type="number" 
                        step="any"
                        placeholder="0.00"
                        className="w-full p-2.5 bg-slate-50 rounded-xl text-xs font-black text-slate-800" 
                        value={(() => {
                          if (!partialMobile) return '';
                          if (posCurrencyMode === 'ETB') {
                            return (currency === Currency.USD) ? (partialMobile * rate).toFixed(2) : partialMobile.toString();
                          } else {
                            return (currency === Currency.ETB) ? (partialMobile / rate).toFixed(2) : partialMobile.toString();
                          }
                        })()} 
                        onChange={e => {
                          const val = parseFloat(e.target.value) || 0;
                          if (posCurrencyMode === 'ETB') {
                            setPartialMobile((currency === Currency.USD) ? val / rate : val);
                          } else {
                            setPartialMobile((currency === Currency.ETB) ? val * rate : val);
                          }
                        }} 
                      />
                      {partialMobile > 0 && (
                        <p className="text-[8px] font-bold text-slate-400">
                          {posCurrencyMode === 'ETB' ? `$${(currency === Currency.USD ? partialMobile : partialMobile / rate).toFixed(2)}` : `${(currency === Currency.ETB ? partialMobile : partialMobile * rate).toFixed(2)} ETB`}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center bg-slate-50 p-3 rounded-xl border border-dashed">
                    <span className="text-[10px] font-black text-slate-400 uppercase">Remaining (Debt):</span>
                    <span className="text-sm font-black text-rose-600">{formatCurrency(Math.max(0, total - (partialCash + partialBank + partialMobile)), currency, rate)}</span>
                  </div>
                </div>
              )}

              {paymentMethod !== PaymentMethod.DEBT && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Deposit To</label>
                  <select className="w-full px-5 py-4 bg-slate-50 border-none rounded-2xl font-black text-slate-700 focus:ring-2 focus:ring-blue-500" value={incomeAccountId} onChange={e => setIncomeAccountId(e.target.value)}>
                    <option value="">Choose Account...</option>
                    {data.accounts.map(a => <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance, currency, rate)})</option>)}
                  </select>
                </div>
              )}

              {/* Sale Date & Time Selector */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><Calendar size={13} className="text-blue-600" /> Taariikhda Iibka</span>
                  </label>
                  <input 
                    type="datetime-local" 
                    value={saleDate} 
                    onChange={(e) => setSaleDate(e.target.value)} 
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1 flex items-center justify-between">
                    <span className="flex items-center gap-1.5"><FileText size={13} className="text-blue-600" /> Page Number (Boga)</span>
                    <span className="text-[9px] text-slate-400 font-bold">Optional</span>
                  </label>
                  <input 
                    type="text" 
                    value={pageNumber} 
                    onChange={(e) => setPageNumber(e.target.value)} 
                    placeholder="e.g. Page 12 / Boga 45"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-black text-xs text-slate-800 focus:ring-2 focus:ring-blue-500 outline-none"
                  />
                </div>
              </div>

              {checkoutError && (
                <div className="p-4 bg-rose-50 text-rose-600 rounded-2xl text-xs font-black flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
                  <X size={14} /> {checkoutError}
                </div>
              )}

              <button onClick={processSale} className="w-full py-5 bg-blue-600 text-white rounded-3xl font-black text-lg shadow-xl shadow-blue-600/20 active:scale-95 transition-all mb-4">
                Confirm Transaction
              </button>
            </div>
          </div>
        </div>
      )}

      {showReceipt && lastTransaction && (
        <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-md">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md p-8 text-center space-y-4 animate-in zoom-in duration-300 max-h-[90vh] overflow-y-auto">
             {(() => {
               const pm = (lastTransaction.paymentMethod || '').toLowerCase();
               const isDebt = pm === 'debt' || pm.includes('debt') || pm.includes('deyn') || lastTransaction.type === 'CASH_LOAN';
               const isPartialDebt = lastTransaction.paymentMethod === PaymentMethod.PARTIAL && (lastTransaction.paymentDetails?.debt || 0) > 0;
               
               if (isDebt) {
                 return (
                   <>
                     <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                        <AlertCircle size={36} />
                     </div>
                     <div className="space-y-1">
                       <span className="text-xs font-black text-rose-700 bg-rose-100 border border-rose-300 px-3 py-1 rounded-full uppercase">
                         ❌ NOT PAID (DEYN)
                       </span>
                       <h2 className="text-xl font-black text-slate-900 tracking-tight pt-2">Deyn Cusub La Diiwaangeliyay</h2>
                     </div>
                   </>
                 );
               } else if (isPartialDebt) {
                 return (
                   <>
                     <div className="w-16 h-16 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                        <AlertCircle size={36} />
                     </div>
                     <div className="space-y-1">
                       <span className="text-xs font-black text-amber-800 bg-amber-100 border border-amber-300 px-3 py-1 rounded-full uppercase">
                         ⚠️ PARTIALLY PAID (Qayb Deyn ah)
                       </span>
                       <h2 className="text-xl font-black text-slate-900 tracking-tight pt-2">Iib Qabyo Ah</h2>
                     </div>
                   </>
                 );
               } else {
                 return (
                   <>
                     <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                        <CheckCircle2 size={36} />
                     </div>
                     <div className="space-y-1">
                       <span className="text-xs font-black text-emerald-700 bg-emerald-100 border border-emerald-300 px-3 py-1 rounded-full uppercase">
                         ✅ PAID / CONFIRMED
                       </span>
                       <h2 className="text-xl font-black text-slate-900 tracking-tight pt-2">Iibku Wuu Guuleystay</h2>
                     </div>
                   </>
                 );
               }
             })()}

             <p className="text-3xl font-black text-slate-900 font-mono">{formatCurrency(lastTransaction.total, currency, rate)}</p>
             
             {/* Payment Method Breakdown Summary on Receipt Modal */}
             <div className="bg-slate-50 border border-slate-200 rounded-2xl p-3 space-y-2 text-left">
               <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                 <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Habka Lacagta:</span>
                 <span className="text-[10px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">{lastTransaction.paymentMethod}</span>
               </div>
               
               {lastTransaction.paymentDetails && (
                 <div className="grid grid-cols-2 gap-1.5 text-xs">
                   {(lastTransaction.paymentDetails.cash || 0) > 0 && (
                     <div className="flex justify-between bg-white p-1.5 rounded-lg border border-slate-100">
                       <span className="font-bold text-slate-600">💵 Cash:</span>
                       <span className="font-mono font-black text-emerald-700">{formatCurrency(lastTransaction.paymentDetails.cash || 0, currency, rate)}</span>
                     </div>
                   )}
                   {(lastTransaction.paymentDetails.bank || 0) > 0 && (
                     <div className="flex justify-between bg-white p-1.5 rounded-lg border border-slate-100">
                       <span className="font-bold text-slate-600">🏦 Bank:</span>
                       <span className="font-mono font-black text-blue-700">{formatCurrency(lastTransaction.paymentDetails.bank || 0, currency, rate)}</span>
                     </div>
                   )}
                   {(lastTransaction.paymentDetails.mobile || 0) > 0 && (
                     <div className="flex justify-between bg-white p-1.5 rounded-lg border border-slate-100">
                       <span className="font-bold text-slate-600">📱 Mobile:</span>
                       <span className="font-mono font-black text-purple-700">{formatCurrency(lastTransaction.paymentDetails.mobile || 0, currency, rate)}</span>
                     </div>
                   )}
                   {(lastTransaction.paymentDetails.debt || 0) > 0 && (
                     <div className="flex justify-between bg-rose-50 p-1.5 rounded-lg border border-rose-100">
                       <span className="font-bold text-rose-700">📝 Deyn:</span>
                       <span className="font-mono font-black text-rose-700">{formatCurrency(lastTransaction.paymentDetails.debt || 0, currency, rate)}</span>
                     </div>
                   )}
                 </div>
               )}

               {/* Items Summary in Receipt */}
               <div className="space-y-1 pt-1 max-h-32 overflow-y-auto divide-y divide-slate-100">
                 {lastTransaction.items.map((it, idx) => (
                   <div key={idx} className="flex items-center justify-between text-[11px] pt-1">
                     <span className="text-slate-700 truncate max-w-[160px]">
                       {it.name} <span className="text-slate-400">({it.quantity})</span>
                     </span>
                     <div className="flex items-center gap-1.5">
                       <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded text-[9px] font-bold">
                         {it.paymentMethod === PaymentMethod.BANK ? '🏦 Bank' : it.paymentMethod === PaymentMethod.MOBILE_MONEY ? '📱 Mobile' : it.paymentMethod === PaymentMethod.DEBT ? '📝 Deyn' : '💵 Cash'}
                       </span>
                       <span className="font-mono font-bold text-slate-900">
                         {formatCurrency(it.sellPrice * it.quantity, currency, rate)}
                       </span>
                     </div>
                   </div>
                 ))}
               </div>
             </div>

             {lastTransaction.pageNumber && (
               <p className="text-xs font-black text-slate-600 bg-slate-100 px-3 py-1.5 rounded-xl inline-block">
                 📑 Boga (Page #): <span className="text-blue-600">{lastTransaction.pageNumber}</span>
               </p>
             )}

             {/* Payment Accounts Box on Receipt modal */}
             <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl space-y-2 text-left">
               <p className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                 💳 Akoonnada Lacag Bixinta (Payment Accounts):
               </p>
               <div className="text-xs space-y-1 text-slate-800">
                 <div className="flex justify-between">
                   <span className="text-slate-500 font-medium">1. E-Birr / Telebirr:</span>
                   <strong className="font-mono text-emerald-700">{data.settings.onlinePaymentNumbers?.ebirr || '0901234567'}</strong>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-slate-500 font-medium">2. Commercial Bank (CBE):</span>
                   <strong className="font-mono text-indigo-700">{data.settings.onlinePaymentNumbers?.commercialBank || '1000123456789'}</strong>
                 </div>
                 <div className="flex justify-between">
                   <span className="text-slate-500 font-medium">3. Kaafi / Zaad:</span>
                   <strong className="font-mono text-purple-700">{data.settings.onlinePaymentNumbers?.kaafi || data.settings.onlinePaymentNumbers?.golis || '0631234567'}</strong>
                 </div>
               </div>
               {((lastTransaction.paymentMethod || '').toLowerCase().includes('debt') || (lastTransaction.paymentMethod || '').toLowerCase().includes('deyn') || (lastTransaction.paymentMethod === PaymentMethod.PARTIAL && (lastTransaction.paymentDetails?.debt || 0) > 0)) && (
                 <div className="pt-2 border-t border-slate-200 text-center">
                   <p className="text-[11px] font-black text-rose-700 uppercase">
                     📢 Fadlan bixi lacagta deynta lagugu leeyahay adoo raali ah
                   </p>
                 </div>
               )}
             </div>

             <div className="pt-2 flex flex-col gap-2.5">
                <button 
                  onClick={() => sendWhatsAppReceipt(lastTransaction, data, currency, rate)} 
                  className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg shadow-emerald-600/20 active:scale-95 transition-all text-sm"
                >
                   💬 U Dir WhatsApp (Send Receipt)
                </button>
                <button onClick={() => window.print()} className="w-full py-3.5 bg-slate-900 text-white rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg active:scale-95 transition-all text-sm">
                   <Printer size={18} /> Print Receipt
                </button>
                <button onClick={closeReceipt} className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs active:scale-95">Next Sale</button>
             </div>
          </div>
        </div>
      )}

      {/* Hidden Print-Only View for POS receipts */}
      {showReceipt && lastTransaction && (
        <div className="print-only fixed inset-0 bg-white p-0">
          <div className="w-full max-w-sm mx-auto text-left space-y-4">
            <div className="border-b-2 border-black pb-3 text-center">
              <h1 className="text-2xl font-black uppercase">{data.settings.businessName}</h1>
              <p className="text-xs font-bold text-gray-600">SALES RECEIPT</p>
              <p className="text-xs font-mono">INV-{lastTransaction.id.slice(-5).toUpperCase()}</p>
              <p className="text-[10px] text-gray-500">{new Date(lastTransaction.timestamp).toLocaleString()}</p>
            </div>

            <div className="flex justify-between text-xs font-bold">
              <span>Customer: {data.customers.find(c => c.id === lastTransaction.customerId)?.name || lastTransaction.customerName || 'Walk-in'}</span>
              {((lastTransaction.paymentMethod || '').toLowerCase().includes('debt') || (lastTransaction.paymentMethod || '').toLowerCase().includes('deyn')) ? (
                <span className="font-black border border-black px-1.5 py-0.5">NOT PAID (DEYN)</span>
              ) : (
                <span className="font-black border border-black px-1.5 py-0.5">PAID</span>
              )}
            </div>

            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="border-b border-black font-black">
                  <th className="text-left py-1">Item</th>
                  <th className="text-center py-1">Pay</th>
                  <th className="text-center py-1">Qty</th>
                  <th className="text-right py-1">Total</th>
                </tr>
              </thead>
              <tbody>
                {lastTransaction.items.map((item, i) => (
                  <tr key={i} className="border-b border-gray-200">
                    <td className="py-1.5 font-bold">{item.name}</td>
                    <td className="py-1.5 text-center text-[10px] font-bold">
                      {item.paymentMethod === PaymentMethod.BANK ? 'Bank' : item.paymentMethod === PaymentMethod.MOBILE_MONEY ? 'Mobile' : item.paymentMethod === PaymentMethod.DEBT ? 'Deyn' : 'Cash'}
                    </td>
                    <td className="py-1.5 text-center">{item.quantity}</td>
                    <td className="py-1.5 text-right font-mono">{formatCurrency(item.sellPrice * item.quantity, currency, rate)}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Payment Summary for Print Receipt */}
            {lastTransaction.paymentDetails && (
              <div className="text-xs space-y-0.5 border-t border-gray-300 pt-1.5 font-bold">
                <div className="flex justify-between text-[11px] text-gray-700">
                  <span>Method / Habka:</span>
                  <span>{lastTransaction.paymentMethod}</span>
                </div>
                {(lastTransaction.paymentDetails.cash || 0) > 0 && (
                  <div className="flex justify-between text-[11px]">
                    <span>• Cash:</span>
                    <span>{formatCurrency(lastTransaction.paymentDetails.cash || 0, currency, rate)}</span>
                  </div>
                )}
                {(lastTransaction.paymentDetails.bank || 0) > 0 && (
                  <div className="flex justify-between text-[11px]">
                    <span>• Bank:</span>
                    <span>{formatCurrency(lastTransaction.paymentDetails.bank || 0, currency, rate)}</span>
                  </div>
                )}
                {(lastTransaction.paymentDetails.mobile || 0) > 0 && (
                  <div className="flex justify-between text-[11px]">
                    <span>• Mobile:</span>
                    <span>{formatCurrency(lastTransaction.paymentDetails.mobile || 0, currency, rate)}</span>
                  </div>
                )}
                {(lastTransaction.paymentDetails.debt || 0) > 0 && (
                  <div className="flex justify-between text-[11px]">
                    <span>• Unpaid Debt:</span>
                    <span>{formatCurrency(lastTransaction.paymentDetails.debt || 0, currency, rate)}</span>
                  </div>
                )}
              </div>
            )}

            <div className="text-right space-y-1 text-xs font-bold pt-2">
              <div className="flex justify-between font-black text-base border-t-2 border-black pt-1">
                <span>TOTAL:</span>
                <span>{formatCurrency(lastTransaction.total, currency, rate)}</span>
              </div>
              {((lastTransaction.paymentMethod || '').toLowerCase().includes('debt') || (lastTransaction.paymentMethod || '').toLowerCase().includes('deyn')) && (
                <div className="flex justify-between font-black text-sm text-black border-t border-dashed border-black pt-1">
                  <span>UNPAID DEBT:</span>
                  <span>{formatCurrency(lastTransaction.total, currency, rate)}</span>
                </div>
              )}
            </div>

            <div className="pt-3 border-t-2 border-black space-y-1 text-[11px]">
              <p className="font-black uppercase">Akoonnada Lacag Bixinta (Payment Accounts):</p>
              <p>• E-Birr: <span className="font-mono font-bold">{data.settings.onlinePaymentNumbers?.ebirr || '0901234567'}</span></p>
              <p>• CBE Bank: <span className="font-mono font-bold">{data.settings.onlinePaymentNumbers?.commercialBank || '1000123456789'}</span></p>
              <p>• Kaafi / Zaad: <span className="font-mono font-bold">{data.settings.onlinePaymentNumbers?.kaafi || data.settings.onlinePaymentNumbers?.golis || '0631234567'}</span></p>
              <p className="pt-2 font-black text-center text-xs uppercase">
                📢 Fadlan bixi lacagta deynta lagugu leeyahay adoo raali ah
              </p>
            </div>
          </div>
        </div>
      )}

      {isScannerOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Camera size={24} className="text-blue-400" />
                <h3 className="text-lg font-black uppercase tracking-tight">Barcode Scanner</h3>
              </div>
              <button onClick={() => setIsScannerOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                <X size={24} />
              </button>
            </div>
            <div className="p-6">
              <div id="reader" className="overflow-hidden rounded-3xl border-4 border-slate-100"></div>
              <p className="mt-4 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                Align barcode within the frame to scan
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Customer Product Return Modal */}
      <CustomerReturnModal
        isOpen={showReturnModal}
        onClose={() => setShowReturnModal(false)}
        data={data}
        setData={setData}
        addLog={addLog}
        currency={currency}
        onLoadItemsToPOS={onLoadItemsToPOS}
      />

      {/* 🌟 1. ALL DEBTORS LIST MODAL (Macaamiisha Deynta Lagu Leeyahay) */}
      {showDebtorsListModal && (
        <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden border border-slate-200 flex flex-col max-h-[90vh]">
            <div className="p-5 bg-gradient-to-r from-rose-700 to-rose-900 text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Users size={22} className="text-rose-200" />
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight">Macaamiisha Deynta Lagu Leeyahay</h3>
                  <p className="text-[11px] text-rose-200 font-bold">
                    Wadarta Deynta: {formatCurrency(data.customers.reduce((acc, c) => acc + (c.debtBalance || 0), 0), currency, rate)} ({data.customers.filter(c => c.debtBalance > 0).length} Macamiil)
                  </p>
                </div>
              </div>
              <button 
                onClick={() => setShowDebtorsListModal(false)} 
                className="p-1.5 hover:bg-white/10 rounded-xl transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-4 border-b border-slate-100 bg-slate-50 shrink-0">
              <div className="relative">
                <Search size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ka raadi magac ama telefoon..."
                  value={debtorsSearch}
                  onChange={e => setDebtorsSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 bg-white border border-slate-200 rounded-xl text-xs font-bold focus:ring-2 focus:ring-rose-500 outline-none"
                />
              </div>
            </div>

            <div className="p-4 overflow-y-auto divide-y divide-slate-100 flex-1">
              {data.customers
                .filter(c => c.debtBalance > 0 && (
                  !debtorsSearch.trim() || 
                  c.name.toLowerCase().includes(debtorsSearch.toLowerCase()) || 
                  (c.phone && c.phone.includes(debtorsSearch))
                ))
                .length === 0 ? (
                  <div className="py-12 text-center text-slate-400 font-bold text-xs">
                    Wax deyn ah oo hadda dukaanka ku maqan ma jiraan ama raadinta waxba laguma helin.
                  </div>
                ) : (
                  data.customers
                    .filter(c => c.debtBalance > 0 && (
                      !debtorsSearch.trim() || 
                      c.name.toLowerCase().includes(debtorsSearch.toLowerCase()) || 
                      (c.phone && c.phone.includes(debtorsSearch))
                    ))
                    .map(c => (
                      <div key={c.id} className="py-3 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-50/80 px-2 rounded-xl transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-10 h-10 rounded-full bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 font-black text-sm shrink-0">
                            {c.photo ? <img src={c.photo} className="w-full h-full object-cover rounded-full" /> : c.name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-black text-slate-900 truncate">{c.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold">{c.phone || 'Telefoon ma leh'}</p>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <div className="text-right">
                            <span className="text-[9px] text-slate-400 font-bold block uppercase">Deynta</span>
                            <span className="text-xs sm:text-sm font-black text-rose-600 font-mono">
                              {formatCurrency(c.debtBalance, currency, rate)}
                            </span>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              setShowDebtorsListModal(false);
                              handleOpenPayDebt(c);
                            }}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 shadow-xs transition-all cursor-pointer active:scale-95"
                            title="Bixi deynta qofkan"
                          >
                            <Wallet size={12} />
                            <span>Bixi Deyn</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setSelectedCustomer(c);
                              setShowDebtorsListModal(false);
                            }}
                            className="px-2.5 py-1.5 bg-slate-800 hover:bg-slate-700 text-white rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1 transition-all cursor-pointer active:scale-95"
                            title="U dooro POS-ka iib cusub"
                          >
                            <ShoppingCart size={12} />
                            <span>Dooro</span>
                          </button>
                        </div>
                      </div>
                    ))
                )}
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setShowDebtorsListModal(false)}
                className="px-5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
              >
                Xir (Close)
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 🌟 2. DEBT PAYMENT MODAL (Bixinta Deynta) */}
      {showPayDebtModal && payingCustomer && (
        <div className="fixed inset-0 z-[160] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden border border-slate-200 animate-in zoom-in-95">
            <div className="p-5 bg-gradient-to-r from-emerald-600 to-teal-700 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Wallet size={22} className="text-emerald-200" />
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight">Qabashada Lacag Deyn Ah</h3>
                  <p className="text-[11px] text-emerald-100 font-bold">Lacag bixin toos ah oo deynta lagaga jarayo</p>
                </div>
              </div>
              <button 
                onClick={() => { setShowPayDebtModal(false); setPayingCustomer(null); }} 
                className="p-1.5 hover:bg-white/10 rounded-xl transition-all cursor-pointer"
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              {/* Customer Info Card */}
              <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200/80 flex items-center justify-between">
                <div>
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block">Macamiilka</span>
                  <p className="text-sm font-black text-slate-900">{payingCustomer.name}</p>
                  <p className="text-[10px] text-slate-500 font-bold">{payingCustomer.phone || 'No phone'}</p>
                </div>
                <div className="text-right">
                  <span className="text-[9px] font-black text-rose-500 uppercase tracking-wider block">Deynta Hadda</span>
                  <p className="text-base font-black text-rose-600 font-mono">
                    {formatCurrency(payingCustomer.debtBalance, currency, rate)}
                  </p>
                </div>
              </div>

              {/* Amount Input */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider flex items-center justify-between">
                  <span>Qadarka La Bixinayo ({currency === Currency.ETB ? 'ETB' : 'USD'})</span>
                  <span className="text-[10px] text-emerald-600 font-bold">
                    Wadarta: {formatCurrency(payingCustomer.debtBalance, currency, rate)}
                  </span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 font-black text-sm">
                    {currency === Currency.ETB ? 'ETB' : '$'}
                  </span>
                  <input
                    type="number"
                    step="any"
                    value={debtPayAmount}
                    onChange={e => setDebtPayAmount(e.target.value)}
                    className="w-full pl-12 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-lg font-black text-slate-900 font-mono focus:ring-2 focus:ring-emerald-500 focus:bg-white outline-none"
                    placeholder="0.00"
                  />
                </div>

                {/* Quick Fill Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      const isETB = currency === Currency.ETB;
                      const currentRate = isETB ? (rate || 1) : 1;
                      setDebtPayAmount((Math.round((payingCustomer.debtBalance * currentRate) * 100) / 100).toString());
                    }}
                    className="flex-1 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 rounded-xl text-[10px] font-black uppercase border border-emerald-200 transition-colors"
                  >
                    100% (Dhammaan)
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const isETB = currency === Currency.ETB;
                      const currentRate = isETB ? (rate || 1) : 1;
                      setDebtPayAmount((Math.round(((payingCustomer.debtBalance / 2) * currentRate) * 100) / 100).toString());
                    }}
                    className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-[10px] font-black uppercase border border-slate-200 transition-colors"
                  >
                    50% (Nus)
                  </button>
                </div>
              </div>

              {/* Target Account Selector */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Koontada Lacagta Lagu Shubayo (Deposit Account)
                </label>
                <select
                  value={debtPayAccount}
                  onChange={e => setDebtPayAccount(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                >
                  {(data.accounts || []).map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} ({a.type}) - Haraaga: {formatCurrency(a.balance, currency, rate)}
                    </option>
                  ))}
                </select>
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700 uppercase tracking-wider">
                  Faahfaahin / Xusid (Notes / Optional)
                </label>
                <input
                  type="text"
                  value={debtPayNotes}
                  onChange={e => setDebtPayNotes(e.target.value)}
                  placeholder="tusaale: Bixinta biilashii hore / Zaad receipt..."
                  className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold text-slate-800 focus:ring-2 focus:ring-emerald-500 outline-none"
                />
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowPayDebtModal(false); setPayingCustomer(null); }}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl text-xs font-black uppercase tracking-wider transition-colors cursor-pointer"
                >
                  Ka Noqo
                </button>
                <button
                  type="button"
                  disabled={isProcessingDebtPayment || !debtPayAmount || parseFloat(debtPayAmount) <= 0}
                  onClick={handleConfirmDebtPayment}
                  className="flex-1 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-md transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isProcessingDebtPayment ? (
                    <span>Waa la qabanayaa...</span>
                  ) : (
                    <>
                      <Check size={16} />
                      <span>Xaqiiji Bixinta</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default POS;
