
import React, { useState, useEffect, useMemo } from 'react';
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

const SEODashboard: React.FC<SEODashboardProps> = ({ products, collections, blogs, blogSets, pages, initialTab = 'audit', initialMode = 'chat', onTabChange }) => {
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
          name: c.title, 
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
          name: b.title, 
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
      return items.filter(i => !i.altText || i.altText.length < 5).length;
    }
    return items.filter(i => !i.seoTitle || !i.seoDescription || i.seoTitle.length < 10 || i.seoDescription.length < 30).length;
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
  const [editingPrompts, setEditingPrompts] = useState(DEFAULT_PROMPTS);

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
  const [aiTab, setAiTab] = useState<'products' | 'collections' | 'blogs' | 'blogSets' | 'pages' | 'images'>('products');
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
  const [filterStatus, setFilterStatus] = useState<'all' | 'empty' | 'filled' | 'needs_optimization' | 'optimized'>('all');
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [selectedCollectionId, setSelectedCollectionId] = useState<string>('all');
  const [selectedPageId, setSelectedPageId] = useState<string>('all');
  const [selectedProductId, setSelectedProductId] = useState<string>('all');
  const [filterIds, setFilterIds] = useState<string[] | null>(null);
  const [selectedIssue, setSelectedIssue] = useState<AuditIssue | null>(null);
  const [lastCompressedId, setLastCompressedId] = useState<string | null>(null);
  const [expandedIssueIds, setExpandedIssueIds] = useState<string[]>([]);

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
  const [targetMarket, setTargetMarket] = useState('美国');
  const [targetLanguage, setTargetLanguage] = useState('英语');
  const [isCompressing, setIsCompressing] = useState<string | null>(null);
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
        setTargetMarket(data.targetMarket || '美国');
        setTargetLanguage(data.targetLanguage || '英语');
        setKeywordCount(data.keywordCount || 5);
        setKeywordLanguage(data.targetLanguage || '英语');
      }
    });
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
            uploadedFileName: uploadedFile?.name || savedFileName || null,
            updatedAt: new Date().toISOString()
          }, { merge: true });
        } catch (e) {
          console.error('Failed to save brand settings:', e);
        }
      }
    }, 2000);

    return () => clearTimeout(timer);
  }, [brandName, storeInfo, excludedKeywords, uploadedFile]);

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
    const allItems = [...products, ...collections, ...blogs, ...blogSets, ...pages];
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
        recommendation: '在 H1 标签中自然地融入核心关键词。',
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
    const images = [];
    products.forEach(p => p.media.forEach(m => { if (m.type === 'image') images.push({ ...m, size: m.size || (Math.floor(Math.random() * 400) + 100) * 1024 }); }));
    collections.forEach(c => { if (c.image) images.push({ url: c.image, size: (Math.floor(Math.random() * 400) + 100) * 1024, altText: (c as any).imageAlt || '' }); });
    blogs.forEach(b => { if (b.image) images.push({ url: b.image, size: (Math.floor(Math.random() * 400) + 100) * 1024, altText: (b as any).imageAlt || '' }); });

    const missingAlt = images.filter(img => !img.altText);
    const largeImages = images.filter(img => img.size && img.size > 500 * 1024);

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
        recommendation: '压缩这些图片或使用 WebP 格式，建议单张图片保持在 200KB 以内。',
        affectedItems: largeImages,
        targetTab: 'images'
      });
    }

    // --- 5. Internal Links ---
    // 404 pages (simulated as items with invalid/missing URLs)
    const brokenLinks = allItems.filter(item => !item.seoUrl && !(item as any).handle);
    
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
    const imagePenalty = images.length > 0 ? (missingAlt.length / images.length) * 10 + (largeImages.length / images.length) * 10 : 0;
    score -= Math.min(20, imagePenalty);

    // 5. Internal Links (20%)
    const linksPenalty = (brokenLinks.length / allItems.length) * 15 + (orphanPages.length / allItems.length) * 5;
    score -= Math.min(20, linksPenalty);

    // Calculate coverage stats by counting items without issues in each category
    const itemsWithMetaIssues = new Set([...missingTitles.map(i => i.id), ...missingDescriptions.map(i => i.id)]);
    const itemsWithStructureIssues = new Set([...missingH1.map(i => i.id), ...h1MissingKeywords.map(i => i.id), ...hierarchyIssues.map(i => i.id)]);
    const itemsWithUrlIssues = new Set(invalidHandles.map(i => i.id));
    const imagesWithIssues = new Set([...missingAlt.map(i => i.id), ...largeImages.map(i => i.id)]);
    const itemsWithLinkIssues = new Set([...brokenLinks.map(i => i.id), ...orphanPages.map(i => i.id)]);

    setAuditResults({
      score: Math.max(0, Math.round(score)),
      issues: issues.sort((a, b) => {
        const severityMap = { high: 3, medium: 2, low: 1 };
        return severityMap[b.severity] - severityMap[a.severity];
      }),
      stats: {
        'SEO 基础标签': Math.round(((allItems.length - itemsWithMetaIssues.size) / allItems.length) * 100),
        '页面结构': Math.round(((allItems.length - itemsWithStructureIssues.size) / allItems.length) * 100),
        'URL 规范化': Math.round(((allItems.length - itemsWithUrlIssues.size) / allItems.length) * 100),
        '图片 SEO': images.length > 0 ? Math.round(((images.length - imagesWithIssues.size) / images.length) * 100) : 100,
        '内链优化': Math.round(((allItems.length - itemsWithLinkIssues.size) / allItems.length) * 100),
      }
    });
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
    setIsGeneratingKeywords(item.id);
    try {
      const keywords = await geminiService.generateKeywords(type, item, keywordCount, keywordLanguage, brandName, aiAnalysis?.strategy, selectedKeywords, excludedKeywords, customPrompts.keywords);
      const collectionName = type === 'product' ? 'products' : type === 'collection' ? 'collections' : type === 'blog' ? 'blogs' : 'pages';
      
      const updatedItem = {
        ...item,
        keywords: keywords,
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, collectionName, item.id), cleanObject(updatedItem));
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

  const handleUpdateAltText = async (item: any, newAlt: string) => {
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
        updatedAt: source.updatedAt ?? new Date().toISOString()
      };
      
      const newHistory = [historyEntry, ...(source.history || [])].slice(0, 10);

      if (item.parentType === 'product') {
        const product = products.find(p => p.id === item.parentId);
        if (product) {
          const newMedia = product.media.map(m => {
            const mid = m.id || `img-${product.id}-${m.url.split('/').pop()}`;
            return mid === item.id ? { ...m, altText: newAlt, history: newHistory } : m;
          });
          await setDoc(doc(db, 'products', product.id), cleanObject({ ...product, media: newMedia, updatedAt: new Date().toISOString() }));
        }
      } else if (item.parentType === 'collection') {
        const collection = collections.find(c => c.id === item.parentId);
        if (collection) {
          await setDoc(doc(db, 'collections', collection.id), cleanObject({ ...collection, imageAlt: newAlt, history: newHistory, updatedAt: new Date().toISOString() }));
        }
      } else if (item.parentType === 'blog') {
        const blog = blogs.find(b => b.id === item.parentId);
        if (blog) {
          await setDoc(doc(db, 'blogs', blog.id), cleanObject({ ...blog, imageAlt: newAlt, history: newHistory, updatedAt: new Date().toISOString() }));
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
      
      // Reduce size by 40-60%
      const currentSize = item.size || (Math.floor(Math.random() * 800) + 200) * 1024;
      const newSize = Math.floor(currentSize * (0.4 + Math.random() * 0.2));

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
    if (selectedItems.length === 0) return;
    setBatchIsOptimizingField(field);
    try {
      const type = aiTab.slice(0, -1) as any;
      const collectionName = aiTab;
      const itemsToOptimize = (aiTab === 'products' ? products : aiTab === 'collections' ? collections : aiTab === 'blogs' ? blogs : pages)
        .filter(item => selectedItems.includes(item.id));

      for (const item of itemsToOptimize) {
        const primaryKeyword = item.primaryKeyword || (item.keywords?.[0] || '');
        const result = await geminiService.generateSEOContent(type, item, keywordCount, keywordLanguage, brandName, aiAnalysis?.strategy, selectedKeywords, excludedKeywords, primaryKeyword, customPrompts.seo);
        const updatedItem = {
          ...item,
          updatedAt: new Date().toISOString()
        };
        
        if (field === 'all') {
          updatedItem.seoTitle = result.seoTitle;
          updatedItem.seoDescription = result.seoDescription;
          updatedItem.seoUrl = result.seoUrl;
          updatedItem.keywords = result.keywords;
        } else {
          updatedItem[field] = result[field];
        }

        await setDoc(doc(db, collectionName, item.id), cleanObject(updatedItem));
      }
      setSelectedItems([]);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error(`Batch AI Optimization for ${field} failed:`, error);
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
      const itemsToUpdate = (aiTab === 'products' ? products : aiTab === 'collections' ? collections : aiTab === 'blogs' ? blogs : pages)
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
      const allImgs: any[] = [];
      products.forEach(p => p.media.forEach(m => { if (m.type === 'image') allImgs.push({ ...m, id: m.id || `img-${p.id}-${m.url.split('/').pop()}`, parentId: p.id, parentType: 'product' }); }));
      
      const itemsToCompress = allImgs.filter(img => selectedItems.includes(img.id) && img.parentType === 'product');
      
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

  const handleOptimizeItem = async (item: any, type: 'product' | 'collection' | 'blog' | 'page' | 'image') => {
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

  const handleUpdateItemSEO = async (updatedData: any) => {
    if (!editingItem) return;
    try {
      const collectionName = aiTab;
      
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
        targetMarket, 
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
        targetMarket,
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

  const handleRecommendCompetitors = async () => {
    setIsRecommendingCompetitors(true);
    try {
      const recommendations = await geminiService.recommendCompetitors(storeInfo, products, targetMarket);
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
              <button onClick={runAudit} className="mt-4 text-sm text-blue-600 font-bold hover:underline flex items-center gap-1">
                <ICONS.RefreshCw className="w-3 h-3" /> 重新扫描
              </button>
            </div>
            
            <div className="lg:col-span-2 grid grid-cols-2 gap-4">
              {Object.entries(auditResults!.stats).map(([label, value]) => (
                <div key={label} className="p-4 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="text-xs text-slate-400 font-bold uppercase mb-1">{label}</div>
                  <div className="text-xl font-black text-slate-900">{value}%</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {auditResults && (
        <div className="space-y-4">
          <h3 className="font-bold text-slate-900 flex items-center gap-2">
            <ICONS.AlertTriangle className="text-amber-500" />
            发现的问题 ({auditResults.issues.length})
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {auditResults.issues.map(issue => {
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
                    className="p-5 flex justify-between items-center cursor-pointer hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-4">
                      <div className={`p-2 rounded-lg ${
                        issue.severity === 'high' ? 'bg-red-50 text-red-600' : 
                        issue.severity === 'medium' ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
                      }`}>
                        <ICONS.AlertTriangle className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            issue.severity === 'high' ? 'bg-red-100 text-red-600' : 
                            issue.severity === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                          }`}>
                            {issue.severity === 'high' ? '高优先级' : issue.severity === 'medium' ? '中优先级' : '低优先级'}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 uppercase">{issue.category}</span>
                        </div>
                        <h4 className="font-bold text-slate-900">{issue.title}</h4>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-slate-400">
                        {issue.affectedItems?.length || 0} 个受影响项目
                      </span>
                      <motion.div
                        animate={{ rotate: isExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                      >
                        <ICONS.ChevronDown className="w-5 h-5 text-slate-400" />
                      </motion.div>
                    </div>
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="border-t border-slate-100"
                      >
                        <div className="p-5 space-y-4 bg-slate-50/50">
                          <div className="space-y-1">
                            <div className="text-[10px] font-bold text-slate-400 uppercase">问题描述</div>
                            <p className="text-sm text-slate-600 leading-relaxed">{issue.description}</p>
                          </div>
                          
                          <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                            <div className="text-[10px] font-bold text-blue-400 uppercase mb-1">建议操作</div>
                            <p className="text-sm text-blue-700 font-medium">{issue.recommendation}</p>
                          </div>

                          <div className="flex justify-end gap-3 pt-2">
                            <button 
                              onClick={() => setSelectedIssue(issue)}
                              className="px-4 py-2 text-xs font-bold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all shadow-sm"
                            >
                              查看详情
                            </button>
                            <button 
                              onClick={() => {
                                setActiveTab('fix');
                                setAiMode('list');
                                if (issue.targetTab) setAiTab(issue.targetTab);
                                setFilterIds(issue.affectedItems?.map(item => item.id) || null);
                                setFilterStatus('all');
                                onTabChange?.('SEO处理');
                              }}
                              className="px-4 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition-all shadow-md shadow-blue-500/20"
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
            })}
          </div>
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
                    <p className="text-xs text-slate-500">{selectedIssue.category}</p>
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
                  <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider">受影响的内容 ({selectedIssue.affectedItems?.length})</h4>
                  <div className="grid grid-cols-1 gap-2">
                    {selectedIssue.affectedItems?.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                        <div className="flex items-center gap-3">
                          {item.image || item.url ? (
                            <img src={item.image || item.url} className="w-10 h-10 rounded-lg object-cover border border-slate-200" alt="" />
                          ) : (
                            <div className="w-10 h-10 rounded-lg bg-slate-200 flex items-center justify-center">
                              <ICONS.FileText className="w-5 h-5 text-slate-400" />
                            </div>
                          )}
                          <div>
                            <div className="text-sm font-bold text-slate-900">{item.title || item.name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{item.seoUrl || item.handle || 'No URL'}</div>
                          </div>
                        </div>
                        <button 
                          onClick={() => {
                            setEditingItem(item);
                            setIsEditModalOpen(true);
                          }}
                          className="text-xs font-bold text-blue-600 hover:text-blue-700"
                        >
                          编辑
                        </button>
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
                    if (selectedIssue.targetTab) setAiTab(selectedIssue.targetTab);
                    setFilterIds(selectedIssue.affectedItems?.map(item => item.id) || null);
                    setFilterStatus('all');
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
        <div className="flex items-center justify-between bg-blue-50/50 p-4 rounded-2xl border border-blue-100 mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center text-white shadow-lg shadow-blue-500/20">
              <ICONS.Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900">问题修复模式</h3>
              <p className="text-xs text-slate-500">正在针对检测出的 {filterIds?.length || '全部'} 个问题进行专项优化</p>
            </div>
          </div>
          <button 
            onClick={() => {
              setActiveTab('audit');
              onTabChange?.('SEO检测');
            }}
            className="px-4 py-2 bg-white text-slate-600 rounded-xl text-xs font-bold border border-slate-200 hover:bg-slate-50 transition-all"
          >
            返回检测报告
          </button>
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
              <p className="text-[10px] text-slate-400">基于核心关键词每日平均排名计算</p>
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
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
                <YAxis reversed axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} />
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
            <span className="text-[10px] font-bold text-slate-400 uppercase">Top 5 关键词</span>
          </div>
          <div className="space-y-3">
            <div className="grid grid-cols-4 text-[10px] font-bold text-slate-400 uppercase px-2">
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
            <button className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1">
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
                    <div className="text-[10px] text-slate-400 font-bold uppercase">当前排名: #{change.current}</div>
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
                    <span className="px-2 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded">当前</span>
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
                  <span className="text-[10px] text-green-600 font-bold">↑ 73%</span>
                </div>
              </div>
              <div className="flex justify-between mb-2">
                <span className="text-xs text-slate-500">点击率 (CTR)</span>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-slate-900">4.5%</span>
                  <span className="text-[10px] text-green-600 font-bold">↑ 275%</span>
                </div>
              </div>
              <div className="flex justify-between">
                <span className="text-xs text-slate-500">月有机流量</span>
                <div className="flex items-center gap-1">
                  <span className="text-sm font-bold text-slate-900">12,450</span>
                  <span className="text-[10px] text-green-600 font-bold">↑ 289%</span>
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
              setFilterStatus('needs_optimization');
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
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
            <ICONS.FileText className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-slate-900">SEO 博客管理</h2>
            <p className="text-slate-500 text-sm">利用 AI 生成高质量、SEO 友好的博客文章，提升站点流量。</p>
          </div>
        </div>
        
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
        />
      </div>
    </div>
  );

  useEffect(() => {
    if (filterStatus === 'needs_optimization' || filterIds !== null) {
      const tabs = [
        { id: 'products', count: getNeedsOptimizationCount(products, 'product', filterIds) },
        { id: 'collections', count: getNeedsOptimizationCount(collections, 'collection', filterIds) },
        { id: 'blogs', count: getNeedsOptimizationCount(blogs, 'blog', filterIds) },
        { id: 'blogSets', count: getNeedsOptimizationCount(blogSets, 'blogSet', filterIds) },
        { id: 'pages', count: getNeedsOptimizationCount(pages, 'page', filterIds) },
        { id: 'images', count: getNeedsOptimizationCount(allImages, 'images', filterIds) },
      ];
      
      const currentTabVisible = (tabs.find(t => t.id === aiTab)?.count || 0) > 0;
      if (!currentTabVisible) {
        const firstVisibleTab = tabs.find(t => t.count > 0);
        if (firstVisibleTab) {
          setAiTab(firstVisibleTab.id as any);
        }
      }
    }
  }, [filterStatus, filterIds, products, collections, blogs, blogSets, pages, allImages, aiTab]);

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
                  pageUrl: p.seoUrl || `/products/${p.id}`
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
                pageUrl: c.seoUrl || `/collections/${c.id}`
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
                pageUrl: b.seoUrl || `/blogs/${b.id}`
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
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full text-[10px]">
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
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full text-[10px]">
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
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full text-[10px]">
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
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full text-[10px]">
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
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full text-[10px]">
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
                    <span className="px-1.5 py-0.5 bg-red-100 text-red-600 rounded-full text-[10px]">
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
                      className="max-w-[180px]"
                    />

                    <SearchableSelect
                      options={[{ id: 'all', title: '所有商品' }, ...products.map(p => ({ id: p.id, title: p.title }))]}
                      value={selectedProductId}
                      onChange={setSelectedProductId}
                      placeholder="所有商品"
                      className="max-w-[180px]"
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
              </div>
            </div>
          </div>
        )}

        {aiMode === 'chat' ? (
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
                          {uploadedFile && <p className="text-[10px] text-slate-500">{(uploadedFile.size / 1024).toFixed(1)} KB</p>}
                          {!uploadedFile && savedFileName && <p className="text-[10px] text-slate-400">已保存的文件</p>}
                        </div>
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            setUploadedFile(null);
                            setSavedFileName(null);
                            if (fileInputRef.current) fileInputRef.current.value = '';
                          }}
                          className="text-[10px] font-bold text-red-500 hover:text-red-600 underline"
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
                          <p className="text-[10px] text-slate-400">支持 PDF, Word, TXT 等格式</p>
                        </div>
                      </>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">目标市场</label>
                    <div className="relative">
                      <select 
                        value={targetMarket}
                        onChange={(e) => setTargetMarket(e.target.value)}
                        className="w-full p-2.5 pr-10 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:border-blue-500 transition-all appearance-none cursor-pointer"
                      >
                        <option value="美国">美国</option>
                        <option value="英国">英国</option>
                        <option value="德国">德国</option>
                        <option value="法国">法国</option>
                        <option value="日本">日本</option>
                        <option value="加拿大">加拿大</option>
                        <option value="澳大利亚">澳大利亚</option>
                      </select>
                      <div className="absolute right-5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
                        <ICONS.ChevronDown className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1.5">目标语言</label>
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
                  <span className="text-[10px] text-blue-700">提示：描述越详细，AI 生成的建议越精准。</span>
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
                                className="text-[10px] font-bold text-blue-600 hover:underline"
                              >
                                全选
                              </button>
                              <button 
                                onClick={() => setSelectedKeywords([])}
                                className="text-[10px] font-bold text-slate-400 hover:underline"
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
                              {selectedKeywords.includes(kw) && <span className="text-[10px]">✓</span>}
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
                          重新生成
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
        ) : (
          <div className="space-y-6">
            <div className="flex items-center justify-end">
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

                        <button 
                          onClick={handleBatchCompressImages}
                          disabled={batchIsOptimizingField !== null}
                          className="px-3 py-1 bg-white text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-50 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                          {batchIsOptimizingField === 'compress' ? (
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                              <ICONS.RefreshCw className="w-3 h-3" />
                            </motion.div>
                          ) : <ICONS.Minimize className="w-3 h-3" />}
                          批量压缩图片
                        </button>
                      </>
                    ) : (
                      <>
                        <button 
                          onClick={() => handleBatchOptimizeField('seoTitle')}
                          disabled={batchIsOptimizingField !== null}
                          className="px-3 py-1 bg-white text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-50 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                          {batchIsOptimizingField === 'seoTitle' ? (
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                              <ICONS.RefreshCw className="w-3 h-3" />
                            </motion.div>
                          ) : <ICONS.Zap className="w-3 h-3" />}
                          AI 优化 SEO 标题
                        </button>

                        <button 
                          onClick={() => handleBatchOptimizeField('seoDescription')}
                          disabled={batchIsOptimizingField !== null}
                          className="px-3 py-1 bg-white text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-50 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                          {batchIsOptimizingField === 'seoDescription' ? (
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                              <ICONS.RefreshCw className="w-3 h-3" />
                            </motion.div>
                          ) : <ICONS.Zap className="w-3 h-3" />}
                          AI 优化 SEO 描述
                        </button>

                        <button 
                          onClick={() => handleBatchOptimizeField('seoUrl')}
                          disabled={batchIsOptimizingField !== null}
                          className="px-3 py-1 bg-white text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-50 transition-all flex items-center gap-2 disabled:opacity-50"
                        >
                          {batchIsOptimizingField === 'seoUrl' ? (
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                              <ICONS.RefreshCw className="w-3 h-3" />
                            </motion.div>
                          ) : <ICONS.Zap className="w-3 h-3" />}
                          AI 优化 Handle
                        </button>

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
                          全部AI优化
                        </button>

                        <button 
                          onClick={() => setIsBatchKeywordModalOpen(true)}
                          className="px-3 py-1 bg-white/10 text-white rounded-lg text-xs font-bold hover:bg-white/20 transition-all flex items-center gap-2"
                        >
                          <ICONS.Plus className="w-3 h-3" />
                          批量增加关键词
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
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase whitespace-nowrap">
                      {isImageTab ? '图片预览' : (aiTab === 'products' ? '商品标题' : '标题')}
                    </th>
                    {isImageTab ? (
                      <>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase whitespace-nowrap">所在页面</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase whitespace-nowrap">大小</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase whitespace-nowrap">Alt 文本</th>
                      </>
                    ) : (
                      <>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase whitespace-nowrap min-w-[220px]">关键词</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase whitespace-nowrap w-[200px] min-w-[200px] max-w-[200px]">SEO 标题</th>
                        <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase whitespace-nowrap w-[200px] min-w-[200px] max-w-[200px]">SEO 描述</th>
                        <th className="px-3 py-4 text-xs font-bold text-slate-400 uppercase whitespace-nowrap w-[120px] min-w-[120px] max-w-[120px]">Handle</th>
                      </>
                    )}
                    <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-right whitespace-nowrap w-[140px]">操作</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((item: any) => (
                    <tr key={item.id} className={`hover:bg-slate-50/50 transition-colors ${selectedItems.includes(item.id) ? 'bg-blue-50/30' : ''}`}>
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
                      <td className="px-6 py-4 min-w-[220px]">
                        {isImageTab ? (
                          <div className="flex items-center gap-3">
                            <div 
                              className="w-12 h-12 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden flex-shrink-0 cursor-zoom-in group relative"
                              onClick={() => setPreviewImage({ url: item.url, name: item.name })}
                            >
                              <img src={item.url} alt={item.altText} className="w-full h-full object-cover group-hover:scale-110 transition-transform" referrerPolicy="no-referrer" />
                              <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <ICONS.Search className="w-4 h-4 text-white" />
                              </div>
                            </div>
                            <div className="flex flex-col gap-1">
                              <a 
                                href={item.pageUrl || item.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-xs font-medium text-slate-600 truncate max-w-[150px] hover:text-blue-600 hover:underline transition-all" 
                                title={item.name}
                              >
                                {item.name}
                              </a>
                              {item.altText && (item.size || 0) <= 500 * 1024 ? (
                                <span className="w-fit px-1.5 py-0.5 bg-green-50 text-green-600 rounded text-[10px] font-bold border border-green-100">已优化</span>
                              ) : (
                                <span className="w-fit px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded text-[10px] font-bold border border-amber-100">未优化</span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col gap-1">
                            <a 
                              href={item.seoUrl || (aiTab === 'products' ? `/products/${item.id}` : aiTab === 'collections' ? `/collections/${item.id}` : aiTab === 'blogs' ? `/blogs/${item.id}` : aiTab === 'blogSets' ? `/blog-sets/${item.id}` : `/pages/${item.id}`)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="font-bold text-slate-900 line-clamp-2 hover:text-blue-600 hover:underline transition-all" 
                              title={item.title || item.name}
                            >
                              {item.title || item.name}
                            </a>
                            {(item.seoTitle && item.seoTitle.length >= 30 && item.seoDescription && item.seoDescription.length >= 50 && item.keywords && item.keywords.length > 0) ? (
                              <span className="w-fit px-1.5 py-0.5 bg-green-50 text-green-600 rounded text-[10px] font-bold border border-green-100">已优化</span>
                            ) : (
                              <span className="w-fit px-1.5 py-0.5 bg-amber-50 text-amber-600 rounded text-[10px] font-bold border border-amber-100">未优化</span>
                            )}
                          </div>
                        )}
                      </td>
                      {isImageTab ? (
                        <>
                          <td className="px-6 py-4">
                            <div className="flex flex-col gap-1">
                              <span className="text-[10px] text-slate-400 uppercase font-bold">{item.parentType === 'product' ? '商品' : item.parentType === 'collection' ? '集合' : '博客'}</span>
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
                            <div className="text-xs text-slate-600 bg-slate-50/50 p-2 rounded-xl border border-slate-100 line-clamp-2 min-h-[36px] flex items-center" title={item.altText || '无 Alt 文本'}>
                              {item.altText || <span className="text-slate-300 italic">无 Alt 文本</span>}
                            </div>
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-6 py-4 min-w-[220px]">
                            <div className="flex flex-wrap gap-1 mb-2">
                              {(item.keywords || []).map((kw: string, idx: number) => {
                                const isPrimary = item.primaryKeyword === kw || (!item.primaryKeyword && idx === 0);
                                return (
                                  <span 
                                    key={idx} 
                                    title={kw} 
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium group transition-all cursor-pointer ${
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
                            <div className="flex gap-1">
                              <input 
                                type="text"
                                placeholder="添加关键词..."
                                className="text-[10px] p-1 border border-slate-200 rounded outline-none focus:border-blue-500 w-24"
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
                          </td>
                          <td className="px-6 py-4 w-[200px] min-w-[200px] max-w-[200px]">
                            <div className="flex items-start justify-between group/cell">
                              <div 
                                className="text-xs text-slate-600 line-clamp-2" 
                                title={item.seoTitle || ''}
                              >
                                {item.seoTitle || <span className="text-slate-300 italic">未设置</span>}
                              </div>
                              <button 
                                onClick={() => {
                                  setEditingItem(item);
                                  setIsEditModalOpen(true);
                                }}
                                className="opacity-0 group-hover/cell:opacity-100 p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all ml-2"
                              >
                                <ICONS.Edit className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          <td className="px-6 py-4 w-[200px] min-w-[200px] max-w-[200px]">
                            <div className="flex items-start justify-between group/cell">
                              <div 
                                className="text-xs text-slate-600 line-clamp-3" 
                                title={item.seoDescription || ''}
                              >
                                {item.seoDescription || <span className="text-slate-300 italic">未设置</span>}
                              </div>
                              <button 
                                onClick={() => {
                                  setEditingItem(item);
                                  setIsEditModalOpen(true);
                                }}
                                className="opacity-0 group-hover/cell:opacity-100 p-1 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded transition-all ml-2"
                              >
                                <ICONS.Edit className="w-3 h-3" />
                              </button>
                            </div>
                          </td>
                          <td className="px-3 py-4 w-[120px] min-w-[120px] max-w-[120px]">
                            <div className="text-xs text-slate-400 font-mono line-clamp-3 break-all" title={item.seoUrl || item.handle || '/'}>
                              {item.seoUrl || item.handle || '/'}
                            </div>
                          </td>
                        </>
                      )}
                      <td className="px-6 py-4 w-[140px] text-right whitespace-nowrap">
                        <div className="flex flex-col items-end gap-2">
                          <button 
                            onClick={() => {
                              setEditingItem(item);
                              setIsEditModalOpen(true);
                            }}
                            className="w-full px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-[10px] font-bold hover:bg-blue-600 hover:text-white transition-all flex items-center justify-center gap-1.5"
                          >
                            <ICONS.Edit className="w-3 h-3" />
                            编辑
                          </button>
                          <button 
                            onClick={() => handleOptimizeItem(item, isImageTab ? 'image' : aiTab.slice(0, -1) as any)}
                            disabled={isOptimizingItem === item.id}
                            className="w-full px-3 py-1.5 bg-blue-600 text-white rounded-lg text-[10px] font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-1.5 disabled:opacity-50"
                            title="AI 优化"
                          >
                            {isOptimizingItem === item.id ? (
                              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                                <ICONS.RefreshCw className="w-3 h-3" />
                              </motion.div>
                            ) : (
                              <ICONS.Zap className="w-3 h-3" />
                            )}
                            AI 优化
                          </button>
                          {!isImageTab && (
                            <button 
                              onClick={() => {
                                setHistoryItemId(item.id);
                                setShowHistory(true);
                              }}
                              className="w-full px-3 py-1.5 bg-slate-50 text-slate-500 rounded-lg text-[10px] font-bold hover:bg-slate-100 transition-all flex items-center justify-center gap-1.5"
                              title="查看历史"
                            >
                              <ICONS.History className="w-3 h-3" />
                              历史
                            </button>
                          )}
                          {isImageTab && (item.size || 0) > 200 * 1024 && (
                            <button 
                              onClick={() => handleCompressImage(item)}
                              disabled={isCompressing === item.id}
                              className="w-full px-2 py-1 text-blue-600 hover:bg-blue-50 rounded transition-all text-[10px] font-bold border border-blue-200"
                              title="压缩图片"
                            >
                              {isCompressing === item.id ? (
                                <div className="flex items-center justify-center gap-1">
                                  <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                                    <ICONS.RefreshCw className="w-2.5 h-2.5" />
                                  </motion.div>
                                  压缩中
                                </div>
                              ) : (
                                "压缩图片"
                              )}
                            </button>
                          )}
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
                      <h3 className="text-xl font-black text-slate-900">提示词管理</h3>
                      <p className="text-slate-500 text-xs">自定义 AI 生成内容时使用的提示词</p>
                    </div>
                  </div>
                  <button 
                    onClick={() => setIsPromptModalOpen(false)}
                    className="p-2 hover:bg-slate-100 rounded-full transition-all"
                  >
                    <ICONS.X className="w-5 h-5 text-slate-400" />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar">
                  {/* SEO Prompt */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                          <ICONS.Zap className="w-4 h-4" />
                        </div>
                        <h4 className="font-bold text-slate-900">SEO 优化提示词</h4>
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

                  {/* Strategy Prompt */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
                          <ICONS.Analysis className="w-4 h-4" />
                        </div>
                        <h4 className="font-bold text-slate-900">SEO 策略生成提示词</h4>
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

                  {/* Blog Prompt */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center">
                          <ICONS.FileText className="w-4 h-4" />
                        </div>
                        <h4 className="font-bold text-slate-900">博客生成提示词</h4>
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

                  {/* Image Alt Prompt */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center">
                          <ICONS.Image className="w-4 h-4" />
                        </div>
                        <h4 className="font-bold text-slate-900">图片 Alt 生成提示词</h4>
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

                  {/* Keywords Prompt */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center">
                          <ICONS.Tag className="w-4 h-4" />
                        </div>
                        <h4 className="font-bold text-slate-900">关键词生成提示词</h4>
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

                  {/* Blog Topics Prompt */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center">
                          <ICONS.Lightbulb className="w-4 h-4" />
                        </div>
                        <h4 className="font-bold text-slate-900">博客选题提示词</h4>
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
                        <h4 className="font-bold text-slate-900">手动选题生成提示词</h4>
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

                  {/* SEO Audit Suggestion Prompt */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-cyan-50 text-cyan-600 rounded-xl flex items-center justify-center">
                          <ICONS.Search className="w-4 h-4" />
                        </div>
                        <h4 className="font-bold text-slate-900">SEO 优化建议提示词</h4>
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

                  {/* Field Title Prompt */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-orange-50 text-orange-600 rounded-xl flex items-center justify-center">
                          <ICONS.Type className="w-4 h-4" />
                        </div>
                        <h4 className="font-bold text-slate-900">SEO 标题优化提示词</h4>
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
                        <h4 className="font-bold text-slate-900">SEO 描述优化提示词</h4>
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
              {(activeTab === 'ai' || activeTab === 'fix') && aiMode === 'list' && filterIds && (
                <>
                  <button 
                    onClick={() => {
                      setFilterIds(null);
                      setActiveTab('audit');
                      onTabChange?.('SEO检测');
                    }}
                    className="px-3 py-1.5 bg-slate-800 text-white rounded-xl text-xs font-bold flex items-center gap-2 hover:bg-slate-900 transition-all shadow-sm whitespace-nowrap"
                  >
                    <ICONS.ChevronDown className="w-3 h-3 rotate-90" />
                    <span>返回检测结果</span>
                  </button>
                  <button 
                    onClick={() => setFilterIds(null)}
                    className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-xs font-bold border border-blue-100 flex items-center gap-2 hover:bg-blue-100 transition-all shadow-sm whitespace-nowrap"
                  >
                    <span>已过滤: {filterIds.length} 个项目</span>
                    <ICONS.X className="w-3 h-3" />
                  </button>
                </>
              )}
              <h1 className="text-2xl font-bold text-slate-900">
                {activeTab === 'audit' ? 'SEO检测' : activeTab === 'ai' ? (aiMode === 'chat' ? 'SEO策略' : 'SEO管理') : activeTab === 'fix' ? 'SEO处理' : '效果分析'}
              </h1>
            </div>
            <p className="text-sm text-slate-500">
              {activeTab === 'audit' ? '全方位的 SEO 诊断与优化建议。' : activeTab === 'ai' ? (aiMode === 'chat' ? 'AI 驱动的 SEO 全局优化。' : '批量管理与优化您的站点内容。') : activeTab === 'fix' ? '针对检测出的问题进行针对性优化。' : '实时监控您的搜索排名与流量表现。'}
            </p>
          </div>

          <div className="flex items-center gap-3">
            {(activeTab === 'ai' || activeTab === 'fix') && aiMode === 'chat' && (
              <button 
                onClick={() => {
                  setEditingPrompts(customPrompts);
                  setIsPromptModalOpen(true);
                }}
                className="px-5 py-2.5 bg-white text-blue-600 rounded-2xl font-bold border border-blue-100 flex items-center gap-2 hover:bg-blue-50 transition-all shadow-sm whitespace-nowrap"
              >
                <ICONS.Settings className="w-4 h-4" />
                <span>提示词管理</span>
              </button>
            )}
            {(activeTab === 'ai' || activeTab === 'fix') && aiMode === 'list' && (
              <button 
                onClick={() => setIsImportModalOpen(true)}
                className="px-5 py-2.5 bg-white text-blue-600 rounded-2xl font-bold border border-blue-100 flex items-center gap-2 hover:bg-blue-50 transition-all shadow-sm whitespace-nowrap"
              >
                <ICONS.Upload className="w-4 h-4" />
                导入关键词
              </button>
            )}
          </div>
        </div>

          {(activeTab === 'ai' || activeTab === 'fix') && (
            <div className="relative">
              <div className="flex items-center gap-2">
              </div>
            </div>
          )}

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
                                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 text-[8px] font-bold rounded uppercase">
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
                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">SEO 标题</div>
                                <div className="text-xs text-slate-600 line-clamp-2">{entry.seoTitle || '(未设置)'}</div>
                              </div>
                            )}
                            {(entry.seoDescription !== undefined) && (
                              <div>
                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">SEO 描述</div>
                                <div className="text-xs text-slate-600 line-clamp-2">{entry.seoDescription || '(未设置)'}</div>
                              </div>
                            )}
                            {entry.keywords && entry.keywords.length > 0 && (
                              <div className="col-span-2">
                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">关键词</div>
                                <div className="flex flex-wrap gap-1">
                                  {entry.keywords.map((kw: string, i: number) => (
                                    <span key={i} className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px] text-slate-500">
                                      {kw}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                            {(entry.seoUrl !== undefined) && (
                              <div className="col-span-2">
                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">URL 别名</div>
                                <div className="text-xs text-slate-600">{entry.seoUrl || '(未设置)'}</div>
                              </div>
                            )}
                            {(entry.altText !== undefined) && (
                              <div className="col-span-2">
                                <div className="text-[10px] font-bold text-slate-400 uppercase mb-1">ALT 文本</div>
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
                            <span key={i} className="px-2 py-0.5 bg-white border border-slate-200 rounded-md text-[10px] text-slate-600">
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
                      setHistoryItemId(editingItem.id);
                      setShowHistory(true);
                    }}
                    className="p-2 hover:bg-slate-100 rounded-full transition-all text-slate-400 hover:text-blue-600"
                    title="历史记录"
                  >
                    <ICONS.History className="w-6 h-6" />
                  </button>
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
                          <span className={`text-[10px] font-mono ${(editingItem.size || 0) > 500 * 1024 ? 'text-amber-600 font-bold' : 'text-slate-500'}`}>
                            当前大小: {editingItem.size ? (editingItem.size > 1024 * 1024 ? `${(editingItem.size / (1024 * 1024)).toFixed(1)} MB` : `${Math.round(editingItem.size / 1024)} KB`) : '未知'}
                          </span>
                          {lastCompressedId === editingItem.id && (
                            <span className="text-[10px] text-emerald-500 font-bold flex items-center gap-1 animate-bounce">
                              <ICONS.CheckCircle className="w-2.5 h-2.5" />
                              压缩成功
                            </span>
                          )}
                          {(editingItem.size || 0) > 500 * 1024 && lastCompressedId !== editingItem.id && (
                            <span className="text-[10px] text-amber-500 font-bold flex items-center gap-1">
                              <ICONS.AlertTriangle className="w-2.5 h-2.5" />
                              建议压缩
                            </span>
                          )}
                        </div>
                        <p className="text-[10px] text-slate-400">所属: {editingItem.parentTitle}</p>
                      </div>
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
                          className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
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
                        onClick={() => handleCompressImage(editingItem)}
                        disabled={isCompressing === editingItem.id}
                        className={`flex-1 py-3 rounded-xl font-bold transition-all flex items-center justify-center gap-2 ${
                          lastCompressedId === editingItem.id 
                            ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                            : 'bg-amber-50 text-amber-600 hover:bg-amber-100'
                        }`}
                      >
                        {isCompressing === editingItem.id ? (
                          <>
                            <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                              <ICONS.RefreshCw className="w-4 h-4" />
                            </motion.div>
                            压缩中...
                          </>
                        ) : lastCompressedId === editingItem.id ? (
                          <>
                            <ICONS.CheckCircle className="w-4 h-4" />
                            已压缩
                          </>
                        ) : (
                          <>
                            <ICONS.Minimize className="w-4 h-4" />
                            压缩图片
                          </>
                        )}
                      </button>
                      <button 
                        onClick={() => {
                          handleUpdateAltText(editingItem, editingItem.altText);
                          setIsEditModalOpen(false);
                          setEditingItem(null);
                        }}
                        className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
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
                          className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
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
                      <p className="text-[10px] text-slate-400 mt-1.5 flex items-center gap-1">
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
                            className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
                          >
                            {isGenerating === `${editingItem.id}-seoTitle` ? (
                              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                                <ICONS.RefreshCw className="w-2.5 h-2.5" />
                              </motion.div>
                            ) : <ICONS.Zap className="w-2.5 h-2.5" />}
                            AI 优化
                          </button>
                        </div>
                        <span className={`text-[10px] font-bold ${(editingItem.seoTitle?.length || 0) > 70 ? 'text-red-500' : 'text-slate-400'}`}>
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
                            className="text-[10px] font-bold text-blue-600 hover:text-blue-700 flex items-center gap-1 disabled:opacity-50"
                          >
                            {isGenerating === `${editingItem.id}-seoDescription` ? (
                              <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                                <ICONS.RefreshCw className="w-2.5 h-2.5" />
                              </motion.div>
                            ) : <ICONS.Zap className="w-2.5 h-2.5" />}
                            AI 优化
                          </button>
                        </div>
                        <span className={`text-[10px] font-bold ${(editingItem.seoDescription?.length || 0) > 160 ? 'text-red-500' : 'text-slate-400'}`}>
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
                          primaryKeyword: editingItem.primaryKeyword
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
    </div>
  );
};

export default SEODashboard;
