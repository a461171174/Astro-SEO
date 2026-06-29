
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  LineChart, Line, BarChart, Bar, PieChart, Pie, 
  ResponsiveContainer, XAxis, YAxis, Tooltip, Legend, Cell, CartesianGrid 
} from 'recharts';
import { ICONS } from '../constants';
import { isAbortError, cleanObject } from '../utils';
import { geminiService } from '../services/geminiService';
import { Product, Collection, Blog, Page, BlogSet } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, query, where, getDocs, getDoc, updateDoc, doc, addDoc, onSnapshot, deleteDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import SEOBlogManager from './SEOBlogManager';
import { SearchableSelect } from './SearchableSelect';
import { useToast } from './Toast';

interface SEODashboardProps {
  products: Product[];
  collections: Collection[];
  blogs: Blog[];
  blogSets: BlogSet[];
  pages: Page[];
  initialTab?: 'audit' | 'ai' | 'tracking' | 'blog' | 'fix';
  initialMode?: 'chat' | 'list';
  onTabChange?: (tab: string) => void;
}

interface AuditIssue {
  id: string;
  category: 'SEO 基础标签' | '页面结构' | 'URL 规范化' | '图片 SEO' | '内链优化';
  severity: 'high' | 'medium' | 'low';
  title: string;
  description: string;
  recommendation: string;
  affectedItems?: any[];
  targetTab?: 'products' | 'collections' | 'blogs' | 'blogSets' | 'pages' | 'images';
}

interface ExecutionHistory {
  id: string;
  timestamp: string;
  keywords: string[];
  details?: string;
}

interface ItemHistory {
  id: string;
  itemId: string;
  timestamp: string;
  seoTitle?: string;
  seoDescription?: string;
  keywords?: string[];
  altText?: string;
}

const CATEGORY_STYLES: Record<string, string> = {
  'SEO 基础标签': 'bg-slate-100 text-slate-700 border border-slate-200/50',
  '页面结构': 'bg-slate-100 text-slate-700 border border-slate-200/50',
  'URL 规范化': 'bg-slate-100 text-slate-700 border border-slate-200/50',
  '图片 SEO': 'bg-slate-100 text-slate-700 border border-slate-200/50',
  '内链优化': 'bg-slate-100 text-slate-700 border border-slate-200/50',
};

const isImageNameMeaningless = (name: string): boolean => {
  if (!name) return true;
  const fileName = name.split('/').pop() || name;
  const baseName = fileName.split('.').slice(0, -1).join('.').toLowerCase().trim() || fileName.toLowerCase().trim();

  if (baseName.length < 3) return true;

  if (/^[\d\-_\s]+$/.test(baseName)) return true;

  const isHexOrUuid = /^[0-9a-f]{8,36}$/i.test(baseName.replace(/[-_]/g, ''));
  if (isHexOrUuid) return true;

  const genericKeywords = [
    'img_', 'dsc_', 'pano_', 'dcim', 'screenshot', 'untitled', 'capture',
    'image', 'photo', 'pic', 'picture', 'temp', 'upload', 'logo', 'banner',
    'background', 'bg', 'asset', 'file', 'media', 'thumbnail', 'placeholder'
  ];

  if (genericKeywords.some(keyword => {
    if (baseName === keyword) return true;
    const regex = new RegExp(`^${keyword}[0-9\\-_\\s]*$`, 'i');
    return regex.test(baseName);
  })) {
    return true;
  }

  return false;
};

const getStatConfig = (label: string) => {
  const configs: Record<string, { icon: React.ReactNode; color: string; bg: string; bar: string }> = {
    'SEO 基础标签': { 
      icon: <ICONS.Tag className="w-5 h-5 text-blue-600" />, 
      color: 'text-blue-600', 
      bg: 'bg-blue-50/60',
      bar: 'bg-blue-500'
    },
    '页面结构': { 
      icon: <ICONS.Heading className="w-5 h-5 text-indigo-600" />, 
      color: 'text-indigo-600', 
      bg: 'bg-indigo-50/60',
      bar: 'bg-indigo-500' 
    },
    'URL 规范化': { 
      icon: <ICONS.Globe className="w-5 h-5 text-emerald-600" />, 
      color: 'text-emerald-600', 
      bg: 'bg-emerald-50/60',
      bar: 'bg-emerald-500' 
    },
    '图片 SEO': { 
      icon: <ICONS.Image className="w-5 h-5 text-violet-600" />, 
      color: 'text-violet-600', 
      bg: 'bg-violet-50/60',
      bar: 'bg-violet-500' 
    },
    '内链优化': { 
      icon: <ICONS.Link className="w-5 h-5 text-amber-600" />, 
      color: 'text-amber-600', 
      bg: 'bg-amber-50/60',
      bar: 'bg-amber-500' 
    },
  };
  return configs[label] || { 
    icon: <ICONS.Info className="w-5 h-5 text-slate-600" />, 
    bg: 'bg-slate-50', 
    color: 'text-slate-600', 
    bar: 'bg-slate-600' 
  };
};

