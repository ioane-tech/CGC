import { Debris } from "../gameobjects/particle";
import NetworkManager from "../network/NetworkManager";

export default class Splash extends Phaser.Scene {
  constructor() {
    super({ key: "splash" });
  }

  create() {
    this.width = this.sys.game.config.width;
    this.height = this.sys.game.config.height;
    this.center_width = this.width / 2;
    this.center_height = this.height / 2;

    this.cameras.main.setBackgroundColor(0x000053);

    // Menu state management
    this.currentMenu = "main"; // "main", "gameMode", "playerSelect"
    this.selectedMenuIndex = 0;

    // Initialize join state properly
    this.joiningRoom = false;
    this.selectedRoomToJoin = null;

    // Game mode options
    this.gameModeOptions = [
      { key: "singleplayer", name: "SINGLE PLAYER", description: "Play alone" },
      {
        key: "host",
        name: "HOST GAME",
        description: "Create multiplayer room",
      },
      { key: "join", name: "JOIN GAME", description: "Join existing room" },
    ];

    // Player selection state
    this.selectedPlayerIndex = 0;
    this.players = [
      {
        key: "vanoSprite",
        name: "VANO",
        unlocked: true,
        frames: { width: 64, height: 150 },
        unlockCondition: "default",
      },
      {
        key: "demchenkoSprite",
        name: "Demchex",
        unlocked: true,
        frames: { width: 69, height: 147 },
        unlockCondition: "Complete 3 levels",
      },
      {
        key: "IoSprite",
        name: "IO",
        unlocked: true,
        frames: { width: 64, height: 124 },
        unlockCondition: "Find secret area",
      },
      {
        key: "zombie",
        name: "Machex",
        unlocked: false,
        frames: { width: 64, height: 64 },
        unlockCondition: "Collect 50 coins",
      },
      {
        key: "penguin",
        name: "Willen",
        unlocked: false,
        frames: { width: 64, height: 164 },
        unlockCondition: "Find secret area",
      },
    ];

    // Check for unlocked players from registry
    this.checkUnlockedPlayers();

    // Initialize network manager
    this.networkManager = new NetworkManager(this);
    this.setupNetworkEvents();

    // Input handling
    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on(
      "keydown-SPACE",
      () => this.handleMenuAction(),
      this
    );
    this.input.keyboard.on(
      "keydown-ENTER",
      () => this.handleMenuAction(),
      this
    );
    this.input.keyboard.on("keydown-ESC", () => this.goBackMenu(), this);

    this.playMusic();
    this.showTitle();
    this.createMuteButton();
    this.time.delayedCall(1000, () => this.showInstructions(), null, this);
    this.time.delayedCall(2000, () => this.showGameModeSelection(), null, this);
    this.playAudioRandomly("writing-with-pencil");
  }

