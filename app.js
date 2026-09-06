/* =========================================================
   MYA E-Commerce Partner — Supabase Auth + CRUD
   Fill in your Supabase project details below before use.
   ========================================================= */
const SUPABASE_URL = "https://whqamwwfyaoqhpudavyb.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Pze6i6PtPJH56Nd27SVETg_7m74bAPC";

if (SUPABASE_URL.includes("YOUR_SUPABASE_URL") || SUPABASE_ANON_KEY.includes("YOUR_SUPABASE_ANON_KEY")) {
  document.addEventListener("DOMContentLoaded", () => {
    const banner = document.createElement("div");
    banner.style.cssText = "position:fixed;top:0;left:0;right:0;background:#dc2626;color:#fff;padding:12px 18px;font:600 13px Inter,Arial;z-index:9999;text-align:center";
    banner.textContent = "⚠ Supabase not configured yet — open app.js and set SUPABASE_URL / SUPABASE_ANON_KEY.";
    document.body.prepend(banner);
  });
}

const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const $ = id => document.getElementById(id);
const todayISO = () => new Date().toISOString().slice(0, 10);
const cap = s => (s ? s[0].toUpperCase() + s.slice(1) : "");
function esc(v){return String(v??"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[m]))}
function initials(name){return String(name||"MY").split(" ").map(x=>x[0]).slice(0,2).join("").toUpperCase()}
function emptyRow(n,msg){return `<tr><td colspan="${n}" class="empty">${msg}</td></tr>`}
function msgBox(el,text,ok){el.innerHTML=`<div class="auth-msg ${ok?"ok":"err"}">${esc(text)}</div>`}

let currentUser = null;               // active profile row
let db = { profiles: [], tasks: [], attendance: [] };

$("today").textContent = new Date().toLocaleDateString(undefined,{day:"2-digit",month:"short",year:"numeric"});
$("attendanceDate").value = todayISO();

/* ================= AUTH PAGE SWITCHING ================= */
const AUTH_PAGES = ["loginPage","signupPage","forgotPage","resetPage","pendingPage"];
function hideAllAuthPages(){ AUTH_PAGES.forEach(id=>$(id).classList.add("hidden")); }
function showAuth(which){
  hideAllAuthPages();
  const map={login:"loginPage",signup:"signupPage",forgot:"forgotPage",reset:"resetPage",pending:"pendingPage"};
  $(map[which]).classList.remove("hidden");
}
window.showAuth = showAuth;

/* ================= PASSWORD RECOVERY LINK ================= */
if (window.location.hash.includes("type=recovery")) {
  hideAllAuthPages();
  $("resetPage").classList.remove("hidden");
}

/* ================= SIGN UP ================= */
$("signupForm").onsubmit = async (e) => {
  e.preventDefault();
  const name = $("signupName").value.trim();
  const email = $("signupEmail").value.trim();
  const password = $("signupPassword").value;
  $("signupBtn").disabled = true;
  const { error } = await supabase.auth.signUp({ email, password, options: { data: { name } } });
  $("signupBtn").disabled = false;
  if (error) { msgBox($("signupMsg"), error.message, false); return; }
  msgBox($("signupMsg"), "Account created! Sign in now — your account will need Owner/Manager approval before you get full access, or check your inbox if email confirmation is required.", true);
  e.target.reset();
};

/* ================= LOGIN ================= */
$("loginForm").onsubmit = async (e) => {
  e.preventDefault();
  const email = $("loginEmail").value.trim();
  const password = $("loginPassword").value;
  $("loginBtn").disabled = true;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  $("loginBtn").disabled = false;
  if (error) { msgBox($("loginMsg"), error.message, false); return; }
  await afterLogin();
};

/* ================= FORGOT PASSWORD ================= */
$("forgotForm").onsubmit = async (e) => {
  e.preventDefault();
  const email = $("forgotEmail").value.trim();
  $("forgotBtn").disabled = true;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname });
  $("forgotBtn").disabled = false;
  if (error) { msgBox($("forgotMsg"), error.message, false); return; }
  msgBox($("forgotMsg"), "If an account exists for this email, a reset link has been sent.", true);
  e.target.reset();
};

