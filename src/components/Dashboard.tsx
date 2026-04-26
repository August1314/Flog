import React, { useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  Cell, PieChart, Pie 
} from 'recharts';
import { format, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay } from 'date-fns';
import { db } from '../lib/db';
import { AIService } from '../types';

const COLORS = ['#007AFF', '#5856D6', '#AF52DE', '#FF9500', '#34C759'];

export const Dashboard: React.FC = () => {
  const sessions = useLiveQuery(() => db.sessions.toArray());

  const stats = useMemo(() => {
    if (!sessions) return null;

    const last7Days = eachDayOfInterval({
      start: startOfWeek(new Date(), { weekStartsOn: 1 }),
      end: endOfWeek(new Date(), { weekStartsOn: 1 })
    });

    const weeklyData = last7Days.map(day => {
      const daySessions = sessions.filter(s => isSameDay(s.startTime, day));
      const totalMinutes = daySessions.reduce((acc, s) => acc + (s.durationSeconds / 60), 0);
      return {
        date: format(day, 'EEE'),
        minutes: Math.round(totalMinutes),
        fullDate: format(day, 'MMM d')
      };
    });

    const serviceData = Object.values(AIService).map(service => {
      const totalSeconds = sessions
        .filter(s => s.service === service)
        .reduce((acc, s) => acc + s.durationSeconds, 0);
      return {
        name: service,
        value: Math.round(totalSeconds / 60)
      };
    }).filter(d => d.value > 0);

    const totalHours = Math.round(sessions.reduce((acc, s) => acc + s.durationSeconds, 0) / 3600);

    return { weeklyData, serviceData, totalHours };
  }, [sessions]);

  if (!stats) return <div className="p-8 text-center text-[#8E8E93]">Computing stats...</div>;

  return (
    <div className="p-8 pb-32 space-y-12">
      <div className="space-y-6">
        <div className="flex justify-between items-center px-1">
          <div>
            <h2 className="text-xl font-bold tracking-tight text-[#1D1D1F]">Workflow Intelligence</h2>
            <p className="text-[11px] text-[#8E8E93] font-bold uppercase tracking-widest mt-1">Weekly Activity Distribution</p>
          </div>
          <div className="flex gap-2">
            <span className="text-[10px] font-bold text-[#007AFF] bg-[#007AFF]/10 px-3 py-1 rounded-full uppercase tracking-wider">Minutes Focus / Day</span>
          </div>
        </div>
        
        <div className="h-72 bg-white border border-[#E5E5EA] rounded-3xl p-8 shadow-sm">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.weeklyData}>
              <XAxis 
                dataKey="date" 
                axisLine={false} 
                tickLine={false} 
                tick={{ fontSize: 10, fill: '#8E8E93', fontWeight: 700 }}
              />
              <Tooltip 
                cursor={{ fill: '#F2F2F7', radius: 8 }}
                contentStyle={{ borderRadius: '16px', border: '1px solid #E5E5EA', boxShadow: '0 8px 30px rgba(0,0,0,0.04)', fontSize: '11px', fontWeight: 800, padding: '12px' }}
              />
              <Bar dataKey="minutes" fill="#007AFF" radius={[8, 8, 8, 8]} barSize={44} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-8">
        <div className="space-y-4">
          <h3 className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-widest px-1">Core Tool Mix</h3>
          <div className="bg-white border border-[#E5E5EA] rounded-3xl p-6 shadow-sm flex items-center">
            <div className="w-1/2 h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={stats.serviceData}
                    innerRadius={50}
                    outerRadius={70}
                    paddingAngle={8}
                    dataKey="value"
                    stroke="none"
                  >
                    {stats.serviceData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="w-1/2 space-y-4 pl-4">
              {stats.serviceData.map((item, index) => (
                <div key={item.name} className="flex items-center justify-between text-[11px]">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[index % COLORS.length] }} />
                    <span className="font-bold text-[#1D1D1F] uppercase tracking-tight">{item.name}</span>
                  </div>
                  <span className="text-[#8E8E93] font-mono font-black">{item.value}m</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <h3 className="text-[11px] font-bold text-[#8E8E93] uppercase tracking-widest px-1">System Load</h3>
          <div className="bg-white border border-[#E5E5EA] rounded-3xl p-8 shadow-sm flex flex-col justify-center">
             <div className="flex items-end gap-2 mb-2">
                <span className="text-4xl font-light text-[#1D1D1F]">{sessions?.length || 0}</span>
                <span className="text-sm font-bold text-[#8E8E93] mb-1.5 uppercase">Logged States</span>
             </div>
             <p className="text-[11px] text-[#8E8E93] font-medium leading-relaxed">
               All state transitions are indexed locally. This reduces monitoring latency and ensures high-fidelity journals.
             </p>
             <div className="mt-6 flex gap-2">
                <div className="flex-1 h-1.5 bg-[#34C759] rounded-full" />
                <div className="flex-1 h-1.5 bg-[#F2F2F7] rounded-full" />
                <div className="flex-1 h-1.5 bg-[#F2F2F7] rounded-full" />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};
