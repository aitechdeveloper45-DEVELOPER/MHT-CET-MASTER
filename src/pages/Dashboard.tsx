import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BookOpen, Clock, Target, Trophy, TrendingUp, LogOut, Brain, Calendar, Zap, Loader2, Shield, MoreVertical, User, Award, AlertTriangle, Sparkles, Layers } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useAdmin } from "@/hooks/useAdmin";
import { AdminPanel } from "@/components/AdminPanel";

import { useStudyTimeTracker } from "@/hooks/useStudyTimeTracker";
import ProgressTracker from "@/components/ProgressTracker";
import { CHAPTERS, type StudyClass, type CetSubject } from "@/lib/chapters";
const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdmin, loading: adminLoading } = useAdmin();
  
  
  const [loading, setLoading] = useState(true);
  const [becomingAdmin, setBecomingAdmin] = useState(false);
  const [userName, setUserName] = useState("Student");
  const [userStats, setUserStats] = useState({
    studyStreak: 0,
    overallAccuracy: 0,
    testsCompleted: 0,
    studyTime: 0,
  });
  const [recentTests, setRecentTests] = useState<any[]>([]);
  const [weeklyGoals, setWeeklyGoals] = useState<any[]>([]);
  const [topicProgress, setTopicProgress] = useState<any[]>([]);
  
  // Test configuration state
  const [selectedSubject, setSelectedSubject] = useState("Mathematics");
  const [difficulty, setDifficulty] = useState("medium");
  const [numQuestions, setNumQuestions] = useState(20);

  // Chapter-wise test state
  const [chapterClass, setChapterClass] = useState<StudyClass>("XII");
  const [chapterSubject, setChapterSubject] = useState<CetSubject>("Mathematics");
  const [selectedChapter, setSelectedChapter] = useState<string>(CHAPTERS.XII.Mathematics[0]);
  const [chapterDifficulty, setChapterDifficulty] = useState("medium");
  const [chapterNumQuestions, setChapterNumQuestions] = useState(15);
  
  const [generatingTest, setGeneratingTest] = useState(false);
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [refreshing, setRefreshing] = useState(false);

  // Track study time
  useStudyTimeTracker(userId);

  useEffect(() => {
    checkUser();
  }, []);

  // Refresh data when page becomes visible (e.g., returning from test)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && userId) {
        fetchUserData(userId);
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [userId]);

  const checkUser = async () => {
    try {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error("Dashboard: Session error", error.message);
        navigate("/auth");
        return;
      }
      
      if (!session) {
        navigate("/auth");
        return;
      }

      setUserId(session.user.id);
      
      await fetchUserData(session.user.id);
    } catch (err) {
      console.error("Dashboard: Unexpected error checking user", err);
      toast({
        title: "Error",
        description: "Failed to load your session. Please sign in again.",
        variant: "destructive",
      });
      navigate("/auth");
    }
  };

  const fetchUserData = async (userId: string) => {
    try {
      // Fetch ALL data in parallel for faster loading
      const [profileResult, statsResult, testsResult, goalsResult, topicResult] = await Promise.all([
        supabase.from('profiles').select('name').eq('user_id', userId).maybeSingle(),
        supabase.from('user_stats').select('*').eq('user_id', userId).maybeSingle(),
        supabase.from('test_results').select('*').eq('user_id', userId).order('created_at', { ascending: false }).limit(5),
        supabase.from('weekly_goals').select('*').eq('user_id', userId),
        supabase.from('topic_progress').select('*').eq('user_id', userId),
      ]);

      // Process profile
      setUserName(profileResult.data?.name || "Student");

      // Process stats
      if (statsResult.data) {
        setUserStats({
          studyStreak: statsResult.data.study_streak || 0,
          overallAccuracy: statsResult.data.overall_accuracy || 0,
          testsCompleted: statsResult.data.total_tests || 0,
          studyTime: statsResult.data.study_time_minutes || 0,
        });
      }

      // Process recent tests
      if (testsResult.data) {
        setRecentTests(testsResult.data.map(t => ({
          name: t.test_name,
          subject: t.subject,
          score: t.score,
          maxScore: t.max_score,
          date: new Date(t.created_at!).toLocaleDateString(),
        })));
      }

      // Process weekly goals
      if (goalsResult.data) {
        setWeeklyGoals(goalsResult.data.map(g => ({
          title: g.goal_title,
          current: g.current_value,
          target: g.target_value,
        })));
      }

      // Process topic progress
      if (topicResult.data) {
        setTopicProgress(topicResult.data);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefreshData = async () => {
    if (!userId || refreshing) return;
    
    setRefreshing(true);
    toast({
      title: "Refreshing",
      description: "Updating your dashboard data...",
    });
    
    await fetchUserData(userId);
    
    toast({
      title: "Refreshed",
      description: "Your dashboard has been updated!",
    });
  };

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleBecomeAdmin = async () => {
    setBecomingAdmin(true);
    try {
      const { data, error } = await supabase.functions.invoke('become-admin', {
        body: {}
      });

      if (error) throw error;

      if (data.success) {
        toast({
          title: "Success!",
          description: "You are now an admin. Refresh the page to see admin controls.",
        });
        window.location.reload();
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to become admin",
        variant: "destructive",
      });
    } finally {
      setBecomingAdmin(false);
    }
  };

  const handleStartFullCETTest = async () => {
    if (!userId || generatingTest) return;

    setGeneratingTest(true);
    
    toast({
      title: "Generating Full CET Test",
      description: "Creating 150 questions (50 each for Physics, Chemistry & Mathematics)... This may take up to 2 minutes.",
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please sign in to generate a test.");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-mcq-test`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            fullCETTest: true,
          }),
        }
      );

      if (!response.ok) {
        let errorMessage = "Failed to generate test";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          try {
            const errorText = await response.text();
            errorMessage = errorText || errorMessage;
          } catch (e2) {
            // Use default error message
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Navigate to test page with generated questions
      navigate("/test", {
        state: {
          questions: data.questions,
          subject: "Full MHT-CET",
          difficulty: "mixed",
          timeLimit: 180,
        },
      });
    } catch (error) {
      console.error("Error generating full CET test:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate full CET test. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGeneratingTest(false);
    }
  };

  const handleStartTest = async () => {
    if (generatingTest) return;
    
    setGeneratingTest(true);
    const estimatedTime = numQuestions <= 10 ? "10-15" : numQuestions <= 20 ? "15-25" : "25-35";
    toast({
      title: "Generating Test",
      description: `Creating ${numQuestions} ${difficulty} ${selectedSubject} questions... This may take ${estimatedTime} seconds.`,
    });

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please sign in to generate a test.");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-mcq-test`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            subject: selectedSubject,
            difficulty,
            numQuestions,
          }),
        }
      );

      if (!response.ok) {
        let errorMessage = "Failed to generate test";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If response is not JSON, try to get text
          try {
            const errorText = await response.text();
            errorMessage = errorText || errorMessage;
          } catch (e2) {
            // Use default error message
          }
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      
      // Navigate to test page with generated questions
      navigate("/test", {
        state: {
          questions: data.questions,
          subject: selectedSubject,
          difficulty,
          timeLimit: Math.ceil(numQuestions * 2),
        },
      });
    } catch (error) {
      console.error("Error generating test:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate test. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGeneratingTest(false);
    }
  };

  const handleStartChapterTest = async () => {
    if (generatingTest) return;
    setGeneratingTest(true);
    toast({
      title: "Generating Chapter Test",
      description: `Creating ${chapterNumQuestions} ${chapterDifficulty} questions from "${selectedChapter}" (Std ${chapterClass})...`,
    });
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Please sign in to generate a test.");

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/generate-mcq-test`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
            apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
          },
          body: JSON.stringify({
            subject: chapterSubject,
            difficulty: chapterDifficulty,
            numQuestions: chapterNumQuestions,
            topics: [selectedChapter],
            studyClass: chapterClass,
          }),
        }
      );

      if (!response.ok) {
        let errorMessage = "Failed to generate test";
        try {
          const errorData = await response.json();
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          try { errorMessage = (await response.text()) || errorMessage; } catch {}
        }
        throw new Error(errorMessage);
      }

      const data = await response.json();
      navigate("/test", {
        state: {
          questions: data.questions,
          subject: `${chapterSubject} • Std ${chapterClass} • ${selectedChapter}`,
          difficulty: chapterDifficulty,
          timeLimit: Math.ceil(chapterNumQuestions * 2),
        },
      });
    } catch (error) {
      console.error("Error generating chapter test:", error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to generate chapter test. Please try again.",
        variant: "destructive",
      });
    } finally {
      setGeneratingTest(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Navigation */}
      <nav className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Settings Button */}
              <Button variant="ghost" size="icon" className="h-8 w-8 sm:h-10 sm:w-10" onClick={() => navigate("/settings")}>
                <MoreVertical className="h-4 w-4 sm:h-5 sm:w-5" />
              </Button>

              {/* Logo */}
              <div className="w-8 h-8 sm:w-10 sm:h-10 rounded-lg bg-primary flex items-center justify-center">
                <BookOpen className="w-4 h-4 sm:w-5 sm:h-5 text-primary-foreground" />
              </div>
              <span className="text-base sm:text-xl font-bold">MHT CET MASTER</span>
              {isAdmin && (
                <span className="text-xs bg-primary text-primary-foreground px-2 py-0.5 rounded">
                  Admin
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs sm:text-sm text-muted-foreground hidden md:inline">Welcome, {userName}</span>
              <Button
                size="sm"
                className="h-8 sm:h-9 gap-1.5"
                onClick={() => navigate("/mentor")}
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">AI Mentor</span>
                <span className="sm:hidden">Mentor</span>
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 sm:h-9 gap-1.5"
                onClick={() => navigate("/flashcards")}
              >
                <Layers className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Flashcards</span>
                <span className="sm:hidden">Cards</span>
              </Button>
            </div>
          </div>
        </div>
      </nav>

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8">
        {/* Welcome Section */}
        <div className="mb-4 sm:mb-8">
          <h1 className="text-xl sm:text-3xl font-bold mb-2">Welcome back, {userName}! 👋</h1>
          <p className="text-sm sm:text-base text-muted-foreground">
            Ready to ace your MHT-CET? Generate custom AI practice tests below.
          </p>
        </div>

        {isAdmin && (
          <div className="mb-4 sm:mb-6">
            <AdminPanel />
          </div>
        )}

        {/* Stats Cards */}
        <div className="mb-4 sm:mb-8">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-base sm:text-lg font-semibold">Your Stats</h2>
            <Button
              variant="outline"
              size="sm"
              onClick={handleRefreshData}
              disabled={refreshing}
              className="gap-2"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <TrendingUp className="h-4 w-4" />
              )}
              <span className="hidden sm:inline">Refresh</span>
            </Button>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 sm:gap-4">
            <Card>
              <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
                <div className="text-xl sm:text-2xl font-bold mb-1">{userStats.studyStreak}</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Day Streak</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
                <div className="text-xl sm:text-2xl font-bold mb-1">{userStats.overallAccuracy}%</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Accuracy</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
                <div className="text-xl sm:text-2xl font-bold mb-1">{userStats.testsCompleted}</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Tests Done</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 sm:pt-6 px-3 sm:px-6">
                <div className="text-xl sm:text-2xl font-bold mb-1">{Math.round(userStats.studyTime / 60)}h</div>
                <div className="text-xs sm:text-sm text-muted-foreground">Study Time</div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Full CET Test Banner */}
        <Card className="mb-4 sm:mb-6 bg-gradient-card border-primary/20">
          <CardContent className="p-4 sm:p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="space-y-2 flex-1">
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5 text-primary" />
                  <h3 className="text-lg sm:text-xl font-bold">Full MHT-CET Mock Test</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Complete test with 150 questions • 180 minutes • Physics, Chemistry & Mathematics
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 bg-primary/10 text-primary rounded">50 Physics</span>
                  <span className="px-2 py-1 bg-primary/10 text-primary rounded">50 Chemistry</span>
                  <span className="px-2 py-1 bg-primary/10 text-primary rounded">50 Mathematics</span>
                </div>
              </div>
              <Button 
                size="lg"
                onClick={handleStartFullCETTest}
                disabled={generatingTest}
                className="w-full sm:w-auto"
              >
                {generatingTest ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating Full Test...
                  </>
                ) : (
                  <>
                    <Trophy className="mr-2 h-4 w-4" />
                    Start Full CET Test
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
          {/* MHT-CET Practice (Subject-wise + Chapter-wise) */}
          <Card className="lg:col-span-2">
            <CardHeader className="px-4 sm:px-6 py-4 sm:py-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Zap className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                Practice Tests
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">Generate AI-powered MHT-CET practice tests</CardDescription>
            </CardHeader>
            <CardContent className="px-4 sm:px-6">
              <Tabs defaultValue="subject">
                <TabsList className="grid w-full grid-cols-2 h-auto mb-3">
                  <TabsTrigger value="subject" className="text-xs sm:text-sm py-2">Subject-wise</TabsTrigger>
                  <TabsTrigger value="chapter" className="text-xs sm:text-sm py-2">Chapter-wise</TabsTrigger>
                </TabsList>

                {/* Subject-wise tab */}
                <TabsContent value="subject" className="mt-0">
                  <Tabs defaultValue="Mathematics" onValueChange={setSelectedSubject}>
                    <TabsList className="grid w-full grid-cols-3 h-auto">
                      <TabsTrigger value="Mathematics" className="text-xs sm:text-sm py-2">Maths</TabsTrigger>
                      <TabsTrigger value="Physics" className="text-xs sm:text-sm py-2">Physics</TabsTrigger>
                      <TabsTrigger value="Chemistry" className="text-xs sm:text-sm py-2">Chemistry</TabsTrigger>
                    </TabsList>

                    {["Mathematics", "Physics", "Chemistry"].map((subject) => (
                      <TabsContent key={subject} value={subject} className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                          <div className="space-y-2">
                            <Label htmlFor="difficulty" className="text-xs sm:text-sm">Difficulty Level</Label>
                            <Select value={difficulty} onValueChange={setDifficulty}>
                              <SelectTrigger id="difficulty" className="text-xs sm:text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="z-50 bg-background">
                                <SelectItem value="easy">Easy</SelectItem>
                                <SelectItem value="medium">Medium</SelectItem>
                                <SelectItem value="hard">Hard</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          <div className="space-y-2">
                            <Label htmlFor="questions" className="text-xs sm:text-sm">Number of Questions</Label>
                            <Select value={numQuestions.toString()} onValueChange={(val) => setNumQuestions(Number(val))}>
                              <SelectTrigger id="questions" className="text-xs sm:text-sm">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent className="z-50 bg-background">
                                <SelectItem value="10">10 Questions</SelectItem>
                                <SelectItem value="20">20 Questions</SelectItem>
                                <SelectItem value="30">30 Questions</SelectItem>
                                <SelectItem value="50">50 Questions (Full)</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                        </div>

                        <div className="bg-muted/50 p-3 sm:p-4 rounded-lg space-y-2">
                          <p className="text-xs sm:text-sm font-medium">Test Configuration:</p>
                          <ul className="text-xs sm:text-sm text-muted-foreground space-y-1">
                            <li>• Subject: {subject}</li>
                            <li>• Level: {difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}</li>
                            <li>• Questions: {numQuestions}</li>
                            <li>• Time: {Math.ceil(numQuestions * 2)} minutes (auto)</li>
                            <li>• Format: MHT-CET Pattern MCQs</li>
                          </ul>
                        </div>

                        <Button
                          className="w-full text-xs sm:text-sm"
                          size="lg"
                          onClick={handleStartTest}
                          disabled={generatingTest}
                        >
                          {generatingTest ? (
                            <>
                              <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                              <span className="text-xs sm:text-sm">Generating...</span>
                            </>
                          ) : (
                            <>
                              <Zap className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                              <span className="text-xs sm:text-sm">Generate & Start Test</span>
                            </>
                          )}
                        </Button>
                      </TabsContent>
                    ))}
                  </Tabs>
                </TabsContent>

                {/* Chapter-wise tab */}
                <TabsContent value="chapter" className="space-y-3 sm:space-y-4 mt-3 sm:mt-4">
                  <Tabs
                    value={chapterClass}
                    onValueChange={(v) => {
                      const cls = v as StudyClass;
                      setChapterClass(cls);
                      setSelectedChapter(CHAPTERS[cls][chapterSubject][0]);
                    }}
                  >
                    <TabsList className="grid w-full grid-cols-2 h-auto">
                      <TabsTrigger value="XI" className="text-xs sm:text-sm py-2">Std XI (Class 11)</TabsTrigger>
                      <TabsTrigger value="XII" className="text-xs sm:text-sm py-2">Std XII (Class 12)</TabsTrigger>
                    </TabsList>
                  </Tabs>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                    <div className="space-y-2">
                      <Label className="text-xs sm:text-sm">Subject</Label>
                      <Select
                        value={chapterSubject}
                        onValueChange={(v) => {
                          const subj = v as CetSubject;
                          setChapterSubject(subj);
                          setSelectedChapter(CHAPTERS[chapterClass][subj][0]);
                        }}
                      >
                        <SelectTrigger className="text-xs sm:text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent className="z-50 bg-background">
                          <SelectItem value="Mathematics">Mathematics</SelectItem>
                          <SelectItem value="Physics">Physics</SelectItem>
                          <SelectItem value="Chemistry">Chemistry</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs sm:text-sm">Chapter</Label>
                      <Select value={selectedChapter} onValueChange={setSelectedChapter}>
                        <SelectTrigger className="text-xs sm:text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent className="z-50 bg-background max-h-72">
                          {CHAPTERS[chapterClass][chapterSubject].map((ch) => (
                            <SelectItem key={ch} value={ch}>{ch}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs sm:text-sm">Difficulty Level</Label>
                      <Select value={chapterDifficulty} onValueChange={setChapterDifficulty}>
                        <SelectTrigger className="text-xs sm:text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent className="z-50 bg-background">
                          <SelectItem value="easy">Easy</SelectItem>
                          <SelectItem value="medium">Medium</SelectItem>
                          <SelectItem value="hard">Hard</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs sm:text-sm">Number of Questions</Label>
                      <Select
                        value={chapterNumQuestions.toString()}
                        onValueChange={(val) => setChapterNumQuestions(Number(val))}
                      >
                        <SelectTrigger className="text-xs sm:text-sm"><SelectValue /></SelectTrigger>
                        <SelectContent className="z-50 bg-background">
                          <SelectItem value="10">10 Questions</SelectItem>
                          <SelectItem value="15">15 Questions</SelectItem>
                          <SelectItem value="20">20 Questions</SelectItem>
                          <SelectItem value="30">30 Questions</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="bg-muted/50 p-3 sm:p-4 rounded-lg space-y-2">
                    <p className="text-xs sm:text-sm font-medium">Test Configuration:</p>
                    <ul className="text-xs sm:text-sm text-muted-foreground space-y-1">
                      <li>• Class: Std {chapterClass}</li>
                      <li>• Subject: {chapterSubject}</li>
                      <li>• Chapter: {selectedChapter}</li>
                      <li>• Level: {chapterDifficulty.charAt(0).toUpperCase() + chapterDifficulty.slice(1)}</li>
                      <li>• Questions: {chapterNumQuestions}</li>
                      <li>• Time: {Math.ceil(chapterNumQuestions * 2)} minutes (auto)</li>
                      <li>• Format: CET-level MCQs from this chapter only</li>
                    </ul>
                  </div>

                  <Button
                    className="w-full text-xs sm:text-sm"
                    size="lg"
                    onClick={handleStartChapterTest}
                    disabled={generatingTest}
                  >
                    {generatingTest ? (
                      <>
                        <Loader2 className="mr-2 h-3 w-3 sm:h-4 sm:w-4 animate-spin" />
                        <span className="text-xs sm:text-sm">Generating...</span>
                      </>
                    ) : (
                      <>
                        <BookOpen className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                        <span className="text-xs sm:text-sm">Generate Chapter Test</span>
                      </>
                    )}
                  </Button>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          {/* Recent Tests */}
          <Card>
            <CardHeader className="px-4 sm:px-6 py-4 sm:py-6">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Clock className="h-4 w-4 sm:h-5 sm:w-5 text-primary" />
                Recent Tests
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 sm:space-y-3 px-4 sm:px-6">
              {recentTests.length > 0 ? (
                recentTests.map((test, index) => (
                  <div key={index} className="p-2 sm:p-3 rounded-lg bg-muted/30 space-y-1">
                    <div className="flex justify-between items-center">
                      <p className="font-medium text-xs sm:text-sm">{test.subject}</p>
                      <p className="text-xs sm:text-sm font-bold">{Math.round((test.score / test.maxScore) * 100)}%</p>
                    </div>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">{test.date}</p>
                  </div>
                ))
              ) : (
                <p className="text-center text-muted-foreground py-6 sm:py-8 text-xs sm:text-sm">
                  No tests yet. Start your first test!
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Progress Tracker */}
        <div className="mt-6">
          <ProgressTracker topicProgress={topicProgress} />
        </div>

        {/* Weekly Goals */}
        {weeklyGoals.length > 0 && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5 text-primary" />
                Weekly Goals
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {weeklyGoals.map((goal, index) => (
                <div key={index} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>{goal.title}</span>
                    <span className="text-muted-foreground">{goal.current}/{goal.target}</span>
                  </div>
                  <div className="w-full bg-muted rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full transition-all"
                      style={{ width: `${Math.min((goal.current / goal.target) * 100, 100)}%` }}
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
