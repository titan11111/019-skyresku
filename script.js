/**
 * Cosmic Cat Fall - Enhanced Edition
 * 統一された世界観とゲーム性を持つ落下ゲーム
 */

// ===== Configuration =====
const CONFIG = {
    CAT_SIZE: 50,
    GRAVITY: 0.20,
    FLOAT_POWER: 0.50,
    MOVE_SPEED: 6,
    MAX_VSPEED: 10,
    GOAL_DEPTH: 10000,
    
    // Spawn settings
    OBSTACLE_BASE_INTERVAL: 1500,
    OBSTACLE_MIN_INTERVAL: 600,
    ITEM_INTERVAL: 3000,
    
    // Combo system
    COMBO_TIMEOUT: 120, // frames
    COMBO_BONUS: 10, // bonus distance per combo
};

// ===== Stage Definitions =====
const STAGES = [
    {
        name: '🌌 深宇宙',
        start: 0,
        end: 1500,
        bg: {
            top: '#000428',
            bottom: '#004e92',
            stars: true,
            starDensity: 100,
        },
        obstacles: ['asteroid', 'satellite'],
        music: 'space'
    },
    {
        name: '🔥 大気圏突入',
        start: 1500,
        end: 3000,
        bg: {
            top: '#ff4e00',
            bottom: '#ec9f05',
            particles: 'fire',
            starDensity: 50,
        },
        obstacles: ['meteor', 'debris'],
        music: 'intense'
    },
    {
        name: '☁️ 雲の上',
        start: 3000,
        end: 5000,
        bg: {
            top: '#4facfe',
            bottom: '#00f2fe',
            clouds: true,
        },
        obstacles: ['cloud', 'bird'],
        music: 'calm'
    },
    {
        name: '🌅 夕焼け空',
        start: 5000,
        end: 7000,
        bg: {
            top: '#fa709a',
            bottom: '#fee140',
            clouds: true,
        },
        obstacles: ['cloud', 'balloon'],
        music: 'sunset'
    },
    {
        name: '🌃 夜の街',
        start: 7000,
        end: 9000,
        bg: {
            top: '#141e30',
            bottom: '#243b55',
            buildings: true,
            stars: true,
            starDensity: 30,
        },
        obstacles: ['building', 'ufo'],
        music: 'night'
    },
    {
        name: '🏔️ 地下洞窟',
        start: 9000,
        end: 10000,
        bg: {
            top: '#1a1a2e',
            bottom: '#16213e',
            caves: true,
        },
        obstacles: ['stalactite', 'crystal'],
        music: 'cave'
    }
];

// ===== Game State =====
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d', { alpha: false });
let width, height;

let state = 'start'; // start, playing, gameover, clear
let frame = 0;
let score = 0;
let stars = 0;
let combo = 0;
let maxCombo = 0;
let comboTimer = 0;
let bestScore = parseInt(localStorage.getItem('cosmicCatBest')) || 0;

let currentStage = 0;
let stageTransitioning = false;

// Entities
let cat = null;
let obstacles = [];
let items = [];
let particles = [];
let bgElements = [];

// Input
const input = { left: false, right: false, float: false };

// Audio
let audioCtx = null;

// ===== Initialization =====
function resize() {
    const container = document.getElementById('gameContainer');
    const rect = container.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    width = rect.width;
    height = rect.height;
    
    ctx.scale(dpr, dpr);
}

window.addEventListener('resize', resize);
resize();

// ===== Audio System =====
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

