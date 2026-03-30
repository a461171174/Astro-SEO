import React, { useState } from 'react';
import { motion } from 'motion/react';
import { ICONS } from '../constants';
import { Product } from '../types';

interface SalesChannelProps {
  channelName: string;
  products: Product[];
}

const SalesChannels: React.FC<SalesChannelProps> = ({ channelName, products }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('概览');

  const handleConnect = () => {
    setIsConnected(true);
  };

  const handleSync = () => {
    setIsSyncing(true);
    setSyncProgress(0);
    const interval = setInterval(() => {
      setSyncProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsSyncing(false);
          return 100;
        }
        return prev + 10;
      });
    }, 300);
  };

  const renderOverview = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="text-sm text-slate-500 mb-1">推广点击量</div>
          <div className="text-2xl font-bold text-slate-900">12,405</div>
          <div className="mt-2 text-xs text-emerald-600 flex items-center gap-1">
            <span>↑ 12.5%</span>
            <span className="text-slate-400">较上周</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="text-sm text-slate-500 mb-1">转化订单数</div>
          <div className="text-2xl font-bold text-slate-900">342</div>
          <div className="mt-2 text-xs text-emerald-600 flex items-center gap-1">
            <span>↑ 8.2%</span>
            <span className="text-slate-400">较上周</span>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
          <div className="text-sm text-slate-500 mb-1">推广转化率</div>
          <div className="text-2xl font-bold text-slate-900">2.75%</div>
          <div className="mt-2 text-xs text-slate-400 flex items-center gap-1">
            <span>持平</span>
            <span className="text-slate-400">较上周</span>
          </div>
        </div>
      </div>

      <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm">
        <h3 className="text-lg font-bold mb-4">推广趋势分析</h3>
        <div className="h-64 flex items-end gap-2 px-4">
          {[40, 60, 45, 90, 65, 80, 70].map((h, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-2">
              <motion.div 
                initial={{ height: 0 }}
                animate={{ height: `${h}%` }}
                className="w-full bg-blue-100 rounded-t-lg relative group"
              >
                <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-slate-900 text-white text-[10px] px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap">
                  {Math.floor(h * 123)} 点击
                </div>
              </motion.div>
              <span className="text-[10px] text-slate-400">02-{14 + i}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderProductSync = () => (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
      <div className="p-6 border-b border-slate-100 flex justify-between items-center">
        <div>
          <h3 className="text-lg font-bold">商品同步管理</h3>
          <p className="text-sm text-slate-500">同步您的商品到 {channelName} 进行推广</p>
        </div>
        <button 
          onClick={handleSync}
          disabled={isSyncing}
          className="bg-blue-600 text-white px-6 py-2 rounded-xl font-bold text-sm hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2"
        >
          {isSyncing ? (
            <>
              <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              同步中 {syncProgress}%
            </>
          ) : '立即同步'}
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-6 py-4 font-bold">商品</th>
              <th className="px-6 py-4 font-bold">状态</th>
              <th className="px-6 py-4 font-bold">最后同步时间</th>
              <th className="px-6 py-4 font-bold">推广数据</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {products.slice(0, 5).map(product => (
              <tr key={product.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <img 
                      src={product.media[0]?.url} 
                      alt="" 
                      className="w-10 h-10 rounded-lg object-cover border border-slate-100"
                    />
                    <span className="text-sm font-medium text-slate-900 line-clamp-1" title={product.title}>{product.title}</span>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                    已同步
                  </span>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500">2024-02-24 14:30</td>
                <td className="px-6 py-4">
                  <div className="text-xs text-slate-600">
                    <div>点击: {Math.floor(Math.random() * 1000)}</div>
                    <div>转化: {Math.floor(Math.random() * 50)}</div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (!isConnected) {
    return (
      <div className="h-[70vh] flex flex-col items-center justify-center space-y-8">
        <div className="w-24 h-24 bg-blue-50 rounded-3xl flex items-center justify-center text-4xl shadow-inner">
          {channelName === 'Facebook & Instagram' ? 'FB' : 
           channelName === 'Google & YouTube' ? 'G' : 
           channelName === 'Tiktok' ? 'TT' : 
           channelName === 'Pinterest' ? 'P' : '🔗'}
        </div>
        <div className="text-center max-w-xl">
          <h2 className="text-2xl font-bold text-slate-900 mb-4">
            {channelName === 'Facebook & Instagram' ? '通过 Facebook & Instagram 进行销售和推广' : `绑定 ${channelName} 账号`}
          </h2>
          <div className="space-y-3 text-slate-500">
            {channelName === 'Facebook & Instagram' ? (
              <>
                <p className="flex items-center justify-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                  产品可在 Facebook、Instagram 等渠道展示与销售
                </p>
                <p className="flex items-center justify-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                  结合 Meta Ads 广告推广，精准触达更多潜在客户
                </p>
                <p className="flex items-center justify-center gap-2">
                  <span className="w-1.5 h-1.5 bg-blue-400 rounded-full" />
                  借助 Meta Pixel 进行数据追踪与效果分析，优化投放策略
                </p>
              </>
            ) : (
              <p>连接您的 {channelName} 推广账号，自动同步商品并开启数据追踪分析，提升您的品牌曝光。</p>
            )}
          </div>
        </div>
        <button 
          onClick={handleConnect}
          className="bg-blue-600 text-white px-10 py-3 rounded-2xl font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
        >
          立即绑定账号
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white font-bold text-lg">
            {channelName.charAt(0)}
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{channelName} 推广渠道</h1>
            <div className="flex items-center gap-2 text-sm text-emerald-600 font-medium">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              已连接推广账号
            </div>
          </div>
        </div>
        <div className="flex bg-slate-100 p-1 rounded-xl">
          {['概览', '商品同步', '数据分析'].map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                activeTab === tab ? 'bg-white text-blue-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activeTab === '概览' && renderOverview()}
      {activeTab === '商品同步' && renderProductSync()}
      {activeTab === '数据分析' && (
        <div className="bg-white p-12 rounded-2xl border border-slate-100 shadow-sm text-center space-y-4">
          <div className="text-4xl">📊</div>
          <h3 className="text-lg font-bold">深度数据分析</h3>
          <p className="text-slate-500 max-w-sm mx-auto">
            正在收集来自 {channelName} 的推广数据。详细的埋点分析报告将在 24 小时内生成。
          </p>
        </div>
      )}
    </div>
  );
};

export default SalesChannels;
