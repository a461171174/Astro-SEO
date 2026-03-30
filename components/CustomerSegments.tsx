import React, { useState } from 'react';
import { ICONS } from '../constants';

interface SegmentCondition {
  id: string;
  category: string;
  field: string;
  operator: string;
  value: string;
}

const CustomerSegments: React.FC = () => {
  const [segments, setSegments] = useState([
    { id: '1', name: '高价值客户', count: 120, createdAt: '2024-02-20' },
    { id: '2', name: '潜在流失客户', count: 45, createdAt: '2024-02-15' },
  ]);
  const [isCreating, setIsCreating] = useState(false);
  const [newSegmentName, setNewSegmentName] = useState('');
  const [conditions, setConditions] = useState<SegmentCondition[]>([
    { id: '1', category: '客户信息', field: '是否询盘', operator: '等于', value: '是' }
  ]);

  const categories = [
    {
      name: '客户信息',
      fields: ['创建时间区间', '询盘时间区间', '是否询盘', '是否订阅', '客户信息', '国家', '标签']
    },
    {
      name: '店铺行为',
      fields: ['最近访问时间', '最近询盘时间', '浏览次数']
    },
    {
      name: '商品行为',
      fields: ['浏览过某个产品', '浏览过某个产品系列']
    },
    {
      name: '邮件营销',
      fields: ['接收过邮件', '打开过邮件', '未打开邮件', '打开邮件数量']
    }
  ];

  const addCondition = () => {
    setConditions([...conditions, { 
      id: Date.now().toString(), 
      category: '客户信息', 
      field: '创建时间区间', 
      operator: '在范围内', 
      value: '' 
    }]);
  };

  const removeCondition = (id: string) => {
    setConditions(conditions.filter(c => c.id !== id));
  };

  if (isCreating) {
    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
        <div className="flex items-center gap-4">
          <button 
            onClick={() => setIsCreating(false)}
            className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all text-slate-500"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <h1 className="text-xl font-bold text-slate-900">创建客户细分</h1>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">细分名称</label>
                <input 
                  type="text" 
                  value={newSegmentName}
                  onChange={(e) => setNewSegmentName(e.target.value)}
                  placeholder="例如：最近30天活跃客户"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-slate-700">筛选条件组合</label>
                  <span className="text-xs text-slate-400">满足以下所有条件</span>
                </div>
                
                <div className="space-y-3">
                  {conditions.map((condition, index) => (
                    <React.Fragment key={condition.id}>
                      {index > 0 && (
                        <div className="flex justify-center -my-2 relative z-10">
                          <span className="px-3 py-1 bg-white border border-slate-200 rounded-full text-[10px] font-bold text-blue-600 shadow-sm">
                            且 (AND)
                          </span>
                        </div>
                      )}
                      <div className="flex items-center gap-3 p-4 bg-slate-50 rounded-xl border border-slate-100 group">
                        <select 
                          className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                          value={condition.category}
                          onChange={(e) => {
                            const newConditions = [...conditions];
                            newConditions[index].category = e.target.value;
                            setConditions(newConditions);
                          }}
                        >
                          {categories.map(cat => <option key={cat.name} value={cat.name}>{cat.name}</option>)}
                        </select>

                        <select 
                          className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                          value={condition.field}
                          onChange={(e) => {
                            const newConditions = [...conditions];
                            newConditions[index].field = e.target.value;
                            setConditions(newConditions);
                          }}
                        >
                          {categories.find(c => c.name === condition.category)?.fields.map(f => <option key={f} value={f}>{f}</option>)}
                        </select>

                        <select className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500/20">
                          <option>等于</option>
                          <option>不等于</option>
                          <option>包含</option>
                          <option>在范围内</option>
                          <option>大于</option>
                          <option>小于</option>
                        </select>

                        <input 
                          type="text" 
                          placeholder="输入值..."
                          className="flex-1 px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:ring-2 focus:ring-blue-500/20"
                        />

                        <button 
                          onClick={() => removeCondition(condition.id)}
                          className="p-1.5 text-slate-400 hover:text-red-500 transition-colors"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                        </button>
                      </div>
                    </React.Fragment>
                  ))}
                </div>

                <button 
                  onClick={addCondition}
                  className="w-full py-3 border-2 border-dashed border-slate-200 rounded-xl text-sm font-medium text-slate-500 hover:border-blue-400 hover:text-blue-600 transition-all flex items-center justify-center gap-2"
                >
                  <ICONS.Plus />
                  添加筛选条件
                </button>
              </div>
            </div>
          </div>

          <div className="lg:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
              <h3 className="text-sm font-bold text-slate-900">细分预览</h3>
              <div className="flex items-center justify-between p-4 bg-blue-50 rounded-xl border border-blue-100">
                <div className="flex flex-col">
                  <span className="text-2xl font-bold text-blue-600">842</span>
                  <span className="text-xs text-blue-700/70">预计覆盖客户数</span>
                </div>
                <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-blue-600 shadow-sm">
                  <ICONS.Customer />
                </div>
              </div>
              <p className="text-xs text-slate-500 leading-relaxed">
                细分客户会根据您设置的条件自动更新。当新客户满足条件时，他们将自动加入此细分。
              </p>
              <button 
                onClick={() => setIsCreating(false)}
                className="w-full py-2.5 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all shadow-sm shadow-blue-500/20"
              >
                保存细分
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-slate-900">客户细分</h1>
        <button 
          onClick={() => setIsCreating(true)}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-2"
        >
          <ICONS.Plus />
          创建细分
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {segments.map(segment => (
          <div key={segment.id} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition-all group cursor-pointer">
            <div className="flex items-start justify-between mb-4">
              <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                <ICONS.Customer />
              </div>
              <button className="p-1.5 text-slate-400 hover:bg-slate-50 rounded-md">
                <ICONS.More />
              </button>
            </div>
            <h3 className="text-sm font-bold text-slate-900 mb-1" title={segment.name}>{segment.name}</h3>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <span>{segment.count} 名客户</span>
              <span>创建于 {segment.createdAt}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CustomerSegments;
