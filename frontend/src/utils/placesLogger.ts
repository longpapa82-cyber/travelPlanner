/**
 * Places Selection Logger for Debugging
 *
 * Tracks the flow of location selection to identify where data is lost
 */

interface PlacesEvent {
  timestamp: Date;
  component: string;
  action: string;
  data: {
    value?: string;
    placeId?: string;
    description?: string;
    [key: string]: any;
  };
}

class PlacesLogger {
  private events: PlacesEvent[] = [];
  private sessionId: string;

  constructor() {
    this.sessionId = Date.now().toString(36);
  }

  log(component: string, action: string, data: any) {
    const event: PlacesEvent = {
      timestamp: new Date(),
      component,
      action,
      data,
    };

    console.log(
      `[PlacesLogger:${component}] ${action}`,
      JSON.stringify(data, null, 2)
    );

    this.events.push(event);

    // Keep only last 50 events
    if (this.events.length > 50) {
      this.events.shift();
    }
  }

  // Log the complete flow for a selection
  logSelectionFlow() {
    console.log('=== PLACES SELECTION FLOW ===');
    console.log(`Session: ${this.sessionId}`);

    const selectionEvents = this.events.filter(e =>
      e.action.includes('select') ||
      e.action.includes('change') ||
      e.action.includes('update')
    );

    selectionEvents.forEach((event, index) => {
      console.log(`Step ${index + 1}: [${event.component}] ${event.action}`);
      console.log('  Data:', event.data);
      console.log('  Time:', event.timestamp.toISOString());
    });

    console.log('=== END FLOW ===');
  }

  // Check for data loss
  detectDataLoss(): string[] {
    const issues: string[] = [];

    // Check if onChangeText was called after handleSelect
    const selectIndex = this.events.findIndex(e => e.action === 'handleSelect');
    const changeIndex = this.events.findIndex(e => e.action === 'onChangeText');

    if (selectIndex > -1 && changeIndex > -1) {
      if (changeIndex < selectIndex) {
        issues.push('onChangeText called BEFORE handleSelect (should be after)');
      }

      // Check if values match
      const selectData = this.events[selectIndex].data;
      const changeData = this.events[changeIndex].data;

      if (selectData.description !== changeData.value) {
        issues.push(`Value mismatch: select="${selectData.description}" vs change="${changeData.value}"`);
      }
    }

    // Check for missing callbacks
    if (selectIndex > -1 && changeIndex === -1) {
      issues.push('handleSelect called but onChangeText never triggered');
    }

    return issues;
  }

  clear() {
    this.events = [];
  }

  export(): PlacesEvent[] {
    return [...this.events];
  }
}

export const placesLogger = new PlacesLogger();

// Helper functions
export const logPlaceSearch = (query: string, resultsCount: number) => {
  placesLogger.log('PlacesAutocomplete', 'search', { query, resultsCount });
};

export const logPlaceSelect = (place: any) => {
  placesLogger.log('PlacesAutocomplete', 'handleSelect', {
    placeId: place.place_id,
    description: place.description,
    types: place.types,
  });
};

export const logPlaceChange = (value: string, source: string) => {
  placesLogger.log(source, 'onChangeText', { value });
};

export const logPlaceUpdate = (field: string, value: any, component: string) => {
  placesLogger.log(component, 'updateField', { field, value });
};