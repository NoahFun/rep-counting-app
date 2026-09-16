# GymPulse (AI Fitness & Rep Counter)

GymPulse is an AI-powered fitness progress web application featuring real-time computer vision that automatically counts exercise reps across 8 movement types (Bicep Curls, Squats, Push-ups, Sit-ups, Lateral Raises, Pull-ups, Crunches, and Overhead Press) using angle-based joint trajectory tracking. 

For noisy environments or exercises where the camera is less ideal, it also includes an audio-based breathing detection feature as a camera-free alternative.

## Features
- **Computer Vision Rep Counting**: Uses Google MediaPipe Pose (running directly on the client-side via WebAssembly) to detect 33 anatomical body keypoints and calculate joint angles in real time.
- **Audio/Breathing Rep Counting**: A microphone-based fallback (using Web Audio API) that detects exertion (grunts or sharp exhales) with configurable sensitivity thresholds and cooldowns, perfect for when using AirPods with the screen off.
- **Automated Workout Analysis**: Evaluates logged sets against target schedule rules (weight, sets, reps) to assign performance outcomes (PASS/FAIL) and generate automated progressive overload recommendations.
- **Progress Dashboard**: Visualizes strength progression and completion rates over time using Chart.js.

## Tech Stack
- **Frontend**: React, Vite, Chart.js, HTML5 Canvas, Web Audio API
- **Backend**: FastAPI (Python)
- **Database**: Supabase (PostgreSQL)
- **AI/ML**: Google MediaPipe Pose

## Getting Started

### Backend Setup
1. Navigate to the root directory and activate the virtual environment:
   ```bash
   python -m venv venv
   source venv/Scripts/activate  # Windows
   ```
2. Install requirements:
   ```bash
   pip install -r requirements.txt
   ```
3. Set up your Supabase `.env` variables in the root directory:
   ```env
   SUPABASE_URL=your_url
   SUPABASE_KEY=your_key
   ```
4. Run the FastAPI server:
   ```bash
   python backend/app/main.py
   ```

### Frontend Setup
1. Navigate to the `frontend` directory:
   ```bash
   cd frontend
   ```
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```

## Architecture Notes
- The AI Pose estimation runs entirely on the client-side within the browser, ensuring user privacy (no video data is sent to the backend).
- The state machine uses a 5-frame moving average smoothing filter to prevent sensor noise from causing false rep counts.
