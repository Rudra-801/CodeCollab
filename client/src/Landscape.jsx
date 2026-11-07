import React, { useEffect, useRef } from "react";
// Deterministic terrain keeps the composition stable on resize and during screenshots.
export default function Landscape() {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current,
      ctx = canvas.getContext("2d");
    function draw() {
      const w = canvas.clientWidth,
        h = canvas.clientHeight,
        ratio = Math.min(devicePixelRatio, 2);
      if (!w || !h) return;
      canvas.width = w * ratio;
      canvas.height = h * ratio;
      ctx.scale(ratio, ratio);
      const sky = ctx.createLinearGradient(0, 0, 0, h);
      sky.addColorStop(0, "#030910");
      sky.addColorStop(0.68, "#10212e");
      sky.addColorStop(1, "#090d17");
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, h);
      const x = w * 0.76,
        y = h * 0.63,
        r = Math.min(w * 0.23, h * 0.47);
      const ring = ctx.createLinearGradient(x - r, y - r, x + r, y + r);
      ring.addColorStop(0, "#00c8f8");
      ring.addColorStop(0.55, "#007ba7");
      ring.addColorStop(1, "#ff2d95");
      ctx.strokeStyle = ring;
      ctx.lineWidth = 2;
      ctx.shadowColor = "#007ba7";
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.stroke();
      ctx.shadowBlur = 0;
      for (let layer = 0; layer < 4; layer++) {
        const baseline = h * (0.74 + layer * 0.065);
        let previous;
        ctx.beginPath();
        ctx.moveTo(0, h);
        for (let i = 0; i <= 150; i++) {
          const t = i / 150;
          const v =
            baseline +
            h *
              (0.07 * Math.sin(13 * t + layer) +
                0.035 * Math.cos(34 * t + layer) +
                0.015 * Math.sin(i * 2.7 + layer)) -
            Math.abs(t - 0.5) * h * 0.17;
          ctx.lineTo(w * t, v);
        }
        ctx.lineTo(w, h);
        ctx.closePath();
        ctx.fillStyle = ["#152632", "#10202c", "#0a1721", "#080f16"][layer];
        ctx.fill();
        ctx.strokeStyle = ["#315263", "#203447", "#122a37", "#16252e"][layer];
        ctx.lineWidth = 0.7;
        ctx.stroke();
      }
    }
    const observer = new ResizeObserver(draw);
    observer.observe(canvas);
    draw();
    return () => observer.disconnect();
  }, []);
  return <canvas className="landscape" ref={ref} aria-hidden="true" />;
}
