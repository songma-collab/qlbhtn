import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { policyService, systemSettingService } from '../services';
import { SettingsType, Policy } from './types';
import { 
  sanitizeSettingsForDb, 
  mergeSettingsWithVietQR, 
  hasVietQRFields, 
  extractVietQRConfig,
  storeRolePermissions,
  hasPrintSettingsFields,
  extractPrintConfig,
  storePrintConfig
} from '../utils/settingsHelper';

export interface PolicyContextType {
  settings: SettingsType;
  policies: Policy[];
  updateSettings: (settings: Partial<SettingsType>) => Promise<boolean>;
  setSettings: (settings: Partial<SettingsType>) => Promise<boolean>;
  addPolicy: (policy: Omit<Policy, 'id'>) => Promise<boolean>;
  updatePolicy: (id: number, policy: Partial<Policy>) => Promise<boolean>;
  deletePolicy: (id: number) => Promise<boolean>;
  activatePolicy: (id: number, parameterType: string) => Promise<boolean>;
}

const PolicyContext = createContext<PolicyContextType | undefined>(undefined);

export const PolicyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [policies, setPolicies] = useState<Policy[]>([]);
  const [settings, setSettingsLive] = useState<SettingsType>({ 
    id: 1, 
    commBHXHNew: 5, 
    commBHXHRenew: 3, 
    commBHYTNew: 5, 
    commBHYTRenew: 3, 
    commBHXH: 5, 
    commBHYT: 5,
    investmentRate: 0.31,
    baseSalary: 2340000,
    povertyStandard: 1500000,
    cpiIndex: {
      "2008": 4.67, "2009": 4.37, "2010": 3.99, "2011": 3.42, "2012": 3.09,
      "2013": 2.92, "2014": 2.76, "2015": 2.72, "2016": 2.64, "2017": 2.54,
      "2018": 2.45, "2019": 2.37, "2020": 2.29, "2021": 2.22, "2022": 2.15,
      "2023": 2.08, "2024": 1.00, "2025": 1.00, "2026": 1.00
    }
  });

  const fetchPoliciesAndSettings = useCallback(async () => {
    try {
      const [policiesRes, settingsRes] = await Promise.all([
        policyService.fetchPolicies(),
        systemSettingService.fetchSettings()
      ]);

      if (policiesRes?.data) {
        setPolicies(policiesRes.data);
      }

      if (settingsRes?.data) {
        const sData = settingsRes.data;
        setSettingsLive(prev => mergeSettingsWithVietQR({
          ...prev,
          ...sData,
          cpiIndex: sData.cpiIndex || prev.cpiIndex
        }, policiesRes?.data));
      }
    } catch (err) {
      console.error('Error fetching policies and settings:', err);
    }
  }, []);

  useEffect(() => {
    fetchPoliciesAndSettings();
  }, [fetchPoliciesAndSettings]);

  const updateSettings = async (newSettings: Partial<SettingsType>): Promise<boolean> => {
    try {
      if (hasVietQRFields(newSettings)) {
        const vqr = extractVietQRConfig(newSettings, settings);
        try {
          if (typeof window !== 'undefined' && window.localStorage) {
            window.localStorage.setItem('vss_vietqr_agency_config', JSON.stringify(vqr));
          }
        } catch (e) {}
      }

      if (newSettings.rolePermissions) {
        storeRolePermissions(newSettings.rolePermissions);
      }

      if (hasPrintSettingsFields(newSettings) || newSettings.agencyName) {
        const pcfg = extractPrintConfig(newSettings, settings);
        storePrintConfig(pcfg);
      }

      const dbFields = sanitizeSettingsForDb(newSettings);
      if (Object.keys(dbFields).length > 0) {
        const { error } = await systemSettingService.upsertSettings(dbFields);
        if (error) throw error;
      }

      setSettingsLive(prev => mergeSettingsWithVietQR({ ...prev, ...newSettings }, policies));
      return true;
    } catch (err) {
      console.error('Failed to update settings:', err);
      return false;
    }
  };

  const addPolicy = async (policy: Omit<Policy, 'id'>): Promise<boolean> => {
    try {
      const { error } = await policyService.addPolicy(policy);
      if (error) throw error;
      await fetchPoliciesAndSettings();
      return true;
    } catch (err) {
      console.error('Failed to add policy:', err);
      return false;
    }
  };

  const updatePolicy = async (id: number, policy: Partial<Policy>): Promise<boolean> => {
    try {
      const { error } = await policyService.updatePolicy(id, policy);
      if (error) throw error;
      await fetchPoliciesAndSettings();
      return true;
    } catch (err) {
      console.error('Failed to update policy:', err);
      return false;
    }
  };

  const deletePolicy = async (id: number): Promise<boolean> => {
    try {
      const { error } = await policyService.deletePolicy(id);
      if (error) throw error;
      await fetchPoliciesAndSettings();
      return true;
    } catch (err) {
      console.error('Failed to delete policy:', err);
      return false;
    }
  };

  const activatePolicy = async (id: number, parameterType: string): Promise<boolean> => {
    try {
      const { error } = await policyService.activatePolicy(id, parameterType);
      if (error) throw error;
      await fetchPoliciesAndSettings();
      return true;
    } catch (err) {
      console.error('Failed to activate policy:', err);
      return false;
    }
  };

  return (
    <PolicyContext.Provider value={{
      settings,
      policies,
      updateSettings,
      setSettings: updateSettings,
      addPolicy,
      updatePolicy,
      deletePolicy,
      activatePolicy
    }}>
      {children}
    </PolicyContext.Provider>
  );
};

export const usePolicy = (): PolicyContextType => {
  const context = useContext(PolicyContext);
  if (!context) {
    throw new Error('usePolicy must be used within a PolicyProvider');
  }
  return context;
};
