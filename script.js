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

// コントロールボタン
const leftButton = document.getElementById('leftButton');
const rightButton = document.getElementById('rightButton');
const upButton = document.getElementById('upButton');
const downButton = document.getElementById('downButton');

// 風インジケーター（HTMLに追加済み）
const windIndicator = document.getElementById('windIndicator');
const windDirectionSpan = document.getElementById('windDirection');

// パワーアップ表示要素
const featherTimeDisplay = document.getElementById('featherTime');
const shieldTimeDisplay = document.getElementById('shieldTime');
const starCountDisplay = document.getElementById('starCount');

// --- 画像アセット管理 ---
// 画像ファイルはindex.htmlと同じフォルダに置いてください
const images = {};
// 実際に存在する画像ファイル名を使用
const imageAssets = {
    player: 'e9ea2d15-19b1-4354-97e8-d1536184f3d5.png',  // 猫の画像として使用
    tower: '4da544de-f330-4362-a840-c3d5de494007.png',   // 塔の画像として使用
    plane: '3ee075bf-28a2-49f1-80e4-f881ddd90f2e.png',   // 飛行機の画像として使用
    bird: '0dabc06d-9be1-4a58-a5c4-1ab0d96723df.png',    // 鳥の画像として使用
    cloud1: '02db8ec8-edcc-4d6c-9d55-7da312c5c6dc.png',  // 雲1の画像として使用
    cloud2: '112a0cbb-492f-48d4-baec-55ec23c84cc0.png',  // 雲2の画像として使用
    ufo: 'maou.png'                                        // UFO/魔王の画像として使用
};

// 画像読み込み関数（エラーハンドリング付き）
function loadImages() {
    let loadedCount = 0;
    const totalCount = Object.keys(imageAssets).length;
    
    for (const [key, src] of Object.entries(imageAssets)) {
        const img = new Image();
        img.onload = () => {
            loadedCount++;
            images[key] = img;
            console.log(`画像読み込み成功: ${key} -> ${src}`);
        };
        img.onerror = () => {
            loadedCount++;
            console.warn(`画像読み込み失敗: ${key} -> ${src} (フォールバックを使用)`);
            images[key] = null; // nullを設定してフォールバックを使用
        };
        img.src = src; 
    }
}
loadImages();

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
let GAME_WIDTH = 300;
let GAME_HEIGHT = 400; // リサイズ関数で更新される
const PLAYER_SIZE = 40;
const PLAYER_SPEED = 4;
let GRAVITY = 0.008;
const OBSTACLE_HEIGHT = 20; // 少し厚みを持たせる
let OBSTACLE_SPEED = 0.2;
let OBSTACLE_SPAWN_INTERVAL = 1200;
const ITEM_SIZE = 30;
const ITEM_SPEED = 0.15;
let ITEM_SPAWN_INTERVAL = 4000;
const MIN_OBSTACLE_GAP = 90;

let lastObstacleSpawnTime = 0;
let lastItemSpawnTime = 0;
let lastDifficultyDistance = -1;
let lastFeatherDistance = 0;

// パワーアップ・環境効果
let featherTime = 0;
let shieldTime = 0;
let shieldHits = 0;
let starCount = 0;
let windForce = 0;
let windTimer = 0;

// 背景の星
const starPositions = Array.from({ length: 100 }, () => ({
    x: Math.random(), // 0-1の比率で保存
    y: Math.random(),
    size: Math.random() * 2,
    blinkOffset: Math.random() * 10
}));

