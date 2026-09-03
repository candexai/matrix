"use client";
import { useEffect } from "react";
import { INSIGHT_PALETTE_CSS } from "../insightColors";

const STYLE_ID = "insight-palette";

/**
 * Injects the `--insight-tag-N` / `--insight-risk-N` custom properties (light + dark) once per
 * document. Done imperatively (not via React's hoisted `<style href precedence>`), because the
 * hoisted form can suspend a Suspense boundary indefinitely when the sheet already exists.
 */
export function InsightPaletteStyle() {
  useEffect(() => {
    if (typeof document === "undefined" || document.getElementById(STYLE_ID)) return;
    const el = document.createElement("style");
    el.id = STYLE_ID;
    el.textContent = INSIGHT_PALETTE_CSS;
    document.head.appendChild(el);
  }, []);
  return null;
}
