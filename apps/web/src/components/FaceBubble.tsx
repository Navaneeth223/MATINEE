import { useState, useRef, useEffect } from 'react';

interface FaceBubbleProps {
  stream: MediaStream | null;
  localStream?: boolean;
  onClose?: () => void;
}

export function FaceBubble({ stream, localStream = false, onClose }: FaceBubbleProps) {
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem(`bubble-pos-${localStream ? 'local' : 'remote'}`);
    return saved ? JSON.parse(saved) : { x: localStream ? 20 : window.innerWidth - 220, y: 20 };
  });
  const [size, setSize] = useState<'S' | 'M' | 'L'>(() => {
    const saved = localStorage.getItem(`bubble-size-${localStream ? 'local' : 'remote'}`);
    return (saved as 'S' | 'M' | 'L') || 'M';
  });
  const [shape, setShape] = useState<'circle' | 'square'>(() => {
    const saved = localStorage.getItem(`bubble-shape-${localStream ? 'local' : 'remote'}`);
    return (saved as 'circle' | 'square') || 'circle';
  });
  const [opacity, setOpacity] = useState(() => {
    const saved = localStorage.getItem(`bubble-opacity-${localStream ? 'local' : 'remote'}`);
    return saved ? Number(saved) : 100;
  });
  const [hidden, setHidden] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const bubbleRef = useRef<HTMLDivElement>(null);

  const sizeMap = {
    S: 120,
    M: 180,
    L: 240,
  };

  useEffect(() => {
    if (videoRef.current && stream) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  useEffect(() => {
    localStorage.setItem(`bubble-pos-${localStream ? 'local' : 'remote'}`, JSON.stringify(position));
  }, [position, localStream]);

  useEffect(() => {
    localStorage.setItem(`bubble-size-${localStream ? 'local' : 'remote'}`, size);
  }, [size, localStream]);

  useEffect(() => {
    localStorage.setItem(`bubble-shape-${localStream ? 'local' : 'remote'}`, shape);
  }, [shape, localStream]);

  useEffect(() => {
    localStorage.setItem(`bubble-opacity-${localStream ? 'local' : 'remote'}`, opacity.toString());
  }, [opacity, localStream]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.bubble-controls')) return;
    setDragging(true);
    setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!dragging) return;
    
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    
    const maxX = window.innerWidth - sizeMap[size];
    const maxY = window.innerHeight - sizeMap[size];
    
    setPosition({
      x: Math.max(0, Math.min(newX, maxX)),
      y: Math.max(0, Math.min(newY, maxY)),
    });
  };

  const handleMouseUp = () => {
    setDragging(false);
  };

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [dragging, dragStart]);

  if (hidden) {
    return (
      <button
        onClick={() => setHidden(false)}
        className="bubble-restore-btn"
        style={{
          position: 'fixed',
          bottom: '20px',
          right: '20px',
          zIndex: 9999,
        }}
      >
        Show {localStream ? 'You' : 'Partner'}
      </button>
    );
  }

  if (!stream) return null;

  const bubbleSize = sizeMap[size];

  return (
    <div
      ref={bubbleRef}
      className="face-bubble"
      style={{
        position: 'fixed',
        left: position.x,
        top: position.y,
        width: bubbleSize,
        height: bubbleSize,
        borderRadius: shape === 'circle' ? '50%' : '14px',
        overflow: 'hidden',
        cursor: dragging ? 'grabbing' : 'grab',
        zIndex: 9998,
        opacity: opacity / 100,
        boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
        border: '2px solid var(--accent)',
        background: 'black',
      }}
      onMouseDown={handleMouseDown}
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={localStream}
        style={{
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      
      <div
        className="bubble-controls"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          padding: '8px',
          background: 'rgba(0, 0, 0, 0.7)',
          display: 'flex',
          gap: '4px',
          justifyContent: 'center',
          opacity: 0,
          transition: 'opacity 0.2s',
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLElement).style.opacity = '1';
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLElement).style.opacity = '0';
        }}
      >
        <button
          onClick={() => setSize('S')}
          className={`bubble-btn ${size === 'S' ? 'active' : ''}`}
          title="Small"
        >
          S
        </button>
        <button
          onClick={() => setSize('M')}
          className={`bubble-btn ${size === 'M' ? 'active' : ''}`}
          title="Medium"
        >
          M
        </button>
        <button
          onClick={() => setSize('L')}
          className={`bubble-btn ${size === 'L' ? 'active' : ''}`}
          title="Large"
        >
          L
        </button>
        <span style={{ borderLeft: '1px solid rgba(255,255,255,0.3)', margin: '0 4px' }} />
        <button
          onClick={() => setShape(shape === 'circle' ? 'square' : 'circle')}
          className="bubble-btn"
          title={shape === 'circle' ? 'Square' : 'Circle'}
        >
          {shape === 'circle' ? '□' : '○'}
        </button>
        <button
          onClick={() => setHidden(true)}
          className="bubble-btn"
          title="Hide"
        >
          ✕
        </button>
      </div>

      <div
        style={{
          position: 'absolute',
          top: '8px',
          right: '8px',
          fontSize: '12px',
          color: 'white',
          background: 'rgba(0, 0, 0, 0.7)',
          padding: '4px 8px',
          borderRadius: '4px',
          pointerEvents: 'none',
        }}
      >
        {localStream ? 'You' : 'Partner'}
      </div>
    </div>
  );
}
