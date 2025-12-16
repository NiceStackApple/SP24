
import React, { useEffect, useState, useRef } from 'react';
import { MessageSquare, Radio } from 'lucide-react';
import { NAMES_LIST } from '../constants';

const TIPS = [
  "Don't forget to EAT when hunger is low.",
  "REST restores Fatigue. High fatigue = low dodge chance.",
  "Run on Day 20 to survive the zone shrink!",
  "Monsters hunt at night. DEFEND to hide.",
  "Pistols are rare. Use them wisely.",
  "Zone damage scales up. Don't stay still too long.",
  "If you find Alcohol, use it for quick healing.",
  "You can block attacks with DEFEND.",
  "Watch out for the Volcano event. EXPLORE to dodge it.",
  "Gas requires DEFEND. Don't run in the gas.",
  "Alliance? Anyone?",
  "I heard Day 30 is brutal.",
  "Need healing!",
  "Who has the pistol?",
  "Day 50+ locks your recovery actions. End it fast.",
  "Items are key to winning.",
  "Don't attack if you are tired."
];

export const TipsChat: React.FC = () => {
  const [messages, setMessages] = useState<Array<{ id: number, name: string, text: string }>>([]);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      if (Math.random() > 0.6) {
        const text = TIPS[Math.floor(Math.random() * TIPS.length)];
        const name = NAMES_LIST[Math.floor(Math.random() * NAMES_LIST.length)] + '-' + Math.floor(Math.random() * 99);
        
        setMessages(prev => {
          const newState = [...prev, { id: Date.now(), name, text }];
          return newState.slice(-15); // Keep last 15
        });
      }
    }, 2500);

    return () => clearInterval(interval);
  }, []);

  // Auto scroll
  useEffect(() => {
    if (containerRef.current) {
      containerRef.current.scrollTop = containerRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="bg-gray-900/50 border border-gray-800 rounded-lg p-3 flex flex-col h-[300px]">
      <div className="flex items-center justify-between mb-2 border-b border-gray-700 pb-2">
        <div className="flex items-center gap-2 text-gray-400">
          <Radio size={14} className="animate-pulse text-green-500" />
          <h3 className="text-xs font-mono uppercase tracking-widest">Live Frequency</h3>
        </div>
        <span className="text-[9px] text-gray-600 bg-black px-1 rounded font-mono">CH: 24.9</span>
      </div>
      
      <div 
        ref={containerRef}
        className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar-hide"
      >
        {messages.map(msg => (
          <div key={msg.id} className="text-xs font-mono animate-fade-in break-words">
            <span className="text-blue-400 font-bold">{msg.name}:</span>
            <span className="text-gray-400 ml-1">{msg.text}</span>
          </div>
        ))}
        {messages.length === 0 && <div className="text-gray-600 text-[10px] italic text-center mt-10">Scanning frequency...</div>}
      </div>
    </div>
  );
};
