const STORAGE_KEY = "classnote-attendance-v1";
const statuses = ["출석", "지각", "조퇴", "결석"];
const colors = ["", "color-1", "color-2", "color-3", "color-4"];

const dateInput = document.querySelector("#attendance-date");
const studentList = document.querySelector("#student-list");
const emptyState = document.querySelector("#empty-state");
const noResults = document.querySelector("#no-results");
const searchInput = document.querySelector("#student-search");
const dialog = document.querySelector("#student-dialog");
const namesInput = document.querySelector("#student-names");

function localDateString(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadData() {
  try {
    const stored = JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
    if (Array.isArray(stored.students) && stored.records && typeof stored.records === "object") {
      return stored;
    }
  } catch (error) {
    console.error("출석 데이터를 불러오지 못했습니다.", error);
  }
  return { students: [], records: {} };
}

let data = loadData();
dateInput.value = localDateString();

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    document.querySelector(".saved-indicator").innerHTML = "<i></i> 자동 저장됨";
  } catch (error) {
    console.error("출석 데이터를 저장하지 못했습니다.", error);
    document.querySelector(".saved-indicator").textContent = "저장 실패";
  }
}

function dayRecords() {
  return data.records[dateInput.value] || {};
}

function updateSummary() {
  const record = dayRecords();
  const counts = { 출석: 0, 지각: 0, 조퇴: 0, 결석: 0 };
  Object.values(record).forEach((entry) => {
    if (entry && counts[entry.status] !== undefined) counts[entry.status] += 1;
  });
  document.querySelector("#total-count").textContent = data.students.length;
  document.querySelector("#present-count").textContent = counts.출석;
  document.querySelector("#late-count").textContent = counts.지각 + counts.조퇴;
  document.querySelector("#absent-count").textContent = counts.결석;
  document.querySelector("#list-count").textContent = data.students.length;
  document.querySelector("#sidebar-count").textContent = data.students.length;
  document.querySelector("#unchecked-label").textContent = `미체크 ${Math.max(data.students.length - Object.keys(record).length, 0)}명`;
  document.querySelector("#date-caption").textContent = `${formatDate(dateInput.value)} 출석 현황이에요.`;
}

function formatDate(value) {
  if (!value) return "선택한 날짜";
  const [year, month, day] = value.split("-").map(Number);
  return `${year}년 ${month}월 ${day}일`;
}

function renderStudents() {
  const records = dayRecords();
  const query = searchInput.value.trim().toLocaleLowerCase("ko");
  const visibleStudents = data.students.filter((student) => student.name.toLocaleLowerCase("ko").includes(query));
  studentList.replaceChildren();

  visibleStudents.forEach((student, index) => {
    const record = records[student.id];
    const row = document.createElement("tr");
    const nameCell = document.createElement("td");
    nameCell.innerHTML = `<div class="student-cell"><span class="student-avatar ${colors[(index % 4) + 1]}">${escapeHTML(student.name.slice(0, 1))}</span><span>${escapeHTML(student.name)}</span></div>`;

    const statusCell = document.createElement("td");
    const group = document.createElement("div");
    group.className = "status-group";
    statuses.forEach((status) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "status-button";
      button.dataset.status = status;
      button.setAttribute("aria-pressed", String(record?.status === status));
      button.textContent = status;
      button.setAttribute("aria-label", `${student.name} ${status} 처리`);
      button.addEventListener("click", () => setStatus(student.id, status));
      group.append(button);
    });
    statusCell.append(group);

    const recordCell = document.createElement("td");
    recordCell.className = "record-time";
    recordCell.textContent = record ? `${record.time} 기록` : "—";
    row.append(nameCell, statusCell, recordCell);
    studentList.append(row);
  });

  emptyState.hidden = data.students.length > 0;
  noResults.hidden = data.students.length === 0 || visibleStudents.length > 0;
  studentList.hidden = data.students.length === 0 || visibleStudents.length === 0;
  updateSummary();
}

function escapeHTML(value) {
  return value.replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[character]);
}

function setStatus(studentId, status) {
  const records = data.records[dateInput.value] || (data.records[dateInput.value] = {});
  records[studentId] = {
    status,
    time: new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date()),
  };
  saveData();
  renderStudents();
}

function openDialog() {
  dialog.showModal();
  namesInput.focus();
}

function addStudents(event) {
  event.preventDefault();
  const names = namesInput.value.split(/[\n,]+/).map((name) => name.trim()).filter(Boolean);
  const existing = new Set(data.students.map((student) => student.name.toLocaleLowerCase("ko")));
  const newNames = [...new Set(names)].filter((name) => {
    const normalized = name.toLocaleLowerCase("ko");
    if (existing.has(normalized)) return false;
    existing.add(normalized);
    return true;
  });
  newNames.forEach((name) => data.students.push({ id: crypto.randomUUID(), name }));
  if (newNames.length > 0) saveData();
  namesInput.value = "";
  dialog.close();
  renderStudents();
}

function exportCSV() {
  const records = data.records[dateInput.value] || {};
  const rows = [["이름", "날짜", "출석 상태", "기록 시각"], ...data.students.map((student) => {
    const record = records[student.id];
    return [student.name, dateInput.value, record?.status || "미체크", record?.time || ""];
  })];
  const csv = "\uFEFF" + rows.map((row) => row.map((field) => `"${String(field).replaceAll('"', '""')}"`).join(",")).join("\r\n");
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `출석기록-${dateInput.value}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}

document.querySelector("#add-student-button").addEventListener("click", openDialog);
document.querySelector("#empty-add-button").addEventListener("click", openDialog);
document.querySelector("#close-dialog").addEventListener("click", () => dialog.close());
document.querySelector("#cancel-dialog").addEventListener("click", () => dialog.close());
document.querySelector("#student-form").addEventListener("submit", addStudents);
document.querySelector("#export-button").addEventListener("click", exportCSV);
dateInput.addEventListener("change", renderStudents);
searchInput.addEventListener("input", renderStudents);

renderStudents();