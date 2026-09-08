/* MYA E-Commerce Partner — Supabase-ready frontend
   1) Put your Supabase URL + anon/publishable key below.
   2) Run supabase.sql in Supabase SQL Editor.
   3) Deploy the create-user Edge Function if you want Owner/Manager to create login accounts.
*/
const SUPABASE_URL = "https://whqamwwfyaoqhpudavyb.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndocWFtd3dmeWFvcWhwdWRhdnliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODg2MzcxMjQsImV4cCI6MjEwNDIxMzEyNH0._NHN-k6Kg-jnnzn5HSIzxtSZLjONDeRMkioPMZDPU0s";

const isConfigured = SUPABASE_URL.startsWith("https://") && !SUPABASE_URL.includes("YOUR_") && !SUPABASE_ANON_KEY.includes("YOUR_");
const sb = window.supabase;
const client = isConfigured ? sb.createClient(SUPABASE_URL, SUPABASE_ANON_KEY) : null;

let currentUser = null, currentProfile = null;
let workers = [], attendance = [], tasks = [];
let selectedPage = "dashboard";

const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"']/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m]));
const initials = n => (String(n||"U").trim().split(/\s+/).map(x=>x[0]).join("").slice(0,2)||"U").toUpperCase();
const today = () => new Date().toISOString().slice(0,10);
const fmtDate = d => d ? new Date(d+"T00:00:00").toLocaleDateString(undefined,{day:"2-digit",month:"short",year:"numeric"}) : "—";
const canManage = () => ["owner","manager"].includes(currentProfile?.role);
const isOwner = () => currentProfile?.role === "owner";

function toast(msg, type="ok"){const t=$("toast");t.textContent=msg;t.className="toast show "+type;setTimeout(()=>t.className="toast",2800)}
function closeModal(){ $("modalRoot").innerHTML=""; }
function modal(title, body){$("modalRoot").innerHTML=`<div class="modal-backdrop" id="backdrop"><div class="modal"><div class="modal-head"><h3>${title}</h3><button class="close" onclick="closeModal()">✕</button></div>${body}</div></div>`}
function setPage(page){
  selectedPage=page;
  document.querySelectorAll(".page").forEach(x=>x.classList.add("hidden"));
  $("page-"+page).classList.remove("hidden");
  document.querySelectorAll(".nav-item").forEach(x=>x.classList.toggle("active",x.dataset.page===page));
  $("pageTitle").textContent=page==="dashboard"?"Dashboard":page.replace("-", " ").replace(/\b\w/g,c=>c.toUpperCase());
  $("sidebar").classList.remove("open");
  renderPage(page);
}
async function loadData(){
  if(!client)return;
  const [w,a,t]=await Promise.all([
    client.from("profiles").select("*").order("full_name"),
    client.from("attendance").select("*").order("attendance_date",{ascending:false}).limit(500),
    client.from("tasks").select("*").order("created_at",{ascending:false}).limit(500)
  ]);
  if(w.error) throw w.error; if(a.error) throw a.error; if(t.error) throw t.error;
  workers=w.data||[]; attendance=a.data||[]; tasks=t.data||[];
}
async function loadProfile(){
  const {data:{user}}=await client.auth.getUser(); currentUser=user;
  if(!user) return;
  const {data,error}=await client.from("profiles").select("*").eq("id",user.id).single();
  if(error) throw error; currentProfile=data;
}
function updateIdentity(){
  const name=currentProfile?.full_name||currentUser?.email?.split("@")[0]||"User";
  const role=(currentProfile?.role||"worker").toUpperCase();
  $("sideName").textContent=name; $("sideRole").textContent=role;
  $("sideAvatar").textContent=initials(name); $("topAvatar").textContent=initials(name);
  $("settingsName").textContent=name; $("settingsEmail").textContent=currentUser?.email||"";
  $("settingsRole").textContent=role;
  $("settingsRole").className="badge "+(role==="OWNER"?"gold":role==="MANAGER"?"blue":"gray");
  $("settingsAvatar").textContent=initials(name); $("welcomeText").textContent=`Welcome back, ${name}`;
  $("todayText").textContent=new Date().toLocaleDateString(undefined,{weekday:"long",day:"numeric",month:"short",year:"numeric"});
  $("addWorkerBtn").classList.toggle("hidden",!canManage());
  $("addTaskBtn").classList.toggle("hidden",!canManage());
  $("markAttendanceBtn").classList.toggle("hidden",!canManage());
}
function visibleWorkers(){return workers}
function worker(id){return workers.find(w=>w.id===id)}
function visibleAttendance(){return isOwner()||currentProfile?.role==="manager"?attendance:attendance.filter(x=>x.worker_id===currentUser?.id)}
function visibleTasks(){return isOwner()||currentProfile?.role==="manager"?tasks:tasks.filter(x=>x.assigned_to===currentUser?.id)}
function badgeStatus(s){const c={Present:"green",Completed:"green",Active:"green",Absent:"red",Inactive:"red","In Progress":"blue",Pending:"gold",Late:"gold",Leave:"gray"}[s]||"gray";return `<span class="badge ${c}">${esc(s)}</span>`}

