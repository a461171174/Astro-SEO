
import React, { useState, useMemo } from 'react';
import { MOCK_CUSTOMERS, ICONS } from '../constants';
import { Customer } from '../types';
import { useToast } from './Toast';

interface CustomerListProps {
  onViewDetail: (customer: Customer) => void;
  onCompare: (customers: Customer[]) => void;
}

const CustomerList: React.FC<CustomerListProps> = ({ onViewDetail, onCompare }) => {
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedCustomerIds, setSelectedCustomerIds] = useState<string[]>([]);
  const [showTagMenu, setShowTagMenu] = useState(false);

  const filteredAndSortedCustomers = useMemo(() => {
    let result = MOCK_CUSTOMERS.filter(c => 
      c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.tags.some(tag => tag.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    result.sort((a, b) => {
      const dateA = new Date(a.createdAt).getTime();
      const dateB = new Date(b.createdAt).getTime();
      return sortOrder === 'desc' ? dateB - dateA : dateA - dateB;
    });

    return result;
  }, [searchTerm, sortOrder]);

  const handleCompare = () => {
    const selectedCustomers = MOCK_CUSTOMERS.filter(c => selectedCustomerIds.includes(c.id));
    onCompare(selectedCustomers);
  };

  const handleExport = () => {
    const headers = ['姓名', '公司', '邮箱', '电话', '国家/地区', '详细地址', '标签', '创建时间'];
    const rows = filteredAndSortedCustomers.map(c => [
      c.name,
      c.company,
      c.email,
      c.phones.join(';'),
      c.country,
      c.address,
      c.tags.join(';'),
      c.createdAt
    ]);

    const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `customers_export_${new Date().toISOString().slice(0, 10)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadTemplate = () => {
    const headers = ['姓名', '公司', '邮箱', '电话(分号分隔)', '国家/地区', '详细地址', '标签(分号分隔)'];
    const example = ['张三', '某某贸易公司', 'zhangsan@example.com', '13800138000;010-12345678', '中国', '北京市朝阳区...', 'VIP;重点客户'];
    
    const csvContent = [headers, example].map(e => e.join(",")).join("\n");
    const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "customer_import_template.csv");
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      toast.info(`已选择文件: ${file.name}。在实际应用中，这里将解析 CSV 并上传到服务器。`);
    }
  };

  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.checked) {
      setSelectedCustomerIds(filteredAndSortedCustomers.map(c => c.id));
    } else {
      setSelectedCustomerIds([]);
    }
  };

  const handleSelectOne = (id: string) => {
    setSelectedCustomerIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const [showExportMenu, setShowExportMenu] = useState(false);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">客户管理</h1>
        <div className="flex items-center gap-2">
          <label className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors cursor-pointer">
            导入
            <input type="file" accept=".csv" className="hidden" onChange={handleImport} />
          </label>
          <div className="relative">
            <button 
              onClick={() => setShowExportMenu(!showExportMenu)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              导出
              <svg className={`w-4 h-4 transition-transform ${showExportMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
            </button>
            {showExportMenu && (
              <div className="absolute top-full right-0 mt-1 w-48 bg-white border border-slate-200 rounded-lg shadow-xl z-30 py-1 overflow-hidden">
                <button 
                  onClick={() => { handleExport(); setShowExportMenu(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  导出当前数据
                </button>
                <button 
                  onClick={() => { handleDownloadTemplate(); setShowExportMenu(false); }}
                  className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 flex items-center gap-2"
                >
                  <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                  下载导入模板
                </button>
              </div>
            )}
          </div>
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">
            添加客户
          </button>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-1 min-w-[300px]">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
              <ICONS.Search />
            </span>
            <input 
              type="text" 
              placeholder="搜索名称、邮箱或标签..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full bg-slate-50 border border-slate-200 rounded-lg py-2 pl-10 pr-4 text-sm focus:ring-2 focus:ring-blue-500/20 outline-none transition-all"
            />
          </div>
          <select 
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
            className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-500/20"
          >
            <option value="desc">创建时间 (从新到旧)</option>
            <option value="asc">创建时间 (从旧到新)</option>
          </select>
        </div>

        {selectedCustomerIds.length > 0 && (
          <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-2">
            <span className="text-sm text-slate-500 mr-2">已选 {selectedCustomerIds.length} 项</span>
            <div className="relative">
              <button 
                onClick={() => setShowTagMenu(!showTagMenu)}
                className="px-3 py-1.5 bg-slate-100 text-slate-700 rounded-lg text-xs font-medium hover:bg-slate-200 transition-colors flex items-center gap-1"
              >
                批量管理标签
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M19 9l-7 7-7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </button>
              {showTagMenu && (
                <div className="absolute top-full right-0 mt-1 w-40 bg-white border border-slate-200 rounded-lg shadow-xl z-20 py-1 overflow-hidden">
                  <button className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50">添加标签</button>
                  <button className="w-full text-left px-4 py-2 text-xs text-slate-700 hover:bg-slate-50">移除标签</button>
                </div>
              )}
            </div>
            <button 
              onClick={handleCompare}
              disabled={selectedCustomerIds.length < 2}
              className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              对比客户
            </button>
            <button className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors">
              批量删除
            </button>
          </div>
        )}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white text-slate-500 text-xs font-medium border-b border-slate-100">
                <th className="p-4 w-10">
                  <input 
                    type="checkbox" 
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                    checked={selectedCustomerIds.length === filteredAndSortedCustomers.length && filteredAndSortedCustomers.length > 0}
                    onChange={handleSelectAll}
                  />
                </th>
                <th className="p-4 font-semibold">客户信息</th>
                <th className="p-4 font-semibold">联系方式</th>
                <th className="p-4 font-semibold">状态</th>
                <th className="p-4 font-semibold">标签</th>
                <th className="p-4 font-semibold">创建时间</th>
                <th className="p-4 font-semibold text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredAndSortedCustomers.map((customer) => (
                <tr key={customer.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="p-4">
                    <input 
                      type="checkbox" 
                      className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                      checked={selectedCustomerIds.includes(customer.id)}
                      onChange={() => handleSelectOne(customer.id)}
                    />
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col">
                      <span 
                        className="text-sm font-medium text-blue-600 hover:underline cursor-pointer"
                        onClick={() => onViewDetail(customer)}
                        title={customer.name}
                      >
                        {customer.name}
                      </span>
                      <span className="text-xs text-slate-500" title={customer.company}>{customer.company}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-col text-xs text-slate-600">
                      <span title={customer.email}>{customer.email}</span>
                      <span>{customer.phones[0]} {customer.phones.length > 1 && `(+${customer.phones.length - 1})`}</span>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {customer.isSubscribed && (
                        <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-medium">已订阅</span>
                      )}
                      {customer.isInquired && (
                        <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded text-[10px] font-medium">已询盘</span>
                      )}
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex flex-wrap gap-1">
                      {customer.tags.map(tag => (
                        <span key={tag} title={tag} className="px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">
                          {tag}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="p-4 text-xs text-slate-500">
                    {customer.createdAt}
                  </td>
                  <td className="p-4">
                    <div className="flex items-center justify-end gap-2">
                      <button 
                        className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500"
                        onClick={() => onViewDetail(customer)}
                        title="查看详情"
                      >
                        <ICONS.Eye />
                      </button>
                      <button className="p-1.5 hover:bg-slate-100 rounded-md text-slate-500" title="编辑">
                        <ICONS.Edit />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CustomerList;
