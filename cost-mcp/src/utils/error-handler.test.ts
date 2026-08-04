import { describe, it, expect } from 'vitest';
import { handleApiError, handleAuthError } from './error-handler.js';

describe('handleApiError', () => {
  it('handles 404 with not-found message', () => {
    const err = Object.assign(new Error('Not Found'), { status: 404 });
    expect(handleApiError(err)).toContain('not found');
  });

  it('handles 429 with rate-limit message', () => {
    const err = Object.assign(new Error('Too Many Requests'), { status: 429 });
    expect(handleApiError(err)).toContain('rate limit');
  });

  it('handles 503 with unavailable message', () => {
    const err = Object.assign(new Error('Service Unavailable'), { status: 503 });
    expect(handleApiError(err)).toContain('temporarily unavailable');
  });

  it('handles generic errors with message passthrough', () => {
    expect(handleApiError(new Error('unexpected'))).toContain('unexpected');
  });
});

describe('handleAuthError', () => {
  it('returns setup instructions for 401', () => {
    const err = Object.assign(new Error('Unauthorized'), { status: 401 });
    expect(handleAuthError(err)).toContain('AZURE_TENANT_ID');
  });

  it('returns setup instructions for 403', () => {
    const err = Object.assign(new Error('Forbidden'), { status: 403 });
    expect(handleAuthError(err)).toContain('Cost Management Reader');
  });

  it('falls back to handleApiError for non-auth errors', () => {
    const err = Object.assign(new Error('Not Found'), { status: 404 });
    expect(handleAuthError(err)).toContain('not found');
  });
});
