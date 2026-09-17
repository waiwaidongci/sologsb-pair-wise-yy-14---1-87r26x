import { useMemo, useState } from "react";
import { DiseaseDraft, MORTISE_TYPES, SurveyDraft, WOOD_SUGGESTIONS } from "../types";
import { formatTime, versionsOf } from "../domain";
import { hasCode, useStore } from "../store";
import { validateSurvey } from "../domain";
import { DiseaseDiagram, VersionBadge } from "./shared";

function emptyDisease(): DiseaseDraft {
  return { id: `d_${Math.random().toString(36).slice(2)}`, x: "", y: "", label: "" };
}

function emptyDraft(building = "大雄宝殿"): SurveyDraft {
  return {
    building,
    code: "",
    wood: "",
    mortise: MORTISE_TYPES[0],
    width: "",
    height: "",
    length: "",
    deformation: "",
    diseases: [emptyDisease()],
  };
}

export function SurveyFormView({ building }: { building: string }) {
  const { state, submit, reject } = useStore();
  const [draft, setDraft] = useState<SurveyDraft>(() => emptyDraft(building));
  const [errors, setErrors] = useState<string[]>([]);
  const [fieldFlags, setFieldFlags] = useState<Record<string, boolean>>({});
  const [success, setSuccess] = useState<string | null>(null);

  const isExisting = draft.code.trim() !== "" && hasCode(state, draft.building, draft.code);
  const prevVersions = useMemo(
    () => (draft.code.trim() ? versionsOf(state, draft.building, draft.code) : []),
    [state, draft.building, draft.code]
  );

  const set = (key: keyof SurveyDraft, value: string) => {
    setDraft((d) => ({ ...d, [key]: value }));
    setSuccess(null);
  };
  const setDisease = (id: string, key: keyof DiseaseDraft, value: string) => {
    setDraft((d) => ({ ...d, diseases: d.diseases.map((m) => (m.id === id ? { ...m, [key]: value } : m)) }));
  };

  // 预览：把当前数字实时画到展开图上，越界点红圈提示（仍允许点击提交，提交时统一拒收）
  const previewLength = Number(draft.length);
  const previewMarkers = draft.diseases
    .filter((d) => d.x.trim() !== "" && d.y.trim() !== "" && Number.isFinite(Number(d.x)) && Number.isFinite(Number(d.y)))
    .map((d, i) => ({ id: `p${i}`, x: Number(d.x), y: Number(d.y), label: d.label }));

  const onSubmit = () => {
    setSuccess(null);
    const result = validateSurvey(draft);
    if (!result.ok) {
      setErrors(result.reasons);
      setFieldFlags(result.fields);
      // 拒收：留痕，且不覆盖任何旧测绘
      reject(draft.building || "（未填建筑）", draft.code || "（未填编号）", result.reasons);
      return;
    }
    const r = submit(result.survey);
    setErrors([]);
    setFieldFlags({});
    setSuccess(
      isExisting
        ? `重新测绘有效：构件 ${r.code} 已升级为 v${r.version}（批次 ${r.batchId}），旧建议即时失效，旧版本仍可在“版本历史”查阅。`
        : `测绘有效：构件 ${r.code} v${r.version} 已入库（批次 ${r.batchId}），修缮建议已生成。`
    );
    setDraft(emptyDraft(draft.building));
  };

  const flag = (k: string) => (fieldFlags[k] ? "invalid" : "");

  return (
    <div className="grid-2col">
      <section className="panel">
        <div className="heading">
          <div>
            <p>测绘录入 · 校验闸门</p>
            <h2>构件测绘登记</h2>
          </div>
          <button className="primary" onClick={onSubmit}>
            提交测绘（校验通过才入库）
          </button>
        </div>

        {isExisting && (
          <div className="notice notice-warn">
            构件 <b>{draft.code.trim()}</b> 在本建筑已存在 {prevVersions.length} 个有效版本，当前为 v
            {prevVersions[prevVersions.length - 1].version}。
            本次提交将追加 <VersionBadge v={prevVersions[prevVersions.length - 1].version + 1} />：
            一旦校验通过，旧修缮建议<b>立即失效</b>，旧测绘版本仍完整保留。
          </div>
        )}

        {errors.length > 0 && (
          <div className="notice notice-error" role="alert">
            <b>测绘被拒收（未产生新版本，旧测绘不受影响）：</b>
            <ul>
              {errors.map((e, i) => (
                <li key={i}>{e}</li>
              ))}
            </ul>
          </div>
        )}
        {success && <div className="notice notice-ok">{success}</div>}

        <div className="field-grid">
          <label className={flag("building")}>
            <span>建筑名称 *</span>
            <input list="building-list" value={draft.building} onChange={(e) => set("building", e.target.value)} />
          </label>
          <label className={flag("code")}>
            <span>构件编号 *（同建筑内唯一）</span>
            <input value={draft.code} placeholder="如 A-03" onChange={(e) => set("code", e.target.value)} />
          </label>
          <label className={flag("wood")}>
            <span>木材种类 *</span>
            <input list="wood-list" value={draft.wood} onChange={(e) => set("wood", e.target.value)} />
          </label>
          <label className={flag("mortise")}>
            <span>榫卯类型 *</span>
            <select value={draft.mortise} onChange={(e) => set("mortise", e.target.value)}>
              {MORTISE_TYPES.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          </label>
          <label className={flag("width")}>
            <span>截面宽 mm *（须为正数）</span>
            <input inputMode="decimal" value={draft.width} onChange={(e) => set("width", e.target.value)} />
          </label>
          <label className={flag("height")}>
            <span>截面高 mm *（须为正数）</span>
            <input inputMode="decimal" value={draft.height} onChange={(e) => set("height", e.target.value)} />
          </label>
          <label className={flag("length")}>
            <span>构件长度 mm *（须为正数，病害沿长坐标不得超过此值）</span>
            <input inputMode="decimal" value={draft.length} onChange={(e) => set("length", e.target.value)} />
          </label>
          <label className={flag("deformation")}>
            <span>变形情况 *</span>
            <input value={draft.deformation} placeholder="如 跨中挠曲 6mm / 无明显变形" onChange={(e) => set("deformation", e.target.value)} />
          </label>
        </div>

        <datalist id="wood-list">
          {WOOD_SUGGESTIONS.map((w) => (
            <option key={w} value={w} />
          ))}
        </datalist>

        <div className={`disease-editor ${flag("diseases")}`}>
          <div className="sub-heading">
            <h3>病害位置 *（沿长 0~{Number.isFinite(previewLength) && previewLength > 0 ? `${previewLength}mm` : "构件长"}；截面高度 0~1）</h3>
            <button
              onClick={() => setDraft((d) => ({ ...d, diseases: [...d.diseases, emptyDisease()] }))}
            >
              + 增加病害点
            </button>
          </div>
          {draft.diseases.map((m, i) => (
            <div className="disease-row" key={m.id}>
              <b>{i + 1}</b>
              <input
                className={fieldFlags[`diseases.${i}.x`] ? "invalid" : ""}
                inputMode="decimal"
                placeholder="沿长 mm"
                value={m.x}
                onChange={(e) => setDisease(m.id, "x", e.target.value)}
              />
              <input
                className={fieldFlags[`diseases.${i}.y`] ? "invalid" : ""}
                inputMode="decimal"
                placeholder="高度 0~1"
                value={m.y}
                onChange={(e) => setDisease(m.id, "y", e.target.value)}
              />
              <input
                className={fieldFlags[`diseases.${i}.label`] ? "invalid" : ""}
                placeholder="病害名称（开裂/糟朽/变形…）"
                value={m.label}
                onChange={(e) => setDisease(m.id, "label", e.target.value)}
              />
              <button
                disabled={draft.diseases.length === 1}
                onClick={() => setDraft((d) => ({ ...d, diseases: d.diseases.filter((x) => x.id !== m.id) }))}
              >
                删除
              </button>
            </div>
          ))}
          <p className="hint">无可见病害时，可登记一个位置 (0, 0)、名称“无可见病害”的标记点。</p>
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">实时预览 · 病害标记图</p>
        <h2>构件展开图</h2>
        {previewLength > 0 ? (
          <DiseaseDiagram length={previewLength} diseases={previewMarkers} invalidPoints={previewMarkers} />
        ) : (
          <p className="hint">填写正数构件长度后显示展开图；红圈表示病害位置越界，提交时将被拒收。</p>
        )}

        {prevVersions.length > 0 && (
          <div className="prev-versions">
            <h3>该构件历史版本（提交前对照，均不会被覆盖）</h3>
            {prevVersions
              .slice()
              .reverse()
              .map((v) => (
                <div key={v.id} className="prev-line">
                  <VersionBadge v={v.version} dim />
                  <span>
                    {v.width}×{v.height}×{v.length}mm · {v.mortise} · {v.diseases.length} 处病害 · {formatTime(v.batchTime)}
                  </span>
                </div>
              ))}
          </div>
        )}
      </section>
    </div>
  );
}
