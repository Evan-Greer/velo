// Shared across index.html, ecal.html, log.html, immerse.html:
// Supabase client, top nav bar, and Google sign-in (with Calendar scope).

const SUPABASE_URL = 'https://vgkbefoasgqmainbmvhz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZna2JlZm9hc2dxbWFpbmJtdmh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0MDkyOTUsImV4cCI6MjEwMTk4NTI5NX0.KwAakclTdfqlYimb2wvHYNe33BNudMxCBSIZoDmchZk';
// Full "calendar" scope (not just calendar.events) -- reading the list of
// the user's other calendars (calendarList.list) needs broader access than
// events-only, which only covers reading/writing events on calendars you
// already know the ID of.
const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const VELO_TABS = [
    { id: 'ecal', label: 'ECal', href: 'ecal.html' },
    { id: 'immerse', label: 'Immerse', href: 'immerse.html' },
    { id: 'log', label: 'Log', href: 'log.html', title: 'Thankful For', pulseKey: 'velo_log_last_done' },
    { id: 'dps', label: '✝', href: 'dps.html', title: 'Daily Prayer & Saint', pulseKey: 'velo_dps_last_seen' }
];

// "Needs attention" pulse tracking for Log/DPS. Stores the last date (YYYY-MM-DD)
// each was fulfilled; comparing against today's date is what makes it naturally
// reset at midnight, with no timer/cron needed.
function veloTodayString() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function veloNeedsPulse(key) {
    return localStorage.getItem(key) !== veloTodayString();
}

function veloMarkDoneToday(key) {
    localStorage.setItem(key, veloTodayString());
}

async function signInWithGoogle() {
    await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
            scopes: GOOGLE_CALENDAR_SCOPE,
            redirectTo: window.location.origin + window.location.pathname,
            // Force Google to show the consent screen again so anyone who
            // previously granted the narrower calendar.events scope gets
            // prompted for the broader one instead of silently reusing an
            // old grant that doesn't cover it.
            queryParams: { prompt: 'consent', access_type: 'offline' }
        }
    });
}

async function signOutOfVelo() {
    await sb.auth.signOut();
    window.location.reload();
}

let currentTabPage = null;

function renderTabNav(activePage) {
    currentTabPage = activePage;
    const el = document.getElementById('tabNav');
    if (!el) return;
    el.innerHTML = '<div class="tab-slider" id="tabSlider"></div>' + VELO_TABS.map(tab => {
        const classes = ['tab-link'];
        if (tab.id === activePage) classes.push('active');
        if (tab.pulseKey && veloNeedsPulse(tab.pulseKey)) classes.push('needs-attention');
        return `<a href="${tab.href}" class="${classes.join(' ')}" data-tab="${tab.id}"${tab.title ? ` title="${tab.title}"` : ''}>${tab.label}</a>`;
    }).join('');
    positionTabSlider();
}

function positionTabSlider() {
    const nav = document.getElementById('tabNav');
    const slider = document.getElementById('tabSlider');
    if (!nav || !slider) return;

    const activeLink = nav.querySelector(`.tab-link[data-tab="${currentTabPage}"]`);
    if (!activeLink) {
        slider.style.opacity = '0';
        return;
    }
    slider.style.opacity = '1';
    slider.style.width = activeLink.offsetWidth + 'px';
    slider.style.transform = `translateX(${activeLink.offsetLeft}px)`;
}

window.addEventListener('resize', positionTabSlider);
if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(positionTabSlider);
}

document.addEventListener('click', (e) => {
    const dropdown = document.getElementById('userDropdown');
    const chipBtn = document.getElementById('userChipBtn');
    if (!dropdown || dropdown.contains(e.target) || chipBtn?.contains(e.target)) return;
    dropdown.classList.remove('open');
});

function renderAuthControl(session) {
    const el = document.getElementById('authControl');
    if (!el) return;

    if (session && session.user) {
        const rawName = session.user.user_metadata?.full_name || session.user.email;
        const avatar = session.user.user_metadata?.avatar_url;
        const firstName = rawName.split(' ')[0];

        el.innerHTML = `
            <div class="user-menu-wrapper">
                <button class="user-chip" id="userChipBtn" type="button">
                    <span>${firstName}</span>
                    ${avatar ? `<img src="${avatar}" alt="">` : ''}
                </button>
                <div class="user-dropdown" id="userDropdown">
                    <button class="dropdown-item" id="signOutBtn" type="button">Sign Out</button>
                </div>
            </div>
        `;
        document.getElementById('userChipBtn').onclick = () => {
            document.getElementById('userDropdown').classList.toggle('open');
        };
        document.getElementById('signOutBtn').onclick = signOutOfVelo;
    } else {
        el.innerHTML = `<button class="auth-btn" id="signInBtn">Connect Google</button>`;
        document.getElementById('signInBtn').onclick = signInWithGoogle;
    }
}

async function initVeloNav(activePage) {
    renderTabNav(activePage);

    const { data: { session } } = await sb.auth.getSession();
    renderAuthControl(session);

    sb.auth.onAuthStateChange((_event, newSession) => {
        renderAuthControl(newSession);
    });
}
