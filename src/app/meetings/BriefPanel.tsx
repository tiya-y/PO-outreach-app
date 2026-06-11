'use client';

import { useState } from 'react';
import toast from 'react-hot-toast';
import { format } from 'date-fns';
import {
  RefreshCw, Loader2, Linkedin, Globe, Video, Clock, User,
  Building2, FileText, ChevronRight
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface BriefPanelProps {
  meeting: {
    id: string;
    scheduled_at: string;
    duration_minutes: number;
    meeting_link: string | null;
    brief_markdown: string | null;
    brief_generated_at: string | null;
    status: string;
    sales_rep_email: string;
    prospects: unknown;
  };
}

export default function BriefPanel({ meeting }: BriefPanelProps) {
  const [brief, setBrief] = useState(meeting.brief_markdown);
  const [generating, setGenerating] = useState(false);
  const prospect = meeting.prospects as Record<string, unknown>;

  const regenerateBrief = async () => {
    setGenerating(true);
    const toastId = toast.loading('Regenerating brief with Claude...');
    try {
      const res = await fetch('/api/meetings/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ meetingId: meeting.id }),
      });
      const data = await res.json();
      toast.dismiss(toastId);
      if (data.error) { toast.error(data.error); return; }
      setBrief(data.brief);
      toast.success('Brief updated');
    } catch {
      toast.dismiss(toastId);
      toast.error('Failed to generate brief');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      {/* Meeting header */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">
              {String(prospect?.first_name ?? '')} {String(prospect?.last_name ?? '')}
            </h2>
            <div className="flex items-center gap-2 text-sm text-gray-500 mt-0.5">
              <Building2 size={13} />
              {(prospect?.company as string) ?? 'Unknown Company'}
              {prospect?.title ? <><span>·</span><span>{String(prospect.title)}</span></> : null}
            </div>
          </div>
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
            meeting.status === 'scheduled' ? 'bg-blue-50 text-blue-600' :
            meeting.status === 'completed' ? 'bg-green-50 text-green-600' :
            'bg-gray-100 text-gray-500'
          }`}>{meeting.status}</span>
        </div>

        <div className="grid grid-cols-3 gap-4 mt-5">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Clock size={14} className="text-gray-400" />
            {format(new Date(meeting.scheduled_at), 'MMM d, yyyy · h:mm a')}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <User size={14} className="text-gray-400" />
            {meeting.sales_rep_email}
          </div>
          {meeting.meeting_link && (
            <a
              href={meeting.meeting_link}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-2 text-sm text-blue-500 hover:text-blue-700"
            >
              <Video size={14} />
              Join Call
            </a>
          )}
        </div>

        {/* Prospect links */}
        <div className="flex items-center gap-3 mt-4 pt-4 border-t border-gray-50">
          {prospect?.linkedin_url ? (
            <a href={prospect.linkedin_url as string} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-500 transition-colors">
              <Linkedin size={12} /> LinkedIn
            </a>
          ) : null}
          {prospect?.company_website ? (
            <a href={prospect.company_website as string} target="_blank" rel="noreferrer"
              className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-blue-500 transition-colors">
              <Globe size={12} /> Website
            </a>
          ) : null}
          {prospect?.portfolio_size ? (
            <span className="text-xs text-gray-400">~{prospect.portfolio_size as number} units</span>
          ) : null}
        </div>
      </div>

      {/* Brief */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <FileText size={15} className="text-purple-500" />
            <h3 className="text-sm font-semibold text-gray-900">Pre-Call Brief</h3>
            {meeting.brief_generated_at && (
              <span className="text-xs text-gray-300">
                Generated {format(new Date(meeting.brief_generated_at), 'MMM d')}
              </span>
            )}
          </div>
          <button
            onClick={regenerateBrief}
            disabled={generating}
            className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-purple-600 transition-colors disabled:opacity-40"
          >
            {generating ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
            Regenerate
          </button>
        </div>

        {brief ? (
          <div className="prose text-sm">
            <ReactMarkdown>{brief}</ReactMarkdown>
          </div>
        ) : (
          <div className="text-center py-10">
            <FileText size={28} className="mx-auto mb-2 text-gray-200" />
            <p className="text-sm text-gray-400 mb-3">No brief generated yet</p>
            <button
              onClick={regenerateBrief}
              disabled={generating}
              className="bg-[#3B1F5E] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#4A2875] disabled:opacity-40 flex items-center gap-2 mx-auto"
            >
              {generating ? <Loader2 size={14} className="animate-spin" /> : null}
              Generate Brief with Claude
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
