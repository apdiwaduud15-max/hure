
import React, { useState } from 'react';
import { AppData, UserRole, UserProfile } from '../types';
import { ShieldCheck, UserPlus, Trash2, Edit2, ShieldAlert, Check, UserCheck, KeyRound } from 'lucide-react';
import { generateId } from '../lib/utils';
import ConfirmModal from './ConfirmModal';
import RolePasswordModal from './RolePasswordModal';

interface Props {
  data: AppData;
  setData: React.Dispatch<React.SetStateAction<AppData>>;
  addLog: (action: string, details: string) => void;
}

const Roles: React.FC<Props> = ({ data, setData, addLog }) => {
  const [showModal, setShowModal] = useState(false);
  const [editingUserId, setEditingUserId] = useState<string | null>(null);
  const [deleteConfirmUser, setDeleteConfirmUser] = useState<{ id: string; name: string; role: UserRole } | null>(null);
  const [formData, setFormData] = useState({ name: '', role: UserRole.CASHIER });
  const [pendingRoleSwitch, setPendingRoleSwitch] = useState<UserRole | null>(null);

  const currentRole = data.settings.currentUser.role;

  const handleOpenAddModal = () => {
    setEditingUserId(null);
    setFormData({ name: '', role: UserRole.CASHIER });
    setShowModal(true);
  };

  const handleOpenEditModal = (user: UserProfile) => {
    setEditingUserId(user.id);
    setFormData({ name: user.name, role: user.role });
    setShowModal(true);
  };

  const saveUser = () => {
    if (!formData.name.trim()) return;
    
    if (editingUserId) {
      // Edit existing user
      setData(prev => ({
        ...prev,
        users: prev.users.map(u => u.id === editingUserId ? { ...u, name: formData.name, role: formData.role } : u),
        settings: prev.settings.currentUser.name === formData.name 
          ? { ...prev.settings, currentUser: { ...prev.settings.currentUser, role: formData.role } }
          : prev.settings
      }));
      addLog('User Updated', `Updated user ${formData.name} role to ${formData.role}`);
    } else {
      // Create new user
      const newUser: UserProfile = {
        id: generateId(),
        name: formData.name,
        role: formData.role,
        isActive: true
      };
      setData(prev => ({ ...prev, users: [...prev.users, newUser] }));
      addLog('User Created', `New system user added: ${formData.name} as ${formData.role}`);
    }

    setShowModal(false);
    setFormData({ name: '', role: UserRole.CASHIER });
    setEditingUserId(null);
  };

  const deleteUser = (id: string, name: string, role: UserRole) => {
    if (role === UserRole.ADMIN && data.users.filter(u => u.role === UserRole.ADMIN).length <= 1) {
      return alert("Ugu yaraan 1 Admin waa inuu ku jiraa nidaamka! (At least one Admin required).");
    }
    setDeleteConfirmUser({ id, name, role });
  };

  const applyRoleSwitch = (newRole: UserRole) => {
    setData(prev => ({
      ...prev,
      settings: {
        ...prev.settings,
        currentUser: {
          ...prev.settings.currentUser,
          role: newRole
        }
      }
    }));
    addLog('Role Switch', `Switched active role to: ${newRole}`);
  };

  const switchCurrentActiveRole = (newRole: UserRole) => {
    if (newRole === currentRole) return;
    if (newRole === UserRole.ADMIN || newRole === UserRole.MANAGER) {
      setPendingRoleSwitch(newRole);
    } else {
      applyRoleSwitch(UserRole.CASHIER);
    }
  };

  const changeUserRoleDirectly = (userId: string, newRole: UserRole) => {
    setData(prev => ({
      ...prev,
      users: prev.users.map(u => u.id === userId ? { ...u, role: newRole } : u)
    }));
    addLog('User Role Changed', `User ID ${userId} role changed to ${newRole}`);
  };

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8 no-print">
      
      {/* Header & Quick Active Role Switcher */}
      <div className="bg-white p-6 md:p-8 rounded-[32px] border shadow-sm space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-black text-slate-800 tracking-tight flex items-center gap-3">
              <ShieldCheck className="text-blue-600" size={32} /> Maamulka Ogolaanshaha & Rule-yada (Access Control)
            </h1>
            <p className="text-xs md:text-sm text-slate-500 font-medium mt-1">
              Halkan ka beddel role-ka isticmaalaha (Admin vs Cashier vs Manager) oo habayso ogolaanshaha shaqaalaha.
            </p>
          </div>

          <button onClick={handleOpenAddModal} className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3.5 rounded-2xl font-black flex items-center justify-center gap-2 shadow-lg transition-all active:scale-95 text-sm">
            <UserPlus size={18} /> Ku Dar Isticmaale Cusub
          </button>
        </div>

        {/* Active Role Quick Switch Box */}
        <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 p-6 rounded-2xl text-white flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-2xl bg-white/10 flex items-center justify-center text-amber-400">
              <UserCheck size={28} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Habka Hada Isticmaalku U Furan Yahay (Current Active Session)</span>
              <h3 className="text-xl font-black flex items-center gap-2 text-white">
                {data.settings.currentUser.name} 
                <span className={`px-3 py-0.5 rounded-full text-xs font-black uppercase ${currentRole === UserRole.ADMIN ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'}`}>
                  {currentRole}
                </span>
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-2 w-full md:w-auto bg-white/10 p-1.5 rounded-2xl border border-white/10">
            <span className="text-xs font-black px-3 text-slate-300 uppercase">Beddel Role-ka:</span>
            <button
              onClick={() => switchCurrentActiveRole(UserRole.ADMIN)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${currentRole === UserRole.ADMIN ? 'bg-red-600 text-white shadow-lg' : 'text-slate-300 hover:text-white hover:bg-white/10'}`}
            >
              ADMIN
            </button>
            <button
              onClick={() => switchCurrentActiveRole(UserRole.CASHIER)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${currentRole === UserRole.CASHIER ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-300 hover:text-white hover:bg-white/10'}`}
            >
              CASHIER
            </button>
            <button
              onClick={() => switchCurrentActiveRole(UserRole.MANAGER)}
              className={`px-4 py-2 rounded-xl text-xs font-black transition-all ${currentRole === UserRole.MANAGER ? 'bg-purple-600 text-white shadow-lg' : 'text-slate-300 hover:text-white hover:bg-white/10'}`}
            >
              MANAGER
            </button>
          </div>
        </div>
      </div>

      {/* User Cards Grid with Direct Role Dropdown Switch */}
      <div className="space-y-4">
        <h2 className="text-lg font-black text-slate-800 uppercase tracking-wider flex items-center gap-2">
          <KeyRound size={20} className="text-blue-600" /> Isticmaalayaasha Diiwaangashan & Role-yada
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {data.users.map(user => (
            <div key={user.id} className="bg-white p-6 rounded-3xl border shadow-sm space-y-4 hover:shadow-md transition-all relative">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center font-black ${user.role === UserRole.ADMIN ? 'bg-red-50 text-red-600' : user.role === UserRole.CASHIER ? 'bg-emerald-50 text-emerald-600' : 'bg-purple-50 text-purple-600'}`}>
                    <ShieldCheck size={26} />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 text-base">{user.name}</h3>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">ID: {user.id.slice(-6)}</p>
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button 
                    onClick={() => handleOpenEditModal(user)}
                    className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition-all"
                    title="Wax ka beddel Isticmaalaha"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button 
                    onClick={() => deleteUser(user.id, user.name, user.role)} 
                    className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                    title="Tirtir Isticmaalaha"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>

              {/* Direct Role Modifier Dropdown */}
              <div className="bg-slate-50 p-3.5 rounded-2xl border flex items-center justify-between gap-3">
                <span className="text-xs font-black text-slate-500 uppercase">Role-ka Isticmaalaha:</span>
                <select
                  value={user.role}
                  onChange={(e) => changeUserRoleDirectly(user.id, e.target.value as UserRole)}
                  className="bg-white font-black text-xs text-slate-800 px-3 py-1.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 outline-none cursor-pointer"
                >
                  <option value={UserRole.ADMIN}>ADMIN (Full Access)</option>
                  <option value={UserRole.CASHIER}>CASHIER (Sales & POS Only)</option>
                  <option value={UserRole.MANAGER}>MANAGER (Staff & Operations)</option>
                </select>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Role Access Matrix Guide */}
      <div className="bg-white p-6 md:p-8 rounded-[32px] border shadow-sm space-y-4">
        <h3 className="text-base font-black text-slate-800 uppercase tracking-wider">
          Shaxda Ogolaanshaha Rule-yada (Permissions Matrix)
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-semibold">
            <thead>
              <tr className="border-b bg-slate-50 text-slate-500 font-black uppercase text-[10px] tracking-wider">
                <th className="p-3">Qaybta (Feature/Tab)</th>
                <th className="p-3 text-center">ADMIN</th>
                <th className="p-3 text-center">CASHIER</th>
                <th className="p-3 text-center">MANAGER</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              <tr>
                <td className="p-3 font-bold">POS, Purchases, Khudaar, Ice Cream, Invoices</td>
                <td className="p-3 text-center text-emerald-600 font-bold"><Check size={16} className="mx-auto" /></td>
                <td className="p-3 text-center text-emerald-600 font-bold"><Check size={16} className="mx-auto" /> (POS & Invoices)</td>
                <td className="p-3 text-center text-emerald-600 font-bold"><Check size={16} className="mx-auto" /></td>
              </tr>
              <tr>
                <td className="p-3 font-bold">Debtors Hub, Suppliers, Stock Adjustments</td>
                <td className="p-3 text-center text-emerald-600 font-bold"><Check size={16} className="mx-auto" /></td>
                <td className="p-3 text-center text-rose-400 font-bold">—</td>
                <td className="p-3 text-center text-emerald-600 font-bold"><Check size={16} className="mx-auto" /></td>
              </tr>
              <tr>
                <td className="p-3 font-bold">Dashboard, Products, Xisaabin, Reports</td>
                <td className="p-3 text-center text-rose-400 font-bold">— (Xidhan)</td>
                <td className="p-3 text-center text-rose-400 font-bold">—</td>
                <td className="p-3 text-center text-emerald-600 font-bold"><Check size={16} className="mx-auto" /></td>
              </tr>
              <tr>
                <td className="p-3 font-bold">Finances, Accounting, Daily Closing, Audits</td>
                <td className="p-3 text-center text-rose-400 font-bold">— (Xidhan)</td>
                <td className="p-3 text-center text-rose-400 font-bold">—</td>
                <td className="p-3 text-center text-emerald-600 font-bold"><Check size={16} className="mx-auto" /></td>
              </tr>
              <tr>
                <td className="p-3 font-bold">Nidaamka Guud & Kaydka (Settings & Backups)</td>
                <td className="p-3 text-center text-emerald-600 font-bold"><Check size={16} className="mx-auto" /> (Furan)</td>
                <td className="p-3 text-center text-rose-400 font-bold">—</td>
                <td className="p-3 text-center text-emerald-600 font-bold"><Check size={16} className="mx-auto" /> (Furan)</td>
              </tr>
              <tr>
                <td className="p-3 font-bold">AI Insights & Caawiyaha Caqliga (Gemini 24/7 AI)</td>
                <td className="p-3 text-center text-rose-500 font-bold">— (Xidhan)</td>
                <td className="p-3 text-center text-rose-500 font-bold">— (Xidhan)</td>
                <td className="p-3 text-center text-emerald-600 font-bold"><Check size={16} className="mx-auto" /> (Furan)</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal for Adding/Editing User */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm no-print">
          <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-md p-8 space-y-6 animate-in zoom-in duration-300">
            <h3 className="text-2xl font-black text-slate-800">
              {editingUserId ? 'Wax Ka Beddel Isticmaalaha' : 'Ku Dar Isticmaale Cusub'}
            </h3>
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Magaca Isticmaalaha (Display Name)</label>
                <input 
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-800 focus:ring-2 focus:ring-blue-500" 
                  value={formData.name} 
                  onChange={e => setFormData({...formData, name: e.target.value})} 
                  placeholder="e.g. Axmed Cashier" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest px-1">Role-ka Shaqada (Access Role)</label>
                <select 
                  className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl outline-none font-bold text-slate-800 focus:ring-2 focus:ring-blue-500" 
                  value={formData.role} 
                  onChange={e => setFormData({...formData, role: e.target.value as UserRole})}
                >
                  <option value={UserRole.ADMIN}>ADMIN (Full Access)</option>
                  <option value={UserRole.CASHIER}>CASHIER (Sales & POS Only)</option>
                  <option value={UserRole.MANAGER}>MANAGER (Staff & Operations)</option>
                </select>
              </div>
            </div>
            <div className="flex gap-3 pt-4">
              <button onClick={() => setShowModal(false)} className="flex-1 font-bold text-slate-400 py-3">Kansal</button>
              <button onClick={saveUser} className="flex-1 py-4 bg-blue-600 hover:bg-blue-700 text-white rounded-2xl font-black shadow-lg">Save User</button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-amber-50 p-6 md:p-8 rounded-[32px] border border-amber-200 flex items-start gap-4 shadow-sm">
        <div className="w-10 h-10 bg-amber-100 text-amber-600 rounded-2xl flex-shrink-0 flex items-center justify-center">
          <ShieldAlert size={22} />
        </div>
        <div className="space-y-1 text-xs font-medium text-amber-800">
          <h4 className="font-black uppercase text-sm tracking-tight text-amber-900">Ogeysiis Amniga Rule-yada</h4>
          <p className="leading-relaxed">
            Rule-yada Cashier iyo Admin waa lagu beddeli karaa halkan iyo sidoo kale baarka sare ee header-ka. Qofka Cashier-ka ah laguma tusayo xogta xisaabaadka ama tirtirista alaabta si loogu ilaaliyo ammaan xogta dukaanka.
          </p>
        </div>
      </div>

      <ConfirmModal
        isOpen={!!deleteConfirmUser}
        title="Ma hubtaa? (Are you sure?)"
        message={`Ma hubtaa inaad tirtirto akoonka isticmaalaha: "${deleteConfirmUser?.name}" (${deleteConfirmUser?.role})?`}
        confirmText="Haa (Tirtir)"
        cancelText="Maya (Kansal)"
        onConfirm={() => {
          if (deleteConfirmUser) {
            setData(prev => ({
              ...prev,
              users: prev.users.filter(u => u.id !== deleteConfirmUser.id),
              deletedIds: { ...(prev.deletedIds || {}), [deleteConfirmUser.id]: Date.now() },
              lastModified: Date.now()
            }));
            addLog('User Deleted', `Removed access for: ${deleteConfirmUser.name} (${deleteConfirmUser.role})`);
            setDeleteConfirmUser(null);
          }
        }}
        onClose={() => setDeleteConfirmUser(null)}
      />

      <RolePasswordModal
        isOpen={!!pendingRoleSwitch}
        targetRole={pendingRoleSwitch || UserRole.ADMIN}
        settings={data.settings}
        onClose={() => setPendingRoleSwitch(null)}
        onSuccess={(role) => applyRoleSwitch(role)}
      />
    </div>
  );
};

export default Roles;

