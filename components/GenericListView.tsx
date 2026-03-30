
import React, { useState, useMemo } from 'react';
import { ICONS } from '../constants';

interface GenericListViewProps {
  title: string;
  items: any[];
  columns: { key: string; label: string; render?: (item: any) => React.ReactNode }[];
  onAdd: () => void;
  onEdit: (item: any) => void;
  onDelete: (id: string) => void;
  onPreview?: (item: any) => void;
  extraHeaderContent?: React.ReactNode;
}

const GenericListView: React.FC<GenericListViewProps> = ({ 
  title, 
  items, 
  columns, 
  onAdd, 
  onEdit, 
  onDelete,
  onPreview,
  extraHeaderContent
}) => {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredItems = useMemo(() => {
    if (!searchTerm) return items;
    const query = searchTerm.toLowerCase();
    return items.filter(item => {
      return columns.some(col => {
        const val = item[col.key];
        return val && String(val).toLowerCase().includes(query);
      });
    });
  }, [items, searchTerm, columns]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-2xl font-bold text-slate-900">{title}</h1>
          <div className="relative group">
            <ICONS.Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text"
              placeholder={`搜索${title}...`}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-white border border-slate-200 rounded-lg text-sm w-48 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          {extraHeaderContent}
          <button 
            onClick={onAdd}
            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-1 shadow-sm"
          >
            添加{title}
            <ICONS.Plus className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-100">
              {columns.map(col => (
                <th key={col.key} className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                  {col.label}
                </th>
              ))}
              <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {filteredItems.length === 0 ? (
              <tr>
                <td colSpan={columns.length + 1} className="px-6 py-12 text-center text-slate-400">
                  {searchTerm ? '未找到匹配项' : '暂无数据'}
                </td>
              </tr>
            ) : (
              filteredItems.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors group">
                  {columns.map(col => (
                    <td key={col.key} className="px-6 py-4 text-sm text-slate-600" title={col.render ? undefined : String(item[col.key] || '')}>
                      {col.render ? col.render(item) : item[col.key]}
                    </td>
                  ))}
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {onPreview && (
                        <button 
                          onClick={() => onPreview(item)}
                          className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                          title="预览"
                        >
                          <ICONS.Eye className="w-4 h-4" />
                        </button>
                      )}
                      <button 
                        onClick={() => onEdit(item)}
                        className="p-2 text-slate-400 hover:text-blue-600 transition-colors"
                        title="编辑"
                      >
                        <ICONS.Edit className="w-4 h-4" />
                      </button>
                      <button 
                        onClick={() => onDelete(item.id)}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
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

export default GenericListView;
