interface StatusError extends Error {
  status?: number;
}

export function handleApiError(error: unknown): string {
  const err = error as StatusError;
  if (err.status === 404)
    return `Resource not found. Check that the SKU name and region are valid.`;
  if (err.status === 429) return `Azure API rate limit reached. Wait a moment and retry.`;
  if (err.status === 503) return `Azure API temporarily unavailable. Retry in a few minutes.`;
  return `API error: ${err.message ?? String(error)}`;
}

export function handleAuthError(error: unknown): string {
  const err = error as StatusError;
  if (err.status === 401 || err.status === 403) {
    return (
      `Authentication failed. Run 'az login' or set AZURE_TENANT_ID, AZURE_CLIENT_ID, ` +
      `AZURE_CLIENT_SECRET.\nThe account needs the "Cost Management Reader" role.`
    );
  }
  return handleApiError(error);
}