function renderDashboard(){
  const wa=visibleAttendance().filter(x=>x.attendance_date===today());
  const tt=visibleTasks().filter(x=>x.due_date===today());
  $("statWorkers").textContent=workers.filter(w=>w.status==="Active").length;
  $("statPresent").textContent=wa.filter(x=>x.status==="Present"||x.status==="Late").length;
  $("statTasks").textContent=tt.length;
  $("statCompleted").textContent=tt.filter(x=>x.status==="Completed").length;
  $("dashboardAttendance").innerHTML=wa.slice(0,6).map(a=>`<div class="list-row"><div class="worker-inline"><div class="avatar">${initials(worker(a.worker_id)?.full_name)}</div><div><b>${esc(worker(a.worker_id)?.full_name||"Unknown")}</b><small>${esc(a.time||"")}</small></div></div>${badgeStatus(a.status)}</div>`).join("")||`<div class="empty">No attendance recorded for today.</div>`;
  $("dashboardTasks").innerHTML=tt.slice(0,6).map(t=>`<div class="list-row"><div><b>${esc(t.title)}</b><small class="muted">${esc(worker(t.assigned_to)?.full_name||"Unassigned")} · ${t.progress||0}%</small></div>${badgeStatus(t.status)}</div>`).join("")||`<div class="empty">No tasks due today.</div>`;
}
function renderWorkers(){
  const q=($("workerSearch").value||"").toLowerCase(), f=$("workerStatusFilter").value;
  const rows=workers.filter(w=>(!q||`${w.full_name} ${w.employee_id} ${w.department}`.toLowerCase().includes(q))&&(!f||w.status===f));
  $("workersTable").innerHTML=rows.map(w=>`<tr><td><div class="worker-inline"><div class="avatar">${initials(w.full_name)}</div><div><b>${esc(w.full_name)}</b><small>${esc(w.email||"")}</small></div></div></td><td>${esc(w.employee_id||"—")}</td><td>${esc(w.department||"—")}</td><td>${esc(w.phone||"—")}</td><td>${badgeStatus(w.status)}</td><td>${badgeStatus((w.role||"worker").toUpperCase())}</td><td><div class="actions">${canManage()?`<button class="mini-btn" onclick="editWorker('${w.id}')">Edit</button>`:""}${isOwner()&&w.id!==currentUser.id?`<button class="mini-btn" onclick="toggleWorker('${w.id}', '${w.status}')">${w.status==="Active"?"Disable":"Enable"}</button>`:""}</div></td></tr>`).join("")||`<tr><td colspan="7"><div class="empty">No workers found.</div></td></tr>`;
}
function renderAttendance(){
  const d=$("attendanceDate").value||today(), f=$("attendanceWorkerFilter").value;
  const rows=visibleAttendance().filter(a=>a.attendance_date===d&&(!f||a.worker_id===f));
  $("attendanceTable").innerHTML=rows.map(a=>`<tr><td>${esc(worker(a.worker_id)?.full_name||"Unknown")}</td><td>${fmtDate(a.attendance_date)}</td><td>${badgeStatus(a.status)}</td><td>${esc(a.time||"—")}</td><td>${esc(a.notes||"—")}</td><td>${canManage()?`<button class="mini-btn" onclick="editAttendance('${a.id}')">Edit</button>`:""}</td></tr>`).join("")||`<tr><td colspan="6"><div class="empty">No records for this date.</div></td></tr>`;
}
function renderTasks(){
  const q=($("taskSearch").value||"").toLowerCase(), f=$("taskStatusFilter").value;
  const rows=visibleTasks().filter(t=>(!q||`${t.title} ${t.description}`.toLowerCase().includes(q))&&(!f||t.status===f));
  $("taskCards").innerHTML=rows.map(t=>`<article class="task-card"><div style="display:flex;justify-content:space-between;gap:8px">${badgeStatus(t.status)}<span class="muted" style="font-size:11px">${fmtDate(t.due_date)}</span></div><h3>${esc(t.title)}</h3><div class="task-meta"><span>👤 ${esc(worker(t.assigned_to)?.full_name||"Unassigned")}</span><span>Priority: ${esc(t.priority||"Normal")}</span></div><p class="muted" style="font-size:12px">${esc(t.description||"No description")}</p><div class="progress"><i style="width:${Math.min(100,Math.max(0,t.progress||0))}%"></i></div><div class="task-footer"><b>${t.progress||0}%</b><div class="actions">${canManage()?`<button class="mini-btn" onclick="editTask('${t.id}')">Edit</button><button class="mini-btn" onclick="deleteTask('${t.id}')">Delete</button>`:""}</div></div></article>`).join("")||`<div class="empty">No tasks found.</div>`;
}
function renderReports(){
  const va=visibleAttendance(), vt=visibleTasks();
  $("reportAttendance").textContent=va.length; $("reportTasks").textContent=vt.length;
  const done=vt.filter(t=>t.status==="Completed").length; $("reportRate").textContent=vt.length?Math.round(done/vt.length*100)+"%":"0%";
  $("reportActive").textContent=workers.filter(w=>w.status==="Active").length;
  $("performanceTable").innerHTML=workers.filter(w=>w.status==="Active").map(w=>{const ts=vt.filter(t=>t.assigned_to===w.id), as=va.filter(a=>a.worker_id===w.id), d=ts.length?Math.round(ts.reduce((s,t)=>s+(t.progress||0),0)/ts.length):0;return `<tr><td>${esc(w.full_name)}</td><td>${ts.length}</td><td>${ts.filter(t=>t.status==="Completed").length}</td><td><div style="min-width:120px"><div class="progress"><i style="width:${d}%"></i></div><small>${d}%</small></div></td><td>${as.filter(a=>a.status==="Present"||a.status==="Late").length}/${as.length}</td></tr>`}).join("")||`<tr><td colspan="5"><div class="empty">No performance data.</div></td></tr>`;
}
function renderSettings(){ $("connectionStatus").innerHTML=isConfigured?`✓ Connected to Supabase project`:`⚠ Add your Supabase URL and anon key in app.js`; }
function renderPage(p){if(p==="dashboard")renderDashboard();if(p==="workers")renderWorkers();if(p==="attendance")renderAttendance();if(p==="tasks")renderTasks();if(p==="reports")renderReports();if(p==="settings")renderSettings()}

