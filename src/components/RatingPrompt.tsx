import { useEffect, useState } from "react";
import { Capacitor } from "@capacitor/core";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";

const KEYS = {
  rated: "rating_submitted",
  remindAt: "rating_remind_at",
} as const;

const PACKAGE_ID = "app.lovable.bcfa162408034f569134b5f4b45221c2";
const PLAY_URL = `https://play.google.com/store/apps/details?id=${PACKAGE_ID}`;
const MARKET_URL = `market://details?id=${PACKAGE_ID}`;

const openPlayStore = () => {
  // WebView / Android: market:// triggers Play Store app directly
  try {
    if (Capacitor.getPlatform() === "android") {
      window.location.href = MARKET_URL;
      setTimeout(() => { window.location.href = PLAY_URL; }, 600);
      return;
    }
  } catch {}
  window.open(PLAY_URL, "_blank") || (window.location.href = PLAY_URL);
};

const RatingPrompt = () => {
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState(0);

  useEffect(() => {
    if (localStorage.getItem(KEYS.rated) === "1") return;
    const remindAt = parseInt(localStorage.getItem(KEYS.remindAt) || "0", 10);
    if (remindAt && Date.now() < remindAt) return;
    const t = setTimeout(() => setOpen(true), 2000);
    return () => clearTimeout(t);
  }, []);

  const handleLater = () => {
    const threeDays = 3 * 24 * 60 * 60 * 1000;
    localStorage.setItem(KEYS.remindAt, (Date.now() + threeDays).toString());
    setOpen(false);
  };

  const handleStarClick = (stars: number) => {
    localStorage.setItem(KEYS.rated, "1");
    setOpen(false);
    openPlayStore();
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
        <div className="flex justify-center gap-2 py-4" onMouseLeave={() => setHover(0)}>
          {[1, 2, 3, 4, 5].map((i) => (
            <button
              key={i}
              type="button"
              onMouseEnter={() => setHover(i)}
              onClick={() => handleStarClick(i)}
              className="p-1"
              aria-label={`Rate ${i} stars`}
            >
              <Star
                className={`w-10 h-10 transition-transform ${
                  i <= hover ? "fill-yellow-400 text-yellow-400 scale-110" : "text-muted-foreground"
                }`}
              />
            </button>
          ))}
        </div>
        <p className="text-center text-xs text-muted-foreground">Tap a star to rate us on Play Store</p>
        <DialogFooter className="flex-row gap-2 sm:justify-center pt-2">
          <Button variant="outline" className="flex-1" onClick={handleLater}>
            Maybe Later
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default RatingPrompt;