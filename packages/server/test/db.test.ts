import { describe, expect, test } from "bun:test";
import { findAdvicesBySessionId, insertAdvice } from "../src/db/advices";
import { createDatabase } from "../src/db/database";
import { findPlanBySessionId, insertPlan } from "../src/db/plans";
import {
  endSession,
  findSessionById,
  insertSession,
  listSessions,
  purgeOldSessions,
} from "../src/db/sessions";

function createTestDb() {
  return createDatabase(":memory:");
}

describe("sessions", () => {
  test("insertしたセッションをfindByIdで取得できる", () => {
    const db = createTestDb();
    insertSession(db, {
      id: "s1",
      goal: "ロゴを作る",
      referenceImagePath: "/tmp/ref.png",
      displayId: "0",
      displayName: "Main",
    });

    const session = findSessionById(db, "s1");
    expect(session).not.toBeNull();
    expect(session?.goal).toBe("ロゴを作る");
    expect(session?.displayName).toBe("Main");
    expect(session?.endedAt).toBeNull();
  });

  test("endSessionでendedAtが設定される", () => {
    const db = createTestDb();
    insertSession(db, {
      id: "s2",
      goal: "テスト",
      referenceImagePath: "/tmp/ref.png",
      displayId: "0",
      displayName: "Main",
    });

    endSession(db, "s2");
    const session = findSessionById(db, "s2");
    expect(session?.endedAt).not.toBeNull();
  });

  test("listSessionsで降順に取得できる", () => {
    const db = createTestDb();
    insertSession(db, {
      id: "s1",
      goal: "1つ目",
      referenceImagePath: "/tmp/ref.png",
      displayId: "0",
      displayName: "Main",
    });
    insertSession(db, {
      id: "s2",
      goal: "2つ目",
      referenceImagePath: "/tmp/ref.png",
      displayId: "0",
      displayName: "Main",
    });

    const sessions = listSessions(db);
    expect(sessions).toHaveLength(2);
  });

  test("存在しないidはnullを返す", () => {
    const db = createTestDb();
    expect(findSessionById(db, "nonexistent")).toBeNull();
  });
});

function insertDummySession(db: ReturnType<typeof createTestDb>, id: string, imagePath: string) {
  insertSession(db, {
    id,
    goal: `goal-${id}`,
    referenceImagePath: imagePath,
    displayId: "0",
    displayName: "Main",
  });
}

describe("purgeOldSessions", () => {
  test("200件以下のとき何も削除されない", () => {
    const db = createTestDb();
    for (let i = 0; i < 5; i++) {
      insertDummySession(db, `s${i}`, `/tmp/${i}.png`);
    }

    const purged = purgeOldSessions(db, "current");

    expect(purged).toHaveLength(0);
    expect(listSessions(db)).toHaveLength(5);
  });

  test("201件以上のとき、ID降順で末尾のセッションが削除される", () => {
    const db = createTestDb();
    for (let i = 0; i < 203; i++) {
      insertDummySession(db, `s${String(i).padStart(4, "0")}`, `/tmp/${i}.png`);
    }

    const purged = purgeOldSessions(db, "s0202");

    expect(purged).toHaveLength(3);
    const purgedIds = purged.map((r) => r.id);
    expect(purgedIds).toContain("s0000");
    expect(purgedIds).toContain("s0001");
    expect(purgedIds).toContain("s0002");
    expect(listSessions(db)).toHaveLength(200);
    expect(findSessionById(db, "s0003")).not.toBeNull();
  });

  test("excludeSessionIdは削除対象から除外されつつ他は削除される", () => {
    const db = createTestDb();
    for (let i = 0; i < 203; i++) {
      insertDummySession(db, `s${String(i).padStart(4, "0")}`, `/tmp/${i}.png`);
    }

    purgeOldSessions(db, "s0000");

    expect(findSessionById(db, "s0000")).not.toBeNull();
    expect(findSessionById(db, "s0001")).toBeNull();
    expect(findSessionById(db, "s0002")).toBeNull();
    expect(listSessions(db)).toHaveLength(201);
  });

  test("削除時に関連するadvicesとplansも削除される", () => {
    const db = createTestDb();
    for (let i = 0; i < 203; i++) {
      const id = `s${String(i).padStart(4, "0")}`;
      insertDummySession(db, id, `/tmp/${i}.png`);
      insertPlan(db, {
        id: `p${i}`,
        sessionId: id,
        goal: "g",
        referenceSummary: "r",
        steps: [],
      });
      insertAdvice(db, {
        id: `a${i}`,
        sessionId: id,
        planId: `p${i}`,
        roundIndex: 0,
        content: "c",
        timestampMs: i,
      });
    }

    purgeOldSessions(db, "s0202");

    const purgedId = "s0000";
    expect(findSessionById(db, purgedId)).toBeNull();
    expect(findPlanBySessionId(db, purgedId)).toBeNull();
    expect(findAdvicesBySessionId(db, purgedId)).toHaveLength(0);
    const keptId = "s0003";
    expect(findSessionById(db, keptId)).not.toBeNull();
    expect(findPlanBySessionId(db, keptId)).not.toBeNull();
    expect(findAdvicesBySessionId(db, keptId)).toHaveLength(1);
  });

  test("他セッションが参照中の画像パスは返り値から除外されるがDB削除は行われる", () => {
    const db = createTestDb();
    const sharedPath = "/tmp/shared.png";
    for (let i = 0; i < 203; i++) {
      insertDummySession(db, `s${String(i).padStart(4, "0")}`, sharedPath);
    }

    const purged = purgeOldSessions(db, "s0202");

    expect(purged).toHaveLength(0);
    expect(listSessions(db)).toHaveLength(200);
    expect(findSessionById(db, "s0000")).toBeNull();
  });
});

