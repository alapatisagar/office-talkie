const express = require('express');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const selfsigned = require('selfsigned');

const app = express();
app.use(express.static(path.join(__dirname, 'public')));

// Simple preset voice rooms
const defaultChannels = [
  { id: 'general', name: 'General Hall', description: 'Main lounge to talk with colleagues', icon: '📢' },
  { id: 'quick-sync', name: 'Quick Sync', description: 'Fast 2-minute check-ins', icon: '⚡' },
  { id: 'room-1', name: 'Room 1', description: 'Voice Room 1', icon: '💬' },
  { id: 'room-2', name: 'Room 2', description: 'Voice Room 2', icon: '💬' },
  { id: 'watercooler', name: 'Breakroom', description: 'Casual chat & coffee talk', icon: '☕' }
];

const channels = new Map(defaultChannels.map(c => [c.id, { ...c }]));
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
  socket.emit('channels-list', Array.from(channels.values()));

  socket.on('init-user', (userData) => {
    users.set(socket.id, {
      socketId: socket.id,
      name: userData.name || 'Colleague',
      color: userData.color || '#3b82f6',
      avatar: userData.avatar || '👤',
      currentRoom: null,
      isMuted: false,
      isDeafened: false,
      isTalking: false,
      talkMode: userData.talkMode || 'ptt'
    });
    
    socket.emit('user-initialized', users.get(socket.id));
    broadcastChannelsUpdate();
  });

  socket.on('join-room', ({ roomId }) => {
    const user = users.get(socket.id);
    if (!user) return;

    const channel = channels.get(roomId);
    if (!channel) return;

    if (user.currentRoom) {
      leaveCurrentRoom(socket);
    }

    socket.join(roomId);
    user.currentRoom = roomId;

    const roomUsers = Array.from(users.values()).filter(u => u.currentRoom === roomId && u.socketId !== socket.id);

    socket.emit('room-joined', {
      channel: { id: channel.id, name: channel.name, description: channel.description, icon: channel.icon },
      members: roomUsers
    });

    socket.to(roomId).emit('user-joined-room', user);
    broadcastChannelsUpdate();
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

    if (user.currentRoom) {
      io.to(user.currentRoom).emit('user-state-changed', {
        socketId: socket.id,
        state: {
          isMuted: user.isMuted,
          isDeafened: user.isDeafened,
          isTalking: user.isTalking,
          talkMode: user.talkMode
        }
      });
    }
  });

  socket.on('send-message', ({ text }) => {
    const user = users.get(socket.id);
    if (!user || !user.currentRoom) return;

    const messageObj = {
      id: Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      senderId: socket.id,
      senderName: user.name,
      senderColor: user.color,
      text: text.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    io.to(user.currentRoom).emit('new-message', messageObj);
  });

  socket.on('create-channel', ({ name, description, icon }) => {
    const channelId = 'custom-' + Date.now().toString(36);
    const newChannel = {
      id: channelId,
      name: name.trim(),
      description: description ? description.trim() : 'Voice Room',
      icon: icon || '💬'
    };

    channels.set(channelId, newChannel);
    broadcastChannelsUpdate();
    socket.emit('channel-created', { id: channelId });
  });

  socket.on('leave-room', () => {
    leaveCurrentRoom(socket);
  });

  socket.on('disconnect', () => {
    leaveCurrentRoom(socket);
    users.delete(socket.id);
    broadcastChannelsUpdate();
  });
});

function leaveCurrentRoom(socket) {
  const user = users.get(socket.id);
  if (!user || !user.currentRoom) return;

  const oldRoom = user.currentRoom;
  socket.leave(oldRoom);
  user.currentRoom = null;
  user.isTalking = false;

  socket.to(oldRoom).emit('user-left-room', { socketId: socket.id });
  broadcastChannelsUpdate();
}

function broadcastChannelsUpdate() {
  const channelList = Array.from(channels.values()).map(c => {
    const activeCount = Array.from(users.values()).filter(u => u.currentRoom === c.id).length;
    return {
      id: c.id,
      name: c.name,
      description: c.description,
      icon: c.icon,
      activeUserCount: activeCount
    };
  });
  io.emit('channels-list', channelList);
}

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
  console.log(` 🎙️  OfficeTalk Server is LIVE on ${protocol.toUpperCase()}!`);
  console.log(` 💻 Local Access:    ${protocol}://localhost:${PORT}`);
  ips.forEach(ip => {
    console.log(` 📱 Mobile / Network: ${protocol}://${ip}:${PORT}`);
  });
  console.log(`====================================================`);
});
