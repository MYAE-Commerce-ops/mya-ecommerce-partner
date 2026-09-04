const KEY="mya_system_v1";
let db=JSON.parse(localStorage.getItem(KEY)||"null")||{
 workers:[{id:"W001",name:"Ali",phone:"03001234567",role:"Product Listing",joining:"2026-09-01",status:"Active"},{id:"W002",name:"Ahmed",phone:"03111234567",role:"Order Checking",joining:"2026-09-02",status:"Active"}],
 attendance:[], tasks:[
 {id:1,title:"Upload 50 product listings",worker:"W001",deadline:"2026-09-04",priority:"High",progress:70,status:"In Progress"},
 {id:2,title:"Check today's orders",worker:"W002",deadline:"2026-09-04",priority:"Medium",progress:100,status:"Completed"}
 ]};
const save=()=>{localStorage.setItem(KEY,JSON.stringify(db));renderAll()};
const todayISO=()=>new Date().toISOString().slice(0,10);
document.getElementById("today").textContent=new Date().toLocaleDateString();
document.getElementById("attendanceDate").value=todayISO();

document.getElementById("loginForm").onsubmit=e=>{e.preventDefault();if(username.value==="owner"&&password.value==="mya123"){loginPage.classList.add("hidden");app.classList.remove("hidden");renderAll()}else alert("Wrong login. Demo: owner / mya123")};
logout.onclick=()=>{app.classList.add("hidden");loginPage.classList.remove("hidden")};

document.querySelectorAll(".nav").forEach(b=>b.onclick=()=>{document.querySelectorAll(".nav").forEach(x=>x.classList.remove("active"));b.classList.add("active");document.querySelectorAll(".section").forEach(s=>s.classList.add("hidden"));document.getElementById(b.dataset.section).classList.remove("hidden");pageTitle.textContent=b.textContent.replace(/^[^ ]+ /,"")});
attendanceDate.onchange=renderAttendance;

function renderAll(){renderWorkers();renderAttendance();renderTasks();renderDashboard();renderReports()}
function renderWorkers(){workerTable.innerHTML=db.workers.map(w=>`<tr><td>${w.id}</td><td><b>${w.name}</b></td><td>${w.phone}</td><td>${w.role}</td><td>${w.joining}</td><td><span class="badge ${w.status==="Active"?"present":"absent"}">${w.status}</span></td><td class="actions"><button onclick="editWorker('${w.id}')">✏️</button><button onclick="deleteWorker('${w.id}')">🗑️</button></td></tr>`).join("")||emptyRow(7,"No workers added")}

function renderAttendance(){let d=attendanceDate.value||todayISO();attendanceTable.innerHTML=db.workers.map(w=>{let a=db.attendance.find(x=>x.worker===w.id&&x.date===d);let status=a?.status||"Not Marked";return `<tr><td>${w.name}</td><td><span class="badge ${status.toLowerCase().replace(" ","")}">${status}</span></td><td>${a?.time||"—"}</td><td><select onchange="markAttendance('${w.id}',this.value)"><option value="">Select</option><option>Present</option><option>Absent</option><option>Late</option><option>Leave</option></select></td></tr>`}).join("")}
function markAttendance(id,status){if(!status)return;let d=attendanceDate.value||todayISO();let old=db.attendance.find(x=>x.worker===id&&x.date===d);if(old){old.status=status;old.time=status==="Absent"||status==="Leave"?"—":new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})}else db.attendance.push({worker:id,date:d,status,time:status==="Absent"||status==="Leave"?"—":new Date().toLocaleTimeString([],{hour:"2-digit",minute:"2-digit"})});save()}

function renderTasks(){taskTable.innerHTML=db.tasks.map(t=>`<tr><td><b>${t.title}</b></td><td>${workerName(t.worker)}</td><td>${t.deadline}</td><td>${t.priority}</td><td><div>${t.progress}%</div><div class="progress"><i style="width:${t.progress}%"></i></div></td><td><span class="badge ${t.status==="Completed"?"completed":t.status==="In Progress"?"inprogress":"pending"}">${t.status}</span></td><td class="actions"><button onclick="editTask(${t.id})">✏️</button><button onclick="deleteTask(${t.id})">🗑️</button></td></tr>`).join("")||emptyRow(7,"No tasks added")}
function workerName(id){return db.workers.find(w=>w.id===id)?.name||"Unknown"}
function emptyRow(n,msg){return `<tr><td colspan="${n}" style="text-align:center;color:#667085">${msg}</td></tr>`}

