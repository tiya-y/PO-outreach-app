'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import {
  Search, Loader2, Users, ChevronRight, Linkedin, Globe, Star,
  RefreshCw, Sparkles, ArrowRight, CheckCircle, Clock
} from 'lucide-react';
import Link from 'next/link';
import type { Campaign, Prospect } from '@/types';

export default function DiscoverPage() {
  const { id: campaignId } = useParams() as { id: string };
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);
  const [enrichingAll, setEnrichingAll] = useState(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [enrichProgress, setEnrichProgress] = useState<{ done: number; total: number } | null>(null);
  const [page, setPage] = useState(1);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: camp }, { data: prspcts }] = await Promise.all([
      supabase.from('campaigns').select('*').eq('id', campaignId).single(),
      supabase.from('prospects').select('*').eq('campaign_id', campaignId)
        .order('qualification_score', { ascending: false }),
    ]);
    setCampaign(camp);
    setProspects(prspcts ?? []);
    setLoading(false);
  }, [campaignId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Step 1 — Search Apollo and save prospects
  const searchApollo = async () => {
    if (!campaign) return;
    setSearching(true);
    const toastId = toast.loading(`Searching Apollo for POs in ${campaign.city}, ${campaign.state}...`);
    try {
      const res = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, city: campaign.city, state: campaign.state, page }),
      });
      const data = await res.json();
      toast.dismiss(toastId);
      if (data.error) { toast.error(data.error); return; }
      toast.success(`Found ${data.inserted} new prospects`);
      setPage((p) => p + 1);
      await loadData();
    } catch {
      toast.dismiss(toastId);
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  // Step 2 — Enrich & Score all prospects one by one
  const enrichAll = async () => {
    const unscored = prospects.filter((p) => p.qualification_score === 50);
    if (!unscored.length) {
      toast('All prospects are already enriched');
      return;
    }
    setEnrichingAll(true);
    setEnrichProgress({ done: 0, total: unscored.length });
    let done = 0;

    for (const p of unscored) {
      try {
        await fetch('/api/enrich', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prospectId: p.id }),
        });
        done++;
        setEnrichProgress({ done, total: unscored.length });
      } catch {
        done++;
        setEnrichProgress({ done, total: unscored.length });
      }
    }

    await loadData();
    setEnrichingAll(false);
    setEnrichProgress(null);
    toast.success(`Enriched & scored ${done} prospects`);
  };

  // Enrich a single prospect
  const enrichOne = async (prospectId: string) => {
    setEnrichingId(prospectId);
    try {
      const res = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospectId }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      toast.success(`Score updated: ${data.score ?? '—'}`);
      await loadData();
    } catch {
      toast.error('Enrichment failed');
    } finally {
      setEnrichingId(null);
    }
  };

  const clearProspects = async () => {
    if (!confirm(`Delete all ${prospects.length} prospects from this campaign? This cannot be undone.`)) return;
    const toastId = toast.loading('Clearing prospects...');
    const { error } = await supabase.from('prospects').delete().eq('campaign_id', campaignId);
    toast.dismiss(toastId);
    if (error) { toast.error('Failed to clear prospects'); return; }
    toast.success('Prospects cleared');
    await loadData();
    setPage(1);
  };

  const scored = prospects.filter((p) => p.qualification_score !== 50);
  const unscored = prospects.filter((p) => p.qualification_score === 50);

  const scoreColor = (score: number) =>
    score >= 70 ? 'text-green-600 bg-green-50' :
    score >= 45 ? 'text-yellow-600 bg-yellow-50' :
    'text-red-500 bg-red-50';

  const statusBadge = (status: string) => {
    if (status === 'qualified') return 'bg-green-50 text-green-600';
    if (status === 'contacted') return 'bg-blue-50 text-blue-600';
    if (status === 'meeting_booked') return 'bg-purple-50 text-purple-600';
    if (status === 'replied') return 'bg-yellow-50 text-yellow-600';
    return 'bg-gray-100 text-gray-400';
  };

  if (loading) return (
    <div className="p-8 flex items-center gap-2 text-gray-400">
      <Loader2 size={18} className="animate-spin" /> Loading...
    </div>
  );

  return (
    <div className="p-8 max-w-5xl mx-auto">

      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
        <Link href="/campaigns" className="hover:text-gray-700">Campaigns</Link>
        <ChevronRight size={12} />
        <span className="text-gray-700 font-medium">{campaign?.name}</span>
        <ChevronRight size={12} />
        <span>Phase 1 — Discover</span>
      </div>
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-xl font-semibold text-gray-900">
          Prospect Discovery — {campaign?.city}, {campaign?.state}
        </h1>
        <div className="flex items-center gap-2">
          {prospects.length > 0 && (
            <button
              onClick={clearProspects}
              className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors"
            >
              Clear all prospects
            </button>
          )}
          <Link href={`/campaigns/${campaignId}/outreach`}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 bg-gray-100 px-3 py-2 rounded-lg">
            Go to Outreach <ChevronRight size={13} />
          </Link>
        </div>
      </div>

      {/* ── 3-Step Flow ───────────────────────────────────────────────────── */}
      <div className="grid grid-cols-3 gap-4 mb-8">

        {/* Step 1 */}
        <div className={`rounded-xl border p-5 ${prospects.length > 0 ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50'}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${prospects.length > 0 ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'}`}>
              {prospects.length > 0 ? <CheckCircle size={14} /> : '1'}
            </div>
            <span className="text-sm font-semibold text-gray-800">Search Apollo</span>
          </div>
          <p className="text-xs text-gray-500 mb-4">Pull property owners &amp; managers by job title in {campaign?.city}. Each page returns 25 people.</p>
          {prospects.length > 0 && (
            <div className="text-xs text-green-700 font-medium mb-3">{prospects.length} prospects saved</div>
          )}
          <button
            onClick={searchApollo}
            disabled={searching}
            className="w-full flex items-center justify-center gap-2 bg-[#1B4DFF] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#1339CC] disabled:opacity-50 transition-colors"
          >
            {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {searching ? 'Searching...' : prospects.length > 0 ? `Get Next 25 (p${page})` : 'Search Apollo'}
          </button>
        </div>

        {/* Step 2 */}
        <div className={`rounded-xl border p-5 ${scored.length > 0 ? 'border-green-200 bg-green-50' : prospects.length > 0 ? 'border-purple-200 bg-purple-50' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${scored.length > 0 ? 'bg-green-500 text-white' : prospects.length > 0 ? 'bg-purple-500 text-white' : 'bg-gray-300 text-white'}`}>
              {scored.length > 0 ? <CheckCircle size={14} /> : '2'}
            </div>
            <span className="text-sm font-semibold text-gray-800">Enrich &amp; Score</span>
          </div>
          <p className="text-xs text-gray-500 mb-4">Pull company data from Apollo + Ahrefs domain metrics, then score each prospect with Claude.</p>
          {enrichProgress && (
            <div className="mb-3">
              <div className="flex justify-between text-xs text-purple-700 font-medium mb-1">
                <span>Enriching...</span>
                <span>{enrichProgress.done}/{enrichProgress.total}</span>
              </div>
              <div className="h-1.5 bg-purple-100 rounded-full overflow-hidden">
                <div className="h-full bg-purple-500 rounded-full transition-all"
                  style={{ width: `${(enrichProgress.done / enrichProgress.total) * 100}%` }} />
              </div>
            </div>
          )}
          {scored.length > 0 && !enrichProgress && (
            <div className="text-xs text-green-700 font-medium mb-3">{scored.length} scored · {unscored.length} pending</div>
          )}
          <button
            onClick={enrichAll}
            disabled={enrichingAll || prospects.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-[#7C3AED] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#6D28D9] disabled:opacity-40 transition-colors"
          >
            {enrichingAll ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {enrichingAll ? `Scoring ${enrichProgress?.done ?? 0}/${enrichProgress?.total ?? 0}...` : `Enrich & Score All${unscored.length > 0 ? ` (${unscored.length})` : ''}`}
          </button>
        </div>

        {/* Step 3 */}
        <div className={`rounded-xl border p-5 ${scored.filter(p => p.status === 'qualified').length > 0 ? 'border-green-200 bg-green-50' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${scored.filter(p => p.status === 'qualified').length > 0 ? 'bg-green-500 text-white' : 'bg-gray-300 text-white'}`}>
              {scored.filter(p => p.status === 'qualified').length > 0 ? <CheckCircle size={14} /> : '3'}
            </div>
            <span className="text-sm font-semibold text-gray-800">Send Outreach</span>
          </div>
          <p className="text-xs text-gray-500 mb-4">Review scored prospects, then move to Phase 2 to generate and send personalized emails.</p>
          {scored.filter(p => p.status === 'qualified').length > 0 && (
            <div className="text-xs text-green-700 font-medium mb-3">
              {scored.filter(p => p.status === 'qualified').length} qualified &amp; ready
            </div>
          )}
          <Link href={`/campaigns/${campaignId}/outreach`}
            className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              scored.filter(p => p.status === 'qualified').length > 0
                ? 'bg-green-600 text-white hover:bg-green-700'
                : 'bg-gray-200 text-gray-400 pointer-events-none'
            }`}>
            Go to Outreach <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* ── Prospect List ──────────────────────────────────────────────────── */}
      {prospects.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-16 text-center">
          <Users size={32} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500 mb-1">No prospects yet</p>
          <p className="text-xs text-gray-400">Click "Search Apollo" above to pull your first list</p>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-4 gap-3 mb-5">
            {[
              { label: 'Total', value: prospects.length, color: 'text-gray-900' },
              { label: 'Qualified', value: prospects.filter(p => p.status === 'qualified').length, color: 'text-green-600' },
              { label: 'Avg Score', value: scored.length > 0 ? Math.round(scored.reduce((s, p) => s + p.qualification_score, 0) / scored.length) : '—', color: 'text-purple-600' },
              { label: 'Contacted', value: prospects.filter(p => p.status === 'contacted').length, color: 'text-blue-600' },
            ].map((s) => (
              <div key={s.label} className="bg-white rounded-lg border border-gray-100 p-3 text-center">
                <div className={`text-2xl font-semibold ${s.color}`}>{s.value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>

          {/* List */}
          <div className="space-y-2">
            {prospects.map((p) => (
              <div key={p.id} className="bg-white rounded-xl border border-gray-100 px-5 py-3.5 flex items-center gap-4 hover:border-gray-200 transition-colors">

                {/* Avatar */}
                <div className="w-9 h-9 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold text-blue-700">
                  {(p.first_name?.[0] ?? p.company?.[0] ?? '?').toUpperCase()}
                </div>

                {/* Name + title */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">
                      {p.first_name || p.last_name ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : p.company ?? 'Unknown'}
                    </span>
                    {p.email && <span className="text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full">email ✓</span>}
                    {p.portfolio_size && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">~{p.portfolio_size} units</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 truncate">
                    {[p.title, p.company].filter(Boolean).join(' · ')}
                  </div>
                  {/* Enrichment signals */}
                  {p.qualification_notes && p.qualification_score !== 50 && (
                    <div className="text-xs text-gray-400 mt-0.5 italic truncate">{p.qualification_notes}</div>
                  )}
                </div>

                {/* Score */}
                <div className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 ${
                  p.qualification_score === 50 ? 'text-gray-400 bg-gray-100' : scoreColor(p.qualification_score)
                }`}>
                  {p.qualification_score === 50 ? (
                    <span className="flex items-center gap-1"><Clock size={10} /> pending</span>
                  ) : (
                    <span className="flex items-center gap-1"><Star size={10} />{p.qualification_score}</span>
                  )}
                </div>

                {/* Status */}
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium shrink-0 ${statusBadge(p.status)}`}>
                  {p.status}
                </span>

                {/* Links + enrich */}
                <div className="flex items-center gap-2 shrink-0">
                  {p.linkedin_url && (
                    <a href={p.linkedin_url} target="_blank" rel="noreferrer" className="text-gray-300 hover:text-blue-500 transition-colors">
                      <Linkedin size={14} />
                    </a>
                  )}
                  {p.company_website && (
                    <a href={p.company_website} target="_blank" rel="noreferrer" className="text-gray-300 hover:text-blue-500 transition-colors">
                      <Globe size={14} />
                    </a>
                  )}
                  <button
                    onClick={() => enrichOne(p.id)}
                    disabled={enrichingId === p.id || enrichingAll}
                    title="Re-enrich & score"
                    className="text-gray-300 hover:text-purple-500 disabled:opacity-40 transition-colors"
                  >
                    {enrichingId === p.id
                      ? <Loader2 size={14} className="animate-spin" />
                      : <RefreshCw size={14} />
                    }
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
