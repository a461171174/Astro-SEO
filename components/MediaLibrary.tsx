import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Upload, Search, Image as ImageIcon, Check, 
  Loader2, Trash2, FileText, Plus, Grid, List as ListIcon
} from 'lucide-react';
import { 
  collection, query, onSnapshot, doc 
} from 'firebase/firestore';
import { db, auth } from '../firebase';
import { MediaItem } from '../types';
import { mediaService } from '../services/mediaService';
import { isAbortError } from '../utils';

interface MediaLibraryProps {
  isOpen?: boolean;
  onClose?: () => void;
  onSelect?: (items: MediaItem[]) => void;
  multiSelect?: boolean;
  initialSelection?: string[];
  standalone?: boolean;
}

export const MediaLibrary: React.FC<MediaLibraryProps> = ({
  isOpen = true,
  onClose,
  onSelect,
  multiSelect = true,
  initialSelection = [],
  standalone = false
}) => {
  const [media, setMedia] = useState<MediaItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<{ [key: string]: number }>({});
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>(initialSelection);
  const [searchTerm, setSearchTerm] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen && !standalone) return;

    setLoading(true);
    setError(null);

    // Use a simpler query first to rule out index issues
    const q = query(collection(db, 'media'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      console.log('Media snapshot received, docs:', snapshot.size);
      const items = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as MediaItem[];
      // Sort client-side since we removed orderBy
      items.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || new Date(0);
        const dateB = b.createdAt?.toDate?.() || new Date(0);
        return dateB.getTime() - dateA.getTime();
      });
      setMedia(items);
      setLoading(false);
    }, (err) => {
      if (isAbortError(err)) {
        console.log('Media fetch cancelled/aborted');
        setLoading(false);
        return;
      }
      console.error('Media fetch error:', err);
      setError(`无法加载素材库: ${err.message}`);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen, standalone]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!auth.currentUser) {
      console.error('User must be authenticated to upload files');
      setUploadError('请先登录后再上传素材');
      return;
    }
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadError(null);
    const uploadPromises = Array.from(files).map(async (file: File) => {
      const uploadKey = `${Math.random().toString(36).substring(7)}_${file.name}`;
      try {
        await mediaService.uploadFile(file, (progress) => {
          setUploading(prev => ({ ...prev, [uploadKey]: progress }));
        });
        setUploading(prev => {
          const next = { ...prev };
          delete next[uploadKey];
          return next;
        });
      } catch (err: any) {
        if (isAbortError(err)) return;
        console.error(`Upload error for ${file.name}:`, err);
        setUploadError(`上传失败 (${file.name}): ${err.message}`);
        setUploading(prev => {
          const next = { ...prev };
          delete next[uploadKey];
          return next;
        });
        throw err;
      }
    });

    try {
      await Promise.all(uploadPromises);
    } catch (err: any) {
      if (isAbortError(err)) return;
      console.error('Failed to upload some files:', err);
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (item: MediaItem) => {
    if (!window.confirm('确定要删除这个素材吗？')) return;

    try {
      await mediaService.deleteMedia(item);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Delete error:', error);
    }
  };

  const toggleSelect = (id: string) => {
    if (multiSelect) {
      setSelectedIds(prev => 
        prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
      );
    } else {
      setSelectedIds([id]);
    }
  };

  const handleConfirm = () => {
    const selectedItems = media.filter(item => selectedIds.includes(item.id));
    if (onSelect) onSelect(selectedItems);
    if (onClose) onClose();
  };

  const filteredMedia = media.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (!isOpen && !standalone) return null;

  const content = (
    <div className={`bg-white rounded-2xl w-full flex flex-col overflow-hidden ${standalone ? 'h-full' : 'max-w-6xl h-[85vh] shadow-2xl'}`}>
      {/* Header */}
      <div className="flex items-center justify-between p-6 border-bottom border-gray-100">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">素材库</h2>
          <p className="text-sm text-gray-500 mt-1">管理和选择您的商品图片与视频</p>
        </div>
        {!standalone && onClose && (
          <button 
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="w-6 h-6 text-gray-400" />
          </button>
        )}
      </div>

        {/* Toolbar */}
        <div className="px-6 py-4 bg-gray-50/50 border-bottom border-gray-100 flex flex-wrap items-center gap-4">
          <div className="relative flex-1 min-w-[240px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input 
              type="text"
              placeholder="搜索素材..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition-all"
            />
          </div>

          <div className="flex items-center gap-2 bg-white p-1 rounded-lg border border-gray-200">
            <button 
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <Grid className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-all ${viewMode === 'list' ? 'bg-indigo-50 text-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
            >
              <ListIcon className="w-4 h-4" />
            </button>
          </div>

          <button 
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all shadow-sm shadow-indigo-200"
          >
            <Upload className="w-4 h-4" />
            <span>上传素材</span>
          </button>
          {uploadError && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs animate-pulse">
              <X className="w-3 h-3" />
              <span>{uploadError}</span>
            </div>
          )}
          <input 
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            accept="image/*,video/*"
            className="hidden"
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {loading ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400">
              <Loader2 className="w-10 h-10 animate-spin mb-4" />
              <p>加载中...</p>
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center text-red-500 p-8 text-center">
              <div className="w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
                <X className="w-8 h-8" />
              </div>
              <p className="font-medium mb-2">{error}</p>
              <p className="text-sm text-red-400">请检查网络连接或权限设置</p>
              <button 
                onClick={() => window.location.reload()}
                className="mt-6 px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-all"
              >
                重试
              </button>
            </div>
          ) : filteredMedia.length === 0 && Object.keys(uploading).length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-gray-400 border-2 border-dashed border-gray-100 rounded-2xl">
              <ImageIcon className="w-16 h-16 mb-4 opacity-20" />
              <p className="text-lg font-medium">暂无素材</p>
              <p className="text-sm">点击上方“上传素材”按钮开始添加</p>
            </div>
          ) : (
            <div className={viewMode === 'grid' ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4' : 'flex flex-col gap-2'}>
              {/* Uploading placeholders */}
              {Object.entries(uploading).map(([key, progress]) => {
                const fileName = key.split('_').slice(1).join('_');
                return (
                  <div 
                    key={key}
                    className={viewMode === 'grid' 
                      ? "aspect-square rounded-xl border border-gray-100 bg-gray-50 flex flex-col items-center justify-center p-4"
                      : "flex items-center gap-4 p-3 rounded-xl border border-gray-100 bg-gray-50"
                    }
                  >
                    <Loader2 className="w-6 h-6 animate-spin text-indigo-500 mb-2" />
                    <div className="w-full">
                      <p className="text-[10px] text-gray-500 truncate mb-1" title={fileName}>{fileName}</p>
                      <div className="w-full h-1 bg-gray-200 rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-indigo-500 transition-all duration-300" 
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Media items */}
              {filteredMedia.map((item) => (
                <div 
                  key={item.id}
                  onClick={() => toggleSelect(item.id)}
                  className={viewMode === 'grid'
                    ? `group relative aspect-square rounded-xl overflow-hidden border-2 transition-all cursor-pointer ${
                        selectedIds.includes(item.id) ? 'border-indigo-500 ring-2 ring-indigo-500/20' : 'border-transparent hover:border-gray-200'
                      }`
                    : `group flex items-center gap-4 p-3 rounded-xl border-2 transition-all cursor-pointer ${
                        selectedIds.includes(item.id) ? 'border-indigo-500 bg-indigo-50/30' : 'border-transparent hover:bg-gray-50'
                      }`
                  }
                >
                  {viewMode === 'grid' ? (
                    <>
                      <img 
                        src={item.url} 
                        alt={item.name}
                        className="w-full h-full object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div className={`absolute inset-0 bg-black/40 transition-opacity flex items-center justify-center ${
                        selectedIds.includes(item.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                      }`}>
                        {selectedIds.includes(item.id) ? (
                          <div className="bg-indigo-500 p-1.5 rounded-full text-white shadow-lg">
                            <Check className="w-5 h-5" />
                          </div>
                        ) : (
                          <div className="bg-white/20 backdrop-blur-md p-1.5 rounded-full text-white">
                            <Plus className="w-5 h-5" />
                          </div>
                        )}
                      </div>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(item);
                        }}
                        className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg opacity-0 group-hover:opacity-100 transition-all shadow-sm"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  ) : (
                    <>
                      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-gray-100">
                        <img 
                          src={item.url} 
                          alt={item.name}
                          className="w-full h-full object-cover"
                          referrerPolicy="no-referrer"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate" title={item.name}>{item.name}</p>
                        <p className="text-xs text-gray-500">
                          {item.mimeType} • {((item.size || 0) / 1024).toFixed(1)} KB
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <button 
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(item);
                          }}
                          className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                        {selectedIds.includes(item.id) && (
                          <div className="bg-indigo-500 p-1 rounded-full text-white">
                            <Check className="w-4 h-4" />
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
      {!standalone && (
        <div className="p-6 border-top border-gray-100 flex items-center justify-between bg-gray-50/50">
          <p className="text-sm text-gray-500">
            已选择 <span className="font-semibold text-indigo-600">{selectedIds.length}</span> 个项目
          </p>
          <div className="flex items-center gap-3">
            {onClose && (
              <button 
                onClick={onClose}
                className="px-6 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-all"
              >
                取消
              </button>
            )}
            <button 
              onClick={handleConfirm}
              disabled={selectedIds.length === 0}
              className="px-8 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-md shadow-indigo-200"
            >
              确认选择
            </button>
          </div>
        </div>
      )}
    </div>
  );

  if (standalone) {
    return content;
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full flex flex-col items-center justify-center"
      >
        {content}
      </motion.div>
    </div>
  );
};
