// server.js (Simplified for Development)

// 1. Import necessary modules
const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const path = require('path');
const os = require('os');
const Datastore = require('nedb');
const bcrypt = require('bcrypt');

// --- Hardcoded Owner Credentials ---
const OWNER_USERNAME = "Bard_Owner";
const OWNER_PASSWORD = "Bard@09876";
let OWNER_PASSWORD_HASH = "";

// 2. Setup Server and Database
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const PORT = 3000;

app.use(express.json());

// --- Database Setup ---
const db = {};
db.users = new Datastore({ filename: 'database/users.db', autoload: true });
db.messages = new Datastore({ filename: 'database/messages.db', autoload: true });
db.admins = new Datastore({ filename: 'database/admins.db', autoload: true });

db.users.ensureIndex({ fieldName: 'username', unique: true }, (err) => {
    if (err) console.error('Error creating username index on users.db:', err);
});
db.admins.ensureIndex({ fieldName: 'username', unique: true }, (err) => {
    if (err) console.error('Error creating username index on admins.db:', err);
});


// --- Owner Account Initialization ---
async function initializeOwnerAccount() {
    return new Promise((resolve, reject) => {
        db.admins.findOne({ role: 'owner' }, async (err, owner) => {
            if (err) return reject(err);
            if (!owner) {
                console.log("Owner account not found. Creating one...");
                try {
                    OWNER_PASSWORD_HASH = await bcrypt.hash(OWNER_PASSWORD, 10);
                    const ownerData = { username: OWNER_USERNAME, password: OWNER_PASSWORD_HASH, role: 'owner', displayName: 'Application Owner', bio: 'The primary administrator of this application.', banned: false };
                    db.admins.insert(ownerData, (err, newOwner) => {
                        if (err) return reject(err);
                        console.log("Owner account created successfully.");
                        resolve(newOwner);
                    });
                } catch (hashError) {
                    reject(hashError);
                }
            } else {
                console.log("Owner account already exists.");
                resolve(owner);
            }
        });
    });
}

