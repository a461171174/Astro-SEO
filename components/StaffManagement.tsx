
import React, { useState } from 'react';
import { ICONS } from '../constants';
import { Staff } from '../types';
import { db, handleFirestoreError, OperationType } from '../firebase';
import { cleanObject } from '../utils';
import { doc, setDoc, deleteDoc } from 'firebase/firestore';

interface StaffManagementProps {
  staffList: Staff[];
}

const ALL_PERMISSIONS = [
  { label: '主页' },
  { label: '商品', children: ['商品管理', '系列'] },
  { label: '客户', children: ['客户', '细分'] },
  { label: '询盘' },
  { label: '内容', children: ['博客', '素材库', '扩展字段', '菜单'] },
  { label: '店铺设计', children: ['在线店铺', '自定义页面'] },
  { label: '营销', children: ['邮件营销', '社媒营销'] },
  { label: '推广渠道', children: ['Facebook & Instagram', 'Google & YouTube', 'Tiktok', 'Pinterest'] },
  { label: '分析' }
];

const StaffManagement: React.FC<StaffManagementProps> = ({ staffList }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingStaff, setEditingStaff] = useState<Staff | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    role: 'staff' as 'admin' | 'staff',
    permissions: [] as string[]
  });

  const handleOpenModal = (staff?: Staff) => {
    if (staff) {
      setEditingStaff(staff);
      setFormData({
        name: staff.name,
        email: staff.email,
        role: staff.role,
        permissions: staff.permissions
      });
    } else {
      setEditingStaff(null);
      setFormData({
        name: '',
        email: '',
        role: 'staff',
        permissions: []
      });
    }
    setIsModalOpen(true);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.email) {
      alert('请填写姓名和邮箱');
      return;
    }

    try {
      const id = editingStaff?.id || Date.now().toString();
      const staffData: Staff = {
        id,
        ...formData,
        createdAt: editingStaff?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await setDoc(doc(db, 'staff', id), cleanObject(staffData));
      setIsModalOpen(false);
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'staff');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('确定要删除该员工吗？')) return;
    try {
      await deleteDoc(doc(db, 'staff', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `staff/${id}`);
    }
  };

  const togglePermission = (perm: string) => {
    setFormData(prev => ({
      ...prev,
      permissions: prev.permissions.includes(perm)
        ? prev.permissions.filter(p => p !== perm)
        : [...prev.permissions, perm]
    }));
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center mb-4">
        <h3 className="text-lg font-bold">员工账号</h3>
        <button 
          onClick={() => handleOpenModal()}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
        >
          <ICONS.Plus className="w-4 h-4" /> 添加员工
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <table className="w-full text-left">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">姓名</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">邮箱</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">角色</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">权限</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {staffList.map(staff => (
              <tr key={staff.id} className="hover:bg-slate-50 transition-colors group">
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-900" title={staff.name}>{staff.name}</div>
                </td>
                <td className="px-6 py-4 text-sm text-slate-500" title={staff.email}>{staff.email}</td>
                <td className="px-6 py-4">
                  <span className={`px-2 py-1 rounded-full text-[10px] font-bold ${
                    staff.role === 'admin' ? 'bg-purple-100 text-purple-600' : 'bg-blue-100 text-blue-600'
                  }`}>
                    {staff.role === 'admin' ? '管理员' : '员工'}
                  </span>
                </td>
                <td className="px-6 py-4">
                  <div className="flex flex-wrap gap-1">
                    {staff.role === 'admin' ? (
                      <span className="text-xs text-slate-400 italic">全部权限</span>
                    ) : (
                      staff.permissions.map(p => (
                        <span key={p} className="px-2 py-0.5 bg-slate-100 text-slate-600 rounded text-[10px]">
                          {p}
                        </span>
                      ))
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button 
                      onClick={() => handleOpenModal(staff)}
                      className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all"
                    >
                      <ICONS.Settings className="w-4 h-4" />
                    </button>
                    <button 
                      onClick={() => handleDelete(staff.id)}
                      className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                    >
                      <ICONS.Trash className="w-4 h-4" />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {staffList.length === 0 && (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-400 italic">
                  暂无员工数据
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center">
              <h3 className="text-lg font-bold text-slate-900">{editingStaff ? '编辑员工' : '添加员工'}</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <ICONS.Plus className="w-6 h-6 rotate-45" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">姓名</label>
                <input 
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="员工姓名"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">邮箱</label>
                <input 
                  type="email"
                  value={formData.email}
                  onChange={e => setFormData({...formData, email: e.target.value})}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                  placeholder="员工邮箱"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase">角色</label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="role" 
                      checked={formData.role === 'staff'} 
                      onChange={() => setFormData({...formData, role: 'staff'})}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">普通员工</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input 
                      type="radio" 
                      name="role" 
                      checked={formData.role === 'admin'} 
                      onChange={() => setFormData({...formData, role: 'admin'})}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm text-slate-700">管理员</span>
                  </label>
                </div>
              </div>

              {formData.role === 'staff' && (
                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                  <label className="text-xs font-bold text-slate-500 uppercase sticky top-0 bg-white py-1 z-10">菜单权限</label>
                  <div className="space-y-4">
                    {ALL_PERMISSIONS.map(parent => (
                      <div key={parent.label} className="space-y-2">
                        <label className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-100 hover:bg-slate-100 cursor-pointer transition-colors font-medium">
                          <input 
                            type="checkbox"
                            checked={formData.permissions.includes(parent.label)}
                            onChange={() => {
                              const newPerms = formData.permissions.includes(parent.label)
                                ? formData.permissions.filter(p => p !== parent.label && !(parent.children?.includes(p)))
                                : [...formData.permissions, parent.label, ...(parent.children || [])];
                              setFormData({ ...formData, permissions: Array.from(new Set(newPerms)) });
                            }}
                            className="rounded text-blue-600 focus:ring-blue-500"
                          />
                          <span className="text-sm text-slate-700">{parent.label}</span>
                        </label>
                        
                        {parent.children && (
                          <div className="grid grid-cols-2 gap-2 pl-6">
                            {parent.children.map(child => (
                              <label key={child} className="flex items-center gap-2 p-2 rounded-lg border border-slate-50 hover:bg-slate-50 cursor-pointer transition-colors">
                                <input 
                                  type="checkbox"
                                  checked={formData.permissions.includes(child)}
                                  onChange={() => {
                                    let newPerms = formData.permissions.includes(child)
                                      ? formData.permissions.filter(p => p !== child)
                                      : [...formData.permissions, child];
                                    
                                    // If any child is selected, ensure parent is selected
                                    if (!formData.permissions.includes(child) && !newPerms.includes(parent.label)) {
                                      newPerms.push(parent.label);
                                    }
                                    // If all children of a parent are deselected, maybe keep parent? 
                                    // Usually if a child is selected, parent must be visible.
                                    
                                    setFormData({ ...formData, permissions: Array.from(new Set(newPerms)) });
                                  }}
                                  className="rounded text-blue-600 focus:ring-blue-500"
                                />
                                <span className="text-xs text-slate-600">{child}</span>
                              </label>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3">
              <button 
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 text-sm font-bold text-slate-500 hover:text-slate-700 transition-colors"
              >
                取消
              </button>
              <button 
                onClick={handleSave}
                className="px-6 py-2 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 transition-colors shadow-lg shadow-blue-200"
              >
                保存
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffManagement;
