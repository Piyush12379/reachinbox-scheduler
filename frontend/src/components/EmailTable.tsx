import React from 'react';
import { EmailItem } from '../types';
import { Mail, Clock, CheckCircle2, AlertTriangle, ExternalLink, Inbox, ShieldAlert } from 'lucide-react';

interface EmailTableProps {
  emails: EmailItem[];
  activeTab: 'scheduled' | 'sent';
  isLoading: boolean;
  onComposeClick: () => void;
}

export const EmailTable: React.FC<EmailTableProps> = ({
  emails,
  activeTab,
  isLoading,
  onComposeClick,
}) => {
  if (isLoading) {
    return (
      <div className="bg-[#141824] border border-[#222838] rounded-2xl p-6 overflow-hidden shadow-xl">
        <div className="space-y-4 animate-pulse">
          <div className="h-6 bg-[#1F2538] rounded-md w-1/4"></div>
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-12 bg-[#1A2030] rounded-xl w-full"></div>
          ))}
        </div>
      </div>
    );
  }

  if (emails.length === 0) {
    return (
      <div className="bg-[#141824] border border-[#222838] rounded-2xl p-12 text-center shadow-xl">
        <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400">
          <Inbox className="w-8 h-8" />
        </div>
        <h3 className="text-base font-semibold text-white mb-1">
          {activeTab === 'scheduled' ? 'No scheduled emails in queue' : 'No sent emails yet'}
        </h3>
        <p className="text-xs text-slate-400 max-w-sm mx-auto mb-6">
          {activeTab === 'scheduled'
            ? 'Compose outreach sequence with CSV leads and schedule jobs with guaranteed persistence and rate limiting.'
            : 'Once your scheduled jobs execute through the BullMQ worker, the delivery confirmation and Ethereal preview links will appear here.'}
        </p>
        <button
          onClick={onComposeClick}
          className="inline-flex items-center space-x-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-indigo-600/25 transition"
        >
          <Mail className="w-4 h-4" />
          <span>Schedule New Campaign</span>
        </button>
      </div>
    );
  }

  const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return '—';
    const d = new Date(dateStr);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'SENT':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Sent
          </span>
        );
      case 'SCHEDULED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3 mr-1" />
            Scheduled
          </span>
        );
      case 'PROCESSING':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20 animate-pulse">
            <Clock className="w-3 h-3 mr-1 animate-spin" />
            Processing
          </span>
        );
      case 'RESCHEDULED':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-violet-500/10 text-violet-300 border border-violet-500/20">
            <ShieldAlert className="w-3 h-3 mr-1 text-violet-400" />
            Rate-Limited (Delayed)
          </span>
        );
      case 'FAILED':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-rose-500/10 text-rose-400 border border-rose-500/20">
            <AlertTriangle className="w-3 h-3 mr-1" />
            Failed
          </span>
        );
    }
  };

  return (
    <div className="bg-[#141824] border border-[#222838] rounded-2xl overflow-hidden shadow-xl">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[#222838] bg-[#181D2C] text-[11px] uppercase tracking-wider text-slate-400 font-semibold">
              <th className="py-3 px-4">Recipient</th>
              <th className="py-3 px-4">Subject & Content</th>
              <th className="py-3 px-4">
                {activeTab === 'scheduled' ? 'Scheduled Time' : 'Sent Time'}
              </th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Action / Preview</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#1D2333] text-xs">
            {emails.map((email) => (
              <tr
                key={email.id}
                className="hover:bg-[#181D2C]/60 transition-colors group"
              >
                {/* Recipient */}
                <td className="py-3.5 px-4 font-medium text-white max-w-[200px]">
                  <div className="flex items-center space-x-2 truncate">
                    <span className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold text-xs shrink-0">
                      {email.recipient.charAt(0).toUpperCase()}
                    </span>
                    <span className="truncate" title={email.recipient}>
                      {email.recipient}
                    </span>
                  </div>
                </td>

                {/* Subject & Preview */}
                <td className="py-3.5 px-4 max-w-[280px]">
                  <div className="font-semibold text-slate-200 truncate" title={email.subject}>
                    {email.subject}
                  </div>
                  <div className="text-[11px] text-slate-500 truncate" title={email.body}>
                    {email.body}
                  </div>
                </td>

                {/* Time */}
                <td className="py-3.5 px-4 text-slate-300 whitespace-nowrap">
                  <div className="flex items-center space-x-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-500" />
                    <span>
                      {activeTab === 'scheduled'
                        ? formatDateTime(email.scheduledFor)
                        : formatDateTime(email.sentAt || email.updatedAt)}
                    </span>
                  </div>
                  {email.errorMessage && (
                    <div className="text-[10px] text-amber-400/90 mt-0.5 max-w-[180px] truncate" title={email.errorMessage}>
                      {email.errorMessage}
                    </div>
                  )}
                </td>

                {/* Status Badge */}
                <td className="py-3.5 px-4 whitespace-nowrap">
                  {getStatusBadge(email.status)}
                </td>

                {/* Action / Ethereal Preview */}
                <td className="py-3.5 px-4 text-right whitespace-nowrap">
                  {email.previewUrl ? (
                    <a
                      href={email.previewUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center space-x-1 text-[11px] font-medium text-indigo-400 hover:text-indigo-300 bg-indigo-500/10 hover:bg-indigo-500/20 px-2.5 py-1 rounded-lg border border-indigo-500/20 transition"
                    >
                      <span>View in Ethereal</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  ) : (
                    <span className="text-slate-600 text-[11px]">Queued</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
