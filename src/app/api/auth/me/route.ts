import { NextRequest, NextResponse } from 'next/server';
import { getProfileById } from '@/lib/serverProfiles';
import { getSessionFromRequest, sanitizeProfile } from '@/lib/authSession';

export async function GET(req: NextRequest) {
  try {
    const session = getSessionFromRequest(req);

    if (!session) {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    const profile = await getProfileById(session.userId);

    if (!profile || profile.active === false || profile.status === 'INACTIVE') {
      return NextResponse.json({
        authenticated: false,
        user: null,
      });
    }

    return NextResponse.json({
      authenticated: true,
      user: sanitizeProfile(profile),
      session: {
        userId: profile.id,
        role: profile.role,
        profileType: profile.profile_type || session.profileType,
        businessId: (profile as any).business_id || session.businessId,
        exp: session.exp,
      }
    });
  } catch (err: any) {
    console.error('[API Auth Me Error]:', err);
    return NextResponse.json({
      authenticated: false,
      user: null,
      error: 'Failed to verify session'
    }, { status: 500 });
  }
}
