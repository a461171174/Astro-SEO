import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ICONS, MOCK_CAMPAIGNS } from '../constants';
import { EmailCampaign } from '../types';

interface EmailMarketingProps {
  onAddCampaign: () => void;
  onEditCampaign: (campaign: EmailCampaign) => void;
}

const EmailMarketing: React.FC<EmailMarketingProps> = ({ onAddCampaign, onEditCampaign }) => {
  const [campaigns] = useState<EmailCampaign[]>(MOCK_CAMPAIGNS);

  const stats = [
    { label: '发送访问数', value: '1,200', sub: '通过邮件访问站点', icon: <ICONS.Eye className="w-5 h-5 text-blue-600" /> },
    { label: '打开率', value: '24.5%', sub: '平均打开水平', icon: <ICONS.Mail className="w-5 h-5 text-indigo-600" /> },
    { label: '询盘率', value: '3.8%', sub: '转化询盘占比', icon: <ICONS.Inquiry className="w-5 h-5 text-emerald-600" /> },
    { label: '退订率', value: '0.2%', sub: '客户流失控制', icon: <ICONS.Trash className="w-5 h-5 text-red-600" /> },
  ];

  return (
    <div className="space-y-8 max-w-[1200px] mx-auto py-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-xl font-bold text-slate-900">邮件营销</h1>
          <p className="text-xs text-slate-400">通过邮件与您的客户保持联系并促进转化</p>
        </div>
        <div className="flex items-center gap-4">
          <div className="px-4 py-2 bg-slate-100 rounded-lg border border-slate-200 flex items-center gap-3">
            <div className="space-y-0.5">
              <p className="text-[10px] text-slate-400 font-bold uppercase">本月额度</p>
              <p className="text-xs font-bold text-slate-700">1,240 / 10,000</p>
            </div>
            <div className="w-20 h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div className="h-full bg-blue-600 rounded-full" style={{ width: '12.4%' }} />
            </div>
          </div>
          <button 
            onClick={onAddCampaign}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-lg shadow-blue-500/20"
          >
            <ICONS.Plus className="w-4 h-4" />
            创建邮件
          </button>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-4 gap-6">
        {stats.map((stat, i) => (
          <motion.div 
            key={i}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-3"
          >
            <div className="flex items-center justify-between">
              <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
                {stat.icon}
              </div>
              <span className="text-[10px] font-bold text-green-600 bg-green-50 px-1.5 py-0.5 rounded border border-green-100">+12%</span>
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
              <p className="text-xs font-medium text-slate-600">{stat.label}</p>
              <p className="text-[10px] text-slate-400 mt-1">{stat.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Campaign List */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-sm font-bold text-slate-900">已发送邮件</h3>
          <div className="flex items-center gap-2">
            <button className="p-2 text-slate-400 hover:text-blue-600 transition-colors"><ICONS.Search className="w-4 h-4" /></button>
            <button className="p-2 text-slate-400 hover:text-blue-600 transition-colors"><ICONS.Filter className="w-4 h-4" /></button>
          </div>
        </div>
        <table className="w-full text-left text-sm border-collapse">
          <thead>
            <tr className="border-b border-slate-50 text-slate-400 font-medium text-xs">
              <th className="p-4">标题</th>
              <th className="p-4">日期</th>
              <th className="p-4">状态</th>
              <th className="p-4">打开率</th>
              <th className="p-4">点击率</th>
              <th className="p-4">询盘数</th>
              <th className="p-4 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-50">
            {campaigns.map((c) => (
              <tr key={c.id} className="hover:bg-slate-50/50 transition-colors group">
                <td className="p-4">
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-900">{c.title}</p>
                    <p className="text-[10px] text-slate-400 truncate max-w-[200px]" title={c.subject}>{c.subject}</p>
                  </div>
                </td>
                <td className="p-4 text-xs text-slate-500">{c.date}</td>
                <td className="p-4">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold border ${
                    c.status === '已发送' ? 'bg-green-50 text-green-600 border-green-100' : 
                    c.status === '草稿' ? 'bg-slate-50 text-slate-500 border-slate-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                  }`}>
                    {c.status}
                  </span>
                </td>
                <td className="p-4 font-mono text-xs text-slate-600">{c.openRate}%</td>
                <td className="p-4 font-mono text-xs text-slate-600">{c.clickRate}%</td>
                <td className="p-4 font-mono text-xs text-slate-600">{c.inquiryCount}</td>
                <td className="p-4 text-right">
                  <div className="flex items-center justify-end gap-2">
                    <button onClick={() => onEditCampaign(c)} className="p-2 text-slate-400 hover:text-blue-600 transition-colors"><ICONS.Edit className="w-4 h-4" /></button>
                    <button className="p-2 text-slate-400 hover:text-blue-600 transition-colors"><ICONS.Eye className="w-4 h-4" /></button>
                    <button className="p-2 text-slate-400 hover:text-red-600 transition-colors"><ICONS.Trash className="w-4 h-4" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EmailMarketing;
