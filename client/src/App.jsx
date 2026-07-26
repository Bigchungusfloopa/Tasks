import React, { useEffect, useMemo, useState } from 'react';
import {
  CalendarClock,
  Check,
  Circle,
  ClipboardList,
  Loader2,
  Pencil,
  Plus,
  Search,
  Trash2,
  X
} from 'lucide-react';
import backgroundUrl from './assets/glass-bg.png';

const apiUrl = import.meta.env.VITE_API_URL || '/api';
const filters = ['all', 'active', 'completed'];

function toDateTimeLocal(value) {
  if (!value) {
    return '';
  }

  const date = new Date(value);
  const offsetMs = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function formatDueAt(value) {
  if (!value) {
    return 'No end time';
  }

  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit'
  }).format(new Date(value));
}

function dueTone(todo) {
  if (!todo.dueAt || todo.completed) {
    return '';
  }

  const due = new Date(todo.dueAt);
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);

  if (due < now) {
    return 'overdue';
  }

  if (due.toDateString() === now.toDateString()) {
    return 'today';
  }

  if (due <= tomorrow) {
    return 'soon';
  }

  return '';
}

function App() {
  const [todos, setTodos] = useState([]);
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [draft, setDraft] = useState({ title: '', notes: '', dueAt: '' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    document.documentElement.style.setProperty('--app-bg', `url(${backgroundUrl})`);
    fetchTodos();
  }, []);

  async function request(path, options) {
    const response = await fetch(`${apiUrl}${path}`, {
      headers: { 'Content-Type': 'application/json' },
      ...options
    });

    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message || 'Request failed.');
    }

    if (response.status === 204) {
      return null;
    }

    return response.json();
  }

  async function fetchTodos() {
    try {
      setLoading(true);
      setError('');
      setTodos(await request('/todos'));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function addTodo(event) {
    event.preventDefault();

    if (!title.trim()) {
      return;
    }

    try {
      setSaving(true);
      setError('');
      const todo = await request('/todos', {
        method: 'POST',
        body: JSON.stringify({ title, notes, dueAt })
      });
      setTodos((current) => [todo, ...current]);
      setTitle('');
      setNotes('');
      setDueAt('');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function toggleTodo(todo) {
    try {
      const updated = await request(`/todos/${todo.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ completed: !todo.completed })
      });
      setTodos((current) => current.map((item) => (item.id === todo.id ? updated : item)));
    } catch (err) {
      setError(err.message);
    }
  }

  async function saveEdit(todoId) {
    if (!draft.title.trim()) {
      return;
    }

    try {
      const updated = await request(`/todos/${todoId}`, {
        method: 'PATCH',
        body: JSON.stringify(draft)
      });
      setTodos((current) => current.map((item) => (item.id === todoId ? updated : item)));
      setEditingId(null);
    } catch (err) {
      setError(err.message);
    }
  }

  async function deleteTodo(todoId) {
    try {
      await request(`/todos/${todoId}`, { method: 'DELETE' });
      setTodos((current) => current.filter((todo) => todo.id !== todoId));
    } catch (err) {
      setError(err.message);
    }
  }

  const stats = useMemo(() => {
    const completed = todos.filter((todo) => todo.completed).length;
    return {
      total: todos.length,
      completed,
      active: todos.length - completed
    };
  }, [todos]);

  const visibleTodos = useMemo(() => {
    return todos.filter((todo) => {
      const matchesFilter =
        filter === 'all' ||
        (filter === 'active' && !todo.completed) ||
        (filter === 'completed' && todo.completed);
      const haystack = `${todo.title} ${todo.notes} ${formatDueAt(todo.dueAt)}`.toLowerCase();
      return matchesFilter && haystack.includes(query.toLowerCase());
    });
  }, [filter, query, todos]);

  return (
    <main className="app-shell">
      <section className="workspace" aria-label="Tasks todo application">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <ClipboardList size={27} />
            </span>
            <div>
              <h1>Tasks</h1>
              <p>{stats.active} active</p>
            </div>
          </div>
          <div className="stats" aria-label="Task summary">
            <span>{stats.total} total</span>
            <span>{stats.completed} done</span>
          </div>
        </header>

        <form className="composer" onSubmit={addTodo}>
          <div className="field title-field">
            <input
              aria-label="Task title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Add a task"
              maxLength={120}
            />
          </div>
          <div className="field">
            <textarea
              aria-label="Task notes"
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Notes"
              rows="2"
              maxLength={280}
            />
          </div>
          <label className="field datetime-field">
            <CalendarClock size={18} />
            <input
              aria-label="Task end time"
              type="datetime-local"
              value={dueAt}
              onChange={(event) => setDueAt(event.target.value)}
            />
          </label>
          <button className="primary-button" type="submit" disabled={!title.trim() || saving}>
            {saving ? <Loader2 className="spin" size={18} /> : <Plus size={18} />}
            <span>Add</span>
          </button>
        </form>

        <div className="controls">
          <label className="search">
            <Search size={18} />
            <input
              aria-label="Search tasks"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search"
            />
          </label>
          <div className="segments" aria-label="Filter tasks">
            {filters.map((item) => (
              <button
                key={item}
                type="button"
                className={filter === item ? 'selected' : ''}
                onClick={() => setFilter(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="error" role="alert">
            {error}
          </div>
        )}

        <section className="task-list" aria-live="polite">
          {loading && (
            <div className="empty-state">
              <Loader2 className="spin" />
            </div>
          )}

          {!loading &&
            visibleTodos.map((todo) => {
              const isEditing = editingId === todo.id;

              return (
                <article
                  className={`task ${todo.completed ? 'completed' : ''} ${dueTone(todo)}`}
                  key={todo.id}
                >
                  <button
                    className="icon-button complete"
                    type="button"
                    onClick={() => toggleTodo(todo)}
                    aria-label={todo.completed ? 'Mark active' : 'Mark complete'}
                    title={todo.completed ? 'Mark active' : 'Mark complete'}
                  >
                    {todo.completed ? <Check size={20} /> : <Circle size={20} />}
                  </button>

                  <div className="task-content">
                    {isEditing ? (
                      <div className="edit-fields">
                        <input
                          aria-label="Edit title"
                          value={draft.title}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, title: event.target.value }))
                          }
                        />
                        <textarea
                          aria-label="Edit notes"
                          value={draft.notes}
                          onChange={(event) =>
                            setDraft((current) => ({ ...current, notes: event.target.value }))
                          }
                          rows="2"
                        />
                        <label className="datetime-field edit-time">
                          <CalendarClock size={18} />
                          <input
                            aria-label="Edit end time"
                            type="datetime-local"
                            value={draft.dueAt}
                            onChange={(event) =>
                              setDraft((current) => ({ ...current, dueAt: event.target.value }))
                            }
                          />
                        </label>
                      </div>
                    ) : (
                      <>
                        <h2>{todo.title}</h2>
                        {todo.notes && <p>{todo.notes}</p>}
                        <div className="task-meta">
                          <CalendarClock size={16} />
                          <span>{formatDueAt(todo.dueAt)}</span>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="task-actions">
                    {isEditing ? (
                      <>
                        <button
                          className="icon-button"
                          type="button"
                          onClick={() => saveEdit(todo.id)}
                          aria-label="Save task"
                          title="Save task"
                        >
                          <Check size={18} />
                        </button>
                        <button
                          className="icon-button"
                          type="button"
                          onClick={() => setEditingId(null)}
                          aria-label="Cancel edit"
                          title="Cancel edit"
                        >
                          <X size={18} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          className="icon-button"
                          type="button"
                          onClick={() => {
                            setEditingId(todo.id);
                            setDraft({
                              title: todo.title,
                              notes: todo.notes,
                              dueAt: toDateTimeLocal(todo.dueAt)
                            });
                          }}
                          aria-label="Edit task"
                          title="Edit task"
                        >
                          <Pencil size={18} />
                        </button>
                        <button
                          className="icon-button danger"
                          type="button"
                          onClick={() => deleteTodo(todo.id)}
                          aria-label="Delete task"
                          title="Delete task"
                        >
                          <Trash2 size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </article>
              );
            })}

          {!loading && visibleTodos.length === 0 && (
            <div className="empty-state">
              <ClipboardList size={42} />
              <h2>No tasks here</h2>
              <p>Adjust the filter or add a new task.</p>
            </div>
          )}
        </section>
      </section>
    </main>
  );
}

export default App;
