import React from 'react';
import { Collection } from '../types';
import { ICONS } from '../constants';

interface CollectionTableProps {
  collections: Collection[];
  onEditCollection: (collection: Collection) => void;
  onAddCollection: () => void;
  onDeleteCollection: (id: string) => void;
  onPreviewCollection: (collection: Collection) => void;
}

const CollectionTable: React.FC<CollectionTableProps> = ({ 
  collections, 
  onEditCollection, 
  onAddCollection,
  onDeleteCollection,
  onPreviewCollection
}) => {
  const [searchQuery, setSearchQuery] = React.useState('');

  const filteredCollections = collections.filter(c => 
    c.title.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-slate-900">商品系列</h1>
          <div className="relative group">
            <ICONS.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text"
              placeholder="搜索系列标题..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm w-64 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
            />
          </div>
        </div>
        <button 
          onClick={onAddCollection}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-1.5 shadow-sm shadow-blue-500/20"
        >
          <ICONS.Plus />
          添加系列
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50 text-slate-500 font-medium">
              <th className="p-4 w-16">封面</th>
              <th className="p-4">标题</th>
              <th className="p-4">商品数量</th>
              <th className="p-4">模版</th>
              <th className="p-4">更新时间</th>
              <th className="p-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredCollections.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-12 text-center text-slate-400">
                  {searchQuery ? '未找到匹配的系列' : '暂无商品系列，点击右上角添加。'}
                </td>
              </tr>
            ) : (
              filteredCollections.map((c) => (
                <tr key={c.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4">
                    <div className="w-10 h-10 rounded border border-slate-200 bg-slate-50 overflow-hidden">
                      {c.image ? (
                        <img src={c.image} className="w-full h-full object-cover" alt={c.title} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300">
                          <ICONS.Image />
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <button 
                      onClick={() => onEditCollection(c)}
                      className="font-medium text-slate-900 hover:text-blue-600 transition-colors text-left"
                      title={c.title}
                    >
                      {c.title}
                    </button>
                  </td>
                  <td className="p-4 text-slate-600">{c.productIds.length} 个商品</td>
                  <td className="p-4">
                    <span className="px-2 py-1 bg-slate-100 text-slate-600 text-[10px] font-bold rounded border border-slate-200 uppercase">
                      {c.template}
                    </span>
                  </td>
                  <td className="p-4 text-slate-500">{c.updatedAt}</td>
                  <td className="p-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        onClick={() => onPreviewCollection(c)}
                        className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                        title="预览"
                      >
                        <ICONS.Eye className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => onEditCollection(c)}
                        className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                        title="编辑"
                      >
                        <ICONS.Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => {
                          if (confirm('确定要删除这个系列吗？')) {
                            onDeleteCollection(c.id);
                          }
                        }}
                        className="p-2 text-slate-400 hover:text-red-600 transition-colors"
                        title="删除"
                      >
                        <ICONS.Trash className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default CollectionTable;
