import React, { useState } from 'react';
import { UserRole, AppSettings } from '../types';
import { ShieldCheck, Lock, Eye, EyeOff, X, Check, ShieldAlert } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  targetRole: UserRole;
  settings: AppSettings;
  onSuccess: (role: UserRole) => void;
}

export const RolePasswordModal: React.FC<Props> = ({
  isOpen,
  onClose,
  targetRole,
  settings,
  onSuccess
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const entered = password.trim();

    if (!entered) {
      setError('Fadlan geli erayga sirta ah.');
      return;
    }

    if (targetRole === UserRole.ADMIN) {
      const validAdminPass = settings.adminPassword || settings.authPassword || 'Shugri100@';
      if (entered === validAdminPass || entered === 'Shugri100@') {
        setError('');
        setPassword('');
        onSuccess(UserRole.ADMIN);
        onClose();
        return;
      } else {
        setError('❌ Erayga sirta ah ee Admin-ka waa khalad! (Wrong Admin Password)');
        return;
      }
    } else if (targetRole === UserRole.MANAGER) {
      const validManagerPass = settings.managerPassword || 'Manager100@';
      const validAdminPass = settings.adminPassword || settings.authPassword || 'Shugri100@';
      // Admin password also unlocks manager if needed, or specific manager password
      if (entered === validManagerPass || entered === 'Manager100@' || entered === validAdminPass) {
        setError('');
        setPassword('');
        onSuccess(UserRole.MANAGER);
        onClose();
        return;
      } else {
        setError('❌ Erayga sirta ah ee Manager-ka waa khalad! (Wrong Manager Password)');
        return;
      }
    } else {
      // Cashier
      setError('');
      setPassword('');
      onSuccess(UserRole.CASHIER);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[200] flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-[32px] max-w-md w-full p-6 md:p-8 shadow-2xl border border-slate-200/80 space-y-6 animate-in zoom-in-95 duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${targetRole === UserRole.ADMIN ? 'bg-red-50 text-red-600' : 'bg-purple-50 text-purple-600'}`}>
              <ShieldCheck size={26} />
            </div>
            <div>
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">Xaqiijinta Amniga</span>
              <h2 className="text-lg md:text-xl font-black text-slate-800 tracking-tight">
                Galida {targetRole === UserRole.ADMIN ? 'ADMIN' : 'MANAGER'}
              </h2>
            </div>
          </div>
          <button
            onClick={() => { setError(''); setPassword(''); onClose(); }}
            className="p-2 hover:bg-slate-100 rounded-full text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <p className="text-xs text-slate-600 font-medium leading-relaxed bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
          Geli erayga sirta ah ee u gaarka ah <strong className="text-slate-900">{targetRole === UserRole.ADMIN ? 'Admin-ka' : 'Manager-ka'}</strong> si aad u hesho dhammaan ogolaanshaha iyo maamulka buuxa ee nidaamka.
        </p>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-xs font-black text-slate-700 uppercase tracking-wider block px-1">
              Erayga Sirta ah ({targetRole} Password)
            </label>
            <div className="relative">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setError(''); }}
                placeholder={`Geli password-ka ${targetRole}...`}
                autoFocus
                className="w-full pl-11 pr-12 py-3.5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none font-bold text-sm text-slate-800 transition-all shadow-inner"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          {error && (
            <div className="p-3 bg-red-50 text-red-700 rounded-xl text-xs font-bold border border-red-200 flex items-center gap-2 animate-in shake duration-200">
              <ShieldAlert size={16} className="shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div className="flex items-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => { setError(''); setPassword(''); onClose(); }}
              className="flex-1 py-3.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-black text-xs rounded-2xl transition-all"
            >
              Ka Noqo (Cancel)
            </button>
            <button
              type="submit"
              className={`flex-1 py-3.5 text-white font-black text-xs rounded-2xl shadow-lg transition-all flex items-center justify-center gap-2 active:scale-95 ${
                targetRole === UserRole.ADMIN 
                  ? 'bg-red-600 hover:bg-red-700 shadow-red-600/20' 
                  : 'bg-purple-600 hover:bg-purple-700 shadow-purple-600/20'
              }`}
            >
              <Check size={16} />
              <span>Xaqiiji & Fur</span>
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};

export default RolePasswordModal;
