import { NextRequest, NextResponse } from 'next/server';
import { clearSessionCookie, validateCsrfOrigin } from '@/lib/authSession';

export async function POST(req: NextRequest) {
  try {
    if (!validateCsrfOrigin(req)) {
      return NextResponse.json({ success: false, error: 'Forbidden: Cross-site request rejected.' }, { status: 403 });
    }

    const response = NextResponse.json({
      success: true,
      message: 'Session cleared successfully',
    });

    clearSessionCookie(response);

    return response;
  } catch (err: any) {
    console.error('[API Auth Logout Error]:', err);
    return NextResponse.json(
      { success: false, error: 'Failed to clear session' },
      { status: 500 }
    );
  }
}
