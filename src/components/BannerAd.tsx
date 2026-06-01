import { useEffect } from "react";
import { hideBanner, isNative, showBanner } from "@/lib/ads";

const BannerAd = () => {
  useEffect(() => {
    if (isNative()) {
      showBanner();
      return () => { hideBanner(); };
    }
  }, []);

  // Real AdMob banner renders natively over the webview. Nothing on web.
  return null;
};

export default BannerAd;