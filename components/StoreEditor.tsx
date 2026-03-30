
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Logo } from './Logo';
import { ICONS } from '../constants';
import { Theme, Section } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { isAbortError, cleanObject } from '../utils';
import { geminiService } from '../services/geminiService';

const getSectionIcon = (type: string) => {
  switch (type) {
    case 'header': return <ICONS.Layout className="w-4 h-4" />;
    case 'banner': return <ICONS.Decoration className="w-4 h-4" />;
    case 'products': return <ICONS.Store className="w-4 h-4" />;
    case 'reviews': return <ICONS.Customer className="w-4 h-4" />;
    case 'footer': return <ICONS.Layout className="w-4 h-4" />;
    default: return <ICONS.Plus className="w-4 h-4" />;
  }
};

interface StoreEditorProps {
  theme: Theme;
  onBack: () => void;
}

const SortableSectionItem = ({ 
  section, 
  isSelected, 
  isEditing, 
  tempName, 
  onSelect, 
  onDelete, 
  onStartEdit, 
  onNameChange, 
  onSaveEdit 
}: { 
  section: Section, 
  isSelected: boolean, 
  isEditing: boolean, 
  tempName: string, 
  onSelect: () => void, 
  onDelete: () => void, 
  onStartEdit: () => void, 
  onNameChange: (val: string) => void, 
  onSaveEdit: () => void 
}) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id: section.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : 'auto',
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between group ${
        isSelected ? 'border-blue-500 bg-blue-50/30' : 'border-slate-100 hover:border-slate-300'
      } ${isDragging ? 'shadow-lg ring-2 ring-blue-500/20' : ''}`}
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div 
          {...attributes} 
          {...listeners}
          className="cursor-grab active:cursor-grabbing p-1 -ml-1 hover:bg-slate-100 rounded text-slate-300 hover:text-slate-500 transition-colors"
        >
          <ICONS.Menu className="w-3.5 h-3.5" />
        </div>
        <div className="text-slate-400 shrink-0">{getSectionIcon(section.type)}</div>
        {isEditing ? (
          <input
            autoFocus
            value={tempName}
            onChange={(e) => onNameChange(e.target.value)}
            onBlur={onSaveEdit}
            onKeyDown={(e) => e.key === 'Enter' && onSaveEdit()}
            className="flex-1 bg-white border border-blue-500 rounded px-2 py-0.5 text-sm outline-none"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="text-sm font-medium text-slate-700 truncate" title={section.name}>{section.name}</span>
        )}
      </div>
      <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0 ml-2">
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onStartEdit();
          }}
          className="p-1 hover:text-blue-600 transition-colors"
          title="重命名"
        >
          <ICONS.Edit className="w-3 h-3" />
        </button>
        <button 
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="p-1 hover:text-red-500 transition-colors"
          title="删除"
        >
          <ICONS.Trash className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
};

const StoreEditor: React.FC<StoreEditorProps> = ({ theme, onBack }) => {
  const [activeTab, setActiveTab] = useState<'sections' | 'styles' | 'media' | 'ai' | 'apps'>('sections');
  const [viewMode, setViewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [currentPage, setCurrentPage] = useState('首页');
  const [sections, setSections] = useState<Section[]>(theme.sections || []);
  const [styles, setStyles] = useState(theme.styles || {
    primaryColor: '#3b82f6',
    fontFamily: 'Inter',
    borderRadius: '0.75rem'
  });
  const [lastSavedSections, setLastSavedSections] = useState(JSON.stringify(theme.sections || []));
  const [lastSavedStyles, setLastSavedStyles] = useState(JSON.stringify(theme.styles || {
    primaryColor: '#3b82f6',
    fontFamily: 'Inter',
    borderRadius: '0.75rem'
  }));
  const [showExitConfirm, setShowExitConfirm] = useState(false);
  const [showPageSelector, setShowPageSelector] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [tempSectionName, setTempSectionName] = useState('');

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setSections((items) => {
        const oldIndex = items.findIndex((i) => i.id === active.id);
        const newIndex = items.findIndex((i) => i.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const startEditing = (id: string, currentName: string) => {
    setEditingSectionId(id);
    setTempSectionName(currentName);
  };

  const saveSectionName = (id: string) => {
    if (tempSectionName.trim()) {
      setSections(sections.map(s => s.id === id ? { ...s, name: tempSectionName.trim() } : s));
    }
    setEditingSectionId(null);
  };

  const pages = [
    { id: 'home', name: '首页', icon: <ICONS.Home className="w-3.5 h-3.5" /> },
    { id: 'product', name: '商品详情页', icon: <ICONS.Store className="w-3.5 h-3.5" /> },
    { id: 'collection', name: '商品列表页', icon: <ICONS.Layout className="w-3.5 h-3.5" /> },
    { id: 'cart', name: '购物车', icon: <ICONS.Plus className="w-3.5 h-3.5" /> },
  ];

  const isDirty = useMemo(() => {
    return JSON.stringify(sections) !== lastSavedSections || JSON.stringify(styles) !== lastSavedStyles;
  }, [sections, styles, lastSavedSections, lastSavedStyles]);

  const [selectedSectionId, setSelectedSectionId] = useState<string | null>(null);
  const [selectedElementPath, setSelectedElementPath] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState('');
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [aiModifyPrompt, setAiModifyPrompt] = useState('');
  const [isAiModifying, setIsAiModifying] = useState(false);
  const [elementAiPrompt, setElementAiPrompt] = useState('');
  const [isElementAiModifying, setIsElementAiModifying] = useState(false);
  const [aiStylePrompt, setAiStylePrompt] = useState('');
  const [isAiStyling, setIsAiStyling] = useState(false);
  const [floatingBarPos, setFloatingBarPos] = useState<{ top: number, left: number, label: string } | null>(null);
  const previewContainerRef = React.useRef<HTMLDivElement>(null);
  const scrollContainerRef = React.useRef<HTMLDivElement>(null);

  const updateFloatingBarPos = React.useCallback(() => {
    if (!selectedSectionId || !scrollContainerRef.current) {
      setFloatingBarPos(null);
      return;
    }

    // Find the DOM element for the selection
    let element: HTMLElement | null = null;
    let label = '';

    if (selectedElementPath) {
      // Find element by data attribute
      element = scrollContainerRef.current.querySelector(`[data-path="${selectedElementPath}"][data-section-id="${selectedSectionId}"]`);
      label = element?.getAttribute('data-label') || '元素';
    } else {
      // Find section by data attribute
      element = scrollContainerRef.current.querySelector(`[data-section-id="${selectedSectionId}"]:not([data-path])`);
      label = sections.find(s => s.id === selectedSectionId)?.name || '版块';
    }

    if (element && scrollContainerRef.current) {
      const rect = element.getBoundingClientRect();
      const containerRect = scrollContainerRef.current.getBoundingClientRect();
      
      setFloatingBarPos({
        top: rect.bottom - containerRect.top + scrollContainerRef.current.scrollTop,
        left: rect.left - containerRect.left + rect.width / 2,
        label
      });
    } else {
      setFloatingBarPos(null);
    }
  }, [selectedSectionId, selectedElementPath, sections]);

  React.useEffect(() => {
    updateFloatingBarPos();
    // Also update on window resize
    window.addEventListener('resize', updateFloatingBarPos);
    return () => window.removeEventListener('resize', updateFloatingBarPos);
  }, [updateFloatingBarPos]);

  const handleScroll = () => {
    updateFloatingBarPos();
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'themes', theme.id), cleanObject({
        sections,
        styles,
        lastModified: new Date().toISOString().replace('T', ' ').split('.')[0],
        updatedAt: new Date().toISOString()
      }));
      setLastSavedSections(JSON.stringify(sections));
      setLastSavedStyles(JSON.stringify(styles));
      alert('保存成功');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `themes/${theme.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddSection = (type: string) => {
    let defaultContent = {};
    switch (type) {
      case 'banner':
        defaultContent = {
          title: '提升您的品牌影响力',
          subtitle: '基于模块化设计的下一代电子商务引擎。',
          buttonText: '立即选购',
          imageUrl: 'https://picsum.photos/seed/banner/1200/600',
          backgroundColor: '#0f172a',
          textColor: '#ffffff'
        };
        break;
      case 'products':
        defaultContent = {
          title: '精选商品',
          items: [
            { title: '经典系列 1', price: '$129.00', image: 'https://picsum.photos/seed/p1/400/400' },
            { title: '经典系列 2', price: '$129.00', image: 'https://picsum.photos/seed/p2/400/400' },
            { title: '经典系列 3', price: '$129.00', image: 'https://picsum.photos/seed/p3/400/400' },
            { title: '经典系列 4', price: '$129.00', image: 'https://picsum.photos/seed/p4/400/400' },
          ]
        };
        break;
      case 'reviews':
        defaultContent = {
          title: '"这是我用过最直观的设计工具。AI 生成功能彻底改变了游戏规则。"',
          subtitle: 'Sarah Johnson',
          role: '创始人',
          image: 'https://picsum.photos/seed/user/100/100'
        };
        break;
    }

    const newSection: Section = {
      id: Date.now().toString(),
      type,
      name: `新版块 - ${type}`,
      content: defaultContent
    };
    setSections([...sections, newSection]);
  };

  const handleAiModify = async () => {
    if (!selectedSectionId || !aiModifyPrompt) return;
    
    const sectionToModify = sections.find(s => s.id === selectedSectionId);
    if (!sectionToModify) return;

    setIsAiModifying(true);
    try {
      const updatedSection = await geminiService.modifySectionStyle(sectionToModify, aiModifyPrompt);
      setSections(sections.map(s => s.id === selectedSectionId ? updatedSection : s));
      setAiModifyPrompt('');
    } catch (error) {
      if (isAbortError(error)) return;
      console.error("AI Modify Error:", error);
    } finally {
      setIsAiModifying(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt) return;
    setIsAiGenerating(true);
    try {
      const newSection = await geminiService.generateSection(aiPrompt);
      setSections([...sections, newSection]);
      setAiPrompt('');
    } catch (error) {
      if (isAbortError(error)) return;
      console.error("AI Generate Error:", error);
    } finally {
      setIsAiGenerating(true);
      setIsAiGenerating(false);
    }
  };

  const handleAiStyle = async () => {
    if (!aiStylePrompt) return;
    setIsAiStyling(true);
    try {
      const updatedStyles = await geminiService.modifyGlobalStyles(styles, aiStylePrompt);
      setStyles({ ...styles, ...updatedStyles });
      setAiStylePrompt('');
    } catch (error) {
      if (isAbortError(error)) return;
      console.error("AI Style Error:", error);
    } finally {
      setIsAiStyling(false);
    }
  };

  const handleElementAiModify = async () => {
    if (!selectedSectionId || !selectedElementPath || !elementAiPrompt) return;
    
    const sectionToModify = sections.find(s => s.id === selectedSectionId);
    if (!sectionToModify) return;

    setIsElementAiModifying(true);
    try {
      const updatedSection = await geminiService.modifyElement(sectionToModify, selectedElementPath, elementAiPrompt);
      setSections(sections.map(s => s.id === selectedSectionId ? updatedSection : s));
      setElementAiPrompt('');
      // Keep selection or clear? Let's keep it for now.
    } catch (error) {
      if (isAbortError(error)) return;
      console.error("Element AI Modify Error:", error);
    } finally {
      setIsElementAiModifying(false);
    }
  };

  const handleUpdateSectionName = (id: string, newName: string) => {
    setSections(sections.map(s => s.id === id ? { ...s, name: newName } : s));
  };

  return (
    <div className="h-full flex flex-col bg-slate-50 overflow-hidden">
      {/* Top Bar */}
      <header className="h-14 bg-white border-b border-slate-200 flex items-center justify-between px-4 z-[150]">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => {
              if (isDirty) {
                setShowExitConfirm(true);
              } else {
                onBack();
              }
            }}
            className="p-2 hover:bg-slate-100 rounded-lg transition-colors text-slate-500"
          >
            <ICONS.Plus className="w-5 h-5 rotate-45" />
          </button>
          <div className="h-6 w-px bg-slate-200" />
          
          {/* Page Selector */}
          <div className="relative">
            <button 
              onClick={() => setShowPageSelector(!showPageSelector)}
              className="flex items-center gap-2 px-3 py-1.5 hover:bg-slate-50 rounded-lg transition-all border border-transparent hover:border-slate-200 group"
            >
              <div className="flex flex-col items-start">
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider leading-none mb-1">正在编辑</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-sm font-bold text-slate-900">{currentPage}</span>
                  <ICONS.Plus className={`w-3 h-3 text-slate-400 transition-transform duration-300 ${showPageSelector ? 'rotate-180' : ''}`} />
                </div>
              </div>
            </button>

            <AnimatePresence>
              {showPageSelector && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowPageSelector(false)} />
                  <motion.div 
                    initial={{ opacity: 0, y: 8, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.95 }}
                    className="absolute top-full left-0 mt-2 w-56 bg-white border border-slate-200 rounded-xl shadow-xl z-50 py-2 overflow-hidden"
                  >
                    <div className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">选择页面</div>
                    {pages.map(page => (
                      <button
                        key={page.id}
                        onClick={() => {
                          setCurrentPage(page.name);
                          setShowPageSelector(false);
                        }}
                        className={`w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors ${
                          currentPage === page.name ? 'bg-blue-50 text-blue-600 font-bold' : 'text-slate-600 hover:bg-slate-50'
                        }`}
                      >
                        <div className={currentPage === page.name ? 'text-blue-600' : 'text-slate-400'}>
                          {page.icon}
                        </div>
                        {page.name}
                        {currentPage === page.name && (
                          <div className="ml-auto w-1.5 h-1.5 bg-blue-600 rounded-full" />
                        )}
                      </button>
                    ))}
                  </motion.div>
                </>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center bg-slate-100 p-1 rounded-xl">
            <button 
              onClick={() => setViewMode('desktop')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'desktop' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              title="电脑端视图"
            >
              <ICONS.Monitor className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('mobile')}
              className={`p-1.5 rounded-lg transition-all ${viewMode === 'mobile' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-500 hover:text-slate-700'}`}
              title="移动端视图"
            >
              <ICONS.Smartphone className="w-4 h-4" />
            </button>
          </div>

          <div className="h-6 w-px bg-slate-200" />

          <div className="flex items-center gap-3">
            <button className="px-4 py-1.5 text-sm font-medium text-slate-600 hover:text-slate-900">
              预览
            </button>
            <button 
              onClick={handleSave}
              disabled={isSaving}
              className="flex items-center gap-2 px-6 py-1.5 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg text-sm font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-md shadow-blue-200 disabled:opacity-50"
            >
              {isSaving ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
              )}
              <span>{isSaving ? '正在发布...' : '立即发布'}</span>
            </button>
          </div>
        </div>
      </header>

      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar - Navigation */}
        <aside className="w-16 bg-white border-r border-slate-200 flex flex-col items-center py-4 gap-4">
          {[
            { id: 'sections', icon: <ICONS.Apps />, label: '版块' },
            { id: 'styles', icon: <ICONS.Settings />, label: '样式' },
            { id: 'media', icon: <ICONS.Plus className="rotate-45" />, label: '素材' },
            { id: 'ai', icon: <span className="text-lg">✨</span>, label: 'AI' },
            { id: 'apps', icon: <ICONS.Plus />, label: '应用' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`w-10 h-10 rounded-xl flex items-center justify-center transition-all ${
                activeTab === tab.id ? 'bg-blue-50 text-blue-600 shadow-sm' : 'text-slate-400 hover:bg-slate-50 hover:text-slate-600'
              }`}
              title={tab.label}
            >
              {tab.icon}
            </button>
          ))}
        </aside>

        {/* Left Sidebar - Panel */}
        <aside className="w-72 bg-white border-r border-slate-200 flex flex-col overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex items-center justify-between">
            <h2 className="font-bold text-slate-900">
              {activeTab === 'sections' && '版块管理'}
              {activeTab === 'styles' && '全局样式'}
              {activeTab === 'media' && '素材资源'}
              {activeTab === 'ai' && 'AI 设计'}
              {activeTab === 'apps' && '应用扩展'}
            </h2>
          </div>

          <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
            {activeTab === 'sections' && (
              <div className="space-y-4">
                <DndContext 
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext 
                    items={sections.map(s => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    <div className="space-y-2">
                      {sections.map((section) => (
                        <SortableSectionItem 
                          key={section.id}
                          section={section}
                          isSelected={selectedSectionId === section.id}
                          isEditing={editingSectionId === section.id}
                          tempName={tempSectionName}
                          onSelect={() => setSelectedSectionId(section.id)}
                          onDelete={() => setSections(sections.filter(s => s.id !== section.id))}
                          onStartEdit={() => startEditing(section.id, section.name)}
                          onNameChange={setTempSectionName}
                          onSaveEdit={() => saveSectionName(section.id)}
                        />
                      ))}
                    </div>
                  </SortableContext>
                </DndContext>
                <button 
                  onClick={() => handleAddSection('text')}
                  className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm font-medium hover:border-blue-400 hover:text-blue-500 transition-all flex items-center justify-center gap-2"
                >
                  <ICONS.Plus className="w-4 h-4" /> 添加版块
                </button>
              </div>
            )}

            {activeTab === 'styles' && (
              <div className="space-y-6">
                <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 space-y-3">
                  <div className="flex items-center gap-2 text-indigo-600">
                    <span className="text-xs font-bold uppercase tracking-wider flex items-center gap-1.5">
                      <span className="text-base">✨</span> AI 智能配色
                    </span>
                  </div>
                  <div className="relative">
                    <textarea 
                      value={aiStylePrompt}
                      onChange={(e) => setAiStylePrompt(e.target.value)}
                      placeholder="描述您想要的整体风格... (例如：极简工业风，主色调使用莫兰迪绿)"
                      className="w-full h-24 p-3 bg-white border border-indigo-100 rounded-xl text-xs focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 outline-none resize-none"
                    />
                    <button 
                      onClick={handleAiStyle}
                      disabled={isAiStyling || !aiStylePrompt}
                      className="absolute bottom-2 right-2 p-1.5 bg-indigo-600 text-white rounded-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {isAiStyling ? (
                        <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      ) : (
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                      )}
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">品牌颜色</label>
                  <div className="grid grid-cols-5 gap-2">
                    {[styles.primaryColor, '#10b981', '#f59e0b', '#ef4444', '#6366f1'].map(color => (
                      <button 
                        key={color}
                        onClick={() => setStyles({ ...styles, primaryColor: color })}
                        className={`aspect-square rounded-full border-2 shadow-sm transition-all ${styles.primaryColor === color ? 'border-blue-500 scale-110' : 'border-white'}`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">字体</label>
                  <select 
                    value={styles.fontFamily}
                    onChange={(e) => setStyles({ ...styles, fontFamily: e.target.value })}
                    className="w-full p-2 bg-slate-50 border border-slate-200 rounded-lg text-sm"
                  >
                    <option value="Inter">Inter (默认)</option>
                    <option value="Roboto">Roboto</option>
                    <option value="Playfair Display">Playfair Display</option>
                  </select>
                </div>
                <div className="space-y-3">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">圆角大小</label>
                  <div className="flex items-center gap-4">
                    <input 
                      type="range" 
                      min="0" 
                      max="24" 
                      value={parseInt(styles.borderRadius) || 0}
                      onChange={(e) => setStyles({ ...styles, borderRadius: `${e.target.value}px` })}
                      className="flex-1" 
                    />
                    <span className="text-xs text-slate-500 w-8">{styles.borderRadius}</span>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'media' && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-2">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="aspect-square bg-slate-100 rounded-lg overflow-hidden border border-slate-200 group relative cursor-pointer">
                      <img src={`https://picsum.photos/seed/media-${i}/200/200`} className="w-full h-full object-cover" alt="Media" />
                      <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <button className="text-white text-[10px] font-bold">选择</button>
                      </div>
                    </div>
                  ))}
                </div>
                <button className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-slate-400 text-sm font-medium hover:border-blue-400 hover:text-blue-500 transition-all flex items-center justify-center gap-2">
                  <ICONS.Plus className="w-4 h-4" /> 上传素材
                </button>
              </div>
            )}
            {activeTab === 'ai' && (
              <div className="space-y-4">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <p className="text-xs text-blue-700 leading-relaxed">
                    输入您的设计需求，AI 将自动为您生成相应的版块和内容。
                  </p>
                </div>
                <div className="space-y-2">
                  <textarea 
                    value={aiPrompt}
                    onChange={(e) => setAiPrompt(e.target.value)}
                    placeholder="例如：添加一个带有倒计时和购买按钮的黑五促销横幅..."
                    className="w-full h-32 p-3 bg-slate-50 border border-slate-200 rounded-xl text-sm focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 outline-none resize-none"
                  />
                  <button 
                    onClick={handleAiGenerate}
                    disabled={isAiGenerating || !aiPrompt}
                    className={`w-full py-3 rounded-xl text-sm font-bold flex items-center justify-center gap-2 transition-all shadow-lg ${
                      isAiGenerating || !aiPrompt 
                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed shadow-none' 
                        : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-blue-200'
                    }`}
                  >
                    {isAiGenerating ? (
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <>
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>
                        生成设计模块
                      </>
                    )}
                  </button>
                </div>
                <div className="pt-4">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">常用指令</label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {['夏季促销横幅', '商品对比', '信任徽章'].map(tag => (
                      <button 
                        key={tag}
                        onClick={() => setAiPrompt(tag)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 rounded-full text-[11px] text-slate-600 transition-colors"
                      >
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'apps' && (
              <div className="space-y-4">
                <div className="p-4 border border-slate-100 rounded-xl bg-slate-50 flex items-center gap-3">
                  <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                    <ICONS.Marketing className="w-5 h-5 text-blue-600" />
                  </div>
                  <div>
                    <div className="text-sm font-bold text-slate-900">营销工具</div>
                    <div className="text-[10px] text-slate-500">已集成 3 个应用</div>
                  </div>
                </div>
                <button className="w-full py-3 bg-white border border-slate-200 rounded-xl text-sm font-bold text-slate-700 hover:bg-slate-50 transition-all">
                  访问应用商店
                </button>
              </div>
            )}
          </div>
        </aside>

        {/* Main Preview Area */}
        <main className="flex-1 bg-slate-100 overflow-hidden flex flex-col items-center relative">
          <div 
            className={`bg-white transition-all duration-500 overflow-hidden flex flex-col relative ${
              viewMode === 'desktop' ? 'w-full h-full' : 'w-[375px] h-[667px] rounded-[40px] border-[8px] border-slate-900 shadow-2xl my-8'
            }`}
            style={{ 
              fontFamily: styles.fontFamily,
              '--primary-color': styles.primaryColor,
              '--border-radius': styles.borderRadius
            } as any}
            onClick={() => {
              setSelectedSectionId(null);
              setSelectedElementPath(null);
            }}
          >
            {/* Mock Website Content */}
            <div 
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="flex-1 overflow-y-auto no-scrollbar bg-white relative"
            >
              {sections.map((section) => {
                const isSectionSelected = selectedSectionId === section.id;
                
                const SelectableElement = ({ path, label, children, className = "" }: { path: string, label: string, children: React.ReactNode, className?: string }) => {
                  const isSelected = isSectionSelected && selectedElementPath === path;
                  return (
                    <div 
                      data-path={path}
                      data-section-id={section.id}
                      data-label={label}
                      className={`relative group/element cursor-pointer transition-all ${className} ${
                        isSelected ? 'ring-2 ring-blue-500 ring-offset-2' : 'hover:ring-1 hover:ring-blue-300'
                      }`}
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedSectionId(section.id);
                        setSelectedElementPath(path);
                      }}
                    >
                      {isSelected && (
                        <div className="absolute -top-6 left-0 bg-blue-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-t-sm z-30">
                          {label}
                        </div>
                      )}
                      {children}
                    </div>
                  );
                };

                return (
                  <div 
                    key={section.id}
                    data-section-id={section.id}
                    className={`relative group border-2 border-transparent transition-all ${
                      isSectionSelected && !selectedElementPath ? 'border-blue-500' : 'hover:border-blue-400/50'
                    }`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedSectionId(section.id);
                      setSelectedElementPath(null);
                    }}
                  >
                    {section.type === 'header' && (
                      <div className="h-16 border-b border-slate-100 flex items-center justify-between px-8">
                        <SelectableElement path="logo" label="Logo" className="flex items-center gap-2">
                          <Logo size={24} />
                          <div className="font-black text-xl tracking-tighter">星盘AI</div>
                        </SelectableElement>
                        <SelectableElement path="nav" label="Navigation" className="flex gap-6 text-sm font-medium text-slate-600">
                          <span>首页</span>
                          <span>所有商品</span>
                          <span>关于我们</span>
                        </SelectableElement>
                        <div className="flex gap-4">
                          <ICONS.Search className="w-5 h-5" />
                          <ICONS.Customer className="w-5 h-5" />
                        </div>
                      </div>
                    )}

                    {section.type === 'banner' && (
                      <div 
                        className="h-96 relative flex items-center px-16 overflow-hidden"
                        style={{ backgroundColor: section.content?.backgroundColor || '#0f172a' }}
                      >
                        <SelectableElement path="imageUrl" label="Background Image" className="absolute inset-0 w-full h-full">
                          <img 
                            src={section.content?.imageUrl || "https://picsum.photos/seed/banner/1200/600"} 
                            className="w-full h-full object-cover opacity-60" 
                            alt="Banner" 
                          />
                        </SelectableElement>
                        <div className="relative z-10 max-w-lg space-y-6">
                          <SelectableElement path="title" label="h1">
                            <h1 
                              className="text-5xl font-bold leading-tight"
                              style={{ color: section.content?.textColor || '#ffffff' }}
                            >
                              {section.content?.title || '提升您的品牌影响力'}
                            </h1>
                          </SelectableElement>
                          <SelectableElement path="subtitle" label="p">
                            <p 
                              className="text-lg opacity-80"
                              style={{ color: section.content?.textColor || '#ffffff' }}
                            >
                              {section.content?.subtitle || '基于模块化设计的下一代电子商务引擎。'}
                            </p>
                          </SelectableElement>
                          <SelectableElement path="buttonText" label="button">
                            <button 
                              className="px-8 py-3 rounded-full font-bold hover:scale-105 transition-transform"
                              style={{ 
                                backgroundColor: section.content?.textColor || '#ffffff',
                                color: section.content?.backgroundColor || '#0f172a'
                              }}
                            >
                              {section.content?.buttonText || '立即选购'}
                            </button>
                          </SelectableElement>
                        </div>
                      </div>
                    )}

                    {section.type === 'products' && (
                      <div className="py-16 px-8 space-y-8">
                        <div className="flex items-center justify-between">
                          <SelectableElement path="title" label="h2">
                            <h2 className="text-2xl font-bold text-slate-900">{section.content?.title || '精选商品'}</h2>
                          </SelectableElement>
                          <span className="text-blue-600 font-bold text-sm">查看全部</span>
                        </div>
                        <div className="grid grid-cols-4 gap-6">
                          {(section.content?.items || [1, 2, 3, 4]).map((item: any, i: number) => (
                            <div key={i} className="space-y-3">
                              <SelectableElement path={`items.${i}.image`} label="Image" className="aspect-square bg-slate-100 rounded-2xl overflow-hidden">
                                <img src={item.image || `https://picsum.photos/seed/p${i}/400/400`} className="w-full h-full object-cover" alt="Product" />
                              </SelectableElement>
                              <div className="space-y-1">
                                <SelectableElement path={`items.${i}.title`} label="Title">
                                  <div className="text-sm font-bold text-slate-900">{item.title || `经典系列 ${i}`}</div>
                                </SelectableElement>
                                <SelectableElement path={`items.${i}.price`} label="Price">
                                  <div className="text-sm text-slate-500 font-medium">{item.price || '$129.00'}</div>
                                </SelectableElement>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {section.type === 'reviews' && (
                      <div className="py-16 bg-slate-50 px-8">
                        <div className="max-w-4xl mx-auto text-center space-y-8">
                          <div className="flex justify-center gap-1 text-amber-400">
                            {[1, 2, 3, 4, 5].map(i => <ICONS.Filter key={i} className="w-5 h-5 fill-current" />)}
                          </div>
                          <SelectableElement path="title" label="Quote">
                            <p className="text-2xl font-medium text-slate-700 italic">
                              {section.content?.title || '"这是我用过最直观的设计工具。AI 生成功能彻底改变了游戏规则。"'}
                            </p>
                          </SelectableElement>
                          <div className="flex items-center justify-center gap-3">
                            <SelectableElement path="image" label="Avatar" className="w-12 h-12 rounded-full bg-slate-200 overflow-hidden">
                              <img src={section.content?.image || "https://picsum.photos/seed/user/100/100"} alt="User" />
                            </SelectableElement>
                            <div className="text-left">
                              <SelectableElement path="subtitle" label="Name">
                                <div className="font-bold text-slate-900">{section.content?.subtitle || 'Sarah Johnson'}</div>
                              </SelectableElement>
                              <SelectableElement path="role" label="Role">
                                <div className="text-xs text-slate-500">{section.content?.role || '创始人'}</div>
                              </SelectableElement>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {section.type === 'footer' && (
                      <div className="py-12 bg-slate-900 text-slate-400 px-8 border-t border-slate-800">
                        <div className="grid grid-cols-4 gap-8">
                          <div className="space-y-4">
                            <div className="flex items-center gap-2">
                              <Logo size={24} />
                              <div className="text-white font-black text-xl tracking-tighter">星盘AI</div>
                            </div>
                            <SelectableElement path="description" label="Description">
                              <p className="text-xs leading-relaxed">全球领先的电子商务 SaaS 平台。</p>
                            </SelectableElement>
                          </div>
                          <div className="space-y-4">
                            <div className="text-white font-bold text-sm">链接</div>
                            <div className="flex flex-col gap-2 text-xs">
                              <span>隐私政策</span>
                              <span>服务条款</span>
                              <span>联系我们</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Section Controls Overlay */}
                    <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 z-20">
                      <button className="p-1.5 bg-white shadow-md rounded-lg text-slate-600 hover:text-blue-600"><ICONS.Plus className="w-4 h-4" /></button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setSections(sections.filter(s => s.id !== section.id));
                        }}
                        className="p-1.5 bg-white shadow-md rounded-lg text-slate-600 hover:text-red-500"
                      >
                        <ICONS.Trash className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Contextual AI Input for Section removed from here */}
                  </div>
                );
              })}
              {/* Add padding at the bottom to ensure the last section's AI bar is visible */}
              <div className="h-40" />

              {/* Unified Floating AI Bar */}
              <AnimatePresence>
                {floatingBarPos && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10, x: '-50%' }}
                    animate={{ opacity: 1, y: 0, x: '-50%' }}
                    exit={{ opacity: 0, y: 10, x: '-50%' }}
                    style={{ 
                      position: 'absolute',
                      top: floatingBarPos.top + 16,
                      left: `clamp(240px, ${floatingBarPos.left}px, calc(100% - 240px))`,
                      zIndex: 200,
                      width: 'min(450px, 90%)'
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <div className="bg-white rounded-full shadow-2xl border border-blue-100 p-1.5 flex flex-col gap-1">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 flex items-center gap-3 px-4">
                          <span className="text-blue-500">✨</span>
                          <input 
                            type="text"
                            value={selectedElementPath ? elementAiPrompt : aiModifyPrompt}
                            onChange={(e) => selectedElementPath ? setElementAiPrompt(e.target.value) : setAiModifyPrompt(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && (selectedElementPath ? handleElementAiModify() : handleAiModify())}
                            placeholder={`告诉 AI 如何修改 ${floatingBarPos.label}...`}
                            className="flex-1 bg-transparent border-none outline-none text-sm text-slate-700 placeholder:text-slate-400"
                          />
                        </div>
                        <div className="h-6 w-px bg-slate-200 mx-1" />
                        <div className="flex items-center gap-1 pr-1">
                          {selectedElementPath && (
                            <button className="p-2 hover:bg-slate-50 rounded-full text-slate-400 transition-colors">
                              <ICONS.Type className="w-4 h-4" />
                            </button>
                          )}
                          <button 
                            onClick={() => {
                              setSelectedSectionId(null);
                              setSelectedElementPath(null);
                              setAiModifyPrompt('');
                              setElementAiPrompt('');
                            }}
                            className="p-2 hover:bg-red-50 rounded-full text-slate-400 hover:text-red-500 transition-colors"
                          >
                            <ICONS.Trash className="w-4 h-4" />
                          </button>
                          <button 
                            onClick={selectedElementPath ? handleElementAiModify : handleAiModify}
                            disabled={(selectedElementPath ? isElementAiModifying || !elementAiPrompt : isAiModifying || !aiModifyPrompt)}
                            className="ml-1 p-2 bg-blue-600 text-white rounded-full hover:bg-blue-700 transition-colors disabled:opacity-50"
                          >
                            {(selectedElementPath ? isElementAiModifying : isAiModifying) ? (
                              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            ) : (
                              <ICONS.Send className="w-4 h-4" />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 px-4 py-1.5 bg-white/90 backdrop-blur-sm rounded-full border border-slate-200 shadow-sm inline-flex items-center gap-2 self-center mx-auto whitespace-nowrap">
                      <span className="text-blue-500 text-[10px]">💡</span>
                      <p className="text-[9px] text-slate-500 leading-none">
                        描述您想要的改动。当前修改将应用于 <span className="text-blue-600 font-bold">{selectedElementPath ? '选中的元素' : '整个版块'}</span>。
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Fixed Bottom AI Bar removed in favor of contextual bars */}
          <AnimatePresence>
            {/* Element AI Bar moved to SelectableElement */}
          </AnimatePresence>
        </main>
      </div>
      {/* Exit Confirmation Modal */}
      <AnimatePresence>
        {showExitConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowExitConfirm(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 overflow-hidden"
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="w-12 h-12 bg-amber-50 rounded-full flex items-center justify-center text-amber-500">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <div className="space-y-2">
                  <h3 className="text-lg font-bold text-slate-900">未保存的更改</h3>
                  <p className="text-sm text-slate-500 leading-relaxed">
                    您有尚未保存的装修改动。退出后这些改动将会丢失，确定要退出吗？
                  </p>
                </div>
                <div className="flex gap-3 w-full pt-2">
                  <button 
                    onClick={() => setShowExitConfirm(false)}
                    className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-xl text-sm font-bold hover:bg-slate-200 transition-all"
                  >
                    取消
                  </button>
                  <button 
                    onClick={() => {
                      setShowExitConfirm(false);
                      onBack();
                    }}
                    className="flex-1 px-4 py-2.5 bg-red-500 text-white rounded-xl text-sm font-bold hover:bg-red-600 transition-all shadow-lg shadow-red-200"
                  >
                    确定退出
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StoreEditor;
