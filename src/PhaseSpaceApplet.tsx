import React, { useEffect, useMemo, useRef, useState } from "react";
import { create, all } from "mathjs";

const math = create(all, {});

// ---------- Utilities ----------
function clamp(v: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, v));
}
function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}
function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}
function rk4(x: number[], dt: number, f: (x: number[]) => number[]) {
  const k1 = f(x);
  const x2 = x.map((xi, i) => xi + 0.5 * dt * k1[i]);
  const k2 = f(x2);
  const x3 = x.map((xi, i) => xi + 0.5 * dt * k2[i]);
  const k3 = f(x3);
  const x4 = x.map((xi, i) => xi + dt * k3[i]);
  const k4 = f(x4);
  return x.map(
    (xi, i) => xi + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])
  );
}
function compileF(rawList: string[]) {
  return rawList.map((raw) => {
    const expr = (raw ?? "").trim();
    if (!expr) return { evalFn: () => 0 };
    try {
      const compiled = math.compile(expr);
      return {
        evalFn: (scope: Record<string, number>) => {
          try {
            const v = compiled.evaluate(scope);
            const num = Number(v);
            return Number.isFinite(num) ? num : 0;
          } catch {
            return 0;
          }
        },
      };
    } catch {
      return { evalFn: () => 0 };
    }
  });
}
function makeF(
  compiled: ReturnType<typeof compileF>,
  n: number,
  params: Record<string, number>
) {
  const varNames = Array.from({ length: n }, (_, i) => `x${i + 1}`);
  return (x: number[]) => {
    const scope = { ...params };
    varNames.forEach((v, i) => (scope[v] = x[i] ?? 0));
    return compiled.map((c) => c.evalFn(scope));
  };
}

