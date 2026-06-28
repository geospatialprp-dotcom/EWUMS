import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from 'react';

import axios from 'axios';

import { consumerPortalApi, setPortalUnauthorizedHandler } from '../services/portalApi';



export type PortalConsumer = {

  id: string;

  consumerCode: string;

  fhtcNumber: string;

  consumerName?: string | null;

  mobile?: string | null;

  village?: string | null;

  connectionStatus?: string;

  tenantId: string;

};



type ConsumerPortalContextType = {

  consumer: PortalConsumer | null;

  token: string | null;

  loading: boolean;

  otpMode: 'off' | 'optional' | 'required';

  login: (fhtcNumber: string, mobile: string) => Promise<void>;

  loginWithOtp: (fhtcNumber: string, mobile: string, otp: string) => Promise<void>;

  logout: () => void;

};



const ConsumerPortalContext = createContext<ConsumerPortalContextType | undefined>(undefined);



function storeSession(data: { accessToken: string; consumer: PortalConsumer }) {

  localStorage.setItem('egip_portal_token', data.accessToken);

  localStorage.setItem('egip_portal_consumer', JSON.stringify(data.consumer));

}



export function ConsumerPortalProvider({ children }: { children: ReactNode }) {

  const [consumer, setConsumer] = useState<PortalConsumer | null>(null);

  const [token, setToken] = useState<string | null>(localStorage.getItem('egip_portal_token'));

  const [loading, setLoading] = useState(true);

  const [otpMode, setOtpMode] = useState<'off' | 'optional' | 'required'>('optional');



  const clearSession = useCallback(() => {

    localStorage.removeItem('egip_portal_token');

    localStorage.removeItem('egip_portal_consumer');

    setToken(null);

    setConsumer(null);

  }, []);



  const logout = useCallback(() => {

    clearSession();

    if (window.location.pathname.startsWith('/portal') && window.location.pathname !== '/portal/login') {

      window.location.replace('/portal/login');

    }

  }, [clearSession]);



  useEffect(() => {

    setPortalUnauthorizedHandler(logout);

  }, [logout]);



  useEffect(() => {

    consumerPortalApi.getAuthConfig()

      .then(({ data }) => setOtpMode(data.otpMode ?? 'optional'))

      .catch(() => setOtpMode('optional'));

  }, []);



  useEffect(() => {

    const init = async () => {

      const storedToken = localStorage.getItem('egip_portal_token');

      const storedConsumer = localStorage.getItem('egip_portal_consumer');

      if (!storedToken) {

        setLoading(false);

        return;

      }

      setToken(storedToken);

      if (storedConsumer) setConsumer(JSON.parse(storedConsumer));

      try {

        const { data } = await consumerPortalApi.getProfile();

        const profile = {

          id: data.id,

          consumerCode: data.consumerCode,

          fhtcNumber: data.fhtcNumber,

          consumerName: data.consumerName,

          mobile: data.mobile,

          village: data.village,

          connectionStatus: data.connectionStatus,

          tenantId: data.tenantId ?? 'a0000000-0000-0000-0000-000000000001',

        };

        localStorage.setItem('egip_portal_consumer', JSON.stringify(profile));

        setConsumer(profile);

      } catch (err) {

        if (axios.isAxiosError(err) && err.response?.status === 401) clearSession();

      } finally {

        setLoading(false);

      }

    };

    init();

  }, [clearSession]);



  const applyLoginResponse = (data: { accessToken: string; consumer: PortalConsumer }) => {

    storeSession(data);

    setToken(data.accessToken);

    setConsumer(data.consumer);

  };



  const login = async (fhtcNumber: string, mobile: string) => {

    clearSession();

    const { data } = await consumerPortalApi.login(fhtcNumber.trim(), mobile.trim());

    applyLoginResponse(data);

  };



  const loginWithOtp = async (fhtcNumber: string, mobile: string, otp: string) => {

    clearSession();

    const { data } = await consumerPortalApi.verifyOtp(fhtcNumber.trim(), mobile.trim(), otp.trim());

    applyLoginResponse(data);

  };



  return (

    <ConsumerPortalContext.Provider value={{

      consumer, token, loading, otpMode, login, loginWithOtp, logout,

    }}

    >

      {children}

    </ConsumerPortalContext.Provider>

  );

}



export function useConsumerPortal() {

  const ctx = useContext(ConsumerPortalContext);

  if (!ctx) throw new Error('useConsumerPortal must be used within ConsumerPortalProvider');

  return ctx;

}

