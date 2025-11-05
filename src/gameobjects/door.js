export default class Door extends Phaser.GameObjects.Rectangle {
  constructor(scene, x, y, width, height, targetScene = null) {
    super(scene, x, y, width, height, 0x00ff00, 0.3); // Green with transparency for debugging
    this.scene.add.existing(this);
    this.scene.physics.add.existing(this);
    this.body.setImmovable(true);
    this.body.moves = false;
    this.targetScene = targetScene;
    this.setVisible(false); // Make invisible in production (set to true for debugging)
    this.isActivated = false; // Prevent multiple activations
  }

  // Method to toggle visibility for debugging
  toggleDebugVisibility() {
    this.setVisible(!this.visible);
  }

  // Activate the door (called when player enters)
  activate() {
    if (!this.isActivated && this.targetScene !== null) {
      this.isActivated = true;
      return true;
    }
    return false;
  }

  // Reset the door activation state
  reset() {
    this.isActivated = false;
  }
}
