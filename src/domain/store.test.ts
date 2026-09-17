import { describe, expect, it } from "vitest";
import { SurveyStore } from "./store";
import type { SurveyInput } from "./types";

const BUILDING = "测试殿";

function validInput(overrides: Partial<SurveyInput> = {}): SurveyInput {
  return {
    buildingId: BUILDING,
    componentId: "梁A-01",
    batchId: "B1",
    wood: "杉木",
    jointType: "透榫",
    length: 4000,
    section: { width: 200, height: 300 },
    damages: [{ kind: "开裂", offsetAlong: 500, offsetAcross: 50, severity: "中" }],
    deformations: [{ kind: "挠曲", value: 10, unit: "mm" }],
    connections: [],
    surveyor: "张三",
    surveyedAt: "2026-09-01",
    ...overrides,
  };
}

describe("录入校验：字段齐全与合法性", () => {
  it("木材、榫卯类型、截面、病害、变形任一缺失即拒绝", () => {
    const store = new SurveyStore();
    const cases: Partial<SurveyInput>[] = [
      { wood: "" },
      { jointType: "  " },
      { section: undefined },
      { damages: undefined },
      { deformations: undefined },
    ];
    for (const patch of cases) {
      const result = store.submitSurvey(validInput(patch));
      expect(result.ok).toBe(false);
    }
    expect(store.listComponents()).toHaveLength(0);
  });

  it("截面尺寸非正 → 拒绝且不覆盖旧测绘", () => {
    const store = new SurveyStore();
    expect(store.submitSurvey(validInput()).ok).toBe(true);

    for (const bad of [
      { width: 0, height: 300 },
      { width: -10, height: 300 },
      { width: 200, height: 0 },
      { width: 200, height: Number.NaN },
    ]) {
      const result = store.submitSurvey(validInput({ section: bad }));
      expect(result.ok).toBe(false);
    }

    // 旧测绘未被覆盖：仍是 v1 且有效
    const current = store.getCurrentVersion(BUILDING, "梁A-01");
    expect(current?.versionNo).toBe(1);
    expect(current?.status).toBe("valid");
    expect(store.getVersionHistory(BUILDING, "梁A-01")).toHaveLength(1);
    expect(store.getActiveSuggestion(BUILDING, "梁A-01")?.status).toBe("active");
  });

  it("病害位置越界 → 拒绝且不覆盖旧测绘", () => {
    const store = new SurveyStore();
    expect(store.submitSurvey(validInput()).ok).toBe(true);

    const outOfBounds = [
      { kind: "糟朽", offsetAlong: 4001, offsetAcross: 10, severity: "轻" as const }, // 超过 length
      { kind: "糟朽", offsetAlong: -1, offsetAcross: 10, severity: "轻" as const }, // 负轴向
      { kind: "糟朽", offsetAlong: 100, offsetAcross: 201, severity: "轻" as const }, // 超过截面宽
      { kind: "糟朽", offsetAlong: 100, offsetAcross: -5, severity: "轻" as const }, // 负横向
    ];
    for (const damage of outOfBounds) {
      const result = store.submitSurvey(validInput({ damages: [damage] }));
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.errors.some((e) => e.message.includes("越界") || e.message.includes("非负"))).toBe(true);
      }
    }

    expect(store.getVersionHistory(BUILDING, "梁A-01")).toHaveLength(1);
    expect(store.getCurrentVersion(BUILDING, "梁A-01")?.versionNo).toBe(1);
  });

  it("边界上的病害位置（0 与 length / width）合法", () => {
    const store = new SurveyStore();
    const result = store.submitSurvey(
      validInput({
        damages: [
          { kind: "开裂", offsetAlong: 0, offsetAcross: 0, severity: "轻" },
          { kind: "糟朽", offsetAlong: 4000, offsetAcross: 200, severity: "轻" },
        ],
      }),
    );
    expect(result.ok).toBe(true);
  });
});

describe("构件编号唯一与版本更替", () => {
  it("同一建筑内构件编号唯一：重复提交是重新测绘而非新构件", () => {
    const store = new SurveyStore();
    store.submitSurvey(validInput());
    const again = store.submitSurvey(validInput({ batchId: "B2", surveyedAt: "2026-09-10" }));

    expect(again.ok).toBe(true);
    if (again.ok) {
      expect(again.version.versionNo).toBe(2);
      expect(again.replacedVersionNo).toBe(1);
    }
    expect(store.listComponents(BUILDING)).toHaveLength(1);
    expect(store.getVersionHistory(BUILDING, "梁A-01")).toHaveLength(2);
  });

  it("不同建筑允许相同构件编号", () => {
    const store = new SurveyStore();
    store.submitSurvey(validInput());
    store.submitSurvey(validInput({ buildingId: "另一座殿" }));
    expect(store.listComponents()).toHaveLength(2);
    expect(store.listComponents(BUILDING)).toHaveLength(1);
  });
});

