// SVG drawing of buildCanvas() output (docs/CONTRACT.md §5, wireframes in docs/canvas/*.svg).
// A portrait layout, 360 units wide, so it stays legible in a side panel and at 360 px.
import type { ReactNode } from 'react';
import type { CanvasModel } from '../engine/canvas';

const W = 360;
const PAD = 10;

const fit = (s: string, max: number) => (s.length <= max ? s : `${s.slice(0, Math.max(1, max - 1))}…`);
const titleCase = (id: string) =>
  id
    .split('_')
    .map((w) => (w ? w[0]!.toUpperCase() + w.slice(1) : w))
    .join(' ');

const BAND_TITLES: Record<string, string> = {
  platform_setup: 'Platform setup',
  access_governance: 'Security and governance',
  operations: 'Operations',
};

const SERVING_PARTS: Record<string, string[]> = {
  default: ['Models and reports'],
  split: ['Semantic models', 'Reports and apps'],
  shared: ['Models and reports together'],
  in_gold: ['Reports inside the Gold layer'],
  native: ['Native dashboards'],
  external: ['External BI tools'],
  both: ['Native dashboards', 'External BI tools'],
};

function Lock({ x, y }: { x: number; y: number }) {
  return (
    <g transform={`translate(${x} ${y})`} className="cv-lock" aria-hidden="true">
      <rect x="0" y="5" width="10" height="8" rx="1.5" />
      <path d="M2.5 5V3.5a2.5 2.5 0 0 1 5 0V5" fill="none" strokeWidth="1.4" />
    </g>
  );
}

