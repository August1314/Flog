import React from 'react';
import { ShieldCheck, Download, Trash, Database, AlertTriangle } from 'lucide-react';
import { db } from '../lib/db';

export const Settings: React.FC = () => {
  const exportData = async () => {
    const data = await db.sessions.toArray();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `agent-flow-data-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
  };

  const clearData = async () => {
    if (confirm('Are you sure you want to delete all local data? This cannot be undone.')) {
      await db.sessions.clear();
    }
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-24 p-6 gap-8">
      <div className="space-y-4">
        <h3 className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-widest ml-1">Privacy Architecture</h3>
        <div className="bg-white border border-[#E5E5EA] rounded-2xl p-4 flex gap-3 shadow-sm">
          <div className="p-2 bg-[#34C759]/10 rounded-xl">
            <ShieldCheck className="text-[#34C759]" size={20} />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-[#1D1D1F] leading-tight">Hardened Local Storage</h4>
            <p className="text-[11px] text-[#8E8E93] mt-1 font-medium leading-relaxed">
              Active tracking data is stored in a sandboxed IndexedDB. No telemetry leaves the local machine.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-widest ml-1">Data Pipeline</h3>
        <div className="space-y-2">
          <button 
            onClick={exportData}
            className="w-full flex items-center justify-between p-4 bg-white border border-[#E5E5EA] rounded-xl hover:bg-[#F2F2F7]/50 transition-all shadow-sm group"
          >
            <div className="flex items-center gap-3">
              <Download size={18} className="text-[#8E8E93] group-hover:text-[#007AFF]" />
              <span className="text-[13px] font-semibold text-[#1D1D1F]">Archive to JSON</span>
            </div>
            <Database size={14} className="text-[#D1D1D6]" />
          </button>

          <button 
            onClick={clearData}
            className="w-full flex items-center justify-between p-4 bg-white border border-[#E5E5EA] rounded-xl hover:bg-[#FF3B30]/5 group transition-all shadow-sm"
          >
            <div className="flex items-center gap-3">
              <Trash size={18} className="text-[#D1D1D6] group-hover:text-[#FF3B30]" />
              <span className="text-[13px] font-semibold text-[#1D1D1F] group-hover:text-[#FF3B30]">Purge Tracking Data</span>
            </div>
            <AlertTriangle size={14} className="text-[#D1D1D6] group-hover:text-[#FF3B30]/50" />
          </button>
        </div>
      </div>

      <div className="bg-[#5856D6]/5 border border-[#5856D6]/10 rounded-2xl p-4 mt-4">
        <h4 className="text-[10px] font-bold text-[#5856D6] uppercase tracking-widest mb-2">Build Environment</h4>
        <p className="text-[11px] text-[#8E8E93] leading-relaxed font-medium">
          Optimized for high-cadence development. Data is processed locally to ensure zero latency in monitoring.
        </p>
        <div className="mt-4 flex items-center justify-between">
          <span className="text-[9px] text-[#D1D1D6] font-mono uppercase">AgentTrack v1.0.4</span>
          <span className="text-[9px] font-bold text-[#5856D6] uppercase px-1.5 py-0.5 bg-white border border-[#5856D6]/10 rounded">Connected</span>
        </div>
      </div>
    </div>
  );
};
