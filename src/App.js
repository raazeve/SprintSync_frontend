// App.js
import React, { useState, useEffect } from 'react';
import axios from 'axios';
import './App.css';

// Set up axios defaults
axios.defaults.baseURL = process.env.REACT_APP_API_URL || 'http://localhost:8000';
axios.interceptors.request.use(config => {
  const token = localStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

function App() {
  const [tasks, setTasks] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState(null);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [loading, setLoading] = useState(false);
  const [user, setUser] = useState(null);

  // Fetch tasks on component mount
  useEffect(() => {
    fetchTasks();
    // Check if user is logged in
    const token = localStorage.getItem('accessToken');
    if (token) {
      fetchUserProfile();
    }
  }, []);

  const fetchTasks = async () => {
    try {
      const response = await axios.get('/tasks/tasks/');
      setTasks(response.data.results || response.data);
    } catch (error) {
      console.error('Error fetching tasks:', error);
    }
  };

  const fetchUserProfile = async () => {
    try {
      // Assuming you have a user profile endpoint
      const response = await axios.get('/users/users/1/');
      setUser(response.data);
    } catch (error) {
      console.error('Error fetching user profile:', error);
    }
  };

  const handleLogin = async (credentials) => {
    try {
      const response = await axios.post('users/auth/token/', credentials);
      localStorage.setItem('accessToken', response.data.access);
      localStorage.setItem('refreshToken', response.data.refresh);
      await fetchUserProfile();
      await fetchTasks();
    } catch (error) {
      console.error('Login error:', error);
      alert('Login failed. Please check your credentials.');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
    setUser(null);
    setTasks([]);
  };

  const handleStatusChange = async (taskId, newStatus) => {
    try {
      await axios.patch(`/tasks/${taskId}/status/`, { status: newStatus });
      // Update local state
      setTasks(tasks.map(task => 
        task.id === taskId ? { ...task, status: newStatus } : task
      ));
    } catch (error) {
      console.error('Error updating task status:', error);
    }
  };

  const handleSaveTask = async (taskData) => {
    try {
      if (editingTask) {
        await axios.put(`/tasks/tasks/${editingTask.id}/`, taskData);
      } else {
        await axios.post('/tasks/tasks/', taskData);
      }
      setShowModal(false);
      setEditingTask(null);
      fetchTasks(); // Refresh the task list
    } catch (error) {
      console.error('Error saving task:', error);
    }
  };

  const handleDeleteTask = async (taskId) => {
    if (window.confirm('Are you sure you want to delete this task?')) {
      try {
        await axios.delete(`/tasks/tasks/${taskId}/`);
        fetchTasks(); // Refresh the task list
      } catch (error) {
        console.error('Error deleting task:', error);
      }
    }
  };

  const handleAiSuggestion = async () => {
    setLoading(true);
    try {
      const response = await axios.post('/tasks/ai/daily_plan/');
      setAiSuggestion(response.data);
    } catch (error) {
      console.error('Error fetching AI suggestion:', error);
      setAiSuggestion({
        plan: "Could not generate plan. Please try again later.",
        estimated_hours: 0
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <div className="app">
      <header className="app-header">
        <h1>SprintSync</h1>
        <div className="user-info">
          <span>Welcome, {user.username}</span>
          <button onClick={handleLogout} className="logout-btn">Logout</button>
        </div>
      </header>

      <div className="container">
        <div className="controls">
          <button 
            onClick={() => setShowModal(true)}
            className="btn btn-primary"
          >
            + New Task
          </button>
          <button 
            onClick={handleAiSuggestion}
            className="btn btn-secondary"
            disabled={loading}
          >
            {loading ? 'Generating...' : 'Get Daily Plan'}
          </button>
        </div>

        {aiSuggestion && (
          <div className="ai-suggestion">
            <h3>Your Daily Plan</h3>
            <div className="suggestion-content">
              <p>{aiSuggestion.plan}</p>
              <p className="estimated-time">
                Estimated time: {aiSuggestion.estimated_hours} hours
              </p>
            </div>
            <button 
              onClick={() => setAiSuggestion(null)}
              className="close-suggestion"
            >
              ×
            </button>
          </div>
        )}

        <div className="tasks-container">
          <h2>Your Tasks</h2>
          {tasks.length === 0 ? (
            <p className="no-tasks">No tasks yet. Create your first task!</p>
          ) : (
            <div className="tasks-list">
              {tasks.map(task => (
                <TaskItem 
                  key={task.id}
                  task={task}
                  onStatusChange={handleStatusChange}
                  onEdit={() => {
                    setEditingTask(task);
                    setShowModal(true);
                  }}
                  onDelete={() => handleDeleteTask(task.id)}
                />
              ))}
            </div>
          )}
        </div>

        {showModal && (
          <TaskModal
            task={editingTask}
            onSave={handleSaveTask}
            onClose={() => {
              setShowModal(false);
              setEditingTask(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

// Task Item Component
const TaskItem = ({ task, onStatusChange, onEdit, onDelete }) => {
  const statusOptions = [
    { value: 'TO_DO', label: 'To Do', color: '#ffbe0b' },
    { value: 'IN_PROGRESS', label: 'In Progress', color: '#3a86ff' },
    { value: 'DONE', label: 'Done', color: '#06d6a0' }
  ];

  const getStatusInfo = (statusValue) => {
    return statusOptions.find(option => option.value === statusValue) || statusOptions[0];
  };

  const currentStatus = getStatusInfo(task.status);

  return (
    <div className="task-item">
      <div className="task-content">
        <h3>{task.title}</h3>
        <p>{task.description}</p>
        <div className="task-meta">
          <span className="time-estimate">{task.total_minutes} minutes</span>
          <span 
            className="status-badge"
            style={{ backgroundColor: currentStatus.color }}
          >
            {currentStatus.label}
          </span>
        </div>
      </div>
      
      <div className="task-actions">
        <select
          value={task.status}
          onChange={(e) => onStatusChange(task.id, e.target.value)}
          className="status-select"
          style={{ borderLeft: `4px solid ${currentStatus.color}` }}
        >
          {statusOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        
        <div className="action-buttons">
          <button onClick={onEdit} className="icon-btn" title="Edit">
            ✏️
          </button>
          <button onClick={onDelete} className="icon-btn delete" title="Delete">
            🗑️
          </button>
        </div>
      </div>
    </div>
  );
};

// Task Modal Component
const TaskModal = ({ task, onSave, onClose }) => {
  const [title, setTitle] = useState(task?.title || '');
  const [description, setDescription] = useState(task?.description || '');
  const [status, setStatus] = useState(task?.status || 'TO_DO');
  const [totalMinutes, setTotalMinutes] = useState(task?.total_minutes || 0);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSave({
      title,
      description,
      status,
      total_minutes: parseInt(totalMinutes)
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>{task ? 'Edit Task' : 'Create New Task'}</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="title">Title</label>
            <input
              type="text"
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows="4"
            />
          </div>
          
          <div className="form-group">
            <label htmlFor="status">Status</label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
            >
              <option value="TO_DO">To Do</option>
              <option value="IN_PROGRESS">In Progress</option>
              <option value="DONE">Done</option>
            </select>
          </div>
          
          <div className="form-group">
            <label htmlFor="totalMinutes">Time Estimate (minutes)</label>
            <input
              type="number"
              id="totalMinutes"
              value={totalMinutes}
              onChange={(e) => setTotalMinutes(e.target.value)}
              min="0"
            />
          </div>
          
          <div className="form-actions">
            <button type="button" onClick={onClose} className="btn btn-secondary">
              Cancel
            </button>
            <button type="submit" className="btn btn-primary">
              {task ? 'Update' : 'Create'} Task
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

// Login Form Component
const LoginForm = ({ onLogin }) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onLogin({ username, password });
  };

  return (
    <div className="login-container">
      <div className="login-form">
        <h1>SprintSync Login</h1>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label htmlFor="username">Username</label>
            <input
              type="text"
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>
          <div className="form-group">
            <label htmlFor="password">Password</label>
            <input
              type="password"
              id="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>
          <button type="submit" className="btn btn-primary">Login</button>
        </form>
      </div>
    </div>
  );
};

export default App;