import React, { useEffect, useState } from 'react'
import { supabase } from '../supabaseClient'
import { Plus, X, Loader2, FileText, Calendar, ChevronRight, Download, DollarSign, Trash2, Edit2 } from 'lucide-react'

export default function Dashboard({ session }) {
    const [projects, setProjects] = useState([])
    const [loading, setLoading] = useState(true)
    const [isCreating, setIsCreating] = useState(false)
    const [creating, setCreating] = useState(false)
    const [newProject, setNewProject] = useState({ title: '', description: '' })
    const [isEditingProfile, setIsEditingProfile] = useState(false)
    const [userProfile, setUserProfile] = useState({ full_name: '', company_name: '' })
    const [updatingProfile, setUpdatingProfile] = useState(false)
    const [totalDue, setTotalDue] = useState(0)
    const [isEditingProject, setIsEditingProject] = useState(false)
    const [editingProject, setEditingProject] = useState({ id: '', title: '', description: '' })
    const [updatingProject, setUpdatingProject] = useState(false)

    // Fetch function extracted for reuse
    const fetchProjects = async () => {
        setLoading(true)
        // 1. Fetch projects
        const { data: projectsData, error } = await supabase
            .from('projects')
            .select('*')
            .order('created_at', { ascending: false })

        if (error) console.error('Error fetching projects:', error)
        else {
            // 2. For each project, fetch invoices and sign URLs
            const projectsWithInvoices = await Promise.all(projectsData.map(async (p) => {
                const { data: invoices } = await supabase
                    .from('invoices')
                    .select('*')
                    .eq('project_id', p.id)
                    .order('created_at', { ascending: false })

                // Generate Signed URLs for invoices
                const invoicesWithUrls = await Promise.all((invoices || []).map(async (inv) => {
                    if (inv.pdf_url && !inv.pdf_url.startsWith('http')) {
                        const { data, error } = await supabase.storage
                            .from('invoices')
                            .createSignedUrl(inv.pdf_url, 3600) // Valid for 1 hour

                        if (data) return { ...inv, pdf_url: data.signedUrl }
                    }
                    return inv
                }))

                return { ...p, invoices: invoicesWithUrls }
            }))

            // Calculate Total Outstanding
            const total = projectsWithInvoices.reduce((acc, project) => {
                const projectUnpaid = project.invoices
                    .filter(inv => inv.status === 'unpaid')
                    .reduce((sum, inv) => sum + inv.amount, 0)
                return acc + projectUnpaid
            }, 0)

            setTotalDue(total)
            setProjects(projectsWithInvoices)
        }
        setLoading(false)
    }

    const fetchUserProfile = async () => {
        const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single()
        if (data) setUserProfile({ full_name: data.full_name || '', company_name: data.company_name || '' })
    }

    useEffect(() => {
        if (session) {
            fetchProjects()
            fetchUserProfile()
        }
    }, [session])

    const handleCreateProject = async (e) => {
        e.preventDefault()
        setCreating(true)

        const { error } = await supabase.from('projects').insert({
            title: newProject.title,
            description: newProject.description,
            client_id: session.user.id // Explicitly set client_id to self
        })

        if (error) {
            alert(error.message)
        } else {
            setNewProject({ title: '', description: '' })
            setIsCreating(false)
            fetchProjects()
        }
        setCreating(false)
    }

    const handleDeleteProject = async (projectId) => {
        if (!confirm('Are you sure you want to delete this project? This will also delete all associated invoices.')) return

        const { error } = await supabase.from('projects').delete().eq('id', projectId)
        if (error) {
            alert(error.message)
        } else {
            fetchProjects()
        }
    }

    const handleUpdateProject = async (e) => {
        e.preventDefault()
        setUpdatingProject(true)
        const { error } = await supabase.from('projects')
            .update({
                title: editingProject.title,
                description: editingProject.description
            })
            .eq('id', editingProject.id)

        if (error) {
            alert(error.message)
        } else {
            setIsEditingProject(false)
            fetchProjects()
        }
        setUpdatingProject(false)
    }

    const updateStatus = async (projectId, currentStatus) => {
        const newStatus = currentStatus === 'active' ? 'completed' : 'active'
        // Optimistic update
        setProjects(projects.map(p => p.id === projectId ? { ...p, status: newStatus } : p))

        const { error } = await supabase.from('projects').update({ status: newStatus }).eq('id', projectId)
        if (error) {
            console.error('Error updating status:', error)
            fetchProjects() // Revert on error
        }
    }

    const handleUpdateProfile = async (e) => {
        e.preventDefault()
        setUpdatingProfile(true)
        const { error } = await supabase.from('profiles').update(userProfile).eq('id', session.user.id)
        if (error) alert(error.message)
        else {
            setIsEditingProfile(false)
            alert('Profile updated!')
        }
        setUpdatingProfile(false)
    }

    if (loading) return <div className="text-muted">Loading projects...</div>

    return (
        <div>
            <div style={{ marginBottom: '2rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                    <h2>My Projects</h2>
                    <p className="text-muted">Track your project milestones and invoices.</p>
                </div>
                <button className="btn btn-outline" onClick={() => setIsEditingProfile(true)}>
                    Edit Profile
                </button>
            </div>

            {/* Summary Card */}
            {totalDue > 0 && (
                <div className="glass-panel" style={{
                    marginBottom: '2rem',
                    padding: '1.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '1.5rem',
                    background: 'linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.05))',
                    border: '1px solid rgba(245, 158, 11, 0.2)'
                }}>
                    <div style={{
                        width: '50px', height: '50px', borderRadius: '50%',
                        background: 'rgba(245, 158, 11, 0.2)', color: 'var(--warning)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}>
                        <DollarSign size={24} />
                    </div>
                    <div>
                        <span style={{ display: 'block', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>Total Outstanding Balance</span>
                        <span style={{ fontSize: '1.8rem', fontWeight: '700', color: 'white' }}>${totalDue.toLocaleString()}</span>
                    </div>
                </div>
            )}

            {projects.length === 0 ? (
                <div className="glass-panel" style={{ padding: '3rem', textAlign: 'center' }}>
                    <p className="text-muted">No projects found. Create one to get started!</p>
                    <button className="btn btn-primary" onClick={() => setIsCreating(true)} style={{ marginTop: '1rem' }}>
                        <Plus size={18} /> Create Project
                    </button>
                </div>
            ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: '1.5rem' }}>

                    {/* Create New Project Card */}
                    <div
                        className="glass-panel card"
                        style={{
                            display: 'flex',
                            flexDirection: 'column',
                            justifyContent: 'center',
                            alignItems: 'center',
                            minHeight: '200px',
                            cursor: 'pointer',
                            borderStyle: 'dashed',
                            color: 'var(--text-secondary)'
                        }}
                        onClick={() => setIsCreating(true)}
                    >
                        <Plus size={48} style={{ opacity: 0.5, marginBottom: '1rem' }} />
                        <span style={{ fontWeight: '500' }}>Create New Project</span>
                    </div>

                    {projects.map((project) => (
                        <div key={project.id} className="glass-panel card" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                <div>
                                    <h3 style={{ fontSize: '1.25rem', marginBottom: '0.25rem' }}>{project.title}</h3>
                                    <button
                                        onClick={() => updateStatus(project.id, project.status)}
                                        style={{
                                            border: 'none', cursor: 'pointer',
                                            fontSize: '0.75rem', padding: '0.25rem 0.6rem', borderRadius: '1rem',
                                            background: project.status === 'active' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(148, 163, 184, 0.2)',
                                            color: project.status === 'active' ? 'var(--success)' : 'var(--text-secondary)',
                                            textTransform: 'uppercase', fontWeight: '600',
                                            transition: 'all 0.2s'
                                        }}
                                        title="Click to toggle status"
                                    >
                                        {project.status}
                                    </button>
                                </div>
                                <div style={{ display: 'flex', gap: '0.25rem' }}>
                                    <button
                                        onClick={() => {
                                            setEditingProject({ id: project.id, title: project.title, description: project.description })
                                            setIsEditingProject(true)
                                        }}
                                        style={{
                                            background: 'none', border: 'none', color: 'var(--text-secondary)',
                                            cursor: 'pointer', padding: '0.5rem', opacity: 0.6,
                                            transition: 'all 0.2s'
                                        }}
                                        className="hover-opacity-100"
                                        title="Edit Project"
                                    >
                                        <Edit2 size={18} />
                                    </button>
                                    <button
                                        onClick={() => handleDeleteProject(project.id)}
                                        style={{
                                            background: 'none', border: 'none', color: 'var(--danger)',
                                            cursor: 'pointer', padding: '0.5rem', opacity: 0.6,
                                            transition: 'all 0.2s'
                                        }}
                                        className="hover-opacity-100"
                                        title="Delete Project"
                                    >
                                        <Trash2 size={18} />
                                    </button>
                                </div>
                            </div>

                            <p className="text-muted" style={{ fontSize: '0.9rem', flex: 1 }}>{project.description}</p>

                            <div style={{ borderTop: '1px solid var(--border-glass)', paddingTop: '1rem', marginTop: '0.5rem' }}>
                                <h4 style={{ fontSize: '0.9rem', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                    <FileText size={16} /> Invoices
                                </h4>

                                {project.invoices.length > 0 ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {project.invoices.map(inv => (
                                            <div key={inv.id} style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                fontSize: '0.85rem',
                                                background: 'rgba(0,0,0,0.2)',
                                                padding: '0.5rem',
                                                borderRadius: '0.375rem'
                                            }}>
                                                <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                    <span style={{ fontWeight: '500' }}>${inv.amount.toLocaleString()}</span>
                                                    <span style={{ fontSize: '0.7rem', color: inv.status === 'paid' ? 'var(--success)' : 'var(--warning)' }}>
                                                        {inv.status.toUpperCase()}
                                                    </span>
                                                </div>
                                                {inv.pdf_url ? (
                                                    <a
                                                        href={inv.pdf_url}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="btn btn-outline"
                                                        style={{ padding: '0.25rem 0.5rem', height: 'auto', fontSize: '0.75rem' }}
                                                    >
                                                        <Download size={14} /> PDF
                                                    </a>
                                                ) : (
                                                    <span className="text-muted" style={{ fontSize: '0.7rem' }}>Processing</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <span className="text-muted" style={{ fontSize: '0.8rem' }}>No invoices yet</span>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Create Project Modal */}
            {isCreating && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    zIndex: 1000
                }}>
                    <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0 }}>Create New Project</h3>
                            <button onClick={() => setIsCreating(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleCreateProject}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Project Title</label>
                                <input
                                    className="input-field"
                                    value={newProject.title}
                                    onChange={e => setNewProject({ ...newProject, title: e.target.value })}
                                    placeholder="e.g. Q4 Marketing Campaign"
                                    required
                                />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Description</label>
                                <textarea
                                    className="input-field"
                                    rows={4}
                                    value={newProject.description}
                                    onChange={e => setNewProject({ ...newProject, description: e.target.value })}
                                    placeholder="Brief details about the project..."
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button type="button" className="btn btn-outline" onClick={() => setIsCreating(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={creating}>
                                    {creating ? <Loader2 className="animate-spin" size={18} /> : 'Create Project'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Profile Modal */}
            {isEditingProfile && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    zIndex: 1000
                }}>
                    <div className="glass-panel" style={{ width: '100%', maxWidth: '400px', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0 }}>Edit Profile</h3>
                            <button onClick={() => setIsEditingProfile(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateProfile}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Full Name</label>
                                <input className="input-field" value={userProfile.full_name} onChange={e => setUserProfile({ ...userProfile, full_name: e.target.value })} placeholder="John Doe" />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Company Name</label>
                                <input className="input-field" value={userProfile.company_name} onChange={e => setUserProfile({ ...userProfile, company_name: e.target.value })} placeholder="Acme Inc." />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button type="button" className="btn btn-outline" onClick={() => setIsEditingProfile(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={updatingProfile}>
                                    {updatingProfile ? <Loader2 className="animate-spin" size={18} /> : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Edit Project Modal */}
            {isEditingProject && (
                <div style={{
                    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
                    background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(5px)',
                    display: 'flex', justifyContent: 'center', alignItems: 'center',
                    zIndex: 1000
                }}>
                    <div className="glass-panel" style={{ width: '100%', maxWidth: '500px', padding: '2rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
                            <h3 style={{ margin: 0 }}>Edit Project</h3>
                            <button onClick={() => setIsEditingProject(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}>
                                <X size={24} />
                            </button>
                        </div>
                        <form onSubmit={handleUpdateProject}>
                            <div style={{ marginBottom: '1rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Project Title</label>
                                <input
                                    className="input-field"
                                    value={editingProject.title}
                                    onChange={e => setEditingProject({ ...editingProject, title: e.target.value })}
                                    required
                                />
                            </div>
                            <div style={{ marginBottom: '1.5rem' }}>
                                <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.9rem' }}>Description</label>
                                <textarea
                                    className="input-field"
                                    rows={4}
                                    value={editingProject.description}
                                    onChange={e => setEditingProject({ ...editingProject, description: e.target.value })}
                                />
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '1rem' }}>
                                <button type="button" className="btn btn-outline" onClick={() => setIsEditingProject(false)}>Cancel</button>
                                <button type="submit" className="btn btn-primary" disabled={updatingProject}>
                                    {updatingProject ? <Loader2 className="animate-spin" size={18} /> : 'Save Changes'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    )
}
