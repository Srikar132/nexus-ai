
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import PromptInput from "@/components/prompt-input";
import { Zap } from "lucide-react";

const quickStartItems = [
  { label: "Todo App", icon: "✓" },
  { label: "Blog Platform", icon: "✍" },
  { label: "CRM Dashboard", icon: "📊" },
  { label: "E-commerce Store", icon: "🛒" },
];

const HomePage = () => {
  return (
    <div className="tech-grid flex flex-col max-h-full overflow-hidden items-center justify-center flex-1 w-full px-4 py-16 gap-10">
      {/* Pipeline Badge */}
      <div className="flex justify-center">
        <Badge
          variant="secondary"
          className="gap-2 px-4 py-1.5 rounded-full border border-border/60 bg-muted/60 backdrop-blur-sm"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-60" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-primary" />
          </span>
          <span className="text-xs font-semibold tracking-widest uppercase text-muted-foreground">
            Pipeline Active
          </span>
        </Badge>
      </div>

      {/* Heading */}
      <div className="text-center space-y-4 max-w-2xl">
        <h1 className="text-4xl sm:text-5xl font-bold tracking-tight leading-[1.15]">
          What do you want to{" "}
          <span className="gradient-text">ship today?</span>
        </h1>
        {/* <p className="text-muted-foreground text-base leading-relaxed max-w-lg mx-auto">
          Describe your vision. Our autonomous agents will architect, build, and
          deploy your full-stack application instantly.
        </p> */}
      </div>

      {/* Input */}
      <div className="w-full max-w-2xl">
        <PromptInput />
      </div>

      {/* Quick Start */}
      <div className="flex flex-col items-center gap-3">
        <p className="text-xs text-muted-foreground/60 tracking-wider uppercase font-medium">
          Quick start
        </p>
        <div className="flex items-center justify-center gap-2 flex-wrap">
          {quickStartItems.map((item) => (
            <Button
              key={item.label}
              variant="secondary"
              size="sm"
              className="
                rounded-full border border-border/60 bg-muted/50
                hover:bg-muted hover:border-border
                text-muted-foreground hover:text-foreground
                gap-1.5 text-sm transition-all duration-200
                hover:scale-[1.02] active:scale-[0.98]
              "
            >
              <span className="text-xs">{item.icon}</span>
              {item.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Footer hint */}
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground/40">
        <Zap className="h-3 w-3" />
        <span>Powered by autonomous AI agents</span>
      </div>
    </div>
  );
};

export default HomePage;