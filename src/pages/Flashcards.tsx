import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  ArrowLeft, Search, Star, Check, AlertTriangle, RotateCcw,
  Sparkles, Flame, Brain, Loader2, Calendar, Trophy,
} from "lucide-react";
import { toast } from "@/hooks/use-toast";
import AdGate from "@/components/AdGate";

type Subject = "Physics" | "Chemistry" | "Mathematics";
type Status = "new" | "learned" | "difficult";

interface Flashcard {
  id: string;
  subject: Subject;
  chapter: string;
  card_type: string;
  title: string;
  content: Record<string, string>;
}
interface Progress {
  flashcard_id: string;
  status: Status;
  is_favorite: boolean;
  seen_count: number;
}

const SUBJECTS: Subject[] = ["Physics", "Chemistry", "Mathematics"];
const SUBJECT_COLOR: Record<Subject, string> = {
  Physics: "from-blue-500/20 to-cyan-500/10 border-blue-500/30",
  Chemistry: "from-emerald-500/20 to-teal-500/10 border-emerald-500/30",
  Mathematics: "from-purple-500/20 to-pink-500/10 border-purple-500/30",
};

// Deterministic pick for Formula of the Day
const hashDate = (n: number) => {
  const d = new Date();
  const key = d.getFullYear() * 1000 + d.getMonth() * 50 + d.getDate();
  return key % Math.max(1, n);
};

