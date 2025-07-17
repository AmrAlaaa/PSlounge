class PlayStationCalculator {
    constructor() {
        this.singlePrice = 60;
        this.multiPrice = 80;
        this.sessionStartTime = null;
        this.currentMode = 'single';
        this.selectedPlayers = [];
        this.activePlayers = [];
        this.sessionHistory = [];
        this.timers = {
            total: 0,
            single: 0,
            multi: 0
        };
        this.lastModeChangeTime = null;
        this.sessionInterval = null;
        this.currentAction = null;
        this.currentActionData = null;
        this.currentSessionId = null;
        this.isConnected = false;
        
        this.initializeFirebase();
        this.initializeEventListeners();
        this.updatePlayerDropdowns();
        this.checkActiveSession();
        this.initializeStartMode();
    }

    initializeFirebase() {
        // Monitor connection status
        const connectedRef = firebase.database().ref('.info/connected');
        connectedRef.on('value', (snap) => {
            this.isConnected = snap.val() === true;
            this.updateConnectionStatus();
            
            if (this.isConnected && this.currentSessionId) {
                this.syncSessionData();
            }
        });
    }

    updateConnectionStatus() {
        const statusElement = document.getElementById('connectionStatus');
        const dot = statusElement.querySelector('.connection-dot');
        const text = statusElement.querySelector('.connection-text');
        
        statusElement.className = 'connection-status';
        
        if (this.isConnected) {
            statusElement.classList.add('connected');
            text.textContent = 'Connected';
        } else {
            statusElement.classList.add('disconnected');
            text.textContent = 'Disconnected - Working offline';
        }
    }

    checkActiveSession() {
        this.showLoading(true);
        
        database.ref('sessions').orderByChild('active').equalTo(true).once('value')
            .then((snapshot) => {
                if (snapshot.exists()) {
                    const sessionData = snapshot.val();
                    const sessionId = Object.keys(sessionData)[0];
                    document.getElementById('loadActiveSession').classList.remove('hidden');
                    
                    document.getElementById('loadSessionBtn').addEventListener('click', () => {
                        this.loadSession(sessionId);
                    });
                }
                this.showLoading(false);
            })
            .catch((error) => {
                console.error("Error checking active session:", error);
                this.showLoading(false);
            });
    }

    loadSession(sessionId) {
    this.showLoading(true);
    this.currentSessionId = sessionId;
    
    database.ref(`sessions/${sessionId}`).once('value')
        .then((snapshot) => {
            const sessionData = snapshot.val();
            this.singlePrice = sessionData.singlePrice;
            this.multiPrice = sessionData.multiPrice;
            this.currentMode = sessionData.currentMode;
            this.sessionStartTime = new Date(sessionData.startTime);
            this.lastModeChangeTime = new Date(sessionData.lastModeChangeTime);
            this.sessionHistory = sessionData.history || [];
            
            // Convert players object to array
            this.activePlayers = sessionData.players ? Object.values(sessionData.players) : [];
            
            // Initialize timers
            this.timers = {
                total: 0,
                single: 0,
                multi: 0
            };
            
            // Calculate initial times from history
            const now = new Date();
            this.sessionHistory.forEach(period => {
                const start = new Date(period.startTime);
                const end = period.endTime ? new Date(period.endTime) : now;
                const duration = Math.floor((end - start) / 1000);
                
                if (period.mode === 'single') {
                    this.timers.single += duration;
                } else {
                    this.timers.multi += duration;
                }
                this.timers.total += duration;
            });
            
            // Update UI
            document.getElementById('singlePrice').value = this.singlePrice;
            document.getElementById('multiPrice').value = this.multiPrice;
            this.showPage('sessionPage');
            this.updatePlayerDropdowns();
            this.updateSessionDisplay();
            this.startTimer();
            
            // Set up real-time listener
            this.setupSessionListener();
            this.showLoading(false);
        })
        .catch((error) => {
            console.error("Error loading session:", error);
            this.showLoading(false);
        });

    
    }

    setupSessionListener() {
        if (!this.currentSessionId) return;
        
        database.ref(`sessions/${this.currentSessionId}`).on('value', (snapshot) => {
            const sessionData = snapshot.val();
            if (!sessionData || !sessionData.active) {
                // Session was ended elsewhere
                if (this.sessionInterval) {
                    clearInterval(this.sessionInterval);
                }
                this.reset();
                this.showPage('startPage');
                return;
            }
            
            this.currentMode = sessionData.currentMode;
            this.lastModeChangeTime = new Date(sessionData.lastModeChangeTime);
            this.sessionHistory = sessionData.history || [];
            this.activePlayers = sessionData.players ? Object.values(sessionData.players) : [];
            
            this.updateSessionDisplay();
        });
    }

    // Add to your class methods
    setStartMode(mode) {
    this.startingMode = mode;
    document.getElementById('startSingleModeBtn').classList.toggle('active', mode === 'single');
    document.getElementById('startMultiModeBtn').classList.toggle('active', mode === 'multi');
    }

    initializeStartMode() {
    this.startingMode = 'single'; // Default mode
    document.getElementById('startSingleModeBtn').addEventListener('click', () => {
        this.setStartMode('single');
        });
    document.getElementById('startMultiModeBtn').addEventListener('click', () => {
        this.setStartMode('multi');
        });
    }

    initializeEventListeners() {
        // Start page events
        document.getElementById('addPlayerBtn').addEventListener('click', () => this.addPlayerToSelection());
        document.getElementById('startSessionBtn').addEventListener('click', () => this.startSession());
        document.getElementById('playerSelect').addEventListener('change', () => this.updateAddButton());

        // Session page events
        document.getElementById('singleModeBtn').addEventListener('click', () => this.confirmModeChange('single'));
        document.getElementById('multiModeBtn').addEventListener('click', () => this.confirmModeChange('multi'));
        document.getElementById('addPlayerSessionBtn').addEventListener('click', () => this.addPlayerToSession());
        document.getElementById('endSessionBtn').addEventListener('click', () => this.confirmEndSession());
        document.getElementById('newSessionBtn').addEventListener('click', () => this.confirmNewSession());

        // Summary page events
        document.getElementById('newSessionFromSummaryBtn').addEventListener('click', () => this.newSession());

        // Modal events
        document.getElementById('confirmYes').addEventListener('click', () => this.executeConfirmedAction());
        document.getElementById('confirmNo').addEventListener('click', () => this.closeModal());
        
        // Add event listener for modal background click to close
        document.getElementById('confirmModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('confirmModal')) {
                this.closeModal();
            }
        });

    
    }

    showLoading(show) {
        if (show) {
            if (!document.getElementById('loadingOverlay')) {
                const overlay = document.createElement('div');
                overlay.id = 'loadingOverlay';
                overlay.className = 'loading';
                overlay.innerHTML = '<div class="loading-spinner"></div>';
                document.body.appendChild(overlay);
            }
        } else {
            const overlay = document.getElementById('loadingOverlay');
            if (overlay) {
                overlay.remove();
            }
        }
    }

    updateAddButton() {
        const select = document.getElementById('playerSelect');
        const btn = document.getElementById('addPlayerBtn');
        btn.disabled = !select.value || this.selectedPlayers.includes(select.value);
    }

    addPlayerToSelection() {
        const select = document.getElementById('playerSelect');
        const player = select.value;
        
        if (player && !this.selectedPlayers.includes(player)) {
            this.selectedPlayers.push(player);
            this.updateSelectedPlayersDisplay();
            this.updateStartButton();
            select.value = '';
            this.updateAddButton();
        }
    }

    updateSelectedPlayersDisplay() {
        const container = document.getElementById('selectedPlayers');
        const tagsContainer = document.getElementById('playerTags');
        
        if (this.selectedPlayers.length > 0) {
            container.classList.remove('hidden');
            tagsContainer.innerHTML = this.selectedPlayers.map(player => 
                `<span class="player-tag">${player}</span>`
            ).join('');
        } else {
            container.classList.add('hidden');
        }
    }

    updateStartButton() {
        const btn = document.getElementById('startSessionBtn');
        btn.disabled = this.selectedPlayers.length < 2;
    }

    startSession() {
    this.singlePrice = parseFloat(document.getElementById('singlePrice').value);
    this.multiPrice = parseFloat(document.getElementById('multiPrice').value);
    
    this.sessionStartTime = new Date();
    this.lastModeChangeTime = new Date();
    this.currentMode = this.startingMode; // Use the selected starting mode
    
    // Initialize active players
    this.activePlayers = this.selectedPlayers.map(name => ({
        name: name,
        joinTime: new Date(),
        active: true,
        totalTime: 0,
        cost: 0
    }));

    // Add initial period with the selected mode
    this.sessionHistory = [{
        startTime: new Date(),
        mode: this.startingMode, // Use the selected starting mode
        players: [...this.selectedPlayers]
    }];

    // Create session in Firebase
    this.createFirebaseSession();
    }

    createFirebaseSession() {
        this.showLoading(true);
        
        // Generate unique session ID
        this.currentSessionId = database.ref('sessions').push().key;
        
        const sessionData = {
            active: true,
            singlePrice: this.singlePrice,
            multiPrice: this.multiPrice,
            currentMode: this.currentMode,
            startTime: this.sessionStartTime.toISOString(),
            lastModeChangeTime: this.lastModeChangeTime.toISOString(),
            players: {},
            history: this.sessionHistory.map(period => ({
                ...period,
                startTime: period.startTime.toISOString(),
                endTime: period.endTime ? period.endTime.toISOString() : null
            }))
        };
        
        // Convert players array to object
        this.activePlayers.forEach(player => {
            sessionData.players[player.name] = {
                ...player,
                joinTime: player.joinTime.toISOString()
            };
        });
        
        database.ref(`sessions/${this.currentSessionId}`).set(sessionData)
            .then(() => {
                this.showPage('sessionPage');
                this.updatePlayerDropdowns();
                this.updateSessionDisplay();
                this.startTimer();
                this.setupSessionListener();
                this.showLoading(false);
            })
            .catch((error) => {
                console.error("Error creating session:", error);
                this.showLoading(false);
            });
    }

    syncSessionData() {
    if (!this.currentSessionId) return;
    
    const sessionData = {
        currentMode: this.currentMode,
        lastModeChangeTime: this.lastModeChangeTime.toISOString(),
        players: {},
        history: this.sessionHistory.map(period => {
            // Ensure we're working with Date objects
            const startTime = period.startTime instanceof Date ? period.startTime : new Date(period.startTime);
            const endTime = period.endTime ? 
                (period.endTime instanceof Date ? period.endTime : new Date(period.endTime)) : 
                null;
            
            return {
                ...period,
                startTime: startTime.toISOString(),
                endTime: endTime ? endTime.toISOString() : null
            };
        })
    };
    
    // Convert players array to object
    this.activePlayers.forEach(player => {
        sessionData.players[player.name] = {
            ...player,
            joinTime: new Date(player.joinTime).toISOString()
        };
    });
    
    database.ref(`sessions/${this.currentSessionId}`).update(sessionData)
        .catch((error) => {
            console.error("Error syncing session:", error);
        });
    }

    // Add this method to your PlayStationCalculator class
    safeToDate(value) {
    if (value instanceof Date) return value;
    if (typeof value === 'string') return new Date(value);
    return new Date(); // fallback to current date
    }

    // Add to your class
    showSessionInfo() {
    if (this.currentSessionId) {
        document.getElementById('sessionInfo').classList.remove('hidden');
        document.getElementById('currentSessionIdDisplay').textContent = 
            `Session: ${this.currentSessionId.substring(0, 8)}...`;
    } else {
        document.getElementById('sessionInfo').classList.add('hidden');
    }
    }


    startTimer() {
    if (this.sessionInterval) {
        clearInterval(this.sessionInterval);
    }
    
    // Initialize timers based on existing history
    this.timers = {
        total: 0,
        single: 0,
        multi: 0
    };
    
    // Calculate initial times from history
    const now = new Date();
    this.sessionHistory.forEach(period => {
        const start = new Date(period.startTime);
        const end = period.endTime ? new Date(period.endTime) : now;
        const duration = Math.floor((end - start) / 1000);
        
        if (period.mode === 'single') {
            this.timers.single += duration;
        } else {
            this.timers.multi += duration;
        }
    });
    
    this.sessionInterval = setInterval(() => {
        const now = new Date();
        const totalMs = now - this.sessionStartTime;
        
        this.timers.total = Math.floor(totalMs / 1000);
        
        // Update current mode timer
        if (this.currentMode === 'single') {
            this.timers.single += 1;
        } else {
            this.timers.multi += 1;
        }
        
        // Update active players
        this.updateActivePlayers();
        this.updateSessionDisplay();
        
        // Sync with Firebase periodically
        if (this.isConnected && this.currentSessionId && this.timers.total % 10 === 0) {
            this.syncSessionData();
        }
    }, 1000);
    }

    updateActivePlayers() {
    const now = new Date();
    
    this.activePlayers.forEach(player => {
        const totalMs = now - new Date(player.joinTime);
        player.totalTime = Math.floor(totalMs / 1000);
        // Initialize cost if it doesn't exist
        player.cost = player.cost || 0;
        // Calculate new cost and add to existing
        player.cost += this.calculatePlayerCost(player.name, now) - (player.cost || 0);
    });
    }

    getPlayerBreakdown(playerName) {
    const breakdown = [];
    
    this.sessionHistory.forEach(period => {
        if (period.players.includes(playerName)) {
            const periodStart = period.startTime instanceof Date ? period.startTime : new Date(period.startTime);
            const periodEnd = period.endTime ? 
                (period.endTime instanceof Date ? period.endTime : new Date(period.endTime)) : 
                new Date();
            const periodHours = (periodEnd - periodStart) / (1000 * 60 * 60);
            const pricePerHour = period.mode === 'single' ? this.singlePrice : this.multiPrice;
            const periodCost = (pricePerHour * periodHours) / period.players.length;
            
            breakdown.push({
                mode: period.mode,
                startTime: periodStart,
                endTime: periodEnd,
                duration: periodHours,
                cost: periodCost,
                pricePerHour: pricePerHour,
                playerCount: period.players.length
            });
        }
    });
    
    return breakdown;
    }

    calculatePlayerCost(playerName, currentTime) {
    let totalCost = 0;
    const now = currentTime || new Date();
    
    this.sessionHistory.forEach(period => {
        if (period.players.includes(playerName)) {
            const startTime = new Date(period.startTime);
            const endTime = period.endTime ? new Date(period.endTime) : now;
            const durationHours = (endTime - startTime) / (1000 * 60 * 60);
            const pricePerHour = period.mode === 'single' ? this.singlePrice : this.multiPrice;
            const periodCost = (pricePerHour * durationHours) / period.players.length;
            totalCost += periodCost;
        }
    });

    return totalCost;
    }

    confirmModeChange(newMode) {
        if (newMode === this.currentMode) return;
        
        this.currentAction = 'modeChange';
        this.currentActionData = { newMode };
        this.showConfirmModal(
            'Change Game Mode',
            `Switch from ${this.currentMode} mode to ${newMode} mode?`
        );
    }

    changeModeConfirmed(newMode) {
    // End current period
    const currentPeriod = this.sessionHistory[this.sessionHistory.length - 1];
    if (currentPeriod && !currentPeriod.endTime) {
        currentPeriod.endTime = new Date();
    }

    // Start new period
    this.currentMode = newMode;
    this.lastModeChangeTime = new Date();
    
    this.sessionHistory.push({
        startTime: new Date(),
        mode: newMode,
        players: [...this.activePlayers.filter(p => p.active).map(p => p.name)]
    });

    this.updateSessionDisplay();
    this.syncSessionData();
    }

    addPlayerToSession() {
        const select = document.getElementById('addPlayerSelect');
        const playerName = select.value;
        
        if (playerName) {
            const existingPlayer = this.activePlayers.find(p => p.name === playerName);
            const newPlayer = existingPlayer || {
                name: playerName,
                joinTime: new Date(),
                active: true
            };
            
            if (!existingPlayer) {
                this.activePlayers.push(newPlayer);
            } else {
                existingPlayer.active = true;
            }
            
            // End current period and start new one with added player
            const currentPeriod = this.sessionHistory[this.sessionHistory.length - 1];
            if (currentPeriod && !currentPeriod.endTime) {
                currentPeriod.endTime = new Date();
            }

            this.lastModeChangeTime = new Date();
            this.sessionHistory.push({
                startTime: new Date(),
                mode: this.currentMode,
                players: [...this.activePlayers.filter(p => p.active).map(p => p.name)]
            });

            select.value = '';
            this.updatePlayerDropdowns();
            this.updateSessionDisplay();
            this.syncSessionData();
        }
    }

    confirmRemovePlayer(playerName) {
        const player = this.activePlayers.find(p => p.name === playerName);
        if (!player) return;
        
        const finalCost = this.calculatePlayerCost(playerName);
        const breakdown = this.getPlayerBreakdown(playerName);
        
        this.currentAction = 'removePlayer';
        this.currentActionData = { playerName };
        
        // Show detailed payment breakdown
        this.showPlayerPaymentModal(playerName, finalCost, breakdown);
    }

    showPlayerPaymentModal(playerName, totalCost, breakdown) {
    const modal = document.getElementById('confirmModal');
    const title = document.getElementById('confirmTitle');
    const message = document.getElementById('confirmMessage');
    
    title.textContent = `${playerName} - Payment Due`;
    
    let breakdownHTML = `
        <div class="modal-body">
            <div style="text-align: left; margin-bottom: 20px;">
                <strong>Total Amount: ${totalCost.toFixed(2)} EGP</strong>
                <br><br>
                <strong>Payment Breakdown:</strong>
                <div style="font-size: 0.9rem; margin-top: 10px;">
    `;
    
    breakdown.forEach((period, index) => {
        const startTime = period.startTime.toLocaleTimeString();
        const endTime = period.endTime ? period.endTime.toLocaleTimeString() : 'Now';
        const duration = this.formatTime(Math.floor((period.endTime || new Date() - period.startTime) / 1000));
        
        breakdownHTML += `
            <div style="margin: 8px 0; padding: 8px; background: rgba(0,0,0,0.05); border-radius: 8px;">
                <strong>${period.mode.charAt(0).toUpperCase() + period.mode.slice(1)} Mode:</strong> ${period.cost.toFixed(2)} EGP<br>
                <small>⏰ ${startTime} - ${endTime} (${duration})</small><br>
                <small>👥 Split with ${period.playerCount} players</small>
            </div>
        `;
    });
    
    breakdownHTML += `
                </div>
            </div>
        </div>
    `;
    
    message.innerHTML = breakdownHTML;
    modal.style.display = 'block';
    
    // Scroll to top when modal opens
    message.scrollTop = 0;
    }

    removePlayerConfirmed(playerName) {
        // Mark player as inactive rather than removing
        const player = this.activePlayers.find(p => p.name === playerName);
        if (player) {
            player.active = false;
        }
        
        // End current period
        const currentPeriod = this.sessionHistory[this.sessionHistory.length - 1];
        if (currentPeriod && !currentPeriod.endTime) {
            currentPeriod.endTime = new Date();
        }

        // Check if we have enough active players to continue
        const activeCount = this.activePlayers.filter(p => p.active).length;
        if (activeCount < 2) {
            this.endSession();
            return;
        }

        // Start new period without removed player
        this.lastModeChangeTime = new Date();
        this.sessionHistory.push({
            startTime: new Date(),
            mode: this.currentMode,
            players: [...this.activePlayers.filter(p => p.active).map(p => p.name)]
        });

        this.updatePlayerDropdowns();
        this.updateSessionDisplay();
        this.syncSessionData();
    }

    confirmEndSession() {
        this.currentAction = 'endSession';
        this.currentActionData = {};
        this.showConfirmModal(
            'End Session',
            'Are you sure you want to end the current session?'
        );
    }

    confirmNewSession() {
        this.currentAction = 'newSession';
        this.currentActionData = {};
        this.showConfirmModal(
            'New Session',
            'Are you sure you want to start a new session? Current session will be lost.'
        );
    }

    endSession() {
    // Ensure current period is properly ended
    const now = new Date();
    const currentPeriod = this.sessionHistory[this.sessionHistory.length - 1];
    if (currentPeriod && !currentPeriod.endTime) {
        currentPeriod.endTime = now;
    }

    // Process all dates to ensure they're Date objects
    const processedHistory = this.sessionHistory.map(period => ({
        mode: period.mode,
        players: period.players,
        startTime: this.safeToDate(period.startTime),
        endTime: period.endTime ? this.safeToDate(period.endTime) : now
    }));

    // Process player join times
    const processedPlayers = this.activePlayers.map(player => ({
        ...player,
        joinTime: this.safeToDate(player.joinTime)
    }));

    // Prepare data for Firebase
    const sessionDataForFirebase = {
        sessionHistory: processedHistory.map(period => ({
            ...period,
            startTime: period.startTime.toISOString(),
            endTime: period.endTime.toISOString()
        })),
        activePlayers: processedPlayers.map(player => ({
            ...player,
            joinTime: player.joinTime.toISOString()
        }))
    };

    // Save to Firebase
    if (this.currentSessionId) {
        database.ref(`sessions/${this.currentSessionId}`).update({
            active: false,
            finalData: sessionDataForFirebase
        }).catch(console.error);
    }

    // Update our local references with processed data
    this.sessionHistory = processedHistory;
    this.activePlayers = processedPlayers;

    clearInterval(this.sessionInterval);
    this.generateSummary(false);
    this.showPage('summaryPage');
    }

    newSession() {
        this.reset();
        this.showPage('startPage');
    }

    reset() {
        if (this.sessionInterval) {
            clearInterval(this.sessionInterval);
        }
        
        this.selectedPlayers = [];
        this.activePlayers = [];
        this.sessionHistory = [];
        this.timers = { total: 0, single: 0, multi: 0 };
        this.sessionStartTime = null;
        this.lastModeChangeTime = null;
        this.currentMode = 'single';
        this.currentSessionId = null;
        
        this.updateSelectedPlayersDisplay();
        this.updateStartButton();
        this.updatePlayerDropdowns();
    }

    generateSummary() {
    const summaryContainer = document.getElementById('finalSummary');
    
    // Process all dates to ensure they're Date objects
    const processedHistory = this.sessionHistory.map(period => ({
        mode: period.mode,
        players: period.players,
        startTime: this.safeToDate(period.startTime),
        endTime: period.endTime ? this.safeToDate(period.endTime) : new Date()
    }));

    const processedPlayers = this.activePlayers.map(player => ({
        ...player,
        joinTime: this.safeToDate(player.joinTime)
    }));

    let totalSessionCost = 0;
    const allPlayers = new Set();
    
    // // Determine which data source to use
    // const dataSource = isHistorical ? this.tempSessionData : {
    //     sessionHistory: this.sessionHistory,
    //     activePlayers: this.activePlayers,
    //     singlePrice: this.singlePrice,
    //     multiPrice: this.multiPrice
    // };

    // if (!dataSource || !dataSource.sessionHistory) {
    //     summaryContainer.innerHTML = '<div class="no-data">No session data available</div>';
    //     return;
    // }

    // Collect all players
    processedHistory.forEach(period => {
        period.players.forEach(player => allPlayers.add(player));
    });

    // Fallback to active players if no history
    if (allPlayers.size === 0 && processedPlayers.length > 0) {
        processedPlayers.forEach(player => allPlayers.add(player.name));
    }

    const playerSummaries = [];
    const now = new Date();
    
    allPlayers.forEach(playerName => {
        const breakdown = [];
        let playerTotalCost = 0;
        let playerTotalTime = 0;
        
        processedHistory.forEach(period => {
            if (period.players.includes(playerName)) {
                const startTime = period.startTime;
                const endTime = period.endTime || now;
                const durationMs = endTime - startTime;
                const durationHours = durationMs / (1000 * 60 * 60);
                const pricePerHour = period.mode === 'single' ? this.singlePrice : this.multiPrice;
                const periodCost = (pricePerHour * durationHours) / period.players.length;
                
                breakdown.push({
                    mode: period.mode,
                    startTime: startTime,
                    endTime: endTime,
                    duration: durationHours,
                    cost: periodCost,
                    playerCount: period.players.length
                });
                
                playerTotalCost += periodCost;
                playerTotalTime += durationMs;
            }
        });
        
        // If no breakdown but player was active
        if (breakdown.length === 0) {
            const player = processedPlayers.find(p => p.name === playerName);
            if (player) {
                const durationMs = now - player.joinTime;
                const durationHours = durationMs / (1000 * 60 * 60);
                const pricePerHour = this.currentMode === 'single' ? this.singlePrice : this.multiPrice;
                const periodCost = (pricePerHour * durationHours) / processedPlayers.length;
                
                breakdown.push({
                    mode: this.currentMode,
                    startTime: player.joinTime,
                    endTime: now,
                    duration: durationHours,
                    cost: periodCost,
                    playerCount: processedPlayers.length
                });
                
                playerTotalCost = periodCost;
                playerTotalTime = durationMs;
            }
        }
        
        totalSessionCost += playerTotalCost;
        playerSummaries.push({
            name: playerName,
            cost: playerTotalCost,
            time: playerTotalTime,
            breakdown: breakdown
        });
    });

    // Generate HTML
    let summaryHTML = '';
    
    if (playerSummaries.length === 0) {
        summaryHTML = `
            <div class="no-session-data">
                <p>No session data available</p>
                <p>Current Session ID: ${this.currentSessionId || 'None'}</p>
            </div>
        `;
    } else {
        // Sort by cost (highest first)
        playerSummaries.sort((a, b) => b.cost - a.cost);

        playerSummaries.forEach(player => {
            summaryHTML += `
                <div class="summary-item">
                    <div class="player-name">${player.name}</div>
                    <div class="player-cost">${player.cost.toFixed(2)} EGP</div>
                    <div class="player-stats">
                        Total time: ${this.formatTime(player.time / 1000)} | 
                        Periods: ${player.breakdown.length}
                    </div>
                    <div class="breakdown-details" style="margin-top: 10px; font-size: 0.85rem;">
                        <strong>Payment Breakdown:</strong>
            `;
            
            player.breakdown.forEach(period => {
                summaryHTML += `
                    <div style="margin: 5px 0; padding: 5px; background: rgba(0,0,0,0.05); border-radius: 5px;">
                        <strong>${period.mode.charAt(0).toUpperCase() + period.mode.slice(1)}:</strong> ${period.cost.toFixed(2)} EGP
                        <br><small>⏰ ${period.startTime.toLocaleTimeString()} - ${period.endTime.toLocaleTimeString()} (${this.formatTime((period.endTime - period.startTime)/1000)})</small>
                        <br><small>👥 Split with ${period.playerCount} players</small>
                    </div>
                `;
            });
            
            summaryHTML += `
                    </div>
                </div>
            `;
        });

        summaryHTML += `
            <div class="summary-total">
                Total Session Cost: ${totalSessionCost.toFixed(2)} EGP
            </div>
        `;
    }

    summaryContainer.innerHTML = summaryHTML;
    }

