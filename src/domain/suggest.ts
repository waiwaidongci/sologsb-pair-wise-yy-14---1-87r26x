import type {
  DamageSeverity,
  RepairSuggestion,
  SuggestionItem,
  SuggestionPriority,
  SurveyVersion,
} from "./types";

const SEVERITY_PRIORITY: Record<DamageSeverity, SuggestionPriority> = {
  轻: "低",
  中: "中",
  重: "高",
};

const DAMAGE_ACTIONS: Record<string, Record<DamageSeverity, string>> = {
  开裂: {
    轻: "表面嵌补裂缝",
    中: "嵌补裂缝并加设铁箍",
    重: "截换开裂段或对构件整体补强",
  },
  糟朽: {
    轻: "剔除腐朽部分并做防腐处理",
    中: "局部墩接糟朽部位",
    重: "整体墩接或更换构件",
  },
  虫蛀: {
    轻: "药剂灭虫并封堵虫孔",
    中: "药剂灭虫并对蛀蚀部位局部补强",
    重: "更换虫蛀构件",
  },
  弯垂: {
    轻: "记录弯垂并纳入监测",
    中: "增设支顶并监测",
    重: "支顶卸荷并评估更换",
  },
};

/** 挠曲容许值：跨度的 1/100 */
const DEFLECTION_RATIO = 100;
/** 倾斜高优先级阈值：高度的 2% */
const TILT_RATIO = 0.02;

function suggestForDamages(version: SurveyVersion): SuggestionItem[] {
  return version.damages.map((damage) => {
    const action =
      DAMAGE_ACTIONS[damage.kind]?.[damage.severity] ??
      `按“${damage.kind}”病害（${damage.severity}）制定专项修缮方案`;
    return {
      action,
      reason: `${damage.kind}（${damage.severity}），位于距始端 ${damage.offsetAlong}mm 处`,
      priority: SEVERITY_PRIORITY[damage.severity],
    };
  });
}

function suggestForDeformations(version: SurveyVersion): SuggestionItem[] {
  return version.deformations.map((deformation) => {
    if (deformation.kind === "挠曲") {
      const limit = version.length / DEFLECTION_RATIO;
      if (deformation.value > limit) {
        return {
          action: "支顶卸荷并评估是否更换构件",
          reason: `挠曲 ${deformation.value}${deformation.unit} 超过容许值 ${limit.toFixed(1)}mm（L/${DEFLECTION_RATIO}）`,
          priority: "高",
        };
      }
      return {
        action: "继续监测挠曲发展",
        reason: `挠曲 ${deformation.value}${deformation.unit} 未超容许值 ${limit.toFixed(1)}mm`,
        priority: "低",
      };
    }
    if (deformation.kind === "倾斜") {
      const limit = version.length * TILT_RATIO;
      return {
        action: deformation.value > limit ? "立即校正并做临时支撑" : "校正并定期监测倾斜",
        reason: `倾斜 ${deformation.value}${deformation.unit}（阈值 ${limit.toFixed(1)}mm）`,
        priority: deformation.value > limit ? "高" : "中",
      };
    }
    return {
      action: `记录${deformation.kind}变形并纳入监测`,
      reason: `${deformation.kind} ${deformation.value}${deformation.unit}`,
      priority: "低",
    };
  });
}

/**
 * 由某一版有效测绘生成修缮建议。
 * 建议只引用该版本的数据；版本被取代后，本建议随之失效。
 */
export function buildSuggestion(version: SurveyVersion, id: string, createdAt: string): RepairSuggestion {
  const items = [...suggestForDamages(version), ...suggestForDeformations(version)];
  if (items.length === 0) {
    items.push({
      action: "保存状况良好，纳入日常保养",
      reason: "无病害、无变形记录",
      priority: "低",
    });
  }
  return {
    id,
    buildingId: version.buildingId,
    componentId: version.componentId,
    versionId: version.versionId,
    versionNo: version.versionNo,
    batchId: version.batchId,
    items,
    status: "active",
    createdAt,
  };
}

/** 施工清单只收纳含实际修缮项（高/中优先级）的建议 */
export function needsRepair(suggestion: RepairSuggestion): boolean {
  return suggestion.items.some((item) => item.priority !== "低");
}
