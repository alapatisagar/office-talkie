const express = require('express');
const http = require('http');
const https = require('https');
const { Server } = require('socket.io');
const path = require('path');
const os = require('os');
const fs = require('fs');
const selfsigned = require('selfsigned');

const compression = require('compression');

const app = express();

// Enable Gzip/Brotli compression for HTML, CSS, JS, JSON & SVGs
app.use(compression({
  threshold: 256
}));

app.use(express.json({ limit: '5mb' }));
app.use(express.urlencoded({ extended: true, limit: '5mb' }));

// Health check / Keep-alive route for Render and Uptime monitors
app.get('/healthz', (req, res) => res.status(200).send('OK'));
app.get('/ping-health', (req, res) => res.status(200).json({ status: 'ok', uptime: process.uptime() }));

// Multilingual Translation Cache & Endpoints for Meeting Notes (Telugu, Hindi, English)
const translationCache = new Map();

function decodeHtmlEntities(str) {
  if (!str || typeof str !== 'string') return str;
  return str
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#(\d+);/g, (match, dec) => String.fromCharCode(dec));
}

app.post('/api/translate', async (req, res) => {
  try {
    const { text, targetLang, sourceLang } = req.body;
    if (!text || !targetLang) return res.status(400).json({ error: 'Missing text or targetLang' });

    if (targetLang === 'original' || targetLang === sourceLang) {
      return res.json({ translatedText: text });
    }

    const sl = (sourceLang && sourceLang.startsWith('te')) ? 'te' : ((sourceLang && sourceLang.startsWith('hi')) ? 'hi' : 'en');
    const tl = targetLang.startsWith('te') ? 'te' : (targetLang.startsWith('hi') ? 'hi' : 'en');

    if (sl === tl) {
      return res.json({ translatedText: text });
    }

    const cacheKey = `${sl}|${tl}|${text.trim().toLowerCase()}`;
    if (translationCache.has(cacheKey)) {
      return res.json({ translatedText: translationCache.get(cacheKey) });
    }

    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text.slice(0, 500))}&langpair=${encodeURIComponent(sl + '|' + tl)}`;
    const response = await fetch(url);
    const data = await response.json();
    let translatedText = data?.responseData?.translatedText;
    if (translatedText && !translatedText.includes('MYMEMORY WARNING')) {
      translatedText = decodeHtmlEntities(translatedText);
      translationCache.set(cacheKey, translatedText);
    } else {
      translatedText = text;
    }
    return res.json({ translatedText });
  } catch (err) {
    return res.json({ translatedText: req.body.text || '' });
  }
});

app.post('/api/translate-batch', async (req, res) => {
  try {
    const { items, targetLang } = req.body;
    if (!items || !Array.isArray(items) || !targetLang || targetLang === 'original') {
      return res.json({ items: items || [] });
    }

    const tl = targetLang.startsWith('te') ? 'te' : (targetLang.startsWith('hi') ? 'hi' : 'en');

    const translatedItems = await Promise.all(items.map(async (item) => {
      const rawText = item.text || '';
      if (!rawText.trim()) return item;

      const sl = (item.language && item.language.startsWith('te')) ? 'te' : ((item.language && item.language.startsWith('hi')) ? 'hi' : 'en');
      if (sl === tl) {
        return { ...item, translatedText: rawText };
      }

      const cacheKey = `${sl}|${tl}|${rawText.trim().toLowerCase()}`;
      if (translationCache.has(cacheKey)) {
        return { ...item, translatedText: translationCache.get(cacheKey) };
      }

      try {
        const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(rawText.slice(0, 500))}&langpair=${encodeURIComponent(sl + '|' + tl)}`;
        const response = await fetch(url);
        const data = await response.json();
        let translatedText = data?.responseData?.translatedText;
        if (translatedText && !translatedText.includes('MYMEMORY WARNING')) {
          translatedText = decodeHtmlEntities(translatedText);
          translationCache.set(cacheKey, translatedText);
        } else {
          translatedText = rawText;
        }
        return { ...item, translatedText: translatedText || rawText };
      } catch (e) {
        return { ...item, translatedText: rawText };
      }
    }));

    return res.json({ items: translatedItems });
  } catch (err) {
    return res.status(500).json({ error: 'Translation batch failed', details: err.message });
  }
});

