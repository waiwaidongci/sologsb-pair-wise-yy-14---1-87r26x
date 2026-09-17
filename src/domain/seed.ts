import { SurveyStore } from "./store";
import type { SurveyInput } from "./types";

export const SEED_BUILDING = "漱芳斋前殿";
export const SEED_BATCH_1 = "2026-03-春测";
export const SEED_BATCH_2 = "2026-09-秋测";

const base: Omit<SurveyInput, "componentId" | "batchId" | "jointType" | "wood" | "length" | "section" | "damages" | "deformations" | "connections"> = {
  buildingId: SEED_BUILDING,
  surveyor: "李测",
  surveyedAt: "2026-03-12",
};

/**
 * 演示数据：春测 3 件构件；秋测重测梁架A-03（旧建议立即失效）、新测檐柱E-01。
 * 由此关系视图在两个批次间呈现完全不同的同批有效版本集合。
 */
export function createSeededStore(): SurveyStore {
  const store = new SurveyStore();

  store.submitSurvey({
    ...base,
    componentId: "梁架A-03",
    batchId: SEED_BATCH_1,
    wood: "杉木",
    jointType: "透榫",
    length: 4200,
    section: { width: 180, height: 240 },
    damages: [{ kind: "开裂", offsetAlong: 300, offsetAcross: 40, severity: "中" }],
    deformations: [{ kind: "挠曲", value: 18, unit: "mm" }],
    connections: ["柱网C-12"],
  });

  store.submitSurvey({
    ...base,
    componentId: "柱网C-12",
    batchId: SEED_BATCH_1,
    wood: "楠木",
    jointType: "箍头榫",
    length: 3600,
    section: { width: 220, height: 220 },
    damages: [{ kind: "糟朽", offsetAlong: 3500, offsetAcross: 110, severity: "重" }],
    deformations: [{ kind: "倾斜", value: 40, unit: "mm" }],
    connections: ["梁架A-03", "斗拱D-07"],
  });

  store.submitSurvey({
    ...base,
    componentId: "斗拱D-07",
    batchId: SEED_BATCH_1,
    wood: "柏木",
    jointType: "半榫",
    length: 1200,
    section: { width: 120, height: 150 },
    damages: [],
    deformations: [{ kind: "挠曲", value: 6, unit: "mm" }],
    connections: ["柱网C-12"],
  });

  // 秋测：梁架A-03 重新测绘（开裂加重），v1 与旧建议立即失效
  store.submitSurvey({
    ...base,
    componentId: "梁架A-03",
    batchId: SEED_BATCH_2,
    surveyedAt: "2026-09-08",
    wood: "杉木",
    jointType: "透榫",
    length: 4200,
    section: { width: 180, height: 240 },
    damages: [{ kind: "开裂", offsetAlong: 320, offsetAcross: 45, severity: "重" }],
    deformations: [{ kind: "挠曲", value: 55, unit: "mm" }],
    connections: ["柱网C-12"],
  });

  store.submitSurvey({
    ...base,
    componentId: "檐柱E-01",
    batchId: SEED_BATCH_2,
    surveyedAt: "2026-09-08",
    wood: "落叶松",
    jointType: "燕尾榫",
    length: 3400,
    section: { width: 200, height: 200 },
    damages: [{ kind: "虫蛀", offsetAlong: 1200, offsetAcross: 60, severity: "轻" }],
    deformations: [],
    connections: [],
  });

  return store;
}
