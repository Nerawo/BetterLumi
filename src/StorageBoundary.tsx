import { Component, type ReactNode } from "react";
export class StorageBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <main style={{ margin: 0, padding: 40 }}>
        <h1>BetterLumi</h1>
        <p>
          无法打开本地数据。请确认浏览器允许网站存储，再刷新页面。请勿清除网站数据，以免丢失未备份的记录。
        </p>
        <p>
          Unable to open local data. Allow browser storage and reload. Avoid
          clearing site data if you have unexported records.
        </p>
        <button className="primary" onClick={() => location.reload()}>
          刷新 / Reload
        </button>
      </main>
    ) : (
      this.props.children
    );
  }
}
