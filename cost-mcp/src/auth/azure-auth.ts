import { DefaultAzureCredential } from '@azure/identity';

const SCOPE = 'https://management.azure.com/.default';

let credential: DefaultAzureCredential | null = null;

/**
 * Returns true when a JWT is expired (or within the skew window). Tokens that can't be
 * decoded as JWTs are treated as usable (return false) so non-JWT tokens still work.
 */
function isJwtExpired(jwt: string, skewSeconds = 60): boolean {
  try {
    const part = jwt.split('.')[1];
    if (!part) return false;
    const payload = JSON.parse(Buffer.from(part, 'base64url').toString('utf8')) as { exp?: number };
    if (typeof payload.exp !== 'number') return false;
    return Date.now() / 1000 >= payload.exp - skewSeconds;
  } catch {
    return false;
  }
}

export async function getAccessToken(): Promise<string> {
  // A host (e.g. the Azure FinOps agent) may inject the signed-in user's delegated
  // Entra token per session via AZURE_ACCESS_TOKEN. When present AND still valid it
  // takes precedence so this MCP subprocess acts AS THE USER (delegated RBAC).
  //
  // The MCP server is a long-lived stdio subprocess: the injected token is static and
  // cannot be refreshed in place, so it eventually expires (~1h). When that happens we
  // fall back to DefaultAzureCredential — which DOES refresh (az login locally, the
  // app's managed identity in production). Keep that identity read-only (Cost
  // Management Reader) so the audit-safe posture holds on the fallback path too.
  const injected = process.env.AZURE_ACCESS_TOKEN?.trim();
  if (injected && !isJwtExpired(injected)) return injected;

  if (!credential) {
    credential = new DefaultAzureCredential();
  }
  const token = await credential.getToken(SCOPE);
  if (!token?.token) {
    throw Object.assign(new Error('Failed to acquire Azure AD token'), { status: 401 });
  }
  return token.token;
}