  update() {
    // Handle menu navigation based on current menu state
    if (this.currentMenu === "gameMode") {
      if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
        this.changeMenuSelection(-1);
      } else if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
        this.changeMenuSelection(1);
      }
    } else if (this.currentMenu === "playerSelect") {
      if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) {
        this.changePlayer(-1);
      } else if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) {
        this.changePlayer(1);
      }
    } else if (this.currentMenu === "join") {
      if (this.availableRooms && this.availableRooms.length > 0) {
        if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
          this.changeRoomSelection(-1);
        } else if (Phaser.Input.Keyboard.JustDown(this.cursors.down)) {
          this.changeRoomSelection(1);
        }
      }

      // R key to refresh room list
      if (Phaser.Input.Keyboard.JustDown(this.input.keyboard.addKey("R"))) {
        this.refreshRoomList();
      }
    }
  }

  changePlayer(direction) {
    const newIndex =
      (this.selectedPlayerIndex + direction + this.players.length) %
      this.players.length;

    if (this.players[newIndex].unlocked) {
      this.selectedPlayerIndex = newIndex;
      this.updatePlayerSelection();
      this.playAudioRandomly("writing-with-pencil");
    } else {
      // Show unlock condition for locked player
      this.showUnlockCondition(newIndex);
      this.playAudioRandomly("stone_fail");
    }
  }

  /*
    Handle menu actions based on current menu state
    */
  handleMenuAction() {
    console.log("=== HANDLE MENU ACTION ===");
    console.log("Current menu:", this.currentMenu);
    console.log("Joining room:", this.joiningRoom);
    console.log("Selected room to join:", this.selectedRoomToJoin);

    if (this.currentMenu === "gameMode") {
      const selectedOption = this.gameModeOptions[this.selectedMenuIndex];
      this.selectGameMode(selectedOption.key);
    } else if (this.currentMenu === "playerSelect") {
      console.log("Player select menu action - calling startGame()");
      this.startGame();
    } else if (
      this.currentMenu === "join" &&
      this.availableRooms &&
      this.availableRooms.length > 0
    ) {
      // Join the selected room
      this.joinSelectedRoom();
    } else if (this.currentMenu === "lobby" && this.isHost) {
      // Host can start the game, but check if there are enough players
      const roomInfo = this.networkManager.getRoomInfo();
      console.log("=== HOST TRYING TO START GAME ===");
      console.log("Is host:", this.isHost);
      console.log("Room info:", roomInfo);
      console.log(
        "Player count:",
        roomInfo ? roomInfo.players.length : "no room info"
      );

      if (!roomInfo || roomInfo.players.length < 2) {
        const playerCount = roomInfo ? roomInfo.players.length : 0;
        console.log(`Not enough players: ${playerCount}/2`);
        this.showError("Wait for at least one other player to join!");
        return;
      }

      console.log(`Starting game with ${roomInfo.players.length} players`);
      this.networkManager.startGame();
    } else if (this.currentMenu === "lobby") {
      console.log("=== NON-HOST IN LOBBY ===");
      console.log("Is host:", this.isHost);
      console.log("Current menu:", this.currentMenu);
    } else {
      console.log("No action for current menu state");
    }
  }

  /*
    Go back to previous menu
    */
  goBackMenu() {
    if (this.currentMenu === "playerSelect") {
      this.hidePlayerSelection();
      this.showGameModeSelection();
      this.playAudioRandomly("stone_fail");
    } else if (this.currentMenu === "join") {
      this.hideJoinGameMenu();
      this.showGameModeSelection();
      this.playAudioRandomly("stone_fail");
    } else if (this.currentMenu === "connecting") {
      // Cancel connection attempt and go back
      console.log("Cancelling connection attempt...");

      // Clear any pending timeouts
      if (this.joinTimeout) {
        clearTimeout(this.joinTimeout);
        this.joinTimeout = null;
      }

      this.hideConnecting();
      this.showGameModeSelection();
      this.playAudioRandomly("stone_fail");
    } else if (this.currentMenu === "lobby") {
      // Leave the multiplayer room
      this.networkManager.leaveRoom();
      this.networkManager.disconnect();
      this.hideAllMenus();
      this.showGameModeSelection();
      this.playAudioRandomly("stone_fail");
    } else if (this.currentMenu === "gameMode") {
      // Could go back to main menu if we had one
      this.playAudioRandomly("stone_fail");
    }
  }

  /*
    Set up network event listeners
    */
  setupNetworkEvents() {
    this.events.on("roomCreated", (data) => {
      console.log("Room created:", data);
      this.showLobby(data, true);
    });

    this.events.on("roomJoined", (data) => {
      console.log("Room joined:", data);
      // Clear join timeout if it exists
      if (this.joinTimeout) {
        clearTimeout(this.joinTimeout);
        this.joinTimeout = null;
      }
      // Clear join state since we successfully joined
      this.joiningRoom = false;
      this.selectedRoomToJoin = null;

      this.hideConnecting();
      this.showLobby(data, false);
    });

    this.events.on("playerJoined", (data) => {
      console.log("Player joined lobby:", data);
      console.log("Current menu:", this.currentMenu);
      if (this.currentMenu === "lobby") {
        console.log("Updating lobby with new player...");
        this.updateLobby();
        // Show notification that someone joined
        this.showPlayerJoinedNotification(data.playerData.name);
      }
    });

    this.events.on("playerLeft", (data) => {
      console.log("Player left lobby:", data);
      console.log("Current menu:", this.currentMenu);
      if (this.currentMenu === "lobby") {
        console.log("Updating lobby after player left...");
        this.updateLobby();
        // Show notification that someone left
        this.showPlayerLeftNotification(data.playerId);
      }
    });

    this.events.on("gameStarted", (data) => {
      console.log("Game starting:", data);
      this.startMultiplayerGame();
    });

    this.events.on("networkError", (error) => {
      console.error("Network error:", error);
      this.showError("Network error: " + error.message);
    });

    this.events.on("roomError", (error) => {
      console.error("Room error:", error);
      // Clear join timeout if it exists
      if (this.joinTimeout) {
        clearTimeout(this.joinTimeout);
        this.joinTimeout = null;
      }
      // Clear join state on error
      this.joiningRoom = false;
      this.selectedRoomToJoin = null;

      this.hideConnecting();
      this.showError("Room error: " + error.error);
      // Go back to room selection after error
      setTimeout(() => {
        this.tryConnectAndShowRooms();
      }, 3000);
    });

    this.events.on("networkDisconnected", () => {
      console.log("Disconnected from server");
      this.showError("Disconnected from server");
      this.goBackMenu();
    });
  }

  /*
    Handle game mode selection
    */
  selectGameMode(mode) {
    this.selectedGameMode = mode;
    this.registry.set("gameMode", mode);

    if (mode === "singleplayer") {
      this.hideGameModeSelection();
      this.showPlayerSelection();
      this.currentMenu = "playerSelect";
      this.playAudioRandomly("writing-with-pencil");
    } else if (mode === "host") {
      this.hideGameModeSelection();
      this.showPlayerSelection();
      this.currentMenu = "playerSelect";
      this.playAudioRandomly("writing-with-pencil");
    } else if (mode === "join") {
      // Simplified join flow - just show connecting and try to get rooms
      this.hideGameModeSelection();
      this.tryConnectAndShowRooms();
      this.playAudioRandomly("writing-with-pencil");
    }
  }

  /*
    Change menu selection for game mode menu
    */
  changeMenuSelection(direction) {
    this.selectedMenuIndex =
      (this.selectedMenuIndex + direction + this.gameModeOptions.length) %
      this.gameModeOptions.length;
    this.updateGameModeSelection();
    this.playAudioRandomly("writing-with-pencil");
  }

  /*
    Change room selection in join menu
    */
  changeRoomSelection(direction) {
    if (!this.availableRooms || this.availableRooms.length === 0) return;

    this.selectedRoomIndex =
      (this.selectedRoomIndex + direction + this.availableRooms.length) %
      this.availableRooms.length;
    this.updateRoomSelection();
    this.playAudioRandomly("writing-with-pencil");
  }

  /*
    Update visual selection for room list
    */
  updateRoomSelection() {
    if (!this.roomFrames || !this.roomListTexts) return;

    this.roomFrames.forEach((frame, index) => {
      frame.clear();
      if (index === this.selectedRoomIndex) {
        // Highlight selected room
        frame.lineStyle(3, 0xffbf00);
        frame.strokeRoundedRect(-150, -15, 300, 30, 5);

        // Glow effect
        frame.lineStyle(1, 0xffffff, 0.5);
        frame.strokeRoundedRect(-152, -17, 304, 34, 7);
      } else {
        // Normal frame
        frame.lineStyle(2, 0x444444);
        frame.strokeRoundedRect(-150, -15, 300, 30, 5);
      }
    });

    // Update text colors
    this.roomListTexts.forEach((text, index) => {
      const roomIndex = Math.floor(index / 2); // 2 texts per room
      if (roomIndex === this.selectedRoomIndex) {
        text.setTint(0xffbf00);
      } else {
        text.setTint(index % 2 === 0 ? 0xffffff : 0xaaaaaa);
      }
    });
  }

  /*
    Join the currently selected room
    */
  joinSelectedRoom() {
    if (!this.availableRooms || this.availableRooms.length === 0) return;

    const selectedRoom = this.availableRooms[this.selectedRoomIndex];
    console.log("Joining room:", selectedRoom.id);

    // Store the selected room for later
    this.selectedRoomToJoin = selectedRoom;
    this.joiningRoom = true; // Flag to indicate we're joining a room

    // Go directly to player selection without showing connecting screen yet
    this.hideJoinGameMenu();
    this.showPlayerSelection();

    console.log(
      "Room selected, showing player selection. Room to join:",
      selectedRoom.id
    );
    console.log("Current menu after showPlayerSelection:", this.currentMenu);
    console.log("Player selection shown:", this.playerSelectionShown);
    console.log("Joining room flag:", this.joiningRoom);
  }

  /*
    Refresh the room list
    */
  refreshRoomList() {
    console.log("Refreshing room list...");
    this.hideJoinGameMenu();
    this.tryConnectAndShowRooms();
  }

  startGame() {
    console.log("=== START GAME ===");
    const selectedPlayer = this.players[this.selectedPlayerIndex];
    const gameMode = this.selectedGameMode || "singleplayer";

    console.log("Selected player:", selectedPlayer);
    console.log("Game mode:", gameMode);
    console.log("Joining room flag:", this.joiningRoom);
    console.log("Selected room to join:", this.selectedRoomToJoin);

    // Pass selected player and game mode to the game
    this.registry.set("selectedPlayer", selectedPlayer.key);
    this.registry.set("gameMode", gameMode);

    if (gameMode === "singleplayer") {
      console.log("Starting single player game");
      // Start single player game immediately
      if (this.theme) this.theme.stop();
      this.scene.start("transition", {
        next: "game",
        name: "STAGE",
        number: 0,
        time: 30,
      });
    } else if (gameMode === "host") {
      console.log("Creating multiplayer room");
      // Connect to server and create room
      this.connectAndCreateRoom(selectedPlayer);
    } else if (this.joiningRoom && this.selectedRoomToJoin) {
      console.log("Joining selected room");
      // Join the selected room
      this.joinRoomWithPlayer(selectedPlayer);
    } else {
      console.log("No matching game mode or join condition");
      console.log(
        "gameMode:",
        gameMode,
        "joiningRoom:",
        this.joiningRoom,
        "selectedRoomToJoin:",
        this.selectedRoomToJoin
      );
    }
  }

  /*
    Join a specific room with the selected player
    */
  joinRoomWithPlayer(selectedPlayer) {
    console.log("=== JOIN ROOM DEBUG ===");
    console.log("Selected room to join:", this.selectedRoomToJoin);
    console.log("Selected player:", selectedPlayer);
    console.log("Network manager connected:", this.networkManager.isConnected);

    // Show connecting screen
    this.hidePlayerSelection();
    this.showConnecting(`Joining room ${this.selectedRoomToJoin.id}...`);

    // Check if we're connected
    if (!this.networkManager.isConnected) {
      console.error("Not connected to server when trying to join room");
      this.hideConnecting();
      this.showError("Connection lost. Please try again.");
      setTimeout(() => {
        this.tryConnectAndShowRooms();
      }, 2000);
      return;
    }

    // Prepare player data
    const playerData = {
      name: selectedPlayer.name,
      sprite: selectedPlayer.key,
      joinedAt: Date.now(),
    };

    console.log("Sending joinRoom request with data:", {
      roomId: this.selectedRoomToJoin.id,
      playerData: playerData,
    });

    // Set a timeout in case the server doesn't respond
    this.joinTimeout = setTimeout(() => {
      console.error("Join room timeout - no response from server");
      this.hideConnecting();
      this.showError("Room join timeout - room may no longer exist");
      setTimeout(() => {
        this.tryConnectAndShowRooms();
      }, 3000);
    }, 8000); // 8 second timeout

    // Send the join request (this should not freeze)
    try {
      this.networkManager.joinRoom(this.selectedRoomToJoin.id, playerData);
      console.log("joinRoom request sent successfully");
    } catch (error) {
      console.error("Error sending joinRoom request:", error);
      clearTimeout(this.joinTimeout);
      this.hideConnecting();
      this.showError("Failed to send join request");
      setTimeout(() => {
        this.tryConnectAndShowRooms();
      }, 2000);
    }
  }

  /*
    Connect to server and create a multiplayer room
    */
  async connectAndCreateRoom(selectedPlayer) {
    this.showConnecting("Creating room...");

    try {
      await this.networkManager.connect();

      const playerData = {
        name: selectedPlayer.name,
        sprite: selectedPlayer.key,
        joinedAt: Date.now(),
      };

      this.networkManager.createRoom(playerData);
    } catch (error) {
      console.error("Failed to connect:", error);
      this.showError("Failed to connect to server");
    }
  }

  /*
    Try to connect and show rooms (simplified version)
    */
  tryConnectAndShowRooms() {
    this.currentMenu = "connecting";
    this.showConnecting("Connecting to server...");

    // Set a maximum wait time to prevent infinite hanging
    const maxWaitTime = setTimeout(() => {
      console.error("Connection taking too long, showing error");
      this.hideConnecting();
      this.showError("Server not responding");
      this.backToGameModeAfterError();
    }, 15000); // 15 second max wait

    this.networkManager
      .connect()
      .then(() => {
        clearTimeout(maxWaitTime);
        console.log("Connected successfully, getting room list...");
        this.showConnecting("Getting room list...");
        return this.networkManager.getRoomList();
      })
      .then((rooms) => {
        clearTimeout(maxWaitTime);
        console.log("Retrieved rooms:", rooms);
        console.log("Number of available rooms:", rooms.length);

        this.hideConnecting();
        this.showJoinGameMenu(rooms || []);
      })
      .catch((error) => {
        clearTimeout(maxWaitTime);
        console.error("Connection failed:", error);
        this.hideConnecting();
        this.showError(
          `Connection failed: ${error.message || "Unknown error"}`
        );
        this.backToGameModeAfterError();
      });
  }

  /*
    Go back to game mode selection after error
    */
  backToGameModeAfterError() {
    setTimeout(() => {
      if (this.currentMenu === "connecting" || this.currentMenu === "join") {
        this.currentMenu = "gameMode";
        this.showGameModeSelection();
      }
    }, 3000);
  }

  /*
    Start multiplayer game
    */
  startMultiplayerGame() {
    if (this.theme) this.theme.stop();

    // Pass network manager to the game scene
    this.registry.set("networkManager", this.networkManager);

    this.scene.start("transition", {
      next: "game",
      name: "MULTIPLAYER",
      number: 0,
      time: 30,
    });
  }

  /*
    Helper function to show the title letter by letter
    */
  showTitle() {
    const word = "CGC";
    const fontSize = 170;
    const spacing = 130; // distance between letters
    const totalWidth = (word.length - 1) * spacing;
    const startX = this.center_width - totalWidth / 2; // center the group

    word.split("").forEach((letter, i) => {
      this.time.delayedCall(
        200 * (i + 1),
        () => {
          this.playAudioRandomly("writing-with-pencil");

          const x = startX + i * spacing;
          const y = 200;

          const text = this.add
            .bitmapText(x, y, "hammerfont", letter, fontSize)
            .setTint(0xffbf00)
            .setOrigin(0.5)
            .setDropShadow(4, 6, 0xf09937, 0.9);

          Array(Phaser.Math.Between(4, 6))
            .fill(0)
            .forEach(() => new Debris(this, text.x, text.y, 0xca6702));
        },
        null,
        this
      );
    });

    const word2 = "Chill Gulf Coders";
    const fontSize2 = 60;
    const spacing2 = 50;
    const totalWidth2 = (word2.length - 1) * spacing2;
    const startX2 = this.center_width - totalWidth2 / 2;

    word2.split("").forEach((letter, i) => {
      this.time.delayedCall(
        200 * (i + 1) + 800,
        () => {
          this.playAudioRandomly("writing-with-pencil");

          const x = startX2 + i * spacing2;
          const y = 350;

          const text = this.add
            .bitmapText(x, y, "hammerfont", letter, fontSize2)
            .setTint(0xffbf00)
            .setOrigin(0.5)
            .setDropShadow(4, 2, 0xf09937, 0.9);

          Array(Phaser.Math.Between(4, 6))
            .fill(0)
            .forEach(() => new Debris(this, text.x, text.y, 0xca6702));
        },
        null,
        this
      );
    });
  }

  /*
    Helper function to play audio randomly to add variety.
    */
  playAudioRandomly(key) {
    const isMuted = this.registry.get("audioMuted") || false;
    if (!isMuted) {
      const volume = Phaser.Math.Between(0.8, 1);
      const rate = 1;
      this.sound.add(key).play({ volume, rate });
    }
  }

  playMusic(theme = "startSound") {
    const isMuted = this.registry.get("audioMuted") || false;
    this.theme = this.sound.add(theme);
    if (this.theme && this.theme.isPlaying) this.theme.stop();
    this.theme.play({
      mute: isMuted,
      volume: 1,
      rate: 1,
      detune: 0,
      seek: 0,
      loop: true,
      delay: 0,
    });
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
  }

  /*
    Generates the instructions text for the player.
    */
  showInstructions() {
    this.add
      .bitmapText(this.center_width, 420, "pixelFont", "↑↓: Navigate Menu", 18)
      .setOrigin(0.5)
      .setTint(0xaaaaaa);
    this.add
      .bitmapText(
        this.center_width,
        445,
        "pixelFont",
        "SPACE/ENTER: Select",
        18
      )
      .setOrigin(0.5)
      .setTint(0xaaaaaa);
    this.add
      .bitmapText(this.center_width, 470, "pixelFont", "ESC: Back", 18)
      .setOrigin(0.5)
      .setTint(0xaaaaaa);
  }

  /*
    Shows the game mode selection menu
    */
  showGameModeSelection() {
    this.currentMenu = "gameMode";
    this.gameModeSelectionShown = true;

    // Title for game mode selection
    this.gameModeTitle = this.add
      .bitmapText(this.center_width, 520, "pixelFont", "SELECT GAME MODE", 20)
      .setOrigin(0.5)
      .setTint(0xffbf00);

    // Create game mode options
    this.gameModeTexts = [];
    this.gameModeDescriptions = [];

    this.gameModeOptions.forEach((option, index) => {
      const y = 580 + index * 50;

      // Main option text
      const optionText = this.add
        .bitmapText(this.center_width, y, "pixelFont", option.name, 24)
        .setOrigin(0.5);
      this.gameModeTexts.push(optionText);

      // Description text
      const descText = this.add
        .bitmapText(
          this.center_width,
          y + 20,
          "pixelFont",
          option.description,
          14
        )
        .setOrigin(0.5)
        .setTint(0x888888);
      this.gameModeDescriptions.push(descText);
    });

    this.updateGameModeSelection();
  }

  /*
    Updates the visual selection for game mode menu
    */
  updateGameModeSelection() {
    if (!this.gameModeTexts) return;

    this.gameModeTexts.forEach((text, index) => {
      if (index === this.selectedMenuIndex) {
        text.setTint(0xffbf00);
        text.setScale(1.1);
        this.gameModeDescriptions[index].setTint(0xffffff);
      } else {
        text.setTint(0xffffff);
        text.setScale(1.0);
        this.gameModeDescriptions[index].setTint(0x888888);
      }
    });
  }

  /*
    Hides the game mode selection menu
    */
  hideGameModeSelection() {
    if (this.gameModeTitle) {
      this.gameModeTitle.destroy();
      this.gameModeTitle = null;
    }

    if (this.gameModeTexts) {
      this.gameModeTexts.forEach((text) => text.destroy());
      this.gameModeTexts = null;
    }

    if (this.gameModeDescriptions) {
      this.gameModeDescriptions.forEach((desc) => desc.destroy());
      this.gameModeDescriptions = null;
    }

    this.gameModeSelectionShown = false;
  }

  /*
    Shows the join game menu with available rooms
    */
  showJoinGameMenu(rooms = []) {
    this.currentMenu = "join";
    this.availableRooms = rooms;
    this.selectedRoomIndex = 0;

    // Title
    this.joinTitle = this.add
      .bitmapText(this.center_width, 480, "pixelFont", "JOIN GAME", 20)
      .setOrigin(0.5)
      .setTint(0xffbf00);

    if (rooms.length === 0) {
      // No rooms available
      this.joinText = this.add
        .bitmapText(
          this.center_width,
          540,
          "pixelFont",
          "No games available",
          18
        )
        .setOrigin(0.5)
        .setTint(0x888888);

      this.joinSubText = this.add
        .bitmapText(
          this.center_width,
          570,
          "pixelFont",
          "Ask someone to host a game!",
          14
        )
        .setOrigin(0.5)
        .setTint(0x666666);
    } else {
      // Show available rooms
      this.joinText = this.add
        .bitmapText(
          this.center_width,
          520,
          "pixelFont",
          "Select a room to join:",
          16
        )
        .setOrigin(0.5)
        .setTint(0xffffff);

      this.roomListTexts = [];
      this.roomFrames = [];

      rooms.forEach((room, index) => {
        const y = 570 + index * 40;

        // Room frame/background
        const frame = this.add.graphics();
        frame.x = this.center_width;
        frame.y = y;
        this.roomFrames.push(frame);

        // Room info text
        const roomText = `Room: ${room.id}`;
        const playersText = `Players: ${room.playerCount}/${room.maxPlayers}`;

        const roomTextElement = this.add
          .bitmapText(this.center_width, y - 8, "pixelFont", roomText, 16)
          .setOrigin(0.5);
        this.roomListTexts.push(roomTextElement);

        const playersTextElement = this.add
          .bitmapText(this.center_width, y + 8, "pixelFont", playersText, 12)
          .setOrigin(0.5)
          .setTint(0xaaaaaa);
        this.roomListTexts.push(playersTextElement);
      });

      this.updateRoomSelection();
    }

    // Instructions
    if (rooms.length > 0) {
      this.joinInstructions = this.add
        .bitmapText(
          this.center_width,
          720,
          "pixelFont",
          "↑↓: Select Room | SPACE: Join | R: Refresh | ESC: Back",
          12
        )
        .setOrigin(0.5)
        .setTint(0x666666);
    } else {
      this.joinInstructions = this.add
        .bitmapText(
          this.center_width,
          620,
          "pixelFont",
          "R: Refresh | ESC: Back",
          14
        )
        .setOrigin(0.5)
        .setTint(0x666666);
    }
  }

  /*
    Show connecting status
    */
  showConnecting(message = "Connecting...") {
    this.hideAllMenus();
    this.currentMenu = "connecting";

    this.connectingTitle = this.add
      .bitmapText(this.center_width, 520, "pixelFont", message, 20)
      .setOrigin(0.5)
      .setTint(0xffbf00);

    // Add loading animation
    this.connectingDots = this.add
      .bitmapText(this.center_width, 560, "pixelFont", "...", 18)
      .setOrigin(0.5)
      .setTint(0x888888);

    this.tweens.add({
      targets: this.connectingDots,
      alpha: { from: 1, to: 0.3 },
      duration: 500,
      repeat: -1,
      yoyo: true,
    });
  }

  /*
    Show lobby screen
    */
  showLobby(roomData, isHost) {
    this.hideAllMenus();
    this.currentMenu = "lobby";
    this.isHost = isHost;
    this.roomData = roomData;

    // Room title
    this.lobbyTitle = this.add
      .bitmapText(
        this.center_width,
        480,
        "pixelFont",
        `Room: ${roomData.roomId}`,
        20
      )
      .setOrigin(0.5)
      .setTint(0xffbf00);

    // Host indicator
    const hostText = isHost ? "You are the host" : "Waiting for host...";
    this.hostIndicator = this.add
      .bitmapText(this.center_width, 510, "pixelFont", hostText, 14)
      .setOrigin(0.5)
      .setTint(isHost ? 0x00ff00 : 0x888888);

    // Add warning for host to wait for players
    if (isHost) {
      this.hostWarning = this.add
        .bitmapText(
          this.center_width,
          530,
          "pixelFont",
          "Wait for other players to join!",
          12
        )
        .setOrigin(0.5)
        .setTint(0xffaa00);
    }

    // Players list
    this.playersTitle = this.add
      .bitmapText(this.center_width, 550, "pixelFont", "Players:", 16)
      .setOrigin(0.5)
      .setTint(0xffffff);

    this.playersList = [];
    this.updateLobby();

    // Instructions
    if (isHost) {
      this.lobbyInstructions = this.add
        .bitmapText(
          this.center_width,
          700,
          "pixelFont",
          "SPACE: Start Game | ESC: Leave",
          14
        )
        .setOrigin(0.5)
        .setTint(0x666666);
    } else {
      this.lobbyInstructions = this.add
        .bitmapText(this.center_width, 700, "pixelFont", "ESC: Leave Room", 14)
        .setOrigin(0.5)
        .setTint(0x666666);
    }
  }

  /*
    Update lobby player list
    */
  updateLobby() {
    if (this.currentMenu !== "lobby") {
      console.log("Not updating lobby - current menu is:", this.currentMenu);
      return;
    }

    console.log("Updating lobby player list...");

    // Clear existing player list
    if (this.playersList) {
      this.playersList.forEach((text) => text.destroy());
    }
    this.playersList = [];

    // Get current room info
    const roomInfo = this.networkManager.getRoomInfo();
    console.log("Room info for lobby update:", roomInfo);

    if (!roomInfo.players || roomInfo.players.length === 0) {
      console.log("No players found in room info");
      return;
    }

    roomInfo.players.forEach((player, index) => {
      const y = 580 + index * 25;
      const playerText = `${player.name} ${
        player.id === roomInfo.playerId ? "(You)" : ""
      }`;

      console.log(`Adding player to lobby: ${playerText}`);

      const text = this.add
        .bitmapText(this.center_width, y, "pixelFont", playerText, 14)
        .setOrigin(0.5)
        .setTint(player.id === roomInfo.playerId ? 0x00ff00 : 0xffffff);

      this.playersList.push(text);
    });

    // Update player count display
    if (this.hostWarning && this.isHost) {
      const playerCount = roomInfo.players.length;
      if (playerCount > 1) {
        this.hostWarning.setText(
          `${playerCount} players ready! Press SPACE to start.`
        );
        this.hostWarning.setTint(0x00ff00);
      } else {
        this.hostWarning.setText("Wait for other players to join!");
        this.hostWarning.setTint(0xffaa00);
      }
    }
  }

  /*
    Show notification when a player joins
    */
  showPlayerJoinedNotification(playerName) {
    if (this.joinNotification) {
      this.joinNotification.destroy();
    }

    this.joinNotification = this.add
      .bitmapText(
        this.center_width,
        450,
        "pixelFont",
        `${playerName} joined!`,
        16
      )
      .setOrigin(0.5)
      .setTint(0x00ff00);

    // Auto-hide after 3 seconds
    this.time.delayedCall(3000, () => {
      if (this.joinNotification) {
        this.joinNotification.destroy();
        this.joinNotification = null;
      }
    });

    this.playAudioRandomly("coin"); // Play a sound when someone joins
  }

  /*
    Show notification when a player leaves
    */
  showPlayerLeftNotification(playerId) {
    if (this.joinNotification) {
      this.joinNotification.destroy();
    }

    this.joinNotification = this.add
      .bitmapText(this.center_width, 450, "pixelFont", "A player left", 16)
      .setOrigin(0.5)
      .setTint(0xff4444);

    // Auto-hide after 3 seconds
    this.time.delayedCall(3000, () => {
      if (this.joinNotification) {
        this.joinNotification.destroy();
        this.joinNotification = null;
      }
    });

    this.playAudioRandomly("stone_fail"); // Play a sound when someone leaves
  }

  /*
    Show error message
    */
  showError(message) {
    if (this.errorText) {
      this.errorText.destroy();
    }

    this.errorText = this.add
      .bitmapText(this.center_width, 750, "pixelFont", message, 16)
      .setOrigin(0.5)
      .setTint(0xff4444);

    // Auto-hide after 3 seconds
    this.time.delayedCall(3000, () => {
      if (this.errorText) {
        this.errorText.destroy();
        this.errorText = null;
      }
    });
  }

  /*
    Hide all menu elements
    */
  hideAllMenus() {
    this.hideGameModeSelection();
    this.hidePlayerSelection();
    this.hideJoinGameMenu();
    this.hideConnecting();
    this.hideLobby();
  }

  /*
    Shows the player selection interface
    */
  showPlayerSelection() {
    this.currentMenu = "playerSelect";
    this.playerSelectionShown = true;

    // Title for player selection
    this.playerSelectionTitle = this.add
      .bitmapText(this.center_width, 520, "pixelFont", "SELECT PLAYER", 15)
      .setOrigin(0.5)
      .setTint(0xffbf00);

    // Create player selection containers
    this.playerSprites = [];
    this.playerNames = [];
    this.playerFrames = [];
    this.lockIcons = [];

    const startX = this.center_width - (this.players.length - 1) * 80;

    this.players.forEach((player, index) => {
      const x = startX + index * 160;
      const y = 650;

      // Create background frame for each player
      const frame = this.add.graphics();
      frame.lineStyle(3, 0x444444);
      frame.strokeRoundedRect(x - 50, y - 40, 100, 80, 10);
      this.playerFrames.push(frame);

      // Create player sprite
      let sprite;
      if (player.unlocked) {
        sprite = this.add.sprite(x, y, player.key, 0);
        sprite.setScale(player.key === "vanoSprite" ? 0.6 : 1);

        // Add walking animation for unlocked players
        this.tweens.add({
          targets: sprite,
          duration: 800,
          y: y - 5,
          repeat: -1,
          yoyo: true,
          ease: "Sine.easeInOut",
        });
      } else {
        // Show silhouette for locked players
        sprite = this.add.sprite(x, y, player.key, 0);
        sprite.setScale(player.key === "vanoSprite" ? 0.6 : 1);
        sprite.setTint(0x333333);
        sprite.setAlpha(0.5);

        // Add lock icon
        // const lock = this.add.graphics();
        // lock.fillStyle(0xff4444);
        // lock.fillRoundedRect(x - 15, y - 25, 30, 20, 5);
        // lock.lineStyle(3, 0xff4444);
        // lock.strokeCircle(x, y - 15, 8);
        // lock.fillStyle(0x000000);
        // lock.fillCircle(x, y - 12, 3);
        // this.lockIcons.push(lock);

        // Add "LOCKED" text
        const lockedText = this.add
          .bitmapText(x, y + 25, "pixelFont", "LOCKED", 12)
          .setOrigin(0.5)
          .setTint(0xff4444);
        this.lockIcons.push(lockedText);
      }

      this.playerSprites.push(sprite);

      // Player name
      const nameColor = player.unlocked ? 0xffffff : 0x666666;
      const name = this.add
        .bitmapText(x, y + 50, "pixelFont", player.name, 18)
        .setOrigin(0.5)
        .setTint(nameColor);
      this.playerNames.push(name);
    });

    this.updatePlayerSelection();
  }

  /*
    Hides the player selection interface
    */
  hidePlayerSelection() {
    if (this.playerSelectionTitle) {
      this.playerSelectionTitle.destroy();
      this.playerSelectionTitle = null;
    }

    if (this.playerSprites) {
      this.playerSprites.forEach((sprite) => sprite.destroy());
      this.playerSprites = null;
    }

    if (this.playerNames) {
      this.playerNames.forEach((name) => name.destroy());
      this.playerNames = null;
    }

    if (this.playerFrames) {
      this.playerFrames.forEach((frame) => frame.destroy());
      this.playerFrames = null;
    }

    if (this.lockIcons) {
      this.lockIcons.forEach((icon) => icon.destroy());
      this.lockIcons = null;
    }

    this.playerSelectionShown = false;
  }

  /*
    Hides the join game menu
    */
  hideJoinGameMenu() {
    if (this.joinTitle) {
      this.joinTitle.destroy();
      this.joinTitle = null;
    }

    if (this.joinText) {
      this.joinText.destroy();
      this.joinText = null;
    }

    if (this.joinSubText) {
      this.joinSubText.destroy();
      this.joinSubText = null;
    }

    if (this.roomListTexts) {
      this.roomListTexts.forEach((text) => text.destroy());
      this.roomListTexts = null;
    }

    if (this.roomFrames) {
      this.roomFrames.forEach((frame) => frame.destroy());
      this.roomFrames = null;
    }

    if (this.joinInstructions) {
      this.joinInstructions.destroy();
      this.joinInstructions = null;
    }

    // Clear room selection state (but preserve join state if we're joining)
    this.availableRooms = null;
    this.selectedRoomIndex = 0;

    // Only clear join state if we're not in the middle of joining a room
    if (!this.joiningRoom) {
      this.selectedRoomToJoin = null;
    }
  }

  /*
    Hide connecting screen
    */
  hideConnecting() {
    if (this.connectingTitle) {
      this.connectingTitle.destroy();
      this.connectingTitle = null;
    }

    if (this.connectingDots) {
      this.connectingDots.destroy();
      this.connectingDots = null;
    }

    // Clear any pending join timeout
    if (this.joinTimeout) {
      clearTimeout(this.joinTimeout);
      this.joinTimeout = null;
    }
  }

  /*
    Hide lobby screen
    */
  hideLobby() {
    if (this.lobbyTitle) {
      this.lobbyTitle.destroy();
      this.lobbyTitle = null;
    }

    if (this.hostIndicator) {
      this.hostIndicator.destroy();
      this.hostIndicator = null;
    }

    if (this.playersTitle) {
      this.playersTitle.destroy();
      this.playersTitle = null;
    }

    if (this.playersList) {
      this.playersList.forEach((text) => text.destroy());
      this.playersList = null;
    }

    if (this.lobbyInstructions) {
      this.lobbyInstructions.destroy();
      this.lobbyInstructions = null;
    }

    if (this.hostWarning) {
      this.hostWarning.destroy();
      this.hostWarning = null;
    }

    if (this.joinNotification) {
      this.joinNotification.destroy();
      this.joinNotification = null;
    }
  }

  /*
    Updates the visual selection indicator
    */
  updatePlayerSelection() {
    if (!this.playerFrames) return;

    this.playerFrames.forEach((frame, index) => {
      frame.clear();
      if (index === this.selectedPlayerIndex && this.players[index].unlocked) {
        // Highlight selected player with golden frame
        frame.lineStyle(4, 0xffbf00);
        frame.strokeRoundedRect(-50, -40, 100, 80, 10);

        // Add glow effect
        frame.lineStyle(2, 0xffffff, 0.5);
        frame.strokeRoundedRect(-52, -42, 104, 84, 12);
      } else {
        // Normal frame
        const color = this.players[index].unlocked ? 0x888888 : 0x444444;
        frame.lineStyle(3, color);
        frame.strokeRoundedRect(-50, -40, 100, 80, 10);
      }
    });

    // Update player name colors
    this.playerNames.forEach((name, index) => {
      if (index === this.selectedPlayerIndex && this.players[index].unlocked) {
        name.setTint(0xffbf00);
      } else {
        name.setTint(this.players[index].unlocked ? 0xffffff : 0x666666);
      }
    });
  }

  /*
    Check which players should be unlocked based on game progress
    */
  checkUnlockedPlayers() {
    // Get game progress from registry
    const levelsCompleted = this.registry.get("levelsCompleted") || 0;
    const coinsCollected = this.registry.get("totalCoins") || 0;
    const secretFound = this.registry.get("secretFound") || false;

    // Unlock players based on conditions
    // if (levelsCompleted >= 3) {
    //   this.players[1].unlocked = true; // Walt
    // }
    // if (coinsCollected >= 50) {
    //   this.players[2].unlocked = true; // Zombie
    // }
    // if (secretFound) {
    //   this.players[3].unlocked = true; // Penguin
    // }
  }

  /*
    Show unlock condition when hovering over locked players
    */
  showUnlockCondition(playerIndex) {
    if (this.players[playerIndex].unlocked) return;

    if (this.unlockText) {
      this.unlockText.destroy();
    }

    this.unlockText = this.add
      .bitmapText(
        this.center_width,
        650,
        "pixelFont",
        this.players[playerIndex].unlockCondition,
        16
      )
      .setOrigin(0.5)
      .setTint(0xff8888);

    // Auto-hide after 3 seconds
    this.time.delayedCall(3000, () => {
      if (this.unlockText) {
        this.unlockText.destroy();
        this.unlockText = null;
      }
    });
  }
}
