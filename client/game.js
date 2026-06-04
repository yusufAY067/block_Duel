let socket = null;
let jwtToken = null;

const THEME_PALETTES = {
    classic: { bgColor: '#0B0F19', primary: '#00F0FF', secondary: '#FF007F' },
    neon_blue: { bgColor: '#0a0e27', primary: '#00D4FF', secondary: '#0099FF' },
    purple_galaxy: { bgColor: '#1a0033', primary: '#DD00FF', secondary: '#8A2BE2' },
    cyberpunk: { bgColor: '#0d0221', primary: '#FF006E', secondary: '#00D4FF' },
    gold: { bgColor: '#1a1500', primary: '#FFD700', secondary: '#FFA500' },
    lavender_world: { bgColor: '#2d1b4e', primary: '#E6B3FF', secondary: '#C77DFF' }
};

const SHOP_TYPE_MAP = {
    themes: 'theme',
    effects: 'effect',
    frames: 'frame',
    badges: 'badge'
};

// UI Elements
const screens = {
    auth: document.getElementById('auth-screen'),
    menu: document.getElementById('menu-screen'),
    game: document.getElementById('game-screen'),
    result: document.getElementById('result-screen'),
    profile: document.getElementById('profile-screen'),
    leaderboard: document.getElementById('leaderboard-screen'),
    shop: document.getElementById('shop-screen')
};

const coinBalanceEl = document.getElementById('coin-balance');
const queueStatusEl = document.getElementById('queue-status');
const myScoreEl = document.getElementById('my-score');
const opponentScoreEl = document.getElementById('opponent-score');
const gameTimerEl = document.getElementById('game-timer');
const comboDisplay = document.getElementById('combo-display');
const comboCountEl = document.getElementById('combo-count');

const matchTypeBanner = document.getElementById('match-type-banner');
const matchTypeTitleEl = document.getElementById('match-type-title');
const matchTypeSubtitleEl = document.getElementById('match-type-subtitle');

const resultTitle = document.getElementById('result-title');
const resultReason = document.getElementById('result-reason');
const rewardInfoEl = document.getElementById('reward-info');
const rewardAmountEl = document.getElementById('reward-amount');

const authUsernameInput = document.getElementById('username');
const authPasswordInput = document.getElementById('password');
const authMsg = document.getElementById('auth-msg');

const userDisplay = document.getElementById('user-display');
const friendsToggleBtn = document.getElementById('friends-toggle-btn');
const playBtn = document.getElementById('play-btn');

// Social UI Elements
const socialPanel = document.getElementById('social-panel');
const friendTagInput = document.getElementById('friend-tag-input');
const friendsListEl = document.getElementById('friends-list');
const friendRequestsListEl = document.getElementById('friend-requests-list');
const notificationsEl = document.getElementById('notifications');

const challengeModal = document.getElementById('challenge-modal');
const challengeTargetNameEl = document.getElementById('challenge-target-name');
const challengeScoreSelect = document.getElementById('challenge-score-select');

// Game State
let currentRoomId = null;
let myId = null;
let opponentId = null;
let myUsername = null;
let myFullTag = null;
let selectedTargetScore = null;
let currentMatchIsRanked = true;

// Social State
let myFriends = [];
let myFriendRequests = [];
let currentChallengeTarget = null;

// --- Auth System (REST API) ---

async function apiCall(endpoint, data) {
    const headers = { 'Content-Type': 'application/json' };
    if (jwtToken) {
        headers['Authorization'] = `Bearer ${jwtToken}`;
    }
    const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error || 'API Hatası');
    return result;
}

function connectSocket(token) {
    socket = io({
        auth: { token }
    });

    socket.on('connect', () => {
        myId = socket.id;
        console.log('Connected with socket ID:', myId);
        socket.emit('tellFriendsOnline');
        socket.emit('requestFriendStatuses');
    });

    setupSocketListeners();
}

async function login() {
    const username = authUsernameInput.value.trim();
    const password = authPasswordInput.value;
    if (!username || !password) return;
    
    authMsg.innerText = "Giriş yapılıyor...";
    try {
        const res = await apiCall('/api/auth/login', { username, password });
        handleAuthSuccess(res);
    } catch(err) {
        authMsg.innerText = err.message;
    }
}

async function register() {
    const username = authUsernameInput.value.trim();
    const password = authPasswordInput.value;
    if (!username || !password) return;
    
    authMsg.innerText = "Kayıt olunuyor...";
    try {
        const res = await apiCall('/api/auth/register', { username, password });
        handleAuthSuccess(res);
    } catch(err) {
        authMsg.innerText = err.message;
    }
}

