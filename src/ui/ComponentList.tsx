import { useState } from "react";
import type { SurveyStore } from "../domain/store";
import type { DamageSeverity, SurveyVersion } from "../domain/types";

const SEVERITY_COLOR: Record<DamageSeverity, string> = {
  轻: "#0f766e",
  中: "#854d0e",
  重: "#b91c1c",
};

/** 病害标记图：按 轴向位置/构件长、截面内位置/截面宽 比例落点 */
function DamageMap({ version }: { version: SurveyVersion }) {
  const W = 620;
  const H = 140;
  const PAD = 24;
  const innerW = W - PAD * 2;
  const innerH = H - PAD * 2;
  return (
    <svg className="damage-map" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="病害标记图">
      <rect x={PAD} y={PAD} width={innerW} height={innerH} rx={6} fill="#f8fafc" stroke="#94a3b8" />
      <text x={PAD} y={PAD - 8} fontSize={11} fill="#64748b">
        构件长 {version.length}mm · 截面 {version.section.width}×{version.section.height}mm
      </text>
      {version.damages.map((d, i) => {
        const cx = PAD + (d.offsetAlong / version.length) * innerW;
        const cy = PAD + (d.offsetAcross / version.section.width) * innerH;
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={7} fill={SEVERITY_COLOR[d.severity]} opacity={0.85} />
            <text x={cx + 10} y={cy + 4} fontSize={11} fill="#334155">
              {d.kind}·{d.severity}（{d.offsetAlong}mm）
            </text>
          </g>
        );
      })}
      {version.damages.length === 0 && (
        <text x={W / 2} y={H / 2 + 4} textAnchor="middle" fontSize={12} fill="#94a3b8">
          本版测绘无病害记录
        </text>
      )}
    </svg>
  );
}

export function ComponentList(props: { store: SurveyStore; building: string }) {
  const { store, building } = props;
  const [jointFilter, setJointFilter] = useState<string>("全部");
  const [expanded, setExpanded] = useState<string | null>(null);

  const components = store.listComponents(building);
  const jointTypes = ["全部", ...new Set(components.map((c) => store.getCurrentVersion(c.buildingId, c.componentId)?.jointType ?? ""))];
  const visible = components.filter((c) => {
    if (jointFilter === "全部") return true;
    return store.getCurrentVersion(c.buildingId, c.componentId)?.jointType === jointFilter;
  });

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>构件清单</p>
          <h2>{building} · {components.length} 件构件</h2>
        </div>
      </div>

      <div className="chips">
        {jointTypes.map((j) => (
          <button key={j} className={jointFilter === j ? "chip active" : "chip"} onClick={() => setJointFilter(j)}>
            {j}
          </button>
        ))}
      </div>

      <div className="records">
        {visible.map((c) => {
          const current = store.getCurrentVersion(c.buildingId, c.componentId);
          const suggestion = store.getActiveSuggestion(c.buildingId, c.componentId);
          if (!current) return null;
          const isOpen = expanded === c.componentId;
          const versions = store.getVersionHistory(c.buildingId, c.componentId);
          const suggestions = store.getSuggestionHistory(c.buildingId, c.componentId);
          return (
            <article key={c.componentId} className="component-card">
              <div className="component-head" onClick={() => setExpanded(isOpen ? null : c.componentId)}>
                <b>{c.componentId}</b>
                <span>{current.wood} · {current.jointType}</span>
                <span>截面 {current.section.width}×{current.section.height}mm · 长 {current.length}mm</span>
                <span className="badge valid">v{current.versionNo} 有效 · {current.batchId}</span>
                <span className="badge">{current.damages.length} 病害 / {current.deformations.length} 变形</span>
                {suggestion && <span className="badge active-suggestion">建议生效中（{suggestion.items.length} 条）</span>}
                <span className="toggle">{isOpen ? "收起 ▲" : "版本历史 ▼"}</span>
              </div>

              {isOpen && (
                <div className="component-detail">
                  <DamageMap version={current} />

                  {suggestion && (
                    <div className="suggestion-box">
                      <h4>当前修缮建议（来自 v{suggestion.versionNo} · {suggestion.batchId}）</h4>
                      <ul>
                        {suggestion.items.map((item, i) => (
                          <li key={i}>
                            <span className={`priority p-${item.priority}`}>{item.priority}</span>
                            {item.action}
                            <small>依据：{item.reason}</small>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  <h4>测绘版本历史（旧版本仍可查）</h4>
                  <table className="data-table">
                    <thead>
                      <tr><th>版本</th><th>批次</th><th>测绘日期</th><th>病害/变形</th><th>状态</th></tr>
                    </thead>
                    <tbody>
                      {versions.map((v) => (
                        <tr key={v.versionId}>
                          <td>v{v.versionNo}</td>
                          <td>{v.batchId}</td>
                          <td>{v.surveyedAt}</td>
                          <td>{v.damages.length} / {v.deformations.length}</td>
                          <td>
                            <span className={v.status === "valid" ? "badge valid" : "badge superseded"}>
                              {v.status === "valid" ? "有效" : "已被取代"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <h4>修缮建议历史</h4>
                  <table className="data-table">
                    <thead>
                      <tr><th>建议</th><th>来源版本</th><th>条目</th><th>状态</th></tr>
                    </thead>
                    <tbody>
                      {suggestions.map((s) => (
                        <tr key={s.id}>
                          <td>{s.id}</td>
                          <td>v{s.versionNo} · {s.batchId}</td>
                          <td>{s.items.length} 条</td>
                          <td>
                            <span className={s.status === "active" ? "badge valid" : "badge superseded"}>
                              {s.status === "active" ? "生效中" : "已失效"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </article>
          );
        })}
        {visible.length === 0 && <p className="hint">当前筛选条件下暂无构件。</p>}
      </div>
    </section>
  );
}
