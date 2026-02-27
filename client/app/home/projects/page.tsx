import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Search, Plus, Info, ExternalLink } from "lucide-react";
import { auth } from "@/lib/auth";
import Link from "next/link";
import { projectsAPI } from "@/lib/api";

const ProjectsPage = async () => {

  try {

    const session = await auth();
    const response = await projectsAPI.list({ page: 1, limit: 10 });
    const data = response.data;

    if (!data) {
      throw new Error("Failed to fetch projects");
    }

    return (
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">{session?.user?.name}&apos;s projects</h1>
          </div>
          <div className="flex gap-2">
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              New project
            </Button>
          </div>
        </div>

        {/* Stats Cards - Real data from projects */}
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Total Projects</span>
                  <Info className="h-4 w-4" />
                </div>
                <div className="text-2xl font-bold">{data?.total || 0}</div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Total Builds</span>
                  <Info className="h-4 w-4" />
                </div>
                <div className="text-2xl font-bold">
                  {0}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Successful Builds</span>
                  <Info className="h-4 w-4" />
                </div>
                <div className="text-2xl font-bold">
                  {0}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>Active Projects</span>
                  <Info className="h-4 w-4" />
                </div>
                <div className="text-2xl font-bold">
                  {data?.total}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-4 border-t">
            <p className="text-sm text-muted-foreground">
              Project metrics updated in real-time. Statistics include all builds and deployments across your projects.
            </p>
          </div>
        </Card>

        {/* Projects Section */}
        <div className="w-full">
          <h2 className="text-xl font-semibold mb-4">{data?.total || 0} Project{(data?.total || 0) !== 1 ? 's' : ''}</h2>

          {/* Search */}
          <div className="mb-6">
            <div className="relative max-w-sm border border-muted rounded-md">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search..." className="pl-8" />
            </div>
          </div>

          {/* Projects Table */}
          <div className="w-full overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[25%]">Name</TableHead>
                  <TableHead className="w-[12%]">Framework</TableHead>
                  <TableHead className="w-[10%]">Status</TableHead>
                  <TableHead className="w-[8%]">Info</TableHead>
                  <TableHead className="w-[18%]">Last Updated</TableHead>
                  <TableHead className="w-[27%]">Deployed Link</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data?.projects?.length > 0 ? (
                  data?.projects.map((project) => {
                    const truncateWords = (text: string, maxWords: number) => {
                      if (!text) return 'No description';
                      const words = text.split(' ');
                      if (words.length <= maxWords) return text;
                      return words.slice(0, maxWords).join(' ') + '...';
                    };

                    return (
                      <TableRow key={project.id} className="cursor-pointer hover:bg-muted/50 transition-colors">
                        <TableCell className="w-[25%]">
                          <Link href={`/project/${project.id}`} className="flex items-center gap-3 w-full">
                            <div className="w-8 h-8 flex items-center justify-center shrink-0">
                              <span className="text-sm font-bold text-white">
                                {project.name.charAt(0).toUpperCase()}
                              </span>
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium truncate">{project.name}</div>
                              <div className="text-xs text-muted-foreground truncate">{truncateWords(project.description || '', 12)}</div>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="w-[12%]">
                          <Link href={`/project/${project.id}`} className="block w-full">
                            <Badge variant="outline" className="text-xs">
                              {project.stack?.framework || 'Unknown'}
                            </Badge>
                          </Link>
                        </TableCell>
                        <TableCell className="w-[10%]">
                          <Link href={`/project/${project.id}`} className="block w-full">
                            <Badge
                              variant={
                                project.status === 'active' ? 'default' :
                                  project.status === 'deleted' ? 'destructive' :
                                    'outline'
                              }
                              className="text-xs"
                            >
                              {project.status}
                            </Badge>
                          </Link>
                        </TableCell>
                        <TableCell className="w-[8%]">
                          <Link href={`/project/${project.id}`} className="block w-full">
                            <div className="text-sm text-muted-foreground">
                              —
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="w-[18%]">
                          <Link href={`/project/${project.id}`} className="block w-full">
                            <div className="text-sm text-muted-foreground">
                              {new Date(project.updated_at).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric',
                                year: 'numeric'
                              })}
                              <div className="text-xs">
                                {new Date(project.updated_at).toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit',
                                  hour12: true
                                })}
                              </div>
                            </div>
                          </Link>
                        </TableCell>
                        <TableCell className="w-[27%]">
                          <div className="flex items-center justify-between">
                            {!project.latest_deploy_url && (
                              <Link href={`/project/${project.id}`} className="flex-1">
                                <span className="text-xs text-muted-foreground">Not deployed</span>
                              </Link>
                            )}
                            {project.latest_deploy_url && (
                              <Link
                                href={project.latest_deploy_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="flex items-center gap-2 text-sm hover:text-primary transition-colors"
                              >
                                <ExternalLink className="h-4 w-4" />
                                View Live
                              </Link>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-muted-foreground py-12">
                      <div className="flex flex-col items-center gap-2">
                        <p className="text-lg font-medium">No projects found</p>
                        <p className="text-sm">Create your first project to get started</p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {data?.projects && data.projects.length > 0 && (
            <div className="flex items-center justify-center px-2 py-6 w-full">
              <Pagination>
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious href="#" />
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink href="#" isActive>
                      1
                    </PaginationLink>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink href="#">
                      2
                    </PaginationLink>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationLink href="#">
                      3
                    </PaginationLink>
                  </PaginationItem>
                  <PaginationItem>
                    <PaginationNext href="#" />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
          )}
        </div>
      </div>
    );

  } catch (error) {
    console.error("Error fetching projects:", error);
    return (
      <div className="space-y-6 p-6">
        <h1 className="text-3xl font-bold">Projects</h1>
        <p className="text-red-500">Failed to load projects</p>
      </div>
    );
  }
};

export default ProjectsPage;
