
import React from 'react';
import { X, Heart, Utensils, Zap, Sword, Shield, Wind, Crosshair, AlertTriangle, Ghost, Flame, Biohazard } from 'lucide-react';

interface HowToPlayModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const HowToPlayModal: React.FC<HowToPlayModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  const sections = [
    {
      title: "Core Mechanics",
      items: [
        { icon: <Heart size={16} className="text-red-500" />, label: "HP", desc: "Your vitality. Reaching 0 means elimination." },
        { icon: <Utensils size={16} className="text-orange-500" />, label: "Hunger", desc: "Required for actions. Restored by EATING." },
        { icon: <Zap size={16} className="text-blue-500" />, label: "Fatigue", desc: "Energy levels. Restored by RESTING." },
      ]
    },
    {
      title: "Tactical Actions",
      items: [
        { icon: <Sword size={16} className="text-red-400" />, label: "Attack", desc: "Damage an opponent. Costs Hunger & Fatigue." },
        { icon: <Shield size={16} className="text-blue-400" />, label: "Defend", desc: "Reduces incoming damage. Essential for survival." },
        { icon: <Wind size={16} className="text-cyan-400" />, label: "Explore", desc: "Dodge attacks and find items. Has a 1-day cooldown." },
        { icon: <Crosshair size={16} className="text-yellow-400" />, label: "Shoot", desc: "High damage from a Pistol. Limited availability." },
      ]
    },
    {
      title: "World Hazards",
      items: [
        { icon: <Flame size={16} className="text-red-500" />, label: "Volcano", desc: "Erupts randomly. Only EXPLORE saves you from 80 DMG." },
        { icon: <Biohazard size={16} className="text-green-500" />, label: "Acid Storm", desc: "Lethal gas. Only DEFEND protects your lungs." },
        { icon: <AlertTriangle size={16} className="text-red-600" />, label: "Zone Shrink", desc: "The perimeter closes on Day 20/30/45. You must RUN." },
        { icon: <Ghost size={16} className="text-purple-500" />, label: "Monster Hunt", desc: "Beasts roam the night. Only DEFEND keeps you hidden." },
      ]
    }
  ];

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl h-[85vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-black/50">
           <h2 className="text-lg font-bold font-mono text-white tracking-widest uppercase">Field Manual // Protocols</h2>
           <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
              <X size={20} />
           </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar">
           <div className="bg-red-900/10 border border-red-900/30 p-4 rounded-lg text-center">
              <p className="text-red-400 font-mono text-xs uppercase tracking-widest mb-1">Mission Objective</p>
              <h3 className="text-white font-bold text-lg mb-2">BE THE LAST OPERATIVE STANDING</h3>
              <p className="text-gray-400 text-sm font-mono leading-relaxed">
                Strategic resource management is just as important as combat. Watch the activity logs and monitor your vitals.
              </p>
           </div>

           {sections.map((section, idx) => (
             <div key={idx} className="space-y-4">
                <h4 className="text-yellow-500 font-mono text-xs uppercase tracking-[0.2em] border-b border-gray-800 pb-1">{section.title}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                   {section.items.map((item, i) => (
                     <div key={i} className="flex items-start gap-3 bg-black/30 p-3 rounded border border-gray-800">
                        <div className="p-1.5 bg-gray-800 rounded">{item.icon}</div>
                        <div>
                           <p className="text-white font-bold text-xs uppercase font-mono">{item.label}</p>
                           <p className="text-gray-400 text-[11px] leading-relaxed mt-0.5">{item.desc}</p>
                        </div>
                     </div>
                   ))}
                </div>
             </div>
           ))}

           <div className="bg-blue-900/10 border border-blue-900/30 p-4 rounded-lg">
              <h4 className="text-blue-400 font-mono text-xs uppercase mb-2">Pro Tips</h4>
              <ul className="text-[11px] text-gray-400 space-y-2 list-disc pl-4 font-mono">
                 <li>Day 50+ enters Lockdown: EAT and REST are disabled. Survival is final.</li>
                 <li>Check your BAG for looted items like Bandages or Alcohol.</li>
                 <li>Warnings appear 24 hours before a major disaster hits.</li>
                 <li>Whisper to other players to form temporary alliances. Trust is a risk.</li>
              </ul>
           </div>
        </div>

        <div className="bg-black/50 p-3 text-center border-t border-gray-800">
           <p className="text-[9px] text-gray-600 font-mono tracking-[0.3em] uppercase">END OF TRANSMISSION</p>
        </div>
      </div>
    </div>
  );
};
