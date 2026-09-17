import { useState } from "react";
import type { SurveyStore } from "../domain/store";

/**
 * 构件关系视图 + 施工清单。
 * 视图只引用各构件“同批有效版本”；被排除的构件明确列出原因，
 * 施工清单完全由该视图派生，杜绝过期版本混入。
 */
export function RelationshipPanel(props: { store: SurveyStore; building: string }) {
  const { store, building } = props;
  const batches = store.listBatches(building);
  const [batch, setBatch] = useState<string>(batches[batches.length - 1] ?? "");
  const activeBatch = batches.includes(batch) ? batch : batches[batches.length - 1] ?? "";

  const view = activeBatch ? store.getRelationshipView(building, activeBatch) : null;
  const constructionList = activeBatch ? store.getConstructionList(building, activeBatch) : [];

  return (
    <section className="panel">
      <div className="heading">
        <div>
          <p>构件关系视图 · 施工清单</p>
          <h2>按测绘批次查看（仅引用同批有效版本）</h2>
        </div>
        <div className="chips">
          {batches.map((b) => (
            <button key={b} className={activeBatch === b ? "chip active" : "chip"} onClick={() => setBatch(b)}>
              {b}
            </button>
          ))}
        </div>
      </div>

      {view && (
        <>
          <div className="view-grid">
            <div>
              <h3>视图节点（{view.nodes.length}）</h3>
              {view.nodes.length === 0 && <p className="hint">本批次没有有效测绘版本。</p>}
              <div className="node-list">
                {view.nodes.map((n) => (
                  <div key={n.componentId} className="node-card">
                    <b>{n.componentId}</b>
                    <span>{n.wood} · {n.jointType}</span>
                    <span className="badge valid">v{n.versionNo} · {n.batchId}</span>
                  </div>
                ))}
              </div>

              <h3>榫卯连接（{view.edges.length}）</h3>
              {view.edges.length === 0 && <p className="hint">视图内暂无连接（连接两端须同在本批次视图内）。</p>}
              <ul className="edge-list">
                {view.edges.map((e) => (
                  <li key={`${e.a}-${e.b}`}>{e.a} ⇄ {e.b}</li>
                ))}
              </ul>
            </div>

            <div>
              <h3>被排除构件（{view.excluded.length}）</h3>
              {view.excluded.length === 0 && <p className="hint">无排除项：本建筑全部构件在本批次均有有效版本。</p>}
              {view.excluded.map((e) => (
                <div key={e.componentId} className="notice warning">
                  <b>{e.componentId}</b>：{e.reason}
                </div>
              ))}
            </div>
          </div>

          <h3>施工清单（由本视图派生，{constructionList.length} 项）</h3>
          {constructionList.length === 0 && (
            <p className="hint">本批次视图内暂无需要修缮的构件。</p>
          )}
          {constructionList.length > 0 && (
            <table className="data-table">
              <thead>
                <tr><th>构件</th><th>依据版本</th><th>榫卯</th><th>最高优先级</th><th>修缮措施</th></tr>
              </thead>
              <tbody>
                {constructionList.map((item) => (
                  <tr key={item.componentId}>
                    <td><b>{item.componentId}</b></td>
                    <td>v{item.versionNo} · {item.batchId}</td>
                    <td>{item.jointType}</td>
                    <td><span className={`priority p-${item.topPriority}`}>{item.topPriority}</span></td>
                    <td>
                      <ul className="action-list">
                        {item.actions.map((a, i) => (
                          <li key={i}>{a.action}<small>（{a.reason}）</small></li>
                        ))}
                      </ul>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </>
      )}
    </section>
  );
}
