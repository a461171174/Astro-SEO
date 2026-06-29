import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ICONS } from '../constants';
import { db } from '../firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { isAbortError } from '../utils';

interface ChecklistItem {
  id: string;
  title: string;
  description: string;
  status: 'completed' | 'pending';
  icon: keyof typeof ICONS;
  link: string;
}

const LaunchChecklist: React.FC = () => {
  const [items, setItems] = useState<ChecklistItem[]>([
    { id: 'brand', title: '完善品牌与店铺信息', description: '设置品牌名称和店铺介绍，让 AI 更了解您的业务。', status: 'pending', icon: 'Info', link: 'dashboard' },
    { id: 'strategy', title: '生成 AI SEO 策略', description: '根据店铺信息生成定制化的 SEO 关键词与优化方案。', status: 'pending', icon: 'Zap', link: 'dashboard' },
    { id: 'keywords', title: '挑选核心关键词', description: '在推荐列表中选择并确认您想要重点攻克的关键词。', status: 'pending', icon: 'TrendingUp', link: 'dashboard' },
    { id: 'topics', title: '生成首批博客选题', description: '利用 AI 批量生成符合搜索意图的高质量内容选题。', status: 'pending', icon: 'FileText', link: 'blog' },
    { id: 'content', title: '发布第一篇 AI 博客', description: '将生成的博文内容发布到您的站点，开始积累权重。', status: 'pending', icon: 'CheckCircle2', link: 'blog' },
    { id: 'sitemap', title: '提交站点地图 (Sitemap)', description: '确保搜索引擎可以快速抓取并索引您的新内容。', status: 'pending', icon: 'Search', link: 'dashboard' },
  ]);

  const [globalConfig, setGlobalConfig] = useState<any>(null);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'seoConfigs', 'global'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setGlobalConfig(data);
        
        // Update statuses based on data
        setItems(prev => prev.map(item => {
          if (item.id === 'brand' && data.brandName && data.storeInfo) return { ...item, status: 'completed' };
          if (item.id === 'strategy' && data.strategy) return { ...item, status: 'completed' };
          if (item.id === 'keywords' && data.keywords && data.keywords.length > 0) return { ...item, status: 'completed' };
          return item;
        }));
      }
    }, (error) => {
      if (isAbortError(error)) return;
      console.error('Error fetching global SEO config in checklist:', error);
    });

    // We can also check blog topics/tasks if we had their counts here, 
    // but for now let's focus on the UI and global config.
    
    return () => unsub();
  }, []);

  const completedCount = items.filter(i => i.status === 'completed').length;
  const progress = (completedCount / items.length) * 100;

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      {/* Top Status Bar (The requested feature) */}
      <div className="bg-white border border-slate-200 rounded-3xl p-8 shadow-sm flex flex-col md:flex-row items-center gap-8 sticky top-24 z-30">
        <div className="relative w-32 h-32 flex-shrink-0">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="64"
              cy="64"
              r="58"
              stroke="currentColor"
              strokeWidth="10"
              fill="transparent"
              className="text-slate-100"
            />
            <motion.circle
              cx="64"
              cy="64"
              r="58"
              stroke="currentColor"
              strokeWidth="10"
              fill="transparent"
              strokeDasharray={364.4}
              initial={{ strokeDashoffset: 364.4 }}
              animate={{ strokeDashoffset: 364.4 - (364.4 * progress) / 100 }}
              strokeLinecap="round"
              className="text-blue-600"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-black text-slate-900">{Math.round(progress)}%</span>
            <span className="text-[11px] font-bold text-slate-400 uppercase">就绪度</span>
          </div>
        </div>

        <div className="flex-1 space-y-4 text-center md:text-left">
          <div>
            <h2 className="text-2xl font-black text-slate-900 mb-1">您的站点即将就绪！</h2>
            <p className="text-slate-500 text-sm">完成以下清单，开启您的 AI 驱动 SEO 之旅。已完成 {completedCount} / {items.length} 个步骤。</p>
          </div>
          
          <div className="flex flex-wrap gap-3 justify-center md:justify-start">
            {items.map((item, idx) => (
              <div 
                key={idx}
                className={`w-3 h-3 rounded-full transition-all duration-500 ${item.status === 'completed' ? 'bg-blue-600' : 'bg-slate-200'}`}
              />
            ))}
          </div>
        </div>

        <div className="flex gap-3">
          <button className="px-6 py-3 bg-slate-900 text-white rounded-2xl font-bold text-sm hover:bg-slate-800 transition-all shadow-lg shadow-slate-200">
            发布站点
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {items.map((item) => {
          const Icon = ICONS[item.icon];
          return (
            <motion.div 
              key={item.id}
              whileHover={{ y: -4 }}
              className={`p-6 rounded-3xl border-2 transition-all flex items-start gap-4 ${
                item.status === 'completed' ? 'bg-white border-green-100 opacity-75' : 'bg-white border-slate-100 shadow-sm'
              }`}
            >
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 ${
                item.status === 'completed' ? 'bg-green-50 text-green-600' : 'bg-slate-50 text-slate-400'
              }`}>
                {item.status === 'completed' ? <ICONS.CheckCircle2 className="w-6 h-6" /> : <Icon className="w-6 h-6" />}
              </div>
              <div className="flex-1 min-w-0">
                <h3 className={`font-bold mb-1 ${item.status === 'completed' ? 'text-slate-500 line-through' : 'text-slate-900'}`}>
                  {item.title}
                </h3>
                <p className="text-xs text-slate-400 line-clamp-2 leading-relaxed">{item.description}</p>
              </div>
              {item.status === 'pending' && (
                <button className="p-2 hover:bg-blue-50 text-blue-600 rounded-xl transition-colors">
                  <ICONS.ArrowRight className="w-5 h-5" />
                </button>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default LaunchChecklist;
