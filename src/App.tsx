import { useMemo, useState } from "react";
import "./styles.css";
import { StoreProvider, buildingNames, useStore } from "./store";
import { currentSurveys, expiredAdvices, listBatches } from "./domain";
import { SurveyFormView } from "./components/SurveyFormView";
import { ComponentListView } from "./components/ComponentListView";
import { RecordsView } from "./components/RecordsView";
import { HistoryView } from "./components/HistoryView";
import { RelationView } from "./components/RelationView";

const TABS = [
  { key: "form", label: "测绘录入" },
  { key: "components", label: "构件清单" },
  { key: "records", label: "尺寸与病害图" },
  { key: "history", label: "版本历史" },
  { key: "relation", label: "关系视图/施工清单" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

function Shell() {
  const { state, reset } = useStore();
  const names = useMemo(() => buildingNames(state), [state]);
  const [building, setBuilding] = useState(names[0] ?? "大雄宝殿");
  const [tab, setTab] = useState<TabKey>("form");

  const activeBuilding = names.includes(building) ? building : names[0] ?? building;
  const currents = currentSurveys(state, activeBuilding);
  const batches = listBatches(state);
  const diseaseCount = currents.reduce((n, s) => n + s.diseases.length, 0);
  const mortiseCount = new Set(currents.map((s) => s.mortise)).size;
  const expired = expiredAdvices(state).filter((a) => a.building === activeBuilding).length;

  const metrics = [
    { label: "构件数量（有效）", value: currents.length },
    { label: "当前病害点", value: diseaseCount },
    { label: "榫卯类型", value: mortiseCount },
    { label: "已失效旧建议（留存）", value: expired },
    { label: "测绘批次", value: batches.length },
  ];

  return (
    <main className="app">
      <section className="hero">
        <p>古建木构测绘 · 修缮版本闭环 · Port 62013</p>
        <h1>木结构榫卯构件测绘</h1>
        <span>
          测绘经完整性与边界校验后方可入库；同一建筑构件编号唯一，重新测绘追加版本并使旧修缮建议即时失效，旧版本永久可查。
          构件关系视图按批次锚定同批有效版本，任何过期版本混用都会被施工清单拦截。
        </span>
        <div className="hero-bar">
          <label className="building-select">
            <span>当前建筑</span>
            <select value={activeBuilding} onChange={(e) => setBuilding(e.target.value)}>
              {names.map((n) => (
                <option key={n}>{n}</option>
              ))}
            </select>
          </label>
          <button className="ghost" onClick={reset}>
            恢复示例数据
          </button>
        </div>
      </section>

      <section className="metrics metrics-5">
        {metrics.map((m) => (
          <article key={m.label}>
            <small>{m.label}</small>
            <strong>{m.value}</strong>
          </article>
        ))}
      </section>

      <nav className="tabs">
        {TABS.map((t) => (
          <button key={t.key} className={tab === t.key ? "tab-on" : ""} onClick={() => setTab(t.key)}>
            {t.label}
          </button>
        ))}
      </nav>

      {tab === "form" && <SurveyFormView building={activeBuilding} />}
      {tab === "components" && <ComponentListView building={activeBuilding} />}
      {tab === "records" && <RecordsView building={activeBuilding} />}
      {tab === "history" && <HistoryView building={activeBuilding} />}
      {tab === "relation" && <RelationView building={activeBuilding} />}

      <footer className="foot">
        闭环规则：校验拒收不覆盖旧测绘 · 建议只绑定单一测绘版本 · 关系视图强制同批快照 · 施工清单拒绝过期版本
      </footer>
    </main>
  );
}

export default function App() {
  return (
    <StoreProvider>
      <Shell />
    </StoreProvider>
  );
}
