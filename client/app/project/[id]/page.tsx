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

    const project = await projectServices.getProject(id);




    return (
      <main className="w-screen h-screen p-8 overflow-hidden">
        <div className={"flex flex-col w-full h-full border border-red-500"}>

        </div>
      </main>
    );
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
};

export default ProjectPage;
