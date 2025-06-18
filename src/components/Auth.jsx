import React, { useState, useEffect } from 'react';
import { connectWebSocket, sendRequest, ws } from '../services/websocket';

// This component now perfectly matches the structure of your original index.html auth modal
function Auth({ onLoginSuccess }) {
  const [isLoginView, setIsLoginView] = useState(true);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    connectWebSocket(); // Ensure connection exists

    const handleAuthMessage = (event) => {
      const response = JSON.parse(event.data);
      switch (response.type) {
        case 'error':
          setError(response.message);
          break;
        case 'registerSuccess':
          setIsLoginView(true);
          setMessage(response.message);
          setUsername('');
          setPassword('');
          break;
        case 'loginSuccess':
          onLoginSuccess(response.user);
          break;
        default:
          break;
      }
    };

    if (ws) {
      ws.addEventListener('message', handleAuthMessage);
    }
    return () => {
      if (ws) ws.removeEventListener('message', handleAuthMessage);
    };
  }, [onLoginSuccess]);

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');
    setMessage('');

    if (!ws || ws.readyState !== WebSocket.OPEN) {
      setError('Connecting... Please try again.');
      connectWebSocket();
      return;
    }
    const type = isLoginView ? 'login' : 'register';
    sendRequest(type, { username, password });
  };

  const toggleView = (e) => {
    e.preventDefault();
    setIsLoginView(!isLoginView);
    setError('');
    setMessage('');
    setUsername('');
    setPassword('');
  };

  return (
    <div id="auth-container" className="modal-overlay">
      <div className="modal-content">
        <div id="login-view" className={isLoginView ? '' : 'hidden'}>
          <h2>Login</h2>
          <form id="login-form" onSubmit={handleSubmit}>
            <input type="text" id="login-username" placeholder="Username" required value={username} onChange={(e) => setUsername(e.target.value)} />
            <input type="password" id="login-password" placeholder="Password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="submit">Login</button>
          </form>
          <p className="form-switcher">Don't have an account? <a href="#" id="show-signup" onClick={toggleView}>Sign Up</a></p>
          <p id="login-error" className="error-text">{isLoginView ? (error || message) : ''}</p>
        </div>
        <div id="signup-view" className={isLoginView ? 'hidden' : ''}>
          <h2>Sign Up</h2>
          <form id="signup-form" onSubmit={handleSubmit}>
            <input type="text" id="signup-username" placeholder="Username" required value={username} onChange={(e) => setUsername(e.target.value)} />
            <input type="password" id="signup-password" placeholder="Password" required value={password} onChange={(e) => setPassword(e.target.value)} />
            <button type="submit">Create Account</button>
          </form>
          <p className="form-switcher">Already have an account? <a href="#" id="show-login" onClick={toggleView}>Log In</a></p>
          <p id="signup-error" className="error-text">{!isLoginView ? error : ''}</p>
        </div>
      </div>
    </div>
  );
}

export default Auth;
