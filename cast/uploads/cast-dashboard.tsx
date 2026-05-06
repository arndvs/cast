"use client";

import * as React from "react";
import { Zap } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ThemeToggle } from "@/components/theme-toggle";
import { BriefEditor } from "./brief-editor";
import { RunView } from "./run-view";
import { OutputGrid } from "./output-grid";
import { CreativeDetailModal } from "./creative-detail-modal";
import type { CampaignBrief, PipelineState, Creative } from "@/lib/cast/types";
import {
  mockPipelineState,
  mockCreatives,
  mockPipelineLogs,
} from "@/lib/cast/mock-data";

type TabValue = "brief" | "run" | "outputs";

export function CastDashboard() {
  const [activeTab, setActiveTab] = React.useState<TabValue>("brief");
  const [pipelineState, setPipelineState] = React.useState<PipelineState>({
    status: "idle",
    progress: 0,
    currentStep: "",
    logs: [],
  });
  const [creatives, setCreatives] = React.useState<Creative[]>([]);
  const [selectedCreative, setSelectedCreative] =
    React.useState<Creative | null>(null);
  const [detailModalOpen, setDetailModalOpen] = React.useState(false);

  const handleGenerate = (brief: CampaignBrief) => {
    // Simulate pipeline run
    setActiveTab("run");
    setPipelineState({
      status: "running",
      progress: 0,
      currentStep: "Initializing...",
      logs: [],
      startedAt: new Date().toISOString(),
    });

    // Simulate streaming logs
    let logIndex = 0;
    const interval = setInterval(() => {
      if (logIndex < mockPipelineLogs.length) {
        const log = mockPipelineLogs[logIndex];
        setPipelineState((prev) => ({
          ...prev,
          progress: Math.round(
            ((logIndex + 1) / mockPipelineLogs.length) * 100,
          ),
          currentStep: log.step,
          logs: [...prev.logs, log],
        }));
        logIndex++;
      } else {
        clearInterval(interval);
        setPipelineState((prev) => ({
          ...prev,
          status: "completed",
          progress: 100,
          currentStep: "complete",
          completedAt: new Date().toISOString(),
        }));
        setCreatives(mockCreatives);
      }
    }, 400);
  };

  const handleCreativeSelect = (creative: Creative) => {
    setSelectedCreative(creative);
    setDetailModalOpen(true);
  };

  const handleRevealInFolder = () => {
    // In a real app, this would call a server action to open the folder
    alert("Server action: Opening outputs folder in file explorer...");
  };

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="flex h-14 shrink-0 items-center justify-between border-b px-6">
        <div className="flex items-center gap-3">
          <div className="flex size-8 items-center justify-center rounded-md bg-primary">
            <Zap className="size-4 text-primary-foreground" />
          </div>
          <h1 className="text-lg font-semibold">Cast</h1>
          <span className="text-sm text-muted-foreground">
            Creative Automation Studio Toolchain
          </span>
        </div>
        <ThemeToggle />
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden p-6">
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as TabValue)}
          className="flex h-full flex-col"
        >
          <TabsList className="w-fit">
            <TabsTrigger value="brief">Brief Editor</TabsTrigger>
            <TabsTrigger value="run">
              Run View
              {pipelineState.status === "running" && (
                <span className="ml-1.5 size-2 animate-pulse rounded-full bg-primary" />
              )}
            </TabsTrigger>
            <TabsTrigger value="outputs">
              Outputs
              {creatives.length > 0 && (
                <span className="ml-1.5 rounded-full bg-muted px-1.5 py-0.5 text-xs">
                  {creatives.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="brief" className="flex-1 overflow-hidden">
            <BriefEditor onGenerate={handleGenerate} />
          </TabsContent>

          <TabsContent value="run" className="flex-1 overflow-hidden">
            <RunView state={pipelineState} />
          </TabsContent>

          <TabsContent value="outputs" className="flex-1 overflow-hidden">
            <OutputGrid
              creatives={creatives}
              onCreativeSelect={handleCreativeSelect}
              onRevealInFolder={handleRevealInFolder}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Creative Detail Modal */}
      <CreativeDetailModal
        creative={selectedCreative}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
      />
    </div>
  );
}
