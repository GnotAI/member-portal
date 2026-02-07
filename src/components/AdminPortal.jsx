import React, { useState, useEffect } from 'react'
import { supabase } from '../supabaseClient'
import { Plus, Upload, User, FolderPlus, FileText, Database, Users } from 'lucide-react'

export default function AdminPortal({ session }) {
    const [clients, setClients] = useState([])
    const [projects, setProjects] = useState([])
    const [loading, setLoading] = useState(true)
    const [clientBalances, setClientBalances] = useState([])

    // Form States
    const [newProject, setNewProject] = useState({ title: '', description: '', clientId: '' })
    const [uploading, setUploading] = useState(false)
    const [selectedProject, setSelectedProject] = useState(null) // For adding invoice
    const [invoiceAmount, setInvoiceAmount] = useState('')
    const [invoiceFile, setInvoiceFile] = useState(null)

    const selectedProjectDetails = projects.find(p => p.id === selectedProject)

    useEffect(() => {
        fetchData()
    }, [])

    const fetchData = async () => {
        setLoading(true)
        // Fetch Clients
        const { data: clientsData } = await supabase.from('profiles').select('*').eq('role', 'client')
        setClients(clientsData || [])

        // Fetch Projects with Client info
        const { data: projectsData } = await supabase
            .from('projects')
            .select('*, profiles(full_name, email)')
            .order('created_at', { ascending: false })

        setProjects(projectsData || [])

        // Fetch Client Balances (RPC)
        const { data: balances, error } = await supabase.rpc('get_client_balances')
        if (error) console.log("Error fetching balances (did you run the new schema?):", error)
        else setClientBalances(balances || [])

        setLoading(false)
    }

    const createProject = async (e) => {
        e.preventDefault()
        if (!newProject.clientId) return alert('Select a client')

        const { error } = await supabase.from('projects').insert({
            title: newProject.title,
            description: newProject.description,
            client_id: newProject.clientId
        })

        if (error) alert(error.message)
        else {
            setNewProject({ title: '', description: '', clientId: '' })
            fetchData()
        }
    }

    // Seed Data Helper
    const seedData = async () => {
        if (!confirm("This will create dummy projects and invoices for ALL current clients. Continue?")) return
        setLoading(true)
        try {
            // Create a dummy project for each client
            for (const client of clients) {
                const { data: proj } = await supabase.from('projects').insert({
                    title: `Website Redesign (${new Date().toLocaleDateString()})`,
                    description: 'Complete overhaul of the corporate website.',
                    client_id: client.id,
                    status: 'active'
                }).select().single()

                if (proj) {
                    await supabase.from('invoices').insert([
                        { project_id: proj.id, amount: 1500, status: 'paid' },
                        { project_id: proj.id, amount: 2500, status: 'unpaid' }
                    ])
                }
            }
            alert("Dummy data created!")
            fetchData()
        } catch (e) {
            alert(e.message)
        }
        setLoading(false)
    }

    const handleFileUpload = async (e) => {
        e.preventDefault()
        if (!invoiceFile || !selectedProject || !invoiceAmount) return

        setUploading(true)
        try {
            const fileExt = invoiceFile.name.split('.').pop()
            const fileName = `${Math.random()}.${fileExt}`
            const filePath = `${selectedProject}/${fileName}`

            // Upload to Storage
            const { error: uploadError } = await supabase.storage
                .from('invoices')
                .upload(filePath, invoiceFile)

            if (uploadError) throw uploadError

            // Get Signed URL (valid for 1 hour for display, but ideally we store path)
            // For this demo, we'll store the Path and let the client generate signed URL, 
            // OR generate a long-lived public URL if bucket is public. 
            // User wanted "Secure", so private bucket + signed URL.
            // We will store the filePath in the database.

            // But wait, the Dashboard needs to know it's a path.
            // I'll store the full path.

            const { error: dbError } = await supabase.from('invoices').insert({
                project_id: selectedProject,
                amount: parseFloat(invoiceAmount),
                pdf_url: filePath, // Storing path!
                status: 'unpaid'
            })

            if (dbError) throw dbError

            alert('Invoice Uploaded!')
            setSelectedProject(null)
            setInvoiceAmount('')
            setInvoiceFile(null)
        } catch (error) {
            alert('Error: ' + error.message)
        } finally {
            setUploading(false)
        }
    }

    return (
        <div>
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2>Admin Portal</h2>
                    <p className="text-muted">Manage clients, projects, and invoices.</p>
                </div>
                <button className="btn btn-outline" onClick={seedData}>
                    <Database size={16} /> Seed Dummy Data
                </button>
            </div>

            {/* Client Balances Section (NEW) */}
            <div className="glass-panel card" style={{ marginBottom: '2rem' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Users size={20} className="text-secondary" /> Client Balances (SQL Aggregation)
                </h3>
                <div style={{ overflowX: 'auto' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '1rem' }}>
                        <thead>
                            <tr style={{ textAlign: 'left', borderBottom: '1px solid var(--border-glass)' }}>
                                <th style={{ padding: '0.5rem' }}>Client</th>
                                <th style={{ padding: '0.5rem' }}>Email</th>
                                <th style={{ padding: '0.5rem', textAlign: 'right' }}>Total Outstanding</th>
                            </tr>
                        </thead>
                        <tbody>
                            {clientBalances.map(client => (
                                <tr key={client.client_id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                    <td style={{ padding: '0.5rem' }}>{client.full_name || 'N/A'}</td>
                                    <td style={{ padding: '0.5rem', opacity: 0.7 }}>{client.email}</td>
                                    <td style={{ padding: '0.5rem', textAlign: 'right', fontWeight: 'bold', color: client.total_outstanding > 0 ? 'var(--warning)' : 'var(--success)' }}>
                                        ${client.total_outstanding.toLocaleString()}
                                    </td>
                                </tr>
                            ))}
                            {clientBalances.length === 0 && (
                                <tr>
                                    <td colSpan={3} style={{ padding: '1rem', textAlign: 'center', opacity: 0.5 }}>No invoices found</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '2rem' }}>
                {/* LEFT COLUMN: ACTIONS */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                    {/* CREATE PROJECT FORM */}
                    <div className="glass-panel card">
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                            <FolderPlus size={20} className="text-secondary" /> New Project
                        </h3>
                        {clients.length === 0 && <p className="text-muted" style={{ fontSize: '0.8rem' }}>No clients found. Users must sign up first.</p>}
                        <form onSubmit={createProject}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ fontSize: '0.85rem', marginBottom: '0.25rem', display: 'block' }}>Client</label>
                                <select
                                    className="input-field"
                                    value={newProject.clientId}
                                    onChange={e => setNewProject({ ...newProject, clientId: e.target.value })}
                                    required
                                >
                                    <option value="">Select Client...</option>
                                    {clients.map(c => <option key={c.id} value={c.id}>{c.full_name || c.email}</option>)}
                                </select>
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <input
                                    className="input-field"
                                    placeholder="Project Title"
                                    value={newProject.title}
                                    onChange={e => setNewProject({ ...newProject, title: e.target.value })}
                                    required
                                />
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <textarea
                                    className="input-field"
                                    placeholder="Description"
                                    rows={3}
                                    value={newProject.description}
                                    onChange={e => setNewProject({ ...newProject, description: e.target.value })}
                                />
                            </div>
                            <button className="btn btn-primary" type="submit" style={{ width: '100%' }}>Create Project</button>
                        </form>
                    </div>

                    {/* UPLOAD INVOICE FORM (Conditional) */}
                    <div className="glass-panel card" style={{ opacity: selectedProject ? 1 : 0.5, pointerEvents: selectedProject ? 'all' : 'none', transition: 'opacity 0.2s' }}>
                        <h3 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                            <Upload size={20} className="text-secondary" /> Upload Invoice
                        </h3>
                        {selectedProject ? (
                            <div style={{ marginBottom: '1rem', padding: '0.5rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: '0.5rem', border: '1px solid rgba(16, 185, 129, 0.2)' }}>
                                <span style={{ fontSize: '0.8rem', color: 'var(--success)', display: 'block', fontWeight: 'bold' }}>SELECTED PROJECT:</span>
                                <span>{selectedProjectDetails?.title}</span>
                            </div>
                        ) : (
                            <div style={{ marginBottom: '1rem', padding: '0.5rem', background: 'rgba(255, 255, 255, 0.05)', borderRadius: '0.5rem', border: '1px dashed var(--border-color)' }}>
                                <p className="text-muted" style={{ fontSize: '0.85rem', margin: 0 }}>
                                    Select a project from the list on the right →
                                </p>
                            </div>
                        )}

                        <form onSubmit={handleFileUpload}>
                            <div style={{ marginBottom: '1rem' }}>
                                <input
                                    type="number"
                                    className="input-field"
                                    placeholder="Amount ($)"
                                    value={invoiceAmount}
                                    onChange={e => setInvoiceAmount(e.target.value)}
                                    step="0.01"
                                    required />
                            </div>
                            <div style={{ marginBottom: '1rem' }}>
                                <input
                                    type="file"
                                    accept=".pdf"
                                    onChange={e => setInvoiceFile(e.target.files[0])}
                                    required
                                    style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}
                                />
                            </div>
                            <button className="btn btn-primary" type="submit" style={{ width: '100%' }} disabled={uploading}>
                                {uploading ? 'Uploading...' : 'Upload Invoice'}
                            </button>
                        </form>
                    </div>

                </div>

                {/* RIGHT COLUMN: LIST */}
                <div className="glass-panel card">
                    <h3 style={{ marginBottom: '1.5rem' }}>Active Projects</h3>
                    {loading ? <p>Loading...</p> : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            {projects.map(p => (
                                <div
                                    key={p.id}
                                    onClick={() => setSelectedProject(p.id)}
                                    style={{
                                        padding: '1rem',
                                        borderRadius: '0.5rem',
                                        background: selectedProject === p.id ? 'var(--bg-secondary)' : 'rgba(0,0,0,0.2)',
                                        border: selectedProject === p.id ? '1px solid var(--accent-primary)' : '1px solid transparent',
                                        cursor: 'pointer',
                                        transition: 'all 0.2s'
                                    }}
                                >
                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                        <span style={{ fontWeight: '600' }}>{p.title}</span>
                                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{p.profiles?.email}</span>
                                    </div>
                                    <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0.5rem 0' }}>{p.description}</p>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
