const express = require('express');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const selfsigned = require('selfsigned');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

// Global in-memory user map
const users = new Map();

const USE_HTTPS = process.env.USE_HTTPS === 'true' || process.env.HTTPS === 'true';
let server;

if (USE_HTTPS) {
  const attrs = [{ name: 'commonName', value: 'OfficeTalk Local' }];
  const pkey = selfsigned.generate(attrs, { days: 365 });
  server = https.createServer({ key: pkey.private, cert: pkey.cert }, app);
} else {
  server = http.createServer(app);
}

const io = new Server(server, {
  cors: { origin: "*", methods: ["GET", "POST"] }
});

io.on('connection', (socket) => {
  socket.on('init-user', (userData) => {
    const newUser = {
      socketId: socket.id,
      name: userData.name || 'Colleague',
      color: userData.color || '#3b82f6',
      avatar: userData.avatar || '👤',
      isMuted: false,
      isDeafened: false,
      isTalking: false,
      talkMode: userData.talkMode || 'ptt'
    };

    users.set(socket.id, newUser);

    // Notify new user of self & all existing online users
    socket.emit('user-initialized', newUser);
    socket.emit('online-users', Array.from(users.values()));

    // Notify all existing users about the new connection
    socket.broadcast.emit('user-joined', newUser);
  });

  socket.on('signal', ({ targetSocketId, signalData }) => {
    const senderUser = users.get(socket.id);
    if (targetSocketId && senderUser) {
      io.to(targetSocketId).emit('signal', {
        fromSocketId: socket.id,
        senderUser,
        signalData
      });
    }
  });

  socket.on('update-state', (stateUpdate) => {
    const user = users.get(socket.id);
    if (!user) return;

    Object.assign(user, stateUpdate);

    io.emit('user-state-changed', {
      socketId: socket.id,
      state: {
        isMuted: user.isMuted,
        isDeafened: user.isDeafened,
        isTalking: user.isTalking,
        talkMode: user.talkMode
      }
    });
  });

  socket.on('send-message', ({ text }) => {
    const user = users.get(socket.id);
    if (!user) return;

    const messageObj = {
      id: Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      senderId: socket.id,
      senderName: user.name,
      senderColor: user.color,
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    io.emit('new-message', messageObj);
  });

  socket.on('disconnect', () => {
    users.delete(socket.id);
    io.emit('user-left', { socketId: socket.id });
  });
});

function getLocalIpAddresses() {
  const interfaces = os.networkInterfaces();
  const addresses = [];
  for (const k in interfaces) {
    for (const k2 in interfaces[k]) {
      const address = interfaces[k][k2];
      if (address.family === 'IPv4' && !address.internal) {
        addresses.push(address.address);
      }
    }
  }
  return addresses;
}

const PORT = process.env.PORT || 3000;
const protocol = USE_HTTPS ? 'https' : 'http';

server.listen(PORT, '0.0.0.0', () => {
  const ips = getLocalIpAddresses();
  console.log(`====================================================`);
  console.log(` 🎙️  OfficeTalk Direct Line Server is LIVE on ${protocol.toUpperCase()}!`);
  console.log(` 💻 Local Access:    ${protocol}://localhost:${PORT}`);
  ips.forEach(ip => {
    console.log(` 📱 Mobile / Network: ${protocol}://${ip}:${PORT}`);
  });
  console.log(`====================================================`);
});
