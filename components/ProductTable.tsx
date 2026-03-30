
import React from 'react';
import { MOCK_PRODUCTS, ICONS } from '../constants';
import { Product } from '../types';

interface ProductTableProps {
  products: Product[];
  onSelectProduct: (id: string) => void;
  selectedIds: string[];
  onEditProduct: (product: Product) => void;
}

const ProductTable: React.FC<ProductTableProps> = ({ products, onSelectProduct, selectedIds, onEditProduct }) => {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-white text-slate-500 text-xs font-medium border-b border-slate-100">
              <th className="p-4 w-10">
                <input 
                   type="checkbox" 
                   className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500" 
                   checked={selectedIds.length === products.length && products.length > 0}
                   readOnly
                />
              </th>
              <th className="p-4 font-medium">产品</th>
              <th className="p-4 font-medium">库存</th>
              <th className="p-4 font-medium">状态</th>
              <th className="p-4 font-medium">类别</th>
              <th className="p-4 font-medium">推广渠道</th>
              <th className="p-4 font-medium">来源</th>
              <th className="p-4 font-medium text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {products.map((p) => {
              const totalStock = p.variants.reduce((sum, v) => sum + v.stock, 0);

              return (
                <tr key={p.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="p-4">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedIds.includes(p.id)}
                      onChange={() => onSelectProduct(p.id)}
                    />
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded border border-slate-200 overflow-hidden bg-slate-50 flex-shrink-0">
                        <img src={p.media[0]?.url} className="w-full h-full object-cover" alt={p.title} />
                      </div>
                      <span 
                        className="text-xs font-medium text-blue-600 hover:underline cursor-pointer line-clamp-1 max-w-[300px]"
                        onClick={() => onEditProduct(p)}
                        title={p.title}
                      >
                        {p.title}
                      </span>
                    </div>
                  </td>
                  <td className="p-4 text-xs text-slate-500" title={`${totalStock}件库存，共${p.variants.length}个多规格`}>
                    {totalStock}件库存，共{p.variants.length}个多规格
                  </td>
                  <td className="p-4">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-medium inline-block border ${
                      p.status === '上架' ? 'bg-green-50 text-green-600 border-green-100' : 
                      p.status === '草稿' ? 'bg-slate-50 text-slate-500 border-slate-100' : 'bg-orange-50 text-orange-600 border-orange-100'
                    }`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="p-4 text-xs text-slate-600" title={p.category || '未分类'}>
                    {p.category || '未分类'}
                  </td>
                  <td className="p-4 text-xs text-slate-600">
                    在线店铺
                  </td>
                  <td className="p-4 text-xs text-blue-600 hover:underline cursor-pointer">
                    Dropshipping
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-3">
                      <button 
                        className="text-slate-400 hover:text-slate-600 transition-colors" 
                        onClick={() => onEditProduct(p)}
                      >
                        <ICONS.Edit className="w-4 h-4" />
                      </button>
                      <button className="text-slate-400 hover:text-slate-600 transition-colors">
                        <ICONS.Eye className="w-4 h-4" />
                      </button>
                      <button className="text-slate-400 hover:text-slate-600 transition-colors">
                        <ICONS.More className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {/* Pagination Footer */}
      <div className="p-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            每页行
            <div className="relative">
              <select className="appearance-none border border-slate-200 rounded px-2 py-1 pr-6 outline-none bg-white">
                <option>20</option>
                <option>50</option>
                <option>100</option>
              </select>
              <svg className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
            </div>
          </div>
          <span>1 - {products.length} 共 {products.length}</span>
        </div>
        <div className="flex items-center gap-2">
          <button className="p-1 rounded hover:bg-slate-100 disabled:opacity-30" disabled>
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" /></svg>
          </button>
          <button className="w-6 h-6 flex items-center justify-center rounded bg-blue-600 text-white font-medium">
            1
          </button>
          <button className="p-1 rounded hover:bg-slate-100">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ProductTable;