/* ================= RESET PASSWORD (from email link) ================= */
$("resetForm").onsubmit = async (e) => {
  e.preventDefault();
  const password = $("resetPassword").value;
  $("resetBtn").disabled = true;
  const { error } = await supabase.auth.updateUser({ password });
  $("resetBtn").disabled = false;
  if (error) { msgBox($("resetMsg"), error.message, false); return; }
  msgBox($("resetMsg"), "Password updated! Redirecting to sign in...", true);
  setTimeout(() => { window.location.hash = ""; showAuth("login"); }, 1600);
};

function sendMyResetEmail(){
  supabase.auth.resetPasswordForEmail(currentUser.email, { redirectTo: window.location.origin + window.location.pathname })
    .then(({ error }) => alert(error ? error.message : "Reset link sent to your email."));
}
window.sendMyResetEmail = sendMyResetEmail;

$("pendingLogout").onclick = async () => { await supabase.auth.signOut(); hideAllAuthPages(); showAuth("login"); };
$("logout").onclick = async () => { await supabase.auth.signOut(); location.reload(); };

/* ================= SESSION BOOTSTRAP ================= */
async function afterLogin(){
  const { data:{ user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: profile, error } = await supabase.from("profiles").select("*").eq("id", user.id).single();
  if (error || !profile) { msgBox($("loginMsg"), "Could not load your profile. Contact the Owner.", false); return; }
  currentUser = profile;
  if (profile.status !== "active") { hideAllAuthPages(); showAuth("pending"); return; }
  hideAllAuthPages();
  $("app").classList.remove("hidden");
  applyRole();
  await loadAll();
}

(async function initSession(){
  if (window.location.hash.includes("type=recovery")) return;
  const { data:{ session } } = await supabase.auth.getSession();
  if (session) await afterLogin();
})();

/* ================= ROLE-BASED UI ================= */
function applyRole(){
  const role = currentUser.role;
  $("sideName").textContent = currentUser.name; $("topName").textContent = currentUser.name;
  $("sideRole").textContent = cap(role); $("topRole").textContent = cap(role);
  $("sideAvatar").textContent = initials(currentUser.name); $("topAvatar").textContent = initials(currentUser.name);
  $("settingsRole").value = cap(role);
  document.querySelectorAll(".owner-only,.owner-only-section").forEach(x => x.style.display = role === "owner" ? "" : "none");
  document.querySelectorAll(".owner-manager-only").forEach(x => x.style.display = (role === "owner" || role === "manager") ? "" : "none");
  if (role === "worker") {
    ["workers","attendance","reports","access"].forEach(s => { const el = document.querySelector(`[data-section="${s}"]`); if (el) el.style.display = "none"; });
  }
}

document.querySelectorAll(".nav").forEach(b => b.onclick = () => showSection(b.dataset.section));
function showSection(id){
  document.querySelectorAll(".nav").forEach(x => x.classList.toggle("active", x.dataset.section === id));
  document.querySelectorAll(".section").forEach(s => s.classList.toggle("hidden", s.id !== id));
  const names = {dashboard:"Dashboard",workers:"Workers",attendance:"Attendance",tasks:"Daily Tasks",reports:"Reports",access:"Team Access",settings:"Settings"};
  $("pageTitle").textContent = names[id] || "Dashboard";
  $("pageSubtitle").textContent = id === "dashboard" ? "Welcome back! Here's what's happening with your team today." : `Manage ${names[id] || "your portal"} from one place.`;
}
window.showSection = showSection;

$("attendanceDate").onchange = renderAttendance;
$("workerSearch").oninput = renderWorkers;
$("taskSearch").oninput = renderTasks;
$("globalSearch").oninput = e => {
  const q = e.target.value.toLowerCase();
  if (!q) return;
  const hit = db.profiles.find(w => (w.name||"").toLowerCase().includes(q)) || db.tasks.find(t => (t.title||"").toLowerCase().includes(q));
  if (hit) showSection(hit.title ? "tasks" : "workers");
};

/* ================= DATA LOADING ================= */
async function loadAll(){
  const [{ data: profiles, error: pErr }, { data: tasks, error: tErr }, { data: attendance, error: aErr }] = await Promise.all([
    supabase.from("profiles").select("*").order("created_at", { ascending: true }),
    supabase.from("tasks").select("*").order("created_at", { ascending: false }),
    supabase.from("attendance").select("*")
  ]);
  if (pErr) console.error(pErr); if (tErr) console.error(tErr); if (aErr) console.error(aErr);
  db.profiles = profiles || [];
  db.tasks = tasks || [];
  db.attendance = attendance || [];
  renderAll();
}
function renderAll(){ renderWorkers(); renderAttendance(); renderTasks(); renderDashboard(); renderReports(); renderAccounts(); }
function workerName(id){ return db.profiles.find(p => p.id === id)?.name || "Unassigned"; }

/* ================= WORKERS ================= */
function renderWorkers(){
  const q = ($("workerSearch")?.value || "").toLowerCase();
  const rows = db.profiles.filter(p => p.role === "worker").filter(w => `${w.name} ${w.phone||""} ${w.department||""}`.toLowerCase().includes(q));
  $("workerCount").textContent = `${rows.length} workers`;
  $("workerTable").innerHTML = rows.map(w => `<tr>
  <td><div class="person"><div class="avatar sm">${initials(w.name)}</div><div><b>${esc(w.name)}</b><span>${esc(w.email||"")}</span></div></div></td>
  <td>${esc(w.phone||"—")}</td><td>${esc(w.department||"—")}</td><td>${w.joining_date||"—"}</td>
  <td><span class="badge ${w.status}">${cap(w.status)}</span></td>
  <td class="actions"><button onclick="editWorkerById('${w.id}')">✎</button>
  <button onclick="toggleWorkerStatus('${w.id}','${w.status==='active'?'inactive':'active'}')">${w.status==='active'?'⏸':'▶'}</button></td></tr>`).join("") || emptyRow(6,"No workers found");
  $("miniWorkers").innerHTML = rows.slice(0,5).map(w => `<div class="mini-person"><div class="avatar sm">${initials(w.name)}</div><div><b>${esc(w.name)}</b><span>${esc(w.department||"")}</span></div><span class="badge ${w.status}">${cap(w.status)}</span></div>`).join("") || "<div class='empty'>No workers added.</div>";
}
function openWorkerModal(w=null){
  if (!w) {
    const link = window.location.origin + window.location.pathname + "#signup";
    $("modalContent").innerHTML = `<h2>Invite a Worker</h2><p class="modal-sub">New team members create their own login from the Sign Up page. Share this link, then approve their account from <b>Team Access</b>.</p>
    <div class="input-wrap" style="margin-bottom:16px"><input id="inviteLink" readonly value="${esc(link)}"></div>
    <button type="button" class="primary full" onclick="copyInviteLink()">Copy Signup Link</button>`;
    $("modal").classList.remove("hidden"); return;
  }
  $("modalContent").innerHTML = `<h2>Edit Worker</h2><p class="modal-sub">Update worker information.</p>
  <form onsubmit="submitWorker(event,'${w.id}')"><div class="form-grid">
  <div><label>Worker Name</label><input id="wn" value="${esc(w.name||"")}" required></div>
  <div><label>Phone</label><input id="wp" value="${esc(w.phone||"")}"></div>
  <div><label>Department</label><input id="wr" value="${esc(w.department||"")}" placeholder="e.g. Product Listing"></div>
  <div><label>Status</label><select id="ws"><option value="active" ${w.status==="active"?"selected":""}>Active</option><option value="inactive" ${w.status==="inactive"?"selected":""}>Inactive</option><option value="pending" ${w.status==="pending"?"selected":""}>Pending</option></select></div>
  </div><button class="primary full">Save Worker</button></form>`;
  $("modal").classList.remove("hidden");
}
window.openWorkerModal = openWorkerModal;
function editWorkerById(id){ openWorkerModal(db.profiles.find(p => p.id === id)); }
window.editWorkerById = editWorkerById;
function copyInviteLink(){ const el=$("inviteLink"); el.select(); document.execCommand("copy"); alert("Signup link copied!"); }
window.copyInviteLink = copyInviteLink;
async function submitWorker(e,id){
  e.preventDefault();
  const { error } = await supabase.from("profiles").update({ name:$("wn").value, phone:$("wp").value, department:$("wr").value, status:$("ws").value }).eq("id", id);
  if (error) { alert(error.message); return; }
  closeModal(); await loadAll();
}
window.submitWorker = submitWorker;
async function toggleWorkerStatus(id,newStatus){
  if (!confirm(`Set status to ${newStatus}?`)) return;
  const { error } = await supabase.from("profiles").update({ status:newStatus }).eq("id", id);
  if (error) { alert(error.message); return; }
  await loadAll();
}
window.toggleWorkerStatus = toggleWorkerStatus;

/* ================= ATTENDANCE ================= */
function renderAttendance(){
  const d = $("attendanceDate").value || todayISO();
  const workers = db.profiles.filter(p => p.role === "worker" && p.status === "active");
  const a = db.attendance.filter(x => x.date === d);
  $("attPresent").textContent = a.filter(x => x.status==="Present").length;
  $("attLate").textContent = a.filter(x => x.status==="Late").length;
  $("attAbsent").textContent = a.filter(x => x.status==="Absent").length;
  $("attLeave").textContent = a.filter(x => x.status==="Leave").length;
  $("attendanceTable").innerHTML = workers.map(w => {
    const x = a.find(y => y.worker_id === w.id), status = x?.status || "Not Marked";
    return `<tr><td><div class="person"><div class="avatar sm">${initials(w.name)}</div><div><b>${esc(w.name)}</b><span>${esc(w.department||"")}</span></div></div></td>
    <td><span class="badge ${status.toLowerCase().replace(" ","")}">${status}</span></td><td>${x?.time||"—"}</td>
    <td><select onchange="markAttendance('${w.id}',this.value)"><option value="">Select status</option><option>Present</option><option>Absent</option><option>Late</option><option>Leave</option></select></td></tr>`;
  }).join("") || emptyRow(4,"No workers added");
}
async function markAttendance(id,status){
  if (!status) return;
  const d = $("attendanceDate").value || todayISO();
  const time = (status === "Absent" || status === "Leave") ? null : new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"});
  const { error } = await supabase.from("attendance").upsert({ worker_id:id, date:d, status, time, marked_by:currentUser.id }, { onConflict:"worker_id,date" });
  if (error) { alert(error.message); return; }
  await loadAll();
}
window.markAttendance = markAttendance;

/* ================= TASKS ================= */
function taskRows(){
  const q = ($("taskSearch")?.value || "").toLowerCase();
  return db.tasks.filter(t => `${t.title} ${workerName(t.worker_id)} ${t.status}`.toLowerCase().includes(q));
}
function renderTasks(){
  const rows = taskRows();
  const canManage = currentUser.role === "owner" || currentUser.role === "manager";
  $("taskTable").innerHTML = rows.map(t => `<tr>
  <td><div class="task-title"><b>${esc(t.title)}</b><span>#${t.id}</span></div></td><td>${esc(workerName(t.worker_id))}</td><td>${t.deadline||"—"}</td>
  <td><span class="priority ${t.priority.toLowerCase()}">${t.priority}</span></td>
  <td><div class="progress-label"><span>${t.progress}%</span></div><div class="progress"><i style="width:${Math.max(0,Math.min(100,t.progress))}%"></i></div></td>
  <td><span class="badge ${t.status==="Completed"?"completed":t.status==="In Progress"?"inprogress":"pending"}">${t.status}</span></td>
  <td class="actions"><button onclick="editTaskById(${t.id})">✎</button>${canManage?`<button onclick="deleteTask(${t.id})">⌫</button>`:""}</td></tr>`).join("") || emptyRow(7,"No tasks found");
  $("taskTotal").textContent = db.tasks.length; $("taskDone").textContent = db.tasks.filter(x=>x.status==="Completed").length;
  $("taskDoing").textContent = db.tasks.filter(x=>x.status==="In Progress").length; $("taskPending").textContent = db.tasks.filter(x=>x.status==="Pending").length;
}
function openTaskModal(t=null){
  const workers = db.profiles.filter(p => p.role === "worker" && p.status === "active");
  $("modalContent").innerHTML = `<h2>${t?"Edit":"Assign"} Task</h2><p class="modal-sub">Set the task, deadline and progress.</p><form onsubmit="submitTask(event,${t?t.id:"null"})"><div class="form-grid">
  <div class="full-field"><label>Task Title</label><input id="tt" value="${esc(t?.title||"")}" placeholder="e.g. Upload 50 product listings" required></div>
  <div><label>Assign Worker</label><select id="tw">${workers.map(w=>`<option value="${w.id}" ${t?.worker_id===w.id?"selected":""}>${esc(w.name)}</option>`).join("")}</select></div>
  <div><label>Deadline</label><input id="td" type="date" value="${t?.deadline||todayISO()}" required></div>
  <div><label>Priority</label><select id="tp"><option ${t?.priority==="Low"?"selected":""}>Low</option><option ${t?.priority==="Medium"||!t?"selected":""}>Medium</option><option ${t?.priority==="High"?"selected":""}>High</option></select></div>
  <div><label>Progress %</label><input id="tprog" type="number" min="0" max="100" value="${t?.progress??0}"></div>
  <div><label>Status</label><select id="ts"><option ${t?.status==="Pending"||!t?"selected":""}>Pending</option><option ${t?.status==="In Progress"?"selected":""}>In Progress</option><option ${t?.status==="Completed"?"selected":""}>Completed</option></select></div>
  </div><button class="primary full">Save Task</button></form>`;
  $("modal").classList.remove("hidden");
}
window.openTaskModal = openTaskModal;
function editTaskById(id){ openTaskModal(db.tasks.find(x => x.id === id)); }
window.editTaskById = editTaskById;
async function submitTask(e,id){
  e.preventDefault();
  const data = { title:$("tt").value, worker_id:$("tw").value, deadline:$("td").value, priority:$("tp").value, progress:Number($("tprog").value), status:$("ts").value };
  let error;
  if (id) ({ error } = await supabase.from("tasks").update(data).eq("id", id));
  else ({ error } = await supabase.from("tasks").insert({ ...data, created_by: currentUser.id }));
  if (error) { alert(error.message); return; }
  closeModal(); await loadAll();
}
window.submitTask = submitTask;
async function deleteTask(id){
  if (!confirm("Delete this task?")) return;
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) { alert(error.message); return; }
  await loadAll();
}
window.deleteTask = deleteTask;

