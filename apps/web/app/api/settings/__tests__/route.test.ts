import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const {
  mockTenantSettingsFindFirst,
  mockTenantSettingsUpdate,
  mockTenantSettingsCreate,
  mockTenantConfigFindUnique,
  mockTenantConfigUpsert,
  mockUserFindUnique,
  mockUserPreferencesFindUnique,
  mockUserPreferencesUpsert,
} = vi.hoisted(() => ({
  mockTenantSettingsFindFirst: vi.fn(),
  mockTenantSettingsUpdate: vi.fn(),
  mockTenantSettingsCreate: vi.fn(),
  mockTenantConfigFindUnique: vi.fn(),
  mockTenantConfigUpsert: vi.fn(),
  mockUserFindUnique: vi.fn(),
  mockUserPreferencesFindUnique: vi.fn(),
  mockUserPreferencesUpsert: vi.fn(),
}));

vi.mock('@/lib/prisma', () => ({
  prisma: {
    tenantSettings: {
      findFirst: mockTenantSettingsFindFirst,
      update: mockTenantSettingsUpdate,
      create: mockTenantSettingsCreate,
    },
    tenantConfig: {
      findUnique: mockTenantConfigFindUnique,
      upsert: mockTenantConfigUpsert,
    },
    user: {
      findUnique: mockUserFindUnique,
    },
    userPreferences: {
      findUnique: mockUserPreferencesFindUnique,
      upsert: mockUserPreferencesUpsert,
    },
  },
}));

import { GET, PUT } from '../route';

function createRequest(method: 'GET' | 'PUT', body?: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/settings', {
    method,
    headers: {
      'content-type': 'application/json',
      'x-user-id': 'user-1',
      'x-tenant-id': 'tenant-1',
      'x-user-role': 'admin',
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe('Settings API security settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTenantSettingsFindFirst.mockResolvedValue(null);
    mockTenantConfigFindUnique.mockResolvedValue(null);
    mockTenantConfigUpsert.mockResolvedValue(null);
    mockTenantSettingsUpdate.mockResolvedValue(null);
    mockTenantSettingsCreate.mockResolvedValue(null);
    mockUserPreferencesFindUnique.mockResolvedValue(null);
    mockUserPreferencesUpsert.mockResolvedValue(null);
    mockUserFindUnique.mockResolvedValue({
      firstName: 'Admin',
      lastName: 'User',
      email: 'admin@example.com',
      role: 'admin',
      avatar: null,
      preferences: null,
    });
  });

  it('reads security settings from tenantConfig instead of legacy tenant settings storage', async () => {
    mockTenantSettingsFindFirst.mockResolvedValue({
      customFields: {
        security: {
          sessionTimeout: 480,
          requireMFA: false,
          passwordMinLength: 8,
        },
      },
    });
    mockTenantConfigFindUnique.mockResolvedValue({
      securitySettings: {
        mfaRequired: true,
        sessionTimeout: 8,
        ipAllowlistEnabled: false,
        passwordPolicy: {
          minLength: 12,
          requireUppercase: true,
          requireNumbers: true,
          requireSymbols: true,
        },
      },
    });

    const response = await GET(createRequest('GET'));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.data.settings.security).toEqual({
      sessionTimeout: 8,
      requireMFA: true,
      passwordMinLength: 12,
      ipWhitelist: [],
    });
  });

  it('writes security updates to tenantConfig and skips tenantSettings custom field storage', async () => {
    mockTenantConfigFindUnique.mockResolvedValue({
      securitySettings: {
        mfaRequired: false,
        sessionTimeout: 8,
        ipAllowlistEnabled: false,
        passwordPolicy: {
          minLength: 8,
          requireUppercase: true,
          requireNumbers: true,
          requireSymbols: false,
        },
      },
    });

    const response = await PUT(createRequest('PUT', {
      section: 'security',
      updates: {
        requireMFA: true,
        sessionTimeout: 24,
        passwordMinLength: 12,
      },
    }));
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockTenantConfigUpsert).toHaveBeenCalledWith({
      where: { tenantId: 'tenant-1' },
      update: {
        securitySettings: {
          mfaRequired: true,
          sessionTimeout: 24,
          ipAllowlistEnabled: false,
          passwordPolicy: {
            minLength: 12,
            requireUppercase: true,
            requireNumbers: true,
            requireSymbols: false,
          },
        },
      },
      create: {
        tenantId: 'tenant-1',
        securitySettings: {
          mfaRequired: true,
          sessionTimeout: 24,
          ipAllowlistEnabled: false,
          passwordPolicy: {
            minLength: 12,
            requireUppercase: true,
            requireNumbers: true,
            requireSymbols: false,
          },
        },
      },
    });
    expect(mockTenantSettingsFindFirst).not.toHaveBeenCalled();
    expect(mockTenantSettingsUpdate).not.toHaveBeenCalled();
    expect(mockTenantSettingsCreate).not.toHaveBeenCalled();
    expect(data.data.settings.security).toEqual({
      sessionTimeout: 24,
      requireMFA: true,
      passwordMinLength: 12,
      ipWhitelist: [],
    });
  });
});