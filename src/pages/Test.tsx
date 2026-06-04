import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Clock, CheckCircle2, Home, AlertCircle } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import AdGate from "@/components/AdGate";

const Test = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();
  
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [selectedAnswers, setSelectedAnswers] = useState<{ [key: number]: number }>({});
  const [timeRemaining, setTimeRemaining] = useState(3600);
  const [showResults, setShowResults] = useState(false);
  const [questions, setQuestions] = useState<any[]>([]);
  const [testConfig, setTestConfig] = useState<any>(null);
  const [resultsAdDone, setResultsAdDone] = useState(false);

  useEffect(() => {
    // Get questions from navigation state, falling back to sessionStorage
    // (preview reloads / SHA refresh can wipe location.state).
    const state = location.state as any;
    let payload: any = null;
    if (state?.questions && Array.isArray(state.questions)) {
      payload = state;
      try {
        sessionStorage.setItem("activeTest", JSON.stringify(state));
      } catch {}
    } else {
      try {
        const cached = sessionStorage.getItem("activeTest");
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.questions && Array.isArray(parsed.questions)) payload = parsed;
        }
      } catch {}
    }

    if (payload) {
      setQuestions(payload.questions);
      setTestConfig({
        subject: payload.subject || "General",
        difficulty: payload.difficulty || "medium",
        timeLimit: payload.timeLimit || 60,
      });
      setTimeRemaining((payload.timeLimit || 60) * 60);
    } else {
      toast({
        title: "Error",
        description: "No test data found. Please generate a test first.",
        variant: "destructive",
      });
      navigate("/dashboard");
    }
  }, [location, navigate, toast]);

  useEffect(() => {
    if (questions.length === 0 || showResults) return;

    const timer = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [showResults, questions.length]);

  // Auto-submit when time runs out
  useEffect(() => {
    if (timeRemaining === 0 && !showResults && questions.length > 0) {
      handleSubmit();
    }
  }, [timeRemaining, showResults, questions.length]);

  const handleAnswerSelect = (questionIndex: number, answerIndex: number) => {
    setSelectedAnswers({ ...selectedAnswers, [questionIndex]: answerIndex });
  };

  const handleSubmit = async () => {
    setShowResults(true);
    try { sessionStorage.removeItem("activeTest"); } catch {}
    
    // Calculate score
    const score = calculateScore();
    const maxScore = questions.length;
    
    // Save test result to database
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Mark all questions as seen by this user
        const seenQuestions = questions
          .filter(q => q.dbId)
          .map(q => ({
            user_id: user.id,
            question_id: q.dbId
          }));

        if (seenQuestions.length > 0) {
          const { error: seenError } = await supabase
            .from('user_seen_questions')
            .insert(seenQuestions);
          
          if (seenError) {
            console.error("Error marking questions as seen:", seenError);
          } else {
            console.log(`Marked ${seenQuestions.length} questions as seen for user`);
          }
        }

        // Save test result
        const { error } = await supabase.from('test_results').insert({
          user_id: user.id,
          subject: testConfig?.subject || "General",
          test_name: `${testConfig?.subject || "General"} - ${testConfig?.difficulty || "medium"} Level`,
          score: score,
          max_score: maxScore,
          time_taken_minutes: Math.floor((testConfig?.timeLimit * 60 - timeRemaining) / 60),
        });
        
        if (error) {
          console.error("Error saving test result:", error);
        } else {
          // Update user stats
          await updateUserStats(user.id, score, maxScore);
          
          // Update weekly goals
          await updateWeeklyGoals(user.id);

          // Update topic progress
          await updateTopicProgress(user.id);
          
          // Notify rating prompt of a completed test
          window.dispatchEvent(new CustomEvent("test-completed"));

          toast({
            title: "Test Submitted!",
            description: `Your score: ${score}/${maxScore} (${((score / maxScore) * 100).toFixed(1)}%)`,
          });
        }
      }
    } catch (error) {
      console.error("Error in handleSubmit:", error);
    }
  };

  const updateUserStats = async (userId: string, score: number, maxScore: number) => {
    try {
      // Get all test results for the user to calculate overall accuracy
      const { data: allTests } = await supabase
        .from('test_results')
        .select('score, max_score')
        .eq('user_id', userId);

      if (allTests) {
        const totalScore = allTests.reduce((sum, test) => sum + test.score, 0);
        const totalMaxScore = allTests.reduce((sum, test) => sum + test.max_score, 0);
        const overallAccuracy = totalMaxScore > 0 ? (totalScore / totalMaxScore) * 100 : 0;

        // Get current stats to check study streak
        const { data: currentStats } = await supabase
          .from('user_stats')
          .select('last_study_date, study_streak')
          .eq('user_id', userId)
          .maybeSingle();

        const today = new Date().toISOString().split('T')[0];
        let newStreak = 1;

        if (currentStats?.last_study_date) {
          const lastDate = new Date(currentStats.last_study_date);
          const todayDate = new Date(today);
          const diffDays = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24));

          if (diffDays === 0) {
            // Same day, keep streak
            newStreak = currentStats.study_streak || 1;
          } else if (diffDays === 1) {
            // Consecutive day, increment streak
            newStreak = (currentStats.study_streak || 0) + 1;
          }
          // If diffDays > 1, streak resets to 1 (already set)
        }

        // Update user stats
        await supabase
          .from('user_stats')
          .update({
            total_tests: allTests.length,
            overall_accuracy: overallAccuracy,
            study_streak: newStreak,
            last_study_date: today,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', userId);
      }
    } catch (error) {
      console.error("Error updating user stats:", error);
    }
  };

  const updateWeeklyGoals = async (userId: string) => {
    try {
      // Get current week start (Monday)
      const now = new Date();
      const dayOfWeek = now.getDay();
      const diff = dayOfWeek === 0 ? -6 : 1 - dayOfWeek; // Adjust when day is Sunday
      const weekStart = new Date(now);
      weekStart.setDate(now.getDate() + diff);
      weekStart.setHours(0, 0, 0, 0);
      const weekStartStr = weekStart.toISOString().split('T')[0];

      // Check if weekly goal exists for this week
      const { data: existingGoal } = await supabase
        .from('weekly_goals')
        .select('*')
        .eq('user_id', userId)
        .eq('week_start', weekStartStr)
        .eq('goal_title', 'Complete Tests This Week')
        .maybeSingle();

      if (existingGoal) {
        // Update existing goal
        await supabase
          .from('weekly_goals')
          .update({ 
            current_value: existingGoal.current_value + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', existingGoal.id);
      } else {
        // Create new goal for this week
        await supabase
          .from('weekly_goals')
          .insert({
            user_id: userId,
            goal_title: 'Complete Tests This Week',
            target_value: 5,
            current_value: 1,
            week_start: weekStartStr,
          });
      }
    } catch (error) {
      console.error("Error updating weekly goals:", error);
    }
  };

  const updateTopicProgress = async (userId: string) => {
    try {
      // Group questions by topic and calculate correct answers per topic
      const topicStats: Record<string, { attempted: number; correct: number; subject: string }> = {};
      
      questions.forEach((question, index) => {
        const topic = question.topic || "General";
        const subject = question.subject || testConfig?.subject || "General";
        
        if (!topicStats[topic]) {
          topicStats[topic] = { attempted: 0, correct: 0, subject };
        }
        
        topicStats[topic].attempted += 1;
        
        // Check if the answer was correct
        if (selectedAnswers[index] === question.correctAnswer) {
          topicStats[topic].correct += 1;
        }
      });

      // Update or insert topic progress for each topic
      for (const [topicName, stats] of Object.entries(topicStats)) {
        // Check if progress exists for this topic
        const { data: existingProgress } = await supabase
          .from('topic_progress')
          .select('*')
          .eq('user_id', userId)
          .eq('topic_name', topicName)
          .maybeSingle();

        if (existingProgress) {
          // Update existing progress
          await supabase
            .from('topic_progress')
            .update({
              questions_attempted: existingProgress.questions_attempted + stats.attempted,
              questions_correct: existingProgress.questions_correct + stats.correct,
              updated_at: new Date().toISOString()
            })
            .eq('id', existingProgress.id);
        } else {
          // Insert new progress
          await supabase
            .from('topic_progress')
            .insert({
              user_id: userId,
              subject: stats.subject,
              topic_name: topicName,
              questions_attempted: stats.attempted,
              questions_correct: stats.correct,
            });
        }
      }
      
      console.log("Topic progress updated for topics:", Object.keys(topicStats));
    } catch (error) {
      console.error("Error updating topic progress:", error);
    }
  };

  const calculateScore = () => {
    return Object.entries(selectedAnswers).filter(
      ([questionIndex, answerIndex]) => questions[parseInt(questionIndex)].correctAnswer === answerIndex
    ).length;
  };

  const totalQuestions = questions.length;
  
  if (questions.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-3 sm:p-4">
        <Card className="max-w-md w-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
              <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive" />
              No Test Available
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground text-xs sm:text-sm">
              Please generate a test from the dashboard first.
            </p>
            <Button onClick={() => navigate("/dashboard")} className="w-full text-xs sm:text-sm">
              <Home className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              Back to Dashboard
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  if (showResults) {
    const score = calculateScore();
    const percentage = totalQuestions > 0 ? ((score / totalQuestions) * 100).toFixed(1) : 0;
    
    return (
      <>
      {!resultsAdDone && <AdGate onComplete={() => setResultsAdDone(true)} />}
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 p-3 sm:p-4">
        <div className="container mx-auto max-w-4xl py-4 sm:py-8">
          <Card>
            <CardHeader className="px-4 sm:px-6">
              <CardTitle className="text-center text-lg sm:text-2xl flex items-center justify-center gap-2">
                <CheckCircle2 className="h-5 w-5 sm:h-6 sm:w-6 text-primary" />
                Test Completed!
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6">
              <div className="grid grid-cols-3 gap-2 sm:gap-4 text-center">
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm text-muted-foreground">Score</p>
                  <p className="text-lg sm:text-2xl font-bold">{score}/{totalQuestions}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm text-muted-foreground">Accuracy</p>
                  <p className="text-lg sm:text-2xl font-bold">{percentage}%</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm text-muted-foreground">Time Taken</p>
                  <p className="text-lg sm:text-2xl font-bold">
                    {Math.floor((testConfig?.timeLimit * 60 - timeRemaining) / 60)}m
                  </p>
                </div>
              </div>

              <div className="space-y-3 sm:space-y-4">
                <h3 className="font-semibold text-sm sm:text-base">Review Answers:</h3>
                {questions.map((q, index) => {
                  const userAnswer = selectedAnswers[index];
                  const isCorrect = userAnswer === q.correctAnswer;
                  
                  return (
                    <div key={index} className="p-3 sm:p-4 rounded-lg bg-muted/30 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-xs sm:text-sm">Q{index + 1}. {q.question}</p>
                        {isCorrect ? (
                          <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-500 flex-shrink-0" />
                        ) : (
                          <AlertCircle className="h-4 w-4 sm:h-5 sm:w-5 text-destructive flex-shrink-0" />
                        )}
                      </div>
                      <div className="text-xs sm:text-sm space-y-1">
                        <p className={userAnswer !== undefined ? (isCorrect ? "text-green-600" : "text-destructive") : "text-muted-foreground"}>
                          Your answer: {userAnswer !== undefined ? q.options[userAnswer] : "Not answered"}
                        </p>
                        {!isCorrect && (
                          <p className="text-green-600">
                            Correct answer: {q.options[q.correctAnswer]}
                          </p>
                        )}
                        {q.explanation && (
                          <p className="text-muted-foreground mt-2">
                            <span className="font-medium">Explanation:</span> {q.explanation}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                <Button onClick={() => navigate("/dashboard")} className="flex-1 text-xs sm:text-sm">
                  <Home className="mr-2 h-3 w-3 sm:h-4 sm:w-4" />
                  Back to Dashboard
                </Button>
                <Button 
                  onClick={() => {
                    setShowResults(false);
                    setCurrentQuestion(0);
                    setSelectedAnswers({});
                    setTimeRemaining(testConfig?.timeLimit * 60 || 3600);
                  }}
                  variant="outline"
                  className="flex-1 text-xs sm:text-sm"
                >
                  Retry Test
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <div className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-3 sm:px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 sm:gap-3">
              <h1 className="text-base sm:text-xl font-bold">
                {testConfig?.subject || "MHT-CET"} Test
              </h1>
              <span className="text-xs sm:text-sm text-muted-foreground hidden md:inline">
                {testConfig?.difficulty} Level
              </span>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-muted">
                <Clock className="w-3 h-3 sm:w-4 sm:h-4 text-primary" />
                <span className="font-mono font-semibold text-xs sm:text-sm">{formatTime(timeRemaining)}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/dashboard")} className="text-xs sm:text-sm">
                Exit
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-3 sm:px-4 py-4 sm:py-8 max-w-4xl">
        {/* Progress */}
        <Card className="mb-4 sm:mb-6">
          <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
            <div className="flex justify-between text-xs sm:text-sm mb-2">
              <span>Question {currentQuestion + 1} of {totalQuestions}</span>
              <span>{Math.round(((currentQuestion + 1) / totalQuestions) * 100)}%</span>
            </div>
            <Progress value={((currentQuestion + 1) / totalQuestions) * 100} />
          </CardContent>
        </Card>

        {/* Question */}
        <Card className="mb-4 sm:mb-6">
          <CardHeader className="px-4 sm:px-6 py-4 sm:py-6">
            <CardTitle className="text-base sm:text-lg">Question {currentQuestion + 1}</CardTitle>
            {questions[currentQuestion].topic && (
              <p className="text-xs sm:text-sm text-muted-foreground">
                Topic: {questions[currentQuestion].topic}
              </p>
            )}
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6 px-4 sm:px-6">
            <p className="text-sm sm:text-lg">{questions[currentQuestion].question}</p>

            <RadioGroup
              value={selectedAnswers[currentQuestion]?.toString() ?? ""}
              onValueChange={(value) => handleAnswerSelect(currentQuestion, parseInt(value))}
            >
              {questions[currentQuestion].options.map((option: string, index: number) => (
                <div
                  key={index}
                  onClick={() => handleAnswerSelect(currentQuestion, index)}
                  className={`flex items-center space-x-2 sm:space-x-3 p-3 sm:p-4 rounded-lg border-2 transition-all cursor-pointer ${
                    selectedAnswers[currentQuestion] === index
                      ? "border-primary bg-primary/5"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <RadioGroupItem value={index.toString()} id={`option-${index}`} />
                  <Label htmlFor={`option-${index}`} className="flex-1 cursor-pointer text-xs sm:text-sm">
                    {option}
                  </Label>
                </div>
              ))}
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Navigation */}
        <div className="space-y-3 sm:space-y-4">
          <div className="flex gap-2 sm:gap-4">
            <Button
              variant="outline"
              onClick={() => setCurrentQuestion(Math.max(0, currentQuestion - 1))}
              disabled={currentQuestion === 0}
              className="flex-1 text-xs sm:text-sm"
            >
              Previous
            </Button>
            {currentQuestion === totalQuestions - 1 ? (
              <Button onClick={handleSubmit} className="flex-1 text-xs sm:text-sm">
                Submit Test
              </Button>
            ) : (
              <Button
                onClick={() => setCurrentQuestion(currentQuestion + 1)}
                className="flex-1 text-xs sm:text-sm"
              >
                Next
              </Button>
            )}
          </div>

          {/* Question Navigator */}
          <Card>
            <CardContent className="pt-4 sm:pt-6 px-4 sm:px-6">
              <p className="text-xs sm:text-sm font-medium mb-3">Jump to Question:</p>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5 sm:gap-2">
                {questions.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setCurrentQuestion(index)}
                    className={`aspect-square rounded-lg font-medium text-xs sm:text-sm transition-all ${
                      index === currentQuestion
                        ? "bg-primary text-primary-foreground"
                        : selectedAnswers[index] !== undefined
                        ? "bg-primary/20 text-primary"
                        : "bg-muted hover:bg-muted/80"
                    }`}
                  >
                    {index + 1}
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Test;
