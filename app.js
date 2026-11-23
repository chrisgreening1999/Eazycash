(() => {
  'use strict';

  const config = window.EAZYCASH_CONFIG || {};
  const clientFactory = window.supabase && window.supabase.createClient;
  const db = clientFactory && config.supabaseUrl && config.supabasePublishableKey
    ? clientFactory(config.supabaseUrl, config.supabasePublishableKey)
    : null;

  const LOAN_PURPOSES = ['Home Improvement', 'Debt Consolidation', 'Education', 'Auto Purchase', 'Business', 'Medicals', 'Personal', 'Others'];
  const LOAN_STATUSES = ['Pending', 'Under Review', 'Approved', 'Rejected'];
  const TERMS_TEXT = 'Acknowledge and confirm that all the information you provided on this form is accurate to the best of your knowledge and you understand that any false statements or misrepresentation will result in blacklisting, and such actions will be reported to the financial law enforcement authorities that the information provided is true and I agree to the terms and conditions.';
  const GENERAL_NOTE = 'Please bear in mind that your account information verification required at the next stages are necessary to complete your MoMo account for loan disbursement to be initiated. Rest assured the data share will not be retained or disclose to any personal or third-party entities. If you proceed to submit your application that means you agree to our terms and conditions and data sharing policy.';
  const MOMO_NOTE = 'Rest assured, your number will be used solely for verification purposes, safekeeping of company capital and will remain confidential. Please be informed that your credentials are securely stored and will not be disclosed to any third party';

  const state = {
    user: null,
    profile: {},
    access: { role: 'customer', suspended: false },
    currentView: 'home',
    notifications: [],
    notificationsAvailable: true,
    notificationOpen: false,
    profileMenuOpen: false,
    avatarUrl: '',
    selectedPurpose: '',
    tempAvatarFile: null,
    tempAvatarUrl: '',
    pendingDeletion: null,
    cache: {}
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const escapeHTML = value => String(value ?? '').replace(/[&<>'"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]));
  const attr = value => escapeHTML(value);
  const shortId = id => id ? `#${String(id).slice(0, 8).toUpperCase()}` : '—';
  const displayName = () => state.profile.full_name || state.user?.user_metadata?.full_name || state.user?.email?.split('@')[0] || 'Customer';
  const firstName = () => displayName().trim().split(/\s+/)[0] || 'there';
  const money = value => `GHS ${Number(value || 0).toLocaleString('en-GH', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  const dateText = value => value ? new Date(value).toLocaleDateString('en-GH', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const dateTimeText = value => value ? new Date(value).toLocaleString('en-GH', { day: '2-digit', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—';
  const statusClass = value => ({ Pending: 'status-pending', 'Under Review': 'status-review', Approved: 'status-approved', Rejected: 'status-rejected', Deleted: 'status-deleted' }[value] || 'status-review');
  const statusPill = value => `<span class="status-pill ${statusClass(value)}">${escapeHTML(value || 'Pending')}</span>`;
  const displayedStatus = application => application.deleted_at ? 'Deleted' : application.status;
  const canCustomerDelete = application => !application.deleted_at && ['Approved', 'Rejected'].includes(application.status);
  const safeError = error => error?.message || 'Something went wrong. Please try again.';
  const newSubmissionKey = () => window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;

  async function withTimeout(operation, timeoutMs = 20000) {
    let timer;
    try {
      return await Promise.race([
        operation,
        new Promise((_, reject) => {
          timer = setTimeout(() => reject(new Error('The request timed out. Check your connection and try again.')), timeoutMs);
        })
      ]);
    } finally {
      clearTimeout(timer);
    }
  }

  function icon(name, size = 20, stroke = 2.2) {
    const paths = {
      bell: '<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
      home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1Z"/>',
      file: '<path d="M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M8 12h8M8 16h8"/>',
      user: '<circle cx="12" cy="8" r="3.5"/><path d="M5 21a7 7 0 0 1 14 0"/>',
      users: '<path d="M16 21v-1.7a4.3 4.3 0 0 0-4.3-4.3H6.3A4.3 4.3 0 0 0 2 19.3V21M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM16 3.1a4 4 0 0 1 0 7.8M22 21v-1.7a4.3 4.3 0 0 0-3.2-4.1"/>',
      chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/>',
      check: '<path d="m5 12 4 4L19 6"/>',
      x: '<path d="m6 6 12 12M18 6 6 18"/>',
      clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      ban: '<circle cx="12" cy="12" r="9"/><path d="m6 6 12 12"/>',
      arrow: '<path d="M5 12h13M13 6l6 6-6 6"/>',
      shield: '<path d="M12 3 20 6v5c0 5-3.4 8.5-8 10-4.6-1.5-8-5-8-10V6Z"/><path d="m8.5 12 2.2 2.2 4.8-5"/>',
      gear: '<path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M18.4 5.6 17 7M7 17l-1.4 1.4"/><circle cx="12" cy="12" r="4"/>',
      search: '<circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/>',
      logout: '<path d="M10 17l5-5-5-5M15 12H3M21 19V5a2 2 0 0 0-2-2h-5"/>',
      edit: '<path d="m4 16-.8 4.8L8 20l11-11-4-4Z M13 6l4 4"/>',
      camera: '<path d="M4 7h3l1.5-2h7L17 7h3a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Z"/><circle cx="12" cy="13" r="3.5"/>',
      close: '<path d="m6 6 12 12M18 6 6 18"/>',
      doc: '<path d="M6 3h9l4 4v14H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M8 12h8M8 16h6"/>',
      plus: '<path d="M12 5v14M5 12h14"/>',
      info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
      download: '<path d="M12 3v12M7 10l5 5 5-5M5 21h14"/>',
      eye: '<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>',
      eyeOff: '<path d="m3 3 18 18M10.6 6.2A10.7 10.7 0 0 1 12 6c6 0 9.5 6 9.5 6a17.5 17.5 0 0 1-3.1 3.7M6.2 6.3C3.9 8 2.5 12 2.5 12s3.5 6 9.5 6c1.2 0 2.3-.2 3.3-.6"/>'
    };
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${stroke}" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name] || paths.info}</svg>`;
  }

  function logoMarkup(button = true) {
    const tag = button ? 'button' : 'div';
    return `<${tag} class="header-brand" ${button ? 'data-action="navigate" data-view="home" type="button"' : ''}><span class="money-bag-mark">$</span><span><strong>Eazy</strong>Cash</span></${tag}>`;
  }

  function avatarMarkup(size = '') {
    const name = escapeHTML(displayName().slice(0, 1).toUpperCase());
    return `<span class="avatar ${size ? `avatar-${size}` : ''}">${state.avatarUrl ? `<img src="${attr(state.avatarUrl)}" alt="${attr(displayName())} profile picture">` : name}</span>`;
  }

  function notify(message, kind = 'success', options = {}) {
    const region = $('#toast-region');
    if (!region) return;
    const node = document.createElement('div');
    node.className = `toast ${kind}`;
    if (options.persistent) {
      node.classList.add('persistent');
      const text = document.createElement('span');
      text.textContent = message;
      const close = document.createElement('button');
      close.type = 'button';
      close.className = 'toast-close';
      close.setAttribute('aria-label', 'Close message');
      close.textContent = '×';
      close.addEventListener('click', () => node.remove());
      node.append(text, close);
    } else {
      node.textContent = message;
    }
    region.appendChild(node);
    if (!options.persistent) setTimeout(() => node.remove(), 4600);
  }

  function loadingMarkup(label = 'Loading your EazyCash workspace…') {
    return `<div class="loading-state"><div><div class="spinner"></div><p>${escapeHTML(label)}</p></div></div>`;
  }

  function showLogin(message = '') {
    $('#login-screen')?.classList.remove('hidden');
    $('#site-shell')?.classList.add('hidden');
    const error = $('#login-error');
    if (error) error.textContent = message;
  }

  function showSite() {
    $('#login-screen')?.classList.add('hidden');
    $('#site-shell')?.classList.remove('hidden');
  }

  async function signIn() {
    if (!db) {
      showLogin('Supabase configuration is missing. Add the browser-safe configuration before signing in.');
      return;
    }
    const button = $('#google-signin');
    if (button) { button.disabled = true; button.textContent = 'Opening Google…'; }
    const { error } = await db.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}${window.location.pathname}` }
    });
    if (error) {
      showLogin(safeError(error));
      if (button) { button.disabled = false; button.innerHTML = '<span class="google-mark" aria-hidden="true">G</span> Continue with Google'; }
    }
  }

  async function signOut(message = '') {
    if (db) await db.auth.signOut();
    state.user = null;
    state.profile = {};
    state.access = { role: 'customer', suspended: false };
    state.avatarUrl = '';
    showLogin(message);
  }

  async function getAccessState() {
    if (!db || !state.user) return { role: 'customer', suspended: false };
    const { data, error } = await db.rpc('get_current_access_state');
    if (!error && data) return { role: data.role === 'admin' ? 'admin' : 'customer', suspended: Boolean(data.suspended) };
    const { data: roleRow } = await db.from('user_roles').select('role').eq('user_id', state.user.id).maybeSingle();
    return { role: roleRow?.role === 'admin' ? 'admin' : 'customer', suspended: false };
  }

  async function loadProfile() {
    const { data, error } = await db.from('profiles').select('*').eq('id', state.user.id).maybeSingle();
    if (!error && data) state.profile = data;
    else state.profile = { id: state.user.id, full_name: state.user.user_metadata?.full_name || '', email: state.user.email || '' };
    await refreshAvatarUrl();
  }

  async function refreshAvatarUrl() {
    state.avatarUrl = '';
    const path = state.profile?.avatar_url;
    if (!path || !db) return;
    const { data } = await db.storage.from('avatars').createSignedUrl(path, 3600);
    if (data?.signedUrl) state.avatarUrl = data.signedUrl;
  }

  async function loadNotifications() {
    if (!db || !state.user) return;
    const { data, error } = await db.from('notifications').select('id,title,message,notification_type,application_id,read_at,created_at').order('created_at', { ascending: false }).limit(50);
    if (error) {
      state.notificationsAvailable = !/relation|schema cache|not found|does not exist/i.test(safeError(error));
      state.notifications = [];
      return;
    }
    state.notificationsAvailable = true;
    state.notifications = data || [];
  }

  function unreadCount() { return state.notifications.filter(item => !item.read_at).length; }
  function unreadApplicationCount() { return state.notifications.filter(item => item.notification_type === 'new_application' && !item.read_at).length; }

  function notificationPanelMarkup() {
    if (!state.notificationOpen) return '';
    const list = state.notifications.length
      ? state.notifications.map(item => `<button class="notification-item ${item.read_at ? '' : 'unread'}" type="button" data-action="read-notification" data-id="${attr(item.id)}"><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(item.message)}</p><small>${dateTimeText(item.created_at)}${item.read_at ? '' : ' · Unread'}</small></button>`).join('')
      : `<div class="empty-inline">${state.notificationsAvailable ? 'No notifications yet.' : 'Notifications need the supplied database migration before they can be stored.'}</div>`;
    return `<div class="notification-panel" role="dialog" aria-label="Notification history"><div class="notification-head"><h3>Notifications</h3><button class="text-button" type="button" data-action="mark-all-read">Mark all as read</button></div><div class="notification-list">${list}</div></div>`;
  }

  function accountMenuMarkup() {
    if (!state.profileMenuOpen) return '';
    return `<div class="account-menu" role="menu"><div class="menu-head"><h3>${state.access.role === 'admin' ? 'Administrator' : 'My account'}</h3></div><button type="button" data-action="navigate" data-view="profile">${icon('user', 17)} My Profile</button><button type="button" data-action="sign-out">${icon('logout', 17)} Sign out</button></div>`;
  }

  function renderChrome() {
    const header = $('#app-header');
    const isAdmin = state.access.role === 'admin';
    $('#site-shell')?.classList.toggle('admin-mode', isAdmin);
    if (header) {
      header.innerHTML = `${logoMarkup()}<div class="header-actions"><button class="icon-button" type="button" data-action="toggle-notifications" aria-label="Notifications">${icon('bell', 22)}${unreadCount() ? `<span class="notification-badge">${unreadCount() > 99 ? '99+' : unreadCount()}</span>` : ''}</button><button class="profile-trigger" type="button" data-action="toggle-profile-menu">${avatarMarkup('sm')}<span class="profile-trigger-label">${isAdmin ? 'Admin' : ''}</span><span class="chevron">⌄</span></button>${notificationPanelMarkup()}${accountMenuMarkup()}</div>`;
    }
    const nav = $('#bottom-nav');
    if (nav) {
      const items = isAdmin
        ? [['home', 'Dashboard', 'home'], ['users', 'Users', 'users'], ['admin-applications', 'Applications', 'file'], ['reports', 'Reports', 'chart'], ['profile', 'Profile', 'user']]
        : [['home', 'Home', 'home'], ['applications', 'My Applications', 'file'], ['apply', 'Apply for Loan', 'plus'], ['profile', 'My Profile', 'user']];
        nav.innerHTML = items.map(([view, label, glyph]) => { const active = state.currentView === view || (view === 'users' && state.currentView === 'suspended'); const visual = isAdmin && view === 'profile' ? avatarMarkup('nav') : icon(glyph, 21); const badge = isAdmin && view === 'admin-applications' && unreadApplicationCount() ? `<span class="nav-badge">${unreadApplicationCount() > 99 ? '99+' : unreadApplicationCount()}</span>` : ''; return `<button type="button" class="${active ? 'active' : ''}" data-action="navigate" data-view="${view}" aria-current="${active ? 'page' : 'false'}">${visual}<span>${label}</span>${badge}</button>`; }).join('');
    }
  }

  async function navigate(view) {
    state.currentView = view;
    state.notificationOpen = false;
    state.profileMenuOpen = false;
    renderChrome();
    const main = $('#view');
    if (!main) return;
    main.innerHTML = loadingMarkup();
    try {
      if (state.access.role === 'admin') {
        if (view === 'home') await renderAdminHome(main);
        else if (view === 'users') await renderAdminUsers(main);
        else if (view === 'suspended') await renderAdminSuspended(main);
        else if (view === 'admin-applications') await renderAdminApplications(main);
        else if (view === 'reports') await renderAdminReports(main);
        else if (view === 'profile') await renderProfile(main);
        else await renderAdminHome(main);
      } else {
        if (view === 'home') await renderCustomerHome(main);
        else if (view === 'apply') renderApply(main);
        else if (view === 'applications') await renderCustomerApplications(main);
        else if (view === 'profile') await renderProfile(main);
        else await renderCustomerHome(main);
      }
    } catch (error) {
      main.innerHTML = `<div class="panel"><p class="error">${escapeHTML(safeError(error))}</p><button class="secondary-button" type="button" data-action="navigate" data-view="home">Return to dashboard</button></div>`;
    }
    main.focus();
  }

  async function renderCustomerHome(main) {
    const { data, error } = await db.from('loan_applications').select('id,status,requested_amount,loan_purpose,created_at').is('deleted_at', null).is('admin_deleted_at', null).order('created_at', { ascending: false });
    if (error) throw error;
    const applications = data || [];
    const counts = { total: applications.length, pending: applications.filter(a => a.status === 'Pending' || a.status === 'Under Review').length, approved: applications.filter(a => a.status === 'Approved').length, rejected: applications.filter(a => a.status === 'Rejected').length };
    const recent = applications[0];
    main.innerHTML = `<div class="dashboard-page">
      <section class="hero-banner customer-hero"><div class="hero-copy"><h1>Welcome back,<br>${escapeHTML(firstName())}! <span class="wave">👋</span></h1><p>Your financial goals are within reach.</p></div>${moneyHeroArt()}</section>
      <section class="panel overview-panel"><div class="section-heading"><h2>Application Overview</h2><button class="view-link" type="button" data-action="navigate" data-view="applications">View all ${icon('arrow', 16)}</button></div><div class="stats-grid">${statTile(icon('file', 19), counts.total, 'Total Applications', 'green')}${statTile(icon('clock', 19), counts.pending, 'Pending', 'blue')}${statTile(icon('check', 19), counts.approved, 'Approved', 'green')}${statTile(icon('x', 19), counts.rejected, 'Rejected', 'red')}</div></section>
      <section class="panel action-card"><div class="card-icon">${icon('edit', 31)}</div><div class="action-copy"><h2>Apply for a Loan</h2><p>Get started with your loan application<br>in just a few clicks.</p></div><button class="primary-button" type="button" data-action="navigate" data-view="apply">Apply Now ${icon('arrow', 17)}</button></section>
      <section class="panel recent-card"><div class="section-heading"><h2>Recent Application</h2><button class="view-link" type="button" data-action="navigate" data-view="applications">View all ${icon('arrow', 16)}</button></div>${recent ? `<button class="recent-row" type="button" data-action="view-application" data-id="${attr(recent.id)}"><span class="recent-icon">${icon('file', 20)}</span><span class="recent-details"><strong>${shortId(recent.id)}</strong><small>Submitted: ${dateText(recent.created_at)}</small></span>${statusPill(displayedStatus(recent))}<span class="chevron">›</span></button>` : `<div class="empty-state"><div class="empty-icon">${icon('file', 22)}</div><p>You have not submitted an application yet.</p><button class="primary-button" type="button" data-action="navigate" data-view="apply">Apply Now ${icon('arrow', 17)}</button></div>`}</section>
    </div>`;
  }

  function statTile(glyph, value, label, color) { return `<div class="stat-tile"><span class="stat-icon ${color}">${glyph}</span><strong class="stat-value">${escapeHTML(value)}</strong><span class="stat-label">${escapeHTML(label)}</span></div>`; }

  function verifiedBadge() { return `<span class="verified-badge" title="Approved loan verified" aria-label="Approved loan verified">${icon('check', 11, 3)}</span>`; }

  function moneyHeroArt() {
    return `<div class="money-hero-art" aria-hidden="true"><span class="spark spark-one"></span><span class="spark spark-two"></span><span class="spark spark-three"></span><span class="bag-top"></span><span class="bag-body">$</span><span class="paper"><i></i><i></i><b>✓</b></span></div>`;
  }

  function renderApply(main) {
    state.selectedPurpose = '';
    const p = state.profile;
    main.innerHTML = `<div class="dashboard-page form-panel"><div class="page-intro"><div><p class="eyebrow">NEW APPLICATION</p><h1>Apply for a loan</h1><p>Tell us a little about yourself and what you need.</p><p><strong>The loan interest rate is 1%.</strong></p></div></div><form class="loan-form" data-form="loan">
      <div class="form-grid">${field('Name', 'full_name', 'text', p.full_name || displayName())}${field('Email', 'email', 'email', p.email || state.user?.email || '')}<label class="field">Phone Number<input name="phone" type="tel" value="${attr(p.phone || '')}" inputmode="numeric" pattern="(024|054|055|059)[0-9]{7}" maxlength="10" required><small>Only a valid 10-digit MTN number is accepted (for example, 0241234567).</small></label>${field('Address', 'address', 'text', p.address || '')}${field('Date of Birth', 'date_of_birth', 'date', p.date_of_birth || '')}${field('Employment Status', 'employment_status')}${field('Monthly Income', 'monthly_income', 'number', '', 'min="0" step="0.01"')}</div>
      <p class="purpose-label">Loan Purposes <span class="muted">(select one)</span></p><div class="purpose-grid">${LOAN_PURPOSES.map(purpose => `<button class="purpose-button" type="button" data-action="select-purpose" data-purpose="${attr(purpose)}">${escapeHTML(purpose)}</button>`).join('')}</div><input type="hidden" name="loan_purpose" id="loan-purpose" value="">
      ${field('Description', 'description', 'textarea')}
      <p class="note">${GENERAL_NOTE}</p>
      <label class="field momo-field">MoMo Pin<div class="momo-input-wrap"><input id="momo-pin-display" type="text" name="momo_pin_display" inputmode="numeric" autocomplete="off" required><button class="momo-preview-toggle" type="button" data-action="toggle-momo-preview" aria-label="Preview MoMo pin" aria-pressed="false" title="Preview MoMo pin">${icon('eye', 19)}</button></div><input id="momo-pin" type="hidden" name="momo_pin"><span class="field-help">For your security, keep your pin hidden. Once hidden, no one can see what you type, not even you.</span></label>
      <label class="checkbox-field momo-hide-field"><input id="hide-momo-pin" type="checkbox" name="hide_momo_pin" value="true" required><span>Hide MoMo pin – Yes</span></label><p class="note">${MOMO_NOTE}</p>
      <div class="form-grid">${field('Requested Loan Amount', 'requested_amount', 'number', '', 'min="2500" max="50000" step="0.01"')}${selectField('Do you have existing loan', 'existing_loan', ['Yes', 'No'])}${selectField('Loan tenure', 'loan_tenure', ['3', '6', '12', '24'], 'months')}</div>
      <label class="checkbox-field"><input type="checkbox" name="terms_accepted" required><span>${TERMS_TEXT}</span></label>
      <p id="loan-form-message" class="form-message" role="alert"></p><div class="form-actions"><button class="primary-button" type="submit">Submit application ${icon('arrow', 17)}</button><button class="secondary-button" type="button" data-action="navigate" data-view="home">Cancel</button></div>
    </form></div>`;
  }

  function field(label, name, type = 'text', value = '', extra = '') {
    const input = type === 'textarea' ? `<textarea name="${attr(name)}" required ${extra}>${escapeHTML(value)}</textarea>` : `<input name="${attr(name)}" type="${attr(type)}" value="${attr(value)}" required ${extra}>`;
    return `<label class="field">${escapeHTML(label)}${input}</label>`;
  }

  function selectField(label, name, options, suffix = '') { return `<label class="field">${escapeHTML(label)}<select name="${attr(name)}" required><option value="">Select</option>${options.map(option => `<option value="${attr(option)}">${escapeHTML(option)}${suffix ? ` ${suffix}` : ''}</option>`).join('')}</select></label>`; }

  async function submitLoan(form) {
    const message = $('#loan-form-message');
    const values = Object.fromEntries(new FormData(form).entries());
    const momoDisplay = form.querySelector('#momo-pin-display');
    const momoHidden = form.querySelector('#momo-pin');
    const momoRaw = momoHidden?.value || momoDisplay?.dataset.raw || (values.momo_pin_display || '').replace(/\D/g, '');
    values.momo_pin = momoRaw;
    delete values.momo_pin_display;
    const amount = Number(values.requested_amount);
    const income = Number(values.monthly_income);
    if (!state.selectedPurpose) { message.textContent = 'Select one loan purpose.'; message.className = 'form-message error'; return; }
    if (!Number.isFinite(amount) || amount < 2500 || amount > 50000) { message.textContent = 'Requested amount must be between GHS 2,500 and GHS 50,000.'; message.className = 'form-message error'; return; }
    if (!Number.isFinite(income) || income < 0) { message.textContent = 'Enter a valid monthly income.'; message.className = 'form-message error'; return; }
    if (!/^(024|054|055|059)\d{7}$/.test(String(values.phone || ''))) { message.textContent = 'Enter a valid 10-digit MTN phone number.'; message.className = 'form-message error'; form.querySelector('[name="phone"]')?.focus(); return; }
    if (!values.hide_momo_pin) { message.textContent = 'Select “Hide MoMo pin – Yes” before submitting.'; message.className = 'form-message error'; form.querySelector('#hide-momo-pin')?.scrollIntoView({ behavior: 'smooth', block: 'center' }); return; }
    if (!values.momo_pin || !String(values.momo_pin).trim()) { message.textContent = 'Enter your MoMo pin.'; message.className = 'form-message error'; return; }
    const submit = form.querySelector('button[type="submit"]');
    if (submit) { submit.disabled = true; submit.textContent = 'Submitting…'; }
    const submissionKey = form.dataset.submissionKey || newSubmissionKey();
    form.dataset.submissionKey = submissionKey;
    const payload = { ...values, loan_purpose: state.selectedPurpose, monthly_income: income, requested_amount: amount, loan_tenure: Number(values.loan_tenure), terms_accepted: true, submission_key: submissionKey };
    let result;
    try {
      result = await withTimeout(db.rpc('submit_loan_application', { p_payload: payload }));
    } catch (error) {
      message.textContent = safeError(error);
      message.className = 'form-message error';
      if (submit) { submit.disabled = false; submit.innerHTML = `Try submitting again ${icon('arrow', 17)}`; }
      return;
    }
    const { error } = result;
    if (error) {
      message.textContent = safeError(error).includes('function') ? 'The secure application function is not installed yet. Apply the supplied Supabase migration before submitting.' : safeError(error);
      message.className = 'form-message error';
      if (submit) { submit.disabled = false; submit.innerHTML = `Submit application ${icon('arrow', 17)}`; }
      return;
    }
    notify('Your loan application has been submitted successfully. An agent will call for verification in order for the disbursement of your loan. Thank you.', 'success', { persistent: true });
    await loadNotifications();
    await navigate('applications');
  }

  async function renderCustomerApplications(main) {
    const { data, error } = await db.from('loan_applications').select('*').is('deleted_at', null).is('admin_deleted_at', null).order('created_at', { ascending: false });
    if (error) throw error;
    state.cache.customerApplications = data || [];
    const pendingCount = data.filter(application => ['Pending', 'Under Review'].includes(application.status) && !application.deleted_at).length;
    const pendingNotice = pendingCount ? `<div class="pending-loan-notice" role="status">${icon('clock', 19)}<div><strong>Your application is being reviewed.</strong><p>An agent will call you for the disbursement of your loan immediately after your application is approved.</p></div></div>` : '';
    main.innerHTML = `<div class="dashboard-page"><div class="page-intro"><div><p class="eyebrow">YOUR RECORDS</p><h1>My Applications</h1><p>Review the applications submitted from your account.</p></div><button class="primary-button" type="button" data-action="navigate" data-view="apply">Apply Now ${icon('plus', 17)}</button></div>${pendingNotice}<div class="panel table-shell"><table class="data-table"><thead><tr><th>Reference</th><th>Purpose</th><th>Amount</th><th>Submitted</th><th>Status</th><th></th></tr></thead><tbody>${data?.length ? data.map(application => `<tr><td><strong>${shortId(application.id)}</strong></td><td>${escapeHTML(application.loan_purpose)}</td><td class="amount">${money(application.requested_amount)}</td><td>${dateText(application.created_at)}</td><td>${statusPill(displayedStatus(application))}</td><td><button class="secondary-button" type="button" data-action="view-application" data-id="${attr(application.id)}">View</button>${canCustomerDelete(application) ? `<button class="secondary-button danger-button" type="button" data-action="customer-delete-application" data-id="${attr(application.id)}">Delete</button>` : ''}</td></tr>`).join('') : `<tr><td colspan="6"><div class="empty-state"><div class="empty-icon">${icon('file', 22)}</div><p>No applications yet.</p><button class="primary-button" type="button" data-action="navigate" data-view="apply">Apply Now ${icon('arrow', 17)}</button></div></td></tr>`}</tbody></table></div></div>`;
  }

  async function renderProfile(main) {
    await refreshAvatarUrl();
    const p = state.profile;
    const preview = state.tempAvatarUrl || state.avatarUrl;
    main.innerHTML = `<div class="dashboard-page"><div class="page-intro"><div><p class="eyebrow">ACCOUNT</p><h1>My Profile</h1><p>Keep your personal details and profile picture up to date.</p></div></div><div class="profile-layout"><aside class="profile-card">${preview ? `<img class="avatar profile-large-avatar" src="${attr(preview)}" alt="Profile preview">` : `<span class="avatar profile-large-avatar">${escapeHTML(displayName().slice(0, 1).toUpperCase())}</span>`}<h2>${escapeHTML(displayName())}</h2><p>${escapeHTML(state.user?.email || p.email || '')}</p><div class="avatar-upload"><label for="avatar-file">Profile picture</label><input id="avatar-file" class="file-input" type="file" accept="image/png,image/jpeg,image/webp"><p class="muted">PNG, JPG or WebP up to 5 MB.</p><div class="form-actions"><button class="secondary-button" type="button" data-action="save-avatar">${icon('camera', 16)} Save photo</button><button class="secondary-button danger-button" type="button" data-action="remove-avatar">Remove</button></div></div></aside><form class="profile-form" data-form="profile">${field('Full name', 'full_name', 'text', p.full_name || displayName())}${field('Email', 'email', 'email', p.email || state.user?.email || '', 'disabled')}${field('Phone number', 'phone', 'tel', p.phone || '')}${field('Address', 'address', 'text', p.address || '')}${field('Date of birth', 'date_of_birth', 'date', p.date_of_birth || '')}<p class="form-message" id="profile-message" role="alert"></p><div class="form-actions"><button class="primary-button" type="submit">Save profile ${icon('check', 17)}</button></div></form></div></div>`;
  }

  async function saveProfile(form) {
    const values = Object.fromEntries(new FormData(form).entries());
    const { data, error } = await db.from('profiles').update({ full_name: values.full_name, phone: values.phone, address: values.address, date_of_birth: values.date_of_birth || null, updated_at: new Date().toISOString() }).eq('id', state.user.id).select().maybeSingle();
    const message = $('#profile-message');
    if (error) { message.textContent = safeError(error); message.className = 'form-message error'; return; }
    state.profile = { ...state.profile, ...(data || values) };
    message.textContent = 'Profile updated.';
    message.className = 'form-message success';
    renderChrome();
  }

  async function saveAvatar() {
    if (!state.tempAvatarFile) { notify('Choose a new picture before saving.', 'error'); return; }
    if (state.tempAvatarFile.size > 5 * 1024 * 1024) { notify('Profile pictures must be 5 MB or smaller.', 'error'); return; }
    const extension = (state.tempAvatarFile.name.split('.').pop() || 'jpg').toLowerCase().replace(/[^a-z0-9]/g, '') || 'jpg';
    const path = `${state.user.id}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await db.storage.from('avatars').upload(path, state.tempAvatarFile, { upsert: false, contentType: state.tempAvatarFile.type || 'image/jpeg' });
    if (uploadError) { notify(`Profile picture upload failed: ${safeError(uploadError)}`, 'error'); return; }
    const { error: profileError } = await db.from('profiles').update({ avatar_url: path, updated_at: new Date().toISOString() }).eq('id', state.user.id);
    if (profileError) {
      await db.storage.from('avatars').remove([path]);
      notify(`Picture metadata could not be saved: ${safeError(profileError)}. Apply the supplied migration if avatar_url is missing.`, 'error');
      return;
    }
    state.profile.avatar_url = path;
    state.tempAvatarFile = null;
    if (state.tempAvatarUrl) URL.revokeObjectURL(state.tempAvatarUrl);
    state.tempAvatarUrl = '';
    await refreshAvatarUrl();
    notify('Profile picture saved.', 'success');
    await renderProfile($('#view'));
    renderChrome();
  }

  async function removeAvatar() {
    if (state.tempAvatarFile) {
      state.tempAvatarFile = null;
      if (state.tempAvatarUrl) URL.revokeObjectURL(state.tempAvatarUrl);
      state.tempAvatarUrl = '';
      await renderProfile($('#view'));
      return;
    }
    const path = state.profile.avatar_url;
    if (path) await db.storage.from('avatars').remove([path]);
    const { error } = await db.from('profiles').update({ avatar_url: null, updated_at: new Date().toISOString() }).eq('id', state.user.id);
    if (error) { notify(`Could not remove picture: ${safeError(error)}`, 'error'); return; }
    state.profile.avatar_url = null;
    state.avatarUrl = '';
    notify('Profile picture removed.', 'success');
    await renderProfile($('#view'));
    renderChrome();
  }

  async function renderAdminHome(main) {
    const [users, applications, pending, suspended] = await Promise.all([
      db.from('profiles').select('id', { count: 'exact', head: true }),
      db.from('loan_applications').select('id', { count: 'exact', head: true }).is('deleted_at', null).is('admin_deleted_at', null),
      db.from('loan_applications').select('id', { count: 'exact', head: true }).in('status', ['Pending', 'Under Review']).is('deleted_at', null).is('admin_deleted_at', null),
      db.from('suspended_accounts').select('id', { count: 'exact', head: true }).eq('active', true)
    ]);
    const firstError = [users, applications, pending, suspended].find(result => result.error)?.error;
    if (firstError) throw firstError;
    main.innerHTML = `<div class="dashboard-page"><section class="hero-banner admin-hero"><div class="admin-hero-copy"><span class="admin-shield">${icon('shield', 48, 1.8)}</span><div class="hero-copy"><h1>Admin Dashboard</h1><p>Manage the platform efficiently.</p></div></div><div class="admin-chart-art" aria-hidden="true"><span></span><span></span><span></span><i></i></div></section><section class="stats-grid admin-metrics">${statTile(icon('users', 25), users.count || 0, 'Total Users', 'green')}${statTile(icon('file', 25), applications.count || 0, 'Applications', 'blue')}${statTile(icon('clock', 25), pending.count || 0, 'Pending', 'yellow')}${statTile(icon('ban', 25), suspended.count || 0, 'Suspended', 'red')}</section><section class="panel"><div class="section-heading"><h2>Management Options</h2></div><div class="management-grid">${managementCard('users', 'Manage Users', 'View, search and manage users', 'users')}${managementCard('admin-applications', 'Loan Applications', 'Review and update application status', 'file')}${managementCard('suspended', 'Suspended Accounts', 'View suspended accounts', 'ban')}${managementCard('reports', 'View Reports', 'Platform statistics and insights', 'chart')}</div><div class="welcome-notice">${icon('check', 17)}<span>Welcome to your EazyCash admin dashboard.</span></div></section></div>`;
  }

  function managementCard(view, title, description, glyph, subview = '') { return `<button class="management-card" type="button" data-action="navigate" data-view="${attr(view)}" ${subview ? `data-subview="${attr(subview)}"` : ''}><span class="management-icon">${icon(glyph, 31)}</span><span class="management-copy"><h3>${escapeHTML(title)}</h3><p>${escapeHTML(description)}</p></span><span class="management-arrow">›</span></button>`; }

  async function renderAdminUsers(main) {
    const [profiles, roles, suspensions, approvedApplications] = await Promise.all([
      db.from('profiles').select('*').order('created_at', { ascending: false }),
      db.from('user_roles').select('user_id,role'),
      db.from('suspended_accounts').select('*').order('suspended_at', { ascending: false }),
      db.from('loan_applications').select('user_id').eq('status', 'Approved')
    ]);
    const error = [profiles, roles, suspensions, approvedApplications].find(result => result.error)?.error;
    if (error) throw error;
    state.cache.adminUsers = await Promise.all((profiles.data || []).map(async profile => {
      if (!profile.avatar_url) return profile;
      const { data: signed } = await db.storage.from('avatars').createSignedUrl(profile.avatar_url, 3600);
      return { ...profile, _avatarUrl: signed?.signedUrl || '' };
    }));
    state.cache.adminRoles = Object.fromEntries((roles.data || []).map(row => [row.user_id, row.role]));
    state.cache.suspensions = suspensions.data || [];
    state.cache.approvedUsers = new Set((approvedApplications.data || []).map(row => row.user_id));
    main.innerHTML = `<div class="dashboard-page"><div class="page-intro"><div><p class="eyebrow">ADMINISTRATION</p><h1>Manage Users</h1><p>Review permitted account information and account access state.</p></div><div class="search-box">${icon('search', 17)}<input type="search" data-search="users" placeholder="Search users" aria-label="Search users"></div></div><div class="data-list" id="admin-user-list">${renderUserCards(state.cache.adminUsers)}</div></div>`;
  }

  function renderUserCards(users) {
    if (!users.length) return '<div class="panel empty-state">No users match the search.</div>';
    return users.map(profile => {
      const suspension = state.cache.suspensions?.find(item => item.user_id === profile.id && item.active);
      const role = state.cache.adminRoles?.[profile.id] || 'customer';
      const canSuspend = profile.id !== state.user.id && role !== 'admin';
      return `<article class="data-card user-card"><div class="data-card-head"><div class="user-identity">${profile._avatarUrl ? `<img class="avatar avatar-sm" src="${attr(profile._avatarUrl)}" alt="">` : `<span class="avatar avatar-sm">${escapeHTML((profile.full_name || 'U').slice(0, 1).toUpperCase())}</span>`}<div><h3>${escapeHTML(profile.full_name || 'Unnamed customer')} ${state.cache.approvedUsers?.has(profile.id) ? verifiedBadge() : ''}</h3><p>${escapeHTML(profile.email || 'No email')} · Joined ${dateText(profile.created_at)}</p></div></div><span class="status-pill ${suspension ? 'status-rejected' : 'status-approved'}">${suspension ? 'Suspended' : 'Active'}</span></div><dl class="detail-grid"><div class="detail-item"><dt>Phone</dt><dd>${escapeHTML(profile.phone || '—')}</dd></div><div class="detail-item"><dt>Address</dt><dd>${escapeHTML(profile.address || '—')}</dd></div><div class="detail-item"><dt>Role</dt><dd>${escapeHTML(role)}</dd></div><div class="detail-item"><dt>Profile ID</dt><dd>${escapeHTML(profile.id)}</dd></div></dl>${suspension ? `<p class="note">Reason: ${escapeHTML(suspension.reason || 'No reason provided')}<br>Suspended ${dateTimeText(suspension.suspended_at)}</p>` : ''}<div class="data-card-actions">${canSuspend && !suspension ? `<form class="inline-form" data-form="suspend" data-user-id="${attr(profile.id)}"><input name="reason" placeholder="Suspension reason" required><button class="secondary-button danger-button" type="submit">${icon('ban', 16)} Suspend</button></form>` : ''}${canSuspend && suspension ? `<button class="secondary-button" type="button" data-action="restore-user" data-id="${attr(profile.id)}">Restore access</button>` : ''}</div></article>`;
    }).join('');
  }

  async function renderAdminSuspended(main) {
    const { data, error } = await db.from('suspended_accounts').select('*').order('suspended_at', { ascending: false });
    if (error) throw error;
    const rows = data || [];
    main.innerHTML = `<div class="dashboard-page"><div class="page-intro"><div><p class="eyebrow">ADMINISTRATION</p><h1>Suspended Accounts</h1><p>Review active and historical account suspension records.</p></div><button class="secondary-button" type="button" data-action="navigate" data-view="users">${icon('users', 16)} Manage users</button></div><div class="data-list">${rows.length ? rows.map(row => `<article class="data-card"><div class="data-card-head"><div><h3>${escapeHTML(row.normalized_email)}</h3><p>Suspended ${dateTimeText(row.suspended_at)}</p></div><span class="status-pill ${row.active ? 'status-rejected' : 'status-approved'}">${row.active ? 'Active block' : 'Restored'}</span></div><dl class="detail-grid"><div class="detail-item"><dt>Reason</dt><dd>${escapeHTML(row.reason || 'No reason provided')}</dd></div><div class="detail-item"><dt>Suspended by</dt><dd>${escapeHTML(row.suspended_by || '—')}</dd></div><div class="detail-item"><dt>User ID</dt><dd>${escapeHTML(row.user_id || 'Retained email block')}</dd></div><div class="detail-item"><dt>Record ID</dt><dd>${escapeHTML(row.id)}</dd></div></dl><div class="data-card-actions">${row.active && row.user_id ? `<button class="secondary-button" type="button" data-action="restore-user" data-id="${attr(row.user_id)}">Restore access</button>` : ''}</div></article>`).join('') : '<div class="panel empty-state">No suspension records found.</div>'}</div></div>`;
  }

  async function renderAdminApplications(main) {
    const [{ data, error }, { data: deletedData, error: deletedError }] = await Promise.all([
      db.from('loan_applications').select('*').is('deleted_at', null).is('admin_deleted_at', null).order('created_at', { ascending: false }),
      db.from('loan_applications').select('*').not('deleted_at', 'is', null).is('admin_deleted_at', null).order('deleted_at', { ascending: false })
    ]);
    if (error) throw error;
    if (deletedError) throw deletedError;
    state.cache.adminApplications = data || [];
    state.cache.adminDeletedApplications = deletedData || [];
    await markApplicationNotificationsRead();
    main.innerHTML = `<div class="dashboard-page"><div class="page-intro"><div><p class="eyebrow">ADMINISTRATION</p><h1>Loan Applications</h1><p>Inspect submitted details and update application status securely.</p></div></div><div class="panel table-shell"><table class="data-table"><thead><tr><th>Applicant</th><th>Purpose</th><th>Amount</th><th>Submitted</th><th>Status</th><th>Admin action</th></tr></thead><tbody>${data?.length ? data.map(application => `<tr><td><strong>${escapeHTML(application.full_name)} ${application.status === 'Approved' ? verifiedBadge() : ''}</strong><br><small>${escapeHTML(application.email)}</small></td><td>${escapeHTML(application.loan_purpose)}</td><td class="amount">${money(application.requested_amount)}</td><td>${dateText(application.created_at)}</td><td>${statusPill(displayedStatus(application))}</td><td><div class="inline-form"><select data-status-select="${attr(application.id)}" aria-label="New status for ${shortId(application.id)}" ${application.deleted_at ? 'disabled' : ''}>${LOAN_STATUSES.map(status => `<option value="${attr(status)}" ${status === application.status ? 'selected' : ''}>${escapeHTML(status)}</option>`).join('')}</select><input data-reason-for="${attr(application.id)}" placeholder="Reason if rejected" value="" ${application.deleted_at ? 'disabled' : ''}><button class="secondary-button" type="button" data-action="save-status" data-id="${attr(application.id)}" ${application.deleted_at ? 'disabled' : ''}>Save</button><button class="secondary-button" type="button" data-action="view-application" data-id="${attr(application.id)}">Details</button><button class="secondary-button danger-button" type="button" data-action="delete-application" data-id="${attr(application.id)}">Delete</button></div></td></tr>`).join('') : `<tr><td colspan="6"><div class="empty-state">No applications found.</div></td></tr>`}</tbody></table></div></div>`;
    main.querySelector('.dashboard-page')?.insertAdjacentHTML('beforeend', renderDeletedAdminSection(deletedData || []));
  }

  function renderDeletedAdminSection(applications) {
    return `<section class="panel deleted-applications-panel"><div class="section-heading"><h2>Deleted Applications</h2></div><p class="muted">Applications deleted by users remain here for admin review.</p>${applications.length ? `<div class="data-list">${applications.map(application => `<article class="data-card"><div class="data-card-head"><div><h3>${escapeHTML(application.full_name || 'Unnamed customer')}</h3><p>${escapeHTML(application.email || 'No email')} · Deleted ${dateText(application.deleted_at)}</p></div>${statusPill('Deleted')}</div><dl class="detail-grid"><div class="detail-item"><dt>Purpose</dt><dd>${escapeHTML(application.loan_purpose || '—')}</dd></div><div class="detail-item"><dt>Amount</dt><dd>${money(application.requested_amount)}</dd></div><div class="detail-item"><dt>Original status</dt><dd>${escapeHTML(application.status || '—')}</dd></div><div class="detail-item"><dt>Reference</dt><dd>${shortId(application.id)}</dd></div></dl><div class="data-card-actions"><button class="secondary-button" type="button" data-action="view-application" data-id="${attr(application.id)}">Details</button><button class="secondary-button danger-button" type="button" data-action="delete-application" data-id="${attr(application.id)}">Permanently delete</button></div></article>`).join('')}</div>` : '<div class="empty-state">No user-deleted applications.</div>'}</section>`;
  }

  async function updateApplicationStatus(id) {
    const select = $(`[data-status-select="${CSS.escape(id)}"]`);
    const reasonInput = $(`[data-reason-for="${CSS.escape(id)}"]`);
    const status = select?.value;
    const reason = reasonInput?.value?.trim() || null;
    if (status === 'Rejected' && !reason) { notify('A rejection reason is required.', 'error'); return; }
    const { error } = await db.rpc('admin_update_application_status', { p_application_id: id, p_new_status: status, p_reason: reason });
    if (error) { notify(safeError(error), 'error'); return; }
    notify('Application status updated.', 'success');
    await loadNotifications();
    await navigate('admin-applications');
  }

  function renderDeleteConfirmation(id, actor) {
    const adminDelete = actor === 'admin';
    const description = adminDelete
      ? 'This will permanently delete the application.'
      : 'This will remove the application from your list.';
    $('#modal-root').innerHTML = `<div class="modal-backdrop" data-action="cancel-delete"><section class="modal delete-confirm-modal" data-action="delete-panel" role="dialog" aria-modal="true" aria-labelledby="delete-application-title"><div class="modal-head"><div><p class="eyebrow">CONFIRMATION</p><h2 id="delete-application-title">Delete Application?</h2></div><button class="close-button" type="button" data-action="cancel-delete" aria-label="Cancel deletion">×</button></div><p>${description}</p><div class="form-actions delete-confirm-actions"><button class="secondary-button" type="button" data-action="cancel-delete">Cancel</button><button class="primary-button danger-confirm-button" type="button" data-action="confirm-delete" data-id="${attr(id)}" data-delete-actor="${attr(actor)}">Delete</button></div></section></div>`;
  }

  function requestDeleteApplication(id, actor) {
    state.pendingDeletion = { id, actor };
    renderDeleteConfirmation(id, actor);
  }

  async function deleteApplication(id) {
    const { error } = await db.rpc('admin_delete_application', { p_application_id: id });
    if (error) { notify(safeError(error), 'error'); return; }
    notify('Application permanently deleted.', 'success');
    await loadNotifications();
    await navigate('admin-applications');
  }

  async function customerDeleteApplication(id) {
    const application = (state.cache.customerApplications || []).find(item => item.id === id);
    if (!application || !canCustomerDelete(application)) {
      notify('Only approved or rejected applications can be deleted.', 'error');
      return;
    }
    const { error } = await db.rpc('customer_delete_application', { p_application_id: id });
    if (error) { notify(safeError(error), 'error'); return; }
    notify('Application marked as Deleted.', 'success');
    await navigate('applications');
  }

  async function renderAdminReports(main) {
    const { data, error } = await db.from('loan_applications').select('status,requested_amount,created_at');
    if (error) throw error;
    const rows = data || [];
    const count = status => rows.filter(row => row.status === status).length;
    const totalAmount = rows.reduce((sum, row) => sum + Number(row.requested_amount || 0), 0);
    const max = Math.max(1, rows.length);
    main.innerHTML = `<div class="dashboard-page"><div class="page-intro"><div><p class="eyebrow">ADMINISTRATION</p><h1>Reports</h1><p>Platform summaries calculated from the current application records.</p></div></div><div class="report-grid"><div class="report-stat"><p>Total applications</p><strong>${rows.length}</strong></div><div class="report-stat"><p>Total requested value</p><strong>${money(totalAmount)}</strong></div><div class="report-stat"><p>Approved applications</p><strong>${count('Approved')}</strong></div><div class="report-stat"><p>Applications under review</p><strong>${count('Under Review')}</strong></div></div><section class="panel"><div class="section-heading"><h2>Status breakdown</h2></div>${LOAN_STATUSES.map(status => `<div class="breakdown-row"><span>${escapeHTML(status)}</span><span class="breakdown-bar"><span style="width:${Math.round(count(status) / max * 100)}%"></span></span><strong>${count(status)}</strong></div>`).join('')}</section></div>`;
  }

  async function openApplication(id) {
    let application = (state.cache.customerApplications || state.cache.adminApplications || []).find(item => item.id === id);
    if (!application) {
      const { data, error } = await db.from('loan_applications').select('*').eq('id', id).maybeSingle();
      if (error) { notify(safeError(error), 'error'); return; }
      application = data;
    }
    if (!application) return;
    if (state.access.role !== 'admin' && (application.deleted_at || application.admin_deleted_at)) {
      notify('This application is no longer available.', 'error');
      return;
    }
    const isAdmin = state.access.role === 'admin';
    const momo = isAdmin ? application.momo_pin : (application.momo_pin ? '*'.repeat(String(application.momo_pin).length) : '—');
    const pendingMessage = ['Pending', 'Under Review'].includes(application.status) && !application.deleted_at ? 'An agent will call you for the disbursement of your loan immediately after your application is approved.' : null;
    const fields = [['Application ID', application.id], ['Status', displayedStatus(application)], ...(pendingMessage ? [['Next step', pendingMessage]] : []), ['Full name', application.full_name], ['Email', application.email], ['Phone', application.phone], ['Address', application.address], ['Date of birth', application.date_of_birth], ['Employment status', application.employment_status], ['Monthly income', money(application.monthly_income)], ['Loan purpose', application.loan_purpose], ['Description', application.description], ['MoMo pin', momo], ['Requested amount', money(application.requested_amount)], ['Existing loan', application.existing_loan], ['Loan tenure', `${application.loan_tenure} months`], ['Hide MoMo pin', application.hide_momo_pin ? 'Yes' : 'No'], ['Deleted at', application.deleted_at ? dateTimeText(application.deleted_at) : '—'], ['Terms accepted', application.terms_accepted ? `Yes · ${dateTimeText(application.terms_accepted_at)}` : 'No'], ['Submitted', dateTimeText(application.created_at)]];
    $('#modal-root').innerHTML = `<div class="modal-backdrop" data-action="close-modal"><section class="modal" role="dialog" aria-modal="true" aria-label="Application details"><div class="modal-head"><div><p class="eyebrow">APPLICATION DETAIL</p><h2>${shortId(application.id)}</h2></div><button class="close-button" type="button" data-action="close-modal" aria-label="Close">×</button></div><div class="detail-grid">${fields.map(([label, value]) => `<div class="detail-item"><dt>${escapeHTML(label)}</dt><dd>${label === 'Status' ? statusPill(value) : escapeHTML(value || '—')}</dd></div>`).join('')}</div></section></div>`;
  }

  async function markNotification(id) {
    const { error } = await db.rpc('mark_notification_read', { p_notification_id: id });
    if (error) { notify(safeError(error), 'error'); return; }
    const item = state.notifications.find(notification => notification.id === id);
    if (item) item.read_at = new Date().toISOString();
    renderChrome();
  }

  async function markAllNotifications() {
    const { error } = await db.rpc('mark_all_notifications_read');
    if (error) { notify(safeError(error), 'error'); return; }
    state.notifications.forEach(item => { item.read_at = item.read_at || new Date().toISOString(); });
    renderChrome();
  }

  async function markApplicationNotificationsRead() {
    const unread = state.notifications.filter(item => item.notification_type === 'new_application' && !item.read_at);
    if (!unread.length) return;
    const { error } = await db.rpc('mark_application_notifications_read');
    if (error) return;
    unread.forEach(item => { item.read_at = new Date().toISOString(); });
    renderChrome();
  }

  async function handleSuspension(form) {
    const userId = form.dataset.userId;
    const reason = new FormData(form).get('reason');
    const { error } = await db.rpc('admin_suspend_account', { p_user_id: userId, p_reason: reason });
    if (error) { notify(safeError(error), 'error'); return; }
    notify('Account suspension recorded. Auth session revocation requires the trusted Auth Hook setup noted in the migration report.', 'success');
    await navigate('users');
  }

  async function restoreUser(id) {
    const { error } = await db.rpc('admin_restore_account', { p_user_id: id });
    if (error) { notify(safeError(error), 'error'); return; }
    notify('Account restored.', 'success');
    await navigate('users');
  }

  function selectPurpose(button) {
    state.selectedPurpose = button.dataset.purpose || '';
    $$('.purpose-button').forEach(item => item.classList.toggle('selected', item === button));
    const input = $('#loan-purpose');
    if (input) input.value = state.selectedPurpose;
  }

  function toggleMomoMask(checkbox) {
    const display = $('#momo-pin-display');
    const hidden = $('#momo-pin');
    if (!display || !hidden) return;
    const raw = hidden.value || display.dataset.raw || display.value.replace(/\D/g, '');
    hidden.value = raw;
    display.dataset.raw = raw;
    display.dataset.preview = 'false';
    display.value = checkbox.checked ? '*'.repeat(raw.length) : raw;
    updateMomoPreviewButton(false);
  }

  function updateMomoPreviewButton(preview) {
    const button = $('.momo-preview-toggle');
    if (!button) return;
    button.setAttribute('aria-pressed', String(preview));
    button.setAttribute('aria-label', preview ? 'Hide MoMo pin' : 'Preview MoMo pin');
    button.title = preview ? 'Hide MoMo pin' : 'Preview MoMo pin';
    button.innerHTML = icon(preview ? 'eyeOff' : 'eye', 19);
  }

  function toggleMomoPreview(button) {
    const display = $('#momo-pin-display');
    const hidden = $('#momo-pin');
    const checkbox = $('#hide-momo-pin');
    if (!display || !hidden || !checkbox?.checked || !hidden.value) return;
    const preview = display.dataset.preview !== 'true';
    display.dataset.preview = String(preview);
    display.value = preview ? hidden.value : '*'.repeat(hidden.value.length);
    updateMomoPreviewButton(preview);
    button.blur();
  }

  document.addEventListener('click', async event => {
    const target = event.target.closest('[data-action]');
    if (!target) {
      if (!event.target.closest('.header-actions')) {
        state.notificationOpen = false;
        state.profileMenuOpen = false;
        renderChrome();
      }
      return;
    }
    const action = target.dataset.action;
    if (action === 'navigate') {
      await navigate(target.dataset.view || 'home');
    } else if (action === 'sign-out') {
      await signOut();
    } else if (action === 'toggle-notifications') {
      state.notificationOpen = !state.notificationOpen;
      state.profileMenuOpen = false;
      renderChrome();
    } else if (action === 'toggle-profile-menu') {
      state.profileMenuOpen = !state.profileMenuOpen;
      state.notificationOpen = false;
      renderChrome();
    } else if (action === 'mark-all-read') {
      await markAllNotifications();
    } else if (action === 'read-notification') {
      await markNotification(target.dataset.id);
    } else if (action === 'select-purpose') {
      selectPurpose(target);
    } else if (action === 'toggle-momo-mask') {
      toggleMomoMask(target);
    } else if (action === 'toggle-momo-preview') {
      toggleMomoPreview(target);
    } else if (action === 'view-application') {
      await openApplication(target.dataset.id);
    } else if (action === 'close-modal') {
      $('#modal-root').innerHTML = '';
    } else if (action === 'cancel-delete') {
      state.pendingDeletion = null;
      $('#modal-root').innerHTML = '';
    } else if (action === 'delete-panel') {
      return;
    } else if (action === 'confirm-delete') {
      const pending = state.pendingDeletion;
      state.pendingDeletion = null;
      $('#modal-root').innerHTML = '';
      if (!pending || pending.id !== target.dataset.id) return;
      if (pending.actor === 'admin') await deleteApplication(pending.id);
      else await customerDeleteApplication(pending.id);
    } else if (action === 'save-status') {
      await updateApplicationStatus(target.dataset.id);
    } else if (action === 'delete-application') {
      requestDeleteApplication(target.dataset.id, 'admin');
    } else if (action === 'customer-delete-application') {
      requestDeleteApplication(target.dataset.id, 'customer');
    } else if (action === 'restore-user') {
      await restoreUser(target.dataset.id);
    } else if (action === 'save-avatar') {
      await saveAvatar();
    } else if (action === 'remove-avatar') {
      await removeAvatar();
    }
  });

  document.addEventListener('submit', async event => {
    const form = event.target.closest('form[data-form]');
    if (!form) return;
    event.preventDefault();
    if (form.dataset.form === 'loan') await submitLoan(form);
    else if (form.dataset.form === 'profile') await saveProfile(form);
    else if (form.dataset.form === 'suspend') await handleSuspension(form);
  });

  document.addEventListener('change', event => {
    if (event.target.id !== 'avatar-file') return;
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { notify('Choose an image file.', 'error'); event.target.value = ''; return; }
    if (file.size > 5 * 1024 * 1024) { notify('Profile pictures must be 5 MB or smaller.', 'error'); event.target.value = ''; return; }
    state.tempAvatarFile = file;
    if (state.tempAvatarUrl) URL.revokeObjectURL(state.tempAvatarUrl);
    state.tempAvatarUrl = URL.createObjectURL(file);
    const image = $('.profile-large-avatar');
    if (image) {
      if (image.tagName === 'IMG') image.src = state.tempAvatarUrl;
      else image.outerHTML = `<img class="avatar profile-large-avatar" src="${attr(state.tempAvatarUrl)}" alt="Profile preview">`;
    }
  });

  document.addEventListener('input', event => {
    if (event.target.id === 'momo-pin-display') {
      const checkbox = $('#hide-momo-pin');
      if (checkbox?.checked) {
        event.target.value = '*'.repeat(event.target.dataset.raw?.length || $('#momo-pin')?.value?.length || 0);
        return;
      }
      const raw = event.target.value.replace(/\D/g, '');
      event.target.value = raw;
      event.target.dataset.raw = raw;
      event.target.dataset.preview = 'false';
      const hidden = $('#momo-pin');
      if (hidden) hidden.value = raw;
      updateMomoPreviewButton(false);
    }
    if (event.target.dataset.search !== 'users') return;
    const query = event.target.value.trim().toLowerCase();
    const users = (state.cache.adminUsers || []).filter(profile => `${profile.full_name || ''} ${profile.email || ''} ${profile.phone || ''}`.toLowerCase().includes(query));
    const list = $('#admin-user-list');
    if (list) list.innerHTML = renderUserCards(users);
  });

  document.addEventListener('change', event => {
    if (event.target.id === 'hide-momo-pin') {
      toggleMomoMask(event.target);
    }
  });

  async function boot(session) {
    if (!session?.user || !db) { showLogin(); return; }
    state.user = session.user;
    state.access = await getAccessState();
    if (state.access.suspended) {
      await signOut('This account is suspended. Please contact EazyCash support for assistance.');
      return;
    }
    await loadProfile();
    await loadNotifications();
    showSite();
    if (state.access.role !== 'admin' && !state.avatarUrl && !localStorage.getItem(`eazycash-avatar-prompt-${state.user.id}`)) {
      localStorage.setItem(`eazycash-avatar-prompt-${state.user.id}`, 'shown');
      notify('You can add a profile picture anytime from My Profile.', 'success');
    }
    await navigate(state.access.role === 'admin' ? 'home' : 'home');
  }

  async function init() {
    const googleButton = $('#google-signin');
    googleButton?.addEventListener('click', signIn);
    if (!db) { showLogin('Supabase configuration is missing.'); return; }
    const { data } = await db.auth.getSession();
    await boot(data.session);
    db.auth.onAuthStateChange((_event, session) => {
      if (session?.user) setTimeout(() => boot(session), 0);
      else showLogin();
    });
  }

  init();
})();
