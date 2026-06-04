const ACHIEVEMENTS = {
    FIRST_WIN: {
        id: 'first_win',
        name: 'İlk Galibiyet',
        description: 'İlk maçını kazandı'
    },
    TEN_WINS: {
        id: 'ten_wins',
        name: '10 Galibiyet',
        description: '10 maçı kazandı'
    },
    FIFTY_WINS: {
        id: 'fifty_wins',
        name: '50 Galibiyet',
        description: '50 maçı kazandı'
    },
    FIRST_FRIEND: {
        id: 'first_friend',
        name: 'İlk Arkadaş',
        description: 'İlk arkadaşını ekledi'
    },
    THOUSAND_SCORE: {
        id: 'thousand_score',
        name: '1000 Puan Ustası',
        description: 'Tek bir maçta 1000 puan skorunu ulaştı'
    },
    FIVETHOUSAND_SCORE: {
        id: 'fivethousand_score',
        name: '5000 Puan Efsanesi',
        description: 'Tek bir maçta 5000 puan skorunu ulaştı'
    },
    FIVE_STREAK: {
        id: 'five_streak',
        name: '5 Maç Serisi',
        description: '5 maç üst üste kazandı'
    },
    TEN_STREAK: {
        id: 'ten_streak',
        name: '10 Maç Serisi',
        description: '10 maç üst üste kazandı'
    }
};

const LEAGUES = {
    BRONZE: { min: 0, max: 199, name: 'Bronz', emoji: '🥉' },
    SILVER: { min: 200, max: 499, name: 'Gümüş', emoji: '🥈' },
    GOLD: { min: 500, max: 999, name: 'Altın', emoji: '🥇' },
    PLATINUM: { min: 1000, max: 1999, name: 'Platin', emoji: '💎' },
    DIAMOND: { min: 2000, max: 3499, name: 'Elmas', emoji: '💠' },
    MASTER: { min: 3500, max: Infinity, name: 'Usta', emoji: '👑' }
};

function getLeague(rankPoints) {
    for (const league of Object.values(LEAGUES)) {
        if (rankPoints >= league.min && rankPoints <= league.max) {
            return league;
        }
    }
    return LEAGUES.BRONZE;
}

function checkAndUnlockAchievements(user) {
    const newAchievements = [];
    const existingIds = new Set(user.achievements.map(a => a.id));

    if (user.wins === 1 && !existingIds.has(ACHIEVEMENTS.FIRST_WIN.id)) {
        newAchievements.push(ACHIEVEMENTS.FIRST_WIN);
    }
    if (user.wins === 10 && !existingIds.has(ACHIEVEMENTS.TEN_WINS.id)) {
        newAchievements.push(ACHIEVEMENTS.TEN_WINS);
    }
    if (user.wins === 50 && !existingIds.has(ACHIEVEMENTS.FIFTY_WINS.id)) {
        newAchievements.push(ACHIEVEMENTS.FIFTY_WINS);
    }
    if (user.currentStreak === 5 && !existingIds.has(ACHIEVEMENTS.FIVE_STREAK.id)) {
        newAchievements.push(ACHIEVEMENTS.FIVE_STREAK);
    }
    if (user.currentStreak === 10 && !existingIds.has(ACHIEVEMENTS.TEN_STREAK.id)) {
        newAchievements.push(ACHIEVEMENTS.TEN_STREAK);
    }

    user.achievements.push(...newAchievements.map(a => ({
        id: a.id,
        name: a.name,
        description: a.description,
        unlockedAt: new Date()
    })));

    return newAchievements.map(a => a.id);
}

module.exports = {
    ACHIEVEMENTS,
    LEAGUES,
    getLeague,
    checkAndUnlockAchievements
};
