// OfficeTalk Master Client Engine v17 - Multi-Target Voice & Admin Superpowers

document.addEventListener('DOMContentLoaded', () => {
  // --- DOM Elements ---
  const modalSetup = document.getElementById('modalSetup');
  const formSetup = document.getElementById('formSetup');
  const setupName = document.getElementById('setupName');
  const btnSubmitSetup = document.getElementById('btnSubmitSetup');

  const headerUserName = document.getElementById('headerUserName');
  const headerUserAvatar = document.getElementById('headerUserAvatar');
  const headerAdminTag = document.getElementById('headerAdminTag');
  const onlineCountBadge = document.getElementById('onlineCountBadge');
  const pingLatencyBadge = document.getElementById('pingLatencyBadge');
  const selectPresenceStatus = document.getElementById('selectPresenceStatus');

  const btnTargetEveryone = document.getElementById('btnTargetEveryone');
  const targetSummaryBadge = document.getElementById('targetSummaryBadge');
  const pttTargetInfo = document.getElementById('pttTargetInfo');

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

  // Sidebar Chat & Pinned Banner
  const pinnedChatBanner = document.getElementById('pinnedChatBanner');
  const pinnedBannerText = document.getElementById('pinnedBannerText');
  const btnUnpinBanner = document.getElementById('btnUnpinBanner');
  const chatMessages = document.getElementById('chatMessages');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const btnAttachFile = document.getElementById('btnAttachFile');
  const inputFileAttachment = document.getElementById('inputFileAttachment');
  const btnRecordVoiceMemo = document.getElementById('btnRecordVoiceMemo');

  // Settings Modal
  const btnAudioSettings = document.getElementById('btnAudioSettings');
  const modalAudioSettings = document.getElementById('modalAudioSettings');
  const btnCloseAudioSettings = document.getElementById('btnCloseAudioSettings');
  const selectMicInput = document.getElementById('selectMicInput');
  const selectSoundTheme = document.getElementById('selectSoundTheme');
  const settingsVuFill = document.getElementById('settingsVuFill');
  const btnToggleSoundFX = document.getElementById('btnToggleSoundFX');

  // Admin Control Panel Elements
  const adminControlPanel = document.getElementById('adminControlPanel');
  const btnAdminBroadcast = document.getElementById('btnAdminBroadcast');
  const btnAdminSiren = document.getElementById('btnAdminSiren');
  const btnAdminMuteAll = document.getElementById('btnAdminMuteAll');
  const btnAdminUnmuteAll = document.getElementById('btnAdminUnmuteAll');
  const btnAdminLockRoom = document.getElementById('btnAdminLockRoom');

  // --- State Variables ---
  const socket = io();
  let currentUser = null;
  const selectedTargetIds = new Set(['all']);

  let localStream = null;
  let txAudioContext = null;
  let rxAudioContext = null;
  let analyser = null;
  let scriptProcessor = null;

  let talkMode = 'ptt';
  let isMuted = false;
  let isDeafened = false;
  let isTransmitting = false;
  let pttKeyPressed = false;

  const onlineUsersMap = new Map(); // socketId -> userData
  const chatMessagesMap = new Map(); // messageId -> DOMElement

  // Voice Memo recording variables
  let mediaRecorder = null;
  let audioChunks = [];
  let isRecordingMemo = false;

  function checkIsAdmin(name) {
    if (!name) return false;
    return name.trim().toLowerCase().includes('sagar');
  }

  function createSafeAudioContext(preferredRate = 16000) {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    try {
      return new AudioCtx({ sampleRate: preferredRate });
    } catch (e) {
      try { return new AudioCtx(); } catch (e2) { return null; }
    }
  }

  function unlockAudioContexts() {
    try {
      if (txAudioContext && txAudioContext.state === 'suspended') txAudioContext.resume();
      if (rxAudioContext && rxAudioContext.state === 'suspended') rxAudioContext.resume();
      if (window.soundFX && typeof window.soundFX.init === 'function') window.soundFX.init();
    } catch (e) { console.warn('Audio unlock notice:', e); }
  }

  document.addEventListener('click', unlockAudioContexts);
  document.addEventListener('touchstart', unlockAudioContexts);
  document.addEventListener('keydown', unlockAudioContexts);

  rxAudioContext = createSafeAudioContext(16000);

  // -------------------------------------------------------------
  // Latency Ping Checker
  // -------------------------------------------------------------
  setInterval(() => {
    if (socket.connected) {
      const start = Date.now();
      socket.emit('ping-check', start);
    }
  }, 3000);

  socket.on('pong-check', (clientTimestamp) => {
    const rtt = Date.now() - clientTimestamp;
    if (pingLatencyBadge) {
      pingLatencyBadge.textContent = `⚡ ${rtt}ms`;
    }
  });

  // -------------------------------------------------------------
  // User Login & Setup Engine
  // -------------------------------------------------------------
  function performUserConnect(inputName = null) {
    try {
      const nameEl = document.getElementById('setupName');
      const nameVal = inputName || (nameEl ? nameEl.value : '') || '';
      const rawName = nameVal.trim();
      if (!rawName) return;

      try { localStorage.setItem('officetalk_user_name', rawName); } catch (e) {}

      const isAdmin = checkIsAdmin(rawName);
      const avatars = ['👤', '👨‍💼', '👩‍💼', '👨‍💻', '👩‍💻', '🦸‍♂️', '🦸‍♀️'];
      const avatar = isAdmin ? '👑' : avatars[Math.floor(Math.random() * avatars.length)];
      const presenceStatus = selectPresenceStatus ? selectPresenceStatus.value : 'Available 🟢';

      currentUser = {
        name: rawName,
        isAdmin,
        avatar,
        color: isAdmin ? '#f59e0b' : getRandomColor(),
        talkMode,
        presenceStatus
      };

      if (headerUserName) headerUserName.textContent = rawName;
      if (headerUserAvatar) headerUserAvatar.textContent = avatar;
      if (headerAdminTag) {
        if (isAdmin) headerAdminTag.classList.remove('hidden');
        else headerAdminTag.classList.add('hidden');
      }

      const modal = document.getElementById('modalSetup');
      if (modal) {
        modal.style.display = 'none';
        modal.classList.add('hidden');
        try { modal.remove(); } catch(e) {}
      }

      socket.emit('init-user', currentUser);
      unlockAudioContexts();
      initLocalMicrophone().catch(err => console.log('Mic init notice:', err));
    } catch (err) {
      console.error('[User Connect Error]', err);
      const modal = document.getElementById('modalSetup');
      if (modal) {
        modal.style.display = 'none';
        modal.classList.add('hidden');
        try { modal.remove(); } catch(e) {}
      }
    }
  }

  function handleConnectEvent(e) {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    performUserConnect();
    return false;
  }

  if (btnSubmitSetup) btnSubmitSetup.addEventListener('click', handleConnectEvent);
  if (formSetup) formSetup.addEventListener('submit', handleConnectEvent);

  // Auto-login returning user
  try {
    const savedName = localStorage.getItem('officetalk_user_name');
    if (savedName && savedName.trim()) {
      if (setupName) setupName.value = savedName.trim();
      performUserConnect(savedName.trim());
    }
  } catch (e) {}

  socket.on('connect', () => {
    try {
      const savedName = localStorage.getItem('officetalk_user_name');
      if (currentUser) {
        socket.emit('init-user', currentUser);
      } else if (savedName && savedName.trim()) {
        performUserConnect(savedName.trim());
      }
    } catch (e) {}
  });

  socket.on('room-locked-error', ({ message }) => {
    alert(`🔒 Connection Blocked: ${message}`);
  });

  // -------------------------------------------------------------
  // Presence Status Change
  // -------------------------------------------------------------
  if (selectPresenceStatus) {
    selectPresenceStatus.addEventListener('change', () => {
      const newStatus = selectPresenceStatus.value;
      if (currentUser) currentUser.presenceStatus = newStatus;
      socket.emit('update-state', { presenceStatus: newStatus });
      updateUserCardState(socket.id, { presenceStatus: newStatus });
    });
  }

  // -------------------------------------------------------------
  // Local Microphone & Audio Capture
  // -------------------------------------------------------------
  async function initLocalMicrophone(deviceId = null) {
    try {
      if (localStream) localStream.getTracks().forEach(track => track.stop());
      const constraints = { audio: deviceId ? { deviceId: { exact: deviceId } } : true };
      localStream = await navigator.mediaDevices.getUserMedia(constraints);
      setupPcmAudioCapture(localStream);
      populateAudioDevices();
    } catch (err) {
      console.warn('[Microphone Capture Notice]', err);
    }
  }

  function setupPcmAudioCapture(stream) {
    try {
      if (!txAudioContext) txAudioContext = createSafeAudioContext(16000);
      if (!txAudioContext) return;

      analyser = txAudioContext.createAnalyser();
      analyser.fftSize = 512;

      const source = txAudioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      scriptProcessor = txAudioContext.createScriptProcessor(2048, 1, 1);
      scriptProcessor.onaudioprocess = (e) => {
        if (isMuted) return;
        const shouldTransmit = (talkMode === 'open' || isTransmitting);
        if (!shouldTransmit) return;

        const inputData = e.inputBuffer.getChannelData(0);
        const pcm16 = new Int16Array(inputData.length);
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]));
          pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
        }

        const targetsPayload = selectedTargetIds.has('all') ? 'all' : Array.from(selectedTargetIds);
        socket.emit('voice-pcm', { targetSocketIds: targetsPayload, pcmData: pcm16.buffer });
      };

      source.connect(scriptProcessor);
      scriptProcessor.connect(txAudioContext.destination);

      monitorAudioVolume();
    } catch (err) {
      console.error('[PCM Capture Setup Error]', err);
    }
  }

  function monitorAudioVolume() {
    if (!analyser) return;
    const dataArray = new Uint8Array(analyser.frequencyBinCount);
    let isSpeakingState = false;

    function checkLevel() {
      analyser.getByteFrequencyData(dataArray);
      let sum = 0;
      for (let i = 0; i < dataArray.length; i++) sum += dataArray[i];
      const average = sum / dataArray.length;
      const percent = Math.min(100, Math.round((average / 128) * 100));

      if (vuBarFill) vuBarFill.style.width = percent + '%';
      if (settingsVuFill) settingsVuFill.style.width = percent + '%';

      const currentlySpeaking = percent > 6 && (talkMode === 'open' ? !isMuted : isTransmitting);
      if (currentlySpeaking !== isSpeakingState) {
        isSpeakingState = currentlySpeaking;
        updateUserCardTalking(socket.id, currentlySpeaking);
        socket.emit('update-state', { isTalking: currentlySpeaking });
      }

      requestAnimationFrame(checkLevel);
    }
    checkLevel();
  }

  async function populateAudioDevices() {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      if (!selectMicInput) return;
      selectMicInput.innerHTML = '';
      devices.filter(d => d.kind === 'audioinput').forEach((dev, idx) => {
        const opt = document.createElement('option');
        opt.value = dev.deviceId;
        opt.textContent = dev.label || `Microphone ${idx + 1}`;
        selectMicInput.appendChild(opt);
      });
    } catch (e) {}
  }

  if (selectMicInput) {
    selectMicInput.addEventListener('change', () => {
      if (selectMicInput.value) initLocalMicrophone(selectMicInput.value);
    });
  }

  // -------------------------------------------------------------
  // Audio Receiver & Spatial Stereo Audio Panning Engine
  // -------------------------------------------------------------
  function getSpatialPanValue(fromSocketId) {
    const usersArray = Array.from(onlineUsersMap.keys()).filter(id => id !== socket.id);
    const index = usersArray.indexOf(fromSocketId);
    if (index === -1 || usersArray.length <= 1) return 0; // Center
    const step = 1.6 / (usersArray.length - 1 || 1);
    return -0.8 + (index * step);
  }

  socket.on('voice-pcm', ({ fromSocketId, senderName, pcmData }) => {
    if (isDeafened) return;
    if (rxAudioContext.state === 'suspended') rxAudioContext.resume();

    updateUserCardTalking(fromSocketId, true);
    setTimeout(() => updateUserCardTalking(fromSocketId, false), 250);

    try {
      const int16 = new Int16Array(pcmData);
      const float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        float32[i] = int16[i] / (int16[i] < 0 ? 0x8000 : 0x7FFF);
      }

      const audioBuffer = rxAudioContext.createBuffer(1, float32.length, 16000);
      audioBuffer.getChannelData(0).set(float32);

      const source = rxAudioContext.createBufferSource();
      source.buffer = audioBuffer;

      // Spatial Stereo Panner Node
      if (rxAudioContext.createStereoPanner) {
        const panner = rxAudioContext.createStereoPanner();
        const panValue = getSpatialPanValue(fromSocketId);
        panner.pan.value = panValue;
        source.connect(panner);
        panner.connect(rxAudioContext.destination);
      } else {
        source.connect(rxAudioContext.destination);
      }

      source.start();
    } catch (err) {
      console.error('PCM playback error:', err);
    }
  });

  // -------------------------------------------------------------
  // User Management & Admin Socket Listeners
  // -------------------------------------------------------------
  socket.on('user-initialized', (selfData) => {
    if (window.soundFX) window.soundFX.playJoinChime();
    currentUser = selfData;

    if (selfData.isAdmin) {
      if (adminControlPanel) adminControlPanel.classList.remove('hidden');
    }

    onlineUsersMap.clear();
    participantGrid.innerHTML = '';

    onlineUsersMap.set(socket.id, selfData);
    renderParticipantCard(socket.id, selfData);
  });

  socket.on('forced-mute-state', ({ isMuted: newMuteState }) => {
    isMuted = newMuteState;
    btnToggleMute.classList.toggle('active-muted', isMuted);
    muteIcon.textContent = isMuted ? '🔇' : '🎙️';
    muteLabel.textContent = isMuted ? 'Unmute' : 'Mute';

    if (isMuted && isTransmitting) stopTransmitting();
    if (window.soundFX) window.soundFX.playMuteToggle(isMuted);
  });

  socket.on('kicked-by-admin', ({ reason }) => {
    alert(`⛔ ${reason}`);
    window.location.reload();
  });

  socket.on('play-admin-siren', ({ senderName }) => {
    if (window.soundFX) window.soundFX.playPrioritySiren();
    appendChatMessage({
      senderName: 'ADMIN ANNOUNCEMENT',
      senderColor: '#ef4444',
      text: `🚨 PRIORITY SIREN BROADCAST FROM ADMIN (${senderName})!`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });

  socket.on('room-lock-changed', ({ isRoomLocked }) => {
    if (btnAdminLockRoom) {
      btnAdminLockRoom.textContent = isRoomLocked ? '🔓 Unlock Room' : '🔒 Lock Room';
      btnAdminLockRoom.classList.toggle('btn-admin-danger', isRoomLocked);
    }
  });

  // Admin Controls Listeners
  if (btnAdminBroadcast) {
    btnAdminBroadcast.addEventListener('click', () => {
      selectedTargetIds.clear();
      selectedTargetIds.add('all');
      updateTargetUI();
    });
  }

  if (btnAdminSiren) {
    btnAdminSiren.addEventListener('click', () => {
      socket.emit('admin-broadcast-siren');
      if (window.soundFX) window.soundFX.playPrioritySiren();
    });
  }

  if (btnAdminLockRoom) {
    btnAdminLockRoom.addEventListener('click', () => {
      socket.emit('admin-toggle-lock');
    });
  }

  if (btnAdminMuteAll) {
    btnAdminMuteAll.addEventListener('click', () => {
      socket.emit('admin-mute-all', { muteState: true });
    });
  }

  if (btnAdminUnmuteAll) {
    btnAdminUnmuteAll.addEventListener('click', () => {
      socket.emit('admin-mute-all', { muteState: false });
    });
  }

  socket.on('online-users', (users) => {
    users.forEach(user => {
      if (user.socketId !== socket.id) {
        onlineUsersMap.set(user.socketId, user);
        renderParticipantCard(user.socketId, user);
      }
    });
    updateOnlineCount();
  });

  socket.on('user-joined', (user) => {
    onlineUsersMap.set(user.socketId, user);
    renderParticipantCard(user.socketId, user);
    updateOnlineCount();

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

    selectedTargetIds.delete(socketId);
    if (selectedTargetIds.size === 0) selectedTargetIds.add('all');
    updateTargetUI();

    onlineUsersMap.delete(socketId);
    removeParticipantCard(socketId);
    updateOnlineCount();
  });

  socket.on('user-state-changed', ({ socketId, state }) => {
    const user = onlineUsersMap.get(socketId);
    if (user) {
      Object.assign(user, state);
      updateUserCardState(socketId, state);
    }
  });

  // -------------------------------------------------------------
  // Pinned Announcement Banner Handler
  // -------------------------------------------------------------
  socket.on('pinned-message-updated', (pinnedObj) => {
    if (!pinnedChatBanner || !pinnedBannerText) return;

    if (pinnedObj && pinnedObj.text) {
      pinnedBannerText.textContent = `"${pinnedObj.text}" — by ${pinnedObj.pinnedBy}`;
      pinnedChatBanner.classList.remove('hidden');
      if (btnUnpinBanner && currentUser && currentUser.isAdmin) {
        btnUnpinBanner.classList.remove('hidden');
      }
    } else {
      pinnedChatBanner.classList.add('hidden');
    }
  });

  if (btnUnpinBanner) {
    btnUnpinBanner.addEventListener('click', () => {
      socket.emit('pin-message', { text: null });
    });
  }

  // -------------------------------------------------------------
  // Multi-Target Recipient Selection UI
  // -------------------------------------------------------------
  if (btnTargetEveryone) {
    btnTargetEveryone.addEventListener('click', () => {
      selectedTargetIds.clear();
      selectedTargetIds.add('all');
      updateTargetUI();
    });
  }

  function toggleTargetPerson(socketId) {
    if (selectedTargetIds.has('all')) selectedTargetIds.clear();

    if (selectedTargetIds.has(socketId)) {
      selectedTargetIds.delete(socketId);
    } else {
      selectedTargetIds.add(socketId);
    }

    if (selectedTargetIds.size === 0) selectedTargetIds.add('all');
    updateTargetUI();
  }

  function updateTargetUI() {
    const isEveryone = selectedTargetIds.has('all');

    if (isEveryone) {
      btnTargetEveryone.classList.add('active');
      targetSummaryBadge.textContent = 'All Online Colleagues';
      pttTargetInfo.textContent = 'to Everyone';
    } else {
      btnTargetEveryone.classList.remove('active');
      const targetNames = [];
      selectedTargetIds.forEach(id => {
        const u = onlineUsersMap.get(id);
        if (u) targetNames.push(u.name);
      });

      const count = selectedTargetIds.size;
      targetSummaryBadge.textContent = `🎯 ${count} Colleague${count === 1 ? '' : 's'} (${targetNames.join(', ')})`;
      pttTargetInfo.textContent = `to ${count} Colleague${count === 1 ? '' : 's'}`;
    }

    onlineUsersMap.forEach((user, sId) => {
      const card = document.getElementById(`pcard-${sId}`);
      if (card) {
        const btn = card.querySelector('.btn-select-talk');
        if (selectedTargetIds.has(sId)) {
          card.classList.add('selected-target');
          if (btn) btn.textContent = '✓ Selected';
        } else {
          card.classList.remove('selected-target');
          if (btn) btn.textContent = '+ Select to Talk';
        }
      }
    });
  }

  // -------------------------------------------------------------
  // Push-To-Talk Engine
  // -------------------------------------------------------------
  function startTransmitting() {
    if (isTransmitting || isMuted || isDeafened) return;
    isTransmitting = true;

    btnPTT.classList.add('transmitting');
    pttText.textContent = 'TRANSMITTING...';

    unlockAudioContexts();
    if (window.soundFX) window.soundFX.playPttStart();

    socket.emit('update-state', { isTalking: true });
    updateUserCardTalking(socket.id, true);
  }

  function stopTransmitting() {
    if (!isTransmitting) return;
    isTransmitting = false;

    btnPTT.classList.remove('transmitting');
    pttText.textContent = 'HOLD TO TALK';

    if (window.soundFX) window.soundFX.playPttEnd();

    socket.emit('update-state', { isTalking: false });
    updateUserCardTalking(socket.id, false);
  }

  if (btnPTT) {
    btnPTT.addEventListener('mousedown', startTransmitting);
    btnPTT.addEventListener('mouseup', stopTransmitting);
    btnPTT.addEventListener('mouseleave', stopTransmitting);

    btnPTT.addEventListener('touchstart', (e) => { e.preventDefault(); startTransmitting(); });
    btnPTT.addEventListener('touchend', (e) => { e.preventDefault(); stopTransmitting(); });
  }

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

  if (btnModePTT) btnModePTT.addEventListener('click', () => switchTalkMode('ptt'));
  if (btnModeOpen) btnModeOpen.addEventListener('click', () => switchTalkMode('open'));

  function switchTalkMode(mode) {
    talkMode = mode;
    if (mode === 'ptt') {
      btnModePTT.classList.add('active');
      btnModeOpen.classList.remove('active');
      btnPTT.style.display = 'flex';
    } else {
      btnModeOpen.classList.add('active');
      btnModePTT.classList.remove('active');
      btnPTT.style.display = 'none';
      unlockAudioContexts();
    }
    socket.emit('update-state', { talkMode });
    updateUserCardState(socket.id, { talkMode });
  }

  if (btnToggleMute) btnToggleMute.addEventListener('click', toggleMute);

  function toggleMute() {
    isMuted = !isMuted;
    btnToggleMute.classList.toggle('active-muted', isMuted);
    muteIcon.textContent = isMuted ? '🔇' : '🎙️';
    muteLabel.textContent = isMuted ? 'Unmute' : 'Mute';

    if (window.soundFX) window.soundFX.playMuteToggle(isMuted);
    if (isMuted && isTransmitting) stopTransmitting();

    socket.emit('update-state', { isMuted });
    updateUserCardState(socket.id, { isMuted });
  }

  if (btnToggleDeafen) btnToggleDeafen.addEventListener('click', toggleDeafen);

  function toggleDeafen() {
    isDeafened = !isDeafened;
    btnToggleDeafen.classList.toggle('active-muted', isDeafened);
    deafenIcon.textContent = isDeafened ? '🔇' : '🎧';
    deafenLabel.textContent = isDeafened ? 'Undeafen' : 'Deafen';

    socket.emit('update-state', { isDeafened });
    updateUserCardState(socket.id, { isDeafened });
  }

  // -------------------------------------------------------------
  // Participant Card Rendering
  // -------------------------------------------------------------
  function renderParticipantCard(socketId, user) {
    if (document.getElementById('emptyRoomPlaceholder')) {
      participantGrid.innerHTML = '';
    }

    const existingCard = document.getElementById(`pcard-${socketId}`);
    if (existingCard) existingCard.remove();

    const isSelf = socketId === socket.id;
    const isSelected = selectedTargetIds.has(socketId);
    const amIAdmin = currentUser && currentUser.isAdmin;

    const card = document.createElement('div');
    card.className = `participant-card ${isSelected ? 'selected-target' : ''}`;
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
        <span class="presence-badge-tag">${user.presenceStatus || 'Available 🟢'}</span>
      </div>
      ${!isSelf ? `
        <div class="card-actions-wrapper">
          <button class="btn-select-talk">${isSelected ? '✓ Selected' : '+ Select to Talk'}</button>
          ${amIAdmin ? `
            <button class="btn-admin-mute-user ${user.isMuted ? 'unmute' : ''}">
              ${user.isMuted ? '🔊 Remote Unmute' : '🔇 Remote Mute'}
            </button>
            <button class="btn-admin-kick-user">⛔ Kick User</button>
          ` : ''}
        </div>
      ` : ''}
    `;

    if (!isSelf) {
      const btnSelect = card.querySelector('.btn-select-talk');
      if (btnSelect) {
        btnSelect.addEventListener('click', (e) => {
          e.stopPropagation();
          toggleTargetPerson(socketId);
        });
      }

      const btnAdminMute = card.querySelector('.btn-admin-mute-user');
      if (btnAdminMute) {
        btnAdminMute.addEventListener('click', (e) => {
          e.stopPropagation();
          const targetUser = onlineUsersMap.get(socketId);
          const nextMute = targetUser ? !targetUser.isMuted : true;
          socket.emit('admin-mute-user', { targetSocketId: socketId, muteState: nextMute });
        });
      }

      const btnAdminKick = card.querySelector('.btn-admin-kick-user');
      if (btnAdminKick) {
        btnAdminKick.addEventListener('click', (e) => {
          e.stopPropagation();
          if (confirm(`Kick ${user.name} out of the voice room?`)) {
            socket.emit('admin-kick-user', { targetSocketId: socketId });
          }
        });
      }

      card.addEventListener('click', () => {
        toggleTargetPerson(socketId);
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
    if (card) card.classList.toggle('talking', isTalking);
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

      const adminMuteBtn = card.querySelector('.btn-admin-mute-user');
      if (adminMuteBtn) {
        adminMuteBtn.className = `btn-admin-mute-user ${state.isMuted ? 'unmute' : ''}`;
        adminMuteBtn.textContent = state.isMuted ? '🔊 Remote Unmute' : '🔇 Remote Mute';
      }
    }

    if (state.talkMode !== undefined) {
      const modeTag = card.querySelector('.badge-tag.ptt, .badge-tag.open');
      if (modeTag) {
        modeTag.className = `badge-tag ${state.talkMode}`;
        modeTag.textContent = state.talkMode.toUpperCase();
      }
    }

    if (state.presenceStatus !== undefined) {
      const presenceTag = card.querySelector('.presence-badge-tag');
      if (presenceTag) presenceTag.textContent = state.presenceStatus;
    }
  }

  function updateOnlineCount() {
    const count = onlineUsersMap.size;
    onlineCountBadge.textContent = `${count} ${count === 1 ? 'Colleague' : 'Colleagues'} Online`;
  }

  // -------------------------------------------------------------
  // 100% Reliable Local Telugu Vector SVG Meme Generator
  // -------------------------------------------------------------
  const TELUGU_MEME_STICKERS = [
    { id: 'brahmi-adhyaksha', tag: 'Brahmanandam', dialogue: 'Adhyaksha! Naku Ee Post Oddhu!', avatar: '👑' },
    { id: 'brahmi-enti-comedy', tag: 'Brahmanandam', dialogue: 'Enti Comedy-a? Nena Niku Comedy?', avatar: '😂' },
    { id: 'brahmi-mind-block', tag: 'Brahmanandam', dialogue: 'Mind Block Aipoyindi Subba Rao!', avatar: '🤯' },
    { id: 'brahmi-aaha', tag: 'Brahmanandam', dialogue: 'Aahaa.. Enna Combo Sir Enna Combo!', avatar: '😋' },
    { id: 'tillu-atla-untadhi', tag: 'DJ Tillu', dialogue: 'Atla Untadhi Manathoni!', avatar: '🎧' },
    { id: 'pushpa-thaggedhele', tag: 'Pushpa Raj', dialogue: 'Thaggedhe Le!', avatar: '🔥' },
    { id: 'venky-train', tag: 'Venky', dialogue: 'Train-lo Seet-lu Khali Ena Sir?', avatar: '🕶️' },
    { id: 'ali-jalsa', tag: 'Ali', dialogue: 'Jalsa Time.. Full Chill!', avatar: '🥳' },
    { id: 'ms-full-bottle', tag: 'MS Narayana', dialogue: 'Full Bottle Experience!', avatar: '🍺' },
    { id: 'sunil-rey-rey', tag: 'Sunil', dialogue: 'Rey Rey Agandi Ra Babu!', avatar: '🍿' },
    { id: 'relangi-manchivadu', tag: 'Relangi Mavayya', dialogue: 'Manishi Manchivadu Ra!', avatar: '👏' },
    { id: 'balayya-trouble', tag: 'Balayya', dialogue: "Don't Trouble The Trouble!", avatar: '🦁' },
    { id: 'rgv-logic', tag: 'RGV', dialogue: 'Logic Undha Inthaki?', avatar: '🧐' },
    { id: 'brahmi-escape', tag: 'Brahmanandam', dialogue: 'Silently Escaped.. Bye!', avatar: '🥷' },
    { id: 'brahmi-karma', tag: 'Brahmanandam', dialogue: 'Karma Ra Babu!', avatar: '🤦‍♂️' },
    { id: 'prabhas-chhatrapati', tag: 'Prabhas', dialogue: 'Oka Adugu Mungatiki!', avatar: '⚔️' }
  ];

  function getActorSvg(stickerId) {
    switch (stickerId) {
      case 'brahmi-adhyaksha':
      case 'brahmi-enti-comedy':
      case 'brahmi-mind-block':
      case 'brahmi-aaha':
      case 'brahmi-escape':
      case 'brahmi-karma':
      case 'brahmi-sensational':
      case 'brahmi-shocked':
        return `
          <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="60" cy="55" rx="32" ry="36" fill="#e0a96d"/>
            <path d="M 30 45 Q 40 25 60 30 Q 80 25 90 45 Q 85 22 60 20 Q 35 22 30 45 Z" fill="#222"/>
            <rect x="36" y="44" width="20" height="15" rx="3" fill="none" stroke="#111" stroke-width="3"/>
            <rect x="64" y="44" width="20" height="15" rx="3" fill="none" stroke="#111" stroke-width="3"/>
            <line x1="56" y1="50" x2="64" y2="50" stroke="#111" stroke-width="3"/>
            <circle cx="46" cy="51" r="4" fill="#111"/>
            <circle cx="74" cy="51" r="4" fill="#111"/>
            <path d="M 36 38 Q 46 31 56 38" stroke="#111" stroke-width="3" fill="none"/>
            <path d="M 64 38 Q 74 31 84 38" stroke="#111" stroke-width="3" fill="none"/>
            <path d="M 60 51 Q 65 60 58 64" fill="none" stroke="#b87b43" stroke-width="2.5"/>
            <path d="M 44 68 Q 60 64 76 68 Q 60 73 44 68 Z" fill="#222"/>
            <ellipse cx="60" cy="76" rx="12" ry="8" fill="#600"/>
            <path d="M 52 74 Q 60 78 68 74" fill="#fff"/>
            <path d="M 30 92 L 45 80 L 60 92 L 75 80 L 90 92 L 90 120 L 30 120 Z" fill="#fff"/>
            <polygon points="60,84 64,112 60,120 56,112" fill="#cc0000"/>
          </svg>
        `;
      case 'tillu-atla-untadhi':
        return `
          <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <circle cx="45" cy="30" r="14" fill="#222"/>
            <circle cx="60" cy="24" r="16" fill="#222"/>
            <circle cx="75" cy="30" r="14" fill="#222"/>
            <circle cx="35" cy="40" r="12" fill="#222"/>
            <circle cx="85" cy="40" r="12" fill="#222"/>
            <ellipse cx="60" cy="60" rx="30" ry="32" fill="#d89a60"/>
            <polygon points="32,48 56,48 52,62 36,62" fill="#f59e0b" stroke="#000" stroke-width="2"/>
            <polygon points="64,48 88,48 84,62 68,62" fill="#f59e0b" stroke="#000" stroke-width="2"/>
            <line x1="56" y1="52" x2="64" y2="52" stroke="#000" stroke-width="3"/>
            <path d="M 48 78 Q 65 85 74 74" fill="none" stroke="#300" stroke-width="3" stroke-linecap="round"/>
            <path d="M 24 65 C 24 100, 96 100, 96 65" fill="none" stroke="#ef4444" stroke-width="8"/>
            <rect x="18" y="55" width="12" height="20" rx="4" fill="#111"/>
            <rect x="90" y="55" width="12" height="20" rx="4" fill="#111"/>
            <path d="M 25 90 L 45 78 L 60 95 L 75 78 L 95 90 L 100 120 L 20 120 Z" fill="#7e22ce"/>
            <path d="M 50 85 Q 60 105 70 85" fill="none" stroke="#fbbf24" stroke-width="3"/>
          </svg>
        `;
      case 'pushpa-thaggedhele':
        return `
          <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <path d="M 28 42 Q 60 15 92 42 Q 80 25 60 25 Q 40 25 28 42 Z" fill="#3a1c06"/>
            <path d="M 26 40 Q 60 36 94 40 L 92 48 Q 60 44 28 48 Z" fill="#dc2626"/>
            <ellipse cx="60" cy="62" rx="30" ry="32" fill="#c48348"/>
            <ellipse cx="44" cy="52" rx="5" ry="4" fill="#fff"/>
            <circle cx="45" cy="52" r="2.5" fill="#111"/>
            <ellipse cx="76" cy="52" rx="5" ry="4" fill="#fff"/>
            <circle cx="75" cy="52" r="2.5" fill="#111"/>
            <path d="M 36 46 L 52 50" stroke="#222" stroke-width="3"/>
            <path d="M 84 46 L 68 50" stroke="#222" stroke-width="3"/>
            <path d="M 30 60 C 30 95, 90 95, 90 60 C 85 75, 35 75, 30 60 Z" fill="#271504"/>
            <path d="M 42 66 Q 60 62 78 66 Q 60 74 42 66 Z" fill="#1d0e02"/>
            <path d="M 35 82 Q 60 95 85 82" stroke="#c48348" stroke-width="10" stroke-linecap="round" fill="none"/>
            <path d="M 35 82 Q 60 95 85 82" stroke="#1d0e02" stroke-width="2" stroke-linecap="round" fill="none"/>
          </svg>
        `;
      case 'venky-train':
        return `
          <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <path d="M 30 45 Q 60 20 90 45 L 88 35 Q 60 15 32 35 Z" fill="#1e1e1e"/>
            <ellipse cx="60" cy="58" rx="28" ry="32" fill="#df9e62"/>
            <path d="M 34 46 L 56 46 L 52 62 L 38 62 Z" fill="#111" stroke="#eab308" stroke-width="2"/>
            <path d="M 64 46 L 86 46 L 82 62 L 68 62 Z" fill="#111" stroke="#eab308" stroke-width="2"/>
            <line x1="56" y1="48" x2="64" y2="48" stroke="#eab308" stroke-width="2"/>
            <path d="M 44 68 Q 60 64 76 68 Q 60 72 44 68 Z" fill="#111"/>
            <path d="M 48 76 Q 60 84 72 76" stroke="#500" stroke-width="2.5" fill="none"/>
            <path d="M 28 88 L 48 78 L 60 88 L 72 78 L 92 88 L 95 120 L 25 120 Z" fill="#ca8a04"/>
          </svg>
        `;
      case 'balayya-trouble':
        return `
          <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <path d="M 24 45 Q 60 10 96 45 Q 85 20 60 22 Q 35 20 24 45 Z" fill="#1c1917"/>
            <polygon points="60,32 63,40 57,40" fill="#dc2626"/>
            <ellipse cx="60" cy="58" rx="30" ry="32" fill="#d6975a"/>
            <ellipse cx="44" cy="48" rx="5" ry="3.5" fill="#fff"/>
            <circle cx="45" cy="48" r="2.5" fill="#000"/>
            <ellipse cx="76" cy="48" rx="5" ry="3.5" fill="#fff"/>
            <circle cx="75" cy="48" r="2.5" fill="#000"/>
            <path d="M 36 43 L 52 47" stroke="#000" stroke-width="3.5"/>
            <path d="M 84 43 L 68 47" stroke="#000" stroke-width="3.5"/>
            <path d="M 36 64 C 45 60, 55 64, 60 66 C 65 64, 75 60, 84 64 C 90 60, 82 72, 60 70 C 38 72, 30 60, 36 64 Z" fill="#1c1917"/>
            <path d="M 25 88 L 60 78 L 95 88 L 98 120 L 22 120 Z" fill="#f59e0b"/>
          </svg>
        `;
      case 'ms-full-bottle':
        return `
          <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <path d="M 28 42 Q 60 18 92 42 Q 85 22 60 22 Q 35 22 28 42 Z" fill="#64748b"/>
            <ellipse cx="60" cy="58" rx="28" ry="32" fill="#d9995d"/>
            <path d="M 38 48 Q 46 44 54 49" stroke="#111" stroke-width="3" fill="none"/>
            <path d="M 66 49 Q 74 44 82 48" stroke="#111" stroke-width="3" fill="none"/>
            <path d="M 26 86 L 45 76 L 60 92 L 75 76 L 94 86 L 96 120 L 24 120 Z" fill="#2563eb"/>
            <rect x="75" y="70" width="16" height="22" rx="2" fill="rgba(245,158,11,0.8)" stroke="#fff" stroke-width="2"/>
          </svg>
        `;
      case 'ali-jalsa':
        return `
          <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <polygon points="60,10 42,32 78,32" fill="#ec4899"/>
            <circle cx="60" cy="10" r="4" fill="#f59e0b"/>
            <ellipse cx="60" cy="58" rx="28" ry="30" fill="#d49354"/>
            <circle cx="44" cy="50" r="10" fill="#06b6d4" stroke="#000" stroke-width="2"/>
            <circle cx="76" cy="50" r="10" fill="#06b6d4" stroke="#000" stroke-width="2"/>
            <path d="M 42 72 Q 60 88 78 72 Z" fill="#fff" stroke="#111" stroke-width="2"/>
          </svg>
        `;
      case 'sunil-rey-rey':
        return `
          <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="60" cy="56" rx="30" ry="32" fill="#df9e62"/>
            <ellipse cx="60" cy="74" rx="14" ry="10" fill="#800" stroke="#000" stroke-width="2"/>
            <path d="M 48 70 Q 60 74 72 70" stroke="#fff" stroke-width="3" fill="none"/>
            <path d="M 18 60 Q 25 45 32 65" stroke="#df9e62" stroke-width="8" stroke-linecap="round" fill="none"/>
            <path d="M 102 60 Q 95 45 88 65" stroke="#df9e62" stroke-width="8" stroke-linecap="round" fill="none"/>
          </svg>
        `;
      case 'relangi-manchivadu':
        return `
          <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="60" cy="56" rx="28" ry="30" fill="#d9995d"/>
            <path d="M 44 72 Q 60 84 76 72" stroke="#700" stroke-width="3" fill="none"/>
            <path d="M 25 85 L 60 78 L 95 85 L 95 120 L 25 120 Z" fill="#ffffff" stroke="#cbd5e1" stroke-width="2"/>
          </svg>
        `;
      case 'rgv-logic':
        return `
          <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <ellipse cx="60" cy="58" rx="28" ry="32" fill="#c48348"/>
            <circle cx="44" cy="50" r="9" fill="#111"/>
            <circle cx="76" cy="50" r="9" fill="#111"/>
            <line x1="53" y1="50" x2="67" y2="50" stroke="#111" stroke-width="2"/>
            <path d="M 48 76 Q 60 72 72 76" stroke="#222" stroke-width="3" fill="none"/>
          </svg>
        `;
      case 'prabhas-chhatrapati':
      default:
        return `
          <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <path d="M 25 45 Q 60 15 95 45 Q 85 20 60 20 Q 35 20 25 45 Z" fill="#1c1917"/>
            <ellipse cx="60" cy="58" rx="28" ry="32" fill="#ca8a4b"/>
            <path d="M 24 88 L 60 78 L 96 88 L 98 120 L 22 120 Z" fill="#334155" stroke="#94a3b8" stroke-width="2"/>
          </svg>
        `;
    }
  }

  function renderVectorMemeSticker(sticker) {
    return `
      <div class="vector-meme-sticker">
        <div class="meme-header-bar">
          <span class="meme-actor-tag">${sticker.tag}</span>
        </div>
        <div class="vector-svg-container">
          ${getActorSvg(sticker.id)}
        </div>
        <div class="vector-dialogue-banner">"${sticker.dialogue}"</div>
      </div>
    `;
  }


  const EMOJI_LIST = [
    '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','😉','😍','🥰','😘','🤪',
    '😜','🤑','😎','🤩','🥳','🤯','😱','🤬','🤡','👻','💩','🔥','⭐','✨','💥','🎉',
    '🎊','💯','❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','👍','👎','👏','🙌','🤝',
    '👊','✊','🤞','✌️','🤟','🤘','👌','👈','👉','👆','👇','🖐️','🤙','💪','🙏','🎙️',
    '🎧','🔊','📱','💻','☕','🍺','🍿'
  ];

  const btnEmojiPicker = document.getElementById('btnEmojiPicker');
  const emojiPickerPanel = document.getElementById('emojiPickerPanel');
  const tabEmojis = document.getElementById('tabEmojis');
  const tabStickers = document.getElementById('tabStickers');
  const pickerContentEmojis = document.getElementById('pickerContentEmojis');
  const pickerContentStickers = document.getElementById('pickerContentStickers');
  const emojiGrid = document.getElementById('emojiGrid');
  const stickerGrid = document.getElementById('stickerGrid');

  function initEmojiAndStickerPicker() {
    if (!emojiGrid || !stickerGrid) return;

    emojiGrid.innerHTML = '';
    EMOJI_LIST.forEach(emoji => {
      const item = document.createElement('div');
      item.className = 'emoji-item';
      item.textContent = emoji;
      item.addEventListener('click', () => {
        chatInput.value += emoji;
        chatInput.focus();
      });
      emojiGrid.appendChild(item);
    });

    stickerGrid.innerHTML = '';
    TELUGU_MEME_STICKERS.forEach(sticker => {
      const card = document.createElement('div');
      card.className = 'sticker-card';
      card.innerHTML = renderVectorMemeSticker(sticker);
      card.addEventListener('click', () => {
        socket.emit('send-message', { text: '', sticker });
        if (emojiPickerPanel) emojiPickerPanel.classList.add('hidden');
      });
      stickerGrid.appendChild(card);
    });
  }

  initEmojiAndStickerPicker();

  if (btnEmojiPicker) {
    btnEmojiPicker.addEventListener('click', (e) => {
      e.stopPropagation();
      if (emojiPickerPanel) emojiPickerPanel.classList.toggle('hidden');
    });
  }

  document.addEventListener('click', (e) => {
    if (emojiPickerPanel && !emojiPickerPanel.contains(e.target) && e.target !== btnEmojiPicker) {
      emojiPickerPanel.classList.add('hidden');
    }
  });

  if (tabEmojis && tabStickers) {
    tabEmojis.addEventListener('click', () => {
      tabEmojis.classList.add('active');
      tabStickers.classList.remove('active');
      pickerContentEmojis.classList.remove('hidden');
      pickerContentStickers.classList.add('hidden');
    });

    tabStickers.addEventListener('click', () => {
      tabStickers.classList.add('active');
      tabEmojis.classList.remove('active');
      pickerContentStickers.classList.remove('hidden');
      pickerContentEmojis.classList.add('hidden');
    });
  }

  // -------------------------------------------------------------
  // File Attachment & Voice Memo Handlers
  // -------------------------------------------------------------
  if (btnAttachFile && inputFileAttachment) {
    btnAttachFile.addEventListener('click', () => inputFileAttachment.click());

    inputFileAttachment.addEventListener('change', () => {
      const file = inputFileAttachment.files[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const fileData = {
          name: file.name,
          type: file.type,
          dataUrl: e.target.result
        };
        socket.emit('send-message', { text: `Attached file: ${file.name}`, fileData });
        inputFileAttachment.value = '';
      };
      reader.readAsDataURL(file);
    });
  }

  // Voice Memo Recorder (up to 5s)
  if (btnRecordVoiceMemo) {
    let memoTimer = null;

    btnRecordVoiceMemo.addEventListener('mousedown', startVoiceMemoRecord);
    btnRecordVoiceMemo.addEventListener('mouseup', stopVoiceMemoRecord);
    btnRecordVoiceMemo.addEventListener('mouseleave', stopVoiceMemoRecord);

    btnRecordVoiceMemo.addEventListener('touchstart', (e) => { e.preventDefault(); startVoiceMemoRecord(); });
    btnRecordVoiceMemo.addEventListener('touchend', (e) => { e.preventDefault(); stopVoiceMemoRecord(); });

    async function startVoiceMemoRecord() {
      if (isRecordingMemo) return;
      isRecordingMemo = true;
      audioChunks = [];

      btnRecordVoiceMemo.classList.add('recording');

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        mediaRecorder = new MediaRecorder(stream);
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunks.push(e.data);
        };
        mediaRecorder.onstop = () => {
          stream.getTracks().forEach(t => t.stop());
          const blob = new Blob(audioChunks, { type: 'audio/webm' });
          const reader = new FileReader();
          reader.onload = () => {
            socket.emit('send-message', {
              text: '🎙️ Voice Memo (5s)',
              voiceMemo: { dataUrl: reader.result, duration: 5 }
            });
          };
          reader.readAsDataURL(blob);
        };
        mediaRecorder.start();

        memoTimer = setTimeout(() => {
          stopVoiceMemoRecord();
        }, 5000);
      } catch (err) {
        console.warn('Voice memo recording error:', err);
        isRecordingMemo = false;
        btnRecordVoiceMemo.classList.remove('recording');
      }
    }

    function stopVoiceMemoRecord() {
      if (!isRecordingMemo) return;
      isRecordingMemo = false;
      if (memoTimer) clearTimeout(memoTimer);
      btnRecordVoiceMemo.classList.remove('recording');

      if (mediaRecorder && mediaRecorder.state !== 'inactive') {
        mediaRecorder.stop();
      }
    }
  }

  // Chat Form Submit
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    socket.emit('send-message', { text });
    chatInput.value = '';
  });

  socket.on('new-message', (msg) => {
    appendChatMessage(msg);
  });

  socket.on('reaction-updated', ({ messageId, emoji, userName }) => {
    const bubble = chatMessagesMap.get(messageId);
    if (!bubble) return;

    let reactionsRow = bubble.querySelector('.chat-reactions-row');
    if (!reactionsRow) {
      reactionsRow = document.createElement('div');
      reactionsRow.className = 'chat-reactions-row';
      bubble.appendChild(reactionsRow);
    }

    let pill = reactionsRow.querySelector(`[data-emoji="${emoji}"]`);
    if (!pill) {
      pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'reaction-pill';
      pill.setAttribute('data-emoji', emoji);
      pill.setAttribute('data-count', '0');
      pill.innerHTML = `<span class="r-emoji">${emoji}</span> <span class="r-count">0</span>`;
      reactionsRow.appendChild(pill);
    }

    let count = parseInt(pill.getAttribute('data-count') || '0', 10) + 1;
    pill.setAttribute('data-count', count);
    pill.querySelector('.r-count').textContent = count;
    if (userName === (currentUser ? currentUser.name : '')) {
      pill.classList.add('user-reacted');
    }
  });

  function appendChatMessage(msg) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    if (msg.id) chatMessagesMap.set(msg.id, bubble);

    let contentHtml = '';
    if (msg.sticker) {
      contentHtml = `
        <div class="chat-sticker-photo-wrapper">
          ${renderVectorMemeSticker(msg.sticker)}
        </div>
      `;
    } else if (msg.voiceMemo) {
      contentHtml = `
        <div class="voice-memo-player">
          <button class="btn-play-memo" type="button">▶</button>
          <span class="memo-dur-badge">🎙️ Voice Memo (5s)</span>
          <audio src="${msg.voiceMemo.dataUrl}" style="display:none;"></audio>
        </div>
      `;
    } else if (msg.fileData) {
      if (msg.fileData.type && msg.fileData.type.startsWith('image/')) {
        contentHtml = `
          <div class="chat-text">${escapeHTML(msg.text)}</div>
          <img src="${msg.fileData.dataUrl}" class="chat-file-attachment" alt="Attached photo">
        `;
      } else {
        contentHtml = `
          <div class="chat-text">${escapeHTML(msg.text)}</div>
          <a href="${msg.fileData.dataUrl}" download="${msg.fileData.name}" style="color: var(--accent-gold); font-weight:700;">📎 Download ${msg.fileData.name}</a>
        `;
      }
    } else {
      contentHtml = `<div class="chat-text">${escapeHTML(msg.text)}</div>`;
    }

    const canPin = currentUser && currentUser.isAdmin;

    bubble.innerHTML = `
      <div class="chat-sender-row">
        <span class="chat-sender-name" style="color: ${msg.senderColor || '#3b82f6'};">
          ${msg.senderName} ${msg.isAdmin ? '👑 (Admin)' : ''}
        </span>
        <div style="display:flex; gap:6px; align-items:center;">
          <span class="chat-time">${msg.timestamp}</span>
          ${canPin ? `<button class="btn-add-reaction btn-pin-msg" title="Pin Announcement">📌</button>` : ''}
          <button class="btn-add-reaction btn-react-msg" title="React">😊</button>
        </div>
      </div>
      ${contentHtml}
      <div class="chat-reactions-row"></div>
    `;

    // Voice memo play handler
    const btnPlayMemo = bubble.querySelector('.btn-play-memo');
    if (btnPlayMemo) {
      const audioEl = bubble.querySelector('audio');
      btnPlayMemo.addEventListener('click', () => {
        if (audioEl) {
          audioEl.play();
          btnPlayMemo.textContent = '🔊';
          audioEl.onended = () => { btnPlayMemo.textContent = '▶'; };
        }
      });
    }

    // Reaction handler
    const btnReactMsg = bubble.querySelector('.btn-react-msg');
    if (btnReactMsg && msg.id) {
      btnReactMsg.addEventListener('click', () => {
        const quickEmojis = ['👍', '❤️', '😂', '🔥', '😮', '👏'];
        const chosen = quickEmojis[Math.floor(Math.random() * quickEmojis.length)];
        socket.emit('add-reaction', { messageId: msg.id, emoji: chosen });
      });
    }

    // Pin announcement handler
    const btnPinMsg = bubble.querySelector('.btn-pin-msg');
    if (btnPinMsg) {
      btnPinMsg.addEventListener('click', () => {
        const textToPin = msg.text || (msg.sticker ? msg.sticker.dialogue : 'Announcement');
        socket.emit('pin-message', { text: textToPin });
      });
    }

    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function escapeHTML(str) {
    if (!str) return '';
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  // Audio Settings & Sound FX Theme Selector
  if (btnAudioSettings) btnAudioSettings.addEventListener('click', () => modalAudioSettings.classList.remove('hidden'));
  if (btnCloseAudioSettings) btnCloseAudioSettings.addEventListener('click', () => modalAudioSettings.classList.add('hidden'));

  if (selectSoundTheme) {
    selectSoundTheme.addEventListener('change', () => {
      if (window.soundFX) window.soundFX.setTheme(selectSoundTheme.value);
    });
  }

  if (btnToggleSoundFX) {
    btnToggleSoundFX.addEventListener('click', () => {
      if (window.soundFX) {
        window.soundFX.enabled = !window.soundFX.enabled;
        btnToggleSoundFX.textContent = `🔊 Sound: ${window.soundFX.enabled ? 'ON' : 'OFF'}`;
      }
    });
  }

  function getRandomColor() {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
});
