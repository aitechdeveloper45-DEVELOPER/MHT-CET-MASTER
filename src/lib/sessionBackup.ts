import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const COOKIE_NAME = "cetprep_session_v2";
const PREF_KEY = "cetprep_session_v2";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

type SessionBackup = {
  access_token: string;
  refresh_token: string;
  expires_at?: number;
};

const isNative = () => {
  try { return Capacitor.isNativePlatform(); } catch { return false; }
};

const getCookie = (name: string): string | null => {
  const parts = document.cookie.split(";").map((c) => c.trim());
  const found = parts.find((c) => c.startsWith(`${name}=`));
  if (!found) return null;
  return found.slice(name.length + 1);
};

const setCookie = (name: string, value: string, maxAgeSeconds: number) => {
  const isHttps = window.location.protocol === "https:";
  const attrs = isHttps ? "; Path=/; SameSite=None; Secure" : "; Path=/; SameSite=Lax";
  document.cookie = `${name}=${value}; Max-Age=${maxAgeSeconds}${attrs}`;
};

const deleteCookie = (name: string) => {
  const isHttps = window.location.protocol === "https:";
  const attrs = isHttps ? "; Path=/; SameSite=None; Secure" : "; Path=/; SameSite=Lax";
  document.cookie = `${name}=; Max-Age=0${attrs}`;
  document.cookie = `cetprep_session_v1=; Max-Age=0${attrs}`;
};

export const backupSessionToCookie = (session: Session) => {
  const payload: SessionBackup = {
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
  };
  const json = JSON.stringify(payload);
  const encoded = encodeURIComponent(json);
  setCookie(COOKIE_NAME, encoded, MAX_AGE_SECONDS);

  // Native persistent storage (survives WebView storage clears / app restarts)
  if (isNative()) {
    Preferences.set({ key: PREF_KEY, value: json }).catch(() => {});
  }
};

export const clearSessionCookie = () => {
  deleteCookie(COOKIE_NAME);
  if (isNative()) {
    Preferences.remove({ key: PREF_KEY }).catch(() => {});
  }
};

const getBackupFromPreferences = async (): Promise<SessionBackup | null> => {
  if (!isNative()) return null;
  try {
    const { value } = await Preferences.get({ key: PREF_KEY });
    if (!value) return null;
    return JSON.parse(value) as SessionBackup;
  } catch {
    return null;
  }
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
 * Tries native Preferences first (most reliable on Android/iOS), then cookie fallback.
 * Call this BEFORE React renders so route guards can see a session.
 */
export const restoreSessionFromCookie = async (): Promise<boolean> => {
  const backup = (await getBackupFromPreferences()) || getSessionBackupFromCookie();
  if (!backup) return false;

  if (backup.expires_at && backup.expires_at * 1000 < Date.now() - 30 * 24 * 60 * 60 * 1000) {
    clearSessionCookie();
    return false;
  }

  try {
    const { data, error } = await supabase.auth.setSession({
      access_token: backup.access_token,
      refresh_token: backup.refresh_token,
    });

    if (error || !data.session) {
      console.log("Session restoration failed, clearing backups");
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
