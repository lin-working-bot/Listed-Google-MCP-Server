export default function NotFound() {
  return (
    <div style={{
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      background: 'linear-gradient(to right, #00d2ff, #3a7bd5)',
    }}>
      <div style={{
        textAlign: 'center',
        color: 'white',
        maxWidth: '600px',
        padding: '2rem',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        borderRadius: '1rem',
        backdropFilter: 'blur(10px)',
        boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)',
      }}>
        <h1 style={{ fontSize: '2.5rem', marginBottom: '1rem' }}>404 - 页面未找到</h1>
        <p style={{ fontSize: '1.2rem', marginBottom: '2rem' }}>
          抱歉，您请求的页面不存在。
        </p>
        <a href="/" style={{
          display: 'inline-block',
          padding: '0.75rem 1.5rem',
          backgroundColor: 'white',
          color: '#3a7bd5',
          borderRadius: '0.5rem',
          textDecoration: 'none',
          fontWeight: 'bold',
          transition: 'all 0.2s ease',
        }}>
          返回首页
        </a>
      </div>
    </div>
  );
}
