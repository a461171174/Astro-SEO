
import React, { useState } from 'react';
import { ICONS } from '../constants';

interface HeaderProps {
  onAISubmit: (text: string) => void;
  isAILoading?: boolean;
  stores: { id: string; name: string; icon: string; color: string }[];
  currentStore: string;
  onSwitchStore: (store: string) => void;
  activeView: string;
}

const Header: React.FC<HeaderProps> = ({ 
  onAISubmit, 
  isAILoading, 
  stores, 
  currentStore, 
  onSwitchStore,
  activeView
}) => {
  const [isStoreMenuOpen, setIsStoreMenuOpen] = useState(false);

  const getHintText = () => {
    switch (activeView) {
      case '客户':
        return 'AI 分析客户购买请求，指定营销策略';
      case '产品':
        return 'AI 优化商品描述，提升转化率';
      case '分析':
        return 'AI 深度解读业务数据，发现增长机会';
      case 'SEO':
        return 'AI 诊断站点健康，优化搜索排名';
      case '询盘':
        return 'AI 自动回复询盘，提高响应速度';
      case '营销':
        return 'AI 策划营销活动，精准触达客户';
      case '装修':
        return 'AI 建议店铺布局，提升视觉体验';
      default:
        return '问问 AI 助手，如：分析上周询盘趋势';
    }
  };

  const currentStoreData = stores.find(s => s.name === currentStore);

  return (
    <header className="h-14 border-b border-slate-200 bg-white flex items-center justify-between px-6 sticky top-0 z-[100]">
      <div className="flex items-center gap-4">
        {/* Store Switcher in Header */}
        <div className="relative">
          <div 
            onClick={() => setIsStoreMenuOpen(!isStoreMenuOpen)}
            className="flex items-center gap-2 cursor-pointer hover:bg-slate-100 px-3 py-1.5 rounded-lg transition-all duration-200 border border-slate-200 shadow-sm bg-white"
          >
            <div className={`w-5 h-5 rounded flex-shrink-0 flex items-center justify-center text-white font-bold text-[11px] shadow-sm ${
              currentStoreData?.color || 'bg-blue-600'
            }`}>
              {currentStoreData?.icon || 'S'}
            </div>
            <div className="flex flex-col">
              <span className="text-[11px] text-slate-400 font-bold uppercase leading-none mb-0.5">当前店铺</span>
              <span className="text-xs font-bold text-slate-900 truncate max-w-[120px] leading-none">{currentStore}</span>
            </div>
            <svg className={`w-3 h-3 text-slate-400 transition-transform duration-200 ${isStoreMenuOpen ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
            </svg>
          </div>

          {isStoreMenuOpen && (
            <>
              <div className="fixed inset-0 z-30" onClick={() => setIsStoreMenuOpen(false)} />
              <div className="absolute left-0 top-full mt-1 z-40 bg-white border border-slate-200 rounded-xl shadow-xl overflow-hidden w-56">
                <div className="p-2 space-y-1">
                  <p className="px-3 py-2 text-[11px] font-bold text-slate-400 uppercase tracking-wider">切换店铺</p>
                  {stores.map(store => (
                    <button
                      key={store.id}
                      onClick={() => {
                        onSwitchStore(store.name);
                        setIsStoreMenuOpen(false);
                      }}
                      className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-all ${
                        currentStore === store.name 
                          ? 'bg-blue-50 text-blue-700' 
                          : 'hover:bg-slate-50 text-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-5 h-5 ${store.color} rounded flex items-center justify-center text-white font-bold text-[11px] shadow-sm`}>
                          {store.icon}
                        </div>
                        <span className="text-xs font-bold">{store.name}</span>
                      </div>
                      {currentStore === store.name && (
                        <svg className="w-3 h-3 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 font-medium animate-pulse">{getHintText()}</span>
          <button 
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => onAISubmit('')}
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-full font-bold text-xs shadow-lg shadow-blue-200 hover:shadow-blue-300 hover:scale-105 active:scale-95 transition-all group relative"
          >
            <span className="text-sm group-hover:rotate-12 transition-transform">✨</span>
            <span>AI 助手</span>
            {isAILoading && (
              <div className="ml-1 w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
            )}
            <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-white animate-bounce"></span>
          </button>
        </div>
      </div>
    </header>
  );
};

export default Header;
