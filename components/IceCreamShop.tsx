import React, { useState, useMemo, useEffect } from 'react';
import { AppData, Currency, Customer, Expense, IceCreamIngredient, IceCreamRecipeItem, PaymentMethod, Product, Transaction } from '../types';
import { formatCurrency, generateId } from '../lib/utils';
import { 
  ShoppingCart, Plus, Minus, Trash2, CheckCircle2, UserPlus, Search, 
  Sparkles, HeartHandshake, History, DollarSign, Package, Banknote, Smartphone,
  CreditCard, RefreshCw, Printer, AlertCircle, ArrowRight, Edit3, Building2, PlusCircle, Calendar,
  FlaskConical, TrendingUp, PieChart, Layers, X, Save, Scale, ListFilter, ArrowUpRight
} from 'lucide-react';

interface Props {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  addLog: (action: string, details: string) => void;
  currency: Currency;
}

const DEFAULT_INGREDIENTS: IceCreamIngredient[] = [
  { id: 'ing_1', name: 'Powder Caano (Ice Cream Base)', unit: 'grm', unitCost: 0.006, stock: 15000 },
  { id: 'ing_2', name: 'Biyo Safiid (Water)', unit: 'ml', unitCost: 0.0005, stock: 50000 },
  { id: 'ing_3', name: 'Sukar (Sugar)', unit: 'grm', unitCost: 0.0015, stock: 20000 },
  { id: 'ing_4', name: 'Koob / Cup & Spoon', unit: 'pcs', unitCost: 0.05, stock: 1000 },
  { id: 'ing_5', name: 'Syrup Flavor (Strawberry/Vanilla)', unit: 'ml', unitCost: 0.01, stock: 5000 }
];

