import Blow from "./blow";
import Brick from "./brick";
import { JumpSmoke } from "./particle";

class Player extends Phaser.GameObjects.Sprite {
  constructor(scene, x, y, health = 10) {
    // Get selected player from registry, default to vanoSprite
    const selectedPlayer = scene.registry.get("selectedPlayer") || "vanoSprite";
    super(scene, x, y, selectedPlayer);
    this.setOrigin(0.5);
    this.playerSprite = selectedPlayer;

    this.scene.add.existing(this);
    this.scene.physics.add.existing(this);

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

    this.right = true;
    this.body.setGravityY(0); // Remove gravity for top-down movement
    this.body.setSize(48, 60);
    this.init();
    this.jumping = false;
    this.building = false;
    this.falling = false;
    this.mjolnir = false;
    this.walkVelocity = 200;
    this.jumpVelocity = -400;
    this.invincible = false;

    this.health = health;
    this.dead = false;

    // Remove old WASD keys - we're using arrows only now
  }

  /*
    Inits the animations for the player: init, idle, walk, jump, death, etc... and it adds a listener for the `animationcomplete` event.
    */
  init() {
    // Define animation frames based on player sprite
    const animConfig = this.getAnimationConfig();

    this.scene.anims.create({
      key: "startidle",
      frames: this.scene.anims.generateFrameNumbers(this.playerSprite, {
        start: animConfig.idle.start,
        end: animConfig.idle.end,
      }),
      frameRate: 10,
      repeat: -1,
    });

    this.scene.anims.create({
      key: "playeridle",
      frames: this.scene.anims.generateFrameNumbers(this.playerSprite, {
        start: animConfig.idle.start,
        end: animConfig.idle.end,
      }),
      frameRate: 10,
      repeat: -1,
    });

    this.scene.anims.create({
      key: "playerwalk",
      frames: this.scene.anims.generateFrameNumbers(this.playerSprite, {
        start: animConfig.walk.start,
        end: animConfig.walk.end,
      }),
      frameRate: 10,
      repeat: -1,
    });

    this.scene.anims.create({
      key: "playerjump",
      frames: this.scene.anims.generateFrameNumbers(this.playerSprite, {
        start: animConfig.jump.start,
        end: animConfig.jump.end,
      }),
      frameRate: 1,
    });

    this.scene.anims.create({
      key: "playerhammer",
      frames: this.scene.anims.generateFrameNumbers(this.playerSprite, {
        start: animConfig.hammer.start,
        end: animConfig.hammer.end,
      }),
      frameRate: 10,
    });

    this.scene.anims.create({
      key: "playerbuild",
      frames: this.scene.anims.generateFrameNumbers(this.playerSprite, {
        start: animConfig.build.start,
        end: animConfig.build.end,
      }),
      frameRate: 10,
      repeat: 2,
    });

    this.scene.anims.create({
      key: "playerdead",
      frames: this.scene.anims.generateFrameNumbers(this.playerSprite, {
        start: animConfig.death.start,
        end: animConfig.death.end,
      }),
      frameRate: 5,
    });

    this.anims.play("startidle", true);

    this.on("animationcomplete", this.animationComplete, this);
  }

  /*
    Returns animation frame configuration for different player sprites
    */
  getAnimationConfig() {
    switch (this.playerSprite) {
      case "vanoSprite":
        return {
          idle: { start: 0, end: 0 },
          walk: { start: 0, end: 1 },
          jump: { start: 0, end: 0 },
          hammer: { start: 0, end: 1 },
          build: { start: 0, end: 1 },
          death: { start: 0, end: 0 }
        };
      case "walt":
        return {
          idle: { start: 0, end: 0 },
          walk: { start: 1, end: 3 },
          jump: { start: 4, end: 4 },
          hammer: { start: 7, end: 8 },
          build: { start: 9, end: 10 },
          death: { start: 11, end: 16 }
        };
      case "zombie":
        return {
          idle: { start: 0, end: 0 },
          walk: { start: 0, end: 2 },
          jump: { start: 0, end: 0 },
          hammer: { start: 3, end: 4 },
          build: { start: 3, end: 4 },
          death: { start: 5, end: 5 }
        };
      case "penguin":
        return {
          idle: { start: 0, end: 1 },
          walk: { start: 2, end: 5 },
          jump: { start: 6, end: 6 },
          hammer: { start: 2, end: 3 },
          build: { start: 4, end: 5 },
          death: { start: 6, end: 6 }
        };
      default:
        return {
          idle: { start: 0, end: 0 },
          walk: { start: 0, end: 1 },
          jump: { start: 0, end: 0 },
          hammer: { start: 0, end: 1 },
          build: { start: 0, end: 1 },
          death: { start: 0, end: 0 }
        };
    }
  }

  /*
    Top-down 2D movement system for MMORPG-style gameplay.
    Arrow keys control movement in all four directions.
    */
  update() {
    if (this.dead) return;

    let velocityX = 0;
    let velocityY = 0;
    let isMoving = false;

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
    if (isMoving && !this.building) {
      this.anims.play("playerwalk", true);
    } else if (!this.building) {
      this.anims.play("playeridle", true);
    }

    // Action keys
    if (Phaser.Input.Keyboard.JustDown(this.spaceBar)) {
      // Space can be used for special action or dash
      console.log("Space pressed - reserved for special action");
    }

    if (Phaser.Input.Keyboard.JustDown(this.zKey)) {
      this.hammerBlow(); // Z key for hammer blow
    }

    if (Phaser.Input.Keyboard.JustDown(this.xKey)) {
      this.buildBlock(); // X key for building blocks
    }

    // C key reserved for future action
    if (Phaser.Input.Keyboard.JustDown(this.cKey)) {
      // Reserved for future action you'll provide
      console.log("C key pressed - action reserved for future implementation");
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
    this.anims.play("playerbuild", true);
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
    this.anims.play("playerhammer", true);
    const offsetX = this.right ? 32 : -32;
    const size = this.mjolnir ? 128 : 32;
    this.scene.blows.add(
      new Blow(this.scene, this.x + offsetX, this.y, size, size)
    );
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
    if (animation.key === "playerground") {
      this.anims.play("playeridle", true);
    }

    if (animation.key === "playerhammer" || animation.key === "playerbuild") {
      this.building = false;
      this.anims.play(this.jumping ? "playerjump" : "playeridle", true);
    }
  }

  /*
    This is called when the player is hit by an enemy. It reduces the health and checks if the player is dead.
    */
  hit() {
    this.health--;
    this.anims.play("playerdead", true);
    this.body.enable = false;
    if (this.health === 0) {
      this.die();
    }
  }

  /*
    This is called when the player is dead. It plays the death animation and restarts the scene.
    */
  die() {
    this.dead = true;
    this.anims.play("playerdead", true);
    this.body.immovable = true;
    this.body.moves = false;
    this.scene.restartScene();
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
}

export default Player;
