import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockExecSync = vi.hoisted(() => vi.fn());
vi.mock('child_process', () => ({ execSync: mockExecSync }));

import { loadConfig } from './env.js';

describe('loadConfig', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.AZURE_SUBSCRIPTION_ID;
    delete process.env.AZURE_RETAIL_DEFAULT_CURRENCY;
    mockExecSync.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('resolves subscription ID from AZURE_SUBSCRIPTION_ID env var', () => {
    process.env.AZURE_SUBSCRIPTION_ID = 'sub-env-123';

    const config = loadConfig();

    expect(config.costManagement).toEqual({ subscriptionId: 'sub-env-123' });
    expect(mockExecSync).not.toHaveBeenCalled();
  });

  it('falls back to az account show when AZURE_SUBSCRIPTION_ID is absent', () => {
    mockExecSync.mockReturnValueOnce('sub-cli-456\n');

    const config = loadConfig();

    expect(config.costManagement).toEqual({ subscriptionId: 'sub-cli-456' });
    expect(mockExecSync).toHaveBeenCalledWith('az account show --query id --output tsv', {
      encoding: 'utf8',
    });
  });

  it('sets costManagement to null when env var absent and az CLI throws', () => {
    mockExecSync.mockImplementationOnce(() => {
      throw new Error('not logged in');
    });

    const config = loadConfig();

    expect(config.costManagement).toBeNull();
  });

  it('uses USD as default retail currency', () => {
    process.env.AZURE_SUBSCRIPTION_ID = 'sub-xyz';

    const config = loadConfig();

    expect(config.retailCurrency).toBe('USD');
  });

  it('reads custom retail currency from AZURE_RETAIL_DEFAULT_CURRENCY', () => {
    process.env.AZURE_SUBSCRIPTION_ID = 'sub-xyz';
    process.env.AZURE_RETAIL_DEFAULT_CURRENCY = 'EUR';

    const config = loadConfig();

    expect(config.retailCurrency).toBe('EUR');
  });
});
