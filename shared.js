// Shared across index.html, ecal.html, log.html, immerse.html:
// Supabase client, top nav bar, and Google sign-in (with Calendar scope).

const SUPABASE_URL = 'https://vgkbefoasgqmainbmvhz.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZna2JlZm9hc2dxbWFpbmJtdmh6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY0MDkyOTUsImV4cCI6MjEwMTk4NTI5NX0.KwAakclTdfqlYimb2wvHYNe33BNudMxCBSIZoDmchZk';
const GOOGLE_CALENDAR_SCOPE = 'https://www.googleapis.com/auth/calendar.events';

const sb = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const VELO_TABS = [
    { id: 'ecal', label: 'ECal', href: 'ecal.html' },
    { id: 'log', label: 'Log', href: 'log.html' },
    { id: 'immerse', label: 'Immerse', href: 'immerse.html' }
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

function renderTabNav(activePage) {
    const el = document.getElementById('tabNav');
    if (!el) return;
    el.innerHTML = VELO_TABS.map(tab =>
        `<a href="${tab.href}" class="tab-link${tab.id === activePage ? ' active' : ''}">${tab.label}</a>`
    ).join('');
}

function renderAuthControl(session) {
    const el = document.getElementById('authControl');
    if (!el) return;

    if (session && session.user) {
        const name = session.user.user_metadata?.full_name || session.user.email;
        const avatar = session.user.user_metadata?.avatar_url;
        el.innerHTML = `
            <div class="user-chip">
                ${avatar ? `<img src="${avatar}" alt="">` : ''}
                <span>${name}</span>
            </div>
            <button class="auth-btn" id="signOutBtn">Sign Out</button>
        `;
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
