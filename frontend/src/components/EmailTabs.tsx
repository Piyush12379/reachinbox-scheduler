import React from 'react';
import { Mail, Clock, CheckCircle2, Search, Plus, RefreshCw } from 'lucide-react';

interface EmailTabsProps {
  activeTab: 'scheduled' | 'sent';
  onTabChange: (tab: 'scheduled' | 'sent') => void;
  scheduledCount: number;
  sentCount: number;
  searchQuery: string;
  onSearchChange: (q: string) => void;
  onComposeClick: () => void;
  onRefresh: () => void;
  isRefreshing: boolean;
}

export const EmailTabs: React.FC<EmailTabsProps> = ({
  activeTab,
  onTabChange,
  scheduledCount,
  sentCount,
  searchQuery,
  onSearchChange,
  onComposeClick,
  onRefresh,
  isRefreshing,
}) => {
  return (
    <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
      {/* Tab Switcher */}
      <div className="flex items-center space-x-1.5 bg-[#141824] p-1 rounded-xl border border-[#222838]">
        <button
          onClick={() => onTabChange('scheduled')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab === 'scheduled'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-[#1A2030]'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>Scheduled Emails</span>
          <span
            className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === 'scheduled' ? 'bg-white/20 text-white' : 'bg-[#222838] text-slate-400'
            }`}
          >
            {scheduledCount}
          </span>
        </button>

        <button
          onClick={() => onTabChange('sent')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-xs font-semibold transition ${
            activeTab === 'sent'
              ? 'bg-indigo-600 text-white shadow-md shadow-indigo-600/30'
              : 'text-slate-400 hover:text-white hover:bg-[#1A2030]'
          }`}
        >
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Sent Emails</span>
          <span
            className={`ml-1 px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
              activeTab === 'sent' ? 'bg-white/20 text-white' : 'bg-[#222838] text-slate-400'
            }`}
          >
            {sentCount}
          </span>
        </button>
      </div>

      {/* Right Controls: Search + Refresh + Compose */}
      <div className="flex items-center space-x-3 w-full md:w-auto">
        {/* Search Bar */}
        <div className="relative flex-1 md:w-72">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder="Search leads, subject, body..."
            className="w-full bg-[#141824] border border-[#222838] focus:border-indigo-500 focus:outline-none pl-9 pr-3 py-2 rounded-xl text-xs text-white placeholder-slate-500 transition"
          />
          {searchQuery && (
            <button
              onClick={() => onSearchChange('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-500 hover:text-white"
            >
              ×
            </button>
          )}
        </div>

        {/* Refresh button */}
        <button
          onClick={onRefresh}
          disabled={isRefreshing}
          title="Refresh Queue"
          className="p-2 bg-[#141824] hover:bg-[#1C2233] border border-[#222838] text-slate-300 hover:text-white rounded-xl transition"
        >
          <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin text-indigo-400' : ''}`} />
        </button>

        {/* Compose Button */}
        <button
          onClick={onComposeClick}
          className="flex items-center space-x-2 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white px-4 py-2 rounded-xl text-xs font-semibold shadow-lg shadow-indigo-600/25 transition active:scale-95 whitespace-nowrap"
        >
          <Plus className="w-4 h-4" />
          <span>Compose New Email</span>
        </button>
      </div>
    </div>
  );
};
