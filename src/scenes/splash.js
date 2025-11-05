import { Debris } from "../gameobjects/particle";

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
    
    // Player selection state
    this.selectedPlayerIndex = 0;
    this.players = [
      { key: "vanoSprite", name: "VANO", unlocked: true, frames: { width: 64, height: 127 }, unlockCondition: "default" },
      { key: "walt", name: "Demchex", unlocked: false, frames: { width: 64, height: 64 }, unlockCondition: "Complete 3 levels" },
      { key: "zombie", name: "Machex", unlocked: false, frames: { width: 64, height: 64 }, unlockCondition: "Collect 50 coins" },
      { key: "penguin", name: "IO", unlocked: false, frames: { width: 64, height: 64 }, unlockCondition: "Find secret area" },
      { key: "penguin", name: "Willen", unlocked: false, frames: { width: 64, height: 64 }, unlockCondition: "Find secret area" }
    ];

    // Check for unlocked players from registry
    this.checkUnlockedPlayers();

    // Input handling
    this.cursors = this.input.keyboard.createCursorKeys();
    this.input.keyboard.on("keydown-SPACE", () => this.startGame(), this);
    this.input.keyboard.on("keydown-ENTER", () => this.startGame(), this);
    
    this.playMusic();
    this.showTitle();
    this.time.delayedCall(1000, () => this.showInstructions(), null, this);
    this.time.delayedCall(1500, () => this.showPlayerSelection(), null, this);
    this.playAudioRandomly("writing-with-pencil");
  }

  update() {
    // Handle player selection navigation
    if (this.playerSelectionShown) {
      if (Phaser.Input.Keyboard.JustDown(this.cursors.left)) {
        this.changePlayer(-1);
      } else if (Phaser.Input.Keyboard.JustDown(this.cursors.right)) {
        this.changePlayer(1);
      }
    }
  }

  changePlayer(direction) {
    const newIndex = (this.selectedPlayerIndex + direction + this.players.length) % this.players.length;
    
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

  startGame() {
    if (this.theme) this.theme.stop();
    // Pass selected player to the game
    this.registry.set("selectedPlayer", this.players[this.selectedPlayerIndex].key);
    this.scene.start("transition", {
      next: "game",
      name: "STAGE",
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
    const volume = Phaser.Math.Between(0.8, 1);
    const rate = 1;
    this.sound.add(key).play({ volume, rate });
  }

  playMusic(theme = "startSound") {
    this.theme = this.sound.add(theme);
    if (this.theme && this.theme.isPlaying) this.theme.stop();
    this.theme.play({
      mute: false,
      volume: 1,
      rate: 1,
      detune: 0,
      seek: 0,
      loop: true,
      delay: 0,
    });
  }

  /*
    Generates the instructions text for the player.
    */
  showInstructions() {
    this.add
      .bitmapText(this.center_width, 450, "pixelFont", "WASD/Arrows: move", 20)
      .setOrigin(0.5);
    this.add
      .bitmapText(this.center_width, 480, "pixelFont", "SPACE: jump", 20)
      .setOrigin(0.5);
  }

  /*
    Shows the player selection interface
    */
  showPlayerSelection() {
    this.playerSelectionShown = true;
    
    // Title for player selection
    this.add
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
          ease: 'Sine.easeInOut'
        });
      } else {
        // Show silhouette for locked players
        sprite = this.add.sprite(x, y, player.key, 0);
        sprite.setScale(player.key === "vanoSprite" ? 0.6 : 1);
        sprite.setTint(0x333333);
        sprite.setAlpha(0.5);

        // Add lock icon
        const lock = this.add.graphics();
        lock.fillStyle(0xff4444);
        lock.fillRoundedRect(x - 15, y - 25, 30, 20, 5);
        lock.lineStyle(3, 0xff4444);
        lock.strokeCircle(x, y - 15, 8);
        lock.fillStyle(0x000000);
        lock.fillCircle(x, y - 12, 3);
        this.lockIcons.push(lock);

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
    if (levelsCompleted >= 3) {
      this.players[1].unlocked = true; // Walt
    }
    if (coinsCollected >= 50) {
      this.players[2].unlocked = true; // Zombie
    }
    if (secretFound) {
      this.players[3].unlocked = true; // Penguin
    }

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
      .bitmapText(this.center_width, 650, "pixelFont", this.players[playerIndex].unlockCondition, 16)
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
