
import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ICONS } from '../constants';
import { Product } from '../types';
import { isAbortError } from '../utils';

interface SocialMarketingProps {
  products: Product[];
  onOpenSettings?: () => void;
}

interface SocialPost {
  id: string;
  content: string;
  platforms: string[];
  media: { url: string; type: 'image' | 'video' }[];
  status: 'success' | 'failed';
  timestamp: string;
}

const SocialMarketing: React.FC<SocialMarketingProps> = ({ products, onOpenSettings }) => {
  const [connectedAccounts, setConnectedAccounts] = useState<string[]>(['facebook', 'instagram']);
  const [postContent, setPostContent] = useState('');
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [media, setMedia] = useState<{ url: string; type: 'image' | 'video' }[]>([]);
  const [isAiModalOpen, setIsAiModalOpen] = useState(false);
  const [isConnectModalOpen, setIsConnectModalOpen] = useState(false);
  const [connectingPlatform, setConnectingPlatform] = useState<{ id: string; name: string } | null>(null);
  const [invitationCode, setInvitationCode] = useState('');
  const [isPublishing, setIsPublishing] = useState(false);
  const [aiRequirement, setAiRequirement] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [postHistory, setPostHistory] = useState<SocialPost[]>([
    {
      id: 'h1',
      content: '✨ 发现这款超赞的智能宠物喂食机 Pro！快来选购吧，限时优惠不容错过！',
      platforms: ['facebook', 'instagram'],
      media: [{ url: 'https://picsum.photos/seed/p1/800/800', type: 'image' }],
      status: 'success',
      timestamp: '2024-03-15 10:00'
    },
    {
      id: 'h2',
      content: '我们的春季新品系列现已上线！探索更多智能宠物用品。',
      platforms: ['facebook'],
      media: [{ url: 'https://picsum.photos/seed/p2/800/800', type: 'image' }],
      status: 'success',
      timestamp: '2024-03-14 15:30'
    }
  ]);
  const [selectedHistoryPost, setSelectedHistoryPost] = useState<SocialPost | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const platforms = [
    { id: 'facebook', name: 'Facebook', icon: 'FB', color: 'bg-[#1877F2]' },
    { id: 'instagram', name: 'Instagram', icon: 'IG', color: 'bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]' },
    { id: 'x', name: 'X', icon: 'X', color: 'bg-black' },
    { id: 'tiktok', name: 'TikTok', icon: 'TT', color: 'bg-black' },
  ];

  const handleConnect = async () => {
    if (!connectingPlatform || !invitationCode.trim()) return;

    try {
      const response = await fetch('/api/social/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ platform: connectingPlatform.id, invitationCode }),
      });

      if (response.ok) {
        setConnectedAccounts(prev => [...prev, connectingPlatform.id]);
        setIsConnectModalOpen(false);
        setInvitationCode('');
        setConnectingPlatform(null);
      } else {
        alert('绑定失败，请检查邀请码');
      }
    } catch (error) {
      if (isAbortError(error)) return;
      alert('连接服务器失败');
    }
  };

  const handleDisconnect = (id: string) => {
    setConnectedAccounts(prev => prev.filter(a => a !== id));
    setSelectedPlatforms(prev => prev.filter(p => p !== id));
  };

  const togglePlatform = (id: string) => {
    if (selectedPlatforms.includes(id)) {
      setSelectedPlatforms(prev => prev.filter(p => p !== id));
    } else {
      setSelectedPlatforms(prev => [...prev, id]);
    }
  };

  const handlePost = async () => {
    if (!postContent.trim() && media.length === 0) {
      alert('请输入内容或上传媒体文件');
      return;
    }
    if (selectedPlatforms.length === 0) {
      alert('请选择至少一个平台');
      return;
    }

    setIsPublishing(true);
    try {
      const response = await fetch('/api/social/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          content: postContent, 
          platforms: selectedPlatforms,
          media: media.map(m => ({ type: m.type, url: m.url }))
        }),
      });

      if (response.ok) {
        const newPost: SocialPost = {
          id: Date.now().toString(),
          content: postContent,
          platforms: [...selectedPlatforms],
          media: [...media],
          status: 'success',
          timestamp: new Date().toLocaleString('zh-CN', { hour12: false }).replace(/\//g, '-')
        };
        setPostHistory(prev => [newPost, ...prev]);
        alert('发布成功！');
        setPostContent('');
        setSelectedPlatforms([]);
        setMedia([]);
      } else {
        alert('发布失败，请稍后重试');
      }
    } catch (error) {
      if (isAbortError(error)) return;
      alert('连接服务器失败');
    } finally {
      setIsPublishing(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const url = URL.createObjectURL(file);
        const type = file.type.startsWith('video') ? 'video' : 'image';
        setMedia(prev => [...prev, { url, type }]);
      });
    }
  };

  const removeMedia = (index: number) => {
    setMedia(prev => prev.filter((_, i) => i !== index));
  };

  const generateAiPost = () => {
    const product = products.find(p => p.id === selectedProductId);
    const prompt = `要求: ${aiRequirement}${product ? `\n商品: ${product.title}` : ''}`;
    
    // Simulate AI generation
    setPostContent(`✨ [AI 生成] 发现这款超赞的${product?.title || '新品'}！\n\n${aiRequirement || '快来选购吧，限时优惠不容错过！'}\n\n#新品上市 #购物分享 #HappyPaws`);
    setIsAiModalOpen(false);
    setAiRequirement('');
    setSelectedProductId(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">社媒营销</h1>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-400">已绑定 {connectedAccounts.length} 个账号</span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-6">
        {/* Left Column: Post Creation */}
        <div className="col-span-2 space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900">创建新动态</h3>
            <div className="space-y-4">
              <textarea
                value={postContent}
                onChange={(e) => setPostContent(e.target.value)}
                placeholder="分享你的故事..."
                className="w-full h-32 p-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-blue-500 transition-all resize-none text-slate-700"
              />

              {/* Media Preview */}
              {media.length > 0 && (
                <div className="flex gap-3 overflow-x-auto pb-2">
                  {media.map((item, i) => (
                    <div key={i} className="relative flex-shrink-0 w-24 h-24 rounded-lg overflow-hidden border border-slate-200 group">
                      {item.type === 'image' ? (
                        <img src={item.url} className="w-full h-full object-cover" alt="upload" />
                      ) : (
                        <video src={item.url} className="w-full h-full object-cover" />
                      )}
                      <button 
                        onClick={() => removeMedia(i)}
                        className="absolute top-1 right-1 w-5 h-5 bg-black/50 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <ICONS.Plus className="w-3 h-3 rotate-45" />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex items-center gap-4">
                <button 
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-lg text-sm font-medium transition-colors"
                >
                  <ICONS.Plus className="w-4 h-4" />
                  上传图文/视频
                </button>
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  multiple 
                  accept="image/*,video/*" 
                  onChange={handleFileUpload}
                />
              </div>
            </div>
            
            <div className="space-y-3 pt-2">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">发布到</p>
              <div className="flex gap-3">
                {platforms.map(platform => {
                  const isConnected = connectedAccounts.includes(platform.id);
                  const isSelected = selectedPlatforms.includes(platform.id);
                  return (
                    <button
                      key={platform.id}
                      disabled={!isConnected}
                      onClick={() => togglePlatform(platform.id)}
                      className={`flex items-center gap-2 px-4 py-2 rounded-full border transition-all ${
                        !isConnected 
                          ? 'opacity-40 grayscale cursor-not-allowed border-slate-100' 
                          : isSelected
                            ? 'border-blue-600 bg-blue-50 text-blue-700'
                            : 'border-slate-200 hover:border-slate-300 text-slate-600'
                      }`}
                    >
                      <div className={`w-5 h-5 rounded-md ${platform.color} flex items-center justify-center text-[10px] font-bold text-white`}>
                        {platform.icon}
                      </div>
                      <span className="text-sm font-medium">{platform.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 flex justify-end items-center gap-3">
              <button
                onClick={() => setIsAiModalOpen(true)}
                className="px-4 py-2.5 border border-blue-600 text-blue-600 rounded-full font-bold hover:bg-blue-50 transition-all flex items-center gap-2"
              >
                <span>智能发帖 ✨</span>
              </button>
              <button
                onClick={handlePost}
                className="px-8 py-2.5 bg-blue-600 text-white rounded-full font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 disabled:opacity-50 disabled:shadow-none flex items-center gap-2"
                disabled={isPublishing || (!postContent.trim() && media.length === 0) || selectedPlatforms.length === 0}
              >
                {isPublishing ? (
                  <>
                    <svg className="animate-spin h-4 w-4 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    发布中...
                  </>
                ) : '立即发布'}
              </button>
            </div>
          </div>

          {/* History / Queue Placeholder */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4">发布记录</h3>
            <div className="space-y-4">
              {postHistory.length > 0 ? (
                postHistory.map(post => (
                  <div key={post.id} className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-white rounded-lg border border-slate-200 flex items-center justify-center overflow-hidden">
                        {post.media.length > 0 ? (
                          post.media[0].type === 'image' ? (
                            <img src={post.media[0].url} className="w-full h-full object-cover" alt="" />
                          ) : (
                            <div className="bg-slate-100 w-full h-full flex items-center justify-center">
                              <ICONS.Video className="w-4 h-4 text-slate-400" />
                            </div>
                          )
                        ) : (
                          <ICONS.Marketing className="w-5 h-5 text-slate-400" />
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900 line-clamp-1" title={post.content || '无文字内容'}>{post.content || '无文字内容'}</p>
                        <p className="text-xs text-slate-400">
                          {post.timestamp} · 已发布到 {post.platforms.map(p => platforms.find(pl => pl.id === p)?.name).join(', ')}
                        </p>
                      </div>
                    </div>
                    <button 
                      onClick={() => setSelectedHistoryPost(post)}
                      className="text-blue-600 text-xs font-bold hover:underline flex-shrink-0"
                    >
                      查看详情
                    </button>
                  </div>
                ))
              ) : (
                <div className="py-12 text-center text-slate-400">
                  <p className="text-sm">暂无发布记录</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Account Management */}
        <div className="space-y-6">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-bold text-slate-900">账号绑定</h3>
              <button 
                onClick={onOpenSettings}
                className="text-blue-600 text-xs font-bold hover:underline flex items-center gap-1"
              >
                <ICONS.Plus className="w-3 h-3" />
                绑定更多
              </button>
            </div>
            <div className="space-y-3">
              {platforms.map(platform => {
                const isConnected = connectedAccounts.includes(platform.id);
                return (
                  <div key={platform.id} className="flex items-center justify-between p-3 border border-slate-100 rounded-xl">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg ${platform.color} flex items-center justify-center text-xs font-bold text-white`}>
                        {platform.icon}
                      </div>
                      <span className="text-sm font-medium text-slate-700">{platform.name}</span>
                    </div>
                    <button
                      onClick={() => {
                        if (isConnected) {
                          handleDisconnect(platform.id);
                        } else {
                          setConnectingPlatform(platform);
                          setIsConnectModalOpen(true);
                        }
                      }}
                      className={`px-3 py-1 rounded-full text-xs font-bold transition-all ${
                        isConnected 
                          ? 'bg-slate-100 text-slate-500 hover:bg-red-50 hover:text-red-600' 
                          : 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                      }`}
                    >
                      {isConnected ? '解除绑定' : '立即绑定'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-2xl p-6 text-white shadow-xl">
            <h3 className="font-bold mb-2">社媒助手</h3>
            <p className="text-xs text-indigo-100 mb-4 leading-relaxed">
              使用 AI 智能发帖功能，可以根据商品详情或您的要求，自动生成多平台适配的营销内容。
            </p>
            <div className="flex items-center gap-2 text-xs font-bold text-white/60">
              <span>✨ 已就绪</span>
            </div>
          </div>
        </div>
      </div>

      {/* AI Post Generation Modal */}
      <AnimatePresence>
        {isAiModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAiModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-xl bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900">智能发帖 ✨</h2>
                  <button onClick={() => setIsAiModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <ICONS.Plus className="w-6 h-6 rotate-45" />
                  </button>
                </div>

                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">发布要求</label>
                    <textarea 
                      value={aiRequirement}
                      onChange={(e) => setAiRequirement(e.target.value)}
                      placeholder="例如：为夏季新品写一段吸引人的文案，风格活泼一点..."
                      className="w-full h-24 p-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-blue-500 transition-all resize-none text-slate-700"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">关联商品 (可选)</label>
                    <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto pr-2 no-scrollbar">
                      {products.map(product => (
                        <button
                          key={product.id}
                          onClick={() => setSelectedProductId(selectedProductId === product.id ? null : product.id)}
                          className={`flex items-center gap-3 p-2 rounded-xl border transition-all text-left ${
                            selectedProductId === product.id 
                              ? 'border-blue-600 bg-blue-50' 
                              : 'border-slate-100 hover:border-slate-200'
                          }`}
                        >
                          <img src={product.media[0]?.url || 'https://picsum.photos/100/100'} className="w-10 h-10 rounded-lg object-cover" alt="" />
                          <span className="text-xs font-medium text-slate-700 line-clamp-1" title={product.title}>{product.title}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    onClick={generateAiPost}
                    className="w-full py-3 bg-blue-600 text-white rounded-full font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                  >
                    开始生成
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Connection Modal */}
      <AnimatePresence>
        {isConnectModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsConnectModalOpen(false)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl ${platforms.find(p => p.id === connectingPlatform?.id)?.color} flex items-center justify-center text-white font-bold`}>
                      {platforms.find(p => p.id === connectingPlatform?.id)?.icon}
                    </div>
                    <h2 className="text-xl font-bold text-slate-900">绑定 {connectingPlatform?.name}</h2>
                  </div>
                  <button onClick={() => setIsConnectModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                    <ICONS.Plus className="w-6 h-6 rotate-45" />
                  </button>
                </div>

                <div className="space-y-4">
                  <p className="text-sm text-slate-500 leading-relaxed">
                    请在 {connectingPlatform?.name} 开发者平台获取绑定邀请码或访问令牌，输入下方以完成对接。
                  </p>
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-slate-400 uppercase tracking-wider">绑定邀请码 / Token</label>
                    <input 
                      type="password"
                      value={invitationCode}
                      onChange={(e) => setInvitationCode(e.target.value)}
                      placeholder="输入 32 位邀请码..."
                      className="w-full p-4 bg-slate-50 border border-slate-100 rounded-xl outline-none focus:border-blue-500 transition-all text-slate-700"
                    />
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    onClick={handleConnect}
                    className="w-full py-3 bg-blue-600 text-white rounded-full font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                  >
                    确认绑定
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Post Detail Modal */}
      <AnimatePresence>
        {selectedHistoryPost && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedHistoryPost(null)}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl bg-white rounded-[32px] shadow-2xl overflow-hidden"
            >
              <div className="p-8 space-y-6 max-h-[90vh] overflow-y-auto no-scrollbar">
                <div className="flex items-center justify-between">
                  <h2 className="text-xl font-bold text-slate-900">动态详情</h2>
                  <button onClick={() => setSelectedHistoryPost(null)} className="text-slate-400 hover:text-slate-600">
                    <ICONS.Plus className="w-6 h-6 rotate-45" />
                  </button>
                </div>

                <div className="space-y-6">
                  <div className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="space-y-1">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">发布时间</p>
                      <p className="text-sm font-medium text-slate-900">{selectedHistoryPost.timestamp}</p>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">状态</p>
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700">
                        发布成功
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">发布内容</p>
                    <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
                      {selectedHistoryPost.content || '无文字内容'}
                    </div>
                  </div>

                  {selectedHistoryPost.media.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">媒体文件</p>
                      <div className="grid grid-cols-2 gap-4">
                        {selectedHistoryPost.media.map((m, i) => (
                          <div key={i} className="aspect-square rounded-2xl overflow-hidden border border-slate-100 bg-slate-50">
                            {m.type === 'image' ? (
                              <img src={m.url} className="w-full h-full object-cover" alt="" />
                            ) : (
                              <video src={m.url} controls className="w-full h-full object-cover" />
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="space-y-2">
                    <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">发布平台</p>
                    <div className="flex gap-3">
                      {selectedHistoryPost.platforms.map(pId => {
                        const platform = platforms.find(pl => pl.id === pId);
                        return (
                          <div key={pId} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-slate-50 border border-slate-100">
                            <div className={`w-5 h-5 rounded-md ${platform?.color} flex items-center justify-center text-[10px] font-bold text-white`}>
                              {platform?.icon}
                            </div>
                            <span className="text-xs font-medium text-slate-700">{platform?.name}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="pt-4">
                  <button 
                    onClick={() => setSelectedHistoryPost(null)}
                    className="w-full py-3 bg-slate-100 text-slate-600 rounded-full font-bold hover:bg-slate-200 transition-all"
                  >
                    关闭
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

export default SocialMarketing;
