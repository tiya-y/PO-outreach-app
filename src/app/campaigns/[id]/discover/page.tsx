'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import {
  Search, Loader2, Users, ChevronRight, Linkedin, Globe, Star,
  RefreshCw, Filter, Eye, ArrowRight, Beaker
} from 'lucide-react';
import Link from 'next/link';
import ProspectPreviewModal from '@/components/ProspectPreviewModal';
import type { Campaign, Prospect } from '@/types';

export default function DiscoverPage() {
  const { id: campaignId } = useParams() as { id: string };
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [enrichingId, setEnrichingId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'qualified' | 'new'>('all');
  const [page, setPage] = useState(1);
  const [showPreview, setShowPreview] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [{ data: camp }, { data: prspcts }] = await Promise.all([
      supabase.from('campaigns').select('*').eq('id', campaignId).single(),
      supabase.from('prospects').select('*').eq('campaign_id', campaignId).order('qualification_score', { ascending: false }),
    ]);
    setCampaign(camp);
    setProspects(prspcts ?? []);
    setLoading(false);
  }, [campaignId]);

  useEffect(() => { loadData(); }, [loadData]);

  // Direct run (skip preview) — for re-runs when you've already reviewed
  const runDirectly = async () => {
    if (!campaign) return;
    setDiscovering(true);
    const toastId = toast.loading('Discovering prospects...');
    try {
      const res = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, city: campaign.city, state: campaign.state, page }),
      });
      const data = await res.json();
      toast.dismiss(toastId);
      if (data.error) { toast.error(data.error); return; }
      toast.success(`Saved ${data.inserted} new prospects`);
      setPage((p) => p + 1);
      await loadData();
    } catch {
      toast.dismiss(toastId);
      toast.error('Discovery failed');
    } finally {
      setDiscovering(false);
    }
  };

  const enrichProspect = async (prospectId: string) => {
    setEnrichingId(prospectId);
    try {
      const res = await fetch('/api/enrich', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospectId }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      toast.success(`Enriched: ${data.updated_fields.join(', ')}`);
      await loadData();
    } catch {
      toast.error('Enrichment failed');
    } finally {
      setEnrichingId(null);
    }
  };

  const filtered = prospects.filter((p) => filter === 'all' ? true : p.status === filter);
  const scoreColor = (score: number) =>
    score >= 70 ? 'text-green-600 bg-green-50' :
    score >= 45 ? 'text-yellow-600 bg-yellow-50' :
    'text-red-500 bg-red-50';

  if (loading) return <div className="p-8 flex items-center gap-2 text-gray-400"><Loader2 size={18} className="animate-spin" /> Loading...</div>;

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {showPreview && campaign && (
        <ProspectPreviewModal
          campaignId={campaignId}
          city={campaign.city}
          state={campaign.state}
          onClose={() => setShowPreview(false)}
          onCommit={(count) => { loadData(); setPage((p) => p + 1); }}
        />
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="flex items-center gap-2 text-sm text-gray-400 mb-1">
            <Link href="/campaigns" className="hover:text-gray-700">Campaigns</Link>
            <ChevronRight size={12} />
            <span className="text-gray-700 font-medium">{campaign?.name}</span>
            <ChevronRight size={12} />
            <span>Phase 1 — Discover</span>
          </div>
          <h1 className="text-xl font-semibold text-gray-900">
            Prospect Discovery — {campaign?.city}, {campaign?.state}
          </h1>
        </div>

        <div className="flex items-center gap-2">
          {/* Preview first (recommended) */}
          <button
            onClick={() => setShowPreview(true)}
            className="flex items-center gap-2 bg-[#1B4DFF] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#1339CC] transition-colors"
          >
            <Beaker size={15} />
            Preview & Import
          </button>

          {/* Direct run (secondary) */}
          <button
            onClick={runDirectly}
            disabled={discovering}
            title="Skip preview and save directly"
            className="flex items-center gap-2 bg-[#2D3748] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#374151] transition-colors disabled:opacity-50"
          >
            {discovering ? <Loader2 size={15} className="animate-spin" /> : <Search size={15} />}
            {discovering ? 'Running...' : `Direct Run (p${page})`}
          </button>

          <Link href={`/campaigns/${campaignId}/outreach`}
            className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors">
            Outreach <ChevronRight size={14} />
          </Link>
        </div>
      </div>

      {/* Preview callout (first time) */}
      {prospects.length === 0 && (
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-5 mb-6 flex items-start gap-3">
          <Eye size={18} className="text-blue-500 mt-0.5 shrink-0" />
          <div>
            <div className="text-sm font-semibold text-blue-800 mb-0.5">Start with Preview & Import</div>
            <p className="text-sm text-blue-700">See the full prospect list from Apollo + Ahrefs before anything gets saved. Review, approve, and deselect duplicates in one step.</p>
          </div>
        </div>
      )}

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Total Found', value: prospects.length, color: 'text-gray-900' },
          { label: 'Qualified', value: prospects.filter((p) => p.status === 'qualified').length, color: 'text-green-600' },
          { label: 'Contacted', value: prospects.filter((p) => p.status === 'contacted').length, color: 'text-blue-600' },
          { label: 'Meeting Booked', value: prospects.filter((p) => p.status === 'meeting_booked').length, color: 'text-purple-600' },
        ].map((s) => (
          <div key={s.label} className="bg-white rounded-lg border border-gray-100 p-4 text-center">
            <div className={`text-2xl font-semibold ${s.color}`}>{s.value}</div>
            <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filter */}
      <div className="flex items-center gap-2 mb-4">
        <Filter size={14} className="text-gray-400" />
        {(['all', 'qualified', 'new'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={`text-xs px-3 py-1.5 rounded-full font-medium transition-colors ${filter === f ? 'bg-[#1B4DFF] text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
            {f === 'all' ? `All (${prospects.length})` : f === 'qualified' ? `Qualified (${prospects.filter(p => p.status === 'qualified').length})` : `Needs Review`}
          </button>
        ))}
      </div>

      {/* Prospect list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-16 text-center">
          <Users size={32} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm text-gray-500 mb-2">No prospects yet</p>
          <button onClick={() => setShowPreview(true)}
            className="inline-flex items-center gap-1.5 bg-[#1B4DFF] text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Beaker size={13} /> Preview & Import
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <div key={p.id} className="bg-white rounded-xl border border-gray-100 px-5 py-3.5 flex items-center gap-4">
              <div className="w-9 h-9 bg-gradient-to-br from-blue-50 to-indigo-100 rounded-full flex items-center justify-center shrink-0 text-sm font-semibold text-blue-700">
                {(p.first_name?.[0] ?? p.company?.[0] ?? '?').toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {p.first_name || p.last_name ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim() : p.company ?? 'Unknown'}
                  </span>
                  {p.email && <span className="text-xs bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full">email ✓</span>}
                </div>
                <div className="text-xs text-gray-400 mt-0.5">
                  {[p.title, p.company].filter(Boolean).join(' · ')}
                  {p.portfolio_size && <span className="ml-2 text-blue-500">~{p.portfolio_size} units</span>}
                </div>
              </div>
              <div className={`text-xs font-semibold px-2.5 py-1 rounded-full ${scoreColor(p.qualification_score)}`}>
                <Star size={10} className="inline mr-0.5 mb-0.5" />{p.qualification_score}
              </div>
              <div className="text-xs text-gray-300 shrink-0">{p.source}</div>
              <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                p.status === 'qualified' ? 'bg-green-50 text-green-600' :
                p.status === 'contacted' ? 'bg-blue-50 text-blue-600' :
                p.status === 'meeting_booked' ? 'bg-purple-50 text-purple-600' :
                p.status === 'replied' ? 'bg-yellow-50 text-yellow-600' :
                'bg-gray-100 text-gray-500'
              }`}>{p.status}</span>
              <div className="flex items-center gap-2 shrink-0">
                {p.linkedin_url && <a href={p.linkedin_url} target="_blank" rel="noreferrer" className="text-gray-300 hover:text-blue-500"><Linkedin size={14} /></a>}
                {p.company_website && <a href={p.company_website} target="_blank" rel="noreferrer" className="text-gray-300 hover:text-blue-500"><Globe size={14} /></a>}
                <button onClick={() => enrichProspect(p.id)} disabled={enrichingId === p.id} title="Enrich" className="text-gray-300 hover:text-indigo-500 disabled:opacity-40">
                  {enrichingId === p.id ? <Loader2 size={14} className="animate-spin" /> : <RefreshCw size={14} />}
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