// 効果音（簡易実装）
const audioContext = new (window.AudioContext || window.webkitAudioContext)();
function playSound(freq, type='sine', vol=0.1) {
    if (audioContext.state === 'suspended') audioContext.resume();
    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();
    osc.connect(gain);
    gain.connect(audioContext.destination);
    osc.frequency.value = freq;
    osc.type = type;
    gain.gain.setValueAtTime(vol, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
    osc.start();
    osc.stop(audioContext.currentTime + 0.1);
}

// キャンバスのリサイズ（レスポンシブ対応強化）
function resizeCanvas() {
    const wrapper = canvas.parentElement;
    GAME_WIDTH = wrapper.clientWidth;
    GAME_HEIGHT = wrapper.clientHeight;

    canvas.width = GAME_WIDTH;
    canvas.height = GAME_HEIGHT;
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
    this.isStomping = false;
    this.hasShield = false;
    this.shieldFlashTime = 0;
    
    // 残像用
    this.trail = []; 

    this.draw = function() {
        const centerX = this.x + this.width / 2;
        const centerY = this.y + this.height / 2;

        // 残像描画（高速移動時）
        if (this.isStomping || Math.abs(this.velocityY) > 8) {
            this.trail.forEach((pos, index) => {
                const alpha = (index / this.trail.length) * 0.4;
                ctx.globalAlpha = alpha;
                if (images.player && images.player !== null && images.player.complete && images.player.naturalWidth !== 0) {
                     ctx.drawImage(images.player, pos.x, pos.y, this.width, this.height);
                }
                ctx.globalAlpha = 1.0;
            });
        }

        // シールド
        if (this.hasShield) {
            ctx.save();
            ctx.strokeStyle = `rgba(100, 255, 218, ${0.5 + Math.sin(this.shieldFlashTime * 0.2) * 0.4})`;
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(centerX, centerY, this.width * 0.7, 0, 2 * Math.PI);
            ctx.stroke();
            
            // シールドの周りを回る光
            const angle = this.shieldFlashTime * 0.1;
            ctx.fillStyle = "#64ffda";
            ctx.beginPath();
            ctx.arc(centerX + Math.cos(angle)*this.width*0.7, centerY + Math.sin(angle)*this.width*0.7, 3, 0, Math.PI*2);
            ctx.fill();
            ctx.restore();
            this.shieldFlashTime++;
        }

        // 本体
        if (images.player && images.player !== null && images.player.complete && images.player.naturalWidth !== 0) {
            ctx.drawImage(images.player, this.x, this.y, this.width, this.height);
        } else {
            // 画像がない場合の仮猫
            ctx.fillStyle = '#2c3e50';
            ctx.beginPath();
            ctx.arc(centerX, centerY, this.width/2, 0, Math.PI*2);
            ctx.fill();
            // 目
            ctx.fillStyle = '#f1c40f';
            ctx.beginPath();
            ctx.arc(centerX-5, centerY-2, 3, 0, Math.PI*2);
            ctx.arc(centerX+5, centerY-2, 3, 0, Math.PI*2);
            ctx.fill();
        }
    };

    this.update = function() {
        if (this.isStomping) {
            this.velocityY += 0.8;
            if (this.velocityY > 15) this.velocityY = 15;
        } else {
            this.velocityY += GRAVITY;
        }

        // 羽アイテム中は落下速度制限
        if (featherTime > 0 && this.velocityY > 2) {
            this.velocityY = 2;
        }

        this.y += this.velocityY;
        
        let moveX = 0;
        if (this.isMovingLeft) moveX -= PLAYER_SPEED;
        if (this.isMovingRight) moveX += PLAYER_SPEED;
        this.x += moveX + windForce;

        // 画面端の制限
        if (this.x < 0) this.x = 0;
        if (this.x + this.width > GAME_WIDTH) this.x = GAME_WIDTH - this.width;

        // 残像座標の更新
        this.trail.push({x: this.x, y: this.y});
        if (this.trail.length > 5) this.trail.shift();

        this.hasShield = shieldTime > 0;

        // 画面下へ落ちたらゲームオーバー
        if (this.y > GAME_HEIGHT) {
            endGame();
        }
    };
}

// 障害物クラス
function Obstacle(x, y, width, height, type) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
    this.type = type;
    this.vx = 0;
    
    // 雲の種類を固定
    this.cloudType = Math.random() < 0.5 ? 'cloud1' : 'cloud2';

    // 柱の場合は色をランダムセット（画像がないとき用）
    this.color = `hsl(${Math.random() * 360}, 60%, 40%)`;

    this.draw = function() {
        const useImage = (key) => images[key] && images[key] !== null && images[key].complete && images[key].naturalWidth !== 0;

        if (this.type === 'pillar') {
            if (useImage('tower')) {
                // 塔の画像をシームレスに繰り返し表示するロジック
                // Y座標に基づいて、画像のどの部分を表示するか計算
                const img = images.tower;
                const patternScale = 0.5; // 画像のスケール
                const patternY = (this.y - distance) * 0.5; // パララックス効果

                ctx.save();
                ctx.beginPath();
                ctx.rect(this.x, this.y, this.width, this.height);
                ctx.clip();
                
                // 画像を縦に並べて描画（簡易的なタイリング）
                // 実際にはもっとスマートな方法があるが、ここではシンプルに
                ctx.drawImage(img, this.x, this.y, this.width, this.height);
                
                // 枠線で少し引き締める
                ctx.strokeStyle = "rgba(0,0,0,0.3)";
                ctx.strokeRect(this.x, this.y, this.width, this.height);
                ctx.restore();
            } else {
                ctx.fillStyle = '#555';
                ctx.fillRect(this.x, this.y, this.width, this.height);
                // レンガ模様
                ctx.strokeStyle = '#333';
                ctx.strokeRect(this.x, this.y, this.width, this.height);
            }
        } else {
            // 敵キャラの描画
            let imgKey = null;
            if (this.type === 'cloud') imgKey = this.cloudType;
            else if (this.type === 'crow') imgKey = 'bird';
            else if (this.type === 'helicopter' || this.type === 'airplane') imgKey = 'plane';
            else if (this.type === 'ufo') imgKey = 'ufo';

            if (imgKey && useImage(imgKey)) {
                ctx.drawImage(images[imgKey], this.x, this.y, this.width, this.height);
            } else {
                // フォールバック図形
                ctx.fillStyle = this.type === 'cloud' ? '#ecf0f1' : 
                               this.type === 'ufo' ? '#9b59b6' : '#e74c3c';
                ctx.fillRect(this.x, this.y, this.width, this.height);
                // タイプに応じた簡単な図形を描画
                if (this.type === 'cloud') {
                    ctx.fillStyle = '#bdc3c7';
                    ctx.beginPath();
                    ctx.arc(this.x + this.width/2, this.y + this.height/2, this.width/3, 0, Math.PI*2);
                    ctx.fill();
                } else if (this.type === 'ufo') {
                    ctx.fillStyle = '#8e44ad';
                    ctx.beginPath();
                    ctx.ellipse(this.x + this.width/2, this.y + this.height/2, this.width/2, this.height/3, 0, 0, Math.PI*2);
                    ctx.fill();
                }
            }
        }
    };

    this.update = function() {
        this.y -= OBSTACLE_SPEED;
        
        // 動く障害物
        if (this.type !== 'pillar') {
            this.x += this.vx;
            // 画面端で跳ね返り
            if (this.x <= 0 || this.x + this.width >= GAME_WIDTH) {
                this.vx *= -1;
            }
            // 風の影響（雲のみ）
            if (this.type === 'cloud') {
                this.x += windForce * 0.8;
            }
        }
    };
}

