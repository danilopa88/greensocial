let volunteers = [];
let editingVolunteerId = null;
let currentUserRole = null;
let currentUserEmail = null;
let currentUserId = null; // Guardar o ID real do banco

let posts = [];
let expandedComments = new Set();
let editingPostId = null;
let editingCommentId = null; 
let currentAccessId = localStorage.getItem("greensocial_current_access_id") || null;
let cropper = null; // Instância do Cropper.js

// Prevenção de XSS: Escapar caracteres especiais
function escapeHTML(str) {
    if (!str) return "";
    return str.toString()
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

let loginOverlay, appContainer; // Elementos globais de UI
const API_BASE = '/api';

/**
 * Retorna a URL do avatar (se existir) ou gera um dinâmico com cores Greensocial.
 */
function getAvatarUrl(name, avatarUrl) {
    if (avatarUrl) return avatarUrl;
    return `https://ui-avatars.com/api/?name=${encodeURIComponent(name || 'User')}&background=22c55e&color=fff`;
}

document.addEventListener("DOMContentLoaded", async () => {
    initNavigation();

    await loadInitialData();

    initAuthFlow();
    initExcelExport();
    initPostEvent();
    initModalEvents();
    initAvatarUpload();
    initClickOutside();
    initAccessLogEvents();
});

function initAccessLogEvents() {
    window.addEventListener('beforeunload', () => {
        if (currentAccessId) {
            // Tentativa de logoff ao fechar aba (melhor esforço)
            const url = `${API_BASE}/access/logoff/${currentAccessId}`;
            if (navigator.sendBeacon) {
                // sendBeacon só faz POST, então vamos adaptar ou usar fetch keepalive
                fetch(url, { method: 'PUT', keepalive: true });
            }
        }
    });
}

function initClickOutside() {
    window.addEventListener('click', (e) => {
        // Fecha dropdown de comentário se clicar fora
        if (!e.target.closest('.comment-options-container')) {
            document.querySelectorAll('.comment-options-dropdown').forEach(d => d.classList.remove('open'));
        }
    });
}

async function loadInitialData() {
    try {
        const volsRes = await fetch(`${API_BASE}/volunteers`);
        if (volsRes.ok) volunteers = await volsRes.json();

        // Passamos o ID do usuário logado para saber o que ele curtiu
        const userIdParam = currentUserId ? `?user_id=${currentUserId}` : '';
        const postsRes = await fetch(`${API_BASE}/posts${userIdParam}`);
        if (postsRes.ok) posts = await postsRes.json();

        renderPosts();
        renderVolunteers();
    } catch (err) {
        console.error("Erro carregando banco:", err);
    }
}

// Authentication & Session Logic
function initAuthFlow() {
    loginOverlay = document.getElementById("login-container");
    appContainer = document.getElementById("app-container");
    const loginForm = document.getElementById("form-login");
    const loginError = document.getElementById("login-error");
    const btnLogoff = document.getElementById("btn-logoff");

    const sessionEmail = localStorage.getItem("greensocial_session_email");
    const sessionRole = localStorage.getItem("greensocial_session_role");
    const sessionId = localStorage.getItem("greensocial_session_id");

    if (sessionEmail && sessionRole && sessionId) {
        loginAs(sessionEmail, sessionRole, sessionId);
    } else {
        loginOverlay.classList.add("active");
        appContainer.style.display = "none";
    }

    loginForm.addEventListener("submit", async (e) => {
        e.preventDefault();
        const emailInput = document.getElementById("login-email").value.trim().toLowerCase();

        // Auto-cria o admin se for primeira vez
        if (emailInput === "admin@greensocial.org") {
            let admin = volunteers.find(v => v.email === "admin@greensocial.org");
            if (!admin) {
                const res = await fetch(`${API_BASE}/volunteers`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ name: "Administrador Central", email: "admin@greensocial.org", skills: "Gestão do Sistema", status: "Ativo" })
                });
                admin = await res.json();
                await loadInitialData();
            }
            loginError.style.display = "none";
            loginAs(emailInput, "ADMIN", admin.id);
            return;
        }

        const existingVol = volunteers.find(v => v.email.toLowerCase() === emailInput);
        if (existingVol) {
            if (existingVol.status === "Inativo") {
                loginError.innerText = "Sua conta está inativa. Entre em contato com o administrador.";
                loginError.style.display = "block";
                return;
            }
            loginError.style.display = "none";
            loginAs(emailInput, "VOLUNTARIO", existingVol.id);
        } else {
            loginError.innerText = "Email não encontrado.";
            loginError.style.display = "block";
        }
    });

    btnLogoff.addEventListener("click", async (e) => {
        e.preventDefault();
        if (currentAccessId) await logAccessLogoff();
        localStorage.removeItem("greensocial_session_email");
        localStorage.removeItem("greensocial_session_role");
        localStorage.removeItem("greensocial_session_id");
        localStorage.removeItem("greensocial_current_access_id");
        currentUserEmail = null;
        currentUserRole = null;
        currentUserId = null;
        currentAccessId = null;

        appContainer.style.display = "none";
        loginOverlay.classList.add("active");
        loginForm.reset();
    });
}

