
import React, { useState, useMemo } from 'react';
import { Menu, MenuItem, Product, Collection, Blog, BlogSet, Page } from '../types';
import { ICONS } from '../constants';

interface MenuEditorProps {
  initialData?: Menu | null;
  products: Product[];
  collections: Collection[];
  blogs: Blog[];
  blogSets: BlogSet[];
  pages: Page[];
  onSave: (menu: Menu) => void;
  onCancel: () => void;
}

const MenuEditor: React.FC<MenuEditorProps> = ({ 
  initialData, 
  products, 
  collections, 
  blogs, 
  blogSets, 
  pages, 
  onSave, 
  onCancel 
}) => {
  const [menu, setMenu] = useState<Menu>(initialData || {
    id: '',
    title: '',
    handle: '',
    items: [],
    updatedAt: new Date().toISOString()
  });

  const [editingItem, setEditingItem] = useState<{ item: MenuItem, path: number[] } | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectionView, setSelectionView] = useState<'categories' | 'resources'>('categories');

  const handleAddItem = (parentPath: number[] = []) => {
    const newItem: MenuItem = {
      id: Date.now().toString(),
      label: '新菜单项',
      url: '/',
      type: 'link'
    };

    const newMenu = { ...menu };
    let current = newMenu.items;
    for (const index of parentPath) {
      if (!current[index].children) current[index].children = [];
      current = current[index].children!;
    }
    current.push(newItem);
    setMenu(newMenu);
  };

  const handleRemoveItem = (path: number[]) => {
    const newMenu = { ...menu };
    let current = newMenu.items;
    const lastIndex = path[path.length - 1];
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]].children!;
    }
    current.splice(lastIndex, 1);
    setMenu(newMenu);
  };

  const handleUpdateItem = (path: number[], updates: Partial<MenuItem>) => {
    const newMenu = { ...menu };
    let current = newMenu.items;
    const lastIndex = path[path.length - 1];
    for (let i = 0; i < path.length - 1; i++) {
      current = current[path[i]].children!;
    }
    current[lastIndex] = { ...current[lastIndex], ...updates };
    setMenu(newMenu);
  };

  const getResourceList = (type: MenuItem['type']) => {
    switch (type) {
      case 'product': return products.map(p => ({ id: p.id, title: p.title, url: `/products/${p.id}` }));
      case 'collection': return collections.map(c => ({ id: c.id, title: c.title, url: `/collections/${c.id}` }));
      case 'blog': return blogs.map(b => ({ id: b.id, title: b.title, url: `/blogs/${b.id}` }));
      case 'blogSet': return blogSets.map(bs => ({ id: bs.id, title: bs.title, url: `/blog-sets/${bs.id}` }));
      case 'page': return pages.map(p => ({ id: p.id, title: p.title, url: `/pages/${p.id}` }));
      default: return [];
    }
  };

  const filteredResources = useMemo(() => {
    if (!editingItem || selectionView === 'categories') return [];
    const list = getResourceList(editingItem.item.type);
    return list.filter(r => r.title.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [editingItem?.item.type, selectionView, searchTerm, products, collections, blogs, blogSets, pages]);

  const categories = [
    { id: 'home', label: '主页', icon: <ICONS.Home className="w-5 h-5" />, hasArrow: false, url: '/' },
    { id: 'search', label: '搜索', icon: <ICONS.Search className="w-5 h-5" />, hasArrow: false, url: '/search' },
    { id: 'collection', label: '产品系列', icon: <ICONS.Tag className="w-5 h-5" />, hasArrow: true },
    { id: 'product', label: '产品', icon: <ICONS.Tag className="w-5 h-5" />, hasArrow: true },
    { id: 'page', label: '页面', icon: <ICONS.FileText className="w-5 h-5" />, hasArrow: true },
    { id: 'blogSet', label: '博客', icon: <ICONS.Edit className="w-5 h-5" />, hasArrow: true },
    { id: 'blog', label: '博客文章', icon: <ICONS.Edit className="w-5 h-5" />, hasArrow: true },
    { id: 'policy', label: '政策', icon: <ICONS.Help className="w-5 h-5" />, hasArrow: true },
    { id: 'link', label: '自定义链接', icon: <ICONS.Link className="w-5 h-5" />, hasArrow: false },
  ];

  const renderMenuItems = (items: MenuItem[], path: number[] = [], level: number = 1) => {
    return (
      <div className="space-y-2">
        {items.map((item, index) => {
          const currentPath = [...path, index];
          return (
            <div key={item.id} className="border border-slate-200 rounded-lg overflow-hidden bg-white">
              <div className="flex items-center justify-between p-3 bg-slate-50 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="text-slate-400"><ICONS.More className="w-4 h-4 rotate-90" /></span>
                  <div className="flex flex-col">
                    <span className="font-medium text-slate-700">{item.label}</span>
                    <span className="text-[10px] text-slate-400 flex items-center gap-1">
                      <span className="px-1 bg-slate-200 rounded text-slate-500">{item.type}</span>
                      {item.url}
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {level < 3 && (
                    <button 
                      onClick={() => handleAddItem(currentPath)}
                      className="p-1.5 text-blue-600 hover:bg-blue-50 rounded transition-colors"
                      title="添加子菜单"
                    >
                      <ICONS.Plus className="w-4 h-4" />
                    </button>
                  )}
                  <button 
                    onClick={() => {
                      setEditingItem({ item, path: currentPath });
                      setSearchTerm('');
                      setSelectionView('categories');
                    }}
                    className="p-1.5 text-slate-400 hover:text-blue-600 rounded transition-colors"
                  >
                    <ICONS.Edit className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleRemoveItem(currentPath)}
                    className="p-1.5 text-slate-400 hover:text-red-500 rounded transition-colors"
                  >
                    <ICONS.Trash className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {item.children && item.children.length > 0 && (
                <div className="p-3 pl-8 bg-white border-t border-slate-50">
                  {renderMenuItems(item.children, currentPath, level + 1)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold text-slate-900">{initialData ? '编辑菜单' : '创建菜单'}</h2>
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">取消</button>
          <button 
            onClick={() => onSave(menu)}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-100"
          >
            保存菜单
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-900">菜单信息</h3>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">标题</label>
              <input 
                type="text" 
                value={menu.title}
                onChange={(e) => setMenu({ ...menu, title: e.target.value })}
                placeholder="例如：主菜单"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700">Handle</label>
              <input 
                type="text" 
                value={menu.handle}
                onChange={(e) => setMenu({ ...menu, handle: e.target.value })}
                placeholder="例如：main-menu"
                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-[10px] text-slate-400">Handle 用于在代码中引用此菜单。</p>
            </div>
          </div>
        </div>

        <div className="md:col-span-2 space-y-6">
          <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-slate-900">菜单项</h3>
              <button 
                onClick={() => handleAddItem()}
                className="text-blue-600 text-sm font-bold hover:underline flex items-center gap-1"
              >
                <ICONS.Plus className="w-4 h-4" /> 添加菜单项
              </button>
            </div>
            
            {menu.items.length === 0 ? (
              <div className="py-12 border-2 border-dashed border-slate-100 rounded-xl text-center text-slate-400">
                暂无菜单项，点击上方按钮添加。
              </div>
            ) : (
              renderMenuItems(menu.items)
            )}
          </div>
        </div>
      </div>

      {editingItem && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between flex-shrink-0">
              <h3 className="font-bold text-slate-900">编辑菜单项</h3>
              <button onClick={() => setEditingItem(null)} className="text-slate-400 hover:text-slate-600 transition-colors">
                <ICONS.Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>
            <div className="p-6 space-y-6 overflow-y-auto">
              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">显示名称</label>
                  <input 
                    type="text" 
                    value={editingItem.item.label}
                    onChange={(e) => setEditingItem({ ...editingItem, item: { ...editingItem.item, label: e.target.value } })}
                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-medium text-slate-700">链接</label>
                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    {selectionView === 'categories' ? (
                      <div className="divide-y divide-slate-100">
                        {categories.map(cat => (
                          <button
                            key={cat.id}
                            onClick={() => {
                              if (cat.hasArrow) {
                                setEditingItem({ ...editingItem, item: { ...editingItem.item, type: cat.id as any } });
                                setSelectionView('resources');
                              } else {
                                setEditingItem({ 
                                  ...editingItem, 
                                  item: { 
                                    ...editingItem.item, 
                                    type: cat.id as any, 
                                    url: cat.url || '/',
                                    label: editingItem.item.label === '新菜单项' ? cat.label : editingItem.item.label
                                  } 
                                });
                              }
                            }}
                            className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors group"
                          >
                            <div className="flex items-center gap-3">
                              <span className="text-slate-400 group-hover:text-blue-600 transition-colors">{cat.icon}</span>
                              <span className="text-sm font-medium text-slate-700">{cat.label}</span>
                            </div>
                            {cat.hasArrow && <ICONS.ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-blue-600 transition-all group-hover:translate-x-1" />}
                          </button>
                        ))}
                      </div>
                    ) : (
                      <div className="flex flex-col">
                        <div className="p-3 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
                          <button 
                            onClick={() => setSelectionView('categories')}
                            className="text-xs font-bold text-blue-600 flex items-center gap-1 hover:underline"
                          >
                            <ICONS.ChevronRight className="w-3 h-3 rotate-180" /> 返回
                          </button>
                          <span className="text-xs font-bold text-slate-400">选择{categories.find(c => c.id === editingItem.item.type)?.label}</span>
                        </div>
                        <div className="p-3">
                          <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                              <ICONS.Search className="w-4 h-4" />
                            </span>
                            <input 
                              type="text" 
                              placeholder="搜索..." 
                              value={searchTerm}
                              onChange={(e) => setSearchTerm(e.target.value)}
                              className="w-full px-10 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                          </div>
                        </div>
                        <div className="max-h-60 overflow-y-auto divide-y divide-slate-100">
                          {filteredResources.length === 0 ? (
                            <div className="p-8 text-center text-slate-400 text-xs italic">未找到相关资源</div>
                          ) : (
                            filteredResources.map(res => (
                              <button
                                key={res.id}
                                onClick={() => {
                                  setEditingItem({ 
                                    ...editingItem, 
                                    item: { 
                                      ...editingItem.item, 
                                      referenceId: res.id, 
                                      url: res.url,
                                      label: editingItem.item.label === '新菜单项' ? res.title : editingItem.item.label
                                    } 
                                  });
                                  setSelectionView('categories');
                                }}
                                className={`w-full text-left px-4 py-3 text-sm transition-colors flex items-center justify-between ${
                                  editingItem.item.referenceId === res.id 
                                    ? 'bg-blue-50 text-blue-600' 
                                    : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <span>{res.title}</span>
                                {editingItem.item.referenceId === res.id && <ICONS.Plus className="w-4 h-4" />}
                              </button>
                            ))
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {editingItem.item.type === 'link' && (
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-700">链接地址</label>
                    <input 
                      type="text" 
                      value={editingItem.item.url}
                      onChange={(e) => setEditingItem({ ...editingItem, item: { ...editingItem.item, url: e.target.value } })}
                      placeholder="https://example.com"
                      className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 flex-shrink-0">
              <button onClick={() => setEditingItem(null)} className="px-4 py-2 text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">取消</button>
              <button 
                onClick={() => {
                  handleUpdateItem(editingItem.path, editingItem.item);
                  setEditingItem(null);
                }}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 transition-colors"
              >
                应用
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MenuEditor;
