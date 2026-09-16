import React, { useEffect, useRef, useState } from 'react';

// Exercise configurations ported from Good-GYM's exercises.json
// MediaPipe landmark indices:
// Left shoulder (11), Left elbow (13), Left wrist (15)
// Right shoulder (12), Right elbow (14), Right wrist (16)
// Left hip (23), Left knee (25), Left ankle (27)
// Right hip (24), Right knee (26), Right ankle (28)
const EXERCISE_CONFIGS = {
  bicep_curl: {
    label: 'Bicep Curl',
    // Right side: Shoulder(12) → Elbow(14) → Wrist(16)
    points: [12, 14, 16],
    startAngle: 150, // arm extended
    endAngle: 60, // arm curled
    direction: 'decreasing', 
    startMsg: 'Lift the weight!',
    endMsg: 'Good rep! Lower slowly',
  },
  squat: {
    label: 'Squat',
    // Right side: Hip(24) → Knee(26) → Ankle(28)
    points: [24, 26, 28],
    startAngle: 120, // bottom of squat
    endAngle: 150, // standing up
    direction: 'increasing',
    startMsg: 'Squat down!',
    endMsg: 'Great squat!',
  },
  pushup: {
    label: 'Push-up',
    // Right side: Shoulder(12) → Elbow(14) → Wrist(16)
    points: [12, 14, 16],
    startAngle: 120, // bottom of pushup
    endAngle: 150, // arms straight
    direction: 'increasing',
    startMsg: 'Go down!',
    endMsg: 'Good push-up!',
  },
  situp: {
    label: 'Sit-up',
    // Right side: Shoulder(12) → Hip(24) → Knee(26)
    points: [12, 24, 26],
    startAngle: 155, // lying flat
    endAngle: 130, // sitting up
    direction: 'decreasing',
    startMsg: 'Sit up!',
    endMsg: 'Good sit-up!',
  },
  lateral_raise: {
    label: 'Lateral Raise',
    // Right side: Hip(24) → Shoulder(12) → Elbow(14)
    points: [24, 12, 14],
    startAngle: 30, // arms down
    endAngle: 80, // arms raised
    direction: 'increasing',
    startMsg: 'Raise your arms!',
    endMsg: 'Good raise!',
  },
  overhead_press: {
    label: 'Overhead Press',
    // Right side: Shoulder(12) → Elbow(14) → Wrist(16)
    points: [12, 14, 16],
    startAngle: 70, // bar at shoulders
    endAngle: 140, // arms pressed up
    direction: 'increasing',
    startMsg: 'Press up!',
    endMsg: 'Good press!',
  },
  pullup: {
    label: 'Pull-up',
    // Right side: Shoulder(12) → Elbow(14) → Wrist(16)
    points: [12, 14, 16],
    startAngle: 140, // hanging
    endAngle: 70, // pulled up
    direction: 'decreasing',
    startMsg: 'Pull up!',
    endMsg: 'Good pull-up!',
  },
  crunch: {
    label: 'Crunch',
    // Right side: Shoulder(12) → Hip(24) → Knee(26)
    points: [12, 24, 26],
    startAngle: 160, // lying flat
    endAngle: 140, // crunched up
    direction: 'decreasing',
    startMsg: 'Crunch up!',
    endMsg: 'Good crunch!',
  },
};

