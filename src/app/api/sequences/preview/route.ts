import { NextRequest, NextResponse } from 'next/server';
import { generateOutreachEmail } from '@/lib/claude';
import { createServiceClient } from '@/lib/supabase';

const DELAY_DAYS = [0, 3, 7, 14, 21];

// Preview all 5 sequence steps WITHOUT saving
export async function POST(req: NextRequest) {
  try {
    const { prospectId, steps = 5 } = await req.json();
    const supabase = createServiceClient();

    const { data: prospect } = await supabase
      .from('prospects')
      .select('*, campaigns(*)')
      .eq('id', prospectId)
      .single();

    if (!prospect) return NextResponse.json({ error: 'Prospect not found' }, { status: 404 });
    if (!prospect.email) return NextResponse.json({ error: 'Prospect has no email' }, { status: 400 });

    const campaign = prospect.campaigns as Record<string, unknown>;
    const emails = [];

    for (let step = 1; step <= steps; step++) {
      try {
        const email = await generateOutreachEmail({
          firstName: prospect.first_name ?? 'there',
          lastName: prospect.last_name ?? '',
          title: prospect.title ?? 'Property Manager',
          company: prospect.company ?? 'your company',
          city: prospect.city ?? (campaign?.city as string) ?? '',
          portfolioSize: prospect.portfolio_size ?? undefined,
          compensation: (campaign?.compensation as string) ?? undefined,
          sequenceStep: step,
        });

        const scheduledFor = new Date(Date.now() + DELAY_DAYS[step - 1] * 86400000);

        emails.push({
          step,
          subject: email.subject,
          body: email.body,
          scheduledFor: scheduledFor.toISOString(),
          delayLabel: step === 1 ? 'Send immediately' : `Day ${DELAY_DAYS[step - 1]}`,
          approved: true, // default all approved, user can toggle
          edited: false,
          _preview: true,
        });
      } catch (e) {
        emails.push({ step, error: String(e) });
      }
    }

    return NextResponse.json({
      prospect: {
        id: prospect.id,
        name: `${prospect.first_name ?? ''} ${prospect.last_name ?? ''}`.trim(),
        email: prospect.email,
        company: prospect.company,
      },
      emails,
      totalSteps: emails.filter((e) => !e.error).length,
    });
  } catch (error) {
    return NextResponse.json({ error: 'Sequence preview failed', detail: String(error) }, { status: 500 });
  }
}
