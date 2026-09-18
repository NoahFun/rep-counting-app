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

  // Analysis & Dashboard
  const [analysisHistory, setAnalysisHistory] = useState([]);

  // Mobile tab navigation: 'counter' | 'log' | 'plan' | 'progress'
  const [activeTab, setActiveTab] = useState('counter');

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
      const schedRes = await fitnessApi.getSchedules(programId);
      const programSchedules = schedRes.data.data || [];
      const results = await Promise.all(
        programSchedules.map(sched => fitnessApi.getAnalysis(sched.id).then(res => ({
          sched,
          history: res.data?.history || []
        })))
      );
      let allLogs = [];
      for (const { sched, history } of results) {
        const tagged = history.map(h => ({
          ...h,
          exercise_name: sched.exercise_name,
          week: sched.week,
          target_weight: sched.target_weight
        }));
        allLogs = [...allLogs, ...tagged];
      }
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
      alert('Error creating program: ' + err.message);
    }
  };

  const handleCreateSchedule = async (e) => {
    e.preventDefault();
    if (!selectedProgramId || !newExercise || !newWeight || !newSets || !newReps) {
      alert('Please fill in all schedule fields');
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
      alert('Schedule added!');
    } catch (err) {
      alert('Error adding schedule: ' + err.message);
    }
  };

  const handleLogWorkout = async (e) => {
    e.preventDefault();
    if (!selectedScheduleId || !actualWeight || !actualReps) {
      alert('Please fill in all fields');
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
      setActiveTab('progress');
    } catch (err) {
      alert('Error saving log: ' + err.message);
    }
  };

  const handleApplyCameraReps = (reps) => {
    setActualReps(prev => prev ? `${prev},${reps}` : `${reps}`);
    setShowCamera(false);
  };

  // Chart data
  const strengthChartData = {
    labels: analysisHistory.map(log => `W${log.week} ${log.exercise_name}`).reverse(),
    datasets: [{
      label: 'Weight (kg)',
      data: analysisHistory.map(log => log.actual_weight ?? log.target_weight).reverse(),
      borderColor: '#6366f1',
      backgroundColor: 'rgba(99,102,241,0.2)',
      tension: 0.4,
    }],
  };

  const passedCount = analysisHistory.filter(log => log.status === 'PASS').length;
  const failedCount = analysisHistory.filter(log => log.status === 'FAIL').length;
  const completionChartData = {
    labels: ['PASSED', 'NOT READY'],
    datasets: [{
      label: 'Sessions',
      data: [passedCount, failedCount],
      backgroundColor: ['rgba(16,185,129,0.8)', 'rgba(239,68,68,0.8)'],
      borderWidth: 0,
    }],
  };

  const chartOptions = {
    responsive: true,
    plugins: { legend: { position: 'top' } },
  };

  return (
    <div className="app-shell">

      {/* ── Sticky Top Header ── */}
      <header className="app-header">
        <div className="app-header-title">💪 GymPulse</div>
        <div className="app-header-subtitle">AI-Powered Rep Counter & Progress Tracker</div>
      </header>

      {/* ── Scrollable Page Content ── */}
      <main className="app-content animate-fade-in">

        {/* ══════════════════════════════
            TAB: COUNTER (AI Camera)
        ══════════════════════════════ */}
        {activeTab === 'counter' && (
          <div>
            <p className="section-label">AI Rep Counter</p>
            <AICameraCounter
              onApplyCount={(count) => {
                setActualReps(prev => prev ? `${prev},${count}` : `${count}`);
                alert(`✅ ${count} reps saved! Go to the Log tab to submit your session.`);
              }}
              onClose={() => {}}
            />
          </div>
        )}

        {/* ══════════════════════════════
            TAB: LOG WORKOUT
        ══════════════════════════════ */}
        {activeTab === 'log' && (
          <div>
            {/* Program picker */}
            <p className="section-label">Program</p>
            <div className="card">
              <div className="input-group" style={{ marginBottom: 8 }}>
                <label>Select Program</label>
                <select value={selectedProgramId} onChange={(e) => setSelectedProgramId(e.target.value)}>
                  <option value="">-- Choose Program --</option>
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <form onSubmit={handleCreateProgram} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="New program name…"
                  value={newProgramName}
                  onChange={(e) => setNewProgramName(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '0 16px' }}>
                  Add
                </button>
              </form>
            </div>

            {/* Log workout form */}
            {selectedProgramId && (
              <>
                <p className="section-label">Log Session</p>
                {schedules.length === 0 ? (
                  <div className="card">
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                      No schedules yet. Go to Plan tab to add one.
                    </p>
                  </div>
                ) : (
                  <div className="card">
                    <form onSubmit={handleLogWorkout}>
                      <div className="input-group">
                        <label>Exercise Target</label>
                        <select value={selectedScheduleId} onChange={(e) => setSelectedScheduleId(e.target.value)}>
                          <option value="">-- Choose Target --</option>
                          {schedules.map(s => (
                            <option key={s.id} value={s.id}>
                              W{s.week}: {s.exercise_name} ({s.target_sets}×{s.target_reps} @ {s.target_weight}kg)
                            </option>
                          ))}
                        </select>
                      </div>
                      <div className="input-group">
                        <label>Session Name (optional)</label>
                        <input type="text" placeholder="e.g., Day 1 Morning" value={logName} onChange={(e) => setLogName(e.target.value)} />
                      </div>
                      <div className="input-group">
                        <label>Weight Lifted (kg)</label>
                        <input type="number" step="0.5" placeholder="e.g., 40" value={actualWeight} onChange={(e) => setActualWeight(e.target.value)} />
                      </div>
                      <div className="input-group">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <label style={{ margin: 0 }}>Reps per Set (comma separated)</label>
                          <button
                            type="button"
                            className="btn btn-sm"
                            style={{ background: '#6366f1', color: 'white' }}
                            onClick={() => setActiveTab('counter')}
                          >
                            📷 Count
                          </button>
                        </div>
                        <input
                          type="text"
                          placeholder="e.g., 10,10,8"
                          value={actualReps}
                          onChange={(e) => setActualReps(e.target.value)}
                        />
                      </div>
                      <button type="submit" className="btn btn-success">Submit & Evaluate</button>
                    </form>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════
            TAB: PLAN (Schedule Builder)
        ══════════════════════════════ */}
        {activeTab === 'plan' && (
          <div>
            {/* Program picker */}
            <p className="section-label">Program</p>
            <div className="card">
              <div className="input-group" style={{ marginBottom: 8 }}>
                <label>Active Program</label>
                <select value={selectedProgramId} onChange={(e) => setSelectedProgramId(e.target.value)}>
                  <option value="">-- Choose Program --</option>
                  {programs.map(p => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
              <form onSubmit={handleCreateProgram} style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  placeholder="New program name…"
                  value={newProgramName}
                  onChange={(e) => setNewProgramName(e.target.value)}
                  style={{ flex: 1 }}
                />
                <button type="submit" className="btn btn-primary" style={{ width: 'auto', padding: '0 16px' }}>
                  Add
                </button>
              </form>
            </div>

            {selectedProgramId && (
              <>
                <p className="section-label">Add Schedule Rule</p>
                <div className="card">
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
                    <div style={{ display: 'flex', gap: '10px' }} className="input-group">
                      <div style={{ flex: 1 }}>
                        <label>Sets</label>
                        <input type="number" placeholder="5" value={newSets} onChange={(e) => setNewSets(e.target.value)} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label>Reps/Set</label>
                        <input type="number" placeholder="10" value={newReps} onChange={(e) => setNewReps(e.target.value)} />
                      </div>
                    </div>
                    <button type="submit" className="btn btn-primary">Add Schedule</button>
                  </form>
                </div>

                {schedules.length > 0 && (
                  <>
                    <p className="section-label">Current Schedule</p>
                    {schedules.map(s => (
                      <div key={s.id} className="log-item">
                        <div style={{ fontWeight: 700, marginBottom: 2 }}>{s.exercise_name}</div>
                        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                          Week {s.week} · {s.target_sets}×{s.target_reps} @ {s.target_weight}kg
                        </div>
                      </div>
                    ))}
                  </>
                )}
              </>
            )}
          </div>
        )}

        {/* ══════════════════════════════
            TAB: PROGRESS (Dashboard)
        ══════════════════════════════ */}
        {activeTab === 'progress' && (
          <div>
            {!selectedProgramId ? (
              <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>📊</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  Select a program from the Log or Plan tab to see your progress.
                </p>
              </div>
            ) : analysisHistory.length === 0 ? (
              <div className="card" style={{ textAlign: 'center', padding: '32px 16px' }}>
                <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🏋️</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                  No logs yet. Log your first session to see your progress here!
                </p>
              </div>
            ) : (
              <>
                <p className="section-label">Strength Progression</p>
                <div className="card">
                  <Line options={chartOptions} data={strengthChartData} />
                </div>

                <p className="section-label">Completion Rate</p>
                <div className="card">
                  <Bar options={chartOptions} data={completionChartData} />
                </div>

                <p className="section-label">Session History</p>
                {analysisHistory.map(log => (
                  <div key={log.id} className="log-item">
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{log.log_name}</div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                          W{log.week} · {log.exercise_name}
                        </div>
                      </div>
                      <span className={`badge ${log.status === 'PASS' ? 'badge-pass' : 'badge-fail'}`}>
                        {log.status === 'PASS' ? '✅ PASS' : '❌ NOT READY'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', marginTop: 10, color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                      💡 {log.recommendation}
                    </div>
                    <div style={{ fontSize: '0.72rem', opacity: 0.5, marginTop: 6 }}>
                      {new Date(log.created_at).toLocaleDateString()}
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        )}

      </main>

      {/* ── Fixed Bottom Tab Bar ── */}
      <nav className="tab-bar">
        <button className={`tab-btn ${activeTab === 'counter' ? 'active' : ''}`} onClick={() => setActiveTab('counter')}>
          <span className="tab-btn-icon">📷</span>
          Counter
        </button>
        <button className={`tab-btn ${activeTab === 'log' ? 'active' : ''}`} onClick={() => setActiveTab('log')}>
          <span className="tab-btn-icon">✍️</span>
          Log
        </button>
        <button className={`tab-btn ${activeTab === 'plan' ? 'active' : ''}`} onClick={() => setActiveTab('plan')}>
          <span className="tab-btn-icon">📋</span>
          Plan
        </button>
        <button className={`tab-btn ${activeTab === 'progress' ? 'active' : ''}`} onClick={() => setActiveTab('progress')}>
          <span className="tab-btn-icon">📊</span>
          Progress
        </button>
      </nav>

    </div>
  );
}

export default App;