const SUPABASE_URL = "https://zuvndduwdabacsbjkien.supabase.co";
const SUPABASE_KEY = "sb_publishable_LeUuT-vuNuC3RR2igMstcw_s65PyMBO";
const SESSION_KEY = "quality-deliverables-supabase-session-v1";

const phases = [
  { id: "program-definition", name: "Program Definition" },
  { id: "concept-verification", name: "Concept Verification" },
  { id: "design-verification", name: "Design Verification" },
  { id: "industrialization", name: "Industrialization" },
  { id: "ramp-up", name: "Ramp Up" },
];

const seedPackages = [
  {
    phaseId: "concept-verification",
    packageName: "FMG 2",
    deliverables: [
      "FMG2 Q Approval",
      "APQP Questionnaire (if customer requests)",
      "Special Characteristics Monitoring",
      "Prototype Control Plan",
      "PPAP Scope",
      "Defect & Rework Catalogue (draft)",
    ],
  },
  {
    phaseId: "design-verification",
    packageName: "FMG 3",
    deliverables: [
      "FMG3 Q Approval",
      "Special Characteristics Monitoring",
      "Pre-Launch Control Plan",
      "Defect & Rework Catalogue (update)",
    ],
  },
  {
    phaseId: "industrialization",
    packageName: "FMG 4.1",
    deliverables: [
      "FMG4.1 Q Approval",
      "Special Characteristics Monitoring",
      "Series Control Plan",
      "Defect & Rework Catalogue (update)",
    ],
  },
  {
    phaseId: "industrialization",
    packageName: "FMG 4.2",
    deliverables: [
      "FMG4.2 Q Approval",
      "Special Characteristics Monitoring",
      "Process Audit",
      "PPAP Approval",
      "Defect & Rework Catalogue (update)",
    ],
  },
  {
    phaseId: "ramp-up",
    packageName: "FMG 5",
    deliverables: ["FMG5 Q Approval", "Special Characteristics Monitoring", "Process Audit (closed)"],
  },
  {
    phaseId: "ramp-up",
    packageName: "Gate 5",
    deliverables: ["PPAP Approval"],
  },
];

const statusConfig = {
  "not-started": { label: "Nao iniciado", className: "status-not-started" },
  "in-progress": { label: "Em andamento", className: "status-in-progress" },
  done: { label: "Concluido", className: "status-done" },
  blocked: { label: "Bloqueado", className: "status-blocked" },
};

const board = document.querySelector("#board");
const dialog = document.querySelector("#deliverableDialog");
const form = document.querySelector("#deliverableForm");
const dialogTitle = document.querySelector("#dialogTitle");
const deleteButton = document.querySelector("#deleteButton");
const phaseInput = document.querySelector("#phaseInput");
const packageInput = document.querySelector("#packageInput");
const packageOptions = document.querySelector("#packageOptions");
const searchInput = document.querySelector("#searchInput");
const statusFilters = document.querySelector("#statusFilters");
const dialogBackdrop = document.querySelector("#dialogBackdrop");
const authPanel = document.querySelector("#authPanel");
const authForm = document.querySelector("#authForm");
const authMessage = document.querySelector("#authMessage");
const appContent = document.querySelector("#appContent");
const syncStatus = document.querySelector("#syncStatus");
const userEmail = document.querySelector("#userEmail");
const signOutButton = document.querySelector("#signOutButton");

let state = { deliverables: [] };
let session = loadSession();
let activeStatus = "all";
let editingId = null;

function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch (error) {
    return null;
  }
}

function saveSession(nextSession) {
  session = nextSession;
  if (session) {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  } else {
    localStorage.removeItem(SESSION_KEY);
  }
}

function setStatus(message, type = "neutral") {
  syncStatus.textContent = message;
  syncStatus.classList.toggle("is-online", type === "online");
  syncStatus.classList.toggle("is-error", type === "error");
}

function setAuthMessage(message, type = "neutral") {
  authMessage.textContent = message;
  authMessage.classList.toggle("is-error", type === "error");
  authMessage.classList.toggle("is-success", type === "success");
}

