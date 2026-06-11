import { createServiceClient } from '@/lib/supabase';
import Link from 'next/link';
import { Plus, MapPin, Users, Mail, Calendar, ChevronRight, Play, Pause } from 'lucide-react';
import { format } from 'date-fns';

export const dynamic = 'force-dynamic';

export default async function CampaignsPage() {
  const supabase = createServiceClient();
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('*')
    .order('created_at', { ascending: false });

  return (
    <div className="p-8 max-w-6xl mx-auto">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Campaigns</h1>
          <p className="text-sm text-gray-500 mt-0.5">Each campaign targets a city. Run all 4 phases per campaign.</p>
        </div>
        <Link
          href="/campaigns/new"
          className="flex items-center gap-2 bg-[#1B4DFF] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#1339CC] transition-colors"
        >
          <Plus size={16} />
          New Campaign
        </Link>
      </div>

      {(!campaigns || campaigns.length === 0) ? (
        <div className="bg-white rounded-xl border border-dashed border-gray-200 p-16 text-center">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <MapPin size={20} className="text-blue-500" />
          </div>
          <h3 className="text-base font-semibold text-gray-800 mb-1">No campaigns yet</h3>
          <p className="text-sm text-gray-400 mb-4">Create your first campaign to start finding property owners in a city.</p>
          <Link href="/campaigns/new" className="inline-flex items-center gap-2 bg-[#1B4DFF] text-white px-4 py-2 rounded-lg text-sm font-medium">
            <Plus size={14} /> Create Campaign
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {campaigns.map((c) => (
            <div key={c.id} className="bg-white rounded-xl border border-gray-100 p-6 flex items-center gap-6 hover:border-blue-100 transition-colors">
              {/* Status dot */}
              <div className={`w-2 h-2 rounded-full shrink-0 ${c.status === 'active' ? 'bg-green-400' : c.status === 'paused' ? 'bg-yellow-400' : 'bg-gray-300'}`} />

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">{c.name}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                    c.status === 'active' ? 'bg-green-50 text-green-600' :
                    c.status === 'paused' ? 'bg-yellow-50 text-yellow-600' :
                    'bg-gray-100 text-gray-500'
                  }`}>{c.status}</span>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                  <MapPin size={11} />
                  {c.city}, {c.state}
                </div>
              </div>

              {/* Stats */}
              <div className="flex gap-8">
                {[
                  { icon: Users, value: c.prospect_count, label: 'Prospects' },
                  { icon: Mail, value: c.contacted_count, label: 'Contacted' },
                  { icon: Calendar, value: c.meeting_count, label: 'Meetings' },
                ].map(({ icon: Icon, value, label }) => (
                  <div key={label} className="text-center">
                    <div className="text-xl font-semibold text-gray-900">{value ?? 0}</div>
                    <div className="text-xs text-gray-400">{label}</div>
                  </div>
                ))}
              </div>

              {/* Phase buttons */}
              <div className="flex items-center gap-2">
                <Link href={`/campaigns/${c.id}/discover`} className="text-xs px-3 py-1.5 bg-[#2D3748] text-white rounded-lg hover:bg-[#374151] transition-colors">
                  Discover
                </Link>
                <Link href={`/campaigns/${c.id}/outreach`} className="text-xs px-3 py-1.5 bg-[#1E4033] text-white rounded-lg hover:bg-[#245240] transition-colors">
                  Outreach
                </Link>
                <Link href={`/campaigns/${c.id}/meetings`} className="text-xs px-3 py-1.5 bg-[#3B1F5E] text-white rounded-lg hover:bg-[#4A2875] transition-colors">
                  Convert
                </Link>
                <Link href={`/campaigns/${c.id}`} className="p-2 text-gray-400 hover:text-blue-500 transition-colors">
                  <ChevronRight size={16} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
