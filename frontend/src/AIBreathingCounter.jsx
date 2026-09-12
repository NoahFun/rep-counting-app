import React, { useEffect, useRef, useState } from 'react';

function AIBreathingCounter({ onApplyCount, onClose }) {
  const [repCount, setRepCount] = useState(0);
  const [isListening, setIsListening] = useState(false);
  const [feedback, setFeedback] = useState('AirPods connected? Click Start.');
  const [threshold, setThreshold] = useState(25); // Sensitivity threshold (0-100)
  
  const repCountRef = useRef(0);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const microphoneRef = useRef(null);
  const animationFrameIdRef = useRef(null);
  const canvasRef = useRef(null);

  // Keep ref updated to prevent stale closures
  const thresholdRef = useRef(25);
  useEffect(() => {
    thresholdRef.current = threshold;
  }, [threshold]);

  const lastPeakTimeRef = useRef(0);
  const COOLDOWN_MS = 1500; // 1.5s cooldown between rep counts to avoid double counting a single breath

  const startListening = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      const audioContext = new AudioContext();
      const analyser = audioContext.createAnalyser();
      const microphone = audioContext.createMediaStreamSource(stream);
      
      analyser.fftSize = 512;
      microphone.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      microphoneRef.current = microphone;

      setIsListening(true);
      setFeedback('Listening... Take a sharp exhale/grunt on exertion!');

      // Set up simple amplitude detection loop via canvas drawing
      drawVisualization();

    } catch (err) {
      console.error('Audio access error:', err);
      setFeedback('⚠️ Microphone access denied. Check your permissions.');
    }
  };

  const stopListening = () => {
    if (animationFrameIdRef.current) {
      cancelAnimationFrame(animationFrameIdRef.current);
    }
    if (microphoneRef.current) {
      microphoneRef.current.disconnect();
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
    }
    setIsListening(false);
    setFeedback('Stopped listening');
  };

  const drawVisualization = () => {
    if (!canvasRef.current || !analyserRef.current) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const analyser = analyserRef.current;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const draw = () => {
      if (!analyserRef.current) return;
      animationFrameIdRef.current = requestAnimationFrame(draw);

      analyser.getByteFrequencyData(dataArray);

      // Clear canvas
      ctx.fillStyle = 'rgba(26, 26, 46, 1)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw threshold line
      const thresholdY = canvas.height - (thresholdRef.current / 100) * canvas.height;
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      ctx.moveTo(0, thresholdY);
      ctx.lineTo(canvas.width, thresholdY);
      ctx.stroke();
      ctx.setLineDash([]); // Reset line dash

      // Calculate average volume/amplitude
      let total = 0;
      for (let i = 0; i < bufferLength; i++) {
        total += dataArray[i];
      }
      const averageVolume = total / bufferLength;
      // Convert to a 0-100 scale
      const normalizedVolume = (averageVolume / 255) * 100;

      // Peak/Spike Detection
      const now = Date.now();
      if (normalizedVolume > thresholdRef.current) {
        if (now - lastPeakTimeRef.current > COOLDOWN_MS) {
          repCountRef.current += 1;
          setRepCount(repCountRef.current);
          lastPeakTimeRef.current = now;
          setFeedback('😤 Rep detected via Exhale/Grunt!');
        }
      }

      // Draw real-time volume bar
      const barHeight = (normalizedVolume / 100) * canvas.height;
      const isCooldown = now - lastPeakTimeRef.current < COOLDOWN_MS;
      
      ctx.fillStyle = isCooldown ? '#f59e0b' : '#00ffcc';
      ctx.fillRect(50, canvas.height - barHeight, canvas.width - 100, barHeight);

      // Draw volume text
      ctx.fillStyle = 'white';
      ctx.font = '14px sans-serif';
      ctx.fillText(`Vol: ${Math.round(normalizedVolume)}`, 10, 20);
      ctx.fillText(`Threshold: ${thresholdRef.current}`, 10, thresholdY - 5);
      if (isCooldown) {
        ctx.fillStyle = '#f59e0b';
        ctx.fillText('Cooldown...', canvas.width - 90, 20);
      }
    };

    draw();
  };

  const resetCount = () => {
    repCountRef.current = 0;
    setRepCount(0);
  };

  useEffect(() => {
    return () => {
      if (animationFrameIdRef.current) {
        cancelAnimationFrame(animationFrameIdRef.current);
      }
      if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
        audioContextRef.current.close();
      }
    };
  }, []);

  return (
    <div style={{
      background: 'rgba(26, 26, 46, 0.95)',
      padding: '20px',
      borderRadius: '16px',
      border: '1px solid rgba(255, 255, 255, 0.1)',
      margin: '20px 0',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center'
    }}>
      <h3 style={{ margin: '0 0 10px 0', color: '#fff' }}>💨 AI Breath & Audio Rep Counter</h3>
      <p style={{ color: '#aaa', fontSize: '0.85rem', margin: '0 0 15px 0', textAlign: 'center' }}>
        No camera needed. Wear AirPods/headphones and breathe out sharply (or grunt) at the peak of your effort.
      </p>

      {/* Visualizer Area */}
      <div style={{ position: 'relative', width: '100%', maxWidth: '400px', height: '120px', background: '#000', borderRadius: '12px', overflow: 'hidden', marginBottom: '15px' }}>
        <canvas ref={canvasRef} width={400} height={120} style={{ width: '100%', height: '100%', display: 'block' }} />
        
        <div style={{
          position: 'absolute', top: '10px', right: '10px', background: 'rgba(0, 0, 0, 0.7)',
          padding: '6px 12px', borderRadius: '20px', color: '#00ffcc', fontWeight: 'bold', fontSize: '20px'
        }}>
          Reps: {repCount}
        </div>
      </div>

      {/* Sensitivity Threshold Slider */}
      <div style={{ width: '100%', maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '15px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#bbb', fontSize: '0.9rem' }}>
          <span>Mic Sensitivity (Trigger Threshold)</span>
          <span style={{ color: '#00ffcc', fontWeight: 'bold' }}>{threshold}%</span>
        </div>
        <input 
          type="range" 
          min="5" 
          max="80" 
          value={threshold} 
          onChange={(e) => setThreshold(Number(e.target.value))}
          style={{ width: '100%', accentColor: '#00ffcc', cursor: 'pointer' }}
        />
        <span style={{ color: '#888', fontSize: '0.75rem' }}>
          Tip: Set threshold above ambient room noise but below your breath/exhale spike level.
        </span>
      </div>

      <p style={{ color: '#aaa', margin: '10px 0', fontStyle: 'italic', fontSize: '0.9rem', textAlign: 'center' }}>{feedback}</p>

      {/* Control Buttons */}
      <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '400px' }}>
        {!isListening ? (
          <button onClick={startListening} style={{ flex: 1, background: '#10b981', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            Start Listening
          </button>
        ) : (
          <button onClick={stopListening} style={{ flex: 1, background: '#ef4444', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}>
            Stop Listening
          </button>
        )}
        <button onClick={resetCount} style={{ background: '#4b5563', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer' }}>
          Reset
        </button>
        <button 
          onClick={() => { stopListening(); onApplyCount(repCount); }} 
          style={{ flex: 1, background: '#4f46e5', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
          disabled={repCount === 0}
        >
          Use Count
        </button>
      </div>
    </div>
  );
}

export default AIBreathingCounter;
