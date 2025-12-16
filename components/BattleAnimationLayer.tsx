import React, { useEffect, useState } from 'react';
import { BattleEvent, ActionType } from '../types';
import { Plus } from 'lucide-react';

interface Props {
  event: BattleEvent | null;
}

export const BattleAnimationLayer: React.FC<Props> = ({ event }) => {
  const [style, setStyle] = useState<React.CSSProperties>({});
  const [visible, setVisible] = useState(false);
  const [animType, setAnimType] = useState<'GUN' | 'HEAL' | null>(null);

  useEffect(() => {
    // Only animate Shoot and Heal here. Sword is now inside PlayerCard.
    if ((event?.type === ActionType.SHOOT || event?.type === ActionType.HEAL) && event.sourceId && event.targetId) {
      
      const isShoot = event.type === ActionType.SHOOT;
      // Shoot is now instant, heal waits a bit
      const delay = isShoot ? 50 : 1200; 

      const delayTimer = setTimeout(() => {
          const sourceEl = document.getElementById(`player-card-${event.sourceId}`);
          const targetEl = document.getElementById(`player-card-${event.targetId}`);
          
          if (sourceEl && targetEl) {
            const sRect = sourceEl.getBoundingClientRect();
            const tRect = targetEl.getBoundingClientRect();
            
            const startX = sRect.left + sRect.width / 2;
            const startY = sRect.top + sRect.height / 2;
            
            const endX = tRect.left + tRect.width / 2;
            const endY = tRect.top + tRect.height / 2;

            if (event.type === ActionType.SHOOT) {
               setAnimType('GUN');
               const angle = Math.atan2(endY - startY, endX - startX) * (180 / Math.PI);
               
               setVisible(true);
               setStyle({
                 transform: `translate(${startX}px, ${startY}px) rotate(${angle}deg)`,
                 opacity: 0,
                 transition: 'none',
                 width: '12px',
                 height: '2px', // Thinner line
                 background: '#fbbf24', 
                 borderRadius: '2px',
                 boxShadow: '0 0 5px #fbbf24'
               });
               
               // Instant faint trace
               setTimeout(() => {
                 setStyle({
                   transform: `translate(${endX}px, ${endY}px) rotate(${angle}deg)`,
                   opacity: 0.4, // Faint
                   transition: 'transform 150ms linear, opacity 100ms ease-out', 
                   width: '12px',
                   height: '2px',
                   background: '#fbbf24',
                   borderRadius: '2px',
                   boxShadow: '0 0 5px #fbbf24'
                 });
               }, 20);

               setTimeout(() => setVisible(false), 200);

            } else if (event.type === ActionType.HEAL) {
               setAnimType('HEAL');
               
               setVisible(true);
               setStyle({
                 transform: `translate(${startX}px, ${startY}px) scale(0.5)`,
                 opacity: 0,
                 transition: 'none',
                 color: '#4ade80'
               });
               
               setTimeout(() => {
                  setStyle({
                    transform: `translate(${startX}px, ${startY}px) scale(1.5)`,
                    opacity: 1,
                    transition: 'transform 200ms ease-out, opacity 200ms ease-in',
                    color: '#4ade80'
                  });
               }, 50);

               setTimeout(() => {
                  setStyle({
                    transform: `translate(${endX}px, ${endY}px) scale(1)`,
                    opacity: 0.8,
                    transition: 'transform 400ms ease-in-out',
                    color: '#4ade80'
                  });
               }, 250);

               setTimeout(() => {
                 setStyle(prev => ({
                   ...prev,
                   transform: `translate(${endX}px, ${endY}px) scale(2)`,
                   opacity: 0,
                   transition: 'transform 200ms ease-out, opacity 200ms ease-out'
                 }));
               }, 650);

               setTimeout(() => setVisible(false), 850);
            }
          }
      }, delay);

      return () => clearTimeout(delayTimer);
    } else {
      setVisible(false);
    }
  }, [event]);

  if (!visible) return null;

  if (animType === 'GUN') {
     return (
       <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
         <div className="absolute" style={style} />
       </div>
     );
  }

  if (animType === 'HEAL') {
     return (
       <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden">
         <div 
           className="absolute w-8 h-8 drop-shadow-[0_0_15px_rgba(74,222,128,0.8)]"
           style={{ ...style, width: 32, height: 32, marginLeft: -16, marginTop: -16, transformOrigin: 'center' }} 
         >
           <Plus size={32} fill="currentColor" />
         </div>
       </div>
     );
  }

  return null;
}