describe("plans", () => {
  test("insertしたプランをsessionIdで取得できる", () => {
    const db = createTestDb();
    insertSession(db, {
      id: "s1",
      goal: "テスト",
      referenceImagePath: "/tmp/ref.png",
      displayId: "0",
      displayName: "Main",
    });
    insertPlan(db, {
      id: "p1",
      sessionId: "s1",
      goal: "プラン目標",
      referenceSummary: "分析結果",
      steps: [{ index: 1, application: "Photoshop", description: "作業", status: "pending" }],
    });

    const plan = findPlanBySessionId(db, "s1");
    expect(plan).not.toBeNull();
    expect(plan?.goal).toBe("プラン目標");

    const steps = JSON.parse(plan?.steps);
    expect(steps).toHaveLength(1);
    expect(steps[0].application).toBe("Photoshop");
  });

  test("セッションが存在しない場合FK制約でエラーになる", () => {
    const db = createTestDb();
    expect(() =>
      insertPlan(db, {
        id: "p1",
        sessionId: "nonexistent",
        goal: "テスト",
        referenceSummary: "テスト",
        steps: [],
      }),
    ).toThrow();
  });
});

describe("advices", () => {
  test("insertしたアドバイスをsessionIdで取得できる", () => {
    const db = createTestDb();
    insertSession(db, {
      id: "s1",
      goal: "テスト",
      referenceImagePath: "/tmp/ref.png",
      displayId: "0",
      displayName: "Main",
    });

    insertAdvice(db, {
      id: "a1",
      sessionId: "s1",
      planId: null,
      roundIndex: 0,
      content: "いい感じです",
      timestampMs: 1000,
    });
    insertAdvice(db, {
      id: "a2",
      sessionId: "s1",
      planId: null,
      roundIndex: 1,
      content: "次はレイヤーを追加",
      timestampMs: 2000,
    });

    const advices = findAdvicesBySessionId(db, "s1");
    expect(advices).toHaveLength(2);
    expect(advices[0].content).toBe("いい感じです");
    expect(advices[1].content).toBe("次はレイヤーを追加");
  });

  test("timestampMs順に昇順で返る", () => {
    const db = createTestDb();
    insertSession(db, {
      id: "s1",
      goal: "テスト",
      referenceImagePath: "/tmp/ref.png",
      displayId: "0",
      displayName: "Main",
    });

    insertAdvice(db, {
      id: "a1",
      sessionId: "s1",
      planId: null,
      roundIndex: 1,
      content: "後のアドバイス",
      timestampMs: 5000,
    });
    insertAdvice(db, {
      id: "a2",
      sessionId: "s1",
      planId: null,
      roundIndex: 0,
      content: "先のアドバイス",
      timestampMs: 1000,
    });

    const advices = findAdvicesBySessionId(db, "s1");
    expect(advices[0].timestampMs).toBe(1000);
    expect(advices[1].timestampMs).toBe(5000);
  });
});
