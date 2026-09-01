(() => {
    "use strict";

    const GAME_DURATION = 30;
    const FINISH_BACKGROUND_TIME = 1;
    const WIN_TARGET = 50;
    const CAKE_SPAWN_DELAY_MIN = 220;
    const CAKE_SPAWN_DELAY_MAX = 310;
    const WORLD_SCROLL_SPEED = 1.1;
    const WORLD_REBASE_SCREENS = 2;
    const MAX_ACTIVE_COINS = 4;
    const MAX_ACTIVE_OBSTACLES = 2;
    const MAX_ACTIVE_SCORE_POPS = 6;
    const MAX_LIVES = 3;
    const DAMAGE_COOLDOWN = 1200;
    const OBSTACLE_INTERVAL = 3000;
    const OBSTACLE_CLEARING_TIME = 600;
    const OBSTACLE_ISOLATION_SCREEN_GAP = 0.12;
    const OBSTACLE_ASSETS = [
        { src: "images/obstacle1.png", width: 170, height: 112 },
        { src: "images/obstacle2.png", width: 172, height: 199 },
        { src: "images/obstacle3.png", width: 225, height: 210 }
    ];
    const GOOGLE_SCRIPT_URL = document.querySelector('meta[name="google-apps-script-url"]')?.content.trim() || "";

    const startScreen = document.querySelector("#startScreen");
    const countdownScreen = document.querySelector("#countdownScreen");
    const countdownImage = document.querySelector("#countdownImage");
    const countdownSound = document.querySelector("#countdownSound");
    const coinSound = document.querySelector("#coinSound");
    const collectMusic = document.querySelector("#collectMusic");
    const gameSuccessSound = document.querySelector("#gameSuccessSound");
    const coinSoundPool = [coinSound, ...Array.from({ length: 5 }, () => coinSound.cloneNode())];
    const playScreen = document.querySelector("#playScreen");
    const stageBackground = document.querySelector("#stageBackground");
    const startButton = document.querySelector("#startButton");
    const replayButton = document.querySelector("#replayButton");
    const playfield = document.querySelector("#playfield");
    const fallingLayer = document.querySelector("#fallingLayer");
    const character = document.querySelector("#character");
    const scoreValue = document.querySelector("#scoreValue");
    const timerValue = document.querySelector("#timerValue");
    const finalScore = document.querySelector("#finalScore");
    const resultTitle = document.querySelector("#resultTitle");
    const resultMessage = document.querySelector("#resultMessage");
    const resultOverlay = document.querySelector("#resultOverlay");
    const claimButton = document.querySelector("#claimButton");
    const phoneOverlay = document.querySelector("#phoneOverlay");
    const phoneForm = document.querySelector("#phoneForm");
    const phoneInput = document.querySelector("#phoneInput");
    const phoneMessage = document.querySelector("#phoneMessage");
    const phoneCloseButton = document.querySelector("#phoneCloseButton");
    const submitPhoneButton = document.querySelector("#submitPhoneButton");
    const actionOverlay = document.querySelector("#actionOverlay");
    const facebookShareButton = document.querySelector("#facebookShareButton");
    const shopNowButton = document.querySelector("#shopNowButton");
    const controlHint = document.querySelector("#controlHint");
    const hearts = [...document.querySelectorAll(".heart")];
    const externalBrowserOverlay = document.querySelector("#externalBrowserOverlay");
    const openExternalBrowserButton = document.querySelector("#openExternalBrowserButton");
    const copyGameLinkButton = document.querySelector("#copyGameLinkButton");
    const externalBrowserHint = document.querySelector("#externalBrowserHint");

    let running = false;
    let score = 0;
    let timeLeft = GAME_DURATION;
    let characterX = 50;
    let lives = MAX_LIVES;
    let invulnerable = false;
    let keys = { left: false, right: false };
    let coins = [];
    let obstacles = [];
    const coinElementPool = [];
    const obstacleElementPool = [];
    const scorePopElementPool = [];
    const activeScorePops = new Set();
    let animationFrame = 0;
    let timerId = 0;
    let spawnId = 0;
    let obstacleId = 0;
    let cakePauseUntil = 0;
    let obstacleSpawnTimer = 0;
    let countdownTimers = [];
    let lastFrame = 0;
    let gameStartedAt = 0;
    let hintTimer = 0;
    let damageTimer = 0;
    let coinSoundIndex = 0;
    let worldOffset = 0;
    let characterPositionDirty = true;
    let lastResultWasWin = false;
    let isSubmittingPhone = false;
    let metrics = {
        left: 0,
        width: 0,
        height: 0,
        characterWidth: 0,
        characterHeight: 0
    };

    function beginCountdown() {
        running = false;
        gameSuccessSound.pause();
        gameSuccessSound.currentTime = 0;
        stopGameLoops();
        clearCoins();
        clearObstacles();
        clearCountdown();

        resultOverlay.classList.remove("is-visible");
        resultOverlay.setAttribute("aria-hidden", "true");
        phoneOverlay.classList.remove("is-visible");
        phoneOverlay.setAttribute("aria-hidden", "true");
        actionOverlay.classList.remove("is-visible");
        actionOverlay.setAttribute("aria-hidden", "true");
        claimButton.hidden = true;
        resetPhoneForm();
        startScreen.classList.remove("is-active");
        playScreen.classList.remove("is-active");
        playScreen.classList.remove("is-game-running");
        playScreen.setAttribute("aria-hidden", "true");
        countdownScreen.classList.add("is-active");
        countdownScreen.setAttribute("aria-hidden", "false");

        countdownSound.currentTime = 0;
        const soundPromise = countdownSound.play();
        if (soundPromise) soundPromise.catch(() => { });
        prepareCollectMusic();

        showCountdown("images/count3.webp", "3", false);
        countdownTimers.push(window.setTimeout(() => showCountdown("images/count2.webp", "2", false), 1000));
        countdownTimers.push(window.setTimeout(() => showCountdown("images/count1.webp", "1", false), 2000));
        countdownTimers.push(window.setTimeout(() => showCountdown("images/countgo.webp", "Go", true), 3000));
        countdownTimers.push(window.setTimeout(startGame, 4000));
    }

    function showCountdown(src, label, isGo) {
        countdownImage.src = src;
        countdownImage.alt = label;
        countdownImage.classList.toggle("is-go", isGo);
        countdownImage.classList.remove("is-popping");
        void countdownImage.offsetWidth;
        countdownImage.classList.add("is-popping");
    }

    function clearCountdown() {
        countdownTimers.forEach((timer) => window.clearTimeout(timer));
        countdownTimers = [];
    }

    function startGame() {
        stopGameLoops();
        clearCoins();
        clearObstacles();
        clearCountdown();

        score = 0;
        timeLeft = GAME_DURATION;
        characterX = 50;
        lives = MAX_LIVES;
        invulnerable = false;
        cakePauseUntil = 0;
        characterPositionDirty = true;
        scoreValue.textContent = "0";
        timerValue.textContent = String(timeLeft);
        character.classList.remove("is-hit");
        updateHearts();
        resultOverlay.classList.remove("is-visible");
        resultOverlay.setAttribute("aria-hidden", "true");
        phoneOverlay.classList.remove("is-visible");
        phoneOverlay.setAttribute("aria-hidden", "true");
        actionOverlay.classList.remove("is-visible");
        actionOverlay.setAttribute("aria-hidden", "true");
        claimButton.hidden = true;
        controlHint.classList.remove("is-hidden");

        startScreen.classList.remove("is-active");
        countdownScreen.classList.remove("is-active");
        countdownScreen.setAttribute("aria-hidden", "true");
        playScreen.classList.add("is-active");
        playScreen.classList.add("is-game-running");
        playScreen.setAttribute("aria-hidden", "false");
        showStartBackground();

        refreshMetrics();
        renderCharacterPosition();
        running = true;
        playCollectMusic();
        lastFrame = performance.now();
        gameStartedAt = lastFrame;
        spawnCoin();
        scheduleNextCake();
        obstacleId = window.setInterval(prepareObstacleWave, OBSTACLE_INTERVAL);
        timerId = window.setInterval(tickTimer, 1000);
        hintTimer = window.setTimeout(() => controlHint.classList.add("is-hidden"), 2600);
        animationFrame = requestAnimationFrame(update);
    }

    function tickTimer() {
        if (!running) return;
        timeLeft -= 1;
        timerValue.textContent = String(Math.max(timeLeft, 0));
        if (timeLeft === FINISH_BACKGROUND_TIME) showFinishBackground();
        if (timeLeft <= 0) endGame();
    }

    function showStartBackground() {
        stageBackground.className = "stage-background";
        void stageBackground.offsetWidth;
        stageBackground.classList.add("is-starting");
    }

    function showFinishBackground() {
        stageBackground.className = "stage-background";
        void stageBackground.offsetWidth;
        stageBackground.classList.add("is-finishing");
    }

    function endGame({ forceLoss = false } = {}) {
        if (!running) return;
        running = false;
        playScreen.classList.remove("is-game-running");
        stopCollectMusic();
        stopGameLoops();
        character.classList.remove("is-moving", "is-hit");
        const didWin = !forceLoss && score >= WIN_TARGET;
        lastResultWasWin = didWin;
        claimButton.hidden = !didWin;
        if (didWin) playGameSuccessSound();
        resultTitle.textContent = didWin ? "CHÚC MỪNG!" : "THẤT BẠI!";
        resultMessage.textContent = "Bạn đã thu thập được";
        finalScore.textContent = String(score);
        resultOverlay.classList.add("is-visible");
        resultOverlay.setAttribute("aria-hidden", "false");
        window.setTimeout(() => replayButton.focus(), 320);
    }

    function stopGameLoops() {
        window.clearInterval(timerId);
        window.clearTimeout(spawnId);
        window.clearInterval(obstacleId);
        window.clearTimeout(hintTimer);
        window.clearTimeout(damageTimer);
        window.clearTimeout(obstacleSpawnTimer);
        cancelAnimationFrame(animationFrame);
    }

    function clearCoins() {
        fallingLayer.querySelectorAll(".coin").forEach(releaseCoinElement);
        coins = [];
        worldOffset = 0;
        fallingLayer.style.transform = "translate3d(0, 0, 0)";
        playfield.querySelectorAll(".score-pop").forEach(releaseScorePopElement);
    }

    function clearObstacles() {
        fallingLayer.querySelectorAll(".obstacle").forEach(releaseObstacleElement);
        obstacles = [];
    }

    function acquireCoinElement() {
        const element = coinElementPool.pop() || document.createElement("div");
        if (!element.isConnected) {
            element.innerHTML = '<img src="images/cake.png" alt="" draggable="false">';
            fallingLayer.appendChild(element);
        }
        window.clearTimeout(element._poolTimer);
        element._poolTimer = 0;
        element._isPooled = false;
        element.className = "coin";
        element.hidden = false;
        return element;
    }

    function releaseCoinElement(element) {
        if (element._isPooled) return;
        window.clearTimeout(element._poolTimer);
        element._poolTimer = 0;
        element._isPooled = true;
        element.className = "coin";
        element.style.removeProperty("transform");
        element.hidden = true;
        coinElementPool.push(element);
    }

    function acquireObstacleElement(mode, asset) {
        const element = obstacleElementPool.pop() || document.createElement("div");
        if (!element.firstElementChild) {
            element.innerHTML = `<img src="${asset.src}" alt="" draggable="false">`;
        } else {
            element.firstElementChild.src = asset.src;
        }
        if (!element.isConnected) fallingLayer.appendChild(element);
        window.clearTimeout(element._poolTimer);
        element._poolTimer = 0;
        element._isPooled = false;
        element.className = `obstacle obstacle--${mode}`;
        element.hidden = false;
        return element;
    }

    function releaseObstacleElement(element) {
        if (element._isPooled) return;
        window.clearTimeout(element._poolTimer);
        element._poolTimer = 0;
        element._isPooled = true;
        element.className = "obstacle";
        element.style.removeProperty("transform");
        element.hidden = true;
        obstacleElementPool.push(element);
    }

    function acquireScorePopElement() {
        if (activeScorePops.size >= MAX_ACTIVE_SCORE_POPS) return null;
        const element = scorePopElementPool.pop() || document.createElement("span");
        if (!element.isConnected) playfield.appendChild(element);
        window.clearTimeout(element._poolTimer);
        element._poolTimer = 0;
        element._isPooled = false;
        element.className = "score-pop";
        element.hidden = false;
        activeScorePops.add(element);
        return element;
    }

    function releaseScorePopElement(element) {
        if (element._isPooled) return;
        window.clearTimeout(element._poolTimer);
        element._poolTimer = 0;
        element._isPooled = true;
        element.className = "score-pop";
        element.hidden = true;
        activeScorePops.delete(element);
        scorePopElementPool.push(element);
    }

    function updateHearts() {
        hearts.forEach((heart, index) => {
            heart.classList.toggle("is-lost", index >= lives);
        });
        document.querySelector("#lifeBox").setAttribute("aria-label", `${lives} mạng`);
    }

    function refreshMetrics() {
        const playfieldRect = playfield.getBoundingClientRect();
        const left = playfieldRect.left;
        const width = playfieldRect.width;
        const height = playfieldRect.height;
        const characterWidth = character.offsetWidth || width * 0.25;
        const characterHeight = character.offsetHeight || characterWidth * (965 / 850);
        metrics = { left, width, height, characterWidth, characterHeight };
        characterPositionDirty = true;
    }

    function getCharacterBounds() {
        const left = metrics.width * (characterX / 100) - metrics.characterWidth / 2;
        const bottom = metrics.height - metrics.height * 0.045;
        return {
            left,
            right: left + metrics.characterWidth,
            top: bottom - metrics.characterHeight,
            bottom
        };
    }

    function scheduleNextCake() {
        if (!running) return;

        const delay = CAKE_SPAWN_DELAY_MIN +
            Math.random() * (CAKE_SPAWN_DELAY_MAX - CAKE_SPAWN_DELAY_MIN);
        spawnId = window.setTimeout(() => {
            if (!running) return;
            spawnCoin();
            scheduleNextCake();
        }, delay);
    }

    function spawnCoin(options = {}) {
        if (!running) return;
        if (coins.length >= MAX_ACTIVE_COINS) return;
        if (performance.now() < cakePauseUntil) return;
        if (!metrics.width) refreshMetrics();

        const {
            xPercent = null,
            ySteps = 0
        } = options;

        const size = metrics.width * 0.11;
        const x = xPercent === null
            ? size / 2 + Math.random() * (metrics.width - size)
            : metrics.width * (xPercent / 100);
        const y = -size * (1 + ySteps) - worldOffset;
        const screenTop = y + worldOffset;
        if (isNearActiveObstacle(screenTop, screenTop + size)) return;

        const element = acquireCoinElement();
        const coin = {
            element,
            x,
            y,
            size,
            collected: false
        };
        coins.push(coin);
        positionCoin(coin);
    }

    function positionCoin(coin) {
        coin.element.style.transform = `translate3d(${coin.x - coin.size / 2}px, ${coin.y}px, 0)`;
    }

    function prepareObstacleWave() {
        if (!running || obstacles.length >= MAX_ACTIVE_OBSTACLES) return;

        cakePauseUntil = performance.now() + OBSTACLE_CLEARING_TIME;
        obstacleSpawnTimer = window.setTimeout(spawnObstacleWave, OBSTACLE_CLEARING_TIME);
    }

    function spawnObstacleWave() {
        if (!running || obstacles.length >= MAX_ACTIVE_OBSTACLES) return;

        const elapsed = (performance.now() - gameStartedAt) / 1000;
        const mode = getObstacleMode(elapsed);
        spawnObstacle(mode, 0);
        spawnObstacle(mode, 1);
    }

    function getObstacleMode(elapsed) {
        if (elapsed >= 5 && elapsed < 7) return "fast";
        return "normal";
    }

    function spawnObstacle(mode, waveIndex) {
        if (obstacles.length >= MAX_ACTIVE_OBSTACLES) return;

        const asset = OBSTACLE_ASSETS[Math.floor(Math.random() * OBSTACLE_ASSETS.length)];
        const width = metrics.width * 0.18;
        const height = width * (asset.height / asset.width);
        const position = findSafeObstaclePosition(width, height, mode, waveIndex);
        if (!position) return;

        const element = acquireObstacleElement(mode, asset);

        const obstacle = {
            element,
            x: position.x,
            y: position.y - worldOffset,
            width,
            height,
            hit: false
        };

        obstacles.push(obstacle);
        positionObstacle(obstacle);
    }

    function findSafeObstaclePosition(width, height, mode, waveIndex) {
        const fieldWidth = metrics.width;
        const y = -height * (1 + waveIndex * 0.25);
        const isolationGap = metrics.height * OBSTACLE_ISOLATION_SCREEN_GAP;
        const overlapsCoinBand = coins.some((coin) => !coin.collected && verticalRangesOverlap(
            y,
            y + height,
            coin.y + worldOffset,
            coin.y + worldOffset + coin.size,
            isolationGap
        ));

        if (overlapsCoinBand) return null;

        for (let attempt = 0; attempt < 32; attempt += 1) {
            const laneStart = waveIndex === 0 ? width / 2 : fieldWidth / 2 + width / 2;
            const laneEnd = waveIndex === 0 ? fieldWidth / 2 - width / 2 : fieldWidth - width / 2;
            const x = laneStart + Math.random() * Math.max(laneEnd - laneStart, 0);
            const candidate = { left: x - width / 2, right: x + width / 2, top: y, bottom: y + height };

            const overlapsCoin = coins.some((coin) => !coin.collected && rectsOverlap(candidate, {
                left: coin.x - coin.size / 2,
                right: coin.x + coin.size / 2,
                top: coin.y + worldOffset,
                bottom: coin.y + worldOffset + coin.size
            }, 7));
            const overlapsObstacle = obstacles.some((obstacle) => !obstacle.hit && rectsOverlap(candidate, {
                left: obstacle.x - obstacle.width / 2,
                right: obstacle.x + obstacle.width / 2,
                top: obstacle.y + worldOffset,
                bottom: obstacle.y + worldOffset + obstacle.height
            }, 10));

            if (!overlapsCoin && !overlapsObstacle) return { x, y };
        }

        return null;
    }

    function isNearActiveObstacle(top, bottom) {
        const isolationGap = metrics.height * OBSTACLE_ISOLATION_SCREEN_GAP;
        return obstacles.some((obstacle) => !obstacle.hit && verticalRangesOverlap(
            top,
            bottom,
            obstacle.y + worldOffset,
            obstacle.y + worldOffset + obstacle.height,
            isolationGap
        ));
    }

    function verticalRangesOverlap(firstTop, firstBottom, secondTop, secondBottom, gap = 0) {
        return firstTop < secondBottom + gap && firstBottom > secondTop - gap;
    }

    function rectsOverlap(first, second, padding = 0) {
        return first.left < second.right + padding &&
            first.right > second.left - padding &&
            first.top < second.bottom + padding &&
            first.bottom > second.top - padding;
    }

    function positionObstacle(obstacle) {
        obstacle.element.style.transform = `translate3d(${obstacle.x - obstacle.width / 2}px, ${obstacle.y}px, 0)`;
    }

    function update(now) {
        if (!running) return;

        const delta = Math.min((now - lastFrame) / 1000, 0.035);
        lastFrame = now;
        updateKeyboard(delta);
        renderCharacterPosition();
        worldOffset += metrics.height * WORLD_SCROLL_SPEED * delta;
        rebaseWorldOffset();
        fallingLayer.style.transform = `translate3d(0, ${worldOffset}px, 0)`;

        const characterRect = getCharacterBounds();

        coins.forEach((coin) => {
            if (coin.collected) return;

            const coinLeft = coin.x - coin.size / 2;
            const coinTop = coin.y + worldOffset;
            const inset = coin.size * 0.18;

            if (
                coinLeft + coin.size - inset > characterRect.left &&
                coinLeft + inset < characterRect.right &&
                coinTop + coin.size - inset > characterRect.top &&
                coinTop + inset < characterRect.bottom
            ) {
                collectCoin(coin, coinLeft, coinTop);
            }
        });

        coins = coins.filter((coin) => {
            if (coin.collected) return false;
            if (coin.y + worldOffset > metrics.height + coin.size) {
                releaseCoinElement(coin.element);
                return false;
            }
            return true;
        });

        updateObstacles(characterRect);

        animationFrame = requestAnimationFrame(update);
    }

    function rebaseWorldOffset() {
        if (!metrics.height || worldOffset < metrics.height * WORLD_REBASE_SCREENS) return;

        const offset = worldOffset;
        worldOffset = 0;
        coins.forEach((coin) => {
            coin.y += offset;
            positionCoin(coin);
        });
        obstacles.forEach((obstacle) => {
            obstacle.y += offset;
            positionObstacle(obstacle);
        });
    }

    function updateObstacles(characterRect) {
        obstacles.forEach((obstacle) => {
            if (obstacle.hit) return;

            const obstacleLeft = obstacle.x - obstacle.width / 2;
            const obstacleTop = obstacle.y + worldOffset;
            const insetX = obstacle.width * 0.12;
            const insetY = obstacle.height * 0.1;

            if (
                obstacleLeft + obstacle.width - insetX > characterRect.left &&
                obstacleLeft + insetX < characterRect.right &&
                obstacleTop + obstacle.height - insetY > characterRect.top &&
                obstacleTop + insetY < characterRect.bottom
            ) {
                damagePlayer(obstacle);
            }
        });

        obstacles = obstacles.filter((obstacle) => {
            if (obstacle.hit) return false;
            if (obstacle.y + worldOffset > metrics.height + obstacle.height) {
                releaseObstacleElement(obstacle.element);
                return false;
            }
            return true;
        });
    }

    function damagePlayer(obstacle) {
        if (invulnerable || !running) return;

        invulnerable = true;
        obstacle.hit = true;
        obstacle.element.classList.add("is-hit");
        obstacle.element._poolTimer = window.setTimeout(() => releaseObstacleElement(obstacle.element), 270);

        lives = Math.max(0, lives - 1);
        updateHearts();
        character.classList.add("is-hit");
        window.clearTimeout(damageTimer);
        damageTimer = window.setTimeout(() => {
            invulnerable = false;
            character.classList.remove("is-hit");
        }, DAMAGE_COOLDOWN);

        if (lives === 0) endGame({ forceLoss: true });
    }

    function collectCoin(coin, x, y) {
        coin.collected = true;
        score += 1;
        playCoinSound();
        scoreValue.textContent = String(score);
        coin.element.classList.add("is-collected");
        coin.element._poolTimer = window.setTimeout(() => releaseCoinElement(coin.element), 190);

        const pop = acquireScorePopElement();
        if (pop) {
            pop.textContent = "+1";
            pop.style.left = `${x}px`;
            pop.style.top = `${y}px`;
            pop._poolTimer = window.setTimeout(() => releaseScorePopElement(pop), 680);
        }

    }

    function playCoinSound() {
        const sound = coinSoundPool[coinSoundIndex];
        coinSoundIndex = (coinSoundIndex + 1) % coinSoundPool.length;
        sound.currentTime = 0;
        const playPromise = sound.play();
        if (playPromise) playPromise.catch(() => {});
    }

    function prepareCollectMusic() {
        collectMusic.pause();
        collectMusic.currentTime = 0;
        collectMusic.volume = 0.38;
        collectMusic.muted = true;
        const playPromise = collectMusic.play();
        if (playPromise) playPromise.catch(() => {});
    }

    function playCollectMusic() {
        collectMusic.currentTime = 0;
        collectMusic.volume = 0.38;
        collectMusic.muted = false;
        if (collectMusic.paused) {
            const playPromise = collectMusic.play();
            if (playPromise) playPromise.catch(() => {});
        }
    }

    function stopCollectMusic() {
        collectMusic.pause();
        collectMusic.currentTime = 0;
        collectMusic.muted = false;
    }

    function playGameSuccessSound() {
        gameSuccessSound.currentTime = 0;
        gameSuccessSound.volume = 0.8;
        const playPromise = gameSuccessSound.play();
        if (playPromise) playPromise.catch(() => {});
    }

    function openPhonePopup() {
        if (!lastResultWasWin) return;
        resultOverlay.classList.remove("is-visible");
        resultOverlay.setAttribute("aria-hidden", "true");
        phoneOverlay.classList.add("is-visible");
        phoneOverlay.setAttribute("aria-hidden", "false");
        window.setTimeout(() => phoneInput.focus(), 250);
    }

    function closePhonePopup() {
        phoneOverlay.classList.remove("is-visible");
        phoneOverlay.setAttribute("aria-hidden", "true");
        if (lastResultWasWin) {
            resultOverlay.classList.add("is-visible");
            resultOverlay.setAttribute("aria-hidden", "false");
            window.setTimeout(() => claimButton.focus(), 250);
        }
    }

    function resetPhoneForm() {
        isSubmittingPhone = false;
        phoneForm.reset();
        phoneInput.disabled = false;
        submitPhoneButton.disabled = false;
        submitPhoneButton.querySelector("span").textContent = "GỬI THÔNG TIN";
        phoneMessage.textContent = "";
        phoneMessage.classList.remove("is-success");
    }

    function normalizePhone(value) {
        return value.trim().replace(/[\s.()-]/g, "");
    }

    async function submitPhone(event) {
        event.preventDefault();
        if (isSubmittingPhone) return;

        const phone = normalizePhone(phoneInput.value);
        if (!/^(?:\+84|84|0)\d{9,10}$/.test(phone)) {
            phoneMessage.textContent = "Vui lòng nhập số điện thoại hợp lệ.";
            phoneMessage.classList.remove("is-success");
            phoneInput.focus();
            return;
        }

        if (!GOOGLE_SCRIPT_URL.startsWith("https://script.google.com/macros/s/") || !GOOGLE_SCRIPT_URL.endsWith("/exec")) {
            phoneMessage.textContent = "Chưa cấu hình URL Google Apps Script trong index.html.";
            phoneMessage.classList.remove("is-success");
            return;
        }

        isSubmittingPhone = true;
        submitPhoneButton.disabled = true;
        submitPhoneButton.querySelector("span").textContent = "ĐANG GỬI...";
        phoneMessage.textContent = "";
        phoneMessage.classList.remove("is-success");

        try {
            await fetch(GOOGLE_SCRIPT_URL, {
                method: "POST",
                mode: "no-cors",
                headers: { "Content-Type": "text/plain;charset=utf-8" },
                body: JSON.stringify({
                    phone,
                    score,
                    createdAt: new Date().toISOString(),
                    userAgent: navigator.userAgent
                })
            });

            phoneInput.disabled = true;
            submitPhoneButton.querySelector("span").textContent = "ĐÃ GỬI";
            phoneMessage.textContent = "Thông tin đã được ghi nhận. Cảm ơn bạn!";
            phoneMessage.classList.add("is-success");
            window.setTimeout(showActionPopup, 350);
        } catch (error) {
            isSubmittingPhone = false;
            submitPhoneButton.disabled = false;
            submitPhoneButton.querySelector("span").textContent = "GỬI LẠI";
            phoneMessage.textContent = "Không thể gửi thông tin. Vui lòng thử lại.";
            phoneMessage.classList.remove("is-success");
        }
    }

    function showActionPopup() {
        phoneOverlay.classList.remove("is-visible");
        phoneOverlay.setAttribute("aria-hidden", "true");
        actionOverlay.classList.add("is-visible");
        actionOverlay.setAttribute("aria-hidden", "false");
        window.setTimeout(() => facebookShareButton.focus(), 250);
    }

    function shareOnFacebook() {
        const gameUrl = window.location.href.split("#")[0];
        const shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(gameUrl)}`;
        window.open(shareUrl, "_blank", "noopener,noreferrer,width=720,height=620");
    }

    function goToShop() {
        window.location.assign("https://maybi.com/collections/hot-deal/Hot-Deal");
    }

    function initExternalBrowserPrompt() {
        const openedFromZalo = /Zalo/i.test(navigator.userAgent) ||
            new URLSearchParams(window.location.search).get("from") === "zalo";
        if (openedFromZalo) externalBrowserOverlay.hidden = false;
    }

    function openExternalBrowser() {
        const targetUrl = window.location.href;
        if (!/^https?:\/\//i.test(targetUrl)) {
            externalBrowserHint.textContent = "Hãy triển khai game lên HTTPS trước khi kiểm tra tính năng này.";
            return;
        }

        if (/Android/i.test(navigator.userAgent)) {
            const scheme = targetUrl.startsWith("https://") ? "https" : "http";
            const urlWithoutScheme = targetUrl.replace(/^https?:\/\//i, "");
            window.location.href = `intent://${urlWithoutScheme}#Intent;scheme=${scheme};package=com.android.chrome;S.browser_fallback_url=${encodeURIComponent(targetUrl)};end`;
            return;
        }

        if (/iPhone|iPad|iPod/i.test(navigator.userAgent)) {
            const chromeUrl = targetUrl
                .replace(/^https:/i, "googlechromes:")
                .replace(/^http:/i, "googlechrome:");
            window.location.href = chromeUrl;
            window.setTimeout(() => {
                externalBrowserHint.textContent = "Nếu Chrome chưa mở, hãy sao chép link rồi chọn ⋯ trong Zalo → Mở bằng Safari.";
            }, 900);
            return;
        }

        window.open(targetUrl, "_blank", "noopener,noreferrer");
    }

    async function copyGameLink() {
        const targetUrl = window.location.href;

        try {
            if (navigator.clipboard && window.isSecureContext) {
                await navigator.clipboard.writeText(targetUrl);
            } else {
                const textarea = document.createElement("textarea");
                textarea.value = targetUrl;
                textarea.setAttribute("readonly", "");
                textarea.style.position = "fixed";
                textarea.style.opacity = "0";
                document.body.appendChild(textarea);
                textarea.select();
                document.execCommand("copy");
                textarea.remove();
            }

            copyGameLinkButton.textContent = "ĐÃ SAO CHÉP";
            externalBrowserHint.textContent = "Đã sao chép link. Hãy dán vào Safari hoặc Chrome để chơi.";
        } catch (error) {
            externalBrowserHint.textContent = "Không thể sao chép tự động. Hãy dùng menu ⋯ của Zalo để mở bằng trình duyệt.";
        }
    }

    function updateKeyboard(delta) {
        let direction = 0;
        if (keys.left) direction -= 1;
        if (keys.right) direction += 1;
        if (direction === 0) {
            character.classList.remove("is-moving");
            return;
        }

        characterX += direction * 55 * delta;
        setCharacterPosition(characterX);
        character.classList.add("is-moving");
    }

    function setCharacterPosition(percent) {
        const halfWidth = (metrics.characterWidth / metrics.width) * 50;
        characterX = Math.max(halfWidth, Math.min(100 - halfWidth, percent));
        characterPositionDirty = true;
    }

    function renderCharacterPosition() {
        if (!characterPositionDirty || !metrics.width) return;
        const shiftFromCenter = metrics.width * (characterX / 100 - 0.5);
        character.style.setProperty("--character-shift", `${shiftFromCenter}px`);
        characterPositionDirty = false;
    }

    function moveFromPointer(event) {
        if (!running) return;
        setCharacterPosition(((event.clientX - metrics.left) / metrics.width) * 100);
        character.classList.add("is-moving");
        controlHint.classList.add("is-hidden");
    }

    playfield.addEventListener("pointerdown", (event) => {
        if (!running) return;
        playfield.setPointerCapture(event.pointerId);
        moveFromPointer(event);
    });

    playfield.addEventListener("pointermove", (event) => {
        if (event.pointerType === "mouse" || playfield.hasPointerCapture(event.pointerId)) {
            moveFromPointer(event);
        }
    });

    playfield.addEventListener("pointerup", (event) => {
        if (playfield.hasPointerCapture(event.pointerId)) playfield.releasePointerCapture(event.pointerId);
        character.classList.remove("is-moving");
    });

    window.addEventListener("keydown", (event) => {
        if (["ArrowLeft", "ArrowRight", "a", "A", "d", "D"].includes(event.key)) event.preventDefault();
        if (["ArrowLeft", "a", "A"].includes(event.key)) keys.left = true;
        if (["ArrowRight", "d", "D"].includes(event.key)) keys.right = true;
    });

    window.addEventListener("keyup", (event) => {
        if (["ArrowLeft", "a", "A"].includes(event.key)) keys.left = false;
        if (["ArrowRight", "d", "D"].includes(event.key)) keys.right = false;
    });

    window.addEventListener("blur", () => {
        keys = { left: false, right: false };
        character.classList.remove("is-moving");
    });

    window.addEventListener("resize", () => {
        if (playScreen.classList.contains("is-active")) refreshMetrics();
    });

    startButton.addEventListener("click", beginCountdown);
    replayButton.addEventListener("click", beginCountdown);
    claimButton.addEventListener("click", openPhonePopup);
    phoneCloseButton.addEventListener("click", closePhonePopup);
    phoneForm.addEventListener("submit", submitPhone);
    facebookShareButton.addEventListener("click", shareOnFacebook);
    shopNowButton.addEventListener("click", goToShop);
    openExternalBrowserButton.addEventListener("click", openExternalBrowser);
    copyGameLinkButton.addEventListener("click", copyGameLink);
    initExternalBrowserPrompt();
})();
