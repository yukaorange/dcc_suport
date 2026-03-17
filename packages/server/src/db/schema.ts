import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  goal: text("goal").notNull(),
  referenceImagePath: text("reference_image_path").notNull(),
  displayId: text("display_id").notNull(),
  displayName: text("display_name").notNull().default(""),
  startedAt: text("started_at").notNull().default(sql`(datetime('now'))`),
  endedAt: text("ended_at"),
});

export const plans = sqliteTable(
  "plans",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    goal: text("goal").notNull(),
    referenceSummary: text("reference_summary").notNull(),
    steps: text("steps").notNull(),
    createdAt: text("created_at").notNull().default(sql`(datetime('now'))`),
  },
  (table) => [index("idx_plans_session").on(table.sessionId)],
);

export const advices = sqliteTable(
  "advices",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    planId: text("plan_id").references(() => plans.id),
    roundIndex: integer("round_index").notNull(),
    content: text("content").notNull(),
    timestampMs: integer("timestamp_ms").notNull(),
  },
  (table) => [index("idx_advices_session").on(table.sessionId)],
);
