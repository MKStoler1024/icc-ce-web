// 页面加载后获取 GitHub 仓库信息并填充徽章
document.addEventListener("DOMContentLoaded", async function () {
    fetch("https://api.github.com/repos/InkCanvasForClass/community")
        .then(res => res.json())
        .then(data => {
            document.getElementById("github-stars").innerText = data.stargazers_count + " Stars";
            document.getElementById("github-forks").innerText = data.forks_count + " Forks";
            document.getElementById("github-watchers").innerText = data.watchers_count + " Watch";
        });

    // 深色模式自动适配和手动切换
    const darkBtn = document.getElementById("toggle-dark");
    function setDarkMode(isDark) {
        if (isDark) {
            document.body.classList.add("dark");
            document.querySelectorAll("*").forEach(el => el.classList && el.classList.add("dark"));
            darkBtn.innerHTML = '<i class="fas fa-sun mr-1"></i><span class="hidden sm:inline">浅色模式</span>';
        } else {
            document.body.classList.remove("dark");
            document.querySelectorAll("*").forEach(el => el.classList && el.classList.remove("dark"));
            darkBtn.innerHTML = '<i class="fas fa-moon mr-1"></i><span class="hidden sm:inline">深色模式</span>';
        }
    }
    // 跟随系统
    function updateDarkBySystem() {
        setDarkMode(window.matchMedia("(prefers-color-scheme: dark)").matches);
    }
    let manualDark = null;
    updateDarkBySystem();
    window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
        if (manualDark === null) updateDarkBySystem();
    });
    darkBtn.onclick = function () {
        manualDark = !(document.body.classList.contains("dark"));
        setDarkMode(manualDark);
    };

    // Release 展示逻辑
    const releaseLoading = document.getElementById("release-loading");
    const releaseList = document.getElementById("release-list");
    const toggleBtn = document.getElementById("toggle-beta");
    let releasesOfficial = [];
    let releasesBeta = [];
    let currentReleases = [];
    let currentIndex = 0;
    let showingBeta = false;

    // fetchOfficial 支持自动切换到镜像源，全部失败则提示
    async function fetchOfficial() {
        releaseLoading.style.display = "block";
        releaseList.style.display = "none";
        releaseLoading.innerText = "正在获取版本列表...";
        let urls = [
            "https://api.github.com/repos/InkCanvasForClass/community/releases"
        ];
        if (fastestMirror) {
            urls.push(fastestMirror + "/https://api.github.com/repos/InkCanvasForClass/community/releases");
        }
        for (const mirror of [
            "https://gh.llkk.cc",
            "https://ghfile.geekertao.top",
            "https://gh.dpik.top",
            "https://github.dpik.top",
            "https://github.acmsz.top",
            "https://git.yylx.win"
        ]) {
            urls.push(mirror + "/https://api.github.com/repos/InkCanvasForClass/community/releases");
        }
        for (let i = 0; i < urls.length; i++) {
            try {
                let res = await fetch(urls[i], { cache: "no-store" });
                if (res.ok) {
                    const list = await res.json();
                    releasesOfficial = Array.isArray(list) ? list : [];
                    return releasesOfficial;
                }
            } catch (e) {
                // ignore
            }
        }
        releaseLoading.innerHTML = '<span class="text-red-500">先等等！客官刷新的太快了！</span>';
        releasesOfficial = [];
        return releasesOfficial;
    }

    // fetchBeta 支持自动切换到镜像源，全部失败则提示
    async function fetchBeta() {
        let urls = [
            "https://api.github.com/repos/InkCanvasForClass/community-beta/releases"
        ];
        if (fastestMirror) {
            urls.push(fastestMirror + "/https://api.github.com/repos/InkCanvasForClass/community-beta/releases");
        }
        for (const mirror of [
            "https://gh.llkk.cc",
            "https://ghfile.geekertao.top",
            "https://gh.dpik.top",
            "https://github.dpik.top",
            "https://github.acmsz.top",
            "https://git.yylx.win"
        ]) {
            urls.push(mirror + "/https://api.github.com/repos/InkCanvasForClass/community-beta/releases");
        }
        for (let i = 0; i < urls.length; i++) {
            try {
                let res = await fetch(urls[i], { cache: "no-store" });
                if (res.ok) {
                    const list = await res.json();
                    releasesBeta = Array.isArray(list) ? list : [];
                    return releasesBeta;
                }
            } catch (e) {
                // ignore
            }
        }
        releaseLoading.innerHTML = '<span class="text-red-500">先等等！客官刷新的太快了！（测试版）</span>';
        releasesBeta = [];
        return releasesBeta;
    }

    function mergeAndSort() {
        let betaList = releasesBeta.map(r => ({ ...r, _isBeta: true }));
        let officialList = releasesOfficial.map(r => ({ ...r, _isBeta: false }));
        let all = [...officialList, ...betaList];
        all.sort((a, b) => new Date(b.published_at) - new Date(a.published_at));
        return all;
    }

    function renderRelease(idx, animate = false) {
        if (currentReleases.length === 0) {
            releaseList.innerHTML = `<span class="text-gray-500">暂无 Release</span>`;
            return;
        }
        let r = currentReleases[idx];
        let assets = r.assets.map(a =>
            `<a href="${convertDownloadUrl(a.browser_download_url)}" target="_blank" class="inline-block px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700 transition mr-2 mb-2">${a.name}</a>`
        ).join('');
        let bodyHtml = r.body ? marked.parse(r.body) : '<span class="text-gray-400">无说明</span>';
        let badge = r._isBeta
            ? '<span class="px-2 py-1 bg-yellow-200 text-yellow-800 rounded text-xs font-bold mr-2">测试版</span>'
            : '<span class="px-2 py-1 bg-green-200 text-green-800 rounded text-xs font-bold mr-2">正式版</span>';
        let html = `
            <div class="mb-4 p-3 rounded-lg bg-gray-50 shadow">
                <div>
                    ${badge}
                    <a href="${r.html_url}" target="_blank" class="text-blue-800 font-bold hover:underline ml-2">${r.name || r.tag_name}</a>
                    <span class="text-gray-500 text-sm ml-2">${new Date(r.published_at).toLocaleDateString()}</span>
                </div>
                <div class="mt-2 text-sm markdown-body">${bodyHtml}</div>
                <div class="mt-2 text-sm">
                    <strong>附件：</strong>
                    ${assets || '<span class="text-gray-400">无附件</span>'}
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
                bindBtns();
                // 强制刷新所有下方板块的暗色模式（包括新渲染的内容）
                if (document.body.classList.contains("dark")) {
                    setTimeout(() => {
                        document.querySelectorAll(".bg-white, .bg-gray-50, .bg-blue-50, .bg-yellow-50, .rounded-xl, .p-6, .shadow-md, .markdown-body, .text-blue-800, .text-blue-900, .text-gray-700, .text-gray-600, .text-gray-500, .text-gray-800, .text-yellow-800, .text-green-800, .bg-green-200, .bg-yellow-200, .bg-blue-100")
                            .forEach(el => el.classList.add("dark"));
                    }, 0);
                }
            });
        } else {
            releaseList.innerHTML = html;
            releaseList.classList.add('fade-in');
            bindBtns();
            // 强制刷新所有下方板块的暗色模式（包括新渲染的内容）
            if (document.body.classList.contains("dark")) {
                setTimeout(() => {
                    document.querySelectorAll(".bg-white, .bg-gray-50, .bg-blue-50, .bg-yellow-50, .rounded-xl, .p-6, .shadow-md, .markdown-body, .text-blue-800, .text-blue-900, .text-gray-700, .text-gray-600, .text-gray-500, .text-gray-800, .text-yellow-800, .text-green-800, .bg-green-200, .bg-yellow-200, .bg-blue-100")
                        .forEach(el => el.classList.add("dark"));
                }, 0);
            }
        }
    }

    function bindBtns() {
        document.getElementById("prev-release").onclick = function () {
            if (currentIndex > 0) {
                currentIndex--;
                renderRelease(currentIndex, true);
            }
        };
        document.getElementById("next-release").onclick = function () {
            if (currentIndex < currentReleases.length - 1) {
                currentIndex++;
                renderRelease(currentIndex, true);
            }
        };
    }

    // 切换按钮事件
    toggleBtn.onclick = function () {
        if (!showingBeta) {
            toggleBtn.innerText = "只看正式版";
            releaseLoading.style.display = "block";
            releaseList.style.display = "none";
            releaseLoading.innerHTML = loadingSpinner("正在获取测试版...");
            fetchBeta().then(() => {
                currentReleases = mergeAndSort();
                currentIndex = 0;
                releaseLoading.style.display = "none";
                releaseList.style.display = "block";
                renderRelease(currentIndex);
                showingBeta = true;
                // 强制刷新所有下方板块的暗色模式（包括新渲染的内容）
                if (document.body.classList.contains("dark")) {
                    setTimeout(() => {
                        document.querySelectorAll(".bg-white, .bg-gray-50, .bg-blue-50, .bg-yellow-50, .rounded-xl, .p-6, .shadow-md, .markdown-body, .text-blue-800, .text-blue-900, .text-gray-700, .text-gray-600, .text-gray-500, .text-gray-800, .text-yellow-800, .text-green-800, .bg-green-200, .bg-yellow-200, .bg-blue-100")
                            .forEach(el => el.classList.add("dark"));
                    }, 0);
                }
            }).catch(() => {
                releaseLoading.innerText = "测试版获取失败";
            });
        } else {
            toggleBtn.innerText = "显示测试版";
            currentReleases = releasesOfficial;
            currentIndex = 0;
            renderRelease(currentIndex);
            showingBeta = false;
            // 强制刷新所有下方板块的暗色模式（包括新渲染的内容）
            if (document.body.classList.contains("dark")) {
                setTimeout(() => {
                    document.querySelectorAll(".bg-white, .bg-gray-50, .bg-blue-50, .bg-yellow-50, .rounded-xl, .p-6, .shadow-md, .markdown-body, .text-blue-800, .text-blue-900, .text-gray-700, .text-gray-600, .text-gray-500, .text-gray-800, .text-yellow-800, .text-green-800, .bg-green-200, .bg-yellow-200, .bg-blue-100")
                        .forEach(el => el.classList.add("dark"));
                }, 0);
            }
        }
    };

    // 初始化只显示正式版
    fetchOfficial().then(() => {
        currentReleases = releasesOfficial;
        currentIndex = 0;
        releaseLoading.style.display = "none";
        releaseList.style.display = "block";
        renderRelease(currentIndex);
    }).catch(() => {
        releaseLoading.innerText = "获取 Release 信息失败";
    });

    // 镜像加速源测速与自动切换
    const githubApi = "https://api.github.com/repos/InkCanvasForClass/community";
    const mirrorApis = [
        "https://gh.llkk.cc/https://api.github.com/repos/InkCanvasForClass/community",
        "https://ghfile.geekertao.top/https://api.github.com/repos/InkCanvasForClass/community",
        "https://gh.dpik.top/https://api.github.com/repos/InkCanvasForClass/community",
        "https://github.dpik.top/https://api.github.com/repos/InkCanvasForClass/community",
        "https://github.acmsz.top/https://api.github.com/repos/InkCanvasForClass/community",
        "https://git.yylx.win/https://api.github.com/repos/InkCanvasForClass/community"
    ];
    let fastestMirror = null;

    // 进度动画HTML
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

    // 测试单个源速度
    function testMirror(apiUrl) {
        return new Promise(resolve => {
            const start = performance.now();
            fetch(apiUrl, { method: "HEAD", cache: "no-store" })
                .then(() => resolve(performance.now() - start))
                .catch(() => resolve(Infinity));
        });
    }

    // 检测所有源，返回最快的
    async function detectFastestMirror() {
        releaseLoading.innerHTML = loadingSpinner("正在测速下载加速源...");
        let tests = [testMirror(githubApi)];
        for (const url of mirrorApis) {
            tests.push(testMirror(url));
        }
        const results = await Promise.all(tests);
        let minIdx = results.indexOf(Math.min(...results));
        // 0 为 GitHub，其他为镜像
        if (minIdx === 0) return null;
        return mirrorApis[minIdx - 1].replace(/\/https:\/\/api\.github\.com\/repos\/InkCanvasForClass\/community$/, "");
    }

    // 附件链接转换
    function convertDownloadUrl(url) {
        if (!fastestMirror) return url;
        // 只加速 github.com 的下载链接
        if (/^https:\/\/github\.com\//.test(url)) {
            return fastestMirror + "/" + url;
        }
        return url;
    }

    // 页面加载时测速并加载发行版
    releaseLoading.innerHTML = loadingSpinner("正在测速下载加速源...");
    fastestMirror = await detectFastestMirror();

    releaseLoading.innerHTML = loadingSpinner("正在获取版本列表...");
    fetchOfficial().then(() => {
        currentReleases = releasesOfficial;
        currentIndex = 0;
        releaseLoading.style.display = "none";
        releaseList.style.display = "block";
        renderRelease(currentIndex);
    }).catch(() => {
        releaseLoading.innerHTML = '<span class="text-red-500">获取 Release 信息失败</span>';
    });
});