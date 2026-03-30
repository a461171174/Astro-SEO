import React from 'react';
import { Customer } from '../types';

interface CustomerCompareProps {
  customers: Customer[];
  onBack: () => void;
}

const CustomerCompare: React.FC<CustomerCompareProps> = ({ customers, onBack }) => {
  const fields = [
    { label: '姓名', key: 'name' },
    { label: '公司', key: 'company' },
    { label: '国家/地区', key: 'country' },
    { label: '详细地址', key: 'address' },
    { label: '邮箱', key: 'email' },
    { label: '电话', key: 'phones', render: (val: string[]) => val.join(', ') },
    { label: '标签', key: 'tags', render: (val: string[]) => val.join(', ') },
    { label: '创建时间', key: 'createdAt' },
  ];

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center gap-4">
        <button 
          onClick={onBack}
          className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all text-slate-500"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
        </button>
        <h1 className="text-xl font-bold text-slate-900">客户对比</h1>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200">
                <th className="p-4 text-sm font-semibold text-slate-500 w-40 border-r border-slate-200">对比项</th>
                {customers.map(customer => (
                  <th key={customer.id} className="p-4 text-sm font-bold text-slate-900 min-w-[240px] border-r border-slate-200 last:border-r-0">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-xs font-bold">
                        {customer.name.charAt(0)}
                      </div>
                      <span>{customer.name}</span>
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {fields.map(field => (
                <tr key={field.key} className="hover:bg-slate-50/50 transition-colors">
                  <td className="p-4 text-sm font-medium text-slate-500 bg-slate-50/30 border-r border-slate-200">{field.label}</td>
                  {customers.map(customer => {
                    const value = (customer as any)[field.key];
                    return (
                      <td key={customer.id} className="p-4 text-sm text-slate-700 border-r border-slate-200 last:border-r-0">
                        {field.render ? field.render(value) : (value || '-')}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default CustomerCompare;
