import React, { useState, useMemo, useRef } from 'react';
import { AppData, Currency, Product, StockAdjustment, Account, Supplier } from '../types';
import { 
  PackagePlus, 
  Search, 
  ArrowUpRight, 
  Truck, 
  Calculator, 
  History, 
  CheckCircle2, 
  Wallet, 
  AlertCircle, 
  ShoppingBag, 
  Landmark, 
  Smartphone, 
  Banknote, 
  Plus, 
  Trash2, 
  Minus, 
  Layers, 
  Check,
  Calendar,
  FileText,
  FileSpreadsheet,
  X,
  Tag,
  DollarSign,
  Barcode,
  Camera,
  Upload,
  Sparkles,
  Zap
} from 'lucide-react';
import { formatCurrency, generateId, compressImage } from '../lib/utils';
import DailySupplierPurchasesTable from './DailySupplierPurchasesTable';
import { ConfirmModal } from './ConfirmModal';

interface Props {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  addLog: (action: string, details: string) => void;
  currency: Currency;
}

export interface PurchaseCartItem {
  productId: string;
  productName: string;
  sku: string;
  barcode: string;
  image?: string;
  currentStock: number;
  quantity: number;
  unitCost: number;
  totalCost: number;
  unit?: 'PCS' | 'KG';
}

const DEFAULT_CATEGORIES = ['General', 'Beverages', 'Food', 'Ice Cream Shop', 'Electronics', 'Cosmetics', 'Dairy', 'Snacks', 'Household'];

