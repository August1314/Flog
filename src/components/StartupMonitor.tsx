import React, { useState, useEffect, useCallback } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../lib/db';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { motion, AnimatePresence } from 'motion/react';
import { Play, Square, RotateCcw, Clock, CheckCircle, XCircle } from 'lucide-react';

const COLORS = ['#007AFF', '#34C759', '#FF9500', '#FF3B30', '#AF52DE'];

interface StartupStatus {
  status: string;
  startTime: string | null;
  endTime: string | null;
  durationMs: number | null;
  failureReason: string | null;
  updatedAt: string;
}

interface StartupRecord {
  id: number;
  timestamp: string;
  durationMs: number;
  success: boolean;
  failureReason?: string;
  startedAt: string;
  completedAt: string;
}

interface StartupStats {
  averageMs: number;
  minMs: number;
  maxMs: number;
  totalCount: number;
  successCount: number;
  failureCount: number;
}

export const StartupMonitor: React.FC = () => {
  const [status, setStatus] = useState<StartupStatus | null>(null);
  const [stats, setStats] = useState<StartupStats | null>(null);
  const [history, setHistory] = useState<StartupRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'status' | 'history' | 'stats'>('status');

  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3001/api/startup/status');
      const data = await res.json();
      setStatus(data);
    } catch (err) {
      console.error('Failed to fetch startup status:', err);
    }
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3001/api/startup/stats');
      const data = await res.json();
      setStats(data);
    } catch (err) {
      console.error('Failed to fetch stats:', err);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3001/api/startup/history?limit=20');
      const data = await res.json();
      setHistory(data.records || []);
    } catch (err) {
      console.error('Failed to fetch history:', err);
    }
  }, []);

  useEffect(() => {
    fetchStatus();
    fetchStats();
    fetchHistory();

    const interval = setInterval(() => {
      fetchStatus();
    }, 2000);

    return () => clearInterval(interval);
  }, [fetchStatus, fetchStats, fetchHistory]);

  const handleStart = async () => {
    setLoading(true);
    try {
      await fetch('http://localhost:3001/api/startup/start', { method: 'POST' });
      await fetchStatus();
    } catch (err) {
      console.error('Failed to start:', err);
    }
    setLoading(false);
  };

  const handleSuccess = async () => {
    setLoading(true);
    try {
      await fetch('http://localhost:3001/api/startup/success', { method: 'POST' });
      await Promise.all([fetchStatus(), fetchStats(), fetchHistory()]);
    } catch (err) {
      console.error('Failed to mark success:', err);
    }
    setLoading(false);
  };

  const handleFailure = async () => {
    setLoading(true);
    try {
      await fetch('http://localhost:3001/api/startup/failure?reason=manual', { method: 'POST' });
      await Promise.all([fetchStatus(), fetchStats(), fetchHistory()]);
    } catch (err) {
      console.error('Failed to mark failure:', err);
    }
    setLoading(false);
  };

  const handleReset = async () => {
    setLoading(true);
    try {
      await fetch('http://localhost:3001/api/startup/reset', { method: 'POST' });
      await Promise.all([fetchStatus(), fetchStats(), fetchHistory()]);
    } catch (err) {
      console.error('Failed to reset:', err);
    }
    setLoading(false);
  };

  const statusColor = {
    'NotStarted': '#8E8E93',
    'Starting': '#FF9500',
    'Started': '#34C759',
    'Failed': '#FF3B30'
  }[status?.status || 'NotStarted'];

  const statusText = {
    'NotStarted': '未启动',
    'Starting': '启动中...',
    'Started': '启动成功',
    'Failed': '启动失败'
  }[status?.status || 'NotStarted'];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-extrabold tracking-tight text-[#1D1D1F]">Claude 启动监测</h2>
          <p className="text-[#8E8E93] mt-1">监控 Claude Code CLI 的启动状态和性能</p>
        </div>
        <div className="flex gap-2">
          {status?.status === 'NotStarted' && (
            <button
              onClick={handleStart}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-[#007AFF] text-white rounded-lg hover:bg-[#0051D5] transition-colors disabled:opacity-50"
            >
              <Play size={16} /> 开始启动
            </button>
          )}
          {status?.status === 'Starting' && (
            <>
              <button
                onClick={handleSuccess}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-[#34C759] text-white rounded-lg hover:bg-[#28A745] transition-colors disabled:opacity-50"
              >
                <CheckCircle size={16} /> 标记成功
              </button>
              <button
                onClick={handleFailure}
                disabled={loading}
                className="flex items-center gap-2 px-4 py-2 bg-[#FF3B30] text-white rounded-lg hover:bg-[#D63029] transition-colors disabled:opacity-50"
              >
                <XCircle size={16} /> 标记失败
              </button>
            </>
          )}
          {status?.status !== 'NotStarted' && status?.status !== 'Starting' && (
            <button
              onClick={handleReset}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 bg-[#8E8E93] text-white rounded-lg hover:bg-[#6E6E73] transition-colors disabled:opacity-50"
            >
              <RotateCcw size={16} /> 重置
            </button>
          )}
        </div>
      </div>

      {/* Status Card */}
      <div className="bg-white rounded-xl shadow-sm border border-[#E5E5EA] p-6">
        <div className="flex items-center gap-4 mb-4">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: statusColor }}
          />
          <span className="text-lg font-bold" style={{ color: statusColor }}>
            {statusText}
          </span>
          {status?.status === 'Starting' && (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#FF9500]" />
          )}
        </div>

        {status?.durationMs !== null && status?.durationMs !== undefined && (
          <div className="flex items-center gap-2 text-[#8E8E93]">
            <Clock size={16} />
            <span className="font-mono">
              耗时: {(status.durationMs / 1000).toFixed(2)}s
            </span>
          </div>
        )}

        {status?.failureReason && (
          <div className="mt-2 text-[#FF3B30] text-sm">
            失败原因: {status.failureReason}
          </div>
        )}

        {status?.startTime && (
          <div className="mt-4 text-xs text-[#8E8E93]">
            开始时间: {new Date(status.startTime).toLocaleString()}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-[#E5E5EA]">
        {(['status', 'history', 'stats'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-bold uppercase tracking-wider transition-colors ${
              activeTab === tab
                ? 'text-[#007AFF] border-b-2 border-[#007AFF]'
                : 'text-[#8E8E93] hover:text-[#1D1D1F]'
            }`}
          >
            {tab === 'status' ? '状态详情' : tab === 'history' ? '历史记录' : '统计分析'}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.2 }}
        >
          {activeTab === 'history' && (
            <div className="bg-white rounded-xl shadow-sm border border-[#E5E5EA] p-6">
              <h3 className="text-lg font-bold mb-4">启动历史</h3>
              {history.length === 0 ? (
                <p className="text-[#8E8E93] text-center py-8">暂无启动记录</p>
              ) : (
                <div className="space-y-2">
                  {history.map((record, index) => (
                    <div
                      key={record.id}
                      className="flex items-center justify-between p-3 bg-[#F9F9FB] rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        {record.success ? (
                          <CheckCircle size={16} className="text-[#34C759]" />
                        ) : (
                          <XCircle size={16} className="text-[#FF3B30]" />
                        )}
                        <span className="text-sm font-medium">
                          {record.success ? '启动成功' : '启动失败'}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-[#8E8E93]">
                        <span>{(record.durationMs / 1000).toFixed(2)}s</span>
                        <span>{new Date(record.completedAt).toLocaleString()}</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {activeTab === 'stats' && stats && (
            <div className="grid grid-cols-2 gap-6">
              <div className="bg-white rounded-xl shadow-sm border border-[#E5E5EA] p-6">
                <h3 className="text-sm font-bold text-[#8E8E93] uppercase tracking-widest mb-4">启动统计</h3>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-[#8E8E93]">总次数</span>
                    <span className="font-mono font-bold">{stats.totalCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-[#8E8E93]">成功</span>
                    <span className="font-mono font-bold text-[#34C759]">{stats.successCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-[#8E8E93]">失败</span>
                    <span className="font-mono font-bold text-[#FF3B30]">{stats.failureCount}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-[#8E8E93]">平均耗时</span>
                    <span className="font-mono font-bold">{(stats.averageMs / 1000).toFixed(2)}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-[#8E8E93]">最快</span>
                    <span className="font-mono font-bold text-[#34C759]">{(stats.minMs / 1000).toFixed(2)}s</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-[#8E8E93]">最慢</span>
                    <span className="font-mono font-bold text-[#FF9500]">{(stats.maxMs / 1000).toFixed(2)}s</span>
                  </div>
                </div>
              </div>

              <div className="bg-white rounded-xl shadow-sm border border-[#E5E5EA] p-6">
                <h3 className="text-sm font-bold text-[#8E8E93] uppercase tracking-widest mb-4">耗时分布</h3>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={history.slice(0, 10).reverse().map((r, i) => ({
                      name: `#${history.length - i}`,
                      duration: r.durationMs / 1000
                    }))}>
                      <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                      <YAxis tick={{ fontSize: 10 }} label={{ value: '秒', angle: -90, position: 'insideLeft' }} />
                      <Tooltip />
                      <Bar dataKey="duration" fill="#007AFF" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};
