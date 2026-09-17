export const MORTISE_TYPES = ["燕尾榫", "透榫", "半榫", "箍头榫"] as const;
export type MortiseType = (typeof MORTISE_TYPES)[number];

export const WOOD_SUGGESTIONS = ["楠木", "松木", "榆木", "樟木", "柏木"];

export const RELATION_KINDS = ["榫接", "搭接", "承托"] as const;
export type RelationKind = (typeof RELATION_KINDS)[number];

/** 病害点：x 为沿构件长度方向的毫米位置（0 ~ 构件长），y 为截面高度方向的归一化位置（0 ~ 1） */
export interface DiseaseMarker {
  id: string;
  x: number;
  y: number;
  label: string;
}

/** 表单中的病害行，数字以字符串承载，提交时统一校验 */
export interface DiseaseDraft {
  id: string;
  x: string;
  y: string;
  label: string;
}

export interface SurveyDraft {
  building: string;
  code: string;
  wood: string;
  mortise: string;
  width: string;
  height: string;
  length: string;
  deformation: string;
  diseases: DiseaseDraft[];
}

/** 一次校验通过的测绘，可落为新版本 */
export interface ValidSurvey {
  building: string;
  code: string;
  wood: string;
  mortise: MortiseType;
  width: number;
  height: number;
  length: number;
  deformation: string;
  diseases: DiseaseMarker[];
}

/** 测绘版本：同一建筑同一编号的每次“有效提交”追加一条，历史版本永不覆盖 */
export interface SurveyVersion extends ValidSurvey {
  id: string;
  version: number;
  batchId: string;
  batchTime: number;
}

/** 修缮建议：每条只绑定一个测绘版本；测绘被新版本取代即随之失效，记录仍保留 */
export interface Advice {
  id: string;
  surveyId: string;
  building: string;
  code: string;
  version: number;
  batchId: string;
  createdAt: number;
  content: string;
}

export interface Relation {
  id: string;
  building: string;
  /** from 构件编号 -> to 构件编号 */
  from: string;
  to: string;
  kind: RelationKind;
}

/** 被拒收的测绘留痕：绝不产生新版本、绝不影响旧测绘 */
export interface Rejection {
  id: string;
  time: number;
  building: string;
  code: string;
  reasons: string[];
}

export interface AppState {
  surveys: SurveyVersion[];
  advices: Advice[];
  relations: Relation[];
  rejections: Rejection[];
  batchSeq: number;
}
