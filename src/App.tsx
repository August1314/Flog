import React, { useState, useEffect } from 'react';
import { ActiveSession } from './components/ActiveSession';
import { Dashboard } from './components/Dashboard';
import { StartupMonitor } from './components/StartupMonitor';
import { History } from './components/History';
import { Settings } from './components/Settings';
import { Navigation } from './components/Navigation';
import { motion, AnimatePresence } from 'motion/react';
import { BrainCircuit } from 'lucide-react';
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
    if (p.includes('qclaw')) return "QClaw";
    if (p.includes('hermes')) return "Hermes";
    if (p.includes('code') || p.includes('vscode') || p.includes('visual studio')) return "VS Code";
    if (p.includes('terminal') || p.includes('iterm')) return "Terminal";
    if (p.includes('vibe') || p.includes('vibe coding')) return "Vibe Coding";
    if (p.includes('trae cn') || p.includes('trae')) return "trae cn";
    return process;
  };

  // Real-time macOS Process Monitoring via local API
  useEffect(() => {
    const fetchActiveProcess = async () => {
      try {
        const response = await fetch('http://localhost:3001/api/active-process');
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
    <div className="min-h-screen bg-[#F2F2F7] font-sans text-[#1D1D1F]">
      {/* Header */}
      <header className="bg-white border-b border-[#E5E5EA] px-6 py-4 shadow-sm">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <BrainCircuit className="text-[#007AFF]" size={24} />
            <h1 className="text-xl font-bold">AgentFlow</h1>
          </div>
          <div className="flex items-center gap-4 bg-[#F2F2F7] px-4 py-2 rounded-lg">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#34C759] shadow-[0_0_5px_rgba(52,199,89,0.5)]" />
              <span className="text-sm font-medium">Monitoring:</span>
              <span className="text-sm font-mono font-bold text-[#007AFF] uppercase tracking-wider">{currentService}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-xl shadow-sm border border-[#E5E5EA] p-6">
              <h2 className="text-sm font-bold text-[#8E8E93] uppercase tracking-widest mb-6">Navigation</h2>
              <Navigation activeTab={activeTab} onTabChange={setActiveTab} />
              
              <div className="mt-8">
                <h3 className="text-sm font-bold text-[#8E8E93] uppercase tracking-widest mb-4">Metrics</h3>
                <div className="bg-[#F9F9FB] border border-[#E5E5EA] p-4 rounded-lg">
                  <p className="text-xs font-bold text-[#8E8E93] uppercase tracking-wider">Total Focus Time</p>
                  <p className="text-3xl font-light mt-1 tracking-tight">{totalHours}h</p>
                  <div className="mt-3 h-1.5 bg-[#F2F2F7] rounded-full overflow-hidden">
                    <div className="h-full bg-[#007AFF] transition-all duration-1000" style={{ width: `${Math.min(100, totalHours * 10)}%` }} />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-3">
            <div className="bg-white rounded-xl shadow-sm border border-[#E5E5EA] p-6">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 10 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                >
                  {activeTab === 'dashboard' ? <Dashboard /> :
                   activeTab === 'settings' ? <Settings /> :
                   activeTab === 'startup' ? <StartupMonitor /> :
                   activeTab === 'tracker' ? (
                     <div className="text-center mb-8">
                       <h2 className="text-2xl font-extrabold tracking-tight text-[#1D1D1F] mb-3">Focus Command</h2>
                       <p className="text-[#8E8E93] mb-6">Control manual tracking and service selection.</p>
                       <ActiveSession />
                     </div>
                   ) : (
                     <div>
                       <h2 className="text-2xl font-extrabold tracking-tight text-[#1D1D1F] mb-6">History</h2>
                       <History />
                     </div>
                   )}
                </motion.div>
              </AnimatePresence>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-[#E5E5EA] px-6 py-4 mt-8">
        <div className="max-w-7xl mx-auto text-center text-sm text-[#8E8E93]">
          <p>AgentFlow • macOS Version</p>
        </div>
      </footer>
    </div>
  );
}
