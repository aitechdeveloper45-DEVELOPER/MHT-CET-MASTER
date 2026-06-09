import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const EXAM_DATE = new Date("2026-05-01"); // approx MHT-CET 2026

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_PUBLISHABLE_KEY") ?? Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: userData, error: userErr } = await supabase.auth.getUser();
    if (userErr || !userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = userData.user.id;

    const { message } = await req.json();
    if (!message || typeof message !== "string") {
      return new Response(JSON.stringify({ error: "Message required" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gather context
    const [statsRes, subjRes, testsRes, topicsRes, historyRes] = await Promise.all([
      supabase.from("user_stats").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("subject_progress").select("*").eq("user_id", userId),
      supabase.from("test_results").select("test_name,subject,score,max_score,created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
      supabase.from("topic_progress").select("subject,topic_name,questions_attempted,questions_correct").eq("user_id", userId),
      supabase.from("mentor_messages").select("role,content").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
    ]);

    const stats = statsRes.data;
    const subjects = subjRes.data ?? [];
    const tests = testsRes.data ?? [];
    const topics = topicsRes.data ?? [];
    const history = (historyRes.data ?? []).reverse();

    const daysLeft = Math.max(0, Math.ceil((EXAM_DATE.getTime() - Date.now()) / (1000 * 60 * 60 * 24)));

    // weak topics: attempted >=3 and accuracy <60
    const weakTopics = topics
      .filter((t: any) => (t.questions_attempted ?? 0) >= 3)
      .map((t: any) => ({ ...t, acc: t.questions_correct / Math.max(1, t.questions_attempted) }))
      .sort((a: any, b: any) => a.acc - b.acc)
      .slice(0, 6);

    const avgScore = tests.length
      ? Math.round(tests.reduce((s: number, t: any) => s + (t.score / Math.max(1, t.max_score)) * 100, 0) / tests.length)
      : null;

    const subjLine = subjects
      .map((s: any) => `${s.subject_name}: ${s.progress_percentage ?? 0}% (acc ${s.accuracy ?? 0}%, ${s.tests_completed ?? 0} tests)`)
      .join(" | ");

    const weakLine = weakTopics.length
      ? weakTopics.map((t: any) => `${t.topic_name} (${t.subject}, ${Math.round(t.acc * 100)}%)`).join(", ")
      : "Not enough data yet";

    const systemPrompt = `You are MHT CET Master Mentor — a friendly, motivating personal coach for Indian students preparing for the MHT-CET exam. Give actionable, specific, structured advice in markdown. Use bullet points, time blocks (e.g., "45 mins"), and concrete chapter names. Keep responses focused and practical.

STUDENT'S CURRENT PROFILE:
- Days remaining until MHT-CET: ${daysLeft}
- Subject progress: ${subjLine || "No data yet"}
- Overall accuracy: ${stats?.overall_accuracy ?? 0}%
- Total tests completed: ${stats?.total_tests ?? 0}
- Study streak: ${stats?.study_streak ?? 0} days
- Study time logged: ${stats?.study_time_minutes ?? 0} minutes
- Recent average test score: ${avgScore !== null ? avgScore + "%" : "No tests yet"}
- Weakest topics: ${weakLine}
- Recent tests: ${tests.slice(0, 5).map((t: any) => `${t.test_name} ${t.score}/${t.max_score}`).join("; ") || "None"}

When the user asks for a plan, generate concrete daily/weekly schedules referencing the weakest topics above and remaining time. Always cite their actual numbers. End with an estimated mark improvement or encouragement.`;

    // Google Gemini API (free tier) — uses GEMINI_API_KEY from Google AI Studio
    const geminiKey = Deno.env.get("GEMINI_API_KEY");
    if (!geminiKey) {
      return new Response(JSON.stringify({ error: "GEMINI_API_KEY not configured" }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const contents = [
      ...history.map((m: any) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      })),
      { role: "user", parts: [{ text: message }] },
    ];

    const aiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemPrompt }] },
          contents,
        }),
      }
    );

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("Gemini API error:", aiRes.status, errText);
      if (aiRes.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit reached. Please wait a moment and try again." }), {
          status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      return new Response(JSON.stringify({ error: "AI service error", details: errText }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiJson = await aiRes.json();
    const reply: string =
      aiJson.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join("") ??
      "Sorry, I couldn't generate a response.";

    // Persist both messages
    await supabase.from("mentor_messages").insert([
      { user_id: userId, role: "user", content: message },
      { user_id: userId, role: "assistant", content: reply },
    ]);

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-mentor error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});