function friendlyAuthError(error) {
  const message = String(error?.message ?? error);
  const normalized = message.toLowerCase();

  if (normalized.includes("permission denied for table deliverables")) {
    return "Login funcionou, mas o Supabase negou acesso a tabela deliverables. Rode o SQL de permissao no SQL Editor do Supabase.";
  }

  if (normalized.includes("invalid login credentials")) {
    return "Credenciais invalidas. Confira se voce ja clicou em Criar conta neste app, confirmou o e-mail se o Supabase pediu confirmacao, e esta usando a senha dessa conta do app.";
  }

  if (normalized.includes("email not confirmed")) {
    return "Seu e-mail ainda nao foi confirmado. Abra o e-mail enviado pelo Supabase e confirme a conta antes de entrar.";
  }

  if (normalized.includes("user already registered") || normalized.includes("already registered")) {
    return "Este e-mail ja esta cadastrado. Use Entrar ou redefina a senha pelo Supabase.";
  }

  return message;
}

function apiHeaders(includeAuth = true, extra = {}) {
  const headers = {
    apikey: SUPABASE_KEY,
    "Content-Type": "application/json",
    ...extra,
  };

  if (includeAuth && session?.access_token) {
    headers.Authorization = `Bearer ${session.access_token}`;
  }

  return headers;
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;

  if (!response.ok) {
    const message = data?.msg || data?.message || data?.error_description || data?.error || response.statusText;
    throw new Error(message);
  }

  return data;
}

async function signIn(email, password) {
  return requestJson(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: apiHeaders(false),
    body: JSON.stringify({ email, password }),
  });
}

async function signUp(email, password) {
  return requestJson(`${SUPABASE_URL}/auth/v1/signup`, {
    method: "POST",
    headers: apiHeaders(false),
    body: JSON.stringify({ email, password }),
  });
}

function getOAuthRedirectUrl() {
  if (window.location.protocol === "file:") {
    return "http://127.0.0.1:4173/";
  }

  return `${window.location.origin}${window.location.pathname}`;
}

function signInWithGitHub() {
  const redirectTo = encodeURIComponent(getOAuthRedirectUrl());
  window.location.href = `${SUPABASE_URL}/auth/v1/authorize?provider=github&redirect_to=${redirectTo}`;
}

async function getUserFromAccessToken(accessToken) {
  return requestJson(`${SUPABASE_URL}/auth/v1/user`, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${accessToken}`,
    },
  });
}

async function consumeOAuthRedirect() {
  const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
  const queryParams = new URLSearchParams(window.location.search);
  const errorDescription =
    hashParams.get("error_description") || queryParams.get("error_description") || hashParams.get("error") || queryParams.get("error");

  if (errorDescription) {
    setAuthMessage(decodeURIComponent(errorDescription).replaceAll("+", " "), "error");
    window.history.replaceState({}, document.title, getOAuthRedirectUrl());
    return;
  }

  const accessToken = hashParams.get("access_token");
  const refreshToken = hashParams.get("refresh_token");
  if (!accessToken) {
    return;
  }

  setAuthMessage("Entrando com GitHub...");
  const user = await getUserFromAccessToken(accessToken);
  saveSession({
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_in: Number(hashParams.get("expires_in") ?? 3600),
    expires_at: Math.floor(Date.now() / 1000) + Number(hashParams.get("expires_in") ?? 3600),
    token_type: hashParams.get("token_type") ?? "bearer",
    user,
  });
  window.history.replaceState({}, document.title, getOAuthRedirectUrl());
  setAuthMessage("");
}

async function refreshSession() {
  if (!session?.refresh_token) {
    throw new Error("Sessao expirada.");
  }

  const refreshed = await requestJson(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: "POST",
    headers: apiHeaders(false),
    body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  saveSession(refreshed);
}

function mapFromDb(row) {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    phaseId: row.phase_id,
    packageName: row.package_name,
    status: row.status,
    dueDate: row.due_date ?? "",
    owner: row.owner ?? "",
    notes: row.notes ?? "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapToDb(deliverable) {
  return {
    user_id: session.user.id,
    title: deliverable.title,
    phase_id: deliverable.phaseId,
    package_name: deliverable.packageName,
    status: deliverable.status,
    due_date: deliverable.dueDate || null,
    owner: deliverable.owner || null,
    notes: deliverable.notes || null,
    updated_at: new Date().toISOString(),
  };
}

function createSeedDeliverables() {
  return seedPackages.flatMap((item) =>
    item.deliverables.map((title) => ({
      title,
      phaseId: item.phaseId,
      packageName: item.packageName,
      status: "not-started",
      dueDate: "",
      owner: "",
      notes: "",
    })),
  );
}

async function loadRemoteDeliverables({ seedIfEmpty = true } = {}) {
  setStatus("Sincronizando...");

  try {
    const rows = await requestJson(`${SUPABASE_URL}/rest/v1/deliverables?select=*&order=created_at.asc`, {
      headers: apiHeaders(true),
    });

    if (!rows.length && seedIfEmpty) {
      await insertSeedDeliverables();
      return loadRemoteDeliverables({ seedIfEmpty: false });
    }

    state = { deliverables: rows.map(mapFromDb) };
    setStatus("Online", "online");
    renderAll();
  } catch (error) {
    if (String(error.message).toLowerCase().includes("jwt")) {
      await refreshSession();
      return loadRemoteDeliverables({ seedIfEmpty });
    }

    setStatus("Erro de sync", "error");
    setAuthMessage(friendlyAuthError(error), "error");
    throw error;
  }
}

async function insertSeedDeliverables() {
  const payload = createSeedDeliverables().map(mapToDb);
  await requestJson(`${SUPABASE_URL}/rest/v1/deliverables`, {
    method: "POST",
    headers: apiHeaders(true, { Prefer: "return=minimal" }),
    body: JSON.stringify(payload),
  });
}

async function insertDeliverable(payload) {
  const rows = await requestJson(`${SUPABASE_URL}/rest/v1/deliverables?select=*`, {
    method: "POST",
    headers: apiHeaders(true, { Prefer: "return=representation" }),
    body: JSON.stringify(mapToDb(payload)),
  });
  return mapFromDb(rows[0]);
}

async function updateDeliverable(id, payload) {
  const rows = await requestJson(`${SUPABASE_URL}/rest/v1/deliverables?id=eq.${encodeURIComponent(id)}&select=*`, {
    method: "PATCH",
    headers: apiHeaders(true, { Prefer: "return=representation" }),
    body: JSON.stringify(mapToDb(payload)),
  });
  return mapFromDb(rows[0]);
}

async function deleteDeliverable(id) {
  await requestJson(`${SUPABASE_URL}/rest/v1/deliverables?id=eq.${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: apiHeaders(true, { Prefer: "return=minimal" }),
  });
}