const SEODashboard: React.FC<SEODashboardProps> = ({ products, collections, blogs, blogSets, pages, initialTab = 'audit', initialMode = 'chat', onTabChange }) => {
  const { toast } = useToast();
  const [blogEditActions, setBlogEditActions] = useState<{ publish: () => void; cancel: () => void } | null>(null);
  const allImages = useMemo(() => {
    const images: any[] = [];
    products.forEach(p => {
      if (p.media) {
        p.media.forEach(m => {
          if (m.type === 'image') {
            images.push({ 
              ...m, 
              id: m.id || `img-${p.id}-${m.url.split('/').pop()}`,
              parentId: p.id, 
              parentTitle: p.title, 
              parentType: 'product' 
            });
          }
        });
      }
    });
    collections.forEach(c => {
      if (c.image) {
        images.push({ 
          id: `col-img-${c.id}`, 
          url: c.image, 
          name: (c as any).imageName || c.title, 
          altText: c.imageAlt || '', 
          parentId: c.id, 
          parentTitle: c.title, 
          parentType: 'collection' 
        });
      }
    });
    blogs.forEach(b => {
      if (b.image) {
        images.push({ 
          id: `blog-img-${b.id}`, 
          url: b.image, 
          name: (b as any).imageName || b.title, 
          altText: b.imageAlt || '', 
          parentId: b.id, 
          parentTitle: b.title, 
          parentType: 'blog' 
        });
      }
    });
    return images;
  }, [products, collections, blogs]);

  const getNeedsOptimizationCount = (items: any[], type: string, currentFilterIds: string[] | null = null) => {
    if (currentFilterIds) {
      // When filtered by audit issues, show the count of items in this tab that are in the filter
      // This ensures the badge matches the number of items the user sees in the list
      return items.filter(i => currentFilterIds.includes(i.id)).length;
    }
    if (type === 'images') {
      const unoptimizedImages = items.filter(i => {
        if (i.seoOptimized) return false;
        let parent: any = null;
        if (i.parentType === 'product') parent = products.find(p => p.id === i.parentId);
        else if (i.parentType === 'collection') parent = collections.find(c => c.id === i.parentId);
        else if (i.parentType === 'blog') parent = blogs.find(b => b.id === i.parentId);
        if (parent && parent.seoOptimized) return false;
        return true;
      });
      return unoptimizedImages.filter(i => !i.altText || i.altText.length < 5 || (i.size && i.size > 500 * 1024) || isImageNameMeaningless(i.name)).length;
    }
    return items.filter(i => !i.seoOptimized && (!i.seoTitle || !i.seoDescription || i.seoTitle.length < 10 || i.seoDescription.length < 30)).length;
  };

  const DEFAULT_PROMPTS = {
    seo: `Analyze this item and provide SEO optimized content in the target language. 
Include: 
1. SEO Title (max 70 chars, MUST append the brand name at the end)
2. SEO Description (max 160 chars)
3. URL Slug (alphanumeric and hyphens only)
4. Keywords (array of exactly 5 relevant keywords)
5. Selling Points (array of 3-5 key selling points)

IMPORTANT: Prioritize using the "Selected Keywords" and align with the "Overall SEO Strategy" provided in the context.`,
    blog: `Write a professional, high-quality, and SEO-optimized blog post for the given topic.
Requirements:
1. Engaging, high-CTR Title (H1).
2. Content Structure: TOC, Introduction, Key Takeaways, Body, FAQ, CTA.
3. Formatting: Use H1, H2, H3 tags, bullet points, and bold text.
4. SEO: Include meta title, meta description, and 5-8 keywords.
5. Image: Provide a detailed description for a featured image (16:9).

IMPORTANT: Prioritize using the "Selected Keywords" and align with the "Overall SEO Strategy" provided in the context.`,
    strategy: `Analyze the following store information and provide a comprehensive SEO strategy and keyword list.
Please provide:
1. Overall SEO Strategy (The text MUST be in Chinese / 整体 SEO 策略的文案必须为中文, detailed and professional. Include: 1. On-site technical optimization; 2. Content marketing and blog strategy; 3. Backlink building ideas; 4. Localization suggestions for the target market.)
2. Recommended Keywords (An array of keywords, MUST be in the target language.)`,
    imageAlt: `Generate a descriptive and SEO-friendly image Alt text in the target language.
Include relevant keywords and describe the image content accurately for search engines.
Prioritize using the "Selected Keywords" and align with the "Overall SEO Strategy" provided in the context.`,
    fieldTitle: `Optimize the SEO Title for this item in the target language.
Max 70 characters. Must be catchy and include primary keywords.
Prioritize using the "Selected Keywords" and align with the "Overall SEO Strategy" provided in the context.`,
    fieldDescription: `Optimize the SEO Description for this item in the target language.
Max 160 characters. Must be compelling and include primary keywords to improve CTR.
Prioritize using the "Selected Keywords" and align with the "Overall SEO Strategy" provided in the context.`,
    keywords: `Generate highly relevant SEO keywords in the target language for this item.
IMPORTANT: All generated keywords MUST be in the target language.
Prioritize using the "Selected Keywords" and align with the "Overall SEO Strategy" provided in the context.`,
    blogTopics: `Based on the products and brand, generate creative and SEO-friendly blog post topics.
Optimization Goals:
1. Focus on "High-Value, Low-Competition" long-tail keywords.
2. Vary the Search Intent: Informational, Commercial Investigation, and Navigational.
3. Target specific audience pain points.
Prioritize using the "Selected Keywords" and align with the "Overall SEO Strategy" provided in the context.`,
    blogTopicsManual: `Based on the provided keywords, products, and pages, generate creative and SEO-friendly blog post topics.
Prioritize using the "Selected Keywords" and align with the "Overall SEO Strategy" provided in the context.`,
    seoAudit: `Analyze this product and provide SEO optimization suggestions in the target language.
Include: Optimized Title (max 70 chars), Optimized Summary (max 500 chars), Recommended Keywords, and Alt text suggestions.
Prioritize using the "Selected Keywords" and align with the "Overall SEO Strategy" provided in the context.`
  };

  const [customPrompts, setCustomPrompts] = useState(DEFAULT_PROMPTS);
  const [isPromptModalOpen, setIsPromptModalOpen] = useState(false);
  const [activePromptCategory, setActivePromptCategory] = useState<'general' | 'seo' | 'content' | 'blog'>('general');
  const [selectedModel, setSelectedModel] = useState('gemini-3-flash-preview');
  const [selectedMode, setSelectedMode] = useState('balanced');
  const [editingPrompts, setEditingPrompts] = useState(DEFAULT_PROMPTS);

  useEffect(() => {
    geminiService.setModel(selectedModel);
  }, [selectedModel]);

  useEffect(() => {
    geminiService.setMode(selectedMode);
  }, [selectedMode]);

  const [activeTab, setActiveTab] = useState<'audit' | 'ai' | 'tracking' | 'blog' | 'fix'>(initialTab);
  
  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    const loadPrompts = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'seoConfigs', 'prompts'));
        if (docSnap.exists()) {
          const data = docSnap.data();
          const mergedPrompts = {
            seo: data.seo || DEFAULT_PROMPTS.seo,
            blog: data.blog || DEFAULT_PROMPTS.blog,
            strategy: data.strategy || DEFAULT_PROMPTS.strategy,
            imageAlt: data.imageAlt || DEFAULT_PROMPTS.imageAlt,
            fieldTitle: data.fieldTitle || DEFAULT_PROMPTS.fieldTitle,
            fieldDescription: data.fieldDescription || DEFAULT_PROMPTS.fieldDescription,
            keywords: data.keywords || DEFAULT_PROMPTS.keywords,
            blogTopics: data.blogTopics || DEFAULT_PROMPTS.blogTopics,
            blogTopicsManual: data.blogTopicsManual || DEFAULT_PROMPTS.blogTopicsManual,
            seoAudit: data.seoAudit || DEFAULT_PROMPTS.seoAudit
          };
          setCustomPrompts(mergedPrompts);
          setEditingPrompts(mergedPrompts);
        }
      } catch (error) {
        console.error('Failed to load prompts:', error);
      }
    };
    loadPrompts();
  }, []);

  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [auditResults, setAuditResults] = useState<{
    score: number;
    issues: AuditIssue[];
    stats: { [key: string]: number };
  } | null>(null);

  const [aiMode, setAiMode] = useState<'chat' | 'list'>(initialMode);
  
  useEffect(() => {
    setAiMode(initialMode);
  }, [initialMode]);
  const [globalAiTab, setGlobalAiTab] = useState<'products' | 'collections' | 'blogs' | 'blogSets' | 'pages' | 'images'>('products');
  const [fixAiTab, setFixAiTab] = useState<'products' | 'collections' | 'blogs' | 'blogSets' | 'pages' | 'images'>('products');
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [batchIsGenerating, setBatchIsGenerating] = useState(false);
  const [isGeneratingKeywords, setIsGeneratingKeywords] = useState<string | null>(null);
  const [isGeneratingAlt, setIsGeneratingAlt] = useState<string | null>(null);
  const [isOptimizingItem, setIsOptimizingItem] = useState<string | null>(null);
  
  // SEO Generation Settings
  const [keywordCount, setKeywordCount] = useState(5);
  const [keywordLanguage, setKeywordLanguage] = useState('英语');
  const [brandName, setBrandName] = useState('');
  const [excludedKeywords, setExcludedKeywords] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [globalFilterStatus, setGlobalFilterStatus] = useState<'all' | 'empty' | 'filled' | 'needs_optimization' | 'optimized'>('all');
  const [fixFilterStatus, setFixFilterStatus] = useState<'all' | 'empty' | 'filled' | 'needs_optimization' | 'optimized'>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('all');
  const [selectedPageId, setSelectedPageId] = useState<string>('all');
  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  const [globalFilterIds, setGlobalFilterIds] = useState<string[] | null>(null);
  const [fixFilterIds, setFixFilterIds] = useState<string[] | null>(null);
  const [activeFixIssueTitle, setActiveFixIssueTitle] = useState<string>('');
  const [activeFixIssueDesc, setActiveFixIssueDesc] = useState<string>('');

  // Dynamic state proxies so all list operations target correct mode state without altering file logic
  const aiTab = activeTab === 'fix' ? fixAiTab : globalAiTab;
  const filterStatus = activeTab === 'fix' ? fixFilterStatus : globalFilterStatus;
  const filterIds = activeTab === 'fix' ? fixFilterIds : globalFilterIds;

  const setAiTab = activeTab === 'fix' ? setFixAiTab : setGlobalAiTab;
  const setFilterStatus = activeTab === 'fix' ? setFixFilterStatus : setGlobalFilterStatus;
  const setFilterIds = activeTab === 'fix' ? setFixFilterIds : setGlobalFilterIds;
  const [selectedIssue, setSelectedIssue] = useState<AuditIssue | null>(null);
  const [lastCompressedId, setLastCompressedId] = useState<string | null>(null);
  const [expandedIssueIds, setExpandedIssueIds] = useState<string[]>([]);
  const [auditViewMode, setAuditViewMode] = useState<'by-issue' | 'by-page'>('by-issue');
  const [expandedPageIds, setExpandedPageIds] = useState<string[]>([]);

  // Conversational AI SEO state
  const [storeInfo, setStoreInfo] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<{
    strategy: string;
    keywords: string[];
  } | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState(0);
  const [executionStatus, setExecutionStatus] = useState('');
  const [editableKeywords, setEditableKeywords] = useState<string[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [savedFileName, setSavedFileName] = useState<string | null>(null);
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const keywordImportRef = React.useRef<HTMLInputElement>(null);
  const [executionHistory, setExecutionHistory] = useState<ExecutionHistory[]>([]);
  const [historyItemId, setHistoryItemId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [executionConfirmed, setExecutionConfirmed] = useState(false);
  const [isFinalConfirmed, setIsFinalConfirmed] = useState(false);
  const [targetMarket, setTargetMarket] = useState<string[]>(['美国']);
  const [targetLanguage, setTargetLanguage] = useState('英语');
  const [isCompressing, setIsCompressing] = useState<string | null>(null);
  const [imageCompressionLevel, setImageCompressionLevel] = useState<'fast' | 'balanced' | 'high'>('balanced');
  const [autoCompressTypes, setAutoCompressTypes] = useState<string[]>(['product', 'collection', 'blog']);
  const [showImageSettings, setShowImageSettings] = useState(false);
  const [previewImage, setPreviewImage] = useState<{ url: string; name: string } | null>(null);

  // New states for SEO management
  const [editingItem, setEditingItem] = useState<any>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isBatchKeywordModalOpen, setIsBatchKeywordModalOpen] = useState(false);
  const [batchKeywordsInput, setBatchKeywordsInput] = useState('');
  const [batchIsOptimizingField, setBatchIsOptimizingField] = useState<string | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [showManagementOnboarding, setShowManagementOnboarding] = useState(false);
  const [onboardingStep, setOnboardingStep] = useState(0);
  const [itemSuggestions, setItemSuggestions] = useState<{[key: string]: any}>({});
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState<string | null>(null);
  const [isBatchGeneratingSuggestions, setIsBatchGeneratingSuggestions] = useState(false);
  const [confirmingApplyId, setConfirmingApplyId] = useState<string | null>(null);
  const [inlineEditing, setInlineEditing] = useState<{ id: string; field: string; value: string } | null>(null);

  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showStrategyWarningModal, setShowStrategyWarningModal] = useState(false);

  const issuesByPage = useMemo(() => {
    if (!auditResults?.issues) return [];
    const pageMap = new Map<string, {
      item: any;
      itemType: string;
      issues: Array<{
        id: string;
        title: string;
        category: string;
        severity: 'high' | 'medium' | 'low';
        description: string;
        recommendation: string;
        targetTab?: 'products' | 'collections' | 'blogs' | 'blogSets' | 'pages' | 'images';
      }>;
    }>();

    auditResults.issues.forEach(issue => {
      if (issue.affectedItems) {
        issue.affectedItems.forEach(item => {
          if (!item || !item.id) return;
          const itemId = item.id;
          let existing = pageMap.get(itemId);
          if (!existing) {
            // Determine item type
            let itemType = '自定义页面';
            if (products.some(p => p.id === itemId)) itemType = '商品页面';
            else if (collections.some(c => c.id === itemId)) itemType = '分类系列';
            else if (blogs.some(b => b.id === itemId)) itemType = '博客文章';
            else if (blogSets.some(bs => bs.id === itemId)) itemType = '博客目录';
            
            existing = {
              item,
              itemType,
              issues: []
            };
            pageMap.set(itemId, existing);
          }
          // Avoid duplicates
          if (!existing.issues.some(i => i.id === issue.id)) {
            existing.issues.push({
              id: issue.id,
              title: issue.title,
              category: issue.category,
              severity: issue.severity,
              description: issue.description,
              recommendation: issue.recommendation,
              targetTab: issue.targetTab,
            });
          }
        });
      }
    });

    return Array.from(pageMap.values());
  }, [auditResults, products, collections, blogs, blogSets, pages]);

  const lastToastTime = useRef<number>(0);

  const checkStrategyAndProceed = (silent = false) => {
    if (!aiAnalysis?.strategy) {
      if (!silent) {
        setShowStrategyWarningModal(true);
      }
      return false;
    }
    return true;
  };

  const StrategyBanner = () => {
    if (aiAnalysis?.strategy || (activeTab !== 'ai' && activeTab !== 'fix' && activeTab !== 'audit')) return null;
    return (
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-6 p-5 bg-amber-50 border border-amber-200 rounded-3xl flex items-start gap-4 shadow-sm"
      >
        <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
          <ICONS.Zap className="w-6 h-6" />
        </div>
        <div className="space-y-1 py-1">
          <h4 className="text-sm font-black text-amber-900">提示：尚未生成 SEO 策略</h4>
          <p className="text-xs text-amber-700 leading-relaxed font-medium">
            为了获得更精准的 AI 优化内容，建议您先点击左侧的 <span className="text-amber-900 font-bold underline decoration-amber-300">SEO 策略</span> 并输入品牌信息生成全局优化方案。
          </p>
        </div>
        <button 
          onClick={() => {
            setAiMode('chat');
            setActiveTab('ai');
          }}
          className="ml-auto px-4 py-2 bg-amber-600 text-white text-xs font-bold rounded-xl hover:bg-amber-700 transition-all flex items-center gap-2 self-center shrink-0 shadow-md shadow-amber-200"
        >
          前往设置
          <ICONS.ChevronRight className="w-3 h-3" />
        </button>
      </motion.div>
    );
  };

  // Load global SEO config
  useEffect(() => {
    const unsubscribe = onSnapshot(doc(db, 'seoConfigs', 'global'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.strategy) {
          setAiAnalysis({
            strategy: data.strategy,
            keywords: data.keywords || []
          });
        }
        if (data.keywords) {
          setEditableKeywords(data.keywords);
          setSelectedKeywords(data.keywords);
        }
        setBrandName(data.brandName || '');
        setExcludedKeywords(data.excludedKeywords || '');
        setStoreInfo(data.storeInfo || '');
        setSavedFileName(data.uploadedFileName || null);
        if (data.targetMarket) {
          setTargetMarket(Array.isArray(data.targetMarket) ? data.targetMarket : [data.targetMarket]);
        } else {
          setTargetMarket(['美国']);
        }
        setTargetLanguage(data.targetLanguage || '英语');
        setKeywordCount(data.keywordCount || 5);
        setKeywordLanguage(data.targetLanguage || '英语');
        if (data.selectedModel) setSelectedModel(data.selectedModel);
        if (data.selectedMode) setSelectedMode(data.selectedMode);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, 'seoConfigs/global'));
    return () => unsubscribe();
  }, []);

  // Debounced save for brand settings
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (!brandName && !storeInfo && !excludedKeywords && !uploadedFile) return;
      
      try {
        await updateDoc(doc(db, 'seoConfigs', 'global'), {
          brandName,
          storeInfo,
          excludedKeywords,
          targetMarket,
          uploadedFileName: uploadedFile?.name || savedFileName || null,
          updatedAt: new Date().toISOString()
        });
      } catch (error) {
        // If document doesn't exist, create it
        try {
          await setDoc(doc(db, 'seoConfigs', 'global'), {
            brandName,
            storeInfo,
            excludedKeywords,
            targetMarket,
            uploadedFileName: uploadedFile?.name || savedFileName || null,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (e) {
          console.error('Failed to save brand settings:', e);
        }
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [brandName, storeInfo, excludedKeywords, uploadedFile, targetMarket]);

  // Check for first-time user onboarding
  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem('seo_onboarding_seen');
    if (!hasSeenOnboarding) {
      setShowOnboarding(true);
    }
    
    const hasSeenManagementOnboarding = localStorage.getItem('seo_management_onboarding_seen');
    if (!hasSeenManagementOnboarding && activeTab === 'ai' && aiMode === 'list') {
      setShowManagementOnboarding(true);
    }
  }, [activeTab, aiMode]);

  const handleCloseOnboarding = () => {
    localStorage.setItem('seo_onboarding_seen', 'true');
    setShowOnboarding(false);
  };

  const handleCloseManagementOnboarding = () => {
    localStorage.setItem('seo_management_onboarding_seen', 'true');
    setShowManagementOnboarding(false);
  };

  const onboardingSteps = [
    {
      title: '第一步：AI 策略生成',
      description: '输入品牌信息，生成专属 SEO 方案。',
      icon: <ICONS.Zap className="w-12 h-12 text-blue-600" />,
      features: ['智能关键词推荐', '品牌定位分析', '一键全局优化', 'SEO 方案导出']
    },
    {
      title: '第二步：智能站点审计',
      description: '全站扫描，发现潜在的 SEO 问题。',
      icon: <ICONS.RefreshCw className="w-12 h-12 text-blue-600" />,
      features: ['总体 SEO 评分', '详细问题列表', '一键处理建议']
    },
    {
      title: '第三步：批量内容优化',
      description: '根据策略批量优化商品、页面和分类。',
      icon: <ICONS.Search className="w-12 h-12 text-blue-600" />,
      features: ['批量生成 SEO 标题', '批量生成 SEO 描述', '图片 Alt 文本优化']
    },
    {
      title: '第四步：博客选题',
      description: '生成内容灵感生成博客。',
      icon: <ICONS.TrendingUp className="w-12 h-12 text-blue-600" />,
      features: ['AI 博客选题生成', '内容灵感库', '一键生成草稿']
    }
  ];

  // Reset filters when aiTab changes
  useEffect(() => {
    setSelectedTag('all');
    setSelectedCollectionId('all');
    setSelectedPageId('all');
    setSelectedProductId('all');
  }, [aiTab]);

  // Reset filters when fixAiTab changes
  useEffect(() => {
    setSelectedTag('all');
    setSelectedCollectionId('all');
    setSelectedPageId('all');
    setSelectedProductId('all');
  }, [fixAiTab]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    products.forEach(p => {
      if (p.tags) p.tags.forEach(t => tags.add(t));
    });
    return Array.from(tags).sort();
  }, [products]);

  // Mock data for tracking
  const rankingData = [
    { date: '03-14', rank: 12 },
    { date: '03-15', rank: 10 },
    { date: '03-16', rank: 8 },
    { date: '03-17', rank: 9 },
    { date: '03-18', rank: 5 },
    { date: '03-19', rank: 4 },
    { date: '03-20', rank: 3 },
  ];

  const trafficData = [
    { name: '周一', organic: 400, referral: 240, direct: 200 },
    { name: '周二', organic: 300, referral: 139, direct: 221 },
    { name: '周三', organic: 200, referral: 980, direct: 229 },
    { name: '周四', organic: 278, referral: 390, direct: 200 },
    { name: '周五', organic: 189, referral: 480, direct: 218 },
    { name: '周六', organic: 239, referral: 380, direct: 250 },
    { name: '周日', organic: 349, referral: 430, direct: 210 },
  ];

  const keywordDistribution = [
    { name: '前 3 名', value: 15, color: '#22c55e' },
    { name: '前 10 名', value: 35, color: '#3b82f6' },
    { name: '前 50 名', value: 45, color: '#eab308' },
    { name: '50 名以后', value: 55, color: '#94a3b8' },
  ];

  const rankingChanges = [
    { keyword: '时尚女装', change: 5, current: 3, trend: 'up' },
    { keyword: '复古连衣裙', change: 12, current: 8, trend: 'up' },
    { keyword: '夏季凉鞋', change: -2, current: 15, trend: 'down' },
    { keyword: '真皮包包', change: 8, current: 4, trend: 'up' },
    { keyword: '配饰推荐', change: -4, current: 22, trend: 'down' },
  ];

  const [competitorData, setCompetitorData] = useState([
    { name: '您的店铺', score: 85, traffic: 12000, keywords: 450 },
    { name: '竞品 A', score: 78, traffic: 10500, keywords: 380 },
    { name: '竞品 B', score: 92, traffic: 15000, keywords: 620 },
  ]);
  const [isRecommendingCompetitors, setIsRecommendingCompetitors] = useState(false);
  const [showAddCompetitor, setShowAddCompetitor] = useState(false);
  const [newCompetitorName, setNewCompetitorName] = useState('');

  const keywordSourceData = [
    { keyword: '时尚女装', clicks: 1240, ctr: '4.2%', avgPos: 3.2 },
    { keyword: '复古连衣裙', clicks: 850, ctr: '3.8%', avgPos: 5.1 },
    { keyword: '夏季凉鞋', clicks: 620, ctr: '2.5%', avgPos: 8.4 },
    { keyword: '真皮包包', clicks: 450, ctr: '5.1%', avgPos: 2.8 },
    { keyword: '配饰推荐', clicks: 310, ctr: '1.8%', avgPos: 12.5 },
  ];

  const handleSavePrompts = async () => {
    try {
      await setDoc(doc(db, 'seoConfigs', 'prompts'), editingPrompts);
      await updateDoc(doc(db, 'seoConfigs', 'global'), {
        selectedModel,
        selectedMode,
        updatedAt: new Date().toISOString()
      });
      setCustomPrompts(editingPrompts);
      setIsPromptModalOpen(false);
    } catch (error) {
      console.error('Failed to save prompts:', error);
    }
  };

  const handleResetPrompts = (type: keyof typeof DEFAULT_PROMPTS) => {
    setEditingPrompts(prev => ({
      ...prev,
      [type]: DEFAULT_PROMPTS[type]
    }));
  };

  const runAudit = () => {
    if (!checkStrategyAndProceed()) return;
    setIsScanning(true);
    setScanProgress(0);
    
    const interval = setInterval(() => {
      setScanProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsScanning(false);
          performAudit();
          return 100;
        }
        return prev + 10;
      });
    }, 150);
  };

  const performAudit = () => {
    const allItems = [...products, ...collections, ...blogs, ...blogSets, ...pages].filter(item => !item.seoOptimized);
    const issues: AuditIssue[] = [];
    
    // --- 1. SEO Meta Tags ---
    const missingTitles = allItems.filter(item => !item.seoTitle);
    const shortTitles = allItems.filter(item => item.seoTitle && item.seoTitle.length < 30);
    const missingDescriptions = allItems.filter(item => !item.seoDescription);
    const shortDescriptions = allItems.filter(item => item.seoDescription && item.seoDescription.length < 50);

    if (missingTitles.length > 0) {
      issues.push({
        id: 'meta-title-missing',
        category: 'SEO 基础标签',
        severity: 'high',
        title: '缺少 SEO 标题',
        description: `发现 ${missingTitles.length} 个页面缺少 SEO 标题，这会严重影响搜索排名。`,
        recommendation: '为所有页面添加包含核心关键词的 SEO 标题。',
        affectedItems: missingTitles,
        targetTab: 'products'
      });
    }

    if (shortTitles.length > 0) {
      issues.push({
        id: 'meta-title-short',
        category: 'SEO 基础标签',
        severity: 'medium',
        title: 'SEO 标题过短',
        description: `有 ${shortTitles.length} 个页面的标题长度不足 30 字符，无法充分展示关键词。`,
        recommendation: '优化标题长度至 30-70 字符，包含更多相关关键词。',
        affectedItems: shortTitles,
        targetTab: 'products'
      });
    }

    if (missingDescriptions.length > 0) {
      issues.push({
        id: 'meta-desc-missing',
        category: 'SEO 基础标签',
        severity: 'high',
        title: '缺少 SEO 描述',
        description: `发现 ${missingDescriptions.length} 个页面缺少 SEO 描述，搜索引擎将自动抓取内容，可能不够吸引人。`,
        recommendation: '为每个页面编写独特的、具有吸引力的 SEO 描述。',
        affectedItems: missingDescriptions,
        targetTab: 'products'
      });
    }

    // --- 2. Page Structure ---
    // H1 check: Assume title is H1. H1 per page: 1.
    const missingH1 = allItems.filter(item => !item.title);
    const h1MissingKeywords = allItems.filter(item => {
      if (!item.title || !item.keywords || item.keywords.length === 0) return false;
      return !item.keywords.some(kw => item.title.toLowerCase().includes(kw.toLowerCase()));
    });

    // Heading hierarchy check (H2-H6)
    const hierarchyIssues = allItems.filter(item => {
      const content = (item as any).content || (item as any).description || '';
      const headings = Array.from(content.matchAll(/<h([2-6])[^>]*>/gi)).map(m => parseInt((m as any)[1]));
      if (headings.length <= 1) return false;
      for (let i = 0; i < headings.length - 1; i++) {
        if (headings[i+1] > headings[i] + 1) return true; // Skipping levels (e.g., H2 to H4)
      }
      return false;
    });

    if (missingH1.length > 0) {
      issues.push({
        id: 'structure-h1-missing',
        category: '页面结构',
        severity: 'high',
        title: '缺少 H1 标签',
        description: `发现 ${missingH1.length} 个页面缺少 H1 标签（主标题）。`,
        recommendation: '确保每个页面都有且仅有一个 H1 标签。',
        affectedItems: missingH1,
        targetTab: 'products'
      });
    }

    if (h1MissingKeywords.length > 0) {
      issues.push({
        id: 'structure-h1-no-keywords',
        category: '页面结构',
        severity: 'medium',
        title: 'H1 标签未包含关键词',
        description: `有 ${h1MissingKeywords.length} 个页面的 H1 标签未包含任何核心关键词。`,
        recommendation: '在 H1 标签中自然地融入核心关键词。前往对应页面编辑页面标题',
        affectedItems: h1MissingKeywords,
        targetTab: 'products'
      });
    }

    if (hierarchyIssues.length > 0) {
      issues.push({
        id: 'structure-hierarchy-skip',
        category: '页面结构',
        severity: 'low',
        title: '标题层级跳级',
        description: `发现 ${hierarchyIssues.length} 个页面的标题结构（H2-H6）层级不清晰，存在跳级现象。`,
        recommendation: '遵循正确的 HTML 标题层级（H1 > H2 > H3...），不要跳过层级。',
        affectedItems: hierarchyIssues,
        targetTab: 'products'
      });
    }

    // --- 3. URL Normalization ---
    const invalidHandles = allItems.filter(item => {
      if (item.id === 'home') return false; // 排除首页检测URL
      const url = item.seoUrl || (item as any).handle || '';
      if (!url) return true;
      const slug = url.split('/').pop() || '';
      return /[^a-z0-9-]/.test(slug) || slug.length < 3;
    });

    if (invalidHandles.length > 0) {
      issues.push({
        id: 'url-normalization-invalid',
        category: 'URL 规范化',
        severity: 'medium',
        title: 'URL 链接不规范',
        description: `发现 ${invalidHandles.length} 个页面的 URL 链接包含大写字母、下划线或过短。`,
        recommendation: '确保所有 URL 仅包含小写字母、数字和连字符 (-)，并具有描述性。',
        affectedItems: invalidHandles,
        targetTab: 'products'
      });
    }

    // --- 4. Image SEO ---
    const images: any[] = [];
    products.filter(p => !p.seoOptimized).forEach(p => p.media.forEach(m => { 
      if (m.type === 'image') {
        images.push({ 
          ...m, 
          id: m.id || `img-${p.id}-${m.url.split('/').pop()}`,
          size: m.size || (Math.floor(Math.random() * 400) + 100) * 1024,
          name: m.name || (m.url ? m.url.split('/').pop() : 'untitled.jpg'),
          parentType: 'product',
          parentId: p.id,
          parentTitle: p.title
        }); 
      } 
    }));
    collections.filter(c => !c.seoOptimized).forEach(c => { 
      if (c.image) {
        images.push({ 
          id: `col-img-${c.id}`, 
          url: c.image, 
          size: (Math.floor(Math.random() * 400) + 100) * 1024, 
          altText: (c as any).imageAlt || '',
          name: (c as any).imageName || c.title || 'collection-image.jpg',
          parentType: 'collection',
          parentId: c.id,
          parentTitle: c.title
        }); 
      } 
    });
    blogs.filter(b => !b.seoOptimized).forEach(b => { 
      if (b.image) {
        images.push({ 
          id: `blog-img-${b.id}`, 
          url: b.image, 
          size: (Math.floor(Math.random() * 400) + 100) * 1024, 
          altText: (b as any).imageAlt || '',
          name: (b as any).imageName || b.title || 'blog-image.jpg',
          parentType: 'blog',
          parentId: b.id,
          parentTitle: b.title
        }); 
      } 
    });

    const missingAlt = images.filter(img => !img.altText);
    const largeImages = images.filter(img => img.size && img.size > 500 * 1024);
    const meaninglessNames = images.filter(img => isImageNameMeaningless(img.name));

    if (missingAlt.length > 0) {
      issues.push({
        id: 'image-alt-missing',
        category: '图片 SEO',
        severity: 'medium',
        title: '图片缺少 Alt 文本',
        description: `发现 ${missingAlt.length} 张图片缺少替代文本 (Alt Text)。`,
        recommendation: '为所有图片添加描述性的 Alt 标签，提升图片搜索排名。',
        affectedItems: missingAlt,
        targetTab: 'images'
      });
    }

    if (largeImages.length > 0) {
      issues.push({
        id: 'image-size-large',
        category: '图片 SEO',
        severity: 'high',
        title: '图片体积过大',
        description: `发现 ${largeImages.length} 张图片超过 500KB，会显著增加页面加载时间。`,
        recommendation: '压缩这些图片或使用 WebP 格式，建议单张图片保持在 500KB 以内。',
        affectedItems: largeImages,
        targetTab: 'images'
      });
    }

    if (meaninglessNames.length > 0) {
      issues.push({
        id: 'image-name-meaningless',
        category: '图片 SEO',
        severity: 'low',
        title: '图片名称不规范 (对 SEO 无意义)',
        description: `发现 ${meaninglessNames.length} 张图片的名称不够规范，或者是系统默认生成的文件名（如 DSC_、IMG_、纯数字或 hash、极短字符等），搜索引擎无法读取。`,
        recommendation: '重命名图片文件，采用连字符 (-) 隔开的具有实际产品/页面意义的拼音或英文小写单词（如 red-leather-jacket.jpg）。',
        affectedItems: meaninglessNames,
        targetTab: 'images'
      });
    }

    // --- 5. Internal Links ---
    // 404 pages (simulated as items with invalid/missing URLs, excluding configured redirects)
    const brokenLinks = allItems.filter(item => !item.seoUrl && !(item as any).handle && !item.redirectUrl);
    
    // Orphan pages: Check if page URL is referenced in other pages' content
    const allUrls = allItems.map(item => item.seoUrl || (item as any).handle || '').filter(Boolean);
    const orphanPages = allItems.filter(item => {
      const itemUrl = item.seoUrl || (item as any).handle || '';
      if (!itemUrl) return false;
      return !allItems.some(other => {
        if (other.id === item.id) return false;
        const otherContent = (other as any).content || (other as any).description || '';
        return otherContent.includes(itemUrl);
      });
    });

    if (brokenLinks.length > 0) {
      issues.push({
        id: 'links-404',
        category: '内链优化',
        severity: 'high',
        title: '发现 404 页面',
        description: `检测到 ${brokenLinks.length} 个页面链接失效或未配置。`,
        recommendation: '修复断开的链接或配置正确的 URL 路径。',
        affectedItems: brokenLinks,
        targetTab: 'products'
      });
    }

    if (orphanPages.length > 0) {
      issues.push({
        id: 'links-orphan',
        category: '内链优化',
        severity: 'low',
        title: '发现孤立页面',
        description: `有 ${orphanPages.length} 个页面没有来自其他页面的链接。`,
        recommendation: '确保每个页面至少有一个来自其他页面的内链，提升抓取效率。',
        affectedItems: orphanPages,
        targetTab: 'products'
      });
    }

    // Score Calculation
    let score = 100;
    
    if (allItems.length > 0) {
      // 1. Meta Tags (25%)
      const metaPenalty = (missingTitles.length / allItems.length) * 15 + (missingDescriptions.length / allItems.length) * 10;
      score -= Math.min(25, metaPenalty);

      // 2. Page Structure (20%)
      const structurePenalty = (missingH1.length / allItems.length) * 10 + (h1MissingKeywords.length / allItems.length) * 5 + (hierarchyIssues.length / allItems.length) * 5;
      score -= Math.min(20, structurePenalty);

      // 3. URL Normalization (15%)
      const urlPenalty = (invalidHandles.length / allItems.length) * 15;
      score -= Math.min(15, urlPenalty);

      // 4. Image SEO (20%)
      const imagePenalty = images.length > 0 ? (missingAlt.length / images.length) * 8 + (largeImages.length / images.length) * 8 + (meaninglessNames.length / images.length) * 4 : 0;
      score -= Math.min(20, imagePenalty);

      // 5. Internal Links (20%)
      const linksPenalty = (brokenLinks.length / allItems.length) * 15 + (orphanPages.length / allItems.length) * 5;
      score -= Math.min(20, linksPenalty);
    }

    // Calculate coverage stats by counting items without issues in each category
    const itemsWithMetaIssues = new Set([...missingTitles.map(i => i.id), ...missingDescriptions.map(i => i.id)]);
    const itemsWithStructureIssues = new Set([...missingH1.map(i => i.id), ...h1MissingKeywords.map(i => i.id), ...hierarchyIssues.map(i => i.id)]);
    const itemsWithUrlIssues = new Set(invalidHandles.map(i => i.id));
    const imagesWithIssues = new Set([...missingAlt.map(i => i.id), ...largeImages.map(i => i.id), ...meaninglessNames.map(i => i.id)]);
    const itemsWithLinkIssues = new Set([...brokenLinks.map(i => i.id), ...orphanPages.map(i => i.id)]);

    const sortedIssues = issues.sort((a, b) => {
      const severityMap = { high: 3, medium: 2, low: 1 };
      return severityMap[b.severity] - severityMap[a.severity];
    });

    const totalCount = allItems.length;
    const totalUrlCheckedCount = allItems.filter(item => item.id !== 'home').length;

    setAuditResults({
      score: Math.max(0, Math.round(score)),
      issues: sortedIssues,
      stats: {
        'SEO 基础标签': totalCount > 0 ? Math.round(((totalCount - itemsWithMetaIssues.size) / totalCount) * 100) : 100,
        '页面结构': totalCount > 0 ? Math.round(((totalCount - itemsWithStructureIssues.size) / totalCount) * 100) : 100,
        'URL 规范化': totalUrlCheckedCount > 0 ? Math.round(((totalUrlCheckedCount - itemsWithUrlIssues.size) / totalUrlCheckedCount) * 100) : 100,
        '图片 SEO': images.length > 0 ? Math.round(((images.length - imagesWithIssues.size) / images.length) * 100) : 100,
        '内链优化': totalCount > 0 ? Math.round(((totalCount - itemsWithLinkIssues.size) / totalCount) * 100) : 100,
      }
    });

    // Automatically trigger AI suggestion generation for affected items is removed per user request: "检测不生成 ai 优化建议"
    // handleAutoGenerateAuditSuggestions(sortedIssues);
  };

  const handleAutoGenerateAuditSuggestions = async (issues: AuditIssue[]) => {
    // Check strategy once at the beginning, but keep it silent as audit itself shouldn't necessarily block if strategy is missing
    // however, since suggestions require a strategy, we skip if it's missing.
    if (!checkStrategyAndProceed(true)) return;

    const itemsToOptimize: { item: any, type: string }[] = [];
    const seenIds = new Set();

    issues.forEach(issue => {
      if (issue.affectedItems && issue.targetTab && issue.targetTab !== 'images') {
        const type = issue.targetTab.slice(0, -1); // 'products' -> 'product'
        issue.affectedItems.forEach(item => {
          if (!seenIds.has(item.id)) {
            seenIds.add(item.id);
            itemsToOptimize.push({ item, type });
          }
        });
      }
    });

    if (itemsToOptimize.length === 0) return;

    setIsBatchGeneratingSuggestions(true);
    try {
      for (const { item, type } of itemsToOptimize) {
        // Skip if suggestion already exists
        if (itemSuggestions[item.id]) continue;
        await handleGenerateSuggestions(item, type);
      }
    } catch (error) {
      console.error('Auto-generation of audit suggestions failed:', error);
    } finally {
      setIsBatchGeneratingSuggestions(false);
    }
  };

  const handleAiGenerate = async (type: any, item: any) => {
    setIsGenerating(item.id);
    try {
      const result = await geminiService.generateSEOContent(type, item, keywordCount, keywordLanguage, brandName, aiAnalysis?.strategy, selectedKeywords, excludedKeywords, '', customPrompts.seo);
      const collectionName = type === 'product' ? 'products' : type === 'collection' ? 'collections' : type === 'blog' ? 'blogs' : 'pages';
      
      // Save current state to history
      const historyEntry = {
        seoTitle: item.seoTitle,
        seoDescription: item.seoDescription,
        seoUrl: item.seoUrl,
        keywords: [...(item.keywords || [])],
        updatedAt: new Date().toISOString()
      };
      
      const newHistory = [historyEntry, ...(item.history || [])].slice(0, 10);

      const updatedItem = {
        ...item,
        seoTitle: result.seoTitle,
        seoDescription: result.seoDescription,
        seoUrl: result.seoUrl,
        keywords: result.keywords,
        history: newHistory,
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, collectionName, item.id), cleanObject(updatedItem));
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('AI Generation failed:', error);
    } finally {
      setIsGenerating(null);
    }
  };

  const handleRestoreItemHistory = async (history: any) => {
    try {
      const item = [...products, ...collections, ...blogs, ...pages].find(i => i.id === historyItemId) as any;
      if (!item) return;

      let type: any = 'product';
      if (collections.find(c => c.id === item.id)) type = 'collection';
      else if (blogs.find(b => b.id === item.id)) type = 'blog';
      else if (pages.find(p => p.id === item.id)) type = 'page';

      const collectionName = type === 'product' ? 'products' : type === 'collection' ? 'collections' : type === 'blog' ? 'blogs' : 'pages';
      
      const historyEntry = {
        seoTitle: item.seoTitle ?? '',
        seoDescription: item.seoDescription ?? '',
        seoUrl: item.seoUrl ?? '',
        keywords: [...(item.keywords ?? [])],
        altText: item.altText ?? item.imageAlt ?? '',
        updatedAt: item.updatedAt ?? new Date().toISOString()
      };
      
      const newHistory = [historyEntry, ...(item.history || [])].slice(0, 10);

      const updateData: any = { ...item, history: newHistory, updatedAt: new Date().toISOString() };
      if (history.seoTitle !== undefined) updateData.seoTitle = history.seoTitle;
      if (history.seoDescription !== undefined) updateData.seoDescription = history.seoDescription;
      if (history.keywords !== undefined) updateData.keywords = history.keywords;
      if (history.seoUrl !== undefined) updateData.seoUrl = history.seoUrl;
      
      if (history.altText !== undefined) {
        if (item.parentType === 'product') {
          const product = products.find(p => p.id === item.parentId);
          if (product) {
            const originalMediaItem = product.media.find((m: any) => (m.id || `img-${product.id}-${m.url.split('/').pop()}`) === item.id);
            const mediaHistoryEntry = {
              altText: originalMediaItem?.altText ?? '',
              updatedAt: new Date().toISOString()
            };
            const newMediaHistory = [mediaHistoryEntry, ...(originalMediaItem?.history || [])].slice(0, 10);
            
            const newMedia = product.media.map(m => {
              const mid = m.id || `img-${product.id}-${m.url.split('/').pop()}`;
              return mid === item.id ? { ...m, altText: history.altText, history: newMediaHistory } : m;
            });
            await setDoc(doc(db, 'products', product.id), cleanObject({ ...product, media: newMedia, updatedAt: new Date().toISOString() }));
            setShowHistory(false);
            setHistoryItemId(null);
            return;
          }
        } else if (item.parentType === 'collection') {
          updateData.imageAlt = history.altText;
        } else if (item.parentType === 'blog') {
          updateData.imageAlt = history.altText;
        }
      }

      await setDoc(doc(db, collectionName, item.id), cleanObject(updateData));
      setShowHistory(false);
      setHistoryItemId(null);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Restore history failed:', error);
    }
  };

  const handleGenerateKeywords = async (type: any, item: any) => {
    if (!checkStrategyAndProceed()) return;
    setIsGeneratingKeywords(item.id);
    try {
      const keywords = await geminiService.generateKeywords(type, item, keywordCount, keywordLanguage, brandName, aiAnalysis?.strategy, selectedKeywords, excludedKeywords, customPrompts.keywords);
      
      setItemSuggestions(prev => ({
        ...prev,
        [item.id]: {
          ...(prev[item.id] || {}),
          keywords: keywords
        }
      }));
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Keyword generation failed:', error);
    } finally {
      setIsGeneratingKeywords(null);
    }
  };

  const handleUpdateKeywords = async (type: any, item: any, keywords: string[]) => {
    try {
      const collectionName = type === 'product' ? 'products' : type === 'collection' ? 'collections' : type === 'blog' ? 'blogs' : 'pages';
      
      // Save current state to history
      const historyEntry = {
        seoTitle: item.seoTitle,
        seoDescription: item.seoDescription,
        seoUrl: item.seoUrl,
        keywords: [...(item.keywords || [])],
        updatedAt: new Date().toISOString()
      };
      
      const newHistory = [historyEntry, ...(item.history || [])].slice(0, 10);

      const updatedItem = {
        ...item,
        keywords,
        primaryKeyword: keywords.includes(item.primaryKeyword) ? item.primaryKeyword : '',
        history: newHistory,
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, collectionName, item.id), cleanObject(updatedItem));
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Update keywords failed:', error);
    }
  };

  const handleUpdateAltText = async (item: any, newAlt: string, newName?: string) => {
    try {
      // Find original item to save its state to history
      let originalItem: any = null;
      let originalMediaItem: any = null;

      if (item.parentType === 'product') {
        originalItem = products.find(p => p.id === item.parentId);
        if (originalItem) {
          originalMediaItem = originalItem.media.find((m: any) => (m.id || `img-${originalItem.id}-${m.url.split('/').pop()}`) === item.id);
        }
      } else if (item.parentType === 'collection') {
        originalItem = collections.find(c => c.id === item.parentId);
      } else if (item.parentType === 'blog') {
        originalItem = blogs.find(b => b.id === item.parentId);
      }

      const source = originalMediaItem || originalItem || item;

      // Save current state to history
      const historyEntry = {
        seoTitle: source.seoTitle ?? '',
        seoDescription: source.seoDescription ?? '',
        seoUrl: source.seoUrl ?? '',
        keywords: [...(source.keywords ?? [])],
        altText: source.altText ?? source.imageAlt ?? '',
        name: source.name ?? source.imageName ?? '',
        updatedAt: source.updatedAt ?? new Date().toISOString()
      };
      
      const newHistory = [historyEntry, ...(source.history || [])].slice(0, 10);

      if (item.parentType === 'product') {
        const product = products.find(p => p.id === item.parentId);
        if (product) {
          const newMedia = product.media.map(m => {
            const mid = m.id || `img-${product.id}-${m.url.split('/').pop()}`;
            return mid === item.id ? { ...m, altText: newAlt, name: newName !== undefined ? newName : (m.name || ''), history: newHistory } : m;
          });
          await setDoc(doc(db, 'products', product.id), cleanObject({ ...product, media: newMedia, updatedAt: new Date().toISOString() }));
        }
      } else if (item.parentType === 'collection') {
        const collection = collections.find(c => c.id === item.parentId);
        if (collection) {
          const collectionData: any = { ...collection, imageAlt: newAlt, history: newHistory, updatedAt: new Date().toISOString() };
          if (newName !== undefined) {
            collectionData.imageName = newName;
          }
          await setDoc(doc(db, 'collections', collection.id), cleanObject(collectionData));
        }
      } else if (item.parentType === 'blog') {
        const blog = blogs.find(b => b.id === item.parentId);
        if (blog) {
          const blogData: any = { ...blog, imageAlt: newAlt, history: newHistory, updatedAt: new Date().toISOString() };
          if (newName !== undefined) {
            blogData.imageName = newName;
          }
          await setDoc(doc(db, 'blogs', blog.id), cleanObject(blogData));
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `media/${item.id}`);
    }
  };

  const handleCompressImage = async (item: any) => {
    try {
      setIsCompressing(item.id);
      // Mock compression delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Size reduction based on level
      const currentSize = item.size || (Math.floor(Math.random() * 800) + 200) * 1024;
      let reductionMin = 0.4;
      let reductionMax = 0.6;

      if (imageCompressionLevel === 'fast') {
        reductionMin = 0.8;
        reductionMax = 0.9;
      } else if (imageCompressionLevel === 'high') {
        reductionMin = 0.15;
        reductionMax = 0.3;
      }

      const newSize = Math.floor(currentSize * (reductionMin + Math.random() * (reductionMax - reductionMin)));

      if (item.parentType === 'product') {
        const product = products.find(p => p.id === item.parentId);
        if (product) {
          const newMedia = product.media.map(m => {
            const mid = m.id || `img-${product.id}-${m.url.split('/').pop()}`;
            return mid === item.id ? { ...m, size: newSize } : m;
          });
          await setDoc(doc(db, 'products', product.id), cleanObject({ ...product, media: newMedia, updatedAt: new Date().toISOString() }));
        }
      } else if (item.parentType === 'collection') {
        const collection = collections.find(c => c.id === item.parentId);
        if (collection) {
          await setDoc(doc(db, 'collections', collection.id), cleanObject({ ...collection, imageSize: newSize, updatedAt: new Date().toISOString() }));
        }
      } else if (item.parentType === 'blog') {
        const blog = blogs.find(b => b.id === item.parentId);
        if (blog) {
          await setDoc(doc(db, 'blogs', blog.id), cleanObject({ ...blog, imageSize: newSize, updatedAt: new Date().toISOString() }));
        }
      }

      // Update editingItem if it's the one being compressed
      if (editingItem && editingItem.id === item.id) {
        setEditingItem({ ...editingItem, size: newSize });
        setLastCompressedId(item.id);
        setTimeout(() => setLastCompressedId(null), 3000);
      }
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Compression failed:', error);
    } finally {
      setIsCompressing(null);
    }
  };

  const handleGenerateAltText = async (item: any) => {
    setIsGeneratingAlt(item.id);
    try {
      const altText = await geminiService.generateAltText(item.parentTitle, item.name, keywordLanguage, brandName, aiAnalysis?.strategy, selectedKeywords, excludedKeywords, customPrompts.imageAlt);
      await handleUpdateAltText(item, altText);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Generate alt text failed:', error);
    } finally {
      setIsGeneratingAlt(null);
    }
  };

  const handleBatchAiGenerate = async () => {
    if (selectedItems.length === 0) return;
    setBatchIsGenerating(true);
    try {
      const type = aiTab.slice(0, -1) as any;
      const collectionName = aiTab;
      const itemsToOptimize = (aiTab === 'products' ? products : aiTab === 'collections' ? collections : aiTab === 'blogs' ? blogs : pages)
        .filter(item => selectedItems.includes(item.id));

      for (const item of itemsToOptimize) {
        const primaryKeyword = item.primaryKeyword || (item.keywords?.[0] || '');
        const result = await geminiService.generateSEOContent(type, item, keywordCount, keywordLanguage, brandName, aiAnalysis?.strategy, selectedKeywords, excludedKeywords, primaryKeyword, customPrompts.seo);
        
        const historyEntry = {
          seoTitle: item.seoTitle ?? '',
          seoDescription: item.seoDescription ?? '',
          seoUrl: item.seoUrl ?? '',
          keywords: [...(item.keywords ?? [])],
          jsonLd: item.jsonLd ?? null,
          updatedAt: item.updatedAt ?? new Date().toISOString()
        };
        
        const newHistory = [historyEntry, ...(item.history || [])].slice(0, 10);

        const updatedItem = {
          ...item,
          seoTitle: result.seoTitle,
          seoDescription: result.seoDescription,
          seoUrl: result.seoUrl,
          keywords: result.keywords,
          history: newHistory,
          updatedAt: new Date().toISOString()
        };
        await setDoc(doc(db, collectionName, item.id), cleanObject(updatedItem));
      }
      setSelectedItems([]);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Batch AI Generation failed:', error);
    } finally {
      setBatchIsGenerating(false);
    }
  };

  const handleBatchOptimizeField = async (field: 'seoTitle' | 'seoDescription' | 'seoUrl' | 'all') => {
    if (!checkStrategyAndProceed()) return;
    if (selectedItems.length === 0) return;
    setBatchIsOptimizingField(field);
    try {
      const type = aiTab.slice(0, -1) as any;
      const itemsToOptimize = (aiTab === 'products' ? products : aiTab === 'collections' ? collections : aiTab === 'blogs' ? blogs : aiTab === 'blogSets' ? blogSets : pages)
        .filter(item => selectedItems.includes(item.id));

      for (const item of itemsToOptimize) {
        const primaryKeyword = item.primaryKeyword || (item.keywords?.[0] || '');
        const result = await geminiService.generateSEOContent(type, item, keywordCount, keywordLanguage, brandName, aiAnalysis?.strategy, selectedKeywords, excludedKeywords, primaryKeyword, customPrompts.seo);
        
        setItemSuggestions(prev => ({
          ...prev,
          [item.id]: result
        }));
      }
    } catch (error) {
      if (isAbortError(error)) return;
      console.error(`Batch AI Optimization for ${field} failed:`, error);
    } finally {
      setBatchIsOptimizingField(null);
    }
  };

  const handleBatchAdopt = async () => {
    if (selectedItems.length === 0) return;
    setBatchIsOptimizingField('adopt');
    try {
      const collectionName = aiTab;
      const itemsToUpdate = (aiTab === 'products' ? products : aiTab === 'collections' ? collections : aiTab === 'blogs' ? blogs : aiTab === 'blogSets' ? blogSets : pages)
        .filter(item => selectedItems.includes(item.id));

      for (const item of itemsToUpdate) {
        const suggestion = itemSuggestions[item.id];
        if (!suggestion) continue;

        const updatedItem = {
          ...item,
          seoTitle: suggestion.seoTitle || item.seoTitle,
          seoDescription: suggestion.seoDescription || item.seoDescription,
          seoUrl: suggestion.seoUrl || item.seoUrl,
          keywords: suggestion.keywords || item.keywords,
          updatedAt: new Date().toISOString()
        };

        await setDoc(doc(db, collectionName, item.id), cleanObject(updatedItem));
      }

      // Clear suggestions for adopted items
      setItemSuggestions(prev => {
        const next = { ...prev };
        selectedItems.forEach(id => delete next[id]);
        return next;
      });

      setSelectedItems([]);
    } catch (error) {
      console.error('Batch adopt failed:', error);
    } finally {
      setBatchIsOptimizingField(null);
    }
  };

  const handleBatchAddKeywords = async () => {
    if (selectedItems.length === 0 || !batchKeywordsInput.trim()) return;
    setBatchIsGenerating(true);
    try {
      const newKws = batchKeywordsInput.trim().split(/[、,，\n]+/).filter(k => k.trim());
      const collectionName = aiTab;
      const itemsToUpdate = (aiTab === 'products' ? products : aiTab === 'collections' ? collections : aiTab === 'blogs' ? blogs : aiTab === 'blogSets' ? blogSets : pages)
        .filter(item => selectedItems.includes(item.id));

      for (const item of itemsToUpdate) {
        const updatedItem = {
          ...item,
          keywords: [...(item.keywords || []), ...newKws],
          updatedAt: new Date().toISOString()
        };
        await setDoc(doc(db, collectionName, item.id), cleanObject(updatedItem));
      }
      setSelectedItems([]);
      setBatchKeywordsInput('');
      setIsBatchKeywordModalOpen(false);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Batch add keywords failed:', error);
    } finally {
      setBatchIsGenerating(false);
    }
  };

  const handleBatchOptimizeAltText = async () => {
    if (!checkStrategyAndProceed()) return;
    if (selectedItems.length === 0) return;
    setBatchIsOptimizingField('altText' as any);
    try {
      const allImgs: any[] = [];
      products.forEach(p => p.media.forEach(m => { if (m.type === 'image') allImgs.push({ ...m, id: m.id || `img-${p.id}-${m.url.split('/').pop()}`, parentTitle: p.title, parentId: p.id, parentType: 'product' }); }));
      collections.forEach(c => { if (c.image) allImgs.push({ id: `col-img-${c.id}`, url: c.image, name: c.title, parentTitle: c.title, parentId: c.id, parentType: 'collection' }); });
      blogs.forEach(b => { if (b.image) allImgs.push({ id: `blog-img-${b.id}`, url: b.image, name: b.title, parentTitle: b.title, parentId: b.id, parentType: 'blog' }); });

      const itemsToOptimize = allImgs.filter(img => selectedItems.includes(img.id));
      
      const results = await geminiService.optimizeAltTexts(itemsToOptimize, keywordLanguage, brandName, aiAnalysis?.strategy, selectedKeywords, excludedKeywords);
      
      for (const result of results) {
        const item = itemsToOptimize.find(i => i.id === result.id);
        if (item) {
          await handleUpdateAltText(item, result.altText);
        }
      }
      setSelectedItems([]);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Batch AI Alt Text optimization failed:', error);
    } finally {
      setBatchIsOptimizingField(null);
    }
  };

  const handleBatchCompressImages = async () => {
    if (selectedItems.length === 0) return;
    setBatchIsOptimizingField('compress' as any);
    try {
      // Use allImages memo which already includes products, collections, and blogs
      const itemsToCompress = allImages.filter(img => 
        selectedItems.includes(img.id) && 
        autoCompressTypes.includes(img.parentType)
      );
      
      if (itemsToCompress.length === 0) {
        toast.error("所选图片类型不在自动压缩范围内");
        return;
      }

      for (const item of itemsToCompress) {
        await handleCompressImage(item);
      }
      setSelectedItems([]);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Batch compression failed:', error);
    } finally {
      setBatchIsOptimizingField(null);
    }
  };

  const handleCompressAllLargeImages = async (largeImagesList: any[]) => {
    if (largeImagesList.length === 0) return;
    setBatchIsOptimizingField('compress' as any);
    try {
      const itemsToCompress = largeImagesList.filter(img => 
        autoCompressTypes.includes(img.parentType)
      );
      
      if (itemsToCompress.length === 0) {
        toast.error("无可自动压缩的图片类型");
        return;
      }

      for (const item of itemsToCompress) {
        await handleCompressImage(item);
      }
      toast.success("所有过大图片已成功压缩！");
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Batch compression of all large images failed:', error);
      toast.error("部分图片压缩出现异常，请重试");
    } finally {
      setBatchIsOptimizingField(null);
    }
  };

  const handleOptimizeItem = async (item: any, type: 'product' | 'collection' | 'blog' | 'page' | 'image') => {
    if (!checkStrategyAndProceed()) return;
    setIsOptimizingItem(item.id);
    try {
      const collectionName = aiTab;
      if (type === 'image') {
        const result = await geminiService.generateAltText(item.parentTitle, item.name, keywordLanguage, brandName, aiAnalysis?.strategy, selectedKeywords, excludedKeywords, customPrompts.imageAlt);
        await handleUpdateAltText(item, result);
      } else {
        const result = await geminiService.generateSEOContent(type, item, keywordCount, keywordLanguage, brandName, aiAnalysis?.strategy, selectedKeywords, excludedKeywords, '', customPrompts.seo);
        const updatedItem = {
          ...item,
          seoTitle: result.seoTitle,
          seoDescription: result.seoDescription,
          keywords: result.keywords,
          updatedAt: new Date().toISOString()
        };
        await setDoc(doc(db, collectionName, item.id), cleanObject(updatedItem));
      }
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('AI Optimization failed:', error);
    } finally {
      setIsOptimizingItem(null);
    }
  };

  const handleSetPrimaryKeyword = async (type: any, item: any, keyword: string) => {
    try {
      const collectionName = aiTab;
      await updateDoc(doc(db, collectionName, item.id), {
        primaryKeyword: keyword,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${aiTab}/${item.id}`);
    }
  };

  const handleGenerateSuggestions = async (item: any, type: string) => {
    if (!checkStrategyAndProceed()) return;
    setIsGeneratingSuggestions(item.id);
    try {
      const result = await geminiService.generateSEOContent(
        type as any, 
        item, 
        keywordCount, 
        keywordLanguage, 
        brandName, 
        aiAnalysis?.strategy, 
        selectedKeywords, 
        excludedKeywords, 
        item.primaryKeyword || '', 
        customPrompts.seo
      );
      setItemSuggestions(prev => ({
        ...prev,
        [item.id]: result
      }));
    } catch (error) {
      console.error('Failed to generate suggestions:', error);
    } finally {
      setIsGeneratingSuggestions(null);
    }
  };

  const handleApplySuggestion = async (item: any, field: string, value: any) => {
    if (field === 'all') {
      const type = aiTab.slice(0, -1) as any;
      const collectionName = aiTab;
      try {
        const updatedItem = {
          ...item,
          seoTitle: value.seoTitle,
          seoDescription: value.seoDescription,
          seoUrl: value.seoUrl,
          keywords: value.keywords,
          updatedAt: new Date().toISOString()
        };
        await setDoc(doc(db, collectionName, item.id), cleanObject(updatedItem));
        setItemSuggestions(prev => {
          const next = { ...prev };
          delete next[item.id];
          return next;
        });
      } catch (error) {
        console.error('Failed to apply all suggestions:', error);
      }
    } else {
      // For individual fields, enter inline edit mode with the suggestion
      setInlineEditing({
        id: item.id,
        field: field,
        value: Array.isArray(value) ? value.join(', ') : value
      });
    }
  };

  const getItemCollectionName = (item: any) => {
    if (products.some(p => p.id === item.id)) return 'products';
    if (collections.some(c => c.id === item.id)) return 'collections';
    if (blogs.some(b => b.id === item.id)) return 'blogs';
    if (blogSets.some(bs => bs.id === item.id)) return 'blogSets';
    if (pages.some(p => p.id === item.id)) return 'pages';
    return aiTab;
  };

  const getItemPageUrl = (item: any) => {
    const colName = getItemCollectionName(item);
    if (colName === 'pages' && (item.id === 'home' || item.seoUrl === 'home' || item.seoUrl === '')) {
      return '/';
    }
    let prefix = '/';
    if (colName === 'products') prefix = '/products/';
    else if (colName === 'collections') prefix = '/collections/';
    else if (colName === 'blogs') prefix = '/blogs/';
    else if (colName === 'blogSets') prefix = '/blog-sets/';
    else if (colName === 'pages') prefix = '/pages/';

    const slug = item.seoUrl || item.handle || item.id || '';
    return `${prefix}${slug}`;
  };

  const getParentPageUrl = (item: any) => {
    if (!item.parentType || !item.parentId) return '/';

    let prefix = '/';
    let slug = item.parentId;

    if (item.parentType === 'product') {
      prefix = '/products/';
      const parent = products.find(p => p.id === item.parentId);
      if (parent) {
        slug = parent.seoUrl || (parent as any).handle || parent.id;
      }
    } else if (item.parentType === 'collection') {
      prefix = '/collections/';
      const parent = collections.find(c => c.id === item.parentId);
      if (parent) {
        slug = parent.seoUrl || parent.id;
      }
    } else if (item.parentType === 'blog') {
      prefix = '/blogs/';
      const parent = blogs.find(b => b.id === item.parentId);
      if (parent) {
        slug = parent.seoUrl || parent.id;
      }
    } else if (item.parentType === 'blog-set' || item.parentType === 'blogSet') {
      prefix = '/blog-sets/';
      const parent = blogSets.find(bs => bs.id === item.parentId);
      if (parent) {
        slug = parent.seoUrl || parent.id;
      }
    } else if (item.parentType === 'page') {
      prefix = '/pages/';
      const parent = pages.find(p => p.id === item.parentId);
      if (parent) {
        slug = parent.seoUrl || parent.id;
      }
    }

    return `${prefix}${slug}`;
  };

  const handleInlineSave = async () => {
    if (!inlineEditing) return;
    const { id, field, value } = inlineEditing;
    
    try {
      const allLists = [
        { name: 'products', items: products },
        { name: 'collections', items: collections },
        { name: 'blogs', items: blogs },
        { name: 'blogSets', items: blogSets },
        { name: 'pages', items: pages }
      ];
      
      let foundListInfo = allLists.find(li => li.items.some(i => i.id === id));
      const collectionName = foundListInfo ? foundListInfo.name : aiTab;
      const items = foundListInfo ? foundListInfo.items : (aiTab === 'products' ? products : aiTab === 'collections' ? collections : aiTab === 'blogs' ? blogs : pages);
      const item = items.find(i => i.id === id);
      if (!item) return;

      let finalValue: any = value;
      if (field === 'keywords') {
        finalValue = value.split(/[、,，]+/).map(k => k.trim()).filter(Boolean);
      }

      const updatedItem = {
        ...item,
        [field]: finalValue,
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, collectionName, id), cleanObject(updatedItem));
      
      // Clear the suggestion for this field if it matches the saved value
      if (itemSuggestions[id]?.[field]) {
        // Optional: you might want to clear it anyway or only if it matches
      }

      setInlineEditing(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${aiTab}/${id}`);
    }
  };

  const handleUpdateItemSEO = async (updatedData: any) => {
    if (!editingItem) return;
    try {
      const allLists = [
        { name: 'products', items: products },
        { name: 'collections', items: collections },
        { name: 'blogs', items: blogs },
        { name: 'blogSets', items: blogSets },
        { name: 'pages', items: pages }
      ];
      let foundListInfo = allLists.find(li => li.items.some(i => i.id === editingItem.id));
      const collectionName = foundListInfo ? foundListInfo.name : aiTab;
      
      // Find original item to save its state to history (before applying new changes)
      const originalItem = [...products, ...collections, ...blogs, ...pages].find(i => i.id === editingItem.id);
      
      const historyEntry = {
        seoTitle: (originalItem as any)?.seoTitle ?? '',
        seoDescription: (originalItem as any)?.seoDescription ?? '',
        seoUrl: (originalItem as any)?.seoUrl ?? '',
        keywords: [...((originalItem as any)?.keywords ?? [])],
        updatedAt: (originalItem as any)?.updatedAt ?? new Date().toISOString()
      };
      
      const newHistory = [historyEntry, ...(editingItem.history || [])].slice(0, 10);

      const updatedItem = {
        ...editingItem,
        ...updatedData,
        history: newHistory,
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, collectionName, editingItem.id), cleanObject(updatedItem));
      setIsEditModalOpen(false);
      setEditingItem(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `${aiTab}/${editingItem.id}`);
    }
  };

  const handleAiOptimizeItem = async () => {
    if (!checkStrategyAndProceed()) return;
    if (!editingItem) return;
    setIsGenerating(editingItem.id);
    try {
      const type = aiTab.slice(0, -1) as any;
      const primaryKeyword = editingItem.primaryKeyword || (editingItem.keywords?.[0] || '');
      const result = await geminiService.generateSEOContent(type, editingItem, keywordCount, keywordLanguage, brandName, aiAnalysis?.strategy, selectedKeywords, excludedKeywords, primaryKeyword, customPrompts.seo);
      setEditingItem(prev => ({
        ...prev,
        seoTitle: result.seoTitle,
        seoDescription: result.seoDescription,
        keywords: result.keywords
      }));
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('AI Optimization failed:', error);
    } finally {
      setIsGenerating(null);
    }
  };

  const handleAiOptimizeItemField = async (field: 'seoTitle' | 'seoDescription') => {
    if (!checkStrategyAndProceed()) return;
    if (!editingItem) return;
    setIsGenerating(`${editingItem.id}-${field}`);
    try {
      const type = aiTab.slice(0, -1) as any;
      const primaryKeyword = editingItem.primaryKeyword || (editingItem.keywords?.[0] || '');
      const customPrompt = field === 'seoTitle' ? customPrompts.fieldTitle : customPrompts.fieldDescription;
      const result = await geminiService.generateSEOContent(type, editingItem, keywordCount, keywordLanguage, brandName, aiAnalysis?.strategy, selectedKeywords, excludedKeywords, primaryKeyword, customPrompt);
      setEditingItem(prev => ({
        ...prev,
        [field]: result[field]
      }));
    } catch (error) {
      if (isAbortError(error)) return;
      console.error(`AI Optimization for ${field} failed:`, error);
    } finally {
      setIsGenerating(null);
    }
  };

  const handleKeywordImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const content = event.target?.result as string;
      const lines = content.split(/[\n\r]+/).map(l => l.trim()).filter(l => l.length > 0);
      
      const isNewFormat = lines.some(l => l.includes('：') && l.includes('、'));
      
      if (isNewFormat) {
        let updatedCount = 0;
        for (const line of lines) {
          if (line.startsWith('类型：商品标题、关键词')) continue;
          
          const typeMatch = line.match(/^([^：:]+)[：:]([^、,，]+)[、,，](.+)$/);
          if (!typeMatch) continue;
          
          const type = typeMatch[1].trim();
          const title = typeMatch[2].trim();
          const keywordsStr = typeMatch[3].trim();
          const keywords = keywordsStr.split(/[,，、]+/).map(k => k.trim()).filter(k => k.length > 0);
          
          if (keywords.length === 0) continue;
          
          let itemToUpdate = null;
          let collectionName = '';
          
          if (type === '商品') {
            itemToUpdate = products.find(p => p.title === title);
            collectionName = 'products';
          } else if (type === '专辑' || type === '分类') {
            itemToUpdate = collections.find(c => c.title === title);
            collectionName = 'collections';
          } else if (type === '博客') {
            itemToUpdate = blogs.find(b => b.title === title);
            collectionName = 'blogs';
          } else if (type === '页面') {
            itemToUpdate = pages.find(p => p.title === title);
            collectionName = 'pages';
          }
          
          if (itemToUpdate && collectionName) {
            try {
              const newKeywords = [...new Set([...(itemToUpdate.keywords || []), ...keywords])];
              await updateDoc(doc(db, collectionName, itemToUpdate.id), {
                keywords: newKeywords,
                updatedAt: new Date().toISOString()
              });
              updatedCount++;
            } catch (error) {
              console.error(`Failed to update keywords for ${title}:`, error);
            }
          }
        }
        
        setIsImportModalOpen(false);
        if (updatedCount > 0) {
          alert(`成功导入并更新了 ${updatedCount} 个项目的关键词！`);
        } else {
          alert('未找到匹配的项目或格式不正确。');
        }
      } else {
        const importedKeywords = content
          .split(/[\n,，\r]+/)
          .map(k => k.trim())
          .filter(k => k.length > 0 && !k.includes('关键词 (每行一个)'));
        
        if (importedKeywords.length > 0) {
          setEditableKeywords(prev => [...new Set([...prev, ...importedKeywords])]);
          setSelectedKeywords(prev => [...new Set([...prev, ...importedKeywords])]);
          setIsImportModalOpen(false);
        }
      }
    };
    reader.readAsText(file);
    if (keywordImportRef.current) keywordImportRef.current.value = '';
  };

  const downloadKeywordTemplate = () => {
    const content = "类型：商品标题、关键词\n商品：示例商品标题、关键词1,关键词2\n页面：示例页面标题、关键词3,关键词4\n博客：示例博客标题、关键词5,关键词6";
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'seo_keywords_template.txt';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleAnalyzeSite = async () => {
    if (!storeInfo.trim() && !uploadedFile) return;
    setIsAnalyzing(true);
    try {
      let finalStoreInfo = storeInfo;
      if (uploadedFile) {
        finalStoreInfo += `\n\n[用户上传了公司介绍文件: ${uploadedFile.name}]`;
      }
      const analysis = await geminiService.analyzeSiteSEO(
        finalStoreInfo, 
        { 
          products: products.slice(0, 12), 
          collections: collections.slice(0, 6), 
          blogs: blogs.slice(0, 6), 
          pages: pages.slice(0, 6) 
        }, 
        targetMarket.join(', '), 
        targetLanguage,
        brandName,
        excludedKeywords,
        customPrompts.strategy
      );
      setAiAnalysis(analysis);
      setEditableKeywords(analysis.keywords);
      setSelectedKeywords(analysis.keywords);
      setExecutionConfirmed(false);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Site analysis failed:', error);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSaveSEOStrategy = async () => {
    setIsExecuting(true);
    setExecutionProgress(0);
    
    const statuses = [
      '正在保存 SEO 策略...',
      '正在更新关键词设置...',
      '正在同步数据...',
      '方案策略已保存！'
    ];

    for (let i = 0; i < statuses.length; i++) {
      setExecutionStatus(statuses[i]);
      setExecutionProgress((i + 1) * (100 / statuses.length));
      await new Promise(resolve => setTimeout(resolve, 600));
    }

    try {
      await setDoc(doc(db, 'seoConfigs', 'global'), cleanObject({
        strategy: aiAnalysis?.strategy || '',
        keywords: selectedKeywords,
        brandName,
        excludedKeywords,
        storeInfo,
        targetMarket: targetMarket,
        targetLanguage,
        keywordCount,
        updatedAt: new Date().toISOString()
      }));

      // Save to history
      const newHistory: ExecutionHistory = {
        id: Math.random().toString(36).substr(2, 9),
        timestamp: new Date().toLocaleString(),
        keywords: [...selectedKeywords],
      };
      setExecutionHistory(prev => [newHistory, ...prev]);

      setIsExecuting(false);
      setExecutionConfirmed(true);
      setIsFinalConfirmed(false);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Failed to save SEO strategy:', error);
      setIsExecuting(false);
    }
  };

  const handleResetGlobalStrategy = async () => {
    setIsResetting(true);
    try {
      await setDoc(doc(db, 'seoConfigs', 'global'), {
        strategy: '',
        keywords: [],
        updatedAt: new Date().toISOString()
      }, { merge: true });
      
      setAiAnalysis(null);
      setEditableKeywords([]);
      setSelectedKeywords([]);
      setExecutionConfirmed(false);
      setIsFinalConfirmed(false);
      
      toast.success("已成功清空全局 SEO 策略，您现在可以重新生成。");
    } catch (error) {
      console.error('Failed to reset strategy:', error);
      toast.error("无法清空策略，请检查数据库权限。");
    } finally {
      setIsResetting(false);
      setShowResetConfirm(false);
    }
  };

  const handleRecommendCompetitors = async () => {
    setIsRecommendingCompetitors(true);
    try {
      const recommendations = await geminiService.recommendCompetitors(storeInfo, products, targetMarket.join(', '));
      // Filter out existing competitors
      const existingNames = competitorData.map(c => c.name);
      const newRecs = recommendations.filter((r: any) => !existingNames.includes(r.name));
      setCompetitorData(prev => [...prev, ...newRecs]);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Failed to recommend competitors:', error);
    } finally {
      setIsRecommendingCompetitors(false);
    }
  };

  const handleAddCompetitor = () => {
    if (!newCompetitorName.trim()) return;
    
    const newComp = {
      name: newCompetitorName,
      score: Math.floor(Math.random() * 30) + 60, // Mock score
      traffic: Math.floor(Math.random() * 5000) + 5000, // Mock traffic
      keywords: Math.floor(Math.random() * 200) + 200 // Mock keywords
    };
    
    setCompetitorData(prev => [...prev, newComp]);
    setNewCompetitorName('');
    setShowAddCompetitor(false);
  };

  const handleRestore = (historyItem: ExecutionHistory) => {
    // In a real app, this would revert DB changes.
    // Here we just restore the UI state.
    setAiAnalysis({
      strategy: '已恢复至历史状态',
      keywords: historyItem.keywords
    });
    setEditableKeywords(historyItem.keywords);
    setSelectedKeywords(historyItem.keywords);
    setExecutionConfirmed(false);
    setIsFinalConfirmed(false);
    setShowHistory(false);
  };

  const handleFinalConfirm = () => {
    setIsFinalConfirmed(true);
    // In a real app, this would finalize the changes in the database
  };

  const renderAuditTab = () => (
    <div className="space-y-6">
      <StrategyBanner />
      <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm flex flex-col items-center text-center">
        {!auditResults && !isScanning ? (
          <>
            <div className="w-16 h-16 bg-blue-50 rounded-full flex items-center justify-center text-blue-600 mb-4">
              <ICONS.Globe className="w-8 h-8" />
            </div>
            <h2 className="text-xl font-bold text-slate-900 mb-2">开始您的站点 SEO 审计</h2>
            <p className="text-slate-500 max-w-md mb-6">我们将分析您的页面速度、元标签、索引状态和内容质量，为您提供详细的优化建议。</p>
            <button 
              onClick={runAudit}
              className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center gap-2"
            >
              <ICONS.RefreshCw className="w-4 h-4" />
              立即扫描
            </button>
          </>
        ) : isScanning ? (
          <div className="w-full max-w-md space-y-4">
            <div className="flex justify-between text-sm font-bold text-slate-600">
              <span>正在分析站点...</span>
              <span>{scanProgress}%</span>
            </div>
            <div className="h-3 bg-slate-100 rounded-full overflow-hidden">
              <motion.div 
                className="h-full bg-blue-600"
                initial={{ width: 0 }}
                animate={{ width: `${scanProgress}%` }}
              />
            </div>
            <p className="text-xs text-slate-400 italic">检查 Meta 标签, 页面结构, URL 规范化, 图片 SEO, 内链...</p>
          </div>
        ) : (
          <div className="w-full grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="flex flex-col items-center justify-center border-r border-slate-100">
              <div className="relative w-32 h-32 flex items-center justify-center mb-4">
                <svg className="w-full h-full -rotate-90">
                  <circle cx="64" cy="64" r="58" fill="none" stroke="#f1f5f9" strokeWidth="8" />
                  <motion.circle 
                    cx="64" cy="64" r="58" fill="none" 
                    stroke={auditResults!.score > 80 ? '#22c55e' : auditResults!.score > 60 ? '#eab308' : '#ef4444'} 
                    strokeWidth="8" 
                    strokeDasharray={364.4}
                    initial={{ strokeDashoffset: 364.4 }}
                    animate={{ strokeDashoffset: 364.4 * (1 - auditResults!.score / 100) }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                  />
                </svg>
                <span className="absolute text-3xl font-black text-slate-900">{auditResults!.score}</span>
              </div>
              <h3 className="font-bold text-slate-900">总体 SEO 评分</h3>
              <div className="mt-2 text-xs font-medium text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100 flex items-center gap-1.5">
                <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
                <span>已检测页面数量：<strong>{(products?.length || 0) + (collections?.length || 0) + (blogs?.length || 0) + (blogSets?.length || 0) + (pages?.length || 0)}</strong> 个</span>
              </div>
              <button onClick={runAudit} className="mt-4 text-sm text-blue-600 font-bold hover:underline flex items-center gap-1">
                <ICONS.RefreshCw className="w-3 h-3" /> 重新扫描
              </button>
            </div>
            
            <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(auditResults!.stats).map(([label, value], index) => {
                const config = getStatConfig(label);
                const isLastItem = index === Object.keys(auditResults!.stats).length - 1;
                
                return (
                  <div 
                    key={label} 
                    className={`p-5 bg-white rounded-2xl border border-slate-100 flex flex-col justify-between hover:shadow-lg hover:shadow-slate-100/50 hover:border-slate-200/60 transition-all duration-300 group ${isLastItem ? 'md:col-span-2' : ''}`}
                  >
                    <div className="flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-xl ${config.bg} flex items-center justify-center group-hover:scale-105 transition-transform duration-300 shrink-0`}>
                        {config.icon}
                      </div>
                      <div className="flex-1 min-w-0 text-left">
                        <div className="text-xs text-slate-400 font-bold uppercase tracking-wider">{label}</div>
                        <div className="mt-1 flex items-baseline gap-2">
                          <span className="text-2xl font-black text-slate-900 tracking-tight">{value}%</span>
                          <span className="text-xs font-bold text-slate-500">
                            {label === 'SEO 基础标签' ? '合规率' :
                             label === '页面结构' ? '合规率' :
                             label === 'URL 规范化' ? '规范率' :
                             label === '图片 SEO' ? '优化率' :
                             label === '内链优化' ? '健康度' : '数量占比'}
                          </span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="mt-4">
                      <div className="h-1.5 bg-slate-50 rounded-full overflow-hidden border border-slate-100/50">
                        <motion.div 
                          className={`h-full rounded-full ${config.bar}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${value}%` }}
                          transition={{ duration: 1, ease: 'easeOut' }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {auditResults && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <ICONS.AlertTriangle className="text-amber-500" />
              发现的问题 ({auditResults.issues.length})
            </h3>
            
            <div className="flex flex-wrap items-center gap-3">
              {isBatchGeneratingSuggestions && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg border border-indigo-100 animate-pulse">
                  <ICONS.RefreshCw className="w-3 h-3 animate-spin" />
                  <span className="text-[11px] font-bold">AI 正在自动生成优化建议...</span>
                </div>
              )}
            </div>
          </div>

          {auditViewMode === 'by-issue' ? (
            <div className="space-y-6">
              {['SEO 基础标签', '页面结构', 'URL 规范化', '图片 SEO', '内链优化'].map(dimension => {
                const dimensionIssues = auditResults.issues.filter(issue => issue.category === dimension);
                const config = getStatConfig(dimension);
                const scoreValue = auditResults.stats[dimension] ?? 100;
                
                return (
                  <div key={dimension} className="p-5 bg-slate-50/50 rounded-2xl border border-slate-200/60 shadow-sm space-y-4">
                    {/* Category Header */}
                    <div className="flex items-center justify-between flex-wrap gap-3 pb-3 border-b border-slate-200/60">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl ${config.bg} flex items-center justify-center shrink-0 shadow-xs border border-slate-100/50`}>
                          {config.icon}
                        </div>
                        <div>
                          <h4 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                            <span>{dimension}</span>
                          </h4>
                        </div>
                      </div>
                      
                      <div>
                        {dimensionIssues.length > 0 ? (
                          <span className="text-xs font-bold px-3 py-1 bg-amber-50 rounded-lg text-amber-700 border border-amber-200/30 flex items-center gap-1 shadow-2xs">
                            ⚠️ 发现 {dimensionIssues.length} 项具体问题
                          </span>
                        ) : (
                          <span className="text-xs font-bold px-3 py-1 bg-emerald-50 rounded-lg text-emerald-700 border border-emerald-250/20 flex items-center gap-1">
                            ✨ 检测通过 (100%)
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Specific Issues List */}
                    <div className="space-y-3">
                      {dimensionIssues.length > 0 ? (
                        dimensionIssues.map(issue => {
                          const isExpanded = expandedIssueIds.includes(issue.id);
                          return (
                            <div key={issue.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:border-blue-500 transition-all overflow-hidden">
                              <div 
                                onClick={() => {
                                  if (isExpanded) {
                                    setExpandedIssueIds(expandedIssueIds.filter(id => id !== issue.id));
                                  } else {
                                    setExpandedIssueIds([...expandedIssueIds, issue.id]);
                                  }
                                }}
                                className="p-4 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
                              >
                                <div className="flex items-center gap-3">
                                  <div className={`p-1.5 rounded-lg ${
                                    issue.severity === 'high' ? 'bg-red-50 text-red-600' : 
                                    issue.severity === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                                  }`}>
                                    <ICONS.AlertTriangle className="w-4 h-4" />
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2 mb-0.5">
                                      <span className={`px-1.5 py-0.2 rounded text-[11px] font-black uppercase ${
                                        issue.severity === 'high' ? 'bg-red-100 text-red-600' : 
                                        issue.severity === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                                      }`}>
                                        {issue.severity === 'high' ? '主要问题' : issue.severity === 'medium' ? '次要问题' : '改进建议'}
                                      </span>
                                    </div>
                                    <h5 className="font-bold text-slate-800 text-xs">{issue.title}</h5>
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className="flex items-center gap-1 px-2.5 py-0.5 bg-slate-50 border border-slate-100 rounded-full">
                                    <span className={`text-[11px] font-black min-w-[15px] h-[15px] px-1 rounded-full flex items-center justify-center text-center leading-none ${
                                      issue.severity === 'high' ? 'bg-red-500 text-white shadow-xs' :
                                      issue.severity === 'medium' ? 'bg-amber-500 text-white shadow-xs' :
                                      'bg-blue-500 text-white shadow-xs'
                                    }`}>
                                      {issue.affectedItems?.length || 0}
                                    </span>
                                    <span className="text-[11px] font-bold text-slate-500">
                                      受影响
                                    </span>
                                  </div>
                                  <motion.div
                                    animate={{ rotate: isExpanded ? 180 : 0 }}
                                    transition={{ duration: 0.2 }}
                                  >
                                    <ICONS.ChevronDown className="w-4 h-4 text-slate-405" />
                                  </motion.div>
                                </div>
                              </div>

                              <AnimatePresence>
                                {isExpanded && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: 'auto', opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    className="border-t border-slate-100 animate-fade-in"
                                  >
                                    <div className="p-4 space-y-4 bg-slate-50/50">
                                      <div className="space-y-1">
                                        <p className="text-xs text-slate-600 leading-relaxed font-medium">{issue.description}</p>
                                      </div>
                                      
                                      <div className="p-3 bg-blue-50/70 rounded-xl border border-blue-100/50">
                                        <div className="text-[11px] font-bold text-blue-400 uppercase mb-1">优化和纠正对策</div>
                                        <p className="text-xs text-blue-700 font-semibold">{issue.recommendation}</p>
                                      </div>

                                      {/* Directly render Affected Items inside the expanded section */}
                                      <div className="space-y-2 pt-2 border-t border-slate-150">
                                        <div className="flex items-center gap-2">
                                          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wide border-b border-dashed border-slate-300">受影响内容明细</span>
                                        </div>
                                        
                                        <div className="grid grid-cols-1 gap-2 max-h-[250px] overflow-y-auto pr-1">
                                          {issue.affectedItems && issue.affectedItems.length > 0 ? (
                                            issue.affectedItems.map((item, idx) => (
                                              <div key={idx} className="flex flex-col p-2.5 bg-white border border-slate-100 rounded-xl hover:border-slate-200 hover:shadow-2xs transition-all">
                                                <div className="flex items-start gap-2.5">
                                                  {item.image || item.url ? (
                                                    <img src={item.image || item.url} className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0" alt="" referrerPolicy="no-referrer" />
                                                  ) : (
                                                    <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center border border-slate-100 shrink-0">
                                                      <ICONS.FileText className="w-4 h-4 text-slate-400" />
                                                    </div>
                                                  )}

                                                  {item.parentType ? (
                                                    <div className="flex flex-col min-w-0 flex-1">
                                                      <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span className="text-xs font-bold text-slate-900 truncate max-w-[200px] sm:max-w-xs" title={item.name}>
                                                          图片名称: {item.name || '未命名图片'}
                                                        </span>
                                                      </div>
                                                      <div className="mt-1.5 flex flex-col gap-1 text-[11px] text-slate-500 bg-slate-50/70 p-1.5 rounded border border-slate-100/50">
                                                        <div className="flex items-center gap-1 flex-wrap">
                                                          <span className="text-slate-400 shrink-0">所处页面:</span>
                                                          <span className="font-semibold text-slate-700">{item.parentTitle || '未知页面'}</span>
                                                          <span className="text-slate-300 font-normal">|</span>
                                                          <a 
                                                            href={getParentPageUrl(item)} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            className="font-mono text-blue-600 hover:underline font-semibold flex items-center gap-0.5 break-all"
                                                            title="访问图片所处的页面"
                                                          >
                                                            <span>{getParentPageUrl(item)}</span>
                                                            <ICONS.ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                                          </a>
                                                        </div>
                                                        <div className="flex items-center gap-1 flex-wrap">
                                                          <span className="text-slate-400 shrink-0">图片链接:</span>
                                                          <a 
                                                            href={item.url} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            className="font-mono text-violet-600 hover:underline font-semibold flex items-center gap-0.5 break-all"
                                                            title="在新标签页中查看大图"
                                                          >
                                                            <span className="truncate max-w-[250px]">{item.url}</span>
                                                            <ICONS.ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                                          </a>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  ) : (
                                                    <div className="flex flex-col min-w-0 flex-1">
                                                      <div className="flex items-center gap-1.5 flex-wrap">
                                                        <span 
                                                          onClick={() => {
                                                            const colName = getItemCollectionName(item);
                                                            let editType = 'page';
                                                            if (colName === 'products') editType = 'product';
                                                            else if (colName === 'collections') editType = 'collection';
                                                            else if (colName === 'blogs') editType = 'blog';
                                                            else if (colName === 'blogSets') editType = 'blogSet';
                                                            
                                                            const url = `${window.location.origin}${window.location.pathname}?editType=${editType}&editId=${item.id}`;
                                                            window.open(url, '_blank');
                                                          }}
                                                          className="text-xs font-bold text-slate-900 hover:text-blue-600 hover:underline cursor-pointer transition-colors flex items-center gap-1 group/title"
                                                          title="在新窗口中打开并编辑此页面/项目"
                                                        >
                                                          <span className="truncate max-w-[200px] sm:max-w-xs">
                                                            {(() => {
                                                              const typeStr = getItemCollectionName(item) === 'products' ? '商品' :
                                                                               getItemCollectionName(item) === 'collections' ? '智能集锦' :
                                                                               getItemCollectionName(item) === 'blogs' ? '博客文章' :
                                                                               getItemCollectionName(item) === 'blogSets' ? '博客分集' : '自定义页面';
                                                              return `${typeStr}：${item.title || item.name}`;
                                                            })()}
                                                          </span>
                                                          <ICONS.ExternalLink className="w-3 h-3 opacity-0 group-hover/title:opacity-100 transition-opacity text-blue-500 shrink-0 inline-block" />
                                                        </span>
                                                      </div>
                                                      <div className="mt-1.5 flex flex-col gap-1 text-[11px] text-slate-500 bg-slate-50/70 p-1.5 rounded border border-slate-100/50">
                                                        <div className="flex items-center gap-1 flex-wrap">
                                                          <span className="text-slate-400 shrink-0">页面 URL:</span>
                                                          <a 
                                                            href={getItemPageUrl(item)} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            className="font-mono text-blue-600 hover:underline font-semibold flex items-center gap-0.5 break-all"
                                                            title="访问前端展示页面"
                                                          >
                                                            <span>{getItemPageUrl(item)}</span>
                                                            <ICONS.ExternalLink className="w-2.5 h-2.5 shrink-0" />
                                                          </a>
                                                        </div>
                                                      </div>
                                                    </div>
                                                  )}
                                                </div>

                                                {/* Quick redirect config for 404 links directly in expanded area */}
                                                {issue.id === 'links-404' && (
                                                  <div className="mt-2 text-left pt-2 border-t border-slate-100 flex flex-col gap-1.5">
                                                    <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                                                      <span className="flex items-center gap-1 text-slate-600">🔗 快速配置重定向链接</span>
                                                      {item.redirectUrl ? (
                                                        <span className="text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded font-black text-[11px] uppercase tracking-wide">
                                                          已重定向: {item.redirectUrl}
                                                        </span>
                                                      ) : (
                                                        <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded font-black text-[11px] uppercase tracking-wide">
                                                          未配置重定向
                                                        </span>
                                                      )}
                                                    </div>
                                                    <div className="flex items-center gap-1.5">
                                                      <input 
                                                        type="text" 
                                                        placeholder="目标页面链接 如: /home" 
                                                        defaultValue={item.redirectUrl || ''}
                                                        id={`expand-redirect-input-${item.id}`}
                                                        className="flex-1 px-2.5 py-1 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-semibold"
                                                      />
                                                      <button 
                                                        onClick={async () => {
                                                          const inputEl = document.getElementById(`expand-redirect-input-${item.id}`) as HTMLInputElement;
                                                          const rUrl = inputEl?.value.trim();
                                                          if (rUrl) {
                                                            try {
                                                              const colName = getItemCollectionName(item);
                                                              await updateDoc(doc(db, colName, item.id), {
                                                                redirectUrl: rUrl,
                                                                updatedAt: new Date().toISOString()
                                                              });
                                                              toast.success("重定向配置成功！");
                                                            } catch (err) {
                                                              toast.error("重定向配置失败，请重新试一下");
                                                            }
                                                          } else {
                                                            toast.error("请输入有效的跳转链接");
                                                          }
                                                        }}
                                                        className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-xs"
                                                      >
                                                        保存
                                                      </button>
                                                      {item.redirectUrl && (
                                                        <button 
                                                          onClick={async () => {
                                                            try {
                                                              const colName = getItemCollectionName(item);
                                                              await updateDoc(doc(db, colName, item.id), {
                                                                redirectUrl: "",
                                                                updatedAt: new Date().toISOString()
                                                              });
                                                              const inputEl = document.getElementById(`expand-redirect-input-${item.id}`) as HTMLInputElement;
                                                              if (inputEl) inputEl.value = "";
                                                              toast.success("重定向配置已清除");
                                                            } catch (err) {
                                                              toast.error("清除失败，请重新试一下");
                                                            }
                                                          }}
                                                          className="px-2 py-1 bg-red-50 hover:bg-red-100 text-red-650 rounded-lg text-xs font-bold transition-all"
                                                        >
                                                          清除
                                                        </button>
                                                      )}
                                                    </div>
                                                  </div>
                                                )}
                                              </div>
                                            ))
                                          ) : (
                                            <div className="text-[11px] text-slate-400 py-1.5 text-center">暂无受影响内容</div>
                                          )}
                                        </div>
                                      </div>

                                      <div className="flex justify-end pt-1">
                                        <button 
                                          onClick={() => {
                                            setActiveTab('fix');
                                            setAiMode('list');
                                            if (issue.targetTab) setFixAiTab(issue.targetTab);
                                            setFixFilterIds(issue.affectedItems?.map(item => item.id) || null);
                                            setFixFilterStatus('all');
                                            setActiveFixIssueTitle(issue.title);
                                            setActiveFixIssueDesc(issue.recommendation);
                                            onTabChange?.('SEO处理');
                                          }}
                                          className="px-4 py-1.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-all shadow-sm"
                                        >
                                          立即处理
                                        </button>
                                      </div>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })
                      ) : (
                        <div className="p-4 bg-emerald-50/10 rounded-xl border border-dashed border-emerald-250/40 flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold text-xs shrink-0 shadow-3xs">✓</div>
                          <div className="text-left">
                            <div className="text-xs font-bold text-emerald-800">该维度表现完美</div>
                            <p className="text-[11px] text-emerald-600 mt-0.5">做得很好！当前所有检测内容的指标在该维度下均表现优异，无任何待改进缺陷。</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {issuesByPage.length === 0 ? (
                <div className="p-8 bg-white border border-slate-200 rounded-2xl text-center space-y-2">
                  <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto text-xl font-bold">✓</div>
                  <h4 className="font-bold text-slate-800">未发现任何页面问题</h4>
                  <p className="text-sm text-slate-500">您的所有页面在当前的本地指标下表现优异！</p>
                </div>
              ) : (
                issuesByPage.map(({ item, itemType, issues }) => {
                  const isExpanded = expandedPageIds.includes(item.id);
                  const hasHigh = issues.some(i => i.severity === 'high');
                  const hasMedium = issues.some(i => i.severity === 'medium');
                  const maxSeverity = hasHigh ? 'high' : hasMedium ? 'medium' : 'low';
                  
                  return (
                    <div key={item.id} className="bg-white rounded-xl border border-slate-200 shadow-sm hover:border-blue-500 transition-all overflow-hidden">
                      <div
                        onClick={() => {
                          if (isExpanded) {
                            setExpandedPageIds(expandedPageIds.filter(id => id !== item.id));
                          } else {
                            setExpandedPageIds([...expandedPageIds, item.id]);
                          }
                        }}
                        className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-slate-50 transition-colors"
                      >
                        <div className="flex items-center gap-4 flex-1">
                          {item.image || item.url ? (
                            <img src={item.image || item.url} className="w-12 h-12 rounded-lg object-cover border border-slate-200" alt="" />
                          ) : (
                            <div className="w-12 h-12 rounded-lg bg-slate-100 flex items-center justify-center">
                              <ICONS.FileText className="w-6 h-6 text-slate-400" />
                            </div>
                          )}
                          
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                                maxSeverity === 'high' ? 'bg-red-50 text-red-600 border border-red-100' : 
                                maxSeverity === 'medium' ? 'bg-amber-50 text-amber-600 border border-amber-100' : 
                                'bg-blue-50 text-blue-600 border border-blue-100'
                              }`}>
                                {maxSeverity === 'high' ? '高风险' : maxSeverity === 'medium' ? '中风险' : '低风险'}
                              </span>
                            </div>
                            <h4 className="font-bold text-slate-900 line-clamp-1">
                              {(() => {
                                 let typeStr = itemType;
                                 if (typeStr === '商品页面') typeStr = '商品';
                                 else if (typeStr === '分类系列') typeStr = '智能集锦';
                                 else if (typeStr === '博客目录') typeStr = '博客分集';
                                 return `${typeStr}：${item.title || item.name}`;
                              })()}
                            </h4>
                            <p className="text-[11px] text-slate-400 font-mono leading-none">{item.seoUrl || item.handle || 'No URL'}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between md:justify-end gap-3 border-t md:border-t-0 pt-3 md:pt-0 border-slate-100">
                          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-100 px-3 py-1.5 rounded-lg">
                            <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                            <span className="text-xs font-bold text-slate-600">
                              发现 {issues.length} 个优化点
                            </span>
                          </div>
                          
                          <div className="flex items-center gap-2">
                            <motion.div
                              animate={{ rotate: isExpanded ? 180 : 0 }}
                              transition={{ duration: 0.2 }}
                            >
                              <ICONS.ChevronDown className="w-5 h-5 text-slate-400" />
                            </motion.div>
                          </div>
                        </div>
                      </div>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="border-t border-slate-100 bg-slate-50/50"
                          >
                            <div className="p-5 space-y-4">
                              <div className="flex items-center justify-between pb-3 border-b border-slate-150 flex-wrap gap-2">
                                <div className="space-y-0.5">
                                  <h5 className="text-xs font-bold text-slate-400 uppercase tracking-wider">该页面存在的问题列表 ({issues.length})</h5>
                                  <p className="text-[11px] text-slate-400">展开查看详细原因描述与优化建议</p>
                                </div>
                                <button
                                  onClick={() => {
                                    setActiveTab('fix');
                                    setAiMode('list');
                                    const colName = getItemCollectionName(item);
                                    setFixAiTab(colName);
                                    setFixFilterIds([item.id]);
                                    setFixFilterStatus('all');
                                    setActiveFixIssueTitle(`页面专项优化：${item.title || item.name}`);
                                    setActiveFixIssueDesc("针对选定页面检测出的所有 SEO 标签与结构问题，提供页面级一键式 AI 智能修复、文案重写及格式规范。");
                                    onTabChange?.('SEO处理');
                                  }}
                                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 active:scale-95 rounded-xl transition-all shadow-md shadow-blue-500/15 flex items-center gap-1.5 cursor-pointer"
                                >
                                  <ICONS.Zap className="w-3.5 h-3.5 animate-pulse" />
                                  <span>立即处理页面问题</span>
                                </button>
                              </div>
                              
                              <div className="grid grid-cols-1 gap-3">
                                {issues.map(issue => (
                                  <div key={issue.id} className="p-4 bg-white rounded-xl border border-slate-200/65 shadow-sm flex flex-col md:flex-row md:items-start justify-between gap-4">
                                    <div className="space-y-2 flex-1">
                                      <div className="flex items-center gap-2">
                                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                                          issue.severity === 'high' ? 'bg-red-100 text-red-600' : 
                                          issue.severity === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                                        }`}>
                                          {issue.severity === 'high' ? '高优先级' : issue.severity === 'medium' ? '中优先级' : '低优先级'}
                                        </span>
                                        <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                                          CATEGORY_STYLES[issue.category] || 'bg-slate-100 text-slate-600 border border-slate-200/50'
                                        }`}>
                                          {issue.category}
                                        </span>
                                        <span className="text-xs font-bold text-slate-900">{issue.title}</span>
                                      </div>
                                      
                                      <div className="text-xs text-slate-600 space-y-1">
                                        <p className="text-blue-700 font-medium bg-blue-50/80 px-2.5 py-1.5 rounded-lg border border-blue-100/50 mt-1">
                                          <strong>修复建议：</strong>{issue.recommendation}
                                        </p>
                                      </div>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* Issue Details Modal */}
      <AnimatePresence>
        {selectedIssue && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-xl ${
                    selectedIssue.severity === 'high' ? 'bg-red-100 text-red-600' : 
                    selectedIssue.severity === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                  }`}>
                    <ICONS.AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900">{selectedIssue.title}</h3>
                    <div className="flex items-center gap-1.5 mt-1">
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                        CATEGORY_STYLES[selectedIssue.category] || 'bg-slate-100 text-slate-600 border border-slate-200/50'
                      }`}>
                        {selectedIssue.category}
                      </span>
                      <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                        selectedIssue.severity === 'high' ? 'bg-red-100 text-red-600' : 
                        selectedIssue.severity === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                      }`}>
                        {selectedIssue.severity === 'high' ? '高优先级' : selectedIssue.severity === 'medium' ? '中优先级' : '低优先级'}
                      </span>
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedIssue(null)} className="p-2 hover:bg-slate-200 rounded-full transition-colors">
                  <ICONS.X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div className="p-6 overflow-y-auto space-y-6">
                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">问题描述</h4>
                  <p className="text-sm text-slate-700 leading-relaxed">{selectedIssue.description}</p>
                </div>

                <div className="space-y-2">
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">优化建议</h4>
                  <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100">
                    <p className="text-sm text-blue-700 font-medium">{selectedIssue.recommendation}</p>
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">受影响的内容</h4>
                    <span className={`px-2 py-0.5 rounded-full font-black text-xs border ${
                      selectedIssue.severity === 'high' ? 'bg-red-50 text-red-600 border-red-100/50' :
                      selectedIssue.severity === 'medium' ? 'bg-amber-50 text-amber-600 border-amber-100/50' :
                      'bg-blue-50 text-blue-600 border-blue-100/50'
                    }`}>
                      {selectedIssue.affectedItems?.length || 0}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {selectedIssue.affectedItems?.map((item, idx) => (
                      <div key={idx} className="flex flex-col p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            {item.image || item.url ? (
                              <img src={item.image || item.url} className="w-10 h-10 rounded-lg object-cover border border-slate-200" alt="" />
                            ) : (
                              <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center">
                                <ICONS.FileText className="w-5 h-5 text-slate-400" />
                              </div>
                            )}
                            {item.parentType ? (
                              <div className="flex flex-col min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span className="text-sm font-bold text-slate-900 truncate max-w-[200px] sm:max-w-xs animate-fade-in" title={item.name}>
                                    图片名称: {item.name || '未命名图片'}
                                  </span>
                                </div>
                                <div className="mt-1.5 flex flex-col gap-1 text-[11px] text-slate-500 bg-white p-2 rounded-xl border border-slate-100/55">
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="text-slate-400 shrink-0">所处页面:</span>
                                    <span className="font-semibold text-slate-700">{item.parentTitle || '未知页面'}</span>
                                    <span className="text-slate-300 font-normal">|</span>
                                    <a 
                                      href={getParentPageUrl(item)} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="font-mono text-blue-600 hover:underline font-semibold flex items-center gap-0.5 break-all"
                                      title="访问图片所处的页面"
                                    >
                                      <span>{getParentPageUrl(item)}</span>
                                      <ICONS.ExternalLink className="w-3.5 h-3.5 shrink-0" />
                                    </a>
                                  </div>
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="text-slate-400 shrink-0">图片链接:</span>
                                    <a 
                                      href={item.url} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="font-mono text-violet-600 hover:underline font-semibold flex items-center gap-0.5 break-all"
                                      title="在新标签页中查看大图"
                                    >
                                      <span className="truncate max-w-[300px]">{item.url}</span>
                                      <ICONS.ExternalLink className="w-3.5 h-3.5 shrink-0" />
                                    </a>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="flex flex-col min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span 
                                    onClick={() => {
                                      const colName = getItemCollectionName(item);
                                      let editType = 'page';
                                      if (colName === 'products') editType = 'product';
                                      else if (colName === 'collections') editType = 'collection';
                                      else if (colName === 'blogs') editType = 'blog';
                                      else if (colName === 'blogSets') editType = 'blogSet';
                                      
                                      const url = `${window.location.origin}${window.location.pathname}?editType=${editType}&editId=${item.id}`;
                                      window.open(url, '_blank');
                                    }}
                                    className="text-sm font-bold text-slate-900 hover:text-blue-600 hover:underline cursor-pointer transition-colors flex items-center gap-1.5 group/title"
                                    title="在新窗口中打开并编辑此页面/项目"
                                  >
                                    <span>
                                      {(() => {
                                        const typeStr = getItemCollectionName(item) === 'products' ? '商品' :
                                                         getItemCollectionName(item) === 'collections' ? '智能集锦' :
                                                         getItemCollectionName(item) === 'blogs' ? '博客文章' :
                                                         getItemCollectionName(item) === 'blogSets' ? '博客分集' : '自定义页面';
                                        return `${typeStr}：${item.title || item.name}`;
                                      })()}
                                    </span>
                                    <ICONS.ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover/title:opacity-100 transition-opacity text-blue-500 shrink-0 inline-block" />
                                  </span>
                                </div>
                                <div className="mt-1.5 flex flex-col gap-1 text-[11px] text-slate-500 bg-white p-2 rounded-xl border border-slate-100/55">
                                  <div className="flex items-center gap-1 flex-wrap">
                                    <span className="text-slate-400 shrink-0">页面 URL:</span>
                                    <a 
                                      href={getItemPageUrl(item)} 
                                      target="_blank" 
                                      rel="noopener noreferrer" 
                                      className="font-mono text-blue-600 hover:underline font-semibold flex items-center gap-0.5 break-all"
                                      title="访问前端展示页面"
                                    >
                                      <span>{getItemPageUrl(item)}</span>
                                      <ICONS.ExternalLink className="w-3.5 h-3.5 shrink-0" />
                                    </a>
                                  </div>
                                </div>
                              </div>
                            )}
                          </div>
                        </div>

                        {selectedIssue.id === 'links-404' && (
                          <div className="mt-3 pt-3 border-t border-slate-200/50 flex flex-col gap-2">
                            <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                              <span className="flex items-center gap-1 text-slate-600">🔗 快速配置重定向链接</span>
                              {item.redirectUrl ? (
                                <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-black text-[11px] uppercase tracking-wide">
                                  已重定向: {item.redirectUrl}
                                </span>
                              ) : (
                                <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded font-black text-[11px] uppercase tracking-wide">
                                  未配置重定向
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <input 
                                type="text" 
                                placeholder="目标页面链接 如: /home 或 https://..." 
                                defaultValue={item.redirectUrl || ''}
                                id={`detail-redirect-input-${item.id}`}
                                className="flex-1 px-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg outline-none focus:border-blue-500 font-semibold"
                              />
                              <button 
                                onClick={async () => {
                                  const inputEl = document.getElementById(`detail-redirect-input-${item.id}`) as HTMLInputElement;
                                  const rUrl = inputEl?.value.trim();
                                  if (rUrl) {
                                    try {
                                      const colName = getItemCollectionName(item);
                                      await updateDoc(doc(db, colName, item.id), {
                                        redirectUrl: rUrl,
                                        updatedAt: new Date().toISOString()
                                      });
                                      toast.success("重定向配置成功！");
                                    } catch (err) {
                                      toast.error("重定向配置失败，请重试");
                                    }
                                  } else {
                                    toast.error("请输入有效的跳转链接");
                                  }
                                }}
                                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition-all shadow-sm"
                              >
                                保存
                              </button>
                              {item.redirectUrl && (
                                <button 
                                  onClick={async () => {
                                    try {
                                      const colName = getItemCollectionName(item);
                                      await updateDoc(doc(db, colName, item.id), {
                                        redirectUrl: "",
                                        updatedAt: new Date().toISOString()
                                      });
                                      const inputEl = document.getElementById(`detail-redirect-input-${item.id}`) as HTMLInputElement;
                                      if (inputEl) inputEl.value = "";
                                      toast.success("重定向配置已清除");
                                    } catch (err) {
                                      toast.error("清除失败，请重试");
                                    }
                                  }}
                                  className="px-2 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 rounded-lg text-xs font-bold transition-all"
                                >
                                  清除
                                </button>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => setSelectedIssue(null)}
                  className="flex-1 px-6 py-3 bg-white border border-slate-200 text-slate-600 rounded-2xl font-bold hover:bg-slate-100 transition-all"
                >
                  关闭
                </button>
                <button 
                  onClick={() => {
                    setActiveTab('fix');
                    setAiMode('list');
                    if (selectedIssue.targetTab) setFixAiTab(selectedIssue.targetTab);
                    setFixFilterIds(selectedIssue.affectedItems?.map(item => item.id) || null);
                    setFixFilterStatus('all');
                    setActiveFixIssueTitle(selectedIssue.title);
                    setActiveFixIssueDesc(selectedIssue.recommendation);
                    setSelectedIssue(null);
                    onTabChange?.('SEO处理');
                  }}
                  className="flex-1 px-6 py-3 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 flex items-center justify-center gap-2"
                >
                  <ICONS.Zap className="w-5 h-5" />
                  立即处理
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );

  const renderFixTab = () => {
    // Similar to renderAiTab but focused on fixing
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row items-center justify-between bg-blue-50/50 p-4 rounded-2xl border border-blue-100 gap-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <ICONS.Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">{activeFixIssueTitle || '问题修复模式'}</h3>
              <p className="text-xs text-slate-500">
                {fixFilterIds !== null 
                  ? activeFixIssueDesc || "已开启单个页面专项优化筛选，仅展示当前选定页面的检测问题。" 
                  : `正在针对检测出的 ${filterIds?.length || '全部'} 个问题进行专项优化`
                }
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {fixFilterIds !== null && (
              <button 
                onClick={() => {
                  setFixFilterIds(null);
                  setActiveFixIssueTitle('');
                  setActiveFixIssueDesc('');
                  toast.success("已清除单个页面筛选，已恢复显示全部内容");
                }}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow-xs transition-all flex items-center gap-1 cursor-pointer"
              >
                <ICONS.RefreshCw className="w-3.5 h-3.5" />
                显示全部问题
              </button>
            )}
            <button 
              onClick={() => {
                setActiveTab('audit');
                onTabChange?.('SEO检测');
              }}
              className="px-4 py-2 bg-white text-slate-600 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-50 transition-all cursor-pointer"
            >
              返回检测报告
            </button>
          </div>
        </div>
        {renderAiTab()}
      </div>
    );
  };

  const renderTrackingTab = () => (
    <div className="space-y-8 pb-12">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: '关键词排名', value: '前 3 名: 15', change: '+12%', trend: 'up', icon: <ICONS.TrendingUp className="w-4 h-4" /> },
          { label: '有机流量', value: '12,450', change: '+8.5%', trend: 'up', icon: <ICONS.Analysis className="w-4 h-4" /> },
          { label: '平均 CTR', value: '4.2%', change: '-0.5%', trend: 'down', icon: <ICONS.Zap className="w-4 h-4" /> },
          { label: '转化率', value: '2.8%', change: '+1.2%', trend: 'up', icon: <ICONS.CheckCircle className="w-4 h-4" /> },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">{stat.label}</span>
              <div className={`p-2 rounded-lg ${stat.trend === 'up' ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                {stat.icon}
              </div>
            </div>
            <div className="text-2xl font-black text-slate-900 mb-1">{stat.value}</div>
            <div className={`text-xs font-bold flex items-center gap-1 ${stat.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
              {stat.trend === 'up' ? <ICONS.ArrowUpRight className="w-3 h-3" /> : <ICONS.ArrowDownRight className="w-3 h-3" />}
              {stat.change} <span className="text-slate-400 font-medium">较上周</span>
            </div>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Ranking Trend */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <div className="space-y-1">
              <h3 className="font-bold text-slate-900 flex items-center gap-2">
                <ICONS.TrendingUp className="text-blue-500" />
                关键词排名趋势
              </h3>
              <p className="text-[11px] text-slate-400">基于核心关键词每日平均排名计算</p>
            </div>
            <select className="text-xs font-bold text-slate-500 bg-slate-50 border-none rounded-lg px-2 py-1 outline-none">
              <option>最近 7 天</option>
              <option>最近 30 天</option>
            </select>
          </div>
          <div className="h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={rankingData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <YAxis reversed axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: '#94a3b8' }} />
                <Tooltip 
                  contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  itemStyle={{ fontSize: '12px', fontWeight: 'bold' }}
                />
                <Line type="monotone" dataKey="rank" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', strokeWidth: 2, stroke: '#fff' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>


        {/* Organic Search Keyword Sources */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div className="flex justify-between items-center mb-6">
            <h3 className="font-bold text-slate-900 flex items-center gap-2">
              <ICONS.Search className="text-blue-500" />
              有机搜索词来源
            </h3>
            <span className="text-[11px] font-bold text-slate-400 uppercase">Top 5 关键词</span>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-4 text-[11px] font-bold text-slate-400 uppercase px-2">
              <div className="col-span-1">关键词</div>
              <div className="text-right">点击量</div>
              <div className="text-right">点击率</div>
              <div className="text-right">平均排名</div>
            </div>
            {keywordSourceData.map((item, i) => (
              <div key={i} className="grid grid-cols-4 items-center p-2 bg-slate-50 rounded-lg hover:bg-blue-50 transition-colors cursor-default">
                <div className="col-span-1 text-xs font-bold text-slate-900 truncate" title={item.keyword}>{item.keyword}</div>
                <div className="text-right text-xs font-black text-slate-700">{item.clicks.toLocaleString()}</div>
                <div className="text-right text-xs font-bold text-blue-600">{item.ctr}</div>
                <div className="text-right text-xs font-bold text-slate-500">#{item.avgPos}</div>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-slate-100 flex justify-center">
            <button className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
              查看全部 128 个关键词 <ICONS.ChevronRight className="w-3 h-3" />
            </button>
          </div>
        </div>

        {/* Keyword Distribution */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
            <ICONS.PieChart className="text-purple-500" />
            关键词排名分布
          </h3>
          <div className="flex items-center h-[250px]">
            <div className="w-1/2 h-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={keywordDistribution}
                    innerRadius={60}
                    outerRadius={80}
                    paddingAngle={5}
                    dataKey="value"
                  >
                    {keywordDistribution.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 space-y-3">
              {keywordDistribution.map((item, i) => (
                <div key={i} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="text-xs font-bold text-slate-600">{item.name}</span>
                  </div>
                  <span className="text-xs font-black text-slate-900">{item.value}%</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Ranking Changes */}
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
            <ICONS.RefreshCw className="text-orange-500" />
            排名变动提醒 (Top 5)
          </h3>
          <div className="space-y-4">
            {rankingChanges.map((change, i) => (
              <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                <div className="flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                    change.trend === 'up' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'
                  }`}>
                    {change.trend === 'up' ? <ICONS.TrendingUp className="w-4 h-4" /> : <ICONS.TrendingDown className="w-4 h-4" />}
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">{change.keyword}</div>
                    <div className="text-[11px] text-slate-400 font-bold uppercase">当前排名: #{change.current}</div>
                  </div>
                </div>
                <div className={`text-sm font-black ${change.trend === 'up' ? 'text-green-600' : 'text-red-600'}`}>
                  {change.trend === 'up' ? '+' : ''}{change.change}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Competitor Comparison */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center justify-between mb-6">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <ICONS.Customer className="text-blue-500" />
            竞品对比分析
          </h3>
          <div className="flex items-center gap-2">
            <button 
              onClick={handleRecommendCompetitors}
              disabled={isRecommendingCompetitors}
              className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all disabled:opacity-50"
            >
              <ICONS.Zap className={`w-3 h-3 ${isRecommendingCompetitors ? 'animate-pulse' : ''}`} />
              {isRecommendingCompetitors ? '正在推荐...' : 'AI 推荐竞品'}
            </button>
            <button 
              onClick={() => setShowAddCompetitor(true)}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100 transition-all"
            >
              <ICONS.Plus className="w-3 h-3" />
              添加竞品
            </button>
          </div>
        </div>

        {showAddCompetitor && (
          <div className="mb-6 p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-3">
            <input 
              type="text"
              value={newCompetitorName}
              onChange={(e) => setNewCompetitorName(e.target.value)}
              placeholder="输入竞品店铺名称或域名..."
              className="flex-1 p-2 bg-white border border-slate-200 rounded-lg text-sm outline-none focus:border-blue-500"
            />
            <button 
              onClick={handleAddCompetitor}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all"
            >
              确认添加
            </button>
            <button 
              onClick={() => setShowAddCompetitor(false)}
              className="px-4 py-2 bg-slate-200 text-slate-600 rounded-lg text-sm font-bold hover:bg-slate-300 transition-all"
            >
              取消
            </button>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {competitorData.map((comp, i) => (
            <div key={i} className={`p-5 rounded-2xl border-2 transition-all ${
              comp.name === '您的店铺' ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100 bg-white'
            }`}>
              <div className="flex justify-between items-center mb-4">
                <span className="font-bold text-slate-900">{comp.name}</span>
                <div className="flex items-center gap-2">
                  {comp.name === '您的店铺' ? (
                    <span className="px-2 py-0.5 bg-blue-600 text-white text-[11px] font-bold rounded">当前</span>
                  ) : (
                    <button 
                      onClick={() => setCompetitorData(prev => prev.filter((_, idx) => idx !== i))}
                      className="text-slate-400 hover:text-red-500 transition-all"
                    >
                      <ICONS.Trash className="w-3 h-3" />
                    </button>
                  )}
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <div className="flex justify-between text-xs font-bold text-slate-400 mb-1 uppercase">SEO 评分 <span>{comp.score}</span></div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className="h-full bg-blue-500" style={{ width: `${comp.score}%` }} />
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase">月流量</span>
                  <span className="text-sm font-black text-slate-900">{comp.traffic.toLocaleString()}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-400 uppercase">关键词数</span>
                  <span className="text-sm font-black text-slate-900">{comp.keywords}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Optimization Comparison */}
      <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <h3 className="font-bold text-slate-900 mb-6 flex items-center gap-2">
          <ICONS.Zap className="text-amber-500" />
          优化前后对比 (A/B 测试)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-slate-400 font-bold text-xs uppercase">
              <div className="w-2 h-2 rounded-full bg-slate-300" />
              优化前 (基准)
            </div>
            <div className="p-4 bg-slate-50 rounded-xl border border-slate-100">
              <div className="flex justify-between mb-2">
                <span className="text-xs text-slate-500">平均排名</span>
                <span className="text-sm font-bold text-slate-900">#45</span>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-xs text-slate-500">点击率 (CTR)</span>
                <span className="text-sm font-bold text-slate-900">1.2%</span>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">月有机流量</span>
                <span className="text-sm font-bold text-slate-900">3,200</span>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-blue-600 font-bold text-xs uppercase">
              <div className="w-2 h-2 rounded-full bg-blue-600" />
              优化后 (AI 增强)
            </div>
            <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
              <div className="flex justify-between mb-2">
                <span className="text-xs text-slate-500">平均排名</span>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-slate-900">#12</span>
                  <span className="text-[11px] text-green-600 font-bold">↑ 73%</span>
                </div>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-xs text-slate-500">点击率 (CTR)</span>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-slate-900">4.5%</span>
                  <span className="text-[11px] text-green-600 font-bold">↑ 275%</span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">月有机流量</span>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-slate-900">12,450</span>
                  <span className="text-[11px] text-green-600 font-bold">↑ 289%</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {auditResults && (
        <div className="mt-12 p-8 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-3xl shadow-xl text-white flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <h3 className="text-xl font-bold">准备好开始优化了吗？</h3>
            <p className="text-blue-100 text-sm max-w-md">
              根据检测结果，我们发现您的站点还有很大的提升空间。前往 SEO 管理页面，使用 AI 批量优化有问题的内容。
            </p>
          </div>
          <button 
            onClick={() => {
              setActiveTab('fix');
              onTabChange?.('SEO处理');
              setAiMode('list');
              setFixFilterStatus('needs_optimization');
              setActiveFixIssueTitle('');
              setActiveFixIssueDesc('');
            }}
            className="px-8 py-4 bg-white text-blue-600 rounded-2xl font-black shadow-lg hover:scale-105 transition-all flex items-center gap-3 whitespace-nowrap"
          >
            <ICONS.Zap className="w-5 h-5" />
            立即处理
          </button>
        </div>
      )}

      <AnimatePresence>
        {previewImage && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/90 backdrop-blur-sm"
            onClick={() => setPreviewImage(null)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="relative max-w-5xl w-full max-h-[90vh] bg-white rounded-3xl overflow-hidden shadow-2xl"
              onClick={e => e.stopPropagation()}
            >
              <div className="absolute top-4 right-4 z-10">
                <button 
                  onClick={() => setPreviewImage(null)}
                  className="p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md transition-all"
                >
                  <ICONS.Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <div className="flex flex-col h-full">
                <div className="flex-1 bg-slate-100 flex items-center justify-center overflow-hidden p-8">
                  <img 
                    src={previewImage.url} 
                    alt={previewImage.name} 
                    className="max-w-full max-h-full object-contain shadow-lg rounded-lg"
                    referrerPolicy="no-referrer"
                  />
                </div>
                <div className="p-6 bg-white border-t border-slate-100 flex items-center justify-between">
                  <div className="space-y-1">
                    <h4 className="font-bold text-slate-900">{previewImage.name}</h4>
                    <p className="text-xs text-slate-500">点击背景或右上角关闭预览</p>
                  </div>
                  <a 
                    href={previewImage.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all flex items-center gap-2"
                  >
                    <ICONS.ExternalLink className="w-4 h-4" />
                    查看原图
                  </a>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );

  const renderBlogTab = () => (
    <div className="space-y-8">
      <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm">
        <SEOBlogManager 
          products={products} 
          pages={pages}
          blogs={blogs}
          brandName={brandName} 
          targetLanguage={targetLanguage}
          keywordLanguage={keywordLanguage}
          customBlogPrompt={customPrompts.blog}
          customBlogTopicsPrompt={customPrompts.blogTopics}
          customBlogTopicsManualPrompt={customPrompts.blogTopicsManual}
          strategy={aiAnalysis?.strategy}
          selectedKeywords={selectedKeywords}
          onRegisterEditActions={setBlogEditActions}
        />
      </div>
    </div>
  );

  // Dynamic tab switching for SEO Management mode
  useEffect(() => {
    if (globalFilterStatus === 'needs_optimization' || globalFilterIds !== null) {
      const tabs = [
        { id: 'products', count: getNeedsOptimizationCount(products, 'product', globalFilterIds) },
        { id: 'collections', count: getNeedsOptimizationCount(collections, 'collection', globalFilterIds) },
        { id: 'blogs', count: getNeedsOptimizationCount(blogs, 'blog', globalFilterIds) },
        { id: 'blogSets', count: getNeedsOptimizationCount(blogSets, 'blogSet', globalFilterIds) },
        { id: 'pages', count: getNeedsOptimizationCount(pages, 'page', globalFilterIds) },
        { id: 'images', count: getNeedsOptimizationCount(allImages, 'images', globalFilterIds) },
      ];
      
      const currentTabVisible = (tabs.find(t => t.id === globalAiTab)?.count || 0) > 0;
      if (!currentTabVisible) {
        const firstVisibleTab = tabs.find(t => t.count > 0);
        if (firstVisibleTab) {
          setGlobalAiTab(firstVisibleTab.id as any);
        }
      }
    }
  }, [globalFilterStatus, globalFilterIds, products, collections, blogs, blogSets, pages, allImages, globalAiTab]);

  // Dynamic tab switching for SEO Fix mode
  useEffect(() => {
    if (fixFilterStatus === 'needs_optimization' || fixFilterIds !== null) {
      const tabs = [
        { id: 'products', count: getNeedsOptimizationCount(products, 'product', fixFilterIds) },
        { id: 'collections', count: getNeedsOptimizationCount(collections, 'collection', fixFilterIds) },
        { id: 'blogs', count: getNeedsOptimizationCount(blogs, 'blog', fixFilterIds) },
        { id: 'blogSets', count: getNeedsOptimizationCount(blogSets, 'blogSet', fixFilterIds) },
        { id: 'pages', count: getNeedsOptimizationCount(pages, 'page', fixFilterIds) },
        { id: 'images', count: getNeedsOptimizationCount(allImages, 'images', fixFilterIds) },
      ];
      
      const currentTabVisible = (tabs.find(t => t.id === fixAiTab)?.count || 0) > 0;
      if (!currentTabVisible) {
        const firstVisibleTab = tabs.find(t => t.count > 0);
        if (firstVisibleTab) {
          setFixAiTab(firstVisibleTab.id as any);
        }
      }
    }
  }, [fixFilterStatus, fixFilterIds, products, collections, blogs, blogSets, pages, allImages, fixAiTab]);

  const renderAiTab = () => {
    const items = (() => {
      const baseItems = (() => {
        if (aiTab === 'images') {
          const imgs: any[] = [];
          products.forEach(p => {
            p.media.forEach(m => {
              if (m.type === 'image') {
                imgs.push({
                  ...m,
                  id: m.id || `img-${p.id}-${m.url.split('/').pop()}`,
                  size: m.size || (Math.floor(Math.random() * 400) + 100) * 1024,
                  parentType: 'product',
                  parentId: p.id,
                  parentTitle: p.title,
                  pageUrl: p.seoUrl || `/products/${p.id}`,
                  seoOptimized: p.seoOptimized || false
                });
              }
            });
          });
          collections.forEach(c => {
            if (c.image) {
              imgs.push({
                id: `col-img-${c.id}`,
                url: c.image,
                name: c.title,
                size: c.imageSize || (Math.floor(Math.random() * 400) + 100) * 1024, // Store in Bytes
                altText: c.imageAlt || '',
                parentType: 'collection',
                parentId: c.id,
                parentTitle: c.title,
                pageUrl: c.seoUrl || `/collections/${c.id}`,
                seoOptimized: c.seoOptimized || false
              });
            }
          });
          blogs.forEach(b => {
            if (b.image) {
              imgs.push({
                id: `blog-img-${b.id}`,
                url: b.image,
                name: b.title,
                size: b.imageSize || (Math.floor(Math.random() * 400) + 100) * 1024, // Store in Bytes
                altText: b.imageAlt || '',
                parentType: 'blog',
                parentId: b.id,
                parentTitle: b.title,
                pageUrl: b.seoUrl || `/blogs/${b.id}`,
                seoOptimized: b.seoOptimized || false
              });
            }
          });
          return imgs;
        }
        return aiTab === 'products' ? products : aiTab === 'collections' ? collections : aiTab === 'blogs' ? blogs : aiTab === 'blogSets' ? blogSets : pages;
      })();

      const filteredItems = baseItems.filter((item: any) => {
        // Filter by IDs if specified (from audit issues)
        if (filterIds && !filterIds.includes(item.id)) return false;

        // Search filter
        const matchesSearch = !searchQuery || (() => {
          const query = searchQuery.toLowerCase();
          return (
            (item.title && item.title.toLowerCase().includes(query)) ||
            (item.name && item.name.toLowerCase().includes(query)) ||
            (item.handle && item.handle.toLowerCase().includes(query)) ||
            (item.seoTitle && item.seoTitle.toLowerCase().includes(query))
          );
        })();

        // Status filter
        const matchesStatus = (() => {
          if (filterStatus === 'all') return true;
          
          if (item.seoOptimized) {
            if (filterStatus === 'optimized' || filterStatus === 'filled') return true;
            if (filterStatus === 'needs_optimization' || filterStatus === 'empty') return false;
          }
          
          const isEmpty = aiTab === 'images' 
            ? !item.altText 
            : (!item.seoTitle || !item.seoDescription);

          if (filterStatus === 'empty') return isEmpty;
          if (filterStatus === 'filled') return !isEmpty;
          
          if (filterStatus === 'needs_optimization') {
            const isShort = (item.seoTitle && item.seoTitle.length < 30) || (item.seoDescription && item.seoDescription.length < 50);
            const missingKeywords = !item.keywords || item.keywords.length === 0;
            const largeImage = aiTab === 'images' && (item.size || 0) > 500 * 1024;
            return isEmpty || isShort || missingKeywords || largeImage;
          }

          if (filterStatus === 'optimized') {
            const isShort = (item.seoTitle && item.seoTitle.length < 30) || (item.seoDescription && item.seoDescription.length < 50);
            const missingKeywords = !item.keywords || item.keywords.length === 0;
            const largeImage = aiTab === 'images' && (item.size || 0) > 500 * 1024;
            return !isEmpty && !isShort && !missingKeywords && !largeImage;
          }
          
          return true;
        })();

        // Product specific filters
        const matchesProductFilters = (() => {
          if (aiTab !== 'products') return true;
          
          const matchesTag = selectedTag === 'all' || (item.tags && item.tags.includes(selectedTag));
          const matchesCollection = selectedCollectionId === 'all' || (item.collections && item.collections.includes(selectedCollectionId));
          
          return matchesTag && matchesCollection;
        })();

        // Image specific filters
        const matchesImageFilters = (() => {
          if (aiTab !== 'images') return true;
          
          const matchesPage = selectedPageId === 'all' || (item.parentType === 'page' && item.parentId === selectedPageId);
          const matchesProduct = selectedProductId === 'all' || (item.parentType === 'product' && item.parentId === selectedProductId);
          
          return matchesPage && matchesProduct;
        })();

        return matchesSearch && matchesStatus && matchesProductFilters && matchesImageFilters;
      });

      return filteredItems;
    })();

    const isImageTab = aiTab === 'images';
    
    return (
      <div className="space-y-4">
        <AnimatePresence>
          {showManagementOnboarding && activeTab !== 'fix' && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-[2px]">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden border border-slate-100"
              >
                <div className="p-8 space-y-6">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                      <ICONS.Zap className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900">SEO 管理引导</h3>
                      <p className="text-slate-500 text-xs">快速了解如何高效管理您的 SEO 内容</p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-200 transition-all">
                      <div className="w-8 h-8 bg-white rounded-xl shadow-sm flex items-center justify-center text-blue-600 font-bold text-sm shrink-0">1</div>
                      <p className="text-sm text-slate-600 font-medium leading-relaxed">
                        为对象添加关键词，可通过 <span className="text-blue-600 font-bold">AI 批量生成</span>
                      </p>
                    </div>
                    <div className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-200 transition-all">
                      <div className="w-8 h-8 bg-white rounded-xl shadow-sm flex items-center justify-center text-blue-600 font-bold text-sm shrink-0">2</div>
                      <p className="text-sm text-slate-600 font-medium leading-relaxed">
                        点击 <span className="text-blue-600 font-bold">AI 优化</span> 可根据关键词优化 SEO 标题、描述、HANDLE
                      </p>
                    </div>
                    <div className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-200 transition-all">
                      <div className="w-8 h-8 bg-white rounded-xl shadow-sm flex items-center justify-center text-blue-600 font-bold text-sm shrink-0">3</div>
                      <p className="text-sm text-slate-600 font-medium leading-relaxed">
                        点击 <span className="text-blue-600 font-bold">编辑</span> 可精细化进行优化
                      </p>
                    </div>
                    <div className="flex gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 hover:border-blue-200 transition-all">
                      <div className="w-8 h-8 bg-white rounded-xl shadow-sm flex items-center justify-center text-blue-600 font-bold text-sm shrink-0">4</div>
                      <p className="text-sm text-slate-600 font-medium leading-relaxed">
                        <span className="text-blue-600 font-bold">主关键词</span>：第一个关键词默认为主关键词，AI 优化时将重点包含该词。点击关键词可手动切换。
                      </p>
                    </div>
                  </div>

                  <button 
                    onClick={handleCloseManagementOnboarding}
                    className="w-full py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
                  >
                    我知道了
                    <ICONS.ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <input 
          type="file" 
          ref={keywordImportRef} 
          className="hidden" 
          accept=".txt,.csv"
          onChange={handleKeywordImport}
        />
        {aiMode === 'list' && (
          <>
            <StrategyBanner />
            <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl w-fit">
                <button 
                  onClick={() => { setAiTab('products'); setSelectedItems([]); }}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${aiTab === 'products' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${
                    (filterStatus === 'needs_optimization' || filterIds !== null) && getNeedsOptimizationCount(products, 'product', filterIds) === 0 ? 'hidden' : ''
                  }`}
                >
                  商品
                  {getNeedsOptimizationCount(products, 'product', filterIds) > 0 && (
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full text-[11px]">
                      {getNeedsOptimizationCount(products, 'product', filterIds)}
                    </span>
                  )}
                </button>
                <button 
                  onClick={() => { setAiTab('collections'); setSelectedItems([]); }}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${aiTab === 'collections' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${
                    (filterStatus === 'needs_optimization' || filterIds !== null) && getNeedsOptimizationCount(collections, 'collection', filterIds) === 0 ? 'hidden' : ''
                  }`}
                >
                  集合
                  {getNeedsOptimizationCount(collections, 'collection', filterIds) > 0 && (
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full text-[11px]">
                      {getNeedsOptimizationCount(collections, 'collection', filterIds)}
                    </span>
                  )}
                </button>
                <button 
                  onClick={() => { setAiTab('blogs'); setSelectedItems([]); }}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${aiTab === 'blogs' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${
                    (filterStatus === 'needs_optimization' || filterIds !== null) && getNeedsOptimizationCount(blogs, 'blog', filterIds) === 0 ? 'hidden' : ''
                  }`}
                >
                  博客
                  {getNeedsOptimizationCount(blogs, 'blog', filterIds) > 0 && (
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full text-[11px]">
                      {getNeedsOptimizationCount(blogs, 'blog', filterIds)}
                    </span>
                  )}
                </button>
                <button 
                  onClick={() => { setAiTab('blogSets'); setSelectedItems([]); }}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${aiTab === 'blogSets' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${
                    (filterStatus === 'needs_optimization' || filterIds !== null) && getNeedsOptimizationCount(blogSets, 'blogSet', filterIds) === 0 ? 'hidden' : ''
                  }`}
                >
                  博客集
                  {getNeedsOptimizationCount(blogSets, 'blogSet', filterIds) > 0 && (
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full text-[11px]">
                      {getNeedsOptimizationCount(blogSets, 'blogSet', filterIds)}
                    </span>
                  )}
                </button>
                <button 
                  onClick={() => { setAiTab('pages'); setSelectedItems([]); }}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${aiTab === 'pages' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${
                    (filterStatus === 'needs_optimization' || filterIds !== null) && getNeedsOptimizationCount(pages, 'page', filterIds) === 0 ? 'hidden' : ''
                  }`}
                >
                  页面
                  {getNeedsOptimizationCount(pages, 'page', filterIds) > 0 && (
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full text-[11px]">
                      {getNeedsOptimizationCount(pages, 'page', filterIds)}
                    </span>
                  )}
                </button>
                <button 
                  onClick={() => { setAiTab('images'); setSelectedItems([]); }}
                  className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${aiTab === 'images' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'} ${
                    (filterStatus === 'needs_optimization' || filterIds !== null) && getNeedsOptimizationCount(allImages, 'images', filterIds) === 0 ? 'hidden' : ''
                  }`}
                >
                  图片
                  {getNeedsOptimizationCount(allImages, 'images', filterIds) > 0 && (
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full text-[11px]">
                      {getNeedsOptimizationCount(allImages, 'images', filterIds)}
                    </span>
                  )}
                </button>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative group">
                  <ICONS.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                  <input 
                    type="text"
                    placeholder="搜索标题、Handle..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 pr-4 py-2 bg-slate-100 border-none rounded-xl text-sm w-48 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all outline-none"
                  />
                </div>

                {aiTab === 'products' && (
                  <>
                    <SearchableSelect
                      options={[{ id: 'all', title: '所有标签' }, ...allTags.map(tag => ({ id: tag, title: tag }))]}
                      value={selectedTag}
                      onChange={setSelectedTag}
                      placeholder="所有标签"
                    />

                    <SearchableSelect
                      options={[{ id: 'all', title: '所有集合' }, ...collections.map(c => ({ id: c.id, title: c.title }))]}
                      value={selectedCollectionId}
                      onChange={setSelectedCollectionId}
                      placeholder="所有集合"
                    />
                  </>
                )}

                {aiTab === 'images' && (
                  <>
                    <SearchableSelect
                      options={[{ id: 'all', title: '所有页面' }, ...pages.map(p => ({ id: p.id, title: p.title }))]}
                      value={selectedPageId}
                      onChange={setSelectedPageId}
                      placeholder="所有页面"
                      className="max-w-[150px]"
                    />

                    <SearchableSelect
                      options={[{ id: 'all', title: '所有商品' }, ...products.map(p => ({ id: p.id, title: p.title }))]}
                      value={selectedProductId}
                      onChange={setSelectedProductId}
                      placeholder="所有商品"
                      className="max-w-[150px]"
                    />
                  </>
                )}

                <SearchableSelect
                  options={[
                    { id: 'all', title: '全部内容' },
                    { id: 'optimized', title: '已优化内容' },
                    { id: 'needs_optimization', title: '需优化内容' },
                    { id: 'empty', title: 'SEO 未填写' },
                    { id: 'filled', title: 'SEO 已填写' }
                  ]}
                  value={filterStatus}
                  onChange={(val) => setFilterStatus(val as any)}
                  placeholder="全部内容"
                />

                {isImageTab && items.filter((img: any) => (img.size || 0) > 200 * 1024).length > 0 && (
                  <motion.button
                    whileHover={{ scale: 1.02, y: -0.5 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleCompressAllLargeImages(items.filter((img: any) => (img.size || 0) > 200 * 1024))}
                    disabled={batchIsOptimizingField !== null}
                    className="relative overflow-hidden px-4 py-2 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white rounded-xl font-bold transition-all text-sm flex items-center gap-2 cursor-pointer disabled:opacity-50 shrink-0 shadow-md shadow-amber-500/10 focus:outline-none focus:ring-2 focus:ring-amber-500/30"
                  >
                    {batchIsOptimizingField === 'compress' ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}>
                        <ICONS.RefreshCw className="w-4 h-4 text-white" />
                      </motion.div>
                    ) : (
                      <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-4 h-4 text-amber-100 shrink-0">
                        <path d="M4 14V4a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v10" />
                        <rect x="2" y="16" width="20" height="6" rx="1" fill="currentColor" fillOpacity="0.2" stroke="none" />
                        <path d="m9 10 3 3 3-3" />
                        <path d="M12 4v9" strokeWidth="2.5" />
                      </svg>
                    )}
                    <span>压缩全部过大图片 ({items.filter((img: any) => (img.size || 0) > 200 * 1024).length})</span>
                  </motion.button>
                )}
              </div>
            </div>
          </div>
          </>
        )}

        {aiMode === 'chat' ? (
          <div className="space-y-6">
            {/* SEO Optimization Timeline */}
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-gradient-to-br from-indigo-900 to-slate-900 rounded-[32px] p-8 text-white shadow-xl relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                <ICONS.TrendingUp className="w-64 h-64 rotate-12" />
              </div>
              
              <div className="relative z-10 space-y-8">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="space-y-2">
                    <h2 className="text-3xl font-black tracking-tight">你的 SEO 优化时间线</h2>
                    <p className="text-indigo-200 font-medium max-w-2xl leading-relaxed">
                      SEO 是一项长期投入。Google 从发现到认可你的优化，一般会经历的阶段与预期效果。
                    </p>
                  </div>
                  <div className="flex items-center gap-3 bg-white/10 backdrop-blur-md px-5 py-3 rounded-2xl border border-white/10 self-start">
                    <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
                    <span className="text-sm font-bold tracking-wide uppercase">AI Engine Active</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4 relative">
                  {/* Progress Line - Desktop Only */}
                  <div className="hidden lg:block absolute top-12 left-8 right-8 h-0.5 bg-white/10 z-0" />
                  
                  {[
                    { 
                      time: "第 1 周", 
                      title: "基础搭建", 
                      desc: "生成 SEO策略，优化商品标签与图片替代文本 (alt) 和页面元标签 (meta)。",
                      icon: <ICONS.Zap className="w-5 h-5" />,
                      color: "bg-blue-500",
                      glow: "shadow-blue-500/50"
                    },
                    { 
                      time: "第 1–2 周", 
                      title: "Google 发现改动", 
                      desc: "Google 爬虫抓取并收录你新增 / 更新的内容，此过程自动进行。",
                      icon: <ICONS.Search className="w-5 h-5" />,
                      color: "bg-indigo-500",
                      glow: "shadow-indigo-500/50"
                    },
                    { 
                      time: "第 3–6 周", 
                      title: "展现量开始上升", 
                      desc: "开始出现在搜索结果中。建议绑定 GSC 跟踪数据。",
                      icon: <ICONS.TrendingUp className="w-5 h-5" />,
                      color: "bg-purple-500",
                      glow: "shadow-purple-500/50"
                    },
                    { 
                      time: "第 6–12 周", 
                      title: "排名逐步提升", 
                      desc: "在长尾关键词上获得排名：商品名、SKU 变体、细分搜索等。",
                      icon: <ICONS.Analysis className="w-5 h-5" />,
                      color: "bg-pink-500",
                      glow: "shadow-pink-500/50"
                    },
                    { 
                      time: "第 3–6 个月", 
                      title: "流量显著增长", 
                      desc: "在有竞争度的关键词上获得稳定排名，SEO 飞轮正式启动。",
                      icon: <ICONS.Zap className="w-5 h-5" />,
                      color: "bg-orange-500",
                      glow: "shadow-orange-500/50"
                    },
                    { 
                      time: "第 6–12 个月", 
                      title: "表现稳定强势", 
                      desc: "在竞争激烈的类目上获得稳健的市场份额与流量转化。",
                      icon: <ICONS.Globe className="w-5 h-5" />,
                      color: "bg-emerald-500",
                      glow: "shadow-emerald-500/50"
                    }
                  ].map((step, idx) => (
                    <motion.div 
                      key={idx}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: idx * 0.1 }}
                      className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-5 space-y-4 relative z-10 flex flex-col group hover:bg-white/10 transition-all hover:border-white/20"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-black tracking-widest text-indigo-300 uppercase">{step.time}</span>
                        <div className={`w-10 h-10 ${step.color} rounded-xl flex items-center justify-center shadow-lg ${step.glow} group-hover:scale-110 transition-transform`}>
                          {step.icon}
                        </div>
                      </div>
                      <div className="space-y-2 flex-1">
                        <h4 className="text-sm font-black text-white leading-tight">{step.title}</h4>
                        <p className="text-[11px] text-indigo-100/60 leading-relaxed font-medium">
                          {step.desc}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>
            </motion.div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                <div className="mb-4">
                  <h3 className="font-bold text-slate-900 flex items-center gap-2">
                    <ICONS.Analysis className="text-blue-500" />
                    请告诉我您品牌信息
                  </h3>
                </div>
                <p className="text-xs text-slate-500 mb-4">
                  AI 将根据您的店铺定位和商品信息，为您量身定制 SEO策略。
                  <br />
                  <span className="text-blue-600 font-medium">当前已包含 {products.length} 个商品参与分析。</span>
                </p>
                <textarea 
                  value={storeInfo}
                  onChange={(e) => setStoreInfo(e.target.value)}
                  placeholder="请描述您的店铺定位、主营产品及目标关键词。例如：我们是一家专注于复古风格女装的独立站，主营连衣裙和配饰，目标客户是 20-35 岁追求个性的女性..."
                  className="w-full h-40 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 transition-all resize-none mb-4"
                />

                <div className="mb-4">
                  <label className="block text-sm font-bold text-slate-600 mb-2">也可以上传您公司介绍文件</label>
                  <div 
                    onClick={() => fileInputRef.current?.click()}
                    className={`w-full p-4 border-2 border-dashed rounded-2xl transition-all cursor-pointer flex flex-col items-center justify-center gap-2 ${
                      uploadedFile ? 'border-blue-500 bg-blue-50' : 'border-slate-200 hover:border-blue-400 hover:bg-slate-50'
                    }`}
                  >
                    <input 
                      type="file" 
                      ref={fileInputRef}
                      className="hidden" 
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) setUploadedFile(file);
                      }}
                    />
                    {(uploadedFile || savedFileName) ? (
                      <>
                        <ICONS.CheckCircle className="w-8 h-8 text-blue-500" />
                        <div className="text-center">
                          <p className="text-sm font-bold text-slate-900">{uploadedFile?.name || savedFileName}</p>
                          {uploadedFile && <p className="text-[11px] text-slate-500">{(uploadedFile.size / 1024).toFixed(1)} KB</p>}
                          {!uploadedFile && savedFileName && <p className="text-[11px] text-slate-400">已保存的文件</p>}
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setUploadedFile(null);
                            setSavedFileName(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="text-[11px] font-bold text-red-500 hover:text-red-600 underline"
                        >
                          移除文件
                        </button>
                      </>
                    ) : (
                      <>
                        <div className="w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-400">
                          <ICONS.Upload className="w-5 h-5" />
                        </div>
                        <div className="text-center">
                          <p className="text-sm font-bold text-slate-600">点击或拖拽上传文件</p>
                          <p className="text-[11px] text-slate-400">支持 PDF, Word, TXT 等格式</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 mb-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">目标市场 (可多选)</label>
                    <SearchableSelect
                      multiple
                      options={[
                        { id: '美国', title: '美国' },
                        { id: '英国', title: '英国' },
                        { id: '德国', title: '德国' },
                        { id: '法国', title: '法国' },
                        { id: '日本', title: '日本' },
                        { id: '加拿大', title: '加拿大' },
                        { id: '澳大利亚', title: '澳大利亚' },
                        { id: '新加坡', title: '新加坡' },
                        { id: '东南亚', title: '东南亚' },
                        { id: '拉美', title: '拉美' }
                      ]}
                      value={targetMarket}
                      onChange={(val) => {
                        if (val.length > 0) {
                          setTargetMarket(val);
                        } else {
                          toast.error("请至少选择一个目标市场");
                        }
                      }}
                      placeholder="选择目标市场"
                      className="w-full"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 mb-4">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-400 uppercase mb-1.5">目标语言</label>
                    <div className="relative">
                      <select 
                        value={targetLanguage}
                        onChange={(e) => {
                          const lang = e.target.value;
                          setTargetLanguage(lang);
                          setKeywordLanguage(lang);
                        }}
                        className="w-full p-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer"
                      >
                        <option value="英语">英语</option>
                        <option value="德语">德语</option>
                        <option value="法语">法语</option>
                        <option value="日语">日语</option>
                        <option value="西班牙语">西班牙语</option>
                        <option value="中文">中文</option>
                      </select>
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <ICONS.ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-4 mb-6 pt-4 border-t border-slate-100">
                  <h4 className="text-xs font-bold text-slate-900 flex items-center gap-2">
                    <ICONS.Settings className="w-3.5 h-3.5 text-slate-400" />
                    生成设置
                  </h4>
                  
                  <div>
                    <label className="block text-base font-bold text-slate-500 uppercase mb-1.5">品牌词 (将拼接在 SEO 标题后)</label>
                    <input 
                      type="text"
                      placeholder="例如: SEO标题 品牌词"
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 transition-all"
                    />
                  </div>

                  <div>
                    <label className="block text-base font-bold text-slate-500 uppercase mb-1.5 flex items-center gap-2">
                      <ICONS.AlertTriangle className="w-3 h-3" />
                      排除词 (AI 生成内容将避开这些词)
                    </label>
                    <input 
                      type="text"
                      placeholder="例如: 便宜, 二手"
                      value={excludedKeywords}
                      onChange={(e) => setExcludedKeywords(e.target.value)}
                      className="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-blue-500 transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2 mb-4 p-3 bg-blue-50/50 rounded-lg border border-blue-100">
                  <ICONS.AlertTriangle className="w-4 h-4 text-blue-500" />
                  <span className="text-[11px] text-blue-700">提示：描述越详细，AI 生成的建议越精准。</span>
                </div>
                <button 
                  onClick={handleAnalyzeSite}
                  disabled={isAnalyzing || (!storeInfo.trim() && !uploadedFile)}
                  className="w-full mt-4 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isAnalyzing ? (
                    <>
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                        <ICONS.RefreshCw className="w-4 h-4" />
                      </motion.div>
                      分析中...
                    </>
                  ) : (
                    <>
                      <ICONS.Zap className="w-4 h-4" />
                      开始生成策略
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="lg:col-span-2">
              <AnimatePresence mode="wait">
                <motion.div 
                  key="seo-analysis-results"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="space-y-6"
                >
                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <div className="flex items-center gap-3 mb-4">
                        <h3 className="font-bold text-slate-900">整体 SEO 策略</h3>
                      </div>
                      <div className="text-sm text-slate-600 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-100 whitespace-pre-wrap min-h-[100px]">
                        {aiAnalysis?.strategy || (isAnalyzing ? '正在分析中...' : '请在左侧输入品牌信息并点击“开始生成策略”来生成您的 SEO 策略。')}
                      </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
                      <div className="flex flex-col gap-4 mb-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <h3 className="font-bold text-slate-900">推荐关键词</h3>
                            <div className="flex gap-2">
                              <button 
                                onClick={() => setSelectedKeywords(editableKeywords)}
                                className="text-[11px] font-bold text-blue-600 hover:underline"
                              >
                                全选
                              </button>
                              <button 
                                onClick={() => setSelectedKeywords([])}
                                className="text-[11px] font-bold text-slate-400 hover:underline"
                              >
                                取消全选
                              </button>
                              <div className="h-3 w-px bg-slate-200 mx-1" />
                            </div>
                          </div>
                        </div>
                        <div className="flex gap-2">
                          <textarea 
                            value={newKeyword}
                            onChange={(e) => setNewKeyword(e.target.value)}
                            placeholder="手动批量添加关键词 (可使用“、”“，”或换行进行分割关键词)..."
                            className="text-xs p-2 border border-slate-200 rounded-lg outline-none focus:border-blue-500 w-full h-10 resize-none"
                          />
                          <button 
                            onClick={() => {
                              if (newKeyword.trim()) {
                                const newKws = newKeyword.trim().split(/[\n、,，]+/).filter(k => k.trim());
                                setEditableKeywords(prev => [...prev, ...newKws]);
                                setSelectedKeywords(prev => [...prev, ...newKws]);
                                setNewKeyword('');
                              }
                            }}
                            className="px-4 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 flex items-center justify-center"
                          >
                            <ICONS.Plus className="w-5 h-5" />
                          </button>
                        </div>
                      </div>
                      {editableKeywords.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                          {editableKeywords.map((kw, i) => (
                            <div 
                              key={i} 
                              onClick={() => {
                                setSelectedKeywords(prev => 
                                  prev.includes(kw) ? prev.filter(k => k !== kw) : [...prev, kw]
                                );
                              }}
                              className={`group px-3 py-1 rounded-full text-xs font-bold border transition-all cursor-pointer flex items-center gap-2 ${
                                selectedKeywords.includes(kw)
                                  ? 'bg-blue-50 text-blue-600 border-blue-100'
                                  : 'bg-slate-50 text-slate-400 border-slate-100 opacity-60 hover:opacity-100'
                              }`}
                            >
                              {selectedKeywords.includes(kw) && <span className="text-[11px]">✓</span>}
                              {kw}
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditableKeywords(prev => prev.filter((_, idx) => idx !== i));
                                  setSelectedKeywords(prev => prev.filter(k => k !== kw));
                                }}
                                className="opacity-0 group-hover:opacity-100 text-slate-400 hover:text-red-500 transition-all"
                              >
                                <ICONS.XCircle className="w-3 h-3" />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 text-slate-400 text-xs border border-dashed border-slate-200 rounded-xl">
                          {isAnalyzing ? '正在生成关键词...' : '暂无推荐关键词，请先生成策略。'}
                        </div>
                      )}
                    </div>

                    <div className="space-y-4 mt-8">
                      {isExecuting && (
                        <div className="bg-white p-6 rounded-2xl border border-blue-100 shadow-lg shadow-blue-50 space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-blue-600">{executionStatus}</span>
                            <span className="text-xs text-slate-400">{Math.round(executionProgress)}%</span>
                          </div>
                          <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                            <motion.div 
                              className="h-full bg-blue-600"
                              initial={{ width: 0 }}
                              animate={{ width: `${executionProgress}%` }}
                            />
                          </div>
                        </div>
                      )}
                      
                      <div className="flex gap-4">
                        <button 
                          onClick={handleSaveSEOStrategy}
                          disabled={isExecuting || isAnalyzing}
                          className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          保存策略
                        </button>
                        <div className="flex-1 relative">
                          {showResetConfirm ? (
                            <div className="absolute inset-0 flex gap-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
                              <button 
                                onClick={handleResetGlobalStrategy}
                                disabled={isResetting}
                                className="flex-1 bg-red-600 text-white rounded-2xl font-bold text-sm hover:bg-red-700 transition-all flex items-center justify-center"
                              >
                                {isResetting ? '清空中...' : '确认清空'}
                              </button>
                              <button 
                                onClick={() => setShowResetConfirm(false)}
                                className="flex-1 bg-slate-200 text-slate-600 rounded-2xl font-bold text-sm hover:bg-slate-300 transition-all"
                              >
                                取消
                              </button>
                            </div>
                          ) : null}
                          <button 
                            onClick={() => setShowResetConfirm(true)}
                            disabled={isExecuting || isAnalyzing || isResetting}
                            className={`w-full py-4 bg-red-50 text-red-600 rounded-2xl font-bold hover:bg-red-100 transition-all border border-red-100 flex items-center justify-center gap-2 ${showResetConfirm ? 'opacity-0 invisible' : 'opacity-100 visible'}`}
                          >
                            <ICONS.Trash className="w-4 h-4" />
                            清空保存
                          </button>
                        </div>
                        <button 
                          onClick={() => {
                            setAiAnalysis(null);
                            setExecutionConfirmed(false);
                            setIsFinalConfirmed(false);
                            setEditableKeywords([]);
                            setSelectedKeywords([]);
                          }}
                          className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                        >
                          重置当前
                        </button>
                      </div>
                    </div>

                    {executionConfirmed && (
                      <motion.div 
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="bg-emerald-50 p-8 rounded-3xl border border-emerald-100 text-center space-y-4 mt-6"
                      >
                        <div className="w-16 h-16 bg-emerald-500 text-white rounded-full flex items-center justify-center mx-auto shadow-lg shadow-emerald-200">
                          <ICONS.Check className="w-8 h-8" />
                        </div>
                        <p className="text-emerald-700">
                          您可前往SEO检测，查看站点SEO 情况
                        </p>
                        <div className="flex gap-3 justify-center pt-2">
                          <button 
                            onClick={() => {
                              setAiMode('list');
                              setAiTab('products');
                              setActiveTab('audit');
                              onTabChange?.('SEO检测');
                              setExecutionConfirmed(false);
                            }}
                            className="px-6 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-all"
                          >
                            前往 SEO 检测
                          </button>
                          <button 
                            onClick={() => setExecutionConfirmed(false)}
                            className="px-6 py-3 bg-white text-emerald-600 border border-emerald-200 rounded-xl font-bold hover:bg-emerald-50 transition-all"
                          >
                            关闭提示
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
            <div className="flex items-center justify-end gap-3">
              {selectedItems.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-4 bg-blue-600 text-white px-4 py-2 rounded-xl shadow-lg shadow-blue-200"
                >
                  <span className="text-xs font-bold">已选择 {selectedItems.length} 项</span>
                  
                    <div className="flex items-center gap-2">
                    {aiTab === 'images' ? (
                      <>
                        <button 
                          onClick={handleBatchOptimizeAltText}
                          disabled={batchIsOptimizingField !== null}
                          className="px-3 py-1 bg-white text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-50 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                          {batchIsOptimizingField === 'altText' ? (
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                              <ICONS.RefreshCw className="w-3 h-3" />
                            </motion.div>
                          ) : <ICONS.Zap className="w-3 h-3" />}
                          AI 批量优化 Alt
                        </button>


                      </>
                    ) : (
                      <>
                        <button 
                          onClick={() => handleBatchOptimizeField('all')}
                          disabled={batchIsOptimizingField !== null}
                          className="px-3 py-1 bg-white text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-50 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                          {batchIsOptimizingField === 'all' ? (
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                              <ICONS.RefreshCw className="w-3 h-3" />
                            </motion.div>
                          ) : <ICONS.Zap className="w-3 h-3" />}
                          批量 AI 优化
                        </button>

                        <button 
                          onClick={handleBatchAdopt}
                          disabled={batchIsOptimizingField !== null}
                          className="px-3 py-1 bg-white text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-50 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                          {batchIsOptimizingField === 'adopt' ? (
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                              <ICONS.RefreshCw className="w-3 h-3" />
                            </motion.div>
                          ) : <ICONS.CheckCircle className="w-3 h-3" />}
                          批量采纳
                        </button>
                      </>
                    )}
                  </div>

                  <button 
                    onClick={() => setSelectedItems([])}
                    className="text-white/70 hover:text-white transition-all"
                  >
                    <ICONS.XCircle className="w-4 h-4" />
                  </button>
                </motion.div>
              )}
            </div>

            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200">
                    <th className="px-6 py-4 w-12">
                      <input 
                        type="checkbox" 
                        className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                        checked={selectedItems.length === items.length && items.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedItems(items.map((i: any) => i.id));
                          } else {
                            setSelectedItems([]);
                          }
                        }}
                      />
                    </th>
                    <th className="px-2 py-4 text-xs font-bold text-slate-400 uppercase whitespace-nowrap w-[60px]">优先级</th>
                    {isImageTab ? (
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase whitespace-nowrap w-[100px] min-w-[100px] max-w-[100px]">
                        图片预览
                      </th>
                    ) : (
                      <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase whitespace-nowrap w-[300px] min-w-[300px] max-w-[300px]">
                        {aiTab === 'products' ? '商品标题' : '标题'}
                      </th>
                    )}
                    {isImageTab ? (
                      <>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase whitespace-nowrap w-[240px] min-w-[240px] max-w-[240px]">图片名称</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase whitespace-nowrap">所在页面</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase whitespace-nowrap">大小</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase whitespace-nowrap">Alt 文本</th>
                      </>
                    ) : (
                      <>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase whitespace-nowrap w-[300px] min-w-[300px] max-w-[300px]">关键词</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase whitespace-nowrap w-[300px] min-w-[300px] max-w-[300px]">SEO 标题</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase whitespace-nowrap w-[250px] min-w-[250px] max-w-[250px]">SEO 描述</th>
                        <th className="px-3 py-4 text-xs font-bold text-slate-400 uppercase whitespace-nowrap w-[150px] min-w-[150px] max-w-[150px]">URL</th>
                      </>
                    )}
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-right whitespace-nowrap w-[140px]">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item: any) => (
                    <tr key={item.id} className={`transition-colors border-l-4 ${
                      item.seoOptimized 
                        ? 'bg-emerald-50/5 hover:bg-emerald-50/15 border-l-emerald-500' 
                        : 'border-l-transparent hover:bg-slate-50/50'
                    } ${selectedItems.includes(item.id) ? 'bg-blue-50/30' : ''}`}>
                      <td className="px-6 py-4">
                        <input 
                          type="checkbox" 
                          className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                          checked={selectedItems.includes(item.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedItems(prev => [...prev, item.id]);
                            } else {
                              setSelectedItems(prev => prev.filter(id => id !== item.id));
                            }
                          }}
                        />
                      </td>
                      <td className="px-2 py-4">
                        {(() => {
                           let priority = 1;
                           if (item.seoOptimized) {
                             priority = 1;
                           } else if (isImageTab) {
                             if (!item.altText) priority += 5;
                             if ((item.size || 0) > 500 * 1024) priority += 3;
                             if (isImageNameMeaningless(item.name)) priority += 2;
                           } else {
                             if (!item.seoTitle) priority += 3;
                             else if (item.seoTitle.length < 30) priority += 1;
                             if (!item.seoDescription) priority += 3;
                             else if (item.seoDescription.length < 50) priority += 1;
                             if (!item.keywords || item.keywords.length === 0) priority += 2;
                           }
                           priority = Math.min(10, priority);
                           
                           const colors = [
                             'bg-slate-100 text-slate-500', // 1
                             'bg-slate-100 text-slate-500', // 2
                             'bg-blue-50 text-blue-500',    // 3
                             'bg-blue-50 text-blue-500',    // 4
                             'bg-amber-50 text-amber-500',  // 5
                             'bg-amber-50 text-amber-500',  // 6
                             'bg-orange-50 text-orange-500',// 7
                             'bg-orange-50 text-orange-500',// 8
                             'bg-red-50 text-red-500',     // 9
                             'bg-red-600 text-white',      // 10
                           ];

                           return (
                             <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black shadow-sm ${colors[priority - 1]}`} title={`优化优先级: ${priority}/10`}>
                               {priority}
                             </div>
                           );
                        })()}
                      </td>
                      {isImageTab ? (
                        <td className="px-6 py-4 w-[100px] min-w-[100px] max-w-[100px]">
                          <div 
                            className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 cursor-zoom-in group relative"
                            onClick={() => setPreviewImage({ url: item.url, name: item.name })}
                          >
                            <img src={item.url} alt={item.altText} className="w-full h-full object-cover group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                              <ICONS.Search className="w-4 h-4 text-white" />
                            </div>
                          </div>
                        </td>
                      ) : (
                        <td className="px-6 py-4 w-[300px] min-w-[300px] max-w-[300px]">
                          <div className="flex flex-col gap-1">
                            <a 
                              href={getItemPageUrl(item)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-slate-900 line-clamp-2 hover:text-blue-600 hover:underline transition-all" 
                              title={item.title || item.name}
                            >
                              {item.title || item.name}
                            </a>
                            {item.seoOptimized ? (
                              <span className="w-fit px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[10px] font-bold border border-emerald-100 flex items-center gap-0.5">
                                <ICONS.Check className="w-2.5 h-2.5" />
                                已优化
                              </span>
                            ) : (item.seoTitle && item.seoTitle.length >= 30 && item.seoDescription && item.seoDescription.length >= 50 && item.keywords && item.keywords.length > 0) ? (
                              null
                            ) : (
                              <span className="w-fit px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded text-[11px] font-bold border border-amber-100">未优化</span>
                            )}
                          </div>
                        </td>
                      )}
                      {isImageTab ? (
                        <>
                          <td className="px-6 py-4 w-[240px] min-w-[240px] max-w-[240px]">
                            <div className="flex flex-col gap-1">
                              <a 
                                href={item.pageUrl || item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-semibold text-slate-700 truncate max-w-[220px] hover:text-blue-600 hover:underline transition-all block" 
                                title={item.name}
                              >
                                {item.name}
                              </a>
                              {item.seoOptimized ? (
                                <span className="w-fit px-1.5 py-0.5 bg-emerald-50 text-emerald-600 rounded text-[10px] font-bold border border-emerald-100 flex items-center gap-0.5">
                                  <ICONS.Check className="w-2.5 h-2.5" />
                                  已优化
                                </span>
                              ) : (!item.altText || (item.size || 0) > 500 * 1024 || isImageNameMeaningless(item.name)) ? (
                                <span className="w-fit px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded text-[11px] font-bold border border-amber-100 block">
                                  {isImageNameMeaningless(item.name) ? '名称无意义' : '待优化'}
                                </span>
                              ) : null}
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <span className="text-[11px] text-slate-400 uppercase font-bold">{item.parentType === 'product' ? '商品' : item.parentType === 'collection' ? '集合' : '博客'}</span>
                              <a 
                                href={item.pageUrl} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                className="text-xs text-blue-600 hover:underline line-clamp-1"
                                title={item.parentTitle}
                              >
                                {item.parentTitle}
                              </a>
                            </div>
                          </td>
                          <td className="px-6 py-4">
                            <div className="flex items-center gap-2">
                              <span className={`text-xs font-mono ${(item.size || 0) > 500 * 1024 ? 'text-amber-600 font-bold' : 'text-slate-500'}`}>
                                {item.size ? (item.size > 1024 * 1024 ? `${(item.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(item.size / 1024)} KB`) : '未知'}
                              </span>
                              {(item.size || 0) > 500 * 1024 && (
                                <div title="图片过大，建议压缩">
                                  <ICONS.AlertTriangle className="w-3 h-3 text-amber-500" />
                                </div>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 min-w-[250px]">
                            <div className={`text-xs p-2 rounded-xl border line-clamp-2 min-h-[36px] flex items-center ${!item.altText ? 'bg-rose-50/70 border-rose-100 text-rose-700 font-medium' : 'text-slate-600 bg-slate-50/50 border-slate-100'}`} title={item.altText || '无 Alt 文本'}>
                              {item.altText || (
                                <span className="flex items-center gap-1.5 font-bold text-rose-600">
                                  <ICONS.AlertTriangle className="w-3.5 h-3.5" />
                                  无 Alt 文本
                                </span>
                              )}
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4 w-[300px] min-w-[300px] max-w-[300px]">
                            {inlineEditing?.id === item.id && inlineEditing?.field === 'keywords' ? (
                              <div className="flex flex-col gap-2">
                                <textarea 
                                  value={inlineEditing.value}
                                  onChange={(e) => setInlineEditing({ ...inlineEditing, value: e.target.value })}
                                  className="w-full p-2 text-xs border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-h-[60px]"
                                  autoFocus
                                />
                                <div className="flex justify-end gap-2">
                                  <button onClick={() => setInlineEditing(null)} className="px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100 rounded">取消</button>
                                  <button onClick={handleInlineSave} className="px-2 py-1 text-[11px] bg-blue-600 text-white rounded hover:bg-blue-700">保存</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex flex-wrap gap-1 mb-2">
                                  {(item.keywords || []).map((kw: string, idx: number) => {
                                    const isPrimary = item.primaryKeyword === kw || (!item.primaryKeyword && idx === 0);
                                    return (
                                      <span 
                                        key={idx} 
                                        title={kw} 
                                        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-medium group transition-all cursor-pointer ${
                                          isPrimary 
                                            ? 'bg-blue-600 text-white shadow-sm' 
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                        onClick={() => handleSetPrimaryKeyword(aiTab.slice(0, -1) as any, item, isPrimary ? '' : kw)}
                                      >
                                        {isPrimary && <ICONS.Star className="w-2.5 h-2.5 fill-current" />}
                                        {kw}
                                        <button 
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleUpdateKeywords(aiTab.slice(0, -1) as any, item, item.keywords.filter((_: any, i: number) => i !== idx));
                                          }}
                                          className={`transition-all ${isPrimary ? 'text-white/70 hover:text-white' : 'opacity-0 group-hover:opacity-100 hover:text-red-500'}`}
                                        >
                                          <ICONS.XCircle className="w-2.5 h-2.5" />
                                        </button>
                                      </span>
                                    );
                                  })}
                                </div>

                                <div className="flex gap-1 mb-2">
                                  <input 
                                    type="text"
                                    placeholder="添加关键词..."
                                    className="text-[11px] p-1 border border-slate-200 rounded outline-none focus:border-blue-500 w-24"
                                    onKeyDown={(e) => {
                                      if (e.key === 'Enter') {
                                        const val = (e.target as HTMLInputElement).value.trim();
                                        if (val) {
                                          const newKws = val.split(/[、,，]+/).filter(k => k.trim());
                                          handleUpdateKeywords(aiTab.slice(0, -1) as any, item, [...(item.keywords || []), ...newKws]);
                                          (e.target as HTMLInputElement).value = '';
                                        }
                                      }
                                    }}
                                  />
                                  <button 
                                    onClick={() => handleGenerateKeywords(aiTab.slice(0, -1) as any, item)}
                                    disabled={isGeneratingKeywords === item.id}
                                    className="p-1 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 disabled:opacity-50"
                                    title="AI 生成关键词"
                                  >
                                    {isGeneratingKeywords === item.id ? (
                                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                                        <ICONS.RefreshCw className="w-3 h-3" />
                                      </motion.div>
                                    ) : (
                                      <ICONS.Zap className="w-3 h-3" />
                                    )}
                                  </button>
                                </div>
                                
                                {/* AI Suggestion for Keywords */}
                                {itemSuggestions[item.id]?.keywords && itemSuggestions[item.id].keywords.some((kw: string) => !(item.keywords || []).includes(kw)) && (
                                  <div className="p-2 bg-indigo-50/50 rounded-lg border border-indigo-100/50">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[11px] font-bold text-indigo-500 uppercase flex items-center gap-1">
                                        <ICONS.Zap className="w-2 h-2" />
                                        AI 建议关键词
                                      </span>
                                      <button 
                                        onClick={() => handleApplySuggestion(item, 'keywords', itemSuggestions[item.id].keywords)}
                                        className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
                                      >
                                        采纳
                                      </button>
                                    </div>
                                    <div className="flex flex-wrap gap-1">
                                      {itemSuggestions[item.id].keywords.map((kw: string, idx: number) => {
                                        const isAdded = (item.keywords || []).includes(kw);
                                        return (
                                          <span 
                                            key={idx} 
                                            onClick={() => {
                                              if (!isAdded) {
                                                handleUpdateKeywords(aiTab.slice(0, -1) as any, item, [...(item.keywords || []), kw]);
                                              }
                                            }}
                                            className={`px-1 py-0.5 bg-white text-[11px] rounded border border-slate-100 transition-all ${
                                              isAdded 
                                                ? 'text-slate-300 bg-slate-50 border-slate-50 cursor-not-allowed' 
                                                : 'text-slate-500 hover:bg-indigo-50 hover:text-indigo-600 hover:border-indigo-200 cursor-pointer'
                                            }`}
                                            title={isAdded ? '已添加' : '点击添加'}
                                          >
                                            {kw}
                                          </span>
                                        );
                                      })}
                                    </div>
                                  </div>
                                )}
                              </>
                            )}
                          </td>
                          <td className="px-6 py-4 w-[300px] min-w-[300px] max-w-[300px]">
                            {inlineEditing?.id === item.id && inlineEditing?.field === 'seoTitle' ? (
                              <div className="flex flex-col gap-2">
                                <textarea 
                                  value={inlineEditing.value}
                                  onChange={(e) => setInlineEditing({ ...inlineEditing, value: e.target.value })}
                                  className="w-full p-2 text-xs border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-h-[60px]"
                                  autoFocus
                                />
                                <div className="flex justify-end gap-2">
                                  <button onClick={() => setInlineEditing(null)} className="px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100 rounded">取消</button>
                                  <button onClick={handleInlineSave} className="px-2 py-1 text-[11px] bg-blue-600 text-white rounded hover:bg-blue-700">保存</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-start justify-between group/cell">
                                  <div 
                                    className="text-xs text-slate-600" 
                                    title={item.seoTitle || ''}
                                  >
                                    {item.seoTitle ? (
                                      item.seoTitle
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200/60 shadow-xs whitespace-nowrap">
                                        <span className="w-1 h-1 rounded-full bg-rose-500 animate-pulse" />
                                        待填写
                                      </span>
                                    )}
                                  </div>
                                  <button 
                                    onClick={() => setInlineEditing({ id: item.id, field: 'seoTitle', value: item.seoTitle || '' })}
                                    className="opacity-0 group-hover/cell:opacity-100 p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all ml-2"
                                    title="快速编辑"
                                  >
                                    <ICONS.Edit className="w-3 h-3" />
                                  </button>
                                </div>
                                {/* AI Suggestion for Title */}
                                {itemSuggestions[item.id]?.seoTitle && itemSuggestions[item.id].seoTitle !== item.seoTitle && (
                                  <div className="mt-2 p-2 bg-indigo-50/50 rounded-lg border border-indigo-100/50 group/sugg relative">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[11px] font-bold text-indigo-500 uppercase flex items-center gap-1">
                                        <ICONS.Zap className="w-2 h-2" />
                                        AI 建议
                                      </span>
                                      <div className="flex items-center gap-2">
                                        {itemSuggestions[item.id]?.reasons?.seoTitle && (
                                          <div className="group/reason relative">
                                            <span className="text-[11px] text-indigo-400 cursor-help flex items-center gap-0.5">
                                              <ICONS.Info className="w-2.5 h-2.5" />
                                              原因
                                            </span>
                                            <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 text-white text-[11px] rounded-lg opacity-0 group-hover/reason:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                                              {itemSuggestions[item.id].reasons.seoTitle}
                                              <div className="absolute top-full right-4 border-4 border-transparent border-t-slate-800" />
                                            </div>
                                          </div>
                                        )}
                                        <button 
                                          onClick={() => handleApplySuggestion(item, 'seoTitle', itemSuggestions[item.id].seoTitle)}
                                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
                                        >
                                          采纳
                                        </button>
                                      </div>
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed italic">
                                      {itemSuggestions[item.id].seoTitle}
                                    </p>
                                  </div>
                                )}
                              </>
                            )}
                          </td>
                          <td className="px-6 py-4 w-[250px] min-w-[250px] max-w-[250px]">
                            {inlineEditing?.id === item.id && inlineEditing?.field === 'seoDescription' ? (
                              <div className="flex flex-col gap-2">
                                <textarea 
                                  value={inlineEditing.value}
                                  onChange={(e) => setInlineEditing({ ...inlineEditing, value: e.target.value })}
                                  className="w-full p-2 text-xs border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none min-h-[80px]"
                                  autoFocus
                                />
                                <div className="flex justify-end gap-2">
                                  <button onClick={() => setInlineEditing(null)} className="px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100 rounded">取消</button>
                                  <button onClick={handleInlineSave} className="px-2 py-1 text-[11px] bg-blue-600 text-white rounded hover:bg-blue-700">保存</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-start justify-between group/cell">
                                  <div 
                                    className="text-xs text-slate-600" 
                                    title={item.seoDescription || ''}
                                  >
                                    {item.seoDescription ? (
                                      item.seoDescription
                                    ) : (
                                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200/60 shadow-xs whitespace-nowrap">
                                        <span className="w-1 h-1 rounded-full bg-amber-500 animate-pulse" />
                                        待填写
                                      </span>
                                    )}
                                  </div>
                                  <button 
                                    onClick={() => setInlineEditing({ id: item.id, field: 'seoDescription', value: item.seoDescription || '' })}
                                    className="opacity-0 group-hover/cell:opacity-100 p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all ml-2"
                                    title="快速编辑"
                                  >
                                    <ICONS.Edit className="w-3 h-3" />
                                  </button>
                                </div>
                                {/* AI Suggestion for Description */}
                                {itemSuggestions[item.id]?.seoDescription && itemSuggestions[item.id].seoDescription !== item.seoDescription && (
                                  <div className="mt-2 p-2 bg-indigo-50/50 rounded-lg border border-indigo-100/50 group/sugg relative">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[11px] font-bold text-indigo-500 uppercase flex items-center gap-1">
                                        <ICONS.Zap className="w-2 h-2" />
                                        AI 建议
                                      </span>
                                      <div className="flex items-center gap-2">
                                        {itemSuggestions[item.id]?.reasons?.seoDescription && (
                                          <div className="group/reason relative">
                                            <span className="text-[11px] text-indigo-400 cursor-help flex items-center gap-0.5">
                                              <ICONS.Info className="w-2.5 h-2.5" />
                                              原因
                                            </span>
                                            <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 text-white text-[11px] rounded-lg opacity-0 group-hover/reason:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                                              {itemSuggestions[item.id].reasons.seoDescription}
                                              <div className="absolute top-full right-4 border-4 border-transparent border-t-slate-800" />
                                            </div>
                                          </div>
                                        )}
                                        <button 
                                          onClick={() => handleApplySuggestion(item, 'seoDescription', itemSuggestions[item.id].seoDescription)}
                                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
                                        >
                                          采纳
                                        </button>
                                      </div>
                                    </div>
                                    <p className="text-xs text-slate-500 leading-relaxed italic">
                                      {itemSuggestions[item.id].seoDescription}
                                    </p>
                                  </div>
                                )}
                              </>
                            )}
                          </td>
                          <td className="px-3 py-4 w-[150px] min-w-[150px] max-w-[150px]">
                            {inlineEditing?.id === item.id && inlineEditing?.field === 'seoUrl' ? (
                              <div className="flex flex-col gap-2">
                                <label className="text-[11px] text-slate-400 font-bold uppercase">
                                  编辑 URL Slug
                                </label>
                                <input 
                                  type="text"
                                  value={inlineEditing.value}
                                  onChange={(e) => setInlineEditing({ ...inlineEditing, value: e.target.value })}
                                  className="w-full p-2 text-xs border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                                  placeholder="url-slug"
                                  autoFocus
                                />
                                <div className="flex justify-end gap-2">
                                  <button onClick={() => setInlineEditing(null)} className="px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100 rounded">取消</button>
                                  <button onClick={handleInlineSave} className="px-2 py-1 text-[11px] bg-blue-600 text-white rounded hover:bg-blue-700">保存</button>
                                </div>
                              </div>
                            ) : (
                              <>
                                <div className="flex items-start justify-between group/cell">
                                  <div className="text-xs text-slate-400 font-mono line-clamp-3 break-all" title={item.seoUrl || item.handle || '/'}>
                                    {(!item.seoUrl && !item.handle) ? (
                                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200/60 shadow-xs whitespace-nowrap">
                                        <span className="w-1 h-1 rounded-full bg-purple-500 animate-pulse" />
                                        待设置
                                      </span>
                                    ) : (
                                      item.seoUrl || item.handle || '/'
                                    )}
                                  </div>
                                  <button 
                                    onClick={() => setInlineEditing({ id: item.id, field: 'seoUrl', value: item.seoUrl || item.handle || '' })}
                                    className="opacity-0 group-hover/cell:opacity-100 p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all ml-2"
                                    title="快速编辑"
                                  >
                                    <ICONS.Edit className="w-3 h-3" />
                                  </button>
                                </div>
                                {/* AI Suggestion for Handle */}
                                {itemSuggestions[item.id]?.seoUrl && itemSuggestions[item.id].seoUrl !== (item.seoUrl || item.handle) && (
                                  <div className="mt-2 p-2 bg-indigo-50/50 rounded-lg border border-indigo-100/50 group/sugg relative">
                                    <div className="flex items-center justify-between mb-1">
                                      <span className="text-[11px] font-bold text-indigo-500 uppercase flex items-center gap-1">
                                        <ICONS.Zap className="w-2 h-2" />
                                        AI 建议
                                      </span>
                                      <div className="flex items-center gap-2">
                                        {itemSuggestions[item.id]?.reasons?.seoUrl && (
                                          <div className="group/reason relative">
                                            <span className="text-[11px] text-indigo-400 cursor-help flex items-center gap-0.5">
                                              <ICONS.Info className="w-2.5 h-2.5" />
                                              原因
                                            </span>
                                            <div className="absolute bottom-full right-0 mb-2 w-48 p-2 bg-slate-800 text-white text-[11px] rounded-lg opacity-0 group-hover/reason:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                                              {itemSuggestions[item.id].reasons.seoUrl}
                                              <div className="absolute top-full right-4 border-4 border-transparent border-t-slate-800" />
                                            </div>
                                          </div>
                                        )}
                                        <button 
                                          onClick={() => handleApplySuggestion(item, 'seoUrl', itemSuggestions[item.id].seoUrl)}
                                          className="text-[11px] font-bold text-indigo-600 hover:text-indigo-700 hover:underline"
                                        >
                                          采纳
                                        </button>
                                      </div>
                                    </div>
                                    <p className="text-xs text-slate-500 font-mono break-all italic">
                                      {itemSuggestions[item.id].seoUrl}
                                    </p>
                                  </div>
                                )}


                              </>
                            )}
                          </td>
                        </>
                      )}
                      <td className="px-6 py-4 w-[140px] text-right whitespace-nowrap">
                        <div className="flex flex-col items-end gap-2">
                          <button 
                            onClick={() => aiTab === 'images' ? handleOptimizeItem(item, 'image') : handleGenerateSuggestions(item, aiTab.slice(0, -1) as any)}
                            disabled={isOptimizingItem === item.id || isGeneratingSuggestions === item.id}
                            className="w-full px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-[11px] font-bold hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                          >
                            {isOptimizingItem === item.id || isGeneratingSuggestions === item.id ? (
                              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                                <ICONS.RefreshCw className="w-3 h-3" />
                              </motion.div>
                            ) : (
                              <ICONS.Zap className="w-3 h-3" />
                            )}
                            AI 优化
                          </button>

                          {isImageTab && (
                            <button 
                              onClick={() => {
                                setEditingItem(item);
                                setIsEditModalOpen(true);
                              }}
                              className="w-full px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[11px] font-bold hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-1.5"
                            >
                              <ICONS.Edit className="w-3 h-3" />
                              去处理
                            </button>
                          )}

                          {!isImageTab && itemSuggestions[item.id] && (
                            <div className="w-full space-y-1.5">
                              <button
                                onClick={() => {
                                  if (confirmingApplyId === item.id) {
                                    setConfirmingApplyId(null);
                                  } else {
                                    setConfirmingApplyId(item.id);
                                  }
                                }}
                                className={`w-full px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all flex items-center justify-center gap-1.5 shadow-sm ${
                                  confirmingApplyId === item.id
                                    ? 'bg-slate-200 text-slate-700 border border-slate-300'
                                    : 'bg-emerald-50 text-emerald-600 border border-emerald-200/40 hover:bg-emerald-600 hover:text-white'
                                }`}
                                title="一键采纳所有 AI 建议"
                              >
                                <ICONS.CheckCircle className="w-3 h-3" />
                                批量采纳
                              </button>
                              
                              {confirmingApplyId === item.id && (
                                <motion.div 
                                  initial={{ opacity: 0, height: 0, y: -4 }}
                                  animate={{ opacity: 1, height: 'auto', y: 0 }}
                                  exit={{ opacity: 0, height: 0, y: -4 }}
                                  className="flex items-center gap-1 w-full overflow-hidden"
                                >
                                  <button
                                    onClick={() => {
                                      handleApplySuggestion(item, 'all', itemSuggestions[item.id]);
                                      setConfirmingApplyId(null);
                                    }}
                                    className="flex-1 px-2 py-1 bg-emerald-500 hover:bg-emerald-600 text-white rounded text-[11px] font-black tracking-tight transition-all flex items-center justify-center gap-0.5 shadow-sm"
                                  >
                                    <ICONS.Check className="w-2.5 h-2.5" />
                                    确认
                                  </button>
                                  <button
                                    onClick={() => setConfirmingApplyId(null)}
                                    className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-500 rounded text-[11px] font-bold transition-all"
                                  >
                                    取消
                                  </button>
                                </motion.div>
                              )}
                            </div>
                          )}

                          {/* 已优化手动开关 */}
                          <div className="w-full mt-1.5 select-none" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              onClick={async () => {
                                const isOptimized = !item.seoOptimized;
                                try {
                                  if (aiTab === 'images') {
                                    const pType = item.parentType === 'product' ? 'products' : item.parentType === 'collection' ? 'collections' : 'blogs';
                                    await updateDoc(doc(db, pType, item.parentId), {
                                      seoOptimized: isOptimized,
                                      updatedAt: new Date().toISOString()
                                    });
                                  } else {
                                    await updateDoc(doc(db, aiTab, item.id), {
                                      seoOptimized: isOptimized,
                                      updatedAt: new Date().toISOString()
                                    });
                                  }
                                  toast.success(isOptimized ? "已标记为已优化" : "已取消标记已优化");
                                } catch (err) {
                                  handleFirestoreError(err, OperationType.WRITE, `${aiTab}/${item.id}`);
                                }
                              }}
                              className={`w-full py-1.5 px-2 rounded-lg text-[11px] font-bold border transition-all flex items-center justify-center gap-1 group/opt ${
                                item.seoOptimized
                                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200'
                                  : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50 hover:text-slate-800'
                              }`}
                            >
                              {item.seoOptimized ? (
                                <>
                                  <span className="flex items-center gap-1.5 group-hover/opt:hidden">
                                    <ICONS.CheckCircle className="w-3.5 h-3.5 text-emerald-500" />
                                    已标记优化
                                  </span>
                                  <span className="hidden group-hover/opt:flex items-center gap-1.5 text-rose-600">
                                    <ICONS.XCircle className="w-3.5 h-3.5 text-rose-500" />
                                    撤销已优化
                                  </span>
                                </>
                              ) : (
                                <>
                                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                    <circle cx="12" cy="12" r="10" />
                                  </svg>
                                  手动标记优化
                                </>
                              )}
                            </button>
                          </div>

                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
      <div className="space-y-6 w-full mx-auto">
        {/* Prompt Management Modal */}
        <AnimatePresence>
          {isPromptModalOpen && (
            <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="bg-white w-full max-w-5xl rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
              >
                <div className="p-8 border-b border-slate-100 flex items-center justify-between shrink-0">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
                      <ICONS.Settings className="w-6 h-6" />
                    </div>
                    <div>
                      <h3 className="text-xl font-black text-slate-900">基础设置</h3>
                      <p className="text-slate-500 text-xs">配置 AI 模型、模式及自定义提示词</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 p-1 bg-slate-100 rounded-xl">
                    <button 
                      onClick={() => setActivePromptCategory('general')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activePromptCategory === 'general' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      模型与模式
                    </button>
                    <button 
                      onClick={() => setActivePromptCategory('seo')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activePromptCategory === 'seo' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      通用 SEO
                    </button>
                    <button 
                      onClick={() => setActivePromptCategory('content')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activePromptCategory === 'content' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      内容优化
                    </button>
                    <button 
                      onClick={() => setActivePromptCategory('blog')}
                      className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activePromptCategory === 'blog' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      博客管理
                    </button>
                  </div>
                  <button 
                    onClick={() => setIsPromptModalOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-all"
                  >
                    <ICONS.X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                  {activePromptCategory === 'general' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                            <ICONS.Zap className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900">模型选择</h4>
                            <p className="text-[11px] text-slate-400">选择用于生成内容的 AI 模型</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          {[
                            { id: 'gemini-3-flash-preview', name: 'Gemini 3 Flash', desc: '速度极快，适合日常优化', icon: '⚡' },
                            { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro', desc: '最强推理，适合复杂内容', icon: '🧠' }
                          ].map(model => (
                            <button
                              key={model.id}
                              onClick={() => setSelectedModel(model.id)}
                              className={`p-4 rounded-2xl border-2 text-left transition-all ${selectedModel === model.id ? 'border-blue-600 bg-blue-50/50' : 'border-slate-100 hover:border-slate-200'}`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-sm text-slate-900">{model.icon} {model.name}</span>
                                {selectedModel === model.id && <div className="w-2 h-2 bg-blue-600 rounded-full" />}
                              </div>
                              <p className="text-[11px] text-slate-500">{model.desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="flex items-center gap-2">
                          <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                            <ICONS.Analysis className="w-4 h-4" />
                          </div>
                          <div>
                            <h4 className="font-bold text-slate-900">优化模式</h4>
                            <p className="text-[11px] text-slate-400">控制 AI 生成内容的风格与倾向</p>
                          </div>
                        </div>
                        <div className="grid grid-cols-1 gap-3">
                          {[
                            { id: 'balanced', name: '平衡模式', desc: '兼顾 SEO 排名与用户阅读体验', icon: '🎯' },
                            { id: 'seo_first', name: 'SEO 优先', desc: '侧重关键词堆叠与排名权重', icon: '📈' },
                            { id: 'creative', name: '创意模式', desc: '更具吸引力的文案，提高点击率', icon: '✨' }
                          ].map(mode => (
                            <button
                              key={mode.id}
                              onClick={() => setSelectedMode(mode.id)}
                              className={`p-4 rounded-2xl border-2 text-left transition-all ${selectedMode === mode.id ? 'border-amber-600 bg-amber-50/50' : 'border-slate-100 hover:border-slate-200'}`}
                            >
                              <div className="flex items-center justify-between mb-1">
                                <span className="font-bold text-sm text-slate-900">{mode.icon} {mode.name}</span>
                                {selectedMode === mode.id && <div className="w-2 h-2 bg-amber-600 rounded-full" />}
                              </div>
                              <p className="text-[11px] text-slate-500">{mode.desc}</p>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}

                  {activePromptCategory === 'seo' && (
                    <>
                      {/* Strategy Prompt */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                              <ICONS.Analysis className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900">SEO 策略生成提示词</h4>
                              <p className="text-[11px] text-slate-400">用于“SEO 诊断”功能，生成整体 SEO 优化策略</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleResetPrompts('strategy')}
                            className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <ICONS.RefreshCw className="w-3 h-3" />
                            恢复默认
                          </button>
                        </div>
                        <textarea 
                          value={editingPrompts.strategy}
                          onChange={(e) => setEditingPrompts(prev => ({ ...prev, strategy: e.target.value }))}
                          className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none resize-none"
                          placeholder="输入 SEO 策略生成提示词..."
                        />
                      </div>

                      {/* SEO Audit Suggestion Prompt */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-cyan-50 text-cyan-600 rounded-xl flex items-center justify-center">
                              <ICONS.Search className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900">SEO 优化建议提示词</h4>
                              <p className="text-[11px] text-slate-400">用于“SEO 诊断”功能，为每个具体项目生成优化建议</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleResetPrompts('seoAudit')}
                            className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <ICONS.RefreshCw className="w-3 h-3" />
                            恢复默认
                          </button>
                        </div>
                        <textarea 
                          value={editingPrompts.seoAudit}
                          onChange={(e) => setEditingPrompts(prev => ({ ...prev, seoAudit: e.target.value }))}
                          className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none resize-none"
                          placeholder="输入 SEO 优化建议提示词..."
                        />
                      </div>

                      {/* Keywords Prompt */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                              <ICONS.Tag className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900">关键词生成提示词</h4>
                              <p className="text-[11px] text-slate-400">用于编辑弹窗中的“AI 生成关键词”功能</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleResetPrompts('keywords')}
                            className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <ICONS.RefreshCw className="w-3 h-3" />
                            恢复默认
                          </button>
                        </div>
                        <textarea 
                          value={editingPrompts.keywords}
                          onChange={(e) => setEditingPrompts(prev => ({ ...prev, keywords: e.target.value }))}
                          className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none resize-none"
                          placeholder="输入关键词生成提示词..."
                        />
                      </div>
                    </>
                  )}

                  {activePromptCategory === 'content' && (
                    <>
                      {/* SEO Prompt */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                              <ICONS.Zap className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900">SEO 优化提示词</h4>
                              <p className="text-[11px] text-slate-400">用于核心 AI 优化功能（生成标题、描述、URL 等）</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleResetPrompts('seo')}
                            className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <ICONS.RefreshCw className="w-3 h-3" />
                            恢复默认
                          </button>
                        </div>
                        <textarea 
                          value={editingPrompts.seo}
                          onChange={(e) => setEditingPrompts(prev => ({ ...prev, seo: e.target.value }))}
                          className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none resize-none"
                          placeholder="输入 SEO 优化提示词..."
                        />
                      </div>

                      {/* Field Title Prompt */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
                              <ICONS.Type className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900">SEO 标题优化提示词</h4>
                              <p className="text-[11px] text-slate-400">用于编辑弹窗中 SEO 标题字段旁的“AI 优化”按钮</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleResetPrompts('fieldTitle')}
                            className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <ICONS.RefreshCw className="w-3 h-3" />
                            恢复默认
                          </button>
                        </div>
                        <textarea 
                          value={editingPrompts.fieldTitle}
                          onChange={(e) => setEditingPrompts(prev => ({ ...prev, fieldTitle: e.target.value }))}
                          className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none resize-none"
                          placeholder="输入 SEO 标题优化提示词..."
                        />
                      </div>

                      {/* Field Description Prompt */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                              <ICONS.FileText className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900">SEO 描述优化提示词</h4>
                              <p className="text-[11px] text-slate-400">用于编辑弹窗中 SEO 描述字段旁的“AI 优化”按钮</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleResetPrompts('fieldDescription')}
                            className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <ICONS.RefreshCw className="w-3 h-3" />
                            恢复默认
                          </button>
                        </div>
                        <textarea 
                          value={editingPrompts.fieldDescription}
                          onChange={(e) => setEditingPrompts(prev => ({ ...prev, fieldDescription: e.target.value }))}
                          className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none resize-none"
                          placeholder="输入 SEO 描述优化提示词..."
                        />
                      </div>

                      {/* Image Alt Prompt */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                              <ICONS.Image className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900">图片 Alt 生成提示词</h4>
                              <p className="text-[11px] text-slate-400">用于编辑弹窗中图片部分的“AI 生成 Alt”功能</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleResetPrompts('imageAlt')}
                            className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <ICONS.RefreshCw className="w-3 h-3" />
                            恢复默认
                          </button>
                        </div>
                        <textarea 
                          value={editingPrompts.imageAlt}
                          onChange={(e) => setEditingPrompts(prev => ({ ...prev, imageAlt: e.target.value }))}
                          className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none resize-none"
                          placeholder="输入图片 Alt 生成提示词..."
                        />
                      </div>
                    </>
                  )}

                  {activePromptCategory === 'blog' && (
                    <>
                      {/* Blog Prompt */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                              <ICONS.FileText className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900">博客生成提示词</h4>
                              <p className="text-[11px] text-slate-400">用于“博客管理”功能，根据选题生成完整的博客文章内容</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleResetPrompts('blog')}
                            className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <ICONS.RefreshCw className="w-3 h-3" />
                            恢复默认
                          </button>
                        </div>
                        <textarea 
                          value={editingPrompts.blog}
                          onChange={(e) => setEditingPrompts(prev => ({ ...prev, blog: e.target.value }))}
                          className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none resize-none"
                          placeholder="输入博客生成提示词..."
                        />
                      </div>

                      {/* Blog Topics Prompt */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                              <ICONS.Lightbulb className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900">博客选题提示词</h4>
                              <p className="text-[11px] text-slate-400">用于“博客管理”功能，基于店铺数据自动生成博客选题</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleResetPrompts('blogTopics')}
                            className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <ICONS.RefreshCw className="w-3 h-3" />
                            恢复默认
                          </button>
                        </div>
                        <textarea 
                          value={editingPrompts.blogTopics}
                          onChange={(e) => setEditingPrompts(prev => ({ ...prev, blogTopics: e.target.value }))}
                          className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none resize-none"
                          placeholder="输入博客选题提示词..."
                        />
                      </div>

                      {/* Manual Blog Topics Prompt */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <div className="w-8 h-8 bg-pink-50 text-pink-600 rounded-xl flex items-center justify-center">
                              <ICONS.FileText className="w-4 h-4" />
                            </div>
                            <div>
                              <h4 className="font-bold text-slate-900">手动选题生成提示词</h4>
                              <p className="text-[11px] text-slate-400">用于“博客管理”功能，基于手动输入的关键词生成博客选题</p>
                            </div>
                          </div>
                          <button 
                            onClick={() => handleResetPrompts('blogTopicsManual')}
                            className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                          >
                            <ICONS.RefreshCw className="w-3 h-3" />
                            恢复默认
                          </button>
                        </div>
                        <textarea 
                          value={editingPrompts.blogTopicsManual}
                          onChange={(e) => setEditingPrompts(prev => ({ ...prev, blogTopicsManual: e.target.value }))}
                          className="w-full h-32 p-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm text-slate-600 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all outline-none resize-none"
                          placeholder="输入手动选题生成提示词..."
                        />
                      </div>
                    </>
                  )}
                </div>

                <div className="p-8 border-t border-slate-100 flex items-center justify-end gap-3 shrink-0">
                  <button 
                    onClick={() => setIsPromptModalOpen(false)}
                    className="px-6 py-2.5 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                  >
                    取消
                  </button>
                  <button 
                    onClick={handleSavePrompts}
                    className="px-8 py-2.5 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20 flex items-center gap-2"
                  >
                    <ICONS.Save className="w-4 h-4" />
                    保存更改
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-4">
              <h1 className="text-2xl font-bold text-slate-900">
                {activeTab === 'audit' ? 'SEO检测' : activeTab === 'ai' ? (aiMode === 'chat' ? 'SEO策略' : 'SEO管理') : activeTab === 'fix' ? 'SEO处理' : activeTab === 'blog' ? '博客管理' : '效果分析'}
              </h1>
            </div>
            <p className="text-sm text-slate-500">
              {activeTab === 'audit' ? '全方位的 SEO 诊断与优化建议。' : activeTab === 'ai' ? (aiMode === 'chat' ? 'AI 驱动的 SEO 全局优化。' : '批量管理与优化您的站点内容。') : activeTab === 'fix' ? '针对检测出的问题进行针对性优化。' : activeTab === 'blog' ? 'AI 驱动的自动化博客营销与内容生成。' : '实时监控您的搜索排名与流量表现。'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {activeTab === 'blog' && blogEditActions && (
              <div className="flex items-center gap-2.5">
                <button 
                  onClick={blogEditActions.cancel}
                  className="px-4 py-2 bg-white border border-slate-200 rounded-xl text-xs font-bold text-slate-600 hover:bg-slate-50 transition-colors cursor-pointer"
                >
                  取消
                </button>
                <button 
                  onClick={blogEditActions.publish}
                  className="px-5 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-colors shadow-xs flex items-center gap-1.5 cursor-pointer"
                >
                  <ICONS.Check className="w-4 h-4" />
                  <span>保存</span>
                </button>
              </div>
            )}
            {(activeTab === 'ai' || activeTab === 'fix') && aiMode === 'chat' && (
              <button 
                onClick={() => {
                  setEditingPrompts(customPrompts);
                  setIsPromptModalOpen(true);
                }}
                className="px-5 py-2.5 bg-white text-blue-600 rounded-2xl font-bold border border-blue-100 flex items-center gap-2 hover:bg-blue-50 transition-all shadow-sm whitespace-nowrap"
              >
                <ICONS.Settings className="w-4 h-4" />
                <span>基础设置</span>
              </button>
            )}
            {activeTab === 'ai' && aiMode === 'list' && (
              <>
                <button 
                  onClick={() => setIsImportModalOpen(true)}
                  className="px-5 py-2.5 bg-white text-blue-600 rounded-2xl font-bold border border-blue-100 flex items-center gap-2 hover:bg-blue-50 transition-all shadow-sm whitespace-nowrap cursor-pointer"
                >
                  <ICONS.Upload className="w-4 h-4" />
                  导入关键词
                </button>


              </>
            )}
          </div>
        </div>

          {/* Removed SEO策略 and SEO管理 toggle buttons as requested */}

          <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'audit' ? renderAuditTab() : activeTab === 'ai' ? renderAiTab() : activeTab === 'fix' ? renderFixTab() : activeTab === 'blog' ? renderBlogTab() : renderTrackingTab()}
        </motion.div>
      </AnimatePresence>

      {/* History Modal */}
      <AnimatePresence>
        {showHistory && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                  <ICONS.History className="text-blue-500" />
                  {historyItemId ? '优化历史' : '执行历史'}
                </h3>
                <button 
                  onClick={() => {
                    setShowHistory(false);
                    setHistoryItemId(null);
                  }} 
                  className="p-2 hover:bg-slate-100 rounded-full transition-all"
                >
                  <ICONS.XCircle className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                {historyItemId ? (
                  (() => {
                    const item = [...products, ...collections, ...blogs, ...pages].find(i => i.id === historyItemId) as any;
                    const history = item?.history || [];
                    
                    // If no history, show current state as initial
                    const displayHistory = history.length > 0 ? history : [{
                      seoTitle: item?.seoTitle || '',
                      seoDescription: item?.seoDescription || '',
                      seoUrl: item?.seoUrl || '',
                      keywords: [...(item?.keywords || [])],
                      altText: item?.altText || item?.imageAlt || '',
                      updatedAt: item?.updatedAt || new Date().toISOString(),
                      isInitial: true
                    }];

                    return displayHistory.map((entry: any, index: number) => {
                      const isInitial = entry.isInitial || index === displayHistory.length - 1;
                      return (
                        <div key={index} className={`p-4 rounded-2xl border space-y-3 ${isInitial ? 'bg-blue-50/50 border-blue-100' : 'bg-slate-50 border-slate-100'}`}>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-400 uppercase">
                                {new Date(entry.updatedAt).toLocaleString()}
                              </span>
                              {isInitial && (
                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 text-[11px] font-bold rounded uppercase">
                                  初始状态
                                </span>
                              )}
                            </div>
                            <button 
                              onClick={() => handleRestoreItemHistory(entry)}
                              className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                            >
                              <ICONS.RefreshCw className="w-3 h-3" />
                              恢复此状态
                            </button>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            {(entry.seoTitle !== undefined) && (
                              <div>
                                <div className="text-[11px] font-bold text-slate-400 uppercase mb-1">SEO 标题</div>
                                <div className="text-xs text-slate-600 line-clamp-2">{entry.seoTitle || '(未设置)'}</div>
                              </div>
                            )}
                            {(entry.seoDescription !== undefined) && (
                              <div>
                                <div className="text-[11px] font-bold text-slate-400 uppercase mb-1">SEO 描述</div>
                                <div className="text-xs text-slate-600 line-clamp-2">{entry.seoDescription || '(未设置)'}</div>
                              </div>
                            )}
                            {entry.keywords && entry.keywords.length > 0 && (
                              <div className="col-span-2">
                                <div className="text-[11px] font-bold text-slate-400 uppercase mb-1">关键词</div>
                                <div className="flex flex-wrap gap-1">
                                  {entry.keywords.map((kw: string, i: number) => (
                                    <span key={i} className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[11px] text-slate-500">
                                      {kw}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {(entry.seoUrl !== undefined) && (
                              <div className="col-span-2">
                                <div className="text-[11px] font-bold text-slate-400 uppercase mb-1">URL 别名</div>
                                <div className="text-xs text-slate-600">{entry.seoUrl || '(未设置)'}</div>
                              </div>
                            )}
                            {(entry.altText !== undefined) && (
                              <div className="col-span-2">
                                <div className="text-[11px] font-bold text-slate-400 uppercase mb-1">ALT 文本</div>
                                <div className="text-xs text-slate-600">{entry.altText || '(未设置)'}</div>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    });
                  })()
                ) : (
                  executionHistory.map((item) => (
                    <div key={item.id} className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-400 uppercase">{item.timestamp}</span>
                        <button 
                          onClick={() => handleRestore(item)}
                          className="text-xs font-bold text-blue-600 hover:underline flex items-center gap-1"
                        >
                          <ICONS.RefreshCw className="w-3 h-3" />
                          恢复此状态
                        </button>
                      </div>
                      <div>
                        <div className="text-xs font-bold text-slate-900 mb-1">关键词：</div>
                        <div className="flex flex-wrap gap-1">
                          {item.keywords.map((kw, i) => (
                            <span key={i} className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[11px] text-slate-600">
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit SEO Modal */}
      <AnimatePresence>
        {isEditModalOpen && editingItem && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-xl rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold text-slate-900">编辑 SEO 内容</h3>
                  <p className="text-xs text-slate-400 mt-1 truncate max-w-[400px]">{editingItem.title || editingItem.name}</p>
                </div>
                <div className="flex items-center gap-2">

                  <button 
                    onClick={() => {
                      setIsEditModalOpen(false);
                      setEditingItem(null);
                    }} 
                    className="p-2 hover:bg-slate-100 rounded-full transition-all"
                  >
                    <ICONS.XCircle className="w-6 h-6 text-slate-400" />
                  </button>
                </div>
              </div>
              
              <div className="p-6 space-y-6">
                {aiTab === 'images' ? (
                  <>
                    <div className="flex items-center gap-4 p-4 bg-slate-50 rounded-2xl border border-slate-100">
                      <div className="w-20 h-20 bg-white rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center">
                        <img 
                          src={editingItem.url} 
                          alt="Preview" 
                          className="max-w-full max-h-full object-contain"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className="text-xs font-bold text-slate-900 truncate">{editingItem.name}</p>
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-mono ${(editingItem.size || 0) > 500 * 1024 ? 'text-amber-600 font-bold' : 'text-slate-500'}`}>
                            当前大小: {editingItem.size ? (editingItem.size > 1024 * 1024 ? `${(editingItem.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(editingItem.size / 1024)} KB`) : '未知'}
                          </span>
                          {lastCompressedId === editingItem.id && (
                            <span className="text-[11px] text-emerald-500 font-bold flex items-center gap-1 animate-bounce">
                              <ICONS.CheckCircle className="w-2.5 h-2.5" />
                              压缩成功
                            </span>
                          )}
                          {(editingItem.size || 0) > 500 * 1024 && lastCompressedId !== editingItem.id && (
                            <span className="text-[11px] text-amber-500 font-bold flex items-center gap-1">
                              <ICONS.AlertTriangle className="w-2.5 h-2.5" />
                              建议压缩
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-slate-400">所属: {editingItem.parentTitle}</p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <div className="flex justify-between items-end mb-2">
                        <label className="block text-xs font-bold text-slate-600 uppercase">图片名称 (文件名)</label>
                        {isImageNameMeaningless(editingItem.name) && (
                          <span className="text-[11px] text-amber-500 font-bold flex items-center gap-1">
                            <ICONS.AlertTriangle className="w-3 h-3" />
                            名称不规范
                          </span>
                        )}
                      </div>
                      <input 
                        type="text"
                        value={editingItem.name || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 transition-all"
                        placeholder="输入图片具有意义的新名称..."
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <label className="block text-xs font-bold text-slate-600 uppercase">图片 Alt 文本</label>
                        <button 
                          onClick={async () => {
                            setIsGenerating(`${editingItem.id}-altText`);
                            try {
                              const result = await geminiService.generateAltText(
                                editingItem.parentTitle || '', 
                                `Image name: ${editingItem.name}`, 
                                keywordLanguage, 
                                brandName,
                                aiAnalysis?.strategy,
                                selectedKeywords,
                                excludedKeywords,
                                customPrompts.imageAlt
                              );
                              setEditingItem({ ...editingItem, altText: result });
                            } catch (error) {
                              if (isAbortError(error)) return;
                              console.error('AI Alt Text generation failed:', error);
                            } finally {
                              setIsGenerating(null);
                            }
                          }}
                          disabled={isGenerating === `${editingItem.id}-altText`}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
                        >
                          {isGenerating === `${editingItem.id}-altText` ? (
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                              <ICONS.RefreshCw className="w-2.5 h-2.5" />
                            </motion.div>
                          ) : <ICONS.Zap className="w-2.5 h-2.5" />}
                          AI 生成 Alt
                        </button>
                      </div>
                      <textarea 
                        value={editingItem.altText || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, altText: e.target.value })}
                        className="w-full h-24 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 transition-all resize-none"
                        placeholder="输入图片 Alt 文本，描述图片内容以提升 SEO..."
                      />
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button 
                        onClick={() => {
                          handleUpdateAltText(editingItem, editingItem.altText, editingItem.name);
                          setIsEditModalOpen(false);
                          setEditingItem(null);
                        }}
                        className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                      >
                        保存修改
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <label className="block text-xs font-bold text-slate-600 uppercase">关键词与主关键词</label>
                        <button 
                          onClick={() => handleGenerateKeywords(aiTab.slice(0, -1) as any, editingItem)}
                          disabled={isGeneratingKeywords === editingItem.id}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
                        >
                          {isGeneratingKeywords === editingItem.id ? (
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                              <ICONS.RefreshCw className="w-2.5 h-2.5" />
                            </motion.div>
                          ) : <ICONS.Zap className="w-2.5 h-2.5" />}
                          AI 生成关键词
                        </button>
                      </div>
                      <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border border-slate-200 rounded-xl min-h-[46px]">
                        {(editingItem.keywords || []).map((kw: string, idx: number) => {
                          const isPrimary = editingItem.primaryKeyword === kw || (!editingItem.primaryKeyword && idx === 0);
                          return (
                            <div key={idx} className="relative group">
                              <button
                                onClick={() => setEditingItem({ ...editingItem, primaryKeyword: isPrimary ? null : kw })}
                                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium transition-all ${
                                  isPrimary 
                                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-200' 
                                    : 'bg-white text-slate-600 border border-slate-200 hover:border-blue-300'
                                }`}
                              >
                                {isPrimary && <ICONS.Star className="w-3 h-3 fill-current" />}
                                {kw}
                              </button>
                              <button 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newKws = editingItem.keywords.filter((_: any, i: number) => i !== idx);
                                  setEditingItem({ 
                                    ...editingItem, 
                                    keywords: newKws,
                                    primaryKeyword: isPrimary ? null : editingItem.primaryKeyword
                                  });
                                }}
                                className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                              >
                                <ICONS.X className="w-2 h-2" />
                              </button>
                            </div>
                          );
                        })}
                        <input 
                          type="text"
                          placeholder="+ 添加"
                          className="bg-transparent text-xs outline-none w-20 border-b border-transparent focus:border-blue-500"
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              const val = (e.target as HTMLInputElement).value.trim();
                              if (val) {
                                const newKws = val.split(/[、,，]+/).filter(k => k.trim());
                                setEditingItem({ ...editingItem, keywords: [...(editingItem.keywords || []), ...newKws] });
                                (e.target as HTMLInputElement).value = '';
                              }
                            }
                          }}
                        />
                      </div>
                      <p className="text-[11px] text-slate-400 mt-1.5 flex items-center gap-1">
                        <ICONS.Info className="w-3 h-3" />
                        点击关键词可将其设为“主关键词”，AI 优化时将重点包含该词。
                      </p>
                    </div>

                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <div className="flex items-center gap-2">
                          <label className="block text-xs font-bold text-slate-600 uppercase">SEO 标题</label>
                          <button 
                            onClick={() => handleAiOptimizeItemField('seoTitle')}
                            disabled={isGenerating === `${editingItem.id}-seoTitle`}
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
                          >
                            {isGenerating === `${editingItem.id}-seoTitle` ? (
                              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                                <ICONS.RefreshCw className="w-2.5 h-2.5" />
                              </motion.div>
                            ) : <ICONS.Zap className="w-2.5 h-2.5" />}
                            AI 优化
                          </button>
                        </div>
                        <span className={`text-[11px] font-bold ${(editingItem.seoTitle?.length || 0) > 70 ? 'text-red-500' : 'text-slate-400'}`}>
                          {editingItem.seoTitle?.length || 0} / 70
                        </span>
                      </div>
                      <input 
                        type="text"
                        value={editingItem.seoTitle || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, seoTitle: e.target.value })}
                        className="w-full p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 transition-all"
                        placeholder="输入 SEO 标题..."
                      />
                    </div>

                    <div>
                      <div className="flex justify-between items-end mb-2">
                        <div className="flex items-center gap-2">
                          <label className="block text-xs font-bold text-slate-600 uppercase">SEO 描述</label>
                          <button 
                            onClick={() => handleAiOptimizeItemField('seoDescription')}
                            disabled={isGenerating === `${editingItem.id}-seoDescription`}
                            className="text-[11px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
                          >
                            {isGenerating === `${editingItem.id}-seoDescription` ? (
                              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                                <ICONS.RefreshCw className="w-2.5 h-2.5" />
                              </motion.div>
                            ) : <ICONS.Zap className="w-2.5 h-2.5" />}
                            AI 优化
                          </button>
                        </div>
                        <span className={`text-[11px] font-bold ${(editingItem.seoDescription?.length || 0) > 160 ? 'text-red-500' : 'text-slate-400'}`}>
                          {editingItem.seoDescription?.length || 0} / 160
                        </span>
                      </div>
                      <textarea 
                        value={editingItem.seoDescription || ''}
                        onChange={(e) => setEditingItem({ ...editingItem, seoDescription: e.target.value })}
                        className="w-full h-32 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 transition-all resize-none"
                        placeholder="输入 SEO 描述..."
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase mb-2">Handle (URL Slug)</label>
                      <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 focus-within:border-blue-500 transition-all">
                        <span className="text-slate-400 text-xs">/</span>
                        <input 
                          type="text"
                          value={editingItem.seoUrl || editingItem.handle || ''}
                          onChange={(e) => setEditingItem({ ...editingItem, seoUrl: e.target.value })}
                          className="flex-1 p-3 bg-transparent text-sm outline-none"
                          placeholder="url-slug"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-slate-600 uppercase mb-2 flex items-center justify-between">
                        <span>重定向目标链接 (用于修复 404)</span>
                        <span className="text-[11px] text-slate-450 font-normal lowercase">(可选)</span>
                      </label>
                      <div className="flex items-center bg-slate-50 border border-slate-200 rounded-xl px-3 focus-within:border-blue-500 transition-all">
                        <span className="text-slate-400 text-xs">🔗</span>
                        <input 
                          type="text"
                          value={editingItem.redirectUrl || ''}
                          onChange={(e) => setEditingItem({ ...editingItem, redirectUrl: e.target.value })}
                          className="flex-1 p-3 bg-transparent text-sm outline-none font-semibold text-slate-700"
                          placeholder="例如: /products/new-item 或 https://..."
                        />
                      </div>
                    </div>

                    <div className="flex gap-3 pt-4">
                      <button 
                        onClick={handleAiOptimizeItem}
                        disabled={isGenerating === editingItem.id}
                        className="flex-1 py-3 bg-blue-50 text-blue-600 rounded-xl font-bold hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
                      >
                        {isGenerating === editingItem.id ? (
                          <>
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                              <ICONS.RefreshCw className="w-4 h-4" />
                            </motion.div>
                            优化中...
                          </>
                        ) : (
                          <>
                            <ICONS.Zap className="w-4 h-4" />
                            AI 优化
                          </>
                        )}
                      </button>
                      <button 
                        onClick={() => handleUpdateItemSEO({
                          seoTitle: editingItem.seoTitle,
                          seoDescription: editingItem.seoDescription,
                          seoUrl: editingItem.seoUrl,
                          primaryKeyword: editingItem.primaryKeyword,
                          redirectUrl: editingItem.redirectUrl
                        })}
                        className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
                      >
                        保存修改
                      </button>
                    </div>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Batch Keyword Modal */}
      <AnimatePresence>
        {isBatchKeywordModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">批量增加关键词</h3>
                <button 
                  onClick={() => setIsBatchKeywordModalOpen(false)} 
                  className="p-2 hover:bg-slate-100 rounded-full transition-all"
                >
                  <ICONS.XCircle className="w-6 h-6 text-slate-400" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <p className="text-sm text-slate-500">
                  为选定的 {selectedItems.length} 个项目增加关键词。多个关键词请用逗号或空格分隔。
                </p>
                <textarea 
                  value={batchKeywordsInput}
                  onChange={(e) => setBatchKeywordsInput(e.target.value)}
                  placeholder="例如: 时尚, 复古, 连衣裙"
                  className="w-full h-32 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 transition-all resize-none"
                />
                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => setIsBatchKeywordModalOpen(false)}
                    className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                  >
                    取消
                  </button>
                  <button 
                    onClick={handleBatchAddKeywords}
                    disabled={!batchKeywordsInput.trim() || batchIsGenerating}
                    className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 disabled:opacity-50"
                  >
                    {batchIsGenerating ? '处理中...' : '确认增加'}
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Keyword Import Modal */}
      <AnimatePresence>
        {isImportModalOpen && (
          <div className="fixed inset-0 z-[130] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-8 space-y-6"
            >
              <div className="flex justify-between items-center">
                <h3 className="text-xl font-bold text-slate-900">导入关键词</h3>
                <button onClick={() => setIsImportModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <ICONS.X className="w-5 h-5 text-slate-400" />
                </button>
              </div>

              <div 
                onClick={() => keywordImportRef.current?.click()}
                className="border-2 border-dashed border-slate-200 rounded-2xl p-10 flex flex-col items-center justify-center gap-4 hover:border-blue-500 hover:bg-blue-50/50 transition-all cursor-pointer group"
              >
                <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                  <ICONS.Upload className="w-8 h-8" />
                </div>
                <div className="text-center">
                  <p className="font-bold text-slate-900">点击上传文件</p>
                  <p className="text-xs text-slate-400 mt-1">支持 .txt, .csv 格式 (每行一个关键词)</p>
                </div>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-slate-100">
                <button 
                  onClick={downloadKeywordTemplate}
                  className="text-sm font-bold text-blue-600 hover:underline flex items-center gap-2"
                >
                  <ICONS.Download className="w-4 h-4" />
                  下载导入模版
                </button>
                <button 
                  onClick={() => setIsImportModalOpen(false)}
                  className="px-6 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all"
                >
                  取消
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Onboarding Modal */}
      <AnimatePresence>
        {showOnboarding && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-lg rounded-[32px] shadow-2xl overflow-hidden relative"
            >
              <button 
                onClick={handleCloseOnboarding}
                className="absolute top-6 right-6 p-2 hover:bg-slate-100 rounded-full transition-all z-10"
              >
                <ICONS.X className="w-5 h-5 text-slate-400" />
              </button>

              <div className="p-10 text-center space-y-8">
                <motion.div 
                  key={onboardingStep}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex flex-col items-center gap-6"
                >
                  <div className="w-24 h-24 bg-blue-50 rounded-3xl flex items-center justify-center shadow-inner">
                    {onboardingSteps[onboardingStep].icon}
                  </div>
                  <div className="space-y-3">
                    <h3 className="text-2xl font-black text-slate-900 leading-tight">
                      {onboardingSteps[onboardingStep].title}
                    </h3>
                    <p className="text-slate-500 leading-relaxed">
                      {onboardingSteps[onboardingStep].description}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3 w-full">
                    {onboardingSteps[onboardingStep].features.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 px-3 py-2 bg-slate-50 rounded-xl border border-slate-100 text-xs font-bold text-slate-600">
                        <ICONS.Check className="w-3 h-3 text-blue-600" />
                        {f}
                      </div>
                    ))}
                  </div>
                </motion.div>

                <div className="flex flex-col gap-4">
                  <div className="flex justify-center gap-2">
                    {onboardingSteps.map((_, i) => (
                      <div 
                        key={i} 
                        className={`h-1.5 rounded-full transition-all ${onboardingStep === i ? 'w-8 bg-blue-600' : 'w-2 bg-slate-200'}`}
                      />
                    ))}
                  </div>
                  <div className="flex gap-3">
                    {onboardingStep > 0 && (
                      <button 
                        onClick={() => setOnboardingStep(prev => prev - 1)}
                        className="flex-1 py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all"
                      >
                        上一步
                      </button>
                    )}
                    <button 
                      onClick={() => {
                        if (onboardingStep < onboardingSteps.length - 1) {
                          setOnboardingStep(prev => prev + 1);
                        } else {
                          handleCloseOnboarding();
                        }
                      }}
                      className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
                    >
                      {onboardingStep === onboardingSteps.length - 1 ? '开始使用' : '下一步'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      {/* Strategy Warning Modal */}
      <AnimatePresence>
        {showStrategyWarningModal && (
          <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="bg-white w-full max-w-sm rounded-[32px] shadow-2xl overflow-hidden p-10 text-center space-y-8"
            >
              <div className="w-24 h-24 bg-amber-50 text-amber-500 rounded-[32px] flex items-center justify-center mx-auto shadow-inner">
                <ICONS.AlertTriangle className="w-12 h-12" />
              </div>
              <div className="space-y-3">
                <h3 className="text-2xl font-black text-slate-900">请先生成 SEO 策略</h3>
                <p className="text-slate-500 leading-relaxed font-medium">
                  为了获得更精准的 AI 优化内容，建议您先输入品牌信息生成全局优化方案。
                </p>
              </div>
              <div className="flex flex-col gap-3 pt-2">
                <button 
                  onClick={() => {
                    setShowStrategyWarningModal(false);
                    setAiMode('chat');
                    setActiveTab('ai');
                  }}
                  className="w-full py-5 bg-amber-600 text-white rounded-2xl font-bold hover:bg-amber-700 transition-all shadow-xl shadow-amber-500/20 active:scale-95"
                >
                  前往生成策略
                </button>
                <button 
                  onClick={() => setShowStrategyWarningModal(false)}
                  className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-bold hover:bg-slate-200 transition-all text-sm active:scale-95"
                >
                  稍后再说
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SEODashboard;
