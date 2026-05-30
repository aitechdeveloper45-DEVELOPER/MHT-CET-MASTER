import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const COOKIE_NAME = "cetprep_session_v2";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

type SessionBackup = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
};

const getCookie = (name: string): string | null => {
  const parts = document.cookie.split(";").map((c) => c.trim());
  const found = parts.find((c) => c.startsWith(`${name}=`));
  if (!found) return null;
  return found.slice(name.length + 1);
};

const setCookie = (name: string, value: string, maxAgeSeconds: number) => {
  const isHttps = window.location.protocol === "https:";
  // Use SameSite=None on https so cookies also work in some WebView/iframe wrappers.
  const attrs = isHttps ? "; Path=/; SameSite=None; Secure" : "; Path=/; SameSite=Lax";
  document.cookie = `${name}=${value}; Max-Age=${maxAgeSeconds}${attrs}`;
};

const deleteCookie = (name: string) => {
  const isHttps = window.location.protocol === "https:";
  const attrs = isHttps ? "; Path=/; SameSite=None; Secure" : "; Path=/; SameSite=Lax";
  document.cookie = `${name}=; Max-Age=0${attrs}`;
  // Also delete old cookie version
  document.cookie = `cetprep_session_v1=; Max-Age=0${attrs}`;
};

export const backupSessionToCookie = (session: Session) => {
  const payload: SessionBackup = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
  };

  const encoded = encodeURIComponent(JSON.stringify(payload));
  setCookie(COOKIE_NAME, encoded, MAX_AGE_SECONDS);
};

export const clearSessionCookie = () => {
  deleteCookie(COOKIE_NAME);
};

export const getSessionBackupFromCookie = (): SessionBackup | null => {
  try {
    const raw = getCookie(COOKIE_NAME);
    if (!raw) return null;
    return JSON.parse(decodeURIComponent(raw)) as SessionBackup;
  } catch {
    return null;
  }
};

/**
 * Best-effort restore for WebViews that wipe localStorage between app launches.
 * Call this BEFORE React renders so route guards can see a session.
 */
export const restoreSessionFromCookie = async (): Promise<boolean> => {
  const backup = getSessionBackupFromCookie();
  if (!backup) return false;

  // Skip restoration if the token is clearly expired and we'd just get a network error
  if (backup.expires_at && backup.expires_at * 1000 < Date.now() - 30 * 24 * 60 * 60 * 1000) {
    clearSessionCookie();
    return false;
  }

  try {
    // Try to restore session from cookie backup directly (skip getSession to avoid double calls)
    const { data, error } = await supabase.auth.setSession({
      access_token: backup.access_token,
      refresh_token: backup.refresh_token,
    });

    if (error || !data.session) {
      console.log("Session restoration failed, clearing cookie backup");
      clearSessionCookie();
      return false;
    }

    backupSessionToCookie(data.session);
    return true;
  } catch (error) {
    console.error("Error restoring session:", error);
    clearSessionCookie();
    return false;
  }
};
