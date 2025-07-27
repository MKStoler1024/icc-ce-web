document.addEventListener("DOMContentLoaded", async function () {
    // --- 常量定义 ---
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

    // --- DOM 元素获取 ---
    const darkBtn = document.getElementById("toggle-dark");
    const darkBtnMobile = document.getElementById("toggle-dark-mobile");
    const releaseLoading = document.getElementById("release-loading");
    const releaseList = document.getElementById("release-list");
    const toggleBetaBtn = document.getElementById("toggle-beta");
    const githubStars = document.getElementById("github-stars");
    const githubForks = document.getElementById("github-forks");
    const githubWatchers = document.getElementById("github-watchers");
    const navToggle = document.getElementById('nav-toggle');
    const navLinks = document.getElementById('nav-links');
    const topAppBar = document.getElementById('top-app-bar');

    let fastestMirror = null;
    let releasesOfficial = [];
    let releasesBeta = [];
    let currentReleases = [];
    let currentIndex = 0;
    let showingBeta = false;

    // --- 通用函数 ---

    function buildApiUrls(endpoint) {
        const urls = [`${GITHUB_API_BASE}${endpoint}`];
        if (fastestMirror) {
            urls.unshift(`${fastestMirror}/${GITHUB_API_BASE}${endpoint}`);
        }
        return [...urls, ...MIRROR_URLS.map(mirror => `${mirror}/${GITHUB_API_BASE}${endpoint}`)];
    }
    
    async function fetchDataWithMirrors(urls, errorMessage = "获取数据失败") {
        for (const url of new Set(urls)) { // 使用 Set 去除重复 URL
            try {
                const res = await fetch(url, { cache: "no-store" });
                if (res.ok) return await res.json();
            } catch (e) { /* 忽略错误，尝试下一个 */ }
        }
        releaseLoading.innerHTML = `<span class="text-error dark:text-dark-error">${errorMessage}</span>`;
        return null;
    }

    function escapeHtml(unsafeText) {
        if (!unsafeText) return "";
        return unsafeText
            .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
    }

    function loadingSpinner(text) {
        return `
            <div class="flex flex-col items-center justify-center py-12 animate-fadein gap-4">
                <svg class="animate-spin h-8 w-8 text-primary dark:text-dark-primary" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                <span class="text-body-large text-on-surface-variant dark:text-dark-on-surface-variant">${text}</span>
            </div>
        `;
    }

    async function detectFastestMirror() {
        releaseLoading.innerHTML = loadingSpinner("正在测速加速源...");
        const endpoint = `${GITHUB_REPO_COMMUNITY}/releases/latest`;
        const testUrls = [
            `https://api.github.com/repos/${endpoint}`, 
            ...MIRROR_URLS.map(m => `${m}/${GITHUB_API_BASE}${endpoint}`)
        ];
        
        const results = await Promise.all(testUrls.map(url => 
            new Promise(resolve => {
                const start = performance.now();
                fetch(url, { method: "HEAD", cache: "no-store" })
                    .then(() => resolve(performance.now() - start))
                    .catch(() => resolve(Infinity));
            })
        ));

        let minIdx = results.indexOf(Math.min(...results));
        return minIdx === 0 ? null : MIRROR_URLS[minIdx - 1];
    }

    function convertDownloadUrl(url) {
        if (fastestMirror && /^https:\/\/github\.com\//.test(url)) {
            return `${fastestMirror}/${url}`;
        }
        return url;
    }

    function mergeAndSortReleases() {
        return [...releasesOfficial.map(r => ({ ...r, _isBeta: false })), ...releasesBeta.map(r => ({ ...r, _isBeta: true }))]
            .sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
    }
    
    // --- 渲染函数 (M3 样式重构) ---
    function renderRelease(idx, animate = false) {
        if (currentReleases.length === 0) {
            releaseList.innerHTML = `<p class="text-center text-on-surface-variant dark:text-dark-on-surface-variant py-8">暂无发布版本</p>`;
            return;
        }

        const r = currentReleases[idx];
        const assetsHtml = r.assets.map(a =>
            `<a href="${convertDownloadUrl(a.browser_download_url)}" target="_blank" class="h-10 px-4 inline-flex items-center justify-center gap-2 rounded-full bg-secondary-container dark:bg-dark-secondary-container text-on-secondary-container dark:text-dark-on-secondary-container text-label-large font-medium transition hover:shadow-sm mr-2 mb-2">
                <span class="material-symbols-outlined text-lg">download</span>
                <span>${escapeHtml(a.name)}</span>
            </a>`
        ).join('') || `<span class="text-body-medium text-on-surface-variant dark:text-dark-on-surface-variant">无附件</span>`;

        let bodyHtml;
        if (r.body) {
            if (typeof marked !== 'undefined' && typeof marked.parse === 'function') {
                bodyHtml = marked.parse(r.body);
            } else {
                const warningMessage = `<div class="p-3 mb-3 bg-error-container dark:bg-dark-error-container text-on-error-container dark:text-dark-on-error-container rounded-2xl" role="alert"><p class="font-bold">警告</p><p>Markdown 格式化失败，显示原文。</p></div>`;
                bodyHtml = warningMessage + `<pre class="whitespace-pre-wrap break-words font-sans">${escapeHtml(r.body)}</pre>`;
            }
        } else {
            bodyHtml = '<p class="text-on-surface-variant dark:text-dark-on-surface-variant">无说明</p>';
        }

        const badge = r._isBeta
            ? '<div class="flex items-center gap-1.5 px-3 h-7 rounded-lg bg-tertiary-container dark:bg-dark-tertiary-container text-on-tertiary-container dark:text-dark-on-tertiary-container text-label-large">测试版</div>'
            : '<div class="flex items-center gap-1.5 px-3 h-7 rounded-lg bg-primary-container dark:bg-dark-primary-container text-on-primary-container dark:text-dark-on-primary-container text-label-large">正式版</div>';

        const navButtonsHtml = `
            <div class="mt-6 flex flex-wrap justify-center items-center gap-4">
                <button id="prev-release" class="h-10 px-6 flex items-center justify-center gap-2 rounded-full border border-outline dark:border-dark-outline text-primary dark:text-dark-primary text-label-large font-medium transition hover:bg-primary/10 dark:hover:bg-dark-primary/10 disabled:opacity-40 disabled:pointer-events-none" ${idx === 0 ? 'disabled' : ''}>
                    <span class="material-symbols-outlined">arrow_back</span><span>上一版</span>
                </button>
                <span class="text-body-medium text-on-surface-variant dark:text-dark-on-surface-variant">${idx + 1} / ${currentReleases.length}</span>
                <button id="next-release" class="h-10 px-6 flex items-center justify-center gap-2 rounded-full border border-outline dark:border-dark-outline text-primary dark:text-dark-primary text-label-large font-medium transition hover:bg-primary/10 dark:hover:bg-dark-primary/10 disabled:opacity-40 disabled:pointer-events-none" ${idx === currentReleases.length - 1 ? 'disabled' : ''}>
                    <span>下一版</span><span class="material-symbols-outlined">arrow_forward</span>
                </button>
            </div>
        `;
        
        const html = `
            <div class="border border-outline-variant dark:border-dark-outline-variant rounded-2xl p-6 bg-surface-container dark:bg-dark-surface-container">
                <div class="flex flex-col sm:flex-row justify-between items-start gap-3 mb-4">
                    <a href="${r.html_url}" target="_blank" class="text-title-large text-on-surface dark:text-dark-on-surface hover:underline">${escapeHtml(r.name || r.tag_name)}</a>
                    <div class="flex items-center gap-4 flex-shrink-0">
                        <span class="text-body-medium text-on-surface-variant dark:text-dark-on-surface-variant">${new Date(r.published_at).toLocaleDateString()}</span>
                        ${badge}
                    </div>
                </div>
                <div class="prose prose-sm max-w-none text-on-surface-variant dark:text-dark-on-surface-variant markdown-body">${bodyHtml}</div>
                <div class="mt-6 pt-6 border-t border-outline-variant dark:border-dark-outline-variant">
                    <h4 class="text-title-medium text-on-surface dark:text-dark-on-surface mb-3">附件</h4>
                    <div>${assetsHtml}</div>
                </div>
                ${navButtonsHtml}
            </div>
        `;

        releaseList.innerHTML = html;
        document.getElementById("prev-release").onclick = () => { if (currentIndex > 0) { currentIndex--; renderRelease(currentIndex, true); } };
        document.getElementById("next-release").onclick = () => { if (currentIndex < currentReleases.length - 1) { currentIndex++; renderRelease(currentIndex, true); } };
    }


    // --- 初始化和事件绑定 ---
    
    // 深色模式
    function setDarkMode(isDark) {
        document.documentElement.classList.toggle('dark', isDark);
        const icon = isDark ? 'light_mode' : 'dark_mode';
        const text = isDark ? '浅色模式' : '深色模式';
        darkBtn.innerHTML = `<span class="material-symbols-outlined">${icon}</span>`;
        darkBtnMobile.innerHTML = `<span class="material-symbols-outlined mr-2">${icon}</span>${text}`;
    };
    
    const userPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    setDarkMode(userPrefersDark); // 初始加载时根据系统设置
    darkBtn.onclick = darkBtnMobile.onclick = () => setDarkMode(!document.documentElement.classList.contains('dark'));
    
    // 移动端导航
    navToggle.onclick = () => navLinks.classList.toggle('hidden');
    navLinks.querySelectorAll('a, button').forEach(link => link.onclick = () => navLinks.classList.add('hidden'));

    // 顶部栏滚动效果
    window.onscroll = () => {
        const isScrolled = window.scrollY > 0;
        topAppBar.classList.toggle('bg-surface-container-high', isScrolled);
        topAppBar.classList.toggle('dark:bg-dark-surface-container-high', isScrolled);
        topAppBar.classList.toggle('shadow-md', isScrolled);
    };

    // 切换 Beta 版本
    toggleBetaBtn.onclick = async () => {
        showingBeta = !showingBeta;
        releaseLoading.style.display = "block";
        releaseList.style.display = "none";
        
        if (showingBeta) {
            toggleBetaBtn.innerHTML = `<span class="material-symbols-outlined text-lg mr-1">verified</span>显示正式版`;
            if (releasesBeta.length === 0) {
                releaseLoading.innerHTML = loadingSpinner("正在获取测试版...");
                const betaUrls = buildApiUrls(`${GITHUB_REPO_COMMUNITY_BETA}/releases`);
                releasesBeta = await fetchDataWithMirrors(betaUrls, "测试版获取失败") || [];
            }
            currentReleases = mergeAndSortReleases();
        } else {
            toggleBetaBtn.innerHTML = `<span class="material-symbols-outlined text-lg mr-1">science</span>显示测试版`;
            currentReleases = releasesOfficial;
        }

        currentIndex = 0;
        releaseLoading.style.display = "none";
        releaseList.style.display = "block";
        renderRelease(currentIndex);
    };

    // 页面主初始化逻辑
    async function initializePage() {
        fastestMirror = await detectFastestMirror();

        releaseLoading.innerHTML = loadingSpinner("正在获取版本列表...");
        const repoInfoUrls = buildApiUrls(GITHUB_REPO_COMMUNITY);
        const releaseUrls = buildApiUrls(`${GITHUB_REPO_COMMUNITY}/releases`);

        const [repoInfo, officialReleases] = await Promise.all([
            fetchDataWithMirrors(repoInfoUrls, "获取仓库信息失败"),
            fetchDataWithMirrors(releaseUrls, "获取版本信息失败")
        ]);

        if (repoInfo) {
            githubStars.innerHTML = `<i class="fas fa-star fa-sm"></i><span>${repoInfo.stargazers_count}</span>`;
            githubForks.innerHTML = `<i class="fas fa-code-branch fa-sm"></i><span>${repoInfo.forks_count}</span>`;
            githubWatchers.innerHTML = `<i class="fas fa-eye fa-sm"></i><span>${repoInfo.watchers_count}</span>`;
        }

        releasesOfficial = officialReleases || [];
        currentReleases = releasesOfficial;
        currentIndex = 0;
        
        releaseLoading.style.display = "none";
        releaseList.style.display = "block";
        toggleBetaBtn.innerHTML = `<span class="material-symbols-outlined text-lg mr-1">science</span>显示测试版`;
        renderRelease(currentIndex);
    }

    initializePage();
});