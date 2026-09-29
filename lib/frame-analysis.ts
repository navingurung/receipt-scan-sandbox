// ガイド枠（縦長レシート）の縦横比 — 表示・解析・クロップで共有
export const FRAME_ASPECT = 9 / 20;

export type Rect = { x: number; y: number; width: number; height: number };

export type FrameMetrics = {
  insideBrightness: number;
  outsideBrightness: number;
  sharpness: number;
  motion: number;
};

export type DetectionState = "searching" | "detected" | "ready";

export type DetectionThresholds = {
  minInsideBrightness: number;
  minContrast: number;
  minSharpness: number;
  maxMotion: number;
};

// 初期値 — 実機のデバッグ表示を見て調整する
export const DETECTION_THRESHOLDS: DetectionThresholds = {
  minInsideBrightness: 110,
  minContrast: 25,
  minSharpness: 20,
  maxMotion: 30,
};

export type ObjectFit = "cover" | "contain";

// 画面上のガイド枠（DOM 座標）を動画の実ピクセル座標に変換。object-fit の拡大・余白を考慮する
export function mapElementRectToVideo(
  frame: DOMRect,
  video: DOMRect,
  videoWidth: number,
  videoHeight: number,
  fit: ObjectFit,
): Rect {
  const scale =
    fit === "cover"
      ? Math.max(video.width / videoWidth, video.height / videoHeight)
      : Math.min(video.width / videoWidth, video.height / videoHeight);
  const offsetX = video.left + (video.width - videoWidth * scale) / 2;
  const offsetY = video.top + (video.height - videoHeight * scale) / 2;

  const x = Math.max(0, (frame.left - offsetX) / scale);
  const y = Math.max(0, (frame.top - offsetY) / scale);
  const right = Math.min(videoWidth, (frame.right - offsetX) / scale);
  const bottom = Math.min(videoHeight, (frame.bottom - offsetY) / scale);

  return {
    x: Math.round(x),
    y: Math.round(y),
    width: Math.max(1, Math.round(right - x)),
    height: Math.max(1, Math.round(bottom - y)),
  };
}

export function scaleRect(rect: Rect, factor: number, maxWidth: number, maxHeight: number): Rect {
  const x = Math.min(maxWidth - 3, Math.max(0, Math.round(rect.x * factor)));
  const y = Math.min(maxHeight - 3, Math.max(0, Math.round(rect.y * factor)));
  return {
    x,
    y,
    width: Math.max(3, Math.min(maxWidth - x, Math.round(rect.width * factor))),
    height: Math.max(3, Math.min(maxHeight - y, Math.round(rect.height * factor))),
  };
}

export function toGrayscale(rgba: Uint8ClampedArray): Float32Array {
  const gray = new Float32Array(rgba.length / 4);
  for (let i = 0; i < gray.length; i++) {
    const o = i * 4;
    gray[i] = 0.299 * rgba[o] + 0.587 * rgba[o + 1] + 0.114 * rgba[o + 2];
  }
  return gray;
}

export function analyzeFrame(
  gray: Float32Array,
  width: number,
  rect: Rect,
  previousInside: Float32Array | null,
): { metrics: FrameMetrics; inside: Float32Array } {
  const inside = new Float32Array(rect.width * rect.height);
  let insideSum = 0;
  for (let y = 0; y < rect.height; y++) {
    const rowOffset = (rect.y + y) * width + rect.x;
    for (let x = 0; x < rect.width; x++) {
      const value = gray[rowOffset + x];
      inside[y * rect.width + x] = value;
      insideSum += value;
    }
  }

  let totalSum = 0;
  for (let i = 0; i < gray.length; i++) totalSum += gray[i];
  const outsideCount = gray.length - inside.length;

  // ラプラシアン絶対値の平均（ピントの指標）
  let laplacianSum = 0;
  for (let y = 1; y < rect.height - 1; y++) {
    for (let x = 1; x < rect.width - 1; x++) {
      const i = y * rect.width + x;
      laplacianSum += Math.abs(
        4 * inside[i] - inside[i - 1] - inside[i + 1] - inside[i - rect.width] - inside[i + rect.width],
      );
    }
  }
  const interiorCount = Math.max(1, (rect.width - 2) * (rect.height - 2));

  // 前フレームとの差分平均（手ブレ・移動の指標）
  let motion = Number.POSITIVE_INFINITY;
  if (previousInside?.length === inside.length) {
    let diffSum = 0;
    for (let i = 0; i < inside.length; i++) diffSum += Math.abs(inside[i] - previousInside[i]);
    motion = diffSum / inside.length;
  }

  return {
    metrics: {
      insideBrightness: insideSum / inside.length,
      outsideBrightness: outsideCount > 0 ? (totalSum - insideSum) / outsideCount : 0,
      sharpness: laplacianSum / interiorCount,
      motion,
    },
    inside,
  };
}

export function evaluateReadiness(
  metrics: FrameMetrics,
  thresholds: DetectionThresholds = DETECTION_THRESHOLDS,
): DetectionState {
  const isPresent =
    metrics.insideBrightness >= thresholds.minInsideBrightness &&
    metrics.insideBrightness - metrics.outsideBrightness >= thresholds.minContrast;
  if (!isPresent) return "searching";

  if (metrics.motion > thresholds.maxMotion || metrics.sharpness < thresholds.minSharpness) {
    return "detected";
  }
  return "ready";
}
