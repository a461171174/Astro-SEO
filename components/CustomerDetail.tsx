import React, { useState } from 'react';
import { Customer } from '../types';
import { ICONS, MOCK_INQUIRIES } from '../constants';

interface CustomerDetailProps {
  customer: Customer;
  onBack: () => void;
}

const CustomerDetail: React.FC<CustomerDetailProps> = ({ customer: initialCustomer, onBack }) => {
  const [customer, setCustomer] = useState(initialCustomer);
  const [isEditing, setIsEditing] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [editRemarks, setEditRemarks] = useState(customer.remarks);
  const [historyFilter, setHistoryFilter] = useState<'all' | 'product' | 'page'>('all');

  const customerInquiries = MOCK_INQUIRIES.filter(iq => iq.email === customer.email);

  const filteredHistory = customer.browsingHistory.filter(item => {
    if (historyFilter === 'all') return true;
    const isProduct = item.path.includes('/products/');
    return historyFilter === 'product' ? isProduct : !isProduct;
  });

  const handleSaveProfile = () => {
    setIsEditing(false);
    // In a real app, we would call an API here
  };

  const handleAddTag = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTag.trim() && !customer.tags.includes(newTag.trim())) {
      setCustomer({ ...customer, tags: [...customer.tags, newTag.trim()] });
      setNewTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setCustomer({ ...customer, tags: customer.tags.filter(t => t !== tagToRemove) });
  };

  const handleAddPhone = () => {
    setCustomer({ ...customer, phones: [...customer.phones, ''] });
  };

  const handlePhoneChange = (index: number, value: string) => {
    const newPhones = [...customer.phones];
    newPhones[index] = value;
    setCustomer({ ...customer, phones: newPhones });
  };

  const handleRemovePhone = (index: number) => {
    setCustomer({ ...customer, phones: customer.phones.filter((_, i) => i !== index) });
  };

  const handleSaveRemarks = () => {
    setCustomer({ ...customer, remarks: editRemarks });
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-300">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="p-2 hover:bg-white rounded-lg border border-transparent hover:border-slate-200 transition-all text-slate-500"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 19l-7-7 7-7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
          </button>
          <h1 className="text-xl font-bold text-slate-900">客户详情</h1>
        </div>
        <div className="flex items-center gap-2">
          {isEditing ? (
            <button 
              onClick={handleSaveProfile}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              保存资料
            </button>
          ) : (
            <button 
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors flex items-center gap-2"
            >
              <ICONS.Edit />
              编辑资料
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Basic Info Card */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 text-2xl font-bold">
                {customer.name.charAt(0)}
              </div>
              <div className="flex-1">
                {isEditing ? (
                  <div className="space-y-2">
                    <input 
                      type="text" 
                      value={customer.name}
                      onChange={(e) => setCustomer({...customer, name: e.target.value})}
                      placeholder="姓名"
                      className="w-full px-2 py-1 text-lg font-bold border border-blue-200 rounded outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                    <input 
                      type="text" 
                      value={customer.company}
                      onChange={(e) => setCustomer({...customer, company: e.target.value})}
                      placeholder="公司"
                      className="w-full px-2 py-1 text-sm border border-slate-200 rounded outline-none focus:ring-2 focus:ring-blue-500/20"
                    />
                  </div>
                ) : (
                  <>
                    <h2 className="text-lg font-bold text-slate-900">{customer.name}</h2>
                    <p className="text-sm text-slate-500">{customer.company}</p>
                  </>
                )}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-500">邮箱</span>
                {isEditing ? (
                  <input 
                    type="email" 
                    value={customer.email}
                    onChange={(e) => setCustomer({...customer, email: e.target.value})}
                    className="w-full px-2 py-1 text-sm border border-slate-200 rounded outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                ) : (
                  <span className="text-sm text-slate-900 font-medium">{customer.email}</span>
                )}
              </div>
              
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-slate-500">电话</span>
                  {isEditing && (
                    <button 
                      onClick={handleAddPhone}
                      className="text-[10px] text-blue-600 font-bold hover:underline"
                    >
                      + 添加电话
                    </button>
                  )}
                </div>
                <div className="space-y-2">
                  {customer.phones.map((phone, idx) => (
                    <div key={idx} className="flex items-center gap-2">
                      {isEditing ? (
                        <>
                          <input 
                            type="text" 
                            value={phone}
                            onChange={(e) => handlePhoneChange(idx, e.target.value)}
                            className="flex-1 px-2 py-1 text-sm border border-slate-200 rounded outline-none focus:ring-2 focus:ring-blue-500/20"
                          />
                          {customer.phones.length > 1 && (
                            <button 
                              onClick={() => handleRemovePhone(idx)}
                              className="text-red-500 hover:text-red-700"
                            >
                              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                            </button>
                          )}
                        </>
                      ) : (
                        <span className="text-sm text-slate-900 font-medium">{phone}</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-500">国家/地区</span>
                {isEditing ? (
                  <input 
                    type="text" 
                    value={customer.country}
                    onChange={(e) => setCustomer({...customer, country: e.target.value})}
                    className="w-full px-2 py-1 text-sm border border-slate-200 rounded outline-none focus:ring-2 focus:ring-blue-500/20"
                  />
                ) : (
                  <span className="text-sm text-slate-900 font-medium">{customer.country}</span>
                )}
              </div>

              <div className="flex flex-col gap-1">
                <span className="text-xs text-slate-500">详细地址</span>
                {isEditing ? (
                  <textarea 
                    value={customer.address}
                    onChange={(e) => setCustomer({...customer, address: e.target.value})}
                    className="w-full px-2 py-1 text-sm border border-slate-200 rounded outline-none focus:ring-2 focus:ring-blue-500/20 h-16 resize-none"
                  />
                ) : (
                  <span className="text-sm text-slate-900 font-medium">{customer.address}</span>
                )}
              </div>

              <div className="flex items-center justify-between text-sm pt-2">
                <span className="text-slate-500">创建时间</span>
                <span className="text-slate-900 font-medium">{customer.createdAt}</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-slate-500">最后活跃</span>
                <span className="text-slate-900 font-medium">{customer.lastActive}</span>
              </div>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">标签</p>
              <div className="flex flex-wrap gap-2 mb-3">
                {customer.tags.map(tag => (
                  <span key={tag} className="group px-2 py-1 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium flex items-center gap-1">
                    {tag}
                    <button 
                      onClick={() => handleRemoveTag(tag)}
                      className="opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                    </button>
                  </span>
                ))}
              </div>
              <form onSubmit={handleAddTag} className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="添加标签..." 
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                  className="flex-1 px-2 py-1 text-xs border border-slate-200 rounded outline-none focus:ring-2 focus:ring-blue-500/20"
                />
                <button 
                  type="submit"
                  className="px-2 py-1 bg-slate-100 text-slate-600 rounded text-xs hover:bg-slate-200 transition-colors"
                >
                  添加
                </button>
              </form>
            </div>

            <div className="pt-4 border-t border-slate-100">
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider">备注</p>
                <button 
                  onClick={handleSaveRemarks}
                  className="text-[10px] text-blue-600 font-bold hover:underline"
                >
                  保存备注
                </button>
              </div>
              <textarea 
                value={editRemarks}
                onChange={(e) => setEditRemarks(e.target.value)}
                placeholder="添加备注或表情..."
                className="w-full h-24 p-3 text-sm text-slate-600 bg-slate-50 rounded-lg border border-slate-100 outline-none focus:ring-2 focus:ring-blue-500/20 resize-none transition-all"
              />
            </div>
          </div>
        </div>

        {/* Activity & History */}
        <div className="lg:col-span-2 space-y-6">
          {/* Inquiry History */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <ICONS.Inquiry />
                历史询盘
              </h3>
              <span className="text-xs text-slate-500">共 {customerInquiries.length} 条询盘</span>
            </div>
            
            <div className="divide-y divide-slate-100">
              {customerInquiries.length > 0 ? (
                customerInquiries.map((iq) => (
                  <div key={iq.id} className="p-6 hover:bg-slate-50/50 transition-colors">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="px-2 py-1 bg-blue-50 text-blue-600 rounded text-[10px] font-bold uppercase">
                          {iq.productName}
                        </span>
                        <span className={`px-2 py-1 rounded text-[10px] font-bold ${
                          iq.status === '待处理' ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'
                        }`}>
                          {iq.status}
                        </span>
                      </div>
                      <span className="text-xs text-slate-400">{iq.date}</span>
                    </div>
                    <p className="text-sm text-slate-700 leading-relaxed bg-white p-4 rounded-lg border border-slate-100 shadow-sm">
                      {iq.message}
                    </p>
                  </div>
                ))
              ) : (
                <div className="p-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
                  <div className="w-12 h-12 bg-slate-50 rounded-full flex items-center justify-center">
                    <ICONS.Inquiry />
                  </div>
                  <p className="text-sm">暂无历史询盘</p>
                </div>
              )}
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <svg className="w-4 h-4 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" strokeWidth="2"/><path d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" strokeWidth="2"/></svg>
                  浏览路径记录
                </h3>
                <span className="text-xs text-slate-500">共 {filteredHistory.length} 条记录</span>
              </div>
              
              <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg w-fit">
                {[
                  { id: 'all', label: '全部' },
                  { id: 'product', label: '商品' },
                  { id: 'page', label: '页面' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    onClick={() => setHistoryFilter(tab.id as any)}
                    className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                      historyFilter === tab.id 
                        ? 'bg-white text-blue-600 shadow-sm' 
                        : 'text-slate-500 hover:text-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="p-6">
              <div className="relative space-y-8 before:absolute before:inset-0 before:ml-5 before:-translate-x-px before:h-full before:w-0.5 before:bg-gradient-to-b before:from-transparent before:via-slate-200 before:to-transparent">
                {filteredHistory.length > 0 ? (
                  filteredHistory.map((item, index) => (
                    <div key={index} className="relative flex items-start gap-6 group">
                      <div className="absolute left-0 mt-1.5 w-10 h-10 rounded-full bg-white border-2 border-slate-200 flex items-center justify-center group-hover:border-blue-400 transition-colors z-10">
                        <div className="w-2 h-2 rounded-full bg-slate-300 group-hover:bg-blue-500 transition-colors" />
                      </div>
                      <div className="ml-12 flex-1 bg-slate-50 p-4 rounded-xl border border-slate-100 group-hover:border-blue-100 group-hover:bg-blue-50/30 transition-all">
                        <div className="flex items-center justify-between mb-1">
                          <h4 className="text-sm font-bold text-slate-900">{item.title}</h4>
                          <span className="text-[10px] font-medium text-slate-400">{item.timestamp}</span>
                        </div>
                        <p className="text-xs text-slate-500 font-mono">{item.path}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-12 flex flex-col items-center justify-center text-slate-400 space-y-2">
                    <p className="text-sm">暂无匹配的浏览记录</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerDetail;
