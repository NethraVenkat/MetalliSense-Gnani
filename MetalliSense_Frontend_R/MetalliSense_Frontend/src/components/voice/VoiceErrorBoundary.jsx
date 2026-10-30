import { Component } from 'react';

// Isolate voice rendering/lifecycle failures from the surrounding operator page.
export default class VoiceErrorBoundary extends Component {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  render() {
    if (this.state.failed) {
      return (
        <div role="status" className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-slate-800">
          Voice is unavailable. You can continue using the screen.
        </div>
      );
    }
    return this.props.children;
  }
}
