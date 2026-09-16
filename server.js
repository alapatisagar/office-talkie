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
  cors: { origin: "*", methods: ["GET", "POST"] },
  maxHttpBufferSize: 1e7 // 10 MB for seamless high-speed audio chunk relay
});

function isSagarAlapati(name) {
  if (!name) return false;
  const clean = name.trim().toLowerCase();
  return clean.includes('sagar');
}

io.on('connection', (socket) => {
  socket.on('init-user', (userData) => {
    const rawName = (userData.name || 'Colleague').trim();
    const isAdmin = isSagarAlapati(rawName);

    const newUser = {
      socketId: socket.id,
      name: rawName,
      isAdmin: isAdmin,
      color: isAdmin ? '#f59e0b' : (userData.color || '#3b82f6'),
      avatar: isAdmin ? '👑' : (userData.avatar || '👤'),
      isMuted: false,
      isDeafened: false,
      isTalking: false,
      talkTargetId: 'all',
      talkMode: userData.talkMode || 'ptt'
    };

    users.set(socket.id, newUser);

    socket.emit('user-initialized', newUser);
    socket.emit('online-users', Array.from(users.values()));
    socket.broadcast.emit('user-joined', newUser);
  });

  // WebRTC Signaling Relay
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

  // WebSocket High-Speed Voice Chunk Relay (Guaranteed Fallback for Mobile 4G/5G CGNAT & Firewalls)
  socket.on('voice-chunk', ({ targetSocketId, audioChunk, mimeType }) => {
    const senderUser = users.get(socket.id);
    if (!senderUser || senderUser.isMuted) return;

    if (targetSocketId === 'all') {
      socket.broadcast.emit('voice-chunk', {
        fromSocketId: socket.id,
        senderName: senderUser.name,
        audioChunk,
        mimeType
      });
    } else if (targetSocketId) {
      io.to(targetSocketId).emit('voice-chunk', {
        fromSocketId: socket.id,
        senderName: senderUser.name,
        audioChunk,
        mimeType
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
        talkTargetId: user.talkTargetId,
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
      isAdmin: user.isAdmin,
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
  console.log(` 🎙️  OfficeTalk Dual Voice Engine Server is LIVE on ${protocol.toUpperCase()}!`);
  console.log(` 💻 Local Access:    ${protocol}://localhost:${PORT}`);
  ips.forEach(ip => {
    console.log(` 📱 Mobile / Network: ${protocol}://${ip}:${PORT}`);
  });
  console.log(`====================================================`);
});
