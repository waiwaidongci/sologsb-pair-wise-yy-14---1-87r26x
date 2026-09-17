import React, { createContext, useContext, useMemo, useReducer } from "react";
import { AppState, Rejection, SurveyVersion, ValidSurvey } from "./types";
import { generateAdvice, sameBuilding, uid, versionsOf } from "./domain";
import { buildSeed, STORAGE_KEY } from "./seed";

type Action =
  | { type: "submit"; survey: ValidSurvey; time: number }
  | { type: "reject"; building: string; code: string; reasons: string[]; time: number }
  | { type: "reset" };

function persist(state: AppState): AppState {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* 存储不可用时仅保留内存态 */
  }
  return state;
}

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "submit": {
      const s = action.survey;
      const prev = versionsOf(state, s.building, s.code);
      const newVersion: SurveyVersion = {
        ...s,
        id: uid("sv"),
        version: prev.length ? prev[prev.length - 1].version + 1 : 1,
        batchId: `B${state.batchSeq + 1}`,
        batchTime: action.time,
      };
      const advice = {
        id: uid("ad"),
        surveyId: newVersion.id,
        building: newVersion.building,
        code: newVersion.code,
        version: newVersion.version,
        batchId: newVersion.batchId,
        createdAt: action.time,
        content: generateAdvice(newVersion),
      };
      return persist({
        ...state,
        surveys: [...state.surveys, newVersion],
        // 旧建议保留不删；查询时以版本号判定 active / expired
        advices: [...state.advices, advice],
        batchSeq: state.batchSeq + 1,
      });
    }
    case "reject": {
      const rejection: Rejection = {
        id: uid("rj"),
        time: action.time,
        building: action.building,
        code: action.code,
        reasons: action.reasons,
      };
      // 拒收不触碰任何既有测绘与建议
      return persist({ ...state, rejections: [rejection, ...state.rejections] });
    }
    case "reset":
      return persist(buildSeed());
    default:
      return state;
  }
}

function init(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      if (Array.isArray(parsed.surveys) && Array.isArray(parsed.advices)) return parsed;
    }
  } catch {
    /* fall through to seed */
  }
  const seed = buildSeed();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(seed));
  } catch {
    /* ignore */
  }
  return seed;
}

interface Store {
  state: AppState;
  submit: (survey: ValidSurvey) => { batchId: string; version: number; building: string; code: string };
  reject: (building: string, code: string, reasons: string[]) => void;
  reset: () => void;
}

const StoreContext = createContext<Store | null>(null);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, init);

  const api = useMemo<Store>(
    () => ({
      state,
      submit: (survey) => {
        const time = Date.now();
        const prev = versionsOf(state, survey.building, survey.code);
        const version = prev.length ? prev[prev.length - 1].version + 1 : 1;
        dispatch({ type: "submit", survey, time });
        return { batchId: `B${state.batchSeq + 1}`, version, building: survey.building, code: survey.code };
      },
      reject: (building, code, reasons) =>
        dispatch({ type: "reject", building, code, reasons, time: Date.now() }),
      reset: () => {
        if (window.confirm("确定恢复为示例数据？当前全部测绘版本与拒收记录将被清空。")) dispatch({ type: "reset" });
      },
    }),
    [state]
  );

  return <StoreContext.Provider value={api}>{children}</StoreContext.Provider>;
}

export function useStore(): Store {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error("useStore 必须在 StoreProvider 内使用");
  return ctx;
}

export function buildingNames(state: AppState): string[] {
  const set = new Set<string>();
  state.surveys.forEach((s) => set.add(s.building));
  return [...set].sort((a, b) => a.localeCompare(b, "zh"));
}

export function hasCode(state: AppState, building: string, code: string): boolean {
  return state.surveys.some((s) => sameBuilding(s.building, building) && s.code === code.trim());
}
