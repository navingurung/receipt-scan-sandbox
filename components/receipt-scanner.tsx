"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CloseIcon } from "@/components/icons";
import {
  analyzeFrame,
  evaluateReadiness,
  FRAME_ASPECT,
  mapElementRectToVideo,
  scaleRect,
  toGrayscale,
  type DetectionState,
  type FrameMetrics,
  type Rect,
} from "@/lib/frame-analysis";

const MAX_OUTPUT_EDGE = 1600;
const MIN_RECOMMENDED_HEIGHT = 1080;
const ANALYSIS_WIDTH = 320;
const ANALYSIS_INTERVAL_MS = 200;
const HOLD_STILL_MS = 500;
// 自動撮影されない場合に手動撮影を案内するまでの時間
const MANUAL_HINT_DELAY_MS = 3000;

type ScannerPhase = "starting" | "live" | "error";

type ReceiptScannerProps = {
  onCapture: (image: Blob) => void;
  onClose: () => void;
};

const CORNER_COLOR: Record<DetectionState, string> = {
  searching: "border-white/80",
  detected: "border-amber-400",
  ready: "border-emerald-400",
};

const HINT: Record<DetectionState, string> = {
  searching: "レシート全体を枠に入れてください",
  detected: "ピントを合わせています…",
  ready: "撮影します",
};

function getCameraErrorMessage(error: unknown): string {
  if (error instanceof DOMException) {
    switch (error.name) {
      case "NotAllowedError":
        return "カメラへのアクセスが許可されていません。ブラウザの設定で許可してください。";
      case "NotFoundError":
      case "OverconstrainedError":
        return "カメラが見つかりません。";
      case "NotReadableError":
        return "カメラが他のアプリで使用中です。";
    }
    return `カメラを起動できませんでした（${error.name}）。`;
  }
  return "カメラを起動できませんでした。";
}

function isCameraSupported(): boolean {
  return typeof navigator !== "undefined" && Boolean(navigator.mediaDevices?.getUserMedia);
}

const UNSUPPORTED_MESSAGE = "このブラウザはカメラに対応していません。";

function formatMetric(value: number): string {
  return Number.isFinite(value) ? value.toFixed(1) : "–";
}

