
import React from 'react';
import { MOCK_INQUIRIES, ICONS } from '../constants';

const InquiryList: React.FC = () => {
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredInquiries = React.useMemo(() => {
    if (!searchTerm) return MOCK_INQUIRIES;
    const query = searchTerm.toLowerCase();
    return MOCK_INQUIRIES.filter(i => 
      i.customerName.toLowerCase().includes(query) ||
      i.email.toLowerCase().includes(query) ||
      i.productName.toLowerCase().includes(query) ||
      i.message.toLowerCase().includes(query)
    );
  }, [searchTerm]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-slate-900">询盘管理</h1>
          <div className="relative group">
            <ICONS.Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
            <input 
              type="text" 
              placeholder="搜索客户、产品或内容..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-sm w-64 focus:ring-2 focus:ring-blue-500/20 transition-all outline-none"
            />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors">
            导出询盘
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white text-slate-500 text-xs font-medium border-b border-slate-100">
                <th className="p-4 font-semibold">客户名称</th>
                <th className="p-4 font-semibold">关联产品</th>
                <th className="p-4 font-semibold">询盘内容</th>
                <th className="p-4 font-semibold">状态</th>
                <th className="p-4 font-semibold">日期</th>
                <th className="p-4 font-semibold text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredInquiries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-12 text-center text-slate-400">
                    {searchTerm ? '未找到匹配的询盘' : '暂无数据'}
                  </td>
                </tr>
              ) : (
                filteredInquiries.map((inquiry) => (
                  <tr key={inquiry.id} className="hover:bg-slate-50/50 transition-colors group">
                    <td className="p-4">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium text-slate-900" title={inquiry.customerName}>{inquiry.customerName}</span>
                        <span className="text-xs text-slate-500" title={inquiry.email}>{inquiry.email}</span>
                      </div>
                    </td>
                    <td className="p-4 text-sm text-blue-600 hover:underline cursor-pointer" title={inquiry.productName}>
                      {inquiry.productName}
                    </td>
                    <td className="p-4 text-sm text-slate-600 max-w-xs truncate" title={inquiry.message}>
                      {inquiry.message}
                    </td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded text-[11px] font-medium inline-block ${
                        inquiry.status === '待处理' ? 'bg-orange-50 text-orange-700' : 'bg-green-50 text-green-700'
                      }`}>
                        {inquiry.status}
                      </span>
                    </td>
                    <td className="p-4 text-sm text-slate-500">
                      {inquiry.date}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center justify-end gap-2">
                        <button className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 transition-colors">
                          回复
                        </button>
                        <button className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500">
                          <ICONS.More />
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
    </div>
  );
};

export default InquiryList;
