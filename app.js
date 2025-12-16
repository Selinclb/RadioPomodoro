const STREAM_URL = 'https://icecast.radiofrance.fr/fip-midfi.mp3'; // Radyo akış adresini burada değiştirin.

const audio = new Audio(STREAM_URL);
audio.preload = 'none';
audio.crossOrigin = 'anonymous';

const playPauseBtn = document.getElementById('playPause');
const statusText = document.getElementById('statusText');
const volumeSlider = document.getElementById('volume');
const radioVisual = document.querySelector('.pill-card.radio-card');
const volumeBtn = document.getElementById('volumeBtn');
const playPauseIcon = playPauseBtn.querySelector('img');
const waveBars = document.querySelector('.wave-bars');
const waveBarsSpans = waveBars ? Array.from(waveBars.querySelectorAll('span')) : [];

let audioContext;
let analyser;
let mediaSource;
let dataArray;
let animationId; // requestAnimationFrame'ı kontrol etmek için

function setStatus(message, state = 'info') {
  statusText.textContent = message;
  statusText.dataset.state = state;
}

function updateButton(isPlaying) {
  playPauseBtn.setAttribute('aria-label', isPlaying ? 'Durdur' : 'Oynat');
  if (playPauseIcon) {
    playPauseIcon.src = isPlaying ? 'stop.svg' : 'play.svg';
  }
}


async function togglePlayback() {
  if (!STREAM_URL) {
    setStatus('Akış adresini ayarlayın.', 'error');
    return;
  }

  if (audio.paused) {
    setStatus('Bağlanıyor...', 'loading');
    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
        analyser = audioContext.createAnalyser();
        mediaSource = audioContext.createMediaElementSource(audio);
        mediaSource.connect(analyser);
        analyser.connect(audioContext.destination);
        analyser.fftSize = 256;
        dataArray = new Uint8Array(analyser.frequencyBinCount);
      }
      if (audioContext.state === 'suspended') {
        await audioContext.resume();
      }
      await audio.play();
    } catch (err) {
      setStatus('Çalma başlatılamadı. Tarayıcı engelliyor olabilir.', 'error');
      updateButton(false);
      radioVisual?.classList.remove('playing');
    }
  } else {
    audio.pause();
    setStatus('Duraklatıldı.', 'idle');
    updateButton(false);
    radioVisual?.classList.remove('playing');
  }
}

function visualize() {
  analyser.getByteFrequencyData(dataArray);

  const barCount = waveBarsSpans.length;
  for (let i = 0; i < barCount; i++) {
    const bar = waveBarsSpans[i];
    const value = dataArray[i * Math.floor(analyser.frequencyBinCount / barCount)];
    const normalizedValue = value / 255;
    const minHeight = 8;
    const maxHeight = 48;
    const height = minHeight + (normalizedValue * (maxHeight - minHeight));
    bar.style.height = `${height}px`;
    bar.style.opacity = 0.7 + (normalizedValue * 0.3);
    
    // Glow effect based on audio level
    const glowIntensity = normalizedValue * 0.6;
    bar.style.boxShadow = `
      0 0 ${4 + glowIntensity * 8}px rgba(193, 179, 255, ${0.3 + glowIntensity * 0.4}),
      inset 0 1px 1px rgba(255, 255, 255, 0.1)
    `;
  }

  animationId = requestAnimationFrame(visualize);
}

audio.addEventListener('play', () => {
  setStatus('Çalıyor.', 'playing');
  updateButton(true);
  radioVisual?.classList.add('playing');
  // Web Audio API görselleştirmesini başlat
  if (analyser && dataArray) {
    visualize();
  }
});

audio.addEventListener('pause', () => {
  setStatus('Duraklatıldı.', 'idle');
  updateButton(false);
  radioVisual?.classList.remove('playing');
  // Web Audio API görselleştirmesini durdur
  if (animationId) {
    cancelAnimationFrame(animationId);
    animationId = null;
  }
  // Duraklatıldığında çubukları varsayılan yüksekliğe sıfırla
  waveBarsSpans.forEach((span, index) => {
    const defaultHeights = ['40%', '70%', '55%', '85%', '60%', '75%'];
    span.style.height = defaultHeights[index] || '50%';
    span.style.opacity = '0.7';
    span.style.boxShadow = `
      0 0 4px rgba(193, 179, 255, 0.3),
      inset 0 1px 1px rgba(255, 255, 255, 0.1)
    `;
  });
});

audio.addEventListener('waiting', () => setStatus('Bağlanıyor...', 'loading'));
audio.addEventListener('stalled', () => setStatus('Akış bekleniyor...', 'loading'));
audio.addEventListener('error', () => setStatus('Akışa bağlanılamadı. URL\'i kontrol edin.', 'error'));

volumeSlider.addEventListener('input', (e) => {
  audio.volume = Number(e.target.value);
});

playPauseBtn.addEventListener('click', togglePlayback);
volumeBtn.addEventListener('click', () => {
  audio.muted = !audio.muted;
  setStatus(audio.muted ? 'Sessiz.' : 'Ses açık.', audio.muted ? 'idle' : 'playing');
});