async function resetRemoteBase() {
  await requestJson(`${SUPABASE_URL}/rest/v1/deliverables?user_id=eq.${encodeURIComponent(session.user.id)}`, {
    method: "DELETE",
    headers: apiHeaders(true, { Prefer: "return=minimal" }),
  });
  await insertSeedDeliverables();
  await loadRemoteDeliverables({ seedIfEmpty: false });
}

function getPhaseName(phaseId) {
  return phases.find((phase) => phase.id === phaseId)?.name ?? "Sem fase";
}

function normalize(value) {
  return value.trim().toLocaleLowerCase("pt-BR");
}

function getFilteredDeliverables() {
  const term = normalize(searchInput.value);

  return state.deliverables.filter((deliverable) => {
    const matchesStatus = activeStatus === "all" || deliverable.status === activeStatus;
    const searchable = [
      deliverable.title,
      deliverable.packageName,
      deliverable.owner,
      deliverable.notes,
      getPhaseName(deliverable.phaseId),
    ]
      .join(" ")
      .toLocaleLowerCase("pt-BR");

    return matchesStatus && (!term || searchable.includes(term));
  });
}

function groupDeliverablesByPackage(phaseId, deliverables) {
  const configuredPackages = seedPackages
    .filter((item) => item.phaseId === phaseId)
    .map((item) => item.packageName);

  const packageNames = new Set(configuredPackages);
  deliverables
    .filter((deliverable) => deliverable.phaseId === phaseId)
    .forEach((deliverable) => packageNames.add(deliverable.packageName));

  return [...packageNames].map((packageName) => ({
    packageName,
    deliverables: deliverables.filter(
      (deliverable) => deliverable.phaseId === phaseId && deliverable.packageName === packageName,
    ),
  }));
}

function renderAuthState() {
  const isLoggedIn = Boolean(session?.access_token && session?.user);
  authPanel.hidden = isLoggedIn;
  appContent.hidden = !isLoggedIn;
  signOutButton.hidden = !isLoggedIn;
  userEmail.hidden = !isLoggedIn;
  userEmail.textContent = session?.user?.email ?? "";
  document.querySelector("#newDeliverableButton").disabled = !isLoggedIn;
  document.querySelector("#exportButton").disabled = !isLoggedIn;
  document.querySelector("#resetButton").disabled = !isLoggedIn;

  if (!isLoggedIn) {
    setStatus("Desconectado");
  }
}

