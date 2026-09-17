const express = require('express');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const fs = require('fs');
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
  maxHttpBufferSize: 1e7
});

// Global room lock state & pinned announcement
let isRoomLocked = false;
let pinnedAnnouncement = null;

function isSagarAlapati(name) {
  if (!name) return false;
  const clean = name.trim().toLowerCase();
  return clean.includes('sagar');
}

io.on('connection', (socket) => {
  // Ping latency handler
  socket.on('ping-check', (clientTimestamp) => {
    socket.emit('pong-check', clientTimestamp);
  });

  socket.on('init-user', (userData) => {
    const rawName = (userData.name || 'Colleague').trim();
    const isAdmin = isSagarAlapati(rawName);

    // Reject non-admin entry if room is locked
    if (isRoomLocked && !isAdmin) {
      socket.emit('room-locked-error', { message: 'The voice room is currently locked by the Admin.' });
      return;
    }

    const newUser = {
      socketId: socket.id,
      name: rawName,
      isAdmin: isAdmin,
      color: isAdmin ? '#f59e0b' : (userData.color || '#3b82f6'),
      avatar: isAdmin ? '👑' : (userData.avatar || '👤'),
      isMuted: false,
      isDeafened: false,
      isTalking: false,
      talkMode: userData.talkMode || 'ptt',
      presenceStatus: userData.presenceStatus || 'Available 🟢'
    };

    users.set(socket.id, newUser);

    socket.emit('user-initialized', newUser);
    socket.emit('online-users', Array.from(users.values()));
    if (pinnedAnnouncement) socket.emit('pinned-message-updated', pinnedAnnouncement);
    socket.emit('room-lock-changed', { isRoomLocked });
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

  // Multi-Target & Broadcast Ultra-Low Latency PCM Voice Stream Relay
  socket.on('voice-pcm', ({ targetSocketIds, pcmData }) => {
    const senderUser = users.get(socket.id);
    if (!senderUser || senderUser.isMuted) return;

    const payload = {
      fromSocketId: socket.id,
      senderName: senderUser.name,
      pcmData
    };

    if (!targetSocketIds || targetSocketIds === 'all' || (Array.isArray(targetSocketIds) && targetSocketIds.includes('all'))) {
      socket.broadcast.emit('voice-pcm', payload);
    } else if (Array.isArray(targetSocketIds)) {
      targetSocketIds.forEach(targetId => {
        io.to(targetId).emit('voice-pcm', payload);
      });
    } else if (typeof targetSocketIds === 'string') {
      io.to(targetSocketIds).emit('voice-pcm', payload);
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
        talkMode: user.talkMode,
        presenceStatus: user.presenceStatus
      }
    });
  });

  // Admin Remote Mute Individual User
  socket.on('admin-mute-user', ({ targetSocketId, muteState }) => {
    const senderUser = users.get(socket.id);
    if (!senderUser || !senderUser.isAdmin) return;

    const targetUser = users.get(targetSocketId);
    if (targetUser) {
      targetUser.isMuted = muteState;
      io.to(targetSocketId).emit('forced-mute-state', { isMuted: muteState });
      io.emit('user-state-changed', {
        socketId: targetSocketId,
        state: { isMuted: muteState }
      });
    }
  });

  // Admin Remote Mute / Unmute All
  socket.on('admin-mute-all', ({ muteState }) => {
    const senderUser = users.get(socket.id);
    if (!senderUser || !senderUser.isAdmin) return;

    users.forEach((u, sId) => {
      if (sId !== socket.id) {
        u.isMuted = muteState;
        io.to(sId).emit('forced-mute-state', { isMuted: muteState });
        io.emit('user-state-changed', {
          socketId: sId,
          state: { isMuted: muteState }
        });
      }
    });
  });

  // Admin Kick User
  socket.on('admin-kick-user', ({ targetSocketId }) => {
    const senderUser = users.get(socket.id);
    if (!senderUser || !senderUser.isAdmin) return;

    const targetUser = users.get(targetSocketId);
    if (targetUser) {
      io.to(targetSocketId).emit('kicked-by-admin', { reason: 'You were disconnected by the Admin.' });
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) targetSocket.disconnect(true);
      users.delete(targetSocketId);
      io.emit('user-left', { socketId: targetSocketId });
    }
  });

  // Admin Toggle Room Lock
  socket.on('admin-toggle-lock', () => {
    const senderUser = users.get(socket.id);
    if (!senderUser || !senderUser.isAdmin) return;

    isRoomLocked = !isRoomLocked;
    io.emit('room-lock-changed', { isRoomLocked });
  });

  // Admin Priority Broadcast Siren
  socket.on('admin-broadcast-siren', () => {
    const senderUser = users.get(socket.id);
    if (!senderUser || !senderUser.isAdmin) return;

    socket.broadcast.emit('play-admin-siren', { senderName: senderUser.name });
  });

  // Admin Real Sticker Asset Upload Handler
  socket.on('admin-upload-sticker', ({ packId, name, nameTe, category, keywords, fileName, fileData }) => {
    const senderUser = users.get(socket.id);
    if (!senderUser || !senderUser.isAdmin) return;

    try {
      const cleanPack = (packId || 'brahmanandam-classics').toLowerCase();
      const dirPath = path.join(__dirname, 'public', 'stickers', 'telugu-movie', cleanPack);
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }

      const safeFileName = fileName ? `${Date.now()}_${path.basename(fileName)}` : `${Date.now()}.webp`;
      const filePath = path.join(dirPath, safeFileName);
      const base64Data = fileData.replace(/^data:image\/\w+;base64,/, '');
      fs.writeFileSync(filePath, Buffer.from(base64Data, 'base64'));

      const relativeUrl = `/stickers/telugu-movie/${cleanPack}/${safeFileName}`;
      const newStickerObj = {
        id: `${cleanPack}_${Date.now()}`,
        packId: cleanPack,
        name: name || 'Custom Sticker',
        nameTe: nameTe || '',
        category: category || 'comedy',
        keywords: Array.isArray(keywords) ? keywords : (keywords || '').split(',').map(k => k.trim()),
        image: relativeUrl,
        sourceType: 'user-provided'
      };

      io.emit('new-sticker-uploaded', newStickerObj);
    } catch (err) {
      console.error('Failed to save uploaded sticker asset:', err);
    }
  });

  // Team Chat Messages & Attachments
  socket.on('send-message', ({ text, sticker, gifUrl, gifTitle, reactionSticker, fileData, voiceMemo }) => {
    const user = users.get(socket.id);
    if (!user) return;

    const messageObj = {
      id: Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      senderId: socket.id,
      senderName: user.name,
      senderColor: user.color,
      isAdmin: user.isAdmin,
      text: text ? text.trim() : '',
      sticker: sticker || null,
      gifUrl: gifUrl || null,
      gifTitle: gifTitle || null,
      reactionSticker: reactionSticker || null,
      fileData: fileData || null,
      voiceMemo: voiceMemo || null,
      reactions: {},
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    io.emit('new-message', messageObj);
  });

  // Message Reaction
  socket.on('add-reaction', ({ messageId, emoji }) => {
    const user = users.get(socket.id);
    if (!user) return;

    io.emit('reaction-updated', { messageId, emoji, userName: user.name });
  });

  // Pin Announcement
  socket.on('pin-message', ({ text }) => {
    const senderUser = users.get(socket.id);
    if (!senderUser || !senderUser.isAdmin) return;

    pinnedAnnouncement = text ? { text, pinnedBy: senderUser.name } : null;
    io.emit('pinned-message-updated', pinnedAnnouncement);
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
  console.log(` 🎙️  OfficeTalk Multi-Target Voice Server is LIVE on ${protocol.toUpperCase()}!`);
  console.log(` 💻 Local Access:    ${protocol}://localhost:${PORT}`);
  ips.forEach(ip => {
    console.log(` 📱 Mobile / Network: ${protocol}://${ip}:${PORT}`);
  });
  console.log(`====================================================`);
});
