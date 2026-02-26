import {
    Code2,
    Shield,
    Rocket,
    Activity,
    GitBranch,
    FileCode2,
    MessageSquare,
    CheckCircle2,
    ShieldAlert,
    ShieldCheck,
    Bug,
    FileText,
    Cloud,
    GitPullRequest,
    UploadCloud,
    RotateCcw,
    BarChart3,
    DollarSign,
    AlertTriangle,
    type LucideIcon,
} from "lucide-react";

/* ── Types ── */
export interface SubAgent {
    icon: LucideIcon;
    name: string;
    desc: string;
}

export interface Squad {
    icon: LucideIcon;
    name: string;
    label: string;
    tagline: string;
    description: string;
    agents: SubAgent[];
}

/* ── Data ── */
export const agentSquads: Squad[] = [
    {
        icon: Code2,
        name: "SpectraCode",
        label: "Build",
        tagline: "From idea to implementation",
        description:
            "A planner agent breaks down requirements, a coder agent writes the implementation, a reviewer agent debates every decision, and a tester agent runs the full suite.",
        agents: [
            { icon: GitBranch, name: "Planner", desc: "Breaks down requirements into tasks" },
            { icon: FileCode2, name: "Coder", desc: "Writes production-quality code" },
            { icon: MessageSquare, name: "Reviewer", desc: "Challenges every decision" },
            { icon: CheckCircle2, name: "Tester", desc: "Runs comprehensive test suites" },
        ],
    },
    {
        icon: Shield,
        name: "ThreatNest",
        label: "Security",
        tagline: "Attack. Patch. Repeat.",
        description:
            "A red team agent actively tries to break what Squad 1 built. A blue team agent patches every vulnerability. A report agent documents every finding.",
        agents: [
            { icon: ShieldAlert, name: "Red Team", desc: "Attacks & finds vulnerabilities" },
            { icon: ShieldCheck, name: "Blue Team", desc: "Patches every breach found" },
            { icon: Bug, name: "Pen Tester", desc: "Simulates real-world exploits" },
            { icon: FileText, name: "Reporter", desc: "Documents all security findings" },
        ],
    },
    {
        icon: Rocket,
        name: "OpsOrchestra",
        label: "Deploy",
        tagline: "Zero-touch shipping",
        description:
            "An infra agent provisions cloud resources, a pipeline agent sets up CI/CD, a deploy agent ships to production, and a rollback agent watches for failure signals.",
        agents: [
            { icon: Cloud, name: "Infra", desc: "Provisions cloud resources" },
            { icon: GitPullRequest, name: "Pipeline", desc: "Sets up CI/CD workflows" },
            { icon: UploadCloud, name: "Deploy", desc: "Ships to production" },
            { icon: RotateCcw, name: "Rollback", desc: "Auto-reverts on failure" },
        ],
    },
    {
        icon: Activity,
        name: "ObserveIQ",
        label: "Monitor",
        tagline: "Always watching",
        description:
            "A log analysis agent watches production in real time, a cost agent monitors cloud spend, and an incident agent pages Squad 1 if anything breaks — restarting the cycle.",
        agents: [
            { icon: BarChart3, name: "Log Analyst", desc: "Real-time production logs" },
            { icon: DollarSign, name: "Cost Optimizer", desc: "Monitors cloud spend" },
            { icon: AlertTriangle, name: "Incident", desc: "Pages on failure signals" },
            { icon: Activity, name: "Health", desc: "Uptime & performance checks" },
        ],
    },
];
