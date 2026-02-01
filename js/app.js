// Function to switch sub-pages
function loadPage(btn, url) {
    const frame = document.getElementById('content-frame');
    frame.src = url;
    
    // UI Update for buttons
    document.querySelectorAll('.nav-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');

    // FIX: Force map to redraw when the new page finishes loading
    frame.onload = function() {
        syncThemeToIframe();
    };
}

// Function to toggle the theme
function toggleTheme() {
    const root = document.documentElement;
    const currentTheme = root.getAttribute('data-theme');
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
    
    root.setAttribute('data-theme', newTheme);
    localStorage.setItem('selected-theme', newTheme);
    
    syncThemeToIframe();
}

// Helper to push theme and fix Map "Gray Box" inside Iframe
function syncThemeToIframe() {
    const theme = document.documentElement.getAttribute('data-theme');
    const frame = document.getElementById('content-frame');
    
    if (frame && frame.contentDocument) {
        // 1. Sync the theme attribute
        frame.contentDocument.documentElement.setAttribute('data-theme', theme);
        
        // 2. SURGICAL FIX: If a Leaflet map exists, force it to recalculate size
        if (frame.contentWindow.map) {
            setTimeout(() => {
                frame.contentWindow.map.invalidateSize();
            }, 250);
        }
    }
}

// Initialize theme on page load
window.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('selected-theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
});