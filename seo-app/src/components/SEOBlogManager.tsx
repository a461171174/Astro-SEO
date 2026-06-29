import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
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
  topics: BlogTopic[];
  tasks: BlogTask[];
}

const SEOBlogManager: React.FC<SEOBlogManagerProps> = ({ 
  products, 
  topics: initialTopics,
  tasks: initialTasks
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'topics' | 'tasks'>('topics');
  const [topics, setTopics] = useState<BlogTopic[]>([]);
  const [tasks, setTasks] = useState<BlogTask[]>([]);
  const [isGeneratingTopics, setIsGeneratingTopics] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ type: 'error' | 'success' | 'info', text: string } | null>(null);
  const [isCreatingTask, setIsCreatingTask] = useState<string | null>(null);
  const [editingTask, setEditingTask] = useState<BlogTask | null>(null);
  const [previewMode, setPreviewMode] = useState<'edit' | 'preview'>('preview');
  const contentTextareaRef = React.useRef<HTMLTextAreaElement>(null);
  
  const [brandName, setBrandName] = useState('');
  const [targetLanguage, setTargetLanguage] = useState('英语');
  const [strategy, setStrategy] = useState('');
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [customBlogPrompt, setCustomBlogPrompt] = useState('');
  const [customBlogTopicsPrompt, setCustomBlogTopicsPrompt] = useState('');

  useEffect(() => {
    const unsubGlobal = onSnapshot(doc(db, 'seoConfigs', 'global'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setBrandName(data.brandName || '');
        setTargetLanguage(data.targetLanguage || '英语');
        setStrategy(data.strategy || '');
        setSelectedKeywords(data.keywords || []);
      }
    }, (error) => handleLocalFirestoreError(error, OperationType.GET, 'seoConfigs/global'));

    const unsubPrompts = onSnapshot(doc(db, 'seoConfigs', 'prompts'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setCustomBlogPrompt(data.blog || '');
        setCustomBlogTopicsPrompt(data.blogTopics || '');
      }
    }, (error) => handleLocalFirestoreError(error, OperationType.GET, 'seoConfigs/prompts'));

    return () => {
      unsubGlobal();
      unsubPrompts();
    };
  }, []);

  useEffect(() => {
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

  const handleLocalFirestoreError = (error: unknown, operationType: OperationType, path: string | null) => {
    if (isAbortError(error)) return;
    setStatusMessage({ type: 'error', text: `操作失败: ${error instanceof Error ? error.message : '权限不足或网络错误'}` });
    handleFirestoreError(error, operationType, path);
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
        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob failed'));
        }, 'image/jpeg', quality);
      };
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
      
      if (!content) throw new Error('AI 生成内容为空');
      
      let imageUrl = await withRetry(() => 
        geminiService.generateImage(content.imageDescription, "16:9")
      );
        
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
      await updateDoc(doc(db, 'blogTasks', taskId), { status: '失败', updatedAt: new Date().toISOString() });
    }
  };

  const renderTopics = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {topics.map(topic => (
        <div key={topic.id} className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <h4 className="font-bold text-slate-900 mb-2">{topic.title}</h4>
          <p className="text-xs text-slate-500 mb-4 line-clamp-2">{topic.description}</p>
          <div className="flex justify-between items-center">
            <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded">{topic.status}</span>
            <button 
              onClick={() => {
                addDoc(collection(db, 'blogTasks'), {
                  topicId: topic.id,
                  topicTitle: topic.title,
                  status: '待执行',
                  createdAt: new Date().toISOString()
                });
              }}
              className="text-xs font-bold text-blue-600 hover:underline"
            >
              生成博客
            </button>
          </div>
        </div>
      ))}
      <button 
        onClick={() => handleGenerateTopics()}
        className="border-2 border-dashed border-slate-200 rounded-2xl flex flex-col items-center justify-center p-8 hover:bg-slate-50 transition-all group"
      >
        <ICONS.Plus className="w-8 h-8 text-slate-300 group-hover:text-blue-500 mb-2" />
        <span className="text-sm font-bold text-slate-400 group-hover:text-blue-600">AI 批量生成选题</span>
      </button>
    </div>
  );

  const handleGenerateTopics = async () => {
    setIsGeneratingTopics(true);
    try {
      const suggestedTopics = await withRetry(() => 
        geminiService.generateBlogTopics(products, brandName, 5, targetLanguage, strategy, selectedKeywords, customBlogTopicsPrompt)
      );
      for (const topic of suggestedTopics) {
        await addDoc(collection(db, 'blogTopics'), cleanObject({
          ...topic, status: '待处理', source: 'AI', createdAt: new Date().toISOString()
        }));
      }
    } finally { setIsGeneratingTopics(false); }
  };

  const renderTasks = () => (
    <div className="space-y-4">
      {tasks.map(task => (
        <div key={task.id} className="bg-white p-6 rounded-2xl border border-slate-200 flex items-center justify-between">
          <div>
            <h4 className="font-bold text-slate-900">{task.topicTitle}</h4>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-[11px] text-slate-400 font-medium">状态:</span>
              <span className="text-[11px] font-black text-slate-600 uppercase tracking-widest">{task.status}</span>
            </div>
          </div>
          <div className="flex gap-2">
            {task.status === '待执行' && (
              <button 
                onClick={() => processTask(task.id, topics.find(t => t.id === task.topicId)!)}
                className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold"
              >
                立即执行
              </button>
            )}
            {task.status === '已完成' && (
              <button 
                onClick={() => setEditingTask(task)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-xl text-xs font-bold"
              >
                查看建议
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit">
          <button 
            onClick={() => setActiveSubTab('topics')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeSubTab === 'topics' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
          >
            选题库
          </button>
          <button 
            onClick={() => setActiveSubTab('tasks')}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-all ${activeSubTab === 'tasks' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
          >
            任务列表
          </button>
        </div>
      </div>
      
      {activeSubTab === 'topics' ? renderTopics() : renderTasks()}

      <AnimatePresence>
        {editingTask && (
          <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between">
                <h3 className="text-xl font-bold text-slate-900">博客预览</h3>
                <button onClick={() => setEditingTask(null)} className="p-2 hover:bg-slate-100 rounded-full transition-colors">
                  <ICONS.Plus className="w-5 h-5 text-slate-400 rotate-45" />
                </button>
              </div>
              <div className="p-8 overflow-y-auto flex-1">
                <div className="prose prose-slate max-w-none">
                  <h1>{editingTask.result?.title}</h1>
                  {editingTask.result?.imageUrl && (
                    <img src={editingTask.result.imageUrl} alt="Blog Header" className="w-full aspect-video object-cover rounded-2xl my-6" />
                  )}
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>
                    {editingTask.result?.content || ''}
                  </ReactMarkdown>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default SEOBlogManager;
