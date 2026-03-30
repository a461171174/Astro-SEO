import React, { useState, useEffect, useRef } from 'react';
import { Collection, Product, ProductStatus, MediaItem } from '../types';
import { ICONS } from '../constants';
import { isAbortError } from '../utils';
import { motion, AnimatePresence } from 'motion/react';
import SEOSection from './SEOSection';
import { geminiService } from '../services/geminiService';
import { MediaLibrary } from './MediaLibrary';
import { mediaService } from '../services/mediaService';

interface CollectionEditorProps {
  collection?: Collection;
  products: Product[];
  brandName?: string;
  onSave: (collection: Collection) => void;
  onCancel: () => void;
}

const CollectionEditor: React.FC<CollectionEditorProps> = ({ collection: initialCollection, products, brandName = '', onSave, onCancel }) => {
  const [collection, setCollection] = useState<Partial<Collection>>(initialCollection || {
    title: '',
    description: '',
    productIds: [],
    template: 'Default Template',
    seoTitle: '',
    seoDescription: '',
    seoUrl: '',
  });

  const [showProductPicker, setShowProductPicker] = useState(false);
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('全部');
  const [filterVendor, setFilterVendor] = useState<string>('全部厂商');
  const [filterCategory, setFilterCategory] = useState<string>('全部类别');
  const [priceRange, setPriceRange] = useState({ min: '', max: '' });
  const [stockRange, setStockRange] = useState({ min: '', max: '' });
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track if SEO fields should auto-sync with title
  const [isSeoTitleAuto, setIsSeoTitleAuto] = useState(!initialCollection || !initialCollection.seoTitle);
  const [isSeoUrlAuto, setIsSeoUrlAuto] = useState(!initialCollection || !initialCollection.seoUrl);

  const vendors = Array.from(new Set(products.map(p => p.vendor).filter(Boolean))) as string[];
  const categories = Array.from(new Set(products.map(p => p.category).filter(Boolean))) as string[];

  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  };

  // SEO URL & Title auto-generation
  useEffect(() => {
    if (collection.title) {
      setCollection(prev => {
        const updates: Partial<Collection> = {};
        
        if (isSeoTitleAuto && prev.seoTitle !== prev.title) {
          updates.seoTitle = prev.title;
        }
        
        if (isSeoUrlAuto) {
          const newSlug = slugify(prev.title || '');
          if (prev.seoUrl !== newSlug) {
            updates.seoUrl = newSlug;
          }
        }

        if (Object.keys(updates).length > 0) {
          return { ...prev, ...updates };
        }
        return prev;
      });
    }
  }, [collection.title, isSeoTitleAuto, isSeoUrlAuto]);

  const handleGenerateSEODescription = async () => {
    if (!collection.title) {
      alert('请先输入标题');
      return;
    }
    setIsGeneratingDescription(true);
    try {
      const description = await geminiService.generateSEODescription(collection.title || '', collection.description || '', brandName);
      setCollection(prev => ({ ...prev, seoDescription: description }));
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Failed to generate SEO description:', error);
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const handleSave = () => {
    if (!collection.title) {
      alert('标题为必填项');
      return;
    }
    onSave({
      ...collection,
      id: collection.id || Date.now().toString(),
      createdAt: collection.createdAt || new Date().toISOString().split('T')[0],
      updatedAt: new Date().toISOString().split('T')[0],
    } as Collection);
  };

  const toggleProduct = (productId: string) => {
    const currentIds = collection.productIds || [];
    if (currentIds.includes(productId)) {
      setCollection({ ...collection, productIds: currentIds.filter(id => id !== productId) });
    } else {
      setCollection({ ...collection, productIds: [...currentIds, productId] });
    }
  };

  const handleMediaSelect = (items: MediaItem[]) => {
    if (items.length > 0) {
      setCollection({ ...collection, image: items[0].url });
    }
    setIsMediaLibraryOpen(false);
  };

  const handleDirectUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    try {
      const newItem = await mediaService.uploadFile(file);
      setCollection(prev => ({ ...prev, image: newItem.url }));
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Upload failed:', error);
      alert(`封面图上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const selectedProducts = products.filter(p => collection.productIds?.includes(p.id));
  const filteredProducts = products.filter(p => {
    const matchesSearch = p.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         p.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesStatus = filterStatus === '全部' || p.status === filterStatus;
    const matchesVendor = filterVendor === '全部厂商' || p.vendor === filterVendor;
    const matchesCategory = filterCategory === '全部类别' || p.category === filterCategory;
    
    const minPrice = priceRange.min ? parseFloat(priceRange.min) : -Infinity;
    const maxPrice = priceRange.max ? parseFloat(priceRange.max) : Infinity;
    const productPrice = p.variants[0]?.price || 0;
    const matchesPrice = productPrice >= minPrice && productPrice <= maxPrice;

    const totalStock = p.variants.reduce((s, v) => s + v.stock, 0);
    const minStock = stockRange.min ? parseInt(stockRange.min) : -Infinity;
    const maxStock = stockRange.max ? parseInt(stockRange.max) : Infinity;
    const matchesStock = totalStock >= minStock && totalStock <= maxStock;

    const productDate = new Date(p.createdAt).getTime();
    const startDate = dateRange.start ? new Date(dateRange.start).getTime() : -Infinity;
    const endDate = dateRange.end ? new Date(dateRange.end).getTime() : Infinity;
    const matchesDate = productDate >= startDate && productDate <= endDate;

    return matchesSearch && matchesStatus && matchesVendor && matchesCategory && matchesPrice && matchesStock && matchesDate;
  });

  return (
    <div className="max-w-[1200px] mx-auto pb-20 px-4 lg:px-0 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between sticky top-0 bg-[#F8F9FB]/80 backdrop-blur-md py-4 z-20">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={onCancel}>商品系列</span>
            <span>/</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">{initialCollection ? '编辑商品系列' : '创建商品系列'}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={onCancel}
            className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors"
          >
            取消
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/20"
          >
            保存
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">标题<span className="text-red-500">*</span></label>
              <input 
                type="text" 
                value={collection.title}
                onChange={(e) => setCollection({ ...collection, title: e.target.value })}
                placeholder="例如：夏季新品"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 text-sm transition-all"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">描述</label>
              <textarea 
                value={collection.description}
                onChange={(e) => setCollection({ ...collection, description: e.target.value })}
                placeholder="介绍这个系列的内容..."
                className="w-full h-32 px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 text-sm resize-none transition-all"
              />
            </div>
          </div>

          {/* Products Section */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-6">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">系列商品</h3>
              <button 
                onClick={() => setShowProductPicker(true)}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                <ICONS.Plus className="w-3 h-3" />
                添加商品
              </button>
            </div>

            <div className="space-y-4">
              {selectedProducts.length === 0 ? (
                <div className="py-12 border-2 border-dashed border-slate-100 rounded-xl flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <ICONS.Store className="w-8 h-8 opacity-20" />
                  <p className="text-xs">该系列暂无商品</p>
                </div>
              ) : (
                <div className="divide-y divide-slate-50">
                  {selectedProducts.map(p => (
                    <div key={p.id} className="py-3 flex items-center justify-between group">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded border border-slate-200 overflow-hidden bg-slate-50">
                          <img src={p.media[0]?.url} className="w-full h-full object-cover" alt="" />
                        </div>
                        <div>
                          <p className="text-sm font-medium text-slate-900">{p.title}</p>
                          <p className="text-[10px] text-slate-500">{p.status}</p>
                        </div>
                      </div>
                      <button 
                        onClick={() => toggleProduct(p.id)}
                        className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                      >
                        <ICONS.Trash className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* SEO Section */}
          <SEOSection 
            title={collection.title || ''}
            content={collection.description || ''}
            seoTitle={collection.seoTitle || ''}
            seoDescription={collection.seoDescription || ''}
            seoUrl={collection.seoUrl || ''}
            urlPrefix="/collections/"
            onUpdate={(updates) => setCollection(prev => ({ ...prev, ...updates }))}
            onManualTitleChange={() => setIsSeoTitleAuto(false)}
            onManualUrlChange={() => setIsSeoUrlAuto(false)}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Cover Image */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900">系列封面图</h3>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleDirectUpload} 
              accept="image/*" 
              className="hidden" 
            />
            <div 
              className="aspect-video rounded-xl border-2 border-dashed border-slate-200 overflow-hidden bg-slate-50 flex flex-col items-center justify-center group cursor-pointer hover:border-blue-400 transition-all"
            >
              {collection.image ? (
                <div className="relative w-full h-full">
                  <img src={collection.image} className="w-full h-full object-cover" alt="" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button 
                      onClick={() => setIsMediaLibraryOpen(true)}
                      className="p-2 bg-white rounded-full text-blue-600 shadow-sm hover:scale-110 transition-transform"
                    >
                      <ICONS.Image className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => fileInputRef.current?.click()}
                      className="p-2 bg-white rounded-full text-green-600 shadow-sm hover:scale-110 transition-transform"
                    >
                      <ICONS.Upload className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setCollection({ ...collection, image: '' });
                      }} 
                      className="p-2 bg-white rounded-full text-red-500 shadow-sm hover:scale-110 transition-transform"
                    >
                      <ICONS.Trash className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3 text-slate-400 w-full h-full justify-center">
                  {isUploading ? (
                    <div className="w-8 h-8 border-3 border-blue-600 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <div className="flex gap-4">
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        className="flex flex-col items-center gap-2 hover:text-blue-600 transition-colors"
                      >
                        <ICONS.Upload className="w-6 h-6" />
                        <span className="text-xs font-medium">直接上传</span>
                      </button>
                      <div className="w-px h-8 bg-slate-200 self-center" />
                      <button 
                        onClick={() => setIsMediaLibraryOpen(true)}
                        className="flex flex-col items-center gap-2 hover:text-blue-600 transition-colors"
                      >
                        <ICONS.Image className="w-6 h-6" />
                        <span className="text-xs font-medium">素材库</span>
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Template */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900">展示模版</h3>
            <select 
              value={collection.template}
              onChange={(e) => setCollection({ ...collection, template: e.target.value })}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 text-sm bg-white cursor-pointer"
            >
              <option>Default Template</option>
              <option>Grid Collection</option>
              <option>Featured Collection</option>
            </select>
          </div>
        </div>
      </div>

      {/* Product Picker Modal */}
      <AnimatePresence>
        {showProductPicker && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
          >
            <motion.div 
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900">添加商品到系列</h3>
                <button onClick={() => setShowProductPicker(false)} className="text-slate-400 hover:text-slate-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
              
              <div className="p-6 border-b border-slate-100 bg-slate-50/50 space-y-4">
                <div className="flex gap-3">
                  <div className="relative flex-1">
                    <ICONS.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <input 
                      type="text" 
                      placeholder="搜索商品名称、标签..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-10 pr-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                  <select 
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-sm outline-none bg-white"
                  >
                    <option>全部</option>
                    <option value={ProductStatus.ACTIVE}>上架</option>
                    <option value={ProductStatus.INACTIVE}>未上架</option>
                    <option value={ProductStatus.DRAFT}>草稿</option>
                  </select>
                  <select 
                    value={filterVendor}
                    onChange={(e) => setFilterVendor(e.target.value)}
                    className="px-4 py-2 border border-slate-200 rounded-lg text-sm outline-none bg-white"
                  >
                    <option>全部厂商</option>
                    {vendors.map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <button 
                    onClick={() => setShowAdvancedFilters(!showAdvancedFilters)}
                    className={`px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
                      showAdvancedFilters ? 'bg-blue-50 border-blue-200 text-blue-600' : 'bg-white border-slate-200 text-slate-600'
                    }`}
                  >
                    高级筛选
                  </button>
                </div>

                {showAdvancedFilters && (
                  <motion.div 
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: 'auto', opacity: 1 }}
                    className="grid grid-cols-2 gap-4 pt-2 overflow-hidden"
                  >
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">类别</label>
                      <select 
                        value={filterCategory}
                        onChange={(e) => setFilterCategory(e.target.value)}
                        className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none bg-white"
                      >
                        <option>全部类别</option>
                        {categories.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">价格区间</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          placeholder="最小"
                          value={priceRange.min}
                          onChange={(e) => setPriceRange({ ...priceRange, min: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none"
                        />
                        <span className="text-slate-300">-</span>
                        <input 
                          type="number" 
                          placeholder="最大"
                          value={priceRange.max}
                          onChange={(e) => setPriceRange({ ...priceRange, max: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">库存数量</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="number" 
                          placeholder="最小"
                          value={stockRange.min}
                          onChange={(e) => setStockRange({ ...stockRange, min: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none"
                        />
                        <span className="text-slate-300">-</span>
                        <input 
                          type="number" 
                          placeholder="最大"
                          value={stockRange.max}
                          onChange={(e) => setStockRange({ ...stockRange, max: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase">创建时间</label>
                      <div className="flex items-center gap-2">
                        <input 
                          type="date" 
                          value={dateRange.start}
                          onChange={(e) => setDateRange({ ...dateRange, start: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none"
                        />
                        <span className="text-slate-300">-</span>
                        <input 
                          type="date" 
                          value={dateRange.end}
                          onChange={(e) => setDateRange({ ...dateRange, end: e.target.value })}
                          className="w-full px-3 py-1.5 border border-slate-200 rounded-lg text-xs outline-none"
                        />
                      </div>
                    </div>
                  </motion.div>
                )}
              </div>

              <div className="flex-1 overflow-y-auto p-2">
                <div className="grid grid-cols-1 gap-1">
                  {filteredProducts.map(p => {
                    const isSelected = collection.productIds?.includes(p.id);
                    return (
                      <button 
                        key={p.id}
                        onClick={() => toggleProduct(p.id)}
                        className={`flex items-center justify-between p-3 rounded-xl transition-all ${
                          isSelected ? 'bg-blue-50 border-blue-100' : 'hover:bg-slate-50 border-transparent'
                        } border`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-lg border border-slate-200 overflow-hidden bg-white">
                            <img src={p.media[0]?.url} className="w-full h-full object-cover" alt="" />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-medium text-slate-900">{p.title}</p>
                            <p className="text-[10px] text-slate-500">{p.status} • 库存: {p.variants.reduce((s, v) => s + v.stock, 0)}</p>
                          </div>
                        </div>
                        <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                          isSelected ? 'bg-blue-600 border-blue-600' : 'border-slate-200'
                        }`}>
                          {isSelected && <svg className="w-3 h-3 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="p-6 border-t border-slate-100 flex justify-between items-center bg-slate-50">
                <span className="text-xs text-slate-500">已选择 {collection.productIds?.length || 0} 个商品</span>
                <button 
                  onClick={() => setShowProductPicker(false)}
                  className="px-8 py-2 bg-slate-900 text-white rounded-lg text-sm font-bold hover:bg-slate-800 transition-colors"
                >
                  确定
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      {/* Media Library Modal */}
      <MediaLibrary 
        isOpen={isMediaLibraryOpen}
        onClose={() => setIsMediaLibraryOpen(false)}
        onSelect={handleMediaSelect}
        multiSelect={false}
      />
    </div>
  );
};

export default CollectionEditor;
