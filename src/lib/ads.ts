import { Capacitor } from "@capacitor/core";
import {
  AdMob,
  BannerAdPosition,
  BannerAdSize,
  type BannerAdOptions,
  type InterstitialAdPluginEvents,
} from "@capacitor-community/admob";

// AdMob IDs for MHT CET MASTER
export const ADMOB_APP_ID = "ca-app-pub-7641092018364594~2359083953";
export const INTERSTITIAL_AD_UNIT_ID = "ca-app-pub-7641092018364594/4605809043";
export const BANNER_AD_UNIT_ID = "ca-app-pub-7641092018364594/5344175642";

export const isNative = () => Capacitor.isNativePlatform();

let initialized = false;
export async function initAds() {
  if (!isNative() || initialized) return;
  try {
    await AdMob.initialize({ initializeForTesting: false });
    initialized = true;
  } catch (e) {
    console.warn("AdMob init failed", e);
  }
}

export async function showInterstitial() {
  if (!isNative()) return false;
  try {
    await initAds();
    await AdMob.prepareInterstitial({ adId: INTERSTITIAL_AD_UNIT_ID });
    await AdMob.showInterstitial();
    return true;
  } catch (e) {
    console.warn("Interstitial failed", e);
    return false;
  }
}

export async function showBanner() {
  if (!isNative()) return;
  try {
    await initAds();
    const options: BannerAdOptions = {
      adId: BANNER_AD_UNIT_ID,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
    };
    await AdMob.showBanner(options);
  } catch (e) {
    console.warn("Banner failed", e);
  }
}

export async function hideBanner() {
  if (!isNative()) return;
  try { await AdMob.hideBanner(); } catch {}
}