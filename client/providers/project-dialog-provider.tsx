"use client";

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useActionState,
  ReactNode,
} from "react";
import { z } from "zod";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

// ─── Zod Schema ───────────────────────────────────────────────────────────────

const projectSchema = z.object({
  icon:        z.string().min(1, "Pick an icon"),
  name:        z.string().min(1, "Project name is required").max(100, "Max 100 characters"),
  description: z.string().max(500, "Max 500 characters").optional(),
});

type ProjectFormData = z.infer<typeof projectSchema>;

// ─── Form State ───────────────────────────────────────────────────────────────

interface FormState {
  errors: Partial<Record<keyof ProjectFormData, string>>;
  success: boolean;
}

const initialState: FormState = { errors: {}, success: false };

// ─── Emoji Options ────────────────────────────────────────────────────────────

const ICONS = ["🚀", "⚡", "🎯", "🛠️", "💡", "🔥", "📦", "🌐", "🎨", "🤖", "📊", "🔐"];

// ─── Context ──────────────────────────────────────────────────────────────────

interface ProjectDialogContextValue {
  open:  () => void;
  close: () => void;
}

const ProjectDialogContext = createContext<ProjectDialogContextValue | null>(null);

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useProjectDialog() {
  const ctx = useContext(ProjectDialogContext);
  if (!ctx) throw new Error("useProjectDialog must be used within ProjectDialogProvider");
  return ctx;
}

// ─── Provider ─────────────────────────────────────────────────────────────────

interface ProjectDialogProviderProps {
  children:        ReactNode;
}

export function ProjectDialogProvider({
  children,
}: ProjectDialogProviderProps) {
  const [isOpen,       setIsOpen]       = useState(false);
  const [selectedIcon, setSelectedIcon] = useState("🚀");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const open  = useCallback(() => setIsOpen(true),  []);
  const close = useCallback(() => setIsOpen(false), []);

  // ── Form Action ─────────────────────────────────────────────────────────────

  async function formAction(_prev: FormState, formData: FormData): Promise<FormState> {
    const raw = {
      icon:        selectedIcon,
      name:        formData.get("name")        as string,
      description: formData.get("description") as string,
    };

    const result = projectSchema.safeParse(raw);

    if (!result.success) {
      const errors: FormState["errors"] = {};
      result.error.issues.forEach((e) => {
        const field = e.path[0] as keyof ProjectFormData;
        errors[field] = e.message;
      });
      return { errors, success: false };
    }

    try {
      setIsSubmitting(true);
    //   await onCreateProject(result.data);
      setIsOpen(false);
      setSelectedIcon("🚀");
      return { errors: {}, success: true };
    } catch {
      return {
        errors: { name: "Failed to create project. Please try again." },
        success: false,
      };
    } finally {
      setIsSubmitting(false);
    }
  }

  const [state, action] = useActionState(formAction, initialState);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <ProjectDialogContext.Provider value={{ open, close }}>
      {children}

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-145 bg-card border-border p-0 overflow-hidden gap-0">

          {/* Header */}
          <DialogHeader className="px-6 pt-6 pb-2 border-b border-border">
            <DialogTitle className="text-base font-semibold text-foreground">
              New Project
            </DialogTitle>
          </DialogHeader>

          {/* Form */}
          <form action={action} className="flex flex-col">

            {/* Icon + Name row */}
            <div className="px-6 pt-5 pb-4">

              {/* Icon picker */}
              <div className="mb-4">
                <Label className="text-xs text-muted-foreground mb-2 block">
                  Project Icon
                </Label>
                <div className="flex flex-wrap gap-2">
                  {ICONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setSelectedIcon(icon)}
                      className={`
                        h-9 w-9 rounded-lg text-lg flex items-center justify-center
                        border transition-all duration-150
                        ${
                          selectedIcon === icon
                            ? "border-primary bg-primary/10 scale-110 shadow-sm"
                            : "border-border bg-muted/40 hover:border-primary/40 hover:bg-primary/5"
                        }
                      `}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
                {state.errors.icon && (
                  <p className="text-xs text-destructive mt-1">{state.errors.icon}</p>
                )}
              </div>

              {/* Project name */}
              <div className="mb-4">
                <Input
                  name="name"
                  placeholder="Project name"
                  autoFocus
                  className="
                    border-none bg-transparent shadow-none
                    text-2xl font-semibold text-foreground placeholder:text-muted-foreground/40
                    focus-visible:ring-0 px-0 h-auto py-1
                  "
                />
                {state.errors.name && (
                  <p className="text-xs text-destructive mt-1">{state.errors.name}</p>
                )}
              </div>

              {/* Divider */}
              <div className="h-px bg-border mb-4" />

              {/* Description */}
              <div>
                <Textarea
                  name="description"
                  placeholder="Add a short summary..."
                  rows={2}
                  className="
                    border-none bg-transparent shadow-none resize-none
                    text-sm text-foreground placeholder:text-muted-foreground/40
                    focus-visible:ring-0 px-0 scrollbar-none
                  "
                />
                {state.errors.description && (
                  <p className="text-xs text-destructive mt-1">{state.errors.description}</p>
                )}
              </div>
            </div>

            {/* Selected icon preview badge */}
            <div className="px-6 pb-4 flex items-center gap-2">
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-muted/50 border border-border w-fit">
                <span className="text-sm">{selectedIcon}</span>
                <span className="text-xs text-muted-foreground">Project icon selected</span>
              </div>
            </div>

            {/* Divider */}
            <div className="h-px bg-border" />

            {/* Footer */}
            <div className="flex items-center justify-end gap-2 px-6 py-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={close}
                className="h-9 px-4 rounded-lg text-sm"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="
                  h-9 px-5 rounded-lg text-sm font-semibold
                  bg-primary hover:bg-primary/90 text-primary-foreground
                  shadow-sm transition-all duration-150
                  hover:scale-[1.02] active:scale-[0.98]
                  disabled:opacity-50 disabled:pointer-events-none
                "
              >
                {isSubmitting ? "Creating..." : "Create project"}
              </Button>
            </div>

          </form>
        </DialogContent>
      </Dialog>
    </ProjectDialogContext.Provider>
  );
}