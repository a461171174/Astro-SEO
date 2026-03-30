
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { ICONS } from '../constants';
import StoreEditor from './StoreEditor';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, query, orderBy, doc, updateDoc, setDoc } from 'firebase/firestore';
import { Theme } from '../types';
import { cleanObject } from '../utils';

const MOCK_THEMES: Theme[] = [
  {
    id: '1',
    name: 'Exclusive',
    version: '2.3.59',
    lastModified: '2026-02-25 17:02:14',
    thumbnail: 'https://picsum.photos/seed/theme1/400/300',
    hasUpdate: true,
    sections: [
      { id: 'header', type: 'header', name: '页眉 Logo' },
      { id: 'banner', type: 'banner', name: '英雄横幅' },
      { id: 'products', type: 'products', name: '精选商品' },
      { id: 'footer', type: 'footer', name: '页脚信息' },
    ]
  },
  {
    id: '2',
    name: 'Exclusive-AI',
    version: '2.3.89',
    lastModified: '2026-02-06 18:16:14',
    thumbnail: 'https://picsum.photos/seed/theme2/400/300',
    isAI: true,
    sections: [
      { id: 'header', type: 'header', name: '页眉 Logo' },
      { id: 'banner', type: 'banner', name: '英雄横幅' },
      { id: 'products', type: 'products', name: '精选商品' },
      { id: 'reviews', type: 'reviews', name: '客户评价' },
      { id: 'footer', type: 'footer', name: '页脚信息' },
    ]
  },
];

