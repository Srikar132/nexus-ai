"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Lightbulb, Loader2, Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useVoiceRecording } from "@/hooks/use-voice-recording";
import { QuickStart } from "./quick-start";
import Typewriter from "typewriter-effect";
import projectServices from "@/lib/services/project-services";

// ─── Constants ───────────────────────────────────────────────────────────────
const PLACEHOLDER_PHRASES = [
  "Build me a SaaS dashboard with auth...",
  "Create a real-time chat application...",
  "Design a full-stack e-commerce store...",
  "Build a CRM with analytics and reports...",
  "Create a blog platform with MDX support...",
  "Build a todo app with team collaboration...",
];

const MODELS = [
  { value: "gpt-4", label: "GPT-4" },
  { value: "gpt-3.5-turbo", label: "GPT-3.5" },
  { value: "claude-3-opus", label: "Claude 3" },
  { value: "claude-3-sonnet", label: "Claude 3.5" },
  { value: "gemini-pro", label: "Gemini" },
];

// ─── Component ───────────────────────────────────────────────────────────────

function PromptInput({ onExternalPrompt }: { onExternalPrompt?: (fn: (p: string) => void) => void }) {
  const [value, setValue] = useState("");
  const [selectedModel, setSelectedModel] = useState("gpt-4");

  useEffect(() => {
    onExternalPrompt?.((prompt) => {
      setValue(prompt);
    });
  }, [onExternalPrompt]);

  const [isFocused, setIsFocused] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  // Web search state
  const [webSearchEnabled, setWebSearchEnabled] = useState(true);

  // Auto-resize textarea as content grows
  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  }, []);

  // Voice recording hook
  const { isRecording, micError, startRecording, stopRecording } =
    useVoiceRecording({
      onTranscript: (text) => setValue(text),
      onResize: autoResize,
    });

  // Build project and navigate
  const handleBuildProject = useCallback(async () => {
    const prompt = value.trim();
    if (!prompt || isBuilding) return;

    stopRecording();
    setIsBuilding(true);

    try {
      const project = await projectServices.createProject({
        userPrompt: prompt
      });

      localStorage.setItem(
        `project-${project.id}-initial-prompt`,
        JSON.stringify({ prompt, autoSend: true, timestamp: Date.now() })
      );

      router.push(`/project/${project.id}`);
  
    } catch (error) {
      console.error("Failed to create project:", error);
    } finally {
      setValue("");
      setIsBuilding(false);
    }
  }, [value, isBuilding, router, stopRecording]);

  return (
    <div className="w-full max-w-2xl mx-auto">
      {/* Card */}
      <div
        className={`
          relative rounded-2xl border bg-card p-4 flex flex-col gap-4
          transition-all duration-300 ease-out
          ${isFocused
            ? "border-primary/40 shadow-[0_0_0_1px_oklch(0.61_0.225_280/20%),0_8px_32px_oklch(0_0_0/40%)]"
            : "border-border shadow-[0_4px_24px_oklch(0_0_0/25%)]"
          }
        `}
      >
        {/* Textarea */}
        <div className="relative min-h-20">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(e) => {
              setValue(e.target.value);
              autoResize();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleBuildProject();
              }
            }}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            rows={3}
            className="
              w-full resize-none border-none outline-none ring-0 shadow-none
              bg-transparent text-foreground text-[15px] leading-relaxed
              min-h-20 max-h-50 scrollbar-none p-0 relative z-10
            "
          />

          {/* Typewriter placeholder */}
          {!value && (
            <div className="absolute inset-0 pointer-events-none flex items-start">
              <span className="text-[15px] leading-relaxed text-muted-foreground">
                <Typewriter
                  options={{
                    strings: PLACEHOLDER_PHRASES,
                    autoStart: true,
                    loop: true,
                    delay: 50,
                    deleteSpeed: 30,
                  }}
                />
              </span>
            </div>
          )}
        </div>

        {/* Bottom row */}
        <div className="flex items-center justify-between gap-2">

          {/* Left — model select + mic */}
          <div className="flex items-center gap-1">
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="h-8 w-auto min-w-25 px-2 rounded-xl border-none bg-transparent hover:bg-accent text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {MODELS.map((model) => (
                  <SelectItem key={model.value} value={model.value} className="text-xs">
                    {model.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* Mic button with pulse ring */}
            <div className="relative flex items-center justify-center h-8 w-8">
              {/* Pulse ring — only visible when recording */}
              {isRecording && (
                <span className="absolute inset-0 rounded-full bg-primary opacity-30 animate-pulse" />
              )}
              <button
                onClick={isRecording ? stopRecording : startRecording}
                className={`
                  relative z-10 h-8 w-8 rounded-xl flex items-center justify-center
                  transition-colors
                  ${isRecording
                    ? "text-primary"
                    : micError
                      ? "text-red-400"
                      : "text-muted-foreground hover:text-foreground hover:bg-accent"
                  }
                `}
                aria-label={isRecording ? "Stop recording" : "Start recording"}
              >
                <Mic className="h-4 w-4" />
              </button>
            </div>

            {/* Mic error label */}
            {micError && (
              <span className="text-[11px] text-red-400 ml-1">Mic denied</span>
            )}
          </div>

          {/* Right — plan + build */}
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="sm"
              className="h-8 px-3 gap-1.5 text-sm rounded-xl"
            >
              <Lightbulb className="h-3.5 w-3.5" />
              Plan
            </Button>

            <Button
              size="sm"
              disabled={!value.trim() || isBuilding}
              onClick={handleBuildProject}
              className="
                h-8 px-4 rounded-xl font-semibold text-sm gap-1.5
                bg-primary hover:bg-primary/90 text-primary-foreground
                shadow-md transition-all duration-200
                hover:scale-[1.02] active:scale-[0.98]
                disabled:opacity-50 disabled:pointer-events-none
              "
            >
              {isBuilding ? (
                <>
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Building...
                </>
              ) : (
                <>
                  Build now
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </>
              )}
            </Button>
          </div>
        </div>
      </div>


      <QuickStart onSelectPrompt={(prompt) => setValue(prompt)} />
    </div>
  );
}

export default PromptInput;