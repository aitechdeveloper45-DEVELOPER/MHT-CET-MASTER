import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Intelligently selects the best AI model based on test parameters
 * @param difficulty - Test difficulty level
 * @param numQuestions - Number of questions to generate
 * @param isFullTest - Whether this is a full 150-question test
 * @param subject - Subject being tested
 * @returns The optimal model identifier
 */
function selectOptimalModel(
  difficulty: string,
  numQuestions: number,
  isFullTest: boolean,
  subject?: string
): string {
  // Use gemini-2.5-flash by default — stable, fast, supports max_tokens reliably.
  console.log("Selected model: google/gemini-2.5-flash");
  return "google/gemini-2.5-flash";
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // ============= AUTHENTICATION =============
    // Verify the caller has a valid user session (NOT just the public anon key).
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const authClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    // Use getClaims for signing-keys JWT validation (getUser may fail with new key system)
    let authedUserId: string | null = null;
    try {
      const { data: claimsData, error: claimsError } = await (authClient.auth as any).getClaims(token);
      if (!claimsError && claimsData?.claims?.sub) {
        authedUserId = claimsData.claims.sub;
      }
    } catch (_e) {
      // fall through to getUser fallback
    }

    if (!authedUserId) {
      const { data: { user: authedUser }, error: authError } = await authClient.auth.getUser(token);
      if (authError || !authedUser) {
        console.error('Auth failed:', authError?.message);
        return new Response(
          JSON.stringify({ error: 'Unauthorized' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      authedUserId = authedUser.id;
    }
    const authedUser = { id: authedUserId };

    const body = await req.json();
    const { subject, difficulty, numQuestions, topics, fullCETTest, studyClass } = body;
    // Always derive userId from the authenticated session - ignore client-supplied value
    const userId = authedUser.id;
    
    // ============= INPUT VALIDATION =============
    // Validate numQuestions (1-100 range)
    if (numQuestions !== undefined && (typeof numQuestions !== 'number' || numQuestions < 1 || numQuestions > 100)) {
      return new Response(
        JSON.stringify({ error: 'numQuestions must be a number between 1 and 100' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate difficulty level
    const validDifficulties = ['easy', 'medium', 'hard'];
    if (difficulty !== undefined && !validDifficulties.includes(difficulty)) {
      return new Response(
        JSON.stringify({ error: 'Invalid difficulty level. Must be easy, medium, or hard' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate subject
    const validSubjects = ['Physics', 'Chemistry', 'Mathematics', 'Biology'];
    if (subject !== undefined && !validSubjects.includes(subject)) {
      return new Response(
        JSON.stringify({ error: 'Invalid subject. Must be Physics, Chemistry, Mathematics, or Biology' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate topics array
    if (topics !== undefined && (!Array.isArray(topics) || topics.length > 20)) {
      return new Response(
        JSON.stringify({ error: 'Topics must be an array with max 20 items' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate userId format (UUID)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (userId !== undefined && !uuidRegex.test(userId)) {
      return new Response(
        JSON.stringify({ error: 'Invalid userId format' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    // ============= END INPUT VALIDATION =============

    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Handle Full CET Test generation
    if (fullCETTest) {
      console.log("Generating Full MHT-CET Test - FAST PARALLEL MODE (6 batches)");
      
      const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
      
      // Split into 6 smaller batches (2 per subject × 3 subjects) for speed + reliability
      const batches = [
        { subject: 'Physics', part: 1, count: 25, focus: 'Std XII', topics: "Rotational Dynamics, Kinetic Theory of Gases, Thermodynamics, Oscillations, Wave Optics, Electrostatics, Current Electricity, Magnetic Fields" },
        { subject: 'Physics', part: 2, count: 25, focus: 'Mixed', topics: "Electromagnetic Induction, AC Circuits, Dual Nature of Matter, Atoms and Nuclei, Semiconductors, Units and Measurements, Scalars and Vectors, Laws of Motion, Work Energy Power" },
        { subject: 'Chemistry', part: 1, count: 25, focus: 'Std XII', topics: "Solid State, Solutions, Chemical Thermodynamics, Electrochemistry, Chemical Kinetics, p-Block Elements, d and f Block Elements, Coordination Compounds" },
        { subject: 'Chemistry', part: 2, count: 25, focus: 'Mixed', topics: "Haloalkanes, Alcohols Phenols Ethers, Aldehydes Ketones Carboxylic Acids, Organic Nitrogen Compounds, Biomolecules, Polymers, Basic Concepts, States of Matter, Redox Reactions" },
        { subject: 'Mathematics', part: 1, count: 25, focus: 'Std XII', topics: "Matrices, Continuity, Differentiation, Application of Derivatives, Integration, Application of Definite Integral, Differential Equations, Probability Distribution" },
        { subject: 'Mathematics', part: 2, count: 25, focus: 'Mixed', topics: "Mathematical Logic, Pair of Straight Lines, Circle, Conics, Vectors, Three Dimensional Geometry, Linear Programming, Trigonometric Functions, Sequences and Series" },
      ];

      const selectedModel = "google/gemini-2.5-flash";
      const startTime = Date.now();

      const generateBatch = async (batch: typeof batches[0]): Promise<any[]> => {
        const tag = `[${batch.subject} P${batch.part}]`;
        console.log(`${tag} Starting...`);
        const t0 = Date.now();

        const prompt = `Generate exactly ${batch.count} MHT-CET MCQs for ${batch.subject} (${batch.focus}).
Topics: ${batch.topics}
Mix: 8 EASY, 12 MEDIUM, 5 HARD.
Use Unicode symbols (×÷²³√πθ), NO LaTeX. Short explanations (<50 chars).
Return ONLY a valid JSON array, no markdown.
Format: [{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"...","topic":"...","difficulty":"easy|medium|hard"}]`;

        try {
          const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: selectedModel,
              max_tokens: 8000,
              messages: [
                { role: "system", content: "You are an MHT-CET question generator. Return ONLY valid JSON arrays." },
                { role: "user", content: prompt },
              ],
            }),
          });

          if (!resp.ok) {
            const errText = await resp.text();
            console.error(`${tag} API error: ${resp.status} ${errText}`);
            throw new Error(`AI gateway ${resp.status}`);
          }

          const data = await resp.json();
          const content = data.choices?.[0]?.message?.content || "";
          
          // Extract JSON
          const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                           content.match(/```\s*([\s\S]*?)\s*```/) ||
                           [null, content];
          let jsonStr = (jsonMatch[1] || content).trim();
          
          let questions: any[] = [];
          try {
            questions = JSON.parse(jsonStr);
          } catch {
            // Sanitize and retry
            jsonStr = jsonStr.replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ').replace(/,\s*([}\]])/g, '$1').trim();
            try {
              questions = JSON.parse(jsonStr);
            } catch {
              // Recover truncated
              const lastBrace = jsonStr.lastIndexOf("}");
              if (lastBrace > 0) {
                try {
                  questions = JSON.parse(jsonStr.substring(0, lastBrace + 1) + "]");
                } catch {
                  console.error(`${tag} JSON recovery failed`);
                  return [];
                }
              }
            }
          }

          if (!Array.isArray(questions)) return [];
          if (questions.length > batch.count) questions = questions.slice(0, batch.count);
          
          console.log(`${tag} Got ${questions.length} questions in ${Date.now() - t0}ms`);
          
          return questions.map((q: any, idx: number) => ({
            id: `${batch.subject.toLowerCase()}_p${batch.part}_${idx + 1}`,
            question: q.question || "",
            options: Array.isArray(q.options) ? q.options : [],
            correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : 0,
            explanation: q.explanation || "",
            topic: q.topic || batch.subject,
            difficulty: q.difficulty || "medium",
            subject: batch.subject,
          }));
        } catch (err) {
          console.error(`${tag} Error:`, err);
          return [];
        }
      };

      // Run ALL 6 batches in parallel (each batch resolves to [] only on parse failure)
      const results = await Promise.allSettled(batches.map(b => generateBatch(b)));
      const allQuestions = results.flatMap(r => r.status === 'fulfilled' ? r.value : []);
      const totalTime = Date.now() - startTime;
      console.log(`FAST generation complete: ${allQuestions.length} questions in ${totalTime}ms`);

      // If too few questions were generated, surface a clear error instead of an empty test.
      if (allQuestions.length < 30) {
        console.error(`Full CET generation produced only ${allQuestions.length} questions`);
        return new Response(
          JSON.stringify({ error: "The AI service is busy right now. Please try again in a moment." }),
          { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // Store in DB (non-blocking)
      const records = allQuestions.map(q => ({
        subject: q.subject,
        difficulty: q.difficulty,
        question_text: q.question,
        options: q.options,
        correct_answer: q.correctAnswer,
        explanation: q.explanation,
        topic: q.topic,
      }));

      supabase.from('test_questions').insert(records).select('id')
        .then(({ data, error }) => {
          if (error) console.error("DB insert error:", error);
          else console.log(`Stored ${data?.length || 0} questions in DB`);
        });

      return new Response(
        JSON.stringify({ questions: allQuestions }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Generating ${numQuestions} ${difficulty} questions for ${subject}`);

    // Select optimal AI model based on test parameters
    const selectedModel = selectOptimalModel(difficulty, numQuestions, false, subject);

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

    // Fetch previously seen questions (limit to 15 for speed)
    let seenQuestionsText = "";
    if (userId) {
      const { data: seenQuestions } = await supabase
        .from('user_seen_questions')
        .select(`test_questions!inner(question_text)`)
        .eq('user_id', userId)
        .limit(15);

      if (seenQuestions && seenQuestions.length > 0) {
        const questionsList = seenQuestions
          .map((sq: any) => `- ${sq.test_questions.question_text.substring(0, 50)}`)
          .join('\n');
        seenQuestionsText = `\nAVOID similar to:\n${questionsList}`;
        console.log(`User has seen ${seenQuestions.length} questions`);
      }
    }

    // Define difficulty level characteristics
    const difficultyDescriptions: Record<string, string> = {
      easy: `EASY LEVEL REQUIREMENTS:
- Basic conceptual questions testing fundamental understanding
- Direct formula application without complex calculations
- Single-step problem solving
- Questions that can be answered in 30-60 seconds
- Focus on definitions, basic properties, and simple applications`,
      medium: `MEDIUM LEVEL REQUIREMENTS:
- Questions requiring 2-3 step problem solving
- Application of concepts with moderate calculations
- Questions that integrate 2 related concepts
- Questions that can be answered in 60-90 seconds
- Focus on standard problem types from textbooks`,
      hard: `HARD LEVEL REQUIREMENTS:
- Complex multi-step problems (4+ steps)
- Questions requiring integration of multiple concepts
- Analytical and higher-order thinking questions
- Tricky options that test deep understanding
- Questions that can take 90-120 seconds to solve
- Focus on competitive exam level problems`
    };

    const difficultyGuide = difficultyDescriptions[difficulty] || difficultyDescriptions.medium;

    const validClass = studyClass === "XI" || studyClass === "XII" ? studyClass : null;
    const syllabusLine = validClass
      ? `- Maharashtra Board Std ${validClass} syllabus ONLY (100% Std ${validClass}). Do NOT include any Std ${validClass === "XI" ? "XII" : "XI"} content.`
      : `- Maharashtra Board syllabus (20% Std XI, 80% Std XII)`;
    const chapterLine = validClass && topics && topics.length === 1
      ? `\n- STRICTLY restrict ALL questions to the chapter "${topics[0]}" from Std ${validClass}. Do NOT cover any other chapter.`
      : (topics ? `\n- Topics: ${topics.join(', ')}` : '');

    const systemPrompt = `You are an MHT-CET question generator for ${subject}. Generate exactly ${numQuestions} MCQs at ${difficulty.toUpperCase()} level.

RULES:
${syllabusLine}
- 4 options each, one correct answer
- Return ONLY valid JSON array. NO markdown, NO code blocks
- Use Unicode: × ÷ ² ³ √ π θ. NO LaTeX
- Keep explanations under 80 chars${chapterLine}${seenQuestionsText}

${difficulty === 'easy' ? 'EASY: Basic concepts, single-step, 30-60 sec each' : difficulty === 'hard' ? 'HARD: Multi-step, competitive level, 90-120 sec each' : 'MEDIUM: 2-3 steps, standard textbook level, 60-90 sec each'}

Format: [{"question":"...","options":["A","B","C","D"],"correctAnswer":0,"explanation":"...","topic":"...","difficulty":"${difficulty}"}]`;

    // Higher token budget to prevent truncation - 300 tokens per question with 1.5x buffer
    const maxTokens = Math.min(Math.ceil(numQuestions * 300 * 1.5), 32000);

    // Use correct token parameter based on model provider
    const isOpenAI = selectedModel.startsWith("openai/");
    const tokenParam = isOpenAI ? { max_completion_tokens: maxTokens } : { max_tokens: maxTokens };

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: selectedModel,
        ...tokenParam,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Generate exactly ${numQuestions} ${subject} MCQs. Return ONLY JSON array.` },
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }), 
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits depleted. Please add credits to continue." }), 
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      throw new Error(`Failed to generate questions: ${response.status} ${errorText}`);
    }

    // Check if response has content
    const responseText = await response.text();
    if (!responseText || responseText.trim().length === 0) {
      console.error("Empty response from AI gateway");
      throw new Error("Received empty response from AI service");
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      console.error("Failed to parse AI gateway response:", parseError);
      console.error("Response text:", responseText);
      throw new Error("Invalid response format from AI service");
    }

    if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      console.error("Unexpected response structure:", data);
      throw new Error("Invalid response structure from AI service");
    }

    const content = data.choices[0].message.content;
    
    console.log("AI Response:", content);

    // Parse the JSON from the response
    let questions;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```json\s*([\s\S]*?)\s*```/) || 
                       content.match(/```\s*([\s\S]*?)\s*```/) ||
                       [null, content];
      
      let jsonStr = (jsonMatch[1] || content).trim();
      
      // Try to parse as-is first
      try {
        questions = JSON.parse(jsonStr);
      } catch (e) {
        console.log("Initial JSON parse failed, attempting sanitization...");
        
        // Safe JSON sanitization
        jsonStr = jsonStr
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, ' ') // Remove control characters
          .replace(/,\s*([}\]])/g, '$1') // Remove trailing commas
          .trim();
        
        try {
          questions = JSON.parse(jsonStr);
        } catch (e2) {
          console.log("Sanitized parse failed, attempting truncated response recovery...");
          
          // Try to recover from truncated JSON (missing closing brackets)
          const lastBrace = jsonStr.lastIndexOf("}");
          if (lastBrace > 0) {
            const repaired = jsonStr.substring(0, lastBrace + 1) + "]";
            try {
              questions = JSON.parse(repaired);
              console.log(`Recovered ${questions.length} questions from truncated response`);
            } catch (e3) {
              // Last resort: extract individual question objects
              console.log("Attempting individual question extraction...");
              const questionMatches = jsonStr.match(/\{[^{}]*"question"\s*:\s*"[^"]*"[^{}]*\}/g);
              if (questionMatches && questionMatches.length > 0) {
                questions = questionMatches.map((q: string) => {
                  try {
                    return JSON.parse(q);
                  } catch {
                    return null;
                  }
                }).filter((q: any) => q !== null);
                console.log(`Extracted ${questions.length} questions individually`);
              } else {
                throw e2;
              }
            }
          } else {
            throw e2;
          }
        }
      }
      
      if (!Array.isArray(questions)) {
        throw new Error("Response is not an array");
      }
    } catch (parseError) {
      console.error("Failed to parse AI response:", parseError);
      console.error("Raw content (first 500 chars):", content.substring(0, 500));
      throw new Error("Failed to parse generated questions. The AI response was not in valid JSON format.");
    }

    // Validate and enforce exact question count - retry once if short
    if (questions.length < numQuestions) {
      console.warn(`AI returned ${questions.length} questions but ${numQuestions} were requested. Will pad with a retry if significantly short.`);
      
      const shortfall = numQuestions - questions.length;
      if (shortfall >= 3) {
        console.log(`Retrying to generate ${shortfall} additional questions...`);
        try {
          const retryTokenParam = isOpenAI ? { max_completion_tokens: Math.ceil(shortfall * 250) } : { max_tokens: Math.ceil(shortfall * 250) };
          const retryResp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${LOVABLE_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: selectedModel,
              ...retryTokenParam,
              messages: [
                { role: "system", content: `Generate exactly ${shortfall} MHT-CET MCQs for ${subject} at ${difficulty} difficulty. Return ONLY a JSON array.` },
                { role: "user", content: `Generate exactly ${shortfall} questions. Return ONLY valid JSON array.` },
              ],
            }),
          });
          if (retryResp.ok) {
            const retryData = await retryResp.json();
            const retryContent = retryData.choices?.[0]?.message?.content || "";
            const retryMatch = retryContent.match(/```json\s*([\s\S]*?)\s*```/) || [null, retryContent];
            try {
              const extraQs = JSON.parse((retryMatch[1] || retryContent).trim());
              if (Array.isArray(extraQs)) {
                questions = questions.concat(extraQs.slice(0, shortfall));
                console.log(`Retry successful, now have ${questions.length} questions`);
              }
            } catch { console.warn("Retry parse failed, using available questions"); }
          } else { await retryResp.text(); }
        } catch (e) { console.warn("Retry failed:", e); }
      }
    } else if (questions.length > numQuestions) {
      console.log(`AI returned ${questions.length} questions, trimming to ${numQuestions}`);
      questions = questions.slice(0, numQuestions);
    }

    // Format questions and store them in database
    const formattedQuestions: any[] = [];
    const questionRecords = [];

    for (let index = 0; index < questions.length; index++) {
      const q = questions[index];
      
      // Handle options - could be array or string representation
      let options = [];
      if (Array.isArray(q.options)) {
        options = q.options;
      } else if (typeof q.options === 'string') {
        try {
          const parsed = JSON.parse(q.options);
          options = Array.isArray(parsed) ? parsed : [];
        } catch {
          options = q.options
            .replace(/^\[|\]$/g, '')
            .split(',')
            .map((opt: string) => opt.trim())
            .filter((opt: string) => opt.length > 0);
        }
      }
      
      const formattedQuestion: any = {
        id: `q${index + 1}`,
        question: q.question || "",
        options: options,
        correctAnswer: typeof q.correctAnswer === 'number' ? q.correctAnswer : 0,
        explanation: q.explanation || "",
        topic: q.topic || subject,
        difficulty: q.difficulty || difficulty,
        subject: subject,
      };

      formattedQuestions.push(formattedQuestion);

      // Store in database
      questionRecords.push({
        subject: subject,
        difficulty: difficulty,
        question_text: q.question || "",
        options: options,
        correct_answer: typeof q.correctAnswer === 'number' ? q.correctAnswer : 0,
        explanation: q.explanation || "",
        topic: q.topic || subject,
      });
    }

    // Insert questions in background - don't block response
    supabase
      .from('test_questions')
      .insert(questionRecords)
      .select('id')
      .then(({ data, error }) => {
        if (error) console.error("DB insert error:", error);
        else console.log(`Stored ${data?.length || 0} questions in DB`);
      });

    console.log(`Successfully generated ${formattedQuestions.length} questions`);

    return new Response(
      JSON.stringify({ questions: formattedQuestions }), 
      { 
        status: 200, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  } catch (error) {
    console.error("Error in generate-mcq-test:", error);
    return new Response(
      JSON.stringify({ 
        error: "An error occurred generating your test. Please try again." 
      }), 
      { 
        status: 500, 
        headers: { ...corsHeaders, "Content-Type": "application/json" } 
      }
    );
  }
});