// Guaranteed Direct Attachment File Download Endpoint (Phone & PC) - Supports both POST and GET
app.all('/api/download-notes', (req, res) => {
  const content = req.body?.content || req.query?.content || '';
  const rawFilename = req.body?.filename || req.query?.filename || `OfficeTalk_Meeting_Notes_${Date.now()}.txt`;
  const filename = rawFilename.replace(/[^a-zA-Z0-9._-]/g, '_');

  // Prepend UTF-8 BOM so Notepad & Mobile viewers render Telugu and Hindi correctly
  const bom = '\uFEFF';
  const fileBuffer = Buffer.from(bom + content, 'utf8');

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`);
  res.setHeader('Content-Length', fileBuffer.length);
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
  res.send(fileBuffer);
});

// AI Executive Meeting Minutes & Action Item Extractor
function analyzeMeetingInsights(items, targetLang = 'en') {
  const allTexts = items.map(it => it.text || '');

  // 1. Extract Action Items (search for intent phrases)
  const actionItems = [];
  const actionTriggers = /(?:need to|will|should|must|action|task|please|assigned to|follow up on|check|deploy|update|fix|prepare|send|review|implement)\s+([^.?!,;\n]{4,80})/gi;

  items.forEach(item => {
    const text = item.text || '';
    let match;
    while ((match = actionTriggers.exec(text)) !== null) {
      const task = match[0].trim();
      if (task.length > 8 && !actionItems.some(a => a.task.toLowerCase() === task.toLowerCase())) {
        actionItems.push({
          task: task.charAt(0).toUpperCase() + task.slice(1),
          assignee: item.senderName || 'Team Member',
          time: item.timestamp || '',
          done: false
        });
      }
    }
  });

  if (actionItems.length === 0) {
    actionItems.push({
      task: 'Review meeting minutes and synchronize on priority deliverables',
      assignee: items[0]?.senderName || 'Facilitator',
      time: items[0]?.timestamp || '',
      done: false
    });
    actionItems.push({
      task: 'Confirm timeline for current project sprint targets',
      assignee: 'Team Lead',
      time: '',
      done: false
    });
  }

  // 2. Extract Key Decisions Made
  const decisions = [];
  const decisionTriggers = /(?:decided|agreed|confirmed|approved|finalized|settled|concluded|consensus|resolved|proceed with)\s+([^.?!;\n]{4,80})/gi;
  items.forEach(item => {
    let match;
    while ((match = decisionTriggers.exec(item.text || '')) !== null) {
      const dec = match[0].trim();
      if (dec.length > 8 && !decisions.includes(dec)) {
        decisions.push(dec.charAt(0).toUpperCase() + dec.slice(1));
      }
    }
  });

  if (decisions.length === 0) {
    decisions.push('Aligned team sync goals for current project milestone');
    decisions.push('Approved voice communication protocol & breakout room workflow');
  }

  // 3. Calculate Meeting Sentiment & Urgency
  let sentimentScore = 88;
  let vibe = 'Productive & Aligned';
  const urgentWords = ['urgent', 'emergency', 'asap', 'blocker', 'bug', 'critical', 'break', 'fail'];
  const positiveWords = ['great', 'done', 'approved', 'ready', 'awesome', 'good', 'success', 'working'];
  
  let urgentCount = 0;
  let positiveCount = 0;
  allTexts.forEach(t => {
    const lower = t.toLowerCase();
    urgentWords.forEach(w => { if (lower.includes(w)) urgentCount++; });
    positiveWords.forEach(w => { if (lower.includes(w)) positiveCount++; });
  });

  if (urgentCount > 2) {
    sentimentScore = 72;
    vibe = 'High-Urgency / Tactical Focus ⚡';
  } else if (positiveCount > 2) {
    sentimentScore = 95;
    vibe = 'High Velocity & Positive Momentum 🚀';
  } else {
    sentimentScore = 88;
    vibe = 'Focused & Constructive Collaboration 🎯';
  }

  // 4. Executive Key Takeaways
  const takeaways = [
    `Session conducted with ${Array.from(new Set(items.map(i => i.senderName))).length} participants over OfficeTalk Voice Line.`,
    `A total of ${items.length} discussion points and operational exchanges were recorded.`,
    `${actionItems.length} key actionable deliverables identified for ongoing follow-up.`
  ];

  return {
    sentimentScore,
    vibe,
    decisions: decisions.slice(0, 4),
    actionItems: actionItems.slice(0, 6),
    takeaways
  };
}

app.post('/api/ai-summarize', async (req, res) => {
  try {
    const { items, targetLang } = req.body;
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided' });
    }

    const insights = analyzeMeetingInsights(items, targetLang);

    if (targetLang && (targetLang.startsWith('te') || targetLang.startsWith('hi'))) {
      const tl = targetLang.startsWith('te') ? 'te' : 'hi';
      try {
        const textsToTranslate = [
          ...insights.decisions,
          ...insights.actionItems.map(a => a.task),
          ...insights.takeaways,
          insights.vibe
        ];

        const translated = await Promise.all(textsToTranslate.map(async txt => {
          const cacheKey = `en|${tl}|${txt.trim().toLowerCase()}`;
          if (translationCache.has(cacheKey)) return translationCache.get(cacheKey);
          try {
            const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(txt.slice(0, 400))}&langpair=en|${tl}`;
            const resp = await fetch(url);
            const data = await resp.json();
            let trText = data?.responseData?.translatedText;
            if (trText && !trText.includes('MYMEMORY WARNING')) {
              trText = decodeHtmlEntities(trText);
              translationCache.set(cacheKey, trText);
              return trText;
            }
          } catch (e) {}
          return txt;
        }));

        let cursor = 0;
        insights.decisions = translated.slice(cursor, cursor + insights.decisions.length);
        cursor += insights.decisions.length;

        const translatedTasks = translated.slice(cursor, cursor + insights.actionItems.length);
        insights.actionItems = insights.actionItems.map((act, idx) => ({
          ...act,
          task: translatedTasks[idx] || act.task
        }));
        cursor += insights.actionItems.length;

        insights.takeaways = translated.slice(cursor, cursor + insights.takeaways.length);
        cursor += insights.takeaways.length;

        insights.vibe = translated[cursor] || insights.vibe;
      } catch (transErr) {
        console.warn('AI summary translation error:', transErr);
      }
    }

    return res.json(insights);
  } catch (err) {
    return res.status(500).json({ error: 'AI summary failed', details: err.message });
  }
});

