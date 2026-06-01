import { useEffect, useState } from "react";
import { Sparkles } from "lucide-react";
import { isNative, showInterstitial } from "@/lib/ads";

interface AdGateProps {
  duration?: number;
  label?: string;
  onComplete: () => void;
}

const AdGate = ({ duration = 5, label = "Sponsored", onComplete }: AdGateProps) => {
  const [remaining, setRemaining] = useState(duration);

  // On native: try real AdMob interstitial; fall back to in-app overlay countdown.
  useEffect(() => {
    let cancelled = false;
    if (isNative()) {
      showInterstitial().then((ok) => {
        if (!cancelled && ok) onComplete();
      });
    }
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (remaining <= 0) {
      onComplete();
      return;
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, onComplete]);

  return (
    <div className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-sm flex flex-col items-center justify-center p-4">
      <div className="absolute top-4 right-4 text-xs font-semibold bg-primary text-primary-foreground rounded-full px-3 py-1">
        {label} · {remaining}s
      </div>
      <div className="w-full max-w-md aspect-[4/5] sm:aspect-video rounded-2xl border bg-gradient-to-br from-primary/20 via-primary/10 to-accent/20 flex flex-col items-center justify-center gap-4 shadow-xl overflow-hidden relative">
        <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_20%_20%,hsl(var(--primary))_0%,transparent_60%)]" />
        <div className="relative z-10 flex flex-col items-center gap-3 px-6 text-center">
          <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center">
            <Sparkles className="w-8 h-8 text-primary" />
          </div>
          <h2 className="text-xl font-bold">MHT CET MASTER</h2>
          <p className="text-sm text-muted-foreground">
            Crack CET 2026 — practice unlimited MCQs, AI mentor & smart flashcards.
          </p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/70">Advertisement</p>
        </div>
      </div>
      <p className="mt-4 text-xs text-muted-foreground">
        Please wait {remaining}s — content loading...
      </p>
    </div>
  );
};

export default AdGate;