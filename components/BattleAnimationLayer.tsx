
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
    if ((event?.type === ActionType.SHOOT || event?.type === ActionType.HEAL) && event.sourceId && event.targetId) {
      
      const isShoot = event.type === ActionType.SHOOT;
      const delay = isShoot ? 50 : 200; 

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
               const dist = Math.hypot(endX - startX, endY - startY);
               
               setVisible(true);
               setStyle({
                 transform: `translate(${startX}px, ${startY}px) rotate(${angle}deg)`,
                 opacity: 1,
                 transition: 'none',
                 width: '20px', // Projectile length
                 height: '4px',
                 background: '#fff', 
                 boxShadow: '0 0 10px #fbbf24, 0 0 20px #fbbf24',
                 borderRadius: '2px',
                 zIndex: 1000
               });
               
               // Bullet Travel
               setTimeout(() => {
                 setStyle({
                   transform: `translate(${endX}px, ${endY}px) rotate(${angle}deg)`,
                   opacity: 1, 
                   transition: 'transform 100ms linear', 
                   width: '20px',
                   height: '4px',
                   background: '#fff',
                   boxShadow: '0 0 10px #fbbf24',
                   borderRadius: '2px',
                   zIndex: 1000
                 });
               }, 20);

               setTimeout(() => setVisible(false), 150);

            } else if (event.type === ActionType.HEAL) {
               setAnimType('HEAL');
               
               setVisible(true);
               setStyle({
                 transform: `translate(${startX}px, ${startY}px) scale(0.5)`,
                 opacity: 0,
                 transition: 'none',
                 color: '#4ade80',
                 zIndex: 1000
               });
               
               // Spawn
               setTimeout(() => {
                  setStyle({
                    transform: `translate(${startX}px, ${startY}px) scale(1.5)`,
                    opacity: 1,
                    transition: 'transform 200ms ease-out, opacity 200ms ease-in',
                    color: '#4ade80',
                    zIndex: 1000
                  });
               }, 50);

               // Travel to Target
               setTimeout(() => {
                  setStyle({
                    transform: `translate(${endX}px, ${endY}px) scale(1)`,
                    opacity: 1,
                    transition: 'transform 600ms ease-in-out',
                    color: '#4ade80',
                    zIndex: 1000
                  });
               }, 250);

               // Absorb
               setTimeout(() => {
                 setStyle(prev => ({
                   ...prev,
                   transform: `translate(${endX}px, ${endY - 30}px) scale(1.2)`,
                   opacity: 0,
                   transition: 'transform 300ms ease-out, opacity 300ms ease-out'
                 }));
               }, 850);

               setTimeout(() => setVisible(false), 1150);
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
       <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
         <div className="absolute" style={style} />
       </div>
     );
  }

  if (animType === 'HEAL') {
     return (
       <div className="fixed inset-0 pointer-events-none z-[100] overflow-hidden">
         <div 
           className="absolute flex items-center justify-center"
           style={{ ...style, width: 32, height: 32, marginLeft: -16, marginTop: -16 }} 
         >
           <Plus size={32} fill="currentColor" className="drop-shadow-[0_0_15px_rgba(74,222,128,1)]" />
         </div>
       </div>
     );
  }

  return null;
}
