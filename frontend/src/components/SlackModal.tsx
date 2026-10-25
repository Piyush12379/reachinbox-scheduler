import React, { useState, useEffect } from 'react';
import { api } from '../services/api';
import { SlackStatus } from '../types';
import { X, Slack, CheckCircle2, AlertCircle, Send, BellRing } from 'lucide-react';

interface SlackModalProps {
  isOpen: boolean;
  onClose: () => void;
  status: SlackStatus | null;
  onStatusUpdated: () => void;
}

export const SlackModal: React.FC<SlackModalProps> = ({
  isOpen,
  onClose,
  status,
  onStatusUpdated,
}) => {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [channel, setChannel] = useState('#reachinbox-alerts');
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (status?.webhookUrlMasked) {
      setWebhookUrl(status.webhookUrlMasked);
    }
    if (status?.channel) {
      setChannel(status.channel);
    }
  }, [status]);

  if (!isOpen) return null;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!webhookUrl.startsWith('https://hooks.slack.com/')) {
      setMessage({
        type: 'error',
        text: 'Please provide a valid Slack Incoming Webhook URL starting with https://hooks.slack.com/',
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.connectSlack(webhookUrl, channel);
      setMessage({ type: 'success', text: res.message || 'Slack connected successfully!' });
      onStatusUpdated();
    } catch (err: any) {
      setMessage({
        type: 'error',
        text: err.response?.data?.error || 'Failed to connect Slack.',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleDisconnect = async () => {
    setIsLoading(true);
    try {
      await api.disconnectSlack();
      setWebhookUrl('');
      setMessage({ type: 'success', text: 'Slack disconnected.' });
      onStatusUpdated();
    } catch (err: any) {
      setMessage({ type: 'error', text: 'Failed to disconnect.' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleTestAlert = async () => {
    setIsTesting(true);
    setMessage(null);
    try {
      const res = await api.testSlackAlert();
      if (res.sent) {
        setMessage({
          type: 'success',
          text: '🚀 Live Rate Limit Alert dispatched to your Slack channel!',
        });
      } else {
        setMessage({
          type: 'error',
          text: res.message || 'Notification could not be dispatched.',
        });
      }
    } catch (err: any) {
      setMessage({ type: 'error', text: err.response?.data?.error || 'Test failed.' });
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#121520] border border-[#222838] w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#222838] flex items-center justify-between bg-[#151926]">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 rounded-xl bg-[#E01E5A]/10 text-[#E01E5A]">
              <Slack className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Slack Notifications Integration</h2>
              <p className="text-[11px] text-slate-400">Live webhook alert on hourly rate limit exceed</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#202636] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs">
          {message && (
            <div
              className={`flex items-center space-x-2 px-3.5 py-2.5 rounded-xl border ${
                message.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : 'bg-rose-500/10 border-rose-500/30 text-rose-300'
              }`}
            >
              {message.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          <div className="bg-[#161B29] p-3.5 rounded-xl border border-[#262C3E] text-slate-300 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-white">Connection Status</span>
              {status?.isConnected ? (
                <span className="flex items-center text-emerald-400 font-bold bg-emerald-500/10 px-2.5 py-0.5 rounded-full border border-emerald-500/20 text-[11px]">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse" />
                  Connected
                </span>
              ) : (
                <span className="flex items-center text-slate-400 bg-slate-500/10 px-2.5 py-0.5 rounded-full border border-slate-500/20 text-[11px]">
                  Not Connected
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400">
              When a sender reaches their configured hourly threshold, a verified alert is immediately dispatched to your Slack workspace with rescheduled window details.
            </p>
          </div>

          <form onSubmit={handleConnect} className="space-y-3.5">
            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Slack Incoming Webhook URL
              </label>
              <input
                type="url"
                value={webhookUrl}
                onChange={(e) => setWebhookUrl(e.target.value)}
                placeholder="https://hooks.slack.com/services/T00/B00/XXXX"
                className="w-full bg-[#161B29] border border-[#262C3E] focus:border-indigo-500 focus:outline-none px-3 py-2 rounded-xl text-white font-mono text-[11px]"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-semibold mb-1">
                Channel Name
              </label>
              <input
                type="text"
                value={channel}
                onChange={(e) => setChannel(e.target.value)}
                placeholder="#reachinbox-alerts"
                className="w-full bg-[#161B29] border border-[#262C3E] focus:border-indigo-500 focus:outline-none px-3 py-2 rounded-xl text-white text-[11px]"
              />
            </div>

            <div className="pt-2 flex items-center justify-between">
              {status?.isConnected ? (
                <div className="flex items-center space-x-2">
                  <button
                    type="button"
                    onClick={handleTestAlert}
                    disabled={isTesting}
                    className="flex items-center space-x-1.5 bg-indigo-600/20 hover:bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 px-3 py-2 rounded-xl font-semibold transition"
                  >
                    <BellRing className="w-3.5 h-3.5" />
                    <span>{isTesting ? 'Sending...' : 'Trigger Test Alert'}</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleDisconnect}
                    disabled={isLoading}
                    className="text-rose-400 hover:text-rose-300 text-xs px-3 py-2 rounded-xl hover:bg-rose-500/10 transition"
                  >
                    Disconnect
                  </button>
                </div>
              ) : (
                <div />
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="flex items-center space-x-1.5 bg-[#E01E5A] hover:bg-[#c9184e] text-white px-4 py-2 rounded-xl font-semibold shadow-md transition ml-auto"
              >
                <Send className="w-3.5 h-3.5" />
                <span>{isLoading ? 'Verifying...' : status?.isConnected ? 'Update Webhook' : 'Connect Slack'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};
