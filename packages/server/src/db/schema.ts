import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text } from "drizzle-orm/sqlite-core";

export const sessions = sqliteTable("sessions", {
  id: text("id").primaryKey(),
  goal: text("goal").notNull(),
  displayId: text("display_id").notNull(),
  displayName: text("display_name").notNull().default(""),
  startedAt: text("started_at").notNull().default(sql`(datetime('now'))`),
  endedAt: text("ended_at"),
});

export const sessionImages = sqliteTable(
  "session_images",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => sessions.id),
    filePath: text("file_path").notNull(),
    label: text("label").notNull().default(""),
    sortOrder: integer("sort_order").notNull().default(0),
    imageType: text("image_type").notNull().default("reference"),
  },
  (table) => [index("idx_session_images_session").on(table.sessionId)],
);

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
    isRestored: integer("is_restored").notNull().default(0),
  },
  (table) => [index("idx_advices_session").on(table.sessionId)],
);
