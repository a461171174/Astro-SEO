
import React, { useState } from 'react';
import { ICONS } from '../constants';

interface HeaderProps {
  onAISubmit: (text: string) => void;
  isAILoading?: boolean;
}

const Header: React.FC<HeaderProps> = ({ onAISubmit, isAILoading }) => {
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isAILoading) {
      onAISubmit(input);
      setInput('');
    }
  };

  return (
    <header className="h-14 border-b border-slate-200 bg-white grid grid-cols-[1fr_auto_1fr] items-center px-6 sticky top-0 z-10">
      <div className="flex items-center">
        {/* Left spacer or potential logo/breadcrumb area */}
      </div>
      <div className="w-[600px] max-w-full">
        <form onSubmit={handleSubmit} className="relative group">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
            <span className="text-lg group-focus-within:scale-110 transition-transform">✨</span>
          </div>
          <input 
            type="text" 
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="问问 AI 助手，如：分析上周询盘趋势"
            className="w-full h-10 pl-10 pr-12 bg-slate-100 border-none rounded-full text-sm focus:ring-2 focus:ring-blue-500/30 focus:bg-white transition-all placeholder:text-slate-400 shadow-inner"
          />
          <div className="absolute inset-y-0 right-1.5 flex items-center">
            {isAILoading ? (
              <div className="mr-2 w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
            ) : (
              <button
                type="submit"
                disabled={!input.trim()}
                className={`w-7 h-7 rounded-full flex items-center justify-center transition-all duration-300 ${
                  input.trim() 
                    ? 'bg-gradient-to-tr from-blue-600 to-indigo-600 text-white shadow-lg hover:scale-110 active:scale-95 ring-2 ring-blue-500/20' 
                    : 'bg-slate-200 text-slate-400 cursor-not-allowed'
                }`}
              >
                <svg className={`w-3.5 h-3.5 transition-transform duration-300 ${input.trim() ? 'translate-x-0.5' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 12h14M12 5l7 7-7 7" />
                </svg>
              </button>
            )}
          </div>
        </form>
      </div>
      <div className="flex items-center justify-end gap-4">
        <button 
          onClick={() => onAISubmit('')}
          className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors relative group"
          title="AI 助手"
        >
          <ICONS.Inquiry className="w-5 h-5" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-blue-500 rounded-full border-2 border-white"></span>
          <div className="absolute -bottom-10 right-0 bg-slate-800 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
            查看 AI 对话
          </div>
        </button>
      </div>
    </header>
  );
};

export default Header;