function renderMetrics() {
  const total = state.deliverables.length;
  const done = state.deliverables.filter((deliverable) => deliverable.status === "done").length;
  const progress = state.deliverables.filter((deliverable) => deliverable.status === "in-progress").length;
  const blocked = state.deliverables.filter((deliverable) => deliverable.status === "blocked").length;
  const rate = total ? Math.round((done / total) * 100) : 0;

  document.querySelector("#totalCount").textContent = total;
  document.querySelector("#doneCount").textContent = done;
  document.querySelector("#progressCount").textContent = progress;
  document.querySelector("#blockedCount").textContent = blocked;
  document.querySelector("#completionRate").textContent = `${rate}%`;
  document.querySelector("#completionBar").style.width = `${rate}%`;
}

function renderPhaseOptions() {
  phaseInput.innerHTML = phases.map((phase) => `<option value="${phase.id}">${phase.name}</option>`).join("");
}

function renderPackageOptions() {
  const packageNames = new Set(seedPackages.map((item) => item.packageName));
  state.deliverables.forEach((deliverable) => packageNames.add(deliverable.packageName));
  packageOptions.innerHTML = [...packageNames]
    .sort((a, b) => a.localeCompare(b, "pt-BR"))
    .map((packageName) => `<option value="${escapeHtml(packageName)}"></option>`)
    .join("");
}

function renderBoard() {
  const filteredDeliverables = getFilteredDeliverables();

  board.innerHTML = phases
    .map((phase) => {
      const phaseTotal = state.deliverables.filter((deliverable) => deliverable.phaseId === phase.id).length;
      const packages = groupDeliverablesByPackage(phase.id, filteredDeliverables);
      const packageMarkup = packages.map((item) => renderPackage(item.packageName, item.deliverables, phase.id)).join("");

      return `
        <section class="phase-column" aria-labelledby="${phase.id}-title">
          <div class="phase-header">
            <div>
              <h3 id="${phase.id}-title">${phase.name}</h3>
              <p>${phaseTotal} entregavel${phaseTotal === 1 ? "" : "eis"}</p>
            </div>
            <span class="phase-count">${phaseTotal}</span>
          </div>
          <div class="package-list">
            ${packageMarkup || `<div class="empty-state">Sem entregaveis nessa fase.</div>`}
            <button class="inline-add" type="button" data-add-phase="${phase.id}">+ Adicionar nesta fase</button>
          </div>
        </section>
      `;
    })
    .join("");
}

function renderPackage(packageName, deliverables, phaseId) {
  const done = deliverables.filter((deliverable) => deliverable.status === "done").length;

  return `
    <section class="package">
      <div class="package-header">
        <h3 class="package-title">${escapeHtml(packageName)}</h3>
        <span class="package-meta">${done}/${deliverables.length}</span>
      </div>
      ${
        deliverables.length
          ? `<div class="deliverable-list">${deliverables.map(renderDeliverableCard).join("")}</div>`
          : `<div class="empty-state">Nenhum item visivel com o filtro atual.</div>`
      }
      <button class="inline-add" type="button" data-add-phase="${phaseId}" data-add-package="${escapeHtml(packageName)}">+ Item</button>
    </section>
  `;
}

function renderDeliverableCard(deliverable) {
  const status = statusConfig[deliverable.status] ?? statusConfig["not-started"];
  const dueDate = deliverable.dueDate ? formatDate(deliverable.dueDate) : "Sem prazo";
  const owner = deliverable.owner ? escapeHtml(deliverable.owner) : "Sem responsavel";

  return `
    <article class="deliverable-card" data-edit-id="${deliverable.id}" tabindex="0">
      <div class="deliverable-title">${escapeHtml(deliverable.title)}</div>
      <div class="owner">${owner}</div>
      <div class="card-footer">
        <span class="status-pill ${status.className}">${status.label}</span>
        <span class="due">${dueDate}</span>
      </div>
      <div class="quick-row">
        <select class="quick-status" data-status-id="${deliverable.id}" aria-label="Alterar status">
          ${Object.entries(statusConfig)
            .map(
              ([value, config]) =>
                `<option value="${value}" ${value === deliverable.status ? "selected" : ""}>${config.label}</option>`,
            )
            .join("")}
        </select>
      </div>
    </article>
  `;
}

