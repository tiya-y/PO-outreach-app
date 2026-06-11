import { createServiceClient } from '@/lib/supabase';
import Link from 'next/link';
import { Calendar, Clock, User, Building2, FileText, ChevronRight, Video } from 'lucide-react';
import { format, isPast, isToday } from 'date-fns';
import BriefPanel from './BriefPanel';

export const dynamic = 'force-dynamic';

export default async function MeetingsPage({ searchParams }: { searchParams: { id?: string } }) {
  const supabase = createServiceClient();

  const { data: meetings } = await supabase
    .from('meetings')
    .select('*, prospects(first_name, last_name, company, city, state, title, email, portfolio_size, linkedin_url, company_website)')
    .order('scheduled_at', { ascending: true });

  const upcoming = (meetings ?? []).filter((m) => !isPast(new Date(m.scheduled_at)) || isToday(new Date(m.scheduled_at)));
  const past = (meetings ?? []).filter((m) => isPast(new Date(m.scheduled_at)) && !isToday(new Date(m.scheduled_at)));

  const activeMeetingId = searchParams.id ?? (upcoming[0]?.id ?? null);
  const activeMeeting = (meetings ?? []).find((m) => m.id === activeMeetingId);

  const statusBadge = (status: string) => {
    if (status === 'scheduled') return 'bg-blue-50 text-blue-600';
    if (status === 'completed') return 'bg-green-50 text-green-600';
    if (status === 'cancelled') return 'bg-red-50 text-red-500';
    if (status === 'no_show') return 'bg-gray-100 text-gray-500';
    return 'bg-gray-100 text-gray-500';
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const MeetingCard = ({ m, active }: { m: any; active: boolean }) => {
    const prospect = (m.prospects ?? {}) as Record<string, unknown>;
    const isUpcoming = !isPast(new Date(m.scheduled_at)) || isToday(new Date(m.scheduled_at));

    return (
      <Link
        href={`/meetings?id=${m.id}`}
        className={`block p-4 rounded-xl border transition-all ${
          active
            ? 'border-blue-300 bg-blue-50 shadow-sm'
            : 'border-gray-100 bg-white hover:border-blue-100'
        }`}
      >
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-sm font-medium text-gray-900">
              {String(prospect?.first_name ?? '')} {String(prospect?.last_name ?? '')}
            </div>
            <div className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
              <Building2 size={10} />
              {(prospect?.company as string) ?? (prospect?.city as string) ?? 'Unknown'}
            </div>
          </div>
          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${statusBadge(m.status)}`}>
            {m.status}
          </span>
        </div>
        <div className="flex items-center gap-1.5 mt-2.5 text-xs text-gray-500">
          <Clock size={11} />
          {isUpcoming && isToday(new Date(m.scheduled_at)) ? (
            <span className="font-medium text-orange-500">Today — {format(new Date(m.scheduled_at), 'h:mm a')}</span>
          ) : (
            format(new Date(m.scheduled_at), 'MMM d · h:mm a')
          )}
        </div>
        {m.brief_markdown && (
          <div className="flex items-center gap-1 mt-1.5 text-xs text-green-600">
            <FileText size={10} />
            Brief ready
          </div>
        )}
      </Link>
    );
  };

  return (
    <div className="flex h-full">
      {/* Left sidebar — meeting list */}
      <div className="w-72 shrink-0 border-r border-gray-100 bg-white overflow-y-auto p-4 space-y-6">
        <div>
          <h1 className="text-base font-semibold text-gray-900 mb-1">Meetings</h1>
          <p className="text-xs text-gray-400">Phase 4 — Close. Brief in hand. Just show up.</p>
        </div>

        {upcoming.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Upcoming</div>
            <div className="space-y-2">
              {upcoming.map((m) => (
                <MeetingCard key={m.id} m={m} active={m.id === activeMeetingId} />
              ))}
            </div>
          </div>
        )}

        {past.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Past</div>
            <div className="space-y-2">
              {past.map((m) => (
                <MeetingCard key={m.id} m={m} active={m.id === activeMeetingId} />
              ))}
            </div>
          </div>
        )}

        {(meetings ?? []).length === 0 && (
          <div className="text-center py-12 text-gray-400">
            <Calendar size={28} className="mx-auto mb-2 opacity-30" />
            <p className="text-sm">No meetings yet</p>
            <p className="text-xs text-gray-300 mt-1">Book meetings from the Convert phase</p>
          </div>
        )}
      </div>

      {/* Right panel — brief */}
      <div className="flex-1 overflow-y-auto bg-[#F8F9FB]">
        {activeMeeting ? (
          <BriefPanel meeting={activeMeeting} />
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-gray-400">
            <Calendar size={40} className="mb-3 opacity-20" />
            <p className="text-sm">Select a meeting to view the brief</p>
          </div>
        )}
      </div>
    </div>
  );
}