const SiteBuilder: React.FC = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [themes, setThemes] = useState<Theme[]>([]);
  const [selectedTheme, setSelectedTheme] = useState<Theme | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, 'themes'), orderBy('updatedAt', 'desc')),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Theme));
        if (data.length === 0) {
          // Initialize with mock data if empty
          MOCK_THEMES.forEach(async (theme) => {
            await setDoc(doc(db, 'themes', theme.id), cleanObject({
              ...theme,
              isActive: theme.id === '2',
              updatedAt: new Date().toISOString()
            }));
          });
        } else {
          setThemes(data);
        }
        setIsLoading(false);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'themes')
    );
    return () => unsub();
  }, []);

  const activeTheme = themes.find(t => t.isActive) || themes[0];

  const handleActivate = async (id: string) => {
    try {
      // Deactivate others
      themes.forEach(async (t) => {
        if (t.isActive && t.id !== id) {
          await updateDoc(doc(db, 'themes', t.id), { isActive: false });
        }
      });
      // Activate this one
      await updateDoc(doc(db, 'themes', id), { isActive: true });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `themes/${id}`);
    }
  };

  if (isEditing && selectedTheme) {
    return <StoreEditor theme={selectedTheme} onBack={() => setIsEditing(false)} />;
  }

  if (isLoading) {
    return (
      <div className="h-[60vh] flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto py-8 px-6 space-y-8 bg-[#F8F9FB] min-h-full">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">模版库</h1>
        <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
          上传文件
        </button>
      </div>

      {/* Current Theme Section */}
      {activeTheme && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-8 space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                当前主题
              </h2>
              <div className="flex items-center gap-4 text-xs text-slate-400">
                <div className="flex items-center gap-1">
                  <span className="font-bold text-slate-900">{activeTheme.name}</span>
                  {activeTheme.isAI && <span className="text-blue-500">✨</span>}
                </div>
                <div className="flex items-center gap-1 cursor-pointer hover:text-slate-600">
                  当前版本: {activeTheme.version}
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <span>最后修改: {activeTheme.lastModified}</span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
                <ICONS.More className="w-5 h-5" />
              </button>
              <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
                预览
              </button>
              <button 
                onClick={() => {
                  setSelectedTheme(activeTheme);
                  setIsEditing(true);
                }}
                className="px-6 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold hover:bg-slate-50 transition-colors"
              >
                装修
              </button>
            </div>
          </div>

          <div className="relative aspect-[21/9] rounded-2xl overflow-hidden bg-slate-50 border border-slate-100 flex items-center justify-center group">
            <div className="relative w-full h-full flex items-center justify-center">
              {/* Desktop Preview - Shifted Left */}
              <div className="w-[65%] aspect-video bg-white rounded-lg shadow-2xl border border-slate-200 overflow-hidden transform -translate-x-12 transition-transform group-hover:scale-[1.02] group-hover:-translate-x-14">
                <img 
                  src={activeTheme.thumbnail || "https://picsum.photos/seed/exclusive-desktop/1200/800"} 
                  className="w-full h-full object-cover" 
                  alt="Desktop Preview" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
              </div>
              {/* Mobile Preview Overlay - Shifted Right and Offset */}
              <div className="absolute right-[18%] bottom-[10%] w-[14%] aspect-[9/19] bg-white rounded-2xl shadow-2xl border-[4px] border-slate-900 overflow-hidden transform translate-x-12 transition-transform group-hover:scale-[1.05] group-hover:translate-x-14">
                <img 
                  src={activeTheme.thumbnail || "https://picsum.photos/seed/exclusive-mobile/400/800"} 
                  className="w-full h-full object-cover" 
                  alt="Mobile Preview" 
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Theme Library Section */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100">
          <h3 className="text-sm font-bold text-slate-900">主题库</h3>
          <p className="text-xs text-slate-400 mt-1">管理此店铺可用的主题</p>
        </div>
        <div className="divide-y divide-slate-50">
          {themes.map((theme) => (
            <div key={theme.id} className="p-6 flex items-center justify-between hover:bg-slate-50/50 transition-colors">
              <div className="flex items-center gap-4">
                <div className="w-20 h-14 rounded-lg border border-slate-200 overflow-hidden bg-slate-100 flex-shrink-0">
                  <img src={theme.thumbnail} className="w-full h-full object-cover" alt={theme.name} />
                </div>
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-slate-900">{theme.name}</span>
                    {theme.isAI && <span className="text-blue-500 text-xs">✨</span>}
                    {theme.isActive && <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded border border-blue-100">当前使用</span>}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-slate-400">
                    <div className="flex items-center gap-1">
                      当前版本: {theme.version}
                      {theme.hasUpdate && (
                        <span className="flex items-center gap-1 px-1.5 py-0.5 bg-green-50 text-green-600 rounded border border-green-100 font-bold">
                          有新版本可用
                          <svg className="w-2 h-2" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </span>
                      )}
                    </div>
                    <span>最后修改: {theme.lastModified}</span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button className="p-2 text-slate-400 hover:text-slate-600 hover:bg-white rounded-lg transition-colors">
                  <ICONS.More className="w-4 h-4" />
                </button>
                {!theme.isActive && (
                  <button 
                    onClick={() => handleActivate(theme.id)}
                    className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors"
                  >
                    发布
                  </button>
                )}
                <button className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors">
                  预览
                </button>
                <button 
                  onClick={() => {
                    setSelectedTheme(theme);
                    setIsEditing(true);
                  }}
                  className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold hover:bg-slate-50 transition-colors"
                >
                  装修
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recommended Templates Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">推荐模版</h3>
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors">
            访问主题市场
          </button>
        </div>
        <div className="grid grid-cols-3 gap-6">
          {[1, 2, 3].map((i) => (
            <motion.div 
              key={i}
              whileHover={{ y: -4 }}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden group cursor-pointer"
            >
              <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                <img 
                  src={`https://picsum.photos/seed/rec-theme-${i}/600/450`} 
                  className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
                  alt={`Recommended Theme ${i}`} 
                />
              </div>
              <div className="p-4 flex items-center justify-between">
                <span className="text-sm font-bold text-slate-900">现代风格 {i}</span>
                <button className="text-blue-600 text-xs font-bold opacity-0 group-hover:opacity-100 transition-opacity">
                  查看详情
                </button>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SiteBuilder;