showSummary(sessionHistory, activePlayers) {
    const summaryContainer = document.getElementById('finalSummary');
    let totalSessionCost = 0;
    const allPlayers = new Set();
    
    // Collect all players who participated
    sessionHistory.forEach(period => {
        period.players.forEach(player => allPlayers.add(player));
    });

    // Fallback to active players if no history
    if (allPlayers.size === 0 && activePlayers.length > 0) {
        activePlayers.forEach(player => allPlayers.add(player.name));
    }

    const playerSummaries = [];
    const now = new Date();
    
    allPlayers.forEach(playerName => {
        const breakdown = [];
        let playerTotalCost = 0;
        let playerTotalTime = 0;
        
        sessionHistory.forEach(period => {
            if (period.players.includes(playerName)) {
                const startTime = new Date(period.startTime);
                const endTime = period.endTime ? new Date(period.endTime) : now;
                const durationMs = endTime - startTime;
                const durationHours = durationMs / (1000 * 60 * 60);
                const pricePerHour = period.mode === 'single' ? this.singlePrice : this.multiPrice;
                const periodCost = (pricePerHour * durationHours) / period.players.length;
                
                breakdown.push({
                    mode: period.mode,
                    startTime: startTime,
                    endTime: endTime,
                    duration: durationHours,
                    cost: periodCost,
                    playerCount: period.players.length
                });
                
                playerTotalCost += periodCost;
                playerTotalTime += durationMs;
            }
        });
        
        // If no breakdown but player was active, calculate from active time
        if (breakdown.length === 0) {
            const player = activePlayers.find(p => p.name === playerName);
            if (player) {
                const durationMs = now - new Date(player.joinTime);
                const durationHours = durationMs / (1000 * 60 * 60);
                const pricePerHour = this.currentMode === 'single' ? this.singlePrice : this.multiPrice;
                const periodCost = (pricePerHour * durationHours) / activePlayers.length;
                
                breakdown.push({
                    mode: this.currentMode,
                    startTime: new Date(player.joinTime),
                    endTime: now,
                    duration: durationHours,
                    cost: periodCost,
                    playerCount: activePlayers.length
                });
                
                playerTotalCost = periodCost;
                playerTotalTime = durationMs;
            }
        }
        
        totalSessionCost += playerTotalCost;
        
        playerSummaries.push({
            name: playerName,
            cost: playerTotalCost,
            time: playerTotalTime,
            breakdown: breakdown
        });
    });

    // Generate HTML
    let summaryHTML = '';
    
    if (playerSummaries.length === 0) {
        this.showNoDataMessage();
    } else {
        // Sort by cost (highest first)
        playerSummaries.sort((a, b) => b.cost - a.cost);

        playerSummaries.forEach(player => {
            summaryHTML += `
                <div class="summary-item">
                    <div class="player-name">${player.name}</div>
                    <div class="player-cost">${player.cost.toFixed(2)} EGP</div>
                    <div class="player-stats">
                        Total time: ${this.formatTime(player.time / 1000)} | 
                        Periods: ${player.breakdown.length}
                    </div>
                    <div class="breakdown-details" style="margin-top: 10px; font-size: 0.85rem;">
                        <strong>Payment Breakdown:</strong>
            `;
            
            player.breakdown.forEach(period => {
                summaryHTML += `
                    <div style="margin: 5px 0; padding: 5px; background: rgba(0,0,0,0.05); border-radius: 5px;">
                        <strong>${period.mode.charAt(0).toUpperCase() + period.mode.slice(1)}:</strong> ${period.cost.toFixed(2)} EGP
                        <br><small>⏰ ${period.startTime.toLocaleTimeString()} - ${period.endTime.toLocaleTimeString()} (${this.formatTime((period.endTime - period.startTime)/1000)})</small>
                        <br><small>👥 Split with ${period.playerCount} players</small>
                    </div>
                `;
            });
            
            summaryHTML += `
                    </div>
                </div>
            `;
        });

        summaryHTML += `
            <div class="summary-total">
                Total Session Cost: ${totalSessionCost.toFixed(2)} EGP
            </div>
        `;
        
        summaryContainer.innerHTML = summaryHTML;
    }
    }