const Purchases: React.FC<Props> = ({ data, setData, addLog, currency }) => {
  // Navigation Tabs: ENTRY vs HISTORY
  const [activeTab, setActiveTab] = useState<'ENTRY' | 'HISTORY'>('ENTRY');

  // Search & Cart state
  const [searchProduct, setSearchProduct] = useState('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [quantity, setQuantity] = useState<number>(1);
  const [unitCost, setUnitCost] = useState<number>(0);

  // Multi-item Purchase Basket (Salada Iibka)
  const [purchaseCart, setPurchaseCart] = useState<PurchaseCartItem[]>([]);

  // Additional Fields: Date, Time, Page Number, Note, Invoice Ref
  const [purchaseDate, setPurchaseDate] = useState<string>(() => new Date().toISOString().split('T')[0]);
  const [purchaseTime, setPurchaseTime] = useState<string>(() => {
    const now = new Date();
    return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  });
  const [invoiceRef, setInvoiceRef] = useState<string>(() => `INV-PUR-${Date.now().toString().slice(-6)}`);
  const [pageNumber, setPageNumber] = useState<string>('');
  const [note, setNote] = useState<string>('');

  // Vendor & Payment State
  const [selectedSupplierId, setSelectedSupplierId] = useState<string>('');
  const [newSupplierName, setNewSupplierName] = useState<string>('');
  const [newSupplierPhone, setNewSupplierPhone] = useState<string>('');
  const [paymentType, setPaymentType] = useState<'CASH' | 'CREDIT' | 'PARTIAL'>('CASH');
  const [cashPaid, setCashPaid] = useState<number>(0);
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);

  // Modal: Full Featured Add New Product
  const [showAddProductModal, setShowAddProductModal] = useState<boolean>(false);
  const [newProdName, setNewProdName] = useState('');
  const [newProdCategory, setNewProdCategory] = useState('General');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [customCategory, setCustomCategory] = useState('');
  const [newProdUnit, setNewProdUnit] = useState<'PCS' | 'KG'>('PCS');
  const [newProdCostPrice, setNewProdCostPrice] = useState<number>(0);
  const [newProdPrice, setNewProdPrice] = useState<number>(0);
  const [newProdSku, setNewProdSku] = useState('');
  const [newProdBarcode, setNewProdBarcode] = useState('');
  const [newProdMinStock, setNewProdMinStock] = useState<number>(5);
  const [newProdExpiryDate, setNewProdExpiryDate] = useState('');
  const [newProdImage, setNewProdImage] = useState<string>('');
  const [newProdInitialQty, setNewProdInitialQty] = useState<number>(1);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Deletion modal state
  const [deleteConfirmAdj, setDeleteConfirmAdj] = useState<StockAdjustment | null>(null);

  const rate = data.settings.exchangeRate || 120;

  // Extract all categories dynamically from existing products
  const availableCategories = useMemo(() => {
    const cats = new Set(DEFAULT_CATEGORIES);
    data.products.forEach(p => {
      if (p.category && p.category.trim()) {
        cats.add(p.category.trim());
      }
    });
    return Array.from(cats);
  }, [data.products]);

  const filteredProducts = useMemo(() => {
    if (!searchProduct) return [];
    const term = searchProduct.toLowerCase();
    return data.products.filter(p => 
      p.name.toLowerCase().includes(term) || 
      p.sku.toLowerCase().includes(term) || 
      p.barcode.toLowerCase().includes(term)
    );
  }, [data.products, searchProduct]);

  // Compute Grand Totals for Purchase Basket
  const grandTotalPurchaseCost = useMemo(() => {
    return purchaseCart.reduce((sum, item) => sum + item.totalCost, 0);
  }, [purchaseCart]);

  const totalUnitsInCart = useMemo(() => {
    return purchaseCart.reduce((sum, item) => sum + item.quantity, 0);
  }, [purchaseCart]);

  const creditAmount = paymentType === 'CASH' 
    ? 0 
    : paymentType === 'CREDIT' 
    ? grandTotalPurchaseCost 
    : Math.max(0, grandTotalPurchaseCost - cashPaid);

  const effectiveCashAmount = paymentType === 'CASH' 
    ? grandTotalPurchaseCost 
    : paymentType === 'PARTIAL' 
    ? cashPaid 
    : 0;

  const selectedAccount = data.accounts.find(a => a.id === selectedAccountId);
  const hasInsufficientFunds = (paymentType === 'CASH' || paymentType === 'PARTIAL') && selectedAccount 
    ? selectedAccount.balance < effectiveCashAmount 
    : false;

  const selectedSupplier = data.suppliers.find(s => s.id === selectedSupplierId);

  // Directly push item to purchase basket like POS
  const handleQuickAddToCart = (prod: Product) => {
    const existingIndex = purchaseCart.findIndex(item => item.productId === prod.id);

    if (existingIndex > -1) {
      const updated = [...purchaseCart];
      const newQty = updated[existingIndex].quantity + 1;
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: newQty,
        totalCost: newQty * updated[existingIndex].unitCost
      };
      setPurchaseCart(updated);
    } else {
      const newItem: PurchaseCartItem = {
        productId: prod.id,
        productName: prod.name,
        sku: prod.sku,
        barcode: prod.barcode,
        image: prod.image,
        currentStock: prod.stock,
        quantity: 1,
        unitCost: prod.costPrice || 0,
        totalCost: prod.costPrice || 0,
        unit: prod.unit || 'PCS'
      };
      setPurchaseCart(prev => [...prev, newItem]);
    }
    setSearchProduct('');
  };

  // Select product for custom quantity/price input
  const handleSelectProduct = (prod: Product) => {
    setSelectedProduct(prod);
    setUnitCost(prod.costPrice || 0);
    setQuantity(1);
    setSearchProduct('');
  };

  // Add selected item to Purchase Cart
  const handleAddToCart = () => {
    if (!selectedProduct) return alert("Fadhlan dooro alaab!");
    if (quantity <= 0) return alert("Fadhlan geli tiro sax ah!");

    const existingIndex = purchaseCart.findIndex(item => item.productId === selectedProduct.id);

    if (existingIndex > -1) {
      const updated = [...purchaseCart];
      const newQty = updated[existingIndex].quantity + quantity;
      const newCost = unitCost >= 0 ? unitCost : updated[existingIndex].unitCost;
      updated[existingIndex] = {
        ...updated[existingIndex],
        quantity: newQty,
        unitCost: newCost,
        totalCost: newQty * newCost
      };
      setPurchaseCart(updated);
    } else {
      const newItem: PurchaseCartItem = {
        productId: selectedProduct.id,
        productName: selectedProduct.name,
        sku: selectedProduct.sku,
        barcode: selectedProduct.barcode,
        image: selectedProduct.image,
        currentStock: selectedProduct.stock,
        quantity: quantity,
        unitCost: unitCost,
        totalCost: quantity * unitCost,
        unit: selectedProduct.unit || 'PCS'
      };
      setPurchaseCart(prev => [...prev, newItem]);
    }

    setSelectedProduct(null);
    setSearchProduct('');
    setQuantity(1);
    setUnitCost(0);
  };

  // Handle image upload compression
  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      try {
        const compressed = await compressImage(e.target.files[0]);
        setNewProdImage(compressed);
      } catch (err) {
        console.error("Image compression error", err);
      }
    }
  };

  // Quick Create New Product & Auto-Add to Cart (Salada Iibka)
  const handleCreateAndAddProduct = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProdName.trim()) return alert("Fadhlan qeer magaca alaabta cusub!");

    const finalCategory = isCustomCategory ? customCategory.trim() || 'General' : newProdCategory;
    const finalSku = newProdSku.trim() || `SKU-${Date.now().toString().slice(-5)}`;
    const finalBarcode = newProdBarcode.trim() || Date.now().toString();

    const createdProd: Product = {
      id: generateId(),
      name: newProdName.trim(),
      category: finalCategory,
      costPrice: newProdCostPrice || 0,
      costPriceUSD: newProdCostPrice || 0,
      costPriceETB: (newProdCostPrice || 0) * rate,
      registeredCostRate: rate,
      sellPrice: newProdPrice || 0,
      stock: 0, // Initial stock is 0, will be updated when batch purchase is submitted
      sku: finalSku,
      barcode: finalBarcode,
      minStock: newProdMinStock || 5,
      unit: newProdUnit,
      expiryDate: newProdExpiryDate || undefined,
      image: newProdImage || undefined,
      createdAt: Date.now()
    };

    // Add to master product list
    setData(prev => ({
      ...prev,
      products: [createdProd, ...prev.products]
    }));

    addLog('Create Product', `Created new product "${createdProd.name}" directly via Purchases modal.`);

    // Automatically add to purchase cart (salada iibka)
    const initialQty = Math.max(1, newProdInitialQty);
    const unitCostVal = newProdCostPrice || 0;

    const newItem: PurchaseCartItem = {
      productId: createdProd.id,
      productName: createdProd.name,
      sku: createdProd.sku,
      barcode: createdProd.barcode,
      image: createdProd.image,
      currentStock: 0,
      quantity: initialQty,
      unitCost: unitCostVal,
      totalCost: initialQty * unitCostVal,
      unit: createdProd.unit || 'PCS'
    };

    // Append to cart preserving existing items
    setPurchaseCart(prev => [...prev, newItem]);

    // Reset Modal Form State
    setNewProdName('');
    setNewProdCategory('General');
    setIsCustomCategory(false);
    setCustomCategory('');
    setNewProdUnit('PCS');
    setNewProdCostPrice(0);
    setNewProdPrice(0);
    setNewProdSku('');
    setNewProdBarcode('');
    setNewProdMinStock(5);
    setNewProdExpiryDate('');
    setNewProdImage('');
    setNewProdInitialQty(1);
    setShowAddProductModal(false);
  };

  // Update item in cart directly
  const handleUpdateCartItem = (productId: string, field: 'quantity' | 'unitCost', value: number) => {
    setPurchaseCart(prev => prev.map(item => {
      if (item.productId === productId) {
        const updatedQty = field === 'quantity' ? Math.max(1, value) : item.quantity;
        const updatedCost = field === 'unitCost' ? Math.max(0, value) : item.unitCost;
        return {
          ...item,
          quantity: updatedQty,
          unitCost: updatedCost,
          totalCost: updatedQty * updatedCost
        };
      }
      return item;
    }));
  };

  // Remove item from cart
  const handleRemoveFromCart = (productId: string) => {
    setPurchaseCart(prev => prev.filter(item => item.productId !== productId));
  };

  // Submit Bulk Purchase Batch
  const handleStockInBatch = () => {
    if (purchaseCart.length === 0) {
      return alert("Fadhlan ugu yaraan hal alaab ku dar liiska iibka!");
    }

    if ((paymentType === 'CREDIT' || paymentType === 'PARTIAL') && !selectedSupplierId && !newSupplierName.trim()) {
      return alert("Fadhlan dooro ama qeer supplier-ka deynta lagu leeyahay!");
    }

    if ((paymentType === 'CASH' || paymentType === 'PARTIAL') && effectiveCashAmount > 0 && !selectedAccountId) {
      return alert("Fadhlan dooro akoonka lacagta cadaanka ah laga bixiyay!");
    }

    if (hasInsufficientFunds) {
      return alert("Akoonka la doortay laguma hayo lacag ku filan!");
    }

    setIsProcessing(true);

    let targetSupplierName = selectedSupplier?.name || newSupplierName.trim() || 'General Supplier';
    let supplierId = selectedSupplierId;

    let updatedSuppliers = [...data.suppliers];

    if (!supplierId && newSupplierName.trim()) {
      const newSupp: Supplier = {
        id: generateId(),
        name: newSupplierName.trim(),
        contact: 'Supplier',
        phone: newSupplierPhone.trim() || 'N/A',
        balance: 0
      };
      supplierId = newSupp.id;
      updatedSuppliers.push(newSupp);
    }

    if (creditAmount > 0 && supplierId) {
      updatedSuppliers = updatedSuppliers.map(s => 
        s.id === supplierId ? { ...s, balance: s.balance + creditAmount } : s
      );
    }

    let updatedAccounts = [...data.accounts];
    if (effectiveCashAmount > 0 && selectedAccountId) {
      updatedAccounts = updatedAccounts.map(a => 
        a.id === selectedAccountId ? { ...a, balance: a.balance - effectiveCashAmount } : a
      );
    }

    const batchRef = invoiceRef.trim() || `BATCH-${Date.now().toString().slice(-6)}`;
    let customTimestamp = Date.now();
    if (purchaseDate) {
      const timeStr = purchaseTime || '12:00';
      const combined = new Date(`${purchaseDate}T${timeStr}:00`);
      if (!isNaN(combined.getTime())) {
        customTimestamp = combined.getTime();
      }
    }

    const adjustmentsToCreate: StockAdjustment[] = [];

    const updatedProducts = data.products.map(p => {
      const cartItem = purchaseCart.find(ci => ci.productId === p.id);
      if (cartItem) {
        const newStock = p.stock + cartItem.quantity;
        const newCostPrice = cartItem.unitCost > 0 ? cartItem.unitCost : p.costPrice;

        return {
          ...p,
          stock: newStock,
          costPrice: newCostPrice,
          costPriceUSD: newCostPrice,
          costPriceETB: cartItem.unitCost > 0 ? cartItem.unitCost * (p.registeredCostRate || rate) : (p.costPriceETB || newCostPrice * (p.registeredCostRate || rate)),
          registeredCostRate: p.registeredCostRate || rate
        };
      }
      return p;
    });

    purchaseCart.forEach((item, index) => {
      const isFirst = index === 0;
      adjustmentsToCreate.push({
        id: generateId(),
        productId: item.productId,
        productName: item.productName,
        type: 'STOCK_IN',
        quantity: item.quantity,
        timestamp: customTimestamp,
        reason: `Batch Purchase (${purchaseCart.length} items) from ${targetSupplierName}. Ref: ${batchRef}`,
        supplierId: supplierId,
        supplierName: targetSupplierName,
        accountId: isFirst && effectiveCashAmount > 0 ? selectedAccountId : undefined,
        unitCost: item.unitCost,
        totalCost: item.totalCost,
        paymentType: paymentType,
        cashPaid: isFirst ? effectiveCashAmount : 0,
        debtCreated: isFirst ? creditAmount : 0,
        pageNumber: pageNumber.trim() || undefined,
        note: note.trim() || undefined
      });
    });

    setData(prev => ({
      ...prev,
      products: updatedProducts,
      accounts: updatedAccounts,
      suppliers: updatedSuppliers,
      stockAdjustments: [...adjustmentsToCreate, ...prev.stockAdjustments]
    }));

    addLog(
      'Bulk Inventory Purchase', 
      `Bought ${purchaseCart.length} product types (${totalUnitsInCart} total units) from ${targetSupplierName}. Date: ${purchaseDate}. Page#: ${pageNumber || 'N/A'}. Grand Total: ${formatCurrency(grandTotalPurchaseCost, currency, rate)}`
    );

    setIsProcessing(false);
    setPurchaseCart([]);
    setSelectedProduct(null);
    setSearchProduct('');
    setQuantity(1);
    setUnitCost(0);
    setSelectedSupplierId('');
    setNewSupplierName('');
    setNewSupplierPhone('');
    setPaymentType('CASH');
    setCashPaid(0);
    setSelectedAccountId('');
    setPageNumber('');
    setNote('');

    alert("Iibka alaabta oo dhan waa la xaqiijiyay! Stock-ga iyo balances-ka waa la cusbooneysiiyay.");
  };

  // Delete individual purchase record
  const handleDeletePurchaseRecord = (adj: StockAdjustment) => {
    setData(prev => {
      const updatedProducts = prev.products.map(p => {
        if (p.id === adj.productId) {
          return {
            ...p,
            stock: Math.max(0, p.stock - adj.quantity)
          };
        }
        return p;
      });

      const cashToReturn = adj.cashPaid || 0;
      let updatedAccounts = [...prev.accounts];
      if (cashToReturn > 0) {
        const cashAcc = updatedAccounts.find(a => a.id === 'acc-cash' || a.name.toLowerCase().includes('cash')) || updatedAccounts[0];
        if (cashAcc) {
          updatedAccounts = updatedAccounts.map(a => 
            a.id === cashAcc.id ? { ...a, balance: a.balance + cashToReturn } : a
          );
        }
      }

      const debtToDeduct = adj.debtCreated || 0;
      let updatedSuppliers = [...prev.suppliers];
      if (debtToDeduct > 0 && adj.supplierId) {
        updatedSuppliers = updatedSuppliers.map(s => 
          s.id === adj.supplierId ? { ...s, balance: Math.max(0, s.balance - debtToDeduct) } : s
        );
      }

      const updatedAdjustments = prev.stockAdjustments.filter(a => a.id !== adj.id);

      const binItem = {
        id: generateId(),
        type: 'STOCK_ADJUSTMENT' as const,
        deletedAt: Date.now(),
        title: `Purchase: ${adj.productName} (${adj.quantity} qty)`,
        description: `Cost: $${adj.totalCost || 0} • Supplier: ${adj.supplierName || 'N/A'} • Reason: ${adj.reason || 'Stock Purchase'}`,
        originalData: adj
      };
      const updatedDeletedIds = { ...(prev.deletedIds || {}) };
      updatedDeletedIds[adj.id] = Date.now();

      return {
        ...prev,
        products: updatedProducts,
        accounts: updatedAccounts,
        suppliers: updatedSuppliers,
        stockAdjustments: updatedAdjustments,
        recycleBin: [binItem, ...(prev.recycleBin || [])],
        deletedIds: updatedDeletedIds,
        lastModified: Date.now()
      };
    });

    addLog('Delete Purchase Record', `Deleted purchase entry for ${adj.productName} (-${adj.quantity} units). Stock & finances reverted.`);
    setDeleteConfirmAdj(null);
  };

  const recentStockIn = useMemo(() => {
    return data.stockAdjustments.filter(a => a.type === 'STOCK_IN').slice(0, 10);
  }, [data.stockAdjustments]);

  const getAccountIcon = (name: string) => {
    const n = name.toLowerCase();
    if (n.includes('bank')) return <Landmark size={14} className="text-blue-500" />;
    if (n.includes('cash')) return <Banknote size={14} className="text-emerald-500" />;
    if (n.includes('mobile')) return <Smartphone size={14} className="text-purple-500" />;
    return <Wallet size={14} className="text-slate-400" />;
  };

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-8 pb-20">
      
      {/* Top Header & Tab Navigation Switcher */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 border-b pb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
            <ShoppingBag size={32} className="text-blue-600" />
            Stock Purchases & Inventory Entry
          </h1>
          <p className="text-slate-500 font-medium">Maaree iibka alaabta badan, diwaangeli taariikhaha, bogagga & warbixinnada.</p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center gap-2 bg-slate-100 p-1.5 rounded-3xl border">
          <button
            type="button"
            onClick={() => setActiveTab('ENTRY')}
            className={`px-6 py-3 rounded-2xl font-black text-xs transition-all flex items-center gap-2 ${
              activeTab === 'ENTRY' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <PackagePlus size={16} />
            📦 Gali Iib Cusub (New Batch)
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('HISTORY')}
            className={`px-6 py-3 rounded-2xl font-black text-xs transition-all flex items-center gap-2 ${
              activeTab === 'HISTORY' 
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/20' 
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
            }`}
          >
            <FileSpreadsheet size={16} />
            📊 Xogta & Taariikhda Iibka (Reports & History)
          </button>
        </div>
      </div>

      {/* TAB 1: NEW PURCHASE BATCH ENTRY */}
      {activeTab === 'ENTRY' && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          <div className="lg:col-span-3 space-y-8">
            <div className="bg-white p-8 md:p-10 rounded-[40px] border shadow-sm space-y-10">
              
              {/* STEP 1: Search Product & Add Product Modal Launcher */}
              <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <label className="text-xs font-black text-blue-600 uppercase tracking-widest flex items-center gap-2">
                    <Search size={16} /> 1. Raadi oo Ku Dar Alaabta Liiska Iibka (Search & Add Items)
                  </label>
                  
                  {/* Action to create a brand new product using full form */}
                  <button
                    type="button"
                    onClick={() => setShowAddProductModal(true)}
                    className="px-5 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white rounded-2xl text-xs font-black transition-all flex items-center gap-2 shadow-md shadow-emerald-900/20 active:scale-95 self-start sm:self-auto"
                  >
                    <Plus size={16} /> Ku Dar Alaab Cusub (Add Product New)
                  </button>
                </div>

                {selectedProduct ? (
                  <div className="bg-blue-50/80 border border-blue-200 p-6 rounded-3xl space-y-4 animate-in fade-in slide-in-from-left-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white rounded-2xl border flex items-center justify-center overflow-hidden shrink-0">
                          {selectedProduct.image ? <img src={selectedProduct.image} className="w-full h-full object-cover" /> : <PackagePlus className="text-blue-600" size={24} />}
                        </div>
                        <div>
                          <h3 className="font-black text-slate-800 text-lg">{selectedProduct.name}</h3>
                          <p className="text-xs font-bold text-slate-500 uppercase">
                            Stock-ga Hadda: <span className="text-blue-700 font-black">{selectedProduct.stock} {selectedProduct.unit || 'units'}</span>
                          </p>
                        </div>
                      </div>
                      <button 
                        onClick={() => { setSelectedProduct(null); setSearchProduct(''); }}
                        className="px-4 py-2 text-xs font-black text-blue-600 hover:bg-blue-100 rounded-xl transition-colors"
                      >
                        KANSAL / CHANGE
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Tirada Lagasoo Iibiyay (Qty)</label>
                        <input 
                          type="number" 
                          min="1"
                          className="w-full px-4 py-3 bg-white border border-blue-200 rounded-2xl font-black text-lg text-blue-700 outline-none focus:ring-2 focus:ring-blue-400"
                          value={quantity || ''}
                          onChange={e => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">Qiimaha Iibka Xabbadda (Unit Cost)</label>
                        <input 
                          type="number" 
                          min="0"
                          step="0.01"
                          className="w-full px-4 py-3 bg-white border border-blue-200 rounded-2xl font-black text-lg text-slate-800 outline-none focus:ring-2 focus:ring-blue-400"
                          value={unitCost || ''}
                          onChange={e => setUnitCost(Math.max(0, parseFloat(e.target.value) || 0))}
                        />
                      </div>
                      <div className="flex items-end">
                        <button
                          type="button"
                          onClick={handleAddToCart}
                          className="w-full py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-black text-sm rounded-2xl shadow-md transition-all flex items-center justify-center gap-2 active:scale-95"
                        >
                          <Plus size={18} /> Ku Dar Salada Iibka
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={20} />
                    <input 
                      type="text" 
                      placeholder="Raadi magaca alaabta, SKU ama barcode si aad ugu darto iibka..."
                      className="w-full pl-12 pr-4 py-5 bg-slate-50 border border-slate-200 rounded-3xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-lg text-slate-800"
                      value={searchProduct}
                      onChange={e => setSearchProduct(e.target.value)}
                    />
                    {filteredProducts.length > 0 && (
                      <div className="absolute top-full mt-2 left-0 w-full bg-white border rounded-[32px] shadow-2xl z-30 max-h-80 overflow-y-auto p-2 divide-y">
                        {filteredProducts.map(p => (
                          <div 
                            key={p.id}
                            className="p-3 hover:bg-slate-50 rounded-2xl transition-colors flex items-center justify-between gap-4"
                          >
                            <div className="flex items-center gap-4 cursor-pointer flex-1" onClick={() => handleSelectProduct(p)}>
                              <div className="w-12 h-12 bg-slate-100 rounded-2xl border flex items-center justify-center overflow-hidden shrink-0">
                                {p.image ? <img src={p.image} className="w-full h-full object-cover" /> : <PackagePlus className="text-slate-400" size={20} />}
                              </div>
                              <div>
                                <p className="font-black text-slate-800 text-base">{p.name}</p>
                                <p className="text-[10px] text-slate-400 font-bold uppercase">SKU: {p.sku || 'N/A'} | Category: {p.category}</p>
                              </div>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <div className="text-right">
                                <p className="text-xs font-black text-blue-600">{p.stock} {p.unit || 'units'}</p>
                                <p className="text-[10px] text-slate-400 font-bold">Cost: {formatCurrency(p.costPrice, currency, rate)}</p>
                              </div>
                              <button
                                type="button"
                                onClick={() => handleQuickAddToCart(p)}
                                className="px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-xl font-black text-xs transition-all flex items-center gap-1"
                                title="Si toos ah ugu dar salada"
                              >
                                <Zap size={14} /> +1 Salada
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* STEP 2: Purchase Cart Basket View (Salada Iibka) */}
              <div className="space-y-4 border-t pt-8">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <label className="text-xs font-black text-slate-500 uppercase tracking-widest flex items-center gap-2">
                      <Layers size={16} className="text-blue-600" /> 2. Salada Iibka Alaabta (Purchase Basket)
                    </label>
                    <span className="bg-blue-600 text-white font-black text-[11px] px-2.5 py-0.5 rounded-full">
                      {purchaseCart.length} Nooc
                    </span>
                  </div>
                  {purchaseCart.length > 0 && (
                    <button 
                      type="button"
                      onClick={() => setPurchaseCart([])}
                      className="text-xs font-bold text-rose-600 hover:underline flex items-center gap-1"
                    >
                      <Trash2 size={13} /> Faaruqi Salada (Clear Cart)
                    </button>
                  )}
                </div>

                {purchaseCart.length > 0 ? (
                  <div className="overflow-x-auto rounded-3xl border border-slate-200 shadow-sm bg-slate-50/50">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-100 text-slate-700 text-[10px] uppercase font-black tracking-wider border-b">
                          <th className="p-4 rounded-tl-2xl">Alaabta (Item)</th>
                          <th className="p-4 text-center">Stock Hadda -&gt; Cusub</th>
                          <th className="p-4 text-center">Tirada (Qty)</th>
                          <th className="p-4 text-right">Qiimaha Xabbadda ($)</th>
                          <th className="p-4 text-right">Wadarta (Total)</th>
                          <th className="p-4 text-center rounded-tr-2xl">Delete</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200 text-xs font-bold text-slate-800 bg-white">
                        {purchaseCart.map((item) => {
                          const newStock = item.currentStock + item.quantity;
                          return (
                            <tr key={item.productId} className="hover:bg-blue-50/30 transition-colors">
                              <td className="p-4">
                                <div className="flex items-center gap-3">
                                  <div className="w-10 h-10 bg-slate-100 rounded-xl border flex items-center justify-center overflow-hidden shrink-0">
                                    {item.image ? <img src={item.image} className="w-full h-full object-cover" /> : <PackagePlus size={18} className="text-slate-400" />}
                                  </div>
                                  <div>
                                    <p className="font-black text-slate-900">{item.productName}</p>
                                    <p className="text-[10px] text-slate-400 font-mono">SKU: {item.sku || 'N/A'}</p>
                                  </div>
                                </div>
                              </td>
                              <td className="p-4 text-center">
                                <span className="text-slate-400">{item.currentStock}</span>
                                <span className="mx-1 text-blue-500 font-black">-&gt;</span>
                                <span className="text-emerald-600 font-black">{newStock} {item.unit || 'PCS'}</span>
                              </td>
                              <td className="p-4 text-center">
                                <div className="flex items-center justify-center gap-2">
                                  <input 
                                    type="number" 
                                    min="1"
                                    className="w-20 px-3 py-1.5 bg-slate-50 border rounded-xl font-black text-center text-sm outline-none focus:ring-2 focus:ring-blue-400"
                                    value={item.quantity}
                                    onChange={e => handleUpdateCartItem(item.productId, 'quantity', parseInt(e.target.value) || 1)}
                                  />
                                </div>
                              </td>
                              <td className="p-4 text-right">
                                <input 
                                  type="number" 
                                  min="0"
                                  step="0.01"
                                  className="w-28 px-3 py-1.5 bg-slate-50 border rounded-xl font-black text-right text-sm outline-none focus:ring-2 focus:ring-blue-400"
                                  value={item.unitCost}
                                  onChange={e => handleUpdateCartItem(item.productId, 'unitCost', parseFloat(e.target.value) || 0)}
                                />
                              </td>
                              <td className="p-4 text-right font-black text-blue-700 text-sm">
                                {formatCurrency(item.totalCost, currency, rate)}
                              </td>
                              <td className="p-4 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveFromCart(item.productId)}
                                  className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl transition-all"
                                  title="Kabixii Liiska"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-900 text-white font-black text-sm">
                          <td colSpan={2} className="p-4 rounded-bl-2xl">
                            WADARTA IIRKA BATCH-KA ({purchaseCart.length} Nooc)
                          </td>
                          <td className="p-4 text-center text-blue-300">
                            {totalUnitsInCart} xabbo
                          </td>
                          <td className="p-4"></td>
                          <td className="p-4 text-right text-emerald-400 text-base">
                            {formatCurrency(grandTotalPurchaseCost, currency, rate)}
                          </td>
                          <td className="p-4 rounded-br-2xl"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                ) : (
                  <div className="p-12 text-center bg-slate-50 border border-dashed rounded-3xl text-slate-400 space-y-3">
                    <ShoppingBag size={40} className="mx-auto text-slate-300" />
                    <p className="font-bold text-sm">Salada iibka waa faaruq. Raadi alaab ama taabo "Ku Dar Alaab Cusub" si aad ugu darto salada.</p>
                  </div>
                )}
              </div>

              {/* STEP 3: Metadata - Date, Time, Invoice Ref, Page Number, Note */}
              <div className="space-y-4 border-t pt-8">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <label className="text-xs font-black text-slate-700 uppercase tracking-widest px-1 flex items-center gap-2">
                    <Calendar size={16} className="text-blue-600" /> 3. Taariikhda & Waqtiga Iibka (Custom Date & Time)
                  </label>
                  
                  {/* Quick Date Presets */}
                  <div className="flex items-center gap-1.5 overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => {
                        const now = new Date();
                        setPurchaseDate(now.toISOString().split('T')[0]);
                        setPurchaseTime(`${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
                      }}
                      className="px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-700 rounded-xl text-xs font-black transition-all border border-blue-200"
                    >
                      ⚡ Maanta (Today)
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        const yesterday = new Date();
                        yesterday.setDate(yesterday.getDate() - 1);
                        setPurchaseDate(yesterday.toISOString().split('T')[0]);
                      }}
                      className="px-3 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-black transition-all border border-slate-200"
                    >
                      ⏪ Shalay (Yesterday)
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                      📅 Taariikhda (Custom Date)
                    </label>
                    <input 
                      type="date"
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-slate-800 text-sm"
                      value={purchaseDate}
                      onChange={e => setPurchaseDate(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                      ⏰ Waqtiga (Time)
                    </label>
                    <input 
                      type="time"
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-slate-800 text-sm"
                      value={purchaseTime}
                      onChange={e => setPurchaseTime(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                      📄 Lambarka Bogga (Page #)
                    </label>
                    <input 
                      type="text"
                      placeholder="e.g. Bogga 14, Page 2"
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-slate-800 text-sm"
                      value={pageNumber}
                      onChange={e => setPageNumber(e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                      🧾 Ref / Invoice #
                    </label>
                    <input 
                      type="text"
                      placeholder="INV-PUR-001"
                      className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-slate-800 text-sm font-mono"
                      value={invoiceRef}
                      onChange={e => setInvoiceRef(e.target.value)}
                    />
                  </div>

                  <div className="sm:col-span-2 md:col-span-4">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider block mb-1">
                      📝 Faahfaahin / Qoraal Dheeraad ah (Notes)
                    </label>
                    <input 
                      type="text"
                      placeholder="Xusuusin ama faahfaahin dheeraad ah oo ku saabsan iibkan..."
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-slate-800 text-sm"
                      value={note}
                      onChange={e => setNote(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* STEP 4: Supplier & Payment Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-8 border-t pt-8">
                <div className="space-y-4 md:col-span-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">
                    4. Vendor / Supplier (Supplier-ka Laga Soo Iibsaday)
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <select 
                      className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-3xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-slate-700"
                      value={selectedSupplierId}
                      onChange={e => {
                        setSelectedSupplierId(e.target.value);
                        if (e.target.value) setNewSupplierName('');
                      }}
                    >
                      <option value="">-- Dooro Supplier Jira --</option>
                      {data.suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.phone}) - Owed: {formatCurrency(s.balance, currency, rate)}</option>
                      ))}
                    </select>

                    {!selectedSupplierId && (
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          className="w-1/2 px-5 py-4 bg-slate-50 border border-slate-200 rounded-3xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-sm"
                          placeholder="Magaca Supplier Cusub"
                          value={newSupplierName}
                          onChange={e => setNewSupplierName(e.target.value)}
                        />
                        <input 
                          type="text" 
                          className="w-1/2 px-5 py-4 bg-slate-50 border border-slate-200 rounded-3xl focus:ring-4 focus:ring-blue-100 outline-none font-bold text-sm"
                          placeholder="Tel Supplier"
                          value={newSupplierPhone}
                          onChange={e => setNewSupplierPhone(e.target.value)}
                        />
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-4 md:col-span-2">
                  <label className="text-xs font-black text-slate-500 uppercase tracking-widest px-1">
                    5. Payment Type / Habka Bixinta Lacagta
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    <button
                      type="button"
                      onClick={() => setPaymentType('CASH')}
                      className={`py-4 rounded-2xl font-black text-sm transition-all border ${paymentType === 'CASH' ? 'bg-emerald-600 text-white border-emerald-600 shadow-md' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                    >
                      💵 Cash (Cadaan)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentType('CREDIT')}
                      className={`py-4 rounded-2xl font-black text-sm transition-all border ${paymentType === 'CREDIT' ? 'bg-red-600 text-white border-red-600 shadow-md' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                    >
                      📜 On Debt (Alaab Deyn Ah)
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentType('PARTIAL')}
                      className={`py-4 rounded-2xl font-black text-sm transition-all border ${paymentType === 'PARTIAL' ? 'bg-amber-600 text-white border-amber-600 shadow-md' : 'bg-slate-50 text-slate-600 border-slate-200'}`}
                    >
                      ⚖️ Partial (Qeyb Cadaan & Deyn)
                    </button>
                  </div>
                </div>

                {(paymentType === 'CASH' || paymentType === 'PARTIAL') && (
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Akoonka Lacagta Laga Bixiyay (Funding Account)</label>
                    <select 
                      className={`w-full px-6 py-4 rounded-3xl focus:ring-4 outline-none font-bold text-base appearance-none transition-all ${hasInsufficientFunds ? 'bg-red-50 border border-red-200 focus:ring-red-100 text-red-700' : 'bg-slate-50 border border-slate-200 focus:ring-blue-100 text-slate-700'}`}
                      value={selectedAccountId}
                      onChange={e => setSelectedAccountId(e.target.value)}
                    >
                      <option value="">Dooro Akoonka...</option>
                      {data.accounts.map(a => (
                        <option key={a.id} value={a.id}>{a.name} ({formatCurrency(a.balance, currency, rate)})</option>
                      ))}
                    </select>
                  </div>
                )}

                {paymentType === 'PARTIAL' && (
                  <div className="space-y-4">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest px-1">Lacagta Cadaanka ah ee Hore Loo Bixiyay</label>
                    <input 
                      type="number" 
                      className="w-full px-8 py-4 bg-slate-50 border border-slate-200 rounded-3xl focus:ring-4 focus:ring-blue-100 outline-none font-black text-2xl text-emerald-600"
                      placeholder="0.00"
                      value={cashPaid || ''}
                      onChange={e => setCashPaid(Math.max(0, parseFloat(e.target.value) || 0))}
                    />
                  </div>
                )}
              </div>

              {/* Impact Summary Bar */}
              {purchaseCart.length > 0 && grandTotalPurchaseCost > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 p-6 bg-slate-900 text-white rounded-[32px] animate-in zoom-in duration-300">
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Wadarta Iibka Batch-ka</p>
                    <span className="text-xl font-black text-blue-400">{formatCurrency(grandTotalPurchaseCost, currency, rate)}</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Cadaan Bixinta (Cash Paid)</p>
                    <span className="text-xl font-black text-emerald-400">-{formatCurrency(effectiveCashAmount, currency, rate)}</span>
                  </div>
                  <div>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Deynta Cusub ee Supplier-ka</p>
                    <span className="text-xl font-black text-red-400">+{formatCurrency(creditAmount, currency, rate)}</span>
                  </div>
                  {hasInsufficientFunds && (
                    <div className="col-span-full pt-2">
                      <p className="text-xs font-black text-red-400 uppercase flex items-center gap-1">
                        <AlertCircle size={14} /> Akoonka la doortay kuma haysid lacag ku filan!
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Submit Action */}
              <div className="pt-4">
                <button 
                  type="button"
                  onClick={handleStockInBatch}
                  disabled={
                    isProcessing || 
                    purchaseCart.length === 0 || 
                    hasInsufficientFunds ||
                    ((paymentType === 'CREDIT' || paymentType === 'PARTIAL') && !selectedSupplierId && !newSupplierName.trim()) ||
                    ((paymentType === 'CASH' || paymentType === 'PARTIAL') && effectiveCashAmount > 0 && !selectedAccountId)
                  }
                  className="w-full py-6 bg-blue-600 text-white rounded-[32px] font-black text-xl shadow-xl shadow-blue-900/20 hover:bg-blue-700 hover:shadow-2xl transition-all active:scale-95 disabled:opacity-50 flex items-center justify-center gap-3"
                >
                  <CheckCircle2 size={24} />
                  Xaqiiji oo Gali Iibka Alaabta ({purchaseCart.length} Items)
                </button>
              </div>

            </div>
          </div>

          {/* Sidebar: Treasury & Recent Logs */}
          <div className="lg:col-span-1 space-y-8">
            <div className="bg-white p-8 rounded-[40px] border shadow-sm">
               <h3 className="text-xl font-black text-slate-800 flex items-center gap-3 mb-6">
                  <Landmark size={20} className="text-blue-500" />
                  Treasury Overview
               </h3>
               <div className="space-y-3">
                 {data.accounts.map(acc => (
                   <div key={acc.id} className="p-4 bg-slate-50 rounded-2xl border flex justify-between items-center group hover:bg-white transition-all">
                     <div className="flex items-center gap-3">
                       {getAccountIcon(acc.name)}
                       <span className="text-xs font-black text-slate-700">{acc.name}</span>
                     </div>
                     <span className="text-sm font-black text-slate-900">{formatCurrency(acc.balance, currency, rate)}</span>
                   </div>
                 ))}
               </div>
            </div>

            <div className="bg-white p-8 rounded-[40px] border shadow-sm flex flex-col">
               <h3 className="text-xl font-black text-slate-800 flex items-center justify-between mb-6">
                  <span className="flex items-center gap-3">
                    <History size={20} className="text-slate-400" />
                    Purchase Logs
                  </span>
                  <span className="text-xs font-bold text-slate-400">{recentStockIn.length} entries</span>
               </h3>
               <div className="space-y-4 overflow-y-auto max-h-[400px] pr-2">
                  {recentStockIn.map(log => (
                    <div key={log.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-100 hover:border-blue-200 transition-all group relative">
                       <div className="flex justify-between items-start mb-2">
                          <p className="text-xs font-black text-slate-900 truncate max-w-[130px]">{log.productName}</p>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-lg">+{log.quantity}</span>
                            <button
                              type="button"
                              onClick={() => setDeleteConfirmAdj(log)}
                              className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                              title="Tirtir (Delete)"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                       </div>
                       <p className="text-[9px] text-slate-500 font-bold uppercase tracking-tighter line-clamp-2">{log.reason}</p>
                       {log.pageNumber && (
                         <p className="text-[9px] text-purple-700 font-bold mt-1">📄 Page #: {log.pageNumber}</p>
                       )}
                       {log.note && (
                         <p className="text-[9px] text-amber-700 font-medium italic">📝 {log.note}</p>
                       )}
                       <p className="text-[8px] text-slate-400 mt-2">{new Date(log.timestamp).toLocaleString()}</p>
                    </div>
                  ))}
               </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PURCHASE HISTORY & DAILY SUPPLIER TABLE */}
      {activeTab === 'HISTORY' && (
        <div className="space-y-8 animate-in fade-in duration-300">
          <DailySupplierPurchasesTable 
            data={data} 
            setData={setData}
            addLog={addLog}
            currency={currency} 
          />
        </div>
      )}

      {/* Modal: Full-Featured Add New Product (Sida Caadiga Ah Oo Kale) */}
      {showAddProductModal && (
        <div className="fixed inset-0 bg-slate-900/70 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl rounded-[36px] p-8 border shadow-2xl space-y-6 relative animate-in zoom-in-95 duration-200 my-8">
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 bg-gradient-to-tr from-emerald-500 to-teal-500 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20">
                  <PackagePlus size={24} />
                </div>
                <div>
                  <h3 className="font-black text-slate-900 text-xl">Ku Dar Alaab Cusub (Add Product)</h3>
                  <p className="text-xs text-slate-500 font-bold">Kaydi alaabtan cusub oo toos loo gulin doono salada iibka (purchase cart).</p>
                </div>
              </div>
              <button 
                type="button" 
                onClick={() => setShowAddProductModal(false)}
                className="p-2.5 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-2xl transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleCreateAndAddProduct} className="space-y-6">
              
              {/* Product Image & Name Header */}
              <div className="flex flex-col sm:flex-row items-center gap-6 bg-slate-50 p-5 rounded-3xl border border-slate-200">
                <div className="relative group shrink-0">
                  <div className="w-24 h-24 bg-white rounded-2xl border-2 border-dashed border-slate-300 flex items-center justify-center overflow-hidden shadow-sm group-hover:border-emerald-500 transition-colors">
                    {newProdImage ? (
                      <img src={newProdImage} className="w-full h-full object-cover" />
                    ) : (
                      <div className="text-center p-2 text-slate-400">
                        <Camera size={24} className="mx-auto mb-1" />
                        <span className="text-[9px] font-black uppercase block">Sawir Soo Keli</span>
                      </div>
                    )}
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    accept="image/*" 
                    onChange={handleImageChange} 
                    className="hidden" 
                  />
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute -bottom-2 -right-2 p-2 bg-emerald-600 text-white rounded-xl shadow-md hover:bg-emerald-700 transition-colors"
                    title="Upload Image"
                  >
                    <Upload size={14} />
                  </button>
                  {newProdImage && (
                    <button
                      type="button"
                      onClick={() => setNewProdImage('')}
                      className="absolute -top-2 -left-2 p-1 bg-rose-600 text-white rounded-full shadow hover:bg-rose-700"
                      title="Remove Image"
                    >
                      <X size={12} />
                    </button>
                  )}
                </div>

                <div className="w-full space-y-3">
                  <div>
                    <label className="text-[11px] font-black text-slate-700 uppercase block mb-1">Magaca Alaabta (Product Name) *</label>
                    <input 
                      type="text"
                      required
                      placeholder="e.g. Caano Boore Subax 1kg"
                      className="w-full px-5 py-3.5 bg-white border border-slate-200 rounded-2xl font-bold text-slate-900 text-base outline-none focus:ring-2 focus:ring-emerald-500 shadow-sm"
                      value={newProdName}
                      onChange={e => setNewProdName(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              {/* Category, Unit & Initial Qty */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-1">
                  <label className="text-[11px] font-black text-slate-700 uppercase block mb-1">Category / Qeybta</label>
                  {!isCustomCategory ? (
                    <div className="space-y-1">
                      <select
                        className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                        value={newProdCategory}
                        onChange={e => {
                          if (e.target.value === 'CUSTOM_NEW') {
                            setIsCustomCategory(true);
                          } else {
                            setNewProdCategory(e.target.value);
                          }
                        }}
                      >
                        {availableCategories.map(c => (
                          <option key={c} value={c}>{c}</option>
                        ))}
                        <option value="CUSTOM_NEW">+ Ku dar Category Cusub</option>
                      </select>
                    </div>
                  ) : (
                    <div className="flex gap-1">
                      <input 
                        type="text"
                        placeholder="Magaca Category-ga"
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                        value={customCategory}
                        onChange={e => setCustomCategory(e.target.value)}
                      />
                      <button 
                        type="button" 
                        onClick={() => setIsCustomCategory(false)}
                        className="p-3 text-slate-400 hover:text-slate-700"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-700 uppercase block mb-1">Unugga / Unit</label>
                  <select 
                    className="w-full px-4 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                    value={newProdUnit}
                    onChange={e => setNewProdUnit(e.target.value as 'PCS' | 'KG')}
                  >
                    <option value="PCS">📦 PCS (Xabbo)</option>
                    <option value="KG">⚖️ KG (Kiilo)</option>
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-black text-emerald-700 uppercase block mb-1">Tirada Salada Iibka (Initial Qty) *</label>
                  <input 
                    type="number"
                    min="1"
                    required
                    className="w-full px-4 py-3.5 bg-emerald-50 border border-emerald-200 rounded-2xl font-black text-emerald-800 text-base outline-none focus:ring-2 focus:ring-emerald-500"
                    value={newProdInitialQty}
                    onChange={e => setNewProdInitialQty(Math.max(1, parseInt(e.target.value) || 1))}
                  />
                </div>
              </div>

              {/* Pricing Inputs: Cost Price & Sell Price */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 bg-slate-50 p-5 rounded-3xl border">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] font-black text-slate-700 uppercase">Qiimaha Iibka / Cost Price ($) *</label>
                    <span className="text-[10px] font-bold text-slate-400">
                      ≈ ETB {(newProdCostPrice * rate).toLocaleString()}
                    </span>
                  </div>
                  <div className="relative">
                    <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="0.00"
                      className="w-full pl-9 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl font-black text-slate-900 text-base outline-none focus:ring-2 focus:ring-emerald-500"
                      value={newProdCostPrice || ''}
                      onChange={e => setNewProdCostPrice(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="text-[11px] font-black text-slate-700 uppercase">Qiimaha Bixinta / Sell Price ($) *</label>
                    <span className="text-[10px] font-bold text-slate-400">
                      ≈ ETB {(newProdPrice * rate).toLocaleString()}
                    </span>
                  </div>
                  <div className="relative">
                    <DollarSign className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      placeholder="0.00"
                      className="w-full pl-9 pr-4 py-3.5 bg-white border border-slate-200 rounded-2xl font-black text-slate-900 text-base outline-none focus:ring-2 focus:ring-emerald-500"
                      value={newProdPrice || ''}
                      onChange={e => setNewProdPrice(parseFloat(e.target.value) || 0)}
                    />
                  </div>
                </div>
              </div>

              {/* Barcode, SKU & Min Stock */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="text-[11px] font-black text-slate-700 uppercase block mb-1">SKU / Code</label>
                  <input 
                    type="text"
                    placeholder="Auto-generated"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                    value={newProdSku}
                    onChange={e => setNewProdSku(e.target.value)}
                  />
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-700 uppercase block mb-1">Barcode</label>
                  <div className="relative">
                    <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                    <input 
                      type="text"
                      placeholder="Scan or type barcode"
                      className="w-full pl-9 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                      value={newProdBarcode}
                      onChange={e => setNewProdBarcode(e.target.value)}
                    />
                  </div>
                </div>

                <div>
                  <label className="text-[11px] font-black text-slate-700 uppercase block mb-1">Min Stock Limit</label>
                  <input 
                    type="number"
                    min="0"
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                    value={newProdMinStock}
                    onChange={e => setNewProdMinStock(parseInt(e.target.value) || 0)}
                  />
                </div>
              </div>

              {/* Expiry Date */}
              <div>
                <label className="text-[11px] font-black text-slate-700 uppercase block mb-1">Taariikhda Dhicitaanka (Expiry Date - Optional)</label>
                <input 
                  type="date"
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl font-bold text-slate-800 text-sm outline-none focus:ring-2 focus:ring-emerald-500"
                  value={newProdExpiryDate}
                  onChange={e => setNewProdExpiryDate(e.target.value)}
                />
              </div>

              {/* Actions */}
              <div className="flex gap-4 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="w-1/2 py-4 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black rounded-2xl text-sm transition-colors"
                >
                  Kansal
                </button>
                <button
                  type="submit"
                  className="w-1/2 py-4 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black rounded-2xl text-sm shadow-xl shadow-emerald-900/20 transition-all flex items-center justify-center gap-2 active:scale-95"
                >
                  <CheckCircle2 size={18} />
                  Kaydi oo Ku Dar Salada
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for Deleting Purchase Log */}
      <ConfirmModal
        isOpen={!!deleteConfirmAdj}
        title="Ma hubtaa inaad tirtirto iibkan?"
        message={`Waa la tirtirayaa diwaangelintan (${deleteConfirmAdj?.productName} - ${deleteConfirmAdj?.quantity} xabbo). Tani waxay dib u dhimi doontaa stock-ga alaabta waxayna dib u habayn doontaa lacagaha noo dhaxeeya.`}
        confirmText="Haa, Tirtir (Delete)"
        cancelText="Kansal"
        onConfirm={() => deleteConfirmAdj && handleDeletePurchaseRecord(deleteConfirmAdj)}
        onClose={() => setDeleteConfirmAdj(null)}
        type="danger"
      />
    </div>
  );
};

export default Purchases;
