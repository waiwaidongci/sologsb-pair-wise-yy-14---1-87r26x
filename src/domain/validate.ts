import { DAMAGE_SEVERITIES, type SurveyInput } from "./types";

export interface ValidationError {
  field: string;
  message: string;
}

function isBlank(value: unknown): boolean {
  return typeof value !== "string" || value.trim().length === 0;
}

function isPositiveFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value > 0;
}

function isNonNegativeFinite(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

/**
 * 测绘录入校验。
 *
 * 规则（与修缮版本闭环约定一致）：
 * 1. 木材、榫卯类型、截面尺寸、病害位置、变形必须齐全（字段必须显式提供）；
 * 2. 截面尺寸非正 → 拒绝；
 * 3. 病害位置越界（轴向超出 [0, length]，横向超出 [0, section.width]）→ 拒绝；
 * 4. 校验失败时调用方不得改动任何既有数据（不覆盖旧测绘）。
 */
export function validateSurvey(input: Partial<SurveyInput>): ValidationError[] {
  const errors: ValidationError[] = [];

  if (isBlank(input.buildingId)) {
    errors.push({ field: "buildingId", message: "建筑名称不能为空" });
  }
  if (isBlank(input.componentId)) {
    errors.push({ field: "componentId", message: "构件编号不能为空" });
  }
  if (isBlank(input.batchId)) {
    errors.push({ field: "batchId", message: "测绘批次不能为空" });
  }
  if (isBlank(input.wood)) {
    errors.push({ field: "wood", message: "木材种类必须填写" });
  }
  if (isBlank(input.jointType)) {
    errors.push({ field: "jointType", message: "榫卯类型必须填写" });
  }
  if (isBlank(input.surveyor)) {
    errors.push({ field: "surveyor", message: "测绘人不能为空" });
  }
  if (isBlank(input.surveyedAt)) {
    errors.push({ field: "surveyedAt", message: "测绘日期不能为空" });
  }

  if (!isPositiveFinite(input.length)) {
    errors.push({ field: "length", message: "构件长度必须为正数" });
  }

  const section = input.section;
  if (section == null) {
    errors.push({ field: "section", message: "截面尺寸必须填写" });
  } else {
    if (!isPositiveFinite(section.width)) {
      errors.push({ field: "section.width", message: "截面宽度必须为正数" });
    }
    if (!isPositiveFinite(section.height)) {
      errors.push({ field: "section.height", message: "截面高度必须为正数" });
    }
  }

  if (!Array.isArray(input.damages)) {
    errors.push({ field: "damages", message: "病害位置必须记录（无病害时给空数组）" });
  } else {
    const length = isPositiveFinite(input.length) ? input.length : null;
    const width =
      section != null && isPositiveFinite(section.width) ? section.width : null;
    input.damages.forEach((damage, index) => {
      const at = `damages[${index}]`;
      if (damage == null || typeof damage !== "object") {
        errors.push({ field: at, message: `第 ${index + 1} 条病害记录无效` });
        return;
      }
      if (isBlank(damage.kind)) {
        errors.push({ field: `${at}.kind`, message: `第 ${index + 1} 条病害缺少类型` });
      }
      if (!isNonNegativeFinite(damage.offsetAlong)) {
        errors.push({
          field: `${at}.offsetAlong`,
          message: `第 ${index + 1} 条病害轴向位置必须为非负数字`,
        });
      } else if (length != null && damage.offsetAlong > length) {
        errors.push({
          field: `${at}.offsetAlong`,
          message: `第 ${index + 1} 条病害轴向位置越界：${damage.offsetAlong}mm 超出构件长度 ${length}mm`,
        });
      }
      if (!isNonNegativeFinite(damage.offsetAcross)) {
        errors.push({
          field: `${at}.offsetAcross`,
          message: `第 ${index + 1} 条病害截面内位置必须为非负数字`,
        });
      } else if (width != null && damage.offsetAcross > width) {
        errors.push({
          field: `${at}.offsetAcross`,
          message: `第 ${index + 1} 条病害截面内位置越界：${damage.offsetAcross}mm 超出截面宽度 ${width}mm`,
        });
      }
      if (!DAMAGE_SEVERITIES.includes(damage.severity)) {
        errors.push({
          field: `${at}.severity`,
          message: `第 ${index + 1} 条病害程度必须为：轻 / 中 / 重`,
        });
      }
    });
  }

  if (!Array.isArray(input.deformations)) {
    errors.push({ field: "deformations", message: "变形情况必须记录（无变形时给空数组）" });
  } else {
    input.deformations.forEach((deformation, index) => {
      const at = `deformations[${index}]`;
      if (deformation == null || typeof deformation !== "object") {
        errors.push({ field: at, message: `第 ${index + 1} 条变形记录无效` });
        return;
      }
      if (isBlank(deformation.kind)) {
        errors.push({ field: `${at}.kind`, message: `第 ${index + 1} 条变形缺少类型` });
      }
      if (!isNonNegativeFinite(deformation.value)) {
        errors.push({
          field: `${at}.value`,
          message: `第 ${index + 1} 条变形量必须为非负数字`,
        });
      }
      if (isBlank(deformation.unit)) {
        errors.push({ field: `${at}.unit`, message: `第 ${index + 1} 条变形缺少单位` });
      }
    });
  }

  if (!Array.isArray(input.connections)) {
    errors.push({ field: "connections", message: "连接关系必须记录（无连接时给空数组）" });
  } else {
    input.connections.forEach((target, index) => {
      if (isBlank(target)) {
        errors.push({
          field: `connections[${index}]`,
          message: `第 ${index + 1} 条连接构件编号不能为空`,
        });
      } else if (target === input.componentId) {
        errors.push({
          field: `connections[${index}]`,
          message: "构件不能与自身相连",
        });
      }
    });
  }

  return errors;
}
