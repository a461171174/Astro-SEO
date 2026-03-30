
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { ICONS } from '../constants';
import SEOSection from './SEOSection';
import { MediaLibrary } from './MediaLibrary';
import { MediaItem } from '../types';
import { useToast } from './Toast';

interface GenericContentEditorProps {
  type: 'blog' | 'blog-set' | 'page' | 'product-set';
  initialData?: any;
  onSave: (data: any) => void;
  onCancel: () => void;
}

const GenericContentEditor: React.FC<GenericContentEditorProps> = ({ type, initialData, onSave, onCancel }) => {
  const { toast } = useToast();
  const [data, setData] = useState<any>(initialData || {
    title: '',
    content: '',
    description: '',
    template: 'Default Template',
    status: 'Draft',
    seoTitle: '',
    seoDescription: '',
    seoUrl: '',
    tags: [],
    author: 'Admin',
    image: '',
    jsonLd: '',
  });

  const [isSeoTitleAuto, setIsSeoTitleAuto] = useState(!initialData || !initialData.seoTitle);
  const [isSeoUrlAuto, setIsSeoUrlAuto] = useState(!initialData || !initialData.seoUrl);
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
  const [previewMode, setPreviewMode] = useState<'edit' | 'preview'>('preview');

  const typeLabels: Record<string, string> = {
    'blog': 'Blog Post',
    'blog-set': 'Blog Collection',
    'page': 'Custom Page',
    'product-set': 'Product Collection'
  };

  const urlPrefixes: Record<string, string> = {
    'blog': '/blogs/',
    'blog-set': '/blog-sets/',
    'page': '/pages/',
    'product-set': '/product-sets/'
  };

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

  useEffect(() => {
    if (data.title) {
      const updates: any = {};
      
      if (isSeoTitleAuto && data.seoTitle !== data.title) {
        updates.seoTitle = data.title;
      }
      
      if (isSeoUrlAuto) {
        const newSlug = slugify(data.title || '');
        if (data.seoUrl !== newSlug) {
          updates.seoUrl = newSlug;
        }
      }

      if (Object.keys(updates).length > 0) {
        setData((prev: any) => ({ ...prev, ...updates }));
      }
    }
  }, [data.title, isSeoTitleAuto, isSeoUrlAuto]);

  const handleMediaSelect = (items: MediaItem[]) => {
    if (items.length > 0) {
      setData({ ...data, image: items[0].url });
    }
    setIsMediaLibraryOpen(false);
  };

  const handleSave = () => {
    if (!data.title) {
      toast.warning('Title is required');
      return;
    }
    onSave({
      ...data,
      id: data.id || Date.now().toString(),
      updatedAt: new Date().toISOString().split('T')[0],
      createdAt: data.createdAt || new Date().toISOString().split('T')[0],
    });
  };

  return (
    <div className="max-w-[1200px] mx-auto pb-20 px-4 lg:px-0 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between sticky top-0 bg-[#F8F9FB]/80 backdrop-blur-md py-4 z-20">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs text-slate-400">
            <span className="hover:text-blue-600 cursor-pointer transition-colors" onClick={onCancel}>{typeLabels[type]}</span>
            <span>/</span>
          </div>
          <h1 className="text-xl font-bold text-slate-900">{initialData ? `Edit ${typeLabels[type]}` : `Create ${typeLabels[type]}`}</h1>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={onCancel}
            className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors"
          >
            Cancel
          </button>
          <button 
            onClick={handleSave}
            className="px-6 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors shadow-sm shadow-blue-500/20"
          >
            Save
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          {/* Main Content */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-8 space-y-6">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Title<span className="text-red-500">*</span></label>
              <input 
                type="text" 
                value={data.title}
                onChange={(e) => setData({ ...data, title: e.target.value })}
                placeholder={`Enter ${typeLabels[type]} title`}
                className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 text-sm transition-all"
              />
            </div>
            {(type === 'blog' || type === 'page') && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">Content</label>
                  <div className="flex gap-1 p-1 bg-slate-100 rounded-lg">
                    <button 
                      onClick={() => setPreviewMode('edit')}
                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${previewMode === 'edit' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                    >
                      Edit
                    </button>
                    <button 
                      onClick={() => setPreviewMode('preview')}
                      className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all ${previewMode === 'preview' ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500'}`}
                    >
                      Preview
                    </button>
                  </div>
                </div>
                {previewMode === 'edit' ? (
                  <textarea 
                    value={data.content}
                    onChange={(e) => setData({ ...data, content: e.target.value })}
                    placeholder="Enter content here..."
                    className="w-full h-96 px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 text-sm resize-none transition-all"
                  />
                ) : (
                  <div className="w-full min-h-[384px] max-h-[600px] overflow-y-auto px-8 py-6 bg-white border border-slate-200 rounded-lg prose prose-slate max-w-none prose-headings:font-bold prose-h1:text-2xl prose-h1:mb-6 prose-h2:text-xl prose-h2:mt-8 prose-h2:mb-4 prose-h3:text-lg prose-h3:mt-6 prose-h3:mb-3 prose-p:text-slate-700 prose-p:leading-relaxed prose-p:mb-5 prose-ul:my-4 prose-li:mb-2 prose-a:text-blue-600 hover:prose-a:text-blue-700">
                    <ReactMarkdown remarkPlugins={[remarkGfm]}>
                      {data.content || ''}
                    </ReactMarkdown>
                  </div>
                )}
              </div>
            )}
            {(type === 'blog-set' || type === 'product-set') && (
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Description</label>
                <textarea 
                  value={data.description}
                  onChange={(e) => setData({ ...data, description: e.target.value })}
                  placeholder="Introduce the content of this collection..."
                  className="w-full h-32 px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 text-sm resize-none transition-all"
                />
              </div>
            )}
          </div>

          {/* SEO Section */}
          <SEOSection 
            title={data.title}
            content={data.content || data.description || ''}
            seoTitle={data.seoTitle}
            seoDescription={data.seoDescription}
            seoUrl={data.seoUrl}
            urlPrefix={urlPrefixes[type]}
            onUpdate={(updates) => setData((prev: any) => ({ ...prev, ...updates }))}
            onManualTitleChange={() => setIsSeoTitleAuto(false)}
            onManualUrlChange={() => setIsSeoUrlAuto(false)}
          />
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Status/Template */}
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900">Settings</h3>
            {type === 'blog' && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-700">Status</label>
                <select 
                  value={data.status}
                  onChange={(e) => setData({ ...data, status: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 text-sm bg-white cursor-pointer"
                >
                  <option>Draft</option>
                  <option>Published</option>
                </select>
              </div>
            )}
            {(type === 'page' || type === 'blog-set' || type === 'product-set') && (
              <div className="space-y-2">
                <label className="text-xs font-medium text-slate-700">Template</label>
                <select 
                  value={data.template}
                  onChange={(e) => setData({ ...data, template: e.target.value })}
                  className="w-full px-4 py-2 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20 text-sm bg-white cursor-pointer"
                >
                  <option>Default Template</option>
                  <option>Landing Page</option>
                  <option>Article Layout</option>
                </select>
              </div>
            )}
          </div>
          
          {/* Image */}
          {(type === 'blog' || type === 'blog-set' || type === 'product-set') && (
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900">Cover Image</h3>
              <div 
                onClick={() => setIsMediaLibraryOpen(true)}
                className="aspect-video rounded-xl border-2 border-dashed border-slate-200 overflow-hidden bg-slate-50 flex flex-col items-center justify-center group cursor-pointer hover:border-blue-400 transition-all"
              >
                {data.image ? (
                  <div className="relative w-full h-full">
                    <img src={data.image} className="w-full h-full object-cover" alt="" />
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                      <button 
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setData({ ...data, image: '' }); 
                        }} 
                        className="p-2 bg-white rounded-full text-red-500 shadow-sm"
                      >
                        <ICONS.Trash />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-2 text-slate-400 group-hover:text-blue-600">
                    <ICONS.Upload className="w-6 h-6" />
                    <span className="text-xs font-medium">Click to upload cover</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Media Library Modal */}
      <MediaLibrary 
        isOpen={isMediaLibraryOpen}
        onClose={() => setIsMediaLibraryOpen(false)}
        onSelect={handleMediaSelect}
        multiSelect={false}
      />
    </div>
  );
};

export default GenericContentEditor;
