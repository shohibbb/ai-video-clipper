import assert from "node:assert/strict";
import test from "node:test";
import { getCaptionPreviewTheme } from "../src/lib/reap/caption-preset-preview";

test("maps known Reap caption presets to their intended preview identity", () => {
  assert.deepEqual(getCaptionPreviewTheme("system_beasty", "Beasty"), {
    variant: "comic",
    primary: "#ffffff",
    accent: "#fff034",
    surface: "#303030",
    accentWord: 1,
    sentenceCase: false,
    italic: true,
  });

  assert.equal(
    getCaptionPreviewTheme("system_playdate", "Playdate").variant,
    "serif",
  );
  assert.equal(
    getCaptionPreviewTheme("system_glitch_v2", "Glitch V2").variant,
    "glitch",
  );
});

test("creates deterministic previews for custom Reap presets", () => {
  const first = getCaptionPreviewTheme("user_custom_style", "Custom Style");
  const second = getCaptionPreviewTheme("user_custom_style", "Custom Style");
  const different = getCaptionPreviewTheme("user_other_style", "Other Style");

  assert.deepEqual(first, second);
  assert.notDeepEqual(first, different);
});
