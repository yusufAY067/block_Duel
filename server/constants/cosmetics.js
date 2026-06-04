// Tema Sistemi
const THEMES = {
    classic: {
        id: 'classic',
        name: 'Klasik',
        description: 'Orijinal Block Duel teması',
        price: 0,
        bgColor: '#0B0F19',
        primary: '#00F0FF',
        secondary: '#FF007F',
        emoji: '📱'
    },
    neon_blue: {
        id: 'neon_blue',
        name: 'Neon Mavi',
        description: 'Parlak neon mavisi tema',
        price: 1000,
        bgColor: '#0a0e27',
        primary: '#00D4FF',
        secondary: '#0099FF',
        emoji: '🔵'
    },
    purple_galaxy: {
        id: 'purple_galaxy',
        name: 'Mor Galaksi',
        description: 'Uzay-temalı mor palet',
        price: 2500,
        bgColor: '#1a0033',
        primary: '#DD00FF',
        secondary: '#8A2BE2',
        emoji: '🪐'
    },
    cyberpunk: {
        id: 'cyberpunk',
        name: 'Cyberpunk',
        description: 'Futuristik neon tema',
        price: 5000,
        bgColor: '#0d0221',
        primary: '#FF006E',
        secondary: '#00D4FF',
        emoji: '🤖'
    },
    gold: {
        id: 'gold',
        name: 'Altın',
        description: 'Prestijli altın renkli tema',
        price: 10000,
        bgColor: '#1a1500',
        primary: '#FFD700',
        secondary: '#FFA500',
        emoji: '👑'
    },
    lavender_world: {
        id: 'lavender_world',
        name: 'Lav Dünyası',
        description: 'Sakin lav rengili tema',
        price: 15000,
        bgColor: '#2d1b4e',
        primary: '#E6B3FF',
        secondary: '#C77DFF',
        emoji: '🌸'
    }
};

// Efekt Sistemi
const EFFECTS = {
    normal: {
        id: 'normal',
        name: 'Normal',
        description: 'Standart efekt',
        price: 0,
        emoji: '✨'
    },
    electric: {
        id: 'electric',
        name: 'Elektrik',
        description: 'Elektrik efekti ile parlayan bloklar',
        price: 500,
        emoji: '⚡'
    },
    flame: {
        id: 'flame',
        name: 'Alev',
        description: 'Ateş efekti ile yanıp sönen bloklar',
        price: 500,
        emoji: '🔥'
    },
    frost: {
        id: 'frost',
        name: 'Buz',
        description: 'Buz efekti ile dönerken dönen bloklar',
        price: 500,
        emoji: '❄️'
    },
    starburst: {
        id: 'starburst',
        name: 'Yıldız Patlaması',
        description: 'Yıldız patlaması efekti ile parıldayan bloklar',
        price: 500,
        emoji: '💫'
    }
};

// Profil Çerçeveleri
const FRAMES = {
    bronze: {
        id: 'bronze',
        name: 'Bronz',
        description: 'Bronz ligi rozetleri için çerçeve',
        price: 0,
        minLeague: 'BRONZE',
        emoji: '🥉',
        borderColor: '#CD7F32'
    },
    silver: {
        id: 'silver',
        name: 'Gümüş',
        description: 'Gümüş ligi rozetleri için çerçeve',
        price: 0,
        minLeague: 'SILVER',
        emoji: '🥈',
        borderColor: '#C0C0C0'
    },
    gold: {
        id: 'gold',
        name: 'Altın',
        description: 'Altın ligi rozetleri için çerçeve',
        price: 0,
        minLeague: 'GOLD',
        emoji: '🥇',
        borderColor: '#FFD700'
    },
    diamond: {
        id: 'diamond',
        name: 'Elmas',
        description: 'Elmas ligi rozetleri için çerçeve',
        price: 0,
        minLeague: 'DIAMOND',
        emoji: '💎',
        borderColor: '#B9F3FC'
    },
    master: {
        id: 'master',
        name: 'Usta',
        description: 'Usta ligi rozetleri için çerçeve',
        price: 0,
        minLeague: 'MASTER',
        emoji: '👑',
        borderColor: '#FFD700'
    }
};

