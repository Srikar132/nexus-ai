import { Layers, Bot, Zap } from "lucide-react";
import Image from "next/image";

const pillars = [
    {
        figure: "FIG 0.1",
        icon: Layers,
        title: "Built on agent squads",
        description:
            "Every project is powered by specialized squads — each with planners, coders, reviewers, and testers that collaborate and self-correct in real time.",
        image: "/landing-page/image1.png",
    },
    {
        figure: "FIG 0.2",
        icon: Bot,
        title: "Powered by AI orchestration",
        description:
            "A conductor agent routes tasks, resolves conflicts between squads, and maintains shared memory — from drafting specs to pushing production code.",
        image: "/landing-page/image2.png",
    },
    {
        figure: "FIG 0.3",
        icon: Zap,
        title: "Designed for velocity",
        description:
            "Reduces bottlenecks and restores momentum. Ship entire features autonomously — build, secure, deploy, and monitor — in a single prompt.",
        image: "/landing-page/image3.png",
    },
];

export function FeaturesPillars() {
    return (
        <div className="relative z-10 px-4 py-24 sm:py-32">
            <div className="max-w-7xl mx-auto">
                {/* ── Heading ── */}
                <h2 className="text-3xl sm:text-3xl md:text-5xl lg:text-[3.5rem] font-bold  tracking-tight max-w-5xl">
                    <span className="text-foreground">A new kind of dev platform. </span>
                    <span className="text-muted-foreground">
                        Purpose-built for autonomous engineering with AI agent squads at its
                        core.
                    </span>
                </h2>

                {/* ── Three-column pillars ── */}
                <div className="mt-20 grid grid-cols-1 md:grid-cols-3 gap-0 border-t border-border/40">
                    {pillars.map((pillar, i) => (
                        <div
                            key={pillar.figure}
                            className={`relative flex flex-col pt-8 pb-10 ${i < pillars.length - 1 ? "md:border-r border-border/40" : ""
                                } ${i > 0 ? "md:pl-10" : ""} ${i < pillars.length - 1 ? "md:pr-10" : ""
                                } ${i > 0 ? "border-t md:border-t-0 border-border/40" : ""}`}
                        >
                            {/* Figure label */}
                            <span className="text-[11px] uppercase tracking-[0.2em] text-muted-foreground/50 font-mono mb-8">
                                {pillar.figure}
                            </span>

                            {/* Illustration placeholder */}
                            <div className="relative w-full aspect-square max-w-70 mb-10">
                                <div className="absolute inset-0 flex items-center justify-center rounded-xl border border-border/20 bg-card/20">
                                    {/* Replace with actual image — uncomment Image below */}
                                    <Image
                                        src={pillar.image}
                                        alt={pillar.title}
                                        fill
                                        className="object-contain p-4"
                                    />
                                    <div className="flex flex-col items-center gap-3 text-center px-6">
                                        <div className="w-14 h-14 rounded-xl border border-border/30 bg-primary/5 flex items-center justify-center">
                                            <pillar.icon className="h-7 w-7 text-primary/40" />
                                        </div>
                                        <p className="text-xs text-muted-foreground/30 font-medium">
                                            Illustration placeholder
                                        </p>
                                    </div>
                                </div>
                            </div>

                            {/* Title + description */}
                            <h3 className="text-base font-bold text-foreground mb-2">
                                {pillar.title}
                            </h3>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                                {pillar.description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
