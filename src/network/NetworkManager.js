import { io } from 'socket.io-client';

export default class NetworkManager {
  constructor(scene) {
    this.scene = scene;
    this.socket = null;
    this.isConnected = false;
    this.isHost = false;
    this.roomId = null;
    this.playerId = null;
    this.players = new Map(); // playerId -> player data
    
    // Server URL - change this to your server URL when deployed
    this.serverUrl = 'http://localhost:3001';
  }

  /*
    Connect to the game server
    */
  connect() {
    return new Promise((resolve, reject) => {
      // Set a connection timeout to prevent hanging
      const connectionTimeout = setTimeout(() => {
        console.error('Connection timeout - server not responding');
        reject(new Error('Connection timeout'));
      }, 10000); // 10 second timeout

      try {
        this.socket = io(this.serverUrl, {
          transports: ['websocket', 'polling'],
          timeout: 5000
        });

        this.socket.on('connect', () => {
          clearTimeout(connectionTimeout);
          console.log('Connected to server:', this.socket.id);
          this.isConnected = true;
          this.playerId = this.socket.id;
          this.setupEventListeners();
          resolve();
        });

        this.socket.on('connect_error', (error) => {
          clearTimeout(connectionTimeout);
          console.error('Connection failed:', error);
          this.isConnected = false;
          reject(error);
        });

        this.socket.on('disconnect', () => {
          console.log('Disconnected from server');
          this.isConnected = false;
          this.handleDisconnection();
        });

      } catch (error) {
        clearTimeout(connectionTimeout);
        console.error('Failed to create socket connection:', error);
        reject(error);
      }
    });
  }

  /*
    Set up all socket event listeners
    */
  setupEventListeners() {
    // Room management events
    this.socket.on('roomCreated', (data) => {
      console.log('Room created:', data);
      this.roomId = data.roomId;
      this.isHost = true;
      // Initialize players map for the host
      this.players = new Map(Object.entries(data.players || {}));
      this.scene.events.emit('roomCreated', data);
    });

    this.socket.on('roomJoined', (data) => {
      console.log('Joined room:', data);
      this.roomId = data.roomId;
      this.isHost = false;
      this.players = new Map(Object.entries(data.players));
      this.scene.events.emit('roomJoined', data);
    });

    this.socket.on('playerJoined', (data) => {
      console.log('Player joined:', data);
      this.players.set(data.playerId, data.playerData);
      this.scene.events.emit('playerJoined', data);
    });

    this.socket.on('playerLeft', (data) => {
      console.log('Player left:', data);
      this.players.delete(data.playerId);
      this.scene.events.emit('playerLeft', data);
    });

    // Game state events
    this.socket.on('gameStarted', (data) => {
      console.log('Game started:', data);
      this.scene.events.emit('gameStarted', data);
    });

    this.socket.on('playerUpdate', (data) => {
      // Handle remote player updates
      this.scene.events.emit('playerUpdate', data);
    });

    this.socket.on('gameObjectUpdate', (data) => {
      // Handle game object updates (coins, enemies, etc.)
      this.scene.events.emit('gameObjectUpdate', data);
    });

    // Error handling
    this.socket.on('error', (error) => {
      console.error('Socket error:', error);
      this.scene.events.emit('networkError', error);
    });

    this.socket.on('roomError', (error) => {
      console.error('Room error:', error);
      this.scene.events.emit('roomError', error);
    });
  }

  /*
    Create a new multiplayer room
    */
  createRoom(playerData) {
    if (!this.isConnected) {
      console.error('Not connected to server');
      return;
    }

    console.log('Creating room with player data:', playerData);
    this.socket.emit('createRoom', {
      playerData: playerData,
      maxPlayers: 4
    });
  }

  /*
    Join an existing room
    */
  joinRoom(roomId, playerData) {
    console.log('=== NetworkManager.joinRoom called ===');
    console.log('Is connected:', this.isConnected);
    console.log('Socket exists:', !!this.socket);
    console.log('Room ID:', roomId);
    console.log('Player data:', playerData);
    
    if (!this.isConnected) {
      console.error('Not connected to server');
      return;
    }

    if (!this.socket) {
      console.error('Socket not available');
      return;
    }

    console.log('Emitting joinRoom event to server...');
    this.socket.emit('joinRoom', {
      roomId: roomId,
      playerData: playerData
    });
    console.log('joinRoom event emitted successfully');
  }

  /*
    Get list of available rooms
    */
  getRoomList() {
    if (!this.isConnected) {
      console.error('Not connected to server');
      return Promise.resolve([]);
    }

    this.socket.emit('getRoomList');
    
    return new Promise((resolve, reject) => {
      // Set a timeout to prevent hanging
      const timeout = setTimeout(() => {
        console.warn('getRoomList timeout - no response from server');
        resolve([]); // Return empty array instead of hanging
      }, 5000); // 5 second timeout

      this.socket.once('roomList', (rooms) => {
        clearTimeout(timeout);
        console.log('Received room list:', rooms);
        resolve(rooms || []);
      });

      this.socket.once('error', (error) => {
        clearTimeout(timeout);
        console.error('Error getting room list:', error);
        resolve([]); // Return empty array on error
      });
    });
  }

  /*
    Start the game (host only)
    */
  startGame() {
    if (!this.isConnected || !this.isHost) {
      console.error('Cannot start game - not host or not connected');
      return;
    }

    this.socket.emit('startGame', {
      roomId: this.roomId
    });
  }

  /*
    Send player input to server
    */
  sendPlayerInput(inputData) {
    if (!this.isConnected) return;

    this.socket.emit('playerInput', {
      roomId: this.roomId,
      playerId: this.playerId,
      input: inputData,
      timestamp: Date.now()
    });
  }

  /*
    Send player position update
    */
  sendPlayerUpdate(playerData) {
    if (!this.isConnected) return;

    this.socket.emit('playerUpdate', {
      roomId: this.roomId,
      playerId: this.playerId,
      playerData: playerData,
      timestamp: Date.now()
    });
  }

  /*
    Send game object update (coins collected, blocks built, etc.)
    */
  sendGameObjectUpdate(objectData) {
    if (!this.isConnected) return;

    this.socket.emit('gameObjectUpdate', {
      roomId: this.roomId,
      playerId: this.playerId,
      objectData: objectData,
      timestamp: Date.now()
    });
  }

  /*
    Leave current room
    */
  leaveRoom() {
    if (!this.isConnected || !this.roomId) return;

    this.socket.emit('leaveRoom', {
      roomId: this.roomId,
      playerId: this.playerId
    });

    this.roomId = null;
    this.isHost = false;
    this.players.clear();
  }

  /*
    Handle disconnection from server
    */
  handleDisconnection() {
    this.isConnected = false;
    this.roomId = null;
    this.isHost = false;
    this.players.clear();
    
    // Notify the scene about disconnection
    this.scene.events.emit('networkDisconnected');
  }

  /*
    Disconnect from server
    */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
    this.handleDisconnection();
  }

  /*
    Get current room info
    */
  getRoomInfo() {
    return {
      roomId: this.roomId,
      isHost: this.isHost,
      playerId: this.playerId,
      playerCount: this.players.size,
      players: Array.from(this.players.values())
    };
  }

  /*
    Check if connected and in a room
    */
  isInRoom() {
    return this.isConnected && this.roomId !== null;
  }
}
