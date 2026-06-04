import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

const PLAY_URL =
  "https://play.google.com/store/apps/details?id=app.lovable.0bce6dfdcadc450496bf804b52ba13f7";

const KEYS = {
  remindAt: "update_remind_at",
  lastSeenVersion: "update_last_seen_version",
} as const;

const UpdatePrompt = () => {
  const [open, setOpen] = useState(false);
  const [storeVersion, setStoreVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        // Only relevant on native Android (Play Store)
        if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") return;

        const remindAt = parseInt(localStorage.getItem(KEYS.remindAt) || "0", 10);
        if (remindAt && Date.now() < remindAt) return;

        const mod: any = await import("@capawesome/capacitor-app-update");
        const info = await mod.AppUpdate.getAppUpdateInfo();
        // availability: 2 = UPDATE_AVAILABLE
        const available =
          info?.updateAvailability === 2 || info?.updateAvailability === "UPDATE_AVAILABLE";
        if (!available || cancelled) return;

        // Prefer Play in-app flexible update flow when supported
        if (info?.flexibleUpdateAllowed) {
          try {
            await mod.AppUpdate.startFlexibleUpdate();
            return;
          } catch (e) {
            console.warn("Flexible update failed, falling back to dialog", e);
          }
        }

        setStoreVersion(info?.availableVersion ?? null);
        setOpen(true);
      } catch (e) {
        // Plugin missing or Play services unavailable — silently ignore
        console.warn("App update check skipped:", e);
      }
    };
    // Slight delay so we don't compete with first paint
    const t = setTimeout(check, 2500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, []);

  const handleLater = () => {
    // Re-prompt in 3 days (per Play UX guidelines — non-coercive)
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    localStorage.setItem(KEYS.remindAt, (Date.now() + threeDays).toString());
    setOpen(false);
  };

  const handleUpdate = async () => {
    setOpen(false);
    try {
      if (Capacitor.isNativePlatform()) {
        const mod: any = await import("@capawesome/capacitor-app-update");
        await mod.AppUpdate.openAppStore();
        return;
      }
    } catch (e) {
      console.warn("openAppStore failed, falling back to URL", e);
    }
    window.open(PLAY_URL, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleLater(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Download className="h-6 w-6 text-primary" />
          </div>
          <DialogTitle className="text-center text-xl">Update Available</DialogTitle>
          <DialogDescription className="text-center pt-2">
            A new version of MHT CET MASTER{storeVersion ? ` (${storeVersion})` : ""} is available
            on the Play Store with the latest improvements and fixes.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="flex-row gap-2 sm:justify-center">
          <Button variant="outline" className="flex-1" onClick={handleLater}>
            Later
          </Button>
          <Button variant="hero" className="flex-1" onClick={handleUpdate}>
            Update Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UpdatePrompt;