function handleAuthSuccess(data) {
    const user = data.user;
    jwtToken = data.token;
    
    myUsername = user.username;
    myFullTag = user.fullTag;
    coinBalanceEl.innerText = user.coins;
    
    userDisplay.innerText = user.fullTag;
    userDisplay.classList.remove('hidden');
    friendsToggleBtn.classList.remove('hidden');
    
    myFriends = user.friends || [];
    myFriendRequests = user.friendRequests || [];
    
    renderFriends();
    renderFriendRequests();
    
    connectSocket(jwtToken);
    showScreen('menu');
}

// --- Toast Notifications ---
function showToast(msg, type = 'info', actions = null) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const text = document.createElement('div');
    text.innerText = msg;
    toast.appendChild(text);

    if (actions) {
        const actionDiv = document.createElement('div');
        actionDiv.className = 'toast-actions';
        actions.forEach(act => {
            const btn = document.createElement('button');
            btn.className = act.primary ? 'btn-primary' : 'btn-secondary';
            btn.innerText = act.label;
            btn.onclick = () => {
                act.onClick();
                toast.remove();
            };
            actionDiv.appendChild(btn);
        });
        toast.appendChild(actionDiv);
    } else {
        setTimeout(() => {
            if(toast.parentElement) toast.remove();
        }, 3000);
    }

    notificationsEl.appendChild(toast);
}

// --- Social System (REST API) ---

function toggleSocialPanel() {
    socialPanel.classList.toggle('hidden');
}

async function sendFriendRequest() {
    const target = friendTagInput.value.trim();
    if (!target) return;
    
    try {
        const res = await apiCall('/api/social/add-friend', { targetFullTag: target });
        showToast(res.message, 'success');
        friendTagInput.value = '';
        if(socket) socket.emit('notifyFriendRequest', { targetUsername: res.targetUsername, meFullTag: res.meFullTag });
    } catch(err) {
        showToast(err.message, 'error');
    }
}

async function respondFriendRequest(requesterUsername, accept) {
    try {
        const res = await apiCall('/api/social/respond-request', { requesterUsername, accept });
        myFriendRequests = res.meUpdatedRequests;
        renderFriendRequests();
        if(accept) {
            fetchFriends(); // update my list
            if(socket) socket.emit('notifyFriendAccept', { requesterUsername, myFullTag: res.myFullTag });
        }
        showToast(res.message, 'success');
    } catch(err) {
        showToast(err.message, 'error');
    }
}

async function removeFriend(friendUsername, friendFullTag) {
    const confirmed = window.confirm('Bu kişiyi arkadaş listesinden kaldırmak istediğinize emin misiniz?');
    if (!confirmed) return;

    try {
        const res = await apiCall('/api/social/remove-friend', { friendUsername });
        showToast(res.message, 'success');
        await fetchFriends();
    } catch(err) {
        showToast(err.message, 'error');
    }
}

async function fetchFriends() {
    try {
        const res = await fetch('/api/social/friends', {
            headers: { 'Authorization': `Bearer ${jwtToken}` }
        });
        const data = await res.json();
        myFriends = data.friends;
        renderFriends();
        if (socket && socket.connected) {
            socket.emit('requestFriendStatuses');
        }
    } catch(err) {}
}

function renderFriends() {
    friendsListEl.innerHTML = '';
    if (myFriends.length === 0) {
        friendsListEl.innerHTML = '<li><span class="text-muted">Henüz arkadaşın yok.</span></li>';
        return;
    }

    myFriends.forEach(f => {
        const li = document.createElement('li');
        const onlineEmoji = f.isOnline ? '🟢' : '🔴';
        const statusText = f.isOnline ? 'online' : 'offline';

        li.innerHTML = `
            <div>
                <span class="friend-status ${statusText}">${onlineEmoji}</span>
                ${f.fullTag}
            </div>
        `;

        const actions = document.createElement('div');
        actions.className = 'friend-actions';

        const removeBtn = document.createElement('button');
        removeBtn.className = 'btn-secondary small-btn';
        removeBtn.innerText = 'Arkadaşı Sil';
        removeBtn.onclick = () => removeFriend(f.username, f.fullTag);
        actions.appendChild(removeBtn);

        if (f.isOnline) {
            const challengeBtn = document.createElement('button');
            challengeBtn.className = 'btn-primary small-btn';
            challengeBtn.innerText = '⚔️ Düello';
            challengeBtn.onclick = () => openChallengeModal(f.username);
            actions.appendChild(challengeBtn);
        }

        li.appendChild(actions);
        friendsListEl.appendChild(li);
    });
}

