import { Component } from 'react';

// The top bar's dropdowns must keep working even if websockets are not
// configured (Echo throws when its Reverb settings are missing), so a failure
// in their live updates is contained here rather than taking down every page
// that uses the layout.
export default class LiveUpdatesBoundary extends Component {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    render() {
        return this.state.failed ? null : this.props.children;
    }
}
