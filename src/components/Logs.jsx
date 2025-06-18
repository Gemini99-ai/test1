import React, { useState, useEffect } from 'react';
import './Logs.css';

function Logs() {
  const [logs, setLogs] = useState([]);

  useEffect(() => {
    // Store original console functions
    const originalError = console.error;
    const originalWarn = console.warn;
    const originalLog = console.log;

    const addLog = (level, message) => {
      const newLog = {
        level,
        message: Array.isArray(message) ? message.join(' ') : String(message),
        timestamp: new Date().toLocaleTimeString()
      };
      setLogs(prevLogs => [newLog, ...prevLogs]);
    };

    // Override console functions
    console.error = (...args) => {
      addLog('error', args);
      originalError.apply(console, args);
    };
    console.warn = (...args) => {
      addLog('warn', args);
      originalWarn.apply(console, args);
    };
    console.log = (...args) => {
      addLog('log', args);
      originalLog.apply(console, args);
    };

    // Cleanup function to restore original console functions
    return () => {
      console.error = originalError;
      console.warn = originalWarn;
      console.log = originalLog;
    };
  }, []);

  return (
    <div className="logs-container">
      <div className="logs-header">
        <h1>Application Logs</h1>
        <button onClick={() => setLogs([])}>Clear Logs</button>
      </div>
      <ul className="logs-list">
        {logs.length === 0 ? (
            <li>No logs yet. Interact with the app to see messages.</li>
        ) : (
            logs.map((log, index) => (
            <li key={index} className={`log-entry ${log.level}`}>
                <strong>[{log.timestamp}] [{log.level.toUpperCase()}]:</strong> {log.message}
            </li>
            ))
        )}
      </ul>
    </div>
  );
}

export default Logs;