function playSound(type) {
    if (!audioCtx) return;
    const t = audioCtx.currentTime;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.connect(gain);
    gain.connect(audioCtx.destination);

    switch(type) {
        case 'float':
            osc.frequency.setValueAtTime(220, t);
            osc.frequency.linearRampToValueAtTime(330, t + 0.08);
            gain.gain.setValueAtTime(0.08, t);
            gain.gain.linearRampToValueAtTime(0, t + 0.08);
            osc.start(t);
            osc.stop(t + 0.08);
            break;
        case 'star':
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, t);
            osc.frequency.exponentialRampToValueAtTime(1760, t + 0.15);
            gain.gain.setValueAtTime(0.12, t);
            gain.gain.exponentialRampToValueAtTime(0.01, t + 0.2);
            osc.start(t);
            osc.stop(t + 0.2);
            break;
        case 'hit':
            osc.type = 'sawtooth';
            osc.frequency.setValueAtTime(80, t);
            osc.frequency.exponentialRampToValueAtTime(30, t + 0.25);
            gain.gain.setValueAtTime(0.15, t);
            gain.gain.linearRampToValueAtTime(0, t + 0.25);
            osc.start(t);
            osc.stop(t + 0.25);
            break;
        case 'clear':
            [523, 659, 784, 1046].forEach((f, i) => {
                const o = audioCtx.createOscillator();
                const g = audioCtx.createGain();
                o.connect(g);
                g.connect(audioCtx.destination);
                o.type = 'sine';
                o.frequency.value = f;
                g.gain.setValueAtTime(0.1, t + i * 0.1);
                g.gain.linearRampToValueAtTime(0, t + i * 0.1 + 0.4);
                o.start(t + i * 0.1);
                o.stop(t + i * 0.1 + 0.4);
            });
            break;
        case 'combo':
            osc.type = 'square';
            osc.frequency.setValueAtTime(440 + combo * 50, t);
            gain.gain.setValueAtTime(0.06, t);
            gain.gain.linearRampToValueAtTime(0, t + 0.1);
            osc.start(t);
            osc.stop(t + 0.1);
            break;
    }
}

// ===== Cat Class =====
class Cat {
    constructor() {
        this.x = width / 2;
        this.y = height * 0.25;
        this.vx = 0;
        this.vy = 0;
        this.size = CONFIG.CAT_SIZE;
        this.angle = 0;
        this.expression = 'normal'; // normal, happy, scared
        this.trail = [];
    }
    
    update() {
        // Movement
        if (input.left) {
            this.vx = -CONFIG.MOVE_SPEED;
            this.angle = -12;
        } else if (input.right) {
            this.vx = CONFIG.MOVE_SPEED;
            this.angle = 12;
        } else {
            this.vx *= 0.85;
            this.angle *= 0.85;
        }
        
        // Gravity & Float
        if (input.float) {
            this.vy -= CONFIG.FLOAT_POWER;
            if (frame % 3 === 0) {
                spawnParticles(this.x, this.y + this.size / 2, 1, 'rgba(200,220,255,0.8)', 2);
            }
        } else {
            this.vy += CONFIG.GRAVITY;
        }
        
        this.vy = Math.min(this.vy, CONFIG.MAX_VSPEED);
        
        // Apply velocity
        this.x += this.vx;
        this.y += this.vy;
        
        // Boundaries
        if (this.x < this.size / 2) {
            this.x = this.size / 2;
            this.vx = 0;
        }
        if (this.x > width - this.size / 2) {
            this.x = width - this.size / 2;
            this.vx = 0;
        }
        
        // Camera follow
        const targetY = height * 0.35;
        if (this.y > targetY) {
            const scroll = this.y - targetY;
            this.y = targetY;
            score += scroll * 0.1;
        } else if (this.y < height * 0.1) {
            this.y = height * 0.1;
            this.vy = 0;
        }
        
        // Trail
        this.trail.push({ x: this.x, y: this.y, alpha: 1 });
        if (this.trail.length > 5) this.trail.shift();
        this.trail.forEach(t => t.alpha *= 0.9);
        
        // Game over check
        if (this.y > height + 50) {
            gameOver();
        }
        
        // Goal check
        if (score >= CONFIG.GOAL_DEPTH) {
            gameClear();
        }
    }
    
    draw() {
        // Trail
        if (Math.abs(this.vy) > 5) {
            this.trail.forEach(t => {
                ctx.globalAlpha = t.alpha * 0.3;
                this.drawCat(t.x, t.y, this.angle);
            });
            ctx.globalAlpha = 1;
        }
        
        // Main cat
        this.drawCat(this.x, this.y, this.angle);
    }
    
    drawCat(x, y, angle) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(angle * Math.PI / 180);
        
        const s = this.size;
        
