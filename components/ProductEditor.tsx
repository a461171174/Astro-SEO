import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Product, ProductStatus, MediaItem, VariantOption, ProductVariant } from '../types';
import { ICONS } from '../constants';
import { isAbortError } from '../utils';
import SEOSection from './SEOSection';
import { MediaLibrary } from './MediaLibrary';
import { geminiService } from '../services/geminiService';
import { mediaService } from '../services/mediaService';
import Markdown from 'react-markdown';

interface SortableMediaItemProps {
  item: MediaItem;
  index: number;
  onEdit: (item: MediaItem) => void;
  onRemove: (id: string) => void;
  isFeatured?: boolean;
}

const SortableMediaItem: React.FC<SortableMediaItemProps> = ({ item, index, onEdit, onRemove, isFeatured }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `media:${item.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`${isFeatured ? 'col-span-2 row-span-2' : ''} relative group rounded-xl border border-slate-200 overflow-hidden bg-slate-50 aspect-square ${isDragging ? 'opacity-50 ring-2 ring-blue-500' : ''}`}
    >
      <img src={item.url} className="w-full h-full object-cover" alt={item.altText} />
      
      {/* Drag Handle Overlay - Specific area for dragging */}
      <div 
        {...attributes} 
        {...listeners} 
        className="absolute top-2 right-2 z-30 bg-white/90 p-1.5 rounded-lg shadow-sm cursor-move opacity-0 group-hover:opacity-100 transition-opacity border border-slate-200"
      >
        <svg className="w-4 h-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8h16M4 16h16" />
        </svg>
      </div>

      <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 z-20">
        <button 
          onClick={(e) => { e.stopPropagation(); onEdit(item); }} 
          className="p-2 bg-white rounded-full text-slate-700 hover:text-blue-600 shadow-sm transition-transform hover:scale-110"
        >
          <ICONS.Edit />
        </button>
        <button 
          onClick={(e) => { e.stopPropagation(); onRemove(item.id); }} 
          className="p-2 bg-white rounded-full text-slate-700 hover:text-red-600 shadow-sm transition-transform hover:scale-110"
        >
          <ICONS.Trash />
        </button>
      </div>
      {index === 0 && (
        <div className="absolute top-2 left-2 bg-blue-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm z-20">主图</div>
      )}
    </div>
  );
};

interface SortableOptionValueProps {
  value: string;
  optionId: string;
  optIdx: number;
  valIdx: number;
  onRemove: (optIdx: number, valIdx: number) => void;
}

const SortableOptionValue: React.FC<SortableOptionValueProps> = ({ value, optionId, optIdx, valIdx, onRemove }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `val:${optionId}:${value}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 1,
  };

  return (
    <span 
      ref={setNodeRef}
      style={style}
      className={`inline-flex items-center gap-1 px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs border border-slate-200 group/tag ${isDragging ? 'opacity-50 ring-1 ring-blue-400' : ''}`}
    >
      <span {...attributes} {...listeners} className="text-slate-300 cursor-move hover:text-slate-500 transition-colors">
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 24 24"><path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
      </span>
      {value}
      <button onClick={() => onRemove(optIdx, valIdx)} className="hover:text-red-500">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
    </span>
  );
};

interface SortableOptionProps {
  option: VariantOption;
  optIdx: number;
  onRemove: (index: number) => void;
  onUpdateName: (index: number, name: string) => void;
  onAddValue: (index: number, value: string) => void;
  onRemoveValue: (optIndex: number, valIndex: number) => void;
  onClearValues: (index: number) => void;
  newOptionValue: string;
  setNewOptionValue: (value: string) => void;
}

