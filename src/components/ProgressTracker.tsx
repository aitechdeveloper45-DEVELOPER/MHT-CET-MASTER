import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronDown, ChevronUp, BookOpen } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

interface TopicProgress {
  topic_name: string;
  questions_attempted: number;
  questions_correct: number;
}

interface ProgressTrackerProps {
  topicProgress: TopicProgress[];
}

// MHT-CET Syllabus Topics
const syllabusTopics: Record<string, { xi: string[]; xii: string[] }> = {
  Physics: {
    xi: ["Units and Measurements", "Scalars and Vectors", "Motion in a Plane", "Laws of Motion", "Friction", "Work, Energy and Power", "Rotational Motion", "Mechanical Properties of Solids", "Mechanical Properties of Fluids", "Thermal Properties of Matter"],
    xii: ["Rotational Dynamics", "Mechanical Properties of Fluids", "Kinetic Theory of Gases", "Thermodynamics", "Oscillations", "Superposition of Waves", "Wave Optics", "Electrostatics", "Current Electricity", "Magnetic Fields", "Electromagnetic Induction", "AC Circuits", "Dual Nature of Matter and Radiation", "Atoms, Molecules and Nuclei", "Semiconductors"]
  },
  Chemistry: {
    xi: ["Basic Concepts of Chemistry", "States of Matter", "Redox Reactions", "Surface Chemistry", "Nature of Chemical Bond", "Hydrogen", "s-Block Elements", "Basic Principles and Techniques in Organic Chemistry", "Alkanes"],
    xii: ["Solid State", "Solutions and Colligative Properties", "Chemical Thermodynamics and Energetics", "Electrochemistry", "Chemical Kinetics", "General Principles of Extraction of Elements", "p-Block Elements", "d and f Block Elements", "Coordination Compounds", "Haloalkanes and Haloarenes", "Alcohols, Phenols and Ethers", "Aldehydes, Ketones and Carboxylic Acids", "Organic Compounds Containing Nitrogen", "Biomolecules", "Polymers", "Chemistry in Everyday Life"]
  },
  Mathematics: {
    xi: ["Trigonometric Functions", "Trigonometric Functions of Compound Angles", "Factorization Formulae", "Straight Line", "Circle and Conics", "Sets, Relations and Functions", "Probability", "Sequences and Series"],
    xii: ["Mathematical Logic", "Matrices", "Trigonometric Functions", "Pair of Straight Lines", "Circle", "Conics", "Vectors", "Three Dimensional Geometry", "Line", "Plane", "Linear Programming", "Continuity", "Differentiation", "Application of Derivatives", "Integration", "Application of Definite Integral", "Differential Equations", "Probability Distribution", "Binomial Distribution"]
  }
};

