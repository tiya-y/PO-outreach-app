'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import {
  Search, Loader2, Users, ChevronRight, Linkedin, Globe, Star,
  RefreshCw, Sparkles, ArrowRight, CheckCircle, Clock, Trash2
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
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [movingToOutreach, setMovingToOutreach] = useState(false);
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

  // Step 1 — Search Apollo
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

  // Step 2 — Enrich & Score (no email reveal)
  const enrichAll = async () => {
    const unscored = prospects.filter((p) => p.qualification_score === 50);
    if (!unscored.length) { toast('All prospects are already scored'); return; }
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
      } catch { /* continue */ }
      done++;
      setEnrichProgress({ done, total: unscored.length });
    }
    await loadData();
    setEnrichingAll(false);
    setEnrichProgress(null);
    toast.success(`Scored ${done} prospects — select the ones to contact`);
  };

  // Single enrich
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
      toast.success(`Score: ${data.score ?? '—'}`);
      await loadData();
    } catch { toast.error('Enrichment failed'); }
    finally { setEnrichingId(null); }
  };

  // Clear all prospects
  const clearProspects = async () => {
    if (!confirm(`Delete all ${prospects.length} prospects from this campaign? This cannot be undone.`)) return;
    const toastId = toast.loading('Clearing prospects...');
    const { error } = await supabase.from('prospects').delete().eq('campaign_id', campaignId);
    toast.dismiss(toastId);
    if (error) { toast.error('Failed to clear prospects'); return; }
    toast.success('Prospects cleared');
    setSelected(new Set());
    await loadData();
    setPage(1);
  };

  // Step 3 — Move selected to outreach (email revealed at generate time)
  const moveToOutreach = async () => {
    if (!selected.size) return;
    setMovingToOutreach(true);
    const { error } = await supabase
      .from('prospects')
      .update({ status: 'qualified' })
      .in('id', Array.from(selected));
    setMovingToOutreach(false);
    if (error) { toast.error('Failed to update status'); return; }
    toast.success(`${selected.size} prospects moved to outreach`);
    setSelected(new Set());
    await loadData();
  };

  // Selection helpers
  const toggle = (id: string) => setSelected((prev) => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const selectSuggested = () => {
    const suggested = scored.filter((p) => p.qualification_score >= 60).map((p) => p.id);
    setSelected(new Set(suggested));
  };

  const selectAll = () => setSelected(new Set(prospects.map((p) => p.id)));
  const clearSelection = () => setSelected(new Set());

  const scored = prospects.filter((p) => p.qualification_score !== 50);
  const unscored = prospects.filter((p) => p.qualification_score === 50);
  const suggested = scored.filter((p) => p.qualification_score >= 60);

  const scoreColor = (score: number) =>
    score >= 70 ? 'text-green-600 bg-green-50 border-green-200' :
    score >= 60 ? 'text-blue-600 bg-blue-50 border-blue-200' :
    score >= 45 ? 'text-yellow-600 bg-yellow-50 border-yellow-200' :
    'text-red-500 bg-red-50 border-red-200';

  const rowBg = (p: Prospect) => {
    if (selected.has(p.id)) return 'border-[#1B4DFF] bg-blue-50/40';
    if (p.qualification_score >= 70) return 'border-green-100 bg-white hover:border-green-200';
    if (p.qualification_score >= 60) return 'border-blue-100 bg-white hover:border-blue-200';
    if (p.qualification_score === 50) return 'border-gray-100 bg-white hover:border-gray-200';
    return 'border-gray-100 bg-white opacity-75 hover:border-gray-200';
  };

  if (loading) return (
    <div className="p-8 flex items-center gap-2 text-gray-400">
      <Loader2 size={18} className="animate-spin" /> Loading...
    </div>
  );

  return (
    <div className="p-8 max-w-5xl mx-auto">

      {/* Breadcrumb + actions */}
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
            <button onClick={clearProspects}
              className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-600 bg-red-50 hover:bg-red-100 px-3 py-2 rounded-lg transition-colors">
              <Trash2 size={13} /> Clear all
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

        {/* Step 1 — Search */}
        <div className={`rounded-xl border p-5 ${prospects.length > 0 ? 'border-green-200 bg-green-50' : 'border-blue-200 bg-blue-50'}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${prospects.length > 0 ? 'bg-green-500 text-white' : 'bg-blue-500 text-white'}`}>
              {prospects.length > 0 ? <CheckCircle size={14} /> : '1'}
            </div>
            <span className="text-sm font-semibold text-gray-800">Search Apollo</span>
          </div>
          <p className="text-xs text-gray-500 mb-4">Pull property owners &amp; managers by title in {campaign?.city}. Each page = 25 people.</p>
          {prospects.length > 0 && (
            <div className="text-xs text-green-700 font-medium mb-3">{prospects.length} prospects saved</div>
          )}
          <button onClick={searchApollo} disabled={searching}
            className="w-full flex items-center justify-center gap-2 bg-[#1B4DFF] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#1339CC] disabled:opacity-50 transition-colors">
            {searching ? <Loader2 size={14} className="animate-spin" /> : <Search size={14} />}
            {searching ? 'Searching...' : prospects.length > 0 ? `Get Next 25 (p${page})` : 'Search Apollo'}
          </button>
        </div>

        {/* Step 2 — Enrich & Score (no email) */}
        <div className={`rounded-xl border p-5 ${scored.length > 0 ? 'border-green-200 bg-green-50' : prospects.length > 0 ? 'border-purple-200 bg-purple-50' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${scored.length > 0 ? 'bg-green-500 text-white' : prospects.length > 0 ? 'bg-purple-500 text-white' : 'bg-gray-300 text-white'}`}>
              {scored.length > 0 ? <CheckCircle size={14} /> : '2'}
            </div>
            <span className="text-sm font-semibold text-gray-800">Enrich &amp; Score</span>
          </div>
          <p className="text-xs text-gray-500 mb-4">Pull company data + Ahrefs rankings. Claude scores each prospect. <span className="font-medium text-purple-600">No email credits spent yet.</span></p>
          {enrichProgress && (
            <div className="mb-3">
              <div className="flex justify-between text-xs text-purple-700 font-medium mb-1">
                <span>Scoring...</span>
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
          <button onClick={enrichAll} disabled={enrichingAll || prospects.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-[#7C3AED] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#6D28D9] disabled:opacity-40 transition-colors">
            {enrichingAll ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
            {enrichingAll ? `Scoring ${enrichProgress?.done ?? 0}/${enrichProgress?.total ?? 0}...` : `Enrich & Score${unscored.length > 0 ? ` (${unscored.length})` : ''}`}
          </button>
        </div>

        {/* Step 3 — Select & Move */}
        <div className={`rounded-xl border p-5 ${selected.size > 0 ? 'border-blue-200 bg-blue-50' : scored.length > 0 ? 'border-orange-200 bg-orange-50' : 'border-gray-200 bg-gray-50'}`}>
          <div className="flex items-center gap-2 mb-3">
            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${selected.size > 0 ? 'bg-blue-500 text-white' : scored.length > 0 ? 'bg-orange-500 text-white' : 'bg-gray-300 text-white'}`}>
              {selected.size > 0 ? selected.size : '3'}
            </div>
            <span className="text-sm font-semibold text-gray-800">Select &amp; Move</span>
          </div>
          <p className="text-xs text-gray-500 mb-2">Check the prospects to contact. Emails are revealed <span className="font-medium text-orange-600">only when you generate outreach</span> (1 credit each).</p>
          {suggested.length > 0 && (
            <button onClick={selectSuggested}
              className="w-full text-xs text-orange-700 bg-orange-100 hover:bg-orange-200 px-3 py-1.5 rounded-lg mb-2 transition-colors font-medium">
              ✨ Select suggested ({suggested.length} scored 60+)
            </button>
          )}
          {selected.size > 0 && (
            <div className="text-xs text-blue-700 font-medium mb-2">{selected.size} selected</div>
          )}
          <button onClick={moveToOutreach}
            disabled={selected.size === 0 || movingToOutreach || scored.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-[#1B4DFF] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#1339CC] disabled:opacity-40 transition-colors">
            {movingToOutreach ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
            {selected.size > 0 ? `Move ${selected.size} to Outreach` : 'Move to Outreach'}
          </button>
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
          {/* Stats + bulk selection */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3 text-xs text-gray-500">
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-400 inline-block" /> {scored.filter(p => p.qualification_score >= 70).length} strong</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-blue-400 inline-block" /> {scored.filter(p => p.qualification_score >= 60 && p.qualification_score < 70).length} good</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" /> {scored.filter(p => p.qualification_score >= 45 && p.qualification_score < 60).length} fair</span>
                <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-gray-300 inline-block" /> {unscored.length} pending</span>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs">
              {selected.size > 0 && (
                <button onClick={clearSelection} className="text-gray-400 hover:text-gray-600 px-2 py-1 rounded transition-colors">
                  Clear selection
                </button>
              )}
              <button onClick={selectAll} className="text-gray-500 hover:text-gray-700 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg transition-colors font-medium">
                Select all
              </button>
            </div>
          </div>

          <div className="space-y-2">
            {prospects.map((p) => (
              <div
                key={p.id}
                onClick={() => toggle(p.id)}
                className={`rounded-xl border px-4 py-3.5 flex items-center gap-3 cursor-pointer transition-all ${rowBg(p)}`}
              >
                {/* Checkbox */}
                <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                  selected.has(p.id) ? 'bg-[#1B4DFF] border-[#1B4DFF]' : 'border-gray-300 bg-white'
                }`}>
                  {selected.has(p.id) && <CheckCircle size={13} className="text-white" />}
                </div>

                {/* Avatar */}
                <div className="w-8 h-8 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold text-blue-700">
                  {(p.first_name?.[0] ?? p.company?.[0] ?? '?').toUpperCase()}
                </div>

                {/* Name + info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-medium text-gray-900">
                      {p.first_name || p.last_name ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : p.company ?? 'Unknown'}
                    </span>
                    {p.portfolio_size && (
                      <span className="text-xs bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full border border-blue-100">~{p.portfolio_size} units</span>
                    )}
                    {p.status === 'qualified' && (
                      <span className="text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full border border-green-100">in outreach</span>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 mt-0.5 truncate">
                    {[p.title, p.company].filter(Boolean).join(' · ')}
                  </div>
                  {p.qualification_notes && p.qualification_score !== 50 && (
                    <div className="text-xs text-gray-400 mt-0.5 italic truncate">{p.qualification_notes}</div>
                  )}
                </div>

                {/* Score badge */}
                <div className={`text-xs font-semibold px-2.5 py-1 rounded-full shrink-0 border ${
                  p.qualification_score === 50
                    ? 'text-gray-400 bg-gray-50 border-gray-200'
                    : scoreColor(p.qualification_score)
                }`}>
                  {p.qualification_score === 50 ? (
                    <span className="flex items-center gap-1"><Clock size={10} /> pending</span>
                  ) : (
                    <span className="flex items-center gap-1"><Star size={10} />{p.qualification_score}</span>
                  )}
                </div>

                {/* Links + re-enrich */}
                <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
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
                  <button onClick={() => enrichOne(p.id)} disabled={enrichingId === p.id || enrichingAll}
                    title="Re-score" className="text-gray-300 hover:text-purple-500 disabled:opacity-40 transition-colors">
                    {enrichingId === p.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
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