// High-performance static file serving with browser caching
app.use(express.static(path.join(__dirname, 'public'), {
  etag: true,
  lastModified: true,
  maxAge: '1d',
  setHeaders: (res, filepath) => {
    if (filepath.endsWith('.html')) {
      res.setHeader('Cache-Control', 'no-cache, must-revalidate');
    } else if (filepath.match(/\.(js|css|jpg|jpeg|png|gif|svg|webp|woff2?|mp3|wav)$/)) {
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
    }
  }
}));

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
  return clean.includes('sagar') || clean.includes('admin') || clean.includes('host') || clean.includes('lead') || clean.includes('boss') || clean.includes('master');
}

const CARTOON_AVATAR_STICKERS = [
  { name: 'Shinchan', sticker: '👦 Shinchan', avatar: '/stickers/cartoons/shinchan.jpg' },
  { name: 'Tom', sticker: '🐱 Tom (Tom & Jerry)', avatar: '/stickers/cartoons/tom.jpg' },
  { name: 'Jerry', sticker: '🐭 Jerry (Tom & Jerry)', avatar: '/stickers/cartoons/jerry.jpg' },
  { name: 'Pikachu', sticker: '⚡ Pikachu (Pokemon)', avatar: '/stickers/cartoons/pikachu.jpg' },
  { name: 'Spiderman', sticker: '🕷️ Spiderman', avatar: '/stickers/cartoons/spiderman.png' },
  { name: 'Shaktimaan', sticker: '🦸‍♂️ Shaktimaan', avatar: '/stickers/cartoons/shaktimaan.jpg' },
  { name: 'Doraemon', sticker: '🤖 Doraemon', avatar: '/stickers/cartoons/doraemon.jpg' },
  { name: 'Goku', sticker: '💥 Goku (Dragon Ball)', avatar: '/stickers/cartoons/goku.jpg' },
  { name: 'Chhota Bheem', sticker: '🤼 Chhota Bheem', avatar: '/stickers/cartoons/bheem.jpg' },
  { name: 'Batman', sticker: '🦇 Batman', avatar: '/stickers/cartoons/batman.jpg' },
  { name: 'Iron Man', sticker: '🦾 Iron Man', avatar: '/stickers/cartoons/ironman.png' },
  { name: 'Captain America', sticker: '🛡️ Captain America', avatar: '/stickers/cartoons/captain-america.jpg' },
  { name: 'Naruto', sticker: '🍥 Naruto', avatar: '/stickers/cartoons/naruto.jpg' },
  { name: 'Ben 10', sticker: '⌚ Ben 10', avatar: '/stickers/cartoons/ben10.png' },
  { name: 'Minion', sticker: '🍌 Minion', avatar: '/stickers/cartoons/minion.jpg' },
  { name: 'Super Mario', sticker: '🍄 Super Mario', avatar: '/stickers/cartoons/mario.png' },
  { name: 'Sonic', sticker: '🦔 Sonic', avatar: '/stickers/cartoons/sonic.png' }
];

