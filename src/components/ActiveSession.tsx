import React, { useState, useEffect, useRef } from 'react';
import { Play, Square, Tag, ChevronRight, BrainCircuit } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { AIService } from '../types';
import { db } from '../lib/db';
import { cn, formatDuration } from '../lib/utils';

export const ActiveSession: React.FC = () => {
  const [isActive, setIsActive] = useState(false);
  const [seconds, setSeconds] = useState(0);
  const [service, setService] = useState<AIService>(AIService.CODEX);
  const [taskName, setTaskName] = useState('');
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const startSession = () => {
    setIsActive(true);
    setSeconds(0);
    timerRef.current = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);
  };

  const stopSession = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    
    await db.sessions.add({
      startTime: new Date(Date.now() - seconds * 1000),
      endTime: new Date(),
      durationSeconds: seconds,
      service,
      taskName: taskName || 'Unnamed Task',
      tags: [],
    });

    setIsActive(false);
    setSeconds(0);
    setTaskName('');
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#E5E5EA] rounded-xl">
            <BrainCircuit size={20} className="text-[#8E8E93]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[#1D1D1F] leading-none">Active Focus</h2>
            <p className="text-[10px] text-[#8E8E93] mt-1 uppercase tracking-wider font-bold">Manual Monitoring</p>
          </div>
        </div>
        <div className={cn(
          "w-2 h-2 rounded-full",
          isActive ? "bg-[#34C759] shadow-[0_0_8px_rgba(52,199,89,0.5)] animate-pulse" : "bg-[#D1D1D6]"
        )} />
      </div>

      <div className="relative flex flex-col items-center py-10 bg-white rounded-2xl border border-[#E5E5EA] shadow-sm">
        <span className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-widest absolute top-3">Focus Duration</span>
        <div className="text-5xl font-light tracking-tight text-[#1D1D1F] tabular-nums">
          {formatDuration(seconds)}
        </div>
      </div>

      <div className="space-y-4">
        <div className="space-y-1.5 group">
          <label className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider ml-1">AI Service</label>
          <div className="grid grid-cols-2 gap-2">
            {Object.values(AIService).map((s) => (
              <button
                key={s}
                onClick={() => !isActive && setService(s)}
                disabled={isActive}
                className={cn(
                  "px-3 py-2 text-[11px] font-semibold rounded-lg border transition-all",
                  service === s 
                    ? "bg-[#F2F2F7] border-[#007AFF] text-[#007AFF] shadow-sm" 
                    : "bg-white border-[#E5E5EA] text-[#8E8E93] hover:border-[#D1D1D6] disabled:opacity-50"
                )}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[10px] font-bold text-[#8E8E93] uppercase tracking-wider ml-1">Current Task</label>
          <div className="relative">
            <input
              type="text"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="Annotate your workflow..."
              className="w-full px-3 py-2.5 text-sm bg-white border border-[#E5E5EA] rounded-xl focus:outline-none focus:border-[#007AFF] transition-all text-[#1D1D1F] placeholder-[#D1D1D6]"
            />
            <Tag className="absolute right-3 top-1/2 -translate-y-1/2 text-[#D1D1D6]" size={14} />
          </div>
        </div>
      </div>

      <div className="pt-2">
        {!isActive ? (
          <button
            onClick={startSession}
            className="w-full bg-[#007AFF] hover:bg-[#0062CC] text-white py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98]"
            id="start-tracking-btn"
          >
            <Play size={16} fill="currentColor" />
            Begin Session
          </button>
        ) : (
          <button
            onClick={stopSession}
            className="w-full bg-white border border-[#E5E5EA] hover:bg-[#F2F2F7] text-[#FF3B30] py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2 transition-all shadow-sm active:scale-[0.98]"
            id="stop-tracking-btn"
          >
            <Square size={16} fill="currentColor" />
            End Session
          </button>
        )}
      </div>
    </div>
  );
};
