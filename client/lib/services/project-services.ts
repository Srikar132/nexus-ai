import { fetchAPI } from "@/lib/fetch-api";
import { 
  CreateProjectData, 
  UpdateProjectData, 
  Project, 
  ProjectListResponse,
  ProjectListParams 
} from "@/types/project";

/**
 * Project service for managing project data
 * All endpoints are prefixed with /api/v1
 */
const projectServices = {
  /**
   * Create a new project
   * POST /api/v1/projects
   */
  createProject: async (data: CreateProjectData): Promise<Project> => {
    const response = await fetchAPI<Project>("/api/v1/projects", {
      method: "POST",
      body: data,
    });
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    return response.data!;
  },

  /**
   * Get all projects for the current user with pagination
   * GET /api/v1/projects
   */
  getProjects: async (params: ProjectListParams = {}): Promise<ProjectListResponse> => {
    const queryParams: Record<string, string> = {};
    
    if (params.page) queryParams.page = params.page.toString();
    if (params.limit) queryParams.limit = params.limit.toString();
    if (params.status) queryParams.status = params.status;

    const response = await fetchAPI<ProjectListResponse>("/api/v1/projects", {
      method: "GET",
      params: queryParams,
    });
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    return response.data!;
  },

  /**
   * Get a single project by ID
   * GET /api/v1/projects/:id
   */
  getProject: async (projectId: string): Promise<Project> => {
    const response = await fetchAPI<Project>(`/api/v1/projects/${projectId}`, {
      method: "GET",
    });
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    return response.data!;
  },

  /**
   * Update project details
   * PATCH /api/v1/projects/:id
   */
  updateProject: async (projectId: string, data: UpdateProjectData): Promise<Project> => {
    const response = await fetchAPI<Project>(`/api/v1/projects/${projectId}`, {
      method: "PATCH",
      body: data,
    });
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    return response.data!;
  },

  /**
   * Delete a project
   * DELETE /api/v1/projects/:id
   */
  deleteProject: async (projectId: string): Promise<void> => {
    const response = await fetchAPI(`/api/v1/projects/${projectId}`, {
      method: "DELETE",
    });
    
    if (response.error) {
      throw new Error(response.error);
    }
  },

  /**
   * Get project build history (placeholder for future implementation)
   * GET /api/v1/projects/:id/builds
   */
  getProjectBuilds: async (projectId: string): Promise<any[]> => {
    const response = await fetchAPI<any[]>(`/api/v1/projects/${projectId}/builds`, {
      method: "GET",
    });
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    return response.data || [];
  },

  /**
   * Trigger a new build for the project (placeholder for future implementation)
   * POST /api/v1/projects/:id/builds
   */
  triggerBuild: async (projectId: string): Promise<any> => {
    const response = await fetchAPI<any>(`/api/v1/projects/${projectId}/builds`, {
      method: "POST",
    });
    
    if (response.error) {
      throw new Error(response.error);
    }
    
    return response.data!;
  },
};

export default projectServices;
