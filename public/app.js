// Real Estate & Construction Multi-Site Inventory Management System
// Minimalist Executive Dashboard, Dedicated Site Command Center Tab, Workforce Tracking & Shortcuts

const state = {
  settings: {
    businessName: "Amitus Infra",
    tagline: "Building Home Of Your Dream — Since 2001",
    ownerName: "Managing Director",
    phone: "098631 77877",
    email: "amitusinfra2014@gmail.com",
    address: "Water Supply Road, Shibnagar, Agartala, Tripura - 799001",
    directionsUrl: "https://www.google.com/maps/dir/Amitus+Infra,+Water+Supply+Rd,+Shibnagar,+Dhaleswar,+Agartala,+Tripura+799004/23.8298247,91.2917605/@23.8307982,91.2925526,455m/data=!3m2!1e3!4b1!4m8!4m7!1m5!1m1!1s0x3753f3d8c074ef9b:0x80169c98304c1552!2m2!1d91.2958744!2d23.8313774!1m0?entry=ttu&g_ep=EgoyMDI2MTExNy4wIKXMDSoASAFQAw%3D%3D",
    currencySymbol: "₹",
    currencyCode: "INR",
    darkMode: true
  },
  projects: [],
  inventory: [],
  transactions: [],
  employees: [],
  salaryPayments: [],
  auth: {
    isAuthenticated: false,
    token: localStorage.getItem('amitus_auth_token') || sessionStorage.getItem('amitus_auth_token') || null,
    user: localStorage.getItem('amitus_auth_user') || sessionStorage.getItem('amitus_auth_user') || null,
    mode: 'hybrid'
  },
  flats: [],
  suppliers: [],
  vendorBills: [],
  attendance: [],
  sitePhotos: [],
  selectedHaziraDate: new Date().toISOString().slice(0, 10),
  activeEstimatorTab: "concrete",
  presets: [],
  stats: {},
  activeTab: 'home',
  selectedProjectId: 'all',
  filterCategory: 'all',
  filterStatus: 'all',
  searchQuery: '',
  siteSearchQuery: '',
  siteFilterCategory: 'all',
  theme: 'dark',
  presetFilterCategory: 'all',
  presetSearchQuery: '',
  workforceSiteFilter: 'all',
  workforceRoleFilter: 'all',
  workforceWageTypeFilter: 'all',
  workforceSearchQuery: '',
  payrollTypeFilter: 'all',
  payrollSearchQuery: ''
};

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  setupKeyboardShortcuts();
  setupEventListeners();
  loadData();
});

// Format currency
function formatCurrency(amount, withSymbol = true) {
  const sym = withSymbol ? (state.settings.currencySymbol || '₹') + ' ' : '';
  const num = Number(amount) || 0;
  return sym + num.toLocaleString('en-IN', { maximumFractionDigits: 2 });
}

// Compact currency (e.g. ₹14.5 L or ₹1.2 Cr)
function formatCompactCurrency(amount) {
  const num = Number(amount) || 0;
  const sym = state.settings.currencySymbol || '₹';
  if (num >= 10000000) {
    return `${sym} ${(num / 10000000).toFixed(2)} Cr`;
  }
  if (num >= 100000) {
    return `${sym} ${(num / 100000).toFixed(2)} L`;
  }
  return `${sym} ${num.toLocaleString('en-IN')}`;
}

// Format numbers
function formatQty(num) {
  return (Number(num) || 0).toLocaleString('en-IN');
}

// Format date
function formatDate(dateStr) {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  } catch (e) {
    return dateStr;
  }
}

// Theme handling
function initTheme() {
  const saved = localStorage.getItem('theme_preference');
  if (saved) {
    state.theme = saved;
  } else {
    // Default to dark mode to match Amitus Infra's signature logo aesthetic
    state.theme = 'dark';
  }
  applyTheme();
}

function toggleTheme() {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  localStorage.setItem('theme_preference', state.theme);
  applyTheme();
  showToast(`Switched to ${state.theme} mode`, 'info');
}

function applyTheme() {
  document.documentElement.setAttribute('data-theme', state.theme);
  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) {
    themeBtn.innerHTML = state.theme === 'dark' ? '☀️ Light' : '🌙 Dark';
  }
}

