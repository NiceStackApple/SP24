import React, { useEffect, useState } from 'react';
import { BattleEvent, ActionType } from '../types';
import { Sword } from 'lucide-react';

interface Props {
  event: BattleEvent | null;
}

export const BattleAnimationLayer: React.FC<Props> = ({ event }) => {
  const [style, setStyle] = useState<React.CSSProperties>({});
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (event?.type === ActionType.ATTACK && event.sourceId && event.targetId) {
      const sourceEl = document.getElementById(`player-card-${event.sourceId}`);
      const targetEl = document.getElementById(`player-card-${event.targetId}`);
      
      if (sourceEl && targetEl) {
        const sRect = sourceEl.getBoundingClientRect();
        const tRect = targetEl.getBoundingClientRect();
        
        // Coordinates relative to viewport (fixed overlay)
        const startX = sRect.left + sRect.width / 2;
        const startY = sRect.top; 
        
        const endX = tRect.left + tRect.width / 2;
        const endY = tRect.top + tRect.height / 2;

        const angle = Math.atan2(endY - startY, endX - startX) * (180 / Math.PI) + 45;

        // 1. Initial State (Spawn + Windup) - 0 to 150ms
        // Hidden initially to allow "Pre-highlight" to be seen cleanly? 
        // Or show immediately. Timeline: 0ms event starts. 150ms Spawn.
        
        setVisible(true);
        setStyle({
          transform: `translate(${startX}px, ${startY}px) scale(0.5)`,
          opacity: 0,
          transition: 'none'
        });

        const spawnTimer = setTimeout(() => {
          setStyle({
            transform: `translate(${startX}px, ${startY - 20}px) scale(1) rotate(${angle}deg)`,
            opacity: 1,
            transition: 'transform 150ms ease-out, opacity 150ms ease-in'
          });
        }, 150);

        // 2. Flight - 300ms to 600ms
        const flightTimer = setTimeout(() => {
          setStyle({
            transform: `translate(${endX}px, ${endY}px) scale(1) rotate(${angle}deg)`,
            opacity: 1,
            transition: 'transform 300ms cubic-bezier(0.4, 0, 0.2, 1)' 
          });
        }, 300);

        // 3. Exit - 700ms to 800ms
        const exitTimer = setTimeout(() => {
           setStyle(prev => ({
             ...prev,
             opacity: 0,
             transition: 'opacity 100ms ease-out'
           }));
        }, 700);

        const endTimer = setTimeout(() => {
          setVisible(false);
        }, 850);

        return () => {
          clearTimeout(spawnTimer);
          clearTimeout(flightTimer);
          clearTimeout(exitTimer);
          clearTimeout(endTimer);
        };
      }
    } else {
      setVisible(false);
    }
  }, [event]);

  if (!visible) return null;

  return (
    <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
       <div 
         className="absolute w-8 h-8 text-slate-200 drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]"
         style={{ ...style, width: 32, height: 32, marginLeft: -16, marginTop: -16, transformOrigin: 'center' }} 
       >
         <Sword size={32} fill="currentColor" fillOpacity={0.4} />
       </div>
    </div>
  );
}