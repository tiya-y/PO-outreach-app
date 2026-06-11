import { NextRequest, NextResponse } from 'next/server';
import { classifyReply } from '@/lib/claude';
import { createServiceClient } from '@/lib/supabase';

export async function POST(req: NextRequest) {
  try {
    const { replyId } = await req.json();
    const supabase = createServiceClient();

    const { data: reply } = await supabase
      .from('replies')
      .select('*, prospects(*)')
      .eq('id', replyId)
      .single();

    if (!reply) return NextResponse.json({ error: 'Reply not found' }, { status: 404 });

    const prospect = reply.prospects as Record<string, unknown>;
    const prospectName = `${prospect?.first_name ?? ''} ${prospect?.last_name ?? ''}`.trim() || 'Prospect';

    const result = await classifyReply(reply.raw_content, prospectName);

    // Update reply with classification
    await supabase.from('replies').update({
      classification: result.classification,
      confidence: result.confidence,
      suggested_response: result.suggestedResponse,
    }).eq('id', replyId);

    // Update prospect status based on classification
    const statusMap: Record<string, string> = {
      interested: 'replied',
      meeting_request: 'replied',
      more_info: 'replied',
      not_interested: 'closed_lost',
      do_not_contact: 'closed_lost',
    };

    if (statusMap[result.classification]) {
      await supabase.from('prospects').update({
        status: statusMap[result.classification],
      }).eq('id', reply.prospect_id);
    }

    return NextResponse.json({ classification: result, replyId });
  } catch (error) {
    return NextResponse.json({ error: 'Classification failed', detail: String(error) }, { status: 500 });
  }
}

// Manually log an inbound reply
export async function PUT(req: NextRequest) {
  try {
    const { prospectId, rawContent, outreachEmailId } = await req.json();
    const supabase = createServiceClient();

    const { data: prospect } = await supabase
      .from('prospects')
      .select('first_name, last_name')
      .eq('id', prospectId)
      .single();

    const prospectName = `${prospect?.first_name ?? ''} ${prospect?.last_name ?? ''}`.trim() || 'Prospect';
    const classification = await classifyReply(rawContent, prospectName);

    const { data: newReply } = await supabase.from('replies').insert({
      prospect_id: prospectId,
      outreach_email_id: outreachEmailId ?? null,
      raw_content: rawContent,
      classification: classification.classification,
      confidence: classification.confidence,
      suggested_response: classification.suggestedResponse,
    }).select().single();

    // Update prospect
    const statusMap: Record<string, string> = {
      interested: 'replied',
      meeting_request: 'replied',
      more_info: 'replied',
      not_interested: 'closed_lost',
      do_not_contact: 'closed_lost',
    };

    if (statusMap[classification.classification]) {
      await supabase.from('prospects').update({ status: statusMap[classification.classification] })
        .eq('id', prospectId);
    }

    return NextResponse.json({ reply: newReply, classification });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to log reply', detail: String(error) }, { status: 500 });
  }
}
