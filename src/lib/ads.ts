import { Capacitor } from "@capacitor/core";
import {
  AdMob,
  BannerAdPluginEvents,
  BannerAdPosition,
  BannerAdSize,
  InterstitialAdPluginEvents,
  MaxAdContentRating,
  type BannerAdOptions,
  type AdMobError,
} from "@capacitor-community/admob";

// AdMob IDs for MHT CET MASTER
export const ADMOB_APP_ID = "ca-app-pub-7641092018364594~2359083953";
export const INTERSTITIAL_AD_UNIT_ID = "ca-app-pub-7641092018364594/4605809043";
export const BANNER_AD_UNIT_ID = "ca-app-pub-7641092018364594/5344175642";

export const isNative = () => Capacitor.isNativePlatform();

let initialized = false;
let listenersRegistered = false;

const logAdMobError = (source: string, error: unknown) => {
  const details = error as Partial<AdMobError> | undefined;
  console.warn(`[AdMob] ${source}`, {
    code: details?.code,
    message: details?.message ?? String(error),
  });
};

async function registerAdListeners() {
  if (listenersRegistered) return;
  listenersRegistered = true;
  await Promise.all([
    AdMob.addListener(BannerAdPluginEvents.Loaded, () => console.info("[AdMob] Banner loaded")),
    AdMob.addListener(BannerAdPluginEvents.FailedToLoad, (error) => logAdMobError("Banner failed to load", error)),
    AdMob.addListener(InterstitialAdPluginEvents.Loaded, (info) => console.info("[AdMob] Interstitial loaded", info)),
    AdMob.addListener(InterstitialAdPluginEvents.FailedToLoad, (error) => logAdMobError("Interstitial failed to load", error)),
    AdMob.addListener(InterstitialAdPluginEvents.FailedToShow, (error) => logAdMobError("Interstitial failed to show", error)),
  ]);
}

export async function initAds() {
  if (!isNative() || initialized) return;
  try {
    await registerAdListeners();
    await AdMob.initialize({
      initializeForTesting: false,
      tagForChildDirectedTreatment: false,
      tagForUnderAgeOfConsent: false,
      maxAdContentRating: MaxAdContentRating.ParentalGuidance,
    });
    initialized = true;
    console.info("[AdMob] Initialized", {
      platform: Capacitor.getPlatform(),
      appId: ADMOB_APP_ID,
      bannerId: BANNER_AD_UNIT_ID,
      interstitialId: INTERSTITIAL_AD_UNIT_ID,
    });
  } catch (e) {
    logAdMobError("Init failed", e);
  }
}

export async function showInterstitial() {
  if (!isNative()) return false;
  try {
    await initAds();
    await AdMob.prepareInterstitial({ adId: INTERSTITIAL_AD_UNIT_ID, isTesting: false });
    await AdMob.showInterstitial();
    return true;
  } catch (e) {
    logAdMobError("Interstitial failed", e);
    return false;
  }
}

export async function showBanner() {
  if (!isNative()) return;
  try {
    await initAds();
    const options: BannerAdOptions = {
      adId: BANNER_AD_UNIT_ID,
      isTesting: false,
      adSize: BannerAdSize.ADAPTIVE_BANNER,
      position: BannerAdPosition.BOTTOM_CENTER,
      margin: 0,
    };
    await AdMob.showBanner(options);
  } catch (e) {
    logAdMobError("Banner failed", e);
  }
}

export async function hideBanner() {
  if (!isNative()) return;
  try {
    await AdMob.hideBanner();
  } catch (e) {
    logAdMobError("Hide banner failed", e);
  }
}