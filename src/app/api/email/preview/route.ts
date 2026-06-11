import { NextRequest, NextResponse } from 'next/server';
import { generateOutreachEmail } from '@/lib/claude';
import { createServiceClient } from '@/lib/supabase';

// Preview email generation — returns draft WITHOUT saving
export async function POST(req: NextRequest) {
  try {
    const { prospectId, sequenceStep = 1 } = await req.json();
    const supabase = createServiceClient();

    const { data: prospect } = await supabase
      .from('prospects')
      .select('*, campaigns(*)')
      .eq('id', prospectId)
      .single();

    if (!prospect) return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });

    const campaign = prospect.campaigns as Record<string, unknown>;

    const email = await generateOutreachEmail({
      firstName: prospect.first_name ?? 'there',
      lastName: prospect.last_name ?? '',
      title: prospect.title ?? 'Property Manager',
      company: prospect.company ?? 'your company',
      city: prospect.city ?? (campaign?.city as string) ?? '',
      portfolioSize: prospect.portfolio_size ?? undefined,
      compensation: (campaign?.compensation as string) ?? undefined,
      sequenceStep,
    });

    return NextResponse.json({
      prospect: {
        id: prospect.id,
        name: `${prospect.first_name ?? ''} ${prospect.last_name ?? ''}`.trim(),
        email: prospect.email,
        company: prospect.company,
      },
      email,
      sequenceStep,
      _preview: true,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Preview failed', detail: String(error) }, { status: 500 });
  }
}

// Bulk preview for multiple prospects
export async function PUT(req: NextRequest) {
  try {
    const { prospectIds, sequenceStep = 1 } = await req.json();
    const supabase = createServiceClient();

    if (!Array.isArray(prospectIds) || prospectIds.length === 0) {
      return NextResponse.json({ error: 'prospectIds array required' }, { status: 400 });
    }

    const { data: prospects } = await supabase
      .from('prospects')
      .select('*, campaigns(*)')
      .in('id', prospectIds);

    if (!prospects?.length) return NextResponse.json({ error: 'No prospects found' }, { status: 404 });

    const previews = [];
    for (const prospect of prospects) {
      const campaign = prospect.campaigns as Record<string, unknown>;
      try {
        const email = await generateOutreachEmail({
          firstName: prospect.first_name ?? 'there',
          lastName: prospect.last_name ?? '',
          title: prospect.title ?? 'Property Manager',
          company: prospect.company ?? 'your company',
          city: prospect.city ?? (campaign?.city as string) ?? '',
          portfolioSize: prospect.portfolio_size ?? undefined,
          compensation: (campaign?.compensation as string) ?? undefined,
          sequenceStep,
        });

        previews.push({
          prospect: {
            id: prospect.id,
            name: `${prospect.first_name ?? ''} ${prospect.last_name ?? ''}`.trim(),
            email: prospect.email,
            company: prospect.company,
            title: prospect.title,
          },
          email,
          sequenceStep,
          approved: false,
          edited: false,
          _preview: true,
        });
      } catch (e) {
        previews.push({
          prospect: { id: prospect.id, name: `${prospect.first_name ?? ''} ${prospect.last_name ?? ''}`.trim() },
          error: String(e),
        });
      }
    }

    return NextResponse.json({ previews, count: previews.filter((p) => !p.error).length });
  } catch (error) {
    return NextResponse.json({ error: 'Bulk preview failed', detail: String(error) }, { status: 500 });
  }
}
