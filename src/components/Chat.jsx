import React, { useState, useEffect, useRef } from 'react';
import { sendRequest } from '../services/websocket';

function Chat({ currentUser, users, messages, typingUsers, onLogout }) {
    const [selectedUserId, setSelectedUserId] = useState(null);
    const [messageInput, setMessageInput] = useState('');
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [isEditingProfile, setIsEditingProfile] = useState(false);

    const [profileDisplayName, setProfileDisplayName] = useState(currentUser.displayName);
    const [profileBio, setProfileBio] = useState(currentUser.bio || '');

    const typingTimeoutRef = useRef(null);
    const messageListRef = useRef(null);

    useEffect(() => {
        if (messageListRef.current) {
            messageListRef.current.scrollTop = messageListRef.current.scrollHeight;
        }
    }, [messages, selectedUserId, typingUsers]);
    
    const handleSelectUser = (userId) => {
        setSelectedUserId(userId);
        if (!messages[userId]) {
            sendRequest('getHistory', { recipientId: userId });
        }
    };

    const handleSendMessage = (e) => {
        e.preventDefault();
        if (messageInput.trim() && selectedUserId) {
            sendRequest('sendMessage', { recipientId: selectedUserId, content: messageInput });
            setMessageInput('');
            clearTimeout(typingTimeoutRef.current);
            sendRequest('stop_typing', { recipientId: selectedUserId });
        }
    };

    const handleTyping = (e) => {
        setMessageInput(e.target.value);
        if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
        else sendRequest('typing', { recipientId: selectedUserId });
        
        typingTimeoutRef.current = setTimeout(() => {
            sendRequest('stop_typing', { recipientId: selectedUserId });
            typingTimeoutRef.current = null;
        }, 2000);
    };

    const handleProfileSave = (e) => {
        e.preventDefault();
        sendRequest('updateProfile', { userId: currentUser.id, displayName: profileDisplayName, bio: profileBio });
        setIsEditingProfile(false);
    };
    
    const selectedUser = users.find(u => u.id === selectedUserId);
    const sortedUsers = users.filter(u => u.id !== currentUser.id).sort((a, b) => b.online - a.online);

    return (
        <div id="app-container">
            <aside id="sidebar">
                <header className="sidebar-header">
                    <div className="header-content">
                        <h3>All Users</h3>
                        <p id="my-info">Logged in as: <span id="my-username">{currentUser.username}</span></p>
                    </div>
                    <button id="menu-button" className="icon-button" onClick={() => setIsMenuOpen(!isMenuOpen)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><path d="M12 3c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>
                    </button>
                </header>

                <div id="side-menu" className={isMenuOpen ? '' : 'hidden'}>
                    <div className="profile-section">
                        <div className="profile-header">
                            <span id="my-profile-display-name">{profileDisplayName}</span>
                            <span id="my-profile-username" className="username-tag">@{currentUser.username}</span>
                        </div>
                        <form id="profile-edit-form" className={isEditingProfile ? '' : 'hidden'} onSubmit={handleProfileSave}>
                            <input type="text" id="profile-display-name-input" placeholder="Display Name" value={profileDisplayName} onChange={e => setProfileDisplayName(e.target.value)} />
                            <textarea id="profile-bio-input" placeholder="Bio (max 100 chars)" maxLength="100" value={profileBio} onChange={e => setProfileBio(e.target.value)}></textarea>
                            <div className="form-actions">
                                <button type="button" id="profile-cancel-edit-button" className="secondary" onClick={() => setIsEditingProfile(false)}>Cancel</button>
                                <button type="submit" id="profile-save-button">Save</button>
                            </div>
                        </form>
                        <p id="my-profile-bio" className="profile-bio">{isEditingProfile ? '' : profileBio}</p>
                        <button id="edit-profile-button" className={`small-button ${isEditingProfile ? 'hidden' : ''}`} onClick={() => setIsEditingProfile(true)}>Edit Profile</button>
                    </div>

                    <ul className="menu-options">
                        <li id="logout-button" onClick={onLogout}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                            Logout
                        </li>
                    </ul>
                </div>
                
                <div id="user-list">
                    {sortedUsers.map(user => (
                        <div key={user.id} className={`user-item ${selectedUserId === user.id ? 'active' : ''}`} onClick={() => handleSelectUser(user.id)}>
                             <div className="user-details">
                                <span className="user-name">{user.displayName}</span>
                                {user.bio && <p className="user-bio-preview">{user.bio}</p>}
                            </div>
                            <div className="user-status">
                                {user.online && <div className="status-dot"></div>}
                                {user.online ? 'Online' : 'Offline'}
                            </div>
                        </div>
                    ))}
                </div>
            </aside>

            <main id="chat-area">
                 {!selectedUser ? (
                    <div id="welcome-screen" className="chat-content">
                        <div className="welcome-center"><h2>Select a user to start chatting</h2><p>Your one-on-one conversations will appear here.</p></div>
                    </div>
                ) : (
                    <div id="chat-view" className="chat-content">
                        <header id="chat-header">
                            <h2 id="recipient-name">{selectedUser.displayName}</h2>
                            <p id="recipient-bio">{selectedUser.bio}</p>
                        </header>
                        <div id="message-list" ref={messageListRef}>
                             {(messages[selectedUserId] || []).map((msg, index) => (
                                <div key={index} className={`message-bubble ${msg.senderId === currentUser.id ? 'sent' : 'received'}`}>
                                    <p className="message-content">{msg.content}</p>
                                    <span className="message-timestamp">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                            ))}
                            {typingUsers[selectedUserId] && (
                                <div id="typing-indicator" className="message-bubble received"><div className="typing-dots"><span></span><span></span><span></span></div></div>
                            )}
                        </div>
                        <form id="message-form" onSubmit={handleSendMessage}>
                            <input type="text" id="message-input" placeholder="Type a message..." autoComplete="off" required value={messageInput} onChange={handleTyping} />
                            <button type="submit">
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="24" height="24"><path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" /></svg>
                            </button>
                        </form>
                    </div>
                 )}
            </main>
        </div>
    );
}

export default Chat;