/* ================= DASHBOARD & REPORTS ================= */
function renderDashboard(){
  const d = todayISO();
  const workers = db.profiles.filter(p => p.role === "worker");
  const a = db.attendance.filter(x => x.date === d);
  const t = db.tasks.filter(x => x.deadline === d);
  $("totalWorkers").textContent = workers.length;
  $("presentToday").textContent = a.filter(x => x.status==="Present"||x.status==="Late").length;
  $("absentToday").textContent = a.filter(x => x.status==="Absent").length;
  $("tasksToday").textContent = t.length;
  const done=t.filter(x=>x.status==="Completed").length, doing=t.filter(x=>x.status==="In Progress").length, pending=t.filter(x=>x.status==="Pending").length;
  $("completedToday").textContent = done; $("progressToday").textContent = doing; $("pendingToday").textContent = pending;
  const pct = t.length ? Math.round(done/t.length*100) : 0;
  $("taskPercent").textContent = pct + "%";
  $("donutEl").style.background = `conic-gradient(var(--primary) ${pct*3.6}deg,#232324 0deg)`;
  $("dashboardTasks").innerHTML = t.map(x => `<div class="task-item"><div><b>${esc(x.title)}</b><span>${esc(workerName(x.worker_id))} · ${x.deadline}</span></div><div><strong>${x.progress}%</strong><span class="badge ${x.status==="Completed"?"completed":x.status==="In Progress"?"inprogress":"pending"}">${x.status}</span></div></div>`).join("") || "<div class='empty'>No tasks scheduled for today.</div>";
}
function renderReports(){
  $("allTasks").textContent = db.tasks.length;
  $("allCompleted").textContent = db.tasks.filter(x=>x.status==="Completed").length;
  $("avgProgress").textContent = (db.tasks.length ? Math.round(db.tasks.reduce((s,x)=>s+x.progress,0)/db.tasks.length) : 0) + "%";
  $("reportTable").innerHTML = db.profiles.filter(w=>w.role==="worker").map(w => {
    const t = db.tasks.filter(x => x.worker_id === w.id);
    const avg = t.length ? Math.round(t.reduce((s,x)=>s+x.progress,0)/t.length) : 0;
    return `<tr><td><div class="person"><div class="avatar sm">${initials(w.name)}</div><div><b>${esc(w.name)}</b><span>${esc(w.department||"")}</span></div></div></td><td>${t.length}</td><td>${t.filter(x=>x.status==="Completed").length}</td><td><div class="report-progress"><div class="progress"><i style="width:${avg}%"></i></div><b>${avg}%</b></div></td><td><span class="performance ${avg>=80?"high":avg>=50?"medium":"low"}">${avg>=80?"Excellent":avg>=50?"Good":"Needs attention"}</span></td></tr>`;
  }).join("") || emptyRow(5,"No performance data");
}