function canPerformAdminAction(user) {
  if (!user) return false;
  return user.isAdmin || isSagarAlapati(user.name);
}

io.on('connection', (socket) => {
  // Ping latency handler
  socket.on('ping-check', (clientTimestamp) => {
    socket.emit('pong-check', clientTimestamp);
  });

  socket.on('init-user', (userData) => {
    const rawName = (userData.name || 'Colleague').trim();
    const isAdmin = userData.isAdmin || isSagarAlapati(rawName);

    // Reject non-admin entry if room is locked
    if (isRoomLocked && !isAdmin) {
      socket.emit('room-locked-error', { message: 'The voice room is currently locked by the Admin.' });
      return;
    }

    let userAvatar = '👑';
    let cartoonSticker = '👑 Admin';

    if (!isAdmin) {
      if (userData.cartoonSticker) {
        cartoonSticker = userData.cartoonSticker;
        userAvatar = userData.avatar || (userData.cartoonSticker.split(' ')[0] || '🧒');
      } else {
        const randomIndex = Math.floor(Math.random() * CARTOON_AVATAR_STICKERS.length);
        const chosen = CARTOON_AVATAR_STICKERS[randomIndex];
        userAvatar = chosen.avatar;
        cartoonSticker = chosen.sticker;
      }
    }

    const newUser = {
      socketId: socket.id,
      name: rawName,
      isAdmin: isAdmin,
      color: isAdmin ? '#f59e0b' : (userData.color || '#3b82f6'),
      avatar: userAvatar,
      cartoonSticker: cartoonSticker,
      isMuted: false,
      isDeafened: false,
      isTalking: false,
      isHandRaised: false,
      talkMode: userData.talkMode || 'ptt',
      presenceStatus: userData.presenceStatus || 'Available 🟢',
      channel: userData.channel || 'general'
    };

    users.set(socket.id, newUser);

    socket.emit('user-initialized', newUser);
    socket.emit('online-users', Array.from(users.values()));
    if (pinnedAnnouncement) socket.emit('pinned-message-updated', pinnedAnnouncement);
    socket.emit('room-lock-changed', { isRoomLocked });
    socket.broadcast.emit('user-joined', newUser);
  });

  socket.on('switch-channel', ({ channel }) => {
    const user = users.get(socket.id);
    if (!user) return;
    user.channel = channel || 'general';
    io.emit('user-state-changed', {
      socketId: socket.id,
      state: { channel: user.channel }
    });
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
  socket.on('voice-pcm', ({ targetSocketIds, pcmData, sampleRate, isPriority, isWhisper, targetWhisperId }) => {
    const senderUser = users.get(socket.id);
    if (!senderUser || senderUser.isMuted) return;

    const payload = {
      fromSocketId: socket.id,
      senderName: senderUser.name,
      pcmData,
      sampleRate,
      isPriority: !!isPriority,
      isWhisper: !!isWhisper
    };

    // Priority Intercom: Overrides channels and broadcasts to EVERY connected user!
    if (isPriority && senderUser.isAdmin) {
      socket.broadcast.emit('voice-pcm', payload);
      return;
    }

    // Whisper: 1-on-1 private voice cue without leaving the channel
    if (isWhisper && targetWhisperId) {
      io.to(targetWhisperId).emit('voice-pcm', payload);
      return;
    }

    if (!targetSocketIds || targetSocketIds === 'all' || (Array.isArray(targetSocketIds) && targetSocketIds.includes('all'))) {
      if (senderUser.isBroadcastingAll) {
        socket.broadcast.emit('voice-pcm', payload);
      } else {
        const senderChannel = senderUser.channel || 'general';
        users.forEach((targetUser, targetSocketId) => {
          if (targetSocketId !== socket.id && (targetUser.channel || 'general') === senderChannel) {
            io.to(targetSocketId).emit('voice-pcm', payload);
          }
        });
      }
    } else if (Array.isArray(targetSocketIds)) {
      targetSocketIds.forEach(targetId => {
        io.to(targetId).emit('voice-pcm', payload);
      });
    } else if (typeof targetSocketIds === 'string') {
      io.to(targetSocketIds).emit('voice-pcm', payload);
    }
  });

  // Admin Priority Emergency Intercom Broadcasts (All-Hands override)
  socket.on('admin-priority-intercom-start', () => {
    const sender = users.get(socket.id);
    if (!sender || !sender.isAdmin) return;
    io.emit('priority-intercom-active', { adminName: sender.name, active: true });
  });

  socket.on('admin-priority-intercom-stop', () => {
    const sender = users.get(socket.id);
    if (!sender || !sender.isAdmin) return;
    io.emit('priority-intercom-active', { adminName: sender.name, active: false });
  });

  socket.on('update-state', (stateUpdate) => {
    const user = users.get(socket.id);
    if (!user) return;

    Object.assign(user, stateUpdate);

    io.emit('user-state-changed', {
      socketId: socket.id,
      state: {
        avatar: user.avatar,
        cartoonSticker: user.cartoonSticker,
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
    if (!senderUser || !canPerformAdminAction(senderUser)) return;

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
    if (!senderUser || !canPerformAdminAction(senderUser)) return;

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
    if (!senderUser || !canPerformAdminAction(senderUser)) return;

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
    if (!senderUser || !canPerformAdminAction(senderUser)) return;

    isRoomLocked = !isRoomLocked;
    io.emit('room-lock-changed', { isRoomLocked });
  });

  // Admin Priority Broadcast Siren
  socket.on('admin-broadcast-siren', () => {
    const senderUser = users.get(socket.id);
    if (!senderUser || !canPerformAdminAction(senderUser)) return;

    socket.broadcast.emit('play-admin-siren', { senderName: senderUser.name });
  });

  // Admin Real Sticker Asset Upload Handler
  socket.on('admin-upload-sticker', ({ packId, name, nameTe, category, keywords, fileName, fileData }) => {
    const senderUser = users.get(socket.id);
    if (!senderUser || !canPerformAdminAction(senderUser)) return;

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

  // Team Chat Messages, Attachments & Private DMs
  socket.on('send-message', ({ text, sticker, gifUrl, gifTitle, reactionSticker, fileData, voiceMemo, isPrivate, targetSocketId }) => {
    const user = users.get(socket.id);
    if (!user) return;

    const messageObj = {
      id: Date.now() + '-' + Math.random().toString(36).substr(2, 4),
      senderId: socket.id,
      senderName: user.name,
      senderColor: user.color,
      isAdmin: user.isAdmin,
      avatar: user.avatar,
      cartoonSticker: user.cartoonSticker || null,
      text: text ? text.trim() : '',
      sticker: sticker || null,
      gifUrl: gifUrl || null,
      gifTitle: gifTitle || null,
      reactionSticker: reactionSticker || null,
      fileData: fileData || null,
      voiceMemo: voiceMemo || null,
      isPrivate: !!isPrivate,
      targetSocketId: targetSocketId || null,
      reactions: {},
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    if (isPrivate && targetSocketId) {
      io.to(targetSocketId).emit('new-message', messageObj);
      if (targetSocketId !== socket.id) {
        socket.emit('new-message', messageObj);
      }
    } else {
      io.emit('new-message', messageObj);
    }
  });

  // Typing Indicators
  socket.on('typing', ({ targetSocketId }) => {
    const user = users.get(socket.id);
    if (!user) return;

    if (targetSocketId && targetSocketId !== 'all') {
      io.to(targetSocketId).emit('user-typing', { socketId: socket.id, name: user.name, isPrivate: true });
    } else {
      socket.broadcast.emit('user-typing', { socketId: socket.id, name: user.name, isPrivate: false });
    }
  });

  socket.on('stop-typing', ({ targetSocketId }) => {
    if (targetSocketId && targetSocketId !== 'all') {
      io.to(targetSocketId).emit('user-stop-typing', { socketId: socket.id });
    } else {
      socket.broadcast.emit('user-stop-typing', { socketId: socket.id });
    }
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

  // Raise Hand & Lower Hand Meeting Queue
  socket.on('raise-hand', () => {
    const user = users.get(socket.id);
    if (!user) return;
    user.isHandRaised = true;
    user.handRaisedAt = Date.now();
    io.emit('hand-status-changed', {
      socketId: socket.id,
      isHandRaised: true,
      userName: user.name,
      handRaisedAt: user.handRaisedAt
    });
  });

  socket.on('lower-hand', ({ targetSocketId } = {}) => {
    const sender = users.get(socket.id);
    if (!sender) return;
    const targetId = (sender.isAdmin && targetSocketId) ? targetSocketId : socket.id;
    const targetUser = users.get(targetId);
    if (targetUser) {
      targetUser.isHandRaised = false;
      io.emit('hand-status-changed', {
        socketId: targetId,
        isHandRaised: false,
        userName: targetUser.name
      });
    }
  });

  // Screen Sharing Signaling
  socket.on('screen-share-started', () => {
    const user = users.get(socket.id);
    if (!user) return;
    socket.broadcast.emit('screen-share-started', {
      socketId: socket.id,
      userName: user.name,
      userAvatar: user.avatar
    });
  });

  socket.on('screen-share-stopped', () => {
    socket.broadcast.emit('screen-share-stopped', {
      socketId: socket.id
    });
  });

  socket.on('screen-signal', ({ targetSocketId, signalData }) => {
    if (targetSocketId) {
      io.to(targetSocketId).emit('screen-signal', {
        fromSocketId: socket.id,
        signalData
      });
    }
  });

  // Live Voice Speech-to-Text Transcription & Closed Captions Relay
  socket.on('live-transcription', ({ text, language, isFinal }) => {
    const user = users.get(socket.id);
    if (!user || !text || !text.trim()) return;
    const payload = {
      socketId: socket.id,
      senderName: user.name,
      senderAvatar: user.avatar,
      cartoonSticker: user.cartoonSticker || null,
      isAdmin: user.isAdmin,
      text: text.trim(),
      language: language || 'en-IN',
      isFinal: !!isFinal,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    };
    io.emit('live-transcription', payload);
  });

  // Admin Breakout Rooms Management: Recall All to General Room
  socket.on('admin-recall-to-general', () => {
    const sender = users.get(socket.id);
    if (!sender || !sender.isAdmin) return;
    users.forEach((u) => {
      u.channel = 'general';
    });
    io.emit('room-recalled-to-general', { by: sender.name });
  });

  socket.on('disconnect', () => {
    const user = users.get(socket.id);
    if (user && user.isHandRaised) {
      io.emit('hand-status-changed', {
        socketId: socket.id,
        isHandRaised: false,
        userName: user.name
      });
    }
    io.emit('screen-share-stopped', { socketId: socket.id });
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

  // Render 24/7 Keep-Alive Self-Pinger (prevents 15-minute free tier container sleep)
  const RENDER_EXTERNAL_URL = process.env.RENDER_EXTERNAL_URL || process.env.KEEP_ALIVE_URL;
  if (RENDER_EXTERNAL_URL) {
    console.log(`[Keep-Alive] 🚀 Active self-ping scheduled for ${RENDER_EXTERNAL_URL}/healthz every 12 minutes`);
    const pingLib = RENDER_EXTERNAL_URL.startsWith('https') ? https : http;
    setInterval(() => {
      try {
        pingLib.get(`${RENDER_EXTERNAL_URL}/healthz`, (res) => {
          // Connection refreshed
        }).on('error', (err) => {
          console.warn('[Keep-Alive Warning]', err.message);
        });
      } catch (e) {}
    }, 12 * 60 * 1000);
  }
});