function renderFriendRequests() {
    friendRequestsListEl.innerHTML = '';
    if (myFriendRequests.length === 0) {
        friendRequestsListEl.innerHTML = '<li><span class="text-muted">İstek yok.</span></li>';
        return;
    }

    myFriendRequests.forEach(req => {
        const li = document.createElement('li');
        li.innerText = req.fullTag;
        
        const actionDiv = document.createElement('div');
        
        const acceptBtn = document.createElement('button');
        acceptBtn.className = 'btn-primary small-btn';
        acceptBtn.innerText = '✓';
        acceptBtn.onclick = () => respondFriendRequest(req.username, true);
        
        const rejectBtn = document.createElement('button');
        rejectBtn.className = 'btn-secondary small-btn';
        rejectBtn.innerText = '✖';
        rejectBtn.onclick = () => respondFriendRequest(req.username, false);
        
        actionDiv.appendChild(acceptBtn);
        actionDiv.appendChild(rejectBtn);
        li.appendChild(actionDiv);
        friendRequestsListEl.appendChild(li);
    });
}

function setupSocketListeners() {
    socket.on('socialSuccess', (msg) => showToast(msg, 'success'));
    socket.on('socialError', (msg) => showToast(msg, 'error'));

    socket.on('friendListUpdateNeeded', () => {
        fetchFriends();
    });

    socket.on('friendStatusUpdate', (data) => {
        const friend = myFriends.find(f => f.username === data.username);
        if (friend) {
            friend.isOnline = data.isOnline;
            renderFriends();
        }
    });

    socket.on('friendRequestReceived', (req) => {
        myFriendRequests.push(req);
        renderFriendRequests();
        showToast(`${req.fullTag} sana arkadaşlık isteği gönderdi.`, 'info');
    });

    socket.on('friendStatuses', (data) => {
        if (!data || !data.friends) return;
        data.friends.forEach(status => {
            const friend = myFriends.find(f => f.username === status.username);
            if (friend) {
                friend.isOnline = status.isOnline;
            }
        });
        renderFriends();
    });

    // ... Challenge & Game Listeners ...
    socket.on('challengeReceived', (data) => {
        const typeStr = data.isRanked ? "Coinli (Ranked)" : "Dostluk Düellosu - Bu maçta coin kazanılmaz veya kaybedilmez.";
        showToast(`${data.challengerFullTag} seni düelloya davet ediyor! (${data.targetScore} Puan - ${typeStr})`, 'info', [
            {
                label: 'Kabul Et',
                primary: true,
                onClick: () => socket.emit('respondChallenge', { challengerUsername: data.challengerUsername, accept: true, targetScore: data.targetScore, isRanked: data.isRanked })
            },
            {
                label: 'Reddet',
                primary: false,
                onClick: () => socket.emit('respondChallenge', { challengerUsername: data.challengerUsername, accept: false, targetScore: data.targetScore, isRanked: data.isRanked })
            }
        ]);
    });

    socket.on('balanceUpdate', (balance) => {
        coinBalanceEl.innerText = balance;
    });

    socket.on('errorMsg', (msg) => {
        showToast(msg, 'error');
        if (msg.includes('bakiye')) {
            playBtn.disabled = false;
            queueStatusEl.innerText = '';
        }
    });

    socket.on('queueStatus', (msg) => {
        queueStatusEl.innerText = msg;
    });

    socket.on('matchFound', (data) => {
        currentRoomId = data.roomId;
        currentMatchIsRanked = data.isRanked !== false;
        if (!currentMatchIsRanked) {
            matchTypeBanner.classList.remove('hidden');
            matchTypeTitleEl.innerText = 'Dostluk Düellosu';
            matchTypeSubtitleEl.innerText = 'Bu maçta coin kazanılmaz veya kaybedilmez.';
        } else {
            matchTypeBanner.classList.add('hidden');
        }

        showScreen('game');
        
        socialPanel.classList.add('hidden');
        challengeModal.classList.add('hidden');
        
        if (!renderer) {
            renderer = new Renderer();
        }
        
        myScoreEl.innerText = '0';
        opponentScoreEl.innerText = '0';
        comboDisplay.classList.add('hidden');
    });

    socket.on('gameState', (state) => {
        if (!currentRoomId) return;

        if (!opponentId) {
            const ids = Object.keys(state.players);
            opponentId = ids.find(id => id !== myId);
        }

        gameTimerEl.innerText = formatTime(state.timeLeft);

        const myState = state.players[myId];
        const opponentState = state.players[opponentId];

        if (myState) {
            if (myScoreEl.innerText !== myState.score.toString()) {
                myScoreEl.innerText = myState.score;
            }

            if (myState.combo >= 2) {
                comboDisplay.classList.remove('hidden');
                comboCountEl.innerText = myState.combo;
            } else {
                comboDisplay.classList.add('hidden');
            }
        }

        if (opponentState) {
            opponentScoreEl.innerText = opponentState.score;
        }

        if (renderer) {
            renderer.updateState(myState, opponentState);
        }
    });

    socket.on('playEffect', (effectData) => {
        const canvasContainer = document.getElementById('game-canvas');
        canvasContainer.classList.remove('shake');
        void canvasContainer.offsetWidth; 
        canvasContainer.classList.add('shake');

        if (renderer) {
            renderer.triggerVisualEffects(effectData);
        }
    });

    socket.on('gameEnd', (data) => {
        currentRoomId = null;
        opponentId = null;
        
        showScreen('result');
        resultReason.innerText = data.reason || '';

        resultTitle.className = ''; 
        rewardInfoEl.classList.add('hidden');

        if (data.winnerId === myId) {
            resultTitle.innerText = 'ZAFER!';
            resultTitle.classList.add('win-title');
            
            if (currentMatchIsRanked && data.reward) {
                rewardAmountEl.innerText = data.reward;
                rewardInfoEl.classList.remove('hidden');
            }
        } else if (data.winnerId === 'draw') {
            resultTitle.innerText = 'BERABERE';
            resultTitle.classList.add('draw-title');
            if (currentMatchIsRanked && data.refund) {
                rewardAmountEl.innerText = data.refund + " (İade)";
                rewardInfoEl.classList.remove('hidden');
            }
        } else {
            resultTitle.innerText = 'MAĞLUBİYET';
            resultTitle.classList.add('lose-title');
        }
    });
}