function workerForm(w={}){
 return `<form id="workerForm"><div class="form-grid">
 <div class="field"><label>Full name</label><input name="full_name" value="${esc(w.full_name||"")}" required></div>
 <div class="field"><label>Email</label><input name="email" type="email" value="${esc(w.email||"")}" ${w.id?"disabled":""} required></div>
 <div class="field"><label>Employee ID</label><input name="employee_id" value="${esc(w.employee_id||"")}"></div>
 <div class="field"><label>Phone</label><input name="phone" value="${esc(w.phone||"")}"></div>
 <div class="field"><label>Joining date</label><input name="joining_date" type="date" value="${esc(w.joining_date||today())}"></div>
 <div class="field"><label>Department / Role</label><input name="department" value="${esc(w.department||"")}"></div>
 <div class="field"><label>System role</label><select name="role">${["worker","manager","owner"].map(r=>`<option ${w.role===r?"selected":""}>${r}</option>`).join("")}</select></div>
 <div class="field"><label>Status</label><select name="status"><option ${w.status==="Active"?"selected":""}>Active</option><option ${w.status==="Inactive"?"selected":""}>Inactive</option></select></div>
 ${!w.id?`<div class="field full"><label>Temporary password</label><input name="password" type="password" minlength="8" placeholder="Minimum 8 characters" required></div>`:""}
 </div><div class="modal-actions"><button type="button" class="btn secondary" onclick="closeModal()">Cancel</button><button class="btn primary">Save Worker</button></div></form>`;
}
function openWorkerModal(w={}){if(!canManage())return;modal(w.id?"Edit Worker":"Add Worker",workerForm(w));$("workerForm").onsubmit=async e=>{e.preventDefault();const fd=new FormData(e.target), data=Object.fromEntries(fd.entries());try{if(w.id){delete data.email;delete data.password;const {error}=await client.from("profiles").update({...data,role:data.role}).eq("id",w.id);if(error)throw error;toast("Worker updated")}else{const {data:r,error}=await client.functions.invoke("create-user",{body:{email:data.email,password:data.password,full_name:data.full_name,employee_id:data.employee_id,phone:data.phone,joining_date:data.joining_date,department:data.department,role:data.role,status:data.status}});if(error)throw error;if(r?.error)throw new Error(r.error);toast("Worker account created")}closeModal();await loadData();renderPage(selectedPage)}catch(err){toast(err.message||"Could not save worker","error")}}}
function editWorker(id){const w=worker(id);if(w)openWorkerModal(w)}
async function toggleWorker(id,status){try{const {error}=await client.from("profiles").update({status:status==="Active"?"Inactive":"Active"}).eq("id",id);if(error)throw error;await loadData();renderWorkers();toast("Worker status updated")}catch(e){toast(e.message,"error")}}

