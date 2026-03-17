import { useState } from "react";
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
      return (
        <Layout onNavigateToSessions={() => setPhase("sessions")}>
          <p className="text-muted-foreground">Dashboard - session: {activeSessionId} (Step 7)</p>
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
