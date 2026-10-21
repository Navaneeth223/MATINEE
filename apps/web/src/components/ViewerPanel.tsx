import { useState, useRef, useEffect } from 'react';

interface ViewerPanelProps {
  stream: MediaStream | null;
  onCommand: (action: string, value?: number) => void;
  sourceState: { paused: boolean; time: number } | null;
}

export function ViewerPanel({ stream, onCommand, sourceState }: ViewerPanelProps) {
  const [ready, setReady] = useState(false);
  const [volume, setVolume] = useState(() => {
    const saved = localStorage.getItem('matinee-viewer-volume');
    return saved ? Number(saved) : 100;
  });
  const [boost, setBoost] = useState(() => {
    const saved = localStorage.getItem('matinee-viewer-boost');
    return saved ? Number(saved) : 100;
  });
  const [muted, setMuted] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const gainRef = useRef<GainNode | null>(null);
  const compressorRef = useRef<DynamicsCompressorNode | null>(null);

  useEffect(() => {
    localStorage.setItem('matinee-viewer-volume', volume.toString());
  }, [volume]);

  useEffect(() => {
    localStorage.setItem('matinee-viewer-boost', boost.toString());
  }, [boost]);

  useEffect(() => {
    if (!videoRef.current || !stream) return;
    videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    if (!videoRef.current || !stream || !ready) return;

    const video = videoRef.current;
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;

    try {
      const source = audioCtx.createMediaStreamSource(stream);
      const gain = audioCtx.createGain();
      const compressor = audioCtx.createDynamicsCompressor();
      
      gainRef.current = gain;
      compressorRef.current = compressor;
      
      compressor.threshold.value = -20;
      compressor.knee.value = 10;
      compressor.ratio.value = 12;
      compressor.attack.value = 0.003;
      compressor.release.value = 0.25;
      
      source.connect(gain);
      gain.connect(compressor);
      compressor.connect(audioCtx.destination);
      
      gain.gain.value = (volume / 100) * (boost / 100);
    } catch (err) {
      console.error('Audio routing failed:', err);
    }

    return () => {
      audioCtx.close();
    };
  }, [stream, ready]);

  useEffect(() => {
    if (gainRef.current) {
      gainRef.current.gain.value = muted ? 0 : (volume / 100) * (boost / 100);
    }
  }, [volume, boost, muted]);

  const handleStartWatching = async () => {
    if (!videoRef.current) return;
    setReady(true);
    try {
      await videoRef.current.play();
    } catch (err) {
      console.error('Play failed:', err);
    }
  };

  const handleFullscreen = () => {
    videoRef.current?.requestFullscreen?.();
  };

  if (!stream) {
    return (
      <div className="stage-content">
        Waiting for stream...
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="stage-content">
        <button
          onClick={handleStartWatching}
          className="btn btn-primary btn-xl"
        >
          Start watching
        </button>
      </div>
    );
  }

  return (
    <div className="viewer-panel space-y-4">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        style={{ aspectRatio: '16 / 9' }}
        data-testid="viewer-video"
      />

      {sourceState && (
        <div className="text-sm text-muted">
          <p>Position: {sourceState.time.toFixed(1)}s {sourceState.paused ? '(paused)' : '(playing)'}</p>
        </div>
      )}

      <div className="card space-y-4">
        <div className="controls">
          <button onClick={() => onCommand('play')} className="btn btn-primary">
            Play
          </button>
          <button onClick={() => onCommand('pause')} className="btn btn-primary">
            Pause
          </button>
          <button onClick={() => onCommand('skip', -10)} className="btn btn-primary">
            -10s
          </button>
          <button onClick={() => onCommand('skip', 10)} className="btn btn-primary">
            +10s
          </button>
          <button onClick={handleFullscreen} className="btn btn-primary">
            Fullscreen
          </button>
        </div>

        <div className="space-y-2">
          <div className="slider-group">
            <div className="slider-label">
              <span>Volume: {volume}%</span>
              <button onClick={() => setMuted(!muted)} className="link-btn">
                {muted ? 'Unmute' : 'Mute'}
              </button>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
            />
          </div>

          <div className="slider-group">
            <div className="slider-label">
              <span>Boost: {boost}%</span>
            </div>
            <input
              type="range"
              min="100"
              max="300"
              value={boost}
              onChange={(e) => setBoost(Number(e.target.value))}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