// アイテム管理
function Item(x, y, type) {
    this.x = x;
    this.y = y;
    this.width = ITEM_SIZE;
    this.height = ITEM_SIZE;
    this.type = type;
    this.time = 0;

    this.draw = function() {
        const bobY = this.y + Math.sin(this.time * 0.1) * 5;
        
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.font = '24px serif';
        
        let icon = '';
        if (this.type === 'feather') icon = '🪶';
        else if (this.type === 'shield') icon = '🛡️';
        else if (this.type === 'star') icon = '🌟';

        // 光るエフェクト
        ctx.shadowColor = '#fff';
        ctx.shadowBlur = 10;
        ctx.fillText(icon, this.x + this.width/2, bobY + this.height/2);
        ctx.shadowBlur = 0;
    };

    this.update = function() {
        this.y -= ITEM_SPEED;
        this.time++;
    };
}

// パーティクル（風、爆発など）
function Particle(x, y, type) {
    this.x = x;
    this.y = y;
    this.life = 1.0;
    this.type = type; // 'star', 'wind', 'hit'
    
    if (type === 'wind') {
        this.vx = windForce * 10 + (Math.random()-0.5)*2;
        this.vy = (Math.random()-0.5);
        this.decay = 0.05;
    } else {
        this.vx = (Math.random() - 0.5) * 5;
        this.vy = (Math.random() - 0.5) * 5;
        this.decay = 0.03;
    }

    this.update = function() {
        this.x += this.vx;
        this.y += this.vy;
        this.life -= this.decay;
    };

    this.draw = function() {
        ctx.globalAlpha = Math.max(0, this.life);
        if (this.type === 'wind') {
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(this.x, this.y);
            ctx.lineTo(this.x - this.vx * 2, this.y - this.vy * 2);
            ctx.stroke();
        } else {
            ctx.fillStyle = this.type === 'hit' ? '#e74c3c' : '#f1c40f';
            ctx.beginPath();
            ctx.arc(this.x, this.y, 2, 0, Math.PI*2);
            ctx.fill();
        }
        ctx.globalAlpha = 1.0;
    };
}

