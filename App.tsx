
import React, { useState, useEffect, Component, ErrorInfo, ReactNode } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import ProductTable from './components/ProductTable';
import ProductEditor from './components/ProductEditor';
import CollectionTable from './components/CollectionTable';
import CollectionEditor from './components/CollectionEditor';
import InquiryList from './components/InquiryList';
import { MediaLibrary } from './components/MediaLibrary';
import CustomerList from './components/CustomerList';
import CustomerDetail from './components/CustomerDetail';
import CustomerCompare from './components/CustomerCompare';
import CustomerSegments from './components/CustomerSegments';
import AnalyticsDashboard from './components/AnalyticsDashboard';
import SiteBuilder from './components/SiteBuilder';
import EmailMarketing from './components/EmailMarketing';
import EmailEditor from './components/EmailEditor';
import SocialMarketing from './components/SocialMarketing';
import SalesChannels from './components/SalesChannels';
import Home from './components/Home';
import Settings from './components/Settings';
import AIChatPanel from './components/AIChatPanel';
import GenericListView from './components/GenericListView';
import GenericContentEditor from './components/GenericContentEditor';
import MenuEditor from './components/MenuEditor';
import StaffManagement from './components/StaffManagement';
import SEODashboard from './components/SEODashboard';
import { Menu, MenuItem, Customer, Product, Collection, EmailCampaign, Blog, BlogSet, Page, Staff } from './types';
import { ICONS, MOCK_PRODUCTS, MOCK_COLLECTIONS, MOCK_CAMPAIGNS, MOCK_BLOGS, MOCK_BLOG_SETS, MOCK_PAGES, MOCK_MENUS } from './constants';
import { geminiService } from './services/geminiService';
import { auth, db, loginWithGoogle, logout, handleFirestoreError, OperationType } from './firebase';
import { isAbortError, cleanObject } from './utils';
import { onAuthStateChanged, User } from 'firebase/auth';
import { collection, onSnapshot, query, orderBy, setDoc, doc, deleteDoc, Timestamp, serverTimestamp, getDoc } from 'firebase/firestore';

