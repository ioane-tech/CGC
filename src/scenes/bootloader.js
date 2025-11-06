export default class Bootloader extends Phaser.Scene {
  constructor() {
    super({ key: "bootloader" });
  }

  preload() {
    this.createBars();
    this.load.on(
      "progress",
      function (value) {
        this.progressBar.clear();
        this.progressBar.fillStyle(0xf09937, 1);
        this.progressBar.fillRect(
          this.cameras.main.width / 4,
          this.cameras.main.height / 2 - 16,
          (this.cameras.main.width / 2) * value,
          16
        );
      },
      this
    );

    this.load.on(
      "complete",
      () => {
        this.scene.start("splash");
      },
      this
    );

    Array(5)
      .fill(0)
      .forEach((_, i) => {
        this.load.audio(`music${i}`, `assets/sounds/music${i}.mp3`);
      });

    this.load.image("pello", "assets/images/pello.png");
    this.load.image("landscape", "assets/images/landscape.png");

    this.load.audio("startSound", "assets/sounds/startSound.mp3");
    this.load.audio(
      "writing-with-pencil",
      "assets/sounds/writing-with-pencil.mp3"
    );
    this.load.audio("build", "assets/sounds/build.mp3");
    this.load.audio("coin", "assets/sounds/coin.mp3");
    this.load.audio("death", "assets/sounds/death.mp3");
    this.load.audio("jump", "assets/sounds/jump.mp3");
    this.load.audio("kill", "assets/sounds/kill.mp3");
    this.load.audio("land", "assets/sounds/land.mp3");
    this.load.audio("lunchbox", "assets/sounds/lunchbox.mp3");
    this.load.audio("prize", "assets/sounds/prize.mp3");
    this.load.audio("stone_fail", "assets/sounds/stone_fail.mp3");
    this.load.audio("stone", "assets/sounds/stone.mp3");
    this.load.audio("foedeath", "assets/sounds/foedeath.mp3");
    this.load.audio("stage", "assets/sounds/stage.mp3");

    this.load.audio("splash", "assets/sounds/splash.mp3");

    // Create simple mute/unmute button images programmatically
    this.createMuteButtonImages();

    Array(2)
      .fill(0)
      .forEach((_, i) => {
        this.load.image(`brick${i}`, `assets/images/brick${i}.png`);
      });

    Array(5)
      .fill(0)
      .forEach((_, i) => {
        this.load.image(
          `platform${i + 2}`,
          `assets/images/platform${i + 2}.png`
        );
      });

    this.load.bitmapFont(
      "pixelFont",
      "assets/fonts/mario.png",
      "assets/fonts/mario.xml"
    );
    this.load.spritesheet("walt", "assets/images/walt.png", {
      frameWidth: 64,
      frameHeight: 64,
    });
    this.load.spritesheet("vanoSprite", "assets/images/vanoSprite.png", {
      frameWidth: 64,
      frameHeight: 150,
    });
    this.load.spritesheet("IoSprite", "assets/images/IoSprite.png", {
      frameWidth: 64,
      frameHeight: 145,
    });
    this.load.spritesheet(
      "demchenkoSprite",
      "assets/images/demchenkoSprite.png",
      {
        frameWidth: 69,
        frameHeight: 147,
      }
    );

    Array(5)
      .fill(0)
      .forEach((_, i) => {
        this.load.tilemapTiledJSON(`scene${i}`, `assets/maps/scene${i}.json`);
      });
    this.load.image("softbricks", "assets/maps/softbricks.png");
    this.load.image("bricks", "assets/maps/bricks.png");
    this.load.image("background", "assets/maps/background.png");

    this.load.image("chain", "assets/images/chain.png");
    this.load.spritesheet("bat", "assets/images/bat.png", {
      frameWidth: 32,
      frameHeight: 32,
    });
    this.load.image("logo", "assets/images/logo.png");
    this.load.spritesheet("zombie", "assets/images/zombie.png", {
      frameWidth: 64,
      frameHeight: 64,
    });
    this.load.spritesheet("penguin", "assets/images/penguin.png", {
      frameWidth: 64,
      frameHeight: 64,
    });
    this.load.spritesheet("coin", "assets/images/coin.png", {
      frameWidth: 64,
      frameHeight: 64,
    });
    this.load.spritesheet("lunchbox", "assets/images/lunchbox.png", {
      frameWidth: 64,
      frameHeight: 64,
    });
    this.load.spritesheet("hammer", "assets/images/hammer.png", {
      frameWidth: 64,
      frameHeight: 64,
    });
    this.load.spritesheet("speed", "assets/images/speed.png", {
      frameWidth: 64,
      frameHeight: 64,
    });
    this.load.spritesheet("boots", "assets/images/boots.png", {
      frameWidth: 64,
      frameHeight: 64,
    });
    this.load.spritesheet("star", "assets/images/star.png", {
      frameWidth: 64,
      frameHeight: 64,
    });

    this.load.bitmapFont(
      "hammerfont",
      "assets/fonts/hammer.png",
      "assets/fonts/hammer.xml"
    );
    this.registry.set("score", 0);
    this.registry.set("coins", 0);
  }

  createBars() {
    this.loadBar = this.add.graphics();
    this.loadBar.fillStyle(0xca6702, 1);
    this.loadBar.fillRect(
      this.cameras.main.width / 4 - 2,
      this.cameras.main.height / 2 - 18,
      this.cameras.main.width / 2 + 4,
      20
    );
    this.progressBar = this.add.graphics();
  }

  createMuteButtonImages() {
    this.createButtonTexture('muteButton', true);
    this.createButtonTexture('unmuteButton', false);
  }

  createButtonTexture(textureName, isMuted) {
    const graphics = this.add.graphics();
    const size = 48;
    const center = size / 2;
    
    // Modern gradient background with soft shadow
    this.drawModernBackground(graphics, center);
    
    // Sleek speaker icon
    this.drawModernSpeaker(graphics, center, isMuted);
    
    // Status indicator
    if (isMuted) {
      this.drawSlashIndicator(graphics, center);
    } else {
      this.drawModernSoundWaves(graphics, center);
    }
    
    graphics.generateTexture(textureName, size, size);
    graphics.destroy();
  }

  drawModernBackground(graphics, center) {
    // Outer glow/shadow
    graphics.fillStyle(0x000000, 0.3);
    graphics.fillCircle(center, center + 1, 20);
    
    // Main background with gradient effect (layered circles)
    graphics.fillStyle(0x2a2a2a, 1);
    graphics.fillCircle(center, center, 20);
    
    graphics.fillStyle(0x383838, 1);
    graphics.fillCircle(center - 2, center - 2, 18);
    
    // Subtle border
    graphics.lineStyle(1.5, 0x4a4a4a, 1);
    graphics.strokeCircle(center, center, 20);
  }

  drawModernSpeaker(graphics, center, isMuted) {
    const color = isMuted ? 0xaaaaaa : 0xffffff;
    graphics.fillStyle(color, 1);
    
    // Rounded speaker body
    graphics.fillRoundedRect(center - 10, center - 5, 5, 10, 1);
    
    // Speaker cone with smoother shape
    graphics.beginPath();
    graphics.moveTo(center - 5, center - 6);
    graphics.lineTo(center - 5, center + 6);
    graphics.lineTo(center + 3, center + 3);
    graphics.lineTo(center + 3, center - 3);
    graphics.closePath();
    graphics.fillPath();
  }

  drawSlashIndicator(graphics, center) {
    // Red diagonal line with glow effect
    graphics.lineStyle(3, 0xff3333, 0.3);
    graphics.beginPath();
    graphics.moveTo(center - 8, center - 8);
    graphics.lineTo(center + 8, center + 8);
    graphics.strokePath();
    
    graphics.lineStyle(2, 0xff4444, 1);
    graphics.beginPath();
    graphics.moveTo(center - 8, center - 8);
    graphics.lineTo(center + 8, center + 8);
    graphics.strokePath();
  }

  drawModernSoundWaves(graphics, center) {
    // Animated-looking sound waves with gradient opacity
    const waves = [
      { radius: 10, opacity: 1, width: 2.5 },
      { radius: 13, opacity: 0.7, width: 2 },
      { radius: 16, opacity: 0.4, width: 1.5 }
    ];
    
    waves.forEach(wave => {
      graphics.lineStyle(wave.width, 0x44ff88, wave.opacity);
      graphics.beginPath();
      graphics.arc(center, center, wave.radius, -Math.PI / 4, Math.PI / 4);
      graphics.strokePath();
    });
  }
}
