export function detectCapabilities() {
  return {
    hasWebGPU: 'gpu' in navigator,
    hasWebCodecs: 'VideoDecoder' in window,
    hasWakeLock: 'wakeLock' in navigator,
    hasFileSystemAccess: 'showOpenFilePicker' in window,
    hasCaptureStream: 'captureStream' in HTMLVideoElement.prototype || 'mozCaptureStream' in HTMLVideoElement.prototype,
    isSafari: /^((?!chrome|android).)*safari/i.test(navigator.userAgent),
    isMobile: /Android|iPhone|iPad|iPod/i.test(navigator.userAgent),
  };
}
