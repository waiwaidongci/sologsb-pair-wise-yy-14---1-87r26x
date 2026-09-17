import { useMemo, useState } from "react";
import { currentVersionOf, formatTime, versionsOf } from "../domain";
import { useStore } from "../store";
import { SurveyReadonly, VersionBadge } from "./shared";

export function HistoryView({ building }: { building: string }) {
  const { state } = useStore();
  const codes = useMemo(
    () => [...new Set(state.surveys.filter((s) => s.building === building).map((s) => s.code))].sort(),
    [state, building]
  );
  const [code, setCode] = useState<string>(codes[0] ?? "");
  const activeCode = codes.includes(code) ? code : codes[0] ?? "";
  const chain = activeCode ? versionsOf(state, building, activeCode) : [];
  const currentId = currentVersionOf(state, building, activeCode)?.id;

  const rejections = state.rejections.filter((r) => r.building === building);

  return (
    <div className="stack">
      <section className="panel">
        <div className="heading">
          <div>
            <p>版本历史 · 重新测绘追加版本，旧版本永不覆盖</p>
            <h2>修缮版本链</h2>
          </div>
        </div>
        <div className="chips">
          {codes.map((c) => (
            <button key={c} className={activeCode === c ? "chip-on" : ""} onClick={() => setCode(c)}>
              {c}
            </button>
          ))}
          {codes.length === 0 && <span className="muted">该建筑暂无测绘</span>}
        </div>

        <div className="version-timeline">
          {chain
            .slice()
            .reverse()
            .map((v) => {
              const advice = state.advices.find((a) => a.surveyId === v.id);
              const live = v.id === currentId;
              return (
                <article key={v.id} className={`version-card ${live ? "version-live" : "version-old"}`}>
                  <header>
                    <h3>
                      {v.code} <VersionBadge v={v.version} dim={!live} />
                      {live ? <span className="status-tag tag-live">当前有效</span> : <span className="status-tag tag-old">历史版本·可查</span>}
                    </h3>
                    <small className="muted">
                      批次 {v.batchId} · {formatTime(v.batchTime)}
                    </small>
                  </header>
                  <SurveyReadonly survey={v} />
                  {advice && (
                    <div className={`advice-box ${live ? "" : "advice-expired"}`}>
                      <h4>
                        修缮建议 v{advice.version}
                        {live ? <span className="status-tag tag-live">生效中</span> : <span className="status-tag tag-old">已失效（被新测绘取代）</span>}
                      </h4>
                      <p>{advice.content}</p>
                      <small className="muted">生成于 {formatTime(advice.createdAt)}，失效后记录仍保留</small>
                    </div>
                  )}
                </article>
              );
            })}
        </div>
      </section>

      <section className="panel">
        <div className="heading">
          <div>
            <p>拒收留痕 · 校验失败的测绘不产生版本、不覆盖旧数据</p>
            <h2>拒收测绘日志（{rejections.length}）</h2>
          </div>
        </div>
        {rejections.length === 0 && <p className="hint">暂无拒收记录。</p>}
        <div className="reject-list">
          {rejections.map((r) => (
            <article key={r.id} className="reject-card">
              <header>
                <b>
                  {r.building} / {r.code}
                </b>
                <time>{formatTime(r.time)}</time>
              </header>
              <ul>
                {r.reasons.map((x, i) => (
                  <li key={i}>{x}</li>
                ))}
              </ul>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
