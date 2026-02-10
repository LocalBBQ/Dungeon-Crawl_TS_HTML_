// Centralized event name constants for the EventBus
// This keeps event usage consistent and avoids string-typing bugs.
const EventTypes = {
    // Input events
    INPUT_KEYDOWN: 'input:keydown',
    INPUT_KEYUP: 'input:keyup',
    INPUT_MOUSEDOWN: 'input:mousedown',
    INPUT_MOUSEUP: 'input:mouseup',
    INPUT_RIGHTCLICK: 'input:rightclick',
    INPUT_RIGHTCLICK_UP: 'input:rightclickup',

    // Combat / damage events
    DAMAGE_TAKEN: 'damage:taken'
};

// Expose globally for script-tag based usage
if (typeof window !== 'undefined') {
    window.EventTypes = EventTypes;
}

