(function() {
    //Get canvas and context
    var c   = document.getElementById('canvas'),
        ctx = c.getContext('2d');

    //Load assets
    var bgImg = loadImage('assets/background.jpg', 640, 480),
        playerImg = loadImage('assets/player.png', 192, 64),
        enemyUpImg = loadImage('assets/enemy_up.png', 64, 316),
        enemyDownImg = loadImage('assets/enemy_down.png', 64, 316);

    var pointAudio = new Audio('assets/point.mp3'),
        loseAudio = new Audio('assets/lose.mp3');

    //Helper methods
    function loadImage(src, width, height) {
        var img = new Image(width, height);
        img.src = src;
        return img;
    }

    function randomIntFromInterval(min,max) {
        return Math.floor(Math.random()*(max-min+1)+min);
    }

    var textAlpha = (function() {
        var alpha = 1,
            shouldIncrease = false;
        return {
            fluctuate: function() {
                if (alpha < 0) shouldIncrease = true;
                if (alpha > 1) shouldIncrease = false;

                if (shouldIncrease) alpha += 0.02;
                else alpha -= 0.02;

                return alpha;
            },
            get: function() {
                return alpha;
            }
        };
    })();

    //Game constants
    var PLAYER_CONTROLS_ON = false;
    var GAME_PLAYING = false;

    //Classes & objects
    //******* Score counter object **********//
    var scoreCounter = {
        //state
        _score: 0,
        //methods
        increaseScore: function() {
            this._score++;
            pointAudio.play();
        },
        getScore: function() {
            return this._score;
        },
        reset: function() {
            this._score = 0;
        }
    };

    //******* Background Constructor **********//
    function Background(x, y, speed, img) {
        this.x = x || 0;
        this.y = y || 0;
        this.img   = img || bgImg;
        this.speed = speed || 1;
    }
    Background.prototype = {
        move: function() {
            this.x -= this.speed;
            if (this.x <= -this.img.width) {
                this.x = c.width;
            }
        }
    };

    //******* Player Object **********//
    //fps locking vars
    var fpsCounter = Date.now(), //custom timer to restrict fps
        fps = 30;
    //free falling counter
    var fallingCounter = Date.now();
    //Player
        player = {
        //private state
        _currentFrame: 0,

       //public properties
        //physics
        velocity: 2,
        force: 0.15,
        //positional
        x: 70,
        y: 20,
        width: 64,
        height: 64,

        //methods
        jump: function() {
            this.velocity = -6;
        },
        fall: function() {
            var now = Date.now();
            if (now - fallingCounter > 1000 / fps) {
                if (this.velocity < 8) this.velocity += this.force;
                this.y += this.velocity;
            }
        },
        hasCollided: function() {
            var hasCollided = false;

            var playerX  = this.x + this.width,
                playerTopY    = this.y,
                playerBottomY = this.y + this.height;

            var enemyX = enemies[nextEnemyId].enemyDown.x + 40,
                enemyLookingDownY = enemies[nextEnemyId].enemyDown.y + enemies[nextEnemyId].enemyDown.img.height,
                enemyLookingUpY = enemies[nextEnemyId].enemyUp.y,
                enemyWidth = enemies[nextEnemyId].enemyDown.img.width;

            //when the enemy is inside an obstacle
            if (playerX > enemyX && playerX < enemyX + enemyWidth - 40) {
                //check for collision and tag player as collided if they hit an obstacle
                if (playerTopY < enemyLookingDownY || playerBottomY > enemyLookingUpY)
                    hasCollided = true;
            }

            //if the player goes above/below screen tag as collided
            if (playerBottomY < 0 || playerTopY > c.height) {
                hasCollided = true;
            }

            if (hasCollided & PLAYER_CONTROLS_ON) loseAudio.play();

            //return collision result
            return hasCollided;
        },
        reset: function() {
            this.velocity = 2;
            this.y = 20;
        },
        getNextFrame: function() {
            var now = Date.now();
            if (now - fpsCounter > 1000 / fps) {
                fpsCounter = now;
                this._currentFrame++;
                if (this._currentFrame > 2) this._currentFrame = 0;
            }
            return this._currentFrame;
        }
    };

    //******* Enemy Constructor **********//
    //constants
    var ENEMY_NUMBER = 5,     //how many sets of enemies
        ENEMY_OFFSET = 300,   //horizontal distance between obstacles
        ENEMY_DISTANCE = 120, //vertical opening between obstacles
        MAX_YOFFSET = 50,
        MIN_YOFFSET = -150;
    //Enemy IDs
    var nextEnemyId, lastEnemyId; // defined in setupEnemies()

    function Enemy(id, y, yOffset, imgDirectionIsUp, speed, img) {
        if (typeof id === 'undefined') throw new Error('Parameter ID must be defined');
        this.id = id;
        this.imgDirectionIsUp = typeof imgDirectionIsUp === 'undefined' ? true : imgDirectionIsUp;
        this.yOffset = yOffset || 0;

        this.x = c.width + id * ENEMY_OFFSET || 0;
        if
            (this.imgDirectionIsUp) this.y = y + ENEMY_DISTANCE + this.yOffset || 0;
        else
            this.y = y - ENEMY_DISTANCE + this.yOffset || 0;

        this.speed = speed || 3;
        this.img = img || (this.imgDirectionIsUp ? enemyUpImg : enemyDownImg);
    }
    Enemy.prototype = {
        move: function() {
            this.x -= this.speed;
            if (this.x <= -this.img.width && this.imgDirectionIsUp) {
                //Set x of this enemy set to next enemy set + enemy offset
                this.x = enemies[this.id].enemyDown.x = enemies[lastEnemyId].enemyUp.x + ENEMY_OFFSET;
                //Set new random Y
                this.yOffset = enemies[this.id].enemyDown.yOffset = randomIntFromInterval(MIN_YOFFSET, MAX_YOFFSET);
                //Update last enemy ID
                lastEnemyId = lastEnemyId === ENEMY_NUMBER - 1 ? 0 : lastEnemyId + 1;
            }
            if (this.id === nextEnemyId && this.x + this.img.width < player.x + player.width) {
                //Update next enemy ID
                nextEnemyId = nextEnemyId === ENEMY_NUMBER - 1 ? 0 : nextEnemyId + 1;
                //Increase the score
                if (PLAYER_CONTROLS_ON) scoreCounter.increaseScore();
            }
        }
    };

    //Main functions
    var updateLoop;
    function update() {
        draw();
        updateLoop = window.requestAnimationFrame(update);
    }

    function draw() {
        //Set font style
        ctx.font = '48px Raleway';
        //Clean canvas
        ctx.clearRect(0, 0, c.width, c.height);
        //Draw next frame with props
        drawBackground();
        //If game hasn't started or player lost show splash screen text
        if (!GAME_PLAYING) {
            ctx.strokeStyle = 'rgba(0,0,0,' + textAlpha.get() + ')';
            ctx.strokeText('Click to start game', c.width / 2 - 230, 80);
            ctx.fillStyle = 'rgba(255,255,255,' + textAlpha.get() + ')';
            ctx.fillText('Click to start game', c.width / 2 - 230, 80);
            textAlpha.fluctuate();
        }
        //If game is playing draw everything
        else {
            drawEnemies();
            drawPlayer();
            //Draw the score
            ctx.fillStyle = 'black';
            ctx.strokeText(scoreCounter.getScore(), c.width / 2 - 11, 51);
            ctx.fillStyle = 'white';
            ctx.fillText(scoreCounter.getScore(), c.width / 2 - 10, 50);
        }
    }

    //Instantiate, draw and animate backgrounds
    var bg1 = new Background(0, 0);
    var bg2 = new Background(c.width, 0);

    function drawBackground() {
        ctx.drawImage(bg1.img, bg1.x, bg1.y);
        ctx.drawImage(bg2.img, bg2.x, bg2.y);
        bg1.move();
        bg2.move();
    }

    //Instantiate and draw player
    function drawPlayer() {
        //render player
        ctx.drawImage(playerImg, player.getNextFrame() * player.width, 0, //crop start
                      player.width, player.height, //crop end
                      player.x, player.y, //player pos
                      player.width, player.height); //player sprite size
        //move player
        player.fall();
        //collision check
        if (player.hasCollided()) {
            //deactivate player controls
            PLAYER_CONTROLS_ON = false;
            //when player falls of screen stop game
            if (player.y - player.height > c.height) GAME_PLAYING = false;
        }
    }

    //Set up initial enemy positions before rendering them
    var enemies = [];
    function setupEnemies() {
        nextEnemyId = 0;
        lastEnemyId = ENEMY_NUMBER - 1; //used to reposition enemies

        for (var i = 0; i < ENEMY_NUMBER; i++) {
            var yOffset = randomIntFromInterval(MIN_YOFFSET, MAX_YOFFSET);
            var enemySet = {
                enemyUp: new Enemy(i, c.height / 2, yOffset),
                enemyDown: new Enemy(i, 0, yOffset, false)
            };
            enemies[i] = enemySet;
        }
    }

    //Instantiate and draw enemies
    function drawEnemies() {
        for (var i = 0; i < enemies.length; i++) {
            ctx.drawImage(enemies[i].enemyUp.img, enemies[i].enemyUp.x, enemies[i].enemyUp.y);
            ctx.drawImage(enemies[i].enemyDown.img, enemies[i].enemyDown.x, enemies[i].enemyDown.y);
            enemies[i].enemyUp.move();
            enemies[i].enemyDown.move();
        }
    }

    //Reset game function
    function resetGame() {
        scoreCounter.reset();
        player.reset();
        setupEnemies();
    }

    //Register event handlers & kick off the game
    window.onload = function() {
        c.addEventListener('click', function() {
            if (PLAYER_CONTROLS_ON) {
                player.jump();
            }
            if (!GAME_PLAYING) {
                resetGame();
                GAME_PLAYING = true;
                PLAYER_CONTROLS_ON = true;
            }
        });

        update();
    };
})();
