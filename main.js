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
    const releaseLoading = document.getElementById("release-loading");
    const releaseList = document.getElementById("release-list");
    const toggleBetaBtn = document.getElementById("toggle-beta");
    const githubStars = document.getElementById("github-stars");
    const githubForks = document.getElementById("github-forks");
    const githubWatchers = document.getElementById("github-watchers");

    let fastestMirror = null;
    let releasesOfficial = [];
    let releasesBeta = [];
    let currentReleases = [];
    let currentIndex = 0;
    let showingBeta = false;
    let manualDark = null;

    // --- 通用函数 ---

    /**
     * 构建包含 GitHub API 和所有镜像源的 URL 列表。
     * @param {string} endpoint GitHub API 的特定路径，例如 "InkCanvasForClass/community" 或 "InkCanvasForClass/community/releases"
     * @returns {string[]} URL 列表
     */
    function buildApiUrls(endpoint) {
        const urls = [`${GITHUB_API_BASE}${endpoint}`];
        if (fastestMirror) {
            urls.push(`${fastestMirror}/${GITHUB_API_BASE}${endpoint}`);
        }
        MIRROR_URLS.forEach(mirror => {
            urls.push(`${mirror}/${GITHUB_API_BASE}${endpoint}`);
        });
        return urls;
    }

    /**
     * 尝试从多个 URL 获取数据，直到成功或所有尝试失败。
     * @param {string[]} urls 要尝试的 URL 数组
     * @param {string} errorMessage 获取失败时显示的错误信息
     * @returns {Promise<Object|null>} 成功时返回 JSON 数据，失败时返回 null
     */
    async function fetchDataWithMirrors(urls, errorMessage = "获取数据失败") {
        for (const url of urls) {
            try {
                const res = await fetch(url, { cache: "no-store" });
                if (res.ok) {
                    return await res.json();
                }
            } catch (e) {
                // 忽略错误，尝试下一个 URL
            }
        }
        releaseLoading.innerHTML = `<span class="text-red-500">${errorMessage}</span>`;
        return null;
    }

    /**
     * 更新页面中与深色模式相关的类。
     * @param {boolean} isDark 是否启用深色模式
     */
    function updateDarkModeClasses(isDark) {
        const action = isDark ? "add" : "remove";
        document.body.classList[action]("dark");
        document.querySelectorAll(".bg-white, .bg-gray-50, .bg-blue-50, .bg-yellow-50, .rounded-xl, .p-6, .shadow-md, .markdown-body, .text-blue-800, .text-blue-900, .text-gray-700, .text-gray-600, .text-gray-500, .text-gray-800, .text-yellow-800, .text-green-800, .bg-green-200, .bg-yellow-200, .bg-blue-100")
            .forEach(el => el.classList && el.classList[action]("dark"));
    }

    /**
     * 设置深色模式。
     * @param {boolean} isDark 是否启用深色模式
     */
    function setDarkMode(isDark) {
        updateDarkModeClasses(isDark);
        darkBtn.innerHTML = isDark
            ? '<i class="fas fa-sun mr-1"></i><span class="hidden sm:inline">浅色模式</span>'
            : '<i class="fas fa-moon mr-1"></i><span class="hidden sm:inline">深色模式</span>';
    }

    /**
     * 根据系统偏好设置更新深色模式。
     */
    function updateDarkBySystem() {
        setDarkMode(window.matchMedia("(prefers-color-scheme: dark)").matches);
    }

    /**
     * 进度动画HTML。
     * @param {string} text 显示的文本
     * @returns {string} HTML 字符串
     */
    function loadingSpinner(text) {
        return `
            <div class="flex flex-col items-center justify-center py-6 animate-fadein">
                <svg class="animate-spin h-8 w-8 text-blue-600 mb-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
                </svg>
                <span class="text-gray-500 dark:text-gray-300">${text}</span>
            </div>
        `;
    }

    /**
     * 测试单个源的速度。
     * @param {string} apiUrl 要测试的 URL
     * @returns {Promise<number>} 请求所需时间（毫秒），失败返回 Infinity
     */
    function testMirror(apiUrl) {
        return new Promise(resolve => {
            const start = performance.now();
            fetch(apiUrl, { method: "HEAD", cache: "no-store" })
                .then(() => resolve(performance.now() - start))
                .catch(() => resolve(Infinity));
        });
    }

    /**
     * 检测所有源，返回最快的镜像源。
     * @returns {Promise<string|null>} 最快的镜像源 URL 的基础部分，如果 GitHub API 最快则返回 null
     */
    async function detectFastestMirror() {
        releaseLoading.innerHTML = loadingSpinner("正在测速下载加速源...");
        const githubApiUrl = `${GITHUB_API_BASE}${GITHUB_REPO_COMMUNITY}`;
        const urlsToTest = [githubApiUrl, ...MIRROR_URLS.map(m => `${m}/${githubApiUrl}`)];

        const results = await Promise.all(urlsToTest.map(testMirror));
        let minIdx = results.indexOf(Math.min(...results));

        // 0 为 GitHub 官方 API，其他为镜像
        if (minIdx === 0) return null;
        return MIRROR_URLS[minIdx - 1]; // 返回镜像源的基础 URL
    }

    /**
     * 转换附件下载链接以使用最快镜像。
     * @param {string} url 原始下载链接
     * @returns {string} 转换后的链接
     */
    function convertDownloadUrl(url) {
        if (!fastestMirror) return url;
        // 只加速 github.com 的下载链接
        if (/^https:\/\/github\.com\//.test(url)) {
            return `${fastestMirror}/${url}`;
        }
        return url;
    }

    /**
     * 合并并排序官方和测试版 Release。
     * @returns {Array} 排序后的 Release 列表
     */
    function mergeAndSortReleases() {
        const betaList = releasesBeta.map(r => ({ ...r, _isBeta: true }));
        const officialList = releasesOfficial.map(r => ({ ...r, _isBeta: false }));
        const all = [...officialList, ...betaList];
        all.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
        return all;
    }

    /**
     * 渲染 Release 详情到页面。
     * @param {number} idx 当前 Release 的索引
     * @param {boolean} animate 是否启用动画
     */
    function renderRelease(idx, animate = false) {
        if (currentReleases.length === 0) {
            releaseList.innerHTML = `<span class="text-gray-500">暂无 Release</span>`;
            return;
        }

        const r = currentReleases[idx];
        const assetsHtml = r.assets.map(a =>
            `<a href="${convertDownloadUrl(a.browser_download_url)}" target="_blank" class="inline-block px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition mr-2 mb-2">${a.name}</a>`
        ).join('') || '<span class="text-gray-400">无附件</span>';

        const bodyHtml = r.body ? marked.parse(r.body) : '<span class="text-gray-400">无说明</span>';
        const badge = r._isBeta
            ? '<span class="px-2 py-1 bg-yellow-200 text-yellow-800 rounded text-xs font-bold mr-2">测试版</span>'
            : '<span class="px-2 py-1 bg-green-200 text-green-800 rounded text-xs font-bold mr-2">正式版</span>';

        const html = `
            <div class="mb-4 p-3 rounded-lg bg-gray-50 shadow">
                <div>
                    ${badge}
                    <a href="${r.html_url}" target="_blank" class="text-blue-800 font-bold hover:underline ml-2">${r.name || r.tag_name}</a>
                    <span class="text-gray-500 text-sm ml-2">${new Date(r.published_at).toLocaleDateString()}</span>
                </div>
                <div class="mt-2 text-sm markdown-body">${bodyHtml}</div>
                <div class="mt-2 text-sm">
                    <strong>附件：</strong>
                    ${assetsHtml}
                </div>
                <div class="mt-4 flex justify-center gap-2">
                    <button id="prev-release" class="px-3 py-1 bg-blue-200 text-blue-800 rounded disabled:opacity-50" ${idx === 0 ? 'disabled' : ''}>上一版本</button>
                    <span class="px-3 py-1 bg-gray-200 text-gray-800 rounded">第 ${idx + 1} / ${currentReleases.length} 个版本</span>
                    <button id="next-release" class="px-3 py-1 bg-blue-200 text-blue-800 rounded disabled:opacity-50" ${idx === currentReleases.length - 1 ? 'disabled' : ''}>下一版本</button>
                </div>
            </div>
        `;

        if (animate) {
            releaseList.classList.remove('fade-in');
            releaseList.classList.add('fade-out');
            releaseList.addEventListener('animationend', function handler() {
                releaseList.removeEventListener('animationend', handler);
                releaseList.innerHTML = html;
                releaseList.classList.remove('fade-out');
                releaseList.classList.add('fade-in');
                bindReleaseNavigationBtns();
                updateDarkModeClasses(document.body.classList.contains("dark"));
            }, { once: true });
        } else {
            releaseList.innerHTML = html;
            releaseList.classList.add('fade-in');
            bindReleaseNavigationBtns();
            updateDarkModeClasses(document.body.classList.contains("dark"));
        }
    }

    /**
     * 绑定 Release 导航按钮（上一版本/下一版本）的点击事件。
     */
    function bindReleaseNavigationBtns() {
        document.getElementById("prev-release").onclick = () => {
            if (currentIndex > 0) {
                currentIndex--;
                renderRelease(currentIndex, true);
            }
        };
        document.getElementById("next-release").onclick = () => {
            if (currentIndex < currentReleases.length - 1) {
                currentIndex++;
                renderRelease(currentIndex, true);
            }
        };
    }

    // --- 初始化和事件绑定 ---

    // 页面加载时测速并获取 GitHub 仓库信息和 Release 列表
    async function initializePageData() {
        // 1. 测速并确定最快镜像
        releaseLoading.innerHTML = loadingSpinner("正在测速下载加速源...");
        fastestMirror = await detectFastestMirror();

        // 2. 获取 GitHub 仓库信息 (Stars, Forks, Watchers)
        const repoInfoUrls = buildApiUrls(GITHUB_REPO_COMMUNITY);
        const repoInfo = await fetchDataWithMirrors(repoInfoUrls, "获取仓库信息失败");
        if (repoInfo) {
            githubStars.innerText = `${repoInfo.stargazers_count} Stars`;
            githubForks.innerText = `${repoInfo.forks_count} Forks`;
            githubWatchers.innerText = `${repoInfo.watchers_count} Watch`;
        } else {
            githubStars.innerText = "-- Stars";
            githubForks.innerText = "-- Forks";
            githubWatchers.innerText = "-- Watch";
        }

        // 3. 获取官方 Release 列表
        releaseLoading.innerHTML = loadingSpinner("正在获取版本列表...");
        const officialReleaseUrls = buildApiUrls(`${GITHUB_REPO_COMMUNITY}/releases`);
        const fetchedOfficial = await fetchDataWithMirrors(officialReleaseUrls, "获取 Release 信息失败");
        releasesOfficial = Array.isArray(fetchedOfficial) ? fetchedOfficial : [];

        // 4. 初始化显示官方 Release
        currentReleases = releasesOfficial;
        currentIndex = 0;
        releaseLoading.style.display = "none";
        releaseList.style.display = "block";
        renderRelease(currentIndex);
    }

    // 深色模式自动适配和手动切换
    updateDarkBySystem();
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        if (manualDark === null) updateDarkBySystem();
    });
    darkBtn.onclick = () => {
        manualDark = !document.body.classList.contains("dark");
        setDarkMode(manualDark);
    };

    // 切换测试版/正式版 Release
    toggleBetaBtn.onclick = async () => {
        if (!showingBeta) {
            // 当前是正式版，切换到显示测试版
            toggleBetaBtn.innerText = "只看正式版";
            releaseLoading.style.display = "block";
            releaseList.style.display = "none";
            releaseLoading.innerHTML = loadingSpinner("正在获取测试版...");

            const betaReleaseUrls = buildApiUrls(`${GITHUB_REPO_COMMUNITY_BETA}/releases`);
            const fetchedBeta = await fetchDataWithMirrors(betaReleaseUrls, "测试版获取失败");
            releasesBeta = Array.isArray(fetchedBeta) ? fetchedBeta : [];

            currentReleases = mergeAndSortReleases();
            currentIndex = 0;
            releaseLoading.style.display = "none";
            releaseList.style.display = "block";
            renderRelease(currentIndex);
            showingBeta = true;
        } else {
            // 当前是测试版，切换到只看正式版
            toggleBetaBtn.innerText = "显示测试版";
            if (!releasesOfficial.length) {
                releaseLoading.style.display = "block";
                releaseList.style.display = "none";
                releaseLoading.innerHTML = loadingSpinner("正在重新获取正式版...");

                const officialReleaseUrls = buildApiUrls(`${GITHUB_REPO_COMMUNITY}/releases`);
                const fetchedOfficial = await fetchDataWithMirrors(officialReleaseUrls, "获取 Release 信息失败");
                releasesOfficial = Array.isArray(fetchedOfficial) ? fetchedOfficial : [];

                releaseLoading.style.display = "none";
                releaseList.style.display = "block";
            }

            currentReleases = releasesOfficial;
            currentIndex = 0;
            renderRelease(currentIndex);
            showingBeta = false;
        }
    };

    // 执行页面初始化逻辑
    initializePageData();
});