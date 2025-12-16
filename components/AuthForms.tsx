
import React, { useState } from 'react';
import { storageService } from '../services/storageService';
import { Lock, User, Key, ShieldCheck, LogIn, UserPlus } from 'lucide-react';

interface AuthFormsProps {
  onLoginSuccess: () => void;
}

export const AuthForms: React.FC<AuthFormsProps> = ({ onLoginSuccess }) => {
  const [view, setView] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [secondPassword, setSecondPassword] = useState('');
  const [error, setError] = useState('');

  const handleRegister = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    
    const res = storageService.register(username, password, secondPassword);
    if (res.success) {
      setView('LOGIN');
      setPassword('');
      setSecondPassword('');
      setError('Account created. Please log in.');
    } else {
      setError(res.error || 'Registration failed');
    }
  };

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const res = storageService.login(username, password);
    if (res.success) {
      onLoginSuccess();
    } else {
      setError(res.error || 'Login failed');
    }
  };

  return (
    <div className="w-full space-y-6 animate-fade-in">
      {/* TABS */}
      <div className="flex border-b border-gray-700 mb-4">
        <button 
          onClick={() => { setView('LOGIN'); setError(''); }}
          className={`flex-1 py-2 font-mono text-sm tracking-widest transition-colors ${view === 'LOGIN' ? 'text-yellow-500 border-b-2 border-yellow-500' : 'text-gray-500 hover:text-gray-300'}`}
        >
          LOGIN
        </button>
        <button 
          onClick={() => { setView('REGISTER'); setError(''); }}
          className={`flex-1 py-2 font-mono text-sm tracking-widest transition-colors ${view === 'REGISTER' ? 'text-yellow-500 border-b-2 border-yellow-500' : 'text-gray-500 hover:text-gray-300'}`}
        >
          CREATE ACCOUNT
        </button>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-900/50 text-red-400 text-xs p-3 text-center font-mono">
          {error}
        </div>
      )}

      {view === 'LOGIN' && (
        <form onSubmit={handleLogin} className="space-y-4">
          <div className="space-y-1">
             <label className="text-[10px] font-mono text-gray-500 uppercase flex items-center gap-1">
               <User size={10} /> Username
             </label>
             <input 
               type="text" 
               value={username}
               onChange={(e) => setUsername(e.target.value)}
               className="w-full bg-black/50 border border-gray-700 text-white px-3 py-2 rounded focus:border-yellow-600 focus:outline-none font-mono"
               placeholder="OPERATIVE ID"
             />
          </div>
          <div className="space-y-1">
             <label className="text-[10px] font-mono text-gray-500 uppercase flex items-center gap-1">
               <Key size={10} /> Password
             </label>
             <input 
               type="password" 
               value={password}
               onChange={(e) => setPassword(e.target.value)}
               className="w-full bg-black/50 border border-gray-700 text-white px-3 py-2 rounded focus:border-yellow-600 focus:outline-none font-mono"
               placeholder="ACCESS CODE"
             />
          </div>
          <button 
            type="submit"
            className="w-full bg-yellow-600 hover:bg-yellow-700 text-black font-bold py-3 rounded mt-4 flex items-center justify-center gap-2 shadow-lg shadow-yellow-900/20"
          >
            <LogIn size={16} />
            <span>AUTHENTICATE</span>
          </button>
        </form>
      )}

      {view === 'REGISTER' && (
        <form onSubmit={handleRegister} className="space-y-4">
          <div className="space-y-1">
             <label className="text-[10px] font-mono text-gray-500 uppercase flex items-center gap-1">
               <User size={10} /> Username
             </label>
             <input 
               type="text" 
               value={username}
               onChange={(e) => setUsername(e.target.value)}
               className="w-full bg-black/50 border border-gray-700 text-white px-3 py-2 rounded focus:border-yellow-600 focus:outline-none font-mono"
               placeholder="NEW ID"
               required
             />
          </div>
          <div className="space-y-1">
             <label className="text-[10px] font-mono text-gray-500 uppercase flex items-center gap-1">
               <Key size={10} /> Main Password
             </label>
             <input 
               type="password" 
               value={password}
               onChange={(e) => setPassword(e.target.value)}
               className="w-full bg-black/50 border border-gray-700 text-white px-3 py-2 rounded focus:border-yellow-600 focus:outline-none font-mono"
               placeholder="PRIMARY CODE"
               required
             />
          </div>
          <div className="space-y-1">
             <label className="text-[10px] font-mono text-gray-500 uppercase flex items-center gap-1">
               <ShieldCheck size={10} /> Second Password
             </label>
             <input 
               type="password" 
               value={secondPassword}
               onChange={(e) => setSecondPassword(e.target.value)}
               className="w-full bg-black/50 border border-gray-700 text-white px-3 py-2 rounded focus:border-yellow-600 focus:outline-none font-mono"
               placeholder="SECURITY CONFIRMATION"
               required
             />
             <p className="text-[9px] text-gray-600">Used once for verification. Never requested again.</p>
          </div>
          <button 
            type="submit"
            className="w-full bg-gray-800 hover:bg-gray-700 text-gray-200 font-bold py-3 rounded mt-4 flex items-center justify-center gap-2 border border-gray-600"
          >
            <UserPlus size={16} />
            <span>REGISTER OPERATIVE</span>
          </button>
        </form>
      )}
    </div>
  );
};