const Flashcards = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [adDone, setAdDone] = useState(false);
  const [cards, setCards] = useState<Flashcard[]>([]);
  const [progress, setProgress] = useState<Record<string, Progress>>({});
  const [subject, setSubject] = useState<Subject>("Physics");
  const [chapter, setChapter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"deck" | "favorites" | "daily" | "quiz">("deck");
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [fotdOpen, setFotdOpen] = useState(false);

  // load
  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }
      const [c, p] = await Promise.all([
        supabase.from("flashcards").select("*").order("subject").order("chapter"),
        supabase.from("user_flashcard_progress").select("flashcard_id,status,is_favorite,seen_count"),
      ]);
      setCards((c.data as Flashcard[]) ?? []);
      const map: Record<string, Progress> = {};
      (p.data ?? []).forEach((r: any) => { map[r.flashcard_id] = r; });
      setProgress(map);
      setLoading(false);
    })();
  }, [navigate]);

  // Reset index when filters change
  useEffect(() => { setIndex(0); setFlipped(false); }, [subject, chapter, mode, search]);

  const chapters = useMemo(() => {
    const set = new Set(cards.filter(c => c.subject === subject).map(c => c.chapter));
    return Array.from(set).sort();
  }, [cards, subject]);

  // Spaced repetition weighting: difficult > new > learned
  const weight = (st: Status | undefined) => st === "difficult" ? 5 : st === "learned" ? 1 : 3;

  const baseDeck = useMemo(() => {
    let list = cards.filter(c => c.subject === subject);
    if (chapter !== "all") list = list.filter(c => c.chapter === chapter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(c =>
        c.title.toLowerCase().includes(q) ||
        c.chapter.toLowerCase().includes(q) ||
        JSON.stringify(c.content).toLowerCase().includes(q)
      );
    }
    if (mode === "favorites") list = list.filter(c => progress[c.id]?.is_favorite);
    return list;
  }, [cards, subject, chapter, search, mode, progress]);

  // Weighted shuffle for deck mode
  const deck = useMemo(() => {
    if (mode === "daily") {
      // Seeded by date — 10 cards from all subjects, prioritizing difficult
      const pool = cards.slice().sort((a, b) => weight(progress[b.id]?.status) - weight(progress[a.id]?.status));
      const start = hashDate(Math.max(1, pool.length - 10));
      return pool.slice(start, start + 10);
    }
    if (mode === "quiz") return baseDeck;
    // spaced repetition: sort by weight desc, then by seen_count asc
    return baseDeck.slice().sort((a, b) => {
      const wd = weight(progress[b.id]?.status) - weight(progress[a.id]?.status);
      if (wd !== 0) return wd;
      return (progress[a.id]?.seen_count ?? 0) - (progress[b.id]?.seen_count ?? 0);
    });
  }, [baseDeck, mode, cards, progress]);

  const current = deck[index];

  // Stats
  const subjCards = cards.filter(c => c.subject === subject);
  const learned = subjCards.filter(c => progress[c.id]?.status === "learned").length;
  const totalAll = cards.length;
  const learnedAll = cards.filter(c => progress[c.id]?.status === "learned").length;

  // Formula of the day (deterministic across all cards)
  const fotd = cards.length ? cards[hashDate(cards.length)] : null;

  const upsertProgress = async (cardId: string, patch: Partial<Progress>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const existing = progress[cardId];
    const merged: Progress = {
      flashcard_id: cardId,
      status: patch.status ?? existing?.status ?? "new",
      is_favorite: patch.is_favorite ?? existing?.is_favorite ?? false,
      seen_count: (existing?.seen_count ?? 0) + (patch.seen_count ?? 0),
    };
    setProgress(p => ({ ...p, [cardId]: merged }));
    await supabase.from("user_flashcard_progress").upsert({
      user_id: user.id,
      flashcard_id: cardId,
      status: merged.status,
      is_favorite: merged.is_favorite,
      seen_count: merged.seen_count,
      last_seen_at: new Date().toISOString(),
    }, { onConflict: "user_id,flashcard_id" });
  };

  const advance = (delta: number) => {
    if (!current) return;
    upsertProgress(current.id, { seen_count: 1 });
    setFlipped(false);
    setIndex(i => {
      const next = i + delta;
      if (next < 0) return Math.max(0, deck.length - 1);
      if (next >= deck.length) return 0;
      return next;
    });
  };

  const mark = (status: Status) => {
    if (!current) return;
    upsertProgress(current.id, { status });
    toast({ title: `Marked as ${status}`, duration: 1200 });
    advance(1);
  };

  const toggleFav = () => {
    if (!current) return;
    upsertProgress(current.id, { is_favorite: !progress[current.id]?.is_favorite });
  };

  // Swipe handling
  const dragRef = useRef<{ x: number; y: number; active: boolean }>({ x: 0, y: 0, active: false });
  const [drag, setDrag] = useState({ x: 0, y: 0 });
  const onPointerDown = (e: React.PointerEvent) => {
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    dragRef.current = { x: e.clientX, y: e.clientY, active: true };
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!dragRef.current.active) return;
    setDrag({ x: e.clientX - dragRef.current.x, y: e.clientY - dragRef.current.y });
  };
  const onPointerUp = () => {
    if (!dragRef.current.active) return;
    const dx = drag.x;
    dragRef.current.active = false;
    setDrag({ x: 0, y: 0 });
    if (Math.abs(dx) < 80) return;
    if (dx > 0) mark("learned"); else mark("difficult");
  };

  if (loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <>
    {!adDone && <AdGate onComplete={() => setAdDone(true)} />}
    <div className="min-h-[100dvh] bg-gradient-to-br from-background via-background to-primary/5">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-3 py-3 flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="h-9 w-9">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex-1">
            <h1 className="text-sm font-bold leading-tight">Formula Flashcards</h1>
            <p className="text-[10px] text-muted-foreground leading-tight">
              {learnedAll}/{totalAll} learned overall
            </p>
          </div>
          <Button size="sm" variant="outline" className="h-8 gap-1" onClick={() => setFotdOpen(true)}>
            <Calendar className="h-3.5 w-3.5" /> <span className="text-xs">Today</span>
          </Button>
        </div>
      </header>

      <div className="container mx-auto px-3 py-3 max-w-2xl space-y-3">
        {/* Subject tabs */}
        <Tabs value={subject} onValueChange={(v) => setSubject(v as Subject)}>
          <TabsList className="grid grid-cols-3 w-full">
            {SUBJECTS.map(s => (
              <TabsTrigger key={s} value={s} className="text-xs">{s}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Progress for selected subject */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{subject} progress</span>
            <span>{learned} / {subjCards.length}</span>
          </div>
          <Progress value={subjCards.length ? (learned / subjCards.length) * 100 : 0} className="h-1.5" />
        </div>

        {/* Search + filter */}
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="h-3.5 w-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search formulas..."
              className="pl-8 h-9 text-sm"
            />
          </div>
          <Select value={chapter} onValueChange={setChapter}>
            <SelectTrigger className="w-[150px] h-9 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All chapters</SelectItem>
              {chapters.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        {/* Mode buttons */}
        <div className="grid grid-cols-4 gap-2">
          <Button size="sm" variant={mode === "deck" ? "default" : "outline"} onClick={() => setMode("deck")} className="h-9 text-xs gap-1">
            <Brain className="h-3.5 w-3.5" /> Deck
          </Button>
          <Button size="sm" variant={mode === "favorites" ? "default" : "outline"} onClick={() => setMode("favorites")} className="h-9 text-xs gap-1">
            <Star className="h-3.5 w-3.5" /> Favs
          </Button>
          <Button size="sm" variant={mode === "daily" ? "default" : "outline"} onClick={() => setMode("daily")} className="h-9 text-xs gap-1">
            <Flame className="h-3.5 w-3.5" /> Daily
          </Button>
          <Button size="sm" variant={mode === "quiz" ? "default" : "outline"} onClick={() => setMode("quiz")} className="h-9 text-xs gap-1">
            <Trophy className="h-3.5 w-3.5" /> Quiz
          </Button>
        </div>

        {/* Deck / Quiz area */}
        {mode === "quiz" ? (
          <QuizMode cards={deck.length ? deck : cards.filter(c => c.subject === subject)} subject={subject} />
        ) : !current ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No flashcards match these filters.
          </Card>
        ) : (
          <div className="space-y-3">
            {/* Card counter */}
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>{index + 1} / {deck.length}</span>
              <span className="flex items-center gap-1.5">
                {progress[current.id]?.status === "learned" && <Badge variant="secondary" className="h-5 text-[10px]">Learned</Badge>}
                {progress[current.id]?.status === "difficult" && <Badge variant="destructive" className="h-5 text-[10px]">Difficult</Badge>}
                {progress[current.id]?.is_favorite && <Star className="h-3.5 w-3.5 fill-yellow-400 text-yellow-400" />}
              </span>
            </div>

            {/* Swipeable card */}
            <div
              className="relative h-[420px] select-none touch-none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <Card
                onClick={() => setFlipped(f => !f)}
                className={`absolute inset-0 cursor-pointer overflow-hidden p-5 flex flex-col bg-gradient-to-br ${SUBJECT_COLOR[current.subject]} border-2 transition-shadow animate-scale-in`}
                style={{
                  transform: `translate(${drag.x}px, ${drag.y * 0.2}px) rotate(${drag.x * 0.05}deg)`,
                  transition: dragRef.current.active ? "none" : "transform 0.25s ease-out",
                }}
              >
                {/* swipe hints */}
                {drag.x > 40 && (
                  <div className="absolute top-4 left-4 rotate-[-12deg] px-3 py-1 border-2 border-green-500 text-green-500 font-bold rounded-md text-sm">LEARNED</div>
                )}
                {drag.x < -40 && (
                  <div className="absolute top-4 right-4 rotate-[12deg] px-3 py-1 border-2 border-red-500 text-red-500 font-bold rounded-md text-sm">DIFFICULT</div>
                )}

                <div className="flex items-start justify-between gap-2 mb-3">
                  <div>
                    <Badge variant="outline" className="text-[10px] mb-1.5">{current.chapter}</Badge>
                    <h2 className="text-lg font-bold leading-tight">{current.title}</h2>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{current.card_type}</p>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); toggleFav(); }} className="p-1">
                    <Star className={`h-5 w-5 ${progress[current.id]?.is_favorite ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"}`} />
                  </button>
                </div>

                <div className="flex-1 flex flex-col justify-center items-center text-center px-2">
                  {!flipped ? (
                    <div className="space-y-2 animate-fade-in">
                      {current.content.formula && (
                        <div className="text-2xl font-mono font-semibold leading-relaxed">
                          {current.content.formula}
                        </div>
                      )}
                      {!current.content.formula && current.content.notes && (
                        <div className="text-base leading-relaxed">{current.content.notes}</div>
                      )}
                      <p className="text-[10px] text-muted-foreground pt-3">Tap for details · Swipe to mark</p>
                    </div>
                  ) : (
                    <div className="space-y-2.5 text-sm w-full text-left animate-fade-in">
                      {current.content.formula && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Formula</div>
                          <div className="font-mono">{current.content.formula}</div>
                        </div>
                      )}
                      {current.content.variables && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Variables</div>
                          <div>{current.content.variables}</div>
                        </div>
                      )}
                      {current.content.units && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Units</div>
                          <div>{current.content.units}</div>
                        </div>
                      )}
                      {current.content.notes && (
                        <div>
                          <div className="text-[10px] uppercase tracking-wide text-muted-foreground">Notes</div>
                          <div>{current.content.notes}</div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center pt-3 border-t border-border/50 text-[10px] text-muted-foreground">
                  <span>← Difficult</span>
                  <span>Tap to flip</span>
                  <span>Learned →</span>
                </div>
              </Card>
            </div>

            {/* Action buttons */}
            <div className="grid grid-cols-4 gap-2">
              <Button variant="outline" size="sm" onClick={() => advance(-1)} className="h-10">
                <RotateCcw className="h-4 w-4" />
              </Button>
              <Button variant="outline" size="sm" onClick={() => mark("difficult")} className="h-10 gap-1 border-red-500/30 text-red-500 hover:bg-red-500/10">
                <AlertTriangle className="h-4 w-4" /> Hard
              </Button>
              <Button variant="outline" size="sm" onClick={toggleFav} className="h-10 gap-1">
                <Star className={`h-4 w-4 ${progress[current.id]?.is_favorite ? "fill-yellow-400 text-yellow-400" : ""}`} />
              </Button>
              <Button size="sm" onClick={() => mark("learned")} className="h-10 gap-1 bg-green-600 hover:bg-green-700">
                <Check className="h-4 w-4" /> Learn
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Formula of the day dialog */}
      <Dialog open={fotdOpen} onOpenChange={setFotdOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" /> Formula of the Day
            </DialogTitle>
          </DialogHeader>
          {fotd && (
            <div className={`rounded-lg p-4 bg-gradient-to-br ${SUBJECT_COLOR[fotd.subject]} border-2 space-y-2`}>
              <Badge variant="outline" className="text-[10px]">{fotd.subject} · {fotd.chapter}</Badge>
              <h3 className="text-base font-bold">{fotd.title}</h3>
              {fotd.content.formula && <div className="font-mono text-lg">{fotd.content.formula}</div>}
              {fotd.content.variables && <div className="text-xs text-muted-foreground">{fotd.content.variables}</div>}
              {fotd.content.notes && <div className="text-xs">{fotd.content.notes}</div>}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

/* ---------- Quiz Mode ---------- */
const QuizMode = ({ cards, subject }: { cards: Flashcard[]; subject: Subject }) => {
  const pool = useMemo(
    () => cards.filter(c => c.subject === subject && (c.content.formula || c.content.notes)),
    [cards, subject]
  );
  const [qIdx, setQIdx] = useState(0);
  const [score, setScore] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);

  const questions = useMemo(() => {
    if (pool.length < 4) return [];
    const list = pool.slice().sort(() => Math.random() - 0.5).slice(0, Math.min(10, pool.length));
    return list.map((card) => {
      const distractors = pool.filter(p => p.id !== card.id).sort(() => Math.random() - 0.5).slice(0, 3);
      const options = [...distractors.map(d => d.title), card.title].sort(() => Math.random() - 0.5);
      return { card, options, correct: options.indexOf(card.title) };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [subject, pool.length]);

  if (questions.length === 0) {
    return <Card className="p-6 text-center text-sm text-muted-foreground">Need at least 4 cards in {subject} to start a quiz.</Card>;
  }
  if (qIdx >= questions.length) {
    return (
      <Card className="p-6 text-center space-y-3">
        <Trophy className="h-10 w-10 mx-auto text-yellow-500" />
        <h3 className="text-lg font-bold">Quiz Complete!</h3>
        <p className="text-sm">You scored {score} / {questions.length}</p>
        <Button onClick={() => { setQIdx(0); setScore(0); setPicked(null); }}>Try Again</Button>
      </Card>
    );
  }

  const q = questions[qIdx];
  const pick = (i: number) => {
    if (picked !== null) return;
    setPicked(i);
    if (i === q.correct) setScore(s => s + 1);
    setTimeout(() => { setPicked(null); setQIdx(x => x + 1); }, 900);
  };

  return (
    <Card className="p-4 space-y-3 animate-fade-in">
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>Q {qIdx + 1} / {questions.length}</span>
        <span>Score: {score}</span>
      </div>
      <div className="bg-muted/40 rounded-lg p-4 text-center">
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">Which formula is this?</div>
        <div className="text-lg font-mono">{q.card.content.formula || q.card.content.notes}</div>
      </div>
      <div className="space-y-2">
        {q.options.map((opt, i) => {
          const isCorrect = picked !== null && i === q.correct;
          const isWrong = picked === i && i !== q.correct;
          return (
            <Button
              key={i}
              variant="outline"
              onClick={() => pick(i)}
              className={`w-full justify-start h-auto py-2.5 text-sm whitespace-normal text-left ${
                isCorrect ? "border-green-500 bg-green-500/10" : ""
              } ${isWrong ? "border-red-500 bg-red-500/10" : ""}`}
            >
              {opt}
            </Button>
          );
        })}
      </div>
    </Card>
  );
};

export default Flashcards;