'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import toast from 'react-hot-toast';
import { MapPin, ArrowLeft, Loader2, Gift } from 'lucide-react';
import Link from 'next/link';

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA',
  'KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ',
  'NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT',
  'VA','WA','WV','WI','WY','DC',
];

export default function NewCampaignPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    city: '',
    state: 'OH',
    min_units: 5,
    compensation: '',
    target_role: ['Property Manager', 'Property Owner', 'Real Estate Investor', 'Landlord'],
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.city || !form.name) {
      toast.error('Campaign name and city are required');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.from('campaigns').insert({
        name: form.name,
        city: form.city,
        state: form.state,
        min_units: form.min_units,
        compensation: form.compensation || null,
        target_role: form.target_role,
        status: 'active',
      }).select().single();

      if (error) throw error;
      toast.success('Campaign created!');
      router.push(`/campaigns/${data.id}/discover`);
    } catch (err) {
      toast.error('Failed to create campaign');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <Link href="/campaigns" className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeft size={14} /> Back to Campaigns
      </Link>

      <div className="bg-white rounded-xl border border-gray-100 p-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
            <MapPin size={18} className="text-blue-500" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">New Campaign</h1>
            <p className="text-sm text-gray-400">Target a city and launch all 4 outreach phases</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Campaign name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Campaign Name</label>
            <input
              type="text"
              placeholder="e.g. Columbus OH — Q3 2026"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              required
            />
          </div>

          {/* City + State */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">City</label>
              <input
                type="text"
                placeholder="e.g. Columbus"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">State</label>
              <select
                value={form.state}
                onChange={(e) => setForm({ ...form, state: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {US_STATES.map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
          </div>

          {/* Min portfolio size */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Min Portfolio Size (units)
              <span className="text-gray-400 font-normal ml-1">— filter out too-small landlords</span>
            </label>
            <input
              type="number"
              min={1}
              max={1000}
              value={form.min_units}
              onChange={(e) => setForm({ ...form, min_units: parseInt(e.target.value) })}
              className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {/* Compensation offer */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              <div className="flex items-center gap-1.5">
                <Gift size={14} className="text-orange-400" />
                Switch Incentive
                <span className="text-gray-400 font-normal">(optional — included in email copy)</span>
              </div>
            </label>
            <input
              type="text"
              placeholder="e.g. 3 months free + free migration support"
              value={form.compensation}
              onChange={(e) => setForm({ ...form, compensation: e.target.value })}
              className="w-full border border-gray-200 rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <p className="text-xs text-gray-400 mt-1">Leave blank to let AI choose the best angle for each prospect</p>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-[#1B4DFF] text-white py-3 rounded-lg text-sm font-medium hover:bg-[#1339CC] transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader2 size={16} className="animate-spin" />
                Creating...
              </>
            ) : 'Create Campaign & Start Discovery →'}
          </button>
        </form>
      </div>
    </div>
  );
}