// Rozet Sistemi
const BADGES = {
    first_champion: {
        id: 'first_champion',
        name: 'İlk Şampiyon',
        description: 'İlk maçını kazandı',
        price: 0,
        minLeague: 'BRONZE',
        condition: (user) => user.wins >= 1,
        emoji: '🏆'
    },
    ten_streak: {
        id: 'ten_streak',
        name: '10 Galibiyet Serisi',
        description: '10 maç üst üste kazandı',
        price: 0,
        minLeague: 'GOLD',
        condition: (user) => user.bestStreak >= 10,
        emoji: '🔥'
    },
    hundred_matches: {
        id: 'hundred_matches',
        name: '100 Düello',
        description: '100 maça katıldı',
        price: 0,
        minLeague: 'SILVER',
        condition: (user) => (user.wins + user.losses) >= 100,
        emoji: '⚔️'
    },
    top_100: {
        id: 'top_100',
        name: 'İlk 100 Oyuncu',
        description: 'Liderlikte ilk 100\'de yer aldı',
        price: 0,
        minLeague: 'MASTER',
        condition: null, // Server tarafından elle verilir
        emoji: '🌟'
    }
};

module.exports = {
    THEMES,
    EFFECTS,
    FRAMES,
    BADGES,
    
    // Yardımcı fonksiyonlar
    getTheme: (themeId) => THEMES[themeId],
    getEffect: (effectId) => EFFECTS[effectId],
    getFrame: (frameId) => FRAMES[frameId],
    getBadge: (badgeId) => BADGES[badgeId],
    
    getUserLeague: (user) => {
        if (!user || typeof user.rankPoints !== 'number') return 'BRONZE';
        if (user.rankPoints >= 3500) return 'MASTER';
        if (user.rankPoints >= 2000) return 'DIAMOND';
        if (user.rankPoints >= 1000) return 'PLATINUM';
        if (user.rankPoints >= 500) return 'GOLD';
        if (user.rankPoints >= 200) return 'SILVER';
        return 'BRONZE';
    },
    
    // Kullanıcıya göre açılabilir çerçeveler
    getAvailableFrames: (user) => {
        const leagueMap = {
            'BRONZE': 0,
            'SILVER': 1,
            'GOLD': 2,
            'PLATINUM': 2.5,
            'DIAMOND': 3,
            'MASTER': 4
        };
        
        let userTier = 0;
        for (const [league, tier] of Object.entries(leagueMap)) {
            const tierRanges = {
                'BRONZE': { min: 0, max: 199 },
                'SILVER': { min: 200, max: 499 },
                'GOLD': { min: 500, max: 999 },
                'PLATINUM': { min: 1000, max: 1999 },
                'DIAMOND': { min: 2000, max: 3499 },
                'MASTER': { min: 3500, max: Infinity }
            };
            if (user.rankPoints >= tierRanges[league].min && user.rankPoints <= tierRanges[league].max) {
                userTier = tier;
                break;
            }
        }
        
        return Object.values(FRAMES).filter(frame => {
            const frameTierMap = {
                'bronze': 0,
                'silver': 1,
                'gold': 2,
                'diamond': 3,
                'master': 4
            };
            return frameTierMap[frame.id] <= userTier;
        });
    },

    getAvailableBadges: (user) => {
        const userLeague = module.exports.getUserLeague(user);
        return Object.values(BADGES).filter(badge => {
            if (!badge.minLeague) return true;
            const leagueOrder = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'MASTER'];
            return leagueOrder.indexOf(userLeague) >= leagueOrder.indexOf(badge.minLeague);
        });
    },
    
    // Rozet kontrolü
    checkAndUnlockBadges: (user) => {
        const newBadges = [];
        
        for (const [badgeId, badge] of Object.entries(BADGES)) {
            if (badge.condition && !user.ownedBadges.includes(badgeId)) {
                if (badge.condition(user)) {
                    newBadges.push(badgeId);
                }
            }
        }
        
        user.ownedBadges = [...new Set([...user.ownedBadges, ...newBadges])];
        return newBadges;
    }
};