async function logAccessLogin(userId) {
    try {
        const res = await fetch(`${API_BASE}/access/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ volunteer_id: userId })
        });
        const data = await res.json();
        if (data.success) {
            currentAccessId = data.accessId;
            localStorage.setItem("greensocial_current_access_id", currentAccessId);
        }
    } catch (err) {
        console.error("Erro ao registrar login:", err);
    }
}

async function logAccessLogoff() {
    if (!currentAccessId) return;
    try {
        await fetch(`${API_BASE}/access/logoff/${currentAccessId}`, {
            method: 'PUT'
        });
        currentAccessId = null;
        localStorage.removeItem("greensocial_current_access_id");
    } catch (err) {
        console.error("Erro ao registrar logoff:", err);
    }
}

function loginAs(email, role, id) {
    currentUserEmail = email;
    currentUserRole = role;
    currentUserId = parseInt(id, 10);

    localStorage.setItem("greensocial_session_email", email);
    localStorage.setItem("greensocial_session_role", role);
    localStorage.setItem("greensocial_session_id", id);

    // Auditoria: Registrar login se for uma nova sessão
    if (!currentAccessId) {
        logAccessLogin(id);
    }

    loginOverlay.classList.remove("active");
    appContainer.style.display = "flex";

    let userNameStr = "Administrador Central";
    let volBio = "Sempre pronto para ajudar e liderar o engajamento na plataforma.";
    let volSkills = "Gestão Global, Liderança Técnica";

    const vol = volunteers.find(v => v.id === currentUserId);
    if (vol) {
        userNameStr = vol.name;
        volSkills = vol.skills || "Nenhuma listada";
        if (role === "VOLUNTARIO") {
            volBio = "Contribuindo ativamente para a nossa comunidade.";
        }
    }

    document.getElementById('current-user-name').innerText = userNameStr;
    const avatarEl = document.getElementById('current-user-avatar');
    if (avatarEl) {
        avatarEl.src = getAvatarUrl(userNameStr, vol ? vol.avatar_url : null);
    }

    // Set My Profile View Data
    document.getElementById('my-profile-name').innerText = userNameStr;
    document.getElementById('my-profile-bio').innerText = volBio;
    document.getElementById('my-profile-email').value = email;
    document.getElementById('my-profile-skills').value = volSkills;
    const profileAvatarEl = document.getElementById('my-profile-avatar');
    if (profileAvatarEl) {
        profileAvatarEl.src = getAvatarUrl(userNameStr, vol ? vol.avatar_url : null);
    }

    // Atualiza também o avatar na caixa de nova postagem no Feed
    const postBoxAvatar = document.querySelector('.new-post-box .avatar');
    if (postBoxAvatar) {
        postBoxAvatar.src = getAvatarUrl(userNameStr, vol ? vol.avatar_url : null);
    }

    const adminTab = document.querySelector('.nav-links a[data-target="admin"]');
    if (adminTab && adminTab.parentElement) {
        if (role === "VOLUNTARIO") {
            adminTab.parentElement.style.display = 'none';
            if (document.getElementById('view-admin').classList.contains('active')) {
                document.querySelector('.nav-links a[data-target="feed"]').click();
            }
        } else {
            adminTab.parentElement.style.display = 'block';
        }
    }

    renderVolunteers();
    renderPosts(); // Re-render para garantir nomes/avatares
}

// Export Excel Logic
function initExcelExport() {
    const btnExport = document.getElementById("btn-export-excel");
    if (!btnExport) return;

    btnExport.addEventListener("click", () => {
        if (!volunteers || volunteers.length === 0) {
            alert("Não há dados de voluntários para exportar.");
            return;
        }
        const formattedData = volunteers.map(v => ({
            "ID do Sistema": v.id,
            "Nome Completo": v.name,
            "E-mail": v.email,
            "Telefone": v.phone || '',
            "Data de Nascimento": v.birth_date || '',
            "Habilidades": v.skills,
            "Situação": v.status
        }));
        const worksheet = XLSX.utils.json_to_sheet(formattedData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Voluntarios");
        XLSX.writeFile(workbook, "relatorio_voluntarios_greensocial.xlsx");
    });
}

function initNavigation() {
    const navLinks = document.querySelectorAll(".nav-links a");
    const sections = document.querySelectorAll(".view-section");

    navLinks.forEach(link => {
        link.addEventListener("click", (e) => {
            e.preventDefault();
            navLinks.forEach(l => l.classList.remove("active"));
            sections.forEach(s => s.classList.remove("active"));

            link.classList.add("active");
            const targetId = `view-${link.getAttribute("data-target")}`;
            document.getElementById(targetId).classList.add("active");
        });
    });
}

function renderPosts() {
    const container = document.getElementById("posts-container");
    container.innerHTML = "";

    posts.forEach(post => {
        const postAvatar = getAvatarUrl(post.author, post.author_avatar);
        const postEl = document.createElement("div");
        postEl.className = "post-card";

        let mediaHtml = "";
        if (post.media_items && post.media_items.length > 0) {
            let numItems = post.media_items.length;
            let gridClass = `items-${numItems > 4 ? 4 : numItems}`;

            let itemsHtml = post.media_items.map((item, index) => {
                if (numItems > 4 && index > 3) return "";
                let overlay = (numItems > 4 && index === 3) ? `<div style="position: absolute; inset:0; background:rgba(0,0,0,0.5); display:flex; align-items:center; justify-content:center; color:white; font-size:1.5rem; font-weight:bold;">+${numItems - 3}</div>` : "";

                let tag = item.type === "video"
                    ? `<video src="${item.url}" class="${numItems === 1 ? 'post-media-single' : 'post-media-multi'}" controls></video>`
                    : `<img src="${item.url}" class="${numItems === 1 ? 'post-media-single' : 'post-media-multi'}">`;

                if (overlay) return `<div style="position:relative; width: 100%; height: 100%; overflow: hidden;">${tag}${overlay}</div>`;
                return tag;
            }).join("");

            mediaHtml = `<div class="post-media-grid ${gridClass}">${itemsHtml}</div>`;
        }

        const isMe = post.author_id === currentUserId;
        let isEditing = editingPostId === post.id;

        let contentHtml = isEditing && isMe ? `
            <textarea id="edit-input-${post.id}" class="edit-post-textarea">${escapeHTML(post.content)}</textarea>
            <div class="edit-actions">
                <button class="btn-secondary" onclick="cancelEdit()">Cancelar</button>
                <button class="btn-primary" onclick="saveEdit(${post.id})">Salvar Mudanças</button>
            </div>
        ` : `
            <div class="post-content">
                ${escapeHTML(post.content)}
                ${mediaHtml}
            </div>
        `;

        let actionsHtml = "";
        const isAdmin = currentUserRole === "ADMIN";
        
        // Agora ADMIN pode deletar qualquer post, mas só o autor pode EDITAR
        if (!isEditing) {
            if (isMe) {
                actionsHtml = `
                <div class="post-header-actions">
                    <button class="btn-icon-only" title="Editar" onclick="editPost(${post.id})"><i class="fa-solid fa-pen"></i></button>
                    <button class="btn-icon-only" style="color: #ef4444;" title="Remover" onclick="deletePost(${post.id})"><i class="fa-solid fa-trash"></i></button>
                </div>
                `;
            } else if (isAdmin) {
                actionsHtml = `
                <div class="post-header-actions">
                    <button class="btn-icon-only" style="color: #ef4444;" title="Remover por Moderação" onclick="deletePost(${post.id})"><i class="fa-solid fa-trash"></i></button>
                </div>
                `;
            }
        }

        let commentsCount = post.comments ? post.comments.length : 0;

        const heartIcon = post.liked_by_me ? 'fa-solid fa-heart' : 'fa-regular fa-heart';
        const heartColor = post.liked_by_me ? 'color: #ef4444;' : '';

        let feedbackBlock = isEditing ? "" : `
            <div class="post-actions">
                <button class="action-btn" onclick="toggleLike(${post.id})" style="${heartColor}">
                    <i class="${heartIcon}"></i>
                    <span>${post.likes || 0} Curtidas</span>
                </button>
                <button class="action-btn" onclick="toggleComments(${post.id})">
                    <i class="fa-regular fa-comment"></i>
                    <span>${commentsCount > 0 ? commentsCount + ' Comentários' : 'Comentar'}</span>
                </button>
            </div>
        `;

        let commentsHtml = "";
        if (!isEditing && expandedComments.has(post.id)) {
            let renderedComments = (post.comments || []).map(c => {
                const isMyComment = c.author_email === currentUserEmail;
                const canManageComment = isMyComment || isAdmin;
                const isEditingComment = editingCommentId === c.id;

                let commentActionsHtml = "";
                if (canManageComment && !isEditingComment) {
                    commentActionsHtml = `
                    <div class="comment-options-container">
                        <button class="btn-icon-only-small" onclick="toggleCommentOptions(${c.id})">
                            <i class="fa-solid fa-ellipsis-vertical"></i>
                        </button>
                        <div id="comment-dropdown-${c.id}" class="comment-options-dropdown">
                            <button onclick="editComment(${c.id})"><i class="fa-solid fa-pen"></i> Editar</button>
                            <button class="delete-option" onclick="deleteComment(${c.id})"><i class="fa-solid fa-trash"></i> Excluir</button>
                        </div>
                    </div>
                    `;
                }

                let commentTextHtml = isEditingComment ? `
                    <textarea id="comment-edit-input-${c.id}" class="edit-comment-textarea">${escapeHTML(c.text)}</textarea>
                    <div class="edit-actions" style="margin-bottom:0;">
                        <button class="btn-secondary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="cancelCommentEdit()">Cancelar</button>
                        <button class="btn-primary" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;" onclick="saveCommentEdit(${c.id})">Salvar</button>
                    </div>
                ` : `<span class="comment-text">${escapeHTML(c.text)}</span>`;

                return `
                <div class="comment-item">
                    <img src="${getAvatarUrl(c.author, c.author_avatar)}" alt="Avatar" class="avatar">
                    <div class="comment-body" style="flex:1;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <span class="comment-author">${escapeHTML(c.author)}${isMyComment ? ' <span style="opacity:0.6;font-size:0.8rem">(Você)</span>' : ''}</span>
                            ${commentActionsHtml}
                        </div>
                        ${commentTextHtml}
                    </div>
                </div>
                `;
            }).join("");

            commentsHtml = `
                <div class="comments-section">
                    ${renderedComments}
                    <div class="comment-input-box">
                        <input type="text" id="comment-input-${post.id}" placeholder="Escreva um comentário ..." onkeypress="checkCommentEnter(event, ${post.id})">
                        <button onclick="addComment(${post.id})">Enviar</button>
                    </div>
                </div>
            `;
        }

        const displayAuthor = isMe ? `${escapeHTML(post.author)} <span style="opacity:0.6;font-size:0.8rem;">(Você)</span>` : escapeHTML(post.author);

        postEl.innerHTML = `
            <div class="post-header">
                <img src="${postAvatar}" alt="Avatar" class="avatar">
                <div>
                    <div class="post-author">${displayAuthor}</div>
                    <div class="post-time">${escapeHTML(post.time)}</div>
                </div>
                ${actionsHtml}
            </div>
            ${contentHtml}
            ${feedbackBlock}
            ${commentsHtml}
        `;
        container.appendChild(postEl);
    });
}

window.editPost = function (id) {
    editingPostId = id;
    renderPosts();
};

window.cancelEdit = function () {
    editingPostId = null;
    renderPosts();
};

window.saveEdit = async function (id) {
    const input = document.getElementById(`edit-input-${id}`);
    if (input) {
        const content = input.value.trim();
        await fetch(`${API_BASE}/posts/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content })
        });
        editingPostId = null;
        await loadInitialData();
    }
};

