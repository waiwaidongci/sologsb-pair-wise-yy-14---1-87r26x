/**
 * 古建木构测绘 · 领域模型
 *
 * 版本闭环核心概念：
 * - 构件身份 = (buildingId, componentId)，同一建筑内构件编号唯一；
 * - 每次有效测绘在构件下追加一个 SurveyVersion，旧版本置为 superseded，仍可查询；
 * - 修缮建议只由最新有效版本生成，重新测绘立即让旧建议失效；
 * - 构件关系视图按批次构建，只引用各构件“同批且有效”的版本。
 */

export type BuildingId = string;
export type ComponentId = string;
export type BatchId = string;

/** 截面尺寸（mm） */
export interface SectionSize {
  width: number;
  height: number;
}

export type DamageSeverity = "轻" | "中" | "重";

export const DAMAGE_SEVERITIES: DamageSeverity[] = ["轻", "中", "重"];

/** 病害点：位置以构件几何为参照，越界即非法 */
export interface DamagePoint {
  kind: string;
  /** 距构件始端的轴向距离 mm，合法区间 [0, length] */
  offsetAlong: number;
  /** 截面内横向偏移 mm，合法区间 [0, section.width] */
  offsetAcross: number;
  severity: DamageSeverity;
}

export interface Deformation {
  kind: string;
  /** 变形量，必须为非负有限数 */
  value: number;
  unit: string;
}

/** 测绘录入：木材、榫卯类型、截面尺寸、病害位置、变形必须齐全 */
export interface SurveyInput {
  buildingId: BuildingId;
  componentId: ComponentId;
  batchId: BatchId;
  wood: string;
  jointType: string;
  /** 构件长度 mm，病害轴向位置的边界基准 */
  length: number;
  section: SectionSize;
  damages: DamagePoint[];
  deformations: Deformation[];
  /** 与本构件榫卯相连的构件编号 */
  connections: ComponentId[];
  surveyor: string;
  surveyedAt: string;
}

export type VersionStatus = "valid" | "superseded";

export interface SurveyVersion extends SurveyInput {
  versionId: string;
  /** 该构件的第几版测绘，从 1 开始递增 */
  versionNo: number;
  status: VersionStatus;
  createdAt: string;
}

export type SuggestionPriority = "高" | "中" | "低";

export interface SuggestionItem {
  action: string;
  reason: string;
  priority: SuggestionPriority;
}

export type SuggestionStatus = "active" | "invalid";

export interface RepairSuggestion {
  id: string;
  buildingId: BuildingId;
  componentId: ComponentId;
  /** 建议来源：只指向生成它的那个测绘版本 */
  versionId: string;
  versionNo: number;
  batchId: BatchId;
  items: SuggestionItem[];
  /** 重新测绘后立即置为 invalid，历史建议仍可查 */
  status: SuggestionStatus;
  createdAt: string;
}

/** 构件关系视图节点：引用某构件在本批次内的有效版本 */
export interface RelationshipNode {
  componentId: ComponentId;
  versionId: string;
  versionNo: number;
  batchId: BatchId;
  wood: string;
  jointType: string;
}

export interface RelationshipEdge {
  a: ComponentId;
  b: ComponentId;
}

export interface ExcludedComponent {
  componentId: ComponentId;
  reason: string;
}

export interface RelationshipView {
  buildingId: BuildingId;
  batchId: BatchId;
  nodes: RelationshipNode[];
  edges: RelationshipEdge[];
  /** 本批次无有效版本而被排除的构件（防止混用过期版本） */
  excluded: ExcludedComponent[];
}

export interface ConstructionItem {
  componentId: ComponentId;
  versionId: string;
  versionNo: number;
  batchId: BatchId;
  jointType: string;
  actions: SuggestionItem[];
  topPriority: SuggestionPriority;
}
