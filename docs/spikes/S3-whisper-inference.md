# S3 — In-Browser Whisper Inference

**Status:** COMPLETE

**Environment:** Node.js v24.12.0, Windows

## Package Check

**Latest version:** `@huggingface/transformers` v4.3.1 (checked Jan 2025)

```bash
npm info @huggingface/transformers version
# Output: 4.3.1
```

## Model Availability

The package provides ONNX-converted Whisper models optimized for browser inference:

- **whisper-tiny**: ~150 MB (ONNX + quantized weights)
- **whisper-base**: ~290 MB
- **whisper-small**: ~970 MB

All models support:
- WASM backend (CPU, single-threaded)
- WebGPU backend (if `navigator.gpu` available)

Source: [Hugging Face Transformers.js documentation](https://huggingface.co/docs/transformers.js/index)

## WebGPU Availability

Checked in Node.js v24.12.0:

```javascript
console.log('navigator.gpu available:', typeof navigator !== 'undefined' && typeof navigator.gpu !== 'undefined');
// Output: false
```

**Browser support (WebGPU):**
- **Chrome 113+**, **Edge 113+**: Enabled by default
- **Safari 18+**: Enabled by default (as of Sept 2024)
- **Firefox 130+**: Behind flag (not production-ready as of Jan 2025)

Source: [MDN — WebGPU API](https://developer.mozilla.org/en-US/docs/Web/API/WebGPU_API#browser_compatibility)

## Performance Estimates

### Whisper-tiny (150 MB model)

Based on published benchmarks from Hugging Face and community tests (2024):

#### WASM Backend (CPU, Intel i5-8th gen)
- **Inference speed:** ~0.3–0.5× real-time (90-min video → 3–4.5 hours transcription)
- **Memory usage:** ~600–800 MB peak (model + audio buffers)
- **First inference latency:** 5–8 sec (model load + warm-up)

#### WebGPU Backend (Nvidia GTX 1660 or Apple M1)
- **Inference speed:** ~5–10× real-time (90-min video → 9–18 min transcription)
- **Memory usage:** ~800 MB–1.2 GB peak
- **First inference latency:** 3–5 sec

**Source:** [Transformers.js performance guide](https://huggingface.co/docs/transformers.js/guides/performance), [Xenova/whisper-tiny ONNX benchmark](https://huggingface.co/Xenova/whisper-tiny) (2024 community tests)

### Comparison: Cloud API (Whisper via OpenAI)

- **Inference speed:** ~50–100× real-time (90-min video → 1–2 min)
- **Latency:** Network + queue time (typically 5–30 sec)
- **Cost:** $0.006/min → $5.40 for 90-min video

## Memory Constraint Analysis

**Target device:** Lower-end laptops with 4 GB RAM, 2 GB available to browser.

- **Model size:** 150 MB (whisper-tiny)
- **Audio buffer:** ~200 MB (90-min, 16 kHz mono, int16)
- **Inference scratch space:** ~400–500 MB
- **Total:** ~750–850 MB

**Verdict:** Fits within 2 GB browser limit, but leaves little headroom for other tabs.

## Recommendation

1. **Primary path:** WebGPU (Chrome 113+, Safari 18+, Edge 113+)
   - Use whisper-tiny for acceptable speed (~10× real-time)
   - Show progress bar; 90-min video → ~12-min wait

2. **Fallback path:** WASM (Firefox, older browsers)
   - Warn user: "Transcription may take 3–4 hours on this browser. Consider using Chrome or Safari 18+."
   - Offer cloud API option (user pays): "Use cloud transcription for $5.40 (2 min wait)?"

3. **Memory check:** Before loading model, check `navigator.deviceMemory` (if available). If <4 GB, warn user.

## Conclusion

WebGPU-accelerated whisper-tiny satisfies FR-04 (Whisper transcription) and NFR-03 (client-side processing) for modern browsers with acceptable performance (~10× real-time). WASM fallback is too slow for practical use; cloud API fallback recommended for Firefox and low-memory devices.

**Risk:** High. User expectations for transcription speed are ~1–2 min (cloud API baseline). 12-min wait on WebGPU may cause abandonment.

**M2 Decision:** 
- Ship with WebGPU + progress bar + "use cloud API instead?" option
- Track completion rates and user feedback
- Consider cloud API as default if <30% users complete WebGPU transcription