window.deletePost = async function (id) {
    if (confirm("Você tem certeza que deseja excluir esta postagem para sempre?")) {
        await fetch(`${API_BASE}/posts/${id}`, { method: 'DELETE' });
        await loadInitialData();
    }
};

window.toggleLike = async function (postId) {
    if (!currentUserId) return;
    
    await fetch(`${API_BASE}/posts/${postId}/toggle-like`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: currentUserId })
    });
    await loadInitialData();
};

window.toggleComments = function (postId) {
    if (expandedComments.has(postId)) {
        expandedComments.delete(postId);
    } else {
        expandedComments.add(postId);
    }
    renderPosts();
};

window.addComment = async function (postId) {
    const input = document.getElementById(`comment-input-${postId}`);
    if (input && input.value.trim() !== "") {
        await fetch(`${API_BASE}/posts/${postId}/comments`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ author_id: currentUserId, text: input.value.trim() })
        });
        input.value = "";
        await loadInitialData();
    }
};

window.deleteComment = async function (id) {
    if (confirm("Deseja apagar este comentário?")) {
        await fetch(`${API_BASE}/comments/${id}`, { method: 'DELETE' });
        await loadInitialData();
    }
};

window.toggleCommentOptions = function (commentId) {
    const dropdown = document.getElementById(`comment-dropdown-${commentId}`);
    const isOpen = dropdown.classList.contains('open');
    
    // Fecha outros abertos
    document.querySelectorAll('.comment-options-dropdown').forEach(d => d.classList.remove('open'));
    
    if (!isOpen) {
        dropdown.classList.add('open');
    }
};