// マウント中のみカメラを使用（親が表示/非表示を制御）
export function ReceiptScanner({ onCapture, onClose }: ReceiptScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frameRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const analysisCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const previousInsideRef = useRef<Float32Array | null>(null);
  const readySinceRef = useRef<number | null>(null);
  const capturingRef = useRef(false);
  // 起動要求の世代番号。古い要求の結果は破棄する
  const requestIdRef = useRef(0);

  const [phase, setPhase] = useState<ScannerPhase>(() => (isCameraSupported() ? "starting" : "error"));
  const [error, setError] = useState<string | null>(() => (isCameraSupported() ? null : UNSUPPORTED_MESSAGE));
  const [devices, setDevices] = useState<MediaDeviceInfo[]>([]);
  const [deviceId, setDeviceId] = useState("");
  const [resolution, setResolution] = useState<{ width: number; height: number } | null>(null);
  const [detection, setDetection] = useState<DetectionState>("searching");
  const [progress, setProgress] = useState(0);
  const [metrics, setMetrics] = useState<FrameMetrics | null>(null);
  const [showManualHint, setShowManualHint] = useState(false);

  // 画面上のガイド枠を動画の実ピクセル座標で取得
  const getVideoFrameRect = useCallback((): Rect | null => {
    const video = videoRef.current;
    const frame = frameRef.current;
    if (!video?.videoWidth || !frame) return null;
    return mapElementRectToVideo(
      frame.getBoundingClientRect(),
      video.getBoundingClientRect(),
      video.videoWidth,
      video.videoHeight,
      "cover",
    );
  }, []);

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);

  const startStream = useCallback(
    async (selectedDeviceId?: string) => {
      const requestId = ++requestIdRef.current;
      const isStale = () => requestId !== requestIdRef.current;
      stopStream();
      previousInsideRef.current = null;
      readySinceRef.current = null;
      capturingRef.current = false;

      if (!isCameraSupported()) return;

      try {
        // 対応カメラの最大解像度を要求（iPhone 連係カメラ等は 4K 可）
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            // 未選択時は背面カメラを優先（iPad が前面カメラで起動するのを防ぐ）
            ...(selectedDeviceId
              ? { deviceId: { exact: selectedDeviceId } }
              : { facingMode: { ideal: "environment" } }),
            width: { ideal: 3840 },
            height: { ideal: 2160 },
          },
          audio: false,
        });
        if (isStale()) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play();
          if (isStale()) return;
          setResolution({ width: video.videoWidth, height: video.videoHeight });
        }

        // 権限取得後はカメラ名が取得できる
        const allDevices = await navigator.mediaDevices.enumerateDevices();
        setDevices(allDevices.filter((device) => device.kind === "videoinput"));
        setDeviceId(stream.getVideoTracks()[0]?.getSettings().deviceId ?? "");
        setPhase("live");
      } catch (err) {
        if (isStale()) return;
        stopStream();
        setError(getCameraErrorMessage(err));
        setPhase("error");
      }
    },
    [stopStream],
  );

  useEffect(() => {
    void startStream();
    return () => {
      // 進行中の起動処理を無効化（Strict Mode の二重実行対策）
      requestIdRef.current += 1;
      stopStream();
    };
  }, [startStream, stopStream]);

  const handleDeviceChange = (nextDeviceId: string) => {
    setPhase("starting");
    setDetection("searching");
    setProgress(0);
    setShowManualHint(false);
    void startStream(nextDeviceId);
  };

  const capture = useCallback(async () => {
    const video = videoRef.current;
    const frame = getVideoFrameRect();
    if (!video || !frame || capturingRef.current) return;
    capturingRef.current = true;

    // ガイド枠の範囲だけを切り出し、長辺が大きい場合のみ縮小
    const scale = Math.min(1, MAX_OUTPUT_EDGE / Math.max(frame.width, frame.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(frame.width * scale);
    canvas.height = Math.round(frame.height * scale);

    const context = canvas.getContext("2d");
    if (!context) {
      capturingRef.current = false;
      return;
    }
    context.drawImage(video, frame.x, frame.y, frame.width, frame.height, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/jpeg", 0.92),
    );
    if (!blob) {
      capturingRef.current = false;
      return;
    }
    stopStream();
    onCapture(blob);
  }, [getVideoFrameRect, onCapture, stopStream]);

  // 検出ループ：レシートの有無・静止・ピントを判定し、条件が続けば自動撮影
  useEffect(() => {
    if (phase !== "live") return;

    const intervalId = window.setInterval(() => {
      const video = videoRef.current;
      const frame = getVideoFrameRect();
      if (!video || !frame || capturingRef.current) return;

      const width = ANALYSIS_WIDTH;
      const height = Math.round((ANALYSIS_WIDTH * video.videoHeight) / video.videoWidth);
      const canvas = (analysisCanvasRef.current ??= document.createElement("canvas"));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }

      const context = canvas.getContext("2d", { willReadFrequently: true });
      if (!context) return;
      context.drawImage(video, 0, 0, width, height);

      const gray = toGrayscale(context.getImageData(0, 0, width, height).data);
      const analysisFrame = scaleRect(frame, width / video.videoWidth, width, height);
      const { metrics: next, inside } = analyzeFrame(gray, width, analysisFrame, previousInsideRef.current);
      previousInsideRef.current = inside;

      const state = evaluateReadiness(next);
      setMetrics(next);
      setDetection(state);

      if (state !== "ready") {
        readySinceRef.current = null;
        setProgress(0);
        return;
      }

      const now = performance.now();
      readySinceRef.current ??= now;
      const elapsed = now - readySinceRef.current;
      setProgress(Math.min(1, elapsed / HOLD_STILL_MS));
      if (elapsed >= HOLD_STILL_MS) void capture();
    }, ANALYSIS_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [phase, capture, getVideoFrameRect]);

  // 一定時間で自動撮影されなければ手動撮影を案内
  useEffect(() => {
    if (phase !== "live") return;
    const timeoutId = window.setTimeout(() => setShowManualHint(true), MANUAL_HINT_DELAY_MS);
    return () => window.clearTimeout(timeoutId);
  }, [phase]);

  // 表示中：Esc で閉じる・背景スクロール禁止
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [onClose]);

  const isLowResolution = resolution !== null && resolution.height < MIN_RECOMMENDED_HEIGHT;
  const hint =
    phase === "starting"
      ? "カメラを起動しています…"
      : showManualHint && detection !== "ready"
        ? "下のボタンで撮影できます"
        : HINT[detection];

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="レシートスキャン"
      className="fixed inset-0 z-50 bg-black text-white"
    >
      <div className="absolute inset-0">
        {/* カメラ映像 + ガイド枠（cqh/cqw でステージ基準にサイズ計算） */}
        <div className="absolute inset-0 overflow-hidden [container-type:size]">
          <video
            ref={videoRef}
            muted
            playsInline
            className="absolute inset-0 h-full w-full object-cover"
          />

          {phase !== "error" && (
            <div
              ref={frameRef}
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-md shadow-[0_0_0_9999px_rgba(0,0,0,0.55)]"
              style={{
                height: `min(70cqh, calc(84cqw / ${FRAME_ASPECT}))`,
                aspectRatio: FRAME_ASPECT,
              }}
            >
              {[
                "left-0 top-0 rounded-tl-md border-l-4 border-t-4",
                "right-0 top-0 rounded-tr-md border-r-4 border-t-4",
                "bottom-0 left-0 rounded-bl-md border-b-4 border-l-4",
                "bottom-0 right-0 rounded-br-md border-b-4 border-r-4",
              ].map((position) => (
                <span
                  key={position}
                  className={`absolute h-8 w-8 transition-colors ${position} ${CORNER_COLOR[detection]}`}
                />
              ))}

              {phase === "live" && (
                <div className="animate-scan-line absolute inset-x-2 h-0.5 bg-emerald-400 shadow-[0_0_12px_2px_rgba(52,211,153,0.8)]" />
              )}

              <p className="absolute inset-x-0 -top-9 text-center text-sm font-medium drop-shadow" aria-live="polite">
                {hint}
              </p>

              <div className="absolute inset-x-0 -bottom-3 h-1 rounded bg-white/20">
                <div className="h-full rounded bg-emerald-400" style={{ width: `${progress * 100}%` }} />
              </div>
            </div>
          )}

          {phase === "error" && (
            <div className="absolute inset-0 flex items-center justify-center px-6">
              <div className="max-w-sm space-y-4 text-center">
                <p role="alert">{error}</p>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-lg bg-white px-5 py-2 text-sm font-medium text-black hover:bg-white/90"
                >
                  閉じる
                </button>
              </div>
            </div>
          )}
        </div>

        {/* 上部バー（ノッチを避ける） */}
        <header className="absolute inset-x-0 top-0 flex items-center justify-between gap-3 bg-gradient-to-b from-black/70 to-transparent px-4 pb-6 pt-[max(1rem,env(safe-area-inset-top))]">
          <button
            type="button"
            onClick={onClose}
            aria-label="閉じる"
            className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 hover:bg-black/60 focus-visible:outline-2 focus-visible:outline-white"
          >
            <CloseIcon />
          </button>

          <div className="flex min-w-0 items-center gap-2">
            {resolution && (
              <span
                className={`shrink-0 rounded px-2 py-1 text-xs ${
                  isLowResolution ? "bg-amber-500/30 text-amber-200" : "bg-emerald-500/30 text-emerald-200"
                }`}
                title={isLowResolution ? "解像度が低いため読み取り精度が下がる可能性があります" : undefined}
              >
                {resolution.width}×{resolution.height}
              </span>
            )}
            {devices.length > 1 && (
              <select
                value={deviceId}
                onChange={(event) => handleDeviceChange(event.target.value)}
                aria-label="カメラを選択"
                className="min-w-0 max-w-48 truncate rounded bg-black/40 px-2 py-1.5 text-sm"
              >
                {devices.map((device, index) => (
                  <option key={device.deviceId} value={device.deviceId} className="text-black">
                    {device.label || `カメラ ${index + 1}`}
                  </option>
                ))}
              </select>
            )}
          </div>
        </header>

        {/* 下部バー（ホームバーを避ける） */}
        <footer className="absolute inset-x-0 bottom-0 flex flex-col items-center gap-3 bg-gradient-to-t from-black/70 to-transparent px-4 pb-[max(1.5rem,env(safe-area-inset-bottom))] pt-8">
          <button
            type="button"
            onClick={() => void capture()}
            disabled={phase !== "live"}
            aria-label="今すぐ撮影"
            className={`h-18 w-18 rounded-full border-4 border-white bg-white/20 transition hover:bg-white/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:opacity-40 ${
              showManualHint ? "animate-pulse ring-4 ring-emerald-400 ring-offset-4 ring-offset-black" : ""
            }`}
          />
          {metrics && (
            <p className="font-mono text-[10px] text-white/60">
              in {formatMetric(metrics.insideBrightness)} / out {formatMetric(metrics.outsideBrightness)} / sharp{" "}
              {formatMetric(metrics.sharpness)} / motion {formatMetric(metrics.motion)}
            </p>
          )}
        </footer>
      </div>
    </div>
  );
}