import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  extractRolePermissionsFromPolicies,
  getStoredRolePermissions,
  storeRolePermissions,
  mergeSettingsWithVietQR,
  sanitizeSettingsForDb
} from '../utils/settingsHelper';
import { DEFAULT_ROLE_PERMISSIONS, ALL_PERMISSIONS } from '../utils/permissions';
import { Policy } from '../context/types';

describe('RBAC Persistence & Supabase Policies Integration Suite', () => {
  let mockStorage: Record<string, string> = {};

  beforeEach(() => {
    mockStorage = {};
    const storageMock = {
      getItem: (key: string) => mockStorage[key] || null,
      setItem: (key: string, value: string) => { mockStorage[key] = value; },
      removeItem: (key: string) => { delete mockStorage[key]; },
      clear: () => { mockStorage = {}; }
    };
    (globalThis as any).localStorage = storageMock;
    if (typeof window !== 'undefined') {
      (window as any).localStorage = storageMock;
    }
  });

  it('1. extractRolePermissionsFromPolicies parses policy value correctly when stored as object or string', () => {
    const customPerms = {
      'Admin': ALL_PERMISSIONS.map(p => p.key),
      'Quản lý': ['customers.view_all', 'reports.view_all'],
      'Nhân viên': ['customers.create']
    };

    const mockPolicies: Policy[] = [
      {
        id: 99,
        parameter_type: 'rbac_role_permissions',
        name: 'Bảng Phân Quyền Vai Trò RBAC',
        value: customPerms,
        effective_date: '2026-01-01',
        is_active: true
      }
    ];

    const extracted = extractRolePermissionsFromPolicies(mockPolicies);
    expect(extracted['Nhân viên']).toEqual(['customers.create']);
    expect(extracted['Quản lý']).toEqual(['customers.view_all', 'reports.view_all']);
    // Admin always retains all permissions
    expect(extracted['Admin'].length).toBe(ALL_PERMISSIONS.length);

    // Test when value is a stringified JSON
    const mockStringPolicies: Policy[] = [
      {
        id: 100,
        parameter_type: 'rbac_role_permissions',
        name: 'Bảng Phân Quyền Vai Trò RBAC',
        value: JSON.stringify(customPerms) as any,
        effective_date: '2026-01-01',
        is_active: true
      }
    ];

    const extractedFromString = extractRolePermissionsFromPolicies(mockStringPolicies);
    expect(extractedFromString['Nhân viên']).toEqual(['customers.create']);
  });

  it('2. extractRolePermissionsFromPolicies falls back safely to default when policy list has no RBAC policy', () => {
    const mockPoliciesWithoutRBAC: Policy[] = [
      {
        id: 1,
        parameter_type: 'payment_vietqr',
        name: 'VietQR',
        value: {},
        effective_date: '2026-01-01',
        is_active: true
      }
    ];

    const result = extractRolePermissionsFromPolicies(mockPoliciesWithoutRBAC);
    expect(result).toEqual(DEFAULT_ROLE_PERMISSIONS);
  });

  it('3. storeRolePermissions and getStoredRolePermissions cache RBAC in localStorage correctly with Admin protection', () => {
    const mapToSave = {
      'Admin': [], // attempt to empty Admin
      'Nhân viên': ['customers.create', 'finance.view']
    };

    storeRolePermissions(mapToSave as any);

    const loaded = getStoredRolePermissions();
    expect(loaded['Nhân viên']).toEqual(['customers.create', 'finance.view']);
    // Admin must never be empty
    expect(loaded['Admin'].length).toBe(ALL_PERMISSIONS.length);
  });

  it('4. mergeSettingsWithVietQR injects rolePermissions extracted from policies into settings', () => {
    const customRolePolicy: Policy = {
      id: 50,
      parameter_type: 'rbac_role_permissions',
      name: 'Bảng Phân Quyền Vai Trò RBAC',
      value: {
        'Nhân viên': ['customers.create', 'customers.export'],
        'Quản lý': ['reports.view_all']
      },
      effective_date: '2026-01-01',
      is_active: true
    };

    const merged = mergeSettingsWithVietQR(
      { baseSalary: 2340000 },
      [customRolePolicy]
    );

    expect(merged.rolePermissions).toBeDefined();
    expect(merged.rolePermissions?.['Nhân viên']).toContain('customers.create');
    expect(merged.rolePermissions?.['Nhân viên']).toContain('customers.export');
    expect(merged.rolePermissions?.['Admin'].length).toBe(ALL_PERMISSIONS.length);
  });

  it('5. sanitizeSettingsForDb excludes rolePermissions from settings table payload to prevent PGRST204 errors', () => {
    const payloadWithRBAC = {
      baseSalary: 2340000,
      commBHXH: 5,
      rolePermissions: {
        'Nhân viên': ['customers.create']
      }
    };

    const sanitized = sanitizeSettingsForDb(payloadWithRBAC as any);
    expect(sanitized.baseSalary).toBe(2340000);
    expect(sanitized.commBHXH).toBe(5);
    // rolePermissions must NOT be sent to settings table
    expect(sanitized.rolePermissions).toBeUndefined();
  });
});
