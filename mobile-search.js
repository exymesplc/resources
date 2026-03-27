(function(){
// 1. Load both Algolia Search and Insights libraries
function loadAlgolia(cb){
    if(window.algoliasearch && window.aa){cb();return;}
    var s=document.createElement("script");
    s.src="https://cdn.jsdelivr.net/npm/algoliasearch@4/dist/algoliasearch-lite.umd.js";
    var si=document.createElement("script");
    si.src="https://cdn.jsdelivr.net/npm/search-insights@2.11.0/dist/search-insights.min.js";
    
    var loaded=0;
    function check(){ if(++loaded === 2) { 
        // Initialize Insights
        window.aa('init', { appId: 'E3WSWA1RJ6', apiKey: 'f6fca2acd7672892699e91a42117a01b' });
        cb(); 
    }}
    s.onload=check; si.onload=check;
    document.head.appendChild(s); document.head.appendChild(si);
}

window.srch=function(q){
    loadAlgolia(function(){
        var c=window.algoliasearch("E3WSWA1RJ6","f6fca2acd7672892699e91a42117a01b");
        // Note: Adding clickAnalytics:true is vital for Algolia to generate a QueryID
        var params = { hitsPerPage:6, clickAnalytics: true };
        
        Promise.all([
            c.initIndex("www_exymesplc_com_e3wswa1rj6_pages").search(q, params),
            c.initIndex("exymesplc_pdfs").search(q, { hitsPerPage:4, clickAnalytics: true })
        ]).then(function(r){
            var ph=r[0].hits.filter(function(h){return!h.url||!h.url.includes("/team");});
            // We pass the results along with their unique queryIDs
            show(q, ph.concat(r[1].hits));
        });
    });
};

function show(q, hits){
    var old=document.getElementById("mr");if(old)old.remove();
    var p=document.createElement("div");p.id="mr";
    p.style.cssText="position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);width:90vw;max-height:75vh;background:#fff;border-radius:12px;box-shadow:0 16px 64px rgba(14,55,71,0.3);z-index:999999;display:flex;flex-direction:column;overflow:hidden;font-family:Geist,sans-serif;";
    
    // ... [Internal UI styles kept as per your original code] ...
    
    var list=document.createElement("div");list.style.cssText="overflow-y:auto;flex:1;overscroll-behavior:contain;";
    
    if(!hits.length){list.innerHTML='<div style="padding:40px;text-align:center;color:#5D6376;">No results</div>';}
    else{
        hits.forEach(function(h){
            var t=(h.headers&&h.headers[0])||h.title||"Untitled";
            var d=h.description||""; var u=h.url||h.objectID||"";
            var el=document.createElement("div");
            
            // ADDED: Analytics Attributes for GTM/Algolia
            el.setAttribute('data-algolia-id', h.objectID);
            el.setAttribute('data-algolia-index', h.__indexName || "www_exymesplc_com_e3wswa1rj6_pages");
            el.className = "algolia-clickable"; 
            
            el.style.cssText="padding:14px 20px;border-bottom:1px solid rgba(14,55,71,0.06);cursor:pointer;";
            
            el.onclick=function(){
                // Track the click directly in code (Secondary backup to GTM)
                if(window.aa) {
                    window.aa('clickedObjectIDs', {
                        index: el.getAttribute('data-algolia-index'),
                        eventName: 'Search Result Click',
                        objectIDs: [h.objectID]
                    });
                }
                window.open(u,"_blank","noopener");
                p.remove();
            };

            el.innerHTML=(u.includes("resources.exymesplc.com")?'<span style="font-size:10px;font-weight:600;color:#fff;background:#1D7492;border-radius:3px;padding:2px 6px;margin-bottom:4px;display:inline-block;">PDF</span><br>':'')+
            '<div style="font-size:14px;font-weight:500;color:#0E3747;margin-bottom:2px;">'+t+'</div>'+
            (d?'<div style="font-size:12px;color:#5D6376;line-height:1.5;margin-bottom:2px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">'+d+'</div>':'')+
            '<div style="font-size:11px;color:#1D7492;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">'+u+'</div>';
            list.appendChild(el);
        });
    }
    // ... [Rest of your UI injection logic] ...
    p.appendChild(list);
    document.body.appendChild(p);
}
// ... [Remaining original logic for Framer injection] ...
})();