// ゲーム初期化
function initGame() {
    distance = 0;
    player = new Player();
    obstacles = [];
    items = [];
    particles = [];
    
    GRAVITY = 0.008;
    OBSTACLE_SPEED = 0.2;
    OBSTACLE_SPAWN_INTERVAL = 1200;
    
    // UIリセット
    featherTime = 0;
    shieldTime = 0;
    shieldHits = 0;
    starCount = 0;
    gameOver = false;
    
    windForce = 0;
    windTimer = 0;
    windIndicator.style.display = 'none';

    gameOverOverlay.style.display = 'none';
    startScreen.style.display = 'none';
    
    resizeCanvas();

    if (gameLoopId) cancelAnimationFrame(gameLoopId);
    gameLoopId = requestAnimationFrame(gameLoop);
}

// 背景描画（大気圏突入のようなグラデーション変化）
function drawBackground() {
    // 距離(distance)に応じて色を変える
    // 0-1000: 空 (Blue -> Orange)
    // 1000-3000: 夕暮れ -> 夜 (Orange -> Purple -> Black)
    // 3000+: 宇宙 (Black)
    
    let topColor, bottomColor;

    if (distance < 1000) {
        // 青空
        topColor = `hsl(210, 80%, ${Math.max(20, 70 - distance/20)}%)`; 
        bottomColor = `hsl(200, 90%, ${Math.max(40, 90 - distance/20)}%)`;
    } else if (distance < 2500) {
        // 夕焼け〜夜への遷移
        const progress = (distance - 1000) / 1500;
        // Orange(30) -> Purple(270) -> Black
        topColor = `hsl(${30 + progress * 240}, 60%, ${Math.max(0, 50 - progress*50)}%)`;
        bottomColor = `hsl(${40 + progress * 200}, 70%, ${Math.max(10, 60 - progress*50)}%)`;
    } else {
        // 宇宙
        topColor = '#000011';
        bottomColor = '#000033';
    }

    const grad = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT);
    grad.addColorStop(0, topColor);
    grad.addColorStop(1, bottomColor);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT);

    // 星の描画（距離が進むと星が増える/濃くなる）
    if (distance > 500) {
        const starOpacity = Math.min(1, (distance - 500) / 2000);
        ctx.fillStyle = `rgba(255, 255, 255, ${starOpacity})`;
        starPositions.forEach(s => {
            // キラキラさせる
            const blink = Math.sin(Date.now() * 0.005 + s.blinkOffset) > 0.5 ? 1 : 0.5;
            ctx.globalAlpha = starOpacity * blink;
            ctx.beginPath();
            ctx.arc(s.x * GAME_WIDTH, s.y * GAME_HEIGHT, s.size, 0, Math.PI*2);
            ctx.fill();
        });
        ctx.globalAlpha = 1.0;
    }
}

