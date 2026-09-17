import { useMemo, useState } from "react";
import { buildConstructionList, formatBatch, formatTime, listBatches, resolveRelations } from "../domain";
import { useStore } from "../store";
import { MortiseChip, VersionBadge } from "./shared";

export function RelationView({ building }: { building: string }) {
  const { state } = useStore();
  const batches = useMemo(() => listBatches(state), [state]);
  const latestBatch = batches[0]?.id ?? "";
  const [anchor, setAnchor] = useState<string>("LATEST");
  const anchorBatchId = anchor === "LATEST" ? latestBatch : anchor;

  const resolved = useMemo(
    () => (anchorBatchId ? resolveRelations(state, building, anchorBatchId) : null),
    [state, building, anchorBatchId]
  );

  const isLatest = anchorBatchId === latestBatch;
  const listResult = useMemo(
    () => (isLatest ? buildConstructionList(state, building) : null),
    [state, building, isLatest, anchorBatchId]
  );

  // 关系图布局：按 C-12 等“柱”优先，再按边拓扑分层
  const layout = useMemo(() => layoutGraph(resolved?.nodes.map((n) => n.code) ?? [], resolved?.edges ?? []), [resolved]);

  return (
    <div className="stack">
      <section className="panel">
        <div className="heading">
          <div>
            <p>构件关系视图 · 只引用同一批次当日的有效版本快照</p>
            <h2>{building} 构件关系</h2>
          </div>
          <div className="anchor-select">
            <label>
              <span>批次锚定</span>
              <select value={anchor} onChange={(e) => setAnchor(e.target.value)}>
                <option value="LATEST">最新批次（施工口径）</option>
                {batches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.id} · {formatTime(b.time)}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>

        <p className="hint">
          关系视图对每个构件统一取“不晚于锚定批次”的最大版本，保证全图同批快照一致；切换旧批次时，相关构件会显示为
          <b> 过期版本</b>，仅用于历史追溯，不能进入施工清单。
        </p>

        {!isLatest && (
          <div className="notice notice-warn">
            当前为历史快照（{anchorBatchId && formatBatch(anchorBatchId, batches.find((b) => b.id === anchorBatchId)?.time ?? 0)}
            ）。其中版本与现行版本不一致的构件已标红，<b>历史批次不能生成施工清单</b>。
          </div>
        )}

        {resolved && (
          <>
            {resolved.missingCodes.length > 0 && (
              <div className="notice notice-error">
                以下构件在锚定批次当日尚无任何有效测绘：<b>{resolved.missingCodes.join("、")}</b>
              </div>
            )}
            {resolved.staleCodes.filter((c) => !resolved.missingCodes.includes(c)).length > 0 && (
              <div className="notice notice-error">
                检测到过期版本混用：<b>{resolved.staleCodes.filter((c) => !resolved.missingCodes.includes(c)).join("、")}</b>
                。若让这些构件进入施工清单将造成错误构件施工，已拦截。
              </div>
            )}
            {resolved.consistent && isLatest && (
              <div className="notice notice-ok">全图版本一致（均为最新批次 {latestBatch} 当日有效版本），可生成施工清单。</div>
            )}

            <div className="relation-graph-wrap">
              <svg className="relation-svg" viewBox="0 0 720 320">
                {resolved.edges.map((e) => {
                  const a = layout.get(e.from);
                  const b = layout.get(e.to);
                  if (!a || !b) return null;
                  const fromStale = resolved.nodes.find((n) => n.code === e.from);
                  const toStale = resolved.nodes.find((n) => n.code === e.to);
                  const bad = !fromStale?.survey || !toStale?.survey || fromStale.stale || toStale.stale;
                  const mx = (a.x + b.x) / 2;
                  const my = (a.y + b.y) / 2;
                  return (
                    <g key={e.id}>
                      <line x1={a.x} y1={a.y} x2={b.x} y2={b.y} stroke={bad ? "#dc2626" : "#854d0e"} strokeWidth={bad ? 2 : 1.6} strokeDasharray={bad ? "6 4" : undefined} />
                      <rect x={mx - 18} y={my - 10} width={36} height={18} rx={4} fill="#fff" stroke={bad ? "#dc2626" : "#a8a29e"} />
                      <text x={mx} y={my + 3} fontSize={10} textAnchor="middle" fill={bad ? "#dc2626" : "#57534e"}>
                        {e.kind}
                      </text>
                    </g>
                  );
                })}
                {resolved.nodes.map((n) => {
                  const p = layout.get(n.code);
                  if (!p) return null;
                  const cls = n.missing ? "node-missing" : n.stale ? "node-stale" : "node-ok";
                  return (
                    <g key={n.code} className={cls}>
                      <rect x={p.x - 52} y={p.y - 24} width={104} height={48} rx={8} />
                      <text x={p.x} y={p.y - 4} textAnchor="middle" fontSize={13} fontWeight={700}>
                        {n.code}
                      </text>
                      <text x={p.x} y={p.y + 14} textAnchor="middle" fontSize={10}>
                        {n.missing ? "无测绘" : n.stale ? `v${n.survey!.version} 已过期` : `v${n.survey!.version} 现行`}
                      </text>
                    </g>
                  );
                })}
              </svg>
            </div>

            <table className="data-table">
              <thead>
                <tr>
                  <th>构件</th>
                  <th>快照版本</th>
                  <th>榫卯</th>
                  <th>截面 (mm)</th>
                  <th>版本状态</th>
                </tr>
              </thead>
              <tbody>
                {resolved.nodes.map((n) => (
                  <tr key={n.code} className={n.missing ? "row-bad" : n.stale ? "row-warn" : ""}>
                    <td className="mono">{n.code}</td>
                    <td>{n.survey ? <VersionBadge v={n.survey.version} dim={n.stale} /> : "—"}</td>
                    <td>{n.survey ? <MortiseChip value={n.survey.mortise} /> : "—"}</td>
                    <td className="mono">{n.survey ? `${n.survey.width}×${n.survey.height}×${n.survey.length}` : "—"}</td>
                    <td>
                      {n.missing ? (
                        <span className="status-tag tag-old">批次内缺失</span>
                      ) : n.stale ? (
                        <span className="status-tag tag-old">过期版本混用</span>
                      ) : (
                        <span className="status-tag tag-live">同批有效</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </section>

      <section className="panel" id="construction-sheet">
        <div className="heading">
          <div>
            <p>施工清单 · 仅最新批次、全部同批有效版本可生成</p>
            <h2>修缮施工清单</h2>
          </div>
          <div className="btn-row">
            <button disabled={!listResult?.ok} onClick={() => window.print()}>
              打印
            </button>
            <button className="primary" disabled={!listResult?.ok} onClick={() => listResult?.ok && exportSheet(building, listResult.items)}>
              导出施工清单CSV
            </button>
          </div>
        </div>

        {!isLatest && <p className="hint">当前锚定历史批次，施工清单已锁定；请把批次切回“最新批次”。</p>}
        {listResult && !listResult.ok && (
          <div className="notice notice-error" role="alert">
            <b>施工清单生成被拦截：</b>
            <ul>
              {listResult.reasons.map((r, i) => (
                <li key={i}>{r}</li>
              ))}
            </ul>
          </div>
        )}
        {listResult?.ok && (
          <table className="data-table">
            <thead>
              <tr>
                <th>序号</th>
                <th>构件编号</th>
                <th>版本</th>
                <th>木材</th>
                <th>截面 宽×高×长 (mm)</th>
                <th>病害</th>
                <th>修缮建议</th>
              </tr>
            </thead>
            <tbody>
              {listResult.items.map((it, i) => (
                <tr key={it.survey.id}>
                  <td>{i + 1}</td>
                  <td className="mono">{it.code}</td>
                  <td>
                    <VersionBadge v={it.survey.version} />
                  </td>
                  <td>{it.survey.wood}</td>
                  <td className="mono">
                    {it.survey.width}×{it.survey.height}×{it.survey.length}
                  </td>
                  <td>{it.survey.diseases.map((d) => d.label).join("、")}</td>
                  <td>{it.advice?.content ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}

function layoutGraph(codes: string[], edges: { from: string; to: string }[]): Map<string, { x: number; y: number }> {
  const indeg = new Map<string, number>();
  codes.forEach((c) => indeg.set(c, 0));
  edges.forEach((e) => indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1));
  // 简化分层：按入度 BFS
  const level = new Map<string, number>();
  const queue = codes.filter((c) => (indeg.get(c) ?? 0) === 0);
  queue.forEach((c) => level.set(c, 0));
  let guard = 0;
  const remaining = new Set(edges);
  while (remaining.size && guard++ < 50) {
    for (const e of [...remaining]) {
      const lv = level.get(e.from);
      if (lv !== undefined) {
        level.set(e.to, Math.max(level.get(e.to) ?? 0, lv + 1));
        remaining.delete(e);
      }
    }
    if (remaining.size === edges.length) break;
  }
  codes.forEach((c) => {
    if (!level.has(c)) level.set(c, 1);
  });

  const byLevel = new Map<number, string[]>();
  codes.forEach((c) => {
    const lv = level.get(c) ?? 0;
    byLevel.set(lv, [...(byLevel.get(lv) ?? []), c].sort());
  });

  const pos = new Map<string, { x: number; y: number }>();
  const maxLv = Math.max(0, ...[...byLevel.keys()]);
  const colX = [110, 360, 610];
  byLevel.forEach((arr, lv) => {
    const x = colX[Math.min(lv, colX.length - 1)] ?? 360;
    arr.forEach((c, i) => {
      const y = 60 + i * 110 + (maxLv > 1 && arr.length === 1 ? 90 : 0);
      pos.set(c, { x, y });
    });
  });
  return pos;
}

function exportSheet(
  building: string,
  items: { code: string; survey: { version: number; wood: string; width: number; height: number; length: number; diseases: { label: string }[] }; advice?: { content: string } }[]
): void {
  const head = ["序号", "构件编号", "版本", "木材", "截面宽mm", "截面高mm", "构件长mm", "病害", "修缮建议"];
  const lines = items.map((it, i) =>
    [i + 1, it.code, `v${it.survey.version}`, it.survey.wood, it.survey.width, it.survey.height, it.survey.length,
      it.survey.diseases.map((d) => d.label).join("|"), it.advice?.content ?? ""]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",")
  );
  const blob = new Blob(["﻿" + [head.join(","), ...lines].join("\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${building}-施工清单.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}