const ProgressTracker = ({ topicProgress }: ProgressTrackerProps) => {
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    "Physics-xi": false,
    "Physics-xii": true,
    "Chemistry-xi": false,
    "Chemistry-xii": true,
    "Mathematics-xi": false,
    "Mathematics-xii": true,
  });

  const toggleSection = (key: string) => {
    setOpenSections(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const getTopicProgress = (subject: string, topicName: string) => {
    const progress = topicProgress.find(
      p => p.topic_name.toLowerCase() === topicName.toLowerCase()
    );
    return progress || { questions_attempted: 0, questions_correct: 0 };
  };

  const calculateCompletion = (attempted: number) => {
    // Consider a topic "complete" when 10+ questions have been attempted
    const targetQuestions = 10;
    return Math.min((attempted / targetQuestions) * 100, 100);
  };

  const calculateAccuracy = (attempted: number, correct: number) => {
    if (attempted === 0) return 0;
    return Math.round((correct / attempted) * 100);
  };

  const getSubjectStats = (subject: string) => {
    const allTopics = [...syllabusTopics[subject].xi, ...syllabusTopics[subject].xii];
    let totalAttempted = 0;
    let totalCorrect = 0;
    let topicsStarted = 0;

    allTopics.forEach(topic => {
      const progress = getTopicProgress(subject, topic);
      totalAttempted += progress.questions_attempted;
      totalCorrect += progress.questions_correct;
      if (progress.questions_attempted > 0) topicsStarted++;
    });

    return {
      totalTopics: allTopics.length,
      topicsStarted,
      totalAttempted,
      accuracy: totalAttempted > 0 ? Math.round((totalCorrect / totalAttempted) * 100) : 0,
      overallCompletion: Math.round((topicsStarted / allTopics.length) * 100)
    };
  };

  const renderTopicRow = (subject: string, topic: string) => {
    const progress = getTopicProgress(subject, topic);
    const completion = calculateCompletion(progress.questions_attempted);
    const accuracy = calculateAccuracy(progress.questions_attempted, progress.questions_correct);

    return (
      <div key={topic} className="flex flex-col gap-1 py-2 border-b border-border/50 last:border-0">
        <div className="flex justify-between items-center">
          <span className="text-xs sm:text-sm text-foreground/80 truncate flex-1 pr-2">{topic}</span>
          <div className="flex items-center gap-2 sm:gap-4 text-xs">
            <span className="text-muted-foreground whitespace-nowrap">
              {progress.questions_attempted} Q
            </span>
            {progress.questions_attempted > 0 && (
              <span className={`font-medium ${accuracy >= 70 ? 'text-green-500' : accuracy >= 50 ? 'text-yellow-500' : 'text-red-500'}`}>
                {accuracy}%
              </span>
            )}
          </div>
        </div>
        <Progress value={completion} className="h-1.5" />
      </div>
    );
  };

  const renderSection = (subject: string, standard: "xi" | "xii", topics: string[]) => {
    const key = `${subject}-${standard}`;
    const isOpen = openSections[key];
    const label = standard === "xi" ? "Std. XI (20%)" : "Std. XII (80%)";

    return (
      <Collapsible key={key} open={isOpen} onOpenChange={() => toggleSection(key)}>
        <CollapsibleTrigger className="flex items-center justify-between w-full py-2 px-3 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
          <span className="text-sm font-medium">{label}</span>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">{topics.length} topics</span>
            {isOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent className="px-2 pt-2">
          {topics.map(topic => renderTopicRow(subject, topic))}
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="h-5 w-5 text-primary" />
          Syllabus Progress Tracker
        </CardTitle>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="Physics" className="w-full">
          <TabsList className="w-full grid grid-cols-3 mb-4">
            {Object.keys(syllabusTopics).map(subject => {
              const stats = getSubjectStats(subject);
              return (
                <TabsTrigger key={subject} value={subject} className="text-xs sm:text-sm flex-col gap-0 py-2">
                  <span>{subject}</span>
                  <span className="text-[10px] text-muted-foreground">{stats.overallCompletion}%</span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {Object.entries(syllabusTopics).map(([subject, topics]) => {
            const stats = getSubjectStats(subject);
            return (
              <TabsContent key={subject} value={subject} className="space-y-3">
                {/* Subject Summary */}
                <div className="grid grid-cols-3 gap-2 p-3 bg-muted/30 rounded-lg text-center">
                  <div>
                    <p className="text-lg font-bold text-primary">{stats.topicsStarted}/{stats.totalTopics}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Topics Started</p>
                  </div>
                  <div>
                    <p className="text-lg font-bold">{stats.totalAttempted}</p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Questions</p>
                  </div>
                  <div>
                    <p className={`text-lg font-bold ${stats.accuracy >= 70 ? 'text-green-500' : stats.accuracy >= 50 ? 'text-yellow-500' : 'text-muted-foreground'}`}>
                      {stats.accuracy}%
                    </p>
                    <p className="text-[10px] sm:text-xs text-muted-foreground">Accuracy</p>
                  </div>
                </div>

                {/* Topic Lists */}
                <div className="space-y-2">
                  {renderSection(subject, "xii", topics.xii)}
                  {renderSection(subject, "xi", topics.xi)}
                </div>
              </TabsContent>
            );
          })}
        </Tabs>
      </CardContent>
    </Card>
  );
};

export default ProgressTracker;
