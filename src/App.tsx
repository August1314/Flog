import React, { useState, useEffect } from 'react';
import { ActiveSession } from './components/ActiveSession';
import { Dashboard } from './components/Dashboard';
import { History } from './components/History';
import { Settings } from './components/Settings';
import { Navigation } from './components/Navigation';
import { motion, AnimatePresence } from 'motion/react';
import { BrainCircuit, Laptop, Cpu, ShieldCheck } from 'lucide-react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from './lib/db';

export default function App() {
  const [activeTab, setActiveTab] = useState('tracker');
  const [monitoredProcess, setMonitoredProcess] = useState<string | null>(null);
  const [currentService, setCurrentService] = useState<string>("Scanning...");
  const sessions = useLiveQuery(() => db.sessions.toArray());

  // Mapper to convert process name to AIService or general category
  const mapProcessToService = (process: string) => {
    const p = process.toLowerCase();
    if (p.includes('codex')) return "Codex";
    if (p.includes('claude')) return "Claude Code";
    if (p.includes('openclaw')) return "OpenClaw";
    if (p.includes('hermes')) return "Hermes";
    if (p.includes('code') || p.includes('vscode') || p.includes('visual studio')) return "VS Code";
    if (p.includes('terminal') || p.includes('iterm')) return "Terminal";
    return process;
  };

  // Real-time macOS Process Monitoring via local API
  useEffect(() => {
    const fetchActiveProcess = async () => {
      try {
        const response = await fetch('/api/active-process');
        const data = await response.json();
        setMonitoredProcess(data.process);
        setCurrentService(mapProcessToService(data.process));
      } catch (err) {
        console.error("Failed to poll active process:", err);
      }
    };

    const interval = setInterval(fetchActiveProcess, 2000); // 0.5hz for efficiency
    return () => clearInterval(interval);
  }, []);

  const totalHours = sessions ? Math.round(sessions.reduce((acc, s) => acc + s.durationSeconds, 0) / 3600) : 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F2F2F7] p-4 font-sans text-[#1D1D1F]">
      {/* macOS Desktop Window Layout */}
      <div className="w-[1100px] h-[720px] bg-white rounded-3xl shadow-[0_40px_100px_-20px_rgba(0,0,0,0.15)] border border-[#E5E5EA] flex flex-col overflow-hidden relative">
        
        {/* macOS Window Title Bar */}
        <header className="h-10 bg-[#E5E5EA]/80 backdrop-blur-md border-b border-[#D1D1D6] px-5 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-5">
            <div className="flex gap-2">
              <div className="w-3 h-3 rounded-full bg-[#FF5F57] shadow-inner" />
              <div className="w-3 h-3 rounded-full bg-[#FEBC2E] shadow-inner" />
              <div className="w-3 h-3 rounded-full bg-[#28C840] shadow-inner" />
            </div>
            <div className="h-4 w-px bg-[#D1D1D6]" />
            <div className="flex items-center gap-2">
              <BrainCircuit className="text-[#8E8E93]" size={14} />
              <span className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-tighter">AgentFlow Desktop • v1.0.4</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 bg-white/50 px-3 py-1 rounded-md border border-white/50 shadow-sm">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-[#34C759] shadow-[0_0_5px_rgba(52,199,89,0.5)]" />
              <span className="text-[10px] font-bold text-[#48484A]">Monitoring:</span>
              <span className="text-[10px] font-mono font-black text-[#007AFF] uppercase tracking-widest">{currentService}</span>
            </div>
          </div>
        </header>

        <div className="flex-1 flex overflow-hidden">
          {/* Column 1: Sidebar Navigation & Health (220px) */}
          <aside className="w-[220px] border-r border-[#F2F2F7] flex flex-col bg-[#F9F9FB] shrink-0">
            <div className="p-6 space-y-8">
              <div className="space-y-4">
                 <h3 className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-widest pl-1">Hub</h3>
                 <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
              </div>

              <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-widest pl-1">Metrics</h3>
                <div className="bg-white border border-[#E5E5EA] p-4 rounded-2xl shadow-sm">
                  <p className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider">Aggregate Flow</p>
                  <p className="text-3xl font-light mt-1 tracking-tight">{totalHours}h</p>
                  <div className="mt-3 h-1 bg-[#F2F2F7] rounded-full overflow-hidden">
                    <div className="h-full bg-[#007AFF] transition-all duration-1000" style={{ width: `${Math.min(100, totalHours * 10)}%` }} />
                  </div>
                  <p className="text-[9px] text-[#34C759] font-bold mt-2 uppercase">● Optimal state reached</p>
                </div>
              </div>
            </div>
            
            <div className="mt-auto p-6 border-t border-[#F2F2F7] bg-white/30 backdrop-blur-sm">
               <div className="flex items-center gap-2 text-[10px] text-[#8E8E93] font-bold tracking-tight">
                 <ShieldCheck size={14} className="text-[#34C759]" />
                 SECURE LOCAL ARCHITECTURE
               </div>
            </div>
          </aside>

          {/* Column 2 & 3 Body */}
          <main className="flex-1 flex overflow-hidden">
             {/* Center Column: Interactive Worksurface */}
             <div className="flex-[1.6] border-r border-[#F2F2F7] overflow-y-auto">
               <AnimatePresence mode="wait">
                 <motion.div
                   key={activeTab}
                   initial={{ opacity: 0, x: -10 }}
                   animate={{ opacity: 1, x: 0 }}
                   exit={{ opacity: 0, x: 10 }}
                   transition={{ duration: 0.2, ease: "easeOut" }}
                   className="h-full"
                 >
                   {activeTab === 'dashboard' ? <Dashboard /> : 
                    activeTab === 'settings' ? <Settings /> : 
                    activeTab === 'tracker' ? (
                      <div className="p-8 h-full flex flex-col justify-center max-w-lg mx-auto">
                         <div className="text-center mb-10">
                            <h2 className="text-3xl font-extrabold tracking-tight text-[#1D1D1F] mb-3">Focus Command</h2>
                            <p className="text-[#8E8E93] text-sm">Control manual tracking and service selection.</p>
                         </div>
                         <ActiveSession />
                      </div>
                    ) : (
                      <div className="p-8 h-full">
                         <History />
                      </div>
                    )}
                 </motion.div>
               </AnimatePresence>
             </div>

             {/* Right Column: Live Telemetry & Records */}
             <aside className="flex-1 flex flex-col bg-white overflow-hidden shrink-0">
                <div className="flex-1 overflow-hidden flex flex-col">
                   <header className="p-4 bg-[#F9F9FB] border-b border-[#F2F2F7] flex justify-between items-center">
                      <h3 className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-widest">Journal Stream</h3>
                      <button 
                        onClick={() => setActiveTab('history')}
                        className="text-[10px] text-[#007AFF] font-bold hover:underline uppercase tracking-wider"
                      >
                        Expand All
                      </button>
                   </header>
                   <div className="flex-1 overflow-y-auto bg-white scroll-smooth">
                      <History />
                   </div>
                </div>
             </aside>
          </main>
        </div>

        {/* macOS Style Action Footer */}
        <footer className="h-8 bg-[#E5E5EA]/40 border-t border-[#D1D1D6] px-5 flex items-center justify-between shrink-0 z-20">
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#8E8E93] uppercase">
               <Laptop size={12} className="text-[#8E8E93]" />
               ENV: macOS_SANDBOX
            </div>
            <div className="flex items-center gap-1.5 text-[9px] font-bold text-[#8E8E93] uppercase">
               <Cpu size={12} className="text-[#8E8E93]" />
               CORE: INTERNAL_INDEXED_DB
            </div>
          </div>
          <div className="text-[9px] font-bold text-[#8E8E93] uppercase tracking-tighter flex items-center gap-4">
            <span>Scan Frequency: 0.2hz</span>
            <div className="flex items-center gap-1">
               <div className="w-1.5 h-1.5 rounded-full bg-[#34C759]" />
               <span>No external telemetry</span>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
