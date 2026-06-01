import { useEffect } from "react";
import { hideBanner, isNative, showBanner } from "@/lib/ads";

const BannerAd = () => {
  useEffect(() => {
    if (isNative()) {
      showBanner();
      return () => { hideBanner(); };
    }
  }, []);

  // On native, the real AdMob banner is rendered by the OS over the webview.
  if (isNative()) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-card/95 backdrop-blur-sm">
      <div className="container mx-auto px-3 py-2 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-[9px] uppercase font-semibold bg-primary/10 text-primary rounded px-1.5 py-0.5 shrink-0">
            Ad
          </span>
          <p className="text-xs sm:text-sm font-medium truncate">
            MHT CET MASTER — Boost your rank with AI-powered prep
          </p>
        </div>
        <span className="text-[10px] text-muted-foreground shrink-0 hidden sm:inline">Sponsored</span>
      </div>
    </div>
  );
};

export default BannerAd;