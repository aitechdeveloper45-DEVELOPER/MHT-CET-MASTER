import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { isNative, showInterstitial } from "@/lib/ads";

interface AdGateProps {
  duration?: number;
  label?: string;
  onComplete: () => void;
}

const AdGate = ({ duration = 5, label = "Ad", onComplete }: AdGateProps) => {
  const [remaining, setRemaining] = useState(duration);
  const [nativeHandled, setNativeHandled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (isNative()) {
      showInterstitial().then(() => {
        if (!cancelled) { setNativeHandled(true); onComplete(); }
      });
    }
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (isNative()) return;
    if (remaining <= 0) {
      onComplete();
      return;
    }
    const t = setTimeout(() => setRemaining((r) => r - 1), 1000);
    return () => clearTimeout(t);
  }, [remaining, onComplete]);

  if (isNative()) {
    return (
      <div className="fixed inset-0 z-[100] bg-background flex items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[100] bg-background flex flex-col items-center justify-center gap-3 p-4">
      <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      <p className="text-xs text-muted-foreground">Loading... {remaining}s</p>
    </div>
  );
};

export default AdGate;