import { useMemo, useState } from "react";
import { currentSurveys, formatTime, versionsOf } from "../domain";
import { useStore } from "../store";
import { DiseaseDiagram, MortiseChip, VersionBadge } from "./shared";

/** 尺寸记录表（当前有效版本）+ 病害标记图档（可切换历史版本，历史图只读） */
export function RecordsView({ building }: { building: string }) {
  const { state } = useStore();
  const currents = useMemo(() => currentSurveys(state, building), [state, building]);
  const [code, setCode] = useState<string>(currents[0]?.code ?? "");

  const activeCode = currents.some((c) => c.code === code) ? code : currents[0]?.code ?? "";
  const chain = activeCode ? versionsOf(state, building, activeCode) : [];
  const [pickedId, setPickedId] = useState<string>("");
  const shown = chain.find((v) => v.id === pickedId) ?? chain[chain.length - 1];
  const latestId = chain[chain.length - 1]?.id;

  return (
    <div className="stack">
      <section className="panel">
        <div className="heading">
          <div>
            <p>尺寸记录表 · 数值全部来自当前有效测绘版本</p>
            <h2>{building} 构件尺寸台账</h2>
          </div>
          <button onClick={() => downloadCsv(building, currents)}>导出尺寸CSV</button>
        </div>
        <table className="data-table">
          <thead>
            <tr>
              <th>构件编号</th>
              <th>版本</th>
              <th>木材</th>
              <th>榫卯类型</th>
              <th>截面宽 (mm)</th>
              <th>截面高 (mm)</th>
              <th>构件长 (mm)</th>
              <th>变形</th>
              <th>测绘时间</th>
            </tr>
          </thead>
          <tbody>
            {currents.map((s) => (
              <tr key={s.id}>
                <td className="mono">{s.code}</td>
                <td>
                  <VersionBadge v={s.version} />
                </td>
                <td>{s.wood}</td>
                <td>
                  <MortiseChip value={s.mortise} />
                </td>
                <td className="mono num">{s.width}</td>
                <td className="mono num">{s.height}</td>
                <td className="mono num">{s.length}</td>
                <td>{s.deformation}</td>
                <td className="muted">{formatTime(s.batchTime)}</td>
              </tr>
            ))}
            {currents.length === 0 && (
              <tr>
                <td colSpan={9} className="empty-cell">
                  该建筑暂无有效测绘
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>病害标记图档 · 历史版本只读可查</p>
            <h2>构件病害图</h2>
          </div>
        </div>
        <div className="chips">
          {currents.map((c) => (
            <button key={c.code} className={activeCode === c.code ? "chip-on" : ""} onClick={() => { setCode(c.code); setPickedId(""); }}>
              {c.code}
            </button>
          ))}
        </div>

        {shown && (
          <>
            <div className="version-tabs">
              {chain
                .slice()
                .reverse()
                .map((v) => (
                  <button
                    key={v.id}
                    className={shown.id === v.id ? "chip-on" : ""}
                    onClick={() => setPickedId(v.id)}
                  >
                    v{v.version} · {formatTime(v.batchTime)}
                    {v.id === latestId ? "（现行）" : "（历史·只读）"}
                  </button>
                ))}
            </div>
            <DiseaseDiagram length={shown.length} diseases={shown.diseases} />
            <ul className="disease-legend">
              {shown.diseases.map((d, i) => (
                <li key={d.id}>
                  <b>{i + 1}</b> {d.label}：距端部 {d.x}mm，截面高度比 {d.y}
                </li>
              ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function downloadCsv(building: string, rows: ReturnType<typeof currentSurveys>): void {
  const head = ["构件编号", "版本", "木材", "榫卯类型", "截面宽mm", "截面高mm", "构件长mm", "变形", "测绘时间"];
  const lines = rows.map((s) =>
    [s.code, `v${s.version}`, s.wood, s.mortise, s.width, s.height, s.length, s.deformation, formatTime(s.batchTime)]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  const csv = "﻿" + [head.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${building}-尺寸记录表.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
