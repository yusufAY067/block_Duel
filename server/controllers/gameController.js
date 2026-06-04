const User = require('../models/User');
const Match = require('../models/Match');
const Room = require('../models/Room');
const { checkAndUnlockAchievements } = require('../constants/achievements');
const { checkAndUnlockBadges, getUserLeague } = require('../constants/cosmetics');

module.exports = {
    async getBalance(username) {
        const user = await User.findOne({ username }).lean();
        return user ? user.coins : 0;
    },

    async updateBalance(username, change) {
        const user = await User.findOne({ username });
        if (user) {
            user.coins += change;
            await user.save();
            return user.coins;
        }
        return 0;
    },

    async recordMatch(playerUsernames, winnerUsername, targetScore, ranked, playerScores = []) {
        try {
            const players = await User.find({ username: { $in: playerUsernames } });
            let winnerId = null;
            if (winnerUsername && winnerUsername !== 'draw') {
                const winner = players.find(p => p.username === winnerUsername);
                if (winner) winnerId = winner._id;
            }

            const playerScoresData = players.map(p => ({
                playerId: p._id,
                finalScore: playerScores.find(ps => ps.username === p.username)?.score || 0
            }));

            const match = new Match({
                players: players.map(p => p._id),
                playerScores: playerScoresData,
                winner: winnerId,
                targetScore,
                ranked
            });
            await match.save();

            // Update player stats for ranked matches
            if (ranked && players.length === 2) {
                const winner = players.find(p => p.username === winnerUsername);
                const loser = players.find(p => p.username !== winnerUsername);

                if (winner) {
                    winner.wins += 1;
                    winner.currentStreak += 1;
                    if (winner.currentStreak > winner.bestStreak) {
                        winner.bestStreak = winner.currentStreak;
                    }
                    winner.rankPoints = Math.max(0, winner.rankPoints + 20);

                    const winnerScore = playerScores.find(ps => ps.username === winner.username)?.score || 0;
                    if (winnerScore > winner.highestScore) {
                        winner.highestScore = winnerScore;
                    }

                    let streakBonus = 0;
                    if (winner.currentStreak === 3) streakBonus = 50;
                    else if (winner.currentStreak === 5) streakBonus = 100;
                    else if (winner.currentStreak === 10) streakBonus = 250;
                    if (streakBonus > 0) {
                        winner.coins += streakBonus;
                    }

                    checkAndUnlockAchievements(winner);
                    checkAndUnlockBadges(winner);
                    
                    if (winnerScore >= 1000 && !winner.achievements.find(a => a.id === 'thousand_score')) {
                        winner.achievements.push({
                            id: 'thousand_score',
                            name: '1000 Puan Ustası',
                            description: 'Tek bir maçta 1000 puan skorunu ulaştı',
                            unlockedAt: new Date()
                        });
                    }
                    if (winnerScore >= 5000 && !winner.achievements.find(a => a.id === 'fivethousand_score')) {
                        winner.achievements.push({
                            id: 'fivethousand_score',
                            name: '5000 Puan Efsanesi',
                            description: 'Tek bir maçta 5000 puan skorunu ulaştı',
                            unlockedAt: new Date()
                        });
                    }

                    await winner.save();

                    const winnerHigherCount = await User.countDocuments({ rankPoints: { $gt: winner.rankPoints } });
                    if (winnerHigherCount < 100 && !winner.ownedBadges.includes('top_100')) {
                        winner.ownedBadges.push('top_100');
                        await winner.save();
                    }
                }

                if (loser) {
                    loser.losses += 1;
                    loser.currentStreak = 0;
                    loser.rankPoints = Math.max(0, loser.rankPoints - 10);
                    checkAndUnlockBadges(loser);
                    await loser.save();

                    const loserHigherCount = await User.countDocuments({ rankPoints: { $gt: loser.rankPoints } });
                    if (loserHigherCount < 100 && !loser.ownedBadges.includes('top_100')) {
                        loser.ownedBadges.push('top_100');
                        await loser.save();
                    }
                }
            }
        } catch (err) {
            console.error("Match recording error:", err);
        }
    },

    async createActiveRoom(roomId, playerUsernames, targetScore, durationMs) {
        try {
            const players = await User.find({ username: { $in: playerUsernames } });
            const room = new Room({
                roomId,
                players: players.map(p => p._id),
                targetScore,
                timer: durationMs,
                status: 'active'
            });
            await room.save();
        } catch (err) {
            console.error("Room creation error:", err);
        }
    },

    async endActiveRoom(roomId) {
        try {
            await Room.findOneAndUpdate({ roomId }, { status: 'completed', timer: 0 });
        } catch (err) {
            console.error("Room end error:", err);
        }
    },

    async getLeaderboard(limit = 50) {
        try {
            const users = await User.find()
                .sort({ rankPoints: -1 })
                .limit(limit)
                .select('userId username rankPoints wins losses highestScore achievements')
                .lean();
            return users;
        } catch (err) {
            console.error("Leaderboard error:", err);
            return [];
        }
    },

    async getProfileStats(username) {
        try {
            const user = await User.findOne({ username });
            return user;
        } catch (err) {
            console.error("Profile stats error:", err);
            return null;
        }
    },

    async getShop(username) {
        try {
            const { THEMES, EFFECTS, FRAMES, BADGES, getAvailableFrames, getAvailableBadges, getUserLeague } = require('../constants/cosmetics');
            const user = await User.findOne({ username });
            if (!user) return null;

            const userLeague = getUserLeague(user);
            const ownedThemes = user.ownedThemes || [];
            const ownedEffects = user.ownedEffects || [];
            const ownedFrames = user.ownedFrames || [];
            const ownedBadges = user.ownedBadges || [];

            const shopData = {
                balance: user.coins,
                league: userLeague,
                themes: Object.values(THEMES).map(theme => ({
                    ...theme,
                    owned: ownedThemes.includes(theme.id),
                    selected: user.selectedTheme === theme.id,
                    available: true
                })),
                effects: Object.values(EFFECTS).map(effect => ({
                    ...effect,
                    owned: ownedEffects.includes(effect.id),
                    selected: user.selectedEffect === effect.id,
                    available: true
                })),
                frames: getAvailableFrames(user).map(frame => ({
                    ...frame,
                    owned: ownedFrames.includes(frame.id),
                    selected: user.selectedFrame === frame.id,
                    available: true
                })),
                badges: getAvailableBadges(user).map(badge => ({
                    ...badge,
                    owned: ownedBadges.includes(badge.id),
                    selected: user.selectedBadge === badge.id,
                    available: true
                }))
            };

            return shopData;
        } catch (err) {
            console.error("Shop error:", err);
            return null;
        }
    },

    async buyCosmeticItem(username, type, itemId) {
        try {
            const { THEMES, EFFECTS, FRAMES, BADGES } = require('../constants/cosmetics');
            const user = await User.findOne({ username });
            if (!user) return { success: false, error: 'Kullanıcı bulunamadı.' };

            const normalizedType = (type || '').toLowerCase().replace(/s$/, '');

            user.ownedThemes = user.ownedThemes || [];
            user.ownedEffects = user.ownedEffects || [];
            user.ownedFrames = user.ownedFrames || [];
            user.ownedBadges = user.ownedBadges || [];

            let item = null;
            let ownedField = null;

            if (normalizedType === 'theme') {
                item = THEMES[itemId];
                ownedField = 'ownedThemes';
            } else if (normalizedType === 'effect') {
                item = EFFECTS[itemId];
                ownedField = 'ownedEffects';
            } else if (normalizedType === 'frame') {
                item = FRAMES[itemId];
                ownedField = 'ownedFrames';
            } else if (normalizedType === 'badge') {
                item = BADGES[itemId];
                ownedField = 'ownedBadges';
            } else {
                return { success: false, error: 'Geçersiz kozmetik türü.' };
            }

            if (!item) {
                console.error(`[Shop] Ürün bulunamadı - tip: ${normalizedType}, id: ${itemId}`);
                return { success: false, error: `Ürün bulunamadı (${itemId}).` };
            }

            const price = typeof item.price === 'number' ? item.price : 0;
            console.log(`[Shop] Ürün bulundu: ${item.name}, fiyat: ${price}, kullanıcı coini: ${user.coins}`);
            
            if (item.minLeague) {
                const { getUserLeague } = require('../constants/cosmetics');
                const leagueOrder = ['BRONZE', 'SILVER', 'GOLD', 'PLATINUM', 'DIAMOND', 'MASTER'];
                const userLeague = getUserLeague(user);
                if (leagueOrder.indexOf(userLeague) < leagueOrder.indexOf(item.minLeague)) {
                    const msg = `${item.name} (${item.minLeague}) - Mevcut lig: ${userLeague}`;
                    console.log(`[Shop] Liga kısıtlaması: ${msg}`);
                    return { success: false, error: msg };
                }
            }

            if (user[ownedField].includes(itemId)) {
                console.log(`[Shop] Ürün zaten sahip: ${itemId}`);
                return { success: false, error: `Zaten '${item.name}' sahibisiniz.` };
            }

            if (price > user.coins) {
                console.log(`[Shop] Yetersiz coin - gerekli: ${price}, var: ${user.coins}`);
                return { success: false, error: `Yetersiz coin. Gerekli: ${price} 💎, Var: ${user.coins} 💎` };
            }

            user.coins -= price;
            user[ownedField].push(itemId);
            await user.save();

            return {
                success: true,
                balance: user.coins,
                message: `${item.name} başarıyla satın alındı!`
            };
        } catch (err) {
            console.error("Buy cosmetic error:", err);
            return { success: false, error: 'Satın alma sırasında hata oluştu.' };
        }
    },

    async selectCosmeticItem(username, type, itemId) {
        try {
            const user = await User.findOne({ username });
            if (!user) return { success: false, error: 'Kullanıcı bulunamadı.' };

            const normalizedType = (type || '').toLowerCase().replace(/s$/, '');
            console.log(`[Shop] Seçim isteği - tip: ${normalizedType}, id: ${itemId}`);

            let selectedField = null;
            let ownedField = null;

            if (normalizedType === 'theme') {
                selectedField = 'selectedTheme';
                ownedField = 'ownedThemes';
            } else if (normalizedType === 'effect') {
                selectedField = 'selectedEffect';
                ownedField = 'ownedEffects';
            } else if (normalizedType === 'frame') {
                selectedField = 'selectedFrame';
                ownedField = 'ownedFrames';
            } else if (normalizedType === 'badge') {
                selectedField = 'selectedBadge';
                ownedField = 'ownedBadges';
            } else {
                console.error(`[Shop] Geçersiz seçim türü: ${type} (${normalizedType})`);
                return { success: false, error: 'Geçersiz kozmetik türü.' };
            }

            if (!user[ownedField]) {
                user[ownedField] = [];
            }
            
            console.log(`[Shop] Sahip olunan ${normalizedType}ler:`, user[ownedField]);
            
            if (!user[ownedField].includes(itemId)) {
                console.log(`[Shop] Ürün sahip değil - ${normalizedType}: ${itemId}`);
                return { success: false, error: `'${itemId}' ürününe sahip değilsiniz.` };
            }

            user[selectedField] = itemId;
            await user.save();
            console.log(`[Shop] Seçim kaydedildi - ${selectedField}: ${itemId}`);

            return { success: true, message: 'Seçim başarıyla kaydedildi.' };
        } catch (err) {
            console.error("Select cosmetic error:", err);
            return { success: false, error: 'Seçim sırasında hata oluştu: ' + err.message };
        }
    }
};