function renderDashboard(){let d=todayISO(),a=db.attendance.filter(x=>x.date===d),t=db.tasks.filter(x=>x.deadline===d);totalWorkers.textContent=db.workers.length;presentToday.textContent=a.filter(x=>x.status==="Present"||x.status==="Late").length;absentToday.textContent=a.filter(x=>x.status==="Absent").length;tasksToday.textContent=t.length;completedToday.textContent=t.filter(x=>x.status==="Completed").length;progressToday.textContent=t.filter(x=>x.status==="In Progress").length;dashboardTasks.innerHTML=t.map(x=>`<p><b>${x.title}</b> — ${workerName(x.worker)} — ${x.progress}% — ${x.status}</p>`).join("")||"<p>No tasks for today.</p>"}
function renderReports(){allTasks.textContent=db.tasks.length;allCompleted.textContent=db.tasks.filter(x=>x.status==="Completed").length;avgProgress.textContent=(db.tasks.length?Math.round(db.tasks.reduce((s,x)=>s+x.progress,0)/db.tasks.length):0)+"%";reportTable.innerHTML=db.workers.map(w=>{let t=db.tasks.filter(x=>x.worker===w.id);return `<tr><td>${w.name}</td><td>${t.length}</td><td>${t.filter(x=>x.status==="Completed").length}</td><td>${t.length?Math.round(t.reduce((s,x)=>s+x.progress,0)/t.length):0}%</td></tr>`}).join("")}

function openWorkerModal(w=null){modalContent.innerHTML=`<h2>${w?"Edit":"Add"} Worker</h2><form onsubmit="submitWorker(event,'${w?.id||""}')"><input id="wn" placeholder="Worker name" value="${w?.name||""}" required><input id="wp" placeholder="Phone" value="${w?.phone||""}" required><input id="wr" placeholder="Role / Department" value="${w?.role||""}" required><input id="wj" type="date" value="${w?.joining||todayISO()}" required><select id="ws"><option ${w?.status==="Active"?"selected":""}>Active</option><option ${w?.status==="Inactive"?"selected":""}>Inactive</option></select><button type="submit">Save Worker</button></form>`;modal.classList.remove("hidden")}
function submitWorker(e,id){e.preventDefault();let data={name:wn.value,phone:wp.value,role:wr.value,joining:wj.value,status:ws.value};if(id){Object.assign(db.workers.find(x=>x.id===id),data)}else{let n=db.workers.length+1;db.workers.push({id:"W"+String(n).padStart(3,"0"),...data})}closeModal();save()}
function editWorker(id){openWorkerModal(db.workers.find(x=>x.id===id))}
function deleteWorker(id){if(confirm("Delete this worker?")){db.workers=db.workers.filter(x=>x.id!==id);db.tasks=db.tasks.filter(x=>x.worker!==id);db.attendance=db.attendance.filter(x=>x.worker!==id);save()}}

function openTaskModal(t=null){modalContent.innerHTML=`<h2>${t?"Edit":"Assign"} Task</h2><form onsubmit="submitTask(event,'${t?.id||""}')"><input id="tt" placeholder="Task title" value="${t?.title||""}" required><select id="tw">${db.workers.map(w=>`<option value="${w.id}" ${t?.worker===w.id?"selected":""}>${w.name}</option>`).join("")}</select><input id="td" type="date" value="${t?.deadline||todayISO()}" required><select id="tp"><option>Low</option><option ${t?.priority==="Medium"?"selected":""}>Medium</option><option ${t?.priority==="High"?"selected":""}>High</option></select><input id="tprog" type="number" min="0" max="100" value="${t?.progress??0}" placeholder="Progress %"><select id="ts"><option ${t?.status==="Pending"?"selected":""}>Pending</option><option ${t?.status==="In Progress"?"selected":""}>In Progress</option><option ${t?.status==="Completed"?"selected":""}>Completed</option></select><button type="submit">Save Task</button></form>`;modal.classList.remove("hidden")}
function submitTask(e,id){e.preventDefault();let data={title:tt.value,worker:tw.value,deadline:td.value,priority:tp.value,progress:Number(tprog.value),status:ts.value};if(id)Object.assign(db.tasks.find(x=>x.id==id),data);else db.tasks.push({id:Date.now(),...data});closeModal();save()}
function editTask(id){openTaskModal(db.tasks.find(x=>x.id===id))}
function deleteTask(id){if(confirm("Delete this task?")){db.tasks=db.tasks.filter(x=>x.id!==id);save()}}
function closeModal(){modal.classList.add("hidden")}
renderAll();