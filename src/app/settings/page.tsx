'use client';

import { useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { Settings, Users, Calendar, CheckCircle, XCircle, Plus, Loader2, ExternalLink } from 'lucide-react';

interface SalesRep {
  id: string;
  name: string;
  email: string;
  ms365_user_id: string | null;
  token_expires_at: string | null;
  is_active: boolean;
}

export default function SettingsPage() {
  const [reps, setReps] = useState<SalesRep[]>([]);
  const [newRepEmail, setNewRepEmail] = useState('');
  const [newRepName, setNewRepName] = useState('');
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    supabase.from('sales_reps').select('id, name, email, ms365_user_id, token_expires_at, is_active')
      .then(({ data }) => setReps(data ?? []));
  }, []);

  const addRep = async () => {
    if (!newRepEmail || !newRepName) { toast.error('Name and email required'); return; }
    setAdding(true);
    const { data, error } = await supabase.from('sales_reps').insert({
      name: newRepName,
      email: newRepEmail,
      is_active: true,
    }).select().single();

    if (error) { toast.error(error.message); setAdding(false); return; }
    setReps([...reps, data]);
    setNewRepEmail('');
    setNewRepName('');
    setAdding(false);
    toast.success('Rep added');
  };

  const connectMS365 = (email: string) => {
    window.location.href = `/api/auth/ms365?email=${encodeURIComponent(email)}`;
  };

  const isTokenValid = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) > new Date();
  };

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-8">
        <Settings size={20} className="text-gray-500" />
        <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
      </div>

      {/* Sales reps */}
      <div className="bg-white rounded-xl border border-gray-100 p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <Users size={16} className="text-blue-500" />
          <h2 className="text-sm font-semibold text-gray-900">Sales Team</h2>
        </div>

        <div className="space-y-3 mb-4">
          {reps.map((rep) => (
            <div key={rep.id} className="flex items-center gap-4 p-3 rounded-lg bg-gray-50">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-sm font-semibold text-blue-600">
                {rep.name[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-gray-900">{rep.name}</div>
                <div className="text-xs text-gray-400">{rep.email}</div>
              </div>

              {/* MS365 status */}
              <div className="flex items-center gap-2">
                {rep.ms365_user_id && isTokenValid(rep.token_expires_at) ? (
                  <div className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 px-2.5 py-1 rounded-full">
                    <CheckCircle size={11} />
                    MS365 Connected
                  </div>
                ) : (
                  <button
                    onClick={() => connectMS365(rep.email)}
                    className="flex items-center gap-1.5 text-xs bg-[#1B4DFF] text-white px-3 py-1.5 rounded-lg hover:bg-[#1339CC] transition-colors"
                  >
                    <Calendar size={11} />
                    Connect MS365
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Add new rep */}
        <div className="border border-dashed border-gray-200 rounded-lg p-4">
          <div className="text-xs font-medium text-gray-500 mb-3">Add Sales Rep</div>
          <div className="flex gap-2">
            <input
              type="text"
              placeholder="Full name"
              value={newRepName}
              onChange={(e) => setNewRepName(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="email"
              placeholder="Email"
              value={newRepEmail}
              onChange={(e) => setNewRepEmail(e.target.value)}
              className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              onClick={addRep}
              disabled={adding}
              className="bg-[#1B4DFF] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#1339CC] disabled:opacity-50 flex items-center gap-1.5"
            >
              {adding ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
              Add
            </button>
          </div>
        </div>
      </div>

      {/* API keys reference */}
      <div className="bg-white rounded-xl border border-gray-100 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-4">API Integrations</h2>
        <div className="space-y-3">
          {[
            { name: 'Apollo.io', env: 'APOLLO_API_KEY', url: 'https://developer.apollo.io/', desc: 'Prospect discovery + enrichment' },
            { name: 'Brevo', env: 'BREVO_API_KEY', url: 'https://app.brevo.com/settings/keys/api', desc: 'Email sending + tracking' },
            { name: 'Anthropic Claude', env: 'ANTHROPIC_API_KEY', url: 'https://console.anthropic.com/keys', desc: 'Email copy + pre-call briefs' },
            { name: 'Ahrefs', env: 'AHREFS_API_KEY', url: 'https://app.ahrefs.com/account/api', desc: 'Top-ranking PM domain discovery' },
            { name: 'Microsoft 365', env: 'MS365_CLIENT_ID + SECRET', url: 'https://portal.azure.com', desc: 'Calendar booking (per-rep OAuth)' },
          ].map((api) => (
            <div key={api.name} className="flex items-center gap-4 text-sm">
              <div className="w-32 font-medium text-gray-700 shrink-0">{api.name}</div>
              <code className="text-xs bg-gray-100 px-2 py-0.5 rounded text-gray-600 flex-1 truncate">{api.env}</code>
              <span className="text-xs text-gray-400 w-48 shrink-0">{api.desc}</span>
              <a href={api.url} target="_blank" rel="noreferrer" className="text-blue-400 hover:text-blue-600 shrink-0">
                <ExternalLink size={12} />
              </a>
            </div>
          ))}
        </div>
        <p className="text-xs text-gray-400 mt-4 bg-gray-50 rounded-lg p-3">
          Add these as environment variables in your Vercel project settings. Keys are never stored in the database.
        </p>
      </div>
    </div>
  );
}
