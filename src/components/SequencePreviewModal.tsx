'use client';

import { useState } from 'react';
import { X, Loader2, CheckCircle, XCircle, Edit3, Zap, Calendar, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { format, addDays } from 'date-fns';

interface SequenceStep {
  step: number;
  subject: string;
  body: string;
  scheduledFor: string;
  delayLabel: string;
  approved: boolean;
  edited: boolean;
  error?: string;
}

interface SequencePreviewModalProps {
  prospectId: string;
  prospectName: string;
  onClose: () => void;
  onLaunched: () => void;
}

export default function SequencePreviewModal({ prospectId, prospectName, onClose, onLaunched }: SequencePreviewModalProps) {
  const [loading, setLoading] = useState(false);
  const [steps, setSteps] = useState<SequenceStep[] | null>(null);
  const [prospectEmail, setProspectEmail] = useState<string>('');
  const [launching, setLaunching] = useState(false);
  const [expandedStep, setExpandedStep] = useState<number | null>(1);
  const [editingStep, setEditingStep] = useState<number | null>(null);
  const [editValues, setEditValues] = useState({ subject: '', body: '' });

  const generatePreview = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/sequences/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospectId }),
      });
      const data = await res.json();
      if (data.error) { toast.error(data.error); return; }
      setSteps(data.emails);
      setProspectEmail(data.prospect.email ?? '');
      setExpandedStep(1);
    } catch {
      toast.error('Preview failed');
    } finally {
      setLoading(false);
    }
  };

  const toggleStep = (step: number) => {
    setSteps((prev) => prev?.map((s) => s.step === step ? { ...s, approved: !s.approved } : s) ?? null);
  };

  const saveEdit = (step: number) => {
    setSteps((prev) => prev?.map((s) =>
      s.step === step ? { ...s, subject: editValues.subject, body: editValues.body, edited: true } : s
    ) ?? null);
    setEditingStep(null);
  };

  const launchSequence = async () => {
    setLaunching(true);
    const toastId = toast.loading('Launching sequence...');
    try {
      const res = await fetch('/api/sequences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prospectId }),
      });
      const data = await res.json();
      toast.dismiss(toastId);
      if (data.error) { toast.error(data.error); return; }
      toast.success(`Sequence launched — ${data.count} emails queued`);
      onLaunched();
      onClose();
    } catch {
      toast.dismiss(toastId);
      toast.error('Launch failed');
    } finally {
      setLaunching(false);
    }
  };

  const approvedCount = steps?.filter((s) => s.approved && !s.error).length ?? 0;

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div>
            <h2 className="text-base font-semibold text-gray-900">5-Step Sequence Preview</h2>
            <p className="text-xs text-gray-400 mt-0.5">{prospectName} · {prospectEmail}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          {!steps && !loading && (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mb-4">
                <Zap size={22} className="text-indigo-500" />
              </div>
              <p className="text-sm text-gray-600 mb-1">Preview all 5 follow-up emails for <strong>{prospectName}</strong></p>
              <p className="text-xs text-gray-400 mb-6">Sent on: Day 0, 3, 7, 14, 21 — you can edit any step</p>
              <button onClick={generatePreview} className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700">
                Generate Preview
              </button>
            </div>
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-gray-400">
              <Loader2 size={28} className="animate-spin text-indigo-400" />
              <p className="text-sm">Writing 5 emails — each with a different angle...</p>
            </div>
          )}

          {steps && (
            <div className="space-y-2">
              {steps.map((step) => {
                const isExpanded = expandedStep === step.step;
                const isEditing = editingStep === step.step;

                return (
                  <div key={step.step} className={`rounded-xl border transition-all ${
                    step.error ? 'border-red-100 bg-red-50' :
                    step.approved ? 'border-indigo-200 bg-indigo-50/20' :
                    'border-gray-100 bg-gray-50'
                  }`}>
                    <div className="flex items-center gap-3 px-4 py-3 cursor-pointer" onClick={() => setExpandedStep(isExpanded ? null : step.step)}>
                      {/* Step badge */}
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-semibold shrink-0 ${
                        step.step === 1 ? 'bg-indigo-500 text-white' : 'bg-gray-200 text-gray-600'
                      }`}>
                        {step.step}
                      </div>

                      {/* Subject + delay */}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{step.subject}</div>
                        <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
                          <Calendar size={10} />
                          <span>{step.delayLabel}</span>
                          {step.edited && <span className="text-blue-400 ml-1">· edited</span>}
                        </div>
                      </div>

                      {/* Toggle + edit */}
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={(e) => { e.stopPropagation(); toggleStep(step.step); }}
                          className={`transition-colors ${step.approved ? 'text-green-500' : 'text-gray-300'}`}>
                          {step.approved ? <CheckCircle size={16} /> : <XCircle size={16} />}
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); setEditingStep(step.step); setEditValues({ subject: step.subject, body: step.body }); }}
                          className="text-gray-300 hover:text-blue-400 transition-colors">
                          <Edit3 size={13} />
                        </button>
                        {isExpanded ? <ChevronUp size={14} className="text-gray-400" /> : <ChevronDown size={14} className="text-gray-400" />}
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                        {isEditing ? (
                          <div className="space-y-2">
                            <input value={editValues.subject} onChange={(e) => setEditValues({ ...editValues, subject: e.target.value })}
                              className="w-full border border-blue-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400" />
                            <textarea value={editValues.body} onChange={(e) => setEditValues({ ...editValues, body: e.target.value })}
                              rows={6} className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-400" />
                            <div className="flex gap-2">
                              <button onClick={() => setEditingStep(null)} className="text-xs px-3 py-1.5 border border-gray-200 rounded-lg text-gray-500">Cancel</button>
                              <button onClick={() => saveEdit(step.step)} className="text-xs px-3 py-1.5 bg-blue-500 text-white rounded-lg">Save</button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-sm text-gray-600 whitespace-pre-line leading-relaxed">{step.body}</p>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Footer */}
        {steps && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/50 rounded-b-2xl">
            <p className="text-sm text-gray-500"><strong className="text-gray-900">{approvedCount}</strong> steps active</p>
            <div className="flex gap-3">
              <button onClick={onClose} className="px-4 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl">Cancel</button>
              <button onClick={launchSequence} disabled={launching || approvedCount === 0}
                className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2 rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-40">
                {launching ? <Loader2 size={14} className="animate-spin" /> : <Zap size={14} />}
                Launch Sequence
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
