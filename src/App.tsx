import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { ThemeProvider } from "next-themes";
import SessionBackupListener from "@/components/SessionBackupListener";
import Index from "./pages/Index";
import Settings from "./pages/Settings";
import ContactSupport from "./pages/ContactSupport";
import Auth from "./pages/Auth";
import Dashboard from "./pages/Dashboard";
import Profile from "./pages/Profile";
import Test from "./pages/Test";
import Mentor from "./pages/Mentor";
import PrivacyPolicy from "./pages/PrivacyPolicy";
import Terms from "./pages/Terms";
import DeleteAccount from "./pages/DeleteAccount";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Global handler for uncaught promise rejections (prevents white-screen crashes on mobile)
if (typeof window !== "undefined") {
  window.addEventListener("unhandledrejection", (event) => {
    console.error("Unhandled promise rejection:", event.reason);
    event.preventDefault();
  });
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange storageKey="cetprep-theme">
      <TooltipProvider>
        <SessionBackupListener />
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/auth" element={<Auth />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/test" element={<Test />} />
            <Route path="/mentor" element={<Mentor />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/contact-support" element={<ContactSupport />} />
            <Route path="/privacy-policy" element={<PrivacyPolicy />} />
            <Route path="/terms" element={<Terms />} />
            <Route path="/delete-account" element={<DeleteAccount />} />
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;

