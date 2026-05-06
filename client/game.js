let socket = null;
let jwtToken = null;

// UI Elements
const screens = {
    auth: document.getElementById('auth-screen'),
    menu: document.getElementById('menu-screen'),
    game: document.getElementById('game-screen'),
    result: document.getElementById('result-screen')
};

const coinBalanceEl = document.getElementById('coin-balance');
const queueStatusEl = document.getElementById('queue-status');
const myScoreEl = document.getElementById('my-score');
const opponentScoreEl = document.getElementById('opponent-score');
const gameTimerEl = document.getElementById('game-timer');
const comboDisplay = document.getElementById('combo-display');
const comboCountEl = document.getElementById('combo-count');

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
const challengeRankedSelect = document.getElementById('challenge-ranked-select');

// Game State
let currentRoomId = null;
let myId = null;
let opponentId = null;
let myUsername = null;
let myFullTag = null;
let selectedTargetScore = null;

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

async function fetchFriends() {
    try {
        const res = await fetch('/api/social/friends', {
            headers: { 'Authorization': `Bearer ${jwtToken}` }
        });
        const data = await res.json();
        // Online statuses are sent by socket initially
        myFriends = data.friends;
        renderFriends();
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
        li.innerHTML = `
            <div>
                <span class="friend-status ${f.isOnline ? 'online' : 'offline'}"></span>
                ${f.fullTag}
            </div>
        `;
        if (f.isOnline) {
            const challengeBtn = document.createElement('button');
            challengeBtn.className = 'btn-primary small-btn';
            challengeBtn.innerText = '⚔️ Düello';
            challengeBtn.onclick = () => openChallengeModal(f.username);
            li.appendChild(challengeBtn);
        }
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

    // ... Challenge & Game Listeners ...
    socket.on('challengeReceived', (data) => {
        const typeStr = data.isRanked ? "Coinli (Ranked)" : "Eğlencesine (Unranked)";
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
        if (data.winnerId === myId) {
            resultTitle.innerText = 'ZAFER!';
            resultTitle.classList.add('win-title');
            
            if (data.reward) {
                rewardAmountEl.innerText = data.reward;
                rewardInfoEl.classList.remove('hidden');
            }
        } else if (data.winnerId === 'draw') {
            resultTitle.innerText = 'BERABERE';
            resultTitle.classList.add('draw-title');
            if (data.refund) {
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
    const isRanked = challengeRankedSelect.value === 'true';
    
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

function formatTime(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

let renderer = null;
