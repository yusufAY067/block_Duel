const socket = io();

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

socket.on('connect', () => {
    myId = socket.id;
    console.log('Connected with socket ID:', myId);
});

// --- Auth System ---

function login() {
    const username = authUsernameInput.value.trim();
    const password = authPasswordInput.value;
    if (!username || !password) return;
    
    authMsg.innerText = "Giriş yapılıyor...";
    socket.emit('login', { username, password });
}

function register() {
    const username = authUsernameInput.value.trim();
    const password = authPasswordInput.value;
    if (!username || !password) return;
    
    authMsg.innerText = "Kayıt olunuyor...";
    socket.emit('register', { username, password });
}

socket.on('authSuccess', (data) => {
    myUsername = data.username;
    myFullTag = data.fullTag;
    coinBalanceEl.innerText = data.coins;
    
    userDisplay.innerText = data.fullTag;
    userDisplay.classList.remove('hidden');
    friendsToggleBtn.classList.remove('hidden');
    
    myFriends = data.friends || [];
    myFriendRequests = data.friendRequests || [];
    
    renderFriends();
    renderFriendRequests();
    
    showScreen('menu');
});

socket.on('authError', (msg) => {
    authMsg.innerText = msg;
});

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

// --- Social System ---

function toggleSocialPanel() {
    socialPanel.classList.toggle('hidden');
}

function sendFriendRequest() {
    const target = friendTagInput.value.trim();
    if (!target) return;
    socket.emit('addFriend', target);
    friendTagInput.value = '';
}

socket.on('socialSuccess', (msg) => showToast(msg, 'success'));
socket.on('socialError', (msg) => showToast(msg, 'error'));

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
        acceptBtn.onclick = () => socket.emit('respondFriendRequest', { requesterUsername: req.username, accept: true });
        
        const rejectBtn = document.createElement('button');
        rejectBtn.className = 'btn-secondary small-btn';
        rejectBtn.innerText = '✖';
        rejectBtn.onclick = () => socket.emit('respondFriendRequest', { requesterUsername: req.username, accept: false });
        
        actionDiv.appendChild(acceptBtn);
        actionDiv.appendChild(rejectBtn);
        li.appendChild(actionDiv);
        friendRequestsListEl.appendChild(li);
    });
}

socket.on('friendListUpdate', (friends) => {
    myFriends = friends;
    renderFriends();
});

socket.on('friendRequestsUpdate', (requests) => {
    myFriendRequests = requests;
    renderFriendRequests();
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

// --- Challenge System ---
function openChallengeModal(targetUsername) {
    currentChallengeTarget = targetUsername;
    challengeTargetNameEl.innerText = `Hedef: ${targetUsername}`;
    challengeModal.classList.remove('hidden');
    socialPanel.classList.add('hidden'); // hide social panel
}

function closeChallengeModal() {
    challengeModal.classList.add('hidden');
    currentChallengeTarget = null;
}

function confirmSendChallenge() {
    if (!currentChallengeTarget) return;
    
    const score = parseInt(challengeScoreSelect.value);
    const isRanked = challengeRankedSelect.value === 'true';
    
    socket.emit('sendChallenge', {
        targetUsername: currentChallengeTarget,
        targetScore: score,
        isRanked: isRanked
    });
    
    closeChallengeModal();
}

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


// --- Menu Logic ---
function selectScore(score, element) {
    selectedTargetScore = score;
    
    // Remove 'selected' class from all cards
    document.querySelectorAll('.score-card').forEach(el => el.classList.remove('selected'));
    
    // Add to the clicked one
    element.classList.add('selected');
    
    // Enable play button
    playBtn.disabled = false;
}

function startMatch() {
    if (!selectedTargetScore) return;
    socket.emit('joinQueue', selectedTargetScore);
    queueStatusEl.innerText = 'Kuyruğa giriliyor... (Rakip bekleniyor)';
    playBtn.disabled = true;
}

// --- Game Logic ---

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

// Global renderer instance
let renderer = null;

socket.on('matchFound', (data) => {
    currentRoomId = data.roomId;
    showScreen('game');
    
    // Hide panels if open
    socialPanel.classList.add('hidden');
    challengeModal.classList.add('hidden');
    
    // Initialize renderer if not already done
    if (!renderer) {
        renderer = new Renderer();
    }
    
    // Reset UI
    myScoreEl.innerText = '0';
    opponentScoreEl.innerText = '0';
    comboDisplay.classList.add('hidden');
});

socket.on('gameState', (state) => {
    if (!currentRoomId) return;

    // Determine opponent ID dynamically if not set
    if (!opponentId) {
        const ids = Object.keys(state.players);
        opponentId = ids.find(id => id !== myId);
    }

    // Update Timer
    gameTimerEl.innerText = formatTime(state.timeLeft);

    const myState = state.players[myId];
    const opponentState = state.players[opponentId];

    if (myState) {
        // Animate score increment if changed
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

    // Pass state to renderer
    if (renderer) {
        renderer.updateState(myState, opponentState);
    }
});

socket.on('playEffect', (effectData) => {
    // Apply screen shake to the container
    const canvasContainer = document.getElementById('game-canvas');
    canvasContainer.classList.remove('shake');
    void canvasContainer.offsetWidth; // trigger reflow
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

    resultTitle.className = ''; // reset classes
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
