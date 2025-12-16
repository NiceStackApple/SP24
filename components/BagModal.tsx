import React, { useState, useEffect } from 'react';
import { Backpack, X, Zap } from 'lucide-react';
import { ITEM_DESCRIPTIONS } from '../constants';

interface BagModalProps {
  isOpen: boolean;
  inventory: string[];
  equippedItem: string | null;
  onEquip: (item: string) => void;
  onClose: () => void;
}

export const BagModal: React.FC<BagModalProps> = ({ isOpen, inventory, onEquip, onClose }) => {
  const [selectedItem, setSelectedItem] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) setSelectedItem(null);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm animate-fade-in p-4" 
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 border border-gray-700 rounded-lg shadow-2xl w-full max-w-md overflow-hidden relative" 
        onClick={e => e.stopPropagation()}
      >
        
        {/* Header */}
        <div className="bg-black/50 p-4 border-b border-gray-800 flex justify-between items-center">
          <div className="flex items-center gap-2 text-gray-200">
             <Backpack size={18} />
             <h2 className="font-mono font-bold text-lg tracking-widest">BAG</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-4 min-h-[300px]">
           {selectedItem ? (
             <div className="animate-fade-in space-y-4">
                <div className="flex items-center gap-3 mb-4">
                   <div className="w-12 h-12 bg-gray-800 rounded flex items-center justify-center border border-gray-700">
                      <div className="w-6 h-6 bg-yellow-600 rounded-full shadow-[0_0_10px_rgba(202,138,4,0.5)]"></div>
                   </div>
                   <div>
                      <h3 className="text-xl font-bold text-white font-mono">{selectedItem}</h3>
                      <span className="text-xs text-gray-500 uppercase tracking-widest">Item Detail</span>
                   </div>
                </div>
                
                <p className="text-gray-300 font-mono leading-relaxed bg-black/30 p-3 rounded border border-gray-800 text-sm">
                   {ITEM_DESCRIPTIONS[selectedItem] || "No description available."}
                </p>

                <div className="pt-8 flex gap-3">
                   <button 
                     onClick={() => { onEquip(selectedItem); onClose(); }}
                     className="flex-1 bg-yellow-600 hover:bg-yellow-700 text-black font-bold py-3 rounded tracking-widest uppercase transition-all flex items-center justify-center gap-2 shadow-lg shadow-yellow-900/20"
                   >
                     <Zap size={16} />
                     USE ITEM
                   </button>
                   <button 
                     onClick={() => setSelectedItem(null)}
                     className="flex-1 bg-gray-800 hover:bg-gray-700 text-gray-300 font-bold py-3 rounded tracking-widest uppercase transition-colors"
                   >
                     CANCEL
                   </button>
                </div>
             </div>
           ) : (
             <>
               {(!inventory || inventory.length === 0) ? (
                 <div className="flex flex-col items-center justify-center h-full text-gray-600 font-mono py-12">
                    <Backpack size={48} className="mb-4 opacity-20" />
                    <p>Inventory Empty</p>
                 </div>
               ) : (
                 <div className="grid grid-cols-4 gap-3">
                    {inventory.map((item, idx) => (
                      <button 
                        key={idx}
                        onClick={() => setSelectedItem(item)}
                        className="aspect-square bg-black/40 border-2 border-gray-800 rounded flex flex-col items-center justify-center gap-2 hover:bg-gray-800 hover:border-gray-600 transition-all group relative"
                      >
                         <div className="w-4 h-4 bg-yellow-600 rounded-full group-hover:scale-110 transition-transform shadow-sm"></div>
                         <span className="text-[10px] font-mono text-gray-400 text-center leading-none px-1 truncate w-full">{item}</span>
                      </button>
                    ))}
                 </div>
               )}
             </>
           )}
        </div>
      </div>
    </div>
  );
};