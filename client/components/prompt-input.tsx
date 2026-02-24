"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Plus, ArrowUpRight, Lightbulb, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import projectServices from "@/lib/services/project-services";

const PLACEHOLDER_PHRASES = [
  "Build me a SaaS dashboard with auth...",
  "Create a real-time chat application...",
  "Design a full-stack e-commerce store...",
  "Build a CRM with analytics and reports...",
  "Create a blog platform with MDX support...",
  "Build a todo app with team collaboration...",
];



function useTypingPlaceholder(phrases: string[]) {
  const [displayed, setDisplayed] = useState("");
  const [phraseIdx, setPhraseIdx] = useState(0);
  const [charIdx, setCharIdx] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isPaused, setIsPaused] = useState(false);

  useEffect(() => {
    if (isPaused) return;

    const current = phrases[phraseIdx];

    const timeout = setTimeout(
      () => {
        if (!isDeleting) {
          if (charIdx < current.length) {
            setDisplayed(current.slice(0, charIdx + 1));
            setCharIdx((c) => c + 1);
          } else {
            setIsPaused(true);
            setTimeout(() => {
              setIsPaused(false);
              setIsDeleting(true);
            }, 1800);
          }
        } else {
          if (charIdx > 0) {
            setDisplayed(current.slice(0, charIdx - 1));
            setCharIdx((c) => c - 1);
          } else {
            setIsDeleting(false);
            setPhraseIdx((i) => (i + 1) % phrases.length);
          }
        }
      },
      isDeleting ? 28 : charIdx === 0 ? 500 : 42
    );

    return () => clearTimeout(timeout);
  }, [charIdx, isDeleting, isPaused, phraseIdx, phrases]);

  return displayed;
}

function PromptInput() {
  const [value, setValue] = useState("");
  const [isFocused, setIsFocused] = useState(false);
  const [isBuilding, setIsBuilding] = useState(false);
  const placeholder = useTypingPlaceholder(PLACEHOLDER_PHRASES);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const router = useRouter();

  const autoResize = useCallback(() => {
    const el = textareaRef.current;
    if (el) {
      el.style.height = "auto";
      el.style.height = Math.min(el.scrollHeight, 200) + "px";
    }
  }, []);

  const handleBuildProject = useCallback(async () => {
    const prompt = value.trim();
    if (!prompt || isBuilding) return;

    setIsBuilding(true);

    try {
      const project = await projectServices.createProject({
        name: prompt.slice(0, 100),
        description: prompt,
      });

      // Store the prompt in localStorage with the project ID as the key
      localStorage.setItem(`project-${project.id}-initial-prompt`, JSON.stringify({
        prompt,
        autoSend: true,
        timestamp: Date.now()
      }));

      router.push(`/project/${project.id}`);
    } catch (error) {
      console.error("Failed to create project:", error);
      setIsBuilding(false);
    }finally {
        setValue("");
        setIsBuilding(false);
    }
  }, [value, isBuilding, router]);

  return (
    <div className="w-full max-w-2xl mx-auto ">
      <div
        className={`
          relative rounded-2xl border bg-card p-4 flex flex-col gap-4
          transition-all duration-300 ease-out
          ${
            isFocused
              ? "border-primary/40 shadow-[0_0_0_1px_oklch(0.61_0.225_280/20%),0_8px_32px_oklch(0_0_0/40%)]"
              : "border-border shadow-[0_4px_24px_oklch(0_0_0/25%)]"
          }
        `}
      >
        {/* Textarea with animated placeholder */}
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
              bg-transparent text-foreground
              text-[15px] leading-relaxed
              min-h-20 max-h-50
              scrollbar-none p-0 relative z-10
            "
          />
          {/* Animated placeholder — only shown when empty */}
          {!value && (
            <div className="absolute inset-0 pointer-events-none flex items-start">
              <span className="text-[15px] leading-relaxed text-muted-foreground">
                {placeholder}
                <span
                  className="inline-block w-0.5 h-[1.1em] bg-primary/70 ml-0.5 align-text-bottom animate-[blink_1s_step-end_infinite]"
                  style={{
                    animation: "blink 1s step-end infinite",
                  }}
                />
              </span>
            </div>
          )}
        </div>

        {/* Bottom row */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-xl"
          >
            <Plus className="h-4 w-4" />
          </Button>

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
                bg-primary hover:bg-primary/90
                text-primary-foreground shadow-md
                transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]
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

      {/* Cursor blink keyframe */}
      <style>{`
        @keyframes blink {
          0%, 100% { opacity: 1; }
          50% { opacity: 0; }
        }
      `}</style>
    </div>
  );
}

export  default PromptInput;