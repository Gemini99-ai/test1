import React, { useState, useEffect, useCallback } from 'react';
import Auth from './components/Auth';
import Chat from './components/Chat';
import { connectWebSocket, disconnectWebSocket, sendRequest, ws } from './services/websocket';

function App() {
  const [currentUser, setCurrentUser] = useState(null);
  
  // Initialize state with empty arrays/objects to prevent crashes in child components
  const [users, setUsers] = useState([]);
  const [messages, setMessages] = useState({});
  const [typingUsers, setTypingUsers] = useState({});
  const [authError, setAuthError] = useState('');
  const [authMessage, setAuthMessage] = useState('');
  
  // This function handles all incoming WebSocket messages
  const handleWebSocketMessage = useCallback((event) => {
    const data = JSON.parse(event.data);
    switch (data.type) {
      case 'loginSuccess':
        setAuthError('');
        setAuthMessage('');
        localStorage.setItem('currentUser', JSON.stringify(data.user));
        setCurrentUser(data.user);
        break;
      case 'registerSuccess':
        setAuthError('');
        setAuthMessage(data.message);
        break;
      case 'error':
        setAuthMessage('');
        setAuthError(data.message);
        break;
      case 'userList':
        setUsers(data.users);
        break;
      case 'messageHistory':
        setMessages(prev => ({ ...prev, [data.recipientId]: data.messages }));
        break;
      case 'newMessage': {
        setTypingUsers(prev => ({ ...prev, [data.message.senderId]: false }));
        const chatPartnerId = data.message.senderId === (currentUser && currentUser.id) ? data.message.recipientId : data.message.senderId;
        setMessages(prev => ({ ...prev, [chatPartnerId]: [...(prev[chatPartnerId] || []), data.message] }));
        break;
      }
      case 'typing':
        setTypingUsers(prev => ({ ...prev, [data.userId]: true }));
        break;
      case 'stop_typing':
        setTypingUsers(prev => ({ ...prev, [data.userId]: false }));
        break;
      case 'forceLogout':
        alert(data.message);
        handleLogout();
        break;
      default:
        break;
    }
  }, [currentUser]);

  // This effect manages the WebSocket connection lifecycle
  useEffect(() => {
    const savedUser = localStorage.getItem('currentUser');
    if (savedUser) {
        setCurrentUser(JSON.parse(savedUser));
    }
  }, []);

  useEffect(() => {
    if (currentUser) {
      // If user is logged in, connect and set up listeners
      const wsInstance = connectWebSocket();
      wsInstance.onopen = () => {
        sendRequest('login', { username: currentUser.username, password: 'password-placeholder-relogin' });
      };
      // Make sure we have a fresh event listener
      wsInstance.removeEventListener('message', handleWebSocketMessage);
      wsInstance.addEventListener('message', handleWebSocketMessage);
    } else {
      // If user logs out, disconnect
      disconnectWebSocket();
    }
    // Cleanup function to remove the listener
    return () => {
        if(ws) ws.removeEventListener('message', handleWebSocketMessage);
    };
  }, [currentUser, handleWebSocketMessage]);

  const handleAuthRequest = (type, credentials) => {
    // Auth component just asks App to send a request
    const wsInstance = connectWebSocket(); // Ensure connection exists before sending
    
    const send = () => {
        // Clear previous messages before new request
        setAuthError('');
        setAuthMessage('');
        sendRequest(type, credentials);
    }

    if (wsInstance.readyState === WebSocket.OPEN) {
        send();
    } else {
        // Wait for connection to open before sending
        wsInstance.onopen = send;
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('currentUser');
  };

  return (
    <>
      {!currentUser ? (
        <Auth 
          onAuthRequest={handleAuthRequest} 
          error={authError}
          message={authMessage}
        />
      ) : (
        <Chat 
          currentUser={currentUser} 
          users={users}
          messages={messages}
          typingUsers={typingUsers}
          onLogout={handleLogout} 
        />
      )}
    </>
  );
}

export default App;
