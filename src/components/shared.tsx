import { DiseaseMarker, SurveyVersion } from "../types";

const COLORS = ["#b91c1c", "#c2410c", "#a16207", "#7c2d12", "#9f1239"];

/** 构件展开图：长方形为构件侧面，x 沿长度（mm），y 为截面高度方向（0 底 → 1 顶） */
export function DiseaseDiagram({
  length,
  diseases,
  height = 150,
  invalidPoints,
}: {
  length: number;
  diseases: DiseaseMarker[];
  height?: number;
  /** 表单预览时的越界点（原始输入，可能超出坐标范围，做裁剪/红圈提示） */
  invalidPoints?: { x: number | null; y: number | null; label: string }[];
}) {
  const W = 560;
  const H = height;
  const pad = 26;
  const len = length > 0 ? length : 1;

  const px = (x: number) => pad + (Math.min(Math.max(x, 0), len) / len) * (W - pad * 2);
  const py = (y: number) => H - pad - Math.min(Math.max(y, 0), 1) * (H - pad * 2);

  return (
    <svg className="disease-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="病害标记图">
      <rect x={pad} y={pad} width={W - pad * 2} height={H - pad * 2} fill="#f8f4ec" stroke="#854d0e" strokeWidth={1.5} />
      <line x1={pad} y1={H - pad} x2={W - pad} y2={H - pad} stroke="#a8a29e" strokeWidth={1} />
      <text x={pad} y={H - 8} fontSize={11} fill="#78716c">
        0
      </text>
      <text x={W - pad - 34} y={H - 8} fontSize={11} fill="#78716c">
        {length}mm
      </text>
      <text x={6} y={pad + 6} fontSize={11} fill="#78716c">
        顶
      </text>
      <text x={6} y={H - pad} fontSize={11} fill="#78716c">
        底
      </text>

      {diseases.map((d, i) => (
        <g key={d.id} className="disease-marker">
          <circle cx={px(d.x)} cy={py(d.y)} r={7} fill={COLORS[i % COLORS.length]} fillOpacity={0.85} />
          <text x={px(d.x) + 10} y={py(d.y) - 8} fontSize={11} fill="#44403c">
            {i + 1}.{d.label}（{d.x}mm）
          </text>
        </g>
      ))}

      {(invalidPoints ?? []).map((p, i) => {
        if (p.x === null || p.y === null || !Number.isFinite(p.x) || !Number.isFinite(p.y)) return null;
        const out = p.x < 0 || p.x > len || p.y < 0 || p.y > 1;
        if (!out) return null;
        const key = `inv-${i}`;
        return (
          <g key={key}>
            <circle
              cx={px(p.x)}
              cy={py(p.y)}
              r={8}
              fill="none"
              stroke="#dc2626"
              strokeWidth={2}
              strokeDasharray="3 2"
            />
            <text x={px(p.x) + 10} y={py(p.y) + 4} fontSize={11} fill="#dc2626">
              {i + 1}. 越界 {p.label}
            </text>
          </g>
        );
      })}
    </svg>
  );
}

export function VersionBadge({ v, dim }: { v: number; dim?: boolean }) {
  return <span className={`badge ${dim ? "badge-dim" : "badge-live"}`}>v{v}</span>;
}

export function MortiseChip({ value }: { value: string }) {
  return <span className="mortise-chip">{value}</span>;
}

export function SurveyReadonly({ survey }: { survey: SurveyVersion }) {
  return (
    <div className="survey-readonly">
      <DiseaseDiagram length={survey.length} diseases={survey.diseases} />
      <dl className="dim-dl">
        <div>
          <dt>木材</dt>
          <dd>{survey.wood}</dd>
        </div>
        <div>
          <dt>榫卯</dt>
          <dd>{survey.mortise}</dd>
        </div>
        <div>
          <dt>截面 (宽×高×长)</dt>
          <dd>
            {survey.width}×{survey.height}×{survey.length} mm
          </dd>
        </div>
        <div>
          <dt>变形</dt>
          <dd>{survey.deformation}</dd>
        </div>
      </dl>
    </div>
  );
}
