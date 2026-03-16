import React, { useState, useEffect } from 'react';
import {
  PanelLeftClose, PanelLeftOpen,
  LayoutList, LayoutDashboard, CalendarDays, GanttChart,
  Plus, X, LogOut, LogIn,
  Download, Settings, Sun, Moon,
  Trash2
} from 'lucide-react';

const PROJECT_COLORS = ['#0ea5e9', '#06b6d4', '#22c55e', '#f59e0b', '#ef4444', '#ec4899', '#f97316', '#8b5cf6'];

export default function Sidebar({ view, setView, projects, currentProject, setCurrentProject, onCreateProject, onDeleteProject, onExportCSV, user, onLogout, isOpen, onToggle, onOpenSettings }) {
  const [showNewProject, setShowNewProject] = useState(false);
  const [newProjectName, setNewProjectName] = useState('');
  const [newProjectColor, setNewProjectColor] = useState('#0ea5e9');
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
    <div className={`sidebar ${isOpen ? 'open' : 'closed'}`}>
      <div className="sidebar-header">
        {isOpen && <div className="sidebar-logo">TaskFlow</div>}
        {!isOpen && <div className="sidebar-logo-icon">T</div>}
        <button className="btn-icon sidebar-toggle" onClick={onToggle} aria-label="Toggle Sidebar" title="Toggle Sidebar (Cmd+\)">
          {isOpen ? <PanelLeftClose size={18} /> : <PanelLeftOpen size={18} />}
        </button>
      </div>
      <nav className="sidebar-nav">
        <button className={`nav-item ${view === 'board' ? 'active' : ''}`} onClick={() => { setCurrentProject(null); setView('board'); }} title="All Tasks">
          <span className="nav-icon"><LayoutList size={18} /></span>
          {isOpen && <span className="nav-text">All Tasks</span>}
        </button>
        <button className={`nav-item ${view === 'dashboard' ? 'active' : ''}`} onClick={() => setView('dashboard')} title="Overview">
          <span className="nav-icon"><LayoutDashboard size={18} /></span>
          {isOpen && <span className="nav-text">Overview</span>}
        </button>
        <button className={`nav-item ${view === 'calendar' ? 'active' : ''}`} onClick={() => setView('calendar')} title="Calendar">
          <span className="nav-icon"><CalendarDays size={18} /></span>
          {isOpen && <span className="nav-text">Calendar</span>}
        </button>
        <button className={`nav-item ${view === 'gantt' ? 'active' : ''}`} onClick={() => setView('gantt')} title="Timeline">
          <span className="nav-icon"><GanttChart size={18} /></span>
          {isOpen && <span className="nav-text">Timeline</span>}
        </button>

        <div className="nav-section-title">
          {isOpen ? 'Projects' : '---'}
          {isOpen && (
            <button
              className="btn-add-project"
              onClick={() => setShowNewProject(!showNewProject)}
              title="New project"
              aria-label={showNewProject ? 'Cancel new project' : 'Create new project'}
            >
              {showNewProject ? <X size={14} /> : <Plus size={14} />}
            </button>
          )}
        </div>

        {isOpen && showNewProject && (
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
              title={p.name}
            >
              <span className="project-dot" style={{ background: p.color }} />
              {isOpen && <span className="nav-item-text">{p.name}</span>}
              {isOpen && p.totalTasks > 0 && (
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
                <Trash2 size={14} />
              </button>
            )}
          </div>
        ))}
      </nav>

      <div className="sidebar-footer">
        {user ? (
          <div className="user-info">
            <div className="user-avatar">{user.username?.[0]?.toUpperCase() || '?'}</div>
            {isOpen && <span className="user-name">{user.username}</span>}
            {isOpen && <button className="btn-icon" onClick={onLogout} title="Sign out" aria-label="Sign out"><LogOut size={16} /></button>}
          </div>
        ) : (
          <div className="user-info guest">
            <div className="user-avatar guest" title="Sign in">G</div>
            {isOpen && <span className="user-name">Guest</span>}
            {isOpen && <button className="btn-icon" onClick={onLogout} title="Sign in" aria-label="Sign in to save your data"><LogIn size={16} /></button>}
          </div>
        )}
        <button className="theme-toggle" onClick={onExportCSV} aria-label="Export tasks to CSV" title="Export CSV">
          <span className="nav-icon"><Download size={18} /></span>
          {isOpen && <span className="nav-text">Export CSV</span>}
        </button>
        <button className="theme-toggle" onClick={onOpenSettings} aria-label="Settings" title="Settings">
          <span className="nav-icon"><Settings size={18} /></span>
          {isOpen && <span className="nav-text">Settings</span>}
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
          title={`Switch mode`}
        >
          <span className="nav-icon">{theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}</span>
          {isOpen && <span className="nav-text">{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>}
        </button>
        {isOpen && (
          <div className="sidebar-shortcut">
            <kbd>N</kbd> new · <kbd>/</kbd> search · <kbd>D</kbd> overview
          </div>
        )}
      </div>
    </div>
  );
}
