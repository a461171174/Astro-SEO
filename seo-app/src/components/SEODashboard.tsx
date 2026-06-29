
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ICONS } from '../constants';
import { geminiService } from '../services/geminiService';
import { Product, Collection, Blog, Page, BlogSet } from '../types';
import { isAbortError } from '../utils';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { 
  collection, query, where, getDocs, getDoc, updateDoc, doc, 
  addDoc, onSnapshot, deleteDoc, setDoc, serverTimestamp 
} from 'firebase/firestore';
import SEOBlogManager from './SEOBlogManager';
import { SearchableSelect } from './SearchableSelect';
import { useToast } from './Toast';

interface SEODashboardProps {
  products: Product[];
  collections: Collection[];
  blogs: Blog[];
  blogSets: BlogSet[];
  pages: Page[];
}

const SEODashboard: React.FC<SEODashboardProps> = ({ products, collections, blogs, blogSets, pages }) => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<'audit' | 'ai' | 'tracking' | 'blog' | 'fix'>('ai');
  const [aiMode, setAiMode] = useState<'chat' | 'list'>('chat');
  
  const [storeInfo, setStoreInfo] = useState('');
  const [brandName, setBrandName] = useState('');
  const [targetMarket, setTargetMarket] = useState('美国');
  const [targetLanguage, setTargetLanguage] = useState('英语');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [aiAnalysis, setAiAnalysis] = useState<{
    strategy: string;
    keywords: string[];
  } | null>(null);

  // Load global SEO config
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'seoConfigs', 'global'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        if (data.strategy) {
          setAiAnalysis({
            strategy: data.strategy,
            keywords: data.keywords || []
          });
        }
        setBrandName(data.brandName || '');
        setStoreInfo(data.storeInfo || '');
        setTargetMarket(data.targetMarket || '美国');
        setTargetLanguage(data.targetLanguage || '英语');
      }
    }, (error) => {
      if (isAbortError(error)) return;
      console.error('Error fetching global SEO config:', error);
    });
    return () => unsub();
  }, []);

  const handleGenerateStrategy = async () => {
    if (!brandName || !storeInfo) {
      toast.error('请填写品牌名称和店铺介绍');
      return;
    }

    setIsAnalyzing(true);
    try {
      const result = await geminiService.analyzeSiteSEO(
        storeInfo,
        { products, collections, blogs, pages },
        targetMarket,
        targetLanguage,
        brandName
      );

      if (result) {
        await setDoc(doc(db, 'seoConfigs', 'global'), {
          strategy: result.strategy,
          keywords: result.keywords,
          brandName,
          storeInfo,
          targetMarket,
          targetLanguage,
          updatedAt: new Date().toISOString()
        }, { merge: true });
        
        toast.success('SEO 策略生成成功！');
      }
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Failed to generate strategy:', error);
      toast.error('生成失败，请重试');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0);
  const [auditResults, setAuditResults] = useState<{
    score: number;
    issues: any[];
    stats: { [key: string]: number };
  } | null>(null);

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
    const allItems = [...products, ...collections, ...blogs, ...pages];
    const issues: any[] = [];
    
    const missingTitles = allItems.filter(item => !item.seoTitle);
    const missingDescriptions = allItems.filter(item => !item.seoDescription);

    if (missingTitles.length > 0) {
      issues.push({
        id: 'meta-title-missing',
        category: 'SEO 基础标签',
        severity: 'high',
        title: '缺少 SEO 标题',
        description: `发现 ${missingTitles.length} 个页面缺少 SEO 标题。`,
        recommendation: '为所有页面添加包含核心关键词的 SEO 标题。'
      });
    }

    if (missingDescriptions.length > 0) {
      issues.push({
        id: 'meta-desc-missing',
        category: 'SEO 基础标签',
        severity: 'high',
        title: '缺少 SEO 描述',
        description: `发现 ${missingDescriptions.length} 个页面缺少 SEO 描述。`,
        recommendation: '为每个页面编写独特的、具有吸引力的 SEO 描述。'
      });
    }

    let score = 100;
    if (allItems.length > 0) {
      score -= (missingTitles.length / allItems.length) * 50;
      score -= (missingDescriptions.length / allItems.length) * 30;
    }

    setAuditResults({
      score: Math.max(0, Math.round(score)),
      issues,
      stats: {
        'SEO 基础标签': allItems.length > 0 ? Math.round(((allItems.length - missingTitles.length) / allItems.length) * 100) : 100,
        '内容质量': allItems.length > 0 ? Math.round(((allItems.length - missingDescriptions.length) / allItems.length) * 100) : 100,
      }
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-4 mb-8">
        <button 
          onClick={() => setActiveTab('ai')}
          className={`flex-1 p-6 rounded-3xl border-2 transition-all text-left ${activeTab === 'ai' ? 'border-blue-500 bg-blue-50/50 shadow-lg shadow-blue-100' : 'border-slate-100 bg-white hover:border-slate-200'}`}
        >
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-4">
            <ICONS.Zap className="w-6 h-6" />
          </div>
          <h3 className="font-black text-slate-900 mb-1">AI 策略与生成</h3>
          <p className="text-xs text-slate-500 font-medium">生成全局 SEO 方案与内容</p>
        </button>

        <button 
          onClick={() => setActiveTab('audit')}
          className={`flex-1 p-6 rounded-3xl border-2 transition-all text-left ${activeTab === 'audit' ? 'border-indigo-500 bg-indigo-50/50 shadow-lg shadow-indigo-100' : 'border-slate-100 bg-white hover:border-slate-200'}`}
        >
          <div className="w-12 h-12 bg-indigo-100 text-indigo-600 rounded-2xl flex items-center justify-center mb-4">
            <ICONS.Search className="w-6 h-6" />
          </div>
          <h3 className="font-black text-slate-900 mb-1">站点 SEO 审计</h3>
          <p className="text-xs text-slate-500 font-medium">全站扫描与问题修复</p>
        </button>
      </div>

      {activeTab === 'ai' && (
        <>
          <div className="bg-white p-8 md:p-12 rounded-[32px] border border-slate-200 shadow-sm space-y-12 mb-8">
            <div className="max-w-2xl mx-auto text-center">
              <h3 className="text-2xl font-black text-slate-900 mb-3 tracking-tight">你的 SEO 优化时间线</h3>
              <p className="text-slate-500 leading-relaxed">
                SEO 是一项长期投入。下面说明 Google 从发现到认可你的优化，一般会经历的阶段与预期效果。
              </p>
            </div>

            <div className="relative max-w-4xl mx-auto">
              {/* Vertical Line */}
              <div className="absolute left-4 md:left-1/2 top-0 bottom-0 w-0.5 bg-slate-100 -translate-x-1/2 hidden md:block" />
              
              <div className="space-y-12">
                {/* Step 1 */}
                <div className="relative flex flex-col md:flex-row items-center gap-8 md:gap-0">
                  <div className="flex-1 md:text-right md:pr-12 order-2 md:order-1">
                    <h4 className="font-black text-slate-900 mb-1">第 1 周 – 基础搭建</h4>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      首次同步数据，优化最多 250 个商品的图片替代文本（alt）和页面元标签（meta）。这是提升排名的第一步。
                    </p>
                  </div>
                  <div className="relative z-10 w-10 h-10 rounded-full bg-blue-600 border-4 border-white shadow-lg flex items-center justify-center text-white shrink-0 order-1 md:order-2">
                    <ICONS.Zap className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 md:pl-12 order-3" />
                </div>

                {/* Step 2 */}
                <div className="relative flex flex-col md:flex-row items-center gap-8 md:gap-0">
                  <div className="flex-1 md:text-right md:pr-12 order-2 md:order-1 hidden md:block" />
                  <div className="relative z-10 w-10 h-10 rounded-full bg-indigo-500 border-4 border-white shadow-lg flex items-center justify-center text-white shrink-0 order-1 md:order-2">
                    <ICONS.Search className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 md:pl-12 order-3">
                    <h4 className="font-black text-slate-900 mb-1">第 1–2 周 – Google 发现改动</h4>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      Google 爬虫抓取并收录你新增 / 更新的内容，此过程自动进行。
                    </p>
                  </div>
                </div>

                {/* Step 3 */}
                <div className="relative flex flex-col md:flex-row items-center gap-8 md:gap-0">
                  <div className="flex-1 md:text-right md:pr-12 order-2 md:order-1">
                    <h4 className="font-black text-slate-900 mb-1">第 3–6 周 – 展现量开始上升</h4>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      你的页面开始出现在 Google 搜索结果中。建议绑定 Google Search Console 跟踪数据。
                    </p>
                  </div>
                  <div className="relative z-10 w-10 h-10 rounded-full bg-green-500 border-4 border-white shadow-lg flex items-center justify-center text-white shrink-0 order-1 md:order-2">
                    <ICONS.TrendingUp className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 md:pl-12 order-3" />
                </div>

                {/* Step 4 */}
                <div className="relative flex flex-col md:flex-row items-center gap-8 md:gap-0">
                  <div className="flex-1 md:text-right md:pr-12 order-2 md:order-1 hidden md:block" />
                  <div className="relative z-10 w-10 h-10 rounded-full bg-orange-500 border-4 border-white shadow-lg flex items-center justify-center text-white shrink-0 order-1 md:order-2">
                    <ICONS.BarChart3 className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 md:pl-12 order-3">
                    <h4 className="font-black text-slate-900 mb-1">第 6–12 周 – 排名逐步提升</h4>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      页面开始在长尾关键词上获得排名：商品名、SKU 变体、细分搜索、博客内容、分类页等。
                    </p>
                  </div>
                </div>

                {/* Step 5 */}
                <div className="relative flex flex-col md:flex-row items-center gap-8 md:gap-0">
                  <div className="flex-1 md:text-right md:pr-12 order-2 md:order-1">
                    <h4 className="font-black text-slate-900 mb-1">第 3–6 个月 – 流量显著增长</h4>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      在有竞争度的关键词上获得稳定排名与流量增长，SEO 飞轮正式启动。
                    </p>
                  </div>
                  <div className="relative z-10 w-10 h-10 rounded-full bg-purple-500 border-4 border-white shadow-lg flex items-center justify-center text-white shrink-0 order-1 md:order-2">
                    <ICONS.Zap className="w-5 h-5 text-white rotate-12" />
                  </div>
                  <div className="flex-1 md:pl-12 order-3" />
                </div>

                {/* Step 6 */}
                <div className="relative flex flex-col md:flex-row items-center gap-8 md:gap-0">
                  <div className="flex-1 md:text-right md:pr-12 order-2 md:order-1 hidden md:block" />
                  <div className="relative z-10 w-10 h-10 rounded-full bg-rose-500 border-4 border-white shadow-lg flex items-center justify-center text-white shrink-0 order-1 md:order-2">
                    <ICONS.Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div className="flex-1 md:pl-12 order-3">
                    <h4 className="font-black text-slate-900 mb-1">第 6–12 个月 – 表现稳定强势</h4>
                    <p className="text-sm text-slate-500 leading-relaxed">
                      在竞争激烈的类目上获得稳定、可观的 SEO 效果。持续优化才能保持领先。
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-8 border-t border-slate-100 flex flex-col items-center gap-3">
              <p className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">
                建议每周检查一次进度。SEO 效果会随时间复利增长。
              </p>
              <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-full border border-slate-100">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Live tracking optimized</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
            <div className="lg:col-span-1 space-y-6">
              <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm space-y-4">
                <h4 className="font-bold text-slate-900 flex items-center gap-2">
                  <ICONS.Info className="w-4 h-4 text-blue-600" />
                  店铺基本信息
                </h4>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">品牌名称</label>
                    <input 
                      type="text"
                      value={brandName}
                      onChange={(e) => setBrandName(e.target.value)}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                      placeholder="例如: My Awesome Store"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">店铺/品牌介绍</label>
                    <textarea 
                      value={storeInfo}
                      onChange={(e) => setStoreInfo(e.target.value)}
                      className="w-full h-32 px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm resize-none"
                      placeholder="描述您的店铺、主营商品和目标受众..."
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">目标市场</label>
                      <input 
                        type="text"
                        value={targetMarket}
                        onChange={(e) => setTargetMarket(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">目标语言</label>
                      <input 
                        type="text"
                        value={targetLanguage}
                        onChange={(e) => setTargetLanguage(e.target.value)}
                        className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl text-sm"
                      />
                    </div>
                  </div>
                  <button 
                    onClick={handleGenerateStrategy}
                    disabled={isAnalyzing}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {isAnalyzing ? <ICONS.Loader className="w-4 h-4 animate-spin" /> : <ICONS.Sparkles className="w-4 h-4" />}
                    生成 SEO 策略
                  </button>
                </div>
              </div>
            </div>

            <div className="lg:col-span-2 space-y-6">
              {aiAnalysis ? (
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm space-y-6">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 mb-2">您的品牌 SEO 策略</h3>
                    <div className="prose prose-sm max-w-none text-slate-600 whitespace-pre-wrap leading-relaxed">
                      {aiAnalysis.strategy}
                    </div>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 mb-4 flex items-center gap-2">
                      <ICONS.TrendingUp className="w-4 h-4 text-green-600" />
                      推荐关键词
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {aiAnalysis.keywords.map((kw, i) => (
                        <span key={i} className="px-3 py-1 bg-green-50 text-green-600 text-xs font-bold rounded-full border border-green-100">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              ) : (
                <div className="h-full bg-slate-50 rounded-3xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center p-12 text-center">
                  <div className="w-16 h-16 bg-white rounded-2xl shadow-sm flex items-center justify-center text-slate-300 mb-4">
                    <ICONS.Zap className="w-8 h-8" />
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-1">尚未生成策略</h3>
                  <p className="text-sm text-slate-500 max-w-xs">请在左侧填写品牌信息并点击生成，我们将为您量身定制 SEO 优化方案。</p>
                </div>
              )}
            </div>
          </div>

        </>
      )}

      {activeTab === 'audit' && (
        <div className="space-y-6">
          {!auditResults && !isScanning ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-slate-200 shadow-sm">
              <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-300 mx-auto mb-4">
                <ICONS.Search className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 mb-1">开始全站 SEO 审计</h3>
              <p className="text-sm text-slate-500 mb-6">我们将检查您的所有页面、商品和博客，发现影响排名的潜在问题。</p>
              <button 
                onClick={runAudit}
                className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-200"
              >
                立即开始审计
              </button>
            </div>
          ) : isScanning ? (
            <div className="bg-white p-12 rounded-3xl border border-slate-200 shadow-sm text-center">
              <div className="w-20 h-20 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center mx-auto mb-6 animate-pulse">
                <ICONS.RefreshCw className="w-10 h-10 animate-spin" />
              </div>
              <h3 className="text-xl font-black text-slate-900 mb-2">正在扫描站点内容...</h3>
              <div className="max-w-md mx-auto h-3 bg-slate-100 rounded-full overflow-hidden mt-4">
                <motion.div 
                  className="h-full bg-indigo-600"
                  initial={{ width: 0 }}
                  animate={{ width: `${scanProgress}%` }}
                />
              </div>
              <p className="text-sm text-slate-400 mt-4 font-bold">{scanProgress}% 已完成</p>
            </div>
          ) : auditResults && (
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
              <div className="lg:col-span-1 space-y-6">
                <div className="bg-white p-8 rounded-3xl border border-slate-200 shadow-sm text-center">
                  <div className={`w-24 h-24 rounded-full border-8 mx-auto mb-4 flex items-center justify-center text-3xl font-black ${
                    auditResults.score >= 80 ? 'border-green-500 text-green-600' : 
                    auditResults.score >= 60 ? 'border-amber-500 text-amber-600' : 'border-red-500 text-red-600'
                  }`}>
                    {auditResults.score}
                  </div>
                  <h3 className="font-black text-slate-900">总体健康得分</h3>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest mt-1">SEO Health Score</p>
                </div>
                
                {Object.entries(auditResults.stats).map(([label, value]) => (
                  <div key={label} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-xs font-bold text-slate-500">{label}</span>
                      <span className="text-xs font-black text-slate-900">{value}%</span>
                    </div>
                    <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div className="h-full bg-indigo-500" style={{ width: `${value}%` }} />
                    </div>
                  </div>
                ))}

                <button 
                  onClick={runAudit}
                  className="w-full py-3 bg-slate-100 border border-slate-200 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-all text-sm"
                >
                  重新审计
                </button>
              </div>

              <div className="lg:col-span-3 space-y-4">
                <h3 className="text-lg font-black text-slate-900 mb-2">发现的问题 ({auditResults.issues.length})</h3>
                {auditResults.issues.map(issue => (
                  <div key={issue.id} className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-start gap-4">
                    <div className={`p-3 rounded-2xl shrink-0 ${
                      issue.severity === 'high' ? 'bg-red-50 text-red-500' : 
                      issue.severity === 'medium' ? 'bg-amber-50 text-amber-500' : 'bg-blue-50 text-blue-500'
                    }`}>
                      <ICONS.AlertTriangle className="w-6 h-6" />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-bold text-slate-900">{issue.title}</h4>
                        <span className={`px-2 py-0.5 rounded text-[11px] font-black uppercase ${
                          issue.severity === 'high' ? 'bg-red-100 text-red-600' : 
                          issue.severity === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-blue-100 text-blue-600'
                        }`}>
                          {issue.severity === 'high' ? '高优先级' : issue.severity === 'medium' ? '中等' : '建议'}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 leading-relaxed">{issue.description}</p>
                      <div className="pt-2 bg-slate-50 p-3 rounded-xl border border-slate-100 mt-2">
                        <p className="text-[11px] font-black text-slate-400 uppercase tracking-widest mb-1">优化建议</p>
                        <p className="text-xs text-slate-600 font-medium">{issue.recommendation}</p>
                      </div>
                    </div>
                  </div>
                ))}
                {auditResults.issues.length === 0 && (
                  <div className="text-center py-12 bg-green-50 rounded-3xl border border-green-100">
                    <ICONS.Check className="w-12 h-12 text-green-500 mx-auto mb-2" />
                    <h4 className="font-black text-green-900">未发现关键问题</h4>
                    <p className="text-sm text-green-700">您的站点 SEO 表现良好！</p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default SEODashboard;