// Error Boundary Component
class ErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean, errorInfo: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, errorInfo: '' };
  }

  static getDerivedStateFromError(error: any) {
    if (isAbortError(error)) {
      return { hasError: false, errorInfo: '' };
    }
    
    let message = error?.message || String(error);
    
    // Try to parse JSON error from handleFirestoreError
    try {
      if (message.startsWith('{')) {
        const parsed = JSON.parse(message);
        message = parsed.error || message;
      }
    } catch (e) {
      // Not JSON, keep original message
    }

    return { hasError: true, errorInfo: message };
  }

  componentDidCatch(error: any, errorInfo: ErrorInfo) {
    console.error("ErrorBoundary caught an error", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
          <div className="max-w-md w-full bg-white rounded-2xl shadow-xl p-8 text-center border border-red-100">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center text-red-600 mx-auto mb-6">
              <ICONS.Plus className="w-8 h-8 rotate-45" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">出错了</h2>
            <p className="text-slate-500 mb-6">应用程序遇到意外错误。请尝试刷新页面或联系支持。</p>
            <div className="bg-slate-50 rounded-lg p-4 text-left mb-6 overflow-auto max-h-40">
              <code className="text-xs text-red-500 break-all">{this.state.errorInfo}</code>
            </div>
            <button 
              onClick={() => window.location.reload()}
              className="w-full py-3 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
            >
              刷新页面
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthLoading, setIsAuthLoading] = useState(true);
  const [products, setProducts] = useState<Product[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [blogs, setBlogs] = useState<Blog[]>([]);
  const [blogSets, setBlogSets] = useState<BlogSet[]>([]);
  const [pages, setPages] = useState<Page[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [productSearchQuery, setProductSearchQuery] = useState('');

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState('全部');
  const [activeView, setActiveView] = useState('主页');
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [compareCustomers, setCompareCustomers] = useState<Customer[]>([]);
  const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [initialAIMessage, setInitialAIMessage] = useState('');
  const [currentStore, setCurrentStore] = useState('Happy Paws');
  const [brandName, setBrandName] = useState('');
  const [seoStrategy, setSeoStrategy] = useState('');
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [customPrompts, setCustomPrompts] = useState<any>({});

  const stores = [
    { id: '1', name: 'Happy Paws', icon: 'HP', color: 'bg-orange-500' },
    { id: '2', name: 'Pet Paradise', icon: 'PP', color: 'bg-blue-500' },
    { id: '3', name: 'Cat Kingdom', icon: 'CK', color: 'bg-purple-500' },
  ];
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isAddingProduct, setIsAddingProduct] = useState(false);
  const [editingCollection, setEditingCollection] = useState<Collection | null>(null);
  const [isAddingCollection, setIsAddingCollection] = useState(false);
  const [editingCampaign, setEditingCampaign] = useState<EmailCampaign | null>(null);
  const [isAddingCampaign, setIsAddingCampaign] = useState(false);

  const [editingBlog, setEditingBlog] = useState<Blog | null>(null);
  const [isAddingBlog, setIsAddingBlog] = useState(false);
  const [editingBlogSet, setEditingBlogSet] = useState<BlogSet | null>(null);
  const [isAddingBlogSet, setIsAddingBlogSet] = useState(false);
  const [editingPage, setEditingPage] = useState<Page | null>(null);
  const [isAddingPage, setIsAddingPage] = useState(false);
  const [menus, setMenus] = useState<Menu[]>([]);
  const [editingMenu, setEditingMenu] = useState<Menu | null>(null);
  const [isAddingMenu, setIsAddingMenu] = useState(false);
  const [blogSubView, setBlogSubView] = useState<'sets' | 'posts'>('sets');

  const [showImportMenu, setShowImportMenu] = useState(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Firebase Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
      setUser(currentUser);
      setIsAuthLoading(false);

      if (currentUser) {
        // Ensure user document exists in Firestore
        try {
          const userRef = doc(db, 'users', currentUser.uid);
          const userDoc = await getDoc(userRef);
          
          if (!userDoc.exists()) {
            // Create default user document if it doesn't exist
            await setDoc(userRef, cleanObject({
              uid: currentUser.uid,
              email: currentUser.email,
              displayName: currentUser.displayName,
              role: currentUser.email === 'huangjcyyds@gmail.com' ? 'admin' : 'editor', // Default to editor for new users for now
              createdAt: serverTimestamp()
            }));
            console.log('Created new user document for:', currentUser.email);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.WRITE, `users/${currentUser.uid}`);
        }
      }
    });
    return () => unsubscribe();
  }, []);

  // Firestore Real-time Sync
  useEffect(() => {
    if (!user) return;

    const unsubProducts = onSnapshot(
      query(collection(db, 'products'), orderBy('updatedAt', 'desc')),
      (snapshot) => {
        setProducts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Product)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'products')
    );

    const unsubCollections = onSnapshot(
      query(collection(db, 'collections'), orderBy('updatedAt', 'desc')),
      (snapshot) => {
        setCollections(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Collection)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'collections')
    );

    const unsubBlogs = onSnapshot(
      query(collection(db, 'blogs'), orderBy('updatedAt', 'desc')),
      (snapshot) => {
        setBlogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Blog)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'blogs')
    );

    const unsubBlogSets = onSnapshot(
      query(collection(db, 'blogSets'), orderBy('updatedAt', 'desc')),
      (snapshot) => {
        setBlogSets(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as BlogSet)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'blogSets')
    );

    const unsubPages = onSnapshot(
      query(collection(db, 'pages'), orderBy('updatedAt', 'desc')),
      (snapshot) => {
        setPages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Page)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'pages')
    );

    const unsubMenus = onSnapshot(
      query(collection(db, 'menus'), orderBy('updatedAt', 'desc')),
      (snapshot) => {
        const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Menu));
        setMenus(data.length > 0 ? data : MOCK_MENUS);
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'menus')
    );

    const unsubStaff = onSnapshot(
      query(collection(db, 'staff'), orderBy('updatedAt', 'desc')),
      (snapshot) => {
        setStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Staff)));
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'staff')
    );

    const unsubBrand = onSnapshot(doc(db, 'seoConfigs', 'global'), (doc) => {
      if (doc.exists()) {
        const data = doc.data();
        setBrandName(data.brandName || '');
        setSeoStrategy(data.strategy || '');
        setSelectedKeywords(data.keywords || []);
      }
    });

    const unsubPrompts = onSnapshot(doc(db, 'seoConfigs', 'prompts'), (doc) => {
      if (doc.exists()) {
        setCustomPrompts(doc.data());
      }
    });

    return () => {
      unsubProducts();
      unsubCollections();
      unsubBlogs();
      unsubBlogSets();
      unsubPages();
      unsubMenus();
      unsubStaff();
      unsubBrand();
      unsubPrompts();
    };
  }, [user]);

  const productTabs = ['全部', '草稿', '已上架', '存档'];

  const filteredProducts = products.filter(p => {
    const matchesTab = activeTab === '全部' || p.status === activeTab;
    const matchesSearch = !productSearchQuery || p.title.toLowerCase().includes(productSearchQuery.toLowerCase());
    return matchesTab && matchesSearch;
  });

  const handleSelectProduct = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const fetchAiInsights = async () => {
    setIsAiLoading(true);
    try {
      const result = await geminiService.analyzeInventory(products);
      setAiSuggestions(result);
    } catch (error) {
      if (isAbortError(error)) return;
      console.error('Failed to fetch AI insights:', error);
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleSaveProduct = async (p: Product) => {
    try {
      const id = p.id || Date.now().toString();
      const productData = {
        ...p,
        id,
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'products', id), cleanObject(productData));
      setEditingProduct(null);
      setIsAddingProduct(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'products');
    }
  };

  const handleSaveCollection = async (c: Collection) => {
    try {
      const id = c.id || Date.now().toString();
      const collectionData = {
        ...c,
        id,
        updatedAt: new Date().toISOString()
      };
      await setDoc(doc(db, 'collections', id), cleanObject(collectionData));
      setEditingCollection(null);
      setIsAddingCollection(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'collections');
    }
  };

  const handleSaveCampaign = (campaign: any) => {
    // In a real app, this would be an API call
    console.log('Saving campaign:', campaign);
    setEditingCampaign(null);
    setIsAddingCampaign(false);
    setActiveView('邮件营销');
  };

  const handleDeleteCollection = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'collections', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `collections/${id}`);
    }
  };

  const handlePreviewCollection = (c: Collection) => {
    window.open(`${window.location.origin}/collections/${c.seoUrl || c.id}`, '_blank');
  };

  const handleImport = (platform: string) => {
    alert(`正在从 ${platform} 导入商品... (模拟功能)`);
    setShowImportMenu(false);
  };

  const renderContent = () => {
    switch (activeView) {
      case '主页':
        return <Home onOpenSettings={() => setIsSettingsOpen(true)} onNavigate={(view) => setActiveView(view)} />;
      case '商品':
      case '商品管理':
        if (editingProduct || isAddingProduct) {
          return (
            <ProductEditor 
              product={editingProduct || undefined} 
              brandName={brandName}
              strategy={seoStrategy}
              selectedKeywords={selectedKeywords}
              customPrompt={customPrompts.seoAudit}
              onSave={handleSaveProduct}
              onCancel={() => {
                setEditingProduct(null);
                setIsAddingProduct(false);
              }}
            />
          );
        }
        return (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold text-slate-900">产品</h1>
              <div className="flex items-center gap-2">
                <button 
                  onClick={() => alert('正在导出商品数据...')}
                  className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  导出
                </button>
                <button 
                  onClick={() => setShowImportMenu(!showImportMenu)}
                  className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  导入
                </button>
                <div className="relative">
                  <button 
                    onClick={() => setIsAddingProduct(true)}
                    className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors flex items-center gap-1 shadow-sm"
                  >
                    添加产品
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" /></svg>
                  </button>
                  {showImportMenu && (
                    <div className="absolute top-full right-0 mt-1 w-56 bg-white border border-slate-200 rounded-lg shadow-xl z-30 py-1 overflow-hidden">
                      <div className="px-4 py-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider">主流平台导入</div>
                      <button onClick={() => handleImport('Shopify')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Shopify 导入</button>
                      <button onClick={() => handleImport('Shopline')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Shopline 导入</button>
                      <button onClick={() => handleImport('Shoplazza')} className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50">Shoplazza 导入</button>
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-200">
                <div className="flex items-center gap-6">
                  {productTabs.map(tab => (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`pb-2 text-sm font-medium transition-all relative ${
                        activeTab === tab ? 'text-slate-900' : 'text-slate-500 hover:text-slate-700'
                      }`}
                    >
                      {tab}
                      {activeTab === tab && (
                        <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-slate-900 rounded-full" />
                      )}
                    </button>
                  ))}
                  <button className="pb-2 text-slate-400 hover:text-slate-600">
                    <ICONS.Plus className="w-4 h-4" />
                  </button>
                </div>
                <div className="flex items-center gap-4 pb-2">
                  <div className="relative group">
                    <ICONS.Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                    <input 
                      type="text"
                      placeholder="搜索标题..."
                      value={productSearchQuery}
                      onChange={(e) => setProductSearchQuery(e.target.value)}
                      className="pl-8 pr-3 py-1 bg-slate-50 border border-slate-200 rounded-lg text-xs w-40 focus:ring-2 focus:ring-blue-500/20 focus:bg-white transition-all outline-none"
                    />
                  </div>
                  <button className="p-1 text-slate-500 hover:bg-slate-100 rounded transition-colors"><ICONS.Filter className="w-4 h-4" /></button>
                  <button className="p-1 text-slate-500 hover:bg-slate-100 rounded transition-colors"><ICONS.Columns className="w-4 h-4" /></button>
                  <button className="p-1 text-slate-500 hover:bg-slate-100 rounded transition-colors"><ICONS.Sort className="w-4 h-4" /></button>
                </div>
              </div>
              <ProductTable 
                products={filteredProducts}
                selectedIds={selectedIds} 
                onSelectProduct={handleSelectProduct} 
                onEditProduct={(p) => setEditingProduct(p)}
              />
            </div>
          </div>
        );
      case '系列':
        if (editingCollection || isAddingCollection) {
          return (
            <CollectionEditor 
              collection={editingCollection || undefined}
              products={products}
              brandName={brandName}
              onSave={handleSaveCollection}
              onCancel={() => {
                setEditingCollection(null);
                setIsAddingCollection(false);
              }}
            />
          );
        }
        return (
          <CollectionTable 
            collections={collections}
            onEditCollection={(c) => setEditingCollection(c)}
            onAddCollection={() => setIsAddingCollection(true)}
            onDeleteCollection={handleDeleteCollection}
            onPreviewCollection={handlePreviewCollection}
          />
        );
      case '博客':
        if (editingBlog || isAddingBlog) {
          return (
            <GenericContentEditor 
              type="blog"
              initialData={editingBlog}
              onSave={async (data) => {
                try {
                  const id = data.id || Date.now().toString();
                  await setDoc(doc(db, 'blogs', id), cleanObject({ ...data, id, updatedAt: new Date().toISOString() }));
                  setEditingBlog(null);
                  setIsAddingBlog(false);
                } catch (error) {
                  handleFirestoreError(error, OperationType.WRITE, 'blogs');
                }
              }}
              onCancel={() => {
                setEditingBlog(null);
                setIsAddingBlog(false);
              }}
            />
          );
        }
        return (
          <GenericListView 
            title="博客"
            items={blogs}
            columns={[
              { key: 'title', label: '标题' },
              { key: 'status', label: '状态', render: (item) => (
                <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                  item.status === '已发布' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-600'
                }`}>
                  {item.status}
                </span>
              )},
              { key: 'updatedAt', label: '更新时间' }
            ]}
            onAdd={() => setIsAddingBlog(true)}
            onEdit={(item) => setEditingBlog(item)}
            onDelete={async (id) => {
              try {
                await deleteDoc(doc(db, 'blogs', id));
              } catch (error) {
                handleFirestoreError(error, OperationType.DELETE, `blogs/${id}`);
              }
            }}
            extraHeaderContent={
              <button 
                onClick={() => setActiveView('博客集')}
                className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                管理博客集
              </button>
            }
          />
        );
      case '博客集':
        if (blogSubView === 'posts') {
          if (editingBlog || isAddingBlog) {
            return (
              <GenericContentEditor 
                type="blog"
                initialData={editingBlog}
                onSave={async (data) => {
                  try {
                    const id = data.id || Date.now().toString();
                    await setDoc(doc(db, 'blogs', id), cleanObject({ ...data, id, updatedAt: new Date().toISOString() }));
                    setEditingBlog(null);
                    setIsAddingBlog(false);
                  } catch (error) {
                    handleFirestoreError(error, OperationType.WRITE, 'blogs');
                  }
                }}
                onCancel={() => {
                  setEditingBlog(null);
                  setIsAddingBlog(false);
                }}
              />
            );
          }
          return (
            <GenericListView 
              title="博客"
              items={blogs}
              columns={[
                { key: 'title', label: '标题' },
                { key: 'status', label: '状态', render: (item) => (
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                    item.status === '已发布' ? 'bg-green-100 text-green-600' : 'bg-slate-100 text-slate-600'
                  }`}>
                    {item.status}
                  </span>
                )},
                { key: 'updatedAt', label: '更新时间' }
              ]}
              onAdd={() => setIsAddingBlog(true)}
              onEdit={(item) => setEditingBlog(item)}
              onDelete={async (id) => {
                try {
                  await deleteDoc(doc(db, 'blogs', id));
                } catch (error) {
                  handleFirestoreError(error, OperationType.DELETE, `blogs/${id}`);
                }
              }}
              extraHeaderContent={
                <button 
                  onClick={() => setBlogSubView('sets')}
                  className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
                >
                  返回博客集
                </button>
              }
            />
          );
        }

        if (editingBlogSet || isAddingBlogSet) {
          return (
            <GenericContentEditor 
              type="blog-set"
              initialData={editingBlogSet}
              onSave={async (data) => {
                try {
                  const id = data.id || Date.now().toString();
                  await setDoc(doc(db, 'blogSets', id), cleanObject({ ...data, id, updatedAt: new Date().toISOString() }));
                  setEditingBlogSet(null);
                  setIsAddingBlogSet(false);
                } catch (error) {
                  handleFirestoreError(error, OperationType.WRITE, 'blogSets');
                }
              }}
              onCancel={() => {
                setEditingBlogSet(null);
                setIsAddingBlogSet(false);
              }}
            />
          );
        }
        return (
          <GenericListView 
            title="博客集"
            items={blogSets}
            columns={[
              { key: 'title', label: '标题' },
              { key: 'updatedAt', label: '更新时间' }
            ]}
            onAdd={() => setIsAddingBlogSet(true)}
            onEdit={(item) => setEditingBlogSet(item)}
            onDelete={async (id) => {
              try {
                await deleteDoc(doc(db, 'blogSets', id));
              } catch (error) {
                handleFirestoreError(error, OperationType.DELETE, `blogSets/${id}`);
              }
            }}
            extraHeaderContent={
              <button 
                onClick={() => setBlogSubView('posts')}
                className="px-4 py-1.5 bg-white border border-slate-200 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors"
              >
                返回博客
              </button>
            }
          />
        );
      case '自定义页面':
        if (editingPage || isAddingPage) {
          return (
            <GenericContentEditor 
              type="page"
              initialData={editingPage}
              onSave={async (data) => {
                try {
                  const id = data.id || Date.now().toString();
                  await setDoc(doc(db, 'pages', id), cleanObject({ ...data, id, updatedAt: new Date().toISOString() }));
                  setEditingPage(null);
                  setIsAddingPage(false);
                } catch (error) {
                  handleFirestoreError(error, OperationType.WRITE, 'pages');
                }
              }}
              onCancel={() => {
                setEditingPage(null);
                setIsAddingPage(false);
              }}
            />
          );
        }
        return (
          <GenericListView 
            title="自定义页面"
            items={pages}
            columns={[
              { key: 'title', label: '标题' },
              { key: 'template', label: '模版' },
              { key: 'updatedAt', label: '更新时间' }
            ]}
            onAdd={() => setIsAddingPage(true)}
            onEdit={(item) => setEditingPage(item)}
            onDelete={async (id) => {
              try {
                await deleteDoc(doc(db, 'pages', id));
              } catch (error) {
                handleFirestoreError(error, OperationType.DELETE, `pages/${id}`);
              }
            }}
          />
        );
      case '扩展字段':
        return (
          <div className="space-y-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl font-bold text-slate-900">扩展字段</h1>
              <button className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors">
                <ICONS.Plus className="w-4 h-4" /> 添加字段
              </button>
            </div>
            <div className="space-y-3">
              {[
                { name: '材质说明', type: '文本', key: 'material' },
                { name: '保养指南', type: '富文本', key: 'care_guide' },
                { name: '产地', type: '选择器', key: 'origin' },
              ].map(field => (
                <div key={field.key} className="p-4 border border-slate-200 rounded-xl flex items-center justify-between bg-white hover:border-blue-500 transition-all group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 bg-slate-50 rounded-lg flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                      <ICONS.Apps className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="font-bold text-slate-900">{field.name}</div>
                      <div className="text-xs text-slate-500">Key: {field.key} • 类型: {field.type}</div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="p-2 text-slate-400 hover:text-blue-600 transition-colors"><ICONS.Settings className="w-4 h-4" /></button>
                    <button className="p-2 text-slate-400 hover:text-red-500 transition-colors"><ICONS.Trash className="w-4 h-4" /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case '菜单':
        if (editingMenu || isAddingMenu) {
          return (
            <MenuEditor 
              initialData={editingMenu}
              products={products}
              collections={collections}
              blogs={blogs}
              blogSets={blogSets}
              pages={pages}
              onSave={async (data) => {
                try {
                  const id = data.id || Date.now().toString();
                  await setDoc(doc(db, 'menus', id), cleanObject({ ...data, id, updatedAt: new Date().toISOString() }));
                  setEditingMenu(null);
                  setIsAddingMenu(false);
                } catch (error) {
                  handleFirestoreError(error, OperationType.WRITE, 'menus');
                }
              }}
              onCancel={() => {
                setEditingMenu(null);
                setIsAddingMenu(false);
              }}
            />
          );
        }
        return (
          <GenericListView 
            title="菜单"
            items={menus}
            columns={[
              { key: 'title', label: '标题' },
              { key: 'handle', label: 'Handle' },
              { key: 'updatedAt', label: '更新时间' }
            ]}
            onAdd={() => setIsAddingMenu(true)}
            onEdit={(item) => setEditingMenu(item)}
            onDelete={async (id) => {
              try {
                await deleteDoc(doc(db, 'menus', id));
              } catch (error) {
                handleFirestoreError(error, OperationType.DELETE, `menus/${id}`);
              }
            }}
          />
        );
      case '询盘':
        return <InquiryList />;
      case '素材库':
        return <MediaLibrary standalone />;
      case '客户':
      case '客户列表':
        if (selectedCustomer) {
          return <CustomerDetail customer={selectedCustomer} onBack={() => setSelectedCustomer(null)} />;
        }
        if (compareCustomers.length > 0) {
          return <CustomerCompare customers={compareCustomers} onBack={() => setCompareCustomers([])} />;
        }
        return (
          <CustomerList 
            onViewDetail={(c) => setSelectedCustomer(c)} 
            onCompare={(customers) => setCompareCustomers(customers)}
          />
        );
      case '细分':
        return <CustomerSegments />;
      case '分析':
        return <AnalyticsDashboard />;
      case 'SEO':
      case 'SEO检测':
      case 'SEO策略':
      case 'SEO管理':
      case 'SEO博客':
      case '效果分析':
        let seoTab: 'audit' | 'ai' | 'tracking' | 'blog' = 'audit';
        let seoMode: 'chat' | 'list' = 'chat';
        if (activeView === 'SEO策略') seoTab = 'ai';
        if (activeView === 'SEO管理') {
          seoTab = 'ai';
          seoMode = 'list';
        }
        if (activeView === 'SEO博客') seoTab = 'blog';
        if (activeView === '效果分析') seoTab = 'tracking';
        return (
          <SEODashboard 
            products={products}
            collections={collections}
            blogs={blogs}
            blogSets={blogSets}
            pages={pages}
            initialTab={seoTab}
            initialMode={seoMode}
            onTabChange={(tab) => setActiveView(tab)}
          />
        );
      case '内容':
        return (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-900">内容</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <div onClick={() => setActiveView('博客')} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-blue-500 cursor-pointer transition-all">
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 mb-4">
                  <ICONS.Type />
                </div>
                <h3 className="font-bold text-slate-900 mb-1">博客</h3>
                <p className="text-xs text-slate-500">管理您的商店博客文章</p>
              </div>
              <div onClick={() => setActiveView('素材库')} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-blue-500 cursor-pointer transition-all">
                <div className="w-10 h-10 bg-rose-50 rounded-lg flex items-center justify-center text-rose-600 mb-4">
                  <ICONS.Image />
                </div>
                <h3 className="font-bold text-slate-900 mb-1">素材库</h3>
                <p className="text-xs text-slate-500">管理您的图片和视频素材</p>
              </div>
              <div onClick={() => setActiveView('扩展字段')} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-blue-500 cursor-pointer transition-all">
                <div className="w-10 h-10 bg-amber-50 rounded-lg flex items-center justify-center text-amber-600 mb-4">
                  <ICONS.Apps />
                </div>
                <h3 className="font-bold text-slate-900 mb-1">扩展字段</h3>
                <p className="text-xs text-slate-500">管理商品和页面的自定义字段</p>
              </div>
              <div onClick={() => setActiveView('菜单')} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-blue-500 cursor-pointer transition-all">
                <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600 mb-4">
                  <ICONS.Layout />
                </div>
                <h3 className="font-bold text-slate-900 mb-1">菜单</h3>
                <p className="text-xs text-slate-500">管理在线店铺的导航菜单</p>
              </div>
            </div>
          </div>
        );
      case '店铺设计':
        return (
          <div className="space-y-6">
            <h1 className="text-2xl font-bold text-slate-900">店铺设计</h1>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-blue-500 cursor-pointer transition-all" onClick={() => setActiveView('在线店铺')}>
                <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center text-blue-600 mb-4">
                  <ICONS.Store />
                </div>
                <h3 className="font-bold text-slate-900 mb-1">在线店铺</h3>
                <p className="text-xs text-slate-500">装修您的在线店铺前端界面</p>
              </div>
              <div onClick={() => setActiveView('自定义页面')} className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm hover:border-blue-500 cursor-pointer transition-all">
                <div className="w-10 h-10 bg-emerald-50 rounded-lg flex items-center justify-center text-emerald-600 mb-4">
                  <ICONS.Decoration />
                </div>
                <h3 className="font-bold text-slate-900 mb-1">自定义页面</h3>
                <p className="text-xs text-slate-500">创建关于我们、联系我们等页面</p>
              </div>
            </div>
          </div>
        );
      case '在线店铺':
        return <SiteBuilder />;
      case '邮件营销':
        if (editingCampaign || isAddingCampaign) {
          return (
            <EmailEditor 
              campaign={editingCampaign || undefined}
              products={products}
              onSave={handleSaveCampaign}
              onCancel={() => {
                setEditingCampaign(null);
                setIsAddingCampaign(false);
              }}
              onGoToSegments={() => setActiveView('细分')}
            />
          );
        }
        return (
          <EmailMarketing 
            onAddCampaign={() => setIsAddingCampaign(true)}
            onEditCampaign={(c) => setEditingCampaign(c)}
          />
        );
      case '社媒营销':
        return <SocialMarketing products={products} onOpenSettings={() => setIsSettingsOpen(true)} />;
      case 'Facebook & Instagram':
      case 'Google & YouTube':
      case 'Tiktok':
      case 'Pinterest':
        return <SalesChannels channelName={activeView} products={products} />;
      default:
        return (
          <div className="h-[60vh] flex flex-col items-center justify-center text-slate-400 space-y-4">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center text-3xl">🛠️</div>
            <p className="text-lg font-medium">功能模块 {activeView} 正在开发中...</p>
          </div>
        );
    }
  };

  const handleSetActiveView = (view: string) => {
    setActiveView(view);
    if (view === '博客集') {
      setBlogSubView('sets');
    }
    setSelectedCustomer(null); // Reset detail view when switching main views
    setCompareCustomers([]); // Reset compare view when switching main views
  };

  if (isAuthLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-slate-500 font-medium">正在加载...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#F8F9FB] p-4">
        <div className="max-w-md w-full bg-white rounded-[32px] shadow-2xl shadow-blue-100/50 p-10 border border-white">
          <div className="flex flex-col items-center text-center space-y-6">
            <div className="w-20 h-20 bg-blue-600 rounded-3xl flex items-center justify-center text-white text-4xl font-bold shadow-xl shadow-blue-200">
              G
            </div>
            <div className="space-y-2">
              <h1 className="text-3xl font-bold text-slate-900">欢迎回来</h1>
              <p className="text-slate-500">请登录以管理您的 SaaS 产品仪表板</p>
            </div>
            <button 
              onClick={loginWithGoogle}
              className="w-full flex items-center justify-center gap-3 py-4 px-6 bg-white border border-slate-200 rounded-2xl font-semibold text-slate-700 hover:bg-slate-50 hover:border-slate-300 transition-all active:scale-[0.98] shadow-sm"
            >
              <img src="https://www.google.com/favicon.ico" referrerPolicy="no-referrer" alt="Google" className="w-5 h-5" />
              使用 Google 账号登录
            </button>
            <p className="text-xs text-slate-400">
              登录即表示您同意我们的服务条款和隐私政策
            </p>
          </div>
        </div>
      </div>
    );
  }

  const currentUserStaff = staff.find(s => s.email === user?.email);
  const userPermissions = user?.email === 'huangjcyyds@gmail.com' || currentUserStaff?.role === 'admin' 
    ? undefined 
    : currentUserStaff?.permissions;

  return (
    <ErrorBoundary>
      <div className="flex h-screen bg-[#F8F9FB] overflow-hidden">
        <Sidebar 
          activeItem={activeView} 
          setActiveItem={handleSetActiveView} 
          isCollapsed={isSidebarCollapsed}
          onToggleCollapse={() => setIsSidebarCollapsed(!isSidebarCollapsed)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          user={user}
          onLogout={logout}
          permissions={userPermissions}
          currentStore={currentStore}
          onSwitchStore={setCurrentStore}
          stores={stores}
        />
        
        <main className={`flex-1 flex flex-col transition-all duration-300 ${isSidebarCollapsed ? 'ml-[72px]' : 'ml-[240px]'}`}>
          {activeView !== '主页' && (
            <Header 
              isAILoading={isAiLoading}
              onAISubmit={(text) => {
                setInitialAIMessage(text);
                setIsAIChatOpen(true);
              }} 
            />
          )}
          
          <div className={activeView === '在线店铺' ? 'flex-1 flex flex-col overflow-hidden' : 'flex-1 p-6 overflow-y-auto'}>
            {renderContent()}
          </div>
        </main>

        {/* Settings Modal */}
        <AnimatePresence>
          {isSettingsOpen && (
            <div className="fixed inset-0 z-[100] flex items-end justify-center">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsSettingsOpen(false)}
                className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              />
              <motion.div
                initial={{ y: '100%' }}
                animate={{ y: 0 }}
                exit={{ y: '100%' }}
                transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                className="relative w-full h-[95vh] bg-[#F8F9FB] rounded-t-[40px] shadow-2xl overflow-hidden flex flex-col"
              >
                <div className="absolute top-6 right-8 z-10">
                  <button 
                    onClick={() => setIsSettingsOpen(false)}
                    className="w-10 h-10 bg-white/80 backdrop-blur-md rounded-full shadow-sm flex items-center justify-center text-slate-400 hover:text-slate-900 transition-all hover:scale-110 active:scale-95 border border-slate-100"
                  >
                    <ICONS.Plus className="w-5 h-5 rotate-45" />
                  </button>
                </div>
                <div className="flex-1 overflow-hidden p-8 md:p-12">
                  <Settings onClose={() => setIsSettingsOpen(false)} staffList={staff} />
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        <AIChatPanel 
          isOpen={isAIChatOpen} 
          setIsOpen={setIsAIChatOpen} 
          initialMessage={initialAIMessage}
          onClearInitialMessage={() => setInitialAIMessage('')}
        />
      </div>
    </ErrorBoundary>
  );
};

export default App;
