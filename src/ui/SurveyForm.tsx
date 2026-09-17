import { useState } from "react";
import type { SurveyStore } from "../domain/store";
import { DAMAGE_SEVERITIES, type DamageSeverity } from "../domain/types";
import type { ValidationError } from "../domain/validate";

interface DamageRow {
  kind: string;
  offsetAlong: string;
  offsetAcross: string;
  severity: DamageSeverity;
}

interface DeformationRow {
  kind: string;
  value: string;
  unit: string;
}

interface FormState {
  buildingId: string;
  componentId: string;
  batchId: string;
  wood: string;
  jointType: string;
  length: string;
  sectionWidth: string;
  sectionHeight: string;
  connections: string;
  surveyor: string;
  surveyedAt: string;
  damages: DamageRow[];
  deformations: DeformationRow[];
}

const JOINT_TYPES = ["燕尾榫", "透榫", "半榫", "箍头榫", "馒头榫", "管脚榫"];

const initialForm = (buildingId: string, batchId: string): FormState => ({
  buildingId,
  componentId: "",
  batchId,
  wood: "",
  jointType: JOINT_TYPES[0],
  length: "",
  sectionWidth: "",
  sectionHeight: "",
  connections: "",
  surveyor: "",
  surveyedAt: new Date().toISOString().slice(0, 10),
  damages: [],
  deformations: [],
});

type SubmitFeedback =
  | { kind: "success"; versionNo: number; replacedVersionNo: number | null; suggestionCount: number }
  | { kind: "rejected"; errors: ValidationError[] };

const toNumber = (raw: string): number => (raw.trim() === "" ? Number.NaN : Number(raw));

