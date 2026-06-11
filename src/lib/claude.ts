import Anthropic from '@anthropic-ai/sdk';

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── Prospect Email Copywriter ─────────────────────────────────────────────────

export interface ProspectContext {
  firstName: string;
  lastName: string;
  title: string;
  company: string;
  city: string;
  portfolioSize?: number;
  currentSoftware?: string;
  painPoints?: string[];
  compensation?: string;
  sequenceStep?: number;
}

export async function generateOutreachEmail(prospect: ProspectContext): Promise<{ subject: string; body: string }> {
  const step = prospect.sequenceStep ?? 1;
  const isFollowUp = step > 1;

  const prompt = `You are an expert B2B sales copywriter for Innago, a FREE property management software. Your job is to write a short, personal, and compelling outreach email to a property owner or property manager.

PROSPECT INFO:
- Name: ${prospect.firstName} ${prospect.lastName}
- Title: ${prospect.title}
- Company: ${prospect.company}
- City: ${prospect.city}
${prospect.portfolioSize ? `- Portfolio: ~${prospect.portfolioSize} units` : ''}
${prospect.currentSoftware ? `- Currently using: ${prospect.currentSoftware}` : ''}
${prospect.compensation ? `- Special offer: ${prospect.compensation}` : ''}

ABOUT INNAGO:
- 100% free property management software (no monthly fees)
- Online rent collection, maintenance tracking, tenant screening, lease management, accounting
- Used by thousands of independent landlords and property managers across the US
- Key differentiator: Completely free vs competitors like AppFolio ($1.40/unit/mo), Buildium ($50+/mo), TurboTenant

EMAIL SEQUENCE STEP: ${step} of 5
${isFollowUp ? `This is follow-up #${step - 1}. Keep it short (3-4 lines max), reference the previous email, and add a new angle or value point. DO NOT repeat the same pitch.` : 'This is the initial outreach email. Keep it under 150 words, personal, not sales-y.'}

KEY RULES:
- Sound like a real person, not a robot
- Mention something specific to their city or situation if possible
- Lead with value, not features
- One clear CTA (usually a 15-min demo)
- No exclamation points spam
- Subject line: short, curiosity-driven, personalized

Return ONLY valid JSON in this exact format:
{"subject": "...", "body": "..."}
The body should be plain text with line breaks using \\n.`;

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 600,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response type');

  try {
    return JSON.parse(content.text);
  } catch {
    // Fallback: extract JSON from text
    const match = content.text.match(/\{[\s\S]*\}/);
    if (match) return JSON.parse(match[0]);
    throw new Error('Could not parse email JSON from Claude response');
  }
}

// ── Reply Classifier ──────────────────────────────────────────────────────────

export type ReplyClassification = 'interested' | 'not_interested' | 'more_info' | 'wrong_person' | 'do_not_contact' | 'auto_reply' | 'meeting_request';

export async function classifyReply(replyText: string, prospectName: string): Promise<{
  classification: ReplyClassification;
  confidence: number;
  suggestedResponse: string;
  urgency: 'high' | 'medium' | 'low';
}> {
  const prompt = `Classify this email reply from a property owner/manager prospect and suggest a response.

PROSPECT NAME: ${prospectName}
REPLY TEXT:
"""
${replyText}
"""

Classifications:
- "interested" — wants to learn more, open to a call/demo
- "meeting_request" — explicitly asking to schedule a call or demo
- "more_info" — asking clarifying questions before committing
- "not_interested" — politely declining
- "do_not_contact" — asking to stop emails / unsubscribe
- "wrong_person" — forwarded to wrong person, not the decision maker
- "auto_reply" — out of office or automated reply

Return ONLY valid JSON:
{
  "classification": "...",
  "confidence": 0.0-1.0,
  "suggestedResponse": "...",
  "urgency": "high|medium|low"
}`;

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 500,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response');

  const match = content.text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('Could not parse reply classification');
  return JSON.parse(match[0]);
}

// ── Pre-Call Brief Generator ──────────────────────────────────────────────────

export interface BriefInput {
  prospect: {
    firstName: string;
    lastName: string;
    title: string;
    company: string;
    city: string;
    portfolioSize?: number;
    linkedinUrl?: string;
    website?: string;
    enrichmentData?: Record<string, unknown>;
  };
  emailHistory: Array<{ step: number; subject: string; sentAt: string; opened: boolean; replied: boolean }>;
  reply?: string;
  meetingTime: string;
}

export async function generatePreCallBrief(input: BriefInput): Promise<string> {
  const prompt = `You are preparing a pre-call brief for an Innago sales rep who is about to jump on a demo call. Write a concise, scannable brief (max 400 words) in Markdown format.

PROSPECT:
- Name: ${input.prospect.firstName} ${input.prospect.lastName}
- Title: ${input.prospect.title}
- Company: ${input.prospect.company}
- City: ${input.prospect.city}
${input.prospect.portfolioSize ? `- Portfolio: ~${input.prospect.portfolioSize} units` : ''}
${input.prospect.website ? `- Website: ${input.prospect.website}` : ''}
${input.prospect.linkedinUrl ? `- LinkedIn: ${input.prospect.linkedinUrl}` : ''}
${input.prospect.enrichmentData ? `- Additional data: ${JSON.stringify(input.prospect.enrichmentData, null, 2)}` : ''}

EMAIL HISTORY:
${input.emailHistory.map(e => `- Step ${e.step}: "${e.subject}" | Sent: ${e.sentAt} | Opened: ${e.opened ? 'Yes' : 'No'} | Replied: ${e.replied ? 'Yes' : 'No'}`).join('\n')}

${input.reply ? `THEIR REPLY:\n"${input.reply}"` : ''}

MEETING TIME: ${input.meetingTime}

Write the brief with these sections:
## Who You're Talking To
## Their Portfolio & Situation (infer from available data)
## Why They're Talking to Innago (what likely motivated the reply)
## Suggested Talking Points
## Likely Objections & Responses
## CTA for This Call (what's the goal — close a free trial, get commitment to onboard?)

Keep it tight. Sales reps read this in 2 minutes before joining the call.`;

  const message = await anthropic.messages.create({
    model: 'claude-opus-4-6',
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response');
  return content.text;
}

// ── Prospect Qualification Scorer ─────────────────────────────────────────────

export async function scoreProspect(data: {
  title: string;
  company: string;
  employeeCount?: number;
  website?: string;
  location: string;
}): Promise<{ score: number; notes: string; recommended: boolean }> {
  const prompt = `Score this property owner/manager prospect for Innago outreach on a scale of 0-100. Innago targets independent landlords and small-to-mid property management companies (1-500 units).

PROSPECT DATA:
${JSON.stringify(data, null, 2)}

Scoring criteria:
- Title relevance (property manager, owner, landlord, real estate investor = higher score)
- Company size (1-50 employees ideal for SMB focus, but 50-200 also valid)
- Has website (signal of established business)
- Location (US-based, major rental market = higher)

Return ONLY valid JSON:
{"score": 0-100, "notes": "one sentence explanation", "recommended": true|false}`;

  const message = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{ role: 'user', content: prompt }],
  });

  const content = message.content[0];
  if (content.type !== 'text') throw new Error('Unexpected response');

  const match = content.text.match(/\{[\s\S]*\}/);
  if (!match) return { score: 50, notes: 'Could not evaluate', recommended: true };
  return JSON.parse(match[0]);
}
