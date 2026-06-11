import { NextRequest, NextResponse } from 'next/server';
import { getAuthorizationUrl, exchangeCodeForTokens } from '@/lib/ms365';
import { createServiceClient } from '@/lib/supabase';

// Redirect to MS365 OAuth
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const repEmail = searchParams.get('email');
  if (!repEmail) return NextResponse.json({ error: 'email required' }, { status: 400 });

  const url = getAuthorizationUrl(repEmail);
  return NextResponse.redirect(url);
}

// Handle OAuth callback
export async function POST(req: NextRequest) {
  try {
    const { code, state: repEmail } = await req.json();
    const supabase = createServiceClient();

    const tokens = await exchangeCodeForTokens(code);

    // Get MS365 user profile
    const profileRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const profile = await profileRes.json();

    // Upsert sales rep
    await supabase.from('sales_reps').upsert({
      email: repEmail ?? profile.mail ?? profile.userPrincipalName,
      name: profile.displayName ?? repEmail,
      ms365_user_id: profile.id,
      ms365_access_token: tokens.access_token,
      ms365_refresh_token: tokens.refresh_token,
      token_expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      is_active: true,
    }, { onConflict: 'email' });

    return NextResponse.json({ success: true, name: profile.displayName });
  } catch (error) {
    return NextResponse.json({ error: 'OAuth exchange failed', detail: String(error) }, { status: 500 });
  }
}