// ゲームループ
function gameLoop() {
    ctx.clearRect(0, 0, GAME_WIDTH, GAME_HEIGHT);
    drawBackground();

    const now = Date.now();

    // 難易度調整
    if (distance - lastDifficultyDistance >= 50) {
        OBSTACLE_SPEED += 0.01;
        if (OBSTACLE_SPAWN_INTERVAL > 400) OBSTACLE_SPAWN_INTERVAL -= 20;
        lastDifficultyDistance = distance;
    }

    // 風イベント
    if (windTimer > 0) {
        windTimer--;
        if (Math.random() < 0.3) particles.push(new Particle(windForce > 0 ? 0 : GAME_WIDTH, Math.random()*GAME_HEIGHT, 'wind'));
        if (windTimer === 0) {
            windForce = 0;
            windIndicator.style.display = 'none';
        }
    } else if (distance > 300 && Math.random() < 0.001) { // 風の発生確率
        windTimer = 400;
        windForce = (Math.random() < 0.5 ? -1 : 1) * (Math.random() * 0.5 + 0.5);
        windIndicator.style.display = 'block';
        windDirectionSpan.textContent = windForce > 0 ? "RIGHT →" : "← LEFT";
    }

    // プレイヤー更新
    const fallMultiplier = featherTime > 0 ? 0.6 : 1;
    GRAVITY = OBSTACLE_SPEED * 0.05 * fallMultiplier;
    player.update();
    player.draw();

    // 障害物生成
    if (now - lastObstacleSpawnTime > OBSTACLE_SPAWN_INTERVAL) {
        spawnObstacle();
        lastObstacleSpawnTime = now;
    }
    // アイテム生成
    if (now - lastItemSpawnTime > ITEM_SPAWN_INTERVAL) {
        spawnItem();
        lastItemSpawnTime = now;
    }

    // オブジェクトの更新と描画
    obstacles.forEach((o, i) => {
        o.update();
        o.draw();
        if (checkCollision(player, o)) {
            if (shieldTime > 0) {
                // シールドあり：障害物破壊
                playSound(150, 'square');
                for(let k=0; k<5; k++) particles.push(new Particle(o.x+o.width/2, o.y+o.height/2, 'hit'));
                obstacles.splice(i, 1);
                shieldHits--;
                if (shieldHits <= 0) shieldTime = 0;
            } else if (player.isStomping && o.type !== 'pillar') {
                // ストンプ中：敵を踏む（柱は無理）
                playSound(200, 'sawtooth');
                obstacles.splice(i, 1);
                player.velocityY = -4; // 跳ねる
                distance += 50; // ボーナス
            } else {
                endGame();
            }
        }
    });
    // 画面外に出た障害物を削除
    obstacles = obstacles.filter(o => o.y + o.height > -100);

    // アイテム処理
    items.forEach((item, i) => {
        item.update();
        item.draw();
        if (checkCollision(player, item)) {
            playSound(600 + Math.random()*200, 'sine');
            if (item.type === 'feather') featherTime = 300;
            if (item.type === 'shield') { shieldTime = 1200; shieldHits = 3; }
            if (item.type === 'star') { starCount++; distance += 100; }
            items.splice(i, 1);
        }
    });
    items = items.filter(i => i.y + i.height > -100);

    // パーティクル処理
    particles.forEach((p, i) => {
        p.update();
        p.draw();
        if (p.life <= 0) particles.splice(i, 1);
    });

    distance += 1; // 進む距離
    updateDisplays();

    if (!gameOver) {
        gameLoopId = requestAnimationFrame(gameLoop);
    }
}

// 衝突判定
function checkCollision(player, rect) {
    const margin = 8; // 画像の余白を考慮して判定を甘くする
    return (
        player.x + margin < rect.x + rect.width - margin &&
        player.x + player.width - margin > rect.x + margin &&
        player.y + margin < rect.y + rect.height - margin &&
        player.y + player.height - margin > rect.y + margin
    );
}

