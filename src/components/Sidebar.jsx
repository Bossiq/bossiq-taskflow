import React, { useState, useEffect } from 'react';

const PROJECT_COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#f97316'];

export default function Sidebar({ view, setView, projects, currentProject, setCurrentProject, onCreateProject, onDeleteProject, onExportCSV }) {
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('#6366f1');
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('taskflow-theme');
    return saved || 'dark';
  });

  // Apply saved theme on mount
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
  }, []);

  const handleCreateProject = (e) => {
    e.preventDefault();
    if (!newProjectName.trim()) return;
    onCreateProject?.({ name: newProjectName.trim(), color: newProjectColor });
    setNewProjectName('');
    setShowNewProject(false);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-header">
        <div className="sidebar-logo">⚡ TaskFlow</div>
      </div>
      <nav className="sidebar-nav">
        <button
          className={`nav-item ${!currentProject && view !== 'dashboard' ? 'active' : ''}`}
          onClick={() => { setCurrentProject(null); setView('board'); }}
        >
          📋 All Tasks
        </button>
        <button
          className={`nav-item ${view === 'dashboard' ? 'active' : ''}`}
          onClick={() => setView('dashboard')}
        >
          📊 Dashboard
        </button>

        <div className="nav-section-title">
          Projects
          <button
            className="btn-add-project"
            onClick={() => setShowNewProject(!showNewProject)}
            title="New project"
          >
            {showNewProject ? '×' : '+'}
          </button>
        </div>

        {showNewProject && (
          <form className="new-project-form" onSubmit={handleCreateProject}>
            <input
              className="form-input form-input-sm"
              placeholder="Project name..."
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              autoFocus
            />
            <div className="color-picker-row">
              {PROJECT_COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  className={`color-dot ${newProjectColor === c ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => setNewProjectColor(c)}
                />
              ))}
            </div>
            <button type="submit" className="btn btn-primary btn-sm" style={{ width: '100%' }}>
              Create
            </button>
          </form>
        )}

        {projects.map(p => (
          <div key={p.id} className="nav-item-row">
            <button
              className={`nav-item ${currentProject === p.id ? 'active' : ''}`}
              onClick={() => { setCurrentProject(p.id); setView('board'); }}
            >
              <span className="project-dot" style={{ background: p.color }} />
              <span className="nav-item-text">{p.name}</span>
              {p.totalTasks > 0 && (
                <span className="nav-badge">{p.totalTasks}</span>
              )}
            </button>
            {projects.length > 1 && (
              <button
                className="btn-icon btn-delete-project"
                onClick={(e) => { e.stopPropagation(); onDeleteProject?.(p); }}
                title={`Delete ${p.name}`}
                aria-label={`Delete project ${p.name}`}
              >
                🗑
              </button>
            )}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        <button className="theme-toggle" onClick={onExportCSV} aria-label="Export tasks to CSV">
          📥 Export CSV
        </button>
        <button
          className="theme-toggle"
          onClick={() => {
            const next = theme === 'dark' ? 'light' : 'dark';
            setTheme(next);
            document.documentElement.setAttribute('data-theme', next);
            localStorage.setItem('taskflow-theme', next);
          }}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
        >
          {theme === 'dark' ? '☀️ Light Mode' : '🌙 Dark Mode'}
        </button>
        <div className="sidebar-shortcut">
          <kbd>N</kbd> new · <kbd>/</kbd> search · <kbd>D</kbd> dashboard
        </div>
      </div>
    </div>
  );
}
