import React, { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from "react";

/**
 * Scroll + Zoom spotlight canvas (no CDN, pure React)
 *
 * 仕様（要約）
 * - 初期は俯瞰（stepIndex = -1）：スポットライト/説明は非表示
 * - Next：ノードクリックと同じ動き。STEP1→STEP2…と進み、末尾で俯瞰へスムーズに戻る
 * - HUD は最小（全体表示・Next）。説明カードは右下にのみ表示（ズーム中＆step >= 0）
 * - スクロール同期は不可視マーカー（data-step）で行い、手動操作中は抑止
 *
 * 本版では「マジックナンバー」をすべて const 化し、意味のある名前で一箇所に集約
 */

// ===== 定数（マジックナンバーの排除） =====
// レイアウト/ワールド境界関連
const WORLD_MARGIN = 40;                // ノード群の外側に確保する余白（ワールド境界用）
const GRID_STEP = 40;                   // 背景グリッドの間隔
const CAMERA_PADDING = 60;              // 俯瞰時（fitAll）の画面内パディング
const NODE_FIT_PADDING = 48;            // 個別ノードにフォーカスするときの画面内パディング

// 描画（ノード装飾）
const CORNER_RADIUS = 12;               // ノードの角丸
const BADGE_RADIUS_BASE = 14;           // 右上のステップ番号バッジの基準半径
const BADGE_OFFSET = 6;                 // バッジのノード端からのオフセット
const ARROW_HEAD_SIZE = 8;              // エッジの矢印サイズ

// スポットライト演出
const SPOTLIGHT_MIN_RADIUS = 160;       // スポット最小半径
const SPOTLIGHT_RADIUS_SCALE = 0.65;    // ノード大きさに対する半径スケール
const SPOTLIGHT_EXTRA = 80;             // スポット半径の加算分
const SPOTLIGHT_INNER_RATIO = 0.05;     // ラジアルグラデーションの内側半径割合

// カメラ操作/アニメーション
const CAMERA_EASE = "easeInOutCubic";   // 既定イージング
const CAMERA_DURATION_STEP = 700;       // STEP間（ノード→ノード）移動の所要時間
const CAMERA_DURATION_OVERVIEW = 900;   // 最終STEP→俯瞰に戻る所要時間
const CAMERA_DURATION_RESET = 700;      // リセット（俯瞰）押下時の所要時間
const SCROLL_SYNC_DURATION = 750;       // スクロール同期でのカメラ移動時間
const SUPPRESS_MS_SHORT = 400;          // 手動ナビ時にスクロール同期を抑止する短時間
const SUPPRESS_MS_LONG = 600;           // 俯瞰戻し時などの少し長い抑止

// ズーム係数
const WHEEL_ZOOM_FACTOR = 1.15;         // ホイール/キーでのズーム倍率

/**
 * Scroll + Zoom spotlight canvas（CDN不要、純React）
 *
 * - 初期：俯瞰（stepIndex = -1）
 * - Next：クリックと同一動作 → 次STEPのノード中心にズーム/パン
 * - 末尾Next：fitAll と同じ目標値へアニメーションで移動
 */

// ===== Model =====
const NODES = [
  { id: "github",  label: "GitHub",         x: 80,   y: 120, w: 160, h: 60, color: "#111827", note: "ソースコード管理。push/PR で CI トリガー。OIDC/トークンで認可。" },
  { id: "docker",  label: "Docker Build",   x: 320,  y: 120, w: 180, h: 60, color: "#0ea5e9", note: "CI 上で build/push。マルチステージ/キャッシュ/スキャン。" },
  { id: "ecr",     label: "Amazon ECR",     x: 580,  y: 120, w: 180, h: 60, color: "#10b981", note: "イメージ保管。ライフサイクル/Immutable タグ/署名。" },
  { id: "taskdef", label: "Task Definition", x: 840,  y: 120, w: 200, h: 60, color: "#8b5cf6", note: "イメージURI/CPU/MEM/環境変数/ログ/リビジョン。" },
  { id: "cluster", label: "ECS Cluster",     x: 1100, y: 120, w: 180, h: 60, color: "#f59e0b", note: "Fargate/EC2 実行基盤。" },
  { id: "service", label: "ECS Service",     x: 1360, y: 120, w: 180, h: 60, color: "#ef4444", note: "タスク数/デプロイ/ALB/AutoScale/Service Connect。" },
];

const EDGES = [
  { from: "github", to: "docker" },
  { from: "docker", to: "ecr" },
  { from: "ecr", to: "taskdef" },
  { from: "taskdef", to: "cluster" },
  { from: "cluster", to: "service" },
];

// STEPS は NODES の順序をソースオブトゥルースとして自動生成
const STEPS = NODES.map((n) => n.id);

// ===== Utils =====
function drawRoundedRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function clamp(n, min, max) { return Math.min(max, Math.max(min, n)); }

function devicePixelRatioSafe(canvas, w, h) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(w * dpr);
  canvas.height = Math.floor(h * dpr);
  canvas.style.width = `${w}px`;
  canvas.style.height = `${h}px`;
  const ctx = canvas.getContext("2d");
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  return ctx;
}