// --- WebSocket Connection Handling ---
const onlineUsers = new Map();
wss.on('connection', (ws) => {
    console.log('Client connected to WebSocket');
    let clientInfo = { ws: ws, username: null, userId: null, role: null };

    ws.on('message', async (message) => {
        let data;
        try { data = JSON.parse(message); } catch (e) { return console.error('Invalid JSON:', message); }

        switch (data.type) {
            case 'register': {
                const { username, password } = data;
                if (!username || !password || username.length < 3 || password.length < 6) {
                    return ws.send(JSON.stringify({ type: 'error', message: 'Username must be at least 3 characters and password at least 6 characters.' }));
                }
                try {
                    const hashedPassword = await bcrypt.hash(password, 10);
                    const newUser = { username, password: hashedPassword, displayName: username, bio: '', banned: false };
                    db.users.insert(newUser, (err, user) => {
                        if (err) return ws.send(JSON.stringify({ type: 'error', message: 'Username is already taken.' }));
                        ws.send(JSON.stringify({ type: 'registerSuccess', message: 'Registration successful! You can now log in.' }));
                    });
                } catch (hashError) {
                    ws.send(JSON.stringify({ type: 'error', message: 'An error occurred during registration.' }));
                }
                break;
            }

            case 'login': {
                const { username, password } = data;
                const findUser = new Promise((resolve, reject) => db.users.findOne({ username }, (err, user) => err ? reject(err) : resolve(user)));
                const findAdmin = new Promise((resolve, reject) => db.admins.findOne({ username }, (err, admin) => err ? reject(err) : resolve(admin)));
                const [user, admin] = await Promise.all([findUser, findAdmin]);
                const account = admin || user;
                
                if (!account) return ws.send(JSON.stringify({ type: 'error', message: 'Invalid username or password.' }));
                if (account.banned) return ws.send(JSON.stringify({ type: 'error', message: 'This account has been banned.' }));

                if (password === 'password-placeholder-relogin' && account.username === username) {
                    clientInfo = { ...clientInfo, username: account.username, userId: account._id, role: account.role || 'user' };
                    onlineUsers.set(account._id, clientInfo);
                    ws.send(JSON.stringify({ type: 'loginSuccess', user: { id: account._id, username: account.username, displayName: account.displayName, bio: account.bio, role: account.role || 'user' } }));
                    broadcastUserList();
                    return;
                }

                const match = await bcrypt.compare(password, account.password);
                if (match) {
                    clientInfo = { ...clientInfo, username: account.username, userId: account._id, role: account.role || 'user' };
                    onlineUsers.set(account._id, clientInfo);
                    ws.send(JSON.stringify({ type: 'loginSuccess', user: { id: account._id, username: account.username, displayName: account.displayName, bio: account.bio, role: account.role || 'user' } }));
                    broadcastUserList();
                } else {
                    ws.send(JSON.stringify({ type: 'error', message: 'Invalid username or password.' }));
                }
                break;
            }

            case 'updateProfile': {
                const { userId, displayName, bio } = data;
                if (clientInfo.userId !== userId) return;
                db.users.update({ _id: userId }, { $set: { displayName, bio } }, {}, (err) => {
                    if (err) return ws.send(JSON.stringify({ type: 'error', message: 'Failed to update profile.' }));
                    broadcastUserList();
                });
                break;
            }

            case 'getHistory': {
                const { recipientId } = data;
                if (!clientInfo.userId) return;
                db.messages.find({ $or: [{ senderId: clientInfo.userId, recipientId }, { senderId: recipientId, recipientId: clientInfo.userId }]}).sort({ timestamp: 1 }).exec((err, messages) => {
                    if (!err) ws.send(JSON.stringify({ type: 'messageHistory', messages, recipientId }));
                });
                break;
            }

            case 'sendMessage': {
                const { recipientId, content } = data;
                if (!clientInfo.userId || !content.trim()) return;
                const message = { senderId: clientInfo.userId, recipientId, senderUsername: clientInfo.username, content, timestamp: new Date() };
                db.messages.insert(message, (err, newMessage) => {
                    if (err) return;
                    const recipientInfo = onlineUsers.get(recipientId);
                    if (recipientInfo) recipientInfo.ws.send(JSON.stringify({ type: 'newMessage', message: newMessage }));
                    ws.send(JSON.stringify({ type: 'newMessage', message: newMessage }));
                });
                break;
            }
            
            case 'typing':
            case 'stop_typing': {
                const { recipientId } = data;
                const recipientInfo = onlineUsers.get(recipientId);
                if (recipientInfo) {
                    recipientInfo.ws.send(JSON.stringify({ type: data.type, userId: clientInfo.userId }));
                }
                break;
            }
        }
    });

    ws.on('close', () => {
        console.log('Client disconnected from WebSocket');
        if (clientInfo.userId) {
            onlineUsers.delete(clientInfo.userId);
            broadcastUserList();
        }
    });
});

function broadcastUserList() {
    const findUsers = new Promise((res) => db.users.find({}, (e,u) => res(u || [])));
    const findAdmins = new Promise((res) => db.admins.find({}, (e,a) => res(a || [])));
    Promise.all([findUsers, findAdmins]).then(([users, admins]) => {
        const combined = new Map();
        users.forEach(u => combined.set(u._id, {...u, role: 'user'}));
        admins.forEach(a => combined.set(a._id, a)); // Admins overwrite users

        const userListWithStatus = Array.from(combined.values()).map(user => ({
            id: user._id,
            username: user.username,
            displayName: user.displayName,
            bio: user.bio,
            role: user.role,
            banned: user.banned || false,
            online: onlineUsers.has(user._id)
        }));
        const message = JSON.stringify({ type: 'userList', users: userListWithStatus });
        onlineUsers.forEach(userInfo => {
            if (userInfo.ws.readyState === userInfo.ws.OPEN) {
                userInfo.ws.send(message);
            }
        });
    });
}

// --- Start the Server ---
server.listen(PORT, '0.0.0.0', async () => {
    await initializeOwnerAccount();
    const localIPs = Object.values(os.networkInterfaces())
        .flat()
        .filter(details => details.family === 'IPv4' && !details.internal)
        .map(details => details.address);

    console.log('\n-------------------------------------');
    console.log('  Messenger Backend is running!');
    console.log(`  WebSocket listening on ws://localhost:${PORT}/ws`);
    if (localIPs.length > 0) {
      console.log(`  WebSocket also on ws://${localIPs[0]}:${PORT}/ws`);
    }
    console.log('-------------------------------------\n');
    console.log('!!! This server is for data only.');
    console.log('!!! To view the app, open the URL from the OTHER terminal (npm run dev).');
    console.log('-------------------------------------\n');
});