const SortableOption: React.FC<SortableOptionProps> = ({ 
  option, optIdx, onRemove, onUpdateName, onAddValue, onRemoveValue, onClearValues, newOptionValue, setNewOptionValue
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `opt:${option.id}` });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 40 : 1,
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      className={`bg-slate-50/50 rounded-xl border border-slate-200 p-6 relative group ${isDragging ? 'opacity-50 ring-2 ring-blue-500' : ''}`}
    >
      <div {...attributes} {...listeners} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 cursor-move hover:text-slate-500 transition-colors p-1">
        <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M11 18c0 1.1-.9 2-2 2s-2-.9-2-2 .9-2 2-2 2 .9 2 2zm-2-8c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0-6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm6 4c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
      </div>
      <button 
        onClick={() => onRemove(optIdx)}
        className="absolute right-4 top-4 text-slate-400 hover:text-red-500 transition-colors"
      >
        <ICONS.Trash className="w-4 h-4" />
      </button>
      
      <div className="ml-6 space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase">规格名</label>
          <input 
            type="text" 
            value={option.name}
            onChange={(e) => onUpdateName(optIdx, e.target.value)}
            placeholder="例如：颜色、尺寸"
            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 text-sm"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase">规格值</label>
          <div className="flex flex-wrap gap-2 p-2 bg-white border border-slate-200 rounded-lg min-h-[42px]">
            <SortableContext
              items={option.values.map(v => `val:${option.id}:${v}`)}
              strategy={rectSortingStrategy}
            >
              {option.values.map((val, valIdx) => (
                <SortableOptionValue 
                  key={`${option.id}-${val}`}
                  value={val}
                  optionId={option.id}
                  optIdx={optIdx}
                  valIdx={valIdx}
                  onRemove={onRemoveValue}
                />
              ))}
            </SortableContext>
            
            <input 
              type="text"
              value={newOptionValue}
              onChange={(e) => setNewOptionValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  onAddValue(optIdx, newOptionValue);
                }
              }}
              placeholder="添加规格值，输入后按 Enter 键确认"
              className="flex-1 min-w-[200px] outline-none text-xs"
            />
            {option.values.length > 0 && (
              <button 
                onClick={() => onClearValues(optIdx)}
                className="text-slate-400 hover:text-slate-600"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M10 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2m7-2a9 9 0 11-18 0 9 9 0 0118 0z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

interface ProductEditorProps {
  product?: Product;
  brandName?: string;
  strategy?: string;
  selectedKeywords?: string[];
  customPrompt?: string;
  onSave: (product: Product) => void;
  onCancel: () => void;
}

const ProductEditor: React.FC<ProductEditorProps> = ({ 
  product: initialProduct, 
  brandName = '', 
  strategy = '',
  selectedKeywords = [],
  customPrompt,
  onSave, 
  onCancel 
}) => {
  const [product, setProduct] = useState<Partial<Product>>(initialProduct || {
    title: '',
    summary: '',
    media: [],
    description: '',
    options: [],
    variants: [],
    status: ProductStatus.DRAFT,
    tags: [],
    collections: [],
    template: 'Default Template',
    extendedFields: {},
  });

  const variants = product.variants || [];
  const media = product.media || [];

  const [editingMedia, setEditingMedia] = useState<MediaItem | null>(null);
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
  const [mediaPickerMode, setMediaPickerMode] = useState<'product' | 'variant'>('product');
  const [isSEOLoading, setIsSEOLoading] = useState(false);
  const [seoSuggestions, setSeoSuggestions] = useState<any | null>(null);
  const [showSEOPanel, setShowSEOPanel] = useState(false);
  const [newOptionValue, setNewOptionValue] = useState<{ [key: number]: string }>({});
  const [variantImagePicker, setVariantImagePicker] = useState<string | null>(null); // Variant ID
  const [isGeneratingDescription, setIsGeneratingDescription] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Track if SEO fields should auto-sync with title
  const [isSeoTitleAuto, setIsSeoTitleAuto] = useState(!initialProduct || !initialProduct.seoTitle);
  const [isSeoUrlAuto, setIsSeoUrlAuto] = useState(!initialProduct || !initialProduct.seoUrl);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    // Route based on ID prefix
    if (activeId.startsWith('media:')) {
      setProduct((prev) => {
        const currentMedia = prev.media || [];
        const oldIndex = currentMedia.findIndex((m) => `media:${m.id}` === activeId);
        const newIndex = currentMedia.findIndex((m) => `media:${m.id}` === overId);
        
        if (oldIndex !== -1 && newIndex !== -1) {
          return {
            ...prev,
            media: arrayMove(currentMedia, oldIndex, newIndex),
          };
        }
        return prev;
      });
    } else if (activeId.startsWith('opt:')) {
      setProduct((prev) => {
        const currentOptions = prev.options || [];
        const oldIndex = currentOptions.findIndex((o) => `opt:${o.id}` === activeId);
        const newIndex = currentOptions.findIndex((o) => `opt:${o.id}` === overId);
        
        if (oldIndex !== -1 && newIndex !== -1) {
          const updatedOptions = arrayMove(currentOptions, oldIndex, newIndex);
          return {
            ...prev,
            options: updatedOptions,
            variants: generateVariants(updatedOptions)
          };
        }
        return prev;
      });
    } else if (activeId.startsWith('val:')) {
      setProduct((prev) => {
        const currentOptions = [...(prev.options || [])];
        // Extract optionId from the activeId: val:${optionId}:${value}
        const parts = activeId.split(':');
        const optionId = parts[1];
        
        const optIdx = currentOptions.findIndex(o => o.id === optionId);
        if (optIdx === -1) return prev;

        const option = { ...currentOptions[optIdx] };
        const values = [...option.values];
        
        const oldIndex = values.findIndex((v) => `val:${optionId}:${v}` === activeId);
        const newIndex = values.findIndex((v) => `val:${optionId}:${v}` === overId);
        
        if (oldIndex !== -1 && newIndex !== -1) {
          option.values = arrayMove(values, oldIndex, newIndex);
          currentOptions[optIdx] = option;
          return {
            ...prev,
            options: currentOptions,
            variants: generateVariants(currentOptions)
          };
        }
        return prev;
      });
    }
  };

  // SEO URL & Title auto-generation
  React.useEffect(() => {
    if (product.title) {
      setProduct(prev => {
        const updates: Partial<Product> = {};
        
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
  }, [product.title, isSeoTitleAuto, isSeoUrlAuto]);

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

  const handleAddMedia = () => {
    setMediaPickerMode('product');
    setIsMediaLibraryOpen(true);
  };

  const handleDirectUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsUploading(true);
    try {
      const uploadPromises = Array.from(files).map(async (file) => {
        try {
          const newItem = await mediaService.uploadFile(file);
          return newItem;
        } catch (error) {
          if (isAbortError(error)) return null;
          console.error('Upload failed for file:', file.name, error);
          alert(`文件 ${file.name} 上传失败: ${error instanceof Error ? error.message : '未知错误'}`);
          return null;
        }
      });

      const results = await Promise.all(uploadPromises);
      const successfulUploads = results.filter((item): item is MediaItem => item !== null);

      if (successfulUploads.length > 0) {
        setProduct(prev => ({
          ...prev,
          media: [...(prev.media || []), ...successfulUploads]
        }));
      }
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Unexpected error in handleDirectUpload:', error);
      alert('上传过程中发生意外错误，请检查网络连接或重试。');
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleMediaSelect = (selectedItems: MediaItem[]) => {
    if (mediaPickerMode === 'product') {
      // Filter out items already in the product media
      const existingUrls = new Set(media.map(m => m.url));
      const newItems = selectedItems.filter(item => !existingUrls.has(item.url));
      
      setProduct({ 
        ...product, 
        media: [...media, ...newItems] 
      });
    } else if (mediaPickerMode === 'variant' && variantImagePicker) {
      // For variant, we only take the first selected item
      if (selectedItems.length > 0) {
        handleUpdateVariant(variantImagePicker, 'image', selectedItems[0].url);
      }
    }
    setIsMediaLibraryOpen(false);
  };

  const handleRemoveMedia = (id: string) => {
    setProduct({ ...product, media: media.filter(m => m.id !== id) });
  };

  const handleUpdateMedia = (updated: MediaItem) => {
    setProduct({
      ...product,
      media: media.map(m => m.id === updated.id ? updated : m)
    });
    setEditingMedia(null);
  };

  const handleGenerateSEODescription = async () => {
    if (!product.title) {
      alert('请先输入标题');
      return;
    }
    setIsGeneratingDescription(true);
    try {
      const description = await geminiService.generateSEODescription(product.title || '', product.description || product.summary || '', brandName);
      setProduct(prev => ({ ...prev, seoDescription: description }));
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Failed to generate SEO description:', error);
    } finally {
      setIsGeneratingDescription(false);
    }
  };

  const handleGenerateSEO = async () => {
    if (!product.title) {
      alert('请先输入商品标题以供 AI 分析');
      return;
    }
    setIsSEOLoading(true);
    try {
      const suggestions = await geminiService.generateSEOSuggestions(
        product, 
        brandName,
        strategy,
        selectedKeywords,
        customPrompt
      );
      setSeoSuggestions(suggestions);
      setShowSEOPanel(true);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('SEO generation failed:', error);
      alert('AI 分析失败，请稍后重试');
    } finally {
      setIsSEOLoading(false);
    }
  };

  const applySEOSuggestion = (type: 'title' | 'summary') => {
    if (!seoSuggestions) return;
    if (type === 'title') {
      setProduct({ ...product, title: seoSuggestions.optimizedTitle });
    } else {
      setProduct({ ...product, summary: seoSuggestions.optimizedSummary });
    }
  };

  const handleSave = () => {
    if (!product.title) {
      alert('商品标题为必填项');
      return;
    }
    onSave(product as Product);
  };

  const handleAddOption = () => {
    const currentOptions = product.options || [];
    if (currentOptions.length >= 5) {
      alert('最多只能添加 5 层规格层级');
      return;
    }
    const updatedOptions = [...currentOptions, { id: `opt-${Date.now()}`, name: '', values: [] }];
    setProduct({ ...product, options: updatedOptions });
  };

  const handleRemoveOption = (index: number) => {
    const updatedOptions = (product.options || []).filter((_, i) => i !== index);
    const newVariants = generateVariants(updatedOptions);
    setProduct({ ...product, options: updatedOptions, variants: newVariants });
  };

  const handleUpdateOptionName = (index: number, name: string) => {
    const updatedOptions = [...(product.options || [])];
    updatedOptions[index].name = name;
    setProduct({ ...product, options: updatedOptions });
  };

  const handleAddOptionValue = (index: number, value: string) => {
    if (!value.trim()) return;
    const updatedOptions = [...(product.options || [])];
    if (updatedOptions[index].values.includes(value)) return;
    updatedOptions[index].values = [...updatedOptions[index].values, value];
    const newVariants = generateVariants(updatedOptions);
    setProduct({ ...product, options: updatedOptions, variants: newVariants });
    setNewOptionValue({ ...newOptionValue, [index]: '' });
  };

  const handleRemoveOptionValue = (optIndex: number, valIndex: number) => {
    const updatedOptions = [...(product.options || [])];
    updatedOptions[optIndex].values = updatedOptions[optIndex].values.filter((_, i) => i !== valIndex);
    const newVariants = generateVariants(updatedOptions);
    setProduct({ ...product, options: updatedOptions, variants: newVariants });
  };

  const generateVariants = (options: VariantOption[]) => {
    if (options.length === 0 || options.every(o => o.values.length === 0)) return [];
    
    // Filter out options with no values
    const validOptions = options.filter(o => o.values.length > 0);
    if (validOptions.length === 0) return [];

    const combinations = validOptions.reduce((acc, option) => {
      const nextAcc: any[] = [];
      option.values.forEach(value => {
        if (acc.length === 0) {
          nextAcc.push({ [option.name]: value });
        } else {
          acc.forEach(combo => {
            nextAcc.push({ ...combo, [option.name]: value });
          });
        }
      });
      return nextAcc;
    }, [] as any[]);

    return combinations.map((combo, idx) => {
      // Try to find existing variant to preserve data
      const existing = (product.variants || []).find(v => 
        Object.entries(combo).every(([key, val]) => v.options[key] === val)
      );

      // Generate SKU based on options
      const skuSuffix = Object.values(combo)
        .map(val => String(val).toUpperCase().replace(/\s+/g, ''))
        .join('-');
      const generatedSku = product.title 
        ? `${product.title.substring(0, 3).toUpperCase()}-${skuSuffix}`
        : `SKU-${skuSuffix}`;

      return existing || {
        id: `v-${Date.now()}-${idx}`,
        sku: generatedSku,
        price: 0,
        stock: 0,
        options: combo
      };
    });
  };

  const handleUpdateVariant = (id: string, field: keyof ProductVariant, value: any) => {
    setProduct({
      ...product,
      variants: (product.variants || []).map(v => v.id === id ? { ...v, [field]: value } : v)
    });
  };

  const handleVariantImageSelect = (variantId: string) => {
    setMediaPickerMode('variant');
    setVariantImagePicker(variantId);
    setIsMediaLibraryOpen(true);
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
    >
      <div className="max-w-[1200px] mx-auto pb-20 px-4 lg:px-0">
      <AnimatePresence>
        {/* Media Library Modal */}
        {isMediaLibraryOpen && (
          <MediaLibrary 
            isOpen={isMediaLibraryOpen}
            onClose={() => setIsMediaLibraryOpen(false)}
            onSelect={handleMediaSelect}
            multiSelect={mediaPickerMode === 'product'}
            initialSelection={mediaPickerMode === 'product' ? media.map(m => m.id) : []}
          />
        )}

        {/* Media Edit Modal */}
        {editingMedia && (
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
              className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="font-bold text-slate-900">编辑媒体详情</h3>
                <button onClick={() => setEditingMedia(null)} className="text-slate-400 hover:text-slate-600">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="aspect-video rounded-xl overflow-hidden bg-slate-100 border border-slate-200">
                  <img src={editingMedia.url} className="w-full h-full object-contain" alt="Preview" />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">图片名称</label>
                  <input 
                    type="text" 
                    value={editingMedia.name}
                    onChange={(e) => setEditingMedia({ ...editingMedia, name: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">替代文本 (Alt Text)</label>
                  <input 
                    type="text" 
                    value={editingMedia.altText}
                    onChange={(e) => setEditingMedia({ ...editingMedia, altText: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="描述图片内容，利于 SEO"
                  />
                </div>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
                <button onClick={() => setEditingMedia(null)} className="px-4 py-2 text-sm font-medium text-slate-600 hover:text-slate-800">取消</button>
                <button 
                  onClick={() => handleUpdateMedia(editingMedia)}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 shadow-sm"
                >
                  保存更改
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* AI SEO Suggestions Panel */}
        {showSEOPanel && seoSuggestions && (
          <motion.div 
            initial={{ opacity: 0, x: 300 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 300 }}
            className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[110] border-l border-slate-200 flex flex-col"
          >
            <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-indigo-50/50">
              <div className="flex items-center gap-2">
                <span className="text-xl">✨</span>
                <h3 className="font-bold text-slate-900">AI SEO 优化建议</h3>
              </div>
              <button onClick={() => setShowSEOPanel(false)} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-white rounded-full transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-6 space-y-8">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">建议标题</h4>
                  <button 
                    onClick={() => applySEOSuggestion('title')}
                    className="text-[10px] bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 transition-colors"
                  >
                    应用
                  </button>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-700 leading-relaxed">
                  {seoSuggestions.optimizedTitle}
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">建议摘要</h4>
                  <button 
                    onClick={() => applySEOSuggestion('summary')}
                    className="text-[10px] bg-indigo-600 text-white px-2 py-1 rounded hover:bg-indigo-700 transition-colors"
                  >
                    应用
                  </button>
                </div>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-sm text-slate-700 leading-relaxed">
                  {seoSuggestions.optimizedSummary}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">关键词建议</h4>
                <div className="flex flex-wrap gap-2">
                  {seoSuggestions.keywords?.map((kw: string, i: number) => (
                    <span key={i} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-xs font-medium border border-indigo-100">
                      {kw}
                    </span>
                  ))}
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">图片 Alt 建议</h4>
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200">
                  <div className="text-sm text-slate-600 prose prose-sm max-w-none">
                    <Markdown>
                      {seoSuggestions.altTextSuggestions}
                    </Markdown>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-slate-100 bg-slate-50">
              <button 
                onClick={() => setShowSEOPanel(false)}
                className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold text-sm hover:bg-slate-800 transition-colors shadow-lg shadow-slate-200"
              >
                完成
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="flex items-center justify-between sticky top-0 bg-[#F8F9FB]/80 backdrop-blur-md py-4 z-20">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={onCancel}>产品</span>
            <span>/</span>
          </div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold text-slate-900">{initialProduct ? '编辑实体产品' : '创建实体产品'}</h1>
            <span className="px-2 py-0.5 bg-green-50 text-green-600 text-[10px] font-bold rounded border border-green-100 uppercase">
              {product.status === ProductStatus.ACTIVE ? '上架' : product.status === ProductStatus.DRAFT ? '草稿' : '未上架'}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors">预览</button>
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
          {/* Main Content Card */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-8">
            {/* Title & Summary */}
            <div className="space-y-6">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">标题<span className="text-red-500">*</span></label>
                  <button 
                    onClick={handleGenerateSEO}
                    disabled={isSEOLoading}
                    className="text-[10px] font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-1 transition-colors"
                  >
                    {isSEOLoading ? (
                      <span className="flex items-center gap-1">
                        <svg className="animate-spin h-3 w-3 text-indigo-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        AI 分析中...
                      </span>
                    ) : '✨ AI SEO 优化'}
                  </button>
                </div>
                <div className="relative">
                  <input 
                    type="text" 
                    maxLength={255}
                    value={product.title}
                    onChange={(e) => setProduct({ ...product, title: e.target.value })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 text-sm transition-all"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-400">
                    {product.title?.length || 0}/255
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">产品特色</label>
                <div className="relative">
                  <textarea 
                    maxLength={400}
                    value={product.summary}
                    onChange={(e) => setProduct({ ...product, summary: e.target.value })}
                    className="w-full h-20 px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 text-sm resize-none transition-all"
                  />
                  <span className="absolute right-3 bottom-2 text-[10px] text-slate-400">
                    {product.summary?.length || 0}/400
                  </span>
                </div>
              </div>
            </div>

            {/* Media */}
            <div className="space-y-4">
              <label className="text-sm font-medium text-slate-700">图片/视频</label>
              <SortableContext
                items={media.map(m => `media:${m.id}`)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-5 gap-3">
                  {media.map((item, index) => (
                    <SortableMediaItem
                      key={item.id}
                      item={item}
                      index={index}
                      isFeatured={index === 0}
                      onEdit={setEditingMedia}
                      onRemove={handleRemoveMedia}
                    />
                  ))}
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleDirectUpload} 
                    multiple 
                    accept="image/*,video/*" 
                    className="hidden" 
                  />
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isUploading}
                    className="aspect-square border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-600 transition-all hover:bg-blue-50/50"
                  >
                    {isUploading ? (
                      <div className="w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
                    ) : (
                      <>
                        <ICONS.Plus />
                        <span className="text-[10px] mt-1 font-bold">直接上传</span>
                      </>
                    )}
                  </button>
                  <button 
                    onClick={handleAddMedia}
                    className="aspect-square border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-600 transition-all hover:bg-blue-50/50"
                  >
                    <ICONS.Image className="w-5 h-5" />
                    <span className="text-[10px] mt-1 font-bold">素材库</span>
                  </button>
                </div>
              </SortableContext>
            </div>

            {/* Description */}
            <div className="space-y-4">
              <div className="flex items-center gap-1">
                <label className="text-sm font-medium text-slate-700">描述</label>
                <div className="text-slate-400 cursor-help">
                  <ICONS.Help />
                </div>
              </div>
              <div className="border border-slate-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                <div className="bg-slate-50 p-2 border-b border-slate-200 flex flex-wrap gap-4">
                  <div className="flex gap-2">
                    <button className="p-1.5 hover:bg-slate-200 rounded text-xs font-medium text-slate-600">段落</button>
                    <button className="p-1.5 hover:bg-slate-200 rounded text-slate-600 font-bold">B</button>
                    <button className="p-1.5 hover:bg-slate-200 rounded text-slate-600 italic">I</button>
                    <button className="p-1.5 hover:bg-slate-200 rounded text-slate-600 underline">U</button>
                  </div>
                  <div className="w-px h-4 bg-slate-300 self-center" />
                  <div className="flex gap-2">
                    <button className="p-1.5 hover:bg-slate-200 rounded text-slate-600"><ICONS.Link className="w-4 h-4" /></button>
                    <button className="p-1.5 hover:bg-slate-200 rounded text-slate-600"><ICONS.Image className="w-4 h-4" /></button>
                  </div>
                </div>
                <textarea 
                  value={product.description}
                  onChange={(e) => setProduct({ ...product, description: e.target.value })}
                  placeholder="在此输入富文本描述..."
                  className="w-full h-64 px-4 py-3 outline-none resize-none text-sm leading-relaxed"
                />
              </div>
            </div>

            {/* Category */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">类别</label>
              <select className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 text-sm bg-white cursor-pointer hover:border-slate-300 transition-colors">
                <option>储物/收纳 (在 家居用品 中)</option>
              </select>
            </div>

            {/* Highlights */}
            <div className="flex items-center justify-between py-2 border-t border-slate-100">
              <div className="flex items-center gap-1">
                <span className="text-sm font-medium text-slate-700">亮点</span>
                <div className="text-slate-400 cursor-help">
                  <ICONS.Help />
                </div>
              </div>
              <button className="text-slate-400 hover:text-blue-600 transition-colors"><ICONS.Edit className="w-4 h-4" /></button>
            </div>
          </div>

          {/* Variants Section */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-8 border-b border-slate-100">
              <h3 className="text-sm font-bold text-slate-900 mb-6">规格</h3>
              
              <div className="space-y-4">
                <SortableContext
                  items={(product.options || []).map(o => `opt:${o.id}`)}
                  strategy={verticalListSortingStrategy}
                >
                  {(product.options || []).map((option, optIdx) => (
                    <SortableOption 
                      key={option.id}
                      option={option}
                      optIdx={optIdx}
                      onRemove={handleRemoveOption}
                      onUpdateName={handleUpdateOptionName}
                      onAddValue={handleAddOptionValue}
                      onRemoveValue={handleRemoveOptionValue}
                      onClearValues={(idx) => {
                        const updatedOptions = [...(product.options || [])];
                        updatedOptions[idx].values = [];
                        setProduct({ ...product, options: updatedOptions, variants: generateVariants(updatedOptions) });
                      }}
                      newOptionValue={newOptionValue[optIdx] || ''}
                      setNewOptionValue={(val) => setNewOptionValue({ ...newOptionValue, [optIdx]: val })}
                    />
                  ))}
                </SortableContext>
                
                <button 
                  onClick={handleAddOption}
                  className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm font-medium text-slate-600 hover:border-blue-400 hover:text-blue-600 hover:bg-blue-50/50 transition-all flex items-center justify-center gap-2"
                >
                  <div className="w-5 h-5 rounded-full border border-current flex items-center justify-center">
                    <ICONS.Plus className="w-3 h-3" />
                  </div>
                  添加其他规格
                </button>
              </div>
            </div>

            <div className="p-8 space-y-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <button className="text-slate-400 hover:text-blue-600 transition-colors"><ICONS.Search className="w-5 h-5" /></button>
                  <button className="text-slate-400 hover:text-blue-600 transition-colors"><ICONS.Filter className="w-5 h-5" /></button>
                  <button className="text-slate-400 hover:text-blue-600 transition-colors"><ICONS.Columns className="w-5 h-5" /></button>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-slate-100 text-slate-400 font-medium">
                      <th className="p-3 w-10"><input type="checkbox" className="rounded cursor-pointer" /></th>
                      <th className="p-3">图片</th>
                      <th className="p-3">规格</th>
                      <th className="p-3">SKU</th>
                      <th className="p-3">价格 <ICONS.Help className="inline-block w-3 h-3" /></th>
                      <th className="p-3">可售库存 <ICONS.Help className="inline-block w-3 h-3" /></th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {variants.map((v, idx) => (
                      <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                        <td className="p-3"><input type="checkbox" className="rounded cursor-pointer" /></td>
                        <td className="p-3">
                          <button 
                            onClick={() => handleVariantImageSelect(v.id)}
                            className="w-10 h-10 rounded-lg border-2 border-dashed border-slate-200 bg-slate-50 flex items-center justify-center text-slate-400 hover:border-blue-400 hover:text-blue-600 transition-all overflow-hidden"
                          >
                            {v.image ? (
                              <img src={v.image} className="w-full h-full object-cover" alt="" />
                            ) : (
                              <ICONS.Plus className="w-4 h-4" />
                            )}
                          </button>
                        </td>
                        <td className="p-3">
                          <span className="text-blue-600 font-medium">
                            {Object.values(v.options).join('/')}
                          </span>
                        </td>
                        <td className="p-3">
                          <input 
                            type="text" 
                            value={v.sku} 
                            onChange={(e) => handleUpdateVariant(v.id, 'sku', e.target.value)}
                            className="w-32 px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20" 
                          />
                        </td>
                        <td className="p-3">
                          <div className="flex items-center gap-2 bg-white border border-slate-200 rounded-lg px-3 py-2 w-32 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
                            <span className="text-slate-400">$</span>
                            <input 
                              type="number" 
                              value={v.price} 
                              onChange={(e) => handleUpdateVariant(v.id, 'price', parseFloat(e.target.value))}
                              className="w-full outline-none" 
                            />
                          </div>
                        </td>
                        <td className="p-3">
                          <input 
                            type="number" 
                            value={v.stock} 
                            onChange={(e) => handleUpdateVariant(v.id, 'stock', parseInt(e.target.value))}
                            className="w-32 px-3 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20" 
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-center py-4 border-t border-slate-100 text-xs text-slate-400">
                总库存数: {variants.reduce((s, v) => s + (v.stock || 0), 0)}
              </div>
            </div>
          </div>

          {/* SEO Section */}
          <SEOSection 
            title={product.title}
            content={product.description || product.summary || ''}
            seoTitle={product.seoTitle || ''}
            seoDescription={product.seoDescription || ''}
            seoUrl={product.seoUrl || ''}
            urlPrefix="/products/"
            onUpdate={(updates) => setProduct(prev => ({ ...prev, ...updates }))}
            onManualTitleChange={() => setIsSeoTitleAuto(false)}
            onManualUrlChange={() => setIsSeoUrlAuto(false)}
          />
        </div>

        {/* Side Column */}
        <div className="space-y-6">
          {/* Status */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900">状态</h3>
            <select 
              value={product.status}
              onChange={(e) => setProduct({ ...product, status: e.target.value as ProductStatus })}
              className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 text-sm bg-white cursor-pointer hover:border-slate-300 transition-colors"
            >
              <option value={ProductStatus.ACTIVE}>上架</option>
              <option value={ProductStatus.INACTIVE}>未上架</option>
              <option value={ProductStatus.DRAFT}>草稿</option>
            </select>
          </div>

          {/* Product Info */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
            <h3 className="text-sm font-bold text-slate-900">产品信息</h3>
            <div className="space-y-4">
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-700">系列</label>
                <div className="relative">
                  <ICONS.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                  <input type="text" placeholder="搜索系列" className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500/20 transition-all" />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {['厂商', '标签', '展示标签', '自定义产品类型'].map(btn => (
                  <button key={btn} className="px-3 py-1.5 bg-slate-50 border border-slate-100 rounded text-[10px] font-medium text-slate-600 hover:bg-slate-100 transition-colors flex items-center gap-1">
                    {btn}
                    {btn === '展示标签' && <div className="text-slate-400"><ICONS.Help /></div>}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Template */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900">展示模版</h3>
            <select className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 text-sm bg-white cursor-pointer hover:border-slate-300 transition-colors">
              <option>Dropshipping Product</option>
              <option>Default Template</option>
            </select>
          </div>
        </div>
      </div>
    </div>
    </DndContext>
  );
};

export default ProductEditor;
