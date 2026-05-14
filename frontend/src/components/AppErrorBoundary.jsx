import { Component } from 'react';

export default class AppErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error) {
    return {
      hasError: true,
      message: error?.message || 'Đã xảy ra lỗi ngoài dự kiến',
    };
  }

  componentDidCatch(error) {
    // Giữ log để debug khi cần, tránh app trắng toàn bộ.
    // eslint-disable-next-line no-console
    console.error('AppErrorBoundary:', error);
  }

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div style={s.wrap}>
          <div style={s.card}>
            <div style={s.icon}>⚠️</div>
            <div style={s.title}>Ứng dụng gặp lỗi tạm thời</div>
            <div style={s.sub}>
              {this.state.message}
            </div>
            <button className="btn-primary" onClick={this.handleReload}>Tải lại trang</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const s = {
  wrap: {
    minHeight: '100vh',
    background: 'var(--bg0)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  card: {
    width: '100%',
    maxWidth: 460,
    background: 'var(--bg1)',
    border: '1px solid var(--border2)',
    borderRadius: 14,
    padding: '24px 20px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    textAlign: 'center',
  },
  icon: { fontSize: 34 },
  title: { fontSize: 17, fontWeight: 700, color: 'var(--text1)' },
  sub: { fontSize: 12, color: 'var(--text2)', marginBottom: 10 },
};