function spawnObstacle() {
    const difficulty = Math.min(5, Math.floor(distance / 500)); 
    const gapBase = GAME_WIDTH * 0.7; 
    const gap = Math.max(PLAYER_SIZE * 2.5, gapBase - difficulty * 20);
    const gapX = Math.random() * (GAME_WIDTH - gap);

    // 柱（壁）
    if (gapX > 0) obstacles.push(new Obstacle(0, GAME_HEIGHT, gapX, OBSTACLE_HEIGHT, 'pillar'));
    if (gapX + gap < GAME_WIDTH) obstacles.push(new Obstacle(gapX + gap, GAME_HEIGHT, GAME_WIDTH - (gapX + gap), OBSTACLE_HEIGHT, 'pillar'));

    // 敵キャラ（難易度に応じて確率アップ）
    if (Math.random() < 0.3 + difficulty * 0.1) {
        const types = ['cloud', 'crow', 'helicopter', 'airplane', 'ufo'];
        const type = types[Math.floor(Math.random() * types.length)];
        // UFOはレア
        if (type === 'ufo' && Math.random() > 0.2) return;

        let w = 40, h = 30;
        // 画像比率に合わせたサイズ調整
        if (type === 'cloud') { w=60; h=35; }
        if (type === 'helicopter') { w=50; h=30; }

        const x = gapX + Math.random() * (gap - w);
        const enemy = new Obstacle(x, GAME_HEIGHT + 50, w, h, type);
        enemy.vx = (Math.random() - 0.5) * (0.5 + difficulty * 0.2);
        obstacles.push(enemy);
    }
}

function spawnItem() {
    const types = ['shield', 'feather', 'star'];
    const type = types[Math.floor(Math.random() * types.length)];
    items.push(new Item(Math.random() * (GAME_WIDTH - ITEM_SIZE), GAME_HEIGHT, type));
}

function updateDisplays() {
    distanceDisplay.textContent = Math.floor(distance);
    highDistanceDisplay.textContent = Math.floor(highDistance);
    featherTimeDisplay.textContent = Math.ceil(featherTime/60);
    shieldTimeDisplay.textContent = Math.ceil(shieldTime/60);
    starCountDisplay.textContent = starCount;

    if (featherTime > 0) featherTime--;
    if (shieldTime > 0) shieldTime--;
}

function endGame() {
    if (gameOver) return;
    gameOver = true;
    
    if (distance > highDistance) {
        highDistance = distance;
        localStorage.setItem('highDistance', highDistance);
        newRecordDisplay.style.display = 'block';
    } else {
        newRecordDisplay.style.display = 'none';
    }
    
    finalDistanceDisplay.textContent = Math.floor(distance);
    gameOverOverlay.style.display = 'flex';
}

// イベントリスナー
window.addEventListener('resize', resizeCanvas);

// ボタン操作（タッチ対応）
const setupBtn = (btn, actionStart, actionEnd) => {
    if(!btn) return;
    btn.addEventListener('mousedown', (e) => { e.preventDefault(); actionStart(); });
    btn.addEventListener('mouseup', (e) => { e.preventDefault(); actionEnd(); });
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); actionStart(); });
    btn.addEventListener('touchend', (e) => { e.preventDefault(); actionEnd(); });
};

setupBtn(startButton, () => { gameStarted = true; initGame(); }, () => {});
setupBtn(restartButton, () => { initGame(); }, () => {});

setupBtn(leftButton, () => { if(player) player.isMovingLeft = true; }, () => { if(player) player.isMovingLeft = false; });
setupBtn(rightButton, () => { if(player) player.isMovingRight = true; }, () => { if(player) player.isMovingRight = false; });

// ジャンプ（浮上）
let jumpInt;
setupBtn(upButton, () => {
    jumpInt = setInterval(() => { if(player) player.velocityY -= 0.6; }, 50);
}, () => { clearInterval(jumpInt); });

// 急降下
setupBtn(downButton, () => { if(player) player.isStomping = true; }, () => { if(player) player.isStomping = false; });

// キーボード操作
window.addEventListener('keydown', (e) => {
    if(!player) return;
    if(['ArrowLeft', 'a'].includes(e.key)) player.isMovingLeft = true;
    if(['ArrowRight', 'd'].includes(e.key)) player.isMovingRight = true;
    if(['ArrowUp', 'w'].includes(e.key)) player.velocityY -= 0.6;
    if(['ArrowDown', 's'].includes(e.key)) player.isStomping = true;
});

window.addEventListener('keyup', (e) => {
    if(!player) return;
    if(['ArrowLeft', 'a'].includes(e.key)) player.isMovingLeft = false;
    if(['ArrowRight', 'd'].includes(e.key)) player.isMovingRight = false;
    if(['ArrowDown', 's'].includes(e.key)) player.isStomping = false;
});