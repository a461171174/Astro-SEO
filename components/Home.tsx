import React from 'react';
import { motion } from 'motion/react';
import { ICONS } from '../constants';

interface HomeProps {
  onOpenSettings?: (section?: string) => void;
  onNavigate?: (view: string) => void;
}

const Home: React.FC<HomeProps> = ({ onOpenSettings, onNavigate }) => {
  const quickActions = [
    { label: '装修', icon: <ICONS.Decoration className="w-4 h-4" />, color: 'text-blue-600', bg: 'bg-blue-50', view: '装修' },
    { label: '产品', icon: <ICONS.Store className="w-4 h-4" />, color: 'text-orange-600', bg: 'bg-orange-50', view: '产品' },
    { label: '营销', icon: <ICONS.Marketing className="w-4 h-4" />, color: 'text-purple-600', bg: 'bg-purple-50', view: '营销' },
    { label: '数据', icon: <ICONS.Analysis className="w-4 h-4" />, color: 'text-emerald-600', bg: 'bg-emerald-50', view: '分析' },
    { label: 'SEO', icon: <ICONS.Globe className="w-4 h-4" />, color: 'text-blue-500', bg: 'bg-blue-50', view: 'SEO' },
    { label: '创意', icon: <ICONS.Palette className="w-4 h-4" />, color: 'text-pink-600', bg: 'bg-pink-50', view: '创意' },
  ];

  const checklist = [
    { label: '创建商品', icon: '🛒', completed: true, view: '商品' },
    { label: '装修店铺', icon: '🎨', completed: true, view: '装修' },
    { label: '基础设置', icon: '🏷️', completed: true, section: '通用设置' },
    { label: '域名设置', icon: '🌐', completed: false, section: '域名' },
    { label: '在谷歌上找到您', icon: '🔍', completed: false, view: 'SEO策略' },
    { label: '绑定社交媒体', icon: '📱', completed: false, section: '通用设置' },
  ];

  const recommendations = [
    {
      agent: 'Malik',
      role: '开店Agent',
      title: '3分钟极速开业',
      image: 'https://picsum.photos/seed/setup/400/250',
      type: 'setup'
    },
    {
      agent: 'Dean',
      role: '装修Agent',
      title: '热情西班牙风格的店铺主页',
      image: 'https://picsum.photos/seed/spain/400/250',
      type: 'design'
    },
    {
      agent: 'Dean',
      role: '装修Agent',
      title: '治愈系森林风格的店铺主页',
      image: 'https://picsum.photos/seed/forest/400/250',
      type: 'design'
    },
    {
      agent: 'Olivia',
      role: '营销促Agent',
      title: '分析竞品促销，快速创建对标折扣活动',
      image: 'https://picsum.photos/seed/promo/400/250',
      type: 'marketing'
    },
    {
      agent: 'Dean',
      role: '装修Agent',
      title: '多巴胺仓库风格的店铺首页',
      image: 'https://picsum.photos/seed/dopamine/400/250',
      type: 'design'
    },
    {
      agent: 'Dean',
      role: '装修Agent',
      title: '深空沉浸风格店铺首页',
      image: 'https://picsum.photos/seed/space/400/250',
      type: 'design'
    },
    {
      agent: 'Dean',
      role: '装修Agent',
      title: '未来感数字肌理风格店铺首页',
      image: 'https://picsum.photos/seed/future/400/250',
      type: 'design'
    },
    {
      agent: 'Dean',
      role: '装修Agent',
      title: '特色模板推荐',
      image: 'https://picsum.photos/seed/templates/400/250',
      type: 'design'
    }
  ];

  return (
    <div className="max-w-[1200px] mx-auto py-4 px-6 space-y-8">
      {/* Enhanced Status Bar */}
      <div className="bg-white border border-slate-200 rounded-[32px] p-6 shadow-sm overflow-hidden relative group">
        <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
          <ICONS.Zap className="w-48 h-48 -rotate-12" />
        </div>
        
        <div className="relative flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-slate-900 tracking-tight">站点启动清单</h1>
              <div className="px-3 py-1 bg-blue-50 text-blue-600 rounded-full text-xs font-bold ring-1 ring-blue-100 uppercase tracking-wider">
                Progress
              </div>
            </div>
            <p className="text-slate-500 font-medium leading-relaxed max-w-lg">
              完成以下核心步骤，让您的店铺正式上线。达成 100% 进度即可解锁 <span className="text-orange-500 font-black italic">Go Global</span> 极速启动奖励。
            </p>
            
            <div className="flex items-center gap-2 pt-1">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-500 rounded-full text-[11px] font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
                本周已有 <span className="text-slate-900 font-black">2,541</span> 位卖家成功发布店铺
              </span>
            </div>
          </div>

          <div className="flex flex-col items-center gap-4 bg-slate-50/50 p-6 rounded-[24px] border border-slate-100 shadow-inner">
            <div className="relative w-32 h-32">
              <svg className="w-full h-full transform -rotate-90">
                <circle
                  cx="64"
                  cy="64"
                  r="58"
                  stroke="currentColor"
                  strokeWidth="10"
                  fill="transparent"
                  className="text-slate-200"
                />
                <motion.circle
                  initial={{ strokeDasharray: 364, strokeDashoffset: 364 }}
                  animate={{ strokeDashoffset: 364 - (364 * (checklist.filter(i => i.completed).length / checklist.length)) }}
                  cx="64"
                  cy="64"
                  r="58"
                  stroke="currentColor"
                  strokeWidth="10"
                  strokeDasharray={364}
                  fill="transparent"
                  strokeLinecap="round"
                  className="text-blue-600"
                />
              </svg>
              <div className="absolute inset-0 flex flex-col items-center justify-center">
                <span className="text-3xl font-black text-slate-900 leading-none">
                  {Math.round((checklist.filter(i => i.completed).length / checklist.length) * 100)}%
                </span>
                <span className="text-[11px] font-black text-slate-400 mt-1 uppercase">Ready</span>
              </div>
            </div>
            <div className="text-center space-y-1">
              <p className="text-xs font-black text-slate-900 uppercase tracking-tighter">
                {checklist.filter(i => i.completed).length} / {checklist.length} 已完成
              </p>
              <div className="flex items-center gap-1 justify-center">
                <ICONS.Zap className="w-3 h-3 text-orange-500 fill-current" />
                <span className="text-[11px] font-bold text-orange-600 truncate">+15 奖励积分</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Checklist Grid Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-3">
            待办任务
            <span className="text-xs font-medium text-slate-400">({checklist.filter(i => !i.completed).length} 项剩余)</span>
          </h2>
          <div className="flex items-center gap-2">
            <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-all">
              <ICONS.Filter className="w-4 h-4" />
            </button>
            <button className="p-2 text-slate-400 hover:bg-slate-100 rounded-xl transition-all">
              <ICONS.Sort className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {checklist.map((item, i) => (
            <motion.div 
              key={i}
              whileHover={{ y: -4 }}
              onClick={() => {
                if (item.view && onNavigate) {
                  onNavigate(item.view);
                } else if (item.section && onOpenSettings) {
                  onOpenSettings(item.section);
                }
              }}
              className={`group flex flex-col p-6 rounded-[24px] border transition-all cursor-pointer relative overflow-hidden ${
                item.completed 
                  ? 'bg-emerald-50/30 border-emerald-100' 
                  : 'bg-white border-slate-200 hover:border-blue-500 hover:shadow-xl hover:shadow-blue-500/10'
              }`}
            >
              {item.completed && (
                <div className="absolute top-4 right-4 bg-emerald-500 text-white p-1 rounded-full">
                  <ICONS.Check className="w-3 h-3 stroke-[3]" />
                </div>
              )}
              
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-2xl shadow-sm mb-6 transition-transform group-hover:scale-110 ${
                item.completed ? 'bg-white text-emerald-600' : 'bg-blue-50 text-blue-600 group-hover:bg-blue-600 group-hover:text-white'
              }`}>
                {item.icon}
              </div>

              <div className="flex-1">
                <h3 className={`text-lg font-black tracking-tight ${item.completed ? 'text-slate-400' : 'text-slate-900 group-hover:text-blue-600'}`}>
                  {item.label}
                </h3>
              </div>

              {!item.completed && (
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center justify-between">
                  <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                    待处理任务
                  </span>
                  <div className="text-xs font-black uppercase tracking-widest text-blue-600 flex items-center gap-1 group-hover:translate-x-1 transition-transform">
                    Go setup
                    <ICONS.ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>

      {/* Recommendations Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">AI 助手推荐</h2>
          <button className="text-xs text-blue-600 font-bold hover:underline">查看更多</button>
        </div>
        
        <div className="grid grid-cols-4 gap-4">
          {recommendations.map((rec, i) => (
            <motion.div 
              key={i}
              whileHover={{ y: -4 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden group cursor-pointer"
            >
              <div className="p-4 flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-slate-100 overflow-hidden">
                  <img src={`https://i.pravatar.cc/150?u=${rec.agent}`} alt={rec.agent} />
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold text-slate-900">{rec.agent}</span>
                  <span className="text-[11px] text-slate-400">· {rec.role}</span>
                </div>
              </div>
              <div className="px-4 pb-3">
                <h3 className="text-sm font-bold text-slate-900 line-clamp-1" title={rec.title}>{rec.title}</h3>
              </div>
              <div className="relative aspect-[1.6/1] bg-slate-50 overflow-hidden">
                <img 
                  src={rec.image} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                  alt={rec.title} 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-3 right-3 w-8 h-8 bg-white/90 backdrop-blur rounded-full flex items-center justify-center shadow-lg transform translate-y-2 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all">
                  <span className="text-blue-600 text-xs">✨</span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

      </div>
    </div>
  );
};

export default Home;
