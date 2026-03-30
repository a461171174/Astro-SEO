
import React, { useState } from 'react';
import { ICONS } from '../constants';
import { geminiService } from '../services/geminiService';
import { useToast } from './Toast';
import { isAbortError } from '../utils';

interface SEOSectionProps {
  title: string;
  content: string;
  seoTitle: string;
  seoDescription: string;
  seoUrl: string;
  urlPrefix: string;
  onUpdate: (updates: { seoTitle?: string; seoDescription?: string; seoUrl?: string }) => void;
  onManualTitleChange: () => void;
  onManualUrlChange: () => void;
}

const SEOSection: React.FC<SEOSectionProps> = ({
  title,
  content,
  seoTitle,
  seoDescription,
  seoUrl,
  urlPrefix,
  onUpdate,
  onManualTitleChange,
  onManualUrlChange
}) => {
  const { toast } = useToast();
  const [isGenerating, setIsGenerating] = useState(false);

  const slugify = (text: string) => {
    return text
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '');
  };

  const handleGenerateDescription = async () => {
    if (!title) {
      toast.warning('请先输入标题');
      return;
    }
    setIsGenerating(true);
    try {
      const description = await geminiService.generateSEODescription(title, content);
      onUpdate({ seoDescription: description });
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Failed to generate SEO description:', error);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-900">搜索引擎优化 (SEO)</h3>
        <span className="text-[10px] text-slate-400">预览在搜索引擎中的展示效果</span>
      </div>
      
      <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
        <p className="text-blue-700 text-lg font-medium truncate" title={seoTitle || title || '页面标题'}>{seoTitle || title || '页面标题'}</p>
        <p className="text-green-700 text-xs truncate" title={`${window.location.origin}${urlPrefix}${seoUrl || 'url-slug'}`}>{window.location.origin}{urlPrefix}{seoUrl || 'url-slug'}</p>
        <p className="text-slate-600 text-sm line-clamp-2" title={seoDescription || content || '页面描述内容...'}>{seoDescription || content || '页面描述内容...'}</p>
      </div>

      <div className="space-y-4 pt-4">
        <div className="space-y-2">
          <div className="flex justify-between">
            <label className="text-xs font-bold text-slate-500 uppercase">SEO 标题</label>
            <span className="text-[10px] text-slate-400">{seoTitle?.length || 0}/70</span>
          </div>
          <input 
            type="text" 
            maxLength={70}
            value={seoTitle || ''}
            onChange={(e) => {
              onUpdate({ seoTitle: e.target.value });
              onManualTitleChange();
            }}
            className="w-full px-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
          />
        </div>
        <div className="space-y-2">
          <div className="flex justify-between items-center">
            <label className="text-xs font-bold text-slate-500 uppercase">SEO 描述</label>
            <div className="flex items-center gap-2">
              <button 
                onClick={handleGenerateDescription}
                disabled={isGenerating}
                className="text-[10px] text-blue-600 hover:text-blue-700 font-bold flex items-center gap-1 disabled:opacity-50"
              >
                {isGenerating ? '生成中...' : 'AI 生成'}
                <ICONS.Palette className="w-2.5 h-2.5" />
              </button>
              <span className="text-[10px] text-slate-400">{seoDescription?.length || 0}/200</span>
            </div>
          </div>
          <textarea 
            maxLength={200}
            value={seoDescription || ''}
            onChange={(e) => onUpdate({ seoDescription: e.target.value })}
            className="w-full h-24 px-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20 resize-none"
          />
        </div>
        <div className="space-y-2">
          <label className="text-xs font-bold text-slate-500 uppercase">URL 别名 (Slug)</label>
          <div className="flex items-center gap-2">
            <span className="text-slate-400 text-xs">{urlPrefix}</span>
            <input 
              type="text" 
              value={seoUrl || ''}
              onChange={(e) => {
                onUpdate({ seoUrl: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-') });
                onManualUrlChange();
              }}
              onBlur={(e) => onUpdate({ seoUrl: slugify(e.target.value) })}
              className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default SEOSection;
