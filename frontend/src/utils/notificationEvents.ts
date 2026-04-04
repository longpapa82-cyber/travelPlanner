import { EventEmitter } from 'events';

class NotificationEventEmitter extends EventEmitter {
  private static instance: NotificationEventEmitter;

  private constructor() {
    super();
  }

  static getInstance(): NotificationEventEmitter {
    if (!NotificationEventEmitter.instance) {
      NotificationEventEmitter.instance = new NotificationEventEmitter();
    }
    return NotificationEventEmitter.instance;
  }

  emitCountUpdate() {
    this.emit('countUpdate');
  }

  onCountUpdate(callback: () => void) {
    this.on('countUpdate', callback);
    return () => {
      this.off('countUpdate', callback);
    };
  }
}

export const notificationEvents = NotificationEventEmitter.getInstance();