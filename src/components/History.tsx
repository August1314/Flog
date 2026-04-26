import React from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { format } from 'date-fns';
import { formatDuration } from '../lib/utils';
import { Trash2, ExternalLink } from 'lucide-react';

export const History: React.FC = () => {
  const sessions = useLiveQuery(() => 
    db.sessions.orderBy('startTime').reverse().toArray()
  );

  const deleteSession = async (id?: number) => {
    if (id) await db.sessions.delete(id);
  };

  return (
    <div className="flex flex-col h-full overflow-y-auto pb-24 p-6 gap-4">
      <div className="flex items-center justify-between mb-2">
        <h2 className="text-sm font-semibold text-[#1D1D1F]">Recent Activity</h2>
        <span className="text-[10px] bg-[#E5E5EA] text-[#8E8E93] font-bold px-2 py-1 rounded uppercase tracking-wider">
          {sessions?.length || 0} Events
        </span>
      </div>

      {!sessions || sessions.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-[#8E8E93] gap-3">
          <div className="p-4 bg-white rounded-full border border-[#E5E5EA] shadow-sm">
            <ExternalLink size={24} />
          </div>
          <p className="text-xs font-semibold">No monitoring events logged.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div 
              key={session.id} 
              className="bg-white border border-[#E5E5EA] rounded-xl p-4 hover:bg-[#F2F2F7]/50 transition-all group shadow-sm"
            >
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-[#5856D6] uppercase tracking-widest">{session.service}</span>
                    <span className="text-[#D1D1D6]">•</span>
                    <span className="text-[10px] font-mono text-[#8E8E93] font-bold">{format(session.startTime, 'MMM d • h:mm a')}</span>
                  </div>
                  <h4 className="text-[13px] font-semibold text-[#1D1D1F] tracking-tight">{session.taskName}</h4>
                </div>
                <button 
                  onClick={() => deleteSession(session.id)}
                  className="p-2 text-[#D1D1D6] hover:text-[#FF3B30] hover:bg-[#FF3B30]/10 rounded-lg transition-all opacity-0 group-hover:opacity-100"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              
              <div className="mt-3 flex items-center justify-between border-t border-[#F2F2F7] pt-2">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-mono font-bold text-[#8E8E93] bg-[#F2F2F7] px-1.5 py-0.5 rounded">
                    {formatDuration(session.durationSeconds)}
                  </span>
                </div>
                {session.tags && session.tags.length > 0 && (
                  <div className="flex gap-1">
                    {session.tags.map(tag => (
                      <span key={tag} className="text-[9px] text-[#007AFF] font-bold">
                        #{tag}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
