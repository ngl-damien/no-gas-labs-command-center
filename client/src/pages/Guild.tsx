import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";
import { Link } from "wouter";
import { Activity, ArrowLeft, BrainCircuit, RefreshCw, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Tier = "COMMAND" | "SPECIALIST" | "EXECUTOR";
type QueryType = "STRATEGIC" | "TECHNICAL" | "CREATIVE" | "ETHICAL" | "FINANCIAL" | "IMPLEMENTATION" | "FULL_GUILD";

interface Persona {
  id: string;
  name: string;
  archetype: string;
  tier: Tier;
  domain: string;
  heuristics_count: number;
  output_format: string;
}
interface GuildRoster {
  guild_name: string;
  version: string;
  total_personas: number;
  tiers: Record<Tier, { description: string; count: number; authority_level: number; personas: Persona[] }>;
}
interface GuildStats {
  guild: { total_personas: number; tiers: Record<Tier, number>; total_heuristics: number; total_triggers: number; version: string };
}
interface ProviderHealth {
  provider?: { configured?: boolean; mode?: string; provider?: string; model?: string };
}
interface PersonaDetail {
  persona: {
    id: string; name: string; archetype: string; tier: Tier;
    domain_focus?: { primary?: string; secondary?: string[] };
    core_heuristics?: string[];
    epistemic_biases?: { known?: string[]; compensated_by?: string[] };
  };
  authority_level: number;
  domain: string;
}
interface FormedCouncil {
  query_type: QueryType;
  council: Array<{ id: string; name: string; archetype: string; tier: Tier; domain: string }>;
  council_size: number;
}
interface DeliberationResult {
  input: string;
  council?: { personas?: string[]; primary?: string; mode?: string; rationale?: string };
  deliberation?: {
    deliberation_mode?: string;
    perspectives?: Array<{
      persona: string;
      response?: { reasoning_summary?: string; claims?: Array<{ statement: string; confidence: number }> };
      provenance?: { evidence_class?: string };
    }>;
    disagreements?: Array<{ between: string[]; substance?: string; resolution_status?: string }>;
  };
}

const TIERS: Tier[] = ["COMMAND", "SPECIALIST", "EXECUTOR"];
const QUERY_TYPES: QueryType[] = ["STRATEGIC", "TECHNICAL", "CREATIVE", "ETHICAL", "FINANCIAL", "IMPLEMENTATION", "FULL_GUILD"];

async function readJson<T>(response: Response): Promise<T> {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    const errorBody = body as { message?: string; error?: string };
    throw new Error(errorBody.message || errorBody.error || "Request failed (" + response.status + ")");
  }
  return body as T;
}