function AICameraCounter({ onApplyCount, onClose }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [exercise, setExercise] = useState('bicep_curl');
  const [repCount, setRepCount] = useState(0);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [feedback, setFeedback] = useState('Stand in frame');

  // Using refs so the camera callback always reads the latest values
  const repCountRef = useRef(0);
  const stageRef = useRef(null);
  const exerciseRef = useRef('bicep_curl'); 
  const cameraInstanceRef = useRef(null);
  const poseInstanceRef = useRef(null);
  const angleHistoryRef = useRef([]);

  useEffect(() => {
    exerciseRef.current = exercise;
    stageRef.current = null; 
    angleHistoryRef.current = []; // clear history when switching exercises
  }, [exercise]);

  const calculateAngle = (a, b, c) => {
    const radians = Math.atan2(c.y - b.y, c.x - b.x) - Math.atan2(a.y - b.y, a.x - b.x);
    let angle = Math.abs((radians * 180.0) / Math.PI);
    if (angle > 180.0) angle = 360 - angle;
    return angle;
  };

  const smoothAngle = (angle) => {
    angleHistoryRef.current.push(angle);
    if (angleHistoryRef.current.length > 5) {
      angleHistoryRef.current.shift();
    }
    const sum = angleHistoryRef.current.reduce((a, b) => a + b, 0);
    return sum / angleHistoryRef.current.length;
  };

  const startCamera = () => {
    if (!videoRef.current || !canvasRef.current) return;

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
    if (videoRef.current && videoRef.current.srcObject) {
      videoRef.current.srcObject.getTracks().forEach(track => track.stop());
    }
    if (cameraInstanceRef.current) {
      cameraInstanceRef.current.stop();
    }
    if (poseInstanceRef.current) {
      poseInstanceRef.current.close();
    }
    setIsCameraActive(false);
    setFeedback('Camera stopped');
  };

  const onResults = (results) => {
    if (!canvasRef.current || !videoRef.current) return;

    const canvasCtx = canvasRef.current.getContext('2d');
    const width = canvasRef.current.width;
    const height = canvasRef.current.height;

    canvasCtx.save();
    canvasCtx.clearRect(0, 0, width, height);
    canvasCtx.translate(width, 0);
    canvasCtx.scale(-1, 1);
    canvasCtx.drawImage(results.image, 0, 0, width, height);
    canvasCtx.restore();

    if (results.poseLandmarks) {
      const landmarks = results.poseLandmarks;

      drawSkeleton(canvasCtx, landmarks, width, height);

      const config = EXERCISE_CONFIGS[exerciseRef.current];
      if (!config) return;

      const [i1, i2, i3] = config.points;
      const pt1 = landmarks[i1];
      const pt2 = landmarks[i2]; 
      const pt3 = landmarks[i3];

      if (pt1.visibility > 0.4 && pt2.visibility > 0.4 && pt3.visibility > 0.4) {
        const rawAngle = calculateAngle(pt1, pt2, pt3);
        const angle = smoothAngle(rawAngle);

        drawAngleText(canvasCtx, angle, pt2, width, height);

        if (config.direction === 'decreasing') {
          // Bicep Curl, Pull-up, Sit-up, Crunch
          if (angle > config.startAngle) {
            stageRef.current = 'down';
            setFeedback(config.startMsg);
          }
          if (angle < config.endAngle && stageRef.current === 'down') {
            stageRef.current = 'up';
            repCountRef.current += 1;
            setRepCount(repCountRef.current);
            setFeedback(config.endMsg);
          }
        } else {
          // Squat, Push-up, Lateral Raise, Overhead Press
          // Good-GYM Squat logic: Standing (up_angle: 160) -> Squatting (down_angle: 110)
          // Direction is 'increasing' because up_angle (160) > down_angle (110)
          if (angle > config.endAngle) {
            stageRef.current = 'up';
            setFeedback(config.startMsg);
          }
          if (angle < config.startAngle && stageRef.current === 'up') {
            stageRef.current = 'down';
            repCountRef.current += 1;
            setRepCount(repCountRef.current);
            setFeedback(config.endMsg);
          }
        }
      }
    }
  };

  const drawAngleText = (ctx, angle, landmark, width, height) => {
    ctx.save();
    const x = width - (landmark.x * width);
    const y = landmark.y * height;
    ctx.fillStyle = '#00ffcc';
    ctx.font = 'bold 18px Arial';
    ctx.fillText(`${Math.round(angle)}°`, x + 15, y);
    ctx.restore();
  };

  const drawSkeleton = (ctx, landmarks, width, height) => {
    ctx.save();
    ctx.strokeStyle = '#00ffcc';
    ctx.lineWidth = 3;
    ctx.fillStyle = '#ff0055';

    const connections = [
      [11, 12], [11, 13], [13, 15], [12, 14], [14, 16],
      [11, 23], [12, 24], [23, 24],
      [23, 25], [25, 27], [24, 26], [26, 28]
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

    landmarks.forEach((lm, index) => {
      if (index > 10 && lm.visibility > 0.5) {
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
    stageRef.current = null;
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
      
      <div style={{ marginBottom: '15px', width: '100%', maxWidth: '400px' }}>
        <select
          value={exercise}
          onChange={(e) => setExercise(e.target.value)}
          style={{
            width: '100%',
            padding: '10px',
            borderRadius: '8px',
            border: '1px solid rgba(255,255,255,0.2)',
            background: '#312e81',
            color: 'white',
            fontSize: '1rem',
            cursor: 'pointer'
          }}
        >
          {Object.entries(EXERCISE_CONFIGS).map(([key, config]) => (
            <option key={key} value={key}>{config.label}</option>
          ))}
        </select>
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