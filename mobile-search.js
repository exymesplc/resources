(function() {
    // 1. Immediate UI Setup (This makes the search bar appear instantly)
    function inject() {
        if (document.getElementById("mob-search-wrap")) return;
        var cols = document.querySelectorAll('[data-framer-name="Nav Column"]');
        if (!cols.length) return;

        var w = document.createElement("div");
        w.id = "mob-search-wrap";
        w.style.cssText = "display:flex;align-items:center;margin-top:16px;width:100%;";
        var st = document.createElement("style");
        st.textContent = '#mob-search-input::placeholder{color:rgba(255,255,255,0.45);}#mob-search-icon-btn{background:transparent;border:none;cursor:pointer;padding:0;display:flex;}#mob-search-bar{display:flex;align-items:center;background:rgba(255,255,255,0.1);border:1px solid rgba(255,255,255,0.25);border-radius:6px;padding:0;width:0;overflow:hidden;transition:all 0.25s ease;opacity:0;}#mob-search-bar.o{width:100%;padding:8px 12px;opacity:1;gap:10px;}#mob-search-input{border:none;outline:none;background:transparent;font-family:Geist,sans-serif;font-size:14px;color:#fff;width:100%;caret-color:#fff;}';
        document.head.appendChild(st);

        w.innerHTML = '<button id="mob-search-icon-btn"><svg viewBox="0 0 24 24" width="22" height="22" fill="none"><circle cx="11" cy="11" r="8" stroke="rgba(255,255,255,0.8)" fill="none" stroke-width="1.4"/><path d="m21 21-4.3-4.3" stroke="rgba(255,255,255,0.8)" fill="none" stroke-linecap="round"/></svg></button><div id="mob-search-bar"><input id="mob-search-input" type="text" placeholder="Search and press Enter..."/></div>';
        cols[0].appendChild(w);

        document.getElementById("mob-search-icon-btn").onclick = function() {
            this.style.display = "none";
            document.getElementById("mob-search-bar").classList.add("o");
            setTimeout(function() {
                var i = document.getElementById("mob-search-input");
                if (i) i.focus();
            }, 260);
        };

        document.getElementById("mob-search-input").onkeydown = function(e) {
            if (e.key === "Enter" && this.value.trim()) window.srch(this.value.trim());
        };
    }

    // 2. Tracking Stub
    window.aa = window.aa || function() { (window.aa.queue = window.aa.queue || []).push(arguments) };
    
    // 3. Background Loader
    function loadAlgolia(cb) {
        if (window.algoliasearch && window.aa.version) { cb(); return; }
        var s = document.createElement("script");
        s.src = "https://cdn.jsdelivr.net/npm/algoliasearch@4/dist/algoliasearch-lite.umd.js";
        var si = document.createElement("script");
        si.src = "https://cdn.jsdelivr.net/npm/search-insights@2.11.0/dist/search-insights.min.js";
        
        var loaded = 0;
        function check() { 
            if (++loaded === 2) { 
                window.aa('init', { appId: 'E3WSWA1RJ6', apiKey: 'f6fca2acd7672892699e91a42117a01b', useCookie: true });
                cb(); 
            } 
        }
        s.onload = check; si.onload = check;
        document.head.appendChild(s); document.head.appendChild(si);
    }

    window.srch = function(q) {
        loadAlgolia(function() {
            var c = window.algoliasearch("E3WSWA1RJ6", "f6fca2acd7672892699e91a42117a01b");
            var p = { hitsPerPage: 6, clickAnalytics: true };
            Promise.all([
                c.initIndex("www_exymesplc_com_e3wswa1rj6_pages").search(q, p),
                c.initIndex("exymesplc_pdfs").search(q, { hitsPerPage: 4, clickAnalytics: true })
            ]).then(function(r) {
                var ph = r[0].hits.filter(function(h) { return !h.url || !h.url.includes("/team"); });
                show(q, ph.concat(r[1].hits));
            });
        });
    };

    function show(q, hits) {
        var old = document.getElementById("mr"); if (old) old.remove();
        var p = document.createElement("div"); p.id = "mr";
        p.style.cssText = "position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:90vw;max-height:75vh;background:#fff;border-radius:12px;box-shadow:0 16px 64px rgba(14,55,71,0.3);z-index:999999;display:flex;flex-direction:column;overflow:hidden;font-family:Geist,sans-serif;";
        
        var list = document.createElement("div"); list.style.cssText = "overflow-y:auto;flex:1;overscroll-behavior:contain;padding-bottom:20px;";
        
        // Inner HTML generation (Keeping your logic)
        var html = '<div style="display:flex;align-items:center;gap:12px;padding:14px 20px;background:#0E3747;"><input id="mri" type="text" style="border:none;outline:none;background:transparent;font-size:14px;color:#fff;width:100%;" value="'+q+'"/><button id="mrx" style="background:transparent;border:none;color:#fff;cursor:pointer;">X</button></div>';
        html += '<div style="padding:8px 20px;font-size:12px;color:#5D6376;border-bottom:1px solid #eee;">'+hits.length+' results</div>';
        
        if(!hits.length) { html += '<div style="padding:40px;text-align:center;">No results</div>'; }
        
        list.innerHTML = html;
        hits.forEach(function(h) {
            var el = document.createElement("div");
            el.style.cssText = "padding:14px 20px;border-bottom:1px solid #eee;cursor:pointer;";
            el.innerHTML = '<div style="font-weight:500;color:#0E3747;">'+(h.title||h.headers[0]||"Result")+'</div><div style="font-size:11px;color:#1D7492;">'+(h.url||"")+'</div>';
            
            el.onclick = function() {
                if(window.aa) { window.aa('clickedObjectIDs', { index: h.__indexName || "www_exymesplc_com_e3wswa1rj6_pages", eventName: 'Click', objectIDs: [h.objectID] }); }
                window.open(h.url || h.objectID, "_blank");
                p.remove();
            };
            list.appendChild(el);
        });

        p.appendChild(list);
        document.body.appendChild(p);
        document.getElementById("mrx").onclick = function() { p.remove(); };
    }

    // 4. Initialization Polling (Ensures Framer nav is ready)
    var poll = setInterval(function() {
        if (document.querySelectorAll('[data-framer-name="Nav Column"]').length) {
            inject();
            clearInterval(poll);
        }
    }, 200);
    setTimeout(function() { clearInterval(poll); }, 10000);
})();