// --- Challenge System ---
function openChallengeModal(targetUsername) {
    currentChallengeTarget = targetUsername;
    challengeTargetNameEl.innerText = `Hedef: ${targetUsername}`;
    challengeModal.classList.remove('hidden');
    socialPanel.classList.add('hidden');
}

function closeChallengeModal() {
    challengeModal.classList.add('hidden');
    currentChallengeTarget = null;
}

function confirmSendChallenge() {
    if (!currentChallengeTarget || !socket) return;
    
    const score = parseInt(challengeScoreSelect.value);
    const isRanked = false;
    
    socket.emit('sendChallenge', {
        targetUsername: currentChallengeTarget,
        targetScore: score,
        isRanked: isRanked
    });
    
    closeChallengeModal();
}

// --- Menu Logic ---
function selectScore(score, element) {
    selectedTargetScore = score;
    
    document.querySelectorAll('.score-card').forEach(el => el.classList.remove('selected'));
    
    element.classList.add('selected');
    
    playBtn.disabled = false;
}

function startMatch() {
    if (!selectedTargetScore || !socket) return;
    socket.emit('joinQueue', selectedTargetScore);
    queueStatusEl.innerText = 'Kuyruğa giriliyor... (Rakip bekleniyor)';
    playBtn.disabled = true;
}

function showScreen(screenName) {
    Object.values(screens).forEach(s => s.classList.remove('active'));
    screens[screenName].classList.add('active');
}

function backToMenu() {
    showScreen('menu');
    queueStatusEl.innerText = '';
    playBtn.disabled = false;
    rewardInfoEl.classList.add('hidden');
}

