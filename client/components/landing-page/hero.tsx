import { HeroHeader } from "./hero-header";
import { AgentSquads } from "./agent-squads";
import { ConductorCard } from "./conductor-card";
import { ProductPreview } from "./product-preview";
import { FeaturesPillars } from "./features-pillars";
import { AgentShowcase } from "./agent-showcase";
import { CodeReviewSection } from "./code-review-section";

export function Hero() {
  return (
    <section className="relative flex flex-col overflow-hidden">
      {/* ── Animated background (GPU-composited) ── */}
      <div className="absolute inset-0 hero-mesh-gradient will-change-transform" />

      {/* Grid overlay — static, no blur */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.02)_1px,transparent_1px)] bg-size-[72px_72px] mask-[radial-gradient(ellipse_at_center,black_30%,transparent_80%)]" />

      {/* Lightweight ambient orbs — reduced size & blur */}
      <div className="absolute top-20 left-[15%] w-48 h-48 bg-primary/6 rounded-full blur-3xl hero-orb-1 will-change-transform" />
      <div className="absolute top-40 right-[10%] w-56 h-56 bg-primary/4 rounded-full blur-3xl hero-orb-2 will-change-transform" />
      <div className="absolute bottom-32 left-[30%] w-52 h-52 bg-primary/5 rounded-full blur-3xl hero-orb-3 will-change-transform" />

      {/* ── Sections ── */}
      <HeroHeader />
      <AgentSquads />
      <ConductorCard />
      <ProductPreview />
      <FeaturesPillars />
      <AgentShowcase />
      <CodeReviewSection />
    </section>
  );
}