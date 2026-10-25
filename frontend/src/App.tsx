import React, { useState, useEffect, useCallback } from 'react';
import { api } from './services/api';
import { EmailItem, QueueMetrics, SlackStatus, User } from './types';
import { Header } from './components/Header';
import { EmailTabs } from './components/EmailTabs';
import { EmailTable } from './components/EmailTable';
import { ComposeModal } from './components/ComposeModal';
import { SlackModal } from './components/SlackModal';
import { LoginModal } from './components/LoginModal';
import { Zap, Clock, ShieldCheck, Mail, Sparkles, AlertCircle } from 'lucide-react';

export const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(() => {
    const saved = localStorage.getItem('reachinbox_user');
    return saved ? JSON.parse(saved) : null;
  });

  const [activeTab, setActiveTab] = useState<'scheduled' | 'sent'>('scheduled');
  const [scheduledEmails, setScheduledEmails] = useState<EmailItem[]>([]);
  const [sentEmails, setSentEmails] = useState<EmailItem[]>([]);
  const [metrics, setMetrics] = useState<QueueMetrics | null>(null);
  const [slackStatus, setSlackStatus] = useState<SlackStatus | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<EmailItem[] | null>(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isComposeOpen, setIsComposeOpen] = useState(false);
  const [isSlackOpen, setIsSlackOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 4000);
  };

  // Fetch emails and stats
  const fetchData = useCallback(async (quiet = false) => {
    if (!quiet) setIsRefreshing(true);
    try {
      const [scheduledRes, sentRes, metricsRes, slackRes] = await Promise.all([
        api.getScheduledEmails(),
        api.getSentEmails(),
        api.getQueueMetrics(),
        api.getSlackStatus(),
      ]);

      setScheduledEmails(scheduledRes.emails || []);
      setSentEmails(sentRes.emails || []);
      setMetrics(metricsRes);
      setSlackStatus(slackRes);
    } catch (err: any) {
      console.error('Fetch error:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  // Search handler with debounce
  useEffect(() => {
    if (!searchQuery.trim()) {
      setSearchResults(null);
      return;
    }

    const timer = setTimeout(async () => {
      try {
        const res = await api.searchEmails(
          searchQuery,
          activeTab === 'scheduled' ? 'SCHEDULED' : undefined
        );
        setSearchResults(res.results || []);
      } catch (err) {
        console.error('Search error:', err);
      }
    }, 250);

    return () => clearTimeout(timer);
  }, [searchQuery, activeTab]);

  // Initial load & Polling
  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData(true);
    }, 3000); // Poll every 3 seconds for live BullMQ queue updates

    return () => clearInterval(interval);
  }, [fetchData]);

  const handleLogin = (newUser: User) => {
    setUser(newUser);
    localStorage.setItem('reachinbox_user', JSON.stringify(newUser));
    showToast(`Welcome back, ${newUser.name}!`);
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('reachinbox_user');
  };

  if (!user) {
    return <LoginModal onLoginSuccess={handleLogin} />;
  }

  const displayedEmails = searchResults !== null
    ? searchResults
    : activeTab === 'scheduled'
    ? scheduledEmails
    : sentEmails;

  return (
    <div className="min-h-screen bg-[#0E111A] text-slate-100 flex flex-col font-sans">
      {/* Toast notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 bg-indigo-600 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-2xl flex items-center space-x-2 animate-in slide-in-from-bottom-5">
          <Sparkles className="w-4 h-4" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header */}
      <Header
        user={user}
        metrics={metrics}
        slackStatus={slackStatus}
        onOpenSlackModal={() => setIsSlackOpen(true)}
        onLogout={handleLogout}
      />

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Banner: Key Architectural Guarantees */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-[#141824] border border-[#222838] p-4 rounded-2xl flex items-center space-x-3 shadow-md">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center shrink-0">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">BullMQ Delayed Jobs</h4>
              <p className="text-[11px] text-slate-400">Zero-cron scheduling backed by Redis delayed set</p>
            </div>
          </div>

          <div className="bg-[#141824] border border-[#222838] p-4 rounded-2xl flex items-center space-x-3 shadow-md">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Restart Persistence</h4>
              <p className="text-[11px] text-slate-400">Pending jobs survive crashes & resume without duplication</p>
            </div>
          </div>

          <div className="bg-[#141824] border border-[#222838] p-4 rounded-2xl flex items-center space-x-3 shadow-md">
            <div className="w-10 h-10 rounded-xl bg-violet-500/10 text-violet-400 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-white">Redis Hourly Rate Limiting</h4>
              <p className="text-[11px] text-slate-400">Exceed limit auto-reschedules & sends live Slack alerts</p>
            </div>
          </div>
        </div>

        {/* Tabs & Controls */}
        <EmailTabs
          activeTab={activeTab}
          onTabChange={(tab) => {
            setActiveTab(tab);
            setSearchQuery('');
            setSearchResults(null);
          }}
          scheduledCount={scheduledEmails.length}
          sentCount={sentEmails.length}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onComposeClick={() => setIsComposeOpen(true)}
          onRefresh={() => fetchData(false)}
          isRefreshing={isRefreshing}
        />

        {/* Data Table */}
        <EmailTable
          emails={displayedEmails}
          activeTab={activeTab}
          isLoading={isLoading}
          onComposeClick={() => setIsComposeOpen(true)}
        />
      </main>

      {/* Compose Outreach Modal */}
      <ComposeModal
        isOpen={isComposeOpen}
        onClose={() => setIsComposeOpen(false)}
        onScheduledSuccess={() => {
          fetchData();
          showToast('Emails scheduled successfully into BullMQ queue!');
        }}
      />

      {/* Slack Integration Modal */}
      <SlackModal
        isOpen={isSlackOpen}
        onClose={() => setIsSlackOpen(false)}
        status={slackStatus}
        onStatusUpdated={() => {
          fetchData(true);
          showToast('Slack integration updated successfully!');
        }}
      />

      {/* Footer */}
      <footer className="border-t border-[#1C2233] py-4 text-center text-xs text-slate-500">
        ReachInbox Full-Stack Email Job Scheduler • Evaluated for Outbox Labs SDE Internship • LPU Placement Drive
      </footer>
    </div>
  );
};
export default App;
