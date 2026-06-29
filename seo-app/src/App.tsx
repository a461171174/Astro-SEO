
import React, { useState } from 'react';
import { ToastProvider } from './components/Toast';
import SEOBlogManager from './components/SEOBlogManager';
import SEODashboard from './components/SEODashboard';
import LaunchChecklist from './components/LaunchChecklist';
import { ICONS } from './constants';

const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'blog' | 'checklist'>('checklist');

  return (
    <ToastProvider>
      <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
        {/* Navigation */}
        <header className="bg-white border-b border-slate-200 px-8 py-3 flex items-center justify-between sticky top-0 z-40">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-lg shadow-blue-200">
              <ICONS.Zap className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-lg font-black text-slate-900 tracking-tighter">SEO EXPERT AI</h1>
              <p className="text-[11px] text-slate-400 font-bold uppercase tracking-widest leading-none">Smart SEO Assistant</p>
            </div>
          </div>
          
          <nav className="flex items-center gap-1 p-1 bg-slate-100 rounded-2xl">
            <button 
              onClick={() => setActiveTab('checklist')}
              className={`px-6 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'checklist' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <ICONS.ListChecks className="w-4 h-4" />
              启动清单
            </button>
            <button 
              onClick={() => setActiveTab('dashboard')}
              className={`px-6 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'dashboard' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <ICONS.BarChart3 className="w-4 h-4" />
              SEO 仪表盘
            </button>
            <button 
              onClick={() => setActiveTab('blog')}
              className={`px-6 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 ${
                activeTab === 'blog' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <ICONS.FileText className="w-4 h-4" />
              AI 博客管理
            </button>
          </nav>

          <div className="hidden md:flex items-center gap-4">
            <div className="flex -space-x-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-slate-200 flex items-center justify-center overflow-hidden">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i + 10}`} alt="User" />
                </div>
              ))}
            </div>
            <div className="h-8 w-[1px] bg-slate-200 mx-2" />
            <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors">
              <ICONS.Settings className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 p-8 max-w-7xl mx-auto w-full">
          {activeTab === 'checklist' ? (
            <LaunchChecklist />
          ) : activeTab === 'dashboard' ? (
            <SEODashboard 
              products={[]} 
              collections={[]} 
              blogs={[]} 
              blogSets={[]} 
              pages={[]} 
            />
          ) : (
            <SEOBlogManager 
              products={[]} 
              topics={[]} 
              tasks={[]} 
            />
          )}
        </main>
      </div>
    </ToastProvider>
  );
};

export default App;
