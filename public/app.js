// OfficeTalk Client Logic - Multi-Target Person Selection & PCM Voice Engine

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const modalSetup = document.getElementById('modalSetup');
  const formSetup = document.getElementById('formSetup');
  const setupName = document.getElementById('setupName');

  const headerUserName = document.getElementById('headerUserName');
  const headerUserAvatar = document.getElementById('headerUserAvatar');
  const headerAdminTag = document.getElementById('headerAdminTag');
  const onlineCountBadge = document.getElementById('onlineCountBadge');

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

  const chatMessages = document.getElementById('chatMessages');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');

  const btnAudioSettings = document.getElementById('btnAudioSettings');
  const modalAudioSettings = document.getElementById('modalAudioSettings');
  const btnCloseAudioSettings = document.getElementById('btnCloseAudioSettings');
  const selectMicInput = document.getElementById('selectMicInput');
  const settingsVuFill = document.getElementById('settingsVuFill');
  const btnToggleSoundFX = document.getElementById('btnToggleSoundFX');

  // Admin Control Panel Elements
  const adminControlPanel = document.getElementById('adminControlPanel');
  const btnAdminBroadcast = document.getElementById('btnAdminBroadcast');
  const btnAdminMuteAll = document.getElementById('btnAdminMuteAll');
  const btnAdminUnmuteAll = document.getElementById('btnAdminUnmuteAll');

  // Application State
  const socket = io();
  let currentUser = null;

  // Multi-target Selection Set (stores socketIds or 'all')
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

  function checkIsAdmin(name) {
    if (!name) return false;
    const clean = name.trim().toLowerCase();
    return clean.includes('sagar');
  }

  // Audio Context Resumer
  function unlockAudioContexts() {
    if (txAudioContext && txAudioContext.state === 'suspended') {
      txAudioContext.resume();
    }
    if (rxAudioContext && rxAudioContext.state === 'suspended') {
      rxAudioContext.resume();
    }
    if (window.soundFX) {
      window.soundFX.init();
    }
  }

  document.addEventListener('click', unlockAudioContexts);
  document.addEventListener('touchstart', unlockAudioContexts);
  document.addEventListener('keydown', unlockAudioContexts);

  // Initialize Receiver Audio Context
  const AudioCtx = window.AudioContext || window.webkitAudioContext;
  rxAudioContext = new AudioCtx({ sampleRate: 16000 });

  // -------------------------------------------------------------
  // 1. Setup Form
  // -------------------------------------------------------------
  formSetup.addEventListener('submit', (e) => {
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

    modalSetup.style.display = 'none';
    modalSetup.classList.add('hidden');

    socket.emit('init-user', currentUser);
    unlockAudioContexts();

    initLocalMicrophone().catch(err => console.log('Mic init notice:', err));
  });

  // -------------------------------------------------------------
  // 2. PCM Audio Capture (ScriptProcessor PCM Int16)
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
          channelCount: 1,
          sampleRate: 16000,
          deviceId: deviceId ? { exact: deviceId } : undefined
        }
      };

      localStream = await navigator.mediaDevices.getUserMedia(constraints);
      setupPcmAudioCapture(localStream);
      populateAudioDevices();
    } catch (err) {
      console.error('[Microphone Capture Error]', err);
    }
  }

  function setupPcmAudioCapture(stream) {
    try {
      txAudioContext = new AudioCtx({ sampleRate: 16000 });
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

        socket.emit('voice-pcm', {
          targetSocketIds: targetsPayload,
          pcmData: pcm16.buffer
        });
      };

      source.connect(scriptProcessor);
      scriptProcessor.connect(txAudioContext.destination);

      monitorAudioVolume();
    } catch (err) {
      console.error('[PCM Audio Setup Error]', err);
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
  // 3. Socket.io PCM Voice Receiver
  // -------------------------------------------------------------
  socket.on('voice-pcm', ({ fromSocketId, senderName, pcmData }) => {
    if (isDeafened) return;

    if (rxAudioContext.state === 'suspended') {
      rxAudioContext.resume();
    }

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
      source.connect(rxAudioContext.destination);
      source.start();
    } catch (err) {
      console.error('PCM playback error:', err);
    }
  });

  socket.on('user-initialized', (selfData) => {
    window.soundFX.playJoinChime();
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

    if (isMuted && isTransmitting) {
      stopTransmitting();
    }

    if (window.soundFX) {
      window.soundFX.playMuteToggle(isMuted);
    }
  });

  if (btnAdminBroadcast) {
    btnAdminBroadcast.addEventListener('click', () => {
      selectedTargetIds.clear();
      selectedTargetIds.add('all');
      updateTargetUI();
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
    if (selectedTargetIds.size === 0) {
      selectedTargetIds.add('all');
    }
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

  socket.on('new-message', (msg) => {
    appendChatMessage(msg);
  });

  // -------------------------------------------------------------
  // 4. Multi-Target Person Selection Logic
  // -------------------------------------------------------------
  btnTargetEveryone.addEventListener('click', () => {
    selectedTargetIds.clear();
    selectedTargetIds.add('all');
    updateTargetUI();
  });

  function toggleTargetPerson(socketId) {
    if (selectedTargetIds.has('all')) {
      selectedTargetIds.clear();
    }

    if (selectedTargetIds.has(socketId)) {
      selectedTargetIds.delete(socketId);
    } else {
      selectedTargetIds.add(socketId);
    }

    if (selectedTargetIds.size === 0) {
      selectedTargetIds.add('all');
    }

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

    // Highlight participant cards
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
  // 5. Push-To-Talk & Voice Controls
  // -------------------------------------------------------------
  function startTransmitting() {
    if (isTransmitting || isMuted || isDeafened) return;
    isTransmitting = true;

    btnPTT.classList.add('transmitting');
    pttText.textContent = 'TRANSMITTING...';

    unlockAudioContexts();
    window.soundFX.playPttStart();

    socket.emit('update-state', { isTalking: true });
    updateUserCardTalking(socket.id, true);
  }

  function stopTransmitting() {
    if (!isTransmitting) return;
    isTransmitting = false;

    btnPTT.classList.remove('transmitting');
    pttText.textContent = 'HOLD TO TALK';

    window.soundFX.playPttEnd();

    socket.emit('update-state', { isTalking: false });
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
    } else {
      btnModeOpen.classList.add('active');
      btnModePTT.classList.remove('active');
      btnPTT.style.display = 'none';
      unlockAudioContexts();
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

    if (isMuted && isTransmitting) {
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

    socket.emit('update-state', { isDeafened });
    updateUserCardState(socket.id, { isDeafened });
  }

  // -------------------------------------------------------------
  // 6. Participant Card Rendering & Multi-Selection
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
      </div>
      ${!isSelf ? `
        <div class="card-actions-wrapper">
          <button class="btn-select-talk">${isSelected ? '✓ Selected' : '+ Select to Talk'}</button>
          ${amIAdmin ? `
            <button class="btn-admin-mute-user ${user.isMuted ? 'unmute' : ''}">
              ${user.isMuted ? '🔊 Remote Unmute' : '🔇 Remote Mute'}
            </button>
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
  }

  function updateOnlineCount() {
    const count = onlineUsersMap.size;
    onlineCountBadge.textContent = `${count} ${count === 1 ? 'Colleague' : 'Colleagues'} Online`;
  }

  // -------------------------------------------------------------
  // 7. Chat & Emoji/Telugu Meme Stickers Engine
  // -------------------------------------------------------------
  const btnEmojiPicker = document.getElementById('btnEmojiPicker');
  const emojiPickerPanel = document.getElementById('emojiPickerPanel');
  const tabEmojis = document.getElementById('tabEmojis');
  const tabStickers = document.getElementById('tabStickers');
  const pickerContentEmojis = document.getElementById('pickerContentEmojis');
  const pickerContentStickers = document.getElementById('pickerContentStickers');
  const emojiGrid = document.getElementById('emojiGrid');
  const stickerGrid = document.getElementById('stickerGrid');

  const EMOJI_LIST = [
    '😀','😃','😄','😁','😆','😅','😂','🤣','😊','😇','🙂','😉','😍','🥰','😘','🤪',
    '😜','🤑','😎','🤩','🥳','🤯','😱','🤬','🤡','👻','💩','🔥','⭐','✨','💥','🎉',
    '🎊','💯','❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','👍','👎','👏','🙌','🤝',
    '👊','✊','🤞','✌️','🤟','🤘','👌','👈','👉','👆','👇','🖐️','🤙','💪','🙏','🎙️',
    '🎧','🔊','📱','💻','☕','🍺','🍿'
  ];

  const TELUGU_MEME_STICKERS = [
    { id: 'brahmi-adhyaksha', tag: 'Brahmanandam', dialogue: 'Adhyaksha!' },
    { id: 'brahmi-enti-comedy', tag: 'Brahmanandam', dialogue: 'Enti Comedy-a?' },
    { id: 'brahmi-mind-block', tag: 'Brahmanandam', dialogue: 'Mind Blocked!' },
    { id: 'brahmi-aaha', tag: 'Brahmanandam', dialogue: 'Aahaa.. Enna Combo Sir!' },
    { id: 'brahmi-shocked', tag: 'Brahmanandam', dialogue: 'Abbo.. Ye Reethi Ga!' },
    { id: 'tillu-atla-untadhi', tag: 'DJ Tillu', dialogue: 'Atla Untadhi Manathoni!' },
    { id: 'pushpa-thaggedhele', tag: 'Pushpa Raj', dialogue: 'Thaggedhe Le!' },
    { id: 'venky-train', tag: 'Venky', dialogue: 'Train-lo Seet-lu Khali Ena?' },
    { id: 'ali-jalsa', tag: 'Ali', dialogue: 'Jalsa Time.. Full Chill!' },
    { id: 'ms-full-bottle', tag: 'MS Narayana', dialogue: 'Full Bottle Experience!' },
    { id: 'sunil-rey-rey', tag: 'Sunil', dialogue: 'Rey Rey Agandi Ra!' },
    { id: 'relangi-manchivadu', tag: 'Relangi Mavayya', dialogue: 'Manishi Manchivadu!' },
    { id: 'balayya-trouble', tag: 'Balayya', dialogue: "Don't Trouble The Trouble!" },
    { id: 'rgv-logic', tag: 'RGV', dialogue: 'Logic Undha Inthaki?' },
    { id: 'brahmi-escape', tag: 'Brahmanandam', dialogue: 'Silently Escaped..' },
    { id: 'brahmi-karma', tag: 'Brahmanandam', dialogue: 'Karma Ra Babu!' },
    { id: 'prabhas-chhatrapati', tag: 'Prabhas', dialogue: 'Oka Adugu Mungatiki!' },
    { id: 'brahmi-sensational', tag: 'Brahmanandam', dialogue: 'Sensational Entry!' }
  ];

  function getMemeStickerSvg(stickerId, tag, dialogue) {
    const configs = {
      'brahmi-adhyaksha': { c1: '#f59e0b', c2: '#b45309', icon: '👑', subtitle: 'BRAHMANANDAM' },
      'brahmi-enti-comedy': { c1: '#ef4444', c2: '#991b1b', icon: '😂', subtitle: 'BRAHMANANDAM' },
      'brahmi-mind-block': { c1: '#8b5cf6', c2: '#5b21b6', icon: '🤯', subtitle: 'BRAHMANANDAM' },
      'brahmi-aaha': { c1: '#10b981', c2: '#047857', icon: '😋', subtitle: 'BRAHMANANDAM' },
      'brahmi-shocked': { c1: '#ec4899', c2: '#be185d', icon: '😱', subtitle: 'BRAHMANANDAM' },
      'tillu-atla-untadhi': { c1: '#06b6d4', c2: '#0e7490', icon: '🎧', subtitle: 'DJ TILLU' },
      'pushpa-thaggedhele': { c1: '#f97316', c2: '#c2410c', icon: '🔥', subtitle: 'PUSHPA RAJ' },
      'venky-train': { c1: '#3b82f6', c2: '#1d4ed8', icon: '🕶️', subtitle: 'VENKY' },
      'ali-jalsa': { c1: '#a855f7', c2: '#7e22ce', icon: '🥳', subtitle: 'ALI' },
      'ms-full-bottle': { c1: '#eab308', c2: '#a16207', icon: '🍺', subtitle: 'MS NARAYANA' },
      'sunil-rey-rey': { c1: '#14b8a6', c2: '#0f766e', icon: '🍿', subtitle: 'SUNIL' },
      'relangi-manchivadu': { c1: '#84cc16', c2: '#4d7c0f', icon: '👏', subtitle: 'RELANGI MAVAYYA' },
      'balayya-trouble': { c1: '#dc2626', c2: '#7f1d1d', icon: '🦁', subtitle: 'BALAYYA' },
      'rgv-logic': { c1: '#64748b', c2: '#334155', icon: '🧐', subtitle: 'RGV' },
      'brahmi-escape': { c1: '#6366f1', c2: '#3730a3', icon: '🥷', subtitle: 'BRAHMANANDAM' },
      'brahmi-karma': { c1: '#f43f5e', c2: '#9f1239', icon: '🤦‍♂️', subtitle: 'BRAHMANANDAM' },
      'prabhas-chhatrapati': { c1: '#0284c7', c2: '#0369a1', icon: '⚔️', subtitle: 'PRABHAS' },
      'brahmi-sensational': { c1: '#d97706', c2: '#78350f', icon: '⭐', subtitle: 'BRAHMANANDAM' }
    };

    const cfg = configs[stickerId] || { c1: '#f59e0b', c2: '#d97706', icon: '🎭', subtitle: tag };

    return `
      <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="100%" height="100%" style="border-radius:24px; filter: drop-shadow(0 6px 12px rgba(0,0,0,0.5));">
        <defs>
          <linearGradient id="bg-${stickerId}" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stop-color="${cfg.c1}" />
            <stop offset="100%" stop-color="${cfg.c2}" />
          </linearGradient>
        </defs>
        <rect x="8" y="8" width="184" height="184" rx="30" fill="url(#bg-${stickerId})" stroke="#ffffff" stroke-width="5" />
        <rect x="16" y="16" width="168" height="168" rx="22" fill="none" stroke="rgba(255,255,255,0.4)" stroke-width="2" stroke-dasharray="8,5" />
        <text x="100" y="86" font-size="56" text-anchor="middle" dominant-baseline="central" filter="drop-shadow(0 4px 6px rgba(0,0,0,0.5))">${cfg.icon}</text>
        <rect x="24" y="122" width="152" height="22" rx="11" fill="rgba(0,0,0,0.55)" />
        <text x="100" y="137" font-size="11" font-weight="900" font-family="'Plus Jakarta Sans', system-ui, sans-serif" fill="#facc15" text-anchor="middle" letter-spacing="1.2">${cfg.subtitle}</text>
        <rect x="18" y="149" width="164" height="30" rx="10" fill="#ffffff" />
        <text x="100" y="169" font-size="12" font-weight="900" font-family="'Plus Jakarta Sans', system-ui, sans-serif" fill="#0f172a" text-anchor="middle">"${dialogue}"</text>
      </svg>
    `;
  }

  function initEmojiAndStickerPicker() {
    if (!emojiGrid || !stickerGrid) return;

    // Populate Emojis
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

    // Populate Stickers
    stickerGrid.innerHTML = '';
    TELUGU_MEME_STICKERS.forEach(sticker => {
      const card = document.createElement('div');
      card.className = 'sticker-card';
      card.innerHTML = `
        <div class="sticker-svg-wrapper">
          ${getMemeStickerSvg(sticker.id, sticker.tag, sticker.dialogue)}
        </div>
      `;
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

    let contentHtml = '';
    if (msg.sticker) {
      contentHtml = `
        <div class="chat-sticker-visual-wrapper">
          ${getMemeStickerSvg(msg.sticker.id, msg.sticker.tag, msg.sticker.dialogue)}
        </div>
      `;
    } else {
      contentHtml = `<div class="chat-text">${escapeHTML(msg.text)}</div>`;
    }

    bubble.innerHTML = `
      <div class="chat-sender-row">
        <span class="chat-sender-name" style="color: ${msg.senderColor || '#3b82f6'};">
          ${msg.senderName} ${msg.isAdmin ? '👑 (Admin)' : ''}
        </span>
        <span class="chat-time">${msg.timestamp}</span>
      </div>
      ${contentHtml}
    `;

    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
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
