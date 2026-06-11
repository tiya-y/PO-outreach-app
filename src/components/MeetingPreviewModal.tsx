'use client';

import { useState } from 'react';
import { X, Loader2, Calendar, FileText, Mail, CheckCircle, User, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';

interface MeetingPreviewModalProps {
  prospectId: string;
  prospectName: string;
  prospectCompany?: string;
  onClose: () => void;
  onBooked: () => void;
}

export default function MeetingPreviewModal({ prospectId, prospectName, prospectCompany, onClose, onBooked }: MeetingPreviewModalProps) {
  const [step, setStep] = useState<'form' | 'preview' | 'confirmed'>('form');
  const [loading, setLoading] = useState(false);
  const [booking, setBooking] = useState(false);
  const [preview, setPreview] = useState<{
    meetingSubject: string;
    brief: string;
    invitePreview: string;
    emailHistory: Array<{ sequence_step: number; subject: string; sent_at: string; opened_at?: string }>;
    replyClassification?: string;
    prospect: { portfolioSize?: number; email?: string; city?: string };
  } | null>(null);
  const [form, setForm] = useState({ salesRepEmail: '', startTime: '' });

  const generatePreview = async () => {
    if (!form.salesRepEmail || !form.startTime) { toast.error('Fill in all fields'); return; }
    setLoading(true);
    try {
      const res = await fetch('/api/meetings/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospectId,
          salesRepEmail: form.salesRepEmail,
          startTime: new Date(form.startTime).toISOString(),
        }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      setPreview(data);
      setStep('preview');
    } catch {
      toast.error('Preview failed');
    } finally {
      setLoading(false);
    }
  };

  const confirmBooking = async () => {
    setBooking(true);
    const toastId = toast.loading('Booking on MS365...');
    try {
      const endTime = new Date(new Date(form.startTime).getTime() + 30 * 60000).toISOString();
      const res = await fetch('/api/meetings/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospectId,
          salesRepEmail: form.salesRepEmail,
          startTime: new Date(form.startTime).toISOString(),
          endTime,
          generateBrief: true,
        }),
      });
      const data = await res.json();
      toast.dismiss(toastId);
      if (data.error) { toast.error(data.error); return; }
      toast.success('Meeting booked! Brief generated.');
      setStep('confirmed');
      onBooked();
    } catch {
      toast.dismiss(toastId);
      toast.error('Booking failed');
    } finally {
      setBooking(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Book Meeting</h2>
            <p className="text-xs text-gray-400 mt-0.5">{prospectName} · {prospectCompany}</p>
          </div>
          <div className="flex items-center gap-3">
            {/* Step indicator */}
            {['form', 'preview', 'confirmed'].map((s, i) => (
              <div key={s} className={`flex items-center gap-1.5 text-xs font-medium ${step === s ? 'text-blue-600' : 'text-gray-300'}`}>
                <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${step === s ? 'bg-blue-500 text-white' : 'bg-gray-100 text-gray-400'}`}>{i + 1}</div>
                {s === 'form' ? 'Schedule' : s === 'preview' ? 'Review' : 'Done'}
              </div>
            ))}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-2"><X size={18} /></button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {/* Step 1: Form */}
          {step === 'form' && (
            <div className="space-y-4">
              <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl">
                <User size={16} className="text-gray-400" />
                <div>
                  <div className="text-sm font-medium text-gray-900">{prospectName}</div>
                  <div className="text-xs text-gray-400">{prospectCompany}</div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Sales Rep Email</label>
                <input type="email" value={form.salesRepEmail} onChange={(e) => setForm({ ...form, salesRepEmail: e.target.value })}
                  placeholder="rep@innago.com"
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                <p className="text-xs text-gray-400 mt-1">Must be connected to MS365 in Settings</p>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">Meeting Time</label>
                <input type="datetime-local" value={form.startTime} onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                  className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
              </div>

              <div className="bg-purple-50 rounded-xl p-4 text-xs text-purple-700">
                <strong>What happens next:</strong> Claude will generate a pre-call brief based on all email history and any replies. You'll review it before the meeting is booked.
              </div>
            </div>
          )}

          {/* Step 2: Preview */}
          {step === 'preview' && preview && (
            <div className="space-y-4">
              {/* Meeting card */}
              <div className="border border-blue-100 rounded-xl p-4 bg-blue-50/30">
                <div className="flex items-center gap-2 text-sm font-semibold text-gray-900 mb-1">
                  <Calendar size={14} className="text-blue-500" />
                  {preview.meetingSubject}
                </div>
                <div className="text-xs text-gray-500">
                  {form.startTime && format(new Date(form.startTime), 'MMM d, yyyy · h:mm a')} · 30 min · Teams
                </div>
                {preview.emailHistory.length > 0 && (
                  <div className="mt-2 text-xs text-gray-400">
                    {preview.emailHistory.length} emails sent ·{' '}
                    {preview.emailHistory.filter((e) => e.opened_at).length} opened ·{' '}
                    {preview.replyClassification && <span className="text-purple-600">Reply: {preview.replyClassification}</span>}
                  </div>
                )}
              </div>

              {/* Invite preview */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  <Mail size={11} /> Invite Preview
                </div>
                <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-700 whitespace-pre-line leading-relaxed border border-gray-100">
                  {preview.invitePreview}
                </div>
              </div>

              {/* Brief preview */}
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                  <FileText size={11} /> Pre-Call Brief Preview
                </div>
                <div className="bg-white rounded-xl p-4 text-xs text-gray-700 leading-relaxed border border-gray-100 max-h-52 overflow-y-auto prose prose-xs whitespace-pre-line">
                  {preview.brief}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Confirmed */}
          {step === 'confirmed' && (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mb-4">
                <CheckCircle size={26} className="text-green-500" />
              </div>
              <h3 className="text-base font-semibold text-gray-900 mb-1">Meeting Booked!</h3>
              <p className="text-sm text-gray-500 mb-1">Calendar invite sent to {prospectName} and {form.salesRepEmail}</p>
              <p className="text-xs text-gray-400">Brief is ready in the Meetings tab</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-between items-center px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl">
            {step === 'confirmed' ? 'Close' : 'Cancel'}
          </button>
          {step === 'form' && (
            <button onClick={generatePreview} disabled={loading}
              className="flex items-center gap-2 bg-[#3B1F5E] text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-[#4A2875] disabled:opacity-40">
              {loading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
              Preview Brief + Invite
            </button>
          )}
          {step === 'preview' && (
            <button onClick={confirmBooking} disabled={booking}
              className="flex items-center gap-2 bg-[#3B1F5E] text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-[#4A2875] disabled:opacity-40">
              {booking ? <Loader2 size={14} className="animate-spin" /> : <Calendar size={14} />}
              Confirm & Book on MS365
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
