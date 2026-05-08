// src/pages/auth/ProfilePage.jsx
// v2.40 — Modern borderless design
import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@/context/AuthContext"
import { API_BASE } from "@/config/aws"
import { Footer } from "@/components/layout/Footer"

const PW_RULES = [
  { label: "At least 8 characters",  test: p => p.length >= 8 },
  { label: "One uppercase letter",   test: p => /[A-Z]/.test(p) },
  { label: "One number",             test: p => /\d/.test(p) },
  { label: "One special character",  test: p => /[!@#$%^&*(),.?":{}|<>]/.test(p) },
]

function SaveButton({ loading, saved, label = "Save changes" }) {
  return (
    <button type="submit" disabled={loading}
      className={`w-full sm:w-auto px-6 py-2.5 font-black text-xs uppercase tracking-widest rounded-xl transition-all flex items-center justify-center gap-2 ${saved ? "bg-green-500/20 border border-green-500/30 text-green-400" : "bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-slate-950"}`}>
      {loading ? <><div className="w-3.5 h-3.5 border-2 border-current/20 border-t-current rounded-full animate-spin"/>Saving...</> : saved ? <><i className="fa-solid fa-check text-xs"/>Saved</> : label}
    </button>
  )
}

export function ProfilePage() {
  const { user, token, signOut, updateProfile, changePassword } = useAuth()
  const navigate = useNavigate()

  const [name,          setName]          = useState(user?.name || "")
  const [nameLoading,   setNameLoading]   = useState(false)
  const [nameSaved,     setNameSaved]     = useState(false)
  const [nameError,     setNameError]     = useState("")
  const [oldPw,         setOldPw]         = useState("")
  const [newPw,         setNewPw]         = useState("")
  const [confirmPw,     setConfirmPw]     = useState("")
  const [showOld,       setShowOld]       = useState(false)
  const [showNew,       setShowNew]       = useState(false)
  const [pwLoading,     setPwLoading]     = useState(false)
  const [pwSaved,       setPwSaved]       = useState(false)
  const [pwError,       setPwError]       = useState("")
  const [pwFocused,     setPwFocused]     = useState(false)
  const [deleteModal,   setDeleteModal]   = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState("")
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError,   setDeleteError]   = useState("")
  const [deleteSuccess, setDeleteSuccess] = useState(false)

  const passedRules  = PW_RULES.filter(r => r.test(newPw)).length
  const isGoogleUser = user?.provider === "Google"
  const isPro        = user?.tier === "pro" || user?.tier === "premium"

  async function handleSaveName(e) {
    e.preventDefault()
    if (!name.trim()) { setNameError("Name cannot be empty."); return }
    setNameError(""); setNameLoading(true)
    try { await updateProfile({ name: name.trim() }); setNameSaved(true); setTimeout(() => setNameSaved(false), 3000) }
    catch (err) { setNameError(err?.message || "Failed to update name.") }
    finally { setNameLoading(false) }
  }

  async function handleChangePassword(e) {
    e.preventDefault()
    if (passedRules < PW_RULES.length) { setPwError("New password doesn't meet all requirements."); return }
    if (newPw !== confirmPw) { setPwError("Passwords do not match."); return }
    setPwError(""); setPwLoading(true)
    try {
      await changePassword(oldPw, newPw)
      setPwSaved(true); setOldPw(""); setNewPw(""); setConfirmPw("")
      setTimeout(() => setPwSaved(false), 3000)
    } catch (err) {
      const code = err?.code || err?.__type || ""
      if (code === "NotAuthorizedException") setPwError("Current password is incorrect.")
      else if (code === "InvalidPasswordException") setPwError("New password doesn't meet Cognito requirements.")
      else setPwError(err?.message || "Failed to change password.")
    } finally { setPwLoading(false) }
  }

  async function handleSignOut() { await signOut(); navigate("/") }

  async function confirmDelete() {
    if (deleteConfirm !== "DELETE") return
    setDeleteLoading(true)
    try {
      const res = await fetch(`${API_BASE}/user/${user?.sub}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
      if (!res.ok) throw new Error("Delete failed")
      setDeleteModal(false); setDeleteSuccess(true)
      setTimeout(async () => { await signOut(); navigate("/") }, 3000)
    } catch {
      setDeleteError("Could not delete account. Contact operations@airdate.tv.")
      setDeleteLoading(false); setDeleteModal(false)
    }
  }

  return (
    <div className="bg-slate-950 min-h-screen text-slate-100">
      {deleteSuccess && (
        <div className="fixed inset-0 bg-slate-950 flex flex-col items-center justify-center z-[100] p-6 text-center">
          <div className="w-24 h-24 bg-green-500/10 border border-green-500/20 rounded-full flex items-center justify-center mb-8">
            <i className="fa-solid fa-check text-green-400 text-4xl"/>
          </div>
          <h2 className="text-4xl font-black text-white mb-4">Account Deleted</h2>
          <p className="text-slate-400 text-sm max-w-sm leading-relaxed mb-3">Your account, watchlist, and all personal data have been permanently removed.</p>
          <p className="text-slate-600 text-xs uppercase tracking-widest">Redirecting you home...</p>
        </div>
      )}
      <div className="w-full max-w-2xl mx-auto px-4 sm:px-6 pt-24 sm:pt-28 pb-24">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-12">
          <div>
            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">My Account</h1>
            <p className="text-slate-500 text-sm mt-1">{user?.email}</p>
          </div>
          <span className={`self-start sm:self-auto px-3 py-1.5 rounded-xl text-xs font-black uppercase tracking-widest ${isPro ? "bg-amber-500/10 text-amber-400" : "bg-slate-800 text-slate-400"}`}>
            {isPro ? "★ Pro" : "Free Plan"}
          </span>
        </div>
        <div className="space-y-12">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Profile</p>
            <h2 className="text-lg font-black text-white mb-6">Your Identity</h2>
            <div className="flex items-center gap-4 mb-6">
              {user?.picture
                ? <img src={user.picture} alt={user.name} className="w-16 h-16 rounded-2xl object-cover flex-shrink-0"/>
                : <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-600/20 border border-cyan-500/20 flex items-center justify-center flex-shrink-0">
                    <span className="text-2xl font-black text-cyan-400">{(user?.name || user?.email || "?")[0].toUpperCase()}</span>
                  </div>
              }
              <div>
                <p className="text-white font-bold text-sm">{user?.name}</p>
                <p className="text-slate-500 text-xs mt-0.5">{user?.email}</p>
              </div>
            </div>
            <form onSubmit={handleSaveName} className="space-y-4">
              <div>
                <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Display name</label>
                <input type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Your name"
                  className="w-full px-4 py-3 bg-slate-800/40 border border-white/5 focus:border-cyan-500/40 focus:ring-2 focus:ring-cyan-500/10 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none transition-all"/>
              </div>
              {nameError && <p className="text-red-400 text-xs font-bold">{nameError}</p>}
              <div className="flex justify-end"><SaveButton loading={nameLoading} saved={nameSaved}/></div>
            </form>
          </div>
          <div className="h-px bg-white/5"/>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Subscription</p>
            <h2 className="text-lg font-black text-white mb-6">Your Plan</h2>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-slate-800/30 rounded-2xl">
              <div className="flex items-center gap-4">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${isPro ? "bg-amber-500/10" : "bg-slate-700/50"}`}>
                  <i className={`fa-solid fa-bolt text-sm ${isPro ? "text-amber-400" : "text-slate-500"}`}/>
                </div>
                <div>
                  <p className="text-white font-bold text-sm">{isPro ? "AirDate Pro" : "AirDate Free"}</p>
                  <p className="text-slate-500 text-xs mt-0.5">{isPro ? "Unlimited tracking · Early alerts · Full Scoop access" : "Track up to 5 shows · Upgrade for unlimited access"}</p>
                </div>
              </div>
              {!isPro && (
                <button onClick={() => navigate("/upgrade")}
                  className="w-full sm:w-auto flex-shrink-0 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-black text-xs uppercase tracking-widest rounded-xl transition-all">
                  Upgrade →
                </button>
              )}
            </div>
          </div>
          <div className="h-px bg-white/5"/>
          {!isGoogleUser ? (
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Security</p>
              <h2 className="text-lg font-black text-white mb-6">Change Password</h2>
              <form onSubmit={handleChangePassword} className="space-y-4" noValidate>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Current password</label>
                  <div className="relative">
                    <input type={showOld ? "text" : "password"} value={oldPw} onChange={e => setOldPw(e.target.value)} placeholder="Your current password" autoComplete="current-password"
                      className="w-full px-4 py-3 pr-11 bg-slate-800/40 border border-white/5 focus:border-cyan-500/40 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none transition-all"/>
                    <button type="button" onClick={() => setShowOld(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-300">
                      <i className={`fa-solid ${showOld ? "fa-eye-slash" : "fa-eye"} text-sm`}/>
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">New password</label>
                  <div className="relative">
                    <input type={showNew ? "text" : "password"} value={newPw} onChange={e => setNewPw(e.target.value)} onFocus={() => setPwFocused(true)} placeholder="Create new password" autoComplete="new-password"
                      className="w-full px-4 py-3 pr-11 bg-slate-800/40 border border-white/5 focus:border-cyan-500/40 rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none transition-all"/>
                    <button type="button" onClick={() => setShowNew(v => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-300">
                      <i className={`fa-solid ${showNew ? "fa-eye-slash" : "fa-eye"} text-sm`}/>
                    </button>
                  </div>
                  {(pwFocused || newPw) && (
                    <div className="mt-3 grid grid-cols-2 gap-1.5">
                      {PW_RULES.map((rule, i) => (
                        <div key={i} className="flex items-center gap-2">
                          <i className={`fa-solid text-[9px] ${rule.test(newPw) ? "fa-check text-cyan-400" : "fa-circle text-slate-700"}`}/>
                          <span className={`text-[10px] font-bold ${rule.test(newPw) ? "text-slate-300" : "text-slate-600"}`}>{rule.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">Confirm new password</label>
                  <input type="password" value={confirmPw} onChange={e => setConfirmPw(e.target.value)} placeholder="Repeat new password" autoComplete="new-password"
                    className={`w-full px-4 py-3 bg-slate-800/40 border rounded-xl text-white text-sm placeholder-slate-600 focus:outline-none transition-all ${confirmPw && newPw !== confirmPw ? "border-red-500/40" : "border-white/5 focus:border-cyan-500/40"}`}/>
                  {confirmPw && newPw !== confirmPw && <p className="text-red-400 text-[10px] font-bold mt-1">Passwords don't match</p>}
                </div>
                {pwError && <p className="text-red-400 text-xs font-bold">{pwError}</p>}
                <div className="flex justify-end"><SaveButton loading={pwLoading} saved={pwSaved} label="Update password"/></div>
              </form>
            </div>
          ) : (
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Security</p>
              <h2 className="text-lg font-black text-white mb-6">Password</h2>
              <div className="flex items-center gap-3 text-slate-500 text-sm p-5 bg-slate-800/30 rounded-2xl">
                <i className="fa-brands fa-google flex-shrink-0"/>Managed through your Google account.
              </div>
            </div>
          )}
          <div className="h-px bg-white/5"/>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500 mb-1">Session</p>
            <h2 className="text-lg font-black text-white mb-6">Sign Out</h2>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <p className="text-slate-500 text-sm">Sign out from AirDate on this device.</p>
              <button onClick={handleSignOut} className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-800/60 hover:bg-slate-700/60 text-slate-300 hover:text-white font-black text-xs uppercase tracking-widest rounded-xl transition-all">
                <i className="fa-solid fa-right-from-bracket"/> Sign Out
              </button>
            </div>
          </div>
          <div className="h-px bg-white/5"/>
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-red-500/60 mb-1">Danger Zone</p>
            <h2 className="text-lg font-black text-white mb-6">Delete Account</h2>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 bg-red-500/5 rounded-2xl border border-red-500/10">
              <p className="text-slate-500 text-sm">Permanently removes your account, watchlist, and all personal data. Cannot be undone.</p>
              <button onClick={() => { setDeleteModal(true); setDeleteConfirm(""); setDeleteError("") }}
                className="w-full sm:w-auto flex items-center justify-center gap-2 px-5 py-2.5 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 text-red-400 font-black text-xs uppercase tracking-widest rounded-xl transition-all flex-shrink-0">
                <i className="fa-solid fa-trash"/> Delete Account
              </button>
            </div>
          </div>
        </div>
      </div>
      <Footer/>
      {deleteModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={e => e.target === e.currentTarget && setDeleteModal(false)}>
          <div className="bg-slate-900 rounded-3xl p-6 sm:p-8 w-full max-w-md shadow-2xl">
            <div className="w-14 h-14 bg-red-500/10 rounded-2xl mx-auto mb-5 flex items-center justify-center">
              <i className="fa-solid fa-trash text-red-400 text-xl"/>
            </div>
            <h3 className="text-white font-black text-xl text-center mb-2">Delete Your Account?</h3>
            <p className="text-slate-400 text-sm text-center mb-6 leading-relaxed">This permanently removes everything. <span className="text-red-400 font-bold">Cannot be undone.</span></p>
            <ul className="space-y-2 mb-6 p-4 bg-slate-800/40 rounded-2xl">
              {["Your watchlist will be permanently deleted","Preferences and history removed","Active Pro subscription cancelled","You will be signed out immediately"].map(item => (
                <li key={item} className="flex items-center gap-3 text-sm text-slate-300"><i className="fa-solid fa-xmark text-red-500/60 w-4 flex-shrink-0"/>{item}</li>
              ))}
            </ul>
            <div className="mb-6">
              <label className="block text-slate-500 text-xs font-bold uppercase tracking-widest mb-2">Type <span className="text-red-400">DELETE</span> to confirm</label>
              <input type="text" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="DELETE"
                className="w-full bg-slate-800/60 border border-white/5 focus:border-red-500/40 rounded-xl px-4 py-3 text-white text-sm font-bold placeholder-slate-600 focus:outline-none transition-colors"/>
            </div>
            {deleteError && <p className="text-red-400 text-xs font-bold mb-4 text-center">{deleteError}</p>}
            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={() => setDeleteModal(false)} className="flex-1 h-11 bg-slate-800/60 rounded-xl text-slate-300 text-xs font-bold uppercase tracking-widest hover:text-white transition-all">Cancel</button>
              <button onClick={confirmDelete} disabled={deleteConfirm !== "DELETE" || deleteLoading}
                className="flex-1 h-11 bg-red-500/15 border border-red-500/25 rounded-xl text-red-400 text-xs font-bold uppercase tracking-widest hover:bg-red-500/25 transition-all flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed">
                {deleteLoading ? <i className="fa-solid fa-spinner fa-spin"/> : <><i className="fa-solid fa-trash"/>Delete Forever</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
