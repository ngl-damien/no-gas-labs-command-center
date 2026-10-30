import { Button } from "@/components/ui/button";
import { Link } from "wouter";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Terminal, Shield, Cpu, Globe, ArrowRight, Activity } from "lucide-react";
import { Streamdown } from 'streamdown';
import { useEffect, useState } from "react";
import {
  parseCapabilityRecords,
  summarizeCapabilityHealth,
  type CapabilityHealthState,
} from "@/lib/capability-health";

export default function Home() {
  const [capabilityState, setCapabilityState] = useState<CapabilityHealthState>("CHECKING");

  useEffect(() => {
    let active = true;

    const probeCapabilities = async () => {
      try {
        const response = await fetch("/api/capabilities", {
          headers: { Accept: "application/json" },
        });
        if (!response.ok) throw new Error("CAPABILITY_STATUS_HTTP_ERROR");

        const records = parseCapabilityRecords(await response.json());
        if (records === null) throw new Error("CAPABILITY_STATUS_INVALID");
        if (active) setCapabilityState(summarizeCapabilityHealth(records));
      } catch {
        if (active) setCapabilityState("UNKNOWN");
      }
    };

    void probeCapabilities();
    const interval = window.setInterval(() => { void probeCapabilities(); }, 30000);
    return () => {
      active = false;
      window.clearInterval(interval);
    };
  }, []);

  const capabilityLabels: Record<CapabilityHealthState, string> = {
    CHECKING: "Checking upstreams",
    OPERATIONAL: "Upstreams operational",
    DEGRADED: "Upstreams degraded",
    UNAVAILABLE: "Upstreams unavailable",
    UNKNOWN: "Upstream status unavailable",
  };
  const capabilityTextClass =
    capabilityState === "OPERATIONAL"
      ? "text-secondary"
      : capabilityState === "UNAVAILABLE"
      ? "text-destructive"
      : "text-primary";
  const capabilityDotClass =
    capabilityState === "OPERATIONAL"
      ? "bg-secondary"
      : capabilityState === "UNAVAILABLE"
      ? "bg-destructive"
      : "bg-primary";

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground font-sans selection:bg-primary selection:text-primary-foreground">
      
      {/* Hero Section */}
      <header className="relative w-full h-[90vh] flex items-center justify-center overflow-hidden border-b border-border">
        <div className="absolute inset-0 z-0">
          <img 
            src="/images/hero-bg.jpg" 
            alt="No_Gas_Labs Command Center" 
            className="w-full h-full object-cover opacity-40"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-transparent via-background/80 to-background"></div>
          <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-10"></div>
        </div>

        <div className="container relative z-10 flex flex-col items-center text-center max-w-4xl px-4">
          <div
            role="status"
            aria-live="polite"
            className={`mb-6 inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/30 bg-primary/10 ${capabilityTextClass} text-xs font-mono tracking-wider uppercase`}
          >
            <span className={`w-2 h-2 rounded-full ${capabilityDotClass} ${capabilityState === "CHECKING" ? "animate-ping" : ""}`}></span>
            UPSTREAM STATUS: {capabilityLabels[capabilityState]}
          </div>
          
          <h1 className="text-5xl md:text-7xl font-mono font-bold tracking-tighter mb-6 glitch-text">
            <span className="text-primary">No_Gas_Labs™</span> <br />
            <span className="text-foreground">Command Center</span>
          </h1>
          
          <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mb-10 leading-relaxed">
            Coordinating human intention with distributed technical systems.
            <br />
            <span className="text-secondary font-mono text-sm mt-2 block">
              [TEMPORAL LOOP CLOSURE RECOGNIZED]
            </span>
          </p>

          <div className="flex flex-col sm:flex-row gap-4 w-full justify-center">
            <Link href="/dashboard">
              <Button size="lg" className="font-mono text-lg px-8 py-6 bg-primary text-primary-foreground hover:bg-primary/90 border-none rounded-none skew-x-[-10deg]">
                <span className="skew-x-[10deg]">INITIATE PROTOCOL</span>
              </Button>
            </Link>
            <Link href="/manifesto">
              <Button size="lg" variant="outline" className="font-mono text-lg px-8 py-6 border-primary text-primary hover:bg-primary/10 rounded-none skew-x-[-10deg]">
                <span className="skew-x-[10deg]">READ MANIFESTO</span>
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* The Announcement (Damie's Launch) */}
      <section className="py-24 border-b border-border bg-card/30">
        <div className="container max-w-3xl mx-auto">
          <div className="terminal-header text-2xl mb-8">
            &gt; INCOMING_TRANSMISSION: ORIGIN_DAMIE
          </div>
          
          <div className="prose prose-invert prose-lg max-w-none font-sans">
            <p className="text-2xl font-light leading-relaxed mb-8 border-l-4 border-secondary pl-6 italic text-muted-foreground">
              "Thank you to everyone who wished me a happy birthday—friends, old ghosts, and even people I’ve never met. Your messages landed; I receive them."
            </p>

            <div className="space-y-6 text-lg">
              <p>
                My birthday wish this year isn’t for me.
              </p>
              <p className="text-3xl font-bold text-primary font-mono">
                It’s a campaign.
              </p>
              <p>
                From today on, I’m treating this next chapter as an open campaign for the world I want. This is my announcement.
              </p>
              <p>
                If you’ve ever wished me well, you’re already part of this story. Stay tuned—what I do from here is my way of saying thank you.
              </p>
            </div>
            
            <div className="mt-12 p-6 border border-dashed border-border bg-background/50 font-mono text-sm text-muted-foreground">
              <div className="flex items-center gap-2 mb-2 text-secondary">
                <Activity className="w-4 h-4" />
                <span>CAMPAIGN_METADATA</span>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>DATE: JAN 06 2026</div>
                <div>TYPE: STRUCTURAL_LEADERSHIP</div>
                <div>STATUS: ACTIVE</div>
                <div>VECTOR: RECURSIVE_REPUBLIC</div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Core Modules Grid */}
      <section className="py-24 bg-background relative">
        <div className="absolute inset-0 bg-[url('/grid-pattern.svg')] opacity-5"></div>
        <div className="container relative z-10">
          <div className="flex items-center justify-between mb-16">
            <h2 className="text-3xl font-mono font-bold flex items-center gap-3">
              <Terminal className="w-8 h-8 text-primary" />
              SYSTEM_MODULES
            </h2>
            <div className="h-px flex-1 bg-border ml-8"></div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Module 1 */}
            <Card className="cyber-card group">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 font-mono text-xl">
                  <Shield className="w-6 h-6 text-secondary" />
                  ADVERSARIAL_HARDENING
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Language designed to withstand misinterpretation, ideological capture, and hype decay.
                </p>
                <ul className="space-y-2 font-mono text-sm text-primary/80">
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-primary rounded-full"></span>
                    Density != Volume
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-primary rounded-full"></span>
                    Explicit Limits
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-primary rounded-full"></span>
                    Public Documentation
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Module 2 */}
            <Card className="cyber-card group">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 font-mono text-xl">
                  <Cpu className="w-6 h-6 text-secondary" />
                  DISTRIBUTED_INTELLIGENCE
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  Coordinating human intention with technical systems. No single point of epistemic authority.
                </p>
                <ul className="space-y-2 font-mono text-sm text-primary/80">
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-primary rounded-full"></span>
                    Partial Competence
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-primary rounded-full"></span>
                    Feedback Loops
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-primary rounded-full"></span>
                    Evidence &gt; Belief
                  </li>
                </ul>
              </CardContent>
            </Card>

            {/* Module 3 */}
            <Card className="cyber-card group">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 font-mono text-xl">
                  <Globe className="w-6 h-6 text-secondary" />
                  OPEN_CAMPAIGN
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground mb-4">
                  A public ledger of decisions, not a promise of outcomes. A test of infrastructure.
                </p>
                <ul className="space-y-2 font-mono text-sm text-primary/80">
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-primary rounded-full"></span>
                    Observe
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-primary rounded-full"></span>
                    Replicate
                  </li>
                  <li className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-primary rounded-full"></span>
                    Critique
                  </li>
                </ul>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Manifesto Excerpt */}
      <section className="py-24 border-t border-border bg-card/20">
        <div className="container max-w-4xl">
          <div className="flex flex-col md:flex-row gap-12 items-start">
            <div className="flex-1">
              <h3 className="text-2xl font-mono font-bold mb-6 text-primary">
                &gt; THE_MANIFESTO.TXT
              </h3>
              <div className="prose prose-invert max-w-none text-muted-foreground">
                <p>
                  High-attention moments are not power. They are stress tests. When attention spikes, language is placed under load. Words that were previously inert become contested.
                </p>
                <p>
                  The question is not how to control interpretation, but how to design language that survives contact with adversarial reading.
                </p>
                <p>
                  This document exists for that purpose.
                </p>
              </div>
              <Link href="/manifesto">
                <Button variant="link" className="mt-6 text-secondary p-0 h-auto font-mono hover:text-secondary/80 group">
                  ACCESS_FULL_DOCUMENT <ArrowRight className="w-4 h-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </Button>
              </Link>
            </div>
            <div className="w-full md:w-1/3">
              <div className="aspect-square bg-black border border-border relative overflow-hidden group">
                <img 
                  src="/images/security-shield.jpg" 
                  alt="Security Shield" 
                  className="w-full h-full object-cover opacity-60 group-hover:opacity-80 transition-opacity duration-500"
                />
                <div className="absolute bottom-0 w-full p-4 bg-gradient-to-t from-black to-transparent">
                  <div className="font-mono text-xs text-secondary">SECURE_PROTOCOL_V1</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="py-12 border-t border-border bg-background text-center">
        <div className="container">
          <div className="font-mono text-sm text-muted-foreground">
            NO_GAS_LABS™ // RECURSIVE REPUBLIC // EST. 2026
          </div>
        </div>
      </footer>
    </div>
  );
}
