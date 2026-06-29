
import React, { useState } from 'react';
import { ICONS } from '../constants';
import { Logo } from './Logo';
import { User } from 'firebase/auth';
import { motion, AnimatePresence } from 'motion/react';
import { useToast } from './Toast';

interface SidebarProps {
  activeItem: string;
  setActiveItem: (item: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onOpenSettings: () => void;
  user: User | null;
  onLogout: () => void;
  permissions?: string[];
  currentStore: string;
  onSwitchStore: (name: string) => void;
  stores: { id: string; name: string; icon: string; color: string }[];
}

const Sidebar: React.FC<SidebarProps> = ({ 
  activeItem, 
  setActiveItem, 
  isCollapsed, 
  onToggleCollapse, 
  onOpenSettings, 
  user, 
  onLogout, 
  permissions,
  currentStore,
  onSwitchStore,
  stores
}) => {
  const { toast } = useToast();
  const [openMenus, setOpenMenus] = useState<string[]>([]);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [isStoreMenuOpen, setIsStoreMenuOpen] = useState(false);

  const navItems: { label: string; icon: React.ReactNode; hasSub?: boolean; children?: (string | { label: string; icon: React.ReactNode })[] }[] = [
    { label: '站点启动清单', icon: <ICONS.CheckCircle /> },
    { 
      label: '商品', 
      icon: <ICONS.Store />,
      hasSub: true,
      children: ['商品管理', '系列']
    },
    { 
      label: '客户', 
      icon: <ICONS.Customer />,
      hasSub: true,
      children: ['客户', '细分']
    },
    { label: '询盘', icon: <ICONS.Inquiry /> },
    { 
      label: '内容', 
      icon: <ICONS.Layout />,
      hasSub: true,
      children: ['博客', '素材库', '扩展字段', '菜单']
    },
    { 
      label: '店铺设计', 
      icon: <ICONS.Decoration />,
      hasSub: true,
      children: ['在线店铺', '自定义页面']
    },
    { 
      label: 'SEO', 
      icon: <ICONS.Globe />,
      hasSub: true,
      children: ['SEO策略', 'SEO检测', 'SEO管理', 'SEO博客', '效果分析']
    },
    { 
      label: '营销', 
      icon: <ICONS.Marketing />,
      hasSub: true,
      children: ['邮件营销', '社媒营销']
    },
    { 
      label: '推广渠道', 
      icon: <ICONS.SalesChannel />,
      hasSub: true,
      children: [
        'Facebook & Instagram',
        'Google & YouTube',
        'Tiktok',
        'Pinterest'
      ]
    },
    { label: '分析', icon: <ICONS.Analysis /> },
  ];

  const filteredNavItems = permissions 
    ? navItems
        .filter(item => permissions.includes(item.label))
        .map(item => ({
          ...item,
          children: item.children?.filter(child => {
            const childLabel = typeof child === 'string' ? child : child.label;
            return permissions.includes(childLabel);
          })
        }))
    : navItems;

  const toggleMenu = (item: typeof navItems[0]) => {
    if (isCollapsed) {
      onToggleCollapse();
      if (!openMenus.includes(item.label)) {
        setOpenMenus(prev => [...prev, item.label]);
      }
      // If it has children, select the first one
      if (item.hasSub && item.children && item.children.length > 0) {
        const firstChild = item.children[0];
        setActiveItem(typeof firstChild === 'string' ? firstChild : firstChild.label);
      }
      return;
    }

    if (item.hasSub) {
      const isOpen = openMenus.includes(item.label);
      if (!isOpen) {
        setOpenMenus(prev => [...prev, item.label]);
        // Auto select first child when opening
        if (item.children && item.children.length > 0) {
          const firstChild = item.children[0];
          setActiveItem(typeof firstChild === 'string' ? firstChild : firstChild.label);
        }
      } else {
        setOpenMenus(prev => prev.filter(i => i !== item.label));
      }
    } else {
      setActiveItem(item.label);
    }
  };

  return (
    <aside className={`${isCollapsed ? 'w-[72px]' : 'w-[240px]'} h-screen bg-[#F3F4F9] border-r border-slate-200 flex flex-col fixed left-0 top-0 overflow-y-auto no-scrollbar transition-all duration-300 z-20`}>
      {/* Brand Header */}
      <div className={`p-4 flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} overflow-hidden h-16`}>
        <div 
          onClick={() => isCollapsed && onToggleCollapse()}
          className={`flex items-center gap-3 cursor-pointer transition-all duration-300 ${isCollapsed ? 'justify-center' : ''}`}
        >
          <Logo size={32} />
          {!isCollapsed && <span className="font-bold text-slate-900 whitespace-nowrap">星盘AI</span>}
        </div>
        {!isCollapsed && (
          <button 
            onClick={onToggleCollapse}
            className="p-1.5 hover:bg-slate-200 rounded-lg transition-all text-slate-500"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
        )}
      </div>

      {/* Nav Content */}
      <nav className={`flex-1 ${isCollapsed ? 'px-2' : 'px-3'} py-4 space-y-2`}>
        {filteredNavItems.map((item) => {
          const isSubActive = item.children?.some(child => 
            typeof child === 'string' ? child === activeItem : child.label === activeItem
          );
          const isActive = activeItem === item.label || isSubActive;
          const isExpanded = !isCollapsed && item.hasSub && openMenus.includes(item.label);
          
          return (
            <div key={item.label}>
              <button
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => toggleMenu(item)}
                className={`w-full flex items-center ${isCollapsed ? 'justify-center px-0' : 'justify-between px-3'} py-2.5 rounded-xl transition-all duration-200 group relative ${
                  isActive 
                    ? 'text-blue-600' 
                    : 'text-slate-500 hover:bg-slate-200'
                }`}
                title={isCollapsed ? item.label : ''}
              >
                <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3'}`}>
                  <span className={isActive ? 'text-blue-600' : 'text-slate-500 group-hover:text-slate-900 transition-colors'}>
                    {item.icon}
                  </span>
                  {!isCollapsed && <span className="text-sm font-semibold whitespace-nowrap">{item.label}</span>}
                </div>
                {!isCollapsed && item.hasSub && (
                  <svg className={`w-4 h-4 transition-transform duration-200 ${openMenus.includes(item.label) ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                )}
                
                {isCollapsed && isActive && (
                  <div className="absolute left-0 w-1 h-6 bg-blue-600 rounded-r-full" />
                )}
              </button>
              
              {!isCollapsed && item.hasSub && openMenus.includes(item.label) && (
                <div className="mt-1 ml-9 space-y-1">
                  {item.children?.map((child) => {
                    const label = typeof child === 'string' ? child : child.label;
                    const icon = typeof child === 'string' ? null : child.icon;
                    return (
                      <button
                        key={label}
                        onClick={() => setActiveItem(label)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all ${
                          activeItem === label 
                            ? 'bg-blue-600 text-white font-bold' 
                            : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                        }`}
                      >
                        {icon}
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Profile Footer */}
      <div className={`p-3 border-t border-slate-200 mt-auto bg-[#F3F4F9] flex flex-col ${isCollapsed ? 'items-center gap-3' : 'gap-2'}`}>
        <div 
          onClick={() => {
            onOpenSettings();
            if (isCollapsed) onToggleCollapse();
          }}
          className={`flex items-center cursor-pointer hover:bg-slate-200 rounded-lg transition-all duration-200 group overflow-hidden ${
            isCollapsed ? 'justify-center w-9 h-9' : 'gap-2.5 px-2 py-1.5'
          }`}
          title="设置"
        >
          <div className="w-4 h-4 flex items-center justify-center">
            <ICONS.Settings className="text-slate-500 group-hover:text-slate-900 transition-all group-hover:rotate-45" />
          </div>
          {!isCollapsed && <span className="text-xs font-semibold text-slate-500 group-hover:text-slate-900 whitespace-nowrap">设置</span>}
        </div>
        
        <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'justify-between'} overflow-hidden w-full ${!isCollapsed ? 'px-1' : ''} relative`}>
          <div className="flex items-center gap-2.5">
            <div 
              onClick={() => setShowUserMenu(!showUserMenu)}
              className="w-8 h-8 rounded-full bg-blue-400 border border-white flex items-center justify-center overflow-hidden flex-shrink-0 cursor-pointer shadow-sm hover:scale-105 transition-transform"
            >
               <img src={user?.photoURL || "https://picsum.photos/32/32"} alt="Avatar" referrerPolicy="no-referrer" />
            </div>
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] font-bold text-slate-900 whitespace-nowrap truncate" title={user?.displayName || '用户'}>{user?.displayName || '用户'}</span>
                <span className="text-[11px] text-slate-400 leading-none">免费版</span>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <button 
              onClick={onLogout}
              className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-all"
              title="退出登录"
            >
               <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
            </button>
          )}

          {showUserMenu && isCollapsed && (
            <div className="absolute bottom-full left-full ml-2 mb-2 w-44 bg-white border border-slate-200 rounded-lg shadow-xl z-50 py-1.5 overflow-hidden">
              <div className="px-3 py-1.5 border-b border-slate-100 mb-1">
                <div className="text-[11px] font-bold text-slate-900 truncate" title={user?.displayName || ''}>{user?.displayName}</div>
                <div className="text-[11px] text-slate-400 truncate" title={user?.email || ''}>{user?.email}</div>
              </div>
              <button 
                onClick={onLogout}
                className="w-full text-left px-3 py-1.5 text-xs text-red-600 hover:bg-red-50 flex items-center gap-2"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" /></svg>
                退出登录
              </button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
