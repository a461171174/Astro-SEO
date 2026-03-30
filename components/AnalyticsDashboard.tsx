
import React, { useState, useMemo } from 'react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, 
  AreaChart, Area, PieChart, Pie, Cell, BarChart, Bar 
} from 'recharts';
import { MOCK_ANALYTICS } from '../constants';
import { ICONS } from '../constants';

const AnalyticsDashboard: React.FC = () => {
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | 'custom'>('7d');
  const [customRange, setCustomRange] = useState({ 
    start: '2024-02-01', 
    end: '2024-02-20' 
  });

  const filteredData = useMemo(() => {
    if (timeRange === '7d') {
      return MOCK_ANALYTICS.slice(-7);
    }
    if (timeRange === '30d') {
      return MOCK_ANALYTICS.slice(-30);
    }
    if (timeRange === 'custom') {
      if (!customRange.start || !customRange.end) return MOCK_ANALYTICS.slice(-7);
      return MOCK_ANALYTICS.filter(item => 
        item.date >= customRange.start && item.date <= customRange.end
      );
    }
    return MOCK_ANALYTICS;
  }, [timeRange, customRange]);

  const stats = [
    { label: '当前在线客户', value: '24', change: '实时更新', trend: 'neutral', icon: <ICONS.Customer className="w-4 h-4" /> },
    { label: '今日访问数', value: '1,284', change: '+12.5%', trend: 'up', icon: <ICONS.Analysis className="w-4 h-4" /> },
    { label: '今日询盘数', value: '42', change: '+8.2%', trend: 'up', icon: <ICONS.Inquiry className="w-4 h-4" /> },
    { label: '转化率', value: '3.27%', change: '-0.4%', trend: 'down', icon: <ICONS.Marketing className="w-4 h-4" /> },
  ];

  const sourceData = [
    { name: 'Direct', value: 100, color: '#4F75FF' },
  ];

  const locationData = [
    { name: 'Singapore', value: 50, color: '#4F75FF' },
    { name: 'China', value: 50, color: '#2ECC71' },
  ];

  const deviceData = [
    { name: 'Desktop', value: 100, color: '#4F75FF' },
  ];

  const topProducts = [
    { name: '智能宠物喂食机 Pro', visits: 1240, inquiries: 85, image: 'https://picsum.photos/seed/p1/40/40' },
    { name: '自动循环饮水机', visits: 980, inquiries: 62, image: 'https://picsum.photos/seed/p2/40/40' },
    { name: '智能猫砂盆', visits: 850, inquiries: 45, image: 'https://picsum.photos/seed/p3/40/40' },
    { name: '宠物健康监测项圈', visits: 720, inquiries: 38, image: 'https://picsum.photos/seed/p4/40/40' },
  ];

  const topPages = [
    { path: '/', title: '首页', visits: 3200 },
    { path: '/products', title: '所有商品', visits: 2100 },
    { path: '/collections/smart-tech', title: '智能科技系列', visits: 1500 },
    { path: '/about', title: '关于我们', visits: 800 },
  ];

  const hourlyData = [
    { hour: '00:00', visits: 120, inquiries: 5 },
    { hour: '04:00', visits: 80, inquiries: 2 },
    { hour: '08:00', visits: 450, inquiries: 15 },
    { hour: '12:00', visits: 890, inquiries: 32 },
    { hour: '16:00', visits: 1100, inquiries: 45 },
    { hour: '20:00', visits: 950, inquiries: 28 },
    { hour: '23:59', visits: 400, inquiries: 12 },
  ];

  const renderDonutChart = (title: string, data: any[]) => (
    <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm flex flex-col">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-sm font-bold text-slate-900 border-b-2 border-dotted border-slate-300 pb-1">{title}</h3>
        <button className="text-slate-400 hover:text-slate-600">
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 16 16"><path d="M9.5 13a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0zm0-5a1.5 1.5 0 1 1-3 0 1.5 1.5 0 0 1 3 0z"/></svg>
        </button>
      </div>
      <div className="flex-1 flex items-center">
        <div className="w-1/2 space-y-3">
          {data.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }} />
              <span className="text-xs text-slate-600 whitespace-nowrap">{item.name} {item.value.toFixed(2)}% {item.count || ''}</span>
            </div>
          ))}
        </div>
        <div className="w-1/2 h-40">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                innerRadius={45}
                outerRadius={65}
                paddingAngle={0}
                dataKey="value"
                stroke="none"
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <h1 className="text-xl font-bold text-slate-900">分析</h1>
          <span className="px-2 py-0.5 bg-blue-50 text-blue-600 text-[10px] font-bold rounded-full border border-blue-100 uppercase tracking-wider">
            实时数据
          </span>
        </div>
        <button className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-all shadow-sm shadow-blue-200">
          <ICONS.Download className="w-4 h-4" />
          导出报告
        </button>
      </div>

      {/* Today's Overview Section */}
      <section className="space-y-6">
        <div className="flex items-center gap-2">
          <div className="w-1 h-4 bg-blue-600 rounded-full" />
          <h2 className="text-base font-bold text-slate-900">今日概览</h2>
          <span className="text-xs text-slate-400 font-normal ml-2">数据更新于: {new Date().toLocaleTimeString()}</span>
        </div>

        {/* Real-time Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {stats.map((stat) => (
            <div key={stat.label} className="bg-white p-5 rounded-xl border border-slate-100 shadow-sm">
              <div className="flex items-center justify-between mb-3">
                <div className="p-2 bg-slate-50 rounded-lg text-slate-400">
                  {stat.icon}
                </div>
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                  stat.trend === 'up' ? 'bg-green-50 text-green-600' : 
                  stat.trend === 'down' ? 'bg-red-50 text-red-600' : 'bg-slate-50 text-slate-500'
                }`}>
                  {stat.change}
                </span>
              </div>
              <p className="text-xs font-medium text-slate-400 mb-1 uppercase tracking-wider">{stat.label}</p>
              <h3 className="text-2xl font-bold text-slate-900">{stat.value}</h3>
            </div>
          ))}
        </div>

        {/* Hourly Analysis */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-6">按时间段展示访问量</h3>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="visits" fill="#3b82f6" radius={[4, 4, 0, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-6">按时间展示询盘量</h3>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hourlyData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                  <Tooltip 
                    cursor={{fill: '#f8fafc'}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="inquiries" fill="#10b981" radius={[4, 4, 0, 0]} barSize={30} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </section>

      {/* Historical Trends Section */}
      <section className="space-y-6 pt-6 border-t border-slate-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-1 h-4 bg-slate-400 rounded-full" />
            <h2 className="text-base font-bold text-slate-900">历史趋势</h2>
            <span className="px-2 py-0.5 bg-slate-100 text-slate-500 text-[10px] font-bold rounded-full border border-slate-200 uppercase tracking-wider ml-2">
              历史数据
            </span>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex bg-white border border-slate-200 rounded-lg p-1 shadow-sm">
              <button 
                onClick={() => setTimeRange('7d')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${timeRange === '7d' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                最近7天
              </button>
              <button 
                onClick={() => setTimeRange('30d')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${timeRange === '30d' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                最近30天
              </button>
              <button 
                onClick={() => setTimeRange('custom')}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${timeRange === 'custom' ? 'bg-slate-900 text-white shadow-sm' : 'text-slate-500 hover:text-slate-900'}`}
              >
                自定义
              </button>
            </div>

            {timeRange === 'custom' && (
              <div className="flex items-center gap-2 animate-in fade-in slide-in-from-right-4 duration-300 bg-slate-50 p-1 rounded-lg border border-slate-200">
                <div className="flex items-center gap-1.5 px-2">
                  <ICONS.Filter className="w-3 h-3 text-slate-400" />
                  <input 
                    type="date" 
                    value={customRange.start}
                    onChange={(e) => setCustomRange(prev => ({ ...prev, start: e.target.value }))}
                    className="bg-transparent border-none text-[11px] font-bold text-slate-700 focus:ring-0 p-0 cursor-pointer"
                  />
                  <span className="text-slate-300 text-[10px] font-bold mx-1">/</span>
                  <input 
                    type="date" 
                    value={customRange.end}
                    onChange={(e) => setCustomRange(prev => ({ ...prev, end: e.target.value }))}
                    className="bg-transparent border-none text-[11px] font-bold text-slate-700 focus:ring-0 p-0 cursor-pointer"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Trends */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold text-slate-900">店铺访问数趋势</h3>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                <div className="w-2 h-2 rounded-full bg-blue-500" />
                <span>{timeRange === '7d' ? '最近7天' : timeRange === '30d' ? '最近30天' : '自定义范围'}</span>
              </div>
            </div>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredData}>
                  <defs>
                    <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="visitors" stroke="#3b82f6" strokeWidth={2} fillOpacity={1} fill="url(#colorVisits)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl border border-slate-100 shadow-sm">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-sm font-bold text-slate-900">询盘数趋势</h3>
              <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                <div className="w-2 h-2 rounded-full bg-emerald-500" />
                <span>{timeRange === '7d' ? '最近7天' : timeRange === '30d' ? '最近30天' : '自定义范围'}</span>
              </div>
            </div>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={filteredData}>
                  <defs>
                    <linearGradient id="colorInq" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#94a3b8'}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Area type="monotone" dataKey="inquiries" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorInq)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>


      {/* Top Lists */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50">
            <h3 className="text-sm font-bold text-slate-900">热门访问商品</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50">
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">商品</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">访问量</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">询盘数</th>
                  <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-wider">转化率</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {topProducts.map((product, idx) => (
                  <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                        <img src={product.image} className="w-10 h-10 rounded-lg object-cover" alt="" />
                        <span className="text-sm font-medium text-slate-700">{product.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-medium">{product.visits.toLocaleString()}</td>
                    <td className="px-6 py-4 text-sm text-slate-600 font-medium">{product.inquiries}</td>
                    <td className="px-6 py-4">
                      <span className="text-xs font-bold text-blue-600">{(product.inquiries / product.visits * 100).toFixed(1)}%</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-hidden">
          <div className="p-6 border-b border-slate-50">
            <h3 className="text-sm font-bold text-slate-900">热门访问页面</h3>
          </div>
          <div className="divide-y divide-slate-50">
            {topPages.map((page, idx) => (
              <div key={idx} className="p-4 hover:bg-slate-50/50 transition-colors flex items-center justify-between">
                <div className="flex flex-col">
                  <span className="text-sm font-medium text-slate-700">{page.title}</span>
                  <span className="text-[10px] text-slate-400 font-mono">{page.path}</span>
                </div>
                <div className="text-right">
                  <span className="text-sm font-bold text-slate-900">{page.visits.toLocaleString()}</span>
                  <p className="text-[10px] text-slate-400">访问次</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Source Charts (Reference Image Style) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {renderDonutChart('按流量来源查看访问量', sourceData)}
        {renderDonutChart('按地点查看访问量', locationData)}
        {renderDonutChart('按设备查看访问量', deviceData)}
      </div>
    </section>
  </div>
  );
};

export default AnalyticsDashboard;
