import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook to check if the current user has admin privileges.
 * 
 * SECURITY NOTE: This client-side check is for UX purposes only.
 * All admin actions are protected by server-side RLS policies.
 * Even if a user manipulates the client to show admin UI,
 * they cannot perform admin actions without proper database roles.
 * 
 * Server-side protections include:
 * - RLS policies on user_roles table restrict INSERT/UPDATE/DELETE to admins
 * - test_questions table requires admin role for modifications
 * - SECURITY DEFINER functions (is_admin, has_role) validate permissions
 */
export const useAdmin = () => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAdminStatus();
  }, []);

  const checkAdminStatus = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        setIsAdmin(false);
        setLoading(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_roles')
        .select('role')
        .eq('user_id', user.id)
        .eq('role', 'admin')
        .maybeSingle();

      if (!error && data) {
        setIsAdmin(true);
      } else {
        setIsAdmin(false);
      }
    } catch (error) {
      console.error('Error checking admin status:', error);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  return { isAdmin, loading, refetch: checkAdminStatus };
};