window.editComment = function (commentId) {
    editingCommentId = commentId;
    document.querySelectorAll('.comment-options-dropdown').forEach(d => d.classList.remove('open'));
    renderPosts();
};

window.cancelCommentEdit = function () {
    editingCommentId = null;
    renderPosts();
};

window.saveCommentEdit = async function (id) {
    const input = document.getElementById(`comment-edit-input-${id}`);
    if (input) {
        const text = input.value.trim();
        if (text === "") return;
        
        await fetch(`${API_BASE}/comments/${id}`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text })
        });
        editingCommentId = null;
        await loadInitialData();
    }
};

window.checkCommentEnter = function (e, postId) {
    if (e.key === "Enter") {
        window.addComment(postId);
    }
};

function initPostEvent() {
    const input = document.getElementById("new-post-input");
    const btnPublish = document.getElementById("btn-publish");
    const btnAddMedia = document.getElementById("btn-add-media");
    const mediaUpload = document.getElementById("media-upload");
    const previewContainer = document.getElementById("media-preview-container");

    let currentMediaItems = [];

    if (btnAddMedia) {
        btnAddMedia.addEventListener("click", () => mediaUpload.click());
    }

    if (mediaUpload) {
        mediaUpload.addEventListener("change", (e) => {
            const files = Array.from(e.target.files);
            if (files.length === 0) return;
            files.forEach(file => {
                currentMediaItems.push({
                    url: URL.createObjectURL(file),
                    fileData: file,
                    type: file.type.startsWith('video/') ? "video" : "image"
                });
            });
            renderPreviews();
        });
    }

    function renderPreviews() {
        if (currentMediaItems.length === 0) {
            previewContainer.style.display = "none";
            return;
        }
        previewContainer.style.display = "flex";
        previewContainer.innerHTML = "";
        currentMediaItems.forEach((item, index) => {
            const el = document.createElement("div");
            el.className = "preview-item";
            let mediaTag = item.type === "video" ? `<video src="${item.url}" muted></video>` : `<img src="${item.url}">`;
            el.innerHTML = `${mediaTag}<button class="preview-remove-btn" type="button" data-index="${index}"><i class="fa-solid fa-xmark"></i></button>`;
            previewContainer.appendChild(el);
        });
        previewContainer.querySelectorAll(".preview-remove-btn").forEach(btn => {
            btn.addEventListener("click", (e) => {
                const idx = parseInt(e.currentTarget.getAttribute("data-index"));
                currentMediaItems.splice(idx, 1);
                renderPreviews();
                mediaUpload.value = "";
            });
        });
    }

    btnPublish.addEventListener("click", async () => {
        const content = input.value.trim();
        if (content || currentMediaItems.length > 0) {
            const formData = new FormData();
            formData.append('author_id', currentUserId);
            formData.append('time', "Agora mesmo");
            formData.append('content', content);
            currentMediaItems.forEach(item => {
                formData.append('media', item.fileData);
            });
            await fetch(`${API_BASE}/posts`, {
                method: 'POST',
                body: formData
            });
            input.value = "";
            currentMediaItems = [];
            renderPreviews();
            if (mediaUpload) mediaUpload.value = "";
            await loadInitialData();
        }
    });

    input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") btnPublish.click();
    });
}

