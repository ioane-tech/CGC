import Player from "../gameobjects/player";
import { Debris } from "../gameobjects/particle";
import Bat from "../gameobjects/bat";
import Zombie from "../gameobjects/zombie";
import Turn from "../gameobjects/turn";
import Coin from "../gameobjects/coin";
import LunchBox from "../gameobjects/lunchbox";
import Platform from "../gameobjects/platform";
import Wall from "../gameobjects/wall";
import Door from "../gameobjects/door";
import NetworkManager from "../network/NetworkManager";
import Phaser from "phaser";

export default class Game extends Phaser.Scene {
  constructor() {
    super({ key: "game" });
    // Multiplayer support
    this.localPlayer = null;
    this.remotePlayers = new Map(); // playerId -> Player object
    this.networkManager = null;
    this.isMultiplayer = false;
    this.gameMode = "singleplayer";
    this.playerAttacks = null;
    this.allPlayersGroup = null;
    this.remotePlayerGroup = null;
    this.playerAttackCollider = null;
    this.healthText = null;
    this.onPlayerActionHandler = null;
    
    // Legacy single player support
    this.player = null;
    this.score = 0;
    this.scoreText = null;
  }

  init(data) {
    this.name = data.name;
    this.number = data.number;
  }

  preload() {}

  /*
    This function creates the game. It sets the width and height of the game, the center of the width and height, and the background color. Then it calls the functions to create the rest of the elements of the game.
    */
  create() {
    this.width = this.sys.game.config.width;
    this.height = this.sys.game.config.height;
    this.center_width = this.width / 2;
    this.center_height = this.height / 2;
    this.cameras.main.setBackgroundColor(0x62a2bf); //(0x00b140)//(0x62a2bf)
    
    // Check if we're in multiplayer mode
    this.gameMode = this.registry.get("gameMode") || "singleplayer";
    this.isMultiplayer = (this.gameMode === "host" || this.gameMode === "join");
    
    console.log("=== GAME SCENE STARTED ===");
    console.log("Game mode:", this.gameMode);
    console.log("Is multiplayer:", this.isMultiplayer);

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.handleSceneShutdown, this);
    this.events.once(Phaser.Scenes.Events.DESTROY, this.handleSceneShutdown, this);
    
    // Initialize multiplayer if needed
    if (this.isMultiplayer) {
      this.initializeMultiplayer();
    }
    
    // Create dynamic, responsive world dimensions
    const { worldWidth, worldHeight } = this.calculateResponsiveDimensions();
    
    // Add landscape.png as background
    const landscapeBackground = this.add.sprite(
      worldWidth / 2, 
      worldHeight / 2, 
      "landscape"
    );
    
    // Scale the background to cover the entire world
    landscapeBackground.setDisplaySize(worldWidth, worldHeight);
    
    // Send background to the back so other elements appear on top
    landscapeBackground.setDepth(-1000);
    
    // Optionally add clean room overlay (comment out if you want pure landscape)
    // this.createCleanRoomBackground(worldWidth, worldHeight);
    
    // Temporarily disable tilemap for testing
    // this.createMap();
    
    // Create basic groups for game objects
    this.batGroup = this.add.group();
    this.zombieGroup = this.add.group();
    this.foesGroup = this.add.group();
    this.turnGroup = this.add.group();
    this.exitGroup = this.add.group();
    this.platformGroup = this.add.group();
    this.lunchBoxGroup = this.add.group();
    this.bricks = this.add.group();
    this.playerAttacks = this.physics.add.group({ allowGravity: false });
    this.allPlayersGroup = this.physics.add.group();
    this.remotePlayerGroup = this.physics.add.group();
    if (this.playerAttackCollider) {
      this.playerAttackCollider.destroy();
    }
    this.playerAttackCollider = this.physics.add.overlap(
      this.playerAttacks,
      this.allPlayersGroup,
      this.handlePlayerAttackHit,
      null,
      this
    );
    
    // Create walls and doors for the landscape room
    this.createWallsAndDoors();

    this.cameras.main.setBounds(0, 0, worldWidth, worldHeight);
    this.physics.world.setBounds(0, 0, worldWidth, worldHeight);
    this.addPlayer();

    // MMORPG-style camera: follow local player smoothly from slightly above
    const playerToFollow = this.isMultiplayer ? this.localPlayer : this.player;
    this.cameras.main.startFollow(playerToFollow, true, 0.08, 0.08, 0, -100);
    
    // Responsive camera zoom based on room size
    const baseZoom = Math.min(this.width / worldWidth, this.height / worldHeight) * 1.2;
    this.cameras.main.setZoom(Math.max(0.5, Math.min(2.0, baseZoom))); // Clamp zoom between 0.5x and 2.0x
    
