import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../supabaseClient';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const initSession = async () => {
      const { data, error } = await supabase.auth.getSession();
      const session = data?.session;

      if (error) {
        console.error('🔴 Error checking session:', error.message);
        setUser(null);
      } else {
        setUser(session?.user || null);
      }

      setAuthLoading(false);
    };

    initSession();

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user || null);
    });

    // Add visibility change listener to refresh session when tab becomes active
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log('🔄 Tab became visible, refreshing session...');
        try {
          const { data, error } = await supabase.auth.refreshSession();
          if (error) {
            console.error('❌ Error refreshing session:', error.message);
          } else if (data.session) {
            console.log('✅ Session refreshed successfully');
            setUser(data.session.user);
          }
        } catch (err) {
          console.error('❌ Failed to refresh session:', err.message);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      listener.subscription.unsubscribe();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, authLoading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuthContext = () => useContext(AuthContext);
