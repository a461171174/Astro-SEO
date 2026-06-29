import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ICONS } from '../constants';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { collection, onSnapshot, doc, setDoc, deleteDoc } from 'firebase/firestore';
import { MetafieldDefinition } from '../types';
import { cleanObject } from '../utils';

const DEFAULT_FIELDS: MetafieldDefinition[] = [
  { id: '1', name: '材质说明', type: '文本', key: 'material', target: '商品' },
  { id: '2', name: '保养指南', type: '富文本', key: 'care_guide', target: '商品' },
  { id: '3', name: '产地', type: '选择器', key: 'origin', target: '商品' },
  { id: '4', name: '会员等级', type: '选择器', key: 'membership_level', target: '客户' },
];

const MetafieldManager: React.FC = () => {
  const [fields, setFields] = useState<MetafieldDefinition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingField, setEditingField] = useState<MetafieldDefinition | null>(null);
  const [formData, setFormData] = useState<Partial<MetafieldDefinition>>({
    name: '',
    key: '',
    type: '文本',
    target: '商品',
    description: ''
  });

  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'metafieldDefinitions'), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MetafieldDefinition));
      setFields(data);
      setIsLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.LIST, 'metafieldDefinitions'));
    return () => unsub();
  }, []);

  const handleSave = async () => {
    if (!formData.name || !formData.key || isSaving) return;
    
    setIsSaving(true);
    const id = editingField?.id || Date.now().toString();
    const payload = cleanObject({
      ...formData,
      id,
      updatedAt: new Date().toISOString(),
      ...(editingField ? {} : { createdAt: new Date().toISOString() })
    });

    try {
      await setDoc(doc(db, 'metafieldDefinitions', id), payload);
      setIsModalOpen(false);
      setEditingField(null);
      setFormData({ name: '', key: '', type: '文本', target: '商品', description: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `metafieldDefinitions/${id}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('确定要删除这个扩展字段吗？')) return;
    try {
      await deleteDoc(doc(db, 'metafieldDefinitions', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `metafieldDefinitions/${id}`);
    }
  };

  const openModal = (field?: MetafieldDefinition) => {
    if (field) {
      setEditingField(field);
      setFormData(field);
    } else {
      setEditingField(null);
      setFormData({ name: '', key: '', type: '文本', target: '商品', description: '' });
    }
    setIsModalOpen(true);
  };

  if (isLoading) {
    return <div className="flex items-center justify-center h-64"><div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-900">扩展字段</h1>
        <button 
          onClick={() => openModal()}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors"
        >
          <ICONS.Plus className="w-4 h-4" /> 添加字段
        </button>
      </div>
      <div className="space-y-8">
        {['商品', '客户'].map(targetType => {
          const targetFields = fields.filter(f => f.target === targetType);
          
          return (
            <div key={targetType} className="space-y-3">
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                {targetType === '商品' ? <ICONS.Store className="w-5 h-5 text-blue-500" /> : <ICONS.Customer className="w-5 h-5 text-purple-500" />}
                {targetType}扩展字段
                <span className="text-sm font-normal text-slate-500 bg-slate-100 px-2 py-0.5 rounded-full">{targetFields.length}</span>
              </h2>
              
              {targetFields.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {targetFields.map(field => (
                    <div key={field.id} className="p-4 border border-slate-200 rounded-xl flex items-center justify-between bg-white hover:border-blue-500 transition-all group shadow-sm hover:shadow-md">
                      <div className="flex items-center gap-4">
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center transition-colors ${field.target === '商品' ? 'bg-blue-50 text-blue-500 group-hover:bg-blue-100' : 'bg-purple-50 text-purple-500 group-hover:bg-purple-100'}`}>
                          <ICONS.Apps className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{field.name}</div>
                          <div className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                            <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{field.key}</span>
                            <span>•</span>
                            <span>{field.type}</span>
                          </div>
                          {field.description && (
                            <div className="text-xs text-slate-400 mt-1 line-clamp-1">{field.description}</div>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => openModal(field)} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"><ICONS.Edit className="w-4 h-4" /></button>
                        <button onClick={() => handleDelete(field.id)} className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"><ICONS.Trash className="w-4 h-4" /></button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-slate-500 bg-slate-50/50 rounded-xl border border-slate-200 border-dashed">
                  暂无{targetType}扩展字段
                </div>
              )}
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm"
              onClick={() => setIsModalOpen(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
            >
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                <h3 className="text-lg font-bold text-slate-900">{editingField ? '编辑扩展字段' : '添加扩展字段'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><ICONS.X className="w-5 h-5" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">字段名称</label>
                  <input 
                    type="text" 
                    value={formData.name || ''}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="例如：材质说明"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">字段 Key</label>
                  <input 
                    type="text" 
                    value={formData.key || ''}
                    onChange={e => setFormData({...formData, key: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20 font-mono text-sm"
                    placeholder="例如：material"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">目标对象</label>
                  <select 
                    value={formData.target || '商品'}
                    onChange={e => setFormData({...formData, target: e.target.value as '商品' | '客户'})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="商品">商品</option>
                    <option value="客户">客户</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">字段类型</label>
                  <select 
                    value={formData.type || '文本'}
                    onChange={e => setFormData({...formData, type: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20"
                  >
                    <option value="文本">文本 (Text)</option>
                    <option value="富文本">富文本 (Rich Text)</option>
                    <option value="数字">数字 (Number)</option>
                    <option value="布尔值">布尔值 (Boolean)</option>
                    <option value="选择器">选择器 (Select)</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700">描述 (可选)</label>
                  <input 
                    type="text" 
                    value={formData.description || ''}
                    onChange={e => setFormData({...formData, description: e.target.value})}
                    className="w-full px-4 py-2 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500/20"
                    placeholder="字段的用途说明"
                  />
                </div>
              </div>
              <div className="p-6 border-t border-slate-100 flex justify-end gap-3 bg-slate-50">
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-slate-600 font-bold hover:bg-slate-200 rounded-xl transition-colors"
                >
                  取消
                </button>
                <button 
                  onClick={handleSave}
                  disabled={!formData.name || !formData.key || isSaving}
                  className="px-6 py-2 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {isSaving ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                      保存中...
                    </>
                  ) : '保存'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MetafieldManager;
