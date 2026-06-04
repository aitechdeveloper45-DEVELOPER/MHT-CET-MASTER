import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";

const KEYS = {
  installedAt: "rating_installed_at",
  testsCompleted: "rating_tests_completed",
  rated: "rating_submitted",
  remindAt: "rating_remind_at",
} as const;

const PLAY_URL = "https://play.google.com/store/apps/details?id=app.lovable.0bce6dfdcadc450496bf804b52ba13f7";

const RatingPrompt = () => {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(0);

  useEffect(() => {
    // First-run install timestamp
    if (!localStorage.getItem(KEYS.installedAt)) {
      localStorage.setItem(KEYS.installedAt, Date.now().toString());
    }

    // Listen for test completions
    const onTestDone = () => {
      const n = parseInt(localStorage.getItem(KEYS.testsCompleted) || "0", 10) + 1;
      localStorage.setItem(KEYS.testsCompleted, n.toString());
      maybeShow();
    };
    window.addEventListener("test-completed", onTestDone);

    const maybeShow = () => {
      if (localStorage.getItem(KEYS.rated) === "1") return;
      const remindAt = parseInt(localStorage.getItem(KEYS.remindAt) || "0", 10);
      if (remindAt && Date.now() < remindAt) return;

      const tests = parseInt(localStorage.getItem(KEYS.testsCompleted) || "0", 10);
      const installedAt = parseInt(localStorage.getItem(KEYS.installedAt) || "0", 10);
      const days = installedAt ? (Date.now() - installedAt) / (1000 * 60 * 60 * 24) : 0;

      if (tests >= 2 || days >= 7) {
        // Slight delay to avoid colliding with navigation
        setTimeout(() => setOpen(true), 1200);
      }
    };

    maybeShow();
    return () => window.removeEventListener("test-completed", onTestDone);
  }, []);

  const handleLater = () => {
    const fourteenDays = 14 * 24 * 60 * 60 * 1000;
    localStorage.setItem(KEYS.remindAt, (Date.now() + fourteenDays).toString());
    setOpen(false);
  };

  const handleRate = async () => {
    localStorage.setItem(KEYS.rated, "1");
    setOpen(false);
    try {
      if (Capacitor.isNativePlatform()) {
        const mod: any = await import("@capacitor-community/in-app-review");
        if (mod?.InAppReview?.requestReview) {
          await mod.InAppReview.requestReview();
          return;
        }
      }
    } catch (e) {
      console.warn("In-app review unavailable, falling back to Play Store", e);
    }
    window.open(PLAY_URL, "_blank");
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleLater(); }}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-center text-xl">Enjoying MHT CET MASTER ?</DialogTitle>
          <DialogDescription className="text-center pt-2">
            Your feedback helps us improve and helps other students discover the app.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-center gap-1 py-3" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <Star
              key={i}
              className={`w-9 h-9 transition-transform ${
                i <= hover ? "fill-yellow-400 text-yellow-400 scale-110" : "text-muted-foreground"
              }`}
              onMouseEnter={() => setHover(i)}
            />
          ))}
        </div>
        <DialogFooter className="flex-row gap-2 sm:justify-center">
          <Button variant="outline" className="flex-1" onClick={handleLater}>
            Maybe Later
          </Button>
          <Button variant="hero" className="flex-1" onClick={handleRate}>
            Rate Now
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RatingPrompt;