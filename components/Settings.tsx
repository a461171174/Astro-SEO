import React, { useState } from 'react';
import { motion } from 'motion/react';
import { MediaLibrary } from './MediaLibrary';
import StaffManagement from './StaffManagement';
import { MediaItem, Staff } from '../types';
import { 
  Settings as SettingsIcon, 
  Globe, 
  Shield, 
  Users, 
  CreditCard, 
  Languages, 
  Image as ImageIcon, 
  Database, 
  History,
  X,
  Plus,
  Trash2,
  ExternalLink,
  Check,
  ChevronRight,
  Upload,
  Search,
  Share2,
  FileText,
  Cookie,
  Flag
} from 'lucide-react';

interface SettingsProps {
  onClose: () => void;
  staffList: Staff[];
}

const Settings: React.FC<SettingsProps> = ({ onClose, staffList }) => {
  const [activeSection, setActiveSection] = useState('通用设置');
  const [isMediaLibraryOpen, setIsMediaLibraryOpen] = useState(false);
  const [logoMode, setLogoMode] = useState<'main' | 'square' | null>(null);
  const [logos, setLogos] = useState({ main: '', square: '' });
  const [socialLinks, setSocialLinks] = useState([
    { id: 1, name: 'Facebook', icon: 'FB', color: 'bg-[#1877F2]', url: '' },
    { id: 2, name: 'Instagram', icon: 'IG', color: 'bg-gradient-to-tr from-[#f9ce34] via-[#ee2a7b] to-[#6228d7]', url: '' },
    { id: 3, name: 'X (Twitter)', icon: 'X', color: 'bg-black', url: '' },
  ]);

  const addSocialLink = () => {
    const newId = socialLinks.length > 0 ? Math.max(...socialLinks.map(l => l.id)) + 1 : 1;
    setSocialLinks([...socialLinks, { id: newId, name: '自定义', icon: 'Link', color: 'bg-slate-400', url: '' }]);
  };

  const removeSocialLink = (id: number) => {
    setSocialLinks(socialLinks.filter(link => link.id !== id));
  };

  const updateSocialLink = (id: number, url: string) => {
    setSocialLinks(socialLinks.map(link => link.id === id ? { ...link, url } : link));
  };

  const sections = [
    { id: '通用设置', icon: <SettingsIcon size={18} />, label: '通用设置' },
    { id: '套餐', icon: <CreditCard size={18} />, label: '套餐' },
    { id: '账号管理', icon: <Users size={18} />, label: '账号管理' },
    { id: '域名', icon: <Globe size={18} />, label: '域名' },
    { id: '语言', icon: <Languages size={18} />, label: '语言' },
    { id: '素材', icon: <ImageIcon size={18} />, label: '素材' },
    { id: '客户隐私', icon: <Shield size={18} />, label: '客户隐私' },
    { id: '操作日志', icon: <History size={18} />, label: '操作日志' },
  ];

  const handleLogoSelect = (items: MediaItem[]) => {
    if (items.length > 0 && logoMode) {
      setLogos(prev => ({ ...prev, [logoMode]: items[0].url }));
    }
    setIsMediaLibraryOpen(false);
    setLogoMode(null);
  };

  const renderSectionContent = () => {
    switch (activeSection) {
      case '通用设置':
        return (
          <div className="space-y-8">
            <section>
              <h3 className="text-lg font-bold mb-4">基础信息</h3>
              <div className="grid grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">店铺名称</label>
                  <input type="text" defaultValue="Happy Paws" className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">店铺邮箱</label>
                  <input type="email" defaultValue="contact@happypaws.com" className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500" />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">时区</label>
                  <select className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>(GMT+08:00) Beijing, Shanghai</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">币种</label>
                  <select className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500">
                    <option>USD ($)</option>
                    <option>CNY (¥)</option>
                  </select>
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-bold mb-4">品牌形象</h3>
              <div className="space-y-6">
                <div className="flex items-start gap-8">
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">Logos</label>
                    <div 
                      onClick={() => { setLogoMode('main'); setIsMediaLibraryOpen(true); }}
                      className="w-48 h-32 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer overflow-hidden"
                    >
                      {logos.main ? (
                        <img src={logos.main} className="w-full h-full object-contain" alt="Logo" />
                      ) : (
                        <>
                          <Plus className="text-slate-400 mb-2" />
                          <span className="text-xs text-slate-500 text-center px-4">建议宽度：最小 512 像素</span>
                        </>
                      )}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">方形Logo</label>
                    <div 
                      onClick={() => { setLogoMode('square'); setIsMediaLibraryOpen(true); }}
                      className="w-32 h-32 border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center bg-slate-50 hover:bg-slate-100 transition-colors cursor-pointer overflow-hidden"
                    >
                      {logos.square ? (
                        <img src={logos.square} className="w-full h-full object-contain" alt="Square Logo" />
                      ) : (
                        <>
                          <Plus className="text-slate-400 mb-2" />
                          <span className="text-xs text-slate-500 text-center px-4">可裁剪为圆形</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </section>

            <section>
              <div className="flex justify-between items-center mb-6">
                <div>
                  <h3 className="text-lg font-bold">社交媒体链接</h3>
                  <p className="text-sm text-slate-500">这些链接将显示在您的店铺页脚和关于页面中</p>
                </div>
                <button 
                  onClick={addSocialLink}
                  className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors"
                >
                  <Plus size={16} /> 添加自定义链接
                </button>
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                {socialLinks.map(platform => (
                  <div key={platform.id} className="flex items-center gap-4 p-4 bg-white border border-slate-100 rounded-2xl hover:border-blue-200 transition-all group">
                    <div className={`w-10 h-10 rounded-xl ${platform.color} flex items-center justify-center text-white font-bold text-xs shadow-sm`}>
                      {platform.icon}
                    </div>
                    <div className="flex-1">
                      <div className="text-sm font-bold text-slate-900">{platform.name}</div>
                      <input 
                        type="text" 
                        value={platform.url}
                        onChange={(e) => updateSocialLink(platform.id, e.target.value)}
                        placeholder={`输入您的 ${platform.name} 主页链接`}
                        className="w-full mt-1 bg-transparent border-none p-0 text-sm text-blue-600 placeholder-slate-300 focus:ring-0"
                      />
                    </div>
                    <button 
                      onClick={() => removeSocialLink(platform.id)}
                      className="p-2 text-slate-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </section>

            <section className="p-6 bg-blue-50 rounded-[32px] border border-blue-100">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                  <Share2 size={24} />
                </div>
                <div>
                  <h4 className="font-bold text-blue-900">同步到营销中心</h4>
                  <p className="text-sm text-blue-700/70 mt-1 leading-relaxed">
                    在此处配置的社交媒体链接将自动同步到“社媒营销”模块，方便您在发布动态时快速选择目标平台。
                  </p>
                </div>
              </div>
            </section>
          </div>
        );
      case '套餐':
        return (
          <div className="space-y-6">
            <div className="p-6 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-2xl text-white shadow-lg">
              <div className="flex justify-between items-start mb-8">
                <div>
                  <h3 className="text-2xl font-bold mb-1">专业版 (Professional)</h3>
                  <p className="text-blue-100 opacity-80">当前正在使用的套餐</p>
                </div>
                <div className="bg-white/20 px-4 py-1 rounded-full text-sm font-medium backdrop-blur-sm">
                  剩余 245 天
                </div>
              </div>
              <button className="bg-white text-blue-600 px-6 py-2 rounded-xl font-bold hover:bg-blue-50 transition-colors">
                续费或升级
              </button>
            </div>
            
            <div className="grid grid-cols-3 gap-6">
              {[
                { name: '基础版', price: '$29', features: ['100个商品', '基础分析', '标准模板'] },
                { name: '专业版', price: '$79', features: ['无限商品', '高级分析', '所有模板', '优先支持'], active: true },
                { name: '企业版', price: '定制', features: ['SLA保障', '专属经理', 'API访问', '白标定制'] },
              ].map(plan => (
                <div key={plan.name} className={`p-6 rounded-2xl border-2 transition-all ${plan.active ? 'border-blue-500 bg-blue-50/50' : 'border-slate-100 bg-white'}`}>
                  <h4 className="font-bold text-lg mb-2">{plan.name}</h4>
                  <div className="text-2xl font-black mb-4">{plan.price}<span className="text-sm font-normal text-slate-500">/月</span></div>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map(f => (
                      <li key={f} className="flex items-center gap-2 text-sm text-slate-600">
                        <Check size={14} className="text-green-500" /> {f}
                      </li>
                    ))}
                  </ul>
                  <button className={`w-full py-2 rounded-xl font-bold transition-all ${plan.active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}>
                    {plan.active ? '当前套餐' : '选择套餐'}
                  </button>
                </div>
              ))}
            </div>
          </div>
        );
      case '账号管理':
        return (
          <div className="space-y-8">
            <section>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">店铺所有者</h3>
              </div>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center text-white font-bold text-xl">H</div>
                  <div>
                    <div className="font-bold">Happy Paws Admin</div>
                    <div className="text-sm text-slate-500">admin@happypaws.com</div>
                  </div>
                </div>
                <div className="px-3 py-1 bg-blue-100 text-blue-600 text-xs font-bold rounded-full uppercase tracking-wider">Owner</div>
              </div>
            </section>

            <section>
              <StaffManagement staffList={staffList} />
            </section>
          </div>
        );
      case '域名':
        return (
          <div className="space-y-8">
            <section>
              <h3 className="text-lg font-bold mb-4">系统二级域名</h3>
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Globe className="text-blue-600" size={20} />
                  <span className="font-medium">happypaws.astro.com</span>
                </div>
                <button className="text-blue-600 hover:underline text-sm flex items-center gap-1">
                  访问网站 <ExternalLink size={14} />
                </button>
              </div>
            </section>

            <section>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">自定义域名</h3>
                <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors">
                  <Plus size={16} /> 绑定域名
                </button>
              </div>
              <div className="space-y-4">
                <div className="p-4 border border-slate-100 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Globe className="text-slate-400" size={20} />
                    <div>
                      <div className="font-medium">www.happypaws.com</div>
                      <div className="text-xs text-green-500 flex items-center gap-1">
                        <Check size={12} /> TLS 证书已生效
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors">管理</button>
                    <button className="px-3 py-1 text-red-500 text-xs font-bold hover:bg-red-50 rounded-lg transition-colors">移除</button>
                  </div>
                </div>
              </div>
            </section>
          </div>
        );
      case '语言':
        return (
          <div className="space-y-8">
            <section>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">店铺语言</h3>
                <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors">
                  <Plus size={16} /> 添加语言
                </button>
              </div>
              <div className="space-y-3">
                {[
                  { lang: '简体中文', code: 'zh-CN', isDefault: true },
                  { lang: 'English', code: 'en-US', isDefault: false },
                ].map(item => (
                  <div key={item.code} className="p-4 border border-slate-100 rounded-xl flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-xs font-bold text-slate-500">{item.code}</div>
                      <span className="font-medium">{item.lang}</span>
                      {item.isDefault && <span className="px-2 py-0.5 bg-blue-100 text-blue-600 text-[10px] font-bold rounded uppercase">默认</span>}
                    </div>
                    <div className="flex gap-2">
                      <button className="px-3 py-1 bg-slate-100 text-slate-600 text-xs font-bold rounded-lg hover:bg-slate-200 transition-colors">翻译管理</button>
                      {!item.isDefault && <button className="px-3 py-1 text-slate-400 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>}
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        );
      case '素材':
        return <MediaLibrary standalone />;
      case '客户隐私':
        return (
          <div className="space-y-8">
            <section>
              <h3 className="text-lg font-bold mb-4">隐私设置</h3>
              <div className="bg-white border border-slate-100 rounded-2xl overflow-hidden shadow-sm">
                <div className="p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
                      <FileText size={20} />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">隐私政策</div>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-300" />
                </div>

                <div className="p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors border-b border-slate-50">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
                      <CreditCard size={20} />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">Cookie 横幅</div>
                      <div className="text-xs text-slate-400 border-b border-dotted border-slate-300 inline-block">爱尔兰, 爱沙尼亚, 奥地利和其他28个地区</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="flex items-center gap-1 px-2 py-0.5 bg-green-50 text-green-600 text-[10px] font-bold rounded-full border border-green-100">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                      启用
                    </span>
                    <ChevronRight size={18} className="text-slate-300" />
                  </div>
                </div>

                <div className="p-4 flex items-center justify-between hover:bg-slate-50 cursor-pointer transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600">
                      <Globe size={20} />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">数据销售选择退出页面</div>
                      <div className="text-xs text-slate-400">美国</div>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-300" />
                </div>
              </div>
            </section>

            <section>
              <h3 className="text-lg font-bold mb-4">数据存储托管位置</h3>
              <div className="bg-white border border-slate-100 rounded-2xl p-4 flex items-center gap-4 shadow-sm">
                <div className="w-10 h-7 bg-slate-100 rounded overflow-hidden flex items-center justify-center">
                  <img src="https://flagcdn.com/w40/us.png" alt="US Flag" className="w-full h-full object-cover" />
                </div>
                <div className="font-bold text-slate-900">美国</div>
              </div>
            </section>

            <div className="text-center pt-4">
              <p className="text-xs text-slate-400">
                本页的隐私设置仅供参考。您应自行确保遵守适用的法律法规。 <a href="#" className="text-blue-600 hover:underline">详细了解</a>
              </p>
            </div>
          </div>
        );
      case '操作日志':
        return (
          <div className="space-y-4">
            <div className="flex justify-between items-center mb-2">
              <h3 className="text-lg font-bold">最近操作</h3>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 bg-slate-100 text-slate-600 rounded-lg text-xs font-bold">全部</button>
                <button className="px-3 py-1.5 text-slate-500 rounded-lg text-xs font-bold">商品</button>
                <button className="px-3 py-1.5 text-slate-500 rounded-lg text-xs font-bold">设置</button>
              </div>
            </div>
            <div className="space-y-1">
              {[
                { user: 'Admin', action: '修改了店铺名称', time: '10分钟前', module: '通用设置' },
                { user: 'Zhang San', action: '更新了商品 "Pawsome Bed"', time: '45分钟前', module: '商品管理' },
                { user: 'Admin', action: '添加了新语言: English', time: '2小时前', module: '语言设置' },
                { user: 'Admin', action: '登录了系统', time: '5小时前', module: '系统' },
              ].map((log, i) => (
                <div key={i} className="p-4 flex items-center justify-between hover:bg-slate-50 rounded-xl transition-colors">
                  <div className="flex items-center gap-4">
                    <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center text-xs font-bold text-slate-500">{log.user[0]}</div>
                    <div>
                      <div className="text-sm font-medium text-slate-900"><span className="font-bold">{log.user}</span> {log.action}</div>
                      <div className="text-xs text-slate-500">{log.module} • {log.time}</div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-64 border-r border-slate-100 p-6 space-y-1">
        <h2 className="text-xl font-black mb-8 px-2">店铺设置</h2>
        {sections.map((section) => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`w-full flex items-center gap-3 px-4 py-2.5 rounded-xl text-sm font-bold transition-all ${
              activeSection === section.id 
                ? 'bg-blue-600 text-white shadow-md shadow-blue-100' 
                : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {section.icon}
            {section.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        <div className="flex items-center justify-between px-8 py-6 border-b border-slate-100">
          <h2 className="text-2xl font-black">{activeSection}</h2>
          <div className="flex items-center gap-4">
            <button className="px-6 py-2 bg-slate-100 text-slate-600 rounded-xl font-bold hover:bg-slate-200 transition-colors">取消</button>
            <button className="px-6 py-2 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100">保存更改</button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-8 bg-slate-50/30">
          <div className="max-w-4xl mx-auto">
            {renderSectionContent()}
          </div>
        </div>
      </div>

      <MediaLibrary 
        isOpen={isMediaLibraryOpen}
        onClose={() => { setIsMediaLibraryOpen(false); setLogoMode(null); }}
        onSelect={handleLogoSelect}
        multiSelect={false}
      />
    </div>
  );
};

export default Settings;