// --- Profile & Leaderboard ---
async function openProfileScreen() {
    const response = await fetch(`/api/profile/${myUsername}`, {
        headers: { 'Authorization': `Bearer ${jwtToken}` }
    });
    
    if (!response.ok) {
        showToast('Profil yüklenemedi.', 'error');
        return;
    }

    const profile = await response.json();
    
    document.getElementById('profile-username').innerText = profile.userId || profile.username;
    document.getElementById('profile-rp').innerText = profile.rankPoints || 0;
    document.getElementById('profile-wins').innerText = profile.wins || 0;
    document.getElementById('profile-losses').innerText = profile.losses || 0;
    document.getElementById('profile-streak').innerText = profile.currentStreak || 0;
    document.getElementById('profile-best-streak').innerText = profile.bestStreak || 0;
    document.getElementById('profile-highest-score').innerText = profile.highestScore || 0;

    const leagues = {
        BRONZE: { min: 0, max: 199, name: 'Bronz', emoji: '🥉' },
        SILVER: { min: 200, max: 499, name: 'Gümüş', emoji: '🥈' },
        GOLD: { min: 500, max: 999, name: 'Altın', emoji: '🥇' },
        PLATINUM: { min: 1000, max: 1999, name: 'Platin', emoji: '💎' },
        DIAMOND: { min: 2000, max: 3499, name: 'Elmas', emoji: '💠' },
        MASTER: { min: 3500, max: Infinity, name: 'Usta', emoji: '👑' }
    };

    let currentLeague = leagues.BRONZE;
    for (const league of Object.values(leagues)) {
        if (profile.rankPoints >= league.min && profile.rankPoints <= league.max) {
            currentLeague = league;
            break;
        }
    }
    
    document.getElementById('profile-league').innerText = `${currentLeague.emoji} ${currentLeague.name}`;

    const achievementsHtml = (profile.achievements || []).map(a => `
        <div class="achievement-item">
            <div class="achievement-name">${a.name}</div>
            <div class="achievement-desc">${a.description}</div>
        </div>
    `).join('');
    
    document.getElementById('achievements-list').innerHTML = achievementsHtml || '<p class="text-muted">Henüz başarım yok.</p>';

    applyTheme(profile.selectedTheme);

    // Kozmetikleri göster
    const themeNames = {
        classic: 'Klasik',
        neon_blue: 'Neon Mavi',
        purple_galaxy: 'Mor Galaksi',
        cyberpunk: 'Cyberpunk',
        gold: 'Altın',
        lavender_world: 'Lav Dünyası'
    };
    
    const effectNames = {
        normal: 'Normal',
        electric: 'Elektrik',
        flame: 'Alev',
        frost: 'Buz',
        starburst: 'Yıldız Patlaması'
    };
    
    const frameNames = {
        bronze: 'Bronz',
        silver: 'Gümüş',
        gold: 'Altın',
        diamond: 'Elmas',
        master: 'Usta'
    };
    
    const badgeNames = {
        first_champion: 'İlk Şampiyon',
        ten_streak: '10 Galibiyet Serisi',
        hundred_matches: '100 Düello',
        top_100: 'İlk 100 Oyuncu'
    };
    
    document.getElementById('profile-theme').innerText = themeNames[profile.selectedTheme] || 'Klasik';
    document.getElementById('profile-effect').innerText = effectNames[profile.selectedEffect] || 'Normal';
    document.getElementById('profile-frame').innerText = profile.selectedFrame ? frameNames[profile.selectedFrame] : 'Yok';
    document.getElementById('profile-badge').innerText = profile.selectedBadge ? badgeNames[profile.selectedBadge] : 'Yok';

    showScreen('profile');
}

async function openLeaderboardScreen() {
    const response = await fetch('/api/leaderboard?limit=50');
    
    if (!response.ok) {
        showToast('Liderlik tablosu yüklenemedi.', 'error');
        return;
    }

    const data = await response.json();
    const users = data.users || [];

    const leagues = {
        BRONZE: { min: 0, max: 199, name: 'Bronz', emoji: '🥉' },
        SILVER: { min: 200, max: 499, name: 'Gümüş', emoji: '🥈' },
        GOLD: { min: 500, max: 999, name: 'Altın', emoji: '🥇' },
        PLATINUM: { min: 1000, max: 1999, name: 'Platin', emoji: '💎' },
        DIAMOND: { min: 2000, max: 3499, name: 'Elmas', emoji: '💠' },
        MASTER: { min: 3500, max: Infinity, name: 'Usta', emoji: '👑' }
    };

    function getLeague(rp) {
        for (const league of Object.values(leagues)) {
            if (rp >= league.min && rp <= league.max) return league;
        }
        return leagues.BRONZE;
    }

    const leaderboardHtml = users.map((user, index) => {
        const league = getLeague(user.rankPoints);
        return `
            <div class="leaderboard-row">
                <div class="lb-rank">${index + 1}</div>
                <div class="lb-user">${user.userId}</div>
                <div class="lb-league">${league.emoji} ${league.name}</div>
                <div class="lb-stats">W: ${user.wins} | L: ${user.losses} | RP: ${user.rankPoints}</div>
            </div>
        `;
    }).join('');

    document.getElementById('leaderboard-table').innerHTML = leaderboardHtml;
    showScreen('leaderboard');
}

