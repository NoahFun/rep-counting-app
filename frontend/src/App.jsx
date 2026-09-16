import React, { useState, useEffect } from 'react';
import { fitnessApi } from './api/client';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import AICameraCounter from './AICameraCounter';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend
);

function App() {
  const [programs, setPrograms] = useState([]);
  const [selectedProgramId, setSelectedProgramId] = useState('');
  const [schedules, setSchedules] = useState([]);
  
  // Program Creation
  const [newProgramName, setNewProgramName] = useState('');
  
  // Schedule Creation
  const [newExercise, setNewExercise] = useState('');
  const [newWeek, setNewWeek] = useState(1);
  const [newWeight, setNewWeight] = useState('');
  const [newSets, setNewSets] = useState('');
  const [newReps, setNewReps] = useState('');

  // Workout Logging
  const [selectedScheduleId, setSelectedScheduleId] = useState('');
  const [logName, setLogName] = useState('');
  const [actualWeight, setActualWeight] = useState('');
  const [actualReps, setActualReps] = useState(''); 
  const [showCamera, setShowCamera] = useState(false);
  const [showQuickCounter, setShowQuickCounter] = useState(false);
  
  // Analysis & Dashboard
  const [analysisHistory, setAnalysisHistory] = useState([]);
  const [activeTab, setActiveTab] = useState('manage'); // 'manage' | 'dashboard'

  useEffect(() => {
    loadPrograms();
  }, []);

  useEffect(() => {
    if (selectedProgramId) {
      loadSchedules(selectedProgramId);
      loadDashboardData(selectedProgramId);
    } else {
      setSchedules([]);
      setAnalysisHistory([]);
    }
  }, [selectedProgramId]);

  const loadPrograms = async () => {
    try {
      const res = await fitnessApi.getPrograms();
      setPrograms(res.data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadSchedules = async (programId) => {
    try {
      const res = await fitnessApi.getSchedules(programId);
      setSchedules(res.data.data || []);
    } catch (err) {
      console.error(err);
    }
  };

  const loadDashboardData = async (programId) => {
    try {
      // First get schedules
      const schedRes = await fitnessApi.getSchedules(programId);
      const programSchedules = schedRes.data.data || [];
      
      // Then fetch analysis for all schedules to build dashboard
      let allLogs = [];
      for (const sched of programSchedules) {
        const analysisRes = await fitnessApi.getAnalysis(sched.id);
        if (analysisRes.data && analysisRes.data.history) {
          const historyWithExercise = analysisRes.data.history.map(h => ({
            ...h,
            exercise_name: sched.exercise_name,
            week: sched.week,
            target_weight: sched.target_weight
          }));
          allLogs = [...allLogs, ...historyWithExercise];
        }
      }
      // Sort by created_at desc
      allLogs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
      setAnalysisHistory(allLogs);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateProgram = async (e) => {
    e.preventDefault();
    if (!newProgramName.trim()) return;
    try {
      await fitnessApi.createProgram(newProgramName);
      setNewProgramName('');
      loadPrograms();
    } catch (err) {
      alert("Error creating program: " + err.message);
    }
  };

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    if (!selectedProgramId || !newExercise || !newWeight || !newSets || !newReps) {
      alert("Please fill in all schedule fields");
      return;
    }
    try {
      await fitnessApi.createSchedule({
        program_id: selectedProgramId,
        week: parseInt(newWeek),
        exercise_name: newExercise,
        target_weight: parseFloat(newWeight),
        target_sets: parseInt(newSets),
        target_reps: parseInt(newReps)
      });
      setNewExercise('');
      setNewWeight('');
      setNewSets('');
      setNewReps('');
      loadSchedules(selectedProgramId);
      alert("Schedule added successfully!");
    } catch (err) {
      alert("Error adding schedule: " + err.message);
    }
  };

  const handleLogWorkout = async (e) => {
    e.preventDefault();
    if (!selectedScheduleId || !actualWeight || !actualReps) {
      alert("Please fill in all layout fields");
      return;
    }
    
    const repsArray = actualReps.split(',').map(num => parseInt(num.trim(), 10)).filter(n => !isNaN(n));
    try {
      await fitnessApi.logWorkout({
        schedule_id: selectedScheduleId,
        log_name: logName || `Session ${new Date().toLocaleDateString()}`,
        actual_weight: parseFloat(actualWeight),
        actual_reps: repsArray
      });
      setActualWeight('');
      setActualReps('');
      setLogName('');
      loadDashboardData(selectedProgramId);
      setActiveTab('dashboard');
    } catch (err) {
      alert("Error saving log: " + err.message);
    }
  };

  const handleApplyCameraReps = (reps) => {
    setActualReps(prev => prev ? `${prev},${reps}` : `${reps}`);
    setShowCamera(false);
  };



  // --- Chart Data Preparation ---
  // Strength Progress Chart: Track weight over weeks for the first logged exercise (simplified for MVP)
  const strengthChartData = {
    labels: analysisHistory.map(log => `W${log.week} ${log.exercise_name}`).reverse(),
    datasets: [
      {
        label: 'Actual Weight Lifted (kg)',
        data: analysisHistory.map(log => log.target_weight).reverse(), // Using target_weight as approximation if actual isn't returned in analysis
        borderColor: '#4f46e5',
        backgroundColor: 'rgba(79, 70, 229, 0.5)',
        tension: 0.3,
      }
    ],
  };

  // Completion Rate Chart: Pass vs Fail
  const passedCount = analysisHistory.filter(log => log.status === 'PASS').length;
  const failedCount = analysisHistory.filter(log => log.status === 'FAIL').length;
  const completionChartData = {
    labels: ['PASSED', 'NOT READY'],
    datasets: [
      {
        label: 'Workout Sessions',
        data: [passedCount, failedCount],
        backgroundColor: ['rgba(16, 185, 129, 0.8)', 'rgba(239, 68, 68, 0.8)'],
        borderWidth: 0,
      }
    ],
  };

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: { position: 'top' },
    },
  };

  return (
    <div className="container animate-fade-in">
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 className="page-title">AI Fitness Progress Analyzer</h1>
        <p className="page-subtitle">Track targets, validate sets, and check progression readiness instantly.</p>
      </header>

      {/* Program Selector & Tabs */}
      <div className="card" style={{ marginBottom: '24px' }}>
        <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-end', flexWrap: 'wrap' }}>
          <div style={{ flex: 2, minWidth: '250px' }}>
            <label>Select Current Program</label>
            <select value={selectedProgramId} onChange={(e) => setSelectedProgramId(e.target.value)}>
              <option value="">-- Choose Plan --</option>
              {programs.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
          <div style={{ flex: 2, minWidth: '250px' }}>
            <label>Or Create New Program</label>
            <form onSubmit={handleCreateProgram} style={{ display: 'flex', gap: '8px' }}>
              <input 
                type="text" 
                placeholder="e.g., Hypertrophy Split" 
                value={newProgramName}
                onChange={(e) => setNewProgramName(e.target.value)}
                style={{ flex: 1 }}
              />
              <button type="submit" className="btn btn-primary" style={{ width: 'auto' }}>Create</button>
            </form>
          </div>
          <div style={{ flex: 2, minWidth: '300px', display: 'flex', gap: '8px', flexDirection: 'column' }}>
            <label>Quick AI Tools</label>
            <button 
              type="button" 
              className="btn" 
              style={{ width: '100%', background: '#818cf8', color: 'white', border: 'none', padding: '10px', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
              onClick={() => {
                setShowQuickCounter(!showQuickCounter);
                setShowCamera(false);
              }}
            >
              {showQuickCounter ? '❌ Close Camera' : '📷 Quick camera'}
            </button>
          </div>
        </div>

        {selectedProgramId && (
          <div style={{ display: 'flex', gap: '12px', marginTop: '24px', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <button 
              className={`btn ${activeTab === 'manage' ? 'btn-primary' : ''}`}
              style={{ width: 'auto', background: activeTab === 'manage' ? '' : 'var(--bg-secondary)', color: activeTab === 'manage' ? '' : 'var(--text-primary)' }}
              onClick={() => setActiveTab('manage')}
            >
              🏋️‍♂️ Manage & Log
            </button>
            <button 
              className={`btn ${activeTab === 'dashboard' ? 'btn-primary' : ''}`}
              style={{ width: 'auto', background: activeTab === 'dashboard' ? '' : 'var(--bg-secondary)', color: activeTab === 'dashboard' ? '' : 'var(--text-primary)' }}
              onClick={() => setActiveTab('dashboard')}
            >
              📊 Progress Dashboard
            </button>
          </div>
        )}
      </div>

      {showQuickCounter && (
        <div style={{ maxWidth: '450px', margin: '0 auto 24px auto' }} className="animate-fade-in">
          <AICameraCounter 
            onApplyCount={(count) => {
              alert(`Reps Counted: ${count}!\n\nTo save this, select a program below, and click the "Open AI Counter" inside your logging form to apply it to a log.`);
              setShowQuickCounter(false);
            }} 
            onClose={() => setShowQuickCounter(false)} 
          />
        </div>
      )}



      {selectedProgramId && activeTab === 'manage' && (
        <div className="grid-layout animate-fade-in">
          {/* LEFT PANEL: Setup Controls */}
          <div>
            <div className="card">
              <h3 className="card-title">Add Schedule Rule</h3>
              <form onSubmit={handleCreateSchedule}>
                <div className="input-group">
                  <label>Exercise Name</label>
                  <input type="text" placeholder="e.g., Bench Press" value={newExercise} onChange={(e) => setNewExercise(e.target.value)} />
                </div>
                <div className="input-group">
                  <label>Week Number</label>
                  <input type="number" min="1" value={newWeek} onChange={(e) => setNewWeek(e.target.value)} />
                </div>
                <div className="input-group">
                  <label>Target Weight (kg)</label>
                  <input type="number" step="0.5" placeholder="40" value={newWeight} onChange={(e) => setNewWeight(e.target.value)} />
                </div>
                <div style={{ display: 'flex', gap: '12px' }} className="input-group">
                  <div style={{ flex: 1 }}>
                    <label>Sets</label>
                    <input type="number" placeholder="5" value={newSets} onChange={(e) => setNewSets(e.target.value)} />
                  </div>
                  <div style={{ flex: 1 }}>
                    <label>Reps per Set</label>
                    <input type="number" placeholder="10" value={newReps} onChange={(e) => setNewReps(e.target.value)} />
                  </div>
                </div>
                <button type="submit" className="btn btn-primary">Add Schedule</button>
              </form>
            </div>
          </div>

          {/* RIGHT PANEL: Logging Form */}
          <div>
            {schedules.length === 0 ? (
              <div className="card">
                <p>No schedules found in this program. Add one to the left to start logging.</p>
              </div>
            ) : (
              <div className="card">
                <h3 className="card-title">Log Workout Session</h3>
                <form onSubmit={handleLogWorkout}>
                  <div className="input-group">
                    <label>Target Rule Block</label>
                    <select value={selectedScheduleId} onChange={(e) => setSelectedScheduleId(e.target.value)}>
                      <option value="">-- Choose Exercise Target --</option>
                      {schedules.map(s => (
                        <option key={s.id} value={s.id}>
                          Week {s.week}: {s.exercise_name} ({s.target_sets}x{s.target_reps} @ {s.target_weight}kg)
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="input-group">
                    <label>Session Title Tag (Optional)</label>
                    <input type="text" placeholder="e.g., Week 1 - Day 1 Session" value={logName} onChange={(e) => setLogName(e.target.value)} />
                  </div>
                  <div className="input-group">
                    <label>Actual Load Lifted (kg)</label>
                    <input type="number" step="0.5" placeholder="e.g., 40" value={actualWeight} onChange={(e) => setActualWeight(e.target.value)} />
                  </div>
                  <div className="input-group">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <label style={{ margin: 0 }}>Actual Performance Array (Reps per completed set, comma separated)</label>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button 
                          type="button" 
                          className="btn" 
                          style={{ width: 'auto', padding: '4px 8px', fontSize: '0.8rem', background: '#4f46e5', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                          onClick={() => { setShowCamera(!showCamera); }}
                        >
                          {showCamera ? '❌ Close Camera' : '📷 Open Camera'}
                        </button>
                      </div>
                    </div>
                    <input type="text" placeholder="e.g., 10,10,10,10,10" value={actualReps} onChange={(e) => setActualReps(e.target.value)} />
                  </div>
 
                  {showCamera && (
                    <AICameraCounter 
                      onApplyCount={handleApplyCameraReps} 
                      onClose={() => setShowCamera(false)} 
                    />
                  )}


                  <button type="submit" className="btn btn-success" style={{ marginTop: '10px' }}>Submit & Evaluate</button>
                </form>
              </div>
            )}
          </div>
        </div>
      )}

      {selectedProgramId && activeTab === 'dashboard' && (
        <div className="animate-fade-in">
          <div className="grid-layout" style={{ marginBottom: '24px' }}>
            <div className="card">
              <h3 className="card-title">Strength Progression</h3>
              {analysisHistory.length > 0 ? (
                <Line options={chartOptions} data={strengthChartData} />
              ) : (
                <p>No data to chart yet.</p>
              )}
            </div>
            <div className="card">
              <h3 className="card-title">Completion Rate</h3>
              {analysisHistory.length > 0 ? (
                <Bar options={chartOptions} data={completionChartData} />
              ) : (
                <p>No data to chart yet.</p>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="card-title">Weekly Overview & Feedback</h3>
            {analysisHistory.length === 0 ? (
              <p>No logs found. Go to the "Manage & Log" tab to record your first workout.</p>
            ) : (
              <div>
                {analysisHistory.map(log => (
                  <div key={log.id} className="log-item">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontWeight: '700' }}>{log.log_name} <span style={{ fontWeight: '400', fontSize: '0.9rem', marginLeft: '8px', opacity: 0.8 }}>W{log.week} {log.exercise_name}</span></span>
                      <span className={`badge ${log.status === 'PASS' ? 'badge-pass' : 'badge-fail'}`}>
                        {log.status === 'PASS' ? '🟢 PASSED' : '🔴 NOT READY'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.95rem', marginTop: '8px' }}>
                      <strong>💡 AI Recommendation:</strong> {log.recommendation}
                    </div>
                    <div style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: '8px' }}>
                      Logged: {new Date(log.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
}

export default App;