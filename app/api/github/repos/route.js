// Server-side endpoint listing repositories accessible to the authenticated GitHub user

import { decryptSession } from '../../../lib/serverCrypto';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req) {
  try {
    const auth = req.headers.get('authorization') || '';
    const sessionToken = auth.startsWith('Bearer ') ? auth.slice(7).trim() : '';
    const session = decryptSession(sessionToken);

    if (!session?.accessToken || !session?.login) {
      return Response.json({ error: 'GitHub authentication required.' }, { status: 401 });
    }

    const res = await fetch(
      'https://api.github.com/user/repos?sort=updated&per_page=100&affiliation=owner,collaborator,organization_member',
      {
        headers: {
          Authorization: `Bearer ${session.accessToken}`,
          Accept: 'application/vnd.github+json',
          'User-Agent': 'CodeLab-IDE',
        },
        cache: 'no-store',
      }
    );

    const data = await res.json().catch(() => []);
    if (!res.ok) {
      return Response.json(
        { error: data?.message || 'Failed to fetch GitHub repositories.' },
        { status: res.status || 400 }
      );
    }

    const repos = Array.isArray(data)
      ? data
          .filter((r) => r && r.name && r.owner?.login)
          .map((r) => ({
            id: r.id,
            fullName: r.full_name,
            owner: r.owner.login,
            name: r.name,
            defaultBranch: r.default_branch || 'main',
            private: Boolean(r.private),
            description: r.description || '',
            htmlUrl: r.html_url,
            updatedAt: r.updated_at,
            canPush: r.permissions ? Boolean(r.permissions.push || r.permissions.admin || r.permissions.maintain) : true,
          }))
      : [];

    return Response.json({ repos });
  } catch (err) {
    return Response.json({ error: err?.message || 'Failed to fetch repositories.' }, { status: 500 });
  }
}
