document.onreadystatechange = () => {
    if (document.readyState == "complete") {

        const mapGrid = document.querySelector('#mapGrid');
        const menuUI = document.querySelector('.menuUI');
        const menuButton = document.querySelector('.menuButton');
        const menuMessage = document.querySelector('.menuMessage');
        const scoreText = document.querySelector('#score');
        const HPText = document.querySelector('#HP');
        const levelText = document.querySelector('#level');

        // Creating the player element
        const player = document.createElement('div');
        player.setAttribute('entityType', "player");
        player.setAttribute('id', "player");
        player.classList.add('entity');

        /* Index of each neighbor tile (clockwise):

                        -Y
                        (0)
                         |
             -X (3) <- Tile -> (1) +X
                         |
                        (2)
                        +Y
        */

        // Player movement checks (same orientation as the neighbor tiles, clockwise starting from -Y)
        let moveChecks = [false, false, false, false], playerMoved = false;

        // Player stats
        let playerScore = 0;
        let playerHP = 3;
        let level = 1;
        let bombStorage;
        let bombRange;
        let playerInvincibility = false;

        // Ammount of each tile of a certain type
        let groundTiles, breakableTiles, unbreakableTiles;

        // Game state
        let gameState = "newGame";

        // Quantity of enemies and bombs in game
        let enemyEntities;
        let bombEntities = 0;

        // If it's the first move from the enemy it will be completely random
        let enemyLastMovements = [];
        let enemyMovement;

        // Bomb countdowns
        let bombTimers = [];
        let explosionTilesTimer = false;

        // Creating the game screen grid 
        for (tileY = 0; tileY <= 7; tileY++) {
            for (tileX = 0; tileX <= 15; tileX++) {
                let currTile = document.createElement('div');
                currTile.setAttribute('id', `t${tileY}${tileX}`);
                mapGrid.appendChild(currTile);
            }
        }

        function randomNum(range) {
            return Math.floor(Math.random() * range); // Math.random returns a number between 0 and 1 (including 0 but not 1)
        }

        function calculateProbability(numerator, denominator) {

            let outcomesArray = [];

            // Considering that 15% = 15/100 = 3/20

            // Add "true" outcomes corresponding to the numerator
            for (i = 0; i < numerator; i++) {
                outcomesArray.push(true);
            }

            // Add the rest with "false"
            for (i = 0; i < denominator - numerator; i++) {
                outcomesArray.push(false)
            }

            return outcomesArray[randomNum(denominator)];

        }

        /* The map generation algorithm works on areas of 4x4 tiles:
                 Area 0            Area 1
            +---+---+---+---+ +---+---+---+---+
            |00 |01 |02 |03 | |04 |05 |06 |07 |
            +---+---+---+---+ +---+---+---+---+
            |10 |11 |12 |13 | |14 |15 |16 |17 |
            +---+---+---+---+ +---+---+---+---+ ... Area 3
            |20 |21 |22 |23 | |24 |25 |26 |27 |
            +---+---+---+---+ +---+---+---+---+
            |30 |31 |32 |33 | |34 |35 |36 |37 |
            +---+---+---+---+ +---+---+---+---+
            ----------------------------------------------------------
                  Area 4
            +---+---+---+---+
            |40 |41 |42 |43 |
            +---+---+---+---+
            |50 |51 |52 |53 |
            +---+---+---+---+ ... Area 7 (8 areas in total)
            |60 |61 |62 |63 |
            +---+---+---+---+
            |70 |71 |72 |73 |
            +---+---+---+---+
            Each area can have 7 ground tiles, 3 unbreakable tiles on the middle and 6 breakable tiles.
            There is an exception for the first area, in which the player spawns. In that area it's guaranteed
            that there will be at least 3 ground tiles and a breakable tile on the top-left corner so then the 
            player can't be locked.
        */

        function generateNewMap() {

            let areaTileY, areaTileX; // Local (inside the area) tile coordinates
            let tileY, tileX; // Global coordinates
            let availableTypes; // Available type of tiles to an area
            let currTile; // Current tile element

            for (areaCoordY = 0; areaCoordY <= 1; areaCoordY++) {
                for (areaCoordX = 0; areaCoordX <= 3; areaCoordX++) {

                    // Resetting each area
                    groundTiles = 0;
                    breakableTiles = 0;
                    unbreakableTiles = 0;

                    for (areaTileY = 0; areaTileY <= 3; areaTileY++) {
                        for (areaTileX = 0; areaTileX <= 3; areaTileX++) {

                            // Selecting the tile based on it's global coordinates
                            tileY = areaTileY + areaCoordY * 4;
                            tileX = areaTileX + areaCoordX * 4;
                            currTile = getTileByCoordinates(tileY, tileX);

                            // Player lock check
                            if (tileX < 2 && tileY < 2) {
                                if (tileX == 1 && tileY == 1) {
                                    breakableTiles++;
                                    currTile.setAttribute('tileType', 'breakable');
                                }
                                else {
                                    groundTiles++;
                                    currTile.setAttribute('tileType', 'ground');
                                }
                            } else {
                                // Check ammount of each tile 
                                availableTypes = ['ground', 'breakable'];

                                // Prevents area locking by only spawning unbreakable tiles in the center of the area
                                if (areaTileX > 0 && areaTileX < 3 && areaTileY > 0 && areaTileY < 3) {

                                    let midTiles = [getTileByCoordinates(1 + areaCoordY * 4, 1 + areaCoordX * 4),
                                    getTileByCoordinates(1 + areaCoordY * 4, 2 + areaCoordX * 4),
                                    getTileByCoordinates(2 + areaCoordY * 4, 1 + areaCoordX * 4),
                                    getTileByCoordinates(2 + areaCoordY * 4, 2 + areaCoordX * 4)];

                                    // Filters tiles that aren't unbreakable if there is any
                                    let notUnbreakableTiles = filterTilesByTypes(midTiles, "ground", "breakable");
                                    notUnbreakableTiles = notUnbreakableTiles.filter((tile) => tile ? true : false);

                                    if (notUnbreakableTiles[0]) {
                                        availableTypes = ['unbreakable'];
                                    } else {
                                        availableTypes.push("unbreakable");
                                    }

                                }

                                if (groundTiles == 7) {
                                    availableTypes = availableTypes.filter(type => type == 'ground' ? false : true);
                                }
                                if (breakableTiles == 6) {
                                    availableTypes = availableTypes.filter(type => type == 'breakable' ? false : true);
                                }
                                if (unbreakableTiles == 3) {
                                    availableTypes = availableTypes.filter(type => type == 'unbreakable' ? false : true);
                                }
                                currTile.setAttribute('tileType', availableTypes[randomNum(availableTypes.length)]);
                                switch (currTile.getAttribute('tileType')) {
                                    case 'ground':
                                        groundTiles++;
                                        break;
                                    case 'breakable':
                                        breakableTiles++;
                                        break;
                                    case 'unbreakable':
                                        unbreakableTiles++;
                                        break;
                                }
                            }
                        }
                    }
                }
            }
        }

        function clearMap() {
            // Disabling bomb timers
            bombTimers.forEach((timer) => { if(timer){
                clearTimeout(timer)
            }})
            bombTimers = []
            if (explosionTilesTimer){
                clearTimeout(explosionTilesTimer)
            }
            for (tileY = 0; tileY <= 7; tileY++) {
                for (tileX = 0; tileX <= 15; tileX++) {

                    // Resetting the tile
                    let currTile = mapGrid.querySelector(`#t${tileY}${tileX}`);
                    currTile.setAttribute('tileType', "");

                    // Checking if there's any entity in it
                    if (currTile.children.length > 0) {
                        currTile.removeChild(getEntityOf(currTile))
                    }

                }
            }
        }

        function getTileCoordinates(tile) {
            return [parseInt(tile.getAttribute('id').slice(1, 2)), parseInt(tile.getAttribute('id').slice(2))]
        }

        function getTileByCoordinates(tileY, tileX) {

            let tile = mapGrid.querySelector(`#t${tileY}${tileX}`);

            // Check if coordinate is out of bounds
            return tile != null ? tile : false;
        }

        function getTileByEntity(entity) {
            return entity.parentElement;
        }

        function getNeighborTiles(currTile) {

            let neighborTiles = new Array(4);
            let [tileY, tileX] = getTileCoordinates(currTile);

            neighborTiles[0] = getTileByCoordinates(tileY - 1, tileX);
            neighborTiles[1] = getTileByCoordinates(tileY, tileX + 1);
            neighborTiles[2] = getTileByCoordinates(tileY + 1, tileX);
            neighborTiles[3] = getTileByCoordinates(tileY, tileX - 1);

            return neighborTiles.map((tile) => {
                return tile ? tile : false;
            })

        }

        function filterTilesByTypes(tiles, ...types) {
            let tileType;
            let allowedType;
            return tiles.map(tile => {
                if (tile) {
                    tileType = tile.getAttribute('tileType');
                    allowedType = types.filter(type => type == tileType ? true : false);
                    if (allowedType[0]) {
                        return tile;
                    } else {
                        return false;
                    }
                }
                return false;
            })
        }

        // Filters empty or occupied tiles
        function filterTilesByEntity(tiles, entity) {
            let allowedEntities = [];
            let tileEntity;
            return tiles.map(tile => {
                if (tile) {

                    // Checks if tile has an entity on it
                    tileEntity = getEntityOf(tile);

                    if (tileEntity) {

                        // Checks which entity can interact with one another
                        switch (entity) {
                            case "enemy":
                                allowedEntities.push("player");
                                allowedEntities.push("explosion");
                                break;
                            case "player":
                                allowedEntities.push("enemy");
                                allowedEntities.push("powerUp");
                                allowedEntities.push("explosion");
                                break;
                        }

                        for (type of allowedEntities) {
                            if (tileEntity.getAttribute('entityType') == type) {
                                return tile;
                            }
                        }

                    } else {
                        return tile;
                    }

                }
                return false;
            })
        }

        function getRandomDirection(possibleDirections, lastMoveDirection) {

            // Prevents enemy from going backwards without needing it
            let filteredDirections = [];
            possibleDirections.forEach((move, ind) => {
                if (move) {
                    if (lastMoveDirection == "idle") {
                        filteredDirections.push(ind);
                    } else {
                        if (lastMoveDirection < 2) {
                            if (ind != lastMoveDirection + 2) {
                                filteredDirections.push(ind);
                            }
                        } else {
                            if (ind != lastMoveDirection - 2) {
                                filteredDirections.push(ind);
                            }
                        }
                    }
                }
            });

            return filteredDirections[randomNum(filteredDirections.length)];
        }

        function spawnEntity(entity, tile) {

            if (entity != "player") {
                let entityCreated = document.createElement('div');
                let entityId = entity.slice(0, 2);
                entityCreated.setAttribute('entityType', entity);
                entity = entityCreated;
                switch (entity.getAttribute('entityType')) {
                    case "enemy":
                        entityId = entityId + enemyEntities.toString();
                        entity.setAttribute('id', entityId);
                        enemyEntities++;
                        break;
                    case "bomb":
                        entityId = entityId + bombEntities.toString();
                        entity.setAttribute('id', entityId);
                        bombEntities++;
                        break;
                    case "powerUp":
                        if (randomNum(2) == 1) {
                            entity.classList.add("bombRange");
                        } else {
                            entity.classList.add("bombStorage");
                        }
                        break;
                }
                entity.classList.add('entity');
            } else {
                entity = player;
            }

            // Checks if there is another entity already on the tile
            if (tile.children.length > 0) {
                tile.insertBefore(entity, getEntityOf(tile));
            } else {
                tile.appendChild(entity);
            }
        }

        function getEntityOf(tile, type = "none") {
            if (tile.children.length > 0) {
                return type != "none" ? tile.querySelector(`[entityType="${type}"]`) : tile.children[0];
            }
            return false;
        }

        function getEntityIdNum(entity) {
            return entity.getAttribute('id').slice(2);
        }

        function moveEntity(entity, direction = 0) {

            // Gets entity type
            let entityType = entity.getAttribute('entityType');

            // Gets entity's current tile and neighbor tiles
            let currTile = getTileByEntity(entity);
            let neighborTiles = getNeighborTiles(currTile);

            // Filters the possible directions that the entity can go
            let possibleDirections = filterTilesByTypes(neighborTiles, "ground");
            possibleDirections = filterTilesByEntity(possibleDirections, entityType);
            if (entityType == "enemy") {
                let enemyId = getEntityIdNum(entity);
                direction = checkEnemyTrajectory(possibleDirections, enemyId);
                if (direction != "stuck"){
                    setEnemySprite(entity, direction);
                }
            }

            // Gets the tile in which the entity will move to
            if (direction != "stuck") {

                let nextTile = possibleDirections[direction];

                // Checks if there's any other entity in the tile
                if (nextTile) {
                    checkCollision(nextTile, entityType);
                    if (entityType != "player" || gameState == "playing") {
                        nextTile.appendChild(entity);
                    }
                }
            }
        }

        function checkCollision(nextTile, entity) {

            let nextTileEntity = getEntityOf(nextTile);
            if (nextTileEntity && gameState == "playing") {

                let nextTileEntityType = nextTileEntity.getAttribute('entityType');

                switch (entity) {
                    case "player":
                        switch (nextTileEntityType) {
                            case "enemy":
                            case "explosion":
                                applyPlayerDamage(nextTile);
                                break;
                            case "powerUp":
                                addScore(75);
                                if (nextTileEntity.classList.contains("bombStorage")) {
                                    if (bombStorage < 4) {
                                        bombStorage++;
                                    }
                                } else {
                                    if (bombRange < 3) {
                                        bombRange++;
                                    }
                                }
                                nextTile.removeChild(nextTileEntity);
                                break;
                        }
                        break;
                    case "enemy":
                        if (nextTileEntityType == "player") applyPlayerDamage(nextTile);
                        break;
                    case "explosion":
                        switch (nextTileEntityType) {
                            case "player":
                                applyPlayerDamage(nextTile)
                                break;
                            case "enemy":
                                nextTile.removeChild(nextTileEntity);
                                enemyEntities--;
                                if (enemyEntities > 0) {
                                    addScore(100)
                                } else {
                                    addScore(500);
                                    changeGameState('won');
                                }
                                break;
                            case "bomb":
                                let bombId = getEntityIdNum(nextTileEntity);
                                clearTimeout(bombTimers[bombId]);
                                bombExplosion(nextTile);
                                break;
                        }
                        break;
                }
            }
        }

        function addScore(value) {
            if (playerScore < 10000) {
                playerScore += value;
                scoreText.innerHTML = "Score: " + playerScore;
            } else {
                if (scoreText.innerHTML != "Score: 9999+") {
                    scoreText.innerHTML = "Score: 9999+";
                }
            }
        }

        function spawnEnemies(level) {

            let area = 7, areaTiles; // Array containing all of the tiles from an area (where the enemy will spawn)
            let ranTile; // Random tile that the enemy will spawn on top
            let qtyEnemies, count;
            enemyLastMovements = [] // Resets the enemy movements array

            if (level > 7) {
                qtyEnemies = 7;
            } else {
                qtyEnemies = level;
            }

            // Spawns enemies on random tiles from specific areas according to the level
            for (count = 1; count <= qtyEnemies; count++) {
                areaTiles = Array.from(document.querySelectorAll('[tileType="ground"]'));
                areaTiles = areaTiles.filter(tile => {

                    let [tileY, tileX] = getTileCoordinates(tile);

                    // Checks which area it is
                    switch (area) {
                        case 0:
                            return (tileX <= 3 && tileY <= 3) ? true : false;
                        case 1:
                            return ((tileX >= 4 && tileX <= 7) && tileY <= 3) ? true : false;
                        case 2:
                            return ((tileX >= 8 && tileX <= 11) && tileY <= 3) ? true : false;
                        case 3:
                            return (tileX >= 12 && tileY <= 3) ? true : false;
                        case 4:
                            return (tileX <= 3 && tileY >= 4) ? true : false;
                        case 5:
                            return ((tileX >= 4 && tileX <= 7) && tileY >= 4) ? true : false;
                        case 6:
                            return ((tileX >= 8 && tileX <= 11) && tileY >= 4) ? true : false;
                        case 7:
                            return (tileX >= 12 && tileY >= 4) ? true : false;
                    }

                })
                area--;

                ranTile = areaTiles[randomNum(areaTiles.length)];

                spawnEntity("enemy", ranTile);
                enemyLastMovements.push("idle");

            }
        }

        // Enemy movement cycle
        function startEnemyMovement(level) {
            if (enemyMovement) {
                clearInterval(enemyMovement);
            }
            let movementInterval = level >= 8 ? 300 : 1650 - level * 150;
            enemyMovement = setInterval(() => {
                if (gameState == "playing") {

                    // Gets each enemy on-screen and moves them
                    let enemies = Array.from(mapGrid.querySelectorAll('[entityType="enemy"]'));
                    enemies.forEach((enemy) => {
                        moveEntity(enemy);
                    })

                }
            }, movementInterval);
        }

        function checkEnemyTrajectory(possibleDirections, enemyId) {

            let moveDirection;
            let [upperTile, rightTile, lowerTile, leftTile] = possibleDirections;
            let enemyLastMove = enemyLastMovements[parseInt(enemyId)];

            // Checks if the enemy can move
            if (upperTile || rightTile || lowerTile || leftTile) {

                // Checks if it's a crossroad or the first move
                if ((upperTile && rightTile) || (upperTile && leftTile) ||
                    (rightTile && lowerTile) || (lowerTile && leftTile) ||
                    enemyLastMove == "idle") {

                    // Enemy picks random direction
                    moveDirection = getRandomDirection(possibleDirections, enemyLastMove);

                } else {

                    // Enemy follows straight line or goes to the opposite direction
                    if (possibleDirections[enemyLastMove]) {
                        moveDirection = enemyLastMove;
                    } else {
                        if (enemyLastMove < 2) {
                            moveDirection = enemyLastMove + 2;
                        } else {
                            moveDirection = enemyLastMove - 2;
                        }
                    }

                }
                enemyLastMovements[parseInt(enemyId)] = moveDirection;
            }
            else {
                moveDirection = "stuck";
            }

            return moveDirection;
        }

        function setEnemySprite(enemy, direction){
            switch(direction){
                case 0:
                    enemy.style.backgroundImage = "url(media/enemyUp.png)";
                    break;
                case 1:
                    enemy.style.backgroundImage = "url(media/enemyRight.png)";
                    break;
                case 2:
                    enemy.style.backgroundImage = "url(media/enemyDown.png)";
                    break;
                case 3:
                    enemy.style.backgroundImage = "url(media/enemyLeft.png)";
                    break;
            }
        }

        function changeGameState(newState) {
            gameState = newState;
            switch (newState) {
                case "playing":
                    menuUI.style.display = "none";
                    menuMessage.style.display = "none";
                    break;
                case "won":
                    menuButton.value = "Next level";
                    menuUI.style.display = "flex";
                    menuMessage.innerHTML = "You won!";
                    menuMessage.style.display = "flex";
                    break;
                case "lost":
                    menuButton.value = "Restart game";
                    menuUI.style.display = "flex";
                    menuMessage.innerHTML = "You lose.";
                    menuMessage.style.display = "flex";
                    break;
            }
        }

        function bombExplosion(mainTile) {

            // Removes the bomb
            mainTile.removeChild(mainTile.querySelector('[entityType="bomb"]'));
            bombEntities--;

            if (bombEntities == 0) {
                bombTimers = []
            }

            // Spawns the explosion area
            checkCollision(mainTile, "explosion");
            spawnEntity("explosion", mainTile);

            let neighborTiles = getNeighborTiles(mainTile);
            let currTile, nextTile, explosionArea, explodedTiles = [mainTile];

            explosionArea = filterTilesByTypes(neighborTiles, "ground", "breakable");
            explosionArea.forEach((tile, explosionDirection) => {
                nextTile = tile;

                // Cycles until it reaches the maximum bomb range available for the current direction
                for (currTile = 1; currTile <= bombRange; currTile++) {
                    if (nextTile) {
                        if (nextTile.getAttribute('tileType') == "breakable") {
                            nextTile.setAttribute('tileType', 'ground');
                            addScore(20);
                            spawnEntity("explosion", nextTile);

                            // 15% chance of dropping a powerup
                            if (calculateProbability(3, 20)) {
                                spawnEntity("powerUp", nextTile);
                            }

                        } else {

                            checkCollision(nextTile, "explosion");
                            spawnEntity("explosion", nextTile);

                        }
                        explodedTiles.push(nextTile);
                        neighborTiles = getNeighborTiles(nextTile);
                        neighborTiles = filterTilesByTypes(neighborTiles, "ground", "breakable");
                        nextTile = neighborTiles[explosionDirection];
                    }
                }
            })
            explosionTilesTimer = setTimeout(() => {
                for (currTile of explodedTiles) {
                    currTile.removeChild(currTile.querySelector('[entityType="explosion"]'));
                }
            }, 500)
        }

        function applyPlayerDamage() {
            if (playerInvincibility == false) {
                playerHP--;
                HPText.innerHTML = "HP: " + playerHP;
                if (playerHP == 0) {
                    player.parentElement.removeChild(player);
                    changeGameState("lost");
                } else {
                    playerInvincibility = true;
                    let invincibleFrames = setInterval(() => {
                        player.style.visibility = player.style.visibility == "visible" ? "hidden" : "visible";
                    }, 75);
                    setTimeout(() => {
                        clearInterval(invincibleFrames);
                        player.style.visibility = "visible";
                        playerInvincibility = false;
                    }, 3000);
                }
            }
        }

        function generateLevel(level) {

            clearMap();
            generateNewMap();
            spawnEntity("player", document.querySelector("#t00"));
            enemyEntities = 0;
            bombEntities = 0;
            spawnEnemies(level);
            startEnemyMovement(level);
            bombStorage = 1;
            bombRange = 1;

        }

        menuButton.addEventListener('click', e => {
            switch (gameState) {
                case "lost":
                    playerScore = 0;
                    level = 1;
                    playerHP = 3;
                    HPText.innerHTML = "HP: " + playerHP;
                    break;
                case "won":
                    level++;
                    break;
            }
            if (gameState != "newGame") {
                generateLevel(level);
                scoreText.innerHTML = "Score: " + playerScore;
                levelText.innerHTML = "Level: " + level;
            }
            changeGameState("playing");
        })

        function checkPlayerMovement(direction, event) {

            // When the player presses and hold the key
            if (event == "keyPressed") {

                if (gameState == "playing") {
                    if (moveChecks[direction] == false) {
                        moveChecks[direction] = setInterval(() => {
                            moveEntity(player, direction);
                            playerMoved = true;
                        }, 250);
                    }
                }

                // When the player releases the key
            } else {
                if (moveChecks[direction] != false) {
                    clearInterval(moveChecks[direction]);
                    moveChecks[direction] = false;
                }

                if (gameState == "playing") {
                    if (playerMoved == false) {
                        moveEntity(player, direction);
                    } else {
                        playerMoved = false;
                    }
                }
            }
        }

        document.addEventListener('keydown', e => {
            e.preventDefault();
            let keyPressed = e.key;
            if (gameState == "playing") {
                switch (keyPressed) {
                    case 'w':
                    case 'ArrowUp':
                        player.style.backgroundImage = "url(media/playerUp.png)"
                        checkPlayerMovement(0, "keyPressed");
                        break;
                    case 'd':
                    case 'ArrowRight':
                        player.style.backgroundImage = "url(media/playerRight.png)"
                        checkPlayerMovement(1, "keyPressed");
                        break;
                    case 's':
                    case 'ArrowDown':
                        player.style.backgroundImage = "url(media/playerDown.png)"
                        checkPlayerMovement(2, "keyPressed");
                        break;
                    case 'a':
                    case 'ArrowLeft':
                        player.style.backgroundImage = "url(media/playerLeft.png)"
                        checkPlayerMovement(3, "keyPressed");
                        break;
                }
            }
        })

        document.addEventListener('keyup', e => {
            let keyReleased = e.key;
            switch (keyReleased) {
                case 'w':
                case 'ArrowUp':
                    checkPlayerMovement(0, "keyReleased");
                    break;
                case 'd':
                case 'ArrowRight':
                    checkPlayerMovement(1, "keyReleased");
                    break;
                case 's':
                case 'ArrowDown':
                    checkPlayerMovement(2, "keyReleased");
                    break;
                case 'a':
                case 'ArrowLeft':
                    checkPlayerMovement(3, "keyReleased");
                    break;
                case " ":
                    if (gameState == "playing" && bombEntities < bombStorage && getEntityOf(player.parentElement, "bomb") == null) {
                        let currTile = player.parentElement;
                        spawnEntity("bomb", currTile);
                        bombTimers.push(setTimeout(() => { bombExplosion(currTile) }, 3500));
                    }
                    break;
            }
        })

        generateLevel(level);
    }
}

