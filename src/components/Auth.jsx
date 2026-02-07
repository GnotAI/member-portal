import React, { useState } from 'react'
import { supabase } from '../supabaseClient'
import { Mail, Lock, Loader2, ArrowRight } from 'lucide-react'

export default function Auth() {
    const [loading, setLoading] = useState(false)
    const [email, setEmail] = useState('')
    const [password, setPassword] = useState('')
    const [isSignUp, setIsSignUp] = useState(false)
    const [message, setMessage] = useState(null)

    const handleAuth = async (e) => {
        e.preventDefault()
        setLoading(true)
        setMessage(null)

        try {
            if (isSignUp) {
                const { data, error } = await supabase.auth.signUp({
                    email,
                    password,
                })
                if (error) throw error
                setMessage({ type: 'success', text: 'Check your email for the confirmation link!' })
            } else {
                const { data, error } = await supabase.auth.signInWithPassword({
                    email,
                    password,
                })
                if (error) throw error
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.message })
        } finally {
            setLoading(false)
        }
    }

    return (
        <div className="flex-center" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '80vh' }}>
            <div className="glass-panel animate-fade-in" style={{ width: '100%', maxWidth: '400px', padding: '2.5rem' }}>
                <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                    <h1 style={{ fontSize: '1.8rem', marginBottom: '0.5rem' }}>
                        {isSignUp ? 'Create Account' : 'Welcome Back'}
                    </h1>
                    <p className="text-muted">
                        {isSignUp ? 'Join the portal to view your projects' : 'Sign in to access your dashboard'}
                    </p>
                </div>

                {message && (
                    <div style={{
                        padding: '1rem',
                        borderRadius: '0.5rem',
                        background: message.type === 'error' ? 'rgba(239, 68, 68, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                        color: message.type === 'error' ? 'var(--danger)' : 'var(--success)',
                        marginBottom: '1.5rem',
                        border: `1px solid ${message.type === 'error' ? 'var(--danger)' : 'var(--success)'}`
                    }}>
                        {message.text}
                    </div>
                )}

                <form onSubmit={handleAuth}>
                    <div style={{ marginBottom: '1.25rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Email</label>
                        <div style={{ position: 'relative' }}>
                            <Mail size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <input
                                className="input-field"
                                type="email"
                                placeholder="you@example.com"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                style={{ paddingLeft: '2.8rem' }}
                                required
                            />
                        </div>
                    </div>

                    <div style={{ marginBottom: '1.5rem' }}>
                        <label style={{ display: 'block', marginBottom: '0.5rem', fontWeight: '500' }}>Password</label>
                        <div style={{ position: 'relative' }}>
                            <Lock size={18} style={{ position: 'absolute', left: '1rem', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
                            <input
                                className="input-field"
                                type="password"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                style={{ paddingLeft: '2.8rem' }}
                                required
                            />
                        </div>
                    </div>

                    <button className="btn btn-primary" style={{ width: '100%' }} disabled={loading}>
                        {loading ? <Loader2 className="animate-spin" /> : <>{isSignUp ? 'Sign Up' : 'Sign In'} <ArrowRight size={18} /></>}
                    </button>
                </form>

                <div style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.9rem' }}>
                    <span className="text-muted">{isSignUp ? 'Already have an account?' : "Don't have an account?"}</span>
                    <button
                        type="button"
                        onClick={() => { setIsSignUp(!isSignUp); setMessage(null); }}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--accent-primary)',
                            fontWeight: '600',
                            cursor: 'pointer',
                            marginLeft: '0.5rem'
                        }}
                    >
                        {isSignUp ? 'Sign In' : 'Sign Up'}
                    </button>
                </div>
            </div>
        </div>
    )
}
