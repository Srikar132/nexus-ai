/**
 * Project types matching the backend SQLAlchemy Project model
 */

export type ProjectStatus = "initializing" | "building" | "deployed" | "failed";
export type TargetFramework = "fastapi" | "flask" | "express" | "nextjs" | "django";
export type TargetLanguage = "python" | "javascript" | "typescript" | "go" | "rust";

export interface Project {
  id: string; // UUID
  name: string;
  description?: string | null;
  slug: string;
  
  // Configuration
  targetFramework?: string | null;
  targetLanguage?: string | null;
  
  // Status and build info
  status: ProjectStatus;
  totalBuilds: number;
  successfulBuilds: number;
  failedBuilds: number;
  
  // Deployment info
  latestDeployedUrl?: string | null;
  
  // Git integration
  gitRepoUrl?: string | null;
  gitBranch?: string;
  
  // Timestamps
  createdAt: string; // ISO date string
  updatedAt: string; // ISO date string
  lastDeployedAt?: string | null; // ISO date string
}

/**
 * Create project form data
 */
export interface CreateProjectData {
  name?: string | null;
  description?: string | null;
  targetFramework?: string | null;
  targetLanguage?: string | null;
  userPrompt?: string | null;
}

/**
 * Update project data
 */
export interface UpdateProjectData {
  name?: string;
  description?: string;
  targetFramework?: string;
  targetLanguage?: string;
}

/**
 * Paginated project list response
 */
export interface ProjectListResponse {
  projects: Project[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Project query parameters
 */
export interface ProjectListParams {
  page?: number;
  limit?: number;
  status?: ProjectStatus;
}
