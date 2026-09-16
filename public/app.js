// OfficeTalk Client Logic - WebRTC Mesh, Socket.io Signaling & PTT Engine

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const modalSetup = document.getElementById('modalSetup');
  const formSetup = document.getElementById('formSetup');
  const setupName = document.getElementById('setupName');
  const setupDept = document.getElementById('setupDept');
  const avatarSelector = document.getElementById('avatarSelector');

  const headerUserName = document.getElementById('headerUserName');
  const headerUserDept = document.getElementById('headerUserDept');
  const headerUserAvatar = document.getElementById('headerUserAvatar');
  const headerChannelBadge = document.getElementById('headerChannelBadge');
  const headerChannelName = document.getElementById('headerChannelName');

  const channelsList = document.getElementById('channelsList');
  const participantGrid = document.getElementById('participantGrid');
  const emptyRoomPlaceholder = document.getElementById('emptyRoomPlaceholder');
  const roomTitle = document.getElementById('roomTitle');
  const roomDesc = document.getElementById('roomDesc');
  const roomIcon = document.getElementById('roomIcon');
  const roomMemberCount = document.getElementById('roomMemberCount');

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

  const btnLeaveRoom = document.getElementById('btnLeaveRoom');
  const vuBarFill = document.getElementById('vuBarFill');

  const chatMessages = document.getElementById('chatMessages');
  const chatForm = document.getElementById('chatForm');
  const chatInput = document.getElementById('chatInput');
  const chatChannelSubtitle = document.getElementById('chatChannelSubtitle');

  const btnOpenCreateChannel = document.getElementById('btnOpenCreateChannel');
  const modalCreateChannel = document.getElementById('modalCreateChannel');
  const formCreateChannel = document.getElementById('formCreateChannel');
  const btnCloseCreateChannel = document.getElementById('btnCloseCreateChannel');

  const btnAudioSettings = document.getElementById('btnAudioSettings');
  const modalAudioSettings = document.getElementById('modalAudioSettings');
  const btnCloseAudioSettings = document.getElementById('btnCloseAudioSettings');
  const selectMicInput = document.getElementById('selectMicInput');
  const settingsVuFill = document.getElementById('settingsVuFill');
  const btnToggleSoundFX = document.getElementById('btnToggleSoundFX');

  // Application State
  const socket = io();
  let currentUser = null;
  let currentChannel = null;

  let localStream = null;
  let audioContext = null;
  let analyser = null;
  let micGainNode = null;
  let selectedAvatar = '👨‍💼';

  let talkMode = 'ptt'; // 'ptt' or 'open'
  let isMuted = false;
  let isDeafened = false;
  let isTransmitting = false;
  let pttKeyPressed = false;

  const peerConnections = new Map(); // targetSocketId -> { pc, remoteStream, audioElement }
  const roomMembersMap = new Map(); // socketId -> userData

  const rtcConfig = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  // -------------------------------------------------------------
  // 1. Identity & Setup Modal
  // -------------------------------------------------------------
  avatarSelector.addEventListener('click', (e) => {
    const option = e.target.closest('.avatar-option');
    if (!option) return;
    document.querySelectorAll('.avatar-option').forEach(el => el.classList.remove('selected'));
    option.classList.add('selected');
    selectedAvatar = option.dataset.avatar;
  });

  formSetup.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = setupName.value.trim() || 'Employee';
    const dept = setupDept.value;

    currentUser = {
      name,
      department: dept,
      role: dept + ' Specialist',
      avatar: selectedAvatar,
      color: getRandomColor(),
      talkMode
    };

    headerUserName.textContent = name;
    headerUserDept.textContent = dept;
    headerUserAvatar.textContent = selectedAvatar;

    socket.emit('init-user', currentUser);
    modalSetup.classList.add('hidden');

    // Initialize Microphone
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

      // Disable local track by default in PTT mode
      setMicTrackEnabled(talkMode === 'open' && !isMuted);

      // Populate microphone device dropdown list
      populateAudioDevices();
    } catch (err) {
      console.error('[Microphone Error]', err);
      alert('Unable to access microphone. Please check browser microphone permissions.');
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

      // Speaking threshold detector (> 12%)
      const currentlySpeaking = percent > 12 && (talkMode === 'open' ? !isMuted : isTransmitting);
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
  // 3. Socket.io Signaling & Channel Events
  // -------------------------------------------------------------
  socket.on('channels-list', (channels) => {
    renderChannelsList(channels);
  });

  socket.on('room-joined', ({ channel, members }) => {
    currentChannel = channel;
    window.soundFX.playJoinChime();

    // UI Updates
    headerChannelBadge.querySelector('.status-dot').className = 'status-dot connected';
    headerChannelName.textContent = channel.name;
    roomTitle.textContent = channel.name;
    roomDesc.textContent = channel.description;
    roomIcon.textContent = channel.icon;
    chatChannelSubtitle.textContent = '#' + channel.id;

    controlDock.classList.remove('disabled');

    // Reset members map & grid
    roomMembersMap.clear();
    participantGrid.innerHTML = '';

    // Add self to room members map
    roomMembersMap.set(socket.id, currentUser);
    renderParticipantCard(socket.id, currentUser);

    // Connect WebRTC to existing members
    members.forEach(member => {
      roomMembersMap.set(member.socketId, member);
      renderParticipantCard(member.socketId, member);
      initiatePeerConnection(member.socketId, true); // true = create offer
    });

    updateRoomMemberCount();
  });

  socket.on('user-joined-room', (user) => {
    roomMembersMap.set(user.socketId, user);
    renderParticipantCard(user.socketId, user);
    updateRoomMemberCount();

    // System chat notification
    appendChatMessage({
      senderName: 'System',
      senderColor: '#3b82f6',
      text: `${user.name} (${user.department}) joined the channel.`,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    });
  });

  socket.on('user-left-room', ({ socketId }) => {
    const user = roomMembersMap.get(socketId);
    if (user) {
      appendChatMessage({
        senderName: 'System',
        senderColor: '#ef4444',
        text: `${user.name} left the channel.`,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      });
    }

    closePeerConnection(socketId);
    roomMembersMap.delete(socketId);
    removeParticipantCard(socketId);
    updateRoomMemberCount();
  });

  socket.on('user-state-changed', ({ socketId, state }) => {
    const user = roomMembersMap.get(socketId);
    if (user) {
      Object.assign(user, state);
      updateUserCardState(socketId, state);
    }
  });

  socket.on('new-message', (msg) => {
    appendChatMessage(msg);
  });

  socket.on('error-msg', (errMsg) => {
    alert(errMsg);
  });

  socket.on('channel-created', ({ id, pin }) => {
    modalCreateChannel.classList.add('hidden');
    socket.emit('join-room', { roomId: id, pin });
  });

  // -------------------------------------------------------------
  // 4. WebRTC PeerConnection Engine
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
        .catch(err => console.error('Error creating offer:', err));
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
      console.error('[WebRTC Signal Error]', err);
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
  // 5. Push-To-Talk (PTT) & Open Call Controls
  // -------------------------------------------------------------
  function startTransmitting() {
    if (isTransmitting || isMuted || isDeafened) return;
    isTransmitting = true;

    btnPTT.classList.add('transmitting');
    pttText.textContent = 'TRANSMITTING...';

    window.soundFX.playPttStart();
    setMicTrackEnabled(true);
    socket.emit('update-state', { isTalking: true });
    updateUserCardTalking(socket.id, true);
  }

  function stopTransmitting() {
    if (!isTransmitting) return;
    isTransmitting = false;

    btnPTT.classList.remove('transmitting');
    pttText.textContent = 'HOLD TO TALK';

    window.soundFX.playPttEnd();
    if (talkMode === 'ptt') {
      setMicTrackEnabled(false);
    }
    socket.emit('update-state', { isTalking: false });
    updateUserCardTalking(socket.id, false);
  }

  // Mouse & Touch PTT Events
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

  // Keyboard Spacebar PTT & Hotkeys
  window.addEventListener('keydown', (e) => {
    // Ignore input if user is typing in chat or input fields
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

  // Mode Switcher (PTT vs Open Call)
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

  // Mute Toggle
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

  // Deafen Toggle
  btnToggleDeafen.addEventListener('click', toggleDeafen);

  function toggleDeafen() {
    isDeafened = !isDeafened;
    btnToggleDeafen.classList.toggle('active-muted', isDeafened);
    deafenIcon.textContent = isDeafened ? '🔇' : '🎧';
    deafenLabel.textContent = isDeafened ? 'Undeafen' : 'Deafen';

    // Mute/Unmute all incoming remote audio elements
    peerConnections.forEach((conn) => {
      if (conn.audioElement) {
        conn.audioElement.muted = isDeafened;
      }
    });

    socket.emit('update-state', { isDeafened });
    updateUserCardState(socket.id, { isDeafened });
  }

  // Leave Room
  btnLeaveRoom.addEventListener('click', leaveCurrentChannel);

  function leaveCurrentChannel() {
    if (!currentChannel) return;

    socket.emit('leave-room');
    peerConnections.forEach((conn, targetId) => closePeerConnection(targetId));
    roomMembersMap.clear();

    currentChannel = null;
    headerChannelBadge.querySelector('.status-dot').className = 'status-dot disconnected';
    headerChannelName.textContent = 'Not Connected';
    roomTitle.textContent = 'Select a Channel';
    roomDesc.textContent = 'Click any channel on the left sidebar to connect and talk with colleagues.';
    roomIcon.textContent = '📢';
    roomMemberCount.textContent = '0 Active Colleagues';

    participantGrid.innerHTML = '';
    participantGrid.appendChild(emptyRoomPlaceholder);
    controlDock.classList.add('disabled');

    // Deselect channel cards
    document.querySelectorAll('.channel-card').forEach(card => card.classList.remove('active'));
  }

  // -------------------------------------------------------------
  // 6. UI Render Helpers
  // -------------------------------------------------------------
  function renderChannelsList(channels) {
    channelsList.innerHTML = '';
    channels.forEach(ch => {
      const card = document.createElement('div');
      card.className = `channel-card ${currentChannel && currentChannel.id === ch.id ? 'active' : ''}`;
      card.dataset.id = ch.id;

      card.innerHTML = `
        <div class="channel-left">
          <span class="channel-icon">${ch.icon}</span>
          <div class="channel-info">
            <h4>${ch.name} ${ch.isProtected ? '🔒' : ''}</h4>
            <p>${ch.description}</p>
          </div>
        </div>
        <span class="channel-badge">${ch.activeUserCount} online</span>
      `;

      card.addEventListener('click', () => {
        if (currentChannel && currentChannel.id === ch.id) return;
        
        let pin = null;
        if (ch.isProtected) {
          pin = prompt('Enter Room Passcode PIN:');
          if (!pin) return;
        }

        socket.emit('join-room', { roomId: ch.id, pin });
      });

      channelsList.appendChild(card);
    });
  }

  function renderParticipantCard(socketId, user) {
    // Remove placeholder if present
    if (document.getElementById('emptyRoomPlaceholder')) {
      participantGrid.innerHTML = '';
    }

    const existingCard = document.getElementById(`pcard-${socketId}`);
    if (existingCard) existingCard.remove();

    const card = document.createElement('div');
    card.className = 'participant-card';
    card.id = `pcard-${socketId}`;

    card.innerHTML = `
      <div class="participant-avatar-wrapper">
        <div class="participant-avatar" style="border-color: ${user.color || '#3b82f6'};">${user.avatar || '👤'}</div>
        <div class="talking-aura"></div>
      </div>
      <span class="participant-name">${user.name} ${socketId === socket.id ? '(You)' : ''}</span>
      <span class="participant-dept">${user.department || user.role}</span>
      <div class="status-badges">
        <span class="badge-tag ${user.talkMode || 'ptt'}">${(user.talkMode || 'ptt').toUpperCase()}</span>
        <span class="badge-tag muted ${user.isMuted ? '' : 'hidden'}">MUTED</span>
      </div>
    `;

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

  function updateRoomMemberCount() {
    const count = roomMembersMap.size;
    roomMemberCount.textContent = `${count} Active Colleague${count === 1 ? '' : 's'}`;
  }

  // -------------------------------------------------------------
  // 7. Channel Text Chat Engine
  // -------------------------------------------------------------
  chatForm.addEventListener('submit', (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text || !currentChannel) return;

    socket.emit('send-message', { text });
    chatInput.value = '';
  });

  function appendChatMessage(msg) {
    const bubble = document.createElement('div');
    bubble.className = 'chat-bubble';

    bubble.innerHTML = `
      <div class="chat-sender-row">
        <span class="chat-sender-name" style="color: ${msg.senderColor || '#3b82f6'};">${msg.senderName}</span>
        <span class="chat-time">${msg.timestamp}</span>
      </div>
      <div class="chat-text">${escapeHTML(msg.text)}</div>
    `;

    chatMessages.appendChild(bubble);
    chatMessages.scrollTop = chatMessages.scrollHeight;
  }

  function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
      tag => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[tag] || tag)
    );
  }

  // -------------------------------------------------------------
  // 8. Custom Room Creation Modal & Sound FX Toggle
  // -------------------------------------------------------------
  btnOpenCreateChannel.addEventListener('click', () => modalCreateChannel.classList.remove('hidden'));
  btnCloseCreateChannel.addEventListener('click', () => modalCreateChannel.classList.add('hidden'));

  formCreateChannel.addEventListener('submit', (e) => {
    e.preventDefault();
    const name = document.getElementById('newChannelName').value.trim();
    const description = document.getElementById('newChannelDesc').value.trim();
    const pin = document.getElementById('newChannelPin').value.trim();

    if (!name) return;
    socket.emit('create-channel', { name, description, icon: '💬', pin: pin || null });
  });

  btnAudioSettings.addEventListener('click', () => modalAudioSettings.classList.remove('hidden'));
  btnCloseAudioSettings.addEventListener('click', () => modalAudioSettings.classList.add('hidden'));

  btnToggleSoundFX.addEventListener('click', () => {
    window.soundFX.enabled = !window.soundFX.enabled;
    btnToggleSoundFX.textContent = `🔊 Sound FX: ${window.soundFX.enabled ? 'ON' : 'OFF'}`;
  });

  function getRandomColor() {
    const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4'];
    return colors[Math.floor(Math.random() * colors.length)];
  }
});
