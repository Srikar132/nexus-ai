"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Category {
  id: string;
  label: string;
  icon: string;
}

interface Prompt {
  id: string;
  label: string;
  full: string;
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const CATEGORIES: Category[] = [
  { id: "todo", icon: "✓", label: "Todo App" },
  { id: "blog", icon: "🔥", label: "Blog Platform" },
  { id: "crm", icon: "📊", label: "CRM Dashboard" },
  { id: "ecommerce", icon: "🛒", label: "E-commerce Store" },
];

const PROMPTS: Record<string, Prompt[]> = {
  todo: [
    {
      id: "todo-1",
      label: "Team todo app with roles and deadlines",
      full: "Build a full-stack team todo application with user authentication, role-based access control, task assignment, priority levels, due dates, and real-time updates using Next.js and Supabase.",
    },
    {
      id: "todo-2",
      label: "Personal productivity tracker with analytics",
      full: "Create a personal productivity tracker with daily task management, habit streaks, completion analytics dashboard, calendar view, and email reminders using Next.js and PostgreSQL.",
    },
    {
      id: "todo-3",
      label: "Project management board like Trello",
      full: "Build a Kanban-style project management board with drag-and-drop cards, multiple boards, team collaboration, file attachments, activity logs, and Slack integration using Next.js.",
    },
    {
      id: "todo-4",
      label: "Mobile-first todo with offline support",
      full: "Design a mobile-first todo application with offline support via service workers, background sync, push notifications, recurring tasks, and cross-device sync using Next.js PWA.",
    },
  ],
  blog: [
    {
      id: "blog-1",
      label: "Developer blog with MDX and syntax highlighting",
      full: "Build a developer blog platform with MDX support, syntax-highlighted code blocks, reading time estimates, tag filtering, RSS feed, SEO optimization, and a clean minimal design using Next.js.",
    },
    {
      id: "blog-2",
      label: "Multi-author publishing platform with subscriptions",
      full: "Create a multi-author publishing platform with writer profiles, paid subscriptions via Stripe, draft management, email newsletters, comment sections, and analytics using Next.js and Supabase.",
    },
    {
      id: "blog-3",
      label: "Content platform with AI writing assistant",
      full: "Build a content management platform with an integrated AI writing assistant, rich text editor, SEO suggestions, automatic social media previews, and scheduled publishing using Next.js and OpenAI.",
    },
    {
      id: "blog-4",
      label: "Portfolio blog with case studies and CMS",
      full: "Design a portfolio blog with project case studies, a headless CMS integration, animated page transitions, dark mode, contact form, and performance-optimized image galleries using Next.js.",
    },
  ],
  crm: [
    {
      id: "crm-1",
      label: "Sales CRM with pipeline and deal tracking",
      full: "Build a sales CRM with lead management, visual deal pipeline, contact profiles, activity timeline, email integration, revenue forecasting, and team performance reports using Next.js and PostgreSQL.",
    },
    {
      id: "crm-2",
      label: "Customer support CRM with ticketing system",
      full: "Create a customer support CRM with a ticketing system, SLA tracking, canned responses, agent assignment, satisfaction surveys, and a self-service knowledge base using Next.js and Supabase.",
    },
    {
      id: "crm-3",
      label: "Real estate CRM with property listings",
      full: "Build a real estate CRM with property listing management, client matching, showing schedules, document storage, commission tracking, and an interactive map view using Next.js and Google Maps API.",
    },
    {
      id: "crm-4",
      label: "Marketing CRM with campaign analytics",
      full: "Design a marketing CRM with contact segmentation, email campaign management, A/B testing, conversion funnel analytics, social media tracking, and ROI reporting using Next.js and Chart.js.",
    },
  ],
  ecommerce: [
    {
      id: "ecommerce-1",
      label: "Full-stack store with Stripe and inventory",
      full: "Build a full-stack e-commerce store with product catalog, inventory management, Stripe payments, order tracking, customer accounts, discount codes, and an admin dashboard using Next.js and Supabase.",
    },
    {
      id: "ecommerce-2",
      label: "Digital products marketplace with licensing",
      full: "Create a digital products marketplace with secure file delivery, license key generation, usage analytics, vendor payouts via Stripe Connect, reviews, and wishlists using Next.js.",
    },
    {
      id: "ecommerce-3",
      label: "Subscription box store with recurring billing",
      full: "Build a subscription box e-commerce store with recurring billing via Stripe, customizable box preferences, skip/pause options, shipment tracking, and a loyalty rewards program using Next.js.",
    },
    {
      id: "ecommerce-4",
      label: "Multi-vendor marketplace with seller dashboards",
      full: "Design a multi-vendor marketplace with seller onboarding, individual dashboards, commission management, product approval workflow, dispute resolution, and buyer/seller ratings using Next.js.",
    },
  ],
};

// ─── Component ────────────────────────────────────────────────────────────────

interface QuickStartProps {
  onSelectPrompt: (prompt: string) => void;
}

export function QuickStart({ onSelectPrompt }: QuickStartProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close panel when clicking outside
  useEffect(() => {
    if (!selectedCategory) return;
    function handleClick(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setSelectedCategory(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [selectedCategory]);

  const handleSelect = (prompt: string) => {
    setSelectedCategory(null);
    onSelectPrompt(prompt);
  };

  const activeCategory = CATEGORIES.find((c) => c.id === selectedCategory);

  return (
    <div className="w-full max-w-2xl mx-auto mt-5 px-1 relative" ref={panelRef}>

      {/* ── Tab Row ── */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, delay: 0.1 }}
        className="flex flex-wrap justify-center gap-2"
      >
        {CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() =>
                setSelectedCategory(isActive ? null : cat.id)
              }
              className={`
                flex items-center gap-2 px-4 py-1.5 rounded-full
                border text-sm font-medium
                transition-all duration-200
                ${isActive
                  ? "border-border/80 bg-muted text-foreground"
                  : "border-border/50 bg-transparent text-muted-foreground hover:text-foreground hover:border-border/70 hover:bg-muted/40"
                }
              `}
            >
              <span className="text-sm leading-none">{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </motion.div>

      {/* ── Dropdown Panel (Absolute positioned to prevent layout shift) ── */}
      <AnimatePresence>
        {selectedCategory && activeCategory && (
          <motion.div
            key={selectedCategory}
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="
              absolute left-1/2 -translate-x-1/2 top-full mt-3
              w-full max-w-xl
              rounded-2xl border border-border/70
              bg-card shadow-xl
              overflow-hidden
            "
            style={{ zIndex: 50 }}
          >
            {/* Panel header */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-border/40">
              <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
                <span>{activeCategory.icon}</span>
                <span>{activeCategory.label}</span>
              </div>
              <button
                onClick={() => setSelectedCategory(null)}
                className="
                  h-6 w-6 flex items-center justify-center rounded-md
                  text-muted-foreground/60 hover:text-foreground
                  hover:bg-muted/50 transition-colors duration-150
                "
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Prompt list */}
            <div className="flex flex-col divide-y divide-border/30">
              {PROMPTS[selectedCategory].map((prompt, i) => (
                <motion.button
                  key={prompt.id}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.15, delay: i * 0.03 }}
                  onClick={() => handleSelect(prompt.full)}
                  className="
                    w-full text-left px-5 py-3.5
                    text-sm text-muted-foreground
                    hover:text-foreground hover:bg-muted/30
                    transition-colors duration-150
                  "
                >
                  {prompt.label}
                </motion.button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}