function renderVolunteers() {
    const tbody = document.getElementById("volunteers-table-body");
    tbody.innerHTML = "";
    volunteers.forEach(vol => {
        const tr = document.createElement("tr");
        const statusClass = vol.status === "Ativo" ? "active" : "inactive";
        const volAvatar = getAvatarUrl(vol.name, vol.avatar_url);
        let removeAction = currentUserRole === "ADMIN" ? `<a href="#" class="action-link" style="color: #ef4444;" onclick="deleteVolunteer(${vol.id})">Remover</a>` : "";
        tr.innerHTML = `
            <td>
                <div style="display: flex; align-items: center; gap: 10px;">
                    <img src="${volAvatar}" style="width:32px; height:32px; border-radius:50%">
                    <span style="font-weight: 500">${escapeHTML(vol.name)}</span>
                </div>
            </td>
            <td>${escapeHTML(vol.email)}</td>
            <td class="skills-list">${escapeHTML(vol.skills)}</td>
            <td><span class="badge ${statusClass}">${escapeHTML(vol.status)}</span></td>
            <td>
                <a href="#" class="action-link" onclick="openEditVolunteerModal(${vol.id})">Editar</a>
                ${removeAction}
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.openEditVolunteerModal = function (id) {
    editingVolunteerId = id;
    const vol = volunteers.find(v => v.id === id);
    if (!vol) return;
    document.getElementById("modal-title").innerText = "Editar Voluntário";
    document.getElementById("vol-name").value = vol.name;
    document.getElementById("vol-email").value = vol.email;
    document.getElementById("vol-skills").value = vol.skills;
    document.getElementById("vol-phone").value = vol.phone || '';
    document.getElementById("vol-birth-date").value = vol.birth_date || '';
    const statusSelect = document.getElementById("vol-status");
    if (statusSelect) statusSelect.value = vol.status;
    document.getElementById("modal-add-volunteer").classList.add("open");
};

window.deleteVolunteer = async function (id) {
    if (currentUserRole !== 'ADMIN') return;
    if (confirm("Tem certeza que deseja remover este usuário permanentemente do banco?")) {
        await fetch(`${API_BASE}/volunteers/${id}`, { method: 'DELETE' });
        await loadInitialData();
    }
};

function initModalEvents() {
    const modal = document.getElementById("modal-add-volunteer");
    const btnOpen = document.getElementById("btn-add-volunteer");
    const btnClose = document.getElementById("btn-close-modal");
    const form = document.getElementById("form-add-volunteer");
    btnOpen.addEventListener("click", () => {
        editingVolunteerId = null;
        form.reset();
        document.getElementById("modal-title").innerText = "Cadastrar Novo Voluntário";
        modal.classList.add("open");
    });
    btnClose.addEventListener("click", () => modal.classList.remove("open"));
    modal.addEventListener("click", (e) => {
        if (e.target === modal) modal.classList.remove("open");
    });
    form.addEventListener("submit", async (e) => {
        e.preventDefault();
        const name = document.getElementById("vol-name").value.trim();
        const email = document.getElementById("vol-email").value.trim();
        const skills = document.getElementById("vol-skills").value.trim() || "Geral";
        const statusSelect = document.getElementById("vol-status");
        const status = statusSelect ? statusSelect.value : "Ativo";
        const phone = document.getElementById("vol-phone").value.trim() || null;
        const birth_date = document.getElementById("vol-birth-date").value.trim() || null;

        // Validação de telefone
        if (phone && !/^\d{2}-\d{8,9}$/.test(phone)) {
            alert('Formato de telefone inválido. Use: XX-XXXXXXXX ou XX-XXXXXXXXX');
            return;
        }
        // Validação de data de nascimento
        if (birth_date && !/^\d{2}\/\d{2}\/\d{4}$/.test(birth_date)) {
            alert('Formato de data inválido. Use: DD/MM/AAAA');
            return;
        }

        if (editingVolunteerId) {
            await fetch(`${API_BASE}/volunteers/${editingVolunteerId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, skills, status, phone, birth_date })
            });
            editingVolunteerId = null;
        } else {
            await fetch(`${API_BASE}/volunteers`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name, email, skills, status, phone, birth_date })
            });
        }
        await loadInitialData();
        modal.classList.remove("open");
        form.reset();
        document.getElementById("modal-title").innerText = "Cadastrar Novo Voluntário";
    });
}

