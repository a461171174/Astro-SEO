import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ICONS } from '../constants';
import { EmailCampaign, Product, MediaItem } from '../types';
import { MediaLibrary } from './MediaLibrary';

interface EmailEditorProps {
  campaign?: EmailCampaign;
  products: Product[];
  onSave: (campaign: any) => void;
  onCancel: () => void;
  onGoToSegments: () => void;
}

type BlockType = 'text' | 'image' | 'button' | 'product' | 'footer';

interface EmailBlock {
  id: string;
  type: BlockType;
  content: any;
}

const EmailEditor: React.FC<EmailEditorProps> = ({ campaign, products, onSave, onCancel, onGoToSegments }) => {
  const [activeStep, setActiveStep] = useState<'design' | 'settings'>('design');
  const [blocks, setBlocks] = useState<EmailBlock[]>(campaign?.content || [
    { id: '1', type: 'text', content: { text: '欢迎来到我们的店铺', fontSize: 24, color: '#1e293b', align: 'center', padding: [20, 20, 20, 20], font: 'Inter' } },
    { id: '2', type: 'footer', content: { 
      showStoreName: true, 
      storeName: 'Happy Paws 店铺',
      showAddress: true, 
      address: '123 Business Road, Tech City, 10001',
      showPhone: true, 
      phone: '+1 234 567 890',
      showEmail: true, 
      email: 'support@happypaws.com',
      showUnsubscribe: true, 
      unsubscribeText: '退订',
      fontSize: 12, 
      color: '#94a3b8', 
      align: 'center' 
    } }
  ]);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
  const [settings, setSettings] = useState({
    title: campaign?.title || '',
    subject: campaign?.subject || '',
    summary: campaign?.summary || '',
    sender: campaign?.sender || '',
    segmentId: campaign?.segmentId || 'all',
    isScheduled: false,
    scheduledTime: ''
  });

  const selectedBlock = blocks.find(b => b.id === selectedBlockId);

  const addBlock = (type: BlockType) => {
    const newBlock: EmailBlock = {
      id: Date.now().toString(),
      type,
      content: getDefaultContent(type)
    };
    // Insert before footer if exists
    const footerIndex = blocks.findIndex(b => b.type === 'footer');
    if (footerIndex !== -1) {
      const newBlocks = [...blocks];
      newBlocks.splice(footerIndex, 0, newBlock);
      setBlocks(newBlocks);
    } else {
      setBlocks([...blocks, newBlock]);
    }
    setSelectedBlockId(newBlock.id);
  };

  const getDefaultContent = (type: BlockType) => {
    switch (type) {
      case 'text': return { text: '请输入文字...', fontSize: 16, color: '#334155', align: 'left', padding: [10, 10, 10, 10], font: 'Inter' };
      case 'image': return { url: 'https://picsum.photos/seed/email/600/300', alt: '', link: '', borderRadius: 0, width: 100, padding: [10, 10, 10, 10], bg: 'transparent' };
      case 'button': return { text: '立即查看', fontSize: 16, font: 'Inter', bg: '#2563eb', color: '#ffffff', borderColor: '#2563eb', borderRadius: 8, padding: [12, 24, 12, 24] };
      case 'product': return { productIds: [], columns: 2, showName: true, showPrice: true, showButton: true, buttonText: '立即购买', borderRadius: 8 };
      case 'footer': return { 
        showStoreName: true, 
        storeName: 'Happy Paws 店铺',
        showAddress: true, 
        address: '123 Business Road, Tech City, 10001',
        showPhone: true, 
        phone: '+1 234 567 890',
        showEmail: true, 
        email: 'support@happypaws.com',
        showUnsubscribe: true, 
        unsubscribeText: '退订',
        fontSize: 12, 
        color: '#94a3b8', 
        align: 'center' 
      };
    }
  };

  const updateBlockContent = (id: string, newContent: any) => {
    setBlocks(prev => prev.map(b => b.id === id ? { ...b, content: { ...b.content, ...newContent } } : b));
  };

  const removeBlock = (id: string) => {
    setBlocks(prev => prev.filter(b => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId(null);
  };

  const handleMediaSelect = (items: MediaItem[]) => {
    if (items.length > 0 && selectedBlockId) {
      updateBlockContent(selectedBlockId, { url: items[0].url });
    }
    setIsMediaLibraryOpen(false);
  };

  return (
    <div className="fixed inset-0 bg-[#F8F9FB] z-50 flex flex-col">
      {/* Header */}
      <div className="h-16 bg-white border-b border-slate-200 px-6 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={onCancel} className="p-2 hover:bg-slate-50 rounded-lg transition-colors">
            <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <div className="h-6 w-px bg-slate-200" />
          <div className="flex items-center gap-2 px-3 py-1 bg-green-50 rounded-full border border-green-100">
            <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-[10px] font-bold text-green-600 uppercase">兼容性检查通过</span>
          </div>
          <div className="h-6 w-px bg-slate-200" />
          <div className="flex items-center gap-1">
            <button 
              onClick={() => setActiveStep('design')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeStep === 'design' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              1. 邮件设计
            </button>
            <svg className="w-4 h-4 text-slate-300" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 5l7 7-7 7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            <button 
              onClick={() => setActiveStep('settings')}
              className={`px-4 py-1.5 rounded-lg text-sm font-bold transition-all ${activeStep === 'settings' ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:bg-slate-50'}`}
            >
              2. 发送设置
            </button>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex p-1 bg-slate-100 rounded-lg mr-4">
            <button 
              onClick={() => setPreviewMode('desktop')}
              className={`p-1.5 rounded-md transition-all ${previewMode === 'desktop' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            <button 
              onClick={() => setPreviewMode('mobile')}
              className={`p-1.5 rounded-md transition-all ${previewMode === 'mobile' ? 'bg-white shadow-sm text-blue-600' : 'text-slate-400'}`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 18h.01M8 21h8a2 2 0 002-2V5a2 2 0 00-2-2H8a2 2 0 00-2 2v14a2 2 0 002 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
          </div>
          <button className="px-4 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">预览</button>
          <button 
            onClick={() => onSave({ ...settings, content: blocks })}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-500/20"
          >
            保存并发送
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {activeStep === 'design' ? (
          <>
            {/* Left: Toolbar */}
            <div className="w-72 bg-white border-r border-slate-200 flex flex-col">
              <div className="p-6 border-b border-slate-100">
                <h3 className="text-sm font-bold text-slate-900">内容组件</h3>
                <p className="text-[10px] text-slate-400 mt-1">拖拽或点击添加组件到邮件</p>
              </div>
              <div className="p-4 grid grid-cols-2 gap-3">
                {[
                  { type: 'text', icon: <ICONS.Type className="w-5 h-5" />, label: '文字' },
                  { type: 'image', icon: <ICONS.Image className="w-5 h-5" />, label: '图片' },
                  { type: 'button', icon: <ICONS.Send className="w-5 h-5" />, label: '按钮' },
                  { type: 'product', icon: <ICONS.Store className="w-5 h-5" />, label: '商品' },
                  { type: 'footer', icon: <ICONS.Layout className="w-5 h-5" />, label: '页脚' },
                ].map(tool => (
                  <button 
                    key={tool.type}
                    onClick={() => addBlock(tool.type as BlockType)}
                    className="flex flex-col items-center justify-center p-4 bg-slate-50 border border-slate-100 rounded-xl hover:border-blue-200 hover:bg-blue-50/50 transition-all group"
                  >
                    <div className="text-slate-400 group-hover:text-blue-600 transition-colors">{tool.icon}</div>
                    <span className="text-[10px] font-bold text-slate-600 mt-2">{tool.label}</span>
                  </button>
                ))}
              </div>
              <div className="mt-auto p-6 border-t border-slate-100">
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
                  <p className="text-[10px] font-bold text-blue-600 uppercase">小贴士</p>
                  <p className="text-[10px] text-blue-500 mt-1 leading-relaxed">保持邮件简洁，突出核心行动按钮（CTA）能显著提高点击率。</p>
                </div>
              </div>
            </div>

            {/* Middle: Canvas */}
            <div className="flex-1 bg-slate-100 overflow-y-auto p-12 flex justify-center no-scrollbar transition-all duration-500 scroll-smooth">
              <div 
                className={`bg-white shadow-2xl min-h-full rounded-sm overflow-hidden flex flex-col transition-all duration-500 ${previewMode === 'mobile' ? 'w-[375px]' : 'w-[600px]'} h-fit`}
              >
                <div className="flex-1 overflow-y-auto no-scrollbar">
                  {blocks.map((block, index) => (
                  <div 
                    key={block.id}
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedBlockId(block.id);
                    }}
                    className={`relative group cursor-pointer border-2 transition-all ${selectedBlockId === block.id ? 'border-blue-500' : 'border-transparent hover:border-blue-200'}`}
                  >
                    {/* Block Controls */}
                    {selectedBlockId === block.id && (
                      <div className="absolute -right-12 top-0 flex flex-col gap-1">
                        <button onClick={() => removeBlock(block.id)} className="p-2 bg-white shadow-md rounded-lg text-red-500 hover:bg-red-50 transition-colors">
                          <ICONS.Trash className="w-4 h-4" />
                        </button>
                      </div>
                    )}

                    {/* Render Content */}
                    <div style={{ padding: block.content.padding ? `${block.content.padding[0]}px ${block.content.padding[1]}px ${block.content.padding[2]}px ${block.content.padding[3]}px` : '0' }}>
                      {block.type === 'text' && (
                        <div style={{ 
                          fontSize: `${block.content.fontSize}px`, 
                          color: block.content.color, 
                          textAlign: block.content.align,
                          fontFamily: block.content.font
                        }}>
                          {block.content.text}
                        </div>
                      )}
                      {block.type === 'image' && (
                        <div style={{ textAlign: 'center', backgroundColor: block.content.bg }}>
                            <img 
                              src={block.content.url} 
                              referrerPolicy="no-referrer"
                              style={{ 
                                width: `${block.content.width}%`, 
                                borderRadius: `${block.content.borderRadius}px`,
                                display: 'inline-block'
                              }} 
                              alt={block.content.alt} 
                            />
                        </div>
                      )}
                      {block.type === 'button' && (
                        <div style={{ textAlign: 'center' }}>
                          <button style={{ 
                            fontSize: `${block.content.fontSize}px`,
                            fontFamily: block.content.font,
                            backgroundColor: block.content.bg,
                            color: block.content.color,
                            borderColor: block.content.borderColor,
                            borderWidth: '1px',
                            borderRadius: `${block.content.borderRadius}px`,
                            padding: `${block.content.padding[0]}px ${block.content.padding[1]}px ${block.content.padding[2]}px ${block.content.padding[3]}px`,
                            fontWeight: 'bold'
                          }}>
                            {block.content.text}
                          </button>
                        </div>
                      )}
                      {block.type === 'product' && (
                        <div 
                          className={`grid gap-6`} 
                          style={{ gridTemplateColumns: previewMode === 'mobile' ? 'repeat(1, 1fr)' : `repeat(${block.content.columns}, 1fr)` }}
                        >
                          {[1, 2, 3, 4].slice(0, block.content.columns * 2).map(i => (
                            <div key={i} className="space-y-3">
                              <div className="aspect-square bg-slate-50 rounded-lg overflow-hidden border border-slate-100">
                                <img src={`https://picsum.photos/seed/p${i}/400/400`} referrerPolicy="no-referrer" className="w-full h-full object-cover" style={{ borderRadius: `${block.content.borderRadius}px` }} />
                              </div>
                              {block.content.showName && <p className="text-sm font-bold text-slate-900 line-clamp-2" title={`工业水泵系列 ${i}`}>工业水泵系列 {i}</p>}
                              {block.content.showPrice && <p className="text-sm font-bold text-blue-600">$299.00</p>}
                              {block.content.showButton && (
                                <button className="w-full py-2 bg-slate-900 text-white text-xs font-bold rounded-lg">{block.content.buttonText}</button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {block.type === 'footer' && (
                        <div style={{ 
                          fontSize: `${block.content.fontSize}px`, 
                          color: block.content.color, 
                          textAlign: block.content.align,
                          borderTop: '1px solid #f1f5f9',
                          paddingTop: '20px'
                        }}>
                          {block.content.showStoreName && <p className="font-bold mb-1">{block.content.storeName}</p>}
                          {block.content.showAddress && <p>{block.content.address}</p>}
                          {(block.content.showPhone || block.content.showEmail) && (
                            <p className="mt-1">
                              {block.content.showPhone && <span>{block.content.phone} </span>}
                              {block.content.showEmail && <span>{block.content.email}</span>}
                            </p>
                          )}
                          {block.content.showUnsubscribe && (
                            <p className="mt-4 text-[10px] opacity-60">
                              如果您不想再收到此类邮件，请点击 <span className="underline cursor-pointer">{block.content.unsubscribeText}</span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                </div>
              </div>
            </div>

            {/* Right: Config Panel */}
            <div className="w-80 bg-white border-l border-slate-200 overflow-y-auto p-6">
              <AnimatePresence mode="wait">
                {selectedBlock ? (
                  <motion.div 
                    key={selectedBlock.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="space-y-6"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-bold text-slate-900">
                        {selectedBlock.type === 'text' && '文字设置'}
                        {selectedBlock.type === 'image' && '图片设置'}
                        {selectedBlock.type === 'button' && '按钮设置'}
                        {selectedBlock.type === 'product' && '商品设置'}
                        {selectedBlock.type === 'footer' && '页脚设置'}
                      </h3>
                      <button onClick={() => setSelectedBlockId(null)} className="text-slate-400 hover:text-slate-600">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      </button>
                    </div>

                    <div className="space-y-4">
                      {selectedBlock.type === 'text' && (
                        <>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">内容</label>
                            <textarea 
                              value={selectedBlock.content.text}
                              onChange={(e) => updateBlockContent(selectedBlock.id, { text: e.target.value })}
                              className="w-full h-32 p-3 text-sm border border-slate-200 rounded-lg focus:ring-2 focus:ring-blue-500/20 outline-none resize-none"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">字体</label>
                              <select 
                                value={selectedBlock.content.font}
                                onChange={(e) => updateBlockContent(selectedBlock.id, { font: e.target.value })}
                                className="w-full p-2 text-xs border border-slate-200 rounded-lg outline-none"
                              >
                                <option value="Inter">Inter</option>
                                <option value="Georgia">Georgia</option>
                                <option value="Courier New">Courier New</option>
                              </select>
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">字号</label>
                              <input 
                                type="number" 
                                value={selectedBlock.content.fontSize}
                                onChange={(e) => updateBlockContent(selectedBlock.id, { fontSize: parseInt(e.target.value) })}
                                className="w-full p-2 text-xs border border-slate-200 rounded-lg outline-none"
                              />
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">颜色</label>
                            <div className="flex items-center gap-2">
                              <input 
                                type="color" 
                                value={selectedBlock.content.color}
                                onChange={(e) => updateBlockContent(selectedBlock.id, { color: e.target.value })}
                                className="w-8 h-8 rounded border border-slate-200"
                              />
                              <span className="text-xs font-mono text-slate-500 uppercase">{selectedBlock.content.color}</span>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">对齐方式</label>
                            <div className="flex p-1 bg-slate-100 rounded-lg">
                              {['left', 'center', 'right'].map(a => (
                                <button 
                                  key={a}
                                  onClick={() => updateBlockContent(selectedBlock.id, { align: a })}
                                  className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${selectedBlock.content.align === a ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                                >
                                  {a === 'left' ? '左对齐' : a === 'center' ? '居中' : '右对齐'}
                                </button>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      {selectedBlock.type === 'image' && (
                        <>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">图片链接</label>
                            <div className="flex gap-2">
                              <input 
                                type="text" 
                                value={selectedBlock.content.url}
                                onChange={(e) => updateBlockContent(selectedBlock.id, { url: e.target.value })}
                                className="flex-1 p-2 text-xs border border-slate-200 rounded-lg outline-none"
                              />
                              <button 
                                onClick={() => setIsMediaLibraryOpen(true)}
                                className="p-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-400 hover:text-blue-600"
                              >
                                <ICONS.Upload className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">代替文本 (Alt)</label>
                            <input 
                              type="text" 
                              value={selectedBlock.content.alt}
                              onChange={(e) => updateBlockContent(selectedBlock.id, { alt: e.target.value })}
                              className="w-full p-2 text-xs border border-slate-200 rounded-lg outline-none"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">跳转链接 (URL)</label>
                            <input 
                              type="text" 
                              value={selectedBlock.content.link}
                              onChange={(e) => updateBlockContent(selectedBlock.id, { link: e.target.value })}
                              className="w-full p-2 text-xs border border-slate-200 rounded-lg outline-none"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">宽度 (%)</label>
                              <input 
                                type="number" 
                                value={selectedBlock.content.width}
                                onChange={(e) => updateBlockContent(selectedBlock.id, { width: parseInt(e.target.value) })}
                                className="w-full p-2 text-xs border border-slate-200 rounded-lg outline-none"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">圆角 (px)</label>
                              <input 
                                type="number" 
                                value={selectedBlock.content.borderRadius}
                                onChange={(e) => updateBlockContent(selectedBlock.id, { borderRadius: parseInt(e.target.value) })}
                                className="w-full p-2 text-xs border border-slate-200 rounded-lg outline-none"
                              />
                            </div>
                          </div>
                        </>
                      )}

                      {selectedBlock.type === 'button' && (
                        <>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">按钮文字</label>
                            <input 
                              type="text" 
                              value={selectedBlock.content.text}
                              onChange={(e) => updateBlockContent(selectedBlock.id, { text: e.target.value })}
                              className="w-full p-2 text-xs border border-slate-200 rounded-lg outline-none"
                            />
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">背景颜色</label>
                              <input 
                                type="color" 
                                value={selectedBlock.content.bg}
                                onChange={(e) => updateBlockContent(selectedBlock.id, { bg: e.target.value })}
                                className="w-full h-8 rounded border border-slate-200"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">文字颜色</label>
                              <input 
                                type="color" 
                                value={selectedBlock.content.color}
                                onChange={(e) => updateBlockContent(selectedBlock.id, { color: e.target.value })}
                                className="w-full h-8 rounded border border-slate-200"
                              />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">边框颜色</label>
                              <input 
                                type="color" 
                                value={selectedBlock.content.borderColor}
                                onChange={(e) => updateBlockContent(selectedBlock.id, { borderColor: e.target.value })}
                                className="w-full h-8 rounded border border-slate-200"
                              />
                            </div>
                            <div className="space-y-1.5">
                              <label className="text-[10px] font-bold text-slate-400 uppercase">圆角 (px)</label>
                              <input 
                                type="number" 
                                value={selectedBlock.content.borderRadius}
                                onChange={(e) => updateBlockContent(selectedBlock.id, { borderRadius: parseInt(e.target.value) })}
                                className="w-full p-2 text-xs border border-slate-200 rounded-lg outline-none"
                              />
                            </div>
                          </div>
                        </>
                      )}

                      {selectedBlock.type === 'product' && (
                        <>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">展示列数</label>
                            <div className="flex p-1 bg-slate-100 rounded-lg">
                              {[1, 2, 3].map(c => (
                                <button 
                                  key={c}
                                  onClick={() => updateBlockContent(selectedBlock.id, { columns: c })}
                                  className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${selectedBlock.content.columns === c ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-400'}`}
                                >
                                  {c} 列
                                </button>
                              ))}
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <label className="text-[10px] font-bold text-slate-400 uppercase">按钮文案</label>
                            <input 
                              type="text" 
                              value={selectedBlock.content.buttonText}
                              onChange={(e) => updateBlockContent(selectedBlock.id, { buttonText: e.target.value })}
                              className="w-full p-2 text-xs border border-slate-200 rounded-lg outline-none"
                            />
                          </div>
                          <div className="space-y-3 pt-2">
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-600">显示商品名称</span>
                              <button 
                                onClick={() => updateBlockContent(selectedBlock.id, { showName: !selectedBlock.content.showName })}
                                className={`w-8 h-4 rounded-full transition-all relative ${selectedBlock.content.showName ? 'bg-blue-600' : 'bg-slate-200'}`}
                              >
                                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${selectedBlock.content.showName ? 'right-0.5' : 'left-0.5'}`} />
                              </button>
                            </div>
                            <div className="flex items-center justify-between">
                              <span className="text-xs text-slate-600">显示价格</span>
                              <button 
                                onClick={() => updateBlockContent(selectedBlock.id, { showPrice: !selectedBlock.content.showPrice })}
                                className={`w-8 h-4 rounded-full transition-all relative ${selectedBlock.content.showPrice ? 'bg-blue-600' : 'bg-slate-200'}`}
                              >
                                <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${selectedBlock.content.showPrice ? 'right-0.5' : 'left-0.5'}`} />
                              </button>
                            </div>
                          </div>
                        </>
                      )}

                      {selectedBlock.type === 'footer' && (
                        <div className="space-y-4">
                          {[
                            { key: 'showStoreName', label: '显示店铺名称', textKey: 'storeName' },
                            { key: 'showAddress', label: '显示地址', textKey: 'address' },
                            { key: 'showPhone', label: '显示电话', textKey: 'phone' },
                            { key: 'showEmail', label: '显示邮箱', textKey: 'email' },
                            { key: 'showUnsubscribe', label: '显示退订信息', textKey: 'unsubscribeText' },
                          ].map(item => (
                            <div key={item.key} className="space-y-2">
                              <div className="flex items-center justify-between">
                                <span className="text-xs text-slate-600">{item.label}</span>
                                <button 
                                  onClick={() => updateBlockContent(selectedBlock.id, { [item.key]: !selectedBlock.content[item.key] })}
                                  className={`w-8 h-4 rounded-full transition-all relative ${selectedBlock.content[item.key] ? 'bg-blue-600' : 'bg-slate-200'}`}
                                >
                                  <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-all ${selectedBlock.content[item.key] ? 'right-0.5' : 'left-0.5'}`} />
                                </button>
                              </div>
                              {selectedBlock.content[item.key] && (
                                <input 
                                  type="text"
                                  value={selectedBlock.content[item.textKey]}
                                  onChange={(e) => updateBlockContent(selectedBlock.id, { [item.textKey]: e.target.value })}
                                  className="w-full p-2 text-xs border border-slate-200 rounded-lg outline-none bg-slate-50"
                                />
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      <div className="pt-4 border-t border-slate-100">
                        <label className="text-[10px] font-bold text-slate-400 uppercase block mb-2">间距 (上下左右)</label>
                        <div className="grid grid-cols-4 gap-2">
                          {[0, 1, 2, 3].map(i => (
                            <input 
                              key={i}
                              type="number" 
                              value={selectedBlock.content.padding?.[i] || 0}
                              onChange={(e) => {
                                const newPadding = [...(selectedBlock.content.padding || [0, 0, 0, 0])];
                                newPadding[i] = parseInt(e.target.value);
                                updateBlockContent(selectedBlock.id, { padding: newPadding });
                              }}
                              className="w-full p-2 text-xs border border-slate-200 rounded-lg outline-none"
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-slate-400 space-y-4 text-center">
                    <div className="p-4 bg-slate-50 rounded-full border border-slate-100">
                      <ICONS.Palette className="w-8 h-8 opacity-20" />
                    </div>
                    <p className="text-xs">点击画布中的组件<br/>进行详细样式编辑</p>
                  </div>
                )}
              </AnimatePresence>
            </div>
          </>
        ) : (
          /* Settings Step */
          <div className="flex-1 bg-slate-50 overflow-y-auto p-12 flex justify-center">
            <div className="w-[600px] space-y-8">
              <div className="bg-white p-8 rounded-2xl border border-slate-200 shadow-sm space-y-6">
                <h3 className="text-lg font-bold text-slate-900">发送设置</h3>
                
                <div className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">邮件标题 (内部管理)</label>
                    <input 
                      type="text" 
                      value={settings.title}
                      onChange={(e) => setSettings({ ...settings, title: e.target.value })}
                      placeholder="例如：2026 春季大促第一波"
                      className="w-full p-3 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">发件主题 (客户可见)</label>
                    <input 
                      type="text" 
                      value={settings.subject}
                      onChange={(e) => setSettings({ ...settings, subject: e.target.value })}
                      placeholder="例如：复活节快乐！专属优惠等你来"
                      className="w-full p-3 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-slate-700">摘要内容</label>
                    <input 
                      type="text" 
                      value={settings.summary}
                      onChange={(e) => setSettings({ ...settings, summary: e.target.value })}
                      placeholder="显示在收件箱预览中的简短文字"
                      className="w-full p-3 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">发件人</label>
                      <input 
                        type="text" 
                        value={settings.sender}
                        onChange={(e) => setSettings({ ...settings, sender: e.target.value })}
                        placeholder="marketing@yourstore.com"
                        className="w-full p-3 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-slate-700">收件人细分</label>
                      <div className="flex gap-2">
                        <select 
                          value={settings.segmentId}
                          onChange={(e) => setSettings({ ...settings, segmentId: e.target.value })}
                          className="flex-1 p-3 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20"
                        >
                          <option value="all">所有订阅客户 (1,240)</option>
                          <option value="vip">VIP 客户 (120)</option>
                          <option value="inactive">沉睡客户 (450)</option>
                        </select>
                        <button 
                          onClick={onGoToSegments}
                          className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-400 hover:text-blue-600 transition-colors"
                          title="管理细分"
                        >
                          <ICONS.Plus className="w-5 h-5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4 pt-4 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">定时发送</label>
                      <button 
                        onClick={() => setSettings({ ...settings, isScheduled: !settings.isScheduled })}
                        className={`w-10 h-5 rounded-full transition-all relative ${settings.isScheduled ? 'bg-blue-600' : 'bg-slate-200'}`}
                      >
                        <div className={`absolute top-0.5 w-4 h-4 bg-white rounded-full transition-all ${settings.isScheduled ? 'right-0.5' : 'left-0.5'}`} />
                      </button>
                    </div>
                    
                    {settings.isScheduled && (
                      <motion.div 
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        className="space-y-1.5"
                      >
                        <label className="text-[10px] font-bold text-slate-400 uppercase">选择发送时间</label>
                        <input 
                          type="datetime-local" 
                          value={settings.scheduledTime}
                          onChange={(e) => setSettings({ ...settings, scheduledTime: e.target.value })}
                          className="w-full p-3 text-sm border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20"
                        />
                      </motion.div>
                    )}
                  </div>
                </div>
              </div>

              <div className="bg-blue-50 p-6 rounded-2xl border border-blue-100 flex items-start gap-4">
                <div className="p-2 bg-white rounded-lg shadow-sm">
                  <ICONS.Help className="w-5 h-5 text-blue-600" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-bold text-blue-900">准备好了吗？</p>
                  <p className="text-xs text-blue-600 leading-relaxed">
                    在发送之前，我们建议您先发送一封测试邮件到自己的邮箱，以确保在不同设备上的显示效果都符合预期。
                  </p>
                  <button className="text-xs font-bold text-blue-700 underline mt-2">发送测试邮件</button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <MediaLibrary 
        isOpen={isMediaLibraryOpen}
        onClose={() => setIsMediaLibraryOpen(false)}
        onSelect={handleMediaSelect}
        multiSelect={false}
      />
    </div>
  );
};

export default EmailEditor;