export function SurveyForm(props: {
  store: SurveyStore;
  defaultBuilding: string;
  defaultBatch: string;
  onSubmitted: () => void;
}) {
  const { store, onSubmitted } = props;
  const [form, setForm] = useState<FormState>(() => initialForm(props.defaultBuilding, props.defaultBatch));
  const [feedback, setFeedback] = useState<SubmitFeedback | null>(null);

  const patch = (partial: Partial<FormState>) => setForm((f) => ({ ...f, ...partial }));

  const willCreateNewVersion = store.hasComponent(form.buildingId, form.componentId);

  const submit = () => {
    const result = store.submitSurvey({
      buildingId: form.buildingId,
      componentId: form.componentId,
      batchId: form.batchId,
      wood: form.wood,
      jointType: form.jointType,
      length: toNumber(form.length),
      section: { width: toNumber(form.sectionWidth), height: toNumber(form.sectionHeight) },
      damages: form.damages.map((d) => ({
        kind: d.kind,
        offsetAlong: toNumber(d.offsetAlong),
        offsetAcross: toNumber(d.offsetAcross),
        severity: d.severity,
      })),
      deformations: form.deformations.map((d) => ({
        kind: d.kind,
        value: toNumber(d.value),
        unit: d.unit,
      })),
      connections: form.connections
        .split(/[,，、\s]+/)
        .map((s) => s.trim())
        .filter(Boolean),
      surveyor: form.surveyor,
      surveyedAt: form.surveyedAt,
    });

    if (result.ok) {
      setFeedback({
        kind: "success",
        versionNo: result.version.versionNo,
        replacedVersionNo: result.replacedVersionNo,
        suggestionCount: result.suggestion.items.length,
      });
      onSubmitted();
    } else {
      setFeedback({ kind: "rejected", errors: result.errors });
    }
  };

  return (
    <section className="panel form-panel">
      <div className="heading">
        <div>
          <p>测绘录入</p>
          <h2>新增 / 重新测绘</h2>
        </div>
        <button className="primary" onClick={submit}>提交测绘</button>
      </div>

      {willCreateNewVersion && form.componentId.trim() !== "" && (
        <div className="notice info">
          构件「{form.componentId}」已存在，本次提交将生成新版本，旧版本与旧修缮建议立即失效（仍可查询）。
        </div>
      )}

      {feedback?.kind === "success" && (
        <div className="notice success">
          已生成 v{feedback.versionNo} 有效测绘，并据其生成 {feedback.suggestionCount} 条修缮建议。
          {feedback.replacedVersionNo != null && ` v${feedback.replacedVersionNo} 及其建议已失效，历史版本仍可查。`}
        </div>
      )}
      {feedback?.kind === "rejected" && (
        <div className="notice danger">
          <b>已拒绝，旧测绘未被覆盖：</b>
          <ul>
            {feedback.errors.map((e) => (
              <li key={e.field + e.message}>{e.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="field-grid">
        <label>
          <span>建筑名称 *</span>
          <input value={form.buildingId} onChange={(e) => patch({ buildingId: e.target.value })} placeholder="如：漱芳斋前殿" />
        </label>
        <label>
          <span>构件编号 *（同一建筑内唯一）</span>
          <input value={form.componentId} onChange={(e) => patch({ componentId: e.target.value })} placeholder="如：梁架A-03" />
        </label>
        <label>
          <span>测绘批次 *</span>
          <input value={form.batchId} onChange={(e) => patch({ batchId: e.target.value })} placeholder="如：2026-09-秋测" />
        </label>
        <label>
          <span>木材种类 *</span>
          <input value={form.wood} onChange={(e) => patch({ wood: e.target.value })} placeholder="如：杉木 / 楠木" />
        </label>
        <label>
          <span>榫卯类型 *</span>
          <select value={form.jointType} onChange={(e) => patch({ jointType: e.target.value })}>
            {JOINT_TYPES.map((j) => (
              <option key={j} value={j}>{j}</option>
            ))}
          </select>
        </label>
        <label>
          <span>构件长度 (mm) *</span>
          <input type="number" value={form.length} onChange={(e) => patch({ length: e.target.value })} placeholder="如：4200" />
        </label>
        <label>
          <span>截面宽 (mm) *（须为正数）</span>
          <input type="number" value={form.sectionWidth} onChange={(e) => patch({ sectionWidth: e.target.value })} placeholder="如：180" />
        </label>
        <label>
          <span>截面高 (mm) *（须为正数）</span>
          <input type="number" value={form.sectionHeight} onChange={(e) => patch({ sectionHeight: e.target.value })} placeholder="如：240" />
        </label>
        <label>
          <span>相连构件（逗号分隔）</span>
          <input value={form.connections} onChange={(e) => patch({ connections: e.target.value })} placeholder="如：柱网C-12, 斗拱D-07" />
        </label>
        <label>
          <span>测绘人 *</span>
          <input value={form.surveyor} onChange={(e) => patch({ surveyor: e.target.value })} placeholder="姓名" />
        </label>
        <label>
          <span>测绘日期 *</span>
          <input type="date" value={form.surveyedAt} onChange={(e) => patch({ surveyedAt: e.target.value })} />
        </label>
      </div>

      <div className="sub-heading">
        <h3>病害位置 *</h3>
        <button
          onClick={() =>
            patch({ damages: [...form.damages, { kind: "开裂", offsetAlong: "", offsetAcross: "", severity: "轻" }] })
          }
        >
          + 添加病害
        </button>
      </div>
      {form.damages.length === 0 && <p className="hint">无病害也要保留本表（提交时以空记录明示）。病害位置不得超出构件长度与截面宽度。</p>}
      {form.damages.map((d, i) => (
        <div className="row-grid" key={i}>
          <select value={d.kind} onChange={(e) => patch({ damages: form.damages.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x)) })}>
            {["开裂", "糟朽", "虫蛀", "弯垂"].map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <input type="number" placeholder="距始端 mm" value={d.offsetAlong} onChange={(e) => patch({ damages: form.damages.map((x, j) => (j === i ? { ...x, offsetAlong: e.target.value } : x)) })} />
          <input type="number" placeholder="截面内 mm" value={d.offsetAcross} onChange={(e) => patch({ damages: form.damages.map((x, j) => (j === i ? { ...x, offsetAcross: e.target.value } : x)) })} />
          <select value={d.severity} onChange={(e) => patch({ damages: form.damages.map((x, j) => (j === i ? { ...x, severity: e.target.value as DamageSeverity } : x)) })}>
            {DAMAGE_SEVERITIES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <button className="ghost" onClick={() => patch({ damages: form.damages.filter((_, j) => j !== i) })}>删除</button>
        </div>
      ))}

      <div className="sub-heading">
        <h3>变形情况 *</h3>
        <button onClick={() => patch({ deformations: [...form.deformations, { kind: "挠曲", value: "", unit: "mm" }] })}>
          + 添加变形
        </button>
      </div>
      {form.deformations.length === 0 && <p className="hint">无变形也要保留本表（提交时以空记录明示）。</p>}
      {form.deformations.map((d, i) => (
        <div className="row-grid deform" key={i}>
          <select value={d.kind} onChange={(e) => patch({ deformations: form.deformations.map((x, j) => (j === i ? { ...x, kind: e.target.value } : x)) })}>
            {["挠曲", "倾斜", "扭转", "沉降"].map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
          <input type="number" placeholder="变形量" value={d.value} onChange={(e) => patch({ deformations: form.deformations.map((x, j) => (j === i ? { ...x, value: e.target.value } : x)) })} />
          <input placeholder="单位" value={d.unit} onChange={(e) => patch({ deformations: form.deformations.map((x, j) => (j === i ? { ...x, unit: e.target.value } : x)) })} />
          <button className="ghost" onClick={() => patch({ deformations: form.deformations.filter((_, j) => j !== i) })}>删除</button>
        </div>
      ))}
    </section>
  );
}
