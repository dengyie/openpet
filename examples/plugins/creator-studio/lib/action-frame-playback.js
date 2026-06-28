const DEFAULT_FRAME_DURATION_MS = 120
const DEFAULT_NON_LOOP_HOLD_MS = 220

const normalizeFrameCount = (value) => {
  const frameCount = Number(value)
  if (!Number.isInteger(frameCount) || frameCount < 1) return 0
  return frameCount
}

const normalizeDuration = (value, fallback = DEFAULT_FRAME_DURATION_MS) => {
  const durationMs = Number(value)
  if (!Number.isFinite(durationMs) || durationMs < 1) return fallback
  return Math.round(durationMs)
}

const createDefaultFrameDurationsMs = ({ frameCount, loop }) => {
  if (frameCount < 1) return []
  return Array.from({ length: frameCount }, (_entry, index) => {
    if (loop) return DEFAULT_FRAME_DURATION_MS
    return index === frameCount - 1
      ? DEFAULT_NON_LOOP_HOLD_MS
      : DEFAULT_FRAME_DURATION_MS
  })
}

const normalizeFrameDurationsMs = ({ frameCount, loop, frameDurationsMs }) => {
  if (Array.isArray(frameDurationsMs) && frameDurationsMs.length === frameCount) {
    return frameDurationsMs.map((durationMs, index) => normalizeDuration(
      durationMs,
      loop || index < frameCount - 1 ? DEFAULT_FRAME_DURATION_MS : DEFAULT_NON_LOOP_HOLD_MS
    ))
  }
  return createDefaultFrameDurationsMs({ frameCount, loop })
}

const createPlaybackDiagnostics = ({ frameCount, loop, frameDurationsMs }) => {
  const safeFrameCount = normalizeFrameCount(frameCount)
  const safeLoop = Boolean(loop)
  const durations = normalizeFrameDurationsMs({
    frameCount: safeFrameCount,
    loop: safeLoop,
    frameDurationsMs
  })
  let cursorMs = 0
  const timeline = durations.map((durationMs, frameIndex) => {
    const startMs = cursorMs
    cursorMs += durationMs
    return {
      fileName: `${String(frameIndex + 1).padStart(4, '0')}.png`,
      frameIndex,
      durationMs,
      startMs,
      endMs: cursorMs
    }
  })
  return {
    loop: safeLoop,
    frameDurationsMs: durations,
    holdLastFrameMs: durations.length ? durations[durations.length - 1] : 0,
    totalDurationMs: cursorMs,
    timeline
  }
}

module.exports = {
  createPlaybackDiagnostics
}
