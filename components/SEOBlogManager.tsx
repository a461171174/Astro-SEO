import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ICONS } from '../constants';
import { BlogTopic, BlogTask, Product, Page, Blog } from '../types';
import { cleanObject } from '../utils';
import { db, auth, storage } from '../firebase';
import { 
  collection, query, onSnapshot, addDoc, updateDoc, doc, deleteDoc, 
  serverTimestamp, orderBy, where, getDocs, getDocFromServer, getDoc
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { geminiService } from '../services/geminiService';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

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
  selectedKeywords = []
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
  const [previewMode, setPreviewMode] = useState<'edit' | 'preview'>('preview');
  const [topicOutlineMode, setTopicOutlineMode] = useState<'edit' | 'preview'>('preview');
  const [showHistory, setShowHistory] = useState(false);
  
  // Image editing states
  const [isRegeneratingImage, setIsRegeneratingImage] = useState(false);
  const [imagePrompt, setImagePrompt] = useState('');
  const [referenceImage, setReferenceImage] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const imageInputRef = React.useRef<HTMLInputElement>(null);
  const referenceInputRef = React.useRef<HTMLInputElement>(null);
  const contentTextareaRef = React.useRef<HTMLTextAreaElement>(null);
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
    });

    const qTasks = query(collection(db, 'blogTasks'), orderBy('createdAt', 'desc'));
    const unsubscribeTasks = onSnapshot(qTasks, (snapshot) => {
      setTasks(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BlogTask)));
    });

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

  const handleFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    const errInfo: FirestoreErrorInfo = {
      error: error instanceof Error ? error.message : String(error),
      authInfo: {
        userId: auth.currentUser?.uid,
        email: auth.currentUser?.email,
        emailVerified: auth.currentUser?.emailVerified,
        isAnonymous: auth.currentUser?.isAnonymous,
        tenantId: auth.currentUser?.tenantId,
        providerInfo: auth.currentUser?.providerData.map(provider => ({
          providerId: provider.providerId,
          displayName: provider.displayName,
          email: provider.email,
          photoUrl: provider.photoURL
        })) || []
      },
      operationType,
      path
    };
    console.error('Firestore Error: ', JSON.stringify(errInfo));
    setStatusMessage({ type: 'error', text: `操作失败: ${error instanceof Error ? error.message : '权限不足或网络错误'}` });
    throw new Error(JSON.stringify(errInfo));
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
      handleFirestoreError(err, OperationType.UPDATE, `blogTopics/${topicId}`);
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
      handleFirestoreError(err, OperationType.UPDATE, `blogTopics/${topicId}`);
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
          handleFirestoreError(err, OperationType.CREATE, 'blogTopics');
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
        // Save all suggestions directly
        const batch = suggestions.map(suggestion => 
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
        setStatusMessage({ type: 'success', text: `成功生成并保存了 ${suggestions.length} 个选题建议` });
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
      handleFirestoreError(error, OperationType.CREATE, 'blogTasks');
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
        
        await updateDoc(doc(db, 'blogTasks', taskId), cleanObject({
          status: '已完成',
          result: {
            title: content.title,
            content: content.content,
            imageUrl: imageUrl || `https://picsum.photos/seed/${encodeURIComponent(content.imageDescription)}/1200/630`,
            seoTitle: content.seoTitle,
            seoDescription: content.seoDescription,
            keywords: content.keywords,
            jsonLd: content.jsonLd,
            score: content.score,
            scoreReason: content.scoreReason
          },
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
      } catch (updateErr) {
        handleFirestoreError(updateErr, OperationType.UPDATE, `blogTasks/${taskId}`);
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
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-slate-900">博客选题库</h3>
          <p className="text-sm text-slate-500">管理 AI 生成或手动添加的博客灵感。</p>
        </div>
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
              <div className="absolute bottom-full mb-2 right-0 w-48 p-2 bg-slate-800 text-white text-[10px] rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                提示：请先在商品管理中添加商品，AI 将根据商品信息生成选题。
              </div>
            )}
          </div>
        </div>
      </div>

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
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                  topic.source === 'AI' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                }`}>
                  {topic.source === 'AI' ? 'AI 建议' : '手动添加'}
                </span>
                {topic.type && (
                  <span className="px-2 py-0.5 bg-slate-100 text-slate-500 rounded text-[10px] font-bold uppercase">
                    {topic.type}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2">
                {topic.status === '已生成' ? (
                  <span className="flex items-center gap-1 text-green-600 text-[10px] font-bold bg-green-50 px-2 py-0.5 rounded">
                    <ICONS.Check className="w-3 h-3" /> 已生成
                  </span>
                ) : topic.status === '执行中' ? (
                  <span className="flex items-center gap-1 text-blue-600 text-[10px] font-bold bg-blue-50 px-2 py-0.5 rounded">
                    <ICONS.Loader className="w-3 h-3 animate-spin" /> 处理中
                  </span>
                ) : (
                  <span className="text-slate-400 text-[10px] font-bold bg-slate-50 px-2 py-0.5 rounded">
                    待处理
                  </span>
                )}
                <button 
                  onClick={async () => {
                    try {
                      await deleteDoc(doc(db, 'blogTopics', topic.id));
                      setStatusMessage({ type: 'success', text: '选题已删除' });
                    } catch (err) {
                      handleFirestoreError(err, OperationType.DELETE, `blogTopics/${topic.id}`);
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
                      className="px-2 py-1 text-[10px] font-bold text-slate-400 hover:text-slate-600 transition-all"
                    >
                      取消
                    </button>
                    <button 
                      onClick={() => handleUpdateKeywords(topic.id)}
                      className="px-2 py-1 text-[10px] font-bold text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
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
                    <span key={i} className="px-2 py-0.5 bg-slate-50 text-slate-500 text-[10px] rounded-full border border-slate-100 group-hover/keywords:border-blue-200 transition-all">
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
                      className="px-2 py-1 text-[10px] border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20"
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
                      disabled={isCreatingTask === topic.id || topic.status === '已生成'}
                      className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-50"
                      title="定时发布"
                    >
                      <ICONS.Clock className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleCreateTask(topic)}
                      disabled={isCreatingTask === topic.id || topic.status === '已生成'}
                      className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition-all flex items-center gap-1 disabled:opacity-50"
                    >
                      {isCreatingTask === topic.id ? (
                        <ICONS.Loader className="w-3 h-3 animate-spin" />
                      ) : topic.status === '已生成' ? (
                        <ICONS.Check className="w-3 h-3" />
                      ) : (
                        <ICONS.Zap className="w-3 h-3" />
                      )}
                      {topic.status === '已生成' ? '已生成' : '立即生成博客'}
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
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-lg rounded-3xl shadow-2xl my-auto"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center rounded-t-3xl bg-white">
                <h3 className="font-bold text-slate-900">手动添加博客选题</h3>
                <button onClick={() => {
                  setShowTopicModal(false);
                  setNewTopic({ keywords: '', targetProductIds: [], targetPageIds: [], outline: '' });
                  setProductSearch('');
                  setPageSearch('');
                  setSuggestedManualTopics([]);
                }} className="text-slate-400 hover:text-slate-600">
                  <ICONS.Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-400 uppercase">关键词 (逗号分隔)</label>
                  <input 
                    type="text"
                    value={newTopic.keywords}
                    onChange={(e) => setNewTopic({ ...newTopic, keywords: e.target.value })}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                    placeholder="例如：家居, 装饰, 趋势"
                  />
                </div>
                
                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">关联商品</label>
                    <div className="relative" ref={productDropdownRef}>
                      <div 
                        onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer flex items-center justify-between"
                      >
                        <span className="text-sm text-slate-600">
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
                            <div className="p-3 border-b border-slate-100 bg-slate-50">
                              <div className="relative">
                                <ICONS.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
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
                                    className="rounded text-blue-600 focus:ring-blue-500 w-3 h-3"
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
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">关联页面</label>
                    <div className="relative" ref={pageDropdownRef}>
                      <div 
                        onClick={() => setIsPageDropdownOpen(!isPageDropdownOpen)}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all cursor-pointer flex items-center justify-between"
                      >
                        <span className="text-sm text-slate-600">
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
                            <div className="p-3 border-b border-slate-100 bg-slate-50">
                              <div className="relative">
                                <ICONS.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-400" />
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
                                    className="rounded text-blue-600 focus:ring-blue-500 w-3 h-3"
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
                  </div>
                </div>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3 rounded-b-3xl">
                <button 
                  onClick={() => {
                    setShowTopicModal(false);
                    setNewTopic({ keywords: '', targetProductIds: [], targetPageIds: [], outline: '' });
                    setProductSearch('');
                    setPageSearch('');
                    setSuggestedManualTopics([]);
                  }}
                  className="flex-1 px-4 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-all"
                >
                  取消
                </button>
                <button 
                  onClick={handleGenerateManualTopics}
                  disabled={isGeneratingManualTopics || (!newTopic.keywords.trim() && newTopic.targetProductIds.length === 0 && newTopic.targetPageIds.length === 0)}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isGeneratingManualTopics ? (
                    <ICONS.Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    <ICONS.Zap className="w-4 h-4" />
                  )}
                  AI 生成选题
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showEditTopicModal && editingTopic && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm overflow-y-auto">
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
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${topicOutlineMode === 'edit' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                      >
                        编辑
                      </button>
                      <button 
                        onClick={() => setTopicOutlineMode('preview')}
                        className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${topicOutlineMode === 'preview' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
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
                  <p className="text-[10px] text-slate-500 mt-1">建议使用清晰的层级结构（如 1., 1.1, - 等）来组织大纲，这有助于 AI 生成更有逻辑的文章。</p>
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
                      handleFirestoreError(err, OperationType.UPDATE, `blogTopics/${editingTopic.id}`);
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
                      handleFirestoreError(err, OperationType.UPDATE, `blogTopics/${editingTopic.id}`);
                    }
                  }}
                  disabled={isCreatingTask === editingTopic.id || editingTopic.status === '已生成'}
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
      <div className="flex justify-between items-center">
        <div className="space-y-1">
          <h3 className="text-lg font-bold text-slate-900">生成博客管理</h3>
          <p className="text-sm text-slate-500">查看 AI 博客生成的进度与结果，生成完成后可直接查看内容。</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">选题标题</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">评分</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">状态</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase">创建时间</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-400 uppercase text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {tasksToProcessList.map((task) => (
              <tr key={task.id} className="hover:bg-slate-50/50 transition-all">
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-900">{task.topicTitle}</div>
                </td>
                <td className="px-6 py-4">
                  {task.result?.score !== undefined ? (
                    <div className="flex items-center gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold border-2 shrink-0 ${
                        task.result.score >= 90 ? 'border-green-500 text-green-600 bg-green-50' :
                        task.result.score >= 70 ? 'border-blue-500 text-blue-600 bg-blue-50' :
                        'border-orange-500 text-orange-600 bg-orange-50'
                      }`}>
                        {task.result.score}
                      </div>
                      <div className="text-[10px] text-slate-500 max-w-[150px] line-clamp-2" title={task.result.scoreReason}>
                        {task.result.scoreReason}
                      </div>
                    </div>
                  ) : (
                    <span className="text-slate-300 text-xs">-</span>
                  )}
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    {task.status === '已完成' ? (() => {
                      const blog = task.resultBlogId ? blogs.find(b => b.id === task.resultBlogId) : null;
                      const isPublished = blog?.status === '已发布';
                      const publishTime = blog?.scheduledAt || task.scheduledAt;
                      
                      return (
                        <div className="flex flex-col gap-1">
                          {isPublished ? (
                            <span className="flex items-center gap-1 text-green-600 text-xs font-bold">
                              <ICONS.Check className="w-3 h-3" /> 已发布
                            </span>
                          ) : (
                            <span className="flex items-center gap-1 text-orange-600 text-xs font-bold">
                              <ICONS.Clock className="w-3 h-3" /> 未发布
                            </span>
                          )}
                          {publishTime && (
                            <span className="flex items-center gap-1 text-blue-500 text-[10px] font-bold">
                              <ICONS.Clock className="w-2.5 h-2.5" /> 定制发布: {new Date(publishTime).toLocaleString()}
                            </span>
                          )}
                        </div>
                      );
                    })() : task.status === '失败' ? (
                      <span className="flex items-center gap-1 text-red-600 text-xs font-bold">
                        <ICONS.Plus className="w-3 h-3 rotate-45" /> 失败
                      </span>
                    ) : task.status === '执行中' ? (
                      <span className="flex items-center gap-1 text-blue-600 text-xs font-bold">
                        <ICONS.Loader className="w-3 h-3 animate-spin" /> 处理中
                      </span>
                    ) : (
                      <span className="text-slate-400 text-xs font-bold">等待中</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">
                  {new Date(task.createdAt).toLocaleString()}
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2">
                    {task.status === '已完成' && (
                      <button 
                        onClick={() => {
                          setEditingTask(task);
                          setPreviewMode('preview');
                        }}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                        title="查看博客"
                      >
                        <ICONS.Edit className="w-4 h-4" />
                      </button>
                    )}
                    <button 
                      onClick={async () => {
                        try {
                          await deleteDoc(doc(db, 'blogTasks', task.id));
                          setStatusMessage({ type: 'success', text: '博客已删除' });
                        } catch (err) {
                          handleFirestoreError(err, OperationType.DELETE, `blogTasks/${task.id}`);
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

      <AnimatePresence>
        {editingTask && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 20 }}
              className="bg-white w-full max-w-4xl max-h-[90vh] rounded-3xl shadow-2xl overflow-hidden flex flex-col"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="font-bold text-slate-900">查看并编辑博客</h3>
                <div className="flex items-center gap-2">
                  <button 
                    onClick={() => setShowHistory(!showHistory)}
                    className={`p-2 rounded-lg transition-all flex items-center gap-2 text-xs font-bold ${showHistory ? 'bg-blue-600 text-white' : 'text-slate-400 hover:bg-slate-100'}`}
                    title="操作历史"
                  >
                    <ICONS.History className="w-4 h-4" />
                    历史记录
                  </button>
                  <button onClick={() => setEditingTask(null)} className="text-slate-400 hover:text-slate-600 ml-2">
                    <ICONS.Plus className="w-6 h-6 rotate-45" />
                  </button>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-8 space-y-8 relative">
                <AnimatePresence>
                  {showHistory && (
                    <motion.div 
                      initial={{ x: '100%' }}
                      animate={{ x: 0 }}
                      exit={{ x: '100%' }}
                      className="absolute inset-y-0 right-0 w-80 bg-white border-l border-slate-100 shadow-2xl z-20 p-6 overflow-y-auto"
                    >
                      <div className="flex justify-between items-center mb-6">
                        <h4 className="font-bold text-slate-900">历史版本</h4>
                        <button onClick={() => setShowHistory(false)} className="text-slate-400 hover:text-slate-600">
                          <ICONS.Plus className="w-5 h-5 rotate-45" />
                        </button>
                      </div>
                      
                      <div className="space-y-4">
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
                                    jsonLd: entry.jsonLd
                                  };
                                  setEditingTask(updated);
                                  setShowHistory(false);
                                }
                              }}
                            >
                              <div className="flex justify-between items-start mb-2">
                                <span className="text-[10px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">
                                  版本 {editingTask.history!.length - idx}
                                </span>
                                <span className="text-[10px] text-slate-400">
                                  {new Date(entry.updatedAt).toLocaleString()}
                                </span>
                              </div>
                              <div className="text-xs font-bold text-slate-700 line-clamp-1 mb-1">{entry.title}</div>
                              <div className="text-[10px] text-slate-400 line-clamp-2">{entry.content}</div>
                              <div className="mt-3 opacity-0 group-hover:opacity-100 transition-all text-[10px] font-bold text-blue-600 flex items-center gap-1">
                                <ICONS.RefreshCw className="w-3 h-3" /> 点击还原
                              </div>
                            </div>
                          ))
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
                <div className="space-y-4">
                  {editingTask.result?.score !== undefined && (
                    <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 flex items-center gap-4">
                      <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-bold border-2 shrink-0 ${
                        editingTask.result.score >= 90 ? 'border-green-500 text-green-600 bg-green-50' :
                        editingTask.result.score >= 70 ? 'border-blue-500 text-blue-600 bg-blue-50' :
                        'border-orange-500 text-orange-600 bg-orange-50'
                      }`}>
                        {editingTask.result.score}
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">SEO 评分</div>
                        <div className="text-sm text-slate-600">{editingTask.result.scoreReason}</div>
                      </div>
                    </div>
                  )}
                  <div className="aspect-video w-full bg-slate-100 rounded-2xl overflow-hidden relative group">
                    <img 
                      src={editingTask.result?.imageUrl} 
                      alt="Blog Header" 
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-4">
                      <button 
                        onClick={() => imageInputRef.current?.click()}
                        className="p-3 bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/40 transition-all"
                        title="上传图片"
                      >
                        <ICONS.Upload className="w-6 h-6" />
                      </button>
                      <button 
                        onClick={() => {
                          setImagePrompt(editingTask.result?.title || '');
                          setIsRegeneratingImage(true);
                        }}
                        className="p-3 bg-white/20 backdrop-blur-md text-white rounded-full hover:bg-white/40 transition-all"
                        title="AI 重新生成"
                      >
                        <ICONS.RefreshCw className="w-6 h-6" />
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
                          <ICONS.Loader className="w-8 h-8 text-blue-600 animate-spin" />
                          <span className="text-sm font-bold text-slate-600">上传中...</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {isRegeneratingImage && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="p-6 bg-blue-50 rounded-2xl border border-blue-100 space-y-4"
                    >
                      <div className="flex justify-between items-center">
                        <h4 className="text-sm font-bold text-blue-900">AI 图片重新生成</h4>
                        <button 
                          onClick={() => {
                            setIsRegeneratingImage(false);
                            setReferenceImage(null);
                            setImagePrompt('');
                          }}
                          className="text-blue-400 hover:text-blue-600"
                        >
                          <ICONS.Plus className="w-5 h-5 rotate-45" />
                        </button>
                      </div>
                      <div className="space-y-3">
                        <textarea 
                          value={imagePrompt}
                          onChange={(e) => setImagePrompt(e.target.value)}
                          placeholder="输入图片生成描述，例如：一个充满科技感的现代办公室，阳光明媚..."
                          className="w-full p-3 bg-white border border-blue-200 rounded-xl text-sm outline-none focus:border-blue-500 transition-all resize-none"
                          rows={3}
                        />
                        <div className="flex items-center gap-4">
                          <div 
                            onClick={() => referenceInputRef.current?.click()}
                            className="w-20 h-20 bg-white border-2 border-dashed border-blue-200 rounded-xl flex items-center justify-center cursor-pointer hover:border-blue-400 transition-all relative overflow-hidden"
                          >
                            {referenceImage ? (
                              <img src={referenceImage} className="w-full h-full object-cover" alt="Reference" />
                            ) : (
                              <ICONS.Plus className="w-6 h-6 text-blue-300" />
                            )}
                            <input 
                              type="file" 
                              ref={referenceInputRef} 
                              onChange={handleReferenceImageChange} 
                              className="hidden" 
                              accept="image/*" 
                            />
                          </div>
                          <div className="flex-1">
                            <p className="text-xs text-blue-600 font-bold mb-1">参考图 (可选)</p>
                            <p className="text-[10px] text-blue-400">上传一张图片作为 AI 生成的风格或构图参考。</p>
                          </div>
                          <button 
                            onClick={handleRegenerateImage}
                            disabled={!imagePrompt || isRegeneratingImage && isUploadingImage}
                            className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2"
                          >
                            {isRegeneratingImage && !imagePrompt ? (
                              <ICONS.Loader className="w-4 h-4 animate-spin" />
                            ) : (
                              <ICONS.Zap className="w-4 h-4" />
                            )}
                            立即生成
                          </button>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </div>

                <div className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">文章标题</label>
                    <input 
                      type="text"
                      value={editingTask.result?.title}
                      onChange={(e) => {
                        const updated = { ...editingTask };
                        if (updated.result) updated.result.title = e.target.value;
                        setEditingTask(updated);
                      }}
                      className="w-full text-2xl font-black text-slate-900 border-none focus:ring-0 p-0"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-6">
                    <div className="space-y-1">
                      <div className="flex justify-between items-center">
                        <label className="text-xs font-bold text-slate-400 uppercase">SEO 标题</label>
                        <span className={`text-[10px] font-bold ${(editingTask.result?.seoTitle?.length || 0) > 70 ? 'text-red-500' : 'text-slate-400'}`}>
                          {editingTask.result?.seoTitle?.length || 0} / 70
                        </span>
                      </div>
                      <input 
                        type="text"
                        maxLength={70}
                        value={editingTask.result?.seoTitle || ''}
                        onChange={(e) => {
                          const updated = { ...editingTask };
                          if (updated.result) updated.result.seoTitle = e.target.value;
                          setEditingTask(updated);
                        }}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-400 uppercase">关键词</label>
                      <input 
                        type="text"
                        value={editingTask.result?.keywords?.join(', ')}
                        onChange={(e) => {
                          const updated = { ...editingTask };
                          if (updated.result) updated.result.keywords = e.target.value.split(',').map(k => k.trim());
                          setEditingTask(updated);
                        }}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">SEO 描述</label>
                    <textarea 
                      value={editingTask.result?.seoDescription}
                      onChange={(e) => {
                        const updated = { ...editingTask };
                        if (updated.result) updated.result.seoDescription = e.target.value;
                        setEditingTask(updated);
                      }}
                      rows={2}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-400 uppercase">发布时间 (可选，满足时间后自动发布)</label>
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
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  {(() => {
                    const topic = topics.find(t => t.id === editingTask.topicId);
                    if (topic && topic.outline) {
                      return (
                        <div className="space-y-1">
                          <label className="text-xs font-bold text-slate-400 uppercase">博客大纲</label>
                          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-h-[250px] overflow-y-auto">
                            <div className="flex flex-col gap-2 font-mono text-xs leading-relaxed">
                              {(() => {
                                const lines = topic.outline.split('\n').filter(line => line.trim() !== '');
                                const levels: { indent: number, count: number }[] = [];
                                return lines.map((line, idx) => {
                                  const indentMatch = line.match(/^(\s+)/);
                                  const indentLevel = indentMatch ? indentMatch[1].length : 0;
                                  const cleanLine = line.trim().replace(/^([-*•]|\d+(\.\d+)*[.)]?)\s+/, '');
                                  
                                  while (levels.length > 0 && levels[levels.length - 1].indent >= indentLevel) {
                                    levels.pop();
                                  }
                                  
                                  if (levels.length === 0 || levels[levels.length - 1].indent < indentLevel) {
                                    levels.push({ indent: indentLevel, count: 1 });
                                  } else {
                                    levels[levels.length - 1].count++;
                                  }
                                  
                                  const numberStr = levels.map(l => l.count).join('.');
                                  
                                  return (
                                    <div 
                                      key={idx} 
                                      className="bg-white px-3 py-2 rounded-lg border border-slate-100 shadow-sm text-slate-700 break-words flex items-start gap-2"
                                      style={{ marginLeft: `${indentLevel * 8}px` }}
                                    >
                                      <span className="text-blue-500 font-bold min-w-[16px] whitespace-nowrap">{numberStr}.</span>
                                      <span className="flex-1">{cleanLine}</span>
                                    </div>
                                  );
                                });
                              })()}
                            </div>
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold text-slate-400 uppercase">正文内容 (Markdown)</label>
                        {previewMode === 'edit' && (
                          <div className="flex items-center gap-1 p-1 bg-slate-50 border border-slate-200 rounded-lg">
                            <button 
                              onClick={() => insertMarkdown('# ')}
                              className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600"
                              title="一级标题"
                            >
                              <ICONS.Heading className="w-4 h-4" />
                              <span className="text-[10px] font-bold ml-0.5">1</span>
                            </button>
                            <button 
                              onClick={() => insertMarkdown('## ')}
                              className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600"
                              title="二级标题"
                            >
                              <ICONS.Heading className="w-4 h-4" />
                              <span className="text-[10px] font-bold ml-0.5">2</span>
                            </button>
                            <button 
                              onClick={() => insertMarkdown('### ')}
                              className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600"
                              title="三级标题"
                            >
                              <ICONS.Heading className="w-4 h-4" />
                              <span className="text-[10px] font-bold ml-0.5">3</span>
                            </button>
                            <div className="w-px h-4 bg-slate-200 mx-1" />
                            <button 
                              onClick={() => insertMarkdown('**', '**')}
                              className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600"
                              title="加粗"
                            >
                              <ICONS.Bold className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => insertMarkdown('*', '*')}
                              className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600"
                              title="斜体"
                            >
                              <ICONS.Italic className="w-4 h-4" />
                            </button>
                            <div className="w-px h-4 bg-slate-200 mx-1" />
                            <button 
                              onClick={() => insertMarkdown('[', '](url)')}
                              className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600"
                              title="插入链接"
                            >
                              <ICONS.Link className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => insertMarkdown('- ')}
                              className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600"
                              title="无序列表"
                            >
                              <ICONS.List className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => insertMarkdown('> ')}
                              className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600"
                              title="引用"
                            >
                              <ICONS.Quote className="w-4 h-4" />
                            </button>
                            <button 
                              onClick={() => insertMarkdown('`', '`')}
                              className="p-1.5 hover:bg-white hover:shadow-sm rounded-md transition-all text-slate-600"
                              title="代码"
                            >
                              <ICONS.Code className="w-4 h-4" />
                            </button>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-1 p-1 bg-slate-100 rounded-lg self-end">
                        <button 
                          onClick={() => setPreviewMode('edit')}
                          className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${previewMode === 'edit' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                        >
                          编辑
                        </button>
                        <button 
                          onClick={() => setPreviewMode('preview')}
                          className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${previewMode === 'preview' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                        >
                          预览
                        </button>
                      </div>
                    </div>
                    {previewMode === 'edit' ? (
                      <textarea 
                        ref={contentTextareaRef}
                        value={editingTask.result?.content}
                        onChange={(e) => {
                          const updated = { ...editingTask };
                          if (updated.result) updated.result.content = e.target.value;
                          setEditingTask(updated);
                        }}
                        rows={12}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl font-mono text-sm"
                      />
                    ) : (
                      <div className="w-full min-h-[300px] max-h-[500px] overflow-y-auto px-8 py-6 bg-white border border-slate-200 rounded-xl prose prose-slate max-w-none prose-headings:font-bold prose-h1:text-2xl prose-h1:mb-6 prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3 prose-p:text-slate-700 prose-p:leading-relaxed prose-p:mb-5 prose-ul:my-4 prose-li:mb-2 prose-a:text-blue-600 hover:prose-a:text-blue-700">
                        <ReactMarkdown remarkPlugins={[remarkGfm]}>
                          {editingTask.result?.content || ''}
                        </ReactMarkdown>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="p-6 bg-slate-50 border-t border-slate-100 flex gap-3">
                <button 
                  onClick={() => setEditingTask(null)}
                  className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-all"
                >
                  取消
                </button>
                <button 
                  onClick={async () => {
                    if (editingTask && editingTask.result) {
                      try {
                        let finalImageUrl = editingTask.result.imageUrl;
                        
                        // Final check for base64 before saving
                        if (finalImageUrl.startsWith('data:')) {
                          finalImageUrl = await uploadBase64Image(finalImageUrl, `blog-tasks/${editingTask.id}/final-${Date.now()}.png`);
                        }

                        const resultToSave = {
                          ...editingTask.result,
                          imageUrl: finalImageUrl
                        };

                        // 1. Update the task
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
                  }}
                  className="px-6 py-2 bg-white border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-100 transition-all"
                >
                  仅保存
                </button>
                <button 
                  onClick={async () => {
                    if (editingTask && editingTask.result) {
                      try {
                        let finalImageUrl = editingTask.result.imageUrl;
                        
                        // Final check for base64 before saving
                        if (finalImageUrl.startsWith('data:')) {
                          finalImageUrl = await uploadBase64Image(finalImageUrl, `blog-tasks/${editingTask.id}/final-${Date.now()}.png`);
                        }

                        const resultToSave = {
                          ...editingTask.result,
                          imageUrl: finalImageUrl
                        };

                        // 1. Update the task
                        // Save current state to history before updating
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

                        // 2. Create or update the actual blog post
                        let blogId = editingTask.resultBlogId;
                        const blogData = {
                          title: resultToSave.title,
                          content: resultToSave.content,
                          image: resultToSave.imageUrl,
                          seoTitle: resultToSave.seoTitle,
                          seoDescription: resultToSave.seoDescription,
                          keywords: resultToSave.keywords,
                          jsonLd: resultToSave.jsonLd,
                          status: editingTask.scheduledAt && new Date(editingTask.scheduledAt) > new Date() ? '草稿' : '已发布',
                          scheduledAt: editingTask.scheduledAt || new Date().toISOString(),
                          updatedAt: new Date().toISOString()
                        };

                        if (blogId) {
                          // Update existing blog
                          await updateDoc(doc(db, 'blogs', blogId), cleanObject(blogData));
                        } else {
                          // Create new blog
                          const blogRef = await addDoc(collection(db, 'blogs'), cleanObject({
                            ...blogData,
                            createdAt: new Date().toISOString()
                          }));
                          blogId = blogRef.id;
                        }

                        // 3. Update task with result and blogId
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
                  }}
                  className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all flex items-center justify-center gap-2"
                >
                  <ICONS.Check className="w-5 h-5" />
                  保存并发布
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
        <button 
          onClick={() => setActiveSubTab('topics')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'topics' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          选题库
          {topicsToProcess > 0 && (
            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 text-[10px] rounded-full min-w-[18px] text-center">{topicsToProcess}</span>
          )}
        </button>
        <button 
          onClick={() => setActiveSubTab('tasks')}
          className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
            activeSubTab === 'tasks' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          生成博客
          {totalTasks > 0 && (
            <span className="px-1.5 py-0.5 bg-blue-100 text-blue-600 text-[10px] rounded-full min-w-[18px] text-center">{tasksToProcess > 0 ? tasksToProcess : totalTasks}</span>
          )}
        </button>
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
    </div>
  );
};

export default SEOBlogManager;
