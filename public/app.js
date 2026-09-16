// OfficeTalk Client Logic - Case-Insensitive Admin & 1-on-1 Person Calling

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const modalSetup = document.getElementById('modalSetup');
  const formSetup = document.getElementById('formSetup');
  const setupName = document.getElementById('setupName');

  const headerUserName = document.getElementById('headerUserName');
  const headerUserAvatar = document.getElementById('headerUserAvatar');
  const headerAdminTag = document.getElementById('headerAdminTag');
  const onlineCountBadge = document.getElementById('onlineCountBadge');

  const selectTalkTarget = document.getElementById('selectTalkTarget');
  const pttTargetInfo = document.getElementById('pttTargetInfo');
  const targetHint = document.getElementById('targetHint');

  const participantGrid = document.getElementById('participantGrid');
  const emptyRoomPlaceholder = document.getElementById('emptyRoomPlaceholder');

  const controlDock = document.getElementById('controlDock');
  const btnPTT = document.getElementById('btnPTT');
  const pttText = document.getElementById('pttText');
  const btnModePTT = document.getElementById('btnModePTT');
  const btnModeOpen = document.getElementById('btnModeOpen');

  const btnToggleMute = document.getElementById('btnToggleMute');
  const muteIcon = document.getElementById('muteIcon');
  const muteLabel = document.getElementById('muteLabel');

  const btnToggleDeafen = document.getElementById('btnToggleDeafen');
  const deafenIcon = document.getElementById('deafenIcon');
  const deafenLabel = document.getElementById('deafenLabel');

  const vuBarFill = document.getElementById('vuBarFill');

  const chatMessages = document.getElementById('chatMessages');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');

  const btnAudioSettings = document.getElementById('btnAudioSettings');
  const modalAudioSettings = document.getElementById('modalAudioSettings');
  const btnCloseAudioSettings = document.getElementById('btnCloseAudioSettings');
  const selectMicInput = document.getElementById('selectMicInput');
  const settingsVuFill = document.getElementById('settingsVuFill');
  const btnToggleSoundFX = document.getElementById('btnToggleSoundFX');

  // Application State
  const socket = io();
  let currentUser = null;
  let currentTargetId = 'all';

  let localStream = null;
  let audioContext = null;
  let analyser = null;

  let talkMode = 'ptt';
  let isMuted = false;
  let isDeafened = false;
  let isTransmitting = false;
  let pttKeyPressed = false;

  const peerConnections = new Map();
  const onlineUsersMap = new Map();

  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // Case-insensitive Admin check for Sagar Alapati
  function checkIsAdmin(name) {
    if (!name) return false;
    const clean = name.trim().toLowerCase();
    return clean.includes('sagar');
  }

  // -------------------------------------------------------------
  // 1. Setup Form (Name Only & Case-Insensitive Admin Check)
  // -------------------------------------------------------------
  formSetup.addEventListener('submit', async (e) => {
    e.preventDefault();
    const rawName = (setupName.value || 'Colleague').trim();
    const isAdmin = checkIsAdmin(rawName);

    const avatars = ['👤', '👨‍💼', '👩‍💼', '👨‍💻', '👩‍💻', '🦸‍♂️', '🦸‍♀️'];
    const avatar = isAdmin ? '👑' : avatars[Math.floor(Math.random() * avatars.length)];

    currentUser = {
      name: rawName,
      isAdmin,
      avatar,
      color: isAdmin ? '#f59e0b' : getRandomColor(),
      talkMode
    };

    headerUserName.textContent = rawName;
    headerUserAvatar.textContent = avatar;

    if (isAdmin) {
      headerAdminTag.classList.remove('hidden');
    } else {
      headerAdminTag.classList.add('hidden');
    }

    socket.emit('init-user', currentUser);
    modalSetup.classList.add('hidden');

    await initLocalMicrophone();
  });

  // -------------------------------------------------------------
  // 2. Microphone Capture & Audio Analysis
  // -------------------------------------------------------------
  async function initLocalMicrophone(deviceId = null) {
    try {
      if (localStream) {
        localStream.getTracks().forEach(track => track.stop());
      }

      const constraints = {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          deviceId: deviceId ? { exact: deviceId } : undefined
        }
      };

      localStream = await navigator.mediaDevices.getUserMedia(constraints);
      setupAudioAnalyzer(localStream);

      setMicTrackEnabled(talkMode === 'open' && !isMuted);
      populateAudioDevices();
    } catch (err) {
      console.error('[Microphone Error]', err);
      alert('Microphone permission is required for voice calls.');
    }
  }

  function setMicTrackEnabled(enabled) {
    if (!localStream) return;
    localStream.getAudioTracks().forEach(track => {
      track.enabled = enabled;
    });
  }

  function setupAudioAnalyzer(stream) {
    try {
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      audioContext = new AudioCtx();
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 512;

      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      monitorAudioVolume();
    } catch (err) {
      console.error('[Audio Context Error]', err);
    }
  }

  function monitorAudioVolume() {
    if (!analyser) return;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let isSpeakingState = false;

    function checkLevel() {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        sum += dataArray[i];
      }
      const average = sum / dataArray.length;
      const percent = Math.min(100, Math.round((average / 128) * 100));

      vuBarFill.style.width = percent + '%';
      if (settingsVuFill) settingsVuFill.style.width = percent + '%';

      const currentlySpeaking = percent > 12 && (talkMode === 'open' ? !isMuted : isTransmitting);
      if (currentlySpeaking !== isSpeakingState) {
        isSpeakingState = currentlySpeaking;
        updateUserCardTalking(socket.id, currentlySpeaking);
        socket.emit('update-state', { isTalking: currentlySpeaking, talkTargetId: currentTargetId });
      }

      requestAnimationFrame(checkLevel);
    }

    checkLevel();
  }

  async function populateAudioDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      selectMicInput.innerHTML = '';
      devices.filter(d => d.kind === 'audioinput').forEach((dev, idx) => {
        const opt = document.createElement('option');
        opt.value = dev.deviceId;
        opt.textContent = dev.label || `Microphone ${idx + 1}`;
        selectMicInput.appendChild(opt);
      });
    } catch (e) {
      console.error('Error populating audio devices', e);
    }
  }

  selectMicInput.addEventListener('change', () => {
    if (selectMicInput.value) {
      initLocalMicrophone(selectMicInput.value);
    }
  });

  // -------------------------------------------------------------
  // 3. Socket.io Events & Online Users
  // -------------------------------------------------------------
  socket.on('user-initialized', (selfData) => {
    window.soundFX.playJoinChime();

    onlineUsersMap.clear();
    participantGrid.innerHTML = '';

    onlineUsersMap.set(socket.id, selfData);
    renderParticipantCard(socket.id, selfData);
    rebuildTargetDropdown();
  });

  socket.on('online-users', (users) => {
    users.forEach(user => {
      if (user.socketId !== socket.id) {
        onlineUsersMap.set(user.socketId, user);
        renderParticipantCard(user.socketId, user);
        initiatePeerConnection(user.socketId, true);
      }
    });
    updateOnlineCount();
    rebuildTargetDropdown();
  });

  socket.on('user-joined', (user) => {
    onlineUsersMap.set(user.socketId, user);
    renderParticipantCard(user.socketId, user);
    updateOnlineCount();
    rebuildTargetDropdown();

    appendChatMessage({
      senderName: 'System',
      senderColor: '#3b82f6',
      text: `${user.name} ${user.isAdmin ? '👑 (Admin)' : ''} connected.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });

  socket.on('user-left', ({ socketId }) => {
    const user = onlineUsersMap.get(socketId);
    if (user) {
      appendChatMessage({
        senderName: 'System',
        senderColor: '#ef4444',
        text: `${user.name} disconnected.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }

    if (currentTargetId === socketId) {
      setTalkTarget('all');
    }

    closePeerConnection(socketId);
    onlineUsersMap.delete(socketId);
    removeParticipantCard(socketId);
    updateOnlineCount();
    rebuildTargetDropdown();
  });

  socket.on('user-state-changed', ({ socketId, state }) => {
    const user = onlineUsersMap.get(socketId);
    if (user) {
      Object.assign(user, state);
      updateUserCardState(socketId, state);
    }
  });

  socket.on('new-message', (msg) => {
    appendChatMessage(msg);
  });

  // -------------------------------------------------------------
  // 4. WebRTC Peer Connection & Selective 1-on-1 Audio Filtering
  // -------------------------------------------------------------
  function initiatePeerConnection(targetSocketId, isInitiator) {
    if (peerConnections.has(targetSocketId)) return;

    const pc = new RTCPeerConnection(rtcConfig);
    const remoteStream = new MediaStream();
    const audioElement = document.createElement('audio');
    audioElement.autoplay = true;

    if (localStream) {
      localStream.getTracks().forEach(track => pc.addTrack(track, localStream));
    }

    pc.ontrack = (event) => {
      event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
      audioElement.srcObject = remoteStream;
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('signal', {
          targetSocketId,
          signalData: { type: 'candidate', candidate: event.candidate }
        });
      }
    };

    peerConnections.set(targetSocketId, { pc, remoteStream, audioElement });

    if (isInitiator) {
      pc.createOffer()
        .then(offer => pc.setLocalDescription(offer))
        .then(() => {
          socket.emit('signal', {
            targetSocketId,
            signalData: { type: 'offer', offer: pc.localDescription }
          });
        })
        .catch(err => console.error('Offer error:', err));
    }
  }

  socket.on('signal', async ({ fromSocketId, signalData }) => {
    let conn = peerConnections.get(fromSocketId);

    if (!conn) {
      initiatePeerConnection(fromSocketId, false);
      conn = peerConnections.get(fromSocketId);
    }

    const pc = conn.pc;

    try {
      if (signalData.type === 'offer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signalData.offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('signal', {
          targetSocketId: fromSocketId,
          signalData: { type: 'answer', answer: pc.localDescription }
        });
      } else if (signalData.type === 'answer') {
        await pc.setRemoteDescription(new RTCSessionDescription(signalData.answer));
      } else if (signalData.type === 'candidate') {
        await pc.addIceCandidate(new RTCIceCandidate(signalData.candidate));
      }
    } catch (err) {
      console.error('Signal error:', err);
    }
  });

  function closePeerConnection(socketId) {
    const conn = peerConnections.get(socketId);
    if (conn) {
      conn.pc.close();
      if (conn.audioElement) {
        conn.audioElement.pause();
        conn.audioElement.srcObject = null;
        conn.audioElement.remove();
      }
      peerConnections.delete(socketId);
    }
  }

  // -------------------------------------------------------------
  // 5. Targeted 1-on-1 Person Selector Logic
  // -------------------------------------------------------------
  function setTalkTarget(targetId) {
    currentTargetId = targetId;
    selectTalkTarget.value = targetId;

    if (targetId === 'all') {
      pttTargetInfo.textContent = 'to Everyone';
      targetHint.textContent = 'Talking to EVERYONE on call';
    } else {
      const user = onlineUsersMap.get(targetId);
      const targetName = user ? user.name : 'Selected Colleague';
      pttTargetInfo.textContent = `to ${targetName} (1-on-1)`;
      targetHint.textContent = `Talking ONLY with ${targetName}`;
    }

    document.querySelectorAll('.participant-card').forEach(card => {
      card.classList.remove('selected-target');
    });

    if (targetId !== 'all') {
      const card = document.getElementById(`pcard-${targetId}`);
      if (card) card.classList.add('selected-target');
    }
  }

  selectTalkTarget.addEventListener('change', (e) => {
    setTalkTarget(e.target.value);
  });

  function rebuildTargetDropdown() {
    selectTalkTarget.innerHTML = '<option value="all">🌐 Everyone (Broadcast Call)</option>';
    onlineUsersMap.forEach((user, sId) => {
      if (sId !== socket.id) {
        const opt = document.createElement('option');
        opt.value = sId;
        opt.textContent = `👤 ${user.name} ${user.isAdmin ? '👑 (Admin)' : ''} (1-on-1)`;
        selectTalkTarget.appendChild(opt);
      }
    });

    if (currentTargetId !== 'all' && !onlineUsersMap.has(currentTargetId)) {
      setTalkTarget('all');
    } else {
      selectTalkTarget.value = currentTargetId;
    }
  }

  // -------------------------------------------------------------
  // 6. PTT & Open Call Controls
  // -------------------------------------------------------------
  function startTransmitting() {
    if (isTransmitting || isMuted || isDeafened) return;
    isTransmitting = true;

    btnPTT.classList.add('transmitting');
    pttText.textContent = 'TRANSMITTING...';

    window.soundFX.playPttStart();

    peerConnections.forEach((conn, peerSocketId) => {
      const sendTrack = conn.pc.getSenders().find(s => s.track && s.track.kind === 'audio');
      if (sendTrack) {
        sendTrack.track.enabled = (currentTargetId === 'all' || currentTargetId === peerSocketId);
      }
    });

    socket.emit('update-state', { isTalking: true, talkTargetId: currentTargetId });
    updateUserCardTalking(socket.id, true);
  }

  function stopTransmitting() {
    if (!isTransmitting) return;
    isTransmitting = false;

    btnPTT.classList.remove('transmitting');
    pttText.textContent = 'HOLD TO TALK';

    window.soundFX.playPttEnd();

    if (talkMode === 'ptt') {
      peerConnections.forEach((conn) => {
        const sendTrack = conn.pc.getSenders().find(s => s.track && s.track.kind === 'audio');
        if (sendTrack && sendTrack.track) {
          sendTrack.track.enabled = false;
        }
      });
    }

    socket.emit('update-state', { isTalking: false, talkTargetId: currentTargetId });
    updateUserCardTalking(socket.id, false);
  }

  btnPTT.addEventListener('mousedown', startTransmitting);
  btnPTT.addEventListener('mouseup', stopTransmitting);
  btnPTT.addEventListener('mouseleave', stopTransmitting);

  btnPTT.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startTransmitting();
  });
  btnPTT.addEventListener('touchend', (e) => {
    e.preventDefault();
    stopTransmitting();
  });

  window.addEventListener('keydown', (e) => {
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;

    if (e.code === 'Space' && talkMode === 'ptt' && !pttKeyPressed) {
      e.preventDefault();
      pttKeyPressed = true;
      startTransmitting();
    } else if (e.code === 'KeyM') {
      toggleMute();
    } else if (e.code === 'KeyD') {
      toggleDeafen();
    }
  });

  window.addEventListener('keyup', (e) => {
    if (e.code === 'Space' && talkMode === 'ptt') {
      e.preventDefault();
      pttKeyPressed = false;
      stopTransmitting();
    }
  });

  btnModePTT.addEventListener('click', () => switchTalkMode('ptt'));
  btnModeOpen.addEventListener('click', () => switchTalkMode('open'));

  function switchTalkMode(mode) {
    talkMode = mode;
    if (mode === 'ptt') {
      btnModePTT.classList.add('active');
      btnModeOpen.classList.remove('active');
      btnPTT.style.display = 'flex';
      setMicTrackEnabled(false);
    } else {
      btnModeOpen.classList.add('active');
      btnModePTT.classList.remove('active');
      btnPTT.style.display = 'none';
      setMicTrackEnabled(!isMuted);
    }
    socket.emit('update-state', { talkMode });
    updateUserCardState(socket.id, { talkMode });
  }

  btnToggleMute.addEventListener('click', toggleMute);

  function toggleMute() {
    isMuted = !isMuted;
    btnToggleMute.classList.toggle('active-muted', isMuted);
    muteIcon.textContent = isMuted ? '🔇' : '🎙️';
    muteLabel.textContent = isMuted ? 'Unmute' : 'Mute';

    window.soundFX.playMuteToggle(isMuted);

    if (talkMode === 'open') {
      setMicTrackEnabled(!isMuted);
    } else if (isMuted && isTransmitting) {
      stopTransmitting();
    }

    socket.emit('update-state', { isMuted });
    updateUserCardState(socket.id, { isMuted });
  }

  btnToggleDeafen.addEventListener('click', toggleDeafen);

  function toggleDeafen() {
    isDeafened = !isDeafened;
    btnToggleDeafen.classList.toggle('active-muted', isDeafened);
    deafenIcon.textContent = isDeafened ? '🔇' : '🎧';
    deafenLabel.textContent = isDeafened ? 'Undeafen' : 'Deafen';

    peerConnections.forEach((conn) => {
      if (conn.audioElement) {
        conn.audioElement.muted = isDeafened;
      }
    });

    socket.emit('update-state', { isDeafened });
    updateUserCardState(socket.id, { isDeafened });
  }

  // -------------------------------------------------------------
  // 7. Participant Card Rendering & 1-on-1 Selection
  // -------------------------------------------------------------
  function renderParticipantCard(socketId, user) {
    if (document.getElementById('emptyRoomPlaceholder')) {
      participantGrid.innerHTML = '';
    }

    const existingCard = document.getElementById(`pcard-${socketId}`);
    if (existingCard) existingCard.remove();

    const isSelf = socketId === socket.id;

    const card = document.createElement('div');
    card.className = `participant-card ${currentTargetId === socketId ? 'selected-target' : ''}`;
    card.id = `pcard-${socketId}`;

    card.innerHTML = `
      <div class="participant-avatar-wrapper">
        <div class="participant-avatar" style="border-color: ${user.color || '#3b82f6'};">${user.avatar || '👤'}</div>
        <div class="talking-aura"></div>
      </div>
      <div class="participant-name-row">
        <span class="participant-name">${user.name} ${isSelf ? '(You)' : ''}</span>
        ${user.isAdmin ? '<span class="admin-crown-tag">👑 Admin</span>' : ''}
      </div>
      <div class="status-badges">
        <span class="badge-tag ${user.talkMode || 'ptt'}">${(user.talkMode || 'ptt').toUpperCase()}</span>
        <span class="badge-tag muted ${user.isMuted ? '' : 'hidden'}">MUTED</span>
      </div>
      ${!isSelf ? `<button class="btn-select-talk" data-id="${socketId}">🎯 Talk 1-on-1</button>` : ''}
    `;

    if (!isSelf) {
      card.addEventListener('click', (e) => {
        if (e.target.closest('.btn-select-talk') || e.currentTarget) {
          setTalkTarget(socketId);
        }
      });
    }

    participantGrid.appendChild(card);
  }

  function removeParticipantCard(socketId) {
    const card = document.getElementById(`pcard-${socketId}`);
    if (card) card.remove();

    if (participantGrid.children.length === 0) {
      participantGrid.appendChild(emptyRoomPlaceholder);
    }
  }

  function updateUserCardTalking(socketId, isTalking) {
    const card = document.getElementById(`pcard-${socketId}`);
    if (card) {
      card.classList.toggle('talking', isTalking);
    }
  }

  function updateUserCardState(socketId, state) {
    const card = document.getElementById(`pcard-${socketId}`);
    if (!card) return;

    if (state.isMuted !== undefined) {
      const mutedTag = card.querySelector('.badge-tag.muted');
      if (mutedTag) {
        if (state.isMuted) mutedTag.classList.remove('hidden');
        else mutedTag.classList.add('hidden');
      }
    }

    if (state.talkMode !== undefined) {
      const modeTag = card.querySelector('.badge-tag.ptt, .badge-tag.open');
      if (modeTag) {
        modeTag.className = `badge-tag ${state.talkMode}`;
        modeTag.textContent = state.talkMode.toUpperCase();
      }
    }
  }

  function updateOnlineCount() {
    const count = onlineUsersMap.size;
    onlineCountBadge.textContent = `${count} ${count === 1 ? 'Colleague' : 'Colleagues'} Online`;
  }

  // -------------------------------------------------------------
  // 8. Chat & Utilities
  // -------------------------------------------------------------
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    socket.emit('send-message', { text });
    chatInput.value = '';
  });

  function appendChatMessage(msg) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';

    bubble.innerHTML = `
      <div class="chat-sender-row">
        <span class="chat-sender-name" style="color: ${msg.senderColor || '#3b82f6'};">
          ${msg.senderName} ${msg.isAdmin ? '👑 (Admin)' : ''}
        </span>
        <span class="chat-time">${msg.timestamp}</span>
      </div>
      <div class="chat-text">${escapeHTML(msg.text)}</div>
    `;

    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;'>: '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  btnAudioSettings.addEventListener('click', () => modalAudioSettings.classList.remove('hidden'));
  btnCloseAudioSettings.addEventListener('click', () => modalAudioSettings.classList.add('hidden'));

  btnToggleSoundFX.addEventListener('click', () => {
    window.soundFX.enabled = !window.soundFX.enabled;
    btnToggleSoundFX.textContent = `🔊 Sound: ${window.soundFX.enabled ? 'ON' : 'OFF'}`;
  });

  function getRandomColor() {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
});