export function Canvas({ model, caption }: { model: CanvasModel; caption: string }) {
  const und = new Set(model.undecided);
  const els: ReactNode[] = [];
  let y = 8;
  let k = 0;
  const key = () => `e${k++}`;

  const heading = (text: string) => {
    els.push(
      <text key={key()} x={PAD} y={y + 9} className="cv-h">
        {text}
      </text>,
    );
    y += 16;
  };

  // Sources
  heading('Sources');
  if (model.sources.length === 0) {
    els.push(
      <g key={key()}>
        <rect x={PAD} y={y} width={W - 2 * PAD} height={26} rx={4} className="cv-dash" />
        <text x={PAD + 8} y={y + 17} className="cv-m">
          Not chosen yet
        </text>
      </g>,
    );
    y += 32;
  } else {
    const cw = (W - 2 * PAD - 6) / 2;
    model.sources.forEach((s, i) => {
      const cx = PAD + (i % 2) * (cw + 6);
      const cy = y + Math.floor(i / 2) * 38;
      els.push(
        <g key={key()}>
          <rect x={cx} y={cy} width={cw} height={32} rx={4} className="cv-box" />
          <text x={cx + 7} y={cy + 14} className="cv-t">
            {fit(s.label, Math.floor((cw - 12) / 5.6))}
          </text>
          {s.mechanism && (
            <text x={cx + 7} y={cy + 26} className="cv-m">
              {fit(s.mechanism, Math.floor((cw - 12) / 5))}
            </text>
          )}
        </g>,
      );
    });
    y += Math.ceil(model.sources.length / 2) * 38;
  }
  y += 4;

  // Landing zone
  if (model.landing) {
    els.push(
      <g key={key()}>
        <rect x={PAD} y={y} width={W - 2 * PAD} height={26} rx={4} className="cv-box" />
        <text x={PAD + 8} y={y + 17} className="cv-t">
          {model.landing.label}
        </text>
      </g>,
    );
    y += 34;
  } else if (und.has('landing')) {
    els.push(
      <g key={key()}>
        <rect x={PAD} y={y} width={W - 2 * PAD} height={26} rx={4} className="cv-dash" />
        <text x={PAD + 8} y={y + 17} className="cv-m">
          Landing zone (optional, not decided)
        </text>
      </g>,
    );
    y += 34;
  }

  // Environments
  const innerX = PAD + 8;
  const innerW = W - 2 * PAD - 16;
  const stacked = model.containers.length > 1 && model.containers.every((c) => c.layers.length === model.layers.length);
  const rows = stacked ? model.containers.map((c) => [c]) : [model.containers];
  const layerById = new Map(model.layers.map((l) => [l.id, l]));
  const lockStorage = model.locks.includes('storage') || model.locks.includes('all');
  const lockModel = model.locks.includes('model') || model.locks.includes('all');
  const rowH = 78;

  heading(und.has('environments') ? 'Environment (not decided, shown as prod)' : 'Environments');
  for (const env of model.environments) {
    const h = 22 + rows.length * (rowH + 6);
    const envEls: ReactNode[] = [
      <rect key="env" x={PAD} y={y} width={W - 2 * PAD} height={h} rx={6} className={und.has('environments') ? 'cv-dash' : 'cv-env'} />,
      <text key="envt" x={PAD + 8} y={y + 14} className="cv-h">
        {env}
      </text>,
    ];
    rows.forEach((row, ri) => {
      const total = row.reduce((n, c) => n + c.layers.length, 0) || 1;
      const gap = 6;
      let cx = innerX;
      const ry = y + 20 + ri * (rowH + 6);
      row.forEach((c, ci) => {
        const cw = ((innerW - gap * (row.length - 1)) * c.layers.length) / total;
        const lw = (cw - 10 - 4 * (c.layers.length - 1)) / c.layers.length;
        envEls.push(
          <g key={`c${ri}-${ci}`}>
            <rect x={cx} y={ry} width={cw} height={rowH} rx={4} className={und.has('containers') ? 'cv-dash' : 'cv-box'} />
            <text x={cx + 5} y={ry + 12} className="cv-m">
              {fit(c.label, Math.floor((cw - 8) / 4.8))}
            </text>
            {c.layers.map((id, li) => {
              const l = layerById.get(id);
              const lx = cx + 5 + li * (lw + 4);
              const ly = ry + 18;
              const lockHere = lockStorage && (id === 'silver' || id === 'gold');
              return (
                <g key={id}>
                  <rect x={lx} y={ly} width={lw} height={rowH - 24} rx={3} className={und.has('layers') ? 'cv-dash' : 'cv-layer'} />
                  <text x={lx + 5} y={ly + 16} className="cv-t cv-b">
                    {fit(l?.label ?? titleCase(id), Math.floor((lw - 8) / 6))}
                  </text>
                  {l?.engine && !und.has('engines') && (
                    <text x={lx + 5} y={ly + 31} className="cv-m">
                      {fit(l.engine, Math.floor((lw - 8) / 5))}
                    </text>
                  )}
                  {lockHere && <Lock x={lx + lw - 14} y={ly + 2} />}
                </g>
              );
            })}
          </g>,
        );
        cx += cw + gap;
      });
    });
    els.push(<g key={key()}>{envEls}</g>);
    y += h + 6;
  }

  // Transformation band
  if (model.transform_band) {
    els.push(
      <g key={key()}>
        <rect x={PAD} y={y} width={W - 2 * PAD} height={24} rx={4} className="cv-box" />
        <text x={PAD + 8} y={y + 16} className="cv-t">
          Transformations
        </text>
      </g>,
    );
    y += 32;
  } else if (und.has('transform_band')) {
    els.push(
      <g key={key()}>
        <rect x={PAD} y={y} width={W - 2 * PAD} height={24} rx={4} className="cv-dash" />
        <text x={PAD + 8} y={y + 16} className="cv-m">
          Transformations (optional, not decided)
        </text>
      </g>,
    );
    y += 32;
  }

  // Serving lane
  const parts = SERVING_PARTS[model.serving.pattern] ?? [titleCase(model.serving.pattern)];
  const sh = 24 + parts.length * 28;
  const servingUndecided = und.has('serving');
  els.push(
    <g key={key()}>
      <rect x={PAD} y={y} width={W - 2 * PAD} height={sh} rx={6} className={servingUndecided ? 'cv-dash' : 'cv-env'} />
      <text x={PAD + 8} y={y + 15} className="cv-h">
        {model.serving.label}
        {servingUndecided ? ' (not decided)' : ''}
      </text>
      {lockModel && <Lock x={W - PAD - 20} y={y + 4} />}
      {parts.map((p, i) => (
        <g key={p}>
          <rect x={PAD + 8} y={y + 22 + i * 28} width={W - 2 * PAD - 16} height={22} rx={3} className={servingUndecided ? 'cv-dash' : 'cv-box'} />
          <text x={PAD + 16} y={y + 37 + i * 28} className={servingUndecided ? 'cv-m' : 'cv-t'}>
            {p}
          </text>
        </g>
      ))}
    </g>,
  );
  y += sh + 10;

  // Bands
  for (const band of model.bands) {
    heading(BAND_TITLES[band.cluster] ?? band.cluster);
    if (band.chips.length === 0) {
      els.push(
        <g key={key()}>
          <rect x={PAD} y={y} width={W - 2 * PAD} height={22} rx={4} className="cv-dash" />
          <text x={PAD + 8} y={y + 15} className="cv-m">
            Nothing decided yet
          </text>
        </g>,
      );
      y += 28;
    } else {
      let cx = PAD;
      let cy = y;
      for (const chip of band.chips) {
        const cw = Math.min(W - 2 * PAD, chip.length * 5.6 + 14);
        if (cx + cw > W - PAD) {
          cx = PAD;
          cy += 26;
        }
        els.push(
          <g key={key()}>
            <rect x={cx} y={cy} width={cw} height={22} rx={11} className="cv-box" />
            <text x={cx + 8} y={cy + 15} className="cv-t">
              {chip}
            </text>
          </g>,
        );
        cx += cw + 6;
      }
      y = cy + 30;
    }
  }

  // Footer badges
  if (model.footer_badges.length) {
    let cx = PAD;
    let cy = y;
    for (const b of model.footer_badges) {
      const cw = Math.min(W - 2 * PAD, b.length * 5.6 + 14);
      if (cx + cw > W - PAD) {
        cx = PAD;
        cy += 26;
      }
      els.push(
        <g key={key()}>
          <rect x={cx} y={cy} width={cw} height={20} rx={4} className="cv-badge" />
          <text x={cx + 7} y={cy + 14} className="cv-t">
            {b}
          </text>
        </g>,
      );
      cx += cw + 6;
    }
    y = cy + 28;
  }

  const total = y + 4;
  const decidedParts = 8 - und.size;
  return (
    <figure className="canvas-fig">
      <svg
        viewBox={`0 0 ${W} ${total}`}
        width="100%"
        role="img"
        aria-label={`${caption}. ${decidedParts} of 8 parts decided. Dashed grey parts are not decided yet.`}
        className="canvas"
      >
        {els}
      </svg>
      <figcaption className="muted small">Dashed grey parts are not decided yet. They fill in as topics are decided.</figcaption>
    </figure>
  );
}
