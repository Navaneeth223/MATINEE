import { useState, useRef, useEffect } from 'react';

interface SourcePanelProps {
  onStreamReady: (stream: MediaStream, videoElement?: HTMLVideoElement) => void;
  isSafari: boolean;
}

type SourceMode = 'film' | 'screen' | null;

export function SourcePanel({ onStreamReady, isSafari }: SourcePanelProps) {
  const [mode, setMode] = useState<SourceMode>(null);
  const [file, setFile] = useState<File | null>(null);
  const [volume, setVolume] = useState(100);
  const [audioWarning, setAudioWarning] = useState(false);
  const [ffmpegCommand, setFfmpegCommand] = useState('');
  const [screenStream, setScreenStream] = useState<MediaStream | null>(null);
  const [nearBlack, setNearBlack] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const screenVideoRef = useRef<HTMLVideoElement>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const localGainRef = useRef<GainNode | null>(null);
  const testStreamRef = useRef<MediaStream | null>(null);

  // Test source mode for E2E tests
  const searchParams = new URLSearchParams(window.location.search);
  const isTestMode = searchParams.has('testsource');

  useEffect(() => {
    if (!isTestMode) return;

    // Create canvas + oscillator test stream
    const canvas = document.createElement('canvas');
    canvas.width = 640;
    canvas.height = 480;
    const ctx = canvas.getContext('2d')!;

    let frame = 0;
    const drawInterval = setInterval(() => {
      ctx.fillStyle = `hsl(${frame % 360}, 100%, 50%)`;
      ctx.fillRect(0, 0, 640, 480);
      ctx.fillStyle = 'white';
      ctx.font = '48px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`Test Frame ${frame}`, 320, 240);
      frame++;
    }, 100);

    const videoStream = canvas.captureStream(10);

    const audioCtx = new AudioContext();
    const oscillator = audioCtx.createOscillator();
    oscillator.frequency.value = 440;
    const dest = audioCtx.createMediaStreamDestination();
    oscillator.connect(dest);
    oscillator.start();

    const combined = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...dest.stream.getAudioTracks()
    ]);

    testStreamRef.current = combined;

    return () => {
      clearInterval(drawInterval);
      oscillator.stop();
      audioCtx.close();
    };
  }, [isTestMode]);

  const handleTestStreamStart = () => {
    if (!testStreamRef.current) return;
    onStreamReady(testStreamRef.current);
  };

  useEffect(() => {
    if (!videoRef.current || !file) return;

    const video = videoRef.current;
    const url = URL.createObjectURL(file);
    video.src = url;
    video.load();

    const checkAudio = async () => {
      try {
        await video.play();
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        const videoEl = video as any;
        const decodedBytes = videoEl.webkitAudioDecodedByteCount || 0;
        const canPlay = video.canPlayType('video/mp4; codecs="avc1.42E01E, mp4a.40.2"');
        
        if (decodedBytes === 0 || !canPlay) {
          setAudioWarning(true);
          setFfmpegCommand(`ffmpeg -i "${file.name}" -map 0:v:0 -map 0:a:0 -c:v copy -c:a aac -b:a 192k -movflags +faststart "${file.name.replace(/\.[^.]+$/, '-web.mp4')}"`);
        }
        
        video.currentTime = 0;
        video.pause();
      } catch (err) {
        console.error('Format check failed:', err);
      }
    };

    checkAudio();

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    if (!screenVideoRef.current || !screenStream) return;

    const video = screenVideoRef.current;
    video.srcObject = screenStream;
    video.play();

    const checkNearBlack = () => {
      const canvas = document.createElement('canvas');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.drawImage(video, 0, 0);
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const pixels = imageData.data;
      
      let blackCount = 0;
      for (let i = 0; i < pixels.length; i += 4) {
        const r = pixels[i];
        const g = pixels[i + 1];
        const b = pixels[i + 2];
        if (r < 30 && g < 30 && b < 30) blackCount++;
      }

      const blackRatio = blackCount / (pixels.length / 4);
      if (blackRatio > 0.95 && screenStream.getAudioTracks().length > 0) {
        setNearBlack(true);
      }
    };

    const timer = setTimeout(checkNearBlack, 3000);
    return () => clearTimeout(timer);
  }, [screenStream]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setAudioWarning(false);
    }
  };

  const handleFilmStart = () => {
    if (!videoRef.current) return;

    const video = videoRef.current;
    
    const audioCtx = new AudioContext();
    audioCtxRef.current = audioCtx;
    const source = audioCtx.createMediaElementSource(video);
    const localGain = audioCtx.createGain();
    localGainRef.current = localGain;
    localGain.gain.value = volume / 100;
    const dest = audioCtx.createMediaStreamDestination();

    source.connect(localGain);
    localGain.connect(audioCtx.destination);
    source.connect(dest);

    const videoStream = (video as any).captureStream ? (video as any).captureStream() : (video as any).mozCaptureStream();
    const combined = new MediaStream([
      ...videoStream.getVideoTracks(),
      ...dest.stream.getAudioTracks()
    ]);

    onStreamReady(combined, video);
  };

  const handleScreenCapture = async () => {
    try {
      const stream = await (navigator.mediaDevices as any).getDisplayMedia({
        video: { displaySurface: 'monitor' },
        audio: true,
      });
      
      setScreenStream(stream);
      onStreamReady(stream);
    } catch (err) {
      console.error('Screen capture failed:', err);
    }
  };

  useEffect(() => {
    if (localGainRef.current) {
      localGainRef.current.gain.value = volume / 100;
    }
  }, [volume]);

  if (mode === null) {
    if (isTestMode && testStreamRef.current) {
      return (
        <div className="source-panel">
          <div className="card space-y-4">
            <h2 data-testid="test-source-ready">Test source ready</h2>
            <button
              onClick={handleTestStreamStart}
              className="btn btn-primary w-full"
              data-testid="start-test-stream"
            >
              Start streaming
            </button>
          </div>
        </div>
      );
    }

    return (
      <div className="source-panel">
        <div className="card space-y-4">
          <h2>Choose source</h2>
          {isSafari && (
            <div className="warning-card">
              <p>Use Chrome to send screen or film. Safari can only receive.</p>
            </div>
          )}
          <button
            onClick={() => setMode('film')}
            className="btn btn-primary w-full"
            disabled={isSafari}
          >
            Film file
          </button>
          <button
            onClick={() => setMode('screen')}
            className="btn btn-primary w-full"
            disabled={isSafari}
          >
            Share screen
          </button>
        </div>
      </div>
    );
  }

  if (mode === 'film') {
    return (
      <div className="source-panel">
        <div className="card space-y-4">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Film file</h2>
            <button onClick={() => setMode(null)} className="link-btn">Change source</button>
          </div>
          
          <input
            type="file"
            accept="video/*"
            onChange={handleFileSelect}
          />

          {audioWarning && (
            <div className="warning-card">
              <p>No sound: this file's audio (probably Dolby/AC-3) can't play in the browser</p>
              <div className="code-block">
                {ffmpegCommand}
              </div>
              <button
                onClick={() => navigator.clipboard?.writeText(ffmpegCommand)}
                className="link-btn"
                style={{ marginTop: '0.5rem' }}
              >
                Copy command
              </button>
            </div>
          )}

          {file && (
            <div className="space-y-2">
              <video
                ref={videoRef}
                controls
                style={{ maxHeight: '300px' }}
              />
              
              <div className="slider-group">
                <div className="slider-label">
                  <span>Local volume: {volume}%</span>
                </div>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={volume}
                  onChange={(e) => setVolume(Number(e.target.value))}
                />
              </div>

              <button
                onClick={handleFilmStart}
                className="btn btn-primary w-full"
              >
                Start streaming
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (mode === 'screen') {
    return (
      <div className="source-panel">
        <div className="card space-y-4">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h2>Share screen</h2>
            <button onClick={() => setMode(null)} className="link-btn">Change source</button>
          </div>

          {!screenStream && (
            <>
              <div className="card" style={{ background: 'var(--bg)', padding: '1rem' }}>
                <p className="text-sm text-muted">
                  <strong>Coaching tip:</strong> Pick a Chrome tab and tick "Share tab audio", or choose your entire screen with "Share system audio" (Windows). This shares Netflix, YouTube, or anything playing on your computer.
                </p>
              </div>
              <button
                onClick={handleScreenCapture}
                className="btn btn-primary w-full"
              >
                Pick screen or tab
              </button>
            </>
          )}

          {screenStream && (
            <>
              <video
                ref={screenVideoRef}
                autoPlay
                muted
                style={{ maxHeight: '300px', background: 'black' }}
              />
              
              {nearBlack && (
                <div className="warning-card">
                  <p>This looks like a protected screen (Netflix etc.). Matinee can't and won't bypass this.</p>
                </div>
              )}

              <p className="text-sm text-muted">Screen sharing active. The sender controls playback.</p>
            </>
          )}
        </div>
      </div>
    );
  }

  return null;
}
