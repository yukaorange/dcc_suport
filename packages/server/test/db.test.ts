import { describe, expect, test } from "bun:test";
import { findAdvicesBySessionId, insertAdvice } from "../src/db/advices";
import { createDatabase } from "../src/db/database";
import { findPlanBySessionId, insertPlan } from "../src/db/plans";
import { endSession, findSessionById, insertSession, listSessions } from "../src/db/sessions";

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
