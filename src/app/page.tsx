import { createServiceClient } from '@/lib/supabase';
import Link from 'next/link';
import { format, isToday, isTomorrow, isPast } from 'date-fns';
import {
  Target, Users, Mail, Calendar, TrendingUp, Plus,
  Clock, FileText, ChevronRight, Activity, Star, Building2,
  ArrowUpRight, MessageSquare, CheckCircle, Video
} from 'lucide-react';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function getDashboardData() {
  const supabase = createServiceClient();

  const [
    { data: campaigns },
    { data: allProspects },
    { data: upcomingMeetings },
    { data: recentEmails },
    { data: recentReplies },
    { data: salesReps },
  ] = await Promise.all([
    supabase.from('campaigns').select('*').order('created_at', { ascending: false }),
    supabase.from('prospects').select('status, campaign_id, created_at, qualification_score'),
    supabase.from('meetings')
      .select('*, prospects(first_name, last_name, company, city, title, portfolio_size, email, linkedin_url, company_website)')
      .gte('scheduled_at', new Date().toISOString())
      .order('scheduled_at')
      .limit(10),
    supabase.from('outreach_emails')
      .select('status, sent_at, opened_at, campaign_id, prospects(first_name, last_name, company)')
      .order('created_at', { ascending: false })
      .limit(30),
    supabase.from('replies')
      .select('classification, created_at, raw_content, prospects(first_name, last_name, company)')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase.from('sales_reps').select('id, name, email, ms365_user_id').eq('is_active', true),
  ]);

  return { campaigns, allProspects, upcomingMeetings, recentEmails, recentReplies, salesReps };
}

