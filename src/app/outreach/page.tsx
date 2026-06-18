'use client';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import {
  Mail, MessageSquare, Send, CheckCircle, Clock, Loader2,
  ChevronDown, ChevronUp, Edit3, X, RefreshCw, Inbox,
  AlertCircle, ThumbsUp, ThumbsDown, HelpCircle, Calendar,
  Zap
} from 'lucide-react';
import type { OutreachEmail, Reply, Prospect } from '@/types';

// ── Extended types with joins ─────────────────────────────────────────────────

type DraftEmail = OutreachEmail & {
  prospects: Pick<Prospect, 'first_name' | 'last_name' | 'email' | 'company'> | null;
  campaigns: { name: string; city: string; state: string } | null;
};

type InboundReply = Reply & {
  prospects: Pick<Prospect, 'first_name' | 'last_name' | 'email' | 'company' | 'campaign_id'> | null;
};

type SentEmail = OutreachEmail & {
  prospects: Pick<Prospect, 'first_name' | 'last_name' | 'email' | 'company'> | null;
  campaigns: { name: string } | null;
};

type Tab = 'drafts' | 'replies' | 'sent';

const CLASSIFICATION_META: Record<string, { label: string; color: string; icon: React.ReactNode }> = {
  interested:       { label: 'Interested',       color: 'bg-green-100 text-green-700 border-green-200',  icon: <ThumbsUp size={11} /> },
  meeting_request:  { label: 'Wants meeting',    color: 'bg-blue-100 text-blue-700 border-blue-200',    icon: <Calendar size={11} /> },
  more_info:        { label: 'Wants more info',  color: 'bg-yellow-100 text-yellow-700 border-yellow-200', icon: <HelpCircle size={11} /> },
  not_interested:   { label: 'Not interested',   color: 'bg-red-100 text-red-600 border-red-200',       icon: <ThumbsDown size={11} /> },
  do_not_contact:   { label: 'Do not contact',   color: 'bg-red-200 text-red-800 border-red-300',       icon: <X size={11} /> },
  wrong_person:     { label: 'Wrong person',     color: 'bg-gray-100 text-gray-600 border-gray-200',    icon: <AlertCircle size={11} /> },
  auto_reply:       { label: 'Auto-reply',       color: 'bg-gray-100 text-gray-500 border-gray-200',    icon: <Zap size={11} /> },
};

