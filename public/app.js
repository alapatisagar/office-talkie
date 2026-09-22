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
  const sidebarChat = document.getElementById('sidebarChat');
  const btnToggleChatSidebar = document.getElementById('btnToggleChatSidebar');
  const chatUnreadBadge = document.getElementById('chatUnreadBadge');
  const btnCloseSidebar = document.getElementById('btnCloseSidebar');
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

  // App Theme & New Options Elements
  const selectAppTheme = document.getElementById('selectAppTheme');
  const chatTabEveryone = document.getElementById('chatTabEveryone');
  const chatTabDM = document.getElementById('chatTabDM');
  const btnExportChat = document.getElementById('btnExportChat');
  const chatSearchInput = document.getElementById('chatSearchInput');
  const typingIndicatorBanner = document.getElementById('typingIndicatorBanner');
  const typingText = document.getElementById('typingText');
  const selectVoiceFilter = document.getElementById('selectVoiceFilter');
  const toggleNoiseSuppression = document.getElementById('toggleNoiseSuppression');
  const toggleEchoCancellation = document.getElementById('toggleEchoCancellation');
  const toggleAutoGain = document.getElementById('toggleAutoGain');

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

  let activeChatTab = 'everyone';
  let selectedDmSocketId = null;
  let typingTimeout = null;
  let activeVoiceFilter = 'normal';
  let unreadChatCount = 0;

  function updateUnreadBadge() {
    if (chatUnreadBadge) {
      if (unreadChatCount > 0) {
        chatUnreadBadge.textContent = unreadChatCount;
        chatUnreadBadge.classList.remove('hidden');
      } else {
        chatUnreadBadge.textContent = '0';
        chatUnreadBadge.classList.add('hidden');
      }
    }
  }

  function toggleChatSidebar(show) {
    if (!sidebarChat) return;
    const shouldShow = show !== undefined ? show : sidebarChat.classList.contains('collapsed');
    if (shouldShow) {
      sidebarChat.classList.remove('collapsed');
      unreadChatCount = 0;
      updateUnreadBadge();
    } else {
      sidebarChat.classList.add('collapsed');
    }
  }

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

  // Haptic feedback helper
  function triggerHaptic(pattern = [30]) {
    if ('vibrate' in navigator) {
      try { navigator.vibrate(pattern); } catch (e) {}
    }
  }

  // App Theme Switcher
  function applyAppTheme(themeName) {
    document.body.classList.remove('theme-cyberpunk', 'theme-matrix', 'theme-midnight');
    if (themeName !== 'slate') document.body.classList.add(`theme-${themeName}`);
    try { localStorage.setItem('officetalk_app_theme', themeName); } catch (e) {}
  }

  if (selectAppTheme) {
    const savedTheme = localStorage.getItem('officetalk_app_theme') || 'slate';
    selectAppTheme.value = savedTheme;
    applyAppTheme(savedTheme);
    selectAppTheme.addEventListener('change', () => applyAppTheme(selectAppTheme.value));
  }

  // Desktop Web Push Notification Helper
  function triggerDesktopNotification(title, options) {
    if ('Notification' in window && Notification.permission === 'granted' && document.hidden) {
      try { new Notification(title, options); } catch (e) {}
    }
  }
  if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
  }

  // Voice Memo recording variables
  let mediaRecorder = null;
  let audioChunks = [];
  let isRecordingMemo = false;

  const CARTOON_AVATAR_STICKERS = [
    {
      name: 'Shinchan',
      sticker: '👦 Shinchan',
      avatar: 'https://upload.wikimedia.org/wikipedia/en/7/70/Shin-chan_character.png',
      fallbackEmoji: '👦'
    },
    {
      name: 'Tom',
      sticker: '🐱 Tom (Tom & Jerry)',
      avatar: 'https://upload.wikimedia.org/wikipedia/en/f/f6/Tom_Cat.png',
      fallbackEmoji: '🐱'
    },
    {
      name: 'Jerry',
      sticker: '🐭 Jerry (Tom & Jerry)',
      avatar: 'https://upload.wikimedia.org/wikipedia/en/2/2f/Jerry_Mouse.png',
      fallbackEmoji: '🐭'
    },
    {
      name: 'Pikachu',
      sticker: '⚡ Pikachu (Pokemon)',
      avatar: 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png',
      fallbackEmoji: '⚡'
    },
    {
      name: 'Spiderman',
      sticker: '🕷️ Spiderman',
      avatar: 'https://upload.wikimedia.org/wikipedia/en/0/0c/Spiderman50.png',
      fallbackEmoji: '🕷️'
    },
    {
      name: 'Shaktimaan',
      sticker: '🦸‍♂️ Shaktimaan',
      avatar: 'https://upload.wikimedia.org/wikipedia/en/4/49/Shaktimaan.png',
      fallbackEmoji: '🦸‍♂️'
    },
    {
      name: 'Doraemon',
      sticker: '🤖 Doraemon',
      avatar: 'https://upload.wikimedia.org/wikipedia/en/b/bd/Doraemon_character.png',
      fallbackEmoji: '🤖'
    },
    {
      name: 'Goku',
      sticker: '💥 Goku (Dragon Ball)',
      avatar: 'https://upload.wikimedia.org/wikipedia/en/a/af/Son_Goku_Young.png',
      fallbackEmoji: '💥'
    },
    {
      name: 'Chhota Bheem',
      sticker: '🤼 Chhota Bheem',
      avatar: 'https://upload.wikimedia.org/wikipedia/en/2/23/Chhota_Bheem.png',
      fallbackEmoji: '🤼'
    },
    {
      name: 'Batman',
      sticker: '🦇 Batman',
      avatar: 'https://upload.wikimedia.org/wikipedia/en/c/c7/Batman_Infobox.png',
      fallbackEmoji: '🦇'
    },
    {
      name: 'Iron Man',
      sticker: '🦾 Iron Man',
      avatar: 'https://upload.wikimedia.org/wikipedia/en/4/47/Iron_Man_%28circa_2018%29.png',
      fallbackEmoji: '🦾'
    },
    {
      name: 'Captain America',
      sticker: '🛡️ Captain America',
      avatar: 'https://upload.wikimedia.org/wikipedia/en/3/37/Captain_America_%28Steve_Rogers%29.png',
      fallbackEmoji: '🛡️'
    },
    {
      name: 'Naruto',
      sticker: '🍥 Naruto',
      avatar: 'https://upload.wikimedia.org/wikipedia/en/9/94/Naruto_Uzumaki.png',
      fallbackEmoji: '🍥'
    },
    {
      name: 'Ben 10',
      sticker: '⌚ Ben 10',
      avatar: 'https://upload.wikimedia.org/wikipedia/en/c/c5/Ben_10_Omniverse_character_art.png',
      fallbackEmoji: '⌚'
    },
    {
      name: 'Minion',
      sticker: '🍌 Minion',
      avatar: 'https://upload.wikimedia.org/wikipedia/en/7/7d/Minions_characters.png',
      fallbackEmoji: '🍌'
    },
    {
      name: 'Super Mario',
      sticker: '🍄 Super Mario',
      avatar: 'https://upload.wikimedia.org/wikipedia/en/a/a9/MarioNSMBUDeluxe.png',
      fallbackEmoji: '🍄'
    },
    {
      name: 'Sonic',
      sticker: '🦔 Sonic',
      avatar: 'https://upload.wikimedia.org/wikipedia/en/2/2d/Sonic_the_Hedgehog_1991.png',
      fallbackEmoji: '🦔'
    }
  ];

  function checkIsAdmin(name) {
    if (!name) return false;
    const clean = name.trim().toLowerCase();
    return clean.includes('sagar') || clean.includes('admin') || clean.includes('host') || clean.includes('lead') || clean.includes('boss') || clean.includes('master');
  }

  function createSafeAudioContext() {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    try {
      return new AudioCtx();
    } catch (e) {
      return null;
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

  rxAudioContext = createSafeAudioContext();

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
  // User Login, Cartoon Sticker Picker & Admin Photo Setup Engine
  // -------------------------------------------------------------
  let selectedCartoonIndex = 0;
  let customAdminAvatarPhoto = null;

  function renderCartoonSetupGrid() {
    const gridEl = document.getElementById('cartoonCharacterGrid');
    const labelEl = document.getElementById('chosenCharacterLabel');
    if (!gridEl) return;

    gridEl.innerHTML = '';
    CARTOON_AVATAR_STICKERS.forEach((char, idx) => {
      const item = document.createElement('div');
      item.className = `cartoon-character-item ${idx === selectedCartoonIndex ? 'active-character' : ''}`;
      item.innerHTML = `
        <img src="${char.avatar}" class="cartoon-char-img" alt="${escapeHTML(char.name)}" onerror="this.onerror=null; this.outerHTML='<span class=\'cartoon-char-avatar\'>${char.fallbackEmoji}</span>';">
        <span class="cartoon-char-name">${char.name}</span>
      `;
      item.addEventListener('click', () => {
        selectedCartoonIndex = idx;
        document.querySelectorAll('.cartoon-character-item').forEach(el => el.classList.remove('active-character'));
        item.classList.add('active-character');
        if (labelEl) labelEl.textContent = char.sticker;
      });
      gridEl.appendChild(item);
    });

    if (labelEl && CARTOON_AVATAR_STICKERS[selectedCartoonIndex]) {
      labelEl.textContent = CARTOON_AVATAR_STICKERS[selectedCartoonIndex].sticker;
    }
  }

  function initSetupModalEvents() {
    const setupNameInput = document.getElementById('setupName');
    const nonAdminGroup = document.getElementById('nonAdminStickerGroup');
    const adminGroup = document.getElementById('adminPhotoUploadGroup');
    const inputPhoto = document.getElementById('inputAdminAvatarPhoto');
    const photoPreview = document.getElementById('adminPhotoPreview');

    renderCartoonSetupGrid();

    if (setupNameInput) {
      const updateRoleUI = () => {
        const val = setupNameInput.value;
        const isAdmin = checkIsAdmin(val);
        if (isAdmin) {
          if (adminGroup) adminGroup.classList.remove('hidden');
          if (nonAdminGroup) nonAdminGroup.classList.add('hidden');
        } else {
          if (nonAdminGroup) nonAdminGroup.classList.remove('hidden');
          if (adminGroup) adminGroup.classList.add('hidden');
        }
      };
      setupNameInput.addEventListener('input', updateRoleUI);
      updateRoleUI();
    }

    if (inputPhoto) {
      inputPhoto.addEventListener('change', () => {
        const file = inputPhoto.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
          alert('Photo size must be under 5 MB.');
          return;
        }
        const reader = new FileReader();
        reader.onload = (e) => {
          customAdminAvatarPhoto = e.target.result;
          if (photoPreview) {
            photoPreview.style.backgroundImage = `url('${customAdminAvatarPhoto}')`;
            photoPreview.classList.remove('hidden');
          }
        };
        reader.readAsDataURL(file);
      });
    }
  }

  setTimeout(initSetupModalEvents, 100);

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
          initSetupModalEvents();
        }
        return;
      }

      try { localStorage.setItem('officetalk_user_name', rawName); } catch (e) {}

      const isAdmin = checkIsAdmin(rawName);
      let avatar = '👑';
      let cartoonSticker = '👑 Admin';

      if (isAdmin) {
        avatar = customAdminAvatarPhoto || '👑';
        cartoonSticker = '👑 Admin';
      } else {
        const chosen = CARTOON_AVATAR_STICKERS[selectedCartoonIndex] || CARTOON_AVATAR_STICKERS[0];
        avatar = chosen.avatar;
        cartoonSticker = chosen.sticker;
      }

      const presenceStatus = selectPresenceStatus ? selectPresenceStatus.value : 'Available 🟢';

      currentUser = {
        name: rawName,
        isAdmin,
        avatar,
        cartoonSticker,
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

      const noiseSuppression = toggleNoiseSuppression ? toggleNoiseSuppression.checked : true;
      const echoCancellation = toggleEchoCancellation ? toggleEchoCancellation.checked : true;
      const autoGainControl = toggleAutoGain ? toggleAutoGain.checked : true;

      const audioOptions = {
        noiseSuppression,
        echoCancellation,
        autoGainControl
      };
      if (deviceId) audioOptions.deviceId = { exact: deviceId };

      try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: audioOptions });
      } catch (err) {
        console.warn('[Microphone Constraint Fallback Triggered]', err);
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      }
      setupPcmAudioCapture(localStream);
      populateAudioDevices();
    } catch (err) {
      console.warn('[Microphone Capture Notice]', err);
    }
  }

  function setupPcmAudioCapture(stream) {
    try {
      if (!txAudioContext) txAudioContext = createSafeAudioContext();
      if (!txAudioContext) return;

      analyser = txAudioContext.createAnalyser();
      analyser.fftSize = 512;

      const source = txAudioContext.createMediaStreamSource(stream);
      source.connect(analyser);

      // Voice Filter Node Chain
      let lastNode = source;
      if (activeVoiceFilter === 'robot') {
        const filter = txAudioContext.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.value = 1200;
        filter.Q.value = 3;
        lastNode.connect(filter);
        lastNode = filter;
      } else if (activeVoiceFilter === 'megaphone') {
        const hp = txAudioContext.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.value = 400;
        const lp = txAudioContext.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 2500;
        lastNode.connect(hp);
        hp.connect(lp);
        lastNode = lp;
      } else if (activeVoiceFilter === 'scifi') {
        const notch = txAudioContext.createBiquadFilter();
        notch.type = 'notch';
        notch.frequency.value = 1000;
        notch.Q.value = 8;
        lastNode.connect(notch);
        lastNode = notch;
      }

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
          pcmData: pcm16.buffer,
          sampleRate: txAudioContext.sampleRate
        });
      };

      lastNode.connect(scriptProcessor);
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

  function resamplePCM(float32Input, fromRate, toRate) {
    if (!fromRate || !toRate || fromRate === toRate || float32Input.length === 0) {
      return float32Input;
    }
    const ratio = fromRate / toRate;
    const newLength = Math.round(float32Input.length / ratio);
    const result = new Float32Array(newLength);
    for (let i = 0; i < newLength; i++) {
      const originPos = i * ratio;
      const index = Math.floor(originPos);
      const decimal = originPos - index;
      const current = float32Input[index] || 0;
      const next = (index + 1 < float32Input.length) ? float32Input[index + 1] : current;
      result[i] = current + (next - current) * decimal;
    }
    return result;
  }

  const nextPlayTimeMap = new Map();
  const talkingTimeouts = new Map();

  socket.on('voice-pcm', ({ fromSocketId, senderName, pcmData, sampleRate }) => {
    if (isDeafened) return;
    if (!rxAudioContext) rxAudioContext = createSafeAudioContext();
    if (!rxAudioContext) return;
    if (rxAudioContext.state === 'suspended') rxAudioContext.resume();

    updateUserCardTalking(fromSocketId, true);
    if (talkingTimeouts.has(fromSocketId)) clearTimeout(talkingTimeouts.get(fromSocketId));
    talkingTimeouts.set(fromSocketId, setTimeout(() => updateUserCardTalking(fromSocketId, false), 350));

    try {
      const int16 = new Int16Array(pcmData);
      let float32 = new Float32Array(int16.length);
      for (let i = 0; i < int16.length; i++) {
        const s = int16[i];
        float32[i] = s < 0 ? s / 32768 : s / 32767;
      }

      const targetRate = rxAudioContext.sampleRate;
      const sourceRate = sampleRate || targetRate;

      if (sourceRate !== targetRate) {
        float32 = resamplePCM(float32, sourceRate, targetRate);
      }

      const audioBuffer = rxAudioContext.createBuffer(1, float32.length, targetRate);
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

      // Schedule gapless, non-overlapping continuous playback
      const currentTime = rxAudioContext.currentTime;
      let nextPlayTime = nextPlayTimeMap.get(fromSocketId) || 0;

      if (nextPlayTime < currentTime) {
        nextPlayTime = currentTime + 0.015; // 15ms buffer margin to prevent click/pop
      }

      source.start(nextPlayTime);
      nextPlayTimeMap.set(fromSocketId, nextPlayTime + audioBuffer.duration);
    } catch (err) {
      console.error('PCM playback error:', err);
    }
  });

  function renderAvatarContent(user) {
    if (!user) return '🧒';
    if (user.avatar && (user.avatar.startsWith('data:image/') || user.avatar.startsWith('http') || user.avatar.startsWith('/'))) {
      return `<img src="${user.avatar}" class="participant-avatar-img" alt="${escapeHTML(user.name || 'User')}">`;
    }
    return user.avatar || (user.isAdmin ? '👑' : '🧒');
  }

  function updateHeaderProfile(user) {
    if (!user) return;
    const hName = document.getElementById('headerUserName');
    const hAvatar = document.getElementById('headerUserAvatar');
    const hAdminTag = document.getElementById('headerAdminTag');
    const adminPanel = document.getElementById('adminControlPanel');

    if (hName) hName.textContent = user.name;
    if (hAvatar) {
      if (user.avatar && (user.avatar.startsWith('data:image/') || user.avatar.startsWith('http') || user.avatar.startsWith('/'))) {
        hAvatar.innerHTML = `<img src="${user.avatar}" style="width:26px; height:26px; border-radius:50%; object-fit:cover;">`;
      } else {
        hAvatar.textContent = user.avatar || (user.isAdmin ? '👑' : '🧒');
      }
    }
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
    if (currentUser) currentUser.isMuted = isMuted;

    if (btnToggleMute) {
      btnToggleMute.classList.toggle('active-muted', isMuted);
      if (muteIcon) muteIcon.textContent = isMuted ? '🔇' : '🎙️';
      if (muteLabel) muteLabel.textContent = isMuted ? 'Muted by Admin' : 'Mute';
    }

    if (isMuted && isTransmitting) stopTransmitting();
    socket.emit('update-state', { isMuted });
    updateUserCardState(socket.id, { isMuted });

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

  const btnAdminUploadAvatar = document.getElementById('btnAdminUploadAvatar');
  if (btnAdminUploadAvatar) {
    btnAdminUploadAvatar.addEventListener('click', () => {
      const tempInput = document.createElement('input');
      tempInput.type = 'file';
      tempInput.accept = 'image/*';
      tempInput.onchange = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) {
          alert('Photo size must be under 5 MB.');
          return;
        }
        const reader = new FileReader();
        reader.onload = (evt) => {
          const photoUrl = evt.target.result;
          customAdminAvatarPhoto = photoUrl;
          if (currentUser) {
            currentUser.avatar = photoUrl;
            updateHeaderProfile(currentUser);
            socket.emit('update-state', { avatar: photoUrl });
            updateUserCardState(socket.id, { avatar: photoUrl });
            alert('📷 Admin Avatar Photo updated live across the room!');
          }
        };
        reader.readAsDataURL(file);
      };
      tempInput.click();
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
      selectedDmSocketId = socketId;
    }

    if (selectedTargetIds.size === 0) selectedTargetIds.add('all');
    updateTargetUI();

    if (activeChatTab === 'dm') {
      const targetUser = selectedDmSocketId ? onlineUsersMap.get(selectedDmSocketId) : null;
      const chatNoticeEl = document.getElementById('chatNotice');
      if (chatNoticeEl) chatNoticeEl.textContent = targetUser ? `Showing Private DMs with ${targetUser.name}` : 'Click any colleague card in the grid to start a Private DM';
      filterMessagesByTab();
    }
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

    btnPTT.addEventListener('touchstart', (e) => { e.preventDefault(); startTransmitting(); }, { passive: false });
    btnPTT.addEventListener('touchend', (e) => { e.preventDefault(); stopTransmitting(); }, { passive: false });
    btnPTT.addEventListener('touchcancel', (e) => { e.preventDefault(); stopTransmitting(); }, { passive: false });
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
        <div class="participant-avatar" style="border-color: ${user.color || '#3b82f6'};">${renderAvatarContent(user)}</div>
        <div class="talking-aura"></div>
      </div>
      <div class="participant-name-row">
        <span class="participant-name">${user.name} ${isSelf ? '(You)' : ''}</span>
        ${user.isAdmin ? '<span class="admin-crown-tag">👑 Admin</span>' : `<span class="cartoon-sticker-badge">${user.cartoonSticker || '🧒 Shinchan'}</span>`}
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

    if (state.avatar !== undefined || state.cartoonSticker !== undefined) {
      const avatarContainer = card.querySelector('.participant-avatar');
      const targetUser = onlineUsersMap.get(socketId);
      if (avatarContainer && targetUser) {
        avatarContainer.innerHTML = renderAvatarContent(targetUser);
      }
      const stickerBadge = card.querySelector('.cartoon-sticker-badge');
      if (stickerBadge && state.cartoonSticker) {
        stickerBadge.textContent = state.cartoonSticker;
      }
    }

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
  // Real Asset Telugu Movie-Style Sticker Packs v2.0.0 Engine
  // -------------------------------------------------------------
  let DYNAMIC_STICKERS_LIST = [];

  const TELUGU_ACTOR_PACKS = [
    { id: 'all', name: '🎬 All Packs', emoji: '🎬' },
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

  const EMOJI_LIST = [
    // --- Smileys & Expressions ---
    '😀','😃','😄','😁','😆','😅','😂','🤣','🥲','🥹','😊','😇','🙂','🙃','😉','😌',
    '😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸',
    '🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢',
    '😭','😮‍💨','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🫣',
    '🤭','🫢','🫡','🤫','🫠','🤥','😶','😶‍🌫️','😐','😑','😬','🫨','🙄','😯','😦','😧',
    '😮','😲','🥱','😴','🤤','😪','😵','😵‍💫','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕',
    '🤑','🤠','😈','👿','👹','👺','🤡','💩','👻','💀','☠️','👽','👾','🤖','🎃',

    // --- Hand Gestures & Body Parts ---
    '👋','🤚','🖐️','✋','🖖','🫱','🫲','🫳','🫴','🫷','🫸','👌','🤌','🤏','✌️','🤞',
    '🫰','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','🫵','👍','👎','✊','👊','🤛',
    '🤜','👏','🙌','🫶','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶',
    '👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁️','👅','👄','💋','🩸',

    // --- Hearts, Feelings & Symbols ---
    '❤️','🩷','🧡','💛','💚','🩵','💙','💜','🤎','🖤','🩶','🤍','💔','❤️‍🔥','❤️‍🩹','❣',
    '💕','💞','💓','💗','💖','💘','💝','💟','💯','💢','💥','💫','💦','💨','🕳️','💣',
    '💬','👁️‍🗨️','🗨️','🗯️','💭','💤','♨️','⚠️','🔞','🚫','⛔','❇️','✳️','❎','✅','❓',
    '❓','‼️','⁉️','🔔','🔕','🎵','🎶','⚛️','🕉️','✝️','☪️','☸️','✡️','🔯','🕎','☯️',

    // --- Animals & Nature ---
    '🐶','🐱','🐭','🐹','🐰','🦊','🐻','🐼','🐻‍❄️','🐨','🐯','🦁','🐮','🐷','🐽','🐸',
    '🐵','🙈','🙉','🙊','🐒','🐔','🐧','🐦','🐤','🐣','🐥','🦆','🦅','🦉','🦇','🐺',
    '🐗','🐴','🦄','🐝','🪲','🐛','🦋','🐌','🐞','🐜','🦟','🪰','🕷️','🕸️','🦂','🐢',
    '🐍','🦎','🦖','🦕','🐙','🦑','🦐','🦞','🦀','🐡','🐠','🐟','🐬','🐳','🐋','🦈',
    '🦭','🐊','🐅','🐆','🦓','🦍','🦧','🐘','🦛','🦏','🐪','🐫','🦒','🦘','🦬','🐃',
    '🐂','🐄','🐎','🐖','🦙','🐐','🐑','🐕','🐩','🐈','🦜','🦩','🕊️','🐇','🦝','🦨',
    '🦡','🦦','🦥','🦔','🐾','🐉','🐲','🌵','🎄','🌲','🌳','🌴','🌱','🌿','☘️','🍀',
    '🍃','🍂','🍁','🍄','🌾','💐','🌷','🌹','🥀','🌺','🌸','🌼','🌻','🌞','🌝','🌛',
    '🌜','🌚','🌕','🌖','🌗','🌘','🌑','🌒','🌓','🌔','🌙','🌎','🌍','🌏','🪐','💫',
    '⭐️','🌟','✨','⚡','☄️','🔥','🌪️','🌈','☀️','🌤️','⛅','🌥️','☁️','🌦️','🌧️','⛈️',
    '❄️','☃️','⛄','🌬️','💧','🌊',

    // --- Food & Drink ---
    '🍏','🍎','🍐','🍊','🍋','🍌','🍉','🍇','🍓','🫐','🍈','🍒','🍑','🥭','🍍','🥥',
    '🥝','🍅','🍆','🥑','🥦','🥬','🥒','🌶️','🫑','🌽','🥕','🧄','🧅','🥔','🍠','🥐',
    '🥯','🍞','🥖','🥨','🧀','🥚','🍳','🧈','🥞','🧇','🥓','🥩','🍗','🍖','🌭','🍔',
    '🍟','🍕','🫓','🥪','🥙','🧆','🌮','🌯','🫔','🥗','🥘','🥫','🍝','🍜','🍲',
    '🍛','🍣','🍱','🥟','🦪','🍤','🍙','🍚','🍘','🍥','🥠','🥮','🍢','🍡','🍧','🍨',
    '🍦','🥧','🧁','🍰','🎂','🍮','🍭','🍬','🍫','🍿','🍩','🍪','🌰','🥜','🍯','🥛',
    '🍼','🫖','☕','🍵','🧃','🥤','🧋','🍶','🍺','🍻','🥂','🍷','🥃','🍸','🍹','🍾','🧊',

    // --- Activities & Objects ---
    '⚽','🏀','🏈','⚾','🥎','🎾','🏐','🏉','🥏','🎱','🪀','🏓','🏸','🏒','🏑','🥍',
    '🏏','🥊','🥋','🎽','🛹','🛼','🏋️','🤺','🏌️','🏄','🏊','🤽','🚣','🧗','🚴','🏆',
    '🥇','🥈','🥉','🏅','🎖️','🎯','🎳','🎮','🎰','🧩','📱','📲','💻','⌨️','🖥️','🖨️',
    '🖱️','🛜','📷','📸','📹','🎥','📽️','🎞️','📞','☎️','📟','📠','📺','📻','🎙️','🎚️',
    '🎛️','💡','🔦','🏮','🪔','📔','📕','📖','📗','📘','📙','📚','📓','📒','📃','📜',
    '📄','📰','🗞️','📑','🔖','🏷️','💰','🪙','💴','💵','💶','💷','💸','💳','🧾','✉️',
    '📧','📦','📫','📪','📅','📆','🗓️','📇','📈','📉','📊','📌','📍','📎','🖇️','📏',
    '📐','✂️','🗃️','🗂️','🗄️','🗑️','🔒','🔓','🔏','🔐','🔑','🗝️','🔨','🪓','⛏️','⚒️',
    '🛠️','🗡️','⚔️','💣','🛡️','🔧','🔩','⚙️','⚖️','🔗','⛓️','🧰','🧲','🧪','🧫','🧬',
    '🔬','🔭','📡','💉','🩸','💊','🩹','🩺','🚪','🛏️','🛋️','🚽','🚿','🛁','🪞',
    '🧹','🧺','🧻','🧼','🪥','🪒','🧽','🪣','🛒','👓','🕶️','🥽','🥼','🦺','👔','👕',
    '👖','🧣','🥢','🧤','🧥','🧦','👗','👘','🥻','👙','👛','👜','🎒','👞','👟','🥾',
    '👠','👡','👢','👑','👒','🎩','🎓','🧢','💄','💍','💎'
  ];

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

  // -------------------------------------------------------------
  // Giphy GIF Engine (Instant Local Curated GIFs + API Search)
  // -------------------------------------------------------------
  const GIPHY_API_KEY = 'GlV942T6cu1ZaMYaZ9wJVFcms92FakNU';

  const FEATURED_GIFS = [
    // --- TELUGU COMEDY & BRAHMANANDAM ---
    { id: '9DosE8knCVPPy', title: 'Brahmanandam Shock', category: 'telugu-comedy', subCategory: 'brahmanandam', lang: 'TE', keywords: ['brahmanandam', 'shock', 'comedy', 'funny', 'reaction', 'telugu'], url: 'https://media.giphy.com/media/9DosE8knCVPPy/giphy.gif' },
    { id: 'NipFetnQOuKhW', title: 'Brahmi Mass Dance', category: 'telugu-comedy', subCategory: 'brahmanandam', lang: 'TE', keywords: ['brahmanandam', 'dance', 'mass', 'funny', 'telugu'], url: 'https://media.giphy.com/media/NipFetnQOuKhW/giphy.gif' },
    { id: '10Jhvt693jN20', title: 'Brahmanandam Ultra Laugh', category: 'telugu-comedy', subCategory: 'brahmanandam', lang: 'TE', keywords: ['brahmanandam', 'laugh', 'ha', 'funny', 'comedy', 'telugu'], url: 'https://media.giphy.com/media/10Jhvt693jN20/giphy.gif' },
    { id: '3o7bu3XilJ5BOiSGic', title: 'Brahmi Confused Ayyo', category: 'telugu-reactions', subCategory: 'brahmanandam', lang: 'TE', keywords: ['brahmanandam', 'confused', 'ayyo', 'what', 'telugu'], url: 'https://media.giphy.com/media/3o7bu3XilJ5BOiSGic/giphy.gif' },
    { id: 'l1J3pT77GCuVLL0PA', title: 'Brahmanandam Running', category: 'telugu-comedy', subCategory: 'brahmanandam', lang: 'TE', keywords: ['brahmanandam', 'run', 'escape', 'funny', 'telugu'], url: 'https://media.giphy.com/media/l1J3pT77GCuVLL0PA/giphy.gif' },
    { id: 'dZeXwS8X00m2L74W2d', title: 'Ali Funny Reaction', category: 'telugu-comedy', lang: 'TE', keywords: ['ali', 'comedy', 'funny', 'look', 'telugu'], url: 'https://media.giphy.com/media/dZeXwS8X00m2L74W2d/giphy.gif' },
    { id: 'l0HlUxcWRsqROFY4g', title: 'Vennela Kishore Smile', category: 'telugu-comedy', lang: 'TE', keywords: ['vennela kishore', 'smile', 'comedy', 'telugu'], url: 'https://media.giphy.com/media/l0HlUxcWRsqROFY4g/giphy.gif' },
    { id: '3o7abKhOpu0NwenH3O', title: 'Sunil Comedy Dance', category: 'telugu-comedy', lang: 'TE', keywords: ['sunil', 'dance', 'comedy', 'telugu'], url: 'https://media.giphy.com/media/3o7abKhOpu0NwenH3O/giphy.gif' },

    // --- TELUGU MASS (Pushpa, Tillu, Balayya, Pawan Kalyan, Allu Arjun) ---
    { id: '3j2a3i4L2V7Kk', title: 'Pushpa Raj Thaggedhe Le', category: 'pushpa-tillu', subCategory: 'telugu-mass', lang: 'TE', keywords: ['pushpa', 'allu arjun', 'thaggedhele', 'mass', 'swag', 'telugu'], url: 'https://media.giphy.com/media/3j2a3i4L2V7Kk/giphy.gif' },
    { id: 'l41YkxvU8c7J7BbaE', title: 'DJ Tillu Mass Swag', category: 'pushpa-tillu', subCategory: 'telugu-mass', lang: 'TE', keywords: ['tillu', 'dj tillu', 'atlu untadi', 'mass', 'telugu', 'hero'], url: 'https://media.giphy.com/media/l41YkxvU8c7J7BbaE/giphy.gif' },
    { id: '13n7XeeDY322yY', title: 'Balayya Mass Dialogue', category: 'telugu-mass', lang: 'TE', keywords: ['balakrishna', 'balayya', 'mass', 'roar', 'telugu'], url: 'https://media.giphy.com/media/13n7XeeDY322yY/giphy.gif' },
    { id: 'l2SpR03mR14h8LqAU', title: 'Pawan Kalyan Gabbar Singh', category: 'telugu-mass', lang: 'TE', keywords: ['pawan kalyan', 'gabbar singh', 'mass', 'power star', 'telugu'], url: 'https://media.giphy.com/media/l2SpR03mR14h8LqAU/giphy.gif' },
    { id: '5xaOcLGvzUv25f3wx3O', title: 'Allu Arjun Dance Swag', category: 'telugu-mass', lang: 'TE', keywords: ['allu arjun', 'dance', 'bunny', 'mass', 'telugu'], url: 'https://media.giphy.com/media/5xaOcLGvzUv25f3wx3O/giphy.gif' },

    // --- TELUGU REACTIONS (Ayyo, Cheppa Kada, Abbo, Chii) ---
    { id: '3o6Zt62PeJeFUDwBUI', title: 'Ayyo Rama Reaction', category: 'telugu-reactions', lang: 'TE', keywords: ['ayyo', 'reaction', 'facepalm', 'telugu', 'funny'], url: 'https://media.giphy.com/media/3o6Zt62PeJeFUDwBUI/giphy.gif' },
    { id: 'd31w24psGYeekCZy', title: 'Telugu Super Clap', category: 'telugu-reactions', lang: 'TE', keywords: ['clap', 'super', 'praise', 'mass', 'telugu'], url: 'https://media.giphy.com/media/d31w24psGYeekCZy/giphy.gif' },
    { id: '3o7bu0Z48xTzR6XyBG', title: 'Telugu Hero Style', category: 'telugu-reactions', lang: 'TE', keywords: ['wink', 'style', 'telugu', 'hero'], url: 'https://media.giphy.com/media/3o7bu0Z48xTzR6XyBG/giphy.gif' },

    // --- LOVE & ROMANCE ---
    { id: '26fldmIp6PeajdqFO', title: 'Telugu Romance Heart', category: 'love', lang: 'TE', keywords: ['love', 'heart', 'romance', 'cute', 'telugu'], url: 'https://media.giphy.com/media/26fldmIp6PeajdqFO/giphy.gif' },

    // --- CELEBRATION & DANCE ---
    { id: 'l3V0lsGcqU71nRiEg', title: 'Telugu Mass Dance Party', category: 'celebration', lang: 'TE', keywords: ['dance', 'party', 'celebration', 'mass', 'telugu'], url: 'https://media.giphy.com/media/l3V0lsGcqU71nRiEg/giphy.gif' },

    // --- TRENDING ENGLISH GIFS ---
    { id: 'JIX9t2j0ZTN9S', title: 'Funny Cat Dance', category: 'english', lang: 'EN', keywords: ['cat', 'dance', 'funny', 'english'], url: 'https://media.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif' },
    { id: 'pUeXcg80cO8I8', title: 'Eating Popcorn Reaction', category: 'english', lang: 'EN', keywords: ['popcorn', 'watching', 'english', 'reaction'], url: 'https://media.giphy.com/media/pUeXcg80cO8I8/giphy.gif' },
    { id: '26ufdipQqU2lhNA4g', title: 'Mind Blown Reaction', category: 'english', lang: 'EN', keywords: ['mind blown', 'wow', 'english', 'reaction'], url: 'https://media.giphy.com/media/26ufdipQqU2lhNA4g/giphy.gif' },
    { id: '10uEX5kfeodYgo', title: 'Minions Applause', category: 'english', lang: 'EN', keywords: ['applause', 'clap', 'minions', 'english'], url: 'https://media.giphy.com/media/10uEX5kfeodYgo/giphy.gif' }
  ];

  const GIF_CATEGORIES = [
    { id: 'all', name: '🔥 All GIFs', lang: 'TE' },
    { id: 'telugu-comedy', name: '🔥 Telugu Comedy', lang: 'TE' },
    { id: 'telugu-mass', name: '😎 Telugu Mass', lang: 'TE' },
    { id: 'brahmanandam', name: '🤣 Brahmanandam', lang: 'TE' },
    { id: 'pushpa-tillu', name: '🔥 Pushpa & Tillu', lang: 'TE' },
    { id: 'telugu-reactions', name: '🤦 Telugu Reactions', lang: 'TE' },
    { id: 'love', name: '❤️ Love & Romance', lang: 'TE' },
    { id: 'celebration', name: '🎉 Celebration', lang: 'TE' },
    { id: 'english', name: '🌐 English GIFs', lang: 'EN' }
  ];

  let activeGifCategory = 'all';
  let activeGifSearchQuery = '';

  const btnGifPicker = document.getElementById('btnGifPicker');
  const btnEmojiPicker = document.getElementById('btnEmojiPicker');
  const btnClosePicker = document.getElementById('btnClosePicker');
  const emojiPickerPanel = document.getElementById('emojiPickerPanel');

  const tabGifs = document.getElementById('tabGifs');
  const tabEmojis = document.getElementById('tabEmojis');

  const pickerContentGifs = document.getElementById('pickerContentGifs');
  const pickerContentEmojis = document.getElementById('pickerContentEmojis');

  const gifCategoryTabs = document.getElementById('gifCategoryTabs');
  const gifGrid = document.getElementById('gifGrid');
  const emojiGrid = document.getElementById('emojiGrid');

  const gifSearchInput = document.getElementById('gifSearchInput');
  const btnClearGifSearch = document.getElementById('btnClearGifSearch');

  // Admin Sticker Upload Elements
  const btnAdminUploadSticker = document.getElementById('btnAdminUploadSticker');
  const modalAdminStickerUpload = document.getElementById('modalAdminStickerUpload');
  const btnCloseStickerUpload = document.getElementById('btnCloseStickerUpload');
  const formAdminStickerUpload = document.getElementById('formAdminStickerUpload');

  function renderGifCategoryPills() {
    if (!gifCategoryTabs) return;
    gifCategoryTabs.innerHTML = '';
    GIF_CATEGORIES.forEach(cat => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = `cat-pill ${activeGifCategory === cat.id ? 'active' : ''}`;
      btn.textContent = cat.name;
      btn.addEventListener('click', () => {
        activeGifCategory = cat.id;
        renderGifCategoryPills();
        renderGifsGrid();
      });
      gifCategoryTabs.appendChild(btn);
    });
  }

  async function fetchLiveGiphys(searchTerm) {
    try {
      const url = `https://api.giphy.com/v1/gifs/search?api_key=${GIPHY_API_KEY}&q=${encodeURIComponent(searchTerm)}&limit=20&rating=g`;
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      if (data && data.data && Array.isArray(data.data) && data.data.length > 0) {
        return data.data.map(item => ({
          id: item.id,
          title: item.title || 'Telugu GIF',
          url: item.images.fixed_height ? item.images.fixed_height.url : `https://media.giphy.com/media/${item.id}/giphy.gif`,
          lang: (searchTerm.toLowerCase().includes('english') ? 'EN' : 'TE')
        }));
      }
    } catch(e) {}
    return [];
  }

  function renderGifsGrid() {
    if (!gifGrid) return;
    gifGrid.innerHTML = '';

    const query = activeGifSearchQuery.trim().toLowerCase();
    let list = [...FEATURED_GIFS];

    if (query) {
      list = list.filter(gif => {
        const textToSearch = `${gif.title} ${gif.category} ${gif.subCategory || ''} ${(gif.keywords || []).join(' ')} ${gif.lang}`.toLowerCase();
        return textToSearch.includes(query);
      });
    } else if (activeGifCategory !== 'all') {
      list = list.filter(gif => gif.category === activeGifCategory || gif.subCategory === activeGifCategory);
    }

    // MANDATORY SORT: Prioritize Telugu (lang === 'TE') GIFs FIRST
    list.sort((a, b) => {
      if (a.lang === 'TE' && b.lang !== 'TE') return -1;
      if (a.lang !== 'TE' && b.lang === 'TE') return 1;
      return 0;
    });

    if (list.length === 0) {
      // Background search attempt on Giphy API for custom queries
      if (query) {
        fetchLiveGiphys(query).then(apiResults => {
          if (apiResults && apiResults.length > 0) {
            renderGifListUI(apiResults);
          } else {
            gifGrid.innerHTML = `<div style="grid-column: span 2; text-align: center; color: var(--text-muted); padding: 20px; font-size: 13px;">No GIFs found for "${escapeHTML(query)}". Try Brahmi, Pushpa, or Tillu!</div>`;
          }
        });
        return;
      }
    }

    renderGifListUI(list);
  }

  function renderGifListUI(listToRender) {
    if (!gifGrid) return;
    gifGrid.innerHTML = '';
    listToRender.forEach(gif => {
      const card = document.createElement('div');
      card.className = 'gif-card';
      const cleanUrl = gif.url || `https://media.giphy.com/media/${gif.id}/giphy.gif`;
      card.innerHTML = `
        <span class="gif-badge-lang">${gif.lang === 'TE' ? 'TELUGU' : 'GIF'}</span>
        <img src="${cleanUrl}" class="gif-img" alt="${escapeHTML(gif.title)}" loading="lazy" referrerpolicy="no-referrer" onerror="this.onerror=null; this.src='https://media.giphy.com/media/${gif.id}/giphy.gif';">
        <div class="gif-title-tag">${escapeHTML(gif.title)}</div>
      `;

      card.addEventListener('click', () => {
        socket.emit('send-message', {
          gifUrl: cleanUrl,
          gifTitle: gif.title
        });
        if (emojiPickerPanel) emojiPickerPanel.classList.add('hidden');
      });

      gifGrid.appendChild(card);
    });
  }

  function initGifAndEmojiPicker() {
    if (emojiGrid) {
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
    }

    renderGifCategoryPills();
    renderGifsGrid();
  }

  initGifAndEmojiPicker();

  if (gifSearchInput) {
    gifSearchInput.addEventListener('input', () => {
      activeGifSearchQuery = gifSearchInput.value;
      if (btnClearGifSearch) {
        if (activeGifSearchQuery) btnClearGifSearch.classList.remove('hidden');
        else btnClearGifSearch.classList.add('hidden');
      }
      renderGifsGrid();
    });
  }

  if (btnClearGifSearch) {
    btnClearGifSearch.addEventListener('click', () => {
      if (gifSearchInput) gifSearchInput.value = '';
      activeGifSearchQuery = '';
      btnClearGifSearch.classList.add('hidden');
      renderGifsGrid();
    });
  }

  function openPicker(tab) {
    if (!emojiPickerPanel) return;

    const isCurrentlyOpen = !emojiPickerPanel.classList.contains('hidden');
    const isGifsActive = tabGifs && tabGifs.classList.contains('active');
    const isEmojisActive = tabEmojis && tabEmojis.classList.contains('active');

    // Toggle behavior: if already open on the same tab, close it!
    if (isCurrentlyOpen && ((tab === 'gifs' && isGifsActive) || (tab === 'emojis' && isEmojisActive))) {
      emojiPickerPanel.classList.add('hidden');
      return;
    }

    emojiPickerPanel.classList.remove('hidden');

    if (tab === 'gifs') {
      if (tabGifs) tabGifs.classList.add('active');
      if (tabEmojis) tabEmojis.classList.remove('active');
      if (pickerContentGifs) pickerContentGifs.classList.remove('hidden');
      if (pickerContentEmojis) pickerContentEmojis.classList.add('hidden');
      renderGifsGrid();
    } else {
      if (tabEmojis) tabEmojis.classList.add('active');
      if (tabGifs) tabGifs.classList.remove('active');
      if (pickerContentEmojis) pickerContentEmojis.classList.remove('hidden');
      if (pickerContentGifs) pickerContentGifs.classList.add('hidden');
    }
  }

  if (btnGifPicker) btnGifPicker.addEventListener('click', (e) => { e.stopPropagation(); openPicker('gifs'); });
  if (btnEmojiPicker) btnEmojiPicker.addEventListener('click', (e) => { e.stopPropagation(); openPicker('emojis'); });
  if (tabGifs) tabGifs.addEventListener('click', (e) => { e.stopPropagation(); openPicker('gifs'); });
  if (tabEmojis) tabEmojis.addEventListener('click', (e) => { e.stopPropagation(); openPicker('emojis'); });
  if (btnClosePicker) btnClosePicker.addEventListener('click', (e) => { e.stopPropagation(); emojiPickerPanel.classList.add('hidden'); });

  // Admin Sticker Upload Event Handlers
  if (btnAdminUploadSticker) {
    btnAdminUploadSticker.addEventListener('click', () => {
      if (modalAdminStickerUpload) modalAdminStickerUpload.classList.remove('hidden');
    });
  }

  if (btnCloseStickerUpload) {
    btnCloseStickerUpload.addEventListener('click', () => {
      if (modalAdminStickerUpload) modalAdminStickerUpload.classList.add('hidden');
    });
  }

  if (formAdminStickerUpload) {
    formAdminStickerUpload.addEventListener('submit', (e) => {
      e.preventDefault();
      const packId = document.getElementById('selectStickerPack').value;
      const category = document.getElementById('selectStickerCategory').value;
      const fileInput = document.getElementById('inputStickerFile');
      const name = document.getElementById('inputStickerName').value;
      const nameTe = document.getElementById('inputStickerNameTe').value;
      const keywords = document.getElementById('inputStickerKeywords').value;

      if (!fileInput.files || fileInput.files.length === 0) {
        alert('Please select a sticker image file (.webp, .png, .gif).');
        return;
      }

      const file = fileInput.files[0];
      if (file.size > 2 * 1024 * 1024) {
        alert('Sticker image file size must be under 2 MB.');
        return;
      }

      const reader = new FileReader();
      reader.onload = (evt) => {
        socket.emit('admin-upload-sticker', {
          packId,
          category,
          name,
          nameTe,
          keywords,
          fileName: file.name,
          fileData: evt.target.result
        });

        alert('🎨 Sticker asset uploaded successfully!');
        if (modalAdminStickerUpload) modalAdminStickerUpload.classList.add('hidden');
        formAdminStickerUpload.reset();
      };
      reader.readAsDataURL(file);
    });
  }

  // Outside click & ESC key dismiss (using .contains check for buttons)
  document.addEventListener('click', (e) => {
    if (emojiPickerPanel && 
        !emojiPickerPanel.contains(e.target) && 
        !(btnEmojiPicker && btnEmojiPicker.contains(e.target)) && 
        !(btnGifPicker && btnGifPicker.contains(e.target))) {
      emojiPickerPanel.classList.add('hidden');
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (emojiPickerPanel && !emojiPickerPanel.classList.contains('hidden')) emojiPickerPanel.classList.add('hidden');
      if (modalAdminStickerUpload && !modalAdminStickerUpload.classList.contains('hidden')) modalAdminStickerUpload.classList.add('hidden');
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

  function getSupportedMediaRecorderMimeType() {
    if (typeof MediaRecorder === 'undefined') return '';
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/aac',
      'audio/ogg'
    ];
    for (const type of types) {
      if (MediaRecorder.isTypeSupported && MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return '';
  }

  // Voice Memo Recorder (up to 5s)
  if (btnRecordVoiceMemo) {
    let memoTimer = null;

    btnRecordVoiceMemo.addEventListener('mousedown', startVoiceMemoRecord);
    btnRecordVoiceMemo.addEventListener('mouseup', stopVoiceMemoRecord);
    btnRecordVoiceMemo.addEventListener('mouseleave', stopVoiceMemoRecord);

    btnRecordVoiceMemo.addEventListener('touchstart', (e) => { e.preventDefault(); startVoiceMemoRecord(); }, { passive: false });
    btnRecordVoiceMemo.addEventListener('touchend', (e) => { e.preventDefault(); stopVoiceMemoRecord(); }, { passive: false });
    btnRecordVoiceMemo.addEventListener('touchcancel', (e) => { e.preventDefault(); stopVoiceMemoRecord(); }, { passive: false });

    async function startVoiceMemoRecord() {
      if (isRecordingMemo) return;
      isRecordingMemo = true;
      audioChunks = [];

      btnRecordVoiceMemo.classList.add('recording');

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        const mimeType = getSupportedMediaRecorderMimeType();
        const options = mimeType ? { mimeType } : undefined;
        mediaRecorder = new MediaRecorder(stream, options);
        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunks.push(e.data);
        };
        mediaRecorder.onstop = () => {
          stream.getTracks().forEach(t => t.stop());
          const blobType = (mediaRecorder && mediaRecorder.mimeType) || mimeType || 'audio/mp4';
          const blob = new Blob(audioChunks, { type: blobType });
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

  // Chat Form Submit & Typing Event Handlers
  if (chatInput) {
    chatInput.addEventListener('input', () => {
      const targetId = (activeChatTab === 'dm' && selectedDmSocketId) ? selectedDmSocketId : 'all';
      socket.emit('typing', { targetSocketId: targetId });

      if (typingTimeout) clearTimeout(typingTimeout);
      typingTimeout = setTimeout(() => {
        socket.emit('stop-typing', { targetSocketId: targetId });
      }, 1500);
    });
  }

  socket.on('user-typing', ({ name, isPrivate }) => {
    if (typingIndicatorBanner && typingText) {
      typingText.textContent = `${name} is typing ${isPrivate ? '(Private DM)' : ''}...`;
      typingIndicatorBanner.classList.remove('hidden');
    }
  });

  socket.on('user-stop-typing', () => {
    if (typingIndicatorBanner) {
      typingIndicatorBanner.classList.add('hidden');
    }
  });

  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;

    const isPrivate = activeChatTab === 'dm';
    const targetSocketId = isPrivate ? selectedDmSocketId : null;

    if (isPrivate && !targetSocketId) {
      alert('Please click on a colleague in the grid to send a Private DM.');
      return;
    }

    socket.emit('send-message', { text, isPrivate, targetSocketId });
    socket.emit('stop-typing', { targetSocketId: targetSocketId || 'all' });
    chatInput.value = '';
  });

  socket.on('new-message', (msg) => {
    appendChatMessage(msg);
    if (msg.senderId !== socket.id) {
      if (msg.isPrivate) {
        triggerDesktopNotification(`🔒 Private DM from ${msg.senderName}`, { body: msg.text || 'Sent a media message' });
      }
    }
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
    if (sidebarChat && sidebarChat.classList.contains('collapsed') && msg.senderId !== socket.id) {
      unreadChatCount++;
      updateUnreadBadge();
    }

    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';
    if (msg.id) chatMessagesMap.set(msg.id, bubble);

    if (msg.isPrivate) {
      bubble.setAttribute('data-private', 'true');
      if (msg.senderId) bubble.setAttribute('data-sender-id', msg.senderId);
      if (msg.targetSocketId) bubble.setAttribute('data-target-id', msg.targetSocketId);
    }

    let contentHtml = '';
    if (msg.gifUrl) {
      let cleanUrl = msg.gifUrl;
      const match = cleanUrl.match(/(?:v1\.[^\/]+\/)?([a-zA-Z0-9]{10,30})(?:\/|$)/);
      if (match && match[1]) {
        cleanUrl = `https://i.giphy.com/media/${match[1]}/giphy.gif`;
      }
      contentHtml = `
        <div class="chat-gif-wrapper">
          <img src="${cleanUrl}" class="chat-gif-img" alt="${escapeHTML(msg.gifTitle || 'GIF')}" loading="lazy" onerror="this.onerror=null; this.src='https://i.giphy.com/media/JIX9t2j0ZTN9S/giphy.gif';">
        </div>
      `;
    } else if (msg.sticker) {
      const stickerImgUrl = msg.sticker.imageUrl || msg.sticker.image || (typeof msg.sticker === 'string' ? msg.sticker : '');
      contentHtml = `
        <div class="chat-sticker-wrapper">
          <img src="${stickerImgUrl}" class="chat-sticker-img" alt="${escapeHTML(msg.sticker.name || 'Sticker')}" loading="lazy" onerror="this.onerror=null; this.parentElement.innerHTML='<span style=\'font-size:12px;color:var(--text-muted);\'>Sticker unavailable</span>';">
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
          <audio src="${msg.voiceMemo.dataUrl}" playsinline webkit-playsinline preload="auto" style="display:none;"></audio>
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
      const formattedText = parseTextWithLinks(msg.text);
      contentHtml = `<div class="chat-text">${formattedText}</div>`;
    }

    const canPin = currentUser && currentUser.isAdmin;

    bubble.innerHTML = `
      <div class="chat-sender-row">
        <span class="chat-sender-name" style="color: ${msg.senderColor || '#3b82f6'};">
          ${msg.senderName} ${msg.isAdmin ? '👑 (Admin)' : ''}
          ${msg.isPrivate ? '<span class="private-msg-tag">🔒 Private DM</span>' : ''}
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
          unlockAudioContexts();
          audioEl.play().catch(e => console.warn('Voice memo playback warning:', e));
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

  function parseTextWithLinks(str) {
    if (!str) return '';
    const escaped = escapeHTML(str);
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return escaped.replace(urlRegex, (url) => {
      return `<a href="${url}" target="_blank" rel="noopener noreferrer" style="color:var(--accent-gold); font-weight:700;">${url}</a>
      <a href="${url}" target="_blank" rel="noopener noreferrer" class="link-preview-card">
        <span class="link-preview-icon">🌐</span>
        <div class="link-preview-details">
          <span class="link-preview-title">Shared Web Link</span>
          <span class="link-preview-url">${url}</span>
        </div>
      </a>`;
    });
  }

  // Chat Tabs (Everyone vs Private DM)
  if (chatTabEveryone && chatTabDM) {
    chatTabEveryone.addEventListener('click', () => {
      activeChatTab = 'everyone';
      chatTabEveryone.classList.add('active');
      chatTabDM.classList.remove('active');
      const chatNoticeEl = document.getElementById('chatNotice');
      if (chatNoticeEl) chatNoticeEl.textContent = 'Showing Public Team Chat Messages';
      filterMessagesByTab();
    });

    chatTabDM.addEventListener('click', () => {
      activeChatTab = 'dm';
      chatTabDM.classList.add('active');
      chatTabEveryone.classList.remove('active');
      const chatNoticeEl = document.getElementById('chatNotice');
      const targetUser = selectedDmSocketId ? onlineUsersMap.get(selectedDmSocketId) : null;
      if (chatNoticeEl) chatNoticeEl.textContent = targetUser ? `Showing Private DMs with ${targetUser.name}` : 'Click any colleague card in the grid to start a Private DM';
      filterMessagesByTab();
    });
  }

  function filterMessagesByTab() {
    chatMessagesMap.forEach((el) => {
      const isPrivate = el.hasAttribute('data-private');
      const msgSender = el.getAttribute('data-sender-id');
      const msgTarget = el.getAttribute('data-target-id');

      if (activeChatTab === 'everyone') {
        if (!isPrivate) el.style.display = '';
        else el.style.display = 'none';
      } else {
        if (isPrivate && (
          (msgSender === socket.id && msgTarget === selectedDmSocketId) ||
          (msgSender === selectedDmSocketId && msgTarget === socket.id)
        )) {
          el.style.display = '';
        } else {
          el.style.display = 'none';
        }
      }
    });
  }

  // Voice Sub-Room Channel Switcher
  const selectVoiceChannel = document.getElementById('selectVoiceChannel');
  if (selectVoiceChannel) {
    selectVoiceChannel.addEventListener('change', () => {
      const channel = selectVoiceChannel.value;
      socket.emit('switch-channel', { channel });
    });
  }

  // Admin Audio Session Recorder
  const btnAdminRecordSession = document.getElementById('btnAdminRecordSession');
  let sessionRecorder = null;
  let recordedChunks = [];
  let isRecordingSession = false;

  if (btnAdminRecordSession) {
    btnAdminRecordSession.addEventListener('click', () => {
      if (!isRecordingSession) {
        startSessionRecording();
      } else {
        stopSessionRecording();
      }
    });
  }

  function startSessionRecording() {
    try {
      if (!rxAudioContext) unlockAudioContexts();
      const dest = rxAudioContext ? rxAudioContext.createMediaStreamDestination() : null;
      if (!dest) {
        alert('Audio context initializing. Try again in a moment.');
        return;
      }
      recordedChunks = [];
      sessionRecorder = new MediaRecorder(dest.stream);
      sessionRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) recordedChunks.push(e.data);
      };
      sessionRecorder.onstop = () => {
        const blob = new Blob(recordedChunks, { type: 'audio/webm' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `OfficeTalk_Audio_Session_${Date.now()}.webm`;
        a.click();
        URL.revokeObjectURL(url);
      };
      sessionRecorder.start();
      isRecordingSession = true;
      btnAdminRecordSession.classList.add('recording-session');
      btnAdminRecordSession.textContent = '⏹️ Stop Recording (Save .webm)';
    } catch(err) {
      console.warn('Session recording notice:', err);
    }
  }

  function stopSessionRecording() {
    if (sessionRecorder && sessionRecorder.state !== 'inactive') {
      sessionRecorder.stop();
    }
    isRecordingSession = false;
    btnAdminRecordSession.classList.remove('recording-session');
    btnAdminRecordSession.textContent = '⏺️ Record Session';
  }

  // Chat History Search & Jump-to-Message
  if (chatSearchInput) {
    chatSearchInput.addEventListener('input', () => {
      const query = chatSearchInput.value.trim().toLowerCase();
      let firstMatch = null;

      chatMessagesMap.forEach((el) => {
        el.classList.remove('highlight-bubble');
        if (!query) {
          filterMessagesByTab();
        } else {
          const text = el.textContent.toLowerCase();
          if (text.includes(query)) {
            el.style.display = '';
            if (!firstMatch) firstMatch = el;
          } else {
            el.style.display = 'none';
          }
        }
      });

      if (firstMatch && query.length > 2) {
        firstMatch.classList.add('highlight-bubble');
        firstMatch.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  }

  // MediaSession API Integration (Background Mobile Control)
  if ('mediaSession' in navigator) {
    try {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: 'OfficeTalk Voice Conference',
        artist: 'Admin Walkie-Talkie Line',
        album: 'Live Audio Stream'
      });
      navigator.mediaSession.setActionHandler('play', () => { if (talkMode === 'open') toggleMute(); });
      navigator.mediaSession.setActionHandler('pause', () => { if (talkMode === 'open') toggleMute(); });
    } catch(e) {}
  }

  // Chat History Export
  if (btnExportChat) {
    btnExportChat.addEventListener('click', () => {
      let transcript = `--- OfficeTalk Chat Log (${new Date().toLocaleString()}) ---\n\n`;
      let count = 0;
      chatMessagesMap.forEach((el) => {
        if (el.style.display !== 'none') {
          const sender = el.querySelector('.chat-sender-name')?.textContent?.trim() || 'User';
          const time = el.querySelector('.chat-time')?.textContent?.trim() || '';
          const text = el.querySelector('.chat-text')?.textContent?.trim() || '[Media / Sticker / Voice Memo]';
          transcript += `[${time}] ${sender}: ${text}\n`;
          count++;
        }
      });

      if (count === 0) {
        alert('No chat messages to export.');
        return;
      }

      const blob = new Blob([transcript], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `OfficeTalk_Chat_Export_${Date.now()}.txt`;
      a.click();
      URL.revokeObjectURL(url);
    });
  }

  // Sidebar Chat Toggle & Close Listeners
  if (btnToggleChatSidebar) {
    btnToggleChatSidebar.addEventListener('click', () => toggleChatSidebar());
  }

  if (btnCloseSidebar) {
    btnCloseSidebar.addEventListener('click', () => toggleChatSidebar(false));
  }

  // App Visual Theme Switcher (Bright Yellow & Red default)
  function applyAppTheme(theme) {
    document.body.className = `dark-theme theme-${theme}`;
  }

  if (selectAppTheme) {
    const savedTheme = localStorage.getItem('officetalk_theme') || 'yellowred';
    selectAppTheme.value = savedTheme;
    applyAppTheme(savedTheme);

    selectAppTheme.addEventListener('change', () => {
      const selected = selectAppTheme.value;
      applyAppTheme(selected);
      localStorage.setItem('officetalk_theme', selected);
    });
  }

  // Audio Enhancements & Voice Filter Listeners
  if (selectVoiceFilter) {
    selectVoiceFilter.addEventListener('change', () => {
      activeVoiceFilter = selectVoiceFilter.value;
      if (localStream) setupPcmAudioCapture(localStream);
    });
  }

  if (toggleNoiseSuppression) toggleNoiseSuppression.addEventListener('change', () => initLocalMicrophone());
  if (toggleEchoCancellation) toggleEchoCancellation.addEventListener('change', () => initLocalMicrophone());
  if (toggleAutoGain) toggleAutoGain.addEventListener('change', () => initLocalMicrophone());

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
