"use client";

/**
 * ConfettiBurst
 *
 * Reusable full-screen canvas confetti. Fires once on mount.
 * Call `onDone` when the animation finishes so the parent can unmount it.
 */

import { useCallback, useEffect, useRef } from "react";

const COLORS = [
  "#C5A046", "#E8C866", "#6366f1", "#8b5cf6",
  "#06b6d4", "#22c55e", "#f59e0b", "#ec4899",
];

export default function ConfettiBurst({ onDone }: { onDone: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const doneCalled = useRef(false);
  const stableDone = useCallback(onDone, []); // eslint-disable-line

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const pieces = Array.from({ length: 140 }, () => ({
      x: canvas.width / 2 + (Math.random() - 0.5) * 300,
      y: canvas.height * 0.45,
      vx: (Math.random() - 0.5) * 16,
      vy: Math.random() * -14 - 3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      w: Math.random() * 10 + 4,
      h: Math.random() * 5 + 3,
      rot: Math.random() * 360,
      rotV: (Math.random() - 0.5) * 10,
    }));

    const FRAMES = 130;
    let frame = 0;
    let raf: number;

    function draw() {
      ctx!.clearRect(0, 0, canvas!.width, canvas!.height);
      pieces.forEach((p) => {
        p.x += p.vx; p.y += p.vy; p.vy += 0.38; p.vx *= 0.98; p.rot += p.rotV;
        ctx!.save();
        ctx!.translate(p.x, p.y);
        ctx!.rotate((p.rot * Math.PI) / 180);
        ctx!.globalAlpha = Math.max(0, 1 - (frame / FRAMES) * 1.4);
        ctx!.fillStyle = p.color;
        ctx!.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
        ctx!.restore();
      });
      frame++;
      if (frame < FRAMES) {
        raf = requestAnimationFrame(draw);
      } else if (!doneCalled.current) {
        doneCalled.current = true;
        stableDone();
      }
    }

    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [stableDone]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 z-9999 pointer-events-none"
    />
  );
}
