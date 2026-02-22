import projectServices from "@/lib/services/project-services";

const ProjectPage = async ({
  params,
} : {
  params: {
    id: string;
  };
}) => {

  try {
    const { id } = await params;

    // const project = await projectServices.getProject(id);


    return (
      <main>
        <h1>Project Details</h1>
        <p>Information about the project will be displayed here.</p>
        <p className="text-sm text-muted-foreground mt-2">
          Project ID: {id}
        </p>
      </main>
    );
  } catch (error) {
    console.error("Error fetching project:", error);
    return (
      <main>
        <h1>Project Details</h1>
        <p>Error fetching project information.</p>
      </main>
    );
  }

};

export default ProjectPage;