function attendanceForm(a={}){
 const list=workers.filter(w=>w.status==="Active" || w.id===a.worker_id);
 return `<form id="attendanceForm"><div class="form-grid"><div class="field full"><label>Worker</label><select name="worker_id" required>${list.map(w=>`<option value="${w.id}" ${w.id===a.worker_id?"selected":""}>${esc(w.full_name)} (${esc(w.employee_id||"—")})</option>`).join("")}</select></div><div class="field"><label>Date</label><input name="attendance_date" type="date" value="${a.attendance_date||today()}" required></div><div class="field"><label>Status</label><select name="status">${["Present","Absent","Late","Leave"].map(x=>`<option ${a.status===x?"selected":""}>${x}</option>`).join("")}</select></div><div class="field"><label>Time</label><input name="time" type="time" value="${a.time||""}"></div><div class="field"><label>Notes</label><input name="notes" value="${esc(a.notes||"")}"></div></div><div class="modal-actions"><button type="button" class="btn secondary" onclick="closeModal()">Cancel</button><button class="btn primary">Save</button></div></form>`;
}
function openAttendanceModal(a={}){if(!canManage())return;modal(a.id?"Edit Attendance":"Mark Attendance",attendanceForm(a));$("attendanceForm").onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target).entries());try{let q;if(a.id)q=await client.from("attendance").update(data).eq("id",a.id);else q=await client.from("attendance").upsert({...data,marked_by:currentUser.id},{onConflict:"worker_id,attendance_date"});if(q.error)throw q.error;closeModal();await loadData();renderPage("attendance");toast("Attendance saved")}catch(err){toast(err.message,"error")}}}
function editAttendance(id){const a=attendance.find(x=>x.id===id);if(a)openAttendanceModal(a)}

