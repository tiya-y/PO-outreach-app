'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import {
  MessageSquare, Loader2, ChevronRight, Calendar, CheckCircle,
  XCircle, HelpCircle, AlertCircle, Beaker
} from 'lucide-react';
import Link from 'next/link';
import { format } from 'date-fns';
import MeetingPreviewModal from '@/components/MeetingPreviewModal';
import type { Campaign, Reply, Prospect } from '@/types';

type ReplyWithProspect = Reply & { prospect?: Prospect };

export default function MeetingsConvertPage() {
  const { id: campaignId } = useParams() as { id: string };
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [replies, setReplies] = useState<ReplyWithProspect[]>([]);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [logModal, setLogModal] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [meetingPreview, setMeetingPreview] = useState<{ id: string; name: string; company?: string } | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: camp }, { data: replyData }, { data: prspcts }] = await Promise.all([
      supabase.from('campaigns').select('*').eq('id', campaignId).single(),
      supabase.from('replies').select('*, prospects(*)').order('created_at', { ascending: false }),
      supabase.from('prospects').select('*').eq('campaign_id', campaignId)
        .in('status', ['replied', 'contacted']),
    ]);
    setCampaign(camp);
    // Filter replies to this campaign's prospects
    const campProspectIds = new Set((prspcts ?? []).map((p) => p.id));
    setReplies(((replyData ?? []) as ReplyWithProspect[]).filter((r) => campProspectIds.has(r.prospect_id)));
    setProspects(prspcts ?? []);
    setLoading(false);
  }, [campaignId]);

  useEffect(() => { loadData(); }, [loadData]);

  const logReply = async () => {
    if (!logModal || !replyText.trim()) { toast.error('Enter reply text'); return; }
    const toastId = toast.loading('Classifying reply...');
    try {
      const res = await fetch('/api/replies/classify', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospectId: logModal, rawContent: replyText }),
      });
      const data = await res.json();
      toast.dismiss(toastId);
      if (data.error) { toast.error(data.error); return; }
      toast.success(`Classified: ${data.classification.classification}`);
      setLogModal(null);
      setReplyText('');
      await loadData();
    } catch {
      toast.dismiss(toastId);
      toast.error('Failed');
    }
  };

  const classificationIcon = (c?: string | null) => {
    if (c === 'interested' || c === 'meeting_request') return <CheckCircle size={14} className="text-green-500" />;
    if (c === 'more_info') return <HelpCircle size={14} className="text-yellow-500" />;
    if (c === 'not_interested' || c === 'do_not_contact') return <XCircle size={14} className="text-red-500" />;
    return <AlertCircle size={14} className="text-gray-300" />;
  };

  const classificationBadge = (c?: string | null) =>
    c === 'interested' || c === 'meeting_request' ? 'bg-green-50 text-green-700' :
    c === 'more_info' ? 'bg-yellow-50 text-yellow-700' :
    c === 'not_interested' || c === 'do_not_contact' ? 'bg-red-50 text-red-600' :
    'bg-gray-100 text-gray-500';

  if (loading) return <div className="p-8 flex items-center gap-2 text-gray-400"><Loader2 size={18} className="animate-spin" /> Loading...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* Meeting preview modal */}
      {meetingPreview && (
        <MeetingPreviewModal
          prospectId={meetingPreview.id}
          prospectName={meetingPreview.name}
          prospectCompany={meetingPreview.company}
          onClose={() => setMeetingPreview(null)}
          onBooked={() => { loadData(); setMeetingPreview(null); }}
        />
      )}

      {/* Log reply modal */}
      {logModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-6">
          <div className="bg-white rounded-xl w-full max-w-md p-6">
            <h3 className="text-sm font-semibold mb-3">Log Inbound Reply</h3>
            <textarea value={replyText} onChange={(e) => setReplyText(e.target.value)}
              placeholder="Paste the prospect's reply here..."
              rows={6}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500" />
            <div className="flex gap-2 mt-3">
              <button onClick={() => setLogModal(null)} className="flex-1 border border-gray-200 rounded-lg py-2 text-sm text-gray-500">Cancel</button>
              <button onClick={logReply} className="flex-1 bg-[#3B1F5E] text-white rounded-lg py-2 text-sm font-medium">Classify Reply</button>
            </div>
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
            <span>Phase 3 — Convert</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">Replies & Meeting Booking</h1>
        </div>
        <Link href="/meetings" className="flex items-center gap-2 bg-[#1B4DFF] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1339CC]">
          <Calendar size={14} /> All Meetings
        </Link>
      </div>

      {/* Preview note */}
      <div className="bg-purple-50 border border-purple-100 rounded-xl px-5 py-3 mb-6 flex items-center gap-3">
        <Beaker size={15} className="text-purple-500 shrink-0" />
        <p className="text-sm text-purple-700">
          When you book a meeting, you'll see a <strong>preview of the brief + invite</strong> before anything is booked on MS365.
        </p>
      </div>

      <div className="grid grid-cols-5 gap-6">
        {/* Replies — left */}
        <div className="col-span-3">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-800">Inbound Replies</h2>
            {prospects.length > 0 && (
              <select onChange={(e) => e.target.value && setLogModal(e.target.value)} defaultValue=""
                className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 focus:outline-none cursor-pointer">
                <option value="">+ Log reply for...</option>
                {prospects.map((p) => (
                  <option key={p.id} value={p.id}>{p.first_name} {p.last_name} ({p.company ?? p.email ?? 'Unknown'})</option>
                ))}
              </select>
            )}
          </div>

          {replies.length === 0 ? (
            <div className="bg-white rounded-xl border border-dashed border-gray-200 p-12 text-center">
              <MessageSquare size={28} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-400">No replies logged yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {replies.map((r) => {
                const prospect = r.prospect as Prospect | undefined;
                const prospectName = `${prospect?.first_name ?? ''} ${prospect?.last_name ?? ''}`.trim() || 'Unknown';
                return (
                  <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-start gap-3 flex-1 min-w-0">
                        <div className="mt-0.5">{classificationIcon(r.classification)}</div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-medium text-gray-900 truncate">{prospectName}</span>
                            <span className={`text-xs px-2 py-0.5 rounded-full ${classificationBadge(r.classification)}`}>
                              {r.classification ?? 'Unclassified'}
                            </span>
                          </div>
                          <p className="text-xs text-gray-500 line-clamp-2">{r.raw_content}</p>
                          {r.suggested_response && (
                            <div className="mt-2 bg-blue-50 rounded-lg p-2 text-xs text-blue-700">
                              <strong>Suggested reply:</strong> {r.suggested_response}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="flex flex-col gap-1.5 shrink-0 items-end">
                        <div className="text-xs text-gray-300">{format(new Date(r.received_at), 'MMM d')}</div>
                        {(r.classification === 'interested' || r.classification === 'meeting_request') && prospect && (
                          <button
                            onClick={() => setMeetingPreview({ id: r.prospect_id, name: prospectName, company: prospect?.company ?? undefined })}
                            className="text-xs bg-[#3B1F5E] text-white px-3 py-1 rounded-lg hover:bg-[#4A2875] flex items-center gap-1"
                          >
                            <Beaker size={10} /> Preview & Book
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Waiting for reply — right */}
        <div className="col-span-2">
          <h2 className="text-sm font-semibold text-gray-800 mb-4">Waiting for Reply</h2>
          <div className="space-y-2">
            {prospects.filter((p) => p.status === 'contacted').slice(0, 12).map((p) => {
              const name = `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() || (p.company ?? 'Unknown');
              return (
                <div key={p.id} className="bg-white rounded-lg border border-gray-100 px-3 py-2.5 flex items-center gap-3">
                  <div className="w-7 h-7 bg-gray-100 rounded-full flex items-center justify-center text-xs font-medium text-gray-500">
                    {(p.first_name?.[0] ?? p.company?.[0] ?? '?').toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-gray-800 truncate">{name}</div>
                    <div className="text-xs text-gray-400 truncate">{p.company}</div>
                  </div>
                  <button onClick={() => setLogModal(p.id)} className="text-xs text-blue-500 hover:text-blue-700 shrink-0">+ Log</button>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
