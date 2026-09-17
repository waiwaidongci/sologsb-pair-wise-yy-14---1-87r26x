import {
  Advice,
  AppState,
  MORTISE_TYPES,
  MortiseType,
  Relation,
  SurveyVersion,
  ValidSurvey,
} from "./types";

let counter = 0;
export function uid(prefix: string): string {
  counter += 1;
  return `${prefix}_${Date.now().toString(36)}_${counter.toString(36)}`;
}

export function sortByTimeDesc<T extends { batchTime?: number; time?: number; createdAt?: number }>(
  items: T[]
): T[] {
  return [...items].sort((a, b) => {
    const ta = a.batchTime ?? a.time ?? a.createdAt ?? 0;
    const tb = b.batchTime ?? b.time ?? b.createdAt ?? 0;
    return tb - ta;
  });
}

export function buildingKey(name: string): string {
  return name.trim();
}

export function sameBuilding(a: string, b: string): boolean {
  return buildingKey(a) === buildingKey(b);
}

/* ---------------- 测绘校验 ---------------- */

export interface SurveyLike {
  building: string;
  code: string;
  wood: string;
  mortise: string;
  width: string;
  height: string;
  length: string;
  deformation: string;
  diseases: { x: string; y: string; label: string }[];
}

export interface ValidationOk {
  ok: true;
  survey: ValidSurvey;
}

export interface ValidationErr {
  ok: false;
  reasons: string[];
  /** 供表单逐字段标红 */
  fields: Record<string, boolean>;
}

export type ValidationResult = ValidationOk | ValidationErr;

const REQUIRED_TEXTS: { key: keyof SurveyLike; label: string }[] = [
  { key: "building", label: "建筑名称" },
  { key: "code", label: "构件编号" },
  { key: "wood", label: "木材种类" },
  { key: "mortise", label: "榫卯类型" },
  { key: "deformation", label: "变形情况" },
];

export function validateSurvey(input: SurveyLike): ValidationResult {
  const reasons: string[] = [];
  const fields: Record<string, boolean> = {};
  const fail = (field: string, reason: string) => {
    fields[field] = true;
    reasons.push(reason);
  };

  for (const { key, label } of REQUIRED_TEXTS) {
    if (!String(input[key]).trim()) fail(key, `${label}缺失`);
  }

  let mortise: MortiseType | undefined;
  if (input.mortise.trim()) {
    if ((MORTISE_TYPES as readonly string[]).includes(input.mortise.trim())) {
      mortise = input.mortise.trim() as MortiseType;
    } else {
      fail("mortise", `榫卯类型“${input.mortise}”不在登记类型（${MORTISE_TYPES.join("、")}）内`);
    }
  }

  const dims: { key: "width" | "height" | "length"; label: string }[] = [
    { key: "width", label: "截面宽" },
    { key: "height", label: "截面高" },
    { key: "length", label: "构件长" },
  ];
  const nums: Partial<Record<"width" | "height" | "length", number>> = {};
  for (const d of dims) {
    const raw = input[d.key].trim();
    if (!raw) {
      fail(d.key, `${d.label}缺失`);
      continue;
    }
    const n = Number(raw);
    if (!Number.isFinite(n)) fail(d.key, `${d.label}“${raw}”不是数字`);
    else if (n <= 0) fail(d.key, `${d.label}必须为正数，收到 ${n} mm`);
    else nums[d.key] = n;
  }

  const diseases = input.diseases
    .map((d) => ({
      x: d.x.trim(),
      y: d.y.trim(),
      label: d.label.trim(),
    }))
    .filter((d) => d.x !== "" || d.y !== "" || d.label !== "");

  if (diseases.length === 0) {
    fail("diseases", "病害位置至少登记一处（无可见病害时可登记“无可见病害”标记点）");
  }

  const length = nums.length ?? 0;
  const validMarkers = [] as ValidSurvey["diseases"];
  diseases.forEach((d, i) => {
    const row = `diseases.${i}`;
    let px: number;
    let py: number;
    let bad = false;

    if (d.x === "" || !Number.isFinite(Number(d.x))) {
      fail(row + ".x", `第 ${i + 1} 处病害：沿长度位置缺失或不是数字`);
      bad = true;
      px = NaN;
    } else {
      px = Number(d.x);
      if (px < 0 || (length > 0 && px > length)) {
        fail(
          row + ".x",
          `第 ${i + 1} 处病害：沿长度位置 ${px}mm 越界，允许范围 0 ~ ${length || "构件长"}mm`
        );
        bad = true;
      }
    }

    if (d.y === "" || !Number.isFinite(Number(d.y))) {
      fail(row + ".y", `第 ${i + 1} 处病害：截面高度位置缺失或不是数字`);
      bad = true;
      py = NaN;
    } else {
      py = Number(d.y);
      if (py < 0 || py > 1) {
        fail(row + ".y", `第 ${i + 1} 处病害：截面高度位置 ${py} 越界，允许范围 0 ~ 1`);
        bad = true;
      }
    }

    if (!d.label) {
      fail(row + ".label", `第 ${i + 1} 处病害：病害名称缺失`);
      bad = true;
    }
    if (!bad) {
      validMarkers.push({ id: uid("mk"), x: px, y: py, label: d.label });
    }
  });

  if (reasons.length > 0) return { ok: false, reasons, fields };

  return {
    ok: true,
    survey: {
      building: input.building.trim(),
      code: input.code.trim(),
      wood: input.wood.trim(),
      mortise: mortise!,
      width: nums.width!,
      height: nums.height!,
      length: nums.length!,
      deformation: input.deformation.trim(),
      diseases: validMarkers,
    },
  };
}

