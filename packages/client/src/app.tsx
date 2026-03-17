import { useState } from "react";
import { DashboardPage } from "./components/dashboard/dashboard-page";
import { SetupPage } from "./components/setup/setup-page";
import { Layout } from "./components/shared/layout";

type AppPhase = "setup" | "coaching" | "sessions";

export function App() {
  const [phase, setPhase] = useState<AppPhase>("setup");
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const handleCoachingStarted = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setPhase("coaching");
  };

  switch (phase) {
    case "setup":
      return (
        <Layout onNavigateToSessions={() => setPhase("sessions")}>
          <SetupPage onCoachingStarted={handleCoachingStarted} />
        </Layout>
      );
    case "coaching":
      if (activeSessionId === null) return null;
      return (
        <Layout onNavigateToSessions={() => setPhase("sessions")}>
          <DashboardPage sessionId={activeSessionId} onBackToSetup={() => setPhase("setup")} />
        </Layout>
      );
    case "sessions":
      return (
        <Layout onNavigateToSetup={() => setPhase("setup")}>
          <p className="text-muted-foreground">Session List (Step 8)</p>
        </Layout>
      );
  }
}
