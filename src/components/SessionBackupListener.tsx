import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { backupSessionToCookie, clearSessionCookie } from "@/lib/sessionBackup";

const SessionBackupListener = () => {
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("SessionBackupListener: Auth event", event);
      
      if (event === "SIGNED_OUT" || event === "TOKEN_REFRESHED" && !session) {
        clearSessionCookie();
        return;
      }

      if (session) {
        // Covers SIGNED_IN, TOKEN_REFRESHED, USER_UPDATED, etc.
        backupSessionToCookie(session);
      }
    });

    // Also do a one-time backup if a session already exists
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.log("SessionBackupListener: Error getting session", error.message);
        clearSessionCookie();
        return;
      }
      if (session) {
        backupSessionToCookie(session);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return null;
};

export default SessionBackupListener;
