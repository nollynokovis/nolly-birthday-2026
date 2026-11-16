// YouTube 直播存檔（首頁活動回顧的 .yt-card）：先顯示縮圖＋播放鈕，點下去才在原位置建立真正的 YouTube iframe 播放器（直接在網站內播放），
// 所以進頁面時不會載入任何 YouTube 播放器；影片 ID 在每張卡片的 data-video（來自官方直播存檔網址 youtube.com/live/<ID>），data-title 是影片標題
// .yt-frame 本身是連到 YouTube 的連結：沒有 JS 或使用者用 Ctrl／Cmd／滑鼠中鍵點時，維持原本的連結行為（開 YouTube）
// 縮圖先用一定存在的 hqdefault（4:3，上下有黑邊，CSS 以 object-fit: cover 裁成 16:9），有高解析度版（maxresdefault）時再換上去
(() => {
    document.querySelectorAll('.yt-card[data-video]').forEach(card => {
        const id = card.dataset.video;
        const frame = card.querySelector('.yt-frame');
        const thumb = card.querySelector('.yt-thumb');

        if (thumb) {
            const probe = new Image();
            probe.onload = () => { if (probe.naturalWidth > 320) thumb.src = probe.src; };    // 沒有高解析度版時 YouTube 回傳的是小張預設圖，不採用
            probe.src = `https://i.ytimg.com/vi/${id}/maxresdefault.jpg`;
        }

        if (!frame) return;
        frame.addEventListener('click', e => {
            if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
            e.preventDefault();
            const player = document.createElement('div');
            player.className = 'yt-player';
            const iframe = document.createElement('iframe');
            iframe.src = `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1&rel=0&playsinline=1`;
            iframe.title = card.dataset.title || 'YouTube video player';
            iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
            iframe.allowFullscreen = true;
            iframe.referrerPolicy = 'strict-origin-when-cross-origin';
            player.append(iframe);
            frame.replaceWith(player);
        });
    });
})();