/* ================= TEAM ACCESS ================= */
function renderAccounts(){
  $("accountTable").innerHTML = db.profiles.map(a => `<tr>
  <td><div class="person"><div class="avatar sm">${initials(a.name)}</div><div><b>${esc(a.name)}</b></div></div></td>
  <td>${esc(a.email||"")}</td>
  <td>${a.role==="owner" ? `<span class="role-pill">Owner</span>` : `<select onchange="changeRole('${a.id}',this.value)"><option value="worker" ${a.role==="worker"?"selected":""}>Worker</option><option value="manager" ${a.role==="manager"?"selected":""}>Manager</option></select>`}</td>
  <td><span class="badge ${a.status}">${cap(a.status)}</span></td>
  <td class="actions">
   ${a.role!=="owner" ? (a.status==="pending" ? `<button onclick="approveAccount('${a.id}')">✓</button>` : `<button onclick="toggleWorkerStatus('${a.id}','${a.status==='active'?'inactive':'active'}')">${a.status==='active'?'⏸':'▶'}</button>`) : ""}
   <button onclick="resetPasswordFor('${esc(a.email)}')">✉</button>
  </td></tr>`).join("");
}
async function approveAccount(id){
  const { error } = await supabase.from("profiles").update({ status:"active" }).eq("id", id);
  if (error) { alert(error.message); return; }
  await loadAll();
}
window.approveAccount = approveAccount;
async function changeRole(id,role){
  const { error } = await supabase.from("profiles").update({ role }).eq("id", id);
  if (error) { alert(error.message); return; }
  await loadAll();
}
window.changeRole = changeRole;
function resetPasswordFor(email){
  supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + window.location.pathname })
    .then(({ error }) => alert(error ? error.message : "Password reset email sent."));
}
window.resetPasswordFor = resetPasswordFor;

/* ================= MODAL / MISC ================= */
function closeModal(){ $("modal").classList.add("hidden"); }
window.closeModal = closeModal;
$("modal").onclick = e => { if (e.target.id === "modal") closeModal(); };

function exportData(){
  const blob = new Blob([JSON.stringify(db,null,2)],{type:"application/json"});
  const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "mya-backup.json"; a.click(); URL.revokeObjectURL(a.href);
}
window.exportData = exportData;
