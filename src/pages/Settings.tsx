import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  User, Moon, Sun, Monitor, FileText, LogOut, AlertTriangle,
  ChevronRight, ArrowLeft, Shield, Mail, Check
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useTheme } from "next-themes";
import { clearSessionCookie } from "@/lib/sessionBackup";

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [signingOut, setSigningOut] = useState(false);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      clearSessionCookie();
      await supabase.auth.signOut();
      navigate("/auth", { replace: true });
    } catch (error) {
      console.error("Error signing out:", error);
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSigningOut(false);
    }
  };

  const themeLabel = theme === "light" ? "Light" : theme === "dark" ? "Dark" : "System";

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card/80 backdrop-blur-md border-b">
        <div className="flex items-center gap-3 px-4 py-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-10 w-10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">Settings</h1>
        </div>
      </div>

      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Account Section */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Account</p>
          <Card className="overflow-hidden">
            <CardContent className="p-0 divide-y divide-border">
              <SettingsItem
                icon={<User className="h-5 w-5 text-primary" />}
                label="Profile"
                description="Manage your profile details"
                onClick={() => navigate("/profile")}
              />
            </CardContent>
          </Card>
        </div>

        {/* Appearance Section */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Appearance</p>
          <Card className="overflow-hidden">
            <CardContent className="p-0 divide-y divide-border">
              <div className="px-4 py-3 space-y-3">
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                    <Monitor className="h-5 w-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">Theme</p>
                    <p className="text-xs text-muted-foreground">Currently: {themeLabel}</p>
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { value: "light", label: "Light", icon: Sun },
                    { value: "dark", label: "Dark", icon: Moon },
                    { value: "system", label: "System", icon: Monitor },
                  ].map(({ value, label, icon: Icon }) => (
                    <Button
                      key={value}
                      variant={theme === value ? "default" : "outline"}
                      size="sm"
                      className="flex items-center gap-1.5 h-9"
                      onClick={() => setTheme(value)}
                    >
                      {theme === value ? (
                        <Check className="h-3.5 w-3.5" />
                      ) : (
                        <Icon className="h-3.5 w-3.5" />
                      )}
                      {label}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Legal Section */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Legal</p>
          <Card className="overflow-hidden">
            <CardContent className="p-0 divide-y divide-border">
              <SettingsItem
                icon={<Shield className="h-5 w-5 text-primary" />}
                label="Privacy Policy"
                onClick={() => navigate("/privacy-policy")}
              />
              <SettingsItem
                icon={<FileText className="h-5 w-5 text-primary" />}
                label="Terms of Service"
                onClick={() => navigate("/terms")}
              />
            </CardContent>
          </Card>
        </div>

        {/* Support Section */}
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground px-1">Support</p>
          <Card className="overflow-hidden">
            <CardContent className="p-0 divide-y divide-border">
              <SettingsItem
                icon={<Mail className="h-5 w-5 text-primary" />}
                label="Contact Support"
                description="aitechdeveloper45@gmail.com"
                onClick={() => navigate("/contact-support")}
              />
            </CardContent>
          </Card>
        </div>

        {/* Actions */}
        <div className="space-y-3 pt-2">
          <Button
            variant="outline"
            className="w-full justify-start gap-3 h-12 text-destructive hover:text-destructive border-destructive/20 hover:bg-destructive/5"
            onClick={handleSignOut}
            disabled={signingOut}
          >
            <LogOut className="h-5 w-5" />
            {signingOut ? "Signing out..." : "Logout"}
          </Button>
          <Button
            variant="ghost"
            className="w-full justify-start gap-3 h-12 text-destructive/70 hover:text-destructive hover:bg-destructive/5"
            onClick={() => navigate("/delete-account")}
          >
            <AlertTriangle className="h-5 w-5" />
            Delete Account
          </Button>
        </div>

        {/* App Info */}
        <div className="text-center pt-4 pb-8">
          <p className="text-xs text-muted-foreground">MHT CET MASTER v1.0</p>
          <p className="text-xs text-muted-foreground mt-1">© 2026 AI TECHDEVELOPER</p>
        </div>
      </div>
    </div>
  );
};

interface SettingsItemProps {
  icon: React.ReactNode;
  label: string;
  description?: string;
  onClick: () => void;
}

const SettingsItem = ({ icon, label, description, onClick }: SettingsItemProps) => (
  <button
    onClick={onClick}
    className="w-full flex items-center gap-3 px-4 py-3.5 hover:bg-muted/50 transition-colors text-left"
  >
    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
      {icon}
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-sm font-medium">{label}</p>
      {description && (
        <p className="text-xs text-muted-foreground truncate">{description}</p>
      )}
    </div>
    <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
  </button>
);

export default Settings;
