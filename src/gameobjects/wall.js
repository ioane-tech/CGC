export default class Wall extends Phaser.GameObjects.Rectangle {
  constructor(scene, x, y, width, height) {
    super(scene, x, y, width, height, 0xff0000, 0.3); // Red with transparency for debugging
    this.scene.add.existing(this);
    this.scene.physics.add.existing(this);
    this.body.setImmovable(true);
    this.body.moves = false;
    this.setVisible(true); // Make invisible - only for collision (set to false for debugging)
  }

  // Method to toggle visibility for debugging
  toggleDebugVisibility() {
    this.setVisible(!this.visible);
  }
}
