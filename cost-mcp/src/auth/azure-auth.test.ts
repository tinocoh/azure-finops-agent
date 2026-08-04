import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockGetToken = vi.hoisted(() => vi.fn());

vi.mock('@azure/identity', () => ({
  DefaultAzureCredential: vi.fn(function () {
    return { getToken: mockGetToken };
  }),
}));

import { getAccessToken } from './azure-auth.js';

describe('getAccessToken', () => {
  beforeEach(() => {
    mockGetToken.mockReset();
    delete process.env.AZURE_ACCESS_TOKEN;
  });

  it('returns the injected delegated token from AZURE_ACCESS_TOKEN without calling the credential', async () => {
    process.env.AZURE_ACCESS_TOKEN = '  injected-user-token  ';

    const result = await getAccessToken();

    expect(result).toBe('injected-user-token');
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  const makeJwt = (exp: number) => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    return `${b64({ alg: 'none' })}.${b64({ exp })}.sig`;
  };

  it('uses a valid (non-expired) injected JWT as-is', async () => {
    process.env.AZURE_ACCESS_TOKEN = makeJwt(Math.floor(Date.now() / 1000) + 3600);

    const result = await getAccessToken();

    expect(result).toBe(process.env.AZURE_ACCESS_TOKEN);
    expect(mockGetToken).not.toHaveBeenCalled();
  });

  it('falls back to DefaultAzureCredential when the injected JWT is expired', async () => {
    process.env.AZURE_ACCESS_TOKEN = makeJwt(Math.floor(Date.now() / 1000) - 120);
    mockGetToken.mockResolvedValueOnce({ token: 'refreshed-token' });

    const result = await getAccessToken();

    expect(result).toBe('refreshed-token');
    expect(mockGetToken).toHaveBeenCalledWith('https://management.azure.com/.default');
  });

  it('falls back to DefaultAzureCredential when AZURE_ACCESS_TOKEN is empty/whitespace', async () => {
    process.env.AZURE_ACCESS_TOKEN = '   ';
    mockGetToken.mockResolvedValueOnce({ token: 'fallback-token' });

    const result = await getAccessToken();

    expect(result).toBe('fallback-token');
    expect(mockGetToken).toHaveBeenCalledWith('https://management.azure.com/.default');
  });

  it('returns the token string on success', async () => {
    mockGetToken.mockResolvedValueOnce({ token: 'test-token-abc' });

    const result = await getAccessToken();

    expect(result).toBe('test-token-abc');
    expect(mockGetToken).toHaveBeenCalledWith('https://management.azure.com/.default');
  });

  it('throws with status 401 when credential returns null', async () => {
    mockGetToken.mockResolvedValueOnce(null);

    await expect(getAccessToken()).rejects.toMatchObject({ status: 401 });
  });

  it('propagates errors from DefaultAzureCredential', async () => {
    mockGetToken.mockRejectedValueOnce(
      new Error('DefaultAzureCredential: No credentials available')
    );

    await expect(getAccessToken()).rejects.toThrow('No credentials available');
  });
});