export default async function DashboardPage() {
  const { campaigns, allProspects, upcomingMeetings, recentEmails, recentReplies, salesReps } = await getDashboardData();

  // Pipeline counts
  const pipeline: Record<string, number> = {};
  for (const p of allProspects ?? []) {
    pipeline[p.status] = (pipeline[p.status] ?? 0) + 1;
  }
  const totalProspects = (allProspects ?? []).length;

  // Email stats
  const totalSent = (recentEmails ?? []).filter((e) => ['sent','opened','replied'].includes(e.status)).length;
  const totalOpened = (recentEmails ?? []).filter((e) => e.status === 'opened' || e.status === 'replied').length;
  const totalReplied = (recentEmails ?? []).filter((e) => e.status === 'replied').length;
  const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
  const replyRate = totalSent > 0 ? Math.round((totalReplied / totalSent) * 100) : 0;

  // Today's meetings
  const todayMeetings = (upcomingMeetings ?? []).filter((m) => isToday(new Date(m.scheduled_at)));

  // Pipeline stages config
  const stages = [
    { key: 'new', label: 'New', color: 'bg-gray-300', textColor: 'text-gray-500', dotColor: 'bg-gray-300' },
    { key: 'qualified', label: 'Qualified', color: 'bg-blue-400', textColor: 'text-blue-600', dotColor: 'bg-blue-400' },
    { key: 'contacted', label: 'Contacted', color: 'bg-indigo-400', textColor: 'text-indigo-600', dotColor: 'bg-indigo-400' },
    { key: 'replied', label: 'Replied', color: 'bg-violet-500', textColor: 'text-violet-600', dotColor: 'bg-violet-500' },
    { key: 'meeting_booked', label: 'Meeting', color: 'bg-orange-400', textColor: 'text-orange-600', dotColor: 'bg-orange-400' },
    { key: 'closed_won', label: 'Won', color: 'bg-green-500', textColor: 'text-green-700', dotColor: 'bg-green-500' },
  ];

  const classificationColor = (c?: string | null) => {
    if (c === 'interested' || c === 'meeting_request') return 'text-green-600 bg-green-50';
    if (c === 'more_info') return 'text-yellow-600 bg-yellow-50';
    if (c === 'not_interested' || c === 'do_not_contact') return 'text-red-500 bg-red-50';
    return 'text-gray-400 bg-gray-50';
  };

  return (
    <div className="p-6 max-w-[1400px] mx-auto space-y-6">

      {/* Top bar */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Sales Dashboard</h1>
          <p className="text-sm text-gray-400">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
        </div>
        <Link href="/campaigns/new"
          className="flex items-center gap-2 bg-[#1B4DFF] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1339CC] transition-colors">
          <Plus size={15} /> New Campaign
        </Link>
      </div>

      {/* ── TODAY'S MEETINGS (Phase 4 hero) ─────────────────────────────── */}
      {todayMeetings.length > 0 && (
        <div className="bg-gradient-to-r from-[#1A1D2E] to-[#2D1F5E] rounded-2xl p-5 text-white">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-7 h-7 bg-white/10 rounded-lg flex items-center justify-center">
              <Calendar size={14} />
            </div>
            <span className="text-sm font-semibold">Today's Meetings</span>
            <span className="text-xs bg-white/10 px-2 py-0.5 rounded-full ml-1">{todayMeetings.length}</span>
          </div>
          <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(${Math.min(todayMeetings.length, 3)}, 1fr)` }}>
            {todayMeetings.map((m) => {
              const prospect = m.prospects as Record<string, unknown>;
              return (
                <Link key={m.id} href={`/meetings?id=${m.id}`}
                  className="bg-white/10 hover:bg-white/15 rounded-xl p-4 transition-colors group">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <div className="text-sm font-semibold">{String(prospect?.first_name ?? '')} {String(prospect?.last_name ?? '')}</div>
                      <div className="text-xs text-white/60 mt-0.5 flex items-center gap-1">
                        <Building2 size={10} />
                        {(prospect?.company as string) ?? (prospect?.city as string) ?? 'Unknown'}
                      </div>
                    </div>
                    {m.brief_markdown && (
                      <span className="text-xs bg-green-400/20 text-green-300 px-2 py-0.5 rounded-full">Brief ✓</span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-white/70">
                    <Clock size={11} />
                    {format(new Date(m.scheduled_at), 'h:mm a')}
                    {m.meeting_link && (
                      <a href={m.meeting_link} target="_blank" rel="noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="ml-auto flex items-center gap-1 text-blue-300 hover:text-blue-200">
                        <Video size={11} /> Join
                      </a>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* ── TOP METRICS ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-4">
        {[
          { label: 'Total Prospects', value: totalProspects, icon: Users, sub: `${pipeline.qualified ?? 0} qualified`, color: 'text-blue-600 bg-blue-50', href: '/campaigns' },
          { label: 'Emails Sent', value: totalSent, icon: Mail, sub: `${openRate}% open rate`, color: 'text-indigo-600 bg-indigo-50', href: '/campaigns' },
          { label: 'Replies', value: totalReplied, icon: MessageSquare, sub: `${replyRate}% reply rate`, color: 'text-violet-600 bg-violet-50', href: '/campaigns' },
          { label: 'Meetings Booked', value: pipeline.meeting_booked ?? 0, icon: Calendar, sub: `${upcomingMeetings?.length ?? 0} upcoming`, color: 'text-orange-600 bg-orange-50', href: '/meetings' },
          { label: 'Closed Won', value: pipeline.closed_won ?? 0, icon: CheckCircle, sub: `${totalProspects > 0 ? Math.round(((pipeline.closed_won ?? 0) / totalProspects) * 100) : 0}% conversion`, color: 'text-green-600 bg-green-50', href: '/campaigns' },
        ].map((stat) => (
          <Link key={stat.label} href={stat.href}
            className="bg-white rounded-xl border border-gray-100 p-4 hover:border-blue-100 transition-colors group">
            <div className="flex items-center justify-between mb-3">
              <div className={`w-9 h-9 rounded-lg flex items-center justify-center ${stat.color}`}>
                <stat.icon size={16} />
              </div>
              <ArrowUpRight size={13} className="text-gray-200 group-hover:text-blue-400 transition-colors" />
            </div>
            <div className="text-2xl font-semibold text-gray-900">{stat.value}</div>
            <div className="text-xs font-medium text-gray-600 mt-0.5">{stat.label}</div>
            <div className="text-xs text-gray-400 mt-0.5">{stat.sub}</div>
          </Link>
        ))}
      </div>

      {/* ── PIPELINE KANBAN ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <TrendingUp size={15} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">Pipeline Board</h2>
          </div>
          <span className="text-xs text-gray-400">{totalProspects} total prospects</span>
        </div>

        {totalProspects === 0 ? (
          <div className="text-center py-10 text-gray-300">
            <Users size={28} className="mx-auto mb-2" />
            <p className="text-sm">No prospects yet — <Link href="/campaigns/new" className="text-blue-400 hover:underline">start a campaign</Link></p>
          </div>
        ) : (
          <div className="grid grid-cols-6 gap-3">
            {stages.map((stage) => {
              const count = pipeline[stage.key] ?? 0;
              const pct = totalProspects > 0 ? Math.round((count / totalProspects) * 100) : 0;

              return (
                <div key={stage.key} className="bg-gray-50 rounded-xl p-3">
                  <div className="flex items-center gap-1.5 mb-2">
                    <div className={`w-2 h-2 rounded-full ${stage.dotColor}`} />
                    <span className="text-xs font-medium text-gray-500">{stage.label}</span>
                  </div>
                  <div className="text-2xl font-semibold text-gray-900 mb-1">{count}</div>
                  <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className={`h-full ${stage.color} rounded-full transition-all`}
                      style={{ width: `${Math.max(count > 0 ? 5 : 0, pct)}%` }}
                    />
                  </div>
                  <div className="text-xs text-gray-400 mt-1">{pct}%</div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── BOTTOM ROW: Campaign metrics + Activity feed + Upcoming meetings ── */}
      <div className="grid grid-cols-3 gap-5">

        {/* Campaign Performance */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Target size={14} className="text-blue-400" />
              <h2 className="text-sm font-semibold text-gray-900">Campaign Performance</h2>
            </div>
            <Link href="/campaigns" className="text-xs text-blue-500 hover:text-blue-700">All</Link>
          </div>

          {!(campaigns?.length) ? (
            <div className="text-center py-8 text-gray-300 text-sm">No campaigns yet</div>
          ) : (
            <div className="space-y-3">
              {(campaigns ?? []).slice(0, 5).map((c) => {
                const campaignProspects = (allProspects ?? []).filter((p) => p.campaign_id === c.id);
                const contacted = campaignProspects.filter((p) => ['contacted','replied','meeting_booked','closed_won'].includes(p.status)).length;
                const replied = campaignProspects.filter((p) => ['replied','meeting_booked','closed_won'].includes(p.status)).length;
                const total = campaignProspects.length;

                return (
                  <Link key={c.id} href={`/campaigns/${c.id}`}
                    className="block hover:bg-gray-50 rounded-xl -mx-2 px-2 py-2 transition-colors">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-medium text-gray-800 truncate">{c.name}</span>
                      <span className="text-xs text-gray-400 shrink-0">{total} prospects</span>
                    </div>
                    <div className="flex gap-2 text-xs text-gray-400 mb-1.5">
                      <span className="text-indigo-500 font-medium">{contacted} contacted</span>
                      <span>·</span>
                      <span className="text-violet-500 font-medium">{replied} replied</span>
                      <span>·</span>
                      <span className="text-orange-500 font-medium">{c.meeting_count ?? 0} meetings</span>
                    </div>
                    {/* Mini progress bar */}
                    <div className="h-1 bg-gray-100 rounded-full overflow-hidden flex">
                      <div className="bg-indigo-300 h-full" style={{ width: `${total > 0 ? (contacted / total) * 100 : 0}%` }} />
                      <div className="bg-violet-400 h-full" style={{ width: `${total > 0 ? (replied / total) * 100 : 0}%` }} />
                      <div className="bg-orange-400 h-full" style={{ width: `${total > 0 ? ((c.meeting_count ?? 0) / total) * 100 : 0}%` }} />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>

        {/* Activity Feed */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Activity size={14} className="text-violet-400" />
            <h2 className="text-sm font-semibold text-gray-900">Recent Activity</h2>
          </div>

          <div className="space-y-2 max-h-72 overflow-y-auto">
            {/* Replies */}
            {(recentReplies ?? []).slice(0, 5).map((reply, i) => {
              const prospect = (reply.prospects ?? {}) as unknown as Record<string, unknown>;
              return (
                <div key={`reply-${i}`} className="flex items-start gap-2.5 py-1.5">
                  <div className="w-6 h-6 bg-violet-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <MessageSquare size={10} className="text-violet-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-700">
                      <strong>{(prospect?.first_name as string) ?? 'Someone'}</strong> replied
                      {reply.classification && (
                        <span className={`ml-1.5 px-1.5 py-0.5 rounded-full text-xs ${classificationColor(reply.classification)}`}>
                          {reply.classification}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-gray-400 truncate mt-0.5">{(prospect?.company as string) ?? ''}</div>
                  </div>
                  <div className="text-xs text-gray-300 shrink-0">{format(new Date(reply.created_at), 'MMM d')}</div>
                </div>
              );
            })}

            {/* Emails sent */}
            {(recentEmails ?? []).filter((e) => e.status === 'sent').slice(0, 5).map((email, i) => {
              const prospect = (email.prospects ?? {}) as unknown as Record<string, unknown>;
              return (
                <div key={`email-${i}`} className="flex items-start gap-2.5 py-1.5">
                  <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                    <Mail size={10} className="text-blue-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs text-gray-700">
                      Email sent to <strong>{(prospect?.first_name as string) ?? 'prospect'}</strong>
                    </div>
                    <div className="text-xs text-gray-400 truncate mt-0.5">{(prospect?.company as string) ?? ''}</div>
                  </div>
                  <div className="text-xs text-gray-300 shrink-0">{email.sent_at ? format(new Date(email.sent_at), 'MMM d') : ''}</div>
                </div>
              );
            })}

            {(recentReplies ?? []).length === 0 && (recentEmails ?? []).length === 0 && (
              <div className="text-center py-8 text-gray-300 text-xs">No activity yet</div>
            )}
          </div>
        </div>

        {/* Upcoming Meetings */}
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Calendar size={14} className="text-orange-400" />
              <h2 className="text-sm font-semibold text-gray-900">Upcoming Meetings</h2>
            </div>
            <Link href="/meetings" className="text-xs text-blue-500 hover:text-blue-700">View all</Link>
          </div>

          {!(upcomingMeetings?.length) ? (
            <div className="text-center py-8 text-gray-300 text-sm">No meetings scheduled</div>
          ) : (
            <div className="space-y-2">
              {(upcomingMeetings ?? []).slice(0, 6).map((m) => {
                const prospect = m.prospects as Record<string, unknown>;
                const isNow = isToday(new Date(m.scheduled_at));
                const isTmrw = isTomorrow(new Date(m.scheduled_at));

                return (
                  <Link key={m.id} href={`/meetings?id=${m.id}`}
                    className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-gray-50 transition-colors group -mx-1 px-3">
                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 text-xs font-semibold ${
                      isNow ? 'bg-orange-100 text-orange-600' : 'bg-gray-100 text-gray-500'
                    }`}>
                      {format(new Date(m.scheduled_at), 'd')}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-medium text-gray-900 truncate">
                        {String(prospect?.first_name ?? '')} {String(prospect?.last_name ?? '')}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                        <Clock size={10} />
                        {isNow ? <span className="text-orange-500 font-medium">Today</span> :
                         isTmrw ? <span className="text-blue-500">Tomorrow</span> :
                         format(new Date(m.scheduled_at), 'MMM d')}
                        {' · '}{format(new Date(m.scheduled_at), 'h:mm a')}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {m.brief_markdown && (
                        <span title="Brief ready" className="text-green-400"><FileText size={12} /></span>
                      )}
                      <ChevronRight size={13} className="text-gray-200 group-hover:text-blue-400 transition-colors" />
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── SALES REPS STATUS ─────────────────────────────────────────────── */}
      {salesReps && salesReps.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 p-5">
          <div className="flex items-center gap-2 mb-4">
            <Users size={14} className="text-gray-400" />
            <h2 className="text-sm font-semibold text-gray-900">Sales Team</h2>
          </div>
          <div className="flex gap-4">
            {salesReps.map((rep) => {
              const repMeetings = (upcomingMeetings ?? []).filter((m) => m.sales_rep_email === rep.email).length;
              return (
                <div key={rep.id} className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-semibold text-blue-600">
                    {rep.name[0].toUpperCase()}
                  </div>
                  <div>
                    <div className="text-sm font-medium text-gray-800">{rep.name}</div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full ${rep.ms365_user_id ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-400'}`}>
                        {rep.ms365_user_id ? 'MS365 ✓' : 'MS365 needed'}
                      </span>
                      <span className="text-xs text-gray-400">{repMeetings} upcoming</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
