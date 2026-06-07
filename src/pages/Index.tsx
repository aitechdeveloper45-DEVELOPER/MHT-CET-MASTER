import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { BookOpen, Brain, TrendingUp, Trophy, Target, Zap, Award } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { clearSessionCookie } from "@/lib/sessionBackup";

const Index = () => {
  const navigate = useNavigate();
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    let isMounted = true;
    let handled = false;

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

    const handleUser = async (userId: string) => {
      if (handled || !isMounted) return;
      handled = true;
      const isComplete = await checkProfileComplete(userId);
      if (isMounted) {
        navigate(isComplete ? "/dashboard" : "/profile", {
          replace: true,
          state: { fromAuth: true },
        });
      }
    };

    // Listen for auth state changes — catches session restoration from cookie too
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session?.user && !handled) {
        handleUser(session.user.id);
      }
    });

    // Also do an immediate check from local storage (fastest path)
    supabase.auth.getSession().then(({ data: { session }, error }) => {
      if (error) {
        console.error("Session check error:", error.message);
        clearSessionCookie();
        if (isMounted && !handled) setIsChecking(false);
        return;
      }
      if (session?.user) {
        handleUser(session.user.id);
      } else if (isMounted && !handled) {
        // No session in local storage — wait a bit for cookie restoration
        setTimeout(() => {
          if (isMounted && !handled) setIsChecking(false);
        }, 2000);
      }
    }).catch(() => {
      if (isMounted && !handled) setIsChecking(false);
    });

    // Hard timeout — always show landing page after 4s
    const timeout = setTimeout(() => {
      if (isMounted && !handled && isChecking) {
        setIsChecking(false);
      }
    }, 4000);

    return () => {
      isMounted = false;
      subscription.unsubscribe();
      clearTimeout(timeout);
    };
  }, [navigate]);

  if (isChecking) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const features = [
    {
      icon: BookOpen,
      title: "Subject-wise Tests",
      description: "Practice Physics, Chemistry, and Mathematics with topic-wise practice tests.",
    },
    {
      icon: Brain,
      title: "Practice Analytics",
      description: "View performance analysis based on your test attempts.",
    },
    {
      icon: TrendingUp,
      title: "Progress Tracking",
      description: "Monitor your study progress with weekly and monthly reports.",
    },
    {
      icon: Trophy,
      title: "Performance Reports",
      description: "View reports of your test attempts to identify areas for improvement.",
    },
    {
      icon: Target,
      title: "Study Planner",
      description: "Organize your study sessions and track time spent on each subject.",
    },
    {
      icon: Zap,
      title: "Instant Results",
      description: "Get immediate feedback with solutions after every test.",
    },
  ];

  const stats = [
    { value: "Physics", label: "Subject" },
    { value: "Chemistry", label: "Subject" },
    { value: "MCQ", label: "Practice Format" },
    { value: "Maths", label: "Subject" },
    { value: "Biology", label: "Subject" },
  ];

  return (
    <div className="min-h-screen">
      {/* Navigation */}
      <nav className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-gradient-hero flex items-center justify-center shadow-glow">
              <Award className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
            </div>
            <span className="text-base sm:text-xl font-bold bg-gradient-hero bg-clip-text text-transparent">
              MHT CET MASTER
            </span>
          </div>
          <div className="flex items-center gap-2 sm:gap-4">
            <Button variant="ghost" asChild className="text-xs sm:text-sm">
              <Link to="/auth">Login</Link>
            </Button>
            <Button variant="hero" size="sm" asChild className="text-xs sm:text-sm">
              <Link to="/auth">Get Started</Link>
            </Button>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-10" />
        <div className="container mx-auto px-3 sm:px-4 py-12 sm:py-20 lg:py-28 relative">
          <div className="max-w-3xl mx-auto text-center">
            <div className="space-y-4 sm:space-y-6 animate-in fade-in slide-in-from-bottom duration-700">
              <div className="inline-block px-3 sm:px-4 py-1.5 sm:py-2 rounded-full bg-primary/10 text-primary text-xs sm:text-sm font-medium">
                Maharashtra MHT-CET Study App
              </div>
              <h1 className="text-3xl sm:text-5xl lg:text-6xl font-bold leading-tight">
                Practice for MHT-CET with{" "}
                <span className="bg-gradient-hero bg-clip-text text-transparent">
                  Subject-wise Tests
                </span>
              </h1>
              <p className="text-base sm:text-xl text-muted-foreground leading-relaxed">
                A study app to practice Maharashtra MHT-CET questions in
                Physics, Chemistry, and Mathematics, with progress tracking and reports.
              </p>
              <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 pt-2 sm:pt-4 justify-center">
                <Button variant="hero" size="lg" asChild className="text-sm sm:text-base">
                  <Link to="/auth">
                    Get Started <Zap className="ml-2 w-4 h-4" />
                  </Link>
                </Button>
              </div>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3 sm:gap-6 pt-2 sm:pt-4 text-xs sm:text-sm text-muted-foreground">
                <div className="flex items-center gap-2">
                  <BookOpen className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>Physics, Chemistry, Maths & Biology</span>
                </div>
                <div className="flex items-center gap-2">
                  <Brain className="w-3 h-3 sm:w-4 sm:h-4" />
                  <span>AI-Powered Practice Tests</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="border-y bg-muted/30 backdrop-blur-sm">
        <div className="container mx-auto px-3 sm:px-4 py-8 sm:py-12">
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-8">
            {stats.map((stat, index) => (
              <div key={index} className="text-center space-y-1 sm:space-y-2 animate-in fade-in zoom-in duration-500" style={{ animationDelay: `${index * 100}ms` }}>
                <div className="text-2xl sm:text-4xl lg:text-5xl font-bold bg-gradient-hero bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-xs sm:text-sm text-muted-foreground font-medium">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 sm:py-20 lg:py-28">
        <div className="container mx-auto px-3 sm:px-4">
          <div className="text-center space-y-3 sm:space-y-4 mb-8 sm:mb-16">
            <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold">
              App{" "}
              <span className="bg-gradient-hero bg-clip-text text-transparent">Features</span>
            </h2>
            <p className="text-sm sm:text-xl text-muted-foreground max-w-2xl mx-auto">
              Features available in the app for MHT-CET practice
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {features.map((feature, index) => {
              const Icon = feature.icon;
              return (
                <Card
                  key={index}
                  className="group hover:shadow-medium transition-all duration-300 hover:border-primary/50 animate-in fade-in slide-in-from-bottom duration-500"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <CardHeader className="px-4 sm:px-6 py-4 sm:py-6">
                    <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg bg-gradient-hero flex items-center justify-center mb-3 sm:mb-4 group-hover:scale-110 transition-transform duration-300 shadow-glow">
                      <Icon className="w-5 h-5 sm:w-6 sm:h-6 text-primary-foreground" />
                    </div>
                    <CardTitle className="text-base sm:text-xl">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent className="px-4 sm:px-6">
                    <CardDescription className="text-xs sm:text-base leading-relaxed">
                      {feature.description}
                    </CardDescription>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-20 lg:py-28 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-hero opacity-5" />
        <div className="container mx-auto px-3 sm:px-4 relative">
          <Card className="bg-gradient-card border-primary/20 shadow-glow">
            <CardContent className="p-6 sm:p-12 text-center space-y-4 sm:space-y-6">
              <h2 className="text-2xl sm:text-4xl lg:text-5xl font-bold">
                Start Your CET Preparation
              </h2>
              <p className="text-sm sm:text-xl text-muted-foreground max-w-2xl mx-auto">
                Begin your MHT-CET preparation journey today.
                Access practice tests and track your progress.
              </p>
              <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4 justify-center pt-2 sm:pt-4">
                <Button variant="hero" size="lg" asChild className="text-sm sm:text-base">
                  <Link to="/auth">
                    Get Started
                  </Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30 backdrop-blur-sm py-8 sm:py-12">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 mb-6 sm:mb-8">
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-hero flex items-center justify-center">
                  <Award className="w-5 h-5 text-primary-foreground" />
                </div>
                <span className="font-bold text-base sm:text-lg">MHT CET MASTER</span>
              </div>
              <p className="text-xs sm:text-sm text-muted-foreground">
                A study app for MHT-CET practice in Physics, Chemistry, and Mathematics.
              </p>
            </div>
            <div>
              <h3 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Support</h3>
              <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground">
                <li><Link to="/contact-support" className="hover:text-primary transition-colors">Contact Support</Link></li>
              </ul>
            </div>
            <div>
              <h3 className="font-semibold mb-3 sm:mb-4 text-sm sm:text-base">Legal</h3>
              <ul className="space-y-2 text-xs sm:text-sm text-muted-foreground">
                <li><Link to="/privacy-policy" className="hover:text-primary transition-colors">Privacy Policy</Link></li>
                <li><Link to="/terms" className="hover:text-primary transition-colors">Terms of Service</Link></li>
              </ul>
            </div>
          </div>
          <div className="pt-6 sm:pt-8 border-t text-center text-xs sm:text-sm text-muted-foreground space-y-1">
            <p>© 2026 MHT CET MASTER. All rights reserved by AI TECHDEVELOPER.</p>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Index;
