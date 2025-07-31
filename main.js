document.addEventListener("DOMContentLoaded", function () {
    // --- Constants & State ---
    const GITHUB_REPO_COMMUNITY = "InkCanvasForClass/community";
    const GITHUB_REPO_COMMUNITY_BETA = "InkCanvasForClass/community-beta";
    const GITHUB_API_BASE = "https://api.github.com/repos/";
    const MIRROR_URLS = [
        "https://gh.llkk.cc",
        "https://ghfile.geekertao.top",
        "https://gh.dpik.top",
        "https://github.dpik.top",
        "https://github.acmsz.top",
        "https://git.yylx.win"
    ];

    let fastestMirror = null;
    let releasesOfficial = [];
    let releasesBeta = [];
    let currentReleases = [];
    let currentIndex = 0;
    let showingBeta = false;

    // --- DOM Elements ---
    const elements = {
        // Theme
        toggleDarkBtn: document.getElementById("toggle-dark"),
        toggleDarkMobileBtn: document.getElementById("toggle-dark-mobile"),
        
        // Navigation
        navToggleBtn: document.getElementById("nav-toggle"),
        mobileNavDrawer: document.getElementById("mobile-nav-drawer"),
        mobileNavScrim: document.getElementById("mobile-nav-scrim"),
        mobileNavLinks: document.querySelectorAll("#mobile-nav-drawer a, #mobile-nav-drawer button"),
        topAppBar: document.getElementById("top-app-bar"),

        // GitHub Stats
        githubStars: document.getElementById("github-stars"),
        githubForks: document.getElementById("github-forks"),
        githubWatchers: document.getElementById("github-watchers"),

        // Release Section
        releaseContainer: document.getElementById("release-info"),
        releaseLoading: document.getElementById("release-loading"),
        releaseLoadingText: document.querySelector("#release-loading p"),
        releaseList: document.getElementById("release-list"),
        toggleBetaBtn: document.getElementById("toggle-beta"),
    };

    // --- API & Mirror Logic ---
    function buildApiUrls(endpoint) {
        const uniqueUrls = new Set();
        // Prioritize fastest mirror if detected
        if (fastestMirror) {
            uniqueUrls.add(`${fastestMirror}/${GITHUB_API_BASE}${endpoint}`);
        }
        // Add official URL
        uniqueUrls.add(`${GITHUB_API_BASE}${endpoint}`);
        // Add all other mirrors
        MIRROR_URLS.forEach(mirror => uniqueUrls.add(`${mirror}/${GITHUB_API_BASE}${endpoint}`));
        return Array.from(uniqueUrls);
    }

    async function fetchDataWithMirrors(urls, errorMessage = "获取数据失败") {
        for (const url of urls) {
            try {
                const res = await fetch(url, { cache: "no-store" });
                if (res.ok) return await res.json();
            } catch (e) { /* Ignore error and try next mirror */ }
        }
        elements.releaseLoadingText.textContent = errorMessage;
        elements.releaseLoading.querySelector('.loader').style.display = 'none';
        return null;
    }

    async function detectFastestMirror() {
        updateLoadingText("正在检测镜像源...");
        const endpoint = `${GITHUB_REPO_COMMUNITY}/releases/latest`;
        const testUrls = [`https://api.github.com/repos/${endpoint}`, ...MIRROR_URLS.map(m => `${m}/${GITHUB_API_BASE}${endpoint}`)];
        
        const results = await Promise.all(testUrls.map(url => 
            new Promise(resolve => {
                const start = performance.now();
                // Use a short timeout to prevent long waits
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 3000);
                
                fetch(url, { method: "HEAD", cache: "no-store", signal: controller.signal })
                    .then(() => resolve(performance.now() - start))
                    .catch(() => resolve(Infinity))
                    .finally(() => clearTimeout(timeoutId));
            })
        ));

        let minIdx = results.indexOf(Math.min(...results));
        // If the fastest is Infinity (all failed), or the official one is fastest, return null.
        if (results[minIdx] === Infinity || minIdx === 0) return null;
        return MIRROR_URLS[minIdx - 1];
    }
    
    function convertDownloadUrl(url) {
        if (fastestMirror && url.startsWith("https://github.com/")) {
            return url.replace("https://github.com/", `${fastestMirror}/https://github.com/`);
        }
        return url;
    }

    // --- Rendering Logic ---
    function updateLoadingText(text) {
        if (elements.releaseLoadingText) {
            elements.releaseLoadingText.textContent = text;
        }
    }
    
    function renderRelease(idx) {
        if (!currentReleases || currentReleases.length === 0) {
            elements.releaseList.innerHTML = `<p class="typescale-body-large" style="text-align: center; padding: 2rem 0;">暂无发布版本</p>`;
            return;
        }
    
        const r = currentReleases[idx];
        const assetsHtml = r.assets
            //.filter(a => a.name.endsWith('.exe'))
            .map(a => `
                <a href="${convertDownloadUrl(a.browser_download_url)}" target="_blank" class="btn btn--tonal">
                    <span class="material-symbols-outlined">download</span>
                    <span>${a.name} (${(a.size / 1024 / 1024).toFixed(2)} MB)</span>
                </a>
            `).join('') || `<p class="typescale-body-medium card-subtitle">无可用附件</p>`;
    
        const bodyHtml = r.body && typeof marked !== 'undefined'
            ? marked.parse(r.body)
            : `<p class="card-subtitle">${r.body ? r.body.replace(/\r\n/g, '<br>') : '没有提供更新日志。'}</p>`;
    
        const badge = r._isBeta
            ? `<div class="chip">测试版</div>`
            : `<div class="chip" style="background-color: var(--md-sys-color-primary-container); color: var(--md-sys-color-on-primary-container);">正式版</div>`;
    
        const html = `
            <article class="release-item">
                <header class="release-item-header">
                    <a href="${r.html_url}" target="_blank" class="typescale-title-large" style="text-decoration: underline;">${r.name || r.tag_name}</a>
                    <div style="display: flex; align-items: center; gap: 1rem; flex-shrink: 0;">
                        <span class="typescale-body-medium card-subtitle">${new Date(r.published_at).toLocaleDateString()}</span>
                        ${badge}
                    </div>
                </header>
                <div class="markdown-body card-subtitle">${bodyHtml}</div>
                <div class="divider" style="margin-block: 1.5rem;"></div>
                <h4 class="typescale-title-medium" style="margin-bottom: 0.75rem;">附件</h4>
                <footer class="release-item-actions">${assetsHtml}</footer>
            </article>
            <div class="release-navigation">
                <button id="prev-release" class="btn btn--outlined" ${idx === 0 ? 'disabled' : ''}>
                    <span class="material-symbols-outlined">arrow_back</span><span>上一版</span>
                </button>
                <span class="typescale-body-medium card-subtitle">${idx + 1} / ${currentReleases.length}</span>
                <button id="next-release" class="btn btn--outlined" ${idx === currentReleases.length - 1 ? 'disabled' : ''}>
                    <span>下一版</span><span class="material-symbols-outlined">arrow_forward</span>
                </button>
            </div>
        `;
    
        elements.releaseList.innerHTML = html;
        document.getElementById("prev-release").onclick = () => { if (currentIndex > 0) renderRelease(--currentIndex); };
        document.getElementById("next-release").onclick = () => { if (currentIndex < currentReleases.length - 1) renderRelease(++currentIndex); };
    }

    // --- UI Logic ---
    // Dark Mode
    const initDarkMode = () => {
        const storedTheme = localStorage.getItem('theme');
        const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
        setTheme(storedTheme === 'dark' || (storedTheme === null && systemPrefersDark));
    };
    
    const setTheme = (isDark) => {
        document.documentElement.classList.toggle('dark', isDark);
        localStorage.setItem('theme', isDark ? 'dark' : 'light');
        const icon = isDark ? 'light_mode' : 'dark_mode';
        const text = isDark ? '切换到明亮模式' : '切换到深色模式';
        elements.toggleDarkBtn.querySelector('.material-symbols-outlined').textContent = icon;
        elements.toggleDarkMobileBtn.querySelector('.material-symbols-outlined').textContent = icon;
        elements.toggleDarkMobileBtn.querySelector('span:last-child').textContent = text;
    };
    
    // Mobile Navigation
    const toggleMobileNav = (open) => {
        const isOpen = typeof open === 'boolean' ? open : !elements.mobileNavDrawer.classList.contains('is-open');
        elements.mobileNavDrawer.classList.toggle('is-open', isOpen);
        elements.mobileNavScrim.classList.toggle('is-open', isOpen);
        elements.navToggleBtn.querySelector('.material-symbols-outlined').textContent = isOpen ? 'close' : 'menu';
        document.body.style.overflow = isOpen ? 'hidden' : '';
    };

    // --- Event Listeners & Initialization ---
    function bindEventListeners() {
        elements.toggleDarkBtn.addEventListener('click', () => setTheme(!document.documentElement.classList.contains('dark')));
        elements.toggleDarkMobileBtn.addEventListener('click', () => setTheme(!document.documentElement.classList.contains('dark')));
        
        elements.navToggleBtn.addEventListener('click', () => toggleMobileNav());
        elements.mobileNavScrim.addEventListener('click', () => toggleMobileNav(false));
        elements.mobileNavLinks.forEach(link => {
            if (link.id !== 'toggle-dark-mobile') {
                link.addEventListener('click', () => toggleMobileNav(false));
            }
        });

        window.addEventListener('scroll', () => {
            elements.topAppBar.classList.toggle('is-scrolled', window.scrollY > 0);
        });

        elements.toggleBetaBtn.addEventListener('click', async () => {
            showingBeta = !showingBeta;
            elements.releaseLoading.style.display = 'flex';
            elements.releaseList.style.display = 'none';
            
            elements.toggleBetaBtn.innerHTML = showingBeta
                ? `<span class="material-symbols-outlined">verified</span><span>显示正式版</span>`
                : `<span class="material-symbols-outlined">science</span><span>显示测试版</span>`;

            if (showingBeta && releasesBeta.length === 0) {
                updateLoadingText("正在获取 Beta 版本...");
                const betaUrls = buildApiUrls(`${GITHUB_REPO_COMMUNITY_BETA}/releases`);
                releasesBeta = await fetchDataWithMirrors(betaUrls, "Beta 版本获取失败") || [];
            }
            
            const allReleases = [...releasesOfficial.map(r => ({...r, _isBeta: false})), ...releasesBeta.map(r => ({...r, _isBeta: true}))];
            const sortedReleases = allReleases.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
            
            currentReleases = showingBeta ? sortedReleases : releasesOfficial;
            
            currentIndex = 0;
            elements.releaseLoading.style.display = 'none';
            elements.releaseList.style.display = 'block';
            renderRelease(currentIndex);
        });
    }

    async function init() {
        initDarkMode();
        bindEventListeners();
        
        elements.toggleBetaBtn.innerHTML = `<span class="material-symbols-outlined">science</span><span>显示测试版</span>`;

        fastestMirror = await detectFastestMirror();

        updateLoadingText("正在获取仓库信息...");
        const repoInfoUrls = buildApiUrls(GITHUB_REPO_COMMUNITY);
        const [repoInfo] = await Promise.all([fetchDataWithMirrors(repoInfoUrls)]);
        
        if (repoInfo) {
            elements.githubStars.innerHTML = `<i class="fa-solid fa-star fa-sm"></i><span>${repoInfo.stargazers_count}</span>`;
            elements.githubForks.innerHTML = `<i class="fa-solid fa-code-fork fa-sm"></i><span>${repoInfo.forks_count}</span>`;
            elements.githubWatchers.innerHTML = `<i class="fa-solid fa-eye fa-sm"></i><span>${repoInfo.subscribers_count}</span>`;
        }
        
        updateLoadingText("正在获取正式版本...");
        const releaseUrls = buildApiUrls(`${GITHUB_REPO_COMMUNITY}/releases`);
        releasesOfficial = await fetchDataWithMirrors(releaseUrls, "正式版本获取失败") || [];
        
        currentReleases = releasesOfficial;
        currentIndex = 0;

        elements.releaseLoading.style.display = 'none';
        elements.releaseList.style.display = 'block';
        renderRelease(currentIndex);
    }

    init();
});