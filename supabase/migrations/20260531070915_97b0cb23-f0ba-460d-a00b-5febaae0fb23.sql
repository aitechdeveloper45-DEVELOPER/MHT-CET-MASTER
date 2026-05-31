
-- Flashcards (admin-managed catalog)
CREATE TABLE public.flashcards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL CHECK (subject IN ('Physics','Chemistry','Mathematics')),
  chapter text NOT NULL,
  card_type text NOT NULL,
  title text NOT NULL,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.flashcards TO authenticated;
GRANT ALL ON public.flashcards TO service_role;

ALTER TABLE public.flashcards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated can view flashcards"
  ON public.flashcards FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins insert flashcards"
  ON public.flashcards FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admins update flashcards"
  ON public.flashcards FOR UPDATE TO authenticated USING (public.is_admin());
CREATE POLICY "Admins delete flashcards"
  ON public.flashcards FOR DELETE TO authenticated USING (public.is_admin());

CREATE INDEX idx_flashcards_subject_chapter ON public.flashcards(subject, chapter);

CREATE TRIGGER trg_flashcards_updated_at BEFORE UPDATE ON public.flashcards
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- User progress per flashcard
CREATE TABLE public.user_flashcard_progress (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  flashcard_id uuid NOT NULL REFERENCES public.flashcards(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'new' CHECK (status IN ('new','learned','difficult')),
  is_favorite boolean NOT NULL DEFAULT false,
  seen_count integer NOT NULL DEFAULT 0,
  last_seen_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, flashcard_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_flashcard_progress TO authenticated;
GRANT ALL ON public.user_flashcard_progress TO service_role;

ALTER TABLE public.user_flashcard_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users view own flashcard progress"
  ON public.user_flashcard_progress FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users insert own flashcard progress"
  ON public.user_flashcard_progress FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users update own flashcard progress"
  ON public.user_flashcard_progress FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users delete own flashcard progress"
  ON public.user_flashcard_progress FOR DELETE TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_ufp_user ON public.user_flashcard_progress(user_id);

CREATE TRIGGER trg_ufp_updated_at BEFORE UPDATE ON public.user_flashcard_progress
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Seed starter cards
INSERT INTO public.flashcards (subject, chapter, card_type, title, content) VALUES
('Physics','Kinematics','Formula','Equations of Motion','{"formula":"v = u + at","variables":"v = final velocity, u = initial velocity, a = acceleration, t = time","units":"m/s, m/s², s","notes":"Valid for uniform acceleration."}'),
('Physics','Kinematics','Formula','Displacement','{"formula":"s = ut + ½at²","variables":"s = displacement, u = initial velocity, a = acceleration, t = time","units":"m, m/s, m/s², s"}'),
('Physics','Kinematics','Formula','Third Equation','{"formula":"v² = u² + 2as","variables":"v, u = velocities; a = acceleration; s = displacement","units":"m/s, m/s², m"}'),
('Physics','Laws of Motion','Formula','Newton''s Second Law','{"formula":"F = ma","variables":"F = force, m = mass, a = acceleration","units":"N, kg, m/s²"}'),
('Physics','Work Energy Power','Formula','Kinetic Energy','{"formula":"KE = ½mv²","variables":"m = mass, v = velocity","units":"J, kg, m/s"}'),
('Physics','Work Energy Power','Formula','Potential Energy','{"formula":"PE = mgh","variables":"m = mass, g = 9.8 m/s², h = height","units":"J, kg, m/s², m"}'),
('Physics','Current Electricity','Formula','Ohm''s Law','{"formula":"V = IR","variables":"V = voltage, I = current, R = resistance","units":"V, A, Ω"}'),
('Physics','Current Electricity','Formula','Power Dissipated','{"formula":"P = I²R = V²/R","variables":"P = power, I = current, V = voltage, R = resistance","units":"W, A, V, Ω"}'),
('Physics','Wave Optics','Formula','Fringe Width','{"formula":"β = λD/d","variables":"β = fringe width, λ = wavelength, D = screen distance, d = slit separation","units":"m, m, m, m"}'),
('Physics','Thermodynamics','Formula','First Law','{"formula":"ΔU = Q − W","variables":"ΔU = change in internal energy, Q = heat added, W = work done by system","units":"J"}'),
('Physics','Gravitation','Formula','Universal Gravitation','{"formula":"F = G·m₁m₂/r²","variables":"G = 6.674×10⁻¹¹ N·m²/kg²","units":"N, kg, m"}'),
('Physics','Oscillations','Formula','Time Period of SHM','{"formula":"T = 2π√(m/k)","variables":"m = mass, k = spring constant","units":"s, kg, N/m"}'),

('Chemistry','Mole Concept','Formula','Number of Moles','{"formula":"n = mass / molar mass","variables":"n = moles","units":"mol, g, g/mol"}'),
('Chemistry','Atomic Structure','Formula','Rydberg Formula','{"formula":"1/λ = R(1/n₁² − 1/n₂²)","variables":"R = 1.097×10⁷ m⁻¹","units":"m⁻¹"}'),
('Chemistry','Thermodynamics','Formula','Gibbs Free Energy','{"formula":"ΔG = ΔH − TΔS","variables":"ΔG, ΔH = enthalpy, T = temperature, ΔS = entropy","units":"J, K, J/K"}'),
('Chemistry','Equilibrium','Reaction','Haber Process','{"formula":"N₂ + 3H₂ ⇌ 2NH₃","notes":"Exothermic; high pressure, ~450°C, Fe catalyst favors product."}'),
('Chemistry','Electrochemistry','Formula','Nernst Equation','{"formula":"E = E° − (0.059/n)·log Q","variables":"n = electrons, Q = reaction quotient","units":"V"}'),
('Chemistry','Chemical Kinetics','Formula','First Order Rate','{"formula":"k = (2.303/t)·log([A₀]/[A])","variables":"k = rate constant, t = time","units":"s⁻¹"}'),
('Chemistry','Organic','Reaction','Markovnikov''s Rule','{"formula":"CH₂=CH−CH₃ + HBr → CH₃−CHBr−CH₃","notes":"H adds to carbon with more H atoms."}'),
('Chemistry','Organic','Reaction','SN1 vs SN2','{"notes":"SN1: 3° substrates, polar protic, racemization, two steps. SN2: 1° substrates, polar aprotic, inversion, one step."}'),
('Chemistry','Solutions','Formula','Molarity','{"formula":"M = moles of solute / litres of solution","units":"mol/L"}'),
('Chemistry','Solutions','Formula','Raoult''s Law','{"formula":"P = X₁P₁° + X₂P₂°","variables":"X = mole fraction, P° = pure vapor pressure"}'),

('Mathematics','Trigonometry','Identity','Pythagorean Identity','{"formula":"sin²θ + cos²θ = 1","notes":"Also: 1 + tan²θ = sec²θ; 1 + cot²θ = cosec²θ"}'),
('Mathematics','Trigonometry','Identity','Double Angle','{"formula":"sin 2θ = 2 sinθ cosθ; cos 2θ = cos²θ − sin²θ"}'),
('Mathematics','Calculus','Formula','Power Rule (Derivative)','{"formula":"d/dx(xⁿ) = n·xⁿ⁻¹"}'),
('Mathematics','Calculus','Formula','Product Rule','{"formula":"(uv)'' = u''v + uv''"}'),
('Mathematics','Calculus','Formula','Integration by Parts','{"formula":"∫u dv = uv − ∫v du"}'),
('Mathematics','Vectors','Formula','Dot Product','{"formula":"a·b = |a||b|cosθ"}'),
('Mathematics','Vectors','Formula','Cross Product Magnitude','{"formula":"|a×b| = |a||b|sinθ"}'),
('Mathematics','Probability','Formula','Bayes'' Theorem','{"formula":"P(A|B) = P(B|A)·P(A) / P(B)"}'),
('Mathematics','Sequences','Formula','Sum of AP','{"formula":"Sₙ = n/2·(2a + (n−1)d)","variables":"a = first term, d = common difference"}'),
('Mathematics','Sequences','Formula','Sum of GP','{"formula":"Sₙ = a(1 − rⁿ)/(1 − r), r ≠ 1"}'),
('Mathematics','Coordinate Geometry','Shortcut','Distance Formula','{"formula":"d = √((x₂−x₁)² + (y₂−y₁)²)"}'),
('Mathematics','Coordinate Geometry','Theorem','Section Formula','{"formula":"(x,y) = ((mx₂+nx₁)/(m+n), (my₂+ny₁)/(m+n))"}');
