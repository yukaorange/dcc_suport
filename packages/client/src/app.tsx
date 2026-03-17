import { useState } from "react";
import { Layout } from "./components/shared/layout";
import { trpc } from "./trpc";

type AppPhase = "setup" | "coaching" | "sessions";

export function App() {
  const [phase, setPhase] = useState<AppPhase>("setup");
  const [_activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const handleCoachingStarted = (sessionId: string) => {
    setActiveSessionId(sessionId);
    setPhase("coaching");
  };

  switch (phase) {
    case "setup":
      return (
        <Layout onNavigateToSessions={() => setPhase("sessions")}>
          <SetupPlaceholder onCoachingStarted={handleCoachingStarted} />
        </Layout>
      );
    case "coaching":
      return (
        <Layout onNavigateToSessions={() => setPhase("sessions")}>
          <p className="text-muted-foreground">Dashboard (Step 7)</p>
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

function SetupPlaceholder(props: { readonly onCoachingStarted: (sessionId: string) => void }) {
  return (
    <div className="space-y-4">
      <h2 className="text-xl font-semibold">Setup (Step 6)</h2>
      <p className="text-muted-foreground">Display list test:</p>
      <DisplayListTest />
      <button
        type="button"
        className="rounded bg-primary px-4 py-2 text-primary-foreground"
        onClick={() => props.onCoachingStarted("test-session-id")}
      >
        Start (placeholder)
      </button>
    </div>
  );
}

function DisplayListTest() {
  const { data, isLoading, error } = trpc.display.list.useQuery();

  if (isLoading) return <p>Loading displays...</p>;
  if (error) return <p className="text-destructive">Error: {error.message}</p>;

  return (
    <ul className="list-disc pl-6">
      {data?.displays.map((d) => (
        <li key={d.id}>
          {d.name} ({d.id})
        </li>
      ))}
    </ul>
  );
}