/* ---------------- 修缮建议规则（只对有效测绘生成） ---------------- */

export function generateAdvice(survey: Pick<ValidSurvey, "diseases" | "deformation" | "mortise" | "code">): string {
  const labels = survey.diseases.map((d) => d.label).join("、");
  const tips: string[] = [];

  if (/糟朽|腐朽|虫蛀/.test(labels)) tips.push("剔除糟朽层并做防腐防虫处理，损失截面超过 1/4 时局部墩接或包镶");
  if (/开裂|裂缝|裂/.test(labels)) tips.push("沿裂缝注结构胶并加设铁箍/碳纤维箍，端部开裂需复查榫肩受力");
  if (/变形|挠曲|倾斜/.test(labels) || /挠曲|倾斜|歪闪/.test(survey.deformation))
    tips.push("卸载支顶后校正变形，监测复位量，禁止强行回正");
  if (/缺损|缺失|残缺/.test(labels)) tips.push("按原形制补配缺失部分，新旧接缝做暗榫拉结并做旧处理");
  if (/潮|霉/.test(labels)) tips.push("排查排水与通风，构件通风晾干后再行修补");
  if (tips.length === 0)
    tips.push("病害轻微，维持原状并纳入年度复测；重点检查" + survey.mortise + "节点松动情况");

  return `针对构件 ${survey.code}（${labels}）：${tips.join("；")}。`;
}

/* ---------------- 版本与批次查询 ---------------- */

export function versionsOf(state: AppState, building: string, code: string): SurveyVersion[] {
  return state.surveys
    .filter((s) => sameBuilding(s.building, building) && s.code === code)
    .sort((a, b) => a.version - b.version);
}

export function currentVersionOf(state: AppState, building: string, code: string): SurveyVersion | undefined {
  const list = versionsOf(state, building, code);
  return list.length ? list[list.length - 1] : undefined;
}

/** 当前有效测绘：建筑内每个构件编号只认版本号最大的一条 */
export function currentSurveys(state: AppState, building: string): SurveyVersion[] {
  const map = new Map<string, SurveyVersion>();
  for (const s of state.surveys) {
    if (!sameBuilding(s.building, building)) continue;
    const prev = map.get(s.code);
    if (!prev || s.version > prev.version) map.set(s.code, s);
  }
  return [...map.values()].sort((a, b) => a.code.localeCompare(b.code, "zh"));
}

/** 仅当该测绘仍是构件最新有效版本时，其建议才算生效 */
export function activeAdviceOf(state: AppState, surveyId: string): Advice | undefined {
  const advice = state.advices.find((a) => a.surveyId === surveyId);
  if (!advice) return undefined;
  const cur = currentVersionOf(state, advice.building, advice.code);
  return cur && cur.id === surveyId ? advice : undefined;
}

/** 已失效但保留可查的建议 */
export function expiredAdvices(state: AppState): Advice[] {
  return state.advices.filter((a) => {
    const cur = currentVersionOf(state, a.building, a.code);
    return !cur || cur.id !== a.surveyId;
  });
}

export interface BatchInfo {
  id: string;
  time: number;
  surveys: SurveyVersion[];
}

export function listBatches(state: AppState): BatchInfo[] {
  const map = new Map<string, BatchInfo>();
  for (const s of state.surveys) {
    const b = map.get(s.batchId);
    if (b) b.surveys.push(s);
    else map.set(s.batchId, { id: s.batchId, time: s.batchTime, surveys: [s] });
  }
  return [...map.values()]
    .map((b) => ({ ...b, time: Math.max(...b.surveys.map((s) => s.batchTime)) }))
    .sort((a, b) => b.time - a.time);
}

