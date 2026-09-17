import { useMemo, useState } from "react";
import { MORTISE_TYPES } from "../types";
import { activeAdviceOf, currentSurveys, dimsText, formatBatch, formatTime, versionsOf } from "../domain";
import { useStore } from "../store";
import { DiseaseDiagram, MortiseChip, VersionBadge } from "./shared";

export function ComponentListView({ building }: { building: string }) {
  const { state } = useStore();
  const [mortise, setMortise] = useState<string>("全部");
  const [selected, setSelected] = useState<string | null>(null);

  const all = useMemo(() => currentSurveys(state, building), [state, building]);
  const list = mortise === "全部" ? all : all.filter((s) => s.mortise === mortise);

  const current = selected ? all.find((s) => s.code === selected) ?? null : null;
  const chain = current ? versionsOf(state, current.building, current.code) : [];

  return (
    <div className="grid-2col grid-2col-wide">
      <section className="panel">
        <div className="heading">
          <div>
            <p>构件清单 · 只显示当前有效版本</p>
            <h2>{building}</h2>
          </div>
          <span className="count-pill">{list.length} 件</span>
        </div>
        <div className="chips filter-chips">
          {["全部", ...MORTISE_TYPES].map((m) => (
            <button key={m} className={mortise === m ? "chip-on" : ""} onClick={() => setMortise(m)}>
              {m}
            </button>
          ))}
        </div>

        <table className="data-table">
          <thead>
            <tr>
              <th>编号</th>
              <th>版本</th>
              <th>榫卯</th>
              <th>截面 宽×高×长 (mm)</th>
              <th>病害</th>
              <th>修缮建议</th>
            </tr>
          </thead>
          <tbody>
            {list.map((s) => {
              const advice = activeAdviceOf(state, s.id);
              return (
                <tr key={s.id} className={selected === s.code ? "row-on" : ""} onClick={() => setSelected(s.code)}>
                  <td className="mono">{s.code}</td>
                  <td>
                    <VersionBadge v={s.version} />
                  </td>
                  <td>
                    <MortiseChip value={s.mortise} />
                  </td>
                  <td className="mono">{dimsText(s)}</td>
                  <td>{s.diseases.length} 处</td>
                  <td>{advice ? <span className="advice-live">生效中 · {formatTime(advice.createdAt)}</span> : <span className="advice-none">—</span>}</td>
                </tr>
              );
            })}
            {list.length === 0 && (
              <tr>
                <td colSpan={6} className="empty-cell">
                  当前筛选下暂无有效测绘构件
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="panel">
        {current ? (
          <>
            <div className="heading">
              <div>
                <p>构件详情 · 最新有效测绘</p>
                <h2>
                  {current.code} <VersionBadge v={current.version} />
                </h2>
              </div>
              <small className="muted">批次 {formatBatch(current.batchId, current.batchTime)}</small>
            </div>
            <DiseaseDiagram length={current.length} diseases={current.diseases} />
            <dl className="dim-dl">
              <div>
                <dt>木材种类</dt>
                <dd>{current.wood}</dd>
              </div>
              <div>
                <dt>变形情况</dt>
                <dd>{current.deformation}</dd>
              </div>
            </dl>
            {(() => {
              const advice = activeAdviceOf(state, current.id);
              return advice ? (
                <div className="advice-box">
                  <h3>当前修缮建议（由 v{current.version} 测绘生成）</h3>
                  <p>{advice.content}</p>
                </div>
              ) : null;
            })()}
            {chain.length > 1 && (
              <div className="chain-mini">
                <h3>版本链（旧建议已失效，旧版本仍可查）</h3>
                {chain
                  .slice()
                  .reverse()
                  .map((v) => {
                    const ad = state.advices.find((a) => a.surveyId === v.id);
                    return (
                      <div key={v.id} className="prev-line">
                        <VersionBadge v={v.version} dim={v.id !== current.id} />
                        <span className={v.id === current.id ? "" : "muted"}>
                          {formatTime(v.batchTime)} · {v.diseases.map((d) => d.label).join("、")}
                          {ad && v.id !== current.id && <em className="expired-tag"> 建议已失效</em>}
                        </span>
                      </div>
                    );
                  })}
              </div>
            )}
          </>
        ) : (
          <>
            <p className="eyebrow">构件详情</p>
            <h2>未选择构件</h2>
            <p className="hint">点击左侧构件行，查看最新有效测绘、病害标记图与修缮建议。</p>
          </>
        )}
      </section>
    </div>
  );
}
