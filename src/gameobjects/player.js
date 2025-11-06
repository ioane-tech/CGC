import Blow from "./blow";
import Brick from "./brick";
import { JumpSmoke } from "./particle";

class Player extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y, health = 10, isLocal = true, remoteSprite = null) {
    // For remote players, use the provided sprite; for local players, get from registry
    let selectedPlayer;
    if (isLocal) {
      // Local player: use registry
      selectedPlayer = scene.registry.get("selectedPlayer") || "IoSprite";
    } else {
      // Remote player: use provided sprite or fallback
      selectedPlayer = remoteSprite || "IoSprite";
    }

    super(scene, x, y, selectedPlayer);
    this.setOrigin(0.5);
    this.playerSprite = selectedPlayer;
    this.animationKeys = this.buildAnimationKeyMap();
    this.isLocal = isLocal; // Whether this player is controlled by local input

    console.log(
      `Player created: isLocal=${isLocal}, sprite=${selectedPlayer}, remoteSprite=${remoteSprite}`
    );

    this.scene.add.existing(this);
    this.scene.physics.add.existing(this);

    // Only set up input controls for local players
    if (this.isLocal) {
      // New control scheme - Arrow keys only
      this.cursor = this.scene.input.keyboard.createCursorKeys();
      this.spaceBar = this.scene.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.SPACE
      );

