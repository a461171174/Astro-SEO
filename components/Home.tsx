import React from 'react';
import { motion } from 'motion/react';
import { ICONS } from '../constants';

interface HomeProps {
  onOpenSettings?: () => void;
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
    { label: '创建商品', icon: '🛒', completed: true },
    { label: '装修店铺', icon: '🎨', completed: true },
    { label: '店名设置', icon: '🏷️', completed: true },
    { label: '绑定社交媒体', icon: '📱', completed: false },
    { label: '域名设置', icon: '🌐', completed: false },
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
    <div className="max-w-[1200px] mx-auto py-12 px-6 space-y-16">
      {/* Hero Section */}
      <div className="flex flex-col items-center text-center space-y-8">
        <h1 className="text-5xl font-bold text-slate-900 tracking-tight">让站点，讲好你的故事</h1>
        
        <div className="w-full max-w-3xl relative">
          <div className="absolute -inset-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 rounded-[32px] blur opacity-20 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
          <div className="relative bg-white border border-slate-200 rounded-[28px] shadow-xl p-6 flex flex-col gap-4">
            <textarea 
              placeholder="告诉 AI 你想做什么"
              className="w-full h-24 text-lg text-slate-600 placeholder-slate-300 outline-none resize-none bg-transparent"
            />
            <div className="flex items-center justify-between">
              <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
                <ICONS.Plus className="w-5 h-5" />
              </button>
              <button className="w-10 h-10 bg-slate-900 text-white rounded-full flex items-center justify-center hover:bg-slate-800 transition-colors shadow-lg">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 12h14M12 5l7 7-7 7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {quickActions.map((action) => (
            <button 
              key={action.label}
              onClick={() => onNavigate?.(action.view)}
              className={`flex items-center gap-2 px-4 py-2 bg-white border border-slate-200 rounded-full shadow-sm hover:shadow-md transition-all group`}
            >
              <span className={`${action.color} group-hover:scale-110 transition-transform`}>{action.icon}</span>
              <span className="text-sm font-bold text-slate-700">{action.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Checklist Section */}
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-bold text-slate-900">启动清单 <span className="text-slate-400 font-medium ml-1">{checklist.filter(i => i.completed).length} / {checklist.length}</span></h2>
            <div className="w-32 h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full" style={{ width: `${(checklist.filter(i => i.completed).length / checklist.length) * 100}%` }} />
            </div>
          </div>
          <p className="text-xs text-slate-400">全部完成可获得 <span className="text-orange-500 font-bold">15</span> 个积分</p>
        </div>

        <div className="grid grid-cols-5 gap-4 pb-4">
          {checklist.map((item, i) => (
            <div 
              key={i}
              onClick={() => {
                if (item.label === '绑定社交媒体' && onOpenSettings) {
                  onOpenSettings();
                }
              }}
              className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center justify-between group cursor-pointer hover:border-blue-200 hover:shadow-sm transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-xl group-hover:scale-110 transition-transform">
                  {item.icon}
                </div>
                <span className="text-sm font-bold text-slate-700">{item.label}</span>
              </div>
              {item.completed ? (
                <div className="w-5 h-5 bg-emerald-500 text-white rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
              ) : (
                <div className="w-5 h-5 border-2 border-slate-200 rounded-full" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations Section */}
      <div className="space-y-8">
        <h2 className="text-lg font-bold text-slate-900">Ai使用推荐</h2>
        
        <div className="grid grid-cols-4 gap-6">
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
                  <span className="text-[10px] text-slate-400">· {rec.role}</span>
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
