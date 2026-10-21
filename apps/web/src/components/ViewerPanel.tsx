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
  const [stats, setStats] = useState({ resolution: '', kbps: 0, dropped: 0, connection: 'unknown' });
  
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
      <div className="flex items-center justify-center h-full text-[#B7AEC0]">
        Waiting for stream...
      </div>
    );
  }

  if (!ready) {
    return (
      <div className="flex items-center justify-center h-full">
        <button
          onClick={handleStartWatching}
          className="px-12 py-6 text-2xl font-medium bg-[#E7C98E] text-[#08070B] rounded-[14px] hover:opacity-90 transition-opacity focus:outline-none focus:ring-2 focus:ring-[#E7C98E]"
        >
          Start watching
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <video
        ref={videoRef}
        autoPlay
        muted
        playsInline
        className="w-full rounded-[14px] bg-black"
        style={{ aspectRatio: '16 / 9' }}
        onLoadedMetadata={() => {
          if (videoRef.current && stream) {
            videoRef.current.srcObject = stream;
          }
        }}
      />

      {sourceState && (
        <div className="text-sm text-[#B7AEC0] space-y-1">
          <p>Position: {sourceState.time.toFixed(1)}s {sourceState.paused ? '(paused)' : '(playing)'}</p>
          {stats.resolution && (
            <p>
              {stats.resolution} • {stats.kbps} kbps • {stats.dropped} dropped • {stats.connection}
            </p>
          )}
        </div>
      )}

      <div className="bg-[#15121B] rounded-[14px] p-4 space-y-4">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => onCommand('play')}
            className="px-4 py-2 bg-[#E7C98E] text-[#08070B] rounded-[14px] text-sm font-medium hover:opacity-90"
          >
            Play
          </button>
          <button
            onClick={() => onCommand('pause')}
            className="px-4 py-2 bg-[#E7C98E] text-[#08070B] rounded-[14px] text-sm font-medium hover:opacity-90"
          >
            Pause
          </button>
          <button
            onClick={() => onCommand('skip', -10)}
            className="px-4 py-2 bg-[#E7C98E] text-[#08070B] rounded-[14px] text-sm font-medium hover:opacity-90"
          >
            -10s
          </button>
          <button
            onClick={() => onCommand('skip', 10)}
            className="px-4 py-2 bg-[#E7C98E] text-[#08070B] rounded-[14px] text-sm font-medium hover:opacity-90"
          >
            +10s
          </button>
          <button
            onClick={handleFullscreen}
            className="px-4 py-2 bg-[#E7C98E] text-[#08070B] rounded-[14px] text-sm font-medium hover:opacity-90"
          >
            Fullscreen
          </button>
        </div>

        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-sm text-[#B7AEC0]">Volume: {volume}%</label>
              <button
                onClick={() => setMuted(!muted)}
                className="text-xs text-[#E7C98E] hover:underline"
              >
                {muted ? 'Unmute' : 'Mute'}
              </button>
            </div>
            <input
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(e) => setVolume(Number(e.target.value))}
              className="w-full accent-[#E7C98E]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-sm text-[#B7AEC0]">Boost: {boost}%</label>
            <input
              type="range"
              min="100"
              max="300"
              value={boost}
              onChange={(e) => setBoost(Number(e.target.value))}
              className="w-full accent-[#E7C98E]"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
