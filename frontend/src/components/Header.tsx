import React from 'react';
import { User, QueueMetrics, SlackStatus } from '../types';
import { ExternalLink, Slack, LogOut, CheckCircle2, Clock, PlayCircle, AlertTriangle } from 'lucide-react';

interface HeaderProps {
  user: User;
  metrics: QueueMetrics | null;
  slackStatus: SlackStatus | null;
  onOpenSlackModal: () => void;
  onLogout: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  user,
  metrics,
  slackStatus,
  onOpenSlackModal,
  onLogout,
}) => {
  return (
    <header className="border-b border-[#222736] bg-[#12151E] sticky top-0 z-30 px-6 py-3.5 flex items-center justify-between shadow-lg">
      {/* Left: Brand Logo & Title */}
      <div className="flex items-center space-x-3">
        <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center shadow-indigo-500/20 shadow-md">
          <span className="text-white font-bold text-lg">R</span>
        </div>
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="font-bold text-white text-base tracking-tight">ReachInbox</h1>
            <span className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-indigo-500/10 text-indigo-400 border border-indigo-500/20">
              Scheduler Pro
            </span>
          </div>
          <p className="text-xs text-slate-400">Outbox Labs Job Dispatcher</p>
        </div>
      </div>

      {/* Center: Live BullMQ Queue Metrics & Dashboard Link */}
      <div className="hidden md:flex items-center space-x-3 bg-[#181C28] px-3.5 py-1.5 rounded-xl border border-[#262C3E]">
        <div className="flex items-center space-x-2 text-xs">
          <span className="flex items-center text-emerald-400 font-medium">
            <CheckCircle2 className="w-3.5 h-3.5 mr-1 text-emerald-400" />
            {metrics?.bullmq.completed ?? 0} Sent
          </span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center text-amber-400 font-medium">
            <Clock className="w-3.5 h-3.5 mr-1 text-amber-400" />
            {metrics?.bullmq.delayed ?? 0} Delayed
          </span>
          <span className="text-slate-600">|</span>
          <span className="flex items-center text-blue-400 font-medium">
            <PlayCircle className="w-3.5 h-3.5 mr-1 text-blue-400" />
            {metrics?.bullmq.active ?? 0} Active
          </span>
          {metrics && metrics.bullmq.failed > 0 && (
            <>
              <span className="text-slate-600">|</span>
              <span className="flex items-center text-rose-400 font-medium">
                <AlertTriangle className="w-3.5 h-3.5 mr-1 text-rose-400" />
                {metrics.bullmq.failed} Failed
              </span>
            </>
          )}
        </div>

        <a
          href="http://localhost:5000/admin/queues"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 flex items-center bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-1 rounded-md transition border border-indigo-500/20"
        >
          BullMQ Board <ExternalLink className="w-3 h-3 ml-1" />
        </a>
      </div>

      {/* Right: Slack Connect + User Profile */}
      <div className="flex items-center space-x-3">
        {/* Slack Connect Button */}
        <button
          onClick={onOpenSlackModal}
          className={`flex items-center space-x-1.5 text-xs px-3 py-1.5 rounded-lg border transition ${
            slackStatus?.isConnected
              ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300 hover:bg-emerald-500/20'
              : 'bg-[#181C28] border-[#2A3144] text-slate-300 hover:bg-[#202636]'
          }`}
          title="Configure Slack notifications for rate limit alerts"
        >
          <Slack className="w-3.5 h-3.5 text-[#E01E5A]" />
          <span>{slackStatus?.isConnected ? 'Slack Connected' : 'Connect Slack'}</span>
          <span
            className={`w-2 h-2 rounded-full ${
              slackStatus?.isConnected ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'
            }`}
          />
        </button>

        {/* User Profile Pill */}
        <div className="flex items-center space-x-3 bg-[#181C28] pl-2 pr-3 py-1 rounded-xl border border-[#262C3E]">
          <img
            src={user.avatar}
            alt={user.name}
            className="w-7 h-7 rounded-full object-cover border border-indigo-500/40"
          />
          <div className="text-left hidden sm:block">
            <p className="text-xs font-semibold text-white leading-tight">{user.name}</p>
            <p className="text-[10px] text-slate-400 leading-tight truncate max-w-[120px]">{user.email}</p>
          </div>
          <button
            onClick={onLogout}
            title="Logout"
            className="text-slate-400 hover:text-rose-400 p-1 hover:bg-[#222838] rounded-md transition"
          >
            <LogOut className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </header>
  );
};
