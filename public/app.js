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
      const nameVal = inputName || (nameEl ? nameEl.value : '') || localStorage.getItem('officetalk_user_name') || '';
      const rawName = nameVal.trim();
      
      const modal = document.getElementById('modalSetup');
      if (!rawName) {
        if (modal) {
          modal.style.cssText = 'display: flex !important; opacity: 1 !important; pointer-events: auto !important; visibility: visible !important;';
          modal.classList.remove('hidden');
        }
        return;
      }

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

      updateHeaderProfile(currentUser);

      if (modal) {
        modal.style.display = 'none';
        modal.classList.add('hidden');
        try { modal.remove(); } catch(e) {}
      }

      if (socket) {
        socket.emit('init-user', currentUser);
      }
      unlockAudioContexts();
      initLocalMicrophone().catch(err => console.log('Mic init notice:', err));
    } catch (err) {
      console.error('[User Connect Error]', err);
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

  function syncUserWithServer() {
    try {
      if (currentUser) {
        updateHeaderProfile(currentUser);
        socket.emit('init-user', currentUser);
      } else {
        const savedName = localStorage.getItem('officetalk_user_name') || '';
        const setupNameEl = document.getElementById('setupName');
        if (setupNameEl && savedName) {
          setupNameEl.value = savedName;
        }
        const modal = document.getElementById('modalSetup');
        if (modal) {
          modal.style.cssText = 'display: flex !important; opacity: 1 !important; pointer-events: auto !important; visibility: visible !important;';
          modal.classList.remove('hidden');
        }
      }
    } catch(e) {}
  }

  const userProfileBadge = document.getElementById('userProfileBadge');
  if (userProfileBadge) {
    userProfileBadge.addEventListener('click', () => {
      const modal = document.getElementById('modalSetup');
      if (modal) {
        modal.style.cssText = 'display: flex !important; opacity: 1 !important; pointer-events: auto !important; visibility: visible !important;';
        modal.classList.remove('hidden');
        const setupNameEl = document.getElementById('setupName');
        if (setupNameEl) setupNameEl.focus();
      }
    });
  }

  socket.on('connect', syncUserWithServer);
  if (socket.connected) {
    syncUserWithServer();
  }
  syncUserWithServer();


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

  function updateHeaderProfile(user) {
    if (!user) return;
    const hName = document.getElementById('headerUserName');
    const hAvatar = document.getElementById('headerUserAvatar');
    const hAdminTag = document.getElementById('headerAdminTag');
    const adminPanel = document.getElementById('adminControlPanel');

    if (hName) hName.textContent = user.name;
    if (hAvatar) hAvatar.textContent = user.avatar || (user.isAdmin ? '👑' : '👤');
    if (hAdminTag) {
      if (user.isAdmin) hAdminTag.classList.remove('hidden');
      else hAdminTag.classList.add('hidden');
    }
    if (adminPanel) {
      if (user.isAdmin) adminPanel.classList.remove('hidden');
      else adminPanel.classList.add('hidden');
    }
  }

  // -------------------------------------------------------------
  // User Management & Admin Socket Listeners
  // -------------------------------------------------------------
  socket.on('user-initialized', (selfData) => {
    if (window.soundFX) window.soundFX.playJoinChime();
    currentUser = selfData;
    updateHeaderProfile(selfData);


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
  // -------------------------------------------------------------
  // Telugu Movie-Style Sticker Packs v2.0.0 Engine
  // -------------------------------------------------------------
  const TELUGU_ACTOR_PACKS = [
    { id: 'all', name: '🌟 All Packs', emoji: '🌟' },
    { id: 'brahmanandam-classics', name: 'Brahmanandam', emoji: '😂', category: 'comedy' },
    { id: 'ali-comedy', name: 'Ali', emoji: '🤣', category: 'comedy' },
    { id: 'vennela-kishore', name: 'Vennela Kishore', emoji: '😏', category: 'reaction' },
    { id: 'ms-narayana', name: 'MS Narayana', emoji: '🍺', category: 'comedy' },
    { id: 'sunil', name: 'Sunil', emoji: '😄', category: 'comedy' },
    { id: 'raghu-babu', name: 'Raghu Babu', emoji: '😆', category: 'reaction' },
    { id: 'posani-krishna-murali', name: 'Posani', emoji: '😤', category: 'reaction' },
    { id: '30-years-prithvi', name: '30Yrs Prithvi', emoji: '😎', category: 'mass' },
    { id: 'pawan-kalyan', name: 'Pawan Kalyan', emoji: '🔥', category: 'mass' },
    { id: 'allu-arjun', name: 'Allu Arjun', emoji: '😎', category: 'mass' },
    { id: 'mahesh-babu', name: 'Mahesh Babu', emoji: '✨', category: 'reaction' },
    { id: 'jr-ntr', name: 'Jr NTR', emoji: '🔥', category: 'mass' },
    { id: 'ram-charan', name: 'Ram Charan', emoji: '💥', category: 'mass' },
    { id: 'prabhas', name: 'Prabhas', emoji: '👑', category: 'mass' },
    { id: 'chiranjeevi', name: 'Chiranjeevi', emoji: '⭐', category: 'mass' },
    { id: 'nani', name: 'Nani', emoji: '😊', category: 'comedy' }
  ];

  const TELUGU_MEME_STICKERS = [
    { id: 'brahmi-adhyaksha', tag: 'Brahmanandam', pack: 'brahmanandam-classics', category: 'comedy', dialogue: 'Adhyaksha! Naku Ee Post Oddhu!', titleTe: 'అధ్యక్షా! నాకు ఈ పోస్ట్ వద్దు!', keywords: ['brahmanandam', 'brahmi', 'adhyaksha', 'comedy', 'funny', 'అధ్యక్షా'] },
    { id: 'brahmi-enti-comedy', tag: 'Brahmanandam', pack: 'brahmanandam-classics', category: 'comedy', dialogue: 'Enti Comedy-a? Nena Niku Comedy?', titleTe: 'ఏంటి కామెడీయా?', keywords: ['brahmanandam', 'brahmi', 'comedy', 'funny', 'ఏంటి కామెడీయా'] },
    { id: 'brahmi-mind-block', tag: 'Brahmanandam', pack: 'brahmanandam-classics', category: 'reaction', dialogue: 'Mind Block Aipoyindi Subba Rao!', titleTe: 'మైండ్ బ్లాక్ అయిపోయింది!', keywords: ['brahmanandam', 'mind block', 'shock', 'మైండ్ బ్లాక్'] },
    { id: 'brahmi-aaha', tag: 'Brahmanandam', pack: 'brahmanandam-classics', category: 'comedy', dialogue: 'Aahaa.. Enna Combo Sir Enna Combo!', titleTe: 'ఎన్నా కాంబో సర్!', keywords: ['brahmanandam', 'combo', 'aaha', 'ఎన్నా కాంబో'] },
    { id: 'brahmi-escape', tag: 'Brahmanandam', pack: 'brahmanandam-classics', category: 'reaction', dialogue: 'Silently Escaped.. Bye!', titleTe: 'సైలెంట్‌గా ఎస్కేప్.. బై!', keywords: ['brahmanandam', 'escape', 'bye', 'సైలెంట్'] },
    { id: 'brahmi-karma', tag: 'Brahmanandam', pack: 'brahmanandam-classics', category: 'emotional', dialogue: 'Karma Ra Babu!', titleTe: 'కర్మ రా బాబు!', keywords: ['brahmanandam', 'karma', 'sad', 'కర్మ'] },

    { id: 'ali-jalsa', tag: 'Ali', pack: 'ali-comedy', category: 'comedy', dialogue: 'Jalsa Time.. Full Chill!', titleTe: 'జల్సా టైమ్.. ఫుల్ చిల్!', keywords: ['ali', 'jalsa', 'chill', 'జల్సా'] },
    { id: 'ali-katravelli', tag: 'Ali', pack: 'ali-comedy', category: 'reaction', dialogue: 'Katravelli.. Kya Bolta!', titleTe: 'కత్రవేల్లి.. క్యా బోల్తా!', keywords: ['ali', 'katravelli', 'కత్రవేల్లి'] },

    { id: 'vennela-brain-zero', tag: 'Vennela Kishore', pack: 'vennela-kishore', category: 'reaction', dialogue: 'Haath Mein Mobile.. Brain Zero!', titleTe: 'బ్రెయిన్ జీరో!', keywords: ['vennela kishore', 'mobile', 'zero', 'బ్రెయిన్'] },
    { id: 'vennela-confusion', tag: 'Vennela Kishore', pack: 'vennela-kishore', category: 'reaction', dialogue: 'Confusion Express!', titleTe: 'కన్ఫ్యూజన్ ఎక్స్‌ప్రెస్!', keywords: ['vennela kishore', 'confused', 'కన్ఫ్యూజన్'] },

    { id: 'ms-full-bottle', tag: 'MS Narayana', pack: 'ms-narayana', category: 'comedy', dialogue: 'Full Bottle Experience!', titleTe: 'ఫుల్ బాటిల్!', keywords: ['ms narayana', 'bottle', 'drink', 'బాటిల్'] },
    { id: 'ms-peggy', tag: 'MS Narayana', pack: 'ms-narayana', category: 'comedy', dialogue: 'Peggy Vesthe Siggenduku!', titleTe: 'పెగ్గేస్తే సిగ్గెందుకు!', keywords: ['ms narayana', 'peg', 'సొంతం'] },

    { id: 'sunil-rey-rey', tag: 'Sunil', pack: 'sunil', category: 'comedy', dialogue: 'Rey Rey Agandi Ra Babu!', titleTe: 'రేయ్ రేయ్ ఆగండి రా!', keywords: ['sunil', 'rey rey', 'agandi', 'రేయ్ రేయ్'] },
    { id: 'sunil-six-pack', tag: 'Sunil', pack: 'sunil', category: 'mass', dialogue: 'Six Pack Super Look!', titleTe: 'సిక్స్ ప్యాక్ లుక్!', keywords: ['sunil', 'six pack', 'mass', 'సిక్స్ ప్యాక్'] },

    { id: 'raghu-em-cheppav', tag: 'Raghu Babu', pack: 'raghu-babu', category: 'reaction', dialogue: 'Em Cheppav Ra Babji!', titleTe: 'ఏం చెప్పావ్ రా బాబ్జీ!', keywords: ['raghu babu', 'babji', 'ఏం చెప్పావ్'] },
    { id: 'posani-mental', tag: 'Posani Krishna Murali', pack: 'posani-krishna-murali', category: 'angry', dialogue: 'Mental Ekkinchesthunnaru Ra!', titleTe: 'మెంటల్ ఎక్కిస్తున్నారు!', keywords: ['posani', 'mental', 'angry', 'మెంటల్'] },

    { id: 'prithvi-30-years', tag: '30 Years Prithvi', pack: '30-years-prithvi', category: 'mass', dialogue: '30 Years Industry Ikada!', titleTe: '30 ఇయర్స్ ఇండస్ట్రీ!', keywords: ['prithvi', '30 years', 'industry', '30 ఇయర్స్'] },
    { id: 'pk-chudappa', tag: 'Pawan Kalyan', pack: 'pawan-kalyan', category: 'mass', dialogue: 'Chudappa Siddappa!', titleTe: 'చూడప్పా సిద్దప్పా!', keywords: ['pawan kalyan', 'pk', 'powerstar', 'సిద్దప్పా'] },
    { id: 'pk-gabbar-singh', tag: 'Pawan Kalyan', pack: 'pawan-kalyan', category: 'mass', dialogue: 'Nenu Koddiga Teradaga Untanu!', titleTe: 'కొద్దిగా తేడాగా ఉంటాను!', keywords: ['pawan kalyan', 'gabbar singh', 'తేడాగా'] },

    { id: 'allu-pushpa', tag: 'Allu Arjun', pack: 'allu-arjun', category: 'mass', dialogue: 'Thaggedhe Le!', titleTe: 'తగ్గేదే లే!', keywords: ['allu arjun', 'pushpa', 'thaggedhele', 'తగ్గేదే లే'] },
    { id: 'mahesh-pokiri', tag: 'Mahesh Babu', pack: 'mahesh-babu', category: 'mass', dialogue: 'Mind Lo Fix Aithe Blind Ga Vellipotha!', titleTe: 'మైండ్‌లో ఫిక్స్ అయితే!', keywords: ['mahesh babu', 'pokiri', 'blind', 'ఫిక్స్'] },
    { id: 'ntr-rrr', tag: 'Jr NTR', pack: 'jr-ntr', category: 'mass', dialogue: 'RRR Bheem Mass Fire!', titleTe: 'భీమ్ మాస్ ఫైర్!', keywords: ['jr ntr', 'ntr', 'rrr', 'bheem', 'భీమ్'] },
    { id: 'charan-rangasthalam', tag: 'Ram Charan', pack: 'ram-charan', category: 'mass', dialogue: 'Rangasthalam Chittibabu Mass!', titleTe: 'చిట్టిబాబు మాస్!', keywords: ['ram charan', 'chittibabu', 'rangasthalam', 'చిట్టిబాబు'] },
    { id: 'prabhas-chhatrapati', tag: 'Prabhas', pack: 'prabhas', category: 'mass', dialogue: 'Oka Adugu Mungatiki!', titleTe: 'ఒక అడుగు ముంగాటికి!', keywords: ['prabhas', 'darling', 'chhatrapati', 'అడుగు'] },
    { id: 'chiru-boss', tag: 'Chiranjeevi', pack: 'chiranjeevi', category: 'mass', dialogue: 'Boss Is Back!', titleTe: 'బాస్ ఈజ్ బ్యాక్!', keywords: ['chiranjeevi', 'chiru', 'boss', 'బాస్'] },
    { id: 'nani-natural', tag: 'Nani', pack: 'nani', category: 'comedy', dialogue: 'Natural Star Simplicity!', titleTe: 'నేచురల్ స్టార్!', keywords: ['nani', 'natural star', 'simplicity', 'నేచురల్'] },

    { id: 'tillu-atla-untadhi', tag: 'DJ Tillu', pack: 'brahmanandam-classics', category: 'mass', dialogue: 'Atla Untadhi Manathoni!', titleTe: 'అట్లా ఉంటది మనతోని!', keywords: ['tillu', 'dj tillu', 'atla untadhi', 'అట్లా ఉంటది'] },
    { id: 'venky-train', tag: 'Venky', pack: 'brahmanandam-classics', category: 'comedy', dialogue: 'Train-lo Seet-lu Khali Ena Sir?', titleTe: 'ట్రైన్‌లో సీట్లు ఖాళీ ఏనా?', keywords: ['venky', 'train', 'seet', 'సీట్లు'] },
    { id: 'balayya-trouble', tag: 'Balayya', pack: 'brahmanandam-classics', category: 'mass', dialogue: "Don't Trouble The Trouble!", titleTe: 'డోంట్ ట్రబుల్ ది ట్రబుల్!', keywords: ['balayya', 'trouble', 'nbk', 'ట్రబుల్'] },
    { id: 'relangi-manchivadu', tag: 'Relangi Mavayya', pack: 'brahmanandam-classics', category: 'celebration', dialogue: 'Manishi Manchivadu Ra!', titleTe: 'మనిషి మంచివాడు రా!', keywords: ['relangi', 'manchivadu', 'మంచివాడు'] },
    { id: 'rgv-logic', tag: 'RGV', pack: 'brahmanandam-classics', category: 'reaction', dialogue: 'Logic Undha Inthaki?', dialogue: 'Logic Undha Inthaki?', titleTe: 'లాజిక్ ఉందా ఇంతకీ?', keywords: ['rgv', 'logic', 'లాజిక్'] }
  ];

  function getActorSvg(stickerId) {
    switch (stickerId) {
      case 'brahmi-adhyaksha':
      case 'brahmi-enti-comedy':
      case 'brahmi-mind-block':
      case 'brahmi-aaha':
      case 'brahmi-escape':
      case 'brahmi-karma':
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
            <ellipse cx="60" cy="76" rx="12" ry="8" fill="#600"/>
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
            <ellipse cx="60" cy="60" rx="30" ry="32" fill="#d89a60"/>
            <polygon points="32,48 56,48 52,62 36,62" fill="#f59e0b" stroke="#000" stroke-width="2"/>
            <polygon points="64,48 88,48 84,62 68,62" fill="#f59e0b" stroke="#000" stroke-width="2"/>
            <path d="M 24 65 C 24 100, 96 100, 96 65" fill="none" stroke="#ef4444" stroke-width="8"/>
            <path d="M 25 90 L 45 78 L 60 95 L 75 78 L 95 90 L 100 120 L 20 120 Z" fill="#7e22ce"/>
          </svg>
        `;
      case 'allu-pushpa':
      case 'pushpa-thaggedhele':
        return `
          <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg">
            <path d="M 28 42 Q 60 15 92 42 Q 80 25 60 25 Q 40 25 28 42 Z" fill="#3a1c06"/>
            <ellipse cx="60" cy="62" rx="30" ry="32" fill="#c48348"/>
            <ellipse cx="44" cy="52" rx="5" ry="4" fill="#fff"/>
            <circle cx="45" cy="52" r="2.5" fill="#111"/>
            <ellipse cx="76" cy="52" rx="5" ry="4" fill="#fff"/>
            <circle cx="75" cy="52" r="2.5" fill="#111"/>
            <path d="M 30 60 C 30 95, 90 95, 90 60 C 85 75, 35 75, 30 60 Z" fill="#271504"/>
          </svg>
        `;
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

  const STICKER_PACK_EMOJIS = {
    'telugu-comedy': '😂',
    'mass': '😎',
    'emotional': '😭',
    'angry': '😡',
    'reaction': '🤦',
    'love': '❤️',
    'celebration': '🎉'
  };

  const TELUGU_REACTION_STICKERS = [
    { id: "telugu_001", title: "Ayyo", titleTe: "అయ్యో", pack: "telugu-comedy", category: "comedy", keywords: ["ayyo", "అయ్యో"] },
    { id: "telugu_002", title: "Ayyababoi", titleTe: "అయ్యబాబోయ్", pack: "telugu-comedy", category: "comedy", keywords: ["ayyababoi", "అయ్యబాబోయ్"] },
    { id: "telugu_003", title: "Enti Idi?", titleTe: "ఏంటి ఇది?", pack: "telugu-comedy", category: "comedy", keywords: ["enti idi", "ఏంటి ఇది"] },
    { id: "telugu_004", title: "Na Valla Kaadu", titleTe: "నా వల్ల కాదు", pack: "telugu-comedy", category: "comedy", keywords: ["na valla kaadu", "నా వల్ల కాదు"] },
    { id: "telugu_005", title: "Artham Kaaledu", titleTe: "అర్థం కాలేదు", pack: "telugu-comedy", category: "comedy", keywords: ["artham kaaledu", "అర్థం కాలేదు"] },
    { id: "telugu_021", title: "Mass", titleTe: "మాస్", pack: "mass", category: "mass", keywords: ["mass", "మాస్"] },
    { id: "telugu_022", title: "Thaggede Le", titleTe: "తగ్గేదే లే", pack: "mass", category: "mass", keywords: ["thaggede le", "తగ్గేదే లే"] },
    { id: "telugu_031", title: "Edustunna", titleTe: "ఏడుస్తున్నా 😭", pack: "emotional", category: "emotional", keywords: ["edustunna", "ఏడుస్తున్నా"] },
    { id: "telugu_041", title: "Naaku Kopam Vastundi", titleTe: "నాకు కోపం వస్తుంది", pack: "angry", category: "angry", keywords: ["kopam", "కోపం"] },
    { id: "telugu_051", title: "Ayyo Devuda", titleTe: "అయ్యో దేవుడా", pack: "reaction", category: "reaction", keywords: ["ayyo devuda", "అయ్యో దేవుడా"] },
    { id: "telugu_061", title: "Nuvve Na World", titleTe: "నువ్వే నా వరల్డ్ ❤️", pack: "love", category: "love", keywords: ["love", "నువ్వే నా వరల్డ్"] },
    { id: "telugu_071", title: "Super", titleTe: "సూపర్! 🎉", pack: "celebration", category: "celebration", keywords: ["super", "సూపర్"] }
  ];

  // Helper functions for Favorites and Recent
  function getRecentStickers() {
    try { return JSON.parse(localStorage.getItem('officetalk_recent_stickers') || '[]'); } catch(e) { return []; }
  }

  function addRecentSticker(stkId) {
    let recent = getRecentStickers();
    recent = recent.filter(id => id !== stkId);
    recent.unshift(stkId);
    if (recent.length > 30) recent = recent.slice(0, 30);
    try { localStorage.setItem('officetalk_recent_stickers', JSON.stringify(recent)); } catch(e) {}
  }

  function getFavoriteStickers() {
    try { return JSON.parse(localStorage.getItem('officetalk_favorite_stickers') || '[]'); } catch(e) { return []; }
  }

  function toggleFavoriteSticker(stkId) {
    let favs = getFavoriteStickers();
    if (favs.includes(stkId)) {
      favs = favs.filter(id => id !== stkId);
    } else {
      if (favs.length < 500) favs.push(stkId);
    }
    try { localStorage.setItem('officetalk_favorite_stickers', JSON.stringify(favs)); } catch(e) {}
  }

  // DOM elements for Picker
  const btnEmojiPicker = document.getElementById('btnEmojiPicker');
  const btnStickerPicker = document.getElementById('btnStickerPicker');
  const btnClosePicker = document.getElementById('btnClosePicker');
  const emojiPickerPanel = document.getElementById('emojiPickerPanel');
  const pickerSearchContainer = document.getElementById('pickerSearchContainer');
  const stickerSearchInput = document.getElementById('stickerSearchInput');
  const btnClearStickerSearch = document.getElementById('btnClearStickerSearch');

  const tabEmojis = document.getElementById('tabEmojis');
  const tabStickers = document.getElementById('tabStickers');
  const tabGifs = document.getElementById('tabGifs');

  const pickerContentEmojis = document.getElementById('pickerContentEmojis');
  const pickerContentStickers = document.getElementById('pickerContentStickers');
  const pickerContentGifs = document.getElementById('pickerContentGifs');

  const emojiGrid = document.getElementById('emojiGrid');
  const stickerGrid = document.getElementById('stickerGrid');

  let activeCategory = 'trending';
  let activeActorPack = 'all';
  let activeSearchQuery = '';

  const STICKER_CATEGORIES = [
    { id: 'trending', name: '🔥 Trending' },
    { id: 'recent', name: '🕘 Recent' },
    { id: 'favorites', name: '⭐ Favorites' },
    { id: 'comedy', name: '😂 Comedy' },
    { id: 'mass', name: '😎 Mass' },
    { id: 'reaction', name: '🤦 Reactions' },
    { id: 'emotional', name: '😭 Emotional' },
    { id: 'love', name: '❤️ Love' },
    { id: 'celebration', name: '🎉 Celebration' }
  ];

  function renderCategoryPills() {
    const bar = document.getElementById('stickerCategoryTabs');
    if (!bar) return;
    bar.innerHTML = '';
    STICKER_CATEGORIES.forEach(cat => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `cat-pill ${activeCategory === cat.id ? 'active' : ''}`;
      btn.textContent = cat.name;
      btn.addEventListener('click', () => {
        activeCategory = cat.id;
        activeActorPack = 'all';
        renderCategoryPills();
        renderActorSubnavPills();
        renderStickersGrid();
      });
      bar.appendChild(btn);
    });
  }

  function renderActorSubnavPills() {
    const subnav = document.getElementById('stickerPacksSubnav');
    if (!subnav) return;
    subnav.innerHTML = '';
    TELUGU_ACTOR_PACKS.forEach(pack => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `pack-pill ${activeActorPack === pack.id ? 'active' : ''}`;
      btn.textContent = `${pack.emoji} ${pack.name}`;
      btn.addEventListener('click', () => {
        activeActorPack = pack.id;
        renderActorSubnavPills();
        renderStickersGrid();
      });
      subnav.appendChild(btn);
    });
  }

  function renderStickersGrid() {
    if (!stickerGrid) return;
    stickerGrid.innerHTML = '';

    const favs = getFavoriteStickers();
    const recents = getRecentStickers();
    const query = activeSearchQuery.trim().toLowerCase();

    let list = [...TELUGU_MEME_STICKERS];

    // Filter by Search Query
    if (query) {
      list = list.filter(stk => {
        const textToSearch = `${stk.tag} ${stk.dialogue} ${stk.titleTe} ${(stk.keywords||[]).join(' ')} ${stk.pack} ${stk.category}`.toLowerCase();
        return textToSearch.includes(query);
      });
    } else {
      // Filter by Category
      if (activeCategory === 'recent') {
        list = list.filter(stk => recents.includes(stk.id));
        list.sort((a, b) => recents.indexOf(a.id) - recents.indexOf(b.id));
      } else if (activeCategory === 'favorites') {
        list = list.filter(stk => favs.includes(stk.id));
      } else if (activeCategory !== 'trending') {
        list = list.filter(stk => stk.category === activeCategory);
      }

      // Filter by Actor Pack
      if (activeActorPack !== 'all') {
        list = list.filter(stk => stk.pack === activeActorPack);
      }
    }

    if (list.length === 0) {
      stickerGrid.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; color: var(--text-muted); padding: 20px;">
          No stickers found matching your search.
        </div>
      `;
      return;
    }

    list.forEach(stk => {
      const isFav = favs.includes(stk.id);
      const card = document.createElement('div');
      card.className = 'sticker-card';
      card.innerHTML = `
        <button type="button" class="favorite-star-btn ${isFav ? 'is-favorite' : ''}" title="${isFav ? 'Remove Favorite' : 'Add Favorite'}">⭐</button>
        ${renderVectorMemeSticker(stk)}
      `;

      const favBtn = card.querySelector('.favorite-star-btn');
      favBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleFavoriteSticker(stk.id);
        renderStickersGrid();
      });

      card.addEventListener('click', () => {
        addRecentSticker(stk.id);
        socket.emit('send-message', { text: '', sticker: stk });
        if (emojiPickerPanel) emojiPickerPanel.classList.add('hidden');
      });

      stickerGrid.appendChild(card);
    });
  }

  function initEmojiAndStickerPicker() {
    if (!emojiGrid) return;
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

    renderCategoryPills();
    renderActorSubnavPills();
    renderStickersGrid();
  }

  initEmojiAndStickerPicker();

  // Search input listeners
  if (stickerSearchInput) {
    stickerSearchInput.addEventListener('input', () => {
      activeSearchQuery = stickerSearchInput.value;
      if (btnClearStickerSearch) {
        if (activeSearchQuery) btnClearStickerSearch.classList.remove('hidden');
        else btnClearStickerSearch.classList.add('hidden');
      }
      renderStickersGrid();
    });
  }

  if (btnClearStickerSearch) {
    btnClearStickerSearch.addEventListener('click', () => {
      if (stickerSearchInput) stickerSearchInput.value = '';
      activeSearchQuery = '';
      btnClearStickerSearch.classList.add('hidden');
      renderStickersGrid();
    });
  }

  // Trigger buttons
  if (btnEmojiPicker) {
    btnEmojiPicker.addEventListener('click', (e) => {
      e.stopPropagation();
      openPickerTab('emoji');
    });
  }

  if (btnStickerPicker) {
    btnStickerPicker.addEventListener('click', (e) => {
      e.stopPropagation();
      openPickerTab('stickers');
    });
  }

  if (btnClosePicker) {
    btnClosePicker.addEventListener('click', () => {
      if (emojiPickerPanel) emojiPickerPanel.classList.add('hidden');
    });
  }

  function openPickerTab(tabName) {
    if (!emojiPickerPanel) return;
    emojiPickerPanel.classList.remove('hidden');

    if (tabName === 'emoji') {
      tabEmojis.classList.add('active');
      tabStickers.classList.remove('active');
      tabGifs.classList.remove('active');
      pickerContentEmojis.classList.remove('hidden');
      pickerContentStickers.classList.add('hidden');
      pickerContentGifs.classList.add('hidden');
      if (pickerSearchContainer) pickerSearchContainer.classList.add('hidden');
    } else if (tabName === 'stickers') {
      tabStickers.classList.add('active');
      tabEmojis.classList.remove('active');
      tabGifs.classList.remove('active');
      pickerContentStickers.classList.remove('hidden');
      pickerContentEmojis.classList.add('hidden');
      pickerContentGifs.classList.add('hidden');
      if (pickerSearchContainer) pickerSearchContainer.classList.remove('hidden');
      renderStickersGrid();
    } else if (tabName === 'gifs') {
      tabGifs.classList.add('active');
      tabEmojis.classList.remove('active');
      tabStickers.classList.remove('active');
      pickerContentGifs.classList.remove('hidden');
      pickerContentEmojis.classList.add('hidden');
      pickerContentStickers.classList.add('hidden');
      if (pickerSearchContainer) pickerSearchContainer.classList.add('hidden');
    }
  }

  if (tabEmojis) tabEmojis.addEventListener('click', () => openPickerTab('emoji'));
  if (tabStickers) tabStickers.addEventListener('click', () => openPickerTab('stickers'));
  if (tabGifs) tabGifs.addEventListener('click', () => openPickerTab('gifs'));

  // Outside click & ESC key dismiss
  document.addEventListener('click', (e) => {
    if (emojiPickerPanel && !emojiPickerPanel.contains(e.target) && e.target !== btnEmojiPicker && e.target !== btnStickerPicker) {
      emojiPickerPanel.classList.add('hidden');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && emojiPickerPanel && !emojiPickerPanel.classList.contains('hidden')) {
      emojiPickerPanel.classList.add('hidden');
    }
  });

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
    } else if (msg.reactionSticker) {
      contentHtml = `
        <div class="chat-sticker-reaction-wrapper">
          <span class="sticker-pack-emoji" style="font-size: 38px;">${msg.reactionSticker.emoji}</span>
          <span style="font-size: 16px; font-weight: 900; color: #ffffff; text-align: center;">${msg.reactionSticker.titleTe}</span>
          <span style="font-size: 10px; font-weight: 700; color: var(--accent-gold); text-transform: uppercase; letter-spacing: 0.5px;">${msg.reactionSticker.title}</span>
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