      // Action keys Z, X, C
      this.zKey = this.scene.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.Z
      );
      this.xKey = this.scene.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.X
      );
      this.cKey = this.scene.input.keyboard.addKey(
        Phaser.Input.Keyboard.KeyCodes.C
      );
    } else {
      // Remote players don't have input controls
      this.cursor = null;
      this.spaceBar = null;
      this.zKey = null;
      this.xKey = null;
      this.cKey = null;
    }

    this.right = true;
    this.body.setGravityY(0); // Remove gravity for top-down movement
    this.body.setSize(48, 60);
    this.init();
    this.jumping = false;
    this.building = false;
    this.attacking = false;
    this.falling = false;
    this.mjolnir = false;
    this.walkVelocity = 200;
    this.jumpVelocity = -400;
    this.invincible = false;

    this.maxHealth = health;
    this.health = health;
    this.dead = false;
    this.playerId = null;
    this.damageCooldown = 150; // ms between damage ticks
    this.lastDamageTime = 0;

    this.createHealthBar();

    // Remove old WASD keys - we're using arrows only now
  }

  /*
    Create a map of animation keys scoped to the current sprite so multiple
    characters can coexist without clobbering each other's animations.
    */
  buildAnimationKeyMap() {
    const prefix = this.playerSprite;
    return {
      startidle: `${prefix}_startidle`,
      idle: `${prefix}_idle`,
      walk: `${prefix}_walk`,
      jump: `${prefix}_jump`,
      hammer: `${prefix}_hammer`,
      build: `${prefix}_build`,
      dead: `${prefix}_dead`,
      attack: `${prefix}_attack`,
    };
  }

  ensureAnimation(key, frameRange, frameRate, repeat = 0) {
    if (this.scene.anims.exists(key)) {
      return;
    }

    this.scene.anims.create({
      key,
      frames: this.scene.anims.generateFrameNumbers(this.playerSprite, {
        start: frameRange.start,
        end: frameRange.end,
      }),
      frameRate,
      repeat,
    });
  }

  createAnimations(animConfig) {
    this.ensureAnimation(
      this.animationKeys.startidle,
      animConfig.idle,
      0.5,
      -1
    );

    this.ensureAnimation(this.animationKeys.idle, animConfig.idle, 0.5, -1);
    this.ensureAnimation(this.animationKeys.walk, animConfig.walk, 10, -1);
    this.ensureAnimation(this.animationKeys.jump, animConfig.jump, 1);
    this.ensureAnimation(this.animationKeys.hammer, animConfig.hammer, 10);
    this.ensureAnimation(this.animationKeys.build, animConfig.build, 10, 2);
    this.ensureAnimation(this.animationKeys.dead, animConfig.death, 5);
    this.ensureAnimation(this.animationKeys.attack, animConfig.attack, 5);
  }

  /*
    Inits the animations for the player: init, idle, walk, jump, death, etc... and it adds a listener for the `animationcomplete` event.
    */
  init() {
    // Define animation frames based on player sprite
    const animConfig = this.getAnimationConfig();

    this.createAnimations(animConfig);

    this.anims.play(this.animationKeys.startidle, true);

    this.on("animationcomplete", this.animationComplete, this);
  }

  /*
    Returns animation frame configuration for different player sprites
    */
  getAnimationConfig() {
    switch (this.playerSprite) {
      case "vanoSprite":
        return {
          idle: { start: 0, end: 1 },
          walk: { start: 2, end: 5 },
          jump: { start: 0, end: 0 },
          hammer: { start: 0, end: 1 },
          build: { start: 0, end: 1 },
          death: { start: 0, end: 0 },
          attack: { start: 0, end: 0 },
        };
      case "demchenkoSprite":
        return {
          idle: { start: 0, end: 1 },
          walk: { start: 2, end: 5 },
          jump: { start: 4, end: 4 },
          hammer: { start: 7, end: 8 },
          build: { start: 9, end: 10 },
          death: { start: 11, end: 16 },
          attack: { start: 6, end: 7 },
        };
      case "zombie":
        return {
          idle: { start: 0, end: 0 },
          walk: { start: 0, end: 2 },
          jump: { start: 0, end: 0 },
          hammer: { start: 3, end: 4 },
          build: { start: 3, end: 4 },
          death: { start: 5, end: 5 },
          attack: { start: 0, end: 0 },
        };
      case "IoSprite":
        return {
          idle: { start: 8, end: 9 },
          walk: { start: 0, end: 3 },
          jump: { start: 6, end: 6 },
          hammer: { start: 2, end: 3 },
          build: { start: 4, end: 5 },
          death: { start: 6, end: 6 },
          attack: { start: 4, end: 7 },
        };
      default:
        return {
          idle: { start: 0, end: 0 },
          walk: { start: 0, end: 1 },
          jump: { start: 0, end: 0 },
          hammer: { start: 0, end: 1 },
          build: { start: 0, end: 1 },
          death: { start: 0, end: 0 },
          attack: { start: 0, end: 0 },
        };
    }
  }

  /*
    Top-down 2D movement system for MMORPG-style gameplay.
    Arrow keys control movement in all four directions.
    Only processes input for local players.
    */
  update() {
    if (this.dead) return;

    // Only handle input for local players
    if (!this.isLocal || !this.cursor) {
      return;
    }

    let velocityX = 0;
    let velocityY = 0;
    let isMoving = false;
    if (this.attacking) return;
    // Four-directional movement
    if (this.cursor.left.isDown) {
      velocityX = -this.walkVelocity;
      this.right = false;
      this.flipX = false;
      isMoving = true;
    }
    if (this.cursor.right.isDown) {
      velocityX = this.walkVelocity;
      this.right = true;
      this.flipX = true;
      isMoving = true;
    }
    if (this.cursor.up.isDown) {
      velocityY = -this.walkVelocity;
      isMoving = true;
    }
    if (this.cursor.down.isDown) {
      velocityY = this.walkVelocity;
      isMoving = true;
    }

    // Normalize diagonal movement (so moving diagonally isn't faster)
    if (velocityX !== 0 && velocityY !== 0) {
      const normalizedSpeed = this.walkVelocity * 0.707; // sqrt(2)/2 ≈ 0.707
      velocityX = velocityX > 0 ? normalizedSpeed : -normalizedSpeed;
      velocityY = velocityY > 0 ? normalizedSpeed : -normalizedSpeed;
    }

    // Apply movement
    this.body.setVelocityX(velocityX);
    this.body.setVelocityY(velocityY);

    // Handle animations
    if (isMoving && !this.building && !this.attacking) {
      this.anims.play(this.animationKeys.walk, true);
    } else if (!this.building && !this.attacking) {
      this.anims.play(this.animationKeys.idle, true);
    }

    // Action keys (only for local players)
    if (this.spaceBar && Phaser.Input.Keyboard.JustDown(this.spaceBar)) {
      // Space can be used for special action or dash
      console.log("Space pressed - reserved for special action");
    }

    if (this.zKey && Phaser.Input.Keyboard.JustDown(this.zKey)) {
      this.attack(); // Z key for hammer blow
    }

    if (this.xKey && Phaser.Input.Keyboard.JustDown(this.xKey)) {
      this.buildBlock(); // X key for building blocks
    }

    // C key reserved for future action
    if (this.cKey && Phaser.Input.Keyboard.JustDown(this.cKey)) {
      this.kick();
    }
  }

  /*
    This is called when the player hits the floor. It creates smoke particles. It reuses the jumpSmoke method.
    */
  landSmoke() {
    this.jumpSmoke(20);
  }

  jumpSmoke(offsetY = 10, varX) {
    Array(Phaser.Math.Between(3, 6))
      .fill(0)
      .forEach((i) => {
        const offset = varX || Phaser.Math.Between(-1, 1) > 0 ? 1 : -1;
        varX = varX || Phaser.Math.Between(0, 20);
        new JumpSmoke(this.scene, this.x + offset * varX, this.y + offsetY);
      });
  }

  /*
    This is called when the player generates a block. It also creates smoke particles.
    */
  buildBlock() {
    this.building = true;
    this.anims.play(this.animationKeys.build, true);
    this.scene.playAudio("build");
    const offsetX = this.right ? 64 : -64;
    const offsetY = this.jumpVelocity === -400 ? 0 : -128;
    this.buildSmoke(32, offsetX);
    this.scene.bricks.add(
      new Brick(this.scene, this.x + offsetX, this.y + offsetY)
    );
  }

  /*
    This generates the smoke particles when the player builds a block.
    */
  buildSmoke(offsetY = 10, offsetX) {
    Array(Phaser.Math.Between(8, 14))
      .fill(0)
      .forEach((i) => {
        const varX = Phaser.Math.Between(-20, 20);
        new JumpSmoke(this.scene, this.x + (offsetX + varX), this.y + offsetY);
      });
  }

  /*
    This is called when the player creates a blow to destroy something.
    */
  hammerBlow() {
    this.building = true;
    this.anims.play(this.animationKeys.hammer, true);
    const offsetX = this.right ? 32 : -32;
    const size = this.mjolnir ? 128 : 32;
    this.scene.blows.add(
      new Blow(this.scene, this.x + offsetX, this.y, size, size)
    );
  }

  attack() {
    this.attacking = true;
    this.anims.play(this.animationKeys.attack, true);
  }

  kick() {
    if (this.attacking || this.dead) return;
    this.attacking = true;
    const facingRight = this.right;
    if (this.scene && typeof this.scene.spawnPlayerAttack === "function") {
      this.scene.spawnPlayerAttack(this, {
        type: "kick",
        damage: 1,
        direction: facingRight ? "right" : "left",
        width: 54,
        height: 40,
        offsetY: -10,
        duration: 180,
      });
    }

    if (this.scene && typeof this.scene.handleLocalPlayerAction === "function" && this.isLocal) {
      this.scene.handleLocalPlayerAction("kick", {
        direction: facingRight ? "right" : "left",
        width: 54,
        height: 40,
        offsetY: -10,
        duration: 180,
        damage: 1,
      });
    }

    this.anims.play(this.animationKeys.attack, true);
  }

  /*
    This just turns the player in the opposite direction.
    */
  turn() {
    this.right = !this.right;
  }

  /*
    This is called when the player finishes an animation. It checks if the animation is the `playerground`, `playerhammer` or `playerbuild` and it plays the idle animation.
    */
  animationComplete(animation, frame) {
    const groundKey = `${this.playerSprite}_ground`;
    if (animation.key === "playerground" || animation.key === groundKey) {
      this.anims.play(this.animationKeys.idle, true);
    }

    if (
      animation.key === this.animationKeys.hammer ||
      animation.key === this.animationKeys.build ||
      animation.key === this.animationKeys.attack
    ) {
      this.attacking = false;
      this.building = false;
      this.anims.play(
        this.jumping ? this.animationKeys.jump : this.animationKeys.idle,
        true
      );
    }
  }

  /*
    This is called when the player is hit by an enemy. It reduces the health and checks if the player is dead.
    */
  hit() {
    this.takeDamage(1);
  }

  /*
    This is called when the player is dead. It plays the death animation and restarts the scene.
    */
  die() {
    if (this.dead) return;
    this.dead = true;
    this.anims.play(this.animationKeys.dead, true);
    if (this.body) {
      this.body.immovable = true;
      this.body.moves = false;
      this.body.setVelocity(0, 0);
      this.body.enable = false;
    }

    this.updateHealthBar();

    if (this.isLocal) {
      if (this.scene && typeof this.scene.restartScene === "function") {
        this.scene.restartScene();
      }
    } else {
      if (this.scene && this.scene.time) {
        this.scene.time.delayedCall(1500, () => {
          if (this && this.destroy) {
            this.destroy();
          }
        });
      }
    }
  }

  /*
    This is called when the player picks a prize. It checks the prize and calls the corresponding method.
    */
  applyPrize(prize) {
    switch (prize) {
      case "speed":
        this.walkVelocity = 330;
        this.flashPlayer();
        break;
      case "hammer":
        this.mjolnir = true;
        this.flashPlayer();
        break;
      case "boots":
        this.jumpVelocity = -600;
        this.flashPlayer();
        break;
      case "coin":
        this.scene.updateCoins();
        break;
      case "star":
        this.invincible = true;
        this.scene.tweens.add({
          targets: this,
          duration: 300,
          alpha: { from: 0.7, to: 1 },
          repeat: -1,
        });
        break;
      default:
        break;
    }
  }

  /*
    This is called when the player picks a prize. It flashes the player to show the player that he got a prize.
    */
  flashPlayer() {
    this.scene.tweens.add({
      targets: this,
      duration: 50,
      scale: { from: 1.2, to: 1 },
      repeat: 10,
    });
  }

  takeDamage(amount = 1) {
    if (this.invincible || this.dead || amount <= 0) return { applied: false, died: false };
    const now = this.scene?.time?.now || 0;
    if (now && this.lastDamageTime && now - this.lastDamageTime < this.damageCooldown) {
      return { applied: false, died: false };
    }

    this.lastDamageTime = now;
    this.health = Math.max(0, this.health - amount);
    this.updateHealthBar();
    if (this.scene && typeof this.scene.handlePlayerHealthChanged === "function") {
      this.scene.handlePlayerHealthChanged(this);
    }
    this.showDamageFeedback();

    if (this.health <= 0) {
      this.die();
      return { applied: true, died: true };
    }
    return { applied: true, died: false };
  }

  heal(amount = 1) {
    if (amount <= 0) return;
    this.health = Phaser.Math.Clamp(this.health + amount, 0, this.maxHealth);
    this.updateHealthBar();
    if (this.scene && typeof this.scene.handlePlayerHealthChanged === "function") {
      this.scene.handlePlayerHealthChanged(this);
    }
  }

  showDamageFeedback() {
    if (!this.scene) return;
    this.scene.tweens.add({
      targets: this,
      duration: 80,
      repeat: 2,
      yoyo: true,
      alpha: { from: 0.4, to: 1 },
      onComplete: () => {
        this.setAlpha(1);
      },
    });
  }

  createHealthBar() {
    if (!this.scene) return;
    this.healthBar = this.scene.add.graphics();
    this.healthBar.setDepth(999);
    this.updateHealthBar();
  }

  updateHealthBar() {
    if (!this.healthBar || !this.scene) return;
    const barWidth = 60;
    const barHeight = 8;
    const offsetY = this.displayHeight ? this.displayHeight / 2 + 20 : 50;
    const x = this.x - barWidth / 2;
    const y = this.y - offsetY;

    this.healthBar.clear();
    this.healthBar.fillStyle(0x000000, 0.5);
    this.healthBar.fillRect(x, y, barWidth, barHeight);

    const maxHealth = this.maxHealth > 0 ? this.maxHealth : 1;
    const healthPercent = Phaser.Math.Clamp(this.health / maxHealth, 0, 1);
    const innerWidth = Math.max(0, (barWidth - 2) * healthPercent);
    const color = healthPercent > 0.5 ? 0x3aff3a : healthPercent > 0.25 ? 0xffc107 : 0xff3a3a;
    this.healthBar.fillStyle(color, 0.9);
    this.healthBar.fillRect(x + 1, y + 1, innerWidth, barHeight - 2);
  }

  preUpdate(time, delta) {
    super.preUpdate(time, delta);
    this.updateHealthBar();
  }

  destroy(fromScene) {
    if (this.healthBar) {
      this.healthBar.destroy();
      this.healthBar = null;
    }
    super.destroy(fromScene);
  }
}

export default Player;
