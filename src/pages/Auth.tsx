import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Award, Mail, Lock, User, ArrowRight, Eye, EyeOff } from "lucide-react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

import { useToast } from "@/hooks/use-toast";
import { clearSessionCookie } from "@/lib/sessionBackup";

const Auth = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [isCheckingSession, setIsCheckingSession] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showSignupPassword, setShowSignupPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const redirectTo = searchParams.get("redirect");
  const { toast } = useToast();

  const checkProfileComplete = async (userId: string): Promise<boolean> => {
    try {
      const { data } = await supabase
        .from("profiles")
        .select("name, class, college_name")
        .eq("user_id", userId)
        .maybeSingle();

      return !!(data?.name && data?.class && data?.college_name);
    } catch (error) {
      console.error("Error checking profile:", error);
      return false;
    }
  };

  useEffect(() => {
    let isMounted = true;

    const checkSession = async () => {
      try {
        // Race session check against a timeout to avoid hanging on bad network/tokens
        const sessionResult = await Promise.race([
          supabase.auth.getSession(),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
        ]);

        if (!sessionResult || !isMounted) {
          if (isMounted) setIsCheckingSession(false);
          return;
        }

        const { data: { session }, error } = sessionResult as Awaited<ReturnType<typeof supabase.auth.getSession>>;
        
        if (error) {
          clearSessionCookie();
          if (isMounted) setIsCheckingSession(false);
          return;
        }
        
        if (session?.user && isMounted) {
          const isComplete = await checkProfileComplete(session.user.id);
          const dest = redirectTo || (isComplete ? "/dashboard" : "/profile");
          navigate(dest, { 
            replace: true,
            state: { fromAuth: true }
          });
        } else if (isMounted) {
          setIsCheckingSession(false);
        }
      } catch (err) {
        console.error("Auth: Unexpected error", err);
        if (isMounted) setIsCheckingSession(false);
      }
    };

    checkSession();

    return () => {
      isMounted = false;
    };
  }, [navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    // Auto-reset after 12s to prevent infinite "Signing in..." on flaky mobile networks
    const safetyTimer = setTimeout(() => {
      setIsLoading(false);
      toast({
        title: "Timeout",
        description: "Sign-in is taking too long. Please try again.",
        variant: "destructive"
      });
    }, 12000);
    
    try {
      const signInPromise = supabase.auth.signInWithPassword({ email, password });
      
      // Race against a 10s timeout so we don't hang on devices where fetch silently stalls
      const result = await Promise.race([
        signInPromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
      ]);

      if (!result) {
        clearTimeout(safetyTimer);
        toast({
          title: "Timeout",
          description: "Sign-in took too long. Please check your connection and try again.",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      const { data, error } = result as Awaited<ReturnType<typeof supabase.auth.signInWithPassword>>;

      if (error) {
        clearTimeout(safetyTimer);
        const msg = error.message === "Failed to fetch" 
          ? "Network error. Please check your internet connection and try again."
          : error.message;
        toast({
          title: "Error",
          description: msg,
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      clearTimeout(safetyTimer);

      if (data.session) {
        const isComplete = await checkProfileComplete(data.session.user.id);
        const dest = redirectTo || (isComplete ? "/dashboard" : "/profile");
        navigate(dest, { 
          replace: true,
          state: { fromAuth: true }
        });
      } else {
        setIsLoading(false);
      }
    } catch (err: any) {
      clearTimeout(safetyTimer);
      toast({
        title: "Error",
        description: "Network error. Please check your internet connection and try again.",
        variant: "destructive"
      });
      setIsLoading(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const safetyTimer = setTimeout(() => {
      setIsLoading(false);
      toast({
        title: "Timeout",
        description: "Sign-up is taking too long. Please try again.",
        variant: "destructive"
      });
    }, 12000);
    
    try {
      const signUpPromise = supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: `${window.location.origin}/profile`,
          data: {
            full_name: fullName
          }
        }
      });

      const result = await Promise.race([
        signUpPromise,
        new Promise<null>((resolve) => setTimeout(() => resolve(null), 10000)),
      ]);

      if (!result) {
        clearTimeout(safetyTimer);
        toast({
          title: "Timeout",
          description: "Sign-up took too long. Please check your connection and try again.",
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }

      const { data, error } = result as Awaited<ReturnType<typeof supabase.auth.signUp>>;

      if (error) {
        clearTimeout(safetyTimer);
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
        setIsLoading(false);
        return;
      }
      
      clearTimeout(safetyTimer);

      if (data.session) {
        toast({
          title: "Success!",
          description: "Account created successfully.",
        });
        navigate(redirectTo || "/profile", { 
          replace: true,
          state: { fromAuth: true }
        });
      } else {
        toast({
          title: "Success!",
          description: "Account created successfully. You can now sign in.",
        });
        setIsLoading(false);
      }
    } catch (err: any) {
      clearTimeout(safetyTimer);
      toast({
        title: "Error",
        description: err.message || "An unexpected error occurred",
        variant: "destructive"
      });
      setIsLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetting(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth?reset=true`,
      });

      if (error) {
        toast({
          title: "Error",
          description: error.message,
          variant: "destructive"
        });
      } else {
        toast({
          title: "Email Sent!",
          description: "Check your inbox for the password reset link.",
        });
        setShowForgotPassword(false);
        setResetEmail("");
      }
    } catch (err: any) {
      toast({
        title: "Error",
        description: err.message || "An unexpected error occurred",
        variant: "destructive"
      });
    } finally {
      setIsResetting(false);
    }
  };

  // Detect if running inside a WebView (Appyzeen, Capacitor, etc.)
  const isWebView = () => {
    const ua = navigator.userAgent || '';
    return /wv|WebView|AppyzeenWebView/i.test(ua) || 
           // Android WebView detection
           (/Android/.test(ua) && /Version\/[\d.]+/.test(ua) && !/Chrome\/[\d.]+ Mobile Safari/.test(ua)) ||
           // iOS WebView detection  
           (/(iPhone|iPod|iPad).*AppleWebKit(?!.*Safari)/i.test(ua)) ||
           // Standalone PWA or TWA
           (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches);
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    
    // Auto-reset loading after 8 seconds (covers redirect/network failure cases)
    const resetTimer = setTimeout(() => setIsGoogleLoading(false), 8000);
    
    try {
      if (isWebView()) {
        const oauthUrl = `${window.location.origin}/auth?google_oauth=true`;
        window.open(oauthUrl, '_system');
        
        const { error } = await lovable.auth.signInWithOAuth("google", {
          redirect_uri: window.location.origin,
        });
        if (error) {
          clearTimeout(resetTimer);
          toast({
            title: "Error",
            description: "Google sign-in may not work inside the app. Try opening in your phone's browser.",
            variant: "destructive",
          });
          setIsGoogleLoading(false);
        }
      } else {
        const { error } = await lovable.auth.signInWithOAuth("google", {
          redirect_uri: window.location.origin,
        });
        if (error) {
          clearTimeout(resetTimer);
          toast({
            title: "Error",
            description: error.message === "Failed to fetch" 
              ? "Network error. Please check your internet connection and try again."
              : error.message || "Google sign-in failed",
            variant: "destructive",
          });
          setIsGoogleLoading(false);
        }
      }
    } catch (err: any) {
      clearTimeout(resetTimer);
      toast({
        title: "Error",
        description: "Network error. Please check your internet connection and try again.",
        variant: "destructive",
      });
      setIsGoogleLoading(false);
    }
  };

  // Show loading while checking existing session
  if (isCheckingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute inset-0 bg-gradient-hero opacity-5" />
      <div className="absolute top-20 left-20 w-72 h-72 bg-primary/20 rounded-full blur-3xl" />
      <div className="absolute bottom-20 right-20 w-96 h-96 bg-secondary/20 rounded-full blur-3xl" />

      <div className="w-full max-w-md relative">
        {/* Logo */}
        <Link to="/" className="flex items-center justify-center gap-2 mb-8">
          <div className="w-12 h-12 rounded-lg bg-gradient-hero flex items-center justify-center shadow-glow">
            <Award className="w-7 h-7 text-primary-foreground" />
          </div>
          <span className="text-2xl font-bold bg-gradient-hero bg-clip-text text-transparent">
            MHT CET MASTER
          </span>
        </Link>

        <Card className="shadow-glow border-primary/20 backdrop-blur-sm bg-card/95">
          <CardHeader className="text-center space-y-2">
            <CardTitle className="text-3xl font-bold">Welcome</CardTitle>
            <CardDescription className="text-base">
              Sign in to continue your CET preparation journey
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="login" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="login">Login</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="student@example.com"
                        className="pl-10"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <Label htmlFor="login-password">Password</Label>
                      <button 
                        type="button" 
                        className="text-sm text-primary hover:underline"
                        onClick={() => setShowForgotPassword(true)}
                      >
                        Forgot?
                      </button>
                    </div>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="pl-10 pr-10"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                   <Button
                    type="submit"
                    variant="hero"
                    className="w-full"
                    size="lg"
                    disabled={isLoading}
                  >
                    {isLoading ? "Signing in..." : "Sign In"}
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>

                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form onSubmit={handleSignUp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-name">Full Name</Label>
                    <div className="relative">
                      <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-name"
                        type="text"
                        placeholder="Sneha Kumar"
                        className="pl-10"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-email"
                        type="email"
                        placeholder="student@example.com"
                        className="pl-10"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="signup-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="signup-password"
                        type={showSignupPassword ? "text" : "password"}
                        placeholder="••••••••"
                        className="pl-10 pr-10"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignupPassword(!showSignupPassword)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                      >
                        {showSignupPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>
                   <Button
                    type="submit"
                    variant="hero"
                    className="w-full"
                    size="lg"
                    disabled={isLoading}
                  >
                    {isLoading ? "Creating account..." : "Create Account"}
                    <ArrowRight className="ml-2 w-4 h-4" />
                  </Button>
                </form>
              </TabsContent>
            </Tabs>

            <p className="text-center text-sm text-muted-foreground mt-6">
              By continuing, you agree to our{" "}
              <Link to="/terms" className="text-primary hover:underline">
                Terms
              </Link>{" "}
              and{" "}
              <Link to="/privacy-policy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
            </p>
          </CardContent>
        </Card>

        <div className="text-center mt-6 text-sm text-muted-foreground">
          Need help?{" "}
          <Link to="/contact-support" className="text-primary hover:underline font-medium">
            Contact Support
          </Link>
        </div>
      </div>

      {/* Forgot Password Dialog */}
      <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter your email address and we'll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleForgotPassword} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="reset-email"
                  type="email"
                  placeholder="student@example.com"
                  className="pl-10"
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  required
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setShowForgotPassword(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="hero"
                className="flex-1"
                disabled={isResetting}
              >
                {isResetting ? "Sending..." : "Send Reset Link"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Auth;
