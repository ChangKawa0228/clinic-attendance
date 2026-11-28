/**
 * Clinic Flow - Attendance & Point Management System
 * Core Application Logic
 */

document.addEventListener('DOMContentLoaded', () => {
    // Escape HTML to prevent XSS
    function escapeHTML(str) {
        if (!str) return '';
        return str
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }

    // ==========================================================================
    // State Management & LocalStorage
    // ==========================================================================
    
    // Default initial data for testing/demo
    const DEFAULT_STAFFS = [
        { id: 'st-1', name: '河合 茂明', status: 'offline', avatarColor: 'hsl(210, 80%, 45%)' },
        { id: 'st-2', name: '河合 朋子', status: 'offline', avatarColor: 'hsl(150, 80%, 38%)' },
        { id: 'st-3', name: 'マックアリース 温子', status: 'offline', avatarColor: 'hsl(350, 80%, 50%)' },
        { id: 'st-4', name: '千葉 幸夫', status: 'offline', avatarColor: 'hsl(280, 70%, 50%)' },
        { id: 'st-5', name: '尾崎 昭太', status: 'offline', avatarColor: 'hsl(20, 80%, 50%)' },
        { id: 'st-6', name: '木村 哲子', status: 'offline', avatarColor: 'hsl(60, 70%, 40%)' },
        { id: 'st-7', name: '末廣 綾乃', status: 'offline', avatarColor: 'hsl(100, 70%, 45%)' },
        { id: 'st-8', name: '北口 愛美', status: 'offline', avatarColor: 'hsl(180, 75%, 40%)' },
        { id: 'st-9', name: '寺西 真名美', status: 'offline', avatarColor: 'hsl(230, 80%, 55%)' },
        { id: 'st-10', name: '植西 順子', status: 'offline', avatarColor: 'hsl(300, 70%, 45%)' },
        { id: 'st-chihara', name: '千原 由佳菜', status: 'offline', avatarColor: 'hsl(15, 80%, 50%)' },
        { id: 'st-help-ns1', name: 'HELP Ns. 1', status: 'offline', avatarColor: 'hsl(175, 75%, 40%)' },
        { id: 'st-help-ns2', name: 'HELP Ns. 2', status: 'offline', avatarColor: 'hsl(175, 75%, 40%)' },
        { id: 'st-help-st1', name: 'HELP St. 1', status: 'offline', avatarColor: 'hsl(215, 60%, 45%)' },
        { id: 'st-help-st2', name: 'HELP St. 2', status: 'offline', avatarColor: 'hsl(215, 60%, 45%)' }
    ];

    const store = {
        get(key, defaultValue) {
            const data = localStorage.getItem(`clinic_flow_${key}`);
            return data ? JSON.parse(data) : defaultValue;
        },
        set(key, value) {
            localStorage.setItem(`clinic_flow_${key}`, JSON.stringify(value));
        }
    };

    // Load state from localStorage or initialize with defaults
    let staffs = store.get('staffs', DEFAULT_STAFFS);
    let records = store.get('records', []);
    let pointLedger = store.get('point_ledger', {
        'st-1': { current: 0, lifetime: 0 },
        'st-2': { current: 0, lifetime: 0 },
        'st-3': { current: 0, lifetime: 0 },
        'st-4': { current: 0, lifetime: 0 },
        'st-5': { current: 0, lifetime: 0 },
        'st-6': { current: 0, lifetime: 0 },
        'st-7': { current: 0, lifetime: 0 },
        'st-8': { current: 0, lifetime: 0 },
        'st-9': { current: 0, lifetime: 0 },
        'st-10': { current: 0, lifetime: 0 },
        'st-11': { current: 0, lifetime: 0 },
        'st-12': { current: 0, lifetime: 0 },
        'st-13': { current: 0, lifetime: 0 },
        'st-14': { current: 0, lifetime: 0 }
    });
    let pointLogs = store.get('point_logs', []);
    let correctionRequests = store.get('correction_requests', []);
    const CURRENT_OFFICIAL_GAS_URL = 'https://script.google.com/macros/s/AKfycbw-3DuK5blL7OwmIx6pO7_nc1-4_l6-6EysjFhr3-c4cMz6EJzOBAG6DLM3Z8tKWvn4Dw/exec';
    let settings = store.get('settings', {
        pointRate: 10, // points per hour
        adminPassword: 'admin',
        gasUrl: CURRENT_OFFICIAL_GAS_URL
    });

    // 最新のGAS URLへ更新（古いURLや空文字が残っている場合の自動アップデート）
    if (!settings.gasUrl || settings.gasUrl.indexOf('AKfycbw-3DuK') === -1) {
        settings.gasUrl = CURRENT_OFFICIAL_GAS_URL;
        store.set('settings', settings);
    }

    // マイグレーション：仮スタッフの名称更新（看護師１→HELP Ns. 1 など）
    let staffMigrationNeeded = false;
    staffs.forEach(s => {
        if (s.name === '看護師１' || s.name === '看護師 1' || s.name === '看護師1') {
            s.name = 'HELP Ns. 1';
            staffMigrationNeeded = true;
        } else if (s.name === '看護師２' || s.name === '看護師 2' || s.name === '看護師2') {
            s.name = 'HELP Ns. 2';
            staffMigrationNeeded = true;
        } else if (s.name === '医療事務１' || s.name === '医療事務 1' || s.name === '医療事務1') {
            s.name = 'HELP St. 1';
            staffMigrationNeeded = true;
        } else if (s.name === '医療事務２' || s.name === '医療事務 2' || s.name === '医療事務2') {
            s.name = 'HELP St. 2';
            staffMigrationNeeded = true;
        }
    });

    // ★全PC完全同期: DEFAULT_STAFFS（千原由佳菜さん等）が漏れていれば確実に復元＆正しい並び順で同期
    const existingStaffMap = new Map();
    staffs.forEach(s => {
        const cleanName = s.name ? s.name.replace(/\s+/g, '') : '';
        existingStaffMap.set(s.id, s);
        if (cleanName) existingStaffMap.set(cleanName, s);
    });

    const synchronizedStaffs = [];
    DEFAULT_STAFFS.forEach(defStaff => {
        const cleanDef = defStaff.name.replace(/\s+/g, '');
        const current = existingStaffMap.get(defStaff.id) || existingStaffMap.get(cleanDef);
        if (current) {
            // 既存の状態（online/break等）やアバター色を維持
            synchronizedStaffs.push({
                ...defStaff,
                status: current.status || 'offline',
                lastActionTime: current.lastActionTime || null
            });
        } else {
            // 新規スタッフ（千原さん等）をデフォルト位置に追加
            synchronizedStaffs.push({ ...defStaff });
            staffMigrationNeeded = true;
        }
    });

    // DEFAULT_STAFFSに含まれていない追加スタッフ（もしあれば）を末尾に追加
    staffs.forEach(s => {
        const cleanName = s.name ? s.name.replace(/\s+/g, '') : '';
        const inDef = DEFAULT_STAFFS.some(d => d.id === s.id || d.name.replace(/\s+/g, '') === cleanName);
        if (!inDef) {
            synchronizedStaffs.push(s);
            staffMigrationNeeded = true;
        }
    });

    staffs = synchronizedStaffs;
    store.set('staffs', staffs);

    let selectedStaffId = null;
    let isAdminAuthenticated = false;

    // Initialize UI Elements
    const elements = {
        // Clock
        currentDate: document.getElementById('current-date'),
        currentTime: document.getElementById('current-time'),
        
        // Navigation / Main layout
        btnAdminNav: document.getElementById('btn-admin-nav'),
        mainAttendance: document.getElementById('main-attendance'),
        mainAdmin: document.getElementById('main-admin'),
        btnBackToAttendance: document.getElementById('btn-back-to-attendance'),
        adminNavItems: document.querySelectorAll('.nav-item'),
        tabPanels: document.querySelectorAll('.tab-panel'),
        
        // Staff / Control Panel
        staffGrid: document.getElementById('staff-grid'),
        timelineSection: document.getElementById('timeline-section'),
        timelineContainer: document.getElementById('timeline-container'),
        timelineMainTitle: document.getElementById('timeline-main-title'),
        btnTimelinePrev: document.getElementById('btn-timeline-prev'),
        btnTimelineNext: document.getElementById('btn-timeline-next'),
        btnTimelineToday: document.getElementById('btn-timeline-today'),
        timelineDatePicker: document.getElementById('timeline-date-picker'),
        timelineDateLabel: document.getElementById('timeline-date-label'),
        btnJumpTimeline: document.getElementById('btn-jump-timeline'),
        btnJumpTimeline2: document.getElementById('btn-jump-timeline-2'),
        controlPanel: document.getElementById('control-panel'),
        btnClosePanel: document.getElementById('btn-close-panel'),
        activeStaffAvatar: document.getElementById('active-staff-avatar'),
        activeStaffInitial: document.getElementById('active-staff-initial'),
        activeStaffName: document.getElementById('active-staff-name'),
        activeStaffStatus: document.getElementById('active-staff-status'),
        
        // Attendance Buttons
        btnCheckin: document.getElementById('btn-checkin'),
        btnBreak: document.getElementById('btn-break'),
        btnBreakText: document.getElementById('btn-break-text'),
        btnCheckout: document.getElementById('btn-checkout'),
        
        // Today Summary
        summaryCheckin: document.getElementById('summary-checkin'),
        summaryBreakStart: document.getElementById('summary-break-start'),
        summaryBreakEnd: document.getElementById('summary-break-end'),
        summaryCheckout: document.getElementById('summary-checkout'),
        
        // Indicator
        breakStatusBar: document.getElementById('break-status-bar'),
        breakStatusText: document.getElementById('break-status-text'),
        
        // Admin: Records
        filterStartDate: document.getElementById('filter-start-date'),
        filterEndDate: document.getElementById('filter-end-date'),
        btnExportCsv: document.getElementById('btn-export-csv'),
        btnOpenExcelModal: document.getElementById('btn-open-excel-modal'),
        btnSidebarExcelExport: document.getElementById('btn-sidebar-excel-export'),
        recordsTableBody: document.getElementById('records-table-body'),
        
        // Excel Export Modal
        modalExcelExport: document.getElementById('modal-excel-export'),
        btnCloseExcelModal: document.getElementById('btn-close-excel-modal'),
        formExcelExport: document.getElementById('form-excel-export'),
        excelTargetYear: document.getElementById('excel-target-year'),
        excelTargetMonth: document.getElementById('excel-target-month'),
        excelPeriodPreview: document.getElementById('excel-period-preview'),
        btnDoExcelExport: document.getElementById('btn-do-excel-export'),
        
        // Admin: Staff management
        formAddStaff: document.getElementById('form-add-staff'),
        newStaffName: document.getElementById('new-staff-name'),
        newStaffEn: document.getElementById('new-staff-en'),
        adminStaffTableBody: document.getElementById('admin-staff-table-body'),
        modalEditStaff: document.getElementById('modal-edit-staff'),
        btnCloseEditStaff: document.getElementById('btn-close-edit-staff'),
        btnCancelEditStaff: document.getElementById('btn-cancel-edit-staff'),
        formEditStaff: document.getElementById('form-edit-staff'),
        editStaffId: document.getElementById('edit-staff-id'),
        editStaffName: document.getElementById('edit-staff-name'),
        editStaffEn: document.getElementById('edit-staff-en'),
        editStaffCode: document.getElementById('edit-staff-code'),
        editStaffSub: document.getElementById('edit-staff-sub'),
        
        // Admin: Points
        pointRateInput: document.getElementById('point-rate'),
        btnSavePointSettings: document.getElementById('btn-save-point-settings'),
        formUsePoints: document.getElementById('form-use-points'),
        selectPointStaff: document.getElementById('select-point-staff'),
        pointAmountInput: document.getElementById('point-amount'),
        pointReasonInput: document.getElementById('point-reason'),
        pointsTableBody: document.getElementById('points-table-body'),
        pointLogsTableBody: document.getElementById('point-logs-table-body'),
        gasUrlInput: document.getElementById('gas-url'),
        btnSaveGas: document.getElementById('btn-save-gas'),
        
        // Auth Modal
        modalAuth: document.getElementById('modal-auth'),
        btnCloseAuth: document.getElementById('btn-close-auth'),
        formAuth: document.getElementById('form-auth'),
        adminPassword: document.getElementById('admin-password'),
        authError: document.getElementById('auth-error'),
        
        // Peer Gift Modal (Allocation)
        modalPeerGift: document.getElementById('modal-peer-gift'),
        btnClosePeerGift: document.getElementById('btn-close-peer-gift'),
        peerGiftMessage: document.getElementById('peer-gift-message'),
        formPeerGift: document.getElementById('form-peer-gift'),
        pointAllocationSection: document.getElementById('point-allocation-section'),
        allocTotalDisplay: document.getElementById('alloc-total-display'),
        allocRemainingDisplay: document.getElementById('alloc-remaining-display'),
        allocStaffList: document.getElementById('alloc-staff-list'),
        btnQuickAllocOne: document.getElementById('btn-quick-alloc-one'),
        quickAllocBox: document.getElementById('quick-alloc-box'),
        quickAllocSelect: document.getElementById('quick-alloc-select'),
        btnApplyQuickAlloc: document.getElementById('btn-apply-quick-alloc'),
        giftMessage: document.getElementById('gift-message'),
        btnSkipGift: document.getElementById('btn-skip-gift'),
        btnSubmitGift: document.getElementById('btn-submit-gift'),
        overtimeReasonSection: document.getElementById('overtime-reason-section'),
        selectOvertimeReason: document.getElementById('select-overtime-reason'),
        overtimeReasonDetail: document.getElementById('overtime-reason-detail'),
        overtimeErrorMsg: document.getElementById('overtime-error-msg'),
        
        // Correction Request (Staff)
        btnOpenCorrectionModal: document.getElementById('btn-open-correction-modal'),
        modalCorrectionRequest: document.getElementById('modal-correction-request'),
        btnCloseCorrectionModal: document.getElementById('btn-close-correction-modal'),
        formCorrectionRequest: document.getElementById('form-correction-request'),
        correctionStaffName: document.getElementById('correction-staff-name'),
        correctionDate: document.getElementById('correction-date'),
        correctionCheckin: document.getElementById('correction-checkin'),
        correctionCheckout: document.getElementById('correction-checkout'),
        correctionReasonSelect: document.getElementById('correction-reason-select'),
        correctionReasonDetail: document.getElementById('correction-reason-detail'),

        // Staff Individual Shift Input Modal
        btnOpenStaffShiftModal: document.getElementById('btn-open-staff-shift-modal'),
        modalStaffShift: document.getElementById('modal-staff-shift'),
        btnCloseStaffShift: document.getElementById('btn-close-staff-shift'),
        btnCancelStaffShift: document.getElementById('btn-cancel-staff-shift'),
        btnSubmitStaffShift: document.getElementById('btn-submit-staff-shift'),
        staffShiftAvatar: document.getElementById('staff-shift-avatar'),
        staffShiftCode: document.getElementById('staff-shift-code'),
        staffShiftModalTitle: document.getElementById('staff-shift-modal-title'),
        btnShiftMonthCur: document.getElementById('btn-shift-month-cur'),
        btnShiftMonthNext: document.getElementById('btn-shift-month-next'),
        staffShiftDaysContainer: document.getElementById('staff-shift-days-container'),
        btnQuickFillWeekdayFull: document.getElementById('btn-quick-fill-weekday-full'),
        btnQuickFillWeekdayAm: document.getElementById('btn-quick-fill-weekday-am'),
        btnQuickFillSundayOff: document.getElementById('btn-quick-fill-sunday-off'),
        btnQuickFillClear: document.getElementById('btn-quick-fill-clear'),

        // Admin: Correction Requests Management
        badgePendingRequests: document.getElementById('badge-pending-requests'),
        pendingCountText: document.getElementById('pending-count-text'),
        pendingRequestsTableBody: document.getElementById('pending-requests-table-body'),
        processedRequestsTableBody: document.getElementById('processed-requests-table-body'),
        
        // Cloud Sync Elements
        cloudSyncPill: document.getElementById('cloud-sync-pill'),
        cloudSyncIcon: document.getElementById('cloud-sync-icon'),
        syncStatusText: document.getElementById('sync-status-text'),
        btnSyncNow: document.getElementById('btn-sync-now'),

        // Calendar & Schedule Elements
        todayCalendarBanner: document.getElementById('today-calendar-banner'),
        calendarSummaryText: document.getElementById('calendar-summary-text'),
        btnViewCalendar: document.getElementById('btn-view-calendar'),
        modalTodayEvents: document.getElementById('modal-today-events'),
        calendarModalTitle: document.getElementById('calendar-modal-title'),
        calendarModalSubtitle: document.getElementById('calendar-modal-subtitle'),
        calendarEventsList: document.getElementById('calendar-events-list'),
        btnCloseCalendarModal: document.getElementById('btn-close-calendar-modal'),
        inputCalendarId: document.getElementById('calendar-id'),
        btnSaveCalendarId: document.getElementById('btn-save-calendar-id'),

        // Toast
        toastContainer: document.getElementById('toast-container')
    };

    // Calendar Settings Default
    if (!settings.calendarId) {
        settings.calendarId = 'honmachifc@gmail.com';
        store.set('settings', settings);
    }
    let todayEvents = store.get('today_events', []);
    let calendarSyncStatus = store.get('calendar_sync_status', null);
    let todayShift = store.get('today_shift', { sheetName: null, date: null, shifts: {} });

    // Helper to calculate billing period (16th of previous month to 15th of current month)
    function getDefaultBillingPeriod() {
        const now = new Date();
        const year = now.getFullYear();
        const month = now.getMonth();
        const date = now.getDate();
        let startYear, startMonth, endYear, endMonth;

        if (date >= 16) {
            startYear = year;
            startMonth = month;
            const nextDate = new Date(year, month + 1, 15);
            endYear = nextDate.getFullYear();
            endMonth = nextDate.getMonth();
        } else {
            const prevDate = new Date(year, month - 1, 16);
            startYear = prevDate.getFullYear();
            startMonth = prevDate.getMonth();
            endYear = year;
            endMonth = month;
        }

        const startStr = `${startYear}-${String(startMonth + 1).padStart(2, '0')}-16`;
        const endStr = `${endYear}-${String(endMonth + 1).padStart(2, '0')}-15`;
        return { start: startStr, end: endStr };
    }

    // Initialize filter date to today (using local time)
    const localNow = new Date();
    const todayStr = `${localNow.getFullYear()}-${String(localNow.getMonth() + 1).padStart(2, '0')}-${String(localNow.getDate()).padStart(2, '0')}`;
    
    // Set default billing period filter values
    const billingPeriod = getDefaultBillingPeriod();
    elements.filterStartDate.value = billingPeriod.start;
    elements.filterEndDate.value = billingPeriod.end;

    // ==========================================================================
    // Realtime Clock Functionality
    // ==========================================================================
    function updateClock() {
        const now = new Date();
        const days = ['日', '月', '火', '水', '木', '金', '土'];
        
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const date = String(now.getDate()).padStart(2, '0');
        const day = days[now.getDay()];
        
        const hours = String(now.getHours()).padStart(2, '0');
        const minutes = String(now.getMinutes()).padStart(2, '0');
        const seconds = String(now.getSeconds()).padStart(2, '0');
        
        elements.currentDate.textContent = `${year}年${month}月${date}日(${day})`;
        elements.currentTime.textContent = `${hours}:${minutes}:${seconds}`;

        // 30秒ごとにタイムラインの現在時刻ライン＆実績バーをリアルタイム更新
        if (seconds === '00' || seconds === '30') {
            renderTodayTimeline();
        }
    }
    
    updateClock();
    setInterval(updateClock, 1000);

    // ==========================================================================
    // UI Helpers (Toasts & Rendering)
    // ==========================================================================
    function showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        let iconName = 'info';
        if (type === 'success') iconName = 'check-circle';
        if (type === 'warning') iconName = 'alert-triangle';
        
        toast.innerHTML = `
            <i data-lucide="${iconName}"></i>
            <span>${message}</span>
        `;
        elements.toastContainer.appendChild(toast);
        lucide.createIcons();
        
        setTimeout(() => {
            toast.style.animation = 'toastIn 0.3s reverse forwards';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    // Update active break indicator bar (休憩中のスタッフを明示)
    function updateBreakIndicator() {
        const breakingStaff = staffs.filter(s => s.status === 'break');
        if (breakingStaff.length > 0) {
            const names = breakingStaff.map(s => s.name).join('さん、');
            elements.breakStatusText.textContent = `只今、${names}さんが休憩中です`;
            elements.breakStatusBar.classList.remove('hidden');
        } else {
            elements.breakStatusBar.classList.add('hidden');
        }
    }

    // ==========================================================================
    // Staff Profile & International Styling Helper (Apple-like Modern Design)
    // ==========================================================================
    const KNOWN_STAFF_PROFILES = {
        '河合 茂明': { en: 'S. KAWAI', code: 'SK', theme: 'theme-navy' },
        '河合 朋子': { en: 'T. KAWAI', code: 'TK', theme: 'theme-teal' },
        '千葉 幸夫': { en: 'Y. CHIBA', code: 'YC', theme: 'theme-indigo' },
        '尾崎 昭太': { en: 'S. OSAKI', code: 'SO', theme: 'theme-amber' },
        '木村 哲子': { en: 'S. KIMURA', code: 'SK', theme: 'theme-emerald' },
        '末廣 綾乃': { en: 'A. SUEHIRO', code: 'AS', theme: 'theme-rose' },
        '北口 愛美': { en: 'M. KITAGUCHI', code: 'MK', theme: 'theme-cyan' },
        '寺西 真名美': { en: 'M. TERANISHI', code: 'MT', theme: 'theme-purple' },
        '植西 順子': { en: 'J. UENISHI', code: 'JU', theme: 'theme-fuchsia' },
        '千原 由佳菜': { en: 'Y. CHIHARA', code: 'YC', theme: 'theme-coral' },
        'マックアリース 温子': { en: 'A. MCALEESE', code: 'AM', theme: 'theme-ruby' },
        
        // ヘルプスタッフ（仮）
        'HELP Ns. 1': { en: 'HELP Ns. 1', code: 'HN1', theme: 'theme-teal', sub: '応援看護師 1' },
        'HELP Ns. 2': { en: 'HELP Ns. 2', code: 'HN2', theme: 'theme-teal', sub: '応援看護師 2' },
        'HELP St. 1': { en: 'HELP St. 1', code: 'HS1', theme: 'theme-slate', sub: '応援事務 1' },
        'HELP St. 2': { en: 'HELP St. 2', code: 'HS2', theme: 'theme-slate', sub: '応援事務 2' },

        // 旧仮名からのエイリアス
        '看護師１': { en: 'HELP Ns. 1', code: 'HN1', theme: 'theme-teal', sub: '応援看護師 1' },
        '看護師 1': { en: 'HELP Ns. 1', code: 'HN1', theme: 'theme-teal', sub: '応援看護師 1' },
        '看護師２': { en: 'HELP Ns. 2', code: 'HN2', theme: 'theme-teal', sub: '応援看護師 2' },
        '看護師 2': { en: 'HELP Ns. 2', code: 'HN2', theme: 'theme-teal', sub: '応援看護師 2' },
        '医療事務１': { en: 'HELP St. 1', code: 'HS1', theme: 'theme-slate', sub: '応援事務 1' },
        '医療事務 1': { en: 'HELP St. 1', code: 'HS1', theme: 'theme-slate', sub: '応援事務 1' },
        '医療事務２': { en: 'HELP St. 2', code: 'HS2', theme: 'theme-slate', sub: '応援事務 2' },
        '医療事務 2': { en: 'HELP St. 2', code: 'HS2', theme: 'theme-slate', sub: '応援事務 2' }
    };

    const THEME_CYCLE = ['theme-navy', 'theme-teal', 'theme-indigo', 'theme-emerald', 'theme-rose', 'theme-amber', 'theme-purple', 'theme-cyan', 'theme-coral', 'theme-fuchsia'];

    function getStaffDisplayProfile(staff) {
        if (!staff || !staff.name) {
            return { en: 'STAFF', code: 'ST', theme: 'theme-navy' };
        }
        const clean = staff.name.trim();
        for (const key in KNOWN_STAFF_PROFILES) {
            if (clean === key || clean.replace(/\s+/g, '') === key.replace(/\s+/g, '')) {
                return KNOWN_STAFF_PROFILES[key];
            }
        }

        // 新規スタッフ用の自動生成
        const parts = clean.split(/[\s　]+/);
        let enName = clean;
        let code = clean.substring(0, 2).toUpperCase();

        if (parts.length >= 2) {
            const family = parts[0];
            const given = parts[1];
            const gInitial = given.charAt(0).toUpperCase();
            enName = `${gInitial}. ${family.toUpperCase()}`;
            code = `${gInitial}${family.charAt(0).toUpperCase()}`;
        } else {
            code = clean.substring(0, 2).toUpperCase();
            enName = clean.toUpperCase();
        }

        let hash = 0;
        for (let i = 0; i < clean.length; i++) hash += clean.charCodeAt(i);
        const theme = THEME_CYCLE[hash % THEME_CYCLE.length];

        return { en: enName, code: code, theme: theme };
    }

    // ==========================================================================
    // Google Calendar Schedule Helpers & Modal
    // ==========================================================================
    function renderTodayCalendarBanner() {
        if (!elements.todayCalendarBanner || !elements.calendarSummaryText) return;

        if (!todayEvents || todayEvents.length === 0) {
            elements.todayCalendarBanner.classList.remove('has-events');
            elements.calendarSummaryText.textContent = '本日の予定はありません（平穏な1日になりますように✨）';
            if (elements.btnViewCalendar) {
                elements.btnViewCalendar.innerHTML = '詳細 <i data-lucide="chevron-right"></i>';
            }
        } else {
            elements.todayCalendarBanner.classList.add('has-events');
            const titles = todayEvents.slice(0, 3).map(ev => {
                const time = ev.isAllDay ? '【終日】' : `【${ev.startTime || ''}】`;
                return `${time}${ev.title}`;
            }).join('　/　');
            const more = todayEvents.length > 3 ? ` 他${todayEvents.length - 3}件` : '';
            elements.calendarSummaryText.textContent = `${titles}${more}`;
            if (elements.btnViewCalendar) {
                elements.btnViewCalendar.innerHTML = `${todayEvents.length}件の予定 <i data-lucide="chevron-right"></i>`;
            }
        }
        if (window.lucide) lucide.createIcons();
    }

    function showTodayEventsModal(staffName = null) {
        if (!elements.modalTodayEvents) return;

        if (staffName) {
            const cleanName = staffName.split(/[\s　]+/)[0];
            elements.calendarModalSubtitle.textContent = `${cleanName}さん、おはようございます！本日のクリニック予定をお知らせします。`;
        } else {
            elements.calendarModalSubtitle.textContent = '本日のクリニック予定スケジュール一覧です。';
        }

        if (!todayEvents || todayEvents.length === 0) {
            let guideMsg = '';
            if (calendarSyncStatus && !calendarSyncStatus.foundTargetCal) {
                guideMsg = `
                    <div style="margin-top: 0.8rem; padding: 0.6rem 0.8rem; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 8px; font-size: 0.78rem; color: #c2410c; text-align: left; line-height: 1.5;">
                        <i data-lucide="info" style="width: 14px; height: 14px; vertical-align: -2px; margin-right: 4px;"></i>
                        <strong>クリニックカレンダー連携のご案内:</strong><br>
                        クリニック側（honmachifc@gmail.com）のGoogleカレンダーで、個人アカウントへの共有（すべての予定の詳細の閲覧）を行ってください。
                    </div>
                `;
            }

            elements.calendarEventsList.innerHTML = `
                <div class="calendar-events-empty">
                    <i data-lucide="calendar-check"></i>
                    <p>本日の予定はありません。<br>今日も一日笑顔で頑張りましょう！</p>
                    ${guideMsg}
                </div>
            `;
        } else {
            elements.calendarEventsList.innerHTML = todayEvents.map(ev => `
                <div class="calendar-event-card ${ev.isAllDay ? 'allday-card' : ''}">
                    <div class="calendar-event-header">
                        <span class="calendar-time-tag">
                            <i data-lucide="${ev.isAllDay ? 'sun' : 'clock'}" style="width:12px;height:12px;"></i>
                            ${escapeHTML(ev.timeDisplay || (ev.isAllDay ? '終日' : '時間未定'))}
                        </span>
                    </div>
                    <div class="calendar-event-title">${escapeHTML(ev.title)}</div>
                    ${ev.location ? `
                        <div class="calendar-event-meta">
                            <span class="calendar-event-meta-item">
                                <i data-lucide="map-pin"></i> ${escapeHTML(ev.location)}
                            </span>
                        </div>
                    ` : ''}
                    ${ev.description ? `
                        <div class="calendar-event-desc">${escapeHTML(ev.description)}</div>
                    ` : ''}
                </div>
            `).join('');
        }

        if (window.lucide) lucide.createIcons();
        elements.modalTodayEvents.classList.add('active');
    }

    function closeTodayEventsModal() {
        if (elements.modalTodayEvents) {
            elements.modalTodayEvents.classList.remove('active');
        }
    }

    // Render staff cards in the main screen
    function renderStaffGrid() {
        elements.staffGrid.innerHTML = '';
        
        staffs.forEach(staff => {
            const profile = getStaffDisplayProfile(staff);
            const card = document.createElement('div');
            
            const isOnline = staff.status === 'online';
            const isBreak = staff.status === 'break';
            const statusClassModifier = isOnline ? 'is-online' : (isBreak ? 'is-break' : 'is-offline');
            const activeClass = selectedStaffId === staff.id ? 'active-selection' : '';

            // 本日のシフト予定があるか判定（名前またはスペース除去一致）
            const staffCleanName = staff.name.replace(/\s+/g, '');
            let shiftInfo = null;
            if (todayShift && todayShift.shifts) {
                for (const shiftName in todayShift.shifts) {
                    if (shiftName === staff.name || shiftName.replace(/\s+/g, '') === staffCleanName) {
                        shiftInfo = todayShift.shifts[shiftName];
                        break;
                    }
                }
            }

            const shiftClass = shiftInfo ? 'has-today-shift' : '';
            card.className = `staff-card ${statusClassModifier} ${shiftClass} ${activeClass}`;
            card.dataset.id = staff.id;
            if (shiftInfo) {
                card.dataset.shift = shiftInfo;
            }
            
            let statusText = '未出勤';
            let statusBadgeClass = 'status-offline';
            let statusDot = '';

            if (isOnline) {
                statusText = '勤務中';
                statusBadgeClass = 'status-online';
                statusDot = '<div class="live-status-dot" title="勤務中 (LIVE)"></div>';
            } else if (isBreak) {
                statusText = '休憩中';
                statusBadgeClass = 'status-break';
                statusDot = '<div class="break-status-dot" title="休憩中"></div>';
            }

            // シフト予定バッジ（ピルタグ）
            let shiftBadgeHtml = '';
            if (shiftInfo) {
                shiftBadgeHtml = `
                    <div class="staff-card-shift-badge" title="本日シフト予定: ${escapeHTML(shiftInfo)}">
                        <i data-lucide="clock" style="width:11px;height:11px;"></i>
                        <span>${escapeHTML(shiftInfo)}</span>
                    </div>
                `;
            }

            card.innerHTML = `
                ${shiftBadgeHtml}
                <div class="staff-avatar-wrap">
                    <div class="staff-card-avatar ${profile.theme}">
                        <span>${escapeHTML(profile.code)}</span>
                    </div>
                    ${statusDot}
                </div>
                <div class="staff-card-en-name">${escapeHTML(profile.en)}</div>
                <div class="staff-card-jp-name ${shiftInfo ? 'shift-highlight' : ''}">${escapeHTML(profile.sub || staff.name)}</div>
            `;

            card.addEventListener('click', () => selectStaff(staff.id));
            elements.staffGrid.appendChild(card);
        });

        if (window.lucide) lucide.createIcons();
        updateBreakIndicator();
        renderTodayTimeline();
    }

    // ==========================================================================
    // Realtime Schedule & Actual Timeline (予定 vs 実績 横棒ガントチャート)
    // ==========================================================================
    let selectedTimelineDate = new Date();
    let monthFullShiftCache = {};
    let isFetchingMonthFullShift = false;

    function parseTimeToMinutes(timeStr) {
        if (!timeStr || typeof timeStr !== 'string') return null;
        const m = timeStr.match(/(\d{1,2}):(\d{2})/);
        if (!m) return null;
        return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
    }

    function formatYMD(d) {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function formatJPDate(d) {
        const y = d.getFullYear();
        const m = d.getMonth() + 1;
        const day = d.getDate();
        const dows = ['日', '月', '火', '水', '木', '金', '土'];
        return `${y}年${m}月${day}日 (${dows[d.getDay()]})`;
    }

    // 指定年月の全体シフトデータをGASから非同期取得
    function fetchMonthFullShift(year, month) {
        const mKey = `${year}-${String(month).padStart(2, '0')}`;
        if (monthFullShiftCache[mKey] || isFetchingMonthFullShift || !settings.gasUrl) return;
        isFetchingMonthFullShift = true;

        const callbackName = 'fullShiftCb_' + Date.now();
        const scriptEl = document.createElement('script');
        let resolved = false;

        const cleanup = () => {
            if (resolved) return;
            resolved = true;
            isFetchingMonthFullShift = false;
            try { delete window[callbackName]; } catch (e) {}
            try { if (scriptEl && scriptEl.parentNode) scriptEl.parentNode.removeChild(scriptEl); } catch (e) {}
        };

        const timer = setTimeout(() => {
            cleanup();
            const sep = settings.gasUrl.includes('?') ? '&' : '?';
            fetch(`${settings.gasUrl}${sep}action=getMonthFullShift&year=${year}&month=${month}`)
                .then(r => r.json())
                .then(res => {
                    if (res && res.data && res.data.days) {
                        monthFullShiftCache[mKey] = res.data.days;
                        renderScheduleTimeline();
                    }
                })
                .catch(() => {});
        }, 5000);

        window[callbackName] = function(resp) {
            clearTimeout(timer);
            cleanup();
            if (resp && resp.data && resp.data.days) {
                monthFullShiftCache[mKey] = resp.data.days;
                renderScheduleTimeline();
            }
        };

        scriptEl.onerror = function() {
            clearTimeout(timer);
            cleanup();
        };

        const sep = settings.gasUrl.includes('?') ? '&' : '?';
        scriptEl.src = `${settings.gasUrl}${sep}action=getMonthFullShift&year=${year}&month=${month}&callback=${callbackName}&_t=${Date.now()}`;
        document.body.appendChild(scriptEl);
    }

    function renderScheduleTimeline() {
        if (!elements.timelineContainer) return;

        const now = new Date();
        const nowHour = now.getHours();
        const nowMin = now.getMinutes();
        const nowTotalMin = nowHour * 60 + nowMin;

        const targetDate = selectedTimelineDate || now;
        const targetYMD = formatYMD(targetDate);
        const todayYMD = formatYMD(now);
        const isToday = (targetYMD === todayYMD);

        const targetY = targetDate.getFullYear();
        const targetM = targetDate.getMonth() + 1;
        const targetD = targetDate.getDate();
        const mKey = `${targetY}-${String(targetM).padStart(2, '0')}`;

        // 日付ナビゲーション表示更新
        if (elements.timelineDateLabel) {
            const jpStr = formatJPDate(targetDate);
            elements.timelineDateLabel.textContent = isToday ? `${jpStr} [本日]` : jpStr;
        }
        if (elements.timelineDatePicker) {
            elements.timelineDatePicker.value = targetYMD;
        }
        if (elements.timelineMainTitle) {
            elements.timelineMainTitle.textContent = isToday
                ? '本日のタイムスケジュール（予定 vs 実績）'
                : `${targetM}月${targetD}日のタイムスケジュール（予定 vs 実績）`;
        }

        // 月間シフトのキャッシュがなければ取得を試みる
        if (!monthFullShiftCache[mKey]) {
            fetchMonthFullShift(targetY, targetM);
        }

        // 対象日シフトの取得
        const dayShifts = (monthFullShiftCache[mKey] && monthFullShiftCache[mKey][targetD])
            ? monthFullShiftCache[mKey][targetD]
            : (isToday && todayShift && todayShift.shifts ? todayShift.shifts : {});

        // 対象日実績の取得
        const dayRecords = records.filter(r => normalizeDateStr(r.date) === targetYMD);

        // タイムラインの表示時間範囲（デフォルト: 8:00〜20:00）
        let baseStartHour = 8;
        let baseEndHour = 20;

        // シフト予定または実績があるスタッフを抽出
        const activeStaffList = [];
        staffs.forEach(staff => {
            const cleanName = staff.name ? staff.name.replace(/\s+/g, '') : '';
            let shiftText = null;
            if (dayShifts) {
                for (const k in dayShifts) {
                    if (k === staff.name || k.replace(/\s+/g, '') === cleanName) {
                        shiftText = dayShifts[k];
                        break;
                    }
                }
            }

            // 実績レコード
            const rec = dayRecords.find(r => {
                const rClean = r.staffName ? r.staffName.replace(/\s+/g, '') : '';
                return (r.staffId === staff.id) || (cleanName && rClean === cleanName);
            }) || (isToday ? getTodayRecord(staff.id) : null);

            const hasShift = !!shiftText && shiftText !== '休' && shiftText !== '×';
            const hasRecord = !!(rec && rec.checkin);

            if (hasShift || hasRecord) {
                activeStaffList.push({
                    staff: staff,
                    shiftText: hasShift ? shiftText : null,
                    record: rec
                });
            }
        });

        // 0人の場合は全スタッフを表示
        const displayList = activeStaffList.length > 0 ? activeStaffList : staffs.map(s => ({
            staff: s,
            shiftText: null,
            record: dayRecords.find(r => r.staffId === s.id) || (isToday ? getTodayRecord(s.id) : null)
        }));

        // 早出・遅出に応じて時間軸を自動拡張
        displayList.forEach(item => {
            if (item.shiftText) {
                const ranges = parseShiftTimeRanges(item.shiftText);
                ranges.forEach(r => {
                    const startH = Math.floor(r.startMin / 60);
                    const endH = Math.ceil(r.endMin / 60);
                    if (startH < baseStartHour) baseStartHour = Math.max(6, startH);
                    if (endH > baseEndHour) baseEndHour = Math.min(23, endH);
                });
            }
            if (item.record && item.record.checkin) {
                const checkinMin = parseTimeToMinutes(item.record.checkin);
                if (checkinMin !== null) {
                    const h = Math.floor(checkinMin / 60);
                    if (h < baseStartHour) baseStartHour = Math.max(6, h);
                }
                if (item.record.checkout) {
                    const checkoutMin = parseTimeToMinutes(item.record.checkout);
                    if (checkoutMin !== null) {
                        const h = Math.ceil(checkoutMin / 60);
                        if (h > baseEndHour) baseEndHour = Math.min(23, h);
                    }
                }
            }
        });

        const baseStartMin = baseStartHour * 60;
        const baseEndMin = baseEndHour * 60;
        const totalDurationMin = baseEndMin - baseStartMin;

        // HTML生成
        let html = '';

        // 1. 時間目盛りヘッダー
        html += '<div class="timeline-scale-row">';
        html += '<div class="timeline-scale-label-spacer">スタッフ</div>';
        html += '<div class="timeline-scale-track">';
        for (let h = baseStartHour; h < baseEndHour; h++) {
            html += `<div class="timeline-hour-mark">${h}:00</div>`;
        }
        html += '</div></div>';

        // 現在時刻ライン（本日のみ表示）
        let nowLineHtml = '';
        if (isToday && nowTotalMin >= baseStartMin && nowTotalMin <= baseEndMin) {
            const nowPct = ((nowTotalMin - baseStartMin) / totalDurationMin) * 100;
            const nowTimeStr = `${String(nowHour).padStart(2, '0')}:${String(nowMin).padStart(2, '0')}`;
            nowLineHtml = `
                <div class="timeline-now-line" style="left: ${nowPct.toFixed(2)}%;">
                    <span class="timeline-now-tag">現在 ${nowTimeStr}</span>
                </div>
            `;
        }

        // 2. 各スタッフ行の描画
        displayList.forEach(item => {
            const staff = item.staff;
            const profile = getStaffDisplayProfile(staff);
            const shiftText = item.shiftText;
            const record = item.record;

            let barsHtml = '';

            // A. 予定（シフト）バー描画（上段）
            if (shiftText) {
                const ranges = parseShiftTimeRanges(shiftText);
                ranges.forEach(r => {
                    const barStart = Math.max(baseStartMin, r.startMin);
                    const barEnd = Math.min(baseEndMin, r.endMin);
                    if (barEnd > barStart) {
                        const leftPct = ((barStart - baseStartMin) / totalDurationMin) * 100;
                        const widthPct = ((barEnd - barStart) / totalDurationMin) * 100;
                        barsHtml += `
                            <div class="timeline-bar timeline-bar-shift" style="left: ${leftPct.toFixed(2)}%; width: ${widthPct.toFixed(2)}%;" title="予定シフト: ${r.startStr}〜${r.endStr}">
                                <span>${r.startStr} - ${r.endStr}</span>
                            </div>
                        `;
                    }
                });
            }

            // B. 実績バー描画（下段）
            if (record && record.checkin) {
                const checkinMin = parseTimeToMinutes(record.checkin);
                let checkoutMin = record.checkout ? parseTimeToMinutes(record.checkout) : (isToday ? nowTotalMin : null);
                if (checkoutMin === null && isToday) checkoutMin = nowTotalMin;

                if (checkinMin !== null && checkoutMin !== null) {
                    const breakStartMin = record.breakStart ? parseTimeToMinutes(record.breakStart) : null;
                    const breakEndMin = record.breakEnd ? parseTimeToMinutes(record.breakEnd) : (isToday && staff.status === 'break' ? nowTotalMin : null);

                    function addWorkBar(sMin, eMin, sStr, eStr, isLive) {
                        const startClamped = Math.max(baseStartMin, sMin);
                        const endClamped = Math.min(baseEndMin, eMin);
                        if (endClamped > startClamped) {
                            const leftPct = ((startClamped - baseStartMin) / totalDurationMin) * 100;
                            const widthPct = ((endClamped - startClamped) / totalDurationMin) * 100;
                            const label = isLive ? `${sStr}〜勤務中` : `${sStr}〜${eStr}`;
                            barsHtml += `
                                <div class="timeline-bar timeline-bar-work" style="left: ${leftPct.toFixed(2)}%; width: ${widthPct.toFixed(2)}%;" title="実績: ${sStr}〜${eStr}">
                                    <span>${label}</span>
                                </div>
                            `;
                        }
                    }

                    if (breakStartMin !== null && breakStartMin < checkoutMin) {
                        addWorkBar(checkinMin, breakStartMin, record.checkin, record.breakStart, false);
                        const breakEndClamped = breakEndMin !== null ? Math.min(checkoutMin, breakEndMin) : checkoutMin;
                        if (breakEndClamped > breakStartMin) {
                            const bStart = Math.max(baseStartMin, breakStartMin);
                            const bEnd = Math.min(baseEndMin, breakEndClamped);
                            if (bEnd > bStart) {
                                const bLeft = ((bStart - baseStartMin) / totalDurationMin) * 100;
                                const bWidth = ((bEnd - bStart) / totalDurationMin) * 100;
                                barsHtml += `
                                    <div class="timeline-bar timeline-bar-break" style="left: ${bLeft.toFixed(2)}%; width: ${bWidth.toFixed(2)}%;" title="休憩: ${record.breakStart}〜${record.breakEnd || '現在'}">
                                        <span>休憩</span>
                                    </div>
                                `;
                            }
                        }
                        if (breakEndMin !== null && breakEndMin < checkoutMin) {
                            addWorkBar(breakEndMin, checkoutMin, record.breakEnd, record.checkout || '勤務中', isToday && !record.checkout);
                        }
                    } else {
                        addWorkBar(checkinMin, checkoutMin, record.checkin, record.checkout || '勤務中', isToday && !record.checkout);
                    }
                }
            } else {
                barsHtml += '<div class="timeline-empty-guide"></div>';
            }

            html += `
                <div class="timeline-staff-row">
                    <div class="timeline-staff-info">
                        <div class="timeline-staff-avatar ${profile.theme}">
                            <span>${escapeHTML(profile.code)}</span>
                        </div>
                        <div class="timeline-staff-text">
                            <div class="timeline-staff-name">${escapeHTML(staff.name)}</div>
                            <div class="timeline-staff-sub">${escapeHTML(profile.en)}</div>
                        </div>
                    </div>
                    <div class="timeline-bars-track">
                        ${barsHtml}
                    </div>
                </div>
            `;
        });

        elements.timelineContainer.innerHTML = html;

        // 現在時刻線の設置（本日のみ）
        if (nowLineHtml) {
            const firstTrack = elements.timelineContainer.querySelector('.timeline-bars-track');
            if (firstTrack) {
                const totalRows = displayList.length;
                const totalHeightPx = totalRows * 48;
                const wrapper = document.createElement('div');
                wrapper.innerHTML = nowLineHtml;
                const nowEl = wrapper.firstElementChild;
                nowEl.style.height = `${totalHeightPx + 24}px`;
                firstTrack.appendChild(nowEl);
            }
        }
    }

    const renderTodayTimeline = renderScheduleTimeline;
    const renderTimeline = renderScheduleTimeline;

    // 日付ナビゲーションイベント
    if (elements.btnTimelinePrev) {
        elements.btnTimelinePrev.addEventListener('click', () => {
            selectedTimelineDate.setDate(selectedTimelineDate.getDate() - 1);
            renderScheduleTimeline();
        });
    }
    if (elements.btnTimelineNext) {
        elements.btnTimelineNext.addEventListener('click', () => {
            selectedTimelineDate.setDate(selectedTimelineDate.getDate() + 1);
            renderScheduleTimeline();
        });
    }
    if (elements.btnTimelineToday) {
        elements.btnTimelineToday.addEventListener('click', () => {
            selectedTimelineDate = new Date();
            renderScheduleTimeline();
        });
    }
    if (elements.timelineDatePicker) {
        elements.timelineDatePicker.addEventListener('change', (e) => {
            if (e.target.value) {
                selectedTimelineDate = new Date(e.target.value + 'T00:00:00');
                renderScheduleTimeline();
            }
        });
    }
    if (elements.btnJumpTimeline) {
        elements.btnJumpTimeline.addEventListener('click', () => {
            if (elements.timelineSection) {
                elements.timelineSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }
    if (elements.btnJumpTimeline2) {
        elements.btnJumpTimeline2.addEventListener('click', () => {
            if (elements.timelineSection) {
                elements.timelineSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    }

    // ==========================================================================
    // Attendance Controls Logic
    // ==========================================================================
    function selectStaff(staffId) {
        selectedStaffId = staffId;
        
        // 本日の最新レコードからステータスを即時整合
        reconcileStaffStatusFromRecords();

        // Highlight in grid
        document.querySelectorAll('.staff-card').forEach(card => {
            card.classList.toggle('active-selection', card.dataset.id === staffId);
        });

        const staff = staffs.find(s => s.id === staffId);
        if (!staff) return;

        // Open Control Panel
        elements.controlPanel.classList.remove('empty-state');
        elements.controlPanel.querySelector('.panel-placeholder').classList.add('hidden');
        elements.controlPanel.querySelector('.panel-content').classList.remove('hidden');

        // Set Info with internationalized typography & luxury gradient
        const profile = getStaffDisplayProfile(staff);
        const staffCleanName = staff.name.replace(/\s+/g, '');
        let shiftInfo = null;
        if (todayShift && todayShift.shifts) {
            for (const shiftName in todayShift.shifts) {
                if (shiftName === staff.name || shiftName.replace(/\s+/g, '') === staffCleanName) {
                    shiftInfo = todayShift.shifts[shiftName];
                    break;
                }
            }
        }
        const shiftHtml = shiftInfo 
            ? `<div style="display: inline-flex; align-items: center; gap: 4px; margin-top: 6px; padding: 2px 8px; background: #e0f2fe; color: #0284c7; border: 1px solid #bae6fd; border-radius: 999px; font-size: 0.75rem; font-weight: 700;"><i data-lucide="calendar-clock" style="width:12px;height:12px;"></i> 本日シフト: ${escapeHTML(shiftInfo)}</div>`
            : '';

        elements.activeStaffName.innerHTML = `
            <div style="font-family: 'Plus Jakarta Sans', system-ui, sans-serif; font-weight: 800; font-size: 1.25rem; letter-spacing: 0.04em; color: #0f172a;">${escapeHTML(profile.en)}</div>
            <div style="font-size: 0.85rem; color: #64748b; font-weight: 600; margin-top: 3px;">${escapeHTML(profile.sub || staff.name)}</div>
            ${shiftHtml}
        `;
        if (window.lucide) lucide.createIcons();
        elements.activeStaffInitial.textContent = profile.code;
        elements.activeStaffAvatar.className = `staff-avatar ${profile.theme}`;
        elements.activeStaffAvatar.style.backgroundColor = '';
        elements.activeStaffAvatar.style.color = '#ffffff';

        updateControlPanelState(staff);
    }

    function closeControlPanel() {
        selectedStaffId = null;
        elements.controlPanel.classList.add('empty-state');
        elements.controlPanel.querySelector('.panel-placeholder').classList.remove('hidden');
        elements.controlPanel.querySelector('.panel-content').classList.add('hidden');
        
        // Remove highlight from grid
        document.querySelectorAll('.staff-card').forEach(card => {
            card.classList.remove('active-selection');
        });
    }

    function updateControlPanelState(staff) {
        // Reset status badge
        elements.activeStaffStatus.className = 'status-badge';
        let statusText = '未出勤';
        if (staff.status === 'online') {
            statusText = '勤務中';
            elements.activeStaffStatus.classList.add('status-online');
        } else if (staff.status === 'break') {
            statusText = '休憩中';
            elements.activeStaffStatus.classList.add('status-break');
        } else {
            elements.activeStaffStatus.classList.add('status-offline');
        }
        elements.activeStaffStatus.textContent = statusText;

        // Adjust buttons enabled state
        if (staff.status === 'offline') {
            elements.btnCheckin.disabled = false;
            elements.btnBreak.disabled = true;
            elements.btnCheckout.disabled = true;
            elements.btnBreakText.textContent = '休憩開始';
        } else if (staff.status === 'online') {
            elements.btnCheckin.disabled = true;
            elements.btnBreak.disabled = false;
            elements.btnCheckout.disabled = false;
            
            // Determine if they already had a break today
            const record = getTodayRecord(staff.id);
            if (record && record.breakStart && !record.breakEnd) {
                elements.btnBreakText.textContent = '休憩終了';
            } else {
                elements.btnBreakText.textContent = '休憩開始';
            }
        } else if (staff.status === 'break') {
            elements.btnCheckin.disabled = true;
            elements.btnBreak.disabled = false;
            elements.btnCheckout.disabled = true;
            elements.btnBreakText.textContent = '休憩終了';
        }

        // Show today's record summary
        const record = getTodayRecord(staff.id);
        elements.summaryCheckin.textContent = record?.checkin || '-';
        elements.summaryBreakStart.textContent = record?.breakStart || '-';
        elements.summaryBreakEnd.textContent = record?.breakEnd || '-';
        elements.summaryCheckout.textContent = record?.checkout || '-';
    }

    function normalizeDateStr(dateVal) {
        if (!dateVal) return '';
        if (typeof dateVal === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateVal.trim())) {
            return dateVal.trim();
        }
        const d = new Date(dateVal);
        if (!isNaN(d.getTime())) {
            const y = d.getFullYear();
            const m = String(d.getMonth() + 1).padStart(2, '0');
            const day = String(d.getDate()).padStart(2, '0');
            return `${y}-${m}-${day}`;
        }
        return String(dateVal).substring(0, 10);
    }

    function normalizeTimeStr(timeVal) {
        if (!timeVal) return null;
        if (typeof timeVal === 'string') {
            if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeVal.trim())) {
                return timeVal.trim();
            }
            const match = timeVal.match(/(\d{2}:\d{2}:\d{2})/);
            if (match) return match[1];
        }
        const d = new Date(timeVal);
        if (!isNaN(d.getTime())) {
            const h = String(d.getHours()).padStart(2, '0');
            const min = String(d.getMinutes()).padStart(2, '0');
            const s = String(d.getSeconds()).padStart(2, '0');
            return `${h}:${min}:${s}`;
        }
        return String(timeVal);
    }

    /**
     * シフト文字列（例: "10:00〜13:00, 17:00〜19:00"）を解析してコマ一覧を返す
     */
    function parseShiftTimeRanges(shiftText) {
        if (!shiftText || typeof shiftText !== 'string') return [];
        let norm = shiftText
            .replace(/[０-９]/g, s => String.fromCharCode(s.charCodeAt(0) - 0xFEE0))
            .replace(/[：]/g, ':')
            .replace(/[～〜ー−-]/g, '~')
            .replace(/[，、]/g, ',');

        const parts = norm.split(/[,/／\n\r\s]+/);
        const ranges = [];

        parts.forEach(part => {
            const matchColon = part.match(/(\d{1,2}):(\d{2})\s*~\s*(\d{1,2}):(\d{2})/);
            const matchKanji = part.match(/(\d{1,2})(?:時|:)?(\d{2})?分?\s*~\s*(\d{1,2})(?:時|:)?(\d{2})?分?/);

            if (matchColon) {
                const sH = parseInt(matchColon[1], 10);
                const sM = parseInt(matchColon[2], 10);
                const eH = parseInt(matchColon[3], 10);
                const eM = parseInt(matchColon[4], 10);
                ranges.push({
                    startMin: sH * 60 + sM,
                    endMin: eH * 60 + eM,
                    startStr: `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`,
                    endStr: `${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`
                });
            } else if (matchKanji && matchKanji[1] && matchKanji[3]) {
                const sH = parseInt(matchKanji[1], 10);
                const sM = parseInt(matchKanji[2] || '0', 10);
                const eH = parseInt(matchKanji[3], 10);
                const eM = parseInt(matchKanji[4] || '0', 10);
                ranges.push({
                    startMin: sH * 60 + sM,
                    endMin: eH * 60 + eM,
                    startStr: `${String(sH).padStart(2, '0')}:${String(sM).padStart(2, '0')}`,
                    endStr: `${String(eH).padStart(2, '0')}:${String(eM).padStart(2, '0')}`
                });
            }
        });

        return ranges;
    }

    function getTodayString() {
        const d = new Date();
        return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    }

    function getTodayRecord(staffId) {
        const today = getTodayString();
        const staff = staffs.find(s => s.id === staffId);
        const staffCleanName = staff?.name ? staff.name.replace(/\s+/g, '') : '';
        const todayRecs = records.filter(r => {
            const recCleanName = r.staffName ? r.staffName.replace(/\s+/g, '') : '';
            const isMatch = (r.staffId === staffId) || (staffCleanName && recCleanName === staffCleanName);
            return isMatch && normalizeDateStr(r.date) === today;
        });
        if (todayRecs.length === 0) return null;
        // 未退勤（checkinがありcheckoutがない）シフトを最優先、無ければ最新の打刻を返す
        return todayRecs.find(r => r.checkin && !r.checkout) || todayRecs[0];
    }

    // ==========================================================================
    // Mascot Runner Animation (レッサーパンダ院長 駆け抜け演出)
    // ==========================================================================
    const CHECKIN_MASCOT_MESSAGES = [
        '{name}さん、おはよう！今日も頑張ろう！🐾',
        '{name}さん、おはようございます！今日もファイト！🩺',
        '{name}さん、おはよう！今日も患者さんの笑顔のために頑張ろう〜！✨',
        '{name}さん、おはよう！今日も素敵な一日にしようね〜！🐾',
        '{name}さん、おはようございます！水分補給も忘れずにね〜！☕',
        'おはよう！今日もみんなで力を合わせて頑張ろう！🐾'
    ];

    const CHECKOUT_MASCOT_MESSAGES = [
        '{name}さん、今日も一日お疲れ様でした！ゆっくり休んでね〜！🌙',
        '{name}さん、お疲れ様！今日もありがとう！気をつけて帰ってね🐾',
        '{name}さん、お疲れ様でした！ナイスサポートでした！✨',
        '{name}さん、今日も大活躍でした！お風呂で温まってね〜！🛁'
    ];

    let mascotDismissTimer = null;

    function dismissMascotPopup(runner) {
        if (!runner || !runner.parentNode) return;
        if (mascotDismissTimer) {
            clearTimeout(mascotDismissTimer);
            mascotDismissTimer = null;
        }
        runner.classList.add('leaving');
        setTimeout(() => {
            if (runner.parentNode) {
                runner.parentNode.removeChild(runner);
            }
        }, 500);
    }

    function triggerMascotRun(staffName, type = 'checkin', eventHint = null) {
        const container = document.getElementById('mascot-runner-container');
        if (!container) return;

        // 既存のタイマーをクリアしてコンテナを初期化
        if (mascotDismissTimer) {
            clearTimeout(mascotDismissTimer);
            mascotDismissTimer = null;
        }
        container.innerHTML = '';

        const cleanName = staffName ? staffName.split(/[\s　]+/)[0] : '';
        const isCheckout = (type === 'checkout');
        
        let headerTitle = '';
        let bodyHtml = '';

        if (type === 'checkin' && eventHint) {
            let eventsArray = Array.isArray(eventHint) ? eventHint : [];
            headerTitle = `<i data-lucide="bell" style="width:13px;height:13px;margin-right:3px;"></i> 院長からの本日の連絡 (${eventsArray.length > 0 ? eventsArray.length + '件' : '予定あり'})`;
            
            let listMarkup = '';
            if (eventsArray.length > 0) {
                const displayItems = eventsArray.slice(0, 4);
                const itemsHtml = displayItems.map(ev => {
                    const timeTag = ev.isAllDay ? '【終日】' : `【${ev.startTime}】`;
                    return `<li style="display: flex; gap: 0.35rem; align-items: baseline; margin-bottom: 0.25rem;">
                        <span style="font-weight: 700; color: #ea580c; white-space: nowrap; font-size: 0.82rem;">${timeTag}</span>
                        <span style="color: #0f172a; word-break: break-all;">${escapeHTML(ev.title)}</span>
                    </li>`;
                }).join('');

                const moreText = eventsArray.length > 4 
                    ? `<div style="font-size: 0.78rem; color: #ea580c; margin-top: 0.3rem; text-align: right; font-weight: 600;">他 ${eventsArray.length - 4} 件（タップで全件表示）</div>`
                    : `<div style="font-size: 0.75rem; color: #64748b; margin-top: 0.3rem; text-align: right;">※タップで場所・詳細を表示</div>`;

                listMarkup = `
                    <ul style="list-style: none; padding: 0; margin: 0; font-size: 0.85rem; line-height: 1.45;">
                        ${itemsHtml}
                    </ul>
                    ${moreText}
                `;
            } else {
                listMarkup = `<div><strong>本日の予定:</strong> ${escapeHTML(String(eventHint))}</div>`;
            }

            bodyHtml = `
                <div style="margin-bottom: 0.45rem;"><strong>${escapeHTML(cleanName)}さん</strong>、おはようございます！今日もよろしくお願いします✨</div>
                <div class="mascot-bubble-event-highlight">
                    <div style="font-weight: 700; font-size: 0.82rem; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.3rem; color: #c2410c;">
                        <i data-lucide="calendar"></i> 本日の予定スケジュール:
                    </div>
                    ${listMarkup}
                </div>
            `;
        } else if (type === 'checkin') {
            headerTitle = '<i data-lucide="sparkles" style="width:13px;height:13px;margin-right:3px;"></i> 院長からのメッセージ';
            const template = CHECKIN_MASCOT_MESSAGES[Math.floor(Math.random() * CHECKIN_MASCOT_MESSAGES.length)];
            const text = template.replace('{name}', cleanName);
            bodyHtml = `<div>${escapeHTML(text)}</div>`;
        } else {
            headerTitle = '<i data-lucide="moon" style="width:13px;height:13px;margin-right:3px;"></i> 院長からのお疲れさま';
            const template = CHECKOUT_MASCOT_MESSAGES[Math.floor(Math.random() * CHECKOUT_MASCOT_MESSAGES.length)];
            const text = template.replace('{name}', cleanName);
            bodyHtml = `<div>${escapeHTML(text)}</div>`;
        }

        const runner = document.createElement('div');
        runner.className = 'mascot-runner';

        runner.innerHTML = `
            <div class="mascot-waddle-box">
                <div class="mascot-bubble ${isCheckout ? 'checkout-theme' : ''}">
                    <div class="mascot-bubble-title">
                        <span>${headerTitle}</span>
                        <button type="button" class="mascot-bubble-close" title="閉じる">×</button>
                    </div>
                    <div class="mascot-bubble-body">
                        ${bodyHtml}
                    </div>
                </div>
                <img src="images/lesser-doctor.png" alt="レッサーパンダ院長" class="mascot-img">
            </div>
        `;

        // 閉じるボタンのリスナー
        const closeBtn = runner.querySelector('.mascot-bubble-close');
        if (closeBtn) {
            closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                dismissMascotPopup(runner);
            });
        }

        // 吹き出し全体をクリックしたとき、イベントがあれば予定モーダルを表示
        const bubble = runner.querySelector('.mascot-bubble');
        if (bubble && eventHint) {
            bubble.style.cursor = 'pointer';
            bubble.title = 'クリックして予定一覧を表示';
            bubble.addEventListener('click', () => {
                showTodayEventsModal(staffName);
            });
        }

        container.appendChild(runner);
        if (window.lucide) lucide.createIcons();

        // 連絡があるときは20秒間じっくり表示（通常メッセージは12秒）、その後右下に帰っていく
        const displayDuration = (type === 'checkin' && eventHint) ? 20000 : 12000;
        mascotDismissTimer = setTimeout(() => {
            dismissMascotPopup(runner);
        }, displayDuration);
    }

    // カレンダーバナー・モーダル開閉リスナー
    if (elements.btnViewCalendar) {
        elements.btnViewCalendar.addEventListener('click', () => {
            showTodayEventsModal();
        });
    }
    if (elements.btnCloseCalendarModal) {
        elements.btnCloseCalendarModal.addEventListener('click', closeTodayEventsModal);
    }

    // 1. 出勤 (Check-in)
    elements.btnCheckin.addEventListener('click', () => {
        if (!selectedStaffId) return;
        const staff = staffs.find(s => s.id === selectedStaffId);
        if (!staff || staff.status !== 'offline') return;

        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0]; // HH:MM:SS

        // Update staff status
        staff.status = 'online';
        staff.lastActionTime = now.toISOString();

        // Create new attendance record
        const newRecord = {
            id: `rec-${Date.now()}`,
            staffId: staff.id,
            staffName: staff.name,
            date: getTodayString(),
            checkin: timeStr,
            breakStart: null,
            breakEnd: null,
            checkout: null,
            duration: 0,
            points: 0
        };

        records.unshift(newRecord); // Add to beginning

        saveState();
        renderStaffGrid();
        updateControlPanelState(staff);
        syncWithGoogleSheets(true);
        showToast(`${staff.name}さん、おはようございます。出勤を記録しました。`, 'success');

        // 本日の予定がある場合は院長が右下から登場して20秒間アナウンス（箇条書き一覧付き）！
        if (todayEvents && todayEvents.length > 0) {
            triggerMascotRun(staff.name, 'checkin', todayEvents);
        } else {
            // レッサーパンダ院長が応援メッセージ！
            triggerMascotRun(staff.name, 'checkin');
        }
    });

    // 2. 休憩 (Break Toggle: Start/End)
    elements.btnBreak.addEventListener('click', () => {
        if (!selectedStaffId) return;
        const staff = staffs.find(s => s.id === selectedStaffId);
        if (!staff) return;

        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0];
        let record = getTodayRecord(staff.id);

        if (!record) {
            showToast('出勤記録が見つかりません。', 'warning');
            return;
        }

        if (staff.status === 'online') {
            // 休憩開始
            staff.status = 'break';
            staff.lastActionTime = now.toISOString();
            
            record.breakStart = timeStr;
            
            showToast(`${staff.name}さん、休憩を開始します。ゆっくり休んでください。`, 'warning');
        } else if (staff.status === 'break') {
            // 休憩終了
            staff.status = 'online';
            staff.lastActionTime = now.toISOString();
            
            record.breakEnd = timeStr;
            
            showToast(`${staff.name}さん、休憩を終了しました。お疲れ様です。`, 'success');
        }

        saveState();
        renderStaffGrid();
        updateControlPanelState(staff);
        syncWithGoogleSheets(true);
    });

    // Temporary storage for staff checkout waiting for peer point gift assignment
    let pendingCheckout = null;

    // 3. 退勤 (Check-out)
    elements.btnCheckout.addEventListener('click', () => {
        if (!selectedStaffId) return;
        const staff = staffs.find(s => s.id === selectedStaffId);
        if (!staff || staff.status !== 'online') return;

        const now = new Date();
        const timeStr = now.toTimeString().split(' ')[0];
        let record = getTodayRecord(staff.id);

        if (!record) {
            showToast('出勤記録が見つかりません。', 'warning');
            return;
        }

        // Calculate work duration
        record.checkout = timeStr;
        staff.status = 'offline';
        staff.lastActionTime = now.toISOString();

        // Duration calculation logic
        const parsedCheckin = parseTimeToDate(record.date, record.checkin);
        const parsedCheckout = now;
        
        let workDurationMs = parsedCheckout - parsedCheckin;

        // Deduct break duration if exists
        if (record.breakStart && record.breakEnd) {
            const parsedBreakStart = parseTimeToDate(record.date, record.breakStart);
            const parsedBreakEnd = parseTimeToDate(record.date, record.breakEnd);
            const breakDurationMs = parsedBreakEnd - parsedBreakStart;
            
            if (breakDurationMs > 0) {
                workDurationMs -= breakDurationMs;
            }
        }

        // Guard against negative duration
        if (workDurationMs < 0) workDurationMs = 0;

        const workMinutes = Math.floor(workDurationMs / (1000 * 60));
        record.duration = workMinutes;

        // Calculate points based on new rules:
        // - 3+ hours = 2 points
        // - 6+ hours = 3 points
        // - Otherwise = 0 points
        let pointsEarned = 0;
        if (workMinutes >= 360) {
            pointsEarned = 3;
        } else if (workMinutes >= 180) {
            pointsEarned = 2;
        }
        
        record.points = pointsEarned;
        record.peerReceiverId = null;
        record.peerReceiverName = null;
        record.peerPoints = 0;
        record.overtimeReason = null;

        // ==========================================================================
        // 残業判定ロジック（シフト予定に対する残業 ＆ 8時間超/18:30以降の判定）
        // ==========================================================================
        const staffCleanName = staff.name.replace(/\s+/g, '');
        let shiftInfo = null;
        if (todayShift && todayShift.shifts) {
            for (const shiftName in todayShift.shifts) {
                if (shiftName === staff.name || shiftName.replace(/\s+/g, '') === staffCleanName) {
                    shiftInfo = todayShift.shifts[shiftName];
                    break;
                }
            }
        }

        let isOvertime = false;
        let overtimeReasonGuide = '';
        const nowTotalMin = now.getHours() * 60 + now.getMinutes();

        if (shiftInfo) {
            const ranges = parseShiftTimeRanges(shiftInfo);
            if (ranges.length > 0) {
                // 中抜けなどの複数コマに対応：現在時刻に近い（または該当する）コマの終了時刻を特定
                let matchedRange = null;
                for (const r of ranges) {
                    // コマの開始30分前以降であればそのコマの対象とみなす
                    if (nowTotalMin >= r.startMin - 30) {
                        matchedRange = r;
                    }
                }
                if (!matchedRange) matchedRange = ranges[ranges.length - 1];

                // 予定終了時刻を過ぎているか判定
                if (nowTotalMin > matchedRange.endMin) {
                    isOvertime = true;
                    const overMin = nowTotalMin - matchedRange.endMin;
                    overtimeReasonGuide = `本日はシフト予定（〜${matchedRange.endStr}）を ${overMin}分 超過しています。該当する業務内容を選択してください。`;
                }
            }
        }

        // シフト予定がない、または判定されなかった場合のフォールバック（8時間超、または18:30以降）
        if (!isOvertime) {
            const nowHour = now.getHours();
            const nowMin = now.getMinutes();
            const isLate = (nowHour > 18) || (nowHour === 18 && nowMin >= 30);
            if (workMinutes >= 480 || isLate) {
                isOvertime = true;
                overtimeReasonGuide = `本日は所定勤務時間を超えています。該当する業務内容を選択してください。`;
            }
        }

        // ★最重要セーフティネット: 退勤打刻をこの瞬間に即座に保存・クラウド送信！
        // モーダルを閉じられたりブラウザを終了されても、退勤打刻自体は絶対に失われないように先行確定
        saveState();
        reconcileStaffStatusFromRecords();
        closeControlPanel();
        syncWithGoogleSheets(true);

        // If earned points OR overtime, open modal to input gift and/or overtime reason
        if (pointsEarned > 0 || isOvertime) {
            pendingCheckout = { staff, record, pointsEarned, isOvertime };
            
            // Overtime Section visibility
            if (isOvertime) {
                elements.overtimeReasonSection.classList.remove('hidden');
                const guideEl = elements.overtimeReasonSection.querySelector('p');
                if (guideEl && overtimeReasonGuide) {
                    guideEl.textContent = overtimeReasonGuide;
                }
                elements.selectOvertimeReason.value = '';
                elements.selectOvertimeReason.style.borderColor = '#f59e0b';
                elements.overtimeReasonDetail.value = '';
                elements.overtimeReasonDetail.classList.add('hidden');
                elements.overtimeReasonDetail.required = false;
                if (elements.overtimeErrorMsg) elements.overtimeErrorMsg.classList.add('hidden');
            } else {
                elements.overtimeReasonSection.classList.add('hidden');
                elements.selectOvertimeReason.value = '';
                elements.overtimeReasonDetail.value = '';
                elements.overtimeReasonDetail.required = false;
                if (elements.overtimeErrorMsg) elements.overtimeErrorMsg.classList.add('hidden');
            }

            // Populate peer gift allocation
            if (pointsEarned > 0) {
                elements.peerGiftMessage.textContent = `本日の勤務で ${pointsEarned} ポイント獲得しました！`;
                elements.pointAllocationSection.classList.remove('hidden');
                elements.btnSubmitGift.textContent = 'ポイントを配分して退勤';
                renderAllocationList(staff.id, pointsEarned);
            } else {
                elements.peerGiftMessage.textContent = `本日の勤務時間: ${(workMinutes / 60).toFixed(1)} 時間`;
                elements.pointAllocationSection.classList.add('hidden');
                elements.btnSubmitGift.textContent = '退勤を記録する';
            }

            // Show modal
            elements.modalPeerGift.classList.add('active');
            if (window.lucide) window.lucide.createIcons();
            renderStaffGrid();
        } else {
            // Instant checkout with no points and no overtime
            showToast(`${staff.name}さん、お疲れ様でした。退勤を記録しました。(勤務時間: ${(workMinutes/60).toFixed(1)}時間)`, 'success');
            triggerMascotRun(staff.name, 'checkout');
        }
    });

    // Toggle overtime detail input when 'その他' is chosen
    elements.selectOvertimeReason.addEventListener('change', () => {
        if (elements.overtimeErrorMsg) elements.overtimeErrorMsg.classList.add('hidden');
        elements.selectOvertimeReason.style.borderColor = '#f59e0b';
        if (elements.selectOvertimeReason.value === 'その他') {
            elements.overtimeReasonDetail.classList.remove('hidden');
            elements.overtimeReasonDetail.focus();
        } else {
            elements.overtimeReasonDetail.classList.add('hidden');
        }
        elements.overtimeReasonDetail.required = false;
    });

    // ==========================================================================
    // Peer Gift Allocation Logic
    // ==========================================================================
    let currentAllocations = {};
    let totalAllocPoints = 0;

    function renderAllocationList(selfStaffId, maxPoints) {
        totalAllocPoints = maxPoints;
        currentAllocations = {};

        elements.allocTotalDisplay.textContent = maxPoints;
        elements.allocRemainingDisplay.textContent = maxPoints;
        elements.quickAllocBox.classList.add('hidden');

        elements.quickAllocSelect.innerHTML = '<option value="">スタッフを選択...</option>';
        elements.allocStaffList.innerHTML = '';

        const peers = staffs.filter(s => s.id !== selfStaffId);
        peers.forEach(peer => {
            currentAllocations[peer.id] = 0;

            const opt = document.createElement('option');
            opt.value = peer.id;
            opt.textContent = peer.name;
            elements.quickAllocSelect.appendChild(opt);

            const row = document.createElement('div');
            row.className = 'alloc-staff-row';
            row.id = `alloc-row-${peer.id}`;
            const profile = getStaffDisplayProfile(peer);

            row.innerHTML = `
                <div class="alloc-staff-info">
                    <div class="alloc-mini-avatar ${profile.theme}" style="font-weight:800; font-size:0.75rem; letter-spacing:0.02em;">${escapeHTML(profile.code)}</div>
                    <div style="display:flex; flex-direction:column; line-height:1.2;">
                        <span style="font-weight:800; font-family:'Plus Jakarta Sans',sans-serif; font-size:0.9rem; color:#0f172a;">${escapeHTML(profile.en)}</span>
                        <span style="font-size:0.75rem; color:#64748b;">${escapeHTML(peer.name)}</span>
                    </div>
                </div>
                <div class="alloc-counter">
                    <button type="button" class="btn-alloc-step" data-action="dec" data-id="${peer.id}" disabled>-</button>
                    <span class="alloc-val-display" id="alloc-val-${peer.id}">0 pt</span>
                    <button type="button" class="btn-alloc-step" data-action="inc" data-id="${peer.id}">+</button>
                </div>
            `;
            elements.allocStaffList.appendChild(row);
        });

        updateAllocUI();
    }

    function updateAllocUI() {
        const allocatedSum = Object.values(currentAllocations).reduce((a, b) => a + b, 0);
        const remaining = totalAllocPoints - allocatedSum;
        elements.allocRemainingDisplay.textContent = remaining;

        for (const stId in currentAllocations) {
            const count = currentAllocations[stId];
            const row = document.getElementById(`alloc-row-${stId}`);
            const valDisplay = document.getElementById(`alloc-val-${stId}`);
            const btnDec = row?.querySelector('[data-action="dec"]');
            const btnInc = row?.querySelector('[data-action="inc"]');

            if (valDisplay) valDisplay.textContent = `${count} pt`;
            if (row) {
                if (count > 0) row.classList.add('has-points');
                else row.classList.remove('has-points');
            }
            if (btnDec) btnDec.disabled = (count <= 0);
            if (btnInc) btnInc.disabled = (remaining <= 0);
        }
    }

    // Step +/- click handler
    elements.allocStaffList.addEventListener('click', (e) => {
        const btn = e.target.closest('.btn-alloc-step');
        if (!btn) return;
        const action = btn.dataset.action;
        const id = btn.dataset.id;
        if (!id || currentAllocations[id] === undefined) return;

        const allocatedSum = Object.values(currentAllocations).reduce((a, b) => a + b, 0);
        const remaining = totalAllocPoints - allocatedSum;

        if (action === 'inc' && remaining > 0) {
            currentAllocations[id]++;
            updateAllocUI();
        } else if (action === 'dec' && currentAllocations[id] > 0) {
            currentAllocations[id]--;
            updateAllocUI();
        }
    });

    // Quick full allocation
    if (elements.btnQuickAllocOne) {
        elements.btnQuickAllocOne.addEventListener('click', () => {
            elements.quickAllocBox.classList.toggle('hidden');
        });
    }

    if (elements.btnApplyQuickAlloc) {
        elements.btnApplyQuickAlloc.addEventListener('click', () => {
            const chosenId = elements.quickAllocSelect.value;
            if (!chosenId) return;
            for (const id in currentAllocations) {
                currentAllocations[id] = (id === chosenId) ? totalAllocPoints : 0;
            }
            updateAllocUI();
        });
    }

    // Close peer gift modal (×ボタンで閉じた場合も退勤自体は完了させ、ポイント配分のみスキップ)
    if (elements.btnClosePeerGift) {
        elements.btnClosePeerGift.addEventListener('click', () => {
            if (pendingCheckout) {
                // 退勤打刻は維持したまま、ポイント配分をスキップして完了
                executeCheckoutFinish(true);
                showToast('退勤を記録しました（ポイント配分はスキップされました）。', 'info');
            } else {
                elements.modalPeerGift.classList.remove('active');
            }
        });
    }

    // Skip peer gift (ポイント配分をスキップして退勤)
    if (elements.btnSkipGift) {
        elements.btnSkipGift.addEventListener('click', (e) => {
            e.preventDefault();
            for (const id in currentAllocations) {
                currentAllocations[id] = 0;
            }
            executeCheckoutFinish(true);
        });
    }

    // Handle peer gift submit (ボタンクリックとフォーム送信の両方で確実に発火)
    if (elements.btnSubmitGift) {
        elements.btnSubmitGift.addEventListener('click', (e) => {
            e.preventDefault();
            executeCheckoutFinish(false);
        });
    }

    elements.formPeerGift.addEventListener('submit', (e) => {
        e.preventDefault();
        executeCheckoutFinish(false);
    });

    function executeCheckoutFinish(isSkip = false) {
        if (!pendingCheckout) {
            elements.modalPeerGift.classList.remove('active');
            return;
        }

        const { staff, record, pointsEarned, isOvertime } = pendingCheckout;
        const msg = elements.giftMessage ? elements.giftMessage.value.trim() : '';

        // Overtime reason handling
        if (isOvertime) {
            let reasonVal = elements.selectOvertimeReason ? elements.selectOvertimeReason.value : '';
            if (!reasonVal) {
                if (isSkip) {
                    // スキップで退勤した場合は自動でデフォルト理由を補完して退勤を妨げない
                    reasonVal = '急患・診療対応の延長';
                } else {
                    if (elements.overtimeErrorMsg) elements.overtimeErrorMsg.classList.remove('hidden');
                    if (elements.selectOvertimeReason) {
                        elements.selectOvertimeReason.style.borderColor = '#dc2626';
                        elements.selectOvertimeReason.focus();
                    }
                    showToast('残業理由を選択してください（画面上部の黄色い枠）。', 'warning');
                    return;
                }
            } else if (reasonVal === 'その他') {
                const detail = elements.overtimeReasonDetail ? elements.overtimeReasonDetail.value.trim() : '';
                if (!detail) {
                    if (elements.overtimeErrorMsg) {
                        elements.overtimeErrorMsg.textContent = '具体的な残業理由を入力してください';
                        elements.overtimeErrorMsg.classList.remove('hidden');
                    }
                    if (elements.overtimeReasonDetail) {
                        elements.overtimeReasonDetail.style.borderColor = '#dc2626';
                        elements.overtimeReasonDetail.focus();
                    }
                    showToast('具体的な残業理由を入力してください。', 'warning');
                    return;
                }
                reasonVal = `その他: ${detail}`;
            }
            record.overtimeReason = reasonVal;
        }

        try {
            // Process point allocations
            const allocatedPeers = [];
            let totalGiftPoints = 0;

            for (const receiverId in currentAllocations) {
                const pts = currentAllocations[receiverId];
                if (pts > 0) {
                    const receiver = staffs.find(s => s.id === receiverId);
                    if (receiver) {
                        totalGiftPoints += pts;
                        allocatedPeers.push(`${receiver.name}(${pts}pt)`);

                        if (!pointLedger[receiver.id]) {
                            pointLedger[receiver.id] = { current: 0, lifetime: 0 };
                        }
                        pointLedger[receiver.id].current += pts;
                        pointLedger[receiver.id].lifetime += pts;

                        pointLogs.unshift({
                            id: `pt-${Date.now()}-${receiver.id}`,
                            timestamp: new Date().toISOString(),
                            staffId: receiver.id,
                            staffName: receiver.name,
                            action: 'earn',
                            points: pts,
                            reason: `${staff.name}さんからの感謝ポイント: ${msg || '日頃のサポートに感謝！'}`
                        });
                    }
                }
            }

            // 余りポイントは自分の残高にストック
            const leftover = pointsEarned - totalGiftPoints;
            if (leftover > 0) {
                if (!pointLedger[staff.id]) {
                    pointLedger[staff.id] = { current: 0, lifetime: 0 };
                }
                pointLedger[staff.id].current += leftover;
                pointLedger[staff.id].lifetime += leftover;
            }

            if (totalGiftPoints > 0) {
                record.peerReceiverName = allocatedPeers.join(', ');
                record.peerPoints = totalGiftPoints;
            } else {
                record.peerReceiverName = null;
                record.peerPoints = 0;
            }

            // Save state and update UI
            saveState();
            reconcileStaffStatusFromRecords();
            syncWithGoogleSheets(true);

            // Close modal and reset
            elements.modalPeerGift.classList.remove('active');
            if (elements.giftMessage) elements.giftMessage.value = '';
            currentAllocations = {};
            pendingCheckout = null;

            if (totalGiftPoints > 0) {
                showToast(`${staff.name}さんの退勤を記録し、${record.peerReceiverName}へ感謝ポイントを配分しました！${record.overtimeReason ? ' (残業理由を記録済)' : ''}`, 'success');
            } else {
                showToast(`${staff.name}さんの退勤を記録しました。${record.overtimeReason ? ' (残業理由を記録済)' : ''}`, 'success');
            }

            // レッサーパンダ院長が走ってお疲れ様を伝える！
            triggerMascotRun(staff.name, 'checkout');
        } catch (err) {
            console.error('Checkout execution error:', err);
            // エラー時も確実にモーダルを閉じて退勤状態を担保
            elements.modalPeerGift.classList.remove('active');
            pendingCheckout = null;
            saveState();
            reconcileStaffStatusFromRecords();
            showToast(`${staff.name}さんの退勤を記録しました。`, 'success');
        }
    }

    function parseTimeToDate(dateStr, timeStr) {
        return new Date(`${dateStr}T${timeStr}`);
    }

    // ==========================================================================
    // Save State
    // ==========================================================================
    function saveState() {
        store.set('staffs', staffs);
        store.set('records', records);
        store.set('point_ledger', pointLedger);
        store.set('point_logs', pointLogs);
        store.set('correction_requests', correctionRequests);
        store.set('settings', settings);
    }

    // ==========================================================================
    // Cloud Sync Module (Google Apps Script - Bidirectional)
    // ==========================================================================
    let isPushing = false;
    let isFetching = false;

    function setSyncStatus(status, text) {
        if (!elements.cloudSyncPill || !elements.syncStatusText) return;
        elements.cloudSyncPill.className = 'cloud-sync-pill ' + status;
        elements.syncStatusText.textContent = text;
        if (window.lucide) window.lucide.createIcons();
    }

    async function syncWithGoogleSheets(isBackground = false) {
        if (!settings.gasUrl) {
            setSyncStatus('idle', 'クラウド未連携');
            return;
        }

        // URL形式の簡易チェック
        if (!settings.gasUrl.includes('/exec')) {
            setSyncStatus('error', 'URL形式エラー');
            if (!isBackground) {
                showToast('GASのURLが正しくありません。末尾が「/exec」のウェブアプリURLを貼り付けてください。', 'warning');
            }
            return;
        }

        if (isPushing) return;
        isPushing = true;
        setSyncStatus('syncing', 'クラウド送信中...');

        const payload = {
            action: 'sync_all',
            records: records,
            pointLedger: pointLedger,
            pointLogs: pointLogs,
            correctionRequests: correctionRequests,
            calendarId: settings.calendarId || 'honmachifc@gmail.com'
        };

        const jsonStr = JSON.stringify(payload);

        try {
            // 方法1: text/plain で生のJSONを送信
            // ※ブラウザの仕様上、text/plain はプリフライト(OPTIONS)を発生させずに直接GASへ届きます
            const res = await fetch(settings.gasUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: jsonStr
            });

            if (res.ok) {
                try {
                    const result = await res.json();
                    if (result.success && result.data) {
                        mergeCloudData(result.data);
                    }
                } catch (jsonErr) {
                    // レスポンスのJSONパース失敗時も送信自体は成功している場合がある
                }
            }

            const nowTime = new Date().toTimeString().substring(0, 5);
            setSyncStatus('synced', `同期済 ${nowTime}`);
            if (!isBackground) {
                showToast('Googleスプレッドシートへ打刻データを反映しました！', 'success');
            }
        } catch (err) {
            console.warn("GAS direct sync failed, attempting no-cors fallback:", err);
            // 方法2: no-cors 送信 (ブラウザのCORS制限を完全回避)
            try {
                await fetch(settings.gasUrl, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: {
                        'Content-Type': 'text/plain;charset=utf-8'
                    },
                    body: jsonStr
                });
                const nowTime = new Date().toTimeString().substring(0, 5);
                setSyncStatus('synced', `送信済 ${nowTime}`);
                if (!isBackground) {
                    showToast('スプレッドシートへ送信しました。数秒後にシートをご確認ください。', 'success');
                }
            } catch (err2) {
                console.error("GAS sync failed completely:", err2);
                setSyncStatus('error', '同期失敗');
                if (!isBackground) {
                    showToast('同期に失敗しました。URLをご確認ください。', 'warning');
                }
            }
        } finally {
            isPushing = false;
        }
    }

    function mergeCloudData(cloudData) {
        if (!cloudData) return;
        let hasChanges = false;

        // 1. Recordsマージ
        if (Array.isArray(cloudData.records) && cloudData.records.length > 0) {
            const localMap = new Map();
            records.forEach(r => {
                r.date = normalizeDateStr(r.date);
                if (r.checkin) r.checkin = normalizeTimeStr(r.checkin);
                if (r.breakStart) r.breakStart = normalizeTimeStr(r.breakStart);
                if (r.breakEnd) r.breakEnd = normalizeTimeStr(r.breakEnd);
                if (r.checkout) r.checkout = normalizeTimeStr(r.checkout);
                localMap.set(r.id || `${r.date}-${r.staffId}`, r);
            });

            cloudData.records.forEach(cloudRec => {
                cloudRec.date = normalizeDateStr(cloudRec.date);
                if (cloudRec.checkin) cloudRec.checkin = normalizeTimeStr(cloudRec.checkin);
                if (cloudRec.breakStart) cloudRec.breakStart = normalizeTimeStr(cloudRec.breakStart);
                if (cloudRec.breakEnd) cloudRec.breakEnd = normalizeTimeStr(cloudRec.breakEnd);
                if (cloudRec.checkout) cloudRec.checkout = normalizeTimeStr(cloudRec.checkout);

                const key = cloudRec.id || `${cloudRec.date}-${cloudRec.staffId}`;
                if (!localMap.has(key)) {
                    records.push(cloudRec);
                    hasChanges = true;
                } else {
                    const localRec = localMap.get(key);
                    // クラウド側のほうが更新されている場合（退勤打刻や休憩打刻、修正など）
                    if (cloudRec.checkout && !localRec.checkout) {
                        Object.assign(localRec, cloudRec);
                        hasChanges = true;
                    } else if (cloudRec.breakEnd && !localRec.breakEnd) {
                        Object.assign(localRec, cloudRec);
                        hasChanges = true;
                    } else if (cloudRec.breakStart && !localRec.breakStart) {
                        Object.assign(localRec, cloudRec);
                        hasChanges = true;
                    } else if (cloudRec.isCorrected && !localRec.isCorrected) {
                        Object.assign(localRec, cloudRec);
                        hasChanges = true;
                    }
                }
            });
        }

        // 2. Correction Requestsマージ
        if (Array.isArray(cloudData.correctionRequests) && cloudData.correctionRequests.length > 0) {
            const reqMap = new Map();
            correctionRequests.forEach(q => reqMap.set(q.id, q));

            cloudData.correctionRequests.forEach(cloudReq => {
                if (!reqMap.has(cloudReq.id)) {
                    correctionRequests.push(cloudReq);
                    hasChanges = true;
                } else {
                    const localReq = reqMap.get(cloudReq.id);
                    if (cloudReq.status !== localReq.status) {
                        localReq.status = cloudReq.status;
                        localReq.processedAt = cloudReq.processedAt;
                        hasChanges = true;
                    }
                }
            });
        }

        // 3. Point Ledgerマージ
        if (cloudData.pointLedger && typeof cloudData.pointLedger === 'object') {
            for (const stId in cloudData.pointLedger) {
                if (!pointLedger[stId]) {
                    pointLedger[stId] = cloudData.pointLedger[stId];
                    hasChanges = true;
                } else {
                    if (cloudData.pointLedger[stId].current > pointLedger[stId].current) {
                        pointLedger[stId].current = cloudData.pointLedger[stId].current;
                        hasChanges = true;
                    }
                }
            }
        }

        // 4. Google Calendar Events マージ（本日のクリニック予定）
        if (Array.isArray(cloudData.calendarEvents)) {
            todayEvents = cloudData.calendarEvents;
            store.set('today_events', todayEvents);
            renderTodayCalendarBanner();
        }
        if (cloudData.calendarStatus) {
            calendarSyncStatus = cloudData.calendarStatus;
            store.set('calendar_sync_status', calendarSyncStatus);
        }

        // 5. Shift Schedule マージ（本日の出勤シフト予定）
        if (cloudData.todayShift && typeof cloudData.todayShift === 'object') {
            todayShift = cloudData.todayShift;
            store.set('today_shift', todayShift);
            hasChanges = true;
        }

        // 6. Month Full Shift マージ（月間シフト予定データ）
        if (cloudData.monthFullShift && cloudData.monthFullShift.year && cloudData.monthFullShift.month) {
            const mKey = `${cloudData.monthFullShift.year}-${String(cloudData.monthFullShift.month).padStart(2, '0')}`;
            monthFullShiftCache[mKey] = cloudData.monthFullShift.days || {};
            hasChanges = true;
        }

        if (hasChanges) {
            saveState();
            reconcileStaffStatusFromRecords();
            renderRecordsTable();
            renderRequestsTables();
            updatePendingBadge();
            renderScheduleTimeline();
        } else {
            // 変更フラグが立たなくてもステータスの整合性を確保
            reconcileStaffStatusFromRecords();
            renderScheduleTimeline();
        }
    }

    // ==========================================================================
    // Multi-PC Status Reconciliation (打刻履歴から全スタッフの出勤状態を自動計算)
    // ==========================================================================
    function reconcileStaffStatusFromRecords() {
        const today = getTodayString();

        let statusChanged = false;
        staffs.forEach(staff => {
            // 本日の最新打刻レコードを探す (ID一致 または 名前一致)
            const staffCleanName = staff.name ? staff.name.replace(/\s+/g, '') : '';
            const todayRecs = records.filter(r => {
                const recCleanName = r.staffName ? r.staffName.replace(/\s+/g, '') : '';
                const isMatch = (r.staffId === staff.id) || (staffCleanName && recCleanName === staffCleanName);
                return isMatch && normalizeDateStr(r.date) === today;
            });
            
            // 出勤中（checkinがあってcheckoutがない）レコードがあればそれを優先
            let todayRec = null;
            if (todayRecs.length > 0) {
                todayRec = todayRecs.find(r => r.checkin && !r.checkout) || todayRecs[0];
            }

            let newStatus = 'offline';
            if (todayRec) {
                if (todayRec.checkout) {
                    newStatus = 'offline';
                } else if (todayRec.breakStart && !todayRec.breakEnd) {
                    newStatus = 'break';
                } else if (todayRec.checkin) {
                    newStatus = 'online';
                }
            }

            if (staff.status !== newStatus) {
                staff.status = newStatus;
                statusChanged = true;
            }
        });

        renderStaffGrid();

        // 操作パネルが開いているスタッフの状態も更新
        if (selectedStaffId) {
            const currentStaff = staffs.find(s => s.id === selectedStaffId);
            if (currentStaff) {
                updateControlPanelState(currentStaff);
            }
        }

        return statusChanged;
    }

    // ==========================================================================
    // JSONP Cloud Data Fetcher (CORSを100%回避して全PCでスプレッドシートと双方向同期)
    // ==========================================================================
    function fetchCloudDataViaJsonp() {
        if (!settings.gasUrl || isFetching || isPushing) return Promise.resolve(null);
        isFetching = true;

        return new Promise((resolve) => {
            const callbackName = 'gasCallback_' + Date.now();
            let resolved = false;
            let scriptEl = document.createElement('script');

            const cleanup = () => {
                if (resolved) return;
                resolved = true;
                try {
                    delete window[callbackName];
                } catch (e) {}
                try {
                    if (scriptEl && scriptEl.parentNode) {
                        scriptEl.parentNode.removeChild(scriptEl);
                    }
                } catch (e) {}
                isFetching = false;
            };

            const timeoutId = setTimeout(() => {
                cleanup();
                setSyncStatus('synced', '接続済');
                resolve(null);
            }, 6000);

            window[callbackName] = function(resp) {
                clearTimeout(timeoutId);
                cleanup();
                if (resp && resp.success && resp.data) {
                    mergeCloudData(resp.data);
                    const nowTime = new Date().toTimeString().substring(0, 5);
                    setSyncStatus('synced', `同期済 ${nowTime}`);
                    resolve(resp.data);
                } else {
                    setSyncStatus('synced', '接続済');
                    resolve(null);
                }
            };

            scriptEl.onerror = function() {
                clearTimeout(timeoutId);
                cleanup();
                // フォールバック: 通常fetchを試みる
                const fallbackCalId = encodeURIComponent(settings.calendarId || 'honmachifc@gmail.com');
                const sepFallback = settings.gasUrl.includes('?') ? '&' : '?';
                fetch(`${settings.gasUrl}${sepFallback}calendarId=${fallbackCalId}`)
                    .then(r => r.json())
                    .then(resp => {
                        if (resp && resp.success && resp.data) {
                            mergeCloudData(resp.data);
                            const nowTime = new Date().toTimeString().substring(0, 5);
                            setSyncStatus('synced', `同期済 ${nowTime}`);
                        }
                    })
                    .catch(() => {})
                    .finally(() => {
                        isFetching = false;
                        setSyncStatus('synced', '接続済');
                        resolve(null);
                    });
            };

            const sep = settings.gasUrl.includes('?') ? '&' : '?';
            const calParam = encodeURIComponent(settings.calendarId || 'honmachifc@gmail.com');
            scriptEl.src = `${settings.gasUrl}${sep}callback=${callbackName}&calendarId=${calParam}&_t=${Date.now()}`;
            document.body.appendChild(scriptEl);
        });
    }

    // ==========================================================================
    // Navigation & Auth Flow
    // ==========================================================================
    elements.btnAdminNav.addEventListener('click', () => {
        if (isAdminAuthenticated) {
            showAdminPanel();
        } else {
            elements.modalAuth.classList.add('active');
            elements.adminPassword.focus();
        }
    });

    elements.btnCloseAuth.addEventListener('click', () => {
        elements.modalAuth.classList.remove('active');
        elements.adminPassword.value = '';
        elements.authError.classList.add('hidden');
    });

    elements.formAuth.addEventListener('submit', (e) => {
        e.preventDefault();
        const pwd = elements.adminPassword.value;
        if (pwd === settings.adminPassword) {
            isAdminAuthenticated = true;
            elements.modalAuth.classList.remove('active');
            elements.adminPassword.value = '';
            elements.authError.classList.add('hidden');
            showAdminPanel();
            showToast('管理者としてログインしました。', 'success');
        } else {
            elements.authError.classList.remove('hidden');
        }
    });

    elements.btnBackToAttendance.addEventListener('click', () => {
        elements.mainAdmin.classList.add('hidden');
        elements.mainAttendance.classList.remove('hidden');
        elements.btnAdminNav.classList.remove('hidden');
        closeControlPanel();
        renderStaffGrid();
    });

    // Admin Panel Tab Switch
    elements.adminNavItems.forEach(item => {
        item.addEventListener('click', () => {
            elements.adminNavItems.forEach(nav => nav.classList.remove('active'));
            elements.tabPanels.forEach(panel => panel.classList.remove('active'));

            item.classList.add('active');
            const tabId = item.dataset.tab;
            document.getElementById(tabId).classList.add('active');
            
            // Reload tab specific data
            refreshAdminTab(tabId);
        });
    });

    function showAdminPanel() {
        elements.mainAttendance.classList.add('hidden');
        elements.mainAdmin.classList.remove('hidden');
        elements.btnAdminNav.classList.add('hidden');
        
        updatePendingBadge();
        // Initial tab render
        refreshAdminTab('tab-records');
        // Reset nav states
        elements.adminNavItems.forEach(n => n.classList.remove('active'));
        elements.adminNavItems[0].classList.add('active');
        elements.tabPanels.forEach(p => p.classList.remove('active'));
        document.getElementById('tab-records').classList.add('active');
    }

    function refreshAdminTab(tabId) {
        if (tabId === 'tab-records') {
            renderRecordsTable();
        } else if (tabId === 'tab-requests') {
            renderRequestsTables();
        } else if (tabId === 'tab-staff-management') {
            renderAdminStaffTable();
        } else if (tabId === 'tab-points') {
            renderPointsView();
        }
    }

    // ==========================================================================
    // Admin Module: Attendance Records
    // ==========================================================================
    elements.filterStartDate.addEventListener('change', renderRecordsTable);
    elements.filterEndDate.addEventListener('change', renderRecordsTable);

    function renderRecordsTable() {
        const startDate = elements.filterStartDate.value;
        const endDate = elements.filterEndDate.value;
        
        const filteredRecords = records.filter(r => {
            const d = normalizeDateStr(r.date);
            if (!startDate && !endDate) return true;
            if (startDate && !endDate) return d >= startDate;
            if (!startDate && endDate) return d <= endDate;
            return d >= startDate && d <= endDate;
        });
        
        elements.recordsTableBody.innerHTML = '';

        if (filteredRecords.length === 0) {
            elements.recordsTableBody.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center" style="color: var(--text-muted);">
                        指定期間の打刻履歴はありません。
                    </td>
                </tr>
            `;
            return;
        }

        filteredRecords.forEach(r => {
            const tr = document.createElement('tr');
            const hrs = (r.duration / 60).toFixed(1);
            const overtimeBadge = r.overtimeReason 
                ? `<span class="overtime-tag" title="${escapeHTML(r.overtimeReason)}"><i data-lucide="clock" style="width:12px;height:12px;"></i> ${escapeHTML(r.overtimeReason)}</span>` 
                : '-';

            const displayDate = normalizeDateStr(r.date);
            const inTime = normalizeTimeStr(r.checkin) || '-';
            const bStart = normalizeTimeStr(r.breakStart) || '-';
            const bEnd = normalizeTimeStr(r.breakEnd) || '-';
            const outTime = normalizeTimeStr(r.checkout) || '-';

            tr.innerHTML = `
                <td>${displayDate}${r.isCorrected ? ' <span style="font-size:0.7rem; color:var(--primary); font-weight:700;">[修正済]</span>' : ''}</td>
                <td style="font-weight: 600;">${escapeHTML(r.staffName)}</td>
                <td><span class="time-val">${inTime}</span></td>
                <td><span class="time-val">${bStart}</span></td>
                <td><span class="time-val">${bEnd}</span></td>
                <td><span class="time-val">${outTime}</span></td>
                <td>${r.checkout ? `${hrs} 時間 (${r.duration}分)` : '-'}</td>
                <td>${overtimeBadge}</td>
                <td style="font-weight: 600; color: var(--primary-dark);">${r.points ? `+${r.points} pt` : '-'}</td>
                <td style="font-weight: 600;">${r.peerReceiverName || '-'}</td>
                <td style="font-weight: 600; color: var(--warning);">${r.peerPoints ? `-${r.peerPoints} pt` : '-'}</td>
            `;
            elements.recordsTableBody.appendChild(tr);
        });
        if (window.lucide) window.lucide.createIcons();
    }

    // Export CSV (Filtered by selected range)
    elements.btnExportCsv.addEventListener('click', () => {
        const startDate = elements.filterStartDate.value;
        const endDate = elements.filterEndDate.value;

        const filteredRecords = records.filter(r => {
            const d = normalizeDateStr(r.date);
            if (!startDate && !endDate) return true;
            if (startDate && !endDate) return d >= startDate;
            if (!startDate && endDate) return d <= endDate;
            return d >= startDate && d <= endDate;
        });

        if (filteredRecords.length === 0) {
            showToast('指定期間のエクスポートするデータがありません。', 'warning');
            return;
        }

        // CSV Header
        let csvContent = '\uFEFF'; // UTF-8 BOM to prevent Excel encoding issues
        csvContent += '日付,スタッフ名,出勤時刻,休憩開始時刻,休憩終了時刻,退勤時刻,実労働時間(分),残業理由,獲得ポイント,贈った相手,贈ったポイント\r\n';

        filteredRecords.forEach(r => {
            const row = [
                r.date,
                r.staffName,
                r.checkin || '',
                r.breakStart || '',
                r.breakEnd || '',
                r.checkout || '',
                r.duration || 0,
                r.overtimeReason || '',
                r.points || 0,
                r.peerReceiverName || '',
                r.peerPoints || 0
            ].map(val => `"${val}"`).join(',');
            csvContent += row + '\r\n';
        });

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        
        const filePeriodStr = (startDate && endDate) ? `${startDate}_to_${endDate}` : 'all';
        link.setAttribute('download', `clinic_attendance_records_${filePeriodStr}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast('CSVエクスポートが完了しました。', 'success');
    });

    // ==========================================================================
    // Admin Module: Excel (時間集計表.xlsx) Export & Direct Sync
    // ==========================================================================
    
    // Initialize Target Year/Month Selects
    function initExcelExportModal() {
        const now = new Date();
        const curYear = now.getFullYear();
        const curMonth = now.getMonth() + 1;
        const curDate = now.getDate();

        // 締め日判定: 16日以降なら翌月度、15日以前なら当月度
        let defaultYear = curYear;
        let defaultMonth = curMonth;
        if (curDate >= 16) {
            defaultMonth += 1;
            if (defaultMonth > 12) {
                defaultMonth = 1;
                defaultYear += 1;
            }
        }

        // Years option (前年〜翌年)
        elements.excelTargetYear.innerHTML = '';
        for (let y = curYear - 1; y <= curYear + 2; y++) {
            const opt = document.createElement('option');
            opt.value = y;
            opt.textContent = `${y} (${y - 2018 >= 1 ? `令和${y - 2018}` : ''})`;
            if (y === defaultYear) opt.selected = true;
            elements.excelTargetYear.appendChild(opt);
        }

        // Months option (1〜12)
        elements.excelTargetMonth.innerHTML = '';
        for (let m = 1; m <= 12; m++) {
            const opt = document.createElement('option');
            opt.value = m;
            opt.textContent = m;
            if (m === defaultMonth) opt.selected = true;
            elements.excelTargetMonth.appendChild(opt);
        }

        updateExcelPeriodPreview();
    }

    function calculateExcelPeriod(targetYear, targetMonth) {
        // 対象月度 (targetYear年 targetMonth月度)
        // 開始日: 前月16日、終了日: 当月15日
        let startYear = targetYear;
        let startMonth = targetMonth - 1;
        if (startMonth < 1) {
            startMonth = 12;
            startYear -= 1;
        }
        const endYear = targetYear;
        const endMonth = targetMonth;

        const startReiwa = startYear - 2018;
        const endReiwa = endYear - 2018;

        return {
            startYear,
            startMonth,
            startDay: 16,
            startReiwa,
            startDateStr: `${startYear}-${String(startMonth).padStart(2, '0')}-16`,
            endYear,
            endMonth,
            endDay: 15,
            endReiwa,
            endDateStr: `${endYear}-${String(endMonth).padStart(2, '0')}-15`
        };
    }

    function updateExcelPeriodPreview() {
        const y = parseInt(elements.excelTargetYear.value, 10);
        const m = parseInt(elements.excelTargetMonth.value, 10);
        if (!y || !m) return;

        const period = calculateExcelPeriod(y, m);
        elements.excelPeriodPreview.textContent = 
            `対象期間: 令和${period.startReiwa}年${period.startMonth}月16日 〜 令和${period.endReiwa}年${period.endMonth}月15日 (${m}月度)`;
    }

    elements.excelTargetYear.addEventListener('change', updateExcelPeriodPreview);
    elements.excelTargetMonth.addEventListener('change', updateExcelPeriodPreview);

    function openExcelExportModal() {
        initExcelExportModal();
        elements.modalExcelExport.classList.add('active');
        if (window.lucide) window.lucide.createIcons();
    }

    if (elements.btnOpenExcelModal) {
        elements.btnOpenExcelModal.addEventListener('click', openExcelExportModal);
    }
    if (elements.btnSidebarExcelExport) {
        elements.btnSidebarExcelExport.addEventListener('click', openExcelExportModal);
    }

    elements.btnCloseExcelModal.addEventListener('click', () => {
        elements.modalExcelExport.classList.remove('active');
    });

    // Helper: Base64 to ArrayBuffer
    function base64ToArrayBuffer(base64) {
        const binaryString = window.atob(base64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        return bytes.buffer;
    }

    // Helper: HH:MM to 4-digit number (e.g. "09:45" -> 945, "13:55" -> 1355)
    function timeStrToNumber(timeStr) {
        if (!timeStr) return null;
        const parts = timeStr.split(':');
        if (parts.length < 2) return null;
        const h = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (isNaN(h) || isNaN(m)) return null;
        return h * 100 + m;
    }

    // Excel Export Submit Handler
    elements.formExcelExport.addEventListener('submit', async (e) => {
        e.preventDefault();

        if (typeof ExcelJS === 'undefined') {
            showToast('Excel生成ライブラリ (ExcelJS) が読み込まれていません。', 'warning');
            return;
        }

        if (!window.DEFAULT_EXCEL_TEMPLATE_BASE64) {
            showToast('Excelテンプレートファイルが見つかりません。', 'warning');
            return;
        }

        const targetYear = parseInt(elements.excelTargetYear.value, 10);
        const targetMonth = parseInt(elements.excelTargetMonth.value, 10);
        const period = calculateExcelPeriod(targetYear, targetMonth);

        const btnSubmit = elements.btnDoExcelExport;
        const originalBtnHTML = btnSubmit.innerHTML;
        btnSubmit.disabled = true;
        btnSubmit.innerHTML = `<i data-lucide="loader" class="spin"></i> 生成中...`;

        try {
            // 1. テンプレートからWorkbookを復元
            const workbook = new ExcelJS.Workbook();
            const templateBuffer = base64ToArrayBuffer(window.DEFAULT_EXCEL_TEMPLATE_BASE64);
            await workbook.xlsx.load(templateBuffer);

            // 2. 1枚目「【セット】」シートに期間を設定
            const setSheet = workbook.getWorksheet('【セット】');
            if (setSheet) {
                // E6: 令和の年, G6: 開始月, I6: 16
                setSheet.getCell('E6').value = period.startReiwa;
                setSheet.getCell('G6').value = period.startMonth;
                setSheet.getCell('I6').value = 16;
                // E8: 令和の年, G8: 終了月, I8: 15
                setSheet.getCell('E8').value = period.endReiwa;
                setSheet.getCell('G8').value = period.endMonth;
                setSheet.getCell('I8').value = 15;
            }

            // 3. 対象期間の日付配列を作成 (16日 〜 翌月15日)
            const dateList = [];
            const curDate = new Date(period.startYear, period.startMonth - 1, 16);
            const endDate = new Date(period.endYear, period.endMonth - 1, 15);
            while (curDate <= endDate) {
                const y = curDate.getFullYear();
                const m = String(curDate.getMonth() + 1).padStart(2, '0');
                const d = String(curDate.getDate()).padStart(2, '0');
                dateList.push(`${y}-${m}-${d}`);
                curDate.setDate(curDate.getDate() + 1);
            }

            // 4. 各スタッフのシートに打刻データを書き込み
            // 既存のシート一覧を取得
            workbook.eachSheet((worksheet) => {
                const sheetName = worksheet.name;
                // 【セット】や感謝ポイント一覧などは除外
                if (sheetName === '【セット】' || sheetName === '感謝ポイント一覧') return;

                // 該当スタッフをマッチング (氏名にシート名が含まれている、または名字が一致)
                const matchedStaff = staffs.find(s => {
                    const cleanSheet = sheetName.trim();
                    const cleanStaff = s.name.trim();
                    return cleanStaff.includes(cleanSheet) || cleanSheet.includes(cleanStaff.split(' ')[0]);
                });

                // 該当シートの行6〜行36の既存打刻データを一旦クリア
                for (let r = 6; r <= 36; r++) {
                    worksheet.getCell(`O${r}`).value = null; // 午前 出
                    worksheet.getCell(`P${r}`).value = null; // 午前 退
                    worksheet.getCell(`U${r}`).value = null; // 午後 出
                    worksheet.getCell(`V${r}`).value = null; // 午後 退
                }

                if (matchedStaff) {
                    // 日付ごとに打刻レコードを反映
                    dateList.forEach((dateStr, idx) => {
                        const rowNum = 6 + idx;
                        if (rowNum > 36) return;

                        // 当日の該当スタッフのレコードを抽出
                        const dayRecords = records.filter(r => 
                            (r.staffId === matchedStaff.id || r.staffName === matchedStaff.name) && 
                            normalizeDateStr(r.date) === dateStr
                        );

                        dayRecords.forEach(rec => {
                            if (!rec.checkin) return;
                            const checkinNum = timeStrToNumber(rec.checkin);
                            const checkoutNum = timeStrToNumber(rec.checkout);
                            if (checkinNum === null) return;

                            const hour = parseInt(rec.checkin.split(':')[0], 10);

                            if (hour < 13) {
                                // 13時未満: 午前診 (O列: 出, P列: 退)
                                worksheet.getCell(`O${rowNum}`).value = checkinNum;
                                if (checkoutNum !== null) {
                                    worksheet.getCell(`P${rowNum}`).value = checkoutNum;
                                }
                            } else {
                                // 13時以降: 午後診 (U列: 出, V列: 退)
                                worksheet.getCell(`U${rowNum}`).value = checkinNum;
                                if (checkoutNum !== null) {
                                    worksheet.getCell(`V${rowNum}`).value = checkoutNum;
                                }
                            }
                        });
                    });
                }
            });

            // 5. 【A案】新シート「感謝ポイント一覧」の自動作成・整形
            let ptSheet = workbook.getWorksheet('感謝ポイント一覧');
            if (ptSheet) {
                workbook.removeWorksheet(ptSheet.id);
            }
            ptSheet = workbook.addWorksheet('感謝ポイント一覧');

            // シート全体のフォント設定・グリッド表示
            ptSheet.views = [{ showGridLines: true }];

            // 列幅設定
            ptSheet.columns = [
                { width: 5 },   // A: 余白
                { width: 22 },  // B: スタッフ名 / 日付
                { width: 18 },  // C: 期間内獲得pt / 贈り元
                { width: 18 },  // D: 期間内贈呈pt / 贈り先
                { width: 18 },  // E: 現在保有pt / ポイント
                { width: 40 }   // F: 累計獲得pt / 感謝メッセージ
            ];

            // タイトル
            ptSheet.mergeCells('B2:F2');
            const titleCell = ptSheet.getCell('B2');
            titleCell.value = 'Clinic Flow - 感謝ポイント（ピアボーナス）集計表';
            titleCell.font = { name: 'Meiryo', size: 16, bold: true, color: { argb: 'FF0D3C61' } };

            ptSheet.mergeCells('B3:F3');
            const subTitleCell = ptSheet.getCell('B3');
            subTitleCell.value = `集計対象期間: 令和${period.startReiwa}年${period.startMonth}月16日 〜 令和${period.endReiwa}年${period.endMonth}月15日 (${targetMonth}月度)`;
            subTitleCell.font = { name: 'Meiryo', size: 11, color: { argb: 'FF475569' } };

            // セクション1: スタッフ別集計表
            ptSheet.getCell('B5').value = '【スタッフ別 ポイント獲得・贈呈状況】';
            ptSheet.getCell('B5').font = { name: 'Meiryo', size: 12, bold: true, color: { argb: 'FF1E293B' } };

            const staffHeaders = ['スタッフ名', '期間内 獲得pt', '期間内 贈呈pt', '現在 保有pt', '累計 獲得pt'];
            const headerRow = ptSheet.getRow(6);
            staffHeaders.forEach((h, i) => {
                const cell = headerRow.getCell(i + 2);
                cell.value = h;
                cell.font = { name: 'Meiryo', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FF0284C7' } // Blue primary
                };
                cell.alignment = { vertical: 'middle', horizontal: i === 0 ? 'left' : 'right' };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
                };
            });
            headerRow.height = 24;

            // 期間内の打刻レコードからポイントを集計
            const filteredPeriodRecords = records.filter(r => r.date >= period.startDateStr && r.date <= period.endDateStr);

            let currentRowIdx = 7;
            let totalPeriodEarned = 0;
            let totalPeriodGifted = 0;

            staffs.forEach(st => {
                // 期間内にこのスタッフが獲得したポイント
                const earned = filteredPeriodRecords
                    .filter(r => (r.staffId === st.id || r.staffName === st.name) && r.points)
                    .reduce((sum, r) => sum + (Number(r.points) || 0), 0);

                // 期間内にこのスタッフが他者へ贈ったポイント
                const gifted = filteredPeriodRecords
                    .filter(r => (r.staffId === st.id || r.staffName === st.name) && r.peerPoints)
                    .reduce((sum, r) => sum + (Number(r.peerPoints) || 0), 0);

                const ledger = pointLedger[st.id] || { current: 0, lifetime: 0 };

                totalPeriodEarned += earned;
                totalPeriodGifted += gifted;

                const row = ptSheet.getRow(currentRowIdx);
                row.getCell(2).value = st.name;
                row.getCell(3).value = earned;
                row.getCell(4).value = gifted;
                row.getCell(5).value = ledger.current;
                row.getCell(6).value = ledger.lifetime;

                // スタイル
                for (let c = 2; c <= 6; c++) {
                    const cell = row.getCell(c);
                    cell.font = { name: 'Meiryo', size: 10 };
                    cell.alignment = { vertical: 'middle', horizontal: c === 2 ? 'left' : 'right' };
                    cell.border = {
                        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                    };
                    if (currentRowIdx % 2 === 0) {
                        cell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFF8FAFC' }
                        };
                    }
                }
                row.height = 20;
                currentRowIdx++;
            });

            // 合計行
            const sumRow = ptSheet.getRow(currentRowIdx);
            sumRow.getCell(2).value = '合計';
            sumRow.getCell(3).value = totalPeriodEarned;
            sumRow.getCell(4).value = totalPeriodGifted;
            sumRow.getCell(5).value = '-';
            sumRow.getCell(6).value = '-';
            for (let c = 2; c <= 6; c++) {
                const cell = sumRow.getCell(c);
                cell.font = { name: 'Meiryo', size: 10, bold: true };
                cell.alignment = { vertical: 'middle', horizontal: c === 2 ? 'left' : 'right' };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFE0F2FE' }
                };
                cell.border = {
                    top: { style: 'medium', color: { argb: 'FF0284C7' } },
                    bottom: { style: 'double', color: { argb: 'FF0284C7' } },
                    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                };
            }
            sumRow.height = 22;
            currentRowIdx += 3;

            // セクション2: 感謝メッセージ・ギフト履歴
            ptSheet.getCell(`B${currentRowIdx}`).value = '【感謝メッセージ＆ギフト履歴】';
            ptSheet.getCell(`B${currentRowIdx}`).font = { name: 'Meiryo', size: 12, bold: true, color: { argb: 'FF1E293B' } };
            currentRowIdx++;

            const logHeaders = ['日付', '感謝を贈った人', '受け取った人', '贈呈ポイント', '感謝・評価メッセージ'];
            const logHeaderRow = ptSheet.getRow(currentRowIdx);
            logHeaders.forEach((h, i) => {
                const cell = logHeaderRow.getCell(i + 2);
                cell.value = h;
                cell.font = { name: 'Meiryo', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
                cell.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFD97706' } // Amber / warm gold
                };
                cell.alignment = { vertical: 'middle', horizontal: i === 3 ? 'right' : 'left' };
                cell.border = {
                    top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
                    right: { style: 'thin', color: { argb: 'FFCBD5E1' } }
                };
            });
            logHeaderRow.height = 24;
            currentRowIdx++;

            // 期間内のギフトログ
            const periodLogs = pointLogs.filter(l => l.date >= period.startDateStr && l.date <= period.endDateStr);
            if (periodLogs.length === 0) {
                const emptyRow = ptSheet.getRow(currentRowIdx);
                ptSheet.mergeCells(`B${currentRowIdx}:F${currentRowIdx}`);
                const emptyCell = emptyRow.getCell(2);
                emptyCell.value = '※この期間内の感謝ギフト履歴はありません。';
                emptyCell.font = { name: 'Meiryo', size: 10, italic: true, color: { argb: 'FF94A3B8' } };
                emptyCell.alignment = { vertical: 'middle', horizontal: 'center' };
                emptyRow.height = 24;
            } else {
                periodLogs.forEach(l => {
                    const row = ptSheet.getRow(currentRowIdx);
                    row.getCell(2).value = l.date;
                    row.getCell(3).value = l.giverName || '-';
                    row.getCell(4).value = l.receiverName || '-';
                    row.getCell(5).value = `${l.points} pt`;
                    row.getCell(6).value = l.message || '(メッセージなし)';

                    for (let c = 2; c <= 6; c++) {
                        const cell = row.getCell(c);
                        cell.font = { name: 'Meiryo', size: 10 };
                        cell.alignment = { vertical: 'middle', horizontal: c === 5 ? 'right' : 'left' };
                        cell.border = {
                            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
                            right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
                        };
                    }
                    row.height = 20;
                    currentRowIdx++;
                });
            }

            // 6. Excelファイルをバッファに書き出してダウンロード
            const outBuffer = await workbook.xlsx.writeBuffer();
            const blob = new Blob([outBuffer], {
                type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
            });
            const url = URL.createObjectURL(blob);
            const downloadLink = document.createElement('a');
            downloadLink.href = url;
            downloadLink.download = `時間集計表_${targetYear}年${targetMonth}月度.xlsx`;
            document.body.appendChild(downloadLink);
            downloadLink.click();
            document.body.removeChild(downloadLink);
            URL.revokeObjectURL(url);

            elements.modalExcelExport.classList.remove('active');
            showToast(`時間集計表 (${targetYear}年${targetMonth}月度) をダウンロードしました！`, 'success');
        } catch (err) {
            console.error('Excel Export Error:', err);
            showToast('Excel生成中にエラーが発生しました: ' + err.message, 'warning');
        } finally {
            btnSubmit.disabled = false;
            btnSubmit.innerHTML = originalBtnHTML;
            if (window.lucide) window.lucide.createIcons();
        }
    });

    // ==========================================================================
    // Staff Correction Request & Admin Approval Flow
    // ==========================================================================

    // Update Pending Badge in Admin Sidebar
    function updatePendingBadge() {
        const pendingCount = correctionRequests.filter(r => r.status === 'pending').length;
        if (elements.badgePendingRequests) {
            if (pendingCount > 0) {
                elements.badgePendingRequests.textContent = pendingCount;
                elements.badgePendingRequests.classList.remove('hidden');
            } else {
                elements.badgePendingRequests.classList.add('hidden');
            }
        }
        if (elements.pendingCountText) {
            elements.pendingCountText.textContent = `未承認 ${pendingCount}件`;
        }
    }
    // Initial call
    updatePendingBadge();

    // Staff: Open Correction Request Modal
    if (elements.btnOpenCorrectionModal) {
        elements.btnOpenCorrectionModal.addEventListener('click', () => {
            if (!selectedStaffId) {
                showToast('スタッフを選択してから申請ボタンを押してください。', 'warning');
                return;
            }
            const staff = staffs.find(s => s.id === selectedStaffId);
            if (!staff) return;

            elements.correctionStaffName.textContent = staff.name;
            
            // Default date to today
            const now = new Date();
            const y = now.getFullYear();
            const m = String(now.getMonth() + 1).padStart(2, '0');
            const d = String(now.getDate()).padStart(2, '0');
            elements.correctionDate.value = `${y}-${m}-${d}`;
            
            // Prefill with today's record if available
            const todayRec = getTodayRecord(staff.id);
            elements.correctionCheckin.value = todayRec && todayRec.checkin ? todayRec.checkin.substring(0, 5) : '';
            elements.correctionCheckout.value = todayRec && todayRec.checkout ? todayRec.checkout.substring(0, 5) : '';
            elements.correctionReasonSelect.value = '';
            elements.correctionReasonDetail.value = '';
            elements.correctionReasonDetail.classList.add('hidden');

            elements.modalCorrectionRequest.classList.add('active');
            if (window.lucide) window.lucide.createIcons();
        });
    }

    if (elements.btnCloseCorrectionModal) {
        elements.btnCloseCorrectionModal.addEventListener('click', () => {
            elements.modalCorrectionRequest.classList.remove('active');
        });
    }

    // Toggle reason detail input
    if (elements.correctionReasonSelect) {
        elements.correctionReasonSelect.addEventListener('change', () => {
            if (elements.correctionReasonSelect.value === 'その他') {
                elements.correctionReasonDetail.classList.remove('hidden');
                elements.correctionReasonDetail.required = true;
                elements.correctionReasonDetail.focus();
            } else {
                elements.correctionReasonDetail.classList.add('hidden');
                elements.correctionReasonDetail.required = false;
            }
        });
    }

    // Submit Correction Request
    if (elements.formCorrectionRequest) {
        elements.formCorrectionRequest.addEventListener('submit', (e) => {
            e.preventDefault();
            if (!selectedStaffId) return;
            const staff = staffs.find(s => s.id === selectedStaffId);
            if (!staff) return;

            const targetDate = elements.correctionDate.value;
            const checkinVal = elements.correctionCheckin.value || null;
            const checkoutVal = elements.correctionCheckout.value || null;

            if (!checkinVal && !checkoutVal) {
                showToast('出勤時刻または退勤時刻のいずれかを入力してください。', 'warning');
                return;
            }

            let reasonVal = elements.correctionReasonSelect.value;
            if (reasonVal === 'その他') {
                const detail = elements.correctionReasonDetail.value.trim();
                if (!detail) {
                    showToast('詳細な理由を入力してください。', 'warning');
                    return;
                }
                reasonVal = `その他: ${detail}`;
            }

            const newReq = {
                id: `req-${Date.now()}`,
                staffId: staff.id,
                staffName: staff.name,
                date: targetDate,
                checkin: checkinVal,
                checkout: checkoutVal,
                reason: reasonVal,
                status: 'pending',
                createdAt: new Date().toISOString(),
                processedAt: null
            };

            correctionRequests.unshift(newReq);
            saveState();
            updatePendingBadge();
            syncWithGoogleSheets(true);

            elements.modalCorrectionRequest.classList.remove('active');
            showToast('管理者に打刻修正申請を送信しました。承認をお待ちください。', 'success');
        });
    }

    // ==========================================================================
    // Staff Individual Shift Modal (個別シフト希望入力 & 総合シフト表へ自動集約)
    // ==========================================================================
    let currentShiftMonth = {
        year: new Date().getFullYear(),
        month: new Date().getMonth() + 1
    };
    let currentStaffShiftsCache = {};
    let isSavingStaffShift = false;

    // 開くボタン
    if (elements.btnOpenStaffShiftModal) {
        elements.btnOpenStaffShiftModal.addEventListener('click', () => {
            if (!selectedStaffId) {
                showToast('スタッフを選択してください。', 'warning');
                return;
            }
            const staff = staffs.find(s => s.id === selectedStaffId);
            if (!staff) return;

            // 初期化：今月に設定
            const now = new Date();
            currentShiftMonth = {
                year: now.getFullYear(),
                month: now.getMonth() + 1
            };

            // ヘッダー情報セット
            if (elements.staffShiftAvatar) {
                elements.staffShiftAvatar.style.backgroundColor = staff.color || 'var(--primary-color)';
            }
            if (elements.staffShiftCode) {
                elements.staffShiftCode.textContent = staff.code || staff.name.substring(0, 2);
            }
            if (elements.staffShiftModalTitle) {
                elements.staffShiftModalTitle.textContent = `${staff.name} さんのシフト希望入力`;
            }

            updateMonthSelectorButtons();
            loadAndRenderStaffShifts(staff);

            elements.modalStaffShift.classList.add('active');
            if (window.lucide) window.lucide.createIcons();
        });
    }

    if (elements.btnCloseStaffShift) {
        elements.btnCloseStaffShift.addEventListener('click', () => {
            elements.modalStaffShift.classList.remove('active');
        });
    }

    if (elements.btnCancelStaffShift) {
        elements.btnCancelStaffShift.addEventListener('click', () => {
            elements.modalStaffShift.classList.remove('active');
        });
    }

    function updateMonthSelectorButtons() {
        const now = new Date();
        const curY = now.getFullYear();
        const curM = now.getMonth() + 1;
        const nextDate = new Date(curY, curM, 1);
        const nextY = nextDate.getFullYear();
        const nextM = nextDate.getMonth() + 1;

        if (elements.btnShiftMonthCur) {
            elements.btnShiftMonthCur.textContent = `${curY}年${curM}月（今月）`;
            if (currentShiftMonth.year === curY && currentShiftMonth.month === curM) {
                elements.btnShiftMonthCur.classList.add('active');
            } else {
                elements.btnShiftMonthCur.classList.remove('active');
            }
        }
        if (elements.btnShiftMonthNext) {
            elements.btnShiftMonthNext.textContent = `${nextY}年${nextM}月（来月）`;
            if (currentShiftMonth.year === nextY && currentShiftMonth.month === nextM) {
                elements.btnShiftMonthNext.classList.add('active');
            } else {
                elements.btnShiftMonthNext.classList.remove('active');
            }
        }
    }

    if (elements.btnShiftMonthCur) {
        elements.btnShiftMonthCur.addEventListener('click', () => {
            const now = new Date();
            currentShiftMonth = { year: now.getFullYear(), month: now.getMonth() + 1 };
            updateMonthSelectorButtons();
            const staff = staffs.find(s => s.id === selectedStaffId);
            if (staff) loadAndRenderStaffShifts(staff);
        });
    }

    if (elements.btnShiftMonthNext) {
        elements.btnShiftMonthNext.addEventListener('click', () => {
            const now = new Date();
            const nextDate = new Date(now.getFullYear(), now.getMonth() + 1, 1);
            currentShiftMonth = { year: nextDate.getFullYear(), month: nextDate.getMonth() + 1 };
            updateMonthSelectorButtons();
            const staff = staffs.find(s => s.id === selectedStaffId);
            if (staff) loadAndRenderStaffShifts(staff);
        });
    }

    // GASから対象スタッフ・年月のシフトを取得
    function loadAndRenderStaffShifts(staff) {
        if (!elements.staffShiftDaysContainer) return;
        elements.staffShiftDaysContainer.innerHTML = `
            <div style="text-align: center; padding: 2.5rem 1rem; color: #64748b;">
                <div class="loading-spinner" style="margin: 0 auto 0.75rem auto; width: 26px; height: 26px; border-width: 3px;"></div>
                <div style="font-size: 0.85rem; font-weight: 600;">総合シフト表から予定データを読み込み中...</div>
            </div>
        `;

        if (!settings.gasUrl) {
            currentStaffShiftsCache = {};
            renderStaffShiftDaysTable(staff, currentStaffShiftsCache);
            return;
        }

        const callbackName = 'shiftCallback_' + Date.now();
        const scriptEl = document.createElement('script');
        let resolved = false;

        const cleanup = () => {
            if (resolved) return;
            resolved = true;
            try { delete window[callbackName]; } catch (e) {}
            try { if (scriptEl && scriptEl.parentNode) scriptEl.parentNode.removeChild(scriptEl); } catch (e) {}
        };

        const timer = setTimeout(() => {
            cleanup();
            // フォールバック: fetch
            const fetchUrl = `${settings.gasUrl}${settings.gasUrl.includes('?') ? '&' : '?'}action=getStaffMonthShift&staffName=${encodeURIComponent(staff.name)}&year=${currentShiftMonth.year}&month=${currentShiftMonth.month}`;
            fetch(fetchUrl)
                .then(r => r.json())
                .then(res => {
                    currentStaffShiftsCache = (res && res.data && res.data.shifts) ? res.data.shifts : {};
                    renderStaffShiftDaysTable(staff, currentStaffShiftsCache);
                })
                .catch(() => {
                    currentStaffShiftsCache = {};
                    renderStaffShiftDaysTable(staff, currentStaffShiftsCache);
                });
        }, 5000);

        window[callbackName] = function(resp) {
            clearTimeout(timer);
            cleanup();
            if (resp && resp.data && resp.data.shifts) {
                currentStaffShiftsCache = resp.data.shifts;
            } else {
                currentStaffShiftsCache = {};
            }
            renderStaffShiftDaysTable(staff, currentStaffShiftsCache);
        };

        scriptEl.onerror = function() {
            clearTimeout(timer);
            cleanup();
            currentStaffShiftsCache = {};
            renderStaffShiftDaysTable(staff, currentStaffShiftsCache);
        };

        const sep = settings.gasUrl.includes('?') ? '&' : '?';
        scriptEl.src = `${settings.gasUrl}${sep}action=getStaffMonthShift&staffName=${encodeURIComponent(staff.name)}&year=${currentShiftMonth.year}&month=${currentShiftMonth.month}&callback=${callbackName}&_t=${Date.now()}`;
        document.body.appendChild(scriptEl);
    }

    // テーブル生成
    const SHIFT_OPTIONS = [
        { label: '未定 / 空白', value: '' },
        { label: '10:00〜19:00（フル勤務）', value: '10:00〜19:00' },
        { label: '10:00〜13:00（午前のみ）', value: '10:00〜13:00' },
        { label: '17:00〜19:00（午後のみ）', value: '17:00〜19:00' },
        { label: '10:00〜13:00, 17:00〜19:00（中抜け）', value: '10:00〜13:00, 17:00〜19:00' },
        { label: '休（公休/希望休）', value: '休' },
        { label: 'その他（自由入力）', value: '__custom__' }
    ];

    function renderStaffShiftDaysTable(staff, shiftsObj) {
        const container = elements.staffShiftDaysContainer;
        if (!container) return;
        container.innerHTML = '';

        const y = currentShiftMonth.year;
        const m = currentShiftMonth.month;
        const daysInMonth = new Date(y, m, 0).getDate();
        const dowNames = ['日', '月', '火', '水', '木', '金', '土'];
        const today = new Date();
        const isCurrentMonth = (today.getFullYear() === y && (today.getMonth() + 1) === m);
        const todayDate = today.getDate();

        for (let d = 1; d <= daysInMonth; d++) {
            const dateObj = new Date(y, m - 1, d);
            const dow = dateObj.getDay();
            const isSat = (dow === 6);
            const isSun = (dow === 0);
            const isToday = (isCurrentMonth && d === todayDate);

            const row = document.createElement('div');
            row.className = `staff-shift-day-row ${isSat ? 'is-sat' : ''} ${isSun ? 'is-sun' : ''} ${isToday ? 'is-today' : ''}`;
            row.dataset.day = d;
            row.dataset.dow = dow;

            const currentVal = (shiftsObj && shiftsObj[d]) ? String(shiftsObj[d]).trim() : '';
            const isStandardOpt = SHIFT_OPTIONS.some(opt => opt.value !== '__custom__' && opt.value === currentVal);
            const isCustom = (!isStandardOpt && currentVal !== '');

            let selectHtml = `<select class="staff-shift-select ${currentVal === '休' ? 'is-off' : (currentVal ? 'is-work' : '')}" data-day="${d}">`;
            SHIFT_OPTIONS.forEach(opt => {
                let selected = false;
                if (opt.value === '__custom__') {
                    selected = isCustom;
                } else if (opt.value === currentVal) {
                    selected = true;
                }
                selectHtml += `<option value="${opt.value}" ${selected ? 'selected' : ''}>${opt.label}</option>`;
            });
            selectHtml += `</select>`;

            const customInputHtml = `
                <input type="text" class="staff-shift-custom-input ${isCustom ? '' : 'hidden'}" data-day="${d}" placeholder="自由入力" value="${isCustom ? currentVal : ''}">
            `;

            row.innerHTML = `
                <div class="staff-shift-date-badge">
                    <span>${m}/${d}</span>
                    <span class="staff-shift-dow">${dowNames[dow]}</span>
                    ${isToday ? '<span style="font-size:0.68rem; color:#ca8a04; font-weight:800;">本日</span>' : ''}
                </div>
                <div class="staff-shift-select-wrapper">
                    ${selectHtml}
                    ${customInputHtml}
                </div>
            `;

            container.appendChild(row);
        }

        // イベントバインド: セレクト変更時
        container.querySelectorAll('.staff-shift-select').forEach(sel => {
            sel.addEventListener('change', (e) => {
                const target = e.target;
                const d = target.dataset.day;
                const customInput = container.querySelector(`.staff-shift-custom-input[data-day="${d}"]`);
                if (target.value === '__custom__') {
                    if (customInput) {
                        customInput.classList.remove('hidden');
                        customInput.focus();
                    }
                    target.className = 'staff-shift-select';
                } else {
                    if (customInput) customInput.classList.add('hidden');
                    if (target.value === '休') {
                        target.className = 'staff-shift-select is-off';
                    } else if (target.value) {
                        target.className = 'staff-shift-select is-work';
                    } else {
                        target.className = 'staff-shift-select';
                    }
                }
            });
        });
    }

    // 一括入力ボタン
    if (elements.btnQuickFillWeekdayFull) {
        elements.btnQuickFillWeekdayFull.addEventListener('click', () => {
            quickFillShifts((dow) => (dow >= 1 && dow <= 5), '10:00〜19:00');
        });
    }
    if (elements.btnQuickFillWeekdayAm) {
        elements.btnQuickFillWeekdayAm.addEventListener('click', () => {
            quickFillShifts((dow) => (dow >= 1 && dow <= 5), '10:00〜13:00');
        });
    }
    if (elements.btnQuickFillSundayOff) {
        elements.btnQuickFillSundayOff.addEventListener('click', () => {
            quickFillShifts((dow) => (dow === 0), '休');
        });
    }
    if (elements.btnQuickFillClear) {
        elements.btnQuickFillClear.addEventListener('click', () => {
            if (confirm('入力されたシフトを全てクリア（空白）にしますか？')) {
                quickFillShifts(() => true, '');
            }
        });
    }

    function quickFillShifts(predicate, targetVal) {
        const rows = elements.staffShiftDaysContainer.querySelectorAll('.staff-shift-day-row');
        rows.forEach(r => {
            const dow = parseInt(r.dataset.dow, 10);
            if (predicate(dow)) {
                const sel = r.querySelector('.staff-shift-select');
                const customInput = r.querySelector('.staff-shift-custom-input');
                if (sel) {
                    sel.value = targetVal;
                    if (targetVal === '休') {
                        sel.className = 'staff-shift-select is-off';
                    } else if (targetVal) {
                        sel.className = 'staff-shift-select is-work';
                    } else {
                        sel.className = 'staff-shift-select';
                    }
                }
                if (customInput) {
                    customInput.classList.add('hidden');
                    customInput.value = '';
                }
            }
        });
    }

    // 保存ボタン処理
    if (elements.btnSubmitStaffShift) {
        elements.btnSubmitStaffShift.addEventListener('click', () => {
            if (isSavingStaffShift) return;
            const staff = staffs.find(s => s.id === selectedStaffId);
            if (!staff) {
                showToast('スタッフが選択されていません。', 'error');
                return;
            }

            // 日別値の集約
            const rows = elements.staffShiftDaysContainer.querySelectorAll('.staff-shift-day-row');
            const shiftsObj = {};
            rows.forEach(r => {
                const d = r.dataset.day;
                const sel = r.querySelector('.staff-shift-select');
                const customInput = r.querySelector('.staff-shift-custom-input');
                let val = '';
                if (sel) {
                    if (sel.value === '__custom__') {
                        val = customInput ? customInput.value.trim() : '';
                    } else {
                        val = sel.value;
                    }
                }
                shiftsObj[d] = val;
            });

            isSavingStaffShift = true;
            const originalBtnHtml = elements.btnSubmitStaffShift.innerHTML;
            elements.btnSubmitStaffShift.disabled = true;
            elements.btnSubmitStaffShift.innerHTML = `
                <div class="loading-spinner" style="width: 16px; height: 16px; border-width: 2px;"></div>
                総合シフト表へ保存中...
            `;

            const payload = {
                action: 'saveStaffShift',
                staffName: staff.name,
                year: currentShiftMonth.year,
                month: currentShiftMonth.month,
                shifts: shiftsObj
            };

            // GASへPOST
            if (!settings.gasUrl) {
                setTimeout(() => {
                    isSavingStaffShift = false;
                    elements.btnSubmitStaffShift.disabled = false;
                    elements.btnSubmitStaffShift.innerHTML = originalBtnHtml;
                    elements.modalStaffShift.classList.remove('active');
                    showToast('シフト希望を保存しました（ローカル）。', 'success');
                }, 600);
                return;
            }

            fetch(settings.gasUrl, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                body: JSON.stringify(payload)
            }).then(() => {
                isSavingStaffShift = false;
                elements.btnSubmitStaffShift.disabled = false;
                elements.btnSubmitStaffShift.innerHTML = originalBtnHtml;
                elements.modalStaffShift.classList.remove('active');
                showToast(`${staff.name} さんのシフトを総合シフト表へ反映しました！`, 'success');

                // 今月の本日分が変更された場合、アプリ内でも即時反映
                const now = new Date();
                const mKey = `${currentShiftMonth.year}-${String(currentShiftMonth.month).padStart(2, '0')}`;
                if (!monthFullShiftCache[mKey]) monthFullShiftCache[mKey] = {};
                for (const d in shiftsObj) {
                    if (!monthFullShiftCache[mKey][d]) monthFullShiftCache[mKey][d] = {};
                    monthFullShiftCache[mKey][d][staff.name] = shiftsObj[d];
                }

                if (currentShiftMonth.year === now.getFullYear() && currentShiftMonth.month === (now.getMonth() + 1)) {
                    const todayNum = now.getDate();
                    if (shiftsObj[todayNum] !== undefined) {
                        if (!todayShift) todayShift = {};
                        todayShift[staff.name] = shiftsObj[todayNum];
                        renderStaffGrid();
                    }
                }
                renderScheduleTimeline();

                // クラウドから最新データをフェッチして完全同期
                setTimeout(() => {
                    fetchCloudDataViaJsonp();
                }, 1000);
            }).catch(err => {
                console.error(err);
                isSavingStaffShift = false;
                elements.btnSubmitStaffShift.disabled = false;
                elements.btnSubmitStaffShift.innerHTML = originalBtnHtml;
                showToast('保存中にエラーが発生しました。通信環境をご確認ください。', 'error');
            });
        });
    }

    // Admin: Render Requests Tables (Pending & Processed)
    function renderRequestsTables() {
        updatePendingBadge();

        const pendingList = correctionRequests.filter(r => r.status === 'pending');
        const processedList = correctionRequests.filter(r => r.status !== 'pending');

        // Render Pending Requests
        elements.pendingRequestsTableBody.innerHTML = '';
        if (pendingList.length === 0) {
            elements.pendingRequestsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center" style="color: var(--text-muted); padding: 2rem;">
                        現在、未承認の修正依頼はありません。
                    </td>
                </tr>
            `;
        } else {
            pendingList.forEach(req => {
                const tr = document.createElement('tr');
                const createdTime = req.createdAt ? req.createdAt.replace('T', ' ').substring(0, 16) : '-';
                const timeDiff = `${req.checkin || '-'} 〜 ${req.checkout || '-'}`;
                
                tr.innerHTML = `
                    <td style="font-size:0.85rem; color:var(--text-muted);">${createdTime}</td>
                    <td style="font-weight:700;">${escapeHTML(req.staffName)}</td>
                    <td style="font-weight:600; color:var(--primary-dark);">${req.date}</td>
                    <td><span class="status-badge" style="background:#e0f2fe; color:#0369a1;">修正申請</span></td>
                    <td style="font-weight:600;"><span class="time-val">${timeDiff}</span></td>
                    <td style="font-size:0.85rem; color:#475569;">${escapeHTML(req.reason)}</td>
                    <td>
                        <div style="display:flex; gap:0.4rem;">
                            <button class="btn-approve btn-approve-request" data-id="${req.id}" title="承認して打刻データに反映">
                                <i data-lucide="check" style="width:14px;height:14px;"></i> 承認
                            </button>
                            <button class="btn-reject btn-reject-request" data-id="${req.id}" title="申請を却下">
                                <i data-lucide="x" style="width:14px;height:14px;"></i> 却下
                            </button>
                        </div>
                    </td>
                `;
                elements.pendingRequestsTableBody.appendChild(tr);
            });
        }

        // Render Processed Requests
        elements.processedRequestsTableBody.innerHTML = '';
        if (processedList.length === 0) {
            elements.processedRequestsTableBody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center" style="color: var(--text-muted); padding: 1.5rem;">
                        過去の処理履歴はありません。
                    </td>
                </tr>
            `;
        } else {
            processedList.slice(0, 30).forEach(req => {
                const tr = document.createElement('tr');
                const processedTime = req.processedAt ? req.processedAt.replace('T', ' ').substring(0, 16) : '-';
                const timeDiff = `${req.checkin || '-'} 〜 ${req.checkout || '-'}`;
                const resultBadge = req.status === 'approved' 
                    ? `<span class="status-badge status-online">承認済み</span>`
                    : `<span class="status-badge status-offline" style="background:#fee2e2; color:#b91c1c;">却下</span>`;

                tr.innerHTML = `
                    <td style="font-size:0.85rem; color:var(--text-muted);">${processedTime}</td>
                    <td style="font-weight:600;">${escapeHTML(req.staffName)}</td>
                    <td>${req.date}</td>
                    <td><span class="time-val">${timeDiff}</span></td>
                    <td style="font-size:0.85rem; color:#475569;">${escapeHTML(req.reason)}</td>
                    <td>${resultBadge}</td>
                `;
                elements.processedRequestsTableBody.appendChild(tr);
            });
        }

        if (window.lucide) window.lucide.createIcons();

        // Bind Action Buttons
        document.querySelectorAll('.btn-approve-request').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const reqId = e.currentTarget.dataset.id;
                approveCorrectionRequest(reqId);
            });
        });

        document.querySelectorAll('.btn-reject-request').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const reqId = e.currentTarget.dataset.id;
                rejectCorrectionRequest(reqId);
            });
        });
    }

    // Approve Logic: Updates records directly!
    function approveCorrectionRequest(reqId) {
        const req = correctionRequests.find(r => r.id === reqId);
        if (!req) return;

        // Find existing record or create new one
        let rec = records.find(r => (r.staffId === req.staffId || r.staffName === req.staffName) && r.date === req.date);
        
        if (rec) {
            if (req.checkin) rec.checkin = req.checkin.length === 5 ? req.checkin + ':00' : req.checkin;
            if (req.checkout) rec.checkout = req.checkout.length === 5 ? req.checkout + ':00' : req.checkout;
            rec.isCorrected = true;
            rec.correctionReason = req.reason;

            // Recalculate duration
            if (rec.checkin && rec.checkout) {
                const parsedIn = parseTimeToDate(rec.date, rec.checkin);
                const parsedOut = parseTimeToDate(rec.date, rec.checkout);
                let durMs = parsedOut - parsedIn;
                if (durMs < 0) durMs = 0;
                rec.duration = Math.floor(durMs / (1000 * 60));
            }
        } else {
            // Create new record for missed day
            const inTime = req.checkin ? (req.checkin.length === 5 ? req.checkin + ':00' : req.checkin) : '09:00:00';
            const outTime = req.checkout ? (req.checkout.length === 5 ? req.checkout + ':00' : req.checkout) : null;
            let workDur = 0;
            if (inTime && outTime) {
                const parsedIn = parseTimeToDate(req.date, inTime);
                const parsedOut = parseTimeToDate(req.date, outTime);
                const durMs = parsedOut - parsedIn;
                if (durMs > 0) workDur = Math.floor(durMs / (1000 * 60));
            }

            rec = {
                id: `rec-${Date.now()}`,
                date: req.date,
                staffId: req.staffId,
                staffName: req.staffName,
                checkin: inTime,
                breakStart: null,
                breakEnd: null,
                checkout: outTime,
                duration: workDur,
                points: workDur >= 360 ? 3 : (workDur >= 180 ? 2 : 0),
                peerReceiverId: null,
                peerReceiverName: null,
                peerPoints: 0,
                overtimeReason: null,
                isCorrected: true,
                correctionReason: req.reason
            };
            records.unshift(rec);
        }

        req.status = 'approved';
        req.processedAt = new Date().toISOString();

        saveState();
        renderRequestsTables();
        renderRecordsTable();
        syncWithGoogleSheets(true);
        showToast(`${req.staffName}さんの打刻修正を承認し、打刻履歴に反映しました！`, 'success');
    }

    // Reject Logic
    function rejectCorrectionRequest(reqId) {
        const req = correctionRequests.find(r => r.id === reqId);
        if (!req) return;

        req.status = 'rejected';
        req.processedAt = new Date().toISOString();

        saveState();
        renderRequestsTables();
        syncWithGoogleSheets(true);
        showToast(`${req.staffName}さんの修正申請を却下しました。`, 'warning');
    }

    // ==========================================================================
    // Admin Module: Staff Management
    // ==========================================================================
    elements.formAddStaff.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = elements.newStaffName.value.trim();
        if (!name) return;

        // Randomize beautiful HSL color for avatar
        const hue = Math.floor(Math.random() * 360);
        const color = `hsl(${hue}, 70%, 45%)`;

        const newStaff = {
            id: `st-${Date.now()}`,
            name: name,
            status: 'offline',
            avatarColor: color
        };

        const en = elements.newStaffEn ? elements.newStaffEn.value.trim() : '';
        if (en) {
            KNOWN_STAFF_PROFILES[name] = {
                en: en,
                code: en.replace(/[^A-Za-z]/g, '').substring(0, 2).toUpperCase() || 'ST',
                theme: THEME_CYCLE[Math.floor(Math.random() * THEME_CYCLE.length)]
            };
        }

        staffs.push(newStaff);
        
        // Initialize points ledger
        pointLedger[newStaff.id] = { current: 0, lifetime: 0 };

        saveState();
        renderAdminStaffTable();
        renderStaffGrid();
        elements.newStaffName.value = '';
        if (elements.newStaffEn) elements.newStaffEn.value = '';
        showToast(`${name}さんをスタッフとして登録しました。`, 'success');
    });

    function renderAdminStaffTable() {
        elements.adminStaffTableBody.innerHTML = '';
        
        staffs.forEach((staff, index) => {
            const tr = document.createElement('tr');
            const profile = getStaffDisplayProfile(staff);
            
            // 状態表示: 出勤中（緑）/ 休憩中（オレンジ）/ 未出勤・退勤（ピンク）
            let stateBadge = `<span style="display: inline-block; padding: 2px 8px; font-size: 0.72rem; font-weight: 700; border-radius: 999px; background: #fff1f2; color: #e11d48; border: 1px solid #fecdd3;">退勤</span>`;
            if (staff.status === 'online') {
                stateBadge = `<span style="display: inline-block; padding: 2px 8px; font-size: 0.72rem; font-weight: 700; border-radius: 999px; background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0;">出勤中</span>`;
            } else if (staff.status === 'break') {
                stateBadge = `<span style="display: inline-block; padding: 2px 8px; font-size: 0.72rem; font-weight: 700; border-radius: 999px; background: #fffbeb; color: #d97706; border: 1px solid #fde68a;">休憩中</span>`;
            }

            const isFirst = index === 0;
            const isLast = index === staffs.length - 1;

            tr.innerHTML = `
                <td style="text-align: center;">
                    <div style="display: flex; gap: 4px; justify-content: center;">
                        <button type="button" class="btn btn-secondary btn-move-staff" data-index="${index}" data-dir="-1" ${isFirst ? 'disabled style="opacity:0.25; cursor:not-allowed;"' : ''} title="上へ移動" style="padding: 3px 6px; font-size: 0.75rem;">
                            <i data-lucide="chevron-up" style="width: 14px; height: 14px;"></i>
                        </button>
                        <button type="button" class="btn btn-secondary btn-move-staff" data-index="${index}" data-dir="1" ${isLast ? 'disabled style="opacity:0.25; cursor:not-allowed;"' : ''} title="下へ移動" style="padding: 3px 6px; font-size: 0.75rem;">
                            <i data-lucide="chevron-down" style="width: 14px; height: 14px;"></i>
                        </button>
                    </div>
                </td>
                <td>
                    <div style="display: flex; align-items: center; gap: 8px;">
                        <div class="staff-card-avatar ${profile.theme}" style="width: 2.1rem; height: 2.1rem; font-size: 0.75rem; flex-shrink: 0;">
                            <span>${escapeHTML(profile.code)}</span>
                        </div>
                        <div>
                            <div style="font-weight: 700; font-size: 0.9rem; color: #0f172a;">${escapeHTML(staff.name)}</div>
                            <div style="font-size: 0.75rem; color: #64748b; font-family: 'Plus Jakarta Sans', sans-serif;">${escapeHTML(profile.en)}</div>
                        </div>
                    </div>
                </td>
                <td style="text-align: center;">${stateBadge}</td>
                <td style="text-align: center;">
                    <div style="display: flex; gap: 6px; justify-content: center;">
                        <button type="button" class="btn btn-secondary btn-edit-staff" data-id="${staff.id}" style="padding: 5px 8px; font-size: 0.75rem;" title="情報を編集">
                            <i data-lucide="pencil" style="width: 13px; height: 13px;"></i> 編集
                        </button>
                        <button type="button" class="btn btn-secondary btn-danger btn-delete-staff" data-id="${staff.id}" style="padding: 5px 8px; font-size: 0.75rem;" title="削除">
                            <i data-lucide="trash-2" style="width: 13px; height: 13px;"></i>
                        </button>
                    </div>
                </td>
            `;
            elements.adminStaffTableBody.appendChild(tr);
        });

        if (window.lucide) lucide.createIcons();

        // 並び替え（上へ/下へ）ハンドラー
        document.querySelectorAll('.btn-move-staff').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const idx = parseInt(e.currentTarget.dataset.index, 10);
                const dir = parseInt(e.currentTarget.dataset.dir, 10);
                const targetIdx = idx + dir;
                if (targetIdx < 0 || targetIdx >= staffs.length) return;
                
                const temp = staffs[idx];
                staffs[idx] = staffs[targetIdx];
                staffs[targetIdx] = temp;
                
                saveState();
                renderAdminStaffTable();
                renderStaffGrid();
            });
        });

        // 編集ボタンハンドラー
        document.querySelectorAll('.btn-edit-staff').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const staffId = e.currentTarget.dataset.id;
                const staff = staffs.find(s => s.id === staffId);
                if (!staff) return;
                const profile = getStaffDisplayProfile(staff);

                elements.editStaffId.value = staff.id;
                elements.editStaffName.value = staff.name;
                elements.editStaffEn.value = profile.en || '';
                elements.editStaffCode.value = profile.code || '';
                elements.editStaffSub.value = profile.sub || '';

                elements.modalEditStaff.classList.add('active');
                if (window.lucide) lucide.createIcons();
            });
        });

        // 削除ボタンハンドラー
        document.querySelectorAll('.btn-delete-staff').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const staffId = e.currentTarget.dataset.id;
                const staff = staffs.find(s => s.id === staffId);
                if (!staff) return;

                if (confirm(`${staff.name}さんを削除してもよろしいですか？\n※この操作は元に戻せません。`)) {
                    staffs = staffs.filter(s => s.id !== staffId);
                    delete pointLedger[staffId];
                    
                    saveState();
                    renderAdminStaffTable();
                    renderStaffGrid();
                    showToast(`${staff.name}さんを削除しました。`, 'warning');
                }
            });
        });
    }

    // スタッフ編集モーダルのイベント
    if (elements.formEditStaff) {
        elements.formEditStaff.addEventListener('submit', (e) => {
            e.preventDefault();
            const staffId = elements.editStaffId.value;
            const staff = staffs.find(s => s.id === staffId);
            if (!staff) return;

            const newName = elements.editStaffName.value.trim();
            const newEn = elements.editStaffEn.value.trim();
            const newCode = elements.editStaffCode.value.trim().toUpperCase();
            const newSub = elements.editStaffSub.value.trim();

            if (!newName) return;

            staff.name = newName;
            
            // プロフィール定義を更新
            KNOWN_STAFF_PROFILES[newName] = {
                en: newEn || newName,
                code: newCode || newName.substring(0, 2).toUpperCase(),
                theme: (KNOWN_STAFF_PROFILES[newName]?.theme) || THEME_CYCLE[Math.floor(Math.random() * THEME_CYCLE.length)],
                sub: newSub || null
            };

            saveState();
            renderAdminStaffTable();
            renderStaffGrid();
            elements.modalEditStaff.classList.remove('active');
            showToast(`${newName}さんの情報を更新しました！`, 'success');
        });
    }

    if (elements.btnCloseEditStaff) {
        elements.btnCloseEditStaff.addEventListener('click', () => {
            elements.modalEditStaff.classList.remove('active');
        });
    }
    if (elements.btnCancelEditStaff) {
        elements.btnCancelEditStaff.addEventListener('click', () => {
            elements.modalEditStaff.classList.remove('active');
        });
    }

    // ==========================================================================
    // Admin Module: Points & Welfare Settings
    // ==========================================================================
    // Handle point adjustment (Addition or Subtraction)
    elements.formUsePoints.addEventListener('submit', (e) => {
        e.preventDefault();
        const staffId = elements.selectPointStaff.value;
        const amount = parseInt(elements.pointAmountInput.value, 10);
        const reason = elements.pointReasonInput.value.trim();

        if (!staffId || isNaN(amount) || amount === 0 || !reason) {
            showToast('正しい調整ポイント数（0以外）を入力してください。', 'warning');
            return;
        }

        const staff = staffs.find(s => s.id === staffId);
        if (!staff) return;

        const ledger = pointLedger[staffId] || { current: 0, lifetime: 0 };
        
        // Subtraction bounds check
        if (amount < 0 && ledger.current < Math.abs(amount)) {
            showToast(`ポイントが不足しています。 (保有: ${ledger.current}pt、減算値: ${Math.abs(amount)}pt)`, 'warning');
            return;
        }

        // Adjust points
        ledger.current += amount;
        if (amount > 0) {
            ledger.lifetime += amount;
        }
        pointLedger[staffId] = ledger;

        // Log point adjustment
        pointLogs.unshift({
            id: `pt-${Date.now()}`,
            timestamp: new Date().toISOString(),
            staffId: staffId,
            staffName: staff.name,
            action: amount > 0 ? 'earn' : 'use',
            points: Math.abs(amount),
            reason: `手動調整: ${reason}`
        });

        saveState();
        renderPointsView();
        
        // Reset form
        elements.pointAmountInput.value = '';
        elements.pointReasonInput.value = '';
        elements.selectPointStaff.value = '';
        
        showToast(`${staff.name}さんのポイントを調整しました。(${amount}pt)`, 'success');
    });

    // Save GAS Settings & Sync Now
    if (elements.btnSaveGas) {
        elements.btnSaveGas.addEventListener('click', () => {
            const url = elements.gasUrlInput.value.trim();
            settings.gasUrl = url;
            saveState();
            showToast('Googleスプレッドシート連携URLを保存しました。同期をテストします...', 'success');
            syncWithGoogleSheets(false);
        });
    }

    // Save Calendar Settings
    if (elements.btnSaveCalendarId) {
        elements.btnSaveCalendarId.addEventListener('click', () => {
            const calId = (elements.inputCalendarId ? elements.inputCalendarId.value : '').trim();
            if (!calId) {
                showToast('カレンダーIDを入力してください。', 'warning');
                return;
            }
            settings.calendarId = calId;
            saveState();
            showToast(`カレンダーID（${calId}）を保存しました。最新予定を取得します...`, 'success');
            fetchCloudDataViaJsonp();
        });
    }

    if (elements.btnSyncNow) {
        elements.btnSyncNow.addEventListener('click', () => {
            fetchCloudDataViaJsonp().then(() => syncWithGoogleSheets(false));
        });
    }

    if (elements.cloudSyncPill) {
        elements.cloudSyncPill.addEventListener('click', () => {
            fetchCloudDataViaJsonp().then(() => syncWithGoogleSheets(false));
        });
    }
 
    function renderPointsView() {
        // Show current GAS URL & Calendar ID
        elements.gasUrlInput.value = settings.gasUrl || '';
        if (elements.inputCalendarId) {
            elements.inputCalendarId.value = settings.calendarId || 'honmachifc@gmail.com';
        }

        // Render Dropdown staff selection
        elements.selectPointStaff.innerHTML = '<option value="">スタッフを選択...</option>';
        staffs.forEach(s => {
            const opt = document.createElement('option');
            opt.value = s.id;
            opt.textContent = `${s.name} (保有: ${pointLedger[s.id]?.current || 0}pt)`;
            elements.selectPointStaff.appendChild(opt);
        });

        // Render Point Ledger Table
        elements.pointsTableBody.innerHTML = '';
        staffs.forEach(s => {
            const ledger = pointLedger[s.id] || { current: 0, lifetime: 0 };
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="font-weight: 600;">${escapeHTML(s.name)}</td>
                <td style="font-weight: 700; color: var(--primary-dark);">${ledger.current} pt</td>
                <td style="color: var(--text-muted);">${ledger.lifetime} pt</td>
            `;
            elements.pointsTableBody.appendChild(tr);
        });

        // Render Logs
        elements.pointLogsTableBody.innerHTML = '';
        if (pointLogs.length === 0) {
            elements.pointLogsTableBody.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center" style="color: var(--text-muted);">
                        ポイント履歴はありません。
                    </td>
                </tr>
            `;
            return;
        }

        pointLogs.forEach(log => {
            const tr = document.createElement('tr');
            const dateStr = new Date(log.timestamp).toLocaleString('ja-JP');
            
            let actionBadge = '';
            let amountText = '';
            
            if (log.action === 'earn') {
                actionBadge = '<span class="status-badge status-online">獲得</span>';
                amountText = `<span style="color: var(--success); font-weight: 600;">+${log.points} pt</span>`;
            } else {
                actionBadge = '<span class="status-badge status-break">消費</span>';
                amountText = `<span style="color: var(--danger); font-weight: 600;">-${log.points} pt</span>`;
            }

            tr.innerHTML = `
                <td>${dateStr}</td>
                <td style="font-weight: 600;">${escapeHTML(log.staffName)}</td>
                <td>${actionBadge}</td>
                <td>${amountText}</td>
                <td>${log.reason}</td>
            `;
            elements.pointLogsTableBody.appendChild(tr);
        });
    }

    // ==========================================================================
    // App Initialization & Multi-PC Synchronization Loops
    // ==========================================================================
    reconcileStaffStatusFromRecords();
    renderStaffGrid();
    renderTodayCalendarBanner();
    lucide.createIcons();
    elements.btnClosePanel.addEventListener('click', closeControlPanel);

    // Initial Cloud Sync
    if (settings.gasUrl) {
        // 未送信レコードを即座にクラウドへ送信し、その後最新データを取得
        syncWithGoogleSheets(true).then(() => {
            fetchCloudDataViaJsonp();
        });

        // 定期自動同期（15秒ごとに他のPCでの打刻・出退勤状態を取得して同期）
        setInterval(() => {
            fetchCloudDataViaJsonp();
        }, 15000);

        // 画面にフォーカスが戻った時にも即座にチェック
        window.addEventListener('focus', () => {
            fetchCloudDataViaJsonp();
        });
    } else {
        setSyncStatus('idle', 'クラウド未連携');
    }
});
