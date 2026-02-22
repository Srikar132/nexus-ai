import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Mic, ArrowUp } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const quickStartItems = [
  "Todo App",
  "Blog Platform",
  "CRM Dashboard",
  "E-commerce Store",
];

const HomePage = () => {

  return (
    <div className="max-w-4xl mx-auto space-y-2  flex-1">
      {/* Pipeline Status Badge */}
      <div className="flex justify-center pt-4">
        <Badge variant="secondary" className="gap-2 px-4 py-1.5">
          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
          <span className="text-xs font-medium">PIPELINE ACTIVE</span>
        </Badge>
      </div>

      {/* Main Heading */}
      <div className="text-center space-y-4">
        <h1 className="text-3xl font-bold">
          What do you want to{" "}
          <span className="gradient-text">ship today?</span>
        </h1>
        <p className="text-muted-foreground text-sm max-w-2xl mx-auto">
          Describe your vision. Our autonomous agents will architect, build, and
          deploy your full-stack application instantly.
        </p>
      </div>

      {/* Input Card */}
      <div className="w-full max-w-3xl mx-auto">
        <div className="flex items-center gap-3 bg-muted/50 rounded-full px-4 py-3 border border-border/50">
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted">
            <div className="w-4 h-4 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M8 3V13M3 8H13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
              </svg>
            </div>
          </Button>
          
          <Textarea
            placeholder="Ask anything"
            rows={3}
            className="flex-1 bg-transparent border-0 outline-none text-base placeholder:text-muted-foreground resize-none overflow-y-auto max-h-[4.5rem] min-h-[1.5rem] scrollbar-none"
            style={{
              scrollbarWidth: 'none',
              msOverflowStyle: 'none'
            }}
          />
          
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-muted">
              <Mic className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full bg-gray-500 hover:bg-green-600">
              <ArrowUp className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Start Templates */}
      <div className="flex items-center justify-center gap-3 flex-wrap">
        {quickStartItems.map((item) => (
          <Button
            key={item}
            variant="secondary"
            size="sm"
            className="rounded-full"
          >
            {item}
          </Button>
        ))}
      </div>
    </div>
  );
};

export default HomePage;