document.addEventListener('keydown', (e) => {
  if (e.code === 'Space') {
    e.preventDefault();
    togglePlayback();
  }
});

audio.volume = Number(volumeSlider.value);

// Pomodoro
const pomoTimeEl = document.getElementById('pomoTime');
const pomoToggle = document.getElementById('pomoToggle');
const pomoReset = document.getElementById('pomoReset');
const pomoSwitch = document.getElementById('pomoSwitch');
const totalPomoTimeEl = document.getElementById('totalPomoTime'); // Yeni eklendi
const loopCountEl = document.getElementById('loopCount'); // Yeni eklendi
const usernameEl = document.querySelector('.username'); // Yeni eklendi
const loginBtn = document.getElementById('loginBtn'); // Yeni eklendi
const registerBtn = document.getElementById('registerBtn'); // Yeni eklendi

let isLoggedIn = false; // Kullanıcının giriş durumunu takip etmek için

const DURATIONS = { 
  focus: 25 * 60, 
  shortBreak: 5 * 60, 
  longBreak: 15 * 60 
};
let currentMode = 'focus';
let remaining = DURATIONS[currentMode];
let timerId = null;
const pomoSound = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
pomoSound.volume = 0.6;
pomoSound.preload = 'auto';
let pomoSoundEnabled = true;
let audioUnlocked = false; // Tarayıcı ses kilidini kontrol etmek için

// İlk kullanıcı etkileşiminde sesi kilitlemeyi aç (tarayıcı kısıtlaması için)
function unlockAudio() {
  if (audioUnlocked) return;
  const originalVolume = pomoSound.volume;
  pomoSound.volume = 0.01;
  pomoSound.currentTime = 0;
  pomoSound.play().then(() => {
    audioUnlocked = true;
    pomoSound.pause();
    pomoSound.currentTime = 0;
    pomoSound.volume = originalVolume;
  }).catch(() => {
    pomoSound.volume = originalVolume;
  });
}
document.addEventListener('click', unlockAudio, { once: true });
document.addEventListener('keydown', unlockAudio, { once: true });

let totalPomodorosCompleted = 0;
let totalPomoMinutes = 0;

const modeButtons = document.querySelectorAll('.mode-btn');

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function updatePomoStats() { // Yeni fonksiyon
  if (totalPomoTimeEl) {
    totalPomoTimeEl.textContent = `${totalPomoMinutes} minutes`;
  }
  if (loopCountEl) {
    loopCountEl.textContent = totalPomodorosCompleted;
  }
}

function updateProfileUI() { // Yeni eklendi
  if (usernameEl) {
    usernameEl.style.display = isLoggedIn ? 'block' : 'none';
  }
  if (loginBtn && registerBtn) {
    if (isLoggedIn) {
      loginBtn.textContent = 'Çıkış Yap';
      registerBtn.style.display = 'none'; // Kayıt ol butonunu gizle
    } else {
      loginBtn.textContent = 'Giriş Yap';
      registerBtn.style.display = 'block'; // Kayıt ol butonunu göster
    }
  }
}

function renderPomo() {
  pomoTimeEl.textContent = formatTime(remaining);

  const pomoToggleIcon = pomoToggle.querySelector('img');
  if (pomoToggleIcon) {
    pomoToggleIcon.src = timerId ? 'stop.svg' : 'play.svg';
    pomoToggle.setAttribute('aria-label', timerId ? 'Durdur' : 'Başlat');
  }

  const pomoSwitchIcon = pomoSwitch.querySelector('img');
  if (pomoSwitchIcon) {
    pomoSwitchIcon.src = pomoSoundEnabled ? 'notice.svg' : 'noticeoff.svg';
    pomoSwitch.setAttribute('aria-label', pomoSoundEnabled ? 'Bildirim sesi açık' : 'Bildirim sesi kapalı');
  }
}

function tick() {
  remaining -= 1;
  if (remaining <= 0) {
    clearInterval(timerId);
    timerId = null;
    if (pomoSoundEnabled) {
      pomoSound.currentTime = 0;
      pomoSound.play().catch(() => {});
    }
    // Pomodoro tamamlandığında istatistikleri güncelle
    if (currentMode === 'focus') {
      totalPomodorosCompleted += 1;
      totalPomoMinutes += DURATIONS.focus / 60;
    }
    updatePomoStats();
    
    // Otomatik mod geçişi
    if (currentMode === 'focus') {
      // Her 4 focus'tan sonra uzun mola
      if (totalPomodorosCompleted % 4 === 0) {
        setPomoMode('longBreak');
      } else {
        setPomoMode('shortBreak');
      }
    } else {
      setPomoMode('focus');
    }
  }
  renderPomo();
}

function setPomoMode(mode) {
  clearInterval(timerId);
  timerId = null;
  currentMode = mode;
  remaining = DURATIONS[currentMode];
  
  // UI güncelle
  modeButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.mode === mode);
  });
  
  renderPomo();
}

function togglePomo() {
  if (timerId) {
    clearInterval(timerId);
    timerId = null;
  } else {
    timerId = setInterval(tick, 1000);
  }
  renderPomo();
}

