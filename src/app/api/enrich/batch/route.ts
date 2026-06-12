import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase';

export const maxDuration = 60;

// Batch enrich all unscored prospects in a campaign
export async function POST(req: NextRequest) {
  try {
    const { campaignId } = await req.json();
    const supabase = createServiceClient();

    const { data: prospects } = await supabase
      .from('prospects')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('qualification_score', 50) // only unscored ones
      .limit(50);

    if (!prospects?.length) {
      return NextResponse.json({ message: 'No prospects to enrich', enriched: 0 });
    }

    let enriched = 0;
    const errors: string[] = [];

    for (const prospect of prospects) {
      try {
        const res = await fetch(
          `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/enrich`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prospectId: prospect.id }),
          }
        );
        const data = await res.json();
        if (data.success) enriched++;
        else errors.push(`${prospect.first_name ?? prospect.company}: ${data.error}`);
      } catch (e) {
        errors.push(`${prospect.first_name ?? prospect.company}: ${String(e)}`);
      }
    }

    return NextResponse.json({ enriched, total: prospects.length, errors });
  } catch (error) {
    return NextResponse.json({ error: 'Batch enrich failed', detail: String(error) }, { status: 500 });
  }
}