// Toast Notifications
function showToast(message, type = 'success') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `
    <span>${message}</span>
    <button style="background:none;border:none;cursor:pointer;font-weight:bold;color:inherit;" onclick="this.parentElement.remove()">✕</button>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(15px)';
    toast.style.transition = 'all 0.2s ease';
    setTimeout(() => toast.remove(), 200);
  }, 3500);
}

// API Loader
async function loadData() {
  try {
    const headers = {};
    if (state.auth && state.auth.token) {
      headers['Authorization'] = 'Bearer ' + state.auth.token;
    }
    const res = await fetch('/api/data', { headers });
    if (!res.ok) {
      if (res.status === 401) {
        state.auth.isAuthenticated = false;
        updateAuthHeaderUi();
        openDirectorLoginModal();
        return;
      }
      throw new Error('Failed to load data');
    }
    const data = await res.json();
    state.auth.isAuthenticated = !!data.authenticated;
    updateAuthHeaderUi();

    if (!state.auth.isAuthenticated) {
      state.activeTab = 'home';
    }

    state.settings = data.settings || state.settings;
    state.projects = data.projects || [];
    state.inventory = data.inventory || [];
    state.transactions = data.transactions || [];
    state.employees = data.employees || [];
    state.salaryPayments = data.salaryPayments || [];
    state.flats = data.flats || [];
    state.suppliers = data.suppliers || [];
    state.vendorBills = data.vendorBills || [];
    state.attendance = data.attendance || [];
    state.sitePhotos = data.sitePhotos || [];
    state.presets = data.presets || [];
    state.stats = data.stats || {};

    updateHeaderSelectors();
    updatePayrollEmployeeDropdown();
    renderActiveTab();
  } catch (err) {
    console.error('Error fetching data:', err);
    showToast('Could not load inventory data from server', 'error');
  }
}

// Header Project Switcher
function updateHeaderSelectors() {
  const headerSelect = document.getElementById('header-project-select');
  if (!headerSelect) return;

  const currentVal = state.selectedProjectId;
  headerSelect.innerHTML = `
    <option value="all">All Sites (${state.projects.length})</option>
    ${state.projects.map(p => `
      <option value="${p.id}" ${p.id === currentVal ? 'selected' : ''}>
        ${p.name} [${p.code}]
      </option>
    `).join('')}
  `;

  const supSelect = document.getElementById('bill-supplier-id');
  if (supSelect) {
    supSelect.innerHTML = state.suppliers.map(s => `<option value="${s.id}">${s.name} (${s.category})</option>`).join('');
  }
  // Update modal project dropdowns
  const projectDropdowns = document.querySelectorAll('.project-selector-dropdown');
  projectDropdowns.forEach(select => {
    const selVal = select.value;
    select.innerHTML = `
      <option value="" disabled ${!selVal ? 'selected' : ''}>Select Site Project...</option>
      ${state.projects.map(p => `
        <option value="${p.id}" ${p.id === selVal ? 'selected' : ''}>${p.name} (${p.code})</option>
      `).join('')}
    `;
  });
}

// Open Dedicated Site Command Center Tab for a Specific Project
function openSiteDetail(projectId) {
  state.selectedProjectId = projectId;
  const project = state.projects.find(p => p.id === projectId);
  if (!project) return;

  // Make the dynamic dedicated project tab button visible & update label
  const siteTabBtn = document.getElementById('nav-tab-site-detail');
  const siteTabName = document.getElementById('nav-tab-site-name');
  if (siteTabBtn && siteTabName) {
    siteTabName.textContent = `${project.name} [${project.code}]`;
    siteTabBtn.style.display = 'inline-flex';
  }

  // Sync header selector
  const headerSelect = document.getElementById('header-project-select');
  if (headerSelect) headerSelect.value = projectId;

  switchTab('site-detail');
  showToast(`Opened Site Command Center: ${project.name}`, 'info');
}

// Event Listeners Setup
function setupEventListeners() {
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  const headerSelect = document.getElementById('header-project-select');
  if (headerSelect) {
    headerSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      if (val === 'all') {
        state.selectedProjectId = 'all';
        const siteTabBtn = document.getElementById('nav-tab-site-detail');
        if (siteTabBtn) siteTabBtn.style.display = 'none';
        if (state.activeTab === 'site-detail') {
          switchTab('dashboard');
        } else {
          renderActiveTab();
        }
      } else {
        openSiteDetail(val);
      }
    });
  }

  const themeBtn = document.getElementById('theme-toggle-btn');
  if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

  const searchInput = document.getElementById('global-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.toLowerCase().trim();
      renderActiveTab();
    });
  }

  const categoryFilter = document.getElementById('filter-category-select');
  if (categoryFilter) {
    categoryFilter.addEventListener('change', (e) => {
      state.filterCategory = e.target.value;
      renderActiveTab();
    });
  }

  const statusFilter = document.getElementById('filter-status-select');
  if (statusFilter) {
    statusFilter.addEventListener('change', (e) => {
      state.filterStatus = e.target.value;
      renderActiveTab();
    });
  }

  setupPriceCalcListeners();
}

// Keyboard shortcuts
function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName);
    if (e.key === 'Escape') {
      closeAllModals();
      return;
    }
    if (isInput) return;

    switch (e.key.toLowerCase()) {
      case '0':
      case 'h': switchTab('home'); break;
      case '1': switchTab('dashboard'); break;
      case '2': switchTab('projects'); break;
      case '3': switchTab('inventory'); break;
      case '4': switchTab('shortcuts'); break;
      case '5': switchTab('transactions'); break;
      case '6': switchTab('boq'); break;
      case '7': switchTab('workforce-payroll'); break;
      case 'w':
        e.preventDefault();
        if (!state.auth || !state.auth.isAuthenticated) {
          openDirectorLoginModal();
          showToast('🔒 Please enter Director credentials to manage workforce', 'warning');
          return;
        }
        openAddEmployeeModal();
        break;
      case 'n':
        e.preventDefault();
        if (!state.auth || !state.auth.isAuthenticated) {
          openDirectorLoginModal();
          showToast('🔒 Please enter Director credentials to add material', 'warning');
          return;
        }
        openModal('modal-add-item');
        break;
      case 'p':
        e.preventDefault();
        if (!state.auth || !state.auth.isAuthenticated) {
          openDirectorLoginModal();
          showToast('🔒 Please enter Director credentials to add projects', 'warning');
          return;
        }
        openModal('modal-add-project');
        break;
      case 'q':
        e.preventDefault();
        if (!state.auth || !state.auth.isAuthenticated) {
          openDirectorLoginModal();
          showToast('🔒 Please enter Director credentials to access catalog', 'warning');
          return;
        }
        openPresetsModal();
        break;
      case 't':
        e.preventDefault();
        if (!state.auth || !state.auth.isAuthenticated) {
          openDirectorLoginModal();
          showToast('🔒 Please enter Director credentials for stock transfers', 'warning');
          return;
        }
        openTransferModal();
        break;
      case 'i':
        e.preventDefault();
        if (!state.auth || !state.auth.isAuthenticated) {
          openDirectorLoginModal();
          showToast('🔒 Please enter Director credentials for inward challans', 'warning');
          return;
        }
        openInwardModal();
        break;
      case 'o':
        e.preventDefault();
        if (!state.auth || !state.auth.isAuthenticated) {
          openDirectorLoginModal();
          showToast('🔒 Please enter Director credentials for outward issue', 'warning');
          return;
        }
        openOutwardModal();
        break;
      case '/':
        e.preventDefault();
        const search = document.getElementById('global-search-input');
        if (search) search.focus();
        break;
      case '?':
        e.preventDefault();
        openModal('modal-shortcuts-guide');
        break;
    }
  });
}

// Switch Active Tab
function switchTab(tab) {
  if (tab !== 'home' && (!state.auth || !state.auth.isAuthenticated)) {
    state.pendingTargetTab = tab;
    openDirectorLoginModal();
    showToast('🔒 Please enter Director credentials to unlock internal operations', 'warning');
    return;
  }
  state.activeTab = tab;
  document.querySelectorAll('.nav-tab-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tab === tab);
  });
  renderActiveTab();
}

// Render active tab view
function renderActiveTab() {
  const container = document.getElementById('tab-content-area');
  if (!container) return;

  let filteredItems = state.inventory;
  if (state.selectedProjectId !== 'all') {
    filteredItems = filteredItems.filter(i => i.projectId === state.selectedProjectId);
  }
  if (state.filterCategory !== 'all') {
    filteredItems = filteredItems.filter(i => i.category === state.filterCategory);
  }
  if (state.filterStatus === 'low') {
    filteredItems = filteredItems.filter(i => i.quantity > 0 && i.quantity <= i.minStockAlert);
  } else if (state.filterStatus === 'out') {
    filteredItems = filteredItems.filter(i => i.quantity <= 0);
  } else if (state.filterStatus === 'ok') {
    filteredItems = filteredItems.filter(i => i.quantity > i.minStockAlert);
  }
  if (state.searchQuery) {
    filteredItems = filteredItems.filter(i =>
      i.name.toLowerCase().includes(state.searchQuery) ||
      i.category.toLowerCase().includes(state.searchQuery) ||
      (i.sku && i.sku.toLowerCase().includes(state.searchQuery)) ||
      (i.supplier && i.supplier.toLowerCase().includes(state.searchQuery))
    );
  }

  const invCounter = document.getElementById('counter-inventory');
  if (invCounter) invCounter.textContent = state.inventory.length;
  const projCounter = document.getElementById('counter-projects');
  if (projCounter) projCounter.textContent = state.projects.length;
  const cntAtt = document.getElementById('counter-attendance');
  if (cntAtt) cntAtt.textContent = (state.attendance || []).filter(a => a.date === (state.selectedHaziraDate || new Date().toISOString().slice(0, 10)) && a.status === 'present').length;
  const cntFlats = document.getElementById('counter-flats');
  if (cntFlats) cntFlats.textContent = (state.flats || []).length;
  const cntSup = document.getElementById('counter-suppliers');
  if (cntSup) cntSup.textContent = (state.suppliers || []).length;
  const empCounter = document.getElementById('counter-employees');
  if (empCounter) empCounter.textContent = state.employees.length;

  switch (state.activeTab) {
    case 'home':
      renderHomePage(container);
      break;
    case 'dashboard':
      renderDashboard(container, filteredItems);
      break;
    case 'projects':
      renderProjects(container);
      break;
    case 'site-detail':
      renderSiteDetail(container);
      break;
    case 'inventory':
      renderInventoryTable(container, filteredItems);
      break;
    case 'shortcuts':
      renderShortcutsCenter(container, filteredItems);
      break;
    case 'transactions':
      renderTransactions(container);
      break;
    case 'boq':
      renderBOQReport(container, filteredItems);
      break;
    case 'workforce-payroll':
      renderWorkforcePayroll(container);
      break;
    case 'civil-estimator':
      renderCivilEstimator(container);
      break;
    case 'daily-hazira':
      renderDailyHazira(container);
      break;
    case 'flat-booking':
      renderFlatBooking(container);
      break;
    case 'supplier-khata':
      renderSupplierKhata(container);
      break;
    case 'site-photos':
      renderSitePhotos(container);
      break;
  }
}

// 1. Dashboard View (Minimalist & Staffing Integrated)
function renderDashboard(container, filteredItems) {
  let stdTotal = 0;
  let subTotal = 0;
  let lowCount = 0;

  filteredItems.forEach(i => {
    stdTotal += (i.quantity * i.standardPrice);
    subTotal += (i.quantity * i.subsidizedPrice);
    if (i.quantity <= i.minStockAlert) lowCount++;
  });

  const savings = stdTotal - subTotal;
  const savingsPct = stdTotal > 0 ? ((savings / stdTotal) * 100).toFixed(1) : 0;

  let activeStaffNeeded = 0;
  let activeStaffDeployed = 0;
  let activeLabourCost = 0;

  const relevantProjects = state.selectedProjectId === 'all'
    ? state.projects
    : state.projects.filter(p => p.id === state.selectedProjectId);

  relevantProjects.forEach(p => {
    activeStaffNeeded += Number(p.staffNeeded) || 0;
    activeStaffDeployed += Number(p.staffDeployed) || 0;
    activeLabourCost += (Number(p.staffDeployed) || 0) * (Number(p.dailyWageRate) || 650);
  });

  const staffRatio = activeStaffNeeded > 0
    ? Math.round((activeStaffDeployed / activeStaffNeeded) * 100)
    : 100;

  const currentProjName = state.selectedProjectId === 'all'
    ? 'All Construction Sites'
    : (state.projects.find(p => p.id === state.selectedProjectId)?.name || 'Selected Site');

  container.innerHTML = `
    <!-- Minimalist Shortcuts Bar -->
    <div class="shortcuts-bar">
      <div class="shortcuts-bar-info">
        <span class="shortcuts-bar-title">${currentProjName}</span>
        <span class="shortcuts-bar-sub">• ${filteredItems.length} materials tracked</span>
      </div>
      <div style="display:flex;gap:0.4rem;align-items:center;">
        <button class="btn btn-sm" onclick="openPresetsModal()">
          ⭐ Common Catalog <span class="kbd">Q</span>
        </button>
        <button class="btn btn-sm" onclick="openInwardModal()">
          📥 Receive Goods <span class="kbd">I</span>
        </button>
        <button class="btn btn-sm" onclick="openTransferModal()">
          🔄 Site Transfer <span class="kbd">T</span>
        </button>
        <button class="btn btn-primary btn-sm" onclick="openModal('modal-add-item')">
          ➕ New Material <span class="kbd">N</span>
        </button>
      </div>
    </div>

    <!-- 9:00 PM Automated WhatsApp Daily Briefing Banner -->
    <div style="background:var(--bg-card);border:1px solid var(--border-focus);border-left:4px solid var(--primary);padding:0.75rem 1.15rem;border-radius:var(--radius-sm);margin-bottom:1.15rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.75rem;box-shadow:0 2px 8px rgba(0,0,0,0.2);">
      <div style="display:flex;align-items:center;gap:0.75rem;">
        <div style="width:36px;height:36px;border-radius:var(--radius-sm);background:rgba(245,158,11,0.15);color:var(--primary);display:flex;align-items:center;justify-content:center;font-size:1.15rem;flex-shrink:0;">
          📲
        </div>
        <div>
          <div style="display:flex;align-items:center;gap:0.45rem;">
            <strong style="font-size:0.875rem;color:var(--text-main);">Daily Operations Briefing (9:00 PM Automation)</strong>
            <span class="badge badge-success" style="font-size:0.65rem;">🟢 Active Daily 9:00 PM IST</span>
          </div>
          <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">
            Compiles daily labor attendance, wage payouts, material inwards, and critical low stock warnings for Director (098631 77877).
          </div>
        </div>
      </div>

      <div style="display:flex;gap:0.4rem;align-items:center;">
        <button class="btn btn-sm btn-primary" onclick="openWhatsAppReportModal()">
          📲 View & Send Today's 9 PM Brief ↗
        </button>
      </div>
    </div>

    <!-- Minimalist KPI Grid (Financials + Workforce) -->
    <div class="kpi-grid">
      <!-- 1. Market vs Subsidized Valuation -->
      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Subsidized Material Cost</span>
          <span class="kpi-indicator" style="background:var(--accent-blue);"></span>
        </div>
        <div class="kpi-value">${formatCompactCurrency(subTotal)}</div>
        <div class="kpi-sub">
          <span>Market List Price:</span>
          <strong>${formatCurrency(stdTotal)}</strong>
        </div>
      </div>

      <!-- 2. Net Subsidy / Savings -->
      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Net Subsidy Saved</span>
          <span class="badge badge-success" style="font-size:0.675rem;">${savingsPct}% Saved</span>
        </div>
        <div class="kpi-value" style="color:var(--success);">${formatCompactCurrency(savings)}</div>
        <div class="kpi-sub">
          <span>Total savings: ${formatCurrency(savings)}</span>
        </div>
      </div>

      <!-- 3. Workforce / Staffing -->
      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">On-Site Workforce</span>
          <span class="badge ${staffRatio >= 85 ? 'badge-success' : 'badge-warning'}">
            ${staffRatio}% Staffed
          </span>
        </div>
        <div class="kpi-value">${activeStaffDeployed} <span style="font-size:0.95rem;font-weight:600;color:var(--text-muted);">/ ${activeStaffNeeded} Needed</span></div>
        <div class="kpi-sub">
          <span>Daily Wage Burn: <strong>${formatCompactCurrency(activeLabourCost)}/day</strong></span>
        </div>
      </div>

      <!-- 4. Health & Alerts -->
      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Stock Status</span>
          <span class="badge ${lowCount > 0 ? 'badge-danger' : 'badge-success'}">
            ${lowCount > 0 ? `${lowCount} Low Stock` : 'Healthy'}
          </span>
        </div>
        <div class="kpi-value">${filteredItems.length} <span style="font-size:0.95rem;font-weight:600;color:var(--text-muted);">Materials</span></div>
        <div class="kpi-sub">
          <span>${relevantProjects.length} Construction Sites Tracked</span>
        </div>
      </div>
    </div>

    <!-- Active Construction Sites Cards (Clicking opens dedicated Site Tab) -->
    <div class="content-card">
      <div class="card-header">
        <span class="card-title">🏢 Active Construction Sites (Click any project to open its dedicated command center)</span>
        <button class="btn btn-sm" onclick="switchTab('projects')">All Site Details →</button>
      </div>
      <div class="card-body">
        <div class="projects-grid">
          ${relevantProjects.map(p => {
            const pItems = state.inventory.filter(i => i.projectId === p.id);
            const pSub = pItems.reduce((acc, i) => acc + (i.quantity * i.subsidizedPrice), 0);
            const pStd = pItems.reduce((acc, i) => acc + (i.quantity * i.standardPrice), 0);
            const pSavings = pStd - pSub;
            const pLow = pItems.filter(i => i.quantity <= i.minStockAlert).length;
            const staffPct = p.staffNeeded > 0 ? Math.min(100, Math.round(((p.staffDeployed || 0) / p.staffNeeded) * 100)) : 100;
            const cleanPhone = (p.supervisorPhone || '').replace(/[^0-9]/g, '');

            return `
              <div class="project-card">
                <div>
                  <div class="project-card-top">
                    <div>
                      <span class="project-code-tag">${p.code}</span>
                      <span class="badge ${p.status === 'Active' ? 'badge-success' : 'badge-neutral'}" style="margin-left:0.3rem;">
                        ${p.status}
                      </span>
                      <h3 style="font-size:1rem;font-weight:700;margin-top:0.35rem;cursor:pointer;" onclick="openSiteDetail('${p.id}')">
                        ${p.name}
                      </h3>
                      <p style="font-size:0.75rem;color:var(--text-muted);">📍 ${p.location || 'Location'}</p>
                    </div>
                  </div>

                  <!-- Construction Phase & Completion % -->
                  <div class="progress-bar-wrap">
                    <div class="progress-bar-header">
                      <span style="font-weight:600;color:var(--text-main);">${p.constructionPhase || 'Civil Works'}</span>
                      <span style="font-weight:700;">${p.progressPct || 0}% Complete</span>
                    </div>
                    <div class="progress-track">
                      <div class="progress-fill" style="width:${p.progressPct || 0}%;"></div>
                    </div>
                  </div>

                  <!-- Workforce / Staffing Gauge -->
                  <div class="staff-gauge-box">
                    <div class="staff-gauge-header">
                      <span>👷 Staff: <strong>${p.staffDeployed || 0}</strong> / ${p.staffNeeded || 0} Workers</span>
                      <span class="badge ${staffPct >= 85 ? 'badge-success' : 'badge-warning'}" style="font-size:0.675rem;">
                        ${staffPct}%
                      </span>
                    </div>
                    <div class="staff-progress-track">
                      <div class="staff-progress-fill" style="width:${staffPct}%;background:${staffPct >= 85 ? 'var(--success)' : 'var(--warning)'};"></div>
                    </div>
                    
                    ${p.staffRoles ? `
                      <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:0.35rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${p.staffRoles}">
                        ${p.staffRoles}
                      </div>
                    ` : ''}

                    <div class="staff-controls-strip">
                      <span style="font-size:0.685rem;color:var(--text-muted);font-weight:600;">Attendance:</span>
                      <div style="display:flex;gap:0.25rem;">
                        <button class="staff-delta-btn" onclick="quickAdjustStaff('${p.id}', -5)">-5</button>
                        <button class="staff-delta-btn" onclick="quickAdjustStaff('${p.id}', -1)">-1</button>
                        <button class="staff-delta-btn" onclick="quickAdjustStaff('${p.id}', 1)">+1</button>
                        <button class="staff-delta-btn" onclick="quickAdjustStaff('${p.id}', 5)">+5</button>
                      </div>
                    </div>
                  </div>

                  <!-- Metrics -->
                  <div class="project-stats-grid">
                    <div class="stat-box">
                      <span class="stat-label">Subsidized Spend</span>
                      <span class="stat-val">${formatCompactCurrency(pSub)}</span>
                    </div>
                    <div class="stat-box">
                      <span class="stat-label">Subsidy Saved</span>
                      <span class="stat-val" style="color:var(--success);">${formatCompactCurrency(pSavings)}</span>
                    </div>
                  </div>

                  <!-- Supervisor + WhatsApp Quick Contact -->
                  <div style="display:flex;align-items:center;justify-content:space-between;margin:0.5rem 0;font-size:0.75rem;">
                    <div>
                      <span style="color:var(--text-muted);">In-Charge:</span>
                      <strong>${p.supervisorName || 'Supervisor'}</strong>
                    </div>
                    <div style="display:flex;gap:0.3rem;">
                      ${cleanPhone ? `
                        <a href="https://wa.me/${cleanPhone}?text=Hi%20${encodeURIComponent(p.supervisorName || '')},%20please%20send%20today%27s%20stock%20and%20staff%20report%20for%20${encodeURIComponent(p.name)}" target="_blank" class="contact-btn wa" title="WhatsApp Supervisor">
                          💬 WhatsApp
                        </a>
                        <a href="tel:${p.supervisorPhone}" class="contact-btn" title="Call">
                          📞 Call
                        </a>
                      ` : ''}
                    </div>
                  </div>
                </div>

                <div style="display:flex;gap:0.35rem;margin-top:0.5rem;">
                  <button class="btn btn-primary btn-sm" style="flex:1;" onclick="openSiteDetail('${p.id}')">
                    📍 Open Site Command Center →
                  </button>
                  <button class="btn btn-secondary btn-sm" onclick="openInwardModalForProject('${p.id}')">
                    + Receive
                  </button>
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    </div>

    <!-- Quick Stock Adjustments Table -->
    <div class="content-card">
      <div class="card-header">
        <span class="card-title">⚡ Rapid Material Updates (1-Click +/-)</span>
        <button class="btn btn-sm" onclick="switchTab('inventory')">View Full Inventory →</button>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Material</th>
              <th>Site</th>
              <th>Current Stock</th>
              <th>Subsidized Rate</th>
              <th>Total Cost</th>
              <th>Delivery Status</th>
              <th>Quick Increment</th>
            </tr>
          </thead>
          <tbody>
            ${filteredItems.slice(0, 8).map(item => {
              const proj = state.projects.find(p => p.id === item.projectId);
              const isLow = item.quantity <= item.minStockAlert;
              const subVal = item.quantity * item.subsidizedPrice;

              return `
                <tr>
                  <td>
                    <div class="cell-bold">${item.name}</div>
                    <div class="cell-sub">${item.category} • SKU: ${item.sku}</div>
                  </td>
                  <td>
                    <span class="project-code-tag" style="cursor:pointer;" onclick="openSiteDetail('${item.projectId}')">${proj?.code || 'SITE'}</span>
                  </td>
                  <td>
                    <span class="badge ${isLow ? 'badge-warning' : 'badge-neutral'}">
                      ${formatQty(item.quantity)} ${item.unit}
                    </span>
                    ${isLow ? `<span class="cell-sub" style="color:var(--danger);margin-left:0.25rem;">(Min: ${item.minStockAlert})</span>` : ''}
                  </td>
                  <td>
                    <div class="cell-bold">${formatCurrency(item.subsidizedPrice)}</div>
                    <div class="cell-sub" style="color:var(--success);">${item.subsidyScheme || 'Subsidized'}</div>
                  </td>
                  <td>
                    <div class="cell-bold">${formatCurrency(subVal)}</div>
                  </td>
                  <td>
                    <span class="badge badge-neutral">${item.deliveryETA || 'In Stock'}</span>
                  </td>
                  <td>
                    <div style="display:flex;gap:0.25rem;">
                      <button class="quick-delta-btn sub" onclick="quickAdjustStock('${item.id}', -10)">-10</button>
                      <button class="quick-delta-btn add" onclick="quickAdjustStock('${item.id}', 10)">+10</button>
                      <button class="quick-delta-btn add" onclick="quickAdjustStock('${item.id}', 50)">+50</button>
                      <button class="quick-delta-btn add" onclick="quickAdjustStock('${item.id}', 100)">+100</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

  `;
}

// 2. Sites & Projects Tab (All Sites Overview)
function renderProjects(container) {
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:0.5rem;">
      <div>
        <h2 style="font-size:1.15rem;font-weight:700;">Site Projects & Workforce Directory</h2>
        <p style="font-size:0.775rem;color:var(--text-muted);">
          Click on any site to launch its dedicated single-project command center tab.
        </p>
      </div>
      <button class="btn btn-primary btn-sm" onclick="openModal('modal-add-project')">
        ➕ New Site Project <span class="kbd">P</span>
      </button>
    </div>

    <div class="projects-grid">
      ${state.projects.map(p => {
        const pItems = state.inventory.filter(i => i.projectId === p.id);
        const stdCost = pItems.reduce((acc, i) => acc + (i.quantity * i.standardPrice), 0);
        const subCost = pItems.reduce((acc, i) => acc + (i.quantity * i.subsidizedPrice), 0);
        const savings = stdCost - subCost;
        const lowStock = pItems.filter(i => i.quantity <= i.minStockAlert).length;
        const staffPct = p.staffNeeded > 0 ? Math.min(100, Math.round(((p.staffDeployed || 0) / p.staffNeeded) * 100)) : 100;
        const cleanPhone = (p.supervisorPhone || '').replace(/[^0-9]/g, '');

        return `
          <div class="project-card">
            <div>
              <div class="project-card-top">
                <div>
                  <span class="project-code-tag">${p.code}</span>
                  <span class="badge ${p.status === 'Active' ? 'badge-success' : 'badge-neutral'}" style="margin-left:0.3rem;">
                    ${p.status}
                  </span>
                  <h3 style="font-size:1.05rem;font-weight:700;margin-top:0.35rem;cursor:pointer;" onclick="openSiteDetail('${p.id}')">
                    ${p.name}
                  </h3>
                  <p style="font-size:0.75rem;color:var(--text-muted);">📍 ${p.location || 'Location'}</p>
                </div>
                <button class="btn btn-sm" onclick="editProjectModal('${p.id}')">✏️ Edit</button>
              </div>

              <!-- Phase & Progress -->
              <div class="progress-bar-wrap">
                <div class="progress-bar-header">
                  <span style="font-weight:600;">Phase: ${p.constructionPhase || 'Civil Framing'}</span>
                  <span style="font-weight:700;">${p.progressPct || 0}% Complete</span>
                </div>
                <div class="progress-track">
                  <div class="progress-fill" style="width:${p.progressPct || 0}%;"></div>
                </div>
              </div>

              <!-- Workforce Details -->
              <div class="staff-gauge-box">
                <div class="staff-gauge-header">
                  <span>👷 Manpower: <strong>${p.staffDeployed || 0}</strong> / ${p.staffNeeded || 0} Deployed</span>
                  <span class="badge ${staffPct >= 85 ? 'badge-success' : 'badge-warning'}">
                    ${staffPct}% Staffed
                  </span>
                </div>
                <div class="staff-progress-track">
                  <div class="staff-progress-fill" style="width:${staffPct}%;background:${staffPct >= 85 ? 'var(--success)' : 'var(--warning)'};"></div>
                </div>
                
                ${p.staffRoles ? `
                  <div style="font-size:0.7rem;color:var(--text-muted);margin-bottom:0.4rem;">
                    Trades: <strong>${p.staffRoles}</strong>
                  </div>
                ` : ''}

                <div class="staff-controls-strip">
                  <span style="font-size:0.7rem;color:var(--text-muted);font-weight:600;">
                    Daily Wage: ₹ ${(Number(p.staffDeployed || 0) * Number(p.dailyWageRate || 650)).toLocaleString('en-IN')}/day
                  </span>
                  <div style="display:flex;gap:0.25rem;">
                    <button class="staff-delta-btn" onclick="quickAdjustStaff('${p.id}', -5)">-5</button>
                    <button class="staff-delta-btn" onclick="quickAdjustStaff('${p.id}', -1)">-1</button>
                    <button class="staff-delta-btn" onclick="quickAdjustStaff('${p.id}', 1)">+1</button>
                    <button class="staff-delta-btn" onclick="quickAdjustStaff('${p.id}', 5)">+5</button>
                  </div>
                </div>
              </div>

              <!-- Financials -->
              <div class="project-stats-grid">
                <div class="stat-box">
                  <span class="stat-label">Subsidized Spend</span>
                  <span class="stat-val">${formatCompactCurrency(subCost)}</span>
                </div>
                <div class="stat-box">
                  <span class="stat-label">Subsidy Saved</span>
                  <span class="stat-val" style="color:var(--success);">${formatCompactCurrency(savings)}</span>
                </div>
                <div class="stat-box">
                  <span class="stat-label">Budget</span>
                  <span class="stat-val">${formatCompactCurrency(p.budget)}</span>
                </div>
                <div class="stat-box">
                  <span class="stat-label">Stock Items</span>
                  <span class="stat-val">${pItems.length} (${lowStock} low)</span>
                </div>
              </div>

              <!-- Supervisor Quick Connect -->
              <div style="display:flex;align-items:center;justify-content:space-between;margin:0.5rem 0;font-size:0.75rem;">
                <div>
                  <span style="color:var(--text-muted);">Supervisor:</span>
                  <strong>${p.supervisorName || 'Not assigned'}</strong>
                </div>
                <div style="display:flex;gap:0.3rem;">
                  ${cleanPhone ? `
                    <a href="https://wa.me/${cleanPhone}?text=Hi%20${encodeURIComponent(p.supervisorName || '')},%20please%20send%20today%27s%20stock%20and%20staff%20report%20for%20${encodeURIComponent(p.name)}" target="_blank" class="contact-btn wa">
                      💬 WhatsApp
                    </a>
                    <a href="tel:${p.supervisorPhone}" class="contact-btn">
                      📞 Call
                    </a>
                  ` : ''}
                </div>
              </div>
            </div>

            <div style="display:flex;gap:0.35rem;margin-top:0.6rem;">
              <button class="btn btn-primary btn-sm" style="flex:1;" onclick="openSiteDetail('${p.id}')">
                📍 Open Site Command Center →
              </button>
              <button class="btn btn-secondary btn-sm" onclick="openInwardModalForProject('${p.id}')">
                + Inward Delivery
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;
}

// --------------------------------------------------------------------
// 3. DEDICATED SITE DETAIL COMMAND CENTER TAB (Complete Specific Project View)
// --------------------------------------------------------------------
function renderSiteDetail(container) {
  // If selectedProjectId is 'all', pick the first project
  const projectId = state.selectedProjectId !== 'all' ? state.selectedProjectId : (state.projects[0]?.id || null);
  const project = state.projects.find(p => p.id === projectId);

  if (!project) {
    container.innerHTML = `
      <div class="content-card" style="padding:2rem;text-align:center;">
        <h3>No project selected</h3>
        <p style="color:var(--text-muted);font-size:0.85rem;margin:0.5rem 0 1rem 0;">Please select a project to view its command center.</p>
        <button class="btn btn-primary btn-sm" onclick="switchTab('projects')">View All Projects</button>
      </div>
    `;
    return;
  }

  // Filter items and transactions for this project only
  let siteItems = state.inventory.filter(i => i.projectId === project.id);
  if (state.siteSearchQuery) {
    siteItems = siteItems.filter(i =>
      i.name.toLowerCase().includes(state.siteSearchQuery) ||
      i.category.toLowerCase().includes(state.siteSearchQuery) ||
      (i.sku && i.sku.toLowerCase().includes(state.siteSearchQuery))
    );
  }
  if (state.siteFilterCategory && state.siteFilterCategory !== 'all') {
    siteItems = siteItems.filter(i => i.category === state.siteFilterCategory);
  }

  const siteTx = state.transactions.filter(t => t.projectId === project.id || t.toProjectId === project.id);
  const siteEmployees = state.employees.filter(e => e.assignedProjectId === project.id);
  const sitePayments = state.salaryPayments.filter(p => p.projectId === project.id);
  const siteDailyWageBurn = siteEmployees.filter(e => e.status === 'Active' && e.wageType === 'Daily Wage').reduce((acc, e) => acc + (Number(e.wageRate) || 0), 0);
  const siteMonthlySalary = siteEmployees.filter(e => e.status === 'Active' && e.wageType === 'Monthly Salary').reduce((acc, e) => acc + (Number(e.wageRate) || 0), 0);
  const siteTotalPaid = sitePayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const siteTotalAdvances = sitePayments.filter(p => p.type === 'Advance Payout').reduce((acc, p) => acc + (Number(p.amount) || 0), 0);

  const stdCost = siteItems.reduce((acc, i) => acc + (i.quantity * i.standardPrice), 0);
  const subCost = siteItems.reduce((acc, i) => acc + (i.quantity * i.subsidizedPrice), 0);
  const savings = stdCost - subCost;
  const savingsPct = stdCost > 0 ? ((savings / stdCost) * 100).toFixed(1) : 0;
  const lowStockCount = siteItems.filter(i => i.quantity <= i.minStockAlert).length;
  const budgetUsedPct = project.budget > 0 ? Math.min(100, Math.round((subCost / project.budget) * 100)) : 0;
  const staffPct = project.staffNeeded > 0 ? Math.min(100, Math.round(((project.staffDeployed || 0) / project.staffNeeded) * 100)) : 100;
  const cleanPhone = (project.supervisorPhone || '').replace(/[^0-9]/g, '');
  const dailyWage = (Number(project.staffDeployed || 0) * Number(project.dailyWageRate || 650));

  container.innerHTML = `
    <!-- Top Context & Action Bar for this Specific Site -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:0.65rem;">
      <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
        <button class="btn btn-sm" onclick="switchTab('projects')">← All Sites</button>
        <span class="project-code-tag">${project.code}</span>
        <h2 style="font-size:1.25rem;font-weight:800;letter-spacing:-0.02em;">${project.name}</h2>
        <span class="badge ${project.status === 'Active' ? 'badge-success' : 'badge-neutral'}">${project.status}</span>
        <span style="font-size:0.775rem;color:var(--text-muted);">• ${project.type}</span>
      </div>

      <div style="display:flex;gap:0.35rem;align-items:center;flex-wrap:wrap;">
        <button class="btn btn-secondary btn-sm" onclick="openInwardModalForProject('${project.id}')">
          📥 Receive Material <span class="kbd">I</span>
        </button>
        <button class="btn btn-sm" onclick="openPresetsModalForProject('${project.id}')">
          ⭐ 1-Click Catalog <span class="kbd">Q</span>
        </button>
        <button class="btn btn-sm" onclick="openTransferModalForProject('${project.id}')">
          🔄 Transfer Stock <span class="kbd">T</span>
        </button>
        <button class="btn btn-sm" onclick="openOutwardModalForProject('${project.id}')">
          📤 Issue Material <span class="kbd">O</span>
        </button>
        <button class="btn btn-sm" onclick="printSiteBOQ('${project.id}')">
          🖨️ Print BOQ
        </button>
        <button class="btn btn-sm" onclick="editProjectModal('${project.id}')">
          ✏️ Edit Site
        </button>
      </div>
    </div>

    <!-- 4 KPI Cards Specific to this Project -->
    <div class="kpi-grid">
      <!-- 1. Site Financial Spend -->
      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Site Material Cost</span>
          <span class="kpi-indicator" style="background:var(--accent-blue);"></span>
        </div>
        <div class="kpi-value">${formatCompactCurrency(subCost)}</div>
        <div class="kpi-sub">
          <span>Standard list:</span>
          <strong>${formatCurrency(stdCost)}</strong>
        </div>
      </div>

      <!-- 2. Site Subsidies Saved -->
      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Subsidy Savings on Site</span>
          <span class="badge badge-success" style="font-size:0.675rem;">${savingsPct}% Saved</span>
        </div>
        <div class="kpi-value" style="color:var(--success);">${formatCompactCurrency(savings)}</div>
        <div class="kpi-sub">
          <span>Total saved: <strong>${formatCurrency(savings)}</strong></span>
        </div>
      </div>

      <!-- 3. Site Workforce & Attendance -->
      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Site Manpower</span>
          <span class="badge ${staffPct >= 85 ? 'badge-success' : 'badge-warning'}">
            ${staffPct}% Staffed
          </span>
        </div>
        <div class="kpi-value">
          ${project.staffDeployed || 0} <span style="font-size:0.95rem;font-weight:600;color:var(--text-muted);">/ ${project.staffNeeded || 0} Needed</span>
        </div>
        <div class="kpi-sub">
          <span>Wage Burn: <strong>₹ ${dailyWage.toLocaleString('en-IN')}/day</strong></span>
        </div>
      </div>

      <!-- 4. Site Stock & Health -->
      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Site Materials Health</span>
          <span class="badge ${lowStockCount > 0 ? 'badge-danger' : 'badge-success'}">
            ${lowStockCount > 0 ? `${lowStockCount} Low Stock` : 'Healthy'}
          </span>
        </div>
        <div class="kpi-value">${siteItems.length} <span style="font-size:0.95rem;font-weight:600;color:var(--text-muted);">Items</span></div>
        <div class="kpi-sub">
          <span>Target Completion: <strong>${formatDate(project.targetCompletion)}</strong></span>
        </div>
      </div>
    </div>

    <!-- Project Civil Progress, Workforce & Supervisor Hub -->
    <div style="display:grid;grid-template-columns:1.5fr 1fr;gap:0.85rem;margin-bottom:1.25rem;">
      <!-- Civil Phase & Manpower Breakdown -->
      <div class="content-card" style="margin-bottom:0;">
        <div class="card-header">
          <span class="card-title">🏗️ Civil Milestone & Daily Workforce</span>
          <span style="font-size:0.75rem;font-weight:600;">Phase: <strong>${project.constructionPhase || 'Civil Framing'}</strong></span>
        </div>
        <div class="card-body">
          <!-- Civil progress bar -->
          <div style="margin-bottom:1rem;">
            <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:0.25rem;">
              <span>Site Completion Progress</span>
              <span style="font-weight:700;">${project.progressPct || 0}% Complete</span>
            </div>
            <div class="progress-track" style="height:8px;">
              <div class="progress-fill" style="width:${project.progressPct || 0}%;"></div>
            </div>
          </div>

          <!-- Material Budget bar -->
          <div style="margin-bottom:1rem;">
            <div style="display:flex;justify-content:space-between;font-size:0.75rem;margin-bottom:0.25rem;">
              <span>Material Spend vs Budget (${budgetUsedPct}%)</span>
              <span>Budget: <strong>${formatCurrency(project.budget)}</strong></span>
            </div>
            <div class="progress-track" style="height:8px;">
              <div class="progress-fill" style="width:${budgetUsedPct}%;background:${budgetUsedPct > 85 ? 'var(--danger)' : 'var(--primary)'};"></div>
            </div>
          </div>

          <!-- Staffing Gauge & 1-Click Attendance Buttons -->
          <div class="staff-gauge-box" style="margin:0;">
            <div class="staff-gauge-header">
              <span>👷 Today's Attendance: <strong>${project.staffDeployed || 0}</strong> / ${project.staffNeeded || 0} Workers</span>
              <span class="badge ${staffPct >= 85 ? 'badge-success' : 'badge-warning'}">${staffPct}% Staffed</span>
            </div>
            <div class="staff-progress-track" style="height:7px;">
              <div class="staff-progress-fill" style="width:${staffPct}%;background:${staffPct >= 85 ? 'var(--success)' : 'var(--warning)'};"></div>
            </div>

            <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.4rem;">
              Active Trades: <strong>${project.staffRoles || 'General Masons, Barbenders, Helpers'}</strong>
            </div>

            <div class="staff-controls-strip">
              <span style="font-size:0.725rem;font-weight:600;">Fast Attendance Adjustment:</span>
              <div style="display:flex;gap:0.25rem;">
                <button class="staff-delta-btn" onclick="quickAdjustStaff('${project.id}', -5)">-5</button>
                <button class="staff-delta-btn" onclick="quickAdjustStaff('${project.id}', -1)">-1</button>
                <button class="staff-delta-btn" onclick="quickAdjustStaff('${project.id}', 1)">+1</button>
                <button class="staff-delta-btn" onclick="quickAdjustStaff('${project.id}', 5)">+5</button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Supervisor & Site Logistics Card -->
      <div class="content-card" style="margin-bottom:0;">
        <div class="card-header">
          <span class="card-title">👷 Site Supervisor & Logistics</span>
        </div>
        <div class="card-body">
          <div style="margin-bottom:0.85rem;">
            <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Supervisor In-Charge:</div>
            <div style="font-size:1.05rem;font-weight:700;margin-top:0.15rem;">${project.supervisorName || 'Unassigned'}</div>
            <div style="font-size:0.785rem;color:var(--text-muted);margin-top:0.15rem;">📞 ${project.supervisorPhone || 'No phone'}</div>
          </div>

          <!-- WhatsApp & Phone Direct Buttons -->
          <div style="display:flex;gap:0.4rem;margin-bottom:0.85rem;">
            ${cleanPhone ? `
              <a href="https://wa.me/${cleanPhone}?text=Hi%20${encodeURIComponent(project.supervisorName || '')},%20please%20send%20today%27s%20stock%20and%20staff%20report%20for%20${encodeURIComponent(project.name)}" target="_blank" class="contact-btn wa" style="flex:1;justify-content:center;padding:0.45rem;">
                💬 WhatsApp Supervisor
              </a>
              <a href="tel:${project.supervisorPhone}" class="contact-btn" style="flex:1;justify-content:center;padding:0.45rem;">
                📞 Call
              </a>
            ` : '<div style="font-size:0.75rem;color:var(--text-muted);">Add phone in edit to enable WhatsApp</div>'}
          </div>

          <div style="padding-top:0.65rem;border-top:1px solid var(--border);">
            <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Location & Storage:</div>
            <div style="font-size:0.8rem;margin-top:0.15rem;">📍 ${project.location || 'Site Location'}</div>
            ${project.notes ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-top:0.35rem;">${project.notes}</div>` : ''}
          </div>
        </div>
      </div>
    </div>

    <!-- Materials Inventory Allocated to this Specific Site -->
    <div class="content-card">
      <div class="card-header">
        <span class="card-title">📦 Materials Inventory on this Site (${siteItems.length})</span>
        <div style="display:flex;gap:0.4rem;align-items:center;">
          <input type="text" placeholder="Search site materials..." value="${state.siteSearchQuery || ''}" oninput="onSiteSearchInput(this.value)" style="padding:0.35rem 0.6rem;font-size:0.775rem;border:1px solid var(--border);border-radius:var(--radius-sm);background:var(--bg-card);color:var(--text-main);min-width:180px;">
          <button class="btn btn-sm" onclick="openPresetsModalForProject('${project.id}')">⭐ 1-Click Catalog</button>
          <button class="btn btn-primary btn-sm" onclick="openAddItemModalForProject('${project.id}')">➕ New Material</button>
        </div>
      </div>

      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Material Description & SKU</th>
              <th>Category</th>
              <th>Available Stock</th>
              <th>Standard Rate</th>
              <th>Subsidized Rate</th>
              <th>Total Cost</th>
              <th>Subsidy Saved</th>
              <th>Delivery Status</th>
              <th>1-Click Shortcuts</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${siteItems.length === 0 ? `
              <tr>
                <td colspan="10" style="text-align:center;padding:2rem;color:var(--text-muted);">
                  No materials recorded on this site yet.
                  <div style="margin-top:0.5rem;">
                    <button class="btn btn-sm" onclick="openPresetsModalForProject('${project.id}')">Add Materials from Common Catalog</button>
                  </div>
                </td>
              </tr>
            ` : siteItems.map(item => {
              const isLow = item.quantity <= item.minStockAlert;
              const isOut = item.quantity <= 0;
              const itemStdVal = item.quantity * item.standardPrice;
              const itemSubVal = item.quantity * item.subsidizedPrice;
              const itemSavings = itemStdVal - itemSubVal;
              const itemSavingsPct = item.standardPrice > 0 ? (((item.standardPrice - item.subsidizedPrice) / item.standardPrice) * 100).toFixed(0) : 0;

              return `
                <tr>
                  <td>
                    <div class="cell-bold">${item.name}</div>
                    <div class="cell-sub">
                      <span class="project-code-tag">${item.sku || 'MAT'}</span>
                      ${item.locationInSite ? `• ${item.locationInSite}` : ''}
                    </div>
                  </td>
                  <td>
                    <span class="badge badge-neutral">${item.category}</span>
                  </td>
                  <td>
                    <span class="badge ${isOut ? 'badge-danger' : (isLow ? 'badge-warning' : 'badge-neutral')}" style="font-weight:700;">
                      ${formatQty(item.quantity)} ${item.unit}
                    </span>
                    ${isLow ? `<div class="cell-sub" style="color:var(--danger);">Min: ${item.minStockAlert}</div>` : ''}
                  </td>
                  <td>
                    <div>${formatCurrency(item.standardPrice)}</div>
                    <div class="cell-sub">per ${item.unit}</div>
                  </td>
                  <td>
                    <div class="cell-bold">${formatCurrency(item.subsidizedPrice)}</div>
                    <div class="cell-sub" style="color:var(--success);">${itemSavingsPct > 0 ? `-${itemSavingsPct}% Subsidy` : 'Standard'}</div>
                  </td>
                  <td>
                    <div class="cell-bold">${formatCurrency(itemSubVal)}</div>
                  </td>
                  <td>
                    <div class="cell-bold" style="color:var(--success);">${formatCurrency(itemSavings)}</div>
                    <div class="cell-sub" style="font-size:0.685rem;">${item.subsidyScheme || ''}</div>
                  </td>
                  <td>
                    <span class="badge badge-neutral">${item.deliveryETA || 'In Stock'}</span>
                  </td>
                  <td>
                    <div style="display:flex;gap:0.25rem;">
                      <button class="quick-delta-btn sub" onclick="quickAdjustStock('${item.id}', -10)">-10</button>
                      <button class="quick-delta-btn add" onclick="quickAdjustStock('${item.id}', 10)">+10</button>
                      <button class="quick-delta-btn add" onclick="quickAdjustStock('${item.id}', 50)">+50</button>
                      <button class="quick-delta-btn add" onclick="quickAdjustStock('${item.id}', 100)">+100</button>
                    </div>
                  </td>
                  <td>
                    <div style="display:flex;gap:0.25rem;">
                      <button class="btn btn-sm" title="Edit" onclick="editItemModal('${item.id}')">✏️</button>
                      <button class="btn btn-sm" title="Transfer" onclick="openTransferModalForItem('${item.id}')">🔄</button>
                      <button class="btn btn-danger btn-sm" title="Delete" onclick="deleteItem('${item.id}')">🗑️</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Movement & Delivery Slips for this Site -->
    <div class="content-card">
      <div class="card-header">
        <span class="card-title">📋 Recent Deliveries & Movements for ${project.name} (${siteTx.length})</span>
        <button class="btn btn-secondary btn-sm" onclick="openInwardModalForProject('${project.id}')">+ Log Inward Slip</button>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Operation</th>
              <th>Challan / Slip #</th>
              <th>Material</th>
              <th>Quantity</th>
              <th>Subsidized Value</th>
              <th>Vehicle / Notes</th>
              <th>Received By</th>
            </tr>
          </thead>
          <tbody>
            ${siteTx.length === 0 ? `
              <tr>
                <td colspan="8" style="text-align:center;padding:1.5rem;color:var(--text-muted);">
                  No delivery slips or movements recorded for this site yet.
                </td>
              </tr>
            ` : siteTx.map(tx => {
              const typeBadge = tx.type === 'INWARD' ? 'badge-success' : (tx.type === 'TRANSFER' ? 'badge-info' : 'badge-neutral');
              return `
                <tr>
                  <td>
                    <div style="font-weight:600;">${formatDate(tx.date)}</div>
                    <div class="cell-sub">${new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td><span class="badge ${typeBadge}">${tx.type}</span></td>
                  <td><span class="cell-bold">${tx.challanNo || '—'}</span></td>
                  <td>
                    <div class="cell-bold">${tx.itemName}</div>
                    <div class="cell-sub">${tx.notes || ''}</div>
                  </td>
                  <td>
                    <span class="badge badge-neutral">${formatQty(tx.quantity)} ${tx.unit}</span>
                  </td>
                  <td><span class="cell-bold">${formatCurrency(tx.totalValue)}</span></td>
                  <td><div>${tx.vehicleNo || 'Direct'}</div></td>
                  <td><div>${tx.receivedBy || 'Staff'}</div></td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- Assigned Site Workforce & Salary History -->
    <div class="content-card">
      <div class="card-header">
        <span class="card-title">👥 Site Workforce & Salaries (${siteEmployees.length} Workers Assigned)</span>
        <div style="display:flex;gap:0.4rem;align-items:center;">
          <button class="btn btn-sm" onclick="openSalaryModal(null, '${project.id}')">💰 Pay Site Worker</button>
          <button class="btn btn-primary btn-sm" onclick="openAddEmployeeModal(null, '${project.id}')">➕ Assign Worker</button>
        </div>
      </div>
      <div class="card-body">
        <!-- Site workforce summary strip -->
        <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(170px, 1fr));gap:0.75rem;margin-bottom:1rem;background:var(--bg-subtle);padding:0.75rem;border-radius:var(--radius-sm);border:1px solid var(--border);">
          <div>
            <div style="font-size:0.7rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;">Daily Wage Burn</div>
            <div style="font-size:1rem;font-weight:700;color:var(--text-main);">₹ ${siteDailyWageBurn.toLocaleString('en-IN')}/day</div>
            <div style="font-size:0.7rem;color:var(--text-muted);">${siteEmployees.filter(e => e.status === 'Active' && e.wageType === 'Daily Wage').length} Daily Wage Workers</div>
          </div>
          <div>
            <div style="font-size:0.7rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;">Monthly Salary Liability</div>
            <div style="font-size:1rem;font-weight:700;color:var(--text-main);">₹ ${siteMonthlySalary.toLocaleString('en-IN')}/mo</div>
            <div style="font-size:0.7rem;color:var(--text-muted);">${siteEmployees.filter(e => e.status === 'Active' && e.wageType === 'Monthly Salary').length} Monthly Staff</div>
          </div>
          <div>
            <div style="font-size:0.7rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;">Total Site Payouts</div>
            <div style="font-size:1rem;font-weight:700;color:var(--accent-blue);">₹ ${siteTotalPaid.toLocaleString('en-IN')}</div>
            <div style="font-size:0.7rem;color:var(--text-muted);">${sitePayments.length} Disbursements logged</div>
          </div>
          <div>
            <div style="font-size:0.7rem;color:var(--text-muted);font-weight:600;text-transform:uppercase;">Site Advances Given</div>
            <div style="font-size:1rem;font-weight:700;color:var(--warning);">₹ ${siteTotalAdvances.toLocaleString('en-IN')}</div>
            <div style="font-size:0.7rem;color:var(--text-muted);">To be recovered</div>
          </div>
        </div>

        <!-- Site Workers Table -->
        <div class="table-responsive">
          <table class="data-table">
            <thead>
              <tr>
                <th>Worker / Staff Member</th>
                <th>Trade / Role</th>
                <th>Wage Structure</th>
                <th>Direct Contact</th>
                <th>Total Paid Here</th>
                <th>Advance Balance</th>
                <th>Status</th>
                <th style="text-align:right;">Actions</th>
              </tr>
            </thead>
            <tbody>
              ${siteEmployees.length === 0 ? `
                <tr>
                  <td colspan="8" style="text-align:center;padding:1.5rem;color:var(--text-muted);">
                    No individual workers assigned to this site yet. Click "Assign Worker" to register masons, supervisors or laborers.
                  </td>
                </tr>
              ` : siteEmployees.map(emp => {
                const empPaid = sitePayments.filter(p => p.employeeId === emp.id).reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
                const empAdvance = sitePayments.filter(p => p.employeeId === emp.id && p.type === 'Advance Payout').reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
                const cleanEmpPhone = (emp.phone || '').replace(/[^0-9]/g, '');

                return `
                  <tr>
                    <td>
                      <div class="cell-bold">${emp.name}</div>
                      <div class="cell-sub">${emp.idProof || 'Joined ' + formatDate(emp.joiningDate)}</div>
                    </td>
                    <td>
                      <span class="badge badge-neutral">${emp.role}</span>
                    </td>
                    <td>
                      <div style="font-weight:600;">₹ ${(Number(emp.wageRate) || 0).toLocaleString('en-IN')} <span style="font-size:0.725rem;font-weight:normal;color:var(--text-muted);">${emp.wageType === 'Daily Wage' ? '/ day' : '/ month'}</span></div>
                    </td>
                    <td>
                      <div style="display:flex;align-items:center;gap:0.35rem;">
                        <a href="tel:${emp.phone}" style="color:var(--text-main);font-size:0.775rem;text-decoration:none;">${emp.phone || '—'}</a>
                        ${cleanEmpPhone ? `
                          <a href="https://wa.me/${cleanEmpPhone}?text=Hi%20${encodeURIComponent(emp.name)},%20regarding%20work%20at%20${encodeURIComponent(project.name)}" target="_blank" class="contact-btn wa" style="padding:0.2rem 0.4rem;font-size:0.65rem;" title="WhatsApp">
                            💬
                          </a>
                        ` : ''}
                      </div>
                    </td>
                    <td>
                      <span class="cell-bold">₹ ${empPaid.toLocaleString('en-IN')}</span>
                    </td>
                    <td>
                      ${empAdvance > 0 ? `<span class="badge badge-warning">₹ ${empAdvance.toLocaleString('en-IN')}</span>` : '<span style="color:var(--text-muted);font-size:0.75rem;">₹ 0</span>'}
                    </td>
                    <td>
                      <span class="badge ${emp.status === 'Active' ? 'badge-success' : (emp.status === 'On Leave' ? 'badge-warning' : 'badge-neutral')}">${emp.status}</span>
                    </td>
                    <td style="text-align:right;">
                      <div style="display:inline-flex;gap:0.3rem;">
                        <button class="btn btn-xs btn-primary" onclick="openSalaryModal('${emp.id}', '${project.id}')" title="Pay Salary / Wage">
                          💰 Pay
                        </button>
                        <button class="btn btn-xs" onclick="openAddEmployeeModal('${emp.id}')" title="Edit Worker">
                          ✏️
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  `;
}

function onSiteSearchInput(val) {
  state.siteSearchQuery = val.toLowerCase().trim();
  renderActiveTab();
}

function openAddItemModalForProject(projectId) {
  openModal('modal-add-item');
  const projSelect = document.getElementById('item-project');
  if (projSelect) projSelect.value = projectId;
}

function openPresetsModalForProject(projectId) {
  openPresetsModal();
  const projSelect = document.getElementById('preset-target-project');
  if (projSelect) projSelect.value = projectId;
}

function openTransferModalForProject(projectId) {
  openTransferModal();
}

function openOutwardModalForProject(projectId) {
  openOutwardModal();
}

function printSiteBOQ(projectId) {
  state.selectedProjectId = projectId;
  switchTab('boq');
  setTimeout(() => window.print(), 300);
}

// ----------------------------------------------------
// 4. FULL INVENTORY MANAGEMENT VIEW
// ----------------------------------------------------
function renderInventoryTable(container, filteredItems) {
  const stdSum = filteredItems.reduce((acc, i) => acc + (i.quantity * i.standardPrice), 0);
  const subSum = filteredItems.reduce((acc, i) => acc + (i.quantity * i.subsidizedPrice), 0);
  const savSum = stdSum - subSum;

  container.innerHTML = `
    <div class="content-card">
      <div class="filter-toolbar">
        <div class="search-input-wrap">
          <span class="search-icon-pos">🔍</span>
          <input type="text" id="global-search-input" placeholder="Search material name, SKU, vendor... (/)" value="${state.searchQuery}">
        </div>

        <div class="filter-selects-group">
          <select id="filter-category-select">
            <option value="all" ${state.filterCategory === 'all' ? 'selected' : ''}>All Categories</option>
            <option value="Cement & Binding" ${state.filterCategory === 'Cement & Binding' ? 'selected' : ''}>Cement & Binding</option>
            <option value="Steel & Structural" ${state.filterCategory === 'Steel & Structural' ? 'selected' : ''}>Steel & Structural</option>
            <option value="Masonry & Bricks" ${state.filterCategory === 'Masonry & Bricks' ? 'selected' : ''}>Masonry & Bricks</option>
            <option value="Aggregates & Sand" ${state.filterCategory === 'Aggregates & Sand' ? 'selected' : ''}>Aggregates & Sand</option>
            <option value="Plumbing & Sanitary" ${state.filterCategory === 'Plumbing & Sanitary' ? 'selected' : ''}>Plumbing & Sanitary</option>
            <option value="Electrical & Wiring" ${state.filterCategory === 'Electrical & Wiring' ? 'selected' : ''}>Electrical & Wiring</option>
            <option value="Tiles & Flooring" ${state.filterCategory === 'Tiles & Flooring' ? 'selected' : ''}>Tiles & Flooring</option>
            <option value="Paints & Waterproofing" ${state.filterCategory === 'Paints & Waterproofing' ? 'selected' : ''}>Paints & Waterproofing</option>
            <option value="Lumber & Formwork" ${state.filterCategory === 'Lumber & Formwork' ? 'selected' : ''}>Lumber & Formwork</option>
            <option value="Tools & Hardware" ${state.filterCategory === 'Tools & Hardware' ? 'selected' : ''}>Tools & Hardware</option>
          </select>

          <select id="filter-status-select">
            <option value="all" ${state.filterStatus === 'all' ? 'selected' : ''}>All Stock Status</option>
            <option value="low" ${state.filterStatus === 'low' ? 'selected' : ''}>Low Stock Alert</option>
            <option value="out" ${state.filterStatus === 'out' ? 'selected' : ''}>Out of Stock</option>
            <option value="ok" ${state.filterStatus === 'ok' ? 'selected' : ''}>In Stock</option>
          </select>

          <button class="btn btn-sm" onclick="openPresetsModal()">
            ⭐ Common Catalog <span class="kbd">Q</span>
          </button>
          <button class="btn btn-primary btn-sm" onclick="openModal('modal-add-item')">
            ➕ Add Material <span class="kbd">N</span>
          </button>
          <button class="btn btn-sm" onclick="exportCSV('inventory')">
            Export CSV
          </button>
        </div>
      </div>

      <!-- Minimalist Financial Bar -->
      <div style="background:var(--bg-subtle);padding:0.6rem 1.15rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;border-bottom:1px solid var(--border);font-size:0.775rem;">
        <div>
          Showing <strong>${filteredItems.length}</strong> items
          ${state.selectedProjectId !== 'all' ? ` for <strong>${state.projects.find(p => p.id === state.selectedProjectId)?.name}</strong>` : ' across all sites'}
        </div>
        <div style="display:flex;gap:1.25rem;">
          <div>Standard Market Cost: <strong>${formatCurrency(stdSum)}</strong></div>
          <div>Subsidized Net Cost: <strong>${formatCurrency(subSum)}</strong></div>
          <div style="color:var(--success);">Net Subsidy Saved: <strong>${formatCurrency(savSum)}</strong></div>
        </div>
      </div>

      <!-- Main Data Table -->
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Material & Code</th>
              <th>Site Project</th>
              <th>Category</th>
              <th>Available Stock</th>
              <th>Standard Rate</th>
              <th>Subsidized Rate</th>
              <th>Subsidized Total</th>
              <th>Subsidy Saved</th>
              <th>Delivery Status</th>
              <th>1-Click Shortcuts</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filteredItems.length === 0 ? `
              <tr>
                <td colspan="11" style="text-align:center;padding:2.5rem;color:var(--text-muted);">
                  <div style="font-weight:600;margin-bottom:0.25rem;">No construction materials found</div>
                  <div style="font-size:0.775rem;">Try adjusting filters or use the 1-Click Catalog to add materials instantly.</div>
                  <button class="btn btn-sm" style="margin-top:0.75rem;" onclick="openPresetsModal()">
                    Browse Common Catalog
                  </button>
                </td>
              </tr>
            ` : filteredItems.map(item => {
              const proj = state.projects.find(p => p.id === item.projectId);
              const isLow = item.quantity <= item.minStockAlert;
              const isOut = item.quantity <= 0;
              const itemStdVal = item.quantity * item.standardPrice;
              const itemSubVal = item.quantity * item.subsidizedPrice;
              const itemSavings = itemStdVal - itemSubVal;
              const itemSavingsPct = item.standardPrice > 0 ? (((item.standardPrice - item.subsidizedPrice) / item.standardPrice) * 100).toFixed(0) : 0;

              return `
                <tr>
                  <td>
                    <div class="cell-bold">${item.name}</div>
                    <div class="cell-sub">
                      <span class="project-code-tag">${item.sku || 'N/A'}</span>
                      ${item.locationInSite ? `• ${item.locationInSite}` : ''}
                    </div>
                  </td>

                  <td>
                    <span class="project-code-tag" style="cursor:pointer;" onclick="openSiteDetail('${item.projectId}')" title="Click to open site command center">
                      📍 ${proj?.code || 'SITE'}
                    </span>
                    <div class="cell-sub" style="max-width:130px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">
                      ${proj?.name || item.projectId}
                    </div>
                  </td>

                  <td>
                    <span class="badge badge-neutral">${item.category}</span>
                  </td>

                  <td>
                    <span class="badge ${isOut ? 'badge-danger' : (isLow ? 'badge-warning' : 'badge-neutral')}" style="font-weight:700;">
                      ${formatQty(item.quantity)} ${item.unit}
                    </span>
                    ${isLow ? `<div class="cell-sub" style="color:var(--danger);">Min: ${item.minStockAlert}</div>` : ''}
                  </td>

                  <td>
                    <div>${formatCurrency(item.standardPrice)}</div>
                    <div class="cell-sub">per ${item.unit}</div>
                  </td>

                  <td>
                    <div class="cell-bold">${formatCurrency(item.subsidizedPrice)}</div>
                    <div class="cell-sub" style="color:var(--success);">
                      ${itemSavingsPct > 0 ? `-${itemSavingsPct}% Subsidy` : 'Standard'}
                    </div>
                  </td>

                  <td>
                    <div class="cell-bold">${formatCurrency(itemSubVal)}</div>
                  </td>

                  <td>
                    <div class="cell-bold" style="color:var(--success);">
                      ${formatCurrency(itemSavings)}
                    </div>
                    <div class="cell-sub" style="font-size:0.685rem;max-width:110px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${item.subsidyScheme || ''}">
                      ${item.subsidyScheme || ''}
                    </div>
                  </td>

                  <td>
                    <span class="badge badge-neutral">${item.deliveryETA || 'In Stock'}</span>
                  </td>

                  <td>
                    <div style="display:flex;gap:0.25rem;">
                      <button class="quick-delta-btn sub" title="Deduct 10" onclick="quickAdjustStock('${item.id}', -10)">-10</button>
                      <button class="quick-delta-btn add" title="Add 10" onclick="quickAdjustStock('${item.id}', 10)">+10</button>
                      <button class="quick-delta-btn add" title="Add 50" onclick="quickAdjustStock('${item.id}', 50)">+50</button>
                      <button class="quick-delta-btn add" title="Add 100" onclick="quickAdjustStock('${item.id}', 100)">+100</button>
                    </div>
                  </td>

                  <td>
                    <div style="display:flex;gap:0.25rem;">
                      <button class="btn btn-sm" title="Edit" onclick="editItemModal('${item.id}')">✏️</button>
                      <button class="btn btn-sm" title="Transfer" onclick="openTransferModalForItem('${item.id}')">🔄</button>
                      <button class="btn btn-danger btn-sm" title="Delete" onclick="deleteItem('${item.id}')">🗑️</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;

  setupEventListeners();
}

// 5. Shortcuts & Operations Center Tab
function renderShortcutsCenter(container, filteredItems) {
  container.innerHTML = `
    <div style="margin-bottom:1rem;">
      <h2 style="font-size:1.15rem;font-weight:700;">Fast Workflows & Operations Pad</h2>
      <p style="font-size:0.775rem;color:var(--text-muted);">
        Rapid actions designed so your father doesn't have to manually fill out forms line by line.
      </p>
    </div>

    <!-- Quick Operations Cards Grid -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(260px, 1fr));gap:0.85rem;margin-bottom:1.25rem;">
      <div class="content-card" style="cursor:pointer;" onclick="openPresetsModal()">
        <div class="card-body">
          <div style="font-size:1.5rem;margin-bottom:0.35rem;">⭐</div>
          <h3 style="font-size:0.95rem;font-weight:700;">1-Click Construction Catalog</h3>
          <p style="font-size:0.775rem;color:var(--text-muted);margin:0.25rem 0 0.65rem 0;">
            25+ pre-loaded materials with pre-filled subsidized rates.
          </p>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span class="btn btn-sm">Open Catalog</span>
            <span class="kbd">Q</span>
          </div>
        </div>
      </div>

      <div class="content-card" style="cursor:pointer;" onclick="openInwardModal()">
        <div class="card-body">
          <div style="font-size:1.5rem;margin-bottom:0.35rem;">📥</div>
          <h3 style="font-size:0.95rem;font-weight:700;">Quick Inward Delivery Challan</h3>
          <p style="font-size:0.775rem;color:var(--text-muted);margin:0.25rem 0 0.65rem 0;">
            A delivery truck just arrived? Quickly record incoming stock with challan number and truck number.
          </p>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span class="btn btn-sm">Receive Truckload</span>
            <span class="kbd">I</span>
          </div>
        </div>
      </div>

      <div class="content-card" style="cursor:pointer;" onclick="openTransferModal()">
        <div class="card-body">
          <div style="font-size:1.5rem;margin-bottom:0.35rem;">🔄</div>
          <h3 style="font-size:0.95rem;font-weight:700;">Inter-Site Stock Transfer</h3>
          <p style="font-size:0.775rem;color:var(--text-muted);margin:0.25rem 0 0.65rem 0;">
            Move 100 bags of cement or 5 tons of steel from Central Yard to an active project in 2 clicks.
          </p>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span class="btn btn-sm">Transfer Stock</span>
            <span class="kbd">T</span>
          </div>
        </div>
      </div>

      <div class="content-card" style="cursor:pointer;" onclick="openOutwardModal()">
        <div class="card-body">
          <div style="font-size:1.5rem;margin-bottom:0.35rem;">📤</div>
          <h3 style="font-size:0.95rem;font-weight:700;">Issue / Consume On Site</h3>
          <p style="font-size:0.775rem;color:var(--text-muted);margin:0.25rem 0 0.65rem 0;">
            Deduct cement or steel consumed for today's slab casting or masonry work with one quick entry.
          </p>
          <div style="display:flex;justify-content:space-between;align-items:center;">
            <span class="btn btn-sm">Issue Material</span>
            <span class="kbd">O</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Rapid Stock Multi-Pad -->
    <div class="content-card">
      <div class="card-header">
        <span class="card-title">⚡ 1-Click Fast Stock Increment Pad</span>
      </div>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Material</th>
              <th>Site Project</th>
              <th>Current Stock</th>
              <th>Subsidized Value</th>
              <th>Rapid Stock Increment Shortcuts</th>
              <th>Quick Decrement</th>
            </tr>
          </thead>
          <tbody>
            ${filteredItems.map(item => {
              const proj = state.projects.find(p => p.id === item.projectId);
              const subVal = item.quantity * item.subsidizedPrice;
              return `
                <tr>
                  <td>
                    <div class="cell-bold">${item.name}</div>
                    <div class="cell-sub">${item.category}</div>
                  </td>
                  <td>
                    <span class="project-code-tag" style="cursor:pointer;" onclick="openSiteDetail('${item.projectId}')">${proj?.code || item.projectId}</span>
                  </td>
                  <td>
                    <span class="badge ${item.quantity <= item.minStockAlert ? 'badge-warning' : 'badge-neutral'}">
                      ${formatQty(item.quantity)} ${item.unit}
                    </span>
                  </td>
                  <td>
                    <div class="cell-bold">${formatCurrency(subVal)}</div>
                  </td>
                  <td>
                    <div style="display:flex;gap:0.3rem;">
                      <button class="quick-delta-btn add" onclick="quickAdjustStock('${item.id}', 10)">+10</button>
                      <button class="quick-delta-btn add" onclick="quickAdjustStock('${item.id}', 25)">+25</button>
                      <button class="quick-delta-btn add" onclick="quickAdjustStock('${item.id}', 50)">+50</button>
                      <button class="quick-delta-btn add" onclick="quickAdjustStock('${item.id}', 100)">+100</button>
                      <button class="quick-delta-btn add" onclick="quickAdjustStock('${item.id}', 500)">+500</button>
                    </div>
                  </td>
                  <td>
                    <div style="display:flex;gap:0.3rem;">
                      <button class="quick-delta-btn sub" onclick="quickAdjustStock('${item.id}', -10)">-10</button>
                      <button class="quick-delta-btn sub" onclick="quickAdjustStock('${item.id}', -50)">-50</button>
                      <button class="quick-delta-btn sub" onclick="quickAdjustStock('${item.id}', -100)">-100</button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

  `;
}

// 6. Transactions & Delivery Slips Tab
function renderTransactions(container) {
  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:0.5rem;">
      <div>
        <h2 style="font-size:1.15rem;font-weight:700;">Material Inward, Issue & Transfer Log</h2>
        <p style="font-size:0.775rem;color:var(--text-muted);">
          Complete audit trail of delivery challans, site issues, and inter-site vehicle transfers.
        </p>
      </div>
      <div style="display:flex;gap:0.4rem;">
        <button class="btn btn-secondary btn-sm" onclick="openInwardModal()">
          📥 Log Delivery <span class="kbd">I</span>
        </button>
        <button class="btn btn-sm" onclick="exportCSV('transactions')">
          Export Log CSV
        </button>
      </div>
    </div>

    <div class="content-card">
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Type</th>
              <th>Challan / Slip #</th>
              <th>Material</th>
              <th>Source Site</th>
              <th>Destination</th>
              <th>Quantity</th>
              <th>Subsidized Value</th>
              <th>Vehicle / Note</th>
              <th>Received By</th>
            </tr>
          </thead>
          <tbody>
            ${state.transactions.length === 0 ? `
              <tr>
                <td colspan="10" style="text-align:center;padding:2rem;color:var(--text-muted);">
                  No stock transactions logged yet.
                </td>
              </tr>
            ` : state.transactions.map(tx => {
              const p = state.projects.find(proj => proj.id === tx.projectId);
              const toP = tx.toProjectId ? state.projects.find(proj => proj.id === tx.toProjectId) : null;
              const typeBadge = tx.type === 'INWARD' ? 'badge-success' : (tx.type === 'TRANSFER' ? 'badge-info' : 'badge-neutral');

              return `
                <tr>
                  <td>
                    <div style="font-weight:600;">${formatDate(tx.date)}</div>
                    <div class="cell-sub">${new Date(tx.date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</div>
                  </td>
                  <td>
                    <span class="badge ${typeBadge}">${tx.type}</span>
                  </td>
                  <td>
                    <div class="cell-bold">${tx.challanNo || '—'}</div>
                  </td>
                  <td>
                    <div class="cell-bold">${tx.itemName}</div>
                    <div class="cell-sub">${tx.notes || ''}</div>
                  </td>
                  <td>
                    <span class="project-code-tag" style="cursor:pointer;" onclick="openSiteDetail('${tx.projectId}')">${p?.code || tx.projectId}</span>
                  </td>
                  <td>
                    ${toP ? `<span class="project-code-tag" style="cursor:pointer;" onclick="openSiteDetail('${tx.toProjectId}')">➜ ${toP.code}</span>` : '<span style="color:var(--text-muted);">—</span>'}
                  </td>
                  <td>
                    <span class="badge badge-neutral">
                      ${formatQty(tx.quantity)} ${tx.unit}
                    </span>
                  </td>
                  <td>
                    <div class="cell-bold">${formatCurrency(tx.totalValue)}</div>
                    <div class="cell-sub">@ ${formatCurrency(tx.subsidizedRate)}</div>
                  </td>
                  <td>
                    <div>${tx.vehicleNo || 'Direct'}</div>
                  </td>
                  <td>
                    <div>${tx.receivedBy || 'Staff'}</div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

  `;
}

// 7. Bill of Quantities (BOQ) & Valuation Statement
function renderBOQReport(container, filteredItems) {
  const stdTotal = filteredItems.reduce((acc, i) => acc + (i.quantity * i.standardPrice), 0);
  const subTotal = filteredItems.reduce((acc, i) => acc + (i.quantity * i.subsidizedPrice), 0);
  const totalSavings = stdTotal - subTotal;
  const savingsPct = stdTotal > 0 ? ((totalSavings / stdTotal) * 100).toFixed(1) : 0;

  const currentProjName = state.selectedProjectId === 'all'
    ? 'All Construction Sites Consolidated'
    : (state.projects.find(p => p.id === state.selectedProjectId)?.name || 'Site Project');

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:0.5rem;" class="no-print">
      <div>
        <h2 style="font-size:1.15rem;font-weight:700;">Bill of Quantities (BOQ) & Valuation Statement</h2>
        <p style="font-size:0.775rem;color:var(--text-muted);">
          Official printable material statement with standard list cost, subsidized net cost, and savings.
        </p>
      </div>
      <div style="display:flex;gap:0.4rem;">
        <button class="btn btn-primary btn-sm" onclick="window.print()">
          🖨️ Print / Save PDF
        </button>
        <button class="btn btn-sm" onclick="exportCSV('inventory')">
          Export Excel CSV
        </button>
      </div>
    </div>

    <div class="content-card" style="padding:1.5rem;">
      <div style="border-bottom:1px solid var(--border);padding-bottom:1rem;margin-bottom:1.25rem;display:flex;justify-content:space-between;align-items:flex-start;">
        <div>
          <h1 style="font-size:1.35rem;font-weight:800;letter-spacing:-0.02em;">
            ${state.settings.businessName || 'REAL ESTATE & INFRASTRUCTURE DEVELOPERS'}
          </h1>
          <div style="font-size:0.8rem;color:var(--text-muted);margin-top:0.2rem;">
            Official Materials Inventory Valuation & Subsidy Claim Statement
          </div>
          <div style="font-size:0.825rem;margin-top:0.35rem;">
            <strong>Target Site:</strong> ${currentProjName}
          </div>
        </div>
        <div style="text-align:right;">
          <div style="font-size:0.75rem;color:var(--text-muted);">Statement Date:</div>
          <div style="font-weight:700;font-size:0.85rem;">${formatDate(new Date())}</div>
          <div style="font-size:0.7rem;color:var(--text-muted);margin-top:0.2rem;">Ref: BOQ-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}</div>
        </div>
      </div>

      <!-- Financial Totals Block -->
      <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.85rem;margin-bottom:1.25rem;background:var(--bg-subtle);padding:0.85rem;border-radius:var(--radius-sm);border:1px solid var(--border);">
        <div>
          <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;font-weight:700;">Standard Market Valuation</div>
          <div style="font-size:1.25rem;font-weight:800;margin-top:0.2rem;">${formatCurrency(stdTotal)}</div>
          <div style="font-size:0.7rem;color:var(--text-muted);">Normal supplier list price</div>
        </div>
        <div>
          <div style="font-size:0.7rem;color:var(--text-main);text-transform:uppercase;font-weight:700;">Subsidized Net Material Cost</div>
          <div style="font-size:1.25rem;font-weight:800;margin-top:0.2rem;">${formatCurrency(subTotal)}</div>
          <div style="font-size:0.7rem;color:var(--text-muted);">Actual procurement cost</div>
        </div>
        <div>
          <div style="font-size:0.7rem;color:var(--success);text-transform:uppercase;font-weight:700;">Total Subsidy Savings</div>
          <div style="font-size:1.25rem;font-weight:800;color:var(--success);margin-top:0.2rem;">${formatCurrency(totalSavings)}</div>
          <div style="font-size:0.7rem;color:var(--success);font-weight:600;">${savingsPct}% Total Subsidy Savings</div>
        </div>
      </div>

      <!-- Table Details -->
      <table class="data-table" style="margin-bottom:1.5rem;">
        <thead>
          <tr>
            <th style="width:30px;">#</th>
            <th>Material Description</th>
            <th>Site</th>
            <th>Category</th>
            <th>Stock Qty</th>
            <th>Standard Rate</th>
            <th>Subsidized Rate</th>
            <th>Standard Total</th>
            <th>Subsidized Total</th>
            <th>Net Savings</th>
          </tr>
        </thead>
        <tbody>
          ${filteredItems.map((item, idx) => {
            const proj = state.projects.find(p => p.id === item.projectId);
            const itemStdVal = item.quantity * item.standardPrice;
            const itemSubVal = item.quantity * item.subsidizedPrice;
            const itemSavings = itemStdVal - itemSubVal;

            return `
              <tr>
                <td>${idx + 1}</td>
                <td>
                  <div style="font-weight:600;">${item.name}</div>
                  <div style="font-size:0.685rem;color:var(--text-muted);">${item.sku} • ${item.subsidyScheme || 'Builder Scheme'}</div>
                </td>
                <td>${proj?.code || item.projectId}</td>
                <td>${item.category}</td>
                <td style="font-weight:700;">${formatQty(item.quantity)} ${item.unit}</td>
                <td>${formatCurrency(item.standardPrice)}</td>
                <td style="font-weight:700;">${formatCurrency(item.subsidizedPrice)}</td>
                <td>${formatCurrency(itemStdVal)}</td>
                <td style="font-weight:700;">${formatCurrency(itemSubVal)}</td>
                <td style="font-weight:700;color:var(--success);">${formatCurrency(itemSavings)}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
        <tfoot>
          <tr style="background:var(--bg-subtle);font-weight:800;font-size:0.85rem;">
            <td colspan="7" style="text-align:right;padding:0.65rem 0.85rem;">GRAND TOTAL:</td>
            <td>${formatCurrency(stdTotal)}</td>
            <td>${formatCurrency(subTotal)}</td>
            <td style="color:var(--success);">${formatCurrency(totalSavings)}</td>
          </tr>
        </tfoot>
      </table>

      <!-- Signatures Footer -->
      <div style="display:flex;justify-content:space-between;margin-top:2.5rem;padding-top:1rem;border-top:1px dashed var(--border);">
        <div style="text-align:center;width:180px;">
          <div style="height:35px;"></div>
          <div style="border-top:1px solid #000;font-size:0.75rem;font-weight:700;">Site Store Incharge</div>
          <div style="font-size:0.675rem;color:var(--text-muted);">Verification</div>
        </div>
        <div style="text-align:center;width:180px;">
          <div style="height:35px;"></div>
          <div style="border-top:1px solid #000;font-size:0.75rem;font-weight:700;">Project Engineer</div>
          <div style="font-size:0.675rem;color:var(--text-muted);">Certification</div>
        </div>
        <div style="text-align:center;width:180px;">
          <div style="height:35px;"></div>
          <div style="border-top:1px solid #000;font-size:0.75rem;font-weight:700;">Managing Director</div>
          <div style="font-size:0.675rem;color:var(--text-muted);">Authorized Signatory</div>
        </div>
      </div>
    </div>

  `;
}

// ----------------------------------------------------
// SHORTCUT API ACTIONS
// ----------------------------------------------------

async function quickAdjustStock(itemId, delta) {
  try {
    const res = await fetch(`/api/inventory/${itemId}/quick-adjust`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        delta,
        reason: `Quick shortcut adjustment (${delta > 0 ? '+' : ''}${delta})`
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to adjust stock');
    }

    const data = await res.json();
    showToast(`${data.item.name}: ${delta > 0 ? '+' : ''}${delta} ${data.item.unit} ➜ Now: ${data.newQty} ${data.item.unit}`, 'success');
    await loadData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function quickAdjustStaff(projectId, delta) {
  try {
    const res = await fetch(`/api/projects/${projectId}/quick-staff`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ delta })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to update staff count');
    }

    const data = await res.json();
    showToast(`Staff updated: ${data.project.name} ➜ ${data.project.staffDeployed} / ${data.project.staffNeeded} workers`, 'info');
    await loadData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// 1-Click Catalog Modal Handler
function openPresetsModal() {
  updateHeaderSelectors();
  renderPresetCatalog();
  openModal('modal-presets-catalog');
}

function renderPresetCatalog() {
  const container = document.getElementById('presets-catalog-container');
  if (!container) return;

  let presets = state.presets;
  if (state.presetFilterCategory && state.presetFilterCategory !== 'all') {
    presets = presets.filter(p => p.category === state.presetFilterCategory);
  }
  if (state.presetSearchQuery) {
    presets = presets.filter(p =>
      p.name.toLowerCase().includes(state.presetSearchQuery.toLowerCase()) ||
      p.category.toLowerCase().includes(state.presetSearchQuery.toLowerCase())
    );
  }

  container.innerHTML = presets.map(p => {
    const savings = p.defaultStandardPrice - p.defaultSubsidizedPrice;
    const pct = p.defaultStandardPrice > 0 ? ((savings / p.defaultStandardPrice) * 100).toFixed(0) : 0;

    return `
      <div class="preset-item-card">
        <div>
          <div style="display:flex;justify-content:space-between;align-items:flex-start;">
            <span class="badge badge-neutral">${p.category}</span>
            <span class="badge badge-success" style="font-size:0.685rem;">${pct}% Subsidy</span>
          </div>
          <h4 style="font-size:0.875rem;font-weight:700;margin:0.35rem 0 0.15rem 0;">${p.name}</h4>
          <p style="font-size:0.725rem;color:var(--text-muted);">${p.description || ''}</p>
        </div>

        <div style="margin:0.5rem 0;padding:0.4rem 0.55rem;background:var(--bg-subtle);border-radius:var(--radius-sm);display:flex;justify-content:space-between;align-items:center;">
          <div>
            <div style="font-size:0.675rem;color:var(--text-muted);">Standard:</div>
            <div style="font-size:0.75rem;text-decoration:line-through;color:var(--text-muted);">${formatCurrency(p.defaultStandardPrice)}</div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:0.675rem;color:var(--text-main);font-weight:600;">Subsidized Rate:</div>
            <div style="font-size:0.9rem;font-weight:800;">${formatCurrency(p.defaultSubsidizedPrice)} / ${p.unit}</div>
          </div>
        </div>

        <div style="display:flex;gap:0.35rem;align-items:center;">
          <input type="number" id="preset-qty-${p.id}" value="10" min="1" style="width:65px;padding:0.3rem 0.45rem;font-size:0.775rem;border:1px solid var(--border);border-radius:4px;">
          <button class="btn btn-primary btn-sm" style="flex:1;" onclick="addPresetToProject('${p.id}')">
            ⚡ 1-Click Add
          </button>
        </div>
      </div>
    `;
  }).join('');
}

async function addPresetToProject(presetId) {
  const projSelect = document.getElementById('preset-target-project');
  const targetProjId = projSelect ? projSelect.value : (state.selectedProjectId !== 'all' ? state.selectedProjectId : state.projects[0]?.id);

  if (!targetProjId) {
    showToast('Please select a target site project first', 'error');
    return;
  }

  const qtyInput = document.getElementById(`preset-qty-${presetId}`);
  const qty = qtyInput ? Number(qtyInput.value) : 10;

  try {
    const res = await fetch('/api/inventory/quick-add-preset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        presetId,
        projectId: targetProjId,
        quantity: qty
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to add preset material');
    }

    const data = await res.json();
    showToast(data.message || 'Added material to site project', 'success');
    closeAllModals();
    await loadData();
    switchTab('inventory');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function onPresetSearchChange(val) {
  state.presetSearchQuery = val;
  renderPresetCatalog();
}

function onPresetCategoryChange(val) {
  state.presetFilterCategory = val;
  renderPresetCatalog();
}

// Inter-site Stock Transfer
function openTransferModal() {
  updateHeaderSelectors();
  populateTransferSourceItems();
  openModal('modal-transfer-stock');
}

function openTransferModalForItem(itemId) {
  openTransferModal();
  const select = document.getElementById('transfer-source-item');
  if (select) {
    select.value = itemId;
    onTransferSourceItemChange();
  }
}

function populateTransferSourceItems() {
  const itemSelect = document.getElementById('transfer-source-item');
  if (!itemSelect) return;

  itemSelect.innerHTML = `
    <option value="" disabled selected>Select material to transfer...</option>
    ${state.inventory.filter(i => i.quantity > 0).map(item => {
      const p = state.projects.find(proj => proj.id === item.projectId);
      return `
        <option value="${item.id}">
          ${item.name} (${formatQty(item.quantity)} ${item.unit} at ${p?.name || item.projectId})
        </option>
      `;
    }).join('')}
  `;
}

function onTransferSourceItemChange() {
  const itemSelect = document.getElementById('transfer-source-item');
  const sourceProjBox = document.getElementById('transfer-source-project-name');
  const targetProjSelect = document.getElementById('transfer-target-project');
  const qtyInput = document.getElementById('transfer-quantity');
  const unitLabel = document.getElementById('transfer-unit-label');

  if (!itemSelect || !itemSelect.value) return;

  const item = state.inventory.find(i => i.id === itemSelect.value);
  if (!item) return;

  const p = state.projects.find(proj => proj.id === item.projectId);
  if (sourceProjBox) sourceProjBox.textContent = `${p?.name} (Available: ${item.quantity} ${item.unit})`;
  if (unitLabel) unitLabel.textContent = item.unit;
  if (qtyInput) {
    qtyInput.max = item.quantity;
    qtyInput.placeholder = `Max ${item.quantity}`;
  }

  if (targetProjSelect) {
    targetProjSelect.innerHTML = `
      <option value="" disabled selected>Choose destination site...</option>
      ${state.projects.filter(proj => proj.id !== item.projectId).map(proj => `
        <option value="${proj.id}">📍 ${proj.name} (${proj.code})</option>
      `).join('')}
    `;
  }
}

async function submitTransferForm(e) {
  e.preventDefault();
  const itemId = document.getElementById('transfer-source-item').value;
  const targetProjectId = document.getElementById('transfer-target-project').value;
  const transferQty = Number(document.getElementById('transfer-quantity').value);
  const challanNo = document.getElementById('transfer-challan-no').value;
  const vehicleNo = document.getElementById('transfer-vehicle-no').value;
  const receivedBy = document.getElementById('transfer-received-by').value;
  const notes = document.getElementById('transfer-notes').value;

  if (!itemId || !targetProjectId || transferQty <= 0) {
    showToast('Please fill all required transfer fields', 'error');
    return;
  }

  try {
    const res = await fetch('/api/transactions/transfer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sourceItemId: itemId,
        targetProjectId,
        transferQty,
        challanNo,
        vehicleNo,
        receivedBy,
        notes
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to complete transfer');
    }

    const data = await res.json();
    showToast(data.message || 'Transfer completed successfully', 'success');
    closeAllModals();
    await loadData();
    switchTab('transactions');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Quick Inward / Delivery Challan
function openInwardModal() {
  updateHeaderSelectors();
  populateInwardItems();
  openModal('modal-quick-inward');
}

function openInwardModalForProject(projectId) {
  openInwardModal();
  const projSelect = document.getElementById('inward-project-select');
  if (projSelect) {
    projSelect.value = projectId;
    populateInwardItems();
  }
}

function populateInwardItems() {
  const projSelect = document.getElementById('inward-project-select');
  const itemSelect = document.getElementById('inward-item-select');
  if (!itemSelect) return;

  const projId = projSelect ? projSelect.value : state.selectedProjectId;
  let items = state.inventory;
  if (projId && projId !== 'all') {
    items = items.filter(i => i.projectId === projId);
  }

  itemSelect.innerHTML = `
    <option value="" disabled selected>Select material to restock...</option>
    ${items.map(i => `
      <option value="${i.id}">${i.name} (Current: ${formatQty(i.quantity)} ${i.unit})</option>
    `).join('')}
  `;
}

async function submitInwardForm(e) {
  e.preventDefault();
  const itemId = document.getElementById('inward-item-select').value;
  const quantity = Number(document.getElementById('inward-quantity').value);
  const challanNo = document.getElementById('inward-challan-no').value;
  const vehicleNo = document.getElementById('inward-vehicle-no').value;
  const receivedBy = document.getElementById('inward-received-by').value;
  const notes = document.getElementById('inward-notes').value;

  if (!itemId || quantity <= 0) {
    showToast('Valid item and quantity are required', 'error');
    return;
  }

  try {
    const res = await fetch('/api/transactions/inward', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId,
        quantity,
        challanNo,
        vehicleNo,
        receivedBy,
        notes
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to log inward delivery');
    }

    showToast(`Logged inward delivery: +${quantity} units`, 'success');
    closeAllModals();
    await loadData();
    switchTab('inventory');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Quick Outward / Site Consumption
function openOutwardModal() {
  updateHeaderSelectors();
  populateOutwardItems();
  openModal('modal-quick-outward');
}

function populateOutwardItems() {
  const itemSelect = document.getElementById('outward-item-select');
  if (!itemSelect) return;

  itemSelect.innerHTML = `
    <option value="" disabled selected>Select material consumed...</option>
    ${state.inventory.filter(i => i.quantity > 0).map(i => {
      const p = state.projects.find(proj => proj.id === i.projectId);
      return `<option value="${i.id}">${i.name} (${formatQty(i.quantity)} ${i.unit} at ${p?.name})</option>`;
    }).join('')}
  `;
}

async function submitOutwardForm(e) {
  e.preventDefault();
  const itemId = document.getElementById('outward-item-select').value;
  const quantity = Number(document.getElementById('outward-quantity').value);
  const challanNo = document.getElementById('outward-challan-no').value;
  const receivedBy = document.getElementById('outward-received-by').value;
  const notes = document.getElementById('outward-notes').value;

  if (!itemId || quantity <= 0) {
    showToast('Valid item and quantity required', 'error');
    return;
  }

  try {
    const res = await fetch('/api/transactions/outward', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        itemId,
        quantity,
        challanNo,
        receivedBy,
        notes
      })
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to issue material');
    }

    showToast(`Logged consumption: -${quantity} units`, 'success');
    closeAllModals();
    await loadData();
    switchTab('inventory');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Price Calculation Listeners
function setupPriceCalcListeners() {
  const stdInput = document.getElementById('item-std-price');
  const subInput = document.getElementById('item-sub-price');
  const qtyInput = document.getElementById('item-quantity');

  function recalculate() {
    const std = Number(stdInput?.value) || 0;
    const sub = Number(subInput?.value) || 0;
    const qty = Number(qtyInput?.value) || 0;

    const stdTotal = std * qty;
    const subTotal = sub * qty;
    const savings = stdTotal - subTotal;
    const pct = std > 0 ? (((std - sub) / std) * 100).toFixed(1) : 0;

    const previewStd = document.getElementById('calc-preview-std');
    const previewSub = document.getElementById('calc-preview-sub');
    const previewSav = document.getElementById('calc-preview-sav');

    if (previewStd) previewStd.textContent = formatCurrency(stdTotal);
    if (previewSub) previewSub.textContent = formatCurrency(subTotal);
    if (previewSav) previewSav.textContent = `${formatCurrency(savings)} (${pct}%)`;
  }

  if (stdInput) stdInput.addEventListener('input', recalculate);
  if (subInput) subInput.addEventListener('input', recalculate);
  if (qtyInput) qtyInput.addEventListener('input', recalculate);
}

async function submitItemForm(e) {
  e.preventDefault();
  const form = document.getElementById('form-add-item');
  const editId = form.dataset.editId;

  const itemData = {
    projectId: document.getElementById('item-project').value,
    name: document.getElementById('item-name').value.trim(),
    sku: document.getElementById('item-sku').value.trim(),
    category: document.getElementById('item-category').value,
    unit: document.getElementById('item-unit').value,
    quantity: Number(document.getElementById('item-quantity').value) || 0,
    minStockAlert: Number(document.getElementById('item-min-alert').value) || 10,
    standardPrice: Number(document.getElementById('item-std-price').value) || 0,
    subsidizedPrice: Number(document.getElementById('item-sub-price').value) || 0,
    subsidyScheme: document.getElementById('item-subsidy-scheme').value.trim(),
    subsidyStatus: document.getElementById('item-subsidy-status').value,
    deliveryETA: document.getElementById('item-delivery-eta').value.trim() || 'In Stock',
    supplier: document.getElementById('item-supplier').value.trim(),
    supplierContact: document.getElementById('item-supplier-contact').value.trim(),
    locationInSite: document.getElementById('item-location').value.trim(),
    notes: document.getElementById('item-notes').value.trim()
  };

  try {
    const url = editId ? `/api/inventory/${editId}` : '/api/inventory';
    const method = editId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(itemData)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save item');
    }

    showToast(editId ? 'Item updated successfully' : 'New material added to site', 'success');
    closeAllModals();
    form.reset();
    delete form.dataset.editId;
    await loadData();
    switchTab('inventory');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function editItemModal(itemId) {
  const item = state.inventory.find(i => i.id === itemId);
  if (!item) return;

  updateHeaderSelectors();
  const form = document.getElementById('form-add-item');
  form.dataset.editId = item.id;

  document.getElementById('modal-item-title').innerHTML = `✏️ Edit Material: ${item.name}`;
  document.getElementById('item-project').value = item.projectId;
  document.getElementById('item-name').value = item.name;
  document.getElementById('item-sku').value = item.sku || '';
  document.getElementById('item-category').value = item.category;
  document.getElementById('item-unit').value = item.unit;
  document.getElementById('item-quantity').value = item.quantity;
  document.getElementById('item-min-alert').value = item.minStockAlert;
  document.getElementById('item-std-price').value = item.standardPrice;
  document.getElementById('item-sub-price').value = item.subsidizedPrice;
  document.getElementById('item-subsidy-scheme').value = item.subsidyScheme || '';
  document.getElementById('item-subsidy-status').value = item.subsidyStatus || 'Approved';
  document.getElementById('item-delivery-eta').value = item.deliveryETA || 'In Stock';
  document.getElementById('item-supplier').value = item.supplier || '';
  document.getElementById('item-supplier-contact').value = item.supplierContact || '';
  document.getElementById('item-location').value = item.locationInSite || '';
  document.getElementById('item-notes').value = item.notes || '';

  openModal('modal-add-item');
}

async function deleteItem(itemId) {
  const item = state.inventory.find(i => i.id === itemId);
  if (!confirm(`Are you sure you want to delete ${item ? item.name : 'this item'}?`)) return;

  try {
    const res = await fetch(`/api/inventory/${itemId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete item');

    showToast('Material deleted from inventory', 'info');
    await loadData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// Project Management & Staff Integration
async function submitProjectForm(e) {
  e.preventDefault();
  const form = document.getElementById('form-add-project');
  const editId = form.dataset.editId;

  const projectData = {
    name: document.getElementById('project-name').value.trim(),
    code: document.getElementById('project-code').value.trim(),
    type: document.getElementById('project-type').value,
    location: document.getElementById('project-location').value.trim(),
    status: document.getElementById('project-status').value,
    constructionPhase: document.getElementById('project-phase').value.trim(),
    progressPct: Number(document.getElementById('project-progress').value) || 0,
    supervisorName: document.getElementById('project-supervisor').value.trim(),
    supervisorPhone: document.getElementById('project-phone').value.trim(),
    staffNeeded: Number(document.getElementById('project-staff-needed').value) || 0,
    staffDeployed: Number(document.getElementById('project-staff-deployed').value) || 0,
    staffRoles: document.getElementById('project-staff-roles').value.trim(),
    dailyWageRate: Number(document.getElementById('project-daily-wage').value) || 650,
    budget: Number(document.getElementById('project-budget').value) || 0,
    targetCompletion: document.getElementById('project-target-date').value,
    color: document.getElementById('project-color').value,
    notes: document.getElementById('project-notes').value.trim()
  };

  try {
    const url = editId ? `/api/projects/${editId}` : '/api/projects';
    const method = editId ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(projectData)
    });

    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Failed to save project');
    }

    showToast(editId ? 'Project site updated' : 'New site registered successfully!', 'success');
    closeAllModals();
    form.reset();
    delete form.dataset.editId;
    await loadData();
    switchTab('projects');
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function editProjectModal(projectId) {
  const p = state.projects.find(proj => proj.id === projectId);
  if (!p) return;

  const form = document.getElementById('form-add-project');
  form.dataset.editId = p.id;

  document.getElementById('modal-project-title').innerHTML = `✏️ Edit Site Project: ${p.name}`;
  document.getElementById('project-name').value = p.name;
  document.getElementById('project-code').value = p.code;
  document.getElementById('project-type').value = p.type || 'Residential High-Rise';
  document.getElementById('project-location').value = p.location || '';
  document.getElementById('project-status').value = p.status || 'Active';
  document.getElementById('project-phase').value = p.constructionPhase || '';
  document.getElementById('project-progress').value = p.progressPct || 0;
  document.getElementById('project-supervisor').value = p.supervisorName || '';
  document.getElementById('project-phone').value = p.supervisorPhone || '';
  document.getElementById('project-staff-needed').value = p.staffNeeded || 0;
  document.getElementById('project-staff-deployed').value = p.staffDeployed || 0;
  document.getElementById('project-staff-roles').value = p.staffRoles || '';
  document.getElementById('project-daily-wage').value = p.dailyWageRate || 650;
  document.getElementById('project-budget').value = p.budget || 0;
  document.getElementById('project-target-date').value = p.targetCompletion || '';
  document.getElementById('project-color').value = p.color || '#2563eb';
  document.getElementById('project-notes').value = p.notes || '';

  openModal('modal-add-project');
}

// Export & Backup
function exportCSV(type = 'inventory') {
  window.open(`/api/export/csv?type=${type}`, '_blank');
}

// Modal Helpers
function openModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.add('active');
}

function closeModal(modalId) {
  const modal = document.getElementById(modalId);
  if (modal) modal.classList.remove('active');
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));
}

window.addEventListener('click', (e) => {
  if (e.target.classList.contains('modal-overlay')) {
    e.target.classList.remove('active');
  }
});


// ====================================================
// 8. WORKFORCE & SALARY MANAGEMENT VIEW
// ====================================================
function renderWorkforcePayroll(container) {
  // Aggregate Stats
  let totalActive = 0;
  let dailyCount = 0;
  let monthlyCount = 0;
  let totalDailyWageCommitment = 0;
  let totalMonthlySalaryLiability = 0;

  state.employees.forEach(emp => {
    if (emp.status === 'Active') {
      totalActive++;
      const rate = Number(emp.wageRate) || 0;
      if (emp.wageType === 'Daily Wage') {
        dailyCount++;
        totalDailyWageCommitment += rate;
      } else if (emp.wageType === 'Monthly Salary') {
        monthlyCount++;
        totalMonthlySalaryLiability += rate;
      }
    }
  });

  let totalDisbursed = 0;
  let totalAdvances = 0;
  state.salaryPayments.forEach(p => {
    const amt = Number(p.amount) || 0;
    totalDisbursed += amt;
    if (p.type === 'Advance Payout') {
      totalAdvances += amt;
    }
  });

  // Filter Employees
  let filteredEmployees = state.employees;
  if (state.workforceSiteFilter !== 'all') {
    filteredEmployees = filteredEmployees.filter(e => e.assignedProjectId === state.workforceSiteFilter);
  }
  if (state.workforceRoleFilter !== 'all') {
    filteredEmployees = filteredEmployees.filter(e => e.role === state.workforceRoleFilter);
  }
  if (state.workforceWageTypeFilter !== 'all') {
    filteredEmployees = filteredEmployees.filter(e => e.wageType === state.workforceWageTypeFilter);
  }
  if (state.workforceSearchQuery) {
    const q = state.workforceSearchQuery.toLowerCase();
    filteredEmployees = filteredEmployees.filter(e =>
      e.name.toLowerCase().includes(q) ||
      (e.phone && e.phone.toLowerCase().includes(q)) ||
      e.role.toLowerCase().includes(q) ||
      (e.notes && e.notes.toLowerCase().includes(q)) ||
      (e.idProof && e.idProof.toLowerCase().includes(q))
    );
  }

  // Filter Payments
  let filteredPayments = state.salaryPayments;
  if (state.workforceSiteFilter !== 'all') {
    filteredPayments = filteredPayments.filter(p => p.projectId === state.workforceSiteFilter);
  }
  if (state.payrollTypeFilter !== 'all') {
    filteredPayments = filteredPayments.filter(p => p.type === state.payrollTypeFilter);
  }
  if (state.payrollSearchQuery) {
    const q = state.payrollSearchQuery.toLowerCase();
    filteredPayments = filteredPayments.filter(p =>
      p.employeeName.toLowerCase().includes(q) ||
      (p.transactionRef && p.transactionRef.toLowerCase().includes(q)) ||
      (p.notes && p.notes.toLowerCase().includes(q)) ||
      (p.paymentMode && p.paymentMode.toLowerCase().includes(q))
    );
  }

  // Available unique roles for filter dropdown
  const uniqueRoles = [...new Set(state.employees.map(e => e.role).filter(Boolean))];

  container.innerHTML = `
    <!-- Context & Action Bar -->
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:0.65rem;">
      <div>
        <h2 style="font-size:1.25rem;font-weight:800;letter-spacing:-0.02em;">Workforce & Salary Management</h2>
        <p style="font-size:0.775rem;color:var(--text-muted);">
          Track construction site workers, masons, site supervisors, daily wage burn, monthly salaries, advances, and disbursement vouchers.
        </p>
      </div>

      <div style="display:flex;gap:0.4rem;align-items:center;flex-wrap:wrap;">
        <button class="btn btn-primary btn-sm" onclick="openAddEmployeeModal()">
          ➕ Add Worker <span class="kbd">W</span>
        </button>
        <button class="btn btn-secondary btn-sm" onclick="openSalaryModal()">
          💰 Log Payout / Advance
        </button>
        <button class="btn btn-sm" onclick="exportCSV('employees')">
          📥 Export Staff CSV
        </button>
        <button class="btn btn-sm" onclick="exportCSV('payroll')">
          📑 Export Payroll CSV
        </button>
      </div>
    </div>

    <!-- 5 KPI Cards for Workforce & Salary -->
    <div class="kpi-grid">
      <!-- 1. Active Workforce -->
      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Active Workforce</span>
          <span class="badge badge-success" style="font-size:0.675rem;">${totalActive} Deployed</span>
        </div>
        <div class="kpi-value">${totalActive} <span style="font-size:0.85rem;font-weight:600;color:var(--text-muted);">Staff</span></div>
        <div class="kpi-sub">
          <span>${dailyCount} Daily Wage • ${monthlyCount} Salaried</span>
        </div>
      </div>

      <!-- 2. Daily Wage Rate Commitment -->
      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Daily Wage Commitment</span>
          <span class="kpi-indicator" style="background:var(--warning);"></span>
        </div>
        <div class="kpi-value" style="color:var(--text-main);">₹ ${totalDailyWageCommitment.toLocaleString('en-IN')}<span style="font-size:0.85rem;font-weight:normal;color:var(--text-muted);">/day</span></div>
        <div class="kpi-sub">
          <span>Est. 30-Day: <strong>₹ ${(totalDailyWageCommitment * 26).toLocaleString('en-IN')}</strong></span>
        </div>
      </div>

      <!-- 3. Monthly Salary Liability -->
      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Monthly Salary Liability</span>
          <span class="kpi-indicator" style="background:var(--accent-blue);"></span>
        </div>
        <div class="kpi-value">₹ ${totalMonthlySalaryLiability.toLocaleString('en-IN')}<span style="font-size:0.85rem;font-weight:normal;color:var(--text-muted);">/mo</span></div>
        <div class="kpi-sub">
          <span>Supervisors, Engineers, Yard Staff</span>
        </div>
      </div>

      <!-- 4. Total Payouts Disbursed -->
      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Total Disbursed to Date</span>
          <span class="badge badge-neutral" style="font-size:0.675rem;">${state.salaryPayments.length} Payments</span>
        </div>
        <div class="kpi-value" style="color:var(--success);">${formatCompactCurrency(totalDisbursed)}</div>
        <div class="kpi-sub">
          <span>Net Total: <strong>${formatCurrency(totalDisbursed)}</strong></span>
        </div>
      </div>

      <!-- 5. Advances & Loans Given -->
      <div class="kpi-card">
        <div class="kpi-header">
          <span class="kpi-label">Worker Advances / Loans</span>
          <span class="badge badge-warning" style="font-size:0.675rem;">To Recover</span>
        </div>
        <div class="kpi-value" style="color:var(--warning);">${formatCompactCurrency(totalAdvances)}</div>
        <div class="kpi-sub">
          <span>Outstanding: <strong>${formatCurrency(totalAdvances)}</strong></span>
        </div>
      </div>
    </div>

    <!-- ==================================================== -->
    <!-- SECTION 1: WORKERS & STAFF DIRECTORY -->
    <!-- ==================================================== -->
    <div class="content-card">
      <div class="card-header">
        <span class="card-title">👷 Workers & Staff Directory (${filteredEmployees.length})</span>
        <div style="display:flex;gap:0.4rem;align-items:center;">
          <button class="btn btn-primary btn-sm" onclick="openAddEmployeeModal()">➕ Add Worker</button>
        </div>
      </div>

      <!-- Filter Toolbar -->
      <div class="filter-toolbar">
        <div class="filter-group">
          <label class="filter-label">Site Project:</label>
          <select class="filter-select" onchange="onWorkforceSiteFilterChange(this.value)">
            <option value="all">All Sites (${state.projects.length})</option>
            ${state.projects.map(p => `
              <option value="${p.id}" ${p.id === state.workforceSiteFilter ? 'selected' : ''}>${p.name} [${p.code}]</option>
            `).join('')}
          </select>
        </div>

        <div class="filter-group">
          <label class="filter-label">Role / Trade:</label>
          <select class="filter-select" onchange="onWorkforceRoleFilterChange(this.value)">
            <option value="all">All Roles</option>
            ${uniqueRoles.map(r => `
              <option value="${r}" ${r === state.workforceRoleFilter ? 'selected' : ''}>${r}</option>
            `).join('')}
          </select>
        </div>

        <div class="filter-group">
          <label class="filter-label">Wage Structure:</label>
          <select class="filter-select" onchange="onWorkforceWageTypeFilterChange(this.value)">
            <option value="all" ${state.workforceWageTypeFilter === 'all' ? 'selected' : ''}>All Types</option>
            <option value="Daily Wage" ${state.workforceWageTypeFilter === 'Daily Wage' ? 'selected' : ''}>Daily Wage</option>
            <option value="Monthly Salary" ${state.workforceWageTypeFilter === 'Monthly Salary' ? 'selected' : ''}>Monthly Salary</option>
          </select>
        </div>

        <div class="filter-group" style="flex:1;min-width:200px;">
          <label class="filter-label">Search:</label>
          <input type="text" class="filter-input" placeholder="Search by name, role, phone..." value="${state.workforceSearchQuery || ''}" oninput="onWorkforceSearchInput(this.value)">
        </div>
      </div>

      <!-- Workers Table -->
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Worker / Staff Member</th>
              <th>Trade / Role</th>
              <th>Assigned Site</th>
              <th>Wage Structure</th>
              <th>Direct Contact</th>
              <th>Total Paid</th>
              <th>Advance Balance</th>
              <th>Status</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filteredEmployees.length === 0 ? `
              <tr>
                <td colspan="9" style="text-align:center;padding:2rem;color:var(--text-muted);">
                  No workers matching the current filters. Click "Add Worker" to register a new employee or laborer.
                </td>
              </tr>
            ` : filteredEmployees.map(emp => {
              const proj = state.projects.find(p => p.id === emp.assignedProjectId);
              const totalPaidToEmp = state.salaryPayments
                .filter(p => p.employeeId === emp.id)
                .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
              const advancesToEmp = state.salaryPayments
                .filter(p => p.employeeId === emp.id && p.type === 'Advance Payout')
                .reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
              const cleanPhone = (emp.phone || '').replace(/[^0-9]/g, '');

              // Role badge styling
              let roleBadgeClass = 'badge-neutral';
              if (emp.role.includes('Supervisor') || emp.role.includes('Engineer')) roleBadgeClass = 'badge-info';
              else if (emp.role.includes('Mason')) roleBadgeClass = 'badge-success';
              else if (emp.role.includes('Bender') || emp.role.includes('Steel')) roleBadgeClass = 'badge-warning';

              return `
                <tr>
                  <td>
                    <div class="cell-bold">${emp.name}</div>
                    <div class="cell-sub">${emp.idProof || 'Joined ' + formatDate(emp.joiningDate)}</div>
                    ${emp.emergencyContact ? `<div class="cell-sub" style="font-size:0.675rem;color:var(--text-muted);">Emg: ${emp.emergencyContact}</div>` : ''}
                  </td>
                  <td>
                    <span class="badge ${roleBadgeClass}">${emp.role}</span>
                  </td>
                  <td>
                    ${proj ? `
                      <span class="project-code-tag" style="cursor:pointer;" onclick="openSiteDetail('${proj.id}')" title="Open ${proj.name} Command Center">
                        ${proj.code}
                      </span>
                    ` : '<span style="color:var(--text-muted);">Unassigned</span>'}
                  </td>
                  <td>
                    <div style="font-weight:700;">
                      ₹ ${(Number(emp.wageRate) || 0).toLocaleString('en-IN')}
                      <span style="font-size:0.7rem;font-weight:normal;color:var(--text-muted);">
                        ${emp.wageType === 'Daily Wage' ? '/ day' : '/ month'}
                      </span>
                    </div>
                    <div class="cell-sub" style="font-size:0.685rem;">${emp.wageType}</div>
                  </td>
                  <td>
                    <div style="display:flex;align-items:center;gap:0.35rem;">
                      <a href="tel:${emp.phone}" style="color:var(--text-main);font-size:0.775rem;text-decoration:none;">${emp.phone || '—'}</a>
                      ${cleanPhone ? `
                        <a href="https://wa.me/${cleanPhone}?text=Hi%20${encodeURIComponent(emp.name)},%20this%20is%20regarding%20your%20site%20work%20and%20payments." target="_blank" class="contact-btn wa" style="padding:0.2rem 0.4rem;font-size:0.65rem;" title="WhatsApp Worker">
                          💬
                        </a>
                      ` : ''}
                    </div>
                  </td>
                  <td>
                    <span class="cell-bold">₹ ${totalPaidToEmp.toLocaleString('en-IN')}</span>
                  </td>
                  <td>
                    ${advancesToEmp > 0 ? `
                      <span class="badge badge-warning">₹ ${advancesToEmp.toLocaleString('en-IN')}</span>
                    ` : '<span style="color:var(--text-muted);font-size:0.75rem;">₹ 0</span>'}
                  </td>
                  <td>
                    <span class="badge ${emp.status === 'Active' ? 'badge-success' : (emp.status === 'On Leave' ? 'badge-warning' : 'badge-neutral')}">
                      ${emp.status}
                    </span>
                  </td>
                  <td style="text-align:right;">
                    <div style="display:inline-flex;gap:0.3rem;">
                      <button class="btn btn-xs btn-primary" onclick="openSalaryModal('${emp.id}', '${emp.assignedProjectId}')" title="Disburse Salary / Daily Wage / Advance">
                        💰 Pay
                      </button>
                      <button class="btn btn-xs" onclick="openAddEmployeeModal('${emp.id}')" title="Edit Worker">
                        ✏️
                      </button>
                      <button class="btn btn-xs btn-danger" onclick="deleteEmployee('${emp.id}')" title="Delete Worker">
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>

    <!-- ==================================================== -->
    <!-- SECTION 2: SALARY, WAGE & ADVANCE PAYMENT REGISTER -->
    <!-- ==================================================== -->
    <div class="content-card">
      <div class="card-header">
        <span class="card-title">💸 Salary, Daily Wage & Advance Payment Register (${filteredPayments.length})</span>
        <div style="display:flex;gap:0.4rem;align-items:center;">
          <button class="btn btn-secondary btn-sm" onclick="openSalaryModal()">💰 Log New Payment</button>
          <button class="btn btn-sm" onclick="exportCSV('payroll')">📑 Export CSV</button>
        </div>
      </div>

      <!-- Payroll Filter Toolbar -->
      <div class="filter-toolbar">
        <div class="filter-group">
          <label class="filter-label">Payment Classification:</label>
          <select class="filter-select" onchange="onPayrollTypeFilterChange(this.value)">
            <option value="all" ${state.payrollTypeFilter === 'all' ? 'selected' : ''}>All Payments</option>
            <option value="Daily Wage Payment" ${state.payrollTypeFilter === 'Daily Wage Payment' ? 'selected' : ''}>Daily Wage Payment</option>
            <option value="Salary Payout" ${state.payrollTypeFilter === 'Salary Payout' ? 'selected' : ''}>Monthly Salary Payout</option>
            <option value="Advance Payout" ${state.payrollTypeFilter === 'Advance Payout' ? 'selected' : ''}>Advance / Loan</option>
            <option value="Bonus / Incentive" ${state.payrollTypeFilter === 'Bonus / Incentive' ? 'selected' : ''}>Bonus / Incentive</option>
          </select>
        </div>

        <div class="filter-group" style="flex:1;min-width:200px;">
          <label class="filter-label">Search Register:</label>
          <input type="text" class="filter-input" placeholder="Search by worker, voucher no, mode..." value="${state.payrollSearchQuery || ''}" oninput="onPayrollSearchInput(this.value)">
        </div>
      </div>

      <!-- Payroll Table -->
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Date</th>
              <th>Worker / Staff</th>
              <th>Site Project</th>
              <th>Type</th>
              <th>Amount Paid</th>
              <th>For Period / Days</th>
              <th>Payment Mode</th>
              <th>Voucher / Ref #</th>
              <th>Remarks</th>
              <th style="text-align:right;">Actions</th>
            </tr>
          </thead>
          <tbody>
            ${filteredPayments.length === 0 ? `
              <tr>
                <td colspan="10" style="text-align:center;padding:2rem;color:var(--text-muted);">
                  No salary or wage disbursements matching the filter.
                </td>
              </tr>
            ` : filteredPayments.map(p => {
              const proj = state.projects.find(pr => pr.id === p.projectId);
              const emp = state.employees.find(e => e.id === p.employeeId);

              let typeBadgeClass = 'badge-neutral';
              if (p.type === 'Daily Wage Payment') typeBadgeClass = 'badge-success';
              else if (p.type === 'Salary Payout') typeBadgeClass = 'badge-info';
              else if (p.type === 'Advance Payout') typeBadgeClass = 'badge-warning';
              else if (p.type === 'Bonus / Incentive') typeBadgeClass = 'badge-primary';

              return `
                <tr>
                  <td>
                    <div style="font-weight:600;">${formatDate(p.date)}</div>
                  </td>
                  <td>
                    <div class="cell-bold">${p.employeeName}</div>
                    <div class="cell-sub">${emp ? emp.role : 'Worker'}</div>
                  </td>
                  <td>
                    ${proj ? `
                      <span class="project-code-tag" style="cursor:pointer;" onclick="openSiteDetail('${proj.id}')" title="View Site Command Center">
                        ${proj.code}
                      </span>
                    ` : '<span style="color:var(--text-muted);">General</span>'}
                  </td>
                  <td>
                    <span class="badge ${typeBadgeClass}">${p.type}</span>
                  </td>
                  <td>
                    <span class="cell-bold" style="font-size:0.95rem;color:var(--text-main);">
                      ₹ ${(Number(p.amount) || 0).toLocaleString('en-IN')}
                    </span>
                  </td>
                  <td>
                    <span class="badge badge-neutral">${p.period || 'Current'}</span>
                  </td>
                  <td>
                    <div style="font-size:0.775rem;font-weight:600;">${p.paymentMode || 'Cash'}</div>
                  </td>
                  <td>
                    <span class="cell-sub" style="font-family:monospace;font-weight:600;">${p.transactionRef || '—'}</span>
                  </td>
                  <td>
                    <span class="cell-sub">${p.notes || '—'}</span>
                  </td>
                  <td style="text-align:right;">
                    <div style="display:inline-flex;gap:0.3rem;">
                      <button class="btn btn-xs" onclick="printPaymentReceipt('${p.id}')" title="Print Payment Voucher">
                        🖨️ Receipt
                      </button>
                      <button class="btn btn-xs btn-danger" onclick="deleteSalaryPayment('${p.id}')" title="Delete Record">
                        🗑️
                      </button>
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Workforce Filter Handlers
function onWorkforceSiteFilterChange(val) {
  state.workforceSiteFilter = val;
  renderActiveTab();
}

function onWorkforceRoleFilterChange(val) {
  state.workforceRoleFilter = val;
  renderActiveTab();
}

function onWorkforceWageTypeFilterChange(val) {
  state.workforceWageTypeFilter = val;
  renderActiveTab();
}

function onWorkforceSearchInput(val) {
  state.workforceSearchQuery = val;
  renderActiveTab();
}

// Payroll Filter Handlers
function onPayrollTypeFilterChange(val) {
  state.payrollTypeFilter = val;
  renderActiveTab();
}

function onPayrollSearchInput(val) {
  state.payrollSearchQuery = val;
  renderActiveTab();
}

// ----------------------------------------------------
// WORKER MODALS & CRUD
// ----------------------------------------------------
function openAddEmployeeModal(empId = null, defaultProjectId = null) {
  const title = document.getElementById('modal-employee-title');
  const idInput = document.getElementById('emp-id');
  const nameInput = document.getElementById('emp-name');
  const phoneInput = document.getElementById('emp-phone');
  const roleSelect = document.getElementById('emp-role');
  const wageTypeSelect = document.getElementById('emp-wage-type');
  const wageRateInput = document.getElementById('emp-wage-rate');
  const projSelect = document.getElementById('emp-assigned-project');
  const statusSelect = document.getElementById('emp-status');
  const joinDateInput = document.getElementById('emp-joining-date');
  const idProofInput = document.getElementById('emp-id-proof');
  const emgContactInput = document.getElementById('emp-emergency-contact');
  const notesInput = document.getElementById('emp-notes');

  if (empId) {
    const emp = state.employees.find(e => e.id === empId);
    if (!emp) return;
    if (title) title.textContent = '✏️ Edit Worker: ' + emp.name;
    if (idInput) idInput.value = emp.id;
    if (nameInput) nameInput.value = emp.name;
    if (phoneInput) phoneInput.value = emp.phone || '';
    if (roleSelect) roleSelect.value = emp.role || 'General Laborer';
    if (wageTypeSelect) wageTypeSelect.value = emp.wageType || 'Daily Wage';
    if (wageRateInput) wageRateInput.value = emp.wageRate || '';
    if (projSelect) projSelect.value = emp.assignedProjectId || '';
    if (statusSelect) statusSelect.value = emp.status || 'Active';
    if (joinDateInput) joinDateInput.value = emp.joiningDate || '';
    if (idProofInput) idProofInput.value = emp.idProof || '';
    if (emgContactInput) emgContactInput.value = emp.emergencyContact || '';
    if (notesInput) notesInput.value = emp.notes || '';
  } else {
    if (title) title.textContent = '👷 Add Worker / Staff Member';
    if (idInput) idInput.value = '';
    if (nameInput) nameInput.value = '';
    if (phoneInput) phoneInput.value = '';
    if (roleSelect) roleSelect.value = 'General Laborer';
    if (wageTypeSelect) wageTypeSelect.value = 'Daily Wage';
    if (wageRateInput) wageRateInput.value = '700';
    if (projSelect) projSelect.value = defaultProjectId || (state.projects[0]?.id || '');
    if (statusSelect) statusSelect.value = 'Active';
    if (joinDateInput) joinDateInput.value = new Date().toISOString().split('T')[0];
    if (idProofInput) idProofInput.value = '';
    if (emgContactInput) emgContactInput.value = '';
    if (notesInput) notesInput.value = '';
  }

  updateWageRatePlaceholder();
  openModal('modal-add-employee');
}

function updateWageRatePlaceholder() {
  const wageType = document.getElementById('emp-wage-type')?.value;
  const label = document.getElementById('lbl-emp-wage-rate');
  const input = document.getElementById('emp-wage-rate');
  if (wageType === 'Monthly Salary') {
    if (label) label.innerHTML = 'Monthly Salary (₹/month) <span class="req">*</span>';
    if (input) input.placeholder = 'e.g. 40000';
  } else {
    if (label) label.innerHTML = 'Daily Wage Rate (₹/day) <span class="req">*</span>';
    if (input) input.placeholder = 'e.g. 850';
  }
}

async function submitEmployeeForm(e) {
  e.preventDefault();
  const id = document.getElementById('emp-id')?.value;
  const name = document.getElementById('emp-name')?.value.trim();
  const phone = document.getElementById('emp-phone')?.value.trim();
  const role = document.getElementById('emp-role')?.value;
  const wageType = document.getElementById('emp-wage-type')?.value;
  const wageRate = Number(document.getElementById('emp-wage-rate')?.value);
  const assignedProjectId = document.getElementById('emp-assigned-project')?.value;
  const status = document.getElementById('emp-status')?.value;
  const joiningDate = document.getElementById('emp-joining-date')?.value;
  const idProof = document.getElementById('emp-id-proof')?.value.trim();
  const emergencyContact = document.getElementById('emp-emergency-contact')?.value.trim();
  const notes = document.getElementById('emp-notes')?.value.trim();

  if (!name) {
    showToast('Worker name is required', 'error');
    return;
  }

  const payload = {
    name,
    phone,
    role,
    wageType,
    wageRate,
    assignedProjectId,
    status,
    joiningDate,
    idProof,
    emergencyContact,
    notes
  };

  try {
    const url = id ? `/api/employees/${id}` : '/api/employees';
    const method = id ? 'PUT' : 'POST';
    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.success) {
      showToast(id ? 'Worker updated successfully!' : 'Worker registered successfully!', 'success');
      closeModal('modal-add-employee');
      await loadData();
    } else {
      showToast(result.error || 'Failed to save worker', 'error');
    }
  } catch (err) {
    console.error('Error saving worker:', err);
    showToast('Network error saving worker', 'error');
  }
}

async function deleteEmployee(empId) {
  const emp = state.employees.find(e => e.id === empId);
  const name = emp ? emp.name : 'this worker';
  if (!confirm(`Are you sure you want to remove ${name} from the staff roster?`)) return;

  try {
    const res = await fetch(`/api/employees/${empId}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.success) {
      showToast(`${name} removed`, 'info');
      await loadData();
    } else {
      showToast(result.error || 'Failed to delete worker', 'error');
    }
  } catch (err) {
    console.error('Error deleting worker:', err);
    showToast('Network error deleting worker', 'error');
  }
}

// ----------------------------------------------------
// PAYROLL & SALARY PAYOUT MODALS
// ----------------------------------------------------
function updatePayrollEmployeeDropdown() {
  const payEmpSelect = document.getElementById('pay-employee-id');
  if (!payEmpSelect) return;
  const currentVal = payEmpSelect.value;
  payEmpSelect.innerHTML = `
    <option value="" disabled ${!currentVal ? 'selected' : ''}>Choose worker / staff member...</option>
    ${state.employees.map(e => {
      const proj = state.projects.find(p => p.id === e.assignedProjectId);
      const siteTag = proj ? ` [${proj.code}]` : '';
      const rateText = e.wageType === 'Daily Wage' ? `₹${e.wageRate}/day` : `₹${e.wageRate}/mo`;
      return `<option value="${e.id}" ${e.id === currentVal ? 'selected' : ''}>${e.name} — ${e.role} (${rateText})${siteTag}</option>`;
    }).join('')}
  `;
}

function openSalaryModal(empId = null, siteId = null) {
  updatePayrollEmployeeDropdown();

  const empSelect = document.getElementById('pay-employee-id');
  const projSelect = document.getElementById('pay-project-id');
  const dateInput = document.getElementById('pay-date');
  const amtInput = document.getElementById('pay-amount');
  const typeSelect = document.getElementById('pay-type');
  const periodInput = document.getElementById('pay-period');
  const refInput = document.getElementById('pay-ref');
  const notesInput = document.getElementById('pay-notes');

  if (dateInput) dateInput.value = new Date().toISOString().split('T')[0];
  if (refInput) refInput.value = 'VOUCHER-' + Math.floor(1000 + Math.random() * 9000);
  if (notesInput) notesInput.value = '';

  if (empId && empSelect) {
    empSelect.value = empId;
    onPayrollEmployeeSelect(empId);
  } else if (empSelect) {
    empSelect.value = '';
    if (amtInput) amtInput.value = '';
    if (periodInput) periodInput.value = '';
  }

  if (siteId && projSelect) {
    projSelect.value = siteId;
  }

  openModal('modal-log-salary');
}

function onPayrollEmployeeSelect(empId) {
  const emp = state.employees.find(e => e.id === empId);
  if (!emp) return;

  const projSelect = document.getElementById('pay-project-id');
  const typeSelect = document.getElementById('pay-type');
  const amtInput = document.getElementById('pay-amount');
  const periodInput = document.getElementById('pay-period');

  if (projSelect && emp.assignedProjectId) {
    projSelect.value = emp.assignedProjectId;
  }

  const now = new Date();
  const monthName = now.toLocaleString('en-IN', { month: 'short', year: 'numeric' });

  if (emp.wageType === 'Monthly Salary') {
    if (typeSelect) typeSelect.value = 'Salary Payout';
    if (amtInput) amtInput.value = emp.wageRate || 35000;
    if (periodInput) periodInput.value = `${monthName} Salary`;
  } else {
    if (typeSelect) typeSelect.value = 'Daily Wage Payment';
    // suggest 6 days weekly wage
    if (amtInput) amtInput.value = (emp.wageRate || 800) * 6;
    if (periodInput) periodInput.value = `Week 47 (6 Days)`;
  }
}

async function submitPayrollForm(e) {
  e.preventDefault();
  const empId = document.getElementById('pay-employee-id')?.value;
  const projectId = document.getElementById('pay-project-id')?.value;
  const date = document.getElementById('pay-date')?.value;
  const type = document.getElementById('pay-type')?.value;
  const amount = Number(document.getElementById('pay-amount')?.value);
  const paymentMode = document.getElementById('pay-mode')?.value;
  const period = document.getElementById('pay-period')?.value;
  const transactionRef = document.getElementById('pay-ref')?.value;
  const notes = document.getElementById('pay-notes')?.value;

  if (!empId) {
    showToast('Please select a worker / employee', 'error');
    return;
  }
  if (!amount || amount <= 0) {
    showToast('Please enter a valid amount', 'error');
    return;
  }

  const payload = {
    employeeId: empId,
    projectId,
    date,
    type,
    amount,
    paymentMode,
    period,
    transactionRef,
    notes
  };

  try {
    const res = await fetch('/api/payroll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.success) {
      showToast(`Disbursed ₹${amount.toLocaleString('en-IN')} successfully!`, 'success');
      closeModal('modal-log-salary');
      await loadData();
    } else {
      showToast(result.error || 'Failed to save payment', 'error');
    }
  } catch (err) {
    console.error('Error logging payment:', err);
    showToast('Network error while logging payment', 'error');
  }
}

async function deleteSalaryPayment(payId) {
  if (!confirm('Are you sure you want to delete this payment record? This will adjust financial balances.')) return;
  try {
    const res = await fetch(`/api/payroll/${payId}`, { method: 'DELETE' });
    const result = await res.json();
    if (result.success) {
      showToast('Payment record deleted', 'info');
      await loadData();
    } else {
      showToast(result.error || 'Failed to delete payment', 'error');
    }
  } catch (err) {
    console.error('Error deleting payment:', err);
    showToast('Network error deleting payment', 'error');
  }
}

function printPaymentReceipt(payId) {
  const pay = state.salaryPayments.find(p => p.id === payId);
  if (!pay) return;
  const emp = state.employees.find(e => e.id === pay.employeeId);
  const proj = state.projects.find(p => p.id === pay.projectId);

  const printWindow = window.open('', '_blank', 'width=680,height=600');
  if (!printWindow) {
    showToast('Please allow popups to print payment voucher', 'warning');
    return;
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Payment Voucher - ${pay.transactionRef || pay.id}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; padding: 25px; color: #1e293b; background: #fff; }
        .voucher-box { border: 2px solid #0f172a; padding: 25px; border-radius: 8px; max-width: 640px; margin: 0 auto; }
        .header { text-align: center; border-bottom: 2px solid #e2e8f0; padding-bottom: 15px; margin-bottom: 18px; position: relative; }
        .header-logo { width: 55px; height: 55px; border-radius: 6px; background: #000; border: 1px solid #0f172a; margin: 0 auto 8px auto; display: block; object-fit: contain; }
        .header h2 { margin: 0; font-size: 1.4rem; text-transform: uppercase; letter-spacing: 0.06em; color: #0f172a; font-weight: 900; }
        .header .gold-span { color: #d97706; }
        .header .tagline { margin: 3px 0 0; font-size: 0.8rem; color: #64748b; font-weight: 700; letter-spacing: 0.05em; }
        .header .address-line { font-size: 0.75rem; color: #475569; margin-top: 4px; }
        .voucher-badge { display: inline-block; background: #fef3c7; color: #92400e; font-weight: 800; font-size: 0.75rem; padding: 3px 10px; border-radius: 4px; border: 1px solid #fcd34d; margin-top: 8px; }
        .meta-row { display: flex; justify-content: space-between; margin-bottom: 10px; font-size: 0.85rem; }
        .detail-table { width: 100%; border-collapse: collapse; margin: 15px 0; }
        .detail-table th, .detail-table td { border: 1px solid #cbd5e1; padding: 8px 12px; font-size: 0.85rem; text-align: left; }
        .detail-table th { background: #f8fafc; font-weight: 600; width: 35%; color: #334155; }
        .amt-highlight { font-size: 1.35rem; font-weight: 800; color: #0f172a; }
        .sign-area { display: flex; justify-content: space-between; margin-top: 45px; padding-top: 15px; }
        .sign-box { text-align: center; width: 42%; border-top: 1px dashed #64748b; padding-top: 6px; font-size: 0.775rem; color: #475569; }
        @media print { button { display: none; } }
      </style>
    </head>
    <body>
      <div class="voucher-box">
        <div class="header">
          <img src="logo.jpg" alt="Amitus Infra" class="header-logo">
          <h2>AMITUS <span class="gold-span">INFRA</span></h2>
          <div class="tagline">BUILDING HOME OF YOUR DREAM • SINCE 2001</div>
          <div class="address-line">Water Supply Road, Shibnagar, Agartala, Tripura - 799001 • 📞 098631 77877</div>
          <div class="voucher-badge">PAYMENT DISBURSEMENT VOUCHER</div>
        </div>
        <div class="meta-row">
          <div><strong>Voucher Ref:</strong> ${pay.transactionRef || pay.id}</div>
          <div><strong>Date:</strong> ${formatDate(pay.date)}</div>
        </div>
        <div class="meta-row">
          <div><strong>Site Project:</strong> ${proj ? proj.name + ' [' + proj.code + ']' : 'General Site'}</div>
          <div><strong>Mode:</strong> ${pay.paymentMode || 'Cash'}</div>
        </div>
        <table class="detail-table">
          <tr>
            <th>Paid To (Worker/Staff)</th>
            <td><strong>${pay.employeeName}</strong> ${emp ? '— ' + emp.role : ''}</td>
          </tr>
          <tr>
            <th>Payment Classification</th>
            <td>${pay.type}</td>
          </tr>
          <tr>
            <th>Work Period / Details</th>
            <td>${pay.period || 'Current Payout'}</td>
          </tr>
          <tr>
            <th>Amount Paid</th>
            <td class="amt-highlight">₹ ${(Number(pay.amount) || 0).toLocaleString('en-IN')}</td>
          </tr>
          <tr>
            <th>Remarks / Notes</th>
            <td>${pay.notes || 'Disbursement verified and cleared on-site.'}</td>
          </tr>
        </table>
        <div class="sign-area">
          <div class="sign-box">Received By (Worker Signature/Thumb)</div>
          <div class="sign-box">Authorized By (Site In-Charge)</div>
        </div>
      </div>
      <div style="text-align:center;margin-top:20px;">
        <button onclick="window.print()" style="padding:8px 18px;font-size:0.9rem;cursor:pointer;font-weight:600;background:#0f172a;color:#fff;border:none;border-radius:4px;">Print Voucher</button>
      </div>
      <script>
        setTimeout(() => window.print(), 300);
      </script>
    </body>
    </html>
  `);
  printWindow.document.close();
}

// ====================================================
// 9. WHATSAPP DAILY OPERATIONS BRIEF (9:00 PM AUTOMATION)
// ====================================================
let currentWhatsAppReport = null;

async function openWhatsAppReportModal(targetDate = null) {
  openModal('modal-whatsapp-report');
  const previewBox = document.getElementById('wa-message-preview');
  if (previewBox) {
    previewBox.textContent = '🔄 Loading and compiling today\'s 9:00 PM operational report...';
  }

  try {
    const url = targetDate ? `/api/daily-report?date=${targetDate}` : '/api/daily-report';
    const res = await fetch(url);
    const data = await res.json();
    if (data.success && data.report) {
      currentWhatsAppReport = data.report;
      if (previewBox) {
        previewBox.textContent = data.report.messageText;
      }
      const phoneInput = document.getElementById('wa-recipient-phone');
      if (phoneInput && state.settings.phone) {
        phoneInput.value = state.settings.phone;
      }
    } else {
      if (previewBox) previewBox.textContent = 'Failed to generate report from server.';
    }
  } catch (err) {
    console.error('Error fetching daily report:', err);
    if (previewBox) previewBox.textContent = 'Network error fetching daily report.';
  }
}

function copyWhatsAppMessage() {
  const previewBox = document.getElementById('wa-message-preview');
  if (!previewBox || !previewBox.textContent) return;
  navigator.clipboard.writeText(previewBox.textContent).then(() => {
    showToast('WhatsApp Daily Brief copied to clipboard!', 'success');
  }).catch(() => {
    showToast('Could not copy to clipboard', 'error');
  });
}

function sendWhatsAppMessage() {
  const previewBox = document.getElementById('wa-message-preview');
  if (!previewBox || !previewBox.textContent) {
    showToast('No report text available', 'error');
    return;
  }
  const phoneInput = document.getElementById('wa-recipient-phone');
  let rawPhone = phoneInput ? phoneInput.value : '098631 77877';
  let cleanPhone = rawPhone.replace(/[^0-9]/g, '');
  if (cleanPhone.length === 10) cleanPhone = '91' + cleanPhone;
  else if (cleanPhone.startsWith('0')) cleanPhone = '91' + cleanPhone.replace(/^0+/, '');

  const text = previewBox.textContent;
  const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`;
  window.open(waUrl, '_blank');
  showToast('Opening WhatsApp with compiled daily brief...', 'info');
}


// ====================================================
// 10. AMITUS INFRA OFFICIAL HOME SHOWCASE (FROM FB & 23-YEAR HERITAGE)
// ====================================================
function renderHomePage(container) {
  const g4Proj = state.projects.find(p => p.id === 'proj_horizon') || state.projects[0];
  const daminiProj = state.projects.find(p => p.id === 'proj_plaza') || state.projects[1];
  const senoritaProj = state.projects.find(p => p.id === 'proj_villas') || state.projects[2];

  container.innerHTML = `
    <!-- 1. Hero Showcase Section -->
    <div class="home-hero">
      <div class="home-hero-badge">
        <span>🏗️ AMITUS INFRA • BUILDING DREAMS SINCE 2001</span>
      </div>

      <h1 class="home-hero-title">
        We Create Your <span class="gold-text">Dream House</span> — Modern & Minimalist
      </h1>

      <p class="home-hero-sub">
        Over <strong>23+ years</strong> of civil engineering and architectural excellence in Agartala, Tripura. We have proudly designed, constructed, and handed over <strong>300+ dream homes</strong>, premier G+4 multi-storey apartment complexes, and custom turnkey residences with laboratory-grade structural concrete and direct-contractor pricing.
      </p>

      <div class="home-hero-actions">
        <a href="tel:09863177877" class="btn btn-primary" style="padding:0.65rem 1.25rem;font-size:0.9rem;font-weight:700;display:inline-flex;align-items:center;gap:0.45rem;text-decoration:none;">
          📞 Call Director (098631 77877)
        </a>
        <a href="https://wa.me/919863177877?text=Hi%20Amitus%20Infra,%20I%20am%20interested%20in%20your%20construction%20and%20apartment%20projects" target="_blank" class="btn btn-secondary" style="padding:0.65rem 1.25rem;font-size:0.9rem;font-weight:700;display:inline-flex;align-items:center;gap:0.45rem;text-decoration:none;">
          💬 WhatsApp Inquiry ↗
        </a>
        ${state.auth && state.auth.isAuthenticated ? `
          <button class="btn btn-sm" onclick="switchTab('projects')" style="padding:0.65rem 1.15rem;font-size:0.875rem;">
            🏢 View All Site Projects →
          </button>
          <button class="btn btn-sm btn-accent" onclick="switchTab('dashboard')" style="padding:0.65rem 1.15rem;font-size:0.875rem;">
            📊 Site Operations Portal →
          </button>
        ` : `
          <button class="btn btn-sm btn-accent" onclick="openDirectorLoginModal()" style="padding:0.65rem 1.15rem;font-size:0.875rem;">
            🔐 Director Portal Login →
          </button>
        `}
      </div>

      <div style="margin-top:1.75rem;padding-top:1.25rem;border-top:1px solid var(--border);display:flex;align-items:center;gap:1rem;flex-wrap:wrap;font-size:0.8rem;color:var(--text-muted);">
        <div style="display:flex;align-items:center;gap:0.4rem;">
          <span style="color:var(--primary);font-weight:800;">👤 Founder & Director:</span>
          <strong style="color:var(--text-main);">Santanu Bhaumik</strong>
        </div>
        <div>•</div>
        <div style="display:flex;align-items:center;gap:0.4rem;">
          <span style="color:var(--primary);font-weight:800;">📍 Registered Office:</span>
          <span>Water Supply Road, Shibnagar / Dhaleswar, Agartala</span>
        </div>
        <div>•</div>
        <div>
          <a href="https://www.facebook.com/p/AMITUS-INFRA-100054490118222/" target="_blank" style="color:var(--primary);text-decoration:none;font-weight:700;display:inline-flex;align-items:center;gap:0.25rem;">
            Official Facebook Page ↗
          </a>
        </div>
      </div>
    </div>

    <!-- 2. Credibility & Milestones Statistics -->
    <div class="home-stats-grid">
      <div class="home-stat-card">
        <div class="home-stat-number">23+</div>
        <div class="home-stat-label">Years of Engineering Excellence</div>
        <div class="home-stat-sub">Building trust & quality since 2001</div>
      </div>

      <div class="home-stat-card">
        <div class="home-stat-number">300+</div>
        <div class="home-stat-label">Dream Homes Delivered</div>
        <div class="home-stat-sub">Happy families across Agartala & Tripura</div>
      </div>

      <div class="home-stat-card">
        <div class="home-stat-number">12</div>
        <div class="home-stat-label">G+4 Luxury Modern Flats</div>
        <div class="home-stat-sub">2BHK & 3BHK in Shibnagar / Dhaleswar</div>
      </div>

      <div class="home-stat-card">
        <div class="home-stat-number">100%</div>
        <div class="home-stat-label">RERA & Structural Certified</div>
        <div class="home-stat-sub">Earthquake-resistant RCC design</div>
      </div>
    </div>

    <!-- 3. Featured Real-World Developments (from FB & RERA records) -->
    <div class="home-section-header">
      <h2>Featured Architectural Developments</h2>
      <p>Discover our premier residential apartment complexes and turnkey dream homes in Agartala.</p>
    </div>

    <div class="home-projects-grid">
      <!-- Project 1: G+4 Residential Complex -->
      <div class="home-project-card">
        <div class="home-project-header">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.5rem;">
            <span class="project-code-tag">${g4Proj.code}</span>
            <span class="badge badge-success">Active Slab Casting</span>
          </div>
          <h3 style="font-size:1.15rem;font-weight:800;color:var(--text-main);">
            ${g4Proj.name}
          </h3>
          <div style="font-size:0.775rem;color:var(--text-muted);margin-top:0.25rem;">
            📍 ${g4Proj.location}
          </div>
        </div>

        <div class="home-project-body">
          <div>
            <p style="font-size:0.825rem;color:var(--text-muted);line-height:1.5;margin-bottom:1rem;">
              Premier G+4 storey residential development featuring <strong>12 spacious 2BHK and 3BHK modern flats</strong>. Engineered with earthquake-resistant RCC structural framing, precision roof slab concrete pouring, contemporary elevation, elevator, and covered parking.
            </p>

            <div style="background:var(--bg-subtle);padding:0.65rem 0.85rem;border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:1rem;font-size:0.75rem;">
              <div style="display:flex;justify-content:space-between;margin-bottom:0.25rem;">
                <span style="color:var(--text-muted);">Current Civil Phase:</span>
                <strong style="color:var(--text-main);">${g4Proj.constructionPhase}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;">
                <span style="color:var(--text-muted);">Project Progress:</span>
                <strong style="color:var(--primary);">${g4Proj.progressPct || 58}% Complete</strong>
              </div>
            </div>
          </div>

          <div style="display:flex;gap:0.4rem;align-items:center;">
            <button class="btn btn-sm btn-primary" onclick="openSiteDetail('${g4Proj.id}')" style="flex:1;">
              📍 Site Portal [${g4Proj.code}]
            </button>
            <a href="https://wa.me/919863177877?text=Hi%20Director%20Santanu%20Bhaumik,%20I%20am%20interested%20in%20Amitus%20G%2B4%20Residency%20Shibnagar%20flats" target="_blank" class="contact-btn wa" style="padding:0.4rem 0.65rem;font-size:0.75rem;text-decoration:none;">
              💬 Inquire
            </a>
          </div>
        </div>
      </div>

      <!-- Project 2: Amitus Damini Residency -->
      <div class="home-project-card">
        <div class="home-project-header">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.5rem;">
            <span class="project-code-tag">${daminiProj.code}</span>
            <span class="badge badge-info">RERA: PRTR08210186</span>
          </div>
          <h3 style="font-size:1.15rem;font-weight:800;color:var(--text-main);">
            ${daminiProj.name}
          </h3>
          <div style="font-size:0.775rem;color:var(--text-muted);margin-top:0.25rem;">
            📍 ${daminiProj.location}
          </div>
        </div>

        <div class="home-project-body">
          <div>
            <p style="font-size:0.825rem;color:var(--text-muted);line-height:1.5;margin-bottom:1rem;">
              Officially <strong>RERA-registered (PRTR08210186)</strong> residential enclave in prestigious Abhoynagar. Designed with premium vitrified tile flooring, 24x7 water supply, power backup, and modern exterior aesthetics. Ready for handover.
            </p>

            <div style="background:var(--bg-subtle);padding:0.65rem 0.85rem;border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:1rem;font-size:0.75rem;">
              <div style="display:flex;justify-content:space-between;margin-bottom:0.25rem;">
                <span style="color:var(--text-muted);">Current Phase:</span>
                <strong style="color:var(--text-main);">${daminiProj.constructionPhase}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;">
                <span style="color:var(--text-muted);">Project Progress:</span>
                <strong style="color:var(--success);">${daminiProj.progressPct || 85}% (Finishing Stage)</strong>
              </div>
            </div>
          </div>

          <div style="display:flex;gap:0.4rem;align-items:center;">
            <button class="btn btn-sm btn-primary" onclick="openSiteDetail('${daminiProj.id}')" style="flex:1;">
              📍 Site Portal [${daminiProj.code}]
            </button>
            <a href="https://wa.me/919863177877?text=Hi%20Director%20Santanu%20Bhaumik,%20I%20am%20interested%20in%20Amitus%20Damini%20Residency%20Abhoynagar" target="_blank" class="contact-btn wa" style="padding:0.4rem 0.65rem;font-size:0.75rem;text-decoration:none;">
              💬 Inquire
            </a>
          </div>
        </div>
      </div>

      <!-- Project 3: Amitus Senorita Rise & Custom Homes -->
      <div class="home-project-card">
        <div class="home-project-header">
          <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.5rem;">
            <span class="project-code-tag">${senoritaProj.code}</span>
            <span class="badge badge-warning">Minimalist Facade</span>
          </div>
          <h3 style="font-size:1.15rem;font-weight:800;color:var(--text-main);">
            ${senoritaProj.name}
          </h3>
          <div style="font-size:0.775rem;color:var(--text-muted);margin-top:0.25rem;">
            📍 ${senoritaProj.location}
          </div>
        </div>

        <div class="home-project-body">
          <div>
            <p style="font-size:0.825rem;color:var(--text-muted);line-height:1.5;margin-bottom:1rem;">
              Contemporary architectural apartments and bespoke turnkey villas located in Dhaleswar. Features clean geometric lines, glass and stainless steel balcony railings, and thoughtfully designed cross-ventilated family spaces.
            </p>

            <div style="background:var(--bg-subtle);padding:0.65rem 0.85rem;border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:1rem;font-size:0.75rem;">
              <div style="display:flex;justify-content:space-between;margin-bottom:0.25rem;">
                <span style="color:var(--text-muted);">Current Phase:</span>
                <strong style="color:var(--text-main);">${senoritaProj.constructionPhase}</strong>
              </div>
              <div style="display:flex;justify-content:space-between;">
                <span style="color:var(--text-muted);">Project Progress:</span>
                <strong style="color:var(--primary);">${senoritaProj.progressPct || 42}% Complete</strong>
              </div>
            </div>
          </div>

          <div style="display:flex;gap:0.4rem;align-items:center;">
            <button class="btn btn-sm btn-primary" onclick="openSiteDetail('${senoritaProj.id}')" style="flex:1;">
              📍 Site Portal [${senoritaProj.code}]
            </button>
            <a href="https://wa.me/919863177877?text=Hi%20Director%20Santanu%20Bhaumik,%20I%20am%20interested%20in%20Amitus%20Senorita%20Rise%20Dhaleswar" target="_blank" class="contact-btn wa" style="padding:0.4rem 0.65rem;font-size:0.75rem;text-decoration:none;">
              💬 Inquire
            </a>
          </div>
        </div>
      </div>
    </div>

    <!-- 3b. Live Construction Site Progress Gallery Showcase -->
    <div class="home-section-header" style="margin-top:2.5rem;">
      <div style="display:flex;justify-content:space-between;align-items:flex-end;flex-wrap:wrap;gap:0.5rem;">
        <div>
          <h2>Live Construction Site Progress</h2>
          <p>Real-time photographic documentation of our active civil construction, slab casting, and finishing.</p>
        </div>
        <button class="btn btn-sm btn-outline" onclick="switchTab('site-photos')">
          📸 View Full Gallery →
        </button>
      </div>
    </div>

    <div class="photo-gallery-grid" style="margin-bottom:2.5rem;">
      ${(state.sitePhotos || []).filter(p => p.showcaseOnHome !== false).slice(0, 3).map(p => `
        <div class="photo-card">
          <div class="photo-img-wrap">
            <img src="${p.imageUrl || 'logo.jpg'}" alt="${p.title}">
            <div class="photo-phase-tag">${p.phase}</div>
          </div>
          <div style="padding:1rem;">
            <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.25rem;">
              <span style="font-size:0.75rem;color:var(--primary);font-weight:700;">${p.projectName}</span>
              <span style="font-size:0.7rem;color:var(--text-muted);">${p.date}</span>
            </div>
            <h4 style="font-size:0.95rem;font-weight:800;color:var(--text-main);line-height:1.4;margin-bottom:0.4rem;">
              ${p.title}
            </h4>
            <p style="font-size:0.775rem;color:var(--text-muted);line-height:1.4;">
              ${p.caption}
            </p>
          </div>
        </div>
      `).join('')}
    </div>

    <!-- 4. Director's Heritage & Personal Quality Guarantee -->
    <div class="home-quote-card">
      <div style="width:68px;height:68px;border-radius:50%;background:#000;border:2px solid var(--primary);display:flex;align-items:center;justify-content:center;flex-shrink:0;overflow:hidden;box-shadow:0 4px 14px rgba(0,0,0,0.4);">
        <img src="logo.jpg" alt="Santanu Bhaumik" style="width:100%;height:100%;object-fit:contain;">
      </div>
      <div>
        <div style="font-size:1.05rem;font-style:italic;color:var(--text-main);line-height:1.6;font-weight:500;">
          "For more than 23 years, our philosophy at Amitus Infra has been simple: we do not merely construct concrete structures; we build homes where families thrive and dreams take root. Every slab we cast and every brick we lay carries our personal guarantee of safety, durability, and craftsmanship."
        </div>
        <div style="margin-top:0.75rem;display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
          <strong style="font-size:0.95rem;color:var(--primary);">Santanu Bhaumik</strong>
          <span style="color:var(--text-muted);font-size:0.8rem;">— Founder & Managing Director, Amitus Infra (Since 2001)</span>
          <a href="tel:09863177877" style="color:var(--text-main);font-size:0.75rem;font-weight:700;margin-left:auto;text-decoration:none;">
            📞 098631 77877
          </a>
        </div>
      </div>
    </div>

    <!-- 5. Interactive Dream Home Consultation & Booking Form -->
    <div class="home-inquiry-box">
      <div style="text-align:center;max-width:600px;margin:0 auto 1.5rem auto;">
        <span class="badge" style="background:var(--primary-light);color:var(--primary);border:1px solid var(--border-focus);font-size:0.7rem;font-weight:800;text-transform:uppercase;">
          FREE SITE VISIT & CONSULTATION
        </span>
        <h2 style="font-size:1.5rem;font-weight:800;color:var(--text-main);margin-top:0.4rem;">
          Plan Your Dream Home with Amitus Infra
        </h2>
        <p style="font-size:0.825rem;color:var(--text-muted);margin-top:0.25rem;">
          Interested in booking a 2BHK/3BHK flat or constructing a custom house in Agartala? Send your specifications directly to Director Santanu Bhaumik via WhatsApp.
        </p>
      </div>

      <form id="form-home-inquiry" onsubmit="submitHomeInquiry(event)" style="max-width:720px;margin:0 auto;">
        <div class="form-grid">
          <div class="form-group">
            <label class="form-label">Your Full Name <span class="req">*</span></label>
            <input type="text" id="inquiry-name" class="form-control" required placeholder="e.g. Subrata Debbarma / Anirban Roy">
          </div>
          <div class="form-group">
            <label class="form-label">Mobile Number (WhatsApp Preferred) <span class="req">*</span></label>
            <input type="tel" id="inquiry-phone" class="form-control" required placeholder="e.g. 098631 XXXXX">
          </div>
        </div>

        <div class="form-grid-3">
          <div class="form-group">
            <label class="form-label">Project Interest <span class="req">*</span></label>
            <select id="inquiry-type" class="form-control" required>
              <option value="2BHK Modern Flat (G+4 Shibnagar)">2BHK Flat — G+4 Shivnagar</option>
              <option value="3BHK Luxury Flat (G+4 Shibnagar)">3BHK Flat — G+4 Shivnagar</option>
              <option value="Damini Residency Flat (Abhoynagar)">Damini Residency (Abhoynagar)</option>
              <option value="Senorita Rise Apartment (Dhaleswar)">Senorita Rise (Dhaleswar)</option>
              <option value="Turnkey Custom Home / Duplex Construction">Custom Turnkey Home Construction</option>
              <option value="Commercial Complex / Shed Construction">Commercial Development</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">Preferred Location in Agartala</label>
            <input type="text" id="inquiry-location" class="form-control" placeholder="e.g. Shibnagar, Dhaleswar, Abhoynagar">
          </div>
          <div class="form-group">
            <label class="form-label">Estimated Budget</label>
            <select id="inquiry-budget" class="form-control">
              <option value="₹ 25 Lakhs - ₹ 40 Lakhs">₹ 25 Lakhs - ₹ 40 Lakhs</option>
              <option value="₹ 40 Lakhs - ₹ 60 Lakhs" selected>₹ 40 Lakhs - ₹ 60 Lakhs</option>
              <option value="₹ 60 Lakhs - ₹ 1 Crore">₹ 60 Lakhs - ₹ 1 Crore</option>
              <option value="Above ₹ 1 Crore">Above ₹ 1 Crore</option>
            </select>
          </div>
        </div>

        <div class="form-group">
          <label class="form-label">Specific Requirements / Message</label>
          <textarea id="inquiry-message" class="form-control" rows="2" placeholder="e.g. Looking for a 3rd-floor 3BHK with covered car parking and south-facing balcony..."></textarea>
        </div>

        <div style="text-align:center;margin-top:1.25rem;">
          <button type="submit" class="btn btn-primary" style="padding:0.75rem 2rem;font-size:0.95rem;font-weight:800;border-radius:var(--radius-sm);box-shadow:0 4px 14px rgba(245,158,11,0.35);">
            📲 Submit Inquiry via WhatsApp to Director Santanu Bhaumik ↗
          </button>
        </div>
      </form>
    </div>

    <!-- 6. Office Location & Facebook Community Card -->
    <div style="background:var(--bg-subtle);border:1px solid var(--border);border-radius:var(--radius-lg);padding:1.5rem 1.75rem;display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:1.25rem;margin-bottom:2rem;">
      <div style="display:flex;align-items:center;gap:1rem;">
        <div style="width:48px;height:48px;border-radius:var(--radius-sm);background:#000;border:1px solid var(--border-focus);display:flex;align-items:center;justify-content:center;overflow:hidden;flex-shrink:0;">
          <img src="logo.jpg" alt="Amitus Infra" style="width:100%;height:100%;object-fit:contain;">
        </div>
        <div>
          <h4 style="font-size:1.05rem;font-weight:800;color:var(--text-main);">
            Amitus Infra Registered Office & Site Engineering Bay
          </h4>
          <p style="font-size:0.8rem;color:var(--text-muted);margin-top:2px;">
            Water Supply Road, Shibnagar, Dhaleswar, Agartala, Tripura - 799001 • Hotline: <strong>098631 77877</strong>
          </p>
        </div>
      </div>

      <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">
        <a href="https://www.google.com/maps/dir/Amitus+Infra,+Water+Supply+Rd,+Shibnagar,+Dhaleswar,+Agartala,+Tripura+799004/23.8298247,91.2917605/@23.8307982,91.2925526,455m/data=!3m2!1e3!4b1!4m8!4m7!1m5!1m1!1s0x3753f3d8c074ef9b:0x80169c98304c1552!2m2!1d91.2958744!2d23.8313774!1m0?entry=ttu&g_ep=EgoyMDI2MTExNy4wIKXMDSoASAFQAw%3D%3D" target="_blank" class="btn-directions" style="padding:0.5rem 1rem;font-size:0.8rem;">
          🗺️ Get Directions on Google Maps ↗
        </a>
        <a href="https://www.facebook.com/p/AMITUS-INFRA-100054490118222/" target="_blank" class="btn btn-sm" style="padding:0.5rem 1rem;font-size:0.8rem;display:inline-flex;align-items:center;gap:0.35rem;">
          🌐 Official Facebook Page (7K+ Views) ↗
        </a>
      </div>
    </div>
  `;
}

function submitHomeInquiry(e) {
  e.preventDefault();
  const name = document.getElementById('inquiry-name')?.value.trim();
  const phone = document.getElementById('inquiry-phone')?.value.trim();
  const type = document.getElementById('inquiry-type')?.value;
  const location = document.getElementById('inquiry-location')?.value.trim() || 'Agartala';
  const budget = document.getElementById('inquiry-budget')?.value;
  const msg = document.getElementById('inquiry-message')?.value.trim() || 'Interested in booking / consultation.';

  if (!name || !phone) {
    showToast('Please provide your name and phone number', 'error');
    return;
  }

  let text = `🏗️ *AMITUS INFRA — CLIENT INQUIRY*\n`;
  text += `👤 *Name:* ${name}\n`;
  text += `📞 *Phone:* ${phone}\n`;
  text += `🏢 *Interested In:* ${type}\n`;
  text += `📍 *Preferred Area:* ${location}\n`;
  text += `💰 *Budget Range:* ${budget}\n`;
  text += `💬 *Requirements:* ${msg}\n\n`;
  text += `_Submitted via Amitus Infra Online Portal_`;

  const waUrl = `https://wa.me/919863177877?text=${encodeURIComponent(text)}`;
  window.open(waUrl, '_blank');
  showToast('Inquiry prepared! Opening WhatsApp to connect with Director Santanu Bhaumik...', 'success');
}


// ====================================================
// PWA INSTALLATION & SERVICE WORKER SETUP
// ====================================================
let deferredInstallPrompt = null;
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(reg => console.log('PWA Service Worker registered:', reg.scope))
      .catch(err => console.log('SW registration error:', err));
  });
}

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  const btn = document.getElementById('pwa-install-btn');
  if (btn) btn.style.display = 'inline-flex';
});

function triggerPWAInstall() {
  if (deferredInstallPrompt) {
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice.then((choiceResult) => {
      if (choiceResult.outcome === 'accepted') {
        showToast('Amitus Infra installed successfully!', 'success');
      }
      deferredInstallPrompt = null;
      const btn = document.getElementById('pwa-install-btn');
      if (btn) btn.style.display = 'none';
    });
  } else {
    openModal('modal-pwa-guide');
  }
}

// ====================================================
// 1. CIVIL ENGINEERING CONCRETE & MATERIAL ESTIMATOR
// ====================================================
function renderCivilEstimator(container) {
  const activeTab = state.activeEstimatorTab || 'concrete';
  const targetSiteId = state.selectedProjectId !== 'all' ? state.selectedProjectId : (state.projects[0]?.id || 'proj_horizon');
  const targetProject = state.projects.find(p => p.id === targetSiteId) || state.projects[0] || { id: 'proj_horizon', name: 'Amitus G+4 Residency', code: 'AG4-SHIB' };

  container.innerHTML = `
    <div class="content-header-row" style="margin-bottom:1.25rem;">
      <div>
        <h2 style="font-size:1.4rem;font-weight:800;color:var(--text-main);display:flex;align-items:center;gap:0.5rem;">
          📐 Civil Engineering Quantity & Concrete Estimator
        </h2>
        <p style="font-size:0.825rem;color:var(--text-muted);margin-top:2px;">
          Calculate precise civil material quantities (Cement Bags, Sand CFT, Stone Chips, Steel rebar & Bricks) based on IS 456 standards and compare directly against site stock.
        </p>
      </div>

      <div style="display:flex;align-items:center;gap:0.5rem;">
        <label style="font-size:0.775rem;font-weight:700;color:var(--text-muted);">Site Stock Check:</label>
        <select id="estimator-site-select" class="form-control form-control-sm" style="width:230px;" onchange="changeEstimatorSite(this.value)">
          ${state.projects.map(p => `
            <option value="${p.id}" ${p.id === targetSiteId ? 'selected' : ''}>${p.name} [${p.code}]</option>
          `).join('')}
        </select>
      </div>
    </div>

    <!-- Mode Selector Sub-Tabs -->
    <div style="display:flex;gap:0.4rem;border-bottom:1px solid var(--border);padding-bottom:0.75rem;margin-bottom:1.5rem;overflow-x:auto;">
      <button class="btn btn-sm ${activeTab === 'concrete' ? 'btn-primary' : ''}" onclick="switchEstimatorTab('concrete')">
        🏗️ RCC Roof Slab / Beam / Column
      </button>
      <button class="btn btn-sm ${activeTab === 'brick' ? 'btn-primary' : ''}" onclick="switchEstimatorTab('brick')">
        🧱 Brickwork Masonry (5" & 10" Walls)
      </button>
      <button class="btn btn-sm ${activeTab === 'plaster' ? 'btn-primary' : ''}" onclick="switchEstimatorTab('plaster')">
        🪵 Wall Plaster & Primer (12mm/15mm)
      </button>
    </div>

    <div id="estimator-tab-content">
      ${activeTab === 'concrete' ? getConcreteEstimatorHtml(targetProject) : (activeTab === 'brick' ? getBrickEstimatorHtml(targetProject) : getPlasterEstimatorHtml(targetProject))}
    </div>
  `;

  // Attach live calculation triggers
  if (activeTab === 'concrete') calculateConcreteEstimates();
  else if (activeTab === 'brick') calculateBrickEstimates();
  else if (activeTab === 'plaster') calculatePlasterEstimates();
}

function switchEstimatorTab(tab) {
  state.activeEstimatorTab = tab;
  renderActiveTab();
}

function changeEstimatorSite(siteId) {
  state.selectedProjectId = siteId;
  renderActiveTab();
}

function getConcreteEstimatorHtml(project) {
  return `
    <div class="estimator-calc-card">
      <div class="estimator-header-row">
        <div>
          <h3 style="font-size:1.15rem;font-weight:800;color:var(--text-main);">
            RCC Concrete & Steel Requisition for Roof Slab / Frame
          </h3>
          <p style="font-size:0.775rem;color:var(--text-muted);margin-top:2px;">
            Standard Dry Shrinkage Multiplier: 1.54 • IS 456 Structural Concrete Proportions
          </p>
        </div>
        <span class="badge badge-info" style="font-size:0.75rem;">Selected Site: ${project.name}</span>
      </div>

      <div class="form-grid-3">
        <div class="form-group">
          <label class="form-label">Slab Length (Feet) <span class="req">*</span></label>
          <input type="number" id="calc-length" class="form-control" value="45" min="1" step="0.5" oninput="calculateConcreteEstimates()">
        </div>
        <div class="form-group">
          <label class="form-label">Slab Width (Feet) <span class="req">*</span></label>
          <input type="number" id="calc-width" class="form-control" value="30" min="1" step="0.5" oninput="calculateConcreteEstimates()">
        </div>
        <div class="form-group">
          <label class="form-label">Slab Thickness / Depth (Inches) <span class="req">*</span></label>
          <input type="number" id="calc-depth" class="form-control" value="5" min="3" step="0.5" oninput="calculateConcreteEstimates()">
        </div>
      </div>

      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Concrete Mix Grade / Proportion <span class="req">*</span></label>
          <select id="calc-mix" class="form-control" onchange="calculateConcreteEstimates()">
            <option value="M20" selected>M20 Grade (1 : 1.5 : 3) — Standard for RCC Slabs & Beams</option>
            <option value="M15">M15 Grade (1 : 2 : 4) — Flooring PCC & Foundation</option>
            <option value="M25">M25 Grade (1 : 1 : 2) — Heavy Load Columns & Water Tanks</option>
            <option value="M10">M10 Grade (1 : 3 : 6) — Lean Concrete Sub-base</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Estimated TMT Steel Reinforcement Ratio</label>
          <select id="calc-steel-pct" class="form-control" onchange="calculateConcreteEstimates()">
            <option value="1.0" selected>1.0% of Concrete Volume (Standard Residential Slab)</option>
            <option value="1.25">1.25% (Heavy Slab with Cantilever / Deep Beams)</option>
            <option value="1.5">1.5% (High Stress Columns & Footings)</option>
          </select>
        </div>
      </div>

      <!-- Live Calculation Breakdown Display -->
      <div class="estimator-results-box" id="concrete-calc-results">
        <!-- Rendered by calculateConcreteEstimates -->
      </div>
    </div>
  `;
}

function calculateConcreteEstimates() {
  const L = parseFloat(document.getElementById('calc-length')?.value) || 0;
  const W = parseFloat(document.getElementById('calc-width')?.value) || 0;
  const D_in = parseFloat(document.getElementById('calc-depth')?.value) || 0;
  const mix = document.getElementById('calc-mix')?.value || 'M20';
  const steelPct = parseFloat(document.getElementById('calc-steel-pct')?.value) || 1.0;

  // Wet Volume in Cu.Ft
  const wetVolCFT = L * W * (D_in / 12);
  const wetVolM3 = wetVolCFT / 35.3147;
  // Dry volume shrinkage factor 1.54
  const dryVolCFT = wetVolCFT * 1.54;
  const dryVolM3 = wetVolM3 * 1.54;

  let cementRatio = 1, sandRatio = 1.5, stoneRatio = 3;
  if (mix === 'M15') { cementRatio = 1; sandRatio = 2; stoneRatio = 4; }
  else if (mix === 'M25') { cementRatio = 1; sandRatio = 1; stoneRatio = 2; }
  else if (mix === 'M10') { cementRatio = 1; sandRatio = 3; stoneRatio = 6; }

  const totalParts = cementRatio + sandRatio + stoneRatio;

  // Cement in bags (1 bag = 50kg = 0.0347 m3, density = 1440 kg/m3)
  const cementVolM3 = dryVolM3 * (cementRatio / totalParts);
  const cementKg = cementVolM3 * 1440;
  const cementBags = Math.ceil(cementKg / 50);

  // Sand in CFT and Brass (1 Brass = 100 CFT)
  const sandCFT = Math.round(dryVolCFT * (sandRatio / totalParts));
  const sandBrass = (sandCFT / 100).toFixed(2);

  // Stone Chips Aggregate in CFT and Brass
  const stoneCFT = Math.round(dryVolCFT * (stoneRatio / totalParts));
  const stoneBrass = (stoneCFT / 100).toFixed(2);

  // Steel in kg: 7850 kg/m3 * steelPct / 100 * wetVolM3
  const steelKg = Math.round(7850 * (steelPct / 100) * wetVolM3);
  const steelTons = (steelKg / 1000).toFixed(2);

  // Approximate Water required at 0.45 W/C ratio
  const waterLiters = Math.round(cementBags * 50 * 0.45);

  // Current Site Stock Comparison
  const targetSiteId = document.getElementById('estimator-site-select')?.value || state.selectedProjectId;
  const siteInventory = state.inventory.filter(i => targetSiteId === 'all' || i.projectId === targetSiteId);

  // Find matching items in stock
  const cementItem = siteInventory.find(i => i.category.toLowerCase().includes('cement') || i.name.toLowerCase().includes('cement')) || { quantity: 0, unit: 'Bags' };
  const steelItem = siteInventory.find(i => i.category.toLowerCase().includes('steel') || i.name.toLowerCase().includes('tmt') || i.name.toLowerCase().includes('tiscon')) || { quantity: 0, unit: 'Tons' };
  const sandItem = siteInventory.find(i => i.name.toLowerCase().includes('sand') || i.category.toLowerCase().includes('sand')) || { quantity: 0, unit: 'Brass' };
  const stoneItem = siteInventory.find(i => i.name.toLowerCase().includes('stone') || i.name.toLowerCase().includes('aggregate')) || { quantity: 0, unit: 'Brass' };

  const cementDiff = cementItem.quantity - cementBags;
  const steelInTons = parseFloat(steelTons);
  const steelDiff = (steelItem.quantity - steelInTons).toFixed(2);
  const sandInBrass = parseFloat(sandBrass);
  const sandDiff = (sandItem.quantity - sandInBrass).toFixed(2);
  const stoneInBrass = parseFloat(stoneBrass);
  const stoneDiff = (stoneItem.quantity - stoneInBrass).toFixed(2);

  const container = document.getElementById('concrete-calc-results');
  if (!container) return;

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:0.5rem;">
      <h4 style="font-size:1.05rem;font-weight:800;color:var(--text-main);">
        Material Requirement Breakdown
      </h4>
      <div style="font-size:0.8rem;color:var(--text-muted);">
        Wet Volume: <strong style="color:var(--text-main);">${wetVolCFT.toFixed(1)} CFT</strong> (${wetVolM3.toFixed(2)} m³) • Dry Shrinkage Vol: <strong>${dryVolCFT.toFixed(1)} CFT</strong>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(170px, 1fr));gap:0.75rem;margin-bottom:1.25rem;">
      <div class="calc-stat-pill">
        <span class="val">${cementBags} Bags</span>
        <span class="lbl">UltraTech Cement (50kg)</span>
      </div>
      <div class="calc-stat-pill">
        <span class="val">${sandCFT} CFT</span>
        <span class="lbl">River Sand (${sandBrass} Brass)</span>
      </div>
      <div class="calc-stat-pill">
        <span class="val">${stoneCFT} CFT</span>
        <span class="lbl">Stone Aggregates (${stoneBrass} Brass)</span>
      </div>
      <div class="calc-stat-pill">
        <span class="val">${steelKg} kg</span>
        <span class="lbl">TMT Rebars (${steelTons} Tons)</span>
      </div>
      <div class="calc-stat-pill">
        <span class="val">${waterLiters} Liters</span>
        <span class="lbl">Water (W/C: 0.45)</span>
      </div>
    </div>

    <!-- Live Site Stock Comparison -->
    <div style="background:var(--bg-card);border:1px solid var(--border);border-radius:var(--radius-sm);padding:1rem;margin-bottom:1.25rem;">
      <div style="font-size:0.8rem;font-weight:800;color:var(--text-main);text-transform:uppercase;margin-bottom:0.75rem;display:flex;justify-content:space-between;align-items:center;">
        <span>📊 Stock Availability at Selected Construction Site:</span>
        <span style="color:var(--primary);font-size:0.75rem;">Real-time Inventory Link</span>
      </div>

      <div class="stock-comparison-row">
        <div>
          <strong>Cement:</strong> Needed: <strong>${cementBags} Bags</strong> vs In Stock: <strong>${cementItem.quantity} Bags</strong>
        </div>
        <span class="badge ${cementDiff >= 0 ? 'badge-success' : 'badge-danger'}">
          ${cementDiff >= 0 ? '✅ Stock Sufficient (+' + cementDiff + ' surplus)' : '🔴 Shortage (' + Math.abs(cementDiff) + ' bags needed)'}
        </span>
      </div>

      <div class="stock-comparison-row">
        <div>
          <strong>TMT Steel:</strong> Needed: <strong>${steelTons} Tons</strong> vs In Stock: <strong>${steelItem.quantity} Tons</strong>
        </div>
        <span class="badge ${steelDiff >= 0 ? 'badge-success' : 'badge-danger'}">
          ${steelDiff >= 0 ? '✅ Sufficient' : '🔴 Shortage (' + Math.abs(steelDiff) + ' Tons needed)'}
        </span>
      </div>

      <div class="stock-comparison-row">
        <div>
          <strong>River Sand:</strong> Needed: <strong>${sandBrass} Brass</strong> vs In Stock: <strong>${sandItem.quantity} Brass</strong>
        </div>
        <span class="badge ${sandDiff >= 0 ? 'badge-success' : 'badge-danger'}">
          ${sandDiff >= 0 ? '✅ Sufficient' : '🔴 Shortage (' + Math.abs(sandDiff) + ' Brass needed)'}
        </span>
      </div>

      <div class="stock-comparison-row">
        <div>
          <strong>Stone Chips:</strong> Needed: <strong>${stoneBrass} Brass</strong> vs In Stock: <strong>${stoneItem.quantity} Brass</strong>
        </div>
        <span class="badge ${stoneDiff >= 0 ? 'badge-success' : 'badge-danger'}">
          ${stoneDiff >= 0 ? '✅ Sufficient' : '🔴 Shortage (' + Math.abs(stoneDiff) + ' Brass needed)'}
        </span>
      </div>
    </div>

    <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.75rem;">
      <span style="font-size:0.75rem;color:var(--text-muted);">
        ⚡ Formula: Dry Vol = Wet Vol × 1.54 • IS 456 M20 (1:1.5:3) • Steel @ ${steelPct}% volume
      </span>
      <button class="btn btn-primary btn-sm" onclick="sendEstimatorWhatsApp('concrete', ${cementBags}, '${sandBrass}', '${stoneBrass}', '${steelTons}', ${wetVolCFT.toFixed(0)})">
        📲 Share Requisition / Indent via WhatsApp ↗
      </button>
    </div>
  `;
}

function getBrickEstimatorHtml(project) {
  return `
    <div class="estimator-calc-card">
      <div class="estimator-header-row">
        <div>
          <h3 style="font-size:1.15rem;font-weight:800;color:var(--text-main);">
            Brickwork & Mortar Estimator (First-Class Burnt Clay Bricks)
          </h3>
          <p style="font-size:0.775rem;color:var(--text-muted);margin-top:2px;">
            Standard 10-inch External Load-bearing or 5-inch Internal Partition Walls with Deductions
          </p>
        </div>
        <span class="badge badge-info" style="font-size:0.75rem;">${project.name}</span>
      </div>

      <div class="form-grid-3">
        <div class="form-group">
          <label class="form-label">Wall Total Length (Feet) <span class="req">*</span></label>
          <input type="number" id="brick-wall-length" class="form-control" value="60" min="1" step="0.5" oninput="calculateBrickEstimates()">
        </div>
        <div class="form-group">
          <label class="form-label">Wall Height (Feet) <span class="req">*</span></label>
          <input type="number" id="brick-wall-height" class="form-control" value="10" min="1" step="0.5" oninput="calculateBrickEstimates()">
        </div>
        <div class="form-group">
          <label class="form-label">Wall Thickness <span class="req">*</span></label>
          <select id="brick-wall-thick" class="form-control" onchange="calculateBrickEstimates()">
            <option value="5">5 Inches (Single Brick Partition Wall)</option>
            <option value="10" selected>10 Inches (Double Brick External Wall)</option>
          </select>
        </div>
      </div>

      <div class="form-grid-3">
        <div class="form-group">
          <label class="form-label">Number of Doors (7ft × 3.5ft deduction)</label>
          <input type="number" id="brick-doors" class="form-control" value="2" min="0" oninput="calculateBrickEstimates()">
        </div>
        <div class="form-group">
          <label class="form-label">Number of Windows (4ft × 4ft deduction)</label>
          <input type="number" id="brick-windows" class="form-control" value="3" min="0" oninput="calculateBrickEstimates()">
        </div>
        <div class="form-group">
          <label class="form-label">Mortar Cement-Sand Proportion</label>
          <select id="brick-mortar-mix" class="form-control" onchange="calculateBrickEstimates()">
            <option value="1:5">1 : 5 Mortar (Rich Brickwork)</option>
            <option value="1:6" selected>1 : 6 Mortar (Standard PWD Mix)</option>
          </select>
        </div>
      </div>

      <div class="estimator-results-box" id="brick-calc-results"></div>
    </div>
  `;
}

function calculateBrickEstimates() {
  const L = parseFloat(document.getElementById('brick-wall-length')?.value) || 0;
  const H = parseFloat(document.getElementById('brick-wall-height')?.value) || 0;
  const thick = parseInt(document.getElementById('brick-wall-thick')?.value) || 10;
  const doors = parseInt(document.getElementById('brick-doors')?.value) || 0;
  const windows = parseInt(document.getElementById('brick-windows')?.value) || 0;
  const mortarMix = document.getElementById('brick-mortar-mix')?.value || '1:6';

  const grossArea = L * H;
  const deductionArea = (doors * 7 * 3.5) + (windows * 4 * 4);
  const netArea = Math.max(0, grossArea - deductionArea);

  // Standard Indian modular bricks:
  // For 5" wall: ~4.5 bricks per sq.ft + 5% breakage allowance = ~4.7 bricks/sq.ft
  // For 10" wall: ~9.0 bricks per sq.ft + 5% breakage allowance = ~9.45 bricks/sq.ft
  const bricksPerSqFt = thick === 5 ? 4.75 : 9.5;
  const totalBricks = Math.ceil(netArea * bricksPerSqFt);

  // Mortar requirements:
  // For 1000 bricks in 1:6 mix: ~1.25 bags cement, ~18 CFT sand
  const cementBags = Math.ceil((totalBricks / 1000) * (mortarMix === '1:5' ? 1.45 : 1.25));
  const sandCFT = Math.round((totalBricks / 1000) * 18);
  const sandBrass = (sandCFT / 100).toFixed(2);

  const container = document.getElementById('brick-calc-results');
  if (!container) return;

  container.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem;flex-wrap:wrap;gap:0.5rem;">
      <h4 style="font-size:1.05rem;font-weight:800;color:var(--text-main);">
        Brickwork & Mortar Estimation
      </h4>
      <div style="font-size:0.8rem;color:var(--text-muted);">
        Gross Area: <strong>${grossArea} sq.ft</strong> • Net Masonry: <strong style="color:var(--primary);">${netArea.toFixed(0)} sq.ft</strong>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(170px, 1fr));gap:0.75rem;margin-bottom:1.25rem;">
      <div class="calc-stat-pill">
        <span class="val">${totalBricks.toLocaleString('en-IN')} Pcs</span>
        <span class="lbl">First-Class Red Bricks</span>
      </div>
      <div class="calc-stat-pill">
        <span class="val">${cementBags} Bags</span>
        <span class="lbl">Mortar Cement (${mortarMix})</span>
      </div>
      <div class="calc-stat-pill">
        <span class="val">${sandCFT} CFT</span>
        <span class="lbl">Screened Sand (${sandBrass} Brass)</span>
      </div>
      <div class="calc-stat-pill">
        <span class="val">₹ ${(totalBricks * 9.5 + cementBags * 390 + sandCFT * 85).toLocaleString('en-IN', {maximumFractionDigits:0})}</span>
        <span class="lbl">Estimated Material Cost</span>
      </div>
    </div>

    <div style="text-align:right;">
      <button class="btn btn-primary btn-sm" onclick="sendEstimatorWhatsApp('brick', ${totalBricks}, ${cementBags}, '${sandBrass}', 0, ${netArea.toFixed(0)})">
        📲 Send Brickwork Indent via WhatsApp ↗
      </button>
    </div>
  `;
}

function getPlasterEstimatorHtml(project) {
  return `
    <div class="estimator-calc-card">
      <div class="estimator-header-row">
        <div>
          <h3 style="font-size:1.15rem;font-weight:800;color:var(--text-main);">
            Wall & Ceiling Plastering / Primer Estimator
          </h3>
          <p style="font-size:0.775rem;color:var(--text-muted);margin-top:2px;">
            12mm Internal Plaster, 18mm External Weather Plaster, and Acrylic Primer Coverage
          </p>
        </div>
        <span class="badge badge-info" style="font-size:0.75rem;">${project.name}</span>
      </div>

      <div class="form-grid-3">
        <div class="form-group">
          <label class="form-label">Total Plaster Surface Area (Sq.Ft) <span class="req">*</span></label>
          <input type="number" id="plaster-area" class="form-control" value="2500" min="10" step="50" oninput="calculatePlasterEstimates()">
        </div>
        <div class="form-group">
          <label class="form-label">Plaster Thickness <span class="req">*</span></label>
          <select id="plaster-thick" class="form-control" onchange="calculatePlasterEstimates()">
            <option value="12" selected>12 mm (Internal Brick Walls)</option>
            <option value="15">15 mm (Ceiling / Rough Surfaces)</option>
            <option value="18">18 mm (External Weather Facade)</option>
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Mix Proportion</label>
          <select id="plaster-mix" class="form-control" onchange="calculatePlasterEstimates()">
            <option value="1:4">1 : 4 (Ceiling & Rich Mix)</option>
            <option value="1:6" selected>1 : 6 (Standard Internal / External)</option>
          </select>
        </div>
      </div>

      <div class="estimator-results-box" id="plaster-calc-results"></div>
    </div>
  `;
}

function calculatePlasterEstimates() {
  const areaSqFt = parseFloat(document.getElementById('plaster-area')?.value) || 0;
  const thickMm = parseInt(document.getElementById('plaster-thick')?.value) || 12;
  const mix = document.getElementById('plaster-mix')?.value || '1:6';

  // Volume in m3: Area (m2) * thick (m)
  const areaM2 = areaSqFt / 10.764;
  const wetVolM3 = areaM2 * (thickMm / 1000);
  const dryVolM3 = wetVolM3 * 1.35; // 35% shrinkage & filling voids

  const parts = mix === '1:4' ? 5 : 7;
  const cementM3 = dryVolM3 * (1 / parts);
  const cementBags = Math.ceil((cementM3 * 1440) / 50);

  const sandM3 = dryVolM3 * ((parts - 1) / parts);
  const sandCFT = Math.round(sandM3 * 35.3147);
  const sandBrass = (sandCFT / 100).toFixed(2);

  // Primer coverage ~120 sq.ft per Liter
  const primerLiters = Math.ceil(areaSqFt / 120);

  const container = document.getElementById('plaster-calc-results');
  if (!container) return;

  container.innerHTML = `
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(170px, 1fr));gap:0.75rem;margin-bottom:1.25rem;">
      <div class="calc-stat-pill">
        <span class="val">${cementBags} Bags</span>
        <span class="lbl">Plastering Cement</span>
      </div>
      <div class="calc-stat-pill">
        <span class="val">${sandCFT} CFT</span>
        <span class="lbl">Fine Plaster Sand (${sandBrass} Brass)</span>
      </div>
      <div class="calc-stat-pill">
        <span class="val">${primerLiters} Liters</span>
        <span class="lbl">Wall Primer (1 Coat)</span>
      </div>
      <div class="calc-stat-pill">
        <span class="val">₹ ${(cementBags * 390 + sandCFT * 85 + primerLiters * 160).toLocaleString('en-IN', {maximumFractionDigits:0})}</span>
        <span class="lbl">Estimated Plaster Cost</span>
      </div>
    </div>

    <div style="text-align:right;">
      <button class="btn btn-primary btn-sm" onclick="sendEstimatorWhatsApp('plaster', ${cementBags}, '${sandBrass}', 0, 0, ${areaSqFt})">
        📲 Send Plaster Indent via WhatsApp ↗
      </button>
    </div>
  `;
}

function sendEstimatorWhatsApp(type, cement, sand, stone, steel, area) {
  const targetSiteId = document.getElementById('estimator-site-select')?.value || state.selectedProjectId;
  const proj = state.projects.find(p => p.id === targetSiteId) || state.projects[0];

  let text = `🏗️ *AMITUS INFRA — CIVIL MATERIAL INDENT*
`;
  text += `📍 *Site Project:* ${proj.name} [${proj.code}]
`;
  text += `📅 *Date:* ${new Date().toLocaleDateString('en-IN')}
`;

  if (type === 'concrete') {
    text += `🧱 *Civil Work:* RCC Roof Slab / Frame Casting (${area} CFT Wet Volume)
`;
    text += `📦 *Material Needed:*
`;
    text += `• UltraTech Cement: *${cement} Bags*
`;
    text += `• River Sand: *${sand} Brass*
`;
    text += `• Stone Chips (20mm): *${stone} Brass*
`;
    text += `• TMT Rebars: *${steel} Tons*
`;
  } else if (type === 'brick') {
    text += `🧱 *Civil Work:* Brickwork Masonry (${area} Sq.Ft Net Area)
`;
    text += `📦 *Material Needed:*
`;
    text += `• First-Class Red Bricks: *${cement.toLocaleString('en-IN')} Pcs*
`;
    text += `• Mortar Cement: *${sand} Bags*
`;
    text += `• Sand: *${stone} Brass*
`;
  } else {
    text += `🧱 *Civil Work:* Wall Plastering (${area} Sq.Ft Surface Area)
`;
    text += `📦 *Material Needed:*
`;
    text += `• Cement: *${cement} Bags*
`;
    text += `• Fine Sand: *${sand} Brass*
`;
  }

  text += `
_Generated via Amitus Infra Civil Estimator_`;

  const waUrl = `https://wa.me/919863177877?text=${encodeURIComponent(text)}`;
  window.open(waUrl, '_blank');
}

// ====================================================
// 2. DAILY LABOR MUSTER ROLL (HAZIRA)
// ====================================================
function renderDailyHazira(container) {
  const currentDate = state.selectedHaziraDate || new Date().toISOString().slice(0, 10);
  const targetSiteId = state.selectedProjectId;

  // Filter attendance for the selected date
  let dayAttendance = (state.attendance || []).filter(a => a.date === currentDate);
  if (targetSiteId !== 'all') {
    dayAttendance = dayAttendance.filter(a => a.projectId === targetSiteId);
  }

  // Active employees for this project (or all)
  let activeWorkers = state.employees;
  if (targetSiteId !== 'all') {
    activeWorkers = activeWorkers.filter(e => e.projectId === targetSiteId);
  }

  // Merge attendance status with worker list
  const workerRows = activeWorkers.map(w => {
    const att = dayAttendance.find(a => a.employeeId === w.id);
    return {
      worker: w,
      status: att ? att.status : 'present',
      factor: att ? att.factor : 1.0,
      overtime: att ? (att.overtimeHours || 0) : 0,
      earned: att ? att.earned : Math.round(Number(w.dailyWage) || 650),
      remarks: att ? att.remarks : ''
    };
  });

  const presentCount = workerRows.filter(r => r.status === 'present').length;
  const halfCount = workerRows.filter(r => r.status === 'half').length;
  const absentCount = workerRows.filter(r => r.status === 'absent').length;
  const totalWageToday = workerRows.reduce((acc, r) => acc + (r.earned || 0), 0);

  container.innerHTML = `
    <div class="content-header-row" style="margin-bottom:1.25rem;">
      <div>
        <h2 style="font-size:1.4rem;font-weight:800;color:var(--text-main);display:flex;align-items:center;gap:0.5rem;">
          📋 Daily Labor Muster Roll (হাজিরা / Hazira)
        </h2>
        <p style="font-size:0.825rem;color:var(--text-muted);margin-top:2px;">
          Track daily worker attendance (Present / Half Day / Absent), calculate daily wage liability, and prepare weekly Saturday settlements.
        </p>
      </div>

      <div style="display:flex;align-items:center;gap:0.5rem;flex-wrap:wrap;">
        <input type="date" id="hazira-date-input" value="${currentDate}" class="form-control form-control-sm" style="width:150px;" onchange="changeHaziraDate(this.value)">
        <button class="btn btn-sm" onclick="setHaziraToday()">📅 Today</button>
        <button class="btn btn-sm btn-outline" onclick="markAllHaziraPresent()">⚡ Mark All Present</button>
        <button class="btn btn-primary btn-sm" onclick="saveHaziraMusterRoll()">💾 Save Muster Roll</button>
      </div>
    </div>

    <!-- Attendance Stats Row -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:0.75rem;margin-bottom:1.25rem;">
      <div class="stat-card">
        <div class="stat-title">Workers On Roll</div>
        <div class="stat-value">${workerRows.length}</div>
        <div class="stat-sub">Active Trade Workforce</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Present (P)</div>
        <div class="stat-value" style="color:var(--success);">${presentCount}</div>
        <div class="stat-sub">Full Day Attendance</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Half Day (HD)</div>
        <div class="stat-value" style="color:var(--primary);">${halfCount}</div>
        <div class="stat-sub">0.5 Day Attendance</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Absent (A)</div>
        <div class="stat-value" style="color:var(--danger);">${absentCount}</div>
        <div class="stat-sub">No Payout Today</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Today's Wage Liability</div>
        <div class="stat-value" style="color:var(--primary);">₹ ${totalWageToday.toLocaleString('en-IN')}</div>
        <div class="stat-sub">${new Date(currentDate).toLocaleDateString('en-IN', {weekday:'short', month:'short', day:'numeric'})}</div>
      </div>
    </div>

    <!-- Interactive Hazira Table -->
    <div class="content-card">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
        <h3 class="card-title">Daily Attendance Sheet — ${new Date(currentDate).toLocaleDateString('en-IN', {weekday:'long', year:'numeric', month:'long', day:'numeric'})}</h3>
        <span class="badge badge-info">${workerRows.length} Workers</span>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Worker / Mistry</th>
              <th>Trade / Role</th>
              <th>Assigned Site</th>
              <th>Daily Wage Rate</th>
              <th style="text-align:center;">Today's Attendance Status</th>
              <th>Overtime (Hrs)</th>
              <th style="text-align:right;">Today's Wage</th>
              <th>Remarks / Work Done</th>
            </tr>
          </thead>
          <tbody>
            ${workerRows.map(r => `
              <tr id="hazira-row-${r.worker.id}">
                <td>
                  <div style="display:flex;align-items:center;gap:0.5rem;">
                    <div style="width:32px;height:32px;border-radius:50%;background:var(--bg-subtle);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;font-weight:700;font-size:0.75rem;color:var(--primary);">
                      ${r.worker.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div>
                      <strong style="color:var(--text-main);font-size:0.875rem;">${r.worker.name}</strong>
                      <div style="font-size:0.7rem;color:var(--text-muted);">${r.worker.phone || 'No Phone'}</div>
                    </div>
                  </div>
                </td>
                <td>
                  <span class="badge" style="background:var(--bg-subtle);color:var(--text-main);border:1px solid var(--border);font-size:0.725rem;">
                    ${r.worker.trade || 'Helper'}
                  </span>
                </td>
                <td style="font-size:0.8rem;color:var(--text-muted);">
                  ${(state.projects.find(p => p.id === r.worker.projectId)?.name || 'Central Depot').slice(0, 20)}...
                </td>
                <td style="font-size:0.85rem;font-weight:700;color:var(--text-main);">
                  ₹ ${Number(r.worker.dailyWage || 650).toLocaleString('en-IN')}
                </td>
                <td style="text-align:center;">
                  <div class="hazira-status-btn-group">
                    <button class="hazira-btn ${r.status === 'present' ? 'active-present' : ''}" onclick="setWorkerHazira('${r.worker.id}', 'present')">
                      🟢 Present
                    </button>
                    <button class="hazira-btn ${r.status === 'half' ? 'active-half' : ''}" onclick="setWorkerHazira('${r.worker.id}', 'half')">
                      🟡 Half
                    </button>
                    <button class="hazira-btn ${r.status === 'absent' ? 'active-absent' : ''}" onclick="setWorkerHazira('${r.worker.id}', 'absent')">
                      🔴 Absent
                    </button>
                  </div>
                </td>
                <td>
                  <input type="number" id="hazira-ot-${r.worker.id}" class="form-control form-control-sm" style="width:70px;" value="${r.overtime}" min="0" max="8" oninput="recomputeWorkerWage('${r.worker.id}')">
                </td>
                <td style="text-align:right;">
                  <strong id="hazira-earned-${r.worker.id}" style="font-size:0.9rem;color:var(--primary);">
                    ₹ ${r.earned.toLocaleString('en-IN')}
                  </strong>
                </td>
                <td>
                  <input type="text" id="hazira-rem-${r.worker.id}" class="form-control form-control-sm" placeholder="Work done..." value="${r.remarks || ''}">
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

function changeHaziraDate(date) {
  state.selectedHaziraDate = date;
  renderActiveTab();
}

function setHaziraToday() {
  state.selectedHaziraDate = new Date().toISOString().slice(0, 10);
  renderActiveTab();
}

function setWorkerHazira(empId, status) {
  const row = document.getElementById(`hazira-row-${empId}`);
  if (!row) return;

  const btns = row.querySelectorAll('.hazira-btn');
  btns[0].classList.toggle('active-present', status === 'present');
  btns[1].classList.toggle('active-half', status === 'half');
  btns[2].classList.toggle('active-absent', status === 'absent');

  recomputeWorkerWage(empId);
}

function recomputeWorkerWage(empId) {
  const row = document.getElementById(`hazira-row-${empId}`);
  if (!row) return;

  const emp = state.employees.find(e => e.id === empId);
  if (!emp) return;

  const isPresent = row.querySelector('.hazira-btn:nth-child(1)').classList.contains('active-present');
  const isHalf = row.querySelector('.hazira-btn:nth-child(2)').classList.contains('active-half');

  const factor = isPresent ? 1.0 : (isHalf ? 0.5 : 0.0);
  const otInput = document.getElementById(`hazira-ot-${empId}`);
  const ot = parseFloat(otInput?.value) || 0;
  const rate = Number(emp.dailyWage) || 650;
  const otRate = (rate / 8) * 1.5;

  const earned = Math.round((rate * factor) + (ot * otRate));
  const earnedElem = document.getElementById(`hazira-earned-${empId}`);
  if (earnedElem) earnedElem.textContent = `₹ ${earned.toLocaleString('en-IN')}`;
}

function markAllHaziraPresent() {
  state.employees.forEach(e => setWorkerHazira(e.id, 'present'));
  showToast('Marked all active workers as Present for today', 'info');
}

async function saveHaziraMusterRoll() {
  const date = state.selectedHaziraDate || new Date().toISOString().slice(0, 10);
  const records = [];

  state.employees.forEach(emp => {
    const row = document.getElementById(`hazira-row-${emp.id}`);
    if (!row) return;

    const isPresent = row.querySelector('.hazira-btn:nth-child(1)').classList.contains('active-present');
    const isHalf = row.querySelector('.hazira-btn:nth-child(2)').classList.contains('active-half');
    const status = isPresent ? 'present' : (isHalf ? 'half' : 'absent');

    const ot = parseFloat(document.getElementById(`hazira-ot-${emp.id}`)?.value) || 0;
    const rem = document.getElementById(`hazira-rem-${emp.id}`)?.value.trim() || '';

    records.push({
      employeeId: emp.id,
      projectId: emp.projectId,
      status,
      overtimeHours: ot,
      remarks: rem
    });
  });

  try {
    const res = await fetch('/api/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date, records })
    });
    if (!res.ok) throw new Error('Failed to save muster roll');
    const data = await res.json();
    showToast(data.message || 'Muster roll saved successfully!', 'success');
    loadData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ====================================================
// 3. FLAT BOOKING & SALES MILESTONE TRACKER
// ====================================================
function renderFlatBooking(container) {
  const targetSiteId = state.selectedProjectId;
  let flats = state.flats || [];
  if (targetSiteId !== 'all') {
    flats = flats.filter(f => f.projectId === targetSiteId);
  }

  const totalFlats = flats.length;
  const bookedFlats = flats.filter(f => f.status === 'booked' || f.status === 'handed_over').length;
  const availableFlats = flats.filter(f => f.status === 'available').length;

  let totalSalesValue = 0;
  let totalCollected = 0;
  flats.forEach(f => {
    if (f.buyer) {
      totalSalesValue += (f.buyer.agreedPrice || f.basePrice);
      (f.milestones || []).forEach(m => {
        if (m.status === 'paid') totalCollected += (m.amount || 0);
      });
    }
  });

  const totalOutstanding = Math.max(0, totalSalesValue - totalCollected);

  // Group flats by floor
  const floorGroups = {};
  flats.forEach(f => {
    const flr = f.floor || '1st Floor';
    if (!floorGroups[flr]) floorGroups[flr] = [];
    floorGroups[flr].push(f);
  });

  container.innerHTML = `
    <div class="content-header-row" style="margin-bottom:1.25rem;">
      <div>
        <h2 style="font-size:1.4rem;font-weight:800;color:var(--text-main);display:flex;align-items:center;gap:0.5rem;">
          🏢 Flat Booking & Construction-Linked Milestone Tracker
        </h2>
        <p style="font-size:0.825rem;color:var(--text-muted);margin-top:2px;">
          Manage the 12 flats in Amitus G+4 Shibnagar & Damini Residency, register client buyers, and track stage-wise milestone payments.
        </p>
      </div>
    </div>

    <!-- Flat Sales Metrics -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(170px, 1fr));gap:0.75rem;margin-bottom:1.25rem;">
      <div class="stat-card">
        <div class="stat-title">Total Units</div>
        <div class="stat-value">${totalFlats}</div>
        <div class="stat-sub">Across Residential Sites</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Booked / Sold</div>
        <div class="stat-value" style="color:var(--primary);">${bookedFlats}</div>
        <div class="stat-sub">${totalFlats > 0 ? ((bookedFlats/totalFlats)*100).toFixed(0) : 0}% Occupancy</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Available for Sale</div>
        <div class="stat-value" style="color:var(--success);">${availableFlats}</div>
        <div class="stat-sub">Ready for Booking</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Total Sales Booked</div>
        <div class="stat-value">₹ ${(totalSalesValue/100000).toFixed(1)} L</div>
        <div class="stat-sub">Agreed Contract Value</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Collections Received</div>
        <div class="stat-value" style="color:var(--success);">₹ ${(totalCollected/100000).toFixed(1)} L</div>
        <div class="stat-sub">Milestones Cleared</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Outstanding Receivables</div>
        <div class="stat-value" style="color:var(--danger);">₹ ${(totalOutstanding/100000).toFixed(1)} L</div>
        <div class="stat-sub">Remaining Balance</div>
      </div>
    </div>

    <!-- Floor-by-Floor Unit Matrix Grid -->
    ${Object.keys(floorGroups).map(floorName => `
      <div class="flat-floor-section">
        <div class="flat-floor-header">
          <span>🏢 ${floorName}</span>
          <span style="font-size:0.775rem;color:var(--text-muted);">${floorGroups[floorName].length} Flats</span>
        </div>

        <div class="flat-matrix-grid">
          ${floorGroups[floorName].map(f => {
            const isBooked = f.status === 'booked' || f.status === 'handed_over';
            let collectedPct = 0;
            if (isBooked && f.buyer) {
              const paidSum = (f.milestones || []).filter(m => m.status === 'paid').reduce((a, m) => a + m.amount, 0);
              collectedPct = Math.round((paidSum / f.buyer.agreedPrice) * 100);
            }

            return `
              <div class="flat-card status-${f.status}">
                <div>
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.5rem;">
                    <div>
                      <strong style="font-size:1.15rem;color:var(--text-main);">Flat ${f.flatNumber}</strong>
                      <span style="font-size:0.775rem;color:var(--text-muted);margin-left:0.35rem;">(${f.bhk})</span>
                    </div>
                    <span class="badge ${f.status === 'available' ? 'badge-success' : (f.status === 'booked' ? 'badge-warning' : 'badge-info')}">
                      ${f.status === 'available' ? '🟢 Available' : (f.status === 'booked' ? '🟡 Booked' : '🔵 Handed Over')}
                    </span>
                  </div>

                  <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:0.75rem;">
                    📐 <strong>${f.areaSqFt} sq.ft</strong> • Facing: <strong>${f.facing || 'East'}</strong>
                  </div>

                  ${isBooked && f.buyer ? `
                    <div style="background:var(--bg-card);padding:0.6rem 0.75rem;border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:0.75rem;font-size:0.775rem;">
                      <div style="display:flex;justify-content:space-between;margin-bottom:0.25rem;">
                        <span style="color:var(--text-muted);">Buyer:</span>
                        <strong style="color:var(--text-main);">${f.buyer.name}</strong>
                      </div>
                      <div style="display:flex;justify-content:space-between;margin-bottom:0.35rem;">
                        <span style="color:var(--text-muted);">Agreed:</span>
                        <strong style="color:var(--primary);">₹ ${(f.buyer.agreedPrice/100000).toFixed(2)} Lakhs</strong>
                      </div>
                      <div style="width:100%;height:6px;background:var(--border);border-radius:3px;overflow:hidden;">
                        <div style="width:${collectedPct}%;height:100%;background:var(--success);"></div>
                      </div>
                      <div style="text-align:right;font-size:0.7rem;color:var(--text-muted);margin-top:2px;">
                        ${collectedPct}% Paid
                      </div>
                    </div>
                  ` : `
                    <div style="font-size:1.1rem;font-weight:800;color:var(--primary);margin-bottom:0.75rem;">
                      ₹ ${(f.basePrice/100000).toFixed(2)} Lakhs
                    </div>
                  `}
                </div>

                <div style="display:flex;gap:0.4rem;">
                  ${!isBooked ? `
                    <button class="btn btn-primary btn-sm" style="flex:1;" onclick="openBookFlatModal('${f.id}')">
                      ➕ Book Flat Unit
                    </button>
                  ` : `
                    <button class="btn btn-secondary btn-sm" style="flex:1;" onclick="showFlatDetailsModal('${f.id}')">
                      📋 Milestone Ledger & Receipt
                    </button>
                  `}
                </div>
              </div>
            `;
          }).join('')}
        </div>
      </div>
    `).join('')}
  `;
}

function openBookFlatModal(flatId) {
  const flat = (state.flats || []).find(f => f.id === flatId);
  if (!flat) return;

  document.getElementById('book-flat-id').value = flat.id;
  document.getElementById('book-flat-number-display').textContent = `Flat ${flat.flatNumber}`;
  document.getElementById('book-flat-type-display').textContent = `(${flat.bhk} • ${flat.areaSqFt} sq.ft)`;
  document.getElementById('book-flat-price-display').textContent = `₹ ${(flat.basePrice).toLocaleString('en-IN')}`;
  document.getElementById('book-agreed-price').value = flat.basePrice;
  document.getElementById('book-date').value = new Date().toISOString().slice(0, 10);

  openModal('modal-book-flat');
}

async function submitBookFlat(e) {
  e.preventDefault();
  const flatId = document.getElementById('book-flat-id').value;
  const buyerName = document.getElementById('book-buyer-name').value.trim();
  const buyerPhone = document.getElementById('book-buyer-phone').value.trim();
  const buyerEmail = document.getElementById('book-buyer-email').value.trim();
  const agreedPrice = parseFloat(document.getElementById('book-agreed-price').value) || 0;
  const advancePaid = parseFloat(document.getElementById('book-advance-paid').value) || 0;
  const bookingDate = document.getElementById('book-date').value || new Date().toISOString().slice(0, 10);

  try {
    const res = await fetch(`/api/flats/${flatId}/book`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ buyerName, buyerPhone, buyerEmail, agreedPrice, advancePaid, bookingDate })
    });
    if (!res.ok) throw new Error('Failed to book flat');
    const data = await res.json();
    closeModal('modal-book-flat');
    showToast(data.message || 'Flat booked successfully!', 'success');
    loadData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function showFlatDetailsModal(flatId) {
  const flat = (state.flats || []).find(f => f.id === flatId);
  if (!flat || !flat.buyer) return;

  const content = document.getElementById('flat-details-content');
  if (!content) return;

  let paidTotal = 0;
  (flat.milestones || []).forEach(m => {
    if (m.status === 'paid') paidTotal += m.amount;
  });
  const balanceTotal = Math.max(0, flat.buyer.agreedPrice - paidTotal);
  const paidPct = Math.round((paidTotal / flat.buyer.agreedPrice) * 100);

  content.innerHTML = `
    <div style="background:var(--bg-subtle);padding:1rem 1.25rem;border-radius:var(--radius-sm);border:1px solid var(--border);margin-bottom:1.25rem;">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;flex-wrap:wrap;gap:0.75rem;">
        <div>
          <div style="display:flex;align-items:center;gap:0.5rem;">
            <h3 style="font-size:1.35rem;font-weight:800;color:var(--text-main);">Flat ${flat.flatNumber}</h3>
            <span class="badge badge-warning">${flat.bhk} • ${flat.areaSqFt} sq.ft</span>
          </div>
          <div style="font-size:0.825rem;color:var(--text-muted);margin-top:2px;">
            Buyer: <strong style="color:var(--text-main);">${flat.buyer.name}</strong> • 📞 ${flat.buyer.phone}
          </div>
        </div>

        <div style="display:flex;gap:0.4rem;">
          <a href="tel:${flat.buyer.phone}" class="btn btn-sm btn-outline">📞 Call Buyer</a>
          <a href="https://wa.me/91${flat.buyer.phone.replace(/\D/g, '')}?text=Hi%20${encodeURIComponent(flat.buyer.name)},%20update%20regarding%20your%20Amitus%20Infra%20Flat%20${flat.flatNumber}" target="_blank" class="btn btn-sm btn-secondary">
            💬 WhatsApp
          </a>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(140px, 1fr));gap:0.75rem;margin-top:1rem;padding-top:1rem;border-top:1px solid var(--border);">
        <div>
          <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;">Agreed Total Price</div>
          <div style="font-size:1.1rem;font-weight:800;color:var(--text-main);">₹ ${flat.buyer.agreedPrice.toLocaleString('en-IN')}</div>
        </div>
        <div>
          <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;">Paid to Date</div>
          <div style="font-size:1.1rem;font-weight:800;color:var(--success);">₹ ${paidTotal.toLocaleString('en-IN')}</div>
        </div>
        <div>
          <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;">Remaining Balance</div>
          <div style="font-size:1.1rem;font-weight:800;color:var(--danger);">₹ ${balanceTotal.toLocaleString('en-IN')}</div>
        </div>
      </div>
    </div>

    <!-- Construction-Linked Milestone Stages Checklist -->
    <h4 style="font-size:0.95rem;font-weight:800;color:var(--text-main);margin-bottom:0.75rem;">
      Construction-Linked Payment Schedule
    </h4>

    <div class="milestones-list">
      ${(flat.milestones || []).map(m => `
        <div class="milestone-item ${m.status}">
          <div>
            <div style="font-weight:700;color:var(--text-main);font-size:0.875rem;">${m.stage}</div>
            <div style="font-size:0.75rem;color:var(--text-muted);margin-top:2px;">
              ${m.status === 'paid' ? 'Paid on ' + m.paidDate + ' • Ref: ' + (m.ref || 'Bank') : (m.status === 'invoiced' ? '⚠️ Invoiced — Due Date: ' + (m.dueDate || 'Immediate') : 'Scheduled')}
            </div>
          </div>

          <div style="display:flex;align-items:center;gap:0.75rem;">
            <strong style="font-size:0.95rem;color:var(--text-main);">₹ ${m.amount.toLocaleString('en-IN')}</strong>
            ${m.status !== 'paid' ? `
              <button class="btn btn-xs btn-primary" onclick="markMilestonePaid('${flat.id}', '${m.id}')">
                ✅ Mark Paid
              </button>
            ` : `
              <span class="badge badge-success">✓ Cleared</span>
            `}
          </div>
        </div>
      `).join('')}
    </div>

    <div style="margin-top:1.25rem;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:0.5rem;">
      <button class="btn btn-sm btn-outline" onclick="window.print()">
        🖨️ Print Flat Allotment & Payment Voucher
      </button>
      <button class="btn btn-sm btn-primary" onclick="sendMilestoneDemandWhatsApp('${flat.id}')">
        📲 Send Milestone Demand Notice on WhatsApp ↗
      </button>
    </div>
  `;

  openModal('modal-flat-details');
}

async function markMilestonePaid(flatId, milestoneId) {
  const ref = prompt('Enter Bank / Cheque / IMPS Reference for this payment:', 'Bank Transfer / IMPS');
  if (ref === null) return;

  try {
    const res = await fetch(`/api/flats/${flatId}/milestone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ milestoneId, status: 'paid', paidDate: new Date().toISOString().slice(0, 10), ref })
    });
    if (!res.ok) throw new Error('Failed to update milestone');
    showToast('Payment milestone updated!', 'success');
    closeModal('modal-flat-details');
    loadData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function sendMilestoneDemandWhatsApp(flatId) {
  const flat = (state.flats || []).find(f => f.id === flatId);
  if (!flat || !flat.buyer) return;

  const pendingMilestone = (flat.milestones || []).find(m => m.status !== 'paid') || flat.milestones[0];

  let text = `🏢 *AMITUS INFRA — PAYMENT DEMAND NOTICE*
`;
  text += `👤 *Dear ${flat.buyer.name},*
`;
  text += `This is regarding your booking for *Flat ${flat.flatNumber} (${flat.bhk})* at Amitus G+4 Shibnagar, Agartala.

`;
  text += `📋 *Current Milestone Due:* ${pendingMilestone.stage}
`;
  text += `💰 *Amount Payable:* ₹ ${pendingMilestone.amount.toLocaleString('en-IN')}
`;
  text += `🏦 *Bank Account Details:* Amitus Infra, Agartala

`;
  text += `Kindly transfer via NEFT/Cheque and share the receipt reference.
`;
  text += `📞 *Managing Director Santanu Bhaumik:* 098631 77877`;

  const waUrl = `https://wa.me/91${flat.buyer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(text)}`;
  window.open(waUrl, '_blank');
}

// ====================================================
// 4. SUPPLIER / VENDOR KHATA & BILL TRACKER
// ====================================================
function renderSupplierKhata(container) {
  const suppliers = state.suppliers || [];
  const bills = state.vendorBills || [];

  const totalPurchases = bills.reduce((acc, b) => acc + (b.totalAmount || 0), 0);
  const totalPaid = bills.reduce((acc, b) => acc + (b.paidAmount || 0), 0);
  const totalBalance = Math.max(0, totalPurchases - totalPaid);

  container.innerHTML = `
    <div class="content-header-row" style="margin-bottom:1.25rem;">
      <div>
        <h2 style="font-size:1.4rem;font-weight:800;color:var(--text-main);display:flex;align-items:center;gap:0.5rem;">
          🚚 Supplier Khata & Outstanding Material Bills (দোকান বকেয়া খাতা)
        </h2>
        <p style="font-size:0.825rem;color:var(--text-muted);margin-top:2px;">
          Track credit purchases with local Agartala hardware suppliers, brick kilns, steel depots & stone quarries.
        </p>
      </div>

      <div style="display:flex;align-items:center;gap:0.5rem;">
        <button class="btn btn-sm btn-outline" onclick="openModal('modal-add-supplier')">
          ➕ New Supplier
        </button>
        <button class="btn btn-primary btn-sm" onclick="openModal('modal-add-vendor-bill')">
          📑 Log Material Bill
        </button>
      </div>
    </div>

    <!-- Khata Metrics -->
    <div style="display:grid;grid-template-columns:repeat(auto-fit, minmax(180px, 1fr));gap:0.75rem;margin-bottom:1.5rem;">
      <div class="stat-card">
        <div class="stat-title">Total Material Bills</div>
        <div class="stat-value">₹ ${(totalPurchases/100000).toFixed(2)} L</div>
        <div class="stat-sub">${bills.length} Invoices Recorded</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Total Payments Settled</div>
        <div class="stat-value" style="color:var(--success);">₹ ${(totalPaid/100000).toFixed(2)} L</div>
        <div class="stat-sub">Cheque / NEFT Cleared</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Total Outstanding Dues</div>
        <div class="stat-value" style="color:var(--danger);">₹ ${(totalBalance/100000).toFixed(2)} L</div>
        <div class="stat-sub">Dues Payable to Vendors</div>
      </div>
      <div class="stat-card">
        <div class="stat-title">Active Suppliers</div>
        <div class="stat-value">${suppliers.length}</div>
        <div class="stat-sub">Steel, Cement, Bricks & Sand</div>
      </div>
    </div>

    <!-- Suppliers Grid -->
    <h3 style="font-size:1.05rem;font-weight:800;color:var(--text-main);margin-bottom:0.75rem;">
      Material Suppliers & Vendor Accounts
    </h3>

    <div class="khata-grid">
      ${suppliers.map(s => {
        const sBills = bills.filter(b => b.supplierId === s.id);
        const sBilled = sBills.reduce((acc, b) => acc + (b.totalAmount || 0), 0);
        const sPaid = sBills.reduce((acc, b) => acc + (b.paidAmount || 0), 0);
        const sBal = Math.max(0, sBilled - sPaid);

        return `
          <div class="khata-vendor-card">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.4rem;">
                <span class="badge" style="background:var(--bg-subtle);color:var(--primary);border:1px solid var(--border-focus);font-size:0.7rem;">
                  ${s.category}
                </span>
                <span class="khata-balance-pill ${sBal > 0 ? 'due' : 'clear'}">
                  ${sBal > 0 ? '⚠️ Due: ₹ ' + sBal.toLocaleString('en-IN') : '✓ All Clear'}
                </span>
              </div>

              <h4 style="font-size:1.05rem;font-weight:800;color:var(--text-main);margin-bottom:0.25rem;">
                ${s.name}
              </h4>
              <div style="font-size:0.775rem;color:var(--text-muted);margin-bottom:0.75rem;">
                👤 ${s.contactPerson || 'Proprietor'} • 📞 ${s.phone}<br>
                📍 ${s.address}
              </div>
            </div>

            <div style="display:flex;gap:0.4rem;padding-top:0.75rem;border-top:1px solid var(--border);">
              <a href="tel:${s.phone}" class="btn btn-xs btn-outline" style="flex:1;text-align:center;">📞 Call</a>
              <a href="https://wa.me/91${s.phone.replace(/\D/g, '')}?text=Hi%20${encodeURIComponent(s.name)},%20Amitus%20Infra%20account%20statement" target="_blank" class="btn btn-xs btn-secondary" style="flex:1;text-align:center;">
                💬 WhatsApp
              </a>
              <button class="btn btn-xs btn-primary" onclick="openPayVendorBillModalForSupplier('${s.id}')">
                💵 Pay Bill
              </button>
            </div>
          </div>
        `;
      }).join('')}
    </div>

    <!-- Recent Bills Table -->
    <div class="content-card" style="margin-top:1.5rem;">
      <div class="card-header" style="display:flex;justify-content:space-between;align-items:center;">
        <h3 class="card-title">Recent Inward Material Invoices & Challans</h3>
        <span class="badge badge-info">${bills.length} Invoices</span>
      </div>

      <div class="table-wrap">
        <table class="data-table">
          <thead>
            <tr>
              <th>Invoice #</th>
              <th>Supplier / Agency</th>
              <th>Project Site</th>
              <th>Bill Date</th>
              <th>Materials Supplied</th>
              <th style="text-align:right;">Total Bill</th>
              <th style="text-align:right;">Paid</th>
              <th style="text-align:right;">Balance</th>
              <th style="text-align:center;">Status</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>
            ${bills.map(b => `
              <tr>
                <td><strong>${b.invoiceNumber}</strong></td>
                <td>${b.supplierName}</td>
                <td>${(state.projects.find(p => p.id === b.projectId)?.name || 'Central Depot').slice(0, 18)}...</td>
                <td style="font-size:0.8rem;">${b.billDate}</td>
                <td style="font-size:0.8rem;color:var(--text-muted);">${b.itemsDescription}</td>
                <td style="text-align:right;font-weight:700;">₹ ${b.totalAmount.toLocaleString('en-IN')}</td>
                <td style="text-align:right;color:var(--success);">₹ ${b.paidAmount.toLocaleString('en-IN')}</td>
                <td style="text-align:right;font-weight:800;color:${b.balanceAmount > 0 ? 'var(--danger)' : 'var(--text-muted)'};">
                  ₹ ${b.balanceAmount.toLocaleString('en-IN')}
                </td>
                <td style="text-align:center;">
                  <span class="badge ${b.status === 'paid' ? 'badge-success' : (b.status === 'partial' ? 'badge-warning' : 'badge-danger')}">
                    ${b.status === 'paid' ? 'Paid' : (b.status === 'partial' ? 'Partial' : 'Unpaid')}
                  </span>
                </td>
                <td>
                  ${b.balanceAmount > 0 ? `
                    <button class="btn btn-xs btn-primary" onclick="openPayVendorBillModal('${b.id}')">
                      Pay Bill
                    </button>
                  ` : `
                    <span style="font-size:0.75rem;color:var(--success);">✓ Cleared</span>
                  `}
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

async function submitAddSupplier(e) {
  e.preventDefault();
  const name = document.getElementById('sup-name').value.trim();
  const category = document.getElementById('sup-category').value;
  const contactPerson = document.getElementById('sup-contact').value.trim();
  const phone = document.getElementById('sup-phone').value.trim();
  const gstin = document.getElementById('sup-gstin').value.trim();
  const address = document.getElementById('sup-address').value.trim();

  try {
    const res = await fetch('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, category, contactPerson, phone, gstin, address })
    });
    if (!res.ok) throw new Error('Failed to add supplier');
    closeModal('modal-add-supplier');
    showToast('New supplier registered!', 'success');
    loadData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function submitAddVendorBill(e) {
  e.preventDefault();
  const supplierId = document.getElementById('bill-supplier-id').value;
  const projectId = document.getElementById('bill-project-id').value;
  const invoiceNumber = document.getElementById('bill-inv-num').value.trim();
  const billDate = document.getElementById('bill-date').value || new Date().toISOString().slice(0, 10);
  const dueDate = document.getElementById('bill-due-date').value;
  const itemsDescription = document.getElementById('bill-desc').value.trim();
  const totalAmount = parseFloat(document.getElementById('bill-total-amt').value) || 0;
  const paidAmount = parseFloat(document.getElementById('bill-paid-amt').value) || 0;
  const paymentMode = document.getElementById('bill-pay-mode').value;
  const paymentRef = document.getElementById('bill-pay-ref').value.trim();

  try {
    const res = await fetch('/api/vendor-bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplierId, projectId, invoiceNumber, billDate, dueDate, itemsDescription, totalAmount, paidAmount, paymentMode, paymentRef })
    });
    if (!res.ok) throw new Error('Failed to record bill');
    closeModal('modal-add-vendor-bill');
    showToast('Material bill saved to Khata!', 'success');
    loadData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

function openPayVendorBillModal(billId) {
  const bill = (state.vendorBills || []).find(b => b.id === billId);
  if (!bill) return;

  document.getElementById('pay-bill-id').value = bill.id;
  document.getElementById('pay-supplier-name').textContent = bill.supplierName;
  document.getElementById('pay-bill-inv').textContent = `Invoice: ${bill.invoiceNumber} • Total: ₹ ${bill.totalAmount.toLocaleString('en-IN')}`;
  document.getElementById('pay-bill-balance').textContent = `₹ ${bill.balanceAmount.toLocaleString('en-IN')}`;
  document.getElementById('pay-bill-amount').value = bill.balanceAmount;
  document.getElementById('pay-bill-date').value = new Date().toISOString().slice(0, 10);

  openModal('modal-pay-vendor-bill');
}

function openPayVendorBillModalForSupplier(supplierId) {
  const sBill = (state.vendorBills || []).find(b => b.supplierId === supplierId && b.balanceAmount > 0);
  if (sBill) {
    openPayVendorBillModal(sBill.id);
  } else {
    showToast('No outstanding unpaid bills found for this supplier.', 'info');
  }
}

async function submitPayVendorBill(e) {
  e.preventDefault();
  const billId = document.getElementById('pay-bill-id').value;
  const amount = parseFloat(document.getElementById('pay-bill-amount').value) || 0;
  const date = document.getElementById('pay-bill-date').value || new Date().toISOString().slice(0, 10);
  const mode = document.getElementById('pay-bill-mode').value;
  const ref = document.getElementById('pay-bill-ref').value.trim();

  try {
    const res = await fetch(`/api/vendor-bills/${billId}/pay`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount, date, mode, ref })
    });
    if (!res.ok) throw new Error('Failed to record payment');
    const data = await res.json();
    closeModal('modal-pay-vendor-bill');
    showToast(data.message || 'Payment recorded successfully!', 'success');
    loadData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ====================================================
// 5. LIVE SITE PHOTO PROGRESS GALLERY
// ====================================================
function renderSitePhotos(container) {
  const targetSiteId = state.selectedProjectId;
  let photos = state.sitePhotos || [];
  if (targetSiteId !== 'all') {
    photos = photos.filter(p => p.projectId === targetSiteId);
  }

  container.innerHTML = `
    <div class="content-header-row" style="margin-bottom:1.25rem;">
      <div>
        <h2 style="font-size:1.4rem;font-weight:800;color:var(--text-main);display:flex;align-items:center;gap:0.5rem;">
          📸 Live Construction Site Progress Gallery
        </h2>
        <p style="font-size:0.825rem;color:var(--text-muted);margin-top:2px;">
          Document construction milestones, slab casting, shuttering, brickwork and finishing with photos tagged by site and phase.
        </p>
      </div>

      <button class="btn btn-primary btn-sm" onclick="openModal('modal-add-site-photo')">
        ➕ Upload Site Photo
      </button>
    </div>

    <div class="photo-gallery-grid">
      ${photos.map(p => `
        <div class="photo-card">
          <div class="photo-img-wrap">
            <img src="${p.imageUrl || 'logo.jpg'}" alt="${p.title}">
            <div class="photo-phase-tag">${p.phase}</div>
          </div>
          <div style="padding:1rem;display:flex;flex-direction:column;justify-content:space-between;flex:1;">
            <div>
              <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:0.25rem;">
                <span style="font-size:0.75rem;color:var(--primary);font-weight:700;">${p.projectName}</span>
                <span style="font-size:0.7rem;color:var(--text-muted);">${p.date}</span>
              </div>
              <h4 style="font-size:0.95rem;font-weight:800;color:var(--text-main);line-height:1.4;margin-bottom:0.4rem;">
                ${p.title}
              </h4>
              <p style="font-size:0.775rem;color:var(--text-muted);line-height:1.4;">
                ${p.caption || 'Structural civil inspection cleared.'}
              </p>
            </div>

            <div style="margin-top:0.85rem;padding-top:0.6rem;border-top:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;">
              <span class="badge" style="background:var(--bg-subtle);font-size:0.65rem;color:var(--text-muted);">
                ${p.showcaseOnHome ? '🌟 Showcase on Home' : 'Site Internal'}
              </span>
              <button class="btn btn-xs" style="color:var(--danger);" onclick="deleteSitePhoto('${p.id}')">
                🗑️
              </button>
            </div>
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

async function submitAddSitePhoto(e) {
  e.preventDefault();
  const projectId = document.getElementById('photo-project-id').value;
  const phase = document.getElementById('photo-phase').value;
  const title = document.getElementById('photo-title').value.trim();
  const date = document.getElementById('photo-date').value || new Date().toISOString().slice(0, 10);
  const imageUrl = document.getElementById('photo-image-url').value.trim() || 'logo.jpg';
  const caption = document.getElementById('photo-caption').value.trim();
  const showcaseOnHome = document.getElementById('photo-showcase-home').checked;

  try {
    const res = await fetch('/api/site-photos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ projectId, phase, title, date, imageUrl, caption, showcaseOnHome })
    });
    if (!res.ok) throw new Error('Failed to save photo');
    closeModal('modal-add-site-photo');
    showToast('Photo added to progress gallery!', 'success');
    loadData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function deleteSitePhoto(photoId) {
  if (!confirm('Are you sure you want to remove this photo?')) return;
  try {
    const res = await fetch(`/api/site-photos/${photoId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete photo');
    showToast('Photo removed', 'info');
    loadData();
  } catch (err) {
    showToast(err.message, 'error');
  }
}

// ====================================================
// DIRECTOR & OWNER AUTHENTICATION SYSTEM
// ====================================================
function updateAuthHeaderUi() {
  const loginBtn = document.getElementById('header-login-btn');
  const userBadge = document.getElementById('header-user-badge');
  const navTabs = document.getElementById('main-nav-tabs');
  const opsActions = document.getElementById('header-ops-actions');
  const siteSelector = document.getElementById('header-site-selector');

  const isAuth = !!(state.auth && state.auth.isAuthenticated);

  if (isAuth) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (userBadge) userBadge.style.display = 'inline-flex';
    if (navTabs) navTabs.style.display = 'flex';
    if (opsActions) opsActions.style.display = 'inline-flex';
    if (siteSelector) siteSelector.style.display = 'flex';
  } else {
    if (loginBtn) loginBtn.style.display = 'inline-flex';
    if (userBadge) userBadge.style.display = 'none';
    if (navTabs) navTabs.style.display = 'none';
    if (opsActions) opsActions.style.display = 'none';
    if (siteSelector) siteSelector.style.display = 'none';
  }
}

function openDirectorLoginModal() {
  const passInput = document.getElementById('login-password');
  if (passInput) passInput.value = '';
  openModal('modal-director-login');
  setTimeout(() => {
    if (passInput) passInput.focus();
  }, 200);
}

function toggleLoginPasswordVisibility() {
  const passInput = document.getElementById('login-password');
  if (!passInput) return;
  passInput.type = passInput.type === 'password' ? 'text' : 'password';
}

async function submitDirectorLogin(e) {
  e.preventDefault();
  const username = document.getElementById('login-username')?.value.trim() || 'amitus';
  const password = document.getElementById('login-password')?.value.trim() || '';
  const remember = document.getElementById('login-remember-me')?.checked;

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      throw new Error(data.error || 'Invalid credentials');
    }

    state.auth.isAuthenticated = true;
    state.auth.token = data.token;
    state.auth.user = data.user || 'Santanu Bhaumik';
    state.auth.mode = data.mode || 'hybrid';

    if (remember) {
      localStorage.setItem('amitus_auth_token', data.token);
      localStorage.setItem('amitus_auth_user', state.auth.user);
    } else {
      sessionStorage.setItem('amitus_auth_token', data.token);
    }

    closeModal('modal-director-login');
    updateAuthHeaderUi();
    showToast(`Welcome, Director ${state.auth.user}! Portal unlocked.`, 'success');

    // Reload full data with token
    await loadData();

    // If user clicked an operational tab prior to login, switch to it!
    if (state.pendingTargetTab) {
      const target = state.pendingTargetTab;
      state.pendingTargetTab = null;
      switchTab(target);
    }
  } catch (err) {
    showToast(err.message, 'error');
  }
}

async function directorLogout() {
  try {
    if (state.auth && state.auth.token) {
      fetch('/api/auth/logout', {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + state.auth.token }
      }).catch(() => {});
    }
  } catch(e) {}

  state.auth.isAuthenticated = false;
  state.auth.token = null;
  state.auth.user = null;
  localStorage.removeItem('amitus_auth_token');
  localStorage.removeItem('amitus_auth_user');
  sessionStorage.removeItem('amitus_auth_token');

  updateAuthHeaderUi();
  switchTab('home');
  showToast('Logged out. Director portal locked.', 'info');
  loadData();
}

async function submitChangeCredentials(e) {
  e.preventDefault();
  const username = document.getElementById('cred-username')?.value.trim();
  const password = document.getElementById('cred-password')?.value.trim();
  const pin = document.getElementById('cred-pin')?.value.trim();
  const mode = document.getElementById('cred-mode')?.value;

  try {
    const res = await fetch('/api/auth/update-credentials', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + (state.auth?.token || '')
      },
      body: JSON.stringify({ username, password, pin, mode })
    });

    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to update credentials');

    closeModal('modal-change-credentials');
    showToast(data.message || 'Credentials updated successfully!', 'success');
  } catch (err) {
    showToast(err.message, 'error');
  }
}