export default function OutreachPage() {
  const [tab, setTab] = useState<Tab>('drafts');
  const [drafts, setDrafts] = useState<DraftEmail[]>([]);
  const [replies, setReplies] = useState<InboundReply[]>([]);
  const [sent, setSent] = useState<SentEmail[]>([]);
  const [loading, setLoading] = useState(true);

  // Per-card state
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState<Record<string, string>>({});
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [editReplyBody, setEditReplyBody] = useState<Record<string, string>>({});
  const [selectedDrafts, setSelectedDrafts] = useState<Set<string>>(new Set());
  const [bulkSending, setBulkSending] = useState(false);
  const [ms365Connected, setMs365Connected] = useState<boolean | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: draftData }, { data: replyData }, { data: sentData }, { data: repData }] = await Promise.all([
      supabase.from('outreach_emails')
        .select('*, prospects(first_name, last_name, email, company), campaigns(name, city, state)')
        .eq('status', 'draft')
        .order('created_at', { ascending: false })
        .limit(100),
      supabase.from('replies')
        .select('*, prospects(first_name, last_name, email, company, campaign_id)')
        .eq('handled', false)
        .order('received_at', { ascending: false })
        .limit(100),
      supabase.from('outreach_emails')
        .select('*, prospects(first_name, last_name, email, company), campaigns(name)')
        .eq('status', 'sent')
        .order('sent_at', { ascending: false })
        .limit(50),
      supabase.from('sales_reps')
        .select('id')
        .eq('is_active', true)
        .not('ms365_access_token', 'is', null)
        .limit(1),
    ]);

    setDrafts((draftData as DraftEmail[]) ?? []);
    setReplies((replyData as InboundReply[]) ?? []);
    setSent((sentData as SentEmail[]) ?? []);
    setMs365Connected((repData?.length ?? 0) > 0);
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Draft actions ─────────────────────────────────────────────────────────

  const sendDraft = async (emailId: string) => {
    setSendingId(emailId);
    const body = editBody[emailId];
    try {
      const res = await fetch('/api/email/send-ms365', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId, ...(body ? { bodyOverride: body } : {}) }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      toast.success(`Sent via ${data.sentVia === 'ms365' ? 'Microsoft 365' : 'Brevo'} ✓`);
      setExpandedId(null);
      await loadData();
    } catch { toast.error('Send failed'); }
    finally { setSendingId(null); }
  };

  const discardDraft = async (emailId: string) => {
    if (!confirm('Delete this draft?')) return;
    await supabase.from('outreach_emails').delete().eq('id', emailId);
    toast.success('Draft deleted');
    await loadData();
  };

  const bulkApprove = async () => {
    if (!selectedDrafts.size) return;
    setBulkSending(true);
    try {
      const res = await fetch('/api/email/send-ms365', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailIds: Array.from(selectedDrafts) }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      toast.success(`Sent ${data.sent} emails${data.failed ? `, ${data.failed} failed` : ''}`);
      setSelectedDrafts(new Set());
      await loadData();
    } catch { toast.error('Bulk send failed'); }
    finally { setBulkSending(false); }
  };

  // ── Reply actions ─────────────────────────────────────────────────────────

  const sendReply = async (reply: InboundReply) => {
    const body = editReplyBody[reply.id] ?? reply.suggested_response ?? '';
    if (!body.trim()) { toast.error('No response to send'); return; }
    setSendingId(reply.id);
    try {
      const prospect = reply.prospects;
      const subject = `Re: Following up — Innago Referral Program`;
      const res = await fetch('/api/replies/respond', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ replyId: reply.id, subject, body }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      toast.success(`Reply sent via ${data.sentVia === 'ms365' ? 'Microsoft 365' : 'Brevo'} ✓`);
      await loadData();
    } catch { toast.error('Reply send failed'); }
    finally { setSendingId(null); }
  };

  const dismissReply = async (replyId: string) => {
    await supabase.from('replies').update({ handled: true, handled_at: new Date().toISOString() }).eq('id', replyId);
    toast.success('Marked as handled');
    await loadData();
  };

  // ── Helpers ───────────────────────────────────────────────────────────────

  const prospectName = (p: { first_name?: string | null; last_name?: string | null; company?: string | null } | null) => {
    if (!p) return 'Unknown';
    const name = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim();
    return name || p.company || 'Unknown';
  };

  const toggleDraftSelect = (id: string) => {
    setSelectedDrafts((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const stepLabel = (step: number) =>
    step === 0 ? 'Reply' : step === 1 ? 'Initial' : `Follow-up ${step - 1}`;

  if (loading) return (
    <div className="p-10 flex items-center gap-2 text-gray-400">
      <Loader2 size={16} className="animate-spin" /> Loading outreach...
    </div>
  );

  return (
    <div className="p-8 max-w-4xl mx-auto">

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Outreach</h1>
          <p className="text-sm text-gray-400 mt-0.5">Review AI-drafted emails and replies, then approve to send</p>
        </div>
        <div className="flex items-center gap-2">
          {ms365Connected !== null && (
            <div className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full font-medium ${
              ms365Connected ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
            }`}>
              <div className={`w-1.5 h-1.5 rounded-full ${ms365Connected ? 'bg-green-500' : 'bg-gray-400'}`} />
              {ms365Connected ? 'Sending via Microsoft 365' : 'Sending via Brevo'}
            </div>
          )}
          <button onClick={loadData} className="text-gray-400 hover:text-gray-600 p-1.5 rounded-lg hover:bg-gray-100">
            <RefreshCw size={15} />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        {([
          { key: 'drafts', label: 'Drafts', count: drafts.length, icon: <Edit3 size={13} /> },
          { key: 'replies', label: 'Replies', count: replies.length, icon: <Inbox size={13} /> },
          { key: 'sent', label: 'Sent', count: sent.length, icon: <Send size={13} /> },
        ] as const).map(({ key, label, count, icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              tab === key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}>
            {icon}
            {label}
            {count > 0 && (
              <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                tab === key ? 'bg-[#1B4DFF] text-white' : 'bg-gray-200 text-gray-600'
              }`}>{count}</span>
            )}
          </button>
        ))}
      </div>

      {/* ── DRAFTS TAB ──────────────────────────────────────────────────────── */}
      {tab === 'drafts' && (
        <div>
          {drafts.length === 0 ? (
            <EmptyState icon={<Edit3 size={28} />} title="No drafts waiting" body="Generate emails from the Discover or Outreach page — they'll appear here for approval." />
          ) : (
            <>
              {/* Bulk bar */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <button onClick={() => setSelectedDrafts(selectedDrafts.size === drafts.length ? new Set() : new Set(drafts.map((d) => d.id)))}
                    className="text-xs text-gray-500 hover:text-gray-800 bg-gray-100 px-3 py-1.5 rounded-lg font-medium">
                    {selectedDrafts.size === drafts.length ? 'Deselect all' : 'Select all'}
                  </button>
                  {selectedDrafts.size > 0 && (
                    <span className="text-xs text-gray-500">{selectedDrafts.size} selected</span>
                  )}
                </div>
                {selectedDrafts.size > 0 && (
                  <button onClick={bulkApprove} disabled={bulkSending}
                    className="flex items-center gap-2 bg-[#1B4DFF] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1339CC] disabled:opacity-50">
                    {bulkSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Approve & Send {selectedDrafts.size}
                  </button>
                )}
              </div>

              <div className="space-y-3">
                {drafts.map((draft) => {
                  const isExpanded = expandedId === draft.id;
                  const body = editBody[draft.id] ?? draft.body_text ?? '';
                  const name = prospectName(draft.prospects);

                  return (
                    <div key={draft.id} className={`bg-white rounded-xl border overflow-hidden transition-all ${
                      selectedDrafts.has(draft.id) ? 'border-[#1B4DFF]' : 'border-gray-100'
                    }`}>
                      {/* Row */}
                      <div className="flex items-center gap-3 px-4 py-3.5">
                        <input type="checkbox" checked={selectedDrafts.has(draft.id)}
                          onChange={() => toggleDraftSelect(draft.id)}
                          className="w-4 h-4 rounded text-blue-600 cursor-pointer shrink-0" />

                        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : draft.id)}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-sm font-medium text-gray-900">{name}</span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-100">
                              {stepLabel(draft.sequence_step)}
                            </span>
                            {draft.campaigns && (
                              <span className="text-[10px] text-gray-400">{draft.campaigns.name}</span>
                            )}
                          </div>
                          <div className="text-xs text-gray-500 mt-0.5 truncate font-medium">{draft.subject}</div>
                          {!isExpanded && draft.body_text && (
                            <div className="text-xs text-gray-400 mt-0.5 truncate">{draft.body_text.slice(0, 100)}…</div>
                          )}
                        </div>

                        <button onClick={() => setExpandedId(isExpanded ? null : draft.id)}
                          className="text-gray-300 hover:text-gray-600 p-1 shrink-0">
                          {isExpanded ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                        </button>
                      </div>

                      {/* Expanded body editor */}
                      {isExpanded && (
                        <div className="border-t border-gray-100 px-4 pb-4 pt-3">
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Email body — edit before sending</div>
                          <textarea
                            value={body}
                            onChange={(e) => setEditBody((prev) => ({ ...prev, [draft.id]: e.target.value }))}
                            rows={10}
                            className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-blue-200 resize-y font-mono leading-relaxed"
                          />
                          <div className="flex items-center justify-between mt-3">
                            <button onClick={() => discardDraft(draft.id)}
                              className="text-xs text-red-400 hover:text-red-600 flex items-center gap-1">
                              <X size={12} /> Discard draft
                            </button>
                            <button onClick={() => sendDraft(draft.id)} disabled={sendingId === draft.id}
                              className="flex items-center gap-2 bg-[#1B4DFF] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1339CC] disabled:opacity-50">
                              {sendingId === draft.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                              Approve & Send
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}

      {/* ── REPLIES TAB ─────────────────────────────────────────────────────── */}
      {tab === 'replies' && (
        <div>
          {replies.length === 0 ? (
            <EmptyState icon={<Inbox size={28} />} title="No replies to action" body="Inbound replies will appear here once logged. Claude classifies each one and drafts a suggested response." />
          ) : (
            <div className="space-y-4">
              {replies.map((reply) => {
                const isExpanded = expandedId === reply.id;
                const meta = reply.classification ? CLASSIFICATION_META[reply.classification] : null;
                const replyBody = editReplyBody[reply.id] ?? reply.suggested_response ?? '';
                const name = prospectName(reply.prospects);
                const isActionable = reply.classification && !['not_interested', 'do_not_contact', 'auto_reply', 'wrong_person'].includes(reply.classification);

                return (
                  <div key={reply.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                    {/* Row */}
                    <div
                      className="flex items-center gap-3 px-4 py-3.5 cursor-pointer hover:bg-gray-50/50"
                      onClick={() => setExpandedId(isExpanded ? null : reply.id)}
                    >
                      <div className="w-8 h-8 bg-gradient-to-br from-purple-50 to-indigo-100 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold text-indigo-700">
                        {name[0]?.toUpperCase() ?? '?'}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-medium text-gray-900">{name}</span>
                          {meta && (
                            <span className={`flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${meta.color}`}>
                              {meta.icon} {meta.label}
                            </span>
                          )}
                          {reply.confidence != null && (
                            <span className="text-[10px] text-gray-400">{Math.round(reply.confidence * 100)}% confidence</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 truncate">{reply.raw_content.slice(0, 120)}{reply.raw_content.length > 120 ? '…' : ''}</div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {isActionable && reply.suggested_response && (
                          <span className="text-[10px] text-green-600 bg-green-50 px-2 py-0.5 rounded-full">Draft ready</span>
                        )}
                        {isExpanded ? <ChevronUp size={15} className="text-gray-300" /> : <ChevronDown size={15} className="text-gray-300" />}
                      </div>
                    </div>

                    {/* Expanded */}
                    {isExpanded && (
                      <div className="border-t border-gray-100 px-4 pb-4 pt-3 space-y-4">
                        {/* Their message */}
                        <div>
                          <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400 mb-2">Their message</div>
                          <div className="bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-700 whitespace-pre-line leading-relaxed">
                            {reply.raw_content}
                          </div>
                        </div>

                        {/* AI draft response */}
                        {reply.suggested_response ? (
                          <div>
                            <div className="flex items-center gap-2 mb-2">
                              <div className="text-[10px] font-semibold uppercase tracking-wide text-indigo-500">AI-drafted response</div>
                              <span className="text-[10px] text-gray-400">— edit before sending</span>
                            </div>
                            <textarea
                              value={replyBody}
                              onChange={(e) => setEditReplyBody((prev) => ({ ...prev, [reply.id]: e.target.value }))}
                              rows={7}
                              className="w-full text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 resize-y leading-relaxed"
                            />
                          </div>
                        ) : (
                          <div className="text-xs text-gray-400 italic">No suggested response generated yet.</div>
                        )}

                        {/* Actions */}
                        <div className="flex items-center justify-between">
                          <button onClick={() => dismissReply(reply.id)}
                            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                            <CheckCircle size={12} /> Mark handled (no reply needed)
                          </button>
                          {reply.suggested_response && isActionable && (
                            <button onClick={() => sendReply(reply)} disabled={sendingId === reply.id}
                              className="flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                              {sendingId === reply.id ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                              Approve & Send Reply
                            </button>
                          )}
                          {!isActionable && reply.classification && (
                            <button onClick={() => dismissReply(reply.id)}
                              className="flex items-center gap-2 bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200">
                              <CheckCircle size={14} /> Archive
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── SENT TAB ────────────────────────────────────────────────────────── */}
      {tab === 'sent' && (
        <div>
          {sent.length === 0 ? (
            <EmptyState icon={<Send size={28} />} title="Nothing sent yet" body="Approved emails will appear here after they're sent." />
          ) : (
            <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
              <div className="divide-y divide-gray-50">
                {sent.map((email) => (
                  <div key={email.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/50">
                    <div className="w-7 h-7 bg-green-50 rounded-full flex items-center justify-center shrink-0">
                      <Send size={12} className="text-green-500" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900">{prospectName(email.prospects)}</span>
                        <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 text-gray-500 rounded-full">{stepLabel(email.sequence_step)}</span>
                        {email.campaigns && <span className="text-[10px] text-gray-400">{email.campaigns.name}</span>}
                      </div>
                      <div className="text-xs text-gray-500 truncate">{email.subject}</div>
                    </div>
                    <div className="text-xs text-gray-400 shrink-0">
                      {email.sent_at ? new Date(email.sent_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—'}
                    </div>
                    <div className={`text-[10px] font-medium px-2 py-0.5 rounded-full shrink-0 ${
                      email.status === 'replied' ? 'bg-purple-100 text-purple-700' :
                      email.status === 'opened' ? 'bg-green-100 text-green-700' :
                      'bg-blue-50 text-blue-600'
                    }`}>
                      {email.status === 'replied' ? 'Replied' : email.status === 'opened' ? 'Opened' : 'Sent'}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function EmptyState({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <div className="bg-white rounded-xl border border-dashed border-gray-200 p-16 text-center">
      <div className="flex justify-center mb-3 text-gray-200">{icon}</div>
      <p className="text-sm font-medium text-gray-500 mb-1">{title}</p>
      <p className="text-xs text-gray-400 max-w-sm mx-auto">{body}</p>
    </div>
  );
}
