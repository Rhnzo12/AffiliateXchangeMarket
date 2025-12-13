import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../components/ui/tabs";
import { TopNavBar } from "../components/TopNavBar";
import CompanyVideos from "./company-videos";
import CompanyApplications from "./company-applications";
import CompanyCreators from "./company-creators";
import { useCompanyPageTour } from "../components/CompanyTour";
import { COMPANY_TOUR_IDS, creatorWorkflowTourSteps } from "../lib/companyTourConfig";

type WorkflowTab = "videos" | "applications" | "creators";

const tabRoutes: Record<WorkflowTab, string> = {
  videos: "/company/videos",
  applications: "/company/applications",
  creators: "/company/creators",
};

function isWorkflowTab(value: string): value is WorkflowTab {
  return value === "videos" || value === "applications" || value === "creators";
}

function tabFromPath(path: string): WorkflowTab | null {
  const match = (Object.entries(tabRoutes) as [WorkflowTab, string][]).find(([, route]) => route === path);
  return match ? match[0] : null;
}

type CompanyCreatorWorkflowProps = {
  defaultTab?: WorkflowTab;
};

export default function CompanyCreatorWorkflow({ defaultTab = "videos" }: CompanyCreatorWorkflowProps) {
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState<WorkflowTab>(defaultTab);

  // Quick tour for creator workflow page
  useCompanyPageTour(COMPANY_TOUR_IDS.CREATOR_WORKFLOW, creatorWorkflowTourSteps);

  useEffect(() => {
    const routeTab = tabFromPath(location);
    if (routeTab && routeTab !== activeTab) {
      setActiveTab(routeTab);
    }
  }, [activeTab, location]);

  useEffect(() => {
    setActiveTab(defaultTab);
  }, [defaultTab]);

  const handleTabChange = (value: string) => {
    if (!isWorkflowTab(value)) return;
    setActiveTab(value);
    const nextPath = tabRoutes[value];
    if (nextPath !== location) {
      setLocation(nextPath);
    }
  };

  return (
    <div className="space-y-6">
      <TopNavBar />
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Creator Workflow</h1>
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="space-y-6">
        <TabsList className="flex w-full items-center justify-start gap-6 border-b border-border bg-transparent p-0 sm:w-auto">
          <TabsTrigger
            value="videos"
            className="relative h-auto rounded-none bg-transparent px-0 pb-3 text-sm font-semibold text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:after:absolute data-[state=active]:after:left-0 data-[state=active]:after:top-full data-[state=active]:after:block data-[state=active]:after:h-0.5 data-[state=active]:after:w-full data-[state=active]:after:bg-primary"
          >
            Promotional Videos
          </TabsTrigger>
          <TabsTrigger
            value="applications"
            className="relative h-auto rounded-none bg-transparent px-0 pb-3 text-sm font-semibold text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:after:absolute data-[state=active]:after:left-0 data-[state=active]:after:top-full data-[state=active]:after:block data-[state=active]:after:h-0.5 data-[state=active]:after:w-full data-[state=active]:after:bg-primary"
          >
            Applications
          </TabsTrigger>
          <TabsTrigger
            value="creators"
            className="relative h-auto rounded-none bg-transparent px-0 pb-3 text-sm font-semibold text-muted-foreground data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:after:absolute data-[state=active]:after:left-0 data-[state=active]:after:top-full data-[state=active]:after:block data-[state=active]:after:h-0.5 data-[state=active]:after:w-full data-[state=active]:after:bg-primary"
          >
            Approved Creators
          </TabsTrigger>
        </TabsList>

        <TabsContent value="videos" className="space-y-6">
          <CompanyVideos hideTopNav />
        </TabsContent>

        <TabsContent value="applications" className="space-y-6">
          <CompanyApplications hideTopNav />
        </TabsContent>

        <TabsContent value="creators" className="space-y-6">
          <CompanyCreators hideTopNav />
        </TabsContent>
      </Tabs>
    </div>
  );
}