export default function Guild() {
  const [roster, setRoster] = useState<GuildRoster | null>(null);
  const [stats, setStats] = useState<GuildStats | null>(null);
  const [health, setHealth] = useState<ProviderHealth | null>(null);
  const [selectedPersona, setSelectedPersona] = useState<PersonaDetail | null>(null);
  const [queryType, setQueryType] = useState<QueryType>("FULL_GUILD");
  const [input, setInput] = useState("");
  const [result, setResult] = useState<DeliberationResult | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const loadGuild = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const responses = await Promise.all([
        fetch("/api/node-gate/guild"),
        fetch("/api/node-gate/guild/stats"),
        fetch("/api/node-gate/health"),
      ]);
      const [rosterData, statsData, healthData] = await Promise.all([
        readJson<GuildRoster>(responses[0]),
        readJson<GuildStats>(responses[1]),
        readJson<ProviderHealth>(responses[2]),
      ]);
      setRoster(rosterData);
      setStats(statsData);
      setHealth(healthData);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load the live Guild Gate.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void loadGuild(); }, [loadGuild]);

  const personas = useMemo(
    () => TIERS.flatMap((tier) => roster?.tiers?.[tier]?.personas || []),
    [roster]
  );

  const openPersona = async (id: string) => {
    setError("");
    try {
      const response = await fetch("/api/node-gate/guild/persona/" + encodeURIComponent(id));
      setSelectedPersona(await readJson<PersonaDetail>(response));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to load persona details.");
    }
  };

  const convene = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (input.trim().length < 12) {
      setError("Provide at least 12 characters so the Guild has enough context.");
      return;
    }
    setRunning(true);
    setError("");
    setResult(null);
    try {
      const councilBody: Record<string, unknown> = { query_type: queryType };
      if (queryType === "FULL_GUILD") councilBody.max_size = 25;

      const councilResponse = await fetch("/api/node-gate/council/form", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(councilBody),
      });
      const formed = await readJson<FormedCouncil>(councilResponse);

      const deliberationResponse = await fetch("/api/node-gate/deliberate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: input.trim(),
          persona_ids: formed.council.map((persona) => persona.id),
          max_personas: formed.council_size,
        }),
      });
      setResult(await readJson<DeliberationResult>(deliberationResponse));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Guild deliberation failed.");
    } finally {
      setRunning(false);
    }
  };

  const providerMode = health?.provider?.mode || "NOT_REPORTED";
  const providerLabel = health?.provider?.configured
    ? (health.provider.provider || "provider") + " / " + (health.provider.model || "configured model")
    : "Deterministic metadata fallback";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
        <div className="container flex items-center justify-between py-4">
          <Link href="/dashboard">
            <Button variant="ghost" className="gap-2 font-mono"><ArrowLeft className="h-4 w-4" /> DASHBOARD</Button>
          </Link>
          <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
            <Activity className="h-4 w-4 text-primary" /> AI-BI INTELLIGENCE NODE-GATE
          </div>
        </div>
      </header>

      <main className="container space-y-8 py-8">
        <section className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-muted-foreground">NGL // AI Guild Command Center</p>
            <h1 className="mt-2 text-3xl font-mono font-bold text-primary md:text-4xl">25-PERSONA GUILD GATE</h1>
            <p className="mt-2 max-w-2xl text-muted-foreground">Live roster, specialist dossiers, council formation and structured deliberation.</p>
          </div>
          <Button variant="outline" onClick={() => void loadGuild()} disabled={loading} className="gap-2 font-mono">
            <RefreshCw className={"h-4 w-4 " + (loading ? "animate-spin" : "")} /> REFRESH LIVE DATA
          </Button>
        </section>

        {error && <div role="alert" className="border border-destructive/40 bg-destructive/10 p-4 text-sm text-destructive">{error}</div>}

        <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Card><CardHeader className="pb-2"><CardTitle className="font-mono text-xs text-muted-foreground">ACTIVE ROSTER</CardTitle></CardHeader><CardContent className="text-3xl font-mono font-bold">{loading ? "…" : roster?.total_personas ?? "—"}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="font-mono text-xs text-muted-foreground">COMMAND / SPECIALIST / EXECUTOR</CardTitle></CardHeader><CardContent className="text-xl font-mono font-bold">{stats ? stats.guild.tiers.COMMAND + " / " + stats.guild.tiers.SPECIALIST + " / " + stats.guild.tiers.EXECUTOR : "—"}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="font-mono text-xs text-muted-foreground">HEURISTICS / TRIGGERS</CardTitle></CardHeader><CardContent className="text-xl font-mono font-bold">{stats ? stats.guild.total_heuristics + " / " + stats.guild.total_triggers : "—"}</CardContent></Card>
          <Card><CardHeader className="pb-2"><CardTitle className="font-mono text-xs text-muted-foreground">PROVIDER STATUS</CardTitle></CardHeader><CardContent className="text-sm font-mono font-bold">{providerMode}<p className="mt-1 text-xs font-normal text-muted-foreground">{providerLabel}</p></CardContent></Card>
        </section>

        <section className="grid grid-cols-1 gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card>
            <CardHeader><CardTitle className="flex items-center gap-2 font-mono"><Users className="h-5 w-5 text-primary" /> GUILD ROSTER</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {loading && <p className="text-sm text-muted-foreground">Loading live roster…</p>}
              {TIERS.map((tier) => {
                const group = roster?.tiers?.[tier];
                return (
                  <section key={tier} className="space-y-3">
                    <div className="flex items-center justify-between border-b border-border pb-2">
                      <div><h2 className="font-mono font-semibold">{tier}</h2><p className="text-xs text-muted-foreground">{group?.description}</p></div>
                      <span className="font-mono text-sm text-muted-foreground">{group?.count ?? 0}</span>
                    </div>
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                      {(group?.personas || []).map((persona) => (
                        <button key={persona.id} type="button" onClick={() => void openPersona(persona.id)} className="rounded-md border border-border p-3 text-left transition-colors hover:border-primary/60 hover:bg-primary/5">
                          <span className="block font-semibold">{persona.name}</span>
                          <span className="mt-1 block text-xs text-muted-foreground">{persona.domain}</span>
                          <span className="mt-2 block font-mono text-[10px] text-primary">{persona.id}</span>
                        </button>
                      ))}
                    </div>
                  </section>
                );
              })}
              {!loading && personas.length === 0 && <p className="text-sm text-muted-foreground">No roster returned by the upstream service.</p>}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader><CardTitle className="flex items-center gap-2 font-mono"><BrainCircuit className="h-5 w-5 text-primary" /> PERSONA DOSSIER</CardTitle></CardHeader>
              <CardContent>
                {!selectedPersona ? <p className="text-sm text-muted-foreground">Select a persona from the live roster to inspect its full dossier.</p> : (
                  <div className="space-y-3">
                    <div><h2 className="text-xl font-semibold">{selectedPersona.persona.name}</h2><p className="text-sm text-muted-foreground">{selectedPersona.persona.archetype} · {selectedPersona.persona.tier}</p></div>
                    <p className="text-sm">{selectedPersona.persona.domain_focus?.primary}</p>
                    <p className="font-mono text-xs text-muted-foreground">Authority {selectedPersona.authority_level} · {selectedPersona.domain}</p>
                    <div><h3 className="mb-1 text-xs font-mono text-muted-foreground">CORE HEURISTICS</h3><ul className="list-disc space-y-1 pl-5 text-sm">{(selectedPersona.persona.core_heuristics || []).map((item, index) => <li key={index}>{item}</li>)}</ul></div>
                    <div><h3 className="mb-1 text-xs font-mono text-muted-foreground">KNOWN BIASES</h3><ul className="list-disc space-y-1 pl-5 text-sm">{(selectedPersona.persona.epistemic_biases?.known || []).map((item, index) => <li key={index}>{item}</li>)}</ul></div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="font-mono">CONVENE THE GUILD</CardTitle></CardHeader>
              <CardContent>
                <form onSubmit={convene} className="space-y-4">
                  <label className="block space-y-2 text-sm">
                    <span className="font-mono text-xs text-muted-foreground">COUNCIL CONFIGURATION</span>
                    <select value={queryType} onChange={(event) => setQueryType(event.target.value as QueryType)} className="w-full rounded-md border border-border bg-background p-3">
                      {QUERY_TYPES.map((type) => <option key={type} value={type}>{type === "FULL_GUILD" ? "FULL GUILD — ALL 25" : type}</option>)}
                    </select>
                  </label>
                  <label className="block space-y-2 text-sm">
                    <span className="font-mono text-xs text-muted-foreground">MATTER FOR DELIBERATION</span>
                    <textarea value={input} onChange={(event) => setInput(event.target.value)} minLength={12} required rows={5} placeholder="Describe the question or decision for the Guild…" className="w-full resize-y rounded-md border border-border bg-background p-3" />
                  </label>
                  {queryType === "FULL_GUILD" && <p className="text-xs text-muted-foreground">Full Guild mode requests all 25 personas. With a live provider configured, this can generate 25 initial model calls plus bounded challenge exchanges. Without one, the upstream labels its deterministic fallback explicitly.</p>}
                  <Button type="submit" disabled={running || loading || input.trim().length < 12} className="w-full gap-2 font-mono">
                    <Users className="h-4 w-4" /> {running ? "DELIBERATION RUNNING…" : queryType === "FULL_GUILD" ? "CONVENE ALL 25 PERSONAS" : "FORM AND CONVENE COUNCIL"}
                  </Button>
                </form>
              </CardContent>
            </Card>
          </div>
        </section>

        {result && (
          <Card>
            <CardHeader><CardTitle className="font-mono">DELIBERATION RESULT</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-3 text-xs font-mono">
                <span className="rounded border border-border px-2 py-1">MODE: {result.deliberation?.deliberation_mode || "NOT_REPORTED"}</span>
                <span className="rounded border border-border px-2 py-1">COUNCIL: {result.council?.personas?.length ?? "—"} PERSONAS</span>
                <span className="rounded border border-border px-2 py-1">PRIMARY: {result.council?.primary || "—"}</span>
              </div>
              {result.deliberation?.perspectives?.map((perspective, index) => (
                <details key={perspective.persona + "-" + index} className="rounded-md border border-border p-3">
                  <summary className="cursor-pointer font-semibold">{perspective.persona} <span className="ml-2 text-xs font-normal text-muted-foreground">{perspective.provenance?.evidence_class || "PROVENANCE NOT REPORTED"}</span></summary>
                  <p className="mt-3 text-sm">{perspective.response?.reasoning_summary || "No reasoning summary returned."}</p>
                  <ul className="mt-2 list-disc space-y-1 pl-5 text-sm">{(perspective.response?.claims || []).map((claim, claimIndex) => <li key={claimIndex}>{claim.statement} <span className="text-xs text-muted-foreground">({Math.round(claim.confidence * 100)}% confidence)</span></li>)}</ul>
                </details>
              ))}
              {!!result.deliberation?.disagreements?.length && <div><h3 className="mb-2 font-mono text-sm">UNRESOLVED DISAGREEMENTS</h3><pre className="overflow-x-auto rounded bg-muted p-3 text-xs">{JSON.stringify(result.deliberation.disagreements, null, 2)}</pre></div>}
              <details><summary className="cursor-pointer font-mono text-xs">RAW RESPONSE / PROTOCOL TRACE</summary><pre className="mt-2 max-h-[32rem] overflow-auto rounded bg-muted p-3 text-xs">{JSON.stringify(result, null, 2)}</pre></details>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