    // Enable physics for the appropriate player
    if (this.isMultiplayer) {
      this.physics.world.enable([this.localPlayer]);
    } else {
      this.physics.world.enable([this.player]);
    }
    this.addScore();
    this.addHealthUI();
    if (this.player) {
      this.updateHealthUI(this.player.health, this.player.maxHealth);
    }
    this.loadAudios();
    this.createMuteButton();
    this.playMusic();
  }

  /*
    This function adds the score to the game. It creates the text and the coin icon. It will be updated when the player picks a coin.
    */
  addScore() {
    this.scoreCoins = this.add
      .bitmapText(75, 10, "pixelFont", "x0", 30)
      .setDropShadow(0, 4, 0x222222, 0.9)
      .setOrigin(0)
      .setScrollFactor(0);
    this.scoreCoinsLogo = this.add
      .sprite(50, 25, "coin")
      .setScale(1)
      .setOrigin(0.5)
      .setScrollFactor(0);
    const coinAnimation = this.anims.create({
      key: "coinscore",
      frames: this.anims.generateFrameNumbers("coin", { start: 0, end: 7 }),
      frameRate: 8,
    });
    this.scoreCoinsLogo.play({ key: "coinscore", repeat: -1 });
  }

  /*
    Creates the mute/unmute button in the top-right corner
    */
  createMuteButton() {
    // Initialize global mute state if not set
    if (this.registry.get("audioMuted") === undefined) {
      this.registry.set("audioMuted", false);
    }

    const isMuted = this.registry.get("audioMuted");
    const buttonTexture = isMuted ? "muteButton" : "unmuteButton";

    // Position button in top-right corner
    this.muteButton = this.add
      .sprite(this.width - 50, 30, buttonTexture)
      .setScrollFactor(0)
      .setInteractive({ useHandCursor: true })
      .setScale(1.5);

    // Add click handler
    this.muteButton.on('pointerdown', () => {
      this.toggleMute();
    });

    // Add hover effects
    this.muteButton.on('pointerover', () => {
      this.muteButton.setScale(1.7);
    });

    this.muteButton.on('pointerout', () => {
      this.muteButton.setScale(1.5);
    });
  }

  /*
    Toggles the mute state and updates all audio
    */
  toggleMute() {
    const currentMuted = this.registry.get("audioMuted");
    const newMuted = !currentMuted;
    
    // Update global state
    this.registry.set("audioMuted", newMuted);
    
    // Update button texture
    this.muteButton.setTexture(newMuted ? "muteButton" : "unmuteButton");
    
    // Apply mute state to Phaser's sound manager
    this.sound.mute = newMuted;
    
    // Update theme music if it exists
    if (this.theme) {
      this.theme.setMute(newMuted);
    }
    
    // Play a brief feedback sound when unmuting (but not when muting)
    if (!newMuted && this.audios && this.audios.coin) {
      this.time.delayedCall(100, () => {
        this.audios.coin.play({ volume: 0.3 });
      });
    }
  }

  /*
    Calculate responsive world dimensions based on screen size and aspect ratio
    */
  calculateResponsiveDimensions() {
    const screenWidth = this.sys.game.config.width;
    const screenHeight = this.sys.game.config.height;
    const aspectRatio = screenWidth / screenHeight;
    
    // Base dimensions (minimum room size)
    const minWidth = 800;
    const minHeight = 600;
    
    // Target aspect ratio for the room (landscape.png ratio)
    const targetAspectRatio = 1400 / 1200; // ~1.17
    
    let worldWidth, worldHeight;
    
    // Responsive scaling based on screen size
    if (aspectRatio > targetAspectRatio) {
      // Wide screen - scale based on height
      worldHeight = Math.max(minHeight, screenHeight * 1.5);
      worldWidth = worldHeight * targetAspectRatio;
    } else {
      // Tall screen - scale based on width  
      worldWidth = Math.max(minWidth, screenWidth * 1.5);
      worldHeight = worldWidth / targetAspectRatio;
    }
    
    // Ensure minimum dimensions
    worldWidth = Math.max(worldWidth, minWidth);
    worldHeight = Math.max(worldHeight, minHeight);
    
    // Store for use in other methods
    this.roomWidth = worldWidth;
    this.roomHeight = worldHeight;
    
    return { worldWidth, worldHeight };
  }

  /*
    This function creates walls and doors for the landscape room based on the landscape.png layout.
    It creates invisible collision rectangles that match the room boundaries and a door trigger area.
    */
  createWallsAndDoors() {
    // Create wall and door groups
    this.wallGroup = this.add.group();
    this.doorGroup = this.add.group();

    // Use responsive room dimensions
    const roomWidth = this.roomWidth;
    const roomHeight = this.roomHeight;
    const wallThickness = Math.max(32, Math.min(64, roomWidth * 0.045)); // Responsive wall thickness

    // Top wall (full width)
    const topWall = new Wall(this, roomWidth / 2, wallThickness * 6.1, roomWidth, wallThickness);
    this.wallGroup.add(topWall);

    // Bottom wall (full width)
    const bottomWall = new Wall(this, roomWidth / 2, roomHeight - wallThickness / 2, roomWidth, wallThickness);
    this.wallGroup.add(bottomWall);

     // Responsive left wall with 60-degree angled corner (bottom to top)
     const angleLength = roomHeight * 0.6; // Responsive angle length (60% of room height)
     const leftWallHeight = roomHeight - angleLength * Math.sin(Math.PI / 3) - wallThickness * 2;
     
     // Main vertical left wall (upper portion)
     const leftWallMain = new Wall(this, wallThickness / 2, leftWallHeight / 2, wallThickness, leftWallHeight);
     this.wallGroup.add(leftWallMain);
     
     // Responsive angle segments based on room size
     const angleSegments = Math.max(50, Math.min(200, roomWidth / 7)); // Dynamic segment count
     const angleStartY = roomHeight - wallThickness; // Start from bottom
     const angleOffset = wallThickness * 2.2; // Responsive offset
     
     for (let i = 0; i < angleSegments; i++) {
       const progress = i / angleSegments;
       const angle = -Math.PI / 3; // -60 degrees (negative for upward angle)
       
       const segmentX = wallThickness - angleOffset + (progress * angleLength * Math.cos(angle));
       const segmentY = angleStartY + (progress * angleLength * Math.sin(angle));
       
       // Create responsive wall segment
       const segmentSize = wallThickness / 2;
       const angleWall = new Wall(this, segmentX, segmentY, segmentSize, segmentSize);
       this.wallGroup.add(angleWall);
     }

    // Responsive door positioning (centered vertically with proportional sizing)
    const doorHeight = roomHeight * 0.1; // 16% of room height
    const doorY = (roomHeight - doorHeight) / 2; // Center the door vertically
    
    // Right wall top part
    const rightWallTop = new Wall(this, roomWidth - wallThickness / 2, doorY / 2, wallThickness, doorY);
    this.wallGroup.add(rightWallTop);

    // Right wall bottom part
    const rightWallBottom = new Wall(this, roomWidth - wallThickness / 2, doorY + doorHeight + (roomHeight - doorY - doorHeight) / 2, wallThickness, roomHeight - doorY - doorHeight);
    this.wallGroup.add(rightWallBottom);

    // Door trigger area (positioned at the door opening)
    const door = new Door(this, roomWidth - (wallThickness / 2) - 100, doorY + (doorHeight / 2) + 160, wallThickness, doorHeight, 1);
    this.doorGroup.add(door);

    const debugMode = true; // Turned on to see the angled wall
    if (debugMode) {
      this.wallGroup.children.entries.forEach(wall => wall.toggleDebugVisibility());
      this.doorGroup.children.entries.forEach(door => door.toggleDebugVisibility());
    }
  }

  /*
    This function creates the map of the game. It loads the tilemap and the tilesets and it creates the layers and the objects defined on the tilemap. It also creates the groups for the foes, the platforms, the turns, the exits, the lunchboxes, and the bricks. Finally, it calls the function to create the colliders.
    */
  createMap() {
    this.tileMap = this.make.tilemap({
      key: "scene" + this.number,
      tileWidth: 64,
      tileHeight: 64,
    });
    this.tileSetBg = this.tileMap.addTilesetImage("background");
    console.log(this.tileMap);
    this.tileMap.createLayer("background", this.tileSetBg);

    this.tileSet = this.tileMap.addTilesetImage("softbricks");
    this.platform = this.tileMap.createLayer(
      "scene" + this.number,
      this.tileSet
    );
    this.objectsLayer = this.tileMap.getObjectLayer("objects");

    this.platform.setCollisionByExclusion([-1]);

    this.batGroup = this.add.group();
    this.zombieGroup = this.add.group();
    this.foesGroup = this.add.group();
    this.turnGroup = this.add.group();
    this.exitGroup = this.add.group();
    this.platformGroup = this.add.group();
    this.lunchBoxGroup = this.add.group();
    this.bricks = this.add.group();

    this.addsObjects();
    this.addColliders();
  }

  /*
    This function adds the objects defined on the objects layer of the tilemap to the game. Yeah, I know, I could have used a switch statement here, but lately, I'm trying to avoid them as much as I can.
    */
  addsObjects() {
    this.objectsLayer.objects.forEach((object) => {
      if (object.name === "bat") {
        let bat = new Bat(this, object.x, object.y, object.type);
        this.batGroup.add(bat);
        this.foesGroup.add(bat);
      }

      if (object.name === "zombie") {
        let zombie = new Zombie(this, object.x, object.y, object.type);
        this.zombieGroup.add(zombie);
        this.foesGroup.add(zombie);
      }

      if (object.name === "platform") {
        this.platformGroup.add(
          new Platform(this, object.x, object.y, object.type)
        );
      }

      if (object.name === "turn") {
        this.turnGroup.add(new Turn(this, object.x, object.y));
      }

      if (object.name === "lunchbox") {
        this.lunchBoxGroup.add(new LunchBox(this, object.x, object.y));
      }

      // if (object.name === "text") {
      //   this.add
      //     .bitmapText(object.x, object.y, "pixelFont", object.text.text, 30)
      //     .setDropShadow(2, 4, 0x222222, 0.9)
      //     .setOrigin(0);
      // }

      if (object.name === "exit") {
        this.exitGroup.add(
          new Turn(
            this,
            object.x,
            object.y,
            object.width,
            object.height,
            object.type
          ).setOrigin(0.5)
        );
      }
    });
  }

  /*
    Once we have our objects, foes, and platforms in the game, we add the colliders between them.
    */
  addColliders() {
    this.physics.add.collider(
      this.batGroup,
      this.platform,
      this.turnFoe,
      () => {
        return true;
      },
      this
    );

    this.physics.add.collider(
      this.zombieGroup,
      this.bricks,
      this.turnFoe,
      () => {
        return true;
      },
      this
    );

    this.physics.add.collider(
      this.batGroup,
      this.bricks,
      this.turnFoe,
      () => {
        return true;
      },
      this
    );

    this.physics.add.collider(
      this.zombieGroup,
      this.turnGroup,
      this.turnFoe,
      () => {
        return true;
      },
      this
    );

    this.physics.add.collider(
      this.zombieGroup,
      this.platform,
      this.hitFloor,
      () => {
        return true;
      },
      this
    );
  }

  /*
    This function is called when a foe touches a turn object. It turns the foe.
    */
  turnFoe(foe, platform) {
    foe.turn();
  }

  /*
    This callback is empty but here we could add some effects. It is called when a foe hits the floor.
    */
  hitFloor() {}

  /*
    This function is called when the player enters a door. It activates the door and transitions to the target scene.
    */
  enterDoor(player, door) {
    if (door.activate()) {
      this.playAudio("stage");
      this.time.delayedCall(500, () => {
        if (this.theme) this.theme.stop();
        this.scene.start("transition", { name: "STAGE", number: door.targetScene });
      }, null, this);
    }
  }

  /*
    We add the player(s) to the game and we add the colliders between the player and the rest of the elements. The starting position of the player is defined on the tilemap.
    */
  addPlayer() {
    this.elements = this.add.group();
    this.coins = this.add.group();

    // Set responsive player starting position (proportional to room size)
    const startX = this.roomWidth / 2; // Center of the room horizontally
    const startY = this.roomHeight - (this.roomHeight * 0.17); // 17% from bottom (responsive)
    
    // Make the character bigger - responsive scaling based on room size
    const playerScale = Math.max(1.2, Math.min(2.0, this.roomWidth / 900)); // Scale between 1.2x and 2.0x
    
    if (this.isMultiplayer) {
      console.log("Creating local player for multiplayer");
      // Create local player (the one this client controls)
      this.localPlayer = new Player(this, startX, startY, 10, true); // true = isLocal
      this.localPlayer.setScale(playerScale);
      
      // For backward compatibility, also set this.player to localPlayer
      this.player = this.localPlayer;
      
      console.log("Local player created:", this.localPlayer);
    } else {
      console.log("Creating single player");
      // Single player mode
      this.player = new Player(this, startX, startY, 10, true); // true = isLocal (single player is always local)
      this.player.setScale(playerScale);
    }

    const playerId = this.isMultiplayer && this.networkManager
      ? this.networkManager.playerId
      : "localPlayer";
    if (this.player) {
      this.player.playerId = playerId;
      if (this.isMultiplayer && this.localPlayer) {
        this.localPlayer.playerId = playerId;
      }
      if (this.allPlayersGroup) {
        this.allPlayersGroup.add(this.player);
      }
    }

    // Temporarily disable platform colliders for testing
    // this.physics.add.collider(
    //   this.player,
    //   this.platform,
    //   this.hitFloor,
    //   () => {
    //     return true;
    //   },
    //   this
    // );

    // this.physics.add.collider(
    //   this.player,
    //   this.platformGroup,
    //   this.hitFloor,
    //   () => {
    //     return true;
    //   },
    //   this
    // );

    this.physics.add.collider(
      this.player,
      this.bricks,
      this.hitFloor,
      () => {
        return true;
      },
      this
    );

    this.physics.add.overlap(
      this.player,
      this.coins,
      this.pickCoin,
      () => {
        return true;
      },
      this
    );

    this.physics.add.overlap(
      this.player,
      this.lunchBoxGroup,
      this.pickLunchBox,
      () => {
        return true;
      },
      this
    );

    this.physics.add.overlap(
      this.player,
      this.exitGroup,
      () => {
        this.playAudio("stage");
        this.time.delayedCall(1000, () => this.finishScene(), null, this);
      },
      () => {
        return true;
      },
      this
    );

    this.blows = this.add.group();

    this.physics.add.overlap(
      this.blows,
      this.platform,
      this.blowPlatform,
      () => {
        return true;
      },
      this
    );

    this.physics.add.overlap(
      this.blows,
      this.bricks,
      this.blowBrick,
      () => {
        return true;
      },
      this
    );

    this.physics.add.overlap(
      this.blows,
      this.foesGroup,
      this.blowFoe,
      () => {
        return true;
      },
      this
    );

    this.physics.add.overlap(
      this.bricks,
      this.foesGroup,
      this.foeBlowBrick,
      () => {
        return true;
      },
      this
    );

    this.physics.add.collider(
      this.player,
      this.batGroup,
      this.hitPlayer,
      () => {
        return true;
      },
      this
    );

    this.physics.add.collider(
      this.player,
      this.zombieGroup,
      this.hitPlayer,
      () => {
        return true;
      },
      this
    );

    // Add wall collisions
    if (this.wallGroup) {
      this.physics.add.collider(this.player, this.wallGroup);
      this.physics.add.collider(this.batGroup, this.wallGroup, this.turnFoe, null, this);
      this.physics.add.collider(this.zombieGroup, this.wallGroup, this.turnFoe, null, this);
    }

    // Add door interactions
    if (this.doorGroup) {
      this.physics.add.overlap(this.player, this.doorGroup, this.enterDoor, null, this);
    }
  }

  /*
    Initialize multiplayer networking and event handlers
    */
  initializeMultiplayer() {
    console.log("Initializing multiplayer...");
    
    // Get the existing network manager from the splash scene
    const splashScene = this.scene.get('splash');
    if (splashScene && splashScene.networkManager) {
      this.networkManager = splashScene.networkManager;
      this.networkManager.scene = this;
      console.log("Using existing network manager from splash scene");
    } else {
      console.error("No network manager found from splash scene!");
      return;
    }
    
    // Set up game-specific network event listeners
    this.setupGameNetworkEvents();
    
    // Start sending player updates
    this.startPlayerSync();
  }

  /*
    Set up network event listeners for game events
    */
  setupGameNetworkEvents() {
    if (!this.networkManager || !this.networkManager.socket) {
      console.error("Network manager or socket not available");
      return;
    }

    // Listen for other players' movements
    this.networkManager.socket.on('playerUpdate', (data) => {
      this.handleRemotePlayerUpdate(data);
    });

    // Listen for new players joining the game
    this.networkManager.socket.on('playerJoinedGame', (data) => {
      this.handlePlayerJoinedGame(data);
    });

    // Listen for players leaving the game
    this.networkManager.socket.on('playerLeftGame', (data) => {
      this.handlePlayerLeftGame(data);
    });

    if (!this.onPlayerActionHandler) {
      this.onPlayerActionHandler = (data) => {
        this.handleRemotePlayerAction(data);
      };
      this.networkManager.socket.on('playerAction', this.onPlayerActionHandler);
    }

    console.log("Game network events set up");
  }

  /*
    Start synchronizing local player position and actions
    */
  startPlayerSync() {
    console.log("=== STARTING PLAYER SYNC ===");
    console.log("Network manager exists:", !!this.networkManager);
    console.log("Local player exists:", !!this.localPlayer);
    console.log("Socket exists:", !!(this.networkManager && this.networkManager.socket));
    
    // Send player updates every 50ms (20 FPS)
    this.playerSyncTimer = this.time.addEvent({
      delay: 50,
      callback: this.sendPlayerUpdate,
      callbackScope: this,
      loop: true
    });

    console.log("Player sync timer created:", !!this.playerSyncTimer);
    console.log("Player sync started");
  }

  /*
    Send local player's current state to other players
    */
  sendPlayerUpdate() {
    if (!this.networkManager || !this.localPlayer) {
      console.log('Cannot send player update - missing networkManager or localPlayer');
      return;
    }

    const defaultAnimation = this.localPlayer.animationKeys
      ? this.localPlayer.animationKeys.idle
      : 'playeridle';

    const playerData = {
      x: this.localPlayer.x,
      y: this.localPlayer.y,
      velocityX: this.localPlayer.body.velocity.x,
      velocityY: this.localPlayer.body.velocity.y,
      flipX: this.localPlayer.flipX,
      animation: this.localPlayer.anims.currentAnim
        ? this.localPlayer.anims.currentAnim.key
        : defaultAnimation,
      playerSprite: this.localPlayer.playerSprite, // Include the character sprite
      timestamp: Date.now()
    };

    // Debug: Log what we're sending (only occasionally to avoid spam)
    if (Math.random() < 0.01) { // 1% chance to log
      console.log(`Sending sprite: ${playerData.playerSprite} for local player`);
    }

    this.networkManager.socket.emit('playerUpdate', playerData);
  }

  /*
    Handle updates from remote players
    */
  handleRemotePlayerUpdate(data) {
    const { playerId, playerData } = data;
    
    // Don't update our own player
    if (playerId === this.networkManager.playerId) return;

    // Validate playerData
    if (!playerData || typeof playerData.x === 'undefined' || typeof playerData.y === 'undefined') {
      console.error('Invalid playerData received:', playerData);
      return;
    }

    // Get or create remote player
    let remotePlayer = this.remotePlayers.get(playerId);
    if (!remotePlayer) {
      // Create new remote player
      remotePlayer = this.createRemotePlayer(playerId, playerData);
    }

    // Update remote player position and animation
    if (remotePlayer) {
      this.updateRemotePlayer(remotePlayer, playerData);
    }
  }

  /*
    Create a new remote player
    */
  createRemotePlayer(playerId, playerData) {
    console.log(`=== CREATING REMOTE PLAYER ===`);
    console.log(`Player ID: ${playerId}`);
    console.log(`Sprite from network: ${playerData.playerSprite}`);
    console.log(`Local player sprite: ${this.registry.get("selectedPlayer")}`);
    
    // Validate playerData before creating player
    if (!playerData || typeof playerData.x === 'undefined' || typeof playerData.y === 'undefined') {
      console.error('Cannot create remote player - invalid playerData:', playerData);
      return null;
    }
    
    // Create remote player with their specific character sprite
    const remotePlayer = new Player(this, playerData.x, playerData.y, 10, false, playerData.playerSprite); // false = not local, pass sprite
    
    // Make the character same scale as local player
    const playerScale = Math.max(1.2, Math.min(2.0, this.roomWidth / 900));
    remotePlayer.setScale(playerScale);
    remotePlayer.playerId = playerId;
    
    // No tint needed - different character sprites will distinguish players
    
    // Add to remote players map
    this.remotePlayers.set(playerId, remotePlayer);
    if (this.remotePlayerGroup) {
      this.remotePlayerGroup.add(remotePlayer);
    }
    if (this.allPlayersGroup) {
      this.allPlayersGroup.add(remotePlayer);
    }
    
    // Add physics and collisions for remote player
    this.physics.world.enable([remotePlayer]);
    this.addRemotePlayerCollisions(remotePlayer);
    
    console.log("Remote player created and added:", playerId);
    return remotePlayer;
  }

  /*
    Update remote player's position and animation
    */
  updateRemotePlayer(remotePlayer, playerData) {
    // Smoothly interpolate position
    this.tweens.add({
      targets: remotePlayer,
      x: playerData.x,
      y: playerData.y,
      duration: 100, // 100ms interpolation
      ease: 'Linear'
    });

    // Update flip and animation
    remotePlayer.flipX = playerData.flipX;
    const animationKey = playerData.animation || remotePlayer.animationKeys?.idle;
    if (remotePlayer.anims && animationKey) {
      remotePlayer.anims.play(animationKey, true);
    }
  }

  handleLocalPlayerAction(action, actionData = {}) {
    if (!this.isMultiplayer || !this.networkManager) {
      return;
    }

    this.networkManager.sendPlayerAction(action, actionData);
  }

  handleRemotePlayerAction(data) {
    if (!data || !data.action) return;
    const { playerId, action, actionData } = data;
    if (this.networkManager && playerId === this.networkManager.playerId) {
      return;
    }

    switch (action) {
      case "kick":
        this.handleRemoteKick(playerId, actionData);
        break;
      case "healthUpdate":
        this.applyRemoteHealthUpdate(playerId, actionData);
        break;
      default:
        break;
    }
  }

  handleRemoteKick(playerId, actionData = {}) {
    const remotePlayer = this.remotePlayers.get(playerId);
    if (!remotePlayer || remotePlayer.dead) return;

    const direction = actionData.direction || (remotePlayer.right ? "right" : "left");
    if (direction === "right") {
      remotePlayer.right = true;
      remotePlayer.flipX = true;
    } else if (direction === "left") {
      remotePlayer.right = false;
      remotePlayer.flipX = false;
    }

    this.spawnPlayerAttack(remotePlayer, {
      type: "kick",
      damage: actionData.damage || 1,
      direction,
      width: actionData.width || 54,
      height: actionData.height || 40,
      offsetY: actionData.offsetY ?? -10,
      duration: actionData.duration || 180,
      singleUse: actionData.singleUse,
    });

    if (remotePlayer.anims) {
      remotePlayer.attacking = true;
      remotePlayer.anims.play(remotePlayer.animationKeys.attack, true);
    }
  }

  spawnPlayerAttack(player, attackConfig = {}) {
    if (!player || !this.playerAttacks) return null;

    const width = attackConfig.width || 48;
    const height = attackConfig.height || 32;
    const duration = attackConfig.duration || 200;
    const damage = attackConfig.damage || 1;
    const direction = attackConfig.direction || (player.right ? "right" : "left");
    const facingRight = direction !== "left";
    const playerWidth = player.displayWidth || player.width || 48;
    const defaultOffsetX = (playerWidth / 2 + width / 2) * (facingRight ? 1 : -1);
    const offsetX = attackConfig.offsetX ?? defaultOffsetX;
    const offsetY = attackConfig.offsetY ?? 0;
    const originX = attackConfig.x ?? player.x + offsetX;
    const originY = attackConfig.y ?? player.y + offsetY;

    const attackZone = this.add.rectangle(originX, originY, width, height, 0xff0000, 0.18);
    attackZone.setVisible(false);
    attackZone.ownerId = player.playerId || null;
    attackZone.damage = damage;
    attackZone.type = attackConfig.type || "attack";
    attackZone.hitTargets = new Set();
    attackZone.singleUse = Boolean(attackConfig.singleUse);

    this.physics.add.existing(attackZone);
    attackZone.body.setAllowGravity(false);
    attackZone.body.setImmovable(true);
    attackZone.body.moves = false;

    attackZone.updatePosition = () => {
      if (!attackZone.active || !player.active) return;
      attackZone.x = player.x + offsetX;
      attackZone.y = player.y + offsetY;
    };

    attackZone.ownerPlayer = player;

    this.playerAttacks.add(attackZone);

    attackZone.once('destroy', () => {
      attackZone.tickEvent?.remove(false);
    });

    attackZone.tickEvent = this.time.addEvent({
      delay: 16,
      loop: true,
      callback: () => {
        if (!attackZone || !attackZone.active) {
          attackZone.tickEvent?.remove(false);
          return;
        }
        if (!player || !player.active) {
          attackZone.tickEvent?.remove(false);
          if (attackZone.active) {
            attackZone.destroy();
          }
          return;
        }
        attackZone.updatePosition();
      },
    });

    this.time.delayedCall(duration, () => {
      if (attackZone && attackZone.active) {
        attackZone.tickEvent?.remove(false);
        attackZone.destroy();
      }
    });

    return attackZone;
  }

  handlePlayerAttackHit(attack, target) {
    if (!attack || !target || typeof target.takeDamage !== "function") return;
    if (!target.active || target.dead) return;

    const targetId = target.playerId || target.name || target.uuid || target.id;
    if (!attack.hitTargets) {
      attack.hitTargets = new Set();
    }

    if (attack.ownerId && targetId && attack.ownerId === targetId) {
      return;
    }

    if (targetId && attack.hitTargets.has(targetId)) {
      return;
    }

    const result = target.takeDamage(attack.damage || 1);
    if (result?.applied) {
      if (targetId) {
        attack.hitTargets.add(targetId);
      }
      if (attack.singleUse && attack.active) {
        attack.tickEvent?.remove(false);
        attack.destroy();
      }
    }
  }

  handlePlayerHealthChanged(player) {
    if (!player) return;
    if (player.isLocal) {
      this.updateHealthUI(player.health, player.maxHealth);
      this.handleLocalPlayerAction("healthUpdate", {
        health: player.health,
        maxHealth: player.maxHealth,
      });
    }
  }

  applyRemoteHealthUpdate(playerId, actionData = {}) {
    if (!playerId) return;
    const targetPlayer = this.remotePlayers.get(playerId) ||
      (this.networkManager && playerId === this.networkManager.playerId ? this.player : null);
    if (!targetPlayer) return;

    if (typeof actionData.maxHealth === "number") {
      targetPlayer.maxHealth = actionData.maxHealth;
    }
    if (typeof actionData.health === "number") {
      targetPlayer.health = Phaser.Math.Clamp(actionData.health, 0, targetPlayer.maxHealth || 1);
    }

    targetPlayer.updateHealthBar?.();

    if (targetPlayer.isLocal) {
      this.updateHealthUI(targetPlayer.health, targetPlayer.maxHealth);
    }
  }

  addHealthUI() {
    if (this.healthText) {
      this.healthText.destroy();
      this.healthText = null;
    }

    this.healthText = this.add
      .bitmapText(75, 60, "pixelFont", "HP: 0/0", 30)
      .setOrigin(0)
      .setScrollFactor(0)
      .setDropShadow(0, 4, 0x222222, 0.9);
  }

  updateHealthUI(currentHealth, maxHealth) {
    if (!this.healthText) return;
    const clampedMax = Math.max(maxHealth || 0, 0);
    const clampedHealth = Math.max(Math.min(currentHealth || 0, clampedMax), 0);
    this.healthText.setText(`HP: ${clampedHealth}/${clampedMax}`);
  }

  handleSceneShutdown() {
    if (this.networkManager?.socket && this.onPlayerActionHandler) {
      this.networkManager.socket.off('playerAction', this.onPlayerActionHandler);
      this.onPlayerActionHandler = null;
    }
  }

  /*
    Add collisions for remote players
    */
  addRemotePlayerCollisions(remotePlayer) {
    // Add basic collisions (walls, bricks)
    this.physics.add.collider(remotePlayer, this.bricks);
    
    if (this.wallGroup) {
      this.physics.add.collider(remotePlayer, this.wallGroup);
    }
  }

  /*
    Handle new player joining the game
    */
  handlePlayerJoinedGame(data) {
    console.log("Player joined game:", data);
    // The player will be created when we receive their first playerUpdate
  }

  /*
    Handle player leaving the game
    */
  handlePlayerLeftGame(data) {
    console.log("Player left game:", data.playerId);
    
    const remotePlayer = this.remotePlayers.get(data.playerId);
    if (remotePlayer) {
      remotePlayer.destroy();
      this.remotePlayers.delete(data.playerId);
    }
  }

  /*
    This function is called when the player picks a coin. It disables the coin (to avoid picking it up again while it animates), plays the sound, and updates the score. Same with the lunchbox.
    */
  pickCoin(player, coin) {
    if (!coin.disabled) {
      coin.pick();
      this.playAudio("coin");
      this.updateCoins();
    }
  }

  pickLunchBox(player, lunchBox) {
    if (!lunchBox.disabled) {
      this.playAudio("lunchbox");
      lunchBox.pick();
    }
  }

  /*
    This function is called when the player hits a foe. If the player is invincible (because of a power-up), then the foe dies. If not, then the player dies.
    */
  hitPlayer(player, foe) {
    if (player.invincible) {
      foe.death();
      this.playAudio("foedeath");
    } else if (!player.dead && this.number > 0) {
      const result = typeof player.takeDamage === "function" ? player.takeDamage(1) : { applied: false };
      if (result?.applied && result.died) {
        this.playAudio("death");
      }
    }
  }

  /*
    This is called when the player blows a foe. On the screen, the player generates a blow object and when this collides with a foe, the enemy is destroyed. It plays the sound and kills the foe.
    */
  blowFoe(blow, foe) {
    this.playAudio("kill");
    this.playAudio("foedeath");
    foe.death();
  }

  /*
    When a foe touches a brick it turns around and it changes direction.
    */
  foeBlowBrick(brick, foe) {
    foe.turn();
    Array(Phaser.Math.Between(4, 6))
      .fill(0)
      .forEach((i) => new Debris(this, brick.x, brick.y));
    brick.destroy();
  }

  /*
    This is called when the player blows an object of the platform layer on the tilemap. On the screen, the player generates a blow object and when this collides with a brick, if that brick is marked in the map as breakable, the brick is destroyed. It plays the sound and kills the brick, and at the end, it calls spawCoin: a function that randomly spawns a coin.
    */
  blowPlatform(blow, platform) {
    const tile = this.getTile(platform);
    if (this.isBreakable(tile)) {
      this.playAudioRandomly("stone_fail");
      this.playAudioRandomly("stone");
      if (this.player.mjolnir) this.cameras.main.shake(30);
      blow.destroy();
      Array(Phaser.Math.Between(4, 6))
        .fill(0)
        .forEach((i) => new Debris(this, tile.pixelX, tile.pixelY));
      this.platform.removeTileAt(tile.x, tile.y);
      this.spawnCoin(tile);
    }
  }

  getTile(platform) {
    const { x, y } = platform;
    return this.platform.getTileAt(x, y);
  }

  isBreakable(tile) {
    return tile?.properties["element"] === "break";
  }

  spawnCoin(tile) {
    if (Phaser.Math.Between(0, 11) > 5) {
      this.time.delayedCall(
        500,
        () => {
          this.coins.add(new Coin(this, tile.pixelX, tile.pixelY));
        },
        null,
        this
      );
    }
  }

  /*
    This is similar to the function that blows platforms but it is applied to bricks generated by the player during the game.
    */
  blowBrick(blow, brick) {
    if (this.player.mjolnir) this.cameras.main.shake(30);
    this.playAudio("stone_fail");
    this.playAudioRandomly("stone");
    blow.destroy();
    Array(Phaser.Math.Between(4, 6))
      .fill(0)
      .forEach((i) => new Debris(this, brick.x, brick.y));
    brick.destroy();
  }

  /*
    When the player hits the floor, if it is jumping and it is not falling, then it checks if the tile is breakable. If it is, then it destroys the tile and it plays the sound. Same with the bricks generated by the player.
    */
  hitFloor(player, platform) {
    if (
      this.player.jumping &&
      !this.player.falling &&
      this.player.body.velocity.y === 0
    ) {
      const tile = this.getTile(platform);
      if (this.isBreakable(tile)) {
        this.playAudioRandomly("stone");
        Array(Phaser.Math.Between(4, 6))
          .fill(0)
          .forEach((i) => new Debris(this, tile.pixelX, tile.pixelY));
        this.platform.removeTileAt(tile.x, tile.y);
      } else if (platform?.name === "brick0") {
        this.playAudioRandomly("stone");
        Array(Phaser.Math.Between(4, 6))
          .fill(0)
          .forEach((i) => new Debris(this, platform.x, platform.y));
        platform.destroy();
      }
    }
  }

  /*
    This will load all the audio files used in the game. It is called from the create function, and so we can use `this.audios` to play the sounds.
    */
  loadAudios() {
    this.audios = {
      build: this.sound.add("build"),
      coin: this.sound.add("coin"),
      death: this.sound.add("death"),
      jump: this.sound.add("jump"),
      kill: this.sound.add("kill"),
      land: this.sound.add("land"),
      lunchbox: this.sound.add("lunchbox"),
      prize: this.sound.add("prize"),
      stone_fail: this.sound.add("stone_fail"),
      stone: this.sound.add("stone"),
      foedeath: this.sound.add("foedeath"),
      stage: this.sound.add("stage"),
    };
  }

  playAudio(key) {
    const isMuted = this.registry.get("audioMuted") || false;
    if (!isMuted) {
      this.audios[key].play();
    }
  }

  /*
      This plays the audio with a random volume and rate to add more variety to some sounds that otherwise would sound too repetitive.
      */
  playAudioRandomly(key) {
    const isMuted = this.registry.get("audioMuted") || false;
    if (!isMuted) {
      const volume = Phaser.Math.Between(0.8, 1);
      const rate = Phaser.Math.Between(0.8, 1);
      this.audios[key].play({ volume, rate });
    }
  }

  /*
      This plays the music of the game. It is called from the create function, and so we can use `this.theme` to play the music.
      */
  playMusic(theme = "game") {
    const isMuted = this.registry.get("audioMuted") || false;
    this.theme = this.sound.add("music" + this.number);
    this.theme.stop();
    this.theme.play({
      mute: isMuted,
      volume: 0.7,
      rate: 1,
      detune: 0,
      seek: 0,
      loop: true,
      delay: 0,
    });
  }

  /*
    The game loop. It updates the player and checks if the player has fallen from the map (we could add pits for this). If it has, then it restarts the scene.
    */
  update() {
    this.player.update();
    if (this.number === 3 && this.player.y > 1500) this.restartScene();
  }

  /*
    This is called when the player reaches the exit. It stops the music and it starts the transition scene increasing the stage number, so we will load the next map.
    */
  finishScene() {
    if (this.theme) this.theme.stop();
    this.scene.start("transition", { name: "STAGE", number: this.number + 1 });
  }

  /*
    This is called when the player dies. It stops the music and it starts the transition scene without increasing the stage number.
    */
  restartScene() {
    this.time.delayedCall(
      1000,
      () => {
        if (this.theme) this.theme.stop();
        this.scene.start("transition", { name: "STAGE", number: this.number });
      },
      null,
      this
    );
  }

  /*
    This is called when the player picks a coin. It updates the score from the registry and it adds a little tween effect to the score text.
    */
  updateCoins() {
    const coins = +this.registry.get("coins") + 1;
    this.registry.set("coins", coins);
    this.scoreCoins.setText("x" + coins);
    this.tweens.add({
      targets: [this.scoreCoins, this.scoreCoinsLogo],
      scale: { from: 1.4, to: 1 },
      duration: 50,
      repeat: 10,
    });
  }
}
