import { useState } from "react";
import { createSeededStore, SEED_BUILDING } from "./domain/seed";
import { needsRepair } from "./domain/suggest";
import { ComponentList } from "./ui/ComponentList";
import { RelationshipPanel } from "./ui/RelationshipPanel";
import { SurveyForm } from "./ui/SurveyForm";
import "./styles.css";

function App() {
  const [store] = useState(() => createSeededStore());
  const [, setTick] = useState(0);
  const refresh = () => setTick((t) => t + 1);

  const buildings = [...new Set(store.listComponents().map((c) => c.buildingId))];
  const [building, setBuilding] = useState(SEED_BUILDING);
  const activeBuilding = buildings.includes(building) ? building : buildings[0] ?? SEED_BUILDING;

  const components = store.listComponents(activeBuilding);
  const versionCount = components.reduce((n, c) => n + store.getVersionHistory(c.buildingId, c.componentId).length, 0);
  const activeSuggestions = components
    .map((c) => store.getActiveSuggestion(c.buildingId, c.componentId))
    .filter((s) => s != null);
  const pendingRepair = activeSuggestions.filter((s) => needsRepair(s)).length;
  const batches = store.listBatches(activeBuilding);

  return (
    <main className="app">
      <section className="hero">
        <p>hxyfront-62013 · 古建木结构 · 修缮版本闭环</p>
        <h1>木结构榫卯构件测绘</h1>
        <span>
          同一建筑内构件编号唯一；木材、榫卯类型、截面尺寸、病害位置、变形齐全方可入库——
          截面非正、病害越界一律拒绝且不覆盖旧测绘。修缮建议只由最新有效测绘生成，
          重新测绘立即使旧建议失效、旧版本仍可查；构件关系视图与施工清单只引用同批有效版本。
        </span>
      </section>

      <section className="metrics">
        <article><small>构件数量</small><strong>{components.length}</strong></article>
        <article><small>测绘版本</small><strong>{versionCount}</strong></article>
        <article><small>生效建议</small><strong>{activeSuggestions.length}</strong></article>
        <article><small>待修缮</small><strong>{pendingRepair}</strong></article>
      </section>

      <div className="building-bar">
        <span>当前建筑：</span>
        <div className="chips">
          {buildings.map((b) => (
            <button key={b} className={activeBuilding === b ? "chip active" : "chip"} onClick={() => setBuilding(b)}>
              {b}
            </button>
          ))}
        </div>
      </div>

      <section className="workspace">
        <SurveyForm
          store={store}
          defaultBuilding={activeBuilding}
          defaultBatch={batches[batches.length - 1] ?? ""}
          onSubmitted={refresh}
        />
        <ComponentList store={store} building={activeBuilding} />
      </section>

      <RelationshipPanel store={store} building={activeBuilding} />
    </main>
  );
}

export default App;