// ---------- Main App ----------
export default function PhaseSpaceApplet() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const width = 700;
  const height = 500;

  // System definition
  const [n, setN] = useState(2);
  const [fText, setFText] = useState("x2, -x1");
  const [paramsText, setParamsText] = useState("{}");
  const [fixedOtherText, setFixedOtherText] = useState("[]");
  const [iIndex, setIIndex] = useState(1);
  const [jIndex, setJIndex] = useState(2);

  const [xMin, setXMin] = useState(-5);
  const [xMax, setXMax] = useState(5);
  const [yMin, setYMin] = useState(-5);
  const [yMax, setYMax] = useState(5);
  const [grid, setGrid] = useState(20);
  const [arrowScale, setArrowScale] = useState(0.6);
  const [dt, setDt] = useState(0.02);
  const [T, setT] = useState(20);

  const [trajectories, setTrajectories] = useState<any[]>([]);

  const params = useMemo(() => {
    try {
      return JSON.parse(paramsText);
    } catch {
      return {};
    }
  }, [paramsText]);

  const fixedOthers = useMemo(() => {
    try {
      const arr = JSON.parse(fixedOtherText);
      return Array.isArray(arr) ? arr : [];
    } catch {
      return [];
    }
  }, [fixedOtherText]);

  const parts = useMemo(() => {
    const arr = fText.split(",").map((s) => s.trim());
    while (arr.length < n) arr.push("0");
    return arr.slice(0, n);
  }, [fText, n]);

  const compiled = useMemo(() => compileF(parts), [parts]);
  const f = useMemo(() => makeF(compiled, n, params), [compiled, n, params]);

  const worldToCanvas = (wx: number, wy: number) => {
    const xScale = width / (xMax - xMin);
    const yScale = height / (yMax - yMin);
    return {
      cx: (wx - xMin) * xScale,
      cy: height - (wy - yMin) * yScale,
    };
  };
  const canvasToWorld = (cx: number, cy: number) => {
    const xScale = width / (xMax - xMin);
    const yScale = height / (yMax - yMin);
    return {
      wx: cx / xScale + xMin,
      wy: (height - cy) / yScale + yMin,
    };
  };

  // Draw field + trajectories
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);

    // Axes
    const { cx: cx0, cy: cy0 } = worldToCanvas(0, 0);
    ctx.strokeStyle = "#ccc";
    ctx.beginPath();
    ctx.moveTo(0, cy0);
    ctx.lineTo(width, cy0);
    ctx.moveTo(cx0, 0);
    ctx.lineTo(cx0, height);
    ctx.stroke();

    // Vector field
    for (let gx = 0; gx <= grid; gx++) {
      for (let gy = 0; gy <= grid; gy++) {
        const wx = lerp(xMin, xMax, gx / grid);
        const wy = lerp(yMin, yMax, gy / grid);

        const state = new Array(n).fill(0);
        fixedOthers.forEach((v, idx) => (state[idx] = v));
        state[iIndex - 1] = wx;
        state[jIndex - 1] = wy;

        const fx = f(state);
        const vx = fx[iIndex - 1];
        const vy = fx[jIndex - 1];
        const len = Math.hypot(vx, vy) || 1e-9;

        const dirx = (vx / len) * arrowScale * (xMax - xMin) / grid;
        const diry = (vy / len) * arrowScale * (yMax - yMin) / grid;

        const x2 = wx + dirx;
        const y2 = wy + diry;
        const { cx: x1c, cy: y1c } = worldToCanvas(wx, wy);
        const { cx: x2c, cy: y2c } = worldToCanvas(x2, y2);
        ctx.strokeStyle = "#333";
        ctx.beginPath();
        ctx.moveTo(x1c, y1c);
        ctx.lineTo(x2c, y2c);
        ctx.stroke();
      }
    }

    // Trajectories
    for (const tr of trajectories) {
      if (tr.points.length < 2) continue;
      ctx.strokeStyle = tr.color;
      ctx.beginPath();
      const start = worldToCanvas(tr.points[0].x, tr.points[0].y);
      ctx.moveTo(start.cx, start.cy);
      for (let i = 1; i < tr.points.length; i++) {
        const { cx, cy } = worldToCanvas(tr.points[i].x, tr.points[i].y);
        ctx.lineTo(cx, cy);
      }
      ctx.stroke();
    }
  }, [trajectories, n, grid, arrowScale, f, iIndex, jIndex, fixedOthers, xMin, xMax, yMin, yMax]);

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const { wx, wy } = canvasToWorld(e.clientX - rect.left, e.clientY - rect.top);
    const x0 = new Array(n).fill(0);
    fixedOthers.forEach((v, idx) => (x0[idx] = v));
    x0[iIndex - 1] = wx;
    x0[jIndex - 1] = wy;

    const color = `hsl(${Math.random() * 360}, 70%, 45%)`;
    const pts: { x: number; y: number }[] = [];
    let x = x0.slice();
    for (let t = 0; t < T; t += dt) {
      pts.push({ x: x[iIndex - 1], y: x[jIndex - 1] });
      x = rk4(x, dt, f);
      if (
        x[iIndex - 1] < xMin - 2 ||
        x[iIndex - 1] > xMax + 2 ||
        x[jIndex - 1] < yMin - 2 ||
        x[jIndex - 1] > yMax + 2
      )
        break;
    }
    setTrajectories((prev) => [...prev, { color, points: pts }]);
  };

  return (
    <div style={{ fontFamily: "sans-serif", padding: 20 }}>
      <h2>Phase-Space Visualizer (ẋ = f(x)) — by Kristian Jamieson</h2>
      <p>
        Visualize 2D sections of n-dimensional systems ẋ = f(x). Choose n, select which
        dimensions to plot (i, j), and fix others as constants.
      </p>

      <div style={{ marginBottom: 8 }}>
        <label>n:
          <input type="number" min={2} max={8} value={n}
            onChange={(e) => setN(clamp(Number(e.target.value), 2, 8))} style={{ width: 60, marginLeft: 5 }} />
        </label>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>f(x):
          <input style={{ width: 400, marginLeft: 5 }}
            value={fText} onChange={(e) => setFText(e.target.value)} />
        </label>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>params (JSON):
          <input style={{ width: 300, marginLeft: 5 }}
            value={paramsText} onChange={(e) => setParamsText(e.target.value)} />
        </label>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>fixed other dims (JSON array):
          <input style={{ width: 300, marginLeft: 5 }}
            value={fixedOtherText} onChange={(e) => setFixedOtherText(e.target.value)} />
        </label>
      </div>

      <div style={{ marginBottom: 8 }}>
        <label>i:
          <input type="number" min={1} max={n}
            value={iIndex} onChange={(e) => setIIndex(clamp(Number(e.target.value), 1, n))}
            style={{ width: 60, marginLeft: 5 }} />
        </label>
        <label style={{ marginLeft: 10 }}>j:
          <input type="number" min={1} max={n}
            value={jIndex} onChange={(e) => setJIndex(clamp(Number(e.target.value), 1, n))}
            style={{ width: 60, marginLeft: 5 }} />
        </label>
      </div>

      <canvas
        ref={canvasRef}
        width={width}
        height={height}
        onClick={handleClick}
        style={{ border: "1px solid #aaa", cursor: "crosshair", background: "#fff" }}
      />

      <div style={{ marginTop: 8 }}>
        <button onClick={() => setTrajectories([])}>Clear trajectories</button>
      </div>
    </div>
  );
}
