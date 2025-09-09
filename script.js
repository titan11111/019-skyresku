// HTML要素の取得
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const distanceDisplay = document.getElementById('distance');
const highDistanceDisplay = document.getElementById('highDistance');
const gameOverOverlay = document.getElementById('gameOverOverlay');
const finalDistanceDisplay = document.getElementById('finalDistance');
const newRecordDisplay = document.getElementById('newRecord');
const restartButton = document.getElementById('restartButton');
const startButton = document.getElementById('startButton');
const startScreen = document.getElementById('startScreen');
const leftButton = document.getElementById('leftButton');
const rightButton = document.getElementById('rightButton');
const upButton = document.getElementById('upButton');

// パワーアップ表示要素
const featherTimeDisplay = document.getElementById('featherTime');
const shieldTimeDisplay = document.getElementById('shieldTime');
const starCountDisplay = document.getElementById('starCount');

// ゲームの状態変数
let player;
let obstacles = [];
let items = [];
let particles = [];
let distance = 0;
let highDistance = localStorage.getItem('highDistance') || 0;
let gameOver = false;
let gameStarted = false;
let gameLoopId;

// ゲーム設定
const GAME_WIDTH = 300;
const GAME_HEIGHT = 400;
// プレイヤーサイズを1.5倍に拡大
const PLAYER_SIZE = 37.5;
const PLAYER_SPEED = 4;
let GRAVITY = 0.008;
const OBSTACLE_HEIGHT = 15;
let OBSTACLE_SPEED = 0.2;
let OBSTACLE_SPAWN_INTERVAL = 1200;
const ITEM_SIZE = 26; // アイテムサイズを130%に拡大
const ITEM_SPEED = 0.15;
let ITEM_SPAWN_INTERVAL = 4000; // アイテム出現間隔を倍にして量を半減
const MIN_OBSTACLE_GAP = 80;


let lastObstacleSpawnTime = 0;
let lastItemSpawnTime = 0;
let lastDifficultyDistance = -1;
let lastFeatherDistance = 0;

// パワーアップ効果
let featherTime = 0;
let shieldTime = 0;
let shieldHits = 0; // シールドで耐えられる回数
let starCount = 0;

const starPositions = Array.from({ length: 50 }, () => ({
    x: Math.random() * GAME_WIDTH,
    y: Math.random() * GAME_HEIGHT
}));

// 効果音（Web Audio API使用）
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playSound(frequency, duration, type = 'sine') {
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = type;
    
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + duration);
    
    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + duration);
}

// 効果音関数
function playJumpSound() { playSound(440, 0.1); }
function playItemSound() { playSound(660, 0.2); }
function playPowerUpSound() { playSound(880, 0.3); }
function playGameOverSound() { playSound(220, 0.5, 'sawtooth'); }
function playHitSound() { playSound(150, 0.2, 'square'); }

// キャンバスのリサイズと初期化
function resizeCanvas() {
    const containerWidth = canvas.parentElement.clientWidth;
    const containerHeight = canvas.parentElement.clientHeight;

    let newWidth = Math.min(containerWidth, GAME_WIDTH);
    let newHeight = newWidth * (GAME_HEIGHT / GAME_WIDTH);

    if (newHeight > containerHeight) {
        newHeight = containerHeight;
        newWidth = newHeight * (GAME_WIDTH / GAME_HEIGHT);
    }

    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;
    canvas.style.width = `${newWidth}px`;
    canvas.style.height = `${newHeight}px`;
}

