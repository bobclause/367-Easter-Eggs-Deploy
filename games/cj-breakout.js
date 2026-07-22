(function () {
    'use strict';

    const GAME_NAME = 'cj-breakout';

    let gameContainer = null;
    let gamePaddle = null;
    let blockContainer = null;
    let scoreDisplay = null;
    let cj = null;
    let styleElement = null;

    let fieldSize = null;
    let animationFrame = null;
    let scoreTimer = null;
    let rowTimer = null;

    let x = 6;
    let y = 6;

    let isLaunched = false;
    let isRunning = false;

    let rows = [];
    let score = 0;
    let linesCleared = 0;

    let rowInterval = 60000;
    const maxRowInterval = 10000;
    const paddleSpeed = 10;

    const keys = {};

    function buildGame() {
        gameContainer = document.createElement('div');
        gameContainer.id = 'cjBreakoutGameContainer';

        blockContainer = document.createElement('div');
        blockContainer.id = 'cjBreakoutBlockContainer';

        scoreDisplay = document.createElement('div');
        scoreDisplay.id = 'cjBreakoutScoreDisplay';

        gamePaddle = document.createElement('div');
        gamePaddle.id = 'cjBreakoutPaddle';

        cj = document.createElement('img');
        cj.id = 'cjBreakoutBall';

        cj.src =
            'https://static.wixstatic.com/media/e283a7_059f4448925a46fa9caf89822387e175~mv2.png/v1/fill/w_333,h_395,fp_0.50_0.50,q_85,usm_0.66_1.00_0.01,enc_auto/headshots%20%20(28).png';

        cj.alt = 'CJ';
        cj.draggable = false;

        gameContainer.appendChild(blockContainer);
        gameContainer.appendChild(scoreDisplay);
        gameContainer.appendChild(cj);
        gameContainer.appendChild(gamePaddle);

        createCloseButton();
        addStyles();
        updateScoreDisplay();
    }

    function createCloseButton() {
        const closeButton = document.createElement('button');

        closeButton.id = 'cjBreakoutCloseButton';
        closeButton.type = 'button';
        closeButton.innerText = '×';
        closeButton.setAttribute('aria-label', 'Close game');

        closeButton.addEventListener('click', stop);

        gameContainer.appendChild(closeButton);
    }

    function addStyles() {
        styleElement = document.createElement('style');

        styleElement.textContent = `
            #cjBreakoutGameContainer {
                position: fixed;
                inset: 0;
                z-index: 2147483647;
                overflow: hidden;
                background-color: rgba(237, 231, 225, 0.95);
                font-family: Arial, sans-serif;
            }

            #cjBreakoutBlockContainer {
                position: absolute;
                display: flex;
                flex-wrap: wrap;
                box-sizing: border-box;
            }

            #cjBreakoutPaddle {
                position: absolute;
                bottom: 10%;
                left: 40%;
                width: 20%;
                height: 2%;
                min-height: 12px;
                background-color: white;
                border: 2px solid #555;
                border-radius: 10px;
                box-sizing: border-box;
            }

            #cjBreakoutBall {
                position: absolute;
                height: 5%;
                min-height: 35px;
                border-radius: 50%;
                user-select: none;
                pointer-events: none;
            }

            .cjBreakoutBlock {
                position: absolute;
                box-sizing: border-box;
                background-color: blue;
                border-top: 5px solid yellow;
                border-bottom: 5px solid yellow;
                border-left: 5px solid gold;
                border-right: 5px solid gold;
            }

            .cjBreakoutBlock[data-hits="2"] {
                background-color: green;
            }

            .cjBreakoutBlock[data-hits="3"] {
                background-color: orange;
            }

            .cjBreakoutBlock[data-hits="4"] {
                background-color: red;
            }

            .cjBreakoutBlock[data-hits="5"] {
                background-color: purple;
            }

            .cjBreakoutBlock[data-hits="6"] {
                background-color: brown;
            }

            .cjBreakoutBlock[data-hits="7"] {
                background-color: gray;
            }

            .cjBreakoutBlock[data-hits="8"] {
                background-color: pink;
            }

            .cjBreakoutBlock[data-hits="9"] {
                background-color: cyan;
            }

            .cjBreakoutBlock[data-hits="10"] {
                background-color: black;
            }

            #cjBreakoutScoreDisplay {
                position: absolute;
                bottom: 5%;
                left: 5%;
                padding: 10px;
                z-index: 3;
                font-size: 20px;
                background-color: rgba(255, 255, 255, 0.8);
                border-radius: 10px;
            }

            #cjBreakoutCloseButton {
                position: absolute;
                top: 15px;
                right: 20px;
                z-index: 5;
                width: 42px;
                height: 42px;
                padding: 0;
                border: 0;
                border-radius: 50%;
                color: white;
                background: rgba(0, 0, 0, 0.65);
                font-size: 30px;
                line-height: 38px;
                cursor: pointer;
            }

            #cjBreakoutCloseButton:hover {
                background: rgba(0, 0, 0, 0.9);
            }
        `;

        document.head.appendChild(styleElement);
    }

    function launch() {
        if (isRunning) {
            return;
        }

        isRunning = true;

        buildGame();
        document.body.appendChild(gameContainer);

        fieldSize = gameContainer.getBoundingClientRect();

        document.addEventListener('keydown', keyDown);
        document.addEventListener('keyup', keyUp);
        window.addEventListener('resize', handleResize);

        setDimensions();
        createInitialBlocks();
        centerCJOnPaddle();
        movePaddle();
        increaseScoreOverTime();
        scheduleNextRow();
    }

    function stop() {
        if (!isRunning) {
            return;
        }

        isRunning = false;
        isLaunched = false;

        document.removeEventListener('keydown', keyDown);
        document.removeEventListener('keyup', keyUp);
        window.removeEventListener('resize', handleResize);

        if (animationFrame !== null) {
            cancelAnimationFrame(animationFrame);
            animationFrame = null;
        }

        if (scoreTimer !== null) {
            clearTimeout(scoreTimer);
            scoreTimer = null;
        }

        if (rowTimer !== null) {
            clearTimeout(rowTimer);
            rowTimer = null;
        }

        if (gameContainer) {
            gameContainer.remove();
        }

        if (styleElement) {
            styleElement.remove();
        }

        gameContainer = null;
        gamePaddle = null;
        blockContainer = null;
        scoreDisplay = null;
        cj = null;
        styleElement = null;

        rows = [];
        clearKeys();
    }

    function handleResize() {
        if (!isRunning) {
            return;
        }

        fieldSize = gameContainer.getBoundingClientRect();
        setDimensions();

        const paddleSize = gamePaddle.getBoundingClientRect();

        if (paddleSize.right > fieldSize.right) {
            gamePaddle.style.left =
                `${fieldSize.width - paddleSize.width}px`;
        }

        if (!isLaunched) {
            centerCJOnPaddle();
        }
    }

    function setDimensions() {
        const cjSize = cj.getBoundingClientRect();

        blockContainer.style.width =
            `${Math.max(300, fieldSize.width - cjSize.width * 4)}px`;

        blockContainer.style.marginTop =
            `${cjSize.height * 2}px`;

        blockContainer.style.left =
            `${Math.max(0, cjSize.width * 2)}px`;
    }

    function createInitialBlocks() {
        rows = [];
        blockContainer.innerHTML = '';

        for (let row = 0; row < 5; row += 1) {
            createRow(row);
        }
    }

    function createRow(rowIndex) {
        const row = [];
        const blockContainerWidth =
            blockContainer.getBoundingClientRect().width;

        const blockWidth = blockContainerWidth / 10;

        for (let column = 0; column < 10; column += 1) {
            const block = document.createElement('div');

            block.classList.add('cjBreakoutBlock');
            block.style.width = `${blockWidth}px`;
            block.style.height = '30px';
            block.style.top = `${rowIndex * 30}px`;
            block.style.left = `${column * blockWidth}px`;
            block.dataset.hits = '1';

            blockContainer.appendChild(block);
            row.push(block);
        }

        rows.push(row);
    }

    function centerCJOnPaddle() {
        if (!cj || !gamePaddle) {
            return;
        }

        const paddleSize = gamePaddle.getBoundingClientRect();
        const cjSize = cj.getBoundingClientRect();
        const fieldRect = gameContainer.getBoundingClientRect();

        cj.style.top =
            `${paddleSize.top - fieldRect.top - cjSize.height}px`;

        cj.style.left =
            `${
                paddleSize.left -
                fieldRect.left +
                paddleSize.width / 2 -
                cjSize.width / 2
            }px`;
    }

    function ballMove() {
        if (!isRunning || !isLaunched) {
            return;
        }

        const ballAttr = cj.getBoundingClientRect();
        const paddleSize = gamePaddle.getBoundingClientRect();
        const fieldRect = gameContainer.getBoundingClientRect();

        let directionUpdated = false;

        if (ballAttr.top <= fieldRect.top) {
            y = Math.abs(y);
        }

        const paddleCollision =
            ballAttr.bottom >= paddleSize.top &&
            ballAttr.top < paddleSize.bottom &&
            ballAttr.right > paddleSize.left &&
            ballAttr.left < paddleSize.right &&
            y > 0;

        if (paddleCollision) {
            cj.style.top =
                `${paddleSize.top - fieldRect.top - ballAttr.height - 1}px`;

            y = -Math.abs(y);

            const ballCenter = ballAttr.left + ballAttr.width / 2;
            const hitPosition = ballCenter - paddleSize.left;
            const paddleHitRatio = hitPosition / paddleSize.width;

            if (paddleHitRatio < 0.2) {
                x = -Math.abs(x);
            } else if (paddleHitRatio < 0.4) {
                x *= 0.75;
            } else if (paddleHitRatio < 0.6) {
                x *= 0.9;
            } else if (paddleHitRatio < 0.8) {
                x *= 1.15;
            } else {
                x = Math.abs(x);
            }

            if (Math.abs(x) < 1) {
                x = Math.sign(x || 1);
            }

            if (Math.abs(x) >= 10) {
                x = Math.sign(x) * 9;
            }

            y = -Math.sqrt(
                Math.max(1, 10 ** 2 - Math.abs(x) ** 2)
            );
        }

        if (
            ballAttr.right >= fieldRect.right ||
            ballAttr.left <= fieldRect.left
        ) {
            x = -x;
        }

        const blocks =
            blockContainer.querySelectorAll('.cjBreakoutBlock');

        blocks.forEach(block => {
            if (!block.isConnected) {
                return;
            }

            const blockAttr = block.getBoundingClientRect();

            const collision =
                ballAttr.bottom > blockAttr.top &&
                ballAttr.top < blockAttr.bottom &&
                ballAttr.right > blockAttr.left &&
                ballAttr.left < blockAttr.right;

            if (!collision) {
                return;
            }

            if (!directionUpdated) {
                if (
                    ballAttr.bottom - y <= blockAttr.top ||
                    ballAttr.top - y >= blockAttr.bottom
                ) {
                    y = -y;
                } else {
                    x = -x;
                }

                directionUpdated = true;
            }

            handleBlockHit(block);
        });

        const currentTop = ballAttr.top - fieldRect.top;
        const currentLeft = ballAttr.left - fieldRect.left;

        cj.style.top = `${currentTop + y}px`;
        cj.style.left = `${currentLeft + x}px`;

        if (ballAttr.bottom < fieldRect.bottom) {
            animationFrame = requestAnimationFrame(ballMove);
        } else {
            window.alert('Game Over! Click OK to restart.');
            resetGame();
        }
    }

    function handleBlockHit(block) {
        const hits = Number.parseInt(block.dataset.hits, 10);

        if (hits > 1) {
            block.dataset.hits = String(hits - 1);
            return;
        }

        block.remove();
        updateScore(100);
        checkAndHandleRowDestruction();
    }

    function checkAndHandleRowDestruction() {
        for (let rowIndex = rows.length - 1; rowIndex >= 0; rowIndex -= 1) {
            const row = rows[rowIndex];

            if (!row.every(block => !block.isConnected)) {
                continue;
            }

            rows.splice(rowIndex, 1);

            rows.forEach((remainingRow, remainingIndex) => {
                if (remainingIndex < rowIndex) {
                    return;
                }

                remainingRow.forEach(block => {
                    if (!block.isConnected) {
                        return;
                    }

                    block.style.top =
                        `${Number.parseInt(block.style.top, 10) + 30}px`;
                });
            });

            createRow(0);
            updateScore(500);

            linesCleared += 1;
            updateScoreDisplay();
        }

        if (rows.length > 18) {
            combineBottomRow();
        }
    }

    function combineBottomRow() {
        if (rows.length < 2) {
            return;
        }

        const bottomRow = rows[rows.length - 1];
        const secondBottomRow = rows[rows.length - 2];

        bottomRow.forEach((block, index) => {
            if (!block.isConnected) {
                return;
            }

            const correspondingBlock = secondBottomRow[index];

            if (!correspondingBlock || !correspondingBlock.isConnected) {
                return;
            }

            const bottomHits =
                Number.parseInt(block.dataset.hits, 10);

            const topHits =
                Number.parseInt(correspondingBlock.dataset.hits, 10);

            correspondingBlock.dataset.hits =
                String(Math.min(10, bottomHits + topHits));

            block.remove();
        });

        rows.pop();
    }

    function keyDown(event) {
        keys[event.key] = true;

        if (
            ['ArrowLeft', 'ArrowRight', ' ', 'a', 'd'].includes(event.key)
        ) {
            event.preventDefault();
        }

        if (event.key === 'Escape') {
            stop();
            return;
        }

        if (event.key === ' ' && !isLaunched) {
            isLaunched = true;
            animationFrame = requestAnimationFrame(ballMove);
        }
    }

    function keyUp(event) {
        keys[event.key] = false;
    }

    function movePaddle() {
        if (!isRunning) {
            return;
        }

        const paddleSize = gamePaddle.getBoundingClientRect();
        const fieldRect = gameContainer.getBoundingClientRect();

        const relativeLeft = paddleSize.left - fieldRect.left;

        if (
            (keys.ArrowLeft || keys.a || keys.A) &&
            paddleSize.left > fieldRect.left
        ) {
            gamePaddle.style.left =
                `${Math.max(0, relativeLeft - paddleSpeed)}px`;

            if (!isLaunched) {
                x = -Math.abs(x);
            }
        }

        if (
            (keys.ArrowRight || keys.d || keys.D) &&
            paddleSize.right < fieldRect.right
        ) {
            gamePaddle.style.left =
                `${
                    Math.min(
                        fieldRect.width - paddleSize.width,
                        relativeLeft + paddleSpeed
                    )
                }px`;

            if (!isLaunched) {
                x = Math.abs(x);
            }
        }

        if (!isLaunched) {
            centerCJOnPaddle();
        }

        animationFrame = requestAnimationFrame(movePaddle);
    }

    function increaseScoreOverTime() {
        if (!isRunning) {
            return;
        }

        if (isLaunched) {
            updateScore(1);
        }

        scoreTimer = setTimeout(increaseScoreOverTime, 500);
    }

    function updateScore(points) {
        score += points;
        updateScoreDisplay();
    }

    function updateScoreDisplay() {
        if (!scoreDisplay) {
            return;
        }

        scoreDisplay.innerText =
            `Score: ${score} Lines Cleared: ${linesCleared}`;
    }

    function resetGame() {
        isLaunched = false;
        score = 0;
        linesCleared = 0;

        x = 6;
        y = 6;

        updateScoreDisplay();
        createInitialBlocks();
        centerCJOnPaddle();
    }

    function scheduleNextRow() {
        if (!isRunning) {
            return;
        }

        rowTimer = setTimeout(() => {
            if (isLaunched) {
                rows.forEach(row => {
                    row.forEach(block => {
                        if (!block.isConnected) {
                            return;
                        }

                        block.style.top =
                            `${
                                Number.parseInt(block.style.top, 10) + 30
                            }px`;
                    });
                });

                createRow(0);

                rowInterval = Math.max(
                    maxRowInterval,
                    rowInterval - 5000
                );
            }

            scheduleNextRow();
        }, rowInterval);
    }

    function clearKeys() {
        Object.keys(keys).forEach(key => {
            delete keys[key];
        });
    }

    if (
        !window.EasterEggs ||
        typeof window.EasterEggs.register !== 'function'
    ) {
        console.error(
            'CJ Breakout could not register because the EasterEggs loader is missing.'
        );

        return;
    }

    window.EasterEggs.register(GAME_NAME, {
        launch,
        stop
    });
})();
