import React from 'react';
import { Timer, LayoutDashboard, History, Settings } from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface NavigationProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export const Navigation: React.FC<NavigationProps> = ({ activeTab, onTabChange }) => {
  const tabs = [
    { id: 'tracker', icon: Timer, label: 'Session' },
    { id: 'dashboard', icon: LayoutDashboard, label: 'Analytics' },
    { id: 'history', icon: History, label: 'History' },
    { id: 'settings', icon: Settings, label: 'System' },
  ];

  return (
    <nav className="flex flex-col gap-1">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-200 group relative overflow-hidden",
              isActive ? "bg-white text-[#007AFF] shadow-sm ring-1 ring-[#D1D1D6]/30" : "text-[#8E8E93] hover:text-[#1D1D1F] hover:bg-[#E5E5EA]/40"
            )}
            id={`nav-tab-${tab.id}`}
          >
            <Icon size={16} strokeWidth={isActive ? 2.5 : 2} className="relative z-10" />
            <span className="text-[11px] font-bold uppercase tracking-tight relative z-10">{tab.label}</span>
            {isActive && (
              <motion.div 
                layoutId="nav-bg-glow"
                className="absolute inset-0 bg-white"
                initial={false}
                transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
              />
            )}
          </button>
        );
      })}
    </nav>
  );
};