// プレイヤークラス
function Player() {
    this.x = GAME_WIDTH / 2 - PLAYER_SIZE / 2;
    this.y = 50;
    this.width = PLAYER_SIZE;
    this.height = PLAYER_SIZE;
    this.velocityY = 0;
    this.isMovingLeft = false;
    this.isMovingRight = false;
    this.expression = 'normal';
    this.hasShield = false;
    this.shieldFlashTime = 0;

    this.draw = function() {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;
        const size = this.width;

        // シールド効果
        if (this.hasShield) {
            ctx.strokeStyle = `rgba(0, 255, 255, ${0.5 + Math.sin(this.shieldFlashTime * 0.3) * 0.3})`;
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(centerX, centerY, size * 0.7, 0, 2 * Math.PI);
            ctx.stroke();
            this.shieldFlashTime++;
        }

        // 体（黄色の楕円）
        ctx.fillStyle = featherTime > 0 ? '#FFFF00' : '#FFD700';
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, size * 0.4, size * 0.35, 0, 0, 2 * Math.PI);
        ctx.fill();

        // 耳
        ctx.fillStyle = featherTime > 0 ? '#FFFF00' : '#FFD700';
        ctx.beginPath();
        ctx.moveTo(centerX - size * 0.25, centerY - size * 0.3);
        ctx.lineTo(centerX - size * 0.15, centerY - size * 0.45);
        ctx.lineTo(centerX - size * 0.05, centerY - size * 0.3);
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(centerX + size * 0.05, centerY - size * 0.3);
        ctx.lineTo(centerX + size * 0.15, centerY - size * 0.45);
        ctx.lineTo(centerX + size * 0.25, centerY - size * 0.3);
        ctx.fill();

        // 耳の先端
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(centerX - size * 0.15, centerY - size * 0.42, size * 0.05, size * 0.08, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(centerX + size * 0.15, centerY - size * 0.42, size * 0.05, size * 0.08, 0, 0, 2 * Math.PI);
        ctx.fill();

        // 目
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(centerX - size * 0.12, centerY - size * 0.1, size * 0.06, size * 0.08, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(centerX + size * 0.12, centerY - size * 0.1, size * 0.06, size * 0.08, 0, 0, 2 * Math.PI);
        ctx.fill();

        // 目のハイライト
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.ellipse(centerX - size * 0.1, centerY - size * 0.12, size * 0.02, size * 0.03, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(centerX + size * 0.14, centerY - size * 0.12, size * 0.02, size * 0.03, 0, 0, 2 * Math.PI);
        ctx.fill();

        // 鼻
        ctx.fillStyle = '#000000';
        ctx.beginPath();
        ctx.ellipse(centerX, centerY, size * 0.02, size * 0.02, 0, 0, 2 * Math.PI);
        ctx.fill();

        // 口
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        if (this.expression === 'happy') {
            ctx.arc(centerX, centerY + size * 0.05, size * 0.1, 0, Math.PI);
        } else if (this.expression === 'worried') {
            ctx.arc(centerX, centerY + size * 0.15, size * 0.1, Math.PI, 2 * Math.PI);
        } else if (this.expression === 'excited') {
            ctx.arc(centerX, centerY + size * 0.05, size * 0.15, 0, Math.PI);
        } else if (this.expression === 'surprised') {
            ctx.arc(centerX, centerY + size * 0.1, size * 0.1, 0, 2 * Math.PI);
        } else {
            ctx.moveTo(centerX - size * 0.08, centerY + size * 0.1);
            ctx.lineTo(centerX + size * 0.08, centerY + size * 0.1);
        }
        ctx.stroke();

        // ほっぺ
        ctx.fillStyle = '#FF6B6B';
        ctx.beginPath();
        ctx.ellipse(centerX - size * 0.25, centerY + size * 0.05, size * 0.05, size * 0.04, 0, 0, 2 * Math.PI);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(centerX + size * 0.25, centerY + size * 0.05, size * 0.05, size * 0.04, 0, 0, 2 * Math.PI);
        ctx.fill();
    };

    this.update = function() {
        this.velocityY += GRAVITY;
        this.y += this.velocityY;

        const currentSpeed = PLAYER_SPEED;
        
        if (this.isMovingLeft) {
            this.x -= currentSpeed;
        }
        if (this.isMovingRight) {
            this.x += currentSpeed;
        }

        if (this.x < 0) this.x = 0;
        if (this.x + this.width > GAME_WIDTH) this.x = GAME_WIDTH - this.width;

        if (featherTime > 0) {
            this.expression = 'excited';
        } else if (this.velocityY > 2) {
            this.expression = 'surprised';
        } else if (this.velocityY > 1.5) {
            this.expression = 'worried';
        } else if (this.velocityY < 0.5) {
            this.expression = 'happy';
        } else {
            this.expression = 'normal';
        }

        this.hasShield = shieldTime > 0;

        if (this.y + this.height > GAME_HEIGHT) {
            this.y = GAME_HEIGHT - this.height;
            endGame();
        }
    };
}

// 障害物クラス
function Obstacle(x, y, width, height, type = 'pillar') {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.type = type;
    this.vx = 0;
    this.minX = 0;
    this.maxX = GAME_WIDTH - width;
    this.bobOffset = Math.random() * Math.PI * 2;

    if (this.type === 'pillar') {
        const colorSets = [
            ['#e74c3c', '#c0392b'],
            ['#3498db', '#2980b9'],
            ['#2ecc71', '#27ae60'],
            ['#9b59b6', '#8e44ad'],
            ['#f1c40f', '#f39c12']
        ];
        this.colors = colorSets[Math.floor(Math.random() * colorSets.length)];
    }

    this.draw = function() {
        if (this.type === 'pillar') {
            const gradient = ctx.createLinearGradient(this.x, this.y, this.x, this.y + this.height);
            const [c1, c2] = this.colors;
            gradient.addColorStop(0, c1);
            gradient.addColorStop(1, c2);

            ctx.fillStyle = gradient;
            ctx.fillRect(this.x, this.y, this.width, this.height);

            ctx.strokeStyle = c2;
            ctx.lineWidth = 2;
            ctx.strokeRect(this.x, this.y, this.width, this.height);
        } else if (this.type === 'cloud') {
            ctx.fillStyle = '#FFFFFF';
            ctx.beginPath();
            const cx = this.x + this.width / 2;
            const cy = this.y + this.height / 2;
            ctx.arc(cx - this.width * 0.2, cy, this.width * 0.3, Math.PI * 0.5, Math.PI * 1.5);
            ctx.arc(cx, cy - this.height * 0.2, this.width * 0.35, Math.PI, 0);
            ctx.arc(cx + this.width * 0.2, cy, this.width * 0.3, Math.PI * 1.5, Math.PI * 0.5);
            ctx.closePath();
            ctx.fill();
        } else if (this.type === 'crow') {
            ctx.fillStyle = '#000000';
            ctx.beginPath();
            ctx.moveTo(this.x, this.y + this.height * 0.5);
            ctx.lineTo(this.x + this.width * 0.5, this.y);
            ctx.lineTo(this.x + this.width, this.y + this.height * 0.5);
            ctx.lineTo(this.x + this.width * 0.5, this.y + this.height);
            ctx.closePath();
            ctx.fill();
        } else if (this.type === 'helicopter') {
            ctx.fillStyle = '#666666';
            ctx.fillRect(this.x + this.width * 0.2, this.y + this.height * 0.4, this.width * 0.6, this.height * 0.3);
            ctx.fillRect(this.x + this.width * 0.8, this.y + this.height * 0.45, this.width * 0.2, this.height * 0.1);
            ctx.fillRect(this.x, this.y + this.height * 0.3, this.width, this.height * 0.05);
        } else if (this.type === 'ufo') {
            ctx.fillStyle = '#AAAAAA';
            ctx.beginPath();
            ctx.ellipse(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, this.height / 4, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#77FF77';
            ctx.beginPath();
            ctx.arc(this.x + this.width / 2, this.y + this.height * 0.4, this.width * 0.2, 0, Math.PI * 2);
            ctx.fill();
        } else if (this.type === 'balloon') {
            ctx.fillStyle = '#FF69B4';
            ctx.beginPath();
            ctx.ellipse(this.x + this.width / 2, this.y + this.height / 2, this.width / 2, this.height / 2, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#FF69B4';
            ctx.beginPath();
            ctx.moveTo(this.x + this.width / 2, this.y + this.height);
            ctx.lineTo(this.x + this.width / 2, this.y + this.height + this.height * 0.4);
            ctx.stroke();
        }
    };

    this.update = function() {
        this.y -= OBSTACLE_SPEED;
        if (this.type !== 'pillar') {
            this.x += this.vx;
            if (this.x < this.minX || this.x + this.width > this.maxX) {
                this.vx *= -1;
                this.x += this.vx;
            }
            if (this.type === 'ufo' || this.type === 'balloon') {
                const freq = this.type === 'balloon' ? 300 : 200;
                const amp = this.type === 'balloon' ? 0.3 : 0.5;
                this.y += Math.sin((Date.now() / freq) + this.bobOffset) * amp;
            }
        }
    };
}

// アイテムクラス
function Item(x, y, type) {
    this.x = x;
    this.y = y;
    this.width = ITEM_SIZE;
    this.height = ITEM_SIZE;
    this.type = type; // 'feather', 'shield', 'star'
    this.bobOffset = Math.random() * Math.PI * 2;
    this.time = 0;

    this.draw = function() {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2 + Math.sin(this.time * 0.1 + this.bobOffset) * 3;
        const size = this.width;

        if (this.type === 'feather') {
            // 羽（虹色で点滅させて派手に）
            const hue = (this.time * 5) % 360;
            ctx.fillStyle = `hsl(${hue},100%,70%)`;
            ctx.strokeStyle = `hsl(${hue},100%,50%)`;
            ctx.lineWidth = 2;
            ctx.shadowColor = `hsl(${hue},100%,50%)`;
            ctx.shadowBlur = 10;
            ctx.beginPath();
            ctx.ellipse(centerX, centerY, size * 0.2, size * 0.4, 0, 0, 2 * Math.PI);
            ctx.fill();
            ctx.beginPath();
            ctx.moveTo(centerX, centerY - size * 0.4);
            ctx.lineTo(centerX, centerY + size * 0.4);
            ctx.stroke();
            ctx.shadowBlur = 0;
        } else if (this.type === 'shield') {
            // シールド
            ctx.fillStyle = '#00FFFF';
            ctx.strokeStyle = '#0080FF';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, size * 0.3, 0, 2 * Math.PI);
            ctx.fill();
            ctx.stroke();
            
            ctx.fillStyle = '#FFFFFF';
            ctx.font = `${size * 0.4}px Arial`;
            ctx.textAlign = 'center';
            ctx.fillText('🛡️', centerX, centerY + size * 0.1);
        } else if (this.type === 'star') {
            // スター
            ctx.fillStyle = '#FFD700';
            ctx.strokeStyle = '#FFA500';
            ctx.lineWidth = 2;
            this.drawStar(centerX, centerY, size * 0.3, size * 0.15, 5);
        }
    };

    this.drawStar = function(x, y, outerRadius, innerRadius, points) {
        ctx.beginPath();
        for (let i = 0; i < points * 2; i++) {
            const radius = i % 2 === 0 ? outerRadius : innerRadius;
            const angle = (i * Math.PI) / points;
            const pointX = x + Math.cos(angle) * radius;
            const pointY = y + Math.sin(angle) * radius;
            if (i === 0) ctx.moveTo(pointX, pointY);
            else ctx.lineTo(pointX, pointY);
        }
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
    };

    this.update = function() {
        this.y -= ITEM_SPEED;
        this.time++;
    };
}

// パーティクルクラス
function Particle(x, y, color, size) {
    this.x = x;
    this.y = y;
    this.vx = (Math.random() - 0.5) * 4;
    this.vy = (Math.random() - 0.5) * 4;
    this.color = color;
    this.size = size;
    this.life = 30;
    this.maxLife = 30;

    this.update = function() {
        this.x += this.vx;
        this.y += this.vy;
        this.vy += 0.1; // 重力
        this.life--;
    };

    this.draw = function() {
        const alpha = this.life / this.maxLife;
        ctx.fillStyle = this.color.replace('1)', `${alpha})`);
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, 2 * Math.PI);
        ctx.fill();
    };
}

// パーティクル生成
function createParticles(x, y, color, count = 5) {
    for (let i = 0; i < count; i++) {
        particles.push(new Particle(x, y, color, Math.random() * 3 + 1));
    }
}

// ゲーム初期化
function initGame() {
    GRAVITY = 0.008;
    OBSTACLE_SPEED = 0.2;
    OBSTACLE_SPAWN_INTERVAL = 1200;
    lastDifficultyDistance = -1;

    player = new Player();
    obstacles = [];
    items = [];
    particles = [];
    distance = 0;
    gameOver = false;

    featherTime = 0;
    shieldTime = 0;
    shieldHits = 0;
    starCount = 0;
    lastFeatherDistance = 0;

    updateDisplays();

    gameOverOverlay.style.display = 'none';
    startScreen.style.display = 'none';

    if (gameLoopId) {
        cancelAnimationFrame(gameLoopId);
    }
    gameLoopId = requestAnimationFrame(gameLoop);
}

// 表示更新
function updateDisplays() {
    distanceDisplay.textContent = Math.floor(distance);
    highDistanceDisplay.textContent = highDistance;
    featherTimeDisplay.textContent = Math.ceil(featherTime / 60);
    shieldTimeDisplay.textContent = Math.ceil(shieldTime / 60);
    starCountDisplay.textContent = starCount;
}

// アイテム生成
function spawnItem() {
    const types = ['shield', 'star'];
    const type = types[Math.floor(Math.random() * types.length)];
    const x = Math.random() * (GAME_WIDTH - ITEM_SIZE);
    const y = GAME_HEIGHT;
    items.push(new Item(x, y, type));
}

function spawnFeather() {
    const x = Math.random() * (GAME_WIDTH - ITEM_SIZE);
    const y = GAME_HEIGHT;
    items.push(new Item(x, y, 'feather'));
}

function canSpawnObstacle() {
    if (obstacles.length === 0) return true;
    const maxY = Math.max(...obstacles.map(o => o.y + o.height));
    return maxY < GAME_HEIGHT - MIN_OBSTACLE_GAP;
}

// 当たり判定
function checkCollision(a, b) {
    // 柔軟な当たり判定: 柱は矩形判定、それ以外は円判定を使用
    if (b.type === 'pillar') {
        const margin = 2; // 見た目より少し小さくして誤判定を減らす
        return (
            a.x + margin < b.x + b.width &&
            a.x + a.width - margin > b.x &&
            a.y + margin < b.y + b.height &&
            a.y + a.height - margin > b.y
        );
    } else {
        const ax = a.x + a.width / 2;
        const ay = a.y + a.height / 2;
        const bx = b.x + b.width / 2;
        const by = b.y + b.height / 2;
        const ar = Math.min(a.width, a.height) * 0.4;
        const br = Math.min(b.width, b.height) * 0.4;
        const dx = ax - bx;
        const dy = ay - by;
        return dx * dx + dy * dy < (ar + br) * (ar + br);
    }
}

// ゲームオーバー処理
function endGame() {
    if (gameOver) return;
    gameOver = true;
    cancelAnimationFrame(gameLoopId);
    playGameOverSound();
    finalDistanceDisplay.textContent = Math.floor(distance);
    if (distance > highDistance) {
        highDistance = distance;
        localStorage.setItem('highDistance', highDistance);
        newRecordDisplay.style.display = 'block';
    } else {
        newRecordDisplay.style.display = 'none';
    }
    gameOverOverlay.style.display = 'flex';
}

function drawCloud(x, y) {
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath();
    ctx.arc(x, y, 15, 0, Math.PI * 2);
    ctx.arc(x + 20, y, 20, 0, Math.PI * 2);
    ctx.arc(x + 40, y, 15, 0, Math.PI * 2);
    ctx.fill();
}

function drawBackground() {
    let gradient;
    if (distance < 500) {
        gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
        gradient.addColorStop(0, '#87CEEB');
        gradient.addColorStop(1, '#98D8EA');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(GAME_WIDTH - 40, 40, 20, 0, Math.PI * 2);
        ctx.fill();
        drawCloud(40, 60);
        drawCloud(120, 80);
    } else if (distance < 1000) {
        gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
        gradient.addColorStop(0, '#FF7E5F');
        gradient.addColorStop(1, '#FEB47B');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.fillStyle = '#FFD700';
        ctx.beginPath();
        ctx.arc(GAME_WIDTH / 2, GAME_HEIGHT - 30, 30, 0, Math.PI * 2);
        ctx.fill();
    } else if (distance < 1500) {
        gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
        gradient.addColorStop(0, '#001848');
        gradient.addColorStop(1, '#000000');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.fillStyle = '#F0E68C';
        ctx.beginPath();
        ctx.arc(GAME_WIDTH - 50, 50, 25, 0, Math.PI * 2);
        ctx.fill();
        starPositions.forEach(s => {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(s.x, s.y, 2, 2);
        });
    } else if (distance < 2000) {
        gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
        gradient.addColorStop(0, '#2c3e50');
        gradient.addColorStop(1, '#000000');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.fillStyle = '#1a1a1a';
        for (let i = 0; i < GAME_WIDTH; i += 30) {
            const h = 50 + (i % 60);
            ctx.fillRect(i, GAME_HEIGHT - h, 20, h);
        }
    } else if (distance < 2500) {
        gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
        gradient.addColorStop(0, '#2E8B57');
        gradient.addColorStop(1, '#006400');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        ctx.fillStyle = '#2F4F4F';
        ctx.beginPath();
        ctx.moveTo(0, GAME_HEIGHT);
        ctx.lineTo(80, GAME_HEIGHT - 80);
        ctx.lineTo(160, GAME_HEIGHT);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(120, GAME_HEIGHT);
        ctx.lineTo(220, GAME_HEIGHT - 100);
        ctx.lineTo(300, GAME_HEIGHT);
        ctx.closePath();
        ctx.fill();
    } else if (distance < 3000) {
        gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
        gradient.addColorStop(0, '#8B0000');
        gradient.addColorStop(1, '#FF4500');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    } else {
        gradient = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
        gradient.addColorStop(0, '#FFFFFF');
        gradient.addColorStop(1, '#E0FFFF');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
        drawCloud(50, 60);
        drawCloud(200, 80);
    }
}

// ゲームループ
function gameLoop(timestamp) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();

    const now = Date.now();

    if (distance - lastDifficultyDistance >= 30) {
        GRAVITY += 0.001;
        OBSTACLE_SPEED += 0.02;
        if (OBSTACLE_SPAWN_INTERVAL > 500) OBSTACLE_SPAWN_INTERVAL -= 50;
        lastDifficultyDistance = distance;
    }

    const fallMultiplier = featherTime > 0 ? 0.7 : 1;
    GRAVITY = OBSTACLE_SPEED * 0.04 * fallMultiplier;

    player.update();
    player.draw();

    obstacles.forEach(o => o.update());
    obstacles = obstacles.filter(o => o.y + o.height > 0);
    obstacles.forEach(o => o.draw());

    items.forEach(i => i.update());
    items = items.filter(i => i.y + i.height > 0);
    items.forEach(i => i.draw());

    particles.forEach(p => p.update());
    particles = particles.filter(p => p.life > 0);
    particles.forEach(p => p.draw());

    for (let i = 0; i < obstacles.length; i++) {
        const o = obstacles[i];
        if (checkCollision(player, o)) {
            if (shieldTime > 0) {
                playHitSound();
                createParticles(o.x + o.width / 2, o.y + o.height / 2, 'rgba(0,255,255,1)', 8);
                obstacles.splice(i, 1); // バリアで敵を倒す
                shieldHits--;
                if (shieldHits <= 0) {
                    shieldTime = 0;
                }
                i--;
                continue;
            } else {
                endGame();
                return;
            }
        }
    }

    for (let i = 0; i < items.length; i++) {
        if (checkCollision(player, items[i])) {
            const item = items.splice(i, 1)[0];
            playItemSound();
            if (item.type === 'feather') {
                featherTime = 300;
                player.velocityY *= 0.7;
                createParticles(item.x, item.y, 'rgba(173,216,230,1)', 12); // 羽＝淡い青
            } else if (item.type === 'shield') {
                shieldTime = 1200;
                shieldHits = 5;
                createParticles(item.x, item.y, 'rgba(0,255,255,1)', 12);
            } else if (item.type === 'star') {
                starCount++;
                distance += 5;
                createParticles(item.x, item.y, 'rgba(255,215,0,1)', 12);
            }
            break;
        }
    }

    if (featherTime > 0) featherTime--;
    if (shieldTime > 0) shieldTime--;

    distance++;
    updateDisplays();

    if (distance % 1000 === 0 && distance !== 0 && distance !== lastFeatherDistance) {
        spawnFeather();
        lastFeatherDistance = distance;
    }

    if (now - lastObstacleSpawnTime > OBSTACLE_SPAWN_INTERVAL && canSpawnObstacle()) {
        spawnObstacle();
        lastObstacleSpawnTime = now;
    }

    if (now - lastItemSpawnTime > ITEM_SPAWN_INTERVAL) {
        spawnItem();
        lastItemSpawnTime = now;
    }

    gameLoopId = requestAnimationFrame(gameLoop);
}

function spawnObstacle() {
    const difficulty = Math.floor(distance / 100);

    const baseGapWidth = GAME_WIDTH * 0.8;
    const gapWidth = Math.max(baseGapWidth - difficulty * 15, PLAYER_SIZE * 2);
    const gapX = Math.random() * (GAME_WIDTH - gapWidth);

    const safeLaneWidth = PLAYER_SIZE * 1.5;
    const safeLaneX = gapX + Math.random() * (gapWidth - safeLaneWidth);

    if (gapX > 0) {
        obstacles.push(new Obstacle(0, GAME_HEIGHT, gapX, OBSTACLE_HEIGHT, 'pillar'));
    }
    if (gapX + gapWidth < GAME_WIDTH) {
        obstacles.push(new Obstacle(
            gapX + gapWidth,
            GAME_HEIGHT,
            GAME_WIDTH - (gapX + gapWidth),
            OBSTACLE_HEIGHT,
            'pillar'
        ));
    }

    const dynamicTypes = ['cloud', 'crow', 'helicopter', 'ufo', 'balloon'];
    const enemyCount = Math.max(0, difficulty - 1);
    for (let i = 0; i < enemyCount; i++) {
        const type = dynamicTypes[Math.floor(Math.random() * dynamicTypes.length)];
        const size = type === 'cloud' ? 40 : type === 'balloon' ? 35 : 30;
        const blockWidth = size;
        const blockHeight = size;
        const side = Math.random() < 0.5 ? 'left' : 'right';
        let minX, maxX;
        if (side === 'left') {
            minX = gapX;
            maxX = safeLaneX - blockWidth;
        } else {
            minX = safeLaneX + safeLaneWidth;
            maxX = gapX + gapWidth - blockWidth;
        }
        if (maxX <= minX) continue;
        const blockX = Math.random() * (maxX - minX) + minX;
        const blockY = GAME_HEIGHT + i * (OBSTACLE_HEIGHT + 5);
        const obstacle = new Obstacle(blockX, blockY, blockWidth, blockHeight, type);
        obstacle.minX = minX;
        obstacle.maxX = maxX;
        obstacle.vx = (Math.random() * 0.6 + 0.2) * (Math.random() < 0.5 ? -1 : 1);
        obstacles.push(obstacle);
    }
}

startButton.addEventListener('click', () => {
    gameStarted = true;
    resizeCanvas();
    initGame();
});

restartButton.addEventListener('click', () => {
    initGame();
});

function handleLeftStart(e) {
    e.preventDefault();
    player.isMovingLeft = true;
}
function handleLeftEnd(e) {
    e.preventDefault();
    player.isMovingLeft = false;
}
leftButton.addEventListener('touchstart', handleLeftStart);
leftButton.addEventListener('mousedown', handleLeftStart);
leftButton.addEventListener('touchend', handleLeftEnd);
leftButton.addEventListener('mouseup', handleLeftEnd);
leftButton.addEventListener('mouseleave', handleLeftEnd);

function handleRightStart(e) {
    e.preventDefault();
    player.isMovingRight = true;
}
function handleRightEnd(e) {
    e.preventDefault();
    player.isMovingRight = false;
}
rightButton.addEventListener('touchstart', handleRightStart);
rightButton.addEventListener('mousedown', handleRightStart);
rightButton.addEventListener('touchend', handleRightEnd);
rightButton.addEventListener('mouseup', handleRightEnd);
rightButton.addEventListener('mouseleave', handleRightEnd);

let upInterval;
function startJump(e) {
    e.preventDefault();
    upInterval = setInterval(() => {
        player.velocityY -= 0.5;
    }, 100);
}
function endJump(e) {
    e.preventDefault();
    clearInterval(upInterval);
}
upButton.addEventListener('touchstart', startJump);
upButton.addEventListener('mousedown', startJump);
upButton.addEventListener('touchend', endJump);
upButton.addEventListener('mouseup', endJump);
upButton.addEventListener('mouseleave', endJump);

window.addEventListener('keydown', (e) => {
    const key = e.key;
    if (['ArrowLeft', 'Left', '←'].includes(key)) {
        e.preventDefault();
        player.isMovingLeft = true;
    }
    if (['ArrowRight', 'Right', '→'].includes(key)) {
        e.preventDefault();
        player.isMovingRight = true;
    }
    if (['ArrowUp', 'Up', '↑'].includes(key)) {
        e.preventDefault();
        player.velocityY -= 0.5;
    }
});

window.addEventListener('keyup', (e) => {
    const key = e.key;
    if (['ArrowLeft', 'Left', '←'].includes(key)) player.isMovingLeft = false;
    if (['ArrowRight', 'Right', '→'].includes(key)) player.isMovingRight = false;
});
