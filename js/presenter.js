// Obsidian Security — Premium Presentation Controller
// Particles, audio visualizer, staggered animations, cinematic transitions

(function () {
  // ── Particle mesh background ──
  const canvas = document.getElementById('particle-canvas');
  const ctx = canvas.getContext('2d');
  let particles = [];
  let mouse = { x: -1000, y: -1000 };

  function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  class Particle {
    constructor() {
      this.reset();
    }
    reset() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.vx = (Math.random() - 0.5) * 0.3;
      this.vy = (Math.random() - 0.5) * 0.3;
      this.radius = Math.random() * 1.5 + 0.5;
      this.opacity = Math.random() * 0.4 + 0.1;
    }
    update() {
      this.x += this.vx;
      this.y += this.vy;

      // Mouse repulsion
      const dx = this.x - mouse.x;
      const dy = this.y - mouse.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < 150) {
        const force = (150 - dist) / 150 * 0.02;
        this.vx += dx * force;
        this.vy += dy * force;
      }

      // Dampen velocity
      this.vx *= 0.99;
      this.vy *= 0.99;

      // Wrap around
      if (this.x < 0) this.x = canvas.width;
      if (this.x > canvas.width) this.x = 0;
      if (this.y < 0) this.y = canvas.height;
      if (this.y > canvas.height) this.y = 0;
    }
    draw() {
      ctx.beginPath();
      ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(167, 139, 250, ${this.opacity})`;
      ctx.fill();
    }
  }

  // Initialize particles
  const particleCount = Math.min(80, Math.floor(window.innerWidth * window.innerHeight / 15000));
  for (let i = 0; i < particleCount; i++) {
    particles.push(new Particle());
  }

  function drawConnections() {
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 150) {
          const opacity = (1 - dist / 150) * 0.08;
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(124, 58, 237, ${opacity})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      }
    }
  }

  function animateParticles() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => { p.update(); p.draw(); });
    drawConnections();
    requestAnimationFrame(animateParticles);
  }
  animateParticles();

  document.addEventListener('mousemove', (e) => {
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });

  // ── Audio visualizer ──
  const vizCanvas = document.getElementById('audio-visualizer');
  const vizCtx = vizCanvas.getContext('2d');
  let audioContext = null;
  let analyser = null;
  let vizAnimFrame = null;

  function resizeViz() {
    vizCanvas.width = window.innerWidth;
    vizCanvas.height = 60;
  }
  resizeViz();
  window.addEventListener('resize', resizeViz);

  function drawVisualizer() {
    if (!analyser) return;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);
    analyser.getByteFrequencyData(dataArray);

    vizCtx.clearRect(0, 0, vizCanvas.width, vizCanvas.height);

    const barWidth = vizCanvas.width / bufferLength * 2.5;
    let x = 0;
    for (let i = 0; i < bufferLength; i++) {
      const barHeight = (dataArray[i] / 255) * vizCanvas.height;
      const gradient = vizCtx.createLinearGradient(0, vizCanvas.height, 0, vizCanvas.height - barHeight);
      gradient.addColorStop(0, 'rgba(124, 58, 237, 0.0)');
      gradient.addColorStop(1, `rgba(167, 139, 250, ${0.3 + (dataArray[i] / 255) * 0.4})`);
      vizCtx.fillStyle = gradient;
      vizCtx.fillRect(x, vizCanvas.height - barHeight, barWidth - 1, barHeight);
      x += barWidth;
    }
    vizAnimFrame = requestAnimationFrame(drawVisualizer);
  }

  function startVisualizer(audioElement) {
    try {
      if (!audioContext) {
        audioContext = new (window.AudioContext || window.webkitAudioContext)();
      }
      const source = audioContext.createMediaElementSource(audioElement);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 128;
      source.connect(analyser);
      analyser.connect(audioContext.destination);
      vizCanvas.classList.add('playing');
      drawVisualizer();
    } catch (e) {
      // Fallback: visualizer won't show, audio still plays
      console.warn('Visualizer init failed:', e);
    }
  }

  function stopVisualizer() {
    vizCanvas.classList.remove('playing');
    if (vizAnimFrame) cancelAnimationFrame(vizAnimFrame);
    analyser = null;
  }

  // ── Slide controller ──
  const slides = document.querySelectorAll('.slide');
  const totalSlides = slides.length;
  let currentSlide = 0;
  let isAutoplay = false;
  let currentAudio = null;
  let audioSourceMap = new WeakMap(); // Track which audio elements already have sources

  // Build audio indicator
  const indicator = document.createElement('div');
  indicator.id = 'audio-indicator';
  for (let i = 0; i < 7; i++) {
    const bar = document.createElement('div');
    bar.className = 'bar';
    indicator.appendChild(bar);
  }
  document.getElementById('presentation').appendChild(indicator);

  function updateUI() {
    document.getElementById('slide-counter').textContent =
      `${currentSlide + 1} / ${totalSlides}`;
    document.getElementById('progress-fill').style.width =
      `${((currentSlide + 1) / totalSlides) * 100}%`;
  }

  function showSlide(index, direction) {
    if (index < 0 || index >= totalSlides) return;

    const prev = slides[currentSlide];
    const next = slides[index];

    stopAudio();

    // Reset animations on the new slide
    next.querySelectorAll('.anim').forEach(el => {
      el.style.animation = 'none';
      el.offsetHeight; // Force reflow
      el.style.animation = '';
    });

    // Transition out
    prev.classList.remove('active');
    prev.classList.add('exit-left');
    setTimeout(() => prev.classList.remove('exit-left'), 700);

    // Transition in
    next.classList.add('active');

    currentSlide = index;
    updateUI();

    if (isAutoplay) {
      setTimeout(() => playSlideAudio(currentSlide), 800);
    }
  }

  window.nextSlide = function () {
    if (currentSlide < totalSlides - 1) showSlide(currentSlide + 1, 'forward');
  };
  window.prevSlide = function () {
    if (currentSlide > 0) showSlide(currentSlide - 1, 'backward');
  };

  function stopAudio() {
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      currentAudio = null;
    }
    indicator.classList.remove('playing');
    stopVisualizer();
  }

  function playSlideAudio(index) {
    const slideEl = slides[index];
    const slideId = slideEl.dataset.slide;
    const audioPath = `audio/${slideId}.mp3`;

    const audio = new Audio();
    audio.crossOrigin = 'anonymous';
    audio.src = audioPath;
    currentAudio = audio;

    audio.addEventListener('canplaythrough', () => {
      audio.play();
      indicator.classList.add('playing');
      if (!audioSourceMap.has(audio)) {
        audioSourceMap.set(audio, true);
        startVisualizer(audio);
      }
    }, { once: true });

    audio.addEventListener('ended', () => {
      indicator.classList.remove('playing');
      stopVisualizer();
      currentAudio = null;
      if (isAutoplay && currentSlide < totalSlides - 1) {
        setTimeout(() => nextSlide(), 800);
      } else if (isAutoplay && currentSlide === totalSlides - 1) {
        setAutoplay(false);
      }
    });

    audio.addEventListener('error', () => {
      console.warn(`Audio not found: ${slideId}`);
      indicator.classList.remove('playing');
      if (isAutoplay && currentSlide < totalSlides - 1) {
        setTimeout(() => nextSlide(), 3000);
      }
    });
  }

  function setAutoplay(on) {
    isAutoplay = on;
    document.getElementById('play-icon').style.display = on ? 'none' : 'block';
    document.getElementById('pause-icon').style.display = on ? 'block' : 'none';
    if (on) {
      playSlideAudio(currentSlide);
    } else {
      stopAudio();
    }
  }

  window.toggleAutoplay = function () { setAutoplay(!isAutoplay); };

  // Keyboard
  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowRight': case ' ':
        e.preventDefault(); nextSlide(); break;
      case 'ArrowLeft':
        e.preventDefault(); prevSlide(); break;
      case 'p': toggleAutoplay(); break;
      case 'Escape': setAutoplay(false); break;
    }
  });

  // Click navigation
  document.addEventListener('click', (e) => {
    if (e.target.closest('#controls') || e.target.closest('.nav-arrow') ||
        e.target.closest('.cta-btn')) return;
    if (e.clientX > window.innerWidth / 2) nextSlide();
    else prevSlide();
  });

  // Touch
  let touchStartX = 0;
  document.addEventListener('touchstart', (e) => { touchStartX = e.changedTouches[0].screenX; });
  document.addEventListener('touchend', (e) => {
    const diff = touchStartX - e.changedTouches[0].screenX;
    if (Math.abs(diff) > 50) diff > 0 ? nextSlide() : prevSlide();
  });

  // URL param support
  const urlSlide = new URLSearchParams(window.location.search).get('slide');
  if (urlSlide !== null) {
    const idx = parseInt(urlSlide);
    if (idx > 0 && idx < totalSlides) {
      slides[0].classList.remove('active');
      slides[idx].classList.add('active');
      currentSlide = idx;
    }
  }
  updateUI();
})();
