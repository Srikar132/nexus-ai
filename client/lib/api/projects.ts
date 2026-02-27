/**
 * lib/api/projects.ts
 * 
 * Project API endpoints
 */

import { apiFetch } from "./fetch";
import { API_ENDPOINTS } from "./config";
import type {
  Project,
  CreateProjectData,
  UpdateProjectData,
  ProjectListResponse,
  ProjectListParams,
} from "@/types/project";

export const projectsAPI = {
  /**
   * Create a new project
   * POST /api/v1/projects
   */
  create: async (data: CreateProjectData) => {
    return apiFetch<Project>(API_ENDPOINTS.projects.create, {
      method: "POST",
      body: data,
    });
  },

  /**
   * Get all projects with pagination
   * GET /api/v1/projects
   */
  list: async (params?: ProjectListParams) => {
    const queryParams: Record<string, string> = {};
    
    if (params?.page) queryParams.page = params.page.toString();
    if (params?.limit) queryParams.limit = params.limit.toString();
    if (params?.status) queryParams.status = params.status;

    return apiFetch<ProjectListResponse>(API_ENDPOINTS.projects.list, {
      method: "GET",
      params: queryParams,
    });
  },

  /**
   * Get a single project
   * GET /api/v1/projects/:id
   */
  getById: async (projectId: string) => {
    return apiFetch<Project>(API_ENDPOINTS.projects.byId(projectId), {
      method: "GET",
    });
  },

  /**
   * Update a project
   * PATCH /api/v1/projects/:id
   */
  update: async (projectId: string, data: UpdateProjectData) => {
    return apiFetch<Project>(API_ENDPOINTS.projects.update(projectId), {
      method: "PATCH",
      body: data,
    });
  },

  /**
   * Delete a project
   * DELETE /api/v1/projects/:id
   */
  delete: async (projectId: string) => {
    return apiFetch<void>(API_ENDPOINTS.projects.delete(projectId), {
      method: "DELETE",
    });
  },
};
