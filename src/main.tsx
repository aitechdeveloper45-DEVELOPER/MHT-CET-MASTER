import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { restoreSessionFromCookie } from "@/lib/sessionBackup";

const mount = () => createRoot(document.getElementById("root")!).render(<App />);

const requestPersistentStorage = async () => {
  try {
    const storage = (navigator as any).storage;
    if (storage?.persist) await storage.persist();
  } catch {
    // ignore
  }
};

// Try restoring session BEFORE mount so Index page sees it immediately
// Race with a short timeout so app always mounts even if network is slow
const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T | undefined> =>
  Promise.race([promise, new Promise<undefined>((resolve) => setTimeout(() => resolve(undefined), ms))]);

withTimeout(restoreSessionFromCookie(), 2000)
  .catch(() => {})
  .finally(() => {
    mount();
    requestPersistentStorage();
  });
