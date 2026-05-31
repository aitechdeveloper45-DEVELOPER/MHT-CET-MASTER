import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import ReactMarkdown from "react-markdown";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Send, Trash2, Sparkles, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

interface MentorMessage {
  id?: string;
  role: "user" | "assistant";
  content: string;
}

const QUICK_PROMPTS = [
  "Generate Study Plan",
  "Analyze My Performance",
  "What To Revise Today?",
  "Improve Physics",
  "Improve Chemistry",
  "Improve Maths",
];

const QUICK_PROMPT_TEXT: Record<string, string> = {
  "Generate Study Plan": "Create a personalized 30-day study plan for me based on my current progress.",
  "Analyze My Performance": "Analyze my performance so far and tell me where I stand.",
  "What To Revise Today?": "What should I revise today? Give me a focused plan for the next few hours.",
  "Improve Physics": "I want to improve my Physics score. What should I do?",
  "Improve Chemistry": "I want to improve my Chemistry score. What should I do?",
  "Improve Maths": "I want to improve my Mathematics score. What should I do?",
};

const Mentor = () => {
  const navigate = useNavigate();
  const [messages, setMessages] = useState<MentorMessage[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { navigate("/auth"); return; }
      const { data } = await supabase
        .from("mentor_messages")
        .select("id,role,content")
        .order("created_at", { ascending: true });
      setMessages((data as MentorMessage[]) ?? []);
      setLoading(false);
      setTimeout(() => inputRef.current?.focus(), 100);
    })();
  }, [navigate]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, sending]);

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || sending) return;
    setSending(true);
    setInput("");
    setMessages((m) => [...m, { role: "user", content: trimmed }]);

    try {
      const { data, error } = await supabase.functions.invoke("ai-mentor", {
        body: { message: trimmed },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setMessages((m) => [...m, { role: "assistant", content: data.reply }]);
    } catch (e: any) {
      toast({ title: "Mentor unavailable", description: e.message ?? "Try again.", variant: "destructive" });
      setMessages((m) => m.slice(0, -1));
    } finally {
      setSending(false);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  };

  const clearChat = async () => {
    if (!confirm("Clear all mentor chat history?")) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("mentor_messages").delete().eq("user_id", user.id);
    setMessages([]);
  };

  return (
    <div className="flex flex-col h-[100dvh] bg-gradient-to-br from-background via-background to-primary/5">
      <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-3 py-3 flex items-center justify-between gap-2">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="h-9 w-9">
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-2 flex-1">
            <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-sm font-bold leading-tight">AI Mentor</h1>
              <p className="text-[10px] text-muted-foreground leading-tight">Your personal CET coach</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={clearChat} className="h-9 w-9" disabled={messages.length === 0}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="container mx-auto px-3 py-4 max-w-3xl space-y-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : messages.length === 0 ? (
            <div className="text-center py-8 space-y-3">
              <div className="w-14 h-14 mx-auto rounded-full bg-primary/10 flex items-center justify-center">
                <Sparkles className="w-7 h-7 text-primary" />
              </div>
              <h2 className="text-lg font-semibold">Hi! I'm your CET Mentor 👋</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto">
                Ask me anything about your prep — study plans, weak topics, revision, or motivation. I'll use your progress data to guide you.
              </p>
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                {m.role === "user" ? (
                  <div className="bg-primary text-primary-foreground rounded-2xl rounded-br-sm px-4 py-2 max-w-[85%] text-sm whitespace-pre-wrap">
                    {m.content}
                  </div>
                ) : (
                  <div className="max-w-[95%] text-sm prose prose-sm dark:prose-invert prose-headings:mt-3 prose-headings:mb-2 prose-p:my-2 prose-ul:my-2 prose-li:my-0.5 prose-strong:text-foreground">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            ))
          )}
          {sending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Thinking...
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="border-t bg-card/80 backdrop-blur-sm">
        <div className="container mx-auto px-3 py-2 max-w-3xl">
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1 scrollbar-none">
            {QUICK_PROMPTS.map((p) => (
              <Button
                key={p}
                variant="outline"
                size="sm"
                className="text-xs whitespace-nowrap shrink-0 h-8"
                onClick={() => sendMessage(QUICK_PROMPT_TEXT[p])}
                disabled={sending}
              >
                {p}
              </Button>
            ))}
          </div>
          <div className="flex gap-2 items-end pb-3">
            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage(input);
                }
              }}
              placeholder="Ask your mentor anything..."
              className="resize-none min-h-[44px] max-h-32 text-sm"
              rows={1}
              disabled={sending}
            />
            <Button
              size="icon"
              onClick={() => sendMessage(input)}
              disabled={sending || !input.trim()}
              className="h-11 w-11 shrink-0"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Mentor;