// ---- rAF tween（GSAP 代替の最小実装） ----
const Easings = {
  linear: (t) => t,
  easeInOutCubic: (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2),
  easeOutQuad: (t) => 1 - (1 - t) * (1 - t),
};

function tween(obj, to, { duration = 800, ease = CAMERA_EASE, onUpdate, onComplete } = {}) {
  const start = {}; const delta = {};
  Object.keys(to).forEach((k) => { start[k] = obj[k]; delta[k] = to[k] - obj[k]; });
  const t0 = performance.now();
  const easing = Easings[ease] || Easings.easeInOutCubic;
  let raf = 0;
  const step = (now) => {
    const t = clamp((now - t0) / duration, 0, 1);
    const v = easing(t);
    Object.keys(to).forEach((k) => { obj[k] = start[k] + delta[k] * v; });
    onUpdate && onUpdate();
    if (t < 1) { raf = requestAnimationFrame(step); } else { onComplete && onComplete(); }
  };
  raf = requestAnimationFrame(step);
  return () => cancelAnimationFrame(raf);
}

// ===== Component =====
const ECSFlowSpotlight = forwardRef(function ECSFlowSpotlight(
  { initialId = STEPS[0], minScale = 0.5, maxScale = 3 },
  ref
) {
  const wrapperRef = useRef(null);
  const canvasRef = useRef(null);
  const [stepIndex, setStepIndex] = useState(-1); // -1 = overview
  const [zoom, setZoom] = useState(1);

  // Camera
  const camera = useRef({ x: 0, y: 0, scale: 1 });
  const cancelTweenRef = useRef(null);

  // 手動操作中はスクロール同期を抑止
  const suppressSyncRef = useRef(0);
  const isSyncSuppressed = () => Date.now() < suppressSyncRef.current;
  const suppressSync = (ms = SUPPRESS_MS_SHORT) => { suppressSyncRef.current = Date.now() + ms; };

  // スクロール位置へ自動で合わせる（本UIでは Next では使わない）
  const scrollStepIntoView = (i) => {
    const el = document.querySelector(`[data-step='${STEPS[i]}']`);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  };

  // 初期は自動同期OFF。スクロール/Next 等で有効化
  const autoSyncEnabledRef = useRef(false);
  const enableAutoSync = () => { autoSyncEnabledRef.current = true; };

  // World bounds（NODES と一定マージンから算出）
  const world = useMemo(() => {
    const minX = Math.min(...NODES.map((n) => n.x - WORLD_MARGIN));
    const minY = Math.min(...NODES.map((n) => n.y - WORLD_MARGIN));
    const maxX = Math.max(...NODES.map((n) => n.x + n.w + WORLD_MARGIN));
    const maxY = Math.max(...NODES.map((n) => n.y + n.h + WORLD_MARGIN));
    return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
  }, []);

  const getNode = (id) => NODES.find((n) => n.id === id);
  const syncZoomState = () => setZoom(camera.current.scale);

  // 即時フィット（値を直接セット）
  const fitAll = () => {
    const wrap = wrapperRef.current; if (!wrap) return;
    const sx = (wrap.clientWidth - CAMERA_PADDING * 2) / world.w;
    const sy = (wrap.clientHeight - CAMERA_PADDING * 2) / world.h;
    camera.current.scale = clamp(Math.min(sx, sy), minScale, maxScale);
    camera.current.x = world.minX - CAMERA_PADDING;
    camera.current.y = world.minY - CAMERA_PADDING;
    syncZoomState();
  };

  // 俯瞰（全体表示）への目標値を算出（アニメ用）
  const computeFitAllTarget = () => {
    const wrap = wrapperRef.current; if (!wrap) return null;
    const sx = (wrap.clientWidth - CAMERA_PADDING * 2) / world.w;
    const sy = (wrap.clientHeight - CAMERA_PADDING * 2) / world.h;
    const scale = clamp(Math.min(sx, sy), minScale, maxScale);
    const x = world.minX - CAMERA_PADDING;
    const y = world.minY - CAMERA_PADDING;
    return { x, y, scale };
  };

  // 俯瞰へアニメーション移動
  const focusOverview = ({ duration = CAMERA_DURATION_OVERVIEW, ease = CAMERA_EASE } = {}) => {
    const target = computeFitAllTarget();
    if (!target) return;
    animateCamera(target, { duration, ease });
  };

  // カメラのアニメーション共通
  const animateCamera = (target, { duration = CAMERA_DURATION_STEP, ease = CAMERA_EASE, immediate = false } = {}) => {
    if (immediate) {
      camera.current.x = target.x; camera.current.y = target.y; camera.current.scale = target.scale;
      draw(); syncZoomState();
      return;
    }
    if (cancelTweenRef.current) cancelTweenRef.current();
    cancelTweenRef.current = tween(camera.current, target, {
      duration,
      ease,
      onUpdate: () => { draw(); syncZoomState(); },
      onComplete: () => { cancelTweenRef.current = null; },
    });
  };

  // 指定ノードへフォーカス（画面内に収まるようスケール算出 + 画面中央へパン）
  const focusNode = (node, options = {}) => {
    const wrap = wrapperRef.current; if (!wrap || !node) return;
    if (wrap.clientWidth <= 0 || wrap.clientHeight <= 0) return; // 計測不能なら何もしない

    // ノード全体が画面内に収まるようにフィット（上下左右に NODE_FIT_PADDING を確保）
    const scaleByW = (wrap.clientWidth - NODE_FIT_PADDING * 2) / node.w;
    const scaleByH = (wrap.clientHeight - NODE_FIT_PADDING * 2) / node.h;
    let targetScale = options.scale ?? Math.min(scaleByW, scaleByH);
    targetScale = clamp(targetScale, minScale, maxScale);

    // ノード中心が画面中央に来るようパン（世界座標で境界クランプ）
    let tx = node.x - wrap.clientWidth / (2 * targetScale) + node.w / 2;
    let ty = node.y - wrap.clientHeight / (2 * targetScale) + node.h / 2;
    const minX = world.minX - 4; // 多少の余白を残して過剰クランプを回避
    const minY = world.minY - 4;
    const maxX = world.maxX - wrap.clientWidth / targetScale + 4;
    const maxY = world.maxY - wrap.clientHeight / targetScale + 4;
    tx = clamp(tx, minX, maxX);
    ty = clamp(ty, minY, maxY);

    const target = { x: tx, y: ty, scale: targetScale };
    if ([tx, ty, targetScale].some((v) => !isFinite(v))) { fitAll(); draw(); return; }
    animateCamera(target, options);
  };

  // Imperative API（外部制御用）
  useImperativeHandle(ref, () => ({
    focus: (id, options) => { const n = getNode(id); if (n) { setStepIndex(STEPS.indexOf(id)); focusNode(n, options); }},
    fitAll,
    zoomTo: (wx, wy, scale, options = {}) => {
      const wrap = wrapperRef.current; if (!wrap) return;
      const s = clamp(scale, minScale, maxScale);
      animateCamera({ x: wx - wrap.clientWidth / (2 * s), y: wy - wrap.clientHeight / (2 * s), scale: s }, options);
    },
    panTo: (wx, wy, options = {}) => animateCamera({ x: wx, y: wy, scale: camera.current.scale }, options),
  }));

  // ===== 描画 =====
  const draw = () => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = devicePixelRatioSafe(canvas, canvas.clientWidth, canvas.clientHeight);

    ctx.clearRect(0, 0, canvas.clientWidth, canvas.clientHeight);

    const toS = (wx, wy) => [
      (wx - camera.current.x) * camera.current.scale,
      (wy - camera.current.y) * camera.current.scale,
    ];

    drawGrid(ctx, toS);

    // エッジ（矢印）
    ctx.lineWidth = 2;
    EDGES.forEach((e) => {
      const a = getNode(e.from);
      const b = getNode(e.to);
      const [ax, ay] = toS(a.x + a.w, a.y + a.h / 2);
      const [bx, by] = toS(b.x, b.y + b.h / 2);
      ctx.strokeStyle = "#94a3b8";
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(ax, ay);
      const mx = (ax + bx) / 2;
      ctx.bezierCurveTo(mx, ay, mx, by, bx, by);
      ctx.stroke();
      ctx.setLineDash([]);
      const angle = Math.atan2(by - ay, bx - ax);
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(bx - ARROW_HEAD_SIZE * Math.cos(angle - Math.PI / 6), by - ARROW_HEAD_SIZE * Math.sin(angle - Math.PI / 6));
      ctx.lineTo(bx - ARROW_HEAD_SIZE * Math.cos(angle + Math.PI / 6), by - ARROW_HEAD_SIZE * Math.sin(angle + Math.PI / 6));
      ctx.closePath();
      ctx.fillStyle = "#94a3b8";
      ctx.fill();
    });

    // ノード
    NODES.forEach((n, idx) => {
      const [sx, sy] = toS(n.x, n.y);
      const sw = n.w * camera.current.scale;
      const sh = n.h * camera.current.scale;

      drawRoundedRect(ctx, sx, sy, sw, sh, CORNER_RADIUS);
      ctx.fillStyle = n.color;
      ctx.fill();

      ctx.fillStyle = "#ffffff";
      ctx.font = `${Math.max(14, 16 * camera.current.scale)}px ui-sans-serif, system-ui`;
      ctx.textBaseline = "middle";
      ctx.textAlign = "center";
      ctx.fillText(n.label, sx + sw / 2, sy + sh / 2);

      const badgeR = BADGE_RADIUS_BASE * Math.max(1, camera.current.scale * 0.8);
      ctx.beginPath();
      ctx.arc(sx + sw - badgeR - BADGE_OFFSET, sy + badgeR + BADGE_OFFSET, badgeR, 0, Math.PI * 2);
      ctx.fillStyle = idx === stepIndex ? "#111827" : "#1f2937";
      ctx.fill();
      ctx.fillStyle = "#fff";
      ctx.font = `${12 * Math.max(1, camera.current.scale)}px ui-sans-serif, system-ui`;
      ctx.fillText(`${idx + 1}`, sx + sw - badgeR - BADGE_OFFSET, sy + badgeR + BADGE_OFFSET + 1);
    });

    // スポットライト（stepIndex >= 0 のときのみ）
    if (stepIndex >= 0) {
      const focus = getNode(STEPS[stepIndex]);
      if (focus) {
        const [fx, fy] = toS(focus.x + focus.w / 2, focus.y + focus.h / 2);
        const sw = focus.w * camera.current.scale;
        const sh = focus.h * camera.current.scale;
        const spotR = Math.max(SPOTLIGHT_MIN_RADIUS, Math.hypot(sw, sh) * SPOTLIGHT_RADIUS_SCALE + SPOTLIGHT_EXTRA);
        ctx.save();
        ctx.fillStyle = "rgba(2,6,23,0.55)";
        ctx.fillRect(0, 0, canvas.clientWidth, canvas.clientHeight);
        const g = ctx.createRadialGradient(
          fx, fy,
          Math.max(10, spotR * SPOTLIGHT_INNER_RATIO),
          fx, fy, spotR
        );
        g.addColorStop(0, "rgba(0,0,0,0)");
        g.addColorStop(1, "rgba(0,0,0,1)");
        ctx.globalCompositeOperation = "destination-out";
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(fx, fy, spotR, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
    }
  };

  // 背景グリッド
  function drawGrid(ctx, toS) {
    const step = GRID_STEP;
    const { minX, maxX, minY, maxY } = world;
    ctx.save();
    ctx.strokeStyle = "#0b1220";
    for (let x = Math.floor(minX / step) * step; x <= maxX; x += step) {
      const [sx1, sy1] = toS(x, minY);
      const [sx2, sy2] = toS(x, maxY);
      ctx.beginPath();
      ctx.moveTo(sx1, sy1);
      ctx.lineTo(sx2, sy2);
      ctx.stroke();
    }
    for (let y = Math.floor(minY / step) * step; y <= maxY; y += step) {
      const [sx1, sy1] = toS(minX, y);
      const [sx2, sy2] = toS(maxX, y);
      ctx.beginPath();
      ctx.moveTo(sx1, sy1);
      ctx.lineTo(sx2, sy2);
      ctx.stroke();
    }
    ctx.restore();
  }

  // Resize & initial fit
  useEffect(() => {
    const onResize = () => { fitAll(); draw(); };
    window.addEventListener("resize", onResize);
    setTimeout(onResize, 0);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Scroll sync（IO + onscroll）。手動操作中は抑止
  useEffect(() => {
    const sections = Array.from(document.querySelectorAll("[data-step]"));
    if (!sections.length) return;

    const pickClosest = () => {
      if (!autoSyncEnabledRef.current || isSyncSuppressed()) return;
      const vh = window.innerHeight;
      let bestEl = null; let bestDist = Infinity;
      sections.forEach((sec) => {
        const r = sec.getBoundingClientRect();
        const center = r.top + r.height / 2;
        const dist = Math.abs(center - vh / 2);
        if (r.bottom > 0 && r.top < vh && dist < bestDist) { bestDist = dist; bestEl = sec; }
      });
      if (bestEl) {
        const id = bestEl.getAttribute("data-step");
        const idx = STEPS.indexOf(id);
        if (idx >= 0 && idx !== stepIndex) {
          setStepIndex(idx);
          const node = getNode(id);
          focusNode(node, { duration: SCROLL_SYNC_DURATION, ease: CAMERA_EASE });
        }
      }
    };

    let ticking = false;
    const onScroll = () => {
      enableAutoSync();
      if (!ticking) { requestAnimationFrame(() => { pickClosest(); ticking = false; }); ticking = true; }
    };
    window.addEventListener("scroll", onScroll, { passive: true });

    let io = null;
    if ("IntersectionObserver" in window) {
      io = new IntersectionObserver((entries) => {
        if (!autoSyncEnabledRef.current || isSyncSuppressed()) return;
        const visible = entries.filter((e) => e.isIntersecting).map((e) => e.target);
        if (visible.length) {
          visible.sort((a, b) => a.getBoundingClientRect().top - b.getBoundingClientRect().top);
          const el = visible[0];
          const id = el.getAttribute("data-step");
          const idx = STEPS.indexOf(id);
          if (idx >= 0 && idx !== stepIndex) {
            setStepIndex(idx);
            const node = getNode(id);
            focusNode(node, { duration: SCROLL_SYNC_DURATION, ease: CAMERA_EASE });
          }
        }
      }, { root: null, threshold: 0.6, rootMargin: "-20% 0px -20% 0px" });
      sections.forEach((s) => io.observe(s));
    }

    return () => {
      window.removeEventListener("scroll", onScroll);
      if (io) io.disconnect();
    };
  }, [stepIndex]);

  // マウス/キー操作
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;

    let isDragging = false; let lastX = 0; let lastY = 0;

    const onWheel = (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
      const worldX = camera.current.x + mx / camera.current.scale;
      const worldY = camera.current.y + my / camera.current.scale;
      const factor = e.deltaY < 0 ? WHEEL_ZOOM_FACTOR : 1 / WHEEL_ZOOM_FACTOR; // ← 定数化
      const newScale = clamp(camera.current.scale * factor, minScale, maxScale);
      camera.current.scale = newScale;
      camera.current.x = worldX - mx / newScale;
      camera.current.y = worldY - my / newScale;
      draw(); syncZoomState();
    };

    const onDown = (e) => { isDragging = true; lastX = e.clientX; lastY = e.clientY; };
    const onMove = (e) => {
      if (!isDragging) return;
      const dx = (e.clientX - lastX) / camera.current.scale;
      const dy = (e.clientY - lastY) / camera.current.scale;
      camera.current.x -= dx; camera.current.y -= dy;
      lastX = e.clientX; lastY = e.clientY;
      draw();
    };
    const onUp = () => { isDragging = false; };

    const onClick = (e) => {
      const rect = canvas.getBoundingClientRect();
      const mx = e.clientX - rect.left; const my = e.clientY - rect.top;
      const wx = camera.current.x + mx / camera.current.scale;
      const wy = camera.current.y + my / camera.current.scale;
      const picked = NODES.find((n) => wx >= n.x && wx <= n.x + n.w && wy >= n.y && wy <= n.y + n.h);
      if (picked) { const i = STEPS.indexOf(picked.id); if (i >= 0) setStepIndex(i); focusNode(picked, { duration: CAMERA_DURATION_STEP }); }
    };

    const onKey = (e) => {
      const key = (e.key || "").toLowerCase();
      if (key === "+" || key === "=") {
        const rect = canvas.getBoundingClientRect(); const mx = rect.width / 2; const my = rect.height / 2;
        const worldX = camera.current.x + mx / camera.current.scale; const worldY = camera.current.y + my / camera.current.scale;
        const newScale = clamp(camera.current.scale * WHEEL_ZOOM_FACTOR, minScale, maxScale);
        camera.current.scale = newScale; camera.current.x = worldX - mx / newScale; camera.current.y = worldY - my / newScale;
        draw(); syncZoomState();
      } else if (key === "-" || key === "_") {
        const rect = canvas.getBoundingClientRect(); const mx = rect.width / 2; const my = rect.height / 2;
        const worldX = camera.current.x + mx / camera.current.scale; const worldY = camera.current.y + my / camera.current.scale;
        const newScale = clamp(camera.current.scale / WHEEL_ZOOM_FACTOR, minScale, maxScale);
        camera.current.scale = newScale; camera.current.x = worldX - mx / newScale; camera.current.y = worldY - my / newScale;
        draw(); syncZoomState();
      } else if (key === "arrowright") {
        setStepIndex((i) => { const ni = clamp(i + 1, 0, STEPS.length - 1); focusNode(getNode(STEPS[ni]), { duration: CAMERA_DURATION_STEP }); return ni; });
      } else if (key === "arrowleft") {
        setStepIndex((i) => { const ni = clamp(i - 1, 0, STEPS.length - 1); focusNode(getNode(STEPS[ni]), { duration: CAMERA_DURATION_STEP }); return ni; });
      } else if (key === "f") { focusOverview({ duration: CAMERA_DURATION_RESET }); }
    };

    canvas.addEventListener("wheel", onWheel, { passive: false });
    canvas.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    canvas.addEventListener("click", onClick);
    window.addEventListener("keydown", onKey);

    return () => {
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
      canvas.removeEventListener("click", onClick);
      window.removeEventListener("keydown", onKey);
    };
  }, [minScale, maxScale]);

  // 初期表示
  useEffect(() => {
    fitAll();
    draw();

    // 軽い自己診断（UI を壊さずに警告）
    try {
      console.assert(NODES.length === STEPS.length, "NODES and STEPS length should match");
      STEPS.forEach((id) => console.assert(!!getNode(id), `Unknown step id: ${id}`));
    } catch (_) { /* noop */ }
  }, []);

  // --- UI ---
  // リセット（俯瞰へ）もアニメーションで戻す
  const handleReset = () => {
    // 以前は fitAll()+draw() で瞬間移動 → 体験を統一して滑らかに
    focusOverview({ duration: CAMERA_DURATION_RESET });
  };

  // Next：ノードクリックと同じ。末尾到達時は俯瞰へ滑らかに戻る
  const nextStartedRef = useRef(false);
  const handleNext = () => {
    // 末尾 → 俯瞰
    if (stepIndex >= STEPS.length - 1) {
      suppressSync(SUPPRESS_MS_LONG);
      nextStartedRef.current = false;
      setStepIndex(-1); // オーバーレイ等は隠す
      focusOverview({ duration: CAMERA_DURATION_OVERVIEW, ease: CAMERA_EASE });
      return;
    }

    // 次インデックス（俯瞰→0）
    const nextIdx = stepIndex < 0 ? 0 : stepIndex + 1;
    const id = STEPS[nextIdx];
    if (!id) return;

    // クリック相当：スクロールはしない/同期も有効化しない
    suppressSync(SUPPRESS_MS_SHORT);
    setStepIndex(nextIdx);
    const node = getNode(id);
    if (node) focusNode(node, { duration: CAMERA_DURATION_STEP, ease: CAMERA_EASE });
  };

  const activeNode = stepIndex >= 0 ? getNode(STEPS[stepIndex]) : undefined;
  const overlayVisible = stepIndex >= 0 && zoom >= 1.15;

  return (
    <div className="w-full min-h-[200vh] bg-slate-950 text-slate-100">
      {/* Sticky canvas area */}
      <div ref={wrapperRef} className="relative h-[90vh] top-0">
        <div data-canvas-wrap className="sticky top-0 h-[90vh]">
          <canvas ref={canvasRef} className="w-full h-full block cursor-grab" />

          {/* HUD (minimal) */}
          <div className="absolute top-3 left-3 flex items-center gap-2 p-2 rounded-2xl bg-slate-900/70 backdrop-blur shadow">
            <button onClick={handleReset} className="px-3 py-1 text-sm rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700">全体表示</button>
            <button onClick={handleNext} className="px-3 py-1 text-sm rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700">Next ▶</button>
          </div>

          {/* 右下の説明カード（ズーム時のみ表示） */}
          <div className={`pointer-events-none absolute right-6 bottom-6 max-w-[420px] w-[90vw] translate-y-2 opacity-0 transition-all duration-300 ${overlayVisible ? "opacity-100 translate-y-0" : ""}`}>
            <div className="pointer-events-auto rounded-2xl border border-slate-700 bg-slate-900/85 backdrop-blur p-4 shadow-xl">
              <div className="text-[11px] uppercase tracking-wider text-slate-400 mb-1">STEP {stepIndex + 1}</div>
              <div className="text-lg font-semibold mb-2">{activeNode?.label}</div>
              <div className="text-sm text-slate-200 leading-relaxed">{activeNode?.note}</div>
            </div>
          </div>
        </div>
      </div>

      {/* スクロール同期用の不可視マーカー（見た目の UI は出さない） */}
      <div className="relative max-w-3xl mx-auto px-4 pb-20">
        {STEPS.map((id) => (
          <div key={id} data-step={id} className="h-[120vh]" />
        ))}
      </div>
    </div>
  );
});

export default ECSFlowSpotlight;
