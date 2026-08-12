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
        { id: 'st-11', name: '看護師１', status: 'offline', avatarColor: 'hsl(320, 80%, 50%)' },
        { id: 'st-12', name: '看護師２', status: 'offline', avatarColor: 'hsl(340, 80%, 50%)' },
        { id: 'st-13', name: '医療事務１', status: 'offline', avatarColor: 'hsl(130, 70%, 40%)' },
        { id: 'st-14', name: '医療事務２', status: 'offline', avatarColor: 'hsl(160, 70%, 40%)' }
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
    let settings = store.get('settings', {
        pointRate: 10, // points per hour
        adminPassword: 'admin',
        gasUrl: ''
    });

    // マイグレーション：古いテスト用スタッフ「佐藤 健」が残っている場合、実在スタッフへ強制リセットする
    if (staffs.some(s => s.name === '佐藤 健')) {
        localStorage.removeItem('clinic_flow_staffs');
        localStorage.removeItem('clinic_flow_point_ledger');
        localStorage.removeItem('clinic_flow_point_logs');
        localStorage.removeItem('clinic_flow_records');
        staffs = DEFAULT_STAFFS;
        pointLedger = {
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
        };
        pointLogs = [];
        records = [];
        store.set('staffs', staffs);
        store.set('point_ledger', pointLedger);
        store.set('point_logs', pointLogs);
        store.set('records', records);
    }

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
        recordsTableBody: document.getElementById('records-table-body'),
        
        // Admin: Staff management
        formAddStaff: document.getElementById('form-add-staff'),
        newStaffName: document.getElementById('new-staff-name'),
        adminStaffTableBody: document.getElementById('admin-staff-table-body'),
        
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
        
        // Peer Gift Modal
        modalPeerGift: document.getElementById('modal-peer-gift'),
        peerGiftMessage: document.getElementById('peer-gift-message'),
        formPeerGift: document.getElementById('form-peer-gift'),
        selectGiftReceiver: document.getElementById('select-gift-receiver'),
        selectGiftAmount: document.getElementById('select-gift-amount'),
        giftMessage: document.getElementById('gift-message'),
        
        // Toast
        toastContainer: document.getElementById('toast-container')
    };

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

    // Render staff cards in the main screen
    function renderStaffGrid() {
        elements.staffGrid.innerHTML = '';
        
        staffs.forEach(staff => {
            const card = document.createElement('div');
            card.className = `staff-card ${selectedStaffId === staff.id ? 'active-selection' : ''}`;
            card.dataset.id = staff.id;
            
            // Build status HTML
            let statusText = '未出勤';
            let statusClass = 'status-offline';
            if (staff.status === 'online') {
                statusText = '勤務中';
                statusClass = 'status-online';
            } else if (staff.status === 'break') {
                statusText = '休憩中';
                statusClass = 'status-break';
            }

            const initial = staff.name.charAt(0);

            card.innerHTML = `
                <div class="staff-card-avatar" style="border: 2px solid ${staff.avatarColor || '#0052cc'}; color: ${staff.avatarColor || '#0052cc'}">
                    <span>${initial}</span>
                </div>
                <div class="staff-card-name">${escapeHTML(staff.name)}</div>
                <div class="status-badge ${statusClass}">${statusText}</div>
            `;

            card.addEventListener('click', () => selectStaff(staff.id));
            elements.staffGrid.appendChild(card);
        });

        updateBreakIndicator();
    }

    // ==========================================================================
    // Attendance Controls Logic
    // ==========================================================================
    function selectStaff(staffId) {
        selectedStaffId = staffId;
        
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

        // Set Info
        elements.activeStaffName.textContent = staff.name;
        elements.activeStaffInitial.textContent = staff.name.charAt(0);
        elements.activeStaffAvatar.style.backgroundColor = staff.avatarColor || 'var(--primary-light)';
        elements.activeStaffAvatar.style.color = staff.avatarColor ? '#fff' : 'var(--primary)';

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

    function getTodayRecord(staffId) {
        return records.find(r => r.staffId === staffId && r.date === todayStr);
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
            date: todayStr,
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
        showToast(`${staff.name}さん、おはようございます。出勤を記録しました。`, 'success');
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

        // If earned points, intercept checkout to show 360 degree feedback gift modal
        if (pointsEarned > 0) {
            pendingCheckout = { staff, record, pointsEarned };
            
            // Populate peer gift modal fields
            elements.peerGiftMessage.textContent = `本日の勤務で ${pointsEarned} ポイント獲得しました。`;
            
            // Populate receivers (excluding self)
            elements.selectGiftReceiver.innerHTML = '<option value="">スタッフを選択...</option>';
            staffs.filter(s => s.id !== staff.id).forEach(s => {
                const opt = document.createElement('option');
                opt.value = s.id;
                opt.textContent = s.name;
                elements.selectGiftReceiver.appendChild(opt);
            });

            // Populate points select (0 to pointsEarned)
            elements.selectGiftAmount.innerHTML = '';
            for (let i = pointsEarned; i >= 0; i--) {
                const opt = document.createElement('option');
                opt.value = i;
                opt.textContent = `${i} pt`;
                elements.selectGiftAmount.appendChild(opt);
            }
            elements.selectGiftReceiver.required = true; // default points is > 0

            // Show gift modal
            elements.modalPeerGift.classList.add('active');
            closeControlPanel();
            renderStaffGrid();
        } else {
            // Instant checkout with no points
            saveState();
            renderStaffGrid();
            closeControlPanel();
            sendToGoogleSheets(record);
            showToast(`${staff.name}さん、お疲れ様でした。退勤を記録しました。(勤務時間: ${(workMinutes/60).toFixed(1)}時間、ポイント獲得なし)`, 'success');
        }
    });

    // Watch gift points select to dynamically toggle receiver input requirement
    elements.selectGiftAmount.addEventListener('change', () => {
        const amt = parseInt(elements.selectGiftAmount.value, 10);
        elements.selectGiftReceiver.required = (amt > 0);
    });

    // Handle peer gift submit
    elements.formPeerGift.addEventListener('submit', (e) => {
        e.preventDefault();
        if (!pendingCheckout) return;

        const { staff, record, pointsEarned } = pendingCheckout;
        const receiverId = elements.selectGiftReceiver.value;
        const giftPoints = parseInt(elements.selectGiftAmount.value, 10);
        const msg = elements.giftMessage.value.trim();

        if (giftPoints > 0) {
            if (!receiverId) {
                showToast('贈る相手を選択してください。', 'warning');
                return;
            }

            const receiver = staffs.find(s => s.id === receiverId);
            if (!receiver) return;

            // Record update
            record.peerReceiverId = receiver.id;
            record.peerReceiverName = receiver.name;
            record.peerPoints = giftPoints;

            // Credit points to the receiver's ledger
            if (!pointLedger[receiver.id]) {
                pointLedger[receiver.id] = { current: 0, lifetime: 0 };
            }
            pointLedger[receiver.id].current += giftPoints;
            pointLedger[receiver.id].lifetime += giftPoints;

            // Create log entry for peer gift
            pointLogs.unshift({
                id: `pt-${Date.now()}`,
                timestamp: new Date().toISOString(),
                staffId: receiver.id,
                staffName: receiver.name,
                action: 'earn',
                points: giftPoints,
                reason: `${staff.name}さんからの360度評価: ${msg || '感謝のポイント'}`
            });
        }

        // Save state and update UI
        saveState();
        renderStaffGrid();
        sendToGoogleSheets(record);

        // Close modal and reset form fields
        elements.modalPeerGift.classList.remove('active');
        elements.selectGiftReceiver.value = '';
        elements.selectGiftAmount.value = '';
        elements.giftMessage.value = '';

        const giftReceiverName = record.peerReceiverName;
        pendingCheckout = null;

        if (giftPoints > 0) {
            showToast(`${staff.name}さんの退勤を記録し、${giftReceiverName}さんへ ${giftPoints}pt を贈りました！`, 'success');
        } else {
            showToast(`${staff.name}さんの退勤を記録しました。(ポイントは贈りませんでした)`, 'success');
        }
    });

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
        store.set('settings', settings);
    }

    // Send attendance & points data to Google Sheets via GAS
    function sendToGoogleSheets(record) {
        if (!settings.gasUrl) {
            console.log("GAS URL is not configured. Skipping Google Sheets upload.");
            return;
        }

        fetch(settings.gasUrl, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(record)
        })
        .then(() => {
            console.log("Successfully queued send to Google Sheets.");
            showToast("Googleスプレッドシートへ同期しました。", "success");
        })
        .catch(err => {
            console.error("Failed to send data to Google Sheets:", err);
            showToast("スプレッドシート同期に失敗しました。", "warning");
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
            if (!startDate && !endDate) return true;
            if (startDate && !endDate) return r.date >= startDate;
            if (!startDate && endDate) return r.date <= endDate;
            return r.date >= startDate && r.date <= endDate;
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
            tr.innerHTML = `
                <td>${r.date}</td>
                <td style="font-weight: 600;">${r.staffName}</td>
                <td><span class="time-val">${r.checkin || '-'}</span></td>
                <td><span class="time-val">${r.breakStart || '-'}</span></td>
                <td><span class="time-val">${r.breakEnd || '-'}</span></td>
                <td><span class="time-val">${r.checkout || '-'}</span></td>
                <td>${r.checkout ? `${hrs} 時間 (${r.duration}分)` : '-'}</td>
                <td style="font-weight: 600; color: var(--primary-dark);">${r.points ? `+${r.points} pt` : '-'}</td>
                <td style="font-weight: 600;">${r.peerReceiverName || '-'}</td>
                <td style="font-weight: 600; color: var(--warning);">${r.peerPoints ? `-${r.peerPoints} pt` : '-'}</td>
            `;
            elements.recordsTableBody.appendChild(tr);
        });
    }

    // Export CSV (Filtered by selected range)
    elements.btnExportCsv.addEventListener('click', () => {
        const startDate = elements.filterStartDate.value;
        const endDate = elements.filterEndDate.value;

        const filteredRecords = records.filter(r => {
            if (!startDate && !endDate) return true;
            if (startDate && !endDate) return r.date >= startDate;
            if (!startDate && endDate) return r.date <= endDate;
            return r.date >= startDate && r.date <= endDate;
        });

        if (filteredRecords.length === 0) {
            showToast('指定期間のエクスポートするデータがありません。', 'warning');
            return;
        }

        // CSV Header
        let csvContent = '\uFEFF'; // UTF-8 BOM to prevent Excel encoding issues
        csvContent += '日付,スタッフ名,出勤時刻,休憩開始時刻,休憩終了時刻,退勤時刻,実労働時間(分),獲得ポイント,贈った相手,贈ったポイント\r\n';

        filteredRecords.forEach(r => {
            const row = [
                r.date,
                r.staffName,
                r.checkin || '',
                r.breakStart || '',
                r.breakEnd || '',
                r.checkout || '',
                r.duration || 0,
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

        staffs.push(newStaff);
        
        // Initialize points ledger
        pointLedger[newStaff.id] = { current: 0, lifetime: 0 };

        saveState();
        renderAdminStaffTable();
        elements.newStaffName.value = '';
        showToast(`${name}さんをスタッフとして登録しました。`, 'success');
    });

    function renderAdminStaffTable() {
        elements.adminStaffTableBody.innerHTML = '';
        
        staffs.forEach(staff => {
            const tr = document.createElement('tr');
            
            // Build state text
            let stateBadge = `<span class="status-badge status-offline">未出勤</span>`;
            if (staff.status === 'online') {
                stateBadge = `<span class="status-badge status-online">勤務中</span>`;
            } else if (staff.status === 'break') {
                stateBadge = `<span class="status-badge status-break">休憩中</span>`;
            }

            tr.innerHTML = `
                <td style="font-weight: 600;">${escapeHTML(staff.name)}</td>
                <td>${stateBadge}</td>
                <td>
                    <button class="btn btn-secondary btn-danger btn-delete-staff" data-id="${staff.id}">
                        <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i> 削除
                    </button>
                </td>
            `;
            elements.adminStaffTableBody.appendChild(tr);
        });

        lucide.createIcons();

        // Bind delete buttons
        document.querySelectorAll('.btn-delete-staff').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const staffId = e.currentTarget.dataset.id;
                const staff = staffs.find(s => s.id === staffId);
                if (!staff) return;

                if (confirm(`${staff.name}さんを削除してもよろしいですか？\n※この操作は元に戻せません。`)) {
                    staffs = staffs.filter(s => s.id !== staffId);
                    // Cleanup points
                    delete pointLedger[staffId];
                    
                    saveState();
                    renderAdminStaffTable();
                    showToast(`${staff.name}さんを削除しました。`, 'warning');
                }
            });
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

    // Save GAS Settings
    elements.btnSaveGas.addEventListener('click', () => {
        const url = elements.gasUrlInput.value.trim();
        settings.gasUrl = url;
        saveState();
        showToast('Googleスプレッドシート連携URLを保存しました。', 'success');
    });
 
    function renderPointsView() {
        // Show current GAS URL
        elements.gasUrlInput.value = settings.gasUrl || '';

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
    // App Initialization
    // ==========================================================================
    renderStaffGrid();
    lucide.createIcons();
    elements.btnClosePanel.addEventListener('click', closeControlPanel);
});
