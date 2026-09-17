
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { AppData, Product, Currency, UserRole } from '../types';
import { Plus, Search, Edit2, Trash2, Camera, Download, Package, Upload, X as LucideX, Printer, FileSpreadsheet, Tag, CheckCircle2, Calendar, AlertTriangle, Flame, Layers, Filter, Settings2, Sparkles, TrendingDown } from 'lucide-react';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { compressImage, generateId, formatCurrency } from '../lib/utils';
import { parseAndValidateBackupJSON, sanitizeProduct } from '../lib/backupUtils';
import ConfirmModal from './ConfirmModal';

interface Props {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  addLog: (action: string, details: string) => void;
  currency: Currency;
}

const DEFAULT_CATEGORIES = ['General', 'Beverages', 'Food', 'Ice Cream Shop', 'Electronics', 'Cosmetics', 'Dairy', 'Snacks', 'Household'];

const Products: React.FC<Props> = ({ data, setData, addLog, currency }) => {
  const isCashier = data.settings?.currentUser?.role === UserRole.CASHIER;
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [deleteConfirmItem, setDeleteConfirmItem] = useState<{ id: string; name: string } | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('ALL');
  
  // Smart Quick Filter Pills: 'ALL' | 'UNSOLD_30' | 'EXPIRING_30' | 'LOW_STOCK' | 'LOW_PROFIT'
  const [activeQuickFilter, setActiveQuickFilter] = useState<'ALL' | 'UNSOLD_30' | 'EXPIRING_30' | 'LOW_STOCK' | 'LOW_PROFIT'>('ALL');

  // Deleted Categories tracking (user can remove unwanted categories)
  const [deletedCategories, setDeletedCategories] = useState<string[]>([]);
  const [showCategoryManager, setShowCategoryManager] = useState<boolean>(false);

  // Dual Currency Form State
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '', sku: '', barcode: '', costPrice: 0, sellPrice: 0, stock: 0, minStock: 5, category: 'General', image: '', expiryDate: '', unit: 'PCS'
  });

  const rate = data.settings.exchangeRate || 120;

  // Dual currency input states for cost and sell prices
  const [costUsdInput, setCostUsdInput] = useState<string>('0');
  const [costEtbInput, setCostEtbInput] = useState<string>('0');
  const [sellUsdInput, setSellUsdInput] = useState<string>('0');
  const [sellEtbInput, setSellEtbInput] = useState<string>('0');

  // Custom Category Input toggle
  const [isAddingNewCategory, setIsAddingNewCategory] = useState<boolean>(false);
  const [customCategoryName, setCustomCategoryName] = useState<string>('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  const [isSearchScannerOpen, setIsSearchScannerOpen] = useState(false);
  const searchScannerRef = useRef<Html5QrcodeScanner | null>(null);

  // Extract all categories dynamically from existing products, minus deleted ones
  const availableCategories = useMemo(() => {
    const cats = new Set(DEFAULT_CATEGORIES);
    data.products.forEach(p => {
      if (p.category && p.category.trim()) {
        cats.add(p.category.trim());
      }
    });
    return Array.from(cats).filter(c => !deletedCategories.includes(c));
  }, [data.products, deletedCategories]);

  // Calculate 30-day sales per product for Dead Stock detection
  const product30DaySales = useMemo(() => {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    const salesMap: Record<string, number> = {};

    data.transactions.forEach(tx => {
      if (tx.timestamp >= thirtyDaysAgo && tx.type === 'SALE' && tx.items) {
        tx.items.forEach(item => {
          salesMap[item.id] = (salesMap[item.id] || 0) + (item.quantity || 0);
        });
      }
    });

    return salesMap;
  }, [data.transactions]);

  // Calculate last sale timestamp per product
  const productLastSaleMap = useMemo(() => {
    const map: Record<string, number> = {};
    data.transactions.forEach(tx => {
      if (tx.type === 'SALE' && tx.items) {
        tx.items.forEach(item => {
          if (!map[item.id] || tx.timestamp > map[item.id]) {
            map[item.id] = tx.timestamp;
          }
        });
      }
    });
    return map;
  }, [data.transactions]);

  // Function to calculate exact unsold days for a product
  const getProductUnsoldDays = (p: Product) => {
    const lastSale = productLastSaleMap[p.id] || p.lastSoldAt;
    const baseline = lastSale || p.trackingStartedAt || p.createdAt || Date.now();
    const diffMs = Date.now() - baseline;
    return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  };

  // 1. Unsold 30 Days List (Dead stock)
  const unsold30Products = useMemo(() => {
    return data.products.filter(p => {
      const salesLast30Days = product30DaySales[p.id] || 0;
      const daysUnsold = getProductUnsoldDays(p);
      return salesLast30Days === 0 && daysUnsold >= 30 && p.stock > 0;
    });
  }, [data.products, product30DaySales, productLastSaleMap]);

  // Reset 30-day unsold counter to start fresh from today
  const handleResetUnsoldCounter = () => {
    if (confirm("Aad ma hubtaa inaad ka bilaabto tirinta 30-ka maalmood maanta? Dhammaan alaabta waxay maanta ka bilaaban doonaan 0 maalmood aan la iibsan.")) {
      const now = Date.now();
      const updatedProducts = data.products.map(p => ({
        ...p,
        trackingStartedAt: now
      }));
      setData(prev => ({ ...prev, products: updatedProducts }));
      addLog('Reset Unsold Tracker', 'Reset unsold tracking baseline for all products to today.');
      alert("Tirinta waa la bilaabay! Dhammaan alaabtu maanta waxay ka bilaaban doonaan 0 maalmood aan la iibsan. 30 maalmood ka dib waxay si toos ah u soo bixi doonaan qeybta '1 Bil Aan Socon'.");
    }
  };

  const handlePrintDeadStock = () => {
    setActiveQuickFilter('UNSOLD_30');
    setTimeout(() => {
      window.print();
    }, 250);
  };

  // 2. Expiring Soon List (<= 90 days left or expired)
  const expiringProducts = useMemo(() => {
    const today = new Date();
    return data.products.filter(p => {
      if (!p.expiryDate) return false;
      const expiry = new Date(p.expiryDate);
      const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= 90;
    });
  }, [data.products]);

  // 3. Low Stock List (stock <= minStock)
  const lowStockProducts = useMemo(() => {
    return data.products.filter(p => p.stock <= (p.minStock ?? 5));
  }, [data.products]);

  // 4. Low Profit Products List (profit <= 0.52631579 USD or <= 100 ETB)
  const lowProfitProducts = useMemo(() => {
    const thresholdUsd = 0.52631579;
    return data.products.filter(p => (p.sellPrice - p.costPrice) <= thresholdUsd);
  }, [data.products]);

  // Dead stock capital value
  const deadStockCapital = useMemo(() => {
    return unsold30Products.reduce((sum, p) => sum + (p.costPrice * p.stock), 0);
  }, [unsold30Products]);

  // Delete / Remove Category function
  const handleDeleteCategory = (catToDelete: string) => {
    if (confirm(`Aad ma hubtaa inaad tirto Category-ga "${catToDelete}"? Dhammaan alaabta ku jirtay waxaa loo wareejin doonaa "General".`)) {
      // Reassign products to 'General'
      const updatedProducts = data.products.map(p => 
        p.category === catToDelete ? { ...p, category: 'General' } : p
      );

      setData(prev => ({
        ...prev,
        products: updatedProducts
      }));

      setDeletedCategories(prev => [...prev, catToDelete]);
      if (selectedCategoryFilter === catToDelete) {
        setSelectedCategoryFilter('ALL');
      }

      addLog('Delete Category', `Deleted category "${catToDelete}" and moved products to General.`);
    }
  };

  useEffect(() => {
    if (isSearchScannerOpen) {
      const scanner = new Html5QrcodeScanner(
        "search-reader",
        { fps: 10, qrbox: { width: 250, height: 150 } },
        false
      );
      
      scanner.render((decodedText) => {
        setSearch(decodedText);
        if (navigator.vibrate) navigator.vibrate(100);
        setIsSearchScannerOpen(false);
        scanner.clear();
      }, () => {});

      searchScannerRef.current = scanner;
    } else {
      if (searchScannerRef.current) {
        searchScannerRef.current.clear().catch(err => console.error("Failed to clear search scanner", err));
        searchScannerRef.current = null;
      }
    }

    return () => {
      if (searchScannerRef.current) {
        searchScannerRef.current.clear().catch(err => console.error("Failed to clear search scanner", err));
      }
    };
  }, [isSearchScannerOpen]);

  const [isFormScannerOpen, setIsFormScannerOpen] = useState(false);
  const formScannerRef = useRef<Html5QrcodeScanner | null>(null);

  useEffect(() => {
    if (isFormScannerOpen) {
      const scanner = new Html5QrcodeScanner(
        "form-reader",
        { fps: 10, qrbox: { width: 250, height: 150 } },
        false
      );
      
      scanner.render((decodedText) => {
        setFormData(prev => ({ ...prev, barcode: decodedText }));
        if (navigator.vibrate) navigator.vibrate(100);
        setIsFormScannerOpen(false);
        scanner.clear();
      }, () => {});

      formScannerRef.current = scanner;
    } else {
      if (formScannerRef.current) {
        formScannerRef.current.clear().catch(err => console.error("Failed to clear form scanner", err));
        formScannerRef.current = null;
      }
    }

    return () => {
      if (formScannerRef.current) {
        formScannerRef.current.clear().catch(err => console.error("Failed to clear form scanner", err));
      }
    };
  }, [isFormScannerOpen]);

  // Update dual currency inputs when opening modal or editing product
  const openAddOrEditModal = (p?: Product) => {
    if (p) {
      setEditingProduct(p);
      setFormData(p);
      const costUsd = (p.costPriceUSD !== undefined && p.costPriceUSD > 0) ? p.costPriceUSD : (p.costPrice || 0);
      const costEtb = (p.costPriceETB !== undefined && p.costPriceETB > 0) ? p.costPriceETB : (costUsd * (p.registeredCostRate || rate));
      const sellUsd = p.sellPrice || 0;
      const sellEtb = sellUsd * rate;

      setCostUsdInput(costUsd.toString());
      setCostEtbInput(costEtb.toFixed(2));
      setSellUsdInput(sellUsd.toString());
      setSellEtbInput(sellEtb.toFixed(2));
    } else {
      setEditingProduct(null);
      setFormData({
        name: '', sku: '', barcode: '', costPrice: 0, sellPrice: 0, stock: 0, minStock: 5, category: 'General', image: '', expiryDate: '', unit: 'PCS'
      });
      setCostUsdInput('0');
      setCostEtbInput('0');
      setSellUsdInput('0');
      setSellEtbInput('0');
    }
    setIsAddingNewCategory(false);
    setCustomCategoryName('');
    setShowModal(true);
  };

  // Dual currency handlers for Cost Price - preserves fixed recorded cost
  const handleCostUsdChange = (valStr: string) => {
    setCostUsdInput(valStr);
    const num = parseFloat(valStr) || 0;
    const etb = num * rate;
    setCostEtbInput(etb ? etb.toFixed(2) : '0');
    setFormData(prev => ({ 
      ...prev, 
      costPrice: num,
      costPriceUSD: num,
      costPriceETB: etb,
      registeredCostRate: rate
    }));
  };

  const handleCostEtbChange = (valStr: string) => {
    setCostEtbInput(valStr);
    const numEtb = parseFloat(valStr) || 0;
    const usd = rate > 0 ? numEtb / rate : 0;
    setCostUsdInput(usd ? usd.toFixed(2) : '0');
    setFormData(prev => ({ 
      ...prev, 
      costPrice: usd,
      costPriceUSD: usd,
      costPriceETB: numEtb,
      registeredCostRate: rate
    }));
  };

  // Dual currency handlers for Sell Price
  const handleSellUsdChange = (valStr: string) => {
    setSellUsdInput(valStr);
    const num = parseFloat(valStr) || 0;
    const etb = num * rate;
    setSellEtbInput(etb ? etb.toFixed(2) : '0');
    setFormData(prev => ({ ...prev, sellPrice: num }));
  };

  const handleSellEtbChange = (valStr: string) => {
    setSellEtbInput(valStr);
    const numEtb = parseFloat(valStr) || 0;
    const usd = rate > 0 ? numEtb / rate : 0;
    setSellUsdInput(usd ? usd.toFixed(2) : '0');
    setFormData(prev => ({ ...prev, sellPrice: usd }));
  };

  const handleImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const base64 = await compressImage(file);
      setFormData({ ...formData, image: base64 });
    }
  };

  const saveProduct = () => {
    if (!formData.name || formData.sellPrice === undefined) return;

    let finalCategory = formData.category || 'General';
    if (isAddingNewCategory && customCategoryName.trim()) {
      finalCategory = customCategoryName.trim();
    }

    const finalCostUsd = parseFloat(costUsdInput) || formData.costPrice || 0;
    const finalCostEtb = parseFloat(costEtbInput) || (finalCostUsd * rate);

    const finalProductData: Product = {
      id: editingProduct ? editingProduct.id : generateId(),
      name: formData.name || '',
      sku: formData.sku || '',
      barcode: formData.barcode || '',
      costPrice: finalCostUsd,
      costPriceUSD: finalCostUsd,
      costPriceETB: finalCostEtb,
      registeredCostRate: editingProduct?.registeredCostRate || rate,
      sellPrice: formData.sellPrice || 0,
      stock: formData.stock || 0,
      minStock: formData.minStock !== undefined ? formData.minStock : 5,
      category: finalCategory,
      image: formData.image || '',
      expiryDate: formData.expiryDate || '',
      unit: formData.unit || 'PCS',
      createdAt: editingProduct?.createdAt || Date.now()
    };

    if (editingProduct) {
      setData(prev => ({
        ...prev,
        products: prev.products.map(p => p.id === editingProduct.id ? finalProductData : p)
      }));
      addLog('Edit Product', `Updated product: ${finalProductData.name}`);
    } else {
      setData(prev => ({ ...prev, products: [...prev.products, finalProductData] }));
      addLog('Add Product', `Created product: ${finalProductData.name}`);
    }
    closeModal();
  };

  const deleteProduct = (id: string, name: string) => {
    if (isCashier) {
      alert("Ogolaansho ma haysatid inaad tirto alaabta (Cashier cannot delete products). Fadlan la xiriir Admin ama Manager.");
      return;
    }
    setDeleteConfirmItem({ id, name });
  };

  const closeModal = () => {
    setShowModal(false);
    setEditingProduct(null);
  };

  // Filter products by Search, Category, and Smart Quick Filter
  const filteredProducts = useMemo(() => {
    const today = new Date();

    return data.products.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(search.toLowerCase()) || 
        p.sku.toLowerCase().includes(search.toLowerCase()) ||
        p.barcode.toLowerCase().includes(search.toLowerCase());

      const matchesCategory = selectedCategoryFilter === 'ALL' || p.category === selectedCategoryFilter;

      if (!matchesSearch || !matchesCategory) return false;

      // Smart Quick Filter
      if (activeQuickFilter === 'UNSOLD_30') {
        const salesLast30Days = product30DaySales[p.id] || 0;
        const daysUnsold = getProductUnsoldDays(p);
        return salesLast30Days === 0 && daysUnsold >= 30 && p.stock > 0;
      }

      if (activeQuickFilter === 'EXPIRING_30') {
        if (!p.expiryDate) return false;
        const expiry = new Date(p.expiryDate);
        const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays <= 90;
      }

      if (activeQuickFilter === 'LOW_STOCK') {
        return p.stock <= (p.minStock ?? 5);
      }

      if (activeQuickFilter === 'LOW_PROFIT') {
        return (p.sellPrice - p.costPrice) <= 0.52631579;
      }

      return true;
    });
  }, [data.products, search, selectedCategoryFilter, activeQuickFilter, product30DaySales, productLastSaleMap]);

  const getExpiryStatus = (date?: string) => {
    if (!date) return { label: 'No Expiry', color: 'bg-slate-100 text-slate-500' };
    const expiry = new Date(date);
    const today = new Date();
    const diffDays = Math.ceil((expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: 'DHACDAY (EXPIRED)', color: 'bg-rose-100 text-rose-700 font-bold', alert: true };
    if (diffDays <= 90) return { label: `⚠️ ${diffDays}d Left (90d Alert)`, color: 'bg-amber-100 text-amber-800 font-bold', alert: true };
    return { label: expiry.toLocaleDateString(), color: 'bg-emerald-50 text-emerald-600' };
  };

  const exportToExcelCSV = () => {
    const headers = ['Name', 'SKU', 'Barcode', 'Cost Price ($)', 'Cost Price (ETB)', 'Sell Price ($)', 'Sell Price (ETB)', 'Stock', 'Category', 'Expiry Date'];
    const rows = data.products.map(p => [
      `"${p.name.replace(/"/g, '""')}"`,
      `"${(p.sku || '').replace(/"/g, '""')}"`,
      `"${(p.barcode || '').replace(/"/g, '""')}"`,
      p.costPrice,
      (p.costPrice * rate).toFixed(2),
      p.sellPrice,
      (p.sellPrice * rate).toFixed(2),
      p.stock,
      `"${(p.category || '').replace(/"/g, '""')}"`,
      p.expiryDate || ''
    ]);

    const csvContent = "\uFEFF" + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `inventory_export_${new Date().toISOString().split('T')[0]}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    addLog('Export Products', 'Exported product catalog to Excel/CSV');
  };

  const downloadTemplate = () => {
    const headers = ['Name', 'SKU', 'Barcode', 'Cost Price', 'Sell Price', 'Stock', 'Category', 'Expiry Date'];
    const sample = ['Example Product', 'SKU123', '12345678', '10.50', '25.00', '100', 'Electronics', '2025-12-31'];
    const csvContent = "\uFEFF" + [headers.join(','), sample.join(',')].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `inventory_import_template.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = (event.target?.result as string || '').trim();
      if (!text) return alert("Faylku waa eber.");

      // Automatic JSON detection
      if (file.name.toLowerCase().endsWith('.json') || text.startsWith('{') || text.startsWith('[') || text.includes('"products"')) {
        const parsedRes = parseAndValidateBackupJSON(text, data);
        if (parsedRes.success) {
          const productsList = parsedRes.products || parsedRes.appData?.products || [];
          if (productsList.length > 0) {
            setData(prev => {
              return { ...prev, products: productsList, lastModified: Date.now() };
            });
            addLog('Import JSON Products', `Imported ${productsList.length} items from JSON (Previous catalog replaced)`);
            alert(`✅ Si guul leh ayaa loo galiyay ${productsList.length} alaab ah! Alaabtii hore waa la beddelay waxaana la xafiday alaabta cusub.`);
            return;
          }
        } else {
          alert(`❌ Cillad JSON: ${parsedRes.errorMessage || 'Faylka lama furi karo'}`);
          return;
        }
      }

      // CSV Fallback
      const lines = text.split(/\r?\n/).filter(line => line.trim().length > 0);
      if (lines.length < 2) return alert("Empty or invalid file.");

      const headers = lines[0].toLowerCase().split(',').map(h => h.replace(/^"|"$/g, '').trim());
      
      const nameIdx = headers.findIndex(h => h.includes('name'));
      const skuIdx = headers.findIndex(h => h.includes('sku'));
      const barcodeIdx = headers.findIndex(h => h.includes('barcode'));
      const costIdx = headers.findIndex(h => h.includes('cost'));
      const sellIdx = headers.findIndex(h => h.includes('sell') || h.includes('price'));
      const stockIdx = headers.findIndex(h => h.includes('stock') || h.includes('qty'));
      const categoryIdx = headers.findIndex(h => h.includes('category'));
      const expiryIdx = headers.findIndex(h => h.includes('expiry') || h.includes('date'));
      const unitIdx = headers.findIndex(h => h.includes('unit'));

      if (nameIdx === -1) return alert("Required column 'Name' not found.");

      const newProducts: Product[] = [];
      for (let i = 1; i < lines.length; i++) {
        const parts = lines[i].split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(s => s.replace(/^"|"$/g, '').trim());
        newProducts.push({
          id: generateId(),
          name: parts[nameIdx] || 'Imported Item',
          sku: skuIdx !== -1 ? parts[skuIdx] : '',
          barcode: barcodeIdx !== -1 ? parts[barcodeIdx] : '',
          costPrice: costIdx !== -1 ? parseFloat(parts[costIdx]) || 0 : 0,
          sellPrice: sellIdx !== -1 ? parseFloat(parts[sellIdx]) || 0 : 0,
          stock: stockIdx !== -1 ? parseFloat(parts[stockIdx]) || 0 : 0,
          category: categoryIdx !== -1 ? parts[categoryIdx] : 'General',
          expiryDate: expiryIdx !== -1 ? parts[expiryIdx] : '',
          unit: (unitIdx !== -1 && parts[unitIdx]?.toUpperCase() === 'KG') ? 'KG' : 'PCS',
          image: '',
          createdAt: Date.now()
        });
      }

      setData(prev => ({ ...prev, products: [...prev.products, ...newProducts] }));
      addLog('Import Products', `Imported ${newProducts.length} items from CSV`);
      alert(`Imported ${newProducts.length} products successfully.`);
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-full overflow-x-hidden">
      {/* Print Catalog Layout */}
      <div className="hidden print:block">
         <div className="text-center border-b-4 border-slate-900 pb-6 mb-8">
            <h1 className="text-4xl font-black uppercase tracking-tighter">{data.settings.businessName}</h1>
            <p className="text-sm font-bold text-slate-500 uppercase tracking-widest mt-2">Official Inventory Report • {new Date().toLocaleDateString()}</p>
         </div>
         <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b-2 border-slate-900">
                <th className="py-2 text-xs font-black uppercase">Product Name</th>
                <th className="py-2 text-xs font-black uppercase">SKU / Barcode</th>
                <th className="py-2 text-xs font-black uppercase">Category</th>
                <th className="py-2 text-xs font-black uppercase text-right">Selling Price</th>
                <th className="py-2 text-xs font-black uppercase text-right">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredProducts.map(p => (
                <tr key={p.id}>
                  <td className="py-3 font-bold">{p.name}</td>
                  <td className="py-3 text-xs text-slate-600">{p.sku} {p.barcode ? `(${p.barcode})` : ''}</td>
                  <td className="py-3 text-xs">{p.category}</td>
                  <td className="py-3 text-right font-black">{formatCurrency(p.sellPrice, currency, rate)}</td>
                  <td className="py-3 text-right font-bold">{p.stock}</td>
                </tr>
              ))}
            </tbody>
         </table>
      </div>

      {/* Main UI */}
      <div className="no-print space-y-6">
        {/* Dead Stock Alert Banner */}
        {unsold30Products.length > 0 && (
          <div className="bg-amber-500/10 border-2 border-amber-500/30 p-4 sm:p-5 rounded-3xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-in fade-in duration-300">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-amber-500/20 text-amber-600 rounded-2xl flex items-center justify-center flex-shrink-0">
                <Flame size={24} />
              </div>
              <div>
                <h4 className="font-black text-amber-900 text-sm sm:text-base flex items-center gap-2">
                  Dead Stock Warning (1 Bil Aan Socon - 30+ Days Unsold)
                </h4>
                <p className="text-xs text-amber-800 font-medium">
                  There are <span className="font-black">{unsold30Products.length} items</span> with zero sales in the last 30 days. Capital tied up: <span className="font-black font-mono">{formatCurrency(deadStockCapital, currency, rate)}</span>.
                </p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={handlePrintDeadStock}
                className="px-4 py-2.5 bg-amber-600 text-white hover:bg-amber-700 rounded-2xl font-black text-xs transition-all flex items-center gap-2 shadow-sm"
                title="Daabac warbixinta alaabta aan la iibsan 30 maalmood"
              >
                <Printer size={14} />
                <span>Daabac Dead Stock</span>
              </button>
              <button
                onClick={handleResetUnsoldCounter}
                className="px-4 py-2.5 bg-slate-900 text-white hover:bg-slate-800 rounded-2xl font-black text-xs transition-all flex items-center gap-2 shadow-sm"
                title="Bilaab tirinta maanta (0 maalmood)"
              >
                <Sparkles size={14} className="text-amber-400" />
                <span>Ka Bilow Maanta (0 Days)</span>
              </button>
              <button
                onClick={() => setActiveQuickFilter(activeQuickFilter === 'UNSOLD_30' ? 'ALL' : 'UNSOLD_30')}
                className={`px-4 py-2.5 rounded-2xl font-black text-xs transition-all flex items-center gap-2 whitespace-nowrap shadow-sm ${activeQuickFilter === 'UNSOLD_30' ? 'bg-amber-600 text-white' : 'bg-white text-amber-900 border border-amber-300 hover:bg-amber-100'}`}
              >
                <Filter size={14} />
                {activeQuickFilter === 'UNSOLD_30' ? 'Show All Products' : 'View Dead Stock (30+ Days)'}
              </button>
            </div>
          </div>
        )}

        {/* Header Controls & Search Bar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
            <input 
              type="text" 
              placeholder="Search by name, SKU or barcode..." 
              className="w-full pl-12 pr-12 py-3 bg-white border rounded-2xl focus:ring-2 focus:ring-blue-500 outline-none shadow-sm font-bold text-sm"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <button 
              onClick={() => setIsSearchScannerOpen(true)}
              className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-slate-100 text-slate-600 hover:bg-blue-600 hover:text-white rounded-xl transition-all"
              title="Scan Barcode to Search"
            >
              <Camera size={18} />
            </button>
          </div>
          
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleResetUnsoldCounter}
              className="px-4 py-3 bg-amber-100 text-amber-900 border border-amber-300 rounded-2xl text-xs font-black hover:bg-amber-200 transition-all shadow-sm flex items-center gap-2"
              title="Set unsold tracker to start fresh from 0 today"
            >
              <Sparkles size={16} className="text-amber-600" />
              Reset Unsold to Today
            </button>

            <button
              onClick={() => setActiveQuickFilter(activeQuickFilter === 'UNSOLD_30' ? 'ALL' : 'UNSOLD_30')}
              className={`px-4 py-3 rounded-2xl text-xs font-black transition-all flex items-center gap-2 shadow-sm ${activeQuickFilter === 'UNSOLD_30' ? 'bg-amber-600 text-white' : 'bg-amber-50 text-amber-800 border border-amber-200 hover:bg-amber-100'}`}
            >
              <Flame size={16} />
              1 Bil Aan Socon ({unsold30Products.length})
            </button>

            <div className="bg-white border rounded-2xl p-1 flex gap-1 shadow-sm">
              <button onClick={exportToExcelCSV} className="p-2.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-xl transition-all flex items-center gap-2 px-3" title="Export Excel">
                <FileSpreadsheet size={18} />
                <span className="text-[10px] font-black uppercase">Export</span>
              </button>
              <button onClick={() => importInputRef.current?.click()} className="p-2.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all flex items-center gap-2 px-3" title="Import CSV or JSON">
                <Upload size={18} />
                <span className="text-[10px] font-black uppercase">Import</span>
                <input type="file" ref={importInputRef} className="hidden" accept=".csv,.json" onChange={handleImportFile} />
              </button>
              <button onClick={downloadTemplate} className="p-2.5 text-slate-400 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all" title="Download Template">
                <Download size={18} />
              </button>
            </div>

            <button onClick={() => window.print()} className="px-4 py-3 bg-slate-100 text-slate-700 rounded-2xl text-xs font-black hover:bg-slate-200 transition-all shadow-sm flex items-center gap-2">
              <Printer size={18} /> Print
            </button>

            <button onClick={() => openAddOrEditModal()} className="px-6 py-3 bg-blue-600 text-white rounded-2xl text-xs font-black hover:bg-blue-700 transition-all shadow-lg flex items-center gap-2">
              <Plus size={18} /> Add Product
            </button>
          </div>
        </div>

        {/* Smart Quick Filters Bar (Kuli, 1 Bil Aan Socon, Dhowaan Dhacaya, Kuwa Sii Dhamanaya) */}
        <div className="bg-slate-900 text-white p-2.5 rounded-[28px] flex flex-wrap items-center gap-2 shadow-xl border border-slate-800">
          <button
            onClick={() => setActiveQuickFilter('ALL')}
            className={`flex-1 min-w-[140px] py-3.5 px-4 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2.5 ${activeQuickFilter === 'ALL' ? 'bg-blue-600 text-white shadow-lg shadow-blue-600/30 scale-[1.02]' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'}`}
          >
            <Package size={18} />
            <span>Kuli / All ({data.products.length})</span>
          </button>

          <button
            onClick={() => setActiveQuickFilter('UNSOLD_30')}
            className={`flex-1 min-w-[160px] py-3.5 px-4 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2.5 ${activeQuickFilter === 'UNSOLD_30' ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/30 scale-[1.02]' : 'bg-slate-800 text-amber-400 hover:bg-slate-700'}`}
          >
            <Flame size={18} />
            <span>1 Bil Aan Socon ({unsold30Products.length})</span>
          </button>

          <button
            onClick={() => setActiveQuickFilter('EXPIRING_30')}
            className={`flex-1 min-w-[160px] py-3.5 px-4 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2.5 ${activeQuickFilter === 'EXPIRING_30' ? 'bg-rose-600 text-white shadow-lg shadow-rose-600/30 scale-[1.02]' : 'bg-slate-800 text-rose-400 hover:bg-slate-700'}`}
          >
            <Calendar size={18} />
            <span>Dhowaan Dhacaya ({expiringProducts.length})</span>
          </button>

          <button
            onClick={() => setActiveQuickFilter('LOW_STOCK')}
            className={`flex-1 min-w-[160px] py-3.5 px-4 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2.5 ${activeQuickFilter === 'LOW_STOCK' ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30 scale-[1.02]' : 'bg-slate-800 text-orange-400 hover:bg-slate-700'}`}
          >
            <TrendingDown size={18} />
            <span>Kuwa Sii Dhamanaya ({lowStockProducts.length})</span>
          </button>

          <button
            onClick={() => setActiveQuickFilter('LOW_PROFIT')}
            className={`flex-1 min-w-[160px] py-3.5 px-4 rounded-2xl font-black text-xs transition-all flex items-center justify-center gap-2.5 ${activeQuickFilter === 'LOW_PROFIT' ? 'bg-purple-600 text-white shadow-lg shadow-purple-600/30 scale-[1.02]' : 'bg-slate-800 text-purple-300 hover:bg-slate-700'}`}
          >
            <Tag size={18} />
            <span>Faa'iidada Yar (≤100 ETB / $0.52) ({lowProfitProducts.length})</span>
          </button>
        </div>

        {/* Category Horizontal Filter Pills & Delete Category Button */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-100 shadow-sm">
          <div className="flex items-center gap-2 overflow-x-auto scrollbar-none max-w-full py-1">
            <div className="flex items-center gap-1.5 text-slate-400 text-xs font-black uppercase tracking-wider pr-2 flex-shrink-0">
              <Layers size={14} /> Categories:
            </div>
            <button
              onClick={() => setSelectedCategoryFilter('ALL')}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex-shrink-0 whitespace-nowrap ${selectedCategoryFilter === 'ALL' ? 'bg-slate-900 text-white shadow-md' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
            >
              All Categories ({data.products.length})
            </button>
            {availableCategories.map(cat => {
              const count = data.products.filter(p => p.category === cat).length;
              return (
                <button
                  key={cat}
                  onClick={() => setSelectedCategoryFilter(cat)}
                  className={`px-4 py-2 rounded-xl text-xs font-black transition-all flex-shrink-0 whitespace-nowrap ${selectedCategoryFilter === cat ? 'bg-blue-600 text-white shadow-md' : 'bg-slate-50 border border-slate-200 text-slate-600 hover:bg-slate-100'}`}
                >
                  {cat} ({count})
                </button>
              );
            })}
          </div>

          {!isCashier && (
            <button
              onClick={() => setShowCategoryManager(true)}
              className="px-4 py-2.5 bg-red-50 text-red-600 hover:bg-red-100 border border-red-200 rounded-xl text-xs font-black transition-all flex items-center gap-2 flex-shrink-0 shadow-sm"
              title="Manage or Delete Categories"
            >
              <Trash2 size={14} />
              <span>Tir Categories</span>
            </button>
          )}
        </div>

        {/* Scrollable Products Table (Horizontal + Vertical) */}
        <div className="bg-white rounded-3xl shadow-sm border border-slate-100 overflow-x-auto overflow-y-auto max-w-full max-h-[70vh]">
          <table className="w-full text-left min-w-[900px] border-collapse">
            <thead className="bg-slate-50 border-b sticky top-0 z-10">
              <tr>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Product & Category</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Identity / Barcode</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Price (USD / ETB)</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">Stock & Unsold Days</th>
                <th className="px-6 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredProducts.map(p => {
                const expiryStatus = getExpiryStatus(p.expiryDate);
                const sales30Days = product30DaySales[p.id] || 0;
                const daysUnsold = getProductUnsoldDays(p);
                const isDeadStock = sales30Days === 0 && daysUnsold >= 30 && p.stock > 0;

                const displayCostUsd = (p.costPriceUSD !== undefined && p.costPriceUSD > 0) ? p.costPriceUSD : p.costPrice;
                const displayCostEtb = (p.costPriceETB !== undefined && p.costPriceETB > 0) 
                  ? p.costPriceETB 
                  : (displayCostUsd * (p.registeredCostRate || rate || 190));
                const sellEtb = p.sellPrice * rate;

                return (
                  <tr key={p.id} className={`hover:bg-slate-50 transition-colors group ${isDeadStock ? 'bg-amber-500/5' : ''}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-slate-100 flex-shrink-0 flex items-center justify-center overflow-hidden border">
                          {p.image ? <img src={p.image} className="w-full h-full object-cover" /> : <Package className="text-slate-300" size={20} />}
                        </div>
                        <div>
                          <p className="font-bold text-slate-900">{p.name}</p>
                          <div className="flex flex-wrap items-center gap-1.5 mt-0.5">
                            <span className="text-[10px] px-2 py-0.5 bg-slate-100 text-slate-600 rounded font-black uppercase">{p.category}</span>
                            <span className={`text-[10px] px-2 py-0.5 rounded font-black uppercase ${p.unit === 'KG' ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'}`}>
                              {p.unit || 'PCS'}
                            </span>
                            {isDeadStock && (
                              <span className="text-[9px] px-2 py-0.5 bg-amber-500 text-slate-950 font-black rounded uppercase flex items-center gap-1">
                                <Flame size={10} /> 1 Bil Aan Socon ({daysUnsold}d)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <p className="text-sm font-bold text-slate-700">{p.sku || '-'}</p>
                      <p className="text-[10px] text-slate-400 font-mono tracking-tighter">{p.barcode || '-'}</p>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-black text-blue-600">${p.sellPrice.toFixed(2)}</span>
                          <span className="text-xs font-bold text-slate-400">({sellEtb.toFixed(0)} ETB)</span>
                        </div>
                        <div className="text-[10px] text-slate-400 font-semibold" title="Cost-ka diiwaangashan marna iskama bedelo sarifka">
                          Cost: ${displayCostUsd.toFixed(2)} ({displayCostEtb.toFixed(0)} ETB)
                        </div>
                        <div className={`flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-[10px] font-black uppercase w-fit ${expiryStatus.color}`}>
                           {expiryStatus.alert ? <AlertTriangle size={10} /> : <Calendar size={10} />}
                           {expiryStatus.label}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="space-y-1 flex flex-col items-center">
                        <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight ${p.stock < 10 ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-700'}`}>
                          {p.stock} {p.unit || 'PCS'}
                        </span>
                        <p className="text-[10px] font-bold text-slate-400">
                          30-Day Sales: <span className={sales30Days === 0 ? 'text-amber-600 font-black' : 'text-slate-700 font-black'}>{sales30Days} sold</span>
                        </p>
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-lg font-black uppercase tracking-tight ${daysUnsold >= 30 ? 'bg-amber-500 text-slate-950 shadow-sm' : 'bg-slate-100 text-slate-600'}`}>
                          🗓️ {daysUnsold} Maalmood Aan La Iibsan
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openAddOrEditModal(p)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl" title="Wax ka beddel">
                          <Edit2 size={16} />
                        </button>
                        {!isCashier && (
                          <button onClick={() => deleteProduct(p.id, p.name)} className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-xl" title="Tirtir Alaabta">
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {filteredProducts.length === 0 && (
            <div className="py-20 text-center flex flex-col items-center justify-center opacity-40 space-y-2">
               <Package size={48} className="text-slate-300" />
               <p className="text-xs font-black uppercase tracking-widest text-slate-500">No products match your criteria</p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Product Modal with Dual Currency Input & Category Manager */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm no-print">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-2xl overflow-hidden animate-in zoom-in duration-300">
            <div className="px-6 sm:px-8 py-5 border-b flex items-center justify-between bg-slate-50">
              <h3 className="text-xl sm:text-2xl font-black text-slate-800 tracking-tight">{editingProduct ? 'Edit Product' : 'Add New Item'}</h3>
              <button onClick={closeModal} className="p-2 hover:bg-slate-200 rounded-full text-slate-400">
                <LucideX size={22} />
              </button>
            </div>

            <div className="p-6 sm:p-8 grid grid-cols-1 md:grid-cols-2 gap-5 max-h-[75vh] overflow-y-auto">
              {/* Product Photo */}
              <div className="md:col-span-2 flex flex-col items-center gap-3 py-5 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 relative group">
                {formData.image ? (
                  <div className="relative">
                    <img src={formData.image} alt="Preview" className="w-28 h-28 object-cover rounded-3xl" />
                    <button onClick={() => setFormData({...formData, image: ''})} className="absolute -top-3 -right-3 bg-red-500 text-white p-1.5 rounded-full"><LucideX size={14} /></button>
                  </div>
                ) : (
                  <div className="flex flex-col items-center">
                    <Camera className="text-slate-300 mb-1.5" size={36} />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Upload Product Photo</p>
                  </div>
                )}
                <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImage} className="absolute inset-0 opacity-0 cursor-pointer" />
              </div>

              {/* Name & SKU */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Product Name *</label>
                <input type="text" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-4 py-3.5 bg-slate-100 border-none rounded-2xl outline-none font-bold text-sm" placeholder="e.g. Milk 1L" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">SKU Code</label>
                <input type="text" value={formData.sku} onChange={e => setFormData({...formData, sku: e.target.value})} className="w-full px-4 py-3.5 bg-slate-100 border-none rounded-2xl outline-none font-bold text-sm" placeholder="SKU-101" />
              </div>

              {/* Category Selector with Dynamic "+ Add Category" Option */}
              <div className="md:col-span-2 space-y-1.5 bg-blue-50/50 p-4 rounded-3xl border border-blue-100">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black text-blue-900 uppercase tracking-widest px-1 flex items-center gap-1.5">
                    <Tag size={12} className="text-blue-600" /> Category (Qeybta Alaabta)
                  </label>
                  <button
                    type="button"
                    onClick={() => setIsAddingNewCategory(!isAddingNewCategory)}
                    className="text-[10px] font-black text-blue-600 hover:underline uppercase"
                  >
                    {isAddingNewCategory ? '← Choose Existing' : '+ Add New Category'}
                  </button>
                </div>

                {isAddingNewCategory ? (
                  <input
                    type="text"
                    value={customCategoryName}
                    onChange={e => setCustomCategoryName(e.target.value)}
                    placeholder="Enter new category name..."
                    className="w-full px-4 py-3 bg-white border border-blue-200 rounded-2xl outline-none font-bold text-sm"
                  />
                ) : (
                  <select
                    value={formData.category || 'General'}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    className="w-full px-4 py-3 bg-white border border-blue-200 rounded-2xl outline-none font-bold text-sm"
                  >
                    {availableCategories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* DUAL CURRENCY COST PRICE (USD + ETB) */}
              <div className="md:col-span-2 bg-slate-50 p-4 rounded-3xl border border-slate-200 space-y-2">
                <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center justify-between">
                  <span>Cost Price (Qiimaha aad ku soo iibsatay)</span>
                  <span className="text-[9px] text-blue-600 font-bold">Exchange Rate: 1 USD = {rate} ETB</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase">In USD ($)</span>
                    <input 
                      type="number" 
                      step="any"
                      value={costUsdInput} 
                      onChange={e => handleCostUsdChange(e.target.value)} 
                      className="w-full px-4 py-3 bg-white border rounded-2xl outline-none font-black text-slate-800 text-sm" 
                    />
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-slate-400 uppercase">In ETB (Birr)</span>
                    <input 
                      type="number" 
                      step="any"
                      value={costEtbInput} 
                      onChange={e => handleCostEtbChange(e.target.value)} 
                      className="w-full px-4 py-3 bg-white border rounded-2xl outline-none font-black text-emerald-700 text-sm" 
                    />
                  </div>
                </div>
              </div>

              {/* DUAL CURRENCY SELL PRICE (USD + ETB) */}
              <div className="md:col-span-2 bg-blue-50/60 p-4 rounded-3xl border border-blue-200 space-y-2">
                <label className="text-[10px] font-black text-blue-900 uppercase tracking-widest flex items-center justify-between">
                  <span>Selling Price (Qiimaha Iibka) *</span>
                  <span className="text-[9px] text-blue-600 font-bold">Auto-Converts Both</span>
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <span className="text-[9px] font-black text-blue-800 uppercase">In USD ($)</span>
                    <input 
                      type="number" 
                      step="any"
                      value={sellUsdInput} 
                      onChange={e => handleSellUsdChange(e.target.value)} 
                      className="w-full px-4 py-3 bg-white border border-blue-300 rounded-2xl outline-none font-black text-blue-600 text-sm" 
                    />
                  </div>
                  <div>
                    <span className="text-[9px] font-black text-blue-800 uppercase">In ETB (Birr)</span>
                    <input 
                      type="number" 
                      step="any"
                      value={sellEtbInput} 
                      onChange={e => handleSellEtbChange(e.target.value)} 
                      className="w-full px-4 py-3 bg-white border border-blue-300 rounded-2xl outline-none font-black text-blue-700 text-sm" 
                    />
                  </div>
                </div>
              </div>

              {/* Stock & Low Stock Threshold */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Current Stock Quantity</label>
                <input type="number" step="any" value={formData.stock} onChange={e => setFormData({...formData, stock: parseFloat(e.target.value) || 0})} className="w-full px-4 py-3.5 bg-slate-100 border-none rounded-2xl outline-none font-bold text-sm" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Low Stock Warning Level</label>
                <input type="number" step="any" value={formData.minStock ?? 5} onChange={e => setFormData({...formData, minStock: parseFloat(e.target.value) || 0})} className="w-full px-4 py-3.5 bg-slate-100 border-none rounded-2xl outline-none font-bold text-amber-600 text-sm" />
              </div>

              {/* Expiry Date & Unit */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Expiry Date</label>
                <input type="date" value={formData.expiryDate} onChange={e => setFormData({...formData, expiryDate: e.target.value})} className="w-full px-4 py-3.5 bg-slate-100 border-none rounded-2xl outline-none font-bold text-sm" />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Unit Type</label>
                <select value={formData.unit || 'PCS'} onChange={e => setFormData({...formData, unit: e.target.value as 'PCS' | 'KG'})} className="w-full px-4 py-3.5 bg-slate-100 border-none rounded-2xl outline-none font-bold text-sm">
                  <option value="PCS">Piece (PCS)</option>
                  <option value="KG">Kilogram (KG)</option>
                </select>
              </div>

              {/* Barcode Scanner Input */}
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Barcode / EAN</label>
                <div className="relative">
                  <input type="text" value={formData.barcode || ''} onChange={e => setFormData({...formData, barcode: e.target.value})} className="w-full px-4 py-3.5 bg-slate-100 border-none rounded-2xl outline-none font-bold text-sm pr-24" placeholder="Scan or type barcode" />
                  <button 
                    onClick={(e) => { e.preventDefault(); setIsFormScannerOpen(true); }}
                    className="absolute right-2 top-1/2 -translate-y-1/2 px-3 py-2 bg-blue-600 text-white hover:bg-blue-700 rounded-xl transition-all flex items-center gap-1.5 shadow-md shadow-blue-600/10 active:scale-95"
                    title="Scan Barcode"
                  >
                    <Camera size={14} />
                    <span className="text-[9px] font-black uppercase tracking-wider">Scan</span>
                  </button>
                </div>
              </div>

              <div className="md:col-span-2 pt-4 flex gap-3">
                <button onClick={closeModal} className="flex-1 font-bold text-slate-400 py-3.5">Cancel</button>
                <button onClick={saveProduct} className="flex-[2] py-3.5 bg-blue-600 text-white rounded-2xl font-black shadow-lg hover:bg-blue-700 text-sm">
                  {editingProduct ? 'Save Changes' : 'Create Product'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Search Barcode Scanner Overlay */}
      {isSearchScannerOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Camera size={24} className="text-blue-400" />
                <h3 className="text-lg font-black uppercase tracking-tight">Search Barcode Scanner</h3>
              </div>
              <button onClick={() => setIsSearchScannerOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                <LucideX size={24} />
              </button>
            </div>
            <div className="p-6">
              <div id="search-reader" className="overflow-hidden rounded-3xl border-4 border-slate-100"></div>
              <p className="mt-4 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                Scan a product's barcode to filter the catalog list
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Category Manager Modal (Tir Categories) */}
      {showCategoryManager && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Settings2 size={24} className="text-blue-400" />
                <h3 className="text-lg font-black uppercase tracking-tight">Manage & Delete Categories</h3>
              </div>
              <button onClick={() => setShowCategoryManager(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                <LucideX size={22} />
              </button>
            </div>

            <div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto">
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Kala dooro category-ga aad rabto inaad tirto. Alaabta ku jirtay waxaa looga wareejin doonaa qeybta <span className="font-bold text-slate-800">"General"</span>.
              </p>

              <div className="divide-y border rounded-3xl overflow-hidden bg-slate-50">
                {availableCategories.map(cat => {
                  const count = data.products.filter(p => p.category === cat).length;
                  const isGeneral = cat === 'General';

                  return (
                    <div key={cat} className="p-4 flex items-center justify-between hover:bg-white transition-colors">
                      <div>
                        <p className="font-black text-slate-800 text-sm">{cat}</p>
                        <p className="text-[11px] font-semibold text-slate-400">{count} products assigned</p>
                      </div>

                      {!isGeneral ? (
                        <button
                          onClick={() => handleDeleteCategory(cat)}
                          className="px-3.5 py-2 bg-red-100 text-red-600 hover:bg-red-600 hover:text-white rounded-xl text-xs font-black flex items-center gap-1.5 transition-all shadow-sm"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      ) : (
                        <span className="text-[10px] font-black uppercase text-slate-400 bg-slate-200 px-3 py-1 rounded-full">System Default</span>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="p-6 bg-slate-50 border-t flex justify-end">
              <button
                onClick={() => setShowCategoryManager(false)}
                className="w-full py-3.5 bg-slate-900 text-white font-black text-xs rounded-2xl shadow-md hover:bg-slate-800 transition-all"
              >
                Finished / Waad Mahadsan Tahay
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form Barcode Scanner Overlay */}
      {isFormScannerOpen && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-md">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden animate-in zoom-in duration-300">
            <div className="p-6 bg-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Camera size={24} className="text-blue-400" />
                <h3 className="text-lg font-black uppercase tracking-tight">Product Barcode Scanner</h3>
              </div>
              <button onClick={() => setIsFormScannerOpen(false)} className="p-2 hover:bg-white/10 rounded-xl transition-all">
                <LucideX size={24} />
              </button>
            </div>
            <div className="p-6">
              <div id="form-reader" className="overflow-hidden rounded-3xl border-4 border-slate-100"></div>
              <p className="mt-4 text-center text-xs font-bold text-slate-400 uppercase tracking-widest">
                Scan product barcode to fill the Barcode input field
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmModal
        isOpen={!!deleteConfirmItem}
        title="Ma hubtaa? (Are you sure?)"
        message={`Ma hubtaa inaad tirtirto alaabta: "${deleteConfirmItem?.name}"? Tallaabadan dib looma noqon karo.`}
        confirmText="Haa (Tirtir)"
        cancelText="Maya (Kansal)"
        onConfirm={() => {
          if (deleteConfirmItem) {
            const productToDelete = data.products.find(item => item.id === deleteConfirmItem.id);
            setData(prev => {
              let updatedBin = prev.recycleBin || [];
              const updatedDeletedIds = { ...(prev.deletedIds || {}) };
              if (productToDelete) {
                updatedDeletedIds[deleteConfirmItem.id] = Date.now();
                const binItem = {
                  id: generateId(),
                  type: 'PRODUCT' as const,
                  deletedAt: Date.now(),
                  title: productToDelete.name,
                  description: `SKU: ${productToDelete.sku || 'N/A'} • Stock: ${productToDelete.stock} ${productToDelete.unit || 'PCS'} • Cost: $${productToDelete.costPrice} • Price: $${productToDelete.sellPrice}`,
                  originalData: productToDelete
                };
                updatedBin = [binItem, ...updatedBin];
              }
              return {
                ...prev,
                products: prev.products.filter(item => item.id !== deleteConfirmItem.id),
                recycleBin: updatedBin,
                deletedIds: updatedDeletedIds
              };
            });
            addLog('Delete Product', `Moved product to Recycle Bin: ${deleteConfirmItem.name}`);
            setDeleteConfirmItem(null);
          }
        }}
        onClose={() => setDeleteConfirmItem(null)}
      />
    </div>
  );
};

export default Products;

