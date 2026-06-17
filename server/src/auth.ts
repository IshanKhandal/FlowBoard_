import { v4 as uuid } from "uuid";

/**
 * WHY AN IN-MEMORY SESSION MAP, NOT A SESSION DATABASE OR JWT?
 *
 * - This mirrors the same "JSON file, not a database" philosophy already
 *   used for board persistence: single server process, single-writer,
 *   no need for the operational overhead of Redis or a sessions table.
 * - A signed JWT would avoid server-side storage entirely, but it also
 *   means you can't revoke a session early (logout becomes "delete the
 *   cookie and hope") without a blocklist, which just re-introduces
 *   server-side state anyway. A plain session map keeps revocation
 *   trivial: delete the entry, the cookie is instantly worthless.
 * - The trade-off: sessions are lost on server restart. That is already
 *   true of connectedUsers for live WebSocket state, so it is
 *   consistent with the rest of this server is design, not a new gap.
 */

export interface SessionUser {
  id: string;
  name: string;
  avatarUrl: string | null;
  color: string;
  provider: "github" | "guest";
}

const sessions = new Map<string, SessionUser>();

export function createSession(user: SessionUser): string {
  const sessionId = uuid();
  sessions.set(sessionId, user);
  return sessionId;
}

export function getSession(sessionId: string | undefined): SessionUser | null {
  if (!sessionId) return null;
  return sessions.get(sessionId) ?? null;
}

export function destroySession(sessionId: string | undefined) {
  if (sessionId) sessions.delete(sessionId);
}

/**
 * Minimal cookie parser. We do not pull in a separate cookie-parsing
 * dependency, because the WebSocket upgrade handler needs to read the
 * same cookie header manually anyway (ws does not have Express-style
 * middleware), so we would end up needing this exact logic regardless.
 * Writing it once and reusing it for both HTTP and WebSocket keeps the
 * parsing behavior identical in both places.
 */
export function parseCookies(header: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) return result;
  header.split(";").forEach((pair) => {
    const index = pair.indexOf("=");
    if (index === -1) return;
    const key = pair.slice(0, index).trim();
    const value = pair.slice(index + 1).trim();
    if (key) result[key] = decodeURIComponent(value);
  });
  return result;
}

const GITHUB_USER_COLORS = [
  "#5B5FE3", "#E8745B", "#7C9A82", "#C98A3E", "#3E8FC9", "#9A5BC9",
];

function colorForId(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return GITHUB_USER_COLORS[hash % GITHUB_USER_COLORS.length];
}

interface GitHubTokenResponse {
  access_token?: string;
  error?: string;
  error_description?: string;
}

interface GitHubProfile {
  id: number;
  login: string;
  avatar_url: string;
}

export async function exchangeCodeForUser(code: string): Promise<SessionUser> {
  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error("GitHub OAuth is not configured on this server.");
  }

  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
  });

  const tokenData = (await tokenRes.json()) as GitHubTokenResponse;

  if (!tokenData.access_token) {
    throw new Error(tokenData.error_description || "Failed to exchange code for token.");
  }

  const profileRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenData.access_token}`,
      "User-Agent": "FlowBoard-App",
    },
  });

  const profile = (await profileRes.json()) as GitHubProfile;

  if (!profile.login) {
    throw new Error("Could not load GitHub profile.");
  }

  const id = `github-${profile.id}`;
  return {
    id,
    name: profile.login,
    avatarUrl: profile.avatar_url,
    color: colorForId(id),
    provider: "github",
  };
}