export function batchInfo(state: AppState, batchId: string): BatchInfo | undefined {
  const surveys = state.surveys.filter((s) => s.batchId === batchId);
  if (surveys.length === 0) return undefined;
  return { id: batchId, time: Math.max(...surveys.map((s) => s.batchTime)), surveys };
}

/** 构件在指定批次当日的有效版本：不晚于该批次时间的最大版本号（快照一致性的基础） */
export function effectiveAt(
  state: AppState,
  building: string,
  code: string,
  batchTime: number
): SurveyVersion | undefined {
  const list = versionsOf(state, building, code)
    .filter((s) => s.batchTime <= batchTime)
    .sort((a, b) => a.version - b.version);
  return list.length ? list[list.length - 1] : undefined;
}

/* ---------------- 构件关系视图：同批次快照 + 混用拦截 ---------------- */

export interface RelationNode {
  code: string;
  survey?: SurveyVersion;
  /** 该构件在锚定批次当日尚无任何测绘 */
  missing: boolean;
  /** 引用的不是当前有效版本（过期版本）—— 禁止进入施工清单 */
  stale: boolean;
}

export interface RelationEdge {
  id: string;
  from: string;
  to: string;
  kind: Relation["kind"];
}

export interface ResolvedRelation {
  nodes: RelationNode[];
  edges: RelationEdge[];
  staleCodes: string[];
  missingCodes: string[];
  consistent: boolean;
}

export function resolveRelations(state: AppState, building: string, anchorBatchId: string): ResolvedRelation {
  const anchor = batchInfo(state, anchorBatchId);
  // 锚点取批次内最后一次测绘时刻：同一批次窗口内的全部测绘互为有效
  const time = anchor ? Math.max(...anchor.surveys.map((s) => s.batchTime)) : Date.now();
  const rels = state.relations.filter((r) => sameBuilding(r.building, building));
  const codes = new Set<string>();
  rels.forEach((r) => {
    codes.add(r.from);
    codes.add(r.to);
  });

  const nodes: RelationNode[] = [...codes].sort().map((code) => {
    const snap = effectiveAt(state, building, code, time);
    const cur = currentVersionOf(state, building, code);
    return {
      code,
      survey: snap,
      missing: !snap,
      stale: !!snap && !!cur && snap.id !== cur.id,
    };
  });

  const edges: RelationEdge[] = rels.map((r) => ({ id: r.id, from: r.from, to: r.to, kind: r.kind }));
  const staleCodes = nodes.filter((n) => n.stale || n.missing).map((n) => n.code);
  const missingCodes = nodes.filter((n) => n.missing).map((n) => n.code);

  return {
    nodes,
    edges,
    staleCodes,
    missingCodes,
    consistent: staleCodes.length === 0,
  };
}

/** 施工清单：只允许引用各构件当前有效版本，绝不放行过期版本 */
export function buildConstructionList(state: AppState, building: string):
  | { ok: true; items: { code: string; survey: SurveyVersion; advice?: Advice }[] }
  | { ok: false; reasons: string[] } {
  const latest = listBatches(state)[0];
  if (!latest) return { ok: false, reasons: ["尚无测绘批次，无法生成施工清单"] };

  const resolved = resolveRelations(state, building, latest.id);
  const reasons: string[] = [];
  if (resolved.missingCodes.length)
    reasons.push(`以下关系构件在最新批次“${formatBatch(latest.id, latest.time)}”当日无有效测绘：${resolved.missingCodes.join("、")}`);
  if (resolved.staleCodes.filter((c) => !resolved.missingCodes.includes(c)).length)
    reasons.push(
      `检测到过期版本引用（混用批次）：${resolved.staleCodes
        .filter((c) => !resolved.missingCodes.includes(c))
        .join("、")}，请重新测绘后再生成`
    );
  if (reasons.length) return { ok: false, reasons };

  const items = resolved.nodes.map((n) => {
    const survey = n.survey!;
    return { code: n.code, survey, advice: activeAdviceOf(state, survey.id) };
  });
  if (items.length === 0) return { ok: false, reasons: ["该建筑暂无构件关系，无法生成施工清单"] };
  return { ok: true, items };
}

/* ---------------- 展示辅助 ---------------- */

export function dimsText(s: { width: number; height: number; length: number } | ValidSurvey | SurveyVersion): string {
  return `${s.width}×${s.height}×${s.length} mm`;
}

export function formatTime(t: number): string {
  const d = new Date(t);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function formatBatch(id: string, time: number): string {
  return `${id}（${formatTime(time)}）`;
}