// --- Shop Screen ---
let currentShopTab = 'themes';
let shopData = null;

async function openShopScreen() {
    const response = await fetch('/api/shop', {
        headers: { 'Authorization': `Bearer ${jwtToken}` }
    });
    
    if (!response.ok) {
        showToast('Mağaza yüklenemedi.', 'error');
        return;
    }

    shopData = await response.json();
    document.getElementById('shop-coins').innerText = shopData.balance;
    
    currentShopTab = 'themes';
    renderShopTab('themes');
    showScreen('shop');
}

function switchShopTab(tab, button) {
    currentShopTab = tab;
    document.querySelectorAll('.shop-tab').forEach(t => t.classList.remove('active'));
    if (button) button.classList.add('active');
    renderShopTab(tab);
}

function renderShopTab(tab) {
    const content = document.getElementById('shop-content');
    let items = [];
    
    if (tab === 'themes') items = shopData.themes;
    else if (tab === 'effects') items = shopData.effects;
    else if (tab === 'frames') items = shopData.frames;
    else if (tab === 'badges') items = shopData.badges;
    
    const html = items.map(item => {
        const isOwned = item.owned;
        const isSelected = item.selected;
        const isAvailable = item.available !== false;
        let buttonClass = 'btn-primary small-btn';
        let buttonText = item.price > 0 ? `${item.price} 💎` : 'Ücretsiz';
        let buttonAction = `buyCosmeticItem('${tab}', '${item.id}')`;
        let buttonDisabled = false;

        if (!isAvailable) {
            buttonClass = 'btn-disabled small-btn';
            buttonText = 'Kilitli';
            buttonDisabled = true;
        } else if (isOwned) {
            buttonClass = isSelected ? 'btn-success small-btn' : 'btn-secondary small-btn';
            buttonText = isSelected ? '✓ Seçili' : 'Seç';
            buttonAction = `selectCosmeticItem('${tab}', '${item.id}')`;
        }

        return `
            <div class="shop-item">
                <div class="item-header">
                    <span class="item-emoji">${item.emoji}</span>
                    <span class="item-name">${item.name}</span>
                </div>
                <div class="item-desc">${item.description}</div>
                <button class="${buttonClass}" ${buttonDisabled ? 'disabled' : ''} onclick="${buttonDisabled ? '' : buttonAction}">${buttonText}</button>
            </div>
        `;
    }).join('');
    
    content.innerHTML = html;
}

async function buyCosmeticItem(type, itemId) {
    const normalizedType = SHOP_TYPE_MAP[type] || type;
    console.log(`[Shop] Satın alma başladı - Tip: ${type} (${normalizedType}), ürün: ${itemId}`);
    
    const response = await fetch('/api/shop/buy', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify({ type: normalizedType, itemId })
    });
    
    const result = await response.json();
    console.log(`[Shop] Yanıt:`, result);
    
    if (response.ok) {
        showToast(result.message || 'Satın alma başarılı!', 'success');
        await openShopScreen();
    } else {
        const errorMsg = result.error || result.message || 'Satın alma başarısız.';
        console.error(`[Shop] Hata: ${errorMsg}`);
        showToast(errorMsg, 'error');
    }
}

async function selectCosmeticItem(type, itemId) {
    const normalizedType = SHOP_TYPE_MAP[type] || type;
    console.log(`[Shop] Seçim başladı - Tip: ${type} (${normalizedType}), ürün: ${itemId}`);
    
    const response = await fetch('/api/shop/select', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwtToken}`
        },
        body: JSON.stringify({ type: normalizedType, itemId })
    });
    
    const result = await response.json();
    console.log(`[Shop] Yanıt:`, result);
    
    if (response.ok) {
        showToast(result.message || 'Seçim başarılı!', 'success');
        await openShopScreen();
    } else {
        const errorMsg = result.error || result.message || 'Seçim başarısız.';
        console.error(`[Shop] Hata: ${errorMsg}`);
        showToast(errorMsg, 'error');
    }
}

function applyTheme(themeId) {
    const theme = THEME_PALETTES[themeId] || THEME_PALETTES.classic;
    document.documentElement.style.setProperty('--bg-color', theme.bgColor);
    document.documentElement.style.setProperty('--neon-cyan', theme.primary);
    document.documentElement.style.setProperty('--neon-pink', theme.secondary);
}

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

let renderer = null;
