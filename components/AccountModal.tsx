
import React, { useState, useEffect } from 'react';
import { User, X, Trophy, Skull, Crosshair, Save } from 'lucide-react';
import { storageService } from '../services/storageService';
import { UserProfile } from '../types';

interface AccountModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNameUpdate: (name: string) => void;
}

export const AccountModal: React.FC<AccountModalProps> = ({ isOpen, onClose, onNameUpdate }) => {
  const [profile, setProfile] = useState<UserProfile>(storageService.getProfile());
  const [editName, setEditName] = useState('');

  useEffect(() => {
    if (isOpen) {
      const p = storageService.getProfile();
      setProfile(p);
      setEditName(p.name);
    }
  }, [isOpen]);

  const handleSave = () => {
    if (editName.trim()) {
      storageService.saveProfile({ name: editName.trim() });
      onNameUpdate(editName.trim());
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4"
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-md overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-black/50 p-4 border-b border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-2 text-gray-200">
             <User size={18} />
             <h2 className="font-mono font-bold text-lg tracking-widest">OPERATIVE PROFILE</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
            
            {/* Name Edit */}
            <div>
                <label className="block text-xs font-mono text-gray-500 mb-1 uppercase">Callsign</label>
                <div className="flex gap-2">
                    <input 
                        type="text" 
                        value={editName} 
                        onChange={(e) => setEditName(e.target.value)}
                        placeholder="ENTER NAME"
                        maxLength={12}
                        className="flex-1 bg-black border border-gray-700 text-white px-3 py-2 rounded font-mono focus:border-yellow-500 focus:outline-none"
                    />
                    <button 
                        onClick={handleSave}
                        disabled={!editName || editName === profile.name}
                        className="bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 disabled:cursor-not-allowed text-black px-3 rounded flex items-center"
                    >
                        <Save size={16} />
                    </button>
                </div>
            </div>

            {/* Stats Grid */}
            <div>
                <label className="block text-xs font-mono text-gray-500 mb-2 uppercase">Career Statistics</label>
                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-gray-800/50 p-3 rounded border border-gray-700 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-yellow-500">
                            <Trophy size={16} />
                            <span className="text-xs font-bold font-mono">WINS</span>
                        </div>
                        <span className="text-xl font-bold font-mono text-white">{profile.wins}</span>
                    </div>
                    <div className="bg-gray-800/50 p-3 rounded border border-gray-700 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-red-400">
                            <Crosshair size={16} />
                            <span className="text-xs font-bold font-mono">KILLS</span>
                        </div>
                        <span className="text-xl font-bold font-mono text-white">{profile.kills}</span>
                    </div>
                    <div className="bg-gray-800/50 p-3 rounded border border-gray-700 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-gray-400">
                            <Skull size={16} />
                            <span className="text-xs font-bold font-mono">DEATHS</span>
                        </div>
                        <span className="text-xl font-bold font-mono text-white">{profile.deaths}</span>
                    </div>
                    <div className="bg-gray-800/50 p-3 rounded border border-gray-700 flex items-center justify-between">
                        <div className="flex items-center gap-2 text-blue-400">
                            <User size={16} />
                            <span className="text-xs font-bold font-mono">MATCHES</span>
                        </div>
                        <span className="text-xl font-bold font-mono text-white">{profile.matchesPlayed}</span>
                    </div>
                </div>
            </div>

            <div className="text-center pt-2">
                <span className="text-[10px] text-gray-600 font-mono uppercase">ID: {Math.random().toString(36).substring(7).toUpperCase()} // SECTOR 7 ACCESS GRANTED</span>
            </div>
        </div>
      </div>
    </div>
  );
};