showNoDataMessage() {
    const summaryContainer = document.getElementById('finalSummary');
    summaryContainer.innerHTML = `
        <div class="no-session-data">
            <p>No session data available</p>
            <p>Current Session ID: ${this.currentSessionId || 'None'}</p>
            <p>Please try ending the session again.</p>
        </div>
    `;
}

    updatePlayerDropdowns() {
        const allPlayers = ['Amr', 'Essawy', 'Omar', 'Fady', 'Ali', 
                         'Kareem', 'Ezzat', 'Hoba', 'Guest'];
        
        // Update add player dropdown in session
        const sessionSelect = document.getElementById('addPlayerSelect');
        const activePlayerNames = this.activePlayers.filter(p => p.active).map(p => p.name);
        
        sessionSelect.innerHTML = '<option value="">Choose a player...</option>';
        allPlayers.forEach(player => {
            if (!activePlayerNames.includes(player)) {
                sessionSelect.innerHTML += `<option value="${player}">${player}</option>`;
            }
        });
    }

    updateSessionDisplay() {
        // Update timers
        document.getElementById('totalTime').textContent = this.formatTime(this.timers.total);
        document.getElementById('singleTime').textContent = this.formatTime(this.timers.single);
        document.getElementById('multiTime').textContent = this.formatTime(this.timers.multi);
        
        // Update current mode
        document.getElementById('currentMode').textContent = this.currentMode.charAt(0).toUpperCase() + this.currentMode.slice(1);
        document.getElementById('sessionStatus').textContent = `${this.currentMode.charAt(0).toUpperCase() + this.currentMode.slice(1)} Mode Active`;
        
        // Update mode buttons
        document.getElementById('singleModeBtn').className = 'mode-btn' + (this.currentMode === 'single' ? ' active' : '');
        document.getElementById('multiModeBtn').className = 'mode-btn' + (this.currentMode === 'multi' ? ' active' : '');
        
        // Update players list
        this.updatePlayersList();
        
        // Update active player count
        const activeCount = this.activePlayers.filter(p => p.active).length;
        document.getElementById('activePlayerCount').textContent = activeCount;
    }

    updatePlayersList() {
    const container = document.getElementById('playersList');
    
    container.innerHTML = this.activePlayers.filter(p => p.active).map(player => `
        <div class="player-item">
            <div class="player-info">
                <div class="player-name">${player.name}</div>
                <div class="player-stats">
                    Time: ${this.formatTime(player.totalTime || 0)} | 
                    Cost: ${(player.cost || 0).toFixed(2)} EGP
                </div>
                <div class="timestamp">
                    Joined: ${new Date(player.joinTime).toLocaleTimeString()}
                </div>
            </div>
            <button class="remove-player" onclick="app.confirmRemovePlayer('${player.name}')">Remove</button>
        </div>
    `).join('');
}

    formatTime(seconds) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const secs = seconds % 60;
        return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    showConfirmModal(title, message) {
        document.getElementById('confirmTitle').textContent = title;
        document.getElementById('confirmMessage').innerHTML = message;
        document.getElementById('confirmModal').style.display = 'block';
    }

    closeModal() {
        document.getElementById('confirmModal').style.display = 'none';
        this.currentAction = null;
        this.currentActionData = null;
    }

    executeConfirmedAction() {
        switch (this.currentAction) {
            case 'modeChange':
                this.changeModeConfirmed(this.currentActionData.newMode);
                break;
            case 'removePlayer':
                this.removePlayerConfirmed(this.currentActionData.playerName);
                break;
            case 'endSession':
                this.endSession();
                break;
            case 'newSession':
                this.newSession();
                break;
        }
        this.closeModal();
    }

    showPage(pageId) {
    const pages = ['startPage', 'sessionPage', 'summaryPage'];
    pages.forEach(page => {
        const element = document.getElementById(page);
        if (page === pageId) {
            element.classList.remove('hidden');
        } else {
            element.classList.add('hidden');
        }
    });

    // Special handling for session info display
    if (pageId === 'sessionPage') {
        this.showSessionInfo();
    } else {
        document.getElementById('sessionInfo').classList.add('hidden');
    }
    }
}

// Initialize the app
const app = new PlayStationCalculator();
