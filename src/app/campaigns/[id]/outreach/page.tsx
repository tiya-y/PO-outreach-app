'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import {
  Mail, Loader2, ChevronRight, Send, Wand2, Clock,
  Eye, MessageSquare, RefreshCw, Users, Zap, Beaker
} from 'lucide-react';
import Link from 'next/link';
import EmailReviewQueue from '@/components/EmailReviewQueue';
import SequencePreviewModal from '@/components/SequencePreviewModal';
import type { Campaign, Prospect, OutreachEmail } from '@/types';

export default function OutreachPage() {
  const { id: campaignId } = useParams() as { id: string };
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [emails, setEmails] = useState<Record<string, OutreachEmail[]>>({});
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const [preview, setPreview] = useState<OutreachEmail | null>(null);
  const [sequenceStep, setSequenceStep] = useState(1);
  const [showEmailReview, setShowEmailReview] = useState(false);
  const [sequenceProspect, setSequenceProspect] = useState<{ id: string; name: string } | null>(null);

  const loadData = useCallback(async () => {
    const [{ data: camp }, { data: prspcts }, { data: emailData }] = await Promise.all([
      supabase.from('campaigns').select('*').eq('id', campaignId).single(),
      supabase.from('prospects').select('*').eq('campaign_id', campaignId)
        .in('status', ['qualified', 'contacted', 'new'])
        .order('qualification_score', { ascending: false }),
      supabase.from('outreach_emails').select('*').eq('campaign_id', campaignId).order('sequence_step'),
    ]);
    setCampaign(camp);
    setProspects(prspcts ?? []);
    const grouped: Record<string, OutreachEmail[]> = {};
    for (const e of emailData ?? []) {
      if (!grouped[e.prospect_id]) grouped[e.prospect_id] = [];
      grouped[e.prospect_id].push(e);
    }
    setEmails(grouped);
  }, [campaignId]);

  useEffect(() => { loadData(); }, [loadData]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => { const s = new Set(prev); s.has(id) ? s.delete(id) : s.add(id); return s; });
  };

  const sendDraft = async (emailId: string) => {
    setSendingIds((prev) => new Set(prev).add(emailId));
    try {
      const res = await fetch('/api/email/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ emailId }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      toast.success('Sent!');
      await loadData();
    } catch { toast.error('Send failed'); }
    finally { setSendingIds((prev) => { const s = new Set(prev); s.delete(emailId); return s; }); }
  };

  const emailStatusDot = (status: string) => {
    const map: Record<string, string> = {
      draft: 'bg-gray-200', scheduled: 'bg-yellow-300',
      sent: 'bg-blue-400', opened: 'bg-green-400', replied: 'bg-purple-500',
    };
    return map[status] ?? 'bg-gray-200';
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Modals */}
      {showEmailReview && selected.size > 0 && (
        <EmailReviewQueue
          prospectIds={Array.from(selected)}
          sequenceStep={sequenceStep}
          campaignId={campaignId}
          onClose={() => setShowEmailReview(false)}
          onSent={(count) => { loadData(); setSelected(new Set()); }}
        />
      )}
      {sequenceProspect && (
        <SequencePreviewModal
          prospectId={sequenceProspect.id}
          prospectName={sequenceProspect.name}
          onClose={() => setSequenceProspect(null)}
          onLaunched={() => { loadData(); setSequenceProspect(null); }}
        />
      )}

      {/* Email preview overlay */}
      {preview && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-xl w-full max-w-xl p-6 max-h-[80vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold">Email — Step {preview.sequence_step}</h3>
              <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-600 text-lg">✕</button>
            </div>
            <div className="bg-gray-50 rounded-lg px-4 py-2 mb-3 text-sm"><span className="text-gray-400">Subject: </span><span className="font-medium">{preview.subject}</span></div>
            <div className="text-sm text-gray-700 whitespace-pre-line leading-relaxed">{preview.body_text}</div>
            {preview.status === 'draft' && (
              <button onClick={() => { sendDraft(preview.id); setPreview(null); }}
                className="mt-4 bg-[#1E4033] text-white px-4 py-2 rounded-lg text-xs font-medium flex items-center gap-1.5">
                <Send size={12} /> Send Now
              </button>
            )}
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Link href="/campaigns" className="hover:text-gray-700">Campaigns</Link>
            <ChevronRight size={12} />
            <span className="text-gray-700 font-medium">{campaign?.name}</span>
            <ChevronRight size={12} />
            <span>Phase 2 — Outreach</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Email Outreach</h1>
        </div>

        <div className="flex items-center gap-2">
          <select value={sequenceStep} onChange={(e) => setSequenceStep(parseInt(e.target.value))}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none">
            {[1,2,3,4,5].map((s) => <option key={s} value={s}>Step {s} {s === 1 ? '(Initial)' : `(Follow-up ${s-1})`}</option>)}
          </select>

          {selected.size > 0 && (
            <button onClick={() => setShowEmailReview(true)}
              className="flex items-center gap-2 bg-[#1E4033] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#245240]">
              <Beaker size={14} /> Preview {selected.size} Emails
            </button>
          )}

          <Link href={`/campaigns/${campaignId}/meetings`}
            className="flex items-center gap-2 bg-[#1B4DFF] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1339CC]">
            Convert <ChevronRight size={14} />
          </Link>
        </div>
      </div>

      {/* Info banner */}
      {prospects.length > 0 && selected.size === 0 && (
        <div className="bg-green-50 border border-green-100 rounded-xl px-5 py-3 mb-5 flex items-center gap-3">
          <Beaker size={15} className="text-green-500 shrink-0" />
          <p className="text-sm text-green-700">Select prospects and click <strong>Preview Emails</strong> to review each email before sending. Or use <strong>Sequence</strong> per prospect to preview all 5 follow-ups.</p>
        </div>
      )}

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm text-gray-500"><Users size={14} />{prospects.length} prospects</div>
          <button onClick={() => setSelected(selected.size === prospects.length ? new Set() : new Set(prospects.map((p) => p.id)))}
            className="text-xs text-blue-500 hover:text-blue-700">
            {selected.size === prospects.length ? 'Deselect all' : 'Select all'}
          </button>
        </div>

        {prospects.length === 0 ? (
          <div className="p-16 text-center text-gray-400">
            <Mail size={32} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No prospects ready.</p>
            <Link href={`/campaigns/${campaignId}/discover`} className="text-xs text-blue-500 hover:underline mt-1 block">Go to Discovery →</Link>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {prospects.map((p) => {
              const pEmails = emails[p.id] ?? [];
              const hasDraft = pEmails.some((e) => e.status === 'draft');
              const draftEmail = pEmails.find((e) => e.status === 'draft');
              const hasSequence = pEmails.length >= 3;
              const prospectName = p.first_name || p.last_name
                ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()
                : p.company ?? 'Unknown';

              return (
                <div key={p.id} className="flex items-center gap-4 px-5 py-3.5 hover:bg-gray-50/50">
                  <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleSelect(p.id)}
                    className="w-4 h-4 rounded text-blue-500 cursor-pointer" />

                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-gray-900 truncate">{prospectName}</div>
                    <div className="text-xs text-gray-400 truncate">{p.email ?? 'No email'}{p.company ? ` · ${p.company}` : ''}</div>
                  </div>

                  {/* Step dots */}
                  <div className="flex items-center gap-1" title="Email sequence steps">
                    {[1,2,3,4,5].map((step) => {
                      const e = pEmails.find((em) => em.sequence_step === step);
                      return (
                        <div key={step} onClick={() => e && setPreview(e)}
                          title={e ? `Step ${step}: ${e.status}` : `Step ${step}: not created`}
                          className={`w-5 h-5 rounded-full flex items-center justify-center text-xs cursor-pointer transition-colors ${
                            !e ? 'bg-gray-100 text-gray-300' :
                            e.status === 'replied' ? 'bg-purple-100 text-purple-600' :
                            e.status === 'opened' ? 'bg-green-100 text-green-600' :
                            e.status === 'sent' ? 'bg-blue-100 text-blue-600' :
                            'bg-yellow-100 text-yellow-600'
                          }`}
                        >
                          {e ? <div className={`w-2 h-2 rounded-full ${emailStatusDot(e.status)}`} /> : <span>{step}</span>}
                        </div>
                      );
                    })}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {!hasSequence && (
                      <button
                        onClick={() => setSequenceProspect({ id: p.id, name: prospectName })}
                        disabled={!p.email}
                        title={!p.email ? 'No email' : 'Preview 5-step sequence'}
                        className="flex items-center gap-1.5 text-xs bg-indigo-600 text-white px-3 py-1.5 rounded-lg hover:bg-indigo-700 disabled:opacity-40"
                      >
                        <Zap size={11} /> Sequence
                      </button>
                    )}

                    {hasDraft && draftEmail && (
                      <button
                        onClick={() => sendDraft(draftEmail.id)}
                        disabled={sendingIds.has(draftEmail.id)}
                        className="flex items-center gap-1.5 text-xs bg-[#1B4DFF] text-white px-3 py-1.5 rounded-lg hover:bg-[#1339CC] disabled:opacity-40"
                      >
                        {sendingIds.has(draftEmail.id) ? <Loader2 size={11} className="animate-spin" /> : <Send size={11} />}
                        Send
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
