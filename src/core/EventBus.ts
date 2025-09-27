import Phaser from 'phaser';

class EventBus extends Phaser.Events.EventEmitter {}

export const bus = new EventBus();

export default bus;
