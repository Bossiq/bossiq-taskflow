import React, { useState, useEffect, useCallback, useRef } from 'react';
import Sidebar from './components/Sidebar.jsx';
import Board from './components/Board.jsx';
import Dashboard from './components/Dashboard.jsx';
import Calendar from './components/Calendar.jsx';
import TaskModal from './components/TaskModal.jsx';
import ConfirmDialog from './components/ConfirmDialog.jsx';
import Toast from './components/Toast.jsx';
import AuthPage from './components/AuthPage.jsx';

const API = '/api';

/**
 * App — Main application shell.
 *
 * Manages global state, API communication, routing between views,
 * toast notifications, confirmation dialogs, and keyboard shortcuts.
 */
export default function App() {
  const [view, setView] = useState('board');
  const [tasks, setTasks] = useState([]);
  const [projects, setProjects] = useState([]);
  const [currentProject, setCurrentProject] = useState(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [modalTask, setModalTask] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [confirmDialog, setConfirmDialog] = useState(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [apiError, setApiError] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [authResolved, setAuthResolved] = useState(false);
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(null);
  const [coldStartMsg, setColdStartMsg] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const toastIdRef = useRef(0);

  // ── Auth helpers ──
  const getHeaders = useCallback(() => {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }, [token]);

  // Check saved auth on mount
  useEffect(() => {
    const savedToken = localStorage.getItem('taskflow-token');
    const savedUser = localStorage.getItem('taskflow-user');
    const skippedAuth = localStorage.getItem('taskflow-skipped');
    if (savedToken && savedUser) {
      try {
        setUser(JSON.parse(savedUser));
        setToken(savedToken);
        setAuthResolved(true);
      } catch { /* ignore */ }
    } else if (skippedAuth) {
      setAuthResolved(true);
    }
    setAuthChecked(true);
  }, []);

  const handleAuth = (u, t) => {
    setUser(u);
    setToken(t);
    setAuthResolved(true);
    if (!u && !t) {
      // "Continue without account" — remember the choice
      localStorage.setItem('taskflow-skipped', '1');
    } else {
      // Real login — clear skip flag
      localStorage.removeItem('taskflow-skipped');
    }
  };

  const handleLogout = () => {
    setUser(null);
    setToken(null);
    setAuthResolved(false);
    setTasks([]);
    setProjects([]);
    localStorage.removeItem('taskflow-token');
    localStorage.removeItem('taskflow-user');
    localStorage.removeItem('taskflow-skipped');
  };

  // ── Search debounce (300ms) ──
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  // ── Toast management ──
  const addToast = useCallback((message, type = 'success') => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
  }, []);

  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // ── Data fetching ──
  const fetchTasks = useCallback(async () => {
    try {
      const params = new URLSearchParams();
      if (currentProject) params.set('project_id', currentProject);
      if (debouncedSearch) params.set('search', debouncedSearch);
      const res = await fetch(`${API}/tasks?${params}`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch tasks');
      const data = await res.json();
      if (Array.isArray(data)) setTasks(data);
      setApiError(false);
    } catch (err) {
      console.error('fetchTasks:', err);
      setApiError(true);
    }
  }, [currentProject, debouncedSearch, getHeaders]);

  const fetchProjects = useCallback(async () => {
    try {
      const res = await fetch(`${API}/projects`, { headers: getHeaders() });
      if (!res.ok) throw new Error('Failed to fetch projects');
      const data = await res.json();
      if (Array.isArray(data)) setProjects(data);
      setApiError(false);
    } catch (err) {
      console.error('fetchProjects:', err);
      setApiError(true);
    }
  }, [getHeaders]);

  // Initial load (after auth check)
  useEffect(() => {
    if (authChecked) {
      Promise.all([fetchTasks(), fetchProjects()]).finally(() => setLoading(false));
    }
  }, [authChecked]);

  // Auto-retry on API error (cold start) every 5s, up to 6 attempts
  useEffect(() => {
    if (apiError && retryCount < 6) {
      const timer = setTimeout(() => {
        setRetryCount(c => c + 1);
        Promise.all([fetchTasks(), fetchProjects()]).then(() => setApiError(false));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [apiError, retryCount]);

  // Dynamic document title
  useEffect(() => {
    const count = tasks.length;
    document.title = count > 0 ? `(${count}) TaskFlow` : 'TaskFlow — Task Tracker';
  }, [tasks.length]);

  // Re-fetch on dependency changes (not initial)
  useEffect(() => {
    if (!loading) fetchTasks();
  }, [fetchTasks]);

  const triggerRefresh = () => {
    fetchTasks();
    fetchProjects();
    setRefreshKey(k => k + 1);
  };

  // ── Task CRUD ──
  const handleSaveTask = async (form) => {
    try {
      const method = form.id ? 'PUT' : 'POST';
      const url = form.id ? `${API}/tasks/${form.id}` : `${API}/tasks`;
      const body = { ...form, project_id: currentProject || 1 };
      const res = await fetch(url, {
        method, headers: getHeaders(), body: JSON.stringify(body)
      });
      if (!res.ok) {
        const data = await res.json();
        addToast(data.error || 'Failed to save task', 'error');
        return;
      }
      setShowModal(false);
      setModalTask(null);
      triggerRefresh();
      addToast(form.id ? 'Task updated' : 'Task created');
    } catch {
      addToast('Network error — is the server running?', 'error');
    }
  };

  const handleDeleteRequest = (task) => {
    setConfirmDialog({
      title: 'Delete Task',
      message: `Are you sure you want to delete "${task.title}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        try {
          await fetch(`${API}/tasks/${task.id}`, { method: 'DELETE', headers: getHeaders() });
          triggerRefresh();
          addToast('Task deleted');
        } catch {
          addToast('Failed to delete task', 'error');
        }
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  const handleMove = async (id, status) => {
    try {
      await fetch(`${API}/tasks/${id}/move`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify({ status })
      });
      if (status === 'done') {
        addToast('🎉 Task completed!');
        spawnConfetti();
      }
      triggerRefresh();
    } catch {
      addToast('Failed to move task', 'error');
    }
  };

  /** Spawn confetti particles on task completion */
  const spawnConfetti = () => {
    const colors = ['#6366f1', '#22c55e', '#fbbf24', '#fb7185', '#a5b4fc', '#f472b6'];
    const container = document.createElement('div');
    container.className = 'confetti-container';
    document.body.appendChild(container);
    for (let i = 0; i < 30; i++) {
      const particle = document.createElement('div');
      particle.className = 'confetti-particle';
      particle.style.setProperty('--x', `${(Math.random() - 0.5) * 600}px`);
      particle.style.setProperty('--y', `${-Math.random() * 500 - 100}px`);
      particle.style.setProperty('--r', `${Math.random() * 720 - 360}deg`);
      particle.style.setProperty('--d', `${0.6 + Math.random() * 0.6}s`);
      particle.style.background = colors[Math.floor(Math.random() * colors.length)];
      particle.style.left = `${40 + Math.random() * 20}%`;
      particle.style.top = '60%';
      container.appendChild(particle);
    }
    setTimeout(() => container.remove(), 1500);
  };

  // ── Project creation ──
  const handleCreateProject = async ({ name, color }) => {
    try {
      const res = await fetch(`${API}/projects`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify({ name, color })
      });
      if (!res.ok) {
        const data = await res.json();
        addToast(data.error || 'Failed to create project', 'error');
        return;
      }
      const project = await res.json();
      fetchProjects();
      setCurrentProject(project.id);
      addToast(`Project "${name}" created`);
    } catch {
      addToast('Network error', 'error');
    }
  };

  // ── Project deletion ──
  const handleDeleteProject = (project) => {
    setConfirmDialog({
      title: 'Delete Project',
      message: `Delete "${project.name}" and reassign its tasks? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'danger',
      onConfirm: async () => {
        try {
          const res = await fetch(`${API}/projects/${project.id}`, { method: 'DELETE', headers: getHeaders() });
          if (!res.ok) {
            const data = await res.json();
            addToast(data.error || 'Failed to delete project', 'error');
          } else {
            if (currentProject === project.id) setCurrentProject(null);
            triggerRefresh();
            addToast(`Project "${project.name}" deleted`);
          }
        } catch {
          addToast('Network error', 'error');
        }
        setConfirmDialog(null);
      },
      onCancel: () => setConfirmDialog(null)
    });
  };

  // ── Export to CSV ──
  const handleExportCSV = () => {
    if (tasks.length === 0) { addToast('No tasks to export', 'info'); return; }
    const headers = ['Title', 'Description', 'Status', 'Priority', 'Label', 'Due Date', 'Created'];
    const rows = tasks.map(t => [
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${(t.description || '').replace(/"/g, '""')}"`,
      t.status, t.priority, t.label || '', t.due_date || '', t.created_at || ''
    ]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `taskflow-export-${new Date().toISOString().slice(0,10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    addToast(`Exported ${tasks.length} tasks to CSV`);
  };

  const openEdit = (task) => { setModalTask(task); setShowModal(true); };
  const openNew = () => { setModalTask(null); setShowModal(true); };

  // ── Keyboard shortcuts ──
  useEffect(() => {
    const handler = (e) => {
      if (showModal || confirmDialog) return;
      const tag = document.activeElement.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'n' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        openNew();
      }
      if (e.key === '/' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        document.getElementById('search-input')?.focus();
      }
      if (e.key === 'd' && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        setView(v => v === 'dashboard' ? 'board' : 'dashboard');
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [showModal, confirmDialog]);

  // ── Cold-start notification (shows after 3s of loading) ──
  useEffect(() => {
    if (loading) {
      const timer = setTimeout(() => setColdStartMsg(true), 3000);
      return () => clearTimeout(timer);
    }
    setColdStartMsg(false);
  }, [loading]);

  // ── Auth gate ──
  if (!authChecked) return null;
  if (!authResolved) {
    return <AuthPage onAuth={handleAuth} />;
  }

  if (loading) {
    return (
      <div className="app-loading" role="status" aria-label="Loading application">
        <div className="skeleton-board">
          {['To Do', 'In Progress', 'Done'].map(col => (
            <div key={col} className="skeleton-column">
              <div className="skeleton-header" />
              <div className="skeleton-card" />
              <div className="skeleton-card short" />
            </div>
          ))}
        </div>
        <p className="loading-text">Loading TaskFlow...</p>
        {coldStartMsg && (
          <div className="cold-start-notice">
            <span>☕</span>
            <p>The server is waking up — this usually takes 15-30 seconds on the first visit. Hang tight!</p>
          </div>
        )}
      </div>
    );
  }

  // ── API error state ──
  if (apiError && tasks.length === 0 && projects.length === 0) {
    return (
      <div className="app-loading" role="alert">
        <span style={{ fontSize: '2.5rem' }}>⚡</span>
        <h2>Waking up the server…</h2>
        <p style={{ maxWidth: 400, textAlign: 'center', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          Our free-tier backend spins down after inactivity. It usually restarts in 15-30 seconds.
        </p>
        {retryCount > 0 && retryCount < 6 && (
          <p style={{ color: 'var(--accent)', fontSize: '0.9rem', marginTop: 10 }}>
            Auto-retrying... (Attempt {retryCount}/5)
          </p>
        )}
        {retryCount >= 6 && (
          <p style={{ color: 'var(--danger)', fontSize: '0.9rem', marginTop: 10 }}>
            Still no response. The server might be down.
          </p>
        )}
        <button className="btn btn-primary" onClick={() => { setApiError(false); setRetryCount(0); setLoading(true); Promise.all([fetchTasks(), fetchProjects()]).finally(() => setLoading(false)); }} style={{ marginTop: 20 }}>
          ⟳ Try Again
        </button>
      </div>
    );
  }

  const currentProjectObj = projects.find(p => p.id === currentProject);
  const pageTitle = view === 'dashboard'
    ? '📊 Dashboard'
    : currentProject
      ? (currentProjectObj?.name || 'Tasks')
      : 'All Tasks';
  const taskCount = tasks.length;

  return (
    <div className="app">
      <Sidebar
        view={view} setView={setView}
        projects={projects}
        currentProject={currentProject}
        setCurrentProject={setCurrentProject}
        onCreateProject={handleCreateProject}
        onDeleteProject={handleDeleteProject}
        onExportCSV={handleExportCSV}
        user={user}
        onLogout={handleLogout}
      />
      <main className="main-content" id="main-content">
        <div className="top-bar">
          <h1>{pageTitle} {view === 'board' && <span className="header-count">{taskCount}</span>}</h1>
          <div className="search-box">
            <span aria-hidden="true">🔍</span>
            <input
              id="search-input"
              placeholder="Search tasks..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search tasks"
            />
            {search && (
              <button className="btn-icon" onClick={() => setSearch('')} aria-label="Clear search" style={{ width: 24, height: 24 }}>×</button>
            )}
          </div>
          {view === 'board' && (
            <button id="new-task-btn" className="btn btn-primary" onClick={openNew}>+ New Task</button>
          )}
        </div>

        {view === 'board' ? (
          <Board tasks={tasks} onEdit={openEdit} onDelete={handleDeleteRequest} onMove={handleMove} onBatchAction={triggerRefresh} addToast={addToast} getHeaders={getHeaders} />
        ) : view === 'calendar' ? (
          <Calendar tasks={tasks} onEdit={openEdit} />
        ) : (
          <Dashboard refreshKey={refreshKey} getHeaders={getHeaders} />
        )}
      </main>

      {showModal && (
        <TaskModal
          task={modalTask}
          onSave={handleSaveTask}
          onClose={() => { setShowModal(false); setModalTask(null); }}
          getHeaders={getHeaders}
        />
      )}

      {confirmDialog && (
        <ConfirmDialog {...confirmDialog} />
      )}

      <div className="toast-container" aria-live="polite">
        {toasts.map(t => (
          <Toast key={t.id} message={t.message} type={t.type} onClose={() => removeToast(t.id)} />
        ))}
      </div>
    </div>
  );
}
