/**
 * EduBridge Active Time Tracking System
 * Measures real user engagement by monitoring visibility and activity.
 */

const ActiveTimeTracker = (function() {
    // Configuration
    const IDLE_TIMEOUT = 10000; // 10 seconds of no activity = idle
    const TRACK_INTERVAL = 1000; // Update every 1 second
    
    // State
    let lastActivityTime = Date.now();
    let isUserActive = true;
    let isTabVisible = document.visibilityState === 'visible';
    
    // Page Info
    const pageName = window.location.pathname.split('/').pop() || 'index.html';

    // Storage Keys
    const TOTAL_TIME_KEY = 'activeTime_total';
    const TODAY_PREFIX = 'activeTime_day_';
    const PAGE_TIME_KEY = `activeTime_${pageName}`;
    const STATS_KEY = 'edubridge_stats';

    /**
     * Get key for today's date (YYYY-MM-DD)
     */
    function getTodayKey() {
        return TODAY_PREFIX + new Date().toISOString().split('T')[0];
    }

    /**
     * Initialize or Get Stats
     */
    function getStoredValue(key) {
        return parseInt(localStorage.getItem(key) || '0', 10);
    }

    function updateStorage(key, incrementMs) {
        const current = getStoredValue(key);
        localStorage.setItem(key, (current + incrementMs).toString());
    }

    /**
     * Activity Handlers
     */
    function resetIdleTimer() {
        if (!isUserActive) {
            console.log('[Analytics] User became active');
            isUserActive = true;
        }
        lastActivityTime = Date.now();
    }

    /**
     * Setup Listeners
     */
    function setupListeners() {
        // Visibility API
        document.addEventListener('visibilitychange', () => {
            isTabVisible = document.visibilityState === 'visible';
            console.log(`[Analytics] Visibility changed: ${isTabVisible ? 'visible' : 'hidden'}`);
            if (isTabVisible) resetIdleTimer();
        });

        // User activity events: mousemove, click, scroll, keydown
        ['mousemove', 'click', 'scroll', 'keydown'].forEach(event => {
            document.addEventListener(event, resetIdleTimer, { passive: true });
        });
    }

    /**
     * Core Tracking Loop
     */
    function startTracking() {
        setInterval(() => {
            const now = Date.now();
            
            // Check for idleness (if more than 10 seconds pass since last activity)
            if (now - lastActivityTime > IDLE_TIMEOUT) {
                if (isUserActive) {
                    console.log('[Analytics] User is now idle');
                    isUserActive = false;
                }
            }

            // ONLY increment if tab is visible AND user is active
            if (isTabVisible && isUserActive) {
                // 1. Update millisecond counters in localStorage
                updateStorage(TOTAL_TIME_KEY, TRACK_INTERVAL);
                updateStorage(getTodayKey(), TRACK_INTERVAL);
                updateStorage(PAGE_TIME_KEY, TRACK_INTERVAL);

                // 2. Sync with existing dashboard stats (which expects seconds)
                syncWithLegacyStats();

                // 3. Trigger immediate UI updates if the dashboard is active
                if (window.updateDashboardStats) {
                    window.updateDashboardStats();
                }
            }
        }, TRACK_INTERVAL);
    }

    /**
     * Maintain compatibility with dashboard.js by syncing the current active totals
     */
    function syncWithLegacyStats() {
        let stats = JSON.parse(localStorage.getItem(STATS_KEY)) || { 
            timeSpent: {}, 
            interactions: { 
                classesJoined: 0, notesViewed: 0, notesDownloaded: 0, 
                assignmentsSubmitted: 0, quizzesStarted: 0 
            },
            recentActivity: []
        };
        
        // Sync current page's active time (converted to seconds)
        const pageSeconds = Math.floor(getStoredValue(PAGE_TIME_KEY) / 1000);
        stats.timeSpent[pageName] = pageSeconds;
        
        localStorage.setItem(STATS_KEY, JSON.stringify(stats));
    }

    /**
     * Interaction Tracking (Legacy support for event-based stats)
     */
    function trackInteraction(type, detail) {
        console.log(`[Analytics] Tracking interaction: ${type}`, detail);
        
        let stats = JSON.parse(localStorage.getItem(STATS_KEY)) || { 
            timeSpent: {}, 
            interactions: {
                classesJoined: 0,
                notesViewed: 0,
                notesDownloaded: 0,
                assignmentsSubmitted: 0,
                quizzesStarted: 0
            },
            trackedDetails: {},
            recentActivity: []
        };
        
        if (stats.interactions.hasOwnProperty(type)) {
            // Deduplication logic using trackedDetails array
            if (!stats.trackedDetails) stats.trackedDetails = {};
            if (!stats.trackedDetails[type]) stats.trackedDetails[type] = [];
            
            if (stats.trackedDetails[type].includes(detail)) {
                console.log(`[Analytics] Duplication blocked: ${type} for ${detail}`);
            } else {
                stats.interactions[type]++;
                stats.trackedDetails[type].push(detail);
            }
        }

        const activity = {
            type,
            detail,
            timestamp: new Date().toISOString(),
            id: Date.now()
        };
        
        stats.recentActivity.unshift(activity);
        if (stats.recentActivity.length > 30) stats.recentActivity.pop();

        localStorage.setItem(STATS_KEY, JSON.stringify(stats));
        
        if (window.updateDashboardStats) window.updateDashboardStats();
    }

    // Initialize the tracker
    setupListeners();
    startTracking();

    // Auto-bind tracked elements (from original analytics.js)
    document.addEventListener('click', (e) => {
        const target = e.target.closest('[data-track]');
        if (target) {
            const trackType = target.getAttribute('data-track');
            const trackDetail = target.getAttribute('data-detail') || target.innerText;
            trackInteraction(trackType, trackDetail);
        }
    });

    // Provide a public API for manual calls or debugging
    return {
        getStats: () => JSON.parse(localStorage.getItem(STATS_KEY)),
        trackInteraction: trackInteraction,
        getActiveTime: () => ({
            total: getStoredValue(TOTAL_TIME_KEY),
            today: getStoredValue(getTodayKey()),
            page: getStoredValue(PAGE_TIME_KEY)
        })
    };
})();

// Re-expose legacy window functions to keep existing dashboard.js etc. working
window.getStats = ActiveTimeTracker.getStats;
window.trackInteraction = ActiveTimeTracker.trackInteraction;
window.getActiveTime = ActiveTimeTracker.getActiveTime;


