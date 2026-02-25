import projectServices from "@/lib/services/project-services";

const ProjectPage = async ({
  params,
} : {
  params: {
    id: string;
  };
}) => {
  let id: string | null = null;
  let hasError = false;

  try {
    const resolvedParams = await params;
    id = resolvedParams.id;

    // const project = await projectServices.getProject(id);
  } catch (error) {
    console.error("Error fetching project:", error);
    hasError = true;
  }

  if (hasError) {
    return (
      <main>
        <h1>Project Details</h1>
        <p>Error fetching project information.</p>
      </main>
    );
  }

  return (
    <main>
      <h1>Project Details</h1>
      <p>Information about the project will be displayed here.</p>
      <p className="text-sm text-muted-foreground mt-2">
        Project ID: {id}
      </p>
    </main>
  );
};

export default ProjectPage;
