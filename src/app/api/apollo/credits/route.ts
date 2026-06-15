import { NextResponse } from 'next/server';
import axios from 'axios';

export async function GET() {
  try {
    const res = await axios.get('https://api.apollo.io/api/v1/credits/usage_stats', {
      headers: {
        'X-Api-Key': process.env.APOLLO_API_KEY ?? '',
        'Content-Type': 'application/json',
      },
    });

    const stats = res.data?.credit_usage_stats;
    const cycle = res.data?.current_credit_cycle;

    return NextResponse.json({
      export: {
        limit: stats?.export_credit?.limit ?? 0,
        used: stats?.export_credit?.consumed ?? 0,
        left: stats?.export_credit?.left_over ?? 0,
      },
      cycle_ends: cycle?.end_date ?? null,
    });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch credits', detail: String(e) }, { status: 500 });
  }
}
