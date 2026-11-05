import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft, Activity, Server, User } from "lucide-react";
import { Link } from "wouter";
import { useEffect, useState } from "react";
import { NodeGatePanel } from "@/components/NodeGatePanel";
import { useNodeGate } from "@/hooks/useNodeGate";

/**
 * Capability-health screen (§3): every intended upstream is probed through
 * the real /api/capabilities endpoint. The screen never claims more
 * capability than what is actually running — an unreachable upstream is
 * reported as UNAVAILABLE, not hidden behind a hardcoded status.
 */
interface Capability {
  id: string;
  name: string;
  kind: string;
  url: string;
  status: string;
  detail: unknown;
  probed_at: string;
}

function CapabilityStatus({ status }: { status: string }) {
  const color =
    status === "OPERATIONAL"
      ? "bg-green-500"
      : status === "DEGRADED"
      ? "bg-yellow-500"
      : "bg-red-500";
  return (
    <span className="flex items-center gap-2 font-mono text-xs">
      <span className={`w-2 h-2 rounded-full ${color} animate-pulse`} />
      {status}
    </span>
  );
}

export default function Dashboard() {
  const { isHealthy, checkHealth } = useNodeGate();
  const [capabilities, setCapabilities] = useState<Capability[] | null>(null);

  const probeCapabilities = async () => {
    try {
      const response = await fetch("/api/capabilities");
      const data = await response.json();
      setCapabilities(Array.isArray(data.capabilities) ? data.capabilities : []);
    } catch {
      setCapabilities([]);
    }
  };

  useEffect(() => {
    checkHealth();
    probeCapabilities();
    const interval = setInterval(() => {
      checkHealth();
      probeCapabilities();
    }, 30000);
    return () => clearInterval(interval);
  }, [checkHealth]);

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground">

      {/* Header */}
      <header className="border-b border-border bg-card/30 sticky top-0 z-50 backdrop-blur-md">
        <div className="container py-4 flex items-center justify-between">
          <Link href="/">
            <Button variant="ghost" className="font-mono text-muted-foreground hover:text-primary gap-2">
              <ArrowLeft className="w-4 h-4" /> RETURN_TO_COMMAND
            </Button>
          </Link>
          <div
            className={`font-mono text-sm flex items-center gap-2 ${
              isHealthy ? "text-secondary" : "text-destructive"
            }`}
          >
            <Activity className="w-3 h-3" />
            NODE_GATE: {isHealthy ? "OPERATIONAL" : "OFFLINE"}
          </div>
        </div>
      </header>

      <main className="flex-1 py-8">
        <div className="container">

          <div className="mb-8 flex items-end justify-between">
            <div>
              <h1 className="text-3xl font-mono font-bold tracking-tight text-primary mb-2">
                PROTOCOL_DASHBOARD
              </h1>
              <p className="text-muted-foreground font-mono text-sm">
                Capability health and live intelligence routing.
              </p>
            </div>
            <div className="text-right font-mono text-xs text-muted-foreground hidden md:block">
              PROBE_INTERVAL: 30s<br />
              SOURCE: /api/capabilities
            </div>
          </div>

          {/* Capability Health Screen (§3) */}
          <div className="mb-8">
            <Card className="bg-card/50 border-border">
              <CardHeader>
                <CardTitle className="font-mono text-lg flex items-center gap-2">
                  <Server className="w-5 h-5 text-primary" />
                  CAPABILITY_HEALTH
                </CardTitle>
              </CardHeader>
              <CardContent>
                {capabilities === null ? (
                  <div className="font-mono text-sm text-muted-foreground">
                    Probing upstreams…
                  </div>
                ) : capabilities.length === 0 ? (
                  <div className="font-mono text-sm text-destructive">
                    No capabilities reachable. Start Node-Gate and EvidenceOS,
                    confirm NODE_GATE_URL and EVIDENCEOS_URL, then reload.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {capabilities.map((cap) => (
                      <div
                        key={cap.id}
                        className="flex flex-col md:flex-row md:items-center justify-between gap-2 border-b border-border/50 pb-3 last:border-0"
                      >
                        <div className="font-mono text-sm">
                          <span className="text-foreground">{cap.name}</span>
                          <span className="text-muted-foreground text-xs ml-2">
                            {cap.url}
                          </span>
                        </div>
                        <CapabilityStatus status={cap.status} />
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Live Node-Gate Intervention Panel (real upstream, no simulation) */}
          <div className="mb-8">
            <NodeGatePanel />
          </div>

          {/* Assessment link */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Link href="/assessment">
              <Card className="bg-card/50 border-border hover:bg-card/80 transition-colors cursor-pointer group h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium font-mono text-muted-foreground group-hover:text-primary transition-colors">
                    SUBJECT_ASSESSMENT
                  </CardTitle>
                  <User className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">LATEST</div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Autobio-Social Audit
                  </p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/guild">
              <Card className="bg-card/50 border-border hover:bg-card/80 transition-colors cursor-pointer group h-full">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium font-mono text-muted-foreground group-hover:text-primary transition-colors">
                    25_PERSONA_GUILD
                  </CardTitle>
                  <Activity className="h-4 w-4 text-primary" />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold font-mono">FULL_GUILD</div>
                  <p className="text-xs text-muted-foreground mt-1">Roster, persona dossiers and live council deliberation</p>
                </CardContent>
              </Card>
            </Link>
          </div>

        </div>
      </main>
    </div>
  );
}
