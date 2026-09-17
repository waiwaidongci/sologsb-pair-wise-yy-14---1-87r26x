import { AppState, DiseaseMarker, Relation, SurveyVersion } from "./types";
import { generateAdvice, uid } from "./domain";

const DAY = 24 * 60 * 60 * 1000;
const BASE = new Date("2026-03-10T09:00:00").getTime();

function mk(...markers: [number, number, string][]): DiseaseMarker[] {
  return markers.map(([x, y, label]) => ({ id: uid("mk"), x, y, label }));
}

function version(
  state: AppState,
  building: string,
  code: string,
  wood: string,
  mortise: SurveyVersion["mortise"],
  width: number,
  height: number,
  length: number,
  deformation: string,
  diseases: DiseaseMarker[],
  batchId: string,
  batchTime: number
): SurveyVersion {
  const prev = state.surveys.filter((s) => s.building === building && s.code === code);
  const survey: SurveyVersion = {
    id: uid("sv"),
    building,
    code,
    wood,
    mortise,
    width,
    height,
    length,
    deformation,
    diseases,
    version: prev.length + 1,
    batchId,
    batchTime,
  };
  state.surveys.push(survey);
  state.advices.push({
    id: uid("ad"),
    surveyId: survey.id,
    building,
    code,
    version: survey.version,
    batchId,
    createdAt: batchTime,
    content: generateAdvice(survey),
  });
  return survey;
}

function relations(state: AppState, building: string, pairs: [string, string, Relation["kind"]][]): void {
  pairs.forEach(([from, to, kind]) =>
    state.relations.push({ id: uid("rl"), building, from, to, kind })
  );
}

/** 初始示例：同一建筑大雄宝殿，3 个批次；D-07 在批次 B3 重新测绘，v1 建议随 v2 失效但仍可查 */
export function buildSeed(): AppState {
  const state: AppState = { surveys: [], advices: [], relations: [], rejections: [], batchSeq: 0 };
  const B1 = "B1";
  const B2 = "B2";
  const B3 = "B3";

  version(state, "大雄宝殿", "A-03", "楠木", "透榫", 180, 240, 4200, "跨中轻微挠曲 6mm",
    mk([120, 0.15, "端部开裂"], [2100, 0.5, "跨中挠曲"]), B1, BASE);

  version(state, "大雄宝殿", "C-12", "楠木", "箍头榫", 320, 320, 3600, "柱脚轻微沉降",
    mk([90, 0.9, "柱脚糟朽"]), B1, BASE + 2 * 60 * 60 * 1000);

  version(state, "大雄宝殿", "D-07", "榆木", "半榫", 120, 160, 900, "无明显变形",
    mk([60, 0.2, "榫头缺损"]), B1, BASE + 3 * 60 * 60 * 1000);

  relations(state, "大雄宝殿", [
    ["C-12", "A-03", "承托"],
    ["A-03", "D-07", "榫接"],
    ["C-12", "D-07", "搭接"],
  ]);

  // B2：关系调整（新增大额枋构件测绘也可，这里保持关系不变，仅展示后续批次）
  version(state, "大雄宝殿", "E-01", "松木", "燕尾榫", 150, 200, 3000, "无明显变形",
    mk([0, 0, "无可见病害"]), B2, BASE + 20 * DAY);
  state.relations.push({ id: uid("rl"), building: "大雄宝殿", from: "E-01", to: "A-03", kind: "搭接" });

  // B3：D-07 重新测绘（有效提交）——v2 生效，v1 建议立即失效、v1 测绘仍保留
  version(state, "大雄宝殿", "D-07", "榆木", "透榫", 125, 165, 900, "榫肩变形 3mm",
    mk([80, 0.25, "榫头缺损"], [420, 0.6, "榫肩开裂"]), B3, BASE + 45 * DAY);

  state.batchSeq = 3;
  return state;
}

export const STORAGE_KEY = "timber-survey-closed-loop-v1";
