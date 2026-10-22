import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest, getStoredToken, setStoredToken } from '../api/client';

const AuthContext = createContext(null);

const FALLBACK_SETTINGS = {
  bankName: 'MONERA',
  tagline: "L'architecture bancaire de nouvelle génération. Précision, sécurité souveraine et liquidité instantanée.",
  announcementEnabled: true,
  announcementText: 'MONERA Private & Digital Banking • Réseau interbancaire RIB-MONERA sécurisé 24h/24',
  supportEmail: 'contact@monera.com',
  supportPhone: '+33 1 86 95 42 00',
  headquarters: '29 Boulevard Haussmann, 75009 Paris • Lomé Financial District',
  loanAnnualRate: 3.85,
  maxLoanAmount: 250000,
  maxTransferAmount: 100000,
  transferFeePercent: 0,
  allowRegistration: true,
  maintenanceMode: false,
  customLogoUrl: '',
  customFaviconUrl: '',
};

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [siteSettings, setSiteSettings] = useState(FALLBACK_SETTINGS);
  const [publicMetrics, setPublicMetrics] = useState({
    activeClients: 148204,
    volumeProcessed: 4280005000,
    countriesCovered: 38,
    uptime: '99.99%',
  });
  const [loading, setLoading] = useState(true);
  const [modal3D, setModal3D] = useState(null);

  const applyFaviconAndTitle = useCallback((settings) => {
    const favLink = document.getElementById('dynamic-favicon');
    if (favLink) {
      favLink.href = settings?.customFaviconUrl || '/assets/favicon.png';
    }
    if (settings?.bankName) {
      document.title = `${settings.bankName} — Banque Digitale & Privée Nouvelle Génération`;
    }
  }, []);

  const refreshPublicConfig = useCallback(async () => {
    try {
      const data = await apiRequest('/public/config');
      if (data.settings) {
        setSiteSettings(data.settings);
        applyFaviconAndTitle(data.settings);
      }
      if (data.metrics) {
        setPublicMetrics(data.metrics);
      }
    } catch {
      applyFaviconAndTitle(FALLBACK_SETTINGS);
    }
  }, [applyFaviconAndTitle]);

  const refreshMe = useCallback(async () => {
    try {
      const data = await apiRequest('/auth/me');
      setUser(data.user);
      if (data.settings) {
        setSiteSettings(data.settings);
        applyFaviconAndTitle(data.settings);
      }
      return data.user;
    } catch {
      setStoredToken('');
      setUser(null);
      return null;
    }
  }, [applyFaviconAndTitle]);

  useEffect(() => {
    let mounted = true;
    (async () => {
      await refreshPublicConfig();
      const hasToken = Boolean(getStoredToken());
      if (hasToken) {
        await refreshMe();
      } else {
        try {
          const data = await apiRequest('/auth/me');
          if (mounted && data.user) setUser(data.user);
        } catch {
          if (mounted) setUser(null);
        }
      }
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [refreshMe, refreshPublicConfig]);

  const login = async (email, password) => {
    const data = await apiRequest('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    setStoredToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const register = async (payload) => {
    const data = await apiRequest('/auth/register', {
      method: 'POST',
      body: payload,
    });
    setStoredToken(data.token);
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    try {
      await apiRequest('/auth/logout', { method: 'POST' });
    } catch {
      setStoredToken('');
    }
    setStoredToken('');
    setUser(null);
  };

  const trigger3DEvent = useCallback((eventPayload) => {
    setModal3D(eventPayload);
  }, []);

  const close3DEvent = useCallback(() => {
    setModal3D(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        setUser,
        siteSettings,
        setSiteSettings,
        publicMetrics,
        loading,
        login,
        register,
        logout,
        refreshMe,
        refreshPublicConfig,
        modal3D,
        trigger3DEvent,
        close3DEvent,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