function taskForm(t={}){
 return `<form id="taskForm"><div class="form-grid"><div class="field full"><label>Task title</label><input name="title" value="${esc(t.title||"")}" required></div><div class="field full"><label>Description</label><textarea name="description">${esc(t.description||"")}</textarea></div><div class="field"><label>Assign to</label><select name="assigned_to" required>${workers.filter(w=>w.status==="Active").map(w=>`<option value="${w.id}" ${w.id===t.assigned_to?"selected":""}>${esc(w.full_name)}</option>`).join("")}</select></div><div class="field"><label>Deadline</label><input name="due_date" type="date" value="${t.due_date||today()}" required></div><div class="field"><label>Priority</label><select name="priority">${["Low","Normal","High","Urgent"].map(x=>`<option ${t.priority===x?"selected":""}>${x}</option>`).join("")}</select></div><div class="field"><label>Status</label><select name="status">${["Pending","In Progress","Completed"].map(x=>`<option ${t.status===x?"selected":""}>${x}</option>`).join("")}</select></div><div class="field"><label>Progress %</label><input name="progress" type="number" min="0" max="100" value="${t.progress??0}"></div></div><div class="modal-actions"><button type="button" class="btn secondary" onclick="closeModal()">Cancel</button><button class="btn primary">Save Task</button></div></form>`;
}
function openTaskModal(t={}){if(!canManage())return;modal(t.id?"Edit Task":"Assign Task",taskForm(t));$("taskForm").onsubmit=async e=>{e.preventDefault();const data=Object.fromEntries(new FormData(e.target).entries());data.progress=Math.max(0,Math.min(100,Number(data.progress||0)));if(data.progress===100)data.status="Completed";try{let q;if(t.id)q=await client.from("tasks").update(data).eq("id",t.id);else q=await client.from("tasks").insert({...data,assigned_by:currentUser.id});if(q.error)throw q.error;closeModal();await loadData();renderPage("tasks");toast("Task saved")}catch(err){toast(err.message,"error")}}}
function editTask(id){const t=tasks.find(x=>x.id===id);if(t)openTaskModal(t)}
async function deleteTask(id){if(!confirm("Delete this task?"))return;try{const {error}=await client.from("tasks").delete().eq("id",id);if(error)throw error;await loadData();renderTasks();toast("Task deleted")}catch(e){toast(e.message,"error")}}

async function boot(){
  if(!isConfigured){$("configNotice").classList.remove("hidden");$("configNotice").textContent="Supabase is not configured yet. Add SUPABASE_URL and SUPABASE_ANON_KEY in app.js, then reload.";return}
  const {data:{session}}=await client.auth.getSession();
  if(session){try{await enterApp()}catch(e){toast(e.message,"error")}}
  client.auth.onAuthStateChange(async(_event,session)=>{if(session&&!currentUser){try{await enterApp()}catch(e){toast(e.message,"error")}}else if(!session){currentUser=null;currentProfile=null;$("appView").classList.add("hidden");$("authView").classList.remove("hidden")}})
}
async function enterApp(){await loadProfile();await loadData();updateIdentity();$("authView").classList.add("hidden");$("appView").classList.remove("hidden");setPage("dashboard");if(!canManage()){$("setupBanner").classList.remove("hidden");$("setupBanner").textContent="Worker mode: you can view only your own attendance and assigned tasks."}}
$("loginForm").addEventListener("submit",async e=>{e.preventDefault();if(!client){toast("Configure Supabase in app.js first","error");return}try{const {error}=await client.auth.signInWithPassword({email:$("loginEmail").value.trim(),password:$("loginPassword").value});if(error)throw error}catch(err){toast(err.message||"Login failed","error")}})
$("logoutBtn").onclick=async()=>{await client.auth.signOut()}
$("menuBtn").onclick=()=>$("sidebar").classList.toggle("open");
document.querySelectorAll(".nav-item").forEach(b=>b.onclick=()=>setPage(b.dataset.page));
document.querySelectorAll("[data-page-jump]").forEach(b=>b.onclick=()=>setPage(b.dataset.pageJump));
$("addWorkerBtn").onclick=()=>openWorkerModal();
$("addTaskBtn").onclick=()=>openTaskModal();
$("markAttendanceBtn").onclick=()=>openAttendanceModal();
$("workerSearch").oninput=renderWorkers;$("workerStatusFilter").onchange=renderWorkers;
$("attendanceDate").value=today();$("attendanceDate").onchange=renderAttendance;$("attendanceWorkerFilter").onchange=renderAttendance;
$("taskSearch").oninput=renderTasks;$("taskStatusFilter").onchange=renderTasks;
$("exportBtn").onclick=()=>{const blob=new Blob([JSON.stringify({workers,attendance,tasks},null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`mya-report-${today()}.json`;a.click();URL.revokeObjectURL(a.href)};
$("attendanceWorkerFilter").innerHTML='<option value="">All workers</option>';
const oldLoad=loadData; loadData=async()=>{await oldLoad();$("attendanceWorkerFilter").innerHTML='<option value="">All workers</option>'+workers.map(w=>`<option value="${w.id}">${esc(w.full_name)}</option>`).join("")};
boot();
