'use client';

import { useState } from 'react';
import { X, CheckCircle, XCircle, Star, Globe, Linkedin, AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface PreviewProspect {
  first_name?: string;
  last_name?: string;
  email?: string;
  title?: string;
  company?: string;
  company_website?: string;
  linkedin_url?: string;
  city?: string;
  state?: string;
  source?: string;
  qualification_score?: number;
  qualification_notes?: string;
  recommended?: boolean;
  _duplicate?: boolean;
}

interface ProspectPreviewModalProps {
  campaignId: string;
  city: string;
  state: string;
  onClose: () => void;
  onCommit: (count: number) => void;
}

export default function ProspectPreviewModal({ campaignId, city, state, onClose, onCommit }: ProspectPreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [prospects, setProspects] = useState<PreviewProspect[] | null>(null);
  const [summary, setSummary] = useState<{ total: number; fresh: number; duplicates: number; qualified: number; sources: Record<string, number> } | null>(null);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [committing, setCommitting] = useState(false);
  const [page, setPage] = useState(1);

  const runPreview = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/discover/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, city, state, page }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      setProspects(data.prospects);
      setSummary(data.summary);
      // Auto-select all recommended non-duplicates
      const autoSelected = new Set<number>();
      data.prospects.forEach((p: PreviewProspect, i: number) => {
        if (!p._duplicate && p.recommended) autoSelected.add(i);
      });
      setSelected(autoSelected);
    } catch {
      toast.error('Preview failed');
    } finally {
      setLoading(false);
    }
  };

  const commitSelected = async () => {
    if (selected.size === 0) { toast.error('Select at least one prospect'); return; }
    setCommitting(true);
    try {
      const res = await fetch('/api/discover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ campaignId, city, state, page }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      toast.success(`Saved ${data.inserted} prospects`);
      onCommit(data.inserted);
      onClose();
    } catch {
      toast.error('Failed to save');
    } finally {
      setCommitting(false);
    }
  };

  const toggle = (i: number) => setSelected((prev) => {
    const next = new Set(prev);
    if (next.has(i)) next.delete(i); else next.add(i);
    return next;
  });

  const scoreColor = (score?: number) => {
    if (!score) return 'text-gray-400 bg-gray-50';
    if (score >= 70) return 'text-green-600 bg-green-50';
    if (score >= 45) return 'text-yellow-600 bg-yellow-50';
    return 'text-red-500 bg-red-50';
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">Preview Prospects — {city}, {state}</h2>
            <p className="text-xs text-gray-400 mt-0.5">Review before saving to your campaign</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!prospects && !loading && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-4">
                <Star size={22} className="text-blue-500" />
              </div>
              <p className="text-sm text-gray-600 mb-1">This will search Apollo + Ahrefs for property owners in <strong>{city}, {state}</strong></p>
              <p className="text-xs text-gray-400 mb-6">You'll see the full list before anything gets saved</p>
              <button
                onClick={runPreview}
                className="bg-[#1B4DFF] text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-[#1339CC] transition-colors"
              >
                Run Preview
              </button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
              <Loader2 size={28} className="animate-spin text-blue-400" />
              <p className="text-sm">Querying Apollo + Ahrefs... this takes ~15 seconds</p>
            </div>
          )}

          {prospects && summary && (
            <>
              {/* Summary bar */}
              <div className="grid grid-cols-4 gap-3 mb-5">
                {[
                  { label: 'Total Found', value: summary.total, color: 'text-gray-900' },
                  { label: 'New (not duplicate)', value: summary.fresh, color: 'text-blue-600' },
                  { label: 'Auto-qualified', value: summary.qualified, color: 'text-green-600' },
                  { label: 'Already in campaign', value: summary.duplicates, color: 'text-gray-400' },
                ].map((s) => (
                  <div key={s.label} className="bg-gray-50 rounded-xl p-3 text-center">
                    <div className={`text-xl font-semibold ${s.color}`}>{s.value}</div>
                    <div className="text-xs text-gray-400 mt-0.5">{s.label}</div>
                  </div>
                ))}
              </div>

              {/* Source badges */}
              <div className="flex gap-2 mb-4">
                {Object.entries(summary.sources).map(([src, count]) => (
                  <span key={src} className="text-xs bg-indigo-50 text-indigo-600 px-2.5 py-1 rounded-full">
                    {src}: {count}
                  </span>
                ))}
                <button onClick={() => setSelected(new Set(prospects.filter((_, i) => !prospects[i]._duplicate).map((_, i) => i)))}
                  className="text-xs text-blue-500 hover:text-blue-700 ml-auto">Select all new</button>
                <button onClick={() => setSelected(new Set())} className="text-xs text-gray-400 hover:text-gray-600">Clear</button>
              </div>

              {/* Prospect list */}
              <div className="space-y-1.5">
                {prospects.map((p, i) => (
                  <div
                    key={i}
                    onClick={() => !p._duplicate && toggle(i)}
                    className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all cursor-pointer ${
                      p._duplicate ? 'opacity-40 cursor-not-allowed bg-gray-50 border-gray-100' :
                      selected.has(i) ? 'bg-blue-50 border-blue-200' :
                      'bg-white border-gray-100 hover:border-gray-200'
                    }`}
                  >
                    {/* Checkbox */}
                    <div className={`w-4 h-4 rounded border-2 flex items-center justify-center shrink-0 ${
                      selected.has(i) ? 'bg-blue-500 border-blue-500' : 'border-gray-300'
                    }`}>
                      {selected.has(i) && <CheckCircle size={10} className="text-white" />}
                    </div>

                    {/* Avatar */}
                    <div className="w-8 h-8 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center text-xs font-semibold text-blue-700 shrink-0">
                      {(p.first_name?.[0] ?? p.company?.[0] ?? '?').toUpperCase()}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-gray-900 truncate">
                          {p.first_name || p.last_name
                            ? `${p.first_name ?? ''} ${p.last_name ?? ''}`.trim()
                            : p.company ?? 'Unknown'}
                        </span>
                        {p._duplicate && <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Already added</span>}
                        {p.email && !p._duplicate && <span className="text-xs text-green-600 bg-green-50 px-1.5 py-0.5 rounded-full">email ✓</span>}
                      </div>
                      <div className="text-xs text-gray-400 truncate">
                        {[p.title, p.company].filter(Boolean).join(' · ')}
                      </div>
                    </div>

                    {/* Score */}
                    <div className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${scoreColor(p.qualification_score)}`}>
                      {p.qualification_score ?? '—'}
                    </div>

                    {/* Source */}
                    <span className="text-xs text-gray-300 w-14 text-right shrink-0">{p.source}</span>

                    {/* Links */}
                    <div className="flex gap-1.5 shrink-0">
                      {p.linkedin_url && <a href={p.linkedin_url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-gray-300 hover:text-blue-400"><Linkedin size={13} /></a>}
                      {p.company_website && <a href={p.company_website} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="text-gray-300 hover:text-blue-400"><Globe size={13} /></a>}
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        {prospects && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
            <div className="text-sm text-gray-500">
              <strong className="text-gray-900">{selected.size}</strong> selected to save
            </div>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-xl">
                Cancel
              </button>
              <button
                onClick={commitSelected}
                disabled={committing || selected.size === 0}
                className="flex items-center gap-2 bg-[#1B4DFF] text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-[#1339CC] disabled:opacity-40 transition-colors"
              >
                {committing ? <Loader2 size={14} className="animate-spin" /> : <ArrowRight size={14} />}
                Save {selected.size} prospects
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
