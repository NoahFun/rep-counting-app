import React, { useEffect, useRef, useState } from 'react';

function AICameraCounter({ onApplyCount, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [exercise, setExercise] = useState('curl'); // 'curl' or 'squat'
  const [repCount, setRepCount] = useState(0);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [feedback, setFeedback] = useState('Stand in frame');

  // Using refs to keep track of state inside the animation loop
  const repCountRef = useRef(0);
  const stageRef = useRef('down'); // 'down' or 'up' (for curls) / 'up' or 'down' (for squats)
  const cameraInstanceRef = useRef(null);
  const poseInstanceRef = useRef(null);

  // Math helper to calculate the angle between three landmarks: a, b (joint), c
  const calculateAngle = (a, b, c) => {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
  };

  const startCamera = () => {
    if (!videoRef.current || !canvasRef.current) return;

    // 1. Initialize MediaPipe Pose
    const pose = new window.Pose({
      locateFile: (file) => `https://cdn.jsdelivr.net/npm/@mediapipe/pose/${file}`,
    });

    pose.setOptions({
      modelComplexity: 2,
      smoothLandmarks: true,
      enableSegmentation: false,
      smoothSegmentation: false,
      minDetectionConfidence: 0.6,
      minTrackingConfidence: 0.6,
    });

    pose.onResults(onResults);
    poseInstanceRef.current = pose;

    // 2. Initialize Camera Utility
    const camera = new window.Camera(videoRef.current, {
      onFrame: async () => {
        if (videoRef.current) {
          await pose.send({ image: videoRef.current });
        }
      },
      width: 640,
      height: 480,
    });

    camera.start()
      .then(() => {
        setIsCameraActive(true);
        setFeedback('Camera loaded. Position your body!');
      })
      .catch((err) => {
        console.error("Camera start error:", err);
        setFeedback('Failed to access camera.');
      });

    cameraInstanceRef.current = camera;
  };

  const stopCamera = () => {
    if (cameraInstanceRef.current) {
      cameraInstanceRef.current.stop();
    }
    if (poseInstanceRef.current) {
      poseInstanceRef.current.close();
    }
    setIsCameraActive(false);
    setFeedback('Camera stopped');
  };

  // Process the skeleton points returned by MediaPipe
  const onResults = (results) => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvasCtx = canvasRef.current.getContext('2d');
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;

    // Clear and draw the mirrored webcam frame
    canvasCtx.save();
    canvasCtx.clearRect(0, 0, width, height);
    
    // Mirror effect for natural feedback
    canvasCtx.translate(width, 0);
    canvasCtx.scale(-1, 1);
    canvasCtx.drawImage(results.image, 0, 0, width, height);
    canvasCtx.restore();

    if (results.poseLandmarks) {
      const landmarks = results.poseLandmarks;

      // Draw skeleton lines and points
      drawSkeleton(canvasCtx, landmarks, width, height);

      // Extract joint coordinates
      // MediaPipe landmarks: 
      // Left shoulder (11), Left elbow (13), Left wrist (15)
      // Right shoulder (12), Right elbow (14), Right wrist (16)
      // Left hip (23), Left knee (25), Left ankle (27)
      // Right hip (24), Right knee (26), Right ankle (28)
      
      if (exercise === 'curl') {
        // Track the right arm elbow angle
        const shoulder = landmarks[12];
        const elbow = landmarks[14];
        const wrist = landmarks[16];

        if (shoulder.visibility > 0.5 && elbow.visibility > 0.5 && wrist.visibility > 0.5) {
          const angle = calculateAngle(shoulder, elbow, wrist);
          
          // Draw angle value next to elbow
          drawAngleText(canvasCtx, angle, elbow, width, height);

          // Bicep curl logic: Extension > 160, Flexion < 60
          if (angle > 160) {
            stageRef.current = 'down';
            setFeedback('Lift the weight!');
          }
          if (angle < 60 && stageRef.current === 'down') {
            stageRef.current = 'up';
            repCountRef.current += 1;
            setRepCount(repCountRef.current);
            setFeedback('Good rep! Lower slowly');
          }
        }
      } else if (exercise === 'squat') {
        // Track right knee angle
        const hip = landmarks[24];
        const knee = landmarks[26];
        const ankle = landmarks[28];

        if (hip.visibility > 0.5 && knee.visibility > 0.5 && ankle.visibility > 0.5) {
          const angle = calculateAngle(hip, knee, ankle);

          drawAngleText(canvasCtx, angle, knee, width, height);

          // Squat logic: Bending (down) < 110, Standing (up) > 160
          if (angle < 110) {
            stageRef.current = 'down';
            setFeedback('Rise up!');
          }
          if (angle > 160 && stageRef.current === 'down') {
            stageRef.current = 'up';
            repCountRef.current += 1;
            setRepCount(repCountRef.current);
            setFeedback('Great squat!');
          }
        }
      }
    }
  };

  const drawAngleText = (ctx, angle, landmark, width, height) => {
    ctx.save();
    // Invert X coordinate back because canvas is mirrored
    const x = width - (landmark.x * width);
    const y = landmark.y * height;
    ctx.fillStyle = '#00ffcc';
    ctx.font = 'bold 18px Arial';
    ctx.fillText(`${Math.round(angle)}°`, x + 15, y);
    ctx.restore();
  };

  const drawSkeleton = (ctx, landmarks, width, height) => {
    ctx.save();
    // Neon design theme for visual style
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 3;
    ctx.fillStyle = '#ff0055';

    // List of key joints to draw (shoulders, elbows, wrists, hips, knees, ankles)
    const connections = [
      [11, 12], [11, 13], [13, 15], [12, 14], [14, 16], // Upper body
      [11, 23], [12, 24], [23, 24],                     // Torso
      [23, 25], [25, 27], [24, 26], [26, 28]              // Lower body
    ];

    connections.forEach(([i1, i2]) => {
      const pt1 = landmarks[i1];
      const pt2 = landmarks[i2];
      if (pt1.visibility > 0.5 && pt2.visibility > 0.5) {
        ctx.beginPath();
        ctx.moveTo(width - (pt1.x * width), pt1.y * height);
        ctx.lineTo(width - (pt2.x * width), pt2.y * height);
        ctx.stroke();
      }
    });

    // Draw nodes
    landmarks.forEach((lm) => {
      if (lm.visibility > 0.5) {
        ctx.beginPath();
        ctx.arc(width - (lm.x * width), lm.y * height, 5, 0, 2 * Math.PI);
        ctx.fill();
      }
    });
    ctx.restore();
  };

  const resetCount = () => {
    repCountRef.current = 0;
    setRepCount(0);
  };

  useEffect(() => {
    if (!window.Pose || !window.Camera) {
      setFeedback("⚠️ MediaPipe failed to load. Please verify index.html script tags.");
    }
    return () => {
      stopCamera();
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
      <h3 style={{ margin: '0 0 10px 0', color: '#fff' }}>AI Smart Rep Counter</h3>
      
      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
        <button 
          onClick={() => setExercise('curl')} 
          style={{
            background: exercise === 'curl' ? '#4f46e5' : '#312e81',
            color: '#white', padding: '8px 16px', border: 'none', borderRadius: '8px', cursor: 'pointer'
          }}
        >
          Bicep Curl
        </button>
        <button 
          onClick={() => setExercise('squat')} 
          style={{
            background: exercise === 'squat' ? '#4f46e5' : '#312e81',
            color: '#white', padding: '8px 16px', border: 'none', borderRadius: '8px', cursor: 'pointer'
          }}
        >
          Squats
        </button>
      </div>

      <div style={{ position: 'relative', width: '100%', maxWidth: '400px', aspectRatio: '4/3', background: '#000', borderRadius: '12px', overflow: 'hidden' }}>
        <video ref={videoRef} style={{ display: 'none' }} playsInline muted />
        <canvas ref={canvasRef} width={400} height={300} style={{ width: '100%', height: '100%', display: 'block' }} />
        
        <div style={{
          position: 'absolute', top: '10px', right: '10px', background: 'rgba(0, 0, 0, 0.7)',
          padding: '6px 12px', borderRadius: '20px', color: '#00ffcc', fontWeight: 'bold', fontSize: '20px'
        }}>
          Reps: {repCount}
        </div>
      </div>

      <p style={{ color: '#aaa', margin: '10px 0', fontStyle: 'italic' }}>{feedback}</p>

      <div style={{ display: 'flex', gap: '10px', width: '100%', maxWidth: '400px' }}>
        {!isCameraActive ? (
          <button onClick={startCamera} style={{ flex: 1, background: '#10b981', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer' }}>
            Start Camera
          </button>
        ) : (
          <button onClick={stopCamera} style={{ flex: 1, background: '#ef4444', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer' }}>
            Stop Camera
          </button>
        )}
        <button onClick={resetCount} style={{ background: '#4b5563', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer' }}>
          Reset
        </button>
        <button 
          onClick={() => { stopCamera(); onApplyCount(repCount); }} 
          style={{ flex: 1, background: '#4f46e5', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer' }}
          disabled={repCount === 0}
        >
          Use Count
        </button>
      </div>
    </div>
  );
}

export default AICameraCounter;