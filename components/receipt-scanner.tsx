"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CloseIcon } from "@/components/icons";
import {
  analyzeFrame,
  evaluateReadiness,
  FRAME_ASPECT,
  FRAME_HEIGHT_RATIO,
  getFrameRect,
  toGrayscale,
  type DetectionState,
  type FrameMetrics,
} from "@/lib/frame-analysis";

const MAX_OUTPUT_EDGE = 1600;
const MIN_RECOMMENDED_HEIGHT = 1080;
const ANALYSIS_WIDTH = 320;
const ANALYSIS_INTERVAL_MS = 200;
const HOLD_STILL_MS = 500;
// 自動撮影されない場合に手動撮影を案内するまでの時間
const MANUAL_HINT_DELAY_MS = 3000;
const CONTROLS_HEIGHT_PX = 168; // 上部バー 56px + 下部バー 112px

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
            ...(selectedDeviceId ? { deviceId: { exact: selectedDeviceId } } : {}),
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
    if (!video?.videoWidth || capturingRef.current) return;
    capturingRef.current = true;

    // ガイド枠の範囲だけを切り出し、長辺が大きい場合のみ縮小
    const frame = getFrameRect(video.videoWidth, video.videoHeight);
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
  }, [onCapture, stopStream]);

  // 検出ループ：レシートの有無・静止・ピントを判定し、条件が続けば自動撮影
  useEffect(() => {
    if (phase !== "live") return;

    const intervalId = window.setInterval(() => {
      const video = videoRef.current;
      if (!video?.videoWidth || capturingRef.current) return;

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
      const { metrics: next, inside } = analyzeFrame(
        gray,
        width,
        getFrameRect(width, height),
        previousInsideRef.current,
      );
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
  }, [phase, capture]);

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

  const ratio = resolution ? resolution.width / resolution.height : 16 / 9;
  const isLowResolution = resolution !== null && resolution.height < MIN_RECOMMENDED_HEIGHT;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="レシートスキャン"
      className="fixed inset-0 z-50 flex flex-col bg-black text-white"
    >
      <header className="flex h-14 shrink-0 items-center justify-between gap-3 px-4">
        <button
          type="button"
          onClick={onClose}
          aria-label="閉じる"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 focus-visible:outline-2 focus-visible:outline-white"
        >
          <CloseIcon />
        </button>

        <div className="flex items-center gap-3">
          {resolution && (
            <span
              className={`rounded px-2 py-1 text-xs ${
                isLowResolution ? "bg-amber-500/20 text-amber-300" : "bg-emerald-500/20 text-emerald-300"
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
              className="max-w-56 rounded bg-white/10 px-2 py-1 text-sm"
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

      <div className="flex min-h-0 flex-1 items-center justify-center">
        {phase === "error" ? (
          <div className="max-w-sm space-y-4 px-6 text-center">
            <p role="alert">{error}</p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-white px-5 py-2 text-sm font-medium text-black hover:bg-white/90"
            >
              閉じる
            </button>
          </div>
        ) : (
          <div
            className="relative overflow-hidden"
            style={{
              aspectRatio: ratio,
              width: `min(100%, calc((100dvh - ${CONTROLS_HEIGHT_PX}px) * ${ratio}))`,
            }}
          >
            <video ref={videoRef} muted playsInline className="block h-full w-full" />

            <div
              aria-hidden="true"
              className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 shadow-[0_0_0_9999px_rgba(0,0,0,0.6)]"
              style={{ height: `${FRAME_HEIGHT_RATIO * 100}%`, aspectRatio: FRAME_ASPECT }}
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

              <div className="absolute inset-x-0 -bottom-3 h-1 rounded bg-white/20">
                <div className="h-full rounded bg-emerald-400" style={{ width: `${progress * 100}%` }} />
              </div>
            </div>

            <p className="absolute inset-x-0 top-3 text-center text-sm font-medium" aria-live="polite">
              {phase === "starting"
                ? "カメラを起動しています…"
                : showManualHint && detection !== "ready"
                  ? "下のボタンで撮影できます"
                  : HINT[detection]}
            </p>

            {metrics && (
              <p className="absolute bottom-2 left-2 rounded bg-black/60 px-2 py-1 font-mono text-[10px] text-white/70">
                in {formatMetric(metrics.insideBrightness)} / out {formatMetric(metrics.outsideBrightness)} /
                sharp {formatMetric(metrics.sharpness)} / motion {formatMetric(metrics.motion)}
              </p>
            )}
          </div>
        )}
      </div>

      <footer className="flex h-28 shrink-0 items-center justify-center">
        <button
          type="button"
          onClick={() => void capture()}
          disabled={phase !== "live"}
          aria-label="今すぐ撮影"
          className={`h-16 w-16 rounded-full border-4 border-white bg-white/20 transition hover:bg-white/40 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-white disabled:opacity-40 ${
            showManualHint ? "animate-pulse ring-4 ring-emerald-400 ring-offset-4 ring-offset-black" : ""
          }`}
        />
      </footer>
    </div>
  );
}