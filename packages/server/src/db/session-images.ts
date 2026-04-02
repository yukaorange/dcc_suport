import { and, eq } from "drizzle-orm";
import type { DrizzleDb } from "./database";
import { sessionImages } from "./schema";

type ImageType = "reference" | "attachment";

type SessionImageInput = {
  readonly filePath: string;
  readonly label: string;
};

export type { ImageType, SessionImageInput };

export function insertSessionImages(
  db: DrizzleDb,
  sessionId: string,
  images: readonly SessionImageInput[],
  imageType: ImageType = "reference",
): void {
  for (let i = 0; i < images.length; i++) {
    db.insert(sessionImages)
      .values({
        id: crypto.randomUUID(),
        sessionId,
        filePath: images[i].filePath,
        label: images[i].label,
        sortOrder: i,
        imageType,
      })
      .run();
  }
}

type SessionImageRow = {
  readonly filePath: string;
  readonly label: string;
};

export function findSessionImagesByType(
  db: DrizzleDb,
  sessionId: string,
  imageType: ImageType,
): readonly SessionImageRow[] {
  return db
    .select({ filePath: sessionImages.filePath, label: sessionImages.label })
    .from(sessionImages)
    .where(and(eq(sessionImages.sessionId, sessionId), eq(sessionImages.imageType, imageType)))
    .orderBy(sessionImages.sortOrder)
    .all();
}

type AllSessionImageRow = {
  readonly filePath: string;
  readonly imageType: string;
};

export function findAllSessionImages(
  db: DrizzleDb,
  sessionId: string,
): readonly AllSessionImageRow[] {
  return db
    .select({ filePath: sessionImages.filePath, imageType: sessionImages.imageType })
    .from(sessionImages)
    .where(eq(sessionImages.sessionId, sessionId))
    .all();
}

export function copyReferenceImages(
  db: DrizzleDb,
  fromSessionId: string,
  toSessionId: string,
): void {
  const rows = db
    .select()
    .from(sessionImages)
    .where(
      and(eq(sessionImages.sessionId, fromSessionId), eq(sessionImages.imageType, "reference")),
    )
    .orderBy(sessionImages.sortOrder)
    .all();

  for (const row of rows) {
    db.insert(sessionImages)
      .values({
        id: crypto.randomUUID(),
        sessionId: toSessionId,
        filePath: row.filePath,
        label: row.label,
        sortOrder: row.sortOrder,
        imageType: "reference",
      })
      .run();
  }
}

export function deleteSessionImages(db: DrizzleDb, sessionId: string): void {
  db.delete(sessionImages).where(eq(sessionImages.sessionId, sessionId)).run();
}
