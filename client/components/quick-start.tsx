"use client";

import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

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
  { id: "todo",      icon: "✓",  label: "Todo App"         },
  { id: "blog",      icon: "🔥", label: "Blog Platform"    },
  { id: "crm",       icon: "📊", label: "CRM Dashboard"    },
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

// ─── Animation Variants ───────────────────────────────────────────────────────

const containerVariants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07 },
  },
  exit: {
    transition: { staggerChildren: 0.04, staggerDirection: -1 },
  },
};

const itemVariants = {
  hidden:  { opacity: 0, y: 16, filter: "blur(4px)" },
  visible: {
    opacity: 1, y: 0, filter: "blur(0px)",
    transition: { duration: 0.35, ease: "easeOut" as const },
  },
  exit: {
    opacity: 0, y: -10, filter: "blur(4px)",
    transition: { duration: 0.2, ease: "easeIn" as const },
  },
};

const backVariants = {
  hidden:  { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { duration: 0.25, ease: "easeOut" as const } }, // easeOut cubic-bezier
  exit:    { opacity: 0, x: -8, transition: { duration: 0.15 } },
};

// ─── Component ────────────────────────────────────────────────────────────────

interface QuickStartProps {
  onSelectPrompt: (prompt: string) => void;
}

export function QuickStart({ onSelectPrompt }: QuickStartProps) {
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);


  const onSelect = (prompt : string) => {
    setSelectedCategory(null);
    onSelectPrompt(prompt);
  }

  return (
    <div className="w-full max-w-2xl mx-auto mt-6 px-1">

      {/* Label */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="text-center text-[11px] tracking-[0.15em] text-muted-foreground/60 uppercase mb-4"
      >
        Quick Start
      </motion.p>

      <AnimatePresence mode="wait">

        {/* ── Stage 1 — Categories ── */}
        {!selectedCategory && (
          <motion.div
            key="categories"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex flex-wrap justify-center gap-2"
          >
            {CATEGORIES.map((cat) => (
              <motion.button
                key={cat.id}
                variants={itemVariants}
                onClick={() => setSelectedCategory(cat.id)}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="
                  flex items-center gap-2 px-4 py-2 rounded-full
                  border border-border/60 bg-card/60 backdrop-blur-sm
                  text-sm text-muted-foreground
                  hover:border-primary/40 hover:text-foreground hover:bg-primary/5
                  transition-colors duration-200
                "
              >
                <span className="text-base leading-none">{cat.icon}</span>
                <span className="font-medium">{cat.label}</span>
              </motion.button>
            ))}
          </motion.div>
        )}

        {/* ── Stage 2 — Prompts ── */}
        {selectedCategory && (
          <motion.div
            key="prompts"
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={containerVariants}
            className="flex flex-col items-center gap-2"
          >
            {/* Back button */}
            <motion.button
              variants={backVariants}
              onClick={() => setSelectedCategory(null)}
              whileHover={{ x: -2 }}
              className="
                flex items-center gap-1.5 mb-1
                text-[11px] text-muted-foreground/60
                hover:text-muted-foreground transition-colors duration-150
              "
            >
              <ArrowLeft className="h-3 w-3" />
              <span className="tracking-wide uppercase">Back</span>
            </motion.button>

            {/* Prompt pills */}
            <div className="flex flex-wrap justify-center gap-2">
              {PROMPTS[selectedCategory].map((prompt) => (
                <motion.button
                  key={prompt.id}
                  variants={itemVariants}
                  onClick={() => onSelect(prompt.full)}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  title={prompt.full}
                  className="
                    max-w-60 px-4 py-2 rounded-full
                    border border-border/60 bg-card/60 backdrop-blur-sm
                    text-sm text-muted-foreground text-left
                    hover:border-primary/40 hover:text-foreground hover:bg-primary/5
                    transition-colors duration-200 truncate
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