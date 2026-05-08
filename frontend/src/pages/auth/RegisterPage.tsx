import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { useAuth } from '../../contexts/AuthContext'

export function RegisterPage() {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { register } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    setLoading(true)
    setError('')

    try {
      await register(formData.name, formData.email, formData.password)
      const from = location.state?.from?.pathname || '/'
      navigate(from, { replace: true })
    } catch (err: any) {
      setError(err.response?.data?.message || 'Registration failed')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value })
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        background: 'var(--bone)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div className="card" style={{ width: '100%', maxWidth: 440 }}>
        <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="row" style={{ gap: 10, alignItems: 'center' }}>
            <div className="brand-mark" />
            <div>
              <div
                style={{
                  fontFamily: 'Inter Tight',
                  fontSize: 18,
                  fontWeight: 600,
                  letterSpacing: '-0.02em',
                  color: 'var(--ink)',
                }}
              >
                Create your account
              </div>
              <div className="dim" style={{ fontSize: 12 }}>
                Get started with Nomation in about 30 seconds.
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="col" style={{ gap: 12 }}>
            {error && (
              <div
                className="row"
                style={{
                  gap: 8,
                  padding: '8px 10px',
                  background: 'var(--clay-soft)',
                  border: '1px solid var(--clay-edge)',
                  borderRadius: 6,
                  fontSize: 12,
                  color: 'var(--clay)',
                }}
                role="alert"
              >
                <AlertTriangle size={13} />
                <span>{error}</span>
              </div>
            )}

            <div className="field">
              <label htmlFor="name">Full Name</label>
              <input
                id="name"
                name="name"
                type="text"
                autoComplete="name"
                required
                value={formData.name}
                onChange={handleChange}
                placeholder="Jordan Mensah"
              />
            </div>

            <div className="field">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                required
                value={formData.email}
                onChange={handleChange}
                placeholder="you@company.com"
              />
            </div>

            <div className="field-row">
              <div className="field">
                <label htmlFor="password">Password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="••••••••"
                />
              </div>

              <div className="field">
                <label htmlFor="confirmPassword">Confirm</label>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="••••••••"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary"
              style={{
                width: '100%',
                justifyContent: 'center',
                opacity: loading ? 0.7 : 1,
              }}
            >
              {loading ? (
                <>
                  <Loader2 size={13} className="animate-spin" />
                  <span>Creating account…</span>
                </>
              ) : (
                <span>Create Account</span>
              )}
            </button>
          </form>

          <div
            style={{
              fontSize: 11.5,
              color: 'var(--ink-3)',
              textAlign: 'center',
              paddingTop: 6,
              borderTop: '1px solid var(--hair)',
            }}
          >
            Already have an account?{' '}
            <Link
              to="/login"
              style={{ color: 'var(--moss)', fontWeight: 600, textDecoration: 'none' }}
            >
              Sign in
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