function formatDate(value) {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }
  return `${day}/${month}/${year}`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderAll() {
  renderAuthState();
  renderMetrics();
  renderPackageOptions();
  renderBoard();
}

function openDialog(deliverable = null, defaults = {}) {
  editingId = deliverable?.id ?? null;
  dialogTitle.textContent = editingId ? "Editar entregavel" : "Novo entregavel";
  deleteButton.hidden = !editingId;

  form.reset();
  document.querySelector("#titleInput").value = deliverable?.title ?? "";
  phaseInput.value = deliverable?.phaseId ?? defaults.phaseId ?? phases[0].id;
  packageInput.value = deliverable?.packageName ?? defaults.packageName ?? "";
  document.querySelector("#statusInput").value = deliverable?.status ?? "not-started";
  document.querySelector("#dueDateInput").value = deliverable?.dueDate ?? "";
  document.querySelector("#ownerInput").value = deliverable?.owner ?? "";
  document.querySelector("#notesInput").value = deliverable?.notes ?? "";

  dialogBackdrop.hidden = false;
  dialog.hidden = false;
  document.body.classList.add("modal-open");
  document.querySelector("#titleInput").focus();
}

function closeDialog() {
  dialog.hidden = true;
  dialogBackdrop.hidden = true;
  document.body.classList.remove("modal-open");
  editingId = null;
}

function formPayload() {
  const formData = new FormData(form);

  return {
    title: String(formData.get("title")).trim(),
    phaseId: String(formData.get("phaseId")),
    packageName: String(formData.get("packageName")).trim(),
    status: String(formData.get("status")),
    dueDate: String(formData.get("dueDate")),
    owner: String(formData.get("owner")).trim(),
    notes: String(formData.get("notes")).trim(),
  };
}

async function handleSubmit(event) {
  event.preventDefault();
  const payload = formPayload();

  if (!payload.title || !payload.packageName) {
    return;
  }

  try {
    setStatus("Salvando...");
    if (editingId) {
      const updated = await updateDeliverable(editingId, payload);
      state.deliverables = state.deliverables.map((deliverable) =>
        deliverable.id === editingId ? updated : deliverable,
      );
    } else {
      const created = await insertDeliverable(payload);
      state.deliverables.push(created);
    }

    closeDialog();
    setStatus("Online", "online");
    renderAll();
  } catch (error) {
    setStatus("Erro de sync", "error");
    window.alert(error.message);
  }
}

async function removeEditingDeliverable() {
  if (!editingId) {
    return;
  }

  const deliverable = state.deliverables.find((item) => item.id === editingId);
  const confirmed = window.confirm(`Excluir "${deliverable?.title ?? "este entregavel"}"?`);
  if (!confirmed) {
    return;
  }

  try {
    setStatus("Excluindo...");
    await deleteDeliverable(editingId);
    state.deliverables = state.deliverables.filter((item) => item.id !== editingId);
    closeDialog();
    setStatus("Online", "online");
    renderAll();
  } catch (error) {
    setStatus("Erro de sync", "error");
    window.alert(error.message);
  }
}

async function updateStatus(id, status) {
  const deliverable = state.deliverables.find((item) => item.id === id);
  if (!deliverable) {
    return;
  }

  const nextDeliverable = { ...deliverable, status };
  state.deliverables = state.deliverables.map((item) => (item.id === id ? nextDeliverable : item));
  renderAll();

  try {
    setStatus("Salvando...");
    const updated = await updateDeliverable(id, nextDeliverable);
    state.deliverables = state.deliverables.map((item) => (item.id === id ? updated : item));
    setStatus("Online", "online");
    renderAll();
  } catch (error) {
    setStatus("Erro de sync", "error");
    window.alert(error.message);
    await loadRemoteDeliverables({ seedIfEmpty: false });
  }
}