const IceCreamShop: React.FC<Props> = ({ data, setData, addLog, currency }) => {
  const rate = data.settings.exchangeRate;

  // Active Main Navigation Tab
  const [activeTab, setActiveTab] = useState<'POS' | 'FINANCIALS'>('POS');

  // Filter ice cream products
  const iceCreamProducts = useMemo(() => {
    return data.products.filter(p => p.category.toLowerCase().includes('ice cream'));
  }, [data.products]);

  // Non-ice cream store products (for internal store consumption expenses)
  const storeProducts = useMemo(() => {
    return data.products.filter(p => !p.category.toLowerCase().includes('ice cream'));
  }, [data.products]);

  // Ingredients state setup
  const ingredients = useMemo(() => {
    return data.iceCreamIngredients && data.iceCreamIngredients.length > 0 
      ? data.iceCreamIngredients 
      : DEFAULT_INGREDIENTS;
  }, [data.iceCreamIngredients]);

  const recipes = useMemo(() => {
    return data.iceCreamRecipes || {};
  }, [data.iceCreamRecipes]);

  // Cart state
  const [cart, setCart] = useState<{
    product: Product;
    quantity: number;
    customSellPrice?: number;
    selectedFlavors: string[];
    notes: string;
  }[]>([]);

  // Selected customer & Payment
  const [selectedCustomerId, setSelectedCustomerId] = useState<string>('');
  const [customerSearch, setCustomerSearch] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);

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
  const [completedTx, setCompletedTx] = useState<Transaction | null>(null);

  // Add / Edit Product Modal
  const [showAddProductModal, setShowAddProductModal] = useState(false);
  const [itemModalMode, setItemModalMode] = useState<'ADD' | 'EDIT'>('ADD');
  const [itemFormId, setItemFormId] = useState<string>('');
  const [itemFormName, setItemFormName] = useState<string>('');
  const [itemFormSize, setItemFormSize] = useState<'Yar' | 'Dhexe' | 'Weyn'>('Dhexe');
  const [itemFormSellPrice, setItemFormSellPrice] = useState<string>('');

  // Ingredient Modal state
  const [showIngredientModal, setShowIngredientModal] = useState(false);
  const [ingFormId, setIngFormId] = useState<string>('');
  const [ingFormName, setIngFormName] = useState<string>('');
  const [ingFormUnit, setIngFormUnit] = useState<'grm' | 'ml' | 'kg' | 'liter' | 'pcs'>('grm');
  const [ingFormUnitCost, setIngFormUnitCost] = useState<string>('');
  const [ingFormStock, setIngFormStock] = useState<string>('');

  // Recipe Modal state
  const [showRecipeModal, setShowRecipeModal] = useState(false);
  const [recipeProdId, setRecipeProdId] = useState<string>('');
  const [recipeDraft, setRecipeDraft] = useState<IceCreamRecipeItem[]>([]);

  // Expense Modal state
  const [showExpenseModal, setShowExpenseModal] = useState(false);
  const [expSource, setExpSource] = useState<'EXTERNAL' | 'INTERNAL_PRODUCT'>('EXTERNAL');
  const [expCategory, setExpCategory] = useState<string>('Biyo & Caano Powder');
  const [expDescription, setExpDescription] = useState<string>('');
  const [expAmount, setExpAmount] = useState<string>('');
  const [expAccountId, setExpAccountId] = useState<string>('');
  const [expDate, setExpDate] = useState<string>(getInitialDateTime);

  // Internal Product Consumption state
  const [expProductId, setExpProductId] = useState<string>('');
  const [expProdQty, setExpProdQty] = useState<string>('1');

  // Financial Filter state (Maalin, Bile, Sanad, Custom)
  const [timeframe, setTimeframe] = useState<'TODAY' | 'MONTH' | 'YEAR' | 'CUSTOM'>('TODAY');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  // All Ice Cream Transactions sorted
  const iceCreamTxs = useMemo(() => {
    return data.transactions
      .filter(t => t.items.some(item => item.category.toLowerCase().includes('ice cream')))
      .sort((a, b) => b.timestamp - a.timestamp);
  }, [data.transactions]);

  // Sequential order number lookup (#1, #2, #3...)
  const getSequentialOrderNumber = (txId: string) => {
    const sortedAsc = [...iceCreamTxs].sort((a, b) => a.timestamp - b.timestamp);
    const index = sortedAsc.findIndex(t => t.id === txId);
    return index >= 0 ? index + 1 : 1;
  };

  // Ice Cream Expenses list
  const iceCreamExpenses = useMemo(() => {
    return data.expenses.filter(e => e.category.toLowerCase().includes('ice cream') || e.description.toLowerCase().includes('ice cream'));
  }, [data.expenses]);

  // Filtered Transactions & Expenses based on Timeframe
  const filteredFinancialData = useMemo(() => {
    let startMs = 0;
    let endMs = Date.now();

    const now = new Date();
    if (timeframe === 'TODAY') {
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      startMs = todayStart;
    } else if (timeframe === 'MONTH') {
      const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
      startMs = monthStart;
    } else if (timeframe === 'YEAR') {
      const yearStart = new Date(now.getFullYear(), 0, 1).getTime();
      startMs = yearStart;
    } else if (timeframe === 'CUSTOM') {
      if (customStartDate) startMs = new Date(customStartDate).getTime();
      if (customEndDate) endMs = new Date(customEndDate).getTime() + 86399999;
    }

    const txs = iceCreamTxs.filter(t => t.timestamp >= startMs && t.timestamp <= endMs);
    const exps = iceCreamExpenses.filter(e => e.timestamp >= startMs && e.timestamp <= endMs);

    const totalRevenue = txs.reduce((sum, t) => sum + t.total, 0);

    const totalCOGS = txs.reduce((sum, t) => {
      const icItems = t.items.filter(i => i.category.toLowerCase().includes('ice cream'));
      const cogsForItem = icItems.reduce((s, i) => s + (i.costPrice * i.quantity), 0);
      return sum + cogsForItem;
    }, 0);

    const totalExpAmount = exps.reduce((sum, e) => sum + e.amount, 0);

    const netProfit = totalRevenue - (totalCOGS + totalExpAmount);
    const profitMargin = totalRevenue > 0 ? (netProfit / totalRevenue) * 100 : 0;

    // Item-level breakdown
    const itemBreakdownMap = new Map<string, { name: string; qty: number; revenue: number; cogs: number; profit: number }>();
    txs.forEach(t => {
      t.items.filter(i => i.category.toLowerCase().includes('ice cream')).forEach(item => {
        const existing = itemBreakdownMap.get(item.id) || { name: item.name, qty: 0, revenue: 0, cogs: 0, profit: 0 };
        const itemRev = item.sellPrice * item.quantity;
        const itemCost = item.costPrice * item.quantity;
        existing.qty += item.quantity;
        existing.revenue += itemRev;
        existing.cogs += itemCost;
        existing.profit += (itemRev - itemCost);
        itemBreakdownMap.set(item.id, existing);
      });
    });

    return {
      txs,
      exps,
      totalRevenue,
      totalCOGS,
      totalExpAmount,
      netProfit,
      profitMargin,
      itemBreakdown: Array.from(itemBreakdownMap.values())
    };
  }, [iceCreamTxs, iceCreamExpenses, timeframe, customStartDate, customEndDate]);

  // Quick header stats
  const todayRevenue = useMemo(() => {
    const todayStr = new Date().toDateString();
    return iceCreamTxs
      .filter(t => new Date(t.timestamp).toDateString() === todayStr)
      .reduce((sum, t) => sum + t.total, 0);
  }, [iceCreamTxs]);

  const todayScoopsSold = useMemo(() => {
    const todayStr = new Date().toDateString();
    return iceCreamTxs
      .filter(t => new Date(t.timestamp).toDateString() === todayStr)
      .reduce((sum, t) => {
        const itemQty = t.items
          .filter(i => i.category.toLowerCase().includes('ice cream'))
          .reduce((s, i) => s + i.quantity, 0);
        return sum + itemQty;
      }, 0);
  }, [iceCreamTxs]);

  // Cart totals
  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + ((item.customSellPrice ?? item.product.sellPrice) * item.quantity), 0);
  }, [cart]);

  const updateCartItemPrice = (index: number, newPriceInLocal: number) => {
    setCart(prev => {
      const updated = [...prev];
      const isETB = currency === Currency.ETB;
      const currentRate = isETB ? (rate || 1) : 1;
      updated[index].customSellPrice = newPriceInLocal / currentRate;
      return updated;
    });
  };

  const validateCartItemPriceOnBlur = (index: number, currentPriceInLocal: number) => {
    setCart(prev => {
      const updated = [...prev];
      if (!updated[index]) return prev;
      const isETB = currency === Currency.ETB;
      const currentRate = isETB ? (rate || 1) : 1;
      const minCostInLocal = updated[index].product.costPrice * currentRate;

      if (isNaN(currentPriceInLocal) || currentPriceInLocal < minCostInLocal) {
        alert(`⚠️ Badbaadinta Faa'iidada (Cost Protection):\nQiimaha iibku kama hoos mari karo qiimaha lagu soo iibiyay (${formatCurrency(updated[index].product.costPrice, currency, rate)}).\nQiimaha waxaa lagu xirayaa Cost Price-ka.`);
        updated[index].customSellPrice = updated[index].product.costPrice;
      }
      return updated;
    });
  };

  const IceCreamCartPriceInput = ({ item, index }: { item: { product: any; customSellPrice?: number }; index: number }) => {
    const isETB = currency === Currency.ETB;
    const currentRate = isETB ? (rate || 1) : 1;
    const currentSellPrice = item.customSellPrice ?? item.product.sellPrice;
    const initialLocalVal = Math.round((currentSellPrice * currentRate) * 100) / 100;

    const [valStr, setValStr] = useState<string>(initialLocalVal.toString());

    useEffect(() => {
      setValStr(initialLocalVal.toString());
    }, [currentSellPrice, currency, rate]);

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
            updateCartItemPrice(index, parsed);
          }
        }} 
        onBlur={() => {
          const parsed = parseFloat(valStr);
          validateCartItemPriceOnBlur(index, parsed);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          }
        }}
        className="w-24 px-2 py-1 bg-rose-50 border border-rose-200 rounded-md font-black text-xs text-rose-700 outline-none focus:ring-1 focus:ring-rose-500" 
        title={`Edit Selling Price (${currency}: ${formatCurrency(item.product.costPrice, currency, rate)})`}
      />
    );
  };

  // Open Add Product Modal
  const openAddProductModal = () => {
    setItemModalMode('ADD');
    setItemFormId('');
    setItemFormName('');
    setItemFormSize('Dhexe');
    setItemFormSellPrice('2.00');
    setShowAddProductModal(true);
  };

  // Open Edit Product Modal
  const openEditProductModal = (prod: Product, e: React.MouseEvent) => {
    e.stopPropagation();
    setItemModalMode('EDIT');
    setItemFormId(prod.id);
    
    const match = prod.name.match(/^(.*?)\s*\((Yar|Dhexe|Weyn)\)$/i);
    if (match) {
      setItemFormName(match[1].trim());
      const sizeStr = match[2].charAt(0).toUpperCase() + match[2].slice(1).toLowerCase();
      setItemFormSize(sizeStr as 'Yar' | 'Dhexe' | 'Weyn');
    } else {
      setItemFormName(prod.name);
      setItemFormSize('Dhexe');
    }

    setItemFormSellPrice(prod.sellPrice.toString());
    setShowAddProductModal(true);
  };

  // Save Ice Cream Product
  const handleSaveProduct = () => {
    if (!itemFormName.trim()) return alert("Fadlan geli magaca Ice Cream-ka!");
    const sellPrice = parseFloat(itemFormSellPrice);

    if (isNaN(sellPrice) || sellPrice <= 0) return alert("Fadlan geli qiimo iib oo sax ah!");

    const fullName = `${itemFormName.trim()} (${itemFormSize})`;

    if (itemModalMode === 'ADD') {
      const newProd: Product = {
        id: generateId(),
        name: fullName,
        sku: `IC-${Math.floor(1000 + Math.random() * 9000)}`,
        barcode: `8900${Math.floor(100000 + Math.random() * 900000)}`,
        costPrice: 0.20, // Default base raw cost
        sellPrice: sellPrice,
        stock: 999999,
        category: 'Ice Cream'
      };

      setData(prev => ({
        ...prev,
        products: [newProd, ...prev.products]
      }));

      addLog('Product Created', `Gelisay Ice Cream Cusub: ${fullName} - Price: $${sellPrice}`);
    } else {
      setData(prev => ({
        ...prev,
        products: prev.products.map(p => p.id === itemFormId ? {
          ...p,
          name: fullName,
          sellPrice: sellPrice
        } : p)
      }));

      addLog('Product Updated', `Wax ka baddalay Ice Cream: ${fullName}`);
    }

    setShowAddProductModal(false);
  };

  // Delete Ice Cream Product
  const handleDeleteProduct = (prodId: string, prodName: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Ma xiineysaa inaad tirtirto Ice Cream-ka: "${prodName}"?`)) {
      const prodToDelete = data.products.find(p => p.id === prodId);
      setData(prev => {
        let updatedBin = prev.recycleBin || [];
        if (prodToDelete) {
          const binItem = {
            id: generateId(),
            type: 'PRODUCT' as const,
            deletedAt: Date.now(),
            title: prodToDelete.name,
            description: `SKU: ${prodToDelete.sku || 'N/A'} • Price: $${prodToDelete.sellPrice} • Category: Ice Cream`,
            originalData: prodToDelete
          };
          updatedBin = [binItem, ...updatedBin];
        }
        const updatedDeletedIds = { ...(prev.deletedIds || {}) };
        updatedDeletedIds[prodId] = Date.now();

        return {
          ...prev,
          products: prev.products.filter(p => p.id !== prodId),
          recycleBin: updatedBin,
          deletedIds: updatedDeletedIds,
          lastModified: Date.now()
        };
      });
      addLog('Product Deleted', `Tirtiray Ice Cream Product: ${prodName} (Waxaa loo wareejiyay Recycle Bin)`);
    }
  };

  // Cart operations
  const addToCartDirectly = (prod: Product, qtyToAdd: number = 1) => {
    if (qtyToAdd <= 0) return;
    setCart(prev => {
      const existingIndex = prev.findIndex(item => item.product.id === prod.id);
      if (existingIndex > -1) {
        const updated = [...prev];
        updated[existingIndex].quantity += qtyToAdd;
        return updated;
      } else {
        return [...prev, {
          product: prod,
          quantity: qtyToAdd,
          selectedFlavors: [],
          notes: ''
        }];
      }
    });
  };

  const setCartItemQty = (index: number, newQty: number) => {
    setCart(prev => {
      const updated = [...prev];
      if (newQty <= 0) {
        return updated.filter((_, i) => i !== index);
      } else {
        updated[index].quantity = newQty;
        return updated;
      }
    });
  };

  const updateCartQty = (index: number, delta: number) => {
    setCart(prev => {
      const updated = [...prev];
      const newQty = updated[index].quantity + delta;
      if (newQty <= 0) {
        return updated.filter((_, i) => i !== index);
      } else {
        updated[index].quantity = newQty;
        return updated;
      }
    });
  };

  const removeFromCart = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
  };

  // Checkout Handler with Ingredient Deduction
  const handleCheckout = () => {
    if (cart.length === 0) return alert("Fadlan doorka iibso ugu yaraan hal Ice Cream!");

    if (paymentMethod === PaymentMethod.DEBT && !selectedCustomerId) {
      return alert("Haddii iibku yahay DAYN, fadlan dooro macaamiilka daynta qaadanaya!");
    }

    const txId = generateId();
    const cust = data.customers.find(c => c.id === selectedCustomerId);

    const txItems = cart.map(item => ({
      id: item.product.id,
      name: `${item.product.name}${item.selectedFlavors.length > 0 ? ` (${item.selectedFlavors.join(', ')})` : ''}`,
      sku: item.product.sku,
      barcode: item.product.barcode,
      costPrice: item.product.costPrice,
      sellPrice: item.customSellPrice ?? item.product.sellPrice,
      stock: item.product.stock,
      category: item.product.category,
      quantity: item.quantity
    }));

    const saleTimestamp = saleDate ? new Date(saleDate).getTime() : Date.now();

    const newTransaction: Transaction = {
      id: txId,
      items: txItems,
      subtotal: subtotal,
      tax: 0,
      total: subtotal,
      currency: currency,
      exchangeRate: rate,
      paymentMethod: paymentMethod,
      customerId: selectedCustomerId || undefined,
      timestamp: saleTimestamp,
      type: 'SALE'
    };

    // Deduct raw ingredients if recipes defined
    const updatedIngredients = [...ingredients];
    cart.forEach(cartItem => {
      const productRecipe = recipes[cartItem.product.id];
      if (productRecipe && productRecipe.length > 0) {
        productRecipe.forEach(recItem => {
          const ingIndex = updatedIngredients.findIndex(i => i.id === recItem.ingredientId);
          if (ingIndex > -1) {
            const qtyNeeded = recItem.quantity * cartItem.quantity;
            updatedIngredients[ingIndex] = {
              ...updatedIngredients[ingIndex],
              stock: Math.max(0, updatedIngredients[ingIndex].stock - qtyNeeded)
            };
          }
        });
      }
    });

    // Update product stock
    const updatedProducts = data.products.map(p => {
      const cartMatch = cart.find(c => c.product.id === p.id);
      if (cartMatch) {
        return { ...p, stock: Math.max(0, p.stock - cartMatch.quantity) };
      }
      return p;
    });

    // Customer debt update
    let updatedCustomers = [...data.customers];
    if (paymentMethod === PaymentMethod.DEBT && selectedCustomerId) {
      updatedCustomers = updatedCustomers.map(c => 
        c.id === selectedCustomerId 
          ? { ...c, debtBalance: c.debtBalance + subtotal, history: [...c.history, txId] }
          : c
      );
    } else if (selectedCustomerId) {
      updatedCustomers = updatedCustomers.map(c => 
        c.id === selectedCustomerId ? { ...c, history: [...c.history, txId] } : c
      );
    }

    // Account updates
    let updatedAccounts = [...data.accounts];
    if (paymentMethod !== PaymentMethod.DEBT) {
      const targetAcc = data.accounts.find(a => a.name.toLowerCase().includes('cash')) || data.accounts[0];
      if (targetAcc) {
        updatedAccounts = updatedAccounts.map(a => 
          a.id === targetAcc.id ? { ...a, balance: a.balance + subtotal } : a
        );
      }
    }

    setData(prev => ({
      ...prev,
      products: updatedProducts,
      transactions: [...prev.transactions, newTransaction],
      customers: updatedCustomers,
      accounts: updatedAccounts,
      iceCreamIngredients: updatedIngredients
    }));

    const orderNum = getSequentialOrderNumber(txId);
    addLog('Ice Cream Sale', `Iibiyay Ice Cream Order #${orderNum} ($${subtotal}) Nidaamka: ${paymentMethod}${cust ? ` - Macaamiil: ${cust.name}` : ''}`);

    setCompletedTx(newTransaction);
    setCart([]);
    setSelectedCustomerId('');
    setSaleDate(getInitialDateTime());
  };

  // Save / Add Ingredient
  const handleSaveIngredient = () => {
    if (!ingFormName.trim()) return alert("Fadlan geli magaca alaabta!");
    const cost = parseFloat(ingFormUnitCost);
    const stk = parseFloat(ingFormStock);
    if (isNaN(cost) || cost < 0) return alert("Geli qiimo sax ah!");
    if (isNaN(stk) || stk < 0) return alert("Geli stock sax ah!");

    let newIngredients = [...ingredients];
    if (ingFormId) {
      newIngredients = newIngredients.map(i => i.id === ingFormId ? {
        ...i,
        name: ingFormName.trim(),
        unit: ingFormUnit,
        unitCost: cost,
        stock: stk
      } : i);
      addLog('Ingredient Updated', `Cusboaysiiyay ingredient: ${ingFormName}`);
    } else {
      const newIng: IceCreamIngredient = {
        id: generateId(),
        name: ingFormName.trim(),
        unit: ingFormUnit,
        unitCost: cost,
        stock: stk
      };
      newIngredients.push(newIng);
      addLog('Ingredient Added', `Gelisay ingredient cusub: ${ingFormName}`);
    }

    // Re-calculate all product cost prices based on new ingredient costs
    const updatedProducts = data.products.map(p => {
      if (p.category.toLowerCase().includes('ice cream')) {
        const pRecipe = recipes[p.id];
        if (pRecipe && pRecipe.length > 0) {
          const newCost = pRecipe.reduce((sum, r) => {
            const ing = newIngredients.find(i => i.id === r.ingredientId);
            return sum + (ing ? ing.unitCost * r.quantity : 0);
          }, 0);
          return { ...p, costPrice: newCost };
        }
      }
      return p;
    });

    setData(prev => ({
      ...prev,
      iceCreamIngredients: newIngredients,
      products: updatedProducts
    }));

    setShowIngredientModal(false);
  };

  // Delete Raw Ingredient
  const handleDeleteIngredient = (ingId: string, ingName: string) => {
    if (confirm(`Ma xiineysaa inaad tirtirto ingredient-ka: "${ingName}"?`)) {
      const updatedIngredients = ingredients.filter(i => i.id !== ingId);
      
      // Clean up recipes containing this ingredient
      const updatedRecipes = { ...recipes };
      Object.keys(updatedRecipes).forEach(prodId => {
        updatedRecipes[prodId] = updatedRecipes[prodId].filter(r => r.ingredientId !== ingId);
      });

      // Re-calculate all product cost prices
      const updatedProducts = data.products.map(p => {
        if (p.category.toLowerCase().includes('ice cream')) {
          const pRecipe = updatedRecipes[p.id];
          if (pRecipe && pRecipe.length > 0) {
            const newCost = pRecipe.reduce((sum, r) => {
              const ing = updatedIngredients.find(i => i.id === r.ingredientId);
              return sum + (ing ? ing.unitCost * r.quantity : 0);
            }, 0);
            return { ...p, costPrice: newCost };
          }
        }
        return p;
      });

      setData(prev => ({
        ...prev,
        iceCreamIngredients: updatedIngredients,
        iceCreamRecipes: updatedRecipes,
        products: updatedProducts,
        deletedIds: { ...(prev.deletedIds || {}), [ingId]: Date.now() },
        lastModified: Date.now()
      }));

      addLog('Ingredient Deleted', `Tirtiray ingredient-ka: ${ingName}`);
    }
  };

  // Open Recipe Editor for Product
  const openRecipeEditor = (prodId: string) => {
    setRecipeProdId(prodId);
    setRecipeDraft(recipes[prodId] ? [...recipes[prodId]] : []);
    setShowRecipeModal(true);
  };

  // Save Recipe for Product
  const handleSaveRecipe = () => {
    if (!recipeProdId) return;

    const newRecipes = {
      ...recipes,
      [recipeProdId]: recipeDraft
    };

    // Calculate new calculated cost price
    const newCostPrice = recipeDraft.reduce((sum, item) => {
      const ing = ingredients.find(i => i.id === item.ingredientId);
      return sum + (ing ? ing.unitCost * item.quantity : 0);
    }, 0);

    const updatedProducts = data.products.map(p => 
      p.id === recipeProdId ? { ...p, costPrice: newCostPrice } : p
    );

    setData(prev => ({
      ...prev,
      iceCreamRecipes: newRecipes,
      products: updatedProducts
    }));

    addLog('Recipe Updated', `La cusboaysiiyay reseebka alaabta lagu sameeyo`);
    setShowRecipeModal(false);
  };

  // Save Ice Cream Expense (External Cash or Internal Store Product Consumption)
  const handleSaveExpense = () => {
    if (expSource === 'EXTERNAL') {
      const amt = parseFloat(expAmount);
      if (isNaN(amt) || amt <= 0) return alert("Fadlan geli lacagta kharashka ee saxda ah!");

      const accId = expAccountId || (data.accounts[0]?.id || '');
      const newExp: Expense = {
        id: generateId(),
        category: `Ice Cream: ${expCategory}`,
        description: expDescription || `Kharashka Ice Cream (${expCategory})`,
        amount: amt,
        currency: currency,
        timestamp: expDate ? new Date(expDate).getTime() : Date.now(),
        accountId: accId
      };

      let updatedAccounts = [...data.accounts];
      if (accId) {
        updatedAccounts = updatedAccounts.map(a => 
          a.id === accId ? { ...a, balance: Math.max(0, a.balance - amt) } : a
        );
      }

      setData(prev => ({
        ...prev,
        expenses: [newExp, ...prev.expenses],
        accounts: updatedAccounts
      }));

      addLog('Ice Cream Expense Added', `Gelisay kharash banaanka ah: $${amt} (${expCategory})`);
    } else {
      // INTERNAL STORE PRODUCT CONSUMPTION
      if (!expProductId) return alert("Fadlan dooro Product-ka store-ka ugu jira ee la qaatay!");
      const qty = parseFloat(expProdQty);
      if (isNaN(qty) || qty <= 0) return alert("Fadlan geli xaddiga (Quantity) saxda ah!");

      const selectedProd = data.products.find(p => p.id === expProductId);
      if (!selectedProd) return alert("Product-ka la doortay ma jiro!");

      const unitCost = selectedProd.costPrice > 0 ? selectedProd.costPrice : selectedProd.sellPrice;
      const totalCost = qty * unitCost;

      // Deduct stock from main product store
      const updatedProducts = data.products.map(p => 
        p.id === expProductId 
          ? { ...p, stock: Math.max(0, p.stock - qty) }
          : p
      );

      const newExp: Expense = {
        id: generateId(),
        category: `Ice Cream: Store Product Consumption`,
        description: expDescription || `Isku isticmaal Ice Cream: Qaatay ${qty}x ${selectedProd.name} (Store Inventory)`,
        amount: totalCost,
        currency: currency,
        timestamp: expDate ? new Date(expDate).getTime() : Date.now(),
        accountId: ''
      };

      setData(prev => ({
        ...prev,
        expenses: [newExp, ...prev.expenses],
        products: updatedProducts
      }));

      addLog('Ice Cream Store Consumption', `Ice Cream wuxuu store-ka ka qaatay: ${qty}x ${selectedProd.name} ($${totalCost.toFixed(2)})`);
    }

    setShowExpenseModal(false);
    setExpAmount('');
    setExpDescription('');
    setExpProdQty('1');
  };

  const filteredCustomers = useMemo(() => {
    if (!customerSearch) return data.customers;
    const term = customerSearch.toLowerCase();
    return data.customers.filter(c => c.name.toLowerCase().includes(term) || c.phone.includes(term));
  }, [data.customers, customerSearch]);

  return (
    <div className="p-4 md:p-8 space-y-8 min-h-full">
      
      {/* Top Banner */}
      <div className="bg-gradient-to-r from-pink-600 via-rose-500 to-amber-500 rounded-[36px] p-6 md:p-8 text-white shadow-2xl relative overflow-hidden flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div className="relative z-10 space-y-2">
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-md px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest border border-white/20">
            🍦 ICE CREAM SHOP DEDICATED HUB
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight drop-shadow-md">
            Ice Cream Shop & Production
          </h1>
          <p className="text-xs md:text-sm text-pink-100 max-w-xl font-medium">
            Maamul Iibka (POS), Kharashka & Faa'iidada (P&L) iyo Alaabta la isticmaalay!
          </p>
        </div>

        {/* Quick Stats & Action */}
        <div className="relative z-10 flex flex-wrap items-center gap-3 w-full md:w-auto">
          <div className="bg-white/10 backdrop-blur-md border border-white/20 p-4 rounded-3xl flex-1 md:flex-none min-w-[140px]">
            <p className="text-[10px] font-black uppercase tracking-widest text-pink-200">Iibka Maanta</p>
            <h3 className="text-2xl font-black">{formatCurrency(todayRevenue, currency, rate)}</h3>
            <p className="text-[10px] text-pink-100 font-bold mt-0.5">{todayScoopsSold} Items Sold</p>
          </div>

          <button
            onClick={openAddProductModal}
            className="bg-white text-slate-900 font-black text-xs px-5 py-4 rounded-2xl shadow-lg hover:bg-pink-50 active:scale-95 transition-all flex items-center gap-2"
          >
            <PlusCircle size={18} className="text-pink-600" />
            + Ice Cream Cusub
          </button>
        </div>

        <div className="absolute -right-10 -bottom-10 text-white/10 text-9xl select-none pointer-events-none font-black">
          🍦
        </div>
      </div>

      {/* Main Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 pb-2">
        <button
          onClick={() => setActiveTab('POS')}
          className={`px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'POS'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/20'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <ShoppingCart size={16} /> 🍦 Iibso (Register & POS)
        </button>

        <button
          onClick={() => setActiveTab('FINANCIALS')}
          className={`px-5 py-3 rounded-2xl font-black text-xs uppercase tracking-wider transition-all flex items-center gap-2 ${
            activeTab === 'FINANCIALS'
              ? 'bg-rose-600 text-white shadow-lg shadow-rose-500/20'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          <TrendingUp size={16} /> 📊 Kharashka & Faa'iidada (P&L Analytics)
        </button>
      </div>

      {/* TAB 1: POS REGISTER */}
      {activeTab === 'POS' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* LEFT 7 COLS: Products Grid */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
                <span>🍦</span> Liiska Ice Cream-yada
              </h2>
              <button
                onClick={openAddProductModal}
                className="text-xs font-black text-rose-600 bg-rose-50 px-3 py-1.5 rounded-xl border border-rose-200 hover:bg-rose-100 transition-colors flex items-center gap-1"
              >
                <Plus size={14} /> Add Ice Cream
              </button>
            </div>

            {/* Ice Cream Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
              {iceCreamProducts.map((prod, idx) => {
                const emoji = idx % 3 === 0 ? '🍦' : idx % 3 === 1 ? '🍧' : '🍨';
                const gradient = idx % 3 === 0 
                  ? 'from-amber-50 to-orange-50 hover:border-amber-400' 
                  : idx % 3 === 1 
                  ? 'from-rose-50 to-pink-50 hover:border-pink-400' 
                  : 'from-purple-50 to-indigo-50 hover:border-purple-400';
                
                const accentBg = idx % 3 === 0 ? 'bg-amber-500' : idx % 3 === 1 ? 'bg-rose-500' : 'bg-purple-600';
                const cartItem = cart.find(item => item.product.id === prod.id);
                const inCartQty = cartItem ? cartItem.quantity : 0;
                const recipe = recipes[prod.id];
                const hasRecipe = recipe && recipe.length > 0;

                return (
                  <div
                    key={prod.id}
                    onClick={() => addToCartDirectly(prod)}
                    className={`bg-gradient-to-br ${gradient} border-2 border-slate-200/80 rounded-[32px] p-5 cursor-pointer transition-all duration-200 hover:shadow-xl hover:-translate-y-1 flex flex-col justify-between group relative overflow-hidden select-none active:scale-98`}
                  >
                    <div className="flex items-start justify-between">
                      <span className="text-4xl group-hover:scale-125 transition-transform duration-300">
                        {emoji}
                      </span>
                      <div className="flex items-center gap-1">
                        {inCartQty > 0 && (
                          <span className="px-2.5 py-1 bg-rose-600 text-white font-black text-xs rounded-xl shadow-md">
                            {inCartQty}x
                          </span>
                        )}
                        <button
                          onClick={(e) => openEditProductModal(prod, e)}
                          title="Wax Ka Baddal"
                          className="p-1.5 bg-white/80 hover:bg-white text-slate-700 rounded-lg shadow-xs"
                        >
                          <Edit3 size={13} />
                        </button>
                        <button
                          onClick={(e) => handleDeleteProduct(prod.id, prod.name, e)}
                          title="Tirtir"
                          className="p-1.5 bg-white/80 hover:bg-rose-50 text-rose-600 rounded-lg shadow-xs"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="mt-4 space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`px-2.5 py-0.5 ${accentBg} text-white font-black text-[10px] rounded-lg shadow-xs`}>
                          {formatCurrency(prod.sellPrice, currency, rate)}
                        </span>
                        <span className="text-[9px] font-black text-slate-500 bg-white/80 px-2 py-0.5 rounded-md border border-slate-200">
                          Cost: {formatCurrency(prod.costPrice, currency, rate)}
                        </span>
                      </div>

                      <h3 className="font-black text-slate-900 text-sm leading-snug group-hover:text-rose-600 transition-colors pt-1">
                        {prod.name}
                      </h3>

                      <p className="text-[10px] font-bold text-slate-500 flex items-center justify-between">
                        <span>Reseebka:</span>
                        {hasRecipe ? (
                          <span className="text-emerald-600 font-black">✓ Configured ({recipe.length} ingredients)</span>
                        ) : (
                          <span className="text-amber-600 font-bold">Base Raw Cost</span>
                        )}
                      </p>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-200/60 flex items-center justify-between text-xs font-black">
                      {inCartQty > 0 ? (
                        <span className="text-rose-600 font-black flex items-center gap-1">
                          <CheckCircle2 size={14} /> {inCartQty}x Ku jira (Taabo si aad ugu darto +1)
                        </span>
                      ) : (
                        <span className="text-slate-500 group-hover:text-rose-600 flex items-center gap-1 transition-colors">
                          Taabo si aad u iibiso (+1 Click) <ArrowRight size={14} />
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* RIGHT 5 COLS: Cart & Checkout */}
          <div className="lg:col-span-5 bg-white rounded-[36px] border border-slate-100 shadow-xl p-6 md:p-8 space-y-6 sticky top-6">
            <div className="flex items-center justify-between border-b border-slate-100 pb-4">
              <h2 className="text-xl font-black text-slate-900 tracking-tight flex items-center gap-2">
                <ShoppingCart className="text-rose-600" size={22} /> Order-ka Ice Cream
              </h2>
              {cart.length > 0 && (
                <button onClick={() => setCart([])} className="text-xs font-bold text-rose-500 hover:underline">
                  Eberi (Clear)
                </button>
              )}
            </div>

            {/* Cart Items List */}
            <div className="space-y-3 max-h-[280px] overflow-y-auto pr-1">
              {cart.map((item, idx) => (
                <div key={idx} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-100 flex items-center justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="w-5 h-5 rounded-md bg-rose-600 text-white font-black text-[10px] flex items-center justify-center shrink-0 shadow-xs">
                        #{idx + 1}
                      </span>
                      <h4 className="font-black text-slate-900 text-xs truncate">{item.product.name}</h4>
                    </div>
                    
                    {/* Selling Price Input */}
                    <div className="flex items-center gap-1 mt-1">
                      <span className="text-[10px] text-slate-600 font-black">{currency === Currency.ETB ? 'ETB' : '$'}</span>
                      <IceCreamCartPriceInput item={item} index={idx} />
                      <span className="text-[9px] text-slate-500 font-bold">/ xabo</span>
                    </div>

                    <p className="text-[10px] font-black text-emerald-600 mt-0.5">
                      Total: {formatCurrency((item.customSellPrice ?? item.product.sellPrice) * item.quantity, currency, rate)}
                    </p>
                  </div>

                  {/* Quantity Controls */}
                  <div className="flex items-center gap-1.5 bg-white px-2 py-1.5 rounded-xl border border-slate-200">
                    <button onClick={() => updateCartQty(idx, -1)} className="p-1 text-slate-500 hover:text-slate-900">
                      <Minus size={14} />
                    </button>
                    <input 
                      type="number" 
                      min="1"
                      step="1"
                      value={item.quantity} 
                      onChange={(e) => {
                        const val = parseInt(e.target.value) || 0;
                        setCartItemQty(idx, val);
                      }}
                      className="w-9 font-black text-xs text-center bg-transparent outline-none focus:ring-1 focus:ring-rose-500 rounded p-0 border-none"
                    />
                    <button onClick={() => updateCartQty(idx, 1)} className="p-1 text-slate-500 hover:text-slate-900">
                      <Plus size={14} />
                    </button>
                  </div>

                  <button onClick={() => removeFromCart(idx)} className="p-1.5 text-slate-300 hover:text-rose-600 transition-colors">
                    <Trash2 size={16} />
                  </button>
                </div>
              ))}

              {cart.length === 0 && (
                <div className="py-12 text-center flex flex-col items-center justify-center border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
                  <span className="text-4xl mb-2">🍦</span>
                  <p className="text-xs font-black text-slate-600">Gaarigu Waa Ebar</p>
                  <p className="text-[10px] text-slate-400 mt-1">Taabo nooc ice cream ah si aad u iibiso</p>
                </div>
              )}
            </div>

            {/* Subtotal Display */}
            <div className="bg-slate-900 text-white p-5 rounded-3xl space-y-1 shadow-lg">
              <div className="flex justify-between items-center text-xs text-slate-400 font-bold uppercase tracking-wider">
                <span>Warta Guud (Total)</span>
                <span>{cart.reduce((s, i) => s + i.quantity, 0)} Items</span>
              </div>
              <div className="text-3xl font-black text-emerald-400">
                {formatCurrency(subtotal, currency, rate)}
              </div>
            </div>

            {/* Customer Selection */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Macaamiilka (Optional ama Dayn ahaan)
              </label>
              <div className="space-y-2">
                <input
                  type="text"
                  placeholder="Raadi Macaamiil..."
                  value={customerSearch}
                  onChange={e => setCustomerSearch(e.target.value)}
                  className="w-full px-3.5 py-2 bg-slate-100 border-none rounded-xl outline-none font-bold text-xs"
                />
                <select
                  className="w-full px-4 py-3 bg-slate-100 border-none rounded-2xl outline-none font-bold text-xs text-slate-800"
                  value={selectedCustomerId}
                  onChange={e => setSelectedCustomerId(e.target.value)}
                >
                  <option value="">-- Cash Customer (Aan Dayn ahayn) --</option>
                  {filteredCustomers.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.phone}) — Daynta Hore: ${c.debtBalance}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Nidaamka Lacag Bixinta (Payment Method)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { id: PaymentMethod.CASH, icon: Banknote, label: 'Cadaan (Cash)' },
                  { id: PaymentMethod.MOBILE_MONEY, icon: Smartphone, label: 'e-Birr / Kaafi' },
                  { id: PaymentMethod.BANK, icon: Building2, label: 'Bank Transfer' },
                  { id: PaymentMethod.DEBT, icon: HeartHandshake, label: 'Dayn (Debt)' },
                ].map(m => (
                  <button
                    key={m.id}
                    onClick={() => setPaymentMethod(m.id as PaymentMethod)}
                    className={`p-3 rounded-2xl border-2 font-black text-xs flex flex-col items-center gap-1.5 transition-all ${
                      paymentMethod === m.id 
                        ? 'border-rose-500 bg-rose-50 text-rose-700 shadow-md' 
                        : 'border-slate-100 text-slate-400 hover:border-slate-200'
                    }`}
                  >
                    <m.icon size={18} />
                    <span className="text-[9px] uppercase tracking-wider text-center">{m.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Sale Date & Time Selector */}
            <div className="space-y-2">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center justify-between">
                <span className="flex items-center gap-1.5"><Calendar size={13} className="text-rose-600" /> Taariikhda Iibka (Sale Date & Time)</span>
                <span className="text-[9px] text-rose-600 font-bold">Door Taariikhda</span>
              </label>
              <input 
                type="datetime-local" 
                value={saleDate} 
                onChange={(e) => setSaleDate(e.target.value)} 
                className="w-full px-4 py-3 bg-slate-100 border border-slate-200 rounded-2xl font-black text-xs text-slate-800 focus:ring-2 focus:ring-rose-500 outline-none"
              />
            </div>

            {/* Checkout Button */}
            <button
              onClick={handleCheckout}
              disabled={cart.length === 0}
              className="w-full py-5 bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 text-white rounded-3xl font-black text-base shadow-xl shadow-rose-900/20 active:scale-95 transition-all flex items-center justify-center gap-3 disabled:opacity-40"
            >
              <span>🎉 Bixi / Checkout Now</span>
              <ArrowRight size={20} />
            </button>
          </div>
        </div>
      )}

      {/* TAB 2: FINANCIALS & EXPENSES (P&L ANALYTICS) */}
      {activeTab === 'FINANCIALS' && (
        <div className="space-y-8">
          
          {/* Header & Filter Bar */}
          <div className="bg-white rounded-[32px] border border-slate-200 p-6 md:p-8 space-y-6 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-slate-900 flex items-center gap-2">
                  <TrendingUp className="text-emerald-600" size={28} /> Xisaabinta Kharashka & Faa'iidada (P&L)
                </h2>
                <p className="text-xs text-slate-500 font-bold mt-1">
                  Fiiri Kharashka galay, Cost of Goods (COGS), Iibka Guud, iyo Faa'iidada Hufan!
                </p>
              </div>

              <button
                onClick={() => setShowExpenseModal(true)}
                className="px-6 py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg shadow-rose-500/20 flex items-center gap-2"
              >
                <Plus size={16} /> + Geli Kharash Cusub (Add Expense)
              </button>
            </div>

            {/* Timeframe Selector (Maalin, Bile, Sanad, Custom Date) */}
            <div className="flex flex-wrap items-center gap-3 pt-4 border-t">
              <span className="text-xs font-black text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Calendar size={14} className="text-pink-600" /> Shaxda Waqtiga:
              </span>

              {[
                { id: 'TODAY', label: '📅 Maalin (Maanta)' },
                { id: 'MONTH', label: '📆 Bile (Bishan)' },
                { id: 'YEAR', label: '🗓️ Sanad (Sannadkan)' },
                { id: 'CUSTOM', label: '🔍 Custom Date (Dooro Taariikh)' },
              ].map(t => (
                <button
                  key={t.id}
                  onClick={() => setTimeframe(t.id as any)}
                  className={`px-4 py-2 rounded-xl font-black text-xs uppercase transition-all ${
                    timeframe === t.id
                      ? 'bg-slate-900 text-white shadow-md'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {t.label}
                </button>
              ))}

              {timeframe === 'CUSTOM' && (
                <div className="flex flex-wrap items-center gap-2 ml-auto">
                  <input
                    type="date"
                    value={customStartDate}
                    onChange={e => setCustomStartDate(e.target.value)}
                    className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-black text-slate-800"
                  />
                  <span className="text-xs font-bold text-slate-400">ilaa</span>
                  <input
                    type="date"
                    value={customEndDate}
                    onChange={e => setCustomEndDate(e.target.value)}
                    className="px-3 py-1.5 bg-slate-100 border border-slate-200 rounded-xl text-xs font-black text-slate-800"
                  />
                </div>
              )}
            </div>
          </div>

          {/* 4 Financial Metric Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            
            {/* Total Sales Revenue */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200/80 rounded-[32px] p-6 space-y-2">
              <div className="flex justify-between items-center text-emerald-800 font-black text-xs uppercase tracking-wider">
                <span>Iibka Guud (Total Sales)</span>
                <DollarSign size={20} />
              </div>
              <h3 className="text-3xl font-black text-emerald-900 font-mono">
                {formatCurrency(filteredFinancialData.totalRevenue, currency, rate)}
              </h3>
              <p className="text-[10px] font-bold text-emerald-700">
                {filteredFinancialData.txs.length} Transactions
              </p>
            </div>

            {/* Total COGS */}
            <div className="bg-gradient-to-br from-blue-50 to-cyan-50 border-2 border-blue-200/80 rounded-[32px] p-6 space-y-2">
              <div className="flex justify-between items-center text-blue-800 font-black text-xs uppercase tracking-wider">
                <span>Qiimaha Alaabta (COGS)</span>
                <Package size={20} />
              </div>
              <h3 className="text-3xl font-black text-blue-900 font-mono">
                {formatCurrency(filteredFinancialData.totalCOGS, currency, rate)}
              </h3>
              <p className="text-[10px] font-bold text-blue-700">
                Raw materials & ingredients cost
              </p>
            </div>

            {/* Total Expenses */}
            <div className="bg-gradient-to-br from-rose-50 to-pink-50 border-2 border-rose-200/80 rounded-[32px] p-6 space-y-2">
              <div className="flex justify-between items-center text-rose-800 font-black text-xs uppercase tracking-wider">
                <span>Kharashka (Expenses)</span>
                <TrendingUp size={20} className="rotate-180" />
              </div>
              <h3 className="text-3xl font-black text-rose-900 font-mono">
                {formatCurrency(filteredFinancialData.totalExpAmount, currency, rate)}
              </h3>
              <p className="text-[10px] font-bold text-rose-700">
                {filteredFinancialData.exps.length} Expense entries logged
              </p>
            </div>

            {/* Net Profit */}
            <div className="bg-gradient-to-br from-purple-50 to-indigo-50 border-2 border-purple-200/80 rounded-[32px] p-6 space-y-2">
              <div className="flex justify-between items-center text-purple-800 font-black text-xs uppercase tracking-wider">
                <span>Faa'iidada Hufan (Net Profit)</span>
                <PieChart size={20} />
              </div>
              <h3 className="text-3xl font-black text-purple-900 font-mono">
                {formatCurrency(filteredFinancialData.netProfit, currency, rate)}
              </h3>
              <p className="text-[10px] font-black text-purple-700">
                Profit Margin: {filteredFinancialData.profitMargin.toFixed(1)}%
              </p>
            </div>

          </div>

          {/* Breakdown by Product Table */}
          <div className="bg-white rounded-[32px] border border-slate-200 p-6 md:p-8 space-y-4 shadow-sm">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <span>📊</span> Xisaabinta Alaab Kasta (Per-Product Profit Breakdown)
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                    <th className="p-3">Ice Cream Name</th>
                    <th className="p-3">Tirada la Iibiyey</th>
                    <th className="p-3">Iibka Guud (Revenue)</th>
                    <th className="p-3">Cost-ka Guud (COGS)</th>
                    <th className="p-3 text-right">Faa'iidada (Net Profit)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                  {filteredFinancialData.itemBreakdown.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="p-3 font-black text-slate-900">{item.name}</td>
                      <td className="p-3">{item.qty} scoops / units</td>
                      <td className="p-3 font-mono text-emerald-600">{formatCurrency(item.revenue, currency, rate)}</td>
                      <td className="p-3 font-mono text-slate-500">{formatCurrency(item.cogs, currency, rate)}</td>
                      <td className="p-3 text-right font-mono font-black text-purple-700">
                        {formatCurrency(item.profit, currency, rate)}
                      </td>
                    </tr>
                  ))}

                  {filteredFinancialData.itemBreakdown.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400 font-bold">
                        Ma jiro wax iib ah oo laga diiwaan geliyay shaxda waqtiga la doortay.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Logged Expenses List Table */}
          <div className="bg-white rounded-[32px] border border-slate-200 p-6 md:p-8 space-y-4 shadow-sm">
            <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
              <TrendingUp className="text-rose-600 rotate-180" size={20} /> Liiska Kharashaadka Ice Cream-ka (Logged Expenses)
            </h3>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b">
                    <th className="p-3">Taariikhda</th>
                    <th className="p-3">Category</th>
                    <th className="p-3">Faahfaahin</th>
                    <th className="p-3 text-right">Lacagta</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-bold text-slate-700">
                  {filteredFinancialData.exps.map(exp => (
                    <tr key={exp.id} className="hover:bg-slate-50/50">
                      <td className="p-3 text-slate-400 font-medium">
                        {new Date(exp.timestamp).toLocaleDateString()} {new Date(exp.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </td>
                      <td className="p-3">
                        <span className="px-2.5 py-1 bg-rose-50 text-rose-700 rounded-xl font-black text-[10px] uppercase">
                          {exp.category}
                        </span>
                      </td>
                      <td className="p-3 text-slate-800">{exp.description}</td>
                      <td className="p-3 text-right font-black text-rose-600 font-mono">
                        {formatCurrency(exp.amount, currency, rate)}
                      </td>
                    </tr>
                  ))}

                  {filteredFinancialData.exps.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-8 text-center text-slate-400 font-bold">
                        Ma jiro wax kharash ah oo la galiyay shaxda waqtiga la doortay.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

        </div>
      )}

      {/* MODAL 1: ADD / EDIT PRODUCT */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[36px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 bg-gradient-to-r from-pink-600 to-rose-600 text-white flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black tracking-tight flex items-center gap-2">
                  <span>🍦</span> {itemModalMode === 'ADD' ? 'Geli Ice Cream Cusub' : 'Wax Ka Baddal Ice Cream-ka'}
                </h3>
                <p className="text-xs text-pink-100 font-medium mt-0.5">
                  Set Magaca, Size-ka (Yar, Dhexe, Weyn) & Qiimaha Iibka
                </p>
              </div>
              <button onClick={() => setShowAddProductModal(false)} className="p-2 hover:bg-white/10 rounded-full">
                ✕
              </button>
            </div>

            <div className="p-6 md:p-8 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Magaca Ice Cream-ka</label>
                <input
                  type="text"
                  placeholder="e.g. Vanilla Special"
                  value={itemFormName}
                  onChange={e => setItemFormName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl font-bold text-xs outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Size-ka</label>
                <select
                  value={itemFormSize}
                  onChange={e => setItemFormSize(e.target.value as 'Yar' | 'Dhexe' | 'Weyn')}
                  className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl font-bold text-xs outline-none"
                >
                  <option value="Yar">Yar (Small)</option>
                  <option value="Dhexe">Dhexe (Medium)</option>
                  <option value="Weyn">Weyn (Large)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Qiimaha Iibka ($)</label>
                <input
                  type="number"
                  step="0.01"
                  placeholder="2.00"
                  value={itemFormSellPrice}
                  onChange={e => setItemFormSellPrice(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl font-black text-sm text-emerald-600 outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAddProductModal(false)}
                  className="flex-1 py-4 font-black text-slate-400 text-xs uppercase"
                >
                  Kansal
                </button>
                <button
                  onClick={handleSaveProduct}
                  className="flex-[2] py-4 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-xl shadow-rose-900/20 active:scale-95 transition-all"
                >
                  {itemModalMode === 'ADD' ? 'Kaydi Ice Cream-ka' : 'Cusboaysii Ice Cream-ka'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: ADD / EDIT INGREDIENT */}
      {showIngredientModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-[36px] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                <FlaskConical className="text-pink-400" size={20} />
                {ingFormId ? 'Sixi Ingredient-ka' : 'Geli Ingredient Cusub'}
              </h3>
              <button onClick={() => setShowIngredientModal(false)} className="p-2 hover:bg-white/10 rounded-full">
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Magaca Alaabta (Ingredient Name)</label>
                <input
                  type="text"
                  placeholder="e.g. Powder Caano, Sukar, Biyo"
                  value={ingFormName}
                  onChange={e => setIngFormName(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl font-bold text-xs outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit (Cabirka)</label>
                <select
                  value={ingFormUnit}
                  onChange={e => setIngFormUnit(e.target.value as any)}
                  className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl font-bold text-xs outline-none"
                >
                  <option value="grm">Garam (grm)</option>
                  <option value="ml">Milli-liter (ml)</option>
                  <option value="kg">Kilo (kg)</option>
                  <option value="liter">Liter (liter)</option>
                  <option value="pcs">Xabo / PCS</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unit Cost ($ per 1 unit)</label>
                <input
                  type="number"
                  step="0.0001"
                  placeholder="0.005"
                  value={ingFormUnitCost}
                  onChange={e => setIngFormUnitCost(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl font-black text-xs outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock-ka Hada</label>
                <input
                  type="number"
                  step="any"
                  placeholder="10000"
                  value={ingFormStock}
                  onChange={e => setIngFormStock(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl font-black text-xs outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowIngredientModal(false)}
                  className="flex-1 py-3.5 font-black text-slate-400 text-xs uppercase"
                >
                  Kansal
                </button>
                <button
                  onClick={handleSaveIngredient}
                  className="flex-[2] py-3.5 bg-pink-600 hover:bg-pink-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg"
                >
                  Kaydi Ingredient-ka
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: RECIPE BUILDER FOR PRODUCT */}
      {showRecipeModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-[36px] shadow-2xl w-full max-w-lg overflow-hidden space-y-4">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                  <FlaskConical className="text-pink-400" size={20} /> Reseebka: {data.products.find(p => p.id === recipeProdId)?.name}
                </h3>
                <p className="text-xs text-slate-400 font-bold mt-0.5">
                  Geli meeqo grm/ml/pcs oo alaab ceyriin ah ayaa ku baxda 1 unit of Ice Cream
                </p>
              </div>
              <button onClick={() => setShowRecipeModal(false)} className="p-2 hover:bg-white/10 rounded-full">
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
              {/* Recipe item rows */}
              <div className="space-y-3">
                {recipeDraft.map((item, idx) => {
                  const ing = ingredients.find(i => i.id === item.ingredientId);
                  return (
                    <div key={idx} className="p-3 bg-slate-50 rounded-2xl border flex items-center justify-between gap-3">
                      <select
                        value={item.ingredientId}
                        onChange={(e) => {
                          const val = e.target.value;
                          setRecipeDraft(prev => prev.map((it, i) => i === idx ? { ...it, ingredientId: val } : it));
                        }}
                        className="flex-1 px-3 py-2 bg-white border rounded-xl font-bold text-xs"
                      >
                        {ingredients.map(ig => (
                          <option key={ig.id} value={ig.id}>{ig.name} ({ig.unit})</option>
                        ))}
                      </select>

                      <input
                        type="number"
                        step="any"
                        placeholder="Quantity"
                        value={item.quantity}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0;
                          setRecipeDraft(prev => prev.map((it, i) => i === idx ? { ...it, quantity: val } : it));
                        }}
                        className="w-24 px-3 py-2 bg-white border rounded-xl font-black text-xs text-pink-600"
                      />

                      <span className="text-xs font-bold text-slate-500">{ing?.unit}</span>

                      <button
                        onClick={() => setRecipeDraft(prev => prev.filter((_, i) => i !== idx))}
                        className="p-1.5 text-rose-500 hover:bg-rose-100 rounded-lg"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  );
                })}
              </div>

              <button
                onClick={() => {
                  if (ingredients.length === 0) return alert("Fadlan marka hore diiwaan geli Ingredients!");
                  setRecipeDraft(prev => [...prev, { ingredientId: ingredients[0].id, quantity: 50 }]);
                }}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 rounded-2xl font-black text-xs uppercase flex items-center justify-center gap-2"
              >
                <Plus size={16} /> + Daa Ingredient Kale Reseebka
              </button>

              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={() => setShowRecipeModal(false)}
                  className="flex-1 py-3.5 font-black text-slate-400 text-xs uppercase"
                >
                  Kansal
                </button>
                <button
                  onClick={handleSaveRecipe}
                  className="flex-[2] py-3.5 bg-pink-600 hover:bg-pink-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg"
                >
                  Kaydi Reseebka
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: ADD ICE CREAM EXPENSE */}
      {showExpenseModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in">
          <div className="bg-white rounded-[36px] shadow-2xl w-full max-w-md overflow-hidden">
            <div className="p-6 bg-rose-600 text-white flex items-center justify-between">
              <div>
                <h3 className="text-lg font-black tracking-tight flex items-center gap-2">
                  <TrendingUp className="rotate-180" size={20} /> Geli Kharash Ice Cream (Add Expense)
                </h3>
                <p className="text-xs text-rose-100 font-bold mt-0.5">
                  Biyo, Caano Powder, Sukar, Koronto, Labor, ama Packaging
                </p>
              </div>
              <button onClick={() => setShowExpenseModal(false)} className="p-2 hover:bg-white/10 rounded-full">
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Category-ga Kharashka</label>
                <select
                  value={expCategory}
                  onChange={e => setExpCategory(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl font-bold text-xs outline-none"
                >
                  <option value="Biyo & Caano Powder">Biyo & Caano Powder</option>
                  <option value="Sukar & Syrups">Sukar & Syrups</option>
                  <option value="Cups, Cones & Packaging">Cups, Cones & Packaging</option>
                  <option value="Koronto & Nasiib (Electricity)">Koronto & Nasiib (Electricity)</option>
                  <option value="Mushaar & Labor">Mushaar & Labor</option>
                  <option value="Dayactir & Maintenance">Dayactir & Maintenance</option>
                  <option value="Kharash Kale">Kharash Kale</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Lacagta Kharashka ($)</label>
                <input
                  type="number"
                  step="any"
                  placeholder="15.00"
                  value={expAmount}
                  onChange={e => setExpAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl font-black text-base text-rose-600 outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Akoonka Lacagtu ka baxday</label>
                <select
                  value={expAccountId}
                  onChange={e => setExpAccountId(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl font-bold text-xs outline-none"
                >
                  {data.accounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} (${a.balance})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Faahfaahin (Note)</label>
                <input
                  type="text"
                  placeholder="e.g. Soo iibiyay 20L Biyo Safiid ah"
                  value={expDescription}
                  onChange={e => setExpDescription(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl font-bold text-xs outline-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Taariikhda Kharashka</label>
                <input
                  type="datetime-local"
                  value={expDate}
                  onChange={e => setExpDate(e.target.value)}
                  className="w-full px-4 py-3 bg-slate-100 border-none rounded-xl font-bold text-xs outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowExpenseModal(false)}
                  className="flex-1 py-3.5 font-black text-slate-400 text-xs uppercase"
                >
                  Kansal
                </button>
                <button
                  onClick={handleSaveExpense}
                  className="flex-[2] py-3.5 bg-rose-600 hover:bg-rose-700 text-white rounded-2xl font-black text-xs uppercase tracking-wider shadow-lg"
                >
                  Kaydi Kharashka
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: RECEIPT MODAL */}
      {completedTx && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-white rounded-[36px] shadow-2xl w-full max-w-sm overflow-hidden text-center p-8 space-y-6 animate-in zoom-in duration-300">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-3xl">
              🍦
            </div>

            <div>
              <h3 className="text-2xl font-black text-slate-900">Iibku Waa Guul!</h3>
              <p className="text-sm font-black text-pink-600 mt-1">
                Order #{getSequentialOrderNumber(completedTx.id)}
              </p>
              <p className="text-xs font-bold text-slate-400 mt-0.5">Receipt #{completedTx.id.slice(-6)}</p>
            </div>

            <div className="bg-slate-50 p-4 rounded-2xl space-y-2 text-xs text-slate-700 font-bold border">
              <div className="flex justify-between border-b pb-2">
                <span className="text-slate-400">Total Paid:</span>
                <span className="font-black text-emerald-600 text-sm">{formatCurrency(completedTx.total, currency, rate)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Payment:</span>
                <span className="font-black">{completedTx.paymentMethod}</span>
              </div>
            </div>

            <div className="space-y-2">
              <button
                onClick={() => window.print()}
                className="w-full py-3.5 bg-slate-900 hover:bg-black text-white rounded-2xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2"
              >
                <Printer size={16} /> Dabac Rasidka (Print Receipt)
              </button>
              <button
                onClick={() => setCompletedTx(null)}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-2xl font-black text-xs uppercase tracking-wider"
              >
                Xidh (Close)
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default IceCreamShop;
