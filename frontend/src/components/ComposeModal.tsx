import React, { useState, useRef } from 'react';
import { api } from '../services/api';
import { X, UploadCloud, FileText, CheckCircle2, Clock, Send, AlertCircle, Sparkles } from 'lucide-react';

interface ComposeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScheduledSuccess: () => void;
}

export const ComposeModal: React.FC<ComposeModalProps> = ({
  isOpen,
  onClose,
  onScheduledSuccess,
}) => {
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [recipientsText, setRecipientsText] = useState('');
  const [parsedLeads, setParsedLeads] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string | null>(null);

  // Scheduling options
  const [startTime, setStartTime] = useState<string>('');
  const [delaySeconds, setDelaySeconds] = useState<number>(2);
  const [hourlyLimit, setHourlyLimit] = useState<number>(20);

  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // Handle CSV file upload
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setFileName(file.name);

    try {
      const data = await api.parseCsv(file);
      setParsedLeads(data.emails);
      if (data.emails.length === 0) {
        setError('No valid email addresses found in the uploaded file.');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to parse CSV file.');
    } finally {
      setIsUploading(false);
    }
  };

  // Combine manual inputs and parsed CSV leads
  const getConsolidatedRecipients = (): string[] => {
    const manualList = recipientsText
      .split(/[,\n]/)
      .map((e) => e.trim().toLowerCase())
      .filter((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));

    const combined = Array.from(new Set([...manualList, ...parsedLeads]));
    return combined;
  };

  const totalLeadsCount = getConsolidatedRecipients().length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const leads = getConsolidatedRecipients();
    if (leads.length === 0) {
      setError('Please add at least one recipient lead (via CSV upload or manual text).');
      return;
    }

    if (!subject.trim()) {
      setError('Subject is required.');
      return;
    }

    if (!body.trim()) {
      setError('Email body is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await api.scheduleEmails({
        recipients: leads,
        subject,
        body,
        scheduledFor: startTime ? new Date(startTime).toISOString() : undefined,
        delayBetweenEmailsSeconds: delaySeconds,
        hourlyLimit,
      });

      onScheduledSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to schedule campaign.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInsertTemplate = () => {
    setSubject('Quick question regarding your outbound lead pipeline');
    setBody(`Hey there,\n\nI noticed your team is actively scaling sales development this quarter. At ReachInbox, we help automated teams dispatch 100k+ personalized emails with zero spam flagging and high deliverability.\n\nWould you be open to a 5-minute chat this Thursday?\n\nBest regards,\nReachInbox Growth Team`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#121520] border border-[#222838] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#222838] flex items-center justify-between bg-[#151926]">
          <div className="flex items-center space-x-2">
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white">Compose New Outreach Campaign</h2>
              <p className="text-[11px] text-slate-400">Configure delays, rate limits & upload CSV leads</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-[#202636] transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {error && (
            <div className="flex items-center space-x-2 bg-rose-500/10 border border-rose-500/30 text-rose-300 px-3.5 py-2.5 rounded-xl">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          {/* CSV File Upload Lead Detection */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5 flex items-center justify-between">
              <span>Recipient Leads (CSV or Manual)</span>
              {totalLeadsCount > 0 && (
                <span className="text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  {totalLeadsCount} lead{totalLeadsCount > 1 ? 's' : ''} detected
                </span>
              )}
            </label>

            <div
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-[#262C40] hover:border-indigo-500/50 bg-[#151926] hover:bg-[#181D2C] rounded-xl p-4 text-center cursor-pointer transition group"
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleFileUpload}
                className="hidden"
              />
              <UploadCloud className="w-7 h-7 mx-auto mb-1 text-slate-400 group-hover:text-indigo-400 transition" />
              <p className="text-slate-300 font-medium">
                {fileName ? (
                  <span className="text-indigo-400 flex items-center justify-center">
                    <FileText className="w-3.5 h-3.5 mr-1" /> {fileName}
                  </span>
                ) : (
                  'Click to upload CSV or TXT lead file'
                )}
              </p>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Automatically extracts and dedupes all email addresses
              </p>
            </div>

            {/* Manual fallback input */}
            <div className="mt-2.5">
              <textarea
                value={recipientsText}
                onChange={(e) => setRecipientsText(e.target.value)}
                placeholder="Or paste comma-separated emails here (e.g. john@acme.com, sarah@tech.io)"
                rows={2}
                className="w-full bg-[#151926] border border-[#222838] focus:border-indigo-500 focus:outline-none p-2.5 rounded-xl text-white placeholder-slate-500 font-mono text-[11px]"
              />
            </div>
          </div>

          {/* Subject & Quick Template */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-slate-300 font-semibold">Subject Line</label>
              <button
                type="button"
                onClick={handleInsertTemplate}
                className="text-[11px] text-indigo-400 hover:text-indigo-300 font-medium"
              >
                + Insert Sample Template
              </button>
            </div>
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="e.g. Scaling outbound leads at Outbox Labs"
              className="w-full bg-[#151926] border border-[#222838] focus:border-indigo-500 focus:outline-none px-3.5 py-2.5 rounded-xl text-white placeholder-slate-500"
            />
          </div>

          {/* Email Body */}
          <div>
            <label className="block text-slate-300 font-semibold mb-1.5">Email Body</label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              rows={4}
              placeholder="Write your email body or template here..."
              className="w-full bg-[#151926] border border-[#222838] focus:border-indigo-500 focus:outline-none p-3.5 rounded-xl text-white placeholder-slate-500 leading-relaxed font-sans"
            />
          </div>

          {/* Throttling, Delay & Hourly Limit Configuration */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5 p-3.5 bg-[#151926] rounded-xl border border-[#222838]">
            {/* Start Time */}
            <div>
              <label className="block text-slate-300 font-medium mb-1 flex items-center">
                <Clock className="w-3.5 h-3.5 mr-1 text-slate-400" /> Start Time
              </label>
              <input
                type="datetime-local"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full bg-[#10131C] border border-[#262C3E] focus:border-indigo-500 focus:outline-none px-2.5 py-1.5 rounded-lg text-white text-[11px]"
              />
              <span className="text-[10px] text-slate-500">Leave blank to start immediately</span>
            </div>

            {/* Delay between each email */}
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Delay Between Sends
              </label>
              <div className="flex items-center space-x-1.5">
                <input
                  type="number"
                  min="0"
                  max="60"
                  value={delaySeconds}
                  onChange={(e) => setDelaySeconds(Number(e.target.value))}
                  className="w-full bg-[#10131C] border border-[#262C3E] focus:border-indigo-500 focus:outline-none px-2.5 py-1.5 rounded-lg text-white font-mono"
                />
                <span className="text-slate-400 text-xs">sec</span>
              </div>
              <span className="text-[10px] text-slate-500">Throttling per worker</span>
            </div>

            {/* Hourly Rate Limit */}
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Hourly Limit
              </label>
              <div className="flex items-center space-x-1.5">
                <input
                  type="number"
                  min="1"
                  max="1000"
                  value={hourlyLimit}
                  onChange={(e) => setHourlyLimit(Number(e.target.value))}
                  className="w-full bg-[#10131C] border border-[#262C3E] focus:border-indigo-500 focus:outline-none px-2.5 py-1.5 rounded-lg text-white font-mono"
                />
                <span className="text-slate-400 text-xs">/hr</span>
              </div>
              <span className="text-[10px] text-slate-500">Redis sliding limit + Slack alert</span>
            </div>
          </div>
        </form>

        {/* Footer Actions */}
        <div className="px-6 py-3.5 border-t border-[#222838] bg-[#151926] flex items-center justify-between">
          <div className="text-[11px] text-slate-400">
            {totalLeadsCount > 0 ? (
              <span>Scheduling <strong className="text-white">{totalLeadsCount}</strong> jobs into BullMQ delayed queue</span>
            ) : (
              <span>Upload CSV or add leads to proceed</span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-slate-400 hover:text-white hover:bg-[#202636] font-medium transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || totalLeadsCount === 0}
              className="flex items-center space-x-1.5 bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 disabled:opacity-50 text-white px-5 py-2 rounded-xl font-semibold shadow-lg shadow-indigo-600/30 transition"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Scheduling...' : 'Schedule Campaign'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
