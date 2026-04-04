/**
 * Simple Event Emitter for notification count updates
 * React Native compatible (no Node.js dependencies)
 */

type Listener = () => void;

class NotificationEventEmitter {
  private static instance: NotificationEventEmitter;
  private listeners: Set<Listener> = new Set();

  private constructor() {}

  static getInstance(): NotificationEventEmitter {
    if (!NotificationEventEmitter.instance) {
      NotificationEventEmitter.instance = new NotificationEventEmitter();
    }
    return NotificationEventEmitter.instance;
  }

  /**
   * Emit notification count update event
   */
  emitCountUpdate(): void {
    this.listeners.forEach(listener => {
      try {
        listener();
      } catch (error) {
        console.error('[NotificationEvents] Listener error:', error);
      }
    });
  }

  /**
   * Subscribe to notification count updates
   * @returns Unsubscribe function
   */
  onCountUpdate(callback: Listener): () => void {
    this.listeners.add(callback);
    return () => {
      this.listeners.delete(callback);
    };
  }
}

export const notificationEvents = NotificationEventEmitter.getInstance();
