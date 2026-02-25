/**
 * Project types matching the backend SQLAlchemy Project model
 * and ProjectResponse schema
 */

export interface Project {
  id: string; // UUID
  name: string;
  description?: string | null;

  // Status and metadata
  status: string; // "active" | "deleted" etc.
  stack?: Record<string, any> | null;

  // Git & Deployment
  repo_url?: string | null;
  latest_deploy_url?: string | null;

  // LangGraph integration
  langgraph_thread_id?: string | null;

  // Timestamps
  created_at: string; // ISO date string
  updated_at: string; // ISO date string
}

/**
 * Create project form data — matches ProjectCreate schema
 */
export interface CreateProjectData {
  name?: string | null;
  description?: string | null;
  userPrompt?: string | null;
}

/**
 * Update project data — matches ProjectUpdate schema
 */
export interface UpdateProjectData {
  name?: string;
  description?: string;
  status?: string;
  stack?: Record<string, any>;
  repo_url?: string;
  latest_deploy_url?: string;
}

/**
 * Paginated project list response — matches ProjectListResponse schema
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
  status?: string;
}