describe("修缮建议闭环", () => {
  it("建议只来自最新有效测绘；重新测绘立即让旧建议失效、旧版本仍可查", () => {
    const store = new SurveyStore();
    const first = store.submitSurvey(validInput());
    expect(first.ok).toBe(true);
    if (!first.ok) return;
    const oldSuggestionId = first.suggestion.id;

    const second = store.submitSurvey(
      validInput({
        batchId: "B2",
        surveyedAt: "2026-09-10",
        damages: [{ kind: "糟朽", offsetAlong: 3800, offsetAcross: 100, severity: "重" }],
      }),
    );
    expect(second.ok).toBe(true);
    if (!second.ok) return;

    // 旧建议立即失效，新建议生效且指向 v2
    const active = store.getActiveSuggestion(BUILDING, "梁A-01");
    expect(active?.versionId).toBe(second.version.versionId);
    expect(active?.versionNo).toBe(2);
    expect(active?.items[0].action).toContain("墩接");

    const history = store.getSuggestionHistory(BUILDING, "梁A-01");
    expect(history).toHaveLength(2);
    expect(history.find((s) => s.id === oldSuggestionId)?.status).toBe("invalid");

    // 旧版本仍可查
    const versions = store.getVersionHistory(BUILDING, "梁A-01");
    expect(versions.map((v) => v.versionNo)).toEqual([2, 1]);
    expect(versions.find((v) => v.versionNo === 1)?.status).toBe("superseded");
    expect(versions.find((v) => v.versionNo === 2)?.status).toBe("valid");
  });

  it("无病害无变形 → 建议为日常保养，不进入施工清单", () => {
    const store = new SurveyStore();
    const result = store.submitSurvey(validInput({ damages: [], deformations: [] }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.suggestion.items[0].action).toContain("日常保养");
    expect(store.getConstructionList(BUILDING, "B1")).toHaveLength(0);
  });
});

describe("构件关系视图：只引用同批有效版本", () => {
  function seeded() {
    const store = new SurveyStore();
    store.submitSurvey(validInput({ componentId: "甲", batchId: "B1", connections: ["乙"] }));
    store.submitSurvey(validInput({ componentId: "乙", batchId: "B1", connections: ["甲"] }));
    store.submitSurvey(validInput({ componentId: "丙", batchId: "B1" }));
    // B2 只重测了甲
    store.submitSurvey(
      validInput({
        componentId: "甲",
        batchId: "B2",
        surveyedAt: "2026-09-10",
        damages: [{ kind: "糟朽", offsetAlong: 100, offsetAcross: 10, severity: "重" }],
        connections: ["乙"],
      }),
    );
    return store;
  }

  it("视图内每个节点都是本批次的 valid 版本", () => {
    const store = seeded();

    const viewB1 = store.getRelationshipView(BUILDING, "B1");
    // 甲的 B1 版本已被取代 → 被排除，绝不混用过期版本
    expect(viewB1.nodes.map((n) => n.componentId).sort()).toEqual(["丙", "乙"]);
    expect(viewB1.excluded.map((e) => e.componentId)).toEqual(["甲"]);
    expect(viewB1.excluded[0].reason).toContain("取代");
    for (const node of viewB1.nodes) {
      expect(node.batchId).toBe("B1");
      const version = store.getCurrentVersion(BUILDING, node.componentId);
      expect(version?.versionId).toBe(node.versionId);
      expect(version?.status).toBe("valid");
    }
    // 甲乙连接因甲被排除而不出现在 B1 视图
    expect(viewB1.edges).toHaveLength(0);

    const viewB2 = store.getRelationshipView(BUILDING, "B2");
    expect(viewB2.nodes.map((n) => n.componentId)).toEqual(["甲"]);
    expect(viewB2.nodes[0].versionNo).toBe(2);
    // 乙、丙在 B2 未测绘 → 排除并说明
    expect(viewB2.excluded.map((e) => e.componentId).sort()).toEqual(["丙", "乙"]);
    expect(viewB2.edges).toHaveLength(0);
  });

  it("施工清单只含同批有效版本且确有修缮项的构件", () => {
    const store = seeded();

    const listB1 = store.getConstructionList(BUILDING, "B1");
    // B1 视图：乙（中优先级开裂嵌补加箍）、丙（同）在列；甲的过期版本不得混入
    expect(listB1.map((i) => i.componentId).sort()).toEqual(["丙", "乙"]);
    expect(listB1.every((i) => i.batchId === "B1")).toBe(true);

    const listB2 = store.getConstructionList(BUILDING, "B2");
    expect(listB2.map((i) => i.componentId)).toEqual(["甲"]);
    expect(listB2[0].versionNo).toBe(2);
    expect(listB2[0].topPriority).toBe("高");
  });
});
