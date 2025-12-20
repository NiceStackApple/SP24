
import React from 'react';
import { X, AlertTriangle } from 'lucide-react';

interface UpdateLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UpdateLogModal: React.FC<UpdateLogModalProps> = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm p-4 animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-gray-900 border border-gray-700 rounded-xl shadow-2xl w-full max-w-2xl h-[80vh] flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
         <div className="p-4 border-b border-gray-800 flex items-center justify-between bg-black/50">
            <div className="flex items-center gap-2">
               <AlertTriangle size={18} className="text-yellow-500" />
               <h2 className="text-lg font-bold font-mono text-white tracking-widest">SYSTEM PATCH NOTES</h2>
            </div>
            <button onClick={onClose} className="text-gray-500 hover:text-white">
               <X size={20} />
            </button>
         </div>

         <div className="flex-1 overflow-y-auto p-6 space-y-6 font-mono text-sm text-gray-400">
            
            {/* 2.4.0 */}
            <div>
               <div className="text-white font-bold mb-2 flex items-center justify-between">
                  <span className="text-lg">v2.4.0</span>
                  <span className="text-[10px] bg-green-900/30 text-green-400 px-2 py-0.5 rounded border border-green-900">MOBILE OPTIMIZATION</span>
               </div>
               <ul className="list-disc pl-5 space-y-2 text-gray-300">
                  <li><b className="text-green-400">GRID:</b> Player card layout standardized to 4 columns on all devices for consistency.</li>
                  <li><b className="text-green-400">COMMS:</b> Mobile comms & logs now appear side-by-side in a split view overlay for rapid intel access.</li>
                  <li><b className="text-green-400">UI:</b> Player cards streamlined for mobile visibility. Non-essential stats hidden on small screens.</li>
               </ul>
            </div>

            <div className="w-full h-px bg-gray-800"></div>

            {/* 2.3.4 */}
            <div>
               <div className="text-gray-300 font-bold mb-2 flex items-center justify-between">
                  <span className="text-lg">v2.3.4</span>
                  <span className="text-[10px] bg-blue-900/30 text-blue-400 px-2 py-0.5 rounded border border-blue-900">UX UPDATE</span>
               </div>
               <ul className="list-disc pl-5 space-y-2 text-gray-400">
                  <li><b className="text-blue-400">UI:</b> Added Bag notification dot to indicate new items obtained.</li>
                  <li><b className="text-blue-400">CLARITY:</b> Notification persists until Bag is opened, preventing missed loot rewards.</li>
               </ul>
            </div>

            <div className="w-full h-px bg-gray-800"></div>

            {/* 2.3.3 */}
            <div>
               <div className="text-gray-300 font-bold mb-2 flex items-center justify-between">
                  <span className="text-lg">v2.3.3</span>
                  <span className="text-[10px] bg-red-900/30 text-red-500 px-2 py-0.5 rounded border border-red-900">SYSTEM RESTORE</span>
               </div>
               <ul className="list-disc pl-5 space-y-2 text-gray-400">
                  <li><b className="text-red-400">RESTORED:</b> Pistol, Gas, Volcano, Shrink, and Monster events are hard-locked and fully functional.</li>
                  <li><b className="text-red-400">ANIMATIONS:</b> Fixed issue where Mass Events (Gas, Volcano) could resolve silently without animations.</li>
                  <li><b className="text-red-400">TIMING:</b> Gas Event now forces an 8-second visual sequence. Other events force 5 seconds.</li>
                  <li><b className="text-yellow-400">WARNINGS:</b> Seismic and Toxin warnings now appear 1 day prior to the event.</li>
               </ul>
            </div>

            <div className="w-full h-px bg-gray-800"></div>

            {/* 2.3.2 */}
            <div>
               <div className="text-gray-300 font-bold mb-2 flex items-center justify-between">
                  <span className="text-lg">v2.3.2</span>
                  <span className="text-[10px] bg-yellow-900/30 text-yellow-500 px-2 py-0.5 rounded border border-yellow-900">HOTFIX</span>
               </div>
               <ul className="list-disc pl-5 space-y-2 text-gray-400">
                  <li><b className="text-yellow-400">UX:</b> Fixed resolving screen blur flicker. Blur now persists continuously during the night phase.</li>
                  <li><b className="text-yellow-400">BAG UI:</b> Fixed Bag interface not opening due to invalid state logic. Bag access is now guaranteed.</li>
                  <li><b className="text-yellow-400">SCALING:</b> Completely removed fatigue-based loot scaling conflict.</li>
                  <li><b className="text-yellow-400">EXPLORE:</b> Explore is now strictly Day-based (80% / 60% / 40%) for both Dodge and Loot. Success yields both Item and Safety.</li>
               </ul>
            </div>

            <div className="w-full h-px bg-gray-800"></div>

            {/* 2.3.1 */}
            <div>
               <div className="text-gray-500 font-bold mb-2 flex items-center justify-between">
                  <span className="text-lg">v2.3.1</span>
                  <span className="text-[10px] bg-yellow-900/30 text-yellow-500 px-2 py-0.5 rounded border border-yellow-900">HOTFIX</span>
               </div>
               <ul className="list-disc pl-5 space-y-2 text-gray-500">
                  <li><b className="text-yellow-400">CRITICAL FIX:</b> Fixed Explore action cooldown not applying. Explore now correctly initiates a 1-day cooldown after use.</li>
                  <li><b className="text-yellow-400">LOGIC:</b> Fixed incorrect RNG bias causing early game Explore to fail too often.</li>
                  <li><b className="text-yellow-400">EXPLORE:</b> Corrected Explore logic to resolve Dodge + Loot as a single composite action. Success rates in Day 1-20 are now correctly biased to 80%.</li>
               </ul>
            </div>

            <div className="w-full h-px bg-gray-800"></div>

            {/* 2.3.0 */}
            <div>
               <div className="text-gray-500 font-bold mb-2 flex items-center justify-between">
                  <span className="text-lg">v2.3.0</span>
                  <span className="text-[10px] bg-red-900/30 text-red-500 px-2 py-0.5 rounded border border-red-900">ENDGAME UPDATE</span>
               </div>
               <ul className="list-disc pl-5 space-y-2 text-gray-500">
                  <li><b className="text-red-400">LOCKDOWN:</b> Day 50+ disables EAT and REST actions. Survival becomes impossible without conflict.</li>
                  <li><b className="text-red-400">MONSTERS:</b> Now require DEFEND (Hide) to survive. Run/Explore is no longer a valid counter.</li>
                  <li><b className="text-red-400">ZONE:</b> Final shrink event at Day 45. Damage increases significantly.</li>
                  <li>Account System implemented. Progress is now persistent.</li>
               </ul>
            </div>

            <div className="w-full h-px bg-gray-800"></div>

            {/* 2.2.0 */}
            <div>
               <div className="text-gray-600 font-bold mb-2">v2.2.0</div>
               <ul className="list-disc pl-5 space-y-2 text-gray-600">
                  <li><b className="text-blue-400">PHASES:</b> Game divided into Exploration (1-19), Shrink (20-29), and Hunt (30+).</li>
                  <li><b className="text-blue-400">BALANCE:</b> Dodge/Loot success chance scales down as the game progresses.</li>
                  <li><b className="text-blue-400">VISUALS:</b> Added specific atmospheric effects for Volcano, Gas, and Monster events.</li>
               </ul>
            </div>

            <div className="w-full h-px bg-gray-800"></div>

            {/* 2.1.0 */}
            <div>
               <div className="text-gray-600 font-bold mb-2">v2.1.0</div>
               <ul className="list-disc pl-5 space-y-2 text-gray-600">
                  <li>Added Monster Hunt event logic.</li>
                  <li>Implemented Shrinking Zone barrier mechanics.</li>
                  <li>Added Global Network chat feed simulation.</li>
               </ul>
            </div>

             <div className="w-full h-px bg-gray-800"></div>

            {/* 1.0.0 */}
            <div>
               <div className="text-gray-700 font-bold mb-2">v1.0.0</div>
               <ul className="list-disc pl-5 space-y-2 text-gray-600">
                  <li>Initial deployment.</li>
                  <li>Basic combat (Attack, Defend, Shoot).</li>
                  <li>Survival mechanics (Hunger, Fatigue, HP).</li>
                  <li>24 Player Lobby capacity.</li>
               </ul>
            </div>

         </div>
      </div>
    </div>
  );
};