function exportData() {
  const data = JSON.stringify(state.deliverables, null, 2);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `quality-deliverables-${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
}

async function resetBase() {
  const confirmed = window.confirm("Restaurar a base inicial? Seus ajustes online serao substituidos.");
  if (!confirmed) {
    return;
  }

  try {
    setStatus("Restaurando...");
    await resetRemoteBase();
    setStatus("Online", "online");
  } catch (error) {
    setStatus("Erro de sync", "error");
    window.alert(error.message);
  }
}

async function handleSignIn(event) {
  event.preventDefault();
  const formData = new FormData(authForm);
  const email = String(formData.get("email")).trim();
  const password = String(formData.get("password"));

  try {
    setAuthMessage("Entrando...");
    const nextSession = await signIn(email, password);
    saveSession(nextSession);
    setAuthMessage("");
    renderAuthState();
    await loadRemoteDeliverables();
  } catch (error) {
    setAuthMessage(friendlyAuthError(error), "error");
  }
}

async function handleSignUp() {
  const formData = new FormData(authForm);
  const email = String(formData.get("email")).trim();
  const password = String(formData.get("password"));

  if (!email || password.length < 6) {
    setAuthMessage("Informe e-mail e senha com pelo menos 6 caracteres.", "error");
    return;
  }

  try {
    setAuthMessage("Criando conta...");
    const nextSession = await signUp(email, password);
    if (nextSession.access_token) {
      saveSession(nextSession);
      setAuthMessage("");
      renderAuthState();
      await loadRemoteDeliverables();
    } else {
      setAuthMessage("Conta criada. Verifique seu e-mail antes de entrar.", "success");
    }
  } catch (error) {
    setAuthMessage(friendlyAuthError(error), "error");
  }
}

function signOut() {
  saveSession(null);
  state = { deliverables: [] };
  renderAll();
}

function bindEvents() {
  authForm.addEventListener("submit", handleSignIn);
  document.querySelector("#githubSignInButton").addEventListener("click", signInWithGitHub);
  document.querySelector("#signUpButton").addEventListener("click", handleSignUp);
  document.querySelector("#togglePasswordButton").addEventListener("click", () => {
    const passwordInput = document.querySelector("#authPassword");
    const toggleButton = document.querySelector("#togglePasswordButton");
    const shouldShow = passwordInput.type === "password";

    passwordInput.type = shouldShow ? "text" : "password";
    toggleButton.textContent = shouldShow ? "Ocultar" : "Mostrar";
    toggleButton.setAttribute("aria-label", shouldShow ? "Ocultar senha" : "Mostrar senha");
  });
  signOutButton.addEventListener("click", signOut);
  document.querySelector("#newDeliverableButton").addEventListener("click", () => openDialog());
  document.querySelector("#exportButton").addEventListener("click", exportData);
  document.querySelector("#resetButton").addEventListener("click", resetBase);
  document.querySelector("#closeDialogButton").addEventListener("click", closeDialog);
  document.querySelector("#cancelButton").addEventListener("click", closeDialog);
  deleteButton.addEventListener("click", removeEditingDeliverable);
  form.addEventListener("submit", handleSubmit);
  searchInput.addEventListener("input", renderBoard);

  statusFilters.addEventListener("click", (event) => {
    const button = event.target.closest("[data-status]");
    if (!button) {
      return;
    }
    activeStatus = button.dataset.status;
    statusFilters.querySelectorAll(".segment").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderBoard();
  });

  board.addEventListener("click", (event) => {
    const quickStatus = event.target.closest("[data-status-id]");
    if (quickStatus) {
      return;
    }

    const addButton = event.target.closest("[data-add-phase]");
    if (addButton) {
      openDialog(null, {
        phaseId: addButton.dataset.addPhase,
        packageName: addButton.dataset.addPackage ?? "",
      });
      return;
    }

    const card = event.target.closest("[data-edit-id]");
    if (card) {
      const deliverable = state.deliverables.find((item) => item.id === card.dataset.editId);
      if (deliverable) {
        openDialog(deliverable);
      }
    }
  });

  board.addEventListener("change", (event) => {
    const quickStatus = event.target.closest("[data-status-id]");
    if (!quickStatus) {
      return;
    }
    updateStatus(quickStatus.dataset.statusId, quickStatus.value);
  });

  board.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") {
      return;
    }

    const card = event.target.closest("[data-edit-id]");
    if (!card) {
      return;
    }
    const deliverable = state.deliverables.find((item) => item.id === card.dataset.editId);
    if (deliverable) {
      openDialog(deliverable);
    }
  });

  dialogBackdrop.addEventListener("click", (event) => {
    if (event.target === dialogBackdrop) {
      closeDialog();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !dialog.hidden) {
      closeDialog();
    }
  });
}

async function init() {
  renderPhaseOptions();
  bindEvents();
  await consumeOAuthRedirect();
  renderAuthState();

  if (session?.access_token) {
    try {
      await loadRemoteDeliverables();
    } catch (error) {
      setAuthMessage(friendlyAuthError(error), "error");
      renderAuthState();
    }
  }
}

init();