function resetPomo() {
  clearInterval(timerId);
  timerId = null;
  remaining = DURATIONS[currentMode];
  renderPomo();
}

function switchMode() {
  pomoSoundEnabled = !pomoSoundEnabled;
  renderPomo();
}

pomoToggle.addEventListener('click', togglePomo);
pomoReset.addEventListener('click', resetPomo);
pomoSwitch.addEventListener('click', switchMode);

// Mod butonları için event listener
modeButtons.forEach(btn => {
  btn.addEventListener('click', () => {
    setPomoMode(btn.dataset.mode);
  });
});

loginBtn.addEventListener('click', () => {
  // Giriş ekranı olmadığı için şimdilik bir şey yapmıyoruz.
  console.log('Giriş Yap butonuna tıklandı, ancak giriş ekranı mevcut değil.');
});

registerBtn.addEventListener('click', () => {
  console.log('Kayıt Ol butonuna tıklandı.');
});

renderPomo();
updatePomoStats(); // Uygulama başlangıcında istatistikleri yükle

// Ambiyans
const ambienceConfig = {
  rain: 'rain.wav',
  forest: 'Forest.mp3'
};

const ambiencePlayers = {};
Object.entries(ambienceConfig).forEach(([key, url]) => {
  const a = new Audio(url);
  a.loop = true;
  a.volume = 0.5;
  ambiencePlayers[key] = a;
});

const ambNow = document.getElementById('ambNow');
const ambPlayBtn = document.getElementById('ambPlay');
const ambChangeBtn = document.getElementById('ambChange');
const ambienceVolumeSlider = document.getElementById('ambienceVolume');

const ambList = ['rain', 'forest'];
let ambIndex = 0;

function updateAmbienceUI() {
  const currentAmbienceKey = ambList[ambIndex];
  ambNow.textContent = currentAmbienceKey === 'rain' ? 'Rain' : 'Forest';

  const ambPlayIcon = ambPlayBtn.querySelector('img');
  const currentPlayer = ambiencePlayers[currentAmbienceKey];
  if (ambPlayIcon && currentPlayer) {
    ambPlayIcon.src = currentPlayer.paused ? 'play.svg' : 'stop.svg';
    ambPlayBtn.setAttribute('aria-label', currentPlayer.paused ? 'Ambiyansı oynat' : 'Ambiyansı durdur');
  }

  // Ses kaydırıcısını güncel ambiyansın sesine ayarla
  if (currentPlayer && ambienceVolumeSlider) {
    ambienceVolumeSlider.value = currentPlayer.volume;
  }
}

function stopAllAmbiencePlayers() {
  ambList.forEach((key) => {
    const player = ambiencePlayers[key];
    if (player && !player.paused) {
      player.pause();
      player.currentTime = 0;
    }
  });
}

ambPlayBtn.addEventListener('click', () => {
  const currentAmbienceKey = ambList[ambIndex];
  const player = ambiencePlayers[currentAmbienceKey];

  if (player.paused) {
    stopAllAmbiencePlayers(); // Diğerlerini durdur
    player.play();
  } else {
    player.pause();
    player.currentTime = 0;
  }
  updateAmbienceUI();
});

ambChangeBtn.addEventListener('click', () => {
  stopAllAmbiencePlayers();
  ambIndex = (ambIndex + 1) % ambList.length;
  updateAmbienceUI();
});

ambienceVolumeSlider.addEventListener('input', (e) => {
  const currentAmbienceKey = ambList[ambIndex];
  const player = ambiencePlayers[currentAmbienceKey];
  if (player) {
    player.volume = Number(e.target.value);
  }
});

updateAmbienceUI();
updateProfileUI(); // Uygulama başlangıcında profil UI'ını güncelle

// Mobile Tab Card Toggle
const pillCards = document.querySelectorAll('.pill-card');

function isMobile() {
  return window.innerWidth <= 768;
}

function closeAllCards() {
  pillCards.forEach(card => card.classList.remove('expanded'));
}

function toggleCard(card) {
  if (!isMobile()) return;
  
  const isExpanded = card.classList.contains('expanded');
  
  if (isExpanded) {
    card.classList.remove('expanded');
  } else {
    closeAllCards();
    card.classList.add('expanded');
  }
}

// Add click listeners to cards for mobile
pillCards.forEach(card => {
  card.addEventListener('click', (e) => {
    if (!isMobile()) return;
    
    // Don't toggle if clicking on interactive elements
    const isInteractive = e.target.closest('button, input, .icon-btn, .mode-btn');
    if (isInteractive && card.classList.contains('expanded')) {
      return; // Allow interaction with buttons when expanded
    }
    
    toggleCard(card);
  });
});

// Close card when clicking outside
document.addEventListener('click', (e) => {
  if (!isMobile()) return;
  
  const clickedCard = e.target.closest('.pill-card');
  if (!clickedCard) {
    closeAllCards();
  }
});

// Handle window resize
window.addEventListener('resize', () => {
  if (!isMobile()) {
    closeAllCards();
  }
});
