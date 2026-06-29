import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ArrowLeft, HelpCircle, Layers, Plus, Trash2, Clock, Globe, Sparkles, AlertCircle, CheckCircle, Copy, ExternalLink, PenTool } from 'lucide-react';
import SEOSection from './SEOSection';
import { ICONS } from '../constants';
import { BlogTopic, BlogTask, Product, Page, Blog } from '../types';
import { cleanObject, isAbortError } from '../utils';
import { db, auth, storage, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc, 
  serverTimestamp, orderBy, where, getDocs, getDocFromServer, getDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { geminiService } from '../services/geminiService';

interface SEOBlogManagerProps {
  products: Product[];
  pages: Page[];
  blogs: Blog[];
  brandName: string;
  targetLanguage?: string;
  keywordLanguage?: string;
  customBlogPrompt?: string;
  customBlogTopicsPrompt?: string;
  customBlogTopicsManualPrompt?: string;
  strategy?: string;
  selectedKeywords?: string[];
  onRegisterEditActions?: (actions: { publish: () => void; cancel: () => void } | null) => void;
}

const SEOBlogManager: React.FC<SEOBlogManagerProps> = ({ 
  products, 
  pages,
  blogs,
  brandName,
  targetLanguage = '英语',
  keywordLanguage = '英语',
  customBlogPrompt,
  customBlogTopicsPrompt,
  customBlogTopicsManualPrompt,
  strategy = '',
  selectedKeywords = [],
  onRegisterEditActions
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'topics' | 'tasks'>('topics');
  const [topics, setTopics] = useState<BlogTopic[]>([]);
  const [tasks, setTasks] = useState<BlogTask[]>([]);
  const [isGeneratingTopics, setIsGeneratingTopics] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success' | 'info', text: string } | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState<string | null>(null);
  const [showTopicModal, setShowTopicModal] = useState(false);
  const [showEditTopicModal, setShowEditTopicModal] = useState(false);
  const [editingTopic, setEditingTopic] = useState<BlogTopic | null>(null);
  const [newTopic, setNewTopic] = useState({ keywords: '', targetProductIds: [] as string[], targetPageIds: [] as string[], outline: '' });
  const [isGeneratingManualTopics, setIsGeneratingManualTopics] = useState(false);
  const [suggestedManualTopics, setSuggestedManualTopics] = useState<any[]>([]);
  const [editingTask, setEditingTask] = useState<BlogTask | null>(null);
  const [selectedScoreTask, setSelectedScoreTask] = useState<BlogTask | null>(null);
  const [previewMode, setPreviewMode] = useState<'edit' | 'preview'>('edit');
  const [topicOutlineMode, setTopicOutlineMode] = useState<'edit' | 'preview'>('preview');
  const [showHistory, setShowHistory] = useState(false);
  
  // Image editing states
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
  const [isGeneratingFAQ, setIsGeneratingFAQ] = useState(false);
  const [isGeneratingHowTo, setIsGeneratingHowTo] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingScreenshot, setIsUploadingScreenshot] = useState(false);
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const screenshotInputRef = React.useRef<HTMLInputElement>(null);
  const referenceInputRef = React.useRef<HTMLInputElement>(null);
  const contentTextareaRef = React.useRef<HTMLTextAreaElement>(null);

  // Keyword Planner state and actions
  const [keywordRecommendations, setKeywordRecommendations] = useState<{
    keyword: string;
    searchVolume: number;
    competition: string;
    threeMonthTrend?: number[];
    relevance?: number;
    cpc: string;
    intent: string;
  }[] | null>(null);
  const [isAnalyzingKeywords, setIsAnalyzingKeywords] = useState(false);

  const handleAnalyzeKeywords = async () => {
    let targetKeywords = newTopic.keywords.trim();
    
    if (!targetKeywords) {
      // 1. Check selected product
      const selectedProduct = products.find(p => newTopic.targetProductIds.includes(p.id));
      if (selectedProduct) {
        targetKeywords = selectedProduct.primaryKeyword || (selectedProduct.keywords && selectedProduct.keywords[0]) || selectedProduct.title || '';
        if (targetKeywords) {
          setNewTopic(prev => ({ ...prev, keywords: targetKeywords }));
          setStatusMessage({ type: 'info', text: `由于核心词为空，已自动选用关联商品 "${selectedProduct.title}" 的关键词进行分析` });
        }
      }
      
      // 2. If still empty, check selected page
      if (!targetKeywords) {
        const selectedPage = pages.find(p => newTopic.targetPageIds.includes(p.id));
        if (selectedPage) {
          targetKeywords = selectedPage.primaryKeyword || (selectedPage.keywords && selectedPage.keywords[0]) || selectedPage.title || '';
          if (targetKeywords) {
            setNewTopic(prev => ({ ...prev, keywords: targetKeywords }));
            setStatusMessage({ type: 'info', text: `由于核心词为空，已自动选用关联页面 "${selectedPage.title}" 的关键词进行分析` });
          }
        }
      }
      
      // 3. If still empty, use seo strategy keywords
      if (!targetKeywords) {
        if (selectedKeywords && selectedKeywords.length > 0) {
          targetKeywords = selectedKeywords[0];
          if (targetKeywords) {
            setNewTopic(prev => ({ ...prev, keywords: targetKeywords }));
            setStatusMessage({ type: 'info', text: `由于核心词为空，已自动选用SEO策略关键词 "${targetKeywords}" 进行分析` });
          }
        } else if (strategy) {
          const parsed = strategy.split(/[\n,，、]/)[0]?.trim();
          if (parsed) {
            targetKeywords = parsed;
            setNewTopic(prev => ({ ...prev, keywords: targetKeywords }));
            setStatusMessage({ type: 'info', text: `由于核心词为空，已自动选用SEO策略中提取的关键词 "${targetKeywords}" 进行分析` });
          }
        }
      }
    }

    if (!targetKeywords.trim()) {
      setStatusMessage({ type: 'error', text: '当前输入框为空，且未关联任何商品、页面或SEO策略关键词，无法进行分析。请先输入或选择关联项。' });
      return;
    }

    setIsAnalyzingKeywords(true);
    setKeywordRecommendations(null);
    try {
      const res = await geminiService.analyzeKeywordsAndRecommend(targetKeywords, keywordLanguage || targetLanguage || 'Chinese');
      if (res && res.recommendations && res.recommendations.length > 0) {
        setKeywordRecommendations(res.recommendations);
        setStatusMessage({ type: 'success', text: '关键词分析与推荐已完成！' });
      } else {
        setStatusMessage({ type: 'error', text: '未获取到推荐关键词，请重试' });
      }
    } catch (error) {
      console.error(error);
      setStatusMessage({ type: 'error', text: '分析关键词失败，请重试' });
    } finally {
      setIsAnalyzingKeywords(false);
    }
  };

  const handleApplyKeyword = (kw: string) => {
    const trimmed = kw.trim();
    if (!trimmed) return;
    const current = newTopic.keywords.split(',').map(s => s.trim()).filter(Boolean);
    const lowercaseCurrent = current.map(s => s.toLowerCase());
    if (lowercaseCurrent.includes(trimmed.toLowerCase())) {
      return;
    }
    current.push(trimmed);
    setNewTopic({ ...newTopic, keywords: current.join(', ') });
  };

  // Redesigned Manual additions states and helper functions
  const [selectedSuggestedIndices, setSelectedSuggestedIndices] = useState<number[]>([]);
  const [isSavingSelectedTopics, setIsSavingSelectedTopics] = useState(false);
  const [expandedSuggestedIndex, setExpandedSuggestedIndex] = useState<number | null>(null);

  const handleUpdateSuggestedTitle = (index: number, newTitle: string) => {
    if (!suggestedManualTopics || !suggestedManualTopics[index]) return;
    const updated = [...suggestedManualTopics];
    updated[index].title = newTitle;
    setSuggestedManualTopics(updated);
  };

  const handleUpdateSuggestedDescription = (index: number, newDesc: string) => {
    if (!suggestedManualTopics || !suggestedManualTopics[index]) return;
    const updated = [...suggestedManualTopics];
    updated[index].description = newDesc;
    setSuggestedManualTopics(updated);
  };

  const handleUpdateSuggestedOutline = (index: number, newOutline: string) => {
    if (!suggestedManualTopics || !suggestedManualTopics[index]) return;
    const updated = [...suggestedManualTopics];
    updated[index].outline = newOutline;
    setSuggestedManualTopics(updated);
  };

  const handleSaveSelectedTopics = async () => {
    if (selectedSuggestedIndices.length === 0) {
      setStatusMessage({ type: 'error', text: '请至少勾选一个要导入的选题' });
      return;
    }
    setIsSavingSelectedTopics(true);
    try {
      const selectedTopicsToSave = suggestedManualTopics.filter((_, index) => 
        selectedSuggestedIndices.includes(index)
      );

      const batch = selectedTopicsToSave.map(suggestion => 
        addDoc(collection(db, 'blogTopics'), cleanObject({
          title: suggestion.title,
          keywords: suggestion.keywords,
          type: suggestion.type,
          description: suggestion.description,
          outline: suggestion.outline,
          targetProductIds: newTopic.targetProductIds,
          targetPageIds: newTopic.targetPageIds,
          status: '待处理',
          source: '人工',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }))
      );
      
      await Promise.all(batch);
      
      setShowTopicModal(false);
      setNewTopic({ keywords: '', targetProductIds: [], targetPageIds: [], outline: '' });
      setProductSearch('');
      setPageSearch('');
      setSuggestedManualTopics([]);
      setKeywordRecommendations(null);
      setSelectedSuggestedIndices([]);
      setStatusMessage({ type: 'success', text: `已成功将 ${selectedTopicsToSave.length} 个精选选题保存到库中！` });
    } catch (error) {
      console.error('Failed to save selected topics:', error);
      setStatusMessage({ type: 'error', text: '导入选中选题失败，请重试' });
    } finally {
      setIsSavingSelectedTopics(false);
    }
  };

  const editActionsRef = React.useRef<{ publish: () => void; cancel: () => void } | null>(null);

  useEffect(() => {
    if (editingTask) {
      if (onRegisterEditActions) {
        onRegisterEditActions({
          publish: () => {
            editActionsRef.current?.publish();
          },
          cancel: () => {
            editActionsRef.current?.cancel();
          }
        });
      }
    } else {
      onRegisterEditActions?.(null);
    }
  }, [!!editingTask, onRegisterEditActions]);
  const [productSearch, setProductSearch] = useState('');
  const [pageSearch, setPageSearch] = useState('');
  const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
  const [isPageDropdownOpen, setIsPageDropdownOpen] = useState(false);
  const productDropdownRef = React.useRef<HTMLDivElement>(null);
  const pageDropdownRef = React.useRef<HTMLDivElement>(null);
  const [schedulingTopicId, setSchedulingTopicId] = useState<string | null>(null);
  const [scheduledDateTime, setScheduledDateTime] = useState<string>('');
  const [editingKeywordsTopicId, setEditingKeywordsTopicId] = useState<string | null>(null);
  const [editingOutlineTopicId, setEditingOutlineTopicId] = useState<string | null>(null);
  const [tempKeywords, setTempKeywords] = useState<string>('');
  const [tempOutline, setTempOutline] = useState<string>('');

  const topicsToProcessList = topics.filter(t => t.status === '待处理' || t.status === '执行中');
  const tasksToProcessList = tasks.filter(t => t.status === '待执行' || t.status === '执行中' || t.status === '失败' || t.status === '已完成');
  
  const topicsToProcess = topicsToProcessList.length;
  const tasksToProcess = tasks.filter(t => t.status === '待执行' || t.status === '执行中' || t.status === '失败').length;
  const totalTasks = tasksToProcessList.length;

  const insertMarkdown = (prefix: string, suffix: string = '') => {
    if (!contentTextareaRef.current || !editingTask || !editingTask.result) return;
    
    const textarea = contentTextareaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const text = editingTask.result.content || '';
    const selectedText = text.substring(start, end);
    
    const newText = text.substring(0, start) + prefix + selectedText + suffix + text.substring(end);
    
    const updated = { ...editingTask };
    if (updated.result) updated.result.content = newText;
    setEditingTask(updated);
    
    // Reset focus and selection
    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(start + prefix.length, start + prefix.length + selectedText.length);
    }, 0);
  };

  useEffect(() => {
    // Test connection to Firestore
    const testConnection = async () => {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if (isAbortError(error)) return;
        if (error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration.");
          setStatusMessage({ type: 'error', text: '数据库连接失败，请检查网络或 Firebase 配置。' });
        }
      }
    };
    testConnection();

    const qTopics = query(collection(db, 'blogTopics'), orderBy('createdAt', 'desc'));
    const unsubscribeTopics = onSnapshot(qTopics, (snapshot) => {
      setTopics(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BlogTopic)));
    }, (error) => handleLocalFirestoreError(error, OperationType.LIST, 'blogTopics'));

    const qTasks = query(collection(db, 'blogTasks'), orderBy('createdAt', 'desc'));
    const unsubscribeTasks = onSnapshot(qTasks, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BlogTask)));
    }, (error) => handleLocalFirestoreError(error, OperationType.LIST, 'blogTasks'));

    return () => {
      unsubscribeTopics();
      unsubscribeTasks();
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node)) {
        setIsProductDropdownOpen(false);
      }
      if (pageDropdownRef.current && !pageDropdownRef.current.contains(event.target as Node)) {
        setIsPageDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLocalFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    if (isAbortError(error)) return;
    setStatusMessage({ type: 'error', text: `操作失败: ${error instanceof Error ? error.message : '权限不足或网络错误'}` });
    handleFirestoreError(error, operationType, path);
  };

  const handleUpdateKeywords = async (topicId: string) => {
    try {
      const keywordsArray = tempKeywords.split(',').map(k => k.trim()).filter(k => k !== '');
      await updateDoc(doc(db, 'blogTopics', topicId), {
        keywords: keywordsArray,
        updatedAt: new Date().toISOString()
      });
      setEditingKeywordsTopicId(null);
      setTempKeywords('');
      setStatusMessage({ type: 'success', text: '关键词已更新' });
    } catch (err) {
      handleLocalFirestoreError(err, OperationType.UPDATE, `blogTopics/${topicId}`);
    }
  };

  const handleUpdateOutline = async (topicId: string) => {
    try {
      await updateDoc(doc(db, 'blogTopics', topicId), {
        outline: tempOutline,
        updatedAt: new Date().toISOString()
      });
      setEditingOutlineTopicId(null);
      setTempOutline('');
      setStatusMessage({ type: 'success', text: '大纲已更新' });
    } catch (err) {
      handleLocalFirestoreError(err, OperationType.UPDATE, `blogTopics/${topicId}`);
    }
  };

  const handleGenerateTopics = async () => {
    setStatusMessage(null);
    
    if (!products || products.length === 0) {
      setStatusMessage({ type: 'error', text: '选题库需要根据您的商品信息来生成。请先在“商品管理”中添加一些商品。' });
      return;
    }

    setIsGeneratingTopics(true);
    try {
      console.log('Starting topic generation with products:', products.length, 'Language:', targetLanguage);
      const suggestedTopics = await withRetry(() => 
        geminiService.generateBlogTopics(
          products, 
          brandName, 
          5, 
          targetLanguage, 
          strategy, 
          selectedKeywords, 
          customBlogTopicsPrompt
        )
      );
      
      if (!suggestedTopics || suggestedTopics.length === 0) {
        setStatusMessage({ type: 'info', text: 'AI 暂时无法生成选题，请尝试完善商品描述后再试。' });
        return;
      }

      console.log('Generated topics:', suggestedTopics.length);
      let addedCount = 0;
      for (const topic of suggestedTopics) {
        try {
          await addDoc(collection(db, 'blogTopics'), cleanObject({
            ...topic,
            status: '待处理',
            source: 'AI',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }));
          addedCount++;
        } catch (err) {
          handleLocalFirestoreError(err, OperationType.CREATE, 'blogTopics');
        }
      }
      setStatusMessage({ type: 'success', text: `成功生成 ${addedCount} 个新选题！` });
    } catch (error) {
      if (error instanceof Error && error.message.includes('Firestore Error')) {
        // Already handled by handleFirestoreError
      } else {
        console.error('Failed to generate topics:', error);
        setStatusMessage({ type: 'error', text: '生成选题时出错，请检查网络连接或稍后再试。' });
      }
    } finally {
      setIsGeneratingTopics(false);
      // 5秒后自动清除成功/信息提示，错误提示保留
      setTimeout(() => {
        setStatusMessage(prev => prev?.type !== 'error' ? null : prev);
      }, 5000);
    }
  };

  // Auto-publish scheduled blogs
  useEffect(() => {
    const checkScheduledBlogs = async () => {
      const now = new Date();
      const blogsToPublish = blogs.filter(b => 
        b.status === '草稿' && 
        b.scheduledAt && 
        new Date(b.scheduledAt) <= now
      );

      for (const blog of blogsToPublish) {
        try {
          await updateDoc(doc(db, 'blogs', blog.id), {
            status: '已发布',
            updatedAt: now.toISOString()
          });
          console.log(`Auto-published blog: ${blog.title}`);
        } catch (error) {
          console.error(`Failed to auto-publish blog ${blog.id}:`, error);
        }
      }
    };

    if (blogs.length > 0) {
      checkScheduledBlogs();
      // Also check every minute
      const interval = setInterval(checkScheduledBlogs, 60000);
      return () => clearInterval(interval);
    }
  }, [blogs]);

  // Auto-execute scheduled tasks
  useEffect(() => {
    const checkScheduledTasks = async () => {
      const now = new Date();
      const tasksToExecute = tasks.filter(t => 
        t.status === '待执行' && 
        t.scheduledAt && 
        new Date(t.scheduledAt) <= now
      );

      for (const task of tasksToExecute) {
        try {
          const topic = topics.find(tp => tp.id === task.topicId);
          if (topic) {
            await processTask(task.id, topic);
            console.log(`Auto-executed task: ${task.topicTitle}`);
          }
        } catch (error) {
          console.error(`Failed to auto-execute task ${task.id}:`, error);
        }
      }
    };

    if (tasks.length > 0) {
      checkScheduledTasks();
      const interval = setInterval(checkScheduledTasks, 60000);
      return () => clearInterval(interval);
    }
  }, [tasks, topics]);

  const handleGenerateManualTopics = async () => {
    if (!newTopic.keywords.trim() && newTopic.targetProductIds.length === 0 && newTopic.targetPageIds.length === 0) {
      setStatusMessage({ type: 'error', text: '请至少输入关键词、选择商品或选择页面以生成选题' });
      return;
    }

    setIsGeneratingManualTopics(true);
    try {
      const selectedProducts = products.filter(p => newTopic.targetProductIds.includes(p.id));
      const selectedPages = pages.filter(p => newTopic.targetPageIds.includes(p.id));
      
      const suggestions = await withRetry(() => 
        geminiService.generateManualBlogTopics(
          newTopic.keywords,
          selectedProducts,
          selectedPages,
          brandName,
          3,
          targetLanguage,
          strategy,
          selectedKeywords,
          customBlogTopicsManualPrompt
        )
      );
      
      if (suggestions && suggestions.length > 0) {
        setSuggestedManualTopics(suggestions);
        setSelectedSuggestedIndices(suggestions.map((_, i) => i));
        setStatusMessage({ type: 'success', text: `AI 成功为您生成了 ${suggestions.length} 个创意选题，请在下方预览和微调！` });
      } else {
        setStatusMessage({ type: 'info', text: 'AI 暂时无法生成选题，请尝试增加关键词或商品' });
      }
    } catch (error) {
      console.error('Failed to generate manual topics:', error);
      setStatusMessage({ type: 'error', text: '生成选题失败，请重试' });
    } finally {
      setIsGeneratingManualTopics(false);
    }
  };

  const getTopicStatus = (topic: BlogTopic) => {
    if (topic.status === '执行中') {
      const hasActiveTask = tasks.some(t => t.topicId === topic.id && t.status === '执行中');
      if (!hasActiveTask) {
        return '待处理';
      }
    }
    return topic.status;
  };

  const handleCreateTask = async (topic: BlogTopic, scheduleTime?: string) => {
    setIsCreatingTask(topic.id);
    if (!scheduleTime) {
      setActiveSubTab('tasks');
    }
    try {
      const taskData: Partial<BlogTask> = {
        topicId: topic.id,
        topicTitle: topic.title,
        targetProductIds: topic.targetProductIds,
        status: scheduleTime ? '待执行' : '执行中',
        scheduledAt: scheduleTime || new Date().toISOString(),
        createdAt: new Date().toISOString()
      };
      
      const docRef = await addDoc(collection(db, 'blogTasks'), cleanObject(taskData));
      
      await updateDoc(doc(db, 'blogTopics', topic.id), cleanObject({ 
        status: '执行中',
        updatedAt: new Date().toISOString()
      }));

      // If not scheduled, generate immediately (for demo/manual trigger)
      if (!scheduleTime) {
        await processTask(docRef.id, topic);
        // After processing, if successful, open the editing modal
        const taskDoc = await getDoc(doc(db, 'blogTasks', docRef.id));
        if (taskDoc.exists() && taskDoc.data().status === '已完成') {
          setEditingTask({ id: docRef.id, ...taskDoc.data() } as BlogTask);
          setPreviewMode('preview');
        }
      }
      setStatusMessage({ type: 'success', text: scheduleTime ? '博客生成已预约！' : '博客生成已完成！' });
    } catch (error) {
      handleLocalFirestoreError(error, OperationType.CREATE, 'blogTasks');
    } finally {
      setIsCreatingTask(null);
      setTimeout(() => {
        setStatusMessage(prev => prev?.type !== 'error' ? null : prev);
      }, 5000);
    }
  };

  const withRetry = async <T extends unknown>(fn: () => Promise<T>, retries = 2): Promise<T> => {
    try {
      return await fn();
    } catch (error) {
      if (retries > 0 && error instanceof Error && (error.message.includes('aborted') || error.message.includes('timeout') || error.message.includes('fetch'))) {
        console.warn(`Retrying AI request... ${retries} attempts left`);
        await new Promise(resolve => setTimeout(resolve, 1000));
        return withRetry(fn, retries - 1);
      }
      throw error;
    }
  };

  const compressImage = async (base64Data: string, maxWidth = 1200, quality = 0.7): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = (height * maxWidth) / width;
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.fillStyle = 'white';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
        }

        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Canvas toBlob failed'));
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => reject(new Error('Image load failed'));
      img.src = base64Data;
    });
  };

  const uploadBase64Image = async (base64Data: string, path: string) => {
    try {
      if (!base64Data.startsWith('data:')) return base64Data;
      
      const blob = await compressImage(base64Data);
      const storageRef = ref(storage, path);
      await uploadBytes(storageRef, blob);
      return await getDownloadURL(storageRef);
    } catch (error) {
      console.error('Base64 upload failed:', error);
      return base64Data;
    }
  };

  const processTask = async (taskId: string, topic: BlogTopic) => {
    try {
      await updateDoc(doc(db, 'blogTasks', taskId), cleanObject({ 
        status: '执行中',
        updatedAt: new Date().toISOString()
      }));
      
      const relevantProducts = products.filter(p => topic.targetProductIds.includes(p.id));
      
      console.log('Generating content for topic:', topic.title);
      const content = await withRetry(() => 
        geminiService.generateBlogContent(
          topic.title, 
          relevantProducts, 
          brandName, 
          targetLanguage, 
          strategy, 
          selectedKeywords, 
          customBlogPrompt,
          topic.outline
        )
      );
      
      if (!content) {
        throw new Error('AI 生成内容为空，请检查提示词或稍后重试');
      }
      
      console.log('Content generated successfully, generating image...');
      let imageUrl = await withRetry(() => 
        geminiService.generateImage(content.imageDescription, "16:9")
      );
        
        // If image is base64, upload to storage to avoid Firestore size limits
        if (imageUrl && imageUrl.startsWith('data:')) {
          imageUrl = await uploadBase64Image(imageUrl, `blog-tasks/${taskId}/header-${Date.now()}.png`);
        }
        
        const finalImageUrl = imageUrl || `https://picsum.photos/seed/${encodeURIComponent(content.imageDescription || topic.title)}/1200/630`;
        
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
        const finalSlug = slugify(content.title) || `blog-${Date.now()}`;

        let scheduledAt = new Date().toISOString();
        try {
          const taskDoc = await getDoc(doc(db, 'blogTasks', taskId));
          if (taskDoc.exists()) {
            scheduledAt = taskDoc.data().scheduledAt || scheduledAt;
          }
        } catch (err) {
          console.warn('Failed to fetch task doc for scheduledAt, defaulting to now', err);
        }

        const blogData = {
          title: content.title,
          content: content.content,
          image: finalImageUrl,
          seoTitle: content.seoTitle,
          seoDescription: content.seoDescription,
          keywords: content.keywords,
          jsonLd: content.jsonLd,
          seoUrl: finalSlug,
          status: scheduledAt && new Date(scheduledAt) > new Date() ? '草稿' : '已发布',
          scheduledAt: scheduledAt,
          updatedAt: new Date().toISOString(),
          createdAt: new Date().toISOString()
        };

        const blogRef = await addDoc(collection(db, 'blogs'), cleanObject(blogData));
        const blogId = blogRef.id;

        await updateDoc(doc(db, 'blogTasks', taskId), cleanObject({
          status: '已完成',
          result: {
            title: content.title,
            content: content.content,
            imageUrl: finalImageUrl,
            seoTitle: content.seoTitle,
            seoDescription: content.seoDescription,
            keywords: content.keywords,
            jsonLd: content.jsonLd,
            score: content.score,
            scoreReason: content.scoreReason,
            seoUrl: finalSlug
          },
          resultBlogId: blogId,
          completedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        }));
        await updateDoc(doc(db, 'blogTopics', topic.id), cleanObject({ 
          status: '已生成',
          updatedAt: new Date().toISOString()
        }));
    } catch (error) {
      console.error('Task processing failed:', error);
      try {
        await updateDoc(doc(db, 'blogTasks', taskId), cleanObject({ 
          status: '失败', 
          error: error instanceof Error ? error.message : 'Unknown error',
          updatedAt: new Date().toISOString()
        }));
        // Update topic status back to '待处理' so it's not stuck in '执行中'
        await updateDoc(doc(db, 'blogTopics', topic.id), cleanObject({ 
          status: '待处理',
          updatedAt: new Date().toISOString()
        }));
      } catch (updateErr) {
        handleLocalFirestoreError(updateErr, OperationType.UPDATE, `blogTasks/${taskId}`);
      }
    }
  };

  const handleFileUpload = async (file: File, path: string) => {
    const storageRef = ref(storage, path);
    await uploadBytes(storageRef, file);
    return await getDownloadURL(storageRef);
  };

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingTask) return;

    setIsUploadingImage(true);
    try {
      const url = await handleFileUpload(file, `blog-images/${editingTask.id}/${file.name}`);
      const updated = { ...editingTask };
      if (updated.result) {
        updated.result.imageUrl = url;
        setEditingTask(updated);
      }
      setStatusMessage({ type: 'success', text: '图片上传成功' });
    } catch (error) {
      console.error('Image upload failed:', error);
      setStatusMessage({ type: 'error', text: '图片上传失败' });
    } finally {
      setIsUploadingImage(false);
    }
  };

  const handleScreenshotChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingTask) return;

    setIsUploadingScreenshot(true);
    try {
      const url = await handleFileUpload(file, `blog-screenshots/${editingTask.id}/${Date.now()}-${file.name}`);
      const updated = { ...editingTask };
      if (updated.result) {
        if (!updated.result.screenshots) {
          updated.result.screenshots = [];
        }
        updated.result.screenshots.push(url);
        setEditingTask(updated);
      }
      setStatusMessage({ type: 'success', text: '截图上传成功' });
    } catch (error) {
      console.error('Screenshot upload failed:', error);
      setStatusMessage({ type: 'error', text: '截图上传失败' });
    } finally {
      setIsUploadingScreenshot(false);
    }
  };

  const handleDeleteScreenshot = (indexToDelete: number) => {
    if (!editingTask || !editingTask.result) return;
    const updated = { ...editingTask };
    if (updated.result && updated.result.screenshots) {
      updated.result.screenshots = updated.result.screenshots.filter((_, idx) => idx !== indexToDelete);
      setEditingTask(updated);
      setStatusMessage({ type: 'success', text: '截图已删除' });
    }
  };

  const insertScreenshotMarkdown = (imageUrl: string) => {
    insertMarkdown(`\n\n![博客内容配图](${imageUrl})\n\n`);
    setStatusMessage({ type: 'success', text: '已将截图插入到编辑器光标处' });
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setStatusMessage({ type: 'success', text: '链接已复制到剪贴板' });
  };

  const handleReferenceImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onloadend = () => {
      setReferenceImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleRegenerateImage = async () => {
    if (!editingTask || !imagePrompt) return;

    setIsRegeneratingImage(true);
    try {
      let imageUrl = await withRetry(() => 
        geminiService.generateImage(imagePrompt, "16:9", referenceImage || undefined)
      );
      
      if (imageUrl) {
        // Upload to storage immediately if it's base64
        if (imageUrl.startsWith('data:')) {
          imageUrl = await uploadBase64Image(imageUrl, `blog-tasks/${editingTask.id}/regenerated-${Date.now()}.png`);
        }
        
        const updated = { ...editingTask };
        if (updated.result) {
          updated.result.imageUrl = imageUrl;
          setEditingTask(updated);
        }
        setStatusMessage({ type: 'success', text: '图片重新生成成功' });
      } else {
        setStatusMessage({ type: 'error', text: '图片生成失败，请重试' });
      }
    } catch (error) {
      console.error('Image regeneration failed:', error);
      setStatusMessage({ type: 'error', text: '图片生成过程中出错' });
    } finally {
      setIsRegeneratingImage(false);
    }
  };

  const renderTopics = () => (
    <div className="space-y-6">
      <AnimatePresence>
        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
              statusMessage.type === 'error' ? 'bg-red-50 text-red-600 border border-red-100' :
              statusMessage.type === 'success' ? 'bg-green-50 text-green-600 border border-green-100' :
              'bg-blue-50 text-blue-600 border border-blue-100'
            }`}
          >
            {statusMessage.type === 'error' ? <ICONS.Plus className="w-4 h-4 rotate-45" /> : 
             statusMessage.type === 'success' ? <ICONS.Check className="w-4 h-4" /> : 
             <ICONS.Clock className="w-4 h-4" />}
            {statusMessage.text}
            {statusMessage.type === 'error' && (
              <button onClick={() => setStatusMessage(null)} className="ml-auto hover:opacity-70">
                <ICONS.Plus className="w-3 h-3 rotate-45" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {topicsToProcessList.map((topic) => (
          <motion.div 
            key={topic.id}
            layout
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group"
          >
            <div className="flex justify-between items-start mb-3">
              <div className="flex flex-wrap gap-2">
                <span className={`px-2 py-0.5 rounded text-[11px] font-bold uppercase ${
                  topic.source === 'AI' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  {topic.source === 'AI' ? 'AI 建议' : '手动添加'}
                </span>
                {topic.type && (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[11px] font-bold uppercase">
                    {topic.type}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {getTopicStatus(topic) === '已生成' ? (
                  <span className="flex items-center gap-1 text-green-600 text-[11px] font-bold bg-green-50 px-2 py-0.5 rounded">
                    <ICONS.Check className="w-3 h-3" /> 已生成
                  </span>
                ) : getTopicStatus(topic) === '执行中' ? (
                  <span className="flex items-center gap-1 text-blue-600 text-[11px] font-bold bg-blue-50 px-2 py-0.5 rounded">
                    <ICONS.Loader className="w-3 h-3 animate-spin" /> 处理中
                  </span>
                ) : (
                  <span className="text-slate-400 text-[11px] font-bold bg-slate-50 px-2 py-0.5 rounded">
                    待处理
                  </span>
                )}
                <button 
                  onClick={async () => {
                    try {
                      await deleteDoc(doc(db, 'blogTopics', topic.id));
                      setStatusMessage({ type: 'success', text: '选题已删除' });
                    } catch (err) {
                      handleLocalFirestoreError(err, OperationType.DELETE, `blogTopics/${topic.id}`);
                    }
                  }}
                  className="text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                >
                  <ICONS.Trash className="w-4 h-4" />
                </button>
              </div>
            </div>
            <h4 className="font-bold text-slate-900 mb-2 line-clamp-2">{topic.title}</h4>
            {topic.description && (
              <p className="text-xs text-slate-500 mb-3 line-clamp-2 italic">
                {topic.description}
              </p>
            )}

            <div className="mb-4">
              {editingKeywordsTopicId === topic.id ? (
                <div className="flex flex-col gap-2 animate-in fade-in slide-in-from-top-2">
                  <input 
                    type="text"
                    value={tempKeywords}
                    onChange={(e) => setTempKeywords(e.target.value)}
                    placeholder="输入关键词，逗号分隔"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                    autoFocus
                  />
                  <div className="flex justify-end gap-2">
                    <button 
                      onClick={() => setEditingKeywordsTopicId(null)}
                      className="px-2 py-1 text-[11px] font-bold text-slate-400 hover:text-slate-600 transition-all"
                    >
                      取消
                    </button>
                    <button 
                      onClick={() => handleUpdateKeywords(topic.id)}
                      className="px-2 py-1 text-[11px] font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      保存
                    </button>
                  </div>
                </div>
              ) : (
                <div 
                  className="flex flex-wrap gap-1 cursor-pointer group/keywords max-h-[76px] overflow-hidden"
                  onClick={() => {
                    setEditingKeywordsTopicId(topic.id);
                    setTempKeywords(topic.keywords.join(', '));
                  }}
                  title="点击编辑关键词"
                >
                  {topic.keywords.map((k, i) => (
                    <span key={i} className="px-2 py-0.5 bg-slate-50 text-slate-500 text-[11px] rounded-full border border-slate-100 group-hover/keywords:border-blue-200 transition-all">
                      {k}
                    </span>
                  ))}
                  <ICONS.Edit className="w-3 h-3 text-slate-300 opacity-0 group-hover/keywords:opacity-100 transition-all ml-1 shrink-0 self-center" />
                </div>
              )}
            </div>
            <div className="flex items-center justify-between pt-4 border-t border-slate-50">
              <div className="flex items-center gap-1 text-xs text-slate-400">
                <ICONS.Package className="w-3 h-3" />
                {topic.targetProductIds.length} 个关联商品
              </div>
              <div className="flex items-center gap-2">
                {schedulingTopicId === topic.id ? (
                  <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
                    <input 
                      type="datetime-local"
                      value={scheduledDateTime}
                      min={new Date().toISOString().slice(0, 16)}
                      onChange={(e) => setScheduledDateTime(e.target.value)}
                      className="px-2 py-1 text-[11px] border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <button 
                      onClick={() => {
                        if (!scheduledDateTime) {
                          setStatusMessage({ type: 'error', text: '请选择发布时间' });
                          return;
                        }
                        if (new Date(scheduledDateTime) <= new Date()) {
                          setStatusMessage({ type: 'error', text: '发布时间不能早于当前时间' });
                          return;
                        }
                        handleCreateTask(topic, scheduledDateTime);
                        setSchedulingTopicId(null);
                        setScheduledDateTime('');
                      }}
                      className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all"
                      title="确认定时"
                    >
                      <ICONS.Check className="w-3 h-3" />
                    </button>
                    <button 
                      onClick={() => {
                        setSchedulingTopicId(null);
                        setScheduledDateTime('');
                      }}
                      className="p-1.5 bg-slate-100 text-slate-500 rounded-lg hover:bg-slate-200 transition-all"
                      title="取消"
                    >
                      <ICONS.Plus className="w-3 h-3 rotate-45" />
                    </button>
                  </div>
                ) : (
                  <>
                    <button 
                      onClick={() => setSchedulingTopicId(topic.id)}
                      disabled={isCreatingTask === topic.id || getTopicStatus(topic) === '已生成'}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-50"
                      title="定时发布"
                    >
                      <ICONS.Clock className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleCreateTask(topic)}
                      disabled={isCreatingTask === topic.id || getTopicStatus(topic) === '已生成'}
                      className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all flex items-center gap-1 disabled:opacity-50"
                    >
                      {isCreatingTask === topic.id ? (
                        <ICONS.Loader className="w-3 h-3 animate-spin" />
                      ) : getTopicStatus(topic) === '已生成' ? (
                        <ICONS.Check className="w-3 h-3" />
                      ) : (
                        <ICONS.Zap className="w-3 h-3" />
                      )}
                      {getTopicStatus(topic) === '已生成' ? '已生成' : '立即生成博客'}
                    </button>
                    <button 
                      onClick={() => {
                        setEditingTopic(topic);
                        setTopicOutlineMode('preview');
                        setShowEditTopicModal(true);
                      }}
                      className="px-3 py-1.5 bg-slate-50 text-slate-600 rounded-lg text-xs font-bold hover:bg-slate-100 transition-all flex items-center gap-1"
                    >
                      <ICONS.Edit className="w-3 h-3" />
                      编辑
                    </button>
                  </>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {showTopicModal && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-5xl rounded-3xl shadow-2xl my-auto"
            >
              {/* Header */}
              <div className="p-6 border-b border-slate-100 flex justify-between items-center rounded-t-3xl bg-white">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg">AI 智能选题生成</h3>
                </div>
                <button onClick={() => {
                  setShowTopicModal(false);
                  setNewTopic({ keywords: '', targetProductIds: [], targetPageIds: [], outline: '' });
                  setProductSearch('');
                  setPageSearch('');
                  setSuggestedManualTopics([]);
                  setKeywordRecommendations(null);
                }} className="text-slate-400 hover:text-slate-600 bg-slate-50 hover:bg-slate-100 p-2 rounded-full transition-colors cursor-pointer">
                  <ICONS.Plus className="w-5 h-5 rotate-45" />
                </button>
              </div>

              {/* Scrollable Container */}
              <div className="p-6 max-h-[70vh] overflow-y-auto space-y-6">
                {suggestedManualTopics.length > 0 ? (
                  /* AI GENERATED PREVIEW AND ADJUSTMENT FLOW */
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-6"
                  >
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-blue-50/50 border border-blue-100 rounded-2xl p-4">
                      <div>
                        <div className="flex items-center gap-1.5 text-blue-700 font-bold text-sm">
                          <Sparkles className="w-4 h-4 text-blue-600 animate-pulse" />
                          <span>AI 创意选题已生成！</span>
                        </div>
                        <p className="text-xs text-slate-500 mt-1">
                          已为您深度定制了以下 3 个高转化率选题。点击展开卡片可直接微调<b>大纲</b>、<b>标题</b>与<b>描述</b>，勾选您心仪的选题一键导入。
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSuggestedManualTopics([])}
                        className="px-3 py-1.5 text-xs font-bold text-blue-600 bg-white border border-blue-200 rounded-xl hover:bg-blue-50 transition-all flex items-center gap-1 cursor-pointer shrink-0"
                      >
                        <ArrowLeft className="w-3 h-3" />
                        <span>修改条件重新生成</span>
                      </button>
                    </div>

                    <div className="space-y-4">
                      {suggestedManualTopics.map((item, index) => {
                        const isSelected = selectedSuggestedIndices.includes(index);
                        const isExpanded = expandedSuggestedIndex === index;
                        const outlineLinesCount = item.outline ? item.outline.split('\n').filter(line => line.trim()).length : 0;

                        return (
                          <div 
                            key={index} 
                            className={`border rounded-2xl transition-all duration-300 ${
                              isSelected 
                                ? 'border-blue-200 bg-blue-50/10 shadow-xs' 
                                : 'border-slate-100 bg-slate-50/30'
                            }`}
                          >
                            {/* Card Header & Checkbox */}
                            <div className="p-4 flex items-start gap-3">
                              <input 
                                type="checkbox"
                                checked={isSelected}
                                onChange={(e) => {
                                  if (e.target.checked) {
                                    setSelectedSuggestedIndices([...selectedSuggestedIndices, index]);
                                  } else {
                                    setSelectedSuggestedIndices(selectedSuggestedIndices.filter(i => i !== index));
                                  }
                                }}
                                className="mt-1 rounded text-blue-600 focus:ring-blue-500 w-4 h-4 cursor-pointer"
                                id={`suggested-topic-check-${index}`}
                              />
                              <div className="flex-1 space-y-3">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="px-2.5 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-lg border border-blue-100/50 uppercase">
                                    {item.type || 'How-to Guide'}
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setExpandedSuggestedIndex(isExpanded ? null : index)}
                                    className="text-xs text-slate-500 hover:text-slate-800 flex items-center gap-1 bg-white hover:bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200 transition-colors cursor-pointer"
                                  >
                                    <span>{isExpanded ? '折叠大纲' : '查看/编辑大纲'}</span>
                                    <span className="px-1.5 py-0.2 bg-slate-100 text-[10px] text-slate-600 rounded-md font-mono">{outlineLinesCount} 项</span>
                                  </button>
                                </div>

                                {/* Editable Title */}
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase">博客标题</label>
                                  <input 
                                    type="text"
                                    value={item.title}
                                    onChange={(e) => handleUpdateSuggestedTitle(index, e.target.value)}
                                    className="w-full px-3.5 py-2 bg-white border border-slate-200 focus:border-blue-500 rounded-xl text-sm font-semibold text-slate-800 outline-none transition-all"
                                    placeholder="选题标题..."
                                  />
                                </div>

                                {/* Editable Description */}
                                <div className="space-y-1">
                                  <label className="text-[10px] font-bold text-slate-400 uppercase">核心摘要与描述</label>
                                  <textarea
                                    value={item.description}
                                    onChange={(e) => handleUpdateSuggestedDescription(index, e.target.value)}
                                    className="w-full px-3.5 py-2 bg-slate-50/50 border border-slate-200 focus:border-blue-400 focus:bg-white rounded-xl text-xs text-slate-600 outline-none transition-all h-16 resize-none"
                                    placeholder="简短描述该选题的切入点..."
                                  />
                                </div>

                                {/* Generated Keywords tags */}
                                {item.keywords && item.keywords.length > 0 && (
                                  <div className="flex flex-wrap gap-1 items-center">
                                    <span className="text-[10px] font-bold text-slate-400 mr-1">参考词:</span>
                                    {item.keywords.map((kw: string, ki: number) => (
                                      <span key={ki} className="px-2 py-0.5 bg-slate-100 text-slate-600 text-[10px] rounded-md font-medium border border-slate-200/50">
                                        {kw}
                                      </span>
                                    ))}
                                  </div>
                                )}
                              </div>
                            </div>

                            {/* Expanded Outline Editor Panel */}
                            <AnimatePresence>
                              {isExpanded && (
                                <motion.div 
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: 'auto', opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="overflow-hidden border-t border-slate-100 bg-slate-50/60 rounded-b-2xl"
                                >
                                  <div className="p-4 space-y-2">
                                    <div className="flex justify-between items-center">
                                      <label className="text-[10px] font-bold text-slate-400 uppercase">博客结构大纲 (支持 Markdown 等格式)</label>
                                      <span className="text-[10px] text-slate-400">大纲结构将直接决定后续自动撰写的内容模块</span>
                                    </div>
                                    <textarea 
                                      value={item.outline}
                                      onChange={(e) => handleUpdateSuggestedOutline(index, e.target.value)}
                                      className="w-full p-3 font-mono text-xs text-slate-700 bg-white border border-slate-200 focus:border-blue-500 rounded-xl h-48 outline-none transition-all"
                                      placeholder="例如:
1. 什么是家居软装？
2. 2026年爆款的5个家居装饰趋势
   - 极简自然风
   - 复古南洋风
3. 挑选舒适单品的避坑指南
4. 总结与行动指南"
                                    />
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        );
                      })}
                    </div>
                  </motion.div>
                ) : (
                  /* AI BUILD SETUP FORM */
                  <div className="space-y-6">
                    {/* Step 1: Keywords and Planner */}
                    <div className="bg-slate-50/50 border border-slate-150 rounded-2xl p-4 md:p-5 space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                        <span className="w-5 h-5 rounded-full bg-blue-100 text-blue-600 text-xs font-bold flex items-center justify-center">1</span>
                        <span className="font-bold text-slate-800 text-sm">指定选题的核心创意词</span>
                      </div>
                      
                      <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-500">核心词/长尾词</label>
                        <div className="flex gap-2">
                          <input 
                            type="text"
                            value={newTopic.keywords}
                            onChange={(e) => setNewTopic({ ...newTopic, keywords: e.target.value })}
                            className="flex-1 px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none transition-all text-sm"
                            placeholder="例如：家居, 装饰, 趋势 (用逗号分隔，添加多个创意方向)"
                          />
                          <button
                            type="button"
                            onClick={handleAnalyzeKeywords}
                            disabled={isAnalyzingKeywords}
                            className="text-xs bg-blue-600 hover:bg-blue-700 text-white font-bold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-sm px-4 py-2.5 rounded-xl transition-all shrink-0"
                          >
                            <Sparkles className={`w-3.5 h-3.5 ${isAnalyzingKeywords ? 'animate-spin' : ''}`} />
                            <span>{isAnalyzingKeywords ? '分析长尾词中...' : 'AI 分析与推荐长尾词'}</span>
                          </button>
                        </div>
                      </div>

                      {/* Keyword Recommendations Display (Inlined Planner results) */}
                      <AnimatePresence>
                        {keywordRecommendations && keywordRecommendations.length > 0 && (
                          <motion.div 
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, y: -10 }}
                            className="bg-white border border-slate-200 rounded-2xl p-4 space-y-3 shadow-xs"
                          >
                            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                              <div className="flex items-center gap-1.5">
                                <Layers className="w-4 h-4 text-blue-600" />
                                <span className="text-xs font-bold text-slate-700">Keyword Planner 推荐长尾词分析</span>
                              </div>
                              <span className="text-[10px] text-slate-400 bg-slate-50 border border-slate-150 px-2 py-0.5 rounded-lg">点击长尾词一键追加</span>
                            </div>
                            <div className="overflow-x-auto">
                              <table className="w-full text-left text-sm border-collapse">
                                <thead>
                                  <tr className="text-slate-500 font-bold border-b border-slate-200 text-xs pb-2">
                                    <th className="pb-3 font-bold min-w-[220px]">推荐长尾词</th>
                                    <th className="pb-3 font-bold text-right min-w-[100px]">平均每月搜索量</th>
                                    <th className="pb-3 font-bold text-center min-w-[80px]">竞争度</th>
                                    <th className="pb-3 font-bold text-center min-w-[150px]">首页竞价</th>
                                    <th className="pb-3 font-bold text-right min-w-[140px]">三个月的变化趋势</th>
                                  </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                  {keywordRecommendations.map((item, index) => {
                                    const isIncluded = newTopic.keywords.split(',').map(s => s.trim().toLowerCase()).includes(item.keyword.trim().toLowerCase());
                                    return (
                                      <tr 
                                        key={index} 
                                        onClick={() => handleApplyKeyword(item.keyword)}
                                        className={`cursor-pointer hover:bg-slate-50/80 group transition-colors ${isIncluded ? 'opacity-65' : ''}`}
                                      >
                                        <td className="py-3 font-semibold text-slate-800 flex items-center gap-2 pr-4 whitespace-normal break-words">
                                          <span className="group-hover:text-blue-600 transition-colors text-sm">
                                            {item.keyword}
                                          </span>
                                          {isIncluded ? (
                                            <span className="text-[10px] bg-green-50 text-green-600 px-2 py-0.5 rounded font-bold shrink-0">已追加</span>
                                          ) : (
                                            <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded font-bold opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                              追加
                                            </span>
                                          )}
                                        </td>
                                        <td className="py-3 text-right font-mono font-bold text-slate-600 text-sm">
                                          {item.searchVolume >= 1000 ? `${(item.searchVolume / 1000).toFixed(1)}k` : item.searchVolume}
                                        </td>
                                        <td className="py-3 text-center">
                                          {(() => {
                                            const compLower = item.competition?.toLowerCase();
                                            const isLow = compLower === '低' || compLower === 'low';
                                            const isMid = compLower === '中' || compLower === 'medium' || compLower === 'mid';
                                            const isHigh = compLower === '高' || compLower === 'high';
                                            const label = isLow ? '低' : isMid ? '中' : isHigh ? '高' : (item.competition || '低');
                                            
                                            return (
                                              <span className={`px-2 py-0.5 rounded text-xs font-bold ${
                                                isLow ? 'bg-green-50 text-green-600' :
                                                isMid ? 'bg-blue-50 text-blue-700' :
                                                'bg-orange-50 text-orange-700'
                                              }`}>
                                                {label}
                                              </span>
                                            );
                                          })()}
                                        </td>
                                        <td className="py-3 text-center font-mono text-slate-600 text-sm">{item.cpc || '-'}</td>
                                        <td className="py-3 text-right">
                                          {(() => {
                                            if (item.threeMonthTrend && Array.isArray(item.threeMonthTrend) && item.threeMonthTrend.length >= 2) {
                                              const points = item.threeMonthTrend;
                                              const startVal = points[0];
                                              const endVal = points[points.length - 1];
                                              let percentChange = 0;
                                              if (startVal > 0) {
                                                percentChange = ((endVal - startVal) / startVal) * 100;
                                              } else if (endVal > 0) {
                                                percentChange = 100;
                                              }
                                              
                                              const isUp = percentChange > 0;
                                              const isDown = percentChange < 0;
                                              const formatted = `${percentChange > 0 ? '+' : ''}${percentChange.toFixed(1)}%`;
                                              
                                              return (
                                                <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                                                  <span className={`font-mono text-xs font-bold px-2 py-0.5 rounded-md ${
                                                    isUp ? 'text-green-600 bg-green-50' :
                                                    isDown ? 'text-red-500 bg-red-50' :
                                                    'text-slate-500 bg-slate-50'
                                                  }`}>
                                                    {isUp && '↑ '}{isDown && '↓ '}{formatted}
                                                  </span>
                                                </div>
                                              );
                                            }
                                            
                                            if (item.relevance !== undefined) {
                                              return (
                                                <div className="flex items-center justify-end gap-2">
                                                  <div className="w-12 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                                                    <div className="bg-blue-500 h-full rounded-full" style={{ width: `${item.relevance}%` }}></div>
                                                  </div>
                                                  <span className="font-mono text-slate-600 text-xs font-semibold">{item.relevance}%</span>
                                                </div>
                                              );
                                            }
                                            
                                            return <span className="text-slate-400 text-xs">-</span>;
                                          })()}
                                        </td>
                                      </tr>
                                    );
                                  })}
                                </tbody>
                              </table>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Step 2: Product and Page Selectors */}
                    <div className="bg-slate-50/50 border border-slate-150 rounded-2xl p-4 md:p-5 space-y-4">
                      <div className="flex items-center gap-2 pb-2 border-b border-slate-100">
                        <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 text-xs font-bold flex items-center justify-center">2</span>
                        <span className="font-bold text-slate-800 text-sm">选择目标关联的商品和承接页面</span>
                      </div>

                      <div className="grid grid-cols-2 gap-4">
                        {/* Products Dropdown */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500">关联商品 (可多选)</label>
                          <div className="relative" ref={productDropdownRef}>
                            <div 
                              onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
                              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all cursor-pointer flex items-center justify-between"
                            >
                              <span className="text-sm text-slate-600 truncate">
                                {newTopic.targetProductIds.length > 0 
                                  ? `已选择 ${newTopic.targetProductIds.length} 个商品` 
                                  : '选择关联商品...'}
                              </span>
                              <ICONS.ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isProductDropdownOpen ? 'rotate-180' : ''}`} />
                            </div>

                            <AnimatePresence>
                              {isProductDropdownOpen && (
                                <motion.div 
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 10 }}
                                  className="absolute z-[60] left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden"
                                >
                                  <div className="p-2.5 border-b border-slate-100 bg-slate-50">
                                    <div className="relative">
                                      <ICONS.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                      <input 
                                        type="text"
                                        value={productSearch}
                                        onChange={(e) => setProductSearch(e.target.value)}
                                        placeholder="搜索商品..."
                                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    </div>
                                  </div>
                                  <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                                    {products.filter(p => 
                                      p.title.toLowerCase().includes(productSearch.toLowerCase())
                                    ).map(p => (
                                      <label key={p.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-all">
                                        <input 
                                          type="checkbox"
                                          checked={newTopic.targetProductIds.includes(p.id)}
                                          onChange={(e) => {
                                            const ids = e.target.checked 
                                              ? [...newTopic.targetProductIds, p.id]
                                              : newTopic.targetProductIds.filter(id => id !== p.id);
                                            setNewTopic({ ...newTopic, targetProductIds: ids });
                                          }}
                                          className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                        />
                                        <span className="text-xs text-slate-700 truncate">{p.title}</span>
                                      </label>
                                    ))}
                                    {products.filter(p => p.title.toLowerCase().includes(productSearch.toLowerCase())).length === 0 && (
                                      <div className="p-4 text-center text-xs text-slate-400">未找到匹配商品</div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* Interactive Product Chips */}
                          {newTopic.targetProductIds.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {products.filter(p => newTopic.targetProductIds.includes(p.id)).map(p => (
                                <span key={p.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-50 text-blue-700 text-[10px] font-bold rounded-lg border border-blue-100">
                                  <span className="truncate max-w-[140px]">{p.title}</span>
                                  <button 
                                    type="button" 
                                    onClick={() => setNewTopic({ ...newTopic, targetProductIds: newTopic.targetProductIds.filter(id => id !== p.id) })}
                                    className="text-blue-400 hover:text-blue-600 font-bold ml-1 text-[10px] cursor-pointer"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Pages Dropdown */}
                        <div className="space-y-1.5">
                          <label className="text-xs font-bold text-slate-500">承接页面 (可多选)</label>
                          <div className="relative" ref={pageDropdownRef}>
                            <div 
                              onClick={() => setIsPageDropdownOpen(!isPageDropdownOpen)}
                              className="w-full px-4 py-2.5 bg-white border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500/20 outline-none transition-all cursor-pointer flex items-center justify-between"
                            >
                              <span className="text-sm text-slate-600 truncate">
                                {newTopic.targetPageIds.length > 0 
                                  ? `已选择 ${newTopic.targetPageIds.length} 个页面` 
                                  : '选择关联页面...'}
                              </span>
                              <ICONS.ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${isPageDropdownOpen ? 'rotate-180' : ''}`} />
                            </div>

                            <AnimatePresence>
                              {isPageDropdownOpen && (
                                <motion.div 
                                  initial={{ opacity: 0, y: 10 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  exit={{ opacity: 0, y: 10 }}
                                  className="absolute z-[60] left-0 right-0 mt-2 bg-white border border-slate-200 rounded-2xl shadow-xl overflow-hidden"
                                >
                                  <div className="p-2.5 border-b border-slate-100 bg-slate-50">
                                    <div className="relative">
                                      <ICONS.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
                                      <input 
                                        type="text"
                                        value={pageSearch}
                                        onChange={(e) => setPageSearch(e.target.value)}
                                        placeholder="搜索页面..."
                                        className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                                        onClick={(e) => e.stopPropagation()}
                                      />
                                    </div>
                                  </div>
                                  <div className="max-h-48 overflow-y-auto p-2 space-y-1">
                                    {pages.filter(p => 
                                      p.title.toLowerCase().includes(pageSearch.toLowerCase())
                                    ).map(p => (
                                      <label key={p.id} className="flex items-center gap-2 p-2 hover:bg-slate-50 rounded-lg cursor-pointer transition-all">
                                        <input 
                                          type="checkbox"
                                          checked={newTopic.targetPageIds.includes(p.id)}
                                          onChange={(e) => {
                                            const ids = e.target.checked 
                                              ? [...newTopic.targetPageIds, p.id]
                                              : newTopic.targetPageIds.filter(id => id !== p.id);
                                            setNewTopic({ ...newTopic, targetPageIds: ids });
                                          }}
                                          className="rounded text-blue-600 focus:ring-blue-500 w-3.5 h-3.5"
                                        />
                                        <span className="text-xs text-slate-700 truncate">{p.title}</span>
                                      </label>
                                    ))}
                                    {pages.filter(p => p.title.toLowerCase().includes(pageSearch.toLowerCase())).length === 0 && (
                                      <div className="p-4 text-center text-xs text-slate-400">未找到匹配页面</div>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>

                          {/* Interactive Page Chips */}
                          {newTopic.targetPageIds.length > 0 && (
                            <div className="flex flex-wrap gap-1.5 mt-2">
                              {pages.filter(p => newTopic.targetPageIds.includes(p.id)).map(p => (
                                <span key={p.id} className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-50 text-emerald-700 text-[10px] font-bold rounded-lg border border-emerald-100">
                                  <span className="truncate max-w-[140px]">{p.title}</span>
                                  <button 
                                    type="button" 
                                    onClick={() => setNewTopic({ ...newTopic, targetPageIds: newTopic.targetPageIds.filter(id => id !== p.id) })}
                                    className="text-emerald-400 hover:text-emerald-600 font-bold ml-1 text-[10px] cursor-pointer"
                                  >
                                    ×
                                  </button>
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>







              {/* Redesigned Footer Actions */}
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-4 rounded-b-3xl">
                {suggestedManualTopics.length > 0 ? (
                  /* Suggestions Save Footer */
                  <>
                    <button 
                      onClick={() => {
                        setSuggestedManualTopics([]);
                      }}
                      className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-all font-sans cursor-pointer text-center text-sm"
                    >
                      返回修改条件
                    </button>
                    <button 
                      onClick={handleSaveSelectedTopics}
                      disabled={isSavingSelectedTopics || selectedSuggestedIndices.length === 0}
                      className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer text-sm"
                    >
                      {isSavingSelectedTopics ? (
                        <ICONS.Loader className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      <span>确认导入选中选题 ({selectedSuggestedIndices.length} / {suggestedManualTopics.length})</span>
                    </button>
                  </>
                ) : (
                  /* AI Generation Setup Footer */
                  <>
                    <button 
                      onClick={() => {
                        setShowTopicModal(false);
                        setNewTopic({ keywords: '', targetProductIds: [], targetPageIds: [], outline: '' });
                        setProductSearch('');
                        setPageSearch('');
                        setSuggestedManualTopics([]);
                        setKeywordRecommendations(null);
                      }}
                      className="flex-1 px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-all font-sans cursor-pointer text-center text-sm"
                    >
                      取消
                    </button>
                    <button 
                      onClick={handleGenerateManualTopics}
                      disabled={isGeneratingManualTopics || (!newTopic.keywords.trim() && newTopic.targetProductIds.length === 0 && newTopic.targetPageIds.length === 0)}
                      className="flex-1 px-4 py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer text-sm"
                    >
                      {isGeneratingManualTopics ? (
                        <div className="flex items-center gap-2">
                          <ICONS.Loader className="w-4 h-4 animate-spin" />
                          <span>AI 创意深度生成中...</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Sparkles className="w-4 h-4" />
                          <span>AI 智能生成 3 个选题</span>
                        </div>
                      )}
                    </button>
                  </>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEditTopicModal && editingTopic && (
          <div className="fixed inset-0 z-[100000] flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl my-auto"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center rounded-t-3xl bg-white">
                <h3 className="font-bold text-slate-900">编辑博客选题</h3>
                <button onClick={() => {
                  setShowEditTopicModal(false);
                  setEditingTopic(null);
                }} className="text-slate-400 hover:text-slate-600">
                  <ICONS.Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">标题</label>
                  <input 
                    type="text"
                    value={editingTopic.title}
                    onChange={(e) => setEditingTopic({ ...editingTopic, title: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>
                
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">描述</label>
                  <textarea 
                    value={editingTopic.description || ''}
                    onChange={(e) => setEditingTopic({ ...editingTopic, description: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all min-h-[80px] resize-y"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">关键词 (逗号分隔)</label>
                  <input 
                    type="text"
                    value={editingTopic.keywords.join(', ')}
                    onChange={(e) => setEditingTopic({ ...editingTopic, keywords: e.target.value.split(',').map(k => k.trim()).filter(k => k) })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between items-center">
                    <label className="text-xs font-bold text-slate-400 uppercase">博客大纲</label>
                    <div className="flex items-center gap-1 p-1 bg-slate-50 border border-slate-200 rounded-lg">
                      <button 
                        onClick={() => setTopicOutlineMode('edit')}
                        className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${topicOutlineMode === 'edit' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                      >
                        编辑
                      </button>
                      <button 
                        onClick={() => setTopicOutlineMode('preview')}
                        className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all ${topicOutlineMode === 'preview' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                      >
                        预览
                      </button>
                    </div>
                  </div>
                  
                  {topicOutlineMode === 'edit' ? (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-1">
                      <textarea 
                        value={editingTopic.outline || ''}
                        onChange={(e) => setEditingTopic({ ...editingTopic, outline: e.target.value })}
                        className="w-full px-3 py-2 bg-transparent text-sm outline-none min-h-[200px] resize-y font-mono leading-relaxed"
                        placeholder="输入博客大纲，使用缩进或列表表示层级结构..."
                      />
                    </div>
                  ) : (
                    <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 min-h-[200px] max-h-[400px] overflow-y-auto">
                      {editingTopic.outline ? (
                        <div className="flex flex-col gap-2 font-mono text-sm leading-relaxed">
                          {(() => {
                            const lines = editingTopic.outline.split('\n').filter(line => line.trim() !== '');
                            const indentStack: number[] = [-1];
                            const counts: number[] = [0];
                            
                            return lines.map((line, idx) => {
                              const indentMatch = line.match(/^(\s+)/);
                              const indentLevel = indentMatch ? indentMatch[1].length : 0;
                              const cleanLine = line.trim().replace(/^([-*•]|\d+(\.\d+)*[.)]?)\s+/, '');
                              
                              while (indentStack.length > 1 && indentStack[indentStack.length - 1] > indentLevel) {
                                indentStack.pop();
                                counts.pop();
                              }
                              
                              if (indentLevel > indentStack[indentStack.length - 1]) {
                                indentStack.push(indentLevel);
                                counts.push(1);
                              } else {
                                counts[counts.length - 1]++;
                              }
                              
                              const numberStr = counts.slice(1).join('.') + '.';

                              return (
                                <div key={idx} className="flex gap-3" style={{ paddingLeft: `${indentLevel * 12}px` }}>
                                  <span className="text-blue-600 font-bold shrink-0 w-10">{numberStr}</span>
                                  <span className="text-slate-700">{cleanLine}</span>
                                </div>
                              );
                            });
                          })()}
                        </div>
                      ) : (
                        <div className="flex items-center justify-center h-full text-slate-400 text-sm italic">
                          暂无大纲内容
                        </div>
                      )}
                    </div>
                  )}
                  <p className="text-[11px] text-slate-500 mt-1">建议使用清晰的层级结构（如 1., 1.1, - 等）来组织大纲，这有助于 AI 生成更有逻辑的文章。</p>
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 flex gap-4 rounded-b-3xl bg-slate-50">
                <button 
                  onClick={() => {
                    setShowEditTopicModal(false);
                    setEditingTopic(null);
                  }}
                  className="flex-1 px-4 py-2 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-all"
                >
                  取消
                </button>
                <button 
                  onClick={async () => {
                    try {
                      await updateDoc(doc(db, 'blogTopics', editingTopic.id), cleanObject({
                        title: editingTopic.title,
                        description: editingTopic.description,
                        keywords: editingTopic.keywords,
                        outline: editingTopic.outline,
                        updatedAt: new Date().toISOString()
                      }));
                      setStatusMessage({ type: 'success', text: '选题已更新' });
                      setShowEditTopicModal(false);
                      setEditingTopic(null);
                    } catch (err) {
                      handleLocalFirestoreError(err, OperationType.UPDATE, `blogTopics/${editingTopic.id}`);
                    }
                  }}
                  className="flex-1 px-4 py-2 bg-blue-50 text-blue-600 rounded-xl font-bold hover:bg-blue-100 transition-all flex items-center justify-center gap-2"
                >
                  <ICONS.Check className="w-4 h-4" />
                  保存修改
                </button>
                <button 
                  onClick={async () => {
                    try {
                      await updateDoc(doc(db, 'blogTopics', editingTopic.id), cleanObject({
                        title: editingTopic.title,
                        description: editingTopic.description,
                        keywords: editingTopic.keywords,
                        outline: editingTopic.outline,
                        updatedAt: new Date().toISOString()
                      }));
                      setShowEditTopicModal(false);
                      setEditingTopic(null);
                      handleCreateTask(editingTopic);
                    } catch (err) {
                      handleLocalFirestoreError(err, OperationType.UPDATE, `blogTopics/${editingTopic.id}`);
                    }
                  }}
                  disabled={isCreatingTask === editingTopic.id || getTopicStatus(editingTopic) === '已生成'}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isCreatingTask === editingTopic.id ? (
                    <ICONS.Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <ICONS.Zap className="w-4 h-4" />
                  )}
                  保存并生成博客
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );

  const renderTasks = () => (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">选题标题</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">创建时间</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasksToProcessList.map((task) => (
              <tr key={task.id} className="group hover:bg-slate-50/50 transition-all">
                <td className="px-6 py-4">
                  {task.status === '已完成' ? (
                    <button
                      onClick={() => setEditingTask(task)}
                      className="font-bold text-slate-900 hover:text-blue-600 transition-colors cursor-pointer text-left focus:outline-none flex items-center gap-1.5"
                    >
                      <span>{task.result?.title || task.topicTitle}</span>
                    </button>
                  ) : (
                    <div className="font-bold text-slate-900">{task.topicTitle}</div>
                  )}
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  {new Date(task.createdAt).toLocaleString()}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end items-center gap-2">
                    {task.status === '已完成' ? (
                      <>
                        <button 
                          onClick={() => setEditingTask(task)}
                          className="px-2.5 py-1 text-xs font-bold text-indigo-600 hover:bg-indigo-50 border border-indigo-200/60 rounded-lg transition-all flex items-center gap-1 inline-flex cursor-pointer"
                          title="编辑博客内容"
                        >
                          <ICONS.Edit className="w-3.5 h-3.5" />
                          编辑
                        </button>
                        {task.resultBlogId && (
                          <button 
                            onClick={() => {
                              const url = `${window.location.origin}${window.location.pathname}?editType=blog&editId=${task.resultBlogId}`;
                              window.open(url, '_blank');
                            }}
                            className="px-2.5 py-1 text-xs font-bold text-blue-600 hover:bg-blue-50 border border-blue-200/60 rounded-lg transition-all flex items-center gap-1 inline-flex cursor-pointer"
                            title="在新窗口查看博客详情"
                          >
                            <ICONS.Eye className="w-3.5 h-3.5" />
                            查看
                          </button>
                        )}
                      </>
                    ) : (
                      task.status === '执行中' ? (
                        <span className="text-xs text-blue-600 font-bold flex items-center gap-1">
                          <ICONS.Loader className="w-3.5 h-3.5 animate-spin" />
                          生成中
                        </span>
                      ) : (
                        <span className="text-xs text-slate-400 font-bold">
                          {task.status === '失败' ? '已失败' : '排队中'}
                        </span>
                      )
                    )}
                    <button 
                      onClick={async () => {
                        try {
                          await deleteDoc(doc(db, 'blogTasks', task.id));
                          setStatusMessage({ type: 'success', text: '博客已删除' });
                        } catch (err) {
                          handleLocalFirestoreError(err, OperationType.DELETE, `blogTasks/${task.id}`);
                        }
                      }}
                      className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <ICONS.Trash className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

    </div>
  );

  const renderEditBlogSection = () => {
    if (!editingTask) return null;

    const rebuildSchemaJsonLd = (task: BlogTask): BlogTask => {
      if (!task.result) return task;
      
      const graph: any[] = [];
      const slug = task.result.seoUrl || '';
      const domain = typeof window !== 'undefined' ? window.location.origin : 'https://example.com';
      const canonicalUrl = `${domain}/blogs/${slug}`;
      
      // 1. Core Blog Article Schema
      const blogPosting: any = {
        "@type": "BlogPosting",
        "@id": `${canonicalUrl}#article`,
        "headline": task.result.seoTitle || task.result.title || "",
        "description": task.result.seoDescription || "",
        "image": task.result.imageUrl || "",
        "datePublished": task.scheduledAt || task.createdAt || new Date().toISOString(),
        "dateModified": new Date().toISOString(),
        "author": {
          "@type": "Person",
          "name": "Admin"
        },
        "publisher": {
          "@type": "Organization",
          "name": brandName || "SaaS Merchant",
          "logo": {
            "@type": "ImageObject",
            "url": task.result.imageUrl || ""
          }
        },
        "mainEntityOfPage": {
          "@type": "WebPage",
          "@id": canonicalUrl
        }
      };
      graph.push(blogPosting);

      // 2. FAQ Schema if enabled
      if (task.result.faqEnabled && task.result.faqItems && task.result.faqItems.length > 0) {
        const faqPages = {
          "@type": "FAQPage",
          "@id": `${canonicalUrl}#faq`,
          "mainEntity": task.result.faqItems.map((item: any) => ({
            "@type": "Question",
            "name": item.question || "",
            "acceptedAnswer": {
              "@type": "Answer",
              "text": item.answer || ""
            }
          }))
        };
        graph.push(faqPages);
      }

      // 3. How To Schema if enabled
      if (task.result.howToEnabled) {
        const steps = task.result.howToSteps || [];
        if (steps.length > 0) {
          const howToSchema: any = {
            "@type": "HowTo",
            "@id": `${canonicalUrl}#howto`,
            "name": task.result.howToName || task.result.title || "How to Guide",
            "description": task.result.howToDescription || task.result.seoDescription || "",
            "step": steps.map((step: any, idx: number) => ({
              "@type": "HowToStep",
              "position": idx + 1,
              "name": step.name || `Step ${idx + 1}`,
              "text": step.text || ""
            }))
          };
          if (task.result.howToDuration) {
            howToSchema.totalTime = task.result.howToDuration;
          }
          graph.push(howToSchema);
        }
      }

      const jsonLdObj = {
        "@context": "https://schema.org",
        "@graph": graph
      };

      return {
        ...task,
        result: {
          ...task.result,
          jsonLd: JSON.stringify(jsonLdObj, null, 2)
        }
      };
    };

    const getProcessedContent = (result: any) => {
      let finalContent = result.content || '';
      
      // 1. Clean up existing FAQ appending pattern if any
      const faqIndex = finalContent.indexOf('### 常见问题解答 (FAQ)');
      if (faqIndex !== -1) {
        finalContent = finalContent.substring(0, faqIndex).trim();
      }
      
      // 2. Clean up existing How-To appending pattern if any
      const howToName = result.howToName || '使用指南';
      const howToIndex = finalContent.indexOf(`### ${howToName}`);
      if (howToIndex !== -1) {
        finalContent = finalContent.substring(0, howToIndex).trim();
      } else {
        const genericHowToIndex = finalContent.indexOf('### 使用指南');
        if (genericHowToIndex !== -1) {
          finalContent = finalContent.substring(0, genericHowToIndex).trim();
        }
      }

      // 3. Now append fresh FAQ if enabled and has items
      if (result.faqEnabled && result.faqItems && result.faqItems.length > 0) {
        let faqText = `\n\n### 常见问题解答 (FAQ)\n\n`;
        result.faqItems.forEach((item: any) => {
          if (item.question || item.answer) {
            faqText += `**Q: ${item.question || '（问题）'}**\n\n${item.answer || '（解答）'}\n\n`;
          }
        });
        finalContent = finalContent.trim() + faqText;
      }

      // 4. Now append fresh How-To if enabled and has steps
      if (result.howToEnabled && result.howToSteps && result.howToSteps.length > 0) {
        let howToText = `\n\n### ${howToName}\n\n`;
        if (result.howToDescription) {
          howToText += `*${result.howToDescription}*\n\n`;
        }
        result.howToSteps.forEach((step: any, idx: number) => {
          if (step.name || step.text) {
            howToText += `**步骤 ${idx + 1}: ${step.name || '步骤名称'}**\n\n${step.text || '步骤说明'}\n\n`;
          }
        });
        finalContent = finalContent.trim() + howToText;
      }

      return finalContent;
    };

    const handleGenerateFAQ = async () => {
      const content = editingTask.result?.content;
      if (!content || content.trim().length === 0) {
        setStatusMessage({ type: 'error', text: '请先撰写或生成博客正文内容' });
        return;
      }

      setIsGeneratingFAQ(true);
      try {
        const lang = targetLanguage || 'Chinese';
        const res = await geminiService.generateBlogFAQ(content, lang);
        if (res && res.faqItems && res.faqItems.length > 0) {
          const updated = { ...editingTask };
          if (updated.result) {
            updated.result.faqItems = res.faqItems;
            updated.result.faqEnabled = true;
            setEditingTask(rebuildSchemaJsonLd(updated));
            setStatusMessage({ type: 'success', text: 'FAQ 常见问题解答已通过 AI 生成并成功更新！' });
          }
        } else {
          setStatusMessage({ type: 'error', text: 'AI 生成 FAQ 失败，请重试' });
        }
      } catch (err) {
        console.error(err);
        setStatusMessage({ type: 'error', text: 'AI 生成 FAQ 出错，请重试' });
      } finally {
        setIsGeneratingFAQ(false);
      }
    };

    const handleGenerateHowTo = async () => {
      const content = editingTask.result?.content;
      if (!content || content.trim().length === 0) {
        setStatusMessage({ type: 'error', text: '请先撰写或生成博客正文内容' });
        return;
      }

      setIsGeneratingHowTo(true);
      try {
        const lang = targetLanguage || 'Chinese';
        const res = await geminiService.generateBlogHowTo(content, lang);
        if (res) {
          const updated = { ...editingTask };
          if (updated.result) {
            updated.result.howToName = res.howToName || updated.result.title || '';
            updated.result.howToDescription = res.howToDescription || updated.result.seoDescription || '';
            updated.result.howToDuration = res.howToDuration || 'PT15M';
            updated.result.howToSteps = res.howToSteps || [];
            updated.result.howToEnabled = true;
            setEditingTask(rebuildSchemaJsonLd(updated));
            setStatusMessage({ type: 'success', text: 'How-To 操作指南已通过 AI 生成并成功更新！' });
          }
        } else {
          setStatusMessage({ type: 'error', text: 'AI 生成操作指南失败，请重试' });
        }
      } catch (err) {
        console.error(err);
        setStatusMessage({ type: 'error', text: 'AI 生成操作指南出错，请重试' });
      } finally {
        setIsGeneratingHowTo(false);
      }
    };

    const handleSaveDraft = async () => {
      if (editingTask && editingTask.result) {
        try {
          let finalImageUrl = editingTask.result.imageUrl;
          
          if (finalImageUrl && finalImageUrl.startsWith('data:')) {
            finalImageUrl = await uploadBase64Image(finalImageUrl, `blog-tasks/${editingTask.id}/final-${Date.now()}.png`);
          }

          const processedContent = getProcessedContent(editingTask.result);
          const resultToSave = {
            ...editingTask.result,
            content: processedContent,
            imageUrl: finalImageUrl
          };

          const currentTaskSnap = tasks.find(t => t.id === editingTask.id);
          const prevResult = currentTaskSnap?.result;
          let newHistory = editingTask.history || [];
          
          if (prevResult) {
            const historyEntry = {
              ...prevResult,
              updatedAt: new Date().toISOString()
            };
            newHistory = [historyEntry, ...newHistory].slice(0, 10);
          }

          await updateDoc(doc(db, 'blogTasks', editingTask.id), cleanObject({
            result: resultToSave,
            history: newHistory,
            scheduledAt: editingTask.scheduledAt,
            updatedAt: new Date().toISOString()
          }));

          setEditingTask(null);
          setStatusMessage({ type: 'success', text: '草稿已保存' });
        } catch (error) {
          console.error('Failed to save draft:', error);
          setStatusMessage({ type: 'error', text: '保存失败' });
        }
      }
    };

    const handlePublish = async () => {
      if (editingTask && editingTask.result) {
        try {
          let finalImageUrl = editingTask.result.imageUrl;
          
          if (finalImageUrl && finalImageUrl.startsWith('data:')) {
            finalImageUrl = await uploadBase64Image(finalImageUrl, `blog-tasks/${editingTask.id}/final-${Date.now()}.png`);
          }

          const processedContent = getProcessedContent(editingTask.result);
          const resultToSave = {
            ...editingTask.result,
            content: processedContent,
            imageUrl: finalImageUrl
          };

          const currentTaskSnap = tasks.find(t => t.id === editingTask.id);
          const prevResult = currentTaskSnap?.result;
          let newHistory = editingTask.history || [];
          
          if (prevResult) {
            const historyEntry = {
              ...prevResult,
              updatedAt: new Date().toISOString()
            };
            newHistory = [historyEntry, ...newHistory].slice(0, 10);
          }

          let blogId = editingTask.resultBlogId;
          const blogData = {
            title: resultToSave.title,
            content: resultToSave.content,
            image: resultToSave.imageUrl,
            seoTitle: resultToSave.seoTitle,
            seoDescription: resultToSave.seoDescription,
            keywords: resultToSave.keywords,
            jsonLd: resultToSave.jsonLd,
            seoUrl: resultToSave.seoUrl || '',
            status: editingTask.scheduledAt && new Date(editingTask.scheduledAt) > new Date() ? '草稿' : '已发布',
            scheduledAt: editingTask.scheduledAt || new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          if (blogId) {
            await updateDoc(doc(db, 'blogs', blogId), cleanObject(blogData));
          } else {
            const blogRef = await addDoc(collection(db, 'blogs'), cleanObject({
              ...blogData,
              createdAt: new Date().toISOString()
            }));
            blogId = blogRef.id;
          }

          await updateDoc(doc(db, 'blogTasks', editingTask.id), cleanObject({
            result: resultToSave,
            history: newHistory,
            resultBlogId: blogId,
            status: '已完成',
            updatedAt: new Date().toISOString()
          }));

          setEditingTask(null);
          setStatusMessage({ type: 'success', text: '博客已发布！' });
        } catch (error) {
          console.error('Failed to publish blog:', error);
          setStatusMessage({ type: 'error', text: '发布失败，请检查网络或重试' });
        }
      }
    };

    editActionsRef.current = {
      publish: handlePublish,
      cancel: () => setEditingTask(null)
    };

    return (
      <div className="space-y-6">
        {/* History Slide-over */}
        <AnimatePresence>
          {showHistory && (
            <>
              {/* Overlay Backdrop */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.3 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black z-[100]"
                onClick={() => setShowHistory(false)}
              />
              <motion.div 
                initial={{ opacity: 0, x: '100%' }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: '100%' }}
                className="fixed top-0 right-0 h-full w-full max-w-md bg-white shadow-2xl z-[110] border-l border-slate-200 flex flex-col"
              >
                <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div className="flex items-center gap-2">
                    <ICONS.History className="w-5 h-5 text-slate-700" />
                    <h3 className="font-bold text-slate-900">历史版本</h3>
                  </div>
                  <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-full transition-colors">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  </button>
                </div>
                
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {(!editingTask.history || editingTask.history.length === 0) ? (
                    <div className="text-center py-12">
                      <ICONS.History className="w-12 h-12 text-slate-200 mx-auto mb-3" />
                      <p className="text-sm text-slate-400">暂无历史记录</p>
                    </div>
                  ) : (
                    editingTask.history.map((entry, idx) => (
                      <div 
                        key={idx}
                        className="p-4 bg-slate-50 rounded-xl border border-slate-100 hover:border-blue-200 transition-all cursor-pointer group"
                        onClick={() => {
                          if (window.confirm('确定要还原到此版本吗？当前未保存的修改将丢失。')) {
                            const updated = { ...editingTask };
                            updated.result = {
                              title: entry.title,
                              content: entry.content,
                              imageUrl: entry.imageUrl,
                              seoTitle: entry.seoTitle,
                              seoDescription: entry.seoDescription,
                              keywords: entry.keywords,
                              seoUrl: entry.seoUrl || '',
                              jsonLd: entry.jsonLd
                            };
                            setEditingTask(updated);
                            setShowHistory(false);
                          }
                        }}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                            版本 {editingTask.history!.length - idx}
                          </span>
                          <span className="text-[11px] text-slate-400">
                            {new Date(entry.updatedAt).toLocaleString()}
                          </span>
                        </div>
                        <div className="text-xs font-bold text-slate-700 line-clamp-1 mb-1">{entry.title}</div>
                        <div className="text-[11px] text-slate-400 line-clamp-2">{entry.content}</div>
                        <div className="mt-3 opacity-0 group-hover:opacity-100 transition-all text-[11px] font-bold text-blue-600 flex items-center gap-1">
                          <ICONS.RefreshCw className="w-3 h-3" /> 点击还原
                        </div>
                      </div>
                    ))
                  )}
                </div>
                <div className="p-6 border-t border-slate-100 bg-slate-50">
                  <button 
                    onClick={() => setShowHistory(false)}
                    className="w-full py-2.5 bg-slate-950 text-white rounded-xl font-bold text-xs hover:bg-slate-900 transition-colors shadow-md shadow-slate-200"
                  >
                    关闭
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Outer Layout 3-column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column: Forms and Content */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-8 space-y-6">
              {/* Title Input */}
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 text-slate-600">文章标题<span className="text-red-500">*</span></label>
                <input 
                  type="text"
                  value={editingTask.result?.title || ''}
                  onChange={(e) => {
                    const updated = { ...editingTask };
                    if (updated.result) updated.result.title = e.target.value;
                    setEditingTask(updated);
                  }}
                  className="w-full px-4 py-2 bg-slate-50/50 border border-slate-200 focus:border-blue-500 rounded-xl px-4 py-3 outline-none text-sm transition-all text-slate-900 font-bold"
                  placeholder="请输入文章标题"
                />
              </div>
              {/* Content Markup Editor with rich toolbars */}
              <div className="space-y-4 border-t border-slate-100 pt-6">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">正文内容<span className="text-red-500">*</span></label>
                  <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                    <button 
                      type="button"
                      onClick={() => setPreviewMode('edit')}
                      className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${previewMode === 'edit' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      编辑
                    </button>
                    <button 
                      type="button"
                      onClick={() => setPreviewMode('preview')}
                      className={`px-3 py-1 text-[11px] font-bold rounded-md transition-all cursor-pointer ${previewMode === 'preview' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                    >
                      预览
                    </button>
                  </div>
                </div>

                <div className="border border-slate-200 rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/20 transition-all bg-white">
                  {previewMode === 'edit' && (
                    <div className="bg-slate-50 p-2 border-b border-slate-200 flex flex-wrap gap-1.5 items-center">
                      <button 
                        type="button"
                        onClick={() => insertMarkdown('# ')}
                        className="p-1 px-2 hover:bg-slate-200 rounded text-xs font-semibold text-slate-600 flex items-center gap-0.5 cursor-pointer"
                        title="一级标题"
                      >
                        <ICONS.Heading className="w-3.5 h-3.5" />1
                      </button>
                      <button 
                        type="button"
                        onClick={() => insertMarkdown('## ')}
                        className="p-1 px-2 hover:bg-slate-200 rounded text-xs font-semibold text-slate-600 flex items-center gap-0.5 cursor-pointer"
                        title="二级标题"
                      >
                        <ICONS.Heading className="w-3.5 h-3.5" />2
                      </button>
                      <button 
                        type="button"
                        onClick={() => insertMarkdown('### ')}
                        className="p-1 px-2 hover:bg-slate-200 rounded text-xs font-semibold text-slate-600 flex items-center gap-0.5 cursor-pointer"
                        title="三级标题"
                      >
                        <ICONS.Heading className="w-3.5 h-3.5" />3
                      </button>
                      <div className="w-px h-4 bg-slate-300 mx-1" />
                      <button 
                        type="button"
                        onClick={() => insertMarkdown('**', '**')}
                        className="p-1.5 hover:bg-slate-200 rounded text-slate-600 cursor-pointer"
                        title="加粗"
                      >
                        <ICONS.Bold className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        type="button"
                        onClick={() => insertMarkdown('*', '*')}
                        className="p-1.5 hover:bg-slate-200 rounded text-slate-600 cursor-pointer"
                        title="斜体"
                      >
                        <ICONS.Italic className="w-3.5 h-3.5" />
                      </button>
                      <div className="w-px h-4 bg-slate-300 mx-1" />
                      <button 
                        type="button"
                        onClick={() => insertMarkdown('[', '](url)')}
                        className="p-1.5 hover:bg-slate-200 rounded text-slate-600 cursor-pointer"
                        title="插入链接"
                      >
                        <ICONS.Link className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        type="button"
                        onClick={() => insertMarkdown('- ')}
                        className="p-1.5 hover:bg-slate-200 rounded text-slate-600 cursor-pointer"
                        title="无序列表"
                      >
                        <ICONS.List className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        type="button"
                        onClick={() => insertMarkdown('> ')}
                        className="p-1.5 hover:bg-slate-200 rounded text-slate-600 cursor-pointer"
                        title="引用"
                      >
                        <ICONS.Quote className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        type="button"
                        onClick={() => insertMarkdown('`', '`')}
                        className="p-1.5 hover:bg-slate-200 rounded text-slate-600 cursor-pointer"
                        title="行内代码"
                      >
                        <ICONS.Code className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}

                  {previewMode === 'edit' ? (
                    <textarea 
                      ref={contentTextareaRef}
                      value={editingTask.result?.content || ''}
                      onChange={(e) => {
                        const updated = { ...editingTask };
                        if (updated.result) updated.result.content = e.target.value;
                        setEditingTask(updated);
                      }}
                      className="w-full px-4 py-3 outline-none resize-none text-sm leading-relaxed min-h-[450px] font-mono bg-slate-50/20"
                      placeholder="使用 Markdown 语法进行撰写或修改文章内容..."
                    />
                  ) : (
                    <div className="w-full min-h-[450px] max-h-[600px] overflow-y-auto px-8 py-6 prose prose-slate max-w-none prose-headings:font-bold prose-h1:text-2xl prose-h1:mb-6 prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3 prose-p:text-slate-700 prose-p:leading-relaxed prose-p:mb-5 prose-ul:my-4 prose-li:mb-2 prose-a:text-blue-600 hover:prose-a:text-blue-700">
                      <ReactMarkdown remarkPlugins={[remarkGfm]}>
                        {editingTask.result?.content || ''}
                      </ReactMarkdown>

                      {/* Live Rendering for FAQ items */}
                      {editingTask.result?.faqEnabled && editingTask.result?.faqItems && editingTask.result?.faqItems.length > 0 && (
                        <div className="mt-8 pt-8 border-t border-slate-200 !max-w-none not-prose">
                          <h3 className="text-base font-black text-slate-800 mb-4 flex items-center gap-2">
                            <span className="p-1 px-2 bg-amber-50 text-amber-600 rounded text-xs">FAQ</span>
                            常见问题解答 (FAQ)
                          </h3>
                          <div className="space-y-4">
                            {editingTask.result.faqItems.map((item: any, idx: number) => (
                              <div key={idx} className="bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <h4 className="font-bold text-slate-900 text-sm mb-1.5 flex items-start gap-2">
                                  <span className="text-amber-500 font-extrabold text-sm">Q:</span>
                                  <span>{item.question || '（未填写问题）'}</span>
                                </h4>
                                <p className="text-slate-600 text-xs leading-relaxed pl-6 border-l border-amber-500/20">
                                  {item.answer || '（未填写解答描述）'}
                                </p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Live Rendering for How-To content */}
                      {editingTask.result?.howToEnabled && editingTask.result?.howToSteps && editingTask.result?.howToSteps.length > 0 && (
                        <div className="mt-10 pt-8 border-t border-slate-200 !max-w-none not-prose">
                          <h3 className="text-base font-black text-slate-800 mb-2 flex items-center gap-2">
                            <span className="p-1 px-2 bg-purple-50 text-purple-600 rounded text-xs">HowTo</span>
                            <span>{editingTask.result.howToName || '操作指南 (HowTo)'}</span>
                          </h3>
                          {editingTask.result.howToDescription && (
                            <p className="text-slate-500 text-xs mb-5 italic">{editingTask.result.howToDescription}</p>
                          )}
                          <div className="space-y-4">
                            {editingTask.result.howToSteps.map((step: any, idx: number) => (
                              <div key={idx} className="flex gap-4 items-start bg-slate-50 rounded-xl p-4 border border-slate-100">
                                <div className="w-6 h-6 rounded-full bg-purple-100 flex items-center justify-center text-xs font-bold text-purple-600 shrink-0">
                                  {idx + 1}
                                </div>
                                <div className="space-y-1">
                                  <h4 className="font-bold text-slate-900 text-sm">{step.name || `步骤 ${idx + 1}`}</h4>
                                  <p className="text-slate-600 text-xs leading-relaxed">{step.text || '（未填写步骤详情）'}</p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>

  
            {/* Advanced Schema Settings: FAQ & HowTo */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-8 space-y-6">
              <div className="flex items-center justify-between border-b border-slate-100 pb-4">
                <div className="space-y-1">
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                    SEO 增强 Schema
                  </h3>
                  <p className="text-xs text-slate-400">配置高阶搜索引擎结构化数据模块，极大提升 Google 搜索结果卡片曝光率与点击率</p>
                </div>
              </div>

              {/* FAQ Schema Subsection */}
              <div className="space-y-4 border-b border-slate-100 pb-6">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <HelpCircle className="w-4 h-4 text-amber-500" />
                      <span className="text-sm font-bold text-slate-700">FAQ 常见问题解答 Schema</span>
                    </div>
                    <p className="text-[11px] text-slate-400">向页面注入 FAQPage 结构化脚本。Google 会在搜索结果中直接展开对应的问答折叠框</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={!!editingTask.result?.faqEnabled} 
                      onChange={() => {
                        const updated = { ...editingTask };
                        if (updated.result) {
                          updated.result.faqEnabled = !updated.result.faqEnabled;
                          if (updated.result.faqEnabled && (!updated.result.faqItems || updated.result.faqItems.length === 0)) {
                            updated.result.faqItems = [{ question: '', answer: '' }];
                          }
                          setEditingTask(rebuildSchemaJsonLd(updated));
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                  </label>
                </div>

                {editingTask.result?.faqEnabled && (
                  <div className="space-y-4 bg-slate-50/70 p-4 rounded-xl border border-slate-100">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-slate-500">配置 FAQ 常见问题解答条目</span>
                      <button 
                        type="button"
                        onClick={handleGenerateFAQ}
                        disabled={isGeneratingFAQ}
                        className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-xs cursor-pointer hover:bg-slate-50 disabled:opacity-50"
                      >
                        <Sparkles className={`w-3 h-3 ${isGeneratingFAQ ? 'animate-spin' : ''}`} />
                        <span>{isGeneratingFAQ ? 'AI 生成中...' : 'AI 根据内容生成问答'}</span>
                      </button>
                    </div>

                    <div className="space-y-3">
                      {(editingTask.result?.faqItems || []).map((faq, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-2 relative group">
                          <button
                            type="button"
                            onClick={() => {
                              const updated = { ...editingTask };
                              if (updated.result && updated.result.faqItems) {
                                updated.result.faqItems = updated.result.faqItems.filter((_, i) => i !== idx);
                                setEditingTask(rebuildSchemaJsonLd(updated));
                              }
                            }}
                            className="absolute top-2 right-2 text-slate-300 hover:text-red-500 p-1 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                            title="删除此项 FAQ"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <div className="space-y-1 pr-6">
                            <span className="text-[10px] font-extrabold text-blue-600 uppercase tracking-wide">问题 {idx + 1}</span>
                            <input 
                              type="text"
                              value={faq.question}
                              onChange={(e) => {
                                const updated = { ...editingTask };
                                if (updated.result && updated.result.faqItems) {
                                  const newItems = [...updated.result.faqItems];
                                  newItems[idx] = { ...newItems[idx], question: e.target.value };
                                  updated.result.faqItems = newItems;
                                  setEditingTask(rebuildSchemaJsonLd(updated));
                                }
                              }}
                              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 focus:border-blue-500/50 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500/10 text-slate-800 font-semibold"
                              placeholder="解答什么问题？例如：这款产品适合新手小白吗？"
                            />
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide">解答内容</span>
                            <textarea
                              value={faq.answer}
                              onChange={(e) => {
                                const updated = { ...editingTask };
                                if (updated.result && updated.result.faqItems) {
                                  const newItems = [...updated.result.faqItems];
                                  newItems[idx] = { ...newItems[idx], answer: e.target.value };
                                  updated.result.faqItems = newItems;
                                  setEditingTask(rebuildSchemaJsonLd(updated));
                                }
                              }}
                              className="w-full h-16 px-3 py-1.5 bg-slate-50 border border-slate-100 focus:border-blue-500/50 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500/10 text-slate-600 resize-none"
                              placeholder="详细描述答案..."
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const updated = { ...editingTask };
                        if (updated.result) {
                          const currentItems = updated.result.faqItems || [];
                          updated.result.faqItems = [...currentItems, { question: '', answer: '' }];
                          setEditingTask(rebuildSchemaJsonLd(updated));
                        }
                      }}
                      className="w-full py-2 bg-white border border-dashed border-slate-300 rounded-lg text-xs font-bold text-slate-500 hover:text-blue-600 hover:border-blue-600 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      新增 FAQ 问题与解答
                    </button>
                  </div>
                )}
              </div>

              {/* How-To Schema Subsection */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-purple-500" />
                      <span className="text-sm font-bold text-slate-700">How-To 操作指南 Schema (如何做)</span>
                    </div>
                    <p className="text-[11px] text-slate-400">向页面注入 HowTo 结构化脚本。Google 可能会在搜索中直接展示您的操作指南步骤</p>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={!!editingTask.result?.howToEnabled} 
                      onChange={() => {
                        const updated = { ...editingTask };
                        if (updated.result) {
                          updated.result.howToEnabled = !updated.result.howToEnabled;
                          if (updated.result.howToEnabled) {
                            if (!updated.result.howToName) {
                              updated.result.howToName = updated.result.title || '';
                            }
                            if (!updated.result.howToDescription) {
                              updated.result.howToDescription = updated.result.seoDescription || '';
                            }
                            if (!updated.result.howToSteps || updated.result.howToSteps.length === 0) {
                              updated.result.howToSteps = [{ name: '', text: '' }];
                            }
                          }
                          setEditingTask(rebuildSchemaJsonLd(updated));
                        }
                      }}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-purple-600"></div>
                  </label>
                </div>

                {editingTask.result?.howToEnabled && (
                  <div className="space-y-4 bg-slate-50/70 p-4 rounded-xl border border-slate-100">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs font-bold text-slate-500">配置操作指南基本属性与步骤</span>
                      <button 
                        type="button"
                        onClick={handleGenerateHowTo}
                        disabled={isGeneratingHowTo}
                        className="text-xs text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-xs cursor-pointer hover:bg-slate-50 disabled:opacity-50"
                      >
                        <Sparkles className={`w-3 h-3 ${isGeneratingHowTo ? 'animate-spin' : ''}`} />
                        <span>{isGeneratingHowTo ? 'AI 生成中...' : 'AI 根据内容生成步骤'}</span>
                      </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">指南官方大标题</label>
                        <input 
                          type="text"
                          value={editingTask.result.howToName || ''}
                          onChange={(e) => {
                            const updated = { ...editingTask };
                            if (updated.result) {
                              updated.result.howToName = e.target.value;
                              setEditingTask(rebuildSchemaJsonLd(updated));
                            }
                          }}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none text-slate-800 focus:border-purple-500/50"
                          placeholder="例如：3 步简单掌握页面优化"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">流程总预估耗时</label>
                        <input 
                          type="text"
                          value={editingTask.result.howToDuration || ''}
                          onChange={(e) => {
                            const updated = { ...editingTask };
                            if (updated.result) {
                              updated.result.howToDuration = e.target.value;
                              setEditingTask(rebuildSchemaJsonLd(updated));
                            }
                          }}
                          className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none text-slate-800 focus:border-purple-500/50"
                          placeholder="例如: PT15M (Schema 耗时规范, 即15分钟)"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold text-slate-500 uppercase">指南及操作前叙述</label>
                      <input 
                        type="text"
                        value={editingTask.result.howToDescription || ''}
                        onChange={(e) => {
                          const updated = { ...editingTask };
                          if (updated.result) {
                            updated.result.howToDescription = e.target.value;
                            setEditingTask(rebuildSchemaJsonLd(updated));
                          }
                        }}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none text-slate-600 focus:border-purple-500/50"
                        placeholder="简单描述此流程的背景和优化目的..."
                      />
                    </div>

                    <div className="space-y-3">
                      {(editingTask.result?.howToSteps || []).map((step, idx) => (
                        <div key={idx} className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-2 relative">
                          <button
                            type="button"
                            onClick={() => {
                              const updated = { ...editingTask };
                              if (updated.result && updated.result.howToSteps) {
                                updated.result.howToSteps = updated.result.howToSteps.filter((_, i) => i !== idx);
                                setEditingTask(rebuildSchemaJsonLd(updated));
                              }
                            }}
                            className="absolute top-2 right-2 text-slate-300 hover:text-red-500 p-1 hover:bg-slate-100 rounded transition-colors cursor-pointer"
                            title="删除此步骤"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>

                          <div className="space-y-1 pr-6">
                            <span className="text-[10px] font-extrabold text-purple-600 uppercase tracking-wide">步骤 {idx + 1} 目标</span>
                            <input 
                              type="text"
                              value={step.name}
                              onChange={(e) => {
                                const updated = { ...editingTask };
                                if (updated.result && updated.result.howToSteps) {
                                  const newSteps = [...updated.result.howToSteps];
                                  newSteps[idx] = { ...newSteps[idx], name: e.target.value };
                                  updated.result.howToSteps = newSteps;
                                  setEditingTask(rebuildSchemaJsonLd(updated));
                                }
                              }}
                              className="w-full px-3 py-1.5 bg-slate-50 border border-slate-100 focus:border-purple-500/50 rounded-lg text-xs outline-none focus:ring-1 focus:ring-purple-500/10 text-slate-800 font-semibold"
                              placeholder="该步骤标题，如：开启站长工具验证"
                            />
                          </div>

                          <div className="space-y-1">
                            <span className="text-[10px] font-extrabold text-slate-400 uppercase tracking-wide">详细操作详情</span>
                            <textarea
                              value={step.text}
                              onChange={(e) => {
                                const updated = { ...editingTask };
                                if (updated.result && updated.result.howToSteps) {
                                  const newSteps = [...updated.result.howToSteps];
                                  newSteps[idx] = { ...newSteps[idx], text: e.target.value };
                                  updated.result.howToSteps = newSteps;
                                  setEditingTask(rebuildSchemaJsonLd(updated));
                                }
                              }}
                              className="w-full h-16 px-3 py-1.5 bg-slate-50 border border-slate-100 focus:border-purple-500/50 rounded-lg text-xs outline-none focus:ring-1 focus:ring-purple-500/10 text-slate-600 resize-none"
                              placeholder="详细说明步骤，如：登录站长工具后台，在域名DNS中添加对应的TXT验证记录..."
                            />
                          </div>
                        </div>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        const updated = { ...editingTask };
                        if (updated.result) {
                          const currentSteps = updated.result.howToSteps || [];
                          updated.result.howToSteps = [...currentSteps, { name: '', text: '' }];
                          setEditingTask(rebuildSchemaJsonLd(updated));
                        }
                      }}
                      className="w-full py-2 bg-white border border-dashed border-slate-300 rounded-lg text-xs font-bold text-slate-500 hover:text-purple-600 hover:border-purple-600 transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      新增操作骤指南步骤
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* SEO Section (Placed below main card) */}
            <SEOSection 
              title={editingTask.result?.title || ''}
              content={editingTask.result?.content || ''}
              seoTitle={editingTask.result?.seoTitle || ''}
              seoDescription={editingTask.result?.seoDescription || ''}
              seoUrl={editingTask.result?.seoUrl || ''}
              urlPrefix="/blogs/"
              onUpdate={(updates) => {
                const updated = { ...editingTask };
                if (updated.result) {
                  updated.result = {
                    ...updated.result,
                    ...updates
                  };
                  setEditingTask(rebuildSchemaJsonLd(updated));
                }
              }}
              onManualTitleChange={() => {}}
              onManualUrlChange={() => {}}
            />
          </div>

          {/* Right Column: SEO Assessment Score & Cover Image & Publish Settings */}
          <div className="space-y-6">
            {/* Publication Settings Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">发布时间（留空则不发布）</h3>
              <div className="space-y-3 border-t border-slate-100 pt-3">
                <div className="space-y-1.5">
                  <input 
                    type="datetime-local"
                    value={editingTask.scheduledAt ? new Date(editingTask.scheduledAt).toISOString().slice(0, 16) : ''}
                    min={new Date().toISOString().slice(0, 16)}
                    onChange={(e) => {
                      const selectedDate = e.target.value ? new Date(e.target.value) : null;
                      if (selectedDate && selectedDate < new Date()) {
                        setStatusMessage({ type: 'error', text: '发布时间不能早于当前时间' });
                        return;
                      }
                      const updated = { ...editingTask };
                      updated.scheduledAt = e.target.value ? new Date(e.target.value).toISOString() : new Date().toISOString();
                      setEditingTask(updated);
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500/20 text-slate-700"
                  />
                </div>
                {editingTask.scheduledAt && new Date(editingTask.scheduledAt) > new Date() && (
                  <div className="text-[10px] text-amber-600 bg-amber-50 rounded-lg p-2 flex items-center gap-1.5 border border-amber-100">
                    <ICONS.History className="w-3.5 h-3.5 shrink-0 animate-pulse" />
                    <span>定时任务：将在该指定时间自动发布</span>
                  </div>
                )}
              </div>
            </div>

            {/* Cover Image Selection / Generation Card */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">博客封面图</h3>
              <div className="aspect-video w-full bg-slate-100 rounded-xl overflow-hidden relative group border border-slate-200 shadow-xs">
                {editingTask.result?.imageUrl ? (
                  <img 
                    src={editingTask.result.imageUrl} 
                    alt="Blog Header" 
                    className="w-full h-full object-cover"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-full h-full flex flex-col items-center justify-center text-slate-400 bg-slate-50 gap-2">
                    <ICONS.Image className="w-8 h-8" />
                    <span className="text-xs">暂无封面图片</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-4">
                  <button 
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="p-3 bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/40 transition-all cursor-pointer"
                    title="上传图片"
                  >
                    <ICONS.Upload className="w-5 h-5" />
                  </button>
                  <button 
                    type="button"
                    onClick={() => {
                      setImagePrompt(editingTask.result?.title || '');
                      setIsRegeneratingImage(true);
                    }}
                    className="p-3 bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/40 transition-all cursor-pointer"
                    title="AI 重新生成"
                  >
                    <ICONS.RefreshCw className="w-5 h-5" />
                  </button>
                </div>
                <input 
                  type="file" 
                  ref={imageInputRef} 
                  onChange={handleImageChange} 
                  className="hidden" 
                  accept="image/*" 
                />
                {isUploadingImage && (
                  <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center">
                    <div className="flex flex-col items-center gap-2">
                      <ICONS.Loader className="w-6 h-6 text-blue-600 animate-spin" />
                      <span className="text-xs font-bold text-slate-600">上传中...</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Score Metric Card */}
            {editingTask.result?.score !== undefined && (
              <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">SEO评分</h3>
                <div className="flex items-center gap-4 border-t border-slate-100 pt-3">
                  <div className={`w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold border-2 shrink-0 ${
                    editingTask.result.score >= 90 ? 'border-green-500 text-green-600 bg-green-50' :
                    editingTask.result.score >= 70 ? 'border-blue-500 text-blue-600 bg-blue-50' :
                    'border-orange-500 text-orange-600 bg-orange-50'
                  }`}>
                    {editingTask.result.score}
                  </div>
                  <div>
                    <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">实时评分</div>
                    <div className="text-xs text-slate-600 mt-1 leading-relaxed">{editingTask.result.scoreReason}</div>
                  </div>
                </div>
              </div>
            )}

            {/* AI Generator Panel (shown under image) */}
            {isRegeneratingImage && (
              <motion.div 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-white rounded-xl border border-blue-250 shadow-xs p-6 space-y-4"
              >
                <div className="flex justify-between items-center bg-blue-50/50 p-2 rounded-lg -m-2 mb-2">
                  <h4 className="text-xs font-bold text-blue-900 uppercase tracking-wider flex items-center gap-1.5">
                    <ICONS.Zap className="w-4 h-4 text-indigo-500 animate-pulse" />
                    AI 重新生成封面
                  </h4>
                  <button 
                    type="button"
                    onClick={() => {
                      setIsRegeneratingImage(false);
                      setReferenceImage(null);
                      setImagePrompt('');
                    }}
                    className="text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    <ICONS.Plus className="w-4 h-4 rotate-45" />
                  </button>
                </div>
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">画面描述 (Prompt)</label>
                    <textarea 
                      value={imagePrompt}
                      onChange={(e) => setImagePrompt(e.target.value)}
                      placeholder="描述你想要的博客封面画面内容，例如：极简风的电脑桌面与咖啡杯，商务质感..."
                      className="w-full p-3 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition-all resize-none"
                      rows={3}
                    />
                  </div>
                  
                  <div className="flex items-center gap-4">
                    <div 
                      onClick={() => referenceInputRef.current?.click()}
                      className="w-14 h-14 bg-slate-50 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center cursor-pointer hover:border-blue-400 transition-all relative overflow-hidden shrink-0"
                    >
                      {referenceImage ? (
                        <img src={referenceImage} className="w-full h-full object-cover" alt="Reference" />
                      ) : (
                        <ICONS.Plus className="w-4 h-4 text-slate-400" />
                      )}
                      <input 
                        type="file" 
                        ref={referenceInputRef} 
                        onChange={handleReferenceImageChange} 
                        className="hidden" 
                        accept="image/*" 
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-slate-700">参考图 (可选)</p>
                      <p className="text-[10px] text-slate-400 truncate">上传图片指引 AI 构图或风格</p>
                    </div>
                  </div>

                  <button 
                    type="button"
                    onClick={handleRegenerateImage}
                    disabled={!imagePrompt || (isRegeneratingImage && isUploadingImage)}
                    className="w-full py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 text-xs cursor-pointer shadow-sm shadow-blue-500/10"
                  >
                    {isRegeneratingImage && !imagePrompt ? (
                      <ICONS.Loader className="w-4 h-4 animate-spin" />
                    ) : (
                      <ICONS.Zap className="w-4 h-4" />
                    )}
                    立即重新生成
                  </button>
                </div>
              </motion.div>
            )}

            {/* SEO Content Audit Checklist Card */}
            {(() => {
              const content = editingTask.result?.content || '';
              const title = editingTask.result?.title || '';
              const seoTitle = editingTask.result?.seoTitle || '';
              const seoDescription = editingTask.result?.seoDescription || '';
              const keywords = editingTask.result?.keywords || [];
              const faqEnabled = !!editingTask.result?.faqEnabled;

              // 1. Detection of images (3-8 suggested)
              const imageMatches = content.match(/!\[.*?\]\(.*?\)/g) || [];
              const imageCount = imageMatches.length;
              const isImageValid = imageCount >= 3 && imageCount <= 8;

              // 2. FAQ schema markup missing
              const isFaqValid = faqEnabled;

              // 3. Internal links (3-8 suggested)
              const linkMatches = content.match(/\[.*?\]\((.*?)\)/g) || [];
              const linkCount = linkMatches.length;
              const isLinksValid = linkCount >= 3 && linkCount <= 8;

              // 4. Meta Title
              const isMetaTitleValid = !!seoTitle && seoTitle.trim().length > 10;

              // 5. Meta Description
              const isMetaDescriptionValid = !!seoDescription && seoDescription.trim().length > 30;

              // 6. Title includes target keyword
              const hasKeywordInTitle = keywords.length > 0 ? keywords.some(k => k && title.toLowerCase().includes(k.toLowerCase())) : false;

              // 7. Meta Title includes target keyword
              const hasKeywordInMetaTitle = keywords.length > 0 ? keywords.some(k => k && seoTitle.toLowerCase().includes(k.toLowerCase())) : false;

              // 8. Meta Description includes target keyword
              const hasKeywordInMetaDescription = keywords.length > 0 ? keywords.some(k => k && seoDescription.toLowerCase().includes(k.toLowerCase())) : false;

              const checksList = [
                {
                  id: 'images',
                  label: `检测图片 (当前: ${imageCount} 张)`,
                  description: '建议配图数量 3-8 张',
                  isValid: isImageValid,
                },
                {
                  id: 'faq',
                  label: 'FAQ 结构化标记',
                  description: isFaqValid ? '已启用 FAQ' : 'FAQ 结构化标记缺失',
                  isValid: isFaqValid,
                },
                {
                  id: 'links',
                  label: `检测内链 (当前: ${linkCount} 条)`,
                  description: '建议设置 3-8 条内链',
                  isValid: isLinksValid,
                },
                {
                  id: 'metaTitle',
                  label: '元标题',
                  description: seoTitle ? `已配置 (${seoTitle.length} 字)` : '未配置元标题',
                  isValid: isMetaTitleValid,
                },
                {
                  id: 'metaDescription',
                  label: '元描述',
                  description: seoDescription ? `已配置 (${seoDescription.length} 字)` : '未配置元描述',
                  isValid: isMetaDescriptionValid,
                },
                {
                  id: 'keywordTitle',
                  label: '标题包含目标关键词',
                  description: hasKeywordInTitle ? '完美匹配' : '标题未包含目标关键词',
                  isValid: hasKeywordInTitle,
                },
                {
                  id: 'keywordMetaTitle',
                  label: '元标题包含目标关键词',
                  description: hasKeywordInMetaTitle ? '完美匹配' : '元标题未包含目标关键词',
                  isValid: hasKeywordInMetaTitle,
                },
                {
                  id: 'keywordMetaDescription',
                  label: '元描述包含目标关键词',
                  description: hasKeywordInMetaDescription ? '完美匹配' : '元描述未包含目标关键词',
                  isValid: hasKeywordInMetaDescription,
                }
              ];

              const completedCount = checksList.filter(c => c.isValid).length;
              const totalCount = checksList.length;
              const completedPercentage = Math.round((completedCount / totalCount) * 100);

              return (
                <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">SEO 内容检测</h3>
                    <div className="flex items-center gap-1.5 text-xs font-bold">
                      <span className={completedPercentage === 100 ? 'text-green-600' : 'text-blue-600'}>
                        {completedCount}/{totalCount}
                      </span>
                      <span className="text-slate-400 font-normal">项完成</span>
                    </div>
                  </div>

                  {/* Circular progress bar indicator */}
                  <div className="flex items-center gap-4 bg-slate-50/50 p-3.5 rounded-xl border border-slate-100">
                    <div className="relative w-11 h-11 shrink-0">
                      <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
                        <path
                          className="text-slate-200"
                          strokeWidth="3"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                        <path
                          className={completedPercentage === 100 ? 'text-green-500' : 'text-blue-500'}
                          strokeDasharray={`${completedPercentage}, 100`}
                          strokeWidth="3.2"
                          strokeLinecap="round"
                          stroke="currentColor"
                          fill="none"
                          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center text-[10px] font-extrabold text-slate-700">
                        {completedPercentage}%
                      </div>
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">SEO 优化建议清单</h4>
                      <p className="text-[10px] text-slate-400 mt-0.5">实时分析页面并提供关键指标检测</p>
                    </div>
                  </div>

                  {/* Checklist display */}
                  <div className="space-y-3 pt-1">
                    {checksList.map((check) => (
                      <div key={check.id} className="flex items-start gap-2.5 text-xs py-0.5">
                        {check.isValid ? (
                          <CheckCircle className="w-4 h-4 text-green-500 shrink-0 mt-0.5" />
                        ) : (
                          <AlertCircle className="w-4 h-4 text-orange-500 shrink-0 mt-0.5" />
                        )}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <span className={`font-semibold ${check.isValid ? 'text-slate-700' : 'text-slate-600'}`}>
                              {check.label}
                            </span>
                          </div>
                          <p className="text-[10px] text-slate-400 mt-0.5">{check.description}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>
    );
  };

  if (editingTask) {
    return renderEditBlogSection();
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
            <button 
              onClick={() => setActiveSubTab('topics')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeSubTab === 'topics' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              选题库
              {topicsToProcess > 0 && (
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 text-[11px] rounded-full min-w-[18px] text-center">{topicsToProcess}</span>
              )}
            </button>
            <button 
              onClick={() => setActiveSubTab('tasks')}
              className={`px-4 py-2 rounded-lg text-xs font-bold transition-all flex items-center gap-2 ${
                activeSubTab === 'tasks' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              生成博客
              {totalTasks > 0 && (
                <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 text-[11px] rounded-full min-w-[18px] text-center">{tasksToProcess > 0 ? tasksToProcess : totalTasks}</span>
              )}
            </button>
          </div>
        </div>
        {activeSubTab === 'topics' && (
          <div className="flex gap-3">
            <button 
              onClick={() => setShowTopicModal(true)}
              className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all flex items-center gap-2"
            >
              <ICONS.Plus className="w-4 h-4" />
              手动添加
            </button>
            <div className="relative group">
              <button 
                onClick={handleGenerateTopics}
                disabled={isGeneratingTopics}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isGeneratingTopics ? (
                  <ICONS.Loader className="w-4 h-4 animate-spin" />
                ) : (
                  <ICONS.Zap className="w-4 h-4" />
                )}
                AI 批量生成选题
              </button>
              {products.length === 0 && !isGeneratingTopics && (
                <div className="absolute bottom-full mb-2 right-0 w-48 p-2 bg-slate-800 text-white text-[11px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                  提示：请先在商品管理中添加商品，AI 将根据商品信息生成选题。
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {activeSubTab === 'topics' && renderTopics()}
      {activeSubTab === 'tasks' && renderTasks()}
      
      {activeSubTab === 'topics' && topics.length === 0 && (
        <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-300 mx-auto mb-4">
            <ICONS.Check className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">暂无待处理选题</h3>
          <p className="text-slate-500 text-sm">所有 SEO 博客选题都已处理完成。</p>
        </div>
      )}

      {activeSubTab === 'tasks' && tasks.length === 0 && (
        <div className="text-center py-20 bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200">
          <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-300 mx-auto mb-4">
            <ICONS.Check className="w-8 h-8" />
          </div>
          <h3 className="text-lg font-bold text-slate-900 mb-1">暂无生成任务</h3>
          <p className="text-slate-500 text-sm">暂无正在生成或已完成的博客任务。</p>
        </div>
      )}

      <AnimatePresence>
        {selectedScoreTask && selectedScoreTask.result && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-[100000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black border-2 ${
                    (selectedScoreTask.result.score || 0) >= 90 ? 'border-green-500 text-green-600 bg-green-50' :
                    (selectedScoreTask.result.score || 0) >= 70 ? 'border-blue-500 text-blue-600 bg-blue-50' :
                    'border-orange-500 text-orange-600 bg-orange-50'
                  }`}>
                    {selectedScoreTask.result.score || '-'}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900">SEO 评分详情</h3>
                    <p className="text-sm text-slate-500">{selectedScoreTask.topicTitle}</p>
                  </div>
                </div>
                <button onClick={() => setSelectedScoreTask(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <ICONS.X className="w-5 h-5 text-slate-400" />
                </button>
              </div>
              
              <div className="p-6 overflow-y-auto">
                <div className="bg-slate-50 rounded-2xl p-6 border border-slate-100">
                  <h4 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2">
                    <ICONS.Info className="w-4 h-4 text-blue-600" />
                    评分理由与建议
                  </h4>
                  <div className="prose prose-sm max-w-none text-slate-600 whitespace-pre-wrap">
                    {selectedScoreTask.result.scoreReason || '暂无评分详情'}
                  </div>
                </div>
              </div>
              
              <div className="p-6 border-t border-slate-100 flex justify-end shrink-0">
                <button 
                  onClick={() => setSelectedScoreTask(null)}
                  className="px-6 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors"
                >
                  关闭
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SEOBlogManager;