        // Body
        ctx.fillStyle = '#FFB366';
        ctx.strokeStyle = '#D4895C';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.ellipse(0, 0, s * 0.45, s * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Ears
        ctx.fillStyle = '#FFB366';
        ctx.beginPath();
        ctx.moveTo(-s * 0.3, -s * 0.3);
        ctx.lineTo(-s * 0.15, -s * 0.55);
        ctx.lineTo(-s * 0.05, -s * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.beginPath();
        ctx.moveTo(s * 0.3, -s * 0.3);
        ctx.lineTo(s * 0.15, -s * 0.55);
        ctx.lineTo(s * 0.05, -s * 0.3);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        // Face
        ctx.fillStyle = '#2C2C2C';
        if (this.expression === 'happy') {
            ctx.font = `${s * 0.5}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('^ω^', 0, -s * 0.05);
        } else if (this.expression === 'scared') {
            ctx.beginPath();
            ctx.arc(-s * 0.15, -s * 0.05, s * 0.08, 0, Math.PI * 2);
            ctx.arc(s * 0.15, -s * 0.05, s * 0.08, 0, Math.PI * 2);
            ctx.fill();
            // Mouth
            ctx.beginPath();
            ctx.arc(0, s * 0.15, s * 0.1, 0, Math.PI);
            ctx.stroke();
        } else {
            // Normal eyes
            ctx.beginPath();
            ctx.arc(-s * 0.15, -s * 0.05, s * 0.06, 0, Math.PI * 2);
            ctx.arc(s * 0.15, -s * 0.05, s * 0.06, 0, Math.PI * 2);
            ctx.fill();
            
            // Nose
            ctx.fillStyle = '#FF6B9D';
            ctx.beginPath();
            ctx.arc(0, s * 0.05, s * 0.05, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Whiskers
        ctx.strokeStyle = '#2C2C2C';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(-s * 0.4, 0);
        ctx.lineTo(-s * 0.55, -s * 0.05);
        ctx.moveTo(-s * 0.4, s * 0.05);
        ctx.lineTo(-s * 0.55, s * 0.05);
        ctx.moveTo(s * 0.4, 0);
        ctx.lineTo(s * 0.55, -s * 0.05);
        ctx.moveTo(s * 0.4, s * 0.05);
        ctx.lineTo(s * 0.55, s * 0.05);
        ctx.stroke();
        
        ctx.restore();
    }
}

// ===== Obstacle Class =====
class Obstacle {
    constructor(type) {
        this.type = type;
        this.size = 40 + Math.random() * 30;
        this.x = Math.random() * (width - this.size * 2) + this.size;
        this.y = height + 50;
        this.speed = 2 + Math.random();
        this.wobble = Math.random() * 10;
        this.angle = Math.random() * 360;
    }
    
    update() {
        this.y -= this.speed;
        this.x += Math.sin(frame * 0.02 + this.wobble) * 0.5;
        this.angle += 1;
    }
    
    draw() {
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle * Math.PI / 180);
        
        switch(this.type) {
            case 'asteroid':
                this.drawAsteroid();
                break;
            case 'satellite':
                this.drawSatellite();
                break;
            case 'meteor':
                this.drawMeteor();
                break;
            case 'debris':
                this.drawDebris();
                break;
            case 'cloud':
                this.drawCloud();
                break;
            case 'bird':
                this.drawBird();
                break;
            case 'balloon':
                this.drawBalloon();
                break;
            case 'building':
                this.drawBuilding();
                break;
            case 'ufo':
                this.drawUFO();
                break;
            case 'stalactite':
                this.drawStalactite();
                break;
            case 'crystal':
                this.drawCrystal();
                break;
            default:
                this.drawDefault();
        }
        
        ctx.restore();
    }
    
    drawAsteroid() {
        ctx.fillStyle = '#8B7355';
        ctx.strokeStyle = '#5C4A3A';
        ctx.lineWidth = 2;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const r = this.size / 2 + Math.sin(i * 2.3) * 8;
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
    
    drawSatellite() {
        ctx.fillStyle = '#C0C0C0';
        ctx.strokeStyle = '#707070';
        ctx.lineWidth = 2;
        ctx.fillRect(-this.size / 2, -this.size / 3, this.size, this.size / 1.5);
        ctx.strokeRect(-this.size / 2, -this.size / 3, this.size, this.size / 1.5);
        
        // Solar panels
        ctx.fillStyle = '#4A90E2';
        ctx.fillRect(-this.size * 0.8, -this.size / 6, this.size * 0.25, this.size / 3);
        ctx.fillRect(this.size * 0.55, -this.size / 6, this.size * 0.25, this.size / 3);
    }
    
    drawMeteor() {
        ctx.fillStyle = '#FF6B3D';
        ctx.shadowColor = '#FF6B3D';
        ctx.shadowBlur = 20;
        ctx.beginPath();
        ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
        
        // Tail
        const gradient = ctx.createLinearGradient(0, 0, this.size, this.size / 2);
        gradient.addColorStop(0, 'rgba(255,107,61,0.8)');
        gradient.addColorStop(1, 'rgba(255,107,61,0)');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, -this.size / 4, this.size * 1.5, this.size / 2);
    }
    
    drawDebris() {
        ctx.fillStyle = '#555';
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 2;
        ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
        ctx.strokeRect(-this.size / 2, -this.size / 2, this.size, this.size);
    }
    
    drawCloud() {
        ctx.fillStyle = 'rgba(255,255,255,0.9)';
        ctx.beginPath();
        ctx.arc(-this.size / 4, 0, this.size / 3, 0, Math.PI * 2);
        ctx.arc(this.size / 4, 0, this.size / 3, 0, Math.PI * 2);
        ctx.arc(0, -this.size / 4, this.size / 2.5, 0, Math.PI * 2);
        ctx.fill();
    }
    
    drawBird() {
        ctx.strokeStyle = '#2C2C2C';
        ctx.lineWidth = 3;
        ctx.lineCap = 'round';
        ctx.beginPath();
        ctx.moveTo(-this.size / 2, 0);
        ctx.quadraticCurveTo(-this.size / 4, -this.size / 3, 0, 0);
        ctx.quadraticCurveTo(this.size / 4, -this.size / 3, this.size / 2, 0);
        ctx.stroke();
    }
    
    drawBalloon() {
        ctx.fillStyle = '#FF6B9D';
        ctx.strokeStyle = '#C0506B';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, -this.size / 4, this.size / 2.5, this.size / 2, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // String
        ctx.strokeStyle = '#666';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, this.size / 4);
        ctx.lineTo(0, this.size / 2);
        ctx.stroke();
    }
    
    drawBuilding() {
        ctx.fillStyle = '#34495E';
        ctx.strokeStyle = '#2C3E50';
        ctx.lineWidth = 2;
        ctx.fillRect(-this.size / 2, -this.size / 1.5, this.size, this.size * 1.5);
        ctx.strokeRect(-this.size / 2, -this.size / 1.5, this.size, this.size * 1.5);
        
        // Windows
        ctx.fillStyle = '#F1C40F';
        for (let i = 0; i < 3; i++) {
            for (let j = 0; j < 2; j++) {
                ctx.fillRect(-this.size / 3 + j * this.size / 2, -this.size + i * this.size / 3, this.size / 6, this.size / 8);
            }
        }
    }
    
    drawUFO() {
        // Body
        ctx.fillStyle = '#9B59B6';
        ctx.strokeStyle = '#7D3C98';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.ellipse(0, 0, this.size / 2, this.size / 4, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        
        // Dome
        ctx.fillStyle = '#64FFDA';
        ctx.globalAlpha = 0.6;
        ctx.beginPath();
        ctx.arc(0, -this.size / 8, this.size / 3, 0, Math.PI, true);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
    
    drawStalactite() {
        ctx.fillStyle = '#5D6D7E';
        ctx.strokeStyle = '#34495E';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, -this.size / 2);
        ctx.lineTo(-this.size / 4, this.size / 2);
        ctx.lineTo(this.size / 4, this.size / 2);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    }
    
    drawCrystal() {
        ctx.fillStyle = '#3498DB';
        ctx.strokeStyle = '#2980B9';
        ctx.lineWidth = 2;
        ctx.shadowColor = '#3498DB';
        ctx.shadowBlur = 15;
        ctx.beginPath();
        ctx.moveTo(0, -this.size / 2);
        ctx.lineTo(-this.size / 3, 0);
        ctx.lineTo(0, this.size / 2);
        ctx.lineTo(this.size / 3, 0);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.shadowBlur = 0;
    }
    
    drawDefault() {
        ctx.fillStyle = '#E74C3C';
        ctx.beginPath();
        ctx.arc(0, 0, this.size / 2, 0, Math.PI * 2);
        ctx.fill();
    }
    
    collidesWith(cat) {
        const dx = this.x - cat.x;
        const dy = this.y - cat.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < (this.size / 2 + cat.size / 2) * 0.7;
    }
}

// ===== Item Class =====
class Item {
    constructor() {
        this.x = Math.random() * (width - 40) + 20;
        this.y = height + 30;
        this.size = 30;
        this.bobOffset = Math.random() * Math.PI * 2;
        this.speed = 1.5;
    }
    
    update() {
        this.y -= this.speed;
        this.bobOffset += 0.1;
    }
    
    draw() {
        const bobY = this.y + Math.sin(this.bobOffset) * 5;
        
        ctx.save();
        ctx.translate(this.x, bobY);
        
        // Glow
        ctx.shadowColor = '#FFD700';
        ctx.shadowBlur = 15;
        
        // Star
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
            const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2;
            const r = i % 2 === 0 ? this.size / 2 : this.size / 4;
            const x = Math.cos(angle) * r;
            const y = Math.sin(angle) * r;
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        ctx.closePath();
        ctx.fill();
        
        ctx.shadowBlur = 0;
        ctx.restore();
    }
    
    collidesWith(cat) {
        const dx = this.x - cat.x;
        const dy = this.y - cat.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        return distance < (this.size / 2 + cat.size / 2);
    }
}

// ===== Particle System =====
function spawnParticles(x, y, count, color, speed) {
    for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2;
        const velocity = Math.random() * speed;
        particles.push({
            x, y,
            vx: Math.cos(angle) * velocity,
            vy: Math.sin(angle) * velocity,
            life: 1,
            color,
            size: Math.random() * 4 + 2
        });
    }
}

// ===== Background System =====
function getCurrentStage() {
    for (let i = STAGES.length - 1; i >= 0; i--) {
        if (score >= STAGES[i].start) return i;
    }
    return 0;
}

function drawBackground() {
    const stage = STAGES[currentStage];
    const bg = stage.bg;
    
    // Gradient
    const gradient = ctx.createLinearGradient(0, 0, 0, height);
    gradient.addColorStop(0, bg.top);
    gradient.addColorStop(1, bg.bottom);
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
    
    // Stars
    if (bg.stars) {
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        const density = bg.starDensity || 50;
        for (let i = 0; i < density; i++) {
            const star = bgElements[i] || {
                x: Math.random() * width,
                y: Math.random() * height,
                size: Math.random() * 2,
                twinkle: Math.random() * Math.PI * 2
            };
            if (!bgElements[i]) bgElements[i] = star;
            
            star.twinkle += 0.05;
            const alpha = 0.5 + Math.sin(star.twinkle) * 0.5;
            ctx.globalAlpha = alpha;
            ctx.beginPath();
            ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
            ctx.fill();
        }
        ctx.globalAlpha = 1;
    }
    
    // Clouds
    if (bg.clouds) {
        ctx.fillStyle = 'rgba(255,255,255,0.3)';
        for (let i = 0; i < 5; i++) {
            const cloud = bgElements[100 + i] || {
                x: Math.random() * width,
                y: Math.random() * height,
                speed: Math.random() * 0.2 + 0.1
            };
            if (!bgElements[100 + i]) bgElements[100 + i] = cloud;
            
            cloud.x += cloud.speed;
            if (cloud.x > width + 100) cloud.x = -100;
            
            ctx.beginPath();
            ctx.arc(cloud.x, cloud.y, 30, 0, Math.PI * 2);
            ctx.arc(cloud.x + 25, cloud.y, 35, 0, Math.PI * 2);
            ctx.arc(cloud.x + 50, cloud.y, 30, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    
    // Fire particles (atmosphere entry)
    if (bg.particles === 'fire') {
        if (frame % 3 === 0) {
            spawnParticles(Math.random() * width, 0, 2, '#FF6B3D', 4);
        }
    }
}

// ===== Game Logic =====
function resetGame() {
    state = 'playing';
    frame = 0;
    score = 0;
    stars = 0;
    combo = 0;
    maxCombo = 0;
    comboTimer = 0;
    currentStage = 0;
    stageTransitioning = false;
    
    cat = new Cat();
    obstacles = [];
    items = [];
    particles = [];
    bgElements = [];
    
    // UI
    document.getElementById('startScreen').classList.add('hidden');
    document.getElementById('gameOverScreen').classList.add('hidden');
    document.getElementById('clearScreen').classList.add('hidden');
    document.getElementById('hud').classList.remove('hidden');
    document.getElementById('controls').classList.remove('hidden');
    
    updateUI();
}

function update() {
    if (state !== 'playing') return;
    
    frame++;
    
    // Update cat
    cat.update();
    
    // Stage transitions
    const newStage = getCurrentStage();
    if (newStage !== currentStage) {
        currentStage = newStage;
        showStageName(STAGES[currentStage].name);
        bgElements = []; // Reset background elements
    }
    
    // Spawn obstacles
    const stage = STAGES[currentStage];
    const spawnInterval = Math.max(
        CONFIG.OBSTACLE_MIN_INTERVAL,
        CONFIG.OBSTACLE_BASE_INTERVAL - score * 0.3
    );
    
    if (frame % Math.floor(spawnInterval / 16) === 0) {
        const types = stage.obstacles;
        const type = types[Math.floor(Math.random() * types.length)];
        obstacles.push(new Obstacle(type));
    }
    
    // Spawn items
    if (frame % Math.floor(CONFIG.ITEM_INTERVAL / 16) === 0) {
        items.push(new Item());
    }
    
    // Update obstacles
    obstacles = obstacles.filter(obs => {
        obs.update();
        
        if (obs.y < -100) return false;
        
        if (obs.collidesWith(cat)) {
            gameOver();
            return true;
        }
        
        return true;
    });
    
    // Update items
    items = items.filter(item => {
        item.update();
        
        if (item.y < -50) return false;
        
        if (item.collidesWith(cat)) {
            stars++;
            combo++;
            maxCombo = Math.max(maxCombo, combo);
            comboTimer = CONFIG.COMBO_TIMEOUT;
            score += CONFIG.COMBO_BONUS * combo;
            
            playSound('star');
            if (combo > 1) playSound('combo');
            
            spawnParticles(item.x, item.y, 12, '#FFD700', 5);
            cat.expression = 'happy';
            setTimeout(() => cat.expression = 'normal', 300);
            
            return false;
        }
        
        return true;
    });
    
    // Combo timer
    if (comboTimer > 0) {
        comboTimer--;
        if (comboTimer === 0) {
            combo = 0;
        }
    }
    
    // Update particles
    particles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.life -= 0.02;
        p.vy += 0.1; // Gravity
        return p.life > 0;
    });
    
    updateUI();
}

function draw() {
    // Background
    drawBackground();
    
    // Particles (behind)
    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
    
    // Items
    items.forEach(item => item.draw());
    
    // Obstacles
    obstacles.forEach(obs => obs.draw());
    
    // Cat
    if (cat) cat.draw();
}

function gameLoop() {
    update();
    draw();
    
    if (state === 'playing') {
        requestAnimationFrame(gameLoop);
    }
}

function updateUI() {
    document.getElementById('depth').textContent = Math.floor(score);
    document.getElementById('starCount').textContent = stars;
    
    // Progress bar
    const progress = Math.min(100, (score / CONFIG.GOAL_DEPTH) * 100);
    document.getElementById('progressBar').style.width = progress + '%';
    
    // Combo display
    if (combo > 1) {
        document.getElementById('comboDisplay').style.display = 'flex';
        document.getElementById('comboCount').textContent = combo;
    } else {
        document.getElementById('comboDisplay').style.display = 'none';
    }
}

function showStageName(name) {
    const elem = document.getElementById('stageName');
    elem.textContent = name;
    elem.classList.remove('hidden');
    setTimeout(() => elem.classList.add('hidden'), 2000);
}

function gameOver() {
    if (state !== 'playing') return;
    
    state = 'gameover';
    playSound('hit');
    cat.expression = 'scared';
    
    spawnParticles(cat.x, cat.y, 30, '#FF6B6B', 8);
    
    // Save best score
    if (score > bestScore) {
        bestScore = Math.floor(score);
        localStorage.setItem('cosmicCatBest', bestScore);
        document.getElementById('newRecord').classList.remove('hidden');
    } else {
        document.getElementById('newRecord').classList.add('hidden');
    }
    
    document.getElementById('finalDepth').textContent = Math.floor(score);
    document.getElementById('finalStars').textContent = stars;
    
    setTimeout(() => {
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('controls').classList.add('hidden');
        document.getElementById('gameOverScreen').classList.remove('hidden');
    }, 500);
}

function gameClear() {
    if (state !== 'playing') return;
    
    state = 'clear';
    playSound('clear');
    cat.expression = 'happy';
    
    spawnParticles(cat.x, cat.y, 50, '#FFD700', 10);
    
    if (score > bestScore) {
        bestScore = Math.floor(score);
        localStorage.setItem('cosmicCatBest', bestScore);
    }
    
    document.getElementById('clearDepth').textContent = Math.floor(score);
    document.getElementById('clearStars').textContent = stars;
    document.getElementById('clearMaxCombo').textContent = maxCombo;
    
    setTimeout(() => {
        document.getElementById('hud').classList.add('hidden');
        document.getElementById('controls').classList.add('hidden');
        document.getElementById('clearScreen').classList.remove('hidden');
    }, 1000);
}

// ===== Input Handling =====
function setupButton(btnId, key) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    
    const press = () => {
        input[key] = true;
        btn.classList.add('active');
        if (key === 'float') playSound('float');
    };
    
    const release = () => {
        input[key] = false;
        btn.classList.remove('active');
    };
    
    btn.addEventListener('pointerdown', press);
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointerleave', release);
    btn.addEventListener('pointercancel', release);
}

setupButton('btnLeft', 'left');
setupButton('btnRight', 'right');
setupButton('btnFloat', 'float');

// Keyboard
window.addEventListener('keydown', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a') input.left = true;
    if (e.key === 'ArrowRight' || e.key === 'd') input.right = true;
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') {
        if (!input.float) playSound('float');
        input.float = true;
    }
});

window.addEventListener('keyup', e => {
    if (e.key === 'ArrowLeft' || e.key === 'a') input.left = false;
    if (e.key === 'ArrowRight' || e.key === 'd') input.right = false;
    if (e.key === ' ' || e.key === 'ArrowUp' || e.key === 'w') input.float = false;
});

// ===== Button Events =====
document.getElementById('startBtn').addEventListener('click', () => {
    initAudio();
    resetGame();
    requestAnimationFrame(gameLoop);
});

document.getElementById('retryBtn').addEventListener('click', () => {
    resetGame();
    requestAnimationFrame(gameLoop);
});

document.getElementById('clearRetryBtn').addEventListener('click', () => {
    resetGame();
    requestAnimationFrame(gameLoop);
});

// ===== Initialize =====
document.getElementById('bestScore').textContent = bestScore + 'm';

// Start initial animation
function startScreenLoop() {
    if (state === 'start') {
        ctx.fillStyle = '#000';
        ctx.fillRect(0, 0, width, height);
        
        // Animated stars
        ctx.fillStyle = 'rgba(255,255,255,0.8)';
        for (let i = 0; i < 50; i++) {
            const x = (Math.random() * width + frame * 0.5) % width;
            const y = Math.random() * height;
            ctx.beginPath();
            ctx.arc(x, y, Math.random() * 2, 0, Math.PI * 2);
            ctx.fill();
        }
        
        frame++;
        requestAnimationFrame(startScreenLoop);
    }
}

startScreenLoop();
