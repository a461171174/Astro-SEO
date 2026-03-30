
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { geminiService } from '../services/geminiService';
import { ICONS } from '../constants';
import { isAbortError } from '../utils';

interface AIChatPanelProps {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  initialMessage?: string;
  onClearInitialMessage?: () => void;
}

interface Message {
  role: 'user' | 'ai';
  content: string;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  timestamp: number;
}

const AIChatPanel: React.FC<AIChatPanelProps> = ({ isOpen, setIsOpen, initialMessage, onClearInitialMessage }) => {
  const [sessions, setSessions] = useState<ChatSession[]>([
    { 
      id: '1', 
      title: '欢迎会话', 
      messages: [{ role: 'ai', content: '您好！我是您的 AI 店铺助手。您可以让我帮您创建商品、写博客、创建客户、装修店铺、优化 SEO 或分析数据。' }],
      timestamp: Date.now() 
    }
  ]);
  const [activeSessionId, setActiveSessionId] = useState('1');
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const messages = activeSession.messages;

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const createNewSession = (initialText?: string) => {
    const newSession: ChatSession = {
      id: Date.now().toString(),
      title: initialText ? (initialText.length > 15 ? initialText.substring(0, 15) + '...' : initialText) : '新会话',
      messages: [],
      timestamp: Date.now()
    };
    setSessions(prev => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
    return newSession.id;
  };

  const handleSend = useCallback(async (text?: string, sessionId?: string) => {
    const messageToSend = text || input;
    if (!messageToSend.trim() || isLoading) return;

    const targetSessionId = sessionId || activeSessionId;
    const userMsg = messageToSend;
    if (!text) setInput('');

    setSessions(prev => prev.map(s => {
      if (s.id === targetSessionId) {
        return { ...s, messages: [...s.messages, { role: 'user', content: userMsg }] };
      }
      return s;
    }));

    setIsLoading(true);
    try {
      const result = await geminiService.processChatCommand(userMsg);
      
      let aiResponse = '';
      switch (result.type) {
        case 'CREATE_PRODUCT':
          aiResponse = `好的，我已为您准备好商品草案：\n名称：${result.data.name}\n价格：${result.data.price}\n类别：${result.data.category}\n描述：${result.data.description}\n\n是否立即发布？`;
          break;
        case 'CREATE_BLOG':
          aiResponse = `已为您生成博客文章草案：\n标题：${result.data.title}\n标签：${result.data.tags?.join(', ')}\n内容摘要：${result.data.content?.substring(0, 100)}...\n\n您可以前往“博客管理”查看全文。`;
          break;
        case 'CREATE_CUSTOMER':
          aiResponse = `已为您识别新客户信息：\n姓名：${result.data.name}\n公司：${result.data.company}\n邮箱：${result.data.email}\n\n是否将其添加到您的客户列表？`;
          break;
        case 'DECORATE_STORE':
          aiResponse = `关于店铺装修的建议：\n${result.data.suggestion}\n推荐主题色：${result.data.themeColor}\n\n您可以点击“装修”模块应用这些更改。`;
          break;
        case 'OPTIMIZE_SEO':
          aiResponse = `SEO 优化建议：\n关键词：${result.data.keywords?.join(', ')}\nMeta 描述：${result.data.metaDescription}\n具体建议：\n${result.data.suggestions?.map((s: string) => `- ${s}`).join('\n')}`;
          break;
        case 'ANALYZE_DATA':
          aiResponse = `根据最新数据分析：${result.data.insight}`;
          break;
        default:
          aiResponse = result.data.response;
      }

      setSessions(prev => prev.map(s => {
        if (s.id === targetSessionId) {
          return { ...s, messages: [...s.messages, { role: 'ai', content: aiResponse }] };
        }
        return s;
      }));
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('AI Chat error:', error);
      setSessions(prev => prev.map(s => {
        if (s.id === targetSessionId) {
          return { ...s, messages: [...s.messages, { role: 'ai', content: '抱歉，处理您的请求时发生了错误。请稍后再试。' }] };
        }
        return s;
      }));
    } finally {
      setIsLoading(false);
    }
  }, [input, isLoading, activeSessionId]);

  useEffect(() => {
    if (initialMessage) {
      const newId = createNewSession(initialMessage);
      handleSend(initialMessage, newId);
      onClearInitialMessage?.();
    }
  }, [initialMessage, handleSend, onClearInitialMessage]);

  return (
    <>
      {/* Chat Window - Side Panel */}
      {isOpen && (
        <div className="fixed top-14 right-0 bottom-0 w-[800px] bg-white shadow-2xl border-l border-slate-200 flex overflow-hidden z-[60] animate-in slide-in-from-right duration-300">
          {/* Session Sidebar */}
          <div className="w-56 bg-slate-50 border-r border-slate-200 flex flex-col">
            <div className="p-4 border-b border-slate-200">
              <button 
                onClick={() => createNewSession()}
                className="w-full py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold text-slate-600 hover:border-blue-500 hover:text-blue-600 transition-all flex items-center justify-center gap-2 shadow-sm"
              >
                <ICONS.Plus className="w-3 h-3" />
                新会话
              </button>
            </div>
            <div className="px-4 py-3">
              <h4 className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">对话历史</h4>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
              {sessions.map(session => (
                <button
                  key={session.id}
                  onClick={() => setActiveSessionId(session.id)}
                  className={`w-full p-3 rounded-xl text-left transition-all group relative border ${
                    activeSessionId === session.id 
                      ? 'bg-white text-blue-600 border-blue-200 shadow-sm' 
                      : 'hover:bg-slate-100 text-slate-500 border-transparent'
                  }`}
                >
                  <div className="text-[11px] font-bold truncate pr-4 leading-tight" title={session.title}>{session.title}</div>
                  <div className="flex items-center justify-between mt-1.5">
                    <div className="text-[9px] opacity-40">
                      {new Date(session.timestamp).toLocaleDateString([], { month: 'short', day: 'numeric' })}
                    </div>
                    <div className="text-[9px] opacity-40">
                      {new Date(session.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </div>
                  </div>
                  {sessions.length > 1 && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSessions(prev => prev.filter(s => s.id !== session.id));
                        if (activeSessionId === session.id) {
                          const remaining = sessions.filter(s => s.id !== session.id);
                          if (remaining.length > 0) setActiveSessionId(remaining[0].id);
                        }
                      }}
                      className="absolute right-2 top-3 opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 transition-opacity bg-white/80 rounded-md shadow-sm"
                    >
                      <ICONS.Plus className="w-3 h-3 rotate-45" />
                    </button>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Chat Content */}
          <div className="flex-1 flex flex-col bg-white">
            {/* Header */}
            <div className="p-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                  <span>✨</span>
                </div>
                <div>
                  <h3 className="text-sm font-bold">{activeSession.title}</h3>
                  <p className="text-[10px] opacity-80">AI 店铺助手 · Gemini 3.1 Pro</p>
                </div>
              </div>
              <button 
                onClick={() => setIsOpen(false)}
                className="p-1.5 hover:bg-white/20 rounded-lg transition-colors"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
            {messages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] p-3 rounded-2xl text-sm ${
                  msg.role === 'user' 
                    ? 'bg-blue-600 text-white rounded-tr-none' 
                    : 'bg-white text-slate-700 shadow-sm border border-slate-100 rounded-tl-none'
                }`}>
                  {msg.content.split('\n').map((line, j) => (
                    <p key={j}>{line}</p>
                  ))}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 rounded-tl-none flex gap-1">
                  <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" />
                  <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.2s]" />
                  <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce [animation-delay:0.4s]" />
                </div>
              </div>
            )}
          </div>

          {/* Quick Actions */}
          <div className="px-4 py-2 bg-white border-t border-slate-100 flex gap-2 overflow-x-auto no-scrollbar">
            {[
              { label: '创建商品', icon: '📦' },
              { label: '写博客', icon: '✍️' },
              { label: 'SEO 优化', icon: '🔍' },
              { label: '装修建议', icon: '🎨' },
              { label: '数据分析', icon: '📊' }
            ].map(action => (
              <button 
                key={action.label}
                onClick={() => handleSend(action.label)}
                className="flex-shrink-0 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full text-[10px] font-bold text-slate-600 hover:bg-blue-50 hover:border-blue-200 hover:text-blue-600 transition-all flex items-center gap-1.5"
              >
                <span>{action.icon}</span>
                {action.label}
              </button>
            ))}
          </div>

          {/* Input */}
          <div className="p-4 border-t border-slate-100 bg-white">
            <div className="flex items-center gap-2 bg-slate-100 rounded-xl px-3 py-2 focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
              <input 
                type="text" 
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                placeholder="输入指令，如：分析上周询盘趋势"
                className="flex-1 bg-transparent border-none outline-none text-sm"
              />
              <button 
                onClick={() => handleSend()}
                disabled={!input.trim() || isLoading}
                className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 12h14M12 5l7 7-7 7" /></svg>
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
  </>
);
};

export default AIChatPanel;
