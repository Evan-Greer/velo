// Shared across index.html, ecal.html, log.html, immerse.html:
// Supabase client, top nav bar, and Google sign-in (with Calendar scope).

const SUPABASE_URL = 'https://vgkbefoasgqmainbmvhz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZna2JlZm9hc2dxbWFpbmJtdmh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0MDkyOTUsImV4cCI6MjEwMTk4NTI5NX0.KwAakclTdfqlYimb2wvHYNe33BNudMxCBSIZoDmchZk';
const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const VELO_TABS = [
    { id: 'ecal', label: 'ECal', href: 'ecal.html' },
    { id: 'immerse', label: 'Immerse', href: 'immerse.html' }
];

const VELO_ICON_LINKS = [
    { id: 'dps', href: 'dps.html', symbol: '✝', extraClass: 'icon-cross', title: 'Daily Prayer & Saint' },
    { id: 'log', href: 'log.html', symbol: 'Log', extraClass: 'icon-log', title: 'Thankful For' }
];

async function signInWithGoogle() {
    await sb.auth.signInWithOAuth({
        provider: 'google',
        options: {
            scopes: GOOGLE_CALENDAR_SCOPE,
            redirectTo: window.location.origin + window.location.pathname
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
    el.innerHTML = '<div class="tab-slider" id="tabSlider"></div>' + VELO_TABS.map(tab =>
        `<a href="${tab.href}" class="tab-link${tab.id === activePage ? ' active' : ''}" data-tab="${tab.id}">${tab.label}</a>`
    ).join('');
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

function renderIconNav(activePage) {
    const el = document.getElementById('iconNav');
    if (!el) return;
    el.innerHTML = VELO_ICON_LINKS.map(link =>
        `<a href="${link.href}" class="icon-circle ${link.extraClass}${link.id === activePage ? ' active' : ''}" title="${link.title}">${link.symbol}</a>`
    ).join('');
}

async function initVeloNav(activePage) {
    renderTabNav(activePage);
    renderIconNav(activePage);

    const { data: { session } } = await sb.auth.getSession();
    renderAuthControl(session);

    sb.auth.onAuthStateChange((_event, newSession) => {
        renderAuthControl(newSession);
    });
}
