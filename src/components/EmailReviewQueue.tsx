'use client';

import { useState } from 'react';
import { X, CheckCircle, XCircle, Edit3, Send, Loader2, ChevronDown, ChevronUp, Wand2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface EmailPreview {
  prospect: {
    id: string;
    name: string;
    email?: string;
    company?: string;
    title?: string;
  };
  email: {
    subject: string;
    body: string;
  };
  sequenceStep: number;
  approved: boolean;
  edited: boolean;
  error?: string;
}

interface EmailReviewQueueProps {
  prospectIds: string[];
  sequenceStep: number;
  campaignId: string;
  onClose: () => void;
  onSent: (count: number) => void;
}

export default function EmailReviewQueue({ prospectIds, sequenceStep, campaignId, onClose, onSent }: EmailReviewQueueProps) {
  const [loading, setLoading] = useState(false);
  const [previews, setPreviews] = useState<EmailPreview[] | null>(null);
  const [sending, setSending] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<{ subject: string; body: string }>({ subject: '', body: '' });

  const generatePreviews = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/email/preview', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospectIds, sequenceStep }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      setPreviews(data.previews.map((p: EmailPreview) => ({ ...p, approved: !p.error })));
      if (data.previews.length > 0) setExpandedId(data.previews[0].prospect.id);
    } catch {
      toast.error('Preview generation failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleApproval = (id: string) => {
    setPreviews((prev) => prev?.map((p) =>
      p.prospect.id === id ? { ...p, approved: !p.approved } : p
    ) ?? null);
  };

  const startEdit = (preview: EmailPreview) => {
    setEditingId(preview.prospect.id);
    setEditValues({ subject: preview.email.subject, body: preview.email.body });
  };

  const saveEdit = (id: string) => {
    setPreviews((prev) => prev?.map((p) =>
      p.prospect.id === id
        ? { ...p, email: { subject: editValues.subject, body: editValues.body }, edited: true }
        : p
    ) ?? null);
    setEditingId(null);
  };

  const sendApproved = async () => {
    const approved = previews?.filter((p) => p.approved && !p.error) ?? [];
    if (approved.length === 0) { toast.error('No approved emails'); return; }

    setSending(true);
    const toastId = toast.loading(`Generating + sending ${approved.length} emails...`);
    let sent = 0;

    try {
      for (const preview of approved) {
        // Generate (saving draft) then send
        const genRes = await fetch('/api/email/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prospectId: preview.prospect.id, sequenceStep, saveAsDraft: true }),
        });
        const genData = await genRes.json();
        if (genData.error || !genData.savedId) continue;

        const sendRes = await fetch('/api/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ emailId: genData.savedId }),
        });
        const sendData = await sendRes.json();
        if (!sendData.error) sent++;

        await new Promise((r) => setTimeout(r, 200)); // rate limit
      }

      toast.dismiss(toastId);
      toast.success(`Sent ${sent} emails`);
      onSent(sent);
      onClose();
    } catch {
      toast.dismiss(toastId);
      toast.error('Send failed');
    } finally {
      setSending(false);
    }
  };

  const approvedCount = previews?.filter((p) => p.approved && !p.error).length ?? 0;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Email Review Queue</h2>
            <p className="text-xs text-gray-400 mt-0.5">
              {previews
                ? `${approvedCount} approved · ${(previews.length - approvedCount)} skipped`
                : `Generating emails for ${prospectIds.length} prospects — review before sending`}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!previews && !loading && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 bg-green-50 rounded-2xl flex items-center justify-center mb-4">
                <Wand2 size={22} className="text-green-500" />
              </div>
              <p className="text-sm text-gray-600 mb-1">Claude will write a personalized email for each of the <strong>{prospectIds.length}</strong> selected prospects</p>
              <p className="text-xs text-gray-400 mb-6">You can edit or skip any email before they go out</p>
              <button onClick={generatePreviews} className="bg-[#1E4033] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#245240] transition-colors">
                Generate Previews
              </button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
              <Loader2 size={28} className="animate-spin text-green-500" />
              <p className="text-sm">Claude is writing {prospectIds.length} personalized emails...</p>
            </div>
          )}

          {previews && (
            <div className="space-y-2">
              {/* Bulk controls */}
              <div className="flex items-center gap-3 mb-4 pb-3 border-b border-gray-100">
                <button onClick={() => setPreviews(previews.map((p) => ({ ...p, approved: !p.error })))}
                  className="text-xs text-green-600 hover:text-green-800">Approve all</button>
                <button onClick={() => setPreviews(previews.map((p) => ({ ...p, approved: false })))}
                  className="text-xs text-gray-400 hover:text-gray-600">Skip all</button>
                <span className="ml-auto text-xs text-gray-400">{approvedCount} / {previews.length} approved</span>
              </div>

              {previews.map((preview) => {
                const isExpanded = expandedId === preview.prospect.id;
                const isEditing = editingId === preview.prospect.id;

                return (
                  <div key={preview.prospect.id} className={`rounded-xl border transition-all ${
                    preview.error ? 'border-red-100 bg-red-50' :
                    preview.approved ? 'border-green-200 bg-green-50/30' :
                    'border-gray-100 bg-white'
                  }`}>
                    {/* Row header */}
                    <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : preview.prospect.id)}>
                      {/* Approve toggle */}
                      <button
                        onClick={(e) => { e.stopPropagation(); if (!preview.error) toggleApproval(preview.prospect.id); }}
                        className={`shrink-0 transition-colors ${preview.approved ? 'text-green-500' : 'text-gray-300'}`}
                      >
                        {preview.approved ? <CheckCircle size={18} /> : <XCircle size={18} />}
                      </button>

                      {/* Name + subject */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{preview.prospect.name}</div>
                        {preview.error
                          ? <div className="text-xs text-red-500">{preview.error}</div>
                          : <div className="text-xs text-gray-400 truncate">{preview.email.subject}</div>
                        }
                      </div>

                      {/* Badges */}
                      <div className="flex items-center gap-2 shrink-0">
                        {preview.edited && <span className="text-xs bg-blue-50 text-blue-500 px-1.5 py-0.5 rounded-full">edited</span>}
                        {!preview.error && (
                          <button onClick={(e) => { e.stopPropagation(); startEdit(preview); }}
                            className="text-gray-300 hover:text-blue-500 transition-colors">
                            <Edit3 size={13} />
                          </button>
                        )}
                        {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                      </div>
                    </div>

                    {/* Expanded email */}
                    {isExpanded && !preview.error && (
                      <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                        {isEditing ? (
                          <div className="space-y-2">
                            <input
                              value={editValues.subject}
                              onChange={(e) => setEditValues({ ...editValues, subject: e.target.value })}
                              className="w-full border border-blue-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400"
                              placeholder="Subject line"
                            />
                            <textarea
                              value={editValues.body}
                              onChange={(e) => setEditValues({ ...editValues, body: e.target.value })}
                              rows={8}
                              className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400"
                            />
                            <div className="flex gap-2">
                              <button onClick={() => setEditingId(null)} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500">Cancel</button>
                              <button onClick={() => saveEdit(preview.prospect.id)} className="text-xs px-3 py-1.5 bg-blue-500 text-white rounded-lg hover:bg-blue-600">Save edits</button>
                            </div>
                          </div>
                        ) : (
                          <>
                            <div className="text-xs text-gray-400 mb-1">To: {preview.prospect.email ?? 'no email'}</div>
                            <div className="text-xs font-medium text-gray-700 mb-2">Subject: {preview.email.subject}</div>
                            <div className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{preview.email.body}</div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {previews && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
            <p className="text-sm text-gray-500"><strong className="text-gray-900">{approvedCount}</strong> emails ready to send</p>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50">Cancel</button>
              <button
                onClick={sendApproved}
                disabled={sending || approvedCount === 0}
                className="flex items-center gap-2 bg-[#1E4033] text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-[#245240] disabled:opacity-40 transition-colors"
              >
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                Send {approvedCount} emails
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