/**
 * Gerencia o upload de fotos de perfil (Avatar).
 */
function initAvatarUpload() {
    const avatarInput = document.getElementById("avatar-input");
    const cropModal = document.getElementById("modal-crop-avatar");
    const cropImage = document.getElementById("crop-image");

    if (!avatarInput || !cropModal || !cropImage) return;

    avatarInput.addEventListener("change", (e) => {
        const file = e.target.files[0];
        if (!file) return;

        if (file.size > 5 * 1024 * 1024) {
            alert("A imagem é muito grande. O limite é 5MB.");
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            cropImage.src = event.target.result;
            cropModal.classList.add("open");

            if (typeof Cropper === 'undefined') {
                alert("Erro: A ferramenta de recorte não foi carregada. Verifique sua conexão com a internet.");
                return;
            }

            if (cropper) cropper.destroy();
            
            // Inicializa o Cropper com proporção 1:1 e visual circular
            cropper = new Cropper(cropImage, {
                aspectRatio: 1,
                viewMode: 1,
                dragMode: 'move',
                guides: false,
                center: true,
                highlight: false,
                cropBoxMovable: true,
                cropBoxResizable: true,
                toggleDragModeOnDblclick: false,
            });
        };
        reader.readAsDataURL(file);
    });

    window.closeCropModal = () => {
        cropModal.classList.remove("open");
        if (cropper) cropper.destroy();
        avatarInput.value = "";
    };

    window.confirmCrop = () => {
        if (!cropper) return;

        // Gera o canvas do recorte
        const canvas = cropper.getCroppedCanvas({
            width: 400,
            height: 400,
        });

        canvas.toBlob(async (blob) => {
            const formData = new FormData();
            formData.append("avatar", blob, "avatar.jpg");

            try {
                if (!currentUserId) {
                    alert("Sessão inválida. Por favor, faça login novamente.");
                    return;
                }

                const uploadUrl = `${API_BASE}/volunteers/${currentUserId}/avatar`;
                console.log("Iniciando upload para:", uploadUrl, "Usuário ID:", currentUserId);

                const res = await fetch(uploadUrl, {
                    method: "POST",
                    body: formData
                });

                if (res.ok) {
                    const data = await res.json();
                    alert("Foto de perfil atualizada!");
                    
                    // Atualiza o voluntário atual na lista local
                    const vol = volunteers.find(v => v.id === currentUserId);
                    if (vol) vol.avatar_url = data.avatarUrl;

                    // Força atualização da UI (Sidebar, Posts, etc)
                    loginAs(currentUserEmail, currentUserRole, currentUserId);
                    window.closeCropModal();
                } else {
                    alert("Erro ao enviar a imagem.");
                }
            } catch (err) {
                console.error("Erro no upload do avatar:", err);
                alert("Erro técnico: " + err.message);
            }
        }, 'image/jpeg', 0.9);
    };
}
